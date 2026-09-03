// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { getSystemAccessToken } from './system-access-token.js'

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
  // 透传鉴权凭证给 ai-service：
  // - HTTP 场景:透传 request.headers.authorization
  // - WS 场景:鉴权 token 位于 query 参数(query.token),它是 ws 专用票据(type='ws'),
  //   ai-service 的 JWT 中间件只接受 type='access' 且 aud='ihui-ai-users' 的 token,
  //   直接透传会被 401。改用内部系统 token 调用 ai-service;真实 userId 已通过
  //   请求体(user_id)透传(见 ws-ai.ts),身份语义不丢失。
  // - 后台任务(request 为 null)且调用方未显式提供凭证:注入系统 access token。
  //   2026-09-04:ai-service jwt_auth 上线后,无凭证调用一律 401,后台任务的
  //   LLM/上下文/OpenCompass 抓取等调用全部静默失效;系统 token 身份为
  //   agent='system',与后台任务语义一致(此前仅 ai-feed-service 自行修复过)。
  if (!userHeaders.Authorization && !userHeaders.authorization) {
    if (request) {
      const authHeader = request.headers.authorization
      if (authHeader) {
        headers.Authorization = authHeader
      } else {
        const queryToken = (request.query as Record<string, unknown> | undefined)?.token
        if (typeof queryToken === 'string' && queryToken.length > 0) {
          headers.Authorization = `Bearer ${await getSystemAccessToken()}`
        }
      }
    } else {
      headers.Authorization = `Bearer ${await getSystemAccessToken()}`
    }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
