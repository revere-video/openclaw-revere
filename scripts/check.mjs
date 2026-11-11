// Repository checks: the manifest parses and is what we mean to publish, every skill is well formed, the licences are
// there, versions agree, and nothing looks like a credential. No dependencies. Exits 1 with the problems.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** JSON5's comments are all the manifest uses: strip // and block comments outside strings, then JSON.parse. */
export function parseManifest(text) {
  let out = '', i = 0, inString = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inString) { out += c; if (c === '\\') { out += n; i += 2; continue; } if (c === '"') inString = false; i++; continue; }
    if (c === '"') { inString = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out);
}

export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) { const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line); if (kv) fm[kv[1]] = kv[2].trim(); }
  return fm;
}

const CREDENTIAL = /\b(rvpat_[0-9A-Za-z]{20,}|bfry_mcp_[0-9a-f]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

export function check(dir = root) {
  const problems = [];
  const read = f => readFileSync(join(dir, f), 'utf8');
  let manifest, pkg;
  try { manifest = parseManifest(read('openclaw.plugin.json')); } catch (e) { return [`openclaw.plugin.json does not parse (${e.message})`]; }
  try { pkg = JSON.parse(read('package.json')); } catch (e) { return [`package.json does not parse (${e.message})`]; }

  if (manifest.id !== 'revere') problems.push('the manifest id must be "revere"');
  for (const f of ['name', 'description', 'version', 'configSchema']) if (!manifest[f]) problems.push(`the manifest has no ${f}`);
  if (manifest.version !== pkg.version) problems.push(`versions differ: manifest ${manifest.version}, package.json ${pkg.version}`);
  const schema = manifest.configSchema ?? {};
  if (schema.additionalProperties !== false) problems.push('configSchema must set additionalProperties to false');
  if (!schema.required?.includes('token')) problems.push('configSchema must require token');
  if (manifest.uiHints?.token?.sensitive !== true) problems.push('uiHints must mark token sensitive');
  if (!/\^https:/.test(schema.properties?.apiUrl?.pattern ?? '')) problems.push('apiUrl must be restricted to https');
  if ((manifest.recommendedPrompts ?? []).length > 3) problems.push('recommendedPrompts is at most three');
  if (manifest.contracts?.tools || manifest.activation) problems.push('v1 is manifest-only: no contracts.tools and no activation');
  if (existsSync(join(dir, 'index.ts')) || existsSync(join(dir, 'index.js')) || existsSync(join(dir, 'dist'))) problems.push('v1 ships no entry point');
  if (JSON.stringify(manifest.mcpServers ?? {}).includes('http://')) problems.push('the MCP server must be https');
  if ((pkg.dependencies && Object.keys(pkg.dependencies).length) || pkg.scripts?.install || pkg.scripts?.postinstall || pkg.scripts?.preinstall) problems.push('no dependencies and no install-time scripts');

  const skills = readdirSync(join(dir, 'skills')).filter(n => statSync(join(dir, 'skills', n)).isDirectory());
  if (!skills.includes('revere')) problems.push('the base skill revere is missing');
  const recipes = skills.filter(n => n !== 'revere');
  if (recipes.length !== 5) problems.push(`expected five recipe skills, found ${recipes.length}`);
  for (const n of skills) {
    const file = join('skills', n, 'SKILL.md');
    if (!existsSync(join(dir, file))) { problems.push(`${file} is missing`); continue; }
    const text = read(file), fm = frontmatter(text);
    if (!fm) { problems.push(`${file} has no frontmatter`); continue; }
    if (fm.name !== n) problems.push(`${file}: name must be ${n}`);
    if (!fm.description) problems.push(`${file}: no description`);
    if (fm.version !== manifest.version) problems.push(`${file}: version ${fm.version} differs from the manifest's`);
    if (n !== 'revere' && !text.includes('Load the `revere` skill first')) problems.push(`${file}: a recipe must load the base skill first`);
  }
  if (!/MIT No Attribution/.test(read('skills/LICENSE'))) problems.push('skills/LICENSE must be MIT-0 (MIT No Attribution)');
  if (!/^MIT License/.test(read('LICENSE'))) problems.push('LICENSE must be MIT');

  const walk = d => readdirSync(join(dir, d)).flatMap(n => {
    const rel = join(d, n);
    if (['node_modules', '.git', '.wrangler'].includes(n)) return [];
    return statSync(join(dir, rel)).isDirectory() ? walk(rel) : [rel];
  });
  for (const f of [...walk('.'), ].filter(f => !f.endsWith('.test.mjs'))) {
    if (CREDENTIAL.test(read(f))) problems.push(`${f} looks like it holds a credential`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = check();
  if (problems.length) { console.error(problems.map(p => `- ${p}`).join('\n')); process.exit(1); }
  console.log('Checks pass.');
}
