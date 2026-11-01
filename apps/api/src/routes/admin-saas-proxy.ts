// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

async function proxyToAdminApi(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 2026-11-01:密钥缺失必须在本进程短路。
  //
  // 原写法把 `ADMIN_SAAS_API_KEY ?? ''` 的空串照样塞进 x-admin-api-key 发出去 ——
  // 对上游是"拿一把空钥匙敲门",结果既拿不到数据,又把一次**配置事故**伪装成一次
  // 普通的上游 401/403。排障时会一路怀疑上游鉴权,而真相是本进程没配 env。
  // 缺配置是可判定的本地状态,就该在本地用 503 说清楚(同族范本见 ai-extended.ts 的
  // "AI 服务未配置(AI_SERVICE_URL)")。
  if (!ADMIN_SAAS_API_KEY) {
    return reply
      .status(503)
      .send(
        error(503, 'admin-api 代理未配置(缺 ADMIN_SAAS_API_KEY)', 'SAAS_PROXY_NOT_CONFIGURED'),
      )
  }

  // 解析路径(去掉 /api/admin-saas/ 前缀)
  const rest = request.url.replace(/^\/api\/admin-saas\//, '')
  const qIndex = rest.indexOf('?')
  const rawPath = qIndex === -1 ? rest : rest.slice(0, qIndex)
  const rawQuery = qIndex === -1 ? '' : rest.slice(qIndex)

  // 路径必须收在 /admin/api/ 之下:原写法直接拼进目标 URL,持有 admin 会话者可用
  // `/api/admin-saas/../anything`(%2e%2e%2f 同形)借服务器注入的 x-admin-api-key
  // 打到该内网主机 /admin/api/ 之外的任意路径。
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    return reply.status(400).send(error(400, '无效的代理路径', 'INVALID_SAAS_PROXY_PATH'))
  }
  const segments = decodedPath.split('/')
  if (
    decodedPath.startsWith('/') ||
    decodedPath.includes('\\') ||
    segments.some((s) => s === '..' || s === '.') ||
    segments.some((s) => s.includes(':')) ||
    decodedPath.includes('//')
  ) {
    return reply.status(400).send(error(400, '无效的代理路径', 'INVALID_SAAS_PROXY_PATH'))
  }

  const targetUrl = `${ADMIN_API_URL}/admin/api/${rawPath}${rawQuery}`

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
    const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    reply
      .status(isTimeout ? 504 : 503)
      .send(
        error(isTimeout ? 504 : 503, isTimeout ? 'admin-api 响应超时(30s)' : 'admin-api 不可达'),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
