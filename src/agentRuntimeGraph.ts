import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web'
import type { AgentDirectorDecision, AgentDirectorPlanCall } from './agentIntentDirector'
import type { AgentPrincipalContext } from './agentScope'
import type { AgentCapabilityName } from './agentToolRegistry'

export type AgentRuntimeGraphRequest = {
  question: string
  currentMonth?: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  principal: AgentPrincipalContext
}

export type AgentRuntimeGraphPlan = {
  calls: AgentDirectorPlanCall[]
  needsInput: boolean
  followUpQuestion: string
  answerIfNoTools: string
}

export type AgentRuntimeGraphResult = {
  decision: AgentDirectorDecision
  calls: AgentDirectorPlanCall[]
  allowedCapabilities: AgentCapabilityName[]
  directAnswer: string
  denied: string[]
  path: string[]
  modelCalls: number
}

type AgentRuntimeGraphDependencies = {
  understand: (request: AgentRuntimeGraphRequest) => Promise<AgentDirectorDecision>
  shortlist: (decision: AgentDirectorDecision, principal: AgentPrincipalContext) => AgentCapabilityName[]
  plan: (request: AgentRuntimeGraphRequest, decision: AgentDirectorDecision, allowed: AgentCapabilityName[]) => Promise<AgentRuntimeGraphPlan>
  authorize: (decision: AgentDirectorDecision, plan: AgentRuntimeGraphPlan, allowed: AgentCapabilityName[], principal: AgentPrincipalContext) => { calls: AgentDirectorPlanCall[]; denied: string[] }
}

const GraphState = Annotation.Root({
  request: Annotation<AgentRuntimeGraphRequest>(),
  decision: Annotation<AgentDirectorDecision>(),
  allowedCapabilities: Annotation<AgentCapabilityName[]>({ reducer: (_, next) => next, default: () => [] }),
  plan: Annotation<AgentRuntimeGraphPlan>(),
  calls: Annotation<AgentDirectorPlanCall[]>({ reducer: (_, next) => next, default: () => [] }),
  denied: Annotation<string[]>({ reducer: (_, next) => next, default: () => [] }),
  directAnswer: Annotation<string>({ reducer: (_, next) => next, default: () => '' }),
  path: Annotation<string[]>({ reducer: (current, next) => [...current, ...next], default: () => [] }),
  modelCalls: Annotation<number>({ reducer: (current, next) => current + next, default: () => 0 }),
})

export function createAgentRuntimeGraph(dependencies: AgentRuntimeGraphDependencies) {
  return new StateGraph(GraphState)
    .addNode('understand', async (state) => ({
      decision: await dependencies.understand(state.request),
      path: ['understand'],
      modelCalls: 1,
    }))
    .addNode('shortlist', async (state) => ({
      allowedCapabilities: dependencies.shortlist(state.decision, state.request.principal),
      path: ['shortlist'],
    }))
    .addNode('direct_authorize', async (state) => {
      const plan: AgentRuntimeGraphPlan = {
        calls: state.decision.proposedCalls,
        needsInput: false,
        followUpQuestion: '',
        answerIfNoTools: '',
      }
      const authorized = dependencies.authorize(state.decision, plan, state.allowedCapabilities, state.request.principal)
      return { plan, ...authorized, path: ['direct_authorize'] }
    })
    .addNode('plan_node', async (state) => ({
      plan: await dependencies.plan(state.request, state.decision, state.allowedCapabilities),
      path: ['plan'],
      modelCalls: 1,
    }))
    .addNode('authorize', async (state) => ({
      ...dependencies.authorize(state.decision, state.plan, state.allowedCapabilities, state.request.principal),
      path: ['authorize'],
    }))
    .addNode('finish', async (state) => ({
      directAnswer: state.calls.length
        ? ''
        : state.plan?.followUpQuestion
          || state.plan?.answerIfNoTools
          || (state.decision.missingInformation.length ? `请补充：${state.decision.missingInformation.join('、')}。` : ''),
      path: ['finish'],
    }))
    .addEdge(START, 'understand')
    .addEdge('understand', 'shortlist')
    .addConditionalEdges('shortlist', (state) => {
      if (state.decision.complexity === 'simple' && state.decision.proposedCalls.length > 0) return 'direct_authorize'
      return 'plan_node'
    }, ['direct_authorize', 'plan_node'])
    .addConditionalEdges('direct_authorize', (state) => state.calls.length > 0 ? 'finish' : 'plan_node', ['finish', 'plan_node'])
    .addEdge('plan_node', 'authorize')
    .addEdge('authorize', 'finish')
    .addEdge('finish', END)
    .compile()
}

export async function runAgentRuntimeGraph(
  dependencies: AgentRuntimeGraphDependencies,
  request: AgentRuntimeGraphRequest,
): Promise<AgentRuntimeGraphResult> {
  const result = await createAgentRuntimeGraph(dependencies).invoke({ request })
  return {
    decision: result.decision,
    calls: result.calls,
    allowedCapabilities: result.allowedCapabilities,
    directAnswer: result.directAnswer,
    denied: result.denied,
    path: result.path,
    modelCalls: result.modelCalls,
  }
}
