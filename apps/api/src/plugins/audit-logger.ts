/**
 * 国安级审计日志 Fastify 全局插件。
 *
 * 与现有 plugins/audit.ts(仅记录写操作 + 无防篡改)互补:
 * - 本插件记录所有请求(GET 10% 采样,非 GET 100%)
 * - 自动分类 action(auth.login / user.create / data.read / data.write / admin.op 等)
 * - 敏感字段脱敏(password/token/secret/apiKey → ***REDACTED***)
 * - UUID 路径参数截断(前 8 位 + ...)
 * - 通过 recordAuditLog 写入 HMAC 链式审计表(防篡改)
 *
 * 跳过健康检查(/api/health、/api/ready),避免噪音。
 * 用 setImmediate 异步落库,失败忽略,绝不阻塞业务响应。
 */
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify'
import fp from 'fastify-plugin'
import { recordAuditLog } from '../services/audit-log-service.js'

/** 需要脱敏的字段名(小写匹配,子串包含即脱敏)。 */
const SENSITIVE_KEYS = ['password', 'phone', 'idcard', 'bankcard', 'email', 'token', 'secret', 'apikey', 'api_key', 'authorization']

const REDACTED = '***REDACTED***'

/** 跳过记录的健康检查路径(精确匹配 url path 部分)。 */
const SKIP_PATHS = new Set(['/api/health', '/api/ready'])

/** GET 请求采样率(0-1)。 */
const GET_SAMPLE_RATE = 0.1

declare module 'fastify' {
  interface FastifyRequest {
    auditStartTime?: bigint
  }
}

/**
 * 深度脱敏:递归遍历对象,将敏感 key 的值替换为 ***REDACTED***。
 * 仅处理 plain object / array,跳过函数/Symbol/Date 等。
 * 返回新对象,不修改原 body(避免污染业务请求体)。
 */
function sanitizeDeep<T>(value: T, depth = 0): T {
  if (depth > 5) return value // 防止超深嵌套/循环引用
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeDeep(v, depth + 1)) as unknown as T
  }
  const proto = Object.getPrototypeOf(value)
  // 仅处理 plain object({})或其属性,跳过 Date/Buffer/Stream 等内置类型
  if (proto !== Object.prototype && proto !== null) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase()
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      out[k] = REDACTED
    } else {
      out[k] = sanitizeDeep(v, depth + 1)
    }
  }
  return out as T
}

/** 从 URL 提取 path 部分(去掉 query string)。 */
function urlPath(url: string): string {
  const qIdx = url.indexOf('?')
  return qIdx >= 0 ? url.slice(0, qIdx) : url
}

/** 解析 query string 为键值对象(轻量实现,避免依赖 URLSearchParams 边界问题)。 */
function parseQuery(url: string): Record<string, string> {
  const qIdx = url.indexOf('?')
  if (qIdx < 0) return {}
  const qs = url.slice(qIdx + 1)
  const out: Record<string, string> = {}
  for (const pair of qs.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const k = eq >= 0 ? pair.slice(0, eq) : pair
    const v = eq >= 0 ? pair.slice(eq + 1) : ''
    out[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return out
}

/** 脱敏 query 值(敏感 key → ***REDACTED***)。 */
function sanitizeQuery(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    const lowerKey = k.toLowerCase()
    out[k] = SENSITIVE_KEYS.some((s) => lowerKey.includes(s)) ? REDACTED : v
  }
  return out
}

/**
 * 脱敏路径参数:数字 ID 保留,UUID 截断为前 8 位 + ...。
 * 例:/api/users/550e8400-e29b-41d4-a716-446655440000 → /api/users/550e8400...
 */
function sanitizePath(path: string): string {
  return path.replace(/\/([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '/$1...')
}

/** 从 method + URL 自动分类 action。 */
function classifyAction(method: string, path: string): string {
  const m = method.toUpperCase()
  const p = path.toLowerCase()

  // auth 相关
  if (p.includes('/auth/login') || p.includes('/auth/sso') || p.includes('/login')) {
    return m === 'POST' ? 'auth.login' : 'auth.access'
  }
  if (p.includes('/auth/logout') || p.includes('/logout')) return 'auth.logout'
  if (p.includes('/auth/') || p.includes('/mfa')) return 'auth.operation'

  // admin 相关(优先级高)
  if (p.includes('/admin/') || p.startsWith('/api/admin')) return 'admin.op'

  // users 资源
  if (p.includes('/users')) {
    if (m === 'POST') return 'user.create'
    if (m === 'PUT' || m === 'PATCH') return 'user.update'
    if (m === 'DELETE') return 'user.delete'
    return 'user.read'
  }

  // 通用读写
  if (m === 'GET') return 'data.read'
  if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') return 'data.write'
  return 'data.access'
}

/** 从 request 提取设备指纹(从 header 读取,若存在)。 */
function extractDeviceFingerprint(request: FastifyRequest): string | undefined {
  const h = request.headers['x-device-fingerprint']
  if (typeof h === 'string' && h.length > 0) return h.slice(0, 128)
  return undefined
}

const auditLoggerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 记录请求开始时间(用于计算响应耗时)
  server.addHook('onRequest', async (request: FastifyRequest) => {
    request.auditStartTime = process.hrtime.bigint()
  })

  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    const rawUrl = request.url
    const path = urlPath(rawUrl)

    // 跳过健康检查
    if (SKIP_PATHS.has(path)) return
    // 仅记录 /api 下请求
    if (!path.startsWith('/api/')) return

    // GET 采样 10%,非 GET 100%
    if (method === 'GET' && Math.random() >= GET_SAMPLE_RATE) return

    // 计算响应耗时(ms)
    const start = request.auditStartTime
    const responseTimeMs =
      start != null ? Number(process.hrtime.bigint() - start) / 1e6 : undefined

    const sanitizedPath = sanitizePath(path)
    const action = classifyAction(method, path)
    const userId = request.userId ?? request.jwtPayload?.userId
    const deviceFingerprint = extractDeviceFingerprint(request)
    const userAgent = request.headers['user-agent']

    // 脱敏 body(仅对有 body 的写请求;GET 一般无 body)
    let sanitizedBody: unknown = undefined
    if (
      method !== 'GET' &&
      method !== 'HEAD' &&
      request.body != null &&
      typeof request.body === 'object'
    ) {
      try {
        sanitizedBody = sanitizeDeep(request.body)
      } catch {
        sanitizedBody = { _note: 'body serialization failed' }
      }
    }

    const sanitizedQuery = sanitizeQuery(parseQuery(rawUrl))

    // 异步落库,绝不阻塞响应
    setImmediate(() => {
      recordAuditLog({
        userId,
        action,
        resourceType: extractResourceType(path),
        resourceId: extractResourceId(path),
        ip: request.ip,
        userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
        result: reply.statusCode < 400 ? 'success' : 'failure',
        metadata: {
          method,
          url: sanitizedPath,
          statusCode: reply.statusCode,
          responseTimeMs,
          query: sanitizedQuery,
          body: sanitizedBody,
          deviceFingerprint,
        },
      }).catch(() => {
        /* 审计写入失败不影响业务 */
      })
    })
  })
}

/** 从 URL path 提取资源类型(/api/users/123 → users)。 */
function extractResourceType(path: string): string | undefined {
  const segs = path.split('/').filter(Boolean)
  // 跳过 'api' / 'admin' 前缀
  const idx = segs[0] === 'api' ? 1 : 0
  const start = segs[idx] === 'admin' ? idx + 1 : idx
  return segs[start]
}

/** 从 URL path 提取资源 ID(最后一个路径段,若是数字或 UUID)。 */
function extractResourceId(path: string): string | undefined {
  const segs = path.split('/').filter(Boolean)
  if (segs.length < 2) return undefined
  const last = segs[segs.length - 1]
  if (!last) return undefined
  // 纯数字 ID
  if (/^\d+$/.test(last)) return last
  // UUID 截断(前 8 位)
  const uuidMatch = last.match(/^([0-9a-fA-F]{8})-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}/)
  if (uuidMatch && uuidMatch[1]) return uuidMatch[1] + '...'
  return undefined
}

export default fp(auditLoggerPlugin, {
  name: 'audit-logger-plugin',
  fastify: '5.x',
})
