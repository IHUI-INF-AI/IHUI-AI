// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/accounts 第三方 AI IDE 账号池管理(2026-10-22 立,对标码道网关)。
 *
 * 端点清单:
 * 1. POST   /admin/relay/accounts/import   — 批量导入(直接吃账号导出 JSON:{accounts:[...]})
 * 2. GET    /admin/relay/accounts          — 号池列表(凭证字段一律不出库面,分页 + 筛选)
 * 3. GET    /admin/relay/accounts/:id      — 单账号详情(脱敏)
 * 4. PUT    /admin/relay/accounts/:id      — 更新调度参数(名称/优先级/权重/代理/临时摘除)
 * 5. POST   /admin/relay/accounts/:id/toggle — 启用/禁用切换
 * 6. POST   /admin/relay/accounts/:id/health — 触发健康检查(走平台适配器真实探测)
 * 7. DELETE /admin/relay/accounts/:id      — 删除账号
 * 8. POST   /admin/relay/account-pool/sweep — 手动触发调度巡检(透传 scheduler 结果)
 * 9. GET    /admin/relay/account-pool/usage/:id?days=7 — 单账号用量(24h 汇总 + 明细)
 * 10. POST  /admin/relay/accounts/:id/claim  — 认领账号(他人已认领 409)
 * 11. POST  /admin/relay/accounts/:id/release — 释放认领
 * 12. GET   /admin/relay/model-catalog       — 模型别名目录列表
 * 13. POST   /admin/relay/model-catalog       — 新建别名映射(冲突 400)
 * 14. DELETE /admin/relay/model-catalog/:id  — 删除别名映射(不存在 404)
 * 15. GET    /admin/relay/proxy-pool         — 出口代理池列表(分页 + status 过滤)
 * 16. POST   /admin/relay/proxy-pool         — 新增代理(proxyUrl 重复 409)
 * 17. PATCH  /admin/relay/proxy-pool/:id     — 更新代理(status/boundAccountId/proxyUrl)
 * 18. DELETE /admin/relay/proxy-pool/:id     — 删除代理(不存在 404)
 * 19. POST   /admin/relay/proxy-pool/:id/check — 人工标记活性(调 markProxyChecked)
 * 20. POST   /admin/relay/accounts/:id/quota — 按需查上游余额/积分(平台无实证端点则 400 未支持)
 * 21. POST   /admin/relay/accounts/:id/checkin-resync — 单条重推签到同步(O64)
 * 22. POST   /admin/relay/account-pool/checkin-status — 批量点查签到状态(O64,≤20)
 * 23. POST   /admin/relay/accounts/:id/checkin-run — 立即签到(O64,转发 ai-service,429 透传)
 * 24. POST   /admin/relay/accounts/:id/models — 按需点查可用模型清单(富契约优先,无实证通路 400)
 * 25. POST   /admin/relay/accounts/:id/login-local — 把该号写进本机 Trae 客户端登录态(trae,文件级备份+原子写)
 *
 * 加密:token/refreshToken/cookies/账号级 proxyUrl 走 encryptField(AES-256-GCM),
 * 响应面永不回传密文/明文(代理只回脱敏值)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, ilike, lt, gte, isNull, isNotNull, inArray, sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { aiRelayAccountPool } from '@ihui/database'
import { PROVIDER_HEALTH_STATUSES } from '@ihui/types'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import {
  importAccounts,
  decryptAccountCredentials,
  type ImportAccountInput,
} from '../../services/relay-account-pool-service.js'
import { isRelayProviderCode, RELAY_PROVIDERS } from '../../services/relay-account-format.js'
import { loginTraeAccountLocal, LocalLoginError } from '../../services/relay-trae-local-login.js'
import { getRelayAdapter } from '../../services/relay-upstream-adapters.js'
import { healthStatusOf } from '../../services/relay-account-pool-scheduler.js'
// 号池体检判据单源在 @ihui/shared(web 管理页与 CLI 同源,绝不各自抄一份枚举/阈值,§0.6)
import { relayAccountIdleDays, resolveRelayAccountVerdict } from '@ihui/shared'
import { markAccountAuthRejected } from '../../services/relay-account-pool-scheduler.js'
import {
  buildPoolSyncAccount,
  checkinPlatformFor,
  clearCheckinSyncPending,
  extractCosy,
  fetchPoolStatus,
  markCheckinSyncPending,
  postPoolRun,
  pemFromSecrets,
  pushPoolState,
  pushPoolSync,
  type PoolAccountState,
} from '../../services/relay-account-pool-checkin-sync.js'
import { refreshOne, sweepAccountPool } from '../../services/relay-account-pool-scheduler.js'
import {
  collectRelayTaskStates,
  RELAY_POOL_TASKS,
  runRelayTaskById,
} from '../../services/relay-task-center.js'
import { Queue } from 'bullmq'
import { config } from '../../config/index.js'
import { getAccountUsage, getAccountUsageSummaries } from '../../services/relay-account-usage.js'
import {
  listProxies,
  createProxy,
  updateProxy,
  deleteProxy,
  getProxyById,
  markProxyChecked,
  encryptAccountProxyUrl,
  resolveAccountProxyUrl,
  maskAccountProxyUrl,
  type UpdateProxyPatch,
} from '../../services/relay-proxy-pool.js'
import {
  listModelCatalog,
  createModelCatalog,
  deleteModelCatalog,
} from '../../services/relay-model-catalog.js'

const importBodySchema = z.object({
  providerCode: z.enum(RELAY_PROVIDERS),
  accounts: z
    .array(
      z
        .object({
          name: z.string().max(128).optional(),
          token: z.string().min(1),
          refreshToken: z.string().optional(),
          deviceId: z.string().max(128).optional(),
          machineId: z.string().max(128).optional(),
          enabled: z.boolean().optional(),
          cookies: z.array(z.unknown()).optional(),
          proxyUrl: z.string().max(512).optional(),
        })
        .passthrough(),
    )
    .min(1)
    .max(500),
  /**
   * 覆盖既有行时,本批未提供 refreshToken ⇒ 保留库内既有密文(不写 NULL)。
   * 专供"网页一键重登":重登只换得到 access,不带它会把能自续的号抹成待重登死号。
   * 缺省 false = 存量导入语义(缺字段即清空)。
   */
  preserveMissingRefresh: z.boolean().optional(),
})

const listQuerySchema = paginationSchema.extend({
  provider: z.transform(emptyToUndefined).pipe(z.enum(RELAY_PROVIDERS).optional()),
  enabled: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
  health: z.transform(emptyToUndefined).pipe(z.enum(PROVIDER_HEALTH_STATUSES).optional()),
  /** 账号代理管理页筛选用:true = 已配置账号级 proxyUrl,false = 直连(未配置) */
  hasProxy: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
  /** ops = 运营池(默认,保持存量视图);all = 含用户个人池;其余按 ownerUserId 精确筛 */
  owner: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  priority: z.number().int().optional(),
  weight: z.number().int().min(1).optional(),
  tempUnschedulable: z.boolean().optional(),
  // 账号级代理:仅允许 http(s)/socks5;空串按清除处理,避免无效值进库
  proxyUrl: z
    .string()
    .trim()
    .max(512)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))
    .refine(
      (v) => v === null || v === undefined || isSupportedProxyUrl(v),
      '代理地址必须是 http(s)/socks5 协议',
    ),
})

// --- 出口代理池(2026-10-22 补写入入口;管理员可见 proxyUrl 原样,含内嵌账密) ---
const PROXY_URL_PROTOCOLS = new Set(['http:', 'https:', 'socks5:'])

function isSupportedProxyUrl(v: string): boolean {
  try {
    return PROXY_URL_PROTOCOLS.has(new URL(v).protocol)
  } catch {
    return false
  }
}

const proxyUrlSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(isSupportedProxyUrl, '代理地址必须是 http(s)/socks5 协议')

const proxyPoolListQuerySchema = paginationSchema.extend({
  status: z.transform(emptyToUndefined).pipe(z.enum(['active', 'dead', 'exhausted']).optional()),
})

const createProxyBodySchema = z.object({
  proxyUrl: proxyUrlSchema,
  providerCode: z.string().min(1).max(64).optional(),
  boundAccountId: z.uuid().optional(),
})

const updateProxyBodySchema = z
  .object({
    status: z.enum(['active', 'dead', 'exhausted']).optional(),
    boundAccountId: z.uuid().nullable().optional(),
    proxyUrl: proxyUrlSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个待更新字段' })

const checkProxyBodySchema = z.object({ alive: z.boolean() })

/** token 距到期小于该窗口视为"即将过期"(list.expiresSoon) */
const EXPIRES_SOON_MS = 15 * 60 * 1000
/** 连续刷新失败达到该次数且被摘除 → 展示刷新熔断原因(与 scheduler 摘除阈值对齐) */
const REFRESH_FAILURE_LIMIT = 3
/** 连续转发失败达到该次数 → 展示转发熔断冷却原因(展示层推导阈值) */
const FORWARD_FAILURE_BREAK = 5
/** 可用账号数低于该值提示补池(poolHealth.needRefill) */
const POOL_REFILL_MIN_AVAILABLE = 2

/** 从投影行推导熔断/摘除原因(纯展示字段,不参与调度判定) */
function deriveCircuitBreakReason(row: {
  tempUnschedulable: boolean | null
  refreshFailureCount: number | null
  consecutiveFailures: number | null
  healthStatus: string | null
  lastErrorMessage: string | null
}): string | null {
  if (row.tempUnschedulable === true && (row.refreshFailureCount ?? 0) >= REFRESH_FAILURE_LIMIT) {
    return `连续 ${row.refreshFailureCount} 次 token 刷新失败,已自动摘除`
  }
  if ((row.consecutiveFailures ?? 0) >= FORWARD_FAILURE_BREAK) {
    return `连续 ${row.consecutiveFailures} 次转发失败,熔断冷却中`
  }
  if (row.healthStatus === 'down') {
    return row.lastErrorMessage ?? '健康检查失败,已标记 down'
  }
  return null
}

/** 列表/详情统一脱敏投影(绝不 SELECT *Enc 字段) */
const safeProjection = {
  id: aiRelayAccountPool.id,
  ownerUserId: aiRelayAccountPool.ownerUserId,
  providerCode: aiRelayAccountPool.providerCode,
  uid: aiRelayAccountPool.uid,
  name: aiRelayAccountPool.name,
  deviceId: aiRelayAccountPool.deviceId,
  machineId: aiRelayAccountPool.machineId,
  tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
  refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
  // 只回"有无 refreshToken"的布尔,永不 SELECT *Enc 值本身(脱敏投影不破;供 verdict 判
  // expired-renewable / expired-dead 之分)。
  hasRefreshToken:
    sql<boolean>`case when ${aiRelayAccountPool.refreshTokenEnc} is not null and ${aiRelayAccountPool.refreshTokenEnc} <> '' then true else false end`.as(
      'has_refresh_token',
    ),
  priority: aiRelayAccountPool.priority,
  weight: aiRelayAccountPool.weight,
  isEnabled: aiRelayAccountPool.isEnabled,
  tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
  healthStatus: aiRelayAccountPool.healthStatus,
  healthCheckedAt: aiRelayAccountPool.healthCheckedAt,
  lastErrorMessage: aiRelayAccountPool.lastErrorMessage,
  lastUsedAt: aiRelayAccountPool.lastUsedAt,
  lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
  refreshFailureCount: aiRelayAccountPool.refreshFailureCount,
  consecutiveFailures: aiRelayAccountPool.consecutiveFailures,
  hasProxy:
    sql<boolean>`case when ${aiRelayAccountPool.proxyUrl} is null then false else true end`.as(
      'has_proxy',
    ),
  // 账号级 proxyUrl 落库为密文(encryptField);脱敏只能在服务端解密后做,
  // 故此处取原值(密文)供 presentAccountRow 转换,响应前一律剥除。
  proxyUrlEnc: aiRelayAccountPool.proxyUrl,
  totalCalls: aiRelayAccountPool.totalCalls,
  claimStatus: aiRelayAccountPool.claimStatus,
  claimedBy: aiRelayAccountPool.claimedBy,
  claimedAt: aiRelayAccountPool.claimedAt,
  claimNote: aiRelayAccountPool.claimNote,
  extraMetadata: aiRelayAccountPool.extraMetadata,
  // O64:号池↔签到同步态(仅取 checkinSync 子键,前端零解析;extraMetadata 全量回传是既有行为)
  checkinSync: sql<{
    pending?: boolean
    pendingKind?: string | null
    pendingAt?: string | null
    lastError?: string | null
    attempts?: number
    lastSyncedAt?: string | null
  } | null>`(${aiRelayAccountPool.extraMetadata} -> 'checkinSync')`.as('checkin_sync'),
  createdAt: aiRelayAccountPool.createdAt,
  updatedAt: aiRelayAccountPool.updatedAt,
}

/**
 * 账号行响应投影:剥掉 proxyUrl 密文原值,换成脱敏展示值。
 * 列表/详情统一走这里 —— 密文与明文账密都不进响应。
 */
function presentAccountRow<T extends { proxyUrlEnc: string | null }>(row: T) {
  const { proxyUrlEnc, ...rest } = row
  return { ...rest, proxyUrlMasked: maskAccountProxyUrl(proxyUrlEnc) }
}

const relayAccountPoolRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. POST /admin/relay/accounts/import — 批量导入 =====
  server.post('/admin/relay/accounts/import', async (request, reply) => {
    const parsed = importBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(
          error(
            400,
            parsed.error.issues[0]?.message ?? '导入参数错误(需 providerCode + accounts[])',
          ),
        )
    }
    const { providerCode, accounts, preserveMissingRefresh } = parsed.data
    if (!isRelayProviderCode(providerCode)) {
      return reply.status(400).send(error(400, `不支持的平台: ${providerCode}`))
    }
    try {
      const result = await importAccounts(providerCode, accounts as ImportAccountInput[], null, {
        preserveMissingRefresh,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量导入失败'))
    }
  })

  // ===== 2. GET /admin/relay/accounts — 列表 =====
  server.get('/admin/relay/accounts', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, provider, enabled, health, hasProxy, owner } = q.data

    const conds: SQL[] = []
    // 双池并存:运营号池页默认只显示运营池(存量视图零变化);owner=all 或指定用户 id 才扩面
    if (!owner || owner === 'ops') conds.push(isNull(aiRelayAccountPool.ownerUserId))
    else if (owner !== 'all') conds.push(eq(aiRelayAccountPool.ownerUserId, owner))
    if (provider) conds.push(eq(aiRelayAccountPool.providerCode, provider))
    if (enabled === 'true') conds.push(eq(aiRelayAccountPool.isEnabled, true))
    if (enabled === 'false') conds.push(eq(aiRelayAccountPool.isEnabled, false))
    if (health) conds.push(eq(aiRelayAccountPool.healthStatus, health))
    // proxyUrl 落库为密文,但"有无"判据与明文无关(非空即已配置),可直接在库侧筛
    if (hasProxy === 'true') conds.push(isNotNull(aiRelayAccountPool.proxyUrl))
    if (hasProxy === 'false') conds.push(isNull(aiRelayAccountPool.proxyUrl))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search
      ? or(
          ilike(aiRelayAccountPool.name, `%${search}%`),
          ilike(aiRelayAccountPool.uid, `%${search}%`),
          ilike(aiRelayAccountPool.providerCode, `%${search}%`),
        )
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const now = new Date()
      // 查询顺序固定:list → total → expired → available(用量聚合在其后,便于测试桩按序供数)
      const [list, totalRows, expiredRows, availableRows] = await Promise.all([
        dbRead
          .select(safeProjection)
          .from(aiRelayAccountPool)
          .where(finalWhere)
          .orderBy(
            aiRelayAccountPool.providerCode,
            aiRelayAccountPool.priority,
            aiRelayAccountPool.createdAt,
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayAccountPool)
          .where(finalWhere),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayAccountPool)
          .where(
            and(
              isNull(aiRelayAccountPool.ownerUserId),
              isNotNull(aiRelayAccountPool.tokenExpiresAt),
              lt(aiRelayAccountPool.tokenExpiresAt, now),
            ),
          ),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayAccountPool)
          .where(
            and(
              isNull(aiRelayAccountPool.ownerUserId),
              eq(aiRelayAccountPool.isEnabled, true),
              eq(aiRelayAccountPool.tempUnschedulable, false),
              or(
                isNull(aiRelayAccountPool.tokenExpiresAt),
                gte(aiRelayAccountPool.tokenExpiresAt, now),
              ),
            ),
          ),
      ])
      const summaries = await getAccountUsageSummaries(list.map((r) => r.id))
      const enriched = list.map((row) => {
        const verdict = resolveRelayAccountVerdict(
          {
            tokenExpiryMs: row.tokenExpiresAt ? row.tokenExpiresAt.getTime() : null,
            hasCredential: true,
            hasRefreshCredential: row.hasRefreshToken === true,
          },
          now.getTime(),
        )
        return {
          ...presentAccountRow(row),
          verdict: verdict.verdict,
          tokenRemainingDays: verdict.tokenRemainingDays,
          idleDays: relayAccountIdleDays(
            { lastUsedAt: row.lastUsedAt, lastRefreshAt: row.lastRefreshAt },
            now.getTime(),
          ),
          expiresSoon:
            row.tokenExpiresAt !== null &&
            row.tokenExpiresAt.getTime() > now.getTime() &&
            row.tokenExpiresAt.getTime() - now.getTime() <= EXPIRES_SOON_MS,
          circuitBreakReason: deriveCircuitBreakReason(row),
          usageSummary: summaries.get(row.id) ?? { calls24h: 0, tokens24h: 0, failRate24h: 0 },
        }
      })
      const availableCount = availableRows[0]?.c ?? 0
      return reply.send(
        success({
          list: enriched,
          total: totalRows[0]?.c ?? 0,
          page,
          pageSize,
          poolHealth: {
            expiredCount: expiredRows[0]?.c ?? 0,
            availableCount,
            needRefill: availableCount < POOL_REFILL_MIN_AVAILABLE,
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询账号池列表失败'))
    }
  })

  // ===== 3. GET /admin/relay/accounts/:id — 详情 =====
  server.get('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select(safeProjection)
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      return reply.send(success(presentAccountRow(row)))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询账号详情失败'))
    }
  })

  // ===== 4. PUT /admin/relay/accounts/:id — 更新调度参数 =====
  server.put('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = updateBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const patch: Record<string, unknown> = {}
    for (const k of ['name', 'priority', 'weight', 'tempUnschedulable'] as const) {
      if (b.data[k] !== undefined) patch[k] = b.data[k]
    }
    if (b.data.proxyUrl !== undefined) patch.proxyUrl = b.data.proxyUrl
    try {
      const [existing] = await dbRead
        .select({
          name: aiRelayAccountPool.name,
          priority: aiRelayAccountPool.priority,
          weight: aiRelayAccountPool.weight,
          tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
          proxyUrl: aiRelayAccountPool.proxyUrl,
        })
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '账号不存在'))
      // proxyUrl 库内是密文:先解密再与明文入参比较,变更时才重新加密回写。
      // 直接比密文会让每次保存都判为"有变更",且对比结果永不为真。
      const existingProxyUrl = resolveAccountProxyUrl(existing.proxyUrl)
      const changed: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'proxyUrl') {
          if (v !== existingProxyUrl) {
            changed.proxyUrl = encryptAccountProxyUrl(v as string | null)
          }
        } else if ((existing as Record<string, unknown>)[k] !== v) {
          changed[k] = v
        }
      }
      if (Object.keys(changed).length === 0) return reply.send(success({ id: p.data.id }))
      const updated = await db
        .update(aiRelayAccountPool)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .returning({ id: aiRelayAccountPool.id })
      if (updated.length === 0) return reply.status(404).send(error(404, '账号不存在'))
      return reply.send(success({ id: updated[0] ? updated[0].id : p.data.id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新账号失败'))
    }
  })

  // ===== 5. POST /admin/relay/accounts/:id/toggle — 启用/禁用 =====
  server.post('/admin/relay/accounts/:id/toggle', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select({
          providerCode: aiRelayAccountPool.providerCode,
          ownerUserId: aiRelayAccountPool.ownerUserId,
          uid: aiRelayAccountPool.uid,
          isEnabled: aiRelayAccountPool.isEnabled,
        })
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const next = !row.isEnabled
      const nextState: PoolAccountState = next ? 'enabled' : 'disabled'
      const changed = { isEnabled: next }
      await db
        .update(aiRelayAccountPool)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(aiRelayAccountPool.id, p.data.id))
      // O64:状态联动推送(号池启用态 = 签到侧调度权威)。推送失败落 pending 待重推,
      // 绝不阻塞 toggle 响应;pending 落库本身再失败只记日志,由对账收敛器兜底。
      const checkinPlatform = checkinPlatformFor(row.providerCode)
      if (checkinPlatform) {
        const push = await pushPoolState(
          checkinPlatform,
          { poolAccountId: p.data.id, ownerUserId: row.ownerUserId, uid: row.uid },
          nextState,
        )
        if (!push.ok) {
          try {
            await markCheckinSyncPending([p.data.id], 'state', nextState, push.error ?? '未知错误')
          } catch (e) {
            request.log.error(e, '[relay-account-pool] 签到状态待推标记失败,待对账收敛器兜底')
          }
        }
      }
      return reply.send(success({ id: p.data.id, isEnabled: next }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换启用状态失败'))
    }
  })

  // ===== 6. POST /admin/relay/accounts/:id/health — 触发健康检查 =====
  server.post('/admin/relay/accounts/:id/health', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter) {
        return reply
          .status(400)
          .send(error(400, `平台 ${row.providerCode} 适配器未注册,无法健康检查`))
      }
      const ctx = { row, credentials: decryptAccountCredentials(row) }
      const outcome = await adapter.checkHealth(ctx, {
        proxyUrl: resolveAccountProxyUrl(row.proxyUrl),
      })
      const now = new Date()
      // 三态消费与调度器同源(healthStatusOf):未判定保留 unknown 不写 down,
      // 否则 5xx/网络抖动一次就把活号摘除(§0.3 取不到 ≠ 失效)。
      const status = healthStatusOf(outcome)
      await db
        .update(aiRelayAccountPool)
        .set({
          healthStatus: status,
          healthCheckedAt: now,
          lastErrorMessage:
            status === 'healthy' ? null : (outcome.error ?? '健康检查失败').slice(0, 500),
          consecutiveFailures: status === 'healthy' ? 0 : row.consecutiveFailures,
          updatedAt: now,
        })
        .where(eq(aiRelayAccountPool.id, row.id))
      return reply.send(
        success({
          id: row.id,
          ok: outcome.ok,
          status,
          indeterminate: outcome.indeterminate === true,
          error: outcome.error ?? null,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '健康检查失败'))
    }
  })

  // ===== 25. POST /admin/relay/accounts/:id/login-local — 把该号写进本机 Trae 登录态 =====
  // 只对 trae 生效:客户端登录态是整份 userInfo(导入时存成会话模板),用池内最新凭证
  // 打补丁后重封信封写回 storage.json。写前必留同目录备份,失败可人工回滚。
  server.post('/admin/relay/accounts/:id/login-local', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await db.select().from(aiRelayAccountPool).where(eq(aiRelayAccountPool.id, p.data.id)).limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const result = await loginTraeAccountLocal(row)
      return reply.send(success(result))
    } catch (e) {
      if (e instanceof LocalLoginError) {
        return reply.status(e.status).send(error(e.status, e.message))
      }
      request.log.error(e)
      return reply.status(500).send(error(500, '写入本机登录态失败'))
    }
  })

  // ===== 7. DELETE /admin/relay/accounts/:id =====
  server.delete('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const deleted = await db
        .delete(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .returning({
          id: aiRelayAccountPool.id,
          providerCode: aiRelayAccountPool.providerCode,
          ownerUserId: aiRelayAccountPool.ownerUserId,
          uid: aiRelayAccountPool.uid,
        })
      if (deleted.length === 0) return reply.status(404).send(error(404, '账号不存在'))
      const removed = deleted[0]
      // O64:删除联动(签到侧停用保历史,不物理删)。号池行已不存在 ⇒ 推送失败无处落
      // pending,只记日志,由对账收敛器(O64 提交 5)扫差集兜底。
      if (removed) {
        const checkinPlatform = checkinPlatformFor(removed.providerCode)
        if (checkinPlatform) {
          const push = await pushPoolState(
            checkinPlatform,
            {
              poolAccountId: removed.id,
              ownerUserId: removed.ownerUserId,
              uid: removed.uid,
            },
            'pool_deleted',
          )
          if (!push.ok) {
            request.log.warn(
              { accountId: removed.id, err: push.error },
              '[relay-account-pool] pool_deleted 状态推送失败,待对账收敛器兜底',
            )
          }
        }
      }
      return reply.send(success({ id: removed ? removed.id : p.data.id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除账号失败'))
    }
  })

  // ===== 8. POST /admin/relay/account-pool/sweep — 手动触发调度巡检 =====
  // 注:scheduler 签名 sweepAccountPool() 无参(整池单轮),body.ids 为管理面形状预留(当前整池执行)。
  const sweepBodySchema = z.object({
    ids: z.array(z.string().min(1)).max(500).optional(),
  })
  server.post('/admin/relay/account-pool/sweep', async (request, reply) => {
    const b = sweepBodySchema.safeParse(request.body ?? {})
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await sweepAccountPool()
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '账号池巡检执行失败'))
    }
  })

  // ===== 8b. GET /admin/relay/account-pool/tasks — 号池任务中心(观测聚合,2026-10-27) =====
  // 四载体任务折一张表:上次执行/下次执行/成败/能否触发;读不到的状态源如实 indeterminate。
  server.get('/admin/relay/account-pool/tasks', async (request, reply) => {
    try {
      const tasks = await collectRelayTaskStates({
        connection: server.redisForQueue,
        makeQueue: server.redisForQueue
          ? (queue) => {
              const q = new Queue(queue, { connection: server.redisForQueue! })
              return {
                getJobSchedulers: () => q.getJobSchedulers(),
                getJobs: async (types, start, end) => {
                  const jobs = await q.getJobs(types as never, start, end)
                  return jobs.map((j) => ({
                    name: j.name,
                    timestamp: j.timestamp,
                    failedReason: j.failedReason,
                  }))
                },
              }
            }
          : undefined,
        aiServiceUrl: config.AI_SERVICE_URL,
      })
      return reply.send(success({ tasks }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '任务状态聚合失败'))
    }
  })

  // ===== 8c. POST /admin/relay/account-pool/tasks/:id/run — 手动触发(bullmq 族) =====
  // 无触发口的任务回 400 + 真实出路(§0.8);触发结果永不冒绿。
  server.post('/admin/relay/account-pool/tasks/:id/run', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const def = RELAY_POOL_TASKS.find((t) => t.id === p.data.id)
    if (!def) return reply.status(404).send(error(404, `任务不存在: ${p.data.id}`))
    const outcome = await runRelayTaskById(p.data.id)
    if (!outcome) {
      return reply
        .status(400)
        .send(error(400, `任务「${def.name}」无手动触发口。${def.note ?? '该载体不由本进程调度'}`))
    }
    if (!outcome.ok) return reply.status(500).send(error(500, outcome.detail))
    return reply.send(success({ id: p.data.id, detail: outcome.detail }))
  })

  // ===== 9. GET /admin/relay/account-pool/usage/:id?days=7 — 单账号用量 =====
  // limit 默认 500、服务层 clamp 上限 1000;offset >= 0。返回 detail + detailTotal。
  const usageQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).default(7),
    limit: z.coerce.number().int().min(1).default(500),
    offset: z.coerce.number().int().min(0).default(0),
  })
  server.get('/admin/relay/account-pool/usage/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const q = usageQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await getAccountUsage(p.data.id, q.data.days, {
        limit: q.data.limit,
        offset: q.data.offset,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询账号用量失败'))
    }
  })

  // ===== 21. POST /admin/relay/accounts/:id/checkin-resync — 单条重推签到同步 =====
  // 号池 = 凭证权威:解密现值重建载荷补推;成功清 pending,失败重落(attempts 累积)。
  server.post('/admin/relay/accounts/:id/checkin-resync', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const [row] = await dbRead
      .select()
      .from(aiRelayAccountPool)
      .where(eq(aiRelayAccountPool.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '账号不存在'))
    const platform = checkinPlatformFor(row.providerCode)
    if (!platform) {
      return reply.status(400).send(error(400, `平台 ${row.providerCode} 无签到引擎,无法同步`))
    }
    try {
      const credentials = decryptAccountCredentials(row)
      const acc = buildPoolSyncAccount({
        id: row.id,
        ownerUserId: row.ownerUserId,
        uid: row.uid ?? '',
        name: (row.name ?? '').slice(0, 128),
        token: credentials.token,
        refreshToken: credentials.refreshToken,
        credVersion: row.credVersion,
        enabled: row.isEnabled,
        proxyUrl: resolveAccountProxyUrl(row.proxyUrl),
        deviceId: row.deviceId,
        machineId: row.machineId,
        cosy: extractCosy(row.extraMetadata),
        deviceKeyPem: pemFromSecrets(credentials.secrets, 'deviceKeyPem'),
        devicePubPem: pemFromSecrets(credentials.secrets, 'devicePubPem'),
        tokenExpiresAt: row.tokenExpiresAt,
      })
      const push = await pushPoolSync(platform, [acc])
      if (push.ok && push.failed === 0) {
        await clearCheckinSyncPending([row.id])
        return reply.send(success({ pushed: push.pushed, skipped: push.skipped, pending: false }))
      }
      await markCheckinSyncPending([row.id], 'cred', null, push.error ?? '重推失败')
      return reply.status(502).send(error(502, push.error ?? '签到同步推送失败,已留待重试'))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '重推签到同步失败'))
    }
  })

  // ===== 22. POST /admin/relay/account-pool/checkin-status — 批量点查签到状态 =====
  // 号池页「签到」列数据源(设计 §11):按页内 id 批量点查 ai-service 端点 4,
  // 单批 ≤ 20(一页),不做全表拉取;平台无签到引擎/账号未同步 → found:false 明示。
  const checkinStatusBodySchema = z.object({
    ids: z.array(z.string().min(1)).min(1).max(20),
  })
  server.post('/admin/relay/account-pool/checkin-status', async (request, reply) => {
    const b = checkinStatusBodySchema.safeParse(request.body ?? {})
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const rows = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        uid: aiRelayAccountPool.uid,
      })
      .from(aiRelayAccountPool)
      .where(inArray(aiRelayAccountPool.id, b.data.ids))
    const byId = new Map(rows.map((r) => [r.id, r]))
    const items: Record<string, unknown> = {}
    for (const id of b.data.ids) {
      const row = byId.get(id)
      if (!row) {
        items[id] = { found: false, error: '号池账号不存在' }
        continue
      }
      const platform = checkinPlatformFor(row.providerCode)
      if (!platform) {
        items[id] = { found: false, noEngine: true }
        continue
      }
      items[id] = await fetchPoolStatus(platform, {
        poolAccountId: row.id,
        uid: row.uid ?? '',
      })
    }
    return reply.send(success({ items }))
  })

  // ===== 23. POST /admin/relay/accounts/:id/checkin-run — 立即签到 =====
  // 转发 ai-service pool-run(系统 owner 面,尊重冷却/限流):429 原样透传,
  // 让 admin 看到「冷却中,剩余 Xs」而不是笼统失败。
  server.post('/admin/relay/accounts/:id/checkin-run', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const [row] = await dbRead
      .select({
        providerCode: aiRelayAccountPool.providerCode,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        uid: aiRelayAccountPool.uid,
      })
      .from(aiRelayAccountPool)
      .where(eq(aiRelayAccountPool.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '账号不存在'))
    const platform = checkinPlatformFor(row.providerCode)
    if (!platform) {
      return reply.status(400).send(error(400, `平台 ${row.providerCode} 无签到引擎,无法签到`))
    }
    const r = await postPoolRun(platform, {
      poolAccountId: p.data.id,
      ownerUserId: row.ownerUserId,
      uid: row.uid ?? '',
    })
    if (r.ok) {
      return reply.send(success({ record: r.record }))
    }
    // 404(未同步)/429(冷却/限流)原样透传;502(网络)由 ai-service 不可达导致
    const status = r.httpStatus === 404 || r.httpStatus === 429 ? r.httpStatus : 502
    return reply.status(status).send(error(status, r.error ?? '触发签到失败'))
  })

  // ===== 10. POST /admin/relay/accounts/:id/claim — 认领账号 =====
  const claimBodySchema = z.object({ note: z.string().max(500).optional() })
  server.post('/admin/relay/accounts/:id/claim', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = claimBodySchema.safeParse(request.body ?? {})
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const userId = request.jwtPayload?.userId
    // 绝不允许写入 claimedBy=null:否则该号「已认领但无人能认领」永久卡死
    if (!userId) return reply.status(400).send(error(400, '无法识别操作者,不能认领账号'))
    try {
      const now = new Date()
      // 原子认领:条件写 + RETURNING,杜绝「先读后判断再写」被并发穿透
      const updated = await db
        .update(aiRelayAccountPool)
        .set({
          claimStatus: 'claimed',
          claimedBy: userId,
          claimedAt: now,
          claimNote: b.data.note ?? null,
          updatedAt: now,
        })
        .where(
          and(
            eq(aiRelayAccountPool.id, p.data.id),
            or(isNull(aiRelayAccountPool.claimedBy), eq(aiRelayAccountPool.claimedBy, userId)),
          ),
        )
        .returning({
          id: aiRelayAccountPool.id,
          claimStatus: aiRelayAccountPool.claimStatus,
          claimedBy: aiRelayAccountPool.claimedBy,
          claimedAt: aiRelayAccountPool.claimedAt,
          claimNote: aiRelayAccountPool.claimNote,
        })
      if (updated.length === 0) {
        // 0 行:再查存在性区分 404(不存在)与 409(已被他人认领)
        const [row] = await dbRead
          .select({ claimedBy: aiRelayAccountPool.claimedBy })
          .from(aiRelayAccountPool)
          .where(eq(aiRelayAccountPool.id, p.data.id))
          .limit(1)
        if (!row) return reply.status(404).send(error(404, '账号不存在'))
        return reply
          .status(409)
          .send(error(409, `该账号已被认领(认领人: ${row.claimedBy ?? '未知'})`))
      }
      return reply.send(success(updated[0]))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '认领账号失败'))
    }
  })

  // ===== 11. POST /admin/relay/accounts/:id/release — 释放认领 =====
  // 默认只能本人释放(非本人 409);force=true 供运维强制释放并留 warn 记录。
  const releaseBodySchema = z.object({ force: z.boolean().optional() })
  server.post('/admin/relay/accounts/:id/release', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = releaseBodySchema.safeParse(request.body ?? {})
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const userId = request.jwtPayload?.userId
    if (!userId) return reply.status(400).send(error(400, '无法识别操作者,不能释放认领'))
    const force = b.data.force === true
    try {
      const now = new Date()
      const updated = await db
        .update(aiRelayAccountPool)
        .set({
          claimStatus: 'unclaimed',
          claimedBy: null,
          claimedAt: null,
          claimNote: null,
          updatedAt: now,
        })
        .where(
          force
            ? eq(aiRelayAccountPool.id, p.data.id)
            : and(
                eq(aiRelayAccountPool.id, p.data.id),
                or(isNull(aiRelayAccountPool.claimedBy), eq(aiRelayAccountPool.claimedBy, userId)),
              ),
        )
        .returning({
          id: aiRelayAccountPool.id,
          claimStatus: aiRelayAccountPool.claimStatus,
          claimedBy: aiRelayAccountPool.claimedBy,
          claimedAt: aiRelayAccountPool.claimedAt,
          claimNote: aiRelayAccountPool.claimNote,
        })
      if (updated.length === 0) {
        const [row] = await dbRead
          .select({ claimedBy: aiRelayAccountPool.claimedBy })
          .from(aiRelayAccountPool)
          .where(eq(aiRelayAccountPool.id, p.data.id))
          .limit(1)
        if (!row) return reply.status(404).send(error(404, '账号不存在'))
        return reply
          .status(409)
          .send(error(409, `该账号由 ${row.claimedBy ?? '他人'} 认领,只能本人释放`))
      }
      if (force) {
        request.log.warn(
          { accountId: p.data.id, operator: userId },
          '[relay-account-pool] 管理员强制释放认领(force=true)',
        )
      }
      return reply.send(success(updated[0]))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '释放认领失败'))
    }
  })

  // ===== 12. GET /admin/relay/model-catalog — 模型目录/别名列表 =====
  const catalogListQuerySchema = z.object({
    provider: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  })
  server.get('/admin/relay/model-catalog', async (request, reply) => {
    const q = catalogListQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    try {
      const list = await listModelCatalog(q.data.provider)
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询模型目录失败'))
    }
  })

  // ===== 13. POST /admin/relay/model-catalog — 新建别名映射 =====
  const createCatalogBodySchema = z.object({
    providerCode: z.string().min(1).max(64),
    upstreamModel: z.string().min(1).max(128),
    alias: z.string().min(1).max(128),
    displayName: z.string().max(256).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  server.post('/admin/relay/model-catalog', async (request, reply) => {
    const b = createCatalogBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    try {
      const row = await createModelCatalog(b.data)
      return reply.status(201).send(success(row))
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') {
        return reply.status(400).send(error(400, '该 provider 下别名已存在'))
      }
      request.log.error(e)
      return reply.status(500).send(error(500, '创建模型目录条目失败'))
    }
  })

  // ===== 14. DELETE /admin/relay/model-catalog/:id =====
  server.delete('/admin/relay/model-catalog/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const deleted = await deleteModelCatalog(p.data.id)
      if (!deleted) return reply.status(404).send(error(404, '模型目录条目不存在'))
      return reply.send(success({ id: p.data.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除模型目录条目失败'))
    }
  })

  // ===== 15. GET /admin/relay/proxy-pool — 代理池列表 =====
  server.get('/admin/relay/proxy-pool', async (request, reply) => {
    const q = proxyPoolListQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const result = await listProxies(q.data)
    if (!result.ok) return reply.status(500).send(error(500, '查询代理池失败'))
    return reply.send(
      success({
        list: result.list,
        total: result.total,
        page: q.data.page,
        pageSize: q.data.pageSize,
      }),
    )
  })

  // ===== 16. POST /admin/relay/proxy-pool — 新增代理 =====
  server.post('/admin/relay/proxy-pool', async (request, reply) => {
    const b = createProxyBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const result = await createProxy(b.data)
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        return reply.status(409).send(error(409, '该代理地址已存在'))
      }
      return reply.status(500).send(error(500, '新增代理失败'))
    }
    return reply.status(201).send(success(result.row))
  })

  // ===== 17. PATCH /admin/relay/proxy-pool/:id — 更新代理 =====
  server.patch('/admin/relay/proxy-pool/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = updateProxyBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const patch: UpdateProxyPatch = {}
    if (b.data.status !== undefined) patch.status = b.data.status
    if (b.data.boundAccountId !== undefined) patch.boundAccountId = b.data.boundAccountId
    if (b.data.proxyUrl !== undefined) patch.proxyUrl = b.data.proxyUrl
    const result = await updateProxy(p.data.id, patch)
    if (!result.ok) {
      if (result.reason === 'not_found') return reply.status(404).send(error(404, '代理不存在'))
      if (result.reason === 'duplicate')
        return reply.status(409).send(error(409, '该代理地址已存在'))
      return reply.status(500).send(error(500, '更新代理失败'))
    }
    return reply.send(success(result.row))
  })

  // ===== 18. DELETE /admin/relay/proxy-pool/:id — 删除代理 =====
  server.delete('/admin/relay/proxy-pool/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const result = await deleteProxy(p.data.id)
    if (!result.ok) return reply.status(500).send(error(500, '删除代理失败'))
    if (!result.deleted) return reply.status(404).send(error(404, '代理不存在'))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // ===== 19. POST /admin/relay/proxy-pool/:id/check — 人工标记活性 =====
  server.post('/admin/relay/proxy-pool/:id/check', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = checkProxyBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const found = await getProxyById(p.data.id)
    if (!found.ok) {
      if (found.reason === 'not_found') return reply.status(404).send(error(404, '代理不存在'))
      return reply.status(500).send(error(500, '查询代理失败'))
    }
    await markProxyChecked(found.row.proxyUrl, b.data.alive)
    return reply.send(success({ id: found.row.id, alive: b.data.alive }))
  })

  // ===== 20. POST /admin/relay/accounts/:id/quota — 按需查余额(不进调度轮询) =====
  server.post('/admin/relay/accounts/:id/quota', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter) {
        return reply
          .status(400)
          .send(error(400, `平台 ${row.providerCode} 适配器未注册,无法查余额`))
      }
      // 平台无已实证余额端点 ⇒ 如实"未支持",不得拿 0 冒充(0 在面板读成积分耗尽)
      if (!adapter.getQuota) {
        return reply
          .status(400)
          .send(error(400, `平台 ${row.providerCode} 无已实证的余额端点(未支持)`))
      }
      // 首查直接用库里的票;只有上游**当场**判为鉴权失效才刷新重试一次。
      // authFailed 由适配器按它自己量到的 HTTP 状态码给出,不是文案匹配(§check-error-code-not-text-matching);
      // 不以库里 tokenExpiresAt 为准 —— 现读实证:上游已回 401 code 1001,而该列仍记着未来到期时刻,
      // 按时间戳触发自愈会让这一格整条不生效。形态与转发链路 chat 的 401 自愈一致,仍只重试一次。
      let live = row
      let outcome = await adapter.getQuota(
        { row: live, credentials: decryptAccountCredentials(live) },
        { proxyUrl: resolveAccountProxyUrl(live.proxyUrl) },
      )
      let attemptedRefresh = false
      if (!outcome.ok && outcome.authFailed && adapter.refreshToken) {
        attemptedRefresh = true
        await refreshOne(live)
        const [fresh] = await dbRead
          .select()
          .from(aiRelayAccountPool)
          .where(eq(aiRelayAccountPool.id, p.data.id))
          .limit(1)
        live = fresh ?? live
        outcome = await adapter.getQuota(
          { row: live, credentials: decryptAccountCredentials(live) },
          { proxyUrl: resolveAccountProxyUrl(live.proxyUrl) },
        )
      }
      // 上游**当场**明确拒收(不管有没有换票、换票后是否仍被拒)⇒ 到期列收敛到当下 + 健康降级,
      // 与巡检/刷新失败同一口径(明确拒收 ⇒ down)。否则"换票成功写了新未来时刻、余额仍 401"
      // 会让该列继续冒充「票仍可用」—— 这正是本票的立因现场。实现单点在 scheduler。
      if (!outcome.ok && outcome.authFailed) {
        await markAccountAuthRejected(p.data.id, outcome.error ?? null)
      }
      return reply.send(
        success({
          id: live.id,
          providerCode: live.providerCode,
          ok: outcome.ok,
          error: outcome.error ?? null,
          quota: outcome.quota ?? null,
          attemptedRefresh,
          queriedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '余额查询失败'))
    }
  })

  // ===== 24. POST /admin/relay/accounts/:id/models — 按需点查可用模型清单 =====
  // 形状统一:优先富契约 listModelsDetailed(qoder 走本机 CLI --list-models,scope=本机登录态),
  // 否则回落既有 listModels(string[],trae/workbuddy/codearts/grokbot/lingma 等)逐名包装。
  // 两者都无(如 minimax,模型清单端点未实证)⇒ 如实 400 未支持,绝不编造清单。
  server.post('/admin/relay/accounts/:id/models', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter) {
        return reply
          .status(400)
          .send(error(400, `平台 ${row.providerCode} 适配器未注册,无法查模型清单`))
      }
      if (typeof adapter.listModelsDetailed === 'function') {
        // qoder 通路:CLI 用本机登录态,不消费库凭据;结果 scope 原样透传(管理页须展示语义)
        const outcome = await adapter.listModelsDetailed(
          { row, credentials: decryptAccountCredentials(row) },
          {},
        )
        return reply.send(
          success({
            id: row.id,
            providerCode: row.providerCode,
            ok: outcome.ok,
            error: outcome.error ?? null,
            scope: outcome.scope ?? null,
            models: outcome.models ?? [],
            queriedAt: new Date().toISOString(),
          }),
        )
      }
      if (typeof adapter.listModels === 'function') {
        const names = await adapter.listModels(
          { row, credentials: decryptAccountCredentials(row) },
          { proxyUrl: resolveAccountProxyUrl(row.proxyUrl) },
        )
        return reply.send(
          success({
            id: row.id,
            providerCode: row.providerCode,
            ok: true,
            error: null,
            scope: 'upstream-account',
            models: (Array.isArray(names) ? names : []).map((n) => ({ name: String(n) })),
            queriedAt: new Date().toISOString(),
          }),
        )
      }
      return reply
        .status(400)
        .send(error(400, `平台 ${row.providerCode} 无已实证的模型清单通路(未支持)`))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '模型清单查询失败'))
    }
  })
}

export default relayAccountPoolRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
