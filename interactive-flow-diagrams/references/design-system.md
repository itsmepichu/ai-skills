# flowfig design system

The visual rules behind every diagram: a minimal, Swiss-style look with a developer-tool palette and accessibility and motion guidelines, built into `assets/flowfig.css`. Read this when you change the look, add a theme, or review a diagram before you share it.

## Principles
1. **The flow is the hero.** Only the active path is saturated. Everything else is quiet: neutral boxes, muted lines, and it dims while a story plays.
2. **Meaning never depends on colour alone.** Status pairs colour with a badge glyph (✓ ! ✕ –), a failed hop shows ✕ on its dot, and line style (solid/dashed/dotted) carries sync/async/stream.
3. **Nothing moves unless it means something.** One dot per hop, content fading in, and a caption. No decorative motion. `prefers-reduced-motion` steps through without animation.
4. **Light and dark are designed together**, not inverted. Each theme has its own tonal values, and both are contrast-checked.
5. **Stable geometry.** Panels reserve their largest size up front, so boxes and lines never jump mid-story.

## Token layers
| Layer | Prefix | Examples | Who may use it |
|---|---|---|---|
| 1. Primitives | `--ff-p-*` | `--ff-p-slate-900`, `--ff-p-blue-600` | Only the semantic layer |
| 2. Semantic | `--ff-*` | `--ff-page`, `--ff-surface`, `--ff-fg`, `--ff-muted`, `--ff-accent`, `--ff-ok/warn/error`, hues | Components and theme overrides |
| 3. Component | `--ff-node-*`, `--ff-edge-*`, `--ff-chip-*`, `--ff-ctl-h` | `--ff-node-radius`, `--ff-edge-active-w` | One component each |

Brand a diagram through the **semantic** layer with config `theme` (camelCase keys, per theme): `accent`, `accentStrong`, `page`, `surface`, `bg`, `fg`, `muted`, `subtle`, `border`, `ok`, `warn`, `error`, and the hues. Never hard-code hex values in components.

## Palette (slate neutrals + blue accent)
| Role | Light | Dark | Notes |
|---|---|---|---|
| page | `#ffffff` | `#0b1120` | Canvas behind everything |
| surface (groups) | `#f8fafc` | `#0f172a` | |
| bg (nodes) | `#ffffff` | `#162033` | Nodes sit one step above groups |
| fg | `#0f172a` (17.9:1) | `#f1f5f9` (14.9:1) | Labels |
| muted | `#475569` (7.6:1) | `#94a3b8` (6.4:1) | Sub-labels, captions, idle UI |
| subtle (idle lines) | `#64748b` (4.8:1) | `#71809a` (4.7:1) | Data lines need at least 3:1 |
| border | `#cbd5e1` | `#334155` | Decorative. Raised automatically under `prefers-contrast: more` |
| accent | `#2563eb` (5.2:1) | `#60a5fa` (6.4:1) | Active path, highlights |
| accentStrong | `#1d4ed8` | `#2563eb` | Fills behind white text (pills, play button), at least 4.5:1 with white |
| ok / warn / error | `#15803d` / `#b45309` / `#dc2626` | `#4ade80` / `#fbbf24` / `#f87171` | `*Strong` variants for white text |

Category hues tint the node icon chips: compute blue, data violet, messaging orange, network teal, security red, client/external slate, observability green, AI pink, DevOps indigo. They identify a role at a glance, and the icon and label carry the same meaning.

## Scales
- **Spacing (4 pt):** 4 · 8 · 12 · 16 · 20 · 24 · 32 (`--ff-space-1…8`).
- **Radius:** 6 (panels, pills) · 10 (nodes) · 14 (groups, frame) · full (buttons, user pills).
- **Type:**
  - 10 px: uppercase tags only.
  - 11 px: edge labels, group titles, legend.
  - 12 px: sub-labels, panels, controls.
  - 14 px: node labels, captions.
  - 16 px: title.
  - 20 px: presenter title and captions.

  Numbers use `tabular-nums`. Use the system UI font and a monospace font for payloads and code, so the file needs no web fonts and renders the same offline and in exports.
- **Elevation:** `--ff-elev-1` (nodes), `--ff-elev-2` (pills, menus), `--ff-elev-3` (dialogs). Dark mode uses deeper shadows.
- **Z-order:** group backgrounds → lines → nodes → line labels → dots → payload pills → controls.
- **Motion:**
  - Hover/press: 120 ms. State changes: 200 ms. Content entering: 320 ms (ease-out).
  - Dots travel with ease-in-out cubic. Exits are shorter than entries.
  - Linear easing is used only for constant-rate progress, such as the scenario progress bar and stream dashes.

## Components
- **Node:** 1 px border, radius 10, a 30 px tinted **icon chip**, label 14/600, sub 12/400, an optional live panel (dashed, 12 px, max 4 rows). Variants: `store` (cylinder), `pill` (people), `stack` (replicas), `dashed` (external/standby).
- **Group:** surface fill, 14 radius, uppercase 11 px title with an optional icon. `dashed` is for standby or trust boundaries. Lines avoid group titles and borders.
- **Line:** idle 1.4 px subtle. Seen 1.8 px accent at 60%. Active 2.4 px accent. Tones ok/warn/error apply only while active. Arrowheads are fixed 9 × 9 px shapes, at both ends for bi-directional edges.
- **Payload pill:** accentStrong fill, white 12 px text, elevation 2, max 260 px.
- **Controls:**
  - Native buttons and a native `<select>` for speed (0.5× – 2.0×), with tabs for scenarios.
  - 32 px high on desktop and 44 px on touch (`pointer: coarse`), with 8 px gaps.
  - Every control has a visible 2 px focus ring, an accessible name and a tooltip listing its shortcut.
- **Steps panel:** the text version of every scenario. It's for screen readers, people who skim, and print. Each step jumps the diagram to that beat.

## Accessibility checklist (run before sharing)
- [ ] Text ≥ 4.5:1 and lines/icons ≥ 3:1 in **both** themes. The engine palette passes, so re-check any custom `theme` colours.
- [ ] No state is shown by colour alone (badges, ✕ on failed hops, line styles, legend).
- [ ] Every step has a `say` caption. The steps panel and the captions are the accessible version.
- [ ] Keyboard: Space, ←/→, ↑/↓, 1-9, F, S, T, −/+ all work; focus is visible.
- [ ] Reduced motion: the diagram steps without animation.
- [ ] Exported GIFs and videos get descriptive `alt` text or a caption where they are embedded.

## Changing the look safely
- Brand colour: `"theme": { "accent": "#7c3aed", "accentStrong": "#6d28d9" }`. Keep accentStrong at 4.5:1 or more with white.
- Denser diagrams: lower group `gap` values, not the type scale.
- Bigger for slides: use presenter mode (F), which scales the stage up to 2.5×, rather than raising font sizes in CSS.
- Never add a second accent colour. Use tones (`ok`, `warn`, `error`) for meaning and category hues for icons.
