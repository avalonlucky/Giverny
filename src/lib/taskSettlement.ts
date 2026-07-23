import type { Task } from '../types/domain'

export function taskSettlementMonth(task: Pick<Task, 'settlementMonth'>) {
  return task.settlementMonth || ''
}
