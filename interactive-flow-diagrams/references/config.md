# flowfig config reference

A config is one JSON (or JSONC) object. `scripts/build.mjs` validates it and inlines it into the HTML.

```jsonc
{
  "title": "…", "subtitle": "…",
  "theme": "auto",
  "beatMs": 2200,
  "layout": { … },     // what the boxes are and how they are grouped
  "edges": [ … ],      // which boxes connect
  "scenarios": [ … ]   // what happens, step by step
}
```

## Top level

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | string | file name | Shown in the header, used for export file names and the page `<title>`. |
| `subtitle` | string | – | One line of context next to the title. |
| `caption` | string | – | Caption shown before the first beat of any scenario. |
| `theme` | `"auto"` \| `"light"` \| `"dark"` \| object | `"auto"` | `auto` follows the OS. The viewer can toggle it and the choice is remembered. See **Theme** below. |
| `rememberTheme` | boolean | `true` | Set `false` to ignore the viewer's saved theme choice. |
| `beatMs` | ms | `2200` | Default beat length. |
| `travelMs` | ms | `1400` | Maximum time a dot takes to travel one edge. It is capped at 70% of the beat. |
| `leadMs` / `holdMs` | ms | `400` / `1800` | Still time before the first beat and after the last beat of each scenario. |
| `playback` | `"auto"` \| `"manual"` | `"auto"` | `manual` starts in step mode (arrow keys advance). `?present=1` forces it. |
| `loop` | boolean | `true` | With one scenario, `false` stops at the end instead of looping. |
| `routing` | `"curved"` \| `"orthogonal"` | `"curved"` | How lines are drawn. Both styles route **around** boxes and group titles; `curved` uses soft rounded bends, `orthogonal` uses tight right angles (classic architecture-diagram look). |
| `arrows` | `"auto"` \| `"end"` \| `"start"` \| `"both"` \| `"none"` | `"auto"` | Default arrowheads for every edge. `auto` = one at the target, plus one at the source when any hop travels back along the edge (request/response, replication catch-up). |
| `legend` | boolean | auto | Legend for sync/async/stream lines. Shown automatically when the diagram has async or stream edges. |
| `exportButton` | boolean | `true` | Show the in-page ⤓ export button. |
| `minScale` / `maxScale` | number | `0.5` / `1` | How far the diagram may shrink or grow to fit the page width. |
| `maxFullScale` | number | `2.5` | Maximum upscale in full screen / presenter mode. |
| `encoders` | `{ gifenc?, mediabunny? }` | jsDelivr URLs | Point these at self-hosted copies for offline in-page export. |

### Theme
```jsonc
"theme": {
  "mode": "auto",                    // auto | light | dark
  "accent": "#7c3aed",               // brand colour for both themes (lines, highlights, pills)
  "light": { "accentStrong": "#6d28d9", "page": "#ffffff" },   // any token, per theme
  "dark":  { "accent": "#a78bfa", "accentStrong": "#7c3aed", "page": "#0b0b10" }
}
```
Tokens you can override per theme, in camelCase: `page`, `bg`, `surface`, `fg`, `muted`, `border`, `grid`, `accent`, `accentStrong` (the fill behind white text, so keep it at 4.5:1 or better against white), `onAccent`, `ok`, `okStrong`, `warn`, `warnStrong`, `error`, `errorStrong`, `blue`, `purple`, `green`, `orange`, `red`, `teal`, `pink`, `gray`, `indigo`.

## Layout

`layout` is a tree. **Groups** have `children`; **nodes** don't. Flexbox places everything, so you never write coordinates. Put things in the order you want them read.

### Group
| Field | Type | Default | Notes |
|---|---|---|---|
| `children` | array | – | Nodes and/or groups. Required. |
| `label` | string | – | With a label the group gets a boxed boundary. Without one it is an invisible layout wrapper. |
| `id` | string | – | Needed only if edges connect to the whole group or it appears in `light`. |
| `direction` | `"row"` \| `"column"` | `"row"` | How the children flow. |
| `gap` | px | row 56 / column 28 | Space between children. Rows need about 56+ px so edge labels fit. |
| `align` | `"start"` \| `"center"` \| `"end"` | row center / column stretch | Cross-axis alignment. |
| `style` | `"solid"` \| `"dashed"` \| `"plain"` | `"solid"` | Use `dashed` for standby, external or trust boundaries, and `plain` for a label-less wrapper. |
| `kind` / `icon` | string | – | Small icon before the label, e.g. `"kind": "region"`, `"network"`, `"cluster"`. |
| `tone` | tone | – | Tints the boundary: `blue`, `purple`, `green`, `orange`, `red`, `teal`, `pink`, `gray`, `indigo`, `ok`, `warn`, `error`, or a hex colour. |

### Node
| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | – | Required and unique. Letters, digits, `_ . : -`. |
| `label` | string | id | Keep it short (≤ 28 chars). `\n` breaks the line. |
| `sub` | string | – | Second line with the technology or detail: "Redis 7", "POST /orders". |
| `kind` | string | – | Sets the icon, icon colour and default shape. See `icons.md`. E.g. `service`, `api`, `function`, `database`, `cache`, `queue`, `stream`, `lb`, `gateway`, `user`, `external`. |
| `icon` | string \| `false` | from kind | A built-in icon name, a file path (`icons/lambda.svg`), `iconify:<set>:<name>`, `<svg…>` markup, or a `data:` URI. `false` hides it. |
| `iconDark` | string | – | Alternative icon for dark mode, for logos with dark text. |
| `shape` | `"box"` \| `"store"` \| `"pill"` | from kind | `store` is a cylinder, the default for data kinds. `pill` is the default for users. |
| `style` | `"solid"` \| `"dashed"` | from kind | Dashed border. It is the default for `external` and `payment`. |
| `stack` | boolean | `false` | Draws stacked copies behind the node: replicas, pods, an autoscaling group. |
| `tone` | tone | category colour | Icon colour. |
| `width` | px | auto (180 when the node has a panel) | Fixed width. Keep nodes in the same column the same width. |
| `lines` | number | – | Reserves this many panel lines even before any content arrives. |
| `placeholder` | string | `—` | Text shown in an empty panel. |
| `desc` | string | – | Hover tooltip, for docs. |

A node gets a **panel** (the dashed box that fills with live data) automatically when any beat `show`s content for it. The panel is sized for its largest content up front, so the layout never jumps.

## Edges

| Field | Type | Default | Notes |
|---|---|---|---|
| `from`, `to` | id | – | A node or a group with an `id`. Required. |
| `id` | string | `"from->to"` | Beats refer to edges by id. Give one explicitly when two edges join the same pair. |
| `label` | string | – | Small pill at the middle of the edge (≤ 24 chars): protocol, verb, topic. |
| `labelAt` | 0-1 | auto | Pins the label at this fraction of the line. By default labels go on the longest straight run and avoid boxes and other labels; if the line is too short they sit just beside it. |
| `style` | `"sync"` \| `"async"` \| `"stream"` | `"sync"` | Solid, dashed, or dotted and animated. |
| `arrows` | `"auto"` \| `"end"` \| `"start"` \| `"both"` \| `"none"` | top-level `arrows` | Arrowheads for this edge. `auto` makes the edge bi-directional (an arrowhead at each end) when any beat sends a hop back along it with `"back": true`. Use `"end"` to keep a one-way arrow for a request/response call. (`"both": true` still works but is deprecated.) |
| `quiet` | boolean | `false` | Invisible until a beat uses it. Good for long return paths. |
| `around` | `"above"` \| `"below"` | – | Routes the edge around the top or bottom of everything, e.g. "email back to the customer". |
| `fromSide` / `toSide` | `top` \| `right` \| `bottom` \| `left` | auto | Forces which side of the box the edge leaves or enters. |

### How lines are routed
You never draw lines by hand. On every resize the engine:
1. **Picks sides.** Boxes stacked in a column connect bottom→top, boxes side by side connect right→left, and diagonal pairs leave sideways. If another box sits between them, the line goes around (for example right side → right side).
2. **Places ports on the real outline**: the straight part of a box, the curve of a cylinder top, the side of a pill, the back card of a `stack`. Several lines on one side are spread out and sorted to avoid crossings. A single facing pair is lined up so the line is straight.
3. **Routes around obstacles.** It runs A* on a channel grid. Boxes and group titles can never be crossed. Lines keep a margin from boxes when there is room and avoid running along group borders. Bends, crossings and shared channels cost extra.
4. **Separates parallel lines.** Lines that still share a channel are nudged apart so each stays traceable.
5. **Draws arrowheads** as fixed-size shapes on the line's last straight segment, so they always point exactly along the line and touch the outline.

If a route looks odd, the usual fixes are: reorder a column, change a group's `direction` or `gap`, force `fromSide` / `toSide`, or send a long return path `around: "below"`.

## Scenarios and beats

```jsonc
"scenarios": [
  { "label": "happy path",                 // tab name; keep to 1-3 words
    "caption": "A customer places an order.",  // shown before the first beat
    "flow": [ beat, beat, … ] }
]
```

### Beat
| Field | Type | Notes |
|---|---|---|
| `edges` | hop \| hop[] | Dots that travel during this beat. Several hops run **in parallel**. Use `delay` to stagger them. |
| `show` | `{ nodeId: content \| null }` | Panel content, applied **when the dot arrives**. It persists across later beats of the same scenario. `null` clears it. |
| `state` | `{ nodeId: "ok" \| "warn" \| "error" \| "off" \| null }` | Node status: a coloured border and badge. `off` greys the node out (it is down or being deployed). It persists, and `null` clears it. |
| `light` | id[] | Highlights nodes or groups without moving a dot. |
| `say` | string | Caption, shown from the start of the beat. `**bold**` and `` `code` `` are supported. |
| `ms` | ms | Beat length (default `beatMs`). Minimum 300. |
| `travelMs` | ms | Overrides the dot travel time for this beat. |

A beat can be just `say` + `light` (a pause to explain something), just `state` (an outage starts), or any mix.

### Hop
A hop is a string (the edge id) or an object:

| Field | Type | Notes |
|---|---|---|
| `edge` | edge id | Required. |
| `data` | string | Payload pill that rides above the dot (≤ 60 chars): `"POST /orders"`, `"OrderPlaced #1042"`. |
| `back` | boolean | Travel from `to` back to `from`: the response on the same arrow. |
| `tone` | `"ok"` \| `"warn"` \| `"error"` | Colours the dot, pill and active edge. |
| `fail` | boolean | The dot stops partway and turns red: timeout, refused connection, blocked call. |
| `delay` | ms | Start this hop later inside the beat, for fan-out or sequential hops in one beat. |
| `travelMs` | ms | Per-hop travel time. |

### Panel content
`show` values are a string, an item, or an array of both. Each item renders as one row:

```jsonc
{ "tag": "miss", "tone": "orange", "text": "user:42", "meta": "TTL 60s", "mark": "✓", "markTone": "ok", "mono": true }
```
- `tag`: a small uppercase chip. Tags longer than 3 characters get their own line.
- `tone`: the chip colour.
- `text`: the main text.
- `meta`: muted text after a `·`.
- `mark`: a right-aligned symbol (`✓`, `!`, `✗`, a count).
- `mono`: monospace text, for code, keys and ids.

Use 1-4 rows per panel.

## Complete examples
See `examples/cache-aside.json` (every basic feature), `examples/event-driven-orders.json` (async edges, fan-out with delays, failure hops, DLQ, `around`), and `examples/multi-region-failover.json` (region groups, node states, stream replication, dashed standby zone).
