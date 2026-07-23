/**
 * SaaS Admin API 代理路由 — 把 /api/admin-saas/* 透传到 admin-api /admin/api/*
 *
 * 迁移自 web 端 app/api/admin-saas/[...path]/route.ts(Next.js API route)。
 * A 套壳方案:output: 'export' 不支持 API routes,迁移到 apps/api。
 *
 * 安全:
 * - requireAdmin preHandler 校验 JWT + roleId >= 1
 * - 注入 x-admin-api-key(从 env 读取,前端不接触)
 * - 注入 x-admin-user(从 JWT userId 获取)
 *
 * 错误处理:
 * - fetch 超时(30s)→ 504
 * - admin-api 不可达 → 503
 * - 透传 admin-api 自身的 4xx/5xx
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { requireAdmin } from '../plugins/require-permission.js'
import { error } from '../utils/response.js'

const ADMIN_API_URL = (process.env.ADMIN_API_URL ?? 'http://127.0.0.1:8830').replace(/\/$/, '')
const ADMIN_SAAS_API_KEY = process.env.ADMIN_SAAS_API_KEY ?? ''

const METHODS_WITH_BODY = new Set(['POST', 'PATCH', 'PUT'])

async function proxyToAdminApi(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 解析路径(去掉 /api/admin-saas/ 前缀)
  const path = request.url.replace(/^\/api\/admin-saas\//, '')
  const targetUrl = `${ADMIN_API_URL}/admin/api/${path}`

  // 构造 headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-api-key': ADMIN_SAAS_API_KEY,
  }
  // 注入 x-admin-user(从 JWT userId 获取)
  if (request.userId) {
    headers['x-admin-user'] = request.userId
  }
  // 透传 authorization(让 admin-api 共享鉴权上下文)
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  // body
  let body: string | undefined
  if (METHODS_WITH_BODY.has(request.method)) {
    body = JSON.stringify(request.body ?? {})
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        /* 保留原始 text */
      }
    }
    reply.status(upstream.status).send(payload)
  } catch (e) {
    const isTimeout =
      e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    reply.status(isTimeout ? 504 : 503).send(
      error(
        isTimeout ? 504 : 503,
        isTimeout ? 'admin-api 响应超时(30s)' : 'admin-api 不可达',
      ),
    )
  }
}

export const adminSaasProxyRoutes: FastifyPluginAsync = async (server) => {
  // admin 鉴权:requireAdmin 校验 JWT + roleId >= 1
  server.addHook('preHandler', requireAdmin)

  // 通配符路由:透传所有 HTTP 方法到 admin-api
  server.route({
    method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    url: '/*',
    handler: proxyToAdminApi,
  })
}
