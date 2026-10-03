# ai-skills

A growing collection of free, open-source skills for AI agents.

Each skill is a self-contained folder with a `SKILL.md` file, following the open [Agent Skills](https://agentskills.io) format. The same folder works in Claude, Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Hermes Agent and any other agent that reads `SKILL.md` skills.

## Skills

| Skill | What it does | Needs |
|---|---|---|
| [interactive-flow-diagrams](interactive-flow-diagrams/) | Turns "how does this system work?" into an animated, step-by-step flow diagram: one self-contained HTML file with light/dark themes, presenter mode and GIF/MP4/WebM/PNG export. For architecture walkthroughs, request and event flows, auth flows, deployments and failover scenarios. | Node.js 18+ (CLI export also needs Playwright and ffmpeg) |

Each skill's own README covers its features, requirements and examples.

## Install

Pick the option that fits your agent, and install only the skills you need.

### Option 1: `npx skills` (most agents)

The open-source [skills CLI](https://github.com/vercel-labs/skills) copies skills from this repo into your agent's skills folder:

```bash
npx skills add itsmepichu/ai-skills --list                                            # see what's available
npx skills add itsmepichu/ai-skills --skill interactive-flow-diagrams                 # install one skill
npx skills add itsmepichu/ai-skills --skill interactive-flow-diagrams -a claude-code  # for a specific agent
```

### Option 2: Copy the folder

```bash
git clone https://github.com/itsmepichu/ai-skills.git
```

Copy the skill's folder (for example `interactive-flow-diagrams/`) into your agent's skills directory. Keep the folder name unchanged.

| Agent | Personal (all projects) | Project (one repo) |
|---|---|---|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| OpenAI Codex | `~/.agents/skills/` | `.agents/skills/` |
| GitHub Copilot | `~/.copilot/skills/` or `~/.agents/skills/` | `.github/skills/`, `.agents/skills/` or `.claude/skills/` |
| Cursor | `~/.cursor/skills/` or `~/.agents/skills/` | `.cursor/skills/` or `.agents/skills/` |
| Hermes Agent | `~/.hermes/skills/`, or list the folder under `skills.external_dirs` in `~/.hermes/config.yaml` | – |
| Other agents | Wherever the agent loads `SKILL.md` folders from, or point it at `SKILL.md` directly | – |

Tip: one copy in `~/.agents/skills/` is picked up by Codex, Copilot and Cursor.

### Option 3: Claude apps (claude.ai, desktop, Cowork)

Claude installs a skill from a ZIP file that contains the skill folder.

1. Get the files: `git clone` this repo, or use **Code › Download ZIP** on GitHub and extract it.
2. Zip one skill folder, so the folder itself sits at the top of the ZIP:
   - macOS / Linux: `zip -r interactive-flow-diagrams.zip interactive-flow-diagrams`
   - Windows (PowerShell): `Compress-Archive -Path interactive-flow-diagrams -DestinationPath interactive-flow-diagrams.zip`
3. In Claude, go to **Customize › Skills**, click **+ › Create skill › Upload a skill**, and choose the ZIP.

Don't upload GitHub's "Download ZIP" file directly: it holds the whole repo, not a single skill folder. Skills that run scripts also need code execution enabled in Claude.

## Adding a skill

Contributions are welcome, from new skills to small fixes. For a new skill, open an issue first to discuss it, then send a pull request with one skill per pull request.

### Folder layout

```
<skill-name>/
├── SKILL.md       required: frontmatter + instructions for the agent
├── README.md      for people: what it does, install, requirements
├── LICENSE        MIT, so the folder can be shared on its own
├── scripts/       optional: code the agent runs
├── references/    optional: detail the agent reads only when needed
├── assets/        optional: templates and static files
└── examples/      optional: complete, working inputs
```

A minimal `SKILL.md`:

```markdown
---
name: my-skill
description: What the skill does and when to use it, in one or two sentences.
license: MIT
---

# My skill

Step-by-step instructions for the agent.
```

### Checklist

- [ ] The folder name matches `name` in `SKILL.md`: lowercase letters, digits and hyphens, at most 64 characters.
- [ ] `description` says what the skill does **and when to use it**, in at most 1024 characters.
- [ ] It is agent-agnostic: no instructions that only one agent understands, and paths relative to the skill folder.
- [ ] `SKILL.md` stays short (under about 500 lines). Long detail goes in `references/`.
- [ ] Scripts state their requirements and avoid unnecessary dependencies. Working offline is a plus.
- [ ] Examples run cleanly, and generated output is not committed (see `.gitignore`).
- [ ] No secrets, personal data, or third-party files without a compatible license.
- [ ] The skill is added to the [Skills](#skills) table above.

## License

[MIT](LICENSE). Each skill folder also includes its own `LICENSE` file, so it can be shared on its own.
