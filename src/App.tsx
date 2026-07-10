import { Fragment, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  ArrowUp,
  ArrowRightLeft,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Briefcase,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  Folder,
  FolderKanban,
  Bot,
  GripVertical,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  List,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Info,
  Tag,
  Trash2,
  UserCircle,
  X,
  BookOpen,
  Paperclip,
  FileText as FileTextIcon,
  History,
  Globe,
  SlidersHorizontal,
  Heart,
  Star,
} from 'lucide-react'
import {
  appReleaseDate,
  appVersion,
  defaultDesignTypeGroups,
  defaultDesignTypes,
  defaultHourlyRate,
  defaultPdfTitle,
  defaultServiceCompanyName,
  designTypeColorPalette,
  importedHoursMonth,
  importedMonthlyHours,
  type DesignTypeGroup,
} from './config/appConfig'
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
  type AttachmentNameSuggestion,
  type AuthRole,
  type BackendState,
  type DailyKnowledgeSuggestion,
  type HourEstimateSuggestion,
  type ReportRecord,
  type StoredAuth,
  type TaskAssistantSuggestion,
  type TextLearningContext,
  type TextAssistantSuggestion,
  type TokenScope,
  type OpenRouterFreeModel,
} from './lib/api'
import { formatFileSize, toChineseAmount } from './lib/format'
import { createPsdPreviewFile } from './lib/psdPreview'
import type { AppView, AttachmentAnalysis, FileAsset, InsightHistoryItem, InsightPeriodType, Task, TaskFeedbackRating, TaskFeedbackTag, TaskFilter, TaskStatus, TaskUpdate, TaskViewMode, TaxMode, TimeEntry, WaitingEntry } from './types/domain'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'

// 吉维尼模式：可选的莫奈花园整套色系（默认关，用户在设置里手动开启）。开启后主题随季节走，
// 季节默认「跟随当前日期」，也可手动指定。仅吉维尼模式下季节才影响主题；工具模式主色恒定。
type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
type SeasonPref = 'auto' | SeasonKey
const GIVERNY_MODE_KEY = 'giverny-mode'
const GIVERNY_SEASON_KEY = 'giverny-season'

// 北半球：3-5 春、6-8 夏、9-11 秋、12/1/2 冬。
function seasonOfMonth(month1to12: number): SeasonKey {
  if (month1to12 >= 3 && month1to12 <= 5) return 'spring'
  if (month1to12 >= 6 && month1to12 <= 8) return 'summer'
  if (month1to12 >= 9 && month1to12 <= 11) return 'autumn'
  return 'winter'
}
function currentSeason(): SeasonKey {
  return seasonOfMonth(new Date().getMonth() + 1)
}
function readSeasonPref(): SeasonPref {
  try {
    const raw = window.localStorage.getItem(GIVERNY_SEASON_KEY)
    if (raw === 'spring' || raw === 'summer' || raw === 'autumn' || raw === 'winter') return raw
  } catch {
    // 忽略
  }
  return 'auto'
}
function resolveSeason(pref: SeasonPref = readSeasonPref()): SeasonKey {
  return pref === 'auto' ? currentSeason() : pref
}
// 模块加载即执行，先于首帧渲染，无闪烁。
if (typeof document !== 'undefined') {
  document.documentElement.dataset.season = resolveSeason()
  try {
    if (window.localStorage.getItem(GIVERNY_MODE_KEY) === 'on') {
      document.documentElement.dataset.giverny = 'on'
    }
  } catch {
    // 忽略隐私模式下的 localStorage 异常
  }
}

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

type DailyKnowledgeItem = {
  category: string
  source: string
  title: string
  teaser: string
  body: string[]
}

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

function taskViewModeFromSearch(search = window.location.search): TaskViewMode {
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

function isTaskListBlankContextTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return !target.closest('.task-row, .task-context-menu, button, a, input, textarea, select, [role="button"]')
}

const pad = (value: number) => String(value).padStart(2, '0')

function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isoDateTime(offsetMinutes = 0) {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function planDateTimeFromMinuteStamp(stamp: number) {
  const date = new Date(stamp * 60000)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datePart(value: string) {
  return value.slice(0, 10)
}

function monthPart(value: string) {
  return datePart(value).slice(0, 7)
}

function toDateTimeInputValue(value: string) {
  if (!value) {
    return ''
  }
  return value.includes('T') ? value.slice(0, 16) : `${datePart(value)}T09:00`
}

function formatPlanDateTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value).replaceAll('-', '/')
  return value.includes('T') ? `${date} ${value.slice(11, 16)}` : date
}

function formatMonthDayTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const monthDay = `${date.slice(5, 7)}/${date.slice(8, 10)}`
  return value.includes('T') ? `${monthDay} ${value.slice(11, 16)}` : monthDay
}

function formatMonthDay(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`
}

function formatMonthDayDash(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  return `${date.slice(5, 7)}-${date.slice(8, 10)}`
}

function formatDueDateCompact(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const time = formatTimePart(value)
  return date === isoDate() ? ['今日', time].filter(Boolean).join(' ') : formatMonthDay(value)
}

function formatTimePart(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}:\d{2})/)
  return match?.[1] ?? ''
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : Number.NaN
}

function lateNightScore(clock: string) {
  const minutes = clockMinutes(clock)
  if (!Number.isFinite(minutes)) {
    return Number.NaN
  }
  return minutes < 6 * 60 ? minutes + 24 * 60 : minutes
}

function formatTaskRowDateTime(value: string) {
  if (!value) {
    return '未设置'
  }
  const date = datePart(value)
  const monthDay = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
  const time = formatTimePart(value)
  return time ? `${monthDay} ${time}` : monthDay
}

function parsePlanDateTime(value: string) {
  const normalized = toDateTimeInputValue(value)
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatRemainingTime(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const days = Math.floor(safeMinutes / 1440)
  const hours = Math.floor((safeMinutes % 1440) / 60)
  if (days > 0 && hours > 0) {
    return `${days} 天 ${hours} 小时`
  }
  if (days > 0) {
    return `${days} 天`
  }
  if (hours > 0) {
    return `${hours} 小时`
  }
  return '1 小时内'
}

function formatTaskScheduleSignal(task: Task) {
  if (task.status === '已验收') {
    return { tone: 'done', label: '已验收' }
  }
  if (task.status === '终止' || task.status === '不计费') {
    return { tone: 'normal', label: task.status }
  }

  const now = new Date()
  const start = parsePlanDateTime(task.date)
  const due = parsePlanDateTime(task.estimatedDate || task.date)
  if (!start || !due) {
    return { tone: 'normal', label: '时间待确认' }
  }

  if (now < start) {
    const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000)
    return { tone: 'normal', label: `距开始还剩 ${formatRemainingTime(minutes)}` }
  }

  if (now > due) {
    const days = Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86400000))
    return { tone: 'overdue', label: `已逾期 ${days} 天` }
  }

  const minutesToDue = Math.ceil((due.getTime() - now.getTime()) / 60000)
  const today = isoDate()
  const tomorrow = isoDate(1)
  const dueDate = datePart(task.estimatedDate || task.date)
  const dueTime = formatTimePart(task.estimatedDate || task.date)
  if (dueDate === today) {
    return { tone: 'imminent', label: `今日${dueTime ? ` ${dueTime}` : ''} 到期` }
  }
  if (dueDate === tomorrow) {
    return { tone: 'imminent', label: `明日${dueTime ? ` ${dueTime}` : ''} 到期` }
  }

  return { tone: 'started', label: `距交付还剩 ${formatRemainingTime(minutesToDue)}` }
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

function snapDurationMinutes(value: number, minimum = DURATION_STEP_MINUTES) {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.max(minimum, Math.round(value / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES)
}

function formatHoursInputValue(minutes: number) {
  const snapped = snapDurationMinutes(minutes)
  const hours = snapped / 60
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function formatExactHoursInputValue(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0))
  const hours = safeMinutes / 60
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
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

async function createPdfPreviewFile(file: File) {
  const data = await file.arrayBuffer()
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const targetWidth = 600
  const viewport = page.getViewport({ scale: targetWidth / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 不可用')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport }).promise
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob) {
    throw new Error('PDF 预览生成失败')
  }
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}-preview.png`, { type: 'image/png' })
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
      return await createPdfPreviewFile(file)
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

async function compressProgressImageFile(file: File) {
  const isCompressibleImage = /image\/(jpeg|jpg|png|webp)/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
  if (!isCompressibleImage || file.size < 900 * 1024) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 1800
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1 && file.size < 2 * 1024 * 1024) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), outputType, 0.82))
    if (!blob || blob.size >= file.size) {
      return file
    }
    const base = splitFileName(file.name).base || '过程截图'
    const extension = outputType === 'image/webp' ? '.webp' : '.jpg'
    return new File([blob], `${base}${extension}`, { type: outputType, lastModified: file.lastModified })
  } catch (error) {
    console.warn('progress image compression failed', error)
    return file
  }
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

function appendQueryParam(url: string | undefined, key: string, value: string) {
  if (!url) {
    return undefined
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

const inlineImageFileTypes = new Set(['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'BMP'])
const inlineDocumentFileTypes = new Set(['PDF', 'AI'])
const officeFileTypes = new Set(['DOCX', 'XLSX', 'PPTX', 'DOC', 'XLS', 'PPT'])
const videoFileTypes = new Set(['MP4', 'MOV', 'WEBM', 'M4V', 'OGV'])
const trustedFileExtensions = new Set([
  ...inlineImageFileTypes,
  ...inlineDocumentFileTypes,
  ...officeFileTypes,
  ...videoFileTypes,
  'PSD',
  'TXT',
  'MD',
  'CSV',
  'JSON',
  'ZIP',
  'RAR',
  '7Z',
])

type InferredFileKind = 'image' | 'pdf' | 'ai' | 'psd' | 'office' | 'video' | 'text' | 'archive' | 'unknown'
type FileTypeInput = { name?: string; type?: string; mimeType?: string }

function extensionFromTrustedName(name: string | undefined) {
  const extension = splitFileName(name ?? '').extension.replace('.', '').trim().toUpperCase()
  if (!extension) {
    return ''
  }
  const normalized = extension === 'JPEG' ? 'JPG' : extension
  return trustedFileExtensions.has(normalized) ? normalized : ''
}

function typeFromMime(mimeType: string | undefined) {
  const mime = String(mimeType ?? '').toLowerCase()
  if (!mime) return ''
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPG'
  if (mime === 'image/png') return 'PNG'
  if (mime === 'image/webp') return 'WEBP'
  if (mime === 'image/gif') return 'GIF'
  if (mime === 'image/svg+xml') return 'SVG'
  if (mime === 'image/bmp') return 'BMP'
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('video/')) {
    if (mime.includes('quicktime')) return 'MOV'
    if (mime.includes('webm')) return 'WEBM'
    if (mime.includes('ogg')) return 'OGV'
    return 'MP4'
  }
  if (mime.includes('wordprocessingml.document')) return 'DOCX'
  if (mime.includes('presentationml.presentation')) return 'PPTX'
  if (mime.includes('spreadsheetml.sheet')) return 'XLSX'
  if (mime === 'application/msword') return 'DOC'
  if (mime === 'application/vnd.ms-powerpoint') return 'PPT'
  if (mime === 'application/vnd.ms-excel') return 'XLS'
  if (mime.startsWith('text/')) return mime.includes('csv') ? 'CSV' : 'TXT'
  if (mime.includes('zip')) return 'ZIP'
  return ''
}

function kindForFileType(fileType: string): InferredFileKind {
  const type = fileType.toUpperCase()
  if (isInlineImageFileType(type)) return 'image'
  if (type === 'PDF') return 'pdf'
  if (type === 'AI') return 'ai'
  if (type === 'PSD') return 'psd'
  if (isOfficeFileType(type)) return 'office'
  if (videoFileTypes.has(type)) return 'video'
  if (['TXT', 'MD', 'CSV', 'JSON'].includes(type)) return 'text'
  if (['ZIP', 'RAR', '7Z'].includes(type)) return 'archive'
  return 'unknown'
}

function inferFileType(input: FileTypeInput) {
  const mimeType = input.mimeType || (input.type?.includes('/') ? input.type : '')
  const fromMime = typeFromMime(mimeType)
  const rawType = input.type && !input.type.includes('/') ? input.type.trim().toUpperCase() : ''
  const normalizedRawType = rawType === 'JPEG' ? 'JPG' : rawType
  const fromExistingType = trustedFileExtensions.has(normalizedRawType) ? normalizedRawType : ''
  const fromName = extensionFromTrustedName(input.name)
  const type = fromMime || fromExistingType || fromName || 'FILE'
  return {
    type,
    kind: kindForFileType(type),
    mimeType: mimeType || '',
    extension: fromName,
  }
}

function fileTypeForAsset(file: FileAsset | undefined) {
  return inferFileType({ name: file?.name, type: file?.type, mimeType: file?.mimeType })
}

function fileTypeForFile(file: File) {
  return inferFileType({ name: file.name, mimeType: file.type })
}

function isInlineImageFileType(fileType: string) {
  return inlineImageFileTypes.has(fileType.toUpperCase())
}

function isInlineDocumentFileType(fileType: string) {
  return inlineDocumentFileTypes.has(fileType.toUpperCase())
}

function isOfficeFileType(fileType: string) {
  return officeFileTypes.has(fileType.toUpperCase())
}

function fileDocumentPreviewSource(file: FileAsset | undefined) {
  if (!file) {
    return undefined
  }
  const fileType = fileTypeForAsset(file).type
  return authedPreviewUrl(fileType === 'AI' ? appendQueryParam(file.sourceUrl, 'as', 'pdf') : file.sourceUrl)
}

function fileThumbnailSource(file: FileAsset | undefined) {
  if (!file) {
    return undefined
  }
  const kind = fileTypeForAsset(file).kind
  return ['pdf', 'ai', 'psd', 'office', 'video'].includes(kind) ? fileDocumentPreviewSource(file) : undefined
}

function parseFileTags(tag: string | undefined) {
  return (tag ?? '')
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function serializeFileTags(tags: string[]) {
  return Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean))).join('、')
}

function isAcceptanceFileAsset(file: FileAsset, acceptanceFileNames?: Set<string>) {
  const fileTags = parseFileTags(file.tag)
  return file.scope === 'acceptance'
    || fileTags.includes('验收文件')
    || fileTags.includes('验收附件')
    || Boolean(acceptanceFileNames?.has(file.name.trim()))
}

function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// Cloudflare Workers Free/Pro 计划单次请求体上限 100MB，留出 multipart 开销后取 95MB 作为硬上限。
const UPLOAD_HARD_LIMIT = 95 * 1024 * 1024
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

type TaskUpdateChanges = Partial<Task> & {
  allowAcceptedTimeEdit?: boolean
  allowAcceptanceRollback?: boolean
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

type PendingProgressAttachment = {
  id: string
  file: File
  name: string
  originalName: string
  aiSuggestion?: AttachmentNameSuggestion
  aiLoading?: boolean
  aiError?: string
  // 边添加边上传：文件一加入即后台上传，保存时直接复用，无需再等。
  uploadStatus?: 'uploading' | 'done' | 'error'
  uploadProgress?: number // 0..1
  uploadedFile?: FileAsset
  uploadError?: string
  isAcceptanceFile?: boolean
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

type DonutItem = { label: string; value: number; color: string }

type TaskContextInsight = {
  tone: 'warning' | 'info'
  label: string
  detail: string
  evidence: string
}

type InsightPeriod = InsightPeriodType

const insightPeriods: { value: InsightPeriod; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'half', label: '半年' },
  { value: 'year', label: '年度' },
]

const taskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']
const dashboardTaskFilters: TaskFilter[] = ['全部', '计划中', '进行中', '待验收', '已验收']
const taskFeedbackRatings: TaskFeedbackRating[] = ['顺利', '一般', '有问题']
const taskFeedbackTags: TaskFeedbackTag[] = ['需求不清晰', '沟通成本高', '定价偏低', '技术挑战大']

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const lunarDayLabels = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
const lunarMonthNumbers: Record<string, number> = {
  正月: 1,
  一月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  冬月: 11,
  十一月: 11,
  腊月: 12,
  十二月: 12,
}
const solarFestivalLabels: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-25': '圣诞节',
}
const lunarFestivalLabels: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
  '12-23': '小年',
  '12-24': '小年',
}
const officialHolidayRanges2026 = [
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]
const officialWorkdays2026: Record<string, string> = {
  '2026-01-04': '元旦补班',
  '2026-02-14': '春节补班',
  '2026-02-28': '春节补班',
  '2026-05-09': '劳动节补班',
  '2026-09-20': '国庆补班',
  '2026-10-10': '国庆补班',
}

const chineseCalendarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
})

function isoDateFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDateFromIsoDate(value: string) {
  const [year, month, day] = datePart(value || isoDate()).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function dateRangeValues(start: string, end: string) {
  const values: string[] = []
  const current = localDateFromIsoDate(start)
  const last = localDateFromIsoDate(end)
  while (current.getTime() <= last.getTime()) {
    values.push(isoDateFromLocalDate(current))
    current.setDate(current.getDate() + 1)
  }
  return values
}

const officialHolidayMeta: Record<string, { name: string; kind: 'holiday' | 'workday' }> = {
  ...officialHolidayRanges2026.reduce<Record<string, { name: string; kind: 'holiday' | 'workday' }>>((acc, range) => {
    dateRangeValues(range.start, range.end).forEach((value) => {
      acc[value] = { name: range.name, kind: 'holiday' }
    })
    return acc
  }, {}),
  ...Object.fromEntries(Object.entries(officialWorkdays2026).map(([value, name]) => [value, { name, kind: 'workday' as const }])),
}

function getLunarDateParts(value: string) {
  const parts = chineseCalendarFormatter.formatToParts(localDateFromIsoDate(value))
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const dayValue = Number(parts.find((part) => part.type === 'day')?.value ?? '')
  return {
    month,
    day: Number.isFinite(dayValue) ? dayValue : 0,
  }
}

function isChineseNewYearEve(value: string) {
  const next = getLunarDateParts(addIsoDays(value, 1))
  return next.month.replace('闰', '') === '正月' && next.day === 1
}

function calendarDayMeta(value: string) {
  const lunar = getLunarDateParts(value)
  const official = officialHolidayMeta[value]
  const solarFestival = solarFestivalLabels[value.slice(5, 10)]
  const lunarMonth = lunarMonthNumbers[lunar.month.replace('闰', '')]
  const lunarFestival = lunarMonth ? lunarFestivalLabels[`${lunarMonth}-${lunar.day}`] : undefined
  const festival = solarFestival ?? lunarFestival ?? (isChineseNewYearEve(value) ? '除夕' : undefined)
  const holidayLabel = festival
    ?? (official?.kind === 'holiday' ? (official.name === '国庆节' ? '黄金周' : official.name) : undefined)
  const officialLabel = official?.kind === 'workday' ? '补班' : official?.kind === 'holiday' ? '休' : undefined
  const lunarLabel = lunar.day === 1 ? lunar.month : lunarDayLabels[lunar.day - 1] ?? ''
  return {
    label: lunarLabel,
    holidayLabel,
    officialLabel,
    isFestival: Boolean(holidayLabel),
    officialKind: official?.kind,
  }
}

function calendarDaysForMonth(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      value: isoDateFromLocalDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    }
  })
}

function monthLabelOf(value: string) {
  return `${Number(value.slice(0, 4))} 年 ${Number(value.slice(5, 7))} 月`
}

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

function taskSettlementMonth(task: Task) {
  return task.settlementMonth || ''
}

function isSupplementalTask(task: Task) {
  return Boolean(task.isSupplemental) || (Boolean(task.settlementMonth) && task.settlementMonth !== monthPart(task.date))
}

function isTaskStarted(task: Pick<Task, 'status'>) {
  return task.status !== '计划中'
}

function hasAcceptanceProgress(task: Pick<Task, 'timeEntries'>) {
  return (task.timeEntries ?? []).some((entry) => entry.isAcceptanceProgress)
}

function acceptanceProgressEndDateTime(task: Pick<Task, 'date' | 'timeEntries'>) {
  const acceptanceEntries = (task.timeEntries ?? [])
    .filter((entry) => entry.isAcceptanceProgress)
    .map((entry) => {
      const endDate = entry.endDate || entry.date || datePart(task.date)
      const end = normalizeClockInput(entry.end)
      const stamp = dateTimeMinuteStamp(endDate, end || '')
      return Number.isFinite(stamp) ? { stamp, value: planDateTimeFromMinuteStamp(stamp) } : null
    })
    .filter((item): item is { stamp: number; value: string } => Boolean(item))
    .sort((a, b) => b.stamp - a.stamp)
  return acceptanceEntries[0]?.value ?? ''
}

function normalizeTaskClosure(task: Task): Task {
  if (!hasAcceptanceProgress(task)) {
    return task
  }
  return {
    ...task,
    status: '已验收',
    stage: task.stage && task.stage !== '待验收' && task.stage !== '进行中' ? task.stage : '已验收',
    progress: 100,
    actualDeliveryDate: task.actualDeliveryDate || acceptanceProgressEndDateTime(task),
  }
}

function canRecordNewProgress(task: Pick<Task, 'status' | 'timeEntries'>) {
  return isTaskStarted(task) && task.status !== '已验收' && !hasAcceptanceProgress(task)
}

function taskDisplayProgress(task: Pick<Task, 'status' | 'progress' | 'timeEntries'>) {
  // 已验收即任务闭环，整体进度恒为 100%（兜底历史数据中状态已验收但 progress 未到 100 的情况）
  if (task.status === '已验收' || hasAcceptanceProgress(task)) {
    return 100
  }
  return isTaskStarted(task) ? snapProgress(task.progress) : 0
}

function dateFromValue(value: string | undefined) {
  if (!value) {
    return null
  }
  const date = new Date(toDateTimeInputValue(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function isDateInRange(value: string | undefined, range: { start: Date; end: Date }) {
  const date = dateFromValue(value)
  if (!date) {
    return false
  }
  return date >= range.start && date <= range.end
}

function taskLifecycleDate(task: Task) {
  const entries = task.timeEntries ?? []
  if (entries.length > 0) {
    const withBounds = entries
      .map((entry) => {
        const start = dateTimeMinuteStamp(entry.date || datePart(task.date), entry.start)
        const end = dateTimeMinuteStamp(entry.endDate || entry.date || datePart(task.date), entry.end)
        return Number.isFinite(start) && Number.isFinite(end) ? { entry, start, end } : null
      })
      .filter((item): item is { entry: TimeEntry; start: number; end: number } => Boolean(item))
    const acceptanceBounds = withBounds.filter(({ entry }) => entry.isAcceptanceProgress)
    const targetBounds = acceptanceBounds.length > 0 ? acceptanceBounds : withBounds
    const endStamp = targetBounds.reduce((latest, item) => Math.max(latest, item.end), 0)
    if (endStamp > 0) {
      return planDateTimeFromMinuteStamp(endStamp)
    }
  }
  return task.actualDeliveryDate || task.date || (task.settlementMonth ? `${task.settlementMonth}-01` : '')
}

function isTaskInAnalysisRange(task: Task, range: { start: Date; end: Date }) {
  if (!isTaskStarted(task)) {
    return false
  }
  const lifecycleDate = taskLifecycleDate(task)
  return isDateInRange(lifecycleDate, range) || isDateInRange(task.date, range) || isDateInRange(task.estimatedDate, range)
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
    const samples = (byType.get(type) ?? []).filter((item) => item.id !== task.id && item.actualHours > 0)
    if (samples.length < 2) {
      return
    }
    const estimateSamples = samples.filter((item) => item.estimatedHours > 0)
    const avgActualHours = averageNumber(samples.map((item) => item.actualHours))
    const avgEstimateVariance = estimateSamples.length >= 2
      ? averageNumber(estimateSamples.map((item) => (item.actualHours - item.estimatedHours) / item.estimatedHours))
      : 0
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
        detail: `这个任务类型过去 ${samples.length} 个样本平均实际工时高于预估 ${percent}%，建议今天预留缓冲时间。`,
        evidence: `${type} · ${samples.length} 个历史样本 · 平均实际 ${avgActualHours.toFixed(1)}h`,
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

function insightPeriodRange(period: InsightPeriod, monthValue: string) {
  const today = localDateFromIsoDate(isoDate())
  const [anchorYear, anchorMonth] = monthValue.split('-').map(Number)
  const anchor = new Date(anchorYear, anchorMonth - 1, 1)
  let start: Date
  let end: Date

  if (period === 'day') {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
  } else if (period === 'week') {
    const mondayOffset = (today.getDay() + 6) % 7
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset)
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
  } else if (period === 'month') {
    start = new Date(anchorYear, anchorMonth - 1, 1)
    end = new Date(anchorYear, anchorMonth, 0, 23, 59, 59, 999)
  } else if (period === 'quarter') {
    const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3
    start = new Date(anchorYear, quarterStartMonth, 1)
    end = new Date(anchorYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)
  } else if (period === 'half') {
    const halfStartMonth = anchor.getMonth() < 6 ? 0 : 6
    start = new Date(anchorYear, halfStartMonth, 1)
    end = new Date(anchorYear, halfStartMonth + 6, 0, 23, 59, 59, 999)
  } else {
    start = new Date(anchorYear, 0, 1)
    end = new Date(anchorYear, 11, 31, 23, 59, 59, 999)
  }

  return { start, end }
}

function formatInsightRange(range: { start: Date; end: Date }) {
  const start = isoDateFromLocalDate(range.start).replaceAll('-', '/')
  const end = isoDateFromLocalDate(range.end).replaceAll('-', '/')
  return start === end ? start : `${start} - ${end}`
}

function isVisualReviewReady(file: FileAsset) {
  const type = fileTypeForAsset(file).type
  return Boolean(file.previewUrl) || isInlineImageFileType(type) || isInlineDocumentFileType(type) || isOfficeFileType(type)
}

const validDesignTypeColor = (value: unknown) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : '')

const designTypeColorForIndex = (index: number) => designTypeColorPalette[index % designTypeColorPalette.length] ?? '#e9f5ea'

function nextUnusedDesignTypeColor(groups: DesignTypeGroup[]) {
  const used = new Set(groups.map((group) => validDesignTypeColor(group.color)).filter(Boolean))
  return designTypeColorPalette.find((color) => !used.has(color.toLowerCase())) ?? designTypeColorForIndex(groups.length)
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

function formatSignedHours(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = safeMinutes / 60
  return `+${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`
}

function formatEntryDateTimeRange(task: Task, entry: TimeEntry) {
  const startDate = entry.date || datePart(task.date)
  const endDate = entry.endDate || startDate
  const startLabel = `${formatMonthDay(startDate)} ${entry.start}`
  return startDate === endDate ? `${startLabel}-${entry.end}` : `${startLabel} - ${formatMonthDay(endDate)} ${entry.end}`
}

function minutesBetween(start: string, end: string) {
  if (!start || !end) {
    return 0
  }
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) {
    return 0
  }
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}

function dateTimeMinuteStamp(date: string, time: string) {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const normalizedTime = normalizeClockInput(time)
  if (!dateMatch || !normalizedTime) {
    return Number.NaN
  }
  const [, year, month, day] = dateMatch.map(Number)
  const [hour, minute] = normalizedTime.split(':').map(Number)
  const value = new Date(year, month - 1, day, hour, minute)
  if (
    value.getFullYear() !== year
    || value.getMonth() + 1 !== month
    || value.getDate() !== day
    || value.getHours() !== hour
    || value.getMinutes() !== minute
  ) {
    return Number.NaN
  }
  return Math.round(value.getTime() / 60000)
}

function minutesForTimeEntry(entry: Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end' | 'isUncounted'>) {
  // 不计工时的分段：时间仅用于记录与排序，工时恒为 0
  if (entry.isUncounted) {
    return 0
  }
  const startDate = entry.date
  const endDate = entry.endDate || startDate
  if (!startDate || !endDate) {
    return minutesBetween(entry.start, entry.end)
  }
  const startStamp = dateTimeMinuteStamp(startDate, entry.start)
  const endStamp = dateTimeMinuteStamp(endDate, entry.end)
  if (!Number.isFinite(startStamp) || !Number.isFinite(endStamp)) {
    return 0
  }
  return Math.max(0, endStamp - startStamp)
}

function normalizeClockInput(value: string) {
  const raw = value.trim()
  const colonMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  const compactMatch = raw.match(/^(\d{1,2})(\d{2})$/)
  const hour = colonMatch ? Number(colonMatch[1]) : compactMatch ? Number(compactMatch[1]) : Number.NaN
  const minute = colonMatch ? Number(colonMatch[2] ?? '0') : compactMatch ? Number(compactMatch[2]) : Number.NaN
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return ''
  }
  return `${pad(hour)}:${pad(minute)}`
}

function sumTimeEntries(entries: TimeEntry[]) {
  return entries.reduce((sum, entry) => sum + minutesForTimeEntry(entry), 0)
}

function timeEntryStartStamp(entry: Pick<TimeEntry, 'date' | 'start'>) {
  return dateTimeMinuteStamp(entry.date || '', entry.start)
}

function nextWorkStartForWaiting(task: Task, waitingEntry: WaitingEntry) {
  const waitingStart = timeEntryStartStamp(waitingEntry)
  if (!Number.isFinite(waitingStart)) {
    return Number.NaN
  }
  const nextStart = (task.timeEntries ?? [])
    // “不计工时”只影响结算，不影响任务生命周期；只要后续重新记录了工作进展，等待就应截止。
    // 甲方反馈是外部意见节点，不代表设计工作已经恢复，因此不作为等待结束时间。
    .filter((entry) => !entry.isClientFeedback)
    .map(timeEntryStartStamp)
    .filter((stamp) => Number.isFinite(stamp) && stamp > waitingStart)
    .sort((a, b) => a - b)[0]
  return nextStart ?? Number.NaN
}

function minutesForWaitingEntry(task: Task, entry: WaitingEntry) {
  const waitingStart = timeEntryStartStamp(entry)
  const nextStart = nextWorkStartForWaiting(task, entry)
  if (!Number.isFinite(waitingStart) || !Number.isFinite(nextStart) || nextStart <= waitingStart) {
    return 0
  }
  return nextStart - waitingStart
}

function sumWaitingEntries(task: Task) {
  return (task.waitingEntries ?? []).reduce((sum, entry) => sum + minutesForWaitingEntry(task, entry), 0)
}

function formatWaitingEntryDateTimeRange(task: Task, entry: WaitingEntry) {
  const startDate = entry.date || datePart(task.date)
  const startLabel = `${formatMonthDay(startDate)} ${entry.start}`
  const nextStart = nextWorkStartForWaiting(task, entry)
  if (!Number.isFinite(nextStart)) {
    return `${startLabel} 起 · 等待中`
  }
  const endValue = planDateTimeFromMinuteStamp(nextStart)
  const endDate = datePart(endValue)
  const endTime = endValue.slice(11, 16)
  return startDate === endDate ? `${startLabel}-${endTime}` : `${startLabel} - ${formatMonthDay(endDate)} ${endTime}`
}

// 计费口径的唯一来源：与后端 is_billable 保持一致——状态不影响计费，
// 计费口径唯一来源：以持久的 billable 标记为准（新建任务时选「不计费」即永久不计费，
// 状态/验收/工时都不会改变它）；同时兼容历史的「不计费」状态。
function isTaskBillable(task: Pick<Task, 'status' | 'billable'>) {
  return task.billable !== false && task.status !== '不计费'
}

// 金额一律保留到「分」（两位小数），只用于消除浮点噪声，不做四舍五入到元。
// 真实金额（含小数）原样保留，绝不在中间过程把 ¥127.5 抹成 ¥128。
function roundCents(value: number) {
  return Math.round(value * 100) / 100
}

// 金额展示：真实保留小数，最多两位（¥85 / ¥127.5 / ¥130.05），并带千分位。
function formatYuan(value: number) {
  return roundCents(value).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// 单条计费任务的真实金额（不取整到元，仅规整到分）。
function billableTaskAmount(task: Task, hourlyRate: number) {
  return roundCents(task.actualHours * hourlyRate)
}

// 结算金额：每行取真实金额（精确到分），再求和。保证「明细金额之和 === 总额」，
// 中间过程不做四舍五入到元；如需整元，只在最终展示层处理。
function sumBillableAmount(tasks: Task[], hourlyRate: number, importedHours = 0) {
  const taskAmount = tasks
    .filter((task) => isTaskBillable(task) && task.actualHours > 0)
    .reduce((sum, task) => sum + billableTaskAmount(task, hourlyRate), 0)
  const importedAmount = importedHours > 0 ? roundCents(importedHours * hourlyRate) : 0
  return roundCents(taskAmount + importedAmount)
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

function sortTimeEntriesDesc<T extends Pick<TimeEntry, 'date' | 'endDate' | 'start' | 'end'>>(entries: T[]) {
  // 按开始时间戳倒序（最新在上）。直接取 start 时刻，避免 0 时长记录（end==start）被当成无效排到末尾。
  return [...entries].sort((a, b) => {
    const aStart = dateTimeMinuteStamp(a.date || '', a.start)
    const bStart = dateTimeMinuteStamp(b.date || '', b.start)
    return (Number.isFinite(bStart) ? bStart : 0) - (Number.isFinite(aStart) ? aStart : 0)
  })
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

const cumulativeTaxBrackets = [
  { limit: 36000, rate: 0.03, quick: 0 },
  { limit: 144000, rate: 0.1, quick: 2520 },
  { limit: 300000, rate: 0.2, quick: 16920 },
  { limit: 420000, rate: 0.25, quick: 31920 },
  { limit: 660000, rate: 0.3, quick: 52920 },
  { limit: 960000, rate: 0.35, quick: 85920 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quick: 181920 },
]

const laborTaxBrackets = [
  { limit: 20000, rate: 0.2, quick: 0 },
  { limit: 50000, rate: 0.3, quick: 2000 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.4, quick: 7000 },
]

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

type ProgressRecordMode = 'progress' | 'waiting' | 'feedback'

const clientFeedbackSources = ['甲方', '需求人', '验收人', '其他'] as const

type ProgressModalTarget = {
  taskId: number
  mode: ProgressRecordMode
  editEntryId?: string
  initialAcceptanceMode?: boolean
}

type AnnualIncomeRow = {
  month: string
  hours: number
  amount: number
  locked: boolean
}

function resolveCumulativeTaxBracket(taxableIncome: number) {
  return cumulativeTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? cumulativeTaxBrackets[0]
}

function resolveLaborTaxBracket(taxableIncome: number) {
  return laborTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? laborTaxBrackets[0]
}

function calculateCumulativeWithholding(
  rows: AnnualIncomeRow[],
  monthlySpecialDeduction: number,
  monthlyAdditionalDeduction: number,
  monthlyOtherDeduction: number,
) {
  let cumulativeIncome = 0
  let cumulativePaidTax = 0
  const monthlyDeduction = 5000 + monthlySpecialDeduction + monthlyAdditionalDeduction + monthlyOtherDeduction

  return rows.map((row, index) => {
    cumulativeIncome += row.amount
    const cumulativeDeduction = monthlyDeduction * (index + 1)
    const taxableIncome = Math.max(0, cumulativeIncome - cumulativeDeduction)
    const bracket = resolveCumulativeTaxBracket(taxableIncome)
    const cumulativeTax = Math.max(0, taxableIncome * bracket.rate - bracket.quick)
    const tax = Math.max(0, Math.round(cumulativeTax - cumulativePaidTax))
    cumulativePaidTax += tax

    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax: Math.round(cumulativePaidTax),
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
}

function calculateLaborWithholding(rows: AnnualIncomeRow[]) {
  let cumulativeIncome = 0
  let cumulativeTax = 0
  return rows.map((row) => {
    cumulativeIncome += row.amount
    const taxableIncome = row.amount <= 800 ? 0 : row.amount <= 4000 ? Math.max(0, row.amount - 800) : row.amount * 0.8
    const bracket = resolveLaborTaxBracket(taxableIncome)
    const tax = Math.max(0, Math.round(taxableIncome * bracket.rate - bracket.quick))
    cumulativeTax += tax
    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax,
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
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

function designTypeGroupForTaskType(type: string, groups: DesignTypeGroup[]) {
  const normalizedType = type.trim()
  if (!normalizedType) {
    return null
  }
  const explicitGroupName = normalizedType.includes(' / ') ? normalizedType.split(' / ')[0].trim() : ''
  if (explicitGroupName) {
    const matched = groups.find((group) => group.name === explicitGroupName)
    if (matched) {
      return matched
    }
  }
  return groups.find((group) => group.items.includes(normalizedType)) ?? null
}

function designTypeColorForTask(type: string, groups: DesignTypeGroup[]) {
  const group = designTypeGroupForTaskType(type, groups)
  return validDesignTypeColor(group?.color) || designTypeColorForIndex(0)
}

function MonthPicker({
  value,
  taskMonthValues,
  onChange,
  minimal = false,
  iconOnly = false,
}: {
  value: string
  taskMonthValues: Set<string>
  onChange: (value: string) => void
  minimal?: boolean
  iconOnly?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedYear = Number(value.slice(0, 4)) || new Date().getFullYear()
  const selectedMonth = Number(value.slice(5, 7))
  const [displayYear, setDisplayYear] = useState(selectedYear)

  const chooseMonth = (month: number) => {
    onChange(`${displayYear}-${pad(month)}`)
    setIsOpen(false)
  }

  return (
    <div
      className="month-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={iconOnly
          ? `topbar-shortcut month-trigger ${isOpen ? 'active' : ''}`.trim()
          : `select-button month-trigger ${minimal ? 'minimal' : ''} ${isOpen ? 'active' : ''}`.trim()
        }
        aria-label="选择年份和月份"
        aria-expanded={isOpen}
        title={iconOnly ? monthLabelOf(value) : undefined}
        onClick={() => {
          if (!isOpen) {
            setDisplayYear(selectedYear)
          }
          setIsOpen((open) => !open)
        }}
      >
        {iconOnly
          ? <CalendarDays size={16} />
          : (
            <>
              {!minimal && <CalendarDays size={17} />}
              <span>{monthLabelOf(value)}</span>
              <ChevronDown size={16} />
            </>
          )
        }
      </button>

      {isOpen && (
        <div className="month-popover" role="dialog" aria-label="选择年份和月份">
          <MonthYearPickerPanel
            year={displayYear}
            month={displayYear === selectedYear ? selectedMonth : undefined}
            yearOptions={Array.from({ length: 11 }, (_, index) => displayYear - 5 + index)}
            taskMonthValues={taskMonthValues}
            onYearChange={setDisplayYear}
            onMonthChange={chooseMonth}
          />
        </div>
      )}
    </div>
  )
}

function MonthYearPickerPanel({
  year,
  month,
  yearOptions,
  onYearChange,
  onMonthChange,
  taskMonthValues,
}: {
  year: number
  month?: number
  yearOptions: number[]
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  taskMonthValues?: Set<string>
}) {
  const yearListRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      yearListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [year])

  return (
    <div className="date-time-month-panel month-year-picker-panel">
      <div className="date-time-year-list" ref={yearListRef} aria-label="选择年份">
        {yearOptions.map((option) => (
          <button
            type="button"
            className={option === year ? 'active' : ''}
            aria-pressed={option === year}
            key={option}
            onClick={() => onYearChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="date-time-month-grid" aria-label="选择月份">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => {
          const isSelected = option === month
          const hasTasks = taskMonthValues?.has(`${year}-${pad(option)}`) ?? false
          return (
            <button
              type="button"
              className={`${isSelected ? 'active' : ''} ${hasTasks ? 'has-tasks' : ''}`.trim()}
              key={option}
              aria-pressed={isSelected}
              aria-label={`${year} 年 ${option} 月${hasTasks ? '，有任务' : ''}`}
              onClick={() => onMonthChange(option)}
            >
              {option}月
              {hasTasks && <i aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PlanDateTimeField({
  label,
  value,
  onChange,
  isActive = false,
  readOnly = false,
  saved = false,
  control,
  includeTime = true,
  pickerId,
  activePickerId,
  onActivePickerChange,
  afterInput,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isActive?: boolean
  readOnly?: boolean
  saved?: boolean
  control?: ReactNode
  /** Date-only fields reuse this picker without the hour/minute columns. */
  includeTime?: boolean
  pickerId?: string
  activePickerId?: string | null
  onActivePickerChange?: (pickerId: string | null) => void
  afterInput?: ReactNode
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const inputWrapRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const formatValue = (rawValue: string) => includeTime ? formatPlanDateTime(rawValue) : rawValue.replace(/-/g, '/')
  const [draft, setDraft] = useState(() => formatValue(value))
  const [syncedValue, setSyncedValue] = useState(value)
  const [localPickerOpen, setLocalPickerOpen] = useState(false)
  const [popoverLeft, setPopoverLeft] = useState<number | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => monthPart(value || isoDate()))
  const [pickerView, setPickerView] = useState<'calendar' | 'month'>('calendar')
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const minuteListRef = useRef<HTMLDivElement | null>(null)
  const controlledPicker = Boolean(pickerId && onActivePickerChange)
  const isPickerOpen = controlledPicker ? activePickerId === pickerId : localPickerOpen

  const setPickerOpen = useCallback((nextOpen: boolean) => {
    if (controlledPicker) {
      onActivePickerChange?.(nextOpen ? pickerId ?? null : null)
      return
    }
    setLocalPickerOpen(nextOpen)
  }, [controlledPicker, onActivePickerChange, pickerId])

  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(formatValue(value))
  }

  const normalizeDateTimeInput = (input: string) => {
    const match = input.trim().match(includeTime
      ? /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/
      : /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    if (!match) {
      return ''
    }
    const [, year, month, day, hour = '9', minute = '0'] = match
    const monthNumber = Number(month)
    const dayNumber = Number(day)
    const hourNumber = Number(hour)
    const minuteNumber = Number(minute)
    if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31 || hourNumber < 0 || hourNumber > 23 || minuteNumber < 0 || minuteNumber > 59) {
      return ''
    }
    const normalizedDate = `${year}-${pad(monthNumber)}-${pad(dayNumber)}`
    const normalized = includeTime ? `${normalizedDate}T${pad(hourNumber)}:${pad(minuteNumber)}` : normalizedDate
    const date = new Date(includeTime ? normalized : `${normalized}T00:00`)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== monthNumber || date.getDate() !== dayNumber) {
      return ''
    }
    return normalized
  }

  const commitDraft = () => {
    if (readOnly) {
      setDraft(formatValue(value))
      return
    }
    const normalized = normalizeDateTimeInput(draft)
    if (normalized) {
      onChange(normalized)
      setDraft(formatValue(normalized))
      return
    }
    setDraft(formatValue(value))
  }

  const selectedValue = toDateTimeInputValue(includeTime ? (value || isoDateTime()) : `${value || isoDate()}T00:00`)
  const selectedDate = datePart(selectedValue)
  const selectedHour = selectedValue.slice(11, 13)
  const selectedMinute = selectedValue.slice(14, 16)
  const calendarDays = calendarDaysForMonth(calendarMonth)
  const calendarYear = Number(calendarMonth.slice(0, 4))
  const selectedMonth = Number(calendarMonth.slice(5, 7))
  const yearOptions = Array.from({ length: 11 }, (_, index) => calendarYear - 5 + index)

  const updatePopoverPosition = useCallback(() => {
    const wrap = inputWrapRef.current
    if (!wrap) {
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const popoverWidth = popoverRef.current?.offsetWidth ?? Math.min(396, window.innerWidth - 48)
    const viewportGutter = 24
    const defaultLeft = wrapRect.width - popoverWidth
    const minLeft = viewportGutter - wrapRect.left
    const maxLeft = window.innerWidth - viewportGutter - wrapRect.left - popoverWidth
    const boundedMaxLeft = Math.max(minLeft, maxLeft)
    const nextLeft = Math.min(Math.max(defaultLeft, minLeft), boundedMaxLeft)
    setPopoverLeft(nextLeft)
  }, [])

  useEffect(() => {
    if (!isPickerOpen) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    const frame = window.requestAnimationFrame(() => {
      updatePopoverPosition()
      if (pickerView === 'calendar') {
        hourListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
        minuteListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
      }
    })
    window.addEventListener('resize', updatePopoverPosition)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('resize', updatePopoverPosition)
      window.cancelAnimationFrame(frame)
    }
  }, [isPickerOpen, pickerView, selectedHour, selectedMinute, calendarYear, setPickerOpen, updatePopoverPosition])

  const shiftMonth = (offset: number) => {
    const current = localDateFromIsoDate(`${calendarMonth}-01`)
    current.setMonth(current.getMonth() + offset)
    setCalendarMonth(`${current.getFullYear()}-${pad(current.getMonth() + 1)}`)
  }

  const applyDatePart = (dateValue: string) => {
    if (readOnly) {
      return
    }
    const next = includeTime ? `${dateValue}T${selectedHour}:${selectedMinute}` : dateValue
    onChange(next)
    setDraft(formatValue(next))
    setCalendarMonth(monthPart(next))
  }

  const applyTimePart = (part: 'hour' | 'minute', rawValue: string) => {
    if (readOnly) {
      return
    }
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      return
    }
    const max = part === 'hour' ? 23 : 59
    const nextValue = pad(Math.max(0, Math.min(max, Number(digits))))
    const next = part === 'hour' ? `${selectedDate}T${nextValue}:${selectedMinute}` : `${selectedDate}T${selectedHour}:${nextValue}`
    onChange(next)
    setDraft(formatPlanDateTime(next))
  }

  const applyToday = () => {
    if (readOnly) {
      return
    }
    const now = includeTime ? isoDateTime() : isoDate()
    onChange(now)
    setDraft(formatValue(now))
    setCalendarMonth(monthPart(now))
  }

  const applyClear = () => {
    if (readOnly) {
      return
    }
    onChange('')
    setDraft('')
    setPickerOpen(false)
  }

  const chooseMonth = (year: number, month: number) => {
    setCalendarMonth(`${year}-${pad(month)}`)
    setPickerView('calendar')
  }

  return (
    <div ref={fieldRef} className={`field date-field ${isActive ? 'active' : ''} ${readOnly ? 'readonly' : ''} ${saved ? 'field-saved' : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        {control}
      </span>
      <div ref={inputWrapRef} className={`date-input-wrap${afterInput ? ' date-input-wrap-with-ref' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder={includeTime ? 'YYYY/MM/DD HH:mm' : 'YYYY/MM/DD'}
          readOnly={readOnly}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        {afterInput}
        <button
          type="button"
          aria-label={`选择${label}`}
          title={readOnly ? '打开右侧开关后可编辑' : `选择${label}`}
          disabled={readOnly}
          onClick={() => {
            if (!readOnly) {
              if (!isPickerOpen) {
                setCalendarMonth(monthPart(value || isoDate()))
                setPickerView('calendar')
              }
              setPickerOpen(!isPickerOpen)
            }
          }}
        >
          <CalendarDays size={16} />
        </button>
        {isPickerOpen && (
          <div
            ref={popoverRef}
            className="date-time-popover"
            style={popoverLeft === null ? undefined : { left: `${popoverLeft}px`, right: 'auto' }}
            role="dialog"
            aria-label={`${label}选择器`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPickerOpen(false)
              }
            }}
          >
            {pickerView === 'month' ? (
              <>
                <div className="date-time-popover-header">
                  <button
                    type="button"
                    className="date-time-month-trigger"
                    aria-label="选择年份和月份"
                    aria-expanded="true"
                    onClick={() => setPickerView('calendar')}
                  >
                    <strong>{monthLabelOf(calendarMonth)}</strong>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <MonthYearPickerPanel
                  year={calendarYear}
                  month={selectedMonth}
                  yearOptions={yearOptions}
                  onYearChange={(year) => setCalendarMonth(`${year}-${pad(selectedMonth)}`)}
                  onMonthChange={(month) => chooseMonth(calendarYear, month)}
                />
              </>
            ) : (
              <div className={`date-time-picker-main ${includeTime ? '' : 'date-only'}`}>
                <div className="date-time-calendar-pane">
                  <div className="date-time-popover-header">
                    <button
                      type="button"
                      className="date-time-month-trigger"
                      aria-label="选择年份和月份"
                      aria-expanded="false"
                      onClick={() => setPickerView('month')}
                    >
                      <strong>{monthLabelOf(calendarMonth)}</strong>
                      <ChevronDown size={14} />
                    </button>
                    <div className="date-time-calendar-navigation" aria-label="切换月份">
                      <button type="button" aria-label="上个月" title="上个月" onClick={() => shiftMonth(-1)}>
                        <ChevronUp size={16} />
                      </button>
                      <button type="button" aria-label="下个月" title="下个月" onClick={() => shiftMonth(1)}>
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="date-time-weekdays">
                    {weekdayLabels.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="date-time-days">
                    {calendarDays.map((day) => (
                      <button
                        type="button"
                        key={day.value}
                        className={`${day.inMonth ? '' : 'muted'} ${day.value === selectedDate ? 'active' : ''}`}
                        onClick={() => applyDatePart(day.value)}
                      >
                        {day.day}
                      </button>
                    ))}
                  </div>
                </div>
                {includeTime && (
                  <>
                    <div className="date-time-scroll-column" ref={hourListRef} aria-label="选择小时">
                      {Array.from({ length: 24 }, (_, hour) => pad(hour)).map((hour) => (
                        <button
                          type="button"
                          className={hour === selectedHour ? 'active' : ''}
                          aria-pressed={hour === selectedHour}
                          key={hour}
                          onClick={() => applyTimePart('hour', hour)}
                        >
                          {hour}
                        </button>
                      ))}
                    </div>
                    <div className="date-time-scroll-column" ref={minuteListRef} aria-label="选择分钟">
                      {Array.from({ length: 60 / TIME_STEP_MINUTES }, (_, index) => pad(index * TIME_STEP_MINUTES)).map((minute) => (
                        <button
                          type="button"
                          className={minute === selectedMinute ? 'active' : ''}
                          aria-pressed={minute === selectedMinute}
                          key={minute}
                          onClick={() => applyTimePart('minute', minute)}
                        >
                          {minute}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="date-time-popover-actions">
              <button type="button" onClick={applyClear}>清除</button>
              <button type="button" onClick={applyToday}>今天</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ScheduleAnchorSwitch({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`switch-control schedule-anchor-switch ${active ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <i />
    </button>
  )
}

function NewTaskDesignTypeSelector({
  groups,
  value,
  onChange,
}: {
  groups: DesignTypeGroup[]
  value: string
  onChange: (value: string) => void
}) {
  const availableGroups = normalizeDesignTypeGroups(groups).filter((g) => g.items.length > 0)
  const selectedGroup = availableGroups.find((group) => group.items.some((item) => `${group.name} / ${item}` === value))

  return (
    <div className="new-task-type-selector">
      <div className="new-task-type-chips" role="listbox" aria-label="设计类型">
        {availableGroups.map((group) => (
          <div
            className={`new-task-type-category ${group.name === selectedGroup?.name ? 'active' : ''}`}
            key={group.name}
            tabIndex={0}
          >
            <span>{group.name}</span>
            <div className="new-task-type-menu" role="group" aria-label={`${group.name} 子分类`}>
              {group.items.map((item) => {
                const optionValue = `${group.name} / ${item}`
                return (
                  <button
                    type="button"
                    className={optionValue === value ? 'active' : ''}
                    key={item}
                    aria-selected={optionValue === value}
                    onClick={() => onChange(optionValue)}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="new-task-type-picked">已选 <b>{value || '未选择'}</b></div>
    </div>
  )
}

type DueState = 'overdue' | 'soon' | null

/** 未完成任务的交付提醒状态：已过预计交付日 → 逾期；3 天内到期 → 临期 */
function taskDueState(task: Task, today: string, soonDate: string): DueState {
  if (!task.estimatedDate || task.status === '已验收' || task.status === '终止' || task.status === '不计费') {
    return null
  }
  const estimatedDate = datePart(task.estimatedDate)
  if (estimatedDate < today) {
    return 'overdue'
  }
  if (estimatedDate <= soonDate) {
    return 'soon'
  }
  return null
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
const STATE_CACHE_KEY = 'designer-worklog-state-cache-v1'

const readStateCache = (): BackendState | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STATE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as BackendState) : null
  } catch {
    return null
  }
}

const writeStateCache = (state: BackendState) => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state))
  } catch {
    // 配额超限等忽略：快照仅用于加速首屏，缺失只是退回到原来的加载态
  }
}

function AttachmentHoverThumbnail({
  name,
  type,
  previewUrl,
  sourceUrl,
  compact = false,
  onOpen,
}: {
  name: string
  type?: string
  previewUrl?: string
  sourceUrl?: string
  compact?: boolean
  onOpen?: () => void
}) {
  const [hoverPreview, setHoverPreview] = useState<{ style: CSSProperties; fieldPlacement: boolean } | null>(null)
  const inferred = inferFileType({ name, type })
  const extension = inferred.type
  const pdfSourceUrl = !previewUrl && (inferred.kind === 'pdf' || inferred.kind === 'ai') ? sourceUrl : ''
  const psdSourceUrl = !previewUrl && inferred.kind === 'psd' ? sourceUrl : ''
  const officeSourceUrl = !previewUrl && inferred.kind === 'office' ? sourceUrl : ''
  const videoSourceUrl = !previewUrl && inferred.kind === 'video' ? sourceUrl : ''
  const media = previewUrl
    ? <img src={previewUrl} alt="" loading="lazy" />
    : pdfSourceUrl
      ? <PdfThumbnail sourceUrl={pdfSourceUrl} label={name} />
      : psdSourceUrl
        ? <PsdThumbnail sourceUrl={psdSourceUrl} label={name} />
        : officeSourceUrl
          ? <OfficePreview fileType={extension} sourceUrl={officeSourceUrl} compact />
          : videoSourceUrl
            ? <video src={videoSourceUrl} muted playsInline preload="metadata" />
            : <span className="attachment-hover-thumb-ext">{extension}</span>
  const hoverMedia = previewUrl
    ? <img src={previewUrl} alt="" />
    : pdfSourceUrl
      ? <PdfThumbnail sourceUrl={pdfSourceUrl} label={name} />
      : psdSourceUrl
        ? <PsdThumbnail sourceUrl={psdSourceUrl} label={name} />
        : officeSourceUrl
          ? <OfficePreview fileType={extension} sourceUrl={officeSourceUrl} compact />
          : videoSourceUrl
            ? <video src={videoSourceUrl} muted playsInline preload="metadata" />
            : <strong>{extension}</strong>
  const showPreview = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const attachmentField = element.closest('.progress-attachment-field')?.getBoundingClientRect()
    if (attachmentField && attachmentField.width >= 560) {
      const width = Math.min(360, Math.max(280, attachmentField.width - 150))
      const height = Math.min(340, Math.max(260, attachmentField.bottom - rect.top - 10))
      setHoverPreview({
        fieldPlacement: true,
        style: {
          left: Math.min(rect.right + 24, attachmentField.right - width),
          top: Math.max(8, Math.min(rect.top - 12, window.innerHeight - height - 8)),
          width,
          height,
        },
      })
      return
    }
    const width = 220
    const height = 246
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    const top = rect.top - height - 10 >= 8 ? rect.top - height - 10 : rect.bottom + 10
    setHoverPreview({ fieldPlacement: false, style: { left, top, width, height } })
  }

  return (
    <span
      className={`attachment-hover-thumb-wrap ${compact ? 'compact' : ''}`}
      onMouseEnter={(event) => showPreview(event.currentTarget)}
      onMouseLeave={() => setHoverPreview(null)}
    >
      <button
        type="button"
        className="attachment-hover-thumb"
        title={onOpen ? `预览 ${name}` : name}
        aria-label={onOpen ? `预览 ${name}` : name}
        onClick={onOpen}
      >
        {media}
      </button>
      {hoverPreview && createPortal(
        <span className={`attachment-hover-preview ${hoverPreview.fieldPlacement ? 'field-placement' : ''}`} style={hoverPreview.style} aria-hidden="true">
          <span className="attachment-hover-preview-media">
            {hoverMedia}
          </span>
          <span className="attachment-hover-preview-name">{name}</span>
        </span>,
        document.body,
      )}
    </span>
  )
}

function PendingAttachmentThumbnail({
  attachment,
  onOpen,
}: {
  attachment: PendingProgressAttachment
  onOpen: () => void
}) {
  const inferred = fileTypeForFile(attachment.file)
  const isImage = inferred.kind === 'image'
  const canUseSourceFallback = ['image', 'pdf', 'ai', 'psd', 'office', 'video'].includes(inferred.kind)
  const sourcePreviewUrl = useMemo(() => canUseSourceFallback ? URL.createObjectURL(attachment.file) : undefined, [attachment.file, canUseSourceFallback])
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState('')

  useEffect(() => {
    if (isImage) {
      return
    }
    let objectUrl = ''
    let cancelled = false
    const generatePreview = async () => {
      const preview = await createOptionalPreviewFile(attachment.file)
      if (!preview || cancelled) {
        return
      }
      objectUrl = URL.createObjectURL(preview)
      setGeneratedPreviewUrl(objectUrl)
    }
    void generatePreview()
    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [attachment.file, isImage])

  useEffect(() => () => {
    if (sourcePreviewUrl) {
      URL.revokeObjectURL(sourcePreviewUrl)
    }
  }, [sourcePreviewUrl])

  return (
    <AttachmentHoverThumbnail
      name={attachment.name}
      type={inferred.type}
      previewUrl={isImage ? sourcePreviewUrl : generatedPreviewUrl}
      sourceUrl={sourcePreviewUrl}
      onOpen={onOpen}
    />
  )
}

function PendingAttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: PendingProgressAttachment
  onClose: () => void
}) {
  const sourceUrl = useMemo(() => URL.createObjectURL(attachment.file), [attachment.file])
  const fileType = fileTypeForFile(attachment.file).type
  const isImage = isInlineImageFileType(fileType)
  const isPdf = fileType === 'PDF'
  const isVideo = videoFileTypes.has(fileType)
  const isOffice = isOfficeFileType(fileType)

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl])

  return createPortal(
    <ModalShell
      className="file-preview-modal pending-attachment-preview-modal"
      labelledBy="pending-attachment-preview-title"
      onClose={onClose}
      closeOnEscape
    >
      <header className="modal-header">
        <div>
          <p className="eyebrow">进展附件预览</p>
          <h2 id="pending-attachment-preview-title">{attachment.name}</h2>
        </div>
        <div className="modal-header-actions">
          {(isPdf || isImage || isVideo) && (
            <a
              className="icon-button"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="在新窗口打开"
              title="在新窗口打开"
            >
              <ExternalLink size={17} />
            </a>
          )}
          <button className="icon-button modal-close-button" type="button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="file-preview-body">
        {isImage ? (
          <img src={sourceUrl} alt={attachment.name} />
        ) : isPdf ? (
          <iframe className="file-preview-frame" src={sourceUrl} title={attachment.name} />
        ) : isVideo ? (
          <video className="file-preview-video" src={sourceUrl} controls preload="metadata" />
        ) : isOffice ? (
          <OfficePreview fileType={fileType} sourceUrl={sourceUrl} />
        ) : (
          <div className="file-preview-placeholder">
            <FileArchive size={42} />
            <strong>{fileType}</strong>
            <span>该格式暂不支持站内完整预览，保存进展后仍可从文件记录打开源文件。</span>
          </div>
        )}
      </div>
    </ModalShell>,
    document.body,
  )
}

function snapProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 20) * 20))
}

type ConfirmDialogState = {
  eyebrow?: string
  title: string
  body: string
  confirmText: string
  cancelText?: string
  tone?: 'danger' | 'default'
  details?: string[]
  hideIcon?: boolean
  onConfirm: () => void | Promise<void>
}

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  id: number
  message: string
  tone: ToastTone
  actionLabel?: string
  onAction?: () => void | Promise<void>
  durationMs?: number
}

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

type CommandPaletteAction = {
  id: string
  group: string
  label: string
  detail?: string
  shortcut?: string
  keywords?: string
  disabled?: boolean
  run: () => void
}

type ShortcutHelpGroup = {
  label: string
  items: Array<{ keys: string; action: string }>
}

function isEditableShortcutTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function isQuestionShortcut(event: KeyboardEvent) {
  return event.key === '?' || (event.key === '/' && event.shiftKey)
}

function CommandPalette({
  actions,
  initialQuery,
  onClose,
}: {
  actions: CommandPaletteAction[]
  initialQuery: string
  onClose: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredActions = useMemo(
    () =>
      actions.filter((action) => {
        if (!normalizedQuery) {
          return true
        }
        return [action.label, action.detail, action.group, action.keywords]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      }),
    [actions, normalizedQuery],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runAction = (action: CommandPaletteAction | undefined) => {
    if (!action || action.disabled) {
      return
    }
    onClose()
    action.run()
  }

  const groupedActions = filteredActions.reduce<Array<{ label: string; actions: CommandPaletteAction[] }>>((groups, action) => {
    const existing = groups.find((group) => group.label === action.group)
    if (existing) {
      existing.actions.push(action)
    } else {
      groups.push({ label: action.group, actions: [action] })
    }
    return groups
  }, [])

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((current) => Math.min(current + 1, Math.max(filteredActions.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            runAction(filteredActions[activeIndex])
          }
        }}
      >
        <label className="command-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder="搜索任务、页面或操作…"
          />
          <kbd>Esc</kbd>
        </label>
        <div className="command-results" role="listbox" aria-label="可用命令">
          {groupedActions.map((group) => (
            <div className="command-group" key={group.label}>
              <p>{group.label}</p>
              {group.actions.map((action) => {
                const flatIndex = filteredActions.indexOf(action)
                return (
                  <button
                    type="button"
                    className={`command-item ${flatIndex === activeIndex ? 'active' : ''}`}
                    key={action.id}
                    disabled={action.disabled}
                    onMouseMove={() => setActiveIndex(flatIndex)}
                    onClick={() => runAction(action)}
                  >
                    <span>
                      <strong>{action.label}</strong>
                      {action.detail && <small>{action.detail}</small>}
                    </span>
                    {action.shortcut && <kbd>{action.shortcut}</kbd>}
                  </button>
                )
              })}
            </div>
          ))}
          {filteredActions.length === 0 && (
            <div className="command-empty">
              <Search size={18} />
              <span>没有匹配的任务或操作</span>
            </div>
          )}
        </div>
        <footer className="command-footer">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>?</kbd> 快捷键</span>
        </footer>
      </section>
    </div>
  )
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return createPortal(
    <div className="img-lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="图片预览">
      <button type="button" className="img-lightbox-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
      <img className="img-lightbox-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  )
}

function ShortcutHelpModal({ groups, onClose }: { groups: ShortcutHelpGroup[]; onClose: () => void }) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || isQuestionShortcut(event)) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="shortcut-help" role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title">
        <header>
          <div>
            <p className="eyebrow">Giverny 快捷操作</p>
            <h2 id="shortcut-help-title">键盘快捷键</h2>
          </div>
          <button type="button" className="shortcut-close" aria-label="关闭快捷键列表" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="shortcut-groups">
          {groups.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <div className="shortcut-row" key={`${group.label}-${item.keys}`}>
                  <span>{item.action}</span>
                  <kbd>{item.keys}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
        <footer>在输入框和编辑区域内，单键快捷键会自动停用。</footer>
      </section>
    </div>
  )
}

function SemanticSearchModal({
  isAdmin,
  files,
  tasks,
  onClose,
  onOpenTask,
  onJumpToFile,
}: {
  isAdmin: boolean
  files: FileAsset[]
  tasks: Task[]
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onJumpToFile: (file: FileAsset) => void
}) {
  // 文件库只收录「已验收」任务的验收文件，故搜索里的「文件库」缩略图也只展示这些，确保点击能跳到库里对应位置。
  const acceptedTaskIds = new Set(tasks.filter((task) => task.status === '已验收').map((task) => task.id))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ taskId: number; score: number; title: string; month: string; type: string }>>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [note, setNote] = useState('')
  const [reindexing, setReindexing] = useState(false)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  const runSearch = async () => {
    const q = query.trim()
    if (!q || loading) {
      return
    }
    setLoading(true)
    setNote('')
    setSearched(true)
    try {
      const res = await api.searchTasks(q)
      setResults(res.results)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '搜索失败')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const runReindex = async () => {
    if (reindexing) {
      return
    }
    setReindexing(true)
    setNote('正在重建索引…')
    try {
      const res = await api.reindexSearch()
      setNote(`已重建索引：${res.indexed} / ${res.total} 条任务（约 1 分钟后生效）`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '重建索引失败')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="semantic-search" role="dialog" aria-modal="true" aria-labelledby="semantic-search-title">
        <header>
          <div>
            <p className="eyebrow">语义搜索</p>
            <h2 id="semantic-search-title">按意思找回历史任务</h2>
          </div>
          <button type="button" className="shortcut-close" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="semantic-search-input">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            placeholder="例如：之前那张邀请函长图 / 官网 banner / 文化墙矢量图"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch()
              }
            }}
          />
          <button className="soft-primary-button" type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>
            {loading ? '搜索中…' : '搜索'}
          </button>
        </div>
        {note && <p className="semantic-search-note">{note}</p>}
        <div className="semantic-search-results">
          {searched && !loading && results.length === 0 && !note && (
            <p className="calendar-empty-hint">没有找到相关任务。如果是刚新建的任务，可点下方「重建索引」后再搜。</p>
          )}
          {results.map((item) => {
            const libraryFiles = files.filter(
              (file) => file.taskId === item.taskId && !file.deletedAt && file.scope === 'acceptance' && acceptedTaskIds.has(item.taskId),
            )
            return (
              <div className="semantic-search-result" key={item.taskId}>
                <button type="button" className="semantic-search-result-main" onClick={() => onOpenTask(item.taskId)}>
                  <div>
                    <strong>{item.title || '未命名任务'}</strong>
                    <span>{item.type || '未分类'}{item.month ? ` · ${item.month}` : ''}</span>
                  </div>
                  <em>{Math.round(item.score * 100)}%</em>
                </button>
                {libraryFiles.length > 0 && (
                  <div className="semantic-search-result-files">
                    <span className="semantic-search-files-label">文件库</span>
                    <div className="semantic-search-files-row">
                      {libraryFiles.map((file) => {
                        const fileType = fileTypeForAsset(file).type
                        const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                        const documentSourceUrl = fileThumbnailSource(file)
                        return (
                          <AttachmentHoverThumbnail
                            key={file.id}
                            name={file.name}
                            type={fileType}
                            previewUrl={previewUrl}
                            sourceUrl={documentSourceUrl}
                            compact
                            onOpen={() => onJumpToFile(file)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <footer className="semantic-search-footer">
          <span>按语义匹配，非关键词；中英文均可。</span>
          {isAdmin && (
            <button type="button" className="ghost-button compact-button" onClick={() => void runReindex()} disabled={reindexing}>
              <RotateCcw size={14} />
              {reindexing ? '重建中…' : '重建索引'}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}

// ─── 知识库全页 ────────────────────────────────────────────────────────────────

type KnowledgeNote = { id: string; title: string; content: string; tags: string; created_at: string; source?: string }

function KnowledgeView() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'user' | 'ai-tip'>('user')

  const authHeaders = useCallback((): Record<string, string> => {
    return { 'content-type': 'application/json' }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge', { headers: authHeaders() })
      if (res.ok) setNotes((await res.json()) as KnowledgeNote[])
    } finally { setLoading(false) }
  }, [authHeaders])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/knowledge', { headers: authHeaders() })
        if (res.ok) {
          const items = (await res.json()) as KnowledgeNote[]
          if (!cancelled) setNotes(items)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authHeaders])

  const reset = () => { setTitle(''); setContent(''); setTags(''); setEditId(null) }

  const save = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const body: Record<string, string> = { title: title.trim(), content: content.trim(), tags: tags.trim() }
      if (editId) body.id = editId
      const res = await fetch('/api/knowledge', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      if (res.ok) { reset(); await load() }
    } finally { setSaving(false) }
  }

  const startEdit = (n: KnowledgeNote) => {
    setEditId(n.id); setTitle(n.title); setContent(n.content); setTags(n.tags)
    setActiveTab('user')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (id: string) => {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE', headers: authHeaders() })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (editId === id) reset()
  }

  const userNotes = notes.filter((n) => !n.source || n.source === 'user')
  const aiTipNotes = notes.filter((n) => n.source === 'ai-tip')

  return (
    <div className="knowledge-page">
      {activeTab === 'user' && (
        <div className="knowledge-page-form">
          <h2 className="knowledge-page-title">{editId ? '编辑笔记' : '添加笔记'}</h2>
          <input className="knowledge-input" placeholder="标题（可选）" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="knowledge-textarea"
            placeholder="写下你的知识、定价逻辑、甲方话术、行业笔记… AI 对话时会自动参考"
            value={content}
            rows={6}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="knowledge-add-footer">
            <input className="knowledge-input knowledge-tags" placeholder="标签（逗号分隔，可选）" value={tags} onChange={(e) => setTags(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              {editId && <button type="button" className="knowledge-cancel-btn" onClick={reset}>取消</button>}
              <button type="button" className="knowledge-save-btn" disabled={!content.trim() || saving} onClick={() => void save()}>
                {saving ? '保存中…' : editId ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="knowledge-page-list">
        <div className="settings-tabs view-mode-tabs knowledge-source-tabs">
          <button type="button" className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>
            <BookOpen size={14} />
            我的笔记
            {userNotes.length > 0 && <span className="knowledge-tab-count">{userNotes.length}</span>}
          </button>
          <button type="button" className={activeTab === 'ai-tip' ? 'active' : ''} onClick={() => setActiveTab('ai-tip')}>
            <Heart size={14} />
            AI 收藏
            {aiTipNotes.length > 0 && <span className="knowledge-tab-count">{aiTipNotes.length}</span>}
          </button>
        </div>

        {loading && <p className="knowledge-empty">加载中…</p>}
        {!loading && activeTab === 'user' && userNotes.length === 0 && (
          <div className="empty-state">
            <strong>还没有笔记</strong>
            <p>写下定价逻辑、甲方话术、行业心得，AI 工作助手对话时会自动参考这里的内容。</p>
          </div>
        )}
        {!loading && activeTab === 'ai-tip' && aiTipNotes.length === 0 && (
          <div className="empty-state">
            <strong>还没有收藏</strong>
            <p>在工作台的每日小知识里点击 ♥，感兴趣的内容会收进这里。</p>
          </div>
        )}
        {(activeTab === 'user' ? userNotes : aiTipNotes).map((n) => (
          <div key={n.id} className={`knowledge-item ${n.source === 'ai-tip' ? 'knowledge-item-ai-tip' : ''}`}>
            <div className="knowledge-item-header">
              <span className="knowledge-item-title">{n.title || '无标题'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {n.source !== 'ai-tip' && (
                  <button type="button" className="knowledge-item-delete" onClick={() => startEdit(n)} aria-label="编辑" title="编辑">
                    <Pencil size={13} />
                  </button>
                )}
                <button type="button" className="knowledge-item-delete" onClick={() => void remove(n.id)} aria-label="删除" title="删除">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {n.tags && <div className="knowledge-item-tags">{n.tags}</div>}
            <p className="knowledge-item-content">{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI 工作助手 ──────────────────────────────────────────────────────────────

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }
type ChatAttachment = { id: string; type: 'image' | 'text'; name: string; data: string; mimeType: string; preview?: string }
type ConversationRecord = { id: string; title: string; messages: ChatMessage[]; savedAt: number }
type ChatModelChoice = 'auto' | `route:${AiModelRouteKey}` | 'doubao-seed-2-1-pro' | 'workers-ai' | `openrouter:${string}`

const CHAT_HISTORY_KEY = 'alice_chat_history'
const CHAT_MODEL_CHOICE_KEY = 'alice_chat_model_choice'

function loadChatHistory(): ConversationRecord[] {
  try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? '[]') as ConversationRecord[] }
  catch { return [] }
}

function saveToChatHistory(msgs: ChatMessage[]) {
  const userMsgs = msgs.filter((m) => m.role === 'user')
  if (userMsgs.length === 0) return
  const title = userMsgs[0].content.slice(0, 30) + (userMsgs[0].content.length > 30 ? '…' : '')
  const record: ConversationRecord = { id: crypto.randomUUID(), title, messages: msgs, savedAt: Date.now() }
  const prev = loadChatHistory().slice(0, 19)
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify([record, ...prev]))
}

const ALICE_WELCOME_ID = 'alice-welcome'
const ALICE_SUGGESTED = ['今天完成了哪些工作？', '帮我分析本月收入', '我的效率怎么样？']

function readChatModelChoice(): ChatModelChoice {
  try {
    const raw = window.localStorage.getItem(CHAT_MODEL_CHOICE_KEY) ?? ''
    if (raw === 'auto' || raw === 'workers-ai' || raw === 'doubao-seed-2-1-pro' || raw.startsWith('route:') || raw.startsWith('openrouter:')) {
      return raw as ChatModelChoice
    }
  } catch {
    // ignore
  }
  return 'auto'
}

function chatRouteLabel(route: AiModelRouteKey) {
  if (route === 'textPrimary') return '文字主模型'
  if (route === 'textFallback') return '文字备用'
  if (route === 'visionPrimary') return '识图主模型'
  return '识图备用'
}

function chatModelChoiceLabel(choice: ChatModelChoice, aiModelConfig: AiModelConfig | null) {
  if (choice === 'auto') return '自动'
  if (choice === 'workers-ai') return 'Workers AI'
  if (choice === 'doubao-seed-2-1-pro') return '豆包 Seed 2.1 Pro'
  if (choice.startsWith('openrouter:')) return choice.replace(/^openrouter:/, '').replace(/:free$/, '').split('/').pop() || 'OpenRouter'
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

function renderPlainChatLines(lines: string[]) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={`${index}-${line}`}>
          {index > 0 && <br />}
          {renderRichChatLine(line)}
        </Fragment>
      ))}
    </>
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

function renderChatThinkingBlock(lines: string[]) {
  if (lines.length === 0) return null
  return (
    <details className="chat-agent-timeline chat-agent-thoughts">
      <summary>
        <span>思考过程</span>
        <small>{lines.length} 行</small>
        <ChevronDown size={13} />
      </summary>
      <div className="chat-thought-body">{renderPlainChatLines(lines)}</div>
    </details>
  )
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
    const { thinkingLines, answerLines } = splitChatThinkingLines(dividerIndex > 0 ? lines.slice(dividerIndex + 1) : [])
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
        {renderChatThinkingBlock(thinkingLines)}
        {answerLines.length > 0 && (
          <div className="chat-final-answer">{renderPlainChatLines(answerLines)}</div>
        )}
      </>
    )
  }
  const { thinkingLines, answerLines } = splitChatThinkingLines(lines)
  return (
    <>
      {renderChatThinkingBlock(thinkingLines)}
      {answerLines.length > 0 && <div className="chat-final-answer">{renderPlainChatLines(answerLines)}</div>}
    </>
  )
}

type ChatPanelProps = {
  currentMonthValue: string
  aiModelConfig: AiModelConfig | null
  onClose: () => void
}

function formatAgentTraceContent(content: string, trace?: string[]) {
  if (!trace || trace.length === 0) {
    return content
  }
  return [
    '我按这个过程处理：',
    ...trace.map((item) => `- ${item}`),
    '',
    content,
  ].join('\n')
}

const AGENT_LIVE_TRACE_STEPS = [
  '理解问题：识别你的目标、月份和要核对的工作口径。',
  '判断路径：确认是否需要读取 Giverny 的任务、工时、收入或验收数据。',
  '选择工具：准备调用任务搜索、语义召回或结构化统计工具。',
  '读取数据：等待 Worker 与 Agent Runtime 返回可核对的任务结果。',
  '核对口径：检查月份范围、未完成、逾期、状态和任务数量是否一致。',
  '生成答复：整理结论、任务明细和下一步建议。',
]

function buildAgentLiveTraceSteps(text: string, hasAttachments: boolean, useWebSearch: boolean) {
  const firstStep = hasAttachments
    ? '理解问题：识别你的目标、附件内容和要核对的工作口径。'
    : AGENT_LIVE_TRACE_STEPS[0]
  const toolStep = useWebSearch
    ? '选择工具：准备调用站内任务工具，必要时补充联网搜索。'
    : AGENT_LIVE_TRACE_STEPS[2]
  const answerStep = text.length > 0
    ? AGENT_LIVE_TRACE_STEPS[5]
    : '生成答复：整理附件分析结论和下一步建议。'
  return [
    firstStep,
    AGENT_LIVE_TRACE_STEPS[1],
    toolStep,
    AGENT_LIVE_TRACE_STEPS[3],
    AGENT_LIVE_TRACE_STEPS[4],
    answerStep,
  ]
}

function formatAgentLiveTraceContent(trace: string[], totalSteps: number) {
  return [
    `我正在这样处理：${totalSteps}`,
    ...trace.map((item) => `- ${item}`),
  ].join('\n')
}

function ChatPanel({
  currentMonthValue,
  aiModelConfig,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showScopePopup, setShowScopePopup] = useState(false)
  const [showModelPopup, setShowModelPopup] = useState(false)
  const [selectedModelChoice, setSelectedModelChoice] = useState<ChatModelChoice>(() => readChatModelChoice())
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterFreeModel[]>([])
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] = useState(false)
  const [historyList, setHistoryList] = useState<ConversationRecord[]>(() => loadChatHistory())

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isWelcome = messages.length === 1 && messages[0].id === ALICE_WELCOME_ID

  useEffect(() => { if (!isWelcome) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isWelcome])
  useEffect(() => { inputRef.current?.focus() }, [])

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

  const newConversation = () => {
    if (!isWelcome) saveToChatHistory(messages)
    setHistoryList(loadChatHistory())
    setMessages([{ id: ALICE_WELCOME_ID, role: 'assistant', content: '' }])
    setInput('')
    setAttachments([])
    setShowModelPopup(false)
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const openHistory = () => {
    setHistoryList(loadChatHistory())
    setShowHistory(true)
  }

  const loadConversation = (record: ConversationRecord) => {
    setMessages(record.messages)
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const deleteHistoryItem = (id: string) => {
    const updated = historyList.filter((r) => r.id !== id)
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated))
    setHistoryList(updated)
  }

  const authHeaders = (): Record<string, string> => {
    return { 'content-type': 'application/json' }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const added: ChatAttachment[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)
      if (!isImage && !isText) continue
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        if (isImage) {
          reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? '') }
          reader.readAsDataURL(file)
        } else {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(file)
        }
      })
      added.push({
        id: crypto.randomUUID(),
        type: isImage ? 'image' : 'text',
        name: file.name,
        data,
        mimeType: file.type || 'text/plain',
        preview: isImage ? URL.createObjectURL(file) : undefined,
      })
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 4))
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

  const send = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && attachments.length === 0) || loading) return
    const displayText = text || `[附件：${attachments.map((a) => a.name).join('、')}]`
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: displayText }
    const assistantId = crypto.randomUUID()
    const baseMessages = isWelcome ? [] : messages
    if (overrideText === undefined) setInput('')
    const sentAttachments = [...attachments]
    setAttachments([])
    const liveTraceSteps = buildAgentLiveTraceSteps(text, sentAttachments.length > 0, useWebSearch)
    let liveTraceStepCount = 1
    let liveTraceTimer: number | undefined
    const stopLiveTrace = () => {
      if (liveTraceTimer !== undefined) {
        window.clearInterval(liveTraceTimer)
        liveTraceTimer = undefined
      }
    }
    const updateLiveTrace = (count: number) => {
      setMessages((prev) => prev.map((m) => (
        m.id === assistantId
          ? { ...m, content: formatAgentLiveTraceContent(liveTraceSteps.slice(0, count), liveTraceSteps.length) }
          : m
      )))
    }

    setMessages([...baseMessages, userMsg, {
      id: assistantId,
      role: 'assistant',
      content: formatAgentLiveTraceContent(liveTraceSteps.slice(0, liveTraceStepCount), liveTraceSteps.length),
    }])
    setLoading(true)
    try {
      const minimumVisibleDelay = new Promise((resolve) => setTimeout(resolve, 650))
      liveTraceTimer = window.setInterval(() => {
        liveTraceStepCount = Math.min(liveTraceStepCount + 1, liveTraceSteps.length)
        updateLiveTrace(liveTraceStepCount)
        if (liveTraceStepCount >= liveTraceSteps.length) stopLiveTrace()
      }, 520)
      const allMessages = [...baseMessages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          messages: allMessages,
          month: currentMonthValue,
          useKnowledge,
          useWebSearch,
          modelChoice: selectedModelChoice,
          attachments: sentAttachments.map(({ type, name, data, mimeType }) => ({ type, name, data, mimeType })),
        }),
      })
      await minimumVisibleDelay
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? `请求失败：${res.status}`)
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/event-stream')) {
        const data = (await res.json()) as { content?: string; trace?: string[] }
        stopLiveTrace()
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: formatAgentTraceContent(data.content ?? '（无回复）', data.trace) } : m))
        return
      }
      stopLiveTrace()
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: '' } : m))
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
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
            const { t } = JSON.parse(payload) as { t?: string }
            if (t) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + t } : m))
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      stopLiveTrace()
      const msg = e instanceof Error ? e.message : '请求失败，请重试'
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m))
    } finally {
      stopLiveTrace()
      setLoading(false)
    }
  }

  const scopeActive = useKnowledge || useWebSearch
  const modelOptions: Array<{ value: ChatModelChoice; label: string; meta: string; disabled?: boolean }> = [
    { value: 'auto', label: '自动', meta: '由 Agent 按任务选择当前可用路线' },
    { value: 'doubao-seed-2-1-pro', label: '豆包 Seed 2.1 Pro', meta: '火山方舟 · doubao-seed-2-1-pro-260628' },
    { value: 'route:textPrimary', label: aiModelConfig?.textPrimary.model || '文字主模型', meta: `${chatRouteLabel('textPrimary')} · ${aiModelConfig?.textPrimary.provider || 'DeepSeek'}` },
    { value: 'route:textFallback', label: aiModelConfig?.textFallback.model || '文字备用', meta: `${chatRouteLabel('textFallback')} · ${aiModelConfig?.textFallback.provider || 'Kimi'}` },
    { value: 'route:visionPrimary', label: aiModelConfig?.visionPrimary.model || '识图主模型', meta: `${chatRouteLabel('visionPrimary')} · 可处理图片问题` },
    { value: 'workers-ai', label: 'Workers AI', meta: 'Cloudflare 边缘兜底模型' },
  ]

  return (
    <div className="chat-panel" role="dialog" aria-label="爱丽丝">
      {/* header */}
      <div className="chat-panel-header">
        <div className="chat-panel-title">
          <span>爱丽丝</span>
          <small>Giverny Agent</small>
        </div>
        <div className="chat-panel-header-actions">
          <button type="button" className="chat-panel-icon-btn" onClick={newConversation} title="新建对话" aria-label="新建对话">
            <Plus size={15} />
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={openHistory} title="历史记录" aria-label="历史记录">
            <History size={15} />
          </button>
          <button type="button" className="chat-panel-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* messages / welcome screen */}
      <div className="chat-panel-messages">
        {isWelcome ? (
          <div className="alice-welcome">
            <div className="alice-welcome-kicker">Giverny Agent</div>
            <h2 className="alice-welcome-title">嗨，来和爱丽丝聊一聊</h2>
            <p className="alice-welcome-sub">查工作数据、分析收入，或者聊聊设计行业问题</p>
            <div className="alice-suggested">
              {ALICE_SUGGESTED.map((s) => (
                <button key={s} type="button" className="alice-suggested-btn" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                {msg.content ? renderChatContent(msg.content) : (msg.role === 'assistant' && loading ? <span className="chat-cursor" /> : '…')}
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
            <div className="alice-model-popup-section">
              <div className="alice-model-popup-title">模型</div>
              {modelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`alice-model-row ${selectedModelChoice === option.value ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedModelChoice(option.value)
                    setShowModelPopup(false)
                  }}
                >
                  <Bot size={15} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.meta}</small>
                  </span>
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
                    setSelectedModelChoice(`openrouter:${model.id}` as ChatModelChoice)
                    setShowModelPopup(false)
                  }}
                >
                  <Sparkles size={15} />
                  <span>
                    <strong>{model.id}</strong>
                    <small>{[model.vision && '可识图', model.context > 0 && `${Math.round(model.context / 1000)}K 上下文`].filter(Boolean).join(' · ') || 'OpenRouter free'}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.md,.json,.csv"
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          />
          <div className="alice-input-toolbar">
            <button type="button" className="alice-tool-btn" onClick={() => fileInputRef.current?.click()} title="添加附件（图片、txt、md…）" aria-label="添加附件">
              <Paperclip size={15} />
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
              className={`alice-tool-btn alice-model-btn ${selectedModelChoice !== 'auto' ? 'active' : ''}`}
              onClick={openModelPicker}
              title="选择模型"
              aria-label="选择模型"
            >
              <Bot size={15} />
              <span className="alice-model-label">{chatModelChoiceLabel(selectedModelChoice, aiModelConfig)}</span>
            </button>
            <button
              type="button"
              className="alice-send-btn"
              onClick={() => void send()}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              aria-label="发送"
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="附件预览" onClose={() => setLightboxSrc(null)} />}

      {/* history panel (absolute overlay within chat-panel) */}
      {showHistory && (
        <div className="chat-history-panel">
          <div className="chat-history-header">
            <span>历史对话</span>
            <button type="button" className="chat-panel-icon-btn" onClick={() => setShowHistory(false)} aria-label="关闭历史">
              <X size={15} />
            </button>
          </div>
          <div className="chat-history-list">
            {historyList.length === 0 ? (
              <p className="chat-history-empty">暂无历史记录</p>
            ) : historyList.map((r) => (
              <div key={r.id} className="chat-history-item" onClick={() => loadConversation(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && loadConversation(r)}>
                <span className="chat-history-item-title">{r.title}</span>
                <div className="chat-history-item-meta">
                  <span>{new Date(r.savedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    className="chat-history-del"
                    onClick={(e) => { e.stopPropagation(); deleteHistoryItem(r.id) }}
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
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState<AppView>(() => viewFromPath(window.location.pathname))
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>(() => taskViewModeFromSearch())
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
  const [selectedTaskId, setSelectedTaskId] = useState(0)
  const [isTaskDetailCollapsed, setIsTaskDetailCollapsed] = useState(() => window.localStorage.getItem('giverny-task-detail-collapsed') === '1')
  const [detailTaskId, setDetailTaskId] = useState(0)
  const [editTaskId, setEditTaskId] = useState(0)
  const [progressModalTarget, setProgressModalTarget] = useState<ProgressModalTarget | null>(null)
  const [taskActivity, setTaskActivity] = useState<ActivityItem[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskSupplemental, setNewTaskSupplemental] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandPaletteInitialQuery, setCommandPaletteInitialQuery] = useState('')
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false)
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
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
  const toastTimersRef = useRef<number[]>([])
  const updatingTaskIdsRef = useRef<Set<number>>(new Set())
  const pendingTaskChangesRef = useRef<Map<number, Partial<Task>>>(new Map())
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const [backendStatus, setBackendStatus] = useState<'连接中' | '已接入 D1/R2' | '后端异常'>('连接中')
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
  const taskMonthValues = useMemo(
    () => new Set(taskItems.map(taskSettlementMonth).filter((value) => /^\d{4}-\d{2}$/.test(value))),
    [taskItems],
  )
  const monthTasks = useMemo(() => taskItems.filter((task) => taskSettlementMonth(task) === currentMonth.value), [currentMonth.value, taskItems])
  const activeMonthTasks = useMemo(() => monthTasks.filter((task) => !task.voidedAt), [monthTasks])
  const taskPageSourceTasks = useMemo(() => (showVoidedTasks ? monthTasks : activeMonthTasks), [activeMonthTasks, monthTasks, showVoidedTasks])
  const monthUpdates = useMemo(
    () =>
      updateItems.filter((update) => {
        const task = taskItems.find((item) => item.id === update.taskId)
        if (task?.voidedAt) {
          return false
        }
        return update.date.startsWith(currentMonth.value) || (task ? taskSettlementMonth(task) === currentMonth.value : false)
      }),
    [currentMonth.value, taskItems, updateItems],
  )
  const importedHours = currentMonth.value === importedHoursMonth ? importedMonthlyHours : 0
  const isTaskCalendarView = activeView === '任务' && taskViewMode === '日历'
  const effectiveCalendarFocusDate = calendarFocusDate.startsWith(currentMonth.value) ? calendarFocusDate : `${currentMonth.value}-01`
  const viewTitle = activeView === '工作台' ? `${currentMonth.label}工作台` : activeView

  const notify = (
    message: string,
    tone: ToastTone = inferToastTone(message),
    options: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'> = {},
  ) => {
    const id = Date.now() + Math.random()
    const nextToast: ToastState = { id, message, tone, ...options }
    const duration = options.durationMs ?? (tone === 'error' ? 4200 : 2400)
    setToastQueue((current) => [...current, nextToast].slice(-3))
    const timer = window.setTimeout(() => {
      setToastQueue((current) => current.filter((item) => item !== nextToast))
      toastTimersRef.current = toastTimersRef.current.filter((value) => value !== timer)
    }, duration)
    toastTimersRef.current = [...toastTimersRef.current, timer]
  }

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
    setActiveView(view)
    const nextPath = taskViewRoute(view, taskViewMode)
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState({ view, taskViewMode }, '', nextPath)
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
    if (window.location.pathname === '/') {
      window.history.replaceState({ view: activeView, taskViewMode }, '', taskViewRoute(activeView, taskViewMode))
    }
    const handlePopState = () => {
      setActiveView(viewFromPath(window.location.pathname))
      setTaskViewMode(taskViewModeFromSearch(window.location.search))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextPath = taskViewRoute(activeView, taskViewMode)
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.replaceState({ view: activeView, taskViewMode }, '', nextPath)
    }
  }, [activeView, taskViewMode])


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
    setIsLoaded(true)
  }

  const retryRefreshState = async () => {
    setBackendStatus('连接中')
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
  }, [auth])

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
  const previewBackfillRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (role !== 'admin') {
      return
    }
    const canBackfill = (file: FileAsset) => ['pdf', 'ai', 'psd', 'office', 'video'].includes(fileTypeForAsset(file).kind)
    const targets = fileItems.filter(
      (file) =>
        !file.deletedAt &&
        !file.previewUrl &&
        file.sourceUrl &&
        canBackfill(file) &&
        !previewBackfillRef.current.has(file.id),
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
        previewBackfillRef.current.add(file.id)
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
            setFileItems((current) => current.map((item) => (item.id === file.id ? { ...item, previewUrl: result.previewUrl } : item)))
          }
        } catch (error) {
          console.warn('缩略图补全失败', file.name, error)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fileItems, role])

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
          <b>{formatMonthDay(task.date)}</b>
          <span className="task-date-meta">
            <span>{[formatTimePart(task.date), task.type].filter(Boolean).join(' · ')}</span>
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
            实际 <strong>{task.actualHours.toFixed(1)}h</strong>
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
            <button
              type="button"
              className="icon-button"
              title={canAcceptTask ? '去验收' : '当前不是待验收'}
              aria-label={canAcceptTask ? '去验收' : '当前不是待验收'}
              disabled={!canAcceptTask}
              onClick={(event) => { event.stopPropagation(); handleOpenTaskAcceptance(task.id) }}
            >
              <ClipboardCheck size={15} />
            </button>
          </div>}
        </div>
      </article>
    )
  }

  const voidedMonthTaskCount = useMemo(() => monthTasks.filter((task) => task.voidedAt).length, [monthTasks])

  const activeTaskItems = useMemo(() => taskItems.filter((task) => !task.voidedAt), [taskItems])
  const taskContextInsights = buildTaskContextInsights(activeTaskItems, updateItems)

  const stats = useMemo(() => {
    const totalHours = activeMonthTasks.reduce((sum, task) => sum + task.actualHours, importedHours)
    const billableHours = activeMonthTasks
      .filter(isTaskBillable)
      .reduce((sum, task) => sum + task.actualHours, importedHours)
    const accepted = activeMonthTasks.filter((task) => task.status === '已验收').length
    const pending = activeMonthTasks.filter((task) => task.status === '待验收').length

    return {
      totalHours,
      billableHours,
      amount: sumBillableAmount(activeMonthTasks, hourlyRate, importedHours),
      accepted,
      pending,
    }
  }, [activeMonthTasks, hourlyRate, importedHours])

  const donutData = useMemo(() => {
    // 本月洞察只统计实际投入；预计工时只作为排期参考，不参与分析。
    const hoursByType = new Map<string, number>()
    activeMonthTasks.forEach((task) => {
      const hours = task.actualHours
      if (hours > 0) {
        hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + hours).toFixed(1)))
      }
    })
    const items: DonutItem[] = [...hoursByType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))

    return { items, total: Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }
  }, [activeMonthTasks])

  const [today] = useState(() => isoDate())
  const [dueSoonDate] = useState(() => isoDate(3))
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

  const annualData = useMemo(() => {
    const year = currentMonth.value.slice(0, 4)
    const lockedByMonth = new Map(reports.filter((report) => report.month.startsWith(year)).map((report) => [report.month, report]))
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`)
    const rows = months.map((month) => {
      const tasks = activeTaskItems.filter((task) => taskSettlementMonth(task) === month && isTaskBillable(task))
      const imported = month === importedHoursMonth ? importedMonthlyHours : 0
      const hours = Number(tasks.reduce((sum, task) => sum + task.actualHours, imported).toFixed(1))
      const locked = lockedByMonth.get(month)
      const amount = locked ? locked.totalAmount : sumBillableAmount(tasks, hourlyRate, imported)
      return { month, hours, amount, locked: Boolean(locked) }
    })
    return {
      year,
      rows,
      totalHours: Number(rows.reduce((sum, row) => sum + row.hours, 0).toFixed(1)),
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    }
  }, [activeTaskItems, currentMonth.value, hourlyRate, reports])

  const dailyTrendData = useMemo(() => {
    const [year, month] = currentMonth.value.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    // 本月每一天一个桶，形成平滑日曲线
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ label: `${month}/${index + 1}`, value: 0 }))
    // 工时来自分段计时（timeEntries），进展记录本身不带工时
    activeMonthTasks.forEach((task) => {
      const belongsToCurrentMonth = taskSettlementMonth(task) === currentMonth.value
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0) {
          return
        }
        const entryDate = entry.date || ''
        const inMonth = entryDate.startsWith(currentMonth.value) || belongsToCurrentMonth
        if (!inMonth) {
          return
        }
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
    try {
      const result = await api.getTaskActivity(taskId)
      setTaskActivity(result.items)
    } catch {
      setTaskActivity([])
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
    if (task && !editEntryId && !initialAcceptanceMode && !isTaskStarted(task)) {
      notify('任务仍在计划中。请先把状态改为进行中，再记录进展或等待时间。', 'error')
      return
    }
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
    setSelectedTaskId(taskId)
    setProgressModalTarget({ taskId, mode: 'progress', initialAcceptanceMode: true })
    void loadTaskActivity(taskId)
  }

  const handleSaveTaskEdit = (taskId: number, changes: Partial<Task>) => {
    if (isAdmin) {
      void handleUpdateTask(taskId, changes)
    } else {
      requireAdmin()
    }
    setEditTaskId(0)
  }

  const handleConfirmTaskAcceptance = (
    task: Task,
    payload: AcceptancePayload,
  ) => {
    if (isAdmin) {
      void handleUpdateTask(task.id, {
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
    } else {
      requireAdmin()
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
      const uploadFile = await compressProgressImageFile(file)
      const uploadExtension = fileTypeForFile(uploadFile).type
      const preview = await createOptionalPreviewFile(uploadFile)
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

  const handleAcceptanceFileUpload = async (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => {
    const extension = fileTypeForFile(file).type
    const preview = await createOptionalPreviewFile(file)
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
    await loadTaskActivity(taskId)
    return savedFile
  }

  // AI 自动估算整体进度：依据进展记录文字。按「条目签名」去重，避免重复调用/死循环。
  const autoEstimateSigRef = useRef<Map<number, string>>(new Map())
  const handleAutoEstimateProgress = async (task: Task) => {
    if (!isAdmin) {
      return
    }
    if (['已验收', '终止', '挂起', '不计费'].includes(task.status)) {
      return
    }
    const entries = (task.timeEntries ?? []).filter((entry) => (entry.note ?? '').trim())
    if (entries.length === 0) {
      return
    }
    const signature = `${entries.length}:` + entries.map((entry) => `${entry.id}.${(entry.note ?? '').length}`).join('|')
    if (autoEstimateSigRef.current.get(task.id) === signature) {
      return
    }
    autoEstimateSigRef.current.set(task.id, signature)
    try {
      const result = await api.estimateTaskProgress({
        title: task.title,
        requirement: task.requirement,
        status: task.status,
        entries: entries.map((entry) => ({
          date: entry.date ?? '',
          note: entry.note ?? '',
          isAcceptance: Boolean(entry.isAcceptanceProgress),
        })),
      })
      const next = snapProgress(result.progress)
      const current = taskItemsRef.current.find((item) => item.id === task.id)
      if (!current || ['已验收', '终止', '挂起', '不计费'].includes(current.status)) {
        return
      }
      if (snapProgress(current.progress) !== next) {
        await handleUpdateTask(task.id, { progress: next })
      }
    } catch {
      // 失败则清掉签名，下次再试
      autoEstimateSigRef.current.delete(task.id)
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
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `任务更新失败：${error.message}` : '任务更新失败')
    } finally {
      updatingTaskIdsRef.current.delete(taskId)
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

  const handleCopyShareLink = async (token: string) => {
    const link = `${window.location.origin}/share/${token}`
    try {
      await window.navigator.clipboard.writeText(link)
      notify('甲方分享链接已复制')
    } catch {
      notify(link)
    }
  }

  const handleRotateReportToken = (report: ReportRecord) => {
    setConfirmDialog({
      eyebrow: '重置甲方链接',
      title: `确定重置 ${monthLabelOf(report.month)} 的甲方链接吗？`,
      body: '确认后会生成一个新的只读链接，旧链接将立即失效。结算金额、工时和任务快照不会变化。',
      confirmText: '重置链接',
      details: [`当前结算：${report.billableHours.toFixed(1)}h · ¥${formatYuan(report.totalAmount)}`, '旧链接失效后，需要把新链接重新发给甲方。'],
      onConfirm: async () => {
        const result = await api.rotateMonthlyReportToken(report.id)
        setReports((current) => current.map((item) => (item.id === result.report.id ? result.report : item)))
        const link = `${window.location.origin}/share/${result.report.publicToken}`
        try {
          await window.navigator.clipboard.writeText(link)
          notify('甲方链接已重置，新链接已复制')
        } catch {
          notify(`甲方链接已重置：${link}`)
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
        : '删除后会同时移除 D1 文件记录、R2 源文件和预览图。请只删除误传文件，已验收或已发给甲方的文件建议保留。',
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

  const handleLockMonthlyReport = async () => {
    try {
      const report = await api.lockMonthlyReport({ month: currentMonth.value, hourlyRate, importedHours })
      await refreshState()
      const link = `${window.location.origin}/share/${report.publicToken}`
      try {
        await window.navigator.clipboard.writeText(link)
        notify(`结算已锁定 ¥${formatYuan(report.totalAmount)}，甲方链接已复制`)
      } catch {
        notify(`结算已锁定 ¥${formatYuan(report.totalAmount)}：${link}`)
      }
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `结算锁定失败：${error.message}` : '结算锁定失败')
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
  const shortcutHelpGroups: ShortcutHelpGroup[] = [
    {
      label: '全局',
      items: [
        { keys: '⌘ K / Ctrl K', action: '打开命令面板' },
        { keys: '⌘ ⇧ M / Ctrl ⇧ M', action: '显示 / 隐藏金额' },
        { keys: '⌥ ⌥', action: '查看快捷键' },
        { keys: '⌥ A', action: '打开 / 关闭爱丽丝 AI 助手（管理员）' },
        { keys: 'N', action: '新建任务' },
        { keys: '⇧ N', action: '补录任务' },
        { keys: 'P', action: '记录选中任务进展' },
        { keys: 'F', action: '打开文件库' },
        { keys: ',', action: '打开设置' },
        { keys: '/', action: '聚焦任务搜索' },
        { keys: 'Esc', action: '关闭当前浮层' },
      ],
    },
    {
      label: '导航',
      items: [
        { keys: '⌘ ⌥ 1', action: '工作台' },
        { keys: '⌘ ⌥ 2', action: '任务' },
        { keys: '⌘ ⌥ 3', action: '文件库' },
        { keys: '⌘ ⌥ 4', action: '洞察' },
        { keys: '⌘ ⌥ 5', action: '结算' },
        { keys: '⌘ ⌥ 6', action: '收入' },
        { keys: '⌘ ⇧ ⌥ ,', action: '设置' },
        { keys: '⌘ ⇧ ⌥ K', action: '跳转到知识库（管理员）' },
      ],
    },
    {
      label: '任务列表',
      items: [
        { keys: 'J / K', action: '选择下一个 / 上一个任务' },
        { keys: 'Enter', action: '查看选中任务详情' },
        { keys: 'E', action: '编辑选中任务' },
        { keys: 'P', action: '记录选中任务进展' },
        { keys: 'A', action: '验收选中任务' },
      ],
    },
    {
      label: '月份',
      items: [
        { keys: '[', action: '切换到上个月' },
        { keys: ']', action: '切换到下个月' },
      ],
    },
  ]
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
          setIsChatOpen((v) => !v)
          return
        }
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
          <p>这里包含洞察、结算、收入或系统配置，只对管理员开放。游客和甲方成员可以继续查看公开任务、进展和甲方可见文件。</p>
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
            return (
              <div key={item.label}>
                <button
                  className={`nav-item ${activeView === item.label ? 'active' : ''}`}
                  aria-label={`切换到${item.label}`}
                  aria-keyshortcuts={ariaShortcut}
                  title={shortcut ? `${item.label}（${shortcut}）` : item.label}
                  onClick={() => navigateView(item.label as AppView)}
                >
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
                      : role === 'client' ? '甲方（当月可见）'
                      : auth ? '访问口令（只读）' : '游客只读'
                  }</span>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <button className="account-menu-item" type="button" role="menuitem" onClick={() => navigateView('设置')}>
                    <Settings size={17} />
                    <span>全站设置</span>
                  </button>
                  <div className="account-menu-storage" title="Cloudflare R2 文件空间">
                    <Archive size={17} />
                    <div>
                      <span>R2 文件空间</span>
                      <strong>18.6 GB</strong>
                    </div>
                  </div>
                  <button className="account-menu-item danger" type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut size={17} />
                    <span>退出登录</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="account-menu-note">当前只能查看公开任务、进展和甲方可见文件；编辑、上传、验收和结算需要管理员身份。</p>
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
            onClick={() => setIsAccountMenuOpen((value) => !value)}
          >
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
                className={`topbar-shortcut ${isChatOpen ? 'active' : ''}`}
                title="工作助手 AI 对话"
                aria-label="打开工作助手"
                onClick={() => setIsChatOpen((v) => !v)}
              >
                <Bot size={16} />
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

        {backendStatus !== '已接入 D1/R2' && (
          <div className={`backend-notice ${backendStatus === '后端异常' ? 'error' : 'pending'}`} role={backendStatus === '后端异常' ? 'alert' : 'status'}>
            {backendStatus === '后端异常' ? <AlertTriangle size={16} /> : <LoaderCircle size={16} />}
            <div>
              <strong>{backendStatus === '后端异常' ? '最新数据同步失败' : '正在同步最新数据'}</strong>
              <span>{backendStatus === '后端异常' ? '当前页面可能显示上次成功加载的内容。' : '你可以先浏览页面，完成后会自动更新。'}</span>
            </div>
            {backendStatus === '后端异常' && (
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

        {dueTasks.reminderTasks.length > 0 && (
          <button className="due-strip" onClick={() => navigateView('任务')}>
            <AlarmClock size={17} />
            <span className="due-summary">
              {dueTasks.overdue.length > 0 ? (
                <strong className="due-summary-overdue">{dueTasks.overdue.length} 个任务已逾期</strong>
              ) : (
                <strong className="due-summary-nearest">最近任务</strong>
              )}
              {dueTasks.soonHighlights.length > 0 && ' · '}
              {dueTasks.soonHighlights.length > 0 && <span className="due-summary-soon">{dueTasks.soonHighlights.length} 个任务 3 天内交付</span>}
            </span>
            <em>{dueTasks.reminderTasks.map((task) => task.title).join('、')}</em>
            <ChevronRight size={15} className="due-arrow" />
          </button>
        )}

        <section className={`content-grid dashboard-content-grid ${isTaskDetailCollapsed ? 'detail-collapsed' : ''}`}>
          <div className="main-column">
            <section className="panel task-panel dashboard-task-panel">
              <div className="dashboard-task-header">
                <div className="dashboard-task-heading-row">
                  <h2>任务明细</h2>
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
                  <div className="empty-state" role="status">
                    <strong>{activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}</strong>
                    <p>{activeMonthTasks.length === 0 ? '先建一条真实任务，工时、文件和月报都会从这里串起来。' : '换一个关键词或状态筛选试试。'}</p>
                    {activeMonthTasks.length === 0 ? (
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
                  </div>
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
          <TasksView
            viewMode={taskViewMode}
            onViewModeChange={setTaskViewMode}
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
            onUploadAcceptanceFile={canWrite ? handleAcceptanceFileUpload : readOnlyUploadFile}
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
            onPreviewFile={setPreviewFile}
            activity={taskActivity}
            hourlyRate={hourlyRate}
            onUploadImage={canWrite ? handleQuickUploadImage : readOnlyUploadImage}
            onUpdateFile={canWrite ? handleUpdateFile : async () => { requireAdmin(); throw new Error('需要管理员权限') }}
            onDeleteFile={isAdmin ? handleDeleteFile : () => requireAdmin()}
            onConfirmAcceptance={canWrite ? handleConfirmTaskAcceptance : undefined}
            onCreateTaskUpdate={canWrite ? handleCreateTaskUpdate : readOnlyCreateUpdate}
            onCreateTask={() => openCreateTask(false)}
            rowThemeOn={rowThemeOn}
            onAutoEstimateProgress={canWrite ? handleAutoEstimateProgress : undefined}
            canWrite={canWrite}
            canDelete={isAdmin}
            detailCollapsed={isTaskDetailCollapsed}
            onToggleDetail={toggleTaskDetail}
          />
        )}

        {activeView === '文件库' && (
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
        )}

        {activeView === '洞察' && (
          canSeeFull || isClient ? (
            <InsightsView
              tasks={activeTaskItems}
              updates={updateItems}
              files={fileItems}
              attachmentAnalyses={attachmentAnalyses}
              reports={reports}
              currentMonth={currentMonth}
              hourlyRate={hourlyRate}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '收入' && (
          canSeeFull ? (
            <IncomeView
              annualData={annualData}
              currentMonth={currentMonth}
              taxMode={taxMode}
              onMonthChange={setMonthValue}
              activeMonthTasks={activeMonthTasks}
              hourlyRate={hourlyRate}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '结算' && (
          canSeeFull || isClient ? (
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
              files={fileItems}
              attachmentAnalyses={attachmentAnalyses}
              onCopyShareLink={handleCopyShareLink}
              onRotateReportToken={handleRotateReportToken}
              onLockReport={handleLockMonthlyReport}
              onNotify={notify}
            />
          ) : (
            adminOnlyPanel
          )
        )}

        {activeView === '知识库' && isAdmin && (
          <KnowledgeView />
        )}

        {activeView === '设置' && (
          isAdmin ? (
            <SettingsView
              hourlyRate={hourlyRate}
              pdfTitle={pdfTitle}
              serviceCompanyName={serviceCompanyName}
              taxMode={taxMode}
              designTypeGroups={designTypeGroups}
              aiModelConfig={aiModelConfig}
              role={role}
              accessTokens={accessTokens}
              newTokenId={newTokenId}
              rowThemeOn={rowThemeOn}
              onRateChange={handleRateChange}
              onPdfTitleChange={handlePdfTitleChange}
              onServiceCompanyNameChange={handleServiceCompanyNameChange}
              onTaxModeChange={handleTaxModeChange}
              onDesignTypeGroupsChange={handleDesignTypeGroupsChange}
              onAiModelConfigChange={handleAiModelConfigChange}
              onExportBackup={handleExportBackup}
              onSignOut={handleSignOut}
              onChangePassword={handleChangeAdminPassword}
              onCreateToken={handleCreateAccessToken}
              onToggleToken={handleToggleAccessToken}
              onDeleteToken={handleDeleteAccessToken}
              onCopyToken={handleCopyAccessToken}
              onToggleRowTheme={toggleRowTheme}
            />
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
          <div className="chat-backdrop" onDoubleClick={() => setIsChatOpen(false)} />
          <ChatPanel
            currentMonthValue={currentMonth.value}
            aiModelConfig={aiModelConfig}
            onClose={() => setIsChatOpen(false)}
          />
        </>
      )}
      {isSemanticSearchOpen && (
        <SemanticSearchModal
          isAdmin={isAdmin}
          files={fileItems}
          tasks={taskItems}
          onClose={() => setIsSemanticSearchOpen(false)}
          onOpenTask={(taskId) => {
            setIsSemanticSearchOpen(false)
            handleOpenTaskDetail(taskId)
          }}
          onJumpToFile={(file) => {
            setIsSemanticSearchOpen(false)
            setFileLibraryFocusId(file.id)
            navigateView('文件库')
          }}
        />
      )}
      {isModalOpen && (
        <NewTaskModal
          designTypeGroups={designTypeGroups}
          currentMonthValue={currentMonth.value}
          initialSupplemental={newTaskSupplemental}
          onClose={() => setIsModalOpen(false)}
          onCreate={isAdmin ? handleCreateTask : async () => requireAdmin()}
          onDesignTypeGroupsChange={isAdmin ? handleDesignTypeGroupsChange : () => requireAdmin()}
        />
      )}
      {detailTaskId > 0 && (() => {
        const detailTask = taskItems.find((task) => task.id === detailTaskId)
        return detailTask ? (
          <TaskDetailModal
            key={detailTask.id}
            task={detailTask}
            files={fileItems}
            onClose={() => setDetailTaskId(0)}
            onPreviewFile={setPreviewFile}
            onOpenAcceptance={handleOpenTaskAcceptance}
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
            onCreate={isAdmin ? handleCreateTask : async () => requireAdmin()}
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
            onConfirmAcceptance={canWrite ? handleConfirmTaskAcceptance : undefined}
            onUploadAcceptanceFile={canWrite ? handleAcceptanceFileUpload : undefined}
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

function DonutChart({
  items,
  total,
}: {
  items: DonutItem[]
  total: number
}) {
  if (total <= 0) {
    return (
      <div className="empty-state">
        <strong>暂无工时数据</strong>
        <p>记录任务工时后，这里会按设计类型自动汇总。</p>
      </div>
    )
  }

  const gradient = items
    .reduce(
      (result, item) => {
        const start = result.cursor
        const end = start + (item.value / total) * 100

        return {
          cursor: end,
          segments: [...result.segments, `${item.color} ${start}% ${end}%`],
        }
      },
      { cursor: 0, segments: [] as string[] },
    )
    .segments.join(', ')

  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ '--donut-gradient': gradient } as CSSProperties}>
        <div>
          <strong>{total.toFixed(1)}h</strong>
          <span>总计</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div className="legend-row" key={item.label}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>
                {item.value.toFixed(1)}h ({percent}%)
              </strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="empty-state trend-empty">
        <strong>暂无趋势数据</strong>
        <p>记录任务工时后，这里会按天显示本月投入变化。</p>
      </div>
    )
  }

  const width = 560
  const height = 230
  const padding = { top: 24, right: 24, bottom: 36, left: 38 }
  const maxValue = Math.max(4, Math.ceil(Math.max(...data.map((item) => item.value)) / 4) * 4)
  const ticks = [0, maxValue / 4, maxValue / 2, (maxValue / 4) * 3, maxValue]
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const points = data.map((item, index) => {
    const x = data.length === 1 ? padding.left + innerWidth / 2 : padding.left + (innerWidth / (data.length - 1)) * index
    const y = padding.top + innerHeight - (item.value / maxValue) * innerHeight
    return { ...item, x, y }
  })
  // 数据点较多时（按天 = 30 天）：平滑曲线、稀疏坐标标签、只在峰值标注数值，避免拥挤
  const dense = points.length > 12
  const linePath = dense ? smoothLinePath(points) : points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
  const labelStep = Math.max(1, Math.ceil(points.length / 7))
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0])

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="本月每天工时趋势">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2f8f89" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2f8f89" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / maxValue) * innerHeight
          return (
            <g key={tick}>
              <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="axis-label y-label" x={10} y={y + 5}>
                {tick}
              </text>
            </g>
          )
        })}
        <path className="trend-area" d={areaPath} />
        <path className="trend-line" d={linePath} />
        {dense
          ? (
            <>
              {peak.value > 0 && (
                <g>
                  <circle className="trend-point" cx={peak.x} cy={peak.y} r="4.5" />
                  <text className="point-label" x={peak.x} y={peak.y - 12}>
                    {peak.value.toFixed(1)}
                  </text>
                </g>
              )}
              {points.map((point, index) =>
                index % labelStep === 0 || index === points.length - 1 ? (
                  <text key={point.label} className="axis-label x-label" x={point.x} y={height - 9}>
                    {point.label}
                  </text>
                ) : null,
              )}
            </>
          )
          : points.map((point) => (
            <g key={point.label}>
              <circle className="trend-point" cx={point.x} cy={point.y} r="5.5" />
              <text className="point-label" x={point.x} y={point.y - 14}>
                {point.value.toFixed(1)}
              </text>
              <text className="axis-label x-label" x={point.x} y={height - 9}>
                {point.label}
              </text>
            </g>
          ))}
      </svg>
    </div>
  )
}

// Catmull-Rom 转三次贝塞尔，得到平滑曲线
function smoothLinePath(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : ''
  }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return path
}

function StatCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string
  value: string
  trend: string
  icon: React.ReactNode
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-text">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{trend}</span>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

function TaskSearchBox({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={`search-box task-search-box ${className}`.trim()}>
      <Search size={18} />
      <input aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && (
        <button
          type="button"
          className="search-clear-button"
          aria-label="清除搜索内容"
          title="清除搜索"
          onClick={(event) => {
            event.preventDefault()
            onChange('')
          }}
        >
          <X size={14} />
        </button>
      )}
    </label>
  )
}

function ActiveTaskFilters({
  query,
  filter,
  onClearQuery,
  onClearFilter,
}: {
  query: string
  filter: TaskFilter
  onClearQuery: () => void
  onClearFilter: () => void
}) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery && filter === '全部') {
    return null
  }

  return (
    <div className="task-active-filters" aria-live="polite">
      <span>当前筛选</span>
      {normalizedQuery && (
        <button type="button" title="清除搜索关键词" onClick={onClearQuery}>
          “{normalizedQuery}”
          <X size={12} />
        </button>
      )}
      {filter !== '全部' && (
        <button type="button" title="清除状态筛选" onClick={onClearFilter}>
          {filter}
          <X size={12} />
        </button>
      )}
      {normalizedQuery && filter !== '全部' && (
        <button type="button" className="task-filter-reset" onClick={() => { onClearQuery(); onClearFilter() }}>
          清除全部
        </button>
      )}
    </div>
  )
}

function StatusDotLabel({ status }: { status: TaskStatus }) {
  return (
    <span className={`status-dot-label status-dot-${status}`}>
      <StatusDot status={status} />
      {status}
    </span>
  )
}

function StatusDot({ status }: { status: TaskStatus }) {
  return <i className={`status-dot status-dot-${status}`} aria-hidden="true" />
}

function TaskContextInsightBadge({ insight }: { insight?: TaskContextInsight }) {
  if (!insight) {
    return null
  }
  return (
    <span className={`task-context-insight admin-only-data ${insight.tone}`} title={`${insight.detail}｜依据：${insight.evidence}`}>
      <Info size={12} />
      {insight.label}
    </span>
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

// 设置页 · 吉维尼模式：默认关闭，用户手动开启。开启后主题随季节自动流转，也可手动指定季节。
function GivernyModeSettings({
  rowThemeOn,
  onToggleRowTheme,
}: {
  rowThemeOn: boolean
  onToggleRowTheme: () => void
}) {
  const [on, setOn] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.giverny === 'on',
  )
  const [seasonPref, setSeasonPref] = useState<SeasonPref>(() => readSeasonPref())
  const applyMode = (next: boolean) => {
    setOn(next)
    if (next) {
      document.documentElement.dataset.giverny = 'on'
    } else {
      delete document.documentElement.dataset.giverny
    }
    try {
      window.localStorage.setItem(GIVERNY_MODE_KEY, next ? 'on' : 'off')
    } catch {
      // 忽略持久化失败
    }
  }
  const applySeason = (pref: SeasonPref) => {
    setSeasonPref(pref)
    try {
      if (pref === 'auto') {
        window.localStorage.removeItem(GIVERNY_SEASON_KEY)
      } else {
        window.localStorage.setItem(GIVERNY_SEASON_KEY, pref)
      }
    } catch {
      // 忽略
    }
    document.documentElement.dataset.season = resolveSeason(pref)
  }
  const seasons: Array<[SeasonKey, string]> = [
    ['spring', '春 · 萌芽'],
    ['summer', '夏 · 盛放'],
    ['autumn', '秋 · 暮光'],
    ['winter', '冬 · 冷静'],
  ]
  const autoLabel: Record<SeasonKey, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
  return (
    <details className="settings-group-panel" open>
      <summary className="settings-group-summary">
        <div>
          <h2>外观 · 吉维尼模式</h2>
          <p>莫奈花园主题，随季节自然流转</p>
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="settings-group-body">
        <section className="panel giverny-settings-panel">
          <div className="panel-header compact">
            <div>
              <h2>吉维尼模式</h2>
              <p>致敬莫奈的睡莲池。开启后整站切换到莫奈花园色系，主题随季节流转。默认关闭，冷静的工具模式不受影响。</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              className={`giverny-toggle ${on ? 'on' : ''}`}
              onClick={() => applyMode(!on)}
            >
              <span className="giverny-toggle-track"><span className="giverny-toggle-thumb" /></span>
              <span className="giverny-toggle-label">{on ? '已开启' : '已关闭'}</span>
            </button>
          </div>
          {on && (
            <div className="giverny-season-pref">
              <span className="giverny-season-pref-title">季节</span>
              <div className="giverny-season-options" role="group" aria-label="季节选择">
                <button
                  type="button"
                  className={seasonPref === 'auto' ? 'active' : ''}
                  onClick={() => applySeason('auto')}
                >
                  跟随当前季节（{autoLabel[currentSeason()]}）
                </button>
                {seasons.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={seasonPref === key ? 'active' : ''}
                    onClick={() => applySeason(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="giverny-season-hint">默认跟随当前真实季节；也可手动锁定某一季。</p>
            </div>
          )}
          <div className="panel-header compact appearance-setting-row">
            <div>
              <h2>任务状态配色</h2>
              <p>开启后，任务行使用低饱和底色区分计划中、进行中和待验收；关闭后统一为中性纸面。</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={rowThemeOn}
              className={`giverny-toggle ${rowThemeOn ? 'on' : ''}`}
              onClick={onToggleRowTheme}
            >
              <span className="giverny-toggle-track"><span className="giverny-toggle-thumb" /></span>
              <span className="giverny-toggle-label">{rowThemeOn ? '已开启' : '已关闭'}</span>
            </button>
          </div>
        </section>
      </div>
    </details>
  )
}

// Cloudflare Turnstile 站点密钥（公开，可放前端）；密钥(secret)只在 Worker 后端环境变量里。
const TURNSTILE_SITE_KEY = '0x4AAAAAADq6J7chw6N3buxI'

function AdminLoginModal({
  error,
  onClose,
  onSubmit,
}: {
  error: string
  onClose: () => void
  onSubmit: (email: string, key: string, turnstileToken?: string) => void
}) {
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  // 渲染 Cloudflare Turnstile 人机验证小组件，拿到 token 后才允许登录
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const renderWidget = () => {
      const ts = (window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void } }).turnstile
      if (cancelled || !ts || !turnstileRef.current || turnstileWidgetId.current) {
        return
      }
      turnstileWidgetId.current = ts.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'error-callback': () => setTurnstileToken(''),
        'expired-callback': () => setTurnstileToken(''),
      })
    }
    if ((window as unknown as { turnstile?: unknown }).turnstile) {
      renderWidget()
    } else {
      timer = window.setInterval(() => {
        if ((window as unknown as { turnstile?: unknown }).turnstile) {
          window.clearInterval(timer)
          renderWidget()
        }
      }, 200)
    }
    return () => { cancelled = true; if (timer) window.clearInterval(timer) }
  }, [])

  const submit = async () => {
    if (!key.trim() || isSubmitting) {
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(email.trim(), key.trim(), turnstileToken)
      // 重置验证码：token 一次性，失败重试需要新 token（成功则弹窗已关闭，无影响）
      const ts = (window as unknown as { turnstile?: { reset: (id: string) => void } }).turnstile
      if (ts && turnstileWidgetId.current) {
        ts.reset(turnstileWidgetId.current)
        setTurnstileToken('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell className="admin-login-modal" labelledBy="admin-login-title" onClose={onClose}>
      <div className="login-atmosphere">
        <div className="login-pond" aria-hidden="true" />
        <button className="icon-button modal-close-button login-close" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="login-wordmark">
          <img className="brand-logo" src="/giverny-logo.png" alt="" />
          <strong>Giverny</strong>
          <span>让创作在自己的花园里生长</span>
        </div>
      </div>
      <header className="modal-header login-functional-header">
        <div>
          <h2 id="admin-login-title">登录后才能编辑</h2>
          <small>游客可直接浏览；新建、修改、上传、验收和结算需要管理员身份。</small>
        </div>
      </header>
      <div className="admin-login-body">
        <label className="lock-input">
          <Mail size={17} />
          <input value={email} placeholder="管理员邮箱（访问口令登录可留空）" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="lock-input">
          <Lock size={17} />
          <input
            type="password"
            value={key}
            placeholder="管理密码或访问口令"
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit()
              }
            }}
          />
        </label>
        <div ref={turnstileRef} className="login-turnstile" />
        {error && <p className="lock-error">{error}</p>}
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        <button className="primary-button" onClick={() => void submit()} disabled={!key.trim() || !turnstileToken || isSubmitting} title={!turnstileToken ? '请先完成人机验证' : undefined}>
          {isSubmitting ? '正在进入…' : '进入工作台'}
        </button>
      </footer>
    </ModalShell>
  )
}

function CreateTaskContextMenu({
  menu,
  onCreate,
}: {
  menu: { x: number; y: number }
  onCreate: () => void
}) {
  return (
    <div className="task-context-menu create-task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={onCreate}>
        <Plus size={15} />
        新建任务
      </button>
    </div>
  )
}

function TaskContextMenu({
  menu,
  onClose,
  onOpenTask,
  onOpenEditTask,
  onOpenAcceptance,
  onOpenProgress,
  onUpdateTask,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  canWrite,
  canDelete,
}: {
  menu: { x: number; y: number; task: Task }
  onClose: () => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  onOpenAcceptance: (task: Task) => void
  onOpenProgress: (task: Task) => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  const isVoided = Boolean(menu.task.voidedAt)
  const canRecordProgress = canRecordNewProgress(menu.task)
  const hasAcceptanceClosure = menu.task.status === '已验收' || hasAcceptanceProgress(menu.task)
  const progressOptions = [0, 20, 40, 60, 80, 100]
  const snappedProgress = taskDisplayProgress(menu.task)

  return (
    <div className="task-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onOpenTask(menu.task.id))}>
        <Eye size={15} />
        查看任务详情
      </button>
      {!isVoided && canWrite && (
        <>
          <button type="button" onClick={() => run(() => onOpenEditTask(menu.task.id))}>
            <Pencil size={15} />
            编辑任务
          </button>
          <button type="button" disabled={!canRecordProgress} title={canRecordProgress ? '记录进展' : menu.task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} onClick={() => run(() => onOpenProgress(menu.task))}>
            <BarChart3 size={15} />
            记录进展
          </button>
          <button type="button" disabled={menu.task.status !== '待验收'} onClick={() => run(() => onOpenAcceptance(menu.task))}>
            <ClipboardCheck size={15} />
            {menu.task.status === '待验收' ? '去验收' : '去验收（非待验收）'}
          </button>
        </>
      )}
      {!isVoided && canWrite && !hasAcceptanceClosure && (
        <div className="context-submenu">
          <button type="button" className="context-menu-parent" aria-haspopup="menu" disabled={!canRecordProgress} title={canRecordProgress ? '快速改进度' : '计划中进度保持为 0'}>
            <BarChart3 size={15} />
            快速改进度
            <span>{snappedProgress}%</span>
            <ChevronRight size={14} />
          </button>
          <div className="context-submenu-panel progress-submenu-panel" role="menu">
            {progressOptions.map((progress) => {
              const active = snappedProgress === progress
              return (
              <button type="button" key={progress} className={active ? 'selected' : ''} disabled={!canRecordProgress} onClick={() => run(() => onUpdateTask(menu.task.id, { progress }))}>
                {active ? <CheckCircle2 size={15} /> : <BarChart3 size={15} />}
                {progress}%
              </button>
              )
            })}
          </div>
        </div>
      )}
      {isVoided && canDelete && (
        <button type="button" onClick={() => run(() => onRestoreTask(menu.task.id))}>
          <RotateCcw size={15} />
          恢复任务
        </button>
      )}
      {canDelete && <div className="context-menu-separator" />}
      {canDelete && (isVoided ? (
        <button type="button" className="danger" onClick={() => run(() => onDeleteTask(menu.task.id))}>
          <Trash2 size={15} />
          永久删除
        </button>
      ) : (
        <button type="button" className="danger" onClick={() => run(() => onVoidTask(menu.task.id))}>
          <Trash2 size={15} />
          作废任务
        </button>
      ))}
    </div>
  )
}

function FileContextMenu({
  menu,
  onClose,
  onPreview,
  onOpen,
  onDownload,
  onFocusName,
  onFocusTag,
  onDelete,
  canWrite,
  canDelete,
}: {
  menu: { x: number; y: number; file: FileAsset }
  onClose: () => void
  onPreview: (file: FileAsset) => void
  onOpen: (file: FileAsset) => void
  onDownload: (file: FileAsset) => void
  onFocusName: (file: FileAsset) => void
  onFocusTag: (file: FileAsset) => void
  onDelete: (fileId: number) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div className="task-context-menu file-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onPreview(menu.file))}>
        <Eye size={15} />
        预览
      </button>
      <button type="button" onClick={() => run(() => onOpen(menu.file))}>
        <ExternalLink size={15} />
        打开原文件
      </button>
      {canWrite && <button type="button" onClick={() => run(() => onFocusName(menu.file))}>
        <Pencil size={15} />
        重命名
      </button>}
      {canWrite && <button type="button" onClick={() => run(() => onFocusTag(menu.file))}>
        <Tag size={15} />
        添加标签
      </button>}
      <button type="button" onClick={() => run(() => onDownload(menu.file))}>
        <Download size={15} />
        下载源文件
      </button>
      {canDelete && <div className="context-menu-separator" />}
      {canDelete && <button type="button" className="danger" onClick={() => run(() => onDelete(menu.file.id))}>
        <Trash2 size={15} />
        删除
      </button>}
    </div>
  )
}

function DashboardTaskSidebar({
  task,
  files,
  onPreviewFile,
  onUpdateTask,
  onOpenProgress,
  onDeleteEntry,
  onDeleteAcceptanceProgress,
  onOpenEdit,
  onOpenAcceptance,
  onAutoEstimateProgress,
  canWrite,
  canDelete,
}: {
  task: Task | undefined
  files: FileAsset[]
  onPreviewFile: (file: FileAsset) => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onOpenProgress: (taskId: number, mode?: ProgressRecordMode, editEntryId?: string, initialAcceptanceMode?: boolean) => void
  onDeleteEntry: (taskId: number, mode: ProgressRecordMode, entryId: string) => void
  onDeleteAcceptanceProgress: (taskId: number, entryId?: string) => void
  onOpenEdit: (taskId: number) => void
  onOpenAcceptance: (taskId: number) => void
  onAutoEstimateProgress?: (task: Task) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'progress'>('progress')
  const [expandedEntryNotes, setExpandedEntryNotes] = useState<Record<string, boolean>>({})
  const [progressUiState, setProgressUiState] = useState({
    taskId: 0,
    pane: 'progress' as ProgressRecordMode,
    expandedProgress: false,
    expandedFeedback: false,
    expandedWaiting: false,
  })

  // 查看「进展」且有带文字的进展记录时，自动让 AI 估算整体进度（内部按签名去重，不会重复调用）
  const taskId = task?.id
  const entriesSignature = (task?.timeEntries ?? [])
    .filter((entry) => (entry.note ?? '').trim())
    .map((entry) => `${entry.id}.${(entry.note ?? '').length}`)
    .join('|')
  useEffect(() => {
    if (!task || activeTab !== 'progress' || !onAutoEstimateProgress || !entriesSignature) {
      return
    }
    onAutoEstimateProgress(task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, activeTab, entriesSignature])

  if (!task) {
    return (
      <aside className="dashboard-task-sidebar">
        <div className="dashboard-task-sidebar-empty">
          <strong>选择一条任务</strong>
          <p>右侧会显示任务信息、进度、分段计时和等待记录。</p>
        </div>
      </aside>
    )
  }

  const timeEntries = task.timeEntries ?? []
  const waitingEntries = task.waitingEntries ?? []
  const actualMinutes = sumTimeEntries(timeEntries)
  const billableHours = actualMinutes > 0 ? actualMinutes / 60 : task.actualHours
  const waitingMinutes = sumWaitingEntries(task)
  const canAcceptTask = task.status === '待验收'
  const canRecordProgress = canRecordNewProgress(task)
  const demandPerson = task.requester || task.contact || '待确认'
  const snappedProgress = taskDisplayProgress(task)
  const displayedProgress = task.status === '计划中' ? 0 : snappedProgress
  const scopedProgressUiState = progressUiState.taskId === task.id
    ? progressUiState
    : { taskId: task.id, pane: 'progress' as ProgressRecordMode, expandedProgress: false, expandedFeedback: false, expandedWaiting: false }
  const progressPane = scopedProgressUiState.pane
  const expandedProgressEntries = scopedProgressUiState.expandedProgress
  const expandedFeedbackEntries = scopedProgressUiState.expandedFeedback
  const expandedWaitingEntries = scopedProgressUiState.expandedWaiting
  const setProgressPane = (pane: ProgressRecordMode) => {
    setProgressUiState({ taskId: task.id, pane, expandedProgress: false, expandedFeedback: false, expandedWaiting: false })
  }
  const toggleProgressEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedProgress: !scoped.expandedProgress }
    })
  }
  const toggleWaitingEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedWaiting: !scoped.expandedWaiting }
    })
  }
  const toggleFeedbackEntries = () => {
    setProgressUiState((current) => {
      const scoped = current.taskId === task.id ? current : scopedProgressUiState
      return { ...scoped, expandedFeedback: !scoped.expandedFeedback }
    })
  }
  const toggleEntryNote = (noteKey: string) => {
    setExpandedEntryNotes((current) => ({ ...current, [noteKey]: !current[noteKey] }))
  }
  const renderEntryNote = (noteKey: string, text: string) => {
    const expanded = Boolean(expandedEntryNotes[noteKey])
    return (
      <button
        type="button"
        className={`dashboard-side-entry-note ${expanded ? 'expanded' : ''}`}
        aria-expanded={expanded}
        title={expanded ? '点击收起备注' : '点击查看完整备注'}
        onClick={() => toggleEntryNote(noteKey)}
      >
        {text}
      </button>
    )
  }
  const sortedTimeEntries = sortTimeEntriesDesc(timeEntries)
  const sortedFeedbackEntries = sortedTimeEntries.filter((entry) => entry.isClientFeedback)
  const sortedWaitingEntries = sortTimeEntriesDesc(waitingEntries)
  const hasAcceptanceProgressEntry = sortedTimeEntries.some((entry) => entry.isAcceptanceProgress)
  const shouldShowAcceptanceSummary = task.status === '已验收' && !hasAcceptanceProgressEntry && Boolean(task.acceptanceNote?.trim() || (task.acceptanceFiles?.length ?? 0) > 0)
  const acceptanceSummaryFiles = shouldShowAcceptanceSummary
    ? files.filter((file) => file.taskId === task.id && file.scope === 'acceptance' && !file.deletedAt).slice(0, 6)
    : []
  const groupedTimeEntries = (() => {
    const groups: Array<{ primary: TimeEntry; siblings: TimeEntry[]; totalMinutes: number }> = []
    const seen = new Set<string>()
    for (const entry of sortedTimeEntries) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      if (entry.groupId) {
        const siblings = sortedTimeEntries.filter((e) => e.groupId === entry.groupId && e.id !== entry.id)
        siblings.forEach((s) => seen.add(s.id))
        groups.push({ primary: entry, siblings, totalMinutes: [entry, ...siblings].reduce((sum, e) => sum + minutesForTimeEntry(e), 0) })
      } else {
        groups.push({ primary: entry, siblings: [], totalMinutes: minutesForTimeEntry(entry) })
      }
    }
    return groups
  })()
  const shownGroups = expandedProgressEntries ? groupedTimeEntries : groupedTimeEntries.slice(0, 5)
  const shownFeedbackEntries = expandedFeedbackEntries ? sortedFeedbackEntries : sortedFeedbackEntries.slice(0, 5)
  const shownWaitingEntries = expandedWaitingEntries ? sortedWaitingEntries : sortedWaitingEntries.slice(0, 5)
  return (
    <aside className="dashboard-task-sidebar">
      <header className="dashboard-task-sidebar-header">
        <button
          type="button"
          className="dashboard-side-mobile-back"
          onClick={() => document.querySelector('.task-management-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <ChevronLeft size={15} />
          返回任务列表
        </button>
        <h2>{task.title}</h2>
        <p className="dashboard-task-sidebar-meta">
          <span>{formatMonthDayDash(task.date)}</span>
          <span>{task.type || '未分类'}</span>
          <span>需求人 {demandPerson}</span>
        </p>
      </header>

      <div className="dashboard-side-tabs" role="tablist" aria-label="任务侧栏">
        <button type="button" className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')} role="tab" aria-selected={activeTab === 'info'}>
          信息
        </button>
        <button type="button" className={activeTab === 'progress' ? 'active' : ''} onClick={() => setActiveTab('progress')} role="tab" aria-selected={activeTab === 'progress'}>
          进展
        </button>
      </div>

      {activeTab === 'info' ? (
        <section className="dashboard-side-section" role="tabpanel">
          <dl className="dashboard-side-info">
            <div>
              <dt>计划开始</dt>
              <dd>{task.date ? formatPlanDateTime(task.date) : '未设置'}</dd>
            </div>
            <div>
              <dt>预计交付</dt>
              <dd>{task.estimatedDate ? formatPlanDateTime(task.estimatedDate) : '未设置'}</dd>
            </div>
            <div>
              <dt>类型</dt>
              <dd>{task.type || '未填写'}</dd>
            </div>
            <div>
              <dt>需求人</dt>
              <dd>{demandPerson}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd><StatusDotLabel status={task.status} /></dd>
            </div>
            <div>
              <dt>结算</dt>
              <dd>
                {monthLabelOf(taskSettlementMonth(task))}
                {isSupplementalTask(task) ? <span className="supplement-inline">补录</span> : null}
              </dd>
            </div>
          </dl>
          {canWrite && <div className="dashboard-side-info-actions">
            {canAcceptTask && (
              <button type="button" className="ghost-button compact-button" onClick={() => onOpenAcceptance(task.id)}>
                去验收
              </button>
            )}
            <button type="button" className="ghost-button compact-button" onClick={() => onOpenEdit(task.id)}>
              <Pencil size={15} />
              编辑信息
            </button>
          </div>}
        </section>
      ) : (
        <section className="dashboard-side-section dashboard-side-progress-section" role="tabpanel">
          <div className="dashboard-side-progress">
            <div className="dashboard-side-progress-head">
              <span>整体进度</span>
              <strong>{displayedProgress}%</strong>
            </div>
            <div className="dashboard-side-progress-track">
              <span style={{ width: `${displayedProgress}%` }} />
            </div>
            <div className="dashboard-side-progress-scale">
              {[0, 20, 40, 60, 80, 100].map((value) => (
                <button
                  type="button"
                  className={displayedProgress === value ? 'active' : ''}
                  key={value}
                  aria-label={`设置进度为 ${value}%`}
                  aria-pressed={displayedProgress === value}
                  disabled={!canWrite || !canRecordProgress}
                  title={!canWrite ? '当前为只读访问' : canRecordProgress ? `设置进度为 ${value}%` : task.status === '计划中' ? '任务仍在计划中，进度保持为 0' : '任务已进入验收闭环，需先编辑或删除验收进展'}
                  onClick={() => onUpdateTask(task.id, { progress: value })}
                >
                  {value}%
                </button>
              ))}
            </div>
            {!canRecordProgress && (
              <p className="dashboard-side-muted dashboard-side-planned-note">
                {task.status === '计划中'
                  ? '任务仍在计划中。改为进行中后，才会开始记录真实进展、等待与生命周期。'
                  : '任务已进入验收闭环。如需继续记录，请先编辑或删除右侧的验收进展。'}
              </p>
            )}
          </div>

          <div className="dashboard-side-record-tabs" role="tablist" aria-label="进展记录类型">
            <button type="button" className={progressPane === 'progress' ? 'active' : ''} onClick={() => setProgressPane('progress')} role="tab" aria-selected={progressPane === 'progress'}>
              分段计时
            </button>
            <button type="button" className={progressPane === 'feedback' ? 'active' : ''} onClick={() => setProgressPane('feedback')} role="tab" aria-selected={progressPane === 'feedback'}>
              修改建议
            </button>
            <button type="button" className={progressPane === 'waiting' ? 'active' : ''} onClick={() => setProgressPane('waiting')} role="tab" aria-selected={progressPane === 'waiting'}>
              等待记录
            </button>
          </div>

          {progressPane === 'progress' ? (
            <div className="dashboard-side-subsection dashboard-side-record-pane" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>分段计时</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} onClick={() => onOpenProgress(task.id, 'progress')}>
                  <Plus size={15} />
                  记录进展
                </button>}
              </div>
              <p className="dashboard-side-subsection-meta">可结算 · {timeEntries.filter((entry) => !entry.isClientFeedback).length} 段 · {billableHours.toFixed(1)}h</p>
              {timeEntries.length === 0 && !shouldShowAcceptanceSummary ? (
                <p className="dashboard-side-muted">暂无分段计时；点击记录进展后添加。</p>
              ) : (
                <>
                  <div className="dashboard-side-timeline">
                    {shouldShowAcceptanceSummary && (
                      <article className="dashboard-side-time-item dashboard-side-acceptance-item">
                        <span className="dot" />
                        {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                          {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'progress', undefined, true)}>编辑</button>}
                          {canDelete && <button type="button" className="danger" onClick={() => onDeleteAcceptanceProgress(task.id)}>删除</button>}
                        </div>}
                        <div className="dashboard-side-entry-time-row">
                          <time>{task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : formatPlanDateTime(isoDateTime())}</time>
                          <span className="progress-entry-tag acceptance">验收进展</span>
                        </div>
                        {renderEntryNote(`${task.id}:acceptance-summary`, task.acceptanceNote?.trim() || '已完成验收确认。')}
                        <em>不新增计时 · 已进入验收闭环</em>
                        {acceptanceSummaryFiles.length > 0 && (
                          <div className="dashboard-side-entry-files" aria-label="验收附件">
                            {acceptanceSummaryFiles.map((file) => {
                              const fileType = fileTypeForAsset(file).type
                              const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                              const documentSourceUrl = fileThumbnailSource(file)
                              return (
                                <AttachmentHoverThumbnail
                                  key={file.id}
                                  name={file.name}
                                  type={fileType}
                                  previewUrl={previewUrl}
                                  sourceUrl={documentSourceUrl}
                                  compact
                                  onOpen={() => onPreviewFile(file)}
                                />
                              )
                            })}
                          </div>
                        )}
                      </article>
                    )}
                    {shownGroups.map(({ primary: entry, siblings, totalMinutes }) => {
                      const isGrouped = siblings.length > 0
                      const displayMinutes = isGrouped ? totalMinutes : minutesForTimeEntry(entry)
                      const acceptanceFileNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))
                      const groupEntryIds = new Set([entry.id, ...siblings.map((s) => s.id)])
                      const entryFiles = files.filter((file) => {
                        if (file.taskId !== task.id || file.deletedAt) {
                          return false
                        }
                        if (groupEntryIds.has(file.entryId ?? '')) {
                          return true
                        }
                        return entry.isAcceptanceProgress && isAcceptanceFileAsset(file, acceptanceFileNames) && (!file.entryId || acceptanceFileNames.has(file.name.trim()))
                      })
                      const entryNote = entry.isAcceptanceProgress ? (task.acceptanceNote?.trim() || entry.note || '已完成验收确认。') : (entry.note || '未填写具体内容')
                      const hasAcceptanceFiles = entryFiles.some((file) => isAcceptanceFileAsset(file, acceptanceFileNames))
                      return (
                        <article className="dashboard-side-time-item" key={entry.id}>
                          <span className="dot" />
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'progress', entry.id)}>编辑</button>}
                            {canDelete && <button
                              type="button"
                              className="danger"
                              onClick={() => entry.isAcceptanceProgress
                                ? onDeleteAcceptanceProgress(task.id, entry.id)
                                : onDeleteEntry(task.id, 'progress', entry.id)}
                            >
                              删除
                            </button>}
                          </div>}
                          <div className="dashboard-side-entry-time-row">
                            <time>{formatEntryDateTimeRange(task, entry)}</time>
                            {isGrouped && siblings.map((sib) => (
                              <span key={sib.id} className="progress-group-inline-sib">
                                <span className="progress-group-inline-sep">·</span>
                                <span className="progress-group-inline-time">{sib.start}–{sib.end}</span>
                                {canWrite && <button type="button" className="progress-group-sibling-edit" onClick={() => onOpenProgress(task.id, 'progress', sib.id)} aria-label="编辑此段"><Pencil size={10} /></button>}
                              </span>
                            ))}
                            {entry.isAcceptanceProgress && <span className="progress-entry-tag acceptance">验收进展</span>}
                            {entry.isClientFeedback && <span className="progress-entry-tag client-feedback">甲方反馈</span>}
                            {entry.feedbackVersion && <span className="progress-entry-tag feedback-version">{entry.feedbackVersion}</span>}
                            {hasAcceptanceFiles && <span className="progress-entry-tag acceptance-file">验收文件</span>}
                          </div>
                          {renderEntryNote(`${task.id}:progress:${entry.id}`, entryNote)}
                          {entry.isClientFeedback && (
                            <p className="dashboard-side-entry-meta">
                              {entry.feedbackSource || '甲方'}反馈{entry.isRevision ? ' · 计入改稿轮次' : ''}
                            </p>
                          )}
                          <em className={`progress-time-pill ${displayMinutes > 0 ? '' : 'is-uncounted'}`}>{displayMinutes > 0 ? `计时 ${formatSignedHours(displayMinutes)}` : '不计工时'}</em>
                          {entryFiles.length > 0 && (
                            <div className="dashboard-side-entry-files" aria-label="本段进展附件">
                              {entryFiles.map((file) => {
                                const fileType = fileTypeForAsset(file).type
                                const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                                const documentSourceUrl = fileThumbnailSource(file)
                                return (
                                  <AttachmentHoverThumbnail
                                    key={file.id}
                                    name={file.name}
                                    type={fileType}
                                    previewUrl={previewUrl}
                                    sourceUrl={documentSourceUrl}
                                    compact
                                    onOpen={() => onPreviewFile(file)}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {groupedTimeEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleProgressEntries}>
                      {expandedProgressEntries ? '收起记录' : `展开 ${groupedTimeEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : progressPane === 'feedback' ? (
            <div className="dashboard-side-subsection dashboard-side-record-pane dashboard-side-feedback" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>修改建议</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? '记录甲方反馈 / 修改意见' : '改为进行中后可记录反馈'} onClick={() => onOpenProgress(task.id, 'feedback')}>
                  <Plus size={15} />
                  记录反馈
                </button>}
              </div>
              <p className="dashboard-side-subsection-meta">用于追溯 B01 / B02 等每轮修改意见，默认不计工时。</p>
              {sortedFeedbackEntries.length === 0 ? (
                <p className="dashboard-side-muted">暂无甲方反馈；收到批注、聊天截图或版本意见时可单独记录。</p>
              ) : (
                <>
                  <div className="dashboard-side-timeline">
                    {shownFeedbackEntries.map((entry) => {
                      const entryFiles = files.filter((file) => file.taskId === task.id && !file.deletedAt && file.entryId === entry.id)
                      return (
                        <article className="dashboard-side-time-item dashboard-side-feedback-item" key={entry.id}>
                          <span className="dot" />
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'feedback', entry.id)}>编辑</button>}
                            {canDelete && <button type="button" className="danger" onClick={() => onDeleteEntry(task.id, 'feedback', entry.id)}>删除</button>}
                          </div>}
                          <div className="dashboard-side-entry-time-row">
                            <time>{formatEntryDateTimeRange(task, entry)}</time>
                            <span className="progress-entry-tag client-feedback">甲方反馈</span>
                            {entry.feedbackVersion && <span className="progress-entry-tag feedback-version">{entry.feedbackVersion}</span>}
                          </div>
                          {renderEntryNote(`${task.id}:feedback:${entry.id}`, entry.note || '未填写修改意见')}
                          <p className="dashboard-side-entry-meta">{entry.feedbackSource || '甲方'}反馈{entry.isRevision ? ' · 计入改稿轮次' : ''}</p>
                          <em className="progress-time-pill is-uncounted">不计工时</em>
                          {entryFiles.length > 0 && (
                            <div className="dashboard-side-entry-files" aria-label="反馈附件">
                              {entryFiles.map((file) => {
                                const fileType = fileTypeForAsset(file).type
                                const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                                const documentSourceUrl = fileThumbnailSource(file)
                                return (
                                  <AttachmentHoverThumbnail
                                    key={file.id}
                                    name={file.name}
                                    type={fileType}
                                    previewUrl={previewUrl}
                                    sourceUrl={documentSourceUrl}
                                    compact
                                    onOpen={() => onPreviewFile(file)}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                  {sortedFeedbackEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleFeedbackEntries}>
                      {expandedFeedbackEntries ? '收起记录' : `展开 ${sortedFeedbackEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="dashboard-side-subsection dashboard-side-record-pane dashboard-side-waiting" role="tabpanel">
              <div className="dashboard-side-subsection-title">
                <span>等待记录</span>
                {canWrite && <button type="button" className="text-button dashboard-side-action" disabled={!canRecordProgress} title={canRecordProgress ? '记录等待' : '改为进行中后可记录等待'} onClick={() => onOpenProgress(task.id, 'waiting')}>
                  <Plus size={15} />
                  记录等待
                </button>}
              </div>
              {waitingMinutes > 0 && <p className="dashboard-side-subsection-meta">等待合计 {(waitingMinutes / 60).toFixed(1)}h · 仅进入洞察分析</p>}
              {waitingEntries.length === 0 ? (
                <p className="dashboard-side-muted">暂无等待记录；等待甲方意见、补资料或确认时可单独记录。</p>
              ) : (
                <>
                  <div className="dashboard-side-waiting-list">
                    {shownWaitingEntries.map((entry) => {
                      const minutes = minutesForWaitingEntry(task, entry)
                      return (
                        <article className="dashboard-side-waiting-item" key={entry.id}>
                          {(canWrite || canDelete) && <div className="dashboard-side-entry-actions">
                            {canWrite && <button type="button" onClick={() => onOpenProgress(task.id, 'waiting', entry.id)}>编辑</button>}
                            {canDelete && <button type="button" className="danger" onClick={() => onDeleteEntry(task.id, 'waiting', entry.id)}>删除</button>}
                          </div>}
                          <time>{formatWaitingEntryDateTimeRange(task, entry)}</time>
                          {renderEntryNote(`${task.id}:waiting:${entry.id}`, entry.note || entry.reason || '等待甲方确认')}
                          <em>{minutes > 0 ? `等待 ${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h` : '等待中'} · 不计结算</em>
                        </article>
                      )
                    })}
                  </div>
                  {waitingEntries.length > 5 && (
                    <button type="button" className="dashboard-side-expand" onClick={toggleWaitingEntries}>
                      {expandedWaitingEntries ? '收起记录' : `展开 ${waitingEntries.length - 5} 条`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </aside>
  )
}

function TasksView({
  viewMode,
  onViewModeChange,
  calendarMode,
  calendarFocusDate,
  onCalendarFocusDateChange,
  monthValue,
  onMonthChange,
  designTypeGroups,
  activeMonthTasks,
  selectedTask,
  tasks,
  contextInsights,
  taskFilter,
  taskQuery,
  showVoidedTasks,
  voidedTaskCount,
  onUploadAcceptanceFile,
  onFilterChange,
  onQueryChange,
  onShowVoidedChange,
  onSelectTask,
  onUpdateTask,
  onVoidTask,
  onRestoreTask,
  onDeleteTask,
  onDeleteEntry,
  onDeleteAcceptanceProgress,
  onOpenTask,
  onOpenEditTask,
  files,
  onPreviewFile,
  activity,
  hourlyRate,
  onUploadImage,
  onUpdateFile,
  onDeleteFile,
  onConfirmAcceptance,
  onCreateTaskUpdate,
  onCreateTask,
  rowThemeOn,
  onAutoEstimateProgress,
  canWrite,
  canDelete,
  detailCollapsed,
  onToggleDetail,
}: {
  viewMode: TaskViewMode
  onViewModeChange: (mode: TaskViewMode) => void
  calendarMode: CalendarDisplayMode
  calendarFocusDate: string
  onCalendarFocusDateChange: (value: string) => void
  monthValue: string
  onMonthChange: (month: string) => void
  designTypeGroups: DesignTypeGroup[]
  activeMonthTasks: Task[]
  selectedTask: Task | undefined
  tasks: Task[]
  contextInsights: Map<number, TaskContextInsight>
  taskFilter: TaskFilter
  taskQuery: string
  showVoidedTasks: boolean
  voidedTaskCount: number
  onUploadAcceptanceFile: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<FileAsset>
  onFilterChange: (filter: TaskFilter) => void
  onQueryChange: (query: string) => void
  onShowVoidedChange: (value: boolean) => void
  onSelectTask: (id: number) => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onVoidTask: (taskId: number) => void
  onRestoreTask: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
  onDeleteEntry: (taskId: number, mode: ProgressRecordMode, entryId: string) => void
  onDeleteAcceptanceProgress: (taskId: number, entryId?: string) => void
  onOpenTask: (taskId: number) => void
  onOpenEditTask: (taskId: number) => void
  files: FileAsset[]
  onPreviewFile: (file: FileAsset) => void
  activity: ActivityItem[]
  hourlyRate: number
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<void>
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  onDeleteFile: (fileId: number) => void
  onConfirmAcceptance?: (task: Task, payload: AcceptancePayload) => void
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onCreateTask: () => void
  onAutoEstimateProgress?: (task: Task) => void
  canWrite: boolean
  canDelete: boolean
  detailCollapsed: boolean
  onToggleDetail: () => void
  rowThemeOn: boolean
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number } | null>(null)
  const [progressTarget, setProgressTarget] = useState<{ task: Task; mode?: ProgressRecordMode; editEntryId?: string; initialAcceptanceMode?: boolean } | null>(null)
  const viewTabs = (
    <div className="view-mode-tabs" aria-label="任务视图切换">
      <button className={viewMode === '列表' ? 'active' : ''} aria-pressed={viewMode === '列表'} title="切换到列表视图" onClick={() => onViewModeChange('列表')}>
        <List size={15} />
        列表视图
      </button>
      <button className={viewMode === '日历' ? 'active' : ''} aria-pressed={viewMode === '日历'} title="切换到日历视图" onClick={() => onViewModeChange('日历')}>
        <CalendarDays size={15} />
        日历视图
      </button>
    </div>
  )

  useEffect(() => {
    if (!contextMenu && !createMenu) {
      return
    }
    const closeMenu = () => {
      setContextMenu(null)
      setCreateMenu(null)
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
  }, [contextMenu, createMenu])

  const openContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault()
    setCreateMenu(null)
    onSelectTask(task.id)
    setContextMenu({ x: event.clientX, y: event.clientY, task })
  }

  const openCreateMenu = (event: React.MouseEvent) => {
    if (!canWrite || !isTaskListBlankContextTarget(event.target)) {
      return
    }
    event.preventDefault()
    setContextMenu(null)
    setCreateMenu({ x: event.clientX, y: event.clientY })
  }

  const createTaskFromMenu = () => {
    setCreateMenu(null)
    onCreateTask()
  }

  const openAcceptance = (task: Task) => {
    onSelectTask(task.id)
    setProgressTarget({ task, mode: 'progress', initialAcceptanceMode: true })
  }

  const openProgress = (task: Task, mode?: ProgressRecordMode, editEntryId?: string, initialAcceptanceMode = false) => {
    if (!editEntryId && !initialAcceptanceMode && !isTaskStarted(task)) {
      return
    }
    if ((mode ?? 'progress') === 'progress' && !editEntryId && !initialAcceptanceMode && !canRecordNewProgress(task)) {
      return
    }
    onSelectTask(task.id)
    setProgressTarget({ task, mode, editEntryId, initialAcceptanceMode })
  }

  const selectTaskAndReveal = (taskId: number) => {
    onSelectTask(taskId)
    if (window.matchMedia('(max-width: 680px)').matches) {
      if (detailCollapsed) {
        onToggleDetail()
      }
      window.setTimeout(() => {
        document.querySelector('.management-grid .dashboard-task-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, detailCollapsed ? 80 : 0)
    }
  }

  if (viewMode === '日历') {
    return (
      <section className="view-stack">
        <section className="panel view-toolbar">
          <div className="panel-header compact">
            <div>
              <h2>任务日历</h2>
              <p>按日期查看已完成与待完成任务，点击日期查看当天安排</p>
            </div>
            <div className="panel-tools calendar-toolbar-actions">
              {viewTabs}
            </div>
          </div>
        </section>
        <CalendarView
          key={monthValue}
          monthValue={monthValue}
          mode={calendarMode}
          focusDate={calendarFocusDate}
          designTypeGroups={designTypeGroups}
          tasks={tasks}
          onOpenTask={onOpenTask}
          onFocusDateChange={onCalendarFocusDateChange}
          onMonthChange={onMonthChange}
        />
      </section>
    )
  }

return (
    <section className="view-stack task-create-context-surface" onContextMenu={openCreateMenu}>
      <section className="panel view-toolbar">
        <div className="panel-header compact task-panel-header">
          <div>
            <h2>任务管理</h2>
            <p>集中维护任务字段、验收状态、工时与交付文件</p>
          </div>
          <TaskSearchBox
            value={taskQuery}
            onChange={onQueryChange}
            placeholder="搜索任务、需求、需求人"
            className="task-search-inline"
          />
          {viewTabs}
        </div>
        <div className="task-toolbar-row">
          <div className="segment-tabs">
            {taskFilters.map((filter) => (
              <button className={taskFilter === filter ? 'active' : ''} aria-pressed={taskFilter === filter} key={filter} onClick={() => onFilterChange(filter)}>
                {filter === '全部' ? '全部任务' : filter}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`voided-toggle ${showVoidedTasks ? 'active' : ''}`}
            onClick={() => {
              const nextValue = !showVoidedTasks
              onShowVoidedChange(nextValue)
              if (nextValue) {
                onFilterChange('全部')
              }
            }}
            title="作废任务默认隐藏，不参与统计、月报和工时"
          >
            <Archive size={15} />
            {showVoidedTasks ? '隐藏作废' : `显示作废${voidedTaskCount ? ` ${voidedTaskCount}` : ''}`}
          </button>
        </div>
        <ActiveTaskFilters
          query={taskQuery}
          filter={taskFilter}
          onClearQuery={() => onQueryChange('')}
          onClearFilter={() => onFilterChange('全部')}
        />
      </section>

      <section className={`management-grid ${detailCollapsed ? 'detail-collapsed' : ''}`}>
        <div className={`panel task-management-list ${rowThemeOn ? '' : 'no-row-theme'}`}>
          <div className="management-list-toolbar">
            <span>共 {tasks.length} 条</span>
            <div className="management-list-toolbar-end">
              <button
                type="button"
                className="detail-pane-toggle"
                aria-pressed={!detailCollapsed}
                title={detailCollapsed ? '显示任务详情' : '收起任务详情'}
                onClick={onToggleDetail}
              >
                {detailCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                {detailCollapsed ? '显示详情' : '收起详情'}
              </button>
            </div>
          </div>
          <div className="table-head">
            <span>日期</span>
            <span>任务 · 预计时间</span>
            <span>对接 · 工时</span>
            <span>状态 · 交付</span>
          </div>
          {tasks.map((task) => {
            const dueState = taskDueState(task, isoDate(), isoDate(3))
            const dueDateLabel = formatDueDateCompact(task.estimatedDate || task.date)
            const scheduleSignal = formatTaskScheduleSignal(task)
            const canAcceptTask = task.status === '待验收'
            const canRecordProgress = canRecordNewProgress(task)
            const contextInsight = contextInsights.get(task.id)
            return (
            <article
              className={`task-row management-row ${selectedTask?.id === task.id ? 'selected' : ''} ${task.voidedAt ? 'voided' : ''} ${isSupplementalTask(task) ? 'supplemental' : ''}`}
              data-status={task.status}
              data-due={dueState || undefined}
              key={task.id}
              role="button"
              aria-pressed={selectedTask?.id === task.id}
              tabIndex={0}
              onClick={() => {
                selectTaskAndReveal(task.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectTaskAndReveal(task.id)
                }
              }}
              onContextMenu={(event) => openContextMenu(event, task)}
            >
              <div className="task-date">
                <b>{formatMonthDay(task.date)}</b>
                <span className="task-date-meta">
                  {formatTimePart(task.date) && <span>{formatTimePart(task.date)}</span>}
                  <em>{task.type || '未分类'}</em>
                  {isSupplementalTask(task) && (
                    <em className="task-inline-supplement" title={`补录至 ${monthLabelOf(taskSettlementMonth(task))}`}>
                      补录
                    </em>
                  )}
                </span>
              </div>
              <div className="task-main">
                <strong>{task.title}</strong>
                <p>{task.requirement}{task.voidedAt ? ` · 已作废${task.voidReason ? `：${task.voidReason}` : ''}` : ''}</p>
                <div className={`task-schedule-row ${task.status === '已验收' ? 'done' : ''}`}>
                  <span className="time-chip">
                    <span>开始</span>
                    <strong>{formatTaskRowDateTime(task.date)}</strong>
                  </span>
                  <span className="time-chip">
                    <span>交付</span>
                    <strong>{formatTaskRowDateTime(task.estimatedDate || task.date)}</strong>
                  </span>
                  {task.status !== '已验收' && (
                    <span className={`schedule-countdown ${scheduleSignal.tone}`}>{scheduleSignal.label}</span>
                  )}
                  <TaskContextInsightBadge insight={contextInsight} />
                </div>
              </div>
              <div className="task-meta">
                <b>{task.requester || task.contact || '待确认'}</b>
                <span>
                  实际 <strong>{task.actualHours.toFixed(1)}h</strong>
                </span>
              </div>
              <div className="task-row-end">
                <div className="task-state">
                  <div className="task-state-badges">
                    {task.voidedAt && <span className="voided-tag">作废</span>}
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
                  <span className="task-row-due">{dueDateLabel}</span>
                  <button type="button" className="icon-button" title="编辑任务" aria-label="编辑任务" onClick={(event) => { event.stopPropagation(); onOpenEditTask(task.id) }}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-button" title={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} aria-label={canRecordProgress ? '记录进展' : task.status === '计划中' ? '改为进行中后可记录进展' : '已进入验收闭环，需先编辑或删除验收进展'} disabled={!canRecordProgress} onClick={(event) => { event.stopPropagation(); openProgress(task) }}>
                    <BarChart3 size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title={canAcceptTask ? '去验收' : '当前不是待验收'}
                    aria-label={canAcceptTask ? '去验收' : '当前不是待验收'}
                    disabled={!canAcceptTask}
                    onClick={(event) => { event.stopPropagation(); openAcceptance(task) }}
                  >
                    <ClipboardCheck size={15} />
                  </button>
                </div>}
              </div>
            </article>
            )
          })}
          {tasks.length === 0 && (
            <div className="empty-state" role="status">
              <strong>{activeMonthTasks.length === 0 ? '这个月还没有任务' : '没有找到匹配任务'}</strong>
              <p>{activeMonthTasks.length === 0 ? '新建任务后，可以通过双击或右键菜单管理任务。' : '换一个关键词或状态筛选试试。'}</p>
              {canWrite && activeMonthTasks.length === 0 ? (
                <button className="ghost-button compact-button empty-state-action" onClick={onCreateTask}>
                  <Plus size={15} />
                  新建任务
                </button>
              ) : activeMonthTasks.length > 0 ? (
                <button className="ghost-button compact-button empty-state-action" onClick={() => { onQueryChange(''); onFilterChange('全部') }}>
                  <RotateCcw size={15} />
                  清除筛选
                </button>
              ) : null}
            </div>
          )}
          <div className="task-schedule-legend" aria-label="排期状态说明">
            <span><i className="imminent" />临期：今日 / 明日到期</span>
            <span><i className="overdue" />逾期：超过交付日</span>
            <span><i className="started" />进行中：距交付倒计时</span>
            <span><i className="normal" />正常 / 已验收：灰显</span>
          </div>
          {contextMenu && (
            <TaskContextMenu
              menu={contextMenu}
              onClose={() => setContextMenu(null)}
              onOpenTask={onOpenTask}
              onOpenEditTask={onOpenEditTask}
              onOpenAcceptance={openAcceptance}
              onOpenProgress={openProgress}
              onUpdateTask={onUpdateTask}
              onVoidTask={onVoidTask}
              onRestoreTask={onRestoreTask}
              onDeleteTask={onDeleteTask}
              canWrite={canWrite}
              canDelete={canDelete}
            />
          )}
          {canWrite && createMenu && (
            <CreateTaskContextMenu
              menu={createMenu}
              onCreate={createTaskFromMenu}
            />
          )}
        </div>
        {!detailCollapsed && <DashboardTaskSidebar
          task={selectedTask}
          files={files}
          onPreviewFile={onPreviewFile}
          onUpdateTask={onUpdateTask}
          onOpenProgress={(taskId, mode, editEntryId, initialAcceptanceMode) => {
            const task = tasks.find((item) => item.id === taskId)
            if (task) {
              openProgress(task, mode, editEntryId, initialAcceptanceMode)
            }
          }}
          onDeleteEntry={onDeleteEntry}
          onDeleteAcceptanceProgress={onDeleteAcceptanceProgress}
          onOpenEdit={onOpenEditTask}
          onOpenAcceptance={(taskId) => {
            const task = tasks.find((item) => item.id === taskId)
            if (task) {
              openAcceptance(task)
            }
          }}
          onAutoEstimateProgress={onAutoEstimateProgress}
          canWrite={canWrite}
          canDelete={canDelete}
        />}
      </section>
      {progressTarget && (
        <TaskProgressModal
          task={tasks.find((task) => task.id === progressTarget.task.id) ?? progressTarget.task}
          mode={progressTarget.mode}
          editEntryId={progressTarget.editEntryId}
          files={files}
          activity={activity}
          onClose={() => setProgressTarget(null)}
          onUpdateTask={onUpdateTask}
          onCreateTaskUpdate={onCreateTaskUpdate}
          onUploadImage={onUploadImage}
          onPreviewFile={onPreviewFile}
          onUpdateFile={onUpdateFile}
          onDeleteFile={onDeleteFile}
          onConfirmAcceptance={onConfirmAcceptance}
          onUploadAcceptanceFile={onUploadAcceptanceFile}
          initialAcceptanceMode={progressTarget.initialAcceptanceMode}
          hourlyRate={hourlyRate}
        />
      )}
    </section>
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
  initialAcceptanceMode = false,
  hourlyRate = 0,
}: {
  task: Task
  mode?: ProgressRecordMode
  editEntryId?: string
  files: FileAsset[]
  activity: ActivityItem[]
  onClose: () => void
  onUpdateTask: (taskId: number, changes: TaskUpdateChanges) => void
  onCreateTaskUpdate: (taskId: number, update: { title: string; body: string; hours: number; visible: boolean }) => Promise<void>
  onUploadImage: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<void>
  onPreviewFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string; scope?: 'acceptance' | 'progress' }) => Promise<FileAsset>
  onDeleteFile: (fileId: number) => void
  onConfirmAcceptance?: (task: Task, payload: AcceptancePayload) => void
  onUploadAcceptanceFile?: (taskId: number, file: File, onProgress?: (ratio: number) => void, entryId?: string) => Promise<FileAsset>
  initialAcceptanceMode?: boolean
  hourlyRate?: number
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const replacementInputRef = useRef<HTMLInputElement | null>(null)
  const existingReplacementInputRef = useRef<HTMLInputElement | null>(null)
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
  const [feedbackSource, setFeedbackSource] = useState(editingEntry?.feedbackSource ?? '甲方')
  const [isAcceptanceBaseExpanded, setIsAcceptanceBaseExpanded] = useState(false)
  const acceptanceBaseRef = useRef<HTMLElement | null>(null)
  const [feedbackRating, setFeedbackRating] = useState<TaskFeedbackRating | ''>(initialProgressDraft.feedbackRating ?? '')
  const [feedbackTags, setFeedbackTags] = useState<TaskFeedbackTag[]>(initialProgressDraft.feedbackTags ?? [])
  const [feedbackNote, setFeedbackNote] = useState(initialProgressDraft.feedbackNote ?? '')
  const [progressAiSuggestion, setProgressAiSuggestion] = useState<TextAssistantSuggestion | null>(null)
  const [progressAiError, setProgressAiError] = useState('')
  const [isProgressAiLoading, setIsProgressAiLoading] = useState(false)
  const progressAiSuggestionAppliedRef = useRef<{ context: TextLearningContext; aiOutput: string } | null>(null)
  const pendingAttachmentAiNameAppliedRef = useRef<Record<string, string>>({})
  const existingAttachmentAiNameAppliedRef = useRef<Record<number, string>>({})
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
        feedbackSource: feedbackSource.trim() || '甲方',
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
    const acceptance = isAcceptanceMode
    const uploadFile = acceptance
      ? renamedFile(attachment.file, attachment.name)
      : await compressProgressImageFile(renamedFile(attachment.file, attachment.name))
    const extension = fileTypeForFile(uploadFile).type
    const preview = await createOptionalPreviewFile(uploadFile)
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

  // 移除某个待上传附件：若已传到后台则顺手删除，避免产生孤儿文件。
  const discardStagedFile = (fileId?: number) => {
    if (typeof fileId === 'number') {
      void api.deleteFile(fileId).catch(() => {})
    }
  }

  // 保存时才上传，避免用户关闭弹窗后在 R2/D1 留下未关联的暂存文件。
  const finalizeStagedAttachments = async (): Promise<{ names: string[]; failures: string[] }> => {
    const names: string[] = []
    const failures: string[] = []
    for (const attachment of pendingAttachments) {
      let saved = attachment.uploadedFile
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
        })
      } catch (error) {
        nextErrors.push(error instanceof Error ? error.message : `${file.name}：文件无法添加`)
      }
    })
    if (nextAttachments.length > 0) {
      setPendingAttachments((current) => [...current, ...nextAttachments])
      nextAttachments.forEach((attachment) => {
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
      }
      setPendingAttachments((current) => current.map((attachment) =>
        attachment.id === replacementAttachmentId ? replaced : attachment,
      ))
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
        imageBase64: await imageFileBase64(attachment.file),
        note,
        recentFileNames: files.filter((file) => file.taskId === task.id).map((file) => file.name).slice(-12),
        task,
      })
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId ? { ...item, aiLoading: false, aiSuggestion: suggestion } : item,
      ))
    } catch (error) {
      setPendingAttachments((current) => current.map((item) =>
        item.id === attachmentId
          ? { ...item, aiLoading: false, aiError: error instanceof Error ? error.message : 'AI 命名暂时不可用' }
          : item,
      ))
    }
  }

  const saveExistingAttachmentName = async (file: FileAsset) => {
    const draftName = existingAttachmentDrafts[file.id] ?? file.name
    const nextName = sanitizeAttachmentName(draftName, file.name)
    setExistingAttachmentDrafts((current) => ({ ...current, [file.id]: nextName }))
    const appliedName = existingAttachmentAiNameAppliedRef.current[file.id]?.trim() ?? ''
    if (appliedName && nextName && nextName !== appliedName) {
      void api.recordTextEditPair({
        context: 'attachment_name',
        aiOutput: appliedName,
        userFinal: nextName,
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
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, suggestion },
      }))
    } catch (error) {
      setExistingAttachmentAiState((current) => ({
        ...current,
        [file.id]: { loading: false, error: error instanceof Error ? error.message : 'AI 命名暂时不可用' },
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
    if (!applied || !userFinal || !aiOutput || userFinal === aiOutput) {
      return
    }
    void api.recordTextEditPair({
      context: applied.context,
      aiOutput,
      userFinal,
      designType: task.type,
      taskId: task.id,
      taskTitle: task.title,
    })
    progressAiSuggestionAppliedRef.current = null
  }

  const recordAppliedAttachmentNameLearning = () => {
    pendingAttachments.forEach((attachment) => {
      const aiOutput = pendingAttachmentAiNameAppliedRef.current[attachment.id]?.trim() ?? ''
      const userFinal = sanitizeAttachmentName(attachment.name, attachment.originalName)
      if (aiOutput && userFinal && userFinal !== aiOutput) {
        void api.recordTextEditPair({
          context: 'attachment_name',
          aiOutput,
          userFinal,
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
  const acceptanceWaitingMinutes = sumWaitingEntries(acceptanceWaitingPreviewTask)
  const acceptanceEstimatedAmount = roundCents(acceptanceLockedHours * hourlyRate)
  const canConfirmAcceptance = (acceptanceLockedHours > 0 || isAcceptanceRevisionMode || !countAcceptanceTime) && !isSaving && Boolean(onConfirmAcceptance) && !hasAnotherAcceptanceProgress && (!countAcceptanceTime || !draftConflict)
  const progressHeaderHint = isAcceptanceMode
    ? ''
    : isWaitingMode
      ? '记录非工作的等待开始时间，仅用于洞察分析，不计入结算工时'
      : isFeedbackMode
        ? '记录甲方给出的版本反馈、批注意见或聊天截图，默认不计工时但进入生命周期'
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
    setIsSaving(true)
    setTimeEntryError('')
    try {
      const shouldKeepAcceptanceProgress = isEditingAcceptanceEntry && isAcceptanceMode
      const shouldAllowAcceptedTimeEdit = isEditingAcceptanceEntry && task.status === '已验收'
      const nextEntry = buildDraftTimeEntry({ isAcceptanceProgress: shouldKeepAcceptanceProgress })
      // 0 时长进展不占时间段，跳过重叠校验
      if (nextEntry && minutesForTimeEntry(nextEntry) > 0) {
        const conflict = comparableEntries.find((entry) => timeEntriesOverlap(nextEntry, entry))
        if (conflict) {
          setTimeEntryError(`这个时间段和 ${formatEntryDateTimeRange(task, conflict)} 已有记录重叠，请改到前后相邻的空档。`)
          return
        }
      }
      await saveDirtyExistingAttachmentNames()
      await demoteRollbackAcceptanceAttachments()
      // 附件在保存时上传，避免取消表单留下孤儿文件。
      const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
      if (uploadFailures.length > 0) {
        setUploadErrors(uploadFailures)
        return
      }
      recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
      recordAppliedAttachmentNameLearning()
      const planScheduleChanges = buildPlanScheduleChanges()
      const hasPlanScheduleChanges = Object.keys(planScheduleChanges).length > 0
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
      if (!isWaitingMode && (timeDirty || nextEntry || pendingExtraSegments.length > 0)) {
        const nextActualHours = Math.round((sumTimeEntries(nextTimeEntries) / 60) * 100) / 100
        onUpdateTask(task.id, {
          ...planScheduleChanges,
          timeEntries: nextTimeEntries,
          actualHours: nextActualHours,
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
        onUpdateTask(task.id, planScheduleChanges)
      }
      if (isWaitingMode && (waitingDirty || nextEntry)) {
        onUpdateTask(task.id, { waitingEntries: nextWaitingEntries })
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
        onUpdateTask(task.id, {
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
              : (isWaitingMode ? '等待记录' : isFeedbackMode ? '甲方反馈' : '进展更新'),
          body: body || `上传过程附件：${finalizedUploadedNames.join('、')}`,
          hours: 0,
          visible: false,
        })
      }
      clearDraftCache(progressDraftKey)
      progressAttachmentDraftCache.delete(progressDraftKey)
      stagedEntryIdCache.delete(progressDraftKey)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  // 验收进展：先记录本次进展（工时/附件），再触发验收确认
  const confirmAcceptanceFromProgress = async () => {
    if (isSaving || !onConfirmAcceptance) {
      return
    }
    setIsSaving(true)
    setTimeEntryError('')
    try {
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
      await saveDirtyExistingAttachmentNames()
      // 验收附件在保存时上传（scope=acceptance，自动带「验收文件」标签）。
      const { names: finalizedUploadedNames, failures: uploadFailures } = await finalizeStagedAttachments()
      if (uploadFailures.length > 0) {
        setUploadErrors(uploadFailures)
        return
      }
      recordAppliedTextLearning(note.trim() || nextEntry?.note?.trim() || '')
      recordAppliedAttachmentNameLearning()
      // 累计工时
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
      // 记录本次进展动态
      const body = note.trim() || nextEntry?.note?.trim() || ''
      if (body || finalizedUploadedNames.length > 0) {
        await onCreateTaskUpdate(task.id, {
          title: '验收进展',
          body: body || `上传验收附件：${finalizedUploadedNames.join('、')}`,
          hours: 0,
          visible: false,
        })
      }
      // 触发验收确认（复用现有 handleConfirmTaskAcceptance 逻辑）
      onConfirmAcceptance(taskForAcceptance, {
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
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const requestProgressAiSuggestion = async () => {
    setProgressAiError('')
    setProgressAiSuggestion(null)
    setIsProgressAiLoading(true)
    try {
      const suggestion = await api.optimizeTaskTextAssistant({
        mode: isAcceptanceMode ? 'acceptance' : 'progress',
        text: note,
        task,
        files: taskAssistantFiles(task, files, uploadedNames),
        activity: taskAssistantActivity(activity),
        uploadedFileNames: uploadedNames,
        progressHistory: isAcceptanceMode ? projectProgressHistory : undefined,
      })
      setProgressAiSuggestion(suggestion)
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
    const nextMinutes = snapDurationMinutes(value)
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
      <p className="progress-lite-duration" role="status">保存后显示为一条「甲方反馈」节点，可附截图 / 批注文件追溯。</p>
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
                  {formatDuration(segmentMinutes)}
                </output>
              ) : (
                <input
                  className="new-task-hours-input"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formatHoursInputValue(segmentMinutes)}
                  onChange={(event) => updateProgressMinutes(Number(event.target.value || 0) * 60)}
                  aria-label="本段工时"
                />
              )}
              {scheduleDerivedField !== 'hours' && <span className="progress-lite-hours-unit">小时</span>}
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
                <input
                  className="new-task-hours-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formatExactHoursInputValue(planReferenceMinutes)}
                  onChange={(event) => updatePlanReferenceMinutes(Number(event.target.value || 0) * 60)}
                  aria-label="预计工时"
                />
                <span className="progress-lite-hours-unit">小时</span>
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
            {isAcceptanceMode && (
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
                  <div className="progress-feedback-source" role="group" aria-label="反馈来源">
                    <span>反馈来源</span>
                    <div>
                      {clientFeedbackSources.map((source) => (
                        <button
                          type="button"
                          key={source}
                          className={feedbackSource === source ? 'active' : ''}
                          aria-pressed={feedbackSource === source}
                          onClick={() => setFeedbackSource(source)}
                        >
                          {source}
                        </button>
                      ))}
                    </div>
                  </div>
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
                placeholder={isAcceptanceMode ? '可补充本次收尾重点；AI 会结合全部历史进展，汇总项目更新、修改与最终交付。' : isFeedbackMode ? '例如：B01 反馈：标题需要更突出，主视觉换成更正式的蓝色，补充数据安全痛点。' : '例如：按甲方反馈调整封面配色，导出终稿'}
              />
              {(progressAiSuggestion || progressAiError || isProgressAiLoading) && (
                <div className="ai-suggestion-panel task-text-ai-panel">
                  <div className="ai-suggestion-head">
                    <span>{isProgressAiLoading ? (isAcceptanceMode ? 'AI 正在整理验收备注' : 'AI 正在整理进展') : isAcceptanceMode ? 'AI 项目总结' : 'AI 建议'}</span>
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
                            progressAiSuggestionAppliedRef.current = {
                              context: isAcceptanceMode ? 'acceptance' : 'progress',
                              aiOutput: progressAiSuggestion.optimizedText,
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
                            sourceUrl={documentSourceUrl}
                            onOpen={() => onPreviewFile(file)}
                          />
                          <div className="progress-attachment-main">
                            <div className="progress-attachment-name-field full-name">
                              <input
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
                                <span>
                                  建议：{aiState.suggestion.suggestedName}
                                  {aiState.suggestion.reason ? ` · ${aiState.suggestion.reason}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextName = sanitizeAttachmentName(aiState.suggestion?.suggestedName ?? draftName, file.name)
                                    if (nextName) {
                                      existingAttachmentAiNameAppliedRef.current[file.id] = nextName
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
                        />
                        <div className="progress-attachment-name-field">
                          <input
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
                            <span>
                              建议：{attachment.aiSuggestion.suggestedName}
                              {attachment.aiSuggestion.reason ? ` · ${attachment.aiSuggestion.reason}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextName = sanitizeAttachmentName(attachment.aiSuggestion?.suggestedName ?? attachment.name, attachment.originalName)
                                if (nextName) {
                                  pendingAttachmentAiNameAppliedRef.current[attachment.id] = nextName
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
                              discardStagedFile(attachment.uploadedFile?.id)
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
                <small>也可以直接 Ctrl+V 粘贴图片</small>
              </button>
              <input
                ref={fileInputRef}
                className="task-row-upload-input"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z"
                onChange={(event) => addPendingFiles(event.target.files)}
              />
              <input
                ref={replacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z"
                onChange={(event) => replacePendingAttachment(event.target.files)}
              />
              <input
                ref={existingReplacementInputRef}
                className="task-row-upload-input"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.psd,.ai,.eps,.fig,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z"
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
                  {acceptancePreviewTimeEntries.length === 0 ? (
                    <p className="progress-acceptance-hint">还没有分段计时。</p>
                  ) : (
                    <div className="progress-acceptance-time-table-wrap">
                      <table className="progress-acceptance-time-table">
                        <thead><tr><th>日期</th><th>时间段</th><th>工时</th></tr></thead>
                        <tbody>
                          {acceptancePreviewTimeEntries.map((entry) => (
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
                      <textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="例如：需求清晰，但等待甲方确认主色耗时较长。" />
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

function TaskDetailModal({
  task,
  files,
  onClose,
  onPreviewFile,
  onOpenAcceptance,
  onOpenEdit,
  onOpenProgress,
}: {
  task: Task
  files: FileAsset[]
  onClose: () => void
  onPreviewFile: (file: FileAsset) => void
  onOpenAcceptance: (taskId: number) => void
  onOpenEdit: (taskId: number) => void
  onOpenProgress: (taskId: number) => void
}) {
  const dueState = taskDueState(task, isoDate(), isoDate(3))
  const actualMinutes = sumTimeEntries(task.timeEntries ?? [])
  const waitingMinutes = sumWaitingEntries(task)
  const actualHoursText = actualMinutes > 0 ? `${(actualMinutes / 60).toFixed(2)} h（共 ${(task.timeEntries ?? []).length} 段）` : `${task.actualHours.toFixed(2)} h`
  const actualH = actualMinutes > 0 ? actualMinutes / 60 : task.actualHours
  const estimatedH = task.estimatedHours
  const hoursDevPct = estimatedH > 0 && actualH > 0 ? Math.round(((actualH - estimatedH) / estimatedH) * 100) : null
  const waitingHoursText = `${(waitingMinutes / 60).toFixed(2)} h（共 ${(task.waitingEntries ?? []).length} 段）`
  // 用「进展分段计时」（按真实工作日期）替代审计流水，避免补录任务显示成「确认验收=补录当天」的误导时间。
  const detailTimeEntries = [...(task.timeEntries ?? [])].sort((a, b) => `${b.date ?? ''}${b.start ?? ''}`.localeCompare(`${a.date ?? ''}${a.start ?? ''}`))
  const acceptanceFileNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))

  return (
    <ModalShell className="task-detail-modal" labelledBy="task-detail-title" onClose={onClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">{task.type} · {task.contact || '待确认'}</p>
          <h2 id="task-detail-title">{task.title}</h2>
        </div>
        <div className="modal-header-actions">
          {task.status === '待验收' ? (
            <button
              type="button"
              className="status-badge status-待验收 detail-acceptance-status-button"
              aria-label="去验收"
              title="去验收"
              onClick={() => onOpenAcceptance(task.id)}
            >
              <span className="status-label-default">待验收</span>
              <span className="status-label-hover">去验收</span>
            </button>
          ) : (
            <StatusBadge status={task.status} />
          )}
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="task-detail-body task-detail-summary-body">
        <section className="task-detail-summary">
          <dl>
            <div className="wide">
              <dt>任务名称</dt>
              <dd>{task.title}</dd>
            </div>
            <div>
              <dt>设计类型</dt>
              <dd>{task.type || '未填写'}</dd>
            </div>
            <div>
              <dt>对接人</dt>
              <dd>{task.contact || '待确认'}</dd>
            </div>
            <div>
              <dt>需求人</dt>
              <dd>{task.requester || '未填写'}</dd>
            </div>
            <div>
              <dt>验收人</dt>
              <dd>{task.reviewer || '未填写'}</dd>
            </div>
            <div className="wide">
              <dt>任务需求</dt>
              <dd>{task.requirement || '未填写'}</dd>
            </div>
            {isSupplementalTask(task) && (
              <div className="wide">
                <dt>补录说明</dt>
                <dd className="supplemental-note-content">{task.supplementalNote || '未填写'}</dd>
              </div>
            )}
            <div>
              <dt>预计开始</dt>
              <dd>{task.date ? formatPlanDateTime(task.date) : '未设置'}</dd>
            </div>
            <div>
              <dt>预计交付</dt>
              <dd>
                {task.estimatedDate ? formatPlanDateTime(task.estimatedDate) : '未设置'}
                {dueState ? <span className={`due-tag ${dueState}`}>{dueState === 'overdue' ? '已逾期' : '临期'}</span> : null}
              </dd>
            </div>
            <div>
              <dt>任务状态</dt>
              <dd><StatusDotLabel status={task.status} /></dd>
            </div>
            <div>
              <dt>当前进度</dt>
              <dd>{taskDisplayProgress(task)}%</dd>
            </div>
            <div>
              <dt>实际工时</dt>
              <dd>
                {actualHoursText}
                {estimatedH > 0 && (
                  <span className="hours-vs-estimate">
                    {' / 预估 '}{estimatedH.toFixed(2)} h
                    {hoursDevPct !== null && (
                      <span className={`hours-dev-badge ${hoursDevPct > 0 ? 'over' : 'under'}`}>
                        {hoursDevPct > 0 ? `+${hoursDevPct}%` : `${hoursDevPct}%`}
                      </span>
                    )}
                  </span>
                )}
              </dd>
            </div>
            {waitingMinutes > 0 && (
              <div>
                <dt>等待记录</dt>
                <dd className="admin-only-data">{waitingHoursText}</dd>
              </div>
            )}
            {task.feedbackRating && (
              <div>
                <dt>任务体感</dt>
                <dd className="task-feedback-detail admin-only-data">
                  <span>{task.feedbackRating}</span>
                  {(task.feedbackTags ?? []).map((tag) => <em key={tag}>{tag}</em>)}
                </dd>
              </div>
            )}
            {task.feedbackNote && (
              <div className="wide">
                <dt>体感评价</dt>
                <dd className="admin-only-data">{task.feedbackNote}</dd>
              </div>
            )}
            <div>
              <dt>结算月份</dt>
              <dd>
                {monthLabelOf(taskSettlementMonth(task))}
                {isSupplementalTask(task) ? <span className="supplement-inline">补录</span> : null}
              </dd>
            </div>
          </dl>
          <div className="task-detail-progress">
            <div className="large-meter">
              <span style={{ width: `${taskDisplayProgress(task)}%` }} />
            </div>
            <strong>{taskDisplayProgress(task)}%</strong>
          </div>
        </section>

        <section className="task-detail-log">
          <div className="section-heading">
            <h3>进展与反馈时间线</h3>
            <Clock3 size={15} />
          </div>
          {detailTimeEntries.length === 0 && <p className="calendar-empty-hint">暂无分段计时。</p>}
          {detailTimeEntries.length > 0 && (
            <div className="timeline activity-timeline">
              {detailTimeEntries.map((entry) => {
                const minutes = minutesForTimeEntry(entry)
                const entryFiles = files.filter((file) => {
                  if (file.taskId !== task.id || file.deletedAt) {
                    return false
                  }
                  if (file.entryId === entry.id) {
                    return true
                  }
                  return Boolean(entry.isAcceptanceProgress) && isAcceptanceFileAsset(file, acceptanceFileNames) && (!file.entryId || acceptanceFileNames.has(file.name.trim()))
                })
                const hasAcceptanceFiles = entryFiles.some((file) => isAcceptanceFileAsset(file, acceptanceFileNames))
                return (
                  <article className="timeline-item" key={entry.id}>
                    <span className="dot" />
                    <div className="task-detail-entry-time">
	                      <time>{formatEntryDateTimeRange(task, entry)}</time>
	                      {entry.isAcceptanceProgress && <span className="progress-entry-tag acceptance">验收进展</span>}
	                      {entry.isClientFeedback && <span className="progress-entry-tag client-feedback">甲方反馈</span>}
	                      {entry.feedbackVersion && <span className="progress-entry-tag feedback-version">{entry.feedbackVersion}</span>}
	                      {hasAcceptanceFiles && <span className="progress-entry-tag acceptance-file">验收文件</span>}
	                      <em className={`progress-time-pill ${minutes > 0 ? '' : 'is-uncounted'}`}>{minutes > 0 ? `计时 ${formatSignedHours(minutes)}` : '不计工时'}</em>
	                    </div>
	                    {entry.note && <p>{entry.note}</p>}
	                    {entry.isClientFeedback && <p className="dashboard-side-entry-meta">{entry.feedbackSource || '甲方'}反馈{entry.isRevision ? ' · 计入改稿轮次' : ''}</p>}
                    {entryFiles.length > 0 && (
                      <div className="dashboard-side-entry-files" aria-label="本段进展附件">
                        {entryFiles.map((file) => {
                          const fileType = fileTypeForAsset(file).type
                          const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
                          const documentSourceUrl = fileThumbnailSource(file)
                          return (
                            <AttachmentHoverThumbnail
                              key={file.id}
                              name={file.name}
                              type={fileType}
                              previewUrl={previewUrl}
                              sourceUrl={documentSourceUrl}
                              compact
                              onOpen={() => onPreviewFile(file)}
                            />
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <footer className="modal-footer">
        <button className="text-button task-detail-footer-btn" onClick={() => onOpenProgress(task.id)}>
          <BarChart3 size={15} />
          进展
        </button>
        <button className="text-button task-detail-footer-btn" onClick={() => onOpenEdit(task.id)}>
          <Pencil size={15} />
          去编辑
        </button>
      </footer>
    </ModalShell>
  )
}


type CalendarDisplayMode = '日' | '周' | '月'

const calendarHours = Array.from({ length: 17 }, (_, index) => index + 7)
const calendarHourHeight = 54

function addIsoDays(value: string, amount: number) {
  const date = localDateFromIsoDate(value)
  date.setDate(date.getDate() + amount)
  return isoDateFromLocalDate(date)
}

function startOfCalendarWeek(value: string) {
  const date = localDateFromIsoDate(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return isoDateFromLocalDate(date)
}

function calendarTaskStartsAt(task: Task) {
  if (!task.date.includes('T')) {
    return null
  }
  const hour = Number(task.date.slice(11, 13))
  const minute = Number(task.date.slice(14, 16))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }
  return hour * 60 + minute
}

function calendarTaskDurationMinutes(task: Task) {
  const hours = task.actualHours > 0 ? task.actualHours : task.estimatedHours
  return Math.max(30, Math.round((Number.isFinite(hours) && hours > 0 ? hours : 1) * 60))
}

function calendarTaskRange(task: Task) {
  const start = datePart(task.date || task.settlementMonth || isoDate())
  const lifecycleEnd = datePart(taskLifecycleDate(task) || '')
  const plannedEnd = datePart(task.estimatedDate || '')
  const rawEnd = task.status === '已验收'
    ? lifecycleEnd || plannedEnd || start
    : plannedEnd || lifecycleEnd || start
  const end = rawEnd >= start ? rawEnd : start
  return { start, end }
}

function compareCalendarTasks(a: Task, b: Task) {
  const rangeCompare = calendarTaskRange(a).start.localeCompare(calendarTaskRange(b).start)
  if (rangeCompare !== 0) {
    return rangeCompare
  }
  return a.title.localeCompare(b.title)
}

function chunkCalendarWeeks(days: ReturnType<typeof calendarDaysForMonth>) {
  const weeks: typeof days[] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

function CalendarView({
  monthValue,
  mode,
  focusDate,
  designTypeGroups,
  tasks,
  onOpenTask,
  onFocusDateChange,
  onMonthChange,
}: {
  monthValue: string
  mode: CalendarDisplayMode
  focusDate: string
  designTypeGroups: DesignTypeGroup[]
  tasks: Task[]
  onOpenTask: (taskId: number) => void
  onFocusDateChange: (value: string) => void
  onMonthChange: (value: string) => void
}) {
  const selectedDate = focusDate || `${monthValue}-01`
  const today = isoDate()
  const visibleTasks = useMemo(() => tasks.filter((task) => !task.voidedAt), [tasks])
  const taskRanges = useMemo(() => new Map(visibleTasks.map((task) => [task.id, calendarTaskRange(task)])), [visibleTasks])
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    visibleTasks.forEach((task) => {
      const range = taskRanges.get(task.id) ?? calendarTaskRange(task)
      dateRangeValues(range.start, range.end).forEach((key) => {
        map.set(key, [...(map.get(key) ?? []), task].sort(compareCalendarTasks))
      })
    })
    return map
  }, [taskRanges, visibleTasks])

  const weekStart = startOfCalendarWeek(selectedDate)
  const weekDays = Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index))
  const monthDays = calendarDaysForMonth(monthValue)
  const monthWeeks = useMemo(() => chunkCalendarWeeks(monthDays), [monthDays])

  const setCalendarDate = (value: string) => {
    onFocusDateChange(value)
    if (monthPart(value) !== monthValue) {
      onMonthChange(monthPart(value))
    }
  }

  const calendarTaskColorStyle = (task: Task) => ({
    '--calendar-type-color': designTypeColorForTask(task.type, designTypeGroups),
  }) as CSSProperties

  const rangeSegmentClass = (task: Task, day: string) => {
    const range = taskRanges.get(task.id) ?? calendarTaskRange(task)
    const isStart = day === range.start
    const isEnd = day === range.end
    return `${isStart ? 'span-start' : 'span-middle'} ${isEnd ? 'span-end' : ''}`
  }

  const monthSegmentsForWeek = (week: typeof monthDays) => {
    const weekStartValue = week[0]?.value ?? selectedDate
    const weekEndValue = week[week.length - 1]?.value ?? selectedDate
    const slots: boolean[][] = []
    return visibleTasks
      .map((task) => {
        const range = taskRanges.get(task.id) ?? calendarTaskRange(task)
        const segmentStart = range.start > weekStartValue ? range.start : weekStartValue
        const segmentEnd = range.end < weekEndValue ? range.end : weekEndValue
        if (segmentEnd < weekStartValue || segmentStart > weekEndValue || segmentStart > segmentEnd) {
          return null
        }
        const startIndex = week.findIndex((day) => day.value === segmentStart)
        const endIndex = week.findIndex((day) => day.value === segmentEnd)
        if (startIndex < 0 || endIndex < 0) {
          return null
        }
        return { task, range, segmentStart, segmentEnd, startIndex, endIndex }
      })
      .filter((segment): segment is NonNullable<typeof segment> => !!segment)
      .sort((a, b) => compareCalendarTasks(a.task, b.task))
      .map((segment) => {
        let slot = slots.findIndex((items) => {
          for (let index = segment.startIndex; index <= segment.endIndex; index += 1) {
            if (items[index]) return false
          }
          return true
        })
        if (slot < 0) {
          slot = slots.length
          slots.push([])
        }
        for (let index = segment.startIndex; index <= segment.endIndex; index += 1) {
          slots[slot][index] = true
        }
        return { ...segment, slot }
      })
      .filter((segment) => segment.slot < 4)
  }

  const renderAllDayTask = (task: Task, day: string) => {
    const range = taskRanges.get(task.id) ?? calendarTaskRange(task)
    return (
    <button
      type="button"
      className={`calendar-allday-chip ${rangeSegmentClass(task, day)}`}
      key={task.id}
      style={calendarTaskColorStyle(task)}
      onClick={() => onOpenTask(task.id)}
      title={`${task.title} · ${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`}
    >
      {task.title}
    </button>
    )
  }

  const renderTimedTask = (task: Task) => {
    const startsAt = calendarTaskStartsAt(task)
    if (startsAt === null) {
      return null
    }
    const firstMinute = calendarHours[0] * 60
    const lastMinute = (calendarHours.at(-1) ?? 23) * 60
    const top = Math.max(0, ((startsAt - firstMinute) / 60) * calendarHourHeight)
    const height = Math.max(30, Math.min(180, (calendarTaskDurationMinutes(task) / 60) * calendarHourHeight))
    const isOutside = startsAt < firstMinute || startsAt > lastMinute + 59
    return (
      <button
        type="button"
        className={`calendar-timed-event ${isOutside ? 'outside-hours' : ''}`}
        key={task.id}
        style={{
          ...calendarTaskColorStyle(task),
          '--event-top': `${top}px`,
          '--event-height': `${height}px`,
        } as CSSProperties}
        onClick={() => onOpenTask(task.id)}
        title={`${formatMonthDayTime(task.date)} · ${task.title}`}
      >
        <strong>{task.title}</strong>
        <span>{task.type}</span>
      </button>
    )
  }

  const renderHolidayPill = (dayMeta: ReturnType<typeof calendarDayMeta>, key: string) => {
    if (dayMeta.holidayLabel) {
      return (
        <span className="calendar-holiday-pill" key={key}>
          {dayMeta.holidayLabel}
          {dayMeta.officialLabel === '休' && <em>休</em>}
        </span>
      )
    }
    if (dayMeta.officialLabel === '补班') {
      return (
        <span className="calendar-workday-pill" key={key}>
          补班
        </span>
      )
    }
    return null
  }

  const renderScheduleGrid = (days: string[]) => (
    <div className="calendar-schedule">
      <div className="calendar-schedule-header" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-timezone">GMT+08</div>
        {days.map((day) => {
          const date = localDateFromIsoDate(day)
          const dayMeta = calendarDayMeta(day)
          return (
            <button
              type="button"
              className={`calendar-schedule-day ${day === today ? 'today' : ''} ${day === selectedDate ? 'selected' : ''} ${dayMeta.isFestival ? 'festival' : ''} ${dayMeta.officialKind ? `official-${dayMeta.officialKind}` : ''}`}
              key={day}
              onClick={() => setCalendarDate(day)}
            >
              <span>{weekdayLabels[(date.getDay() + 6) % 7]}</span>
              <strong>{date.getDate()}</strong>
              <small>{dayMeta.label}</small>
            </button>
          )
        })}
      </div>
      <div className="calendar-allday-row" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-time-label">计划</div>
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day) ?? []
          const dayMeta = calendarDayMeta(day)
          return (
            <div className="calendar-allday-cell" key={day}>
              {renderHolidayPill(dayMeta, `${day}-holiday`)}
              {dayTasks.slice(0, dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4).map((task) => renderAllDayTask(task, day))}
              {dayTasks.length > (dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4) && <span className="calendar-overflow">+{dayTasks.length - (dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4)} 项</span>}
            </div>
          )
        })}
      </div>
      <div className="calendar-time-grid" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-time-axis">
          {calendarHours.map((hour) => (
            <span key={hour}>{hour < 12 ? `上午${hour}点` : hour === 12 ? '下午12点' : `下午${hour - 12}点`}</span>
          ))}
        </div>
        {days.map((day) => {
          const dayTasks = (tasksByDate.get(day) ?? []).filter((task) => datePart(task.date) === day)
          return (
            <div className="calendar-time-column" key={day}>
              {calendarHours.map((hour) => <span className="calendar-hour-line" key={hour} />)}
              {dayTasks.map(renderTimedTask)}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <section className="panel google-calendar-panel">
      {mode === '月' ? (
        <div className="google-month-view">
          <div className="google-month-weekdays">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="google-month-grid">
            {monthWeeks.map((week) => (
              <div className="google-month-week" key={week[0]?.value}>
                <div className="google-month-week-cells">
                  {week.map((day) => {
                    const dayMeta = calendarDayMeta(day.value)
                    return (
                      <button
                        type="button"
                        className={`google-month-cell ${day.inMonth ? '' : 'outside'} ${day.value === today ? 'today' : ''} ${day.value === selectedDate ? 'selected' : ''} ${dayMeta.isFestival ? 'festival' : ''} ${dayMeta.officialKind ? `official-${dayMeta.officialKind}` : ''}`}
                        key={day.value}
                        onClick={() => setCalendarDate(day.value)}
                      >
                        <span className="google-month-date">
                          <span className="google-month-day">{day.day}</span>
                          <span className="google-month-lunar">
                            {dayMeta.label}
                          </span>
                        </span>
                        <span className="google-month-events">
                          {renderHolidayPill(dayMeta, `${day.value}-holiday`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="google-month-week-events" aria-hidden={false}>
                  {monthSegmentsForWeek(week).map((segment) => {
                    const isRangeStart = segment.segmentStart === segment.range.start
                    const isRangeEnd = segment.segmentEnd === segment.range.end
                    return (
                      <button
                        type="button"
                        className={`calendar-event-pill month-span ${isRangeStart ? 'span-start' : 'span-middle'} ${isRangeEnd ? 'span-end' : ''}`}
                        key={`${segment.task.id}-${segment.segmentStart}`}
                        style={{
                          ...calendarTaskColorStyle(segment.task),
                          '--span-column': segment.startIndex + 1,
                          '--span-days': segment.endIndex - segment.startIndex + 1,
                          '--span-slot': segment.slot,
                        } as CSSProperties}
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenTask(segment.task.id)
                        }}
                        title={`${segment.task.title} · ${formatMonthDay(segment.range.start)} - ${formatMonthDay(segment.range.end)}`}
                      >
                        {segment.task.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : renderScheduleGrid(mode === '周' ? weekDays : [selectedDate])}
    </section>
  )
}

function FilesView({
  files,
  tasks,
  attachmentAnalyses,
  currentMonthValue,
  focusFileId = 0,
  onFocusHandled,
  onPreviewFile,
  onDeleteFile,
  onDownloadFile,
  onUpdateFile,
  onRetryAnalysis,
  canWrite,
  canDelete,
}: {
  files: FileAsset[]
  tasks: Task[]
  attachmentAnalyses: AttachmentAnalysis[]
  currentMonthValue: string
  focusFileId?: number
  onFocusHandled?: () => void
  onPreviewFile: (file: FileAsset) => void
  onDeleteFile: (fileId: number) => void
  onDownloadFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  onRetryAnalysis: (attachmentId: number) => Promise<void>
  canWrite: boolean
  canDelete: boolean
}) {
  // 仅展示「已验收」任务的验收文件——未验收任务（进行中/待验收）即便预上传了验收稿也不显示，
  // 避免「还没验收却出现验收文件」。任务回到待验收（撤回验收）时也会自动隐藏。
  const acceptedTaskIds = useMemo(
    () => new Set(tasks.filter((task) => task.status === '已验收').map((task) => task.id)),
    [tasks],
  )
  const acceptanceFiles = useMemo(
    () => files.filter((file) => file.scope === 'acceptance' && acceptedTaskIds.has(file.taskId)),
    [files, acceptedTaskIds],
  )
  const analysisByAttachment = useMemo(
    () => new Map(attachmentAnalyses.map((analysis) => [analysis.attachmentId, analysis])),
    [attachmentAnalyses],
  )
  const [fileQuery, setFileQuery] = useState('')
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; file: FileAsset } | null>(null)
  const [focusFileField, setFocusFileField] = useState<'name' | 'tag' | null>(null)
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentMonthValue]))
  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase()
    return acceptanceFiles.filter((file) => {
      const matchesQuery =
        !query ||
        [file.name, file.task, file.type, file.tag ?? ''].some((value) => value.toLowerCase().includes(query))
      return matchesQuery
    })
  }, [acceptanceFiles, fileQuery])
  const projectRecords = useMemo(() => {
    const taskMap = new Map(tasks.map((task) => [task.id, task]))
    const fileTaskIds = [...new Set(filteredFiles.map((file) => file.taskId))]
    return fileTaskIds
      .map((taskId) => {
        const task = taskMap.get(taskId)
        const projectFiles = filteredFiles
          .filter((file) => file.taskId === taskId)
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        const latestUploadedAt = projectFiles[0]?.uploadedAt ?? ''
        const settlementMonth = task ? taskSettlementMonth(task) : ''
        const month = /^\d{4}-\d{2}$/.test(settlementMonth)
          ? settlementMonth
          : latestUploadedAt.slice(0, 7)
        return {
          id: taskId,
          title: task?.title ?? projectFiles[0]?.task ?? '未关联任务',
          type: task?.type ?? '未分类',
          contact: task?.contact ?? '',
          acceptanceNote: task?.acceptanceNote ?? '',
          month: /^\d{4}-\d{2}$/.test(month) ? month : currentMonthValue,
          files: projectFiles,
          latestUploadedAt,
        }
      })
      .sort((a, b) => {
        const monthOrder = b.month.localeCompare(a.month)
        return monthOrder || b.latestUploadedAt.localeCompare(a.latestUploadedAt)
      })
  }, [currentMonthValue, filteredFiles, tasks])
  const monthGroups = useMemo(() => {
    const groups = new Map<string, typeof projectRecords>()
    projectRecords.forEach((project) => {
      groups.set(project.month, [...(groups.get(project.month) ?? []), project])
    })
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, projects]) => ({
        month,
        projects,
        fileCount: projects.reduce((sum, project) => sum + project.files.length, 0),
      }))
  }, [projectRecords])
  const [selectedProjectId, setSelectedProjectId] = useState(() => projectRecords[0]?.id ?? 0)
  const selectedProject = projectRecords.find((task) => task.id === selectedProjectId) ?? projectRecords[0]
  const selectedFiles = selectedProject?.files ?? []
  const [selectedFileId, setSelectedFileId] = useState(0)
  const selectedFile = selectedFiles.find((file) => file.id === selectedFileId)

  // 从语义搜索跳转过来：定位到该文件所属项目文件夹并选中它，自动展开月份、滚动到位、高亮其 AI 分析。
  useEffect(() => {
    if (!focusFileId) {
      return
    }
    const target = acceptanceFiles.find((file) => file.id === focusFileId)
    if (target) {
      const project = projectRecords.find((record) => record.id === target.taskId)
      requestAnimationFrame(() => {
        if (project) {
          setOpenMonths((current) => new Set(current).add(project.month))
        }
        setSelectedProjectId(target.taskId)
        setSelectedFileId(focusFileId)
        document.querySelector(`[data-file-id="${focusFileId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFileId])

  const openFileSource = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noreferrer')
    }
  }
  const focusInspectorField = (file: FileAsset, field: 'name' | 'tag') => {
    setSelectedFileId(file.id)
    setFocusFileField(field)
  }
  const openFileContextMenu = (event: React.MouseEvent, file: FileAsset) => {
    event.preventDefault()
    setSelectedFileId(file.id)
    setFileContextMenu({ x: event.clientX, y: event.clientY, file })
  }

  useEffect(() => {
    if (!fileContextMenu) {
      return
    }
    const closeMenu = () => setFileContextMenu(null)
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
  }, [fileContextMenu])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable
      if (event.key === 'Escape' && selectedFile) {
        setSelectedFileId(0)
        setFocusFileField(null)
        return
      }
      if (event.code === 'Space' && selectedFile && !isTyping) {
        event.preventDefault()
        onPreviewFile(selectedFile)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onPreviewFile, selectedFile])

  return (
    <section className="view-stack">
      <section className="file-library-header">
        <p>按项目归档 · 点进项目查看验收交付件，AI 已自动解析</p>
        <TaskSearchBox
          value={fileQuery}
          onChange={setFileQuery}
          placeholder="搜索文件、项目、标签、关联任务"
          className="file-library-search"
        />
      </section>

      <section className="file-library-layout">
        <aside className="file-project-list">
          {monthGroups.length === 0 && (
            <div className="empty-state">
              <strong>还没有验收交付件</strong>
              <p>任务提交验收时上传的交付文件会按项目自动归档到这里，AI 也会同步解析内容供搜索。</p>
            </div>
          )}
          {monthGroups.map((group) => {
            const isOpen = Boolean(fileQuery.trim()) || openMonths.has(group.month)
            return (
              <section className={`file-tree-month ${isOpen ? 'open' : ''}`} key={group.month}>
                <button
                  className="file-tree-month-header"
                  type="button"
                  onClick={() => {
                    setOpenMonths((current) => {
                      const next = new Set(current)
                      if (next.has(group.month)) {
                        next.delete(group.month)
                      } else {
                        next.add(group.month)
                      }
                      return next
                    })
                  }}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <strong>{monthLabelOf(group.month)}</strong>
                  <span>{group.projects.length} 项 · {group.fileCount} 文件</span>
                </button>
                {isOpen && (
                  <div className="file-tree-projects">
                    {group.projects.map((project) => (
                      <button
                        className={`file-project-row ${selectedProject?.id === project.id ? 'active' : ''}`}
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id)
                          setSelectedFileId(0)
                        }}
                      >
                        <Folder size={14} />
                        <span>{project.title}</span>
                        <em>{project.files.length}</em>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </aside>

        <section className="file-project-detail">
          <div className="file-project-heading">
            <div>
              <h2>{selectedProject?.title ?? '选择一个项目'}</h2>
              <p>
                {selectedProject
                  ? `${selectedProject.contact || '未填写对接人'} · ${selectedProject.type} · ${selectedFiles.length} 个验收文件`
                  : '点击左侧项目查看验收文件'}
              </p>
            </div>
          </div>
          {selectedProject?.acceptanceNote && (
            <div className="file-project-note">
              <strong>最新交付说明</strong>
              <span>{selectedProject.acceptanceNote}</span>
            </div>
          )}
          <div className="grouped-file-grid">
            {selectedFiles.map((file) => {
              const fileType = fileTypeForAsset(file).type
              return (
                <article
                  className={`file-thumb-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  key={file.id}
                  data-file-id={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFileId(file.id)}
                  onDoubleClick={() => onPreviewFile(file)}
                  onContextMenu={(event) => openFileContextMenu(event, file)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPreviewFile(file)
                    }
                  }}
                >
                  <div className="file-thumb-preview visual-preview">
                    <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
                    <FileThumbnailPreview file={file} />
                  </div>
                  <div className="file-thumb-info">
                    <h2>{file.name}</h2>
                    <p>{file.size} · {file.uploadedAt.slice(0, 10)}</p>
                    <div className="file-thumb-tags">
                      <span>验收文件</span>
                      {parseFileTags(file.tag).filter((tag) => tag !== '验收文件').slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                </article>
              )
            })}
            {selectedProject && selectedFiles.length === 0 && <p className="calendar-empty-hint">这个项目下还没有文件。</p>}
          </div>
        </section>
        {selectedFile && (
          <FileInspector
            key={selectedFile.id}
            file={selectedFile}
            analysis={analysisByAttachment.get(selectedFile.id)}
            onPreview={onPreviewFile}
            onDownload={onDownloadFile}
            onDelete={onDeleteFile}
            onUpdateFile={onUpdateFile}
            onRetryAnalysis={onRetryAnalysis}
            focusField={focusFileField}
            onFocusHandled={() => setFocusFileField(null)}
            onClose={() => {
              setSelectedFileId(0)
              setFocusFileField(null)
            }}
            canWrite={canWrite}
            canDelete={canDelete}
          />
        )}
      </section>
      {fileContextMenu && (
        <FileContextMenu
          menu={fileContextMenu}
          onClose={() => setFileContextMenu(null)}
          onPreview={onPreviewFile}
          onOpen={openFileSource}
          onDownload={onDownloadFile}
          onFocusName={(file) => focusInspectorField(file, 'name')}
          onFocusTag={(file) => focusInspectorField(file, 'tag')}
          onDelete={onDeleteFile}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}
    </section>
  )
}

function FileInspector({
  file,
  analysis,
  onPreview,
  onDownload,
  onDelete,
  onUpdateFile,
  onRetryAnalysis,
  focusField,
  onFocusHandled,
  onClose,
  canWrite,
  canDelete,
}: {
  file: FileAsset | undefined
  analysis?: AttachmentAnalysis
  onPreview: (file: FileAsset) => void
  onDownload: (file: FileAsset) => void
  onDelete: (fileId: number) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  onRetryAnalysis: (attachmentId: number) => Promise<void>
  focusField?: 'name' | 'tag' | null
  onFocusHandled?: () => void
  onClose: () => void
  canWrite: boolean
  canDelete: boolean
}) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(file?.name ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(() => parseFileTags(file?.tag))
  const [isSaving, setIsSaving] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    // File metadata is editable draft state; reset it when the selected file changes to avoid cross-file overwrites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftName(file?.name ?? '')
    setTagInput('')
    setTags(parseFileTags(file?.tag))
  }, [file?.id, file?.name, file?.tag])

  useEffect(() => {
    if (!focusField || !file) {
      return
    }
    const input = focusField === 'name' ? nameInputRef.current : tagInputRef.current
    input?.focus()
    input?.select()
    onFocusHandled?.()
  }, [file, focusField, onFocusHandled])

  if (!file) return null

  const fileType = fileTypeForAsset(file).type
  const sourceUrl = authedPreviewUrl(file.sourceUrl)
  const saveMetadata = async (nextTags = tags) => {
    setIsSaving(true)
    try {
      const updatedFile = await onUpdateFile(file.id, { name: draftName, tag: serializeFileTags(nextTags) })
      setTags(parseFileTags(updatedFile.tag))
    } finally {
      setIsSaving(false)
    }
  }
  const addTag = async () => {
    const nextTag = tagInput.trim()
    if (!nextTag) {
      return
    }
    const nextTags = Array.from(new Set([...tags, nextTag]))
    setTags(nextTags)
    setTagInput('')
    await saveMetadata(nextTags)
  }
  const removeTag = async (tag: string) => {
    const nextTags = tags.filter((item) => item !== tag)
    setTags(nextTags)
    await saveMetadata(nextTags)
  }

  return (
    <>
      <button className="file-inspector-scrim" type="button" aria-label="关闭文件详情" onClick={onClose} />
      <aside className="file-inspector" aria-label={`${file.name} 文件详情`}>
        <header className="file-inspector-header">
          <div>
            <span>{fileType}</span>
            <strong>验收文件</strong>
          </div>
          <button type="button" onClick={onClose}>
            关闭 <X size={16} />
          </button>
        </header>
        {canWrite ? <label className="inspector-field file-inspector-name">
          <span>文件名</span>
          <input ref={nameInputRef} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveMetadata()} />
        </label> : <div className="inspector-field file-inspector-name"><span>文件名</span><strong>{file.name}</strong></div>}
        <p className="file-inspector-subtitle">{file.task} · {file.type}</p>
        <button className="file-inspector-preview" type="button" onClick={() => onPreview(file)}>
          <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
          <FileThumbnailPreview file={file} inspector />
        </button>
        <p className="file-inspector-preview-hint">双击文件卡或按空格可放大预览</p>
        <dl className="inspector-meta">
          <div>
            <dt>关联任务</dt>
            <dd>{file.task}</dd>
          </div>
          <div>
            <dt>尺寸 / 大小</dt>
            <dd>{file.size}</dd>
          </div>
          <div>
            <dt>上传日期</dt>
            <dd>{file.uploadedAt}</dd>
          </div>
          <div>
            <dt>文件类型</dt>
            <dd><span className="file-meta-chip">验收文件</span></dd>
          </div>
        </dl>
      {canWrite && <label className="inspector-field">
        <span>标签</span>
        <input
          ref={tagInputRef}
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void addTag()
            }
          }}
          placeholder={isSaving ? '保存中…' : '输入标签后按回车'}
        />
      </label>}
      <div className="inspector-tags">
        {tags.length === 0 && <em>暂无标签</em>}
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            {canWrite && <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => void removeTag(tag)}>
              <Trash2 size={12} />
            </button>}
          </span>
        ))}
      </div>
      <section className="file-understanding">
        <div className="file-understanding-header">
          <div>
            <span>交付件理解</span>
            <strong>
              {!analysis ? '等待分析' : analysis.status === 'completed' ? '已完成' : analysis.status === 'processing' ? '分析中' : analysis.status === 'pending' ? '排队中' : '需要重试'}
            </strong>
          </div>
          {canDelete && <button
            type="button"
            className="ghost-button compact-button"
            disabled={isRetrying || analysis?.status === 'processing'}
            onClick={() => {
              setIsRetrying(true)
              void onRetryAnalysis(file.id).finally(() => setIsRetrying(false))
            }}
          >
            <RotateCcw size={13} />
            {isRetrying ? '提交中' : '重新分析'}
          </button>}
        </div>
        {analysis?.status === 'completed' ? (
          <>
            <p className="file-understanding-summary">{analysis.summary}</p>
            <div className="file-understanding-meta">
              <span>{analysis.contentType || file.type}</span>
              <span>{analysis.provider} / {analysis.model}</span>
              <strong className="analysis-confidence">置信度{analysis.confidence || '中'}</strong>
            </div>
            <div className="file-understanding-sections">
              <AnalysisList title="需求匹配" items={analysis.requirementMatches} emptyText="暂无明确匹配结论" />
              <AnalysisList title="质量分析" items={analysis.qualityIssues} emptyText="未发现明确质量问题" />
              <AnalysisList title="风险与建议" items={[...analysis.risks, ...analysis.suggestions]} emptyText="暂无额外风险或建议" />
            </div>
          </>
        ) : (
          <p className={`file-understanding-message ${analysis?.status === 'failed' || analysis?.status === 'unsupported' ? 'error' : ''}`}>
            {analysis?.errorMessage || '文件上传后会自动解析内容，并结合任务需求给出质量与风险判断。'}
          </p>
        )}
      </section>
      <div className="inspector-actions">
        <button className="primary-button" type="button" onClick={() => onDownload(file)}>
          <Download size={15} />
          下载
        </button>
        <button className="ghost-button" type="button" onClick={() => sourceUrl && window.open(sourceUrl, '_blank', 'noreferrer')}>
          打开原文件
        </button>
        {canDelete && <button className="ghost-button danger-text-button" type="button" onClick={() => onDelete(file.id)}>
          删除
        </button>}
      </div>
      </aside>
    </>
  )
}

function FileThumbnailPreview({ file, inspector = false }: { file: FileAsset; inspector?: boolean }) {
  const fileType = fileTypeForAsset(file).type
  const previewUrl = authedPreviewUrl(file.previewUrl)
  const sourceUrl = fileDocumentPreviewSource(file)

  if (previewUrl || (isInlineImageFileType(fileType) && sourceUrl)) {
    return <img src={previewUrl ?? sourceUrl} alt={file.name} loading="lazy" />
  }

  if (['PDF', 'AI'].includes(fileType) && sourceUrl) {
    return <PdfThumbnail sourceUrl={sourceUrl} label={file.name} />
  }

  if (fileType === 'PSD' && sourceUrl) {
    return <PsdThumbnail sourceUrl={sourceUrl} label={file.name} />
  }

  if (isOfficeFileType(fileType) && sourceUrl) {
    return (
      <div className={`file-thumbnail-office ${inspector ? 'inspector' : ''}`}>
        <OfficePreview fileType={fileType} sourceUrl={sourceUrl} compact />
      </div>
    )
  }

  if (videoFileTypes.has(fileType) && sourceUrl) {
    return <video className="file-thumbnail-video" src={sourceUrl} muted playsInline preload="metadata" />
  }

  return (
    <div className={`file-thumb-placeholder ${inspector ? 'file-thumb-document-large' : ''}`}>
      {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
      <strong>{fileType}</strong>
      <span>暂时无法生成缩略图</span>
    </div>
  )
}

function PdfThumbnail({ sourceUrl, label }: { sourceUrl: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const renderFirstPage = async () => {
      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('PDF 读取失败')
        }
        const data = await response.arrayBuffer()
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const document = await pdfjs.getDocument({ data }).promise
        const page = await document.getPage(1)
        const baseViewport = page.getViewport({ scale: 1 })
        const targetWidth = 720
        const viewport = page.getViewport({ scale: targetWidth / baseViewport.width })
        const canvas = canvasRef.current
        if (!canvas || cancelled) {
          return
        }
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas 不可用')
        }
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvasContext: context, viewport }).promise
      } catch (error) {
        console.warn('PDF thumbnail generation failed', error)
        if (!cancelled) {
          setFailed(true)
        }
      }
    }
    void renderFirstPage()
    return () => {
      cancelled = true
    }
  }, [sourceUrl])

  if (failed) {
    return (
      <div className="file-thumb-placeholder">
        <FileText size={42} />
        <strong>PDF</strong>
        <span>缩略图生成失败</span>
      </div>
    )
  }

  return <canvas ref={canvasRef} className="file-thumbnail-canvas" aria-label={`${label} 第一页缩略图`} />
}

function PsdThumbnail({ sourceUrl, label }: { sourceUrl: string; label: string }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    const renderPsd = async () => {
      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('PSD 读取失败')
        }
        const source = new File([await response.blob()], label, { type: 'image/vnd.adobe.photoshop' })
        const preview = await createPsdPreviewFile(source)
        if (!preview || cancelled) {
          throw new Error('PSD 无合成预览')
        }
        objectUrl = URL.createObjectURL(preview)
        setPreviewUrl(objectUrl)
      } catch (error) {
        console.warn('PSD thumbnail generation failed', error)
        if (!cancelled) {
          setFailed(true)
        }
      }
    }
    void renderPsd()
    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [label, sourceUrl])

  if (previewUrl) {
    return <img src={previewUrl} alt={label} loading="lazy" />
  }

  return (
    <div className="file-thumb-placeholder">
      <FileImage size={42} />
      <strong>PSD</strong>
      <span>{failed ? '缩略图生成失败' : '正在生成缩略图'}</span>
    </div>
  )
}

function AnalysisList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  )
}

function InsightsView({
  tasks,
  updates,
  files,
  attachmentAnalyses,
  reports,
  currentMonth,
  hourlyRate,
}: {
  tasks: Task[]
  updates: TaskUpdate[]
  files: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  reports: ReportRecord[]
  currentMonth: { label: string; value: string }
  hourlyRate: number
}) {
  const [period, setPeriod] = useState<InsightPeriod>('month')
  const [insightHistory, setInsightHistory] = useState<InsightHistoryItem[]>([])
  const [historyError, setHistoryError] = useState('')
  const [activeInsightKey, setActiveInsightKey] = useState<string>('rv:month')
  const range = useMemo(() => insightPeriodRange(period, currentMonth.value), [currentMonth.value, period])
  const rangeLabel = formatInsightRange(range)

  const periodTasks = useMemo(
    () =>
      tasks.filter((task) => isTaskInAnalysisRange(task, range)),
    [range, tasks],
  )
  const periodTaskIds = useMemo(() => new Set(periodTasks.map((task) => task.id)), [periodTasks])
  const periodUpdates = useMemo(
    () => updates.filter((update) => periodTaskIds.has(update.taskId) || isDateInRange(update.date, range)),
    [periodTaskIds, range, updates],
  )
  const periodFiles = useMemo(
    () => files.filter((file) => periodTaskIds.has(file.taskId) || isDateInRange(file.uploadedAt, range)),
    [files, periodTaskIds, range],
  )
  const analysisByAttachment = useMemo(
    () => new Map(attachmentAnalyses.map((analysis) => [analysis.attachmentId, analysis])),
    [attachmentAnalyses],
  )
  const periodAnalyses = useMemo(
    () => periodFiles.map((file) => analysisByAttachment.get(file.id)).filter((analysis): analysis is AttachmentAnalysis => Boolean(analysis)),
    [analysisByAttachment, periodFiles],
  )
  const completedAnalyses = periodAnalyses.filter((analysis) => analysis.status === 'completed')
  const filesByTask = useMemo(() => {
    const map = new Map<number, FileAsset[]>()
    periodFiles.forEach((file) => {
      map.set(file.taskId, [...(map.get(file.taskId) ?? []), file])
    })
    return map
  }, [periodFiles])
  const updatesByTask = useMemo(() => {
    const map = new Map<number, TaskUpdate[]>()
    periodUpdates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        map.set(update.taskId, [...(map.get(update.taskId) ?? []), update])
      })
    return map
  }, [periodUpdates])

  const acceptedTasks = periodTasks.filter((task) => task.status === '已验收')
  const billableTasks = periodTasks.filter((task) => isTaskBillable(task))
  const totalHours = Number(billableTasks.reduce((sum, task) => sum + task.actualHours, 0).toFixed(1))
  const estimatedHours = Number(billableTasks.reduce((sum, task) => sum + task.estimatedHours, 0).toFixed(1))
  const acceptedRate = periodTasks.length > 0 ? Math.round((acceptedTasks.length / periodTasks.length) * 100) : 0
  const visualReadyCount = periodFiles.filter(isVisualReviewReady).length
  const lockedReports = reports.filter((report) => {
    const reportDate = dateFromValue(`${report.month}-01`)
    return reportDate ? reportDate >= range.start && reportDate <= range.end : false
  }).length

  const hoursByType = new Map<string, number>()
  billableTasks.forEach((task) => {
    if (task.actualHours <= 0) {
      return
    }
    hoursByType.set(task.type, Number(((hoursByType.get(task.type) ?? 0) + task.actualHours).toFixed(1)))
  })
  const typeDistributionItems: DonutItem[] = [...hoursByType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({ label, value, color: donutPalette[index % donutPalette.length] }))
  const typeDistribution = { items: typeDistributionItems, total: Number(typeDistributionItems.reduce((sum, item) => sum + item.value, 0).toFixed(1)) }

  const waitingMinutes = periodTasks.reduce((sum, task) => sum + sumWaitingEntries(task), 0)
  const waitingHours = Number((waitingMinutes / 60).toFixed(1))
  const leadingType = typeDistribution.items[0]
  const selectedInsightKind = activeInsightKey.split(':')[0]
  const selectedInsightValue = activeInsightKey.split(':')[1]
  const riskRows = useMemo(() => {
    const todayValue = isoDate()
    return periodTasks.flatMap((task) => {
      const taskFiles = filesByTask.get(task.id) ?? []
      const taskUpdates = updatesByTask.get(task.id) ?? []
      const risks: { task: Task; tone: 'danger' | 'warning' | 'info'; label: string; detail: string }[] = []
      if (task.estimatedHours > 0 && task.actualHours > task.estimatedHours * 1.3) {
        risks.push({
          task,
          tone: 'danger',
          label: '工时超预估',
          detail: `实际 ${task.actualHours.toFixed(1)}h，预估 ${task.estimatedHours.toFixed(1)}h，超出 ${Math.round((task.actualHours / task.estimatedHours - 1) * 100)}%。`,
        })
      }
      if (!['已验收', '终止', '不计费'].includes(task.status) && datePart(task.estimatedDate || task.date) < todayValue) {
        risks.push({
          task,
          tone: 'danger',
          label: '交付逾期',
          detail: `预计交付 ${formatPlanDateTime(task.estimatedDate || task.date)}，当前状态为 ${task.status}。`,
        })
      }
      if (['进行中', '待验收'].includes(task.status) && taskUpdates.length === 0) {
        risks.push({
          task,
          tone: 'warning',
          label: '缺少进展记录',
          detail: '当前周期内没有进展记录，后续复盘会缺少过程依据。',
        })
      }
      if (['待验收', '已验收'].includes(task.status) && taskFiles.length === 0 && (task.acceptanceFiles?.length ?? 0) === 0) {
        risks.push({
          task,
          tone: 'warning',
          label: '缺少交付附件',
          detail: '任务已到验收阶段，但没有关联交付件，后续无法做文件级复盘。',
        })
      }
      return risks
    }).slice(0, 10)
  }, [filesByTask, periodTasks, updatesByTask])
  const periodReviewData = [
    ['周期范围', rangeLabel],
    ['计费工时', `${totalHours.toFixed(1)}h`],
    ['任务数', `${periodTasks.length} 个`],
    ['验收率', `${acceptedRate}%`],
    ['等待合计', `${waitingHours.toFixed(1)}h`],
    ['综合时薪', `¥${hourlyRate}/h`],
  ]
  const periodReviewDiagnostics = [
    estimatedHours > 0
      ? `预估 ${estimatedHours.toFixed(1)}h → 实际 ${totalHours.toFixed(1)}h，偏差 ${Math.round(((totalHours - estimatedHours) / estimatedHours) * 100)}%`
      : '暂无预估工时基线，后续可通过任务排期建立对照',
    leadingType ? `${leadingType.label} 是本周期主要工时类型，占 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%` : '暂无可形成类型结构的工时',
    riskRows.length > 0 ? `发现 ${riskRows.length} 个需要复核的链路信号` : '当前未发现明显逾期、超时或附件缺口',
  ]
  const periodReviewAdvice = [
    riskRows.length > 0 ? '优先处理异常任务，再锁定结算与验收附件' : '保持当前记录节奏，继续要求验收时留存确认凭证',
    waitingHours > 0 ? '把等待原因写入等待记录，避免复盘时误判为设计耗时' : '等待记录较少，可继续用分段计时沉淀真实工作链路',
    leadingType ? `沉淀「${leadingType.label}」的交付模板和报价基线` : '先积累 3 条以上同类任务后再判断报价结构',
  ]
  const summaryReportStats = [
    ['任务', `${periodTasks.length} 个`],
    ['计费工时', `${totalHours.toFixed(1)}h`],
    ['验收', `${acceptedTasks.length} / ${periodTasks.length}`],
    ['等待', `${waitingHours.toFixed(1)}h`],
    ['可预览附件', `${visualReadyCount} 个`],
    ['异常信号', `${riskRows.length} 条`],
  ]
  const summaryReportHighlights = [
    periodTasks.length > 0
      ? `${rangeLabel} 共纳入 ${periodTasks.length} 个任务，计费工时 ${totalHours.toFixed(1)}h，验收率 ${acceptedRate}%。`
      : `${rangeLabel} 暂无进入复盘范围的任务，可先从任务记录和附件完整度开始积累。`,
    leadingType
      ? `主要工作类型为「${leadingType.label}」，占本期计费工时 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%。`
      : '本期暂未形成稳定的设计类型结构。',
    riskRows.length > 0
      ? `发现 ${riskRows.length} 条需要复核的链路信号，建议先处理逾期、超时或交付附件缺口。`
      : '暂未发现明显逾期、超时或附件缺口，当前记录链路较稳定。',
  ]
  const summaryReportActions = [
    riskRows.length > 0 ? '先打开项目诊断逐条核对异常任务，修正进展、附件或验收状态。' : '继续保持分段计时和验收附件留存，方便后续结算复盘。',
    waitingHours > 0 ? '等待原因要写入等待记录，避免 AI 把甲方反馈等待误判为设计执行时间。' : '若后续出现甲方反馈停滞，及时补一条等待记录。',
    leadingType ? `把「${leadingType.label}」沉淀成报价和交付模板，下次同类任务直接复用。` : '先积累 3 条以上同类任务，再判断报价与排期模板。',
  ]
  const reportUnit = period === 'week' ? '本周' : period === 'month' ? '本月' : '本期'
  const periodTimeSegments = periodTasks.flatMap((task) => (task.timeEntries ?? [])
    .map((entry) => {
      const startDate = entry.date || datePart(task.date)
      const endDate = entry.endDate || startDate
      const startStamp = dateTimeMinuteStamp(startDate, entry.start)
      const endStamp = dateTimeMinuteStamp(endDate, entry.end)
      const score = lateNightScore(entry.end)
      if (!Number.isFinite(startStamp) || !Number.isFinite(endStamp) || !Number.isFinite(score)) {
        return null
      }
      return { task, entry, startDate, endDate, startStamp, endStamp, score }
    })
    .filter((item): item is {
      task: Task
      entry: TimeEntry
      startDate: string
      endDate: string
      startStamp: number
      endStamp: number
      score: number
    } => Boolean(item))
    .filter((item) => isDateInRange(`${item.endDate}T${item.entry.end}`, range)))
  const latestWorkMoment = periodTimeSegments
    .slice()
    .sort((a, b) => b.score - a.score || b.endStamp - a.endStamp)[0]
  const eventMoments = [
    ...periodTasks.map((task) => ({
      kind: '新建任务',
      label: task.title,
      value: task.date,
      detail: task.requester ? `需求人 ${task.requester}` : task.type,
    })),
    ...periodTimeSegments
      .filter(({ entry }) => entry.isAcceptanceProgress)
      .map(({ task, entry, endDate }) => ({
        kind: '验收进展',
        label: task.title,
        value: `${endDate}T${entry.end}`,
        detail: entry.note || '完成验收确认',
      })),
    ...periodFiles.map((file) => ({
      kind: file.scope === 'acceptance' ? '上传验收附件' : '上传过程附件',
      label: file.name,
      value: file.uploadedAt,
      detail: file.task,
    })),
  ]
    .map((item) => {
      const clock = formatTimePart(item.value)
      const score = lateNightScore(clock)
      return clock && Number.isFinite(score) && isDateInRange(item.value, range) ? { ...item, clock, score } : null
    })
    .filter((item): item is {
      kind: string
      label: string
      value: string
      detail: string
      clock: string
      score: number
    } => Boolean(item))
  const nightMoments = eventMoments
    .filter((item) => {
      const minutes = clockMinutes(item.clock)
      return Number.isFinite(minutes) && (minutes >= 22 * 60 || minutes < 6 * 60)
    })
    .sort((a, b) => b.score - a.score || b.value.localeCompare(a.value))
    .slice(0, 3)
  const busiestTask = periodTasks
    .slice()
    .sort((a, b) => b.actualHours - a.actualHours)[0]
  const reportStoryLines = [
    periodTasks.length > 0
      ? `${reportUnit}推进了 ${periodTasks.length} 个任务，完成 ${acceptedTasks.length} 个验收，沉淀 ${periodFiles.length} 个附件；计费工时 ${totalHours.toFixed(1)}h，预计收入 ¥${formatYuan(totalHours * hourlyRate)}。`
      : `${reportUnit}还没有进入复盘范围的任务，建议先从新建任务、记录进展和上传附件开始沉淀数据。`,
    leadingType
      ? `工作重心集中在「${leadingType.label}」，占计费工时 ${Math.round((leadingType.value / Math.max(typeDistribution.total, 1)) * 100)}%，可以作为下一轮报价和模板复用的重点。`
      : '当前还没有形成稳定的设计类型结构，先积累 3 条以上同类任务，再判断报价和排期基线。',
    latestWorkMoment
      ? `${reportUnit}最晚一次收工停在 ${formatMonthDay(latestWorkMoment.endDate)} ${latestWorkMoment.entry.end}，来自「${latestWorkMoment.task.title}」。`
      : `${reportUnit}暂未记录可用于判断最晚收工的分段计时。`,
  ]
  const recapMoments = [
    {
      label: '最晚奋斗时间',
      value: latestWorkMoment ? `${latestWorkMoment.entry.end}` : '暂无',
      detail: latestWorkMoment ? `${formatMonthDay(latestWorkMoment.endDate)} · ${latestWorkMoment.task.title}` : '记录分段计时后自动生成',
    },
    {
      label: '最吃工时任务',
      value: busiestTask ? `${busiestTask.actualHours.toFixed(1)}h` : '暂无',
      detail: busiestTask ? busiestTask.title : '暂无计费任务',
    },
    {
      label: '深夜仍在线',
      value: nightMoments.length > 0 ? `${nightMoments.length} 次` : '0 次',
      detail: nightMoments[0] ? `${formatMonthDayTime(nightMoments[0].value)} · ${nightMoments[0].kind}` : '本期没有 22:00 后或 06:00 前的关键动作',
    },
  ]
  const weeklyReportLines = [
    `${reportUnit}主要完成：${acceptedTasks.length > 0 ? acceptedTasks.slice(0, 3).map((task) => `「${task.title}」`).join('、') : '继续推进任务记录和交付准备'}。`,
    `投入情况：计费 ${totalHours.toFixed(1)}h，等待 ${waitingHours.toFixed(1)}h，${riskRows.length > 0 ? `有 ${riskRows.length} 条链路信号需要复核` : '暂无明显逾期、超时或附件缺口'}。`,
    `下步计划：${riskRows.length > 0 ? '先处理异常信号，再锁定结算与验收附件' : leadingType ? `沉淀「${leadingType.label}」模板，继续保持分段计时和验收附件留存` : '继续积累同类任务样本，补齐进展与附件记录'}。`,
  ]
  const projectDiagnosisRows = periodTasks
    .slice()
    .sort((a, b) => {
      const aDeviation = a.estimatedHours > 0 ? a.actualHours / a.estimatedHours : 0
      const bDeviation = b.estimatedHours > 0 ? b.actualHours / b.estimatedHours : 0
      return bDeviation - aDeviation || b.actualHours - a.actualHours
    })
    .slice(0, 8)
    .map((task) => {
      const taskFiles = filesByTask.get(task.id) ?? []
      const taskUpdates = updatesByTask.get(task.id) ?? []
      const deviation = task.estimatedHours > 0 ? Math.round(((task.actualHours - task.estimatedHours) / task.estimatedHours) * 100) : 0
      const hasRisk = riskRows.some((risk) => risk.task.id === task.id)
      return {
        task,
        files: taskFiles,
        updates: taskUpdates,
        deviation,
        hasRisk,
        deliveryText: task.status === '已验收'
          ? `已验收 · ${task.actualDeliveryDate ? formatPlanDateTime(task.actualDeliveryDate) : '交付时间未记录'}`
          : `计划 ${formatPlanDateTime(task.estimatedDate || task.date)}`,
      }
    })
  const requesterProfileRows = useMemo(() => {
    type RequesterProfile = {
      name: string
      projects: number
      hours: number
      accepted: number
      updates: number
      waiting: number
      devSum: number
      devCount: number
      overrun: number
      onTime: number
      late: number
      smooth: number
      fair: number
      problem: number
      tagCounts: Map<TaskFeedbackTag, number>
      revisionMentions: number
      acceptanceFiles: number
      feedbackShots: number
      qualityIssues: number
      risks: number
      issueSamples: Set<string>
      suggestionSamples: Set<string>
    }
    const map = new Map<string, RequesterProfile>()
    const requesterByTask = new Map<number, string>()
    const ensure = (name: string) => {
      let item = map.get(name)
      if (!item) {
        item = {
          name, projects: 0, hours: 0, accepted: 0, updates: 0, waiting: 0,
          devSum: 0, devCount: 0, overrun: 0, onTime: 0, late: 0,
          smooth: 0, fair: 0, problem: 0, tagCounts: new Map(), revisionMentions: 0,
          acceptanceFiles: 0, feedbackShots: 0, qualityIssues: 0, risks: 0,
          issueSamples: new Set(), suggestionSamples: new Set(),
        }
        map.set(name, item)
      }
      return item
    }
    periodTasks.forEach((task) => {
      const name = task.requester || '未填写'
      requesterByTask.set(task.id, name)
      const c = ensure(name)
      c.projects += 1
      c.hours += task.actualHours
      c.accepted += task.status === '已验收' ? 1 : 0
      c.updates += (task.timeEntries ?? []).length
      // 改稿轮次：只数显式勾选「本次为改稿轮次」的分段，避免把分阶段提交误判为改稿
      c.revisionMentions += (task.timeEntries ?? []).filter((entry) => entry.isRevision).length
      c.waiting += sumWaitingEntries(task) / 60
      if (task.estimatedHours > 0 && task.actualHours > 0) {
        const dev = (task.actualHours - task.estimatedHours) / task.estimatedHours
        c.devSum += dev
        c.devCount += 1
        if (dev > 0.25) c.overrun += 1
      }
      if (task.status === '已验收' && task.estimatedDate && task.actualDeliveryDate) {
        if (datePart(task.actualDeliveryDate) <= datePart(task.estimatedDate)) c.onTime += 1
        else c.late += 1
      }
      if (task.feedbackRating === '有问题') c.problem += 1
      else if (task.feedbackRating === '一般') c.fair += 1
      else if (task.feedbackRating === '顺利') c.smooth += 1
      ;(task.feedbackTags ?? []).forEach((tag) => c.tagCounts.set(tag, (c.tagCounts.get(tag) ?? 0) + 1))
    })
    periodFiles.forEach((file) => {
      const name = requesterByTask.get(file.taskId)
      if (!name) return
      const c = map.get(name)
      if (!c) return
      if (file.scope === 'acceptance') c.acceptanceFiles += 1
      if (/反馈|意见|批注|沟通|截图|确认/.test(`${file.name} ${file.tag ?? ''}`)) c.feedbackShots += 1
    })
    completedAnalyses.forEach((analysis) => {
      const name = requesterByTask.get(analysis.taskId)
      if (!name) return
      const c = map.get(name)
      if (!c) return
      c.qualityIssues += analysis.qualityIssues?.length ?? 0
      c.risks += analysis.risks?.length ?? 0
      ;(analysis.qualityIssues ?? []).forEach((issue) => issue && c.issueSamples.add(issue))
      ;(analysis.suggestions ?? []).forEach((tip) => tip && c.suggestionSamples.add(tip))
    })
    return [...map.values()].sort((a, b) => b.hours - a.hours).slice(0, 8)
  }, [periodTasks, periodFiles, completedAnalyses])
  const selectedProject = selectedInsightKind === 'pd' ? projectDiagnosisRows[Number(selectedInsightValue)] : undefined
  const selectedRequester = selectedInsightKind === 'cp' ? requesterProfileRows[Number(selectedInsightValue)] : undefined
  useEffect(() => {
    let ignore = false
    api.getInsightHistory()
      .then((items) => {
        if (!ignore) {
          setInsightHistory(items)
          setHistoryError('')
        }
      })
      .catch((error) => {
        if (!ignore) {
          setHistoryError(error instanceof Error ? error.message : '洞察追踪记录读取失败')
        }
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <section className="insights-view insights-redesign">
      <section className="panel insights-hero">
        <div>
          <p className="eyebrow">数据洞察</p>
          <h2>周期复盘与交付链路分析</h2>
          <span>{rangeLabel} · 基于历史任务、当前周期、进展、验收和附件完整度自动复盘</span>
        </div>
      </section>

      <div className="insight-reference-layout">
        <aside className="insight-tree" aria-label="洞察目录">
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>总结报告</span>
            </button>
            <button
              type="button"
              className={`insight-tree-item ${selectedInsightKind === 'sr' ? 'active' : ''}`}
              onClick={() => setActiveInsightKey(`sr:${period}`)}
            >
              <span>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}总结</span>
            </button>
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>周期复盘</span>
            </button>
            {insightPeriods.map((item) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `rv:${item.value}` ? 'active' : ''}`}
                key={item.value}
                onClick={() => {
                  setPeriod(item.value)
                  setActiveInsightKey(`rv:${item.value}`)
                }}
              >
                <span>{item.label}复盘</span>
              </button>
            ))}
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>项目诊断 · {currentMonth.label}</span>
            </button>
            {projectDiagnosisRows.map((item, index) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `pd:${index}` ? 'active' : ''}`}
                key={item.task.id}
                onClick={() => setActiveInsightKey(`pd:${index}`)}
              >
                <span>{item.task.title}</span>
              </button>
            ))}
            {projectDiagnosisRows.length === 0 && (
              <p className="insight-tree-empty">本月暂无需要关注的异常任务</p>
            )}
          </div>
          <div className="insight-tree-group">
            <button type="button" className="insight-tree-head">
              <span>需求人画像</span>
            </button>
            {requesterProfileRows.map((item, index) => (
              <button
                type="button"
                className={`insight-tree-item ${activeInsightKey === `cp:${index}` ? 'active' : ''}`}
                key={item.name}
                onClick={() => setActiveInsightKey(`cp:${index}`)}
              >
                <span>{item.name}</span>
              </button>
            ))}
            {requesterProfileRows.length === 0 && (
              <p className="insight-tree-empty">周期内出现记录需求人的任务后生成画像</p>
            )}
          </div>
        </aside>

        <section className="insight-document">
          {selectedInsightKind === 'sr' && (
            <>
              <div className="sec-head">
                <h2>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}总结报告</h2>
                <p>{rangeLabel} · 面向结算、排期和下次协作的简要复盘</p>
              </div>
              <article className="summary-report" aria-label="洞察总结报告">
                <p className="summary-report-lead">
                  {reportStoryLines.join(' ')}
                </p>
                <section className="summary-report-weekly">
                  <h3>可直接放进周报</h3>
                  {weeklyReportLines.map((line, index) => (
                    <p key={line}><strong>{index === 0 ? '完成' : index === 1 ? '投入' : '下步'}</strong>{line}</p>
                  ))}
                </section>
                <dl className="summary-report-moments">
                  {recapMoments.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </dl>
                {nightMoments.length > 0 && (
                  <section className="summary-report-night">
                    <h3>夜间小传记</h3>
                    {nightMoments.map((item) => (
                      <p key={`${item.kind}-${item.value}-${item.label}`}>
                        <strong>{formatMonthDayTime(item.value)}</strong>
                        <span>{item.kind} · {item.label}</span>
                      </p>
                    ))}
                  </section>
                )}
                <dl className="summary-report-metrics">
                  {summaryReportStats.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="summary-report-grid">
                  <section>
                    <h3>本期结论</h3>
                    <ul>
                      {summaryReportHighlights.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </section>
                  <section>
                    <h3>下一步动作</h3>
                    <ul>
                      {summaryReportActions.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </section>
                </div>
                {riskRows.length > 0 && (
                  <section className="summary-report-risks">
                    <h3>优先复核</h3>
                    {riskRows.slice(0, 4).map((risk) => (
                      <div className="summary-risk-row" key={`${risk.task.id}-${risk.label}`}>
                        <span>{risk.label}</span>
                        <b>{risk.task.title}</b>
                        <p>{risk.detail}</p>
                      </div>
                    ))}
                  </section>
                )}
              </article>
            </>
          )}

          {selectedInsightKind === 'rv' && (
            <>
              <div className="sec-head">
                <h2>{insightPeriods.find((item) => item.value === period)?.label ?? '周期'}复盘</h2>
                <p>数据 · 诊断 · 建议（基于历史任务、进展、等待和验收附件完整度）</p>
              </div>
              <div className="review-grid">
                <div className="rv-col">
                  <span className="label">数据</span>
                  {periodReviewData.map(([label, value]) => (
                    <div className="rv-data" key={label}><span className="k">{label}</span><b>{value}</b></div>
                  ))}
                </div>
                <div className="rv-col">
                  <span className="label">诊断</span>
                  {periodReviewDiagnostics.map((item, index) => <div className={`rv-item ${index === 0 && item.includes('+') ? 'warn' : ''}`} key={item}>{item}</div>)}
                </div>
                <div className="rv-col">
                  <span className="label">建议</span>
                  {periodReviewAdvice.map((item) => <div className="rv-item adv" key={item}>{item}</div>)}
                </div>
              </div>
              <div className="rv-note">
                已完成 {completedAnalyses.length} 个交付件内容分析；{visualReadyCount} 个附件可预览；{lockedReports} 期结算已锁定；追踪中的历史洞察 {insightHistory.filter((item) => item.status === 'open' || item.status === 'improved').length} 条。
                {historyError ? ` ${historyError}` : ''}
              </div>
            </>
          )}

          {selectedInsightKind === 'pd' && selectedProject && (
            <>
              <div className="sec-head">
                <h2>项目诊断 · {selectedProject.task.title}</h2>
                <p>接单 → 进行 → 交付 → 验收 · 工时偏差 / 沟通诊断 / 改进建议</p>
              </div>
              <div className="pdiag">
                <div className="pdiag-head">
                  <b>{selectedProject.task.title}</b>
                  <span>{selectedProject.task.requester || '未填写'}</span>
                  <span className={`pd-status st ${selectedProject.task.status === '已验收' ? 'done' : selectedProject.hasRisk ? 'pending' : 'active'}`}><i />{selectedProject.task.status}</span>
                </div>
                <div className="chain">
                  {[
                    ['接单', formatPlanDateTime(selectedProject.task.date)],
                    ['工时', `${selectedProject.task.actualHours.toFixed(1)}h · ${selectedProject.updates.length} 段`],
                    ['交付', `${selectedProject.files.length} 个交付件`],
                    ['验收', selectedProject.deliveryText],
                  ].map(([label, value], index, arr) => (
                    <Fragment key={label}>
                      <div className="chain-step"><span className="cs-t">{label}</span><span className="cs-v">{value}</span></div>
                      {index < arr.length - 1 && <span className="chain-arrow">→</span>}
                    </Fragment>
                  ))}
                </div>
                <div className="pd-gap">
                  <div className="pd-gap-h">
                    <span>工时偏差</span>
                    <b className={selectedProject.deviation > 15 ? 'warn' : selectedProject.deviation <= 0 ? 'good' : ''}>
                      预估 {selectedProject.task.estimatedHours.toFixed(1)}h → 实际 {selectedProject.task.actualHours.toFixed(1)}h（{selectedProject.deviation >= 0 ? '+' : ''}{selectedProject.deviation}%）
                    </b>
                  </div>
                  <div className="pd-gap-d">
                    <span className="ml">偏差原因</span>
                    {selectedProject.hasRisk ? '该项目命中异常信号，请优先核对进展备注、交付附件和验收状态。' : '当前项目链路相对顺畅，可作为同类任务的报价与排期参照。'}
                  </div>
                </div>
                <div className="pdiag-finds">
                  {(riskRows.filter((risk) => risk.task.id === selectedProject.task.id).length > 0
                    ? riskRows.filter((risk) => risk.task.id === selectedProject.task.id)
                    : [{ label: '链路完整', detail: '暂无明显逾期、超时或附件缺口。', tone: 'info' as const, task: selectedProject.task }]
                  ).map((risk) => (
                    <div className="pd-find" key={`${risk.label}-${risk.detail}`}>
                      <span className={`tag ${risk.tone === 'danger' ? 'risk' : risk.tone === 'warning' ? 'gap' : 'open'}`}>{risk.label}</span>
                      <span>{risk.detail}</span>
                    </div>
                  ))}
                </div>
                <div className="pd-advice"><span className="ml">改进建议</span>{selectedProject.hasRisk ? '下次接单前先锁定范围、交付物格式和验收凭证；超出预估时及时补一条进展说明。' : '沉淀为合格交付模板，后续同类任务可沿用当前排期与附件要求。'}</div>
              </div>
            </>
          )}

          {selectedInsightKind === 'cp' && selectedRequester && (() => {
            const c = selectedRequester
            const acceptRate = Math.round((c.accepted / Math.max(c.projects, 1)) * 100)
            const deliveredTotal = c.onTime + c.late
            const onTimeRate = deliveredTotal > 0 ? Math.round((c.onTime / deliveredTotal) * 100) : null
            const avgDev = c.devCount > 0 ? Math.round((c.devSum / c.devCount) * 100) : null
            const avgRevisions = c.projects > 0 ? c.revisionMentions / c.projects : 0
            const topTags = [...c.tagCounts.entries()].sort((a, b) => b[1] - a[1])
            const ratedTotal = c.smooth + c.fair + c.problem
            // 与「你其他需求人」对比，用于判断耗时偏长/偏短、需求难易
            const hpp = c.hours / Math.max(c.projects, 1)
            const cohortHpp = requesterProfileRows.length > 0
              ? requesterProfileRows.reduce((sum, row) => sum + row.hours / Math.max(row.projects, 1), 0) / requesterProfileRows.length
              : hpp
            // 该需求人的特征画像：把数据翻译成对「这个人」的判断
            const traits: { text: string; tone: 'good' | 'warn' | 'info' }[] = []
            if (acceptRate >= 90) traits.push({ tone: 'good', text: `验收通过率高（${acceptRate}%），交付多数一次过` })
            else if (acceptRate < 60) traits.push({ tone: 'warn', text: `验收通过率偏低（${acceptRate}%），返工概率较高` })
            else traits.push({ tone: 'info', text: `验收通过率一般（${acceptRate}%）` })
            const vagueReq = avgRevisions > 1.5 || (avgDev !== null && avgDev > 30) || c.tagCounts.has('需求不清晰')
            const clearReq = avgRevisions <= 1 && (avgDev === null || Math.abs(avgDev) <= 20) && !c.tagCounts.has('需求不清晰')
            if (clearReq) traits.push({ tone: 'good', text: '需求表达明确，改稿少、实际工时贴近预估' })
            else if (vagueReq) traits.push({ tone: 'warn', text: '需求偏模糊，常需多轮确认与改稿' })
            else traits.push({ tone: 'info', text: '需求明确度中等' })
            if (hpp > cohortHpp * 1.25) traits.push({ tone: 'info', text: `单项目耗时偏长（均 ${hpp.toFixed(1)}h，高于你的平均 ${cohortHpp.toFixed(1)}h）` })
            else if (hpp < cohortHpp * 0.75) traits.push({ tone: 'info', text: `单项目耗时较短（均 ${hpp.toFixed(1)}h），推进快` })
            else traits.push({ tone: 'info', text: `单项目耗时适中（均 ${hpp.toFixed(1)}h）` })
            if (hpp <= cohortHpp && acceptRate >= 80 && (avgDev === null || avgDev <= 15)) traits.push({ tone: 'good', text: '需求相对简单、好交付，较容易获得工时（性价比高）' })
            else if (hpp > cohortHpp * 1.25 || (avgDev !== null && avgDev > 25)) traits.push({ tone: 'info', text: '需求较重、耗时，但单项目能积累更多工时' })
            if (c.waiting > 2) traits.push({ tone: 'warn', text: `确认 / 反馈偏慢，等待较多（${c.waiting.toFixed(1)}h）` })
            else if (c.waiting <= 0) traits.push({ tone: 'good', text: '确认及时，几乎无等待' })
            if (avgDev !== null && Math.abs(avgDev) <= 15) traits.push({ tone: 'good', text: '工时可预估，报价风险低' })
            else if (avgDev !== null && avgDev > 30) traits.push({ tone: 'warn', text: `实际工时常超预估（+${avgDev}%），报价需留缓冲` })
            // 修改轮次：判断该需求人是否频繁要求改稿
            if (avgRevisions > 2) traits.push({ tone: 'warn', text: `改稿轮次偏多（均 ${avgRevisions.toFixed(1)} 轮/项目），来回打磨成本高` })
            else if (avgRevisions > 1.5) traits.push({ tone: 'info', text: `改稿轮次略多（均 ${avgRevisions.toFixed(1)} 轮/项目）` })
            else if (avgRevisions > 0 && avgRevisions <= 1) traits.push({ tone: 'good', text: `改稿轮次少（均 ${avgRevisions.toFixed(1)} 轮/项目），定稿利落` })
            // 延迟率：交付未按时占比，判断是否常拖期
            const lateRate = onTimeRate === null ? null : 100 - onTimeRate
            if (lateRate !== null && lateRate >= 40) traits.push({ tone: 'warn', text: `延迟率偏高（${lateRate}% 未按时交付），排期需多留缓冲` })
            else if (lateRate !== null && lateRate >= 20) traits.push({ tone: 'info', text: `延迟率中等（${lateRate}% 未按时）` })
            else if (lateRate !== null && lateRate < 10 && deliveredTotal >= 2) traits.push({ tone: 'good', text: `几乎不拖期（按时率 ${onTimeRate}%），节奏稳` })
            // 综合评级：以验收率、准时率、工时偏差、改稿密度、等待、体感问题加权
            const penalty =
              (avgDev !== null && avgDev > 25 ? 1 : 0) +
              (onTimeRate !== null && onTimeRate < 70 ? 1 : 0) +
              (c.waiting > 2 ? 1 : 0) +
              (avgRevisions > 1.5 ? 1 : 0) +
              (c.problem > 0 ? 1 : 0) +
              (acceptRate < 80 ? 1 : 0)
            const grade = penalty <= 1 ? 'A' : penalty <= 3 ? 'B' : 'C'
            const responsibility = c.problem > 0 || (avgDev !== null && avgDev > 25)
              ? '需重点跟进'
              : c.waiting > 0 || (onTimeRate !== null && onTimeRate < 70)
                ? '确认偏慢'
                : '配合顺畅'
            const adviceLines: string[] = []
            if (avgDev !== null && avgDev > 25) adviceLines.push(`实际工时平均超预估 ${avgDev}%，下次报价建议上浮或在开工前补一版需求确认稿。`)
            if (topTags.some(([tag]) => tag === '需求不清晰')) adviceLines.push('「需求不清晰」反复出现：开工前先产出需求 / 尺寸确认稿并留存确认截图，减少返工。')
            if (topTags.some(([tag]) => tag === '沟通成本高') || avgRevisions > 1.5) adviceLines.push('沟通 / 改稿成本偏高：约定每轮反馈时限与改稿轮次上限，超出按新增工时计。')
            if (topTags.some(([tag]) => tag === '定价偏低')) adviceLines.push('历史标记「定价偏低」：该需求人项目建议重新评估单价。')
            if (c.waiting > 2) adviceLines.push('等待耗时偏高：排期预留缓冲，并把等待计入洞察（不计结算）。')
            if (c.acceptanceFiles === 0 && c.accepted > 0) adviceLines.push('验收附件偏少：主动留存甲方确认截图 / 最终稿，作为后续对账与画像依据。')
            if (adviceLines.length === 0) adviceLines.push('链路顺畅，可作为优先排期对象，沿用当前报价与验收资料要求。')
            return (
            <>
              <div className="sec-head">
                <h2>需求人画像 · {c.name}</h2>
                <p>从历史任务总结「这个需求人如何主导项目」，指导下次报价、排期与验收</p>
              </div>
              <div className="cp">
                <div className="cp-head">
                  <b>{c.name}</b>
                  <span>{c.projects} 个项目 · {c.hours.toFixed(1)}h · 综合评级 {grade}</span>
                  <span className={`cp-resp ${c.waiting > 0 ? 'r-甲方' : 'r-共同'}`}>{responsibility}</span>
                </div>
                <div className="cp-stats">
                  <div className="cp-stat"><span className="k">合作项目</span><b>{c.projects}</b></div>
                  <div className="cp-stat"><span className="k">计费工时</span><b>{c.hours.toFixed(1)}h</b></div>
                  <div className="cp-stat"><span className="k">验收通过率</span><b className={acceptRate >= 80 ? 'good' : 'warn'}>{acceptRate}%</b></div>
                  <div className="cp-stat"><span className="k">单项目均时</span><b className={hpp > cohortHpp * 1.25 ? 'warn' : 'good'}>{hpp.toFixed(1)}h</b></div>
                  <div className="cp-stat"><span className="k">准时交付</span><b className={onTimeRate === null ? '' : onTimeRate >= 70 ? 'good' : 'warn'}>{onTimeRate === null ? '—' : `${onTimeRate}%`}</b></div>
                  <div className="cp-stat"><span className="k">工时偏差</span><b className={avgDev === null ? '' : avgDev > 25 ? 'warn' : 'good'}>{avgDev === null ? '—' : `${avgDev >= 0 ? '+' : ''}${avgDev}%`}</b></div>
                  <div className="cp-stat"><span className="k">平均改稿</span><b className={avgRevisions > 1.5 ? 'warn' : 'good'}>{avgRevisions.toFixed(1)} 轮</b></div>
                  <div className="cp-stat"><span className="k">等待耗时</span><b className={c.waiting > 2 ? 'warn' : 'good'}>{c.waiting.toFixed(1)}h</b></div>
                </div>

                <div className="cp-sub">这位需求人的特征</div>
                <ul className="cp-traits">
                  {traits.map((trait, index) => (
                    <li key={index} className={`cp-trait t-${trait.tone}`}><i />{trait.text}</li>
                  ))}
                </ul>

                <div className="cp-sub">体感与高频反馈</div>
                {ratedTotal > 0 ? (
                  <div className="cp-dist">
                    <span className="cp-dist-seg s-good" style={{ flexGrow: Math.max(c.smooth, 0.001) }}>顺利 {c.smooth}</span>
                    <span className="cp-dist-seg s-fair" style={{ flexGrow: Math.max(c.fair, 0.001) }}>一般 {c.fair}</span>
                    <span className="cp-dist-seg s-bad" style={{ flexGrow: Math.max(c.problem, 0.001) }}>有问题 {c.problem}</span>
                  </div>
                ) : (
                  <p className="cp-empty">暂无体感反馈记录（验收时勾选「顺利 / 一般 / 有问题」后会沉淀到这里）。</p>
                )}
                {topTags.length > 0 && (
                  <div className="cp-tags">
                    {topTags.map(([tag, count]) => (
                      <span key={tag} className="ftag warn-tag">{tag}{count > 1 ? ` ×${count}` : ''}</span>
                    ))}
                  </div>
                )}

                <div className="cp-advice">
                  <span className="ml">报价 / 排期 / 协作建议</span>
                  <ul className="cp-advice-list">
                    {adviceLines.map((line, index) => <li key={index}>{line}</li>)}
                  </ul>
                </div>
              </div>
            </>
            )
          })()}
        </section>
      </div>
    </section>
  )
}

function IncomeView({
  annualData,
  currentMonth,
  taxMode,
  onMonthChange,
  activeMonthTasks,
  hourlyRate,
}: {
  annualData: {
    year: string
    rows: AnnualIncomeRow[]
    totalHours: number
    totalAmount: number
  }
  currentMonth: { label: string; value: string }
  taxMode: TaxMode
  onMonthChange: (month: string) => void
  activeMonthTasks: Task[]
  hourlyRate: number
}) {
  const [monthlySpecialDeduction, setMonthlySpecialDeduction] = useState(0)
  const [monthlyAdditionalDeduction, setMonthlyAdditionalDeduction] = useState(0)
  const [monthlyOtherDeduction, setMonthlyOtherDeduction] = useState(0)
  const taxRows = useMemo(
    () =>
      taxMode === 'labor'
        ? calculateLaborWithholding(annualData.rows)
        : calculateCumulativeWithholding(annualData.rows, monthlySpecialDeduction, monthlyAdditionalDeduction, monthlyOtherDeduction),
    [annualData.rows, monthlyAdditionalDeduction, monthlyOtherDeduction, monthlySpecialDeduction, taxMode],
  )
  const currentRow = taxRows.find((row) => row.month === currentMonth.value) ?? taxRows[0]
  const totalTax = taxRows.reduce((sum, row) => sum + row.tax, 0)
  const totalNet = taxRows.reduce((sum, row) => sum + row.netIncome, 0)
  const realizedTaxRows = taxRows.filter((row) => row.hours > 0 || row.amount > 0 || row.locked)
  const maxAmount = Math.max(...realizedTaxRows.map((row) => row.amount), 1)

  const today = datePart(isoDate())
  const dailyGroups = useMemo(() => {
    const dayMap = new Map<string, Map<number, { title: string; hours: number; isSupplemental: boolean }>>()
    activeMonthTasks.forEach((task) => {
      const isSuppl = isSupplementalTask(task)
      ;(task.timeEntries ?? []).forEach((entry) => {
        const minutes = minutesForTimeEntry(entry)
        if (minutes <= 0) return
        const entryDay = datePart(entry.date || task.date || '')
        // 补录任务的工时条目日期在原月份，归入结算月的第一天作为虚拟显示日期
        const day = isSuppl && !entryDay.startsWith(currentMonth.value)
          ? `${currentMonth.value}-01`
          : entryDay
        if (!day.startsWith(currentMonth.value)) return
        if (!dayMap.has(day)) dayMap.set(day, new Map())
        const taskMap = dayMap.get(day)!
        const existing = taskMap.get(task.id) ?? { title: task.title || '未命名', hours: 0, isSupplemental: isSuppl }
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
        const totalHours = Number(entries.reduce((s, e) => s + e.hours, 0).toFixed(1))
        return { day, totalHours, totalIncome: Math.round(totalHours * hourlyRate), entries }
      })
  }, [activeMonthTasks, currentMonth.value, hourlyRate])

  const todayGroup = dailyGroups.find((g) => g.day === today)

  return (
    <section className="income-view view-stack">
      <section className="stats-grid" aria-label="年度收入统计">
        <StatCard label="年度税前收入" value={`¥${formatYuan(annualData.totalAmount)}`} trend={`${annualData.totalHours.toFixed(1)}h 已记录工时`} icon={<BarChart3 size={20} />} />
        <StatCard label="估算已预扣税" value={`¥${totalTax.toLocaleString()}`} trend={taxMode === 'labor' ? '按劳务报酬预扣预缴' : '按工资薪金累计预扣法'} icon={<CalculatorIcon />} />
        <StatCard label="估算税后收入" value={`¥${totalNet.toLocaleString()}`} trend="未含社保外其他真实申报差异" icon={<CheckCircle2 size={20} />} />
        <StatCard label="本月税后" value={`¥${(currentRow?.netIncome ?? 0).toLocaleString()}`} trend={`${currentMonth.label}估算`} icon={<Clock3 size={20} />} />
      </section>

      <section className="income-grid">
        <section className="panel income-chart-panel">
          <div className="panel-header compact">
            <div>
              <h2>{annualData.year} 收入趋势</h2>
              <p>只展示已有工时或已锁定结算的月份，浅色为税前、深色为税后</p>
            </div>
            <span className="income-method-pill">{taxMode === 'labor' ? '劳务报酬估算' : '累计预扣法估算'}</span>
          </div>
          <div className="income-bars" style={{ '--income-month-count': Math.max(realizedTaxRows.length, 1) } as CSSProperties}>
            {realizedTaxRows.map((row) => {
              const grossHeight = Math.max(4, (row.amount / maxAmount) * 100)
              const netRatio = row.amount > 0 ? Math.max(0, Math.min(100, (row.netIncome / row.amount) * 100)) : 0
              return (
                <button
                  className={`income-bar ${row.month === currentMonth.value ? 'current' : ''}`}
                  key={row.month}
                  onClick={() => onMonthChange(row.month)}
                >
                  <span className="income-bar-value">¥{Math.round(row.netIncome).toLocaleString()}</span>
                  <span className="income-bar-stage">
                    <span className="income-bar-track" style={{ height: `${grossHeight}%` }}>
                      <i className="net" style={{ height: `${netRatio}%` }} />
                    </span>
                  </span>
                  <small>{Number(row.month.slice(5, 7))}月</small>
                </button>
              )
            })}
          </div>
          <div className="income-legend">
            <span><i className="gross" />税前收入</span>
            <span><i className="net" />税后收入</span>
          </div>
        </section>

        <details className="panel income-tax-panel">
          <summary className="income-tax-summary">
            <div>
              <h2>税务估算参数</h2>
              <p>公司最终申报可能包含更多扣除，以实际个税 App 为准</p>
            </div>
            <span>展开参数</span>
          </summary>
          <div className="income-form">
            <label className="field">
              <span>每月专项扣除</span>
              <input type="number" min="0" step="100" value={monthlySpecialDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlySpecialDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月专项附加扣除</span>
              <input type="number" min="0" step="100" value={monthlyAdditionalDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyAdditionalDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月其他扣除</span>
              <input type="number" min="0" step="100" value={monthlyOtherDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyOtherDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
          </div>
          <div className="tax-note">
            <strong>当前计算口径</strong>
            <p>
              {taxMode === 'labor'
                ? '劳务报酬按次或按月预扣预缴：收入不超过 4000 元减除 800 元，超过 4000 元减除 20%，再按 20% / 30% / 40% 预扣率计算。'
                : '累计应纳税所得额 = 累计收入 - 5000 × 月份数 - 累计专项扣除 - 累计专项附加扣除 - 累计其他扣除。'}
            </p>
          </div>
        </details>
      </section>

      <section className="panel income-table-panel">
        <div className="panel-header compact">
          <div>
            <h2>月度收入明细</h2>
            <p>点击趋势柱可切换当前月份；税额为系统估算，不替代财务确认</p>
          </div>
        </div>
        <div className="income-table-wrap">
          <table className="income-table">
            <thead>
              <tr>
                <th>月份</th>
                <th className="num">工时</th>
                <th className="num">税前收入</th>
                <th className="num">{taxMode === 'labor' ? '预扣应纳税所得额' : '累计应纳税所得额'}</th>
                <th className="num">预扣率</th>
                <th className="num">本月预扣税</th>
                <th className="num">税后收入</th>
              </tr>
            </thead>
            <tbody>
              {realizedTaxRows.map((row) => (
                <tr className={row.month === currentMonth.value ? 'current' : ''} key={row.month}>
                  <td>{monthLabelOf(row.month)}</td>
                  <td className="num">{row.hours.toFixed(1)}h</td>
                  <td className="num">¥{formatYuan(row.amount)}</td>
                  <td className="num">¥{Math.round(row.taxableIncome).toLocaleString()}</td>
                  <td className="num">{Math.round(row.rate * 100)}%</td>
                  <td className="num">¥{row.tax.toLocaleString()}</td>
                  <td className="num">¥{row.netIncome.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel income-table-panel">
        <div className="panel-header compact">
          <div>
            <h2>日收入明细 · {currentMonth.label}</h2>
            <p>
              {todayGroup
                ? `今日已记录 ${todayGroup.totalHours.toFixed(1)}h，估算收入 ¥${todayGroup.totalIncome.toLocaleString()}`
                : '基于分段计时记录，按时薪估算；今日暂无记录'}
            </p>
          </div>
        </div>
        {dailyGroups.length > 0 ? (
          <div className="income-table-wrap">
            <table className="income-table income-table-daily">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>任务</th>
                  <th className="num">工时</th>
                  <th className="num">估算收入</th>
                </tr>
              </thead>
              <tbody>
                {dailyGroups.map((group) => (
                  <Fragment key={group.day}>
                    {group.entries.map((entry, i) => (
                      <tr key={entry.id} className={group.day === today ? 'current' : ''}>
                        {i === 0 && (
                          <td rowSpan={group.entries.length} className="income-day-date">
                            {group.day.slice(5).replace('-', '/')}
                          </td>
                        )}
                        <td className="income-day-tasks">
                          {entry.title}
                          {entry.isSupplemental && <em className="income-supplemental-tag">补录</em>}
                        </td>
                        <td className="num">{entry.hours.toFixed(1)}h</td>
                        <td className="num">¥{entry.income.toLocaleString()}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="income-empty">本月暂无分段计时记录，在任务进展中添加计时后即可看到日明细。</p>
        )}
      </section>
    </section>
  )
}

function CalculatorIcon() {
  return <BarChart3 size={20} />
}

function ReportsView({
  stats,
  tasks,
  allTasks,
  updates,
  allUpdates,
  hourlyRate,
  importedHours,
  currentMonth,
  pdfTitle,
  serviceCompanyName,
  reports,
  files,
  attachmentAnalyses,
  onCopyShareLink,
  onRotateReportToken,
  onLockReport,
  onNotify,
}: {
  stats: {
    totalHours: number
    billableHours: number
    amount: number
    accepted: number
    pending: number
  }
  tasks: Task[]
  allTasks: Task[]
  updates: TaskUpdate[]
  allUpdates: TaskUpdate[]
  hourlyRate: number
  importedHours: number
  currentMonth: { label: string; value: string }
  pdfTitle: string
  serviceCompanyName: string
  reports: ReportRecord[]
  files: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  onCopyShareLink: (token: string) => void
  onRotateReportToken: (report: ReportRecord) => void
  onLockReport: () => void
  onNotify: (message: string, tone?: ToastTone) => void
}) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [receiptTemplate, setReceiptTemplate] = useState<'min' | 'detail'>('min')
  const [selectedReportMonth, setSelectedReportMonth] = useState('')
  const selectedMonth = selectedReportMonth || currentMonth.value
  const selectedMonthLabel = monthLabelOf(selectedMonth)
  const selectedReport = reports.find((report) => report.month === selectedMonth)
  const selectedTasks = selectedMonth === currentMonth.value
    ? tasks
    : allTasks.filter((task) => taskSettlementMonth(task) === selectedMonth && !task.voidedAt)
  const selectedUpdates = selectedMonth === currentMonth.value
    ? updates
    : allUpdates.filter((update) => {
      const task = allTasks.find((item) => item.id === update.taskId)
      if (task?.voidedAt) {
        return false
      }
      return update.date.startsWith(selectedMonth) || (task ? taskSettlementMonth(task) === selectedMonth : false)
    })
  const selectedImportedHours = selectedMonth === currentMonth.value ? importedHours : 0
  const selectedStats = selectedMonth === currentMonth.value
    ? stats
    : {
        totalHours: selectedTasks.reduce((sum, task) => sum + task.actualHours, selectedImportedHours),
        billableHours: selectedTasks
          .filter(isTaskBillable)
          .reduce((sum, task) => sum + task.actualHours, selectedImportedHours),
        amount: selectedReport?.totalAmount ?? sumBillableAmount(selectedTasks, hourlyRate, selectedImportedHours),
        accepted: selectedTasks.filter((task) => task.status === '已验收').length,
        pending: selectedTasks.filter((task) => task.status === '待验收').length,
      }
  const billableTasks = selectedTasks.filter((task) => isTaskBillable(task) && task.actualHours > 0)
  const receiptDetailTasks = billableTasks
  // 只统计真正没进结算表的计划中任务：有实际工时的计划中任务会照常计费，不能在备注里说成未计费
  const plannedCount = selectedTasks.filter((task) => task.status === '计划中' && isTaskBillable(task) && task.actualHours === 0).length
  const freeTasks = selectedTasks.filter((task) => !isTaskBillable(task))
  // 不计时清单：① 整单不计费的任务；② 计费任务里「不计工时」的分段（如仅改名）。两者都要让甲方看到做了什么、为何不计时。
  const uncountedItems: Array<{ key: string; title: string; type: string; reason: string; formula: string }> = []
  freeTasks.forEach((task) => {
    uncountedItems.push({
      key: `task-${task.id}`,
      title: task.title,
      type: task.type,
      reason: task.status === '挂起'
        ? task.suspendReason || '挂起'
        : task.status === '终止'
          ? task.terminateReason || '终止'
          : '整单不计费',
      formula: task.actualHours > 0
        ? `${task.actualHours.toFixed(1)}h × ¥${hourlyRate} = ¥0（不计费）`
        : '不计费',
    })
  })
  selectedTasks.forEach((task) => {
    if (!isTaskBillable(task)) {
      return
    }
    ;(task.timeEntries ?? []).forEach((entry) => {
      if (entry.isAcceptanceProgress || minutesForTimeEntry(entry) > 0) {
        return
      }
      uncountedItems.push({
        key: `entry-${task.id}-${entry.id}`,
        title: task.title,
        type: task.type,
        reason: entry.note?.trim() || '该分段不计工时',
        formula: '0h · 不计工时',
      })
    })
  })
  const visibleReports = isHistoryExpanded ? reports : reports.slice(0, Math.max(3, Math.min(reports.length, 5)))
  const receiptNo = `AK-${selectedMonth.replace('-', '')}-${String(billableTasks.length + 1).padStart(3, '0')}`
  const templateOptions = [
    { value: 'min' as const, label: '简约' },
    { value: 'detail' as const, label: '编辑式 Excel' },
  ]
  // 交付件理解：取该任务验收交付件的 AI 分析摘要，放进回单让甲方看到我们对成果的理解。
  const analysisByAttachment = useMemo(
    () => new Map(attachmentAnalyses.map((analysis) => [analysis.attachmentId, analysis])),
    [attachmentAnalyses],
  )
  const getDeliveryUnderstanding = (task: Task): string => {
    const acceptanceNames = new Set((task.acceptanceFiles ?? []).map((name) => name.trim()).filter(Boolean))
    const taskFiles = files.filter(
      (file) => file.taskId === task.id && !file.deletedAt && (file.scope === 'acceptance' || acceptanceNames.has(file.name)),
    )
    for (const file of taskFiles) {
      const summary = analysisByAttachment.get(file.id)?.summary?.trim()
      if (summary) {
        return summary
      }
    }
    return ''
  }
  const latestUpdatesByTask = useMemo(() => {
    const result = new Map<number, TaskUpdate>()
    selectedUpdates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        if (!result.has(update.taskId)) {
          result.set(update.taskId, update)
        }
      })
    return result
  }, [selectedUpdates])

  const formatReceiptDate = (value: string) => (value ? datePart(value).replaceAll('-', '/') : '—')
  const getTaskProgressText = (task: Task) => {
    const latestUpdate = latestUpdatesByTask.get(task.id)
    const parts: string[] = []
    if (task.acceptanceNote?.trim()) {
      parts.push(task.acceptanceNote.trim())
    }
    if (latestUpdate) {
      parts.push(`${latestUpdate.title}${latestUpdate.body ? `：${latestUpdate.body}` : ''}`)
    }
    if (task.acceptanceFiles && task.acceptanceFiles.length > 0) {
      parts.push(`验收文件：${task.acceptanceFiles.slice(0, 3).join('、')}${task.acceptanceFiles.length > 3 ? ` 等 ${task.acceptanceFiles.length} 个` : ''}`)
    }
    if (parts.length === 0) {
      parts.push(`${task.status}，进度 ${taskDisplayProgress(task)}%`)
    }
    return parts.join('；')
  }

  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const handleExportPdf = async () => {
    if (isPdfExporting) {
      return
    }
    setIsPdfExporting(true)
    try {
      // 服务端无头浏览器渲染清晰矢量 PDF
      const blob = await api.exportReportPdf(selectedMonth)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${pdfTitle}_${selectedMonthLabel.replace(/\s/g, '')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      // 服务端不可用时回退浏览器打印
      console.error('服务端 PDF 导出失败，回退浏览器打印', error)
      const previousTitle = document.title
      document.title = `${pdfTitle}_${selectedMonth}`
      window.print()
      document.title = previousTitle
    } finally {
      setIsPdfExporting(false)
    }
  }

  const handleExportUserSheet = async (month = selectedMonth) => {
    try {
    const targetReport = reports.find((report) => report.month === month)
    const targetTasks = month === selectedMonth
      ? receiptDetailTasks
      : allTasks.filter((task) => taskSettlementMonth(task) === month && !task.voidedAt && isTaskBillable(task) && task.actualHours > 0)
    const targetUpdates = month === selectedMonth
      ? selectedUpdates
      : allUpdates.filter((update) => {
        const task = allTasks.find((item) => item.id === update.taskId)
        return !task?.voidedAt && (update.date.startsWith(month) || (task ? taskSettlementMonth(task) === month : false))
      })
    const updatesMap = new Map<number, TaskUpdate>()
    targetUpdates
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((update) => {
        if (!updatesMap.has(update.taskId)) {
          updatesMap.set(update.taskId, update)
        }
      })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('User')
    sheet.columns = [
      { header: '参考开始日期', key: 'start', width: 16 },
      { header: '设计类型', key: 'type', width: 18 },
      { header: '项目/任务名称', key: 'title', width: 34 },
      { header: '具体任务需求', key: 'requirement', width: 46 },
      { header: '需求人', key: 'requester', width: 14 },
      { header: '参考预估工时', key: 'estimatedHours', width: 14 },
      { header: '实际工时', key: 'actualHours', width: 12 },
      { header: '参考交付日期', key: 'estimatedDate', width: 16 },
      { header: '实际交付日期', key: 'actualDeliveryDate', width: 16 },
      { header: '状态', key: 'status', width: 12 },
      { header: '验收人/确认', key: 'reviewer', width: 14 },
      { header: '进展', key: 'progress', width: 52 },
    ]
    targetTasks.forEach((task) => {
      const latestUpdate = updatesMap.get(task.id)
      sheet.addRow({
        start: `${formatReceiptDate(task.date)}${isSupplementalTask(task) ? '（补录）' : ''}`,
        type: task.type,
        title: task.title,
        requirement: task.requirement || '',
        requester: task.requester || task.contact || '',
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        estimatedDate: formatReceiptDate(task.estimatedDate),
        actualDeliveryDate: task.status === '已验收' ? formatReceiptDate(latestUpdate?.date ?? '') : '',
        status: task.status,
        reviewer: task.reviewer || task.requester || '',
        progress: getTaskProgressText(task),
      })
    })
    sheet.addRow({})
    sheet.addRow({
      title: '合计',
      actualHours: targetReport?.billableHours ?? targetTasks.reduce((sum, task) => sum + task.actualHours, 0),
      progress: `金额：¥${(targetReport?.totalAmount ?? sumBillableAmount(targetTasks, hourlyRate)).toLocaleString()}`,
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3EE' } }
    // 「进展」列自动换行便于甲方阅读；「具体任务需求」列不换行（默认裁切，双击单元格看全文），
    // 不设固定行高，由 Excel 按「进展」内容自动调整，避免长需求把每一行都撑得很高。
    sheet.columns.forEach((col) => {
      col.alignment = { vertical: 'top', wrapText: col.key === 'progress' }
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `User_${monthLabelOf(month).replace(/\s/g, '')}_工时明细.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    } catch (error) {
      console.error('User 表导出失败', error)
      onNotify(error instanceof Error ? `User 表导出失败：${error.message}` : 'User 表导出失败，请重试', 'error')
    }
  }

  return (
    <section className="report-workspace">
      <section className="panel report-control-bar">
        <div className="report-summary-chips">
          <div>
            <span>总工时</span>
            <strong>{selectedStats.totalHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>计费工时</span>
            <strong>{selectedStats.billableHours.toFixed(1)}h</strong>
          </div>
          <div>
            <span>结算金额</span>
            <strong>¥{formatYuan(selectedStats.amount)}</strong>
          </div>
          <div>
            <span>已验收</span>
            <strong>{selectedStats.accepted} 个</strong>
          </div>
        </div>
        <p className="report-flow-hint">
          当前查看：{selectedMonthLabel}。核对下方结算单 → 锁定结算生成甲方分享链接；历史记录可重新查看并下载 User 工时表。
        </p>
        <div className="report-bar-actions">
          <button className="primary-button" onClick={onLockReport} disabled={selectedMonth !== currentMonth.value}>
            <CheckCircle2 size={18} />
            {selectedMonth === currentMonth.value ? '锁定结算并生成甲方链接' : '历史结算已锁定'}
          </button>
          <button className="ghost-button" onClick={() => void handleExportPdf()} disabled={isPdfExporting}>
            <Download size={18} />
            {isPdfExporting ? '生成中…' : '导出 PDF'}
          </button>
          <button className="ghost-button" onClick={() => void handleExportUserSheet()}>
            <Download size={18} />
            下载 User 表
          </button>
        </div>

        {reports.length > 0 && (
          <div className="report-history">
            <div className="report-history-header">
              <h3>结算历史</h3>
              {reports.length > 1 && (
                <button type="button" onClick={() => setIsHistoryExpanded((expanded) => !expanded)}>
                  {isHistoryExpanded ? '收起' : `展开全部 ${reports.length} 条`}
                </button>
              )}
            </div>
            {visibleReports.map((report) => (
              <div className="report-history-row" key={report.id}>
                <strong>{monthLabelOf(report.month)}</strong>
                <span>
                  {report.billableHours.toFixed(1)}h · ¥{formatYuan(report.totalAmount)}
                </span>
                <small>
                  锁定于 {report.generatedAt || '—'}
                  {report.viewCount > 0 ? ` · 甲方已查看 ${report.viewCount} 次（最近 ${report.viewedAt}）` : ' · 甲方尚未查看'}
                </small>
                <div className="report-history-actions">
                  <button className="ghost-button compact-button" onClick={() => setSelectedReportMonth(report.month)}>
                    查看
                  </button>
                  <button className="ghost-button compact-button" aria-label={`下载 ${report.month} User 表`} onClick={() => void handleExportUserSheet(report.month)}>
                    下载 User 表
                  </button>
                  <button className="ghost-button compact-button" aria-label={`复制 ${report.month} 甲方链接`} onClick={() => onCopyShareLink(report.publicToken)}>
                    复制链接
                  </button>
                  <button className="ghost-button compact-button" aria-label={`重置 ${report.month} 甲方链接`} onClick={() => onRotateReportToken(report)}>
                    重置链接
                  </button>
                  <a className="ghost-button compact-button" aria-label={`打开 ${report.month} 甲方页面`} href={`/share/${report.publicToken}`} target="_blank" rel="noreferrer">
                    打开甲方页
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="receipt-tools">
        <div className="segment-tabs report-template-tabs" aria-label="结算回单模板">
          <span>模板</span>
          {templateOptions.map((option) => (
            <button
              type="button"
              className={receiptTemplate === option.value ? 'active' : ''}
              key={option.value}
              onClick={() => setReceiptTemplate(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className={`receipt receipt-template-${receiptTemplate}`} aria-label="月度结算回单" data-company={serviceCompanyName}>
        {receiptTemplate === 'detail' && (
          <div className="receipt-excel-bar">
            <FileText size={14} />
            <span>结算回单_{selectedMonthLabel.replace(/\s/g, '')}.xlsx</span>
          </div>
        )}
        <header className="receipt-header">
          <div className="receipt-title">
            <h2>{pdfTitle}</h2>
            <span>MONTHLY SETTLEMENT RECEIPT</span>
          </div>
          <div className="receipt-no">
            <span>回单编号：{receiptNo}</span>
            <span>出单时间：{nowStamp()}</span>
          </div>
        </header>

        <div className="receipt-rule" />

        <dl className="receipt-info">
          <div>
            <dt>客户名称</dt>
            <dd>{serviceCompanyName}</dd>
          </div>
          <div>
            <dt>服务内容</dt>
            <dd>平面设计兼职</dd>
          </div>
          <div>
            <dt>结算月份</dt>
            <dd>{selectedMonthLabel}</dd>
          </div>
          <div>
            <dt>结算单价</dt>
            <dd>¥{hourlyRate} / 小时</dd>
          </div>
        </dl>

        <table className={`receipt-table ${receiptTemplate === 'detail' ? 'receipt-table-expanded' : ''}`}>
          <thead>
            {receiptTemplate === 'detail' ? (
              <tr>
                <th>序号</th>
                <th>设计类型 / 任务</th>
                <th>任务需求</th>
                <th>需求人</th>
                <th>状态</th>
                <th className="num">预估工时</th>
                <th className="num">实际工时</th>
                <th className="num">单价</th>
                <th className="num">小计</th>
                <th>验收备注</th>
                <th>交付件理解</th>
              </tr>
            ) : (
              <tr>
                <th>序号</th>
                <th>项目名称</th>
                <th>类型</th>
                <th>验收状态</th>
                <th>具体任务需求</th>
                <th>交付件理解</th>
                <th className="num">工时</th>
                <th className="num">金额（元）</th>
              </tr>
            )}
          </thead>
          <tbody>
            {billableTasks.map((task, index) => (
              receiptTemplate === 'detail' ? (
                <tr key={task.id}>
                  <td>{String(index + 1).padStart(2, '0')}</td>
                  <td className="receipt-task-name"><b>{task.title}</b><span>{task.type}</span></td>
                  <td className="receipt-requirement-cell"><span title={task.requirement || ''}>{task.requirement || '—'}</span></td>
                  <td>{task.requester || task.contact || '—'}</td>
                  <td>{task.status}</td>
                  <td className="num">{task.estimatedHours.toFixed(1)}h</td>
                  <td className="num">{task.actualHours.toFixed(1)}h</td>
                  <td className="num">¥{hourlyRate}</td>
                  <td className="num">{formatYuan(task.actualHours * hourlyRate)}</td>
                  <td>{task.acceptanceNote || '—'}</td>
                  <td className="receipt-delivery-cell"><span title={getDeliveryUnderstanding(task)}>{getDeliveryUnderstanding(task) || '—'}</span></td>
                </tr>
              ) : (
                <tr key={task.id}>
                  <td>{String(index + 1).padStart(2, '0')}</td>
                  <td className="receipt-task-name">{task.title}{isSupplementalTask(task) ? '（补录）' : ''}</td>
                  <td>{task.type}</td>
                  <td>{task.status}</td>
                  <td className="receipt-requirement-cell"><span title={task.requirement || ''}>{task.requirement || '—'}</span></td>
                  <td className="receipt-delivery-cell"><span title={getDeliveryUnderstanding(task)}>{getDeliveryUnderstanding(task) || '—'}</span></td>
                  <td className="num">{task.actualHours.toFixed(1)}</td>
                  <td className="num">{formatYuan(task.actualHours * hourlyRate)}</td>
                </tr>
              )
            ))}
            {selectedImportedHours > 0 && (
              receiptTemplate === 'detail' ? (
                <tr>
                  <td>{String(billableTasks.length + 1).padStart(2, '0')}</td>
                  <td className="receipt-task-name"><b>月初导入工时</b><span>线下记录补录</span></td>
                  <td>—</td>
                  <td>—</td>
                  <td>导入</td>
                  <td className="num">—</td>
                  <td className="num">{selectedImportedHours.toFixed(1)}h</td>
                  <td className="num">¥{hourlyRate}</td>
                  <td className="num">{formatYuan(selectedImportedHours * hourlyRate)}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              ) : (
                <tr>
                  <td>{String(billableTasks.length + 1).padStart(2, '0')}</td>
                  <td className="receipt-task-name">月初导入工时（线下记录补录）</td>
                  <td>导入</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="num">{selectedImportedHours.toFixed(1)}</td>
                  <td className="num">{formatYuan(selectedImportedHours * hourlyRate)}</td>
                </tr>
              )
            )}
            {billableTasks.length === 0 && selectedImportedHours === 0 && freeTasks.length === 0 && (
              <tr>
                <td colSpan={receiptTemplate === 'detail' ? 11 : 8} className="receipt-empty">
                  本月暂无任务
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>合计</td>
              <td className="num">{selectedStats.billableHours.toFixed(1)}</td>
              {receiptTemplate === 'detail' && <td />}
              <td className="num">¥{formatYuan(selectedStats.amount)}</td>
              {receiptTemplate === 'detail' && (
                <>
                  <td />
                  <td />
                </>
              )}
            </tr>
          </tfoot>
        </table>

        <div className="receipt-amount">
          <span>人民币（大写）</span>
          <strong>{toChineseAmount(selectedStats.amount)}</strong>
        </div>

        <div className="receipt-remarks">
          <p>
            备注：本月共 {selectedTasks.length} 项任务，已验收 {selectedStats.accepted} 项，待验收 {selectedStats.pending} 项
            {plannedCount > 0 ? `，计划中 ${plannedCount} 项（未计费）` : ''}
            {freeTasks.length > 0 ? `，另含 ${freeTasks.length} 项不计费协助` : ''}。
          </p>
          <p>本回单由系统根据任务与工时记录自动生成，验收状态以甲方确认为准。</p>
        </div>

        {uncountedItems.length > 0 && (
          <div className="receipt-uncounted">
            <div className="receipt-uncounted-head">
              <h3>{selectedMonthLabel} · 不计时</h3>
              <span>已完成但不计入计费工时，仅作说明</span>
            </div>
            <ul>
              {uncountedItems.map((item) => (
                <li key={item.key}>
                  <span className="receipt-uncounted-name">{item.title}</span>
                  <span className="receipt-uncounted-type">{item.type}</span>
                  <span className="receipt-uncounted-reason">{item.reason}</span>
                  <span className="receipt-uncounted-formula">{item.formula}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="receipt-cutline">
          <span>✂</span>
        </div>
      </section>
    </section>
  )
}

const aiRouteMeta: Array<{ key: AiModelRouteKey; title: string; description: string; capability: 'text' | 'vision' }> = [
  { key: 'textPrimary', title: '文字主模型', description: '任务文案、进展、验收和工时建议优先使用', capability: 'text' },
  { key: 'textFallback', title: '文字备用模型', description: 'DeepSeek 不可用或返回无效时自动兜底', capability: 'text' },
  { key: 'visionPrimary', title: '识图主模型', description: '交付件图片、PDF 页面和 PPT 预览优先识别', capability: 'vision' },
  { key: 'visionFallback', title: '识图备用模型', description: 'Gemini 额度不足或识别失败时自动兜底', capability: 'vision' },
]

const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DOUBAO_SEED_PRO_MODEL = 'doubao-seed-2-1-pro-260628'

const aiRouteDefaults: Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>> = {
  textPrimary: { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  textFallback: { provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6' },
  visionPrimary: { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3-flash-preview' },
  visionFallback: { provider: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6' },
}

// AI 调用统一走 Cloudflare AI Gateway（缓存 / 失败重试 / 用量看板 / 抗 503）。
// 选择供应商时自动把 Base URL 填成该供应商对应的网关路径；网关未代理的供应商回退官方直连。
const AI_GATEWAY_BASE = 'https://gateway.ai.cloudflare.com/v1/ccd312f47f0dca574199fa6e33758c6d/mayeai-gateway'

const aiProviderOptions: Array<{ value: AiModelConfig['provider']; label: string }> = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'doubao', label: '豆包 / Doubao' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'custom-openai', label: 'OpenAI 兼容网关' },
]

// 该供应商在 Cloudflare AI Gateway 上的命名路径；网关不支持的供应商返回 ''（只能直连）。
function gatewayBaseUrlForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return `${AI_GATEWAY_BASE}/deepseek`
    case 'gemini':
      return `${AI_GATEWAY_BASE}/google-ai-studio/v1beta`
    case 'openai':
      return `${AI_GATEWAY_BASE}/openai`
    case 'anthropic':
      return `${AI_GATEWAY_BASE}/anthropic`
    default:
      // Kimi/Moonshot、豆包/火山方舟、OpenRouter 等：直连最稳（OpenRouter 自身已是聚合路由），不强制走网关。
      return ''
  }
}

// 该供应商的官方直连地址。
function directBaseUrlForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return 'https://api.deepseek.com'
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta'
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'kimi':
      return 'https://api.moonshot.cn/v1'
    case 'doubao':
      return DOUBAO_BASE_URL
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'custom-openai':
    default:
      return ''
  }
}

// 切换供应商时默认优先走网关（拿缓存/重试/用量看板），网关不支持的回退直连。
function baseUrlForProvider(provider: AiModelConfig['provider']): string {
  return gatewayBaseUrlForProvider(provider) || directBaseUrlForProvider(provider)
}

function isGatewayBaseUrl(url: string): boolean {
  return url.includes('gateway.ai.cloudflare.com')
}

function defaultModelForProvider(provider: AiModelConfig['provider']): string {
  switch (provider) {
    case 'deepseek':
      return 'deepseek-chat'
    case 'gemini':
      return 'gemini-3-flash-preview'
    case 'kimi':
      return 'kimi-k2.6'
    case 'doubao':
      return DOUBAO_SEED_PRO_MODEL
    case 'openai':
      return 'gpt-4o-mini'
    case 'openrouter':
      return 'deepseek/deepseek-chat-v3-0324:free'
    case 'anthropic':
      return 'claude-sonnet-4-6'
    case 'custom-openai':
    default:
      return ''
  }
}

function aiRoutesFromConfig(config: AiModelConfig | null): Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>> {
  return aiRouteMeta.reduce((map, route) => {
    const item = config?.[route.key] ?? aiRouteDefaults[route.key]
    return {
      ...map,
      [route.key]: {
        provider: item.provider,
        baseUrl: item.baseUrl,
        model: item.model,
      },
    }
  }, {} as Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>)
}

function SettingsView({
  hourlyRate,
  pdfTitle,
  serviceCompanyName,
  taxMode,
  designTypeGroups,
  aiModelConfig,
  role,
  accessTokens,
  newTokenId,
  rowThemeOn,
  onRateChange,
  onPdfTitleChange,
  onServiceCompanyNameChange,
  onTaxModeChange,
  onDesignTypeGroupsChange,
  onAiModelConfigChange,
  onExportBackup,
  onSignOut,
  onChangePassword,
  onCreateToken,
  onToggleToken,
  onDeleteToken,
  onCopyToken,
  onToggleRowTheme,
}: {
  hourlyRate: number
  pdfTitle: string
  serviceCompanyName: string
  taxMode: TaxMode
  designTypeGroups: DesignTypeGroup[]
  aiModelConfig: AiModelConfig | null
  role: AuthRole
  accessTokens: AccessToken[]
  newTokenId: string
  rowThemeOn: boolean
  onRateChange: (rate: number) => void
  onPdfTitleChange: (title: string) => void
  onServiceCompanyNameChange: (name: string) => void
  onTaxModeChange: (mode: TaxMode) => void
  onDesignTypeGroupsChange: (groups: DesignTypeGroup[]) => void | Promise<void>
  onAiModelConfigChange: (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => void | Promise<void>
  onExportBackup: () => void
  onSignOut: () => void
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onCreateToken: (label: string, expiresInDays: number | null, scope: TokenScope) => void
  onToggleToken: (tokenId: string, disabled: boolean) => void
  onDeleteToken: (tokenId: string) => void
  onCopyToken: (token: string) => void
  onToggleRowTheme: () => void
}) {
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('permanent')
  const [tokenScope, setTokenScope] = useState<TokenScope>('viewer')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupItems, setNewGroupItems] = useState<Record<string, string>>({})
  const [addingItemGroup, setAddingItemGroup] = useState<string | null>(null)
  const [activeDesignGroup, setActiveDesignGroup] = useState('')
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>({})
  const [editingItem, setEditingItem] = useState<{ groupName: string; item: string } | null>(null)
  const [itemEditDraft, setItemEditDraft] = useState('')
  const [serviceCompanyDraft, setServiceCompanyDraft] = useState(serviceCompanyName)
  const [pdfTitleDraft, setPdfTitleDraft] = useState(pdfTitle)
  const [aiModeDraft, setAiModeDraft] = useState<AiModelConfig['mode']>(aiModelConfig?.mode ?? 'deepseek-direct')
  const [aiProviderDraft, setAiProviderDraft] = useState<AiModelConfig['provider']>(aiModelConfig?.provider ?? 'deepseek')
  const [aiBaseUrlDraft, setAiBaseUrlDraft] = useState(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
  const [aiModelDraft, setAiModelDraft] = useState(aiModelConfig?.model ?? 'deepseek-chat')
  const [aiRuntimeUrlDraft, setAiRuntimeUrlDraft] = useState(aiModelConfig?.runtimeUrl ?? '')
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('')
  const [aiRouteDrafts, setAiRouteDrafts] = useState(aiRoutesFromConfig(aiModelConfig))
  const [aiRouteKeyDrafts, setAiRouteKeyDrafts] = useState<Partial<Record<AiModelRouteKey, string>>>({})
  const [testingAiRoute, setTestingAiRoute] = useState<AiModelRouteKey | null>(null)
  const [aiRouteTestResults, setAiRouteTestResults] = useState<Partial<Record<AiModelRouteKey, { ok: boolean; message: string }>>>({})
  const [aiCapabilityTab, setAiCapabilityTab] = useState<'text' | 'vision'>('text')
  const [orFreeModels, setOrFreeModels] = useState<OpenRouterFreeModel[]>([])
  const [orScannedAt, setOrScannedAt] = useState('')
  const [orScanning, setOrScanning] = useState(false)
  const [orError, setOrError] = useState('')
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'settlement' | 'ai' | 'design' | 'security' | 'system'>('settlement')
  const [securityTab, setSecurityTab] = useState<'tokens' | 'account'>('tokens')
  const [aiRouteModelOptions, setAiRouteModelOptions] = useState<Partial<Record<AiModelRouteKey, string[]>>>({})
  const [fetchingModelsRoute, setFetchingModelsRoute] = useState<AiModelRouteKey | null>(null)
  const [aiRouteModelError, setAiRouteModelError] = useState<Partial<Record<AiModelRouteKey, string>>>({})
  const [isAiModelSaving, setIsAiModelSaving] = useState(false)
  const [draggingGroupName, setDraggingGroupName] = useState('')
  const [draggingItem, setDraggingItem] = useState<{ groupName: string; item: string } | null>(null)
  const [settingsConfirmDialog, setSettingsConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [isSettingsConfirmDialogBusy, setIsSettingsConfirmDialogBusy] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)

  const tokenStatus = (token: AccessToken) => {
    if (token.disabled) {
      return { label: '已停用', className: 'status-不计费' }
    }
    if (token.expired) {
      return { label: '已过期', className: 'status-待验收' }
    }
    return { label: '有效', className: 'status-已验收' }
  }

  const tokenScopeOptions: Array<{ value: TokenScope; label: string; desc: string }> = [
    { value: 'collaborator', label: '协作者', desc: '看管理员所见的全部数据，可记进展、传附件、改任务基本信息；不能删除/作废任务、锁定结算、改 AI Key、管理口令、改密码、导出或清空数据。' },
    { value: 'viewer', label: '只读全局', desc: '看管理员所见的全部数据，但完全只读——什么都改不了。适合给对接测试或老板审阅。' },
    { value: 'client', label: '甲方', desc: '看当月任务、进展、交付件和当月结算回单（含金额），只读；看不到往月与全年财务、看不到后台配置。' },
    { value: 'guest', label: '对客访客', desc: '只看进展和对客可见的交付件，只读。适合对外分享。' },
  ]
  const tokenScopeLabel = (scope: TokenScope) => tokenScopeOptions.find((option) => option.value === scope)?.label ?? scope
  const activeTokenScope = tokenScopeOptions.find((option) => option.value === tokenScope)

  const handleCreate = () => {
    const expiresInDays = tokenExpiry === 'permanent' ? null : Number(tokenExpiry)
    onCreateToken(tokenLabel.trim() || '未命名口令', expiresInDays, tokenScope)
    setTokenLabel('')
  }

  const savePdfTitle = () => {
    const value = pdfTitleDraft.trim()
    if (value && value !== pdfTitle) {
      onPdfTitleChange(value)
    }
    if (!value) {
      setPdfTitleDraft(defaultPdfTitle)
      onPdfTitleChange(defaultPdfTitle)
    }
  }

  const saveServiceCompanyName = () => {
    const value = serviceCompanyDraft.trim()
    if (value && value !== serviceCompanyName) {
      onServiceCompanyNameChange(value)
    }
    if (!value) {
      setServiceCompanyDraft(defaultServiceCompanyName)
      onServiceCompanyNameChange(defaultServiceCompanyName)
    }
  }

  const addDesignTypeGroup = () => {
    const value = newGroupName.trim()
    if (!value || designTypeGroups.some((group) => group.name === value)) {
      return
    }
    onDesignTypeGroupsChange([...designTypeGroups, { name: value, color: nextUnusedDesignTypeColor(designTypeGroups), items: [] }])
    setNewGroupName('')
  }

  const updateDesignTypeGroupColor = (groupName: string, color: string) => {
    const nextColor = validDesignTypeColor(color)
    if (!nextColor) {
      return
    }
    onDesignTypeGroupsChange(designTypeGroups.map((group) => (group.name === groupName ? { ...group, color: nextColor } : group)))
  }

  const performDeleteDesignTypeGroup = async (name: string) => {
    if (designTypeGroups.length <= 1) {
      return
    }
    await onDesignTypeGroupsChange(designTypeGroups.filter((group) => group.name !== name))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setNewGroupItems((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setActiveDesignGroup((current) => (current === name ? '' : current))
  }

  const requestDeleteDesignTypeGroup = (name: string) => {
    const group = designTypeGroups.find((item) => item.name === name)
    if (!group || designTypeGroups.length <= 1) {
      return
    }
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型大类',
      title: `确定删除「${name}」吗？`,
      body: '删除大类后，这个大类下的子类会一起从新建任务的选择器中移除。已创建任务的历史记录不会被删除，但后续新建任务不能再选择这些类型。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`${group.items.length} 个子类`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeGroup(name),
    })
  }

  const renameDesignTypeGroup = (oldName: string) => {
    const nextName = (groupNameDrafts[oldName] ?? oldName).trim()
    if (!nextName || nextName === oldName || designTypeGroups.some((group) => group.name === nextName && group.name !== oldName)) {
      setGroupNameDrafts((current) => ({ ...current, [oldName]: oldName }))
      return
    }
    onDesignTypeGroupsChange(designTypeGroups.map((group) => (group.name === oldName ? { ...group, name: nextName } : group)))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[oldName]
      return { ...next, [nextName]: nextName }
    })
    setNewGroupItems((current) => {
      const { [oldName]: oldDraft, ...rest } = current
      return oldDraft === undefined ? rest : { ...rest, [nextName]: oldDraft }
    })
    setDraggingGroupName((current) => (current === oldName ? nextName : current))
    setActiveDesignGroup((current) => (current === oldName ? nextName : current))
    setDraggingItem((current) => (current?.groupName === oldName ? { ...current, groupName: nextName } : current))
  }

  const renameDesignTypeItem = (groupName: string, oldItem: string) => {
    const nextItem = itemEditDraft.trim()
    setEditingItem(null)
    setItemEditDraft('')
    if (!nextItem || nextItem === oldItem) return
    if (designTypeGroups.find((g) => g.name === groupName)?.items.includes(nextItem)) return
    onDesignTypeGroupsChange(
      designTypeGroups.map((g) =>
        g.name === groupName ? { ...g, items: g.items.map((it) => (it === oldItem ? nextItem : it)) } : g,
      ),
    )
  }

  const addDesignTypeItem = (groupName: string) => {
    const value = (newGroupItems[groupName] ?? '').trim()
    if (!value) {
      return
    }
    onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: [...group.items, value] } : group)),
    )
    setNewGroupItems((current) => ({ ...current, [groupName]: '' }))
  }

  const performDeleteDesignTypeItem = async (groupName: string, item: string) => {
    await onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: group.items.filter((value) => value !== item) } : group)),
    )
  }

  const requestDeleteDesignTypeItem = (groupName: string, item: string) => {
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型子类',
      title: `确定删除「${item}」吗？`,
      body: '删除后，这个子类会从新建任务的设计类型选择器中移除。已创建任务不会被删除，历史任务仍会保留原来的类型文字。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`所属大类：${groupName}`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeItem(groupName, item),
    })
  }

  const handleSettingsConfirm = async () => {
    if (!settingsConfirmDialog || isSettingsConfirmDialogBusy) {
      return
    }
    setIsSettingsConfirmDialogBusy(true)
    try {
      await settingsConfirmDialog.onConfirm()
      setSettingsConfirmDialog(null)
    } finally {
      setIsSettingsConfirmDialogBusy(false)
    }
  }

  useEffect(() => {
    setAiModeDraft(aiModelConfig?.mode ?? 'deepseek-direct')
    setAiProviderDraft(aiModelConfig?.provider ?? 'deepseek')
    setAiBaseUrlDraft(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
    setAiModelDraft(aiModelConfig?.model ?? 'deepseek-chat')
    setAiRuntimeUrlDraft(aiModelConfig?.runtimeUrl ?? '')
    setAiApiKeyDraft('')
    setAiRouteDrafts(aiRoutesFromConfig(aiModelConfig))
    setAiRouteKeyDrafts({})
  }, [aiModelConfig])

  const updateAiRouteDraft = (route: AiModelRouteKey, changes: Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>) => {
    setAiRouteDrafts((current) => {
      const next = { ...current[route], ...changes }
      if (changes.provider && changes.provider !== current[route].provider) {
        // 切换供应商时自动联动 Base URL（默认走 AI Gateway）与默认模型，省去手填。
        next.baseUrl = baseUrlForProvider(changes.provider)
        const fallbackModel = defaultModelForProvider(changes.provider)
        if (fallbackModel) {
          next.model = fallbackModel
        }
      }
      return { ...current, [route]: next }
    })
    if (changes.provider) {
      // 供应商变了，之前拉取的模型列表失效，清空避免误导。
      setAiRouteModelOptions((options) => ({ ...options, [route]: undefined }))
      setAiRouteModelError((errors) => ({ ...errors, [route]: undefined }))
    }
  }

  const fetchRouteModels = async (route: AiModelRouteKey) => {
    if (fetchingModelsRoute) {
      return
    }
    setFetchingModelsRoute(route)
    setAiRouteModelError((errors) => ({ ...errors, [route]: undefined }))
    try {
      const result = await api.listAiModels(route)
      setAiRouteModelOptions((options) => ({ ...options, [route]: result.models }))
      if (!result.models.length) {
        setAiRouteModelError((errors) => ({ ...errors, [route]: '该供应商没有返回可用模型' }))
      }
    } catch (error) {
      setAiRouteModelError((errors) => ({ ...errors, [route]: error instanceof Error ? error.message : '获取模型失败' }))
    } finally {
      setFetchingModelsRoute(null)
    }
  }

  useEffect(() => {
    // 进入设置即加载已缓存的 OpenRouter 免费模型扫描结果（cron 每日刷新）
    api.getOpenRouterFreeModels()
      .then((result) => {
        setOrFreeModels(result.models)
        setOrScannedAt(result.scannedAt)
      })
      .catch(() => {})
  }, [])

  const scanFreeModels = async () => {
    if (orScanning) {
      return
    }
    setOrScanning(true)
    setOrError('')
    try {
      const result = await api.scanOpenRouterFreeModels()
      setOrFreeModels(result.models)
      setOrScannedAt(result.scannedAt)
      if (!result.models.length) {
        setOrError('没拉到免费模型，请确认已配置 OpenRouter Key')
      }
    } catch (error) {
      setOrError(error instanceof Error ? error.message : '扫描失败')
    } finally {
      setOrScanning(false)
    }
  }

  const applyFreeModelToRoute = (routeKey: AiModelRouteKey, modelId: string) => {
    setAiRouteDrafts((current) => ({
      ...current,
      [routeKey]: { provider: 'openrouter', baseUrl: directBaseUrlForProvider('openrouter'), model: modelId },
    }))
  }

  const saveAiModelConfig = async (clearApiKey = false, clearRouteApiKey?: AiModelRouteKey) => {
    if (isAiModelSaving) {
      return
    }
    setIsAiModelSaving(true)
    try {
      await onAiModelConfigChange({
        mode: aiModeDraft,
        provider: aiProviderDraft,
        baseUrl: aiBaseUrlDraft.trim(),
        model: aiModelDraft.trim(),
        runtimeUrl: aiRuntimeUrlDraft.trim(),
        apiKey: clearApiKey ? undefined : aiApiKeyDraft.trim() || undefined,
        clearApiKey,
        routes: aiRouteDrafts,
        routeApiKeys: Object.fromEntries(Object.entries(aiRouteKeyDrafts).filter(([, value]) => value?.trim())) as Partial<Record<AiModelRouteKey, string>>,
        clearRouteApiKeys: clearRouteApiKey ? [clearRouteApiKey] : undefined,
      })
      setAiApiKeyDraft('')
      setAiRouteKeyDrafts({})
    } finally {
      setIsAiModelSaving(false)
    }
  }

  const testAiRoute = async (route: AiModelRouteKey, capability: 'text' | 'vision') => {
    if (testingAiRoute) {
      return
    }
    setTestingAiRoute(route)
    setAiRouteTestResults((current) => ({ ...current, [route]: { ok: false, message: '测试中…' } }))
    try {
      const result = await api.testAiModelRoute({ route, capability })
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: true, message: `${result.provider} / ${result.model} 可用：${result.output}` },
      }))
    } catch (error) {
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: false, message: error instanceof Error ? error.message : '模型测试失败' },
      }))
    } finally {
      setTestingAiRoute(null)
    }
  }

  const submitPasswordChange = async () => {
    if (isPasswordSaving) {
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('新密码至少需要 8 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    setIsPasswordSaving(true)
    setPasswordError('')
    try {
      await onChangePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : '密码更新失败')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const moveDesignTypeGroup = (targetName: string) => {
    if (!draggingGroupName || draggingGroupName === targetName) {
      return
    }
    const fromIndex = designTypeGroups.findIndex((group) => group.name === draggingGroupName)
    const toIndex = designTypeGroups.findIndex((group) => group.name === targetName)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    const nextGroups = [...designTypeGroups]
    const [moved] = nextGroups.splice(fromIndex, 1)
    nextGroups.splice(toIndex, 0, moved)
    onDesignTypeGroupsChange(nextGroups)
  }

  const moveDesignTypeItem = (targetGroupName: string, targetItem: string) => {
    if (!draggingItem || draggingItem.groupName !== targetGroupName || draggingItem.item === targetItem) {
      return
    }
    const nextGroups = designTypeGroups.map((group) => {
      if (group.name !== targetGroupName) {
        return group
      }
      const items = [...group.items]
      const fromIndex = items.indexOf(draggingItem.item)
      const toIndex = items.indexOf(targetItem)
      if (fromIndex < 0 || toIndex < 0) {
        return group
      }
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { ...group, items }
    })
    onDesignTypeGroupsChange(nextGroups)
  }

  const activeGroup = designTypeGroups.find((group) => group.name === activeDesignGroup) ?? designTypeGroups[0]

  return (
    <section className="settings-grid">
      <div className="settings-tabs view-mode-tabs">
        <button type="button" className={settingsTab === 'appearance' ? 'active' : ''} onClick={() => setSettingsTab('appearance')}>
          <Palette size={16} />
          外观
        </button>
        <button type="button" className={settingsTab === 'settlement' ? 'active' : ''} onClick={() => setSettingsTab('settlement')}>
          <Briefcase size={16} />
          结算设置
        </button>
        {role === 'admin' && (
          <button type="button" className={settingsTab === 'ai' ? 'active' : ''} onClick={() => setSettingsTab('ai')}>
            <Sparkles size={16} />
            AI 模型设置
          </button>
        )}
        {role === 'admin' && (
          <button type="button" className={settingsTab === 'design' ? 'active' : ''} onClick={() => setSettingsTab('design')}>
            <Tag size={16} />
            设计类型
          </button>
        )}
        <button type="button" className={settingsTab === 'security' ? 'active' : ''} onClick={() => setSettingsTab('security')}>
          <ShieldCheck size={16} />
          权限安全
        </button>
        <button type="button" className={settingsTab === 'system' ? 'active' : ''} onClick={() => setSettingsTab('system')}>
          <Settings size={16} />
          系统
        </button>
      </div>
      {settingsTab === 'appearance' && (
        <GivernyModeSettings rowThemeOn={rowThemeOn} onToggleRowTheme={onToggleRowTheme} />
      )}
      {settingsTab === 'settlement' && (
        <div className="settings-group-body settings-tab-body">
          <section className="panel settings-settlement-panel">
            <div className="panel-header compact">
              <div>
                <h2>结算设置</h2>
                <p>用于自动计算月度费用，已锁定的结算单不受影响</p>
              </div>
            </div>
            <div className="form-grid settings-form">
              <label className="field">
                <span>小时单价（元 / 小时）</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={hourlyRate}
                  onChange={(event) => onRateChange(Math.max(0, Number.parseFloat(event.target.value) || 0))}
                />
              </label>
              <label className="field">
                <span>服务公司名称</span>
                <input
                  value={serviceCompanyDraft}
                  placeholder="例如：昂楷科技"
                  onChange={(event) => setServiceCompanyDraft(event.target.value)}
                  onBlur={saveServiceCompanyName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>计税方式</span>
                <select value={taxMode} onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}>
                  <option value="salary">工资薪金</option>
                  <option value="labor">劳务报酬</option>
                </select>
              </label>
              <label className="field wide">
                <span>PDF 抬头</span>
                <input
                  value={pdfTitleDraft}
                  placeholder="例如：设计服务工时结算回单"
                  onChange={(event) => setPdfTitleDraft(event.target.value)}
                  onBlur={savePdfTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
            </div>
          </section>
        </div>
      )}
      {settingsTab === 'ai' && role === 'admin' && (
        <div className="settings-group-body settings-tab-body">
            <section className="panel settings-ai-panel">
              <div className="panel-header compact">
                <div>
                  <h2>AI 模型设置</h2>
                  <p>按「文字模型 / 识图模型」分类，各自配置主力与备用；切换供应商会自动联动 Base URL（默认走 AI Gateway）</p>
                </div>
              </div>
              <div className="settings-ai-tabs">
                <button
                  type="button"
                  className={aiCapabilityTab === 'text' ? 'active' : ''}
                  onClick={() => setAiCapabilityTab('text')}
                >
                  文字模型
                </button>
                <button
                  type="button"
                  className={aiCapabilityTab === 'vision' ? 'active' : ''}
                  onClick={() => setAiCapabilityTab('vision')}
                >
                  识图模型
                </button>
              </div>
              <div className="form-grid settings-form settings-ai-form">
                <label className="field">
                  <span>运行模式</span>
                  <select value={aiModeDraft} onChange={(event) => setAiModeDraft(event.target.value as AiModelConfig['mode'])}>
                    <option value="deepseek-direct">直连 / AI Gateway</option>
                    <option value="baml-runtime">BAML Runtime</option>
                  </select>
                </label>
                {aiModeDraft === 'baml-runtime' && (
                  <>
                    <label className="field wide">
                      <span>BAML Runtime URL</span>
                      <input
                        value={aiRuntimeUrlDraft}
                        placeholder="例如：https://ai-runtime.example.com"
                        onChange={(event) => setAiRuntimeUrlDraft(event.target.value)}
                      />
                    </label>
                    <label className="field wide">
                      <span>BAML Runtime 模型 Key</span>
                      <input
                        type="password"
                        value={aiApiKeyDraft}
                        placeholder={aiModelConfig?.hasApiKey ? `已保存：${aiModelConfig.apiKeyPreview ?? '已保存'}` : '可选，输入后加密保存'}
                        onChange={(event) => setAiApiKeyDraft(event.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="settings-ai-routes">
                {aiRouteMeta.filter((route) => route.capability === aiCapabilityTab).map((route) => {
                  const draft = aiRouteDrafts[route.key]
                  const saved = aiModelConfig?.[route.key]
                  const testResult = aiRouteTestResults[route.key]
                  const modelOptions = aiRouteModelOptions[route.key]
                  const modelError = aiRouteModelError[route.key]
                  return (
                    <article className="settings-ai-route-card" key={route.key}>
                      <div className="settings-ai-route-head">
                        <div>
                          <strong>{route.title}</strong>
                          <span>{route.description}</span>
                        </div>
                        <em className={saved?.hasApiKey ? 'ready' : ''}>
                          {saved?.hasApiKey ? (saved.keySource === 'environment' ? '环境 Key' : '已保存 Key') : '未配置 Key'}
                        </em>
                      </div>
                      <div className="form-grid settings-form settings-ai-route-form">
                        <label className="field">
                          <span>供应商</span>
                          <select value={draft.provider} onChange={(event) => updateAiRouteDraft(route.key, { provider: event.target.value as AiModelConfig['provider'] })}>
                            {aiProviderOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="settings-ai-baseurl-label">
                            Base URL
                            {gatewayBaseUrlForProvider(draft.provider) && (
                              <button
                                type="button"
                                className="settings-ai-url-toggle"
                                onClick={() =>
                                  updateAiRouteDraft(route.key, {
                                    baseUrl: isGatewayBaseUrl(draft.baseUrl)
                                      ? directBaseUrlForProvider(draft.provider)
                                      : gatewayBaseUrlForProvider(draft.provider),
                                  })
                                }
                              >
                                {isGatewayBaseUrl(draft.baseUrl) ? '改为直连' : '改走网关'}
                              </button>
                            )}
                          </span>
                          <input value={draft.baseUrl} onChange={(event) => updateAiRouteDraft(route.key, { baseUrl: event.target.value })} />
                          <small className="settings-ai-model-hint">
                            {isGatewayBaseUrl(draft.baseUrl) ? '当前走 AI Gateway（缓存 / 重试 / 用量看板）' : '当前为官方直连'}，改完点「测试」确认是否可用
                          </small>
                        </label>
                        <label className="field">
                          <span>模型</span>
                          <div className="settings-ai-model-pick">
                            <input
                              value={draft.model}
                              name={`ai-model-${route.key}`}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-1p-ignore="true"
                              data-lpignore="true"
                              placeholder={defaultModelForProvider(draft.provider) || '输入模型名称'}
                              onChange={(event) => updateAiRouteDraft(route.key, { model: event.target.value })}
                            />
                            <button
                              type="button"
                              className="ghost-button compact-button"
                              onClick={() => void fetchRouteModels(route.key)}
                              disabled={fetchingModelsRoute === route.key}
                            >
                              {fetchingModelsRoute === route.key ? '获取中…' : '获取模型'}
                            </button>
                          </div>
                          {modelOptions && modelOptions.length > 0 && (
                            <select
                              className="settings-ai-model-select"
                              value={modelOptions.includes(draft.model) ? draft.model : ''}
                              onChange={(event) => {
                                if (event.target.value) {
                                  updateAiRouteDraft(route.key, { model: event.target.value })
                                }
                              }}
                            >
                              <option value="">已拉取 {modelOptions.length} 个模型，选择以填入…</option>
                              {modelOptions.map((model) => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          )}
                          {modelError && <small className="settings-inline-error">{modelError}</small>}
                        </label>
                        <label className="field">
                          <span>API Key</span>
                          <input
                            type="password"
                            value={aiRouteKeyDrafts[route.key] ?? ''}
                            placeholder={saved?.hasApiKey ? `已配置：${saved.apiKeyPreview ?? '已保存'}` : '输入后加密保存'}
                            onChange={(event) => setAiRouteKeyDrafts((current) => ({ ...current, [route.key]: event.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="settings-ai-route-actions">
                        {testResult && <p className={testResult.ok ? 'settings-test-ok' : 'settings-inline-error'}>{testResult.message}</p>}
                        <div>
                          {saved?.keySource === 'setting' && (
                            <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(false, route.key)} disabled={isAiModelSaving}>
                              清除 Key
                            </button>
                          )}
                          <button className="ghost-button compact-button" type="button" onClick={() => void testAiRoute(route.key, route.capability)} disabled={testingAiRoute === route.key}>
                            {testingAiRoute === route.key ? '测试中…' : '测试'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="settings-ai-meta">
                <p className="settings-tool-note">
                  {aiModelConfig?.encryptionReady
                    ? '设置页填写的 API Key 会加密保存在 D1；平台默认 Key 优先放在 Cloudflare Secret，前端只显示保存状态。'
                    : '生产环境还没有配置 AI_SETTINGS_SECRET，暂不能安全保存租户自带 API Key。'}
                </p>
                {aiModeDraft === 'baml-runtime' && !aiModelConfig?.runtimeConfigured && (
                  <p className="settings-inline-error">启用 BAML Runtime 前，需要配置 Runtime URL 或部署环境变量 AI_RUNTIME_URL。</p>
                )}
                <div className="settings-ai-actions">
                  {aiModelConfig?.hasApiKey && (
                    <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(true)} disabled={isAiModelSaving}>
                      清除 Key
                    </button>
                  )}
                  <button className="soft-primary-button" type="button" onClick={() => void saveAiModelConfig()} disabled={isAiModelSaving || !aiModelDraft.trim()}>
                    <Sparkles size={17} />
                    {isAiModelSaving ? '保存中…' : '保存 AI 设置'}
                  </button>
                </div>
              </div>
              <details className="settings-workers-ai">
                <summary>
                  <Sparkles size={15} />
                  <span>Workers AI · Cloudflare 自带模型（终极兜底 / 未来全量迁移）</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="settings-workers-ai-body">
                  <p>
                    Workers AI 是 Cloudflare 在边缘 GPU 上托管的一批开源模型（Llama、Qwen、Mistral、Flux 文生图、Whisper 语音、Embedding 等），
                    <strong>无需任何外部厂商账号或 API Key</strong>，从 Worker 里一行 <code>env.AI.run(...)</code> 即可调用，按用量计费且每天有免费额度。
                  </p>
                  <ul>
                    <li><strong>计费单位：Neurons</strong>，<strong>$0.011 / 1,000 Neurons</strong>；每个模型把 token / 生成步数 / 音频秒数折算成 Neurons。</li>
                    <li><strong>每天免费 10,000 Neurons</strong>（Free 与 Paid 计划都送，按天重置），轻量任务基本白嫖。</li>
                    <li>示例：Llama 3.1 8B 约 $0.03 / 百万输入 token、$0.20 / 百万输出 token；Embedding 极便宜；Flux 文生图按张/步计费；Whisper 按音频时长。</li>
                  </ul>
                  <p className="settings-tool-note">
                    规划：等外部付费模型用完后，把全站 AI 切到 Workers AI，省去逐家采购对接。当前可作为「DeepSeek/Gemini → Kimi → Workers AI」链路的<strong>最后一道兜底</strong>，
                    需要时由开发侧在 Worker 加 <code>[ai]</code> 绑定即可启用（暂未开启）。
                  </p>
                </div>
              </details>
              <details className="settings-workers-ai" open>
                <summary>
                  <Sparkles size={15} />
                  <span>OpenRouter 免费模型（每日自动实测可用性）</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="settings-workers-ai-body">
                  <div className="or-free-head">
                    <p className="settings-tool-note">
                      一个 OpenRouter Key 即可调大量 <code>:free</code> 免费模型，但它们经常变动。系统每天自动「拉取 + 逐个实测」，下面只标出真实可用的；点「立即扫描」可手动刷新。
                      {orScannedAt ? <> 上次扫描：{orScannedAt}。</> : null}
                    </p>
                    <button type="button" className="ghost-button compact-button" onClick={() => void scanFreeModels()} disabled={orScanning}>
                      <RotateCcw size={14} />
                      {orScanning ? '扫描中…（约 10-20 秒）' : '立即扫描'}
                    </button>
                  </div>
                  {orError && <p className="settings-inline-error">{orError}</p>}
                  {orFreeModels.length === 0 && !orScanning && <p className="calendar-empty-hint">还没有扫描结果，点「立即扫描」获取。</p>}
                  {orFreeModels.length > 0 && (
                    <div className="or-free-list">
                      {orFreeModels.map((model) => {
                        const statusLabel = model.status === 'ok' ? '可用' : model.status === 'limited' ? '限流' : model.status === 'unavailable' ? '已下架' : '异常'
                        return (
                          <div className={`or-free-row status-${model.status}`} key={model.id}>
                            <div className="or-free-main">
                              <code>{model.id}</code>
                              <div className="or-free-meta">
                                <span className={`or-free-status status-${model.status}`}>{statusLabel}</span>
                                {model.vision && <span className="or-free-vision">可识图</span>}
                                {model.context > 0 && <span>{Math.round(model.context / 1000)}K 上下文</span>}
                              </div>
                            </div>
                            {model.status === 'ok' && (
                              <div className="or-free-actions">
                                <button type="button" className="ghost-button compact-button" onClick={() => applyFreeModelToRoute('textFallback', model.id)}>设为文字备用</button>
                                {model.vision && (
                                  <button type="button" className="ghost-button compact-button" onClick={() => applyFreeModelToRoute('visionFallback', model.id)}>设为识图备用</button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="settings-tool-note">提示：点「设为文字/识图备用」会把对应路由切到该免费模型，记得在上方点「保存 AI 设置」。免费档有速率上限，建议只作备用兜底。</p>
                </div>
              </details>
            </section>
        </div>
      )}
      {settingsTab === 'design' && role === 'admin' && (
        <div className="settings-group-body settings-tab-body">
            <section className="panel settings-design-panel">
              <div className="panel-header compact">
                <div>
                  <h2>设计类型</h2>
                  <p>新建任务时使用二级选择器：大类 / 子类，管理员可自定义增删</p>
                </div>
              </div>
              <div className="design-type-tabs" role="tablist">
                {designTypeGroups.map((group) => (
                  <button
                    type="button"
                    role="tab"
                    key={group.name}
                    aria-selected={activeGroup?.name === group.name}
                    className={`design-type-tab ${activeGroup?.name === group.name ? 'active' : ''} ${draggingGroupName === group.name ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDraggingGroupName(group.name)}
                    onDragEnd={() => setDraggingGroupName('')}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveDesignTypeGroup(group.name)}
                    onClick={() => setActiveDesignGroup(group.name)}
                  >
                    <GripVertical size={13} />
                    <i className="design-type-tab-swatch" style={{ '--design-type-color': validDesignTypeColor(group.color) || designTypeColorForIndex(0) } as CSSProperties} />
                    <span>{group.name}</span>
                    <em>{group.items.length}</em>
                  </button>
                ))}
                {isAddingGroup ? (
                  <input
                    className="design-type-tab-add-input"
                    autoFocus
                    value={newGroupName}
                    placeholder="大类名称，回车添加"
                    onChange={(event) => setNewGroupName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        addDesignTypeGroup()
                      }
                      if (event.key === 'Escape') {
                        setNewGroupName('')
                        setIsAddingGroup(false)
                      }
                    }}
                    onBlur={() => {
                      addDesignTypeGroup()
                      setIsAddingGroup(false)
                    }}
                  />
                ) : (
                  <button type="button" className="design-type-tab-add" aria-label="添加大类" onClick={() => setIsAddingGroup(true)}>
                    <Plus size={15} />
                  </button>
                )}
              </div>
              {activeGroup && (
                <div className="design-type-active">
                  <div className="design-type-active-head">
                    <input
                      className="design-type-group-name-input"
                      aria-label={`设计类型大类名称：${activeGroup.name}`}
                      value={groupNameDrafts[activeGroup.name] ?? activeGroup.name}
                      onChange={(event) => setGroupNameDrafts((current) => ({ ...current, [activeGroup.name]: event.target.value }))}
                      onBlur={() => renameDesignTypeGroup(activeGroup.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                          setGroupNameDrafts((current) => ({ ...current, [activeGroup.name]: activeGroup.name }))
                          event.currentTarget.blur()
                        }
                      }}
                    />
                    <div className="design-type-color-editor" aria-label={`${activeGroup.name} 日历颜色`}>
                      <span className="design-type-color-current" style={{ '--design-type-color': validDesignTypeColor(activeGroup.color) || designTypeColorForIndex(0) } as CSSProperties} />
                      <div className="design-type-color-options">
                        {designTypeColorPalette.map((color) => (
                          <button
                            type="button"
                            key={color}
                            className={validDesignTypeColor(activeGroup.color) === color.toLowerCase() ? 'active' : ''}
                            aria-label={`设置 ${activeGroup.name} 颜色为 ${color}`}
                            title={color}
                            style={{ '--design-type-color': color } as CSSProperties}
                            onClick={() => updateDesignTypeGroupColor(activeGroup.name, color)}
                          />
                        ))}
                      </div>
                    </div>
                    <small>{activeGroup.items.length} 个子类</small>
                    <button
                      className="icon-button danger-icon"
                      aria-label={`删除设计类型大类 ${activeGroup.name}`}
                      disabled={designTypeGroups.length <= 1}
                      onClick={() => requestDeleteDesignTypeGroup(activeGroup.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="design-type-list plain">
                    {activeGroup.items.map((item) => {
                      const isEditingThisItem = editingItem?.groupName === activeGroup.name && editingItem.item === item
                      return isEditingThisItem ? (
                        <input
                          key={item}
                          className="design-type-item-edit-input"
                          autoFocus
                          value={itemEditDraft}
                          onChange={(e) => setItemEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameDesignTypeItem(activeGroup.name, item)
                            if (e.key === 'Escape') { setEditingItem(null); setItemEditDraft('') }
                          }}
                          onBlur={() => renameDesignTypeItem(activeGroup.name, item)}
                        />
                      ) : (
                        <span
                          className={`design-type-item ${draggingItem?.groupName === activeGroup.name && draggingItem.item === item ? 'dragging' : ''}`}
                          draggable
                          key={item}
                          onDragStart={() => setDraggingItem({ groupName: activeGroup.name, item })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => moveDesignTypeItem(activeGroup.name, item)}
                          onDragEnd={() => setDraggingItem(null)}
                        >
                          {item}
                          <button
                            aria-label={`重命名设计类型 ${activeGroup.name} / ${item}`}
                            onClick={() => { setEditingItem({ groupName: activeGroup.name, item }); setItemEditDraft(item) }}
                          >
                            <Pencil size={10} />
                          </button>
                          <button aria-label={`删除设计类型 ${activeGroup.name} / ${item}`} onClick={() => requestDeleteDesignTypeItem(activeGroup.name, item)}>
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                    {addingItemGroup === activeGroup.name ? (
                      <input
                        className="design-type-item-add-input"
                        autoFocus
                        value={newGroupItems[activeGroup.name] ?? ''}
                        placeholder="子类名称，回车添加"
                        onChange={(event) => setNewGroupItems((current) => ({ ...current, [activeGroup.name]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            addDesignTypeItem(activeGroup.name)
                          }
                          if (event.key === 'Escape') {
                            setNewGroupItems((current) => ({ ...current, [activeGroup.name]: '' }))
                            setAddingItemGroup(null)
                          }
                        }}
                        onBlur={() => {
                          addDesignTypeItem(activeGroup.name)
                          setAddingItemGroup(null)
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="design-type-item-add"
                        aria-label={`为 ${activeGroup.name} 添加子类`}
                        onClick={() => setAddingItemGroup(activeGroup.name)}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
        </div>
      )}

      {settingsTab === 'security' && (
        <div className="settings-tab-body">
          {role === 'admin' && (
            <div className="settings-tabs view-mode-tabs settings-subtabs">
              <button type="button" className={securityTab === 'tokens' ? 'active' : ''} onClick={() => setSecurityTab('tokens')}>
                <KeyRound size={15} />
                口令管理
              </button>
              <button type="button" className={securityTab === 'account' ? 'active' : ''} onClick={() => setSecurityTab('account')}>
                <UserCircle size={15} />
                账号安全
              </button>
            </div>
          )}
          {role === 'admin' && securityTab === 'tokens' && (
            <section className="settings-subsection settings-permission-panel">
              <div className="panel-header compact">
                <div>
                  <h2>口令管理</h2>
                  <p>生成或停用后台访问口令</p>
                </div>
              </div>
              <div className="token-create">
                <label className="field">
                  <span>备注</span>
                  <input value={tokenLabel} placeholder="例如：协作设计师 / 甲方财务 / 对接测试" onChange={(event) => setTokenLabel(event.target.value)} />
                </label>
                <label className="field">
                  <span>权限</span>
                  <select value={tokenScope} onChange={(event) => setTokenScope(event.target.value as TokenScope)}>
                    {tokenScopeOptions.map((option) => (
                      <option key={option.value} value={option.value} title={option.desc}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>有效期</span>
                  <select value={tokenExpiry} onChange={(event) => setTokenExpiry(event.target.value)}>
                    <option value="permanent">永久有效</option>
                    <option value="7">7 天</option>
                    <option value="30">30 天</option>
                    <option value="90">90 天</option>
                  </select>
                </label>
                <button className="soft-primary-button" onClick={handleCreate}>
                  <KeyRound size={17} />
                  申请口令
                </button>
              </div>
              {activeTokenScope && <p className="token-scope-hint"><strong>{activeTokenScope.label}</strong>：{activeTokenScope.desc}</p>}
              <div className="token-list">
                {accessTokens.length === 0 && <p className="calendar-empty-hint">还没有生成过口令。</p>}
                {accessTokens.map((token) => {
                  const status = tokenStatus(token)
                  return (
                    <div className={`token-row ${token.id === newTokenId ? 'fresh' : ''}`} key={token.id}>
                      <div className="token-row-main">
                        <strong>{token.label} <em className="token-scope-badge">{tokenScopeLabel(token.scope)}</em></strong>
                        <code>{token.token}</code>
                        <small>
                          创建于 {token.createdAt} · {token.expiresAt ? `${token.expiresAt} 到期` : '永久有效'}
                          {token.lastUsedAt ? ` · 最近使用 ${token.lastUsedAt}` : ' · 未使用过'}
                        </small>
                      </div>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                      <div className="token-row-actions">
                        <button className="icon-button" aria-label="复制口令" onClick={() => onCopyToken(token.token)}>
                          <Copy size={15} />
                        </button>
                        <button
                          className="ghost-button compact-button"
                          onClick={() => onToggleToken(token.id, !token.disabled)}
                        >
                          {token.disabled ? '启用' : '停用'}
                        </button>
                        <button className="icon-button danger-icon" aria-label="删除口令" onClick={() => onDeleteToken(token.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {(role !== 'admin' || securityTab === 'account') && (
            <section className="settings-subsection settings-security-panel">
              <div className="panel-header compact">
                <div>
                  <h2>账号安全</h2>
                  <p>当前登录身份和退出操作</p>
                </div>
              </div>
              <p className="settings-tool-note">当前身份：{role === 'admin' ? '管理员（最高权限）' : '访问口令用户'}；公共电脑用完请退出。</p>
              {role === 'admin' && (
                <details className="settings-password-collapse">
                  <summary>
                    <KeyRound size={15} />
                    <span>修改密码</span>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="password-change-form">
                    <label className="field">
                      <span>当前密码</span>
                      <input
                        type="password"
                        value={currentPassword}
                        placeholder="输入当前密码"
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>新密码</span>
                      <input
                        type="password"
                        value={newPassword}
                        placeholder="至少 8 位"
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>确认新密码</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        placeholder="再次输入新密码"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </label>
                    {passwordError && <p className="settings-inline-error">{passwordError}</p>}
                    <button className="ghost-button" onClick={() => void submitPasswordChange()} disabled={!currentPassword || !newPassword || !confirmPassword || isPasswordSaving}>
                      <KeyRound size={16} />
                      {isPasswordSaving ? '保存中…' : '修改密码'}
                    </button>
                  </div>
                </details>
              )}
              <button className="danger-button" onClick={onSignOut}>
                <LogOut size={17} />
                退出登录
              </button>
            </section>
          )}
        </div>
      )}

      {settingsTab === 'system' && (
        <div className="settings-group-body settings-system-body settings-tab-body">
          <section className="settings-subsection settings-backup-panel">
            <div className="panel-header compact">
              <div>
                <h2>数据备份</h2>
                <p>导出当前数据快照</p>
              </div>
            </div>
            <button className="ghost-button" onClick={onExportBackup}>
              <Download size={17} />
              导出备份 JSON
            </button>
          </section>
          <section className="settings-subsection settings-version-panel">
            <div className="panel-header compact">
              <div>
                <h2>产品版本</h2>
                <p>用于确认当前上线批次</p>
              </div>
            </div>
            <dl className="version-meta">
              <div>
                <dt>当前版本</dt>
                <dd>v{appVersion}</dd>
              </div>
              <div>
                <dt>发布时间</dt>
                <dd>{appReleaseDate}</dd>
              </div>
            </dl>
          </section>
          <section className="settings-subsection settings-cloudflare-panel cloudflare-details">
            <div className="panel-header compact">
              <div>
                <h2>系统资源</h2>
                <p>当前正式环境绑定信息</p>
              </div>
            </div>
            <div className="cloudflare-list">
              <span>Worker：designer-worklog（mayeai.com）</span>
              <span>D1：designer-worklog-db</span>
              <span>R2：designer-worklog-uploads · 18.6 GB</span>
              <span>登录体系：管理员邮箱 + 管理密码，或后台生成的访问口令</span>
            </div>
          </section>
        </div>
      )}
      {settingsConfirmDialog && (
        <ConfirmDialogModal
          dialog={settingsConfirmDialog}
          isBusy={isSettingsConfirmDialogBusy}
          onClose={() => setSettingsConfirmDialog(null)}
          onConfirm={() => void handleSettingsConfirm()}
        />
      )}
    </section>
  )
}

function ConfirmDialogModal({
  dialog,
  isBusy,
  onClose,
  onConfirm,
}: {
  dialog: ConfirmDialogState
  isBusy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const isDanger = dialog.tone === 'danger'

  return (
    <ModalShell
      className={`delete-confirm-modal confirm-dialog-modal ${isDanger ? 'danger-confirm' : ''} ${dialog.hideIcon ? 'compact-confirm-dialog' : ''}`}
      labelledBy="confirm-dialog-title"
      onClose={onClose}
    >
      {!dialog.hideIcon && (
        <div className="delete-confirm-icon">
          {isDanger ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
        </div>
      )}
      <div className="delete-confirm-copy">
        {dialog.eyebrow && <p className="eyebrow">{dialog.eyebrow}</p>}
        <h2 id="confirm-dialog-title">{dialog.title}</h2>
        <p>{dialog.body}</p>
      </div>
      {dialog.details && dialog.details.length > 0 && (
        <div className="delete-confirm-meta">
          {dialog.details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      )}
      <div className="delete-confirm-actions">
        <button className="ghost-button" disabled={isBusy} onClick={onClose}>
          {dialog.cancelText ?? '取消'}
        </button>
        <button className={isDanger ? 'danger-button solid-danger-button' : 'primary-button'} disabled={isBusy} onClick={onConfirm}>
          {isBusy ? '处理中…' : dialog.confirmText}
        </button>
      </div>
    </ModalShell>
  )
}

function VoidTaskModal({
  task,
  isBusy,
  onClose,
  onConfirm,
}: {
  task: Task
  isBusy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const submit = () => {
    if (isBusy) {
      return
    }
    onConfirm('')
  }

  return (
    <ModalShell className="delete-confirm-modal void-task-modal danger-confirm light-confirm-modal" labelledBy="void-task-title" onClose={onClose}>
      <div className="delete-confirm-copy">
        <h2 id="void-task-title">确定作废「{task.title}」吗？</h2>
        <p>作废后，这个任务不会计入工时、收入和结算；管理员仍可在数据中保留记录，避免误删真实历史。</p>
      </div>
      <div className="delete-confirm-meta">
        <span>{task.type}</span>
        <span>{monthLabelOf(taskSettlementMonth(task))}</span>
      </div>
      <div className="delete-confirm-actions">
        <button className="ghost-button" disabled={isBusy} onClick={onClose}>
          取消
        </button>
        <button className="danger-button solid-danger-button" disabled={isBusy} onClick={submit}>
          {isBusy ? '处理中…' : '确认作废'}
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  className,
  labelledBy,
  onClose,
  closeOnBackdrop = false,
  closeOnEscape = false,
  children,
}: {
  className?: string
  labelledBy: string
  onClose: () => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  children: React.ReactNode
}) {
  const modalRef = useRef<HTMLElement | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // Ref tracks live offset so native event closures are never stale
  const offsetRef = useRef({ x: 0, y: 0 })
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        const saveButton = modalRef.current?.querySelector<HTMLButtonElement>('[data-modal-save="true"]')
        if (saveButton && !saveButton.disabled) {
          event.preventDefault()
          saveButton.click()
        }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [closeOnEscape, onClose])

  const clampModalOffset = useCallback((nextOffset: { x: number; y: number }) => {
    const modal = modalRef.current
    if (!modal) return nextOffset

    const rect = modal.getBoundingClientRect()
    const currentOffset = offsetRef.current
    const deltaX = nextOffset.x - currentOffset.x
    const deltaY = nextOffset.y - currentOffset.y
    const nextRect = {
      left: rect.left + deltaX,
      right: rect.right + deltaX,
      top: rect.top + deltaY,
      bottom: rect.bottom + deltaY,
    }
    const minVisibleX = Math.min(180, rect.width * 0.5)
    const minVisibleY = Math.min(120, rect.height * 0.35)
    let x = nextOffset.x
    let y = nextOffset.y

    if (nextRect.right < minVisibleX) x += minVisibleX - nextRect.right
    if (nextRect.left > window.innerWidth - minVisibleX) x -= nextRect.left - (window.innerWidth - minVisibleX)
    if (nextRect.bottom < minVisibleY) y += minVisibleY - nextRect.bottom
    if (nextRect.top > window.innerHeight - minVisibleY) y -= nextRect.top - (window.innerHeight - minVisibleY)

    return { x, y }
  }, [])

  const stopModalDrag = useCallback((event?: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerId = dragPointerIdRef.current
    if (event && pointerId !== null) {
      try {
        if (event.currentTarget.hasPointerCapture(pointerId)) {
          event.currentTarget.releasePointerCapture(pointerId)
        }
      } catch {
        // Some synthetic or interrupted pointer sequences no longer have an active capture.
      }
    }
    dragPointerIdRef.current = null
    dragStateRef.current = null
    modalRef.current?.classList.remove('is-dragging')
  }, [])

  const handleModalDragStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    dragPointerIdRef.current = event.pointerId
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Drag still works while the pointer remains over the handle; real pointer sequences capture normally.
    }
    modalRef.current?.classList.add('is-dragging')
  }, [])

  const handleModalDragMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current || dragPointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    const newOffset = clampModalOffset({
      x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
      y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
    })
    offsetRef.current = newOffset
    setOffset(newOffset)
  }, [clampModalOffset])

  const handleModalDragEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    stopModalDrag(event)
  }, [stopModalDrag])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        ref={modalRef}
        className={`task-modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={(offset.x !== 0 || offset.y !== 0) ? ({
          '--modal-drag-x': `${offset.x}px`,
          '--modal-drag-y': `${offset.y}px`,
        } as CSSProperties) : undefined}
      >
        <button
          type="button"
          className="modal-drag-handle"
          data-modal-drag-handle="true"
          aria-label="拖动弹窗"
          title="拖动弹窗"
          onPointerDown={handleModalDragStart}
          onPointerMove={handleModalDragMove}
          onPointerUp={handleModalDragEnd}
          onPointerCancel={handleModalDragEnd}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  )
}

function renderKnowledgeParagraph(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

function DailyKnowledgeModal({
  item,
  isLoading,
  canRefresh,
  onRefresh,
  onClose,
  onFavorite,
}: {
  item: DailyKnowledgeItem
  isLoading: boolean
  canRefresh: boolean
  onRefresh: () => void
  onClose: () => void
  onFavorite?: (item: DailyKnowledgeItem) => Promise<boolean>
}) {
  const sourceLabel = item.source.startsWith('AI · ') ? `AI 生成（${item.source.replace('AI · ', '')}）` : item.source
  const [favorited, setFavorited] = useState(false)
  const [favoriteSaving, setFavoriteSaving] = useState(false)

  const handleFavorite = async () => {
    if (!onFavorite || favoriteSaving || favorited) return
    setFavoriteSaving(true)
    try {
      const ok = await onFavorite(item)
      if (ok) setFavorited(true)
    } finally {
      setFavoriteSaving(false)
    }
  }

  return (
    <ModalShell className="daily-knowledge-modal" labelledBy="daily-knowledge-title" onClose={onClose}>
      <header className="daily-knowledge-modal-header">
        <div>
          <h2 id="daily-knowledge-title">{item.title}</h2>
          <p>{item.category} · {sourceLabel}</p>
        </div>
        <button className="icon-button daily-knowledge-close-btn" type="button" aria-label="关闭" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="daily-knowledge-article">
        {item.body.map((paragraph, index) => (
          <p key={`${item.title}-${index}`}>{renderKnowledgeParagraph(paragraph)}</p>
        ))}
      </div>
      <footer className="daily-knowledge-modal-footer">
        {onFavorite && (
          <button
            className={`daily-knowledge-favorite-btn ${favorited ? 'favorited' : ''}`}
            type="button"
            disabled={favoriteSaving || favorited}
            onClick={() => void handleFavorite()}
            title={favorited ? '已收藏到知识库' : '收藏到知识库'}
            aria-label={favorited ? '已收藏' : '收藏'}
          >
            <Star size={15} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        )}
        {canRefresh && (
          <button className="daily-knowledge-primary" type="button" disabled={isLoading} onClick={onRefresh}>
            {isLoading ? '生成中' : '换一篇'}
          </button>
        )}
      </footer>
    </ModalShell>
  )
}

function FilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
  const fileType = fileTypeForAsset(file).type
  const sourceUrl = fileDocumentPreviewSource(file)
  const previewUrl = authedPreviewUrl(file.previewUrl ?? file.sourceUrl)
  const isImage = isInlineImageFileType(fileType)
  const isRasterPreview = Boolean(file.previewUrl) && ['PSD', 'AI'].includes(fileType)
  const isPdfLike = isInlineDocumentFileType(fileType)
  const isVideo = videoFileTypes.has(fileType)
  const isOffice = isOfficeFileType(fileType)

  return (
    <ModalShell className="file-preview-modal" labelledBy="file-preview-title" onClose={onClose}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">文件预览</p>
            <h2 id="file-preview-title">{file.name}</h2>
          </div>
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="file-preview-body">
          {(isImage || isRasterPreview) && previewUrl ? (
            <img src={previewUrl} alt={file.name} loading="lazy" />
          ) : isVideo && sourceUrl ? (
            <video className="file-preview-video" src={sourceUrl} controls preload="metadata" />
          ) : isPdfLike && sourceUrl ? (
            <iframe className="file-preview-frame" src={sourceUrl} title={file.name} />
          ) : isOffice && sourceUrl ? (
            <OfficePreview fileType={fileType} sourceUrl={sourceUrl} />
          ) : (
            <div className="file-preview-placeholder">
              {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
              <strong>{file.type}</strong>
              <span>该格式无法在浏览器中稳定直接预览，可以在新窗口打开源文件查看或下载。</span>
              {sourceUrl && (
                <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  打开源文件
                </a>
              )}
            </div>
          )}
        </div>
    </ModalShell>
  )
}

type SpreadsheetPreview = {
  name: string
  rows: string[][]
}[]

function OfficePreview({
  fileType,
  sourceUrl,
  compact = false,
}: {
  fileType: string
  sourceUrl: string
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('正在加载预览…')
  const [error, setError] = useState('')
  const [workbookPreview, setWorkbookPreview] = useState<SpreadsheetPreview>([])
  const isLegacyOffice = ['DOC', 'XLS', 'PPT'].includes(fileType)

  useEffect(() => {
    let cancelled = false

    const renderPreview = async () => {
      setError('')
      setStatus('正在加载预览…')
      setWorkbookPreview([])
      if (!containerRef.current) {
        return
      }
      containerRef.current.replaceChildren()

      if (isLegacyOffice) {
        setStatus('')
        setError('旧版 Office 二进制格式暂不支持稳定浏览器直读，请转为 DOCX / XLSX / PPTX 后可直接预览。')
        return
      }

      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('文件读取失败')
        }
        const buffer = await response.arrayBuffer()
        if (cancelled) {
          return
        }

        if (fileType === 'DOCX') {
          const { renderAsync } = await import('docx-preview')
          await renderAsync(buffer, containerRef.current, undefined, {
            className: 'docx-preview-document',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: !compact,
            useBase64URL: true,
          })
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'PPTX') {
          const { init } = await import('pptx-preview')
          const previewer = init(
            containerRef.current,
            compact ? { width: 480, height: 270 } : { width: 960, height: 540 },
          )
          await previewer.preview(buffer)
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'XLSX') {
          const ExcelJS = await import('exceljs')
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer)
          const sheets = workbook.worksheets.slice(0, 5).map((sheet) => {
            const rows: string[][] = []
            sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber > 60) {
                return
              }
              const values = Array.isArray(row.values) ? row.values.slice(1, 16) : []
              rows.push(values.map(stringifyCellValue))
            })
            return { name: sheet.name, rows }
          })
          if (!cancelled) {
            setWorkbookPreview(sheets)
            setStatus('')
          }
          return
        }
      } catch (caughtError) {
        if (!cancelled) {
          setStatus('')
          setError(caughtError instanceof Error ? caughtError.message : '预览失败，请打开源文件查看。')
        }
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
    }
  }, [compact, fileType, isLegacyOffice, sourceUrl])

  return (
    <div className={`office-preview office-preview-${fileType.toLowerCase()} ${compact ? 'compact' : ''}`}>
      {status && <div className="office-preview-status">{status}</div>}
      {error && (
        <div className="file-preview-placeholder">
          <FileText size={compact ? 28 : 42} />
          <strong>{fileType}</strong>
          <span>{compact ? '旧版格式无法生成浏览器缩略图' : error}</span>
          {!compact && (
            <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              打开源文件
            </a>
          )}
        </div>
      )}
      {fileType === 'XLSX' && workbookPreview.length > 0 && (
        <div className="spreadsheet-preview">
          {workbookPreview.map((sheet) => (
            <section key={sheet.name}>
              <h3>{sheet.name}</h3>
              <div className="spreadsheet-table-wrap">
                <table>
                  <tbody>
                    {sheet.rows.map((row, rowIndex) => (
                      <tr key={`${sheet.name}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${sheet.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      <div ref={containerRef} className="office-render-root" />
    </div>
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
  const estimatedMinutes = Math.max(30, Math.round((Number(task.estimatedHours) || 2) * 60))
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
  const aiSuggestionAppliedRef = useRef<string | null>(null)
  const aiTitleSuggestionAppliedRef = useRef<string | null>(null)
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
  const [briefLightboxSrc, setBriefLightboxSrc] = useState<string | null>(null)
  const briefInputRef = useRef<HTMLInputElement | null>(null)
  const briefFilesRef = useRef<BriefItem[]>([])
  const [hourSuggestion, setHourSuggestion] = useState<HourEstimateSuggestion | null>(null)
  const [hourSuggestionError, setHourSuggestionError] = useState('')
  const [isHourSuggestionLoading, setIsHourSuggestionLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [activeDatePickerId, setActiveDatePickerId] = useState<string | null>(null)
  const supplementalMonthOptions = useMemo(() => supplementalMonthSelectOptions(monthPart(isoDate())), [])

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
      }
      return
    }
    setStartDate(addMinutesToPlanDateTime(value, -estimatedMinutes))
  }

  const updateEstimatedMinutes = (value: number) => {
    const nextMinutes = snapDurationMinutes(value)
    setEstimatedMinutes(nextMinutes)
    if (scheduleDerivedField === 'start') {
      setStartDate(addMinutesToPlanDateTime(estimatedDate, -nextMinutes))
      return
    }
    setEstimatedDate(addMinutesToPlanDateTime(startDate, nextMinutes))
  }

  const clearFieldError = (field: string) => {
    setFormErrors((current) => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const recordTaskAssistantLearning = (finalTitle: string, finalRequirement: string, finalType: string) => {
    // 若用户采用了 AI 建议后又做了修改，记录差异供 AI 持续学习。
    const appliedSuggestion = aiSuggestionAppliedRef.current
    if (appliedSuggestion && appliedSuggestion !== finalRequirement) {
      void api.recordTaskEditPair({ aiOutput: appliedSuggestion, userFinal: finalRequirement, designType: finalType })
    }
    const appliedTitle = aiTitleSuggestionAppliedRef.current
    if (appliedTitle && appliedTitle !== finalTitle) {
      void api.recordTaskTitleEditPair({ aiOutput: appliedTitle, userFinal: finalTitle, designType: finalType })
    }
    // 无论是否使用 AI，每次提交都记录最终选择的设计类型，供分类建议模型学习。
    if (finalTitle || finalRequirement) {
      void api.recordTaskTypeChoice({
        requirement: finalRequirement,
        title: finalTitle,
        finalType,
        aiSuggestedType: aiSuggestion?.suggestedType ?? undefined,
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

  const loadBriefFiles = async (fileList: FileList | File[] | null, source: 'picker' | 'paste' = 'picker') => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    setBriefError('')
    setIsBriefLoading(true)
    const added: BriefItem[] = []
    try {
      for (const file of files.slice(0, 6)) {
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
      if (added.length > 0) setBriefFiles((prev) => [...prev, ...added].slice(0, 6))
    } catch {
      setBriefError('读取附件失败，请换个文件或稍后重试')
    } finally {
      setIsBriefLoading(false)
      if (briefInputRef.current) briefInputRef.current.value = ''
    }
  }

  const handleBriefPaste = (event: React.ClipboardEvent) => {
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
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 助手暂时不可用')
    } finally {
      setIsAiLoading(false)
    }
  }

  const applyAiTitle = () => {
    if (!aiSuggestion?.suggestedTitle) return
    aiTitleSuggestionAppliedRef.current = aiSuggestion.suggestedTitle
    setTitle(aiSuggestion.suggestedTitle)
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) {
      return
    }
    const nextRequirement = taskAssistantRequirementWithoutOutputFiles(aiSuggestion.optimizedRequirement)
    aiSuggestionAppliedRef.current = nextRequirement
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
    setIsHourSuggestionLoading(true)
    try {
      const suggestion = await api.suggestHourEstimate({
        title,
        requirement,
        selectedType: type,
        startDate,
        estimatedDate,
      })
      setHourSuggestion(suggestion)
    } catch (error) {
      setHourSuggestionError(error instanceof Error ? error.message : 'AI 工时建议暂时不可用')
    } finally {
      setIsHourSuggestionLoading(false)
    }
  }

  const applyHourSuggestion = () => {
    if (!hourSuggestion) {
      return
    }
    updateEstimatedMinutes(snapDurationMinutes(hourSuggestion.suggestedHours * 60))
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
          <div className="field wide new-task-brief-field">
            <span className="field-label-row">
              <span>甲方文案附件（选填）</span>
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
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('drag-over')
                    void loadBriefFiles(e.dataTransfer.files)
                  }}
                >
                  <Plus size={briefFiles.length > 0 ? 16 : 14} />
                  {briefFiles.length === 0 && (isBriefLoading ? '正在读取…' : '上传、拖拽或 Command+V 粘贴甲方文案到这里')}
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
                {aiSuggestion && <em>{aiSuggestion.suggestedType}</em>}
                {aiSuggestion && (
                  <div className="ai-suggestion-inline-actions">
                    <button type="button" className="text-button" onClick={applyAiSuggestion}>
                      采用文案
                    </button>
                    {aiSuggestion.categoryExists ? (
                      <button type="button" className="text-button" onClick={applyAiCategory}>
                        采用分类
                      </button>
                    ) : (
                      <button type="button" className="text-button" onClick={() => void addSuggestedCategoryAndApply()}>
                        新增并采用分类
                      </button>
                    )}
                    {aiSuggestion.suggestedTitle && (
                      <button type="button" className="text-button" onClick={applyAiTitle}>
                        采用任务名称
                      </button>
                    )}
                  </div>
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
                    <div className="ai-suggestion-title-row">
                      <span className="ai-suggestion-title-label">建议任务名称</span>
                      <span className="ai-suggestion-title-text">{aiSuggestion.suggestedTitle}</span>
                    </div>
                  )}
                  <div className="ai-suggestion-body">
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
                  </div>
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
                {scheduleDerivedField === 'hours' ? (
                  <output className="new-task-hours-input new-task-hours-output" aria-label="预估工时">
                    {formatDuration(estimatedMinutes)}
                  </output>
                ) : (
                  <input
                    className="new-task-hours-input"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formatHoursInputValue(estimatedMinutes)}
                    onChange={(event) => updateEstimatedMinutes(Number(event.target.value || 0) * 60)}
                    aria-label="预估工时"
                  />
                )}
                <button
                  type="button"
                  className="new-task-ai-pill"
                  onClick={() => void requestHourSuggestion()}
                  disabled={isHourSuggestionLoading || (!type.trim() && !title.trim() && !requirement.trim())}
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
                  disabled={isHourSuggestionLoading || (!type.trim() && !title.trim() && !requirement.trim())}
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
                  <span>建议预估</span>
                  <strong>{hourSuggestion.suggestedHours.toFixed(1)} h</strong>
                  <em className={`hour-confidence confidence-${hourSuggestion.confidence}`}>{hourSuggestion.confidence}置信度</em>
                </div>
                <div className="hour-estimate-stats">
                  <span>{hourSuggestion.sampleCount} 条样本</span>
                  <span>平均 {hourSuggestion.averageHours.toFixed(1)} h</span>
                  <span>中位 {hourSuggestion.medianHours.toFixed(1)} h</span>
                  {hourSuggestion.averageDeliveryDays > 0 && <span>平均周期 {hourSuggestion.averageDeliveryDays.toFixed(1)} 天</span>}
                </div>
                <p>{hourSuggestion.historicalSummary}</p>
                {hourSuggestion.basis.length > 0 && (
                  <ul>
                    {hourSuggestion.basis.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="hour-estimate-actions">
                  {hourSuggestion.usedFallback && <small>同类型样本不足，已参考相近类型任务。</small>}
                  <button type="button" className="primary-button compact-button" onClick={applyHourSuggestion}>
                    采用建议
                  </button>
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
