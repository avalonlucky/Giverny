# Giverny AI Runtime

独立 Node.js AI Runtime，用来真正运行 BAML client。主站 Cloudflare Worker 不直接 import BAML runtime，避免 Worker 打包 Node 原生 `.node` 模块失败。

## 本地运行

```bash
npm run baml:generate
cd ai-runtime
npm install
AI_RUNTIME_KEY=dev-runtime-key npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8080/health
```

## 环境变量

- `PORT`：服务端口，默认 `8080`。
- `AI_RUNTIME_KEY`：主站调用 runtime 时使用的共享密钥。生产环境必须设置。

## 主站调用方式

主站 Worker 会读取设置页保存的模型配置，并向 runtime 发送：

- `POST /v1/suggest-task`
- `POST /v1/optimize-text`
- `POST /v1/suggest-hours`

每次请求都包含本次租户选择的 `provider`、`model`、`baseUrl` 和解密后的 `apiKey`。这样后续多租户上线后，不需要把模型密钥写死在部署环境里。
