---
name: interactive-flow-diagrams
description: Build animated, step-by-step interactive flow diagrams of software and cloud systems - request/data flows, architecture walkthroughs, event pipelines, auth flows, deployments, failure and failover scenarios - as one self-contained HTML file with light/dark themes, presenter mode, and GIF/MP4/WebM/PNG export. Use when someone wants to visualize, animate, walk through or explain how requests, data or events move between components, for a presentation, design review, README or documentation page.
license: MIT
compatibility: Works with any agent that can write files. Building needs Node.js 18+. The CLI export also needs Playwright Chromium and ffmpeg (install with scripts/export.mjs --setup). The in-page Export button works best in Chrome or Edge and downloads its encoder from jsDelivr the first time.
metadata:
  version: "1.1.0"
  engine: flowfig
---

# Interactive Flow Diagrams (flowfig)

This skill turns "how does X work?" into an animated diagram. Components are HTML boxes that CSS flexbox lays out, so there are no coordinates to write. Lines are routed automatically around the boxes, with arrowheads at one or both ends. Each step, a dot carries a labelled payload along an arrow, node panels fill with state, and a caption explains what happens. You write one JSON config and get one offline HTML file that also exports frame-exact GIF/MP4.

Paths below are relative to this skill's folder, the one that contains this `SKILL.md`.

## Files

| Path | Purpose |
|---|---|
| `assets/flowfig.js`, `assets/flowfig.css`, `assets/template.html` | The engine. Never edit these per diagram. |
| `scripts/build.mjs` | Validates a config and inlines everything into one HTML file. |
| `scripts/export.mjs` | Renders MP4 / GIF / WebM / PNG in light, dark or both. |
| `references/config.md` | The full config schema. **Read it before you write a config.** |
| `references/patterns.md` | Architecture recipes (cache, queue, saga, OAuth, CI/CD, failover, RAG…) and storytelling rules. |
| `references/icons.md` | Built-in component kinds and provider icons (AWS/Azure/GCP/brand logos). |
| `references/export-and-embed.md` | Export options, slides (PowerPoint/Keynote/Google Slides), docs sites, READMEs, Confluence, Notion. |
| `references/design-system.md` | Tokens, palette, scales, components and the accessibility checklist. Read it before changing the look or branding. |
| `examples/*.json` | Complete, working configs: `cache-aside` (starter), `event-driven-orders`, `multi-region-failover`. |

## Workflow

### 1. Pin down the story
One diagram answers one question, for example "What happens when a customer places an order?". If the user is there to answer, settle these points. If not, use the defaults and say so.

- **Flow and components.** The flow in their words, plus any real names (services, queues, regions).
- **Audience and destination.** For slides: fewer nodes, bigger captions, step mode. For docs: autoplay, `embed`.
- **Scenarios.** The default is the happy path plus one failure or variant. Two or three scenarios is ideal.
- **Theme.** The default is `auto` (follows the OS) with a toggle. Exports default to `both`.
- **Exports.** GIF for READMEs, Slack and Confluence. MP4 for slides. PNG for print and static docs.
- **Icons.** The default is built-in kinds. Use provider icons if they ask for AWS/Azure/GCP or brand logos (see step 4).

### 2. Outline before writing JSON
Write a short plain-text outline, and show it to the user when they are available:
```
Columns (left → right = direction of the request):
  Client | Edge (gateway, WAF) | Services | Data (db, cache) | Async (queue, workers) | External
Edges: client→gateway "HTTPS", gateway→orders, orders→db "1 tx", db→topic "outbox" (async) …
Scenario "happy path": 1 place order → 2 route → 3 write tx → 4 202 back → 5 publish → 6 fan-out
Scenario "payment fails": … fail hop → retry → DLQ → replay
```

### 3. Write the config
Copy the closest file in `examples/` and follow `references/config.md`. You can use a recipe from `references/patterns.md`. Save it next to the user's work, e.g. `docs/diagrams/order-flow.json`. JSONC is fine: comments and trailing commas are allowed.

### 4. Icons, in this order
1. **Official packs or files the user provides.** Reference them by path: `"icon": "icons/aws/Lambda.svg"`. The build inlines them.
2. **An icon or logo tool in this agent.** If you have an MCP connector or plugin that returns SVG logos, fetch the SVG and put it in `icon` as `<svg…>` markup or a `data:` URI.
3. **Network access.** Use `"icon": "iconify:logos:aws-lambda"`, then build with `--fetch-icons`. The logos, simple-icons and mdi sets all work.
4. **Otherwise.** Use built-in `kind`s such as `database`, `queue`, `function` or `cluster`. They work offline and export cleanly.

Keep provider icons unmodified and put the product name in the label. See `references/icons.md` for terms and dark-mode variants (`iconDark`).

### 5. Build and validate
```bash
node <skill>/scripts/build.mjs docs/diagrams/order-flow.json          # writes order-flow.html next to it
node <skill>/scripts/build.mjs order-flow.json --check                # validate only
node <skill>/scripts/build.mjs order-flow.json --fetch-icons          # allow iconify:/https: icons
```
Fix every `error`. Read the `warn` lines too, because they flag diagrams that will be hard to read. Without Node, see "No Node.js" below.

### 6. Look at it before you hand it over
Render still frames and inspect them. If you can't view images, ask the user to open the HTML file.
```bash
node <skill>/scripts/export.mjs order-flow.html --format png --theme both
```
Check for these problems:
- Arrows cutting through unrelated boxes.
- Labels sitting on top of each other.
- Captions longer than two lines.
- A diagram wider than about 1400 px, which makes text too small in docs.

Lines never cross boxes: the router goes around them, and the build prints nothing about it. Readability still depends on layout. Fixes: reorder columns, switch a group's `direction`, raise `gap`, set `fromSide`/`toSide`, route with `around`, pin labels with `labelAt`, switch to `"routing": "orthogonal"` for dense diagrams, or split the diagram.

### 7. Export when asked
```bash
node <skill>/scripts/export.mjs order-flow.html                       # MP4 + GIF, light + dark
node <skill>/scripts/export.mjs order-flow.html --format gif --theme dark --scenario "happy path"
node <skill>/scripts/export.mjs --setup                               # first time: installs playwright + chromium + ffmpeg
```
Viewers can also export from the page itself with the ⤓ button (GIF / MP4 / WebM / PNG, current or chosen theme). Details and size tips are in `references/export-and-embed.md`.

### 8. Deliver
- Give the path to the `.html` file (and the exports).
- Tell the user how to present it: **F** full screen, **→ / ←** step, **S** toggle step mode, **T** theme, **1-9** scenario.
- Add the one embed snippet that fits where it's going (`references/export-and-embed.md`), e.g. `<picture>` light/dark GIFs for a README or an `<iframe …?embed=1>` for a docs site.

## Rules that make architecture diagrams readable

- **5-12 nodes and 2-3 scenarios.** The build warns above 20 nodes. When a diagram grows, split it (context → detail) instead of shrinking the text.
- **Left to right follows the request.** Callers go on the left, data stores and external systems on the right. Async workers go in their own column or group. Replies use `"back": true` on the same edge rather than a second arrow.
- **Group by boundary.** Use groups for tier, VPC, region, account, cluster or trust zone. Mark standby or external zones with `"style": "dashed"`.
- **Line style carries meaning.** Solid means synchronous request/response, `async` (dashed) means events and queues, and `stream` (dotted, animated) means replication and CDC. A legend appears on its own.
- **Arrowheads show direction.** An edge that carries traffic both ways (any `"back": true` hop) automatically gets an arrowhead at each end. Set `"arrows": "end"` to keep a one-way arrow for a plain call, or `"both"` / `"none"` explicitly.
- **Routing style.** The default `curved` style uses soft bends. `"routing": "orthogonal"` uses crisp right angles, which suit dense or formal architecture views. Both avoid boxes.
- **One beat = one idea.** Use one hop, or a parallel fan-out with small `delay`s. Keep captions under about 25 words, in present tense, and say **why** as well as what. Use `**bold**` and `` `code` `` sparingly.
- **Show real data.** Payload pills carry real requests (`POST /orders`, `SET user:42 EX 60`). Panels show the resulting state (rows written, cache TTL, queue lag, offsets). Keep them to 1-4 rows.
- **Failures are first-class.** Use `fail: true` hops, `state: {"db": "error"}`, `tone: "warn"`, and then the recovery. That is usually the scenario the audience remembers.
- **Pacing.** The default beat is 2200 ms. Give 2600-3400 ms to beats with a lot to read and 1400 ms to quick returns. Keep a scenario to 15-40 s, which also keeps GIFs small.
- **Stay on the design system** (`references/design-system.md`). Use one accent colour and pair every status with its glyph. Brand only through `theme` tokens and keep exactly the engine's type scale.
- **Names.** Short labels, with the technology in `sub` (label "Cache", sub "Redis 7"). Use consistent verbs on edges.

## Minimal config

```jsonc
{
  "title": "Cache-aside read",
  "theme": "auto",                       // auto | light | dark, or { "mode": "auto", "accent": "#0969da" }
  "layout": { "gap": 64, "children": [
    { "id": "app", "label": "Web app", "kind": "browser" },
    { "id": "api", "label": "Users API", "kind": "api", "sub": "GET /users/:id" },
    { "label": "Data", "direction": "column", "children": [
      { "id": "cache", "label": "Cache", "kind": "cache", "sub": "Redis" },
      { "id": "db", "label": "Database", "kind": "database", "sub": "Postgres" } ] } ] },
  "edges": [
    { "id": "req", "from": "app", "to": "api", "label": "HTTPS" },
    { "id": "get", "from": "api", "to": "cache" },
    { "id": "sql", "from": "api", "to": "db", "label": "SQL" } ],
  "scenarios": [ { "label": "cache miss", "flow": [
    { "edges": { "edge": "req", "data": "GET /users/42" }, "say": "The app asks for user 42." },
    { "edges": { "edge": "get", "data": "GET user:42" }, "show": { "cache": [{ "tag": "miss", "tone": "orange", "text": "user:42" }] }, "say": "Redis doesn't have it." },
    { "edges": { "edge": "sql", "data": "SELECT …" }, "show": { "db": ["1 row · 18 ms"] }, "say": "So the API reads Postgres." },
    { "edges": { "edge": "req", "back": true, "data": "200 OK", "tone": "ok" }, "say": "The answer goes back to the app." } ] } ]
}
```

## Viewer controls and URL parameters

- **Keys:**
  - Space: play/pause, or next step in step mode.
  - → / ← or PageDown / PageUp (presentation clickers): step.
  - ↑ / ↓ or 1-9: change scenario.
  - − / +: slower / faster.
  - F: full screen. S: step mode. T: theme. R: restart. Esc: exit.
- **Control bar:**
  - Transport buttons and scenario tabs.
  - Auto/step toggle.
  - **Speed dropdown** (0.5× · 0.75× · 1.0× · 1.5× · 2.0×).
  - **Steps** button: shows the text transcript, where any step can be clicked.
  - Theme, full screen and export buttons.
  - In full screen the bar hides after 2.5 s without mouse movement.
- **URL parameters:**
  - `?present=1`: full screen and step-by-step.
  - `?embed=1`: no border or padding, for iframes.
  - `?theme=light|dark`.
  - `?scenario=<label|index>`.
  - `?autoplay=0`.
  - `?speed=1.5` (snaps to the nearest dropdown value).
  - `?export=1`: deterministic frames. The exporters use this.
- **Host pages** can set the theme of an embedded diagram with `iframe.contentWindow.postMessage({flowfig:'theme', value:'dark'}, '*')`.

## No Node.js?
Build the file by hand. Copy `assets/template.html`, then:
1. Replace `/*FLOWFIG:CSS*/` with the contents of `assets/flowfig.css`.
2. Replace `/*FLOWFIG:JS*/` with `assets/flowfig.js`.
3. Replace `/*FLOWFIG:CONFIG*/` with the JSON config. It must be strict JSON with no comments, and every `<` must be written as `\u003c`.
4. Replace `{{TITLE}}` with the title.

Icons must already be `data:` URIs or built-in names. There is no validation, so check the browser console. For exports without Node, use the in-page ⤓ button.

## Troubleshooting
- **The page is blank.** Open the browser console. Usually the config is invalid JSON or a hand-built file lost a marker. Run `build.mjs --check`.
- **An arrow takes a strange route.** Set `fromSide`/`toSide` (`top|right|bottom|left`), use `around: "below"` for long return paths, or move the node to another column.
- **Boxes jump when a panel fills.** They shouldn't: panels reserve space for their largest content. Look for a very long panel line and shorten it.
- **The export fails with "Playwright not found" or "ffmpeg not found".** Run `node scripts/export.mjs --setup`, or pass `--chrome` / `--ffmpeg` paths.
- **The GIF is too big.** Use `--gif-fps 10 --gif-width 960`, `--split` (one file per scenario), or MP4.
- **In-page export says it can't encode MP4.** That browser lacks an H.264/VP9 encoder. Export a GIF there, or use the CLI.
