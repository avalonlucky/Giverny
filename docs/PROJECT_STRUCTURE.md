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
│   ├── start-browser-eval.mjs
│   ├── wrangler.eval.toml
│   └── README.md
├── tests/
│   └── browser/
│       └── critical-flows.spec.ts
├── playwright.config.ts
├── .github/workflows/
│   ├── agent-quality-gate.yml
│   └── record-production-deployment.yml
├── docs/
│   ├── AI_AGENT_RUNTIME.md
│   ├── AGENT_ORCHESTRATOR.md
│   ├── AGENT_WORKFLOWS.md
│   ├── AI_MODEL_ROUTING.md
│   ├── AI_LEARNING.md
│   ├── AI_HOUR_ESTIMATE.md
│   ├── AI_PROGRESS_ASSESSMENT.md
│   ├── AGENT_PRODUCTION_OPERATIONS.md
│   ├── MCP_SERVER.md
│   ├── LOCAL_CLI_BRIDGE.md
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
│   ├── giverny-bridge.mjs
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
│   │   ├── fileMetadata.ts
│   │   ├── format.ts
│   │   ├── money.ts
│   │   ├── month.ts
│   │   ├── previewTimeout.ts
│   │   ├── psdPreview.ts
│   │   └── taskSettlement.ts
│   ├── views/
│   │   ├── FilesView.tsx
│   │   ├── IncomeView.tsx
│   │   └── KnowledgeView.tsx
│   ├── types/
│   │   ├── agent.ts
│   │   └── domain.ts
│   ├── App.css
│   ├── App.tsx
│   ├── agentToolRegistry.ts
│   ├── agentOrchestrator.ts
│   ├── agentScope.ts
│   ├── agentAnalysisWorkflow.ts
│   ├── agentWriteWorkflow.ts
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
- Lazy-loaded file library and file inspector: `src/views/FilesView.tsx`
- Lazy-loaded income and tax-estimate view: `src/views/IncomeView.tsx`
- Frontend API client and auth headers: `src/lib/api.ts`
- PSD preview helper: `src/lib/psdPreview.ts`
- Worker API backend: `src/worker.ts`
- BAML AI function contracts: `baml_src/ai_assistants.baml`
- Generated BAML TypeScript client: `src/baml_client/baml_client/`
- Independent BAML Node runtime: `ai-runtime/`
- Cloudflare Agents SDK Runtime: `src/aliceAgent.ts`
- Shared Agent/MCP read-tool registry: `src/agentToolRegistry.ts`
- Shared Agent turn contract and deterministic verification: `src/agentOrchestrator.ts`
- Signed tenant/principal context for internal tools: `src/agentScope.ts`
- Durable background analysis workflow: `src/agentAnalysisWorkflow.ts`
- Durable confirmed-write workflow: `src/agentWriteWorkflow.ts`
- Agent regression suite and isolated quality gate: `agent-evals/`
- Desktop/mobile browser critical-flow gate: `tests/browser/critical-flows.spec.ts`
- Browser regression environment and projects: `playwright.config.ts`, `agent-evals/start-browser-eval.mjs`
- AI operations aggregation and workspace context: `GET /api/ai/operations-center`, `db/migrations/0024_ai_governance_runtime.sql`

## AI Operations And Workspace Foundation

- `AI 运行中心`由 Worker 聚合 `agent_run_metrics`、`agent_analysis_jobs`、`ai_learning_events` 与工时评估结果，前端不再自行拼接多套统计口径，并提供工作区切换、创建与成员添加 / 邀请入口。
- 自动化 Agent 评测继续使用 `is_eval = 1`，运行中心和正式质量指标只统计真实流量。
- `workspaces` 与 `workspace_memberships` 是多租户的数据边界；现有记录默认归属 `default` 工作区。当前版本已开放第一阶段管理入口：AI 运行中心可创建 / 切换工作区、添加或邀请成员，默认工作区保持兼容。
- 新增需要租户隔离的表时，应同时保存 `workspace_id` 和 `principal_id`，并在 Worker 查询层先解析当前 principal，再拼接工作区条件。
- Agent runtime architecture notes: `docs/AI_AGENT_RUNTIME.md`
- Agent orchestration and multi-tenant boundary: `docs/AGENT_ORCHESTRATOR.md`
- Agent production controls and user operations: `docs/AGENT_PRODUCTION_OPERATIONS.md`
- Durable Agent write workflow notes: `docs/AGENT_WORKFLOWS.md`
- Remote MCP endpoint and authentication: `docs/MCP_SERVER.md`
- Local computer pairing, CLI discovery and tenant isolation: `docs/LOCAL_CLI_BRIDGE.md`
- Local CLI outbound connector: `public/giverny-bridge.mjs`
- AI model routing notes: `docs/AI_MODEL_ROUTING.md`
- AI feedback learning, style distillation and hour calibration: `docs/AI_LEARNING.md`
- AI hour-estimate complexity profile, retrieval, breakdown and calibration: `docs/AI_HOUR_ESTIMATE.md`
- AI milestone progress evidence, guardrails and correction calibration: `docs/AI_PROGRESS_ASSESSMENT.md`
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
- Agent answers use GFM rendering in `src/App.tsx`; attachment results are transported separately as typed `AgentResultAttachment` records so previews and source files remain verifiable UI actions instead of model-authored Markdown links.
- Agent chat requests prefer SSE. `src/worker.ts` emits verifiable trace/result/error events, while `AgentExecutionTimeline` progressively displays friendly actions and keeps machine tool markers hidden for evaluation and audit compatibility.
- Image attachment previews share `ImagePreviewReader`, which owns fit-to-window, 1:1, 25%-300% zoom and internal scrolling across Agent, progress, acceptance and file-library entry points.
- `agent_run_metrics` stores privacy-minimized Agent outcome metadata for the admin quality dashboard; evaluation-tagged traffic is retained separately and excluded from dashboard aggregates.
- `ai_learning_events` stores the auditable “source input → AI suggestion → final user result” loop. Writing style is distilled incrementally by context and design type; hour estimates use a separate observed-outcome calibration table.
- `/mcp` is a stateless Streamable HTTP server exposing only the shared read-tool registry. It requires a dedicated `mcp-read` access token that cannot authenticate to the website.
- `AGENT_WRITE_WORKFLOW` runs confirmed Agent writes as durable Cloudflare Workflow instances. The Worker caches each operation result in `agent_write_operations` for idempotent replay.
- `AGENT_ANALYSIS_WORKFLOW` runs long read-only analysis independently from chat requests. `agent_analysis_jobs` stores status and final reports; temporary source snapshots are cleared after completion.
- `agent_conversations` indexes cloud conversation Durable Objects; message bodies and structured approval/task cards remain in each Alice Agent SQLite database.
- The Agent task center uses persisted unread state. Cron creates deduplicated weekly digests, prior-month reviews, and overdue-risk reports; deep analysis also supports cross-task, batch-attachment, and trend workflows.
- Agent Runtime is Cloudflare-native only: `AliceAgent` Durable Object + Workflow + D1/R2 tools. The legacy Python Container fallback has been retired.
- Tenant model API keys are stored in `app_settings` encrypted with `AI_SETTINGS_SECRET`; future multi-tenant work should move the same config shape under tenant-scoped settings.
- Local CLI devices are paired to the authenticated `principal_id` and the current browser device key. `giverny-bridge.mjs` only makes outbound requests, while D1 stores pairings, devices, detected adapters and short-lived command records.
- Local CLI discovery/test/selection and `run / stream / cancel` routing are available. Normal chat and read-only business queries prefer the selected CLI on the current browser's paired computer; confirmed site writes, vision requests and unavailable local runtimes use cloud `AliceAgent`.

## Auth Notes

- Frontend login state is stored in `localStorage` key `designer-worklog-auth`.
- API authentication uses a same-origin HttpOnly session cookie. `localStorage` only remembers non-secret display state such as email and last known role.
- Legacy `x-admin-token` is removed from the frontend flow and should not be reintroduced.
- Sensitive local files under `handoff/` may contain real credentials; do not expose or commit them.

## Business Notes

- Tasks are not deletable in normal operation, including by admin.
- File deletion is allowed only for mistaken uploads and uses site-native confirmation.
- File library files come from task lifecycle uploads, not from a standalone library-first upload workflow.
- Task month filtering uses settlement month first, then falls back to the task start month.
- Task ordering is start date descending, then created time descending.
