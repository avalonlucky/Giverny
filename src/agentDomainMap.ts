import type { AppView } from './types/domain'
// 带扩展名是为了 scripts/check-agent-domain-map.mjs 能直接 import 本模块跑守卫；
// Node 的 TS 剥离不做扩展名补全，tsconfig 已开 allowImportingTsExtensions。
import { agentCapabilityRegistry, type AgentCapabilityName } from './agentToolRegistry.ts'

/**
 * 站内业务领域地图。
 *
 * 存在的理由：Agent 之前只有"具名对象解析 + 模糊搜索"一条路。用户说「结算回单」时，
 * 它把这个**一等业务概念**当成一个不认识的对象名，拿任务/刊物解析器去搜任务标题，
 * 搜不到就绕远路。而「结算」是站内七大导航之一——这不是要搜的东西，是要知道的东西。
 *
 * 这份地图回答三个问题：站内有哪些业务领域、每个领域的对象和字段叫什么、
 * 该领域的问题应该直接用哪个工具回答。它在编排最前面注入给对象判断阶段。
 *
 * 三道防漂移约束，全部由类型系统或 scripts/check-agent-domain-map.mjs 强制：
 * 1. Record<AppView, …> —— 新增一个导航而不描述它，TypeScript 直接编译失败。
 * 2. operations 取 AgentCapabilityName —— 工具改名或删除，编译失败。
 * 3. fields 的 key 回源核对 —— 字段在源码里改了名，guard 失败。
 * 工具的标题与说明一律从注册表现取，不在这里重抄，避免两份文案各自漂移。
 */

export type AgentDomainField = {
  /** 工具返回值或类型定义里的真实字段名，guard 会回源核对。 */
  key: string
  /** 站内界面上的中文叫法，用户就是用这个词提问的。 */
  label: string
}

export type AgentDomainObject = {
  name: string
  /** 字段定义所在的源码位置，guard 据此逐个 key 回源。 */
  source: { file: string; symbol: string }
  fields: readonly AgentDomainField[]
}

export type AgentDomainDefinition = {
  /** 这个领域在站内是什么，一句话。 */
  summary: string
  /** 用户可能用来指代这个领域的说法。命中即可直接定域，不必先去搜任务标题。 */
  aliases: readonly string[]
  objects: readonly AgentDomainObject[]
  /** 回答该领域问题应当直接调用的只读工具，按优先级排列。 */
  operations: readonly AgentCapabilityName[]
  specialist: 'workspace_analyst' | 'product_support'
  /**
   * 站内有这块业务，但 Agent 没有对应读取工具时写明。
   * 知道"读不到"和知道"读得到"同等重要：否则它会一直换关键词搜，或者干脆编一个。
   */
  unreadable?: string
}

const taskSource = { file: 'src/types/domain.ts', symbol: 'Task' } as const
const fileSource = { file: 'src/types/domain.ts', symbol: 'FileAsset' } as const

export const agentDomainMap: Record<AppView, AgentDomainDefinition> = {
  工作台: {
    summary: '当月工作总览：本月任务、待验收数量、工时与收入汇总、今日日程和需要主动处理的事项。它是聚合视图，数据来自任务、结算与日程本身。',
    aliases: ['工作台', '首页', '主页', '概览', '总览', '仪表盘', '本月概况', '今天要做什么', '待办'],
    objects: [],
    operations: ['query_task_portfolio', 'query_month_finance', 'query_agenda', 'query_proactive_work'],
    specialist: 'workspace_analyst',
  },
  任务: {
    summary: '工作区的一等业务对象。一条任务贯穿计划、进展记录、等待、改稿、交付与验收全过程，工时和金额都由它派生。',
    aliases: [
      '任务', '项目', '工单', '需求', '活儿', '排期', '进度', '进展', '交付', '验收',
      '改稿', '修改意见', '等待', '挂起', '需求人', '对接人', '审核人', '工时', '设计类型',
    ],
    objects: [
      {
        name: '任务',
        source: taskSource,
        fields: [
          { key: 'id', label: '任务编号' },
          { key: 'title', label: '任务名称' },
          { key: 'type', label: '设计类型' },
          { key: 'requirement', label: '需求描述' },
          { key: 'requester', label: '需求人' },
          { key: 'contact', label: '对接人' },
          { key: 'reviewer', label: '审核人' },
          { key: 'status', label: '状态（计划中/进行中/挂起/待验收/已验收/终止/不计费）' },
          { key: 'progress', label: '完成度' },
          { key: 'date', label: '开始日期' },
          { key: 'estimatedDate', label: '预计交付日期' },
          { key: 'actualDeliveryDate', label: '实际交付日期' },
          { key: 'estimatedHours', label: '预估工时' },
          { key: 'actualHours', label: '实际工时' },
          { key: 'billable', label: '是否计费' },
          { key: 'settlementMonth', label: '结算月份' },
          { key: 'isSupplemental', label: '是否补录' },
          { key: 'suspendReason', label: '挂起原因' },
          { key: 'terminateReason', label: '终止原因' },
          { key: 'acceptanceNote', label: '验收说明' },
          { key: 'feedbackRating', label: '合作评价' },
          { key: 'feedbackTags', label: '合作问题标签' },
        ],
      },
      {
        name: '工时记录',
        source: { file: 'src/types/domain.ts', symbol: 'TimeEntry' },
        fields: [
          { key: 'date', label: '记录日期' },
          { key: 'start', label: '开始时间' },
          { key: 'end', label: '结束时间' },
          { key: 'note', label: '进展说明' },
          { key: 'isRevision', label: '是否改稿轮次' },
          { key: 'isUncounted', label: '是否不计工时' },
          { key: 'isClientFeedback', label: '是否合作伙伴反馈节点' },
          { key: 'feedbackVersion', label: '反馈版本号' },
        ],
      },
      {
        name: '等待记录',
        source: { file: 'src/types/domain.ts', symbol: 'WaitingEntry' },
        fields: [{ key: 'reason', label: '等待原因（等待合作伙伴意见/等待补充资料/等待排期/其他）' }],
      },
    ],
    operations: [
      'search_tasks', 'query_task_portfolio', 'get_task_detail', 'get_requester_profile',
      'resolve_workspace_subject', 'query_project_execution', 'query_plan_continuation', 'check_schedule_conflicts',
    ],
    specialist: 'workspace_analyst',
  },
  文件库: {
    summary: '任务附件的集中入口：进展文件与验收文件、合作伙伴可见性、终稿标记，以及每个附件的多模态分析结论。',
    aliases: ['文件库', '文件', '附件', '素材', '稿件', '终稿', '验收文件', '上传', '下载', '预览', '截图', '源文件'],
    objects: [
      {
        name: '附件',
        source: fileSource,
        fields: [
          { key: 'id', label: '附件编号' },
          { key: 'name', label: '文件名' },
          { key: 'taskId', label: '所属任务编号' },
          { key: 'scope', label: '范围（progress 进展 / acceptance 验收）' },
          { key: 'type', label: '文件类型' },
          { key: 'size', label: '文件大小' },
          { key: 'uploadedAt', label: '上传时间' },
          { key: 'final', label: '是否终稿' },
          { key: 'visible', label: '合作伙伴是否可见' },
          { key: 'tag', label: '标签' },
        ],
      },
      {
        name: '附件分析',
        source: { file: 'src/types/domain.ts', symbol: 'AttachmentAnalysis' },
        fields: [
          { key: 'status', label: '分析状态' },
          { key: 'summary', label: '内容摘要' },
          { key: 'findings', label: '关键发现' },
          { key: 'qualityIssues', label: '质量问题' },
          { key: 'requirementMatches', label: '需求匹配' },
          { key: 'extractedText', label: '提取文本' },
        ],
      },
    ],
    operations: ['search_attachments', 'inspect_attachment_evidence', 'query_attachment_analysis'],
    specialist: 'workspace_analyst',
  },
  洞察: {
    summary: '按日/周/月/季度对工作数据做异常诊断，给出信号、证据和建议，并跟踪每条洞察是新增、持续还是已改善。',
    aliases: ['洞察', '诊断', '异常', '趋势', '复盘', '效率分析', '定价分析', '改善建议'],
    objects: [
      {
        name: '洞察诊断',
        source: { file: 'src/types/domain.ts', symbol: 'InsightDiagnosis' },
        fields: [
          { key: 'periodType', label: '周期类型' },
          { key: 'status', label: '诊断结果（anomalies 有异常 / clear 正常）' },
          { key: 'signal', label: '异常信号' },
          { key: 'evidence', label: '支撑证据' },
          { key: 'action', label: '建议动作' },
          { key: 'state', label: '状态（new 新增 / persisting 持续 / improved 已改善）' },
        ],
      },
    ],
    operations: ['audit_workspace_consistency', 'query_formal_deliverables', 'query_month_finance', 'query_task_portfolio'],
    specialist: 'workspace_analyst',
    unreadable: '洞察页面自己生成的诊断记录没有对应的 Agent 读取工具。被问到具体某条洞察时，要如实说明只能用一致性审计、正式交付物和任务/财务原始数据重新推算，不要假装读到了洞察页面的结论。',
  },
  结算: {
    summary: '按日期范围把已计费工时冻结成结算回单快照，附 Excel、PDF 和对外分享链接。回单一旦锁定就不可改，是对账的权威依据。',
    aliases: [
      '结算', '结算回单', '回单', '对账', '对账单', '结算单', '导出记录', '结算导出',
      '快照', '锁定', '分享链接', '有效期', 'Excel 导出', '结算范围', '结算核对',
    ],
    objects: [
      {
        name: '结算回单',
        source: { file: 'src/worker.ts', symbol: 'toSettlementExportRecord' },
        fields: [
          { key: 'id', label: '回单编号' },
          { key: 'label', label: '结算区间' },
          { key: 'startDate', label: '起始日期' },
          { key: 'endDate', label: '截止日期' },
          { key: 'exportedAt', label: '导出时间' },
          { key: 'taskCount', label: '任务数' },
          { key: 'billableHours', label: '计费工时' },
          { key: 'amount', label: '结算金额' },
          { key: 'locked', label: '是否已锁定' },
          { key: 'expiresAt', label: '分享链接有效期' },
          { key: 'disabled', label: '分享链接是否停用' },
          { key: 'viewCount', label: '被查看次数' },
          { key: 'viewedAt', label: '最近查看时间' },
        ],
      },
    ],
    operations: ['query_settlement_exports', 'reconcile_settlement_export'],
    specialist: 'workspace_analyst',
  },
  收入: {
    summary: '按月与按年汇总计费工时和收入，支持锁定月份、税前税后换算和逐日收入明细。',
    aliases: ['收入', '月收入', '年收入', '营收', '收益', '进账', '到手', '税前', '税后', '计费工时', '收入明细', '收入统计'],
    objects: [
      {
        name: '月度收入',
        source: { file: 'src/types/domain.ts', symbol: 'AnnualIncomeRow' },
        fields: [
          { key: 'month', label: '月份' },
          { key: 'hours', label: '计费工时' },
          { key: 'amount', label: '收入金额' },
          { key: 'locked', label: '该月是否已锁定' },
        ],
      },
    ],
    operations: ['query_month_finance'],
    specialist: 'workspace_analyst',
  },
  知识库: {
    summary: '管理员自己维护的知识笔记，以及每日推送的 AI 知识条目。它与任务、结算这些业务数据无关。',
    aliases: ['知识库', '知识笔记', '笔记', '每日知识', '收藏'],
    objects: [],
    operations: ['search_workspace', 'query_enterprise_memory'],
    specialist: 'workspace_analyst',
    unreadable: '知识库页面的笔记没有专用读取工具，只有全域统一搜索会覆盖到一部分。注意区分：跨会话沉淀的组织规则、合作偏好和项目历史属于「企业记忆」，不在这个页面里。',
  },
  设置: {
    summary: 'Giverny 自身的配置：外观与主题、模型路由与服务商、权限与角色、通知，以及高风险操作的确认与留痕规则。',
    aliases: ['设置', '配置', '偏好', '外观', '主题', '吉维尼模式', '模型', '模型路由', '服务商', '权限', '角色', '快捷键', '版本', '更新日志'],
    objects: [],
    operations: ['search_product_help', 'get_giverny_context', 'query_high_risk_actions'],
    specialist: 'product_support',
  },
}

/**
 * 不归属任何导航领域的只读工具，逐个写明理由。
 *
 * 这份名单存在的意义不是放行，而是强制解释：新增一个读工具却没有任何领域认领它时，
 * guard 会失败，作者必须要么把它归到一个领域，要么在这里说明为什么它不属于任何领域。
 * 没有这道题，地图会随着工具增加悄悄变得不完整。
 */
export const agentUndomainedOperations: Readonly<Record<string, string>> = {
  search_web: '站外信息，与站内业务领域无关，由联网检索专家独立使用。',
  get_task_memory: '单个任务的长期记忆，是任务域的内部实现，不作为用户可见的领域入口。',
  inspect_ai_settings: '模型设置的内部只读探针，走设置域的产品支持路径，不单独暴露成领域工具。',
  test_ai_route: '模型路由连通性测试，属于运维动作而不是业务查询。',
  diagnose_ai_routing: '模型主备链路诊断，属于运维动作而不是业务查询。',
}

/**
 * 注入给 Agent Runtime 的领域清单，随 OpenAPI 一起下发。
 * 工具文案现取自注册表：注册表改了描述，Agent 看到的就是新描述，不存在第二份副本。
 */
export function agentDomainManifest() {
  return (Object.entries(agentDomainMap) as [AppView, AgentDomainDefinition][]).map(([domain, definition]) => ({
    domain,
    summary: definition.summary,
    aliases: [...definition.aliases],
    specialist: definition.specialist,
    unreadable: definition.unreadable || '',
    objects: definition.objects.map((object) => ({
      name: object.name,
      fields: object.fields.map((field) => `${field.label}（${field.key}）`),
    })),
    operations: definition.operations.map((name) => ({
      operation: name,
      title: agentCapabilityRegistry[name].title,
      description: agentCapabilityRegistry[name].description,
    })),
  }))
}
