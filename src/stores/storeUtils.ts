import { normalizeTaskClosure } from '../lib/taskContextInsights'
import { readStateCache } from '../lib/stateCache'

export type StateValue<T> = T | ((current: T) => T)
export type StateSetter<T> = (value: StateValue<T>) => void

export function resolveStateValue<T>(value: StateValue<T>, current: T) {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value
}

export const workspaceBootCache = readStateCache()
export const workspaceBootTasks = workspaceBootCache?.tasks.map(normalizeTaskClosure) ?? []
