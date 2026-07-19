import { z } from 'zod'

export const agentReadToolRegistry = {
  query_month_finance: {
    title: '查询月份财务',
    description: '查询真实的月份收入、工时、计费与结算统计。',
    endpoint: 'month-finance',
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
    inputSchema: z.object({
      taskId: z.number().int().positive().optional(),
      title: z.string().optional(),
    }),
  },
  search_attachments: {
    title: '搜索任务附件',
    description: '按任务语义、任务名和文件名搜索真实附件。用户要求查看、预览、打开或下载附件时必须优先调用。',
    endpoint: 'search-attachments',
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
    inputSchema: z.object({}),
  },
  search_product_help: {
    title: '查询产品使用说明',
    description: '查询 Giverny 的快捷键、功能入口、操作流程、模型路由、权限边界和产品规则。网站怎么用的问题必须优先调用。',
    endpoint: 'product-help',
    inputSchema: z.object({
      query: z.string().min(1).max(500),
      limit: z.number().int().min(1).max(10).default(5),
    }),
  },
} as const

export type AgentReadToolName = keyof typeof agentReadToolRegistry
