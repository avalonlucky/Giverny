# Geist 视觉重构预览分支

> 分支：`geist-visual-refactor`（基于 main `876e527`）。仅做主视觉重构预览，**不影响 main 与线上站点**。

## 改了什么（v2 方向）

结构借鉴 Geist Design System（token 化、双主题、焦点环、组件规格），配色按用户反馈定制：

- **亮色 = 上线版的绿 + 纸张感**：sage 绿主色、米白纸面、衬线标题（Iowan Old Style）、原状态色与行填充全部保留，和 mayeai.com 现有观感一致。
- **暗色 = 柔和墨绿夜色（非纯黑）**：墨绿灰基底 `#141715` + 卡片分层 + sage 点缀；文字用低对比暖灰绿，状态色整体降饱和，久看不刺眼。
- **双主题机制**：`:root[data-theme="dark"]` 整套 token；右下角悬浮按钮 ◐ 一键切换，跟随系统偏好初始化，localStorage 记忆。
- **字体**：正文 Geist Sans（近似 Inter，CDN 引入），标题保留衬线，代码/快捷键/对齐数字用 Geist Mono。
- **硬编码色收敛**：约 320 处散落色值映射到语义 token，暗色主题因此自动全站生效。
- **焦点环**：键盘聚焦时 2px 间隙 + 2px 品牌色环（Geist 规范），无障碍加分。
- **吉维尼季节模式暂停用**（与双主题 token 冲突，恢复方法见 App.css 注释）。

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
