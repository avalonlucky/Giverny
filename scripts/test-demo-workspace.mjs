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
  sql("INSERT INTO auth_sessions (id, token_hash, role, principal_id, workspace_id, expires_at) VALUES ('old-public-demo', 'old-demo-hash', 'viewer', 'demo-viewer', 'demo', '2099-01-01 00:00:00')")
  sql("INSERT INTO auth_sessions (id, token_hash, role, principal_id, workspace_id, expires_at) VALUES ('private-demo', 'private-demo-hash', 'demo', 'demo-viewer', 'demo', '2099-01-01 00:00:00')")
  execFileSync('sqlite3', [database], { input: migration })
  execFileSync('sqlite3', [database], { input: migration })
  sql("INSERT INTO tasks (id, workspace_id, title, status) VALUES ('demo-user-created', 'demo', '演示账号自建任务', '进行中')")
  sql("INSERT INTO agent_task_memories (task_id, workspace_id, task_title, summary) VALUES ('860000001', 'demo', '企业会员权益改版', '已生成演示记忆')")
  sql("INSERT INTO agent_proactive_items (id, workspace_id, task_id, task_title, signal_type, dedupe_key, title) VALUES ('demo-proactive-test', 'demo', '860000001', '企业会员权益改版', 'deadline', 'demo-migration-fk', '演示主动提醒')")
  sql("INSERT INTO task_updates (id, task_id, update_date, title, body) VALUES ('demo-user-update', '860000001', '2026-07-27 10:00', '演示账号自建进展', '这条记录不得被种子迁移删除')")
  sql("INSERT INTO attachments (id, task_id, attachment_scope, file_name, r2_key) VALUES ('demo-user-file', '860000001', 'progress', '演示账号自传附件.txt', 'uploads/demo/demo-user-file.txt')")
  sql("INSERT INTO attachment_analyses (attachment_id, task_id, status, summary) VALUES ('demo-user-file', '860000001', 'completed', '用户附件分析已完成')")
  execFileSync('sqlite3', [database], { input: migration })

  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id = 'demo'"), '17', '重复初始化不得重复种子任务或删除用户自建任务')
  assert.equal(sql("SELECT title FROM tasks WHERE id = 'demo-user-created'"), '演示账号自建任务', '演示账号自建任务必须保留')
  assert.equal(sql("SELECT summary FROM agent_task_memories WHERE task_id = '860000001'"), '已生成演示记忆', '迁移不得破坏 Agent 任务记忆外键')
  assert.equal(sql("SELECT title FROM agent_proactive_items WHERE id = 'demo-proactive-test'"), '演示主动提醒', '迁移不得破坏 Agent 主动信号外键')
  assert.equal(sql("SELECT title FROM task_updates WHERE id = 'demo-user-update'"), '演示账号自建进展', '演示账号自建进展必须保留')
  assert.equal(sql("SELECT file_name FROM attachments WHERE id = 'demo-user-file'"), '演示账号自传附件.txt', '演示账号自传附件必须保留')
  assert.equal(sql("SELECT summary FROM attachment_analyses WHERE attachment_id = 'demo-user-file'"), '用户附件分析已完成', '演示账号自传附件分析必须保留')
  assert.equal(sql("SELECT count(DISTINCT design_type) FROM tasks WHERE workspace_id = 'demo'"), '8', '必须覆盖八类岗位')
  assert.equal(sql("SELECT count(*) FROM task_updates WHERE CAST(id AS INTEGER) BETWEEN 861000001 AND 861000016"), '16')
  assert.equal(sql("SELECT count(*) FROM attachments WHERE CAST(id AS INTEGER) BETWEEN 862000001 AND 862000011"), '11')
  assert.equal(sql("SELECT count(*) FROM attachment_analyses WHERE status = 'completed' AND CAST(attachment_id AS INTEGER) BETWEEN 862000001 AND 862000011"), '11', '演示附件必须预置完成态理解')
  assert.equal(sql("SELECT role FROM workspace_memberships WHERE workspace_id = 'demo' AND principal_id = 'demo-viewer'"), 'demo')
  assert.equal(sql("SELECT count(*) FROM auth_sessions WHERE id = 'old-public-demo'"), '0', '旧公开演示会话必须注销')
  assert.equal(sql("SELECT role FROM auth_sessions WHERE id = 'private-demo'"), 'demo', '新版独立演示账号会话必须保留')
  assert.equal(sql("SELECT title FROM tasks WHERE id = 'real-sentinel'"), '真实空间哨兵', '演示初始化不能修改真实任务')
  assert.equal(sql("SELECT value FROM app_settings WHERE key = 'demo-test-real-amount'"), '918273.45', '演示初始化不能修改真实金额')
  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id != 'demo' AND id LIKE '860%'"), '0')

  const assetNames = migration.match(/demo-static\/[^'\s]+/g)?.map((value) => value.slice('demo-static/'.length)) ?? []
  assert.ok(assetNames.length >= 10, '演示空间应包含足够的多类型附件')
  assetNames.forEach((name) => assert.ok(existsSync(join(root, 'public/demo-assets', name)), `缺少演示附件 ${name}`))

  assert.match(worker, /workspaceId: row\.workspace_id \|\| DEFAULT_WORKSPACE_ID/, '访问口令必须保留 workspace_id')
  assert.match(worker, /normalizedEmail === DEMO_PRINCIPAL_EMAIL[\s\S]+role: 'demo'[\s\S]+workspaceId: DEMO_WORKSPACE_ID/, '演示账号必须使用独立邮箱密码并固定到 demo 工作区')
  assert.doesNotMatch(worker, /path === '\/api\/auth\/demo'/, '不得保留公开一键演示接口')
  assert.match(worker, /role === 'demo' && \(isCollaboratorWritablePath/, '演示账号必须能写入演示任务和附件')
  assert.match(worker, /role === 'demo' && isDemoAgentRuntimePath/, '演示账号必须能使用 Agent 运行链路')
  assert.match(worker, /normalizedEmail === DEMO_PRINCIPAL_EMAIL[\s\S]+verifyAdminPassword\(env, trimmedKey\)[\s\S]+role: 'demo'/, '演示账号必须直接使用当前管理员密码')
  assert.doesNotMatch(worker, /demoAccountPasswordHash|\/api\/auth\/demo-password/, '不得再保留独立演示密码或额外配置接口')
  assert.match(worker, /if \(!principal\) \{[\s\S]+tasks: \[\][\s\S]+workspace: \{ id: 'anonymous', demo: false \}/, '未登录状态不得读取真实默认工作区')
  assert.match(stateCache, /if \(!window\.localStorage\.getItem\(AUTH_STORAGE_KEY\)\)/, '未登录首屏不得恢复真实工作区缓存')
  assert.match(worker, /workspaceId: row\.workspace_id \|\| DEFAULT_WORKSPACE_ID/, '会话主体不得回退到错误工作区')
  assert.match(worker, /uploads\/\$\{workspaceId\}/, '新附件 R2 路径必须带工作区前缀')
  assert.match(worker, /String\(match\.metadata\?\.workspaceId \|\| DEFAULT_WORKSPACE_ID\) === workspaceId/, '向量搜索必须按工作区过滤')

  process.stdout.write('演示账号隔离测试通过：身份、任务、金额、附件、R2 路径与向量检索均按工作区隔离。\n')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
