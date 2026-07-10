/**
 * Clawdbot Tools - 工具系统
 *
 * 工具注册、调用、权限管理。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface ToolDefinition {
  name: string
  description: string
  category: string
  parameters: Record<string, { type: string; required?: boolean; description?: string }>
  permissions?: string[]
  enabled: boolean
}

export interface ToolExecutionResult {
  success: boolean
  output?: unknown
  error?: string
  duration: number
  metadata?: Record<string, unknown>
}

export type ToolHandler = (params: Record<string, unknown>, context?: ToolContext) => Promise<ToolExecutionResult>

export interface ToolContext {
  userId?: string
  sessionId?: string
  taskId?: string
  permissions?: string[]
}

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

export class ToolExecutor extends EventEmitter {
  private tools = new Map<string, RegisteredTool>()

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler })
    logger.info({ tool: definition.name }, '[Tools] Registered')
    this.emit('registered', definition)
  }

  unregister(name: string): boolean {
    const removed = this.tools.delete(name)
    if (removed) this.emit('unregistered', name)
    return removed
  }

  async execute(name: string, params: Record<string, unknown>, context?: ToolContext): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Tool "${name}" not found`, duration: 0 }
    }
    if (!tool.definition.enabled) {
      return { success: false, error: `Tool "${name}" is disabled`, duration: 0 }
    }
    if (!this.checkPermissions(tool.definition, context)) {
      return { success: false, error: 'Permission denied', duration: 0 }
    }
    const start = Date.now()
    try {
      const result = await tool.handler(params, context)
      result.duration = Date.now() - start
      this.emit('executed', { name, result })
      return result
    } catch (err) {
      const error = err as Error
      logger.error({ tool: name, err: error }, '[Tools] Execution failed')
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  private checkPermissions(definition: ToolDefinition, context?: ToolContext): boolean {
    if (!definition.permissions?.length) return true
    if (!context?.permissions?.length) return false
    return definition.permissions.every((p) => context.permissions!.includes(p))
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter((t) => t.category === category)
  }

  getStats() {
    const tools = this.getAllTools()
    return {
      total: tools.length,
      enabled: tools.filter((t) => t.enabled).length,
      categories: Array.from(new Set(tools.map((t) => t.category))),
    }
  }
}

let instance: ToolExecutor | null = null

export function getToolExecutor(): ToolExecutor {
  if (!instance) instance = new ToolExecutor()
  return instance
}
