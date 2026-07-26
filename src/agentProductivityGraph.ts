import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web'

export type AgentProductivityCall = {
  name: string
  args: Record<string, unknown>
  reason: string
  attempt?: number
}

export type AgentProductivityObservation = {
  call: AgentProductivityCall
  output: unknown
  deterministic: boolean
  error?: string
  halt?: 'needs_input' | 'selection' | 'approval' | 'background'
  durationMs: number
}

export type AgentProductivityDecision = {
  status: 'complete' | 'replan' | 'needs_input' | 'failed'
  requiredTools: string[]
  reason: string
}

export type AgentProductivityResult = {
  observations: AgentProductivityObservation[]
  decision: AgentProductivityDecision
  path: string[]
  cycles: number
  toolCalls: number
}

type AgentProductivityDependencies = {
  execute: (
    call: AgentProductivityCall,
    context: { observations: AgentProductivityObservation[]; cycle: number },
  ) => Promise<AgentProductivityObservation>
  observe: (observations: AgentProductivityObservation[], cycle: number) => AgentProductivityDecision
  replan: (
    decision: AgentProductivityDecision,
    observations: AgentProductivityObservation[],
    cycle: number,
  ) => Promise<AgentProductivityCall[]>
}

const ProductivityState = Annotation.Root({
  pendingCalls: Annotation<AgentProductivityCall[]>({ reducer: (_, next) => next, default: () => [] }),
  observations: Annotation<AgentProductivityObservation[]>({ reducer: (current, next) => [...current, ...next], default: () => [] }),
  decision: Annotation<AgentProductivityDecision>(),
  path: Annotation<string[]>({ reducer: (current, next) => [...current, ...next], default: () => [] }),
  cycles: Annotation<number>({ reducer: (_, next) => next, default: () => 0 }),
  toolCalls: Annotation<number>({ reducer: (current, next) => current + next, default: () => 0 }),
})

export function createAgentProductivityGraph(
  dependencies: AgentProductivityDependencies,
  limits: { maxCycles: number; maxToolCalls: number },
) {
  return new StateGraph(ProductivityState)
    .addNode('execute_batch', async (state) => {
      const remainingBudget = Math.max(0, limits.maxToolCalls - state.toolCalls)
      const calls = state.pendingCalls.slice(0, remainingBudget)
      const observations: AgentProductivityObservation[] = []
      for (const call of calls) {
        const observation = await dependencies.execute(call, {
          observations: [...state.observations, ...observations],
          cycle: state.cycles + 1,
        })
        observations.push(observation)
        if (observation.halt) break
      }
      return {
        pendingCalls: [],
        observations,
        cycles: state.cycles + 1,
        toolCalls: observations.length,
        path: ['execute'],
      }
    })
    .addNode('observe_results', async (state) => ({
      decision: dependencies.observe(state.observations, state.cycles),
      path: ['observe'],
    }))
    .addNode('replan_node', async (state) => ({
      pendingCalls: await dependencies.replan(state.decision, state.observations, state.cycles),
      path: ['replan'],
    }))
    .addNode('finish', async (state) => ({
      decision: state.decision?.status === 'replan'
        && state.pendingCalls.length === 0
        && state.cycles < limits.maxCycles
        && state.toolCalls < limits.maxToolCalls
        ? { ...state.decision, status: 'needs_input', reason: `${state.decision.reason} 无法安全补全工具参数，需要用户补充明确对象。` }
        : state.decision || {
          status: 'failed',
          requiredTools: [],
          reason: '生产力状态机未生成终止决策。',
        },
      path: ['finish'],
    }))
    .addEdge(START, 'execute_batch')
    .addEdge('execute_batch', 'observe_results')
    .addConditionalEdges('observe_results', (state) => {
      if (state.decision.status !== 'replan') return 'finish'
      if (state.cycles >= limits.maxCycles || state.toolCalls >= limits.maxToolCalls) return 'finish'
      return 'replan_node'
    }, ['finish', 'replan_node'])
    .addConditionalEdges('replan_node', (state) => state.pendingCalls.length ? 'execute_batch' : 'finish', ['execute_batch', 'finish'])
    .addEdge('finish', END)
    .compile()
}

export async function runAgentProductivityGraph(
  dependencies: AgentProductivityDependencies,
  initialCalls: AgentProductivityCall[],
  limits = { maxCycles: 3, maxToolCalls: 8 },
): Promise<AgentProductivityResult> {
  const result = await createAgentProductivityGraph(dependencies, limits).invoke({ pendingCalls: initialCalls })
  const budgetExhausted = result.decision?.status === 'replan'
    && (result.cycles >= limits.maxCycles || result.toolCalls >= limits.maxToolCalls)
  return {
    observations: result.observations,
    decision: budgetExhausted
      ? { ...result.decision, status: 'failed', reason: `${result.decision.reason} 已达执行预算上限。` }
      : result.decision,
    path: result.path,
    cycles: result.cycles,
    toolCalls: result.toolCalls,
  }
}
