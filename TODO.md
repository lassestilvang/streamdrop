# TODO

## Product and Workflow

* [ ] Mark processed articles as read in Raindrop. Define when an item becomes "processed" and make the update idempotent so retries do not corrupt state.
* [ ] Cache extracted content (e.g. `/queue/latest`). Decide whether this lives in Vercel KV, Blob, or another store, and define cache invalidation and freshness rules.
* [ ] Tag-based filtering (e.g. only `tts`). Support either a default configured Raindrop search/tag filter or per-request filtering with validation.
* [ ] Generate AI summaries per article (e.g. before each article `Summary: ...`). Keep summaries optional, bounded in length, and isolated from the core extraction flow so queue generation still works without the model step.
* [ ] Auto daily generation (cron). Define the schedule, destination of the generated output, and retry behavior when upstream extraction fails.
* [ ] Multi-language support. Decide whether this means language-aware extraction, different reading-speed defaults, translated UI text, or generated summaries in multiple languages.
* [ ] Web UI (view + copy queue easily). Add a simple authenticated interface for generating, previewing, copying, and inspecting skipped articles.
* [ ] One-tap iPhone Shortcut integration (one tap to fetch latest queue and open in ElevenReader). Specify the response format and shortcut flow so this works without manual HTML copy/paste.
* [ ] Deduplication + scoring. Prevent repeated articles across runs and define how freshness, length, source quality, tags, or favorites affect queue priority.
* [ ] “Smart batching” (detect complexity, adjust pacing). Replace pure word-count batching with a configurable heuristic that considers article difficulty, density, or source type.
* [ ] Direct ElevenReader integration (if API becomes available). Track API availability and design the integration so local HTML export remains a fallback path.

## Deployment and Security

* [x] Add CI for typecheck, tests, and deployment-safe validation. GitHub Actions now runs `npm ci` and `npm run check` on every push and pull request in `.github/workflows/ci.yml`.
* [ ] Protect the public API before exposing it on Vercel. Add authentication for `/api/generate` and `/api/health`, or explicitly scope health to non-sensitive checks if it stays public.
* [ ] Add rate limiting and abuse controls. Prevent repeated expensive extraction requests from exhausting Vercel execution time or upstream bandwidth.
* [ ] Add request/response guardrails for production traffic. Define max request frequency, acceptable query overrides, and safe defaults for expensive knobs like `maxArticles` and `concurrency`.

## Reliability and Operations

* [ ] Add persistent storage for generated queues and run history. Keep enough metadata to inspect previous runs, compare outputs, and support retrieval without re-fetching everything.
* [ ] Add background or asynchronous generation for larger queues. Move long-running work off the synchronous request path when cache misses or large collections make single-request generation unreliable.
* [ ] Add observability and alerting. Capture structured logs, extraction failure rates, upstream timeout rates, and deployment/runtime errors.
* [ ] Add deployment smoke checks and runbooks. Document what to verify after each Vercel deploy and what to do when Raindrop auth, extraction, or quota failures start happening.
* [ ] Add integration tests that cover real route behavior with mocked upstreams. Verify error mapping, timeout handling, skipped-article behavior, and HTML rendering from the API surface, not just helpers.
