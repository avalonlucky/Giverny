import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const srcRoot = join(root, 'src')
const failures = []
const bannedClasses = [
  'calendar-empty-hint', 'knowledge-empty', 'alice-model-empty', 'chat-history-empty',
  'hour-learning-empty', 'income-empty', 'insight-tree-empty', 'cp-empty', 'local-cli-empty',
  'command-empty', 'provider-model-empty', 'shared-project-empty-file',
  'dashboard-task-sidebar-empty', 'file-inspector-empty',
]

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return name.endsWith('.tsx') ? [path] : []
  })
}

function filesWithExtension(directory, extension) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return filesWithExtension(path, extension)
    return name.endsWith(extension) ? [path] : []
  })
}

const sources = sourceFiles(srcRoot).map((path) => ({ path, projectPath: relative(root, path), source: readFileSync(path, 'utf8') }))
let emptyStateUsages = 0
const coveredFiles = new Set()

for (const { projectPath, source } of sources) {
  emptyStateUsages += source.match(/<EmptyState\b/g)?.length ?? 0
  if (source.includes('<EmptyState')) coveredFiles.add(projectPath)
  for (const className of bannedClasses) {
    if (source.includes(className)) failures.push(`${projectPath} 仍使用旧空状态类 ${className}`)
  }
  const directEmptyCopy = /<(?:p|div|em)\b[^>]*>[^<{\n]*(?:暂无|还没有|没有找到|无结果|当前[^<{\n]*没有)[^<{\n]*<\/(?:p|div|em)>/g
  if (directEmptyCopy.test(source)) failures.push(`${projectPath} 直接手写无数据文案，请复用 EmptyState`)
}

const requiredCoverage = [
  'src/views/DashboardView.tsx',
  'src/views/TasksView.tsx',
  'src/views/FilesView.tsx',
  'src/views/InsightsView.tsx',
  'src/views/IncomeView.tsx',
  'src/views/KnowledgeView.tsx',
  'src/views/SettingsView.tsx',
  'src/components/ChatPanel.tsx',
  'src/components/DashboardTaskSidebar.tsx',
  'src/components/AiOperationsCenterPanel.tsx',
]
for (const path of requiredCoverage) {
  if (!coveredFiles.has(path)) failures.push(`${path} 未接入共享 EmptyState`)
}
if (emptyStateUsages < 40) failures.push(`共享 EmptyState 仅使用 ${emptyStateUsages} 处，低于全站收口基线 40 处`)

const component = readFileSync('src/components/EmptyState.tsx', 'utf8')
for (const variant of ['feature', 'panel', 'compact', 'inline']) {
  if (!component.includes(`'${variant}'`)) failures.push(`EmptyState 缺少 ${variant} 密度层级`)
}
if (!component.includes('empty-state-lily')) failures.push('主要空状态缺少睡莲视觉')

const emptyStateStyles = readFileSync('src/styles/task-management.css', 'utf8')
const allStyles = filesWithExtension(join(srcRoot, 'styles'), '.css')
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')
if (!emptyStateStyles.includes('@media (prefers-reduced-motion: reduce)')) failures.push('空状态动画未尊重减少动态效果设置')
if (!emptyStateStyles.includes('.empty-state-feature') || !emptyStateStyles.includes('.empty-state-inline')) failures.push('空状态密度样式不完整')
for (const className of bannedClasses) {
  const cssClass = new RegExp(`\\.${className}\\b`)
  if (cssClass.test(allStyles)) failures.push(`样式域仍保留旧空状态选择器 .${className}`)
}

if (failures.length > 0) {
  console.error(`空状态架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`空状态架构守卫通过：${coveredFiles.size} 个页面/组件、${emptyStateUsages} 处空状态统一复用四级 EmptyState。`)
