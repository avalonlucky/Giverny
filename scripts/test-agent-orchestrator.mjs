import assert from 'node:assert/strict'
import {
  completeAgentTurn,
  createAgentTurn,
  decideAgentReplan,
  inferAgentIntent,
  inferAgentIntents,
  verifyAgentAnswer,
} from '../src/agentOrchestrator.ts'
import { requesterNameFromQuestion, scopedQuestionForAgentTool, splitAgentGoalClauses, taskTitleFromQuestion } from '../src/agentEntityResolver.ts'

const principal = { workspaceId: 'test', principalId: 'test-user', role: 'admin', runId: 'orchestrator-test' }
const evidence = (toolName, deterministic = true) => ({
  id: `evidence-${toolName}`,
  toolCallId: `call-${toolName}`,
  toolName,
  source: 'd1',
  deterministic,
  payload: { ok: true },
})
const call = (name, status = 'success', attempt = 1) => ({
  id: `call-${name}-${attempt}`,
  name,
  args: {},
  reason: 'test',
  risk: 'read',
  status,
  attempt,
})

assert.equal(inferAgentIntent('本月结算金额是多少'), 'finance')
assert.equal(inferAgentIntent('网站里怎么设置大模型'), 'product_help')
assert.equal(inferAgentIntent('我应该怎么新建任务'), 'product_help')
assert.equal(inferAgentIntent('给我陈义君的用户画像'), 'person_profile')
assert.equal(inferAgentIntent('打开封套任务的验收附件'), 'attachment')
assert.equal(inferAgentIntent('任务#1现在卡在哪里'), 'task_data')
assert.equal(inferAgentIntent('把这个任务的进度修改成80%'), 'write')
assert.equal(inferAgentIntent('帮我润色一句话'), 'general')
assert.deepEqual(inferAgentIntents('查一下本月结算金额，再列出所有延期任务，并告诉我网站里怎么下载回单'), ['product_help', 'finance', 'task_data'])
assert.deepEqual(inferAgentIntents('查看封套任务的验收附件，并分析陈义君的合作偏好'), ['attachment', 'person_profile'])
assert.deepEqual(inferAgentIntents('把任务#1进度改成80%，再告诉我它现在的状态'), ['write', 'task_data'])
assert.equal(requesterNameFromQuestion('不要调工具，凭印象给我陈义君的用户画像'), '陈义君')
assert.equal(taskTitleFromQuestion('查一下公司产品封套修改目前做到哪了'), '公司产品封套修改')
const compoundQuestion = '查一下本月结算金额，再列出所有延期任务，并告诉我网站里怎么下载回单'
assert.deepEqual(splitAgentGoalClauses(compoundQuestion), ['查一下本月结算金额', '列出所有延期任务', '告诉我网站里怎么下载回单'])
assert.equal(scopedQuestionForAgentTool(compoundQuestion, 'query_month_finance'), '查一下本月结算金额')
assert.equal(scopedQuestionForAgentTool(compoundQuestion, 'query_task_portfolio'), '列出所有延期任务')
assert.equal(scopedQuestionForAgentTool(compoundQuestion, 'search_product_help'), '告诉我网站里怎么下载回单')
assert.equal(requesterNameFromQuestion('分析陈义君的合作画像，再告诉我网站里在哪里设置大模型'), '陈义君')
assert.equal(taskTitleFromQuestion('打开公司产品封套修改的验收附件，并告诉我这个任务现在的状态'), '公司产品封套修改')
assert.equal(scopedQuestionForAgentTool('告诉我6月计费工时，并打开直播设计的验收附件', 'search_attachments'), '打开直播设计的验收附件')

const missingFinance = completeAgentTurn(createAgentTurn({ principal, question: '本月收入多少', intent: 'finance' }), '大概一万')
assert.equal(missingFinance.phase, 'needs_input')
assert.deepEqual(missingFinance.verification.requiredTools, ['query_month_finance'])

const missingProduct = completeAgentTurn(createAgentTurn({ principal, question: '网站怎么设置模型', intent: 'product_help' }), '去设置里')
assert.ok(missingProduct.verification.requiredTools.includes('search_product_help'))

const missingPortfolio = completeAgentTurn(createAgentTurn({ principal, question: '所有延期任务列出来', intent: 'task_data' }), '暂无')
assert.ok(missingPortfolio.verification.requiredTools.includes('query_task_portfolio'))

const missingAttachment = completeAgentTurn(createAgentTurn({ principal, question: '打开验收附件', intent: 'attachment' }), '没有')
assert.ok(missingAttachment.verification.requiredTools.includes('search_attachments'))

const missingTask = completeAgentTurn(createAgentTurn({ principal, question: '任务#1现在的进展', intent: 'task_data' }), '猜测已完成')
assert.ok(missingTask.verification.requiredTools.includes('get_task_detail'))

const compoundTurn = completeAgentTurn(createAgentTurn({
  principal,
  question: '查一下本月结算金额，再列出所有延期任务，并告诉我网站里怎么下载回单',
  intent: 'finance',
}), '本月一切正常')
assert.deepEqual(compoundTurn.verification.detectedIntents, ['product_help', 'finance', 'task_data'])
assert.ok(compoundTurn.verification.requiredTools.includes('query_month_finance'))
assert.ok(compoundTurn.verification.requiredTools.includes('search_product_help'))
assert.ok(compoundTurn.verification.requiredTools.includes('query_task_portfolio'))
assert.ok(!compoundTurn.verification.requiredTools.includes('search_tasks'))

const partiallyVerifiedCompound = {
  ...compoundTurn,
  plan: [call('query_month_finance')],
  evidence: [evidence('query_month_finance')],
}
assert.ok(!verifyAgentAnswer(partiallyVerifiedCompound).requiredTools.includes('query_month_finance'))
assert.ok(verifyAgentAnswer(partiallyVerifiedCompound).requiredTools.includes('search_product_help'))
assert.ok(verifyAgentAnswer(partiallyVerifiedCompound).requiredTools.includes('query_task_portfolio'))

const verifiedWritePreview = {
  ...createAgentTurn({ principal, question: '把任务#1进度改成80%', intent: 'write' }),
  plan: [{ ...call('update_task_status_preview'), risk: 'write' }],
  evidence: [evidence('update_task_status_preview')],
  answer: '修改草稿已经准备好',
}
assert.equal(verifyAgentAnswer(verifiedWritePreview).passed, true)

const verifiedFinance = {
  ...createAgentTurn({ principal, question: '本月收入', intent: 'finance' }),
  plan: [call('query_month_finance')],
  evidence: [evidence('query_month_finance')],
  answer: '已核对',
}
assert.equal(verifyAgentAnswer(verifiedFinance).passed, true)

const uncertainFinance = {
  ...missingFinance,
  evidence: [evidence('query_month_finance', false)],
}
assert.ok(verifyAgentAnswer(uncertainFinance).requiredTools.includes('query_month_finance'))

const repairedTask = {
  ...createAgentTurn({ principal, question: '本月任务有哪些', intent: 'task_data' }),
  plan: [call('search_tasks', 'failed', 1), call('search_tasks', 'success', 2)],
  evidence: [evidence('search_tasks')],
  answer: '已核对',
}
assert.equal(verifyAgentAnswer(repairedTask).passed, true)

const retryTurn = {
  ...createAgentTurn({ principal, question: '本月收入', intent: 'finance' }),
  attempts: 1,
  plan: [call('query_month_finance', 'failed', 1)],
}
assert.equal(decideAgentReplan(retryTurn).shouldReplan, true)

const exhaustedTurn = {
  ...retryTurn,
  attempts: 3,
  plan: [
    call('query_month_finance', 'failed', 1),
    call('query_month_finance', 'failed', 2),
    call('query_month_finance', 'failed', 3),
  ],
}
assert.equal(decideAgentReplan(exhaustedTurn).shouldReplan, false)

console.log('Agent orchestrator deterministic tests: 40 assertions passed')
