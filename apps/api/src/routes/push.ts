// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from 'node:process'
import { sql, and, eq, inArray } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { deviceTokens, userPreferences } from '@ihui/database'
import { sendPushBatch, detectPushProvider, type PushMessage, type PushResult } from '../services/push-provider.js'
import { resolveTruncation } from '../services/agent-runtime/session-store.js'
import { USER_PREFERENCE_GROUPS } from '../db/user-preferences-queries.js'
import {
  resolveAndroidNotificationTarget,
  ANDROID_DEFAULT_CHANNEL_ID,
} from '@ihui/shared/notifications/ringtone'

/** 通知偏好键(与设置页/端侧同步:铃声 id 与声音开关,同落 group=notifications)。 */
const NOTIFICATION_PREF_KEYS = ['ringtone', 'soundEnabled'] as const

// =============================================================================
// Zod schemas
// =============================================================================

const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1).max(500),
  deviceType: z.string().max(50).optional(),
})

const sendPushBodySchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  clickUrl: z.url().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  /** 指定设备 token 列表；若不提供则按 memberId 推送 */
  tokens: z.array(z.string().min(1).max(500)).max(100).optional(),
  /** 按 memberId 推送（需配合 admin 鉴权） */
  memberIds: z.array(z.uuid()).max(100).optional(),
})

/** device_tokens 的 platform 列必填且长度 20:从 deviceType 归一,认不出时落 web。 */
function resolveDevicePlatform(deviceType: string | undefined): 'ios' | 'android' | 'web' {
  const value = deviceType?.toLowerCase()
  if (value === 'ios' || value === 'android' || value === 'web') return value
  return 'web'
}

/** F-682:单次群发收件人上限,超出部分截断并在响应中如实标注。 */
const PUSH_RECIPIENT_LIMIT = 10000

interface NotificationPrefs {
  ringtone: string | null
  soundEnabled: string | null
}

/**
 * 批量读取一批用户的通知偏好(ringtone / soundEnabled,group=notifications),一次
 * inArray 查询,禁止 N 次单查。查询抛错时 catch + warn 后返回空 map,调用方据此回落
 * 兜底渠道 —— 偏好缺失/读失败/未知铃声都绝不阻塞推送。
 */
async function loadNotificationPreferences(
  userIds: string[],
): Promise<Map<string, NotificationPrefs>> {
  const map = new Map<string, NotificationPrefs>()
  const uniqueIds = [...new Set(userIds)]
  if (uniqueIds.length === 0) return map
  try {
    const prefRows = await db
      .select({
        userId: userPreferences.userId,
        key: userPreferences.key,
        value: userPreferences.value,
      })
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.group, USER_PREFERENCE_GROUPS.notifications),
          inArray(userPreferences.userId, uniqueIds),
          inArray(userPreferences.key, [...NOTIFICATION_PREF_KEYS]),
        ),
      )
    for (const row of prefRows) {
      let entry = map.get(row.userId)
      if (!entry) {
        entry = { ringtone: null, soundEnabled: null }
        map.set(row.userId, entry)
      }
      if (row.key === 'ringtone') entry.ringtone = row.value
      else if (row.key === 'soundEnabled') entry.soundEnabled = row.value
    }
  } catch (e) {
    console.warn(`[push] 读取通知偏好失败,回落默认渠道: ${(e as Error).message}`)
    return new Map()
  }
  return map
}

// =============================================================================
// 用户端路由（注册/注销设备 token）
// =============================================================================

export const pushRoutes: FastifyPluginAsync = async (server) => {
  // POST /push/devices/register - 用户注册设备 token
  // 2026-11-08 修 F-680:改用 device_tokens(user_id uuid + token 唯一索引)。
  // 旧实现把 users.id(UUID)写进教育域通知设备表的 member_id(integer) ⇒ 100% 22P02,
  // 且 ON CONFLICT (device_token) 无唯一索引可匹配。
  server.post('/push/devices/register', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { deviceToken, deviceType } = parsed.data
    const now = new Date()
    const platform = resolveDevicePlatform(deviceType)
    // upsert：同 token 已存在（device_tokens.token 唯一索引）则刷新归属与状态
    await db
      .insert(deviceTokens)
      .values({
        userId,
        token: deviceToken,
        platform,
        deviceType: deviceType ?? null,
        isActive: true,
        lastUsedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform,
          deviceType: deviceType ?? null,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        },
      })
    return reply.send(success({ registered: true }))
  })

  // POST /push/devices/unregister - 用户注销设备 token
  server.post('/push/devices/unregister', async (request, reply) => {
    await authenticate(request)
    const { deviceToken } = z
      .object({ deviceToken: z.string().min(1).max(500) })
      .parse(request.body)
    // 归属校验:WHERE 必须同时带 token 与 user_id,否则知道他人 device token 即可静默停掉对方推送。
    // 先取现值、按键比较:已停用的行不重复推进 updatedAt(它是增量读的消费源)。
    const existing = await db
      .select({ isActive: deviceTokens.isActive })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.token, deviceToken), eq(deviceTokens.userId, request.userId!)))
      .limit(1)
    if (existing.length === 0) {
      return reply.status(404).send(error(404, '设备不存在或不属于当前用户'))
    }
    if (existing[0]?.isActive) {
      const changed: { isActive: boolean; updatedAt?: Date } = { isActive: false }
      changed.updatedAt = new Date()
      await db
        .update(deviceTokens)
        .set(changed)
        .where(and(eq(deviceTokens.token, deviceToken), eq(deviceTokens.userId, request.userId!)))
    }
    return reply.send(success({ unregistered: true, removed: 1 }))
  })

  // GET /push/provider - 查询当前推送 provider
  server.get('/push/provider', async (_request, reply) => {
    // expo 不占 provider 名：它按 **token 形态**（ExponentPushToken[...]）分流，无需自持
    // FCM 私钥即可用。单独给出 expo=true，否则只注册了 Expo token 的管理端会看到
    // provider=stub 而误判"没有通道"（SDB-47 的 fail-closed 口径不能被误读成没配置）。
    return reply.send(success({ provider: detectPushProvider(), expo: true }))
  })

  // GET /push/templates - 客户端可订阅的微信小程序订阅消息模板列表
  // 返回真实微信模板 ID(环境变量配置,如 WX_MINI_REMIND_TMPL_ID),
  // 客户端直接把 id 传给 requestSubscribeMessage(tmplIds);未配置任何模板时返回空列表。
  server.get('/push/templates', async (_request, reply) => {
    const list: Array<{ id: string; code: string; title: string; variables: null }> = []
    if (env.WX_MINI_REMIND_TMPL_ID) {
      list.push({
        id: env.WX_MINI_REMIND_TMPL_ID,
        code: 'edu_fee_reminder',
        title: '待付款提醒',
        variables: null,
      })
    }
    return reply.send(success({ list, total: list.length }))
  })
}

// =============================================================================
// 失效 token 清理（2026-11-26）
// =============================================================================

/**
 * 上游明确表示"这个 token 已经不存在"的错误判定——只有命中才允许置 isActive=false。
 *
 * 反例必须留在射程外：超时、限流、鉴权失败、网络不可达都是"这次没发成"，
 * 不是"设备没了"；按后者处理会把好设备永久打成静音，且用户不会自己回来开启。
 */
const DEAD_TOKEN_ERROR_PATTERNS: readonly RegExp[] = [
  /DeviceNotRegistered/i,
  /InvalidRegistration/i,
  /NotRegistered/i,
  /invalid registration token/i,
  /unregistered/i,
]

export function isDeadTokenError(err: string | undefined): boolean {
  return typeof err === 'string' && DEAD_TOKEN_ERROR_PATTERNS.some((re) => re.test(err))
}

/** 按投递序对齐取失效 token（sendPushBatch 保序；长度不等只取可靠前缀，不瞎猜）。 */
export function collectDeadTokens(
  targets: readonly string[],
  results: readonly PushResult[],
): string[] {
  const limit = Math.min(targets.length, results.length)
  const dead: string[] = []
  for (let i = 0; i < limit; i += 1) {
    const result = results[i]
    if (result && !result.success && isDeadTokenError(result.error)) {
      dead.push(targets[i] as string)
    }
  }
  return dead
}

/** 批量置失效。失败只 warn：清理是卫生动作，绝不因它让推送响应失败或 500。 */
async function deactivateDeadTokens(tokens: readonly string[]): Promise<number> {
  if (tokens.length === 0) return 0
  try {
    await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(deviceTokens.token, [...tokens]))
    return tokens.length
  } catch (e) {
    console.warn(`[push] 失效 token 清理失败（不影响本次投递结果）: ${(e as Error).message}`)
    return 0
  }
}

// =============================================================================
// 管理员路由（发送推送）
// =============================================================================

export const adminPushRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // POST /push/send - 发送推送（支持按 tokens 或 memberIds）
  server.post('/push/send', async (request, reply) => {
    const parsed = sendPushBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { title, body: msgBody, clickUrl, data, tokens, memberIds } = parsed.data

    const message: PushMessage = { title, body: msgBody, clickUrl, data }
    // SDB-47:未配置通道时每条结果都是 success:false(failed=total),但管理端仅看 failed
    // 无法区分「全部投递失败」与「根本没配通道」,故在响应顶层带出 provider(=stub 即桩)。
    const provider = detectPushProvider()

    // 1. 优先使用显式 tokens。该分支没有用户上下文,读不到个人偏好 ⇒ 落兜底渠道
    //    `default`(等价历史行为),不带 sound;不按铃声分渠道。
    if (tokens && tokens.length > 0) {
      const defaultMessage: PushMessage = { ...message, channelId: ANDROID_DEFAULT_CHANNEL_ID }
      const results = await sendPushBatch(
        tokens.map((t) => ({ token: t })),
        defaultMessage,
      )
      const deactivated = await deactivateDeadTokens(collectDeadTokens(tokens, results))
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          provider,
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
          ...(deactivated > 0 ? { deactivated } : {}),
        }),
      )
    }

    // 2. 按 memberIds(user uuid)查询激活的设备 token
    if (memberIds && memberIds.length > 0) {
      // F-682:收件人查询必须有上限,避免超大群发把结果集与内存一次打满;
      // 多取 1 条用于判断是否被截断,并在响应中如实标注(不静默截断)。
      const rows = await db
        .select({ token: deviceTokens.token, userId: deviceTokens.userId })
        .from(deviceTokens)
        .where(and(inArray(deviceTokens.userId, memberIds), eq(deviceTokens.isActive, true)))
        .limit(PUSH_RECIPIENT_LIMIT + 1)
      const { truncated } = resolveTruncation(rows, PUSH_RECIPIENT_LIMIT, 'probed')
      if (truncated) {
        console.warn(
          `[push] 收件人超过上限 ${PUSH_RECIPIENT_LIMIT},已截断: memberIds=${memberIds.length}`,
        )
      }
      const activeRows = rows.slice(0, PUSH_RECIPIENT_LIMIT)
      if (activeRows.length === 0) {
        return reply.send(
          success({
            provider,
            total: 0,
            success: 0,
            failed: 0,
            results: [],
            note: '指定用户无激活设备',
          }),
        )
      }

      // 一次 inArray 批量读这批判用户的铃声/声音偏好(禁止 N 次单查)。
      // 失败安全:偏好查询抛错必须 catch + warn 后整体回落兜底渠道,绝不因偏好读不到
      // 让推送失败或返回 500;用户在偏好表无任何行 ⇒ 同样回落 `default`(历史行为)。
      const prefByUser = await loadNotificationPreferences(activeRows.map((r) => r.userId))

      // 按 Android 投递目标(channelId)分组:同一渠道的 token 合成一批投递,消息带上
      // 渠道与音源;静音渠道不带 sound。结果合并回原响应形状,条数不丢。
      const groups = new Map<
        string,
        { targets: Array<{ token: string }>; channelId: string; sound?: string }
      >()
      for (const row of activeRows) {
        const prefs = prefByUser.get(row.userId)
        const target = prefs
          ? resolveAndroidNotificationTarget({
              ringtone: prefs.ringtone,
              soundEnabled: prefs.soundEnabled,
            })
          : { channelId: ANDROID_DEFAULT_CHANNEL_ID }
        let group = groups.get(target.channelId)
        if (!group) {
          group = { targets: [], channelId: target.channelId, sound: target.sound }
          groups.set(target.channelId, group)
        }
        group.targets.push({ token: row.token })
      }

      const results: PushResult[] = []
      const deadTokens: string[] = []
      for (const group of groups.values()) {
        const groupMessage: PushMessage = {
          ...message,
          channelId: group.channelId,
          ...(group.sound ? { sound: group.sound } : {}),
        }
        const batch = await sendPushBatch(group.targets, groupMessage)
        results.push(...batch)
        // sendPushBatch 保序 ⇒ 用同组 targets 对齐取失效 token（结果被分组重排，
        // 不能拿全量 activeRows 的下标去对）。
        deadTokens.push(...collectDeadTokens(group.targets.map((t) => t.token), batch))
      }
      const deactivated = await deactivateDeadTokens(deadTokens)
      const successCount = results.filter((r) => r.success).length
      return reply.send(
        success({
          provider,
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results,
          ...(deactivated > 0 ? { deactivated } : {}),
          ...(truncated ? { truncated: true, note: '收件人超过上限,已截断' } : {}),
        }),
      )
    }

    return reply.status(400).send(error(400, '必须提供 tokens 或 memberIds'))
  })

  // GET /push/devices - 设备列表（分页 + 筛选）
  // 2026-11-08 修 F-680:读取路径同样接到 device_tokens;member_id 作为兼容别名保留,
  // 实际过滤列为 user_id(uuid)。
  server.get('/push/devices', async (request, reply) => {
    const { page, pageSize, memberId, isActive } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        memberId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
        isActive: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
      })
      .parse(request.query)

    const conds = []
    if (memberId !== undefined) conds.push(sql`user_id = ${memberId}::uuid`)
    if (isActive !== undefined) conds.push(sql`is_active = ${isActive === 'true'}`)
    const where =
      conds.length > 0 ? sql.join(['WHERE', sql.join(conds, sql` AND `)], sql` `) : sql``

    const offset = (page - 1) * pageSize
    const listRows = await db.execute(sql`
      SELECT id, user_id AS member_id, device_type, token AS device_token,
             is_active, created_at, updated_at
      FROM device_tokens
      ${where}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM device_tokens ${where}
    `)
    const total = (countRows as unknown as Array<{ count: number }>)[0]?.count ?? 0
    return reply.send(success({ list: listRows, total, page, pageSize }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
