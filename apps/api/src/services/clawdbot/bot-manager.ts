import { EventEmitter } from 'node:events'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { clawdbotBots, type ClawdbotBot } from '@ihui/database'
import { logger } from './logger.js'

export interface BotConfig {
  id: string
  name: string
  description?: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateBotInput {
  name: string
  description?: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export class BotManagerError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'exists' | 'invalid' | 'not_running',
  ) {
    super(message)
    this.name = 'BotManagerError'
  }
}

interface BotRuntime {
  running: boolean
  sessions: number
  startedAt?: number
  enabled: boolean
}

/** DB 行 → BotConfig 转换 */
function dbRowToConfig(row: ClawdbotBot): BotConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    model: row.model,
    systemPrompt: row.systemPrompt ?? undefined,
    temperature: row.temperature ? parseFloat(row.temperature) : undefined,
    maxTokens: row.maxTokens,
    enabled: row.isActive,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export class BotManager extends EventEmitter {
  /** 运行时状态(内存,不持久化):botId → { running, sessions, startedAt, enabled } */
  private readonly runtime = new Map<string, BotRuntime>()

  async create(input: CreateBotInput): Promise<BotConfig> {
    if (!input.name?.trim()) throw new BotManagerError('Bot 名称不能为空', 'invalid')
    const [row] = await db
      .insert(clawdbotBots)
      .values({
        name: input.name.trim(),
        description: input.description,
        model: input.model,
        systemPrompt: input.systemPrompt,
        temperature: input.temperature?.toString(),
        maxTokens: input.maxTokens ?? 4096,
        isActive: true,
      })
      .returning()
    if (!row) throw new BotManagerError('创建失败', 'invalid')
    const config = dbRowToConfig(row)
    this.runtime.set(config.id, { running: false, sessions: 0, enabled: config.enabled })
    logger.info({ botId: config.id, name: config.name }, '[BotManager] Bot created')
    this.emit('created', config)
    return config
  }

  async get(id: string): Promise<BotConfig> {
    const [row] = await db.select().from(clawdbotBots).where(eq(clawdbotBots.id, id)).limit(1)
    if (!row) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    const config = dbRowToConfig(row)
    if (!this.runtime.has(id)) {
      this.runtime.set(id, { running: false, sessions: 0, enabled: config.enabled })
    }
    return config
  }

  async list(): Promise<BotConfig[]> {
    const rows = await db.select().from(clawdbotBots)
    return rows.map(dbRowToConfig)
  }

  async listActive(): Promise<BotConfig[]> {
    const rows = await db.select().from(clawdbotBots).where(eq(clawdbotBots.isActive, true))
    return rows.map(dbRowToConfig)
  }

  async update(id: string, patch: Partial<CreateBotInput>): Promise<BotConfig> {
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new BotManagerError('Bot 名称不能为空', 'invalid')
    }
    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.name !== undefined) set.name = patch.name.trim()
    if (patch.description !== undefined) set.description = patch.description
    if (patch.model !== undefined) set.model = patch.model
    if (patch.systemPrompt !== undefined) set.systemPrompt = patch.systemPrompt
    if (patch.temperature !== undefined) set.temperature = patch.temperature.toString()
    if (patch.maxTokens !== undefined) set.maxTokens = patch.maxTokens

    const [row] = await db
      .update(clawdbotBots)
      .set(set)
      .where(eq(clawdbotBots.id, id))
      .returning()
    if (!row) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    const config = dbRowToConfig(row)
    logger.info({ botId: id }, '[BotManager] Bot updated')
    this.emit('updated', config)
    return config
  }

  async delete(id: string): Promise<boolean> {
    const rt = this.runtime.get(id)
    if (rt?.running) throw new BotManagerError('Bot 运行中,无法删除', 'not_running')
    const [row] = await db.delete(clawdbotBots).where(eq(clawdbotBots.id, id)).returning()
    if (!row) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    this.runtime.delete(id)
    logger.info({ botId: id }, '[BotManager] Bot deleted')
    this.emit('deleted', id)
    return true
  }

  start(id: string): void {
    const rt = this.runtime.get(id)
    if (!rt) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (rt.running) return
    if (!rt.enabled) throw new BotManagerError('Bot 已禁用', 'invalid')
    rt.running = true
    rt.startedAt = Date.now()
    logger.info({ botId: id }, '[BotManager] Bot started')
    this.emit('started', id)
  }

  stop(id: string): void {
    const rt = this.runtime.get(id)
    if (!rt) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (!rt.running) return
    rt.running = false
    rt.startedAt = undefined
    logger.info({ botId: id }, '[BotManager] Bot stopped')
    this.emit('stopped', id)
  }

  incSessions(id: string): void {
    const rt = this.runtime.get(id)
    if (rt) rt.sessions++
  }

  decSessions(id: string): void {
    const rt = this.runtime.get(id)
    if (rt && rt.sessions > 0) rt.sessions--
  }

  getStats() {
    const all = Array.from(this.runtime.values())
    return {
      total: all.length,
      running: all.filter((b) => b.running).length,
      activeSessions: all.reduce((sum, b) => sum + b.sessions, 0),
    }
  }
}

let instance: BotManager | null = null

export function getBotManager(): BotManager {
  if (!instance) instance = new BotManager()
  return instance
}
