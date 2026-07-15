# Project Structure

```text
.
├── db/
│   ├── schema.sql
│   └── migrations/
├── baml_src/
│   └── ai_assistants.baml
├── ai-runtime/
│   ├── src/
│   │   ├── baml_client/
│   │   └── server.ts
│   ├── Dockerfile
│   ├── README.md
│   ├── package.json
│   └── package-lock.json
├── agent-runtime/
│   ├── app/
│   │   ├── giverny_tools.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── Dockerfile
│   ├── README.md
│   └── requirements.txt
├── agent-evals/
│   ├── cases.json
│   ├── fixture.sql
│   ├── mock-model.mjs
│   ├── quality-gates.json
│   ├── run.mjs
│   ├── run-isolated.mjs
│   ├── wrangler.eval.toml
│   └── README.md
├── .github/workflows/
│   ├── agent-quality-gate.yml
│   └── record-production-deployment.yml
├── docs/
│   ├── AI_AGENT_RUNTIME.md
│   ├── AI_MODEL_ROUTING.md
│   ├── OPERATION_POLICIES.md
│   ├── PROJECT_STRUCTURE.md
│   ├── DEPLOYMENT.md
│   ├── UX_OPTIMIZATION_AUDIT.md
│   ├── VERSIONING.md
│   └── cloudflare/
│       └── wrangler.example.toml
├── handoff/
│   ├── HANDOFF.md
│   ├── NEXT_WINDOW_BRIEF.md
│   └── env.example
├── public/
│   ├── favicon.png
│   ├── favicon.svg
│   ├── giverny-logo.png
│   └── icons.svg
├── src/
│   ├── baml_client/
│   │   └── baml_client/
│   ├── config/
│   │   └── appConfig.ts
│   ├── data/
│   │   └── initialData.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── format.ts
│   │   └── psdPreview.ts
│   ├── types/
│   │   ├── agent.ts
│   │   └── domain.ts
│   ├── App.css
│   ├── App.tsx
│   ├── aliceAgent.ts
│   ├── SharedReport.tsx
│   ├── index.css
│   ├── main.tsx
│   └── worker.ts
├── CHANGELOG.md
├── README.md
├── 使用手册.md
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
└── wrangler.toml
```

## Debug Entry Points

- Main admin UI and route state: `src/App.tsx`
- Visual system and layout: `src/App.css`
- Client share page: `src/SharedReport.tsx`
- Frontend API client and auth headers: `src/lib/api.ts`
- PSD preview helper: `src/lib/psdPreview.ts`
- Worker API backend: `src/worker.ts`
- BAML AI function contracts: `baml_src/ai_assistants.baml`
- Generated BAML TypeScript client: `src/baml_client/baml_client/`
- Independent BAML Node runtime: `ai-runtime/`
- Cloudflare Agents SDK Runtime: `src/aliceAgent.ts`
- Agent regression suite and isolated quality gate: `agent-evals/`
- Legacy Python Agent runtime fallback: `agent-runtime/`
- Agent runtime architecture notes: `docs/AI_AGENT_RUNTIME.md`
- AI model routing notes: `docs/AI_MODEL_ROUTING.md`
- Domain types: `src/types/domain.ts`
- App version and defaults: `src/config/appConfig.ts`
- D1 full schema: `db/schema.sql`
- Incremental D1 migrations: `db/migrations/`
- Cloudflare bindings and routes: `wrangler.toml`
- Developer handoff: `handoff/HANDOFF.md`
- Short next-window brief: `handoff/NEXT_WINDOW_BRIEF.md`

## Current Architecture

- Production data is stored in Cloudflare D1 `designer-worklog-db`.
- Production files are stored in Cloudflare R2 `designer-worklog-uploads`.
- The former staging site and its separate D1/R2 resources have been removed. Validate locally, then deploy the production Worker directly.
- Static assets are served by Workers Static Assets through the `ASSETS` binding.
- `binding = "ASSETS"` in `wrangler.toml` must remain, or SPA routes such as `/share/:token` can fail.
- BAML is used as the AI prompt/schema contract and code-generation layer.
- The production Cloudflare Worker does not import BAML directly. It can call the independent `ai-runtime/` Node service first, then fall back to DeepSeek direct if the runtime is unavailable.
- `src/aliceAgent.ts` is the primary Agent Runtime. Each conversation uses a named `AliceAgent` Durable Object with SQLite history, typed tool calls, pending confirmation state, and a compact trace.
- `agent_run_metrics` stores privacy-minimized Agent outcome metadata for the admin quality dashboard; evaluation-tagged traffic is retained separately and excluded from dashboard aggregates.
- `agent-runtime/` and `AGENT_RUNTIME_CONTAINER` remain temporarily as a legacy fallback while the Cloudflare-native path is validated in production.
- Tenant model API keys are stored in `app_settings` encrypted with `AI_SETTINGS_SECRET`; future multi-tenant work should move the same config shape under tenant-scoped settings.

## Auth Notes

- Frontend login state is stored in `localStorage` key `designer-worklog-auth`.
- API requests use `x-auth-key` and `x-auth-email`.
- Legacy `x-admin-token` is removed from the frontend flow and should not be reintroduced.
- Sensitive local files under `handoff/` may contain real credentials; do not expose or commit them.

## Business Notes

- Tasks are not deletable in normal operation, including by admin.
- File deletion is allowed only for mistaken uploads and uses site-native confirmation.
- File library files come from task lifecycle uploads, not from a standalone library-first upload workflow.
- Task month filtering uses settlement month first, then falls back to the task start month.
- Task ordering is start date descending, then created time descending.
