import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songInsert } from '../src/utils/queueContracts';

test('search metadata maps to declared song columns and keeps the authenticated owner', () => {
  const row = songInsert('queue', { title: 'Song', artist: 'Artist', spotify_uri: 'spotify:track:fixture', duration_ms: 123000 }, 'user');
  assert.equal(row.track_uri, 'spotify:track:fixture');
  assert.equal(row.duration, 123000);
  assert.equal(row.added_by, 'user');
  assert.equal('spotify_uri' in row, false);
  assert.equal('duration_ms' in row, false);
});

test('canonical song fields win, including a zero duration', () => {
  const row = songInsert('queue', { title: 'Song', artist: 'Artist', track_uri: 'canonical', spotify_uri: 'legacy', duration: 0, duration_ms: 5000 }, 'user');
  assert.equal(row.track_uri, 'canonical');
  assert.equal(row.duration, 0);
});

test('anonymous ownership is rejected before constructing an insert', () => {
  assert.throws(() => songInsert('queue', { title: 'Song', artist: 'Artist' }, ''), /Authentication required/);
});
