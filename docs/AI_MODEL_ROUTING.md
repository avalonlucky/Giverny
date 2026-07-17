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
7. 上传请求会立即进入 Cloudflare Queue；暂时性失败由队列最多重试 3 次，每 5 分钟运行的 Cron 继续处理遗漏、失败未满 3 次以及长时间卡住的任务。明确不支持的文件不会无意义重试。
8. 前端只轮询仍处于待处理 / 处理中状态的分析，结果完成或失败后自动更新，不需要重新打开页面。

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
- 租户可选择 DeepSeek、豆包、通义千问、Kimi、OpenAI、OpenRouter、Claude 兼容网关等。
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
- 按当前未保存配置调用供应商 `/models` 的模型发现按钮
- 供应商官方 API Key 控制台入口

当前仍存放在全站 `app_settings.aiModelConfig`。多租户上线时，把这个配置移动到 tenant-scoped setting 即可。

模型发现不会读取另一家供应商的旧配置。前端会把当前表单中的供应商、Base URL、模型名和本次输入的 API Key 一并提交给 Worker；Worker 优先使用本次输入的 Key，其次才使用同一供应商已保存的 Key 或环境变量。豆包候选只保留 `doubao-*`，通义千问只保留 `qwen*` / `qwq*`，并把实际响应供应商返回给前端做二次一致性校验。

下一阶段可继续扩展：

- 不同功能使用不同模型，例如新建任务需求优化、进展文案优化、验收备注优化、工时建议。
- 平台托管 Key 与租户自带 Key 并存。
- 模型调用日志、失败回退和用量统计

## 当前 AI 功能映射

工作助手中的手动模型选择是当前站点的运行时最高优先级，不只影响这一轮聊天。选择通义千问、豆包、Kimi、Gemini、OpenAI、OpenRouter 或其他已配置模型后，工作助手规划与回答、新建任务需求优化、进展 / 验收备注、AI 工时、整体进度、洞察诊断和附件命名等文字能力都会先调用所选模型；失败后才进入设置中的文字主模型、文字备用模型和 Workers AI 回退链路。

若所选端点支持多模态输入，站内识图能力也会先使用同一模型，再回退识图主 / 备用模型。不支持识图的文字模型不会覆盖视觉路线。选择「自动」会清除运行时覆盖，恢复本机 CLI、站内 Agent 与模型设置的自动分流。运行时选择独立保存在设置中，不会改写文字主 / 备用、识图主 / 备用的长期配置；站内写入始终由 Worker 做权限校验和确认。

当前版本仍是单租户配置，管理员在工作助手中切换后会影响当前站点的 AI 路由。未来开放多租户时，该运行时选择必须按租户与登录主体隔离，不能继续使用全局设置。

| 功能 | BAML 函数 | 当前生产适配器 |
|------|-----------|----------------|
| 新建任务需求优化 | `SuggestTaskAssistant` | BAML Runtime 优先，失败回退 DeepSeek direct，再失败回退文字备用模型 |
| 进展 / 验收文案优化 | `OptimizeTaskText` | BAML Runtime 优先，失败回退 DeepSeek direct，再失败回退文字备用模型 |
| 工时建议 | `SuggestHourEstimate` | 稳健统计基线 + BAML Runtime 解释微调，失败回退文字主 / 备用模型，最终保留纯统计建议 |
| 交付件识图 | Worker 附件分析任务 | 识图主模型 Gemini 3 Flash，失败后回退 Kimi K2.6；PDF 回退时使用首页预览图，结果写入 D1 并供洞察页读取 |
| 异常侦查 | Worker 洞察诊断 | 文字主模型 DeepSeek，失败回退 Kimi K2.6；对比当前、上期、历史基线与历史洞察，结构化结果写入 D1 |
| 事件洞察 | Worker Cron | 先用 D1 规则判断异常，命中后再调用文字模型生成专项建议，并写入 `insights_history` |

## 工时预估口径

- 工时仅代表设计师实际投入；预计开始到交付之间的自然时间差只作为排期背景，不能直接换算为工作时长。
- 权威样本只取已验收且存在实际工时的任务。精确同类型权重最高，Vectorize 需求语义相似任务次之；只有两者合计少于 3 条时才使用少量同大类任务弱补位。
- 系统先为当前任务和历史样本生成同一套复杂度画像，再按“类型关系 + 语义相似 + 画像相似 + 同一需求人”重排候选，计算加权中位数、P25 和 P80。
- 画像包含从零 / 复用、交付件数量、页数、内容准备、尺寸适配、专项处理、改稿与加急风险；模型只能依据这些证据做有限解释微调。
- 页面同时返回“常规预估”和“稳妥预留”。置信度由样本量、语义相似度和分布离散程度校准，模型只能降低、不能抬高数据置信度。
- 常规预估会拆分为核心设计、内容整理、版本适配、专项处理、沟通改稿和交付整理；缺失的任务范围会转成澄清问题。
- 同一需求人至少积累 3 条完整结果后，系统才参考其历史实际 / 预估偏差、平均改稿轮次和需求完整率，并把系数限制在合理范围内。
- 无可信历史样本时保留用户当前手工预估，并增加 0.5 小时稳妥余量，不会拿全站无关任务或自然日期跨度硬算。
- 每次建议写入 `hour_estimate_suggestions`；`basis_json` 保存当时的画像、拆分、澄清问题、需求人校准和参考任务快照。任务创建后关联最终选定工时，实际工时变化与验收时继续回写。

## 对照式洞察

- Worker 会按当前周期、上一对照周期和同类型历史基线聚合任务数据，而不是只发送当期汇总。
- 数据包括实际 / 预估工时、预估偏差、加权结算时薪、交付周期、周期占用等待、明确等待小时、等待占比、附件质量问题、交付风险、修改信号及验收主观反馈。
- 修改信号来自进展记录中的“修改、调整、改稿、反馈、返工”等文字，是代理指标，不等同于用户手工确认的修改轮次。
- 主观反馈来自验收时的「顺利 / 一般 / 有问题」与原因标签，用于捕捉客观工时看不出的沟通成本、定价压力、需求不清或技术挑战。
- 等待占比来自任务从接受 / 预计开始到实际验收的总周期，并扣除可结算实际工时；手动「等待记录」会作为明确等待小时进入数据快照，但不参与结算。
- 每次诊断保存到 `insight_diagnoses`，包含数据指纹与结构化异常键。同一数据会直接复用已保存结果；新诊断会拿历史建议做去重，仅在问题未解决时继续提示。
- 每条可追踪建议会写入 `insights_history`，字段包括 `insight_type`、`finding`、`recommendation`、`data_snapshot` 和 `status`。后台事件触发器也写入同一张表；相同 `trigger_key` 持续更新最新记录，异常消失后自动标记为已解决，历史接口只返回每个触发项的最新状态。
- 当前事件触发器包括：同类任务修改信号偏高、同类任务等待占比偏高、月工时下降超过 20%、需求人综合时薪连续低于均值、设计类型超过 3 个月空缺、需求人主观问题标签集中。触发器先由 D1 数据规则判定，只有命中异常时才调用模型。

## 附件解析边界

- PNG / JPG / WEBP / GIF：读取 R2 源文件并直接进行视觉分析。
- PDF：18MB 以内优先使用 Gemini 原生 PDF 理解；同时携带已有首页预览，主模型失败后由 Kimi 读取预览图。超过 18MB 时直接分析首页预览；没有可用预览时明确标记为暂不支持。
- PPTX / DOCX / XLSX：35MB 以内在 Worker 中解压，提取 XML 文字和最多 6 张内嵌图片。当前能理解内容和素材，但不等同于完整渲染每一页 / 每一张幻灯片的最终版式。
- PSD / AI：有上传预览图时分析预览图；没有预览图时标记为暂不支持，提示补充 PNG / JPG 预览后重试。
- ZIP / RAR / 7Z、旧版 PPT / DOC / XLS 等格式当前不自动解包，不会生成没有依据的分析结论。

## 分析可靠性

- 文字主 / 备用模型各有 30 秒超时；交付件深度分析的视觉主 / 备用模型各有 90 秒超时，在保留复杂文件处理时间的同时避免单个供应商无限占用后台任务。
- 视觉模型请求优先使用 JSON 输出模式；字段缺失时只对原结果做一次结构修复，不补写不存在的事实。
- 队列消费者根据分析结果决定确认或重试，不再把已捕获的模型错误误当成成功消息。
- `provider` 和 `model` 保存实际成功的路由；置信度结合直接视觉来源、证据量、需求匹配和是否降级重新校准。
- 长图切片必须全部成功才合并；任一切片失败则回退整图，避免不完整切片产生看似完整的结论。

## 密钥与安全

- 租户模型 API Key 由 Worker 使用 `AI_SETTINGS_SECRET` 加密后写入 D1。
- 前端只显示 `hasApiKey` 和 `apiKeyPreview`，不会返回明文 API Key。
- Runtime 与 Worker 之间使用 `AI_RUNTIME_KEY` 请求头鉴权。
- 生产环境保存租户 API Key 前必须配置 `AI_SETTINGS_SECRET`。
- 平台默认 Gemini / Kimi / 通义千问 Key 应优先写入 Cloudflare Secret：`GEMINI_API_KEY`、`KIMI_API_KEY`、`DASHSCOPE_API_KEY`，避免进入前端或 Git 仓库。

## 注意事项

- 不要在当前 Cloudflare Worker 中直接 import `src/baml_client/baml_client` 或 `@boundaryml/baml` runtime；这会导致 Worker 打包失败。
- BAML 生成文件可以提交到仓库，便于类型检查、代码审查和 AI Runtime 复用。
- 如果 BAML 官方后续提供 Worker/WASM runtime，可重新评估是否直接在 Worker 中运行。
