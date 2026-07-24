import { create } from 'zustand'
import type { ReportRecord } from '../lib/api'
import type { Task, TaskUpdate } from '../types/domain'
import { resolveStateValue, type StateSetter, workspaceBootCache, workspaceBootTasks } from './storeUtils'

type TaskStore = {
  taskItems: Task[]
  updateItems: TaskUpdate[]
  reports: ReportRecord[]
  setTaskItems: StateSetter<Task[]>
  setUpdateItems: StateSetter<TaskUpdate[]>
  setReports: StateSetter<ReportRecord[]>
  hydrateTaskState: (state: Pick<TaskStore, 'taskItems' | 'updateItems' | 'reports'>) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  taskItems: workspaceBootTasks,
  updateItems: workspaceBootCache?.updates ?? [],
  reports: workspaceBootCache?.reports ?? [],
  setTaskItems: (value) => set((state) => ({ taskItems: resolveStateValue(value, state.taskItems) })),
  setUpdateItems: (value) => set((state) => ({ updateItems: resolveStateValue(value, state.updateItems) })),
  setReports: (value) => set((state) => ({ reports: resolveStateValue(value, state.reports) })),
  hydrateTaskState: ({ taskItems, updateItems, reports }) => set({ taskItems, updateItems, reports }),
}))
