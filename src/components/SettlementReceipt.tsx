import type { ReceiptExcelOptions } from '../lib/receiptExcel'

const formatYuan = (value: number) =>
  (Math.round(value * 100) / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const statusClassName = (status: string) => {
  if (status === '已验收' || status === '已完成') return 'is-accepted'
  if (status === '进行中') return 'is-active'
  return 'is-pending'
}

export function SettlementReceipt({
  options,
  className = '',
}: {
  options: ReceiptExcelOptions
  className?: string
}) {
  return (
    <section className={`receipt settlement-receipt-template ${className}`.trim()} aria-label="月度结算回单">
      <div className="settlement-receipt-brand">
        <strong>Giverny</strong>
        <span>让创作在自己的花园里生长</span>
      </div>

      <header className="settlement-receipt-heading">
        <div>
          <h2>{options.title}</h2>
          <span>MONTHLY SETTLEMENT RECEIPT</span>
        </div>
        <div className="settlement-receipt-meta">
          <span>回单编号&nbsp;&nbsp;{options.receiptNo}</span>
          <span>出单时间&nbsp;&nbsp;{options.issuedAt}</span>
        </div>
      </header>

      <dl className="settlement-receipt-info">
        <div><dt>客户名称</dt><dd>{options.companyName}</dd></div>
        <div><dt>服务内容</dt><dd>{options.serviceName}</dd></div>
        <div><dt>{options.settlementLabelTitle || '结算月份'}</dt><dd>{options.settlementLabel}</dd></div>
        <div><dt>结算单价</dt><dd>¥{formatYuan(options.hourlyRate).replace(/\.00$/, '')} / 小时</dd></div>
      </dl>

      <div className="settlement-receipt-table-scroll">
        <table className="settlement-receipt-table">
          <colgroup>
            <col className="col-sequence" />
            <col className="col-type" />
            <col className="col-title" />
            <col className="col-requirement" />
            <col className="col-date" />
            <col className="col-date" />
            <col className="col-person" />
            <col className="col-person" />
            <col className="col-status" />
            <col className="col-hours" />
            <col className="col-hours" />
            <col className="col-price" />
            <col className="col-amount" />
            <col className="col-note" />
          </colgroup>
          <thead>
            <tr>
              <th>序号</th>
              <th>设计类型</th>
              <th>任务</th>
              <th>任务需求</th>
              <th>预计开始日期</th>
              <th>实际完成日期</th>
              <th>需求人</th>
              <th>对接人</th>
              <th>状态</th>
              <th>预估工时</th>
              <th>实际工时</th>
              <th>单价</th>
              <th>小计</th>
              <th>验收备注</th>
            </tr>
          </thead>
          <tbody>
            {options.rows.map((row) => (
              <tr key={`${row.sequence}-${row.title}`}>
                <td className="cell-center">{row.sequence}</td>
                <td>{row.type || '—'}</td>
                <td>{row.title || '—'}</td>
                <td className="cell-long">{row.requirement || '—'}</td>
                <td className="cell-center">{row.estimatedStartDate || '—'}</td>
                <td className="cell-center">{row.actualCompletionDate || '—'}</td>
                <td className="cell-center">{row.requester || '—'}</td>
                <td className="cell-center">{row.contact || '—'}</td>
                <td className={`cell-center cell-status ${statusClassName(row.status)}`}>{row.status || '—'}</td>
                <td className="cell-center cell-number">{row.estimatedHours == null ? '—' : `${row.estimatedHours.toFixed(2)} h`}</td>
                <td className="cell-center cell-number">{row.actualHours.toFixed(2)} h</td>
                <td className="cell-center cell-number">¥{formatYuan(row.unitPrice).replace(/\.00$/, '')}</td>
                <td className="cell-amount cell-number">¥{formatYuan(row.amount)}</td>
                <td className="cell-long">{row.acceptanceNote || '—'}</td>
              </tr>
            ))}
            {options.rows.length === 0 && (
              <tr>
                <td className="settlement-receipt-empty" colSpan={14}>本期暂无可结算任务</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10}>合&nbsp;&nbsp;计</td>
              <td className="cell-center cell-number">{options.totalHours.toFixed(2)} h</td>
              <td />
              <td className="cell-amount cell-number" colSpan={2}>¥{formatYuan(options.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
