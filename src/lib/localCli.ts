export const LOCAL_CLI_RUNTIME_VERSION = '0.4.0'
const LOCAL_CLI_BROWSER_KEY = 'giverny-local-cli-browser-device'

export function localCliRuntimeReady(version: string) {
  const current = String(version || '').split('.').map((item) => Number(item.replace(/\D.*$/, '')) || 0)
  const required = LOCAL_CLI_RUNTIME_VERSION.split('.').map(Number)
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    if ((current[index] || 0) > (required[index] || 0)) return true
    if ((current[index] || 0) < (required[index] || 0)) return false
  }
  return true
}

export function localCliBrowserDeviceKey() {
  try {
    const existing = window.localStorage.getItem(LOCAL_CLI_BROWSER_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(LOCAL_CLI_BROWSER_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}
