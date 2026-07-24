import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const srcRoot = join(root, 'src')
const heavyPackages = [
  'pdfjs-dist',
  'exceljs',
  'html2canvas',
  'ag-psd',
  'docx-preview',
  'pptx-preview',
  'jszip',
  'react-markdown',
  'remark-gfm',
]
const excludedFiles = new Set(['src/worker.ts'])
const allowedStaticImports = new Map([
  ['react-markdown', new Set(['src/components/ChatContent.tsx'])],
  ['remark-gfm', new Set(['src/components/ChatContent.tsx'])],
])
const failures = []

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.[cm]?[jt]sx?$/.test(name) ? [path] : []
  })
}

for (const path of sourceFiles(srcRoot)) {
  const projectPath = relative(root, path)
  if (excludedFiles.has(projectPath) || projectPath.startsWith('src/generated/')) continue
  const source = readFileSync(path, 'utf8')
  for (const packageName of heavyPackages) {
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const staticImport = new RegExp(`(?:^|\\n)\\s*import\\s+(?!type\\b)(?!\\()[^\\n;]*?from\\s*['\"]${escaped}(?:/[^'\"]*)?['\"]|(?:^|\\n)\\s*import\\s*['\"]${escaped}(?:/[^'\"]*)?['\"]`, 'm')
    const requireCall = new RegExp(`\\brequire\\(\\s*['\"]${escaped}(?:/[^'\"]*)?['\"]\\s*\\)`)
    const isAllowedBoundary = allowedStaticImports.get(packageName)?.has(projectPath) ?? false
    if (!isAllowedBoundary && (staticImport.test(source) || requireCall.test(source))) {
      failures.push(`${projectPath} 静态加载 ${packageName}`)
    }
  }
}

const viteSource = readFileSync(join(root, 'vite.config.ts'), 'utf8')
for (const chunkName of ['pdf-worker', 'pdf', 'excel', 'canvas', 'psd', 'docx-preview', 'pptx-preview', 'archive', 'markdown']) {
  if (!viteSource.includes(`name: '${chunkName}'`)) failures.push(`vite.config.ts 缺少 ${chunkName} 独立分包`)
}
if (!viteSource.includes('manifest: true')) failures.push('vite.config.ts 未生成构建 manifest，无法校验首屏依赖闭包')
if (!viteSource.includes('includeDependenciesRecursively: false')) failures.push('vite.config.ts 未阻止重依赖分组吞并共享运行时')
if (!viteSource.includes('strictExecutionOrder: true')) failures.push('vite.config.ts 在精确分组模式下未保持模块执行顺序')

const pdfRuntimeSource = readFileSync(join(srcRoot, 'lib/pdfRuntime.ts'), 'utf8')
if (!pdfRuntimeSource.includes("import('pdfjs-dist')") || !pdfRuntimeSource.includes("import('pdfjs-dist/build/pdf.worker.min.mjs?url')")) {
  failures.push('PDF runtime 与 worker 未通过统一动态入口加载')
}

if (failures.length > 0) {
  console.error(`重依赖架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`重依赖架构守卫通过：${heavyPackages.length} 类浏览器重依赖均为按需加载，并具有稳定独立分包。`)
