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
7. 打开工作助手发出普通问题。时间线出现「路由到当前电脑」即表示已由本机 CLI 执行。

关闭运行连接器的终端后，设备会在短时间内显示离线。当前版本需手动保持连接器运行，后续再提供 macOS / Windows 开机自启安装器。

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

当前 Bridge Runtime 版本为 `0.2.0`。工作助手收到请求后，Worker 会用登录身份和 `browserDeviceKey` 精确匹配当前电脑，再将命令放入该设备的短期队列。Bridge 领取命令后启动已选 CLI，逐步回传可展示的执行事件和最终回答。

本机优先的请求：

- 普通问答和本机文件生成；
- 任务、收入、工时、附件和任务详情等只读查询；
- 需要多步分析，但不修改站内业务数据的请求。

云端 Agent 保留的请求：

- 创建任务、修改任务、记录进展/反馈、验收、作废等写入，以保留网页预览确认；
- 图片理解；
- Bridge 离线或低于 `0.2.0`、CLI 不可用、本机超时或执行失败时的自动回退。

## 执行权限

- 每条本机命令会获取一枚 5 分钟有效的 `mcp-read` 令牌，只能调用 Giverny 只读 MCP 工具。
- 令牌在 Bridge 领取后从队列载荷移除，在完成、失败或取消时撤销。
- 命令超时为 180 秒，页面可中途停止。
- 本机工作目录固定为 `~/.giverny/workspace`。
- Codex 使用 `workspace-write` 沙箱和 `never` 批准策略；Claude Code 使用限定工具和严格 MCP 配置；不使用跳过权限的危险参数。

## 后续运维项

1. macOS / Windows 签名安装器、开机自启和 Bridge 自动升级。
2. 租户级设备命名、远程撤销和更细的命令审计界面。
3. 经过明确用户确认的本机文件读取白名单。
