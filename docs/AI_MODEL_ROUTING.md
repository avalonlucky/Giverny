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
6. 附件上传后会在 D1 创建分析任务；Worker 从 R2 读取源文件，图片和 PDF 直接送入视觉模型，PPTX / DOCX / XLSX 先提取文字和内嵌图片，再把结构化结果写回 `attachment_analyses`。
7. 上传请求会立即尝试后台分析；每 5 分钟运行的 Cron 会继续处理待处理、失败未满 3 次以及长时间卡住的任务。

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
| 交付件识图 | Worker 附件分析任务 | 识图主模型 Gemini 3 Flash，失败后回退 Kimi K2.6；结果写入 D1 并供洞察页读取 |
| 异常侦查 | Worker 洞察诊断 | 文字主模型 DeepSeek，失败回退 Kimi K2.6；对比当前、上期、历史基线与历史洞察，结构化结果写入 D1 |
| 事件洞察 | Worker Cron | 先用 D1 规则判断异常，命中后再调用文字模型生成专项建议，并写入 `insights_history` |

## 对照式洞察

- Worker 会按当前周期、上一对照周期和同类型历史基线聚合任务数据，而不是只发送当期汇总。
- 数据包括实际 / 预估工时、预估偏差、加权结算时薪、交付周期、周期占用等待、明确等待小时、等待占比、附件质量问题、交付风险、修改信号及验收主观反馈。
- 修改信号来自进展记录中的“修改、调整、改稿、反馈、返工”等文字，是代理指标，不等同于用户手工确认的修改轮次。
- 主观反馈来自验收时的「顺利 / 一般 / 有问题」与原因标签，用于捕捉客观工时看不出的沟通成本、定价压力、需求不清或技术挑战。
- 等待占比来自任务从接受 / 预计开始到实际验收的总周期，并扣除可结算实际工时；手动「等待记录」会作为明确等待小时进入数据快照，但不参与结算。
- 每次诊断保存到 `insight_diagnoses`，包含数据指纹与结构化异常键。同一数据会直接复用已保存结果；新诊断会拿历史建议做去重，仅在问题未解决时继续提示。
- 每条可追踪建议会写入 `insights_history`，字段包括 `insight_type`、`finding`、`recommendation`、`data_snapshot` 和 `status`。后台事件触发器也写入同一张表。
- 当前事件触发器包括：同类任务修改信号偏高、同类任务等待占比偏高、月工时下降超过 20%、需求人综合时薪连续低于均值、设计类型超过 3 个月空缺、需求人主观问题标签集中。触发器先由 D1 数据规则判定，只有命中异常时才调用模型。

## 附件解析边界

- PNG / JPG / WEBP / GIF：读取 R2 源文件并直接进行视觉分析。
- PDF：18MB 以内使用 Gemini 原生 PDF 理解。当前 Kimi 备用路由只接受图片，因此 PDF 主模型失败且没有图片预览时会保留失败状态并等待重试。
- PPTX / DOCX / XLSX：35MB 以内在 Worker 中解压，提取 XML 文字和最多 6 张内嵌图片。当前能理解内容和素材，但不等同于完整渲染每一页 / 每一张幻灯片的最终版式。
- PSD / AI：有上传预览图时分析预览图；没有预览图时标记为暂不支持，提示补充 PNG / JPG 预览后重试。
- ZIP / RAR / 7Z、旧版 PPT / DOC / XLS 等格式当前不自动解包，不会生成没有依据的分析结论。

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
