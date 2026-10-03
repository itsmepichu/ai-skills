#!/usr/bin/env node
/**
 * flowfig export - render a built diagram to MP4 / GIF / WebM / PNG.
 *
 * Frames are rendered deterministically (window.flowfig.seek) in headless
 * Chromium and piped to ffmpeg, so every export looks exactly like the page.
 *
 *   node scripts/export.mjs diagram.html                       # mp4 + gif, light + dark
 *   node scripts/export.mjs diagram.html --format gif --theme dark
 *   node scripts/export.mjs diagram.html --format mp4,png --scenario "cache miss" --split
 *   node scripts/export.mjs --setup                            # one-time install of playwright + chromium + ffmpeg
 *
 * Options
 *   --format   mp4,gif,webm,png   (default mp4,gif)       png = final frame of each scenario
 *   --theme    light | dark | both                (default both)
 *   --scenario all | <index> | <label>            (default all)
 *   --split    one file per scenario instead of one file for all
 *   --fps      video frame rate                   (default 30)
 *   --gif-fps  GIF frame rate                     (default 15)
 *   --gif-width max GIF width in px               (default 1200)
 *   --scale    device pixel ratio for video/png   (default 2)
 *   --speed    playback speed multiplier          (default 1)
 *   --workers  parallel browser pages             (default: CPU cores - 1, max 4)
 *   --out      output directory                   (default: next to the html)
 *   --name     base file name                     (default: html file name)
 *   --chrome   path to a Chrome/Chromium binary   (or env CHROME_PATH)
 *   --ffmpeg   path to ffmpeg                     (or env FFMPEG_PATH)
 *
 * Needs Node.js 18+, Playwright (or playwright-core + a Chrome binary) and ffmpeg
 * (only PNG works without ffmpeg). Modules are looked up next to this script,
 * in the current project, in ~/.cache/flowfig (see --setup) and globally.
 */
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CACHE_DIR = process.env.FLOWFIG_TOOLS || join(homedir(), '.cache', 'flowfig');

function parseArgs(argv) {
  const a = { format: 'mp4,gif', theme: 'both', scenario: 'all', split: false, fps: 30, gifFps: 15, gifWidth: 1200, scale: 2, speed: 1, out: null, name: null, chrome: process.env.CHROME_PATH || null, ffmpeg: process.env.FFMPEG_PATH || null, setup: false, input: null, workers: Math.max(1, Math.min(4, (cpus()?.length || 2) - 1)) };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i], nx = () => argv[++i];
    switch (v) {
      case '--format': case '-f': a.format = nx(); break;
      case '--theme': case '-t': a.theme = nx(); break;
      case '--scenario': case '-s': a.scenario = nx(); break;
      case '--split': a.split = true; break;
      case '--fps': a.fps = +nx(); break;
      case '--gif-fps': a.gifFps = +nx(); break;
      case '--gif-width': a.gifWidth = +nx(); break;
      case '--scale': a.scale = +nx(); break;
      case '--speed': a.speed = +nx(); break;
      case '--workers': a.workers = Math.max(1, +nx() || 1); break;
      case '--out': case '-o': a.out = nx(); break;
      case '--name': a.name = nx(); break;
      case '--chrome': a.chrome = nx(); break;
      case '--ffmpeg': a.ffmpeg = nx(); break;
      case '--setup': a.setup = true; break;
      case '-h': case '--help': console.log(readHelp()); process.exit(0);
      default:
        if (v.startsWith('-')) die(`Unknown option ${v}`);
        a.input = v;
    }
  }
  return a;
}
function readHelp() { return 'Usage: node export.mjs <diagram.html> [--format mp4,gif,webm,png] [--theme light|dark|both] [--scenario all|N|label] [--split] [--fps 30] [--gif-fps 15] [--gif-width 1200] [--scale 2] [--speed 1] [--out dir]\n       node export.mjs --setup'; }
function die(msg) { console.error(msg); process.exit(1); }
function slug(x) { return String(x || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow'; }
function run(cmd, args, opts = {}) { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts }); return r.status === 0; }

/* ---------- dependency discovery ---------- */
async function importFrom(name) {
  const bases = [import.meta.url, pathToFileURL(join(process.cwd(), 'noop.js')).href, pathToFileURL(join(CACHE_DIR, 'noop.js')).href];
  try {
    const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (g.status === 0 && g.stdout.trim()) bases.push(pathToFileURL(join(g.stdout.trim(), 'noop.js')).href);
  } catch { /* npm missing */ }
  for (const base of bases) {
    try {
      const p = createRequire(base).resolve(name);
      return await import(pathToFileURL(p).href);
    } catch { /* try next */ }
  }
  return null;
}
async function getChromium() {
  for (const m of ['playwright', 'playwright-core', '@playwright/test']) {
    const mod = await importFrom(m);
    const c = mod && (mod.chromium || (mod.default && mod.default.chromium));
    if (c) return c;
  }
  die(`Playwright not found. Run once:\n  node ${join('scripts', 'export.mjs')} --setup\nor: npm i -D playwright && npx playwright install chromium\n(or install playwright-core and pass --chrome /path/to/chrome)`);
}
async function getFfmpeg(explicit) {
  const candidates = [explicit, 'ffmpeg'].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  const mod = await importFrom('ffmpeg-static');
  const p = mod && (mod.default || mod);
  if (typeof p === 'string' && existsSync(p)) return p;
  return null;
}
async function setup() {
  console.log(`Installing export tools into ${CACHE_DIR} (playwright, ffmpeg-static, chromium)...`);
  await mkdir(CACHE_DIR, { recursive: true });
  if (!existsSync(join(CACHE_DIR, 'package.json'))) await writeFile(join(CACHE_DIR, 'package.json'), '{ "name": "flowfig-tools", "private": true }\n');
  if (!run('npm', ['install', '--no-audit', '--no-fund', '--prefix', CACHE_DIR, 'playwright', 'ffmpeg-static'])) die('npm install failed');
  if (!run(process.execPath, [join(CACHE_DIR, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'], { cwd: CACHE_DIR, shell: false })) die('playwright install chromium failed (on Linux you may also need: npx playwright install-deps chromium)');
  console.log('Done. You can now run: node scripts/export.mjs <diagram.html>');
}

/* ---------- ffmpeg helpers ---------- */
function startFfmpeg(bin, args) {
  const p = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err += d; });
  p.done = new Promise((res, rej) => p.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${err.slice(-800)}`))));
  return p;
}
async function writeFrame(proc, buf) { if (!proc.stdin.write(buf)) await once(proc.stdin, 'drain'); }
function size(p) { try { return (statSync(p).size / 1048576).toFixed(2) + ' MB'; } catch { return '?'; } }

/* ---------- main ---------- */
async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.setup) return setup();
  if (!a.input) die(readHelp());
  const html = resolve(a.input);
  if (!existsSync(html)) die(`Not found: ${html}`);
  const formats = new Set(a.format.split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
  for (const f of formats) if (!['mp4', 'gif', 'webm', 'png'].includes(f)) die(`Unknown format "${f}"`);
  const themes = a.theme === 'both' ? ['light', 'dark'] : [a.theme];
  for (const t of themes) if (!['light', 'dark'].includes(t)) die(`Theme must be light, dark or both`);
  const needsFfmpeg = [...formats].some(f => f !== 'png');
  const ffmpeg = needsFfmpeg ? await getFfmpeg(a.ffmpeg) : null;
  if (needsFfmpeg && !ffmpeg) die('ffmpeg not found. Install it (brew install ffmpeg | sudo apt install ffmpeg | winget install ffmpeg), run --setup, or pass --ffmpeg /path.\nPNG export works without ffmpeg: --format png');
  const chromium = await getChromium();
  const outDir = resolve(a.out || dirname(html));
  await mkdir(outDir, { recursive: true });
  const base = a.name || basename(html, extname(html));

  let browser;
  try {
    browser = await chromium.launch(a.chrome ? { executablePath: a.chrome } : {});
  } catch (e) {
    die(`Could not start Chromium: ${e.message.split('\n')[0]}\nRun: npx playwright install chromium   (or pass --chrome /path/to/chrome)`);
  }
  const written = [];
  try {
    for (const theme of themes) {
      const errors = [];
      const openPage = async () => {
        const ctx = await browser.newContext({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: a.scale, colorScheme: theme });
        const page = await ctx.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(html).href + `?export=1&theme=${theme}`);
        try { await page.waitForFunction(() => window.flowfig && window.flowfig.isReady, null, { timeout: 20000 }); }
        catch { die(`Diagram did not load. Is this a flowfig HTML file? ${errors.join(' | ')}`); }
        const rect = await page.evaluate(() => window.flowfig.frameRect());
        await page.setViewportSize({ width: Math.ceil(rect.x + rect.width) + 16, height: Math.ceil(rect.y + rect.height) + 16 });
        const r2 = await page.evaluate(() => window.flowfig.frameRect());
        const clip = { x: Math.floor(r2.x), y: Math.floor(r2.y), width: Math.ceil(r2.width), height: Math.ceil(r2.height) };
        return {
          ctx, page,
          shot: () => page.screenshot({ clip, type: 'png', animations: 'disabled', caret: 'hide' }),
          seek: (s, t) => page.evaluate(([s, t]) => window.flowfig.seek(s, t), [s, t]),
        };
      };
      const main = await openPage();
      const { page } = main;
      const scenarios = await page.evaluate(() => window.flowfig.scenarios);
      let pick = scenarios.map((_, i) => i);
      if (a.scenario !== 'all') {
        const byLabel = scenarios.findIndex(s => slug(s.label) === slug(a.scenario));
        const idx = byLabel >= 0 ? byLabel : parseInt(a.scenario, 10);
        if (!(idx >= 0 && idx < scenarios.length)) die(`Scenario "${a.scenario}" not found. Available: ${scenarios.map((s, i) => `${i}:${s.label}`).join(', ')}`);
        pick = [idx];
      }
      const pageColor = (await page.evaluate(() => getComputedStyle(document.getElementById('flowfig')).getPropertyValue('--ff-page').trim())) || '#ffffff';

      if (formats.has('png')) {
        for (const s of pick) {
          await main.seek(s, scenarios[s].lastBeatEnd);
          const file = join(outDir, `${base}-${theme}${pick.length > 1 || scenarios.length > 1 ? '-' + slug(scenarios[s].label) : ''}.png`);
          await writeFile(file, await main.shot());
          written.push(file);
        }
      }
      const workers = [main];
      const media = ['mp4', 'webm', 'gif'].filter(f => formats.has(f));
      if (media.length) {
        const groups = a.split ? pick.map(s => [s]) : [pick];
        for (const group of groups) {
          const suffix = a.split || (pick.length === 1 && scenarios.length > 1) ? '-' + slug(scenarios[group[0]].label) : '';
          const stem = join(outDir, `${base}-${theme}${suffix}`);
          const tmp = await mkdtemp(join(tmpdir(), 'flowfig-'));
          const fps = formats.has('mp4') || formats.has('webm') ? a.fps : a.gifFps;
          const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
          const even = `pad=ceil(iw/2)*2:ceil(ih/2)*2:color=${pageColor.replace('#', '0x')}`;
          if (formats.has('mp4')) args.push('-map', '0', '-vf', even, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${stem}.mp4`);
          if (formats.has('webm')) args.push('-map', '0', '-vf', even, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-pix_fmt', 'yuv420p', `${stem}.webm`);
          if (formats.has('gif')) args.push('-map', '0', '-vf', `fps=${a.gifFps},scale='min(${a.gifWidth},iw)':-2:flags=lanczos`, join(tmp, 'g_%05d.png'));
          const ff = startFfmpeg(ffmpeg, args);
          const frames = [];
          for (const s of group) {
            const n = Math.ceil(scenarios[s].duration / a.speed / 1000 * fps);
            for (let k = 0; k < n; k++) frames.push([s, (k * 1000 / fps) * a.speed]);
          }
          while (workers.length < Math.min(a.workers, frames.length)) workers.push(await openPage());
          const t0 = Date.now();
          const tty = process.stdout.isTTY;
          let lastPct = -1;
          for (let k = 0; k < frames.length; k += workers.length) {
            const batch = frames.slice(k, k + workers.length);
            const bufs = await Promise.all(batch.map(async (fr, i) => { await workers[i].seek(fr[0], fr[1]); return workers[i].shot(); }));
            for (const buf of bufs) await writeFrame(ff, buf);
            const done = Math.min(frames.length, k + batch.length);
            const pct = Math.floor(done / frames.length * 4) * 25;
            if (tty) process.stdout.write(`\r[${theme}] ${basename(stem)}  frame ${done}/${frames.length}   `);
            else if (pct !== lastPct) { lastPct = pct; console.log(`[${theme}] ${basename(stem)}  ${pct}% (${done}/${frames.length} frames)`); }
          }
          ff.stdin.end();
          await ff.done;
          const msg = `[${theme}] ${basename(stem)}  ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`;
          if (tty) process.stdout.write(`\r${msg}        \n`); else console.log(msg);
          if (formats.has('mp4')) written.push(`${stem}.mp4`);
          if (formats.has('webm')) written.push(`${stem}.webm`);
          if (formats.has('gif')) {
            const pal = join(tmp, 'palette.png');
            await startFfmpeg(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(a.gifFps), '-i', join(tmp, 'g_%05d.png'), '-vf', 'palettegen=max_colors=256:stats_mode=full', pal]).done;
            await startFfmpeg(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(a.gifFps), '-i', join(tmp, 'g_%05d.png'), '-i', pal, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', `${stem}.gif`]).done;
            written.push(`${stem}.gif`);
          }
          await rm(tmp, { recursive: true, force: true });
        }
      }
      if (errors.length) console.warn(`[${theme}] page errors: ${[...new Set(errors)].join(' | ')}`);
      for (const w of workers) await w.ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log('\nWritten:');
  for (const f of written) {
    const big = f.endsWith('.gif') && statSync(f).size > 15 * 1048576 ? '   (large - try --gif-fps 10 --gif-width 960 or --split)' : '';
    console.log(`  ${f}  ${size(f)}${big}`);
  }
}
main().catch(e => die(e.stack || String(e)));
