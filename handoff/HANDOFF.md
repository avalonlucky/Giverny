# Giverny Handoff

最后整理时间：2026-06-18 22:15
当前网站版本：v0.10.98（验收弹窗进度组件统一）
上一条协作规则提交：`ccd493b docs: require component reuse before new UI`

Giverny 是任务、工时、文件、验收和月度结算工作台。正式域名为 `https://mayeai.com`，当前进入试运营阶段，正式站只放真实业务数据。预发布站和独立 staging D1/R2 已下线，后续本地验证后直接更新正式站。

## 1. 新窗口先读

1. `AGENTS.md`：所有 AI 编码助手的项目级规则。
2. `docs/DESIGN.md`：UI/布局/组件复用规范，改 UI 前必读。
3. `docs/UX_OPTIMIZATION_AUDIT.md`：交互流程和 UX 审查方向。
4. `docs/PROJECT_STRUCTURE.md`：新增模块或调整结构前必读。
5. `docs/DEPLOYMENT.md`：部署和正式站规则。
6. `CHANGELOG.md`：最近版本历史。

## 2. 当前状态

- 品牌：Giverny
- 正式站：`https://mayeai.com`
- GitHub：`https://github.com/avalonlucky/Giverny`
- 当前代码分支：`main`
- 最新网站版本：`v0.10.98`
- 最新正式站 Worker Version：`9e7e2155-fcf9-483d-8488-2e18986d55f8`
- 最近网站 release：`https://github.com/avalonlucky/Giverny/releases/tag/v0.10.98`
- 最近网站变更：验收弹窗进度编辑复用记录进展同款进度滑杆与档位快选。
- 最近文档规则变更：新增“新增组件前必须先查复用”的项目规则；这是文档更新，不发版本、不打 tag、不发 Release。

## 3. 技术栈与资源

- 前端：React + TypeScript + Vite
- 样式：单文件 `src/App.css`
- 后端：Cloudflare Worker，入口 `src/worker.ts`
- 数据库：Cloudflare D1
- 文件存储：Cloudflare R2
- 配置：`wrangler.toml`

正式环境：

- Worker：`designer-worklog`
- D1：`designer-worklog-db`
- D1 ID：`4b784afe-7d17-4b22-b101-bec380ddc075`
- R2：`designer-worklog-uploads`
- Routes：`mayeai.com/*`、`www.mayeai.com/*`

注意：`[assets]` 的 `binding = "ASSETS"` 必须保留，否则前端路由和分享页可能异常。

## 4. 重要文件

- `src/App.tsx`：主应用，大部分后台 UI 和交互都在这里。
- `src/App.css`：全站样式，新增样式按现有区块追加。
- `src/SharedReport.tsx`：甲方只读分享页。
- `src/worker.ts`：Cloudflare Worker API、D1/R2 操作。
- `src/lib/api.ts`：前端 API client。
- `src/types/domain.ts`：领域类型，新增任务字段先改这里。
- `src/config/appConfig.ts`：版本号、时薪、PDF 抬头、默认设计类型。
- `db/schema.sql`：完整 D1 schema。
- `db/migrations/`：历史迁移。
- `CHANGELOG.md`：网站本体版本记录。
- `AGENTS.md`：AI 项目级规则。
- `docs/DESIGN.md`：UI 视觉和组件复用规范。
- `docs/UX_OPTIMIZATION_AUDIT.md`：交互审查规范。
- `handoff/NEXT_WINDOW_BRIEF.md`：下一窗口短版说明。

本地敏感文件：

- `handoff/.admin-token.txt`
- `handoff/.env.local`
- `handoff/env.example`

不要提交真实 token、密码或生产密钥。

## 5. 必须记住的新规则

新增 UI / 组件前，必须先搜索现有实现：

```bash
rg "关键词|className|组件名" src/App.tsx src/App.css
```

优先复用或抽出共享组件。典型可复用模式：

- 弹窗：`ModalShell`
- 确认：`ConfirmDialog`
- 进度滑杆：`progress-slider-row`
- 进度档位：`progress-quick-options`
- 临期/逾期：`due-tag`
- 状态：`status-*`
- 按钮：`primary-button`、`ghost-button`、`icon-button`
- 管理员专属信息：`admin-only-data`

禁止为了省事自创一套风格不一致的临时组件。确实没有可复用组件时，也必须沿用现有 token、圆角、按钮、输入框、弹窗、滑杆、badge、toast、空状态等视觉语言。不要再出现浏览器默认样式的控件。

## 6. UI 与产品原则

- 每行/每卡片只保留一个视觉焦点。
- 主信息用深色和适度粗体；次信息用灰色、小号、常规字重。
- 状态信号集中归组，不要散落。
- 工作台、任务管理、日历等同类状态必须统一样式。
- 新增颜色必须复用 `App.css` 顶部 `:root` 的 `--color-*` token，禁止裸 hex。
- 管理员专属信息用 `admin-only-data` 和 `--color-admin-only`。
- 补录是公开解释标记，必须让甲方可见，用 `--color-supplement`，不要做成棕色。
- 禁止浏览器原生 `alert` / `confirm` / `prompt`。
- 不喜欢重装饰、框套框、过多阴影；工具应像 Gmail 一样简单直接。
- 右键菜单可以放次级操作；验收、财务、关键流程必须有显性入口。

## 7. 近期重要版本

- `v0.10.98`：验收弹窗进度编辑复用记录进展同款滑杆和档位按钮。
- `v0.10.97`：验收终审弹窗视觉层级降噪，降低字段和正文粗体。
- `v0.10.96`：统一进度滑杆样式，降低验收弹窗视觉噪音。
- `v0.10.95`：结算月份归属逻辑重构，非补录任务按验收月份结算。
- `v0.10.94`：右键菜单精简与操作逻辑优化。
- `v0.10.93`：任务导航行 hover/selected 与工作台配色统一。
- `v0.10.92`：任务导航列表行对齐工作台结构。
- `v0.10.91`：文件预览、任务列表一致性、工作台右侧详情简化修复。

## 8. 核心业务规则

### 数据口径

- 实际工时只来自时间记录 / 验收流程。
- 预计开始时间、预计交付时间、预估工时只用于排期展示和计划推算。
- 计划字段不能参与本月洞察、统计、收入、月报、结算金额或结算月份兜底。
- 任务归属月份使用 `settlement_month`。

### 任务状态

状态包括：`计划中`、`进行中`、`挂起`、`待验收`、`已验收`、`终止`、`不计费`。

- 已验收任务锁定实际工时和结算。
- 终止、挂起、作废等需要原因的流程必须走站内弹窗。
- 普通任务不能直接永久删除；永久删除只允许已作废任务并二次确认。

### 补录

- 补录是对甲方可见的解释标记。
- 补录用于把历史任务计入指定结算月份。
- 非补录任务验收时自动归属验收月份。
- 只有补录任务才允许手动改结算月份。

### 验收

- 去验收弹窗是终审流程，要核对基础信息、进度、分段工时、验收附件、验收备注。
- 确认验收后状态变为已验收，进度设为 100%，工时锁定并进入结算。
- 验收弹窗里的进度编辑目前复用 `progress-slider-row` / `progress-quick-options`，不要再写另一套。

### 文件库

- 文件库汇总任务生命周期文件，不是随便上传的独立网盘。
- PDF、图片、Office 等应尽量站内预览。
- 文件删除只用于误传文件，必须站内二次确认。

### 甲方分享

- 甲方通过 `/share/:token` 只读查看月报和交付文件。
- 甲方不能编辑后台数据。
- 普通成员、甲方、游客不能看到管理员专属字段。

## 9. 发布纪律

只有影响网站本体的正式更新才需要版本记录、tag 和 Release，包括功能、UI、交互、数据口径、部署配置、数据库/R2/Worker 行为、用户可见文案等。

README、仓库首页、多语言说明、handoff、内部协作说明等不影响网站运行的文档调整，只普通 commit / push，不递增版本号，不打 tag，不发 Release。

网站正式更新后必须完成：

1. 更新 `package.json`、`package-lock.json`、`src/config/appConfig.ts`。
2. 更新 `CHANGELOG.md`。
3. `npm run lint`
4. `npm run build`
5. commit + push
6. tag
7. GitHub Release
8. 部署正式站
9. 记录 deployment
10. 线上验证

Release notes 和 `CHANGELOG.md` 都按“大更新 → 小更新”排序。

## 10. 常用命令

本地验证：

```bash
npm run lint
npm run build
```

部署正式站：

```bash
npm run deploy:worker
```

线上检查：

```bash
curl -I https://mayeai.com
```

查看最近版本：

```bash
git log --oneline --decorate -8
```

创建 Release 可参考最近一次：

```bash
gh release view v0.10.98 --repo avalonlucky/Giverny
```

记录 deployment：

```bash
gh workflow run "Record production deployment" --repo avalonlucky/Giverny --ref main -f description="..."
```

## 11. 交接提醒

- 当前工作区在 `main`，已经推送到远端。
- 当前最新网站版本 `v0.10.98` 已部署。
- `ccd493b` 是文档提交，不是网站版本，不需要 Release。
- 新窗口如果继续做 UI，必须先读 `docs/DESIGN.md`，并先搜索可复用组件。
- 用户对不一致组件、浏览器默认控件、粗体过多、框套框、重复设计非常敏感。
- 如果你要新建组件，先证明现有组件不能复用。
- 不要为了快速完成，把临时 HTML 效果直接硬塞进 React；要抽取或复用符合现有 UI 语言的实现。
