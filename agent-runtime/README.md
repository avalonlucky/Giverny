# Giverny ADK Agent Runtime

独立的 Google ADK 2.x Python Agent Service。它是 Giverny 新的语义编排主链，不 import、不调用 LangGraph，也不使用关键词决定用户意图。

## 边界

- ADK Root Coordinator 负责理解完整问题、上下文与指代。
- 分域 Specialist 只看自己的 OpenAPI 工具集。
- Giverny Worker 仍是 D1/R2、角色权限、确认凭证、写入 Workflow 和审计的唯一权威边界。
- Runtime 只能看到 `confirmation=none` 和 `confirmation=preview` 能力，`signed-execute` 与 `system-only` 不会进入模型工具列表。
- 最终事实声明必须引用真实 `evidenceId`，然后同时通过确定性检查与独立 Evidence Auditor。

## 接口

- `GET /health`：就绪状态与模型配置。
- `POST /v1/chat`：一次性返回完整结果。仅供隔离评测与没有 trace sink 的调用方使用。
- `POST /v1/chat/stream`：**生产对话使用这个端点。** SSE 逐帧下发 `accepted` -> 若干 `step` / `thinking` -> `result`（失败时为 `error`），空闲超过 10 秒下发 `: keep-alive` 注释帧。
  编排要跑 60–150 秒，如果这段时间不产生字节，Cloudflare 会掐断 Worker 的子请求并合成 HTTP 520，把已经算好的答案丢掉。
  `step.detail` 是给终端用户看的自然语言，由 OpenAPI `summary` 派生（`search_attachments` -> `正在搜索任务附件`）；查不到 summary 时回落为「正在查阅业务数据」，**绝不下发原始 operationId**，专家委派（`transfer_to_agent`）也不下发。

  `thinking.detail` 是模型正在生成的推理内容，来自 `types.Part.thought`（Coordinator 以 `StreamingMode.SSE` 运行，因此长阶段内部也持续有反馈）。
  **推理内容与答案是两类 part，必须分开。** `_content_text()` 只取非 thought part 作为草稿，`_thought_text()` 只取 thought part 用于展示。
  混在一起会有两个后果：推理过程被当成草稿送进 formatter；以及未过 claim/evidence 校验与 Evidence Auditor 的结论提前露面。推理内容可以展示是因为它是过程而非结论。

## 本地运行

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

export ADK_RUNTIME_KEY=dev-runtime-key
export GIVERNY_TOOL_TOKEN=...
export GIVERNY_TOOL_BASE_URL=https://mayeai.com
export GOOGLE_GENAI_USE_VERTEXAI=TRUE
export GOOGLE_CLOUD_PROJECT=...
export GOOGLE_CLOUD_LOCATION=global

.venv/bin/uvicorn app.main:app --reload --port 8080
```

Runtime 没有隐藏的默认 Gemini。每个请求必须携带设置中选择的精确 `selectedModel(provider/model/baseUrl)`；Scope Supervisor、Coordinator、专家、Formatter 与 Auditor 全部使用该模型。非 Gemini 供应商由窄范围 LiteLLM 适配，任何缺失或不一致都失败关闭，不会切换到备用模型。API Key 只在内存中构造适配器，不写入 trace 或响应。

每个外层请求最多调用模型 7 次：Supervisor 1 次、Coordinator 与专家合计 4 次、Formatter 1 次、Auditor 1 次。回包固定声明 `modelCallLimit: 7`，Worker 会核验；不要恢复 Google ADK 默认的 500 次调用预算。

真实供应商回归、付费基础设施变更或其他可能产生费用的操作，必须先取得项目所有者对供应商、最大调用量和费用范围的明确批准；默认只运行本地单元测试、静态架构守卫和不调用模型的 `/health` 检查。生产 Runtime 位于现有 DMIT VPS，Google Cloud Run 与 Gemini 不作为隐藏依赖。

## 测试

```bash
PYTHONPATH=. python -m unittest discover -s tests -v
```

`evals/semantic-cases.json` 是业务语义门禁的起点，它验收主体绑定、跨轮指代、版本维度、合理拒答和禁止产品帮助误路由。
