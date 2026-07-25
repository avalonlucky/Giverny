# Agent Capability Registry

> 本文由 `npm run agent-capabilities:generate` 根据 `src/agentToolRegistry.ts` 自动生成，请勿手工维护能力清单。

## 概览

- 注册能力：35 项
- 分类：finance 1、tasks 4、files 1、product 2、planning 1、memory 1、analysis 2、write 18、internal 5
- 单一来源：输入 schema、权限角色、scope、风险、确认方式、审计事件、Runtime 暴露面和执行关系均来自统一注册表。

## 能力清单

能力名 | 标题 | 分类 | 风险 | 确认 | 允许角色 | Scope | 暴露面 | 审计事件
--- | --- | --- | --- | --- | --- | --- | --- | ---
`query_month_finance` | 查询月份财务 | finance | read | none | admin, collaborator, viewer, mcp-read, system | finance:read | model, mcp, api | `agent_read_finance`
`search_tasks` | 搜索任务 | tasks | read | none | admin, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_search_tasks`
`query_task_portfolio` | 查询跨任务工作概况 | tasks | read | none | admin, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_query_portfolio`
`get_task_detail` | 读取任务详情 | tasks | read | none | admin, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_get_task_detail`
`get_requester_profile` | 读取需求人画像 | tasks | read | none | admin, collaborator, viewer, client, mcp-read, system | tasks:read | model, mcp, api | `agent_get_requester_profile`
`search_attachments` | 搜索任务附件 | files | read | none | admin, collaborator, viewer, client, mcp-read, system | attachments:read | model, mcp, api | `agent_search_attachments`
`get_giverny_context` | 读取工作台能力 | product | read | none | admin, collaborator, viewer, client, guest, mcp-read, system | product:read | model, mcp, api | `agent_get_context`
`search_product_help` | 查询产品使用说明 | product | read | none | admin, collaborator, viewer, client, guest, mcp-read, system | product:read | model, mcp, api | `agent_search_product_help`
`create_task_plan` | 创建持续任务计划 | planning | write | none | admin, collaborator, system | plans:write | model, api | `agent_create_task_plan`
`get_task_memory` | 读取任务记忆 | memory | read | none | admin, collaborator, viewer, client, mcp-read, system | memory:read | model, api | `agent_get_task_memory`
`start_monthly_review` | 启动月度复盘 | analysis | write | none | admin, collaborator, system | analysis:write | model, api | `agent_start_monthly_review`
`start_deep_analysis` | 启动深度分析 | analysis | write | none | admin, collaborator, system | analysis:write | model, api | `agent_start_deep_analysis`
`create_task_preview` | 预览创建任务 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_create_task`
`record_feedback_preview` | 预览记录反馈 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_feedback`
`update_task_status_preview` | 预览修改状态 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_update_status`
`update_task_fields_preview` | 预览修改字段 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_update_fields`
`append_progress_preview` | 预览追加进展 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_progress`
`append_waiting_preview` | 预览记录等待 | write | write | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_waiting`
`manage_record_preview` | 预览维护任务记录 | write | sensitive | preview | admin, collaborator, system | tasks:write | model, api | `agent_preview_manage_record`
`mark_acceptance_files_preview` | 预览标记验收文件 | write | write | preview | admin, collaborator, system | attachments:write | model, api | `agent_preview_acceptance_files`
`complete_acceptance_preview` | 预览完整验收 | write | sensitive | preview | admin, collaborator, system | tasks:write, attachments:write | model, api | `agent_preview_acceptance`
`create_task` | 执行创建任务 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_create`
`record_feedback` | 执行记录反馈 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_record_feedback`
`update_task_status` | 执行修改状态 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_update_status`
`update_task_fields` | 执行修改字段 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_update_fields`
`append_progress` | 执行追加进展 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_append_progress`
`append_waiting` | 执行记录等待 | write | write | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_append_waiting`
`manage_record` | 执行维护任务记录 | write | sensitive | signed-execute | admin, collaborator, system | tasks:write | api, workflow | `agent_manage_record`
`mark_acceptance_files` | 执行标记验收文件 | write | write | signed-execute | admin, collaborator, system | attachments:write | api, workflow | `agent_mark_acceptance_files`
`complete_acceptance` | 执行完整验收 | write | sensitive | signed-execute | admin, collaborator, system | tasks:write, attachments:write | api, workflow | `agent_complete_acceptance`
`progress_task_plan` | 推进持续计划 | internal | write | system-only | admin, collaborator, system | plans:write | api | `agent_progress_task_plan`
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
