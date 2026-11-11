// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, tenantQuotas, type Tenant } from '@ihui/database'
import { normalizeHeaderStrict, parsePath } from '../utils/http-normalize.js'
// BUG-4:公开面清单与匹配收归单一真相源(plugins/public-paths.ts),租户隔离绕过与它共用同一把尺。
import { isTenantBypassPath as sharedIsPublicPath } from './public-paths.js'
// ihui_tenant_api_calls_total:与配额自增同一 onResponse 收口(setImmediate 内,标签白名单洗)
import { recordTenantApiCall } from './business-metrics.js'

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string
    tenant?: Tenant
  }
}

const DEFAULT_TENANT_HEADER = 'x-tenant-id'

/** 从 header / subdomain 解析租户标识。 */
export function resolveTenantIdentifier(request: FastifyRequest): string | null {
  // 1. X-Tenant-Id header (UUID 或 slug，字符集校验防注入)
  const headerVal = normalizeHeaderStrict(request.headers[DEFAULT_TENANT_HEADER])
  if (headerVal) {
    return headerVal
  }
  // 2. 子域名: <slug>.host.com
  const host = request.hostname.split(':')[0] ?? ''
  // IP 地址不作为租户标识符（避免 127.0.0.1 被误解析为 slug "127"）
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null
  const parts = host.split('.')
  const firstPart = parts[0]
  // 2026-08-27 扩展保留子域:平台自有服务/资产子域不被解析为租户 slug。
  // file.aizhs.top = 图片/文件 CDN(经 web 反向代理到 8802 /uploads);
  // bsm.aizhs.top = web 备用入口; ai.aizhs.top = AI 服务(云端直指 8803,本地经 8802 时也需放行)。
  const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'file', 'bsm', 'ai']
  if (parts.length >= 3 && firstPart && !RESERVED_SUBDOMAINS.includes(firstPart)) {
    return firstPart
  }
  return null
}

export function isPublicPath(url: string): boolean {
  return sharedIsPublicPath(parsePath(url))
}

/** 租户缓存：slug/uuid -> { tenant, expiredAt }，避免每请求查 DB。 */
const tenantCache = new Map<string, { tenant: Tenant | null; expiredAt: number }>()
const CACHE_TTL_MS = 60_000

async function lookupTenant(identifier: string): Promise<Tenant | null> {
  const now = Date.now()
  const cached = tenantCache.get(identifier)
  if (cached && now < cached.expiredAt) {
    return cached.tenant
  }
  let tenant: Tenant | undefined
  // UUID 格式直接按 id 查，否则按 slug
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
    ;[tenant] = await db.select().from(tenants).where(eq(tenants.id, identifier)).limit(1)
  } else {
    ;[tenant] = await db.select().from(tenants).where(eq(tenants.slug, identifier)).limit(1)
  }
  const result = tenant ?? null
  tenantCache.set(identifier, { tenant: result, expiredAt: now + CACHE_TTL_MS })
  return result
}

/** 清空租户缓存（租户变更后调用）。 */
export function clearTenantCache(): void {
  tenantCache.clear()
}

/**
 * 无租户标识时是否拒绝。
 * 缺省、空串，以及除显式 `false` 以外的任何值都是严格模式（fail-closed）。
 * 单租户兼容必须显式 `TENANT_STRICT_MODE=false`，不能靠「没配」绕过隔离。
 */
export function isTenantStrictMode(
  raw: string | undefined = process.env.TENANT_STRICT_MODE,
): boolean {
  if (raw === undefined) return true
  return raw.trim().toLowerCase() !== 'false'
}

/**
 * 多租户中间件：
 * - 从 header/subdomain 解析租户标识并校验存在性 + 状态
 * - 装饰 request.tenantId / request.tenant
 * - 行级过滤：下游查询通过 request.tenantId 隔离数据
 * - 配额检查：API 调用计数自增，超额拒绝
 */
const tenantPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url)) return

    const identifier = resolveTenantIdentifier(request)
    if (!identifier) {
      // 缺省即严格:未携带租户标识 → 401。只有显式 TENANT_STRICT_MODE=false 才放行单租户。
      if (isTenantStrictMode()) {
        return reply.status(401).send({
          code: 401,
          message: '多租户严格模式已启用,请求必须携带租户标识(X-Tenant-Id 或 Authorization)',
        })
      }
      return
    }

    const tenant = await lookupTenant(identifier)
    if (!tenant) {
      return reply.status(404).send({ code: 404, message: '租户不存在' })
    }
    if (tenant.status === 0) {
      return reply.status(403).send({ code: 403, message: '租户已停用' })
    }

    request.tenantId = tenant.id
    request.tenant = tenant
  })

  // onResponse: 对 /api 写请求做 API 调用配额计数（异步，不阻塞响应）
  server.addHook('onResponse', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.tenantId) return
    const url = request.url.split('?')[0] ?? ''
    if (!url.startsWith('/api/')) return
    setImmediate(() => {
      // ihui_tenant_api_calls_total:tenant_id 白名单洗 + 基数上限(防恶意 header 炸基数)
      recordTenantApiCall(request.tenantId!)
      db.update(tenantQuotas)
        .set({ apiCallsUsed: sql`${tenantQuotas.apiCallsUsed} + 1` })
        .where(eq(tenantQuotas.tenantId, request.tenantId!))
        .catch(() => {
          /* 配额计数失败不影响业务 */
        })
    })
  })
}

export default fp(tenantPlugin, {
  name: 'tenant-plugin',
  fastify: '5.x',
})

/** 检查租户配额，超额抛错。供路由层显式调用。 */
export async function checkQuota(
  tenantId: string,
  dimension: 'apiCalls' | 'storage' | 'users',
  increment = 0,
): Promise<void> {
  const [quota] = await db
    .select()
    .from(tenantQuotas)
    .where(eq(tenantQuotas.tenantId, tenantId))
    .limit(1)
  if (!quota) return

  if (dimension === 'apiCalls' && quota.apiCallsUsed + increment > quota.apiCallsLimit) {
    const err = new Error('API 调用配额已用尽')
    ;(err as Error & { statusCode: number }).statusCode = 429
    throw err
  }
  if (dimension === 'storage' && quota.storageUsedMb + increment > quota.storageLimitMb) {
    const err = new Error('存储配额已用尽')
    ;(err as Error & { statusCode: number }).statusCode = 429
    throw err
  }
  if (dimension === 'users' && quota.userCount + increment > quota.userLimit) {
    const err = new Error('用户数配额已用尽')
    ;(err as Error & { statusCode: number }).statusCode = 429
    throw err
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
