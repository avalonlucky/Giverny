# Giverny Agent Evals

这组回归用例覆盖月份查询、收入工时、任务详情、附件搜索、创建与修改预览、六类后台分析、云端会话、任务通知、任务消歧和安全边界。

```bash
npm run agent:eval:check
```

上面的命令只校验评测集结构，适合本地构建和 CI。配置正式站地址与管理员鉴权后，可以执行真实模型与工具调用：

```bash
GIVERNY_AGENT_EVAL_URL=https://example.com \
GIVERNY_AGENT_EVAL_COOKIE='giverny_session=...' \
npm run agent:eval
```

本地或未启用 Turnstile 的隔离环境也可以使用 `GIVERNY_AGENT_EVAL_AUTH_EMAIL` 与 `GIVERNY_AGENT_EVAL_AUTH_KEY` 登录。正式站建议直接提供短期会话 Cookie，避免自动化登录触发人机验证和频率限制。

在线评测只生成查询结果或写入预览，不会自动确认写操作。模型输出具有一定概率波动，发布门禁以结构校验为必选项，在线全量评测用于 Agent 提示词、模型和工具协议升级后的专项回归。

## 隔离质量门禁

```bash
npm run agent:eval:isolated
```

隔离评测会创建临时本地 D1，导入 `fixture.sql` 的匿名任务和附件，启动本地 Worker、Cloudflare Workflow 与 OpenAI-compatible 模拟模型，执行全部 74 条工具链用例、MCP 鉴权/工具协议与结构化附件回归、确认写入 Workflow、operationId 幂等重放、云端会话迁移与恢复、任务未读状态，以及后台分析的完成、取消和重试后删除临时目录。它不会读取或修改正式 D1，也不会调用外部模型。

`quality-gates.json` 定义总体和分类通过率。创建、写入预览、后台分析、消歧与安全场景必须 100% 通过；任何非预期工具错误、应消歧却未返回候选，或评测流量进入正式指标统计，都会让门禁失败。

完整发布前检查：

```bash
npm run agent:quality:gate
```

GitHub Actions 的 `Agent quality gate` 会在 pull request 和 `main` 推送时执行同一命令。

## 浏览器关键流程回归

```bash
npm run browser:eval
```

浏览器回归会复用隔离评测的临时 D1、匿名 fixture、模拟模型与本地 Worker，并使用独立端口避免和 Agent 工具链评测互相复用残留进程。在桌面 Chromium 和 Pixel 7 两种视口下验证：管理员登录与工作台加载、工作助手入口、任务详情、新建任务小数工时输入、计划任务记录进展与验收切换、模型设置与服务商弹窗。测试不会读取或修改正式 D1。

失败时 Playwright 会保留截图、视频与 trace 到 `test-results/`，并生成 `playwright-report/`。GitHub Actions 会在门禁失败时上传这些产物，便于直接定位页面状态和操作步骤。
