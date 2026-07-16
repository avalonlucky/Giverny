# AI Agent Runtime

本文记录 Giverny 工作助手从外部编排验证流转向自建 Agent Runtime 的长期方案。Dify 验证链路已移除，后续不再作为站内工作助手主链路。

## 为什么移除外部编排验证

前期外部编排验证的价值是快速确认“模型能否调用 Giverny 的真实接口并回答收入、工时、任务问题”，不用先写完整后端 Runtime。

这一步已经证明了两件事：

- Giverny Worker 暴露的工具接口可以返回真实业务数据。
- 只把大模型 API 接到前端不够，必须有工具调用、过程追踪和稳定的数据边界。

但这条路线在当前场景里暴露了限制：OpenAPI schema 导入、鉴权、节点变量、`<think>` 输出和 UI 调试都容易卡住。它适合验证价值，不适合作为 Giverny 长期不可控的核心链路。

## 正式方向

正式主链路已经迁移到 Cloudflare Agents SDK：

```text
React UI / Cloudflare Worker `/api/ai/chat`
        │
        ▼
AliceAgent Durable Object
        ├── Agent SQLite 会话历史
        ├── DeepSeek / OpenAI-compatible AI SDK
        ├── 类型化工具调用与执行轨迹
        └── 持久待确认写入状态
        │
        ├── query_month_finance
        ├── search_tasks
        ├── search_attachments
        ├── get_task_detail
        ├── get_giverny_context
        ├── create_task_preview / create_task
        ├── record_feedback_preview / record_feedback
        ├── update_task_status_preview / update_task_status
        ├── update_task_fields_preview / update_task_fields
        ├── append_progress_preview / append_progress
        ├── start_monthly_review
        └── start_deep_analysis
        │
        ▼
Giverny Worker Tool API
        │
        ▼
D1 / R2 / app data
```

选择 Cloudflare 原生 Runtime 的原因：

- 代码可控：提示词、工具、模型和安全边界都在仓库里版本化。
- 会话持久：每个对话映射到独立 Durable Object，历史和待确认动作可跨请求恢复。
- 部署收敛：Agent 与业务 Worker 使用同一套 TypeScript / Wrangler 发布链，不再要求 Python 容器参与主请求。
- 易测试：可以为每个工具、确认策略和每类问题写自动化测试。
- 能扩展：后续可以加入 Workflows、文件理解、浏览器操作、知识库检索和长期记忆。
- 可替换：运行时可以逐步接入 OpenAI、DeepSeek、Gemini、豆包或本地模型，而不是被外部节点 UI 绑定。
- 可观测：返回 `trace`，前端可以折叠展示“理解问题 → 调用工具 → 汇总结果”，避免把原始思考直接暴露在正文里。

## 当前已落地

- `src/aliceAgent.ts`：Cloudflare Agents SDK Runtime，负责持久会话、类型化 Tool Calling、确认状态和执行轨迹。
- `src/worker.ts`：`/api/ai/chat` 按 `agentRuntimeConversationId` 路由到对应 `AliceAgent`，并返回稳定的旧接口响应。
- `src/App.tsx`：历史对话以云端为主、本地缓存兜底；旧浏览器历史首次打开时自动迁移，任务中心统一展示后台分析与未读结果。
- Agent 回答界面：正文使用 GFM 富文本渲染；附件查询返回独立结构化文件卡，支持缩略图、任务归属、格式、大小、预览和打开，不依赖模型在 Markdown 中拼接内部文件地址。
- `/api/agent/tools/*`：提供只读工具与写入工具。写入工具统一采用 preview/execute 两段式协议，execute 必须携带 preview 生成的 `confirmationToken`。
- 前端确认卡：Tool Calling 生成的写入草稿通过结构化 `approval` 协议展示，用户可直接核对并确认或取消；签名 token 始终只保存在 Agent SQLite，不下发浏览器。
- 任务消歧：标题检索命中多个任务时返回结构化候选卡，用户选择明确任务 ID 后再继续读取或生成写入预览，模型不得猜测。
- 确认体验：字段修改展示原值与新值；创建任务草稿可在确认卡内修订；执行成功后可直接打开对应任务。
- `agent-evals/`：79 条固定回归用例覆盖查询、附件搜索、完整任务生命周期写入、持续计划、任务记忆、同名消歧、六类后台分析和安全边界。
- Agent 运行质量：管理员可在“设置 → AI”查看 7/30 天成功率、工具调用、P95 耗时、确认/消歧/回退与近期失败；只记录意图、工具名、耗时和结果，不保存问题、回答、任务标题或操作草稿。
- AI 反馈学习：任务需求、名称、分类、进展、修改意见、验收备注和附件命名会记录“原始输入 → AI 建议 → 最终人工结果”及采用动作；工时继续以验收后的真实投入做偏差校准。详见 `docs/AI_LEARNING.md`。
- 隔离评测：匿名夹具、临时 D1、模拟 OpenAI-compatible 模型和分类阈值组成发布门禁；评测流量带独立标记并从正式统计中排除。
- 远程 MCP：`/mcp` 使用 Streamable HTTP 暴露五个只读工具，与爱丽丝共用 `src/agentToolRegistry.ts`；其中 `search_attachments` 返回可验证的结构化附件元数据和受权限保护的源文件/预览路径。MCP 仅接受独立的 `MCP 只读`口令，该口令不能登录网站或访问写入工具。
- 持久写入：创建、字段 / 状态修改、反馈、进展、等待、单条记录维护、验收文件和完整验收等确认操作均由 `AgentWriteWorkflow` 等待人工批准后执行；步骤支持重试，`agent_write_operations` 缓存完成结果，重复恢复不会重复写入。
- 命令式任务链：当前可在同一会话内连续完成创建任务、修改字段 / 状态、记录甲方反馈、追加进展 / 工时、记录等待、编辑或删除单条既有记录、把已有附件标记为验收文件，以及通过原子化验收包完成最终验收。每次写入都必须独立预览和确认。用户电脑中的新文件仍需先通过网站上传；整任务删除 / 作废 / 恢复、结算锁定、付款和部署不开放为 Agent 工具，因此不是无确认、全权限的无人值守自动化。
- 后台分析：月度复盘、周报、风险提示、跨任务专题、批量附件和趋势分析由 `AgentAnalysisWorkflow` 独立收集 D1 权威数据并生成报告；对话卡与任务中心展示真实进度，支持取消、失败重试和持久未读通知。原始快照在成功后清除，只保留最终报告。
- 主动 Agent：Cron 按周期创建周报、上月复盘和逾期风险提示，D1 去重键保证同一周期只生成一次。
- 持续计划：`agent_task_plans` 保存跨会话目标和步骤；确认写入完成后按 action 自动推进对应步骤，计划与提醒统一进入 Agent 任务中心。
- 任务记忆：`agent_task_memories` 按任务压缩需求、近期进展、反馈偏好和未解决事项；每次相关写入后刷新，回答前仍以任务详情为权威数据。
- 主动提醒：每天 9 点检查逾期、100% 未验收、实际工时超预估 25%、存在等待及已有验收文件但缺少备注等信号。
- 失败学习：匿名失败按权限、冲突 / 过期确认、超时、Workflow、工具、Runtime / 模型和意图校验分类；同一指纹出现两次后自动升级为必补回归类别，不保存用户问题或业务内容。
- 单一 Runtime：旧 Python/FastAPI Container、`AGENT_RUNTIME_CONTAINER`、`AGENT_RUNTIME_URL` 和 `AGENT_RUNTIME_KEY` 已移除，生产只保留 Cloudflare `AliceAgent` Durable Object 主链路。

当前 Worker 已接入路径：纯文本工作助手请求调用 `ALICE_AGENT` Durable Object；涉及工作数据或写入意图且 Runtime 不可用时显式报错，避免旧模板伪装成智能体。

正式站主链路使用 `DEEPSEEK_API_KEY` 与 `AGENT_TOOL_TOKEN`；`AI_RUNTIME_URL` 仍只用于 BAML runtime，与 Agent 无关。

## 下一步

1. 外部 MCP 使用者扩展到多人或第三方组织前，接入 OAuth 2.1 动态客户端注册、授权同意页与细粒度 scopes。
2. 根据匿名运行指标补充失败场景，并在真实模型或提示词升级时额外执行受控在线评测。
3. 依据匿名失败指纹持续扩充评测集，并观察计划完成率、主动提醒处理率和确认卡修改率。

## 安全边界

- 不把任何模型密钥或工具 token 写入代码。
- 前端不可绕过 `/api/ai/chat` 直接调用 Agent 或业务工具。
- 写入工具必须先 preview，再 execute；execute 的 `confirmationToken` 由 Worker 使用服务端密钥签名，默认 10 分钟有效。
- 模型只拥有 preview 工具；confirmation token 保存在 Agent SQLite 中，不进入模型输出和前端响应。
- preview 会启动等待批准的 Workflow；确认后 Workflow 才能进入执行步骤，同一 operationId 的成功结果可安全重放。
- Agent 只开放单条进展、反馈和等待记录的确认后删除；整任务删除 / 作废 / 恢复、结算锁定、付款和部署等高风险操作不开放。
- MCP 只开放共享注册表中的五个只读工具；MCP 口令不得用于网站登录，站内访问口令也不得调用 MCP。
- 如果密钥曾出现在截图、聊天记录或公开页面，应先轮换再上线。
