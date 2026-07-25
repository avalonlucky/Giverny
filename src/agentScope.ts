export type AgentPrincipalRole = 'admin' | 'collaborator' | 'viewer' | 'client' | 'guest' | 'mcp-read' | 'system'

export type AgentPrincipalContext = {
  workspaceId: string
  principalId: string
  role: AgentPrincipalRole
  runId: string
}

const encoder = new TextEncoder()

function cleanScopePart(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function canonicalScope(scope: AgentPrincipalContext) {
  return [scope.workspaceId, scope.principalId, scope.role, scope.runId].join('\n')
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function signScope(secret: string, scope: AgentPrincipalContext) {
  const key = await signingKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalScope(scope)))
  return base64Url(new Uint8Array(signature))
}

function base64UrlToBytes(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

export function normalizeAgentPrincipalContext(value: Partial<AgentPrincipalContext> | null | undefined): AgentPrincipalContext {
  const role = cleanScopePart(value?.role, 24) as AgentPrincipalRole
  return {
    workspaceId: cleanScopePart(value?.workspaceId, 80) || 'default',
    principalId: cleanScopePart(value?.principalId, 160) || 'system',
    role: ['admin', 'collaborator', 'viewer', 'client', 'guest', 'mcp-read', 'system'].includes(role) ? role : 'guest',
    runId: cleanScopePart(value?.runId, 160) || crypto.randomUUID(),
  }
}

export async function createAgentScopeHeaders(secret: string, input: Partial<AgentPrincipalContext>) {
  const scope = normalizeAgentPrincipalContext(input)
  return {
    'x-agent-workspace-id': scope.workspaceId,
    'x-agent-principal-id': scope.principalId,
    'x-agent-role': scope.role,
    'x-agent-run-id': scope.runId,
    'x-agent-scope-signature': await signScope(secret, scope),
  }
}

export async function verifyAgentScopeHeaders(secret: string, headers: Headers): Promise<AgentPrincipalContext | null> {
  const signature = cleanScopePart(headers.get('x-agent-scope-signature'), 200)
  if (!signature) return null
  const scope = normalizeAgentPrincipalContext({
    workspaceId: headers.get('x-agent-workspace-id') || undefined,
    principalId: headers.get('x-agent-principal-id') || undefined,
    role: headers.get('x-agent-role') as AgentPrincipalRole,
    runId: headers.get('x-agent-run-id') || undefined,
  })
  const signatureBytes = base64UrlToBytes(signature)
  if (!signatureBytes) return null
  const key = await signingKey(secret)
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(canonicalScope(scope)))
  return valid ? scope : null
}
