const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

let turnstileScriptPromise: Promise<void> | null = null

export function loadTurnstileScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }
  if ((window as unknown as { turnstile?: unknown }).turnstile) {
    return Promise.resolve()
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-giverny-turnstile="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Turnstile 加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.givernyTurnstile = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => {
      turnstileScriptPromise = null
      reject(new Error('Turnstile 加载失败'))
    }, { once: true })
    document.head.appendChild(script)
  })

  return turnstileScriptPromise
}
