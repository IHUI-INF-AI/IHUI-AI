// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 批改 thin 代理 — 把 POST /api/ai-marking/grade 透传到 ai-service 的 POST /api/ai-marking/grade。
 *
 * 设计:
 * - 仅转发,不伪造落库。持久化说明:落库链路已由 POST /ai-grading/grade 承担
 *   (查题库 + LLM + 插 aiGradingRecord),本代理不重复落库,不做第二份写入。
 * - 所有端点要求登录(authenticate preHandler,与 ai-tutor-routes.ts 同形)。
 * - ai-service 不可用/超时返回 502 明示,绝不伪造分数。
 * - 前端通过 fetchApi 调用 /api/ai-marking/*,由 API 服务代理到 ai-service(避免 CORS / 直连)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../plugins/auth.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { error, parseOrThrow, success } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'

const gradeBodySchema = z.object({
  subject: z.string().max(64).optional(),
  question: z.string().min(1),
  studentAnswer: z.string().min(1),
  referenceAnswer: z.string().max(8000).optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
})

type GradeBody = z.infer<typeof gradeBodySchema>

interface AiMarkingResult {
  score: number
  comment: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  maxScore: number
  error?: string
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

function toMarkingResult(payload: unknown, fallbackMaxScore: number): AiMarkingResult {
  const record: Record<string, unknown> =
    payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const result: AiMarkingResult = {
    score: asNumber(record['score'], 0),
    comment: asString(record['comment']),
    strengths: asStringArray(record['strengths']),
    weaknesses: asStringArray(record['weaknesses']),
    suggestions: asStringArray(record['suggestions']),
    maxScore: asNumber(record['maxScore'], fallbackMaxScore),
  }
  const err = record['error']
  if (typeof err === 'string' && err.length > 0) {
    result.error = err
  }
  return result
}

export const aiMarkingProxyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode =
        e !== null && typeof e === 'object' && 'statusCode' in e
          ? Number((e as { statusCode: unknown }).statusCode) || 401
          : 401
      // 必须 return reply,防止 handler 在未认证时继续执行(与 ai-tutor-routes.ts 同形)
      return reply
        .status(statusCode)
        .send(error(statusCode, toUserFriendlyMessage(e) || '需要登录'))
    }
  })

  server.post('/ai-marking/grade', async (request, reply) => {
    const body: GradeBody = parseOrThrow(gradeBodySchema, request.body)
    const fallbackMaxScore = body.maxScore ?? 100
    try {
      const upstream = await aiServiceFetch(request, '/api/ai-marking/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await upstream.text()
      let payload: unknown = text
      const ct = upstream.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          // 保留原始 text
        }
      }
      if (upstream.ok) {
        return reply
          .status(upstream.status)
          .send(success(toMarkingResult(payload, fallbackMaxScore)))
      }
      const record: Record<string, unknown> =
        payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
      const detail = record['detail']
      reply
        .status(upstream.status)
        .send(
          error(upstream.status, typeof detail === 'string' && detail ? detail : 'AI 批改请求失败'),
        )
    } catch (e) {
      request.log.error({ err: e }, 'ai-marking proxy failed')
      reply.status(502).send(error(502, 'ai-service unavailable'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
