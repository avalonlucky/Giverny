export function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, minutes)
  const hours = Math.floor(safeMinutes / 60)
  const restMinutes = safeMinutes % 60
  if (hours === 0) return `${restMinutes} min`
  if (restMinutes === 0) return `${hours} h`
  return `${hours} h ${restMinutes} min`
}
