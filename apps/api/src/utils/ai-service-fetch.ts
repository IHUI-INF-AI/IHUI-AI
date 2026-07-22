/**
 * ai-service fetch helper（2026-07-22 立，跨服务 traceparent 透传）。
 *
 * 封装 fetch(${config.AI_SERVICE_URL}...) 调用，自动：
 * - 从当前 Fastify request 解析或生成 traceparent（W3C 格式）
 * - 注入到出站 fetch headers `traceparent`（生成 child，保持同一 trace_id）
 * - 透传原始 `Authorization` 头（若 request 提供）
 *
 * 行为：
 * - request 非 null 且有 traceparent 头：生成 child traceparent（保持同一 trace）
 * - request 非 null 但无 traceparent 头：生成 root traceparent（新 trace）
 * - request 为 null（jobs 后台任务）：生成 root traceparent（新 trace）
 *
 * 复用 utils/trace-context.ts 的 generateTraceparent / getTraceparentFromRequest / childTraceparent。
 */

import type { FastifyRequest } from 'fastify'
import { config } from '../config/index.js'
import {
  generateTraceparent,
  getTraceparentFromRequest,
  childTraceparent,
} from './trace-context.js'

export interface AiServiceFetchOptions extends Omit<RequestInit, 'headers'> {
  /** 额外 headers，会与 traceparent 头合并（traceparent / X-Trace-Id 优先级最高，不被覆盖）。 */
  headers?: Record<string, string>
}

/**
 * 构造出站 traceparent + X-Trace-Id 头。
 * - 有 parent context：生成 child traceparent（保持同一 trace_id，新 parent_id）
 * - 无 parent：生成 root traceparent（新 trace）
 */
function buildTraceHeaders(request: FastifyRequest | null): {
  traceparent: string
  traceId: string
} {
  const parent = request ? getTraceparentFromRequest(request) : null
  if (parent) {
    const child = childTraceparent(parent)
    return { traceparent: child, traceId: parent.traceId }
  }
  const root = generateTraceparent()
  // root 格式：version-trace_id-parent_id-flags，取 trace_id（第 2 段）
  const parts = root.split('-')
  const traceId = parts[1] ?? ''
  return { traceparent: root, traceId }
}

/**
 * 调用 ai-service 的 helper，自动注入 traceparent 头。
 *
 * @param request 当前 Fastify request（用于解析 parent traceparent）；jobs 后台任务传 null
 * @param path 相对 ai-service 的路径（如 '/api/llm/complete'）
 * @param init 标准 fetch init，headers 字段限制为 Record<string, string>
 */
export async function aiServiceFetch(
  request: FastifyRequest | null,
  path: string,
  init: AiServiceFetchOptions = {},
): Promise<Response> {
  const { traceparent, traceId } = buildTraceHeaders(request)
  const userHeaders: Record<string, string> = init.headers ?? {}
  // traceparent / X-Trace-Id 优先级最高，确保不被用户 headers 覆盖
  const headers: Record<string, string> = {
    ...userHeaders,
    traceparent,
    'X-Trace-Id': traceId,
  }
  // 透传原始 Authorization 头（若 request 提供 且 init.headers 没显式给）
  if (
    request &&
    !userHeaders.Authorization &&
    !userHeaders.authorization &&
    request.headers.authorization
  ) {
    headers.Authorization = request.headers.authorization
  }
  const url = `${config.AI_SERVICE_URL}${path}`
  return fetch(url, {
    ...init,
    headers,
  })
}

/**
 * SSE 流式 fetch，返回标准 Response（调用方自行 resp.body.getReader() 消费）。
 *
 * 行为与 aiServiceFetch 完全一致，只是语义上明确用于 SSE 流式调用，
 * 便于调用方意图明确 + 后续可能扩展流式专用逻辑。
 */
export async function aiServiceFetchStream(
  request: FastifyRequest | null,
  path: string,
  init: AiServiceFetchOptions = {},
): Promise<Response> {
  return aiServiceFetch(request, path, init)
}
