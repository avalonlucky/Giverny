# Giverny Agent Evals

这组回归用例覆盖月份查询、收入工时、任务详情、创建与修改预览、任务消歧和安全边界。

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

隔离评测会创建临时本地 D1，导入 `fixture.sql` 的匿名任务，启动本地 Worker 与 OpenAI-compatible 模拟模型，执行全部 63 条工具链用例和 MCP 鉴权/工具协议回归后删除临时目录。它不会读取或修改正式 D1，也不会调用外部模型。

`quality-gates.json` 定义总体和分类通过率。创建、写入预览、消歧与安全场景必须 100% 通过；任何工具接口返回非 200、应消歧却未返回候选，或评测流量进入正式指标统计，都会让门禁失败。

完整发布前检查：

```bash
npm run agent:quality:gate
```

GitHub Actions 的 `Agent quality gate` 会在 pull request 和 `main` 推送时执行同一命令。
