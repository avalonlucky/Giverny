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
3. 涉及新增 D1 migration 时，先在隔离环境验证，再应用正式迁移。
4. 部署正式站。
5. 验证 `https://mayeai.com/` 资源版本和关键变更是否生效。
6. 线上关键路径回归；如发现问题，继续本地修改、验证并重新部署正式站。
7. 回归通过后，直接执行 GitHub commit / push / tag / Release 发布闭环。

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
mkdir -p /private/tmp/giverny-npm-cache
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy \
  npm_config_cache=/private/tmp/giverny-npm-cache \
  WRANGLER_LOG_PATH=/private/tmp/giverny-wrangler.log \
  npx wrangler deploy
```

桌面沙箱下不要直接使用用户级 `~/.npm` 缓存或 `~/.wrangler/logs`：这些目录可能因旧权限或沙箱写入限制导致 `EPERM`。正式部署统一把临时 npm 缓存和 Wrangler 日志都指向 `/private/tmp`，无需修改系统权限。

如果直连 Cloudflare API 在 DNS 或网络层面超时，而默认代理可以访问 `https://api.cloudflare.com/client/v4/`，可以保留代理环境变量重试部署，但仍要保留上面的 `npm_config_cache=/private/tmp/giverny-npm-cache` 和 `WRANGLER_LOG_PATH=/private/tmp/giverny-wrangler.log`，便于排查。

## 数据安全

正式站已经进入试运营，不要在正式 D1/R2 上做清表测试或无意义测试上传。涉及数据结构、结算口径、文件删除、权限等高风险改动时，先在本地或临时隔离环境验证清楚，再部署正式站。

Agent 评测统一使用 `agent-evals/run-isolated.mjs` 创建的临时本地 D1。不要把固定评测任务写入正式库；在线专项评测必须携带 `x-giverny-agent-eval: 1`，避免污染真实运行质量统计。
