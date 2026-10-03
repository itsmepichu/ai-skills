# Architecture recipes and storytelling

Each recipe gives a layout (columns left → right), its edges (with their line style), and a scenario script. The scripts use shorthand: `a→b "payload"` is a hop, `[x]` is a panel update, `!x` means `state: error`, and `back` means a response on the same edge. Turn a recipe into JSON with `references/config.md`, and start from the closest file in `examples/`.

## Storytelling structure

Every scenario follows the same arc:
1. **Trigger.** Who starts it and with what payload.
2. **Path.** The hops, one idea per beat, with parallel hops for fan-out.
3. **State change.** What got written, cached, queued or emitted (panels).
4. **Outcome.** The response or result, with a number when one exists (latency, lag, RPO).

Good scenario sets for a design review:
- **Happy path + one failure.** The failure is where the design is justified: retries, DLQ, fallbacks, failover.
- **Cold vs warm.** Cache miss / hit, or a function cold start / warm.
- **Before / after.** The current architecture next to the proposed one (two scenarios or two diagrams).
- **Scale.** Normal load, then a spike that triggers autoscaling or backpressure.

Caption voice: present tense, one or two sentences, explaining *why*. For example, "It writes the order and an outbox row in one transaction, so no event is lost", rather than "Writes to DB".

---

## 1. Three-tier request / response
**Layout:** `user` | `cdn` or `lb` | group "App tier" [`service` stack] | group "Data" [`database`]
**Edges:** user→lb "HTTPS", lb→app, app→db "SQL"
**Happy path:**
1. user→lb "GET /products"
2. lb→app, with `[lb: "→ pod 2 of 3"]`
3. app→db "SELECT …" `[db: "24 rows · 9 ms"]`
4. app→lb back "200"
5. lb→user back "200 · 42 ms"

**Variant, "pod crash":** start with `!app`. The lb health check fails and the lb routes to another pod (`light: [app]`). The request still succeeds.

## 2. Cache-aside
See `examples/cache-aside.json`. The scenarios are miss, hit, and cache down (degrade to the DB).
**Tip:** put the cache above the DB in one "Data" column so both edges leave the API's right side and spread out neatly.

## 3. API gateway + service fan-out (BFF / aggregation)
**Layout:** `mobile` | `gateway` | group "Services" column [`service` ×3] | group "Data" column [`database` ×3]
**Happy path:**
1. mobile→gateway "GET /home"
2. Parallel with `delay` 0/120/240: gateway→profile, gateway→orders, gateway→recs
3. Each service reads its own store (parallel)
4. The services reply back, parallel
5. gateway→mobile back "200 · 3 sections"

**Variant, "slow dependency":** recs→recsdb uses `tone: warn`. The gateway times out that one call (`fail: true` on the back hop) and returns partial content, so the caption explains graceful degradation.

## 4. Queue + worker with retries and a DLQ
**Layout:** `api` | `queue` (sub "SQS / RabbitMQ") + `queue` "DLQ" below | `worker` stack | `external` or `database`
**Edges:** api→queue (async), queue→worker (async), worker→ext, worker→dlq (async, `labelAt` 0.7)
**Happy path:**
1. api→queue "job #88" `[queue: "depth 1"]`
2. queue→worker
3. worker→ext "call"
4. back "200"
5. `[queue: "depth 0"]`

**Failure:**
1. worker→ext `fail` `[worker: "attempt 1"]`
2. Retry with backoff, `fail` `[worker: "attempt 3"]`
3. worker→dlq `tone: warn`
4. Replay: dlq→worker `back`
5. Success

## 5. Pub/sub fan-out with a transactional outbox
See `examples/event-driven-orders.json`. It shows an outbox relay, a Kafka topic, three consumers (parallel hops with `delay`), a DLQ, a consumer that is `off` during a deploy, and lag catching up.

## 6. Saga (orchestration) with compensation
**Layout:** `api` | `service` "Order saga" (orchestrator) | column [`service` Payments, `service` Inventory, `service` Shipping]
**Edges:** orchestrator→each (sync) plus quiet compensation edges if you want separate arrows. Usually `back` on the same edge is enough.
**Happy path:**
1. The orchestrator reserves stock, then charges, then books shipping. Each is a hop plus a back "ok" (`[saga: "step 1/3 ✓"]` …).
2. `[saga: "COMPLETED"]`

**Failure:** shipping→ back `fail` "no carrier". Then compensate in reverse: `refund` on the payment edge (`tone: warn`) and `release` on the inventory edge. End with `[saga: "COMPENSATED"]`. The caption explains why there is no distributed transaction.

## 7. CQRS / read-model projection
**Layout:** `client` | column [`api` "Commands", `api` "Queries"] | column [`database` "Write store", `search` "Read model"] with a `stream` between them
**Script:**
1. The command writes to the write store.
2. The change event streams to the projector, which updates the read model (`stream` edge, `[read: "lag 180 ms"]`).
3. The query reads the read model.

**Variant, "read-your-writes":** the query arrives before the projection catches up, so the panel shows the stale version. Then the caption shows the fix (version token, or read from the primary).

## 8. CDC / streaming data pipeline
**Layout:** `database` "OLTP" | `worker` "CDC (Debezium)" | `stream` "Kafka" | `worker` "Stream processor" | column [`warehouse`, `search`]
**Edges:** all `stream` except the sink writes.
**Script:** a row update → WAL → CDC event `{op: u}` → the topic → an enrich/aggregate window → upsert into the warehouse, and the search index in parallel. The panels show offsets and the window state.
**Variant, "schema change":** the processor is `warn` with the tag "schema v2". The registry check fails and the event is routed to a DLQ topic.

## 9. OAuth 2.0 authorization code + PKCE (login)
**Layout:** `user` | `browser` "SPA" | `auth` "Identity provider" | `api` "Resource API"
**Edges:** spa→idp "authorize", idp→spa (use `back` on the same edge for the redirect), spa→api "Bearer"
**Script:**
1. The SPA creates `code_verifier` and `challenge` `[spa]`.
2. It redirects to /authorize with the challenge.
3. The user signs in (`light: [idp]`).
4. The redirect comes back with `?code=…`.
5. POST /token with the code + verifier, getting back access and refresh tokens `[spa]`.
6. Call the API with `Bearer …`. The API validates the JWT (`[api: "aud ✓ exp ✓"]`).

**Variant, "expired token":** the API returns back 401 `tone: error`. The SPA uses the refresh token and retries.

## 10. CI/CD pipeline with a canary
**Layout:** `repo` | `pipeline` "CI" | `storage` "Registry" | `deploy` "CD" | group "Cluster" [`service` stable stack, `service` canary]
**Script:**
1. push → CI with `[ci: "test ✓ scan ✓"]`
2. The image goes to the registry `[registry: "sha-4f2a"]`.
3. CD deploys the canary with 5% traffic (`light: [canary]`).
4. The metrics gate passes (`[cd: "error rate 0.1% ✓"]`).
5. Promote to 100%.

**Variant, "bad release":** the canary is `error` and the gate fails. CD rolls back automatically (`tone: warn`).

## 11. Blue / green traffic switch
**Layout:** `users` | `lb` | column [group "blue" [app, db], group "green" (dashed) [app, db]]
**Script:** traffic goes to blue → deploy green (`state: green app ok`) → smoke test green → `[lb: "100% → green"]` → blue drains (`state: blue app off`).

## 12. Multi-region failover
See `examples/multi-region-failover.json`: DNS health checks, a `fail` hop, promotion of the replica, and RTO/RPO in the final caption.

## 13. CDN edge caching
**Layout:** `browser` | `cdn` "Edge PoP" | `waf` | `storage` or `service` "Origin"
**Script:**
- **Miss:** browser→cdn, cdn→waf→origin, back with `Cache-Control: max-age=300` `[cdn: "stored · TTL 300s"]`.
- **Hit:** browser→cdn back "HIT · 12 ms".
- **Purge:** deploy → purge API → `[cdn: "invalidated"]`.

## 14. Kubernetes ingress and autoscaling
**Layout:** `users` | `lb` "Ingress" | group "Cluster" (`kind: cluster`) [`service` "Service", column [pods …]] | `metrics` "HPA"
**Script:**
1. Normal traffic spreads over 2 pods.
2. A spike arrives: pods are `warn` `[hpa: "CPU 85% > 70%"]`.
3. The HPA scales to 5 (`light` the new pods, or change the panel to "5 replicas").
4. Latency recovers.

## 15. RAG / LLM agent with tools
**Layout:** `user` | `agent` "Agent" | column [`vector` "Vector DB", `search` "Keyword index", `external` "Tools/APIs"] | `llm` "LLM"
**Script:**
1. question → agent
2. Parallel: embed + vector search, and keyword search (`delay`) `[vector: "top-5 · 0.82"]`
3. Rerank `[agent]`
4. prompt + context → LLM
5. Tool call → external → result
6. answer + citations back to the user

**Variant, "no good context":** the retrieval scores are low (`tone: warn`), and the agent asks a clarifying question instead of guessing.

## 16. Rate limiting and a circuit breaker
**Layout:** `client` | `gateway` "Gateway (rate limit)" | `service` | `external`
**Script:**
- **Normal:** requests pass `[gateway: "12/100 per min"]`.
- **Burst:** `[gateway: "100/100"]`, then the next request gets back `429` `tone: warn`.
- **Dependency failing:** service→external `fail` ×3 → `[service: "breaker OPEN"]` → later calls fail fast (short `fail` hop, `travelMs: 300`) → half-open probe `tone: ok` → closed.

---

## Layout tips
- **Wide diagrams.** More than about 6 columns becomes hard to read in docs. Stack related columns in a `column` group, or split the diagram.
- **You don't need to avoid crossings by hand.** Lines route around boxes automatically. Layout still decides how *clean* they look, so keep the request path left → right and the arrangement compact.
- **Return paths** to the first column: `around: "below"` + `quiet: true`, or `back: true` on the original edge.
- **Two edges between the same pair** (request and event back): give each an explicit `id`. They spread onto separate anchors automatically.
- **Label collisions:** labels already avoid boxes and each other. If one still lands badly, pin it with `labelAt: 0.3` / `0.7`, or drop it and put the text in the hop's `data`.
- **Request/response on one edge** gets arrowheads at both ends automatically (because of the `back` hop). For a call where only the request direction matters, set `"arrows": "end"`.
- **The same width for siblings** in a column (`width`) makes the lines straight and the diagram calmer.
