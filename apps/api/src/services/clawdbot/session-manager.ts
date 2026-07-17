import { EventEmitter } from 'node:events'
import { eq, and, type SQL } from 'drizzle-orm'
import { logger } from './logger.js'
import { clawdbotSessions, type ClawdbotSession, type Database } from '@ihui/database'

export type SessionStatus = 'active' | 'paused' | 'closed'
export type CliSessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface SessionContext {
  botId: string
  userId: string
  messages: SessionMessage[]
  metadata: Record<string, unknown>
}

export interface Session {
  id: string
  botId: string
  userId: string
  status: SessionStatus
  context: SessionContext
  createdAt: number
  lastActiveAt: number
}

export class SessionManagerError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'exists' | 'closed' | 'invalid',
  ) {
    super(message)
    this.name = 'SessionManagerError'
  }
}

const MAX_CONTEXT_MESSAGES = 50

export function toCliStatus(s: SessionStatus): CliSessionStatus {
  if (s === 'active' || s === 'paused') return 'running'
  return 'completed'
}

export function fromCliStatus(s: CliSessionStatus): SessionStatus {
  if (s === 'running') return 'active'
  return 'closed'
}

function toSession(row: ClawdbotSession): Session {
  const meta = (row.metadata ?? {}) as Record<string, unknown>
  const messages = Array.isArray(meta['messages']) ? (meta['messages'] as SessionMessage[]) : []
  return {
    id: row.id,
    botId: row.botId,
    userId: row.userId,
    status: row.status as SessionStatus,
    context: { botId: row.botId, userId: row.userId, messages, metadata: meta },
    createdAt: row.createdAt.getTime(),
    lastActiveAt: (row.lastMessageAt ?? row.updatedAt).getTime(),
  }
}

type DbHandle = Database

export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<string, Session>()
  private readonly useDb: boolean
  private dbDisabled = false
  private dbCache: DbHandle | null = null

  constructor(opts: { useDb?: boolean } = {}) {
    super()
    this.useDb = opts.useDb ?? true
  }

  create(botId: string, userId: string): Session {
    if (!botId?.trim() || !userId?.trim()) {
      throw new SessionManagerError('botId 和 userId 不能为空', 'invalid')
    }
    const id = `sess_${crypto.randomUUID()}`
    const now = Date.now()
    const session: Session = {
      id,
      botId,
      userId,
      status: 'active',
      context: { botId, userId, messages: [], metadata: {} },
      createdAt: now,
      lastActiveAt: now,
    }
    this.sessions.set(id, session)
    logger.info({ sessionId: id, botId, userId }, '[SessionManager] Session created')
    this.emit('created', session)
    return session
  }

  get(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new SessionManagerError(`会话不存在: ${id}`, 'not_found')
    return session
  }

  resume(id: string): Session {
    const session = this.get(id)
    if (session.status === 'closed') throw new SessionManagerError('会话已关闭', 'closed')
    session.status = 'active'
    session.lastActiveAt = Date.now()
    logger.info({ sessionId: id }, '[SessionManager] Session resumed')
    this.emit('resumed', session)
    return session
  }

  pause(id: string): Session {
    const session = this.get(id)
    if (session.status === 'closed') throw new SessionManagerError('会话已关闭', 'closed')
    session.status = 'paused'
    logger.info({ sessionId: id }, '[SessionManager] Session paused')
    this.emit('paused', session)
    return session
  }

  close(id: string): void {
    const session = this.get(id)
    session.status = 'closed'
    logger.info({ sessionId: id }, '[SessionManager] Session closed')
    this.emit('closed', session)
  }

  appendMessage(id: string, message: Omit<SessionMessage, 'id' | 'timestamp'>): SessionMessage {
    const session = this.get(id)
    if (session.status === 'closed') throw new SessionManagerError('会话已关闭', 'closed')
    const full: SessionMessage = {
      ...message,
      id: `msg_${crypto.randomUUID()}`,
      timestamp: Date.now(),
    }
    session.context.messages.push(full)
    if (session.context.messages.length > MAX_CONTEXT_MESSAGES) {
      session.context.messages.shift()
    }
    session.lastActiveAt = full.timestamp
    return full
  }

  getContext(id: string): SessionContext {
    return this.get(id).context
  }

  setMetadata(id: string, key: string, value: unknown): void {
    const session = this.get(id)
    session.context.metadata[key] = value
  }

  listActive(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active')
  }

  listByBot(botId: string): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.botId === botId)
  }

  getStats() {
    const all = Array.from(this.sessions.values())
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'active').length,
      paused: all.filter((s) => s.status === 'paused').length,
      closed: all.filter((s) => s.status === 'closed').length,
    }
  }

  async createSession(
    botId: string,
    userId: string,
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<Session> {
    if (!botId?.trim() || !userId?.trim()) {
      throw new SessionManagerError('botId 和 userId 不能为空', 'invalid')
    }
    const id = sessionId ?? `sess_${crypto.randomUUID()}`
    const now = Date.now()
    const session: Session = {
      id,
      botId,
      userId,
      status: 'active',
      context: { botId, userId, messages: [], metadata: metadata ?? {} },
      createdAt: now,
      lastActiveAt: now,
    }
    const db = await this.getDb()
    if (db) {
      try {
        await db
          .insert(clawdbotSessions)
          .values({
            id,
            botId,
            userId,
            status: 'active',
            messageCount: 0,
            metadata: metadata ?? {},
          })
          .onConflictDoNothing()
        logger.info({ sessionId: id, botId, userId }, '[SessionManager] DB session created')
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB insert failed, fallback to memory')
      }
    }
    this.sessions.set(id, session)
    this.emit('created', session)
    return session
  }

  async getSession(id: string): Promise<Session | null> {
    const db = await this.getDb()
    if (db) {
      try {
        const rows = await db
          .select()
          .from(clawdbotSessions)
          .where(eq(clawdbotSessions.id, id))
          .limit(1)
        if (rows.length === 0) return null
        const session = toSession(rows[0]!)
        this.sessions.set(id, session)
        return session
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB select failed, fallback to memory')
      }
    }
    return this.sessions.get(id) ?? null
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<void> {
    const db = await this.getDb()
    if (db) {
      try {
        await db
          .update(clawdbotSessions)
          .set({ status, updatedAt: new Date() })
          .where(eq(clawdbotSessions.id, id))
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB update status failed, fallback to memory')
      }
    }
    const session = this.sessions.get(id)
    if (session) session.status = status
  }

  async incrementMessageCount(id: string, delta: number = 1): Promise<void> {
    const db = await this.getDb()
    if (db) {
      try {
        const rows = await db
          .select({ count: clawdbotSessions.messageCount })
          .from(clawdbotSessions)
          .where(eq(clawdbotSessions.id, id))
          .limit(1)
        const current = rows[0]?.count ?? 0
        await db
          .update(clawdbotSessions)
          .set({
            messageCount: current + delta,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clawdbotSessions.id, id))
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB increment messageCount failed')
      }
    }
  }

  async listSessions(filter?: {
    botId?: string
    userId?: string
    status?: SessionStatus
  }): Promise<Session[]> {
    const db = await this.getDb()
    if (db) {
      try {
        const conds: SQL[] = []
        if (filter?.botId) conds.push(eq(clawdbotSessions.botId, filter.botId))
        if (filter?.userId) conds.push(eq(clawdbotSessions.userId, filter.userId))
        if (filter?.status) conds.push(eq(clawdbotSessions.status, filter.status))
        const rows =
          conds.length > 0
            ? await db.select().from(clawdbotSessions).where(and(...conds))
            : await db.select().from(clawdbotSessions)
        return rows.map(toSession)
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB list failed, fallback to memory')
      }
    }
    let list = Array.from(this.sessions.values())
    if (filter?.botId) list = list.filter((s) => s.botId === filter.botId)
    if (filter?.userId) list = list.filter((s) => s.userId === filter.userId)
    if (filter?.status) list = list.filter((s) => s.status === filter.status)
    return list
  }

  async deleteSession(id: string): Promise<boolean> {
    let deleted = false
    const db = await this.getDb()
    if (db) {
      try {
        await db.delete(clawdbotSessions).where(eq(clawdbotSessions.id, id))
        deleted = true
      } catch (err) {
        this.dbDisabled = true
        logger.warn({ err }, '[SessionManager] DB delete failed, fallback to memory')
      }
    }
    if (this.sessions.delete(id)) deleted = true
    return deleted
  }

  async closeSession(id: string): Promise<void> {
    await this.updateSessionStatus(id, 'closed')
    const session = this.sessions.get(id)
    if (session) this.emit('closed', session)
  }

  resetDbState(): void {
    this.dbDisabled = false
    this.dbCache = null
  }

  private async getDb(): Promise<DbHandle | null> {
    if (!this.useDb || this.dbDisabled) return null
    if (this.dbCache) return this.dbCache
    try {
      const mod = await import('../../db/index.js')
      this.dbCache = mod.db
      return mod.db
    } catch {
      this.dbDisabled = true
      return null
    }
  }
}

let instance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!instance) instance = new SessionManager()
  return instance
}
