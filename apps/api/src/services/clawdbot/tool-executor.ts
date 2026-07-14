import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface ToolDef {
  name: string
  description: string
  category: string
  timeout: number
  requiredPermissions: string[]
  enabled: boolean
}

export interface ToolExecContext {
  userId: string
  sessionId?: string
  permissions: string[]
}

export interface ToolExecResult {
  success: boolean
  output?: unknown
  error?: string
  durationMs: number
  timedOut: boolean
}

export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: ToolExecContext,
) => Promise<unknown>

export class ToolExecutorError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'disabled' | 'forbidden' | 'timeout' | 'failed',
  ) {
    super(message)
    this.name = 'ToolExecutorError'
  }
}

interface RegisteredTool {
  def: ToolDef
  handler: ToolHandler
}

export class ToolRunner extends EventEmitter {
  private readonly tools = new Map<string, RegisteredTool>()
  private readonly execCount = new Map<string, number>()
  private readonly failCount = new Map<string, number>()

  register(def: Omit<ToolDef, 'enabled'> & { enabled?: boolean }, handler: ToolHandler): void {
    const full: ToolDef = { ...def, enabled: def.enabled ?? true }
    this.tools.set(full.name, { def: full, handler })
    logger.info({ tool: full.name }, '[ToolRunner] Tool registered')
    this.emit('registered', full)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    ctx: ToolExecContext,
  ): Promise<ToolExecResult> {
    const tool = this.tools.get(name)
    if (!tool) throw new ToolExecutorError(`工具不存在: ${name}`, 'not_found')
    if (!tool.def.enabled) throw new ToolExecutorError(`工具已禁用: ${name}`, 'disabled')
    this.checkPermissions(tool.def, ctx)
    const start = Date.now()
    this.execCount.set(name, (this.execCount.get(name) ?? 0) + 1)
    try {
      const result = await this.withTimeout(tool.handler(params, ctx), tool.def.timeout)
      this.emit('executed', { name, success: true })
      return { success: true, output: result, durationMs: Date.now() - start, timedOut: false }
    } catch (err) {
      this.failCount.set(name, (this.failCount.get(name) ?? 0) + 1)
      const code = err instanceof ToolExecutorError ? err.code : 'failed'
      logger.error({ tool: name, err: (err as Error).message }, '[ToolRunner] Execution failed')
      return {
        success: false,
        error: (err as Error).message,
        durationMs: Date.now() - start,
        timedOut: code === 'timeout',
      }
    }
  }

  private checkPermissions(def: ToolDef, ctx: ToolExecContext): void {
    if (def.requiredPermissions.length === 0) return
    const has = def.requiredPermissions.every((p) => ctx.permissions.includes(p))
    if (!has) throw new ToolExecutorError('权限不足', 'forbidden')
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new ToolExecutorError(`工具执行超时(${ms}ms)`, 'timeout')),
        ms,
      )
      promise.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })
  }

  list(): ToolDef[] {
    return Array.from(this.tools.values()).map((t) => t.def)
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)?.def
  }

  toggle(name: string, enabled: boolean): void {
    const tool = this.tools.get(name)
    if (tool) tool.def.enabled = enabled
  }

  getStats() {
    const tools = this.list()
    return {
      total: tools.length,
      enabled: tools.filter((t) => t.enabled).length,
      totalExecutions: Array.from(this.execCount.values()).reduce((a, b) => a + b, 0),
      totalFailures: Array.from(this.failCount.values()).reduce((a, b) => a + b, 0),
    }
  }
}

let instance: ToolRunner | null = null

export function getToolRunner(): ToolRunner {
  if (!instance) instance = new ToolRunner()
  return instance
}
