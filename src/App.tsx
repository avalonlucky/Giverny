import { lazy, Suspense, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  PanelRightClose,
  PanelRightOpen,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import {
  defaultDesignTypeGroups,
  defaultDesignTypes,
  defaultHourlyRate,
  defaultPdfTitle,
  defaultServiceCompanyName,
  importedHoursMonth,
  importedMonthlyHours,
  type DesignTypeGroup,
} from './config/appConfig'
import { productShortcutHelpGroups } from './productCapabilities'
import {
  api,
  ApiError,
  authedPreviewUrl,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type AccessToken,
  type ActivityItem,
  type AiModelConfig,
  type AiModelEndpointConfig,
  type AiModelRouteKey,
  type AiProviderConfig,
  type AuthRole,
  type DailyKnowledgeSuggestion,
  type ReportRecord,
  type StorageUsage,
  type StoredAuth,
  type TaskProgressAssessment,
  type TokenScope,
} from './lib/api'
import { DonutChart, type DonutChartItem } from './components/DonutChart'
import { TrendChart } from './components/TrendChart'
import { ModalShell } from './components/ModalShell'
import { CreateTaskContextMenu, TaskContextMenu } from './components/TaskContextMenu'
import { AdminLoginModal } from './components/AdminLoginModal'
import { DailyKnowledgeModal } from './components/DailyKnowledgeModal'
import { ConfirmDialogModal, type ConfirmDialogState } from './components/ConfirmDialogModal'
import { VoidTaskModal } from './components/VoidTaskModal'
import { FilePreviewModal } from './components/FilePreviewModal'
import { AttachmentHoverThumbnail } from './components/AttachmentHoverThumbnail'
import { DashboardTaskSidebar } from './components/DashboardTaskSidebar'
import { TaskContextInsightBadge } from './components/TaskContextInsightBadge'
import { TaskDetailModal } from './components/TaskDetailModal'
import { TaskProgressModal } from './components/TaskProgressModal'
import { AppSidebar } from './components/AppSidebar'
import { AppTopbar } from './components/AppTopbar'
import { NewTaskModal } from './components/NewTaskModal'
import { CommandPalette, ShortcutHelpModal, type CommandPaletteAction, type ShortcutHelpGroup } from './components/CommandPalette'
import { ActiveTaskFilters, StatusBadge, TaskSearchBox } from './components/TaskUi'
import { EmptyState } from './components/EmptyState'
import { initializeGivernyTheme } from './lib/givernyTheme'
import { monthLabelOf } from './lib/month'
import { formatFileSize } from './lib/format'
import { formatDuration } from './lib/durationDisplay'
import { datePart, isoDate, isoDateTime, localDateFromIsoDate, monthPart, pad } from './lib/dateTime'
import { addIsoDays } from './lib/calendar'
import { formatYuan } from './lib/money'
import { fileThumbnailSource, fileTypeForAsset, fileTypeForFile, isInlineImageFileType } from './lib/fileTypes'
import { taskSettlementMonth } from './lib/taskSettlement'
import {
  formatTaskActivityDateRange,
  formatTaskActivityTime,
  isTaskListBlankContextTarget,
  taskDueState,
} from './lib/taskListPresentation'
import {
  isSupplementalTask,
  isTaskBillable,
  minutesForTimeEntry,
  sortTasksByLatestActivity,
  sumBillableAmountForMonth,
  sumTimeEntries,
  taskBillableHoursInMonth,
  taskHasMonthActivity,
  taskHoursInMonth,
  taskRelatedMonths,
  timeEntryMonth,
} from './lib/taskAccounting'
import { normalizeDesignTypeGroups } from './lib/designTypeGroups'
import { canRecordNewProgress, snapProgress, taskDisplayProgress } from './lib/taskProgress'
import { formatEntryDateTimeRange, formatWaitingEntryDateTimeRange, sortTimeEntriesDesc } from './lib/taskPresentation'
import { clearStateCache, readStateCache, writeStateCache } from './lib/stateCache'
import {
  DAILY_KNOWLEDGE_QUEUE_SIZE,
  readDailyKnowledgeHistory,
  rememberDailyKnowledgeTitle,
  writeStoredDailyKnowledgeItem,
  writeStoredDailyKnowledgeQueue,
} from './lib/dailyKnowledgeCache'
import { createDailyKnowledgeCatalog } from './lib/dailyKnowledgeCatalog'
import { dailyKnowledgePool } from './data/dailyKnowledgePool'
import {
  clearNewTaskDraftCache,
} from './lib/newTaskDraftCache'
import { ToastIcon } from './components/ToastIcon'
import { isEditableShortcutTarget, monthFromShortcut } from './lib/keyboardShortcuts'
import { inferToastTone, trimToastQueue, type ToastState, type ToastTone } from './lib/toastQueue'
import { createOptionalPreviewFile } from './lib/attachmentPreview'
import { buildTaskContextInsights, normalizeTaskClosure } from './lib/taskContextInsights'
import {
  prepareImageFiles,
  validateUploadFile,
} from './lib/fileUpload'
import type { AppView, AttachmentAnalysis, FileAsset, IncomeDailyGroup, Task, TaskFilter, TaskUpdate, TaskViewMode, TaxMode, WaitingEntry } from './types/domain'
import type { AgentBackgroundTask } from './types/agent'
import type { DailyKnowledgeItem } from './types/knowledge'
import type { AcceptancePayload, ProgressRecordMode, TaskUpdateChanges } from './types/taskUi'
import type { SettingsTab } from './views/SettingsView'
import type { CalendarDisplayMode } from './views/CalendarView'

const SemanticSearchModal = lazy(() => import('./components/SemanticSearchModal'))
const ChatPanel = lazy(() => import('./components/ChatPanel').then((module) => ({ default: module.ChatPanel })))
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


const {
  fallbackDailyKnowledge,
  fallbackDailyKnowledgeBatch,
  mergeDailyKnowledgeQueue,
  prepareDailyKnowledgeSession,
} = createDailyKnowledgeCatalog(dailyKnowledgePool)

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


function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const donutPalette = ['#2f6f6d', '#6f8f72', '#b08a3c', '#66a182', '#b86b5f', '#7c8b46', '#8a7a55', '#a36b7a']

type DonutItem = DonutChartItem

const dashboardTaskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']

function shiftMonthValue(value: string, offset: number) {
  const base = localDateFromIsoDate(`${value || isoDate().slice(0, 7)}-01`)
  base.setMonth(base.getMonth() + offset)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
}

type ProgressModalTarget = {
  taskId: number
  mode: ProgressRecordMode
  editEntryId?: string
  initialAcceptanceMode?: boolean
}

// ─── AI 工作助手 ──────────────────────────────────────────────────────────────


function App() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const activeView = viewFromPath(location.pathname)
  const taskViewMode = taskViewModeFromSearch(location.search)
  const [calendarDisplayMode, setCalendarDisplayMode] = useState<CalendarDisplayMode>('月')
  const [calendarFocusDate, setCalendarFocusDate] = useState(() => isoDate())
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth)
  // 上次成功加载的状态快照，用于静默刷新首屏（存在则直接秒开，不再卡在加载页）
  const [bootCache] = useState(() => readStateCache())
  const bootTasks = useMemo(() => bootCache?.tasks.map(normalizeTaskClosure) ?? [], [bootCache])
  const [role, setRole] = useState<AuthRole>(bootCache?.role ?? 'guest')
  const [accessTokens, setAccessTokens] = useState<AccessToken[]>(bootCache?.accessTokens ?? [])
  const [newTokenId, setNewTokenId] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(Boolean(bootCache))
  const [monthValue, setMonthValue] = useState(() => isoDate().slice(0, 7))
  const [taskItems, setTaskItems] = useState<Task[]>(bootTasks)
  const taskItemsRef = useRef<Task[]>(bootTasks)
  const [updateItems, setUpdateItems] = useState<TaskUpdate[]>(bootCache?.updates ?? [])
  const [fileItems, setFileItems] = useState<FileAsset[]>(bootCache?.files ?? [])
  const [attachmentAnalyses, setAttachmentAnalyses] = useState<AttachmentAnalysis[]>(bootCache?.attachmentAnalyses ?? [])
  const [reports, setReports] = useState<ReportRecord[]>(bootCache?.reports ?? [])
  const [hourlyRate, setHourlyRate] = useState(bootCache?.settings?.hourlyRate ?? defaultHourlyRate)
  const [pdfTitle, setPdfTitle] = useState(bootCache?.settings?.pdfTitle || defaultPdfTitle)
  const [serviceCompanyName, setServiceCompanyName] = useState(bootCache?.settings?.serviceCompanyName || defaultServiceCompanyName)
  const [taxMode, setTaxMode] = useState<TaxMode>(bootCache?.settings?.taxMode ?? 'salary')
  const [designTypeGroups, setDesignTypeGroups] = useState(defaultDesignTypeGroups)
  const [aiModelConfig, setAiModelConfig] = useState<AiModelConfig | null>(null)
  const [aiProviderConfigs, setAiProviderConfigs] = useState<AiProviderConfig[]>([])
  const [settingsEntry, setSettingsEntry] = useState<{ tab: SettingsTab; nonce: number }>({ tab: 'ai', nonce: 0 })
  const [selectedTaskId, setSelectedTaskId] = useState(0)
  const [isTaskDetailCollapsed, setIsTaskDetailCollapsed] = useState(() => window.localStorage.getItem('giverny-task-detail-collapsed') === '1')
  const [detailTaskId, setDetailTaskId] = useState(0)
  const [editTaskId, setEditTaskId] = useState(0)
  const [progressModalTarget, setProgressModalTarget] = useState<ProgressModalTarget | null>(null)
  const [taskActivity, setTaskActivity] = useState<ActivityItem[]>([])
  const [progressAssessments, setProgressAssessments] = useState<Record<number, TaskProgressAssessment>>({})
  const taskActivityRequestRef = useRef(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskSupplemental, setNewTaskSupplemental] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState('')
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false)
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatAnalysisFocusId, setChatAnalysisFocusId] = useState('')
  const [fileLibraryFocusId, setFileLibraryFocusId] = useState(0)
  const [dailyKnowledgeSession] = useState(() => prepareDailyKnowledgeSession())
  const [dailyKnowledge, setDailyKnowledge] = useState<DailyKnowledgeItem>(dailyKnowledgeSession.current)
  const [dailyKnowledgeQueue, setDailyKnowledgeQueue] = useState<DailyKnowledgeItem[]>(dailyKnowledgeSession.queue)
  const [isDailyKnowledgeLoading, setIsDailyKnowledgeLoading] = useState(false)
  const [isDailyKnowledgePrefetching, setIsDailyKnowledgePrefetching] = useState(false)
  const [isDailyKnowledgeOpen, setIsDailyKnowledgeOpen] = useState(false)
  const [incomeVisible, setIncomeVisible] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [isConfirmDialogBusy, setIsConfirmDialogBusy] = useState(false)
  const [voidTaskTarget, setVoidTaskTarget] = useState<Task | null>(null)
  const [isVoidTaskBusy, setIsVoidTaskBusy] = useState(false)
  const [showVoidedTasks, setShowVoidedTasks] = useState(false)
  const [dashboardContextMenu, setDashboardContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [dashboardCreateMenu, setDashboardCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [showFireworks, setShowFireworks] = useState(false)
  const [toastQueue, setToastQueue] = useState<ToastState[]>([])
  const [topAnalysisJobs, setTopAnalysisJobs] = useState<AgentBackgroundTask[]>([])
  const toastTimersRef = useRef<number[]>([])
  const analysisJobStatusesRef = useRef<Map<string, AgentBackgroundTask['status']>>(new Map())
  const analysisJobsInitializedRef = useRef(false)
  const analysisJobsNotifiedRef = useRef<Set<string>>(new Set())
  const updatingTaskIdsRef = useRef<Set<number>>(new Set())
  const pendingTaskChangesRef = useRef<Map<number, Partial<Task>>>(new Map())
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const [backendStatus, setBackendStatus] = useState<'连接中' | '已接入 D1/R2' | '后端异常'>('连接中')
  const [backendSyncSlow, setBackendSyncSlow] = useState(false)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine))
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
  const [taskQuery, setTaskQuery] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('全部')
  // 工作台任务明细：未完成列表兜底分页 + 已验收默认折叠
  const [dashboardPendingShowAll, setDashboardPendingShowAll] = useState(false)
  const [dashboardAcceptedOpen, setDashboardAcceptedOpen] = useState(false)
  const [dashboardAcceptedShowAll, setDashboardAcceptedShowAll] = useState(false)
  // 任务行状态配色主题开关：默认关闭，用户手动打开后才生效（持久化在 localStorage）
  const [rowThemeOn, setRowThemeOn] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('giverny-row-theme') === 'on'
  })
  const toggleRowTheme = () => {
    setRowThemeOn((current) => {
      const next = !current
      try {
        window.localStorage.setItem('giverny-row-theme', next ? 'on' : 'off')
      } catch {
        // 忽略持久化失败
      }
      return next
    })
  }
  const lastAltPressRef = useRef<number>(0)
  const dailyKnowledgeRequestedRef = useRef(false)
  const dailyKnowledgeRef = useRef(dailyKnowledge)
  const dailyKnowledgeQueueRef = useRef(dailyKnowledgeQueue)
  const dailyKnowledgePrefetchRef = useRef(false)
  const isAdmin = role === 'admin' && Boolean(auth)
  // 角色能力分级（前端展示用；后端是真正的安全边界）
  const canSeeFull = Boolean(auth) && (role === 'admin' || role === 'collaborator' || role === 'viewer') // 看管理员级全量视图
  const canWrite = Boolean(auth) && (role === 'admin' || role === 'collaborator') // 可做非敏感写入
  const isClient = role === 'client' && Boolean(auth) // 甲方：当月结算/洞察可见
  const canToggleIncomeVisibility = canSeeFull || isClient
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

  const notify = useCallback((
    message: string,
    tone: ToastTone = inferToastTone(message),
    options: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'> = {},
  ) => {
    const id = Date.now() + Math.random()
    const nextToast: ToastState = { id, message, tone, ...options }
    const duration = options.durationMs ?? (tone === 'error' ? 4200 : 2400)
    setToastQueue((current) => trimToastQueue([...current, nextToast]))
    const timer = window.setTimeout(() => {
      setToastQueue((current) => current.filter((item) => item !== nextToast))
      toastTimersRef.current = toastTimersRef.current.filter((value) => value !== timer)
    }, duration)
    toastTimersRef.current = [...toastTimersRef.current, timer]
  }, [])

  const toggleChat = useCallback(() => {
    if (!isChatOpen) setChatAnalysisFocusId('')
    setIsChatOpen((current) => !current)
  }, [isChatOpen])

  useEffect(() => {
    if (!isAdmin) {
      analysisJobStatusesRef.current.clear()
      analysisJobsNotifiedRef.current.clear()
      analysisJobsInitializedRef.current = false
      return
    }
    let cancelled = false
    const poll = async () => {
      const response = await fetch('/api/ai/analysis-jobs?limit=20')
      const data = await response.json().catch(() => null) as { jobs?: AgentBackgroundTask[] } | null
      if (!response.ok || cancelled || !Array.isArray(data?.jobs)) return
      setTopAnalysisJobs(data.jobs)
      const next = new Map(data.jobs.map((job) => [job.id, job.status]))
      if (!analysisJobsInitializedRef.current) {
        data.jobs.forEach((job) => {
          if (job.unread && (job.status === 'completed' || job.status === 'failed')) {
            analysisJobsNotifiedRef.current.add(job.id)
          }
        })
        analysisJobStatusesRef.current = next
        analysisJobsInitializedRef.current = true
        return
      }
      for (const job of data.jobs) {
          const shouldNotify = job.unread && !analysisJobsNotifiedRef.current.has(job.id)
          const previous = analysisJobStatusesRef.current.get(job.id)
          if (shouldNotify && job.status === 'completed' && previous && previous !== job.status) {
            analysisJobsNotifiedRef.current.add(job.id)
            if (job.source === 'scheduled' && (job.type === 'risk_digest' || job.type === 'monthly_review')) {
              continue
            }
            notify(`${job.title}已完成`, 'success', {
              actionLabel: '查看结果',
              durationMs: 7200,
              onAction: () => {
                setChatAnalysisFocusId(job.id)
                setIsChatOpen(true)
              },
            })
          }
          if (shouldNotify && job.status === 'failed' && previous && previous !== job.status) {
            analysisJobsNotifiedRef.current.add(job.id)
            notify(`${job.title}失败，可在对话中重试`, 'error', {
              actionLabel: '打开爱丽丝',
              durationMs: 7200,
              onAction: () => {
                setChatAnalysisFocusId(job.id)
                setIsChatOpen(true)
              },
            })
          }
      }
      analysisJobStatusesRef.current = next
      analysisJobsInitializedRef.current = true
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAdmin, notify])

  useEffect(() => {
    taskItemsRef.current = taskItems
  }, [taskItems])

  useEffect(() => {
    dailyKnowledgeRef.current = dailyKnowledge
    writeStoredDailyKnowledgeItem(dailyKnowledge)
    rememberDailyKnowledgeTitle(dailyKnowledge.title)
  }, [dailyKnowledge])

  useEffect(() => {
    dailyKnowledgeQueueRef.current = dailyKnowledgeQueue
    writeStoredDailyKnowledgeQueue(dailyKnowledgeQueue)
  }, [dailyKnowledgeQueue])

  const seedDailyKnowledgeQueue = useCallback((baseQueue: DailyKnowledgeItem[] = dailyKnowledgeQueueRef.current) => {
    const history = readDailyKnowledgeHistory()
    const currentTitle = dailyKnowledgeRef.current.title
    const excluded = [currentTitle, ...history]
    const merged = mergeDailyKnowledgeQueue(baseQueue, excluded)
    const missingCount = DAILY_KNOWLEDGE_QUEUE_SIZE - merged.length
    const filled = missingCount > 0
      ? mergeDailyKnowledgeQueue(
        [
          ...merged,
          ...fallbackDailyKnowledgeBatch(missingCount, [...excluded, ...merged.map((item) => item.title)]),
        ],
        excluded,
      )
      : merged
    const nextQueue = filled.slice(0, DAILY_KNOWLEDGE_QUEUE_SIZE)
    dailyKnowledgeQueueRef.current = nextQueue
    setDailyKnowledgeQueue(nextQueue)
    return nextQueue
  }, [])

  const fetchDailyKnowledgeItem = useCallback(async (extraTitles: string[] = []) => {
    const taskThemes = activeMonthTasks.flatMap((task) => [task.type, task.title]).filter(Boolean).slice(0, 12)
    const recentTitles = [
      ...readDailyKnowledgeHistory(),
      dailyKnowledgeRef.current.title,
      ...dailyKnowledgeQueueRef.current.map((item) => item.title),
      ...extraTitles,
    ].filter(Boolean)
    const attemptedTitles = new Set(recentTitles)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const suggestion: DailyKnowledgeSuggestion = await api.suggestDailyKnowledge({
        currentMonth: currentMonth.value,
        taskThemes,
        recentTitles: [...attemptedTitles],
      })
      if (suggestion.title && !attemptedTitles.has(suggestion.title)) {
        return suggestion
      }
      if (suggestion.title) {
        attemptedTitles.add(suggestion.title)
      }
    }
    return null
  }, [activeMonthTasks, currentMonth.value])

  const prefetchDailyKnowledgeQueue = useCallback(async () => {
    if (!isAdmin || dailyKnowledgePrefetchRef.current) {
      return
    }
    dailyKnowledgePrefetchRef.current = true
    setIsDailyKnowledgePrefetching(true)
    try {
      const fetchedItems: DailyKnowledgeItem[] = []
      const fetchTargetCount = Math.min(3, DAILY_KNOWLEDGE_QUEUE_SIZE)
      for (let index = 0; index < fetchTargetCount; index += 1) {
        const nextItem = await fetchDailyKnowledgeItem(fetchedItems.map((item) => item.title))
        if (!nextItem) {
          break
        }
        fetchedItems.push(nextItem)
        const nextQueue = mergeDailyKnowledgeQueue(
          [nextItem, ...dailyKnowledgeQueueRef.current],
          [dailyKnowledgeRef.current.title],
        ).slice(0, DAILY_KNOWLEDGE_QUEUE_SIZE)
        dailyKnowledgeQueueRef.current = nextQueue
        setDailyKnowledgeQueue(nextQueue)
      }
    } catch {
      seedDailyKnowledgeQueue()
    } finally {
      seedDailyKnowledgeQueue()
      dailyKnowledgePrefetchRef.current = false
      setIsDailyKnowledgePrefetching(false)
    }
  }, [fetchDailyKnowledgeItem, isAdmin, seedDailyKnowledgeQueue])

  const showNextDailyKnowledge = async () => {
    const [nextItem, ...remainingQueue] = dailyKnowledgeQueueRef.current
    if (nextItem) {
      dailyKnowledgeRef.current = nextItem
      setDailyKnowledge(nextItem)
      rememberDailyKnowledgeTitle(nextItem.title)
      seedDailyKnowledgeQueue(remainingQueue)
      void prefetchDailyKnowledgeQueue()
      return
    }

    if (isDailyKnowledgeLoading) {
      return
    }
    setIsDailyKnowledgeLoading(true)
    try {
      const excludedTitles = [
        dailyKnowledgeRef.current.title,
        ...readDailyKnowledgeHistory(),
        ...dailyKnowledgeQueueRef.current.map((item) => item.title),
      ]
      const fetchedItem = await fetchDailyKnowledgeItem()
      const nextFallback = fetchedItem ?? fallbackDailyKnowledge(excludedTitles)
      dailyKnowledgeRef.current = nextFallback
      setDailyKnowledge(nextFallback)
      rememberDailyKnowledgeTitle(nextFallback.title)
    } catch {
      const fallback = fallbackDailyKnowledge([
        dailyKnowledgeRef.current.title,
        ...readDailyKnowledgeHistory(),
        ...dailyKnowledgeQueueRef.current.map((item) => item.title),
      ])
      dailyKnowledgeRef.current = fallback
      setDailyKnowledge(fallback)
      rememberDailyKnowledgeTitle(fallback.title)
    } finally {
      setIsDailyKnowledgeLoading(false)
      seedDailyKnowledgeQueue()
      void prefetchDailyKnowledgeQueue()
    }
  }

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
  }, [isAccountMenuOpen])

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    const canonicalPath = taskViewRoute(activeView, taskViewMode)
    if (`${location.pathname}${location.search}` !== canonicalPath) {
      routerNavigate(canonicalPath, { replace: true, state: { view: activeView, taskViewMode } })
    }
  }, [activeView, location.pathname, location.search, routerNavigate, taskViewMode])


  const refreshState = async () => {
    const state = await api.getState()
    const normalizedTasks = state.tasks.map(normalizeTaskClosure)
    const normalizedState = { ...state, tasks: normalizedTasks }
    writeStateCache(normalizedState)
    setTaskItems(normalizedTasks)
    setUpdateItems(state.updates)
    setFileItems(state.files)
    setAttachmentAnalyses(state.attachmentAnalyses ?? [])
    setReports(state.reports ?? [])
    setRole(state.role)
    // 登录态失效检测：本地存的是管理员凭证，但后端返回的角色被降级 → 主动提示重新登录，
    // 避免「看着像登录、其实是只读」的静默降级（金额隐藏、附件预览 401 等）。
    const storedForCheck = getStoredAuth()
    if (storedForCheck?.role === 'admin' && state.role !== 'admin') {
      clearStoredAuth()
      setAuth(null)
      setAuthError('管理员登录已失效（密码可能已修改），请重新登录')
    }
    setAccessTokens(state.accessTokens ?? [])
    setHourlyRate(state.settings.hourlyRate)
    setPdfTitle(state.settings.pdfTitle || defaultPdfTitle)
    setServiceCompanyName(state.settings.serviceCompanyName || defaultServiceCompanyName)
    setTaxMode(state.settings.taxMode ?? 'salary')
    setDesignTypeGroups(normalizeDesignTypeGroups(state.settings.designTypeGroups ?? [{ name: '常用类型', items: state.settings.designTypes ?? defaultDesignTypes }]))
    setAiModelConfig(state.settings.aiModel ?? null)
    setSelectedTaskId((currentId) => {
      const activeTasks = normalizedTasks.filter((task) => !task.voidedAt)
      return activeTasks.some((task) => task.id === currentId) ? currentId : activeTasks[0]?.id ?? normalizedTasks[0]?.id ?? 0
    })
    setBackendStatus('已接入 D1/R2')
    setBackendSyncSlow(false)
    setIsLoaded(true)
  }

  const retryRefreshState = async () => {
    setBackendStatus('连接中')
    setBackendSyncSlow(false)
    try {
      await refreshState()
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `重新同步失败：${error.message}` : '重新同步失败，请稍后再试')
    }
  }

  useEffect(() => {
    // Initial and credential-change state hydration is the intended effect here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState().catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredAuth()
        setAuth(null)
        setRole('guest')
        setAuthError('登录已失效（口令可能被停用或已过期），已切换为游客只读')
        void refreshState().catch((publicError) => {
          setBackendStatus('后端异常')
          setIsLoaded(true)
          notify(publicError instanceof Error ? `后端连接失败：${publicError.message}` : '后端连接失败')
        })
        return
      }
      setBackendStatus('后端异常')
      setIsLoaded(true)
      notify(error instanceof Error ? `后端连接失败：${error.message}` : '后端连接失败')
    })
  }, [auth, notify])

  useEffect(() => {
    if (backendStatus !== '连接中') {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setBackendSyncSlow(true)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [backendStatus])

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return undefined
    }
    const updateOnlineState = () => setIsOffline(!navigator.onLine)
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    updateOnlineState()
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin || backendStatus !== '已接入 D1/R2') {
      return undefined
    }
    let cancelled = false
    const loadStorageUsage = async () => {
      try {
        const usage = await api.getStorageUsage()
        if (!cancelled) {
          setStorageUsage(usage)
        }
      } catch {
        if (!cancelled) {
          setStorageUsage(null)
        }
      }
    }
    void loadStorageUsage()
    const timer = window.setInterval(() => void loadStorageUsage(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [backendStatus, isAdmin])

  useEffect(() => {
    if (!isAdmin) {
      return undefined
    }
    let cancelled = false
    api.getAiProviderConfigs()
      .then((result) => {
        if (!cancelled) setAiProviderConfigs(result.providers)
      })
      .catch(() => {
        if (!cancelled) setAiProviderConfigs([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, aiModelConfig?.updatedAt])

  const analysisPollingRef = useRef({ signature: '', attempts: 0, inFlight: false })
  useEffect(() => {
    const activeAnalyses = attachmentAnalyses.filter((analysis) => analysis.status === 'pending' || analysis.status === 'processing')
    if (!isLoaded || activeAnalyses.length === 0) {
      analysisPollingRef.current = { signature: '', attempts: 0, inFlight: false }
      return undefined
    }
    const signature = activeAnalyses
      .map((analysis) => `${analysis.attachmentId}:${analysis.requestedAt}`)
      .sort()
      .join('|')
    if (analysisPollingRef.current.signature !== signature) {
      analysisPollingRef.current = { signature, attempts: 0, inFlight: false }
    }
    if (analysisPollingRef.current.attempts >= 60) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      if (analysisPollingRef.current.inFlight) {
        return
      }
      analysisPollingRef.current.inFlight = true
      analysisPollingRef.current.attempts += 1
      void api.getAttachmentAnalysisStatuses(activeAnalyses.map((analysis) => analysis.attachmentId))
        .then((updatedAnalyses) => {
          const updatedById = new Map(updatedAnalyses.map((analysis) => [analysis.attachmentId, analysis]))
          setAttachmentAnalyses((current) => current.map((analysis) => updatedById.get(analysis.attachmentId) ?? analysis))
        })
        .catch(() => undefined)
        .finally(() => {
          analysisPollingRef.current.inFlight = false
        })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [attachmentAnalyses, isLoaded])

  useEffect(() => {
    if (!isLoaded || role !== 'admin' || dailyKnowledgeRequestedRef.current) {
      return
    }
    dailyKnowledgeRequestedRef.current = true
    seedDailyKnowledgeQueue()
    void prefetchDailyKnowledgeQueue()
    // Keep a ready-to-read pool so manual refresh can swap instantly while AI refills in the background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, role])

  // 缩略图自愈：对缺少预览图、但可客户端生成首帧/首页的文件（PDF、视频、PSD/AI），
  // 后台渲染并回传持久化，之后所有视图（时间轴 / 文件库 / 分享回单）都会显示真实缩略图。
  const previewBackfillAttemptsRef = useRef<Map<number, number>>(new Map())
  const [previewBackfillTick, setPreviewBackfillTick] = useState(0)
  useEffect(() => {
    if (role !== 'admin') {
      return
    }
    const canBackfill = (file: FileAsset) => ['pdf', 'ai', 'psd', 'office', 'video'].includes(fileTypeForAsset(file).kind)
    const targets = fileItems.filter(
      (file) =>
        !file.deletedAt &&
        (!file.previewUrl || file.previewFallback) &&
        file.sourceUrl &&
        canBackfill(file) &&
        (previewBackfillAttemptsRef.current.get(file.id) ?? 0) < 3,
    )
    if (targets.length === 0) {
      return
    }
    let cancelled = false
    void (async () => {
      for (const file of targets.slice(0, 6)) {
        if (cancelled) {
          break
        }
        const attempt = (previewBackfillAttemptsRef.current.get(file.id) ?? 0) + 1
        previewBackfillAttemptsRef.current.set(file.id, attempt)
        let repaired = false
        try {
          const sourceUrl = authedPreviewUrl(file.sourceUrl)
          if (!sourceUrl) {
            continue
          }
          const response = await fetch(sourceUrl)
          if (!response.ok) {
            continue
          }
          const blob = await response.blob()
          const sourceFile = new File([blob], file.name, { type: blob.type || file.mimeType || '' })
          const preview = await createOptionalPreviewFile(sourceFile)
          if (!preview) {
            continue
          }
          const result = await api.setFilePreview(file.id, preview)
          if (!cancelled && result?.previewUrl) {
            repaired = true
            setFileItems((current) => current.map((item) => (item.id === file.id ? { ...item, previewUrl: result.previewUrl, previewFallback: Boolean(result.previewFallback) } : item)))
          }
        } catch (error) {
          console.warn('缩略图补全失败', file.name, error)
        } finally {
          if (!cancelled && !repaired && attempt < 3) {
            window.setTimeout(() => setPreviewBackfillTick((current) => current + 1), attempt * 1600)
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fileItems, previewBackfillTick, role])

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
  const selectedTaskSourceSignature = selectedTaskSource.map((task) => task.id).join(',')

  useEffect(() => {
    // Filters, pagination and collapsed groups should keep the detail pane aligned with a rendered row.
    const visibleIds = selectedTaskSourceSignature ? selectedTaskSourceSignature.split(',').map(Number) : []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTaskId((currentId) => visibleIds.includes(currentId) ? currentId : visibleIds[0] ?? 0)
  }, [selectedTaskSourceSignature])

  const toggleTaskDetail = () => {
    setIsTaskDetailCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('giverny-task-detail-collapsed', next ? '1' : '0')
      return next
    })
  }

  const renderDashboardTaskRow = (task: Task) => {
    const dueState = taskDueState(task, today, dueSoonDate)
    const canAcceptTask = task.status === '待验收'
    const canRecordProgress = canRecordNewProgress(task)
    const contextInsight = taskContextInsights.get(task.id)
    return (
      <article
        className={`task-row ${selectedTask?.id === task.id ? 'selected' : ''} ${isSupplementalTask(task) ? 'supplemental' : ''}`}
        data-status={task.status}
        data-due={dueState || undefined}
        key={task.id}
        role="button"
        aria-pressed={selectedTask?.id === task.id}
        tabIndex={0}
        onClick={() => setSelectedTaskId(task.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setSelectedTaskId(task.id)
          }
        }}
        onContextMenu={(event) => openDashboardContextMenu(event, task)}
      >
        <div className="task-date">
          <b>{formatTaskActivityDateRange(task)}</b>
          <span className="task-date-meta">
            <span>{[formatTaskActivityTime(task), task.type].filter(Boolean).join(' · ')}</span>
            {isSupplementalTask(task) && (
              <em className="task-inline-supplement" title={`补录至 ${monthLabelOf(taskSettlementMonth(task))}`}>
                补录
              </em>
            )}
          </span>
        </div>
        <div className="task-main">
          <strong>{task.title}</strong>
          <p>{task.requirement}</p>
          <TaskContextInsightBadge insight={contextInsight} />
        </div>
        <div className="task-meta">
          <b>{task.requester || task.contact || '待确认'}</b>
          <span>
            实际 <strong>{taskHoursInMonth(task, currentMonth.value).toFixed(1)}h</strong>
          </span>
        </div>
        <div className="task-row-end">
          <div className="task-state">
            <div className="task-state-badges">
              {dueState && <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span>}
              <StatusBadge status={task.status} />
            </div>
            {task.status !== '已验收' && (
              <div className="progress-cell">
                <div className="mini-meter">
                  <span style={{ width: `${taskDisplayProgress(task)}%` }} />
                </div>
                <small>{taskDisplayProgress(task)}%</small>
              </div>
            )}
          </div>
          {canWrite && <div className="task-row-actions" aria-label="任务快捷操作">
            <button type="button" className="icon-button" title="编辑任务" aria-label="编辑任务" onClick={(event) => { event.stopPropagation(); handleOpenTaskEdit(task.id) }}>
              <Pencil size={15} />
            </button>
            <button type="button" className="icon-button" title={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} aria-label={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} disabled={!canRecordProgress} onClick={(event) => { event.stopPropagation(); handleOpenTaskProgress(task.id) }}>
              <BarChart3 size={15} />
            </button>
            {isAdmin && <button
              type="button"
              className="icon-button"
              title={canAcceptTask ? '去验收' : '当前不是待验收'}
              aria-label={canAcceptTask ? '去验收' : '当前不是待验收'}
              disabled={!canAcceptTask}
              onClick={(event) => { event.stopPropagation(); handleOpenTaskAcceptance(task.id) }}
            >
              <ClipboardCheck size={15} />
            </button>}
          </div>}
        </div>
      </article>
    )
  }

  const voidedMonthTaskCount = useMemo(() => monthTasks.filter((task) => task.voidedAt).length, [monthTasks])

  const activeTaskItems = useMemo(() => taskItems.filter((task) => !task.voidedAt), [taskItems])
  const taskContextInsights = buildTaskContextInsights(activeTaskItems, updateItems)

  const stats = useMemo(() => {
    const totalHours = activeMonthTasks.reduce((sum, task) => sum + taskHoursInMonth(task, currentMonth.value), importedHours)
    const billableHours = activeMonthTasks
      .filter(isTaskBillable)
      .reduce((sum, task) => sum + taskBillableHoursInMonth(task, currentMonth.value), importedHours)
    const accepted = activeMonthTasks.filter((task) => task.status === '已验收').length
    const pending = activeMonthTasks.filter((task) => task.status === '待验收').length

    return {
      totalHours,
      billableHours,
      amount: sumBillableAmountForMonth(activeMonthTasks, currentMonth.value, hourlyRate, importedHours),
      accepted,
      pending,
    }
  }, [activeMonthTasks, currentMonth.value, hourlyRate, importedHours])

  const donutData = useMemo(() => {
    // 本月洞察只统计实际投入；预计工时只作为排期参考，不参与分析。
    const hoursByType = new Map<string, number>()
    activeMonthTasks.forEach((task) => {
      const hours = taskHoursInMonth(task, currentMonth.value)
      if (hours > 0) {
        hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + hours).toFixed(1)))
      }
    })
    const items: DonutItem[] = [...hoursByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))

    return { items, total: Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }
  }, [activeMonthTasks, currentMonth.value])

  const today = isoDate()
  const dueSoonDate = isoDate(3)
  const dueTasks = (() => {
    const actionableTasks = activeMonthTasks.filter((task) => !['已验收', '终止', '不计费'].includes(task.status))
    const byEstimateAsc = (a: Task, b: Task) => datePart(a.estimatedDate || a.date).localeCompare(datePart(b.estimatedDate || b.date))
    const byNearestPlan = (a: Task, b: Task) => {
      const aDate = datePart(a.estimatedDate || a.date)
      const bDate = datePart(b.estimatedDate || b.date)
      const aFutureRank = aDate >= today ? 0 : 1
      const bFutureRank = bDate >= today ? 0 : 1
      if (aFutureRank !== bFutureRank) return aFutureRank - bFutureRank
      return aFutureRank === 0 ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
    }
    const overdue = actionableTasks.filter((task) => taskDueState(task, today, dueSoonDate) === 'overdue').sort(byEstimateAsc)
    const soon = actionableTasks.filter((task) => taskDueState(task, today, dueSoonDate) === 'soon').sort(byEstimateAsc)
    const primary = overdue[0] ?? [...actionableTasks].sort(byNearestPlan)[0] ?? null
    const soonHighlights = soon.filter((task) => task.id !== primary?.id).slice(0, 2)
    const reminderTasks = [primary, ...soonHighlights].filter((task): task is Task => Boolean(task))
    return { overdue, soon, primary, soonHighlights, reminderTasks }
  })()

  const topReminderItems = (() => {
    const items: Array<{ key: string; title: string; body: string; jobId?: string }> = []
    if (dueTasks.reminderTasks.length > 0) {
      const bodyParts = dueTasks.reminderTasks.map((task) => task.title)
      if (dueTasks.soonHighlights.length > 0) {
        bodyParts.push(`${dueTasks.soonHighlights.length} 个任务 3 天内交付`)
      }
      items.push({
        key: 'due-current',
        title: dueTasks.overdue.length > 0 ? `${dueTasks.overdue.length} 个任务已逾期` : '最近任务',
        body: bodyParts.join(' · '),
      })
    }

    const todayDate = localDateFromIsoDate(today)
    const currentViewingMonth = today.slice(0, 7)
    const [year, month] = currentMonth.value.split('-').map(Number)
    const lastDay = `${currentMonth.value}-${pad(new Date(year, month, 0).getDate())}`
    const previousDate = localDateFromIsoDate(today)
    previousDate.setDate(1)
    previousDate.setMonth(previousDate.getMonth() - 1)
    const previousMonthValue = `${previousDate.getFullYear()}-${pad(previousDate.getMonth() + 1)}`
    if (today === lastDay && currentMonth.value === currentViewingMonth) {
      items.push({
        key: 'review-current',
        title: '本月工作复盘',
        body: `${currentMonth.label}快结束了，可以整理本月任务、收入和交付问题。`,
      })
    }
    if (todayDate.getDate() === 1 && currentMonth.value === previousMonthValue) {
      items.push({
        key: 'review-previous',
        title: `上个月（${monthLabelOf(previousMonthValue)}）工作复盘`,
        body: '可以回看上个月任务、收入和交付问题。',
      })
    }
    const visibleAnalysisJobs = isAdmin ? topAnalysisJobs : []
    const completedScheduledJobs = visibleAnalysisJobs.filter((job) => {
      if (!job.unread || job.status !== 'completed' || job.source !== 'scheduled') return false
      const finishedAt = datePart(job.completedAt || job.updatedAt || job.createdAt)
      return finishedAt === today
    })
    const todayRiskJobs = completedScheduledJobs
      .filter((job) => job.type === 'risk_digest')
      .slice(0, 1)
    todayRiskJobs.forEach((job) => {
      items.push({
        key: `risk-job-${job.id}`,
        title: '今日任务风险提示已完成',
        body: job.title.replace(/^\d{4}-\d{2}-\d{2}\s*/, '') || '查看今日需要关注的任务风险。',
        jobId: job.id,
      })
    })
    const monthlyReviewJobs = completedScheduledJobs
      .filter((job) => job.type === 'monthly_review' && (
        today === lastDay ||
        todayDate.getDate() === 1
      ))
      .slice(0, 1)
    monthlyReviewJobs.forEach((job) => {
      items.push({
        key: `review-job-${job.id}`,
        title: '工作复盘已完成',
        body: job.title || '可以查看本次复盘结果。',
        jobId: job.id,
      })
    })
    return items
  })()
  const [topReminderIndex, setTopReminderIndex] = useState(0)
  useEffect(() => {
    if (topReminderItems.length <= 1) return
    const timer = window.setInterval(() => {
      setTopReminderIndex((current) => (current + 1) % topReminderItems.length)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [topReminderItems.length])
  const activeTopReminderItem = topReminderItems.length > 0
    ? topReminderItems[topReminderIndex % topReminderItems.length]
    : undefined
  const handleTopReminderClick = (item?: { key: string; jobId?: string }) => {
    if (item?.jobId) {
      setTopAnalysisJobs((current) => current.map((job) => job.id === item.jobId ? { ...job, unread: false } : job))
      void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(item.jobId)}/read`, { method: 'POST' }).catch(() => undefined)
      return
    }
    navigateView('任务')
  }

  const annualData = useMemo(() => {
    const year = currentMonth.value.slice(0, 4)
    const lockedByMonth = new Map(reports.filter((report) => report.month.startsWith(year)).map((report) => [report.month, report]))
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`)
    const rows = months.map((month) => {
      const tasks = activeTaskItems.filter((task) => taskHasMonthActivity(task, month) && isTaskBillable(task))
      const imported = month === importedHoursMonth ? importedMonthlyHours : 0
      const hours = Number(tasks.reduce((sum, task) => sum + taskBillableHoursInMonth(task, month), imported).toFixed(1))
      const locked = lockedByMonth.get(month)
      const amount = locked ? locked.totalAmount : sumBillableAmountForMonth(tasks, month, hourlyRate, imported)
      return { month, hours, amount, locked: Boolean(locked) }
    })
    return {
      year,
      rows,
      totalHours: Number(rows.reduce((sum, row) => sum + row.hours, 0).toFixed(1)),
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    }
  }, [activeTaskItems, currentMonth.value, hourlyRate, reports])

  const incomeToday = datePart(isoDate())
  const incomeDailyGroups = useMemo<IncomeDailyGroup[]>(() => {
    const dayMap = new Map<string, Map<number, { title: string; hours: number; isSupplemental: boolean }>>()
    activeMonthTasks.forEach((task) => {
      const isSupplemental = isSupplementalTask(task)
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0) return
        const entryDay = datePart(entry.date || task.date || '')
        const day = isSupplemental && !entryDay.startsWith(currentMonth.value)
          ? `${currentMonth.value}-01`
          : entryDay
        if (!day.startsWith(currentMonth.value)) return
        if (!dayMap.has(day)) dayMap.set(day, new Map())
        const taskMap = dayMap.get(day)!
        const existing = taskMap.get(task.id) ?? { title: task.title || '未命名', hours: 0, isSupplemental }
        existing.hours = Number((existing.hours + minutes / 60).toFixed(2))
        taskMap.set(task.id, existing)
      })
    })
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, taskMap]) => {
        const entries = Array.from(taskMap.entries()).map(([id, data]) => ({
          id,
          title: data.title,
          hours: data.hours,
          income: Math.round(data.hours * hourlyRate),
          isSupplemental: data.isSupplemental,
        }))
        const totalHours = Number(entries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(1))
        return { day, totalHours, totalIncome: Math.round(totalHours * hourlyRate), entries }
      })
  }, [activeMonthTasks, currentMonth.value, hourlyRate])

  const dailyTrendData = useMemo(() => {
    const [year, month] = currentMonth.value.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    // 本月每一天一个桶，形成平滑日曲线
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ label: `${month}/${index + 1}`, value: 0 }))
    // 工时来自分段计时（timeEntries），进展记录本身不带工时
    activeMonthTasks.forEach((task) => {
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0) {
          return
        }
        if (timeEntryMonth(entry, task) !== currentMonth.value) {
          return
        }
        const entryDate = entry.date || ''
        const day = Number(datePart(entryDate).slice(8, 10)) || 1
        const index = Math.min(Math.max(day - 1, 0), daysInMonth - 1)
        days[index].value += minutes / 60
      })
    })
    return days.map((day) => ({ ...day, value: Number(day.value.toFixed(1)) }))
  }, [currentMonth.value, activeMonthTasks])

  const handleCreateTask = async (task: Task) => {
    try {
      const savedTask = await api.createTask(task)
      await refreshState()
      setSelectedTaskId(savedTask.id)
      if (taskSettlementMonth(savedTask).length >= 7) {
        setMonthValue(taskSettlementMonth(savedTask))
      }
      clearNewTaskDraftCache()
      setIsModalOpen(false)
      setBackendStatus('已接入 D1/R2')
      notify('任务已写入 D1，最新进展已同步')
      return savedTask
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务保存失败：${error.message}` : '任务保存失败')
      return undefined
    }
  }

  const handleRetryAttachmentAnalysis = async (attachmentId: number) => {
    await api.retryAttachmentAnalysis(attachmentId)
    notify('已重新创建附件分析任务')
    await refreshState()
  }

  const handleCreateTaskUpdate = async (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => {
    try {
      const savedUpdate = await api.createUpdate({
        id: 0,
        taskId,
        date: isoDateTime(),
        title: update.title,
        body: update.body,
        hours: update.hours,
        visible: update.visible,
        files: [],
      })
      setUpdateItems((currentUpdates) => [savedUpdate, ...currentUpdates])
      await refreshState()
      await loadTaskActivity(taskId)
      notify('进展记录已保存')
    } catch (error) {
      notify(error instanceof Error ? `进展保存失败：${error.message}` : '进展保存失败')
    }
  }

  const loadTaskActivity = async (taskId: number) => {
    const requestId = taskActivityRequestRef.current + 1
    taskActivityRequestRef.current = requestId
    try {
      const result = await api.getTaskActivity(taskId)
      if (taskActivityRequestRef.current === requestId) {
        setTaskActivity(result.items)
      }
    } catch {
      if (taskActivityRequestRef.current === requestId) {
        setTaskActivity([])
      }
    }
  }

  const handleOpenTaskDetail = (taskId: number) => {
    setSelectedTaskId(taskId)
    setDetailTaskId(taskId)
    void loadTaskActivity(taskId)
  }

  const handleOpenTaskEdit = (taskId: number) => {
    setSelectedTaskId(taskId)
    setEditTaskId(taskId)
  }

  const handleOpenTaskProgress = (taskId: number, mode: ProgressRecordMode = 'progress', editEntryId?: string, initialAcceptanceMode = false) => {
    const task = taskItemsRef.current.find((item) => item.id === taskId)
    if (task && mode === 'progress' && !editEntryId && !initialAcceptanceMode && !canRecordNewProgress(task)) {
      notify('任务已进入验收闭环。如需继续记录，请先编辑或删除右侧的验收进展。', 'error')
      return
    }
    setSelectedTaskId(taskId)
    setProgressModalTarget({ taskId, mode, editEntryId, initialAcceptanceMode })
    void loadTaskActivity(taskId)
  }

  const handleDeleteTaskTimeEntry = (taskId: number, mode: ProgressRecordMode, entryId: string) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task) {
      return
    }
    if (mode === 'progress' && task.status === '已验收') {
      notify('已验收任务的结算工时已锁定，不能直接删除分段记录', 'error')
      return
    }
    const entries = mode === 'waiting' ? task.waitingEntries ?? [] : task.timeEntries ?? []
    const entry = entries.find((item) => item.id === entryId)
    if (!entry) {
      notify('这条记录已不存在，请刷新后重试', 'error')
      return
    }
    const isWaiting = mode === 'waiting'
    const restoreDeletedEntry = async () => {
      const latestTask = taskItemsRef.current.find((item) => item.id === taskId)
      if (!latestTask) {
        notify('撤回失败：任务不存在', 'error')
        return
      }
      if (isWaiting) {
        const latestEntries = latestTask.waitingEntries ?? []
        if (latestEntries.some((item) => item.id === entry.id)) {
          notify('这段等待记录已恢复')
          return
        }
        const restored = await handleUpdateTask(taskId, { waitingEntries: sortTimeEntriesDesc([...latestEntries, entry as WaitingEntry]) })
        if (!restored) {
          notify('撤回失败：等待记录未能恢复', 'error')
          return
        }
        await api.setEntryAttachmentsArchived(taskId, entry.id, false)
        await refreshState()
        notify('已撤回等待记录')
        return
      }
      const latestEntries = latestTask.timeEntries ?? []
      if (latestEntries.some((item) => item.id === entry.id)) {
        notify('这段分段计时已恢复')
        return
      }
      const nextEntries = sortTimeEntriesDesc([...latestEntries, entry])
      const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
      const restored = await handleUpdateTask(taskId, { timeEntries: nextEntries, actualHours: nextActualHours })
      if (!restored) {
        notify('撤回失败：分段计时未能恢复', 'error')
        return
      }
      await api.setEntryAttachmentsArchived(taskId, entry.id, false)
      await refreshState()
      notify('已撤回分段计时')
    }
    const entryRangeLabel = isWaiting ? formatWaitingEntryDateTimeRange(task, entry as WaitingEntry) : formatEntryDateTimeRange(task, entry)
    setConfirmDialog({
      title: `确定删除 ${entryRangeLabel} 这段记录吗？`,
      body: isWaiting
        ? '删除后，这段等待时长将不再进入洞察分析。'
        : '删除后，这段工时会从实际工时和结算金额中扣除。',
      confirmText: '确认删除',
      tone: 'danger',
      hideIcon: true,
      details: [entry.note || (isWaiting ? '未填写等待说明' : '未填写进展内容'), isWaiting ? '不计结算，下一段工作进展开始时自动截止' : `计时 ${formatDuration(minutesForTimeEntry(entry))}`],
      onConfirm: async () => {
        // 附件归档与 task update 并行，减少串行等待
        const archivePromise = api.setEntryAttachmentsArchived(taskId, entry.id, true)
        if (isWaiting) {
          const deleted = await handleUpdateTask(taskId, { waitingEntries: entries.filter((item) => item.id !== entryId) })
          if (!deleted) {
            archivePromise.then(() => api.setEntryAttachmentsArchived(taskId, entry.id, false)).catch(() => {})
            notify('等待记录删除失败，关联附件已保留', 'error')
            return
          }
          void refreshState()
          notify('等待记录已删除', 'success', {
            actionLabel: '撤回',
            durationMs: 7200,
            onAction: restoreDeletedEntry,
          })
          return
        }
        const nextEntries = entries.filter((item) => item.id !== entryId)
        const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
        const deleted = await handleUpdateTask(taskId, { timeEntries: nextEntries, actualHours: nextActualHours })
        if (!deleted) {
          archivePromise.then(() => api.setEntryAttachmentsArchived(taskId, entry.id, false)).catch(() => {})
          notify('分段计时删除失败，关联附件已保留', 'error')
          return
        }
        void refreshState()
        notify('分段计时已删除，实际工时已重新计算', 'success', {
          actionLabel: '撤回',
          durationMs: 7200,
          onAction: restoreDeletedEntry,
        })
      },
    })
  }

  const handleTaskCalendarMonthChange = (value: string) => {
    setMonthValue(value)
    setCalendarFocusDate((current) => (current.startsWith(value) ? current : `${value}-01`))
  }

  const shiftTaskCalendarPeriod = (direction: -1 | 1) => {
    if (calendarDisplayMode === '月') {
      const nextMonth = shiftMonthValue(currentMonth.value, direction)
      setMonthValue(nextMonth)
      setCalendarFocusDate(`${nextMonth}-01`)
      return
    }
    const nextDate = addIsoDays(effectiveCalendarFocusDate, direction * (calendarDisplayMode === '周' ? 7 : 1))
    setCalendarFocusDate(nextDate)
    if (monthPart(nextDate) !== currentMonth.value) {
      setMonthValue(monthPart(nextDate))
    }
  }

  const handleDeleteAcceptanceProgress = (taskId: number, entryId?: string) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task) {
      return
    }
    const entry = entryId ? (task.timeEntries ?? []).find((item) => item.id === entryId) : undefined
    if (entryId && !entry) {
      notify('这条验收进展已不存在，请刷新后重试', 'error')
      return
    }
    const nextEntries = entryId ? (task.timeEntries ?? []).filter((item) => item.id !== entryId) : task.timeEntries ?? []
    const nextActualHours = Math.round((sumTimeEntries(nextEntries) / 60) * 100) / 100
    const restoreAcceptanceProgress = async () => {
      if (!entry) {
        notify('这条验收进展没有可撤回的分段工时')
        return
      }
      const latestTask = taskItemsRef.current.find((item) => item.id === taskId)
      if (!latestTask) {
        notify('撤回失败：任务不存在', 'error')
        return
      }
      const latestEntries = latestTask.timeEntries ?? []
      if (latestEntries.some((item) => item.id === entry.id)) {
        notify('这条验收进展已恢复')
        return
      }
      const restoredEntries = sortTimeEntriesDesc([...latestEntries, entry])
      const restoredHours = Math.round((sumTimeEntries(restoredEntries) / 60) * 100) / 100
      const restored = await handleUpdateTask(taskId, {
        status: '已验收',
        stage: '已验收',
        progress: 100,
        timeEntries: restoredEntries,
        actualHours: restoredHours,
        acceptanceNote: task.acceptanceNote ?? entry.note ?? '',
        acceptanceFiles: task.acceptanceFiles ?? [],
        actualDeliveryDate: task.actualDeliveryDate || isoDateTime(),
        allowAcceptedTimeEdit: true,
      })
      if (!restored) {
        notify('撤回失败：验收进展未能恢复', 'error')
        return
      }
      await api.setEntryAttachmentsArchived(taskId, entry.id, false)
      await refreshState()
      notify('已撤回验收进展删除')
    }
    setConfirmDialog({
      title: entry ? `确定删除 ${formatEntryDateTimeRange(task, entry)} 这条验收进展吗？` : '确定删除这条验收进展吗？',
      body: entry
        ? '删除后，这段验收工时会从实际工时和结算金额中扣除，任务将回到待验收状态。'
        : '删除后，任务将回到待验收状态，验收备注与验收附件记录会从本次验收进展中移除。',
      confirmText: '确认删除',
      tone: 'danger',
      hideIcon: true,
      details: [
        entry?.note || task.acceptanceNote || '未填写验收备注',
        entry ? `计时 ${formatDuration(minutesForTimeEntry(entry))}` : '不新增计时',
      ],
      onConfirm: async () => {
        if (entry) {
          await api.setEntryAttachmentsArchived(taskId, entry.id, true)
        }
        const deleted = await handleUpdateTask(taskId, {
          status: '待验收',
          stage: '待验收',
          progress: Math.min(taskDisplayProgress(task), 80),
          actualDeliveryDate: '',
          acceptanceNote: '',
          acceptanceFiles: [],
          ...(entryId ? { timeEntries: nextEntries, actualHours: nextActualHours } : {}),
          allowAcceptedTimeEdit: Boolean(entryId),
          allowAcceptanceRollback: true,
        })
        if (!deleted) {
          if (entry) {
            await api.setEntryAttachmentsArchived(taskId, entry.id, false)
          }
          notify('验收进展删除失败，关联附件已保留', 'error')
          return
        }
        await refreshState()
        notify(entry ? '验收进展已删除，实际工时已重新计算' : '验收进展已删除，任务已回到待验收', 'success', entry ? {
          actionLabel: '撤回',
          durationMs: 7200,
          onAction: restoreAcceptanceProgress,
        } : undefined)
      },
    })
  }

  const handleOpenTaskAcceptance = (taskId: number) => {
    if (!isAdmin) {
      requireAdmin()
      return
    }
    setSelectedTaskId(taskId)
    setProgressModalTarget({ taskId, mode: 'progress', initialAcceptanceMode: true })
    void loadTaskActivity(taskId)
  }

  const handleSaveTaskEdit = (taskId: number, changes: Partial<Task>) => {
    if (canWrite) {
      void handleUpdateTask(taskId, changes)
    } else {
      requireAdmin()
    }
    setEditTaskId(0)
  }

  const handleConfirmTaskAcceptance = async (
    task: Task,
    payload: AcceptancePayload,
  ) => {
    if (isAdmin) {
      const saved = await handleUpdateTask(task.id, {
        ...payload.taskChanges,
        status: '已验收',
        reviewer: payload.taskChanges?.reviewer || task.reviewer || payload.taskChanges?.requester || task.requester || '待确认',
        actualHours: payload.actualHours,
        acceptanceNote: payload.acceptanceNote,
        feedbackRating: payload.feedbackRating,
        feedbackTags: payload.feedbackTags,
        feedbackNote: payload.feedbackNote,
        timeEntries: payload.timeEntries,
        waitingEntries: payload.waitingEntries,
        acceptanceFiles: payload.acceptanceFiles,
        progress: 100,
        ...(task.status === '已验收' ? { allowAcceptedTimeEdit: true } : {}),
        // 非补录任务：结算月份自动跟随验收时间（当前年月）
        settlementMonth: isSupplementalTask(task) ? taskSettlementMonth(task) : monthPart(isoDate()),
      })
      if (!saved) {
        throw new Error('任务状态未能写入，请稍后重试')
      }
    } else {
      requireAdmin()
      throw new Error('需要管理员权限')
    }
  }

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
  }, [dashboardContextMenu, dashboardCreateMenu])

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
    if (selectedTask) {
      void loadTaskActivity(selectedTask.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id])

  const handleQuickUploadImage = async (
    taskId: number,
    file: File,
    onProgress?: (ratio: number) => void,
    entryId?: string,
  ) => {
    try {
      validateUploadFile(file)
      const prepared = await prepareImageFiles(file)
      const uploadFile = prepared.uploadFile
      const uploadExtension = fileTypeForFile(uploadFile).type
      const preview = prepared.previewFile ?? await createOptionalPreviewFile(uploadFile)
      await api.uploadFile({
        taskId,
        entryId,
        scope: 'progress',
        file: uploadFile,
        preview,
        type: uploadExtension,
        size: formatFileSize(uploadFile.size),
        final: false,
        visible: true,
        analyze: true,
      }, onProgress)
      await refreshState()
      await loadTaskActivity(taskId)
      notify('图片已上传')
    } catch (error) {
      notify(error instanceof Error ? `上传失败：${error.message}` : '上传失败')
      throw error
    }
  }

  const handleAcceptanceFileUpload = async (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string, preview?: File) => {
    const extension = fileTypeForFile(file).type
    const savedFile = await api.uploadFile(
      {
        taskId,
        entryId,
        scope: 'acceptance',
        file,
        preview,
        type: extension,
        size: formatFileSize(file.size),
        final: true,
        visible: true,
        tag: '验收文件',
        analyze: true,
      },
      onProgress,
    )
    setFileItems((currentFiles) => [savedFile, ...currentFiles])
    setTaskItems((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, files: Array.from(new Set([savedFile.name, ...task.files])) } : task)),
    )
    // 缩略图不是源文件上传的前置条件。复杂 PDF / Office 即使首次渲染失败，
    // 完整文件也已经可用；后台再有限重试并把成功结果持久化到 R2。
    if (fileTypeForFile(file).kind !== 'image') {
      void (async () => {
        for (const delay of [0, 800, 2400]) {
          if (delay > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delay))
          }
          const preview = await createOptionalPreviewFile(file)
          if (!preview) {
            continue
          }
          try {
            const result = await api.setFilePreview(savedFile.id, preview)
            if (result.previewUrl) {
              savedFile.previewUrl = result.previewUrl
              setFileItems((currentFiles) => currentFiles.map((item) => (
                item.id === savedFile.id ? { ...item, previewUrl: result.previewUrl, previewFallback: Boolean(result.previewFallback) } : item
              )))
              return
            }
          } catch (error) {
            console.warn('验收附件缩略图持久化失败', file.name, error)
          }
        }
      })()
    }
    return savedFile
  }

  // AI 自动估算整体进度：读取完整生命周期证据，并按语义签名去重。
  const autoEstimateSigRef = useRef<Map<number, string>>(new Map())
  const aiProgressWriteRef = useRef<Set<number>>(new Set())
  const handleAutoEstimateProgress = async (task: Task) => {
    if (!isAdmin) {
      return
    }
    if (['已验收', '终止', '挂起', '不计费'].includes(task.status)) {
      return
    }
    const taskFiles = fileItems.filter((file) => file.taskId === task.id && !file.deletedAt)
    const attachmentsByEntry = new Map<string, string[]>()
    taskFiles.forEach((file) => {
      if (!file.entryId) return
      attachmentsByEntry.set(file.entryId, [...(attachmentsByEntry.get(file.entryId) ?? []), file.name])
    })
    const entries = [...(task.timeEntries ?? [])]
      .sort((left, right) => `${left.date ?? ''}T${left.start}`.localeCompare(`${right.date ?? ''}T${right.start}`))
      .filter((entry) => (entry.note ?? '').trim() || (attachmentsByEntry.get(entry.id)?.length ?? 0) > 0)
    if (entries.length === 0 && taskFiles.length === 0) {
      return
    }
    const payload = {
      taskId: task.id,
      title: task.title,
      type: task.type,
      requirement: task.requirement,
      status: task.status,
      currentProgress: snapProgress(task.progress),
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date ?? '',
        endDate: entry.endDate ?? entry.date ?? '',
        note: entry.note ?? '',
        isAcceptance: Boolean(entry.isAcceptanceProgress),
        isRevision: Boolean(entry.isRevision),
        isClientFeedback: Boolean(entry.isClientFeedback),
        isUncounted: Boolean(entry.isUncounted),
        feedbackVersion: entry.feedbackVersion ?? '',
        attachments: attachmentsByEntry.get(entry.id) ?? [],
      })),
      waitingEntries: (task.waitingEntries ?? []).map((entry) => ({
        date: entry.date ?? '',
        note: entry.note ?? '',
        reason: entry.reason ?? '',
        active: (entry.endDate ?? entry.date ?? '') === (entry.date ?? '') && entry.end === entry.start,
      })),
      files: taskFiles.map((file) => ({
        name: file.name,
        scope: file.scope,
        final: file.final,
        tag: file.tag ?? '',
      })),
    }
    const signature = JSON.stringify(payload)
    if (autoEstimateSigRef.current.get(task.id) === signature) {
      return
    }
    autoEstimateSigRef.current.set(task.id, signature)
    try {
      const result = await api.estimateTaskProgress(payload)
      if (autoEstimateSigRef.current.get(task.id) !== signature) {
        return
      }
      setProgressAssessments((current) => ({ ...current, [task.id]: result }))
      const next = snapProgress(result.progress)
      const current = taskItemsRef.current.find((item) => item.id === task.id)
      if (!current || ['已验收', '终止', '挂起', '不计费'].includes(current.status)) {
        return
      }
      if (snapProgress(current.progress) !== next) {
        aiProgressWriteRef.current.add(task.id)
        await handleUpdateTask(task.id, { progress: next })
      }
    } catch {
      // 失败则清掉签名，下次再试
      if (autoEstimateSigRef.current.get(task.id) === signature) {
        autoEstimateSigRef.current.delete(task.id)
      }
    }
  }

  const handleUpdateTask = async (taskId: number, changes: TaskUpdateChanges) => {
    if (updatingTaskIdsRef.current.has(taskId)) {
      pendingTaskChangesRef.current.set(taskId, { ...(pendingTaskChangesRef.current.get(taskId) ?? {}), ...changes })
      return false
    }
    const currentTask = taskItemsRef.current.find((task) => task.id === taskId)
    if (!currentTask) {
      return false
    }
    const allowAcceptedTimeEdit = Boolean(changes.allowAcceptedTimeEdit)
    const allowAcceptanceRollback = Boolean(changes.allowAcceptanceRollback)
    if (currentTask.status === '已验收') {
      if (changes.status && changes.status !== '已验收' && !allowAcceptanceRollback) {
        notify('已验收任务状态已锁定，如需调整请先走验收修正流程')
        return false
      }
      if (!allowAcceptedTimeEdit && ('actualHours' in changes || 'timeEntries' in changes)) {
        notify('已验收任务的工时已锁定，不能再修改实际工时')
        return false
      }
    }
    const normalizedChanges = { ...changes }
    const isAiProgressWrite = Object.hasOwn(changes, 'progress') && aiProgressWriteRef.current.has(taskId)
    const isManualProgressCorrection = Object.hasOwn(changes, 'progress') && !isAiProgressWrite
    if (normalizedChanges.progress !== undefined) {
      normalizedChanges.progress = snapProgress(Number(normalizedChanges.progress))
    }
    if (currentTask.status === '计划中' && normalizedChanges.progress !== undefined && !changes.status) {
      normalizedChanges.progress = 0
    }
    if (changes.status) {
      normalizedChanges.stage = changes.status === '已验收' ? '完成' : changes.status
      normalizedChanges.progress = changes.status === '已验收'
        ? 100
        : changes.status === '计划中'
          ? 0
          : allowAcceptanceRollback && changes.status === '待验收'
            ? snapProgress(Number(changes.progress ?? Math.min(currentTask.progress, 80)))
            : changes.status === '待验收'
              ? snapProgress(Math.max(currentTask.progress, 80))
              : snapProgress(currentTask.progress)
      notify('正在保存…', 'info')
    }

    updatingTaskIdsRef.current.add(taskId)
    let savedSuccessfully = false
    try {
      const savedTask = normalizeTaskClosure(await api.updateTask(taskId, normalizedChanges))
      setTaskItems((currentTasks) => currentTasks.map((task) => (task.id === taskId ? normalizeTaskClosure({ ...task, ...savedTask }) : task)))
      setBackendStatus('已接入 D1/R2')
      if (detailTaskId === taskId) {
        void loadTaskActivity(taskId)
      }
      if (selectedTask?.id === taskId) {
        void loadTaskActivity(taskId)
      }
      if (changes.status === '已验收') {
        setShowFireworks(true)
        window.setTimeout(() => setShowFireworks(false), 3000)
      }
      if (changes.status) {
        notify('任务已同步到 D1')
      }
      savedSuccessfully = true
      if (isManualProgressCorrection) {
        const assessment = progressAssessments[taskId]
        if (assessment && snapProgress(Number(normalizedChanges.progress)) !== assessment.progress) {
          void api.recordAiLearningEvent({
            context: 'task_progress',
            sourceInput: assessment.reason,
            aiOutput: String(assessment.progress),
            userFinal: String(snapProgress(Number(normalizedChanges.progress))),
            action: 'edited',
            designType: currentTask.type,
            taskId,
            taskTitle: currentTask.title,
            metadata: {
              stage: assessment.stage,
              confidence: assessment.confidence,
              evidence: assessment.evidence,
              algorithmVersion: '2.0.0',
            },
          })
        }
      }
      const shouldReassessProgress = !Object.hasOwn(changes, 'progress') && (
        Object.hasOwn(changes, 'timeEntries')
        || Object.hasOwn(changes, 'waitingEntries')
        || Object.hasOwn(changes, 'requirement')
        || Object.hasOwn(changes, 'type')
        || Object.hasOwn(changes, 'status')
      )
      if (shouldReassessProgress && !['已验收', '终止', '挂起', '不计费'].includes(savedTask.status)) {
        window.setTimeout(() => void handleAutoEstimateProgress(savedTask), 0)
      }
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务更新失败：${error.message}` : '任务更新失败')
    } finally {
      updatingTaskIdsRef.current.delete(taskId)
      if (isAiProgressWrite) {
        aiProgressWriteRef.current.delete(taskId)
      }
      const pendingChanges = pendingTaskChangesRef.current.get(taskId)
      if (pendingChanges) {
        pendingTaskChangesRef.current.delete(taskId)
        void handleUpdateTask(taskId, pendingChanges)
      }
    }
    return savedSuccessfully
  }

  const handleVoidTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task || task.voidedAt) {
      return
    }
    setVoidTaskTarget(task)
  }

  const confirmVoidTask = async (reason: string) => {
    if (!voidTaskTarget || isVoidTaskBusy) {
      return
    }
    setIsVoidTaskBusy(true)
    try {
      await api.voidTask(voidTaskTarget.id, reason.trim())
      await refreshState()
      setVoidTaskTarget(null)
      notify('任务已作废，不再计入工时和结算')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `作废失败：${error.message}` : '作废失败')
    } finally {
      setIsVoidTaskBusy(false)
    }
  }

  const handleRestoreTask = async (taskId: number) => {
    try {
      await api.restoreTask(taskId)
      await refreshState()
      notify('任务已恢复')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `恢复失败：${error.message}` : '恢复失败')
    }
  }

  const handleDeleteTask = (taskId: number) => {
    const task = taskItems.find((item) => item.id === taskId)
    if (!task?.voidedAt) {
      notify('只有已作废任务才能永久删除', 'error')
      return
    }
    setConfirmDialog({
      eyebrow: '永久删除',
      title: `确定永久删除「${task.title}」吗？`,
      body: '永久删除只允许用于已作废任务。删除后任务不会再出现在后台列表中，关联文件仍会保留在文件库记录里。',
      confirmText: '永久删除',
      tone: 'danger',
      details: [task.type, `作废原因：${task.voidReason || '未记录'}`],
      onConfirm: async () => {
        try {
          await api.deleteTask(taskId)
          await refreshState()
          notify('已作废任务已永久删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleDownloadFile = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (!sourceUrl) {
      notify('源文件链接不可用', 'error')
      return
    }
    const link = document.createElement('a')
    link.href = sourceUrl
    link.download = file.name
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleDeleteFile = async (fileId: number) => {
    const file = fileItems.find((item) => item.id === fileId)
    const fileTask = file ? taskItemsRef.current.find((task) => task.id === file.taskId) : undefined
    const shouldRollbackAcceptance = Boolean(file && file.scope === 'acceptance' && fileTask?.status === '已验收')
    setConfirmDialog({
      eyebrow: shouldRollbackAcceptance ? '撤回验收文件' : '删除文件',
      title: `确定删除「${file?.name ?? '该文件'}」吗？`,
      body: shouldRollbackAcceptance
        ? '这是已验收任务的验收文件。删除后会同时撤回验收状态，任务回到待验收，方便重新补传文件后再次确认。'
        : '删除后会同时移除 D1 文件记录、R2 源文件和预览图。请只删除误传文件，已验收或已发给合作伙伴的文件建议保留。',
      confirmText: shouldRollbackAcceptance ? '删除并撤回验收' : '确认删除',
      tone: 'danger',
      details: [file?.task, file?.type, file?.size, shouldRollbackAcceptance ? '状态将改回待验收' : ''].filter(Boolean) as string[],
      onConfirm: async () => {
        try {
          await api.deleteFile(fileId)
          if (previewFile?.id === fileId) {
            setPreviewFile(null)
          }
          if (shouldRollbackAcceptance && fileTask && file) {
            const nextAcceptanceFiles = (fileTask.acceptanceFiles ?? []).filter((name) => name !== file.name)
            await handleUpdateTask(fileTask.id, {
              status: '待验收',
              stage: '待验收',
              progress: snapProgress(Math.min(fileTask.progress, 80)),
              acceptanceFiles: nextAcceptanceFiles,
              actualDeliveryDate: '',
              allowAcceptanceRollback: true,
            })
          }
          await refreshState()
          notify(shouldRollbackAcceptance ? '验收文件已删除，任务已回到待验收' : '文件已删除')
        } catch (error) {
          setBackendStatus('后端异常')
          notify(error instanceof Error ? `文件删除失败：${error.message}` : '文件删除失败')
        }
      },
    })
  }

  const handleUpdateFile = async (fileId: number, changes: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) => {
    try {
      const updatedFile = await api.updateFile(fileId, changes)
      setFileItems((currentFiles) => currentFiles.map((file) => (file.id === fileId ? { ...file, ...updatedFile } : file)))
      setTaskItems((currentTasks) =>
        currentTasks.map((task) =>
          task.id === updatedFile.taskId
            ? { ...task, files: Array.from(new Set([updatedFile.name, ...task.files.filter((fileName) => fileName !== updatedFile.name)])) }
            : task,
        ),
      )
      notify('文件信息已更新')
      return updatedFile
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `文件更新失败：${error.message}` : '文件更新失败')
      throw error
    }
  }

  const handleExportBackup = () => {
    const payload = {
      exportedAt: nowStamp(),
      settings: { hourlyRate, pdfTitle, serviceCompanyName, taxMode },
      tasks: taskItems,
      updates: updateItems,
      files: fileItems,
      reports,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `worklog-backup-${isoDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('备份已导出到下载目录')
  }

  const handleUnlock = async (email: string, key: string, turnstileToken?: string) => {
    try {
      const result = await api.login(email, key, turnstileToken)
      const credentials = { email, role: result.role }
      setStoredAuth(credentials)
      setAuthError('')
      setBackendStatus('连接中')
      setRole(result.role)
      setAuth(credentials)
      setIsLoginModalOpen(false)
      notify(result.role === 'admin' ? '管理员已登录' : '访问口令已登录')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthError('账号或密码不正确')
      } else {
        setAuthError(error instanceof Error ? `登录失败：${error.message}` : '登录失败，请重试')
      }
    }
  }

  const handleSignOut = () => {
    void api.logout().catch(() => {})
    clearStoredAuth()
    clearStateCache()
    setAuth(null)
    setRole('guest')
    setAccessTokens([])
    setAuthError('')
    setIsAccountMenuOpen(false)
    setIsLoginModalOpen(false)
    notify('已退出管理员身份，当前为游客只读')
  }

  const handleChangeAdminPassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.changeAdminPassword({ currentPassword, newPassword })
      notify('管理员密码已更新')
    } catch (error) {
      notify(error instanceof Error ? `密码更新失败：${error.message}` : '密码更新失败')
      throw error
    }
  }

  const handleCreateAccessToken = async (label: string, expiresInDays: number | null, scope: TokenScope) => {
    try {
      const created = await api.createAccessToken({ label, expiresInDays, scope })
      setAccessTokens((current) => [created, ...current])
      setNewTokenId(created.id)
      try {
        await window.navigator.clipboard.writeText(created.token)
        notify('口令已生成并复制到剪贴板')
      } catch {
        notify('口令已生成，请在列表中复制')
      }
    } catch (error) {
      notify(error instanceof Error ? `口令生成失败：${error.message}` : '口令生成失败')
    }
  }

  const handleToggleAccessToken = async (tokenId: string, disabled: boolean) => {
    try {
      const saved = await api.setAccessTokenDisabled(tokenId, disabled)
      setAccessTokens((current) => current.map((token) => (token.id === tokenId ? saved : token)))
      notify(disabled ? '口令已停用' : '口令已恢复')
    } catch (error) {
      notify(error instanceof Error ? `操作失败：${error.message}` : '操作失败')
    }
  }

  const handleDeleteAccessToken = async (tokenId: string) => {
    const token = accessTokens.find((item) => item.id === tokenId)
    setConfirmDialog({
      eyebrow: '删除口令',
      title: `确定删除「${token?.label || '该口令'}」吗？`,
      body: '正在使用这个口令登录的设备会立即失效，删除后无法恢复。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [token?.expiresAt ? `有效期：${token.expiresAt}` : '永久有效', token?.lastUsedAt ? `最后使用：${token.lastUsedAt}` : '尚未使用'],
      onConfirm: async () => {
        try {
          await api.deleteAccessToken(tokenId)
          setAccessTokens((current) => current.filter((token) => token.id !== tokenId))
          notify('口令已删除')
        } catch (error) {
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleCopyAccessToken = async (token: string) => {
    try {
      await window.navigator.clipboard.writeText(token)
      notify('口令已复制')
    } catch {
      notify(token)
    }
  }

  const handleRateChange = async (rate: number) => {
    setHourlyRate(rate)
    try {
      const result = await api.setHourlyRate(rate)
      setHourlyRate(result.hourlyRate)
      setBackendStatus('已接入 D1/R2')
      notify('小时单价已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `单价保存失败：${error.message}` : '单价保存失败')
    }
  }

  const handlePdfTitleChange = async (title: string) => {
    const nextTitle = title.trim() || defaultPdfTitle
    setPdfTitle(nextTitle)
    try {
      const saved = await api.setPdfTitle(nextTitle)
      setPdfTitle(saved.pdfTitle)
      notify('PDF 抬头已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `PDF 抬头保存失败：${error.message}` : 'PDF 抬头保存失败')
    }
  }

  const handleServiceCompanyNameChange = async (name: string) => {
    const nextName = name.trim() || defaultServiceCompanyName
    setServiceCompanyName(nextName)
    try {
      const saved = await api.setServiceCompanyName(nextName)
      setServiceCompanyName(saved.serviceCompanyName)
      notify('服务公司名称已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `服务公司名称保存失败：${error.message}` : '服务公司名称保存失败')
    }
  }

  const handleTaxModeChange = async (mode: TaxMode) => {
    setTaxMode(mode)
    try {
      const saved = await api.setTaxMode(mode)
      setTaxMode(saved.taxMode)
      setBackendStatus('已接入 D1/R2')
      notify('计税方式已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `计税方式保存失败：${error.message}` : '计税方式保存失败')
    }
  }

  const handleDesignTypeGroupsChange = async (nextGroups: DesignTypeGroup[]) => {
    const safeGroups = normalizeDesignTypeGroups(nextGroups)
    setDesignTypeGroups(safeGroups)
    try {
      const result = await api.setDesignTypeGroups(safeGroups)
      setDesignTypeGroups(result.designTypeGroups)
      setBackendStatus('已接入 D1/R2')
      notify('设计类型已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `设计类型保存失败：${error.message}` : '设计类型保存失败')
    }
  }

  const handleAiModelConfigChange = async (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => {
    try {
      const saved = await api.setAiModelConfig(payload)
      setAiModelConfig(saved)
      setBackendStatus('已接入 D1/R2')
      notify(saved.mode === 'baml-runtime' ? 'BAML Runtime 模型配置已保存' : 'AI 模型配置已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `AI 模型配置保存失败：${error.message}` : 'AI 模型配置保存失败')
    }
  }

  const requireAdmin = () => {
    notify('请先登录管理员身份再编辑')
    setIsLoginModalOpen(true)
  }
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
  const visibleNavItems = navItems.filter((item) => !('adminOnly' in item) || !item.adminOnly || isAdmin)
  const navShortcutHints: Partial<Record<AppView, string>> = {
    工作台: '⌘⌥1',
    任务: '⌘⌥2',
    文件库: '⌘⌥3',
    洞察: '⌘⌥4',
    结算: '⌘⌥5',
    收入: '⌘⌥6',
    知识库: '⌘⇧⌥K',
    设置: '⌘⇧⌥,',
  }
  const navAriaShortcutHints: Partial<Record<AppView, string>> = {
    工作台: 'Meta+Alt+1 Control+Alt+1',
    任务: 'Meta+Alt+2 Control+Alt+2',
    文件库: 'Meta+Alt+3 Control+Alt+3',
    洞察: 'Meta+Alt+4 Control+Alt+4',
    结算: 'Meta+Alt+5 Control+Alt+5',
    收入: 'Meta+Alt+6 Control+Alt+6',
    知识库: 'Meta+Shift+Alt+K Control+Shift+Alt+K',
  }
  const openCommandPalette = (initialQuery = '') => {
    setCommandPaletteInitialQuery(initialQuery)
    setIsShortcutHelpOpen(false)
    setIsCommandPaletteOpen(true)
  }
  const commandActions: CommandPaletteAction[] = [
    ...visibleNavItems.map((item) => {
      return {
        id: `view-${item.label}`,
        group: '快速导航',
        label: `前往${item.label}`,
        detail: item.label === activeView ? '当前页面' : undefined,
        shortcut: navShortcutHints[item.label as AppView],
        keywords: `页面 导航 ${item.label}`,
        run: () => navigateView(item.label as AppView),
      }
    }),
    {
      id: 'view-settings',
      group: '快速导航',
      label: '前往设置',
      shortcut: '⌘⇧⌥,',
      keywords: '设置 配置 API 模型',
      run: () => navigateView('设置'),
    },
    {
      id: 'create-task',
      group: '任务操作',
      label: '新建任务',
      detail: '记录一条新的设计任务',
      shortcut: 'N',
      keywords: '创建 新任务',
      disabled: !canWrite,
      run: () => openCreateTask(false),
    },
    {
      id: 'create-supplemental-task',
      group: '任务操作',
      label: '补录已完成任务',
      detail: '补录过去三个月内的任务',
      shortcut: '⇧ N',
      keywords: '补录 历史任务',
      disabled: !canWrite,
      run: () => openCreateTask(true),
    },
    ...(selectedTask
      ? [
          {
            id: 'selected-task-detail',
            group: '当前任务',
            label: '查看任务详情',
            detail: selectedTask.title,
            shortcut: 'Enter',
            keywords: '打开 详情',
            run: () => handleOpenTaskDetail(selectedTask.id),
          },
          {
            id: 'selected-task-edit',
            group: '当前任务',
            label: '编辑任务',
            detail: selectedTask.title,
            shortcut: 'E',
            keywords: '修改 编辑',
            disabled: !canWrite,
            run: () => handleOpenTaskEdit(selectedTask.id),
          },
          {
            id: 'selected-task-progress',
            group: '当前任务',
            label: '记录进展',
            detail: selectedTask.title,
            shortcut: 'P',
            keywords: '进展 工时 附件',
            disabled: !canWrite,
            run: () => handleOpenTaskProgress(selectedTask.id),
          },
          {
            id: 'selected-task-acceptance',
            group: '当前任务',
            label: '去验收',
            detail: selectedTask.status === '待验收' ? selectedTask.title : `当前状态：${selectedTask.status}`,
            shortcut: 'A',
            keywords: '验收 交付',
            disabled: !isAdmin || selectedTask.status !== '待验收',
            run: () => handleOpenTaskAcceptance(selectedTask.id),
          },
        ]
      : []),
    ...taskItems
      .filter((task) => !task.voidedAt)
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((task) => ({
        id: `task-${task.id}`,
        group: '搜索任务',
        label: task.title,
        detail: `${task.type} · ${task.requester || task.contact} · ${task.status}`,
        keywords: `${task.requirement} ${task.contact} ${task.requester} ${task.status}`,
        run: () => handleOpenTaskDetail(task.id),
      })),
  ]
  const shortcutHelpGroups: ShortcutHelpGroup[] = productShortcutHelpGroups
  const hasBlockingModal = Boolean(
    isModalOpen
      || detailTaskId
      || editTaskId
      || progressModalTarget
      || previewFile
      || confirmDialog
      || voidTaskTarget
      || isLoginModalOpen,
  )

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (event.repeat) {
        return
      }
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false)
        } else {
          openCommandPalette()
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'm') {
        if (canToggleIncomeVisibility && !isCommandPaletteOpen && !isShortcutHelpOpen && !hasBlockingModal && !isEditableShortcutTarget(event.target)) {
          event.preventDefault()
          toggleIncomeVisibility()
        }
        return
      }
      // 双击 Option/Alt 打开快捷键面板
      if (event.key === 'Alt' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        if (!isCommandPaletteOpen && !isShortcutHelpOpen && !hasBlockingModal) {
          const now = Date.now()
          if (now - lastAltPressRef.current < 380) {
            event.preventDefault()
            lastAltPressRef.current = 0
            setIsShortcutHelpOpen(true)
          } else {
            lastAltPressRef.current = now
          }
        }
        return
      }
      if (isCommandPaletteOpen || isShortcutHelpOpen || hasBlockingModal || isEditableShortcutTarget(event.target)) {
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.altKey) {
        const navigationShortcuts: Record<string, AppView> = {
          Digit1: '工作台',
          Digit2: '任务',
          Digit3: '文件库',
          Digit4: '洞察',
          Digit5: '结算',
          Digit6: '收入',
        }
        const nextView = !event.shiftKey ? navigationShortcuts[event.code] : undefined
        if (nextView && visibleNavItems.some((item) => item.label === nextView)) {
          event.preventDefault()
          navigateView(nextView)
          return
        }
        if (event.shiftKey && event.key === ',') {
          event.preventDefault()
          navigateView('设置')
          return
        }
        if (event.shiftKey && event.code === 'KeyK' && isAdmin) {
          event.preventDefault()
          navigateView('知识库')
          return
        }
      }
      // ⌥A = 工作助手（Option 键，不与文字输入冲突）
      if (event.altKey && !event.metaKey && !event.shiftKey) {
        if (event.code === 'KeyA' && isAdmin) {
          event.preventDefault()
          toggleChat()
          return
        }
      }
      const shortcutMonth = monthFromShortcut(event)
      if (shortcutMonth > 0) {
        event.preventDefault()
        setMonthValue(`${isoDate().slice(0, 4)}-${pad(shortcutMonth)}`)
        return
      }
      if (key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        openCreateTask(event.shiftKey)
        return
      }
      if (key === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        navigateView('文件库')
        return
      }
      if (event.key === ',' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        navigateView('设置')
        return
      }
      if (key === 'p' && !event.metaKey && !event.ctrlKey && !event.altKey && selectedTask && isAdmin) {
        event.preventDefault()
        handleOpenTaskProgress(selectedTask.id)
        return
      }
      if (event.key === '/' && !event.shiftKey) {
        const searchInput = document.querySelector<HTMLInputElement>('.dashboard-task-search input, .task-search-inline input')
        if (searchInput) {
          event.preventDefault()
          searchInput.focus()
          searchInput.select()
        }
        return
      }
      if (event.key === '[' || event.key === ']') {
        event.preventDefault()
        setMonthValue((current) => shiftMonthValue(current, event.key === '[' ? -1 : 1))
        return
      }
      if (!selectedTask || !['工作台', '任务'].includes(activeView)) {
        return
      }
      if (key === 'j' || key === 'k') {
        event.preventDefault()
        const currentIndex = Math.max(0, selectedTaskSource.findIndex((task) => task.id === selectedTask.id))
        const offset = key === 'j' ? 1 : -1
        const nextIndex = Math.min(Math.max(currentIndex + offset, 0), selectedTaskSource.length - 1)
        const nextTask = selectedTaskSource[nextIndex]
        if (nextTask) {
          setSelectedTaskId(nextTask.id)
        }
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        handleOpenTaskDetail(selectedTask.id)
      } else if (key === 'e' && isAdmin) {
        event.preventDefault()
        handleOpenTaskEdit(selectedTask.id)
      } else if (key === 'p' && isAdmin) {
        event.preventDefault()
        handleOpenTaskProgress(selectedTask.id)
      } else if (key === 'a' && isAdmin && selectedTask.status === '待验收') {
        event.preventDefault()
        handleOpenTaskAcceptance(selectedTask.id)
      } else if (key === 's' && isAdmin) {
        event.preventDefault()
        openCommandPalette('状态')
      }
    }
    window.addEventListener('keydown', handleGlobalShortcut)
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcut)
    }
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
  const effectiveBackendSyncSlow = backendStatus === '连接中' && backendSyncSlow

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
            <strong>{stats.accepted} / {activeMonthTasks.length}</strong>
            <p className={stats.pending > 0 ? 'attention' : ''}>{stats.pending} 个待验收</p>
          </article>
        </section>

        <section className="daily-knowledge" aria-label="AI 每日知识">
          <button className="daily-knowledge-main" type="button" onClick={() => setIsDailyKnowledgeOpen(true)}>
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
            disabled={!isAdmin || (isDailyKnowledgeLoading && dailyKnowledgeQueue.length === 0)}
            onClick={(event) => {
              event.stopPropagation()
              void showNextDailyKnowledge()
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
                {visibleTasks.length === 0 && (
                  <EmptyState
                    role="status"
                    title={activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}
                    description={activeMonthTasks.length === 0 ? '先建一条真实任务，工时、文件和月报都会从这里串起来。' : '换一个关键词或状态筛选试试。'}
                    action={activeMonthTasks.length === 0 ? (
                      <button className="ghost-button compact-button empty-state-action" onClick={() => openCreateTask(false)}>
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
                {dashboardContextMenu && (
                  <TaskContextMenu
                    menu={dashboardContextMenu}
                    onClose={() => setDashboardContextMenu(null)}
                    onOpenTask={handleOpenTaskDetail}
                    onOpenEditTask={handleOpenTaskEdit}
                    onOpenAcceptance={(task) => handleOpenTaskAcceptance(task.id)}
                    onOpenProgress={(task) => handleOpenTaskProgress(task.id)}
                    onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
                    onVoidTask={isAdmin ? handleVoidTask : readOnlyUpdateTask}
                    onRestoreTask={isAdmin ? handleRestoreTask : readOnlyUpdateTask}
                    onDeleteTask={isAdmin ? handleDeleteTask : readOnlyUpdateTask}
                    canWrite={canWrite}
                    canDelete={isAdmin}
                  />
                )}
                {canWrite && dashboardCreateMenu && (
                  <CreateTaskContextMenu
                    menu={dashboardCreateMenu}
                    onCreate={openNewTaskFromDashboardMenu}
                  />
                )}
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
                          className={`annual-bar ${row.month === currentMonth.value ? 'current' : ''}`}
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
          {!isTaskDetailCollapsed && <DashboardTaskSidebar
            task={selectedTask}
            files={fileItems}
            progressAssessment={selectedTask ? progressAssessments[selectedTask.id] : undefined}
            hourlyRate={hourlyRate}
            onPreviewFile={setPreviewFile}
            onUpdateTask={handleUpdateTask}
            onOpenProgress={handleOpenTaskProgress}
            onDeleteEntry={handleDeleteTaskTimeEntry}
            onDeleteAcceptanceProgress={handleDeleteAcceptanceProgress}
            onOpenEdit={(taskId) => handleOpenTaskEdit(taskId)}
            onOpenAcceptance={(taskId) => handleOpenTaskAcceptance(taskId)}
            onAutoEstimateProgress={canWrite ? handleAutoEstimateProgress : undefined}
            canWrite={canWrite}
            canDelete={isAdmin}
          />}
        </section>
          </div>
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

      {isDailyKnowledgeOpen && (
        <DailyKnowledgeModal
          item={dailyKnowledge}
          isLoading={isDailyKnowledgeLoading}
          canRefresh={isAdmin}
          onRefresh={() => void showNextDailyKnowledge()}
          onClose={() => setIsDailyKnowledgeOpen(false)}
          onFavorite={isAdmin ? async (item) => {
            const h: Record<string, string> = { 'content-type': 'application/json' }
            const body = {
              title: item.title,
              content: item.body.join('\n\n'),
              tags: item.category,
              source: 'ai-tip',
            }
            const res = await fetch('/api/knowledge', { method: 'POST', headers: h, body: JSON.stringify(body) })
            return res.ok
          } : undefined}
        />
      )}
      {isCommandPaletteOpen && (
        <CommandPalette
          key={commandPaletteInitialQuery}
          actions={commandActions}
          initialQuery={commandPaletteInitialQuery}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      )}
      {isShortcutHelpOpen && (
        <ShortcutHelpModal groups={shortcutHelpGroups} onClose={() => setIsShortcutHelpOpen(false)} />
      )}
      {isChatOpen && isAdmin && (
        <>
          <div
            className="chat-backdrop"
            onDoubleClick={() => {
              setIsChatOpen(false)
              setChatAnalysisFocusId('')
            }}
          />
          <Suspense fallback={<div className="chat-panel"><div className="office-preview-status">正在载入工作助手…</div></div>}>
            <ChatPanel
              currentMonthValue={currentMonth.value}
              aiModelConfig={aiModelConfig}
              aiProviderConfigs={aiProviderConfigs}
              initialAnalysisJobId={chatAnalysisFocusId || undefined}
              onNotify={notify}
              onClose={() => {
                setIsChatOpen(false)
                setChatAnalysisFocusId('')
              }}
              onOpenTask={(taskId) => {
                setIsChatOpen(false)
                setChatAnalysisFocusId('')
                void refreshState().then(() => handleOpenTaskDetail(taskId))
              }}
            />
          </Suspense>
        </>
      )}
      {isSemanticSearchOpen && (
        <Suspense fallback={<div className="command-overlay"><p className="calendar-empty-hint">正在载入语义搜索…</p></div>}>
          <SemanticSearchModal
            isAdmin={isAdmin}
            files={fileItems}
            tasks={taskItems}
            onClose={() => setIsSemanticSearchOpen(false)}
            onOpenTask={(taskId) => {
              setIsSemanticSearchOpen(false)
              handleOpenTaskDetail(taskId)
            }}
            renderFileThumbnail={(file) => {
              const fileType = fileTypeForAsset(file).type
              const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
              return (
                <AttachmentHoverThumbnail
                  name={file.name}
                  type={fileType}
                  previewUrl={previewUrl}
                  previewFallback={Boolean(file.previewFallback)}
                  sourceUrl={fileThumbnailSource(file)}
                  compact
                  onOpen={() => {
                    setIsSemanticSearchOpen(false)
                    setFileLibraryFocusId(file.id)
                    navigateView('文件库')
                  }}
                />
              )
            }}
          />
        </Suspense>
      )}
      {isModalOpen && (
        <Suspense fallback={<ModalShell className="new-task-modal" labelledBy="new-task-loading-title" onClose={() => setIsModalOpen(false)} closeOnEscape><div id="new-task-loading-title" className="office-preview-status">正在载入新建任务…</div></ModalShell>}>
          <NewTaskModal
            designTypeGroups={designTypeGroups}
            currentMonthValue={currentMonth.value}
            initialSupplemental={newTaskSupplemental}
            onClose={() => setIsModalOpen(false)}
            onCreate={canWrite ? handleCreateTask : async () => requireAdmin()}
            onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
          />
        </Suspense>
      )}
      {detailTaskId > 0 && (() => {
        const detailTask = taskItems.find((task) => task.id === detailTaskId)
        return detailTask ? (
          <TaskDetailModal
            key={detailTask.id}
            task={detailTask}
            onClose={() => setDetailTaskId(0)}
            onOpenAcceptance={handleOpenTaskAcceptance}
            canAccept={isAdmin}
            onOpenEdit={(taskId) => {
              setDetailTaskId(0)
              handleOpenTaskEdit(taskId)
            }}
            onOpenProgress={(taskId) => {
              setDetailTaskId(0)
              handleOpenTaskProgress(taskId)
            }}
          />
        ) : null
      })()}
      {editTaskId > 0 && (() => {
        const editTask = taskItems.find((task) => task.id === editTaskId)
        return editTask ? (
          <Suspense fallback={<ModalShell className="new-task-modal" labelledBy="edit-task-loading-title" onClose={() => setEditTaskId(0)} closeOnEscape><div id="edit-task-loading-title" className="office-preview-status">正在载入任务编辑…</div></ModalShell>}>
            <NewTaskModal
              key={`edit-${editTask.id}`}
              designTypeGroups={designTypeGroups}
              currentMonthValue={currentMonth.value}
              editingTask={editTask}
              onClose={() => setEditTaskId(0)}
              onCreate={canWrite ? handleCreateTask : async () => requireAdmin()}
              onSave={(changes) => handleSaveTaskEdit(editTask.id, changes)}
              onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
            />
          </Suspense>
        ) : null
      })()}
      {progressModalTarget && (() => {
        const progressTask = taskItems.find((task) => task.id === progressModalTarget.taskId)
        return progressTask ? (
          <TaskProgressModal
            task={progressTask}
            mode={progressModalTarget.mode}
            editEntryId={progressModalTarget.editEntryId}
            files={fileItems}
            activity={taskActivity}
            onClose={() => setProgressModalTarget(null)}
            onUpdateTask={canWrite ? handleUpdateTask : readOnlyUpdateTask}
            onCreateTaskUpdate={canWrite ? handleCreateTaskUpdate : readOnlyCreateUpdate}
            onUploadImage={canWrite ? handleQuickUploadImage : readOnlyUploadImage}
            onPreviewFile={setPreviewFile}
            onUpdateFile={canWrite ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
            onDeleteFile={isAdmin ? handleDeleteFile : () => requireAdmin()}
            onConfirmAcceptance={isAdmin ? handleConfirmTaskAcceptance : undefined}
            onUploadAcceptanceFile={canWrite ? handleAcceptanceFileUpload : undefined}
            onNotify={notify}
            initialAcceptanceMode={progressModalTarget.initialAcceptanceMode}
            hourlyRate={hourlyRate}
          />
        ) : null
      })()}
      {confirmDialog && (
        <ConfirmDialogModal
          dialog={confirmDialog}
          isBusy={isConfirmDialogBusy}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => void handleConfirmDialogConfirm()}
        />
      )}
      {voidTaskTarget && (
        <VoidTaskModal
          task={voidTaskTarget}
          monthLabel={monthLabelOf(taskSettlementMonth(voidTaskTarget))}
          isBusy={isVoidTaskBusy}
          onClose={() => setVoidTaskTarget(null)}
          onConfirm={(reason) => void confirmVoidTask(reason)}
        />
      )}
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {isLoginModalOpen && (
        <AdminLoginModal
          error={authError}
          onClose={() => {
            setIsLoginModalOpen(false)
            setAuthError('')
          }}
          onSubmit={handleUnlock}
        />
      )}
      {showFireworks && <Fireworks />}
      {toastQueue.length > 0 && (
        <div className="toast-stack" role="region" aria-label="操作提示">
          {toastQueue.map((item) => (
            <div className={`toast toast-${item.tone}`} key={item.id} role={item.tone === 'error' ? 'alert' : 'status'}>
              <ToastIcon tone={item.tone} />
              <span>{item.message}</span>
              {item.actionLabel && item.onAction ? (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    void item.onAction?.()
                    setToastQueue((current) => current.filter((toast) => toast.id !== item.id))
                  }}
                >
                  {item.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function Fireworks() {
  return (
    <div className="fireworks" aria-hidden="true">
      {Array.from({ length: 32 }, (_, index) => (
        <span key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </div>
  )
}



export default App
