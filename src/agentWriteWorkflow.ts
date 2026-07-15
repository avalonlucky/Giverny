import { AgentWorkflow } from 'agents/workflows'
import type { AgentWorkflowEvent, AgentWorkflowStep } from 'agents/workflows'
import type { AliceAgent } from './aliceAgent'

export type AgentWriteWorkflowParams = {
  action: string
  label: string
  endpoint: string
  confirmationToken: string
  createdAt: number
}

type AgentWriteWorkflowProgress = {
  step: 'approval' | 'execute'
  status: 'pending' | 'running' | 'complete'
  message: string
  percent: number
}

type AgentWriteWorkflowEnv = {
  AGENT_TOOL_TOKEN?: string
  GIVERNY_API_BASE_URL?: string
}

type DurableWorkflowStep = AgentWorkflowStep & {
  do<T>(
    name: string,
    config: {
      retries: { limit: number; delay: string; backoff: 'exponential' }
      timeout: string
    },
    callback: () => Promise<T>,
  ): Promise<T>
}

function cleanBaseUrl(value: string | undefined) {
  return String(value || 'https://mayeai.com').trim().replace(/\/+$/, '')
}

export class AgentWriteWorkflow extends AgentWorkflow<
  AliceAgent,
  AgentWriteWorkflowParams,
  AgentWriteWorkflowProgress
> {
  async run(event: AgentWorkflowEvent<AgentWriteWorkflowParams>, step: AgentWorkflowStep) {
    const params = event.payload
    const durableStep = step as DurableWorkflowStep
    const workflowEnv = (this as unknown as { env: AgentWriteWorkflowEnv }).env
    await this.reportProgress({
      step: 'approval',
      status: 'pending',
      message: `等待确认${params.label}`,
      percent: 0.2,
    })
    await this.waitForApproval(step, { timeout: '10 minutes' })

    await this.reportProgress({
      step: 'execute',
      status: 'running',
      message: `正在执行${params.label}`,
      percent: 0.6,
    })
    const result = await durableStep.do('execute-confirmed-write', {
      retries: { limit: 3, delay: '1 second', backoff: 'exponential' },
      timeout: '30 seconds',
    }, async () => {
      const token = String(workflowEnv.AGENT_TOOL_TOKEN || '').trim()
      if (!token) throw new Error('AGENT_TOOL_TOKEN 未配置，Workflow 无法执行写入。')
      const response = await fetch(`${cleanBaseUrl(workflowEnv.GIVERNY_API_BASE_URL)}/api/agent/tools/workflow-write`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operationId: this.workflowId,
          endpoint: params.endpoint,
          confirmationToken: params.confirmationToken,
        }),
      })
      const data = await response.json().catch(() => null) as Record<string, unknown> | null
      if (!response.ok || !data) {
        throw new Error(String(data?.error || `Workflow 写入失败：HTTP ${response.status}`))
      }
      return data
    })

    await this.reportProgress({
      step: 'execute',
      status: 'complete',
      message: `${params.label}已完成`,
      percent: 1,
    })
    await step.reportComplete(result)
    return result
  }
}
