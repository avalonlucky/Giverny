export function parseFileTags(tag: string | undefined) {
  return (tag ?? '')
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function serializeFileTags(tags: string[]) {
  return Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean))).join('、')
}
