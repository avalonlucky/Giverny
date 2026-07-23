import { defaultDesignTypeGroups, type DesignTypeGroup } from '../config/appConfig'
import { designTypeColorForIndex, validDesignTypeColor } from './designTypes'

export const flattenDesignTypeGroups = (groups: DesignTypeGroup[]) => groups.flatMap((group) => group.items.map((item) => `${group.name} / ${item}`))

export const normalizeDesignTypeGroups = (groups: DesignTypeGroup[]) => {
  const normalized = groups
    .map((group, index) => ({
      name: group.name.trim(),
      color: validDesignTypeColor(group.color) || designTypeColorForIndex(index),
      items: [...new Set(group.items.map((item) => item.trim()).filter(Boolean))],
    }))
    .filter((group) => group.name)
  return normalized.length > 0 ? normalized : defaultDesignTypeGroups
}
