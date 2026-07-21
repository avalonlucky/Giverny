import { z } from 'zod'

export const agentReadToolRegistry = {
  query_month_finance: {
    title: '查询月份财务',
    description: '查询真实的月份收入、工时、计费与结算统计。',
    endpoint: 'month-finance',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['finance:read'] },
    inputSchema: z.object({
      question: z.string(),
      currentMonth: z.string().optional(),
      months: z.string().optional(),
    }),
  },
  search_tasks: {
    title: '搜索任务',
    description: '按月份、状态意图、任务名、需求或人员搜索任务。月份问题必须传 month。',
    endpoint: 'search-tasks',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'] },
    inputSchema: z.object({
      query: z.string(),
      month: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(30),
    }),
  },
  get_task_detail: {
    title: '读取任务详情',
    description: '按任务 ID 或近似标题读取任务详情、进展、附件与验收信息。',
    endpoint: 'task-detail',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'] },
    inputSchema: z.object({
      taskId: z.number().int().positive().optional(),
      title: z.string().optional(),
    }),
  },
  get_requester_profile: {
    title: '读取需求人画像',
    description: '按需求人姓名读取当前工作区的全部历史任务，并确定性计算项目数、工时、验收率、准时率、工时偏差、改稿、等待和反馈特征。用户要求某人的用户画像、需求人画像或合作特征时必须调用。',
    endpoint: 'requester-profile',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['tasks:read'] },
    inputSchema: z.object({
      name: z.string().min(1).max(80),
    }),
  },
  search_attachments: {
    title: '搜索任务附件',
    description: '按任务语义、任务名和文件名搜索真实附件。用户要求查看、预览、打开或下载附件时必须优先调用。',
    endpoint: 'search-attachments',
    policy: { risk: 'read', deterministic: true, source: 'd1', scopes: ['attachments:read'] },
    inputSchema: z.object({
      query: z.string(),
      month: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(30),
    }),
  },
  get_giverny_context: {
    title: '读取工作台能力',
    description: '读取当前 Giverny 工作台概览和能力边界。',
    endpoint: 'context',
    policy: { risk: 'read', deterministic: true, source: 'product_registry', scopes: ['product:read'] },
    inputSchema: z.object({}),
  },
  search_product_help: {
    title: '查询产品使用说明',
    description: '查询 Giverny 的快捷键、功能入口、操作流程、模型设置、版本更新、品牌说明、模型路由、权限边界和产品规则。网站怎么用、产品是什么或为何这样设计的问题必须优先调用。',
    endpoint: 'product-help',
    policy: { risk: 'read', deterministic: true, source: 'product_registry', scopes: ['product:read'] },
    inputSchema: z.object({
      query: z.string().min(1).max(500),
      limit: z.number().int().min(1).max(10).default(5),
    }),
  },
} as const

export type AgentReadToolName = keyof typeof agentReadToolRegistry
