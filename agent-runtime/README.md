# Giverny ADK Agent Runtime

独立的 Google ADK 2.x Python Agent Service。它是 Giverny 新的语义编排主链，不 import、不调用 LangGraph，也不使用关键词决定用户意图。

## 边界

- ADK Root Coordinator 负责理解完整问题、上下文与指代。
- 分域 Specialist 只看自己的 OpenAPI 工具集。
- Giverny Worker 仍是 D1/R2、角色权限、确认凭证、写入 Workflow 和审计的唯一权威边界。
- Runtime 只能看到 `confirmation=none` 和 `confirmation=preview` 能力，`signed-execute` 与 `system-only` 不会进入模型工具列表。
- 最终事实声明必须引用真实 `evidenceId`，然后同时通过确定性检查与独立 Evidence Auditor。

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

默认 Coordinator 为 `gemini-3.1-pro-preview`，Auditor 为 `gemini-3.5-flash`。可通过 `GIVERNY_COORDINATOR_MODEL` / `GIVERNY_AUDITOR_MODEL` 替换；带 provider 前缀的模型由 LiteLLM 适配。

## 测试

```bash
PYTHONPATH=. python -m unittest discover -s tests -v
```

`evals/semantic-cases.json` 是业务语义门禁的起点，它验收主体绑定、跨轮指代、版本维度、合理拒答和禁止产品帮助误路由。
