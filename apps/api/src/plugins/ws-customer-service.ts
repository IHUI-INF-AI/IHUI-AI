import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { wsAuth, WS_CLOSE, WsUserConnectionLimiter, WsRateLimiter } from './ws-helpers.js'
import {
  createSession,
  findSessionBySessionId,
  assignSession,
  closeSession,
  pickAvailableAgent,
  findWaitingSessions,
  findAgentByUserId,
  updateAgentStatus,
} from '../db/customer-service-queries.js'
import { getWsAutoRecoveryManager } from './ws-auto-recovery.js'

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * 尝试为排队中的会话分配坐席（供路由层在坐席上线时调用）。
     * 按 queuePosition 顺序分配，直到无可用坐席或队列清空。
     */
    csDispatchQueue(): Promise<number>
  }
}

interface CsConnMeta {
  userId: string
  sessionId: string
  role: 'customer' | 'agent'
}

// 2026-08-02 P1 安全审计:WebSocket 消息 Zod schema 校验
// 风险:客户端可发任意类型 content(对象/超长字符串)→ 注入/资源耗尽
// 防护:cs_message / cs_typing 必须通过 schema,失败直接丢弃
const csMessageSchema = z.object({
  type: z.literal('cs_message'),
  data: z.object({
    sessionId: z.string().max(128).optional(),
    content: z.string().max(8000).optional(),
  }),
})

const csTypingSchema = z.object({
  type: z.literal('cs_typing'),
  data: z.object({
    isTyping: z.boolean().optional(),
  }),
})

const csMessageSchemas = z.discriminatedUnion('type', [csMessageSchema, csTypingSchema])

/**
 * 客服实时会话 WebSocket 插件。
 *
 * 端点: ws://host/ws/customer-service?token=<access_token>&sessionId=<optional>&as=customer|agent
 *
 * 功能：
 * - 实时会话（客户 ↔ 客服）：按 sessionId 分组广播消息
 * - 排队管理：无可用坐席时客户进入等待队列，按 queuePosition 顺序分配
 * - 坐席状态：坐席连接即置 online，断开置 offline
 *
 * 消息协议：
 *   客户端 → 服务端: { type: 'cs_message', data: { content, kind? } }
 *                   { type: 'cs_typing', data: { isTyping } }
 *   服务端 → 客户端: { type: 'cs_connected', data: { sessionId, role, queuePosition, agentAssigned } }
 *                   { type: 'cs_message', data: { id, content, senderId, senderName, createdAt } }
 *                   { type: 'cs_typing', data: { userId, isTyping } }
 *                   { type: 'cs_queue', data: { position, total } }
 *                   { type: 'cs_assigned', data: { agentId, agentNickname } }
 *                   { type: 'cs_closed', data: { reason } }
 *                   { type: 'error', data: { message } }
 */
const wsCustomerServicePlugin: FastifyPluginAsync = async (server) => {
  // sessionId -> 连接集合（同一会话可多端，客户与客服共享）
  const connections = new Map<string, Set<WebSocket>>()
  // socket -> 元数据（用于断开时清理）
  const meta = new WeakMap<WebSocket, CsConnMeta>()

  // 2026-08-02 P1 安全审计:单用户并发连接数限制(防资源耗尽)
  const userConnectionLimiter = new WsUserConnectionLimiter(8)
  // 2026-08-02 P1 安全审计:消息速率限制(防 flooding,30 条/分钟/用户)
  const messageRateLimiter = new WsRateLimiter(30, 60_000)

  function broadcast(sessionId: string, payload: unknown): void {
    const conns = connections.get(sessionId)
    if (!conns || conns.size === 0) return
    const text = JSON.stringify(payload)
    const stale: WebSocket[] = []
    for (const ws of conns) {
      try {
        ws.send(text)
      } catch {
        stale.push(ws)
      }
    }
    for (const ws of stale) conns.delete(ws)
  }

  /** 尝试为排队中的会话分配坐席，返回成功分配的数量。 */
  async function dispatchQueue(): Promise<number> {
    let assigned = 0
    // 持续尝试，直到无等待会话或无可用坐席
    for (;;) {
      const waiting = await findWaitingSessions()
      if (waiting.length === 0) break
      const agent = await pickAvailableAgent()
      if (!agent) break
      // 分配队首会话
      const target = waiting[0]
      if (!target) break
      const res = await assignSession(target.sessionId, agent.id)
      if (res.session) {
        assigned++
        broadcast(target.sessionId, {
          type: 'cs_assigned',
          data: { agentId: agent.id, agentNickname: agent.nickname },
        })
      } else {
        break // 分配失败（会话状态已变），退出避免死循环
      }
    }
    return assigned
  }

  // 暴露给路由层（坐席上线时触发派单）
  server.decorate('csDispatchQueue', dispatchQueue)

  server.get('/ws/customer-service', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token
    const sessionIdParam = (request.query as { sessionId?: string }).sessionId
    const roleParam = ((request.query as { as?: string }).as ?? 'customer') as 'customer' | 'agent'

    ;(async () => {
      const userId = await wsAuth(socket, token)
      if (!userId) return
      // 2026-08-02 P1 安全审计:单用户并发连接数限制
      if (!userConnectionLimiter.acquire(userId)) {
        server.log.warn({ userId }, 'ws-customer-service 拒绝连接:单用户连接数超限')
        socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
        return
      }

      // ===== 坐席连接 =====
      if (roleParam === 'agent') {
        const agent = await findAgentByUserId(userId)
        if (!agent) {
          socket.close(4004, '非坐席账号')
          return
        }
        await updateAgentStatus(agent.id, 'online')
        // 坐席上线后触发派单
        void dispatchQueue()

        // 坐席连接没有固定 sessionId，监听全局（此处简化：坐席通过消息携带 sessionId）
        // 用 "agent:<userId>" 作为虚拟会话键，便于心跳管理
        const virtualKey = `agent:${agent.id}`
        if (!connections.has(virtualKey)) connections.set(virtualKey, new Set())
        connections.get(virtualKey)!.add(socket)
        meta.set(socket, { userId, sessionId: virtualKey, role: 'agent' })

        socket.send(
          JSON.stringify({
            type: 'cs_connected',
            data: { sessionId: '', role: 'agent', agentId: agent.id },
          }),
        )

        socket.on('message', (data: Buffer) => {
          if (data.toString() === 'ping') {
            socket.send('pong')
            return
          }
          // 2026-08-02 P1 安全审计:消息速率限制(防 flooding)
          if (!messageRateLimiter.allow(userId)) {
            server.log.warn({ userId }, 'ws-customer-service(坐席)拒绝消息:速率超限')
            socket.close(WS_CLOSE.RATE_LIMITED, '消息发送过快')
            return
          }
          let msgObj: unknown
          try {
            msgObj = JSON.parse(data.toString())
          } catch {
            socket.send(JSON.stringify({ type: 'error', data: { message: 'JSON 格式错误' } }))
            return
          }
          // 2026-08-02 P1 安全审计:Zod schema 校验消息结构
          if (typeof msgObj !== 'object' || msgObj === null) {
            socket.send(JSON.stringify({ type: 'error', data: { message: '消息格式非法' } }))
            return
          }
          const rawMsg = msgObj as { type?: string }
          if (rawMsg.type !== 'cs_message') return
          const parsed = csMessageSchema.safeParse(msgObj)
          if (!parsed.success) {
            socket.send(JSON.stringify({ type: 'error', data: { message: '消息格式非法' } }))
            return
          }
          const sessionId = parsed.data.data.sessionId
          if (!sessionId) return
          const targetSession = String(sessionId)
          broadcast(targetSession, {
            type: 'cs_message',
            data: {
              id: `${targetSession}_${Date.now()}`,
              content: parsed.data.data.content ?? '',
              senderId: agent.id,
              senderName: agent.nickname,
              senderRole: 'agent',
              createdAt: new Date().toISOString(),
            },
          })
        })

        socket.on('close', async () => {
          const conns = connections.get(virtualKey)
          if (conns) {
            conns.delete(socket)
            if (conns.size === 0) connections.delete(virtualKey)
          }
          // 坐席断开：若没有其他连接则置 offline
          await updateAgentStatus(agent.id, 'offline').catch(() => {})
          // 2026-08-02 P1 安全审计:释放连接槽位 + 清除速率窗口
          userConnectionLimiter.release(userId)
          messageRateLimiter.reset(userId)
        })
        return
      }

      // ===== 客户连接 =====
      let session
      if (sessionIdParam) {
        session = await findSessionBySessionId(sessionIdParam)
        if (!session) {
          socket.close(4004, '会话不存在')
          return
        }
      } else {
        session = await createSession({ userId, source: 'web' })
      }

      const sessionId = session.sessionId
      if (!connections.has(sessionId)) connections.set(sessionId, new Set())
      connections.get(sessionId)!.add(socket)
      meta.set(socket, { userId, sessionId, role: 'customer' })

      // 推送连接确认（含排队位置与是否已分配坐席）
      socket.send(
        JSON.stringify({
          type: 'cs_connected',
          data: {
            sessionId,
            role: 'customer',
            queuePosition: session.queuePosition,
            agentAssigned: !!session.agentId,
            status: session.status,
          },
        }),
      )

      // 若会话仍在排队，尝试立即分配坐席
      if (session.status === 'waiting') {
        const assigned = await dispatchQueue()
        if (assigned === 0) {
          // 暂无可用坐席，推送队列位置
          socket.send(
            JSON.stringify({
              type: 'cs_queue',
              data: { position: session.queuePosition, total: session.queuePosition },
            }),
          )
        }
      }

      socket.on('message', (data: Buffer) => {
        if (data.toString() === 'ping') {
          socket.send('pong')
          return
        }
        // 2026-08-02 P1 安全审计:消息速率限制(防 flooding)
        if (!messageRateLimiter.allow(userId)) {
          server.log.warn({ userId }, 'ws-customer-service(客户)拒绝消息:速率超限')
          socket.close(WS_CLOSE.RATE_LIMITED, '消息发送过快')
          return
        }
        let msgObj: unknown
        try {
          msgObj = JSON.parse(data.toString())
        } catch {
          socket.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } }))
          return
        }
        // 2026-08-02 P1 安全审计:Zod schema 校验消息结构
        const parsed = csMessageSchemas.safeParse(msgObj)
        if (!parsed.success) {
          socket.send(JSON.stringify({ type: 'error', data: { message: '消息格式非法' } }))
          return
        }
        const msg = parsed.data
        if (msg.type === 'cs_message') {
          const content = (msg.data.content ?? '').trim()
          if (!content) return
          broadcast(sessionId, {
            type: 'cs_message',
            data: {
              id: `${sessionId}_${Date.now()}`,
              content,
              senderId: userId,
              senderName: '用户',
              senderRole: 'customer',
              createdAt: new Date().toISOString(),
            },
          })
        } else if (msg.type === 'cs_typing') {
          broadcast(sessionId, {
            type: 'cs_typing',
            data: { userId, isTyping: msg.data.isTyping === true },
          })
        }
      })

      socket.on('close', () => {
        const conns = connections.get(sessionId)
        if (conns) {
          conns.delete(socket)
          if (conns.size === 0) {
            connections.delete(sessionId)
            // 客户端全部断开：关闭会话（不立即关闭，给重连留窗口；此处简化为标记关闭）
            void closeSession(sessionId).catch(() => {})
          }
        }
        // 2026-08-02 P1 安全审计:释放连接槽位 + 清除速率窗口
        userConnectionLimiter.release(userId)
        messageRateLimiter.reset(userId)
      })
    })()
  })

  getWsAutoRecoveryManager().setFastify(server)
  getWsAutoRecoveryManager().registerPlugin('ws-customer-service', {
    getConnections: () => connections as unknown as Map<string, WebSocket | Set<WebSocket>>,
    removeConnection: async (sessionId) => {
      connections.delete(sessionId)
    },
  })
}

export const wsCustomerService = fp(wsCustomerServicePlugin, {
  name: 'ws-customer-service',
  fastify: '5.x',
})
