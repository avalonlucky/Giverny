import { designTypeColorForIndex, validDesignTypeColor } from '../lib/designTypes'
import { defaultDesignTypeGroups, type DesignTypeGroup } from '../config/appConfig'

function normalizeGroups(groups: DesignTypeGroup[]) {
  const normalized = groups
    .map((group, index) => ({
      name: group.name.trim(),
      color: validDesignTypeColor(group.color) || designTypeColorForIndex(index),
      items: [...new Set(group.items.map((item) => item.trim()).filter(Boolean))],
    }))
    .filter((group) => group.name)
  return normalized.length > 0 ? normalized : defaultDesignTypeGroups
}

export function NewTaskDesignTypeSelector({
  groups,
  value,
  onChange,
}: {
  groups: DesignTypeGroup[]
  value: string
  onChange: (value: string) => void
}) {
  const availableGroups = normalizeGroups(groups).filter((group) => group.items.length > 0)
  const selectedGroup = availableGroups.find((group) => group.items.some((item) => `${group.name} / ${item}` === value))
  return (
    <div className="new-task-type-selector">
      <div className="new-task-type-chips" role="listbox" aria-label="设计类型">
        {availableGroups.map((group) => <div className={`new-task-type-category ${group.name === selectedGroup?.name ? 'active' : ''}`} key={group.name} tabIndex={0}>
          <span>{group.name}</span>
          <div className="new-task-type-menu" role="group" aria-label={`${group.name} 子分类`}>
            {group.items.map((item) => {
              const optionValue = `${group.name} / ${item}`
              return <button type="button" className={optionValue === value ? 'active' : ''} key={item} aria-selected={optionValue === value} onClick={() => onChange(optionValue)}>{item}</button>
            })}
          </div>
        </div>)}
      </div>
      <div className="new-task-type-picked">已选 <b>{value || '未选择'}</b></div>
    </div>
  )
}
