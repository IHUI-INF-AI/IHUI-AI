// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { guardTenantAccess } from '../services/tenant-access.js'
import {
  TENANT_PLATFORM_IDS,
  TenantPlatformAppError,
  deleteTenantPlatformApp,
  importEnvPlatformCredentials,
  isTenantPlatformId,
  listTenantPlatformApps,
  upsertTenantPlatformApp,
} from '../services/tenant-platform-apps.js'
import { success, error } from '../utils/response.js'

const platformParam = z.object({ platform: z.string() })
const upsertSchema = z.object({
  appId: z.string().trim().min(1, '应用 ID 不能为空').max(255),
  appSecret: z.string().max(8192).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})
const importSchema = z.object({
  platforms: z.array(z.string()).optional(),
})

/**
 * 租户级平台应用凭据管理（2026-11-23）。
 *
 * 多企业 SaaS 下，飞书/钉钉/企微/微信应用凭据必须按租户隔离：
 * - 租户管理员在这里填本企业自建应用；
 * - secret 只在写路径出现，列表只回掩码；
 * - 单租户/默认租户可以显式把现有环境凭据导入，避免重复申请。
 */
export const tenantPlatformAppRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', authenticate)

  server.get('/', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      reply.status(400).send(error(400, '需要租户上下文（X-Tenant-Id 或子域名）'))
      return
    }
    if (!(await guardTenantAccess(request, reply, tenantId, 'admin'))) return
    const apps = await listTenantPlatformApps(tenantId)
    reply.header('Cache-Control', 'no-store')
    return success({ tenantId, apps })
  })

  server.put('/:platform', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      reply.status(400).send(error(400, '需要租户上下文（X-Tenant-Id 或子域名）'))
      return
    }
    if (!(await guardTenantAccess(request, reply, tenantId, 'admin'))) return

    const params = platformParam.safeParse(request.params)
    if (!params.success || !isTenantPlatformId(params.data.platform)) {
      reply.status(400).send(error(400, `不支持的平台，可选：${TENANT_PLATFORM_IDS.join(', ')}`))
      return
    }
    const parsed = upsertSchema.safeParse(request.body)
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }

    try {
      const status = await upsertTenantPlatformApp({
        tenantId,
        platform: params.data.platform,
        appId: parsed.data.appId,
        appSecret: parsed.data.appSecret,
        extra: parsed.data.extra,
        enabled: parsed.data.enabled,
        userId: request.userId,
      })
      reply.header('Cache-Control', 'no-store')
      return success(status)
    } catch (err) {
      return sendTenantAppError(reply, err)
    }
  })

  server.delete('/:platform', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      reply.status(400).send(error(400, '需要租户上下文（X-Tenant-Id 或子域名）'))
      return
    }
    if (!(await guardTenantAccess(request, reply, tenantId, 'admin'))) return

    const params = platformParam.safeParse(request.params)
    if (!params.success || !isTenantPlatformId(params.data.platform)) {
      reply.status(400).send(error(400, `不支持的平台，可选：${TENANT_PLATFORM_IDS.join(', ')}`))
      return
    }
    const removed = await deleteTenantPlatformApp(tenantId, params.data.platform)
    return success({ removed })
  })

  server.post('/import-env', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      reply.status(400).send(error(400, '需要租户上下文（X-Tenant-Id 或子域名）'))
      return
    }
    if (!(await guardTenantAccess(request, reply, tenantId, 'admin'))) return

    const parsed = importSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      return
    }
    const platforms = parsed.data.platforms
    if (platforms?.some((platform) => !isTenantPlatformId(platform))) {
      reply.status(400).send(error(400, `不支持的平台，可选：${TENANT_PLATFORM_IDS.join(', ')}`))
      return
    }
    try {
      const result = await importEnvPlatformCredentials({
        tenantId,
        userId: request.userId,
        platforms: platforms as (typeof TENANT_PLATFORM_IDS)[number][] | undefined,
      })
      return success(result)
    } catch (err) {
      return sendTenantAppError(reply, err)
    }
  })
}

function sendTenantAppError(reply: FastifyReply, err: unknown) {
  if (err instanceof TenantPlatformAppError) {
    const status =
      err.code === 'CREDENTIALS_CORRUPTED' ? 500 : err.code === 'ENV_SCOPE_FORBIDDEN' ? 403 : 400
    reply.status(status).send(error(status, err.message))
    return
  }
  throw err
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
