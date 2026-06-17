# Production Deployment

## 当前环境

- 正式站：`https://mayeai.com`
  - Worker：`designer-worklog`
  - D1：`designer-worklog-db`
  - R2：`designer-worklog-uploads`

预发布测试站已彻底下线，不再维护测试域名、测试 Worker、测试 D1 或测试 R2。后续不要再使用预发布环境部署命令。

## 默认流程

用户已明确要求：以后涉及代码或前端体验的改动，不要只停留在本地。完成本地实现和验证后，直接部署到正式站。

1. 本地修改。
2. 跑 `npm run lint`。
3. 跑 `npm run build`。
4. 部署正式站。
5. 验证 `https://mayeai.com/` 资源版本和关键变更是否生效。

## GitHub 部署记录

仓库提供一个手动触发的 GitHub Actions workflow：`.github/workflows/record-production-deployment.yml`。

这个 workflow 只负责在 GitHub 右侧生成 production deployment 记录，方便查看正式站什么时候完成过部署或线上验证。它不会执行 `wrangler deploy`，不会读取 Cloudflare API Token，也不会改动正式站资源。

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
env -u ALL_PROXY -u HTTPS_PROXY -u HTTP_PROXY -u all_proxy -u https_proxy -u http_proxy npx wrangler deploy
```

## 数据安全

正式站已经进入试运营，不要在正式 D1/R2 上做清表测试或无意义测试上传。涉及数据结构、结算口径、文件删除、权限等高风险改动时，先在本地或临时隔离环境验证清楚，再部署正式站。
