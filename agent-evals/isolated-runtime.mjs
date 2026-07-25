import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Log, LogLevel, Miniflare } from 'miniflare'

const root = fileURLToPath(new URL('../', import.meta.url))
const schemaPath = join(root, 'db', 'schema.sql')
const fixturePath = join(root, 'agent-evals', 'fixture.sql')
const assetsPath = join(root, 'dist')

const defaultBindings = {
  ADMIN_TOKEN: 'eval-admin-key',
  LOCAL_DEV: '1',
  AGENT_TOOL_TOKEN: 'eval-agent-tool-token',
  DEEPSEEK_API_KEY: 'eval-model-key',
  DOUBAO_API_KEY: 'eval-doubao-key',
  DOUBAO_MODEL: 'doubao-seed-eval',
}

async function bundleWorker(outputPath) {
  await build({
    entryPoints: [join(root, 'src', 'worker.ts')],
    outfile: outputPath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'],
    mainFields: ['module', 'main'],
    alias: { exceljs: 'exceljs/dist/exceljs.min.js' },
    external: ['cloudflare:*'],
    keepNames: true,
    sourcemap: false,
    logLevel: 'warning',
  })
}

function splitSqlStatements(source) {
  const statements = []
  let current = ''
  let quote = ''
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (character === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (!quote && character === '-' && next === '-') {
      lineComment = true
      index += 1
      continue
    }
    if (!quote && character === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (quote) {
      current += character
      if (character === quote) {
        if (next === quote) {
          current += next
          index += 1
        } else {
          quote = ''
        }
      }
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      current += character
      continue
    }
    if (character === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      continue
    }
    current += character
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

async function seedDatabase(miniflare) {
  const database = await miniflare.getD1Database('DB')
  try {
    for (const path of [schemaPath, fixturePath]) {
      const statements = splitSqlStatements(await readFile(path, 'utf8'))
      for (const statement of statements) await database.exec(statement.replace(/\r?\n/g, ' '))
    }
  } finally {
    const dispose = database[Symbol.asyncDispose] || database[Symbol.dispose]
    if (dispose) await dispose.call(database)
  }
}

export async function createIsolatedRuntime({
  appPort,
  modelPort,
  prefix = 'giverny-eval-',
  persistPath,
  seed = true,
} = {}) {
  if (!Number.isInteger(appPort) || appPort <= 0) throw new Error('Isolated runtime requires a valid appPort')
  if (!Number.isInteger(modelPort) || modelPort <= 0) throw new Error('Isolated runtime requires a valid modelPort')
  if (!existsSync(join(assetsPath, 'index.html'))) throw new Error('dist is missing; run npm run build before isolated evaluation')

  const ownedPersistPath = !persistPath
  const storageRoot = persistPath || await mkdtemp(join(tmpdir(), prefix))
  await writeFile(join(storageRoot, '.metadata_never_index'), '')
  const workerBundlePath = join(storageRoot, 'worker.mjs')
  await bundleWorker(workerBundlePath)

  let miniflare
  const start = async (shouldSeed) => {
    miniflare = new Miniflare({
      host: '127.0.0.1',
      port: appPort,
      log: new Log(LogLevel.ERROR, { prefix: 'giverny-eval' }),
      modules: true,
      script: await readFile(workerBundlePath, 'utf8'),
      compatibilityDate: '2026-06-10',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        ...defaultBindings,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${modelPort}`,
        DOUBAO_BASE_URL: `http://127.0.0.1:${modelPort}`,
        GIVERNY_API_BASE_URL: `http://127.0.0.1:${appPort}`,
      },
      d1Databases: { DB: '00000000-0000-0000-0000-000000000015' },
      d1Persist: join(storageRoot, 'd1'),
      r2Buckets: { UPLOADS: 'giverny-agent-eval-uploads' },
      r2Persist: join(storageRoot, 'r2'),
      durableObjects: { ALICE_AGENT: { className: 'AliceAgent', useSQLite: true } },
      durableObjectsPersist: join(storageRoot, 'durable-objects'),
      workflows: {
        AGENT_WRITE_WORKFLOW: { name: 'giverny-agent-write-eval', className: 'AgentWriteWorkflow' },
        AGENT_ANALYSIS_WORKFLOW: { name: 'giverny-agent-analysis-eval', className: 'AgentAnalysisWorkflow' },
      },
      workflowsPersist: join(storageRoot, 'workflows'),
      assets: {
        directory: assetsPath,
        binding: 'ASSETS',
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
        assetConfig: { not_found_handling: 'single-page-application' },
      },
    })
    await miniflare.ready
    if (shouldSeed) await seedDatabase(miniflare)
  }

  try {
    await start(seed)
  } catch (error) {
    await miniflare?.dispose().catch(() => undefined)
    if (ownedPersistPath) await rm(storageRoot, { recursive: true, force: true })
    throw error
  }

  let disposed = false
  return {
    url: `http://127.0.0.1:${appPort}`,
    persistPath: storageRoot,
    async restart() {
      if (disposed) throw new Error('Cannot restart a disposed isolated runtime')
      await miniflare.dispose()
      await start(false)
    },
    async dispose() {
      if (disposed) return
      disposed = true
      await miniflare.dispose().catch(() => undefined)
      if (ownedPersistPath) await rm(storageRoot, { recursive: true, force: true })
    },
  }
}
