import { create } from 'zustand'
import type { ActivityItem, TaskProgressAssessment } from '../lib/api'
import type { Task } from '../types/domain'
import { resolveStateValue, type StateSetter } from './storeUtils'

type TaskRuntimeStore = {
  taskActivity: ActivityItem[]
  progressAssessments: Record<number, TaskProgressAssessment>
  voidTaskTarget: Task | null
  isVoidTaskBusy: boolean
  showFireworks: boolean
  setTaskActivity: StateSetter<ActivityItem[]>
  setProgressAssessments: StateSetter<Record<number, TaskProgressAssessment>>
  setVoidTaskTarget: StateSetter<Task | null>
  setIsVoidTaskBusy: StateSetter<boolean>
  setShowFireworks: StateSetter<boolean>
}

export const useTaskRuntimeStore = create<TaskRuntimeStore>((set) => ({
  taskActivity: [],
  progressAssessments: {},
  voidTaskTarget: null,
  isVoidTaskBusy: false,
  showFireworks: false,
  setTaskActivity: (value) => set((state) => ({ taskActivity: resolveStateValue(value, state.taskActivity) })),
  setProgressAssessments: (value) => set((state) => ({ progressAssessments: resolveStateValue(value, state.progressAssessments) })),
  setVoidTaskTarget: (value) => set((state) => ({ voidTaskTarget: resolveStateValue(value, state.voidTaskTarget) })),
  setIsVoidTaskBusy: (value) => set((state) => ({ isVoidTaskBusy: resolveStateValue(value, state.isVoidTaskBusy) })),
  setShowFireworks: (value) => set((state) => ({ showFireworks: resolveStateValue(value, state.showFireworks) })),
}))
