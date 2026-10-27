// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/sms —— 短信通道状态、单发、群发、发送台账、退订黑名单(2026-10-26 立)。
 *
 * 设计边界:
 *  - 群发只允许**已报审的固定文案模板**(腾讯通知/营销模板无变量),不接受自由正文;
 *    自由正文仍走历史通知接口,且阿里云变量上限 35 字符,不适合群发。
 *  - 真发必须显式确认:通知类要 `confirm: "SEND"`;营销类要 `confirm: "SEND_MARKETING"`;
 *    全量用户还要 `confirm: "SEND_ALL"`。dryRun=true 不消耗额度。
 *  - 每次结果都写 sms_delivery_logs(发送审计),回执由 /api/sms/callback 对账。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { env } from 'node:process'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { createOperlog } from '../db/admin-sys-queries.js'
import { logger } from '../utils/logger.js'
import {
  SMS_MARKETING_TEMPLATE_KEYS,
  SMS_NOTICE_TEMPLATE_KEYS,
  type SmsTemplateKey,
} from '../services/sms-types.js'
import {
  SMS_TEMPLATED_RATE_CAPS,
  isMarketingSmsEnabled,
  resolveTemplatedSmsChannel,
  sendTemplatedSms,
} from '../services/sms.js'
import {
  TENCENT_MARKETING_TEMPLATE_ENV_KEYS,
  TENCENT_NOTICE_TEMPLATE_ENV_KEYS,
  pickTencentMarketingTemplateId,
  pickTencentNoticeTemplateId,
} from '../services/sms-tencent.js'
import {
  addSmsUnsubscribe,
  countSmsUnsubscribes,
  listSmsDeliveryLogs,
  listSmsUnsubscribes,
  removeSmsUnsubscribe,
  smsDeliveryLogStats,
} from '../services/sms-compliance.js'
import { acquireOnce } from '../utils/window-counter.js'
import { parsePositiveInt } from '../utils/positive-int.js'
import { normalizeSmsPhone } from '../utils/phone.js'
import {
  getTencentSignReview,
  getTencentTemplateReview,
  type SmsReviewInfo,
  type SmsReviewStatus,
} from '../services/sms-review-status.js'

// 手机号判据唯一入口 = utils/phone.ts(与公开取码端点 auth-codes.ts 同一条 refine+transform)。
// 原自立正则 `^(\+?86)?1\d{10}$` 有两处不同形:13x 以外的号段(如 14/16/19)这里进得来、
// 取码端点进不去;而 0086 前缀与空格连字符这边不收。§0.6:同一件事不许有第二份判据。
const phoneSchema = z
  .string()
  .refine((v) => normalizeSmsPhone(v) !== null, '手机号格式不正确')
  .transform((v) => normalizeSmsPhone(v) as string)

/** 群发默认跳过"近 N 天已成功收到同一模板"的用户。
 *  原实现按注册时间正序取前 N —— 每次群发都命中同一批最老用户,后面的人永远收不到;
 *  跳过近期已收者既能让批次自然向后推进,也顺手挡住重复轰炸。 */
const DEFAULT_BROADCAST_EXCLUDE_RECENT_DAYS = 7

const templateKeySchema = z
  .string()
  .refine(
    (v) =>
      (SMS_NOTICE_TEMPLATE_KEYS as readonly string[]).includes(v) ||
      (SMS_MARKETING_TEMPLATE_KEYS as readonly string[]).includes(v),
    '未知模板 key',
  )

const sendSchema = z.object({
  phone: phoneSchema,
  category: z.enum(['notice', 'marketing']),
  templateKey: templateKeySchema,
  fallbackContent: z.string().min(1).max(500).optional(),
  dryRun: z.boolean().optional().default(false),
  skipRateLimit: z.boolean().optional().default(false),
})

const broadcastSchema = z.object({
  category: z.enum(['notice', 'marketing']),
  templateKey: templateKeySchema,
  fallbackContent: z.string().min(1).max(500).optional(),
  userIds: z.array(z.string().uuid()).max(500).optional(),
  allUsers: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(500).optional(),
  /** 跳过近 N 天已成功收到同模板的用户;0 = 不跳过。 */
  excludeRecentDays: z.number().int().min(0).max(30).optional().default(7),
  /** 客户端幂等键:同一次提交的重试必须复用同一个值;缺省时不做跨请求去重。 */
  requestId: z.string().min(8).max(64).optional(),
  /** 目标批次游标:跳过前 N 个符合条件的目标(可发数超过单次上限时向后翻)。 */
  targetOffset: z.number().int().min(0).max(10_000).optional().default(0),
  dryRun: z.boolean().optional().default(false),
  confirm: z.string().optional(),
})

function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

function templateMatrix(review: Record<string, SmsReviewInfo>): Array<{
  category: 'notice' | 'marketing'
  key: string
  envKey: string
  templateId: string | null
  ready: boolean
  /** 腾讯侧审核状态。没有模板 ID ⇒ null(还没提交过,谈不上审核)。 */
  reviewStatus: SmsReviewStatus | null
  reviewReply: string | null
  reviewedAt: string | null
}> {
  const merge = (base: {
    category: 'notice' | 'marketing'
    key: string
    envKey: string
    templateId: string | null
  }) => {
    const info = base.templateId ? review[base.templateId] : undefined
    return {
      ...base,
      ready: Boolean(base.templateId),
      reviewStatus: base.templateId ? (info?.status ?? 'unknown') : null,
      reviewReply: info?.reply ?? null,
      reviewedAt: info?.updatedAt ?? null,
    }
  }
  const notice = SMS_NOTICE_TEMPLATE_KEYS.map((key) =>
    merge({
      category: 'notice' as const,
      key,
      envKey: TENCENT_NOTICE_TEMPLATE_ENV_KEYS[key],
      templateId: pickTencentNoticeTemplateId(key) ?? null,
    }),
  )
  const marketing = SMS_MARKETING_TEMPLATE_KEYS.map((key) =>
    merge({
      category: 'marketing' as const,
      key,
      envKey: TENCENT_MARKETING_TEMPLATE_ENV_KEYS[key],
      templateId: pickTencentMarketingTemplateId(key) ?? null,
    }),
  )
  return [...notice, ...marketing]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 小并发跑批:腾讯 SendSms 有 QPS 限制,串行太慢、全并发会被限流。 */
async function runBatch<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index]!, index)
      await sleep(60)
    }
  })
  await Promise.all(runners)
  return results
}

/** 短信写操作审计。admin-sms 路由独立注册,没挂 admin-sys 的 onResponse 埋点,
 *  因此群发/拉黑/恢复这类"一次影响一批用户"的动作在这里显式落 sys_operlog。
 *  审计失败只告警 —— 不能让日志库抖动把已完成的发送回滚成失败。 */
async function writeSmsOperlog(
  request: FastifyRequest,
  input: {
    title: string
    method: string
    businessType: number
    param: Record<string, unknown>
    status: number
    errorMsg?: string
  },
): Promise<void> {
  try {
    await createOperlog({
      title: input.title,
      businessType: input.businessType,
      method: input.method,
      requestMethod: request.method,
      operatorType: 0,
      operName: request.userId ?? '',
      operUrl: request.url.split('?')[0]?.slice(0, 255),
      operIp: request.ip ?? '',
      operParam: JSON.stringify(input.param).slice(0, 2000),
      status: input.status,
      errorMsg: input.errorMsg,
    })
  } catch (e) {
    logger.warn('短信操作审计写入失败(不影响业务)', {
      method: input.method,
      error: (e as Error).message,
    })
  }
}

export const adminSmsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  /** 通道与模板状态(不返回任何密钥)。`?refresh=1` 绕过审核状态缓存。 */
  server.get('/status', async (request) => {
    const tencentReady = Boolean(
      env.TENCENT_SMS_SECRET_ID &&
      env.TENCENT_SMS_SECRET_KEY &&
      env.TENCENT_SMS_SDK_APP_ID &&
      env.TENCENT_SMS_SIGN_NAME,
    )
    const q = request.query as Record<string, unknown>
    const force = q.refresh === '1' || q.refresh === 'true'
    const signId = env.TENCENT_SMS_SIGN_ID ?? null

    // 先把"本地已回填的模板 ID"收齐,再一次性问腾讯 —— 逐枚查会把运营页拖成串行。
    const provisional = templateMatrix({})
    const templateIds = provisional.map((t) => t.templateId).filter((v): v is string => Boolean(v))

    const [unsubscribes, templateReview, signReview] = await Promise.all([
      countSmsUnsubscribes(),
      getTencentTemplateReview(templateIds, { force }),
      signId ? getTencentSignReview([signId], { force }) : Promise.resolve(null),
    ])
    const signInfo = signId ? (signReview?.byId[signId] ?? null) : null

    return success({
      provider: env.SMS_PROVIDER ?? 'auto',
      tencent: {
        configured: tencentReady,
        signName: env.TENCENT_SMS_SIGN_NAME ?? null,
        signId,
        signReview: signInfo,
        sdkAppId: env.TENCENT_SMS_SDK_APP_ID ?? null,
        region: env.TENCENT_SMS_REGION ?? 'ap-guangzhou',
        codeTemplates: {
          register: env.TENCENT_SMS_TEMPLATE_CODE_REGISTER || env.TENCENT_SMS_TEMPLATE_CODE || null,
          login: env.TENCENT_SMS_TEMPLATE_CODE_LOGIN || null,
          reset: env.TENCENT_SMS_TEMPLATE_CODE_RESET || null,
          'phone-binding': env.TENCENT_SMS_TEMPLATE_CODE_PHONE_BINDING || null,
        },
      },
      aliyun: {
        configured: Boolean(env.ALI_SMS_ACCESS_KEY_ID && env.ALI_SMS_ACCESS_KEY_SECRET),
        signName: env.ALI_SMS_SIGN_NAME ?? null,
        codeTemplate: env.ALI_SMS_TEMPLATE_CODE ?? null,
        notifyTemplate: env.ALI_SMS_NOTIFY_TEMPLATE_CODE ?? null,
      },
      proxy: { configured: Boolean(env.SMS_API_BASE_URL) },
      callback: {
        tokenConfigured: Boolean(env.SMS_CALLBACK_TOKEN),
        ipAllowlistConfigured: Boolean(env.SMS_CALLBACK_IP_ALLOWLIST),
        path: '/api/sms/callback/tencent',
      },
      compliance: {
        unsubscribeFailClosed: env.SMS_UNSUBSCRIBE_FAIL_CLOSED !== '0',
        unsubscribeCount: unsubscribes,
        marketingEnabled: isMarketingSmsEnabled(),
        marketingMonthlyCap: SMS_TEMPLATED_RATE_CAPS.marketing.monthly,
        marketingDailyCap: SMS_TEMPLATED_RATE_CAPS.marketing.daily,
        marketingGlobalDailyCap: parsePositiveInt(
          env.SMS_MARKETING_GLOBAL_DAILY_CAP,
          100,
          'SMS_MARKETING_GLOBAL_DAILY_CAP',
        ),
        marketingSendWindow: env.SMS_MARKETING_SEND_WINDOW ?? '08:00-21:00(Asia/Shanghai)',
        noticeHourlyCap: SMS_TEMPLATED_RATE_CAPS.notice.hourly,
        noticeDailyCap: SMS_TEMPLATED_RATE_CAPS.notice.daily,
      },
      review: {
        available: templateReview.available,
        checkedAt: templateReview.checkedAt,
        errorCode: templateReview.errorCode ?? null,
        signAvailable: signId ? Boolean(signReview?.available) : null,
      },
      templates: templateMatrix(templateReview.byId),
      broadcastLimit: parsePositiveInt(
        env.SMS_BROADCAST_MAX_PER_RUN,
        200,
        'SMS_BROADCAST_MAX_PER_RUN',
        { max: 500 },
      ),
      broadcastExcludeRecentDays: DEFAULT_BROADCAST_EXCLUDE_RECENT_DAYS,
    })
  })

  /** 单发(测试/客服补偿)。dryRun 只解析通道,不发。 */
  server.post('/send', async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不正确'))
    }
    const body = parsed.data
    const keyMatches =
      body.category === 'notice'
        ? (SMS_NOTICE_TEMPLATE_KEYS as readonly string[]).includes(body.templateKey)
        : (SMS_MARKETING_TEMPLATE_KEYS as readonly string[]).includes(body.templateKey)
    if (!keyMatches) {
      return reply.status(400).send(error(400, '模板 key 与 category 不匹配'))
    }

    const result = await sendTemplatedSms(body.phone, {
      category: body.category,
      templateKey: body.templateKey as SmsTemplateKey,
      fallbackContent: body.fallbackContent,
      dryRun: body.dryRun,
      skipRateLimit: body.skipRateLimit,
      bizType: 'admin-sms',
    })
    if (!result.success && !body.dryRun) {
      await writeSmsOperlog(request, {
        title: '短信单发',
        method: 'sms.send',
        businessType: 1,
        status: 1,
        errorMsg: result.error,
        param: {
          phone: maskPhone(body.phone),
          category: body.category,
          templateKey: body.templateKey,
        },
      })
      return reply.status(200).send(success({ sent: false, ...result }))
    }
    if (!body.dryRun) {
      await writeSmsOperlog(request, {
        title: '短信单发',
        method: 'sms.send',
        businessType: 1,
        status: 0,
        param: {
          phone: maskPhone(body.phone),
          category: body.category,
          templateKey: body.templateKey,
          deduplicated: result.deduplicated ?? false,
        },
      })
    }
    return success({ sent: result.success, ...result })
  })

  /** 群发。默认最多 200 条/次(免费包余量);真发必须 confirm。 */
  server.post('/broadcast', async (request, reply) => {
    const parsed = broadcastSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不正确'))
    }
    const body = parsed.data
    const keyMatches =
      body.category === 'notice'
        ? (SMS_NOTICE_TEMPLATE_KEYS as readonly string[]).includes(body.templateKey)
        : (SMS_MARKETING_TEMPLATE_KEYS as readonly string[]).includes(body.templateKey)
    if (!keyMatches) {
      return reply.status(400).send(error(400, '模板 key 与 category 不匹配'))
    }

    // 目标必须显式声明:原先"ids 为空 ⇒ 全表前 N 个"会在操作员没勾全量时静默群发,
    // 且通知类只凭 confirm:"SEND" 就能绕过 SEND_ALL 这道理应更强的确认。
    const ids = body.userIds ?? []
    const allUsers = body.allUsers === true
    if (allUsers && ids.length > 0) {
      return reply.status(400).send(error(400, 'allUsers 与 userIds 不能同时指定'))
    }
    if (!allUsers && ids.length === 0) {
      return reply.status(400).send(error(400, '请指定 userIds 或 allUsers=true'))
    }

    if (!body.dryRun) {
      if (allUsers) {
        // 全量档用一枚更强的确认词,营销再加一层;不再要求同时输入两枚(原逻辑营销全量无解)。
        const expected = body.category === 'marketing' ? 'SEND_ALL_MARKETING' : 'SEND_ALL'
        if (body.confirm !== expected) {
          return reply.status(400).send(error(400, `全量群发必须传 confirm: "${expected}"`))
        }
      } else if (body.category === 'marketing' && body.confirm !== 'SEND_MARKETING') {
        return reply.status(400).send(error(400, '营销群发必须传 confirm: "SEND_MARKETING"'))
      } else if (body.category === 'notice' && body.confirm !== 'SEND') {
        return reply.status(400).send(error(400, '通知群发必须传 confirm: "SEND"'))
      }
    }

    const maxPerRun = parsePositiveInt(
      env.SMS_BROADCAST_MAX_PER_RUN,
      200,
      'SMS_BROADCAST_MAX_PER_RUN',
      { max: 500 },
    )
    const limit = Math.min(body.limit ?? maxPerRun, maxPerRun)
    const targetOffset = body.targetOffset ?? 0
    const recentDays = Math.max(
      0,
      Math.min(30, Math.floor(body.excludeRecentDays ?? DEFAULT_BROADCAST_EXCLUDE_RECENT_DAYS)),
    )

    // 号码归一与 sms-compliance 的 normalizeSmsPhone 同一口径(+86 / 0086 / 86 前缀、空格连字符)。
    // 审计表存的是裸 11 位,直接拿 users.phone 比会漏掉带前缀的存量数据。
    const normalizedPhone = sql`regexp_replace(CASE
      WHEN u.phone LIKE '+86%' THEN substring(u.phone from 4)
      WHEN u.phone LIKE '0086%' THEN substring(u.phone from 5)
      WHEN u.phone LIKE '86%' AND length(u.phone) = 13 THEN substring(u.phone from 3)
      ELSE u.phone END, '[[:space:]-]', '', 'g')`
    const scopeWhere = sql`u.phone IS NOT NULL AND u.phone <> ''
      AND (${allUsers} OR u.id = ANY(${ids}::uuid[]))`
    const notRecent = sql`NOT EXISTS (
      SELECT 1 FROM sms_delivery_logs l
      WHERE l.phone = ${normalizedPhone}
        AND l.category = ${body.category}
        AND l.template_key = ${body.templateKey}
        AND l.status IN ('accepted', 'delivered')
        AND l.created_at > NOW() - make_interval(days => ${recentDays})
    )`
    const eligibleWhere = sql`${scopeWhere} AND (${recentDays} = 0 OR ${notRecent})`

    let rows: Array<{ id: string; phone: string }>
    let scopeTotal = 0
    let eligible = 0
    try {
      const [scopeRows, eligibleRows, targetRows] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int AS n FROM users u WHERE ${scopeWhere}`),
        db.execute(sql`SELECT COUNT(*)::int AS n FROM users u WHERE ${eligibleWhere}`),
        db.execute(sql`
          SELECT u.id, u.phone FROM users u
          WHERE ${eligibleWhere}
          ORDER BY u.created_at ASC NULLS LAST
          LIMIT ${limit} OFFSET ${targetOffset}
        `),
      ])
      scopeTotal = Number((scopeRows as unknown as Array<{ n: number }>)[0]?.n ?? 0)
      eligible = Number((eligibleRows as unknown as Array<{ n: number }>)[0]?.n ?? 0)
      rows = targetRows as unknown as Array<{ id: string; phone: string }>
    } catch (e) {
      logger.error('短信群发目标查询失败', { error: (e as Error).message })
      return reply.status(500).send(error(500, '查询目标用户失败'))
    }
    const excludedRecent = Math.max(0, scopeTotal - eligible)

    if (rows.length === 0) {
      return success({
        total: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
        scopeTotal,
        eligible,
        excludedRecent,
        excludeRecentDays: recentDays,
        targetOffset,
        results: [],
      })
    }

    // 每次群发一个 runId:同一管理员隔几天再发同一模板时,bizId 不能还是裸 userId,
    // 否则会被幂等表当成"7 天内已发过"整批拦掉。
    const runId = `bc-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`

    if (body.dryRun) {
      const resolved = resolveTemplatedSmsChannel(
        body.category,
        body.templateKey as SmsTemplateKey,
        (env.SMS_PROVIDER ?? 'auto') as 'auto' | 'tencent' | 'aliyun' | 'proxy',
        Boolean(body.fallbackContent),
      )
      return success({
        dryRun: true,
        runId,
        total: rows.length,
        scopeTotal,
        eligible,
        excludedRecent,
        excludeRecentDays: recentDays,
        targetOffset,
        channel: resolved.channel,
        templateId: resolved.templateId ?? null,
        envKey: resolved.envKey,
        samplePhones: rows.slice(0, 5).map((r) => maskPhone(r.phone)),
      })
    }

    // 跨请求幂等:runId 每次新生成,双击/网关重试会各起一批 —— 由客户端带同一个 requestId 才能拦住。
    // 锁 TTL 10 分钟(覆盖一次群发的正常时长),过期后允许重新提交。
    if (body.requestId) {
      const operator = request.userId ?? request.ip
      const lock = await acquireOnce(
        `sms:broadcast:req:${operator}:${body.requestId}`,
        runId,
        10 * 60_000,
      )
      if (!lock.acquired) {
        logger.warn('短信群发重复提交已拦截', {
          requestId: body.requestId,
          firstRunId: lock.existing,
        })
        return reply
          .status(409)
          .send(error(409, `该请求已发起过群发(runId=${lock.existing ?? 'unknown'}),请勿重复提交`))
      }
    }

    const results = await runBatch(rows, 5, async (row) => {
      const r = await sendTemplatedSms(row.phone, {
        category: body.category,
        templateKey: body.templateKey as SmsTemplateKey,
        fallbackContent: body.fallbackContent,
        bizType: 'admin-sms-broadcast',
        bizId: `${runId}:${row.id}`,
      })
      return { userId: row.id, phone: maskPhone(row.phone), ...r }
    })

    const sent = results.filter((r) => r.success).length
    // 合规/限流拦下的不算「通道失败」:全量营销撞上日上限时,若记成 failed,运营会当故障排查
    const suppressed = results.filter(
      (r) =>
        r.error === 'rate_limited' ||
        r.error === 'suppressed_unsubscribed' ||
        r.error === 'global_daily_cap' ||
        r.error === 'duplicate',
    ).length
    const failed = results.length - sent - suppressed

    logger.info('短信群发完成', {
      runId,
      category: body.category,
      templateKey: body.templateKey,
      total: results.length,
      sent,
      failed,
      suppressed,
    })

    await writeSmsOperlog(request, {
      title: '短信群发',
      method: 'sms.broadcast',
      businessType: 1,
      status: failed > 0 ? 1 : 0,
      errorMsg: failed > 0 ? `failed=${failed}` : undefined,
      param: {
        runId,
        category: body.category,
        templateKey: body.templateKey,
        total: results.length,
        sent,
        failed,
        suppressed,
        confirm: body.confirm,
        allUsers: body.allUsers,
        limit,
        excludeRecentDays: recentDays,
        excludedRecent,
        targetOffset,
      },
    })

    return success({
      runId,
      total: results.length,
      sent,
      failed,
      suppressed,
      scopeTotal,
      eligible,
      excludedRecent,
      excludeRecentDays: recentDays,
      targetOffset,
      failures: results.filter((r) => !r.success).slice(0, 50),
      // 不带 requestId 时前端重试没有任何去重保护,如实告诉调用方
      idempotentHint: body.requestId
        ? null
        : '未携带 requestId:超时重试可能重复发送,建议复用同一次提交的 requestId',
    })
  })

  /** 发送台账(回执对账结果也在这)。 */
  server.get('/logs', async (request, reply) => {
    const q = request.query as Record<string, unknown>
    const rawLimit = typeof q.limit === 'string' ? q.limit : undefined
    const limit = parsePositiveInt(rawLimit, 50, 'logs.limit', { max: 200 })
    const rawOffset = Number(typeof q.offset === 'string' ? q.offset : undefined)
    // offset 允许 0,不适用 parsePositiveInt;非法值直接按第一页
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
    const status = typeof q.status === 'string' ? q.status : undefined
    try {
      const [items, stats] = await Promise.all([
        listSmsDeliveryLogs(limit, offset, status),
        smsDeliveryLogStats(status),
      ])
      return success({ items, ...stats, limit, offset })
    } catch (e) {
      logger.error('短信台账查询失败', { error: (e as Error).message })
      return reply.status(500).send(error(500, '查询发送台账失败'))
    }
  })

  /** 退订黑名单。 */
  server.get('/unsubscribes', async (request, reply) => {
    const q = request.query as Record<string, unknown>
    const rawLimit = typeof q.limit === 'string' ? q.limit : undefined
    const limit = parsePositiveInt(rawLimit, 50, 'logs.limit', { max: 200 })
    const rawOffset = Number(typeof q.offset === 'string' ? q.offset : undefined)
    // offset 允许 0,不适用 parsePositiveInt;非法值直接按第一页
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
    try {
      const [items, total] = await Promise.all([
        listSmsUnsubscribes(limit, offset),
        countSmsUnsubscribes(),
      ])
      return success({ items, total, limit, offset })
    } catch (e) {
      logger.error('退订黑名单查询失败', { error: (e as Error).message })
      return reply.status(500).send(error(500, '查询退订黑名单失败'))
    }
  })

  /** 手工拉黑(用户电话投诉等场景)。 */
  server.post('/unsubscribes', async (request, reply) => {
    const schema = z.object({
      phone: phoneSchema,
      reason: z.string().max(160).optional(),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不正确'))
    }
    const ok = await addSmsUnsubscribe({
      phone: parsed.data.phone,
      reason: parsed.data.reason ?? '管理员手工拉黑',
      source: 'admin',
    })
    await writeSmsOperlog(request, {
      title: '短信退订拉黑',
      method: 'sms.unsubscribe.add',
      businessType: 1,
      status: ok ? 0 : 1,
      errorMsg: ok ? undefined : '写入退订黑名单失败',
      param: {
        phone: maskPhone(parsed.data.phone),
        reason: parsed.data.reason ?? '管理员手工拉黑',
      },
    })
    if (!ok) return reply.status(500).send(error(500, '写入退订黑名单失败'))
    return success({ phone: maskPhone(parsed.data.phone), unsubscribed: true })
  })

  /** 恢复接收(用户明确重新同意后使用)。 */
  server.delete('/unsubscribes/:phone', async (request, reply) => {
    const params = request.params as { phone?: string }
    const phone = params.phone ?? ''
    if (!phoneSchema.safeParse(phone).success) {
      return reply.status(400).send(error(400, '手机号格式不正确'))
    }
    const ok = await removeSmsUnsubscribe(phone)
    await writeSmsOperlog(request, {
      title: '短信退订恢复',
      method: 'sms.unsubscribe.remove',
      businessType: 3,
      status: ok ? 0 : 1,
      errorMsg: ok ? undefined : '移除退订黑名单失败',
      param: { phone: maskPhone(phone) },
    })
    if (!ok) return reply.status(500).send(error(500, '移除退订黑名单失败'))
    return success({ phone: maskPhone(phone), unsubscribed: false })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
