/**
 * 资源上游自动同步中心路由(2026-07-24 立)。
 *
 * 本文件由多 subagent 协作构建:
 *   - P0-2 任务:registry items 列表/详情/同步触发/webhook/安装升级端点
 *   - P0-3 任务:配置漂移检测 + 自动迁移端点
 *
 * 注册位置:routes/index.ts
 *   server.register(registrySyncRoutes, { prefix: '/api' })
 * 路由路径均以 /registry 开头,最终 URL 前缀 /api/registry/*。
 *
 * P0-2 端点(8 个):
 *   - GET    /registry/items            列表(sort=latest/hot/best + 模糊搜索 + 分页)
 *   - GET    /registry/items/:id        详情(install_status 先固定 not_installed)
 *   - GET    /registry/sync-logs        同步日志列表
 *   - POST   /registry/sync             手动触发同步(管理员,入队 BullMQ)
 *   - GET    /registry/webhooks         webhook 触发记录列表(管理员)
 *   - POST   /registry/webhook/:source  接收上游 webhook(HMAC-SHA256 签名校验,无鉴权)
 *   - POST   /registry/install          安装(简化版:写 user_preferences group='registry_installs')
 *   - POST   /registry/upgrade-all      批量升级(管理员)
 *
 * P0-3 端点(4 个,均 requireAdmin):
 *   - GET  /registry/config-drift            检测所有配置漂移
 *   - POST /registry/config-baseline         更新基线(标记当前为已知良好)
 *   - POST /registry/config-migrate          触发迁移(dryRun 默认 true)
 *   - GET  /registry/config-migrate/history  迁移历史(从备份目录列出)
 *
 * 触发机制:定时拉取(每 6 小时一次 cron 任务,表达式见 registry-queue.ts)+ webhook 推送,均入队 registry-sync-queue。
 */
import type { FastifyPluginAsync } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql, and, eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db, dbRead } from '../db/index.js'
import { registryItems } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { checkAuth } from '../plugins/auth.js'
import {
  listRegistryItems,
  getRegistryItem,
  listSyncLogs,
  listWebhookTriggers,
  insertWebhookTrigger,
  markWebhookTriggerProcessed,
} from '../db/registry-queries.js'
import {
  enqueueManualSync,
  enqueueWebhookSync,
  scheduleRegistrySync,
} from '../plugins/registry-queue.js'
import type {
  RegistryUpstreamSource,
  RegistrySyncRequest,
  RegistrySyncResponse,
  RegistryWebhookResponse,
  InstallRegistryItemRequest,
  InstallRegistryItemResponse,
  UpgradeAllResponse,
  ConfigFileType,
  ConfigMigrateRequest,
} from '@ihui/types'
// P0-3 配置漂移
import {
  detectAllDrift,
  detectDrift,
  updateBaseline,
} from '../services/registry-sync/config-drift-detector.js'
import {
  listMigrationHistory,
  migrateConfig,
} from '../services/registry-sync/config-migrator.js'

// =============================================================================
// Zod schemas — P0-2
// =============================================================================

const listItemsQuerySchema = z.object({
  sourceType: z.enum(['mcp', 'skill', 'plugin']).optional(),
  source: z.enum(['github', 'npm', 'mcp_marketplace', 'custom']).optional(),
  sort: z.enum(['latest', 'hot', 'best']).optional(),
  q: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const listLogsQuerySchema = z.object({
  sourceType: z.enum(['mcp', 'skill', 'plugin']).optional(),
  status: z.enum(['success', 'fail', 'skipped', 'running']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const syncBodySchema = z.object({
  sourceType: z.enum(['mcp', 'skill', 'plugin']).optional(),
  source: z.enum(['github', 'npm', 'mcp_marketplace', 'custom']).optional(),
  force: z.boolean().optional(),
})

const listWebhooksQuerySchema = z.object({
  source: z.enum(['github', 'npm', 'mcp_marketplace', 'custom']).optional(),
  status: z.enum(['pending', 'processed', 'failed', 'ignored']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const webhookSourceParamSchema = z.object({
  source: z.enum(['github', 'npm', 'mcp_marketplace', 'custom']),
})

const installBodySchema = z.object({
  sourceType: z.enum(['mcp', 'skill', 'plugin']),
  sourceId: z.string().min(1).max(255),
  version: z.string().max(100).optional(),
})

const upgradeAllBodySchema = z.object({
  sourceType: z.enum(['mcp', 'skill', 'plugin']).optional(),
})

// =============================================================================
// Zod schemas — P0-3 配置漂移
// =============================================================================

const fileTypeSchema = z.enum([
  'env_example',
  'env_production_example',
  'config_py',
  'package_json',
  'docker_compose',
])

const baselineBodySchema = z.object({
  fileType: fileTypeSchema.optional(),
})

const migrateBodySchema = z.object({
  fileType: fileTypeSchema.optional(),
  dryRun: z.boolean().optional(),
  rollbackThreshold: z.number().int().min(0).max(20).optional(),
})

// =============================================================================
// HMAC 签名校验(P0-2,参考 webhooks-trigger.ts,用 timingSafeEqual 防时序攻击)
// =============================================================================

const SOURCE_SECRET_ENV: Record<RegistryUpstreamSource, string> = {
  github: 'GITHUB_WEBHOOK_SECRET',
  npm: 'NPM_WEBHOOK_SECRET',
  mcp_marketplace: 'MCP_MARKETPLACE_WEBHOOK_SECRET',
  custom: 'CUSTOM_WEBHOOK_SECRET',
}

/** 取签名头:github 用 X-Hub-Signature-256(格式 sha256=<hex>),其余用 X-Webhook-Signature(hex) */
function extractSignature(
  source: RegistryUpstreamSource,
  headers: Record<string, string | string[] | undefined>,
): string {
  if (source === 'github') {
    const h = (headers['x-hub-signature-256'] as string | undefined) ?? ''
    return h.startsWith('sha256=') ? h.slice('sha256='.length) : h
  }
  return (headers['x-webhook-signature'] as string | undefined) ?? ''
}

function verifyHmac(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(signature, 'utf8')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

/** 从 payload 推导事件名称(用于落库 webhook_triggers.name / event_type) */
function deriveEventName(
  source: RegistryUpstreamSource,
  payload: unknown,
): { name: string; eventType: string } {
  const p = (payload as Record<string, unknown> | null) ?? {}
  if (source === 'github') {
    const event = (p.action as string) ?? (p.event as string) ?? 'push'
    const repo = (p.repository as { full_name?: string } | undefined)?.full_name ?? 'unknown'
    return { name: `${repo} (${event})`, eventType: event }
  }
  if (source === 'npm') {
    const event = (p.event as string) ?? 'package-update'
    const name = (p.name as string) ?? 'unknown'
    return { name: `${name} (${event})`, eventType: event }
  }
  const event = (p.event as string) ?? 'update'
  const name = (p.name as string) ?? (p.id as string) ?? 'unknown'
  return { name: `${name} (${event})`, eventType: event }
}

// =============================================================================
// 路由插件
// =============================================================================

export const registrySyncRoutes: FastifyPluginAsync = async (server) => {
  // 启动时注册定时同步 job(每 6 小时一次)。index.ts 不可改,用 onReady hook 触发。
  server.addHook('onReady', async () => {
    try {
      await scheduleRegistrySync(server.redisForQueue)
      server.log.info('registry sync scheduled (cron 0 */6 * * *)')
    } catch (err) {
      server.log.error({ err }, 'failed to schedule registry sync')
    }
  })

  // ==========================================================================
  // P0-2:资源条目 CRUD + 同步触发 + webhook + 安装升级
  // ==========================================================================

  // 1. GET /registry/items — 列表
  server.get('/registry/items', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listItemsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const data = await listRegistryItems(parsed.data)
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询资源列表失败'))
    }
  })

  // 2. GET /registry/items/:id — 详情
  server.get<{ Params: { id: string } }>(
    '/registry/items/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      try {
        const detail = await getRegistryItem(id)
        if (!detail) return reply.status(404).send(error(404, '资源不存在'))
        return reply.send(success(detail))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询资源详情失败'))
      }
    },
  )

  // 3. GET /registry/sync-logs — 同步日志列表
  server.get('/registry/sync-logs', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listLogsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const data = await listSyncLogs(parsed.data)
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询同步日志失败'))
    }
  })

  // 4. POST /registry/sync — 手动触发同步(管理员)
  server.post('/registry/sync', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = syncBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data as RegistrySyncRequest
    try {
      const jobId = await enqueueManualSync(server.redisForQueue, {
        sourceType: body.sourceType ?? null,
        source: body.source ?? null,
        force: body.force ?? false,
      })
      const resp: RegistrySyncResponse = {
        success: true,
        jobId: jobId ?? null,
        message: '同步任务已入队,后台异步执行',
        stats: { synced: 0, failed: 0, skipped: 0, durationMs: 0 },
      }
      return reply.status(202).send(success(resp))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '入队同步任务失败'))
    }
  })

  // 5. GET /registry/webhooks — webhook 触发记录列表(管理员)
  server.get('/registry/webhooks', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listWebhooksQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const data = await listWebhookTriggers(parsed.data)
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 webhook 触发记录失败'))
    }
  })

  // 6. POST /registry/webhook/:source — 接收上游 webhook(HMAC 签名校验,无鉴权)
  server.post<{ Params: { source: RegistryUpstreamSource } }>(
    '/registry/webhook/:source',
    async (request, reply) => {
      const paramParsed = webhookSourceParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        return reply.status(400).send(error(400, '无效的 source 参数'))
      }
      const source = paramParsed.data.source

      // 原始 payload(签名基于原始字节,不能先 JSON.parse)
      const rawPayload =
        typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})

      const signature = extractSignature(source, request.headers)
      const secret = process.env[SOURCE_SECRET_ENV[source]] ?? ''
      const signatureValid = verifyHmac(rawPayload, signature, secret)

      // 解析 payload 用于事件名推导 + 后续同步
      let parsedPayload: unknown
      try {
        parsedPayload =
          typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      } catch {
        parsedPayload = request.body
      }
      const { name, eventType } = deriveEventName(source, parsedPayload)

      // 落库 webhook 触发记录(无论签名是否通过,均落库供审计)
      // 签名失败 → status='ignored';签名成功 → status='pending'
      const triggerStatus = signatureValid ? 'pending' : 'ignored'
      let triggerId: string
      try {
        const record = await insertWebhookTrigger({
          name,
          eventType,
          source,
          signature: signature || null,
          payload: (parsedPayload as Record<string, unknown>) ?? {},
          status: triggerStatus,
        })
        triggerId = record.id
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '落库 webhook 触发记录失败'))
      }

      // 签名失败 → 401(但记录已落库 status='ignored')
      if (!signatureValid) {
        return reply.status(401).send(error(401, '签名验证失败'))
      }

      // 签名成功 → 入队同步任务 → 立即返回 202
      let syncTriggered = false
      try {
        const jobId = await enqueueWebhookSync(server.redisForQueue, {
          sourceType: null,
          source,
          force: false,
          triggerId,
        })
        syncTriggered = !!jobId
        await markWebhookTriggerProcessed(
          triggerId,
          'processed',
          `sync job ${jobId ?? 'enqueued'}`,
        )
      } catch (e) {
        request.log.error(e)
        await markWebhookTriggerProcessed(triggerId, 'failed', '入队同步任务失败')
      }

      const resp: RegistryWebhookResponse = {
        accepted: true,
        triggerId,
        syncTriggered,
        message: syncTriggered ? '已接受,同步任务已入队' : '已接受,但同步任务入队失败',
      }
      return reply.status(202).send(success(resp))
    },
  )

  // 7. POST /registry/install — 安装(简化版:写 user_preferences group='registry_installs')
  server.post('/registry/install', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = installBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data as InstallRegistryItemRequest

    try {
      // 查 registry_items:按 sourceType + sourceId 取最高热度的匹配
      const rows = await dbRead
        .select({
          id: registryItems.id,
          version: registryItems.version,
          name: registryItems.name,
        })
        .from(registryItems)
        .where(
          and(
            eq(registryItems.sourceType, body.sourceType),
            eq(registryItems.sourceId, body.sourceId),
          ),
        )
        .orderBy(desc(registryItems.heatScore))
        .limit(1)
      const item = rows[0]
      if (!item) return reply.status(404).send(error(404, '资源不存在'))

      const installedVersion = body.version ?? item.version ?? 'latest'
      // upsert user_preferences (userId, group='registry_installs', key=`${sourceType}:${sourceId}`)
      await db.execute(
        sql`INSERT INTO "user_preferences" ("user_id", "group", "key", "value")
            VALUES (${userId}, ${'registry_installs'}, ${`${body.sourceType}:${body.sourceId}`}, ${installedVersion})
            ON CONFLICT ("user_id", "group", "key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = NOW()`,
      )

      const resp: InstallRegistryItemResponse = {
        success: true,
        installed: true,
        version: installedVersion,
        message: `已安装 ${item.name}`,
      }
      return reply.send(success(resp))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '安装失败'))
    }
  })

  // 8. POST /registry/upgrade-all — 批量升级(管理员,简化版)
  server.post('/registry/upgrade-all', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = upgradeAllBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const sourceTypeFilter = parsed.data.sourceType

    try {
      // 简化版:查所有已安装记录,对比 registry_items 最新版本,返回可升级统计。
      // 完整升级逻辑(接入 MCP/Skill/Plugin 安装机制)留 P2。
      const rows = (await db.execute(
        sql`SELECT up."user_id" AS user_id, up."key" AS key, up."value" AS installed_version, ri."version" AS latest_version, ri."name" AS name
            FROM "user_preferences" up
            LEFT JOIN "registry_items" ri
              ON ri."source_type" || ':' || ri."source_id" = up."key"
            WHERE up."group" = ${'registry_installs'}
            ${sourceTypeFilter ? sql`AND split_part(up."key", ':', 1) = ${sourceTypeFilter}` : sql``}`,
      )) as Array<{
        user_id: string
        key: string
        installed_version: string | null
        latest_version: string | null
        name: string | null
      }>

      let upgraded = 0
      let skipped = 0
      const details: UpgradeAllResponse['details'] = []
      for (const r of rows) {
        const latest = r.latest_version
        const installed = r.installed_version
        if (!latest || !installed || installed === latest || installed === 'latest') {
          skipped++
          details.push({
            sourceId: r.key,
            status: 'skipped',
            message: installed === 'latest' ? '已安装 latest,跳过' : '已是最新版本',
          })
        } else {
          // 简化:仅标记可升级,不实际执行升级(完整安装机制留 P2)
          upgraded++
          details.push({
            sourceId: r.key,
            status: 'upgraded',
            message: `${r.name ?? r.key}: ${installed} → ${latest}(标记,实际升级留 P2)`,
          })
        }
      }

      const resp: UpgradeAllResponse = {
        success: true,
        upgraded,
        failed: 0,
        skipped,
        details,
      }
      return reply.send(success(resp))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量升级失败'))
    }
  })

  // ==========================================================================
  // P0-3:配置漂移检测 + 自动迁移(均 requireAdmin)
  // ==========================================================================

  // GET /registry/config-drift — 检测所有配置漂移(?fileType= 可仅检测单个类型)
  server.get(
    '/registry/config-drift',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const query = z.object({ fileType: fileTypeSchema.optional() }).safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send(error(400, query.error.issues[0]?.message ?? '参数错误'))
      }
      const result = query.data.fileType
        ? {
            reports: [await detectDrift(query.data.fileType)],
            hasDrift: false,
            detectedAt: new Date().toISOString(),
          }
        : await detectAllDrift()
      result.hasDrift = result.reports.some((r) => r.drifted)
      return reply.send(success(result))
    },
  )

  // POST /registry/config-baseline — 更新基线(标记当前为已知良好)
  server.post(
    '/registry/config-baseline',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = baselineBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      await updateBaseline(parsed.data.fileType as ConfigFileType | undefined)
      request.log.info(
        { fileType: parsed.data.fileType ?? 'all' },
        '[registry] baseline updated',
      )
      return reply.send(
        success({
          updated: parsed.data.fileType ?? 'all',
          message: '基线已更新为当前内容',
        }),
      )
    },
  )

  // POST /registry/config-migrate — 触发迁移(body: ConfigMigrateRequest)
  server.post(
    '/registry/config-migrate',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = migrateBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const reqBody = parsed.data as ConfigMigrateRequest
      const response = await migrateConfig({
        fileType: parsed.data.fileType as ConfigFileType | undefined,
        dryRun: reqBody.dryRun,
        rollbackThreshold: reqBody.rollbackThreshold,
      })
      request.log.info(
        {
          fileType: parsed.data.fileType ?? 'all',
          dryRun: reqBody.dryRun ?? true,
          migrated: response.migrated,
          failed: response.failed,
          rolledBack: response.rolledBack,
        },
        '[registry] config migrate done',
      )
      return reply.send(success(response))
    },
  )

  // GET /registry/config-migrate/history — 迁移历史(从备份目录列出)
  server.get(
    '/registry/config-migrate/history',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const history = await listMigrationHistory()
      return reply.send(success({ history, total: history.length }))
    },
  )
}
