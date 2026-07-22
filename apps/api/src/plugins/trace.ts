import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { randomUUID } from 'node:crypto'

/**
 * Trace 中间件 — 为每个 API 请求生成 trace context,记录端到端调用链。
 *
 * 轻量级实现(不引入 @opentelemetry/api,与 otel.ts 互补):
 * - 每个请求生成 traceId + spanId(默认始终开启,不依赖 OTEL_ENABLED)
 * - 支持 W3C Trace Context 透传(从请求头 traceparent 解析上游 traceId/parentSpanId)
 * - 响应头回传 traceparent(方便前端/下游关联)
 * - 用 fastify 内置 log 记录每个请求的 trace 事件
 */

// W3C Trace Context 格式:version(2)-traceId(32)-spanId(16)-flags(2)
const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/

export interface TraceState {
  traceId: string
  spanId: string
  parentSpanId?: string
  endpoint: string
  startTime: number
}

const tracePluginInner: FastifyPluginAsync = async (server: FastifyInstance) => {
  // onRequest:生成/解析 trace context
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceparent = request.headers['traceparent'] as string | undefined
    let traceId: string
    let parentSpanId: string | undefined

    if (traceparent && TRACEPARENT_RE.test(traceparent)) {
      // 从上游继承 traceId + parentSpanId
      const match = traceparent.match(TRACEPARENT_RE)!
      traceId = match[2]!
      parentSpanId = match[3]!
    } else {
      // 新建 trace(32 hex)
      traceId = randomUUID().replace(/-/g, '').padEnd(32, '0')
    }

    // 当前 span(16 hex)
    const spanId = randomUUID().replace(/-/g, '').substring(0, 16)

    request.trace = {
      traceId,
      spanId,
      parentSpanId,
      endpoint: 'api',
      startTime: Date.now(),
    }

    // 响应头回传 traceparent(flags=01 sampled,方便下游/前端关联)
    reply.header('traceparent', `00-${traceId}-${spanId}-01`)
  })

  // onResponse:记录 trace 事件(轻量级,用 fastify log)
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.trace) return
    const duration = Date.now() - request.trace.startTime
    const status = reply.statusCode < 400 ? 'ok' : 'error'

    request.log.info(
      {
        traceId: request.trace.traceId,
        spanId: request.trace.spanId,
        parentSpanId: request.trace.parentSpanId,
        endpoint: 'api',
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: duration,
        status,
      },
      'trace event',
    )
  })

  // onError:记录错误 trace
  server.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    if (!request.trace) return
    request.log.error(
      {
        traceId: request.trace.traceId,
        spanId: request.trace.spanId,
        endpoint: 'api',
        error: error.message,
      },
      'trace error',
    )
  })
}

export const tracePlugin = fp(tracePluginInner, {
  name: 'trace-plugin',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyRequest {
    /** 当前请求的 trace 上下文(由 tracePlugin 在 onRequest 注入)。 */
    trace?: TraceState
  }
}
