import type { AiLearningAction } from './api'

export type AiLearningDraft = {
  sourceInput: string
  aiOutput: string
  applied: boolean
}

export function aiLearningAction(draft: AiLearningDraft, userFinal: string): AiLearningAction {
  const normalizedFinal = userFinal.trim()
  if (normalizedFinal === draft.aiOutput.trim()) return 'adopted'
  if (normalizedFinal === draft.sourceInput.trim()) return 'rejected'
  return 'edited'
}
