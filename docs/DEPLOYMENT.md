# Production Deployment

## 当前环境

- 正式站：`https://mayeai.com`
  - Worker：`designer-worklog`
  - D1：`designer-worklog-db`
  - R2：`designer-worklog-uploads`

预发布测试站已彻底下线，不再维护测试域名、测试 Worker、测试 D1 或测试 R2。后续不要再使用预发布环境部署命令。

## 默认流程

用户已明确要求：以后涉及代码或前端体验的改动，不要只停留在本地，也不再额外等待人工验收确认。完成本地验证、正式站部署和线上关键路径回归后，默认直接同步 GitHub、tag 和 Release。

1. 本地修改。
2. 跑 `npm run agent:quality:gate`（包含 build、lint 和隔离 Agent 全链路评测）。
3. 涉及新增 D1 migration 时，先用本地 SQLite 验证，再通过 `npm run db:apply:production -- db/migrations/<file>.sql` 调用 Cloudflare D1 HTTP API 应用正式迁移。
4. 运行 `npm run infra:check` 核对主队列、DLQ、消费者和 Workers Tracing；发布命令会在构建后自动运行 `npm run infra:sync`，发现漂移时通过 Cloudflare HTTP API 幂等修复。
5. 部署正式站。HTTP API 发布器先上传候选版本，定向核对健康、事实协议、版本和资源，通过后才推广；失败自动回滚上一版本。
6. 验证 `https://mayeai.com/` 资源版本和关键变更是否生效。
7. 线上关键路径回归；如发现问题，继续本地修改、验证并重新部署正式站。
8. 回归通过后，直接执行 GitHub commit / push / tag / Release 发布闭环。

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
