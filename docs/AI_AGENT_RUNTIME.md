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
        └── get_giverny_context
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

当前 Worker 已预留接入路径：纯文本工作助手请求会优先调用 Cloudflare Container 里的 Agent Runtime；如果容器不可用，则尝试 `AGENT_RUNTIME_URL` 指向的外部 Runtime；如果仍不可用，则直接回退到原有本地逻辑。

这意味着代码层面的主链路已经接上；正式站默认使用 `DEEPSEEK_API_KEY`、`AGENT_TOOL_TOKEN` 与 `AGENT_RUNTIME_KEY`。`AI_RUNTIME_URL` 仍保留给 BAML runtime，不要复用到这个服务。

## 下一步

1. 本地配置 `DEEPSEEK_API_KEY` 和 `GIVERNY_AGENT_TOOL_TOKEN`，启动 `agent-runtime/`，用 `/v1/chat` 验证收入、工时、任务检索、任务详情等问题。
2. 通过 Cloudflare Containers 部署 `agent-runtime/`。
3. 在 Cloudflare Worker 配置 `DEEPSEEK_API_KEY`、`AGENT_TOOL_TOKEN` 和 `AGENT_RUNTIME_KEY`，部署正式站供验收。
4. 改造爱丽丝工作助手 UI：
   - 用户消息保持圆角填充。
   - AI 正文无卡片背景。
   - trace 默认折叠，只展示“运行完成 N 步 / N 秒”。
   - 展开后展示工具调用时间线。
5. 用户确认满意后，再完成 GitHub commit、tag 和 Release。

## 安全边界

- 不把任何模型密钥或工具 token 写入代码。
- `agent-runtime/.env` 必须保持未跟踪。
- 前端不可直接调用 `agent-runtime/`；生产环境应由 Cloudflare Worker 代理，并用 `AGENT_RUNTIME_KEY` 保护 runtime。
- 如果密钥曾出现在截图、聊天记录或公开页面，应先轮换再上线。
