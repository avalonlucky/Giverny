export const importedMonthlyHours = 0

// 试运营后统计只读取 D1 正式任务数据；历史线下工时不再硬编码进前端。
export const importedHoursMonth = '2026-05'

export const appVersion = '0.28.56'
export const appReleaseDate = '2026-07-16 23:30'
export const appReleaseStage = '试运营'

export const defaultHourlyRate = 300
export const defaultPdfTitle = '设计服务工时结算回单'
export const defaultServiceCompanyName = '昂楷科技'

export type DesignTypeGroup = {
  name: string
  color?: string
  items: string[]
}

export const designTypeColorPalette = [
  '#9f99d1',
  '#86bada',
  '#dbaad7',
  '#ffe3b3',
  '#c6e6e3',
  '#f6beb0',
  '#f5c8c4',
  '#f59c9a',
  '#ffbe98',
  '#c5dba9',
  '#81bfb7',
  '#ffd3dd',
  '#f0f9f8',
]

export const defaultDesignTypeGroups: DesignTypeGroup[] = [
  { name: '展会类', color: designTypeColorPalette[0], items: ['邀请函长图', '展会物料', '易拉宝', '展板', '导视牌'] },
  { name: '品牌类', color: designTypeColorPalette[1], items: ['VI / 品牌物料', '名片', '授权牌', '桌牌', '画册'] },
  { name: '传播类', color: designTypeColorPalette[2], items: ['海报', '单页 / 折页', '官网 banner', '公众号长图', '销售 P 图'] },
  { name: '文档类', color: designTypeColorPalette[3], items: ['PPT', '方案排版', 'Word 美化'] },
  { name: '活动类', color: designTypeColorPalette[4], items: ['活动主视觉', '活动长图', '邀请海报', '流程图', '现场物料'] },
]

export const defaultDesignTypes = defaultDesignTypeGroups.flatMap((group) => group.items)
