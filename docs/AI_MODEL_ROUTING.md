# AI Model Routing

## 当前状态

Giverny 已引入 BAML 工程结构，并新增独立 Node.js AI Runtime：

- `baml_src/ai_assistants.baml`：维护 AI 功能的结构化输入、输出类型和提示词契约。
- `src/baml_client/baml_client/`：由 `baml-cli generate` 生成的 TypeScript 客户端。
- `ai-runtime/`：独立 Node.js 服务，负责真正运行 BAML client。
- `ai-runtime/src/baml_client/baml_client/`：由 `baml-cli generate` 同步生成的 runtime 专用客户端。
- `npm run baml:generate`：重新生成 BAML 客户端。
- `npm run build`：会先执行 `baml:generate`，再执行 TypeScript 和 Vite 构建。

Cloudflare Worker 仍不直接 import `@boundaryml/baml` runtime。原因是 BAML TypeScript runtime 会依赖 Node 原生 `.node` 模块，Cloudflare Workers 当前无法直接打包该 runtime。Wrangler dry-run 已验证：直接在 Worker 中 import BAML runtime 会因为原生模块打包失败。

因此当前架构定位是：

1. BAML 作为提示词、输出 schema 和生成客户端的主契约。
2. 独立 `ai-runtime/` 在 Node.js 环境里运行 BAML client。
3. Cloudflare Worker 负责鉴权、模型设置、密钥解密、历史数据查询和请求转发。
4. 如果 BAML Runtime 未配置或请求失败，Worker 会回退 DeepSeek 直连，继续通过 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 保证线上可用。
5. 文字和识图模型已拆成主 / 备用两组：文字主路默认 DeepSeek，文字备用默认 Kimi K2.6；识图主路默认 Gemini 3 Flash，识图备用默认 Kimi K2.6。

## 为什么现在仍然要引入 BAML

多租户版本需要让不同用户选择不同模型。提前引入 BAML 的价值在于：

- 把 AI 功能从散落的 prompt 文案，逐步收敛为结构化函数。
- 明确每个 AI 功能的输出类型，减少后续多模型切换时的解析差异。
- 为后续 AI runtime 服务、模型路由、A/B 测试和租户级模型配置保留一致接口。

## 后续多租户推荐路线

### 阶段 1：BAML 契约层

- Worker 继续直连 DeepSeek，保证线上稳定。
- 所有 AI prompt 和输出契约同步维护在 BAML 文件中。
- 每次修改 BAML 后运行 `npm run baml:generate`，构建时也会自动执行。

### 阶段 2：AI Runtime 服务（当前已落地）

新增 `ai-runtime/` Node.js 服务，用于真正运行 BAML client：

- Cloudflare Worker 只负责鉴权、租户配置、数据查询、密钥解密和请求转发。
- AI Runtime 只接收本次调用的模型配置，调用 BAML client。
- 租户可选择 DeepSeek、OpenAI、OpenRouter、Claude 兼容网关等。
- Runtime API：
  - `GET /health`
  - `POST /v1/suggest-task`
  - `POST /v1/optimize-text`
  - `POST /v1/suggest-hours`

### 阶段 3：租户级模型设置（单租户配置已落地）

设置页已新增 AI 模型配置：

- 默认模型供应商
- BAML Runtime URL
- Base URL
- 模型名称
- 每个租户自己的 API Key
- 文字主模型 / 文字备用模型
- 识图主模型 / 识图备用模型
- 每一路模型的测试按钮

当前仍存放在全站 `app_settings.aiModelConfig`。多租户上线时，把这个配置移动到 tenant-scoped setting 即可。

下一阶段可继续扩展：

- 不同功能使用不同模型，例如新建任务需求优化、进展文案优化、验收备注优化、工时建议。
- 平台托管 Key 与租户自带 Key 并存。
- 模型调用日志、失败回退和用量统计

## 当前 AI 功能映射

| 功能 | BAML 函数 | 当前生产适配器 |
|------|-----------|----------------|
| 新建任务需求优化 | `SuggestTaskAssistant` | BAML Runtime 优先，失败回退 DeepSeek direct，再失败回退文字备用模型 |
| 进展 / 验收文案优化 | `OptimizeTaskText` | BAML Runtime 优先，失败回退 DeepSeek direct，再失败回退文字备用模型 |
| 工时建议 | `SuggestHourEstimate` | BAML Runtime 优先，失败回退 DeepSeek direct，再失败回退文字备用模型 |
| 交付件识图 | 后续新增 | 识图主模型 Gemini 3 Flash，失败后回退 Kimi K2.6；当前先完成模型配置和测试入口 |

## 密钥与安全

- 租户模型 API Key 由 Worker 使用 `AI_SETTINGS_SECRET` 加密后写入 D1。
- 前端只显示 `hasApiKey` 和 `apiKeyPreview`，不会返回明文 API Key。
- Runtime 与 Worker 之间使用 `AI_RUNTIME_KEY` 请求头鉴权。
- 生产环境保存租户 API Key 前必须配置 `AI_SETTINGS_SECRET`。
- 平台默认 Gemini / Kimi Key 应优先写入 Cloudflare Secret：`GEMINI_API_KEY`、`KIMI_API_KEY`，避免进入前端或 Git 仓库。

## 注意事项

- 不要在当前 Cloudflare Worker 中直接 import `src/baml_client/baml_client` 或 `@boundaryml/baml` runtime；这会导致 Worker 打包失败。
- BAML 生成文件可以提交到仓库，便于类型检查、代码审查和 AI Runtime 复用。
- 如果 BAML 官方后续提供 Worker/WASM runtime，可重新评估是否直接在 Worker 中运行。
