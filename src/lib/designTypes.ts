import { designTypeColorPalette, type DesignTypeGroup } from '../config/appConfig'

export const validDesignTypeColor = (value: unknown) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : ''
)

export const designTypeColorForIndex = (index: number) => designTypeColorPalette[index % designTypeColorPalette.length] ?? '#e9f5ea'

export function nextUnusedDesignTypeColor(groups: DesignTypeGroup[]) {
  const used = new Set(groups.map((group) => validDesignTypeColor(group.color)).filter(Boolean))
  return designTypeColorPalette.find((color) => !used.has(color.toLowerCase())) ?? designTypeColorForIndex(groups.length)
}
