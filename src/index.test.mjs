import { test } from 'node:test';
import assert from 'node:assert/strict';
import plugin, { connection, DEFAULT_API_URL } from './index.js';

const KEY = 'k'.repeat(32);

test('a key alone gives Revere\'s address and the key as a bearer header', () => {
  assert.deepEqual(connection({ token: KEY }), { url: `${DEFAULT_API_URL}/mcp`, headers: { Authorization: `Bearer ${KEY}` } });
});

test('a given address is used, https only and no path', () => {
  assert.equal(connection({ token: KEY, apiUrl: 'https://revere.example.org' }).url, 'https://revere.example.org/mcp');
  for (const bad of ['http://revere.example.org', 'https://revere.example.org/x', 'https://revere.example.org/', 'ftp://x', '', 7, 'https://a b'])
    assert.equal(connection({ token: KEY, apiUrl: bad }), null, String(bad));
});

test('no usable key, no connection', () => {
  for (const bad of [undefined, null, {}, { token: '' }, { token: 'short' }, { token: `${KEY} x` }, { token: `${KEY}\n` }, { token: 12345678901234567890 }])
    assert.equal(connection(bad), null, JSON.stringify(bad));
});

test('the plugin registers one resolver for the server the manifest names, reading the settings when asked', async () => {
  const seen = [];
  const settings = { token: KEY };
  plugin.register({ pluginConfig: settings, registerMcpServerConnectionResolver: r => seen.push(r) });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].serverName, 'revere');
  assert.equal((await seen[0].resolve({ requesterSenderId: 'someone' })).headers.Authorization, `Bearer ${KEY}`);
  settings.token = 'z'.repeat(20);   // a changed key applies to the next connection
  assert.equal((await seen[0].resolve({ requesterSenderId: 'someone' })).headers.Authorization, `Bearer ${'z'.repeat(20)}`);
});

test('the key is not in anything the plugin prints', async () => {
  const lines = [];
  const real = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...a) => lines.push(a.join(' '));
  try {
    const seen = [];
    plugin.register({ pluginConfig: { token: KEY }, registerMcpServerConnectionResolver: r => seen.push(r) });
    await seen[0].resolve({ requesterSenderId: 'someone' });
    connection({ token: 'bad key' });
  } finally { Object.assign(console, real); }
  assert.equal(lines.join('\n').includes(KEY), false);
  assert.deepEqual(lines, []);
});
