import { readFile } from 'node:fs/promises'

const limit = 1000
const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const lines = source.split('\n').length

if (lines > limit) {
  console.error(`App.tsx 架构守卫失败：当前 ${lines} 行，超过 ${limit} 行上限。请把新增状态或业务流程迁入独立 Hook / View。`)
  process.exit(1)
}

console.log(`App.tsx 架构守卫通过：${lines}/${limit} 行。`)
