export function splitFileName(value: string) {
  const trimmed = value.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return { base: trimmed, extension: '' }
  }
  return { base: trimmed.slice(0, dotIndex), extension: trimmed.slice(dotIndex) }
}
