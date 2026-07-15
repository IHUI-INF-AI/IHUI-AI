/**
 * WebRTC 语音通话信令路由(迁移自 coze_zhs_py/api/webrtc_voice.py)。
 *
 * 通过 HTTP 端点管理会话生命周期,信令消息(SDP/ICE)落库后通过
 * server.pushNotification 推送给对端,复用 ws-notifications 的多实例广播能力。
 *
 * 注册(server.ts):
 *   server.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

interface VoiceSession {
  sessionId: string
  callerId: string
  calleeId: string
  status: 'pending' | 'ringing' | 'connected' | 'ended'
  offer?: unknown
  answer?: unknown
  candidates: { from: 'caller' | 'callee'; candidate: unknown }[]
  createdAt: number
  updatedAt: number
}

const sessionStore = new Map<string, VoiceSession>()

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

const createSessionSchema = z.object({
  calleeId: z.string().min(1),
  offer: z.unknown().optional(),
})

const offerSchema = z.object({
  sessionId: z.string().min(1),
  offer: z.unknown(),
})

const iceSchema = z.object({
  sessionId: z.string().min(1),
  candidate: z.unknown(),
  from: z.enum(['caller', 'callee']).optional(),
})

const endSchema = z.object({ sessionId: z.string().min(1) })

export const webrtcVoiceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // POST /session — 创建语音会话(主叫发起呼叫)
  server.post('/session', async (request, reply) => {
    const body = createSessionSchema.parse(request.body)
    const callerId = request.userId!
    if (body.calleeId === callerId) {
      return reply.status(400).send(error(400, '不能呼叫自己'))
    }
    const session: VoiceSession = {
      sessionId: genId('voice'),
      callerId,
      calleeId: body.calleeId,
      status: 'pending',
      offer: body.offer,
      candidates: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sessionStore.set(session.sessionId, session)
    try {
      server.pushNotification(body.calleeId, {
        type: 'webrtc_voice',
        event: 'incoming_call',
        sessionId: session.sessionId,
        callerId,
        offer: body.offer,
      })
    } catch {
      /* 推送失败不阻塞会话创建 */
    }
    return reply.send(success({ sessionId: session.sessionId, status: session.status }))
  })

  // POST /offer — 交换 SDP offer(主叫→被叫)
  server.post('/offer', async (request, reply) => {
    const body = offerSchema.parse(request.body)
    const session = sessionStore.get(body.sessionId)
    if (!session) return reply.status(404).send(error(404, '会话不存在'))
    const userId = request.userId!
    if (userId !== session.callerId && userId !== session.calleeId) {
      return reply.status(403).send(error(403, '无权操作该会话'))
    }
    session.offer = body.offer
    session.status = 'ringing'
    session.updatedAt = Date.now()
    const targetId = userId === session.callerId ? session.calleeId : session.callerId
    try {
      server.pushNotification(targetId, {
        type: 'webrtc_voice',
        event: 'offer',
        sessionId: session.sessionId,
        offer: body.offer,
      })
    } catch {
      /* ignore */
    }
    return reply.send(success({ sessionId: session.sessionId, status: session.status }))
  })

  // POST /ice-candidate — 交换 ICE 候选
  server.post('/ice-candidate', async (request, reply) => {
    const body = iceSchema.parse(request.body)
    const session = sessionStore.get(body.sessionId)
    if (!session) return reply.status(404).send(error(404, '会话不存在'))
    const userId = request.userId!
    if (userId !== session.callerId && userId !== session.calleeId) {
      return reply.status(403).send(error(403, '无权操作该会话'))
    }
    const from = body.from ?? (userId === session.callerId ? 'caller' : 'callee')
    session.candidates.push({ from, candidate: body.candidate })
    session.updatedAt = Date.now()
    const targetId = userId === session.callerId ? session.calleeId : session.callerId
    try {
      server.pushNotification(targetId, {
        type: 'webrtc_voice',
        event: 'ice_candidate',
        sessionId: session.sessionId,
        candidate: body.candidate,
        from,
      })
    } catch {
      /* ignore */
    }
    return reply.send(success({ sessionId: session.sessionId, delivered: true }))
  })

  // POST /end — 结束会话
  server.post('/end', async (request, reply) => {
    const body = endSchema.parse(request.body)
    const session = sessionStore.get(body.sessionId)
    if (!session) return reply.status(404).send(error(404, '会话不存在'))
    const userId = request.userId!
    if (userId !== session.callerId && userId !== session.calleeId) {
      return reply.status(403).send(error(403, '无权操作该会话'))
    }
    const endedBy = userId
    session.status = 'ended'
    session.updatedAt = Date.now()
    const targetId = userId === session.callerId ? session.calleeId : session.callerId
    try {
      server.pushNotification(targetId, {
        type: 'webrtc_voice',
        event: 'ended',
        sessionId: session.sessionId,
        endedBy,
      })
    } catch {
      /* ignore */
    }
    return reply.send(success({ sessionId: session.sessionId, status: 'ended' }))
  })
}
