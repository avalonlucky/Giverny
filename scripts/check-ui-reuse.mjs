import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const sourceDirs = ['src']
const sourceExtensions = new Set(['.tsx', '.ts', '.jsx', '.js', '.html'])

const checks = [
  {
    name: '日期时间控件必须复用 PlanDateTimeField',
    pattern: /<input\b[^>]*\btype\s*=\s*(?:"(?:date|time|month|datetime-local)"|'(?:date|time|month|datetime-local)'|\{\s*['"](?:date|time|month|datetime-local)['"]\s*\})/g,
    message: '发现浏览器原生日期/时间输入。请改用 PlanDateTimeField；纯日期传 includeTime={false}。',
  },
  {
    name: '禁止浏览器原生弹窗',
    pattern: /\bwindow\.(alert|confirm|prompt)\s*\(/g,
    message: '发现 window.alert/confirm/prompt。请复用站内 toast、ConfirmDialog 或 ModalShell。',
  },
]

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'src/baml_client'].includes(entry.name)) return []
      return walk(fullPath)
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

const files = sourceDirs.flatMap((dir) => walk(path.join(root, dir)))
const violations = []

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split(/\r?\n/)
  for (const check of checks) {
    check.pattern.lastIndex = 0
    let match
    while ((match = check.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split(/\r?\n/).length
      const column = match.index - content.lastIndexOf('\n', match.index - 1)
      violations.push({
        check: check.name,
        message: check.message,
        file: path.relative(root, file),
        line,
        column,
        snippet: lines[line - 1]?.trim() ?? '',
      })
    }
  }
}

if (violations.length > 0) {
  console.error('\nUI 复用守卫未通过：')
  for (const violation of violations) {
    console.error(`\n- ${violation.check}`)
    console.error(`  ${violation.file}:${violation.line}:${violation.column}`)
    console.error(`  ${violation.message}`)
    console.error(`  ${violation.snippet}`)
  }
  console.error('\n请先复用现有组件或补充明确例外，再继续提交。')
  process.exit(1)
}

console.log(`UI 复用守卫通过：检查 ${files.length} 个源码文件，未发现原生日期时间控件或浏览器弹窗。`)
