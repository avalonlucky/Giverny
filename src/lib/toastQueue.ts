export type ToastTone = 'success' | 'error' | 'info'

export type ToastState = {
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

export const trimToastQueue = (items: ToastState[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => toastTonePriority(b.item.tone) - toastTonePriority(a.item.tone) || b.item.id - a.item.id)
    .slice(0, MAX_VISIBLE_TOASTS)
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item)

export const inferToastTone = (message: string): ToastTone => {
  if (/(失败|异常|不正确|失效|错误|不可用|无效)/.test(message)) return 'error'
  if (/(正在|上传中|加载)/.test(message)) return 'info'
  return 'success'
}
