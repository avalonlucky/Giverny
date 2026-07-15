# Agent Durable Workflows

Giverny 使用 Cloudflare Workflows 承担爱丽丝确认后的写入操作。Agent 继续负责对话、工具选择和确认卡；Workflow 负责等待人工确认、持久化执行、步骤重试与结果恢复。

## 执行链路

```text
模型调用 preview 工具
  -> Worker 生成签名 confirmationToken
  -> AliceAgent 持久化确认卡并启动 AgentWriteWorkflow
  -> Workflow waitForApproval（最长 10 分钟）
  -> 用户在站内确认卡明确确认
  -> Workflow 调用 workflow-write
  -> Worker 校验 operationId + confirmationToken
  -> 执行确定性业务写入
  -> 缓存写入结果并回传 Agent
```

当前覆盖五类操作：创建任务、记录反馈、修改任务状态、修改任务字段、追加任务进展。模型仍然只有 preview 权限，不能直接启动 execute。

## 可靠性

- Workflow 每次确认操作使用独立实例 ID，状态由 Cloudflare 持久保存。
- 人工确认通过 `waitForApproval` 恢复流程，页面关闭或 Worker 重启不会把已确认流程变回未确认。
- 执行步骤最多重试 3 次，使用指数退避和 30 秒单次超时。
- `agent_write_operations` 以 Workflow instance ID 作为 `operationId`，成功结果会被缓存；同一操作重放时直接返回第一次结果，不会重复创建任务或重复记录进展。
- 完成或失败记录保留 30 天；异常停留在 processing 的记录保留 1 天，之后由定时清理回收。
- 未配置 Workflow binding 的本地兼容环境仍可退回原有同步确认写入，正式环境必须使用 `AGENT_WRITE_WORKFLOW`。

## 安全边界

- Workflow 只能调用五个白名单 execute endpoint。
- `operationId` 不能跨 endpoint 复用。
- 每个 execute 仍必须提供 Worker 签发且未过期的 `confirmationToken`。
- MCP 不开放 Workflow 写入入口；`MCP 只读`口令也不能调用该入口。
- 删除、作废、结算锁定、部署等高风险动作继续不属于 Agent 工具范围。

## 验证

`npm run agent:eval:isolated` 会额外执行：

- 生成创建任务确认卡后，Workflow 等待并接收确认。
- Workflow 完成真实隔离 D1 写入并返回任务结果。
- 相同 `operationId` 重放时返回同一任务，并标记 `replayed: true`。
- 原有 Agent、MCP 和遥测隔离用例继续通过。
