# Giverny Agent Evals

这组回归用例覆盖月份查询、收入工时、任务详情、附件搜索、创建与修改预览、六类后台分析、云端会话、任务通知、任务消歧和安全边界。14 组、28 轮会话额外覆盖任务引用、等待原因、确认卡修改、附件证据、财务复核、正式报告、产品知识和权限边界。

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

隔离评测直接使用 Cloudflare Miniflare API 启动 workerd，每次创建独立的临时 D1、R2、SQLite Durable Object、Workflow 和静态资源绑定，不读取配置文件或调用外部 CLI。它导入 `fixture.sql` 的匿名任务和附件，执行 126 条单轮与 14 组、28 轮多轮用例、MCP 鉴权/工具协议、确认写入 Workflow、失败指纹回归绑定、长期效果快照、operationId 幂等重放、云端会话、后台分析的取消与重试，并在真实写入任务和附件后重启 workerd，确认 D1、R2、会话和幂等状态均可恢复。正常、失败、中断和进程退出都会清理带 `.metadata_never_index` 的临时目录。它不会读取或修改正式 D1/R2，也不会调用外部模型。

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

浏览器回归复用同一个 Miniflare 隔离运行时工厂，但每个分片使用独立端口与独立 D1/R2/DO/Workflow 存储，避免 Agent 工具链和浏览器回归相互污染。在桌面 Chromium 和 Pixel 7 两种视口下验证：管理员登录与工作台加载、工作助手入口、任务详情、新建任务小数工时输入、计划任务记录进展与验收切换、模型设置与服务商弹窗。测试不会读取或修改正式 D1。

失败时 Playwright 会保留截图、视频与 trace 到 `test-results/`，并生成 `playwright-report/`。GitHub Actions 会在门禁失败时上传这些产物，便于直接定位页面状态和操作步骤。
