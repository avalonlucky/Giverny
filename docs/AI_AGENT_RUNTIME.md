# AI Agent Runtime

本文记录 Giverny 工作助手从外部编排验证流转向自建 Agent Runtime 的长期方案。Dify 验证链路已移除，后续不再作为站内工作助手主链路。

## 为什么移除外部编排验证

前期外部编排验证的价值是快速确认“模型能否调用 Giverny 的真实接口并回答收入、工时、任务问题”，不用先写完整后端 Runtime。

这一步已经证明了两件事：

- Giverny Worker 暴露的工具接口可以返回真实业务数据。
- 只把大模型 API 接到前端不够，必须有工具调用、过程追踪和稳定的数据边界。

但这条路线在当前场景里暴露了限制：OpenAPI schema 导入、鉴权、节点变量、`<think>` 输出和 UI 调试都容易卡住。它适合验证价值，不适合作为 Giverny 长期不可控的核心链路。

## 正式方向

长期方案改为项目自有的 `agent-runtime/`：

```text
React UI / Cloudflare Worker
        │
        ▼
agent-runtime/  (DeepSeek/OpenAI-compatible Tool Calls)
        │
        ├── query_month_finance
        ├── search_tasks
        ├── get_task_detail
        ├── get_giverny_context
        ├── create_task_preview / create_task
        ├── record_feedback_preview / record_feedback
        ├── update_task_status_preview / update_task_status
        ├── update_task_fields_preview / update_task_fields
        └── append_progress_preview / append_progress
        │
        ▼
Giverny Worker Tool API
        │
        ▼
D1 / R2 / app data
```

选择自建 Runtime 的原因：

- 代码可控：提示词、工具、模型和安全边界都在仓库里版本化。
- 易测试：可以为每个工具、每类问题写自动化测试。
- 能扩展：后续可以加入多 Agent、文件理解、浏览器操作、知识库检索、长期记忆。
- 可替换：运行时可以逐步接入 OpenAI、DeepSeek、Gemini、豆包或本地模型，而不是被外部节点 UI 绑定。
- 可观测：返回 `trace`，前端可以折叠展示“理解问题 → 调用工具 → 汇总结果”，避免把原始思考直接暴露在正文里。

## 当前已落地

- `agent-runtime/app/main.py`：FastAPI 服务，提供 `/health` 和 `/v1/chat`，默认用 DeepSeek OpenAI-compatible Tool Calls。
- `agent-runtime/app/giverny_tools.py`：封装 Giverny Worker 工具接口。
- `agent-runtime/app/schemas.py`：定义请求、回答和 trace 数据结构。
- `agent-runtime/.env.example`：本地环境变量模板。
- `agent-runtime/README.md`：本地启动和测试说明。
- `src/worker.ts`：`/api/ai/chat` 已预留 Agent Runtime 主链路。
- `/api/agent/tools/*`：提供只读工具与写入工具。写入工具统一采用 preview/execute 两段式协议，execute 必须携带 preview 生成的 `confirmationToken`。

当前 Worker 已接入路径：纯文本工作助手请求会优先调用 Cloudflare Container 里的 Agent Runtime；如果容器不可用，则尝试 `AGENT_RUNTIME_URL` 指向的外部 Runtime。涉及工作数据或写入意图时，Runtime 不可用会显式报错，避免旧模板伪装成智能体。

这意味着代码层面的主链路已经接上；正式站默认使用 `DEEPSEEK_API_KEY`、`AGENT_TOOL_TOKEN` 与 `AGENT_RUNTIME_KEY`。`AI_RUNTIME_URL` 仍保留给 BAML runtime，不要复用到这个服务。

## 下一步

1. 为写入工具补充更细的端到端测试：创建任务、记录反馈、修改状态、修改字段、追加进展。
2. 将确认体验从纯文本升级为站内确认卡片，明确展示草稿 diff、风险提示和“确认执行”按钮。
3. 扩展更多低风险工具，例如等待记录、验收附件标记、结算草稿预览。
4. 用户确认满意后，再完成 GitHub commit、tag 和 Release。

## 安全边界

- 不把任何模型密钥或工具 token 写入代码。
- `agent-runtime/.env` 必须保持未跟踪。
- 前端不可直接调用 `agent-runtime/`；生产环境应由 Cloudflare Worker 代理，并用 `AGENT_RUNTIME_KEY` 保护 runtime。
- 写入工具必须先 preview，再 execute；execute 的 `confirmationToken` 由 Worker 使用服务端密钥签名，默认 10 分钟有效。
- Agent 不开放删除、作废、结算锁定、部署等高风险操作。
- 如果密钥曾出现在截图、聊天记录或公开页面，应先轮换再上线。
