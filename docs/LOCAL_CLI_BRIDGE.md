# Local CLI Bridge

## 目标

让 Giverny 网页识别“当前登录账号在当前浏览器所在电脑”安装的 Agent CLI。它面向未来多租户场景：管理员、成员或甲方在各自电脑登录后，只能配对和选择自己账号下、当前浏览器登记的设备。

浏览器受安全沙箱限制，不能直接扫描本机可执行文件。因此系统使用轻量 Node 连接器 `public/giverny-bridge.mjs`。连接器只向 Giverny 发起 HTTPS 出站请求，不监听本机端口，也不上传 CLI 登录文件或密钥。

## 使用流程

1. 登录 Giverny，进入「设置 → 本机 CLI」。
2. 点击「扫描这台电脑」，系统生成 10 分钟有效的一次性配对码。
3. 下载连接器，选择 macOS / Linux 或 Windows，并在当前电脑终端运行页面给出的命令。
4. 页面自动出现当前设备和已发现的 CLI。
5. 点击「测试并重新扫描」可重新检查版本、登录态和结构化输出能力。
6. 在状态为「可用」的 CLI 右侧点击「连接」。同一设备同一时间只选择一个 CLI。
7. 打开工作助手并选择「自动 · 本机 CLI」后发出普通问题。时间线显示当前电脑与 CLI 名称，即表示该请求已由本机 CLI 执行。

macOS 安装命令会把连接器注册为开机常驻服务；关闭最初执行安装的终端后仍可保持在线。Bridge 0.4.0 起会通过心跳检查同源更新，校验目标版本、下载来源和脚本内容后原子替换，并由系统服务自动重启。0.3.x 不具备更新器，需要重新下载一次 0.4.0，后续版本即可自动升级。

## 状态含义

- `可用`：已找到可执行文件，并通过版本与安全调用方式检查，可以选择连接。
- `已连接`：当前登录账号、当前浏览器设备已选中该 CLI。
- `需要登录`：CLI 已安装，但本机尚未完成该 CLI 自身的账号登录。
- `待适配`：检测到 CLI，但未确认安全、无交互、结构化的调用协议，因此不会启用。
- `Bridge 已在线 / 离线`：连接器最近是否持续发送心跳，与 CLI 自身账号状态无关。

## 当前适配矩阵

| CLI | 发现 | 登录态检查 | 结构化输出 | 当前选择 |
| --- | --- | --- | --- | --- |
| Codex CLI | 支持 | 支持 | JSONL / MCP | 支持 |
| Claude Code | 支持 | 支持 | stream-json / MCP | 支持 |
| Grok Build | 支持 | 部分支持 | streaming-json / MCP | 支持，首次运行可能仍需登录 |
| Antigravity | 支持 | 暂不启用 | 尚未确认安全协议 | 待适配 |

Antigravity 检测不会调用 `--dangerously-skip-permissions` 等跳过权限参数。只有确认官方、安全、可审计的无头结构化协议后才会开放连接。

## 多租户与安全模型

- 配对码由加密安全随机数生成，10 分钟过期且只能消费一次。
- 设备记录绑定 `principal_id` 和浏览器设备键；其他登录身份无法查询、扫描、选择或撤销该设备。
- Bridge 长期凭证只在本机保存，服务端只保存哈希；数据库泄露也不能还原连接凭证。
- Bridge 使用短轮询领取命令并回传结果，服务端没有访问本机文件系统的入站通道。
- 扫描只返回 CLI 名称、版本、路径、能力和登录状态，不上传 CLI 配置、对话、账号令牌或 SSH 密钥。
- 每次选择连接都由网页中的登录用户主动执行，不根据机器名自动跨账号复用。

## API 与数据

浏览器侧：

- `POST /api/local-cli/pairings`
- `GET /api/local-cli/devices?browserDeviceKey=...`
- `POST /api/local-cli/devices/:id/scan`
- `POST /api/local-cli/devices/:id/select`
- `DELETE /api/local-cli/devices/:id`
- `GET /api/local-cli/commands/:id`
- `POST /api/local-cli/commands/:id/cancel`

Bridge 侧：

- `POST /api/local-cli/bridge/pair`
- `POST /api/local-cli/bridge/heartbeat`
- `GET /api/local-cli/bridge/commands`
- `GET /api/local-cli/bridge/commands/:id`
- `POST /api/local-cli/bridge/commands/:id/events`
- `POST /api/local-cli/bridge/commands/:id/complete`

D1 migration：`db/migrations/0022_local_cli_bridge.sql`。数据表分别保存一次性配对、设备、CLI 适配器和短期命令。

## 工作助手路由

当前 Bridge Runtime 版本为 `0.4.0`。只有工作助手选择「自动 · 本机 CLI」时，Worker 才会用登录身份和 `browserDeviceKey` 精确匹配当前电脑，再按请求类型选择站内只读工具、本机 CLI 或云端 Agent。用户明确选择 DeepSeek、豆包、Kimi、Gemini 或 Workers AI 时会直接调用该云端模型，不创建本机命令。

快捷键、功能入口、模型路由和权限边界由 Worker 查询共享产品能力注册表，不再为产品说明启动 CLI。基础金额、工时合计等确定性数据由 Worker 直接调用站内只读工具计算。任务概览等需要语言组织的只读请求，会先由 Worker 从 D1 预取受权限约束的数据摘要，再交给 CLI 分析；数据不足时 CLI 仍可调用短期 MCP 只读工具。月度趋势、跨月复盘等后台深度分析直接进入云端 Agent。Codex 每轮使用全新的受控执行，避免恢复旧会话时出现 `Reconnecting` 重试；最近对话由 Worker 作为文本上下文传入。

运行时采用“CLI 大脑 + 网站身体”的权限分层：CLI 负责理解、分析和选择只读工具；D1、R2、任务写入、身份校验和确认流程仍由网站 Worker 执行。CLI 不会获得数据库凭证，也不能绕开网站权限直接修改业务数据。

本机优先的请求：

- 普通问答和本机文件生成；
- 任务、收入、工时、附件和任务详情等只读查询；
- 需要多步分析，但不修改站内业务数据的请求。

云端 Agent 保留的请求：

- 创建任务、修改任务、记录进展/反馈、验收、作废等写入，以保留网页预览确认；
- 月度趋势、跨月复盘等需要后台聚合和持久化结果的深度分析；
- 图片理解；
- Bridge 离线或低于兼容版本 `0.4.0`、CLI 不可用、本机超时或执行失败时的自动回退。

## 执行权限

- 每条本机命令会获取一枚 5 分钟有效的 `mcp-read` 令牌，只能调用 Giverny 只读 MCP 工具。
- 令牌在 Bridge 领取后从队列载荷移除，在完成、失败或取消时撤销。
- 普通问答和轻量分析的本机等待上限为 12 秒；明确的本机文件、代码、脚本和深度多步任务为 45 秒。超时会停止命令并撤销 MCP 令牌，迟到结果不会覆盖回退状态；确定性站内查询不进入该等待流程。
- 本机工作目录固定为 `~/.giverny/workspace`。
- Codex 使用 `workspace-write` 沙箱和 `never` 批准策略；Claude Code 使用限定工具和严格 MCP 配置；不使用跳过权限的危险参数。

## Codex 启动与网络环境

- macOS `launchd` 不会继承用户终端里的 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY`。Bridge 会先使用自身环境变量；没有时通过系统网络配置读取已启用的 HTTP、HTTPS 或 SOCKS 代理，并只注入 Codex 子进程。心跳和运行记录只上报 `environment`、`system` 或 `direct`，不会上报代理主机和端口。
- Codex 在 `~/.giverny/codex-runtime` 使用专用运行目录。Bridge 从用户 Codex 配置中复制模型、模型服务商、推理等级和模型目录配置，并以权限 `0600` 保存；登录文件使用本机符号链接，不上传。Skills、Plugins、Apps 和无关 MCP 不会进入工作助手运行。
- Bridge 启动时缓存已扫描的 CLI 路径、版本和登录态；运行问答直接复用该缓存，不再同步重跑所有 CLI 的版本与登录检查。只有 Bridge 启动或网页点击「测试并重新扫描」才执行完整扫描。
- 不能直接使用 `--ignore-user-config`：部分桌面 Codex 使用自定义模型服务商，完全忽略配置会丢失服务商与认证并得到 401。隔离目录的目标是保留模型连接必需项，同时去掉开发环境扩展。
- 普通问答的 Codex 子进程预算为 12 秒，并覆盖为 Codex 低推理等级；本机直接基准由默认推理等级的约 10.5 秒降至约 3.0 秒。网页端另预留 3 秒给 Bridge 的轮询领取和完成回传，因此端到端回退上限为 15 秒。本机文件或复杂多步任务的子进程预算为 45 秒并保留用户原有推理等级，网页上限为 48 秒。Bridge 允许的保护范围为 5–50 秒，不再把 12 秒错误抬高到 30 秒。Worker 将命令标记为过期后，Bridge 在轮询到状态时立即终止子进程。
- Codex 的 `item.completed / agent_message` 和 Claude 的最终 `result` 会设置 `contentFinal`。Worker 收到最终内容即可原子完成命令并返回用户，不等待 CLI 进程退出；Bridge 随后的完成回调只得到 `alreadyCompleted`，不能把已交付结果改成失败。

## 运行诊断

`local_cli_commands.result_json` 保存安全诊断字段：`bridgeStartedAt`、`cliSpawnedAt`、`firstEventAt`、`firstContentAt`、`completedAt`、`durationMs`，以及 `proxyMode`、`configMode`、`bridgeVersion`。据此可区分：

- `created_at → claimed_at` 高：Bridge 离线或轮询异常；
- `cliSpawnedAt → firstEventAt` 高：CLI 启动、配置或插件初始化异常；
- 已收到 `thread.started / turn.started`，但 `firstContentAt` 长时间为 0：模型网络或上游响应异常；
- `firstContentAt → completedAt` 高：回答生成、MCP 工具或本机任务本身耗时。

诊断不得保存 Prompt、代理地址、模型 Key、Bridge Token 或 MCP Token。命令完成、失败、取消或过期后，短期 MCP Token 都必须撤销；迟到结果不能覆盖终态。

## 后续运维项

1. Windows 签名安装器与系统服务级自动升级。
2. 租户级设备命名、远程撤销和更细的命令审计界面。
3. 经过明确用户确认的本机文件读取白名单。
