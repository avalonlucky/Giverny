# Production Deployment

## 当前环境

- 正式站：`https://mayeai.com`
  - Worker：`designer-worklog`
  - D1：`designer-worklog-db`
  - R2：`designer-worklog-uploads`

预发布测试站已彻底下线，不再维护测试域名、测试 Worker、测试 D1 或测试 R2。后续不要再使用预发布环境部署命令。

## 默认流程

> **费用红线优先于默认发布闭环。** 真实模型 API 回归、付费资源创建/扩容或任何可能新增费用的步骤，必须先说明供应商、最大调用/资源范围、预计费用与停止条件，并取得项目所有者本轮明确批准。没有明确批准时只完成本地、Mock、静态验证和不调用模型的健康检查。详见 `docs/AI_COST_AND_MODEL_GOVERNANCE.md`。

用户已明确要求：以后涉及代码或前端体验的改动，不要只停留在本地，也不再额外等待人工验收确认。完成本地验证、正式站部署和线上关键路径回归后，默认直接同步 GitHub、tag 和 Release。

1. 本地修改。
2. 如修改 `agent-runtime/`，先运行 Python 单元测试、ADK 语义评测和容器健康检查；再跑 `npm run agent:quality:gate`。
3. 涉及新增 D1 migration 时，先用本地 SQLite 验证，再通过 `npm run db:apply:production -- db/migrations/<file>.sql` 调用 Cloudflare D1 HTTP API 应用正式迁移。
4. 运行 `npm run infra:check` 核对主队列、DLQ、消费者和 Workers Tracing；发布命令会在构建后自动运行 `npm run infra:sync`，发现漂移时通过 Cloudflare HTTP API 幂等修复。
5. 部署正式站。HTTP API 发布器先上传候选版本，定向核对健康、事实协议、版本和资源，通过后才推广；失败自动回滚上一版本。
6. 验证 `https://mayeai.com/` 资源版本和关键变更是否生效。
7. 线上关键路径回归；如发现问题，继续本地修改、验证并重新部署正式站。
8. 回归通过后，直接执行 GitHub commit / push / tag / Release 发布闭环。

## Google ADK Runtime

- ADK 作为独立 Python systemd 服务发布到现有 DMIT VPS，不使用 Google Cloud Run、Cloudflare Containers 或 Docker，也不需要 Wrangler。
- Google ADK 不固定调用 Gemini。Worker 必须把设置中本轮选择的精确 `provider/model/baseUrl` 传给 DMIT Runtime；DeepSeek 等 OpenAI 兼容服务商通过受控 LiteLLM 适配器调用。
- Scope Supervisor、Coordinator、专家与 Evidence Auditor 必须全部使用同一个所选模型；回答 JSON 由本地强类型协议解析，不调用隐藏格式化模型。ADK 回包声明实际 provider/model，Worker 做一致性校验；配置缺失或不一致时失败关闭，禁止静默回退。
- **约束一轮规模的是时间，不是次数。** 单轮总预算 `ADK_TURN_BUDGET_SECONDS`（默认 240 秒）是真正的边界：所选模型开推理后单次调用约 15–25 秒，一轮实际最多十几次。模型调用次数上限（当前 39，按阶段拆分）只是防止专家之间来回转交转到超时的开关，不是费用预算，正常问答用不到。Worker 校验「边界确实存在且收在 280 秒之内」，不钉死具体数字。用光任一边界时必须软着陆成一句可操作的回答，不得把框架异常抛给用户。DMIT Runtime 固定单进程、`MemoryHigh=900M`、`MemoryMax=1200M`；禁止沿用 ADK 默认的 500 次调用上限或无审批扩大资源。
- Worker 只保存 `ADK_AGENT_URL` 和 `ADK_AGENT_KEY`。两者未就绪时 `/api/ai/chat` 必须失败关闭，禁止回退 LangGraph/Alice 或本地模板回答。
- 发布顺序：DMIT Runtime 的本机与公网 `/health` -> VPN PID/端口核对 -> Worker 变量/密钥 -> `npm run deploy:production` -> `/api/health?runtime=1` 无模型探针。真实语义回归只有取得费用批准后才执行。
- **对话必须走流式端点 `POST /v1/chat/stream`。** 编排耗时 60–150 秒，非流式的 `/v1/chat` 在这段时间不产生任何字节，Cloudflare 会掐断 Worker 的子请求并合成 **HTTP 520**，Runtime 已经返回的 200 会被丢弃。流式端点在空闲时下发 `: keep-alive` 注释帧维持字节流动；供应商真实 thought 与工具/阶段执行进度使用两个独立字段下发。**Worker 的所有调用方一律走流式端点**：没有 trace sink 时在 Worker 内部收完再整体返回，非流式路径不再存在，520 对 MCP、脚本和非 SSE 的 `/api/ai/chat` 一并消失。`/v1/chat` 只保留给隔离评测与外部诊断。
- **超时预算必须逐层收敛：Runtime 单轮总预算 `ADK_TURN_BUDGET_SECONDS`（默认 240 秒，硬上限 270）< Worker 子请求 280 秒。** 各阶段只能在总预算的剩余额度里取用 `ADK_REQUEST_TIMEOUT_SECONDS`。三个阶段各拿一份 150 秒的话，最坏可跑到 450 秒，Worker 会先单方面掐断，用户白等四分多钟才看到失败。
- **握手帧 `accepted` 携带 `reasoning`**，声明本轮是否向供应商申请了推理输出。混合推理模型（DeepSeek V4）必须显式打开开关才会返回推理内容，开关经 LiteLLM 的 `extra_body` 透传——顶层 `thinking` 参数在 openai 兼容路由上会直接抛 `UnsupportedParamsError`，导致每个请求失败。推理输出会产生推理 token，费用高于关闭推理。
- **DMIT Runtime 必须先于 Worker 发布。** Worker 一旦上线就会请求 `/v1/chat/stream`；若 Runtime 仍是旧代码或未启动，对话会整体失败关闭，因此顺序不可颠倒。
- Runtime 使用 `179.253.249.92.sslip.io:8443` 的独立 Let’s Encrypt TLS。防火墙只新增 IPv4 TCP 8443；不得重载 Xray/x-ui、占用 443/2096/24443/42989，证书续期只允许 `try-restart giverny-adk.service`。
- **`/health` 的 `contract` 字段是发布顺序的判据。** 当前契约为 `bounded-by-time-1`。Worker 发布前必须先看到 Runtime 报出这个值，不能只凭"我已经更新了"这句话。`/api/health?runtime=1` 会把它透出来。

### Runtime 发布步骤（DMIT VPS）

代码更新在现有套餐内，不新增费用；不得升级套餐或新建实例。契约变更时必须先做这一步，再发 Worker。

发布目录是 `/opt/giverny-adk/current`（systemd 的 `WorkingDirectory`，`app/` 直接在其下）。
它是 git 检出还是同步副本，取决于首次部署方式；`git pull` 失败时改用 rsync 同步 `agent-runtime/` 的内容。

```bash
# 1) 拉取新代码到发布目录
ssh root@179.253.249.92
cd /opt/giverny-adk/current && git pull --ff-only

# 2) 依赖有变动时才需要（本轮 requirements.txt 未变，可跳过）
/opt/giverny-adk/venv/bin/pip install -r agent-runtime/requirements.txt

# 3) 总预算写入环境文件（缺省 240 秒，可省略这一步）
grep -q ADK_TURN_BUDGET_SECONDS /etc/giverny-adk/runtime.env \
  || echo 'ADK_TURN_BUDGET_SECONDS=240' >> /etc/giverny-adk/runtime.env

# 4) 重启并核对契约
systemctl restart giverny-adk.service
systemctl is-active giverny-adk.service
curl -s https://179.253.249.92.sslip.io:8443/health | python3 -m json.tool
#    期望：ok=true、contract="bounded-by-time-1"、turnBudgetSeconds=240

# 5) 核对 VPN 端口未被影响
ss -lntp | grep -E ':(443|2096|8443|24443|42989)'
```

失败回滚：`git checkout <上一个 tag> && systemctl restart giverny-adk.service`。
推理开关若被供应商拒绝（表现为每个请求立刻 400），把 `agent-runtime/app/agents.py` 里三处 `reasoning=True` 改成 `False` 后重启即可，不必整体回滚。

### 双域名静态资源核对

- 每次 Worker 部署后必须分别读取 `https://mayeai.com/` 与 `https://www.mayeai.com/` 的 HTML，确认两边引用的 `assets/index-*.js` 都是本次构建哈希；只检查健康接口不足以证明前端已更新。
- `npm run deploy:production` 在 HTTP API Direct Upload 后必须执行 `npm run agent:fact:production`；正式 `/api/health` 只有在结构化事实协议正确摘要通过、错误事实被拒绝且来源覆盖完整时才返回健康。
- Cloudflare 不同主机名或边缘节点可能在部署后的短时间内继续返回旧 HTML。发现哈希不一致时，先对照 workers.dev 入口和裸域名确认源版本，再等待边缘传播并复查；具备 Cache Purge 权限时才执行主动清理。
- 发布闭环只能在线上健康接口正常、两个正式域名资源一致、关键路由真实浏览器回归通过后继续。候选版本验收失败时发布器会把上一稳定版本恢复为 100% 流量并以失败退出。

只有用户明确要求暂停、仅部署或等待人工验收时，才停在 GitHub 闭环之前；其他情况必须在同一轮完整收录本次改动，并保持正式站版本、代码、tag 与 Release 一致。

## GitHub 部署记录

仓库提供一个手动触发的 GitHub Actions workflow：`.github/workflows/record-production-deployment.yml`。

这个 workflow 通过 GitHub Actions 的 `production` environment 在 GitHub 右侧生成 deployment 记录，方便查看正式站什么时候完成过部署或线上验证。它不会执行 `wrangler deploy`，不会读取 Cloudflare API Token，也不会改动正式站资源。

使用方式：

1. 在 GitHub 仓库进入 `Actions`。
2. 选择 `Record production deployment`。
3. 点击 `Run workflow`。
4. 在 `description` 里写清楚本次线上部署或验证内容。

如果以后要改成 GitHub Actions 自动部署 Cloudflare Worker，必须单独新增部署 workflow，并在接入前确认触发条件、Cloudflare Token 权限和正式站影响范围。

## 常用命令

```bash
npm run lint
npm run build
npm run agent:quality:gate
npm run db:apply:production -- db/migrations/<file>.sql
npm run deploy:production
```

### 禁止 Wrangler

用户已明确要求永久停用 Wrangler。不得执行 `wrangler` / `npx wrangler`，也不得在 Direct Upload 失败时回退 Wrangler。`scripts/deploy-cloudflare-api.mjs` 使用 Cloudflare 官方 Workers Scripts 与 Static Assets HTTP API，自动继承线上已有绑定并上传新 Worker 模块和 `dist` 资源。

发布凭证优先读取 `CLOUDFLARE_API_TOKEN`；本机 OAuth 凭证独立保存在 `~/.config/giverny/cloudflare-auth.json`（权限 `0600`）。HTTP API 发布器每次发布前自动刷新短期访问令牌并原子更新本地凭证，不读取 Wrangler 配置路径。API 认证失败时应修复 Giverny 独立凭证，不能恢复 Wrangler。

D1 migration 同样不使用 Wrangler。`scripts/apply-cloudflare-d1-sql.mjs` 只接受明确传入的 SQL 文件，逐条通过 Cloudflare D1 Query API 执行；正式执行前必须确认 SQL 可重复运行且不包含清表、覆盖金额或改写既有业务数据的语句。

Worker 发布使用 Cloudflare Versions 与 Deployments HTTP API。候选版本只占 0.01% 普通流量，发布器通过版本覆盖请求定向检查候选版本；健康、事实协议、版本号或静态资源任一不一致时立即把上一版本恢复为 100%。代码回滚不会回滚 D1/R2，因此 migration 必须向后兼容。

## 数据安全

正式站已经进入试运营，不要在正式 D1/R2 上做清表测试或无意义测试上传。涉及数据结构、结算口径、文件删除、权限等高风险改动时，先在本地或临时隔离环境验证清楚，再部署正式站。

Agent 评测统一使用 `agent-evals/run-isolated.mjs` 创建的临时本地 D1。不要把固定评测任务写入正式库；在线专项评测必须携带 `x-giverny-agent-eval: 1`，避免污染真实运行质量统计。

本机和 CI 的 Agent/浏览器评测由 `agent-evals/isolated-runtime.mjs` 直接调用 Cloudflare Miniflare API，不读取 Wrangler 配置。每次评测创建独立的 workerd、D1、R2、SQLite Durable Object 和 Workflow 存储；存储目录带 `.metadata_never_index`，并在正常、失败、信号中断与进程退出时清理。
