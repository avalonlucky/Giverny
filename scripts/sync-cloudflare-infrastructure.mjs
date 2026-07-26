import process from 'node:process'
import { cloudflareAccountRequest, loadCloudflareToken } from './lib/cloudflare-api.mjs'

const workerName = 'designer-worklog'
const mainQueueName = 'worklog-analysis'
const deadLetterQueueName = 'worklog-analysis-dlq'
const checkOnly = process.argv.includes('--check')

const desiredConsumers = [
  {
    queueName: mainQueueName,
    deadLetterQueue: deadLetterQueueName,
    settings: { batch_size: 3, max_wait_time_ms: 10_000, max_retries: 3 },
  },
  {
    queueName: deadLetterQueueName,
    deadLetterQueue: '',
    settings: { batch_size: 3, max_wait_time_ms: 10_000, max_retries: 0 },
  },
]

const desiredTraces = { enabled: true, head_sampling_rate: 0.05 }

function listFrom(value, key) {
  if (Array.isArray(value)) return value
  return Array.isArray(value?.[key]) ? value[key] : []
}

function sameNumber(left, right) {
  return Number(left) === Number(right)
}

function consumerMatches(consumer, desired) {
  return (consumer?.script_name || consumer?.script) === workerName
    && String(consumer?.dead_letter_queue || '') === desired.deadLetterQueue
    && sameNumber(consumer?.settings?.batch_size, desired.settings.batch_size)
    && sameNumber(consumer?.settings?.max_wait_time_ms, desired.settings.max_wait_time_ms)
    && sameNumber(consumer?.settings?.max_retries, desired.settings.max_retries)
}

async function listQueues(token) {
  const value = await cloudflareAccountRequest(token, '/queues?per_page=100')
  return listFrom(value, 'queues')
}

async function ensureQueue(token, queues, queueName, drift) {
  const existing = queues.find((queue) => queue.queue_name === queueName)
  if (existing) return existing
  drift.push(`缺少队列 ${queueName}`)
  if (checkOnly) return null
  const created = await cloudflareAccountRequest(token, '/queues', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queue_name: queueName }),
  })
  process.stdout.write(`已创建队列：${queueName}\n`)
  queues.push(created)
  return created
}

async function ensureConsumer(token, queue, desired, drift) {
  if (!queue?.queue_id) return
  const value = await cloudflareAccountRequest(token, `/queues/${queue.queue_id}/consumers`)
  const consumers = listFrom(value, 'consumers')
  const existing = consumers.find((consumer) => (consumer.script_name || consumer.script) === workerName && consumer.type === 'worker')
  if (existing && consumerMatches(existing, desired)) return

  drift.push(`${desired.queueName} 的 Worker 消费者配置不一致`)
  if (checkOnly) return
  const body = {
    script_name: workerName,
    type: 'worker',
    ...(desired.deadLetterQueue ? { dead_letter_queue: desired.deadLetterQueue } : {}),
    settings: {
      ...existing?.settings,
      ...desired.settings,
      max_concurrency: existing?.settings?.max_concurrency ?? null,
    },
  }
  const path = existing?.consumer_id
    ? `/queues/${queue.queue_id}/consumers/${existing.consumer_id}`
    : `/queues/${queue.queue_id}/consumers`
  await cloudflareAccountRequest(token, path, {
    method: existing?.consumer_id ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  process.stdout.write(`${existing ? '已更新' : '已创建'}消费者：${desired.queueName} -> ${workerName}\n`)
}

async function ensureTracing(token, drift) {
  const settings = await cloudflareAccountRequest(token, `/workers/scripts/${workerName}/settings`)
  const traces = settings?.observability?.traces
  if (traces?.enabled === true && sameNumber(traces.head_sampling_rate, desiredTraces.head_sampling_rate)) return
  drift.push('Worker 原生 Tracing 未按 5% 采样启用')
  if (checkOnly) return
  await cloudflareAccountRequest(token, `/workers/scripts/${workerName}/script-settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      observability: {
        ...settings.observability,
        enabled: true,
        traces: { ...traces, ...desiredTraces },
      },
    }),
  })
  process.stdout.write('已启用 Workers 原生 Tracing：5% 采样。\n')
}

async function synchronize() {
  const token = await loadCloudflareToken()
  const drift = []
  const queues = await listQueues(token)
  const queueByName = new Map()
  for (const desired of desiredConsumers) {
    queueByName.set(desired.queueName, await ensureQueue(token, queues, desired.queueName, drift))
  }
  for (const desired of desiredConsumers) {
    await ensureConsumer(token, queueByName.get(desired.queueName), desired, drift)
  }
  await ensureTracing(token, drift)

  if (checkOnly && drift.length) {
    throw new Error(`Cloudflare 基础设施存在漂移：${drift.join('；')}。请运行 npm run infra:sync。`)
  }
  process.stdout.write(checkOnly
    ? 'Cloudflare 基础设施检查通过：主队列、DLQ、消费者与 Tracing 均一致。\n'
    : `Cloudflare 基础设施同步完成${drift.length ? `，修复 ${drift.length} 项漂移` : '，无需变更'}。\n`)
}

await synchronize()
