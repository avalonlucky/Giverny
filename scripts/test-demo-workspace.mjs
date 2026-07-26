import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = process.cwd()
const worker = readFileSync(join(root, 'src/worker.ts'), 'utf8')
const stateCache = readFileSync(join(root, 'src/lib/stateCache.ts'), 'utf8')
const migration = readFileSync(join(root, 'db/migrations/0038_demo_workspace.sql'), 'utf8')
const tempDir = mkdtempSync(join(tmpdir(), 'giverny-demo-test-'))
const database = join(tempDir, 'demo.sqlite')

function sql(query) {
  return execFileSync('sqlite3', [database, query], { encoding: 'utf8' }).trim()
}

try {
  execFileSync('sqlite3', [database], { input: readFileSync(join(root, 'db/schema.sql')) })
  sql("INSERT INTO tasks (id, workspace_id, title, status) VALUES ('real-sentinel', 'default', '真实空间哨兵', '进行中')")
  sql("INSERT INTO app_settings (key, value) VALUES ('demo-test-real-amount', '918273.45')")
  execFileSync('sqlite3', [database], { input: migration })
  execFileSync('sqlite3', [database], { input: migration })

  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id = 'demo'"), '16', '演示任务必须幂等')
  assert.equal(sql("SELECT count(DISTINCT design_type) FROM tasks WHERE workspace_id = 'demo'"), '8', '必须覆盖八类岗位')
  assert.equal(sql("SELECT count(*) FROM task_updates WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id = 'demo')"), '16')
  assert.equal(sql("SELECT count(*) FROM attachments WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id = 'demo')"), '11')
  assert.equal(sql("SELECT title FROM tasks WHERE id = 'real-sentinel'"), '真实空间哨兵', '演示初始化不能修改真实任务')
  assert.equal(sql("SELECT value FROM app_settings WHERE key = 'demo-test-real-amount'"), '918273.45', '演示初始化不能修改真实金额')
  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id != 'demo' AND id LIKE '860%'"), '0')

  const assetNames = migration.match(/demo-static\/[^'\s]+/g)?.map((value) => value.slice('demo-static/'.length)) ?? []
  assert.ok(assetNames.length >= 10, '演示空间应包含足够的多类型附件')
  assetNames.forEach((name) => assert.ok(existsSync(join(root, 'public/demo-assets', name)), `缺少演示附件 ${name}`))

  assert.match(worker, /workspaceId: row\.workspace_id \|\| DEFAULT_WORKSPACE_ID/, '访问口令必须保留 workspace_id')
  assert.match(worker, /role: 'viewer'[\s\S]+workspaceId: DEMO_WORKSPACE_ID/, '演示会话必须固定为只读 viewer')
  assert.match(worker, /path === '\/api\/auth\/demo'/, '必须注册演示登录接口')
  assert.match(worker, /if \(!principal\) \{[\s\S]+tasks: \[\][\s\S]+workspace: \{ id: 'anonymous', demo: false \}/, '未登录状态不得读取真实默认工作区')
  assert.match(stateCache, /if \(!window\.localStorage\.getItem\(AUTH_STORAGE_KEY\)\)/, '未登录首屏不得恢复真实工作区缓存')
  assert.match(worker, /workspaceId: row\.workspace_id \|\| DEFAULT_WORKSPACE_ID/, '会话主体不得回退到错误工作区')
  assert.match(worker, /uploads\/\$\{workspaceId\}/, '新附件 R2 路径必须带工作区前缀')
  assert.match(worker, /String\(match\.metadata\?\.workspaceId \|\| DEFAULT_WORKSPACE_ID\) === workspaceId/, '向量搜索必须按工作区过滤')

  process.stdout.write('演示账号隔离测试通过：身份、任务、金额、附件、R2 路径与向量检索均按工作区隔离。\n')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
