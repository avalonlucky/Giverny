# Geist 视觉重构预览分支

> 分支：`geist-visual-refactor`（基于 main `876e527`）。仅做主视觉重构预览，**不影响 main 与线上站点**。

## 改了什么

按 Vercel Geist Design System（Light + Dark 双主题规范）重构主视觉：

- **Token 层重写**（`src/App.css` 顶部）：全部语义 token 换成 Geist 色板——亮色以白纸黑字为基底（gray-1000 主文字 / gray-alpha 描边），暗色为纯黑基底；品牌青绿改为 Geist blue（链接/焦点/选中），状态色对齐各 accent 色阶（进行中=blue、待验收=amber、已验收=green、逾期=red、搁置=purple）。
- **暗色主题**：新增 `:root[data-theme="dark"]` 整套 token；右下角悬浮按钮 ◐ 一键切换，跟随系统偏好初始化，localStorage 记忆。
- **字体**：全站 Geist Sans（CDN 引入），代码/快捷键/对齐数字用 Geist Mono；原「Iowan Old Style」衬线标题全部收归无衬线。
- **组件精修**：主按钮改 Geist 实心反白（亮=黑底白字、暗=白底黑字）；次级按钮白底 alpha 描边；控件统一 40px 高、6px 圆角，菜单/弹窗 12px；浮层从「深墨反白」改为 Geist 亮/暗浮层 + alpha 描边 + 分层投影；焦点环 2px 间隙 + 2px 蓝。
- **硬编码色收敛**：约 320 处散落色值映射到语义 token，暗色主题因此自动全站生效。
- **吉维尼季节模式暂停用**（与 Geist token 互斥，恢复方法见 App.css 注释）。

## 如何本地预览

```bash
./preview-geist.sh
# 打开 http://127.0.0.1:8799
# 管理员登录：邮箱 bh141425@gmail.com / 口令 eval-admin-key（本地隔离数据，非生产）
```

脚本复用 agent-evals 的隔离环境：本地 D1 + fixture 种子数据，不触碰生产 D1/R2。

## 说明

- 预览分支不更新 CHANGELOG / 使用手册 / Release；若视觉方案确认采纳，合并时再按正式流程走文档同步与部署。
- 登录弹窗里 Turnstile 在本地加载失败属正常（后端未配 `TURNSTILE_SECRET_KEY` 时自动跳过校验）。
