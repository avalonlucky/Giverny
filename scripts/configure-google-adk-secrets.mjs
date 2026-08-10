import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cloudflareAccountRequest, loadCloudflareToken } from './lib/cloudflare-api.mjs'

const project = process.env.GIVERNY_GCP_PROJECT || 'gen-lang-client-0555511340'
const workerName = 'designer-worklog'
const toolSecretName = 'giverny-agent-tool-token'
const runtimeSecretName = 'giverny-adk-runtime-key'
const serviceAccountName = 'giverny-adk-runtime'
const serviceAccount = `${serviceAccountName}@${project}.iam.gserviceaccount.com`
const runtimeUrl = process.env.GIVERNY_ADK_URL || 'https://giverny-adk-runtime-821326826147.asia-east1.run.app'

function gcloud(args, options = {}) {
  return execFileSync('gcloud', [...args, `--project=${project}`], {
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function secretExists(name) {
  try {
    gcloud(['secrets', 'describe', name])
    return true
  } catch {
    return false
  }
}

function putSecret(name, value) {
  if (secretExists(name)) {
    gcloud(['secrets', 'versions', 'add', name, '--data-file=-'], { input: value })
  } else {
    gcloud(['secrets', 'create', name, '--replication-policy=automatic', '--data-file=-'], { input: value })
  }
}

function ensureServiceAccount() {
  try {
    gcloud(['iam', 'service-accounts', 'describe', serviceAccount])
  } catch {
    gcloud(['iam', 'service-accounts', 'create', serviceAccountName, '--display-name=Giverny ADK Runtime'])
  }
  for (const role of ['roles/aiplatform.user', 'roles/secretmanager.secretAccessor']) {
    gcloud([
      'projects', 'add-iam-policy-binding', project,
      `--member=serviceAccount:${serviceAccount}`,
      `--role=${role}`,
      '--condition=None',
      '--quiet',
    ])
  }
}

const toolToken = randomBytes(48).toString('base64url')
const runtimeKey = randomBytes(48).toString('base64url')

putSecret(toolSecretName, toolToken)
putSecret(runtimeSecretName, runtimeKey)
ensureServiceAccount()

const cloudflareToken = await loadCloudflareToken()
for (const [name, text] of Object.entries({ AGENT_TOOL_TOKEN: toolToken, ADK_AGENT_KEY: runtimeKey, ADK_AGENT_URL: runtimeUrl })) {
  await cloudflareAccountRequest(cloudflareToken, `/workers/scripts/${workerName}/secrets`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, type: 'secret_text', text }),
  })
}

process.stdout.write(`Google Secret Manager 与 Cloudflare Worker 密钥已同步；未输出任何密钥值。\n运行账号：${serviceAccount}\n`)
