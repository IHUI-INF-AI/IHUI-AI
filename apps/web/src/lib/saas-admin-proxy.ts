/**
 * P1-2.2: SaaS Admin API 代理
 *
 * 流程:web 前端 fetch /api/admin-saas/* → 本函数 → admin-api /admin/api/*
 *
 * 安全:
 * - 注入 X-Admin-API-Key(从 env 读取,前端不接触)
 * - 透传 X-Admin-User(由 Next.js middleware 从 cookie 注入)
 *
 * 错误处理:
 * - fetch 超时 (30s) → 504 AdminApiTimeout
 * - admin-api 不可达 → 503 AdminApiUnreachable
 * - 透传 admin-api 自身的 4xx/5xx
 */
import { NextResponse, type NextRequest } from 'next/server'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export const ADMIN_API_URL =
  process.env.ADMIN_API_URL ?? 'http://127.0.0.1:3005'

export const ADMIN_SAAS_API_KEY = process.env.ADMIN_SAAS_API_KEY ?? ''

/** 需要透传 body 的方法 */
const METHODS_WITH_BODY = new Set<HttpMethod>(['POST', 'PATCH', 'PUT'])

export async function forwardToAdminApi(
  request: NextRequest,
  method: HttpMethod,
): Promise<NextResponse> {
  // 1. 解析路径(去掉 /api/admin-saas/ 前缀)
  const path = request.nextUrl.pathname.replace(/^\/api\/admin-saas\//, '')
  const targetUrl = `${ADMIN_API_URL}/admin/api/${path}${request.nextUrl.search}`

  // 2. 复制 headers,删除 hop-by-hop + 长度相关
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('connection')

  // 3. 注入鉴权头
  headers.set('x-admin-api-key', ADMIN_SAAS_API_KEY)
  const adminUser = request.headers.get('x-admin-user')
  if (adminUser) {
    headers.set('x-admin-user', adminUser)
  }

  // 4. body
  let body: ArrayBuffer | undefined
  if (METHODS_WITH_BODY.has(method)) {
    try {
      body = await request.arrayBuffer()
    } catch {
      body = undefined
    }
  }

  // 5. fetch(30s 超时)
  try {
    const resp = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
      // 避免 Next.js 缓存 admin-api 响应(管理操作必须实时)
      cache: 'no-store',
    })

    // 6. 透传响应
    const respHeaders = new Headers(resp.headers)
    respHeaders.delete('content-encoding')
    respHeaders.delete('transfer-encoding')

    return new NextResponse(await resp.arrayBuffer(), {
      status: resp.status,
      headers: respHeaders,
    })
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    return NextResponse.json(
      {
        error: isTimeout ? 'AdminApiTimeout' : 'AdminApiUnreachable',
        message: isTimeout
          ? 'admin-api 响应超时(30s)'
          : err instanceof Error
            ? `admin-api 不可达: ${err.message}`
            : 'admin-api 不可达',
      },
      { status: isTimeout ? 504 : 503 },
    )
  }
}
