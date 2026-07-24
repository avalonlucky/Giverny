import { readFileSync, readdirSync } from 'node:fs'
import process from 'node:process'

const modules = [
  'tokens-theme.css',
  'shell-navigation.css',
  'dashboard-tasks.css',
  'task-management.css',
  'files-previews.css',
  'modals-core.css',
  'task-forms.css',
  'chat.css',
  'settings.css',
  'calendar-insights.css',
  'business-reports.css',
  'progress-responsive.css',
  'knowledge-ai.css',
]
const maxModuleLines = 4500
const expectedEntry = `${modules.map((name) => `@import './styles/${name}';`).join('\n')}\n`
const failures = []

if (readFileSync('src/App.css', 'utf8') !== expectedEntry) {
  failures.push('src/App.css 只能保留规定顺序的样式域导入')
}

const actualModules = readdirSync('src/styles').filter((name) => name.endsWith('.css')).sort()
const expectedModules = [...modules].sort()
if (actualModules.join('\n') !== expectedModules.join('\n')) {
  failures.push('src/styles 的 CSS 模块清单与架构约定不一致')
}

for (const name of modules) {
  const source = readFileSync(`src/styles/${name}`, 'utf8')
  const lineCount = source.split(/\r?\n/).length
  if (lineCount > maxModuleLines) failures.push(`${name} 已达 ${lineCount} 行，超过 ${maxModuleLines} 行上限`)
  if (/^\s*@import\b/m.test(source)) failures.push(`${name} 不允许继续嵌套 @import`)
}

if (!readFileSync('src/styles/tokens-theme.css', 'utf8').includes(':root {')) {
  failures.push('tokens-theme.css 缺少全站 :root token')
}

if (failures.length > 0) {
  console.error(`CSS 架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`CSS 架构守卫通过：App.css 仅保留入口，${modules.length} 个有序样式域，单域不超过 ${maxModuleLines} 行。`)
