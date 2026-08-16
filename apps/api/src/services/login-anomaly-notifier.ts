/**
 * 登录异常告警通知服务。
 *
 * 职责:
 * 1. notifyLoginAnomaly:异地登录 / 新设备登录 / 频繁失败登录时,按优先级发送通知
 *    - 站内信(notifications 表)→ 邮件(若用户开启)→ Webhook(若订阅 security 事件)
 *    - 6 小时内同类事件不重复通知(Redis 去重 key: anomaly:notified:{userId}:{eventHash})
 *    - 异步执行,失败 try-catch + logger.warn,不阻塞登录流程
 * 2. recordLoginAttempt:记录登录尝试到 Redis,失败 ≥5 次(5 分钟内)触发 notifyLoginAnomaly
 * 3. getRecentAnomalies:查最近 30 天异常记录(从 securityLogs 表)
 *
 * 降级:Redis 不可用时回退内存,通知能力降级但不抛错。
 *
 * Redis 客户端注入:模块级单例,通过 configureLoginAnomalyNotifier(redis) 注入
 * (类似 logger.setFastify 模式),在应用启动时调用。
 */

import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'
import { and, desc, eq, gte } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { notifications, securityLogs, type RelayWebhookEvent } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { sendEmail } from './email-service.js'
import { notifyRelayEvent } from './webhook-relay-notifier.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export type AnomalyEventType = 'remote_login' | 'new_device_login' | 'frequent_login_failure'

export interface LoginAnomalyInput {
  userId: string
  eventType: AnomalyEventType
  ip?: string
  userAgent?: string
  /** 登录地点描述(如 "北京" / "Shanghai, CN") */
  location?: string
  /** 设备指纹 */
  deviceFingerprint?: string
  /** 用户邮箱(用于邮件通知,若已知) */
  userEmail?: string
  /** 用户名/昵称(用于邮件称呼) */
  userName?: string
  /** 附加上下文 */
  metadata?: Record<string, unknown>
}

export interface LoginAttemptInput {
  userId: string
  ip: string
  success: boolean
  userAgent?: string
}

export interface AnomalyRecord {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

/** 频繁失败检测窗口(5 分钟) */
const ATTEMPT_WINDOW_SEC = 5 * 60
/** 频繁失败阈值 */
const ATTEMPT_FAILURE_THRESHOLD = 5
/** 去重 TTL(6 小时) */
const DEDUP_TTL_SEC = 6 * 60 * 60
/** 查询最近异常天数 */
const RECENT_ANOMALY_DAYS = 30
/** 站内信类型(写入 notifications.type) */
const NOTIFICATION_TYPE = 'system'

const K_ATTEMPT = (userId: string, ip: string) => `login:attempt:${userId}:${ip}`
const K_NOTIFIED = (userId: string, eventHash: string) => `anomaly:notified:${userId}:${eventHash}`

/* -------------------------------------------------------------------------- */
/* 内存降级存储(Redis 不可用时)                                                */
/* -------------------------------------------------------------------------- */

const memAttempts = new Map<string, { count: number; expiresAt: number }>()
const memNotified = new Map<string, number>()

/* -------------------------------------------------------------------------- */
/* Redis 客户端注入(模块级单例)                                                */
/* -------------------------------------------------------------------------- */

let redisClient: Redis | null = null

/**
 * 注入 Redis 客户端。应在应用启动时调用(如 fastify.ready 钩子)。
 * 传 null 表示禁用 Redis(降级内存模式)。
 */
export function configureLoginAnomalyNotifier(redis: Redis | null): void {
  redisClient = redis
}

/* -------------------------------------------------------------------------- */
/* 1. notifyLoginAnomaly — 触发异常通知                                         */
/* -------------------------------------------------------------------------- */

/**
 * 触发登录异常通知。
 *
 * 通知优先级:站内信 → 邮件(若开启)→ Webhook(若订阅 security 事件)。
 * 6 小时内同类事件不重复通知(Redis 去重 key: anomaly:notified:{userId}:{eventHash})。
 * 异步执行,失败 try-catch + logger.warn,不阻塞登录流程。
 */
export async function notifyLoginAnomaly(input: LoginAnomalyInput): Promise<void> {
  const { userId, eventType } = input

  // 1. 计算事件 hash(用于去重,包含 eventType + ip + deviceFingerprint)
  const eventHash = computeEventHash(input)

  // 2. 去重检查(6 小时内同类事件不重复通知)
  const alreadyNotified = await checkDedup(userId, eventHash)
  if (alreadyNotified) {
    logger.debug('login-anomaly: skipped (dedup)', { userId, eventType, eventHash })
    return
  }

  // 3. 标记已通知(设置 TTL)
  await markNotified(userId, eventHash)

  // 4. 构建通知文案
  const title = buildNotificationTitle(eventType)
  const content = buildNotificationContent(input)

  // 5. 并行发送通知(失败不抛错,各通道独立 try-catch)
  await Promise.allSettled([
    sendInAppNotification(userId, title, content, input),
    sendEmailNotification(input, title, content),
    sendWebhookNotification(input, title, content),
  ])
}

/* -------------------------------------------------------------------------- */
/* 2. recordLoginAttempt — 记录登录尝试(频繁失败检测)                           */
/* -------------------------------------------------------------------------- */

/**
 * 记录登录尝试到 Redis。失败 ≥5 次(5 分钟内)触发 notifyLoginAnomaly。
 *
 * key: login:attempt:{userId}:{ip},TTL 5 分钟,INCR。
 * 成功登录时重置计数。
 */
export async function recordLoginAttempt(input: LoginAttemptInput): Promise<void> {
  const { userId, ip, success } = input

  if (success) {
    // 登录成功 → 重置该 user+ip 的失败计数
    await resetAttemptCount(userId, ip)
    return
  }

  // 登录失败 → INCR 计数
  const count = await incrAttemptCount(userId, ip)

  // 达到阈值 → 异步触发异常通知(不阻塞)
  if (count >= ATTEMPT_FAILURE_THRESHOLD) {
    notifyLoginAnomaly({
      userId,
      eventType: 'frequent_login_failure',
      ip,
      userAgent: input.userAgent,
      metadata: { failureCount: count, windowSec: ATTEMPT_WINDOW_SEC },
    }).catch((e) => {
      logger.warn('login-anomaly: frequent_login_failure notify failed', {
        err: e,
        userId,
        ip,
      })
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 3. getRecentAnomalies — 查询最近异常记录                                     */
/* -------------------------------------------------------------------------- */

/**
 * 查询用户最近 30 天的异常记录(从 securityLogs 表)。
 * 用于前端"安全中心"页面展示。
 */
export async function getRecentAnomalies(userId: string): Promise<AnomalyRecord[]> {
  const since = new Date(Date.now() - RECENT_ANOMALY_DAYS * 24 * 60 * 60 * 1000)

  try {
    const rows = await dbRead
      .select({
        id: securityLogs.id,
        action: securityLogs.action,
        ip: securityLogs.ip,
        userAgent: securityLogs.userAgent,
        metadata: securityLogs.metadata,
        createdAt: securityLogs.createdAt,
      })
      .from(securityLogs)
      .where(and(eq(securityLogs.userId, userId), gte(securityLogs.createdAt, since)))
      .orderBy(desc(securityLogs.createdAt))
      .limit(200)

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      ip: r.ip,
      userAgent: r.userAgent,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt,
    }))
  } catch (e) {
    logger.warn('login-anomaly: getRecentAnomalies failed', { err: e, userId })
    return []
  }
}

/* -------------------------------------------------------------------------- */
/* 内部:去重                                                                    */
/* -------------------------------------------------------------------------- */

/** 计算事件 hash:eventType + ip + deviceFingerprint 的 SHA-256 前 16 字符。 */
function computeEventHash(input: LoginAnomalyInput): string {
  const raw = `${input.eventType}|${input.ip ?? ''}|${input.deviceFingerprint ?? ''}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

/** 检查是否已通知过(6 小时内)。 */
async function checkDedup(userId: string, eventHash: string): Promise<boolean> {
  const key = K_NOTIFIED(userId, eventHash)
  if (!redisClient) {
    const expiresAt = memNotified.get(key)
    if (!expiresAt) return false
    if (Date.now() > expiresAt) {
      memNotified.delete(key)
      return false
    }
    return true
  }
  try {
    const r = await redisClient.exists(key)
    return r === 1
  } catch (e) {
    logger.warn('login-anomaly: dedup check failed, allow', { err: e })
    return false
  }
}

/** 标记已通知(设置 TTL)。 */
async function markNotified(userId: string, eventHash: string): Promise<void> {
  const key = K_NOTIFIED(userId, eventHash)
  if (!redisClient) {
    memNotified.set(key, Date.now() + DEDUP_TTL_SEC * 1000)
    return
  }
  try {
    await redisClient.set(key, '1', 'EX', DEDUP_TTL_SEC)
  } catch (e) {
    memNotified.set(key, Date.now() + DEDUP_TTL_SEC * 1000)
    logger.warn('login-anomaly: markNotified failed, used mem', { err: e })
  }
}

/* -------------------------------------------------------------------------- */
/* 内部:登录尝试计数                                                            */
/* -------------------------------------------------------------------------- */

async function incrAttemptCount(userId: string, ip: string): Promise<number> {
  const key = K_ATTEMPT(userId, ip)
  if (!redisClient) {
    const cur = memAttempts.get(key) ?? { count: 0, expiresAt: 0 }
    if (cur.expiresAt < Date.now()) cur.count = 0
    cur.count += 1
    cur.expiresAt = Date.now() + ATTEMPT_WINDOW_SEC * 1000
    memAttempts.set(key, cur)
    return cur.count
  }
  try {
    const count = await redisClient.incr(key)
    if (count === 1) await redisClient.expire(key, ATTEMPT_WINDOW_SEC)
    return count
  } catch (e) {
    logger.warn('login-anomaly: incrAttemptCount failed, used mem', { err: e })
    const cur = memAttempts.get(key) ?? { count: 0, expiresAt: 0 }
    cur.count += 1
    cur.expiresAt = Date.now() + ATTEMPT_WINDOW_SEC * 1000
    memAttempts.set(key, cur)
    return cur.count
  }
}

async function resetAttemptCount(userId: string, ip: string): Promise<void> {
  const key = K_ATTEMPT(userId, ip)
  if (!redisClient) {
    memAttempts.delete(key)
    return
  }
  try {
    await redisClient.del(key)
  } catch (e) {
    logger.warn('login-anomaly: resetAttemptCount failed', { err: e })
  }
}

/* -------------------------------------------------------------------------- */
/* 内部:通知发送                                                                */
/* -------------------------------------------------------------------------- */

/** 站内信:写入 notifications 表。 */
async function sendInAppNotification(
  userId: string,
  title: string,
  content: string,
  input: LoginAnomalyInput,
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type: NOTIFICATION_TYPE,
      title,
      content,
      data: {
        eventType: input.eventType,
        ip: input.ip,
        location: input.location,
        deviceFingerprint: input.deviceFingerprint,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (e) {
    logger.warn('login-anomaly: in-app notification failed', { err: e, userId })
  }
}

/** 邮件:若用户提供邮箱,复用 sendEmail。 */
async function sendEmailNotification(
  input: LoginAnomalyInput,
  title: string,
  content: string,
): Promise<void> {
  if (!input.userEmail) return
  try {
    await sendEmail({
      to: input.userEmail,
      subject: title,
      html: `<div style="font-family:sans-serif;line-height:1.6"><h2>${escapeHtml(title)}</h2><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(content)}</pre><p style="color:#666;font-size:12px">若非本人操作,请立即修改密码并检查登录设备。</p></div>`,
      scene: 'notification',
      userId: input.userId,
    })
  } catch (e) {
    logger.warn('login-anomaly: email notification failed', {
      err: e,
      userId: input.userId,
    })
  }
}

/**
 * Webhook:若用户订阅了 security 事件,复用 notifyRelayEvent。
 *
 */
async function sendWebhookNotification(
  input: LoginAnomalyInput,
  title: string,
  content: string,
): Promise<void> {
  try {
    const securityEvent: RelayWebhookEvent = 'security.login_anomaly'
    await notifyRelayEvent({
      userId: input.userId,
      event: securityEvent,
      payload: {
        eventType: input.eventType,
        title,
        content,
        ip: input.ip,
        location: input.location,
        deviceFingerprint: input.deviceFingerprint,
        timestamp: new Date().toISOString(),
        metadata: input.metadata,
      },
    })
  } catch (e) {
    logger.warn('login-anomaly: webhook notification failed', {
      err: e,
      userId: input.userId,
    })
  }
}

/* -------------------------------------------------------------------------- */
/* 内部:文案构建                                                                */
/* -------------------------------------------------------------------------- */

function buildNotificationTitle(eventType: AnomalyEventType): string {
  switch (eventType) {
    case 'remote_login':
      return '异地登录提醒'
    case 'new_device_login':
      return '新设备登录提醒'
    case 'frequent_login_failure':
      return '登录失败次数过多'
  }
}

function buildNotificationContent(input: LoginAnomalyInput): string {
  const parts: string[] = []
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  switch (input.eventType) {
    case 'remote_login':
      parts.push(`检测到您的账号在 ${time} 发生异地登录。`)
      break
    case 'new_device_login':
      parts.push(`检测到您的账号在 ${time} 通过新设备登录。`)
      break
    case 'frequent_login_failure':
      parts.push(`您的账号在 ${time} 出现多次登录失败(5 分钟内 ≥5 次)。`)
      break
  }

  if (input.ip) parts.push(`登录 IP:${input.ip}`)
  if (input.location) parts.push(`登录地点:${input.location}`)
  if (input.deviceFingerprint) parts.push(`设备指纹:${input.deviceFingerprint}`)
  if (input.userAgent) parts.push(`浏览器:${input.userAgent}`)

  parts.push('若非本人操作,请立即修改密码并检查账号安全设置。')
  return parts.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      case '"':
        return '&quot;'
      default:
        return ch
    }
  })
}
