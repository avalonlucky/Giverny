# Giverny Handoff

最后整理时间：2026-06-15 22:41
当前产品版本：v0.10.50（作废任务规则与右键菜单优化）

本项目是用户的兼职设计任务、工时、文件和月度结算管理平台，正式域名为 `https://mayeai.com`。当前已进入试运营阶段，正式站只录入真实业务数据。用户已确认新的发布原则：不再维护预发布测试站；改动完成本地 lint/build 验证后，直接部署正式站。

## 1. 当前状态

- 品牌名：`Giverny`
- 正式站：`https://mayeai.com`
- 前端：React + Vite + TypeScript
- 后端：Cloudflare Worker，入口 `src/worker.ts`
- 数据库：Cloudflare D1
- 文件存储：Cloudflare R2
- 当前版本：`v0.10.50`
- 版本显示：左下角账号设置菜单显示轻量版本号，设置页「产品版本」显示完整信息

## 2. Cloudflare 资源

正式环境：

- Worker：`designer-worklog`
- D1：`designer-worklog-db`
- D1 ID：`4b784afe-7d17-4b22-b101-bec380ddc075`
- R2：`designer-worklog-uploads`
- Routes：`mayeai.com/*`、`www.mayeai.com/*`

配置文件：`wrangler.toml`

预发布环境已彻底下线：测试 Worker、测试 D1、测试 R2、测试域名 Route 和测试域名 DNS 记录均已删除。后续不要再尝试部署或查找测试站。

注意：`[assets]` 里的 `binding = "ASSETS"` 必须保留，否则 `/share/*` 等前端路由可能返回 500。

## 3. 本地重要文件

- `src/App.tsx`：后台主应用，包含工作台、任务、文件库、收入、月报、设置、新建任务弹窗等主要 UI。
- `src/App.css`：全站样式，目前大部分 UI 样式都集中在这里。
- `src/SharedReport.tsx`：甲方只读分享页。
- `src/worker.ts`：Cloudflare Worker 后端 API，D1/R2 操作都在这里。
- `src/lib/api.ts`：前端 API client，负责认证 header、文件上传、分片上传等。
- `src/types/domain.ts`：任务、文件、进展、状态等领域类型。
- `src/config/appConfig.ts`：版本号、默认时薪、PDF 抬头、默认设计类型等配置。
- `db/schema.sql`：当前完整 D1 schema。
- `db/migrations/`：历史增量迁移。
- `CHANGELOG.md`：每次更新记录，最新在最上方。
- `使用手册.md`：给使用者看的功能说明。
- `docs/VERSIONING.md`：版本号规范，每次更新必须参考。
- `docs/DEPLOYMENT.md`：正式站部署流程。
- `docs/OPERATION_POLICIES.md`：运营、安全、排序、文件清理、上线规则。
- `docs/UX_OPTIMIZATION_AUDIT.md`：产品交互优化清单。
- `handoff/NEXT_WINDOW_BRIEF.md`：新窗口继续开发时优先读的短版说明。

本地敏感文件：

- `handoff/.admin-token.txt`
- `handoff/.env.local`
- `handoff/env.example`

不要把真实 token 或密码写入公开文档，也不要提交到远程仓库。

AI 助手相关 Secret：

- `DEEPSEEK_API_KEY`：必填，配置后新建任务弹窗的 AI 优化按钮才可用。
- `v0.10.30` 已写入正式环境；完整业务接口验收前，需要先确认线上 `ADMIN_TOKEN` 与本地管理员口令备份一致。
- `DEEPSEEK_MODEL`：可选，默认 `deepseek-chat`。
- `DEEPSEEK_BASE_URL`：可选，默认 `https://api.deepseek.com`。

## 4. 登录和权限

管理员登录：

- 邮箱：`bh141425@gmail.com`
- 密码：Cloudflare Secret `ADMIN_TOKEN`
- 权限：最高权限，含口令管理

访问口令登录：

- 邮箱留空
- 输入设置页生成的 `wk_` 访问口令
- 权限：普通工作台访问，不可管理口令

前端凭证：

- localStorage key：`designer-worklog-auth`
- 请求 header：
  - `x-auth-key`
  - `x-auth-email`
- 旧版 `x-admin-token` 已废弃。

甲方权限：

- 甲方只通过 `/share/:token` 看锁定月报。
- 甲方不能进入后台，不能新增、修改、删除任何数据。
- 甲方可浏览和下载月报、在线预览文件。

## 5. 核心业务规则

### 任务

- 任务不允许直接删除。普通任务只能先「作废任务」；作废任务不出现在工作台、日历、统计、月报、收入和甲方预览中。
- 任务页默认隐藏作废任务，管理员可打开「显示作废」查看；只有已作废任务允许永久删除，并且必须二次确认。
- 作废任务的关联文件保留在文件库，不因为作废产生孤儿文件。
- 不继续做的任务用「挂起」或「终止」，并填写原因。
- 状态包含：`计划中`、`进行中`、`挂起`、`待验收`、`已验收`、`终止`、`不计费`。
- 新建任务时需求人默认为空，占位文字是「提出需求的人」；对接人默认「黄媚」。
- 需求人填写后，验收人默认跟随需求人，后续可改。
- 新建任务弹窗不展示「当前阶段」选择；新任务由系统自动进入初始状态，后续状态变化在任务详情或任务列表中处理。
- 新建任务弹窗的「任务具体需求」右上角有 AI 图标按钮。它调用 Worker 的 `/api/ai/task-assistant`，由后端通过 DeepSeek Tool Calls 返回优化文案和推荐设计类型。
- AI 助手只能由星星图标按钮触发；不要把任务需求区域整体做成 label 或可点击 AI 区域，避免用户点击输入框时误触发。
- AI 只能给建议：采用文案、采用已有分类、创建缺失分类都必须由管理员点击确认；缺失分类确认后才通过现有设计类型接口写入 D1。
- AI 优化文案必须使用 `1、设计背景`、`2、设计要求`、`3、输出文件` 三段；目标是把口语化需求改为专业可执行任务单语言，未知信息写「未明确，可在对接时确认」，不要凭空编造。
- 未配置 `DEEPSEEK_API_KEY` 时，AI 接口返回配置提示，不影响手动创建任务。

### 排序和月份归属

- 任务归属月份只使用 `settlement_month`。
- 不允许用预计开始时间或预计交付时间作为统计、结算、收入或归属月份的兜底；`start_date` 只用于排期展示和列表排序。
- 工作台、任务列表、收入统计、月报、甲方分享页均按结算月份归属。
- 排序规则：结算月份筛选后，按预计开始时间 / 开始日期倒序；同一天内按创建时间倒序。
- 不按交付日期排序。

### 补录

- 新建任务弹窗右上角有静态「补录」文字 + 极简开关。
- 默认关闭。
- 打开补录后，结算月份选择以内联面板展示在 header 下方，不使用绝对定位浮层，避免遮挡设计类型、任务名称等关键字段。
- 选择结算月份后点“确定”收起面板；确认后只在开关旁显示“已记录到 YYYY 年 MM 月”，旁边保留小日历按钮用于修改。
- 补录月份和任务详情结算月份都使用站内自定义绿色月份选择器，不要使用浏览器原生 `input[type="month"]`，避免系统默认蓝色选中态。
- 新建任务里的补录月份选择器是低频辅助控件，必须保持紧凑小面板，不要恢复成横向撑满的大块区域。
- 新建任务里的补录月份必须是补录开关旁的一行下拉 / 输入形态；不要再调用 `CompactMonthSelector` 或渲染独立月份面板。
- 时间输入使用站内 `HH:mm` 文本输入，不要使用浏览器原生 `input[type="time"]`，避免系统默认蓝色控件。
- 禁止使用浏览器原生 `prompt`、`alert`、`confirm`：危险操作必须用站内确认弹窗，需要填写原因时用站内表单弹窗，错误反馈用 toast 或字段下方内联提示。
- 适用场景：任务真实发生在 5 月，但工资需要计入 6 月结算。
- 打开补录后仍可按真实发生日期和时间填写预计开始时间，只把 `settlement_month` 指到需要结算的月份。
- 新建阶段不选择任务状态；已完成、只需要补结算的任务，先创建任务，再进入任务详情点「确认验收」，补实际工时、验收备注和验收文件。
- 新建任务只有打开补录后才显示「补录说明」；不要在新建面板里承载验收动作。
- 预计开始时间支持手动输入到分钟，例如 `2026/04/21 10:10`，也保留日期时间选择按钮。
- 日期时间选择按钮使用站内自定义绿色浮层，不再调用浏览器原生蓝色选择器。
- 任务状态图例、日历任务点和状态徽章必须保留多色区分；计划中紫色、进行中蓝色、已验收绿色等属于业务语义色，不要按“全站绿色”规则清除。
- 新建任务支持排期双向推算：预计开始时间和预计交付时间标题旁各有一个小开关；打开预计开始时间时，按开始时间 + 预估工时推算交付时间；打开预计交付时间时，按交付时间 - 预估工时倒推开始时间。不要再通过点击输入框隐式切换锚点。
- 任务详情里调整预计开始时间或预估工时，仍按现有逻辑自动重算预计交付时间；这些计划字段不影响本月洞察、实际工时、收入统计、月报或最终结算金额，也不会自动修改结算月份。

### 工时

- 任务可记录多段时间。
- 实际工时按时间段计算，验收时也可补充时间段。
- 计费工时排除 `计划中`、`挂起`、`终止`、`不计费`。

### 文件库

- 文件库不是常规独立上传入口，而是汇总任务生命周期内的文件。
- 来源包括：任务过程附件、进展附件、验收附件、最终稿。
- 文件按项目 / 任务聚合。
- 文件可删除，仅用于清理误传文件；删除有站内二次确认。
- 重要文件、验收文件、已发给甲方的文件建议保留。

### 月报和甲方分享

- 月报页锁定结算会写入 `monthly_reports`。
- 同一个月份重复锁定会更新金额快照，但保留原 `public_token`。
- 甲方分享页访问会递增 `view_count` 并更新 `viewed_at`。
- 甲方分享页只读。

### 收入和税务

- 设置页可选择计税方式：工资薪金 / 劳务报酬。
- 收入页按所选方式做估算。
- 税额只是系统估算，不替代财务或个税 App 结果。

## 6. 当前 UI / 产品原则

用户明确偏好：

- 极简，不要为了设计而设计。
- 能用图标表达的操作尽量图标化。
- 熟悉动作如关闭、预览、打开、删除，常态下不要额外包裹重装饰容器。
- 图标按钮需要 `aria-label` 和 `title`。
- 可以折叠的内容尽量折叠。
- 工作台优先展示任务、待办和关键指标；图表、趋势、年度统计等分析内容默认收进「本月洞察」。
- CSS 颜色和容器规范逐步迁移到基础变量，不要一次性大面积重写稳定页面。
- 浮层层级使用 CSS 变量：普通浮层 `--z-floating`，日期 / 月份 / 级联选择器 `--z-popover`，模态框 `--z-modal`，覆盖特效 `--z-overlay-effect`；不要再随手新增散落数字。
- 任务详情维护要按信息阶段分组：创建 / 排期信息和验收 / 实际进展分开，低频附件和时间轴默认可折叠。
- 设置页使用三组分区：业务设置、权限安全、系统信息；业务设置默认展开，权限和系统低频信息默认收起。
- 新建任务弹窗禁止点击遮罩或按 Esc 关闭；未创建成功前要保留本地草稿，创建成功后才清除草稿。
- 验收弹窗已做未保存保护：修改备注 / 时间段 / 上传验收附件后，关闭前必须确认；附件上传中也会提示。
- toast、启动加载页、后端状态点和空状态提示已统一；后续新增异步操作时必须明确成功 / 错误 / 信息三类反馈。
- 危险删除操作必须走统一确认弹窗，尤其是文件、口令、设计类型和实际工时时间段；不要新增直接删除按钮。
- 作废、终止、挂起等带原因的操作也必须走站内弹窗，不要调用浏览器原生输入框。
- 登录和鉴权异常属于 P0 体验问题；Cloudflare Workers 的 PBKDF2 迭代数不能超过当前运行时支持上限，管理员密码哈希使用 `100000` 次迭代。
- 右键菜单适合放次级快捷操作。
- 关键财务和验收动作不能只藏在右键菜单里，仍需可见入口。
- 全站不喜欢阴影，尽量使用轻微背景区分和边界区分。

近期 UI 决策：

- 弹窗关闭按钮：只保留 `X` 图标，常态透明，hover 有轻背景。
- 补录入口：静态文字 + 独立开关，无外层圆角容器。
- 任务右键菜单：工作台和任务页共用组件，结构为查看详情、状态二级菜单、复制任务名称、复制甲方分享链接、改归属月份、底部危险操作；挂起 / 终止必须先填原因，危险操作永远放底部红色。
- 文件预览弹窗：去掉底部重复关闭按钮。

## 7. 版本规则

版本规范见 `docs/VERSIONING.md`。

每次更新必须同步：

- `src/config/appConfig.ts`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- 必要时更新 `使用手册.md`
- 影响流程/规范时更新 `docs/` 对应文档

当前规则：

- 主版本：里程碑或不兼容变化，例如正式进入稳定运营。
- 次版本：新增模块或核心流程，例如收入、文件库、补录、版本体系。
- 修订版本：UI 优化、bugfix、文案、交接文档整理。

## 8. 本地开发

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173/
```

构建检查：

```bash
npm run lint
npm run build
```

构建提示：

- 当前构建会提示部分 chunks 大于 500kB。
- `ag-psd` 会提示 `util` 浏览器兼容 externalized。
- 这两个目前是已知提示，不是本次阻断问题。

## 9. 部署

用户确认过的默认流程：

- 代码或前端体验改动完成后，不能只改本地文件。
- 本地完成 `npm run lint` 和 `npm run build` 后，直接部署正式站。
- 涉及已录入数据、数据库结构、结算口径、文件上传/删除、验收流程、权限或可能改变真实业务结果的改动：先在本地或临时隔离环境验证清楚，再部署正式站；不要使用已下线的测试站。
- 部署正式站后必须验证 `https://mayeai.com/api/health` 和正式站资源版本 / 关键变更是否生效。

先确认 Wrangler 可用，并清掉本机代理变量：

```bash
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy npx wrangler deploy
```

线上确认：

```bash
curl --noproxy '*' -L -sS https://mayeai.com/ | rg -n "assets/index-|Giverny|favicon"
curl --noproxy '*' -L -sS https://mayeai.com/api/health
```

上线顺序：

1. 本地修改。
2. 更新版本号和文档。
3. `npm run lint`
4. `npm run build`
5. 判断是否影响真实业务数据；高风险改动先在本地或临时隔离环境验证清楚。
6. 部署 production。
7. 验证 production 健康检查、资源包版本号和关键变更。

## 10. D1 迁移

完整 schema：

```bash
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy npx wrangler d1 execute designer-worklog-db --remote --file db/schema.sql
```

单个迁移示例：

```bash
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy npx wrangler d1 execute designer-worklog-db --remote --file db/migrations/0004_task_settlement_month.sql
```

注意：

- 正式站已进入试运营，不要在生产 D1 里做清表测试。
- 测试 D1/R2 已删除；不要在正式 D1/R2 上做清表测试或无意义测试上传。

## 11. API 摘要

公共：

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/shared/:token`
- `GET /api/files/:id/preview`
- `GET /api/files/:id/source`

需要登录：

- `GET /api/state`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`：固定返回 405，任务不允许删除
- `GET /api/tasks/:id/activity`
- `POST /api/updates`
- `PATCH /api/updates/:id`
- `DELETE /api/updates/:id`
- `POST /api/files`
- `POST /api/files/multipart/init`
- `PUT /api/files/multipart/part`
- `POST /api/files/multipart/complete`
- `DELETE /api/files/:id`
- `PATCH /api/settings/hourly-rate`
- `PATCH /api/settings/pdf-title`
- `PATCH /api/settings/tax-mode`
- `PATCH /api/settings/design-types`
- `POST /api/reports/monthly`

管理员专属：

- `POST /api/tokens`
- `PATCH /api/tokens/:id`
- `DELETE /api/tokens/:id`

## 12. 下一轮建议

优先级高：

- 确认验收流程里的次级操作继续图标化，例如添加时间段、上传附件、删除时间段。
- 抽通用 `IconButton`，统一图标按钮、tooltip、危险态。
- 抽通用 `SegmentTabs`，统一工作台/任务页/详情页签。

中期：

- 服务端 PDF 生成并存入 R2。
- 增加自动化测试，覆盖结算、补录、文件删除、甲方分享。
- 文件归档/冷存储/待删除队列，降低 R2 增长压力。

谨慎：

- 不要恢复任务删除。
- 不要把财务/验收关键动作只藏进右键菜单。
- 不要在正式站用测试数据验证。
