import type { CSSProperties } from 'react'

import { EmptyState } from './EmptyState'

export type DonutChartItem = {
  label: string
  value: number
  color: string
}

type DonutChartProps = {
  items: DonutChartItem[]
  total: number
}

export function DonutChart({ items, total }: DonutChartProps) {
  if (total <= 0) {
    return (
      <EmptyState
        title="暂无工时数据"
        description="记录任务工时后，这里会按设计类型自动汇总。"
      />
    )
  }

  const gradient = items
    .reduce(
      (result, item) => {
        const start = result.cursor
        const end = start + (item.value / total) * 100

        return {
          cursor: end,
          segments: [...result.segments, `${item.color} ${start}% ${end}%`],
        }
      },
      { cursor: 0, segments: [] as string[] },
    )
    .segments.join(', ')

  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ '--donut-gradient': gradient } as CSSProperties}>
        <div>
          <strong>{total.toFixed(1)}h</strong>
          <span>总计</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item) => {
          const percent = Math.round((item.value / total) * 100)
          return (
            <div className="legend-row" key={item.label}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>
                {item.value.toFixed(1)}h ({percent}%)
              </strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}
