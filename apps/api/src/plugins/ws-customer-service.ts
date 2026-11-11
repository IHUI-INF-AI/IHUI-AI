// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
//
// 2026-09-30 控制面 strict 化(票 b76-12c-2):入站边界收成 .strict() —— zod 默认剥离
// 未声明键,「生产者加了字段、消费者没登记」会**无声**失效(协议文档承诺的 kind 就被
// 这样剥过)。判定单点 judgeCsInboundMessage:未登记键 → 拒 + 计数 + 告警(不静默);
// 文档承诺的合法键 → 必须真登记进 schema,不得靠放宽边界"顺手通过"。
// 禁止为降红把 .strict() 换成 .passthrough()/looseObject(那等于把剥离改成放行),
// 禁止把装饰字段塞进控制面 schema 来绕过本门。
const csMessageDataSchema = z
  .object({
    sessionId: z.string().max(128).optional(),
    // 2026-09-30:按协议文档(:69) `data: { content, kind? }` 收紧 —— content 不带 ?,
    // 是必填承诺,缺 content 即拒;此前登记成 optional 与文档脱节
    content: z.string().max(8000),
    // 2026-09-30:协议文档早已承诺的合法键,此前未登记 → 送来即被剥离且无人报错
    kind: z.string().max(32).optional(),
  })
  .strict()

const csMessageSchema = z
  .object({
    type: z.literal('cs_message'),
    data: csMessageDataSchema,
  })
  .strict()

const csTypingSchema = z
  .object({
    type: z.literal('cs_typing'),
    data: z
      .object({
        isTyping: z.boolean().optional(),
      })
      .strict(),
  })
  .strict()

const csMessageSchemas = z.discriminatedUnion('type', [csMessageSchema, csTypingSchema])

/** 入站控制面判定结论:通过 → 放行 zod 解析结果;拒绝 → 带可诊断原因 */
export type CsInboundVerdict =
  | {
      ok: true
      data:
        | { type: 'cs_message'; data: { sessionId?: string; content: string; kind?: string } }
        | { type: 'cs_typing'; data: { isTyping?: boolean } }
    }
  | { ok: false; reason: 'unrecognized_key' | 'malformed' }

/** strict 边界拒绝计数(排障与测试观测面:被丢弃的非法入站消息条数) */
let strictRejectionCount = 0

export function getCsStrictRejectionCount(): number {
  return strictRejectionCount
}

/**
 * 入站消息判定单点(坐席与客户两条 handler 共用):strict schema 判定 + 拒绝计数。
 * 拒绝时区分「未登记键」与「形状非法」两类原因,调用方一律丢弃并告警,不得静默。
 */
export function judgeCsInboundMessage(msgObj: unknown): CsInboundVerdict {
  const parsed = csMessageSchemas.safeParse(msgObj)
  if (!parsed.success) {
    strictRejectionCount++
    const unrecognized = parsed.error.issues.some((i) => i.code === 'unrecognized_keys')
    return { ok: false, reason: unrecognized ? 'unrecognized_key' : 'malformed' }
  }
  return { ok: true, data: parsed.data }
}

/** 会话接入判据所需的会话形状(只取鉴权用到的字段,便于单测直接构造)。 */
export interface CsSessionLike {
  userId: string
  agentId?: string | null
  status: string
}

/**
 * 不可再接入的终态。会话 status 的枚举口径目前在仓库内不一致:
 * packages/types 声明 pending/open/resolved/closed/rejected,而 DB 查询层实际写
 * waiting/active/closed。这里按「只拦终态」取宽口径,避免误伤 waiting/active/open/pending。
 */
const CS_SESSION_TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'closed',
  'resolved',
  'rejected',
])

/** 会话接入判定结论:ok=允许加入;否则带可审计原因。 */
export type CsJoinVerdict =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'session_missing'
        | 'session_not_owner'
        | 'session_closed'
        | 'agent_not_assigned'
        | 'session_not_active'
    }

/**
 * F-109:客户只能接入自己的、未终结的会话;坐席只能接入自己名下且 active 的会话。
 * 判定与 WS 副作用分离(纯函数),路由侧据此 close + 释放槽位。
 */
export function judgeSessionJoin(
  session: CsSessionLike | null | undefined,
  userId: string,
  isAgent: boolean,
  agentId?: string,
): CsJoinVerdict {
  if (!session) return { ok: false, reason: 'session_missing' }
  if (isAgent) {
    if (!agentId || session.agentId !== agentId) return { ok: false, reason: 'agent_not_assigned' }
    if (session.status !== 'active') return { ok: false, reason: 'session_not_active' }
    return { ok: true }
  }
  if (session.userId !== userId) return { ok: false, reason: 'session_not_owner' }
  if (CS_SESSION_TERMINAL_STATUSES.has(session.status)) {
    return { ok: false, reason: 'session_closed' }
  }
  return { ok: true }
}

/**
 * F-110:坐席只能向「自己名下 + active」的会话广播,否则丢弃并记 warn 审计。
 */
export function judgeAgentBroadcast(
  session: CsSessionLike | null | undefined,
  agentId: string,
):
  | { ok: true }
  | {
      ok: false
      reason: 'session_missing' | 'agent_not_assigned' | 'session_not_active'
    } {
  if (!session) return { ok: false, reason: 'session_missing' }
  if (session.agentId !== agentId) return { ok: false, reason: 'agent_not_assigned' }
  if (session.status !== 'active') return { ok: false, reason: 'session_not_active' }
  return { ok: true }
}

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

    // F-111(2026-11-08):acquire 之后的每一条早退分支都必须释放槽位,否则同一账号
    // 8 次「非坐席/会话不存在/越权」即可把自己永久锁死;异步 IIFE 必须兜底 catch。
    let acquiredUserId: string | undefined
    const releaseSlot = (): void => {
      if (!acquiredUserId) return
      userConnectionLimiter.release(acquiredUserId)
      messageRateLimiter.reset(acquiredUserId)
      acquiredUserId = undefined
    }

    void (async () => {
      // 挂上 close 监听后置 true:此后槽位由 close 释放,finally 不再重复释放
      let handedOff = false
      try {
        const userId = await wsAuth(socket, token)
        if (!userId) return
        // 2026-08-02 P1 安全审计:单用户并发连接数限制
        if (!userConnectionLimiter.acquire(userId)) {
          server.log.warn({ userId }, 'ws-customer-service 拒绝连接:单用户连接数超限')
          socket.close(WS_CLOSE.TOO_MANY_CONNECTIONS, '单用户连接数超限')
          return
        }
        acquiredUserId = userId

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

          socket.on('message', async (data: Buffer) => {
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
            // 2026-09-30 strict 化:判定走共享单点,拒绝一律计数 + 告警(不静默剥键)
            const verdict = judgeCsInboundMessage(msgObj)
            if (!verdict.ok) {
              server.log.warn(
                { userId, reason: verdict.reason },
                'ws-customer-service(坐席)消息被 strict 边界拒绝',
              )
              socket.send(JSON.stringify({ type: 'error', data: { message: '消息格式非法' } }))
              return
            }
            if (verdict.data.type !== 'cs_message') return
            const sessionId = verdict.data.data.sessionId
            if (!sessionId) return
            const targetSession = String(sessionId)
            // F-110(2026-11-08):targetSession 来自客户端,广播前必须确认是本人名下
            // 且仍在进行中的会话,否则任意坐席可向他人会话注入「官方客服」消息。
            let target
            try {
              target = await findSessionBySessionId(targetSession)
            } catch (err) {
              server.log.warn(
                { err, userId, sessionId: targetSession },
                'ws-customer-service(坐席)会话查询失败,丢弃消息',
              )
              return
            }
            const authz = judgeAgentBroadcast(target, agent.id)
            if (!authz.ok) {
              server.log.warn(
                { userId, agentId: agent.id, sessionId: targetSession, reason: authz.reason },
                'ws-customer-service(坐席)拒绝向非本人/非活跃会话广播',
              )
              return
            }
            broadcast(targetSession, {
              type: 'cs_message',
              data: {
                id: `${targetSession}_${Date.now()}`,
                content: verdict.data.data.content,
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
            releaseSlot()
          })
          handedOff = true
          return
        }

        // ===== 客户连接 =====
        let session
        if (sessionIdParam) {
          const found = await findSessionBySessionId(sessionIdParam)
          if (!found) {
            socket.close(4004, '会话不存在')
            return
          }
          // F-109(2026-11-08):会话存在不等于归属当前用户 —— 必须比对 userId,
          // 且已终结会话不可再接入。不泄露会话是否存在,统一按 4004 拒绝。
          const joinVerdict = judgeSessionJoin(found, userId, false)
          if (!joinVerdict.ok) {
            if (joinVerdict.reason === 'session_not_owner') {
              server.log.warn(
                { userId, sessionId: sessionIdParam },
                'ws-customer-service 拒绝连接:会话不属于当前用户',
              )
            }
            socket.close(4004, '会话不存在')
            return
          }
          session = found
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
          // 2026-09-30 strict 化:判定走共享单点,未登记键/形状非法 → 计数 + 告警 + 丢弃
          const verdict = judgeCsInboundMessage(msgObj)
          if (!verdict.ok) {
            server.log.warn(
              { userId, reason: verdict.reason },
              'ws-customer-service(客户)消息被 strict 边界拒绝',
            )
            socket.send(JSON.stringify({ type: 'error', data: { message: '消息格式非法' } }))
            return
          }
          const msg = verdict.data
          if (msg.type === 'cs_message') {
            const content = msg.data.content.trim()
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
          releaseSlot()
        })
        handedOff = true
      } finally {
        if (!handedOff) releaseSlot()
      }
    })().catch((err: unknown) => {
      server.log.error({ err }, 'ws-customer-service 连接处理异常')
      releaseSlot()
      try {
        socket.close(1011, '内部错误')
      } catch {
        // socket 可能已关闭
      }
    })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
