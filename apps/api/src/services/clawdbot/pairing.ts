// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Clawdbot Pairing - 配对服务
 *
 * 设备配对、会话绑定。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { generateShortCode, generateCompactId } from '../../utils/crypto-random.js'

export interface PairingRequest {
  id: string
  code: string
  userId?: string
  deviceId?: string
  channelType?: string
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled'
  createdAt: number
  expiresAt: number
  metadata?: Record<string, unknown>
}

export interface PairingSession {
  id: string
  userId: string
  deviceId: string
  channelType: string
  sessionId: string
  pairedAt: number
  lastActiveAt: number
  metadata?: Record<string, unknown>
}

export class PairingService extends EventEmitter {
  private requests = new Map<string, PairingRequest>()
  private sessions = new Map<string, PairingSession>()
  private codeToRequestId = new Map<string, string>()
  private ttl = 1000 * 60 * 5
  /** 会话上限:配对会话只有 unpair 才删除,不加上限会随设备/用户数无限增长。 */
  private maxSessions = 1000

  createRequest(params: {
    userId?: string
    deviceId?: string
    channelType?: string
  }): PairingRequest {
    const code = this.generateCode()
    const request: PairingRequest = {
      // 2026-07-21 安全审计加固:用 CSPRNG (generateCompactId) 替换 Math.random
      // 原实现可预测 → 攻击者枚举 pending 配对请求 → 取消劫持他人配对流程
      id: generateCompactId('pr'),
      code,
      userId: params.userId,
      deviceId: params.deviceId,
      channelType: params.channelType,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
    }
    this.requests.set(request.id, request)
    this.codeToRequestId.set(code, request.id)
    logger.info({ requestId: request.id, code }, '[Pairing] Request created')
    this.emit('requestCreated', request)
    return request
  }

  confirmPairing(
    code: string,
    userId: string,
    deviceId: string,
    channelType: string,
  ): PairingSession | null {
    const requestId = this.codeToRequestId.get(code)
    if (!requestId) return null
    const request = this.requests.get(requestId)
    if (!request || request.status !== 'pending' || request.expiresAt < Date.now()) {
      if (request) request.status = 'expired'
      return null
    }
    request.status = 'confirmed'
    const session: PairingSession = {
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成配对会话 ID
      id: generateCompactId('ps'),
      userId,
      deviceId,
      channelType,
      sessionId: request.id,
      pairedAt: Date.now(),
      lastActiveAt: Date.now(),
    }
    this.sessions.set(session.id, session)
    this.evictSessions()
    this.codeToRequestId.delete(code)
    logger.info({ sessionId: session.id, userId, deviceId }, '[Pairing] Confirmed')
    this.emit('paired', { request, session })
    return session
  }

  getSession(id: string): PairingSession | undefined {
    return this.sessions.get(id)
  }

  getSessionByUser(userId: string): PairingSession | undefined {
    return Array.from(this.sessions.values()).find((s) => s.userId === userId)
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) session.lastActiveAt = Date.now()
  }

  unpair(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId)
    if (removed) this.emit('unpaired', sessionId)
    return removed
  }

  cancelRequest(requestId: string): boolean {
    const request = this.requests.get(requestId)
    if (!request) return false
    request.status = 'cancelled'
    this.codeToRequestId.delete(request.code)
    this.emit('cancelled', requestId)
    return true
  }

  cleanupExpired(): number {
    const now = Date.now()
    let cleaned = 0
    for (const [id, request] of this.requests) {
      const expiredPending = request.status === 'pending' && request.expiresAt < now
      // 终态只在内存里保留一个 TTL 供排障,之后一并删除(原来这些行永不释放)
      const staleTerminal = request.status !== 'pending' && request.createdAt + this.ttl < now
      if (!expiredPending && !staleTerminal) continue
      if (expiredPending) request.status = 'expired'
      this.codeToRequestId.delete(request.code)
      this.requests.delete(id)
      cleaned++
    }
    this.evictSessions()
    return cleaned
  }

  /** 超出上限时淘汰最久未活跃的会话,避免 sessions Map 无界增长。 */
  private evictSessions(): void {
    const overflow = this.sessions.size - this.maxSessions
    if (overflow <= 0) return
    const oldest = Array.from(this.sessions.values()).sort((a, b) => a.lastActiveAt - b.lastActiveAt)
    for (let i = 0; i < overflow; i++) {
      const session = oldest[i]
      if (!session) break
      this.sessions.delete(session.id)
      logger.warn(
        { sessionId: session.id, userId: session.userId },
        '[Pairing] 会话数超上限,淘汰最久未活跃会话',
      )
    }
  }

  private generateCode(): string {
    // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成设备配对码,
    // 配对码可预测 -> 攻击者可劫持设备配对流程
    return generateShortCode(6)
  }

  getStats() {
    const sessions = Array.from(this.sessions.values())
    const requests = Array.from(this.requests.values())
    return {
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      activeSessions: sessions.length,
      confirmed: requests.filter((r) => r.status === 'confirmed').length,
    }
  }
}

let instance: PairingService | null = null

export function getPairingService(): PairingService {
  if (!instance) instance = new PairingService()
  return instance
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
