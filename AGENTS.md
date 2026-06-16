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
- 部署 / 数据迁移相关 → 必读 [`docs/STAGING_WORKFLOW.md`](./docs/STAGING_WORKFLOW.md)

## UI 修改铁律（详见 docs/DESIGN.md）

1. **每行/每卡片只保留一个视觉焦点**，默认是任务名或标题。
2. **主信息**用 `var(--color-text)` + 粗体；**次信息**（日期/类型/对接人）用 `var(--color-text-secondary)` 灰字小号。
3. **状态信号**（临期/验收/进度）收敛到右侧一组，复用 `due-tag` / `status-*` 类，用虚线或留白与正文分隔。
4. **跨视图**（工作台、任务管理、日历）同类状态用**统一样式**，不要 badge 与彩色文字混用。
5. **窄列不塞多元素**，单个 grid 列只放一种信息。
6. **管理员专属信息**（普通成员、甲方预览、公开只读链接不可见的字段）统一使用 `admin-only-data`，颜色来自 `--color-admin-only`，让管理员一眼知道这是内部可见信息。
7. **补录是公开解释标记**，必须让甲方可见，使用 `--color-supplement`，不要做成棕色管理员专属信息。
8. **禁止浏览器原生弹窗**：不要使用 `window.alert` / `window.confirm` / `window.prompt`；确认、提示、输入必须使用站内 modal / toast / form 组件。
9. **新增颜色必须复用** `App.css` 顶部 `:root` 的 `--color-*` token，**禁止裸 hex 色值**。
10. **交付前**对照 `docs/DESIGN.md` 第六节的自检清单逐条过一遍。

## 代码风格

- 组件与类名沿用现有约定（见 DESIGN.md 第五节「组件命名约定」）。
- 任务相关类型定义在 `src/types/domain.ts`，新增字段先改这里。
- 样式统一写在 `src/App.css`，按现有区块顺序追加，不要新建散落 CSS 文件。

## 交付前自检

- [ ] 是否读过对应场景的必读文档？
- [ ] UI 改动是否过 DESIGN.md 自检清单？
- [ ] 新增色值是否都用了 token？
- [ ] 是否新增了与现有视图不一致的状态呈现？
```
