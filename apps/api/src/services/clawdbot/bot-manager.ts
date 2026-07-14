import { EventEmitter } from 'node:events'
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
  config: BotConfig
  running: boolean
  sessions: number
  startedAt?: number
}

export class BotManager extends EventEmitter {
  private readonly bots = new Map<string, BotRuntime>()

  create(input: CreateBotInput): BotConfig {
    if (!input.name?.trim()) throw new BotManagerError('Bot 名称不能为空', 'invalid')
    const id = `bot_${crypto.randomUUID()}`
    const now = Date.now()
    const config: BotConfig = {
      id,
      name: input.name.trim(),
      description: input.description,
      model: input.model,
      systemPrompt: input.systemPrompt,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 4096,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
    this.bots.set(id, { config, running: false, sessions: 0 })
    logger.info({ botId: id, name: config.name }, '[BotManager] Bot created')
    this.emit('created', config)
    return config
  }

  get(id: string): BotConfig {
    const bot = this.bots.get(id)
    if (!bot) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    return bot.config
  }

  list(): BotConfig[] {
    return Array.from(this.bots.values()).map((b) => b.config)
  }

  listActive(): BotConfig[] {
    return this.list().filter((b) => b.enabled)
  }

  update(id: string, patch: Partial<CreateBotInput>): BotConfig {
    const bot = this.bots.get(id)
    if (!bot) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new BotManagerError('Bot 名称不能为空', 'invalid')
    }
    Object.assign(bot.config, patch, { updatedAt: Date.now() })
    logger.info({ botId: id }, '[BotManager] Bot updated')
    this.emit('updated', bot.config)
    return bot.config
  }

  delete(id: string): boolean {
    const bot = this.bots.get(id)
    if (!bot) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (bot.running) throw new BotManagerError('Bot 运行中,无法删除', 'not_running')
    const removed = this.bots.delete(id)
    if (removed) {
      logger.info({ botId: id }, '[BotManager] Bot deleted')
      this.emit('deleted', id)
    }
    return removed
  }

  start(id: string): void {
    const bot = this.bots.get(id)
    if (!bot) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (bot.running) return
    if (!bot.config.enabled) throw new BotManagerError('Bot 已禁用', 'invalid')
    bot.running = true
    bot.startedAt = Date.now()
    logger.info({ botId: id }, '[BotManager] Bot started')
    this.emit('started', id)
  }

  stop(id: string): void {
    const bot = this.bots.get(id)
    if (!bot) throw new BotManagerError(`Bot 不存在: ${id}`, 'not_found')
    if (!bot.running) return
    bot.running = false
    bot.startedAt = undefined
    logger.info({ botId: id }, '[BotManager] Bot stopped')
    this.emit('stopped', id)
  }

  incSessions(id: string): void {
    const bot = this.bots.get(id)
    if (bot) bot.sessions++
  }

  decSessions(id: string): void {
    const bot = this.bots.get(id)
    if (bot && bot.sessions > 0) bot.sessions--
  }

  getStats() {
    const all = Array.from(this.bots.values())
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
