import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTokenReadiness } from '../src/utils/tokenReadiness';

for (const code of ['42P01', 'PGRST205', '42501', 'PGRST301', '']) {
  test(`token readiness fails closed for ${code || 'transport response'}`, async () => {
    let reads = 0;
    const result = await checkTokenReadiness(async () => { reads++; return { error: { code, message: 'fixture failure' } }; });
    assert.equal(result.success, false);
    assert.equal(reads, 1);
  });
}
test('token readiness handles thrown transport errors', async () => {
  const result = await checkTokenReadiness(async () => { throw new Error('offline'); });
  assert.equal(result.success, false);
  assert.match(result.message, /could not be reached/);
});
test('token readiness accepts an empty readable table', async () => {
  assert.equal((await checkTokenReadiness(async () => ({ error: null }))).success, true);
});
