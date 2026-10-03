# Icons: built-in kinds and provider icons

## Built-in kinds (offline, theme-aware)

Setting `kind` gives a node an icon, an icon colour for its category and, for some kinds, a default shape. Readers learn the colours quickly. Blue is compute, purple is data, orange is messaging, teal is network, red is security, gray is client or external, green is observability, pink is AI, and indigo is DevOps.

| Category | Kinds |
|---|---|
| client | `user` (pill), `users` (pill), `client`, `browser`, `mobile`, `cli`, `device` |
| network | `cdn`, `dns`, `lb`, `gateway`, `network`, `region` |
| security | `waf`, `firewall`, `auth`, `secrets` |
| compute | `service`, `api`, `function`, `container`, `cluster`, `worker`, `scheduler` |
| data | `database`, `cache`, `storage`, `warehouse`, `search`, `vector` (all cylinders), `file` |
| messaging | `queue`, `stream`, `topic`, `email`, `notification` |
| observability | `monitor`, `logs`, `metrics` |
| ai | `llm`, `agent` |
| external | `external`, `payment` (both dashed) |
| devops | `repo`, `pipeline`, `deploy`, `code` |

Aliases: `db`, `k8s`, `kubernetes`, `bucket`, `s3`, `lambda`, `serverless`, `loadbalancer`, `events`, `pubsub`, `kafka`, `ai`, `idp`, `identity`, `vault`, `saas`, `thirdparty`, `ci`, `vm`, `server`, `app`.

You can also use a built-in icon directly with `"icon": "<name>"`: `user`, `users`, `browser`, `mobile`, `desktop`, `terminal`, `chip`, `globe`, `signpost`, `balance`, `gateway`, `cloud`, `pin`, `shield`, `wall`, `key`, `lock`, `server`, `braces`, `lambda`, `box`, `helm`, `gear`, `clock`, `database`, `bolt`, `bucket`, `warehouse`, `search`, `dots`, `file`, `queue`, `waves`, `broadcast`, `mail`, `bell`, `pulse`, `list`, `chart`, `sparkle`, `external`, `card`, `git`, `pipeline`, `rocket`, `code`.

Groups accept `kind` or `icon` too. They show a small icon before the label (`region`, `network`, `cluster`).

## Provider and brand icons

Use them when the audience thinks in a specific cloud ("Lambda", "Cloud Run", "Cosmos DB") or when real product logos help. Keep `kind` as well, because it still sets the shape and the fallback. `icon` only replaces the picture.

**Resolution order:** try these in turn and stop at the first that works.

1. **Icon packs or files from the user.** Official packs are the best quality.
   `"icon": "icons/aws/Arch_AWS-Lambda_48.svg"` is a path relative to the config file. `build.mjs` inlines it as a data URI.
2. **An icon or logo tool in your agent** (an MCP server, connector or plugin that returns SVG logos). Fetch the SVG, then paste the markup as `"icon": "<svg …>…</svg>"` or save it next to the config and reference it by path. If the tool has a dark variant, put it in `iconDark`.
3. **The Iconify API, when you have network access.** Use `"icon": "iconify:<set>:<name>"` and build with `--fetch-icons`. Useful sets:
   - `logos` has full-colour product logos, for example `logos:aws-lambda`, `logos:aws-s3`, `logos:aws-dynamodb`, `logos:aws-api-gateway`, `logos:google-cloud`, `logos:microsoft-azure`, `logos:kubernetes`, `logos:redis`, `logos:postgresql`, `logos:kafka`, `logos:docker`, `logos:nginx`, `logos:terraform`, `logos:github-actions`.
   - `simple-icons` has one-colour brand marks, e.g. `simple-icons:stripe`. They are black by default, so add `?color=%23ffffff` in `iconDark` for dark mode.
   - `mdi` and `tabler` are generic UI icons.
   You can browse all of them at icon-sets.iconify.design.
4. **Built-in kinds.** They always work, offline, in both themes.

Never leave a remote `https://` icon in the final HTML. It breaks offline use and in-page export. `build.mjs` refuses one unless you pass `--fetch-icons`, and then it inlines it.

### Official cloud icon packs
- **AWS Architecture Icons**: https://aws.amazon.com/architecture/icons/. Customers and partners may use them in architecture diagrams, presentations and documents.
- **Azure architecture icons**: https://learn.microsoft.com/azure/architecture/icons/. Use them in architecture diagrams and documentation. Don't crop, flip, rotate or distort them, and keep the product name next to the icon.
- **Google Cloud icons**: https://cloud.google.com/icons. Core product icons and category icons, for technical and architecture diagrams.

Check the current terms on those pages before publishing. Across all of them: use the icon unmodified, next to the product name, and never to represent your own product.

### Dark mode
Many logos have dark text or outlines that disappear on a dark background. Provide `iconDark` (a light variant, or the same mark in white). The engine swaps it when the theme changes, and exports use the right one for each theme.

```jsonc
{ "id": "pay", "label": "Stripe", "kind": "payment",
  "icon": "iconify:logos:stripe", "iconDark": "iconify:simple-icons:stripe?color=%23ffffff" }
```

### Sizing
Icons render at 22 px (14 px in group labels) with `object-fit: contain`. Square SVGs look best. For wide wordmarks, use the square "mark" version of the logo.
