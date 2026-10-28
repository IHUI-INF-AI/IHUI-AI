// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { isDevelopmentRuntime } from '../config/index.js'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import { isValidApiKeyPermission } from '@ihui/types'
import {
  userMargins,
  tokenFlows,
  users,
  apiLogs,
  apiSubscriptions,
  apiSubscriptionWindowUsage,
  webhookSubscriptions,
  developerApplications,
  teams,
  teamMembers,
  orders,
} from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { requireStepUpForTwoFactorUser } from '../services/two-factor-step-up-store.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { createOrder } from '../db/payment-queries.js'
import {
  findDeveloperInfo,
  findDeveloperPricingById,
  activateDeveloperSubscription,
  getMyDeveloperSubscription,
} from '../db/developer-queries.js'
import {
  USER_PREFERENCE_GROUPS,
  findUserPreferences,
  upsertUserPreference,
  deleteUserPreference,
} from '../db/user-preferences-queries.js'
import * as apiKeysService from '../services/developer-api-keys-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const permissionsSchema = z
  .array(z.string())
  .refine((arr) => arr.every(isValidApiKeyPermission), '包含非法权限点')

/**
 * Key 级配额字段(O2 2026-09-21 接入 requireApiKeyAuth 强制链路的可配面)。
 * POST / PATCH 共用;上限与批量端点(developer-relay-keys-admin)一致。
 * null = 显式清除该限制,缺省 = 不修改。
 */
const keyQuotaSchema = z.object({
  allowedIps: z.array(z.string().max(64)).max(50).nullable().optional(),
  blockedIps: z.array(z.string().max(64)).max(50).nullable().optional(),
  allowedModels: z.array(z.string().max(128)).max(100).nullable().optional(),
  maxTokensPerReq: z.number().int().min(1).max(10_000_000).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  rateLimit5h: z.number().int().min(1).max(1_000_000).nullable().optional(),
  rateLimit1d: z.number().int().min(1).max(1_000_000).nullable().optional(),
  rateLimit7d: z.number().int().min(1).max(1_000_000).nullable().optional(),
  perModelRpmLimit: z
    .record(z.string().max(128), z.number().int().min(1).max(1_000_000))
    .nullable()
    .optional(),
  perModelTpmLimit: z
    .record(z.string().max(128), z.number().int().min(1).max(100_000_000))
    .nullable()
    .optional(),
})

/**
 * `rateLimit` 自 2026-09-21 起**正式废弃(DEPRECATED)**。
 *
 * 判据(全仓 grep 的 `rate_limit` / `rateLimit` 读取点):
 * - 鉴权与配额主链路 `enforceApiKeyQuotaAfterAuth`(`plugins/api-key-auth.ts:1024-1050`)
 *   只读 `limitsOf(apiKey)` 的 `rateLimit5h/1d/7d`(`services/key-rate-window-service.ts:46-56`)、
 *   `checkTpmQuota`(`tpm_limit`)与 `perModelRpmLimit/perModelTpmLimit`;
 * - `rateLimit` 仅被复制进 `request.apiKey`(`api-key-auth.ts:870,985`),**零限流判定读取点**;
 * - 唯一把它当数值消费的地方是 `routes/v1-knowledge-tools.ts:2857-2859` 的小时/天配额**展示兜底**。
 * 故"设 `rateLimit: 1` 期望第 2 次请求 429"不成立 —— 这是可配置但不生效的死字段。
 *
 * 过渡策略(保留一个版本,不静默保留误导):
 * ① schema 仍接受并写列(不破坏存量客户端与 relay/设置页展示);
 * ② 只要请求携带该字段,响应即回 `Deprecation: true` + `X-Ihui-Deprecated-Fields` +
 *    `X-Ihui-Deprecated-Hint`(ASCII,避免 Node 头值非 latin1 抛错)显式告知失效与替代旋钮;
 * ③ OpenAPI 字段描述同步标注(由 `pnpm openapi:export` 落产物);
 * ④ 计划 2026-12-31 起 schema 拒收(400)。
 */
const DEPRECATED_KEY_FIELDS = ['rateLimit'] as const
const DEPRECATED_KEY_FIELD_HINT =
  'rateLimit is deprecated and inert for rate limiting. Use rateLimit5h/rateLimit1d/rateLimit7d (429 code 1010) or perModelRpmLimit (429 code 1007). Removal target: 2026-12-31.'

/** 请求体携带废弃字段时挂废弃响应头(不改动响应体,兼容既有客户端与断言)。 */
function noteDeprecatedKeyFields(reply: FastifyReply, body: unknown): void {
  const sent = DEPRECATED_KEY_FIELDS.filter(
    (field) =>
      typeof body === 'object' && body !== null && field in (body as Record<string, unknown>),
  )
  if (sent.length === 0) return
  void reply.header('Deprecation', 'true')
  void reply.header('X-Ihui-Deprecated-Fields', sent.join(','))
  void reply.header('X-Ihui-Deprecated-Hint', DEPRECATED_KEY_FIELD_HINT)
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: permissionsSchema.default([]),
  rateLimit: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe(
      'DEPRECATED(2026-09-21 起不参与任何限流判定,2026-12-31 移除)。' +
        '限请求数请用 rateLimit5h/rateLimit1d/rateLimit7d(429 code 1010),' +
        '每分钟请用 perModelRpmLimit(429 code 1007)。',
    ),
  ...keyQuotaSchema.shape,
})

const updateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: permissionsSchema.optional(),
  rateLimit: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe(
      'DEPRECATED(2026-09-21 起不参与任何限流判定,2026-12-31 移除)。' +
        '限请求数请用 rateLimit5h/rateLimit1d/rateLimit7d(429 code 1010),' +
        '每分钟请用 perModelRpmLimit(429 code 1007)。',
    ),
  status: z.enum(['active', 'revoked']).optional(),
  ...keyQuotaSchema.shape,
})

/** ISO 字符串 → Date;undefined = 不修改,null = 清除(分别透传给 service)。 */
function toExpiresAt(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value
  return new Date(value)
}

const subscribeBody = z.object({
  pricingId: z.uuid({ error: '无效的套餐 ID' }),
  period: z.enum(['monthly', 'yearly']).optional(),
  paymentMethod: z.string().optional().default('wechat'),
})

const withdrawBodySchema = z.object({
  amount: z.number().int().min(1, '提现金额必须大于 0'),
})

const withdrawalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// ── G-962 批 4a(C 组)新增面:开发者控制台 12+1 端点 ──

/** 通知偏好 6 键(与 apps/web developer/notifications 页 NotificationPrefs 对齐)。 */
const NOTIFICATION_PREF_KEYS = [
  'apiError',
  'quotaWarning',
  'webhookFailure',
  'weeklyReport',
  'versionUpdate',
  'billingReminder',
] as const

/** 开发者偏好设置 3 键(与 apps/web developer/settings 页 DevPreferences 对齐)。 */
const SETTINGS_PREF_KEYS = ['defaultVersion', 'sandboxAutoRun', 'errorReport'] as const

/** userPreferences 键前缀:与既有通知渠道偏好/其他设置键隔离(§0.6 单一真相源)。 */
const DEV_NOTIFY_PREFIX = 'dev.notify.'
const DEV_SETTINGS_PREFIX = 'dev.settings.'

const notificationPrefsBodySchema = z.object({
  preferences: z.object({
    apiError: z.boolean().optional(),
    quotaWarning: z.boolean().optional(),
    webhookFailure: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    versionUpdate: z.boolean().optional(),
    billingReminder: z.boolean().optional(),
  }),
})

const devSettingsBodySchema = z.object({
  info: z
    .object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).nullable().optional(),
      website: z.string().max(255).nullable().optional(),
      // email 属账号字段(改绑需验证流程),本面只读不回写;携带时忽略。
      email: z.string().max(255).optional(),
      company: z.string().max(100).optional(),
    })
    .optional(),
  preferences: z
    .object({
      defaultVersion: z.string().max(50).optional(),
      sandboxAutoRun: z.boolean().optional(),
      errorReport: z.boolean().optional(),
    })
    .optional(),
})

const devInfoUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  website: z.string().max(255).nullable().optional(),
})

/**
 * GET /docs 数据源:apps/api/openapi.json 构建产物(由 `pnpm openapi:export` 落盘)。
 * 按 tag 派生 ApiDocGroup[];src/routes 与 dist/routes 相对路径同为 ../../openapi.json。
 * 模块级缓存按 mtime 失效;文件缺失时返回空数组(不造假数据)。
 */
type ApiDocEndpoint = {
  id: string
  method: string
  path: string
  summary: string
  category: string
  params: Array<{ name: string; type: string; required?: boolean; description?: string }>
}
let apiDocsCache: {
  mtimeMs: number
  groups: Array<{ category: string; endpoints: ApiDocEndpoint[] }>
} | null = null

function loadApiDocGroups(): Array<{ category: string; endpoints: ApiDocEndpoint[] }> {
  const specPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'openapi.json')
  let mtimeMs: number
  try {
    mtimeMs = statSync(specPath).mtimeMs
  } catch {
    return []
  }
  if (apiDocsCache && apiDocsCache.mtimeMs === mtimeMs) return apiDocsCache.groups
  let raw: string
  try {
    raw = readFileSync(specPath, 'utf8')
  } catch {
    return []
  }
  const groups = new Map<string, ApiDocEndpoint[]>()
  try {
    const spec = JSON.parse(raw) as {
      paths?: Record<
        string,
        Record<
          string,
          {
            tags?: string[]
            summary?: string
            operationId?: string
            parameters?: Array<{
              name?: string
              required?: boolean
              description?: string
              schema?: { type?: string }
            }>
          }
        >
      >
    }
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
        const op = item?.[method]
        if (!op || typeof op !== 'object') continue
        const category = op.tags?.[0] ?? 'general'
        const params = (op.parameters ?? [])
          .filter((p) => typeof p?.name === 'string')
          .map((p) => ({
            name: p.name as string,
            type: p.schema?.type ?? 'string',
            required: p.required === true ? true : undefined,
            description: p.description,
          }))
        const bucket = groups.get(category) ?? []
        bucket.push({
          id: `${method.toUpperCase()}:${path}`,
          method: method.toUpperCase(),
          path,
          summary: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
          category,
          params,
        })
        groups.set(category, bucket)
      }
    }
  } catch {
    return []
  }
  const result = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, endpoints]) => ({
      category,
      endpoints: endpoints.sort(
        (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
      ),
    }))
  apiDocsCache = { mtimeMs, groups: result }
  return result
}

/** 当前生效的 API 订阅快照行(active 且未到期)。 */
async function findActiveApiSubscription(userId: string) {
  const rows = await db
    .select()
    .from(apiSubscriptions)
    .where(
      and(
        eq(apiSubscriptions.userId, userId),
        eq(apiSubscriptions.status, 'active'),
        gte(apiSubscriptions.endAt, new Date()),
      ),
    )
    .orderBy(desc(apiSubscriptions.endAt))
    .limit(1)
  return rows[0]
}

/** 取订阅某窗口类型最近一行的已用 token(无行 = 0)。 */
async function latestWindowTokensUsed(subscriptionId: string, windowType: string): Promise<number> {
  const rows = await db
    .select({ tokensUsed: apiSubscriptionWindowUsage.tokensUsed })
    .from(apiSubscriptionWindowUsage)
    .where(
      and(
        eq(apiSubscriptionWindowUsage.subscriptionId, subscriptionId),
        eq(apiSubscriptionWindowUsage.windowType, windowType),
      ),
    )
    .orderBy(desc(apiSubscriptionWindowUsage.windowStart))
    .limit(1)
  return rows[0]?.tokensUsed ?? 0
}

/** 从 userPreferences 行里按前缀解出 boolean/字符串偏好对象(只回真实存过的键)。 */
function pickPrefValues(
  list: Array<{ key: string; value: string | null }>,
  prefix: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of list) {
    if (!row.key.startsWith(prefix) || row.value === null) continue
    const field = row.key.slice(prefix.length)
    try {
      out[field] = JSON.parse(row.value)
    } catch {
      out[field] = row.value
    }
  }
  return out
}

// =============================================================================
// 路由
// =============================================================================

const developerRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有开发者 API 密钥端点需登录
  server.addHook('preHandler', requireAuth)

  // GET /api-keys — 列出当前用户的 API 密钥
  server.get('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const list = await apiKeysService.listKeys(userId)
    return reply.send(success({ list }))
  })

  // POST /api-keys — 创建 API 密钥
  server.post('/api-keys', async (request, reply) => {
    const userId = request.userId!
    const parsed = createKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 2FA step-up：已开 2FA 的账号，签发长期凭据前必须有窗内二次验证（会话被窃 ⇒ 拿不到 key）。
    // 未开 2FA 的账号逐字不变；判不出账号状态一律拒。文案直接给出下一步端点，
    // 因为这条会被脚本/curl 调用命中，光说"需要验证"没人知道要做什么。
    const gate = await requireStepUpForTwoFactorUser({ userId, redis: request.server.redis })
    if (!gate.ok) {
      return reply
        .status(401)
        .send(
          error(
            401,
            gate.code === 'STEP_UP_REQUIRED'
              ? '签发 API Key 需要二次验证：请先调用 POST /api/auth/2fa/step-up 提交当前验证码（有效窗 5 分钟）'
              : '暂时无法确认该账号的两步验证状态，请稍后重试',
            gate.code,
          ),
        )
    }
    const { expiresAt, ...quota } = parsed.data
    noteDeprecatedKeyFields(reply, request.body)
    const { apiKey, secret } = await apiKeysService.createKey(userId, {
      ...quota,
      expiresAt: toExpiresAt(expiresAt),
    })
    // 仅此一次返回完整 secret，后续不再提供
    // 跳过响应脱敏,否则 secret 会被 response-sanitizer 误伤为 '***'
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey, secret }))
  })

  // DELETE /api-keys/:id — 删除 API 密钥
  server.delete('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await apiKeysService.deleteKey(parsed.data.id, userId)
    if (!ok) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    return reply.send(success({ ok: true }))
  })

  // PATCH /api-keys/:id — 更新权限
  server.patch('/api-keys/:id', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { expiresAt, ...patch } = parsed.data
    noteDeprecatedKeyFields(reply, request.body)
    const updated = await apiKeysService.updateKey(idParsed.data.id, userId, {
      ...patch,
      expiresAt: toExpiresAt(expiresAt),
    })
    if (!updated) return reply.status(404).send(error(404, 'API 密钥不存在或无权操作'))
    return reply.send(success({ apiKey: updated }))
  })

  // GET /api-keys/:id/usage — 查询 API 密钥使用量（从 api_logs 统计）
  server.get('/api-keys/:id/usage', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const usage = await apiKeysService.getUsage(idParsed.data.id, userId)
    if (!usage) return reply.status(404).send(error(404, 'API 密钥不存在或无权查看'))
    return reply.send(
      success({
        callCount: usage.callCount,
        lastUsedAt: usage.lastUsedAt,
        topEndpoints: usage.topEndpoints,
      }),
    )
  })

  // POST /subscribe — 开通开发者套餐（创建订单，开发环境直接激活）
  server.post('/subscribe', async (request, reply) => {
    const userId = request.userId!
    const parsed = subscribeBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { pricingId, paymentMethod } = parsed.data
    const pricing = await findDeveloperPricingById(pricingId)
    if (!pricing || pricing.status !== 1) {
      return reply.status(404).send(error(404, '开发者套餐不存在或已下架'))
    }
    const period = parsed.data.period ?? pricing.period ?? 'monthly'
    const amount = Math.round(Number(pricing.price) * 100)
    const order = await createOrder(
      {
        userId,
        amount,
        orderType: 5,
        productId: pricing.id,
        payType: paymentMethod,
      },
      request.userId ?? null,
    )
    // 档位判定走 config 出口(安全分支禁裸读 NODE_ENV,守门语义见 config/index.ts 头注)
    if (isDevelopmentRuntime) {
      await activateDeveloperSubscription({
        userId,
        pricingId: pricing.id,
        period,
        orderId: order.id,
      })
    }
    return reply.send(
      success({
        orderId: order.id,
        orderNo: order.orderNo,
        amount,
        pricingId: pricing.id,
        period,
      }),
    )
  })

  // GET /dev-info — 开发者信息聚合(账号 + 订阅 + API 密钥摘要 + 开发者申请信息)
  // 供 DeveloperScreen 单次调用替代 subscription/api-keys/info 三连拼装;
  // 密钥仅返回公开标识 key(非明文 secret),不泄露完整密钥。
  server.get('/dev-info', async (request, reply) => {
    const userId = request.userId!
    const [userRow] = await db
      .select({
        email: users.email,
        phone: users.phone,
        nickname: users.nickname,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const [subscription, application, keys] = await Promise.all([
      getMyDeveloperSubscription(userId),
      findDeveloperInfo(userId),
      apiKeysService.listKeys(userId),
    ])
    const activeKeys = keys.filter((k) => k.status === 'active')

    return reply.send(
      success({
        account: userRow
          ? {
              email: userRow.email,
              phone: userRow.phone,
              nickname: userRow.nickname,
              username: userRow.username,
            }
          : null,
        subscription: subscription ?? null,
        apiKeys: {
          count: keys.length,
          activeCount: activeKeys.length,
          firstActiveKey: activeKeys[0]?.key ?? null,
        },
        developer: application
          ? {
              name: application.name,
              description: application.description,
              status: application.status,
              website: application.website,
            }
          : null,
      }),
    )
  })

  // GET /subscription — 查询当前用户生效中的开发者订阅
  server.get('/subscription', async (request, reply) => {
    const userId = request.userId!
    const subscription = await getMyDeveloperSubscription(userId)
    return reply.send(success({ subscription: subscription ?? null }))
  })

  // GET /income — 开发者收入概览(累计收入 / 可提现 / 已提现 / 近 20 条收入明细)
  // 收入分润用 opType=4(佣金),已提现用 opType=1 且 quantity<0
  server.get('/income', async (request, reply) => {
    const userId = request.userId!

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    const available = (margin?.tokenQuantity ?? 0) - (margin?.frozenQuantity ?? 0)

    const [incomeRow] = await db
      .select({ total: sql<number>`coalesce(sum(${tokenFlows.quantity}), 0)::int` })
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 4)))

    const [withdrawnRow] = await db
      .select({ total: sql<number>`coalesce(sum(-${tokenFlows.quantity}), 0)::int` })
      .from(tokenFlows)
      .where(
        and(
          eq(tokenFlows.userId, userId),
          eq(tokenFlows.opType, 1),
          sql`${tokenFlows.quantity} < 0`,
        ),
      )

    const rows = await db
      .select()
      .from(tokenFlows)
      .where(and(eq(tokenFlows.userId, userId), eq(tokenFlows.opType, 4)))
      .orderBy(desc(tokenFlows.createdAt))
      .limit(20)

    const list = rows.map((f) => ({
      id: f.id,
      title: f.remark ?? '智能体收入',
      time: f.createdAt.toISOString(),
      amount: f.quantity,
    }))

    return reply.send(
      success({
        total: incomeRow?.total ?? 0,
        available,
        withdrawn: withdrawnRow?.total ?? 0,
        list,
      }),
    )
  })

  // GET /withdrawals — 当前用户提现记录列表(分页)
  server.get('/withdrawals', async (request, reply) => {
    const userId = request.userId!
    const parsed = withdrawalListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const where = and(
      eq(tokenFlows.userId, userId),
      eq(tokenFlows.opType, 1),
      sql`${tokenFlows.quantity} < 0`,
    )

    const list = await db
      .select()
      .from(tokenFlows)
      .where(where)
      .orderBy(desc(tokenFlows.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(tokenFlows)
      .where(where)

    return reply.send(success({ list, total: countRow?.total ?? 0, page, pageSize }))
  })

  // POST /withdrawals — 发起提现申请(冻结余额 + 记录 opType=1 负向流水)
  server.post(
    '/withdrawals',
    // 资金型端点补限速(2026-10-27):此前零逐路由配额,可与余额检查并行轰炸
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const userId = request.userId!
      const parsed = withdrawBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { amount } = parsed.data

      // 2026-10-27 原子化:原实现「先读后算再写」且无事务无行锁 —— N 个并行请求全部通过
      // `available < amount` 检查后各自叠加冻结,同一笔余额被重复冻结/提走;且流水 INSERT 在
      // 事务外(冻结成功而流水缺失 = 对账黑洞)。对齐 relay-billing-service 的既有样板:
      // db.transaction + SELECT ... FOR UPDATE 行锁,余额检查、冻结、流水同生共死。
      try {
        const flow = await db.transaction(async (tx) => {
          const [margin] = await tx
            .select()
            .from(userMargins)
            .where(eq(userMargins.userId, userId))
            .for('update')
            .limit(1)
          const balance = margin?.tokenQuantity ?? 0
          const frozen = margin?.frozenQuantity ?? 0
          if (balance - frozen < amount) {
            throw Object.assign(new Error('可用余额不足'), { statusCode: 400 })
          }
          if (margin) {
            await tx
              .update(userMargins)
              .set({ frozenQuantity: frozen + amount, updatedAt: new Date() })
              .where(eq(userMargins.userId, userId))
          } else {
            await tx
              .insert(userMargins)
              .values({ userId, tokenQuantity: 0, frozenQuantity: amount })
          }
          const [created] = await tx
            .insert(tokenFlows)
            .values({
              userId,
              opType: 1,
              quantity: -amount,
              balanceAfter: balance - amount,
              remark: '提现申请',
            })
            .returning()
          return created
        })
        return reply.status(201).send(success({ flow, status: 'pending' }))
      } catch (e) {
        const statusCode = (e as { statusCode?: number }).statusCode ?? 500
        if (statusCode < 500) {
          return reply.status(statusCode).send(error(statusCode, (e as Error).message))
        }
        request.log.error(e)
        return reply.status(500).send(error(500, '发起提现失败'))
      }
    },
  )

  // =============================================================================
  // G-962 批 4a(C 组):开发者控制台补面(#54-63、#65、#101;#64 versions 残段移交)
  // =============================================================================

  // GET /summary — 开发者首页概览(调用量/密钥数/Webhook 数/套餐/配额,全部真实聚合)
  server.get('/summary', async (request, reply) => {
    const userId = request.userId!
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [callRow, webhookRow, keys, devSub, apiSub] = await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(apiLogs)
        .where(and(eq(apiLogs.userId, userId), gte(apiLogs.createdAt, monthStart)))
        .then((r) => r[0]),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.userId, userId))
        .then((r) => r[0]),
      apiKeysService.listKeys(userId),
      getMyDeveloperSubscription(userId),
      findActiveApiSubscription(userId),
    ])

    const pricing = devSub?.pricingId ? await findDeveloperPricingById(devSub.pricingId) : undefined

    let quotaUsed: number | undefined
    let quotaTotal: number | undefined
    if (apiSub) {
      quotaTotal = apiSub.monthlyTokenLimit
      quotaUsed = await latestWindowTokensUsed(apiSub.id, 'monthly')
    }

    return reply.send(
      success({
        callCount: callRow?.c ?? 0,
        keyCount: keys.length,
        webhookCount: webhookRow?.c ?? 0,
        planName: pricing?.name ?? apiSub?.planName,
        monthFee: pricing ? Number(pricing.price) : undefined,
        quotaUsed,
        // -1 = 不限(前端 formatTokens 已处理 ∞);0 = 未配置该维度时不返回
        quotaTotal: quotaTotal !== undefined && quotaTotal !== 0 ? quotaTotal : undefined,
      }),
    )
  })

  // GET /docs — API 文档分组(数据源:apps/api/openapi.json 构建产物按 tag 派生)
  server.get('/docs', async (_request, reply) => {
    return reply.send(success(loadApiDocGroups()))
  })

  // GET /billing — 账单流水(developer 订阅订单 orderType=5)+ 支付方式(无表 ⇒ 真实空列表)
  server.get('/billing', async (request, reply) => {
    const userId = request.userId!
    const rows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.orderType, 5)))
      .orderBy(desc(orders.createdAt))
      .limit(50)

    const bills = rows.map((o) => ({
      id: o.id,
      invoiceNo: o.orderNo,
      amount: o.amount / 100, // 分 → 元(前端 currencyFmt 直接格式化)
      period: (o.paidAt ?? o.createdAt).toISOString().slice(0, 7),
      status: o.status === 'paid' ? 'paid' : o.status === 'pending' ? 'pending' : 'failed',
      createdAt: o.createdAt.toISOString(),
    }))

    return reply.send(success({ bills, paymentMethods: [] }))
  })

  // GET /limits — 日/周/月 token 限额与当前窗口用量(api_subscriptions 快照 + window_usage)
  server.get('/limits', async (request, reply) => {
    const userId = request.userId!
    const apiSub = await findActiveApiSubscription(userId)
    if (!apiSub) return reply.send(success({ items: [] }))

    const windows: Array<{ key: string; label: string; limit: number }> = [
      { key: 'daily', label: '每日 Token 限额', limit: apiSub.dailyTokenLimit },
      { key: 'weekly', label: '每周 Token 限额', limit: apiSub.weeklyTokenLimit },
      { key: 'monthly', label: '每月 Token 限额', limit: apiSub.monthlyTokenLimit },
    ]
    const items: Array<{ key: string; label: string; used: number; total: number; unit: string }> =
      []
    for (const w of windows) {
      if (w.limit === 0) continue // 未配置该维度
      const used = await latestWindowTokensUsed(apiSub.id, w.key)
      items.push({ key: w.key, label: w.label, used, total: w.limit, unit: 'tokens' })
    }
    return reply.send(success({ planName: apiSub.planName, items }))
  })

  // GET /versions — API 版本记录(G-962 B8;web developer/versions 页读 data 数组)
  // 数据源待接:库内无 API 版本表,版本公告只存在于文档/发布记录。返回空数组为真实空态。
  server.get('/versions', async (_request, reply) => {
    return reply.send(success([]))
  })

  // GET /notifications — 开发者通知偏好(userPreferences group=notifications,键前缀 dev.notify.)
  server.get('/notifications', async (request, reply) => {
    const userId = request.userId!
    const { list } = await findUserPreferences(userId, USER_PREFERENCE_GROUPS.notifications)
    return reply.send(success({ preferences: pickPrefValues(list, DEV_NOTIFY_PREFIX) }))
  })

  // PUT /notifications — 保存开发者通知偏好(6 键 boolean)
  server.put('/notifications', async (request, reply) => {
    const userId = request.userId!
    const parsed = notificationPrefsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    for (const [key, value] of Object.entries(parsed.data.preferences)) {
      if (value === undefined) continue
      await upsertUserPreference(
        userId,
        USER_PREFERENCE_GROUPS.notifications,
        `${DEV_NOTIFY_PREFIX}${key}`,
        JSON.stringify(value),
      )
    }
    return reply.send(success({ ok: true }))
  })

  // GET /sandbox — 沙箱调试台环境快照(密钥/订阅/Webhook 真实状态)
  server.get('/sandbox', async (request, reply) => {
    const userId = request.userId!
    const [keys, devSub, apiSub, webhookRow] = await Promise.all([
      apiKeysService.listKeys(userId),
      getMyDeveloperSubscription(userId),
      findActiveApiSubscription(userId),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.userId, userId))
        .then((r) => r[0]),
    ])
    const activeKeys = keys.filter((k) => k.status === 'active')
    return reply.send(
      success({
        environment: 'developer-sandbox',
        generatedAt: new Date().toISOString(),
        keys: {
          total: keys.length,
          active: activeKeys.length,
          firstActiveKey: activeKeys[0]?.key ?? null,
        },
        developerSubscription: devSub
          ? {
              pricingId: devSub.pricingId,
              period: devSub.period,
              endTime: devSub.endTime.toISOString(),
            }
          : null,
        apiSubscription: apiSub
          ? {
              planName: apiSub.planName,
              status: apiSub.status,
              endAt: apiSub.endAt.toISOString(),
              dailyTokenLimit: apiSub.dailyTokenLimit,
              weeklyTokenLimit: apiSub.weeklyTokenLimit,
              monthlyTokenLimit: apiSub.monthlyTokenLimit,
            }
          : null,
        webhookCount: webhookRow?.c ?? 0,
      }),
    )
  })

  // GET /settings — 开发者设置(申请信息 + 账号邮箱 + 偏好设置 3 键)
  server.get('/settings', async (request, reply) => {
    const userId = request.userId!
    const [application, [userRow], { list: prefRows }] = await Promise.all([
      findDeveloperInfo(userId),
      db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
      findUserPreferences(userId, USER_PREFERENCE_GROUPS.preferences),
    ])
    return reply.send(
      success({
        info: application
          ? {
              name: application.name,
              email: userRow?.email ?? undefined,
              website: application.website ?? undefined,
            }
          : undefined,
        preferences: pickPrefValues(prefRows, DEV_SETTINGS_PREFIX),
      }),
    )
  })

  // PUT /settings — 保存开发者设置(info 落 developer_applications,preferences 落 userPreferences)
  server.put('/settings', async (request, reply) => {
    const userId = request.userId!
    const parsed = devSettingsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { info, preferences } = parsed.data
    if (!info && !preferences) {
      return reply.status(400).send(error(400, 'info 与 preferences 至少提供一项'))
    }

    if (
      info &&
      (info.name !== undefined || info.description !== undefined || info.website !== undefined)
    ) {
      const existing = await findDeveloperInfo(userId)
      if (existing) {
        await db
          .update(developerApplications)
          .set({
            name: info.name ?? existing.name,
            description: info.description !== undefined ? info.description : existing.description,
            website: info.website !== undefined ? info.website : existing.website,
            updatedAt: new Date(),
          })
          .where(eq(developerApplications.id, existing.id))
      } else {
        if (!info.name) {
          return reply.status(400).send(error(400, '首次保存开发者信息需提供名称'))
        }
        await db.insert(developerApplications).values({
          userId,
          name: info.name,
          description: info.description ?? null,
          website: info.website ?? null,
        })
      }
    }

    if (preferences) {
      for (const key of SETTINGS_PREF_KEYS) {
        const value = preferences[key]
        if (value === undefined) continue
        await upsertUserPreference(
          userId,
          USER_PREFERENCE_GROUPS.preferences,
          `${DEV_SETTINGS_PREFIX}${key}`,
          JSON.stringify(value),
        )
      }
    }
    return reply.send(success({ ok: true }))
  })

  // DELETE /settings — 清除开发者偏好设置(仅删本面 dev.* 键,不动账号与其他设置)
  server.delete('/settings', async (request, reply) => {
    const userId = request.userId!
    let deleted = 0
    for (const key of NOTIFICATION_PREF_KEYS) {
      if (
        await deleteUserPreference(
          userId,
          USER_PREFERENCE_GROUPS.notifications,
          `${DEV_NOTIFY_PREFIX}${key}`,
        )
      )
        deleted++
    }
    for (const key of SETTINGS_PREF_KEYS) {
      if (
        await deleteUserPreference(
          userId,
          USER_PREFERENCE_GROUPS.preferences,
          `${DEV_SETTINGS_PREFIX}${key}`,
        )
      )
        deleted++
    }
    return reply.send(success({ deleted }))
  })

  // GET /team — 开发者团队成员(teams + teamMembers join users;owner 不在 members 行时合成)
  server.get('/team', async (request, reply) => {
    const userId = request.userId!
    let [team] = await db.select().from(teams).where(eq(teams.ownerId, userId)).limit(1)
    if (!team) {
      const [membership] = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId))
        .limit(1)
      if (membership) {
        ;[team] = await db.select().from(teams).where(eq(teams.id, membership.teamId)).limit(1)
      }
    }
    if (!team) return reply.send(success([]))

    const rows = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        nickname: users.nickname,
        username: users.username,
        email: users.email,
        avatar: users.avatar,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, team.id))

    const mapRole = (role: string, isOwner: boolean): string => {
      if (isOwner) return 'owner'
      if (role === 'admin') return 'admin'
      if (role === 'viewer') return 'viewer'
      return 'developer'
    }

    const list = rows.map((r) => ({
      id: r.id,
      nickname: r.nickname ?? r.username ?? '未命名用户',
      avatar: r.avatar ?? undefined,
      email: r.email ?? '',
      role: mapRole(r.role, r.userId === team!.ownerId),
      joinedAt: r.joinedAt.toISOString(),
    }))

    if (!rows.some((r) => r.userId === team.ownerId)) {
      const [ownerRow] = await db
        .select({
          nickname: users.nickname,
          username: users.username,
          email: users.email,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, team.ownerId))
        .limit(1)
      if (ownerRow) {
        list.unshift({
          id: `owner:${team.id}`,
          nickname: ownerRow.nickname ?? ownerRow.username ?? '团队所有者',
          avatar: ownerRow.avatar ?? undefined,
          email: ownerRow.email ?? '',
          role: 'owner',
          joinedAt: team.createdAt.toISOString(),
        })
      }
    }
    return reply.send(success(list))
  })

  // PUT /info — 更新开发者信息(#101;落 developer_applications,无申请记录时创建)
  server.put('/info', async (request, reply) => {
    const userId = request.userId!
    const parsed = devInfoUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findDeveloperInfo(userId)
    if (existing) {
      const [row] = await db
        .update(developerApplications)
        .set({
          name: parsed.data.name ?? existing.name,
          description:
            parsed.data.description !== undefined ? parsed.data.description : existing.description,
          website: parsed.data.website !== undefined ? parsed.data.website : existing.website,
          updatedAt: new Date(),
        })
        .where(eq(developerApplications.id, existing.id))
        .returning()
      if (!row) return reply.status(500).send(error(500, '更新开发者信息失败'))
      return reply.send(success(row))
    }
    if (!parsed.data.name) {
      return reply.status(400).send(error(400, '首次更新开发者信息需提供名称'))
    }
    const [row] = await db
      .insert(developerApplications)
      .values({
        userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        website: parsed.data.website ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建开发者信息失败'))
    return reply.status(201).send(success(row))
  })
}

export default developerRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
