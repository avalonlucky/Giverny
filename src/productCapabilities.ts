export type ProductShortcutItem = {
  id: string
  keys: string
  action: string
  answer?: string
  searchTerms: string[]
  adminOnly?: boolean
}

export type ProductShortcutGroup = {
  label: string
  items: ProductShortcutItem[]
}

export type ProductCapability = {
  id: string
  category: string
  title: string
  summary: string
  details?: string[]
  route?: string
  searchTerms: string[]
  adminOnly?: boolean
  shortcut?: Pick<ProductShortcutItem, 'keys' | 'action'>
  answer?: string
  evidenceStatus?: 'confirmed' | 'partial'
  sourceLabel?: string
}

export type ProductHelpMatch = Omit<ProductCapability, 'searchTerms' | 'answer'> & {
  answer: string
  score: number
}

export const productShortcutHelpGroups: ProductShortcutGroup[] = [
  {
    label: '全局',
    items: [
      { id: 'command-palette', keys: '⌘ K / Ctrl K', action: '打开命令面板', searchTerms: ['命令面板', '全局搜索', 'command palette'] },
      {
        id: 'income-visibility',
        keys: '⌘ ⇧ M / Ctrl ⇧ M',
        action: '显示 / 隐藏金额',
        answer: '显示或隐藏金额的快捷键是 **Command + Shift + M**；Windows 是 **Ctrl + Shift + M**。',
        searchTerms: ['显示金额', '隐藏金额', '金额脱敏', '收入脱敏', '预计收入', '金额快捷键'],
        adminOnly: true,
      },
      { id: 'shortcut-panel', keys: '? / ⌥ ⌥', action: '查看快捷键', searchTerms: ['快捷键帮助', '快捷键面板', '所有快捷键', '查看快捷键'] },
      { id: 'alice-panel', keys: '⌥ A', action: '打开 / 关闭爱丽丝 AI 助手（管理员）', searchTerms: ['工作助手', '爱丽丝', 'AI 助手', '打开助手', '关闭助手'], adminOnly: true },
      { id: 'new-task', keys: 'N', action: '新建任务', searchTerms: ['新建任务', '创建任务', '新增任务'] },
      { id: 'backfill-task', keys: '⇧ N', action: '补录任务', searchTerms: ['补录任务', '补录已完成任务', '历史任务补录'] },
      { id: 'record-progress', keys: 'P', action: '记录选中任务进展', searchTerms: ['记录进展', '任务进展', '添加进展'] },
      { id: 'open-files', keys: 'F', action: '打开文件库', searchTerms: ['文件库', '打开文件库', '任务文件'] },
      { id: 'open-settings', keys: ',', action: '打开设置', searchTerms: ['设置', '打开设置', '全站设置'] },
      { id: 'focus-task-search', keys: '/', action: '聚焦任务搜索', searchTerms: ['搜索任务', '任务搜索', '聚焦搜索'] },
      { id: 'close-overlay', keys: 'Esc', action: '关闭当前浮层', searchTerms: ['关闭弹窗', '关闭浮层', '退出弹窗'] },
    ],
  },
  {
    label: '导航',
    items: [
      { id: 'nav-dashboard', keys: '⌘ ⌥ 1', action: '工作台', searchTerms: ['跳转工作台', '打开工作台', '工作台导航'] },
      { id: 'nav-tasks', keys: '⌘ ⌥ 2', action: '任务', searchTerms: ['跳转任务', '打开任务列表', '任务导航'] },
      { id: 'nav-files', keys: '⌘ ⌥ 3', action: '文件库', searchTerms: ['跳转文件库', '文件库导航'] },
      { id: 'nav-insights', keys: '⌘ ⌥ 4', action: '洞察', searchTerms: ['跳转洞察', '打开洞察', '洞察导航'] },
      { id: 'nav-settlement', keys: '⌘ ⌥ 5', action: '结算', searchTerms: ['跳转结算', '打开结算', '结算导航'] },
      { id: 'nav-income', keys: '⌘ ⌥ 6', action: '收入', searchTerms: ['跳转收入', '打开收入', '收入导航'] },
      { id: 'nav-settings', keys: '⌘ ⇧ ⌥ ,', action: '设置', searchTerms: ['跳转设置', '设置导航'] },
      { id: 'nav-knowledge', keys: '⌘ ⇧ ⌥ K', action: '跳转到知识库（管理员）', searchTerms: ['跳转知识库', '打开知识库', '知识库导航'], adminOnly: true },
    ],
  },
  {
    label: '任务列表',
    items: [
      { id: 'task-selection', keys: 'J / K', action: '选择下一个 / 上一个任务', searchTerms: ['选择任务', '上一个任务', '下一个任务', '任务列表移动'] },
      { id: 'task-detail', keys: 'Enter', action: '查看选中任务详情', searchTerms: ['查看任务详情', '打开任务详情', '选中任务'] },
      { id: 'edit-task', keys: 'E', action: '编辑选中任务', searchTerms: ['编辑任务', '修改任务'] },
      { id: 'task-progress', keys: 'P', action: '记录选中任务进展', searchTerms: ['记录选中任务进展', '添加任务进展'] },
      { id: 'accept-task', keys: 'A', action: '验收选中任务', searchTerms: ['验收任务', '任务验收', '去验收'] },
    ],
  },
  {
    label: '月份',
    items: [
      { id: 'month-1-10', keys: '1–9 / 0', action: '跳到今年 1–10 月', searchTerms: ['月份快捷键', '跳转月份', '数字键月份', '1月', '10月'] },
      { id: 'month-11-12', keys: '- / =', action: '跳到今年 11 / 12 月', searchTerms: ['11月', '12月', '11月快捷键', '12月快捷键', '跳转11月', '跳转12月'] },
      { id: 'previous-month', keys: '[', action: '切换到上个月', searchTerms: ['上个月', '切换上月', '前一个月'] },
      { id: 'next-month', keys: ']', action: '切换到下个月', searchTerms: ['下个月', '切换下月', '后一个月'] },
    ],
  },
]

const shortcutCapabilities: ProductCapability[] = productShortcutHelpGroups.flatMap((group) => group.items.map((item) => ({
  id: `shortcut.${item.id}`,
  category: `快捷键 · ${group.label}`,
  title: item.action,
  summary: `快捷键：${item.keys}`,
  details: ['在输入框、文本编辑区或弹窗表单中，单键快捷键会自动停用，避免误触。'],
  searchTerms: [...item.searchTerms, item.action],
  adminOnly: item.adminOnly,
  shortcut: { keys: item.keys, action: item.action },
  answer: item.answer || `${item.action}的快捷键是 **${item.keys}**。`,
})))

const featureCapabilities: ProductCapability[] = [
  {
    id: 'feature.giverny-theme',
    category: '外观',
    title: '吉维尼模式',
    summary: '吉维尼模式是可选的莫奈花园主题，默认关闭，可在外观设置中手动开启并随季节变换色彩。',
    details: [
      '进入“设置 → 外观 → 吉维尼模式”，打开开关即可启用。',
      '季节默认跟随电脑当前日期，也可以手动锁定春、夏、秋或冬。',
      '任务行是否按状态上色由工作台“任务明细”旁的“状态色”开关控制，与吉维尼模式是两个独立设置。',
    ],
    route: '设置 → 外观 → 吉维尼模式',
    searchTerms: ['吉维尼主题', 'giverny主题', 'Giverny主题', '吉维尼模式', '莫奈主题', '花园主题', '季节主题', '怎么开主题', '开启主题', '外观主题'],
    evidenceStatus: 'confirmed',
    sourceLabel: '使用手册 · 外观设置',
  },
  {
    id: 'feature.giverny-name-origin',
    category: '品牌',
    title: 'Giverny 名称与品牌由来',
    summary: 'Giverny 的名字是作者为致敬莫奈而取：莫奈晚年居住在法国小镇吉维尼，网站以“莫奈花园”为主题，并从《睡莲》中提取四季配色。',
    details: [
      '莫奈晚年居住的法国小镇名为 Giverny（吉维尼），这里也是莫奈花园与《睡莲》系列的重要创作背景。',
      '网站的四季配色取自《睡莲》的色彩，整站主题是“莫奈花园”。',
      '品牌理念：一个产品不能仅仅是产品，还应该加入艺术的成分，让创作成为一种乐趣。',
      '品牌 Slogan：让创作在自己的花园里生长。',
    ],
    route: '使用手册 → 品牌故事',
    searchTerms: ['为什么叫Giverny', '为什么叫吉维尼', 'Giverny名字由来', '吉维尼名字由来', '网站名字', '品牌名称', '品牌由来', '命名原因', '作者起名', '为什么取这个名字', '名字含义', '这个名字什么意思'],
    evidenceStatus: 'confirmed',
    sourceLabel: '使用手册 · 品牌故事（作者确认）',
  },
  {
    id: 'feature.recent-releases',
    category: '产品版本',
    title: '最近更新',
    summary: '当前版本是 v0.32.1，最近重点完善了产品知识验真、Agent 编排、执行审计、等待原因读取、语音时间录入和附件可靠性。',
    details: [
      'v0.32.1：产品问题强制查询官方知识；补齐模型设置、最近更新、吉维尼主题和作者确认的品牌故事。',
      'v0.32.0：Agent 支持工具失败重试、证据不足时动态补查并重新生成答案；AI 运行中心新增执行审计。',
      'v0.31.0：统一 AgentTurn、工具权限、确定性验真和工作区签名隔离，主模型保持优先。',
      'v0.30.42：修复“任务卡在哪里”误答快捷键，改为读取真实等待原因和已等待时长。',
      'v0.30.40：语音排期支持“两点半、一刻、三刻”等自然时间表达。',
      'v0.30.39：验收面板打开后可在任意位置直接粘贴图片附件。',
      '完整记录可在“设置 → 产品版本”或 GitHub Releases 查看。',
    ],
    route: '设置 → 产品版本',
    searchTerms: ['最近更新', '最新更新', '更新了哪些', '更新了什么', '最近改了什么', '新功能', '版本更新', '更新内容', '当前版本', '最新版本', 'release notes', 'changelog'],
    evidenceStatus: 'confirmed',
    sourceLabel: 'CHANGELOG · 最近版本',
  },
  {
    id: 'feature.agent-routing',
    category: '工作助手',
    title: '工作助手模型与执行路由',
    summary: '产品说明和确定性数据优先由站内工具处理；复杂推理、本机文件任务和通用问答再交给所选模型或本机 CLI。',
    details: [
      '手动选择云端模型时，该模型优先于设置中的默认模型。',
      '选择“自动 · 本机 CLI”时，网站仍负责身份、权限、D1/R2 数据和写入确认，CLI 只负责推理及受控的本机任务。',
      '站内写入必须先生成预览并由用户确认，CLI 不能绕过网站权限直接写数据库。',
    ],
    route: '工作台 → 工作助手',
    searchTerms: ['工作助手模型', '模型优先级', '走CLI还是模型', '本机CLI', '云端模型', '自动路由', '回退', 'Agent权限'],
  },
  {
    id: 'feature.local-cli',
    category: '工作助手',
    title: '连接本机 CLI',
    summary: '在“设置 → 本机 CLI”配对当前电脑、扫描 CLI、测试状态并选择一个可用 CLI。',
    details: [
      '当前支持 Codex CLI、Claude Code 和 Grok Build 的安全结构化调用；Antigravity 只检测，尚未开放执行。',
      '设备与当前登录账号和浏览器设备键绑定，不会跨租户或跨电脑误用。',
      'CLI 不能直接读取或修改 D1；它只能通过短期只读 MCP 调用经过当前租户和角色权限校验的站内工具，写入仍由网页确认流程执行。',
    ],
    route: '设置 → 本机 CLI',
    searchTerms: ['本机CLI', '连接CLI', '扫描CLI', '测试CLI', 'Codex CLI', 'Claude Code', 'Grok Build', '本机连接器', 'Bridge', 'CLI权限', 'Giverny数据库', '直接修改数据库', '读取数据库', '写数据库'],
  },
  {
    id: 'feature.task-lifecycle',
    category: '任务',
    title: '任务完整生命周期',
    summary: '任务支持新建或补录、编辑需求、记录进展与反馈、分段计时、等待、附件、验收和结算。',
    details: [
      '记录进展代表任务已经进入执行状态；写入类 Agent 操作均需预览确认。',
      '补录任务使用独立结算月份，真实进展与验收日期不会被补录操作日期替代。',
    ],
    route: '工作台 / 任务',
    searchTerms: ['任务怎么用', '任务流程', '新建到验收', '补录', '记录进展', '任务反馈', '分段计时', '等待'],
  },
  {
    id: 'feature.finance-month',
    category: '结算',
    title: '按实际发生月份结算',
    summary: '跨月任务按每段计时实际发生的月份拆分工时和金额，同一任务可以分别进入不同月份的结算与导出。',
    details: ['未验收但已在某月发生的可计费工时仍归入该月；补录任务以结算月份作为归属边界。'],
    route: '结算 / 收入',
    searchTerms: ['跨月任务怎么算', '结算月份', '月份金额', '工资归属', '导出Excel', '计费工时', '可结算金额'],
  },
  {
    id: 'feature.attachments',
    category: '文件',
    title: '任务附件与后台上传',
    summary: '任务进展和验收均可上传附件；保存后上传可在后台继续，文件库统一查看过程文件和验收文件。',
    details: ['大文件上传受站内权限和存储策略控制，附件搜索与下载必须通过受保护的文件地址。'],
    route: '任务详情 / 文件库',
    searchTerms: ['上传附件', '验收附件', '后台上传', '大文件', '文件库', '下载附件', '预览附件'],
  },
  {
    id: 'feature.model-settings',
    category: '设置',
    title: '模型与服务商设置',
    summary: '管理员可以在模型设置中配置供应商 API Key、加载模型并分别指定文字与图片默认模型。',
    details: [
      '进入“设置 → 模型”。先在文字模型服务商或图片识别服务商区域选择 DeepSeek、豆包、通义千问、Kimi 等供应商并点击“配置”。',
      '填写 API Key；Base URL 通常会随供应商自动带出，也可以按官方控制台给出的专属地址修改。点击“加载模型”读取该 Key 可访问的模型列表。',
      '在供应商模型列表中选定默认模型并启用服务商。启用成功的服务商显示绿点，未启用显示灰点且不会进入上方候选。',
      '最后在页面上方分别选择全站“文字模型”和“图片模型”；工作助手中手动选择的模型在当前会话优先，只有极端故障才启动备用链路。',
      '可在供应商配置中点击“测试”核对 Key、Base URL 和模型是否真实可用；不要只以已保存作为可用依据。',
    ],
    route: '设置 → 模型',
    searchTerms: ['模型设置', '怎么设置大模型', '如何设置大模型', '配置大模型', '大模型怎么配置', '怎么接入模型', '服务商配置', 'API Key', 'API密钥', '默认文字模型', '默认图片模型', '加载模型', '获取模型', '启用服务商', '测试模型', '豆包', '通义千问', 'DeepSeek'],
    adminOnly: true,
    evidenceStatus: 'confirmed',
    sourceLabel: '使用手册 · AI 模型设置',
  },
  {
    id: 'feature.ai-hours',
    category: 'AI 工时',
    title: 'AI 工时建议',
    summary: 'AI 根据复杂度画像、分层历史样本和可解释工时模块给出建议，并以真实验收投入持续校准。',
    details: [
      '建议会拆分基础设计、交互增量、多尺寸适配、改稿等模块。',
      '样本达到门槛后会加入需求人、客户完整度和平均改稿轮次等校准系数。',
    ],
    route: '新建 / 编辑任务 → AI 工时建议',
    searchTerms: ['AI工时', '工时建议', '预计工时', '历史样本', '复杂度画像', '需求人系数', '工时学习'],
  },
  {
    id: 'feature.command-agent',
    category: '工作助手',
    title: '命令式任务操作',
    summary: '工作助手可以连续完成创建、字段或状态修改、记录反馈、进展、等待、验收文件和完整验收。',
    details: ['每次站内写入都必须单独生成确认卡并由用户确认；整任务删除、付款和部署等高风险操作不开放。'],
    route: '工作台 → 工作助手',
    searchTerms: ['命令操作网站', 'Agent执行任务', '创建到验收', '自动操作', '确认卡', '网站权限'],
  },
  {
    id: 'feature.permissions',
    category: '权限',
    title: '角色和数据权限',
    summary: '管理员、成员、合作伙伴和公开只读访问使用不同的数据与操作边界，Agent 工具沿用同一身份和工作区权限。',
    details: ['本机 CLI 不直接获得 D1 凭证，只能通过短期、只读、受租户约束的 MCP 工具读取允许的数据。'],
    route: '设置 → 登录与权限',
    searchTerms: ['权限', '管理员', '成员', '合作伙伴', '只读', '多租户', '数据库权限', 'MCP权限'],
    adminOnly: true,
  },
]

export const productCapabilities: ProductCapability[] = [...shortcutCapabilities, ...featureCapabilities]

function normalizeProductHelpText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s`~!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?，。！？；：“”‘’、（）【】《》]+/g, '')
}

function capabilityScore(capability: ProductCapability, query: string) {
  const normalizedQuery = normalizeProductHelpText(query)
  if (!normalizedQuery) return 0
  const title = normalizeProductHelpText(capability.title)
  const summary = normalizeProductHelpText(capability.summary)
  let score = 0
  if (normalizedQuery === title) score += 120
  if (normalizedQuery.includes(title) || title.includes(normalizedQuery)) score += 40
  if (normalizedQuery.includes(normalizeProductHelpText(capability.id))) score += 12
  for (const term of capability.searchTerms) {
    const normalizedTerm = normalizeProductHelpText(term)
    if (!normalizedTerm) continue
    if (normalizedQuery === normalizedTerm) score += 60
    else if (normalizedQuery.includes(normalizedTerm)) score += 24
    else if (normalizedTerm.length >= 4 && normalizedTerm.includes(normalizedQuery)) score += 12
  }
  if (summary.includes(normalizedQuery) && normalizedQuery.length >= 4) score += 18
  if (capability.shortcut && /快捷键|按键|键盘|怎么按/.test(query)) score += 24
  return score
}

function capabilityAnswer(capability: ProductCapability) {
  if (capability.answer) return capability.answer
  const parts = [`**${capability.title}**：${capability.summary}`]
  if (capability.evidenceStatus === 'partial') parts.push('资料状态：**部分确认**。以下内容会区分已记录事实与尚未记录的信息。')
  if (capability.route) parts.push(`入口：${capability.route}。`)
  if (capability.details?.length) parts.push(capability.details.map((item) => `- ${item}`).join('\n'))
  if (capability.sourceLabel) parts.push(`依据：${capability.sourceLabel}。`)
  return parts.join('\n\n')
}

export function searchProductHelp(query: string, limit = 5) {
  const matches = productCapabilities
    .map((capability) => ({ capability, score: capabilityScore(capability, query) }))
    .filter((item) => item.score >= 18)
    .sort((left, right) => right.score - left.score || left.capability.title.localeCompare(right.capability.title, 'zh-CN'))
    .slice(0, Math.max(1, Math.min(10, limit)))
    .map(({ capability, score }): ProductHelpMatch => ({
      id: capability.id,
      category: capability.category,
      title: capability.title,
      summary: capability.summary,
      details: capability.details,
      route: capability.route,
      adminOnly: capability.adminOnly,
      shortcut: capability.shortcut,
      evidenceStatus: capability.evidenceStatus,
      sourceLabel: capability.sourceLabel,
      answer: capabilityAnswer(capability),
      score,
    }))
  return { query, total: matches.length, matches }
}
