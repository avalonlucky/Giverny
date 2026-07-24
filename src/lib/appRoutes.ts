import type { AppView, TaskViewMode } from '../types/domain'

export const APP_VIEW_PATHS: Record<AppView, string> = {
  工作台: '/dashboard',
  任务: '/tasks',
  文件库: '/files',
  洞察: '/insights',
  收入: '/income',
  结算: '/reports',
  设置: '/settings',
  知识库: '/knowledge',
}

export type AppRouteHandle = {
  appView: AppView
}

export function taskViewModeFromSearch(search: string): TaskViewMode {
  const value = new URLSearchParams(search).get('taskView')
  return value === 'calendar' || value === '日历' ? '日历' : '列表'
}

export function appViewPath(view: AppView, taskViewMode: TaskViewMode = '列表') {
  if (view === '任务' && taskViewMode === '日历') {
    return `${APP_VIEW_PATHS[view]}?taskView=calendar`
  }
  return APP_VIEW_PATHS[view]
}
