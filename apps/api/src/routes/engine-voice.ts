// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * engine-voice 用户态代理(2026-10-19 立,为 RN D126 实时语音铺路)。
 *
 * 把 ai-service 的 /api/engine/voice/*(回合式语音会话,require_request_user_id)
 * 代理到本 API 的 /api/engine/voice/* 面上,requireAuth(用户 JWT)后透传:
 * - POST   /sessions          创建语音会话(JSON body 原样透传)
 * - POST   /sessions/:sid/turn 一轮语音对话(base64 音频 → 本服务组 multipart → 上游)
 * - DELETE /sessions/:sid     关闭会话
 *
 * 鉴权:aiServiceFetch 自动透传 request.headers.authorization(见
 * utils/ai-service-fetch.ts L86-100),上游用同一用户 JWT 校验会话归属。
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { aiServiceFetch, type AiServiceFetchOptions } from '../utils/ai-service-fetch.js'

// 创建会话 body(上游为 pydantic VoiceSessionCreate:threadId/sttLanguage/ttsVoice,全可选)
const sessionCreateSchema = z.looseObject({
  threadId: z.string().min(1).optional(),
  sttLanguage: z.string().min(1).optional(),
  ttsVoice: z.string().min(1).optional(),
})

// 一轮对话 body:RN 传 base64 音频;filename/language 可选
const turnBodySchema = z.object({
  audioBase64: z.string().min(1),
  filename: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
})

const sidParamSchema = z.object({ sid: z.string().min(1) })

/**
 * 调上游并透传响应。
 *
 * 上游错误(HTTPException 的 detail)按 ai-service 返回的状态码与 body 原样
 * 回传 —— 404(线程/会话不存在)、429(会话数上限)、400/502 等对 RN 语义
 * 有效,不吞成 500;非 JSON body 时包一层 { detail } 保持 JSON 形态。
 */
async function forwardUpstream(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
  init: AiServiceFetchOptions,
): Promise<FastifyReply> {
  const resp = await aiServiceFetch(request, path, init)
  const text = await resp.text()
  if (!resp.ok) {
    request.log.error({ status: resp.status, path }, 'engine-voice 上游返回错误')
    let body: unknown
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = { detail: text }
    }
    return reply.status(resp.status).send(body)
  }
  let data: unknown = {}
  try {
    data = JSON.parse(text) as unknown
  } catch {
    data = {}
  }
  return reply.send(data)
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 全部端点要求登录(用户态 JWT,上游同样按用户校验会话归属)
  server.addHook('preHandler', async (request, reply) => {
    return requireAuth(request, reply)
  })

  // -------------------------------------------------------------------------
  // POST /sessions — 创建语音会话(JSON body 原样透传)
  // 上游:POST /api/engine/voice/sessions → {sessionId, threadId, ttsVoice}
  // -------------------------------------------------------------------------
  server.post('/sessions', async (request, reply) => {
    const parsed = sessionCreateSchema.safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, '参数校验失败'))
    try {
      return await forwardUpstream(request, reply, '/api/engine/voice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `AI 服务调用异常: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // POST /sessions/:sid/turn — 一轮语音对话
  // RN 传 {audioBase64, filename?, language?};本服务把 base64 解码成 Blob
  // 组装 multipart(file 字段),经 aiServiceFetch 转发;不手工设 Content-Type,
  // 让 undici fetch 按 FormData 自动生成带 boundary 的头。响应 JSON 原样回传。
  // -------------------------------------------------------------------------
  server.post('/sessions/:sid/turn', async (request, reply) => {
    const param = sidParamSchema.safeParse(request.params)
    if (!param.success) return reply.status(400).send(error(400, 'sid 必填'))
    const parsed = turnBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'audioBase64 必填'))
    const { audioBase64, filename, language } = parsed.data
    const audio = Buffer.from(audioBase64, 'base64')
    if (audio.length === 0) return reply.status(400).send(error(400, 'audioBase64 不是合法的非空音频'))
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(audio)]), filename ?? 'audio.wav')
    if (language) form.append('language', language)
    try {
      return await forwardUpstream(
        request,
        reply,
        `/api/engine/voice/sessions/${encodeURIComponent(param.data.sid)}/turn`,
        { method: 'POST', body: form },
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `AI 服务调用异常: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /sessions/:sid — 关闭语音会话(引擎线程保留)
  // -------------------------------------------------------------------------
  server.delete('/sessions/:sid', async (request, reply) => {
    const param = sidParamSchema.safeParse(request.params)
    if (!param.success) return reply.status(400).send(error(400, 'sid 必填'))
    try {
      return await forwardUpstream(
        request,
        reply,
        `/api/engine/voice/sessions/${encodeURIComponent(param.data.sid)}`,
        { method: 'DELETE' },
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, `AI 服务调用异常: ${(e as Error).message}`))
    }
  })
}

export default plugin
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
