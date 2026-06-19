# AI Model Routing

## 当前状态

Giverny 已引入 BAML 工程结构：

- `baml_src/ai_assistants.baml`：维护 AI 功能的结构化输入、输出类型和提示词契约。
- `src/baml_client/baml_client/`：由 `baml-cli generate` 生成的 TypeScript 客户端。
- `npm run baml:generate`：重新生成 BAML 客户端。
- `npm run build`：会先执行 `baml:generate`，再执行 TypeScript 和 Vite 构建。

当前正式 Worker 仍使用现有 DeepSeek 直连适配器处理线上 AI 请求，原因是 `@boundaryml/baml` TypeScript runtime 会依赖 Node 原生 `.node` 模块，Cloudflare Workers 当前无法直接打包该 runtime。Wrangler dry-run 已验证：直接在 Worker 中 import BAML runtime 会因为原生模块打包失败。

因此，本阶段的定位是：

1. BAML 先作为提示词、输出 schema 和生成客户端的主契约进入项目。
2. 线上 Cloudflare Worker 暂不直接加载 BAML runtime，避免影响正式站稳定性。
3. DeepSeek 仍是当前生产运行适配器，继续通过 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 配置。

## 为什么现在仍然要引入 BAML

多租户版本需要让不同用户选择不同模型。提前引入 BAML 的价值在于：

- 把 AI 功能从散落的 prompt 文案，逐步收敛为结构化函数。
- 明确每个 AI 功能的输出类型，减少后续多模型切换时的解析差异。
- 为后续 AI runtime 服务、模型路由、A/B 测试和租户级模型配置保留一致接口。

## 后续多租户推荐路线

### 阶段 1：当前版本

- Worker 继续直连 DeepSeek，保证线上稳定。
- 所有 AI prompt 和输出契约同步维护在 BAML 文件中。
- 每次修改 BAML 后运行 `npm run baml:generate`，构建时也会自动执行。

### 阶段 2：AI Runtime 服务

新增一个 Node.js runtime 或 AI Gateway 服务，用于真正运行 BAML client：

- Cloudflare Worker 只负责鉴权、租户配置、数据查询和请求转发。
- AI Runtime 负责读取租户模型配置，调用 BAML client。
- 租户可选择 DeepSeek、OpenAI、OpenRouter、Claude 兼容网关等。

### 阶段 3：租户级模型设置

在设置页新增模型配置：

- 默认模型供应商
- 不同功能使用不同模型，例如：
  - 新建任务需求优化
  - 进展文案优化
  - 验收备注优化
  - 工时建议
- 每个租户自己的 API Key 或平台托管 Key
- 模型调用日志、失败回退和用量统计

## 当前 AI 功能映射

| 功能 | BAML 函数 | 当前生产适配器 |
|------|-----------|----------------|
| 新建任务需求优化 | `SuggestTaskAssistant` | DeepSeek direct |
| 进展 / 验收文案优化 | `OptimizeTaskText` | DeepSeek direct |
| 工时建议 | `SuggestHourEstimate` | DeepSeek direct |

## 注意事项

- 不要在当前 Cloudflare Worker 中直接 import `src/baml_client/baml_client` 或 `@boundaryml/baml` runtime；这会导致 Worker 打包失败。
- BAML 生成文件可以提交到仓库，便于类型检查、代码审查和后续 AI Runtime 复用。
- 如果 BAML 官方后续提供 Worker/WASM runtime，可重新评估是否直接在 Worker 中运行。
