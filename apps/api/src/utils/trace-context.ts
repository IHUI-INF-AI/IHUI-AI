/**
 * traceparent 上下文工具(2026-07-22 立,跨服务 traceparent 透传)。
 *
 * W3C Trace Context 格式:version-trace_id-parent_id-flags
 * 例:00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * 核心能力:
 * - generateTraceparent():生成新 traceparent(新 trace)
 * - getTraceparentFromRequest():从 Fastify request 头解析
 * - propagateToHeaders():把 traceparent 注入到出站请求 headers(api → ai-service)
 * - extractTraceId():解析 trace_id(32 hex)
 */

import { randomBytes } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

export interface TraceContext {
  traceId: string      // 32 hex
  parentId: string     // 16 hex
  version: string      // 2 hex(通常 "00")
  flags: string        // 2 hex(通常 "01" sampled)
}

/**
 * 生成 W3C traceparent 字符串。
 * 格式:version-trace_id-parent_id-flags
 */
export function generateTraceparent(): string {
  const version = '00'
  const traceId = randomBytes(16).toString('hex')      // 32 hex
  const parentId = randomBytes(8).toString('hex')       // 16 hex
  const flags = '01'                                    // sampled
  return `${version}-${traceId}-${parentId}-${flags}`
}

/**
 * 从 Fastify request 的 traceparent 头解析 trace 上下文。
 * 如果头不存在或格式非法,返回 null。
 */
export function getTraceparentFromRequest(request: FastifyRequest): TraceContext | null {
  const header = request.headers['traceparent'] as string | undefined
  if (!header) return null
  return parseTraceparent(header)
}

/**
 * 解析 traceparent 字符串。
 * 格式:version-trace_id-parent_id-flags
 */
export function parseTraceparent(traceparent: string): TraceContext | null {
  const parts = traceparent.split('-')
  if (parts.length !== 4) return null
  const [version, traceId, parentId, flags] = parts
  if (!version || !traceId || !parentId || !flags) return null
  if (traceId.length !== 32 || parentId.length !== 16) return null
  if (!/^[0-9a-f]+$/i.test(traceId) || !/^[0-9a-f]+$/i.test(parentId)) return null
  return { version, traceId, parentId, flags }
}

/**
 * 提取 trace_id(32 hex)。
 */
export function extractTraceId(traceparent: string | undefined | null): string | null {
  if (!traceparent) return null
  const ctx = parseTraceparent(traceparent)
  return ctx?.traceId ?? null
}

/**
 * 把 traceparent 注入到出站请求 headers。
 * 用于 api 调用 ai-service 时透传 trace 上下文。
 *
 * 用法:
 *   const headers = propagateToHeaders(request)
 *   const resp = await fetch('http://ai-service:8803/api/llm/complete', { headers })
 *
 * 如果入站 request 无 traceparent,生成新的(开启新 trace)。
 * 如果有,透传原 traceparent(延续同一 trace)。
 */
export function propagateToHeaders(request?: FastifyRequest | null): Record<string, string> {
  const ctx = request ? getTraceparentFromRequest(request) : null
  const traceparent = ctx
    ? `${ctx.version}-${ctx.traceId}-${ctx.parentId}-${ctx.flags}`
    : generateTraceparent()
  return {
    'traceparent': traceparent,
    'X-Trace-Id': ctx?.traceId ?? (traceparent.split('-')[1] ?? ''),
  }
}

/**
 * 生成子 span 的 traceparent(用于内部调用链)。
 * 保持同一 trace_id,生成新的 parent_id。
 */
export function childTraceparent(parent: TraceContext): string {
  const version = parent.version
  const traceId = parent.traceId
  const newParentId = randomBytes(8).toString('hex')
  const flags = parent.flags
  return `${version}-${traceId}-${newParentId}-${flags}`
}
