import type { Dispatch, MouseEventHandler, ReactNode, SetStateAction } from 'react'
import { AlarmClock, ChevronDown, ChevronRight, Eye, EyeOff, Lock, PanelRightClose, PanelRightOpen, Plus, RotateCcw } from 'lucide-react'
import { DonutChart, type DonutChartItem } from '../components/DonutChart'
import { TrendChart } from '../components/TrendChart'
import { ActiveTaskFilters, TaskSearchBox } from '../components/TaskUi'
import { EmptyState } from '../components/EmptyState'
import { formatYuan } from '../lib/money'
import { monthLabelOf } from '../lib/month'
import type { Task, TaskFilter } from '../types/domain'
import type { DailyKnowledgeItem } from '../types/knowledge'

type DashboardStats = { totalHours: number; billableHours: number; amount: number; accepted: number; pending: number }
type DashboardReminder = { key: string; title: string; body?: string; jobId?: string }
type DashboardAnnualData = { year: string; rows: Array<{ month: string; hours: number; amount: number; locked: boolean }>; totalHours: number; totalAmount: number }

export function DashboardView({
  openDashboardCreateMenu, stats, importedHours, canToggleIncomeVisibility, incomeVisible, toggleIncomeVisibility, hourlyRate, activeMonthTaskCount,
  dailyKnowledge, isDailyKnowledgeLoading, isDailyKnowledgePrefetching, dailyKnowledgeQueueLength, isAdmin, onOpenDailyKnowledge, onShowNextDailyKnowledge,
  activeTopReminderItem, handleTopReminderClick, isTaskDetailCollapsed, rowThemeOn, toggleRowTheme, toggleTaskDetail, taskQuery, setTaskQuery,
  dashboardTaskFilters, dashboardTaskFilter, setTaskFilter, visibleTaskCount, onCreateTask, dashboardPendingVisible, renderDashboardTaskRow,
  dashboardPendingTasks, dashboardPageSize, dashboardPendingShowAll, setDashboardPendingShowAll, isAllDashboardFilter, dashboardAcceptedTasks,
  dashboardAcceptedOpen, setDashboardAcceptedOpen, dashboardAcceptedVisible, dashboardAcceptedShowAll, setDashboardAcceptedShowAll,
  dashboardTaskMenus, donutData, dailyTrendData, annualData, currentMonthValue, dashboardTaskSidebar,
}: {
  openDashboardCreateMenu: MouseEventHandler<HTMLDivElement>
  stats: DashboardStats
  importedHours: number
  canToggleIncomeVisibility: boolean
  incomeVisible: boolean
  toggleIncomeVisibility: () => void
  hourlyRate: number
  activeMonthTaskCount: number
  dailyKnowledge: DailyKnowledgeItem
  isDailyKnowledgeLoading: boolean
  isDailyKnowledgePrefetching: boolean
  dailyKnowledgeQueueLength: number
  isAdmin: boolean
  onOpenDailyKnowledge: () => void
  onShowNextDailyKnowledge: () => void | Promise<void>
  activeTopReminderItem?: DashboardReminder
  handleTopReminderClick: (item?: DashboardReminder) => void
  isTaskDetailCollapsed: boolean
  rowThemeOn: boolean
  toggleRowTheme: () => void
  toggleTaskDetail: () => void
  taskQuery: string
  setTaskQuery: Dispatch<SetStateAction<string>>
  dashboardTaskFilters: TaskFilter[]
  dashboardTaskFilter: TaskFilter
  setTaskFilter: Dispatch<SetStateAction<TaskFilter>>
  visibleTaskCount: number
  onCreateTask: () => void
  dashboardPendingVisible: Task[]
  renderDashboardTaskRow: (task: Task) => ReactNode
  dashboardPendingTasks: Task[]
  dashboardPageSize: number
  dashboardPendingShowAll: boolean
  setDashboardPendingShowAll: Dispatch<SetStateAction<boolean>>
  isAllDashboardFilter: boolean
  dashboardAcceptedTasks: Task[]
  dashboardAcceptedOpen: boolean
  setDashboardAcceptedOpen: Dispatch<SetStateAction<boolean>>
  dashboardAcceptedVisible: Task[]
  dashboardAcceptedShowAll: boolean
  setDashboardAcceptedShowAll: Dispatch<SetStateAction<boolean>>
  dashboardTaskMenus: ReactNode
  donutData: { items: DonutChartItem[]; total: number }
  dailyTrendData: Array<{ label: string; value: number }>
  annualData: DashboardAnnualData
  currentMonthValue: string
  dashboardTaskSidebar: ReactNode
}) {
  const DASHBOARD_PAGE_SIZE = dashboardPageSize
  return (
          <div className="dashboard-context-surface" onContextMenu={openDashboardCreateMenu}>
        <section className="dashboard-metrics" aria-label="本月统计">
          <article className="dashboard-metric">
            <span>本月总工时</span>
            <strong>{stats.totalHours.toFixed(1)}<small>h</small></strong>
            <p>{importedHours > 0 ? `含导入工时 ${importedHours.toFixed(1)}h` : '本月任务实际投入'}</p>
          </article>
          <article className="dashboard-metric">
            <span>计费工时</span>
            <strong>{stats.billableHours.toFixed(1)}<small>h</small></strong>
            <p>已排除不计费项</p>
          </article>
          <article className="dashboard-metric">
            <span>预计收入</span>
            <strong className={`income-metric-value ${canToggleIncomeVisibility ? '' : 'permission-placeholder'}`}>
              {canToggleIncomeVisibility
                ? (incomeVisible ? `¥${formatYuan(stats.amount)}` : '¥ ****')
                : <><Lock size={15} /><span>管理员可见</span></>}
              {canToggleIncomeVisibility && (
                <button
                  type="button"
                  className="income-visibility-toggle"
                  aria-label={incomeVisible ? '隐藏收入' : '显示收入'}
                  aria-keyshortcuts="Meta+Shift+M Control+Shift+M"
                  title={`${incomeVisible ? '隐藏收入' : '显示收入'}（⌘⇧M / Ctrl⇧M）`}
                  onClick={toggleIncomeVisibility}
                >
                  {incomeVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </strong>
            <p>{canToggleIncomeVisibility ? `按 ¥${hourlyRate} / 小时` : '登录管理员后查看'}</p>
          </article>
          <article className="dashboard-metric">
            <span>验收情况</span>
            <strong>{stats.accepted} / {activeMonthTaskCount}</strong>
            <p className={stats.pending > 0 ? 'attention' : ''}>{stats.pending} 个待验收</p>
          </article>
        </section>

        <section className="daily-knowledge" aria-label="AI 每日知识">
          <button className="daily-knowledge-main" type="button" onClick={() => onOpenDailyKnowledge()}>
            <span className="daily-knowledge-category">✦ {isDailyKnowledgeLoading ? 'AI' : dailyKnowledge.category}</span>
            <span className="daily-knowledge-copy">
              <strong>{isDailyKnowledgeLoading ? 'AI 正在准备一条新的小知识' : dailyKnowledge.title}</strong>
              {!isDailyKnowledgeLoading && <span> · {dailyKnowledge.teaser}</span>}
            </span>
            <span className="daily-knowledge-more">展开阅读</span>
            <em>{dailyKnowledge.source}</em>
          </button>
          <button
            className="daily-knowledge-roll"
            type="button"
            aria-label="让 AI 换一条知识"
            title={isDailyKnowledgePrefetching ? '正在后台预加载小知识' : '换一条'}
            disabled={!isAdmin || (isDailyKnowledgeLoading && dailyKnowledgeQueueLength === 0)}
            onClick={(event) => {
              event.stopPropagation()
              void onShowNextDailyKnowledge()
            }}
          >
            ↻ 换一条
          </button>
        </section>

        {activeTopReminderItem && (
          <button className="due-strip" onClick={() => handleTopReminderClick(activeTopReminderItem)}>
            <AlarmClock size={17} />
            <span className="due-marquee" aria-label="任务提醒">
              <span className="due-marquee-track">
                <span className="due-marquee-item" key={activeTopReminderItem.key}>
                  <strong className={activeTopReminderItem.key.startsWith('due') ? 'due-summary-overdue' : 'due-summary-nearest'}>{activeTopReminderItem.title}</strong>
                  {activeTopReminderItem.body && <em>{activeTopReminderItem.body}</em>}
                </span>
              </span>
            </span>
            <ChevronRight size={15} className="due-arrow" />
          </button>
        )}

        <section className={`content-grid dashboard-content-grid ${isTaskDetailCollapsed ? 'detail-collapsed' : ''}`}>
          <div className="main-column">
            <section className="panel task-panel dashboard-task-panel">
              <div className="dashboard-task-header">
                <div className="dashboard-task-heading-row">
                  <div className="dashboard-task-title-group">
                    <h2>任务明细</h2>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rowThemeOn}
                      className={`giverny-toggle task-row-theme-toggle ${rowThemeOn ? 'on' : ''}`}
                      title={rowThemeOn ? '关闭任务状态配色' : '打开任务状态配色'}
                      onClick={toggleRowTheme}
                    >
                      <span className="giverny-toggle-label">状态色</span>
                      <span className="giverny-toggle-track"><span className="giverny-toggle-thumb" /></span>
                      <span className="task-row-theme-state">{rowThemeOn ? '打开' : '关闭'}</span>
                    </button>
                  </div>
                  <p>按月份汇总工作内容、工时与验收</p>
                  <button
                    type="button"
                    className="detail-pane-toggle"
                    aria-pressed={!isTaskDetailCollapsed}
                    title={isTaskDetailCollapsed ? '显示任务详情' : '收起任务详情'}
                    onClick={toggleTaskDetail}
                  >
                    {isTaskDetailCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                    {isTaskDetailCollapsed ? '显示详情' : '收起详情'}
                  </button>
                </div>
                <TaskSearchBox
                  value={taskQuery}
                  onChange={setTaskQuery}
                  placeholder="搜索本月任务、需求、需求人（/）"
                  className="dashboard-task-search"
                />
              </div>

              <div className="segment-tabs">
                {dashboardTaskFilters.map((filter) => (
                  <button className={dashboardTaskFilter === filter ? 'active' : ''} aria-pressed={dashboardTaskFilter === filter} key={filter} onClick={() => setTaskFilter(filter)}>
                    {filter}
                  </button>
                ))}
              </div>

              <ActiveTaskFilters
                query={taskQuery}
                filter={dashboardTaskFilter}
                onClearQuery={() => setTaskQuery('')}
                onClearFilter={() => setTaskFilter('全部')}
              />

              <div className={`task-list ${rowThemeOn ? '' : 'no-row-theme'}`} onContextMenu={openDashboardCreateMenu}>
                {visibleTaskCount === 0 && (
                  <EmptyState
                    role="status"
                    title={activeMonthTaskCount === 0 ? '这个月还没有任务' : '没有找到匹配任务'}
                    description={activeMonthTaskCount === 0 ? '先建一条真实任务，工时、文件和月报都会从这里串起来。' : '换一个关键词或状态筛选试试。'}
                    action={activeMonthTaskCount === 0 ? (
                      <button className="ghost-button compact-button empty-state-action" onClick={() => onCreateTask()}>
                        <Plus size={15} />
                        新建任务
                      </button>
                    ) : (
                      <button className="ghost-button compact-button empty-state-action" onClick={() => { setTaskQuery(''); setTaskFilter('全部') }}>
                        <RotateCcw size={15} />
                        清除筛选
                      </button>
                    )}
                  />
                )}
                {dashboardPendingVisible.map(renderDashboardTaskRow)}
                {dashboardPendingTasks.length > DASHBOARD_PAGE_SIZE && (
                  <button type="button" className="dashboard-list-more" onClick={() => setDashboardPendingShowAll((current) => !current)}>
                    {dashboardPendingShowAll ? '收起' : `展开剩余 ${dashboardPendingTasks.length - DASHBOARD_PAGE_SIZE} 条`}
                  </button>
                )}
                {isAllDashboardFilter && dashboardAcceptedTasks.length > 0 && (
                  <div className="dashboard-accepted-group">
                    <button
                      type="button"
                      className={`dashboard-accepted-toggle ${dashboardAcceptedOpen ? 'open' : ''}`}
                      onClick={() => setDashboardAcceptedOpen((current) => !current)}
                    >
                      <ChevronDown size={15} />
                      <span>已验收 {dashboardAcceptedTasks.length} 个</span>
                      <em>{dashboardAcceptedOpen ? '收起' : '展开'}</em>
                    </button>
                    {dashboardAcceptedOpen && (
                      <>
                        {dashboardAcceptedVisible.map(renderDashboardTaskRow)}
                        {dashboardAcceptedTasks.length > DASHBOARD_PAGE_SIZE && (
                          <button type="button" className="dashboard-list-more" onClick={() => setDashboardAcceptedShowAll((current) => !current)}>
                            {dashboardAcceptedShowAll ? '收起' : `展开剩余 ${dashboardAcceptedTasks.length - DASHBOARD_PAGE_SIZE} 条`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {dashboardTaskMenus}
              </div>
            </section>

            <details className="insight-shell">
              <summary className="insight-summary">
                <div>
                  <h2>本月洞察</h2>
                  <p>设计类型、周趋势和年度统计</p>
                </div>
                <span className="insight-summary-action">
                  <ChevronDown size={16} />
                  <em className="show-closed">展开</em>
                  <em className="show-open">收起</em>
                </span>
              </summary>

              <div className="insight-body">
                <section className="bottom-grid">
                  <section className="panel distribution-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>设计类型工时分布</h2>
                        <p>本月工作类型分布</p>
                      </div>
                    </div>
                    <DonutChart items={donutData.items} total={donutData.total} />
                  </section>

                  <section className="panel trend-panel">
                    <div className="panel-header compact">
                      <div>
                        <h2>工时趋势 <span>小时</span></h2>
                        <p>按天查看本月投入变化</p>
                      </div>
                    </div>
                    <TrendChart data={dailyTrendData} />
                  </section>
                </section>

                <section className="panel annual-panel">
                  <div className="panel-header compact">
                    <div>
                      <h2>{annualData.year} 年度统计</h2>
                      <p>全年计费工时与收入（已锁定月份按结算快照计）</p>
                    </div>
                    <div className="annual-totals">
                      <span>
                        累计工时 <strong>{annualData.totalHours.toFixed(1)}h</strong>
                      </span>
                      <span>
                        累计收入 <strong>¥{formatYuan(annualData.totalAmount)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="annual-bars">
                    {annualData.rows.map((row) => {
                      const maxHours = Math.max(...annualData.rows.map((item) => item.hours), 1)
                      return (
                        <div
                          className={`annual-bar ${row.month === currentMonthValue ? 'current' : ''}`}
                          key={row.month}
                          title={`${monthLabelOf(row.month)}：${row.hours.toFixed(1)}h · ¥${formatYuan(row.amount)}${row.locked ? '（已锁定）' : ''}`}
                        >
                          <span className="annual-bar-amount">{row.hours > 0 ? `${row.hours.toFixed(1)}h` : ''}</span>
                          <div className="annual-bar-track">
                            <span style={{ height: `${Math.max(row.hours > 0 ? 6 : 0, (row.hours / maxHours) * 100)}%` }} />
                          </div>
                          <small>
                            {Number(row.month.slice(5, 7))}月{row.locked ? ' 🔒' : ''}
                          </small>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            </details>
          </div>
          {dashboardTaskSidebar}
        </section>
          </div>
  )
}
