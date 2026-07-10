# AGENTS.md

> 本文件是给所有 AI 编码助手（Cursor / Codex / Claude Code / ZCode 等）的项目级指令。
> 启动会话时会自动加载，请优先遵守。

## 项目概览

Giverny —— 设计兼职任务管理与结算工具。
- 技术栈：React + TypeScript + Vite，样式为单文件 `src/App.css`
- 部署：Cloudflare Workers（见 `wrangler.toml`）
- 数据：本地 D1，`db/schema.sql`

## 必读文档（按场景）

- 改任何 UI / 布局 / 样式前 → **必读 [`docs/DESIGN.md`](./docs/DESIGN.md)**（视觉排版规范）
- 改交互流程 / 操作路径前 → 必读 [`docs/UX_OPTIMIZATION_AUDIT.md`](./docs/UX_OPTIMIZATION_AUDIT.md)
- 改项目结构 / 新增模块前 → 必读 [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md)
- 部署 / 数据迁移相关 → 必读 [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

## UI 修改铁律（详见 docs/DESIGN.md）

1. **每行/每卡片只保留一个视觉焦点**，默认是任务名或标题。
2. **主信息**用 `var(--color-text)` + 粗体；**次信息**（日期/类型/对接人）用 `var(--color-text-secondary)` 灰字小号。
3. **状态信号**（临期/验收/进度）收敛到右侧一组，复用 `due-tag` / `status-*` 类，用虚线或留白与正文分隔。
4. **跨视图**（工作台、任务管理、日历）同类状态用**统一样式**，不要 badge 与彩色文字混用。
5. **窄列不塞多元素**，单个 grid 列只放一种信息。
6. **管理员专属信息**（普通成员、甲方预览、公开只读链接不可见的字段）统一使用 `admin-only-data`，颜色来自 `--color-admin-only`，让管理员一眼知道这是内部可见信息。
7. **补录是公开解释标记**，必须让甲方可见，使用 `--color-supplement`，不要做成棕色管理员专属信息。
8. **禁止浏览器原生弹窗**：不要使用 `window.alert` / `window.confirm` / `window.prompt`；确认、提示、输入必须使用站内 modal / toast / form 组件。
9. **新增组件前必须先查复用**：先在 `src/App.tsx` / `src/App.css` 搜索现有组件、类名和交互模式；同类能力必须复用已有组件或抽出共享组件，禁止为了省事自创一套风格不一致的临时组件。
10. **确实没有可复用组件时，也必须沿用现有 UI 风格**：使用已有 token、圆角、按钮、输入框、弹窗、滑杆、badge、toast、空状态等视觉语言，不允许出现浏览器默认样式或和产品气质明显不一致的“自创丑组件”。
11. **新增颜色必须复用** `App.css` 顶部 `:root` 的 `--color-*` token，**禁止裸 hex 色值**。
12. **交付前**对照 `docs/DESIGN.md` 第七节的自检清单逐条过一遍。

## 代码风格

- 组件与类名沿用现有约定（见 DESIGN.md 第五节「组件命名约定」）。
- 新增 UI 前先 `rg` 搜索可复用组件 / 样式；优先复用 `ModalShell`、`ConfirmDialog`、`progress-slider-row`、`progress-quick-options`、`due-tag`、`status-*`、`ghost-button`、`primary-button` 等现有模式。
- 任务相关类型定义在 `src/types/domain.ts`，新增字段先改这里。
- 样式统一写在 `src/App.css`，按现有区块顺序追加，不要新建散落 CSS 文件。

## 发布纪律

- 只有影响网站本体的正式更新才需要版本记录：包括功能、UI、交互、数据口径、部署配置、数据库 / R2 / Worker 行为、用户可见文案等。
- README、仓库首页、多语言说明、handoff、内部协作说明这类不影响网站运行的文档调整，只需要普通 commit / push，不需要递增版本号、不需要 tag、不需要 GitHub Release。
- 网站更新默认一次闭环：完成本地验证后部署正式站，线上关键路径回归通过即继续完成代码提交、推送、版本 tag 和 GitHub Release，不再额外等待用户验收确认。
- 如果用户明确要求暂停、仅部署或等待人工验收，才停在对应阶段；否则版本号、正式站、代码、tag 与 Release 必须在同一轮对齐。
- Release notes 和 `CHANGELOG.md` 都要按“大更新 → 小更新”排序，先写用户最关心的流程、功能、数据影响，再写样式、文案、维护项。
- 有明显 UI / 交互变化时，必要时给 Release 上传截图或动图，帮助用户清楚理解更新内容和使用方式。
- 线上回归通过后不得遗忘 GitHub 发布闭环；最终版本、代码、tag 和 Release 必须对齐。

## 交付前自检

- [ ] 是否读过对应场景的必读文档？
- [ ] UI 改动是否过 DESIGN.md 自检清单？
- [ ] 新增 UI 是否先搜索并复用了现有组件 / 类名 / 交互模式？
- [ ] 新增色值是否都用了 token？
- [ ] 是否新增了与现有视图不一致的状态呈现？
- [ ] 如果影响网站本体，是否已部署正式站供用户验收？
- [ ] 正式站回归通过后，是否完成 GitHub commit + push + tag + Release？
