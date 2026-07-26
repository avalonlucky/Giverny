declare module 'cloudflare:workers' {
  export type CloudflareTraceSpan = {
    readonly isTraced: boolean
    setAttribute: (key: string, value?: boolean | number | string) => void
    end: () => void
  }

  export const tracing: {
    enterSpan: <T>(name: string, callback: (span: CloudflareTraceSpan) => T) => T
    startActiveSpan: <T>(name: string, callback: (span: CloudflareTraceSpan) => T) => T
  }
}
