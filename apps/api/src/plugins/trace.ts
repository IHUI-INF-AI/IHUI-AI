// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { randomUUID } from 'node:crypto'

/**
 * 请求日志的 URL 收窄 —— **只留 path,丢弃 query**。
 *
 * 病灶:`/api/ws/ai?token=<WS 票>`、`/v1/realtime?api_key=<key>` 这些凭据走 query
 * 传递;Fastify 默认的 `req` 序列化器(pino `stdSerializers.req`)会把 `req.url`
 * 原样写进 "incoming request" 日志。票 5 分钟、token 15 分钟内都能被重放,
 * 日志一旦外发(运维收集 / 日志平台 / 工单粘贴)= 凭据外发。
 *
 * 为什么不用 `redact.paths: ['req.url']`:那是整字段打码,排障最需要的 path 也一起没了。
 * 这里只切掉 `?` 之后的部分:method + path + status + 耗时仍然齐全。
 *
 * 为什么住在 trace.ts:server.ts 的 loggerConfig 与 trace 插件的两条日志必须用
 * **同一个**函数,而 server.ts 已经 import 本文件(tracePlugin),反向不成立 ——
 * 放在这里不会新增模块依赖边,也不需要再建一个只为切字符串的叶子文件。
 */
export function requestUrlPath(url: string | undefined | null): string {
  if (!url) return ''
  const queryIndex = url.indexOf('?')
  const withoutQuery = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const hashIndex = withoutQuery.indexOf('#')
  return hashIndex === -1 ? withoutQuery : withoutQuery.slice(0, hashIndex)
}

/** Fastify `logger.serializers.req` 的最小形状约束(只声明用到的两个字段)。 */
export interface RequestLogInput {
  method?: string
  url?: string
}

/**
 * `loggerConfig.serializers.req`:覆盖 Fastify 默认的 `req` 序列化器。
 * 只保留 method + path,不再输出 host/remoteAddress(需要来源 IP 的排障走 error_log
 * 或访问日志,那里不涉及请求 query)。
 */
export function requestLogSerializer(request: RequestLogInput): {
  method: string | undefined
  url: string
} {
  return { method: request.method, url: requestUrlPath(request.url) }
}

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
        // 2026-11-01:只记 path。原来记整条 request.url(query 带 WS 票 / access token /
        // api_key),而相对 URL 当时不在 redactUrl 的覆盖范围内 ⇒ 凭据原样落盘。
        url: requestUrlPath(request.url),
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
        // 2026-10-30 补:onError 原本只记 message,线上出现每小时 240 条
        // "Cannot write headers after they are sent" 却无法定位是哪条请求 —— 补方法+URL。
        method: request.method,
        url: requestUrlPath(request.url),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
