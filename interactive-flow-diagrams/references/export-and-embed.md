# Export and embedding

## CLI export (best quality, offline, any agent)

`scripts/export.mjs` opens the built HTML in headless Chromium, renders each frame exactly with `flowfig.seek()`, and pipes the frames to ffmpeg.

```bash
node scripts/export.mjs diagram.html                                  # mp4 + gif, light + dark
node scripts/export.mjs diagram.html --format gif --theme dark
node scripts/export.mjs diagram.html --format mp4,png --scenario "cache miss"
node scripts/export.mjs diagram.html --format gif --split --gif-fps 12 --gif-width 1000
node scripts/export.mjs --setup                                       # one-time tool install
```

| Option | Default | Notes |
|---|---|---|
| `--format` | `mp4,gif` | Any of `mp4`, `gif`, `webm`, `png`. `png` is a poster: the final state of each scenario, useful for print, PDFs and alt images. |
| `--theme` | `both` | `light`, `dark` or `both`. |
| `--scenario` | `all` | `all`, an index, or a label. |
| `--split` | off | One file per scenario. By default all selected scenarios play in one file. |
| `--fps` | `30` | Video frame rate. Used for capture when mp4/webm is requested. |
| `--gif-fps` / `--gif-width` | `15` / `1200` | GIF frame rate and maximum width. |
| `--scale` | `2` | Device pixel ratio. 2 gives crisp video at 1600-2800 px wide. |
| `--speed` | `1` | Playback speed. `1.25` makes shorter videos. |
| `--workers` | cores − 1 (max 4) | Parallel browser pages. |
| `--out`, `--name` | next to the html | Output folder and base name. |
| `--chrome`, `--ffmpeg` | auto | Explicit binaries (also env `CHROME_PATH`, `FFMPEG_PATH`). |

**Output names** follow `<name>-<theme>[-<scenario>].<ext>`, for example `order-flow-dark.mp4` and `order-flow-light-happy-path.png`.

**Dependencies.** The script looks for Playwright (`playwright`, `playwright-core` or `@playwright/test`) next to itself, in the current project, in `~/.cache/flowfig` and in the global npm root. It looks for ffmpeg on PATH or in `ffmpeg-static`. `--setup` installs `playwright` and `ffmpeg-static` into `~/.cache/flowfig` and downloads Chromium. PNG export needs no ffmpeg.

**Encoding.**
- MP4 is H.264 `yuv420p` with `+faststart`, which plays in PowerPoint, Keynote, Google Slides, browsers, Slack and Confluence.
- GIF uses a two-pass palette with rectangle diffing, so only changed pixels are stored.
- WebM is VP9.

**Size and time.** A 20-second scenario at 30 fps and 2× scale takes 40-90 s to render on a laptop. The GIF is usually 0.5-2 MB. If a GIF passes about 10 MB, lower `--gif-fps` to 10-12, lower `--gif-width` to 960, use `--split`, or ship MP4 instead.

### Regenerate exports in CI (docs-as-code)
```yaml
# .github/workflows/diagrams.yml
on: { push: { paths: ["docs/diagrams/**.json"] } }
jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm i --no-save playwright && npx playwright install --with-deps chromium && sudo apt-get install -y ffmpeg
      - run: |
          SKILL=.agents/skills/interactive-flow-diagrams
          for f in docs/diagrams/*.json; do node $SKILL/scripts/build.mjs "$f"; done
          for f in docs/diagrams/*.html; do node $SKILL/scripts/export.mjs "$f" --format gif,png --out docs/diagrams/exports; done
      # then commit docs/diagrams (e.g. with stefanzweifel/git-auto-commit-action)
```

## In-page export (viewers, no tools)

The ⤓ button in the control bar offers **GIF, MP4, WebM or PNG**, the **current, light or dark** theme, and **this scenario or all**. Frames are rendered with the same deterministic clock and rasterised through an SVG `<foreignObject>` snapshot. Encoding happens in the browser:
- **GIF** uses gifenc. The palette is global and unchanged pixels are transparent, so files stay small.
- **MP4/WebM** use WebCodecs + mediabunny. MP4 uses H.264 when the browser can encode it, and otherwise falls back to VP9-in-MP4, which browsers play but PowerPoint may not. For slides, use the CLI MP4.
- **PNG** is the current frame at 2×.

Requirements and limits:
- Use Chrome or Edge on desktop. Safari and Firefox work for PNG/GIF in most cases, but WebCodecs support varies.
- The encoders load from jsDelivr the first time (about 10 KB for GIF and 700 KB for video). For offline or locked-down networks, download `gifenc/dist/gifenc.esm.js` and `mediabunny/dist/bundles/mediabunny.min.mjs` from npm, put them next to the HTML, and set `"encoders": { "gifenc": "./gifenc.esm.js", "mediabunny": "./mediabunny.min.mjs" }`.
- Pages inside sandboxed iframes may block downloads. Open the file directly.

Scripted use from the browser console or another tool:
```js
const blob = await flowfig.exportMedia({ format: 'gif', theme: 'dark', scope: 'all', fps: 12 });
await flowfig.download({ format: 'mp4', theme: 'light' });   // export and save
```

## Presentations

| Tool | Best option |
|---|---|
| Presenting from a browser | Open the HTML and press **F** (or add `?present=1`). → / ← and presentation clickers (PageDown/PageUp) step through beats, ↑ / ↓ switch scenarios and **T** flips the theme to suit the room. Nothing to install, and it works offline. |
| PowerPoint | CLI **MP4**: Insert › Video › This Device, then Playback › Start: *Automatically* (optionally *Loop until stopped*). Use the theme that matches the slide background. |
| Keynote | Drag the **MP4** onto the slide. Set Movie › Start: *on click* or automatically. |
| Google Slides | Upload the MP4 to Drive, then Insert › Video › Google Drive, with autoplay in Format options. Alternatively use Insert › Image › GIF (it autoplays and loops). |
| reveal.js / Slidev / Marp | `<iframe src="diagram.html?embed=1" style="width:100%;height:80vh;border:0">`. Arrow keys belong to the slide framework, so use autoplay in the iframe, or click into it first to step. |

For slides, use step mode, 5-8 nodes, and captions of one sentence. Put detail in speaker notes, not captions.

## Documentation

**GitHub / GitLab README** (no JavaScript allowed). Use light/dark GIFs that follow the reader's theme:
```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/exports/order-flow-dark.gif">
  <img alt="Order flow: checkout → gateway → orders → Kafka → consumers" src="docs/diagrams/exports/order-flow-light.gif" width="900">
</picture>
```
GitHub also plays MP4 you drag into a README, issue or PR editor. Link to the live HTML, for example on GitHub Pages, for the interactive version.

**Docs sites** (Docusaurus, MkDocs, Hugo, Astro, Next.js, VitePress). Copy the HTML into the static folder and embed it:
```html
<iframe id="order-flow" src="/diagrams/order-flow.html?embed=1" title="Order flow"
        style="width:100%;height:640px;border:0" loading="lazy"></iframe>
```
To follow the site's own theme toggle, post the theme into the frame. Wrap this in the framework's client-side component, since MDX strips raw `<script>`:
```js
const f = document.getElementById('order-flow');
const sync = () => f.contentWindow?.postMessage({ flowfig: 'theme', value: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, '*');
f.addEventListener('load', sync);
new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
```
Other messages the frame accepts: `{flowfig:'scenario', value: 1}`, `{flowfig:'play'}`, `{flowfig:'pause'}`.

**Confluence.** HTML macros are usually disabled, so attach the **GIF** (inline image) or the **MP4** (multimedia macro). Put the HTML in the page attachments for people who want the interactive version.

**Notion.** Upload the GIF or MP4, or `/embed` a hosted URL of the HTML (GitHub Pages, Netlify, S3 + CloudFront, an internal static host).

**Anything static.** The HTML is a single file with no external requests, so any static host or file share works. Offline you can open it straight from disk.

**Accessibility.** Give embedded GIFs meaningful `alt` text that names the flow. The HTML exposes captions to screen readers in step mode, supports keyboard navigation, and follows `prefers-reduced-motion` by stepping without animation.
