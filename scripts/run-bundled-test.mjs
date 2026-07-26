import { build } from 'esbuild'
import process from 'node:process'

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
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
