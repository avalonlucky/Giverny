export const importedMonthlyHours = 0

// 试运营后统计只读取 D1 正式任务数据；历史线下工时不再硬编码进前端。
export const importedHoursMonth = '2026-05'

export const appVersion = '0.11.21'
export const appReleaseDate = '2026-06-20 00:45'
export const appReleaseStage = '试运营'

export const defaultHourlyRate = 300
export const defaultPdfTitle = '设计服务工时结算回单'
export const defaultServiceCompanyName = '昂楷科技'

export type DesignTypeGroup = {
  name: string
  items: string[]
}

export const defaultDesignTypeGroups: DesignTypeGroup[] = [
  { name: '展会类', items: ['邀请函长图', '展会物料', '易拉宝', '展板', '导视牌'] },
  { name: '品牌类', items: ['VI / 品牌物料', '名片', '授权牌', '桌牌', '画册'] },
  { name: '传播类', items: ['海报', '单页 / 折页', '官网 banner', '公众号长图', '销售 P 图'] },
  { name: '文档类', items: ['PPT', '方案排版', 'Word 美化'] },
]

export const defaultDesignTypes = defaultDesignTypeGroups.flatMap((group) => group.items)
