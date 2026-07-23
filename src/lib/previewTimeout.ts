// Preview generation is auxiliary and must never block the source-file workflow indefinitely.
export const PDF_PREVIEW_TIMEOUT_MS = 20_000

export async function withPreviewTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId = 0
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    window.clearTimeout(timeoutId)
  }
}
