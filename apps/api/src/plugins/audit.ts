// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { addAuditLog } from '../db/search-queries.js'
// O5 归因(2026-09-21):与 audit-logger 插件共用同一套归因/摘要实现,
// 避免两处各写一份脱敏与字段口径(audit_logs 与 audit_logs_chain 的归因字段必须可比对)。
import {
  buildParamSummary,
  buildRequestAttribution,
  isOpenSurfacePath,
  summarizeQuery,
} from './audit-logger.js'

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/**
 * 从请求 URL 提取资源类型。
 * 形如 /api/users/123 -> 'users'；/api/admin/audit-logs -> 'audit-logs'。
 */
function parseResourceType(urlPath: string): string | undefined {
  const segs = urlPath.split('/').filter(Boolean)
  if (segs[0] === 'api') segs.shift()
  if (segs[0] === 'admin') segs.shift()
  // 开放面 /v1/chat/completions -> 'chat'(版本前缀不是资源)
  if (segs[0] === 'v1' || segs[0] === 'v1beta') segs.shift()
  return segs[0]
}

/**
 * 审计日志中间件：记录所有 POST/PATCH/PUT/DELETE 的写请求到 audit_logs。
 * - 使用 onResponse 钩子，在响应发出后执行，不阻塞主流程。
 * - userId 从 JWT（authenticate 写入）取，未登录写操作记为 null。
 * - 用 setImmediate 异步落库，失败忽略，保证不影响业务请求。
 * - O5(2026-09-21):
 *   ① 覆盖范围扩到对外开放面(/v1/、/v1beta/),此前所有网关写调用在此表 0 记录;
 *   ② details 增记归因字段(apiKeyId / capability.scope / dataClass / method / url /
 *      routePattern / durationMs / statusCode)。audit_logs 无独立列,归因落 JSONB,
 *      查询用 details->>'apiKeyId'(不改表即可回答"哪把 key 在什么时候调了哪个端点");
 *   ③ 参数只落摘要(开放面为形状摘要),不落 prompt/body 原文,不落密钥。
 */
const auditPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    if (!WRITE_METHODS.has(method)) return

    const url = request.url.split('?')[0] ?? ''
    const openSurface = isOpenSurfacePath(url)
    if (!openSurface && !url.startsWith('/api/')) return

    const attribution = buildRequestAttribution(request, reply, reply.elapsedTime)
    const resourceType = parseResourceType(url)
    const params = (request.params ?? {}) as { id?: string }
    const resourceId = params.id
    const statusCode = reply.statusCode
    const userAgent = request.headers['user-agent']

    // 参数摘要:开放面只留形状;站内保留脱敏后的对象(既有读端口径不变)
    const body = request.body
    const paramSummary =
      body !== null && body !== undefined && typeof body === 'object'
        ? buildParamSummary(body, { rawValues: !openSurface })
        : undefined

    setImmediate(() => {
      addAuditLog({
        userId: attribution.userId ?? undefined,
        action: method,
        resourceType,
        resourceId,
        details: {
          url: attribution.url,
          statusCode,
          // ── O5 归因字段(JSONB,无需改表)──
          apiKeyId: attribution.apiKeyId,
          apiKeyOwnerId: attribution.apiKeyOwnerId,
          capabilityScope: attribution.capabilityScope,
          capabilityDataClass: attribution.capabilityDataClass,
          capabilityRisk: attribution.capabilityRisk,
          capabilityBillable: attribution.capabilityBillable,
          openSurface: attribution.openSurface,
          method: attribution.method,
          routePattern: attribution.routePattern,
          durationMs: attribution.durationMs,
          params: paramSummary,
          query: summarizeQuery(request.url, { rawValues: !openSurface }),
        },
        ip: request.ip,
        userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
      }).catch(() => {
        /* 审计写入失败不影响业务 */
      })
    })
  })
}

export default fp(auditPlugin, {
  name: 'audit-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
