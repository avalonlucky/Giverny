import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import sharp from 'sharp'

const outputDir = resolve('public/demo-assets')
await mkdir(outputDir, { recursive: true })

const palette = {
  ink: '20302D',
  muted: '697571',
  green: '3F6E61',
  pale: 'E9EFE8',
  water: 'DDEBE8',
  lily: 'D9C7D9',
  cream: 'F8F7F1',
}

async function workbook(name, title, columns, rows) {
  const book = new ExcelJS.Workbook()
  book.creator = 'Giverny Demo Workspace'
  const sheet = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 3 }] })
  sheet.mergeCells(1, 1, 1, columns.length)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: palette.ink } }
  titleCell.alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 34
  sheet.mergeCells(2, 1, 2, columns.length)
  sheet.getCell(2, 1).value = '虚构演示数据 · Generated for Giverny'
  sheet.getCell(2, 1).font = { size: 10, color: { argb: palette.muted } }
  const header = sheet.getRow(3)
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1)
    cell.value = column.header
    cell.font = { bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.green } }
    cell.alignment = { vertical: 'middle', horizontal: column.align || 'left' }
    sheet.getColumn(index + 1).width = column.width || 16
  })
  header.height = 24
  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(rowIndex + 4)
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1)
      cell.value = value
      cell.alignment = { vertical: 'middle', horizontal: columns[index].align || 'left' }
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.cream } }
      if (columns[index].format) cell.numFmt = columns[index].format
    })
    row.height = 22
  })
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } }
  await book.xlsx.writeFile(join(outputDir, name))
}

await workbook('quarterly-retention-analysis.xlsx', '星澜 App 季度留存分析', [
  { header: '用户分群', width: 22 }, { header: '新增用户', width: 14, align: 'right', format: '#,##0' },
  { header: '次日留存', width: 14, align: 'right', format: '0.0%' }, { header: '7 日留存', width: 14, align: 'right', format: '0.0%' },
  { header: '30 日留存', width: 14, align: 'right', format: '0.0%' }, { header: '关键观察', width: 42 },
], [
  ['自然搜索', 12840, 0.462, 0.291, 0.176, '引导页完成度高，30 日留存领先'],
  ['内容社区', 9360, 0.413, 0.246, 0.139, '第 3 日出现明显流失，应优化内容订阅'],
  ['品牌投放', 15820, 0.351, 0.187, 0.091, '首日激活偏低，需收紧落地页承诺'],
  ['好友邀请', 4740, 0.528, 0.338, 0.204, '样本较小但质量最高，可扩大激励实验'],
])

await workbook('channel-conversion-funnel.xlsx', '春季增长活动渠道漏斗', [
  { header: '渠道', width: 20 }, { header: '曝光', width: 14, align: 'right', format: '#,##0' },
  { header: '点击', width: 14, align: 'right', format: '#,##0' }, { header: '注册', width: 14, align: 'right', format: '#,##0' },
  { header: '激活', width: 14, align: 'right', format: '#,##0' }, { header: '激活率', width: 14, align: 'right', format: '0.0%' },
], [
  ['公众号内容', 186000, 14760, 4190, 2710, 0.647], ['短视频信息流', 524000, 31820, 6720, 3310, 0.493],
  ['合作社群', 78000, 9120, 3160, 2280, 0.722], ['搜索广告', 142000, 11980, 2810, 1460, 0.520],
])

await workbook('recruiting-funnel.xlsx', '研发岗位招聘漏斗复盘', [
  { header: '岗位', width: 24 }, { header: '简历', width: 12, align: 'right' }, { header: '初筛', width: 12, align: 'right' },
  { header: '技术面', width: 12, align: 'right' }, { header: '终面', width: 12, align: 'right' }, { header: 'Offer', width: 12, align: 'right' },
  { header: '改进动作', width: 42 },
], [
  ['前端工程师', 186, 54, 21, 8, 5, '统一作品集评分卡，减少初筛偏差'],
  ['后端工程师', 143, 47, 18, 7, 4, '提前说明值班机制与技术栈'],
  ['数据工程师', 96, 31, 12, 5, 3, '增加 SQL 实操题的业务语境'],
])

await workbook('video-storyboard.xlsx', '「看见日常」产品短片分镜表', [
  { header: '镜号', width: 10 }, { header: '时长', width: 12 }, { header: '画面', width: 40 },
  { header: '旁白 / 字幕', width: 42 }, { header: '声音', width: 28 },
], [
  ['01', '0–4s', '晨光落在桌面，手机屏幕亮起', '每一个普通日常，都值得被好好记录。', '环境声 + 单音钢琴'],
  ['02', '4–10s', '通勤、咖啡、会议三个快速切镜', '从零散片段，到清晰的一天。', '节奏渐入'],
  ['03', '10–18s', '应用自动整理时间线与标签', '星澜替你收好那些容易错过的细节。', '轻提示音'],
  ['04', '18–25s', '周末回顾卡片在水面倒影中展开', '回望时，生活已经长成自己的风景。', '音乐收束'],
])

const uiSvg = (title, subtitle, accent, variant) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960">
  <rect width="1440" height="960" fill="#F4F6F2"/>
  <rect x="70" y="58" width="1300" height="844" rx="28" fill="#FFFFFF"/>
  <rect x="70" y="58" width="250" height="844" rx="28" fill="#E9EFE8"/>
  <circle cx="126" cy="118" r="24" fill="${accent}"/><text x="165" y="127" font-family="Arial" font-size="26" font-weight="700" fill="#20302D">Lumi</text>
  <g font-family="Arial" font-size="18" fill="#65736E"><text x="112" y="218">Overview</text><text x="112" y="270">Projects</text><text x="112" y="322">Reports</text><text x="112" y="374">Team</text></g>
  <rect x="96" y="184" width="198" height="54" rx="14" fill="#FFFFFF" opacity=".9"/>
  <text x="370" y="128" font-family="Arial" font-size="38" font-weight="700" fill="#20302D">${title}</text>
  <text x="370" y="165" font-family="Arial" font-size="18" fill="#697571">${subtitle}</text>
  ${variant === 1 ? `
  <rect x="370" y="215" width="300" height="160" rx="18" fill="#DDEBE8"/><text x="398" y="258" font-family="Arial" font-size="16" fill="#587069">Weekly focus</text><text x="398" y="326" font-family="Arial" font-size="48" font-weight="700" fill="#20302D">84%</text>
  <rect x="695" y="215" width="300" height="160" rx="18" fill="#F1E8F0"/><text x="723" y="258" font-family="Arial" font-size="16" fill="#746476">Completed</text><text x="723" y="326" font-family="Arial" font-size="48" font-weight="700" fill="#20302D">26</text>
  <rect x="1020" y="215" width="300" height="160" rx="18" fill="#EEF0E3"/><text x="1048" y="258" font-family="Arial" font-size="16" fill="#697158">Team pace</text><text x="1048" y="326" font-family="Arial" font-size="48" font-weight="700" fill="#20302D">+12%</text>
  <rect x="370" y="410" width="625" height="420" rx="18" fill="#F7F8F5"/><path d="M420 710 C520 620 575 690 655 570 S820 620 940 480" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><g fill="${accent}"><circle cx="420" cy="710" r="8"/><circle cx="655" cy="570" r="8"/><circle cx="940" cy="480" r="8"/></g>
  <rect x="1020" y="410" width="300" height="420" rx="18" fill="#F7F8F5"/><g font-family="Arial" fill="#20302D"><text x="1052" y="460" font-size="20" font-weight="700">Today</text><text x="1052" y="530" font-size="17">Research sync</text><text x="1052" y="590" font-size="17">Prototype review</text><text x="1052" y="650" font-size="17">Data handoff</text></g>` : `
  <rect x="370" y="215" width="950" height="220" rx="24" fill="#DDEBE8"/><circle cx="470" cy="325" r="54" fill="${accent}" opacity=".85"/><text x="555" y="300" font-family="Arial" font-size="20" fill="#587069">TODAY'S BALANCE</text><text x="555" y="365" font-family="Arial" font-size="52" font-weight="700" fill="#20302D">7,420 steps</text>
  <rect x="370" y="470" width="455" height="360" rx="20" fill="#F7F8F5"/><text x="405" y="520" font-family="Arial" font-size="21" font-weight="700" fill="#20302D">Weekly rhythm</text><g fill="${accent}" opacity=".8"><rect x="410" y="690" width="42" height="90" rx="12"/><rect x="474" y="620" width="42" height="160" rx="12"/><rect x="538" y="650" width="42" height="130" rx="12"/><rect x="602" y="570" width="42" height="210" rx="12"/><rect x="666" y="610" width="42" height="170" rx="12"/><rect x="730" y="540" width="42" height="240" rx="12"/></g>
  <rect x="850" y="470" width="470" height="360" rx="20" fill="#F7F8F5"/><text x="885" y="520" font-family="Arial" font-size="21" font-weight="700" fill="#20302D">Gentle reminders</text><circle cx="910" cy="595" r="10" fill="${accent}"/><text x="940" y="602" font-family="Arial" font-size="18" fill="#4F5F59">Take a short walk at 15:00</text><circle cx="910" cy="665" r="10" fill="#D9C7D9"/><text x="940" y="672" font-family="Arial" font-size="18" fill="#4F5F59">Wind down before sleep</text>`}
</svg>`

await sharp(Buffer.from(uiSvg('Team workspace', 'A calm dashboard for distributed teams', '#4E8172', 1))).png().toFile(join(outputDir, 'ui-team-dashboard.png'))
await sharp(Buffer.from(uiSvg('Your wellbeing', 'Small signals, gathered with care', '#667FA4', 2))).png().toFile(join(outputDir, 'ui-wellbeing-app.png'))

const videoCover = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D9E8E3"/><stop offset="1" stop-color="#C7BDD1"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1260" cy="220" r="310" fill="#F8F2DE" opacity=".65"/><path d="M0 650 C360 510 520 790 870 620 S1320 510 1600 680 V900 H0Z" fill="#52796F" opacity=".72"/><text x="120" y="250" font-family="Georgia" font-size="88" fill="#20302D">看见日常</text><text x="128" y="325" font-family="Arial" font-size="28" fill="#4F625C">Everyday moments, gently remembered.</text><text x="128" y="770" font-family="Arial" font-size="22" fill="#FFFFFF">星澜产品短片 · 虚构演示封面</text></svg>`
await sharp(Buffer.from(videoCover)).png().toFile(join(outputDir, 'video-campaign-cover.png'))

await writeFile(join(outputDir, 'rag-evaluation-results.csv'), 'case_id,scenario,answer_score,citation_score,latency_ms\nRAG-001,policy lookup,4.8,1.0,1840\nRAG-002,multi-hop question,4.2,0.9,2360\nRAG-003,conflicting sources,3.7,0.8,2110\nRAG-004,no-answer boundary,4.6,1.0,1620\n')
await writeFile(join(outputDir, 'membership-redesign-prd.md'), '# 企业会员权益改版 PRD\n\n> 本文档及其中全部组织、人物和数据均为 Giverny 演示用途的虚构内容。\n\n## 目标\n\n降低新企业管理员理解权益的成本，并提高试用期内完成团队邀请的比例。\n\n## 核心范围\n\n- 权益信息架构重组\n- 套餐差异对比\n- 到期与用量提醒\n- 管理员邀请引导\n\n## 验收指标\n\n试用期团队邀请完成率提升 12%，套餐咨询工单下降 15%。\n')
await writeFile(join(outputDir, 'activation-campaign-plan.md'), '# 新用户七日激活计划\n\n虚构演示方案。围绕首次创建、首次协作和首次回顾三个关键动作设计分层触达，并设置对照组验证增量。\n')
await writeFile(join(outputDir, 'permission-service-api.md'), '# Permission Service API Notes\n\nDemo-only technical note. Covers scoped roles, audit events, idempotent writes, and workspace isolation tests.\n')

process.stdout.write(`已生成演示附件：${outputDir}\n`)
