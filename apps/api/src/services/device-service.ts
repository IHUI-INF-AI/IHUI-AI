// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { DeviceTaskExecutionPayload, DeviceTaskProgress } from '@ihui/types'
import type { Device, DeviceTask } from '@ihui/database'
import {
  chatConversations,
  chatMessages,
  devicePairCodes,
  deviceTasks,
  devices,
} from '@ihui/database'
import { db } from '../db/index.js'
import { config } from '../config/index.js'
import { AppError } from '../errors/AppError.js'

/**
 * G1 跨设备互联闭环服务层(2026-10-30 立)。
 *
 * 设备令牌机制最终选型:**无状态 HMAC bearer token**(规格给出的"最轻方案")。
 * 形态 `deviceId.expEpochSec.hmacHex`,HMAC-SHA256 密钥 = config.DEVICE_TOKEN_SECRET
 * (为空回退 config.JWT_SECRET);不引入新表/新 JWT 插件链路。设备撤销的实时性由
 * 每次校验回查 devices 行的 revoked_at 保证(令牌本身不可吊销,但撤销即刻生效)。
 * TTL 7 天,heartbeat 会回发续期令牌,在线设备永不过期。
 */

/** 在线判定窗口:last_seen_at 距今 < 90s */
const DEVICE_ONLINE_WINDOW_MS = 90_000
/** 配对码 TTL:5 分钟 */
const PAIR_CODE_TTL_MS = 5 * 60_000
/** 配对码签发速率限制:每用户 10 次/小时 */
const PAIR_CODE_RATE_LIMIT = 10
const PAIR_CODE_RATE_WINDOW_MS = 60 * 60_000
/** queued 任务未认领超时:24h(claim 与列表查询时惰性判定为 expired,不建周期任务) */
const TASK_QUEUE_TTL_MS = 24 * 60 * 60_000
/** running 租约:5 分钟。设备每 30s 心跳续租;超时由 claim/list 惰性回收为 failed。
 *  单一真相源在 device-task-runtime(runtime 是租约的唯一读写方),本文件只引用不另定义。 */
import { TASK_LEASE_MS } from './device-task-runtime.js'
/** 设备 bearer token 有效期:7 天(heartbeat 续期) */
const DEVICE_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000

export type DeviceCapabilities = Record<string, unknown>

/** 特性开关:env DEVICE_DELEGATION_ENABLED,默认开;显式 'false'/'0' 关闭 */
export function isDeviceDelegationEnabled(): boolean {
  const v = (config as { DEVICE_DELEGATION_ENABLED?: string }).DEVICE_DELEGATION_ENABLED
  return v !== 'false' && v !== '0'
}

function deviceTokenSecret(): string {
  return config.DEVICE_TOKEN_SECRET || config.JWT_SECRET
}

function hmacHex(payload: string): string {
  return createHmac('sha256', deviceTokenSecret()).update(payload).digest('hex')
}

/** 配对码哈希:sha256(code|服务端密钥),明文码不落库;密钥在场挡住 6 位码的彩虹表穷举 */
export function hashPairCode(code: string): string {
  return createHash('sha256').update(`${code}|${deviceTokenSecret()}`).digest('hex')
}

/** 铸设备 bearer token */
function signDeviceToken(deviceId: string, ttlMs: number = DEVICE_TOKEN_TTL_MS): string {
  const exp = Math.floor((Date.now() + ttlMs) / 1000)
  const payload = `${deviceId}.${exp}`
  return `${payload}.${hmacHex(payload)}`
}

/**
 * 校验设备 bearer token:签名/时效/uuid 形态任一不过返回 null;
 * 通过后再回查 devices 行(不存在或已撤销同样 null ⇒ 撤销即刻生效)。
 */
export async function verifyDeviceToken(token: string): Promise<Device | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [deviceId, expStr, sig] = parts as [string, string, string]
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId)) return null
  if (!/^\d+$/.test(expStr)) return null
  if (!/^[0-9a-f]{64}$/i.test(sig)) return null
  const expected = hmacHex(`${deviceId}.${expStr}`)
  if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
  if (Number(expStr) * 1000 < Date.now()) return null
  const rows = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
  const device = rows[0]
  if (!device || device.revokedAt) return null
  return device
}

/**
 * 注册/幂等刷新设备:同 (user_id, name) 重复注册 = 更新 last_seen_at/os/capabilities
 * 并返回原行(撤销过的设备重新注册视为复活,revoked_at 清回 null)。
 */
export async function registerDevice(input: {
  userId: string
  name: string
  os?: string | null
  capabilities?: DeviceCapabilities | null
  fingerprint?: string | null
}): Promise<Device> {
  const now = new Date()
  const rows = await db
    .insert(devices)
    .values({
      userId: input.userId,
      name: input.name,
      os: input.os ?? null,
      capabilities: input.capabilities ?? null,
      fingerprint: input.fingerprint ?? null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [devices.userId, devices.name],
      set: {
        lastSeenAt: now,
        os: input.os ?? null,
        capabilities: input.capabilities ?? null,
        // 指纹只在首次注册绑定:重复注册带不同指纹不改写绑定值(改写等于把
        // "重放防偷渡"变成"重放后重绑"),必须先吊销再重新配对才能换绑。
        fingerprint: sql`coalesce(${devices.fingerprint}, excluded.fingerprint)`,
        revokedAt: null,
      },
    })
    .returning()
  return rows[0]!
}

/**
 * G5 桌面端自助接入:登录态直接签发设备令牌,不再要求手机抄 8 位配对码。
 *
 * 与 `exchangePairCode` 共用 `registerDevice` + `signDeviceToken`,所以设备行、
 * 令牌校验与配对路径完全同构;区别只是"凭据"从一次性配对码换成已认证的人 JWT。
 * 设备指纹仍由 CLI 在 adopt 时绑定,这里不代算(全仓唯一指纹实现不在 API)。
 */
export async function issueSelfDeviceToken(input: {
  userId: string
  name: string
  os?: string | null
}): Promise<{ deviceToken: string; device: Device }> {
  const device = await registerDevice({
    userId: input.userId,
    name: input.name,
    os: input.os,
  })
  return { deviceToken: signDeviceToken(device.id), device }
}

/** 当前用户设备列表(不含已撤销),附 online 判定 */
export async function listDevices(userId: string): Promise<Array<Device & { online: boolean }>> {
  const rows = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), isNull(devices.revokedAt)))
  const threshold = Date.now() - DEVICE_ONLINE_WINDOW_MS
  return rows.map((d) => ({ ...d, online: new Date(d.lastSeenAt).getTime() > threshold }))
}

/** 撤销设备(置 revoked_at);非本人设备/不存在/已撤销 → 空数组 */
export async function revokeDevice(userId: string, deviceId: string): Promise<Device | null> {
  const rows = await db
    .update(devices)
    .set({ revokedAt: new Date() })
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId), isNull(devices.revokedAt)))
    .returning()
  return rows[0] ?? null
}

/** 签发 8 位数字配对码(TTL 5 分钟、单次使用、每用户 10 次/小时)。
 *  2026-10-31 对齐 Qoder 0.5.1(peerDevicePairingCodePlaceholder:"8 位数字",E1 逐字):
 *  熵 10^6→10^8,TTL 内在线暴力枚举面收窄 100 倍。 */
const PAIR_CODE_DIGITS = 8
export async function issuePairCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
  const since = new Date(Date.now() - PAIR_CODE_RATE_WINDOW_MS)
  const recent = await db
    .select({ id: devicePairCodes.id })
    .from(devicePairCodes)
    .where(and(eq(devicePairCodes.userId, userId), gt(devicePairCodes.createdAt, since)))
  if (recent.length >= PAIR_CODE_RATE_LIMIT) {
    throw new AppError('配对码签发过于频繁,请稍后再试', 429, 'PAIR_CODE_RATE_LIMITED')
  }
  const code = String(randomInt(0, 100_000_000)).padStart(PAIR_CODE_DIGITS, '0')
  const rows = await db
    .insert(devicePairCodes)
    .values({
      userId,
      codeHash: hashPairCode(code),
      expiresAt: new Date(Date.now() + PAIR_CODE_TTL_MS),
    })
    .returning()
  return { code, expiresAt: rows[0]!.expiresAt }
}

/**
 * 配对码兑换设备令牌。码错 → 400;过期/已用 → 410。
 * 单次使用的原子性:UPDATE ... WHERE used_at IS NULL RETURNING,0 行即被并发抢走。
 * 兑换即注册设备行(同 user+name 幂等),返回短期设备 bearer token。
 */
export async function exchangePairCode(input: {
  code: string
  name?: string
  os?: string | null
  capabilities?: DeviceCapabilities | null
  /** G1b:客户端自生成并持久存的执行体指纹(可选;给了就绑定,旧客户端不传零行为变化) */
  fingerprint?: string | null
  /** G1b:客户端应用版本(可选;DEVICE_MIN_CLIENT_VERSION 非空时参与兼容校验) */
  clientVersion?: string | null
}): Promise<{ deviceToken: string; device: Device }> {
  assertDeviceVersionCompatible(input.clientVersion)
  const rows = await db
    .select()
    .from(devicePairCodes)
    .where(eq(devicePairCodes.codeHash, hashPairCode(input.code)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('配对码无效', 400, 'PAIR_CODE_INVALID')
  if (row.usedAt) throw new AppError('配对码已被使用', 410, 'PAIR_CODE_USED')
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new AppError('配对码已过期', 410, 'PAIR_CODE_EXPIRED')
  }
  const consumed = await db
    .update(devicePairCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(devicePairCodes.id, row.id), isNull(devicePairCodes.usedAt)))
    .returning({ id: devicePairCodes.id })
  if (consumed.length === 0) throw new AppError('配对码已被使用', 410, 'PAIR_CODE_USED')
  const device = await registerDevice({
    userId: row.userId,
    name: input.name ?? '已配对设备',
    os: input.os,
    capabilities: input.capabilities,
    fingerprint: input.fingerprint,
  })
  return { deviceToken: signDeviceToken(device.id), device }
}

/**
 * G1b 版本兼容闸(2026-10-31,对齐 Qoder 0.5.1 peerDeviceStateVersionIncompatible):
 * env `DEVICE_MIN_CLIENT_VERSION`(如 "0.3.0")非空时,兑换请求的 clientVersion
 * 必须不低于它;不兼容 409。env 缺省空 = 不启用(部署方逐级收紧,不改变默认行为)。
 * 轻量比较:按 `.` 分段数值比,缺段补 0,不引 semver 依赖( prerelelease 后缀截断取数值段)。
 */
function assertDeviceVersionCompatible(clientVersion: string | null | undefined): void {
  const min = (config as { DEVICE_MIN_CLIENT_VERSION?: string }).DEVICE_MIN_CLIENT_VERSION?.trim()
  if (!min) return
  if (!clientVersion || !clientVersion.trim()) {
    throw new AppError('客户端版本过旧,请升级后重试', 409, 'DEVICE_VERSION_INCOMPATIBLE')
  }
  const num = (v: string) => v.split('.').map((seg) => parseInt(seg, 10) || 0)
  const a = num(clientVersion.trim())
  const b = num(min)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) {
      if (av < bv) {
        throw new AppError('客户端版本过旧,请升级后重试', 409, 'DEVICE_VERSION_INCOMPATIBLE')
      }
      return
    }
  }
}

/**
 * G1b 指纹一致性闸(对齐 Qoder 0.5.1 peerDeviceStateFingerprintMismatch):
 * 设备行绑定了指纹 ⇒ 每个设备请求必须携带同一 `X-Device-Fingerprint` 头;
 * 未绑定的行(存量设备/未声明指纹的新客户端)跳过校验 —— 旧行为逐字节保持。
 * 时序侧信道:字符串比较走 timingSafeEqual(定长 sha256 hex)。
 */
export function assertDeviceFingerprint(
  device: Pick<Device, 'fingerprint'>,
  headerValue: unknown,
): void {
  const bound = device.fingerprint
  if (!bound) return
  const presented = typeof headerValue === 'string' ? headerValue.trim() : ''
  const a = createHash('sha256').update(presented).digest('hex')
  const b = createHash('sha256').update(bound).digest('hex')
  if (!timingSafeEqual(Buffer.from(a), Buffer.from(b))) {
    throw new AppError('设备指纹不匹配,请重新配对', 403, 'DEVICE_FINGERPRINT_MISMATCH')
  }
}

/** 心跳:刷新 last_seen_at,并回发续期后的设备令牌(在线设备令牌永不过期) */
export async function heartbeat(
  deviceId: string,
): Promise<{ lastSeenAt: Date; deviceToken: string }> {
  const rows = await db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, deviceId))
    .returning({ lastSeenAt: devices.lastSeenAt })
  if (!rows[0]) throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND')
  return { lastSeenAt: rows[0].lastSeenAt, deviceToken: signDeviceToken(deviceId) }
}

/** 惰性过期:把该设备 queued 超 24h 的任务置为 expired */
async function sweepExpiredQueued(deviceId: string): Promise<void> {
  const cutoff = new Date(Date.now() - TASK_QUEUE_TTL_MS)
  await db.execute(sql`
    UPDATE device_tasks
    SET status = 'expired', finished_at = now()
    WHERE target_device_id = ${deviceId}::uuid
      AND status = 'queued'
      AND created_at < ${cutoff}
  `)
}

/**
 * G2(2026-11-25)租约回收:该设备 running/claimed 且租约已过期的任务置 failed。
 * 与 queued 的 24h 过期分开:那条说的是"没人接",这条说的是"接了但执行端失联"
 * (断电/断网/进程被杀)。两者都惰性判定,不建周期任务 —— 回收点只有 claim 与列表读。
 */
async function sweepStaleRunning(deviceId: string): Promise<void> {
  await db.execute(sql`
    UPDATE device_tasks
    SET status = 'failed',
        finished_at = now(),
        progress = jsonb_build_object(
          'stage', 'failed',
          'percent', 0,
          'lastEvent', '执行端租约超时',
          'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ),
        error = coalesce(error, '设备租约超时:执行端心跳中断或进程退出')
    WHERE target_device_id = ${deviceId}::uuid
      AND status IN ('claimed', 'running')
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < now()
  `)
}

function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/** 原生 SQL 行(snake_case)→ 服务层统一吐 schema 推导的 camelCase 行 */
function mapTaskRow(r: Record<string, unknown>): DeviceTask {
  return {
    id: String(r['id']),
    sessionId: String(r['session_id']),
    targetDeviceId: String(r['target_device_id']),
    status: String(r['status']),
    claimedAt: (r['claimed_at'] as Date | null) ?? null,
    finishedAt: (r['finished_at'] as Date | null) ?? null,
    error: (r['error'] as string | null) ?? null,
    resultSummary: (r['result_summary'] as DeviceTask['resultSummary']) ?? null,
    payload: (r['payload'] as DeviceTask['payload']) ?? null,
    messageId: (r['message_id'] as string | null) ?? null,
    progress: (r['progress'] as DeviceTask['progress']) ?? null,
    leaseExpiresAt: (r['lease_expires_at'] as Date | null) ?? null,
    cancelRequestedAt: (r['cancel_requested_at'] as Date | null) ?? null,
    attempt: Number(r['attempt'] ?? 1),
    agentSessionId: (r['agent_session_id'] as string | null) ?? null,
    startedAt: (r['started_at'] as Date | null) ?? null,
    // G3:审批两列 —— 列表/详情据此判断"有没有计划可看、批没批",正文不随行下发
    approvalRequest: (r['approval_request'] as DeviceTask['approvalRequest']) ?? null,
    approvalDecision: (r['approval_decision'] as DeviceTask['approvalDecision']) ?? null,
    createdAt: r['created_at'] as Date,
    createdBy: String(r['created_by']),
  }
}

/**
 * 原子认领该设备最早 queued 任务。
 * 单条 `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING`:
 * 并发认领互不阻塞、恰一个成功(锁语义由 Postgres 保证,不在应用层重造)。
 */
export async function claimNextTask(deviceId: string): Promise<DeviceTask | null> {
  await sweepExpiredQueued(deviceId)
  await sweepStaleRunning(deviceId)
  const raw = await db.execute(sql`
    UPDATE device_tasks
    SET status = 'running',
        claimed_at = now(),
        started_at = now(),
        lease_expires_at = now() + interval '5 minutes',
        progress = jsonb_build_object(
          'stage', 'claimed',
          'percent', 0,
          'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ),
        error = NULL
    WHERE id = (
      SELECT id FROM device_tasks
      WHERE target_device_id = ${deviceId}::uuid AND status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `)
  const rows = toRows(raw)
  return rows[0] ? mapTaskRow(rows[0]) : null
}

/** 设备任务列表(待办 + 历史;查询前惰性判定过期) */
export async function listTasksForDevice(deviceId: string): Promise<DeviceTask[]> {
  await sweepExpiredQueued(deviceId)
  const rows = await db
    .select()
    .from(deviceTasks)
    .where(eq(deviceTasks.targetDeviceId, deviceId))
    .orderBy(deviceTasks.createdAt)
  return rows
}

/**
 * 会话委托到设备:建 queued 任务。
 * 设备不存在 → 404;非本人设备或已撤销 → 403;会话非本人 → 403/404;
 * 设备离线允许入队(待认领)。
 *
 * G2(2026-11-25):任务必须带可执行载荷。缺 prompt 时取会话最后一条 user 消息 ——
 * 这是"我在这个会话里刚说的那句话",不是整段历史;两者都没有则拒派(400),
 * 否则执行端拿到空指令只会空转,而用户在另一端看到"运行中"。
 */
export async function delegateTask(input: {
  userId: string
  sessionId: string
  targetDeviceId: string
  payload?: Partial<DeviceTaskExecutionPayload>
}): Promise<DeviceTask> {
  const deviceRows = await db
    .select()
    .from(devices)
    .where(eq(devices.id, input.targetDeviceId))
    .limit(1)
  const device = deviceRows[0]
  if (!device) throw new AppError('设备不存在', 404, 'DEVICE_NOT_FOUND')
  if (device.userId !== input.userId || device.revokedAt) {
    throw new AppError('目标设备不可用', 403, 'DEVICE_FORBIDDEN')
  }
  const convRows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, input.sessionId))
    .limit(1)
  const conv = convRows[0]
  if (!conv) throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND')
  if (conv.userId !== input.userId) throw new AppError('无权访问该会话', 403, 'SESSION_FORBIDDEN')

  const rawPrompt = typeof input.payload?.prompt === 'string' ? input.payload.prompt.trim() : ''
  let prompt = rawPrompt
  let contextMessageId = input.payload?.contextMessageId
  if (!prompt) {
    const lastUser = await db
      .select({ id: chatMessages.id, content: chatMessages.content })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, input.sessionId), eq(chatMessages.role, 'user')))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
    const row = lastUser[0]
    if (!row || !row.content.trim()) {
      throw new AppError('会话里没有可执行的指令,请先发一条消息再派单', 400, 'TASK_PROMPT_MISSING')
    }
    prompt = row.content.trim()
    contextMessageId = contextMessageId ?? row.id
  }

  const mode = input.payload?.mode === 'plan' ? 'plan' : 'execute'
  const payload: DeviceTaskExecutionPayload = {
    prompt,
    mode,
    // 默认不跳过审批:服务端不替设备端放宽危险动作面
    autoApprove: input.payload?.autoApprove === true,
  }
  if (input.payload?.workspace?.trim()) payload.workspace = input.payload.workspace.trim()
  if (input.payload?.model?.trim()) payload.model = input.payload.model.trim()
  if (contextMessageId) payload.contextMessageId = contextMessageId

  const rows = await db
    .insert(deviceTasks)
    .values({
      sessionId: input.sessionId,
      targetDeviceId: input.targetDeviceId,
      createdBy: input.userId,
      status: 'queued',
      payload,
    })
    .returning()
  return rows[0]!
}

/** 设备上报进度(running 态更新 result_summary / progress / agent_session_id) */
export async function updateTaskProgress(
  deviceId: string,
  taskId: string,
  summary?: DeviceCapabilities | null,
  progress?: DeviceTaskProgress | null,
  agentSessionId?: string | null,
): Promise<DeviceTask> {
  const rows = await db
    .update(deviceTasks)
    .set({
      ...(summary !== undefined && summary !== null ? { resultSummary: summary } : {}),
      ...(progress !== undefined && progress !== null ? { progress } : {}),
      ...(agentSessionId !== undefined && agentSessionId !== null ? { agentSessionId } : {}),
      // 任何进度上报都顺带续租:设备活着才有进度,租约与活动同源
      leaseExpiresAt: new Date(Date.now() + TASK_LEASE_MS),
    })
    .where(
      and(
        eq(deviceTasks.id, taskId),
        eq(deviceTasks.targetDeviceId, deviceId),
        eq(deviceTasks.status, 'running'),
      ),
    )
    .returning()
  if (!rows[0]) throw new AppError('任务不存在或不在执行中', 404, 'TASK_NOT_UPDATABLE')
  return rows[0]
}

/** 设备上报完成(终态)。清租约 + 写 100% 终态进度。 */
export async function completeTask(
  deviceId: string,
  taskId: string,
  summary?: DeviceCapabilities | null,
  progress?: DeviceTaskProgress | null,
): Promise<DeviceTask> {
  const finalProgress: DeviceTaskProgress = progress ?? {
    stage: 'completed',
    percent: 100,
    updatedAt: new Date().toISOString(),
  }
  const rows = await db
    .update(deviceTasks)
    .set({
      status: 'completed',
      finishedAt: new Date(),
      leaseExpiresAt: null,
      progress: { ...finalProgress, stage: 'completed', percent: 100 },
      ...(summary !== undefined && summary !== null ? { resultSummary: summary } : {}),
    })
    .where(
      and(
        eq(deviceTasks.id, taskId),
        eq(deviceTasks.targetDeviceId, deviceId),
        eq(deviceTasks.status, 'running'),
      ),
    )
    .returning()
  if (!rows[0]) throw new AppError('任务不存在或不在执行中', 404, 'TASK_NOT_UPDATABLE')
  return rows[0]
}

/** 设备上报失败(终态)。清租约 + 写 failed 阶段。 */
export async function failTask(
  deviceId: string,
  taskId: string,
  error?: string | null,
  summary?: DeviceCapabilities | null,
  progress?: DeviceTaskProgress | null,
): Promise<DeviceTask> {
  const finalProgress: DeviceTaskProgress = progress ?? {
    stage: 'failed',
    percent: 0,
    lastEvent: error ? String(error).slice(0, 200) : undefined,
    updatedAt: new Date().toISOString(),
  }
  const rows = await db
    .update(deviceTasks)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      leaseExpiresAt: null,
      error: error ?? null,
      progress: { ...finalProgress, stage: 'failed' },
      ...(summary !== undefined && summary !== null ? { resultSummary: summary } : {}),
    })
    .where(
      and(
        eq(deviceTasks.id, taskId),
        eq(deviceTasks.targetDeviceId, deviceId),
        eq(deviceTasks.status, 'running'),
      ),
    )
    .returning()
  if (!rows[0]) throw new AppError('任务不存在或不在执行中', 404, 'TASK_NOT_UPDATABLE')
  return rows[0]
}

/** 读设备行(路由归属判定用) */
export async function findDeviceById(deviceId: string): Promise<Device | null> {
  const rows = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
  return rows[0] ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
