import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, CheckCircle2, Clock3 } from 'lucide-react'
import { StatCard } from '../components/TaskUi'
import { formatYuan } from '../lib/money'
import { monthLabelOf } from '../lib/month'
import type { AnnualIncomeRow, IncomeDailyGroup, TaxMode } from '../types/domain'

const cumulativeTaxBrackets = [
  { limit: 36000, rate: 0.03, quick: 0 },
  { limit: 144000, rate: 0.1, quick: 2520 },
  { limit: 300000, rate: 0.2, quick: 16920 },
  { limit: 420000, rate: 0.25, quick: 31920 },
  { limit: 660000, rate: 0.3, quick: 52920 },
  { limit: 960000, rate: 0.35, quick: 85920 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quick: 181920 },
]

const laborTaxBrackets = [
  { limit: 20000, rate: 0.2, quick: 0 },
  { limit: 50000, rate: 0.3, quick: 2000 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.4, quick: 7000 },
]


function resolveCumulativeTaxBracket(taxableIncome: number) {
  return cumulativeTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? cumulativeTaxBrackets[0]
}

function resolveLaborTaxBracket(taxableIncome: number) {
  return laborTaxBrackets.find((bracket) => taxableIncome <= bracket.limit) ?? laborTaxBrackets[0]
}

function calculateCumulativeWithholding(
  rows: AnnualIncomeRow[],
  monthlySpecialDeduction: number,
  monthlyAdditionalDeduction: number,
  monthlyOtherDeduction: number,
) {
  let cumulativeIncome = 0
  let cumulativePaidTax = 0
  const monthlyDeduction = 5000 + monthlySpecialDeduction + monthlyAdditionalDeduction + monthlyOtherDeduction

  return rows.map((row, index) => {
    cumulativeIncome += row.amount
    const cumulativeDeduction = monthlyDeduction * (index + 1)
    const taxableIncome = Math.max(0, cumulativeIncome - cumulativeDeduction)
    const bracket = resolveCumulativeTaxBracket(taxableIncome)
    const cumulativeTax = Math.max(0, taxableIncome * bracket.rate - bracket.quick)
    const tax = Math.max(0, Math.round(cumulativeTax - cumulativePaidTax))
    cumulativePaidTax += tax

    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax: Math.round(cumulativePaidTax),
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
}

function calculateLaborWithholding(rows: AnnualIncomeRow[]) {
  let cumulativeIncome = 0
  let cumulativeTax = 0
  return rows.map((row) => {
    cumulativeIncome += row.amount
    const taxableIncome = row.amount <= 800 ? 0 : row.amount <= 4000 ? Math.max(0, row.amount - 800) : row.amount * 0.8
    const bracket = resolveLaborTaxBracket(taxableIncome)
    const tax = Math.max(0, Math.round(taxableIncome * bracket.rate - bracket.quick))
    cumulativeTax += tax
    return {
      ...row,
      taxableIncome,
      tax,
      netIncome: Math.max(0, row.amount - tax),
      cumulativeIncome,
      cumulativeTax,
      rate: bracket.rate,
      quick: bracket.quick,
    }
  })
}


export default function IncomeView({
  annualData,
  currentMonth,
  taxMode,
  onMonthChange,
  dailyGroups,
  today,
}: {
  annualData: {
    year: string
    rows: AnnualIncomeRow[]
    totalHours: number
    totalAmount: number
  }
  currentMonth: { label: string; value: string }
  taxMode: TaxMode
  onMonthChange: (month: string) => void
  dailyGroups: IncomeDailyGroup[]
  today: string
}) {
  const [monthlySpecialDeduction, setMonthlySpecialDeduction] = useState(0)
  const [monthlyAdditionalDeduction, setMonthlyAdditionalDeduction] = useState(0)
  const [monthlyOtherDeduction, setMonthlyOtherDeduction] = useState(0)
  const taxRows = useMemo(
    () =>
      taxMode === 'labor'
        ? calculateLaborWithholding(annualData.rows)
        : calculateCumulativeWithholding(annualData.rows, monthlySpecialDeduction, monthlyAdditionalDeduction, monthlyOtherDeduction),
    [annualData.rows, monthlyAdditionalDeduction, monthlyOtherDeduction, monthlySpecialDeduction, taxMode],
  )
  const currentRow = taxRows.find((row) => row.month === currentMonth.value) ?? taxRows[0]
  const totalTax = taxRows.reduce((sum, row) => sum + row.tax, 0)
  const totalNet = taxRows.reduce((sum, row) => sum + row.netIncome, 0)
  const realizedTaxRows = taxRows.filter((row) => row.hours > 0 || row.amount > 0 || row.locked)
  const maxAmount = Math.max(...realizedTaxRows.map((row) => row.amount), 1)

  const todayGroup = dailyGroups.find((g) => g.day === today)

  return (
    <section className="income-view view-stack">
      <section className="stats-grid" aria-label="年度收入统计">
        <StatCard label="年度税前收入" value={`¥${formatYuan(annualData.totalAmount)}`} trend={`${annualData.totalHours.toFixed(1)}h 已记录工时`} icon={<BarChart3 size={20} />} />
        <StatCard label="估算已预扣税" value={`¥${totalTax.toLocaleString()}`} trend={taxMode === 'labor' ? '按劳务报酬预扣预缴' : '按工资薪金累计预扣法'} icon={<CalculatorIcon />} />
        <StatCard label="估算税后收入" value={`¥${totalNet.toLocaleString()}`} trend="未含社保外其他真实申报差异" icon={<CheckCircle2 size={20} />} />
        <StatCard label="本月税后" value={`¥${(currentRow?.netIncome ?? 0).toLocaleString()}`} trend={`${currentMonth.label}估算`} icon={<Clock3 size={20} />} />
      </section>

      <section className="income-grid">
        <section className="panel income-chart-panel">
          <div className="panel-header compact">
            <div>
              <h2>{annualData.year} 收入趋势</h2>
              <p>只展示已有工时或已锁定结算的月份，浅色为税前、深色为税后</p>
            </div>
            <span className="income-method-pill">{taxMode === 'labor' ? '劳务报酬估算' : '累计预扣法估算'}</span>
          </div>
          <div className="income-bars" style={{ '--income-month-count': Math.max(realizedTaxRows.length, 1) } as CSSProperties}>
            {realizedTaxRows.map((row) => {
              const grossHeight = Math.max(4, (row.amount / maxAmount) * 100)
              const netRatio = row.amount > 0 ? Math.max(0, Math.min(100, (row.netIncome / row.amount) * 100)) : 0
              return (
                <button
                  className={`income-bar ${row.month === currentMonth.value ? 'current' : ''}`}
                  key={row.month}
                  onClick={() => onMonthChange(row.month)}
                >
                  <span className="income-bar-value">¥{Math.round(row.netIncome).toLocaleString()}</span>
                  <span className="income-bar-stage">
                    <span className="income-bar-track" style={{ height: `${grossHeight}%` }}>
                      <i className="net" style={{ height: `${netRatio}%` }} />
                    </span>
                  </span>
                  <small>{Number(row.month.slice(5, 7))}月</small>
                </button>
              )
            })}
          </div>
          <div className="income-legend">
            <span><i className="gross" />税前收入</span>
            <span><i className="net" />税后收入</span>
          </div>
        </section>

        <details className="panel income-tax-panel">
          <summary className="income-tax-summary">
            <div>
              <h2>税务估算参数</h2>
              <p>公司最终申报可能包含更多扣除，以实际个税 App 为准</p>
            </div>
            <span>展开参数</span>
          </summary>
          <div className="income-form">
            <label className="field">
              <span>每月专项扣除</span>
              <input type="number" min="0" step="100" value={monthlySpecialDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlySpecialDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月专项附加扣除</span>
              <input type="number" min="0" step="100" value={monthlyAdditionalDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyAdditionalDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label className="field">
              <span>每月其他扣除</span>
              <input type="number" min="0" step="100" value={monthlyOtherDeduction} disabled={taxMode === 'labor'} onChange={(event) => setMonthlyOtherDeduction(Math.max(0, Number(event.target.value) || 0))} />
            </label>
          </div>
          <div className="tax-note">
            <strong>当前计算口径</strong>
            <p>
              {taxMode === 'labor'
                ? '劳务报酬按次或按月预扣预缴：收入不超过 4000 元减除 800 元，超过 4000 元减除 20%，再按 20% / 30% / 40% 预扣率计算。'
                : '累计应纳税所得额 = 累计收入 - 5000 × 月份数 - 累计专项扣除 - 累计专项附加扣除 - 累计其他扣除。'}
            </p>
          </div>
        </details>
      </section>

      <section className="panel income-table-panel">
        <div className="panel-header compact">
          <div>
            <h2>月度收入明细</h2>
            <p>点击趋势柱可切换当前月份；税额为系统估算，不替代财务确认</p>
          </div>
        </div>
        <div className="income-table-wrap">
          <table className="income-table">
            <thead>
              <tr>
                <th>月份</th>
                <th className="num">工时</th>
                <th className="num">税前收入</th>
                <th className="num">{taxMode === 'labor' ? '预扣应纳税所得额' : '累计应纳税所得额'}</th>
                <th className="num">预扣率</th>
                <th className="num">本月预扣税</th>
                <th className="num">税后收入</th>
              </tr>
            </thead>
            <tbody>
              {realizedTaxRows.map((row) => (
                <tr className={row.month === currentMonth.value ? 'current' : ''} key={row.month}>
                  <td>{monthLabelOf(row.month)}</td>
                  <td className="num">{row.hours.toFixed(1)}h</td>
                  <td className="num">¥{formatYuan(row.amount)}</td>
                  <td className="num">¥{Math.round(row.taxableIncome).toLocaleString()}</td>
                  <td className="num">{Math.round(row.rate * 100)}%</td>
                  <td className="num">¥{row.tax.toLocaleString()}</td>
                  <td className="num">¥{row.netIncome.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel income-table-panel">
        <div className="panel-header compact">
          <div>
            <h2>日收入明细 · {currentMonth.label}</h2>
            <p>
              {todayGroup
                ? `今日已记录 ${todayGroup.totalHours.toFixed(1)}h，估算收入 ¥${todayGroup.totalIncome.toLocaleString()}`
                : '基于分段计时记录，按时薪估算；今日暂无记录'}
            </p>
          </div>
        </div>
        {dailyGroups.length > 0 ? (
          <div className="income-table-wrap">
            <table className="income-table income-table-daily">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>任务</th>
                  <th className="num">工时</th>
                  <th className="num">估算收入</th>
                </tr>
              </thead>
              <tbody>
                {dailyGroups.map((group) => (
                  <Fragment key={group.day}>
                    {group.entries.map((entry, i) => (
                      <tr key={entry.id} className={group.day === today ? 'current' : ''}>
                        {i === 0 && (
                          <td rowSpan={group.entries.length} className="income-day-date">
                            {group.day.slice(5).replace('-', '/')}
                          </td>
                        )}
                        <td className="income-day-tasks">
                          {entry.title}
                          {entry.isSupplemental && <em className="income-supplemental-tag">补录</em>}
                        </td>
                        <td className="num">{entry.hours.toFixed(1)}h</td>
                        <td className="num">¥{entry.income.toLocaleString()}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="income-empty">本月暂无分段计时记录，在任务进展中添加计时后即可看到日明细。</p>
        )}
      </section>
    </section>
  )
}

function CalculatorIcon() {
  return <BarChart3 size={20} />
}


