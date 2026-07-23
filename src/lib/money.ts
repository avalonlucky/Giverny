// Amounts retain cent precision. This only removes floating-point noise and never rounds to whole yuan.
export function roundCents(value: number) {
  return Math.round(value * 100) / 100
}

export function formatYuan(value: number) {
  return roundCents(value).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
