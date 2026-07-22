/**
 * DAP Debug 路由代理 — 把 /api/debug/* 透传到 ai-service 的 /api/v1/debug/*。
 *
 * 端点清单(完整代理,10 个):
 *   POST   /debug/launch                              启动调试会话
 *   POST   /debug/attach                              附加到已运行进程
 *   GET    /debug/sessions                            列出所有会话
 *   POST   /debug/sessions/:sessionId/breakpoints     设置断点
 *   POST   /debug/sessions/:sessionId/continue        继续执行
 *   POST   /debug/sessions/:sessionId/step            单步执行
 *   GET    /debug/sessions/:sessionId/stack           获取调用栈
 *   GET    /debug/sessions/:sessionId/variables       获取变量(frameId 查询参数)
 *   POST   /debug/sessions/:sessionId/eval            求值表达式
 *   DELETE /debug/sessions/:sessionId                 断开调试会话
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - 使用 aiServiceFetch 代理,自动注入 traceparent + Authorization
 * - ai-service 已返回 { code, message, data } 格式,直接透传状态码 + body
 * - 错误处理:ai-service 返回 4xx/5xx 时透传状态码和错误信息;网络异常返回 502
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { authenticate } from '../plugins/auth.js'
import { error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

/**
 * 透传代理到 ai-service 的 /api/v1/debug/* 端点。
 * - GET/HEAD:不转发 body
 * - 其他方法:转发 JSON body
 * - query string:由调用方拼接到 path 中
 * - 状态码 + 响应体原样透传(ai-service 已是 { code, message, data } 格式)
 */
async function proxyDebug(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> {
  const method = request.method
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(request.body ?? {})
  }

  try {
    const upstream = await aiServiceFetch(request, `/api/v1/debug${path}`, init)
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        // 保留原始 text
      }
    }
    reply.status(upstream.status).send(payload)
  } catch (e) {
    request.log.error({ err: e, path }, 'debug proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request: FastifyRequest) => {
    await authenticate(request)
  })

  // 启动调试会话:body {language, program, args?, cwd?, env?} → {sessionId}
  app.post('/launch', async (request, reply) => {
    await proxyDebug(request, reply, '/launch')
  })

  // 附加到已运行进程:body {language, port, host?} → {sessionId}
  app.post('/attach', async (request, reply) => {
    await proxyDebug(request, reply, '/attach')
  })

  // 列出所有会话 → {sessions}
  app.get('/sessions', async (request, reply) => {
    await proxyDebug(request, reply, '/sessions')
  })

  // 设置断点:body {file, lines: [{line, condition?}]} → {breakpoints}
  app.post('/sessions/:sessionId/breakpoints', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}/breakpoints`)
  })

  // 继续执行 → {stopped}
  app.post('/sessions/:sessionId/continue', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}/continue`)
  })

  // 单步执行:body {stepType} → {stopped}
  app.post('/sessions/:sessionId/step', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}/step`)
  })

  // 获取调用栈 → {stackFrames}
  app.get('/sessions/:sessionId/stack', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}/stack`)
  })

  // 获取变量:?frameId=X → {variables}
  app.get('/sessions/:sessionId/variables', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const qs = request.url.split('?')[1] ?? ''
    const base = `/sessions/${encodeURIComponent(sessionId)}/variables`
    await proxyDebug(request, reply, qs ? `${base}?${qs}` : base)
  })

  // 求值表达式:body {expression, frameId?} → {result, type?}
  app.post('/sessions/:sessionId/eval', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}/eval`)
  })

  // 断开调试会话 → {disconnected}
  app.delete('/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    await proxyDebug(request, reply, `/sessions/${encodeURIComponent(sessionId)}`)
  })
}
