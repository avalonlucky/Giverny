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

Bridge 侧：

- `POST /api/local-cli/bridge/pair`
- `POST /api/local-cli/bridge/heartbeat`
- `GET /api/local-cli/bridge/commands`
- `POST /api/local-cli/bridge/commands/:id/complete`

D1 migration：`db/migrations/0022_local_cli_bridge.sql`。数据表分别保存一次性配对、设备、CLI 适配器和短期命令。

## 当前边界与下一阶段

本版本只完成设备配对、扫描、测试、状态展示和连接选择。工作助手的实际回答仍走云端 `AliceAgent`，不会因为页面显示「已连接」就静默切换到本机 CLI。

下一阶段需要在现有协议上增加：

1. 明确的「云端 / 本机」会话路由与随时回退。
2. `run / stream / cancel / resume` 命令和逐步事件回传。
3. 每个 CLI 独立的权限白名单、工作目录和超时。
4. CLI 侧 MCP 工具接入，但继续沿用 Giverny 的确认后写入规则。
5. macOS / Windows 签名安装器、开机自启和升级机制。当前 PowerShell 与 shell 命令均已支持手动安装。
6. 租户级设备管理、远程撤销、审计日志和设备命名。
