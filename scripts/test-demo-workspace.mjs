import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = process.cwd()
const worker = readFileSync(join(root, 'src/worker.ts'), 'utf8')
const schema = readFileSync(join(root, 'db/schema.sql'), 'utf8')
const stateCache = readFileSync(join(root, 'src/lib/stateCache.ts'), 'utf8')
const appConfig = readFileSync(join(root, 'src/config/appConfig.ts'), 'utf8')
const draftCache = readFileSync(join(root, 'src/lib/newTaskDraftCache.ts'), 'utf8')
const newTaskModal = readFileSync(join(root, 'src/components/NewTaskModal.tsx'), 'utf8')
const taskPresentation = readFileSync(join(root, 'src/lib/taskListPresentation.ts'), 'utf8')
const migration = readFileSync(join(root, 'db/migrations/0038_demo_workspace.sql'), 'utf8')
const isolationMigration = readFileSync(join(root, 'db/migrations/0040_demo_workspace_isolation.sql'), 'utf8')
const sampleMigration = readFileSync(join(root, 'db/migrations/0041_demo_hour_estimate_samples.sql'), 'utf8')
const tempDir = mkdtempSync(join(tmpdir(), 'giverny-demo-test-'))
const database = join(tempDir, 'demo.sqlite')

function sql(query) {
  return execFileSync('sqlite3', [database, query], { encoding: 'utf8' }).trim()
}

try {
  execFileSync('sqlite3', [database], { input: schema })
  sql("INSERT INTO tasks (id, workspace_id, title, status) VALUES ('real-sentinel', 'default', '真实空间哨兵', '进行中')")
  sql("INSERT INTO app_settings (key, value) VALUES ('demo-test-real-amount', '918273.45')")
  sql("INSERT INTO auth_sessions (id, token_hash, role, principal_id, workspace_id, expires_at) VALUES ('old-public-demo', 'old-demo-hash', 'viewer', 'demo-viewer', 'demo', '2099-01-01 00:00:00')")
  sql("INSERT INTO auth_sessions (id, token_hash, role, principal_id, workspace_id, expires_at) VALUES ('private-demo', 'private-demo-hash', 'demo', 'demo-viewer', 'demo', '2099-01-01 00:00:00')")
  execFileSync('sqlite3', [database], { input: migration })
  execFileSync('sqlite3', [database], {
    input: isolationMigration.replace("ALTER TABLE hour_estimate_suggestions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';", ''),
  })
  execFileSync('sqlite3', [database], { input: sampleMigration })
  execFileSync('sqlite3', [database], { input: migration })
  sql("INSERT INTO tasks (id, workspace_id, title, status) VALUES ('demo-user-created', 'demo', '演示账号自建任务', '进行中')")
  sql("INSERT INTO agent_task_memories (task_id, workspace_id, task_title, summary) VALUES ('860000001', 'demo', '企业会员权益改版', '已生成演示记忆')")
  sql("INSERT INTO agent_proactive_items (id, workspace_id, task_id, task_title, signal_type, dedupe_key, title) VALUES ('demo-proactive-test', 'demo', '860000001', '企业会员权益改版', 'deadline', 'demo-migration-fk', '演示主动提醒')")
  sql("INSERT INTO task_updates (id, task_id, update_date, title, body) VALUES ('demo-user-update', '860000001', '2026-07-27 10:00', '演示账号自建进展', '这条记录不得被种子迁移删除')")
  sql("INSERT INTO attachments (id, task_id, attachment_scope, file_name, r2_key) VALUES ('demo-user-file', '860000001', 'progress', '演示账号自传附件.txt', 'uploads/demo/demo-user-file.txt')")
  sql("INSERT INTO attachment_analyses (attachment_id, task_id, status, summary) VALUES ('demo-user-file', '860000001', 'completed', '用户附件分析已完成')")
  execFileSync('sqlite3', [database], { input: migration })

  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id = 'demo'"), '33', '重复初始化不得重复种子任务、历史样本或删除用户自建任务')
  assert.equal(sql("SELECT title FROM tasks WHERE id = 'demo-user-created'"), '演示账号自建任务', '演示账号自建任务必须保留')
  assert.equal(sql("SELECT summary FROM agent_task_memories WHERE task_id = '860000001'"), '已生成演示记忆', '迁移不得破坏 Agent 任务记忆外键')
  assert.equal(sql("SELECT title FROM agent_proactive_items WHERE id = 'demo-proactive-test'"), '演示主动提醒', '迁移不得破坏 Agent 主动信号外键')
  assert.equal(sql("SELECT title FROM task_updates WHERE id = 'demo-user-update'"), '演示账号自建进展', '演示账号自建进展必须保留')
  assert.equal(sql("SELECT file_name FROM attachments WHERE id = 'demo-user-file'"), '演示账号自传附件.txt', '演示账号自传附件必须保留')
  assert.equal(sql("SELECT summary FROM attachment_analyses WHERE attachment_id = 'demo-user-file'"), '用户附件分析已完成', '演示账号自传附件分析必须保留')
  assert.ok(Number(sql("SELECT count(DISTINCT design_type) FROM tasks WHERE workspace_id = 'demo'")) >= 16, '演示空间必须覆盖八类岗位及其常见子类')
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
  assert.match(worker, /normalizedEmail === DEMO_PRINCIPAL_EMAIL[\s\S]+role: 'demo'[\s\S]+workspaceId: DEMO_WORKSPACE_ID/, '演示账号必须使用独立邮箱并固定到 demo 工作区')
  assert.doesNotMatch(worker, /path === '\/api\/auth\/demo'/, '不得保留公开一键演示接口')
  assert.match(worker, /role === 'demo' && \(isCollaboratorWritablePath/, '演示账号必须能写入演示任务和附件')
  assert.match(worker, /role === 'demo' && isDemoAgentRuntimePath/, '演示账号必须能使用 Agent 运行链路')
  assert.match(worker, /normalizedEmail === DEMO_PRINCIPAL_EMAIL[\s\S]+verifyAdminPassword\(env, trimmedKey\)[\s\S]+role: 'demo'/, '演示账号必须直接使用当前管理员密码')
  assert.doesNotMatch(worker, /demoAccountPasswordHash|\/api\/auth\/demo-password/, '不得再保留独立演示密码或额外配置接口')
  assert.match(worker, /designTypeGroups: isDemoWorkspace \? demoTaskTypeGroups : designTypeGroups/, '演示空间必须使用独立的多岗位任务分类')
  ;['产品经理', '用户运营', '数据分析', 'AI 研究员', 'HR / 人力资源', '程序员 / 开发', 'UI 设计', '影视传媒'].forEach((roleName) => {
    assert.ok(appConfig.includes(roleName), `演示任务分类缺少 ${roleName}`)
  })
  assert.match(draftCache, /newTaskDraftStorageKey\(scope = 'default'\)[\s\S]+`\$\{NEW_TASK_DRAFT_STORAGE_KEY\}:\$\{scope\}`/, '新建任务草稿必须按工作区隔离')
  assert.match(newTaskModal, /draftScope = demoMode \? 'demo' : 'default'[\s\S]+demoMode \? '' : '黄媚'/, '演示表单不得恢复正式站人员默认值')
  assert.match(newTaskModal, /demoMode \? '任务类型' : '设计类型'/, '演示表单必须使用跨行业任务类型口径')
  assert.match(worker, /if \(!principal\) \{[\s\S]+tasks: \[\][\s\S]+workspace: \{ id: 'anonymous', demo: false \}/, '未登录状态不得读取真实默认工作区')
  assert.match(stateCache, /auth\.role === cachedRole[\s\S]+auth\.role !== 'demo' \|\| cachedWorkspace\?\.id === 'demo'/, '启动缓存必须同时校验角色与演示工作区')
  assert.match(worker, /workspaceId: row\.workspace_id \|\| DEFAULT_WORKSPACE_ID/, '会话主体不得回退到错误工作区')
  assert.match(worker, /uploads\/\$\{workspaceId\}/, '新附件 R2 路径必须带工作区前缀')
  assert.match(worker, /String\(match\.metadata\?\.workspaceId \|\| DEFAULT_WORKSPACE_ID\) === workspaceId/, '向量搜索必须按工作区过滤')
  assert.match(worker, /getWorkspaceHourlyRate\(env, principal\.workspaceId\)/, 'Agent 结算必须使用当前工作区单价')
  assert.match(worker, /getWorkspaceReceiptIdentity\(env, workspaceId\)/, '回单快照必须使用当前工作区身份')
  assert.match(worker, /isDemoWorkspace[\s\S]+你是企业工作任务助理[\s\S]+不要引用平面设计项目、正式网站客户或其他工作区历史/, '演示任务 AI 必须使用独立的企业任务提示词')
  assert.match(worker, /WHERE context = 'hour_estimate' AND design_type = \? AND workspace_id = \?/, 'AI 工时采用偏好必须按工作区隔离')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS hour_estimate_suggestions \([\s\S]+workspace_id TEXT NOT NULL DEFAULT 'default'/, '新建数据库的工时建议表必须直接包含工作区字段')
  assert.match(isolationMigration, /ALTER TABLE hour_estimate_suggestions ADD COLUMN workspace_id/, '既有数据库迁移必须补充工时建议工作区字段')
  assert.match(taskPresentation, /normalizedType === item\.name \|\| normalizedType\.startsWith\(`\$\{item\.name\} \/ `\)/, '日历颜色必须同时识别含斜杠的岗位大类和子类')
  assert.equal(sql("SELECT requester FROM tasks WHERE id = '860000002'"), '许清河', '演示画像示例必须使用虚构需求人')
  assert.equal(sql("SELECT count(*) FROM tasks WHERE workspace_id = 'demo' AND CAST(id AS INTEGER) BETWEEN 860000001 AND 860000016 AND hourly_rate != 260"), '0', '演示种子任务单价必须统一为 260')
  assert.equal(sql("SELECT name FROM workspaces WHERE id = 'demo'"), 'Giverny 演示空间', '演示工作区名称不得暴露内部构造说明')
  ;['产品经理', '用户运营', '数据分析', 'AI 研究员', 'HR / 人力资源', '程序员 / 开发', 'UI 设计', '影视传媒'].forEach((roleName) => {
    assert.ok(Number(sql(`SELECT count(*) FROM tasks WHERE workspace_id = 'demo' AND status = '已验收' AND design_type LIKE '${roleName}%'`)) >= 3, `${roleName} 必须至少有 3 条已验收工时样本`)
  })
  assert.doesNotMatch(worker, /Giverny 多岗位协作结算回单/, '演示回单不得出现“多岗位协作”说明')

  process.stdout.write('演示账号隔离测试通过：身份、缓存、任务、金额、Agent、回单、附件、日历与向量检索均按工作区隔离。\n')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
