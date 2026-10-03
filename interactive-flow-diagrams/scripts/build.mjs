#!/usr/bin/env node
/**
 * flowfig build - validate a diagram config and inline everything into ONE
 * self-contained HTML file (engine + styles + config + icons).
 *
 *   node scripts/build.mjs diagram.json                 -> diagram.html next to it
 *   node scripts/build.mjs diagram.json -o out.html
 *   node scripts/build.mjs diagram.json --check         -> validate only
 *   node scripts/build.mjs diagram.json --fetch-icons   -> allow iconify:/https: icons (network)
 *
 * The config may be JSON or JSONC (comments and trailing commas are allowed).
 * Requires Node.js 18+. No npm dependencies.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, '..', 'assets');

const USAGE = `Usage: node build.mjs <diagram.json> [-o out.html] [--check] [--fetch-icons] [--quiet]`;

function parseArgs(argv) {
  const a = { input: null, out: null, check: false, fetchIcons: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-o' || v === '--out') a.out = argv[++i];
    else if (v === '--check') a.check = true;
    else if (v === '--fetch-icons') a.fetchIcons = true;
    else if (v === '--quiet' || v === '-q') a.quiet = true;
    else if (v === '-h' || v === '--help') { console.log(USAGE); process.exit(0); }
    else if (!a.input) a.input = v;
    else fail(`Unexpected argument: ${v}\n${USAGE}`);
  }
  if (!a.input) fail(USAGE);
  return a;
}
function fail(msg) { console.error(msg); process.exit(1); }

/* ---------- JSONC ---------- */
export function parseJsonc(text) {
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  // remove trailing commas (string-aware)
  let res = ''; inStr = false;
  for (let j = 0; j < out.length; j++) {
    const c = out[j];
    if (inStr) { res += c; if (c === '\\') { res += out[++j] ?? ''; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; res += c; continue; }
    if (c === ',') {
      let k = j + 1;
      while (k < out.length && /\s/.test(out[k])) k++;
      if (out[k] === '}' || out[k] === ']') continue;
    }
    res += c;
  }
  return JSON.parse(res);
}

/* ---------- engine metadata (icons + kinds are read from flowfig.js) ---------- */
function readBlock(js, name) {
  const m = js.match(new RegExp(`/\\*${name}-START\\*/([\\s\\S]*?)/\\*${name}-END\\*/`));
  if (!m) throw new Error(`Engine block ${name} not found in flowfig.js`);
  return JSON.parse(m[1]);
}
const KIND_ALIASES = ['db', 'k8s', 'kubernetes', 'bucket', 's3', 'lambda', 'serverless', 'loadbalancer', 'load-balancer', 'events', 'pubsub', 'kafka', 'ai', 'idp', 'identity', 'vault', 'saas', 'thirdparty', 'ci', 'vm', 'server', 'app'];
const TONES = ['accent', 'ok', 'warn', 'error', 'blue', 'purple', 'green', 'orange', 'red', 'teal', 'pink', 'gray', 'indigo'];
const STATES = ['ok', 'warn', 'error', 'off'];
const SIDES = ['top', 'right', 'bottom', 'left', 't', 'r', 'b', 'l'];
const ARROWS = ['auto', 'end', 'start', 'both', 'none'];

/* ---------- validation ---------- */
export function validate(cfg, meta) {
  const errors = [], warnings = [];
  const E = (p, m) => errors.push(`${p}: ${m}`);
  const W = (p, m) => warnings.push(`${p}: ${m}`);
  const kinds = new Set([...Object.keys(meta.kinds), ...KIND_ALIASES]);
  const icons = new Set(Object.keys(meta.icons));
  const ids = new Map(); // id -> 'node' | 'group'
  let nodeCount = 0;

  if (!cfg || typeof cfg !== 'object') { E('config', 'must be an object'); return { errors, warnings }; }
  if (!cfg.layout || !Array.isArray(cfg.layout.children)) E('layout', 'needs a "children" array');
  if (cfg.theme != null && typeof cfg.theme !== 'string' && typeof cfg.theme !== 'object') E('theme', 'must be "auto" | "light" | "dark" or an object');
  if (typeof cfg.theme === 'string' && !['auto', 'light', 'dark'].includes(cfg.theme)) E('theme', `unknown theme "${cfg.theme}"`);
  if (cfg.routing != null && !['curved', 'orthogonal'].includes(cfg.routing)) E('routing', 'must be "curved" (default) or "orthogonal"');
  if (cfg.arrows != null && !ARROWS.includes(cfg.arrows)) E('arrows', `must be ${ARROWS.join(' | ')}`);

  const checkIcon = (p, v) => {
    if (v == null || v === false) return;
    if (typeof v !== 'string') return E(p, 'icon must be a string or false');
    if (icons.has(v) || /^(data:|https?:|iconify:|file:|<svg)/.test(v.trim()) || /\.(svg|png|jpe?g|webp|gif)$/i.test(v)) return;
    E(p, `unknown built-in icon "${v}". Built-ins: ${[...icons].join(', ')}`);
  };
  const walk = (item, path, depth) => {
    if (!item || typeof item !== 'object') return E(path, 'must be an object');
    if (item.id != null) {
      if (typeof item.id !== 'string' || !/^[A-Za-z0-9_.:-]+$/.test(item.id)) E(path, `id "${item.id}" must use letters, digits, _ . : -`);
      else if (ids.has(item.id)) E(path, `duplicate id "${item.id}"`);
      else ids.set(item.id, item.children ? 'group' : 'node');
    }
    if (item.children) {
      if (!Array.isArray(item.children) || !item.children.length) E(path, 'group "children" must be a non-empty array');
      if (item.direction && !['row', 'column'].includes(item.direction)) E(path, `direction must be "row" or "column"`);
      if (item.style && !['solid', 'dashed', 'plain'].includes(item.style)) E(path, `style must be solid | dashed | plain`);
      if (item.tone && !TONES.includes(item.tone) && !/^(#|rgb|hsl)/.test(item.tone)) W(path, `unknown tone "${item.tone}"`);
      if (item.kind && !kinds.has(String(item.kind).toLowerCase())) W(path, `unknown kind "${item.kind}"`);
      checkIcon(path + '.icon', item.icon);
      if (depth > 5) W(path, 'nesting deeper than 5 levels is hard to read');
      (item.children || []).forEach((c, i) => walk(c, `${path}.children[${i}]`, depth + 1));
      return;
    }
    nodeCount++;
    if (!item.id) E(path, 'node needs an "id"');
    if (item.label == null) W(path, 'node has no "label" (id is shown)');
    if (item.label && String(item.label).length > 28) W(path, `label "${item.label}" is long; keep node labels short (use "sub" for detail)`);
    if (item.kind && !kinds.has(String(item.kind).toLowerCase())) W(path, `unknown kind "${item.kind}" (known: ${Object.keys(meta.kinds).join(', ')})`);
    if (item.shape && !['box', 'store', 'pill'].includes(item.shape)) E(path, 'shape must be box | store | pill');
    if (item.style && !['solid', 'dashed'].includes(item.style)) E(path, 'node style must be solid | dashed');
    if (item.tone && !TONES.includes(item.tone) && !/^(#|rgb|hsl)/.test(item.tone)) W(path, `unknown tone "${item.tone}"`);
    checkIcon(path + '.icon', item.icon);
    checkIcon(path + '.iconDark', item.iconDark);
  };
  if (cfg.layout) walk(cfg.layout, 'layout', 0);
  if (nodeCount > 20) W('layout', `${nodeCount} nodes - consider splitting into two diagrams (aim for 5-15)`);

  const edgeIds = new Set();
  (cfg.edges || []).forEach((e, i) => {
    const p = `edges[${i}]`;
    if (!e.from || !e.to) return E(p, 'needs "from" and "to"');
    if (!ids.has(e.from)) E(p, `from "${e.from}" is not a node or group id`);
    if (!ids.has(e.to)) E(p, `to "${e.to}" is not a node or group id`);
    const id = e.id || `${e.from}->${e.to}`;
    if (edgeIds.has(id)) E(p, `duplicate edge id "${id}" (give parallel edges an explicit "id")`);
    edgeIds.add(id);
    if (e.style && !['sync', 'async', 'stream'].includes(e.style)) E(p, 'style must be sync | async | stream');
    if (e.around && !['above', 'below'].includes(e.around)) E(p, 'around must be above | below');
    if (e.from === e.to) E(p, `edge from "${e.from}" to itself is not supported`);
    if (e.arrows != null && !ARROWS.includes(e.arrows)) E(p, `arrows must be ${ARROWS.join(' | ')}`);
    if (e.both != null) W(p, '"both" is deprecated - use "arrows": "both"');
    if (e.fromSide && !SIDES.includes(e.fromSide)) E(p, 'fromSide must be top | right | bottom | left');
    if (e.toSide && !SIDES.includes(e.toSide)) E(p, 'toSide must be top | right | bottom | left');
    if (e.label && String(e.label).length > 24) W(p, `edge label "${e.label}" is long`);
  });

  const scenarios = cfg.scenarios || cfg.steps;
  if (!Array.isArray(scenarios) || !scenarios.length) W('scenarios', 'no scenarios - the diagram will be static');
  (scenarios || []).forEach((sc, si) => {
    const sp = `scenarios[${si}]`;
    if (!sc.label) W(sp, 'scenario has no "label"');
    const flow = sc.flow || sc.beats;
    if (!Array.isArray(flow) || !flow.length) return E(sp, 'needs a non-empty "flow" array of beats');
    if (flow.length > 14) W(sp, `${flow.length} beats - long scenarios lose the audience; split them`);
    let total = 0;
    flow.forEach((b, bi) => {
      const bp = `${sp}.flow[${bi}]`;
      const hops = b.edges ?? b.hops;
      const list = hops == null ? [] : Array.isArray(hops) ? hops : [hops];
      list.forEach((hp, hi) => {
        const ref = typeof hp === 'string' ? hp : hp && hp.edge;
        if (!ref) return E(`${bp}.edges[${hi}]`, 'hop needs an edge id');
        if (!edgeIds.has(ref)) E(`${bp}.edges[${hi}]`, `unknown edge "${ref}" (known: ${[...edgeIds].join(', ')})`);
        if (typeof hp === 'object' && hp.tone && !['ok', 'warn', 'error', 'accent'].includes(hp.tone)) E(`${bp}.edges[${hi}]`, 'hop tone must be ok | warn | error | accent');
        if (typeof hp === 'object' && hp.data != null && String(hp.data).length > 60) W(`${bp}.edges[${hi}]`, 'payload text over 60 chars will wrap; shorten it');
      });
      Object.keys(b.show || {}).forEach(id => {
        if (!ids.has(id)) E(`${bp}.show`, `unknown node "${id}"`);
        else if (ids.get(id) === 'group') E(`${bp}.show`, `"${id}" is a group; panels only live on nodes`);
        const c = b.show[id];
        const n = c == null ? 0 : Array.isArray(c) ? c.length : 1;
        if (n > 8) W(`${bp}.show.${id}`, `${n} rows - keep panels to 1-6 rows`);
      });
      Object.keys(b.state || {}).forEach(id => {
        if (!ids.has(id) || ids.get(id) !== 'node') E(`${bp}.state`, `unknown node "${id}"`);
        const v = b.state[id];
        if (v != null && !STATES.includes(v)) E(`${bp}.state.${id}`, `state must be ok | warn | error | off | null`);
      });
      [].concat(b.light || []).forEach(id => { if (!ids.has(id)) E(`${bp}.light`, `unknown id "${id}"`); });
      if (b.ms != null && (typeof b.ms !== 'number' || b.ms < 300)) E(bp, '"ms" must be a number >= 300');
      if (b.say && String(b.say).length > 240) W(bp, 'caption over 240 chars - trim it (aim for one or two short sentences)');
      if (!list.length && !b.show && !b.state && !b.say && !b.light) W(bp, 'beat does nothing');
      total += b.ms ?? cfg.beatMs ?? 2200;
    });
    if (total > 60000) W(sp, `about ${Math.round(total / 1000)}s long - GIFs over ~45s get heavy`);
  });
  return { errors, warnings };
}

/* ---------- icons ---------- */
function svgDataUri(svg) {
  const clean = svg.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').trim();
  if (!/^<svg[\s>]/i.test(clean)) throw new Error('not an SVG document');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clean);
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
async function resolveIcon(v, baseDir, opts, where) {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s.startsWith('data:')) return s;
  if (s.startsWith('<svg')) return svgDataUri(s);
  let url = null;
  if (s.startsWith('iconify:')) {
    const [, prefix, rest] = s.split(':');
    const [name, query] = String(rest || '').split('?');
    if (!prefix || !name) throw new Error(`${where}: use "iconify:<prefix>:<name>", e.g. iconify:logos:aws-lambda (optional ?color=%23ffffff)`);
    url = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg${query ? '?' + query : ''}`;
  } else if (/^https?:\/\//.test(s)) url = s;
  if (url) {
    if (!opts.fetchIcons) throw new Error(`${where}: "${s}" needs network - rerun with --fetch-icons (or download the file and reference it by path)`);
    const cached = opts.cache.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${where}: fetching ${url} failed (${res.status})`);
    const type = res.headers.get('content-type') || '';
    let out;
    if (type.includes('svg') || url.endsWith('.svg')) out = svgDataUri(await res.text());
    else out = `data:${type.split(';')[0] || 'image/png'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    opts.cache.set(url, out);
    return out;
  }
  const isPath = s.startsWith('file:') || /\.(svg|png|jpe?g|webp|gif)$/i.test(s);
  if (!isPath) return s; // built-in icon name
  const p = resolve(baseDir, s.replace(/^file:(\/\/)?/, ''));
  if (!existsSync(p)) throw new Error(`${where}: icon file not found: ${p}`);
  const ext = extname(p).toLowerCase();
  if (ext === '.svg') return svgDataUri(await readFile(p, 'utf8'));
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${(await readFile(p)).toString('base64')}`;
}
async function inlineIcons(cfg, baseDir, opts) {
  const tasks = [];
  const visit = (item, path) => {
    for (const key of ['icon', 'iconDark']) {
      if (item[key] != null) tasks.push(resolveIcon(item[key], baseDir, opts, `${path}.${key}`).then(v => { item[key] = v; }));
    }
    (item.children || []).forEach((c, i) => visit(c, `${path}.children[${i}]`));
  };
  visit(cfg.layout, 'layout');
  await Promise.all(tasks);
}

/* ---------- main ---------- */
function escapeHtml(x) { return String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = resolve(args.input);
  if (!existsSync(input)) fail(`Config not found: ${input}`);
  let cfg;
  try { cfg = parseJsonc(await readFile(input, 'utf8')); }
  catch (e) { fail(`Could not parse ${basename(input)}: ${e.message}`); }

  const [css, js, template] = await Promise.all([
    readFile(join(ASSETS, 'flowfig.css'), 'utf8'),
    readFile(join(ASSETS, 'flowfig.js'), 'utf8'),
    readFile(join(ASSETS, 'template.html'), 'utf8'),
  ]);
  const meta = { icons: readBlock(js, 'ICONS'), kinds: readBlock(js, 'KINDS') };
  const { errors, warnings } = validate(cfg, meta);
  if (!args.quiet) warnings.forEach(w => console.warn(`warn  ${w}`));
  if (errors.length) {
    errors.forEach(e => console.error(`error ${e}`));
    fail(`\n${errors.length} error(s) - fix the config and rebuild.`);
  }
  const scen = cfg.scenarios || cfg.steps || [];
  const summary = `${countNodes(cfg.layout)} nodes, ${(cfg.edges || []).length} edges, ${scen.length} scenario(s): ${scen.map(s => `${s.label} (${(s.flow || s.beats || []).length} beats)`).join(', ')}`;
  if (args.check) { console.log(`ok    ${summary}`); return; }

  try { await inlineIcons(cfg, dirname(input), { fetchIcons: args.fetchIcons, cache: new Map() }); }
  catch (e) { fail(`error ${e.message}`); }

  const title = cfg.title || basename(input, extname(input));
  const configJson = JSON.stringify(cfg, null, 2).replace(/</g, '\\u003c');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = template
    .replace('/*FLOWFIG:CSS*/', () => css)
    .replace('/*FLOWFIG:CONFIG*/', () => configJson)
    .replace('/*FLOWFIG:JS*/', () => safeJs)
    .replace(/\{\{TITLE\}\}/g, () => escapeHtml(title));
  const out = resolve(args.out || join(dirname(input), basename(input, extname(input)) + '.html'));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html, 'utf8');
  if (!args.quiet) console.log(`built ${out}\n      ${summary}\n      ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, opens offline in any modern browser`);
}
function countNodes(item) { if (!item) return 0; return item.children ? item.children.reduce((a, c) => a + countNodes(c), 0) : 1; }

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build.mjs')) {
  main().catch(e => fail(e.stack || String(e)));
}
