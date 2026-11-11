import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, parseManifest, frontmatter } from './check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const copy = () => { const d = mkdtempSync(join(tmpdir(), 'oc-')); for (const f of ['openclaw.plugin.json', 'package.json', 'LICENSE']) cpSync(join(root, f), join(d, f)); cpSync(join(root, 'skills'), join(d, 'skills'), { recursive: true }); return d; };

test('the repository passes its own checks', () => { assert.deepEqual(check(root), []); });

test('the manifest parser takes comments and leaves // inside strings', () => {
  assert.deepEqual(parseManifest('// c\n{ "a": "http://x//y", /* b */ "n": 1 }'), { a: 'http://x//y', n: 1 });
});

test('frontmatter reads name, description and version', () => {
  assert.deepEqual(frontmatter('---\nname: a\ndescription: b c\nversion: 1\n---\nbody'), { name: 'a', description: 'b c', version: '1' });
  assert.equal(frontmatter('no frontmatter'), null);
});

test('it stops what v1 must not be: code, a plain-text MCP server, a leaked key, a wrong licence, a loose schema', () => {
  const mutate = (f, fn) => { const d = copy(); const p = join(d, f); writeFileSync(p, fn(readFileSync(p, 'utf8'))); return check(d); };
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('"version": "0.1.0"', '"version": "9.9.9"')).some(p => /versions differ/.test(p)));
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('https://[^\\\\s/]+$', '.*')).some(p => /https/.test(p)));
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('"sensitive": true', '"sensitive": false')).some(p => /sensitive/.test(p)));
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('"additionalProperties": false', '"additionalProperties": true')).some(p => /additionalProperties/.test(p)));
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('"skills": ["skills"],', '"skills": ["skills"], "contracts": { "tools": ["x"] },')).some(p => /manifest-only/.test(p)));
  assert.ok(mutate('openclaw.plugin.json', t => t.replace('"transport": "streamable-http"', '"transport": "streamable-http", "alt": "http://x"')).some(p => /https/.test(p)));
  assert.ok(mutate('skills/LICENSE', t => t.replace('MIT No Attribution', 'MIT License')).some(p => /MIT-0/.test(p)));
  assert.ok(mutate('skills/revere/SKILL.md', t => t + '\nrvpat_' + 'a'.repeat(43)).some(p => /credential/.test(p)));
  assert.ok(mutate('skills/revere-night-watch/SKILL.md', t => t.replace('Load the `revere` skill first', 'Go')).some(p => /load the base skill/.test(p)));
  assert.ok(mutate('package.json', t => t.replace('"license": "MIT"', '"license": "MIT", "dependencies": { "x": "1" }')).some(p => /no dependencies/.test(p)));
});

