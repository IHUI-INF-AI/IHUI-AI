import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type SessionStatus = 'active' | 'paused' | 'closed'

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

export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<string, Session>()

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
}

let instance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!instance) instance = new SessionManager()
  return instance
}
