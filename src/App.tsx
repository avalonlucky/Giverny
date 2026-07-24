import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { importedHoursMonth, importedMonthlyHours } from './config/appConfig'
import { TaskProgressModal } from './components/TaskProgressModal'
import { AppSidebar } from './components/AppSidebar'
import { AppTopbar } from './components/AppTopbar'
import { AppOverlayLayer } from './components/AppOverlayLayer'
import { DashboardView } from './views/DashboardView'
import { initializeGivernyTheme } from './lib/givernyTheme'
import { monthLabelOf } from './lib/month'
import { isTaskListBlankContextTarget } from './lib/taskListPresentation'
import {
  sortTasksByLatestActivity,
  taskHasMonthActivity,
  taskRelatedMonths,
} from './lib/taskAccounting'
import { buildTaskContextInsights } from './lib/taskContextInsights'
import { useWorkspaceAnalytics } from './hooks/useWorkspaceAnalytics'
import { useDailyKnowledge } from './hooks/useDailyKnowledge'
import { useAgentJobNotifications } from './hooks/useAgentJobNotifications'
import { useToastNotifications } from './hooks/useToastNotifications'
import { useTaskActivity } from './hooks/useTaskActivity'
import { useWorkspaceData } from './hooks/useWorkspaceData'
import { useSettingsOperations } from './hooks/useSettingsOperations'
import { useTaskOperations } from './hooks/useTaskOperations'
import { useAppShortcuts } from './hooks/useAppShortcuts'
import { useUiStore } from './stores/uiStore'
import type { AppView, FileAsset, Task, TaskFilter, TaskViewMode } from './types/domain'

const KnowledgeView = lazy(() => import('./views/KnowledgeView'))
const FilesView = lazy(() => import('./views/FilesView'))
const IncomeView = lazy(() => import('./views/IncomeView'))
const ReportsView = lazy(() => import('./views/ReportsView'))
const InsightsView = lazy(() => import('./views/InsightsView'))
const SettingsView = lazy(() => import('./views/SettingsView'))
const TasksView = lazy(() => import('./views/TasksView'))
import './App.css'

initializeGivernyTheme()

const navItems = [
  { label: '工作台', icon: LayoutDashboard },
  { label: '任务', icon: FolderKanban },
  { label: '文件库', icon: Archive },
  { label: '洞察', icon: Sparkles },
  { label: '结算', icon: FileText },
  { label: '收入', icon: BarChart3 },
  { label: '知识库', icon: BookOpen, adminOnly: true },
]

const viewRoutes: Record<AppView, string> = {
  工作台: '/dashboard',
  任务: '/tasks',
  文件库: '/files',
  洞察: '/insights',
  收入: '/income',
  结算: '/reports',
  设置: '/settings',
  知识库: '/knowledge',
}

const routeViews = Object.fromEntries(Object.entries(viewRoutes).map(([view, path]) => [path, view])) as Record<string, AppView>


function viewFromPath(pathname: string): AppView {
  if (pathname === '/updates') {
    return '任务'
  }
  return routeViews[pathname] ?? '工作台'
}

function taskViewModeFromSearch(search: string): TaskViewMode {
  const value = new URLSearchParams(search).get('taskView')
  if (value === 'calendar' || value === '日历') return '日历'
  return '列表'
}

function taskViewRoute(view: AppView, mode: TaskViewMode) {
  if (view !== '任务') {
    return viewRoutes[view]
  }
  if (mode === '日历') return `${viewRoutes[view]}?taskView=calendar`
  return viewRoutes[view]
}


const donutPalette = ['#2f6f6d', '#6f8f72', '#b08a3c', '#66a182', '#b86b5f', '#7c8b46', '#8a7a55', '#a36b7a']

const dashboardTaskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']

// ─── AI 工作助手 ──────────────────────────────────────────────────────────────


function App() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const activeView = viewFromPath(location.pathname)
  const taskViewMode = taskViewModeFromSearch(location.search)
  const {
    calendarDisplayMode, setCalendarDisplayMode, calendarFocusDate, setCalendarFocusDate,
    isLoginModalOpen, setIsLoginModalOpen, monthValue, setMonthValue,
    selectedTaskId, setSelectedTaskId, isTaskDetailCollapsed, detailTaskId, setDetailTaskId,
    editTaskId, setEditTaskId, progressModalTarget, setProgressModalTarget,
    isModalOpen, setIsModalOpen, newTaskSupplemental, setNewTaskSupplemental,
    isCommandPaletteOpen, setIsCommandPaletteOpen, commandPaletteInitialQuery, setCommandPaletteInitialQuery,
    isShortcutHelpOpen, setIsShortcutHelpOpen, isSemanticSearchOpen, setIsSemanticSearchOpen,
    isChatOpen, setIsChatOpen, chatAnalysisFocusId, setChatAnalysisFocusId,
    fileLibraryFocusId, setFileLibraryFocusId, isDailyKnowledgeOpen, setIsDailyKnowledgeOpen,
    incomeVisible, setIncomeVisible, previewFile, setPreviewFile, confirmDialog, setConfirmDialog,
    isConfirmDialogBusy, setIsConfirmDialogBusy, showVoidedTasks, setShowVoidedTasks,
    dashboardContextMenu, setDashboardContextMenu, dashboardCreateMenu, setDashboardCreateMenu,
    isAccountMenuOpen, setIsAccountMenuOpen, taskQuery, setTaskQuery, taskFilter, setTaskFilter,
    dashboardPendingShowAll, setDashboardPendingShowAll, dashboardAcceptedOpen, setDashboardAcceptedOpen,
    dashboardAcceptedShowAll, setDashboardAcceptedShowAll, rowThemeOn, toggleRowTheme,
    settingsEntry, setSettingsEntry, toggleTaskDetail,
  } = useUiStore()
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const { toastQueue, notify, dismissToast } = useToastNotifications()
  const workspaceData = useWorkspaceData(notify)
  const {
    auth, role, accessTokens, newTokenId, authError, setAuthError, isLoaded, taskItems,
    updateItems, fileItems, reports, setReports,
    hourlyRate, pdfTitle, serviceCompanyName, taxMode, designTypeGroups, aiModelConfig,
    aiProviderConfigs, setAiProviderConfigs,
    backendStatus, backendSyncSlow: effectiveBackendSyncSlow, isOffline, storageUsage,
    attachmentAnalyses, refreshState, retryRefreshState, isAdmin,
  } = workspaceData
  const settingsOperations = useSettingsOperations({
    workspace: workspaceData,
    notify,
    setConfirmDialog,
    setIsLoginModalOpen,
    setIsAccountMenuOpen,
  })
  const {
    handleExportBackup, handleUnlock, handleSignOut, handleChangeAdminPassword,
    handleCreateAccessToken, handleToggleAccessToken, handleDeleteAccessToken, handleCopyAccessToken,
    handleRateChange, handlePdfTitleChange, handleServiceCompanyNameChange, handleTaxModeChange,
    handleDesignTypeGroupsChange, handleAiModelConfigChange,
  } = settingsOperations
  // 角色能力分级（前端展示用；后端是真正的安全边界）
  const canSeeFull = Boolean(auth) && (role === 'admin' || role === 'collaborator' || role === 'viewer') // 看管理员级全量视图
  const canWrite = Boolean(auth) && (role === 'admin' || role === 'collaborator') // 可做非敏感写入
  const isClient = role === 'client' && Boolean(auth) // 甲方：当月结算/洞察可见
  const canToggleIncomeVisibility = canSeeFull || isClient
  const { taskActivity, loadTaskActivity } = useTaskActivity()
  const toggleIncomeVisibility = () => setIncomeVisible((value) => !value)
  const currentMonth = useMemo(() => ({ value: monthValue, label: monthLabelOf(monthValue) }), [monthValue])
  const taskMonthValues = useMemo(() => {
    const values = new Set<string>()
    taskItems.forEach((task) => {
      taskRelatedMonths(task).forEach((value) => values.add(value))
    })
    return values
  }, [taskItems])
  const monthTasks = useMemo(
    () => sortTasksByLatestActivity(taskItems.filter((task) => taskHasMonthActivity(task, currentMonth.value))),
    [currentMonth.value, taskItems],
  )
  const activeMonthTasks = useMemo(() => monthTasks.filter((task) => !task.voidedAt), [monthTasks])
  const {
    dailyKnowledge,
    dailyKnowledgeQueueLength,
    isDailyKnowledgeLoading,
    isDailyKnowledgePrefetching,
    showNextDailyKnowledge,
  } = useDailyKnowledge({
    isAdmin,
    isLoaded,
    currentMonthValue: currentMonth.value,
    activeMonthTasks,
  })
  const taskPageSourceTasks = useMemo(
    () => sortTasksByLatestActivity(showVoidedTasks ? monthTasks : activeMonthTasks),
    [activeMonthTasks, monthTasks, showVoidedTasks],
  )
  const monthUpdates = useMemo(
    () =>
      updateItems.filter((update) => {
        const task = taskItems.find((item) => item.id === update.taskId)
        if (task?.voidedAt) {
          return false
        }
        return update.date.startsWith(currentMonth.value)
      }),
    [currentMonth.value, taskItems, updateItems],
  )
  const importedHours = currentMonth.value === importedHoursMonth ? importedMonthlyHours : 0
  const isTaskCalendarView = activeView === '任务' && taskViewMode === '日历'
  const effectiveCalendarFocusDate = calendarFocusDate.startsWith(currentMonth.value) ? calendarFocusDate : `${currentMonth.value}-01`
  const viewTitle = activeView === '工作台' ? `${currentMonth.label}工作台` : activeView

  const toggleChat = useCallback(() => {
    setIsChatOpen((current) => {
      if (!current) setChatAnalysisFocusId('')
      return !current
    })
  }, [setChatAnalysisFocusId, setIsChatOpen])

  const openAnalysisJob = useCallback((jobId: string) => {
    setChatAnalysisFocusId(jobId)
    setIsChatOpen(true)
  }, [setChatAnalysisFocusId, setIsChatOpen])
  const { topAnalysisJobs, markAnalysisJobRead } = useAgentJobNotifications({ isAdmin, notify, onOpenJob: openAnalysisJob })

  const handleConfirmDialogConfirm = async () => {
    if (!confirmDialog || isConfirmDialogBusy) {
      return
    }
    setIsConfirmDialogBusy(true)
    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setIsConfirmDialogBusy(false)
    }
  }

  const navigateView = (view: AppView) => {
    setIsAccountMenuOpen(false)
    const nextPath = taskViewRoute(view, taskViewMode)
    if (`${location.pathname}${location.search}` !== nextPath) {
      routerNavigate(nextPath, { state: { view, taskViewMode } })
    }
  }

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) {
        return
      }
      setIsAccountMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountMenuOpen, setIsAccountMenuOpen])

  useEffect(() => {
    const canonicalPath = taskViewRoute(activeView, taskViewMode)
    if (`${location.pathname}${location.search}` !== canonicalPath) {
      routerNavigate(canonicalPath, { replace: true, state: { view: activeView, taskViewMode } })
    }
  }, [activeView, location.pathname, location.search, routerNavigate, taskViewMode])


  const dashboardTaskFilter = dashboardTaskFilters.includes(taskFilter) ? taskFilter : '全部'

  const filterTasks = (tasks: Task[], filter: TaskFilter = taskFilter) =>
    tasks.filter((task) => {
      const matchesFilter = filter === '全部' || (!task.voidedAt && task.status === filter)
      const query = taskQuery.trim().toLowerCase()
      const matchesQuery =
        !query ||
        [task.title, task.requirement, task.type, task.requester ?? '', task.contact, task.reviewer, task.voidReason ?? ''].some((value) =>
          value.toLowerCase().includes(query),
        )

      return matchesFilter && matchesQuery
    })

  const visibleTasks = filterTasks(activeMonthTasks, dashboardTaskFilter)
  const taskPageTasks = filterTasks(taskPageSourceTasks)
  // 工作台只在「全部」筛选下折叠已验收：未完成任务进首屏（兜底分页），已验收收进可展开分区。
  // 选了具体状态（含「已验收」）时直接全量展示该状态，不再折叠。
  const DASHBOARD_PAGE_SIZE = 15
  const isAllDashboardFilter = dashboardTaskFilter === '全部'
  const dashboardPendingTasks = isAllDashboardFilter ? visibleTasks.filter((task) => task.status !== '已验收') : visibleTasks
  const dashboardAcceptedTasks = isAllDashboardFilter ? visibleTasks.filter((task) => task.status === '已验收') : []
  const dashboardPendingVisible = dashboardPendingShowAll ? dashboardPendingTasks : dashboardPendingTasks.slice(0, DASHBOARD_PAGE_SIZE)
  const dashboardAcceptedVisible = dashboardAcceptedShowAll ? dashboardAcceptedTasks : dashboardAcceptedTasks.slice(0, DASHBOARD_PAGE_SIZE)
  const dashboardSelectableTasks = [
    ...dashboardPendingVisible,
    ...(dashboardAcceptedOpen ? dashboardAcceptedVisible : []),
  ]
  const selectedTaskSource = activeView === '任务' ? taskPageTasks : dashboardSelectableTasks
  const selectedTask = selectedTaskSource.find((task) => task.id === selectedTaskId) ?? selectedTaskSource.at(0)
  const selectedTaskActivityId = selectedTask?.id ?? 0
  const selectedTaskSourceSignature = selectedTaskSource.map((task) => task.id).join(',')

  useEffect(() => {
    // Filters, pagination and collapsed groups should keep the detail pane aligned with a rendered row.
    const visibleIds = selectedTaskSourceSignature ? selectedTaskSourceSignature.split(',').map(Number) : []
    setSelectedTaskId((currentId) => visibleIds.includes(currentId) ? currentId : visibleIds[0] ?? 0)
  }, [selectedTaskSourceSignature, setSelectedTaskId])

  const voidedMonthTaskCount = useMemo(() => monthTasks.filter((task) => task.voidedAt).length, [monthTasks])

  const activeTaskItems = useMemo(() => taskItems.filter((task) => !task.voidedAt), [taskItems])
  const taskContextInsights = buildTaskContextInsights(activeTaskItems, updateItems)

  const { stats, donutData, activeTopReminderItem, annualData, incomeToday, incomeDailyGroups, dailyTrendData } = useWorkspaceAnalytics({
    activeMonthTasks,
    activeTaskItems,
    currentMonth,
    hourlyRate,
    importedHours,
    reports,
    topAnalysisJobs,
    isAdmin,
    donutPalette,
  })

  const handleTopReminderClick = (item?: { key: string; jobId?: string }) => {
    if (item?.jobId) {
      markAnalysisJobRead(item.jobId)
      return
    }
    navigateView('任务')
  }

  const taskOperations = useTaskOperations({
    workspace: workspaceData,
    selectedTask,
    detailTaskId,
    loadTaskActivity,
    notify,
    setSelectedTaskId,
    setMonthValue,
    setIsModalOpen,
    setDetailTaskId,
    setEditTaskId,
    setProgressModalTarget,
    setConfirmDialog,
    setIsLoginModalOpen,
    previewFile,
    setPreviewFile,
    calendarDisplayMode,
    currentMonthValue: currentMonth.value,
    effectiveCalendarFocusDate,
    setCalendarFocusDate,
    canWrite,
    isAdmin,
  })
  const {
    progressAssessments, voidTaskTarget, setVoidTaskTarget, isVoidTaskBusy, showFireworks,
    requireAdmin, handleCreateTask, handleRetryAttachmentAnalysis, handleCreateTaskUpdate,
    handleOpenTaskDetail, handleOpenTaskEdit, handleOpenTaskProgress, handleDeleteTaskTimeEntry,
    handleTaskCalendarMonthChange, shiftTaskCalendarPeriod,
    handleDeleteAcceptanceProgress, handleOpenTaskAcceptance, handleSaveTaskEdit,
    handleConfirmTaskAcceptance, handleQuickUploadImage, handleAcceptanceFileUpload,
    handleAutoEstimateProgress, handleUpdateTask, handleVoidTask, confirmVoidTask,
    handleRestoreTask, handleDeleteTask, handleDownloadFile, handleDeleteFile, handleUpdateFile,
  } = taskOperations
  useEffect(() => {
    if (!dashboardContextMenu && !dashboardCreateMenu) {
      return
    }
    const closeMenu = () => {
      setDashboardContextMenu(null)
      setDashboardCreateMenu(null)
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [dashboardContextMenu, dashboardCreateMenu, setDashboardContextMenu, setDashboardCreateMenu])

  const openDashboardContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault()
    setDashboardCreateMenu(null)
    setSelectedTaskId(task.id)
    setDashboardContextMenu({ x: event.clientX, y: event.clientY, task })
  }

  const openDashboardCreateMenu = (event: React.MouseEvent) => {
    if (!isTaskListBlankContextTarget(event.target)) {
      return
    }
    event.preventDefault()
    setDashboardContextMenu(null)
    setDashboardCreateMenu({ x: event.clientX, y: event.clientY })
  }

  const openNewTaskFromDashboardMenu = () => {
    setDashboardCreateMenu(null)
    openCreateTask(false)
  }

  // 选中任务变化时自动加载它的动态时间轴（工作台右侧明细卡用）
  useEffect(() => {
    if (selectedTaskActivityId) void loadTaskActivity(selectedTaskActivityId)
  }, [loadTaskActivity, selectedTaskActivityId])

  const openCreateTask = (supplemental = false) => {
    if (canWrite) {
      setNewTaskSupplemental(supplemental)
      setIsModalOpen(true)
      return
    }
    requireAdmin()
  }
  const readOnlyUpdateTask = () => requireAdmin()
  const readOnlyUploadFile = async (): Promise<FileAsset> => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const readOnlyUploadImage = async () => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const readOnlyCreateUpdate = async () => {
    requireAdmin()
    throw new Error('需要管理员权限')
  }
  const {
    visibleNavItems, navShortcutHints, navAriaShortcutHints,
    commandActions, shortcutHelpGroups,
  } = useAppShortcuts({
    navItems, activeView, canWrite, isAdmin, canToggleIncomeVisibility,
    selectedTask, taskItems, selectedTaskSource, navigateView, openCreateTask,
    handleOpenTaskDetail, handleOpenTaskEdit, handleOpenTaskProgress, handleOpenTaskAcceptance,
    isModalOpen, detailTaskId, editTaskId, progressModalTarget, previewFile, confirmDialog,
    voidTaskTarget, isLoginModalOpen, isCommandPaletteOpen, setIsCommandPaletteOpen,
    setCommandPaletteInitialQuery, isShortcutHelpOpen, setIsShortcutHelpOpen,
    toggleIncomeVisibility, toggleChat, setMonthValue, setSelectedTaskId,
  })
  const adminOnlyPanel = (
    <section className="panel read-only-settings-panel">
      <div className="panel-header compact">
        <div>
          <h2>管理员可见</h2>
          <p>这里包含洞察、结算、收入或系统配置，只对管理员开放。游客和合作伙伴成员可以继续查看公开任务、进展和合作伙伴可见文件。</p>
        </div>
      </div>
      <button className="primary-button" onClick={() => setIsLoginModalOpen(true)}>
        <KeyRound size={17} />
        登录管理员
      </button>
    </section>
  )
  if (!isLoaded) {
    return (
      <main className="boot-screen">
        <div className="boot-card">
          <div className="brand-mark">
            <img className="brand-logo" src="/giverny-logo.png" alt="" />
          </div>
          <strong>正在连接工作台</strong>
          <p>正在读取任务、文件和结算数据</p>
          <span className="loading-indicator">
            <LoaderCircle size={15} />
            Cloudflare D1 / R2
          </span>
        </div>
      </main>
    )
  }

  return (
    <main className={`app-shell ${activeView === '工作台' ? 'dashboard-layout' : ''}`.trim()}>
      <AppSidebar
        activeView={activeView}
        backendStatus={backendStatus}
        navItems={visibleNavItems}
        navShortcutHints={navShortcutHints}
        navAriaShortcutHints={navAriaShortcutHints}
        accountMenuRef={accountMenuRef}
        isAccountMenuOpen={isAccountMenuOpen}
        auth={auth}
        role={role}
        isAdmin={isAdmin}
        storageUsage={storageUsage}
        onNavigate={navigateView}
        onAccountMenuOpenChange={setIsAccountMenuOpen}
        onOpenSettings={(tab) => { setSettingsEntry({ tab, nonce: Date.now() }); navigateView('设置') }}
        onLogin={() => setIsLoginModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <section className="workspace">
        <AppTopbar
          activeView={activeView}
          viewTitle={viewTitle}
          isTaskCalendarView={isTaskCalendarView}
          currentMonthValue={currentMonth.value}
          taskMonthValues={taskMonthValues}
          calendarDisplayMode={calendarDisplayMode}
          taskCount={activeMonthTasks.length}
          pendingCount={stats.pending}
          canSeeFull={canSeeFull}
          isAdmin={isAdmin}
          isChatOpen={isChatOpen}
          canWrite={canWrite}
          onMonthChange={isTaskCalendarView ? handleTaskCalendarMonthChange : setMonthValue}
          onCalendarDisplayModeChange={setCalendarDisplayMode}
          onCalendarPeriodShift={shiftTaskCalendarPeriod}
          onOpenSemanticSearch={() => setIsSemanticSearchOpen(true)}
          onToggleChat={toggleChat}
          onOpenShortcutHelp={() => setIsShortcutHelpOpen(true)}
          onCreateTask={() => openCreateTask(false)}
        />

        {(backendStatus !== '已接入 D1/R2' || effectiveBackendSyncSlow || isOffline) && (
          <div
            className={`backend-notice ${
              backendStatus === '后端异常' || isOffline ? 'error' : effectiveBackendSyncSlow ? 'slow' : 'pending'
            }`}
            role={backendStatus === '后端异常' || isOffline ? 'alert' : 'status'}
          >
            {backendStatus === '后端异常' || isOffline ? <AlertTriangle size={16} /> : <LoaderCircle size={16} />}
            <div>
              <strong>
                {isOffline
                  ? '当前处于离线状态'
                  : backendStatus === '后端异常'
                    ? '最新数据同步失败'
                    : effectiveBackendSyncSlow
                      ? '同步时间较长'
                      : '正在同步最新数据'}
              </strong>
              <span>
                {isOffline
                  ? '页面会保留本地快照，网络恢复后请重新同步。'
                  : backendStatus === '后端异常'
                    ? '当前页面可能显示上次成功加载的内容。'
                    : effectiveBackendSyncSlow
                      ? '网络可能较慢，你可以先浏览页面，完成后会自动更新。'
                      : '你可以先浏览页面，完成后会自动更新。'}
              </span>
            </div>
            {(backendStatus === '后端异常' || effectiveBackendSyncSlow || isOffline) && (
              <button type="button" className="text-button" onClick={() => void retryRefreshState()}>
                <RotateCcw size={14} />
                重新同步
              </button>
            )}
          </div>
        )}

        {activeView === '工作台' && (
          <DashboardView
            openDashboardCreateMenu={openDashboardCreateMenu}
            stats={stats}
            importedHours={importedHours}
            canToggleIncomeVisibility={canToggleIncomeVisibility}
            incomeVisible={incomeVisible}
            toggleIncomeVisibility={toggleIncomeVisibility}
            hourlyRate={hourlyRate}
            activeMonthTaskCount={activeMonthTasks.length}
            dailyKnowledge={dailyKnowledge}
            isDailyKnowledgeLoading={isDailyKnowledgeLoading}
            isDailyKnowledgePrefetching={isDailyKnowledgePrefetching}
            dailyKnowledgeQueueLength={dailyKnowledgeQueueLength}
            isAdmin={isAdmin}
            onOpenDailyKnowledge={() => setIsDailyKnowledgeOpen(true)}
            onShowNextDailyKnowledge={showNextDailyKnowledge}
            activeTopReminderItem={activeTopReminderItem}
            handleTopReminderClick={handleTopReminderClick}
            isTaskDetailCollapsed={isTaskDetailCollapsed}
            rowThemeOn={rowThemeOn}
            toggleRowTheme={toggleRowTheme}
            toggleTaskDetail={toggleTaskDetail}
            taskQuery={taskQuery}
            setTaskQuery={setTaskQuery}
            dashboardTaskFilters={dashboardTaskFilters}
            dashboardTaskFilter={dashboardTaskFilter}
            setTaskFilter={setTaskFilter}
            visibleTaskCount={visibleTasks.length}
            onCreateTask={openNewTaskFromDashboardMenu}
            dashboardPendingVisible={dashboardPendingVisible}
            dashboardPendingTasks={dashboardPendingTasks}
            dashboardPageSize={DASHBOARD_PAGE_SIZE}
            dashboardPendingShowAll={dashboardPendingShowAll}
            setDashboardPendingShowAll={setDashboardPendingShowAll}
            isAllDashboardFilter={isAllDashboardFilter}
            dashboardAcceptedTasks={dashboardAcceptedTasks}
            dashboardAcceptedOpen={dashboardAcceptedOpen}
            setDashboardAcceptedOpen={setDashboardAcceptedOpen}
            dashboardAcceptedVisible={dashboardAcceptedVisible}
            dashboardAcceptedShowAll={dashboardAcceptedShowAll}
            setDashboardAcceptedShowAll={setDashboardAcceptedShowAll}
            donutData={donutData}
            dailyTrendData={dailyTrendData}
            annualData={annualData}
            currentMonthValue={currentMonth.value}
            selectedTask={selectedTask}
            taskContextInsights={taskContextInsights}
            onSelectTask={setSelectedTaskId}
            onOpenTaskContextMenu={openDashboardContextMenu}
            dashboardContextMenu={dashboardContextMenu}
            onCloseTaskContextMenu={() => setDashboardContextMenu(null)}
            dashboardCreateMenu={dashboardCreateMenu}
            onOpenTask={handleOpenTaskDetail}
            onOpenEditTask={handleOpenTaskEdit}
            onOpenAcceptance={handleOpenTaskAcceptance}
            onOpenProgress={handleOpenTaskProgress}
            onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
            onVoidTask={isAdmin ? handleVoidTask : readOnlyUpdateTask}
            onRestoreTask={isAdmin ? handleRestoreTask : readOnlyUpdateTask}
            onDeleteTask={isAdmin ? handleDeleteTask : readOnlyUpdateTask}
            files={fileItems}
            progressAssessments={progressAssessments}
            onPreviewFile={setPreviewFile}
            onDeleteEntry={isAdmin ? handleDeleteTaskTimeEntry : () => requireAdmin()}
            onDeleteAcceptanceProgress={isAdmin ? handleDeleteAcceptanceProgress : () => requireAdmin()}
            onAutoEstimateProgress={canWrite ? handleAutoEstimateProgress : undefined}
            canWrite={canWrite}
            canDelete={isAdmin}
          />
        )}

        {activeView === '任务' && (
          <Suspense fallback={<p className="calendar-empty-hint">正在载入任务管理…</p>}>
          <TasksView
            viewMode={taskViewMode}
            onViewModeChange={(mode) => routerNavigate(taskViewRoute('任务', mode), {
              replace: true,
              state: { view: '任务', taskViewMode: mode },
            })}
            calendarMode={calendarDisplayMode}
            calendarFocusDate={effectiveCalendarFocusDate}
            onCalendarFocusDateChange={setCalendarFocusDate}
            monthValue={currentMonth.value}
            onMonthChange={setMonthValue}
            designTypeGroups={designTypeGroups}
            activeMonthTasks={activeMonthTasks}
            selectedTask={selectedTask}
            tasks={taskPageTasks}
            contextInsights={taskContextInsights}
            taskFilter={taskFilter}
            taskQuery={taskQuery}
            showVoidedTasks={showVoidedTasks}
            voidedTaskCount={voidedMonthTaskCount}
            onFilterChange={setTaskFilter}
            onQueryChange={setTaskQuery}
            onShowVoidedChange={setShowVoidedTasks}
            onSelectTask={setSelectedTaskId}
            onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
            onVoidTask={isAdmin ? handleVoidTask : readOnlyUpdateTask}
            onRestoreTask={isAdmin ? handleRestoreTask : readOnlyUpdateTask}
            onDeleteTask={isAdmin ? handleDeleteTask : readOnlyUpdateTask}
            onDeleteEntry={isAdmin ? handleDeleteTaskTimeEntry : () => requireAdmin()}
            onDeleteAcceptanceProgress={isAdmin ? handleDeleteAcceptanceProgress : () => requireAdmin()}
            onOpenTask={handleOpenTaskDetail}
            onOpenEditTask={handleOpenTaskEdit}
            files={fileItems}
            progressAssessments={progressAssessments}
            onPreviewFile={setPreviewFile}
            hourlyRate={hourlyRate}
            onCreateTask={() => openCreateTask(false)}
            rowThemeOn={rowThemeOn}
            onAutoEstimateProgress={canWrite ? handleAutoEstimateProgress : undefined}
            canWrite={canWrite}
            canDelete={isAdmin}
            detailCollapsed={isTaskDetailCollapsed}
            onToggleDetail={toggleTaskDetail}
            renderProgressModal={(target, onClose) => (
              <TaskProgressModal
                task={target.task}
                mode={target.mode}
                editEntryId={target.editEntryId}
                files={fileItems}
                activity={taskActivity}
                onClose={onClose}
                onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
                onCreateTaskUpdate={canWrite ? handleCreateTaskUpdate : readOnlyCreateUpdate}
                onUploadImage={canWrite ? handleQuickUploadImage : readOnlyUploadImage}
                onPreviewFile={setPreviewFile}
                onUpdateFile={canWrite ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
                onDeleteFile={isAdmin ? handleDeleteFile : () => requireAdmin()}
                onConfirmAcceptance={isAdmin ? handleConfirmTaskAcceptance : undefined}
                onUploadAcceptanceFile={canWrite ? handleAcceptanceFileUpload : readOnlyUploadFile}
                onNotify={notify}
                initialAcceptanceMode={target.initialAcceptanceMode}
                hourlyRate={hourlyRate}
              />
            )}
          />
          </Suspense>
        )}

        {activeView === '文件库' && (
          <Suspense fallback={<p className="calendar-empty-hint">正在载入文件库…</p>}>
            <FilesView
              files={fileItems}
              tasks={taskItems}
              attachmentAnalyses={attachmentAnalyses}
              currentMonthValue={currentMonth.value}
              focusFileId={fileLibraryFocusId}
              onFocusHandled={() => setFileLibraryFocusId(0)}
              onPreviewFile={setPreviewFile}
              onDeleteFile={isAdmin ? handleDeleteFile : readOnlyUpdateTask}
              onDownloadFile={handleDownloadFile}
              onUpdateFile={canWrite ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
              onRetryAnalysis={handleRetryAttachmentAnalysis}
              canWrite={canWrite}
              canDelete={isAdmin}
            />
          </Suspense>
        )}

        {activeView === '洞察' && (
          canSeeFull || isClient ? (
            <Suspense fallback={<p className="calendar-empty-hint">正在载入洞察分析…</p>}>
              <InsightsView
                tasks={activeTaskItems}
                updates={updateItems}
                files={fileItems}
                attachmentAnalyses={attachmentAnalyses}
                reports={reports}
                currentMonth={currentMonth}
                hourlyRate={hourlyRate}
                donutPalette={donutPalette}
              />
            </Suspense>
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '收入' && (
          canSeeFull ? (
            <Suspense fallback={<p className="calendar-empty-hint">正在载入收入分析…</p>}>
              <IncomeView
                annualData={annualData}
                currentMonth={currentMonth}
                taxMode={taxMode}
                onMonthChange={setMonthValue}
                dailyGroups={incomeDailyGroups}
                today={incomeToday}
              />
            </Suspense>
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '结算' && (
          canSeeFull || isClient ? (
            <Suspense fallback={<p className="calendar-empty-hint">正在载入结算回单…</p>}>
              <ReportsView
                stats={stats}
                tasks={activeMonthTasks}
                allTasks={activeTaskItems}
                updates={monthUpdates}
                allUpdates={updateItems}
                hourlyRate={hourlyRate}
                importedHours={importedHours}
                currentMonth={currentMonth}
                pdfTitle={pdfTitle}
                serviceCompanyName={serviceCompanyName}
                reports={reports}
                onReportDeleted={(reportId) => setReports((current) => current.filter((report) => report.id !== reportId))}
                onNotify={notify}
              />
            </Suspense>
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '知识库' && isAdmin && (
          <Suspense fallback={<p className="calendar-empty-hint">正在载入知识库…</p>}>
            <KnowledgeView />
          </Suspense>
        )}

        {activeView === '设置' && (
          isAdmin ? (
            <Suspense fallback={<p className="calendar-empty-hint">正在载入设置…</p>}>
              <SettingsView
                key={settingsEntry.nonce}
                initialTab={settingsEntry.tab}
                hourlyRate={hourlyRate}
                pdfTitle={pdfTitle}
                serviceCompanyName={serviceCompanyName}
                taxMode={taxMode}
                designTypeGroups={designTypeGroups}
                aiModelConfig={aiModelConfig}
                aiProviderConfigs={aiProviderConfigs}
                role={role}
                accessTokens={accessTokens}
                newTokenId={newTokenId}
                storageUsage={storageUsage}
                onRateChange={handleRateChange}
                onPdfTitleChange={handlePdfTitleChange}
                onServiceCompanyNameChange={handleServiceCompanyNameChange}
                onTaxModeChange={handleTaxModeChange}
                onDesignTypeGroupsChange={handleDesignTypeGroupsChange}
                onAiModelConfigChange={handleAiModelConfigChange}
                onAiProviderConfigsChange={setAiProviderConfigs}
                onExportBackup={handleExportBackup}
                onSignOut={handleSignOut}
                onChangePassword={handleChangeAdminPassword}
                onCreateToken={handleCreateAccessToken}
                onToggleToken={handleToggleAccessToken}
                onDeleteToken={handleDeleteAccessToken}
                onCopyToken={handleCopyAccessToken}
              />
            </Suspense>
          ) : (
            <section className="panel read-only-settings-panel">
              <div className="panel-header compact">
                <div>
                  <h2>只读访问</h2>
                  <p>游客可以查看任务和公开文件，编辑、上传、验收和结算需要管理员身份。</p>
                </div>
              </div>
              <button className="primary-button" onClick={() => setIsLoginModalOpen(true)}>
                <KeyRound size={17} />
                登录管理员
              </button>
            </section>
          )
        )}
      </section>

      <AppOverlayLayer
        dailyKnowledgeOpen={isDailyKnowledgeOpen}
        dailyKnowledge={dailyKnowledge}
        dailyKnowledgeLoading={isDailyKnowledgeLoading}
        isAdmin={isAdmin}
        onRefreshDailyKnowledge={() => void showNextDailyKnowledge()}
        onCloseDailyKnowledge={() => setIsDailyKnowledgeOpen(false)}
        onFavoriteDailyKnowledge={async (item) => {
          const response = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: item.title, content: item.body.join('\n\n'), tags: item.category, source: 'ai-tip' }),
          })
          return response.ok
        }}
        commandPaletteOpen={isCommandPaletteOpen}
        commandPaletteInitialQuery={commandPaletteInitialQuery}
        commandActions={commandActions}
        onCloseCommandPalette={() => setIsCommandPaletteOpen(false)}
        shortcutHelpOpen={isShortcutHelpOpen}
        shortcutHelpGroups={shortcutHelpGroups}
        onCloseShortcutHelp={() => setIsShortcutHelpOpen(false)}
        chatOpen={isChatOpen}
        currentMonthValue={currentMonth.value}
        aiModelConfig={aiModelConfig}
        aiProviderConfigs={aiProviderConfigs}
        chatAnalysisFocusId={chatAnalysisFocusId}
        notify={notify}
        onCloseChat={() => { setIsChatOpen(false); setChatAnalysisFocusId('') }}
        onOpenChatTask={(taskId) => {
          setIsChatOpen(false)
          setChatAnalysisFocusId('')
          void refreshState().then(() => handleOpenTaskDetail(taskId))
        }}
        semanticSearchOpen={isSemanticSearchOpen}
        files={fileItems}
        tasks={taskItems}
        onCloseSemanticSearch={() => setIsSemanticSearchOpen(false)}
        onOpenSemanticTask={(taskId) => { setIsSemanticSearchOpen(false); handleOpenTaskDetail(taskId) }}
        onOpenSemanticFile={(fileId) => { setIsSemanticSearchOpen(false); setFileLibraryFocusId(fileId); navigateView('文件库') }}
        createTaskOpen={isModalOpen}
        newTaskSupplemental={newTaskSupplemental}
        designTypeGroups={designTypeGroups}
        onCloseCreateTask={() => setIsModalOpen(false)}
        onCreateTask={canWrite ? handleCreateTask : async () => requireAdmin()}
        onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
        detailTaskId={detailTaskId}
        onCloseTaskDetail={() => setDetailTaskId(0)}
        onOpenTaskAcceptance={handleOpenTaskAcceptance}
        onOpenTaskEditFromDetail={(taskId) => { setDetailTaskId(0); handleOpenTaskEdit(taskId) }}
        onOpenTaskProgressFromDetail={(taskId) => { setDetailTaskId(0); handleOpenTaskProgress(taskId) }}
        editTaskId={editTaskId}
        onCloseTaskEdit={() => setEditTaskId(0)}
        onSaveTaskEdit={handleSaveTaskEdit}
        progressModalTarget={progressModalTarget}
        taskActivity={taskActivity}
        onCloseTaskProgress={() => setProgressModalTarget(null)}
        onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
        onCreateTaskUpdate={canWrite ? handleCreateTaskUpdate : readOnlyCreateUpdate}
        onUploadImage={canWrite ? handleQuickUploadImage : readOnlyUploadImage}
        onPreviewFile={setPreviewFile}
        onUpdateFile={canWrite ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
        onDeleteFile={isAdmin ? handleDeleteFile : () => requireAdmin()}
        onConfirmAcceptance={isAdmin ? handleConfirmTaskAcceptance : undefined}
        onUploadAcceptanceFile={canWrite ? handleAcceptanceFileUpload : undefined}
        hourlyRate={hourlyRate}
        confirmDialog={confirmDialog}
        confirmDialogBusy={isConfirmDialogBusy}
        onCloseConfirmDialog={() => setConfirmDialog(null)}
        onConfirmDialog={() => void handleConfirmDialogConfirm()}
        voidTaskTarget={voidTaskTarget}
        voidTaskBusy={isVoidTaskBusy}
        onCloseVoidTask={() => setVoidTaskTarget(null)}
        onConfirmVoidTask={(reason) => void confirmVoidTask(reason)}
        previewFile={previewFile}
        onClosePreviewFile={() => setPreviewFile(null)}
        loginModalOpen={isLoginModalOpen}
        authError={authError}
        onCloseLogin={() => { setIsLoginModalOpen(false); setAuthError('') }}
        onUnlock={handleUnlock}
        showFireworks={showFireworks}
        toastQueue={toastQueue}
        onDismissToast={dismissToast}
      />
    </main>
  )
}



export default App
