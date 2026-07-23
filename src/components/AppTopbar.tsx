import { Bot, ChevronLeft, ChevronRight, HelpCircle, Search } from 'lucide-react'
import { MonthPicker } from './MonthPicker'
import type { AppView } from '../types/domain'
import type { CalendarDisplayMode } from '../views/CalendarView'

export function AppTopbar({
  activeView,
  viewTitle,
  isTaskCalendarView,
  currentMonthValue,
  taskMonthValues,
  calendarDisplayMode,
  taskCount,
  pendingCount,
  canSeeFull,
  isAdmin,
  isChatOpen,
  canWrite,
  onMonthChange,
  onCalendarDisplayModeChange,
  onCalendarPeriodShift,
  onOpenSemanticSearch,
  onToggleChat,
  onOpenShortcutHelp,
  onCreateTask,
}: {
  activeView: AppView
  viewTitle: string
  isTaskCalendarView: boolean
  currentMonthValue: string
  taskMonthValues: Set<string>
  calendarDisplayMode: CalendarDisplayMode
  taskCount: number
  pendingCount: number
  canSeeFull: boolean
  isAdmin: boolean
  isChatOpen: boolean
  canWrite: boolean
  onMonthChange: (value: string) => void
  onCalendarDisplayModeChange: (mode: CalendarDisplayMode) => void
  onCalendarPeriodShift: (offset: -1 | 1) => void
  onOpenSemanticSearch: () => void
  onToggleChat: () => void
  onOpenShortcutHelp: () => void
  onCreateTask: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        {isTaskCalendarView ? (
          <div className="task-calendar-titlebar">
            <MonthPicker value={currentMonthValue} taskMonthValues={taskMonthValues} onChange={onMonthChange} minimal />
            <select className="calendar-mode-select" value={calendarDisplayMode} aria-label="选择日历显示方式" onChange={(event) => onCalendarDisplayModeChange(event.target.value as CalendarDisplayMode)}>
              <option value="日">日</option>
              <option value="周">周</option>
              <option value="月">月</option>
            </select>
            <div className="calendar-period-nav" aria-label="切换日历周期">
              <button type="button" aria-label="上一周期" title="上一周期" onClick={() => onCalendarPeriodShift(-1)}><ChevronLeft size={24} /></button>
              <button type="button" aria-label="下一周期" title="下一周期" onClick={() => onCalendarPeriodShift(1)}><ChevronRight size={24} /></button>
            </div>
          </div>
        ) : <h1>{viewTitle}</h1>}
        {activeView === '工作台' && <p className="topbar-summary">本月 {taskCount} 条任务 · {pendingCount} 个待验收</p>}
      </div>
      <div className="topbar-actions">
        {!isTaskCalendarView && <MonthPicker value={currentMonthValue} taskMonthValues={taskMonthValues} onChange={onMonthChange} iconOnly />}
        {canSeeFull && <button type="button" className="topbar-shortcut" title="语义搜索：按意思找回历史任务" aria-label="语义搜索" onClick={onOpenSemanticSearch}><Search size={16} /></button>}
        {isAdmin && <button type="button" className={`topbar-shortcut topbar-assistant-button ${isChatOpen ? 'active' : ''}`} title="工作助手 AI 对话" aria-label="打开工作助手" onClick={onToggleChat}><Bot size={16} /><span>工作助手</span></button>}
        <button type="button" className="topbar-shortcut" title="查看键盘快捷键（?）" aria-label="查看快捷键" aria-keyshortcuts="Shift+/" onClick={onOpenShortcutHelp}><HelpCircle size={16} /></button>
        {canWrite && <button className="primary-button topbar-create-button" title="新建任务（N）" aria-keyshortcuts="N" onClick={onCreateTask}><span>新建任务</span><kbd>N</kbd></button>}
      </div>
    </header>
  )
}
