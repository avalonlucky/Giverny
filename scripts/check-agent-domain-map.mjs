import { readFileSync } from 'node:fs'
import { agentDomainMap, agentDomainManifest, agentUndomainedOperations } from '../src/agentDomainMap.ts'
import { agentCapabilityRegistry } from '../src/agentToolRegistry.ts'

const fail = (message) => {
  console.error(`Agent 领域地图架构守卫失败：${message}`)
  process.exit(1)
}

const app = readFileSync('src/App.tsx', 'utf8')
const domainTypes = readFileSync('src/types/domain.ts', 'utf8')
const worker = readFileSync('src/worker.ts', 'utf8')
const runtimeDomain = readFileSync('agent-runtime/app/domain.py', 'utf8')
const runtime = readFileSync('agent-runtime/app/runtime.py', 'utf8')
const agents = readFileSync('agent-runtime/app/agents.py', 'utf8')
const sources = { 'src/types/domain.ts': domainTypes, 'src/worker.ts': worker }

const manifest = agentDomainManifest()
const names = manifest.map((item) => item.domain)

// ── 1. 每个导航都必须被描述 ────────────────────────────────────────────────
// Record<AppView, …> 已经保证类型层面的穷尽，这里补的是另一头：
// 导航条上真实渲染的项，一个都不能在地图里缺席。
const navBlock = app.slice(app.indexOf('const navItems = ['))
const navLabels = [...navBlock.slice(0, navBlock.indexOf(']')).matchAll(/label: '([^']+)'/g)].map((match) => match[1])
if (navLabels.length < 7) fail(`只解析到 ${navLabels.length} 个导航项，导航定义结构可能已经变化`)
for (const label of navLabels) {
  if (!names.includes(label)) fail(`导航「${label}」没有出现在领域地图里，Agent 不知道站内有这块业务`)
}

// ── 2. 别名不得跨域重复 ────────────────────────────────────────────────────
// 同一个词指向两个领域时，确定性命中会同时返回两者，定域就失去意义了。
const aliasOwner = new Map()
for (const domain of manifest) {
  if (!domain.summary) fail(`${domain.domain} 缺少领域说明`)
  if (!domain.aliases.length) fail(`${domain.domain} 没有别名，用户说出口的词无法命中`)
  for (const alias of domain.aliases) {
    if (alias.length < 2) fail(`${domain.domain} 的别名「${alias}」太短，一定会误命中`)
    const owner = aliasOwner.get(alias)
    if (owner && owner !== domain.domain) fail(`别名「${alias}」同时属于 ${owner} 和 ${domain.domain}`)
    aliasOwner.set(alias, domain.domain)
  }
}

// ── 3. 字段名回源核对 ──────────────────────────────────────────────────────
// 地图里写的字段必须在源码里真实存在。字段改名而地图没跟上时，Agent 会拿着
// 一份过期的字段表去回答，这里让构建先失败。
const symbolBody = (text, symbol) => {
  const anchor = new RegExp(`(?:export type|const|export const|export function|function)\\s+${symbol}\\b`).exec(text)
  if (!anchor) return null
  let depth = 0
  let started = false
  for (let index = anchor.index; index < text.length; index += 1) {
    const character = text[index]
    if (character === '{') { depth += 1; started = true }
    else if (character === '}') {
      depth -= 1
      if (started && depth === 0) return text.slice(anchor.index, index + 1)
    }
  }
  return null
}

for (const [name, definition] of Object.entries(agentDomainMap)) {
  for (const object of definition.objects) {
    const text = sources[object.source.file]
    if (!text) fail(`${name}/${object.name} 引用了未纳入核对的源文件 ${object.source.file}`)
    const body = symbolBody(text, object.source.symbol)
    if (!body) fail(`${name}/${object.name} 的源码符号 ${object.source.symbol} 在 ${object.source.file} 里找不到`)
    if (!object.fields.length) fail(`${name}/${object.name} 没有列出任何字段`)
    for (const field of object.fields) {
      if (!new RegExp(`\\b${field.key}\\b`).test(body)) {
        fail(`${name}/${object.name} 的字段 ${field.key} 在 ${object.source.file} 的 ${object.source.symbol} 里已经不存在`)
      }
    }
  }
}

// ── 4. 地图只许指向只读工具 ────────────────────────────────────────────────
// 领域地图是"回答这类问题该查哪里"，不是"该改什么"。混进写工具，分析员会在
// 一个纯查询的问题上触发业务写入。
for (const [name, definition] of Object.entries(agentDomainMap)) {
  if (!definition.operations.length && !definition.unreadable) {
    fail(`${name} 既没有可用工具也没有写明读取边界，Agent 会一直换关键词搜下去`)
  }
  for (const operation of definition.operations) {
    const capability = agentCapabilityRegistry[operation]
    if (!capability) fail(`${name} 引用了不存在的工具 ${operation}`)
    if (capability.policy.risk !== 'read') fail(`${name} 引用了非只读工具 ${operation}（risk=${capability.policy.risk}）`)
  }
}

// ── 5. 每个只读工具都要有归属 ──────────────────────────────────────────────
// 反向核对：新增一个读工具却没有任何领域认领它，说明地图漏了一块业务。
const claimed = new Set(Object.values(agentDomainMap).flatMap((definition) => [...definition.operations]))
for (const [operation, capability] of Object.entries(agentCapabilityRegistry)) {
  if (capability.policy.risk !== 'read') continue
  if (!capability.exposure.includes('model')) continue
  if (claimed.has(operation)) continue
  const reason = agentUndomainedOperations[operation]
  if (!reason) fail(`只读工具 ${operation} 没有被任何领域认领，请把它归到对应领域，或在 agentUndomainedOperations 里写明为什么不属于任何领域`)
  if (reason.length < 10) fail(`${operation} 的免归属理由太短，等于没有解释`)
}
for (const operation of Object.keys(agentUndomainedOperations)) {
  if (!agentCapabilityRegistry[operation]) fail(`免归属名单里的 ${operation} 已经不是注册表里的工具`)
  if (claimed.has(operation)) fail(`${operation} 既被领域认领又列在免归属名单里`)
}

// ── 6. 跨语言字段契约 ──────────────────────────────────────────────────────
// TypeScript 发出的 JSON 和 Python 读的键名之间没有共享类型，只能在这里对齐。
// 少一个键不会报错，只会让 Agent 悄悄少看到一段领域知识——这是最难发现的那种坏法。
const manifestKeys = new Set(manifest.flatMap((item) => Object.keys(item)))
for (const key of ['domain', 'summary', 'aliases', 'specialist', 'unreadable', 'objects', 'operations']) {
  if (!manifestKeys.has(key)) fail(`领域清单缺少字段 ${key}`)
  if (!runtimeDomain.includes(`"${key}"`)) fail(`Runtime 没有读取领域清单的 ${key} 字段`)
}
const objectKeys = new Set(manifest.flatMap((item) => item.objects.flatMap((object) => Object.keys(object))))
const operationKeys = new Set(manifest.flatMap((item) => item.operations.flatMap((operation) => Object.keys(operation))))
for (const key of [...objectKeys, ...operationKeys]) {
  if (!runtimeDomain.includes(`"${key}"`)) fail(`Runtime 没有读取领域清单里的 ${key} 字段`)
}

// ── 7. 两端确实接上了 ──────────────────────────────────────────────────────
if (!worker.includes("'x-giverny-domains': agentDomainManifest()")) fail('OpenAPI 未下发领域地图')
if (!runtimeDomain.includes('x-giverny-domains')) fail('Runtime 未从 OpenAPI 读取领域地图')
if (!runtime.includes('DomainMap.from_spec(self.spec)')) fail('Runtime 未在启动时构建领域地图')
if (!runtime.includes('_apply_domain_routing(routing, self.domain_map, domain_hits)')) fail('编排未把领域判断落成专家可见性')
if (!runtime.includes('self.domain_map.render_playbook(routing.domain)')) fail('协调阶段未拿到单域说明')
if (!agents.includes('domain_map.render_catalog()')) fail('对象判断阶段未注入领域地图')
if (!agents.includes('<domain_map>')) fail('对象判断指令未说明如何使用领域地图')
if (!agents.includes('<domain_playbook>')) fail('专家指令未说明如何使用单域说明')
if (!runtime.includes('scrub_domain_tags(value)')) fail('推理出口未消毒领域标签，尖括号会漏进用户界面')

const doc = readFileSync('docs/AGENT_DOMAIN_MAP.md', 'utf8')
for (const name of names) {
  if (!doc.includes(name)) fail(`设计文档没有提到领域「${name}」`)
}

console.log(`Agent 领域地图守卫通过：${names.length} 个领域、${aliasOwner.size} 个别名、${claimed.size} 个归口只读工具`)
