# Agent Durable Workflows

Giverny 使用 Cloudflare Workflows 承担爱丽丝确认后的写入操作与耗时只读分析。Agent 继续负责对话和工具选择；Workflow 负责持久执行、步骤重试与结果恢复。

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

当前覆盖十四类操作：创建任务、记录反馈、修改任务状态、修改任务字段、追加任务进展、记录等待、维护单条记录、标记验收文件、完整验收、导出结算回单、管理结算锁定/分享有效期、调整排期、创建站内提醒和配置模型路由。模型仍然只有 preview 权限，不能直接启动 execute。预览与执行的配对关系、风险、允许角色和 Workflow 白名单均由 `src/agentToolRegistry.ts` 生成。

## 多步骤执行批次

持续目标不再只是文字清单。`agent_task_plans` 保存一个可恢复的执行批次，每个步骤都有稳定 key、依赖步骤、执行状态、尝试次数、失败原因和可选补偿动作。

```text
Agent 创建 2–8 个步骤及依赖图
  -> D1 保存 awaiting_confirmation 批次
  -> 用户在任务中心确认整个批次
  -> 根步骤进入 ready，其余步骤保持 blocked
  -> 对应业务写入仍逐项执行“预览 → 确认 → Workflow”
  -> Workflow 开始 / 成功 / 失败回写步骤状态
  -> 成功后解锁全部已满足依赖的步骤
  -> 任一步失败，批次立即 failed，并阻止其他 ready 步骤继续
```

- 依赖图创建时检查不存在的依赖、自依赖和循环依赖。
- 批次暂停后拒绝步骤推进；恢复时从 D1 中的原步骤继续。
- 每次修改携带 `revision`，旧页面或旧会话不能覆盖较新的计划状态。
- 失败步骤可以重试；重新打开上游步骤时，所有下游步骤一并回到等待依赖。
- 补偿按依赖的反方向执行。只有已经在统一能力注册表中登记的安全写入动作可以成为补偿动作，不支持的“伪回滚”在创建批次时即被拒绝。
- 批次确认不会替代具体业务写入确认。金额、验收、任务字段等真实数据仍由每个签名 Workflow 单独核对和执行。

## 后台分析任务

```text
模型调用 start_monthly_review / start_deep_analysis
  -> Worker 创建 agent_analysis_jobs 记录
  -> AgentAnalysisWorkflow 按任务类型收集权威数据
  -> 文字模型生成结构化报告
  -> D1 保存最终报告并清除原始快照
  -> 对话任务卡与 Agent 任务中心轮询状态
  -> 持久未读通知提示用户查看结果
```

当前支持月度复盘、周工作摘要、任务风险提示、跨任务专题、批量附件汇总和多月趋势。数据覆盖有效任务、状态、工时、进展、改稿、等待、反馈与已完成附件分析。数量、工时与金额由 Worker 确定性计算，模型只负责归纳。任务卡支持取消和失败重试；取消后的 Workflow 不会写入报告。

定时器按北京时间运行：周一 9 点创建周摘要、每月 1 日 9 点创建上月复盘；当天存在逾期未完成任务时创建风险提示。每个周期使用 `dedupe_key` 保证重复 cron 不会重复创建。

## 可靠性

- Workflow 每次确认操作使用独立实例 ID，状态由 Cloudflare 持久保存。
- 人工确认通过 `waitForApproval` 恢复流程，页面关闭或 Worker 重启不会把已确认流程变回未确认。
- 执行步骤最多重试 3 次，使用指数退避和 30 秒单次超时。
- `agent_write_operations` 以 Workflow instance ID 作为 `operationId`，成功结果会被缓存；同一操作重放时直接返回第一次结果，不会重复创建任务或重复记录进展。
- 执行批次以 D1 为权威状态；浏览器关闭、Agent Durable Object 休眠或换一个会话重新打开任务中心后，仍能恢复依赖、失败、暂停和补偿进度。
- 完成或失败记录保留 30 天；异常停留在 processing 的记录保留 1 天，之后由定时清理回收。
- 未配置 Workflow binding 的本地兼容环境仍可退回原有同步确认写入，正式环境必须使用 `AGENT_WRITE_WORKFLOW`。

## 安全边界

- Workflow 只能调用统一能力注册表中标记为 `signed-execute + workflow` 的十四个 execute endpoint，不维护第二份手写白名单。
- `operationId` 不能跨 endpoint 复用。
- 每个 execute 仍必须提供 Worker 签发且未过期的 `confirmationToken`。
- MCP 不开放 Workflow 写入入口；`MCP 只读`口令也不能调用该入口。
- 删除结算记录、作废任务、部署和录入明文 API Key 等高风险动作继续不属于 Agent 工具范围。结算锁定只允许管理员在确定性预览后确认执行。

## 验证

`npm run agent:eval:isolated` 会额外执行：

- 生成创建任务确认卡后，Workflow 等待并接收确认。
- Workflow 完成真实隔离 D1 写入并返回任务结果。
- 相同 `operationId` 重放时返回同一任务，并标记 `replayed: true`。
- 后台分析会完成数据收集和报告生成，并验证取消、重试及最终恢复。
- 云端会话会验证索引、消息恢复、旧历史导入与删除；任务中心会验证未读状态持久化。
- 多步骤批次会验证未确认不可推进、依赖解锁、失败停止、重试、暂停/恢复、过期 revision 冲突、下游重开及反向补偿。
- 业务工具会验证结算快照变更拒绝、Excel/分享页可读取、排期冲突与调整、浏览器直传 R2 接力、站内提醒、模型路由脱敏检查/测试/配置、角色越权和确认凭证重放。
- 原有 Agent、MCP 和遥测隔离用例继续通过。
