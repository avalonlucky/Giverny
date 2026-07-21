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
}

const currencyFormat = '\\¥#,##0.00'
const hourFormat = '0.00" h"'

const palette = {
  text: 'FF2B2B28',
  muted: 'FF8C8B80',
  green: 'FF3F5E4A',
  greenText: 'FF2F4938',
  border: 'FFDDE4D9',
  innerBorder: 'FFE8ECE5',
  infoFill: 'FFEAF0E6',
  zebraFill: 'FFFBFAF4',
  paperFill: 'FFFFFFFF',
  acceptedFill: 'FFE6F2E7',
  acceptedText: 'FF397047',
  pendingFill: 'FFF5F1E7',
  pendingText: 'FF856826',
  activeFill: 'FFFFEAD0',
  activeText: 'FFB06F19',
}

const cleanText = (value: string | undefined | null, fallback = '—') => {
  const text = (value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || fallback
}

const estimateRowHeight = (requirement: string, note: string) => {
  const requirementLines = requirement.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 52)), 0)
  const noteLines = note.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 54)), 0)
  return Math.max(30, Math.min(117.75, Math.max(requirementLines, noteLines) * 12 + 12))
}

const parseReceiptDate = (value: string) => {
  const matched = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (!matched) return null
  return new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])))
}

const borderForCell = (column: number) => ({
  top: { style: 'thin' as const, color: { argb: palette.border } },
  bottom: { style: 'thin' as const, color: { argb: palette.border } },
  left: { style: 'thin' as const, color: { argb: column === 1 ? palette.border : palette.innerBorder } },
  right: { style: 'thin' as const, color: { argb: column === 14 ? palette.border : palette.innerBorder } },
})

export async function buildReceiptExcelBuffer(options: ReceiptExcelOptions) {
  const ExcelJsModule = await import('exceljs')
  const ExcelJS = ExcelJsModule.default ?? ExcelJsModule
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Giverny'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('结算回单', {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  })

  sheet.columns = [
    { key: 'sequence', width: 6 },
    { key: 'type', width: 16 },
    { key: 'title', width: 26 },
    { key: 'requirement', width: 78 },
    { key: 'estimatedStartDate', width: 13 },
    { key: 'actualCompletionDate', width: 13 },
    { key: 'requester', width: 9 },
    { key: 'contact', width: 9 },
    { key: 'status', width: 9 },
    { key: 'estimatedHours', width: 10 },
    { key: 'actualHours', width: 10 },
    { key: 'unitPrice', width: 9 },
    { key: 'amount', width: 12 },
    { key: 'acceptanceNote', width: 78 },
  ]

  sheet.getRow(1).height = 21.75
  sheet.getCell('A1').value = 'Giverny'
  sheet.getCell('A1').font = { name: 'Georgia', size: 15, bold: true, color: { argb: palette.text } }
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9F5' } }
  sheet.getRow(2).height = 15
  sheet.getCell('A2').value = '让创作在自己的花园里生长'
  sheet.getCell('A2').font = { name: 'Noto Sans CJK SC', size: 8, color: { argb: palette.muted } }
  sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9F5' } }
  sheet.getRow(3).height = 6

  sheet.mergeCells('A4:G4')
  sheet.mergeCells('H4:N4')
  sheet.getRow(4).height = 24
  sheet.getCell('A4').value = options.title
  sheet.getCell('A4').font = { name: 'Noto Sans CJK SC', size: 17, bold: true, color: { argb: palette.text } }
  sheet.getCell('H4').value = `回单编号  ${options.receiptNo}`
  sheet.getCell('H4').font = { name: 'Noto Sans CJK SC', size: 9, color: { argb: palette.muted } }
  sheet.getCell('H4').alignment = { horizontal: 'right' }

  sheet.mergeCells('A5:G5')
  sheet.mergeCells('H5:N5')
  sheet.getRow(5).height = 13.5
  sheet.getCell('A5').value = 'MONTHLY SETTLEMENT RECEIPT'
  sheet.getCell('A5').font = { name: 'Microsoft YaHei', size: 8, color: { argb: palette.muted } }
  sheet.getCell('A5').border = { bottom: { style: 'medium', color: { argb: palette.green } } }
  sheet.getCell('H5').value = `出单时间  ${options.issuedAt}`
  sheet.getCell('H5').font = { name: 'Noto Sans CJK SC', size: 9, color: { argb: palette.muted } }
  sheet.getCell('H5').alignment = { horizontal: 'right' }
  sheet.getCell('H5').border = { bottom: { style: 'medium', color: { argb: palette.green } } }
  sheet.getRow(6).height = 3.75
  sheet.getRow(7).height = 6

  const infoLabels = [
    ['A8', '客户名称', 'A9', options.companyName, 'A8:C8', 'A9:C9'],
    ['D8', '服务内容', 'D9', options.serviceName, 'D8:G8', 'D9:G9'],
    ['H8', '结算月份', 'H9', options.settlementLabel, 'H8:J8', 'H9:J9'],
    ['K8', '结算单价', 'K9', options.hourlyRate, 'K8:N8', 'K9:N9'],
  ] as const
  sheet.getRow(8).height = 15.75
  sheet.getRow(9).height = 21.75
  infoLabels.forEach(([labelCell, label, valueCell, value, labelMergeRange, valueMergeRange]) => {
    sheet.mergeCells(labelMergeRange)
    sheet.mergeCells(valueMergeRange)
    sheet.getCell(labelCell).value = label
    sheet.getCell(labelCell).font = { name: 'Noto Sans CJK SC', size: 8, color: { argb: palette.muted } }
    sheet.getCell(labelCell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.infoFill } }
    sheet.getCell(labelCell).border = {
      top: { style: 'thin', color: { argb: palette.border } },
      bottom: { style: 'thin', color: { argb: 'FFE3E1D6' } },
    }
    sheet.getCell(valueCell).value = value
    sheet.getCell(valueCell).font = { name: 'Noto Sans CJK SC', size: 11, bold: true, color: { argb: palette.text } }
    sheet.getCell(valueCell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.infoFill } }
    sheet.getCell(valueCell).border = {
      top: { style: 'thin', color: { argb: 'FFE3E1D6' } },
      bottom: { style: 'thin', color: { argb: palette.border } },
    }
  })
  sheet.getCell('K9').numFmt = '\\¥0" / 小时"'
  sheet.getRow(10).height = 7.5

  const headerRow = sheet.getRow(11)
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
  headerRow.height = 30
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Noto Sans CJK SC', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.green } }
    cell.border = {
      top: { style: 'thin', color: { argb: palette.border } },
      bottom: { style: 'thin', color: { argb: palette.border } },
      left: { style: 'thin', color: { argb: palette.border } },
      right: { style: 'thin', color: { argb: palette.border } },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })

  const dataStartRow = 12
  options.rows.forEach((item, index) => {
    const rowNumber = dataStartRow + index
    const row = sheet.getRow(rowNumber)
    row.values = [
      item.sequence,
      cleanText(item.type),
      cleanText(item.title),
      cleanText(item.requirement),
      parseReceiptDate(item.estimatedStartDate),
      parseReceiptDate(item.actualCompletionDate),
      cleanText(item.requester),
      cleanText(item.contact),
      cleanText(item.status),
      item.estimatedHours ?? null,
      item.actualHours,
      { formula: '$K$9', result: item.unitPrice },
      { formula: `K${rowNumber}*L${rowNumber}`, result: item.amount },
      cleanText(item.acceptanceNote),
    ]
    row.height = estimateRowHeight(item.requirement, item.acceptanceNote)
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Noto Sans CJK SC', size: 9, color: { argb: palette.text } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index % 2 === 0 ? palette.paperFill : palette.zebraFill },
      }
      cell.border = borderForCell(colNumber)
      const isCenteredColumn = colNumber === 1 || (colNumber >= 5 && colNumber <= 12)
      cell.alignment = {
        vertical: 'top',
        horizontal: isCenteredColumn ? 'center' : 'left',
        wrapText: true,
      }
    })
    row.getCell(5).numFmt = 'yyyy/mm/dd'
    row.getCell(6).numFmt = 'yyyy/mm/dd'
    row.getCell(10).numFmt = hourFormat
    row.getCell(11).numFmt = hourFormat
    row.getCell(12).numFmt = '\\¥0'
    row.getCell(13).numFmt = currencyFormat
    row.getCell(13).font = { name: 'Microsoft YaHei', size: 9, bold: true, color: { argb: palette.greenText } }
    const statusCell = row.getCell(9)
    statusCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    const isAccepted = item.status === '已验收' || item.status === '已完成'
    const isActive = item.status === '进行中'
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: isAccepted
          ? palette.acceptedFill
          : isActive
            ? palette.activeFill
            : palette.pendingFill,
      },
    }
    statusCell.font = {
      name: 'Noto Sans CJK SC',
      size: 9,
      color: { argb: isAccepted ? palette.acceptedText : isActive ? palette.activeText : palette.pendingText },
    }
  })

  const totalRowNumber = dataStartRow + options.rows.length
  const totalRow = sheet.getRow(totalRowNumber)
  sheet.mergeCells(`A${totalRowNumber}:J${totalRowNumber}`)
  sheet.mergeCells(`M${totalRowNumber}:N${totalRowNumber}`)
  totalRow.getCell(1).value = '合  计'
  totalRow.getCell(11).value = options.rows.length > 0
    ? { formula: `SUM(K${dataStartRow}:K${totalRowNumber - 1})`, result: options.totalHours }
    : options.totalHours
  totalRow.getCell(13).value = options.rows.length > 0
    ? { formula: `SUM(M${dataStartRow}:M${totalRowNumber - 1})`, result: options.totalAmount }
    : options.totalAmount
  totalRow.height = 25.5
  for (let colNumber = 1; colNumber <= 14; colNumber += 1) {
    const cell = totalRow.getCell(colNumber)
    cell.font = { name: 'Noto Sans CJK SC', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.green } }
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : colNumber >= 11 ? 'right' : 'left', wrapText: true }
  }
  totalRow.getCell(11).numFmt = hourFormat
  totalRow.getCell(13).numFmt = currencyFormat

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.protection = { locked: true }
    })
  })

  return workbook.xlsx.writeBuffer()
}
