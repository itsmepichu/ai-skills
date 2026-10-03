# interactive-flow-diagrams

An [Agent Skills](https://agentskills.io) skill that makes **animated, step-by-step flow diagrams** for software architects, solution engineers and cloud engineers:

- One JSON config becomes **one self-contained HTML file**: offline, no dependencies, about 130-140 KB.
- **Light, dark and auto** themes with a toggle; brand accent colours.
- **Presenter mode**: full screen, step with the arrow keys or a clicker, scenario tabs.
- **Export** to GIF, MP4, WebM and PNG from the page (⤓ button) or from the CLI (`scripts/export.mjs`).
- Built-in component icons, plus official cloud and brand icons when available.

The agent reads `SKILL.md`; people start here.

## Install

The folder name must stay `interactive-flow-diagrams`.

| Agent | Where to put the folder |
|---|---|
| **Claude** (claude.ai, desktop, Cowork) | Zip the folder, then go to *Customize › Skills › + › Create skill › Upload a skill*. Code execution must be enabled. |
| **Claude Code** | `~/.claude/skills/` (personal) or `.claude/skills/` (project). |
| **OpenAI Codex** | `~/.agents/skills/` (personal) or `.agents/skills/` in the repo. |
| **GitHub Copilot** (CLI, VS Code / JetBrains agent mode, cloud agent) | `~/.copilot/skills/` or `~/.agents/skills/` (personal); `.github/skills/`, `.agents/skills/` or `.claude/skills/` (project). |
| **Cursor** | `~/.cursor/skills/` or `~/.agents/skills/` (personal); `.cursor/skills/` or `.agents/skills/` (project). |
| **Hermes Agent** | `~/.hermes/skills/`, or list the folder under `skills.external_dirs` in `~/.hermes/config.yaml`. |
| Anything else | Any agent that reads `SKILL.md` folders, or point your agent at `SKILL.md` directly. |

Tip: a single copy in `~/.agents/skills/interactive-flow-diagrams` is picked up by Codex, Copilot and Cursor.

## Requirements

- **Node.js 18+** to build diagrams. The build has no npm dependencies.
- **Exports from the CLI:** Playwright Chromium and ffmpeg. Run `node scripts/export.mjs --setup` once, which installs them into `~/.cache/flowfig`.
- **Exports from the page:** a Chromium-based browser. The encoders load from jsDelivr on first use.

## Quick start (by hand)

```bash
node scripts/build.mjs examples/cache-aside.json        # -> examples/cache-aside.html
open examples/cache-aside.html                          # F = present, arrows = step, T = theme
node scripts/export.mjs examples/cache-aside.html       # -> mp4 + gif, light + dark
```

Or just ask your agent: *"Make an interactive flow diagram of our checkout: web → API gateway → orders service → Postgres + outbox → Kafka → payments/inventory, with a payment-failure scenario, and export a dark GIF for the README."*

## Layout

```
SKILL.md                     agent instructions (workflow, design rules)
assets/                      engine: flowfig.js, flowfig.css, template.html
scripts/build.mjs            validate + inline -> single HTML
scripts/export.mjs           HTML -> MP4 / GIF / WebM / PNG
references/                  config schema, architecture recipes, icons, design system, export & embedding
examples/                    cache-aside, event-driven-orders, multi-region-failover
```

## Changelog

**1.1.0**
- Lines route around boxes and group titles (A* on a channel grid). You can choose `curved` or `orthogonal` style, parallel lines are separated, and labels avoid collisions.
- Arrowheads are drawn on the real outline of each shape (box, cylinder, pill, stack) and always align with the line. Edges that carry traffic both ways get arrowheads at both ends (`arrows`).
- Speed dropdown (0.5× – 2.0×) and −/+ keys. New steps transcript panel. Presenter mode hides the control bar when idle.
- New design system: three token layers, a slate palette contrast-checked in both themes, spacing, type and motion scales, icon chips, 44 px touch targets, `prefers-contrast` support, and status shown with glyphs as well as colour.

**1.0.0**: first release.

MIT licensed. The in-page exporter loads [gifenc](https://github.com/mattdesl/gifenc) (MIT) and [mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0) on demand; neither is bundled.
