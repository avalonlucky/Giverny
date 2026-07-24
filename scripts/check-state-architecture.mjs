import { readFileSync } from 'node:fs'
import process from 'node:process'

const stateOwners = [
  'src/stores/authStore.ts',
  'src/stores/taskStore.ts',
  'src/stores/taskRuntimeStore.ts',
  'src/stores/fileStore.ts',
  'src/stores/settingsStore.ts',
  'src/stores/uiStore.ts',
]
const orchestrationFiles = ['src/App.tsx', 'src/hooks/useWorkspaceData.ts']
const failures = []

for (const file of stateOwners) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes("from 'zustand'")) failures.push(`${file} 未使用 Zustand`)
}

for (const file of orchestrationFiles) {
  const source = readFileSync(file, 'utf8')
  if (/\buse(?:State|Reducer)\s*\(/.test(source)) {
    failures.push(`${file} 不应重新持有跨视图或服务端实体状态`)
  }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
if (!packageJson.dependencies?.zustand) failures.push('package.json 缺少 Zustand 运行依赖')

if (failures.length > 0) {
  console.error(`状态架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(`状态架构守卫通过：${stateOwners.length} 个业务域 store，App 与工作区编排层无 useState/useReducer。`)
