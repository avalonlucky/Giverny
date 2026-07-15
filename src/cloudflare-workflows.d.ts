declare module 'cloudflare:workers' {
  export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected env: Env
    run(event: { payload: Readonly<Params> }, step: unknown): Promise<unknown>
  }
}
