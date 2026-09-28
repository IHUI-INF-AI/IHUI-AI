// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 管理后台鉴权/教育/学习路由（11 个端点）。
 * 替代 admin-missing-routes.ts 中的 registerEmptyStub 空桩。
 * 复用现有 userAuthInfo/userMargins/captchas/systemConfigs/lessons/lessonChapters/resources/learnMaps/eduNotification/users 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, sql, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { dedupeIds } from '../utils/batch-outcome.js'
import {
  userAuthInfo,
  userMargins,
  captchas,
  lessons,
  lessonChapters,
  resources,
  learnMaps,
  eduNotification,
  users,
  systemConfigs,
  tDepartment,
  userDevices,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const blacklistQuerySchema = paginationSchema.extend({
  type: z.transform(emptyToUndefined).pipe(z.enum(['user', 'ip', 'device']).optional()),
})

type BlacklistPayload = {
  user: string | null
  type: 'user' | 'ip' | 'device'
  reason: string | null
  status: 'active' | 'removed'
  expiresAt: string | null
  createdAt: string
}

function safeParseBlacklist(value: string): BlacklistPayload {
  const fallback: BlacklistPayload = {
    user: null,
    type: 'user',
    reason: null,
    status: 'active',
    expiresAt: null,
    createdAt: new Date().toISOString(),
  }
  try {
    const parsed = JSON.parse(value) as Partial<BlacklistPayload>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

/* -------------------------------------------------------------------------- */
/* 设备指纹区分度闸                                                            */
/* -------------------------------------------------------------------------- */

/**
 * 单枚指纹哈希背后允许挂着的**不同账号**上限;超过即不再指代一台物理设备。
 *
 * 取值理由(不是拍的):
 * - 真实设备共享(家庭共用、门店平板、机房/网吧机器)是**个位数**账号量级。取 3 会误伤家庭共用,
 *   取 100 会把"同型号 Android 门店机"这类同样不具区分度的形态放过去 ⇒ 落在两者之间。
 * - 已知退化形态超出此数若干个数量级:移动端采集器(apps/mobile-rn/src/lib/device-fingerprint.ts)
 *   只喂 Platform.OS 一个字段,摘要在 packages/types/src/device.ts 计算 ⇒ 输入集只剩
 *   { ios, android },整端只有 2 个可能指纹值,同一 OS 的全部真机必然同值。
 *   那枚指纹命中数千账号是"采集字段不足"的必然结果,不是"这些账号共用一台设备"的证据。
 * - 本闸只堵 api 侧这一格(不把退化指纹当"同一设备"外发);采集端属移动端持有者决策,本票未动。
 */
export const MAX_ACCOUNTS_PER_DISCRIMINATING_FINGERPRINT = 10

/**
 * 闸门触发后仍给管理员留可核对证据:最多外发这么多个账号 id,其余由 withheldUserCount 点名数量。
 * 静默变短比变短更糟,所以截断必须自带计数。
 */
export const NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE = 5

/** 触发时写进响应的成因说明,不让下一个读响应的人重新猜一遍。 */
export const NON_DISCRIMINATING_FINGERPRINT_NOTE =
  '该指纹关联的账号数已超过单台设备的合理上限，不具设备区分度，不得据此判定为同一设备，也不得用于拉黑或跨账号关联。已知成因：移动端采集器只上报 Platform.OS 一个字段，同一操作系统的全部真机会算出同一枚哈希（见 apps/mobile-rn/src/lib/device-fingerprint.ts 与 packages/types/src/device.ts）。'

export interface FingerprintAffiliation {
  /** false = 命中集合大到这枚指纹不可能指代单台设备,此时 userIds 只是样本。 */
  readonly discriminating: boolean
  /** 外发的账号 id:判定具区分度时是全集,否则是前 N 个样本。 */
  readonly userIds: string[]
  /** 库里确认的**不同**账号数(不是请求侧数组长度)。 */
  readonly matchedUserCount: number
  /** 因上限而未外发的个数;0 = 本次没有截断。 */
  readonly withheldUserCount: number
  /** 触发时的成因说明;具区分度时为 null。 */
  readonly note: string | null
}

/**
 * 判定一枚指纹的关联集合是否仍具区分度。
 * 入参必须是**库确认**的命中账号集合(user_devices 以 (userId, fingerprintHash) 唯一),
 * 不得由请求侧自算 —— 与 utils/batch-outcome.ts 同一条纪律。
 *
 * ⚠️ `discriminating: true` 只说明"这枚哈希的命中数落在单台设备的合理量级",**不等于**"这些账号
 * 共用一台设备":哈希全程由客户端自报(auth.ts:765-775 取 `x-device-fingerprint` 原样落库,无服务端计算),
 * 所以谁都能把别人的哈希抄进自己的登录请求,把自己的账号挂到别人的设备记录上。本闸挡的是"采集字段
 * 退化造成的必然同值",挡不住"有意伪造"—— 后者需要服务端可验证的设备绑定(挑战-应答或与服务端
 * 计算的信号),属产品决策,已登记于 PROJECT_PLAN。
 * **刻意不在写入侧加格式校验**:它既堵不住上述伪造(抄来的值形状合法),又会砸掉一条已规划的路 ——
 * `packages/types/src/device.ts` 的算法条写明现值 32 字符 FNV 摘要要迁向密码学摘要并配双写/宽限期,
 * 而这段写入包在只 warn 的 try/catch 里:今天钉死"32 位十六进制",明天双写期的新采集器会被静默
 * 判成垃圾而不再新增设备记录(风控盲区),而 `git status` 与 typecheck 都不会红。
 */
export function judgeFingerprintAffiliation(
  matchedUserIds: readonly string[],
): FingerprintAffiliation {
  const distinct = dedupeIds(matchedUserIds)
  const matchedUserCount = distinct.length
  if (matchedUserCount <= MAX_ACCOUNTS_PER_DISCRIMINATING_FINGERPRINT) {
    return {
      discriminating: true,
      userIds: distinct,
      matchedUserCount,
      withheldUserCount: 0,
      note: null,
    }
  }
  const userIds = distinct.slice(0, NON_DISCRIMINATING_USER_ID_SAMPLE_SIZE)
  return {
    discriminating: false,
    userIds,
    matchedUserCount,
    withheldUserCount: matchedUserCount - userIds.length,
    note: NON_DISCRIMINATING_FINGERPRINT_NOTE,
  }
}

export const adminAuthEduRoutes: FastifyPluginAsync = async (server) => {
  // admin 鉴权/教育路由响应含 idCard(已通过 card 重命名隐式绕过,此处改为显式旁路)
  // 防止 response-sanitizer 把 idCard 字段误伤为 '***'(若未来移除重命名)
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  server.addHook('preHandler', requireAdmin)

  // 1. /auth-find-info — userAuthInfo 表 CRUD
  // 映射: userUuid→id, realName→title, idCard→card, authSource→belong, rejectReason→message
  server.get('/auth-find-info', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userAuthInfo.realName, `%${search}%`), ilike(userAuthInfo.idCard, `%${search}%`))
      : undefined
    const rows = await db
      .select()
      .from(userAuthInfo)
      .where(where)
      .orderBy(desc(userAuthInfo.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userAuthInfo)
          .where(where)
      )[0]?.c ?? 0
    const list = rows.map((r) => ({
      id: r.userUuid,
      userUuid: r.userUuid,
      card: r.idCard,
      belong: r.authSource,
      title: r.realName,
      message: r.rejectReason,
      createdAt: r.createdAt,
    }))
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.get('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
        id: r.userUuid,
        userUuid: r.userUuid,
        card: r.idCard,
        belong: r.authSource,
        title: r.realName,
        message: r.rejectReason,
        createdAt: r.createdAt,
      }),
    )
  })

  server.post('/auth-find-info', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        userUuid: z.string().min(1).max(100),
        title: z.string().max(100).nullable().optional(),
        card: z.string().max(50).nullable().optional(),
        belong: z.string().max(100).nullable().optional(),
        message: z.string().max(500).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(userAuthInfo)
      .values({
        userUuid: body.data.userUuid,
        realName: body.data.title ?? null,
        idCard: body.data.card ?? null,
        authSource: body.data.belong ?? null,
        rejectReason: body.data.message ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(
      success({
        id: row.userUuid,
        userUuid: row.userUuid,
        card: row.idCard,
        belong: row.authSource,
        title: row.realName,
        message: row.rejectReason,
        createdAt: row.createdAt,
      }),
    )
  })

  server.put('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().max(100).nullable().optional(),
        card: z.string().max(50).nullable().optional(),
        belong: z.string().max(100).nullable().optional(),
        message: z.string().max(500).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(userAuthInfo)
      .set({
        ...(body.data.title !== undefined && { realName: body.data.title }),
        ...(body.data.card !== undefined && { idCard: body.data.card }),
        ...(body.data.belong !== undefined && { authSource: body.data.belong }),
        ...(body.data.message !== undefined && { rejectReason: body.data.message }),
        updatedAt: new Date(),
      })
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
        id: row.userUuid,
        userUuid: row.userUuid,
        card: row.idCard,
        belong: row.authSource,
        title: row.realName,
        message: row.rejectReason,
        createdAt: row.createdAt,
      }),
    )
  })

  server.delete('/auth-find-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .returning({ userUuid: userAuthInfo.userUuid })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 2. /auth-user-margin — userMargins 表 CRUD
  // 映射: userId→id/userUuid, tokenQuantity→tokenQuantity, frozenQuantity→tokenFree, updatedAt→createdTime
  const mapMargin = (r: typeof userMargins.$inferSelect) => ({
    id: r.userId,
    userUuid: r.userId,
    tokenQuantity: r.tokenQuantity,
    tokenFree: r.frozenQuantity,
    aument: 0,
    field1: 0,
    field2: 0,
    field3: 0,
    createdTime: r.updatedAt,
  })

  server.get('/auth-user-margin', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? sql`${userMargins.userId}::text ilike '%' || ${search} || '%'`
      : undefined
    const rows = await db
      .select()
      .from(userMargins)
      .where(where)
      .orderBy(desc(userMargins.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userMargins)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapMargin), total, page, pageSize }))
  })

  server.get('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMargin(r)))
  })

  server.post('/auth-user-margin', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,tokenQuantity 传 "abc" 会写入 NaN。
    const body = z
      .object({
        userUuid: z.string().min(1).max(100),
        tokenQuantity: z.coerce.number().int().min(0).default(0),
        tokenFree: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(userMargins)
      .values({
        userId: body.data.userUuid,
        tokenQuantity: body.data.tokenQuantity,
        frozenQuantity: body.data.tokenFree,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMargin(row)))
  })

  server.put('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        tokenQuantity: z.coerce.number().int().min(0).optional(),
        tokenFree: z.coerce.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(userMargins)
      .set({
        ...(body.data.tokenQuantity !== undefined && { tokenQuantity: body.data.tokenQuantity }),
        ...(body.data.tokenFree !== undefined && { frozenQuantity: body.data.tokenFree }),
        updatedAt: new Date(),
      })
      .where(eq(userMargins.userId, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMargin(row)))
  })

  server.delete('/auth-user-margin/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    // 先查 margin 是否有资金,有余额/冻结时禁止硬删,防资金丢失(P0 修复)
    const [margin] = await db
      .select({
        tokenQuantity: userMargins.tokenQuantity,
        frozenQuantity: userMargins.frozenQuantity,
      })
      .from(userMargins)
      .where(eq(userMargins.userId, p.data.id))
      .limit(1)

    if (!margin) {
      return reply.status(404).send(error(404, '用户余额记录不存在'))
    }

    // 有余额或冻结资金时禁止硬删,需先处理资金
    if ((margin.tokenQuantity ?? 0) > 0 || (margin.frozenQuantity ?? 0) > 0) {
      return reply
        .status(400)
        .send(
          error(
            400,
            `无法删除有资金的余额记录(token=${margin.tokenQuantity}, frozen=${margin.frozenQuantity}),请先处理资金`,
          ),
        )
    }

    const removed = await db
      .delete(userMargins)
      .where(eq(userMargins.userId, p.data.id))
      .returning({ userId: userMargins.userId })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 3. /auth-veri-codes — captchas 表（查询为主）
  // 表字段: id, captchaKey, code, expiresAt, createdAt
  server.get('/auth-veri-codes', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(captchas.captchaKey, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(captchas)
      .where(where)
      .orderBy(desc(captchas.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(captchas)
          .where(where)
      )[0]?.c ?? 0
    const list = rows.map((r) => ({
      id: r.id,
      userId: null,
      phone: null,
      code: r.code,
      type: null,
      platform: null,
      ip: null,
      expiresAt: r.expiresAt,
      used: false,
      usedAt: null,
      createdAt: r.createdAt,
    }))
    return reply.send(success({ list, total }))
  })

  server.get('/auth-veri-codes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(captchas).where(eq(captchas.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(
      success({
        id: r.id,
        userId: null,
        phone: null,
        code: r.code,
        type: null,
        platform: null,
        ip: null,
        expiresAt: r.expiresAt,
        used: false,
        usedAt: null,
        createdAt: r.createdAt,
      }),
    )
  })

  server.delete('/auth-veri-codes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(captchas)
      .where(eq(captchas.id, p.data.id))
      .returning({ id: captchas.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 4. /member/blacklist — systemConfigs 表（category='member-blacklist'）
  // key=identifier, value=JSON({user, type, reason, status, expiresAt, createdAt})
  server.get('/member/blacklist', async (request, reply) => {
    const q = blacklistQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { search, type } = q.data
    const baseCond = eq(systemConfigs.category, 'member-blacklist')
    const searchCond = search
      ? or(ilike(systemConfigs.key, `%${search}%`), ilike(systemConfigs.value, `%${search}%`))
      : undefined
    const where = searchCond ? and(baseCond, searchCond) : baseCond
    const rows = await db
      .select()
      .from(systemConfigs)
      .where(where)
      .orderBy(desc(systemConfigs.createdAt))
    let list = rows.map((r) => {
      const payload = safeParseBlacklist(r.value)
      return {
        id: r.id,
        user: payload.user,
        identifier: r.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }
    })
    if (type) list = list.filter((it) => it.type === type)

    // device 类型分支:从 user_devices 表按 fingerprintHash 查设备详情(最后登录时间/UA/IP/关联用户)
    // identifier 即设备指纹哈希;一个指纹可能被多个用户使用(换号登录),返回 userIds 列表。
    // 但"多个"与"整端全部用户"是两件事 —— 关联集合先过 judgeFingerprintAffiliation 的区分度闸,
    // 不具区分度时不得当"同一设备"外发(退化指纹会把同 OS 的账号连成一片,且与真关联同形)。
    if (type === 'device' && list.length > 0) {
      // digest-name-exempt: 复数名词指"已存指纹哈希的集合"(it.identifier 即 user_devices.fingerprintHash),散列在登记侧早已完成,本行只取列表
      const fingerprints = list.map((it) => it.identifier).filter((v): v is string => Boolean(v))
      const deviceMap = new Map<
        string,
        { lastSeenAt: Date | null; userAgent: string | null; ip: string | null; userIds: string[] }
      >()
      if (fingerprints.length > 0) {
        const devRows = await db
          .select({
            fingerprintHash: userDevices.fingerprintHash,
            lastSeenAt: userDevices.lastSeenAt,
            userAgent: userDevices.userAgent,
            ip: userDevices.ip,
            userId: userDevices.userId,
          })
          .from(userDevices)
          .where(inArray(userDevices.fingerprintHash, fingerprints))
        for (const dr of devRows) {
          const existing = deviceMap.get(dr.fingerprintHash)
          if (existing) {
            existing.userIds.push(dr.userId)
            if (dr.lastSeenAt && (!existing.lastSeenAt || dr.lastSeenAt > existing.lastSeenAt)) {
              existing.lastSeenAt = dr.lastSeenAt
              existing.userAgent = dr.userAgent
              existing.ip = dr.ip
            }
          } else {
            deviceMap.set(dr.fingerprintHash, {
              lastSeenAt: dr.lastSeenAt,
              userAgent: dr.userAgent,
              ip: dr.ip,
              userIds: [dr.userId],
            })
          }
        }
      }
      const enriched = list.map((it) => {
        const info = deviceMap.get(it.identifier)
        const affiliation = judgeFingerprintAffiliation(info?.userIds ?? [])
        return {
          ...it,
          lastSeenAt: info?.lastSeenAt ?? null,
          userAgent: info?.userAgent ?? null,
          ip: info?.ip ?? null,
          userIds: affiliation.userIds,
          discriminating: affiliation.discriminating,
          matchedUserCount: affiliation.matchedUserCount,
          withheldUserCount: affiliation.withheldUserCount,
          nonDiscriminationNote: affiliation.note,
        }
      })
      return reply.send(success({ list: enriched }))
    }

    return reply.send(success({ list }))
  })

  server.post('/member/blacklist', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防类型错误。
    const body = z
      .object({
        identifier: z.string().min(1).max(200),
        user: z.string().max(100).nullable().optional(),
        type: z.enum(['user', 'ip', 'device']).optional().default('user'),
        reason: z.string().max(500).nullable().optional(),
        expiresAt: z.string().max(50).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const payload: BlacklistPayload = {
      user: body.data.user ?? null,
      type: body.data.type,
      reason: body.data.reason ?? null,
      status: 'active',
      expiresAt: body.data.expiresAt ?? null,
      createdAt: new Date().toISOString(),
    }
    const [row] = await db
      .insert(systemConfigs)
      .values({
        key: body.data.identifier,
        value: JSON.stringify(payload),
        category: 'member-blacklist',
        type: 'json',
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(
      success({
        id: row.id,
        user: payload.user,
        identifier: row.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }),
    )
  })

  server.delete('/member/blacklist/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(systemConfigs)
      .where(eq(systemConfigs.id, p.data.id))
      .returning({ id: systemConfigs.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  server.post('/member/blacklist/:id/remove', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [existing] = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.id, p.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '记录不存在'))
    const payload = safeParseBlacklist(existing.value)
    payload.status = 'removed'
    const [row] = await db
      .update(systemConfigs)
      .set({ value: JSON.stringify(payload), updatedAt: new Date() })
      .where(eq(systemConfigs.id, p.data.id))
      .returning()
    if (!row) return reply.status(500).send(error(500, '更新失败'))
    return reply.send(
      success({
        id: row.id,
        user: payload.user,
        identifier: row.key,
        type: payload.type,
        reason: payload.reason,
        status: payload.status,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      }),
    )
  })

  // 5. /users/course-users — users 表查询（分配用户对话框，无 total）
  server.get('/users/course-users', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(users.username, `%${search}%`), ilike(users.nickname, `%${search}%`))
      : undefined
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        roleId: users.roleId,
      })
      .from(users)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const list = rows.map((r) => ({
      userId: r.id,
      userName: r.username,
      nickname: r.nickname,
      roles: r.roleId,
    }))
    return reply.send(success({ list }))
  })

  // 6. /edu/classes — lessons 表 CRUD
  // 映射: title→name, lecturerName→teacherName, signupCount→studentCount, status→status
  const mapClass = (r: typeof lessons.$inferSelect) => ({
    id: r.id,
    name: r.title,
    courseId: null,
    courseName: null,
    teacherName: r.lecturerName,
    studentCount: r.signupCount,
    startDate: null,
    endDate: null,
    status: r.status,
  })

  server.get('/edu/classes', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(lessons.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(lessons)
      .where(where)
      .orderBy(desc(lessons.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(lessons)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapClass), total, page, pageSize }))
  })

  server.get('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(lessons).where(eq(lessons.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapClass(r)))
  })

  server.post('/edu/classes', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        name: z.string().min(1).max(200),
        teacherName: z.string().max(100).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(lessons)
      .values({
        title: body.data.name,
        lecturerName: body.data.teacherName ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapClass(row)))
  })

  server.put('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        teacherName: z.string().max(100).nullable().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(lessons)
      .set({
        ...(body.data.name !== undefined && { title: body.data.name }),
        ...(body.data.teacherName !== undefined && { lecturerName: body.data.teacherName }),
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapClass(row)))
  })

  server.delete('/edu/classes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(lessons)
      .where(eq(lessons.id, p.data.id))
      .returning({ id: lessons.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 7. /edu/classes/schedules — lessonChapters 表 CRUD
  // 映射: lessonId→classId, title→title
  const mapSchedule = (r: typeof lessonChapters.$inferSelect) => ({
    id: r.id,
    classId: r.lessonId,
    className: null,
    title: r.title,
    teacherName: null,
    startTime: null,
    endTime: null,
    location: null,
    status: 1,
  })

  server.get('/edu/classes/schedules', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(lessonChapters.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(lessonChapters)
      .where(where)
      .orderBy(desc(lessonChapters.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(lessonChapters)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapSchedule), total, page, pageSize }))
  })

  server.get('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(lessonChapters)
      .where(eq(lessonChapters.id, p.data.id))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapSchedule(r)))
  })

  server.post('/edu/classes/schedules', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防 NaN/超长字段。
    const body = z
      .object({
        classId: z.string().min(1).max(100),
        title: z.string().min(1).max(200),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(lessonChapters)
      .values({
        lessonId: body.data.classId,
        title: body.data.title,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapSchedule(row)))
  })

  server.put('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(lessonChapters)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
      })
      .where(eq(lessonChapters.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapSchedule(row)))
  })

  server.delete('/edu/classes/schedules/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(lessonChapters)
      .where(eq(lessonChapters.id, p.data.id))
      .returning({ id: lessonChapters.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 8. /learn/materials — resources 表 CRUD
  // 映射: title→title, fileType→type, fileUrl→fileUrl, fileSize→fileSize, downloadCount→downloadCount
  const mapMaterial = (r: typeof resources.$inferSelect) => ({
    id: r.id,
    title: r.title,
    type: r.fileType,
    fileUrl: r.fileUrl,
    fileSize: r.fileSize,
    downloadCount: r.downloadCount,
    lessonTitle: null,
  })

  server.get('/learn/materials', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(resources.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(resources)
      .where(where)
      .orderBy(desc(resources.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(resources)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapMaterial), total, page, pageSize }))
  })

  server.get('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(resources).where(eq(resources.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMaterial(r)))
  })

  server.post('/learn/materials', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,fileSize 传 "abc" 会写入 NaN,补齐 Zod 校验。
    const body = z
      .object({
        title: z.string().min(1).max(200),
        type: z.string().max(50).nullable().optional(),
        fileUrl: z.string().max(2000).nullable().optional(),
        fileSize: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(resources)
      .values({
        title: body.data.title,
        fileType: body.data.type ?? null,
        fileUrl: body.data.fileUrl ?? null,
        fileSize: body.data.fileSize,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapMaterial(row)))
  })

  server.put('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        type: z.string().max(50).nullable().optional(),
        fileUrl: z.string().max(2000).nullable().optional(),
        fileSize: z.coerce.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(resources)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.type !== undefined && { fileType: body.data.type }),
        ...(body.data.fileUrl !== undefined && { fileUrl: body.data.fileUrl }),
        ...(body.data.fileSize !== undefined && { fileSize: body.data.fileSize }),
        updatedAt: new Date(),
      })
      .where(eq(resources.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapMaterial(row)))
  })

  server.delete('/learn/materials/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(resources)
      .where(eq(resources.id, p.data.id))
      .returning({ id: resources.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 9. /learn/plans — learnMaps 表 CRUD
  // 映射: title→title, isPublished→status(active/expired)
  const mapPlan = (r: typeof learnMaps.$inferSelect) => ({
    id: r.id,
    userId: null,
    userName: null,
    title: r.title,
    startDate: null,
    endDate: null,
    targetHours: 0,
    status: r.isPublished ? 'active' : 'expired',
  })

  server.get('/learn/plans', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(learnMaps.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(learnMaps)
      .where(where)
      .orderBy(desc(learnMaps.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(learnMaps)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapPlan), total, page, pageSize }))
  })

  server.get('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db.select().from(learnMaps).where(eq(learnMaps.id, p.data.id)).limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapPlan(r)))
  })

  server.post('/learn/plans', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,补齐 Zod 校验防超长字段。
    const body = z
      .object({
        title: z.string().min(1).max(200),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(learnMaps)
      .values({
        title: body.data.title,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapPlan(row)))
  })

  server.put('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        status: z.enum(['active', 'expired']).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(learnMaps)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.status !== undefined && {
          isPublished: body.data.status === 'active',
        }),
        updatedAt: new Date(),
      })
      .where(eq(learnMaps.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapPlan(row)))
  })

  server.delete('/learn/plans/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(learnMaps)
      .where(eq(learnMaps.id, p.data.id))
      .returning({ id: learnMaps.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 10. /learn/reminds — eduNotification 表 CRUD
  // 映射: memberId→userId, title→title, content→content, notifType→type, isRead→isRead, createdAt→remindAt
  const mapRemind = (r: typeof eduNotification.$inferSelect) => ({
    id: r.id,
    userId: r.memberId,
    userName: null,
    title: r.title,
    content: r.content,
    remindAt: r.createdAt,
    type: r.notifType,
    isRead: r.isRead,
  })

  server.get('/learn/reminds', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(eduNotification.title, `%${search}%`) : undefined
    const rows = await db
      .select()
      .from(eduNotification)
      .where(where)
      .orderBy(desc(eduNotification.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(eduNotification)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows.map(mapRemind), total, page, pageSize }))
  })

  server.get('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [r] = await db
      .select()
      .from(eduNotification)
      .where(eq(eduNotification.id, Number(p.data.id)))
      .limit(1)
    if (!r) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapRemind(r)))
  })

  server.post('/learn/reminds', async (request, reply) => {
    // 2026-08-01 P1 修复:原直接 as 类型断言,Number(b.userId ?? 0) 在 userId="abc" 时变 NaN,补齐 Zod 校验。
    const body = z
      .object({
        userId: z.coerce.number().int().min(0),
        title: z.string().min(1).max(200),
        content: z.string().max(5000).nullable().optional(),
        type: z.string().max(50).optional().default('system'),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(eduNotification)
      .values({
        memberId: body.data.userId,
        title: body.data.title,
        content: body.data.content ?? null,
        notifType: body.data.type,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(mapRemind(row)))
  })

  server.put('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        title: z.string().min(1).max(200).nullable().optional(),
        content: z.string().max(5000).nullable().optional(),
        type: z.string().max(50).optional(),
        isRead: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(eduNotification)
      .set({
        ...(body.data.title !== undefined && { title: body.data.title }),
        ...(body.data.content !== undefined && { content: body.data.content }),
        ...(body.data.type !== undefined && { notifType: body.data.type }),
        ...(body.data.isRead !== undefined && { isRead: body.data.isRead }),
        updatedAt: new Date(),
      })
      .where(eq(eduNotification.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapRemind(row)))
  })

  server.delete('/learn/reminds/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(eduNotification)
      .where(eq(eduNotification.id, Number(p.data.id)))
      .returning({ id: eduNotification.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 11. /auth-dept — tDepartment 表 CRUD
  server.get('/auth-dept', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(tDepartment.name, `%${search}%`) : undefined
    const [list, totalRow] = await Promise.all([
      db
        .select()
        .from(tDepartment)
        .where(where)
        .orderBy(desc(tDepartment.createTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(tDepartment)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0, page, pageSize }))
  })

  server.get('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(tDepartment)
      .where(eq(tDepartment.id, Number(p.data.id)))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.post('/auth-dept', async (request, reply) => {
    const body = z
      .object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(50),
        shortName: z.string().max(50).optional().default(''),
        enabled: z.boolean().optional().default(true),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(tDepartment).values(body.data).returning()
    return reply.status(201).send(success(row))
  })

  server.put('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        code: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(50).optional(),
        shortName: z.string().max(50).optional(),
        enabled: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .update(tDepartment)
      .set({ ...body.data, updateTime: new Date() })
      .where(eq(tDepartment.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.delete('/auth-dept/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(tDepartment)
      .where(eq(tDepartment.id, Number(p.data.id)))
      .returning({ id: tDepartment.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })
}
