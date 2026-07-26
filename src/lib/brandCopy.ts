import type { TaskStatus } from '../types/domain'

export const givernyCopy = {
  emptyTasksTitle: '花园很安静',
  emptyTasksDescription: '等待一项新的创作在这里生长。',
  emptyProgressTitle: '等待新的色彩落入花园',
  emptyProgressDescription: '记录一次进展，让这项创作继续向前生长。',
  assistantWelcomeTitle: '嗨，来和爱丽丝聊一聊',
  assistantWelcomeDescription: '一起整理这座创作花园，让任务、进展与交付各自留下清晰的痕迹。',
  completedTitle: '这幅作品已经完成',
  completedDescription: '它曾经在这里生长，也终于在这里绽放。',
} as const

const taskStatusCopy: Record<TaskStatus, string> = {
  计划中: '等待新的色彩落入花园',
  进行中: '新的色彩正在水面上展开',
  挂起: '水面暂时安静，等待下一阵风',
  待验收: '作品已经呈现，等待最后的注视',
  已验收: '这一笔已经落定，花园里留下了新的风景',
  终止: '这项创作已经停在此处',
  不计费: '这段创作仍被花园好好记录',
}

export function givernyTaskStatusCopy(status: TaskStatus) {
  return taskStatusCopy[status]
}
