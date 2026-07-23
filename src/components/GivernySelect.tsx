import { type ReactNode, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'

export type GivernySelectOption = {
  value: string
  label: string
  group?: string
  icon?: ReactNode
}

type GivernySelectProps = {
  value: string
  options: GivernySelectOption[]
  placeholder: string
  ariaLabel: string
  onChange: (value: string) => void
}

export function GivernySelect({ value, options, placeholder, ariaLabel, onChange }: GivernySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const groups = Array.from(new Set(options.map((option) => option.group || '')))

  return (
    <div
      className="giverny-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <button
        type="button"
        className={`giverny-select-trigger ${isOpen ? 'active' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={options.length === 0}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={`giverny-select-value ${selected ? '' : 'placeholder'}`}>
          {selected?.icon}
          <span>{selected?.label || placeholder}</span>
        </span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="giverny-select-menu" role="listbox" aria-label={ariaLabel}>
          {groups.map((group) => (
            <div className="giverny-select-group" key={group || 'default'}>
              {group && <span className="giverny-select-group-label">{group}</span>}
              {options.filter((option) => (option.group || '') === group).map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? 'active' : ''}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                >
                  <span className="giverny-select-option-main">
                    {option.icon}
                    <span>{option.label}</span>
                  </span>
                  {option.value === value && <CheckCircle2 size={15} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
