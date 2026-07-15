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
