# Next Window Brief

新窗口继续开发时，先从这里开始。

## 项目位置

```text
/Users/luban/Documents/兼职平台
```

## 当前状态

- 正式站：`https://mayeai.com`
- GitHub：`https://github.com/avalonlucky/Giverny`
- 当前网站版本：`v0.10.98`
- 最新网站 tag：`v0.10.98`
- 最新网站 Worker Version：`9e7e2155-fcf9-483d-8488-2e18986d55f8`
- 上一条协作规则 commit：`ccd493b docs: require component reuse before new UI`
- 注意：`ccd493b` 是文档规则更新，不是网站版本，不需要 tag / Release。

## 优先阅读

1. `AGENTS.md`
2. `docs/DESIGN.md`
3. `handoff/HANDOFF.md`
4. `CHANGELOG.md`
5. `docs/UX_OPTIMIZATION_AUDIT.md`

## 最重要的新规则

新增任何 UI / 组件前，必须先搜索现有组件、类名和交互模式：

```bash
rg "关键词|className|组件名" src/App.tsx src/App.css
```

能复用就复用；不能复用就抽共享组件或加 modifier class。确实没有可复用组件时，也必须沿用当前产品 UI 风格。禁止浏览器默认样式，禁止自创一套风格不一致的临时组件。

典型复用：

- 弹窗：`ModalShell`
- 确认：`ConfirmDialog`
- 进度滑杆：`progress-slider-row`
- 进度档位：`progress-quick-options`
- 临期/逾期：`due-tag`
- 状态：`status-*`
- 按钮：`primary-button`、`ghost-button`、`icon-button`

## 近期刚修

- 验收弹窗进度编辑已复用记录进展同款滑杆和档位按钮。
- 验收终审弹窗已降低字段、正文和标签字重。
- 工作台和任务导航列表行已逐步统一。
- 文件预览、任务详情、进度滑杆曾反复返工；新窗口要优先复用，不要再写第二套。

## 用户偏好

- 简洁、直接、像 Gmail 一样工具化。
- 不喜欢过多框、背景叠背景、重阴影、全屏粗体。
- 不接受浏览器原生 `alert` / `confirm` / `prompt`。
- 不接受同一功能在不同弹窗里长得不一样。
- 甲方可见和管理员专属信息必须区分清楚：管理员专属用棕色 `admin-only-data`，补录是公开解释标记，不要棕色。

## 数据和业务红线

- 实际工时只来自时间记录 / 验收流程。
- 预计开始、预计交付、预估工时只作排期参考，不能参与统计、收入、月报、结算。
- 结算月份使用 `settlement_month`。
- 非补录任务按验收月份结算；补录任务才允许改结算月份。
- 普通任务不能直接永久删除；永久删除只允许已作废任务并二次确认。
- 正式站是真实数据，不要造测试数据、清表或随便上传测试文件。

## 发布纪律

网站本体更新：commit + push + tag + GitHub Release + 正式站部署 + deployment 记录。

纯 README / handoff / 内部协作说明：普通 commit + push，不递增版本号，不发 Release。

常用验证：

```bash
npm run lint
npm run build
```

正式部署：

```bash
npm run deploy:worker
```
