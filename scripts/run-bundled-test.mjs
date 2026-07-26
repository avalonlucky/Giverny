import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const entry = process.argv[2]
if (!entry) throw new Error('缺少 TypeScript 测试入口')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  write: false,
  logLevel: 'silent',
})
const source = result.outputFiles[0]?.text
if (!source) throw new Error('测试打包未生成产物')
const outputPath = `/tmp/giverny-bundled-test-${process.pid}-${Date.now()}.mjs`
try {
  await writeFile(outputPath, source)
  await import(pathToFileURL(outputPath).href)
} finally {
  await unlink(outputPath).catch(() => undefined)
}
