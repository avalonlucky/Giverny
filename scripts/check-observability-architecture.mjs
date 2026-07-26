import { readFileSync } from 'node:fs'
import process from 'node:process'

const files = {
  main: readFileSync('src/main.tsx', 'utf8'),
  errors: readFileSync('src/lib/clientErrorReporter.ts', 'utf8'),
  performance: readFileSync('src/lib/clientPerformanceReporter.ts', 'utf8'),
  api: readFileSync('src/lib/api.ts', 'utf8'),
  worker: readFileSync('src/worker.ts', 'utf8'),
  panel: readFileSync('src/components/AiOperationsCenterPanel.tsx', 'utf8'),
  schema: readFileSync('db/schema.sql', 'utf8'),
  migration: readFileSync('db/migrations/0029_client_performance_observability.sql', 'utf8'),
  cloudflare: readFileSync('wrangler.toml', 'utf8'),
}
const failures = []

if (!files.main.includes('installGlobalErrorReporting()')) failures.push('全局错误监听未在应用入口安装')
if (!files.main.includes('installClientPerformanceReporting()')) failures.push('真实用户性能采集未在应用入口安装')
for (const kind of ['resource-error', 'chunk-load', 'api-error']) {
  if (!files.errors.includes(`'${kind}'`)) failures.push(`前端错误采集缺少 ${kind}`)
}
for (const metric of ['ttfbMs', 'fcpMs', 'lcpMs', 'inpMs', 'cls', 'loadMs']) {
  if (!files.performance.includes(metric)) failures.push(`真实用户性能采集缺少 ${metric}`)
}
if (!files.api.includes("kind: 'api-error'")) failures.push('API 网络与 5xx 未接入统一错误上报')
if (!files.worker.includes("path === '/api/client-performance'")) failures.push('Worker 缺少前端性能上报接口')
if (!files.worker.includes("'-30 days'")) failures.push('前端性能样本缺少保留期限')
if (!files.worker.includes("'-90 days'")) failures.push('前端错误样本缺少保留期限')
if (!files.worker.includes("fingerprint: 'client-core-vitals-poor'")) failures.push('核心体验恶化不会生成运行告警')
if (!files.worker.includes("fingerprint: 'client-error-occurrences'")) failures.push('前端错误激增不会生成运行告警')
if (!files.panel.includes('clientPerformance.p75')) failures.push('管理端未展示真实用户 P75 指标')
if (!files.panel.includes('client-error-stack')) failures.push('管理端无法查看脱敏错误栈')
if (!files.schema.includes('CREATE TABLE IF NOT EXISTS client_performance_events')) failures.push('主 schema 缺少前端性能表')
if (!files.migration.includes('idx_client_performance_version_path')) failures.push('前端性能 migration 缺少版本/路由索引')
if (!/\[observability\][\s\S]*enabled\s*=\s*true[\s\S]*head_sampling_rate\s*=\s*0\.1/.test(files.cloudflare)) {
  failures.push('Cloudflare Workers Logs 与请求采样未启用')
}
if (!/\[observability\.traces\][\s\S]*enabled\s*=\s*true[\s\S]*head_sampling_rate\s*=\s*0\.05/.test(files.cloudflare)) {
  failures.push('Cloudflare Workers 原生 Tracing 与独立采样未启用')
}
for (const span of ['agent.understand_and_plan', 'agent.execute_tools', 'agent.compose_and_verify', 'attachment.analysis']) {
  if (!files.worker.includes(`'${span}'`)) failures.push(`Worker 缺少隐私安全业务 span：${span}`)
}
for (const forbidden of ['cleanQuery)', 'args.question)', 'row.file_name)', 'payload.answer)']) {
  if (files.worker.includes(`span.setAttribute(${forbidden}`)) failures.push(`业务 span 禁止记录敏感正文：${forbidden}`)
}

if (failures.length > 0) {
  console.error(`生产监控架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('生产监控架构守卫通过：错误、Web Vitals、告警、Workers Logs 与隐私安全 Tracing 链路完整。')
