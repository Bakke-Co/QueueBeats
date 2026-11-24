const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const vm = require('node:vm');
const { test } = require('node:test');
const redirects = require('follow-redirects');
const axios = require('axios');

async function server(t, handler) {
  const instance = http.createServer(handler);
  instance.listen(0, '127.0.0.1');
  await once(instance, 'listening');
  t.after(() => new Promise(resolve => instance.close(resolve)));
  return `http://127.0.0.1:${instance.address().port}`;
}

async function fixture(t) {
  const destination = await server(t, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.headers));
  });
  return server(t, (req, res) => {
    if (req.url === '/same') {
      res.writeHead(302, { Location: '/echo' });
      res.end();
    } else if (req.url === '/echo') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.headers));
    } else {
      res.writeHead(302, { Location: destination });
      res.end();
    }
  });
}

function get(url, sensitiveHeaders) {
  return new Promise((resolve, reject) => {
    const request = redirects.http.get(url, {
      sensitiveHeaders,
      headers: {
        'X-API-Key': 'synthetic-test-key',
        'X-Harmless': 'retained',
        Authorization: 'Bearer synthetic-test-token',
        Cookie: 'synthetic=test',
      },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('request timed out')));
  });
}

for (const realm of ['same', 'cross']) {
  test(`${realm}-realm custom credentials stay off cross-origin redirects`, async t => {
    const url = await fixture(t);
    const sensitive = realm === 'same' ? ['X-API-Key'] : vm.runInNewContext("['X-API-Key']");
    const headers = await get(url, sensitive);
    assert.equal(headers['x-api-key'], undefined);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers.cookie, undefined);
    assert.equal(headers['x-harmless'], 'retained');
  });
}

test('same-origin redirects retain credentials', async t => {
  const url = await fixture(t);
  const headers = await get(`${url}/same`, vm.runInNewContext("['X-API-Key']"));
  assert.equal(headers['x-api-key'], 'synthetic-test-key');
  assert.equal(headers.authorization, 'Bearer synthetic-test-token');
});

test('Axios follows redirects and preserves ordinary headers', async t => {
  const url = await fixture(t);
  const { data } = await axios.get(url, {
    proxy: false,
    timeout: 3000,
    headers: { 'X-Harmless': 'retained', Authorization: 'Bearer synthetic-test-token' },
  });
  assert.equal(data['x-harmless'], 'retained');
  assert.equal(data.authorization, undefined);
});
