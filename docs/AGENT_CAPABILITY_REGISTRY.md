# Agent Capability Registry

> 本文由 `npm run agent-capabilities:generate` 根据 `src/agentToolRegistry.ts` 自动生成，请勿手工维护能力清单。

## 概览

- 注册能力：82 项
- 分类：finance 6、tasks 4、files 8、product 3、web 1、analysis 6、security 10、calendar 4、notifications 5、planning 5、memory 4、write 20、internal 6
- 单一来源：输入 schema、权限角色、scope、风险、确认方式、审计事件、Runtime 暴露面和执行关系均来自统一注册表。

## 能力清单

能力名 | 标题 | 分类 | 风险 | 确认 | 允许角色 | Scope | 暴露面 | 审计事件
--- | --- | --- | --- | --- | --- | --- | --- | ---
`query_month_finance` | 查询月份财务 | finance | read | none | admin, demo, collaborator, viewer, mcp-read, system | finance:read | model, mcp, api | `agent_read_finance`
`search_tasks` | 搜索任务 | tasks | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_search_tasks`
`query_task_portfolio` | 查询跨任务工作概况 | tasks | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_query_portfolio`
`get_task_detail` | 读取任务详情 | tasks | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_get_task_detail`
`get_requester_profile` | 读取需求人画像 | tasks | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_get_requester_profile`
`search_attachments` | 搜索任务附件 | files | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | attachments:read | model, mcp, api | `agent_search_attachments`
`inspect_attachment_evidence` | 读取附件证据 | files | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | attachments:read | model, mcp, api | `agent_inspect_attachment_evidence`
`query_attachment_analysis` | 查询附件分析状态 | files | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | attachments:read | model, mcp, api | `agent_query_attachment_analysis`
`get_giverny_context` | 读取工作台能力 | product | read | none | admin, demo, collaborator, viewer, client, guest, mcp-read, system | product:read | model, mcp, api | `agent_get_context`
`search_product_help` | 查询产品使用说明 | product | read | none | admin, demo, collaborator, viewer, client, guest, mcp-read, system | product:read | model, mcp, api | `agent_search_product_help`
`search_web` | 联网查询 | web | read | none | admin, demo, collaborator, viewer, client, guest, mcp-read, system | web:read | model, mcp, api | `agent_search_web`
`search_workspace` | 全域统一搜索 | product | read | none | admin, demo, collaborator, viewer, mcp-read, system | tasks:read, attachments:read, product:read, memory:read | model, mcp, api | `agent_search_workspace`
`audit_workspace_consistency` | 执行全站数据一致性审计 | analysis | read | none | admin, demo, collaborator, viewer, mcp-read, system | tasks:read, attachments:read, finance:read | model, mcp, api | `agent_audit_workspace_consistency`
`query_formal_deliverables` | 查询正式交付物 | analysis | read | none | admin, demo, collaborator, viewer, mcp-read, system | tasks:read, attachments:read | model, mcp, api | `agent_query_formal_deliverables`
`query_high_risk_actions` | 查询高风险操作案件 | security | read | none | admin, system | security:read | model, mcp, api | `agent_query_high_risk_actions`
`query_settlement_exports` | 查询结算导出记录 | finance | read | none | admin, demo, collaborator, viewer, mcp-read, system | finance:read | model, mcp, api | `agent_query_settlement_exports`
`reconcile_settlement_export` | 核对结算回单 | finance | read | none | admin, demo, collaborator, viewer, mcp-read, system | finance:read | model, mcp, api | `agent_reconcile_settlement_export`
`generate_settlement_receipt` | 生成结算回单 | finance | write | none | admin, system | finance:write | model, api | `agent_generate_settlement_receipt`
`query_agenda` | 查询日程与可用时间 | calendar | read | none | admin, demo, collaborator, viewer, mcp-read, system | tasks:read, plans:read | model, mcp, api | `agent_query_agenda`
`check_schedule_conflicts` | 检查任务排期冲突 | calendar | read | none | admin, demo, collaborator, viewer, mcp-read, system | tasks:read | model, mcp, api | `agent_check_schedule_conflicts`
`prepare_attachment_upload` | 准备附件上传接力 | files | write | none | admin, demo, collaborator, system | attachments:write | model, api | `agent_prepare_attachment_upload`
`manage_attachment_analysis_preview` | 预览批量分析附件 | files | write | preview | admin, demo, collaborator, system | attachments:write, analysis:write | model, api | `agent_preview_manage_attachment_analysis`
`manage_attachment_analysis` | 执行批量分析附件 | files | write | signed-execute | admin, demo, collaborator, system | attachments:write, analysis:write | api, workflow | `agent_manage_attachment_analysis`
`update_attachment_metadata_preview` | 预览修改附件信息 | files | write | preview | admin, demo, collaborator, system | attachments:write | model, api | `agent_preview_update_attachment_metadata`
`update_attachment_metadata` | 执行修改附件信息 | files | write | signed-execute | admin, demo, collaborator, system | attachments:write | api, workflow | `agent_update_attachment_metadata`
`inspect_ai_settings` | 检查模型设置 | security | read | none | admin, system | settings:read | model, api | `agent_inspect_ai_settings`
`test_ai_route` | 测试模型路由 | security | read | none | admin, system | settings:read | model, api | `agent_test_ai_route`
`diagnose_ai_routing` | 诊断模型主备链路 | security | read | none | admin, system | settings:read | model, api | `agent_diagnose_ai_routing`
`manage_settlement_export_preview` | 预览管理结算回单 | finance | sensitive | preview | admin, system | finance:write | model, api | `agent_preview_manage_settlement`
`manage_settlement_export` | 执行管理结算回单 | finance | sensitive | signed-execute | admin, system | finance:write | api, workflow | `agent_manage_settlement`
`reschedule_task_preview` | 预览调整任务排期 | calendar | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_reschedule_task`
`reschedule_task` | 执行调整任务排期 | calendar | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_reschedule_task`
`schedule_reminder_preview` | 预览安排站内提醒 | notifications | write | preview | admin, demo, collaborator, system | plans:write | model, api | `agent_preview_schedule_reminder`
`schedule_reminder` | 执行安排站内提醒 | notifications | write | signed-execute | admin, demo, collaborator, system | plans:write | api, workflow | `agent_schedule_reminder`
`query_proactive_work` | 查询主动事项 | notifications | read | none | admin, demo, collaborator, viewer, mcp-read, system | plans:read | model, mcp, api | `agent_query_proactive_work`
`manage_proactive_item_preview` | 预览处理主动事项 | notifications | write | preview | admin, demo, collaborator, system | plans:write | model, api | `agent_preview_manage_proactive_item`
`manage_proactive_item` | 执行处理主动事项 | notifications | write | signed-execute | admin, demo, collaborator, system | plans:write | api, workflow | `agent_manage_proactive_item`
`query_project_execution` | 查询项目执行状态 | planning | read | none | admin, demo, collaborator, viewer, mcp-read, system | plans:read | model, mcp, api | `agent_query_project_execution`
`query_plan_continuation` | 查询计划续接建议 | planning | read | none | admin, demo, collaborator, viewer, mcp-read, system | plans:read | model, mcp, api | `agent_query_plan_continuation`
`manage_task_plan_preview` | 预览管理执行计划 | planning | write | preview | admin, demo, collaborator, system | plans:write | model, api | `agent_preview_manage_task_plan`
`manage_task_plan` | 执行管理任务计划 | planning | write | signed-execute | admin, demo, collaborator, system | plans:write | api, workflow | `agent_manage_task_plan`
`configure_ai_route_preview` | 预览配置模型路由 | security | sensitive | preview | admin, system | settings:write | model, api | `agent_preview_configure_ai_route`
`configure_ai_route` | 执行配置模型路由 | security | sensitive | signed-execute | admin, system | settings:write | api, workflow | `agent_configure_ai_route`
`restore_ai_routing_preview` | 预览恢复模型路由 | security | sensitive | preview | admin, system | settings:write | model, api | `agent_preview_restore_ai_routing`
`restore_ai_routing` | 执行恢复模型路由 | security | sensitive | signed-execute | admin, system | settings:write | api, workflow | `agent_restore_ai_routing`
`create_task_plan` | 创建持续任务计划 | planning | write | none | admin, demo, collaborator, system | plans:write | model, api | `agent_create_task_plan`
`get_task_memory` | 读取任务记忆 | memory | read | none | admin, demo, collaborator, viewer, client, mcp-read, system | memory:read | model, api | `agent_get_task_memory`
`query_enterprise_memory` | 查询企业分层记忆 | memory | read | none | admin, demo, collaborator, viewer, mcp-read, system | memory:read | model, mcp, api | `agent_query_enterprise_memory`
`manage_enterprise_memory_preview` | 预览维护企业记忆 | memory | sensitive | preview | admin, demo, collaborator, system | memory:write | model, api | `agent_preview_manage_enterprise_memory`
`manage_enterprise_memory` | 执行维护企业记忆 | memory | sensitive | signed-execute | admin, demo, collaborator, system | memory:write | api, workflow | `agent_manage_enterprise_memory`
`start_monthly_review` | 启动月度复盘 | analysis | write | none | admin, demo, collaborator, system | analysis:write | model, api | `agent_start_monthly_review`
`start_deep_analysis` | 启动深度分析 | analysis | write | none | admin, demo, collaborator, system | analysis:write | model, api | `agent_start_deep_analysis`
`create_task_preview` | 预览创建任务 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_create_task`
`record_feedback_preview` | 预览记录反馈 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_feedback`
`update_task_status_preview` | 预览修改状态 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_update_status`
`update_task_fields_preview` | 预览修改字段 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_update_fields`
`append_progress_preview` | 预览追加进展 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_progress`
`append_waiting_preview` | 预览记录等待 | write | write | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_waiting`
`manage_record_preview` | 预览维护任务记录 | write | sensitive | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_manage_record`
`mark_acceptance_files_preview` | 预览标记验收文件 | write | write | preview | admin, demo, collaborator, system | attachments:write | model, api | `agent_preview_acceptance_files`
`complete_acceptance_preview` | 预览完整验收 | write | sensitive | preview | admin, demo, collaborator, system | tasks:write, attachments:write | model, api | `agent_preview_acceptance`
`batch_task_operations_preview` | 预览批量任务操作 | write | sensitive | preview | admin, demo, collaborator, system | tasks:write | model, api | `agent_preview_batch_task_operations`
`batch_task_operations` | 执行批量任务操作 | write | sensitive | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_batch_task_operations`
`generate_formal_deliverable_preview` | 预览生成正式交付物 | analysis | sensitive | preview | admin, demo, collaborator, system | tasks:read, attachments:read, analysis:write | model, api | `agent_preview_formal_deliverable`
`generate_formal_deliverable` | 执行生成正式交付物 | analysis | sensitive | signed-execute | admin, demo, collaborator, system | tasks:read, attachments:read, analysis:write | api, workflow | `agent_generate_formal_deliverable`
`cancel_high_risk_action_preview` | 预览撤销高风险操作 | security | sensitive | preview | admin, system | security:write | model, api | `agent_preview_cancel_high_risk_action`
`cancel_high_risk_action` | 执行撤销高风险操作 | security | sensitive | signed-execute | admin, system | security:write | api, workflow | `agent_cancel_high_risk_action`
`acknowledge_high_risk_action` | 确认高风险操作第一重审批 | internal | sensitive | system-only | admin, demo, collaborator, system | security:write | api | `agent_acknowledge_high_risk_action`
`create_task` | 执行创建任务 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_create`
`record_feedback` | 执行记录反馈 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_record_feedback`
`update_task_status` | 执行修改状态 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_update_status`
`update_task_fields` | 执行修改字段 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_update_fields`
`append_progress` | 执行追加进展 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_append_progress`
`append_waiting` | 执行记录等待 | write | write | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_append_waiting`
`manage_record` | 执行维护任务记录 | write | sensitive | signed-execute | admin, demo, collaborator, system | tasks:write | api, workflow | `agent_manage_record`
`mark_acceptance_files` | 执行标记验收文件 | write | write | signed-execute | admin, demo, collaborator, system | attachments:write | api, workflow | `agent_mark_acceptance_files`
`complete_acceptance` | 执行完整验收 | write | sensitive | signed-execute | admin, demo, collaborator, system | tasks:write, attachments:write | api, workflow | `agent_complete_acceptance`
`progress_task_plan` | 推进持续计划 | internal | write | system-only | admin, demo, collaborator, system | plans:write | api | `agent_progress_task_plan`
`workflow_write` | 执行 Workflow 写入 | internal | sensitive | system-only | system | workflow:write | api, workflow | `agent_workflow_write`
`analysis_job_prepare` | 准备后台分析数据 | internal | read | system-only | system | analysis:execute | api, workflow | `agent_analysis_prepare`
`analysis_job_generate` | 生成后台分析报告 | internal | write | system-only | system | analysis:execute | api, workflow | `agent_analysis_generate`
`analysis_job_fail` | 记录后台分析失败 | internal | write | system-only | system | analysis:execute | api, workflow | `agent_analysis_fail`

## 约束

- 模型只能调用标记为 `model` 的能力。
- MCP 只注册标记为 `mcp` 的只读能力。
- 写入预览必须通过 `executeWith` 关联一个签名执行能力；执行能力必须通过 `previewFor` 反向关联。
- Workflow 写入白名单由 `signed-execute + workflow` 自动生成，禁止维护第二份端点列表。
- Worker 鉴权依据注册表中的 method 与 role 判断；业务写入审计事件也直接读取注册表。
- OpenAPI 的通用路径、输入 schema 与 `x-giverny-capabilities` 清单由注册表生成。
