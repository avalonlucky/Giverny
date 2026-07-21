import { toChineseAmount } from './format'

export type ReceiptExcelRow = {
  sequence: string
  type: string
  title: string
  requirement: string
  estimatedStartDate: string
  actualCompletionDate: string
  requester: string
  contact: string
  status: string
  estimatedHours: number | null
  actualHours: number
  unitPrice: number
  amount: number
  acceptanceNote: string
}

export type ReceiptExcelOptions = {
  fileLabel: string
  title: string
  receiptNo: string
  issuedAt: string
  companyName: string
  serviceName: string
  settlementLabel: string
  hourlyRate: number
  rows: ReceiptExcelRow[]
  totalHours: number
  totalAmount: number
  remarks: string[]
}

const currencyFormat = '"¥"#,##0.00'
const hourFormat = '0.00'

const palette = {
  text: 'FF17282F',
  muted: 'FF66736F',
  green: 'FF2F6F6D',
  border: 'FFD8DED8',
  headerFill: 'FFF2F4EF',
  zebraFill: 'FFFAFBF7',
  paperFill: 'FFFFFFFF',
  acceptedFill: 'FFE4F0E9',
  pendingFill: 'FFF3EEE1',
  activeFill: 'FFE8F0F2',
}

const cleanText = (value: string | undefined | null, fallback = '—') => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

const formatYuan = (value: number) =>
  (Math.round(value * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const estimateRowHeight = (requirement: string, note: string) => {
  const weightedLength = Math.max(requirement.length / 42, note.length / 54)
  return Math.max(42, Math.min(118, 30 + Math.ceil(weightedLength) * 18))
}

export async function buildReceiptExcelBuffer(options: ReceiptExcelOptions) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Giverny'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('结算回单', {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 10 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  })

  sheet.columns = [
    { key: 'sequence', width: 6 },
    { key: 'type', width: 13 },
    { key: 'title', width: 30 },
    { key: 'requirement', width: 56 },
    { key: 'estimatedStartDate', width: 14 },
    { key: 'actualCompletionDate', width: 14 },
    { key: 'requester', width: 8 },
    { key: 'contact', width: 8 },
    { key: 'status', width: 9 },
    { key: 'estimatedHours', width: 10 },
    { key: 'actualHours', width: 10 },
    { key: 'unitPrice', width: 9 },
    { key: 'amount', width: 12 },
    { key: 'acceptanceNote', width: 58 },
  ]

  sheet.mergeCells('A1:C1')
  sheet.getCell('A1').value = `结算回单_${options.fileLabel}.xlsx`
  sheet.getCell('A1').font = { name: 'Arial', size: 10, bold: true, color: { argb: palette.green } }
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4F1' } }
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('A3:H3')
  sheet.getCell('A3').value = options.title
  sheet.getCell('A3').font = { name: 'Arial', size: 20, bold: true, color: { argb: palette.text } }
  sheet.mergeCells('A4:H4')
  sheet.getCell('A4').value = 'MONTHLY SETTLEMENT RECEIPT'
  sheet.getCell('A4').font = { name: 'Arial', size: 9, color: { argb: palette.muted } }
  sheet.getCell('A4').alignment = { horizontal: 'left' }

  sheet.mergeCells('L3:N3')
  sheet.getCell('L3').value = `回单编号：${options.receiptNo}`
  sheet.mergeCells('L4:N4')
  sheet.getCell('L4').value = `出单时间：${options.issuedAt}`
  ;['L3', 'L4'].forEach((cell) => {
    sheet.getCell(cell).font = { name: 'Arial', size: 9, color: { argb: palette.muted } }
    sheet.getCell(cell).alignment = { horizontal: 'right' }
  })

  sheet.mergeCells('A5:N5')
  sheet.getCell('A5').border = { bottom: { style: 'medium', color: { argb: palette.green } } }

  const infoLabels = [
    ['A7', '客户名称', 'A8', options.companyName, 'A8:D8'],
    ['E7', '服务内容', 'E8', options.serviceName, 'E8:H8'],
    ['I7', '结算月份', 'I8', options.settlementLabel, 'I8:L8'],
    ['M7', '结算单价', 'M8', `¥${formatYuan(options.hourlyRate)} / 小时`, 'M8:N8'],
  ] as const
  infoLabels.forEach(([labelCell, label, valueCell, value, mergeRange]) => {
    sheet.mergeCells(mergeRange)
    sheet.getCell(labelCell).value = label
    sheet.getCell(labelCell).font = { name: 'Arial', size: 9, color: { argb: palette.muted } }
    sheet.getCell(valueCell).value = value
    sheet.getCell(valueCell).font = { name: 'Arial', size: 11, bold: true, color: { argb: palette.text } }
    sheet.getCell(valueCell).border = { bottom: { style: 'thin', color: { argb: palette.border } } }
  })

  const headerRow = sheet.getRow(10)
  headerRow.values = [
    '序号',
    '设计类型',
    '任务',
    '任务需求',
    '预计开始日期',
    '实际完成日期',
    '需求人',
    '对接人',
    '状态',
    '预估工时',
    '实际工时',
    '单价',
    '小计',
    '验收备注',
  ]
  headerRow.height = 36
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: palette.text } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.headerFill } }
    cell.border = {
      top: { style: 'thin', color: { argb: palette.border } },
      bottom: { style: 'thin', color: { argb: palette.border } },
      left: { style: 'thin', color: { argb: palette.border } },
      right: { style: 'thin', color: { argb: palette.border } },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  const dataStartRow = 11
  options.rows.forEach((item, index) => {
    const rowNumber = dataStartRow + index
    const row = sheet.getRow(rowNumber)
    row.values = [
      item.sequence,
      cleanText(item.type),
      cleanText(item.title),
      cleanText(item.requirement),
      cleanText(item.estimatedStartDate),
      cleanText(item.actualCompletionDate),
      cleanText(item.requester),
      cleanText(item.contact),
      cleanText(item.status),
      item.estimatedHours ?? null,
      item.actualHours,
      item.unitPrice,
      { formula: `K${rowNumber}*L${rowNumber}`, result: item.amount },
      cleanText(item.acceptanceNote),
    ]
    row.height = estimateRowHeight(item.requirement, item.acceptanceNote)
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: palette.text } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index % 2 === 0 ? palette.paperFill : palette.zebraFill },
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: palette.border } },
        left: { style: 'thin', color: { argb: palette.border } },
        right: { style: 'thin', color: { argb: palette.border } },
      }
      const isNumberColumn = colNumber >= 10 && colNumber <= 13
      cell.alignment = {
        vertical: 'top',
        horizontal: isNumberColumn ? 'right' : 'left',
        wrapText: true,
      }
    })
    row.getCell(10).numFmt = hourFormat
    row.getCell(11).numFmt = hourFormat
    row.getCell(12).numFmt = currencyFormat
    row.getCell(13).numFmt = currencyFormat
    const statusCell = row.getCell(9)
    statusCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: item.status === '已验收'
          ? palette.acceptedFill
          : item.status === '进行中'
            ? palette.activeFill
            : palette.pendingFill,
      },
    }
  })

  const totalRowNumber = dataStartRow + options.rows.length
  const totalRow = sheet.getRow(totalRowNumber)
  totalRow.values = []
  sheet.mergeCells(`A${totalRowNumber}:I${totalRowNumber}`)
  totalRow.getCell(1).value = '合计'
  totalRow.getCell(10).value = '计费工时'
  totalRow.getCell(11).value = options.totalHours
  totalRow.getCell(12).value = '结算金额'
  totalRow.getCell(13).value = options.rows.length > 0
    ? { formula: `SUM(M${dataStartRow}:M${totalRowNumber - 1})`, result: options.totalAmount }
    : options.totalAmount
  totalRow.getCell(14).value = `人民币（大写）${toChineseAmount(options.totalAmount)}`
  totalRow.height = 34
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: colNumber === 13 ? palette.green : palette.text } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1ED' } }
    cell.border = { top: { style: 'medium', color: { argb: palette.green } } }
    cell.alignment = { vertical: 'middle', horizontal: colNumber >= 11 && colNumber <= 13 ? 'right' : 'left', wrapText: true }
  })
  totalRow.getCell(11).numFmt = hourFormat
  totalRow.getCell(13).numFmt = currencyFormat

  const remarkStart = totalRowNumber + 2
  sheet.mergeCells(`A${remarkStart}:N${remarkStart}`)
  sheet.getCell(`A${remarkStart}`).value = options.remarks.filter(Boolean).join('\n')
  sheet.getCell(`A${remarkStart}`).font = { name: 'Arial', size: 10, color: { argb: palette.muted } }
  sheet.getCell(`A${remarkStart}`).alignment = { vertical: 'top', wrapText: true }
  sheet.getRow(remarkStart).height = Math.max(32, options.remarks.length * 18)

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.protection = { locked: true }
    })
  })

  return workbook.xlsx.writeBuffer()
}
