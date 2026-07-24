import { create } from 'zustand'
import type { ConfirmDialogState } from '../components/ConfirmDialogModal'
import type { ProgressModalTarget } from '../components/AppOverlayLayer'
import { isoDate } from '../lib/dateTime'
import type { AppView, FileAsset, Task, TaskFilter } from '../types/domain'
import type { CalendarDisplayMode } from '../views/CalendarView'
import type { SettingsTab } from '../views/SettingsView'

type StateValue<T> = T | ((current: T) => T)
type StateSetter<T> = (value: StateValue<T>) => void

function resolveStateValue<T>(value: StateValue<T>, current: T) {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value
}

function storedBoolean(key: string, expected: string) {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === expected
  } catch {
    return false
  }
}

function persistBoolean(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // UI preferences remain usable when storage is unavailable.
  }
}

export type DashboardContextMenuState = { x: number; y: number; task: Task } | null
export type DashboardCreateMenuState = { x: number; y: number } | null
export type SettingsEntryState = { tab: SettingsTab; nonce: number }

type UiStore = {
  calendarDisplayMode: CalendarDisplayMode
  calendarFocusDate: string
  isLoginModalOpen: boolean
  monthValue: string
  selectedTaskId: number
  isTaskDetailCollapsed: boolean
  detailTaskId: number
  editTaskId: number
  progressModalTarget: ProgressModalTarget | null
  isModalOpen: boolean
  newTaskSupplemental: boolean
  isCommandPaletteOpen: boolean
  commandPaletteInitialQuery: string
  isShortcutHelpOpen: boolean
  isSemanticSearchOpen: boolean
  isChatOpen: boolean
  chatAnalysisFocusId: string
  fileLibraryFocusId: number
  isDailyKnowledgeOpen: boolean
  incomeVisible: boolean
  previewFile: FileAsset | null
  confirmDialog: ConfirmDialogState | null
  isConfirmDialogBusy: boolean
  showVoidedTasks: boolean
  dashboardContextMenu: DashboardContextMenuState
  dashboardCreateMenu: DashboardCreateMenuState
  isAccountMenuOpen: boolean
  taskQuery: string
  taskFilter: TaskFilter
  dashboardPendingShowAll: boolean
  dashboardAcceptedOpen: boolean
  dashboardAcceptedShowAll: boolean
  rowThemeOn: boolean
  settingsEntry: SettingsEntryState
  setCalendarDisplayMode: StateSetter<CalendarDisplayMode>
  setCalendarFocusDate: StateSetter<string>
  setIsLoginModalOpen: StateSetter<boolean>
  setMonthValue: StateSetter<string>
  setSelectedTaskId: StateSetter<number>
  setIsTaskDetailCollapsed: StateSetter<boolean>
  setDetailTaskId: StateSetter<number>
  setEditTaskId: StateSetter<number>
  setProgressModalTarget: StateSetter<ProgressModalTarget | null>
  setIsModalOpen: StateSetter<boolean>
  setNewTaskSupplemental: StateSetter<boolean>
  setIsCommandPaletteOpen: StateSetter<boolean>
  setCommandPaletteInitialQuery: StateSetter<string>
  setIsShortcutHelpOpen: StateSetter<boolean>
  setIsSemanticSearchOpen: StateSetter<boolean>
  setIsChatOpen: StateSetter<boolean>
  setChatAnalysisFocusId: StateSetter<string>
  setFileLibraryFocusId: StateSetter<number>
  setIsDailyKnowledgeOpen: StateSetter<boolean>
  setIncomeVisible: StateSetter<boolean>
  setPreviewFile: StateSetter<FileAsset | null>
  setConfirmDialog: StateSetter<ConfirmDialogState | null>
  setIsConfirmDialogBusy: StateSetter<boolean>
  setShowVoidedTasks: StateSetter<boolean>
  setDashboardContextMenu: StateSetter<DashboardContextMenuState>
  setDashboardCreateMenu: StateSetter<DashboardCreateMenuState>
  setIsAccountMenuOpen: StateSetter<boolean>
  setTaskQuery: StateSetter<string>
  setTaskFilter: StateSetter<TaskFilter>
  setDashboardPendingShowAll: StateSetter<boolean>
  setDashboardAcceptedOpen: StateSetter<boolean>
  setDashboardAcceptedShowAll: StateSetter<boolean>
  setRowThemeOn: StateSetter<boolean>
  setSettingsEntry: StateSetter<SettingsEntryState>
  toggleRowTheme: () => void
  toggleTaskDetail: () => void
  resetViewState: (view: AppView) => void
}

export const useUiStore = create<UiStore>((set) => ({
  calendarDisplayMode: '月',
  calendarFocusDate: isoDate(),
  isLoginModalOpen: false,
  monthValue: isoDate().slice(0, 7),
  selectedTaskId: 0,
  isTaskDetailCollapsed: storedBoolean('giverny-task-detail-collapsed', '1'),
  detailTaskId: 0,
  editTaskId: 0,
  progressModalTarget: null,
  isModalOpen: false,
  newTaskSupplemental: false,
  isCommandPaletteOpen: false,
  commandPaletteInitialQuery: '',
  isShortcutHelpOpen: false,
  isSemanticSearchOpen: false,
  isChatOpen: false,
  chatAnalysisFocusId: '',
  fileLibraryFocusId: 0,
  isDailyKnowledgeOpen: false,
  incomeVisible: false,
  previewFile: null,
  confirmDialog: null,
  isConfirmDialogBusy: false,
  showVoidedTasks: false,
  dashboardContextMenu: null,
  dashboardCreateMenu: null,
  isAccountMenuOpen: false,
  taskQuery: '',
  taskFilter: '全部',
  dashboardPendingShowAll: false,
  dashboardAcceptedOpen: false,
  dashboardAcceptedShowAll: false,
  rowThemeOn: storedBoolean('giverny-row-theme', 'on'),
  settingsEntry: { tab: 'ai', nonce: 0 },
  setCalendarDisplayMode: (value) => set((state) => ({ calendarDisplayMode: resolveStateValue(value, state.calendarDisplayMode) })),
  setCalendarFocusDate: (value) => set((state) => ({ calendarFocusDate: resolveStateValue(value, state.calendarFocusDate) })),
  setIsLoginModalOpen: (value) => set((state) => ({ isLoginModalOpen: resolveStateValue(value, state.isLoginModalOpen) })),
  setMonthValue: (value) => set((state) => ({ monthValue: resolveStateValue(value, state.monthValue) })),
  setSelectedTaskId: (value) => set((state) => ({ selectedTaskId: resolveStateValue(value, state.selectedTaskId) })),
  setIsTaskDetailCollapsed: (value) => set((state) => ({ isTaskDetailCollapsed: resolveStateValue(value, state.isTaskDetailCollapsed) })),
  setDetailTaskId: (value) => set((state) => ({ detailTaskId: resolveStateValue(value, state.detailTaskId) })),
  setEditTaskId: (value) => set((state) => ({ editTaskId: resolveStateValue(value, state.editTaskId) })),
  setProgressModalTarget: (value) => set((state) => ({ progressModalTarget: resolveStateValue(value, state.progressModalTarget) })),
  setIsModalOpen: (value) => set((state) => ({ isModalOpen: resolveStateValue(value, state.isModalOpen) })),
  setNewTaskSupplemental: (value) => set((state) => ({ newTaskSupplemental: resolveStateValue(value, state.newTaskSupplemental) })),
  setIsCommandPaletteOpen: (value) => set((state) => ({ isCommandPaletteOpen: resolveStateValue(value, state.isCommandPaletteOpen) })),
  setCommandPaletteInitialQuery: (value) => set((state) => ({ commandPaletteInitialQuery: resolveStateValue(value, state.commandPaletteInitialQuery) })),
  setIsShortcutHelpOpen: (value) => set((state) => ({ isShortcutHelpOpen: resolveStateValue(value, state.isShortcutHelpOpen) })),
  setIsSemanticSearchOpen: (value) => set((state) => ({ isSemanticSearchOpen: resolveStateValue(value, state.isSemanticSearchOpen) })),
  setIsChatOpen: (value) => set((state) => ({ isChatOpen: resolveStateValue(value, state.isChatOpen) })),
  setChatAnalysisFocusId: (value) => set((state) => ({ chatAnalysisFocusId: resolveStateValue(value, state.chatAnalysisFocusId) })),
  setFileLibraryFocusId: (value) => set((state) => ({ fileLibraryFocusId: resolveStateValue(value, state.fileLibraryFocusId) })),
  setIsDailyKnowledgeOpen: (value) => set((state) => ({ isDailyKnowledgeOpen: resolveStateValue(value, state.isDailyKnowledgeOpen) })),
  setIncomeVisible: (value) => set((state) => ({ incomeVisible: resolveStateValue(value, state.incomeVisible) })),
  setPreviewFile: (value) => set((state) => ({ previewFile: resolveStateValue(value, state.previewFile) })),
  setConfirmDialog: (value) => set((state) => ({ confirmDialog: resolveStateValue(value, state.confirmDialog) })),
  setIsConfirmDialogBusy: (value) => set((state) => ({ isConfirmDialogBusy: resolveStateValue(value, state.isConfirmDialogBusy) })),
  setShowVoidedTasks: (value) => set((state) => ({ showVoidedTasks: resolveStateValue(value, state.showVoidedTasks) })),
  setDashboardContextMenu: (value) => set((state) => ({ dashboardContextMenu: resolveStateValue(value, state.dashboardContextMenu) })),
  setDashboardCreateMenu: (value) => set((state) => ({ dashboardCreateMenu: resolveStateValue(value, state.dashboardCreateMenu) })),
  setIsAccountMenuOpen: (value) => set((state) => ({ isAccountMenuOpen: resolveStateValue(value, state.isAccountMenuOpen) })),
  setTaskQuery: (value) => set((state) => ({ taskQuery: resolveStateValue(value, state.taskQuery) })),
  setTaskFilter: (value) => set((state) => ({ taskFilter: resolveStateValue(value, state.taskFilter) })),
  setDashboardPendingShowAll: (value) => set((state) => ({ dashboardPendingShowAll: resolveStateValue(value, state.dashboardPendingShowAll) })),
  setDashboardAcceptedOpen: (value) => set((state) => ({ dashboardAcceptedOpen: resolveStateValue(value, state.dashboardAcceptedOpen) })),
  setDashboardAcceptedShowAll: (value) => set((state) => ({ dashboardAcceptedShowAll: resolveStateValue(value, state.dashboardAcceptedShowAll) })),
  setRowThemeOn: (value) => set((state) => ({ rowThemeOn: resolveStateValue(value, state.rowThemeOn) })),
  setSettingsEntry: (value) => set((state) => ({ settingsEntry: resolveStateValue(value, state.settingsEntry) })),
  toggleRowTheme: () => set((state) => {
    const rowThemeOn = !state.rowThemeOn
    persistBoolean('giverny-row-theme', rowThemeOn ? 'on' : 'off')
    return { rowThemeOn }
  }),
  toggleTaskDetail: () => set((state) => {
    const isTaskDetailCollapsed = !state.isTaskDetailCollapsed
    persistBoolean('giverny-task-detail-collapsed', isTaskDetailCollapsed ? '1' : '0')
    return { isTaskDetailCollapsed }
  }),
  resetViewState: (view) => set(view === '工作台'
    ? { dashboardContextMenu: null, dashboardCreateMenu: null }
    : { isAccountMenuOpen: false }),
}))
