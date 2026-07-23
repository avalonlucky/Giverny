import { spawn } from 'node:child_process'
import process from 'node:process'

export function runWranglerD1(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let settled = false
    let completionTimer

    const stopProcessGroup = () => {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }
    const settle = (error) => {
      if (settled) return
      settled = true
      if (completionTimer) clearTimeout(completionTimer)
      if (error) reject(error)
      else resolve()
    }
    const forward = (stream, target) => {
      stream.on('data', (chunk) => {
        target.write(chunk)
        if (!settled && /commands executed successfully/i.test(String(chunk))) {
          completionTimer = setTimeout(() => {
            stopProcessGroup()
            settle()
          }, 500)
        }
      })
    }

    forward(child.stdout, process.stdout)
    forward(child.stderr, process.stderr)
    child.on('error', settle)
    child.on('exit', (code, signal) => {
      if (settled) return
      if (code === 0 || (signal === 'SIGTERM' && completionTimer)) settle()
      else settle(new Error(`${command} exited with ${code ?? signal}`))
    })
  })
}
