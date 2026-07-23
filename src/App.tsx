import { Fragment, lazy, Suspense, type ClipboardEvent as ReactClipboardEvent, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  ArrowUp,
  ArrowRightLeft,
  PanelRightClose,
  PanelRightOpen,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderKanban,
  Bot,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  LogOut,
  Maximize2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Info,
  Trash2,
  UserCircle,
  X,
  BookOpen,
  FileText as FileTextIcon,
  History,
  Globe,
  SlidersHorizontal,
  Star,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  appReleaseDate,
  appVersion,
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
  type AiLearningAction,
  type AiModelConfig,
  type AiModelEndpointConfig,
  type AiModelProvider,
  type AiModelRouteKey,
  type AiProviderConfig,
  type AttachmentNameSuggestion,
  type AuthRole,
  type BackendState,
  type DailyKnowledgeSuggestion,
  type HourEstimateSuggestion,
  type ReportRecord,
  type StorageUsage,
  type StoredAuth,
  type TaskAssistantSuggestion,
  type TaskProgressAssessment,
  type TextLearningContext,
  type TextAssistantSuggestion,
  type TokenScope,
  type VoiceScheduleResult,
  type OpenRouterFreeModel,
} from './lib/api'
import { DonutChart, type DonutChartItem } from './components/DonutChart'
import { TrendChart } from './components/TrendChart'
import { PlanDateTimeField } from './components/PlanDateTimeField'
import { ScheduleAnchorSwitch, VoiceScheduleButton } from './components/VoiceScheduleButton'
import { ModalShell } from './components/ModalShell'
import { CreateTaskContextMenu, TaskContextMenu } from './components/TaskContextMenu'
import { AdminLoginModal } from './components/AdminLoginModal'
import { DailyKnowledgeModal } from './components/DailyKnowledgeModal'
import { AiBrandIcon } from './components/AiBrandIcon'
import { ConfirmDialogModal, type ConfirmDialogState } from './components/ConfirmDialogModal'
import { VoidTaskModal } from './components/VoidTaskModal'
import { FilePreviewModal } from './components/FilePreviewModal'
import { AttachmentHoverThumbnail } from './components/AttachmentHoverThumbnail'
import { DashboardTaskSidebar } from './components/DashboardTaskSidebar'
import { TaskContextInsightBadge } from './components/TaskContextInsightBadge'
import { TaskDetailModal } from './components/TaskDetailModal'
import { MonthPicker } from './components/MonthPicker'
import { NewTaskDesignTypeSelector } from './components/NewTaskDesignTypeSelector'
import { PendingAttachmentPreview, PendingAttachmentThumbnail } from './components/PendingAttachmentPreview'
import { FileThumbnailPreview } from './components/FileThumbnailPreview'
import { CommandPalette, ImageLightbox, ShortcutHelpModal, type CommandPaletteAction, type ShortcutHelpGroup } from './components/CommandPalette'
import { ActiveTaskFilters, StatusBadge, TaskSearchBox } from './components/TaskUi'
import { EmptyState } from './components/EmptyState'
import { initializeGivernyTheme } from './lib/givernyTheme'
import { aiBrandForValue, type AiBrandKey } from './lib/aiBrands'
import { localCliBrowserDeviceKey, localCliRuntimeReady } from './lib/localCli'
import { monthLabelOf } from './lib/month'
import { formatFileSize } from './lib/format'
import { datePart, formatDurationZh, formatMonthDay, formatPlanDateTime, isoDate, isoDateTime, localDateFromIsoDate, monthPart, pad, planDateTimeFromMinuteStamp, toDateTimeInputValue } from './lib/dateTime'
import { addIsoDays } from './lib/calendar'
import { formatYuan, roundCents } from './lib/money'
import { fileThumbnailSource, fileTypeForAsset, fileTypeForFile, isInlineImageFileType } from './lib/fileTypes'
import { parseFileTags, serializeFileTags } from './lib/fileMetadata'
import { PDF_PREVIEW_TIMEOUT_MS, withPreviewTimeout } from './lib/previewTimeout'
import { taskSettlementMonth } from './lib/taskSettlement'
import {
  formatTaskActivityDateRange,
  formatTaskActivityTime,
  isTaskListBlankContextTarget,
  taskDueState,
} from './lib/taskListPresentation'
import {
  acceptanceProgressEndDateTime,
  dateTimeMinuteStamp,
  isSupplementalTask,
  isTaskBillable,
  minutesForTimeEntry,
  minutesForWaitingEntry,
  normalizeClockInput,
  sortTasksByLatestActivity,
  sumBillableAmountForMonth,
  sumTimeEntries,
  sumWaitingEntries,
  taskBillableHoursInMonth,
  taskHasMonthActivity,
  taskHoursInMonth,
  taskRelatedMonths,
  timeEntryMonth,
} from './lib/taskAccounting'
import { designTypeColorForIndex, validDesignTypeColor } from './lib/designTypes'
import { aiProviderOptions, aiRouteDefaults, providerSupportsVision } from './lib/aiProviders'
import { canRecordNewProgress, hasAcceptanceProgress, snapProgress, taskDisplayProgress } from './lib/taskProgress'
import { formatEntryDateTimeRange, formatWaitingEntryDateTimeRange, isAcceptanceFileAsset, partnerFacingText, sortTimeEntriesDesc } from './lib/taskPresentation'
import type { ReceiptExcelOptions } from './lib/receiptExcel'
import { SettlementReceipt } from './components/SettlementReceipt'
import { createPsdPreviewFile } from './lib/psdPreview'
import { createPdfPreviewFile } from './lib/pdfPreview'
import type { AppView, AttachmentAnalysis, FileAsset, IncomeDailyGroup, Task, TaskFeedbackRating, TaskFeedbackTag, TaskFilter, TaskStatus, TaskUpdate, TaskViewMode, TaxMode, TimeEntry, WaitingEntry } from './types/domain'
import type { AgentApproval, AgentApprovalStatus, AgentBackgroundTask, AgentConversationMessage, AgentConversationSummary, AgentResultAttachment, AgentTaskCandidate, AgentTaskMemory, AgentTaskPlan, AgentTaskSelection } from './types/agent'
import type { DailyKnowledgeItem } from './types/knowledge'
import type { PendingProgressAttachment, ProgressRecordMode, TaskContextInsight, TaskUpdateChanges } from './types/taskUi'
import type { SettingsTab } from './views/SettingsView'
import type { CalendarDisplayMode } from './views/CalendarView'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const SemanticSearchModal = lazy(() => import('./components/SemanticSearchModal'))
const KnowledgeView = lazy(() => import('./views/KnowledgeView'))
const FilesView = lazy(() => import('./views/FilesView'))
const IncomeView = lazy(() => import('./views/IncomeView'))
const ReportsView = lazy(() => import('./views/ReportsView'))
const InsightsView = lazy(() => import('./views/InsightsView'))
const SettingsView = lazy(() => import('./views/SettingsView'))
const TasksView = lazy(() => import('./views/TasksView'))
import microsoftExcelIcon from './assets/microsoft-excel.svg?url'
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

const dailyKnowledgePool: DailyKnowledgeItem[] = [
  {
    category: '人物・设计师',
    source: '原研哉',
    title: '把「空」做成一种设计',
    teaser: '留白不是没有内容，而是给观看者留下参与和想象的位置。',
    body: [
      '原研哉把 **Emptiness（空）** 理解为一种容器：它并不急着替用户说完所有话，而是让不同的人把自己的经验放进去。',
      '无印良品常用克制的图像、材料和文字建立这种空间。它不宣称“这样最好”，而是提供一种“这样就好”的平静感。',
      '在日常设计里，留白并不等于浪费版面。**真正有效的留白会帮助信息分级**，让标题、正文和操作各自拥有清晰的位置。',
    ],
  },
  {
    category: '视觉科学',
    source: '视觉科学',
    title: '为什么人眼对绿色格外敏感？',
    teaser: '黄绿色附近正处于人眼明视觉灵敏度的高峰区域。',
    body: [
      '人眼在明亮环境中的亮度感知峰值大约位于 **555nm**，接近黄绿色。因此在相同物理亮度下，绿色往往更容易被看见。',
      '医院手术服常使用青绿色，还有一个原因：长时间注视红色后容易产生互补色残像，绿色可以帮助缓解视觉疲劳。',
      '但高可见度不意味着应该大面积使用高饱和绿色。界面中的绿色更适合承担 **进度、确认和可操作提示**，背景则应保持克制。',
    ],
  },
  {
    category: '科普',
    source: '比例之美',
    title: '黄金比例并不是审美的法律',
    teaser: '1.618 是一种好用的比例工具，但并不会自动让作品变得高级。',
    body: [
      '黄金比例常被用于版面、网格和图形结构，因为它能形成一种 **不完全对称、又保持秩序** 的关系。',
      '许多著名建筑和绘画被事后套上黄金比例，但测量方式稍有变化，结论往往也会变化。',
      '设计中真正重要的仍是 **内容、层级和观看距离**。比例能辅助判断，却不能替代设计师对具体场景的观察。',
    ],
  },
  {
    category: '心理学',
    source: '认知偏差',
    title: '为什么高手常常更谦逊？',
    teaser: '知道得越多，越能看见自己尚未抵达的边界。',
    body: [
      '心理学中的 **达克效应** 提醒我们：能力尚不足时，人往往也缺少判断自身不足的参照，因此更容易高估自己。',
      '真正熟练的人见过更多路径、问题和失败案例，视野里反而会出现更多未知，所以判断会更谨慎。',
      '谦逊不是故作姿态，而是对复杂度有了更准确的感知。**先承认不知道，才有空间继续学习。**',
    ],
  },
  {
    category: '每天一本好书',
    source: '尤瓦尔・赫拉利',
    title: '小麦可能驯化了人类',
    teaser: '农业让粮食更多，也让许多人被固定在更漫长的劳动里。',
    body: [
      '《人类简史》提出了一个反直觉的观察：人类看似驯化了小麦，实际上却为了照顾小麦而 **定居、除草、劳作并不断增加人口**。',
      '从物种扩张看，农业非常成功；从单个人的日常幸福看，它却可能带来了更单调、更沉重的劳动。',
      '这个视角提醒我们，**效率和进步并不总是同义词**。判断一件事时，值得同时看系统收益与个体感受。',
    ],
  },
  {
    category: '历史・冷知识',
    source: '时间的褶皱',
    title: '牛津大学比阿兹特克帝国更早',
    teaser: '当牛津已授课两百多年，阿兹特克的都城才刚刚建立。',
    body: [
      '牛津大学约在 **1096 年** 便开始授课，而阿兹特克帝国的首都特诺奇蒂特兰大约在 **1325 年** 才建立。',
      '这类时间错位会打破我们对“古老”的直觉：同一段历史里，不同地区的文明进程并不总在同步发生。',
      '历史的魅力正在于这些褶皱。它提醒我们，**熟悉的时间线其实远比教科书里的直线复杂**。',
    ],
  },
  {
    category: '神话・哲学',
    source: '阿尔贝・加缪',
    title: '西西弗斯为什么可以幸福？',
    teaser: '意义不只在抵达山顶，也在清醒地走完每一次下山路。',
    body: [
      '在希腊神话里，西西弗斯被罚不断把巨石推上山顶，石头又会立刻滚回山脚。这象征着 **永远无法完成的劳动**。',
      '加缪却在《西西弗斯神话》中重新理解了他：当西西弗斯走下山去时，他清醒地知道自己的命运，也拥有了自己的意识。',
      '重复并不必然让人失去意义。重要的是在重复之中，仍能保留 **判断、节奏和一点属于自己的从容**。',
    ],
  },
  {
    category: '自然・植物',
    source: '草木观察',
    title: '红茶绿茶原来是一种叶子',
    teaser: '它们的差别不在树种，而在采摘后被氧化到了哪一步。',
    body: [
      '红茶、绿茶、乌龙茶都来自茶树。它们看起来截然不同，关键差别其实来自制作中对氧化过程的控制。',
      '绿茶在采下后很快杀青，保留清爽的草本气味；红茶充分氧化，颜色变深、口感也更醇厚；乌龙则停在中间。',
      '同一片叶子因为停在不同阶段，呈现出完全不同的性格。很多变化并不是换了材料，而是改变了过程。',
    ],
  },
  {
    category: '音乐・工艺',
    source: '克雷莫纳',
    title: '小提琴为什么会有天价？',
    teaser: '材料、气候、手艺与三百年的时间，共同构成了一把琴的声音。',
    body: [
      '斯特拉迪瓦里和瓜奈里的名琴出自十七至十八世纪的意大利克雷莫纳，许多至今仍被演奏家和收藏家珍视。',
      '关于独特音色的来源，研究者提出过木材密度、涂层化学和小冰期气候等解释，但没有单一答案能解释全部。',
      '极致作品往往不是某个秘诀的结果，而是材料、时代与人的长期协作。这种不可复制性本身就是工艺的价值。',
    ],
  },
  {
    category: '咖啡冷知识',
    source: '风味起源',
    title: '美式咖啡为什么叫美式？',
    teaser: '它据说来自美军把浓缩咖啡兑入热水的习惯。',
    body: [
      'Espresso 不是一种咖啡豆，而是一种高压萃取方式。细研磨咖啡粉在短时间内被热水穿过，得到浓缩而强烈的一小杯。',
      '二战时期，驻意大利的美军常觉得浓缩太浓，便加入热水稀释。意大利人把这种喝法称作 Americano。',
      '一杯饮品的名称，也会留下迁徙、战争与日常习惯的痕迹。食物和饮料往往是历史最轻盈的入口。',
    ],
  },
  {
    category: '世界未解之谜',
    source: '纳斯卡线条',
    title: '谁画下了巨大的纳斯卡线？',
    teaser: '荒漠中的蜂鸟和猴子图案，只有从高处才能看清全貌。',
    body: [
      '秘鲁南部荒漠保留着数百幅巨型地画，创作者移开表层深色砾石，让浅色地面构成蜂鸟、猴子和蜘蛛等图案。',
      '这些图案尺度很大，从地面难以辨识全貌，因此它们的用途至今仍有争议：可能和祭祀、水源或天文观测有关。',
      '人类常会为暂时看不见结果的事投入极大耐心。那些留给远方、未来或天空的作品，也是一种创造力。',
    ],
  },
  {
    category: '乐器科普',
    source: '声音原理',
    title: '钢琴为什么也算打击乐？',
    teaser: '琴键按下去的瞬间，真正发声的是小槌敲击琴弦。',
    body: [
      '钢琴常被放在键盘乐器里讨论，但从发声机制看，它也带着 **打击乐器** 的性格：手指按下琴键，小槌会击打琴弦。',
      '这也是钢琴能同时拥有清晰颗粒感和悠长共鸣的原因。它不是单纯拨弦，也不是持续拉弦，而是一次精确的敲击。',
      '有些事物的分类并不只有一个答案。换一个观察角度，熟悉的东西会露出另一套结构。',
    ],
  },
  {
    category: '冷笑话',
    source: '乙方词典',
    title: '“马上确认”到底有多马上？',
    teaser: '它可能是五分钟，也可能是五天，取决于对方突然忙不忙。',
    body: [
      '乙方词典里，“马上确认”是一种 **弹性时间单位**：短则一杯咖啡，长则跨过一个周末。',
      '“就改一个小地方”也类似。它听起来像局部修补，实际常常会牵动标题、留白、比例和导出规格。',
      '冷笑话的用处不是抱怨，而是提醒自己把等待记录下来。沉默不计费，但它确实占用了一段真实时间。',
    ],
  },
  {
    category: '名人介绍',
    source: '居里夫人',
    title: '居里夫人为什么拒绝专利？',
    teaser: '她把镭的提炼方法公开，让更多研究者能继续使用。',
    body: [
      '居里夫人和皮埃尔・居里发现镭之后，没有为提炼方法申请专利。他们认为科学成果应当 **服务公共研究**。',
      '这个选择让他们失去了可能的商业收入，却让实验室和医院更容易接触相关技术，推动了后续研究。',
      '一个人的价值判断，常常藏在“可以拿走但没有拿走”的地方。科学史里也有很多这样的安静决定。',
    ],
  },
  {
    category: '名画故事',
    source: '梵高',
    title: '《星月夜》不是安静的夜晚',
    teaser: '旋涡般的天空，来自疗养院窗口外的观察与想象。',
    body: [
      '梵高在圣雷米疗养院期间画下《星月夜》。画面里的村庄并非完全来自实景，而是 **观察、记忆和想象** 的混合。',
      '天空中的旋涡让夜晚像在流动，柏树则像火焰一样向上伸展。它不是宁静的风景，更像内心能量的外化。',
      '名画不一定只记录眼前所见。有时它真正保存的是一个人看世界时的强度。',
    ],
  },
  {
    category: '奇怪小知识',
    source: '生活物理',
    title: '纸为什么很难对折八次？',
    teaser: '厚度会指数级增长，手里的纸很快就不再像纸。',
    body: [
      '一张纸每对折一次，厚度都会翻倍。看似轻薄的纸，在几次折叠后会迅速变成 **越来越硬的厚块**。',
      '普通 A4 纸通常很难手工对折到八次以上，不只是因为面积变小，也因为折痕处需要克服更大的材料阻力。',
      '很多限制不是来自第一步，而是来自不断累积后的结构变化。小问题叠起来，常常会变成完全不同的问题。',
    ],
  },
  {
    category: '电影冷知识',
    source: '片场工具',
    title: '场记板不是只用来喊开始',
    teaser: '那一下清脆的合板声，是画面和声音同步的重要标记。',
    body: [
      '电影拍摄时，画面和声音常由不同设备记录。场记板合上的一瞬间，会留下清楚的视觉动作和声音峰值。',
      '后期剪辑时，剪辑师可以通过这两个信号对齐素材。那声“啪”其实是 **同步画面与声音** 的技术锚点。',
      '一些看起来很仪式化的小动作，背后往往是为了让复杂流程更稳定。',
    ],
  },
  {
    category: '小知识',
    source: '日用品来历',
    title: '便利贴来自一次失败胶水',
    teaser: '黏不牢的胶，后来变成了可以反复撕贴的工具。',
    body: [
      '3M 研究员曾做出一种黏性不强、却能反复贴上的胶。它一开始不像成功产品，更像一次 **不够完美的实验**。',
      '后来有人想到把它用于书签和便条，于是便利贴出现了。失败特性没有被消灭，而是换了一个合适场景。',
      '创新有时不是把缺点修掉，而是找到一个地方，让缺点变成刚刚好的优点。',
    ],
  },
  {
    category: '未解之谜',
    source: '深海声音',
    title: '海底传来的”Bloop”是什么？',
    teaser: '它曾被误认为神秘生物，后来被解释为冰裂声。',
    body: [
      '1997 年，美国海洋探测设备记录到一个极低频、传播距离很远的声音，后来被称为 Bloop。',
      '它一度激发许多猜测：有人想象它来自未知巨型生物。后续研究更倾向认为，它是 **冰山破裂或摩擦** 产生的声音。',
      '未解之谜吸引人的地方，不只是答案神秘，也在于它让我们意识到世界还有很多尺度超出日常经验。',
    ],
  },
  {
    category: '世界未解之谜',
    source: '百慕大三角',
    title: '百慕大三角真的更危险吗？',
    teaser: '数据显示它并不比其他繁忙航线更危险，但传说已经深入人心。',
    body: [
      '百慕大三角位于佛罗里达、百慕大和波多黎各之间，数十年来与船只和飞机失踪的故事紧密绑定。',
      '然而，当研究者对比世界各地航线的事故数据后，**这片区域并没有统计上的异常**。它只是一条繁忙的交通要道。',
      '许多”神秘失踪”案例在重新梳理后，都能找到天气、导航错误或人为因素的解释。集中讲述一个地方的故事，会让普通事件看起来不寻常。',
    ],
  },
  {
    category: '历史・冷知识',
    source: '拿破仑身高',
    title: '拿破仑其实不矮',
    teaser: '他被叫做小个子，很可能是一场英国宣传战的遗产。',
    body: [
      '拿破仑的身高约 1.68 米，在 19 世纪法国男性中属于中等偏上。但英国漫画家将他画得很矮小，配合夸张的表情，讽刺效果极强。',
      '这些形象广泛流传，以至于后人真的以为他是个矮子。这是历史上 **宣传战改写形象** 的典型案例。',
      '我们接收到的许多”事实”，在第一次传播时就已经带有目的。历史印象值得多问一句：这个故事最初是谁讲的？',
    ],
  },
  {
    category: '商业故事',
    source: '耐克',
    title: 'Nike 的”√”只花了 35 美元',
    teaser: '世界上最著名的商标之一，来自一个大学生的课堂作业。',
    body: [
      '1971 年，耐克创始人菲尔·奈特委托设计系学生卡洛琳·戴维森设计一个标志，预算极为有限，最终支付了 35 美元。',
      '那个向右扬起的”√”形——Swoosh——后来成为全球最知名的品牌符号之一。卡洛琳后来也获得了额外的股票作为补偿。',
      '创意的价值很难在诞生之初就被准确评估。有些作品之所以伟大，是因为它遇见了合适的时代和产品。',
    ],
  },
  {
    category: '科技冷知识',
    source: 'GPS',
    title: 'GPS 卫星每天都在”说谎”',
    teaser: '如果不修正相对论效应，你的导航会每天偏移 10 公里。',
    body: [
      'GPS 卫星在高空高速运动，根据相对论，它们的时钟比地面走得略快。这个误差看似微小，但累积一天后会导致 **定位偏差约 10 公里**。',
      '工程师在卫星出发前就对时钟做了预置调慢，让它在轨道上运行时”刚好正确”。爱因斯坦的方程式因此悄悄进入了每一次导航。',
      '物理学并不总是存在于实验室里。它在你每次打开地图时就已经在运作了。',
    ],
  },
  {
    category: '动物冷知识',
    source: '章鱼研究',
    title: '章鱼有三个心脏和蓝色血液',
    teaser: '它的血液用铜而不是铁来携带氧气，因此是蓝色的。',
    body: [
      '章鱼拥有三个心脏：两个负责把血液泵向鳃，一个负责向全身供血。当它游泳时，主心脏会停跳，所以它们不喜欢长途游动。',
      '它的血液含有 **血蓝蛋白**，用铜原子来结合氧气，这让血液在氧合状态下呈蓝色。人类血液用铁来结合氧，因此是红色的。',
      '进化给出了不止一种解决方案。我们习以为常的结构，换一种生命形式就完全不同了。',
    ],
  },
  {
    category: '心理学',
    source: '峰终定律',
    title: '人记住的不是全程，而是最高点和结尾',
    teaser: '这解释了为什么旅行的最后一天很重要。',
    body: [
      '心理学家卡尼曼提出了 **峰终定律**：人们对一段体验的记忆，主要由两个时刻决定——情绪最强烈的峰值时刻，以及体验结束时的感受。',
      '过程有多漫长、大部分时间有多平淡，对记忆的影响反而有限。这也是为什么差评常常来自最后一次互动体验不佳。',
      '如果你想让别人对一段经历留下好印象，最值得用心的不是全程均衡，而是 **制造一个令人难忘的高点，并以好的方式结束**。',
    ],
  },
  {
    category: '爱情故事',
    source: '克里奥帕特拉',
    title: '埃及艳后不是埃及人',
    teaser: '她是希腊裔，却是第一个真正学会古埃及语的托勒密王朝法老。',
    body: [
      '克里奥帕特拉七世出身于亚历山大大帝去世后建立的托勒密王朝，家族实际上是马其顿希腊裔。她之前的历代法老都不学埃及语，只说希腊语。',
      '她却精通至少九种语言，包括古埃及语、阿拉伯语、希伯来语等，这让她能与各国使节直接交流。与凯撒和马克·安东尼的关系，也与她的外交才能密不可分。',
      '历史上的传奇人物，往往有一项被忽视的普通才能：极度努力地工作和学习。',
    ],
  },
  {
    category: '食物史',
    source: '番茄旅程',
    title: '番茄曾在欧洲被当毒药',
    teaser: '它原产南美洲，传入欧洲后用了两百年才被接受为食物。',
    body: [
      '番茄在 16 世纪随殖民者传入欧洲，但因为属于颠茄科，外观又鲜艳，欧洲人长期把它当作观赏植物或毒草。',
      '有贵族用锡制餐具吃番茄后中毒，但原因是 **锡中的铅被番茄的酸性析出**，并非番茄本身有毒。穷人用木制餐具吃，反而安然无事。',
      '偏见和误解常常有一个”不完全错误”的起源。理解它的来历，比直接否定它更有意义。',
    ],
  },
  {
    category: '语言・文化',
    source: '汉字来历',
    title: '为什么”东西”可以表示”物品”？',
    teaser: '一个常见的说法把它和集市的方位联系在一起。',
    body: [
      '汉语里用”东西”来指代一切物品，这个用法流传已久，来历众说纷纭。',
      '流传较广的一种说法是：古代长安有东市和西市，买卖物品都集中在这两个方向的市场里。去买东西，慢慢就代指了买卖行为本身，进而代指物品。',
      '语言里的词语，像化石一样保存着历史的痕迹。很多我们每天说的话，背后藏着已经消失的场景。',
    ],
  },
  {
    category: '体育冷知识',
    source: '马拉松',
    title: '马拉松 42.195 公里从哪来的？',
    teaser: '这个奇怪的数字源自 1908 年英国王室的一个临时请求。',
    body: [
      '马拉松项目在 1896 年首届现代奥运会时约为 40 公里，并不统一。直到 1908 年伦敦奥运会，距离才被固定下来。',
      '当时的路线设计本为 26 英里（约 42 公里），但为了让终点对准王室包厢，**路线被调整延长了 385 码**，也就是约 352 米。这个”将就”的数字就此沿用下来。',
      '很多我们视为标准的东西，都来自某个历史瞬间的偶然妥协。',
    ],
  },
  {
    category: '天文小知识',
    source: '光的旅程',
    title: '我们看到的太阳，是 8 分钟前的太阳',
    teaser: '光从太阳到地球需要大约 8 分 20 秒。',
    body: [
      '光在真空中的速度约为每秒 30 万公里，但太阳距地球约 1.5 亿公里，所以阳光抵达地球需要大约 **8 分 20 秒**。',
      '这意味着我们永远看不到”现在”的太阳——而是 8 分钟之前的它。如果太阳此刻消失，我们还要再过 8 分多钟才会察觉。',
      '宇宙的尺度让”现在”变得复杂。我们仰望星空时，看到的是光出发时那一刻，而不是它到达时的样子。',
    ],
  },
  {
    category: '金融冷知识',
    source: '信用卡历史',
    title: '信用卡诞生于一次忘带现金的尴尬',
    teaser: '1950 年，一位商人餐后发现没带钱包，由此催生了第一张通用信用卡。',
    body: [
      '弗兰克·麦克纳马拉在纽约请客吃饭，结账时发现钱包忘在家里，场面相当难堪。这件事让他萌生了一个想法：用一张卡片来代替现金。',
      '1950 年，他和合伙人创立了 **大莱俱乐部卡（Diners Club）**，最初只被 27 家餐厅接受，持卡人仅 200 人左右。',
      '一次社交上的尴尬，推动了改变整个消费金融体系的发明。很多大事的起点，都比想象中普通。',
    ],
  },
  {
    category: '考古发现',
    source: '庞贝古城',
    title: '庞贝人留下的最后一顿饭',
    teaser: '火山灰封存了一座城市，也封存了一个普通早晨的细节。',
    body: [
      '公元 79 年，维苏威火山爆发，将庞贝城覆盖在厚厚的火山灰之下。这场灾难同时也成为一次无意的”封存”——街道、壁画、食物，甚至面包炉里的碳化面包都保留下来了。',
      '考古学家发现了快餐店（thermopolium）遗址，里面有用于盛汤和热食的陶罐凹槽。人们在这里买现做的食物，类似今天的外卖窗口。',
      '历史不总是由大事件组成的。**那些保留下来的普通早晨，让两千年前的生活变得具体可感。**',
    ],
  },
  {
    category: '治愈系',
    source: '小事的力量',
    title: '为什么整理书桌会让人感觉好一点？',
    teaser: '控制小事，能在混乱中找到一点可以掌控的感觉。',
    body: [
      '当生活里有很多无法控制的事情时，人们常常会去做一件很小但能完全掌控的事——整理一个角落、叠好一件衣服、清洗一个杯子。',
      '心理学上这叫 **补偿性控制**：通过掌控小事，恢复一点对生活的掌控感。这不是逃避，而是一种低成本的自我调节。',
      '不需要等到状态好了再行动。行动本身就会带来一点好转。',
    ],
  },
]

const dailyKnowledgeHistoryKey = 'giverny-daily-knowledge-history-v1'
const dailyKnowledgeCurrentKey = 'giverny-daily-knowledge-current-v1'
const dailyKnowledgeQueueKey = 'giverny-daily-knowledge-queue-v1'
const dailyKnowledgeQueueSize = 10

function isDailyKnowledgeItem(value: unknown): value is DailyKnowledgeItem {
  const item = value as Partial<DailyKnowledgeItem> | null
  return Boolean(
    item
    && typeof item.category === 'string'
    && typeof item.source === 'string'
    && typeof item.title === 'string'
    && typeof item.teaser === 'string'
    && Array.isArray(item.body)
    && item.body.length > 0,
  )
}

function readDailyKnowledgeHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dailyKnowledgeHistoryKey) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function rememberDailyKnowledgeTitle(title: string) {
  const history = readDailyKnowledgeHistory().filter((item) => item !== title)
  window.localStorage.setItem(dailyKnowledgeHistoryKey, JSON.stringify([...history, title].slice(-80)))
}

function readStoredDailyKnowledgeItem() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dailyKnowledgeCurrentKey) ?? 'null') as unknown
    return isDailyKnowledgeItem(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStoredDailyKnowledgeItem(item: DailyKnowledgeItem) {
  try {
    window.localStorage.setItem(dailyKnowledgeCurrentKey, JSON.stringify(item))
  } catch {
    // localStorage may be unavailable in private mode; losing the cache only affects variety after refresh.
  }
}

function readStoredDailyKnowledgeQueue() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dailyKnowledgeQueueKey) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter(isDailyKnowledgeItem) : []
  } catch {
    return []
  }
}

function writeStoredDailyKnowledgeQueue(items: DailyKnowledgeItem[]) {
  try {
    window.localStorage.setItem(dailyKnowledgeQueueKey, JSON.stringify(items.slice(0, dailyKnowledgeQueueSize)))
  } catch {
    // Best-effort cache only.
  }
}

function fallbackDailyKnowledge(excludedTitles: string | string[] = '') {
  const excludedList = Array.isArray(excludedTitles) ? excludedTitles.filter(Boolean) : [excludedTitles].filter(Boolean)
  const excluded = new Set(excludedList)
  const candidates = dailyKnowledgePool.filter((item) => !excluded.has(item.title))
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
  const history = readDailyKnowledgeHistory()
  const currentTitle = excludedList[0] ?? ''
  const leastRecent = dailyKnowledgePool
    .filter((item) => item.title !== currentTitle)
    .sort((left, right) => history.indexOf(left.title) - history.indexOf(right.title))
  const pool = leastRecent.length > 0 ? leastRecent.slice(0, Math.max(1, Math.ceil(leastRecent.length / 3))) : dailyKnowledgePool
  return pool[Math.floor(Math.random() * pool.length)]
}

function fallbackDailyKnowledgeBatch(count: number, excludedTitles: string[] = []) {
  const items: DailyKnowledgeItem[] = []
  const excluded = new Set(excludedTitles)
  let attempts = 0
  while (items.length < count && attempts < dailyKnowledgePool.length * 3) {
    attempts += 1
    const next = fallbackDailyKnowledge([...excluded])
    if (excluded.has(next.title)) {
      break
    }
    items.push(next)
    excluded.add(next.title)
  }
  return items
}

function mergeDailyKnowledgeQueue(items: DailyKnowledgeItem[], excludedTitles: string[] = []) {
  const excluded = new Set(excludedTitles)
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.title || excluded.has(item.title) || seen.has(item.title)) {
      return false
    }
    seen.add(item.title)
    return true
  })
}

function prepareDailyKnowledgeSession() {
  const history = readDailyKnowledgeHistory()
  const storedCurrent = readStoredDailyKnowledgeItem()
  const storedQueue = mergeDailyKnowledgeQueue(readStoredDailyKnowledgeQueue(), [storedCurrent?.title ?? '', ...history])
  const [queuedCurrent, ...remainingQueue] = storedQueue
  if (queuedCurrent) {
    return {
      current: queuedCurrent,
      queue: remainingQueue,
    }
  }
  const current = fallbackDailyKnowledge([storedCurrent?.title ?? '', ...history])
  return {
    current,
    queue: fallbackDailyKnowledgeBatch(dailyKnowledgeQueueSize, [current.title, storedCurrent?.title ?? '', ...history]),
  }
}

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

function addMinutesToPlanDateTime(value: string, minutes: number) {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  date.setMinutes(date.getMinutes() + minutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const TIME_STEP_MINUTES = 5   // 时间选择器分钟列步进（5分钟）
const DURATION_STEP_MINUTES = 30  // 工时输入最小粒度（30分钟 = 0.5h）
const ESTIMATED_HOURS_STEP_MINUTES = 1 // 新建任务支持直接输入分钟，按 1 分钟精度保存

function formatEstimatedDurationInputValue(minutes: number) {
  return formatDurationZh(Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round(minutes)))
}

function parseEstimatedDurationInputMinutes(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
  if (!normalized) return null

  // Backward compatibility: a bare number continues to mean decimal hours.
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const hours = Number(normalized)
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null
  }

  const clockMatch = normalized.match(/^(\d+):([0-5]?\d)$/)
  if (clockMatch) {
    return Number(clockMatch[1]) * 60 + Number(clockMatch[2])
  }

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)(?:小时|时|hours?|hrs?|h)/)
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)(?:分钟|分|minutes?|mins?|m)/)
  if (!hourMatch && !minuteMatch) return null

  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0
  const totalMinutes = Math.round(hours * 60 + minutes)
  return Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : null
}

function normalizeEstimatedMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return ESTIMATED_HOURS_STEP_MINUTES
  }
  return Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round(value / ESTIMATED_HOURS_STEP_MINUTES) * ESTIMATED_HOURS_STEP_MINUTES)
}

function exactDurationMinutesBetween(startValue: string, endValue: string) {
  const startTime = new Date(startValue).getTime()
  const endTime = new Date(endValue).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 0
  }
  return Math.round((endTime - startTime) / 60000)
}

function withDatePart(value: string, nextDate: string) {
  if (!value || !nextDate) {
    return value
  }
  const normalized = toDateTimeInputValue(value)
  return `${nextDate}T${normalized.slice(11, 16)}`
}

function snapPlanDateTime(value: string, direction: 'nearest' | 'up' | 'down' = 'nearest') {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const totalMinutes = date.getHours() * 60 + date.getMinutes()
  const quotient = totalMinutes / TIME_STEP_MINUTES
  const snappedTotal = direction === 'up'
    ? Math.ceil(quotient) * TIME_STEP_MINUTES
    : direction === 'down'
      ? Math.floor(quotient) * TIME_STEP_MINUTES
      : Math.round(quotient) * TIME_STEP_MINUTES
  date.setHours(0, snappedTotal, 0, 0)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type ScheduleAnchor = 'start' | 'hours' | 'end'

// 把 PDF 第一页渲染成 PNG 预览图，便于进展/验收附件直接显示缩略图（而不是「PDF」文字角标）
// 新建任务时，就地从甲方文案附件抽取纯文本（Word/PDF/txt），喂给「任务需求」AI。
// 任务尚未创建、没有 taskId，所以在浏览器本地抽取，不走上传。
const ATTACHMENT_TEXT_LIMIT = 16000

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

async function extractAttachmentText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || file.type.startsWith('text/')) {
    return (await file.text()).slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.docx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) {
      return ''
    }
    const withBreaks = docXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
    return decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ''))
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.pdf')) {
    const data = await file.arrayBuffer()
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const doc = await pdfjs.getDocument({ data }).promise
    const maxPages = Math.min(doc.numPages, 20)
    const parts: string[] = []
    for (let i = 1; i <= maxPages; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  if (name.endsWith('.pptx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => {
        const na = Number(a.match(/\d+/)?.[0] ?? 0)
        const nb = Number(b.match(/\d+/)?.[0] ?? 0)
        return na - nb
      })
    const parts: string[] = []
    for (const path of slideFiles) {
      const xml = await zip.file(path)?.async('string') ?? ''
      const withBreaks = xml.replace(/<\/a:p>/g, '\n').replace(/<\/a:r>/g, ' ')
      const text = decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim()
      if (text) parts.push(text)
    }
    return parts.join('\n\n').slice(0, ATTACHMENT_TEXT_LIMIT)
  }
  // .doc/.ppt（旧二进制）等无法可靠在前端解析
  return ''
}

async function createTextPreviewFile(fileName: string, text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 420
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.fillStyle = '#fbfbf7'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#2f3a37'
  context.font = '600 28px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  context.fillText(splitFileName(fileName).base.slice(0, 18), 38, 58)
  context.fillStyle = '#8c9895'
  context.font = '500 18px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  context.fillText(splitFileName(fileName).extension.replace('.', '').toUpperCase() || 'TEXT', 38, 90)
  context.strokeStyle = '#e3e7e2'
  context.beginPath()
  context.moveTo(38, 118)
  context.lineTo(562, 118)
  context.stroke()

  context.fillStyle = '#46524f'
  context.font = '22px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  const normalized = text.replace(/\s+/g, ' ').trim()
  const lines: string[] = []
  let cursor = normalized
  while (cursor && lines.length < 8) {
    let end = Math.min(cursor.length, 22)
    while (end < cursor.length && context.measureText(cursor.slice(0, end)).width < 500) {
      end += 1
    }
    lines.push(cursor.slice(0, end).trim())
    cursor = cursor.slice(end).trim()
  }
  lines.forEach((line, index) => context.fillText(line, 38, 158 + index * 34))
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob) {
    return undefined
  }
  return new File([blob], `${splitFileName(fileName).base || 'attachment'}-preview.png`, { type: 'image/png' })
}

// 把视频首帧渲染成 PNG 预览图（MP4 / MOV / WebM 等）
async function createVideoPreviewFile(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('视频加载失败'))
    })
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
      } catch {
        resolve()
      }
      setTimeout(() => resolve(), 1200)
    })
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      return undefined
    }
    const scale = Math.min(1, 600 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
    if (!blob) {
      return undefined
    }
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}-preview.png`, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 把离屏渲染好的 DOM 栅格化成 PNG 预览；空白/过小则放弃（回退到类型角标）
async function rasterizeElementToPreviewFile(target: HTMLElement, baseName: string, options?: { width?: number; height?: number }) {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(target, {
    backgroundColor: '#ffffff',
    scale: 1,
    logging: false,
    useCORS: true,
    width: options?.width,
    height: options?.height,
    windowWidth: options?.width ?? target.scrollWidth ?? 960,
  })
  if (canvas.width < 8 || canvas.height < 8) {
    return undefined
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob || blob.size < 300) {
    return undefined
  }
  return new File([blob], `${baseName}-preview.png`, { type: 'image/png' })
}

// Word / PPT / Excel 缩略图：用现有预览库离屏渲染首页 / 首张幻灯片 / 首个工作表，再栅格化为图片
async function createOfficePreviewFile(file: File, fileType: 'DOCX' | 'PPTX' | 'XLSX') {
  const buffer = await file.arrayBuffer()
  const base = file.name.replace(/\.[^.]+$/, '')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;background:#ffffff;z-index:-1;overflow:hidden;'
  document.body.appendChild(host)
  try {
    if (fileType === 'DOCX') {
      host.style.width = '794px'
      const { renderAsync } = await import('docx-preview')
      await renderAsync(buffer, host, undefined, { className: 'docx-preview-document', inWrapper: true, breakPages: true, useBase64URL: true })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const page = (host.querySelector('section') as HTMLElement | null) ?? host
      const fullHeight = page.offsetHeight || 1123
      return await rasterizeElementToPreviewFile(page, base, { width: 794, height: Math.min(fullHeight, 1123) })
    }
    if (fileType === 'PPTX') {
      host.style.width = '960px'
      host.style.height = '540px'
      const { init } = await import('pptx-preview')
      const previewer = init(host, { width: 960, height: 540 })
      await previewer.preview(buffer)
      await new Promise((resolve) => setTimeout(resolve, 500))
      return await rasterizeElementToPreviewFile(host, base, { width: 960, height: 540 })
    }
    // XLSX：自建首个工作表的表格再栅格化，稳定可控
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) {
      return undefined
    }
    host.style.width = '900px'
    host.style.padding = '18px'
    host.style.fontFamily = '-apple-system, "PingFang SC", "Segoe UI", sans-serif'
    const table = document.createElement('table')
    table.style.cssText = 'border-collapse:collapse;font-size:13px;color:#1f2a27;'
    let rowCount = 0
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 22) {
        return
      }
      rowCount += 1
      const tr = document.createElement('tr')
      const values = Array.isArray(row.values) ? row.values.slice(1, 11) : []
      const cellCount = Math.max(values.length, 1)
      for (let index = 0; index < cellCount; index += 1) {
        const isHead = rowNumber === 1
        const cell = document.createElement(isHead ? 'th' : 'td')
        cell.textContent = stringifyCellValue(values[index]).slice(0, 30)
        cell.style.cssText = `border:1px solid #e3e3dd;padding:6px 10px;text-align:left;white-space:nowrap;${isHead ? 'background:#f4f4ee;font-weight:600;' : ''}`
        tr.appendChild(cell)
      }
      table.appendChild(tr)
    })
    if (rowCount === 0) {
      return undefined
    }
    host.appendChild(table)
    await new Promise((resolve) => setTimeout(resolve, 150))
    return await rasterizeElementToPreviewFile(host, base, { width: host.offsetWidth || 900 })
  } catch (error) {
    console.warn('office preview generation failed', fileType, error)
    return undefined
  } finally {
    host.remove()
  }
}

async function createOptionalPreviewFile(file: File) {
  const inferred = fileTypeForFile(file)
  try {
    if (inferred.kind === 'psd') {
      return await createPsdPreviewFile(file)
    }
    if (inferred.kind === 'pdf') {
      return await withPreviewTimeout(createPdfPreviewFile(file), PDF_PREVIEW_TIMEOUT_MS, 'PDF 首页渲染超时')
    }
    if (inferred.kind === 'video') {
      return await createVideoPreviewFile(file)
    }
    if (inferred.type === 'DOCX') {
      return await createOfficePreviewFile(file, 'DOCX')
    }
    if (inferred.type === 'PPTX') {
      return await createOfficePreviewFile(file, 'PPTX')
    }
    if (inferred.type === 'XLSX') {
      return await createOfficePreviewFile(file, 'XLSX')
    }
  } catch (error) {
    console.warn('preview generation failed', error)
  }
  return undefined
}

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN')
  }
  if (typeof value === 'object') {
    const maybeFormula = value as { result?: unknown; text?: string; richText?: { text?: string }[]; hyperlink?: string }
    if (maybeFormula.result !== undefined) {
      return stringifyCellValue(maybeFormula.result)
    }
    if (maybeFormula.text) {
      return maybeFormula.text
    }
    if (Array.isArray(maybeFormula.richText)) {
      return maybeFormula.richText.map((item) => item.text ?? '').join('')
    }
    if (maybeFormula.hyperlink) {
      return maybeFormula.hyperlink
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// 大文件会自动拆成 8MB 分片写入 R2，不受 Worker 单次请求体 100MB 限制。
const UPLOAD_HARD_LIMIT = 200 * 1024 * 1024
const UPLOAD_SOFT_LIMIT = 50 * 1024 * 1024

type AcceptancePayload = {
  actualHours: number
  acceptanceNote: string
  feedbackRating?: TaskFeedbackRating | ''
  feedbackTags?: TaskFeedbackTag[]
  feedbackNote?: string
  timeEntries: TimeEntry[]
  waitingEntries?: WaitingEntry[]
  acceptanceFiles?: string[]
  taskChanges?: Partial<Pick<Task, 'title' | 'type' | 'contact' | 'requester' | 'reviewer' | 'requirement' | 'date' | 'estimatedDate' | 'estimatedHours' | 'progress'>>
}

type AiLearningDraft = {
  sourceInput: string
  aiOutput: string
  applied: boolean
}

type HourEstimateFeedbackRating = 'too_low' | 'accurate' | 'too_high'

const hourEstimateFeedbackOptions: Array<{ value: HourEstimateFeedbackRating; label: string }> = [
  { value: 'too_low', label: '偏低' },
  { value: 'accurate', label: '合适' },
  { value: 'too_high', label: '偏高' },
]

const hourEstimateFeedbackReasons = ['交付数量', '尺寸适配', '内容整理', '专项处理', '沟通改稿', '参考样本']
function aiLearningAction(draft: AiLearningDraft, userFinal: string): AiLearningAction {
  const normalizedFinal = userFinal.trim()
  if (normalizedFinal === draft.aiOutput.trim()) {
    return 'adopted'
  }
  if (normalizedFinal === draft.sourceInput.trim()) {
    return 'rejected'
  }
  return 'edited'
}

function validateUploadFile(file: File) {
  if (file.size > UPLOAD_HARD_LIMIT) {
    throw new Error(`「${file.name}」超过 ${(UPLOAD_HARD_LIMIT / 1024 / 1024).toFixed(0)}MB，无法上传`)
  }
  if (file.size > UPLOAD_SOFT_LIMIT) {
    return true
  }
  return false
}

const progressAttachmentDraftCache = new Map<string, PendingProgressAttachment[]>()
// 同一份草稿（task+mode+entry）复用同一个 entryId，保证「关闭后重开再保存」时
// 预上传文件仍能正确挂到最终生成的进展条目上。
const stagedEntryIdCache = new Map<string, string>()

function splitFileName(value: string) {
  const trimmed = value.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return { base: trimmed, extension: '' }
  }
  return { base: trimmed.slice(0, dotIndex), extension: trimmed.slice(dotIndex) }
}

function sanitizeAttachmentName(value: string, fallbackName: string) {
  const fallback = splitFileName(fallbackName)
  const candidate = splitFileName(value)
  const base = candidate.base
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/g, '')
    .trim()
    .slice(0, 90)
  const extension = fallback.extension || candidate.extension
  return `${base || fallback.base || '过程附件'}${extension}`
}

function renamedFile(file: File, name: string) {
  const normalizedName = sanitizeAttachmentName(name, file.name)
  return normalizedName === file.name
    ? file
    : new File([file], normalizedName, { type: file.type, lastModified: file.lastModified })
}

function pastedImageName(file: File) {
  const now = new Date()
  const extension = splitFileName(file.name).extension || (file.type === 'image/jpeg' ? '.jpg' : '.png')
  return `粘贴截图_${isoDate()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}${extension}`
}

function looksLikeUntidyFileName(value: string) {
  const base = splitFileName(value).base.toLowerCase()
  return /^(img|dsc|pxl|screenshot|screen shot|截屏|截图|微信图片|ishot)[-_ ]?\d*/i.test(base)
    || /^\d{8,}$/.test(base.replace(/\D/g, ''))
    || /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(base)
}

async function imageFileBase64(file: File) {
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
    return ''
  }
  const dataUrl = await blobBase64(file)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

type PreparedImageFiles = { uploadFile: File; previewFile?: File }

const IMAGE_ARCHIVE_MAX_SIDE = 2400
const IMAGE_THUMBNAIL_MAX_SIDE = 480
const IMAGE_OPTIMIZATION_WORKER_SOURCE = `
let queue = Promise.resolve();
const render = async (bitmap, maxSide, type, quality) => {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type, quality });
};
const processImage = async ({ id, file }) => {
  const bitmap = await createImageBitmap(file);
  try {
    const compressible = /image\\/(jpeg|jpg|png|webp)/i.test(file.type);
    const archiveType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const shouldOptimize = compressible && (file.size >= 900 * 1024 || Math.max(bitmap.width, bitmap.height) > ${IMAGE_ARCHIVE_MAX_SIDE});
    const uploadBlob = shouldOptimize ? await render(bitmap, ${IMAGE_ARCHIVE_MAX_SIDE}, archiveType, 0.86) : null;
    const previewBlob = await render(bitmap, ${IMAGE_THUMBNAIL_MAX_SIDE}, 'image/jpeg', 0.78);
    self.postMessage({ id, uploadBlob: uploadBlob && uploadBlob.size < file.size ? uploadBlob : null, previewBlob });
  } finally {
    bitmap.close();
  }
};
self.onmessage = (event) => {
  queue = queue.then(() => processImage(event.data)).catch((error) => {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Image optimization failed' });
  });
};
`

let imageOptimizationWorker: Worker | null = null
let imageOptimizationRequestId = 0
const imageOptimizationRequests = new Map<number, {
  resolve: (value: { uploadBlob?: Blob; previewBlob?: Blob }) => void
  reject: (reason?: unknown) => void
}>()
let mainThreadImageOptimizationQueue: Promise<void> = Promise.resolve()

function getImageOptimizationWorker() {
  if (imageOptimizationWorker) return imageOptimizationWorker
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null
  const workerUrl = URL.createObjectURL(new Blob([IMAGE_OPTIMIZATION_WORKER_SOURCE], { type: 'text/javascript' }))
  const worker = new Worker(workerUrl)
  window.setTimeout(() => URL.revokeObjectURL(workerUrl), 0)
  worker.onmessage = (event: MessageEvent<{ id: number; uploadBlob?: Blob; previewBlob?: Blob; error?: string }>) => {
    const request = imageOptimizationRequests.get(event.data.id)
    if (!request) return
    imageOptimizationRequests.delete(event.data.id)
    if (event.data.error) {
      request.reject(new Error(event.data.error))
      return
    }
    request.resolve(event.data)
  }
  worker.onerror = (event) => {
    imageOptimizationRequests.forEach((request) => request.reject(new Error(event.message || '图片后台优化失败')))
    imageOptimizationRequests.clear()
    worker.terminate()
    imageOptimizationWorker = null
  }
  imageOptimizationWorker = worker
  return worker
}

async function renderImageBitmapBlob(bitmap: ImageBitmap, maxSide: number, type: string, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), type, quality))
}

async function prepareImageOnMainThread(file: File): Promise<PreparedImageFiles> {
  const bitmap = await createImageBitmap(file)
  try {
    const compressible = /image\/(jpeg|jpg|png|webp)/i.test(file.type)
    const archiveType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const shouldOptimize = compressible && (file.size >= 900 * 1024 || Math.max(bitmap.width, bitmap.height) > IMAGE_ARCHIVE_MAX_SIDE)
    const uploadBlob = shouldOptimize ? await renderImageBitmapBlob(bitmap, IMAGE_ARCHIVE_MAX_SIDE, archiveType, 0.86) : undefined
    const previewBlob = await renderImageBitmapBlob(bitmap, IMAGE_THUMBNAIL_MAX_SIDE, 'image/jpeg', 0.78)
    return {
      uploadFile: uploadBlob && uploadBlob.size < file.size
        ? new File([uploadBlob], file.name, { type: uploadBlob.type, lastModified: file.lastModified })
        : file,
      previewFile: previewBlob
        ? new File([previewBlob], `${splitFileName(file.name).base || '附件'}-thumbnail.jpg`, { type: 'image/jpeg' })
        : undefined,
    }
  } finally {
    bitmap.close()
  }
}

async function prepareImageFiles(file: File): Promise<PreparedImageFiles> {
  if (!file.type.startsWith('image/')) return { uploadFile: file }
  const worker = getImageOptimizationWorker()
  if (worker) {
    try {
      const id = ++imageOptimizationRequestId
      const result = await new Promise<{ uploadBlob?: Blob; previewBlob?: Blob }>((resolve, reject) => {
        imageOptimizationRequests.set(id, { resolve, reject })
        worker.postMessage({ id, file })
      })
      return {
        uploadFile: result.uploadBlob
          ? new File([result.uploadBlob], file.name, { type: result.uploadBlob.type, lastModified: file.lastModified })
          : file,
        previewFile: result.previewBlob
          ? new File([result.previewBlob], `${splitFileName(file.name).base || '附件'}-thumbnail.jpg`, { type: 'image/jpeg' })
          : undefined,
      }
    } catch (error) {
      console.warn('image worker optimization failed, using queued fallback', file.name, error)
    }
  }
  const fallback = mainThreadImageOptimizationQueue
    .then(() => new Promise<void>((resolve) => window.setTimeout(resolve, 0)))
    .then(() => prepareImageOnMainThread(file))
  mainThreadImageOptimizationQueue = fallback.then(() => undefined, () => undefined)
  return fallback.catch((error) => {
    console.warn('image main-thread optimization failed, using original file', file.name, error)
    return { uploadFile: file }
  })
}

function ensurePendingAttachmentPreparation(attachment: PendingProgressAttachment): Promise<PreparedImageFiles> {
  if (!attachment.file.type.startsWith('image/')) return Promise.resolve({ uploadFile: attachment.file })
  if (attachment.optimizedFile) {
    return Promise.resolve({ uploadFile: attachment.optimizedFile, previewFile: attachment.previewFile })
  }
  if (attachment.preparationPromise) return attachment.preparationPromise
  const preparationPromise = prepareImageFiles(attachment.file).then((prepared) => {
    attachment.optimizedFile = prepared.uploadFile
    attachment.previewFile = prepared.previewFile
    return prepared
  })
  attachment.preparationPromise = preparationPromise
  return preparationPromise
}

async function ensurePendingAttachmentPreview(attachment: PendingProgressAttachment) {
  return (await ensurePendingAttachmentPreparation(attachment)).previewFile
}

async function blobBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function imageUrlBase64(url: string | undefined) {
  if (!url) {
    return ''
  }
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.size > 8 * 1024 * 1024) {
      return ''
    }
    const dataUrl = await blobBase64(blob)
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  } catch {
    return ''
  }
}

const donutPalette = ['#2f6f6d', '#6f8f72', '#b08a3c', '#66a182', '#b86b5f', '#7c8b46', '#8a7a55', '#a36b7a']

type DonutItem = DonutChartItem

const dashboardTaskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']
const taskFeedbackRatings: TaskFeedbackRating[] = ['顺利', '一般', '有问题']
const taskFeedbackTags: TaskFeedbackTag[] = ['需求不清晰', '沟通成本高', '定价偏低', '技术挑战大']

function supplementalMonthSelectOptions(currentValue = monthPart(isoDate())) {
  const anchor = localDateFromIsoDate(`${currentValue}-01`)
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(anchor)
    date.setMonth(anchor.getMonth() - index)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  })
}

function shiftMonthValue(value: string, offset: number) {
  const base = localDateFromIsoDate(`${value || isoDate().slice(0, 7)}-01`)
  base.setMonth(base.getMonth() + offset)
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}`
}

function normalizeTaskClosure(task: Task): Task {
  if (!hasAcceptanceProgress(task)) {
    return task
  }
  const acceptanceDate = acceptanceProgressEndDateTime(task)
  return {
    ...task,
    status: '已验收',
    stage: task.stage && task.stage !== '待验收' && task.stage !== '进行中' ? task.stage : '已验收',
    progress: 100,
    actualDeliveryDate: acceptanceDate || task.actualDeliveryDate,
  }
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildTaskContextInsights(tasks: Task[], updates: TaskUpdate[]) {
  const updatesByTask = new Map<number, TaskUpdate[]>()
  updates.forEach((update) => {
    updatesByTask.set(update.taskId, [...(updatesByTask.get(update.taskId) ?? []), update])
  })
  const activeTasks = tasks.filter((task) => !task.voidedAt && isTaskBillable(task))
  const byType = new Map<string, Task[]>()
  activeTasks.forEach((task) => {
    const type = task.type || '未分类'
    byType.set(type, [...(byType.get(type) ?? []), task])
  })
  const insights = new Map<number, TaskContextInsight>()

  activeTasks.forEach((task) => {
    if (['已验收', '终止', '不计费'].includes(task.status)) {
      return
    }
    const type = task.type || '未分类'
    const samples = (byType.get(type) ?? []).filter((item) => (
      item.id !== task.id
      && item.status === '已验收'
      && !isSupplementalTask(item)
      && item.actualHours > 0
      && item.estimatedHours > 0
    ))
    if (samples.length < 3) {
      return
    }
    const avgActualHours = averageNumber(samples.map((item) => item.actualHours))
    const avgEstimateVariance = averageNumber(samples.map((item) => (item.actualHours - item.estimatedHours) / item.estimatedHours))
    const revisionSignals = samples.reduce(
      (sum, item) => sum + (updatesByTask.get(item.id) ?? []).filter((update) => /修改|调整|改稿|反馈|返工|revision/i.test(`${update.title} ${update.body}`)).length,
      0,
    )
    const revisionSignalsPerTask = revisionSignals / samples.length
    const candidates: Array<TaskContextInsight & { priority: number }> = []

    if (avgEstimateVariance >= 0.15) {
      const percent = Math.round(avgEstimateVariance * 100)
      candidates.push({
        tone: 'warning',
        label: `同类历史平均超时 ${percent}%`,
        detail: `基于 ${samples.length} 个已验收、非补录的同类样本，平均实际工时高于预估 ${percent}%，建议今天预留缓冲时间。`,
        evidence: `${type} · ${samples.length} 个有效历史样本 · 平均实际 ${avgActualHours.toFixed(1)}h`,
        priority: 90 + percent,
      })
    }
    if (task.estimatedHours > 0 && avgActualHours > task.estimatedHours * 1.25) {
      const gap = Number((avgActualHours - task.estimatedHours).toFixed(1))
      candidates.push({
        tone: 'warning',
        label: `预估低于同类均值 ${gap.toFixed(1)}h`,
        detail: `同类历史平均实际 ${avgActualHours.toFixed(1)}h，当前预估 ${task.estimatedHours.toFixed(1)}h，建议提前确认范围或补缓冲。`,
        evidence: `${type} · ${samples.length} 个历史样本`,
        priority: 85 + gap,
      })
    }
    if (revisionSignalsPerTask >= 1.5) {
      candidates.push({
        tone: 'info',
        label: '同类修改信号偏高',
        detail: `同类历史平均每个任务出现 ${revisionSignalsPerTask.toFixed(1)} 次修改信号，建议先锁定尺寸、文案和色板。`,
        evidence: `${type} · ${revisionSignals} 次修改信号 / ${samples.length} 个样本`,
        priority: 70 + revisionSignalsPerTask,
      })
    }
    const strongest = candidates.sort((left, right) => right.priority - left.priority)[0]
    if (strongest) {
      insights.set(task.id, {
        tone: strongest.tone,
        label: strongest.label,
        detail: strongest.detail,
        evidence: strongest.evidence,
      })
    }
  })

  return insights
}

const flattenDesignTypeGroups = (groups: DesignTypeGroup[]) => groups.flatMap((group) => group.items.map((item) => `${group.name} / ${item}`))

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60)
  const restMinutes = safeMinutes % 60
  if (hours === 0) {
    return `${restMinutes} min`
  }
  if (restMinutes === 0) {
    return `${hours} h`
  }
  return `${hours} h ${restMinutes} min`
}

function timeEntryBounds(entry: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>) {
  const startDate = entry.date || ''
  const endDate = entry.endDate || startDate
  const start = dateTimeMinuteStamp(startDate, entry.start)
  const end = dateTimeMinuteStamp(endDate, entry.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null
  }
  return { start, end }
}

function timeEntriesOverlap(
  current: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
  existing: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
) {
  const currentBounds = timeEntryBounds(current)
  const existingBounds = timeEntryBounds(existing)
  if (!currentBounds || !existingBounds) {
    return false
  }
  return currentBounds.start < existingBounds.end && currentBounds.end > existingBounds.start
}

function findNearestAvailableTimeSlot<T extends Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>>(
  current: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>,
  existingEntries: T[],
) {
  const currentBounds = timeEntryBounds(current)
  if (!currentBounds) {
    return null
  }
  const duration = currentBounds.end - currentBounds.start
  if (duration <= 0) {
    return null
  }
  const existingBounds = existingEntries
    .map(timeEntryBounds)
    .filter((bounds): bounds is { start: number; end: number } => Boolean(bounds))
    .sort((a, b) => a.start - b.start)
  const conflictBounds = existingBounds.find((bounds) => currentBounds.start < bounds.end && currentBounds.end > bounds.start)
  if (!conflictBounds) {
    return null
  }
  const candidates = [
    { start: conflictBounds.end, end: conflictBounds.end + duration },
    { start: conflictBounds.start - duration, end: conflictBounds.start },
  ].filter((candidate) => candidate.start >= 0)

  const availableCandidate = candidates
    .filter((candidate) => !existingBounds.some((bounds) => candidate.start < bounds.end && candidate.end > bounds.start))
    .sort((a, b) => Math.abs(a.start - currentBounds.start) - Math.abs(b.start - currentBounds.start))[0]

  if (!availableCandidate) {
    return null
  }

  const start = planDateTimeFromMinuteStamp(availableCandidate.start)
  const end = planDateTimeFromMinuteStamp(availableCandidate.end)
  if (!start || !end) {
    return null
  }
  return { start, end }
}

function defaultTimeEntryDraft() {
  const start = snapPlanDateTime(isoDateTime(), 'up')
  const end = addMinutesToPlanDateTime(start, 60)
  return {
    date: datePart(start),
    endDate: datePart(end),
    start: start.slice(11, 16),
    end: end.slice(11, 16),
    note: '',
  }
}

type TimeEntryDraft = ReturnType<typeof defaultTimeEntryDraft>

function fillTimeDraftFromDuration(draft: TimeEntryDraft, minutes: number) {
  const safeMinutes = Math.max(1, Math.round(minutes))
  const startVal = normalizeClockInput(draft.start)
  const endVal = normalizeClockInput(draft.end)
  if (!endVal && startVal && draft.date) {
    const computed = addMinutesToPlanDateTime(`${draft.date}T${startVal}`, safeMinutes)
    return {
      ...draft,
      start: startVal,
      endDate: computed.slice(0, 10),
      end: computed.slice(11, 16),
    }
  }
  if (!startVal && endVal && (draft.endDate || draft.date)) {
    const computed = addMinutesToPlanDateTime(`${draft.endDate || draft.date}T${endVal}`, -safeMinutes)
    return {
      ...draft,
      date: computed.slice(0, 10),
      start: computed.slice(11, 16),
      endDate: draft.endDate || draft.date,
      end: endVal,
    }
  }
  return {
    ...draft,
    start: startVal || draft.start,
    end: endVal || draft.end,
  }
}

type ProgressModalTarget = {
  taskId: number
  mode: ProgressRecordMode
  editEntryId?: string
  initialAcceptanceMode?: boolean
}

const normalizeDesignTypeGroups = (groups: DesignTypeGroup[]) => {
  const normalized = groups
    .map((group, index) => ({
      name: group.name.trim(),
      color: validDesignTypeColor(group.color) || designTypeColorForIndex(index),
      items: [...new Set(group.items.map((item) => item.trim()).filter(Boolean))],
    }))
    .filter((group) => group.name)

  return normalized.length > 0 ? normalized : defaultDesignTypeGroups
}

const taskFieldLabels: Record<string, string> = {
  title: '任务名称',
  type: '设计类型',
  date: '预计开始时间',
  estimatedDate: '预计交付时间',
  requester: '需求人',
  contact: '对接人',
  reviewer: '验收人',
  requirement: '需求描述',
}

/** 把审计日志条目翻译成时间轴文案 */
function describeActivity(item: ActivityItem): string {
  const payload = item.payload ?? {}
  if (item.entityType === 'task') {
    if (item.action === 'create') {
      return '接受任务'
    }
    if (item.action === 'void') {
      const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
      return reason ? `作废任务；原因：${reason}` : '作废任务'
    }
    if (item.action === 'delete') {
      return '删除任务'
    }
    if (payload.status === '已验收') {
      const acceptanceNote = typeof payload.acceptanceNote === 'string' ? payload.acceptanceNote.trim() : ''
      const actualHours = Number(payload.actualHours)
      const timeEntries = Array.isArray(payload.timeEntries) ? payload.timeEntries : []
      const acceptanceFiles = Array.isArray(payload.acceptanceFiles) ? payload.acceptanceFiles.map(String).filter(Boolean) : []
      const details: string[] = ['确认验收']
      if (Number.isFinite(actualHours)) {
        details.push(`系统计算工时 ${actualHours.toFixed(2)}h`)
      }
      if (acceptanceNote) {
        details.push(`验收备注：${acceptanceNote}`)
      } else if (timeEntries.length > 0) {
        details.push(`包含 ${timeEntries.length} 段时间记录`)
      }
      if (acceptanceFiles.length > 0) {
        details.push(`验收文件：${acceptanceFiles.slice(0, 3).join('、')}${acceptanceFiles.length > 3 ? ` 等 ${acceptanceFiles.length} 个` : ''}`)
      }
      return details.join('；')
    }
    const parts: string[] = []
    if (typeof payload.status === 'string') {
      parts.push(`状态更新为「${payload.status}」`)
    }
    if (payload.progress !== undefined) {
      parts.push(`进度更新为 ${payload.progress}%`)
    }
    if (payload.actualHours !== undefined) {
      parts.push(`实际工时改为 ${payload.actualHours}h`)
    }
    if (Array.isArray(payload.timeEntries)) {
      parts.push(`记录了 ${payload.timeEntries.length} 段时间`)
    }
    if (typeof payload.estimatedDate === 'string') {
      parts.push(`预计交付改为 ${formatPlanDateTime(payload.estimatedDate)}`)
    }
    Object.keys(taskFieldLabels).forEach((key) => {
      if (payload[key] !== undefined) {
        parts.push(`修改了${taskFieldLabels[key]}`)
      }
    })
    return parts.length > 0 ? parts.join('；') : '更新了任务信息'
  }
  if (item.entityType === 'attachment') {
    if (item.action === 'create') {
      return '上传了文件'
    }
    if (item.action === 'delete') {
      return `删除了文件「${String(payload.fileName ?? '')}」`
    }
  }
  if (item.entityType === 'update') {
    if (item.action === 'create') {
      const hours = Number(payload.hours)
      const title = String(payload.title ?? '').trim()
      const body = String(payload.body ?? '').trim()
      if (body) {
        return body.startsWith('上传过程附件') ? '上传过程附件' : body
      }
      return `添加进展「${title}」${hours > 0 ? `（${hours}h）` : ''}`
    }
    if (item.action === 'update') {
      return '修改了进展记录'
    }
    if (item.action === 'delete') {
      return `删除了进展「${String(payload.title ?? '')}」`
    }
  }
  return '其他操作'
}

function taskAssistantFiles(task: Task, files: FileAsset[], uploadedFiles: Array<FileAsset | string> = []) {
  const taskFileNames = new Set([...(task.files ?? []), ...(task.acceptanceFiles ?? [])].map((name) => name.trim()).filter(Boolean))
  const uploadedNames = uploadedFiles
    .map((file) => (typeof file === 'string' ? file : file.name))
    .map((name) => name.trim())
    .filter(Boolean)
  uploadedNames.forEach((name) => taskFileNames.add(name))

  const relatedFiles = files.filter((file) => file.taskId === task.id || taskFileNames.has(file.name))
  const fallbackFiles = [...taskFileNames].map((name) => ({
    name,
    type: '',
    tag: task.acceptanceFiles?.includes(name) ? '验收文件' : '',
    final: task.acceptanceFiles?.includes(name) ?? false,
    visible: true,
    uploadedAt: '',
  }))

  const seen = new Set<string>()
  return [...relatedFiles, ...fallbackFiles]
    .filter((file) => {
      if (!file.name || seen.has(file.name)) {
        return false
      }
      seen.add(file.name)
      return true
    })
    .slice(0, 40)
    .map((file) => ({
      name: file.name,
      type: file.type,
      tag: file.tag,
      final: file.final,
      visible: file.visible,
      uploadedAt: file.uploadedAt,
    }))
}

function taskAssistantActivity(activity: ActivityItem[]) {
  return activity.slice(0, 12).map((item) => ({
    createdAt: item.createdAt,
    summary: describeActivity(item),
  }))
}

function taskAssistantProgressHistory(task: Task, files: FileAsset[]) {
  const attachmentsByEntry = new Map<string, string[]>()
  files.forEach((file) => {
    if (file.taskId !== task.id || file.deletedAt || !file.entryId) {
      return
    }
    const names = attachmentsByEntry.get(file.entryId) ?? []
    if (!names.includes(file.name)) {
      names.push(file.name)
    }
    attachmentsByEntry.set(file.entryId, names)
  })

  return (task.timeEntries ?? [])
    .filter((entry) => !entry.isAcceptanceProgress)
    .sort((left, right) => {
      const leftKey = `${left.date ?? ''}T${left.start || '00:00'}`
      const rightKey = `${right.date ?? ''}T${right.start || '00:00'}`
      return leftKey.localeCompare(rightKey)
    })
    .map((entry, index) => ({
      sequence: index + 1,
      date: entry.date ?? '',
      endDate: entry.endDate ?? entry.date ?? '',
      start: entry.start,
      end: entry.end,
      note: entry.note?.trim() ?? '',
      kind: entry.isClientFeedback ? 'client_feedback' as const : entry.isRevision ? 'revision' as const : 'progress' as const,
      counted: !entry.isUncounted,
      attachments: attachmentsByEntry.get(entry.id) ?? [],
    }))
    .filter((entry) => entry.note || entry.attachments.length > 0)
}

function renderTextAssistantBody(text: string) {
  return text.split('\n').map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return null
    }
    return <span className="ai-suggestion-line" key={index}>{trimmed}</span>
  })
}

function taskAssistantRequirementWithoutOutputFiles(text: string) {
  const lines = text.split('\n')
  const result: string[] = []
  let skippingOutputSection = false

  lines.forEach((line) => {
    const trimmed = line.trim()
    const isNumberedSection = /^\d+[、.．]/.test(trimmed)
    const isPlainOutputSection = /^(?:【)?\s*(输出文件|交付文件|文件格式|源文件)(?:】)?\s*[：:]/.test(trimmed)
    const isOutputSection = /输出文件|交付文件|文件格式|源文件/.test(trimmed)

    if ((isNumberedSection && isOutputSection) || isPlainOutputSection) {
      skippingOutputSection = true
      return
    }
    if (skippingOutputSection && isNumberedSection) {
      skippingOutputSection = false
    }
    if (!skippingOutputSection) {
      result.push(line)
    }
  })

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const readDraftCache = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback
  } catch {
    return fallback
  }
}

const writeDraftCache = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

const clearDraftCache = (key: string) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(key)
}

// 静默刷新：把上次成功加载的后端状态快照存入 localStorage，刷新时先用它秒开首屏，
// 后台 refreshState 完成后再无感更新，避免每次刷新都弹出「正在连接工作台」整页卡片。
const STATE_CACHE_KEY = 'designer-worklog-state-cache-v2'
const STATE_CACHE_SCHEMA_VERSION = 2
const STATE_CACHE_TTL_MS = 30 * 60 * 1000

type StateCacheEnvelope = {
  version: number
  cachedAt: number
  state: BackendState
}

const readStateCache = (): BackendState | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STATE_CACHE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<StateCacheEnvelope>
    if (parsed.version !== STATE_CACHE_SCHEMA_VERSION || typeof parsed.cachedAt !== 'number' || !parsed.state) {
      window.localStorage.removeItem(STATE_CACHE_KEY)
      return null
    }
    if (Date.now() - parsed.cachedAt > STATE_CACHE_TTL_MS) {
      window.localStorage.removeItem(STATE_CACHE_KEY)
      return null
    }
    return parsed.state
  } catch {
    return null
  }
}

const writeStateCache = (state: BackendState) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STATE_CACHE_KEY, JSON.stringify({
      version: STATE_CACHE_SCHEMA_VERSION,
      cachedAt: Date.now(),
      state,
    } satisfies StateCacheEnvelope))
  } catch {
    // 配额超限等忽略：快照仅用于加速首屏，缺失只是退回到原来的加载态
  }
}

const formatStorageUsage = (usage: StorageUsage | null) => usage?.label ?? '同步中'

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  id: number
  message: string
  tone: ToastTone
  actionLabel?: string
  onAction?: () => void | Promise<void>
  durationMs?: number
}

const MAX_VISIBLE_TOASTS = 4

const toastTonePriority = (tone: ToastTone) => {
  if (tone === 'error') return 3
  if (tone === 'info') return 1
  return 0
}

const trimToastQueue = (items: ToastState[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => toastTonePriority(b.item.tone) - toastTonePriority(a.item.tone) || b.item.id - a.item.id)
    .slice(0, MAX_VISIBLE_TOASTS)
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item)

const inferToastTone = (message: string): ToastTone => {
  if (/(失败|异常|不正确|失效|错误|不可用|无效)/.test(message)) {
    return 'error'
  }
  if (/(正在|上传中|加载)/.test(message)) {
    return 'info'
  }
  return 'success'
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') {
    return <AlertTriangle size={17} />
  }
  if (tone === 'info') {
    return <Info size={17} />
  }
  return <CheckCircle2 size={17} />
}

function isEditableShortcutTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

const monthShortcutByCode: Record<string, number> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  Digit0: 10,
  Minus: 11,
  Equal: 12,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
  Numpad5: 5,
  Numpad6: 6,
  Numpad7: 7,
  Numpad8: 8,
  Numpad9: 9,
  Numpad0: 10,
  NumpadSubtract: 11,
  NumpadAdd: 12,
}

function monthFromShortcut(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return 0
  }
  return monthShortcutByCode[event.code] ?? 0
}

// ─── AI 工作助手 ──────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  trace?: string[]
  traceStatus?: 'running' | 'completed' | 'failed'
  approval?: AgentApproval
  selection?: AgentTaskSelection
  backgroundTask?: AgentBackgroundTask
  attachments?: AgentResultAttachment[]
}
type ChatAttachment = { id: string; type: 'image' | 'text' | 'file'; name: string; data: string; mimeType: string; preview?: string; file: File }
type ConversationProject = { id: string; name: string; savedAt: number }
type ConversationRecord = {
  id: string
  title: string
  messages: ChatMessage[]
  savedAt: number
  agentConversationId?: string
  cloud?: boolean
  projectId?: string
  projectName?: string
}
type ChatModelChoice = 'auto' | `route:${AiModelRouteKey}` | `provider:${AiModelProvider}` | 'doubao-seed-2-1-pro' | 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'workers-ai' | `openrouter:${string}`
type ActiveLocalCliRoute = { adapterId: string; name: string; version: string; deviceName: string }

const CHAT_HISTORY_KEY = 'alice_chat_history'
const CHAT_PROJECTS_KEY = 'alice_chat_projects'
const CHAT_MODEL_CHOICE_KEY = 'alice_chat_model_choice'

function loadChatHistory(): ConversationRecord[] {
  try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? '[]') as ConversationRecord[] }
  catch { return [] }
}

function loadChatProjects(): ConversationProject[] {
  try { return JSON.parse(localStorage.getItem(CHAT_PROJECTS_KEY) ?? '[]') as ConversationProject[] }
  catch { return [] }
}

function saveChatProjects(projects: ConversationProject[]) {
  localStorage.setItem(CHAT_PROJECTS_KEY, JSON.stringify(projects.slice(0, 50)))
}

function conversationRecordKey(record: Pick<ConversationRecord, 'id' | 'agentConversationId'>) {
  return record.agentConversationId || record.id
}

function mergeConversationHistory(local: ConversationRecord[], cloud: ConversationRecord[]) {
  const merged = new Map<string, ConversationRecord>()
  local.forEach((record) => {
    merged.set(conversationRecordKey(record), record)
  })
  cloud.forEach((record) => {
    const key = conversationRecordKey(record)
    const localRecord = merged.get(key)
    merged.set(key, {
      ...record,
      messages: localRecord?.messages.length ? localRecord.messages : record.messages,
      savedAt: localRecord ? localRecord.savedAt : record.savedAt,
      agentConversationId: record.agentConversationId || localRecord?.agentConversationId || record.id,
      cloud: true,
    })
  })
  return Array.from(merged.values()).sort((a, b) => b.savedAt - a.savedAt).slice(0, 50)
}

function upsertChatHistory(recordId: string, msgs: ChatMessage[], agentConversationId?: string, project?: ConversationProject | null) {
  const userMsgs = msgs.filter((m) => m.role === 'user')
  if (userMsgs.length === 0) return
  const title = userMsgs[0].content.slice(0, 30) + (userMsgs[0].content.length > 30 ? '…' : '')
  const record: ConversationRecord = {
    id: recordId,
    title,
    messages: msgs,
    savedAt: Date.now(),
    agentConversationId,
    projectId: project?.id,
    projectName: project?.name,
  }
  writeChatHistoryRecord(record)
}

function writeChatHistoryRecord(record: ConversationRecord) {
  const recordKey = conversationRecordKey(record)
  const prev = loadChatHistory()
    .filter((item) => item.id !== record.id && conversationRecordKey(item) !== recordKey)
    .slice(0, 49)
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify([record, ...prev]))
}

const ALICE_WELCOME_ID = 'alice-welcome'
const ALICE_SUGGESTED = ['今天完成了哪些工作？', '生成本周工作摘要', '分析最近几个月的工作趋势']

function normalizeChatModelChoice(value: unknown): ChatModelChoice {
  const raw = String(value ?? '').trim()
  if (raw === 'doubao-seed-2-1-pro') return 'provider:doubao'
  if (raw === 'deepseek-v4-flash' || raw === 'deepseek-v4-pro') return 'provider:deepseek'
  if (raw === 'auto' || raw === 'workers-ai' || raw === 'doubao-seed-2-1-pro' || raw === 'deepseek-v4-flash' || raw === 'deepseek-v4-pro' || raw.startsWith('route:') || raw.startsWith('openrouter:')) {
    return raw as ChatModelChoice
  }
  if (raw.startsWith('provider:')) {
    const provider = raw.replace(/^provider:/, '')
    if (['deepseek', 'gemini', 'kimi', 'doubao', 'qwen', 'openai', 'openrouter', 'anthropic', 'custom-openai'].includes(provider)) {
      return `provider:${provider}` as ChatModelChoice
    }
  }
  return 'auto'
}

function readChatModelChoice(): ChatModelChoice {
  try {
    return normalizeChatModelChoice(window.localStorage.getItem(CHAT_MODEL_CHOICE_KEY))
  } catch {
    return 'auto'
  }
}

function chatRouteLabel(route: AiModelRouteKey) {
  if (route === 'textPrimary') return '文字主模型'
  if (route === 'textFallback') return '文字备用'
  if (route === 'visionPrimary') return '识图主模型'
  return '识图备用'
}

function aiProviderDisplayLabel(provider: AiModelProvider) {
  return aiProviderOptions.find((option) => option.value === provider)?.label || provider
}

function chatModelChoiceLabel(choice: ChatModelChoice, aiModelConfig: AiModelConfig | null, aiProviderConfigs?: AiProviderConfig[]) {
  if (choice === 'auto') return '自动'
  if (choice === 'workers-ai') return 'Workers AI'
  if (choice === 'doubao-seed-2-1-pro') return '豆包 Seed 2.1 Pro'
  if (choice === 'deepseek-v4-flash') return 'DeepSeek V4 Flash'
  if (choice === 'deepseek-v4-pro') return 'DeepSeek V4 Pro'
  if (choice.startsWith('openrouter:')) return choice.replace(/^openrouter:/, '').replace(/:free$/, '').split('/').pop() || 'OpenRouter'
  if (choice.startsWith('provider:')) {
    const provider = choice.replace(/^provider:/, '') as AiModelProvider
    const config = aiProviderConfigs?.find((item) => item.provider === provider)
    return config?.defaultModel || aiProviderDisplayLabel(provider)
  }
  const route = choice.replace(/^route:/, '') as AiModelRouteKey
  const model = aiModelConfig?.[route]?.model || aiRouteDefaults[route]?.model || chatRouteLabel(route)
  return model
}

function renderRichChatLine(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
        table: ({ children }) => <div className="chat-markdown-table-wrap"><table>{children}</table></div>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function trimEmptyChatLines(lines: string[]) {
  const next = [...lines]
  while (next.length > 0 && next[0].trim() === '') next.shift()
  while (next.length > 0 && next[next.length - 1].trim() === '') next.pop()
  return next
}

function splitChatThinkingLines(lines: string[]) {
  const thinkingLines: string[] = []
  const answerLines: string[] = []
  let isInsideThinking = false
  let hasThinkingBlock = false

  lines.forEach((line) => {
    let rest = line

    if (rest === '') {
      ;(isInsideThinking ? thinkingLines : answerLines).push(rest)
      return
    }

    while (rest.length > 0) {
      if (isInsideThinking) {
        const closeIndex = rest.search(/<\/think>/i)
        if (closeIndex < 0) {
          thinkingLines.push(rest)
          rest = ''
          continue
        }
        const closeMatch = rest.slice(closeIndex).match(/^<\/think>/i)
        thinkingLines.push(rest.slice(0, closeIndex))
        rest = rest.slice(closeIndex + (closeMatch?.[0].length ?? '</think>'.length))
        isInsideThinking = false
        continue
      }

      const openIndex = rest.search(/<think>/i)
      if (openIndex < 0) {
        answerLines.push(rest)
        rest = ''
        continue
      }
      const openMatch = rest.slice(openIndex).match(/^<think>/i)
      if (openIndex > 0) answerLines.push(rest.slice(0, openIndex))
      rest = rest.slice(openIndex + (openMatch?.[0].length ?? '<think>'.length))
      isInsideThinking = true
      hasThinkingBlock = true
    }
  })

  return {
    thinkingLines: trimEmptyChatLines(thinkingLines),
    answerLines: trimEmptyChatLines(hasThinkingBlock ? answerLines : lines),
  }
}

function renderChatContent(content: string) {
  const lines = content.split('\n')
  const liveTraceMatch = lines[0]?.match(/^我正在这样处理：(\d+)$/)
  const isLiveAgentTrace = Boolean(liveTraceMatch)
  if (lines[0] === '我按这个过程处理：' || isLiveAgentTrace) {
    const dividerIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '')
    const traceLines = lines
      .slice(1, dividerIndex > 0 ? dividerIndex : lines.length)
      .map((line) => line.replace(/^- /, '').trim())
      .filter(Boolean)
    const { answerLines } = splitChatThinkingLines(dividerIndex > 0 ? lines.slice(dividerIndex + 1) : [])
    const liveTotalSteps = liveTraceMatch ? Number(liveTraceMatch[1]) : traceLines.length
    return (
      <>
        <details className="chat-agent-timeline" open={isLiveAgentTrace}>
          <summary>
            <span>{isLiveAgentTrace ? '正在运行' : '运行完成'}</span>
            <small>{isLiveAgentTrace ? `${traceLines.length} / ${liveTotalSteps} 步` : `${traceLines.length} 步`}</small>
            <ChevronDown size={13} />
          </summary>
          <ol>
            {traceLines.map((line, index) => (
              <li key={`${index}-${line}`}>{renderRichChatLine(line)}</li>
            ))}
          </ol>
        </details>
        {answerLines.length > 0 && (
          <div className="chat-final-answer"><ChatMarkdown content={answerLines.join('\n')} /></div>
        )}
      </>
    )
  }
  const { answerLines } = splitChatThinkingLines(lines)
  return (
    <>
      {answerLines.length > 0 && <div className="chat-final-answer"><ChatMarkdown content={answerLines.join('\n')} /></div>}
    </>
  )
}

function AgentExecutionTimeline({
  trace,
  status,
}: {
  trace: string[]
  status: 'running' | 'completed' | 'failed'
}) {
  if (trace.length === 0) return null
  const running = status === 'running'
  const displayTraceLine = (line: string) => line.replace(/\s*\[tool:[^\]]+\]\s*/g, ' ').trim()
  return (
    <details className={`chat-agent-timeline status-${status}`} open>
      <summary>
        <span>{running ? '分析中…' : status === 'failed' ? '分析中断' : '分析过程'}</span>
        <small>{running ? displayTraceLine(trace.at(-1) ?? '') : '已核对，可展开查看'}</small>
        <ChevronDown size={13} />
      </summary>
      <ol>
        {trace.map((line, index) => {
          const active = running && index === trace.length - 1
          const completed = !running || index < trace.length - 1
          return (
            <li key={`${index}-${line}`} className={`${active ? 'active' : ''} ${completed ? 'complete' : ''}`} aria-current={active ? 'step' : undefined}>
              {renderRichChatLine(displayTraceLine(line))}
            </li>
          )
        })}
      </ol>
    </details>
  )
}

type ChatPanelProps = {
  currentMonthValue: string
  aiModelConfig: AiModelConfig | null
  aiProviderConfigs: AiProviderConfig[]
  initialAnalysisJobId?: string
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onNotify: (message: string, tone?: ToastTone) => void
}

const AGENT_APPROVAL_FIELD_LABELS: Record<string, string> = {
  title: '任务名称',
  taskTitle: '任务',
  requirement: '具体需求',
  type: '设计类型',
  date: '开始时间',
  startDateTime: '开始时间',
  endDateTime: '结束时间',
  estimatedDate: '预计交付',
  settlementMonth: '结算月份',
  estimatedHours: '预估工时',
  requester: '需求人',
  contact: '对接人',
  reviewer: '验收人',
  billable: '计入结算',
  isSupplemental: '补录任务',
  note: '记录内容',
  feedbackVersion: '反馈版本',
  feedbackSource: '反馈来源',
  dateTime: '记录时间',
  fromStatus: '原状态',
  status: '新状态',
  progress: '任务进度',
  reason: '修改原因',
  isUncounted: '不计工时',
  isRevision: '改稿轮次',
  isAcceptanceProgress: '验收进展',
  supplementalNote: '补录说明',
  acceptanceNote: '验收备注',
  progressNote: '最终进展',
  countTime: '计入工时',
  recordType: '记录类型',
  action: '操作',
  recordId: '记录 ID',
  attachmentIds: '附件 ID',
  files: '验收文件',
  changes: '修改内容',
}

function formatAgentApprovalValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (key === 'estimatedHours') return `${value} h`
  if (key === 'progress') return `${value}%`
  if (value === null || value === undefined || value === '') return '未填写'
  if (key === 'files' && Array.isArray(value)) {
    return value.map((item) => typeof item === 'object' && item ? String((item as Record<string, unknown>).name || (item as Record<string, unknown>).id || '') : String(item)).filter(Boolean).join('、') || '未选择'
  }
  if (Array.isArray(value)) return value.map(String).join('、')
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([field, fieldValue]) => `${AGENT_APPROVAL_FIELD_LABELS[field] || field}：${formatAgentApprovalValue(field, fieldValue)}`).join('；')
  return String(value).replace('T', ' ')
}

function agentApprovalRows(approval: AgentApproval) {
  const draft = approval.draft ?? {}
  const changeSource = draft.fields ?? draft.changes
  const changedFields = changeSource && typeof changeSource === 'object' && !Array.isArray(changeSource)
    ? changeSource as Record<string, unknown>
    : null
  const before = changedFields && draft.before && typeof draft.before === 'object' && !Array.isArray(draft.before)
    ? draft.before as Record<string, unknown>
    : null
  const source = changedFields
    ? { taskTitle: draft.taskTitle, ...(draft.recordType ? { recordType: draft.recordType, action: draft.action, recordId: draft.recordId } : {}), ...changedFields }
    : draft
  return Object.entries(source)
    .filter(([key, value]) => key !== 'taskId' && key !== 'before' && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: AGENT_APPROVAL_FIELD_LABELS[key] || key,
      value: formatAgentApprovalValue(key, value),
      beforeValue: before && key in before && before[key] !== value
        ? formatAgentApprovalValue(key, before[key])
        : undefined,
    }))
}

function agentApprovalStatusLabel(status: AgentApprovalStatus) {
  if (status === 'processing') return '正在执行'
  if (status === 'executed') return '已执行'
  if (status === 'cancelled') return '已取消'
  if (status === 'expired') return '已过期'
  if (status === 'failed') return '执行失败'
  return '等待确认'
}

function AgentApprovalCard({
  approval,
  busy,
  onDecision,
  onRevise,
  onOpenTask,
}: {
  approval: AgentApproval
  busy: boolean
  onDecision: (decision: 'confirm' | 'cancel') => void
  onRevise: (draft: Record<string, unknown>) => Promise<void>
  onOpenTask: (taskId: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>(approval.draft)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [activePickerId, setActivePickerId] = useState<string | null>(null)
  const rows = agentApprovalRows(approval)
  const canDecide = approval.status === 'pending' || approval.status === 'failed'
  const canEdit = canDecide
  const setDraftField = (key: string, value: unknown) => setEditDraft((current) => ({ ...current, [key]: value }))
  const nestedKey = editDraft.fields && typeof editDraft.fields === 'object' ? 'fields' : editDraft.changes && typeof editDraft.changes === 'object' ? 'changes' : ''
  const editableSource = nestedKey
    ? editDraft[nestedKey] as Record<string, unknown>
    : editDraft
  const setEditableField = (key: string, value: unknown) => {
    if (!nestedKey) return setDraftField(key, value)
    setEditDraft((current) => ({
      ...current,
      [nestedKey]: { ...((current[nestedKey] as Record<string, unknown>) || {}), [key]: value },
    }))
  }
  const genericEditableEntries = Object.entries(editableSource).filter(([key, value]) => (
    !['taskId', 'taskTitle', 'before', 'files'].includes(key) && value !== undefined && value !== null && typeof value !== 'object'
  ))
  const applyVoiceApprovalSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt) {
      setDraftField('date', result.startAt)
    }
    if (result.durationMinutes) {
      setDraftField('estimatedHours', Math.round((result.durationMinutes / 60) * 100) / 100)
    }
    if (result.endAt) {
      setDraftField('estimatedDate', result.endAt)
    }
    setActivePickerId(null)
  }
  const saveDraft = async () => {
    setSaving(true)
    setEditError('')
    try {
      await onRevise(editDraft)
      setEditing(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '草稿更新失败')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={`agent-approval-card status-${approval.status}`} aria-label={`${approval.label}确认卡片`}>
      <header className="agent-approval-header">
        <div>
          <small>{approval.status === 'executed' ? '操作结果' : '待确认操作'}</small>
          <strong>{approval.label}</strong>
        </div>
        <span className="agent-approval-status">{agentApprovalStatusLabel(approval.status)}</span>
      </header>
      <p className="agent-approval-hint">
        {approval.status === 'executed'
          ? '操作已经写入网站数据。'
          : approval.status === 'processing'
            ? '操作已交给持久化 Workflow，页面关闭后仍会继续执行。'
            : '请核对草稿。只有确认后，Agent 才会写入网站数据。'}
      </p>
      {editing && approval.action === 'create_task' ? (
        <div className="agent-approval-editor">
          <label className="agent-approval-editor-field agent-approval-editor-wide">
            <span>任务名称</span>
            <input value={String(editDraft.title ?? '')} onChange={(event) => setDraftField('title', event.target.value)} />
          </label>
          <label className="agent-approval-editor-field agent-approval-editor-wide">
            <span>具体需求</span>
            <textarea rows={4} value={String(editDraft.requirement ?? '')} onChange={(event) => setDraftField('requirement', event.target.value)} />
          </label>
          <label className="agent-approval-editor-field">
            <span>设计类型</span>
            <input value={String(editDraft.type ?? '')} onChange={(event) => setDraftField('type', event.target.value)} />
          </label>
          <div className="agent-approval-editor-field">
            <span>结算月份</span>
            <MonthPicker
              value={String(editDraft.settlementMonth ?? monthPart(isoDate()))}
              taskMonthValues={new Set([String(editDraft.settlementMonth ?? monthPart(isoDate()))])}
              onChange={(value) => setDraftField('settlementMonth', value)}
              minimal
            />
          </div>
          <div className="agent-approval-editor-schedule-head agent-approval-editor-wide">
            <span>时间与工时</span>
            <VoiceScheduleButton
              label="用语音填写待确认任务的时间与工时"
              context="工作助手待确认新建任务的预计排期"
              currentStart={String(editDraft.date ?? '')}
              currentDurationMinutes={Number(editDraft.estimatedHours || 0) > 0 ? Math.round(Number(editDraft.estimatedHours) * 60) : undefined}
              currentEnd={String(editDraft.estimatedDate ?? '')}
              onApply={applyVoiceApprovalSchedule}
            />
          </div>
          <div className="agent-approval-editor-field">
            <PlanDateTimeField
              label="开始时间"
              value={String(editDraft.date ?? '')}
              onChange={(value) => setDraftField('date', value)}
              pickerId="agent-create-date"
              activePickerId={activePickerId}
              onActivePickerChange={setActivePickerId}
            />
          </div>
          <div className="agent-approval-editor-field">
            <PlanDateTimeField
              label="预计交付"
              value={String(editDraft.estimatedDate ?? '')}
              onChange={(value) => setDraftField('estimatedDate', value)}
              pickerId="agent-create-estimated-date"
              activePickerId={activePickerId}
              onActivePickerChange={setActivePickerId}
            />
          </div>
          {(['estimatedHours', 'requester', 'contact', 'reviewer'] as const).map((key) => (
            <label key={key} className="agent-approval-editor-field">
              <span>{AGENT_APPROVAL_FIELD_LABELS[key]}</span>
              <input
                type={key === 'estimatedHours' ? 'number' : 'text'}
                min={key === 'estimatedHours' ? '0' : undefined}
                step={key === 'estimatedHours' ? '0.5' : undefined}
                value={String(editDraft[key] ?? '')}
                onChange={(event) => setDraftField(key, key === 'estimatedHours' ? Number(event.target.value) : event.target.value)}
              />
            </label>
          ))}
          <div className="agent-approval-editor-options agent-approval-editor-wide">
            {(['billable', 'isSupplemental'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={Boolean(editDraft[key])}
                className={`agent-approval-editor-toggle ${editDraft[key] ? 'active' : ''}`}
                onClick={() => setDraftField(key, !editDraft[key])}
              >
                <span aria-hidden="true" />
                {AGENT_APPROVAL_FIELD_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      ) : editing ? (
        <div className="agent-approval-editor">
          {genericEditableEntries.map(([key, value]) => {
            const label = AGENT_APPROVAL_FIELD_LABELS[key] || key
            if (typeof value === 'boolean') {
              return (
                <div key={key} className="agent-approval-editor-field">
                  <span>{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    className={`agent-approval-editor-toggle ${value ? 'active' : ''}`}
                    onClick={() => setEditableField(key, !value)}
                  >
                    <span aria-hidden="true" />{value ? '是' : '否'}
                  </button>
                </div>
              )
            }
            const multiline = ['note', 'requirement', 'reason', 'acceptanceNote', 'progressNote'].includes(key)
            return (
              <label key={key} className={`agent-approval-editor-field ${multiline ? 'agent-approval-editor-wide' : ''}`}>
                <span>{label}</span>
                {multiline
                  ? <textarea rows={3} value={String(value ?? '')} onChange={(event) => setEditableField(key, event.target.value)} />
                  : <input
                      type={typeof value === 'number' ? 'number' : key.toLowerCase().includes('datetime') ? 'datetime-local' : 'text'}
                      value={String(value ?? '')}
                      onChange={(event) => setEditableField(key, typeof value === 'number' ? Number(event.target.value) : event.target.value)}
                    />}
              </label>
            )
          })}
          {Array.isArray(editDraft.attachmentIds) && (
            <label className="agent-approval-editor-field agent-approval-editor-wide">
              <span>附件 ID（逗号分隔）</span>
              <input
                value={(editDraft.attachmentIds as unknown[]).join(', ')}
                onChange={(event) => setDraftField('attachmentIds', event.target.value.split(/[,，]/).map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0))}
              />
            </label>
          )}
        </div>
      ) : (
        <dl className="agent-approval-fields">
          {rows.map((row) => (
            <div key={row.key} className="agent-approval-field">
              <dt>{row.label}</dt>
              <dd>
                {row.beforeValue !== undefined ? (
                  <span className="agent-approval-diff"><del>{row.beforeValue}</del><span aria-hidden="true">→</span><ins>{row.value}</ins></span>
                ) : row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {approval.warnings.length > 0 && (
        <div className="agent-approval-warnings">
          <AlertTriangle size={14} />
          <span>{approval.warnings.join('；')}</span>
        </div>
      )}
      {approval.error && <p className="agent-approval-error">{approval.error}</p>}
      {editError && <p className="agent-approval-error">{editError}</p>}
      {canDecide && (
        <footer className="agent-approval-actions">
          {editing ? (
            <>
              <button type="button" className="ghost-button compact-button" disabled={saving} onClick={() => { setEditing(false); setEditDraft(approval.draft); setEditError('') }}>放弃修改</button>
              <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void saveDraft()}>{saving ? '保存中…' : '保存草稿'}</button>
            </>
          ) : (
            <>
              {canEdit && <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => setEditing(true)}>编辑草稿</button>}
              <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => onDecision('cancel')}>取消</button>
              <button type="button" className="primary-button compact-button" disabled={busy} onClick={() => onDecision('confirm')}>确认执行</button>
            </>
          )}
        </footer>
      )}
      {approval.status === 'executed' && approval.result?.taskId && (
        <footer className="agent-approval-actions">
          <button type="button" className="primary-button compact-button" onClick={() => onOpenTask(approval.result!.taskId!)}>查看任务</button>
        </footer>
      )}
    </section>
  )
}

function AgentTaskSelectionCard({
  selection,
  busy,
  onSelect,
}: {
  selection: AgentTaskSelection
  busy: boolean
  onSelect: (candidate: AgentTaskCandidate) => void
}) {
  return (
    <section className="agent-selection-card" aria-label="选择任务">
      <header className="agent-selection-header">
        <small>需要你确认</small>
        <strong>{selection.prompt}</strong>
      </header>
      <div className="agent-selection-list">
        {selection.candidates.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="agent-selection-option"
            disabled={busy}
            onClick={() => onSelect(candidate)}
          >
            <span className="agent-selection-main">{candidate.title}</span>
            <span className="agent-selection-meta">
              {[candidate.startDate.slice(0, 10), candidate.type, candidate.status].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

const AGENT_ANALYSIS_PHASES: Array<{ phase: AgentBackgroundTask['phase']; label: string }> = [
  { phase: 'queued', label: '排队等待' },
  { phase: 'collecting', label: '汇总工作资料' },
  { phase: 'analyzing', label: '生成可核对报告' },
  { phase: 'completed', label: '保存分析结果' },
]

function agentAnalysisStatusLabel(status: AgentBackgroundTask['status']) {
  if (status === 'running') return '分析中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '分析失败'
  if (status === 'cancelled') return '已取消'
  return '已排队'
}

function AgentAnalysisTaskCard({
  task,
  busy,
  onCancel,
  onRetry,
}: {
  task: AgentBackgroundTask
  busy: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  const activePhaseIndex = AGENT_ANALYSIS_PHASES.findIndex((item) => item.phase === task.phase)
  const terminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  return (
    <section className={`agent-analysis-card status-${task.status}`} aria-label={`${task.title}后台分析`}>
      <header className="agent-analysis-header">
        <div>
          <small>后台分析任务</small>
          <strong>{task.title}</strong>
        </div>
        <span className="agent-analysis-status">{agentAnalysisStatusLabel(task.status)}</span>
      </header>
      {!terminal && (
        <div className="agent-analysis-progress" aria-label={`分析进度 ${task.progress}%`}>
          <div><span style={{ width: `${task.progress}%` }} /></div>
          <small>{task.progress}%</small>
        </div>
      )}
      <ol className="agent-analysis-steps">
        {AGENT_ANALYSIS_PHASES.map((item, index) => {
          const completed = task.status === 'completed' || activePhaseIndex > index
          const active = !terminal && item.phase === task.phase
          return <li key={item.phase} className={`${completed ? 'complete' : ''} ${active ? 'active' : ''}`}>{item.label}</li>
        })}
      </ol>
      {task.result && (
        <div className="agent-analysis-result chat-final-answer">
          <ChatMarkdown content={task.result} />
        </div>
      )}
      {task.error && <p className="agent-analysis-error">{task.error}</p>}
      {(task.status === 'queued' || task.status === 'running' || task.status === 'failed' || task.status === 'cancelled') && (
        <footer className="agent-analysis-actions">
          {(task.status === 'queued' || task.status === 'running') && (
            <button type="button" className="ghost-button compact-button" disabled={busy} onClick={onCancel}>取消分析</button>
          )}
          {(task.status === 'failed' || task.status === 'cancelled') && (
            <button type="button" className="primary-button compact-button" disabled={busy} onClick={onRetry}>重新分析</button>
          )}
        </footer>
      )}
    </section>
  )
}

function agentResultAttachmentToFile(file: AgentResultAttachment): FileAsset {
  return {
    id: typeof file.id === 'number' ? file.id : 0,
    taskId: file.taskId,
    scope: file.scope,
    name: file.name,
    task: file.taskTitle,
    type: file.type,
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: file.uploadedAt,
    final: file.scope === 'acceptance',
    visible: false,
    tag: file.tag,
    previewUrl: file.previewUrl,
    sourceUrl: file.downloadUrl || file.sourceUrl,
  }
}

function settlementReceiptRangeLabel(name: string) {
  const matched = name.match(/_(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/)
  if (!matched) return name.replace(/\.xlsx$/i, '')
  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = matched
  const start = `${startYear}/${startMonth}/${startDay}`
  const end = `${endYear}/${endMonth}/${endDay}`
  return `${start} 至 ${end}`
}

function AgentSettlementReceiptPreview({
  attachment,
  onClose,
}: {
  attachment: AgentResultAttachment
  onClose: () => void
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [receipt, setReceipt] = useState<ReceiptExcelOptions | null>(null)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(0.42)
  const shareToken = attachment.shareUrl?.split('/').filter(Boolean).at(-1) ?? ''

  const fitReceipt = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setScale(Math.max(0.25, Math.min(1, (viewport.clientWidth - 32) / 2200)))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadReceipt = async () => {
      if (!shareToken) {
        setError('该回单缺少在线预览地址，请重新导出。')
        return
      }
      try {
        const response = await fetch(`/api/shared-settlement/${encodeURIComponent(shareToken)}`, { signal: controller.signal })
        const payload = await response.json().catch(() => null) as { receipt?: ReceiptExcelOptions; error?: string } | null
        if (!response.ok || !payload?.receipt) throw new Error(payload?.error || '回单读取失败')
        setReceipt(payload.receipt)
        window.requestAnimationFrame(fitReceipt)
      } catch (caughtError) {
        if (!controller.signal.aborted) setError(caughtError instanceof Error ? caughtError.message : '回单读取失败')
      }
    }
    void loadReceipt()
    return () => controller.abort()
  }, [fitReceipt, shareToken])

  const changeScale = (delta: number) => setScale((current) => Math.max(0.25, Math.min(1.5, Number((current + delta).toFixed(2)))))

  return createPortal(
    <ModalShell className="agent-receipt-preview-modal" labelledBy="agent-receipt-preview-title" onClose={onClose} closeOnEscape>
      <header className="modal-header agent-receipt-preview-header">
        <div>
          <p className="eyebrow">回单预览</p>
          <h2 id="agent-receipt-preview-title">{settlementReceiptRangeLabel(attachment.name)}</h2>
        </div>
        <div className="modal-header-actions">
          <button type="button" className="icon-button" onClick={() => changeScale(-0.08)} disabled={scale <= 0.25} aria-label="缩小" title="缩小"><ZoomOut size={16} /></button>
          <button type="button" className="agent-receipt-scale" onClick={() => setScale(1)} aria-label="按 1 比 1 显示" title="1:1 原始尺寸">1:1</button>
          <button type="button" className="icon-button" onClick={() => changeScale(0.08)} disabled={scale >= 1.5} aria-label="放大" title="放大"><ZoomIn size={16} /></button>
          <button type="button" className="icon-button" onClick={fitReceipt} aria-label="适合窗口" title="适合窗口"><Maximize2 size={16} /></button>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="关闭" title="关闭"><X size={18} /></button>
        </div>
      </header>
      <div ref={viewportRef} className="agent-receipt-preview-viewport">
        {!receipt && !error && <div className="office-preview-status">正在加载完整回单…</div>}
        {error && <div className="file-preview-placeholder"><FileText size={38} /><strong>暂时无法预览</strong><span>{error}</span></div>}
        {receipt && (
          <div className="agent-receipt-preview-sheet" style={{ zoom: scale } as CSSProperties}>
            <SettlementReceipt options={receipt} />
          </div>
        )}
      </div>
    </ModalShell>,
    document.body,
  )
}

function AgentResultPreviewModal({ attachment, onClose }: { attachment: AgentResultAttachment; onClose: () => void }) {
  if (attachment.kind === 'settlement-receipt') return <AgentSettlementReceiptPreview attachment={attachment} onClose={onClose} />
  return <FilePreviewModal file={agentResultAttachmentToFile(attachment)} onClose={onClose} />
}

function AgentAttachmentResults({
  attachments,
  onPreview,
}: {
  attachments: AgentResultAttachment[]
  onPreview: (attachment: AgentResultAttachment) => void
}) {
  const isSettlementBatch = attachments.every((item) => item.kind === 'settlement-receipt')
  return (
    <section className={`agent-attachment-results ${isSettlementBatch ? 'is-settlement-receipt' : ''}`} aria-label={`附件结果，共 ${attachments.length} 个`}>
      <header className="agent-attachment-results-header">
        <div>
          <small>{isSettlementBatch ? '已生成文件' : '找到的真实文件'}</small>
          <strong>{isSettlementBatch ? '导出结果' : '附件'}</strong>
        </div>
        <span>{attachments.length} 个</span>
      </header>
      <div className="agent-attachment-grid">
        {attachments.map((attachment) => {
          const file = agentResultAttachmentToFile(attachment)
          const isSettlementReceipt = attachment.kind === 'settlement-receipt'
          return (
            <article className={`agent-attachment-card ${isSettlementReceipt ? 'is-settlement-receipt' : ''}`} key={attachment.id}>
              <button type="button" className="agent-attachment-preview" onClick={() => onPreview(attachment)} aria-label={`预览 ${attachment.name}`} title="预览附件">
                {isSettlementReceipt ? <span className="agent-receipt-file-mark"><img src={microsoftExcelIcon} alt="Microsoft Excel" /></span> : <FileThumbnailPreview file={file} />}
              </button>
              <div className="agent-attachment-info">
                <strong title={attachment.name}>{isSettlementReceipt ? settlementReceiptRangeLabel(attachment.name) : attachment.name}</strong>
                <span title={attachment.taskTitle}>{isSettlementReceipt ? 'Excel 工作簿' : attachment.taskTitle}</span>
                <small>{isSettlementReceipt ? '可预览、在线查看或下载' : [attachment.type, attachment.size, attachment.tag || (attachment.scope === 'acceptance' ? '验收附件' : '进展附件')].filter(Boolean).join(' · ')}</small>
              </div>
              <div className="agent-attachment-actions">
                <button type="button" className="ghost-button compact-button" onClick={() => onPreview(attachment)}>
                  <Eye size={13} />预览
                </button>
                {attachment.shareUrl && (
                  <a className="ghost-button compact-button" href={attachment.shareUrl} target="_blank" rel="noreferrer">
                    <Eye size={13} />在线预览
                  </a>
                )}
                <a className="ghost-button compact-button" href={authedPreviewUrl(attachment.downloadUrl || attachment.sourceUrl)} target="_blank" rel="noreferrer">
                  <Download size={13} />{isSettlementReceipt ? '下载' : '打开'}
                </a>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ChatPanel({
  currentMonthValue,
  aiModelConfig,
  aiProviderConfigs,
  initialAnalysisJobId,
  onClose,
  onOpenTask,
  onNotify,
}: ChatPanelProps) {
  const initialConversation = initialAnalysisJobId
    ? loadChatHistory().find((record) => record.messages.some((message) => message.backgroundTask?.id === initialAnalysisJobId))
    : undefined
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation?.messages ?? [{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
  const [conversationRecordId, setConversationRecordId] = useState<string>(() => initialConversation?.id ?? crypto.randomUUID())
  const [agentConversationId, setAgentConversationId] = useState<string | undefined>(initialConversation?.agentConversationId)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [temporaryChat, setTemporaryChat] = useState(false)
  const [projects, setProjects] = useState<ConversationProject[]>(() => loadChatProjects())
  const [activeProjectId, setActiveProjectId] = useState<string>(initialConversation?.projectId ?? '')
  const [projectDraft, setProjectDraft] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showTaskCenter, setShowTaskCenter] = useState(false)
  const [showProjectPopup, setShowProjectPopup] = useState(false)
  const [showScopePopup, setShowScopePopup] = useState(false)
  const [showModelPopup, setShowModelPopup] = useState(false)
  const [selectedModelChoice, setSelectedModelChoice] = useState<ChatModelChoice>(() => readChatModelChoice())
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterFreeModel[]>([])
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [historyList, setHistoryList] = useState<ConversationRecord[]>(() => loadChatHistory())
  const [analysisJobs, setAnalysisJobs] = useState<AgentBackgroundTask[]>([])
  const [agentPlans, setAgentPlans] = useState<AgentTaskPlan[]>([])
  const [taskMemories, setTaskMemories] = useState<AgentTaskMemory[]>([])
  const [taskCenterTab, setTaskCenterTab] = useState<'plans' | 'memories'>('plans')
  const [expandedPlanId, setExpandedPlanId] = useState('')
  const [expandedMemoryId, setExpandedMemoryId] = useState(0)
  const [memoryNoteDrafts, setMemoryNoteDrafts] = useState<Record<number, string>>({})
  const [memoryForgetConfirmId, setMemoryForgetConfirmId] = useState(0)
  const [taskCenterBusy, setTaskCenterBusy] = useState('')
  const [activeLocalCommandId, setActiveLocalCommandId] = useState('')
  const [isCancellingLocalCommand, setIsCancellingLocalCommand] = useState(false)
  const [activeLocalCliRoute, setActiveLocalCliRoute] = useState<ActiveLocalCliRoute | null>(null)

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [agentPreviewAttachment, setAgentPreviewAttachment] = useState<AgentResultAttachment | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isWelcome = messages.length === 1 && messages[0].id === ALICE_WELCOME_ID
  const activeProject = activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null

  useEffect(() => { if (!isWelcome) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isWelcome])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    let cancelled = false
    const refreshLocalRoute = async () => {
      try {
        const result = await api.getLocalCliDevices(localCliBrowserDeviceKey())
        const device = result.devices.find((item) => item.online && item.selectedCliId && localCliRuntimeReady(item.bridgeVersion))
        const cli = device?.clis.find((item) => item.id === device.selectedCliId && item.status === 'available')
        if (!cancelled) {
          setActiveLocalCliRoute(device && cli
            ? { adapterId: cli.id, name: cli.name, version: cli.version, deviceName: device.name }
            : null)
        }
      } catch {
        if (!cancelled) setActiveLocalCliRoute(null)
      }
    }
    void refreshLocalRoute()
    const timer = window.setInterval(() => void refreshLocalRoute(), 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])
  useEffect(() => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
  }, [activeProject, agentConversationId, conversationRecordId, isWelcome, messages, temporaryChat])

  const refreshCloudHistory = useCallback(async () => {
    const response = await fetch('/api/ai/conversations')
    const data = await response.json().catch(() => null) as { conversations?: AgentConversationSummary[] } | null
    if (!response.ok || !Array.isArray(data?.conversations)) return
    const cloudRecords = data.conversations.map((item) => ({
      id: item.id,
      title: item.title,
      messages: [],
      savedAt: new Date(item.updatedAt).getTime(),
      agentConversationId: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      cloud: true,
    }))
    const localProjects = loadChatProjects()
    const cloudProjects = cloudRecords
      .filter((record) => record.projectId && record.projectName)
      .map((record) => ({ id: record.projectId!, name: record.projectName!, savedAt: record.savedAt }))
    const projectMap = new Map<string, ConversationProject>()
    ;[...localProjects, ...cloudProjects].forEach((project) => {
      const current = projectMap.get(project.id)
      if (!current || project.savedAt > current.savedAt) projectMap.set(project.id, project)
    })
    const nextProjects = Array.from(projectMap.values()).sort((a, b) => b.savedAt - a.savedAt).slice(0, 50)
    saveChatProjects(nextProjects)
    setProjects(nextProjects)
    setHistoryList(mergeConversationHistory(loadChatHistory(), cloudRecords))
  }, [])

  const refreshAnalysisJobs = useCallback(async () => {
    const [jobsResponse, plansResponse, memoriesResponse] = await Promise.all([
      fetch('/api/ai/analysis-jobs?limit=50'),
      fetch('/api/ai/agent-plans?limit=50'),
      fetch('/api/ai/task-memories?limit=50'),
    ])
    const data = await jobsResponse.json().catch(() => null) as { jobs?: AgentBackgroundTask[] } | null
    const planData = await plansResponse.json().catch(() => null) as { plans?: AgentTaskPlan[] } | null
    const memoryData = await memoriesResponse.json().catch(() => null) as { memories?: AgentTaskMemory[] } | null
    if (jobsResponse.ok && Array.isArray(data?.jobs)) setAnalysisJobs(data.jobs)
    if (plansResponse.ok && Array.isArray(planData?.plans)) setAgentPlans(planData.plans)
    if (memoriesResponse.ok && Array.isArray(memoryData?.memories)) setTaskMemories(memoryData.memories)
  }, [])

  useEffect(() => {
    let cancelled = false
    const migrateAndLoad = async () => {
      const local = loadChatHistory()
      if (local.length > 0) {
        await fetch('/api/ai/conversations/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversations: local.map((record) => ({
            id: record.id,
            agentConversationId: record.agentConversationId,
            title: record.title,
            savedAt: record.savedAt,
            projectId: record.projectId,
            projectName: record.projectName,
            messages: record.messages.map((message, index) => ({ ...message, createdAt: record.savedAt + index })),
          })) }),
        }).catch(() => undefined)
      }
      if (!cancelled) await Promise.all([refreshCloudHistory(), refreshAnalysisJobs()])
    }
    void migrateAndLoad()
    return () => { cancelled = true }
  }, [refreshAnalysisJobs, refreshCloudHistory])

  useEffect(() => {
    if (!initialAnalysisJobId) return
    const local = loadChatHistory().find((record) => record.messages.some((message) => message.backgroundTask?.id === initialAnalysisJobId))
    if (local) return
    void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(initialAnalysisJobId)}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }: { ok: boolean; data: { job?: AgentBackgroundTask } }) => {
        if (!ok || !data.job) return
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: '', backgroundTask: data.job }])
        void fetch(`/api/ai/analysis-jobs/${encodeURIComponent(data.job.id)}/read`, { method: 'POST' })
        setAnalysisJobs((current) => current.map((job) => job.id === data.job!.id ? { ...job, unread: false } : job))
      })
      .catch(() => undefined)
  }, [initialAnalysisJobId])

  const activeAnalysisKey = messages
    .map((message) => message.backgroundTask)
    .filter((task): task is AgentBackgroundTask => Boolean(task && (task.status === 'queued' || task.status === 'running')))
    .map((task) => task.id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = activeAnalysisKey ? activeAnalysisKey.split(',').filter(Boolean) : []
    if (ids.length === 0) return
    let cancelled = false
    const refresh = async () => {
      const tasks = await Promise.all(ids.map(async (id) => {
        const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(id)}`)
        const data = await response.json().catch(() => null) as { job?: AgentBackgroundTask } | null
        return response.ok ? data?.job : undefined
      }))
      if (cancelled) return
      const byId = new Map(tasks.filter((task): task is AgentBackgroundTask => Boolean(task)).map((task) => [task.id, task]))
      if (byId.size > 0) {
        setMessages((current) => current.map((message) => (
          message.backgroundTask && byId.has(message.backgroundTask.id)
            ? { ...message, backgroundTask: byId.get(message.backgroundTask.id) }
            : message
        )))
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeAnalysisKey])

  useEffect(() => {
    if (!showScopePopup) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.alice-scope-popup') && !(e.target as HTMLElement).closest('.alice-scope-btn')) {
        setShowScopePopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showScopePopup])

  useEffect(() => {
    if (!showModelPopup) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.alice-model-popup') && !(e.target as HTMLElement).closest('.alice-model-btn')) {
        setShowModelPopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showModelPopup])

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_MODEL_CHOICE_KEY, selectedModelChoice)
    } catch {
      // ignore
    }
  }, [selectedModelChoice])

  useEffect(() => {
    let cancelled = false
    void api.getActiveAiModelChoice()
      .then(({ choice }) => {
        if (!cancelled) setSelectedModelChoice(normalizeChatModelChoice(choice))
      })
      .catch(() => {
        // 离线时保留当前浏览器上一次选择，发送请求仍由服务端安全回退。
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showHistory) return
    const q = historySearch.trim()
    if (!q) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q })
      if (activeProjectId) params.set('projectId', activeProjectId)
      void fetch(`/api/ai/conversations/search?${params.toString()}`)
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }: { ok: boolean; data: { conversations?: AgentConversationSummary[] } }) => {
          if (!ok || cancelled || !Array.isArray(data.conversations)) return
          const cloudRecords = data.conversations.map((item) => ({
            id: item.id,
            title: item.title,
            messages: [] as ChatMessage[],
            savedAt: new Date(item.updatedAt).getTime(),
            agentConversationId: item.id,
            projectId: item.projectId,
            projectName: item.projectName,
            cloud: true,
          }))
          setHistoryList((current) => mergeConversationHistory(loadChatHistory(), [...current.filter((record) => record.cloud), ...cloudRecords]))
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeProjectId, historySearch, showHistory])

  const newConversation = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setHistoryList(mergeConversationHistory(loadChatHistory(), historyList.filter((record) => record.cloud)))
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setTemporaryChat(false)
    setInput('')
    setAttachments([])
    setShowModelPopup(false)
    setShowHistory(false)
    setShowTaskCenter(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const openHistory = () => {
    void refreshCloudHistory()
    setHistoryList((current) => mergeConversationHistory(loadChatHistory(), current.filter((record) => record.cloud)))
    setShowTaskCenter(false)
    setShowProjectPopup(false)
    setShowHistory(true)
  }

  const loadConversation = async (record: ConversationRecord) => {
    let nextMessages = record.messages
    if (record.cloud || nextMessages.length === 0) {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(record.agentConversationId || record.id)}`)
      const data = await response.json().catch(() => null) as { messages?: AgentConversationMessage[] } | null
      if (!response.ok || !Array.isArray(data?.messages)) {
        if (record.messages.length === 0) {
          onNotify('云端会话读取失败，请稍后重试', 'error')
          return
        }
        nextMessages = record.messages
      } else {
        const cloudMessages = data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          trace: message.trace,
          traceStatus: message.trace?.length ? 'completed' as const : undefined,
          approval: message.approval,
          selection: message.selection,
          backgroundTask: message.backgroundTask,
          attachments: message.attachments,
        }))
        nextMessages = cloudMessages.length > 0 ? cloudMessages : record.messages
      }
    }
    setMessages(nextMessages)
    setConversationRecordId(record.id)
    setAgentConversationId(record.agentConversationId || record.id)
    setActiveProjectId(record.projectId ?? '')
    setTemporaryChat(false)
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const deleteHistoryItem = async (id: string) => {
    const target = historyList.find((r) => r.id === id || r.agentConversationId === id)
    const cloudId = target?.agentConversationId || id
    const updatedLocal = loadChatHistory().filter((r) => r.id !== id && r.agentConversationId !== id && r.id !== cloudId && r.agentConversationId !== cloudId)
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updatedLocal))
    setHistoryList((current) => current.filter((r) => r.id !== id && r.agentConversationId !== id && r.id !== cloudId && r.agentConversationId !== cloudId))
    await fetch(`/api/ai/conversations/${encodeURIComponent(cloudId)}`, { method: 'DELETE' }).catch(() => undefined)
  }

  const createConversationProject = () => {
    const name = projectDraft.trim()
    if (!name) return
    const project = { id: crypto.randomUUID(), name: name.slice(0, 24), savedAt: Date.now() }
    const nextProjects = [project, ...projects.filter((item) => item.name !== project.name)].slice(0, 50)
    saveChatProjects(nextProjects)
    setProjects(nextProjects)
    setActiveProjectId(project.id)
    setProjectDraft('')
    if (temporaryChat) setTemporaryChat(false)
    setShowProjectPopup(false)
    onNotify(`已新建对话项目：${project.name}`, 'success')
  }

  const selectConversationProject = (projectId: string) => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setActiveProjectId(projectId)
    setTemporaryChat(false)
    setShowProjectPopup(false)
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const clearConversationProject = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setActiveProjectId('')
    setTemporaryChat(false)
    setShowProjectPopup(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const startTemporaryChat = () => {
    if (!temporaryChat && !isWelcome) upsertChatHistory(conversationRecordId, messages, agentConversationId, activeProject)
    setTemporaryChat(true)
    setActiveProjectId('')
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setInput('')
    setAttachments([])
    setShowProjectPopup(false)
    setShowHistory(false)
    setShowTaskCenter(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const openTaskCenter = () => {
    void refreshAnalysisJobs()
    setShowHistory(false)
    setShowTaskCenter(true)
  }

  const openAnalysisJob = async (job: AgentBackgroundTask) => {
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: '', backgroundTask: { ...job, unread: false } }])
    setConversationRecordId(crypto.randomUUID())
    setAgentConversationId(undefined)
    setShowTaskCenter(false)
    setAnalysisJobs((current) => current.map((item) => item.id === job.id ? { ...item, unread: false } : item))
    await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(job.id)}/read`, { method: 'POST' }).catch(() => undefined)
  }

  const openAgentPlan = async (plan: AgentTaskPlan) => {
    setAgentPlans((current) => current.map((item) => item.id === plan.id ? { ...item, unread: false } : item))
    await fetch(`/api/ai/agent-plans/${encodeURIComponent(plan.id)}/read`, { method: 'POST' }).catch(() => undefined)
    setExpandedPlanId((current) => current === plan.id ? '' : plan.id)
  }

  const authHeaders = (): Record<string, string> => {
    return { 'content-type': 'application/json' }
  }

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return
    const added: ChatAttachment[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        if (isImage) {
          reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? '') }
          reader.readAsDataURL(file)
        } else if (isText) {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(file)
        } else resolve('')
      })
      added.push({
        id: crypto.randomUUID(),
        type: isImage ? 'image' : isText ? 'text' : 'file',
        name: file.name,
        data,
        mimeType: file.type || 'text/plain',
        preview: isImage ? `data:${file.type || 'image/jpeg'};base64,${data}` : undefined,
        file,
      })
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 4))
  }

  const handleInputPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (pastedImages.length === 0) return
    event.preventDefault()
    void handleFiles(pastedImages)
  }

  const openModelPicker = () => {
    setShowModelPopup((value) => !value)
    if (openRouterModels.length > 0 || isLoadingOpenRouterModels) return
    setIsLoadingOpenRouterModels(true)
    api.getOpenRouterFreeModels()
      .then((result) => {
        setOpenRouterModels((result.models ?? []).filter((model) => model.status === 'ok').slice(0, 12))
      })
      .catch(() => setOpenRouterModels([]))
      .finally(() => setIsLoadingOpenRouterModels(false))
  }

  const reviseApproval = async (messageId: string, approvalId: string, draft: Record<string, unknown>) => {
    if (!agentConversationId) throw new Error('当前会话已失效，请重新生成任务草稿。')
    const res = await fetch('/api/ai/approval', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        agentRuntimeConversationId: agentConversationId,
        approvalId,
        draft,
      }),
    })
    const data = (await res.json().catch(() => null)) as { approval?: AgentApproval; error?: string } | null
    if (!res.ok || !data?.approval) throw new Error(data?.error ?? '草稿更新失败')
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, approval: data.approval } : message
    )))
  }

  const updateAnalysisTask = async (messageId: string, taskId: string, action: 'cancel' | 'retry') => {
    const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(taskId)}/${action}`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const data = await response.json().catch(() => null) as { job?: AgentBackgroundTask; error?: string } | null
    if (!response.ok || !data?.job) {
      onNotify(data?.error || (action === 'cancel' ? '取消分析失败' : '重新分析失败'), 'error')
      return
    }
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, backgroundTask: data.job } : message
    )))
    onNotify(action === 'cancel' ? '后台分析已取消' : '已重新启动后台分析', action === 'cancel' ? 'info' : 'success')
  }

  const send = async (overrideText?: string, approvalDecision?: { messageId: string; approvalId: string }) => {
    let text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && attachments.length === 0) || loading) return
    const sentAttachments = [...attachments]
    const targetTaskId = Number(text.match(/(?:任务\s*)?#(\d+)/)?.[1] || 0)
    if (sentAttachments.some((item) => item.file) && !targetTaskId && sentAttachments.some((item) => item.type === 'file')) {
      onNotify('上传 PDF、Office 等文件时，请在问题中写明任务 #ID，文件才有明确归属。', 'info')
      return
    }
    if (targetTaskId && sentAttachments.length > 0 && overrideText === undefined) {
      setLoading(true)
      try {
        const uploaded: FileAsset[] = []
        for (const item of sentAttachments) {
          validateUploadFile(item.file)
          const preview = await createOptionalPreviewFile(item.file)
          uploaded.push(await api.uploadFile({
            taskId: targetTaskId,
            scope: 'progress',
            file: item.file,
            preview,
            type: fileTypeForFile(item.file).type,
            size: formatFileSize(item.file.size),
            final: false,
            visible: true,
            tag: 'Agent 对话附件',
            analyze: true,
          }))
        }
        text = `${text}\n\n[已上传到任务 #${targetTaskId} 的真实附件：${uploaded.map((file) => `${file.name}（attachmentId=${file.id}）`).join('、')}]`
      } catch (error) {
        onNotify(error instanceof Error ? `附件上传失败：${error.message}` : '附件上传失败', 'error')
        setLoading(false)
        return
      }
    }
    const displayText = text || `[附件：${attachments.map((a) => a.name).join('、')}]`
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: displayText }
    const assistantId = crypto.randomUUID()
    const baseMessages = (isWelcome ? [] : messages).map((message) => (
      approvalDecision && message.id === approvalDecision.messageId && message.approval?.id === approvalDecision.approvalId
        ? { ...message, approval: { ...message.approval, status: 'processing' as const } }
        : message
    ))
    if (overrideText === undefined) setInput('')
    setAttachments([])

    setMessages([...baseMessages, userMsg, {
      id: assistantId,
      role: 'assistant',
      content: '',
      trace: ['开始分析：识别问题目标与需要核对的依据。'],
      traceStatus: 'running',
    }])
    setLoading(true)
    try {
      const allMessages = [...baseMessages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: allMessages,
          month: currentMonthValue,
          useKnowledge,
          useWebSearch,
          modelChoice: selectedModelChoice,
          attachments: sentAttachments.filter((item) => item.type !== 'file').map(({ type, name, data, mimeType }) => ({ type, name, data, mimeType })),
          agentRuntimeConversationId: agentConversationId,
          localCliConversationId: conversationRecordId,
          temporary: temporaryChat,
          projectId: activeProject?.id,
          projectName: activeProject?.name,
          browserDeviceKey: localCliBrowserDeviceKey(),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? `请求失败：${res.status}`)
      }
      type AgentChatResult = {
        content?: string
        trace?: string[]
        agentRuntimeConversationId?: string
        approval?: AgentApproval
        selection?: AgentTaskSelection
        backgroundTask?: AgentBackgroundTask
        attachments?: AgentResultAttachment[]
      }
      const applyAgentResult = (data: AgentChatResult) => {
        if (data.agentRuntimeConversationId) setAgentConversationId(data.agentRuntimeConversationId)
        setMessages((prev) => prev.map((m) => {
          if (m.id === assistantId) {
            return {
              ...m,
              content: data.content ?? '（无回复）',
              trace: data.trace?.length ? data.trace : m.trace,
              traceStatus: 'completed',
              ...(data.approval?.status === 'pending' ? { approval: data.approval } : {}),
              ...(data.selection ? { selection: data.selection } : {}),
              ...(data.backgroundTask ? { backgroundTask: data.backgroundTask } : {}),
              ...(data.attachments?.length ? { attachments: data.attachments } : {}),
            }
          }
          if (data.approval && m.approval?.id === data.approval.id) {
            return { ...m, approval: data.approval }
          }
          if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) {
            return {
              ...m,
              approval: data.approval ?? {
                ...m.approval,
                status: 'failed',
                error: 'Agent 没有返回操作结果，请重新生成预览。',
              },
            }
          }
          return m
        }))
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/event-stream')) {
        applyAgentResult((await res.json()) as AgentChatResult)
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let streamError = ''
      let receivedResult = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') break
          try {
            const event = JSON.parse(payload) as AgentChatResult & {
              type?: 'trace' | 'route' | 'result' | 'error' | 'done'
              status?: 'running' | 'completed'
              error?: string
              t?: string
              commandId?: string
              runtime?: string
              runtimeLabel?: string
            }
            if (event.type === 'trace' && event.trace?.length) {
              setMessages((prev) => prev.map((m) => (
                m.id === assistantId
                  ? { ...m, trace: event.trace, traceStatus: 'running' }
                  : m
              )))
            } else if (event.type === 'route' && event.runtime === 'local-cli' && event.commandId) {
              setActiveLocalCommandId(event.commandId)
            } else if (event.type === 'result') {
              receivedResult = true
              applyAgentResult(event)
            } else if (event.type === 'error') {
              streamError = event.error || 'Agent 请求失败'
            } else if (event.t) {
              setMessages((prev) => prev.map((m) => (
                m.id === assistantId ? { ...m, content: m.content + event.t } : m
              )))
            }
          } catch { /* skip */ }
        }
      }
      if (streamError) throw new Error(streamError)
      if (!receivedResult) {
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, traceStatus: 'completed' } : m
        )))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败，请重试'
      setMessages((prev) => prev.map((m) => {
        if (m.id === assistantId) {
          return {
            ...m,
            content: `⚠️ ${msg}`,
            trace: [...(m.trace ?? []), '执行失败：请检查服务状态后重试'],
            traceStatus: 'failed',
          }
        }
        if (approvalDecision && m.id === approvalDecision.messageId && m.approval?.id === approvalDecision.approvalId) {
          return { ...m, approval: { ...m.approval, status: 'failed', error: msg } }
        }
        return m
      }))
    } finally {
      setLoading(false)
      setActiveLocalCommandId('')
      setIsCancellingLocalCommand(false)
      void refreshAnalysisJobs()
    }
  }

  const stopLocalCliExecution = async () => {
    if (!activeLocalCommandId || isCancellingLocalCommand) return
    setIsCancellingLocalCommand(true)
    try {
      await api.cancelLocalCliCommand(activeLocalCommandId)
      onNotify('正在停止本机 CLI…', 'info')
    } catch (error) {
      setIsCancellingLocalCommand(false)
      onNotify(error instanceof Error ? error.message : '停止本机 CLI 失败', 'error')
    }
  }

  const updatePlan = async (plan: AgentTaskPlan, action: 'pause' | 'resume' | 'cancel' | 'complete_step' | 'reopen_step', stepId?: string) => {
    const busyKey = `${plan.id}:${action}:${stepId || ''}`
    setTaskCenterBusy(busyKey)
    try {
      const result = await api.updateAgentPlan(plan.id, action, stepId)
      setAgentPlans((current) => action === 'cancel'
        ? current.filter((item) => item.id !== plan.id)
        : current.map((item) => item.id === plan.id ? result.plan : item))
      onNotify(action === 'pause' ? '计划已暂停' : action === 'resume' ? '计划已继续' : action === 'cancel' ? '计划已取消' : '计划步骤已更新', 'success')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '计划更新失败', 'error')
    } finally {
      setTaskCenterBusy('')
    }
  }

  const updateMemory = async (memory: AgentTaskMemory, payload: Parameters<typeof api.updateTaskMemory>[1]) => {
    setTaskCenterBusy(`memory:${memory.taskId}:${payload.action}`)
    try {
      const result = await api.updateTaskMemory(memory.taskId, payload)
      setTaskMemories((current) => current.map((item) => item.taskId === memory.taskId ? result.memory : item))
      if (payload.action === 'add_note') setMemoryNoteDrafts((current) => ({ ...current, [memory.taskId]: '' }))
      onNotify(payload.action === 'set_enabled' && payload.enabled === false ? '已清除并停止该任务记忆' : '任务记忆已更新', 'success')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : '任务记忆更新失败', 'error')
    } finally {
      setTaskCenterBusy('')
    }
  }

  const reminderPrompt = (plan: AgentTaskPlan) => {
    const prefix = plan.taskId ? `任务 #${plan.taskId}` : '这个任务'
    if (plan.goal.includes('验收') || plan.goal.includes('100%')) return `请检查${prefix}当前资料，并生成完整验收草稿；执行前让我确认。`
    if (plan.goal.includes('等待')) return `请检查${prefix}的等待记录和后续进展，判断阻塞是否解除，并给出下一步可确认操作。`
    if (plan.goal.includes('工时')) return `请分析${prefix}实际工时超出预估的原因，并给出可执行的范围调整建议。`
    if (plan.goal.includes('逾期')) return `请检查${prefix}的逾期原因和最新进展，并生成更新进展或调整交付日期的确认草稿。`
    return `请继续处理${prefix}的提醒：${plan.goal}。先核对数据，再生成需要我确认的下一步。`
  }

  const executeReminder = (plan: AgentTaskPlan) => {
    setShowTaskCenter(false)
    void send(reminderPrompt(plan))
  }

  const scopeActive = useKnowledge || useWebSearch
  const activeProviderConfigs = useMemo(
    () => aiProviderConfigs.filter((config) => config.enabled && config.hasApiKey && config.models.includes(config.defaultModel)),
    [aiProviderConfigs],
  )
  const providerModelOptions = activeProviderConfigs.map((config) => {
    const providerLabel = aiProviderDisplayLabel(config.provider)
    return {
      value: `provider:${config.provider}` as ChatModelChoice,
      label: config.defaultModel,
      meta: `${providerLabel} · 手动最高优先级${providerSupportsVision(config.provider) ? ' · 支持识图时图片也优先使用' : ''}`,
      brand: aiBrandForValue(`${config.provider} ${config.defaultModel}`),
    }
  })
  const modelOptions: Array<{ value: ChatModelChoice; label: string; meta: string; brand: AiBrandKey }> = [
    { value: 'auto', label: activeLocalCliRoute ? `自动 · ${activeLocalCliRoute.name}` : '自动路由', meta: activeLocalCliRoute ? '普通问答优先本机 CLI；深度分析、写入和识图自动使用站内 Agent' : '本机 CLI 不可用时由站内 Agent 自动选择模型', brand: activeLocalCliRoute ? aiBrandForValue(activeLocalCliRoute.adapterId) : 'auto' },
    ...providerModelOptions,
  ]
  const usesLocalCli = selectedModelChoice === 'auto' && Boolean(activeLocalCliRoute)
  const activeRuntimeLabel = usesLocalCli ? activeLocalCliRoute!.name : chatModelChoiceLabel(selectedModelChoice, aiModelConfig, aiProviderConfigs)
  const activeRuntimeBrand = usesLocalCli ? aiBrandForValue(activeLocalCliRoute!.adapterId) : aiBrandForValue(`${selectedModelChoice} ${activeRuntimeLabel}`)
  const isModelOptionSelected = (option: (typeof modelOptions)[number]) => {
    if (selectedModelChoice === option.value) return true
    return false
  }
  const taskCenterUnreadCount = analysisJobs.filter((job) => job.unread).length + agentPlans.filter((plan) => plan.unread).length
  const filteredHistoryList = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase()
    return historyList.filter((record) => {
      if (activeProjectId && record.projectId !== activeProjectId) return false
      if (!keyword) return true
      const haystack = [
        record.title,
        record.projectName,
        ...record.messages.map((message) => message.content),
      ].filter(Boolean).join('\n').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [activeProjectId, historyList, historySearch])
  const chooseModel = async (choice: ChatModelChoice) => {
    const previous = selectedModelChoice
    setSelectedModelChoice(choice)
    setShowModelPopup(false)
    try {
      const saved = await api.setActiveAiModelChoice(choice)
      setSelectedModelChoice(normalizeChatModelChoice(saved.choice))
      onNotify(choice === 'auto' ? '已恢复自动模型路由' : `已将 ${chatModelChoiceLabel(choice, aiModelConfig, aiProviderConfigs)} 设为全站 AI 首选`, 'success')
    } catch (error) {
      setSelectedModelChoice(previous)
      onNotify(error instanceof Error ? error.message : '模型优先级保存失败', 'error')
    }
  }

  return (
    <div className="chat-panel" role="dialog" aria-label="爱丽丝">
      {/* header */}
      <div className="chat-panel-header">
        <div className="chat-panel-identity">
          <span className="chat-panel-brand-mark" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          <div className="chat-panel-title">
            <div>
              <span>爱丽丝</span>
              <small>Giverny Agent</small>
            </div>
            <p className="chat-panel-runtime">
              <span aria-hidden="true" />
              {temporaryChat ? '临时对话' : activeProject?.name || activeRuntimeLabel}
              <em>{temporaryChat ? '不保存' : activeProject ? '项目' : usesLocalCli ? '本机' : selectedModelChoice === 'auto' ? '自动路由' : '全站首选'}</em>
            </p>
          </div>
        </div>
        <div className="chat-panel-header-actions">
          <button
            type="button"
            className={`chat-panel-project-btn ${activeProject || showProjectPopup ? 'active' : ''}`}
            onClick={() => {
              setShowProjectPopup((value) => !value)
              setShowHistory(false)
              setShowTaskCenter(false)
              setShowScopePopup(false)
              setShowModelPopup(false)
            }}
            title="新建或切换对话项目"
            aria-label="新建或切换对话项目"
          >
            <Folder size={14} />
            <span>{activeProject?.name || '项目'}</span>
          </button>
          <button type="button" className={`chat-panel-text-btn ${temporaryChat ? 'active' : ''}`} onClick={startTemporaryChat} title="临时对话不进入历史记录">
            临时
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={newConversation} title="新建对话" aria-label="新建对话">
            <Plus size={15} />
          </button>
          <button
            type="button"
            className={`chat-panel-icon-btn ${taskCenterUnreadCount > 0 ? 'has-unread' : ''}`}
            onClick={openHistory}
            title="对话记录与后台任务"
            aria-label="记录与任务"
          >
            <History size={15} />
            {taskCenterUnreadCount > 0 && <span className="chat-task-unread">{Math.min(9, taskCenterUnreadCount)}</span>}
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
      </div>

      {showProjectPopup && (
        <div className="chat-project-popup">
          <div className="chat-project-popup-header">
            <strong>对话项目</strong>
            <span>像文件夹一样收纳同一主题的问题</span>
          </div>
          <div className="chat-project-quick-actions">
            <button type="button" className={!activeProjectId && !temporaryChat ? 'active' : ''} onClick={clearConversationProject}>
              全部对话
            </button>
            <button type="button" className={temporaryChat ? 'active' : ''} onClick={startTemporaryChat}>
              临时对话
            </button>
          </div>
          <div className="chat-project-list">
            {projects.length === 0 ? (
              <p>还没有项目，可以先建一个「金额核对」。</p>
            ) : projects.map((project) => (
              <button key={project.id} type="button" className={activeProjectId === project.id ? 'active' : ''} onClick={() => selectConversationProject(project.id)}>
                <Folder size={13} aria-hidden="true" />
                <span>{project.name}</span>
              </button>
            ))}
          </div>
          <div className="chat-project-create">
            <input
              value={projectDraft}
              onChange={(event) => setProjectDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && createConversationProject()}
              placeholder="新建项目，例如：金额核对"
              aria-label="新建对话项目名称"
            />
            <button type="button" onClick={createConversationProject}>新建项目</button>
          </div>
        </div>
      )}

      {/* messages / welcome screen */}
      <div className="chat-panel-messages">
        {isWelcome ? (
          <div className="alice-welcome">
            <div className="alice-welcome-kicker">Giverny Agent</div>
            <h2 className="alice-welcome-title">嗨，来和爱丽丝聊一聊</h2>
            <p className="alice-welcome-sub">查工作数据、分析收入，或者聊聊设计行业问题</p>
            <div className="alice-suggested">
              {ALICE_SUGGESTED.map((s, index) => (
                <button key={s} type="button" className="alice-suggested-btn" onClick={() => void send(s)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{s}</strong>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                {msg.role === 'assistant' && msg.trace?.length ? (
                  <AgentExecutionTimeline trace={msg.trace} status={msg.traceStatus ?? 'completed'} />
                ) : null}
                {msg.content ? renderChatContent(msg.content) : (msg.role === 'assistant' && loading ? <span className="chat-cursor" /> : '…')}
                {msg.role === 'assistant' && msg.approval && (
                  <AgentApprovalCard
                    approval={msg.approval}
                    busy={loading}
                    onRevise={(draft) => reviseApproval(msg.id, msg.approval!.id, draft)}
                    onOpenTask={onOpenTask}
                    onDecision={(decision) => void send(decision === 'confirm' ? '确认执行' : '取消', {
                      messageId: msg.id,
                      approvalId: msg.approval!.id,
                    })}
                  />
                )}
                {msg.role === 'assistant' && msg.selection && (
                  <AgentTaskSelectionCard
                    selection={msg.selection}
                    busy={loading}
                    onSelect={(candidate) => void send(`选择任务 #${candidate.id}：${candidate.title}`)}
                  />
                )}
                {msg.role === 'assistant' && msg.backgroundTask && (
                  <AgentAnalysisTaskCard
                    task={msg.backgroundTask}
                    busy={loading}
                    onCancel={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'cancel')}
                    onRetry={() => void updateAnalysisTask(msg.id, msg.backgroundTask!.id, 'retry')}
                  />
                )}
                {msg.role === 'assistant' && msg.attachments && msg.attachments.length > 0 && (
                  <AgentAttachmentResults attachments={msg.attachments} onPreview={setAgentPreviewAttachment} />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* attachment preview chips */}
      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map((a) => (
            <div key={a.id} className="chat-attachment-chip">
              {a.type === 'image' && a.preview
                ? <img src={a.preview} className="chat-attachment-thumb" alt={a.name} onClick={() => setLightboxSrc(a.preview ?? null)} style={{ cursor: 'zoom-in' }} />
                : <FileTextIcon size={13} />}
              <span>{a.name}</span>
              <button type="button" className="chat-attachment-remove" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* input card */}
      <div className="alice-input-wrap">
        {showScopePopup && (
          <div className="alice-scope-popup">
            <div className="alice-scope-popup-title">内容范围</div>
            <label className="alice-scope-row">
              <BookOpen size={14} />
              <span>个人知识库</span>
              <div className={`alice-toggle ${useKnowledge ? 'on' : ''}`} onClick={() => setUseKnowledge((v) => !v)} role="switch" aria-checked={useKnowledge} />
            </label>
            <label className="alice-scope-row">
              <Globe size={14} />
              <span>全网搜索</span>
              <div className={`alice-toggle ${useWebSearch ? 'on' : ''}`} onClick={() => setUseWebSearch((v) => !v)} role="switch" aria-checked={useWebSearch} />
            </label>
          </div>
        )}
        {showModelPopup && (
          <div className="alice-model-popup">
            {usesLocalCli && activeLocalCliRoute && (
              <div className="alice-runtime-current">
                <AiBrandIcon brand={aiBrandForValue(activeLocalCliRoute.adapterId)} size={22} />
                <span>
                  <strong>{activeLocalCliRoute.name}</strong>
                  <small>当前回答路线 · {activeLocalCliRoute.deviceName}</small>
                </span>
                <em>本机</em>
              </div>
            )}
            <div className="alice-model-popup-section">
              <div className="alice-model-popup-title">回答路线</div>
              {modelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`alice-model-row ${isModelOptionSelected(option) ? 'active' : ''}`}
                  onClick={() => {
                    void chooseModel(option.value)
                  }}
                >
                  <AiBrandIcon brand={option.brand} size={18} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.meta}</small>
                  </span>
                  {isModelOptionSelected(option) && <CheckCircle2 className="alice-model-selected" size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="alice-model-popup-section">
              <div className="alice-model-popup-title">更多免费模型</div>
              {isLoadingOpenRouterModels && <p className="alice-model-empty">正在读取 OpenRouter 免费模型…</p>}
              {!isLoadingOpenRouterModels && openRouterModels.length === 0 && (
                <p className="alice-model-empty">暂无可用缓存，可先在设置里扫描 OpenRouter 免费模型。</p>
              )}
              {openRouterModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`alice-model-row ${selectedModelChoice === `openrouter:${model.id}` ? 'active' : ''}`}
                  onClick={() => {
                    void chooseModel(`openrouter:${model.id}` as ChatModelChoice)
                  }}
                >
                  <AiBrandIcon brand="openrouter" size={18} />
                  <span>
                    <strong>{model.id}</strong>
                    <small>{[model.vision && '可识图', model.context > 0 && `${Math.round(model.context / 1000)}K 上下文`].filter(Boolean).join(' · ') || 'OpenRouter free'}</small>
                  </span>
                  {selectedModelChoice === `openrouter:${model.id}` && <CheckCircle2 className="alice-model-selected" size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov"
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <div className="alice-input-card">
          <textarea
            ref={inputRef}
            className="alice-textarea"
            value={input}
            rows={1}
            placeholder="向爱丽丝提问…"
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onPaste={handleInputPaste}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          />
          <div className="alice-input-toolbar">
            <button type="button" className="alice-tool-btn" onClick={() => fileInputRef.current?.click()} title="添加附件（图片、txt、md…）" aria-label="添加附件">
              <Plus size={17} />
            </button>
            <button
              type="button"
              className={`alice-tool-btn alice-scope-btn ${scopeActive ? 'active' : ''}`}
              onClick={() => setShowScopePopup((v) => !v)}
              title="选择内容范围"
              aria-label="内容范围"
            >
              <SlidersHorizontal size={15} />
              {scopeActive && (
                <span className="alice-scope-badge">
                  {[useKnowledge && '知识库', useWebSearch && '全网'].filter(Boolean).join('+')}
                </span>
              )}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className={`alice-tool-btn alice-model-btn ${usesLocalCli || selectedModelChoice !== 'auto' ? 'active' : ''}`}
              onClick={openModelPicker}
              title={activeLocalCliRoute ? `当前使用 ${activeLocalCliRoute.name}；点击查看云端回退模型` : '选择模型'}
              aria-label={activeLocalCliRoute ? `当前使用 ${activeLocalCliRoute.name}` : '选择模型'}
            >
              <AiBrandIcon brand={activeRuntimeBrand} size={17} />
              <span className="alice-model-label">{activeRuntimeLabel}</span>
              {activeLocalCliRoute && <span className="alice-runtime-local-tag">本机</span>}
            </button>
            <button
              type="button"
              className="alice-send-btn"
              onClick={() => loading ? void stopLocalCliExecution() : void send()}
              disabled={loading ? !activeLocalCommandId || isCancellingLocalCommand : (!input.trim() && attachments.length === 0)}
              aria-label={loading ? '停止本机 CLI' : '发送'}
              title={loading ? (activeLocalCommandId ? '停止本机 CLI' : 'Agent 正在运行') : '发送'}
            >
              {loading ? <X size={17} /> : <ArrowUp size={17} />}
            </button>
          </div>
        </div>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="附件预览" onClose={() => setLightboxSrc(null)} />}
      {agentPreviewAttachment && <AgentResultPreviewModal attachment={agentPreviewAttachment} onClose={() => setAgentPreviewAttachment(null)} />}

      {/* history panel (absolute overlay within chat-panel) */}
      {showHistory && (
        <div className="chat-history-panel">
          <div className="chat-history-header">
            <div className="chat-record-tabs" role="tablist" aria-label="记录与任务">
              <button type="button" role="tab" aria-selected="true" className="active">对话记录</button>
              <button type="button" role="tab" aria-selected="false" onClick={openTaskCenter}>
                后台任务
                {taskCenterUnreadCount > 0 && <span>{Math.min(9, taskCenterUnreadCount)}</span>}
              </button>
            </div>
            <button type="button" className="chat-panel-icon-btn" onClick={() => setShowHistory(false)} aria-label="关闭记录">
              <X size={15} />
            </button>
          </div>
          <div className="chat-history-tools">
            <div className="chat-history-projects" aria-label="对话项目">
              <button type="button" className={!activeProjectId ? 'active' : ''} onClick={() => setActiveProjectId('')}>全部</button>
              {projects.map((project) => (
                <button key={project.id} type="button" className={activeProjectId === project.id ? 'active' : ''} onClick={() => { setActiveProjectId(project.id); setTemporaryChat(false) }}>
                  <Folder size={13} aria-hidden="true" />{project.name}
                </button>
              ))}
            </div>
            <div className="chat-history-create-project">
              <input
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && createConversationProject()}
                placeholder="新建项目，例如：金额核对"
                aria-label="新建对话项目名称"
              />
              <button type="button" onClick={createConversationProject}>新建项目</button>
            </div>
            <label className="chat-history-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={activeProject ? `搜索「${activeProject.name}」里的对话` : '搜索对话标题和内容'}
                aria-label="搜索对话记录"
              />
            </label>
            <button type="button" className="chat-history-temp-btn" onClick={startTemporaryChat}>开始临时对话</button>
          </div>
          <div className="chat-history-list">
            {filteredHistoryList.length === 0 ? (
              <p className="chat-history-empty">暂无历史记录</p>
            ) : filteredHistoryList.map((r) => (
              <div key={r.id} className="chat-history-item" onClick={() => void loadConversation(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && void loadConversation(r)}>
                <span className="chat-history-item-title">{r.title}</span>
                <div className="chat-history-item-meta">
                  {r.projectName && <em>{r.projectName}</em>}
                  <span>{new Date(r.savedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    className="chat-history-del"
                    onClick={(e) => { e.stopPropagation(); void deleteHistoryItem(r.id) }}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showTaskCenter && (
        <div className="chat-history-panel chat-task-center">
          <div className="chat-history-header">
            <div className="chat-record-tabs" role="tablist" aria-label="记录与任务">
              <button type="button" role="tab" aria-selected="false" onClick={openHistory}>对话记录</button>
              <button type="button" role="tab" aria-selected="true" className="active">后台任务</button>
            </div>
            <button type="button" className="chat-panel-icon-btn" onClick={() => setShowTaskCenter(false)} aria-label="关闭记录"><X size={15} /></button>
          </div>
          <div className="chat-task-center-tabs" role="tablist" aria-label="任务中心内容">
            <button type="button" role="tab" aria-selected={taskCenterTab === 'plans'} className={taskCenterTab === 'plans' ? 'active' : ''} onClick={() => setTaskCenterTab('plans')}>计划与提醒</button>
            <button type="button" role="tab" aria-selected={taskCenterTab === 'memories'} className={taskCenterTab === 'memories' ? 'active' : ''} onClick={() => setTaskCenterTab('memories')}>任务记忆</button>
          </div>
          <div className="chat-history-list">
            {taskCenterTab === 'plans' && agentPlans.map((plan) => {
              const expanded = expandedPlanId === plan.id
              const completedSteps = plan.steps.filter((step) => step.status === 'completed').length
              return (
                <article key={plan.id} className={`chat-task-plan ${plan.unread ? 'unread' : ''}`}>
                  <button type="button" className="chat-task-item" onClick={() => void openAgentPlan(plan)} aria-expanded={expanded}>
                    <span className="chat-task-item-main">
                      <strong>{plan.goal}</strong>
                      <small>{plan.kind === 'reminder' ? '主动提醒' : '持续计划'} · {plan.status === 'completed' ? '已完成' : plan.status === 'paused' ? '已暂停' : `${completedSteps}/${plan.steps.length} 步`}</small>
                    </span>
                    <span className="chat-task-item-meta">{new Date(plan.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {expanded && (
                    <div className="chat-task-plan-detail">
                      <ol className="chat-task-plan-steps">
                        {plan.steps.map((step) => (
                          <li key={step.id} className={step.status}>
                            <button
                              type="button"
                              className="chat-plan-step-toggle"
                              disabled={taskCenterBusy !== '' || plan.status === 'cancelled'}
                              onClick={() => void updatePlan(plan, step.status === 'completed' ? 'reopen_step' : 'complete_step', step.id)}
                              aria-label={step.status === 'completed' ? `重新打开：${step.label}` : `标记完成：${step.label}`}
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <span>{step.label}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="chat-task-plan-actions">
                        {plan.taskId && <button type="button" className="ghost-button compact-button" onClick={() => onOpenTask(plan.taskId!)}><Eye size={13} />查看任务</button>}
                        {plan.kind === 'reminder' && plan.status === 'active' && <button type="button" className="primary-button compact-button" disabled={loading} onClick={() => executeReminder(plan)}>执行建议</button>}
                        {plan.kind === 'goal' && plan.status === 'active' && <button type="button" className="ghost-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'pause')}>暂停</button>}
                        {plan.kind === 'goal' && (plan.status === 'paused' || plan.status === 'completed') && <button type="button" className="ghost-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'resume')}><RotateCcw size={13} />继续</button>}
                        <button type="button" className="danger-text-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updatePlan(plan, 'cancel')}>取消计划</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            {taskCenterTab === 'plans' && analysisJobs.map((job) => (
              <button key={job.id} type="button" className={`chat-task-item ${job.unread ? 'unread' : ''}`} onClick={() => void openAnalysisJob(job)}>
                <span className="chat-task-item-main">
                  <strong>{job.title}</strong>
                  <small>{job.source === 'scheduled' ? '爱丽丝主动生成' : '对话中发起'} · {agentAnalysisStatusLabel(job.status)}</small>
                </span>
                <span className="chat-task-item-meta">{new Date(job.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
              </button>
            ))}
            {taskCenterTab === 'plans' && analysisJobs.length === 0 && agentPlans.length === 0 && <p className="chat-history-empty">暂无持续计划、提醒或后台分析</p>}
            {taskCenterTab === 'memories' && taskMemories.map((memory) => {
              const expanded = expandedMemoryId === memory.taskId
              return (
                <article key={memory.taskId} className={`chat-task-memory ${memory.disabled ? 'disabled' : ''}`}>
                  <button type="button" className="chat-task-item" onClick={() => setExpandedMemoryId((current) => current === memory.taskId ? 0 : memory.taskId)} aria-expanded={expanded}>
                    <span className="chat-task-item-main">
                      <strong>{memory.taskTitle || `任务 #${memory.taskId}`}</strong>
                      <small>{memory.disabled ? '已停止记忆' : `${memory.openItems.length} 项待办 · ${memory.userNotes.length} 条人工纠正`}</small>
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {expanded && (
                    <div className="chat-task-memory-detail">
                      {memory.disabled ? (
                        <button type="button" className="primary-button compact-button" disabled={taskCenterBusy !== ''} onClick={() => void updateMemory(memory, { action: 'set_enabled', enabled: true })}>重新启用记忆</button>
                      ) : (
                        <>
                          <p className="chat-memory-summary">{memory.summary || '等待下一次任务活动后生成摘要。'}</p>
                          {memory.openItems.length > 0 && <div className="chat-memory-section"><strong>待处理</strong>{memory.openItems.map((item) => <div key={item}><span>{item}</span><button type="button" className="ghost-button compact-button" onClick={() => void updateMemory(memory, { action: 'ignore_item', item })}>忽略</button></div>)}</div>}
                          {memory.userNotes.length > 0 && <div className="chat-memory-section"><strong>人工纠正</strong>{memory.userNotes.map((note) => <div key={note}><span>{note}</span><button type="button" className="chat-history-del" title="删除纠正" aria-label={`删除纠正：${note}`} onClick={() => void updateMemory(memory, { action: 'delete_note', note })}><Trash2 size={12} /></button></div>)}</div>}
                          <div className="chat-memory-note-form">
                            <textarea rows={2} value={memoryNoteDrafts[memory.taskId] || ''} placeholder="补充偏好或纠正 Agent 的理解" onChange={(event) => setMemoryNoteDrafts((current) => ({ ...current, [memory.taskId]: event.target.value }))} />
                            <button type="button" className="primary-button compact-button" disabled={!memoryNoteDrafts[memory.taskId]?.trim() || taskCenterBusy !== ''} onClick={() => void updateMemory(memory, { action: 'add_note', note: memoryNoteDrafts[memory.taskId] })}>保存纠正</button>
                          </div>
                          <div className="chat-task-plan-actions">
                            <button type="button" className="ghost-button compact-button" onClick={() => onOpenTask(memory.taskId)}><Eye size={13} />查看任务</button>
                            {memory.ignoredItems.length > 0 && <button type="button" className="ghost-button compact-button" onClick={() => void updateMemory(memory, { action: 'restore_items' })}>恢复已忽略待办</button>}
                            {memoryForgetConfirmId === memory.taskId ? <><button type="button" className="ghost-button compact-button" onClick={() => setMemoryForgetConfirmId(0)}>保留</button><button type="button" className="danger-button compact-button" onClick={() => { setMemoryForgetConfirmId(0); void updateMemory(memory, { action: 'set_enabled', enabled: false }) }}>确认清空</button></> : <button type="button" className="danger-text-button compact-button" onClick={() => setMemoryForgetConfirmId(memory.taskId)}>停止并清空记忆</button>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            {taskCenterTab === 'memories' && taskMemories.length === 0 && <p className="chat-history-empty">暂无任务记忆；Agent 在读取或更新任务后会自动建立。</p>}
          </div>
        </div>
      )}
    </div>
  )
}

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
    const missingCount = dailyKnowledgeQueueSize - merged.length
    const filled = missingCount > 0
      ? mergeDailyKnowledgeQueue(
        [
          ...merged,
          ...fallbackDailyKnowledgeBatch(missingCount, [...excluded, ...merged.map((item) => item.title)]),
        ],
        excluded,
      )
      : merged
    const nextQueue = filled.slice(0, dailyKnowledgeQueueSize)
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
      const fetchTargetCount = Math.min(3, dailyKnowledgeQueueSize)
      for (let index = 0; index < fetchTargetCount; index += 1) {
        const nextItem = await fetchDailyKnowledgeItem(fetchedItems.map((item) => item.title))
        if (!nextItem) {
          break
        }
        fetchedItems.push(nextItem)
        const nextQueue = mergeDailyKnowledgeQueue(
          [nextItem, ...dailyKnowledgeQueueRef.current],
          [dailyKnowledgeRef.current.title],
        ).slice(0, dailyKnowledgeQueueSize)
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
    clearDraftCache(STATE_CACHE_KEY)
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
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img className="brand-logo" src="/giverny-logo.png" alt="" />
          </div>
          <div>
            <strong>
              Giverny
              <span className="brand-watermark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M12 8C9 8 6 9 6 12C6 14 8 15 12 15C16 15 18 14 18 12C18 9 15 8 12 8Z" />
                  <path d="M12 8C12 6 13 5 14 5" />
                  <circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </span>
            </strong>
            <span className={`brand-status ${backendStatus === '后端异常' ? 'error' : backendStatus === '已接入 D1/R2' ? 'ok' : 'pending'}`} title={backendStatus}>
              <i aria-hidden="true" />
              让创作在自己的花园里生长
            </span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {visibleNavItems.map((item) => {
            const shortcut = navShortcutHints[item.label as AppView]
            const ariaShortcut = navAriaShortcutHints[item.label as AppView]
            const NavIcon = item.icon
            return (
              <div key={item.label}>
                <button
                  className={`nav-item ${activeView === item.label ? 'active' : ''}`}
                  aria-label={`切换到${item.label}`}
                  aria-keyshortcuts={ariaShortcut}
                  title={shortcut ? `${item.label}（${shortcut}）` : item.label}
                  onClick={() => navigateView(item.label as AppView)}
                >
                  <NavIcon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-account" ref={accountMenuRef}>
          {isAccountMenuOpen && (
            <div className="sidebar-account-menu" role="menu" aria-label="管理员菜单">
              <div className="account-menu-identity">
                <UserCircle size={18} />
                <div>
                  <strong>{auth?.email || '游客访问'}</strong>
                  <span>{
                    isAdmin ? '最终管理员'
                      : role === 'collaborator' ? '协作者（可录入）'
                      : role === 'viewer' ? '只读全局'
                      : role === 'client' ? '合作伙伴（当月可见）'
                      : auth ? '访问口令（只读）' : '游客只读'
                  }</span>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <button className="account-menu-item" type="button" role="menuitem" onClick={() => { setSettingsEntry({ tab: 'settlement', nonce: Date.now() }); navigateView('设置') }}>
                    <Settings size={17} />
                    <span>全站设置</span>
                  </button>
                  <div
                    className="account-menu-storage"
                    title={storageUsage ? `Cloudflare R2 文件空间 · ${storageUsage.objectCount} 个对象` : 'Cloudflare R2 文件空间'}
                  >
                    <Archive size={17} />
                    <div>
                      <span>R2 文件空间</span>
                      <strong>{formatStorageUsage(storageUsage)}</strong>
                    </div>
                  </div>
                  <button className="account-menu-item danger" type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut size={17} />
                    <span>退出登录</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="account-menu-note">当前只能查看公开任务、进展和合作伙伴可见文件；编辑、上传、验收和结算需要管理员身份。</p>
                  <button className="account-menu-item" type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); setIsLoginModalOpen(true) }}>
                    <KeyRound size={17} />
                    <span>登录管理员</span>
                  </button>
                  {auth && (
                    <button className="account-menu-item danger" type="button" role="menuitem" onClick={handleSignOut}>
                      <LogOut size={17} />
                      <span>退出访问口令</span>
                    </button>
                  )}
                </>
              )}
              <div className="account-menu-version" title={`发布于 ${appReleaseDate}`}>v{appVersion}</div>
            </div>
          )}
          <button
            className={`sidebar-account-trigger ${isAccountMenuOpen || activeView === '设置' ? 'active' : ''}`}
            type="button"
            title="设置（,）"
            aria-keyshortcuts=","
            onClick={() => {
              if (activeView === '设置') {
                setIsAccountMenuOpen((value) => !value)
                return
              }
              setIsAccountMenuOpen(false)
              setSettingsEntry({ tab: 'ai', nonce: Date.now() })
              navigateView('设置')
            }}
          >
            <Settings size={17} aria-hidden="true" />
            <span>设置</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-heading">
            {isTaskCalendarView ? (
              <div className="task-calendar-titlebar">
                <MonthPicker value={currentMonth.value} taskMonthValues={taskMonthValues} onChange={handleTaskCalendarMonthChange} minimal />
                <select
                  className="calendar-mode-select"
                  value={calendarDisplayMode}
                  aria-label="选择日历显示方式"
                  onChange={(event) => setCalendarDisplayMode(event.target.value as CalendarDisplayMode)}
                >
                  <option value="日">日</option>
                  <option value="周">周</option>
                  <option value="月">月</option>
                </select>
                <div className="calendar-period-nav" aria-label="切换日历周期">
                  <button type="button" aria-label="上一周期" title="上一周期" onClick={() => shiftTaskCalendarPeriod(-1)}>
                    <ChevronLeft size={24} />
                  </button>
                  <button type="button" aria-label="下一周期" title="下一周期" onClick={() => shiftTaskCalendarPeriod(1)}>
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <h1>{viewTitle}</h1>
            )}
            {activeView === '工作台' && (
              <p className="topbar-summary">
                本月 {activeMonthTasks.length} 条任务 · {stats.pending} 个待验收
              </p>
            )}
          </div>
          <div className="topbar-actions">
            {!isTaskCalendarView && <MonthPicker value={currentMonth.value} taskMonthValues={taskMonthValues} onChange={setMonthValue} iconOnly />}
            {canSeeFull && (
              <button
                type="button"
                className="topbar-shortcut"
                title="语义搜索：按意思找回历史任务"
                aria-label="语义搜索"
                onClick={() => setIsSemanticSearchOpen(true)}
              >
                <Search size={16} />
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={`topbar-shortcut topbar-assistant-button ${isChatOpen ? 'active' : ''}`}
                title="工作助手 AI 对话"
                aria-label="打开工作助手"
                onClick={toggleChat}
              >
                <Bot size={16} />
                <span>工作助手</span>
              </button>
            )}
            <button
              type="button"
              className="topbar-shortcut"
              title="查看键盘快捷键（?）"
              aria-label="查看快捷键"
              aria-keyshortcuts="Shift+/"
              onClick={() => setIsShortcutHelpOpen(true)}
            >
              <HelpCircle size={16} />
            </button>
            {canWrite && (
              <button
                className="primary-button topbar-create-button"
                title="新建任务（N）"
                aria-keyshortcuts="N"
                onClick={() => openCreateTask(false)}
              >
                <span>新建任务</span>
                <kbd>N</kbd>
              </button>
            )}
          </div>
        </header>

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
        <NewTaskModal
          designTypeGroups={designTypeGroups}
          currentMonthValue={currentMonth.value}
          initialSupplemental={newTaskSupplemental}
          onClose={() => setIsModalOpen(false)}
          onCreate={canWrite ? handleCreateTask : async () => requireAdmin()}
          onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
        />
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

function TaskProgressModal({
  task,
  mode = 'progress',
  editEntryId,
  files,
  activity,
  onClose,
  onUpdateTask,
  onCreateTaskUpdate,
  onUploadImage,
  onPreviewFile,
  onUpdateFile,
  onDeleteFile,
  onConfirmAcceptance,
  onUploadAcceptanceFile,
  onNotify,
  initialAcceptanceMode = false,
  hourlyRate = 0,
}: {
  task: Task
  mode?: ProgressRecordMode
  editEntryId?: string
  files: FileAsset[]
  activity: ActivityItem[]
  onClose: () => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void | Promise<boolean>
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<void>
  onPreviewFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) => Promise<FileAsset>
  onDeleteFile: (fileId: number) => void
  onConfirmAcceptance?: (task: Task, payload: AcceptancePayload) => Promise<void>
  onUploadAcceptanceFile?: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string, preview?: File) => Promise<FileAsset>
  onNotify: (message: string, tone?: ToastTone) => void
  initialAcceptanceMode?: boolean
  hourlyRate?: number
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const replacementInputRef = useRef<HTMLInputElement | null>(null)
  const existingReplacementInputRef = useRef<HTMLInputElement | null>(null)
  const pasteImageFilesRef = useRef<(files: File[]) => void>(() => undefined)
  const [replacementAttachmentId, setReplacementAttachmentId] = useState('')
  const [replacementExistingFileId, setReplacementExistingFileId] = useState<number | null>(null)
  const isWaitingMode = mode === 'waiting'
  const isFeedbackMode = mode === 'feedback'
  const editingEntry = (isWaitingMode ? task.waitingEntries ?? [] : task.timeEntries ?? []).find((entry) => entry.id === editEntryId)
  const initialAcceptanceFlag = initialAcceptanceMode || Boolean(editingEntry?.isAcceptanceProgress)
  const existingEntryAttachments = files.filter((file) => {
    if (file.taskId !== task.id || file.deletedAt) {
      return false
    }
    if (editEntryId && file.entryId === editEntryId) {
      return true
    }
    return initialAcceptanceFlag && task.status === '已验收' && file.scope === 'acceptance'
  })
  const existingAttachmentSignature = existingEntryAttachments.map((file) => `${file.id}:${file.name}`).join('|')
  const progressDraftKey = `giverny:task-progress-draft:${task.id}:${mode}:${editEntryId ?? 'new'}:v2`
  const initialProgressDraft = useMemo(
    () => {
      const currentDefault = defaultTimeEntryDraft()
      const entryDraft = editingEntry
        ? {
            date: editingEntry.date || isoDate(),
            endDate: editingEntry.endDate || editingEntry.date || isoDate(),
            start: editingEntry.start,
            end: editingEntry.end,
            note: editingEntry.note ?? '',
          }
        : currentDefault
      const cachedDraft = readDraftCache(progressDraftKey, {
        note: initialAcceptanceFlag ? task.acceptanceNote ?? editingEntry?.note ?? '' : editingEntry?.note ?? '',
        timeDraft: isWaitingMode ? currentDefault : entryDraft,
        timeEntries: (task.timeEntries ?? []) as TimeEntry[],
        waitingDraft: isWaitingMode ? entryDraft : currentDefault,
        waitingEntries: (task.waitingEntries ?? []) as WaitingEntry[],
        segmentMinutes: Math.max(1, minutesForTimeEntry(entryDraft)),
        scheduleAnchor: 'hours' as ScheduleAnchor,
        feedbackRating: (task.feedbackRating ?? '') as TaskFeedbackRating | '',
        feedbackTags: (task.feedbackTags ?? []) as TaskFeedbackTag[],
        feedbackNote: task.feedbackNote ?? '',
      })
      const resolvedMinutes = Math.max(1, Math.round(Number.isFinite(cachedDraft.segmentMinutes) && cachedDraft.segmentMinutes > 0
        ? cachedDraft.segmentMinutes
        : minutesForTimeEntry(entryDraft)))
      const resolvedAnchor: ScheduleAnchor = (['start', 'hours', 'end'] as ScheduleAnchor[]).includes(cachedDraft.scheduleAnchor)
        ? cachedDraft.scheduleAnchor
        : 'hours'
      // 若缓存里某一端时间为空，在初始化时用「另一端 + 本段工时」补全，避免打开弹窗时显示空白。
      const timeDraftWithDerived = fillTimeDraftFromDuration(cachedDraft.timeDraft, resolvedMinutes)
      const waitingDraftWithDerived = fillTimeDraftFromDuration(cachedDraft.waitingDraft, resolvedMinutes)
      return {
        ...cachedDraft,
        // 始终从 task 取最新快照，避免缓存里的旧 timeEntries/waitingEntries 造成误判冲突
        timeEntries: (task.timeEntries ?? []) as TimeEntry[],
        waitingEntries: (task.waitingEntries ?? []) as WaitingEntry[],
        timeDraft: timeDraftWithDerived,
        waitingDraft: waitingDraftWithDerived,
        segmentMinutes: resolvedMinutes,
        scheduleAnchor: resolvedAnchor,
      }
    },
    [editingEntry, initialAcceptanceFlag, isWaitingMode, progressDraftKey, task.acceptanceNote, task.feedbackNote, task.feedbackRating, task.feedbackTags, task.timeEntries, task.waitingEntries],
  )
  const [note, setNote] = useState(initialProgressDraft.note)
  const [timeDraft, setTimeDraft] = useState<TimeEntryDraft>(initialProgressDraft.timeDraft)
  const [draftTimeEntries] = useState<TimeEntry[]>(initialProgressDraft.timeEntries)
  const [waitingDraft, setWaitingDraft] = useState<TimeEntryDraft>(initialProgressDraft.waitingDraft)
  const [draftWaitingEntries] = useState<WaitingEntry[]>(initialProgressDraft.waitingEntries)
  const [segmentMinutes, setSegmentMinutes] = useState(initialProgressDraft.segmentMinutes)
  const [segmentDurationInput, setSegmentDurationInput] = useState(() => formatEstimatedDurationInputValue(initialProgressDraft.segmentMinutes))
  const [isSegmentDurationFocused, setIsSegmentDurationFocused] = useState(false)
  const [scheduleDerivedField, setScheduleDerivedField] = useState<ScheduleAnchor>(initialProgressDraft.scheduleAnchor)
  const [hasTouchedSchedule, setHasTouchedSchedule] = useState(Boolean(editingEntry))
  const [isSaving, setIsSaving] = useState(false)
  const [timeEntryError, setTimeEntryError] = useState('')
  const [activeDatePickerId, setActiveDatePickerId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<PendingProgressAttachment[]>(
    () => progressAttachmentDraftCache.get(progressDraftKey) ?? [],
  )
  // 本次草稿对应的稳定 entryId：预上传与最终生成的进展条目共用，确保文件挂到正确条目。
  const stagedEntryIdRef = useRef<string>(
    editEntryId ?? stagedEntryIdCache.get(progressDraftKey) ?? crypto.randomUUID(),
  )
  if (!editEntryId && !stagedEntryIdCache.has(progressDraftKey)) {
    stagedEntryIdCache.set(progressDraftKey, stagedEntryIdRef.current)
  }
  // 进行中的预上传 Promise（按附件 id 索引），保存时若仍在传则等待其完成。
  const [existingAttachmentDrafts, setExistingAttachmentDrafts] = useState<Record<number, string>>({})
  const [existingAttachmentAiState, setExistingAttachmentAiState] = useState<Record<number, {
    loading?: boolean
    error?: string
    suggestion?: AttachmentNameSuggestion
  }>>({})
  const [uploadingExistingFileId, setUploadingExistingFileId] = useState<number | null>(null)
  const [updatingExistingAcceptanceFileId, setUpdatingExistingAcceptanceFileId] = useState<number | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<PendingProgressAttachment | null>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragDepthRef = useRef(0)
  // 多段工时：用户在本次进展中预暂存的额外时间段（尚未提交到 DB）
  const [pendingExtraSegments, setPendingExtraSegments] = useState<TimeEntry[]>([])
  const [isAcceptanceMode, setIsAcceptanceMode] = useState(initialAcceptanceFlag)
  const initialPlanStartValue = toDateTimeInputValue(task.date || isoDateTime())
  const fallbackPlanEndValue = addMinutesToPlanDateTime(
    initialPlanStartValue || isoDateTime(),
    Math.max(1, Math.round((task.estimatedHours > 0 ? task.estimatedHours : 1) * 60)),
  )
  const initialPlanEndValue = toDateTimeInputValue(task.estimatedDate || fallbackPlanEndValue)
  const initialPlanDuration = exactDurationMinutesBetween(initialPlanStartValue, initialPlanEndValue)
  const initialPlanMinutes = Math.max(
    1,
    Math.round(task.estimatedHours > 0 ? task.estimatedHours * 60 : initialPlanDuration > 0 ? initialPlanDuration : 60),
  )
  const [planReferenceDraft, setPlanReferenceDraft] = useState<TimeEntryDraft>(() => ({
    date: datePart(initialPlanStartValue || isoDateTime()),
    start: initialPlanStartValue ? initialPlanStartValue.slice(11, 16) : '09:00',
    endDate: datePart(initialPlanEndValue || fallbackPlanEndValue),
    end: (initialPlanEndValue || fallbackPlanEndValue).slice(11, 16),
    note: '',
  }))
  const [planReferenceMinutes, setPlanReferenceMinutes] = useState(initialPlanMinutes)
  const [planReferenceDurationInput, setPlanReferenceDurationInput] = useState(() => formatEstimatedDurationInputValue(initialPlanMinutes))
  const [isPlanReferenceDurationFocused, setIsPlanReferenceDurationFocused] = useState(false)
  const [planReferenceDerivedField, setPlanReferenceDerivedField] = useState<ScheduleAnchor>('hours')
  // 验收阶段是否计入本次工时：默认计入；关闭后本次验收不新增工时（已汇总工时仍保留），
  // 用于「临近验收时一两分钟的小改动不想计时」等极少数特殊情况。
  const [countAcceptanceTime, setCountAcceptanceTime] = useState(true)
  // 普通进展是否计入工时：默认计入；编辑已有分段时以保存的 isUncounted 为准。
  // 适用于「对方只给了点修改反馈，想留个进展记录但不算工时」等场景。
  const [countProgressTime, setCountProgressTime] = useState(() => {
    if (isFeedbackMode) {
      return false
    }
    if (!editingEntry) {
      return true
    }
    if (editingEntry.isUncounted) {
      return false
    }
    return minutesForTimeEntry(editingEntry) > 0
  })
  // 本次进展是否为「改稿轮次」：显式开关，开 = 计入需求人画像的改稿轮次；
  // 关 = 只是把任务分阶段提交，不算改稿。仅用于画像/AI 分析，不影响计时与结算。
  const [isRevisionRound, setIsRevisionRound] = useState(isFeedbackMode ? editingEntry?.isRevision !== false : Boolean(editingEntry?.isRevision))
  const [feedbackVersion, setFeedbackVersion] = useState(editingEntry?.feedbackVersion ?? '')
  const [feedbackSource, setFeedbackSource] = useState(partnerFacingText(editingEntry?.feedbackSource))
  const [isAcceptanceBaseExpanded, setIsAcceptanceBaseExpanded] = useState(false)
  const acceptanceBaseRef = useRef<HTMLElement | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<TaskFeedbackRating | ''>(initialProgressDraft.feedbackRating ?? '')
  const [feedbackTags, setFeedbackTags] = useState<TaskFeedbackTag[]>(initialProgressDraft.feedbackTags ?? [])
  const [feedbackNote, setFeedbackNote] = useState(initialProgressDraft.feedbackNote ?? '')
  const [progressAiSuggestion, setProgressAiSuggestion] = useState<TextAssistantSuggestion | null>(null)
  const [progressAiError, setProgressAiError] = useState('')
  const [isProgressAiLoading, setIsProgressAiLoading] = useState(false)
  const progressAiSuggestionAppliedRef = useRef<({ context: TextLearningContext } & AiLearningDraft) | null>(null)
  const pendingAttachmentAiNameAppliedRef = useRef<Record<string, AiLearningDraft>>({})
  const existingAttachmentAiNameAppliedRef = useRef<Record<number, AiLearningDraft>>({})
  const uploadedNames = pendingAttachments.map((attachment) => sanitizeAttachmentName(attachment.name, attachment.originalName))
  const projectProgressHistory = taskAssistantProgressHistory(task, files)
  const savedTimeSignature = JSON.stringify(task.timeEntries ?? [])
  const timeDirty = JSON.stringify(draftTimeEntries) !== savedTimeSignature
  const savedWaitingSignature = JSON.stringify(task.waitingEntries ?? [])
  const waitingDirty = JSON.stringify(draftWaitingEntries) !== savedWaitingSignature
  const activeDraft = isWaitingMode ? waitingDraft : timeDraft
  const updateActiveDraft = (updater: (current: TimeEntryDraft) => TimeEntryDraft) => {
    if (isWaitingMode) {
      setWaitingDraft(updater)
      return
    }
    setTimeDraft(updater)
  }
  const toggleAcceptanceMode = () => {
    if (isAcceptanceMode) {
      setTimeDraft((current) => ({
        ...current,
        note: note.trim() ? note : current.note,
      }))
    } else if (!note.trim() && timeDraft.note.trim()) {
      setNote(timeDraft.note)
    }
    setIsAcceptanceMode((current) => !current)
    setIsAcceptanceBaseExpanded(false)
  }
  const activeStartDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDraft.date || '') ? activeDraft.date : isoDate()
  const activeEndDate = /^\d{4}-\d{2}-\d{2}$/.test(activeDraft.endDate || '') ? activeDraft.endDate : activeStartDate
  const draftEntry = {
    date: activeStartDate,
    endDate: activeEndDate,
    start: activeDraft.start,
    end: activeDraft.end,
  }
  const draftEntryMinutes = minutesForTimeEntry(draftEntry)
  const hasDraftTimeEntry = activeDraft.start.trim() !== '' && activeDraft.end.trim() !== '' && draftEntryMinutes > 0
  const isEditingEntry = Boolean(editEntryId && editingEntry)
  const comparableEntries = [...draftTimeEntries, ...draftWaitingEntries, ...pendingExtraSegments].filter((entry) => entry.id !== editEntryId)
  const draftConflict = activeDraft.start.trim() && activeDraft.end.trim() && draftEntryMinutes > 0
    ? comparableEntries.find((entry) => timeEntriesOverlap(draftEntry, entry))
    : undefined
  const isAcceptanceRevisionMode = isAcceptanceMode && task.status === '已验收'
  const isEditingAcceptanceEntry = Boolean(isEditingEntry && editingEntry?.isAcceptanceProgress)
  const isRollingBackAcceptanceEntry = isEditingAcceptanceEntry && !isAcceptanceMode && task.status === '已验收'
  const hasAnotherAcceptanceProgress = !isWaitingMode && (task.timeEntries ?? []).some((entry) => entry.isAcceptanceProgress && entry.id !== editEntryId)
  const canToggleAcceptanceMode = Boolean(onConfirmAcceptance) && !isWaitingMode && !isFeedbackMode && !hasAnotherAcceptanceProgress && (task.status !== '已验收' || isEditingAcceptanceEntry)
  const isConvertingEntryToAcceptance = isAcceptanceMode && isEditingEntry && !editingEntry?.isAcceptanceProgress && task.status !== '已验收'
  const showAcceptanceTaskReference = () => {
    setIsAcceptanceBaseExpanded(true)
    window.requestAnimationFrame(() => {
      acceptanceBaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }
  const shouldIncludeAcceptanceDraftEntry = !isWaitingMode && !isFeedbackMode && !isEditingEntry && hasTouchedSchedule && hasDraftTimeEntry && !draftConflict && countAcceptanceTime
  // 本次是否计入工时：等待恒计；验收看 countAcceptanceTime；普通进展看 countProgressTime
  const timeCounts = isWaitingMode ? true : isFeedbackMode ? false : isAcceptanceMode ? countAcceptanceTime : countProgressTime
  // 只有「验收且不计工时」才锁定时间输入；普通进展即便不计工时，时间仍可自选
  const lockSchedule = isAcceptanceMode && !countAcceptanceTime
  // 不计工时的普通进展：没有有效时间段也能保存，只要有备注或附件（计 0 工时，仅作进展记录）
  const isZeroTimeProgress = !isWaitingMode && !isAcceptanceMode && !countProgressTime
  const canSaveZeroTimeProgress = isZeroTimeProgress && (note.trim().length > 0 || (activeDraft.note ?? '').trim().length > 0 || pendingAttachments.length > 0)
  const suggestedTimeSlot = draftConflict ? findNearestAvailableTimeSlot(draftEntry, comparableEntries) : null
  const applySuggestedTimeSlot = () => {
    if (!suggestedTimeSlot) {
      return
    }
    setHasTouchedSchedule(true)
    updateActiveDraft((current) => ({
      ...current,
      date: datePart(suggestedTimeSlot.start),
      start: suggestedTimeSlot.start.slice(11, 16),
      endDate: datePart(suggestedTimeSlot.end),
      end: suggestedTimeSlot.end.slice(11, 16),
    }))
    setSegmentMinutes(Math.max(1, minutesForTimeEntry({
      date: datePart(suggestedTimeSlot.start),
      start: suggestedTimeSlot.start.slice(11, 16),
      endDate: datePart(suggestedTimeSlot.end),
      end: suggestedTimeSlot.end.slice(11, 16),
    })))
    setTimeEntryError('')
    setActiveDatePickerId(null)
  }

  useEffect(() => {
    writeDraftCache(progressDraftKey, {
      note,
      timeDraft,
      timeEntries: draftTimeEntries,
      waitingDraft,
      waitingEntries: draftWaitingEntries,
      segmentMinutes,
      scheduleAnchor: scheduleDerivedField,
      feedbackRating,
      feedbackTags,
      feedbackNote,
    })
  }, [draftTimeEntries, draftWaitingEntries, feedbackNote, feedbackRating, feedbackTags, note, progressDraftKey, scheduleDerivedField, segmentMinutes, timeDraft, waitingDraft])

  // mount 后修复：若派生字段（结束/开始时间）为空，立即补全并写回 state
  const initRepairRef = useRef(false)
  useEffect(() => {
    if (initRepairRef.current) return
    initRepairRef.current = true
    const mins = initialProgressDraft.segmentMinutes
    setTimeDraft((current) => fillTimeDraftFromDuration(current, mins))
    setWaitingDraft((current) => fillTimeDraftFromDuration(current, mins))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    progressAttachmentDraftCache.set(progressDraftKey, pendingAttachments)
  }, [pendingAttachments, progressDraftKey])

  useEffect(() => {
    setExistingAttachmentDrafts((current) => {
      const next: Record<number, string> = {}
      existingEntryAttachments.forEach((file) => {
        next[file.id] = current[file.id] ?? file.name
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAttachmentSignature])

  const buildDraftTimeEntry = (options?: { isAcceptanceProgress?: boolean }) => {
    const start = activeDraft.start.trim()
    const end = activeDraft.end.trim()
    const rawNote = isAcceptanceMode ? note : (activeDraft.note || note)
    const noteText = rawNote?.trim() ?? ''
    if (isWaitingMode) {
      if (!start || !activeStartDate) {
        return null
      }
      return {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: activeStartDate,
        endDate: activeStartDate,
        start,
        end: start,
        note: noteText,
      } as WaitingEntry
    }
    if (isFeedbackMode) {
      if (!noteText && pendingAttachments.length === 0) {
        return null
      }
      const hasPicked = Boolean(start && activeStartDate)
      const nowDate = isoDate()
      const nowTime = isoDateTime().slice(11, 16) || '00:00'
      return {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: hasPicked ? activeStartDate : nowDate,
        endDate: hasPicked ? activeStartDate : nowDate,
        start: hasPicked ? start : nowTime,
        end: hasPicked ? start : nowTime,
        note: noteText,
        isClientFeedback: true,
        isUncounted: true,
        isRevision: isRevisionRound,
        feedbackVersion: feedbackVersion.trim(),
        feedbackSource: feedbackSource.trim() || '合作伙伴',
      } as TimeEntry
    }
    // 不计工时的普通进展：时间由用户自选（用于记录与排序），计 0 工时。未选时间则锚到当前时刻。
    if (isZeroTimeProgress) {
      if (!noteText && pendingAttachments.length === 0) {
        return null
      }
      const hasPicked = Boolean(start && activeStartDate)
      const nowDate = isoDate()
      const nowTime = isoDateTime().slice(11, 16) || '00:00'
      const entry: TimeEntry = {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: hasPicked ? activeStartDate : nowDate,
        endDate: hasPicked ? (activeEndDate || activeStartDate) : nowDate,
        start: hasPicked ? start : nowTime,
        end: hasPicked ? (end || start) : nowTime,
        note: noteText,
        isUncounted: true,
      }
      if (isRevisionRound) {
        entry.isRevision = true
      }
      return entry
    }
    if (!start || !end || draftEntryMinutes <= 0) {
      return null
    }
    const entry: TimeEntry = { id: editEntryId ?? stagedEntryIdRef.current, date: activeStartDate, endDate: activeEndDate, start, end, note: noteText }
    if (options?.isAcceptanceProgress) {
      entry.isAcceptanceProgress = true
    }
    // 改稿轮次仅对普通工作进展有意义（等待记录不算改稿）
    if (!isWaitingMode && isRevisionRound) {
      entry.isRevision = true
    }
    return entry
  }

  // 把附件直接上传到后台（带预览生成 + 进度回调），返回服务端文件记录。
  // 不触发全局刷新/通知——这些副作用留到保存时统一处理。
  const stageUploadAttachment = async (
    attachment: PendingProgressAttachment,
    onProgress: (ratio: number) => void,
  ): Promise<FileAsset> => {
    // 用户可能先添加附件、再切换为验收进展。保存时必须以当前模式为准，
    // 不能沿用附件刚加入时的旧 scope，否则验收文件会被误存为普通进展附件。
    const acceptance = isAcceptanceMode || attachment.uploadScope === 'acceptance'
    const prepared = await ensurePendingAttachmentPreparation(attachment)
    const uploadFile = renamedFile(prepared.uploadFile, attachment.name)
    const lightweightPreview = prepared.previewFile
    if (acceptance && onUploadAcceptanceFile) {
      return onUploadAcceptanceFile(task.id, uploadFile, onProgress, stagedEntryIdRef.current, lightweightPreview)
    }
    const extension = fileTypeForFile(uploadFile).type
    const preview = lightweightPreview ?? await createOptionalPreviewFile(uploadFile)
    return api.uploadFile(
      {
        taskId: task.id,
        entryId: stagedEntryIdRef.current,
        scope: acceptance ? 'acceptance' : 'progress',
        file: uploadFile,
        preview,
        type: extension,
        size: formatFileSize(uploadFile.size),
        final: acceptance,
        visible: true,
        tag: acceptance ? '验收文件' : undefined,
        analyze: true,
      },
      onProgress,
    )
  }

  const startStagedUpload = (attachment: PendingProgressAttachment) => {
    attachment.uploadStatus = 'uploading'
    attachment.uploadProgress = 0
    attachment.uploadError = undefined
    let renderedProgressBucket = -1
    const uploadPromise = stageUploadAttachment(attachment, (ratio) => {
      attachment.uploadProgress = ratio
      const progressBucket = ratio >= 1 ? 10 : Math.floor(Math.max(0, ratio) * 10)
      if (progressBucket === renderedProgressBucket) return
      renderedProgressBucket = progressBucket
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachment.id ? { ...item, uploadProgress: ratio } : item,
      ))
    })
      .then((saved) => {
        if (attachment.discarded) {
          void api.deleteFile(saved.id).catch(() => {})
          return undefined
        }
        attachment.uploadedFile = saved
        attachment.uploadStatus = 'done'
        attachment.uploadProgress = 1
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'done', uploadProgress: 1, uploadedFile: saved, uploadError: undefined }
            : item,
        ))
        return saved
      })
      .catch((error) => {
        attachment.uploadStatus = 'error'
        attachment.uploadError = error instanceof Error ? error.message : '上传失败'
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'error', uploadError: attachment.uploadError }
            : item,
        ))
        return undefined
      })
    attachment.uploadPromise = uploadPromise
    setPendingAttachments((current) => current.map((item) =>
      item.id === attachment.id
        ? { ...item, uploadStatus: 'uploading', uploadProgress: 0, uploadPromise, uploadError: undefined }
        : item,
    ))
  }

  // 移除某个待上传附件：若已传到后台则顺手删除，避免产生孤儿文件。
  const discardStagedFile = (fileId?: number) => {
    if (typeof fileId === 'number') {
      void api.deleteFile(fileId).catch(() => {})
    }
  }

  const discardStagedAttachment = (attachment: PendingProgressAttachment) => {
    attachment.discarded = true
    if (attachment.uploadedFile) {
      discardStagedFile(attachment.uploadedFile.id)
      return
    }
    void attachment.uploadPromise?.then((saved) => {
      if (saved) {
        discardStagedFile(saved.id)
      }
    })
  }

  // 保存时才上传，避免用户关闭弹窗后在 R2/D1 留下未关联的暂存文件。
  const finalizeStagedAttachments = async (): Promise<{ names: string[]; failures: string[] }> => {
    const names: string[] = []
    const failures: string[] = []
    for (const attachment of pendingAttachments) {
      let saved = attachment.uploadedFile ?? await attachment.uploadPromise
      if (!saved) {
        setPendingAttachments((current) => current.map((item) =>
          item.id === attachment.id ? { ...item, uploadStatus: 'uploading', uploadProgress: 0, uploadError: undefined } : item,
        ))
        try {
          saved = await stageUploadAttachment(attachment, (ratio) => {
            setPendingAttachments((current) => current.map((item) =>
              item.id === attachment.id ? { ...item, uploadProgress: ratio } : item,
            ))
          })
          attachment.uploadedFile = saved
          attachment.uploadPromise = Promise.resolve(saved)
          setPendingAttachments((current) => current.map((item) =>
            item.id === attachment.id ? { ...item, uploadStatus: 'done', uploadProgress: 1, uploadedFile: saved, uploadError: undefined } : item,
          ))
        } catch (error) {
          setPendingAttachments((current) => current.map((item) =>
            item.id === attachment.id
              ? { ...item, uploadStatus: 'error', uploadError: error instanceof Error ? error.message : '上传失败' }
              : item,
          ))
        }
      }
      const finalName = sanitizeAttachmentName(attachment.name, attachment.originalName)
      if (!saved) {
        failures.push(`${finalName}：上传失败，请重试`)
        continue
      }
      if (finalName !== saved.name) {
        try {
          await onUpdateFile(saved.id, { name: finalName })
        } catch {
          // 改名失败不阻断保存：文件已在，仅显示名沿用上传时的名字。
        }
      }
      names.push(finalName)
    }
    return { names, failures }
  }

  const addPendingFiles = (fileList: FileList | File[] | null, source: 'picker' | 'paste' = 'picker') => {
    const selectedFiles = Array.from(fileList ?? [])
    if (selectedFiles.length === 0) {
      return
    }
    setUploadErrors([])
    const nextAttachments: PendingProgressAttachment[] = []
    const nextErrors: string[] = []
    selectedFiles.forEach((file) => {
      try {
        validateUploadFile(file)
        const displayName = source === 'paste' ? pastedImageName(file) : file.name
        nextAttachments.push({
          id: crypto.randomUUID(),
          file,
          name: displayName,
          originalName: file.name,
          uploadScope: isAcceptanceMode ? 'acceptance' : 'progress',
        })
      } catch (error) {
        nextErrors.push(error instanceof Error ? error.message : `${file.name}：文件无法添加`)
      }
    })
    if (nextAttachments.length > 0) {
      setPendingAttachments((current) => [...current, ...nextAttachments])
      nextAttachments.forEach((attachment) => {
        if (attachment.uploadScope === 'acceptance') {
          startStagedUpload(attachment)
        }
        if (looksLikeUntidyFileName(attachment.name)) {
          window.setTimeout(() => void requestAttachmentNameSuggestion(attachment.id, attachment), 0)
        }
      })
    }
    if (nextErrors.length > 0) {
      setUploadErrors(nextErrors)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  pasteImageFilesRef.current = (pastedImages) => addPendingFiles(pastedImages, 'paste')

  useEffect(() => {
    const routeModalImagePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || !event.clipboardData) return
      const pastedImages = Array.from(event.clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (pastedImages.length === 0) return
      event.preventDefault()
      event.stopPropagation()
      pasteImageFilesRef.current(pastedImages)
    }
    window.addEventListener('paste', routeModalImagePaste, true)
    return () => window.removeEventListener('paste', routeModalImagePaste, true)
  }, [])

  const replacePendingAttachment = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !replacementAttachmentId) {
      return
    }
    try {
      validateUploadFile(file)
      const previous = pendingAttachments.find((item) => item.id === replacementAttachmentId)
      discardStagedFile(previous?.uploadedFile?.id)
      const replaced: PendingProgressAttachment = {
        id: replacementAttachmentId,
        file,
        name: file.name,
        originalName: file.name,
        uploadScope: previous?.uploadScope ?? (isAcceptanceMode ? 'acceptance' : 'progress'),
      }
      setPendingAttachments((current) => current.map((attachment) =>
        attachment.id === replacementAttachmentId ? replaced : attachment,
      ))
      if (replaced.uploadScope === 'acceptance') {
        startStagedUpload(replaced)
      }
      setUploadErrors([])
    } catch (error) {
      setUploadErrors([error instanceof Error ? error.message : `${file.name}：文件无法替换`])
    } finally {
      setReplacementAttachmentId('')
      if (replacementInputRef.current) {
        replacementInputRef.current.value = ''
      }
    }
  }

  const addReplacementExistingAttachment = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file || !replacementExistingFileId) {
      return
    }
    const existingFile = existingEntryAttachments.find((item) => item.id === replacementExistingFileId)
    if (!existingFile) {
      return
    }
    setUploadingExistingFileId(existingFile.id)
    setUploadErrors([])
    try {
      validateUploadFile(file)
      if (isAcceptanceMode && existingFile.scope === 'acceptance' && onUploadAcceptanceFile) {
        await onUploadAcceptanceFile(task.id, file, undefined, existingFile.entryId || editEntryId)
      } else {
        await onUploadImage(task.id, file, undefined, existingFile.entryId ?? editEntryId)
      }
    } catch (error) {
      setUploadErrors([error instanceof Error ? error.message : `${file.name}：文件无法添加`])
    } finally {
      setUploadingExistingFileId(null)
      setReplacementExistingFileId(null)
      if (existingReplacementInputRef.current) {
        existingReplacementInputRef.current.value = ''
      }
    }
  }

  const requestAttachmentNameSuggestion = async (
    attachmentId: string,
    attachmentSnapshot?: PendingProgressAttachment,
  ) => {
    const attachment = attachmentSnapshot ?? pendingAttachments.find((item) => item.id === attachmentId)
    if (!attachment || attachment.aiLoading) {
      return
    }
    setPendingAttachments((current) => current.map((item) =>
      item.id === attachmentId ? { ...item, aiLoading: true, aiError: undefined, aiSuggestion: undefined } : item,
    ))
    try {
      const suggestion = await api.suggestAttachmentName({
        fileName: sanitizeAttachmentName(attachment.name, attachment.originalName),
        mimeType: attachment.file.type,
        imageBase64: await imageFileBase64(await ensurePendingAttachmentPreview(attachment) ?? attachment.file),
        note,
        recentFileNames: files.filter((file) => file.taskId === task.id).map((file) => file.name).slice(-12),
        task,
      })
      const unchanged = suggestion.unchanged || !suggestion.suggestedName || suggestion.suggestedName === attachment.name
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId ? { ...item, aiLoading: false, aiSuggestion: unchanged ? undefined : suggestion } : item,
      ))
      if (!unchanged) {
        pendingAttachmentAiNameAppliedRef.current[attachmentId] = {
          sourceInput: sanitizeAttachmentName(attachment.name, attachment.originalName),
          aiOutput: suggestion.suggestedName,
          applied: false,
        }
      }
    } catch {
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId
          ? { ...item, aiLoading: false, aiError: 'AI 命名暂时不可用，请稍后重试或手动填写。' }
          : item,
      ))
    }
  }

  const saveExistingAttachmentName = async (file: FileAsset) => {
    const draftName = existingAttachmentDrafts[file.id] ?? file.name
    const nextName = sanitizeAttachmentName(draftName, file.name)
    setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: nextName }))
    const learning = existingAttachmentAiNameAppliedRef.current[file.id]
    if (learning) {
      void api.recordAiLearningEvent({
        context: 'attachment_name',
        sourceInput: learning.sourceInput,
        aiOutput: learning.aiOutput,
        userFinal: nextName,
        action: aiLearningAction(learning, nextName),
        designType: task.type,
        taskId: task.id,
        taskTitle: task.title,
      })
      delete existingAttachmentAiNameAppliedRef.current[file.id]
    }
    if (nextName === file.name) {
      return
    }
    await onUpdateFile(file.id, { name: nextName })
  }

  const saveDirtyExistingAttachmentNames = async () => {
    for (const file of existingEntryAttachments) {
      const draftName = existingAttachmentDrafts[file.id]
      if (draftName && sanitizeAttachmentName(draftName, file.name) !== file.name) {
        await saveExistingAttachmentName(file)
      }
    }
  }

  const isExistingAttachmentAcceptanceFile = (file: FileAsset) => {
    const acceptanceFileNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))
    return isAcceptanceFileAsset(file, acceptanceFileNames)
  }

  const toggleExistingAttachmentAcceptanceFile = async (file: FileAsset) => {
    if (updatingExistingAcceptanceFileId === file.id) {
      return
    }
    setUpdatingExistingAcceptanceFileId(file.id)
    try {
      await saveExistingAttachmentName(file)
      const finalName = sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name) || file.name
      const currentTags = parseFileTags(file.tag).filter((tag) => tag !== '验收文件' && tag !== '验收附件')
      const isMarked = isExistingAttachmentAcceptanceFile(file)
      if (isMarked) {
        await onUpdateFile(file.id, {
          scope: 'progress',
          tag: serializeFileTags(currentTags),
        })
        onUpdateTask(task.id, {
          acceptanceFiles: (task.acceptanceFiles ?? []).filter((name) => name !== file.name && name !== finalName),
        })
        return
      }
      await onUpdateFile(file.id, {
        scope: 'acceptance',
        tag: serializeFileTags([...currentTags, '验收文件']),
      })
      onUpdateTask(task.id, {
        acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), finalName])),
      })
    } finally {
      setUpdatingExistingAcceptanceFileId(null)
    }
  }

  const demoteRollbackAcceptanceAttachments = async () => {
    if (!isRollingBackAcceptanceEntry) {
      return
    }
    const rollbackFiles = existingEntryAttachments.filter((file) => file.scope === 'acceptance')
    if (rollbackFiles.length === 0) {
      return
    }
    await Promise.all(rollbackFiles.map((file) => {
      const nextTags = parseFileTags(file.tag).filter((tag) => tag !== '验收文件')
      return onUpdateFile(file.id, {
        scope: 'progress',
        tag: serializeFileTags(nextTags),
      })
    }))
  }

  const requestExistingAttachmentNameSuggestion = async (file: FileAsset) => {
    const aiState = existingAttachmentAiState[file.id]
    if (aiState?.loading) {
      return
    }
    setExistingAttachmentAiState((current) => ({
      ...current,
      [file.id]: { loading: true },
    }))
    try {
      const fileType = fileTypeForAsset(file).type
      const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
      const suggestion = await api.suggestAttachmentName({
        fileName: sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name),
        mimeType: file.mimeType || file.type,
        imageBase64: await imageUrlBase64(previewUrl),
        note,
        recentFileNames: files.filter((item) => item.taskId === task.id && item.id !== file.id).map((item) => item.name).slice(-12),
        task,
      })
      const currentName = sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name)
      const unchanged = suggestion.unchanged || !suggestion.suggestedName || suggestion.suggestedName === currentName
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, suggestion: unchanged ? undefined : suggestion },
      }))
      if (!unchanged) {
        existingAttachmentAiNameAppliedRef.current[file.id] = {
          sourceInput: currentName,
          aiOutput: suggestion.suggestedName,
          applied: false,
        }
      }
    } catch {
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, error: 'AI 命名暂时不可用，请稍后重试或手动填写。' },
      }))
    }
  }

  const requestAllAttachmentNameSuggestions = () => {
    existingEntryAttachments.forEach((file) => {
      void requestExistingAttachmentNameSuggestion(file)
    })
    pendingAttachments.forEach((attachment) => {
      void requestAttachmentNameSuggestion(attachment.id)
    })
  }

  const recordAppliedTextLearning = (finalText: string) => {
    const applied = progressAiSuggestionAppliedRef.current
    const userFinal = finalText.trim()
    const aiOutput = applied?.aiOutput.trim() ?? ''
    if (!applied || !aiOutput) {
      return
    }
    void api.recordAiLearningEvent({
      context: applied.context,
      sourceInput: applied.sourceInput,
      aiOutput,
      userFinal,
      action: aiLearningAction(applied, userFinal),
      designType: task.type,
      taskId: task.id,
      taskTitle: task.title,
    })
    progressAiSuggestionAppliedRef.current = null
  }

  const recordAppliedAttachmentNameLearning = () => {
    pendingAttachments.forEach((attachment) => {
      const learning = pendingAttachmentAiNameAppliedRef.current[attachment.id]
      const userFinal = sanitizeAttachmentName(attachment.name, attachment.originalName)
      if (learning) {
        void api.recordAiLearningEvent({
          context: 'attachment_name',
          sourceInput: learning.sourceInput,
          aiOutput: learning.aiOutput,
          userFinal,
          action: aiLearningAction(learning, userFinal),
          designType: task.type,
          taskId: task.id,
          taskTitle: task.title,
        })
      }
      delete pendingAttachmentAiNameAppliedRef.current[attachment.id]
    })
  }

  // 验收态：工时汇总计算（复用现有工具函数）
  const acceptanceTimeEntries = task.timeEntries ?? []
  const acceptanceWaitingEntries = task.waitingEntries ?? []
  const acceptancePreviewEntry = countAcceptanceTime && hasDraftTimeEntry && !draftConflict
    ? buildDraftTimeEntry({ isAcceptanceProgress: true })
    : null
  const acceptancePreviewTimeEntries = isConvertingEntryToAcceptance && acceptancePreviewEntry
    ? acceptanceTimeEntries.map((entry) => entry.id === editEntryId ? acceptancePreviewEntry : entry)
    : shouldIncludeAcceptanceDraftEntry
      ? [...acceptanceTimeEntries, { id: 'acceptance-preview-entry', date: activeStartDate, endDate: activeEndDate, start: activeDraft.start.trim(), end: activeDraft.end.trim(), note: note.trim(), isAcceptanceProgress: true }]
      : acceptanceTimeEntries
  const acceptanceWaitingPreviewTask = acceptancePreviewTimeEntries === acceptanceTimeEntries
    ? task
    : { ...task, timeEntries: acceptancePreviewTimeEntries }
  const acceptanceComputedMinutes = sumTimeEntries(acceptancePreviewTimeEntries)
  const acceptanceLockedHours = Math.round((acceptanceComputedMinutes / 60) * 100) / 100
  const acceptanceBillablePreviewTimeEntries = acceptancePreviewTimeEntries.filter((entry) => minutesForTimeEntry(entry) > 0)
  const acceptanceWaitingMinutes = sumWaitingEntries(acceptanceWaitingPreviewTask)
  const acceptanceEstimatedAmount = roundCents(acceptanceLockedHours * hourlyRate)
  const canConfirmAcceptance = (acceptanceLockedHours > 0 || isAcceptanceRevisionMode || !countAcceptanceTime) && !isSaving && Boolean(onConfirmAcceptance) && !hasAnotherAcceptanceProgress && (!countAcceptanceTime || !draftConflict)
  const progressHeaderHint = isAcceptanceMode
    ? ''
    : isWaitingMode
      ? '记录非工作的等待开始时间，仅用于洞察分析，不计入结算工时'
      : isFeedbackMode
        ? '记录合作伙伴给出的版本反馈、批注意见或聊天截图，默认不计工时但进入生命周期'
      : isEditingEntry
        ? '修改这段记录的内容和时间'
        : `${task.title} · 按时间段计时，工时自动累计并计入结算`
  const toggleFeedbackTag = (tag: TaskFeedbackTag) => {
    setFeedbackTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  const saveProgress = async () => {
    if (isSaving) {
      return
    }
    setTimeEntryError('')
    const shouldKeepAcceptanceProgress = isEditingAcceptanceEntry && isAcceptanceMode
    const shouldAllowAcceptedTimeEdit = isEditingAcceptanceEntry && task.status === '已验收'
    const nextEntry = buildDraftTimeEntry({ isAcceptanceProgress: shouldKeepAcceptanceProgress })
    // 0 时长进展不占时间段，跳过重叠校验。
    if (nextEntry && minutesForTimeEntry(nextEntry) > 0) {
      const conflict = comparableEntries.find((entry) => timeEntriesOverlap(nextEntry, entry))
      if (conflict) {
        setTimeEntryError(`这个时间段和 ${formatEntryDateTimeRange(task, conflict)} 已有记录重叠，请改到前后相邻的空档。`)
        return
      }
    }

    setIsSaving(true)
    onClose()
    onNotify(pendingAttachments.some((attachment) => attachment.uploadStatus !== 'done')
      ? '进展已提交，附件将在后台继续上传'
      : '进展已提交，正在后台同步', 'info')

    void (async () => {
      try {
        const persistTaskChanges = async (changes: Parameters<typeof onUpdateTask>[1]) => {
          const saved = await Promise.resolve(onUpdateTask(task.id, changes))
          if (saved === false) {
            throw new Error('任务数据同步失败')
          }
        }

        await saveDirtyExistingAttachmentNames()
        await demoteRollbackAcceptanceAttachments()
        const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
        if (uploadFailures.length > 0) {
          throw new Error(uploadFailures.join('；'))
        }
        recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
        recordAppliedAttachmentNameLearning()
        const planScheduleChanges = buildPlanScheduleChanges()
        const hasPlanScheduleChanges = Object.keys(planScheduleChanges).length > 0
        const shouldStartFromProgress = task.status === '计划中' && !isWaitingMode && !isFeedbackMode && !isEditingEntry
        const nextTimeEntries = !isWaitingMode
          ? isEditingEntry && nextEntry
            ? draftTimeEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry)
            : (() => {
                const newSegs = [...pendingExtraSegments, ...(nextEntry ? [nextEntry] : [])]
                const batchGroupId = newSegs.length > 1 ? crypto.randomUUID() : undefined
                const taggedSegs = batchGroupId ? newSegs.map((s) => ({ ...s, groupId: batchGroupId })) : newSegs
                return [...draftTimeEntries, ...taggedSegs]
              })()
          : draftTimeEntries
        const nextWaitingEntries = isWaitingMode && nextEntry
          ? isEditingEntry ? draftWaitingEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry) : [...draftWaitingEntries, nextEntry]
          : draftWaitingEntries
        if (!isWaitingMode && (timeDirty || nextEntry || pendingExtraSegments.length > 0 || shouldStartFromProgress)) {
          const nextActualHours = Math.round((sumTimeEntries(nextTimeEntries) / 60) * 100) / 100
          await persistTaskChanges({
            ...planScheduleChanges,
            timeEntries: nextTimeEntries,
            actualHours: nextActualHours,
            ...(shouldStartFromProgress ? { startFromProgress: true } : {}),
            ...(shouldAllowAcceptedTimeEdit ? { allowAcceptedTimeEdit: true } : {}),
            ...(isRollingBackAcceptanceEntry ? {
              status: '待验收',
              progress: Math.min(task.progress, 80),
              actualDeliveryDate: '',
              acceptanceNote: '',
              acceptanceFiles: [],
              feedbackRating: '',
              feedbackTags: [],
              feedbackNote: '',
              allowAcceptanceRollback: true,
            } : {}),
          })
        } else if (hasPlanScheduleChanges) {
          await persistTaskChanges(planScheduleChanges)
        }
        if (isWaitingMode && (waitingDirty || nextEntry)) {
          await persistTaskChanges({ waitingEntries: nextWaitingEntries })
        }
        // 单独标记为验收文件的附件：更新 scope/tag，并追加到 task.acceptanceFiles
        const perAcceptanceAttachments = !isAcceptanceMode && !isRollingBackAcceptanceEntry
          ? pendingAttachments.filter((a) => a.isAcceptanceFile && a.uploadedFile)
          : []
        if (perAcceptanceAttachments.length > 0) {
          await Promise.all(perAcceptanceAttachments.map((a) =>
            onUpdateFile(a.uploadedFile!.id, { tag: '验收文件', scope: 'acceptance' }),
          ))
          const perAcceptanceNames = perAcceptanceAttachments.map((a) => sanitizeAttachmentName(a.name, a.originalName))
          await persistTaskChanges({
            acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), ...perAcceptanceNames])),
          })
        }
        const body = note.trim() || nextEntry?.note?.trim() || ''
        if (body || finalizedUploadedNames.length > 0) {
          await onCreateTaskUpdate(task.id, {
            title: isRollingBackAcceptanceEntry
              ? '验收进展已撤回'
              : isEditingEntry
                ? (isWaitingMode ? '等待记录已修改' : isFeedbackMode ? '反馈记录已修改' : '进展记录已修改')
                : (isWaitingMode ? '等待记录' : isFeedbackMode ? `${partnerFacingText(feedbackSource)}反馈` : '进展更新'),
            body: body || `上传过程附件：${finalizedUploadedNames.join('、')}`,
            hours: 0,
            visible: false,
          })
        }
        clearDraftCache(progressDraftKey)
        progressAttachmentDraftCache.delete(progressDraftKey)
        stagedEntryIdCache.delete(progressDraftKey)
        onNotify(isWaitingMode ? '等待记录已同步' : isFeedbackMode ? '修改建议已同步' : '进展与附件已同步', 'success')
      } catch (error) {
        onNotify(error instanceof Error ? `后台保存进展失败：${error.message}` : '后台保存进展失败，请重新打开任务重试', 'error')
      }
    })()
  }

  // 验收进展：先记录本次进展（工时/附件），再触发验收确认
  const confirmAcceptanceFromProgress = async () => {
    if (isSaving || !onConfirmAcceptance) {
      return
    }
    setTimeEntryError('')
    const nextEntry = isConvertingEntryToAcceptance
      ? buildDraftTimeEntry({ isAcceptanceProgress: true })
      : shouldIncludeAcceptanceDraftEntry ? buildDraftTimeEntry({ isAcceptanceProgress: true }) : null
    if (nextEntry) {
      const conflict = comparableEntries.find((entry) => timeEntriesOverlap(nextEntry, entry))
      if (conflict) {
        setTimeEntryError(`这个时间段和 ${formatEntryDateTimeRange(task, conflict)} 已有记录重叠，请改到前后相邻的空档。`)
        return
      }
    }

    // 验收附件在选择后已开始上传。提交时把剩余工作交给后台，立即释放弹窗。
    setIsSaving(true)
    onClose()
    onNotify(pendingAttachments.some((attachment) => attachment.uploadStatus !== 'done')
      ? '验收已提交，附件将在后台继续上传'
      : '验收已提交，正在后台完成同步', 'info')

    void (async () => {
      try {
        await saveDirtyExistingAttachmentNames()
        const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
        if (uploadFailures.length > 0) {
          throw new Error(uploadFailures.join('；'))
        }
        recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
        recordAppliedAttachmentNameLearning()
        const nextTimeEntries = isConvertingEntryToAcceptance && nextEntry
          ? acceptanceTimeEntries.map((entry) => entry.id === editEntryId ? nextEntry : entry)
          : nextEntry ? [...acceptanceTimeEntries, nextEntry] : acceptanceTimeEntries
        const nextActualHours = nextTimeEntries.length > 0
          ? Math.round((sumTimeEntries(nextTimeEntries) / 60) * 100) / 100
          : task.actualHours
        const planScheduleChanges = buildPlanScheduleChanges()
        const taskForAcceptance = Object.keys(planScheduleChanges).length > 0
          ? { ...task, ...planScheduleChanges }
          : task
        const body = note.trim() || nextEntry?.note?.trim() || ''
        if (body || finalizedUploadedNames.length > 0) {
          await onCreateTaskUpdate(task.id, {
            title: '验收进展',
            body: body || `上传验收附件：${finalizedUploadedNames.join('、')}`,
            hours: 0,
            visible: false,
          })
        }
        await onConfirmAcceptance(taskForAcceptance, {
          actualHours: nextActualHours,
          acceptanceNote: note.trim() || task.acceptanceNote || '',
          feedbackRating,
          feedbackTags: feedbackRating && feedbackRating !== '顺利' ? feedbackTags : [],
          feedbackNote: feedbackNote.trim(),
          timeEntries: nextTimeEntries,
          waitingEntries: acceptanceWaitingEntries,
          acceptanceFiles: Array.from(new Set([...(task.acceptanceFiles ?? []), ...existingEntryAttachments.map((file) => file.name), ...finalizedUploadedNames])),
          taskChanges: planScheduleChanges,
        })
        clearDraftCache(progressDraftKey)
        progressAttachmentDraftCache.delete(progressDraftKey)
        stagedEntryIdCache.delete(progressDraftKey)
        onNotify('验收已完成，附件与任务状态均已同步', 'success')
      } catch (error) {
        onNotify(error instanceof Error ? `后台验收失败：${error.message}` : '后台验收失败，请重新打开任务重试', 'error')
      }
    })()
  }

  const requestProgressAiSuggestion = async () => {
    setProgressAiError('')
    setProgressAiSuggestion(null)
    setIsProgressAiLoading(true)
    try {
      const assistantTask = isAcceptanceMode
        ? { ...task, actualHours: acceptanceLockedHours, timeEntries: acceptancePreviewTimeEntries }
        : task
      const suggestion = await api.optimizeTaskTextAssistant({
        mode: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
        text: note,
        task: assistantTask,
        files: taskAssistantFiles(task, files, uploadedNames),
        activity: taskAssistantActivity(activity),
        uploadedFileNames: uploadedNames,
        progressHistory: isAcceptanceMode ? taskAssistantProgressHistory(assistantTask, files) : undefined,
      })
      setProgressAiSuggestion(suggestion)
      progressAiSuggestionAppliedRef.current = {
        context: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
        sourceInput: note.trim(),
        aiOutput: suggestion.optimizedText,
        applied: false,
      }
    } catch (error) {
      setProgressAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsProgressAiLoading(false)
    }
  }

  const swapDraftTimes = () => {
    setHasTouchedSchedule(true)
    updateActiveDraft((current) => ({
      ...current,
      date: current.endDate || current.date,
      start: current.end,
      endDate: current.date,
      end: current.start,
    }))
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const progressStartValue = activeDraft.date && normalizeClockInput(activeDraft.start)
    ? `${activeDraft.date}T${normalizeClockInput(activeDraft.start)}`
    : ''
  const progressEndValue = activeDraft.endDate && normalizeClockInput(activeDraft.end)
    ? `${activeDraft.endDate}T${normalizeClockInput(activeDraft.end)}`
    : ''
  const planReferenceStartValue = planReferenceDraft.date && normalizeClockInput(planReferenceDraft.start)
    ? `${planReferenceDraft.date}T${normalizeClockInput(planReferenceDraft.start)}`
    : ''
  const planReferenceEndValue = planReferenceDraft.endDate && normalizeClockInput(planReferenceDraft.end)
    ? `${planReferenceDraft.endDate}T${normalizeClockInput(planReferenceDraft.end)}`
    : ''
  const hasWaitingStart = isWaitingMode && Boolean(progressStartValue)
  const waitingPreviewEntry = hasWaitingStart
    ? {
        id: editEntryId ?? stagedEntryIdRef.current,
        date: datePart(progressStartValue),
        endDate: datePart(progressStartValue),
        start: progressStartValue.slice(11, 16),
        end: progressStartValue.slice(11, 16),
        note: note.trim(),
      } as WaitingEntry
    : null
  const waitingPreviewMinutes = waitingPreviewEntry ? minutesForWaitingEntry(task, waitingPreviewEntry) : 0

  const writePlanReferenceStart = (value: string) => {
    setPlanReferenceDraft((current) => ({
      ...current,
      date: value ? datePart(value) : '',
      start: value ? value.slice(11, 16) : '',
    }))
  }

  const writePlanReferenceEnd = (value: string) => {
    setPlanReferenceDraft((current) => ({
      ...current,
      endDate: value ? datePart(value) : '',
      end: value ? value.slice(11, 16) : '',
    }))
  }

  const updatePlanReferenceStart = (value: string) => {
    writePlanReferenceStart(value)
    if (!value) {
      return
    }
    if (planReferenceDerivedField === 'end') {
      writePlanReferenceEnd(addMinutesToPlanDateTime(value, planReferenceMinutes))
      return
    }
    if (planReferenceEndValue) {
      const nextMinutes = exactDurationMinutesBetween(value, planReferenceEndValue)
      if (nextMinutes > 0) {
        setPlanReferenceMinutes(nextMinutes)
      }
    }
  }

  const updatePlanReferenceEnd = (value: string) => {
    writePlanReferenceEnd(value)
    if (!value) {
      return
    }
    if (planReferenceDerivedField === 'start') {
      writePlanReferenceStart(addMinutesToPlanDateTime(value, -planReferenceMinutes))
      return
    }
    if (planReferenceStartValue) {
      const nextMinutes = exactDurationMinutesBetween(planReferenceStartValue, value)
      if (nextMinutes > 0) {
        setPlanReferenceMinutes(nextMinutes)
      }
    }
  }

  const updatePlanReferenceMinutes = (value: number) => {
    const nextMinutes = Math.max(1, Math.round(Number.isFinite(value) ? value : 0))
    setPlanReferenceMinutes(nextMinutes)
    if (planReferenceDerivedField === 'start' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -nextMinutes))
      return
    }
    if (planReferenceDerivedField === 'end' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, nextMinutes))
      return
    }
    if (planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, nextMinutes))
      return
    }
    if (planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -nextMinutes))
    }
  }

  useEffect(() => {
    if (!isPlanReferenceDurationFocused) {
      setPlanReferenceDurationInput(formatEstimatedDurationInputValue(planReferenceMinutes))
    }
  }, [isPlanReferenceDurationFocused, planReferenceMinutes])

  const updatePlanReferenceDurationInput = (value: string) => {
    setPlanReferenceDurationInput(value.slice(0, 32))
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updatePlanReferenceMinutes(nextMinutes)
    }
  }

  const commitPlanReferenceDurationInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(planReferenceDurationInput)
    if (nextMinutes) {
      updatePlanReferenceMinutes(nextMinutes)
    }
    setPlanReferenceDurationInput(formatEstimatedDurationInputValue(nextMinutes || planReferenceMinutes))
    setIsPlanReferenceDurationFocused(false)
  }

  const applyPlanReferenceDerivedField = (field: ScheduleAnchor) => {
    const currentReferenceMinutes = exactDurationMinutesBetween(planReferenceStartValue, planReferenceEndValue)
    if (field === 'start' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -planReferenceMinutes))
    } else if (field === 'start' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, planReferenceMinutes))
    } else if (field === 'end' && planReferenceStartValue) {
      writePlanReferenceEnd(addMinutesToPlanDateTime(planReferenceStartValue, planReferenceMinutes))
    } else if (field === 'end' && planReferenceEndValue) {
      writePlanReferenceStart(addMinutesToPlanDateTime(planReferenceEndValue, -planReferenceMinutes))
    } else if (field === 'hours' && currentReferenceMinutes > 0) {
      setPlanReferenceMinutes(currentReferenceMinutes)
    }
  }

  const togglePlanReferenceScheduleField = (field: ScheduleAnchor) => {
    const nextField = planReferenceDerivedField !== field ? field : field === 'start' ? 'end' : 'start'
    setPlanReferenceDerivedField(nextField)
    applyPlanReferenceDerivedField(nextField)
    setActiveDatePickerId(null)
  }

  const buildPlanScheduleChanges = (): TaskUpdateChanges => {
    if (!isAcceptanceMode || isWaitingMode) {
      return {}
    }
    const changes: TaskUpdateChanges = {}
    const nextEstimatedHours = planReferenceMinutes / 60
    if (planReferenceStartValue && planReferenceStartValue !== toDateTimeInputValue(task.date || '')) {
      changes.date = planReferenceStartValue
    }
    if (planReferenceEndValue && planReferenceEndValue !== toDateTimeInputValue(task.estimatedDate || '')) {
      changes.estimatedDate = planReferenceEndValue
    }
    if (Number.isFinite(nextEstimatedHours) && nextEstimatedHours > 0 && Math.round(nextEstimatedHours * 1000) / 1000 !== Math.round((task.estimatedHours || 0) * 1000) / 1000) {
      changes.estimatedHours = nextEstimatedHours
    }
    return changes
  }

  useEffect(() => {
    if (lockSchedule || segmentMinutes <= 0) {
      return
    }
    const startVal = normalizeClockInput(activeDraft.start)
    const endVal = normalizeClockInput(activeDraft.end)
    if (!endVal && startVal && activeDraft.date) {
      const computed = addMinutesToPlanDateTime(`${activeDraft.date}T${startVal}`, segmentMinutes)
      updateActiveDraft((current) => {
        const currentStart = normalizeClockInput(current.start)
        const currentEnd = normalizeClockInput(current.end)
        if (currentEnd || currentStart !== startVal || current.date !== activeDraft.date) {
          return current
        }
        return { ...current, start: startVal, endDate: computed.slice(0, 10), end: computed.slice(11, 16) }
      })
      return
    }
    if (!startVal && endVal && (activeDraft.endDate || activeDraft.date)) {
      const computed = addMinutesToPlanDateTime(`${activeDraft.endDate || activeDraft.date}T${endVal}`, -segmentMinutes)
      updateActiveDraft((current) => {
        const currentStart = normalizeClockInput(current.start)
        const currentEnd = normalizeClockInput(current.end)
        if (currentStart || currentEnd !== endVal || (current.endDate || current.date) !== (activeDraft.endDate || activeDraft.date)) {
          return current
        }
        return { ...current, date: computed.slice(0, 10), start: computed.slice(11, 16), endDate: current.endDate || current.date, end: endVal }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraft.date, activeDraft.end, activeDraft.endDate, activeDraft.start, lockSchedule, segmentMinutes])

  const writeProgressStart = (value: string) => {
    updateActiveDraft((current) => ({
      ...current,
      date: value ? datePart(value) : '',
      start: value ? value.slice(11, 16) : '',
    }))
  }

  const writeProgressEnd = (value: string) => {
    updateActiveDraft((current) => ({
      ...current,
      endDate: value ? datePart(value) : '',
      end: value ? value.slice(11, 16) : '',
    }))
  }

  const updateProgressStart = (value: string) => {
    setHasTouchedSchedule(true)
    writeProgressStart(value)
    if (!value) {
      return
    }
    if (scheduleDerivedField === 'hours' && progressEndValue) {
      const nextMinutes = exactDurationMinutesBetween(value, progressEndValue)
      if (nextMinutes > 0) {
        setSegmentMinutes(nextMinutes)
      }
      return
    }
    if (scheduleDerivedField === 'end') {
      writeProgressEnd(addMinutesToPlanDateTime(value, segmentMinutes))
    }
  }

  const updateProgressEnd = (value: string) => {
    setHasTouchedSchedule(true)
    writeProgressEnd(value)
    if (!value) {
      return
    }
    if (scheduleDerivedField === 'hours' && progressStartValue) {
      const nextMinutes = exactDurationMinutesBetween(progressStartValue, value)
      if (nextMinutes > 0) {
        setSegmentMinutes(nextMinutes)
      }
      return
    }
    if (scheduleDerivedField === 'start') {
      writeProgressStart(addMinutesToPlanDateTime(value, -segmentMinutes))
    }
  }

  const updateProgressMinutes = (value: number) => {
    setHasTouchedSchedule(true)
    const nextMinutes = Math.max(1, Math.round(Number.isFinite(value) ? value : segmentMinutes))
    setSegmentMinutes(nextMinutes)
    if (scheduleDerivedField === 'start' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -nextMinutes))
      return
    }
    if (scheduleDerivedField === 'start' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, nextMinutes))
      return
    }
    if (scheduleDerivedField === 'end' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, nextMinutes))
      return
    }
    if (scheduleDerivedField === 'end' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -nextMinutes))
    }
  }

  useEffect(() => {
    if (!isSegmentDurationFocused) {
      setSegmentDurationInput(formatEstimatedDurationInputValue(segmentMinutes))
    }
  }, [isSegmentDurationFocused, segmentMinutes])

  const updateSegmentDurationInput = (value: string) => {
    setSegmentDurationInput(value.slice(0, 32))
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updateProgressMinutes(nextMinutes)
    }
  }

  const commitSegmentDurationInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(segmentDurationInput)
    if (nextMinutes) {
      updateProgressMinutes(nextMinutes)
    }
    setSegmentDurationInput(formatEstimatedDurationInputValue(nextMinutes || segmentMinutes))
    setIsSegmentDurationFocused(false)
  }

  const applyVoiceProgressSchedule = (result: VoiceScheduleResult) => {
    setHasTouchedSchedule(true)
    if (result.startAt && result.durationMinutes && result.endAt) {
      setSegmentMinutes(result.durationMinutes)
      updateActiveDraft((current) => ({
        ...current,
        date: datePart(result.startAt || current.date),
        start: result.startAt?.slice(11, 16) || current.start,
        endDate: datePart(result.endAt || current.endDate || current.date),
        end: result.endAt?.slice(11, 16) || current.end,
      }))
      if (result.derivedField) setScheduleDerivedField(result.derivedField)
    } else {
      if (result.suppliedFields.includes('start') && result.startAt) updateProgressStart(result.startAt)
      if (result.suppliedFields.includes('hours') && result.durationMinutes) updateProgressMinutes(result.durationMinutes)
      if (result.suppliedFields.includes('end') && result.endAt) updateProgressEnd(result.endAt)
    }
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyVoicePlanReferenceSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt && result.durationMinutes && result.endAt) {
      setPlanReferenceMinutes(result.durationMinutes)
      setPlanReferenceDraft((current) => ({
        ...current,
        date: datePart(result.startAt || current.date),
        start: result.startAt?.slice(11, 16) || current.start,
        endDate: datePart(result.endAt || current.endDate || current.date),
        end: result.endAt?.slice(11, 16) || current.end,
      }))
      if (result.derivedField) setPlanReferenceDerivedField(result.derivedField)
    } else {
      if (result.suppliedFields.includes('start') && result.startAt) updatePlanReferenceStart(result.startAt)
      if (result.suppliedFields.includes('hours') && result.durationMinutes) updatePlanReferenceMinutes(result.durationMinutes)
      if (result.suppliedFields.includes('end') && result.endAt) updatePlanReferenceEnd(result.endAt)
    }
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyVoiceSingleProgressTime = (result: VoiceScheduleResult) => {
    const value = result.startAt || result.endAt
    if (!value) return
    setHasTouchedSchedule(true)
    writeProgressStart(value)
    writeProgressEnd(value)
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const applyProgressDerivedField = (field: ScheduleAnchor) => {
    if (field === 'start' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -segmentMinutes))
    } else if (field === 'start' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, segmentMinutes))
    } else if (field === 'end' && progressStartValue) {
      writeProgressEnd(addMinutesToPlanDateTime(progressStartValue, segmentMinutes))
    } else if (field === 'end' && progressEndValue) {
      writeProgressStart(addMinutesToPlanDateTime(progressEndValue, -segmentMinutes))
    } else if (field === 'hours' && draftEntryMinutes > 0) {
      setSegmentMinutes(draftEntryMinutes)
    }
  }

  const toggleProgressScheduleField = (field: ScheduleAnchor) => {
    setHasTouchedSchedule(true)
    const nextField = scheduleDerivedField !== field ? field : field === 'start' ? 'end' : 'start'
    setScheduleDerivedField(nextField)
    applyProgressDerivedField(nextField)
    setTimeEntryError('')
  }

  const syncPlanReferenceToProgress = () => {
    const referenceMinutes = exactDurationMinutesBetween(planReferenceStartValue, planReferenceEndValue)
    if (!planReferenceStartValue || !planReferenceEndValue || referenceMinutes <= 0) {
      setTimeEntryError('预计结束时间需晚于预计开始时间，才能同步到实际工时')
      return
    }
    setHasTouchedSchedule(true)
    setScheduleDerivedField(planReferenceDerivedField)
    setSegmentMinutes(referenceMinutes)
    updateActiveDraft((current) => ({
      ...current,
      date: datePart(planReferenceStartValue),
      start: planReferenceStartValue.slice(11, 16),
      endDate: datePart(planReferenceEndValue),
      end: planReferenceEndValue.slice(11, 16),
    }))
    setActiveDatePickerId(null)
    setTimeEntryError('')
  }

  const sortSegmentsByTime = (segs: TimeEntry[]) =>
    [...segs].sort((a, b) => {
      const ta = `${a.date}T${a.start}`
      const tb = `${b.date}T${b.start}`
      return tb.localeCompare(ta) // 降序：最新的排最上
    })

  // 将当前输入段暂存，并用「上段结束时间 + 1h」预填下一段
  const stashCurrentSegment = () => {
    const entry = buildDraftTimeEntry()
    if (!entry || minutesForTimeEntry(entry) <= 0) return
    const stashedEntry = { ...entry, id: crypto.randomUUID() }
    setPendingExtraSegments((current) => sortSegmentsByTime([...current, stashedEntry]))
    const prevEnd = activeDraft.end
    const prevEndDate = activeDraft.endDate || activeDraft.date
    const nextStartFull = `${prevEndDate || activeDraft.date}T${prevEnd}`
    const nextEndFull = addMinutesToPlanDateTime(nextStartFull, DURATION_STEP_MINUTES * 2) // 默认 1h
    updateActiveDraft((current) => ({
      ...current,
      date: prevEndDate || current.date,
      endDate: nextEndFull.slice(0, 10),
      start: prevEnd,
      end: nextEndFull.slice(11, 16),
    }))
    setScheduleDerivedField('hours') // 工时派生，start/end 均可见
    setSegmentMinutes(DURATION_STEP_MINUTES * 2)
    setTimeEntryError('')
  }

  // 将一个暂存段装回当前输入框进行编辑；若当前草稿有效则先暂存它
  const editStashedSegment = (seg: TimeEntry) => {
    const currentEntry = buildDraftTimeEntry()
    const currentValid = currentEntry && minutesForTimeEntry(currentEntry) > 0
    setPendingExtraSegments((current) => {
      const withoutTarget = current.filter((s) => s.id !== seg.id)
      if (currentValid) {
        return sortSegmentsByTime([...withoutTarget, { ...currentEntry, id: crypto.randomUUID() }])
      }
      return withoutTarget
    })
    // 将该段的时间填入当前草稿
    updateActiveDraft((current) => ({
      ...current,
      date: seg.date ?? current.date,
      endDate: seg.endDate ?? seg.date ?? current.endDate,
      start: seg.start,
      end: seg.end,
    }))
    setScheduleDerivedField('hours')
    setSegmentMinutes(minutesForTimeEntry(seg))
    setTimeEntryError('')
  }

  const totalPendingMinutes = pendingExtraSegments.reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)

  const waitingTimeFields = (
    <section className="progress-lite-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>等待开始时间</span>
          <small>截止时间取同一任务下一段工作进展的开始时间</small>
        </div>
        <VoiceScheduleButton
          context="等待记录的开始时间"
          currentStart={progressStartValue}
          onApply={applyVoiceSingleProgressTime}
        />
      </div>
      <div className="progress-schedule-wrap">
        <div className="new-task-schedule-row progress-lite-schedule-row">
          <PlanDateTimeField
            label="开始时间"
            value={progressStartValue}
            onChange={(value) => {
              setHasTouchedSchedule(true)
              writeProgressStart(value)
              if (value) {
                writeProgressEnd(value)
              }
              setTimeEntryError('')
            }}
            isActive
            readOnly={false}
            pickerId="waiting-start"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">自动截止</span>
            <output className="new-task-hours-input new-task-hours-output" aria-label="等待截止规则">
              {waitingPreviewEntry && waitingPreviewMinutes > 0 ? formatDuration(waitingPreviewMinutes) : '下一段工作进展'}
            </output>
          </div>
        </div>
      </div>
      <p className={`progress-lite-duration ${hasWaitingStart ? '' : 'invalid'}`} role="status">
        {hasWaitingStart
          ? waitingPreviewMinutes > 0
            ? `当前会按下一段工作进展自动计算为等待 ${formatDuration(waitingPreviewMinutes)}`
            : '保存后显示为等待中；下一次记录工作进展分段计时时自动截止'
          : '请选择等待开始时间'}
      </p>
    </section>
  )

  const feedbackTimeFields = (
    <section className="progress-lite-time-formula progress-feedback-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>反馈时间</span>
          <small>只用于生命周期追溯，不计入结算工时</small>
        </div>
        <VoiceScheduleButton
          context="合作伙伴反馈发生时间"
          currentStart={progressStartValue}
          onApply={applyVoiceSingleProgressTime}
        />
      </div>
      <div className="progress-schedule-wrap">
        <div className="new-task-schedule-row progress-lite-schedule-row">
          <PlanDateTimeField
            label="反馈时间"
            value={progressStartValue}
            onChange={(value) => {
              setHasTouchedSchedule(true)
              writeProgressStart(value)
              if (value) {
                writeProgressEnd(value)
              }
              setTimeEntryError('')
            }}
            isActive
            readOnly={false}
            pickerId="feedback-time"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">计时口径</span>
            <output className="new-task-hours-input new-task-hours-output" aria-label="反馈计时口径">
              0 min
            </output>
          </div>
        </div>
      </div>
      <p className="progress-lite-duration" role="status">保存后显示为一条「合作伙伴反馈」节点，可附截图 / 批注文件追溯。</p>
    </section>
  )

  const timeFields = (
    <section className="progress-lite-time-formula">
      <div className="progress-lite-time-heading">
        <div>
          <span>时间与工时</span>
          <small>{timeCounts ? '三项同时只激活两项，第三项自动推算（灰色）' : isAcceptanceMode ? '本次验收不计入工时' : '本次不计工时，仅记录进展'}</small>
        </div>
        <div className="progress-lite-time-heading-actions">
          <VoiceScheduleButton
            context={isAcceptanceMode ? '验收进展的实际时间与工时' : '工作进展的实际时间与工时'}
            currentStart={progressStartValue}
            currentDurationMinutes={segmentMinutes}
            currentEnd={progressEndValue}
            onApply={applyVoiceProgressSchedule}
            disabled={lockSchedule}
          />
          {isAcceptanceMode && !isWaitingMode && (
            <button
              type="button"
              className="progress-lite-time-sync"
              onClick={syncPlanReferenceToProgress}
              disabled={!planReferenceStartValue || !planReferenceEndValue || planReferenceMinutes <= 0}
              title="把右侧预计时间与工时同步到左侧实际"
            >
              <ArrowRightLeft size={13} />
              <span>同步预计</span>
            </button>
          )}
          {isAcceptanceMode && (
            <button
              type="button"
              className={`switch-control progress-lite-time-toggle ${countAcceptanceTime ? 'active' : ''}`}
              aria-pressed={countAcceptanceTime}
              aria-label={countAcceptanceTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              title={countAcceptanceTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              onClick={() => setCountAcceptanceTime((value) => !value)}
            >
              <i />
              <span>{countAcceptanceTime ? '计入工时' : '不计入工时'}</span>
            </button>
          )}
          {!isAcceptanceMode && !isWaitingMode && (
            <button
              type="button"
              className={`switch-control progress-lite-time-toggle ${countProgressTime ? 'active' : ''}`}
              aria-pressed={countProgressTime}
              aria-label={countProgressTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              title={countProgressTime ? '本次计入工时，点击关闭则本次不计入' : '本次不计入工时，点击开启则计入'}
              onClick={() => setCountProgressTime((value) => !value)}
            >
              <i />
              <span>{countProgressTime ? '计入工时' : '不计工时'}</span>
            </button>
          )}
          <button
            type="button"
            className="progress-lite-time-swap"
            aria-label="交换开始时间和结束时间"
            title="交换开始时间和结束时间"
            onClick={swapDraftTimes}
            disabled={lockSchedule || !activeDraft.start.trim() || !activeDraft.end.trim()}
          >
            <ArrowRightLeft size={15} />
          </button>
        </div>
      </div>
      <div className={`progress-schedule-wrap${isAcceptanceMode && !isWaitingMode ? ' progress-schedule-two-col' : ''}`}>
        <div className={`new-task-schedule-row progress-lite-schedule-row ${lockSchedule ? 'is-uncounted' : ''}`} aria-disabled={lockSchedule}>
          <PlanDateTimeField
            label="开始时间"
            value={progressStartValue}
            onChange={updateProgressStart}
            isActive={scheduleDerivedField !== 'start'}
            readOnly={scheduleDerivedField === 'start'}
            control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'start'} label="切换开始时间" onClick={() => toggleProgressScheduleField('start')} />}
            pickerId="progress-start"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
          <div className="field progress-lite-hours-field">
            <span className="new-task-inline-label">
              <ScheduleAnchorSwitch active={scheduleDerivedField !== 'hours'} label="切换本段工时" onClick={() => toggleProgressScheduleField('hours')} />
              本段工时
            </span>
            <div className="new-task-hours-row progress-lite-hours-row">
              {scheduleDerivedField === 'hours' ? (
                <output className="new-task-hours-input new-task-hours-output" aria-label="本段工时">
                  {isAcceptanceMode ? formatDurationZh(segmentMinutes) : formatDuration(segmentMinutes)}
                </output>
              ) : (
                <input
                  className="new-task-hours-input"
                  type="text"
                  inputMode="text"
                  value={segmentDurationInput}
                  placeholder="如 15分钟"
                  onFocus={(event) => {
                    setIsSegmentDurationFocused(true)
                    event.currentTarget.select()
                  }}
                  onChange={(event) => updateSegmentDurationInput(event.target.value)}
                  onBlur={commitSegmentDurationInput}
                  aria-label="本段工时，可输入15分钟、1小时30分钟或小数小时"
                />
              )}
            </div>
          </div>
          <PlanDateTimeField
            label="结束时间"
            value={progressEndValue}
            onChange={updateProgressEnd}
            isActive={scheduleDerivedField !== 'end'}
            readOnly={scheduleDerivedField === 'end'}
            control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'end'} label="切换结束时间" onClick={() => toggleProgressScheduleField('end')} />}
            pickerId="progress-end"
            activePickerId={activeDatePickerId}
            onActivePickerChange={setActiveDatePickerId}
          />
        </div>
        {isAcceptanceMode && !isWaitingMode && (
          <div className="new-task-schedule-row progress-lite-schedule-row progress-lite-schedule-row-plan">
            <div className="progress-lite-plan-head">
              <span>预计时间与工时</span>
              <VoiceScheduleButton
                label="用语音填写预计时间与工时"
                context="验收时调整任务预计时间与工时"
                currentStart={planReferenceStartValue}
                currentDurationMinutes={planReferenceMinutes}
                currentEnd={planReferenceEndValue}
                onApply={applyVoicePlanReferenceSchedule}
              />
            </div>
            <PlanDateTimeField
              label="开始时间"
              value={planReferenceStartValue}
              onChange={updatePlanReferenceStart}
              isActive
              readOnly={false}
              control={<ScheduleAnchorSwitch active={planReferenceDerivedField !== 'start'} label="切换预计开始时间" onClick={() => togglePlanReferenceScheduleField('start')} />}
              pickerId="plan-start"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
            <div className="field progress-lite-hours-field">
              <span className="new-task-inline-label">
                <ScheduleAnchorSwitch active={planReferenceDerivedField !== 'hours'} label="切换预计工时" onClick={() => togglePlanReferenceScheduleField('hours')} />
                预计工时
              </span>
              <div className="new-task-hours-row progress-lite-hours-row">
                {planReferenceDerivedField === 'hours' ? (
                  <output className="new-task-hours-input new-task-hours-output" aria-label="预计工时">
                    {formatDurationZh(planReferenceMinutes)}
                  </output>
                ) : (
                  <>
                    <input
                      className="new-task-hours-input"
                      type="text"
                      inputMode="text"
                      value={planReferenceDurationInput}
                      placeholder="如 15分钟"
                      onFocus={(event) => {
                        setIsPlanReferenceDurationFocused(true)
                        event.currentTarget.select()
                      }}
                      onChange={(event) => updatePlanReferenceDurationInput(event.target.value)}
                      onBlur={commitPlanReferenceDurationInput}
                      aria-label="验收预计工时，可输入15分钟、1小时30分钟或小数小时"
                    />
                  </>
                )}
              </div>
            </div>
            <PlanDateTimeField
              label="结束时间"
              value={planReferenceEndValue}
              onChange={updatePlanReferenceEnd}
              isActive
              readOnly={false}
              control={<ScheduleAnchorSwitch active={planReferenceDerivedField !== 'end'} label="切换预计结束时间" onClick={() => togglePlanReferenceScheduleField('end')} />}
              pickerId="plan-end"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
          </div>
        )}
      </div>
      {/* 多段工时列表：已暂存段 + 当前正在填写的段（合并排序显示） */}
      {pendingExtraSegments.length > 0 && (() => {
        const currentDraftSeg = hasDraftTimeEntry ? {
          id: '__current__',
          date: activeStartDate,
          endDate: activeEndDate,
          start: activeDraft.start,
          end: activeDraft.end,
          isCurrent: true,
        } : null
        const allSegs = sortSegmentsByTime([
          ...pendingExtraSegments.map((s) => ({ ...s, isCurrent: false as const })),
          ...(currentDraftSeg ? [currentDraftSeg] : []),
        ])
        const totalMinutes = totalPendingMinutes + (hasDraftTimeEntry ? draftEntryMinutes : 0)
        return (
          <ul className="progress-extra-segments">
            {allSegs.map((seg, i) => {
              const isCurrent = (seg as { isCurrent?: boolean }).isCurrent
              return (
                <li key={seg.id} className={`progress-extra-segment-row ${isCurrent ? 'is-current' : ''}`}>
                  <span className="progress-extra-segment-label">第 {i + 1} 段</span>
                  <span className="progress-extra-segment-time">
                    {seg.start} – {seg.end}
                  </span>
                  <span className="progress-extra-segment-duration">
                    {formatDuration(minutesForTimeEntry(seg))}
                  </span>
                  {isCurrent
                    ? <>
                        <span className="progress-extra-segment-editing">编辑中</span>
                        <button
                          type="button"
                          className="progress-extra-segment-remove"
                          aria-label="取消这一段"
                          title="取消这一段"
                          onClick={() => {
                            updateActiveDraft((d) => ({ ...d, start: '', end: '' }))
                            setSegmentMinutes(DURATION_STEP_MINUTES * 2)
                            setTimeEntryError('')
                          }}
                        >
                          <X size={12} />
                        </button>
                      </>
                    : (
                      <>
                        <button type="button" className="progress-extra-segment-edit" aria-label="编辑此段" title="编辑此段"
                          onClick={() => editStashedSegment(seg as TimeEntry)}>
                          <Pencil size={11} />
                        </button>
                        <button type="button" className="progress-extra-segment-remove" aria-label="移除此段"
                          onClick={() => setPendingExtraSegments((current) => current.filter((s) => s.id !== seg.id))}>
                          <X size={12} />
                        </button>
                      </>
                    )
                  }
                </li>
              )
            })}
            <li className="progress-extra-segment-total">
              合计 {formatDuration(totalMinutes)}
            </li>
          </ul>
        )
      })()}
      <p className={`progress-lite-duration ${!timeCounts || hasDraftTimeEntry ? '' : 'invalid'}`} role="status">
        {!timeCounts
          ? isAcceptanceMode
            ? '本次验收不计入工时，已汇总工时保留不变，可直接保存 / 验收'
            : '本次计 0 工时，仅记录进展（填写备注或上传附件即可保存）'
          : hasDraftTimeEntry
            ? isAcceptanceMode && !hasTouchedSchedule
              ? '如本次没有新增工时，可直接验收；调整时间后才会计入本次工时与结算'
              : pendingExtraSegments.length > 0
                ? ''
                : `${isWaitingMode ? '等待' : '本段计时'} ${formatDuration(draftEntryMinutes)}${isWaitingMode ? '' : '，保存后自动累计到实际工时与结算'}`
            : pendingExtraSegments.length > 0 ? '填写下一段的结束时间，或直接保存已暂存的时间段' : '结束时间需晚于开始时间'}
      </p>
      {!isWaitingMode && !isAcceptanceMode && !isEditingEntry && timeCounts && (
        <button
          type="button"
          className="progress-add-segment-btn"
          disabled={!hasDraftTimeEntry || Boolean(draftConflict)}
          onClick={stashCurrentSegment}
        >
          <Plus size={12} />
          再加一段
        </button>
      )}
      {(timeEntryError || draftConflict) && (
        <p className="progress-lite-entry-error" role="alert">
          <span>{timeEntryError || (draftConflict ? `这个时间段和 ${formatEntryDateTimeRange(task, draftConflict)} 已有记录重叠，请改到前后相邻的空档。` : '')}</span>
          {suggestedTimeSlot && (
            <button type="button" onClick={applySuggestedTimeSlot}>
              <Sparkles size={13} />
              切换到 {formatPlanDateTime(suggestedTimeSlot.start)}
            </button>
          )}
        </p>
      )}
    </section>
  )

  return (
    <ModalShell className="task-action-modal task-progress-modal progress-lite-modal" labelledBy="task-progress-title" onClose={onClose}>
      <header className="progress-lite-header">
        <div>
          <h2 id="task-progress-title">{isWaitingMode ? '记录等待' : isFeedbackMode ? (isEditingEntry ? '编辑反馈' : '记录反馈') : isAcceptanceRevisionMode ? '编辑验收进展' : isAcceptanceMode ? '记录验收进展' : '记录进展'}</h2>
          {progressHeaderHint && <small>{progressHeaderHint}</small>}
        </div>
        <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className={`progress-lite-body ${isWaitingMode ? 'waiting-mode' : ''} ${isFeedbackMode ? 'feedback-mode' : ''} ${isAcceptanceMode ? 'acceptance-mode' : ''}`}>
        {isWaitingMode ? (
          <>
            {waitingTimeFields}
            <section className="progress-lite-field">
              <label className="progress-lite-label" htmlFor="progress-lite-waiting-note">备注</label>
              <textarea
                id="progress-lite-waiting-note"
                className="task-progress-note progress-lite-note"
                value={note}
                onChange={(event) => {
                  const value = event.target.value
                  setNote(value)
                  if (!isAcceptanceMode) {
                    updateActiveDraft((current) => ({ ...current, note: value }))
                  }
                }}
                placeholder="填写等待原因或补充说明"
              />
            </section>
          </>
        ) : (
          <>
            {canToggleAcceptanceMode && (
              <div
                className={`progress-acceptance-toggle ${isAcceptanceMode ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={toggleAcceptanceMode}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleAcceptanceMode()
                  }
                }}
              >
                <span className={`switch-control ${isAcceptanceMode ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">本次进展为验收进展</span>
                <em>
                  {isAcceptanceRevisionMode
                    ? '关闭后保存会撤回验收闭环'
                    : isAcceptanceMode ? '提交后完成验收闭环' : '打开后记录验收收尾'}
                </em>
              </div>
            )}
            {!isFeedbackMode && (
              <section className="progress-acceptance-base" ref={acceptanceBaseRef}>
                <button
                  type="button"
                  className="progress-acceptance-base-toggle"
                  aria-expanded={isAcceptanceBaseExpanded}
                  onClick={() => setIsAcceptanceBaseExpanded((current) => !current)}
                >
                  <span>基础信息</span>
                  <em>{isAcceptanceBaseExpanded ? '收起' : '展开'} <ChevronDown size={13} /></em>
                </button>
                {isAcceptanceBaseExpanded && (
                  <div className="progress-acceptance-basic-grid">
                    <div className="wide"><span>任务名称</span><strong>{task.title}</strong></div>
                    <div><span>设计类型</span><strong>{task.type || '未分类'}</strong></div>
                    <div><span>结算所属月份</span><strong>{monthLabelOf(taskSettlementMonth(task))}（{isSupplementalTask(task) ? '补录' : '非补录'}）</strong></div>
                    <div><span>对接人</span><strong>{task.contact || '待确认'}</strong></div>
                    <div><span>需求人</span><strong>{task.requester || '待确认'}</strong></div>
                    <div><span>验收人</span><strong>{task.reviewer || task.requester || '待确认'}</strong></div>
                    <div><span>预计开始</span><strong>{formatPlanDateTime(task.date)}</strong></div>
                    <div><span>预计交付</span><strong>{formatPlanDateTime(task.estimatedDate || task.date)}</strong></div>
                    <div><span>预估工时</span><strong>{formatDurationZh(Math.max(0, Math.round(task.estimatedHours * 60)))}</strong></div>
                    <div><span>实际工时</span><strong>{formatDurationZh(Math.max(0, Math.round(task.actualHours * 60)))}</strong></div>
                    <div><span>实际交付</span><strong>{task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : '待验收确认'}</strong></div>
                    <div className="wide"><span>需求描述</span><strong>{task.requirement || '未填写'}</strong></div>
                  </div>
                )}
              </section>
            )}
            {isAcceptanceMode && timeFields}
            {isFeedbackMode && (
              <>
                <section className="progress-lite-field progress-feedback-meta">
                  <label>
                    <span>反馈版本</span>
                    <input
                      value={feedbackVersion}
                      onChange={(event) => setFeedbackVersion(event.target.value)}
                      placeholder="例如：B01 / B02 / B03"
                    />
                  </label>
                  <label className="progress-feedback-source">
                    <span>反馈来源</span>
                    <input
                      value={feedbackSource}
                      onChange={(event) => setFeedbackSource(event.target.value)}
                      placeholder="例如：合作伙伴 / 需求人 / 项目负责人"
                      maxLength={80}
                    />
                  </label>
                </section>
                {feedbackTimeFields}
              </>
            )}
            <section className="progress-lite-field">
              <div className="progress-lite-label-row">
                <label htmlFor="progress-lite-note">{isAcceptanceMode ? '验收备注' : isFeedbackMode ? '修改意见' : '进展内容'}</label>
                <span className="progress-lite-label-actions">
                  {isAcceptanceMode && (
                    <button
                      type="button"
                      className="text-button progress-reference-button"
                      onClick={showAcceptanceTaskReference}
                      title="查看任务详情，用于参考填写验收备注"
                    >
                      参考任务详情
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button ai-assist-button"
                    aria-label={isAcceptanceMode ? 'AI 汇总项目验收备注' : isFeedbackMode ? 'AI 整理修改意见' : 'AI 优化进展内容'}
                    title={isAcceptanceMode ? `AI 汇总项目验收备注（参考 ${projectProgressHistory.length} 段历史进展）` : isFeedbackMode ? 'AI 整理修改意见' : 'AI 优化进展内容'}
                    onClick={() => void requestProgressAiSuggestion()}
                    disabled={isProgressAiLoading || (!note.trim() && uploadedNames.length === 0 && taskAssistantFiles(task, files).length === 0 && (!isAcceptanceMode || projectProgressHistory.length === 0))}
                  >
                    <Sparkles size={16} />
                  </button>
                </span>
              </div>
              <textarea
                id="progress-lite-note"
                className="task-progress-note progress-lite-note"
                value={note}
                onChange={(event) => {
                  const value = event.target.value
                  setNote(value)
                  if (!isAcceptanceMode) {
                    updateActiveDraft((current) => ({ ...current, note: value }))
                  }
                }}
                placeholder={isAcceptanceMode ? '可补充本次收尾重点；AI 会结合全部历史进展，汇总项目更新、修改与最终交付。' : isFeedbackMode ? '例如：B01 反馈：标题需要更突出，主视觉换成更正式的蓝色，补充数据安全痛点。' : '例如：按合作伙伴反馈调整封面配色，导出终稿'}
              />
              {(progressAiSuggestion || progressAiError || isProgressAiLoading) && (
                <div className="ai-suggestion-panel task-text-ai-panel">
                  <div className="ai-suggestion-head">
                    <span>{isProgressAiLoading ? (isAcceptanceMode ? 'AI 正在整理验收备注' : 'AI 正在整理进展') : isAcceptanceMode ? 'AI 验收建议' : 'AI 建议'}</span>
                    {!isProgressAiLoading && (progressAiSuggestion || progressAiError) && (
                      <button type="button" className="ai-suggestion-dismiss" aria-label="关闭建议" title="关闭建议" onClick={() => { setProgressAiSuggestion(null); setProgressAiError('') }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {isProgressAiLoading && <p>{isAcceptanceMode ? `正在汇总任务需求、${projectProgressHistory.length} 段历史进展、验收文件和当前备注...` : isFeedbackMode ? '正在结合任务需求和附件整理修改意见...' : '正在结合当前输入、任务附件和最近进展优化文案...'}</p>}
                  {progressAiError && <p className="ai-suggestion-error">{progressAiError}</p>}
                  {progressAiSuggestion && (
                    <>
                      <div className="ai-suggestion-body">
                        {renderTextAssistantBody(progressAiSuggestion.optimizedText)}
                      </div>
                      {progressAiSuggestion.summary && <small>{progressAiSuggestion.summary}</small>}
                      <div className="ai-suggestion-actions">
                        <button
                          type="button"
                          className="ghost-button compact-button"
                          onClick={() => {
                            const currentLearning = progressAiSuggestionAppliedRef.current
                            progressAiSuggestionAppliedRef.current = {
                              context: isAcceptanceMode ? 'acceptance' : isFeedbackMode ? 'feedback' : 'progress',
                              sourceInput: currentLearning?.sourceInput ?? note.trim(),
                              aiOutput: progressAiSuggestion.optimizedText,
                              applied: true,
                            }
                            setNote(progressAiSuggestion.optimizedText)
                            if (!isAcceptanceMode) {
                              updateActiveDraft((current) => ({ ...current, note: progressAiSuggestion.optimizedText }))
                            }
                          }}
                        >
                          采用建议
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
            {!isAcceptanceMode && !isFeedbackMode && (
              <div
                className={`progress-acceptance-toggle progress-revision-toggle ${isRevisionRound ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setIsRevisionRound((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setIsRevisionRound((current) => !current)
                  }
                }}
              >
                <span className={`switch-control ${isRevisionRound ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">本次为改稿轮次</span>
                <em>{isRevisionRound ? '计入需求人画像（不影响计时与结算）' : '仅分阶段提交，不算改稿'}</em>
              </div>
            )}
            {isFeedbackMode && (
              <div
                className={`progress-acceptance-toggle progress-revision-toggle ${isRevisionRound ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setIsRevisionRound((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setIsRevisionRound((current) => !current)
                  }
                }}
              >
                <span className={`switch-control ${isRevisionRound ? 'active' : ''}`}><i /></span>
                <span className="progress-acceptance-toggle-label">计入改稿轮次</span>
                <em>{isRevisionRound ? '这条反馈会进入需求人画像 / 改稿统计' : '仅作为反馈记录，不计入改稿轮次'}</em>
              </div>
            )}
            {!isAcceptanceMode && !isFeedbackMode && timeFields}
            <section
              className={`progress-lite-field progress-attachment-field ${isDraggingFiles ? 'is-dragover' : ''}`}
              onPaste={(event) => {
                const pastedImages = Array.from(event.clipboardData.items)
                  .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
                  .map((item) => item.getAsFile())
                  .filter((file): file is File => Boolean(file))
                if (pastedImages.length > 0) {
                  event.preventDefault()
                  addPendingFiles(pastedImages, 'paste')
                }
              }}
              onDragEnter={(event) => {
                if (Array.from(event.dataTransfer.types).includes('Files')) {
                  event.preventDefault()
                  dragDepthRef.current += 1
                  setIsDraggingFiles(true)
                }
              }}
              onDragOver={(event) => {
                if (Array.from(event.dataTransfer.types).includes('Files')) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDragLeave={() => {
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                if (dragDepthRef.current === 0) {
                  setIsDraggingFiles(false)
                }
              }}
              onDrop={(event) => {
                const droppedFiles = Array.from(event.dataTransfer.files)
                dragDepthRef.current = 0
                setIsDraggingFiles(false)
                if (droppedFiles.length > 0) {
                  event.preventDefault()
                  addPendingFiles(droppedFiles, 'picker')
                }
              }}
            >
              <div className="progress-lite-label-row">
                <span className="progress-lite-label">{isAcceptanceMode ? '验收附件' : '附件（选填）'}</span>
                {(existingEntryAttachments.length > 0 || pendingAttachments.length > 0) && (
                  <button
                    type="button"
                    className="attachment-ai-all"
                    onClick={requestAllAttachmentNameSuggestions}
                    disabled={
                      pendingAttachments.every((attachment) => attachment.aiLoading)
                      && existingEntryAttachments.every((file) => existingAttachmentAiState[file.id]?.loading)
                    }
                  >
                    <Sparkles size={13} />
                    AI 命名
                  </button>
                )}
              </div>
              {existingEntryAttachments.length > 0 && (
                <div className="progress-existing-attachments">
                  <small>已有附件</small>
                  <div className="progress-attachment-list progress-existing-attachment-list" aria-label="已有附件列表">
                    {existingEntryAttachments.map((file) => {
                      const fileType = fileTypeForAsset(file).type
                      const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                      const documentSourceUrl = fileThumbnailSource(file)
                      const draftName = existingAttachmentDrafts[file.id] ?? file.name
                      const aiState = existingAttachmentAiState[file.id] ?? {}
                      const isAcceptanceFile = isExistingAttachmentAcceptanceFile(file)
                      const isAcceptanceFileUpdating = updatingExistingAcceptanceFileId === file.id
                      return (
                        <article className="progress-attachment-draft progress-existing-attachment" key={file.id}>
                          <AttachmentHoverThumbnail
                            name={file.name}
                            type={fileType}
                            previewUrl={previewUrl}
                            previewFallback={Boolean(file.previewFallback)}
                            sourceUrl={documentSourceUrl}
                            onOpen={() => onPreviewFile(file)}
                          />
                          <div className="progress-attachment-main">
                            <div className="progress-attachment-name-field full-name">
                              <textarea
                                rows={2}
                                aria-label={`重命名已有附件 ${file.name}`}
                                title={draftName}
                                value={draftName}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: value }))
                                  setExistingAttachmentAiState((current) => ({
                                    ...current,
                                    [file.id]: { ...current[file.id], suggestion: undefined, error: undefined },
                                  }))
                                }}
                                onBlur={() => void saveExistingAttachmentName(file)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.currentTarget.blur()
                                  }
                                }}
                              />
                            </div>
                            <small title={file.name}>完整名称：{file.name}</small>
                            {!isAcceptanceMode && !isFeedbackMode && (
                              <button
                                type="button"
                                className={`attachment-acceptance-toggle ${isAcceptanceFile ? 'active' : ''}`}
                                aria-label={isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                                title={isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                                disabled={isAcceptanceFileUpdating}
                                onClick={() => void toggleExistingAttachmentAcceptanceFile(file)}
                              >
                                <Star size={12} fill={isAcceptanceFile ? 'currentColor' : 'none'} />
                                {isAcceptanceFile ? '验收文件' : '标为验收文件'}
                              </button>
                            )}
                            {aiState.loading && <small>视觉模型正在识别文件内容并整理名称...</small>}
                            {aiState.error && <small className="attachment-ai-error">{aiState.error}</small>}
                            {aiState.suggestion && (
                              <div className="attachment-ai-suggestion">
                                <span>建议：{aiState.suggestion.suggestedName}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextName = sanitizeAttachmentName(aiState.suggestion?.suggestedName ?? draftName, file.name)
                                    if (nextName) {
                                      const learning = existingAttachmentAiNameAppliedRef.current[file.id]
                                      existingAttachmentAiNameAppliedRef.current[file.id] = {
                                        sourceInput: learning?.sourceInput ?? sanitizeAttachmentName(existingAttachmentDrafts[file.id] ?? file.name, file.name),
                                        aiOutput: nextName,
                                        applied: true,
                                      }
                                    }
                                    setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: nextName }))
                                    setExistingAttachmentAiState((current) => ({
                                      ...current,
                                      [file.id]: { loading: false },
                                    }))
                                    void onUpdateFile(file.id, { name: nextName })
                                  }}
                                >
                                  采用
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="progress-attachment-actions">
                            <button
                              type="button"
                              aria-label="AI 建议文件名"
                              title="AI 建议文件名"
                              onClick={() => void requestExistingAttachmentNameSuggestion(file)}
                              disabled={aiState.loading}
                            >
                              <Sparkles size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="重新添加附件"
                              title="重新添加附件"
                              disabled={uploadingExistingFileId === file.id}
                              onClick={() => {
                                setReplacementExistingFileId(file.id)
                                existingReplacementInputRef.current?.click()
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label="删除已有附件"
                              title="删除已有附件"
                              className="danger"
                              onClick={() => onDeleteFile(file.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="progress-pending-attachments">
                  {existingEntryAttachments.length > 0 && <small>本次新增</small>}
                  <div className="progress-attachment-desktop-grid" aria-label="新增附件列表">
                    {pendingAttachments.map((attachment) => (
                      <article className="progress-attachment-desktop-item" key={attachment.id}>
                        <PendingAttachmentThumbnail
                          attachment={attachment}
                          onOpen={() => setPreviewAttachment(attachment)}
                          ensurePreview={ensurePendingAttachmentPreview}
                        />
                        <div className="progress-attachment-name-field">
                          <textarea
                            rows={2}
                            aria-label={`重命名 ${attachment.originalName}，扩展名不可修改`}
                            value={splitFileName(attachment.name).base}
                            onChange={(event) => {
                              const base = event.target.value
                              const extension = splitFileName(attachment.originalName).extension
                              setPendingAttachments((current) => current.map((item) =>
                                item.id === attachment.id
                                  ? { ...item, name: `${base}${extension}`, aiSuggestion: undefined, aiError: undefined }
                                  : item,
                              ))
                            }}
                            onBlur={() => {
                              setPendingAttachments((current) => current.map((item) =>
                                item.id === attachment.id
                                  ? { ...item, name: sanitizeAttachmentName(item.name, item.originalName) }
                                  : item,
                              ))
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              }
                            }}
                          />
                          <span title="文件扩展名由系统保护，不可修改">
                            {splitFileName(attachment.originalName).extension}
                          </span>
                        </div>
                        {attachment.uploadStatus === 'uploading' && (
                          <div className="attachment-upload-bar" role="progressbar" aria-label="上传进度" title="上传中">
                            <span style={{ width: `${Math.max(6, Math.round((attachment.uploadProgress ?? 0) * 100))}%` }} />
                          </div>
                        )}
                        {attachment.uploadStatus === 'done' && (
                          <small className="attachment-upload-done">已上传，保存即用</small>
                        )}
                        {attachment.uploadStatus === 'error' && (
                          <small className="attachment-ai-error">上传失败：{attachment.uploadError ?? '请重试'}（保存时会自动重试）</small>
                        )}
                        {attachment.aiLoading && <small>视觉模型正在识别文件内容并整理名称...</small>}
                        {attachment.aiError && <small className="attachment-ai-error">{attachment.aiError}</small>}
                        {attachment.aiSuggestion && (
                          <div className="attachment-ai-suggestion">
                            <span>建议：{attachment.aiSuggestion.suggestedName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextName = sanitizeAttachmentName(attachment.aiSuggestion?.suggestedName ?? attachment.name, attachment.originalName)
                                if (nextName) {
                                  const learning = pendingAttachmentAiNameAppliedRef.current[attachment.id]
                                  pendingAttachmentAiNameAppliedRef.current[attachment.id] = {
                                    sourceInput: learning?.sourceInput ?? sanitizeAttachmentName(attachment.name, attachment.originalName),
                                    aiOutput: nextName,
                                    applied: true,
                                  }
                                }
                                setPendingAttachments((current) => current.map((item) =>
                                  item.id === attachment.id
                                    ? {
                                        ...item,
                                        name: nextName || sanitizeAttachmentName(item.name, item.originalName),
                                        aiSuggestion: undefined,
                                      }
                                    : item,
                                ))
                              }}
                            >
                              采用
                            </button>
                          </div>
                        )}
                        {!isAcceptanceMode && !isFeedbackMode && (
                          <button
                            type="button"
                            className={`attachment-acceptance-toggle ${attachment.isAcceptanceFile ? 'active' : ''}`}
                            aria-label={attachment.isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                            title={attachment.isAcceptanceFile ? '取消标记为验收文件' : '标记为验收文件'}
                            onClick={() => setPendingAttachments((current) => current.map((item) =>
                              item.id === attachment.id ? { ...item, isAcceptanceFile: !item.isAcceptanceFile } : item,
                            ))}
                          >
                            <Star size={12} fill={attachment.isAcceptanceFile ? 'currentColor' : 'none'} />
                            {attachment.isAcceptanceFile ? '验收文件' : '标为验收文件'}
                          </button>
                        )}
                        <div className="progress-attachment-actions">
                          <button
                            type="button"
                            aria-label="AI 建议文件名"
                            title="AI 建议文件名"
                            onClick={() => void requestAttachmentNameSuggestion(attachment.id)}
                            disabled={attachment.aiLoading}
                          >
                            <Sparkles size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="重新上传"
                            title="重新上传"
                            onClick={() => {
                              setReplacementAttachmentId(attachment.id)
                              replacementInputRef.current?.click()
                            }}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="删除附件"
                            title="删除附件"
                            className="danger"
                            onClick={() => {
                              discardStagedAttachment(attachment)
                              setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {uploadErrors.length > 0 && (
                <div className="upload-error-list" role="alert">
                  {uploadErrors.map((message) => <span key={message}>{message}</span>)}
                </div>
              )}
              <button type="button" className="progress-lite-upload-box" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                <Plus size={15} />
                {isAcceptanceMode ? '添加验收截图 / 最终稿' : '添加过程截图 / 文件'}
                <small>单文件最大 200MB，大文件自动分片上传；也可以 Ctrl+V 粘贴图片</small>
              </button>
              <input
                ref={fileInputRef}
                className="task-row-upload-input"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => addPendingFiles(event.target.files)}
              />
              <input
                ref={replacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => replacePendingAttachment(event.target.files)}
              />
              <input
                ref={existingReplacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.mp4,.mov,.webm,.m4v,.ogv"
                onChange={(event) => void addReplacementExistingAttachment(event.target.files)}
              />
            </section>
            {isAcceptanceMode && (
              <div className="progress-acceptance-sections">
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">整体进度</h3>
                  <div className="progress-acceptance-progress">
                    <div className="acceptance-progress-track" aria-label={`当前进度 ${task.progress}%`}>
                      <span style={{ width: `${task.progress}%` }} />
                    </div>
                    <strong>{task.progress}%</strong>
                  </div>
                  <p className="progress-acceptance-hint">{isAcceptanceRevisionMode ? '保存后继续保持已验收状态，进度为 100%。' : '确认验收后，进度将自动设为 100%。'}</p>
                </section>
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">计时与工时汇总</h3>
                  {acceptanceBillablePreviewTimeEntries.length === 0 ? (
                    <p className="progress-acceptance-hint">还没有分段计时。</p>
                  ) : (
                    <div className="progress-acceptance-time-table-wrap">
                      <table className="progress-acceptance-time-table">
                        <thead><tr><th>日期</th><th>时间段</th><th>工时</th></tr></thead>
                        <tbody>
                          {acceptanceBillablePreviewTimeEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{formatMonthDay(entry.date || datePart(task.date))}</td>
                              <td>{entry.start}–{entry.end}</td>
                              <td>{(minutesForTimeEntry(entry) / 60).toFixed(1)}h</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr><td colSpan={2}>实际总工时 · 计入结算</td><td>{acceptanceLockedHours.toFixed(1)}h</td></tr></tfoot>
                      </table>
                    </div>
                  )}
                  <div className="progress-acceptance-money">
                    <div><span>结算时薪</span><strong>¥{hourlyRate.toLocaleString()} / 小时</strong></div>
                    <div><span>预计结算金额</span><strong>¥{formatYuan(acceptanceEstimatedAmount)}</strong></div>
                  </div>
                  {acceptanceWaitingEntries.length > 0 && (
                    <div className="progress-acceptance-waiting">
                      <h4>等待记录 · 不计入结算</h4>
                      {acceptanceWaitingEntries.map((entry) => {
                        const minutes = minutesForWaitingEntry(acceptanceWaitingPreviewTask, entry)
                        return (
                          <div className="progress-acceptance-waiting-row" key={entry.id}>
                            <span>{formatWaitingEntryDateTimeRange(acceptanceWaitingPreviewTask, entry)}</span>
                            <em>{minutes > 0 ? `${(minutes / 60).toFixed(1)}h` : '等待中'}</em>
                          </div>
                        )
                      })}
                      <div className="progress-acceptance-waiting-total"><strong>累计等待</strong><em>{(acceptanceWaitingMinutes / 60).toFixed(1)}h</em></div>
                    </div>
                  )}
                </section>
                <section className="progress-acceptance-block">
                  <h3 className="progress-acceptance-block-title">任务体感反馈 · 用于后续 BI / AI 分析</h3>
                  <div className="progress-acceptance-feedback">
                    <div className="task-feedback-options" role="group" aria-label="任务体感">
                      {taskFeedbackRatings.map((rating) => (
                        <button
                          type="button"
                          className={feedbackRating === rating ? 'active' : ''}
                          key={rating}
                          aria-pressed={feedbackRating === rating}
                          onClick={() => {
                            setFeedbackRating((current) => current === rating ? '' : rating)
                            if (rating === '顺利') { setFeedbackTags([]) }
                          }}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    {feedbackRating && feedbackRating !== '顺利' && (
                      <div className="task-feedback-tags" aria-label="体感原因标签">
                        {taskFeedbackTags.map((tag) => (
                          <button
                            type="button"
                            className={feedbackTags.includes(tag) ? 'active' : ''}
                            key={tag}
                            aria-pressed={feedbackTags.includes(tag)}
                            onClick={() => toggleFeedbackTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="acceptance-feedback-note">
                      <span>体感评价</span>
                      <textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="例如：需求清晰，但等待合作伙伴确认主色耗时较长。" />
                    </label>
                  </div>
                </section>
                <div className="progress-acceptance-confirm-summary">确认后状态变更为「已验收」，进度设为 100%，当前验收备注和附件会写入任务闭环。</div>
              </div>
            )}
          </>
        )}
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        {isAcceptanceMode && onConfirmAcceptance && (!isEditingEntry || isConvertingEntryToAcceptance) ? (
          <button
            data-modal-save="true"
            className="primary-button"
            disabled={!canConfirmAcceptance}
            onClick={() => void confirmAcceptanceFromProgress()}
          >
            {isSaving ? '保存中…' : isAcceptanceRevisionMode ? '保存修改' : '确认验收通过'}
          </button>
        ) : (
          <button data-modal-save="true" className="primary-button" disabled={isSaving || Boolean(draftConflict) || (isWaitingMode ? !hasWaitingStart : (!hasDraftTimeEntry && !canSaveZeroTimeProgress && pendingExtraSegments.length === 0))} onClick={() => void saveProgress()}>
            {isSaving ? '保存中…' : isEditingEntry ? '保存修改' : isWaitingMode ? '记录等待' : isFeedbackMode ? '记录反馈' : '记录进展'}
          </button>
        )}
      </footer>
      {previewAttachment && <PendingAttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />}
    </ModalShell>
  )
}

type NewTaskDraftCache = {
  title: string
  requirement: string
  type: string
  startDate: string
  estimatedMinutes: number
  estimatedDate: string
  scheduleAnchor: ScheduleAnchor
  isSupplemental: boolean
  settlementMonth: string
  requester: string
  contact: string
  reviewer: string
  supplementalNote: string
}

const newTaskDraftStorageKey = 'giverny:new-task-draft:v1'

const readNewTaskDraftCache = (fallbackStartDate: string, fallbackType: string, fallbackSettlementMonth = monthPart(fallbackStartDate)): NewTaskDraftCache => {
  const fallbackMinutes = 120
  const fallbackDraft: NewTaskDraftCache = {
    title: '',
    requirement: '',
    type: fallbackType,
    startDate: fallbackStartDate,
    estimatedMinutes: fallbackMinutes,
    estimatedDate: addMinutesToPlanDateTime(fallbackStartDate, fallbackMinutes),
    scheduleAnchor: 'end',
    isSupplemental: false,
    settlementMonth: fallbackSettlementMonth,
    requester: '黄媚',
    contact: '黄媚',
    reviewer: '黄媚',
    supplementalNote: '',
  }
  if (typeof window === 'undefined') {
    return fallbackDraft
  }
  try {
    const raw = window.localStorage.getItem(newTaskDraftStorageKey)
    if (!raw) {
      return fallbackDraft
    }
    const parsed = JSON.parse(raw) as Partial<NewTaskDraftCache>
    const startDate = parsed.startDate || fallbackDraft.startDate
    const estimatedMinutes = Number.isFinite(parsed.estimatedMinutes) && Number(parsed.estimatedMinutes) > 0 ? Number(parsed.estimatedMinutes) : fallbackMinutes
    return {
      title: parsed.title ?? '',
      requirement: parsed.requirement ?? '',
      type: parsed.type || fallbackType,
      startDate,
      estimatedMinutes,
      estimatedDate: parsed.estimatedDate || addMinutesToPlanDateTime(startDate, estimatedMinutes),
      scheduleAnchor: 'end',
      isSupplemental: Boolean(parsed.isSupplemental),
      settlementMonth: parsed.settlementMonth || fallbackSettlementMonth,
      requester: parsed.requester || parsed.contact || '黄媚',
      contact: parsed.contact || '黄媚',
      reviewer: parsed.reviewer || parsed.requester || parsed.contact || '黄媚',
      supplementalNote: parsed.supplementalNote ?? '',
    }
  } catch {
    return fallbackDraft
  }
}

const writeNewTaskDraftCache = (draft: NewTaskDraftCache) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(newTaskDraftStorageKey, JSON.stringify(draft))
}

const clearNewTaskDraftCache = () => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(newTaskDraftStorageKey)
}

const newTaskDraftFromTask = (task: Task, fallbackType: string, fallbackSettlementMonth: string): NewTaskDraftCache => {
  const startDate = task.date || isoDateTime()
  const estimatedMinutes = Math.max(ESTIMATED_HOURS_STEP_MINUTES, Math.round((Number(task.estimatedHours) || 2) * 60))
  return {
    title: task.title ?? '',
    requirement: task.requirement ?? '',
    type: task.type || fallbackType,
    startDate,
    estimatedMinutes,
    estimatedDate: task.estimatedDate || addMinutesToPlanDateTime(startDate, estimatedMinutes),
    scheduleAnchor: 'end',
    isSupplemental: isSupplementalTask(task),
    settlementMonth: taskSettlementMonth(task) || fallbackSettlementMonth,
    requester: task.requester || task.contact || '黄媚',
    contact: task.contact || task.requester || '黄媚',
    reviewer: task.reviewer || task.requester || task.contact || '黄媚',
    supplementalNote: task.supplementalNote ?? '',
  }
}

function NewTaskModal({
  designTypeGroups,
  currentMonthValue,
  initialSupplemental = false,
  editingTask,
  onClose,
  onCreate,
  onSave,
  onDesignTypeGroupsChange,
}: {
  designTypeGroups: DesignTypeGroup[]
  currentMonthValue: string
  initialSupplemental?: boolean
  editingTask?: Task
  onClose: () => void
  onCreate: (task: Task) => void
  onSave?: (changes: Partial<Task>) => void
  onDesignTypeGroupsChange: (nextGroups: DesignTypeGroup[]) => void | Promise<void>
}) {
  const availableDesignTypeGroups = normalizeDesignTypeGroups(designTypeGroups)
  const fallbackType = flattenDesignTypeGroups(availableDesignTypeGroups)[0] ?? defaultDesignTypes[0]
  const defaultStartDateTime = useMemo(() => isoDateTime(), [])
  const isEditing = Boolean(editingTask)
  const initialDraft = useMemo(
    () => editingTask
      ? newTaskDraftFromTask(editingTask, fallbackType, currentMonthValue)
      : readNewTaskDraftCache(defaultStartDateTime, fallbackType, currentMonthValue),
    [currentMonthValue, defaultStartDateTime, editingTask, fallbackType],
  )
  const [title, setTitle] = useState(initialDraft.title)
  const [requirement, setRequirement] = useState(initialDraft.requirement)
  const [type, setType] = useState(initialDraft.type)
  const [startDate, setStartDate] = useState(initialDraft.startDate)
  const [estimatedMinutes, setEstimatedMinutes] = useState(initialDraft.estimatedMinutes)
  const [estimatedHoursInput, setEstimatedHoursInput] = useState(() => formatEstimatedDurationInputValue(initialDraft.estimatedMinutes))
  const [estimatedDate, setEstimatedDate] = useState(initialDraft.estimatedDate)
  const [scheduleDerivedField, setScheduleDerivedField] = useState<ScheduleAnchor>(initialDraft.scheduleAnchor)
  const [isSupplemental, setIsSupplemental] = useState(initialSupplemental || initialDraft.isSupplemental)
  // 不计费任务（免费协助）：从创建起即不计费，不计入计费工时与收入，但仍出现在结算报表
  const [isFree, setIsFree] = useState(editingTask?.billable === false || editingTask?.status === '不计费')
  const [settlementMonth, setSettlementMonth] = useState(initialDraft.settlementMonth)
  const [requester, setRequester] = useState(initialDraft.requester)
  const [contact, setContact] = useState(initialDraft.contact)
  const [reviewer, setReviewer] = useState(initialDraft.reviewer)
  const [reviewerEdited, setReviewerEdited] = useState(
    Boolean(editingTask?.reviewer && editingTask.reviewer !== (editingTask.requester || editingTask.contact)),
  )
  const [supplementalNote, setSupplementalNote] = useState(initialDraft.supplementalNote)
  const [aiSuggestion, setAiSuggestion] = useState<TaskAssistantSuggestion | null>(null)
  const [aiError, setAiError] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  // 记录 AI 生成的建议文本（用于提交时对比用户最终输入，保存差异供学习）
  const aiSuggestionAppliedRef = useRef<AiLearningDraft | null>(null)
  const aiTitleSuggestionAppliedRef = useRef<AiLearningDraft | null>(null)
  // 甲方文案附件：仅用于 AI 需求分析（前端就地抽取文字或图片 base64），不随任务持久化
  type BriefItem = {
    id: string
    name: string
    text: string
    chars: number
    isImage?: boolean
    base64?: string
    mimeType?: string
    previewUrl?: string
    previewLabel?: string
  }
  const [briefFiles, setBriefFiles] = useState<BriefItem[]>([])
  const [briefError, setBriefError] = useState('')
  const [isBriefLoading, setIsBriefLoading] = useState(false)
  const [isBriefDragOver, setIsBriefDragOver] = useState(false)
  const [briefLightboxSrc, setBriefLightboxSrc] = useState<string | null>(null)
  const briefInputRef = useRef<HTMLInputElement | null>(null)
  const briefFilesRef = useRef<BriefItem[]>([])
  const briefDragDepthRef = useRef(0)
  const [hourSuggestion, setHourSuggestion] = useState<HourEstimateSuggestion | null>(null)
  const [hourSuggestionInputSignature, setHourSuggestionInputSignature] = useState('')
  const [hourSuggestionError, setHourSuggestionError] = useState('')
  const [isHourSuggestionLoading, setIsHourSuggestionLoading] = useState(false)
  const [hourSuggestionFeedback, setHourSuggestionFeedback] = useState<HourEstimateFeedbackRating | null>(null)
  const [hourSuggestionFeedbackReasons, setHourSuggestionFeedbackReasons] = useState<string[]>([])
  const [hourSampleFeedback, setHourSampleFeedback] = useState<Record<number, boolean>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [activeDatePickerId, setActiveDatePickerId] = useState<string | null>(null)
  const supplementalMonthOptions = useMemo(() => supplementalMonthSelectOptions(monthPart(isoDate())), [])
  const currentHourSuggestionSignature = useMemo(() => JSON.stringify({
    title: title.trim(),
    requirement: requirement.trim(),
    type: type.trim(),
    requester: requester.trim(),
    attachments: briefFiles.map((file) => ({ name: file.name, chars: file.chars, text: file.text.slice(0, 1000) })),
  }), [briefFiles, requester, requirement, title, type])
  const hourSuggestionIsStale = Boolean(hourSuggestion && hourSuggestionInputSignature !== currentHourSuggestionSignature)

  const revokeBriefPreview = useCallback((item: BriefItem) => {
    if (item.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl)
    }
  }, [])

  const removeBriefFile = (id: string) => {
    setBriefFiles((prev) => {
      const removed = prev.find((item) => item.id === id)
      if (removed) {
        revokeBriefPreview(removed)
      }
      return prev.filter((item) => item.id !== id)
    })
  }

  useEffect(() => {
    briefFilesRef.current = briefFiles
  }, [briefFiles])

  useEffect(() => () => {
    briefFilesRef.current.forEach(revokeBriefPreview)
  }, [revokeBriefPreview])

  useEffect(() => {
    if (isEditing) {
      return
    }
    writeNewTaskDraftCache({
      title,
      requirement,
      type,
      startDate,
      estimatedMinutes,
      estimatedDate,
      scheduleAnchor: scheduleDerivedField,
      isSupplemental,
      settlementMonth,
      requester,
      contact,
      reviewer,
      supplementalNote,
    })
  }, [contact, estimatedDate, estimatedMinutes, isEditing, isSupplemental, requirement, requester, reviewer, scheduleDerivedField, settlementMonth, startDate, supplementalNote, title, type])

  const toggleScheduleField = (field: ScheduleAnchor) => {
    setScheduleDerivedField((current) => {
      if (current !== field) {
        return field
      }
      return field === 'start' ? 'end' : 'start'
    })
  }

  const updateStartDate = (value: string) => {
    const previousStartDate = datePart(startDate)
    const nextStartDate = datePart(value)
    const dateChanged = Boolean(value && previousStartDate && nextStartDate && previousStartDate !== nextStartDate)
    setStartDate(value)
    if (dateChanged && estimatedDate) {
      setEstimatedDate(withDatePart(estimatedDate, nextStartDate))
      return
    }
    if (scheduleDerivedField === 'hours') {
      const nextMinutes = exactDurationMinutesBetween(value, estimatedDate)
      if (nextMinutes > 0) {
        setEstimatedMinutes(nextMinutes)
        setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
      }
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(value, estimatedMinutes))
  }

  const updateEstimatedDate = (value: string) => {
    const previousEstimatedDate = datePart(estimatedDate)
    const nextEstimatedDate = datePart(value)
    const dateChanged = Boolean(value && previousEstimatedDate && nextEstimatedDate && previousEstimatedDate !== nextEstimatedDate)
    setEstimatedDate(value)
    if (dateChanged && startDate) {
      setStartDate(withDatePart(startDate, nextEstimatedDate))
      return
    }
    if (scheduleDerivedField === 'hours') {
      const nextMinutes = exactDurationMinutesBetween(startDate, value)
      if (nextMinutes > 0) {
        setEstimatedMinutes(nextMinutes)
        setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
      }
      return
    }
    setStartDate(addMinutesToPlanDateTime(value, -estimatedMinutes))
  }

  const updateEstimatedMinutes = (value: number, preserveInput = false) => {
    const nextMinutes = normalizeEstimatedMinutes(value)
    setEstimatedMinutes(nextMinutes)
    if (!preserveInput) {
      setEstimatedHoursInput(formatEstimatedDurationInputValue(nextMinutes))
    }
    if (scheduleDerivedField === 'start') {
      setStartDate(addMinutesToPlanDateTime(estimatedDate, -nextMinutes))
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(startDate, nextMinutes))
  }

  const updateEstimatedHoursInput = (value: string) => {
    setEstimatedHoursInput(value.slice(0, 32))
    if (scheduleDerivedField === 'hours') {
      setScheduleDerivedField('end')
    }
    const nextMinutes = parseEstimatedDurationInputMinutes(value)
    if (nextMinutes) {
      updateEstimatedMinutes(nextMinutes, true)
    }
  }

  const commitEstimatedHoursInput = () => {
    const nextMinutes = parseEstimatedDurationInputMinutes(estimatedHoursInput)
    updateEstimatedMinutes(nextMinutes || estimatedMinutes)
  }

  const applyVoiceTaskSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt && result.durationMinutes && result.endAt) {
      setStartDate(result.startAt)
      setEstimatedMinutes(result.durationMinutes)
      setEstimatedHoursInput(formatEstimatedDurationInputValue(result.durationMinutes))
      setEstimatedDate(result.endAt)
      if (result.derivedField) setScheduleDerivedField(result.derivedField)
      setActiveDatePickerId(null)
      return
    }
    if (result.suppliedFields.includes('start') && result.startAt) updateStartDate(result.startAt)
    if (result.suppliedFields.includes('hours') && result.durationMinutes) updateEstimatedMinutes(result.durationMinutes)
    if (result.suppliedFields.includes('end') && result.endAt) updateEstimatedDate(result.endAt)
    setActiveDatePickerId(null)
  }

  const clearFieldError = useCallback((field: string) => {
    setFormErrors((current) => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const recordTaskAssistantLearning = (finalTitle: string, finalRequirement: string, finalType: string) => {
    const requirementLearning = aiSuggestionAppliedRef.current
    if (requirementLearning) {
      void api.recordAiLearningEvent({
        context: 'task_requirement',
        sourceInput: requirementLearning.sourceInput,
        aiOutput: requirementLearning.aiOutput,
        userFinal: finalRequirement,
        action: aiLearningAction(requirementLearning, finalRequirement),
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
      })
    }
    const titleLearning = aiTitleSuggestionAppliedRef.current
    if (titleLearning) {
      void api.recordAiLearningEvent({
        context: 'task_title',
        sourceInput: titleLearning.sourceInput,
        aiOutput: titleLearning.aiOutput,
        userFinal: finalTitle,
        action: aiLearningAction(titleLearning, finalTitle),
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
      })
    }
    // 无论是否使用 AI，每次提交都记录最终选择的设计类型，供分类建议模型学习。
    if (finalTitle || finalRequirement) {
      void api.recordTaskTypeChoice({
        requirement: finalRequirement,
        title: finalTitle,
        finalType,
        aiSuggestedType: aiSuggestion?.suggestedType ?? undefined,
      })
      if (aiSuggestion?.suggestedType) {
        void api.recordAiLearningEvent({
          context: 'task_type',
          sourceInput: initialDraft.type,
          aiOutput: aiSuggestion.suggestedType,
          userFinal: finalType,
          action: finalType === aiSuggestion.suggestedType ? 'adopted' : 'rejected',
          designType: finalType,
          taskId: editingTask?.id,
          taskTitle: finalTitle,
        })
      }
    }
    if (hourSuggestion && !hourSuggestionIsStale) {
      const selectedHours = Math.round((estimatedMinutes / 60) * 100) / 100
      void api.recordAiLearningEvent({
        context: 'hour_estimate',
        sourceInput: currentHourSuggestionSignature,
        aiOutput: String(hourSuggestion.suggestedHours),
        userFinal: String(selectedHours),
        action: Math.abs(selectedHours - hourSuggestion.suggestedHours) < 0.01 ? 'adopted' : 'edited',
        designType: finalType,
        taskId: editingTask?.id,
        taskTitle: finalTitle,
        metadata: {
          suggestionId: hourSuggestion.suggestionId,
          source: 'task_submit',
          safeHours: hourSuggestion.safeHours,
          feedbackRating: hourSuggestionFeedback,
          feedbackReasons: hourSuggestionFeedbackReasons,
        },
      })
    }
    aiSuggestionAppliedRef.current = null
    aiTitleSuggestionAppliedRef.current = null
  }

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!type.trim()) {
      nextErrors.type = '请选择设计类型'
    }
    if (!title.trim()) {
      nextErrors.title = '请填写任务名称'
    }
    if (!requirement.trim()) {
      nextErrors.requirement = '请填写任务具体需求'
    }
    if (!requester.trim()) {
      nextErrors.requester = '请填写需求人'
    }
    if (!contact.trim()) {
      nextErrors.contact = '请填写对接人'
    }
    if (!reviewer.trim()) {
      nextErrors.reviewer = '请填写验收人'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }
    const estimated = Math.round((estimatedMinutes / 60) * 100) / 100
    const finalTitle = title.trim()
    const finalRequirement = requirement.trim()
    const finalType = type.trim()
    recordTaskAssistantLearning(finalTitle, finalRequirement, finalType)
    if (editingTask && onSave) {
      const nextRequester = requester.trim() || editingTask.requester || contact.trim() || '待确认'
      const nextContact = contact.trim() || editingTask.contact || nextRequester
      const nextReviewer = reviewer.trim() || editingTask.reviewer || nextRequester
      onSave({
        title: finalTitle || editingTask.title,
        date: startDate,
        estimatedDate,
        settlementMonth: isSupplemental ? settlementMonth : '',
        isSupplemental,
        type: finalType || editingTask.type,
        requirement: finalRequirement,
        requester: nextRequester,
        contact: nextContact,
        reviewer: nextReviewer,
        estimatedHours: estimated,
        hourEstimateSuggestionId: hourSuggestion && !hourSuggestionIsStale ? hourSuggestion.suggestionId : undefined,
        supplementalNote: isSupplemental ? supplementalNote.trim() : '',
        acceptanceNote: editingTask.acceptanceNote ?? '',
      })
      return
    }

    const status: TaskStatus = '计划中'

    onCreate({
      id: Date.now(),
      date: startDate,
      estimatedDate,
      settlementMonth: isSupplemental ? settlementMonth : '',
      isSupplemental,
      type: finalType,
      title: finalTitle,
      requirement: finalRequirement,
      requester: requester.trim(),
      contact: contact.trim(),
      reviewer: reviewer.trim() || requester.trim(),
      stage: status,
      estimatedHours: estimated,
      hourEstimateSuggestionId: hourSuggestion && !hourSuggestionIsStale ? hourSuggestion.suggestionId : undefined,
      actualHours: 0,
      status,
      progress: 0,
      billable: !isFree,
      supplementalNote: isSupplemental ? supplementalNote.trim() : '',
      acceptanceNote: '',
      files: [],
    })
  }

  const toggleFree = () => setIsFree((value) => !value)

  const toggleSupplemental = () => {
    const next = !isSupplemental
    setIsSupplemental(next)
    if (next && !supplementalMonthOptions.includes(settlementMonth)) {
      setSettlementMonth(supplementalMonthOptions[0])
    }
    if (!next) {
      setSupplementalNote('')
    }
  }

  const loadBriefFiles = useCallback(async (fileList: FileList | File[] | null, source: 'picker' | 'paste' = 'picker') => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    const availableSlots = Math.max(0, 6 - briefFilesRef.current.length)
    if (availableSlots === 0) {
      setBriefError('最多添加 6 个需求附件')
      return
    }
    setBriefError('')
    setIsBriefLoading(true)
    const added: BriefItem[] = []
    try {
      for (const file of files.slice(0, availableSlots)) {
        const displayName = source === 'paste' ? pastedImageName(file) : file.name
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
            reader.readAsDataURL(file)
          })
          added.push({ id: crypto.randomUUID(), name: displayName, text: '', chars: 0, isImage: true, base64, mimeType: file.type || 'image/jpeg' })
        } else {
          const text = await extractAttachmentText(file)
          if (text.trim()) {
            const previewFile = await createOptionalPreviewFile(file) ?? await createTextPreviewFile(file.name, text)
            const previewUrl = previewFile ? URL.createObjectURL(previewFile) : undefined
            added.push({
              id: crypto.randomUUID(),
              name: displayName,
              text,
              chars: text.length,
              previewUrl,
              previewLabel: splitFileName(file.name).extension.replace('.', '').toUpperCase() || 'FILE',
            })
          } else {
            setBriefError('部分文件没能读到文字（支持 Word .docx、PPT .pptx、PDF、txt；旧版 .doc/.ppt 请另存为新格式）')
          }
        }
      }
      if (added.length > 0) {
        setBriefFiles((prev) => {
          const combined = [...prev, ...added]
          combined.slice(6).forEach(revokeBriefPreview)
          return combined.slice(0, 6)
        })
      }
    } catch {
      added.forEach(revokeBriefPreview)
      setBriefError('读取附件失败，请换个文件或稍后重试')
    } finally {
      setIsBriefLoading(false)
      if (briefInputRef.current) briefInputRef.current.value = ''
    }
  }, [revokeBriefPreview])

  const handleBriefPaste = (event: React.ClipboardEvent) => {
    // 已明确聚焦任务名称/需求等可编辑字段时，交回给该字段正常粘贴，避免图片被附件区抢走。
    if (isEditableShortcutTarget(event.target) && !(event.target instanceof Element && event.target.closest('.new-task-brief-field'))) {
      return
    }
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (pastedImages.length === 0) {
      return
    }
    event.preventDefault()
    void loadBriefFiles(pastedImages, 'paste')
  }

  useEffect(() => {
    const routeDefaultPaste = (event: ClipboardEvent) => {
      // 用户已经把光标放进输入框时，文本和图片都由当前字段决定；不覆盖明确意图。
      if (isEditableShortcutTarget(document.activeElement)) {
        return
      }
      const clipboard = event.clipboardData
      if (!clipboard) {
        return
      }
      const pastedImages = Array.from(clipboard.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (pastedImages.length > 0) {
        event.preventDefault()
        void loadBriefFiles(pastedImages, 'paste')
        return
      }
      const pastedText = clipboard.getData('text/plain').trim()
      if (!pastedText) {
        return
      }
      event.preventDefault()
      setRequirement((current) => current ? `${current}\n${pastedText}` : pastedText)
      clearFieldError('requirement')
    }
    window.addEventListener('paste', routeDefaultPaste, true)
    return () => window.removeEventListener('paste', routeDefaultPaste, true)
  }, [clearFieldError, loadBriefFiles])

  const isBriefFileDrag = (event: React.DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes('Files')

  const handleBriefDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    briefDragDepthRef.current += 1
    setIsBriefDragOver(true)
  }

  const handleBriefDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleBriefDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    briefDragDepthRef.current = Math.max(0, briefDragDepthRef.current - 1)
    if (briefDragDepthRef.current === 0) setIsBriefDragOver(false)
  }

  const handleBriefDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isBriefFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    briefDragDepthRef.current = 0
    setIsBriefDragOver(false)
    void loadBriefFiles(event.dataTransfer.files)
  }

  const requestAiSuggestion = async () => {
    setAiError('')
    setAiSuggestion(null)
    setIsAiLoading(true)
    try {
      const textFiles = briefFiles.filter((f) => !f.isImage)
      const imageFiles = briefFiles.filter((f) => f.isImage && f.base64)
      const suggestion = await api.suggestTaskAssistant({
        title,
        requirement,
        selectedType: type,
        designTypeGroups: availableDesignTypeGroups,
        attachmentText: textFiles.map((f) => f.text).join('\n\n').slice(0, 8000) || undefined,
        attachmentName: textFiles.map((f) => f.name).join('、') || undefined,
        attachmentImages: imageFiles.map((f) => ({ base64: f.base64!, mimeType: f.mimeType ?? 'image/jpeg', name: f.name })),
      })
      setAiSuggestion(suggestion)
      const optimizedRequirement = taskAssistantRequirementWithoutOutputFiles(suggestion.optimizedRequirement)
      aiSuggestionAppliedRef.current = optimizedRequirement
        ? { sourceInput: requirement.trim(), aiOutput: optimizedRequirement, applied: false }
        : null
      aiTitleSuggestionAppliedRef.current = suggestion.suggestedTitle
        ? { sourceInput: title.trim(), aiOutput: suggestion.suggestedTitle, applied: false }
        : null
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsAiLoading(false)
    }
  }

  const applyAiTitle = () => {
    if (!aiSuggestion?.suggestedTitle) return
    aiTitleSuggestionAppliedRef.current = {
      sourceInput: aiTitleSuggestionAppliedRef.current?.sourceInput ?? title.trim(),
      aiOutput: aiSuggestion.suggestedTitle,
      applied: true,
    }
    setTitle(aiSuggestion.suggestedTitle)
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) {
      return
    }
    const nextRequirement = taskAssistantRequirementWithoutOutputFiles(aiSuggestion.optimizedRequirement)
    aiSuggestionAppliedRef.current = {
      sourceInput: aiSuggestionAppliedRef.current?.sourceInput ?? requirement.trim(),
      aiOutput: nextRequirement,
      applied: true,
    }
    setRequirement(nextRequirement)
  }

  const applyAiCategory = () => {
    if (!aiSuggestion?.categoryExists) {
      return
    }
    setType(aiSuggestion.suggestedType)
  }

  const addSuggestedCategoryAndApply = async () => {
    if (!aiSuggestion) {
      return
    }
    const parent = aiSuggestion.suggestedParentType.trim()
    const child = aiSuggestion.suggestedChildType.trim()
    if (!parent || !child) {
      return
    }
    const nextGroups = [...availableDesignTypeGroups]
    const index = nextGroups.findIndex((group) => group.name === parent)
    if (index >= 0) {
      const current = nextGroups[index]
      nextGroups[index] = { ...current, items: current.items.includes(child) ? current.items : [...current.items, child] }
    } else {
      nextGroups.push({ name: parent, items: [child] })
    }
    await onDesignTypeGroupsChange(nextGroups)
    setType(`${parent} / ${child}`)
    setAiSuggestion({ ...aiSuggestion, categoryExists: true, missingCategory: undefined })
  }

  const requestHourSuggestion = async () => {
    setHourSuggestionError('')
    setHourSuggestion(null)
    setHourSuggestionFeedback(null)
    setHourSuggestionFeedbackReasons([])
    setHourSampleFeedback({})
    setIsHourSuggestionLoading(true)
    try {
      const suggestion = await api.suggestHourEstimate({
        title,
        requirement,
        selectedType: type,
        requester,
        startDate,
        estimatedDate,
        currentEstimatedHours: estimatedMinutes / 60,
        attachmentText: briefFiles.filter((file) => !file.isImage).map((file) => file.text).join('\n\n').slice(0, 5000) || undefined,
        attachmentNames: briefFiles.map((file) => file.name),
      })
      setHourSuggestion(suggestion)
      setHourSuggestionInputSignature(currentHourSuggestionSignature)
    } catch (error) {
      setHourSuggestionError(error instanceof Error ? error.message : 'AI 工时建议暂时不可用')
    } finally {
      setIsHourSuggestionLoading(false)
    }
  }

  const applyHourSuggestion = (hours = hourSuggestion?.suggestedHours) => {
    if (!hourSuggestion || hourSuggestionIsStale || !hourSuggestion.decision.canApply || !hours) {
      return
    }
    updateEstimatedMinutes(hours * 60)
  }

  const applyHourCompletionOption = (appendText: string) => {
    if (!appendText || requirement.includes(appendText)) return
    setRequirement([requirement.trim(), appendText].filter(Boolean).join('\n'))
  }

  const toggleHourSampleFeedback = (sampleTaskId: number) => {
    if (!hourSuggestion || hourSuggestionIsStale) return
    const relevant = hourSampleFeedback[sampleTaskId] === false
    setHourSampleFeedback((current) => ({ ...current, [sampleTaskId]: relevant }))
    void api.recordHourEstimateSampleFeedback({
      suggestionId: hourSuggestion.suggestionId,
      sampleTaskId,
      relevant,
      reason: relevant ? '恢复为可参考样本' : '当前任务与该历史样本不相似',
    }).catch((error) => {
      setHourSampleFeedback((current) => ({ ...current, [sampleTaskId]: !relevant }))
      setHourSuggestionError(error instanceof Error ? error.message : '参考样本反馈保存失败')
    })
  }

  const recordHourSuggestionFeedback = (rating: HourEstimateFeedbackRating) => {
    if (!hourSuggestion || hourSuggestionIsStale) {
      return
    }
    setHourSuggestionFeedback(rating)
    if (rating === 'accurate') {
      setHourSuggestionFeedbackReasons([])
    }
    void api.recordAiLearningEvent({
      context: 'hour_estimate',
      sourceInput: currentHourSuggestionSignature,
      aiOutput: String(hourSuggestion.suggestedHours),
      userFinal: '',
      action: rating === 'accurate' ? 'adopted' : 'rejected',
      designType: type.trim(),
      taskId: editingTask?.id,
      taskTitle: title.trim(),
      metadata: {
        suggestionId: hourSuggestion.suggestionId,
        source: 'explicit_feedback',
        rating,
      },
    })
  }

  const toggleHourSuggestionFeedbackReason = (reason: string) => {
    if (!hourSuggestion || !hourSuggestionFeedback || hourSuggestionFeedback === 'accurate') {
      return
    }
    setHourSuggestionFeedbackReasons((current) => {
      const next = current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]
      void api.recordAiLearningEvent({
        context: 'hour_estimate',
        sourceInput: currentHourSuggestionSignature,
        aiOutput: String(hourSuggestion.suggestedHours),
        userFinal: '',
        action: 'rejected',
        designType: type.trim(),
        taskId: editingTask?.id,
        taskTitle: title.trim(),
        metadata: {
          suggestionId: hourSuggestion.suggestionId,
          source: 'explicit_feedback',
          rating: hourSuggestionFeedback,
          reasons: next,
        },
      })
      return next
    })
  }

  return (
    <ModalShell className="new-task-modal" labelledBy="new-task-title" onClose={onClose} closeOnBackdrop={false} closeOnEscape={false}>
        <header className="modal-header">
          <div>
            <h2 id="new-task-title">{isEditing ? '编辑任务' : isSupplemental ? '补录已完成任务' : '新建任务'}</h2>
            <span className="new-task-modal-subtitle">
              {isEditing ? '修改任务信息，工时、文件与月报仍会从这里串起来' : isSupplemental ? '登记过往已交付、需计入某月结算的任务' : '记录一条真实任务，工时、文件与月报都会从这里串起来'}
            </span>
          </div>
          <div className="modal-header-actions">
            <div className="supplemental-switch-wrap">
              {!isEditing && (
                <button
                  type="button"
                  className={`supplemental-toggle-button ${isFree ? 'active' : ''}`}
                  aria-label="不计费任务"
                  aria-pressed={isFree}
                  title={isFree ? '不计费任务：不计入计费工时与收入，但仍会出现在结算报表' : '标记为不计费任务（免费协助）'}
                  onClick={toggleFree}
                >
                  <span>不计费</span>
                  <span className={`switch-control ${isFree ? 'active' : ''}`} aria-hidden="true"><i /></span>
                </button>
              )}
              {isSupplemental && (
                <label className="supplemental-month-select">
                  <span>记录月份</span>
                  <select value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} aria-label="计入结算月份">
                    {supplementalMonthOptions.map((monthValue) => (
                      <option key={monthValue} value={monthValue}>
                        {monthLabelOf(monthValue)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className={`supplemental-toggle-button ${isSupplemental ? 'active' : ''}`}
                aria-label="补录任务"
                aria-pressed={isSupplemental}
                title={isSupplemental ? `补录至 ${monthLabelOf(settlementMonth)}` : '标记为补录任务'}
                onClick={toggleSupplemental}
              >
                <span>补录</span>
                <span className={`switch-control ${isSupplemental ? 'active' : ''}`} aria-hidden="true"><i /></span>
              </button>
            </div>
          </div>
        </header>

        <div className="form-grid new-task-form" onPaste={handleBriefPaste}>
          <div className={`field wide new-task-type-field ${formErrors.type ? 'field-invalid' : ''}`}>
            <span>设计类型</span>
            <NewTaskDesignTypeSelector groups={availableDesignTypeGroups} value={type} onChange={(value) => { setType(value); clearFieldError('type') }} />
            {formErrors.type && <small className="field-error">{formErrors.type}</small>}
          </div>
          <label className={`field wide ${formErrors.title ? 'field-invalid' : ''}`}>
            <span>任务名称</span>
            <input value={title} onChange={(event) => { setTitle(event.target.value); clearFieldError('title') }} placeholder="例如：金博会邀请函长图设计" aria-required="true" />
            {formErrors.title && <small className="field-error">{formErrors.title}</small>}
          </label>
          <div className={`field wide ${formErrors.requirement ? 'field-invalid' : ''}`}>
            <span className="field-label-row">
              <span>任务需求</span>
              <button
                type="button"
                className="icon-button ai-assist-button"
                aria-label="AI 优化任务需求"
                title="AI 优化任务需求"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void requestAiSuggestion()
                }}
                disabled={isAiLoading || (!title.trim() && !requirement.trim() && briefFiles.length === 0)}
              >
                <Sparkles size={16} />
              </button>
            </span>
            <textarea
              aria-label="任务具体需求"
              value={requirement}
              onChange={(event) => { setRequirement(event.target.value); clearFieldError('requirement') }}
              placeholder="例如：为金博会制作论坛预热邀请长图，用于各渠道发送"
              aria-required="true"
            />
            {formErrors.requirement && <small className="field-error">{formErrors.requirement}</small>}
          </div>
          <div
            className={`field wide new-task-brief-field ${isBriefDragOver ? 'is-dragover' : ''}`}
            data-testid="new-task-brief-dropzone"
            onDragEnter={handleBriefDragEnter}
            onDragOver={handleBriefDragOver}
            onDragLeave={handleBriefDragLeave}
            onDrop={handleBriefDrop}
          >
            <span className="field-label-row">
              <span>合作伙伴文案附件（选填）</span>
            </span>
            <div className="brief-files-list">
              {briefFiles.map((f) => (
                f.isImage && f.base64 ? (
                  <div key={f.id} className="brief-img-chip">
                    <img src={`data:${f.mimeType};base64,${f.base64}`} className="brief-img-thumb" alt={f.name} onClick={() => setBriefLightboxSrc(`data:${f.mimeType};base64,${f.base64}`)} style={{ cursor: 'zoom-in' }} />
                    <button type="button" className="brief-img-remove" aria-label="移除" onClick={() => removeBriefFile(f.id)}>
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div key={f.id} className={`brief-file-chip ${f.previewUrl ? 'has-preview' : ''}`}>
                    <button type="button" className="brief-file-remove" aria-label="移除" onClick={() => removeBriefFile(f.id)}>
                      <X size={10} />
                    </button>
                    <button
                      type="button"
                      className="brief-file-preview-thumb"
                      aria-label={`预览 ${f.name}`}
                      onClick={() => f.previewUrl && setBriefLightboxSrc(f.previewUrl)}
                      disabled={!f.previewUrl}
                    >
                      {f.previewUrl ? (
                        <img src={f.previewUrl} alt={f.name} />
                      ) : (
                        <>
                          <FileText size={18} />
                          <span>{f.previewLabel || 'FILE'}</span>
                        </>
                      )}
                    </button>
                    <div className="brief-file-meta">
                      <strong>{f.name}</strong>
                      <small>约 {f.chars} 字</small>
                    </div>
                  </div>
                )
              ))}
              {briefFiles.length < 6 && (
                <button
                  type="button"
                  className={`brief-upload-box ${briefFiles.length > 0 ? 'brief-upload-compact' : ''}`}
                  onClick={() => briefInputRef.current?.click()}
                  disabled={isBriefLoading}
                >
                  <Plus size={briefFiles.length > 0 ? 16 : 14} />
                  {briefFiles.length === 0 && (isBriefLoading ? '正在读取…' : '上传、拖拽或 Command+V 粘贴合作伙伴文案到这里')}
                  {briefFiles.length > 0 && isBriefLoading && <small>读取中…</small>}
                  {briefFiles.length === 0 && <small>支持 Word .docx / PPT .pptx / PDF / txt / 图片，最多 6 个</small>}
                </button>
              )}
            </div>
            {briefError && <small className="field-error">{briefError}</small>}
            <input
              ref={briefInputRef}
              type="file"
              multiple
              className="task-row-upload-input"
              accept=".docx,.pptx,.pdf,.txt,.md,.csv,.jpg,.jpeg,.png,.webp,.gif"
              onChange={(event) => void loadBriefFiles(event.target.files)}
            />
          </div>
          {briefLightboxSrc && <ImageLightbox src={briefLightboxSrc} alt="附件图片预览" onClose={() => setBriefLightboxSrc(null)} />}
          {(aiSuggestion || aiError || isAiLoading) && (
            <div className="ai-suggestion-panel wide">
              <div className="ai-suggestion-head">
                <span>{isAiLoading ? 'AI 正在整理需求' : 'AI 建议'}</span>
                {aiSuggestion && (
                  <button
                    type="button"
                    className="ai-suggestion-category-adopt"
                    aria-label={`采用建议分类：${aiSuggestion.suggestedType}`}
                    title="点击采用此分类"
                    onClick={() => aiSuggestion.categoryExists ? applyAiCategory() : void addSuggestedCategoryAndApply()}
                  >
                    {aiSuggestion.suggestedType}
                  </button>
                )}
                {!isAiLoading && (aiSuggestion || aiError) && (
                  <button type="button" className="ai-suggestion-dismiss" aria-label="关闭建议" title="关闭建议" onClick={() => { setAiSuggestion(null); setAiError('') }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {isAiLoading && <p>正在优化文案并匹配设计类型...</p>}
              {aiError && <p className="ai-suggestion-error">{aiError}</p>}
              {aiSuggestion && (
                <>
                  {aiSuggestion.suggestedTitle && (
                    <button
                      type="button"
                      className="ai-suggestion-title-row ai-suggestion-adopt-target"
                      aria-label="采用建议任务名称"
                      title="点击采用建议任务名称"
                      onClick={applyAiTitle}
                    >
                      <span className="ai-suggestion-title-label">建议任务名称</span>
                      <span className="ai-suggestion-title-text">{aiSuggestion.suggestedTitle}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ai-suggestion-body ai-suggestion-adopt-target"
                    aria-label="采用建议文案"
                    title="点击采用建议文案"
                    onClick={applyAiSuggestion}
                  >
                    {taskAssistantRequirementWithoutOutputFiles(aiSuggestion.optimizedRequirement).split('\n').map((line, index) => {
                      const trimmed = line.trim()
                      if (!trimmed) {
                        return null
                      }
                      const isHeading = /^【.+】/.test(trimmed)
                      const isItem = trimmed.startsWith('·') || trimmed.startsWith('•')
                      if (isHeading) {
                        return <strong className="ai-suggestion-heading" key={index}>{trimmed}</strong>
                      }
                      if (isItem) {
                        return <span className="ai-suggestion-item" key={index}>{trimmed}</span>
                      }
                      return <span className="ai-suggestion-line" key={index}>{trimmed}</span>
                    })}
                  </button>
                  {aiSuggestion.reason && <small>{aiSuggestion.reason}</small>}
                </>
              )}
            </div>
          )}
          <div className="new-task-people-row wide">
            <label className={`field ${formErrors.requester ? 'field-invalid' : ''}`}>
              <span>需求人</span>
              <input
                value={requester}
                onChange={(event) => {
                  const value = event.target.value
                  setRequester(value)
                  if (!reviewerEdited) {
                    setReviewer(value)
                  }
                  clearFieldError('requester')
                  if (!reviewerEdited) {
                    clearFieldError('reviewer')
                  }
                }}
                placeholder="例如：市场部 · 王敏"
                aria-required="true"
              />
              {formErrors.requester && <small className="field-error">{formErrors.requester}</small>}
            </label>
            <label className={`field ${formErrors.contact ? 'field-invalid' : ''}`}>
              <span>对接人</span>
              <input value={contact} onChange={(event) => { setContact(event.target.value); clearFieldError('contact') }} placeholder="例如：黄媚" aria-required="true" />
              {formErrors.contact && <small className="field-error">{formErrors.contact}</small>}
            </label>
            <label className={`field ${formErrors.reviewer ? 'field-invalid' : ''}`}>
              <span>验收人</span>
              <input
                value={reviewer}
                onChange={(event) => {
                  setReviewer(event.target.value)
                  setReviewerEdited(true)
                  clearFieldError('reviewer')
                }}
                placeholder="默认同需求人"
                aria-required="true"
              />
              {formErrors.reviewer && <small className="field-error">{formErrors.reviewer}</small>}
            </label>
          </div>
          <div className="new-task-time-label">
            <span>时间与工时</span>
            <em>三项同时只激活两项，第三项自动推算（灰色）</em>
            <VoiceScheduleButton
              context="新建或编辑任务的预计排期"
              currentStart={startDate}
              currentDurationMinutes={estimatedMinutes}
              currentEnd={estimatedDate}
              onApply={applyVoiceTaskSchedule}
            />
          </div>
          <div className="new-task-schedule-row">
            <PlanDateTimeField
              label="预计开始"
              value={startDate}
              onChange={updateStartDate}
              isActive={scheduleDerivedField !== 'start'}
              readOnly={scheduleDerivedField === 'start'}
              control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'start'} label="切换预计开始时间" onClick={() => toggleScheduleField('start')} />}
              pickerId="new-task-start"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
            <div className="field">
              <span className="new-task-inline-label">
                <ScheduleAnchorSwitch active={scheduleDerivedField !== 'hours'} label="切换预估工时" onClick={() => toggleScheduleField('hours')} />
                预估工时
              </span>
              <div className="new-task-hours-row">
                <input
                  className="new-task-hours-input"
                  type="text"
                  inputMode="text"
                  value={estimatedHoursInput}
                  placeholder="如 15分钟"
                  onFocus={(event) => {
                    event.currentTarget.select()
                    if (scheduleDerivedField === 'hours') {
                      setScheduleDerivedField('end')
                    }
                  }}
                  onChange={(event) => updateEstimatedHoursInput(event.target.value)}
                  onBlur={commitEstimatedHoursInput}
                  aria-label="预估工时，可输入15分钟、1小时30分钟或小数小时"
                />
                <button
                  type="button"
                  className="new-task-ai-pill"
                  onClick={() => void requestHourSuggestion()}
                  disabled={isHourSuggestionLoading || !type.trim() || (!title.trim() && !requirement.trim())}
                >
                  <Sparkles size={14} />
                  {isHourSuggestionLoading ? '分析中' : 'AI 分析'}
                </button>
              </div>
            </div>
            <PlanDateTimeField
              label="预计交付"
              value={estimatedDate}
              onChange={updateEstimatedDate}
              isActive={scheduleDerivedField !== 'end'}
              readOnly={scheduleDerivedField === 'end'}
              control={<ScheduleAnchorSwitch active={scheduleDerivedField !== 'end'} label="切换预计交付时间" onClick={() => toggleScheduleField('end')} />}
              pickerId="new-task-end"
              activePickerId={activeDatePickerId}
              onActivePickerChange={setActiveDatePickerId}
            />
          </div>
          {(isHourSuggestionLoading || hourSuggestion || hourSuggestionError) && (
          <div className="hour-estimate-panel wide">
            <div className="hour-estimate-head">
              <div>
                <strong>工时建议</strong>
                <span>基于同类型历史任务、实际工时和验收备注分析</span>
              </div>
              <div className="hour-estimate-head-actions">
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => void requestHourSuggestion()}
                  disabled={isHourSuggestionLoading || !type.trim() || (!title.trim() && !requirement.trim())}
                >
                  <Sparkles size={14} />
                  {isHourSuggestionLoading ? '分析中' : 'AI 分析'}
                </button>
                {!isHourSuggestionLoading && (hourSuggestion || hourSuggestionError) && (
                  <button type="button" className="ai-suggestion-dismiss" aria-label="关闭工时建议" title="关闭工时建议" onClick={() => { setHourSuggestion(null); setHourSuggestionError('') }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {isHourSuggestionLoading && <p>正在读取历史任务并生成工时建议...</p>}
            {hourSuggestionError && <p className="ai-suggestion-error">{hourSuggestionError}</p>}
            {!isHourSuggestionLoading && !hourSuggestion && !hourSuggestionError && (
              <p>填写任务类型和需求后，可以让 AI 参考过往同类任务，给出更稳的预估工时。</p>
            )}
            {hourSuggestion && (
              <div className="hour-estimate-result">
                <div className="hour-estimate-main">
                  <div className="hour-estimate-primary-value">
                    <span>常规预估</span>
                    <strong>{hourSuggestion.suggestedHours.toFixed(1)} h</strong>
                  </div>
                  <div className="hour-estimate-safe-value">
                    <span>稳妥预留</span>
                    <strong>{hourSuggestion.safeHours.toFixed(1)} h</strong>
                  </div>
                  <em className={`hour-confidence confidence-${hourSuggestion.confidence}`}>{hourSuggestion.confidence}置信度</em>
                  <em className={`hour-complexity complexity-${hourSuggestion.complexity.level}`}>
                    {hourSuggestion.complexity.level}复杂度 · {hourSuggestion.complexity.score}
                  </em>
                </div>
                <div className="hour-estimate-stats">
                  <span>常规区间 {hourSuggestion.expectedRange.low.toFixed(1)}–{hourSuggestion.expectedRange.high.toFixed(1)} h</span>
                  <span>精确同类 {hourSuggestion.exactSampleCount} 条</span>
                  <span>相关参考 {hourSuggestion.similarSampleCount} 条</span>
                  {hourSuggestion.sampleCount > 0 && <span>历史中位 {hourSuggestion.medianHours.toFixed(1)} h</span>}
                  {hourSuggestion.sampleCount > 0 && <span>范围 {hourSuggestion.minHours.toFixed(1)}–{hourSuggestion.maxHours.toFixed(1)} h</span>}
                  {hourSuggestion.averageDeliveryDays > 0 && <span>平均周期 {hourSuggestion.averageDeliveryDays.toFixed(1)} 天</span>}
                </div>
                <section className={`hour-estimate-decision ${hourSuggestion.decision.mode}`}>
                  <div>
                    <strong>{hourSuggestion.decision.mode === 'estimate' ? '可采用建议' : hourSuggestion.decision.mode === 'range_only' ? '仅提供区间' : '需要补充信息'}</strong>
                    <span>需求质量 {hourSuggestion.requirementQuality.score} 分 · {hourSuggestion.requirementQuality.grade}</span>
                  </div>
                  <p>{hourSuggestion.decision.reason}</p>
                  <small>{hourSuggestion.requirementQuality.summary}</small>
                </section>
                {hourSuggestion.completionOptions.length > 0 && (
                  <section className="hour-requirement-completion">
                    <div><strong>快速补全需求</strong><span>点击后写入需求，再重新分析</span></div>
                    <div>
                      {hourSuggestion.completionOptions.map((option) => (
                        <button type="button" key={option.key} disabled={requirement.includes(option.appendText)} onClick={() => applyHourCompletionOption(option.appendText)}>
                          {requirement.includes(option.appendText) ? '已补充 · ' : ''}{option.label}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section className="hour-change-audit">
                  <div><strong>相比上次建议</strong><span>{hourSuggestion.changeAudit.hasPrevious ? `${hourSuggestion.changeAudit.deltaHours >= 0 ? '+' : ''}${hourSuggestion.changeAudit.deltaHours.toFixed(1)} h` : '首次基线'}</span></div>
                  <p>{hourSuggestion.changeAudit.summary}</p>
                  {hourSuggestion.changeAudit.reasons.length > 0 && <small>{hourSuggestion.changeAudit.reasons.join('；')}</small>}
                </section>
                <section className="hour-pricing-suggestion" aria-label="报价建议">
                  <header>
                    <strong>报价建议</strong>
                    <span>按 ¥{hourSuggestion.pricing.hourlyRate.toLocaleString()} / 小时，仅供确认前参考</span>
                  </header>
                  <div>
                    <p><span>常规报价</span><strong>¥{hourSuggestion.pricing.regularAmount.toLocaleString()}</strong></p>
                    <p><span>稳妥报价</span><strong>¥{hourSuggestion.pricing.safeAmount.toLocaleString()}</strong></p>
                    <p><span>建议范围</span><strong>¥{hourSuggestion.pricing.rangeLowAmount.toLocaleString()}–{hourSuggestion.pricing.rangeHighAmount.toLocaleString()}</strong></p>
                  </div>
                  <small>{hourSuggestion.pricing.summary} 风险预留参考 {hourSuggestion.pricing.riskReserveRate}%。</small>
                </section>
                <p>{hourSuggestion.historicalSummary}</p>
                <div className="hour-estimate-explain-grid">
                  <section className="hour-estimate-explain-section">
                    <header>
                      <strong>复杂度画像</strong>
                      <span>按当前需求确定性提取</span>
                    </header>
                    <div>
                      {hourSuggestion.complexity.dimensions.map((dimension) => (
                        <p key={dimension.key} title={dimension.evidence}>
                          <span>{dimension.label}</span>
                          <strong>{dimension.value}</strong>
                          <em className={`impact-${dimension.impact}`}>{dimension.impact}</em>
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="hour-estimate-explain-section">
                    <header>
                      <strong>工时拆分</strong>
                      <span>合计 {hourSuggestion.suggestedHours.toFixed(1)} h</span>
                    </header>
                    <div>
                      {hourSuggestion.breakdown.map((item) => (
                        <p key={item.label} title={item.reason}>
                          <span>{item.label}</span>
                          <strong>{item.reason}</strong>
                          <em>{item.hours.toFixed(1)} h</em>
                        </p>
                      ))}
                    </div>
                  </section>
                </div>
                {hourSuggestion.requesterAdjustment.requester && (
                  <div className={`hour-requester-adjustment ${hourSuggestion.requesterAdjustment.applied ? 'applied' : ''}`}>
                    <strong>需求人校准</strong>
                    <span>{hourSuggestion.requesterAdjustment.summary}</span>
                  </div>
                )}
                <div className={`hour-requester-adjustment ${hourSuggestion.learningAdjustment.applied ? 'applied' : ''}`}>
                  <strong>个人采用校准</strong>
                  <span>{hourSuggestion.learningAdjustment.summary}</span>
                </div>
                <div className="hour-estimate-reliability">
                  <div>
                    <strong>历史命中率</strong>
                    <span>{hourSuggestion.accuracy.summary}</span>
                  </div>
                  {hourSuggestion.riskFactors.length > 0 && (
                    <div>
                      <strong>本次不确定因素</strong>
                      <span>{hourSuggestion.riskFactors.join('；')}</span>
                    </div>
                  )}
                </div>
                {hourSuggestion.clarificationQuestions.length > 0 && (
                  <div className="hour-estimate-questions">
                    <strong>补充这些信息，建议会更准</strong>
                    <ol>
                      {hourSuggestion.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}
                    </ol>
                  </div>
                )}
                {hourSuggestionIsStale && <p className="hour-estimate-stale">任务信息已经变化，请重新分析后再采用。</p>}
                {hourSuggestion.basis.length > 0 && (
                  <ul>
                    {hourSuggestion.basis.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
                {hourSuggestion.matchedTasks.length > 0 && (
                  <details className="hour-estimate-samples">
                    <summary>查看参考任务</summary>
                    <div>
                      {hourSuggestion.matchedTasks.map((sample) => (
                        <p key={sample.id}>
                          <span>{sample.relation}</span>
                          <strong>
                            {sample.title}
                            {sample.similarityReasons.length > 0 && <small>{sample.similarityReasons.join(' · ')}</small>}
                          </strong>
                          <em>{sample.actualHours.toFixed(1)} h</em>
                          <button
                            type="button"
                            className={hourSampleFeedback[sample.id] === false ? 'active' : ''}
                            disabled={hourSuggestionIsStale}
                            onClick={() => toggleHourSampleFeedback(sample.id)}
                          >
                            {hourSampleFeedback[sample.id] === false ? '已标记不相似' : '不相似'}
                          </button>
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                <div className="hour-estimate-feedback">
                  <div>
                    <strong>这次建议准确吗？</strong>
                    <span>反馈会在同类样本达到门槛后参与后续校准。</span>
                  </div>
                  <div className="hour-estimate-feedback-options" role="group" aria-label="评价 AI 工时建议">
                    {hourEstimateFeedbackOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={hourSuggestionFeedback === option.value ? 'active' : ''}
                        aria-pressed={hourSuggestionFeedback === option.value}
                        disabled={hourSuggestionIsStale}
                        onClick={() => recordHourSuggestionFeedback(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {hourSuggestionFeedback && hourSuggestionFeedback !== 'accurate' && (
                    <div className="hour-estimate-feedback-reasons" role="group" aria-label="工时建议偏差原因">
                      {hourEstimateFeedbackReasons.map((reason) => (
                        <button
                          type="button"
                          key={reason}
                          className={hourSuggestionFeedbackReasons.includes(reason) ? 'active' : ''}
                          aria-pressed={hourSuggestionFeedbackReasons.includes(reason)}
                          onClick={() => toggleHourSuggestionFeedbackReason(reason)}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hour-estimate-actions">
                  <small>{hourSuggestion.usedFallback ? '精确样本不足时，相关任务仅作为较低权重参考。' : '建议仅使用已验收任务的真实工时。'} · 算法 {hourSuggestion.modelVersion.algorithm}</small>
                  <div>
                    <button type="button" className="ghost-button compact-button" disabled={hourSuggestionIsStale || !hourSuggestion.decision.canApply} onClick={() => applyHourSuggestion(hourSuggestion.safeHours)}>
                      采用稳妥值
                    </button>
                    <button type="button" className="primary-button compact-button" disabled={hourSuggestionIsStale || !hourSuggestion.decision.canApply} onClick={() => applyHourSuggestion(hourSuggestion.suggestedHours)}>
                      采用常规值
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
          {isSupplemental && (
            <label className="field wide">
              <span>补录说明</span>
              <textarea
                value={supplementalNote}
                onChange={(event) => setSupplementalNote(event.target.value)}
                placeholder="例如：该任务已于 5 月完成，本次补录到 6 月结算单。验收、实际工时和交付文件请在任务详情中确认。"
              />
            </label>
          )}
        </div>

        <footer className="modal-footer">
          <button className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button data-modal-save="true" className="primary-button" onClick={handleSubmit}>
            {isEditing ? '保存修改' : '创建任务'}
          </button>
        </footer>
    </ModalShell>
  )
}

export default App
