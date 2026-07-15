# Giverny MCP Server

Giverny 在 `https://mayeai.com/mcp` 提供基于 Streamable HTTP 的远程 MCP Server。它与站内爱丽丝共用同一份只读工具注册表和 Worker 业务实现，不建立第二套数据口径。

## 当前工具

- `query_month_finance`：查询月份收入、总工时、计费工时和结算统计。
- `search_tasks`：按月份、状态意图、标题、需求或人员搜索任务。
- `search_attachments`：按任务、文件名、需求、标签或月份搜索附件，返回结构化文件元数据以及受权限保护的预览/源文件路径。
- `get_task_detail`：读取明确任务的详情、进展、附件和验收信息。
- `get_giverny_context`：读取 Giverny 能力范围。

所有 MCP 工具均标记为只读、幂等、非破坏性。创建任务、记录反馈、修改状态、修改字段和追加进展不向 MCP 开放。

## 创建口令

1. 管理员进入“设置 → 权限安全”。
2. 创建访问口令时选择 `MCP 只读`。
3. 复制生成的 `wk_...` 口令，并把它作为 MCP 客户端的 Bearer Token。

`MCP 只读`口令不能登录网站，不能调用 `/api/agent/tools/*`，也不能访问任何写入工具。停用、到期或删除口令后，MCP 权限立即失效。

## 客户端配置

- URL：`https://mayeai.com/mcp`
- Transport：`streamable-http`
- Header：`Authorization: Bearer <MCP 只读口令>`

不同客户端的配置界面不同，但必须支持远程 Streamable HTTP 和自定义 Authorization Header。不要把管理员密码、`AGENT_TOOL_TOKEN` 或模型 API Key 填入 MCP 客户端。

## 验证

`npm run agent:eval:isolated` 会自动检查：

- 未授权 MCP 请求返回 401。
- MCP 口令不能登录网站。
- 工具清单只包含五个只读工具。
- `search_attachments` 能返回真实的结构化附件列表。
- `get_giverny_context` 能通过 MCP 协议实际调用。
- 原有 Agent 查询、写入预览、消歧和安全用例不受影响。

## 后续边界

当前版本面向单管理员环境，采用可撤销的专用 Bearer Token。未来需要给多个外部用户或第三方组织授权时，再接入 OAuth 2.1 动态客户端注册、授权同意页和细粒度 scopes；在此之前不开放 MCP 写入能力。
