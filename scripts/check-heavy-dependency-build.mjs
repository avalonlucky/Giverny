import { readFileSync, readdirSync } from 'node:fs'
import process from 'node:process'

const heavyChunkPattern = /\/(?:pdf(?:-worker)?|excel|canvas|psd|docx-preview|pptx-preview|archive|markdown)-[^/]+\.js$/
const html = readFileSync('dist/index.html', 'utf8')
const preloaded = [...html.matchAll(/<link\s+rel="modulepreload"\s+[^>]*href="([^"]+)"/g)].map((match) => match[1])
const failures = []

for (const href of preloaded) {
  if (heavyChunkPattern.test(href)) failures.push(`index.html 首屏预加载了 ${href}`)
}

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
const adminEntry = manifest['src/routes/AdminRoute.tsx']
const rootEntry = manifest['index.html']
if (!adminEntry) failures.push('构建 manifest 缺少后台路由入口')
if (!rootEntry) failures.push('构建 manifest 缺少 index.html 入口')

const assets = new Set(readdirSync('dist/assets'))
const heavyPrefixes = ['pdf-', 'pdf-worker-', 'excel-', 'canvas-', 'psd-', 'docx-preview-', 'pptx-preview-', 'archive-', 'markdown-']
for (const prefix of heavyPrefixes) {
  if (![...assets].some((name) => name.startsWith(prefix) && name.endsWith('.js'))) {
    failures.push(`构建产物缺少 ${prefix}*.js 独立 chunk`)
  }
}

const dynamicTargetFiles = new Set()
for (const entry of Object.values(manifest)) {
  for (const targetKey of entry.dynamicImports ?? []) {
    const targetFile = manifest[targetKey]?.file
    if (targetFile) dynamicTargetFiles.add(targetFile.split('/').pop() ?? '')
  }
}
for (const prefix of heavyPrefixes.filter((value) => value !== 'markdown-')) {
  if (![...dynamicTargetFiles].some((name) => name.startsWith(prefix))) {
    failures.push(`${prefix}*.js 未保持在用户触发后的动态加载链路`)
  }
}

const chatEntry = manifest['src/components/ChatPanel.tsx']
const chatImportFiles = (chatEntry?.imports ?? []).map((key) => manifest[key]?.file?.split('/').pop() ?? '')
if (!chatEntry?.isDynamicEntry || !chatImportFiles.some((name) => name.startsWith('markdown-'))) {
  failures.push('Markdown 未被限制在懒加载的工作助手入口')
}
if (![...assets].some((name) => name.startsWith('pdf.worker.min-') && name.endsWith('.mjs'))) {
  failures.push('PDF worker 资源未独立输出')
}

function collectStaticImports(entryKey, collected = new Set()) {
  if (!entryKey || collected.has(entryKey)) return collected
  collected.add(entryKey)
  const entry = manifest[entryKey]
  for (const importedKey of entry?.imports ?? []) collectStaticImports(importedKey, collected)
  return collected
}

const dashboardClosure = new Set([
  ...collectStaticImports('index.html'),
  ...collectStaticImports('src/routes/AdminRoute.tsx'),
])
for (const key of dashboardClosure) {
  const file = manifest[key]?.file ?? ''
  const baseName = file.split('/').pop() ?? ''
  if (heavyPrefixes.some((prefix) => baseName.startsWith(prefix))) {
    failures.push(`Dashboard 静态依赖闭包包含重依赖 ${file}`)
  }
}

if (failures.length > 0) {
  console.error(`重依赖构建守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`重依赖构建守卫通过：首屏 ${preloaded.length} 个 preload 与 Dashboard ${dashboardClosure.size} 个静态 chunk 均不含重依赖，8 类文档运行时均可按需到达。`)
