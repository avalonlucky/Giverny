export const importedMonthlyHours = 0

// 试运营后统计只读取 D1 正式任务数据；历史线下工时不再硬编码进前端。
export const importedHoursMonth = '2026-05'

export const appVersion = '0.37.4'
export const appReleaseDate = '2026-08-11 18:43'
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

export const demoTaskTypeGroups: DesignTypeGroup[] = [
  { name: '产品经理', color: designTypeColorPalette[0], items: ['需求分析', 'PRD', '流程设计', '产品复盘'] },
  { name: '用户运营', color: designTypeColorPalette[1], items: ['用户增长', '活动运营', '召回实验', '内容运营'] },
  { name: '数据分析', color: designTypeColorPalette[2], items: ['数据报表', '漏斗分析', '留存分析', '经营分析'] },
  { name: 'AI 研究员', color: designTypeColorPalette[3], items: ['RAG 评测', '模型评测', '提示词实验', '知识库'] },
  { name: 'HR / 人力资源', color: designTypeColorPalette[4], items: ['招聘分析', '培训与融入', '绩效管理', '组织发展'] },
  { name: '程序员 / 开发', color: designTypeColorPalette[5], items: ['功能开发', 'API 与服务', '性能优化', '测试与质量'] },
  { name: 'UI 设计', color: designTypeColorPalette[6], items: ['Web 界面', 'App 界面', '设计系统', '交互原型'] },
  { name: '影视传媒', color: designTypeColorPalette[7], items: ['视频剪辑', '分镜脚本', '栏目包装', '短视频'] },
]

export const defaultDesignTypes = defaultDesignTypeGroups.flatMap((group) => group.items)
