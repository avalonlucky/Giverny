# Giverny

兼职设计任务、工时、文件和月度结算管理平台。正式站已部署到 `https://mayeai.com`。

日常使用请看 [使用手册.md](./使用手册.md)。开发接手请先看 [handoff/HANDOFF.md](./handoff/HANDOFF.md)，再看 [handoff/NEXT_WINDOW_BRIEF.md](./handoff/NEXT_WINDOW_BRIEF.md)。

## 当前状态

- 前端：React + Vite + TypeScript
- 后端：Cloudflare Worker
- 数据库：Cloudflare D1
- 文件：Cloudflare R2
- 正式站 Worker：`designer-worklog`
- 当前规则：不再维护预发布站，完成本地验证后直接更新正式站

## 核心功能

- 工作台：按结算月份统计总工时、计费工时、预计收入、验收情况和图表。
- 任务：列表视图 / 日历视图，右侧详情区包含「信息」和「进展」两个选项卡。
- 任务进展：从接受任务、状态变化、时间段记录、文件上传到确认验收，按时间轴记录。
- 文件库：自动汇总任务生命周期里的过程文件、进展附件、验收附件和最终稿，按项目 / 任务归档。
- 收入：按月统计收入趋势，并按设置中的工资薪金 / 劳务报酬方式做税后估算。
- 月报：锁定月度结算，生成只读甲方链接，可导出 PDF。
- 甲方分享：`/share/:token` 只读查看月报、任务明细和交付文件。
- 设置：口令管理、设计类型二级分类、时薪、计税方式、PDF 抬头、版本信息。

## 重要业务规则

- 任务不允许删除。异常任务用「挂起」或「终止」，并填写原因。
- 文件可以删除，仅用于清理误传文件；删除前必须通过站内二次确认。
- 甲方没有后台权限，只能通过分享链接只读浏览和下载月报。
- 任务归属月份只使用 `settlement_month`；预计开始时间和预计交付时间只作为排期参考，不能参与统计、结算或归属月份兜底。
- 工作台和任务列表按结算月份筛选后，按预计开始日期 / 开始日期倒序，同一天内按创建时间倒序。
- 补录任务仍按真实日期填写，只把结算月份指向需要计入的月份。

## 本地开发

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173/
```

检查：

```bash
npm run lint
npm run build
```

## 部署

部署前请先阅读 `docs/DEPLOYMENT.md`。当前环境建议清掉本机代理变量后执行 Wrangler。

```bash
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy npx wrangler deploy
```

## 目录入口

```text
src/App.tsx              后台主应用
src/App.css              全站样式
src/SharedReport.tsx     甲方只读分享页
src/worker.ts            Cloudflare Worker 后端 API
src/lib/api.ts           前端 API client
src/lib/psdPreview.ts    PSD 预览辅助逻辑
src/types/domain.ts      领域类型
src/config/appConfig.ts  版本、默认设置、设计类型
db/schema.sql            完整 D1 schema
db/migrations/           历史迁移
docs/                    规范和运营文档
handoff/                 接手说明和本地环境样例
```

## 文档维护

每次更新必须同步：

- `CHANGELOG.md`
- `使用手册.md`（功能或流程变化时）
- `docs/VERSIONING.md`（版本号）
- 必要时更新 `docs/OPERATION_POLICIES.md`、`docs/DEPLOYMENT.md`、`handoff/HANDOFF.md`

版本号规则见 [docs/VERSIONING.md](./docs/VERSIONING.md)。
