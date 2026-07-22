import { EmptyState } from './EmptyState'

export type TrendChartDatum = {
  label: string
  value: number
}

type TrendChartPoint = TrendChartDatum & {
  x: number
  y: number
}

type TrendChartProps = {
  data: TrendChartDatum[]
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        className="trend-empty"
        title="暂无趋势数据"
        description="记录任务工时后，这里会按天显示本月投入变化。"
      />
    )
  }

  const width = 560
  const height = 230
  const padding = { top: 24, right: 24, bottom: 36, left: 38 }
  const maxValue = Math.max(4, Math.ceil(Math.max(...data.map((item) => item.value)) / 4) * 4)
  const ticks = [0, maxValue / 4, maxValue / 2, (maxValue / 4) * 3, maxValue]
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const points = data.map((item, index) => {
    const x = data.length === 1 ? padding.left + innerWidth / 2 : padding.left + (innerWidth / (data.length - 1)) * index
    const y = padding.top + innerHeight - (item.value / maxValue) * innerHeight
    return { ...item, x, y }
  })
  // 数据点较多时（按天 = 30 天）：平滑曲线、稀疏坐标标签、只在峰值标注数值，避免拥挤
  const dense = points.length > 12
  const linePath = dense ? smoothLinePath(points) : points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`
  const labelStep = Math.max(1, Math.ceil(points.length / 7))
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0])

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="本月每天工时趋势">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2f8f89" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2f8f89" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / maxValue) * innerHeight
          return (
            <g key={tick}>
              <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="axis-label y-label" x={10} y={y + 5}>
                {tick}
              </text>
            </g>
          )
        })}
        <path className="trend-area" d={areaPath} />
        <path className="trend-line" d={linePath} />
        {dense
          ? (
            <>
              {peak.value > 0 && (
                <g>
                  <circle className="trend-point" cx={peak.x} cy={peak.y} r="4.5" />
                  <text className="point-label" x={peak.x} y={peak.y - 12}>
                    {peak.value.toFixed(1)}
                  </text>
                </g>
              )}
              {points.map((point, index) =>
                index % labelStep === 0 || index === points.length - 1 ? (
                  <text key={point.label} className="axis-label x-label" x={point.x} y={height - 9}>
                    {point.label}
                  </text>
                ) : null,
              )}
            </>
          )
          : points.map((point) => (
            <g key={point.label}>
              <circle className="trend-point" cx={point.x} cy={point.y} r="5.5" />
              <text className="point-label" x={point.x} y={point.y - 14}>
                {point.value.toFixed(1)}
              </text>
              <text className="axis-label x-label" x={point.x} y={height - 9}>
                {point.label}
              </text>
            </g>
          ))}
      </svg>
    </div>
  )
}

// Catmull-Rom 转三次贝塞尔，得到平滑曲线
function smoothLinePath(points: TrendChartPoint[]) {
  if (points.length < 2) {
    return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : ''
  }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return path
}
