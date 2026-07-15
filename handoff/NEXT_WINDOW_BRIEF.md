# Next Window Brief

## 2026-07-16 · v0.28.35 Agent 工作空间

- 已实现云端会话索引与旧浏览器历史迁移，消息正文和结构化卡片继续保存在 Alice Durable Object SQLite。
- 爱丽丝顶部新增 Agent 任务中心，`agent_analysis_jobs.read_at` 提供跨设备可靠未读状态。
- `AgentAnalysisWorkflow` 已通用化，支持月度复盘、周报、风险提示、跨任务、批量附件和趋势分析。
- Cron 会创建去重的周摘要、上月复盘和逾期风险提示；发布门禁为 70/70。
- 数据迁移：`db/migrations/0018_agent_workspace.sql`。

最后整理：2026-06-23
代码版本：v0.11.66
分支：main
GitHub：https://github.com/avalonlucky/Giverny
正式站：https://mayeai.com

## 先读

1. `AGENTS.md`
2. `docs/DESIGN.md`
3. `handoff/HANDOFF.md`
4. `CHANGELOG.md`
5. `/Users/luban/Desktop/giverny-redesign/index.html`（UI 参考稿，用户要求认真学习）

## 接手原则

不要继续盲改 UI。参考稿是当前视觉源头：直角、纸张感、轻标题、轻按钮、少装饰、少加粗、横线式搜索/输入。新增组件前先 `rg` 搜现有组件和类名，能复用就复用。

## 第一优先级

1. 文件库缩略图：PDF/JPG/PNG/PSD/Word/PPT/Excel 都要尽量显示缩略图。重点检查 `.file-thumb-preview` 固定高度/最小高度导致 PDF canvas 白边的问题。
2. 文件库范围：只展示验收文件；进展附件只在进展里看，保留 2 个月，可供 AI 分析但不进文件库。删除进展要清理关联过程附件。
3. 补录说明和验收备注拆开：补录说明可见可编辑，不得进入/覆盖验收备注。
4. 验收弹窗草稿：不能从本地草稿读取 `timeEntries` / `waitingEntries`，这些必须来自任务权威数据。
5. AI 命名：视觉模型超时改到约 30 秒；失败不要生成无意义长兜底；上线前必须实测。
6. 老表单 UI：编辑任务、任务导航、验收等残留旧样式要统一到新建任务参考稿风格。
7. 每日小知识：前台秒切可以，但后台补池完成不能自动替换当前正在看的内容。

## 近期风险

- 工时、验收、结算会影响工资，任何本地缓存和草稿逻辑都不能污染权威数据。
- 正式站是真实数据，不要造测试数据、不要清表。
- 用户已经多次强调：不要抄错参考 HTML 的排版、字号、按钮、搜索框和弹窗形态。

## 验证

```bash
npm run lint
npm run build
```

本次交接只同步 GitHub，不代表已经部署正式站、打 tag 或发 Release。
