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
  get_giverny_context: {
    title: '读取工作台能力',
    description: '读取当前 Giverny 工作台概览和能力边界。',
    endpoint: 'context',
    inputSchema: z.object({}),
  },
} as const

export type AgentReadToolName = keyof typeof agentReadToolRegistry
