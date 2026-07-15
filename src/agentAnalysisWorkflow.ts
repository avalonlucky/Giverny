import { WorkflowEntrypoint } from 'cloudflare:workers'

export type AgentAnalysisWorkflowParams = {
  jobId: string
}

type AgentAnalysisWorkflowEnv = {
  AGENT_TOOL_TOKEN?: string
  GIVERNY_API_BASE_URL?: string
}

type DurableWorkflowStep = {
  do<T>(
    name: string,
    config: {
      retries: { limit: number; delay: string; backoff: 'exponential' }
      timeout: string
    },
    callback: () => Promise<T>,
  ): Promise<T>
}

type AgentAnalysisWorkflowEvent = {
  payload: Readonly<AgentAnalysisWorkflowParams>
}

function cleanBaseUrl(value: string | undefined) {
  return String(value || 'https://mayeai.com').trim().replace(/\/+$/, '')
}

export class AgentAnalysisWorkflow extends WorkflowEntrypoint<AgentAnalysisWorkflowEnv, AgentAnalysisWorkflowParams> {
  private async callTool(endpoint: string, body: Record<string, unknown>) {
    const token = String(this.env.AGENT_TOOL_TOKEN || '').trim()
    if (!token) throw new Error('AGENT_TOOL_TOKEN 未配置，后台分析无法读取数据。')
    const response = await fetch(`${cleanBaseUrl(this.env.GIVERNY_API_BASE_URL)}/api/agent/tools/${endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !data) {
      throw new Error(String(data?.error || `后台分析步骤失败：HTTP ${response.status}`))
    }
    return data
  }

  async run(event: AgentAnalysisWorkflowEvent, step: DurableWorkflowStep) {
    const { jobId } = event.payload
    try {
      await step.do('collect-analysis-data', {
        retries: { limit: 3, delay: '2 seconds', backoff: 'exponential' },
        timeout: '30 seconds',
      }, () => this.callTool('analysis-job-prepare', { jobId }))

      const result = await step.do('generate-analysis-report', {
        retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      }, () => this.callTool('analysis-job-generate', { jobId }))

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '后台分析失败'
      await this.callTool('analysis-job-fail', { jobId, error: message }).catch(() => undefined)
      throw error
    }
  }
}
