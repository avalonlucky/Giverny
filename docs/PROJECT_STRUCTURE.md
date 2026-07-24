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
│   ├── CLIENT_OBSERVABILITY.md
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
│   │   ├── aiBrands.ts
│   │   ├── aiModels.ts
│   │   ├── aiProviders.ts
│   │   ├── calendar.ts
│   │   ├── dateTime.ts
│   │   ├── designTypes.ts
│   │   ├── durationInput.ts
│   │   ├── fileMetadata.ts
│   │   ├── format.ts
│   │   ├── money.ts
│   │   ├── month.ts
│   │   ├── previewTimeout.ts
│   │   ├── pdfRuntime.ts
│   │   ├── psdPreview.ts
│   │   ├── taskSettlement.ts
│   │   └── timeEntryDraft.ts
│   ├── views/
│   │   ├── CalendarView.tsx
│   │   ├── DashboardView.tsx
│   │   ├── TasksView.tsx
│   │   ├── FilesView.tsx
│   │   ├── IncomeView.tsx
│   │   ├── KnowledgeView.tsx
│   │   └── SettingsView.tsx
│   ├── hooks/
│   │   ├── useAgentJobNotifications.ts
│   │   ├── useAppShortcuts.ts
│   │   ├── useAttachmentRuntime.ts
│   │   ├── useBackendRuntime.ts
│   │   ├── useDailyKnowledge.ts
│   │   ├── useSettingsOperations.ts
│   │   ├── useTaskActivity.ts
│   │   ├── useTaskOperations.ts
│   │   ├── useToastNotifications.ts
│   │   ├── useWorkspaceData.ts
│   │   └── useWorkspaceAnalytics.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── taskStore.ts
│   │   ├── taskRuntimeStore.ts
│   │   ├── fileStore.ts
│   │   ├── settingsStore.ts
│   │   ├── uiStore.ts
│   │   └── storeUtils.ts
│   ├── styles/
│   │   ├── tokens-theme.css
│   │   ├── shell-navigation.css
│   │   ├── dashboard-tasks.css
│   │   ├── task-management.css
│   │   ├── files-previews.css
│   │   ├── modals-core.css
│   │   ├── task-forms.css
│   │   ├── chat.css
│   │   ├── settings.css
│   │   ├── calendar-insights.css
│   │   ├── business-reports.css
│   │   ├── progress-responsive.css
│   │   └── knowledge-ai.css
│   ├── components/
│   │   ├── AppOverlayLayer.tsx
│   │   ├── AiBrandIcon.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── AppTopbar.tsx
│   │   ├── AttachmentHoverThumbnail.tsx
│   │   ├── DashboardTaskSidebar.tsx
│   │   ├── EmptyState.tsx
│   │   ├── MonthPicker.tsx
│   │   ├── NewTaskModal.tsx
│   │   ├── NewTaskDesignTypeSelector.tsx
│   │   ├── PendingAttachmentPreview.tsx
│   │   ├── TaskDetailModal.tsx
│   │   ├── TaskProgressModal.tsx
│   │   ├── DailyKnowledgeModal.tsx
│   │   ├── GivernySelect.tsx
│   │   └── VoiceScheduleButton.tsx
│   ├── types/
│   │   ├── agent.ts
│   │   ├── domain.ts
│   │   └── knowledge.ts
│   ├── App.css
│   ├── App.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── AdminRoute.tsx
│   │   ├── SharedReportRoute.tsx
│   │   └── SharedSettlementRoute.tsx
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

- Browser route tree, redirects and public/admin lazy boundaries: `src/router.tsx`, `src/routes/`
- Main admin shell, route-derived view composition and business orchestration: `src/App.tsx`
- Cross-view UI state and persisted view preferences: `src/stores/uiStore.ts`
- Authentication, role and access-token state: `src/stores/authStore.ts`
- Task, progress-update and settlement-report entities: `src/stores/taskStore.ts`
- Task activity, AI progress assessment and task-operation runtime state: `src/stores/taskRuntimeStore.ts`
- File entities and attachment-analysis state: `src/stores/fileStore.ts`
- Business settings, AI model configuration and backend status: `src/stores/settingsStore.ts`
- Workspace hydration, identity, settings data and backend synchronization: `src/hooks/useWorkspaceData.ts`
- Task, progress, acceptance, attachment and file write operations: `src/hooks/useTaskOperations.ts`
- Login, access-token, backup and administrator settings operations: `src/hooks/useSettingsOperations.ts`
- Command palette construction and global keyboard shortcuts: `src/hooks/useAppShortcuts.ts`
- Dashboard task presentation, menus, detail sidebar, daily knowledge and insights: `src/views/DashboardView.tsx`
- Shared dashboard, income and annual settlement analytics: `src/hooks/useWorkspaceAnalytics.ts`
- Daily knowledge cache, queue, fallback and background prefetch state: `src/hooks/useDailyKnowledge.ts`
- Agent background-job polling, transition notifications and read state: `src/hooks/useAgentJobNotifications.ts`
- Attachment AI-analysis polling and persistent preview backfill: `src/hooks/useAttachmentRuntime.ts`
- Backend slow-sync, online/offline and R2 usage refresh state: `src/hooks/useBackendRuntime.ts`
- Prioritized toast queue, expiry timers and dismissal state: `src/hooks/useToastNotifications.ts`
- Race-safe task activity timeline loading: `src/hooks/useTaskActivity.ts`
- Application navigation, account menu and storage status: `src/components/AppSidebar.tsx`
- Application title, month/calendar controls and global actions: `src/components/AppTopbar.tsx`
- Global modal, search, assistant, preview, toast and celebration composition: `src/components/AppOverlayLayer.tsx`
- Ordered CSS entry: `src/App.css`
- Design tokens and seasonal theme: `src/styles/tokens-theme.css`
- Domain style modules and ownership map: `src/styles/`, `docs/DESIGN.md`
- Client share page: `src/SharedReport.tsx`
- Lazy-loaded file library and file inspector: `src/views/FilesView.tsx`
- Lazy-loaded income and tax-estimate view: `src/views/IncomeView.tsx`
- Lazy-loaded settlement receipt, export and sharing view: `src/views/ReportsView.tsx`
- Lazy-loaded insights, risk review and hour calibration view: `src/views/InsightsView.tsx`
- Lazy-loaded settings and AI operations entry: `src/views/SettingsView.tsx`
- Lazy-loaded task calendar: `src/views/CalendarView.tsx`
- Lazy-loaded task management list and calendar entry: `src/views/TasksView.tsx`
- Shared date, holiday and lunar-calendar rules: `src/lib/dateTime.ts`, `src/lib/calendar.ts`
- Shared date and time input component: `src/components/PlanDateTimeField.tsx`
- Shared voice schedule recognition and start/end/duration review: `src/components/VoiceScheduleButton.tsx`
- Shared attachment hover thumbnail and document fallback preview: `src/components/AttachmentHoverThumbnail.tsx`
- Shared upload limits, attachment naming, image optimization worker and main-thread fallback: `src/lib/fileUpload.ts`
- Shared upload-time PDF, PSD, video and Office preview generation: `src/lib/attachmentPreview.ts`
- Shared lazy PDF runtime and worker initialization: `src/lib/pdfRuntime.ts`
- Shared task detail sidebar for dashboard and task management: `src/components/DashboardTaskSidebar.tsx`
- Shared four-density empty-state presentation: `src/components/EmptyState.tsx`, `src/styles/task-management.css`
- Shared task summary/detail modal: `src/components/TaskDetailModal.tsx`
- Progress, waiting, feedback and acceptance workflow modal: `src/components/TaskProgressModal.tsx`
- Shared month navigation and year/month picker: `src/components/MonthPicker.tsx`
- New/edit task form, requirement attachments, AI suggestions and voice scheduling: `src/components/NewTaskModal.tsx`
- Shared new-task design type selector: `src/components/NewTaskDesignTypeSelector.tsx`
- Shared pending progress attachment thumbnail and full preview: `src/components/PendingAttachmentPreview.tsx`
- Shared Agent background-analysis progress card: `src/components/AgentAnalysisTaskCard.tsx`
- Shared Agent attachment results and settlement receipt preview: `src/components/AgentAttachmentResults.tsx`
- Shared Agent write-preview editing and durable confirmation card: `src/components/AgentApprovalCard.tsx`
- Shared Agent task disambiguation choices: `src/components/AgentTaskSelectionCard.tsx`
- Shared progressive Agent execution trace: `src/components/AgentExecutionTimeline.tsx`
- Lazy-loaded work assistant conversation, projects, history, local CLI and task center: `src/components/ChatPanel.tsx`
- Shared prioritized toast queue and icon presentation: `src/lib/toastQueue.ts`, `src/components/ToastIcon.tsx`
- Browser render/resource/API error reporting and privacy-safe deduplication: `src/lib/clientErrorReporter.ts`
- Native real-user TTFB/FCP/LCP/INP/CLS reporting: `src/lib/clientPerformanceReporter.ts`
- Frontend observability storage, aggregation and alerting: `db/migrations/0028_client_error_observability.sql`, `db/migrations/0029_client_performance_observability.sql`, `docs/CLIENT_OBSERVABILITY.md`
- Shared editable-target and month keyboard shortcut rules: `src/lib/keyboardShortcuts.ts`
- Shared task timeline and partner-facing presentation rules: `src/lib/taskPresentation.ts`

## Heavy Dependency Boundaries

- Browser-heavy document runtimes (`pdfjs-dist`, `exceljs`, `html2canvas`, `ag-psd`, `docx-preview`, `pptx-preview`, `jszip`) must stay behind dynamic imports. Markdown rendering is allowed only inside the lazy work-assistant subtree.
- `vite.config.ts` uses Rolldown `codeSplitting.groups` with non-recursive dependency capture so heavy chunks cannot absorb shared JSX or preload helpers.
- `scripts/check-heavy-dependency-architecture.mjs` blocks source-level static import regressions; `scripts/check-heavy-dependency-build.mjs` checks the generated manifest, Dashboard static closure, initial preload list, feature reachability and PDF worker asset.
- `npm run build` always runs the generated-output guard after Vite, so a heavy dependency returning to the first screen blocks deployment.
- Shared task-list dates, due-state and design-type presentation rules: `src/lib/taskListPresentation.ts`
- Shared task history sample insights and accepted-task normalization: `src/lib/taskContextInsights.ts`
- Shared Agent task attachments, activity summaries and progress evidence: `src/lib/taskAssistantContext.ts`
- Shared AI suggestion learning classification: `src/lib/aiLearning.ts`
- Shared design-type group flattening and normalization: `src/lib/designTypeGroups.ts`
- Shared task time attribution, billing and reconciliation rules: `src/lib/taskAccounting.ts`, `scripts/test-task-accounting.mjs`
- Shared progress time draft, derivation and overlap rules: `src/lib/timeEntryDraft.ts`
- Shared duration input parsing and schedule derivation rules: `src/lib/durationInput.ts`
- Shared compact duration presentation: `src/lib/durationDisplay.ts`
- Shared AI provider/model rules: `src/lib/aiProviders.ts`, `src/lib/aiModels.ts`
- Shared AI brand and design-type rules: `src/components/AiBrandIcon.tsx`, `src/lib/aiBrands.ts`, `src/lib/designTypes.ts`
- Shared settings selector and daily knowledge reader: `src/components/GivernySelect.tsx`, `src/components/DailyKnowledgeModal.tsx`
- Frontend API client and auth headers: `src/lib/api.ts`
- PSD preview helper: `src/lib/psdPreview.ts`
- Worker API backend: `src/worker.ts`
- BAML AI function contracts: `baml_src/ai_assistants.baml`
- Generated BAML TypeScript client: `src/baml_client/baml_client/`
- Independent BAML Node runtime: `ai-runtime/`
- Cloudflare Agents SDK Runtime: `src/aliceAgent.ts`
- Shared Agent/MCP read-tool registry: `src/agentToolRegistry.ts`
- Deterministic cross-task portfolio query and regression guard: `query_task_portfolio` in `src/worker.ts`, `scripts/check-agent-portfolio-architecture.mjs`
- Shared Agent turn contract and deterministic verification: `src/agentOrchestrator.ts`
- Signed tenant/principal context for internal tools: `src/agentScope.ts`
- Durable background analysis workflow: `src/agentAnalysisWorkflow.ts`
- Durable confirmed-write workflow: `src/agentWriteWorkflow.ts`
- Agent regression suite and isolated quality gate: `agent-evals/`
- Desktop/mobile browser critical-flow gate: `tests/browser/critical-flows.spec.ts`
- Browser regression environment and projects: `playwright.config.ts`, `agent-evals/start-browser-eval.mjs`
- Main-entry size regression guard: `scripts/check-app-entry-size.mjs` (`App.tsx` maximum 1,000 lines)
- State-ownership regression guard: `scripts/check-state-architecture.mjs` (six Zustand stores; no cross-view `useState / useReducer` in `App` or workspace hydration)
- CSS architecture regression guard: `scripts/check-css-architecture.mjs` (`App.css` import-only; 13 ordered domains; 4,500-line module cap)
- Routing architecture regression guard: `scripts/check-routing-architecture.mjs` (single RouterProvider; no pathname regex dispatch; public share routes lazy-loaded)
- Deployment architecture regression guard: `scripts/check-deployment-architecture.mjs` (production deploy scripts must use Cloudflare HTTP API Direct Upload and must not invoke Wrangler)
- Empty-state architecture regression guard: `scripts/check-empty-state-architecture.mjs` (shared coverage baseline, four density levels, legacy TSX/CSS patterns and reduced-motion support)
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

- Frontend state is split into six Zustand business domains. Component-local form drafts remain local React state; cross-view UI and server-mirrored entities must use the appropriate store.
- Backend hydration commits auth, task, file and settings snapshots atomically by domain. The existing versioned 30-minute boot cache remains an acceleration layer, not a second source of truth.
- CSS keeps one public entry (`App.css`) while implementation rules live in 13 ordered business-domain modules under `src/styles/`. This preserves the existing global class contract and cascade while preventing another 25K-line stylesheet.
- React Router owns one declarative route tree for admin and public share pages. Route metadata selects the active admin view, while public reports and settlement receipts load through independent route chunks; root, legacy and unknown paths use explicit redirects.
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
