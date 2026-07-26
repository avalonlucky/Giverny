import { readFileSync } from 'node:fs'
import process from 'node:process'

const failures = []
const runtime = readFileSync('src/aliceAgent.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const director = readFileSync('src/agentIntentDirector.ts', 'utf8')
const chat = readFileSync('src/components/ChatPanel.tsx', 'utf8')
const suite = JSON.parse(readFileSync('agent-evals/cases.json', 'utf8'))

for (const forbidden of ['DEEPSEEK_API_KEY', 'createOpenAICompatible', 'generateText({', 'toolChoice:']) {
  if (runtime.includes(forbidden)) failures.push(`Alice 仍自带模型或自由工具规划：${forbidden}`)
}
for (const marker of ['orchestration:', 'executeDirectedCapability(', 'allowedCapabilities', 'requiresProductKnowledge']) {
  if (!runtime.includes(marker)) failures.push(`Alice 缺少已校验计划执行边界：${marker}`)
}

for (const marker of [
  'AGENT_DIRECTOR_SYSTEM_PROMPT',
  'shortlistAgentCapabilities',
  'validateDirectedPlan',
  "names.delete('search_product_help')",
  "names.delete('search_workspace')",
]) if (!director.includes(marker)) failures.push(`意图导演缺少能力隔离：${marker}`)

for (const marker of ['directAgentRequest(', 'callSelectedModelJson<Record<string, unknown>>', 'modelChoice: args.modelChoice', 'needsPersonalKnowledge']) {
  if (!worker.includes(marker)) failures.push(`Worker 没有将用户主模型与意图导演接入主链：${marker}`)
}
if (!worker.includes('if (shouldUseDirectedRuntime)')) failures.push('纯文本请求仍可能按手选模型绕开统一编排层')
if (!worker.includes("? [defaultHourlyRate, { results: [] as DbTask[] }")) failures.push('意图导演前仍会无条件预取任务、金额或知识数据')
if (worker.includes("trace: ['开始分析：识别问题目标与需要核对的依据。']")) failures.push('Worker 仍在发送固定处理模板')
if (chat.includes("trace: ['开始分析：识别问题目标与需要核对的依据。']")) failures.push('聊天界面仍预填固定处理模板')

const cases = suite.cases || []
const requireCase = (id, tool, forbiddenTool) => {
  const item = cases.find((entry) => entry.id === id)
  if (!item) return failures.push(`缺少跨域回归：${id}`)
  if (tool && !item.expect?.tools?.includes(tool)) failures.push(`${id} 未要求 ${tool}`)
  if (forbiddenTool && !item.expect?.forbiddenTools?.includes(forbiddenTool)) failures.push(`${id} 未禁止 ${forbiddenTool}`)
}
requireCase('create-09', 'create_task_preview', 'search_product_help')
requireCase('product-help-01', 'search_product_help')
requireCase('person-profile-01', 'get_requester_profile')
requireCase('agenda-01', 'query_agenda')
requireCase('workspace-search-01', 'search_workspace')
requireCase('safety-08', null, 'search_tasks')

if (failures.length) {
  console.error(`Agent 意图编排守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Agent 意图编排守卫通过：主模型导演、小工具集、知识隔离与 Alice 执行边界已生效。')
