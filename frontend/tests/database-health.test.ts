import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { probeDatabase, PUBLIC_TABLES } from '../src/utils/databaseHealthProbe';

test('real Supabase query builder probes application tables with zero-row GETs and no mutation/RPC', async () => {
  const requests: { method: string; path: string; limit: string | null }[] = [];
  const client = createClient('https://fixture.supabase.co', 'fixture-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      requests.push({ method: init?.method || 'GET', path: url.pathname, limit: url.searchParams.get('limit') });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const result = await probeDatabase(table => client.from(table).select('id').limit(0));
  assert.equal(result.status, 'healthy');
  assert.deepEqual(requests, PUBLIC_TABLES.map(table => ({ method: 'GET', path: '/rest/v1/' + table, limit: '0' })));
});

test('unreachable data service is not diagnosed as missing tables', async () => {
  const result = await probeDatabase(async () => { throw new TypeError('fetch failed: DNS lookup'); });
  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'unavailable');
  assert.equal(result.missing_tables, undefined);
});

test('Supabase transport errors and access denials remain distinct', async () => {
  const network = await probeDatabase(async () => ({ error: { code: '', message: 'TypeError: Failed to fetch' } }));
  assert.equal(network.reason, 'unavailable');
  for (const code of ['42501', 'PGRST301', 'PGRST302', 'PGRST303']) {
    const denied = await probeDatabase(async () => ({ error: { code, message: 'denied' } }));
    assert.equal(denied.reason, 'access_denied');
    assert.equal(denied.missing_tables, undefined);
  }
});

test('only explicit relation-absence errors identify missing tables', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    const result = await probeDatabase(async table => ({ error: table === 'songs' ? { code, message: 'missing' } : null }));
    assert.equal(result.status, 'missing_tables');
    assert.deepEqual(result.missing_tables, ['songs']);
  }
  const unknown = await probeDatabase(async () => ({ error: { code: 'PGRST100', message: 'invalid query' } }));
  assert.equal(unknown.reason, 'probe_failed');
});

test('a later connection failure invalidates a partial missing-table diagnosis', async () => {
  const result = await probeDatabase(async table => ({ error: table === 'profiles' ? { code: '42P01', message: 'missing' } : { code: '', message: 'Failed to fetch' } }));
  assert.equal(result.status, 'error');
  assert.equal(result.missing_tables, undefined);
});
