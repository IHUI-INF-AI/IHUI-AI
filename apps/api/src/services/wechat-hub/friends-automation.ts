// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 好友/进群申请自动化闸。
 *
 * 扫描是读路径：默认就可以枚举「新的朋友」与群聊邀请，不触客户端写动作。
 * 通过是写路径：策略开关 → 一小时频次 → 当前扫描结果里能找到 requestId → 桥执行，
 * 四道闸缺一不可；策略默认关闭，审计无论成败都落账号 metadata，保留最近 20 条。
 * 不建表、不引 Redis，思路与群写一致，但键独立成 friendAutomation，不复用群写字段。
 */

import type {
  WechatActionResult,
  WechatBridgeAction,
  WechatFriendAcceptView,
  WechatFriendAuditEntry,
  WechatFriendRequestView,
  WechatFriendScanView,
  WechatFriendsOverview,
  WechatFriendsPolicy,
} from '@ihui/types'
import { AppError } from '../../errors/AppError.js'
import { logger } from '../../utils/logger.js'
import { wechatHubManager } from './manager.js'
import { assertAccountForUser } from './guards.js'
import { patchAccountMetadata } from './account-store.js'
import { asNumber, asRecord, asString } from './views.js'

/** 审计保留条数：最近 20 条，够回溯谁什么时候通过了哪条申请。 */
export const FRIENDS_AUDIT_KEEP = 20
/** 频次滑动窗口：最近一小时内成功通过的次数。 */
export const FRIENDS_RATE_WINDOW_MS = 3_600_000
/** 每小时默认通过上限；策略没配或配错时回落这个值。 */
export const FRIENDS_DEFAULT_MAX_PER_HOUR = 3
/** 频次允许配置的上下限，超出一律夹到边界，避免后台填个 9999 把闸放开。 */
const FRIENDS_LIMIT_MIN = 1
const FRIENDS_LIMIT_MAX = 10

function clampLimit(raw: unknown, fallback: number): number {
  const n = asNumber(raw)
  if (n === null) return fallback
  return Math.min(Math.max(Math.trunc(n), FRIENDS_LIMIT_MIN), FRIENDS_LIMIT_MAX)
}

/** 从账号 metadata 读好友自动化策略；字段缺失或类型不对都回落缺省，默认关闭。 */
export function readFriendsPolicy(metadata: unknown): WechatFriendsPolicy {
  const root = asRecord(metadata)
  const raw = asRecord(root.friendAutomation)
  return {
    enabled: raw.enabled === true,
    maxAcceptsPerHour: clampLimit(raw.maxAcceptsPerHour, FRIENDS_DEFAULT_MAX_PER_HOUR),
  }
}

/** 从账号 metadata 读审计；脏值静默剔除，读不懂就当没记过。 */
export function readFriendsAudit(metadata: unknown): WechatFriendAuditEntry[] {
  const root = asRecord(metadata)
  const raw = asRecord(root.friendAutomation)
  if (!raw) return []
  const audit: WechatFriendAuditEntry[] = []
  if (Array.isArray(raw.audit)) {
    for (const item of raw.audit) {
      const entry = asRecord(item)
      const at = asNumber(entry.at)
      const requestId = asString(entry.requestId)
      if (at === null || !requestId) continue
      audit.push({
        at,
        requestId,
        nickname: asString(entry.nickname) ?? '',
        ok: entry.ok === true,
        status: asString(entry.status) ?? 'failed',
        errorCode: asString(entry.errorCode),
      })
    }
  }
  return audit.slice(-FRIENDS_AUDIT_KEEP)
}

/** 窗口内已成功通过的次数；失败尝试不占额度。 */
export function acceptedInWindow(audit: WechatFriendAuditEntry[], now: number): number {
  const cutoff = now - FRIENDS_RATE_WINDOW_MS
  return audit.filter((entry) => entry.ok && entry.at > cutoff).length
}

/**
 * 解析昵称来源：桥只允许报 `control` / `unavailable`，其它脏值按昵称推导。
 * 空昵称一律 `unavailable`——绝不允许把读不到人名的条目标成 control；
 * 非空昵称桥没报或报错值时回落 `control`（行内文本确实读到了）。
 */
function resolveNicknameSource(nickname: string, rawSource: unknown): 'control' | 'unavailable' {
  if (!nickname) return 'unavailable'
  return rawSource === 'control' || rawSource === 'unavailable' ? rawSource : 'control'
}

function normalizeRequest(raw: unknown): WechatFriendRequestView | null {
  const item = asRecord(raw)
  const requestId = asString(item.requestId)
  if (!requestId) return null
  const nickname = asString(item.nickname) ?? ''
  return {
    requestId,
    nickname,
    nicknameSource: resolveNicknameSource(nickname, item.nicknameSource),
    source: asString(item.source) ?? '',
    kind: item.kind === 'group-invite' ? 'group-invite' : 'friend',
    clickable: item.clickable === true,
    seenAt: asNumber(item.seenAt) ?? Date.now(),
  }
}

/** 桥动作异常兜底：适配器离线/超时/抛错都折成 failed 结果，不把异常抛给路由层。 */
function failedBridgeResult(e: unknown): WechatActionResult {
  const reason = e instanceof Error ? e.message : '桥动作失败'
  const errorCode = e instanceof AppError ? e.errorCode : 'BRIDGE_THREW'
  return { ok: false, status: 'failed', data: { errorCode }, reason }
}

async function callBridgeAction(
  userId: string,
  accountId: string,
  action: WechatBridgeAction,
  payload: Record<string, unknown>,
): Promise<WechatActionResult> {
  try {
    return await wechatHubManager.performAction(userId, accountId, action, payload)
  } catch (e) {
    return failedBridgeResult(e)
  }
}

function buildScanView(result: WechatActionResult, now: number): WechatFriendScanView {
  const data = asRecord(result.data)
  const bridgeStatus = asString(data.status)
  if (bridgeStatus === 'disabled') {
    return {
      ok: false,
      status: 'disabled',
      reason: asString(data.reason) ?? 'friends-automation-off',
      requests: [],
      scannedAt: now,
      rawCount: 0,
      entered: false,
      entryExcluded: 0,
    }
  }
  if (!result.ok) {
    const rawReason = result.reason ?? asString(data.reason)
    // 微信窗口收起时 Qt 不渲染界面树，读不到元素——这不是链路故障，给一句人看得懂的说明。
    const reason =
      rawReason && rawReason.includes('window-hidden')
        ? '微信窗口已收起（界面没在渲染），把微信放出来就会自动扫描'
        : rawReason
    return {
      ok: false,
      status: 'failed',
      reason: reason ?? '桥扫描失败',
      requests: [],
      scannedAt: now,
      rawCount: asNumber(data.rawCount) ?? 0,
      entered: false,
      entryExcluded: 0,
    }
  }
  const rawRequests = Array.isArray(data.requests) ? data.requests : []
  // 空昵称条目允许原样保留进视图：只由 nicknameSource 标明「未读到」，后端不过滤、不补占位文本。
  const requests = rawRequests
    .map(normalizeRequest)
    .filter((item): item is WechatFriendRequestView => item !== null)
  return {
    ok: true,
    status: 'ok',
    reason: asString(data.reason),
    requests,
    scannedAt: asNumber(data.scannedAt) ?? now,
    rawCount: asNumber(data.rawCount) ?? rawRequests.length,
    entered: data.entered === true,
    entryExcluded: asNumber(data.entryExcluded) ?? 0,
    stale: data.stale === true,
    staleReason: asString(data.staleReason),
    cacheAgeMs: asNumber(data.cacheAgeMs) ?? undefined,
  }
}

function buildAcceptView(result: WechatActionResult, requestId: string): WechatFriendAcceptView {
  const data = asRecord(result.data)
  const bridgeStatus = asString(data.status)
  if (bridgeStatus === 'disabled') {
    return {
      ok: false,
      status: 'disabled',
      requestId,
      reason: asString(data.reason) ?? 'friends-automation-off',
      errorCode: asString(data.errorCode) ?? 'WECHAT_FRIENDS_DISABLED',
    }
  }
  if (!result.ok) {
    return {
      ok: false,
      status: 'failed',
      requestId,
      reason: result.reason ?? asString(data.reason) ?? '通过申请失败',
      errorCode:
        asString(data.errorCode) ??
        (result.status === 'unsupported' ? 'UNSUPPORTED' : 'BRIDGE_FAILED'),
    }
  }
  return {
    ok: true,
    status: 'accepted',
    requestId,
    reason: asString(data.reason),
    errorCode: asString(data.errorCode),
  }
}

/** 追加一条审计并截到保留上限；落库失败只记日志，不反过来影响动作结果。 */
async function appendAudit(
  accountId: string,
  metadata: unknown,
  entry: WechatFriendAuditEntry,
): Promise<void> {
  try {
    const audit = [...readFriendsAudit(metadata), entry].slice(-FRIENDS_AUDIT_KEEP)
    const policy = readFriendsPolicy(metadata)
    await patchAccountMetadata(accountId, { friendAutomation: { ...policy, audit } })
  } catch (error) {
    logger.warn('[wechat-hub] 好友自动化审计落库失败', {
      accountId,
      requestId: entry.requestId,
      err: error instanceof Error ? error.message : String(error),
    })
  }
}

/** 扫描待处理申请；读路径，不受策略开关限制。桥不通/超时/非对象一律折 failed，不抛 500。 */
export async function scanFriendRequests(
  userId: string,
  accountId: string,
  options: { force?: boolean; wake?: boolean } = {},
): Promise<WechatFriendScanView> {
  await assertAccountForUser(userId, accountId)
  const now = Date.now()
  const result = await callBridgeAction(userId, accountId, 'friend.scan', {
    force: options.force === true,
    wake: options.wake === true,
  })
  return buildScanView(result, now)
}

/** 通过一条好友/进群申请；写路径，策略开关 → 频次 → 申请存在性 → 桥执行，四道闸依次过。 */
export async function acceptFriendRequest(
  userId: string,
  accountId: string,
  requestId: string,
): Promise<WechatFriendAcceptView> {
  const account = await assertAccountForUser(userId, accountId)
  const policy = readFriendsPolicy(account.metadata)
  const now = Date.now()
  const trimmedRequestId = requestId.trim()

  if (!policy.enabled) {
    await appendAudit(accountId, account.metadata, {
      at: now,
      requestId: trimmedRequestId,
      nickname: '',
      ok: false,
      status: 'disabled',
      errorCode: 'WECHAT_FRIENDS_DISABLED',
    })
    throw new AppError('好友自动化未开启，请先在策略面板打开', 403, 'WECHAT_FRIENDS_DISABLED')
  }

  const audit = readFriendsAudit(account.metadata)
  if (acceptedInWindow(audit, now) >= policy.maxAcceptsPerHour) {
    await appendAudit(accountId, account.metadata, {
      at: now,
      requestId: trimmedRequestId,
      nickname: '',
      ok: false,
      status: 'rate-limited',
      errorCode: 'RATE_LIMITED',
    })
    throw new AppError(
      `每小时最多通过 ${policy.maxAcceptsPerHour} 个申请，请稍后再试`,
      429,
      'RATE_LIMITED',
    )
  }

  // 先强制实时重扫确认申请还在列表里（不能用桥缓存，否则刚进来的申请会被误判 not-found），找不到就不盲发到桥。
  const scan = buildScanView(
    await callBridgeAction(userId, accountId, 'friend.scan', { force: true }),
    now,
  )
  const match = scan.requests.find((item) => item.requestId === trimmedRequestId)
  if (!match) {
    await appendAudit(accountId, account.metadata, {
      at: now,
      requestId: trimmedRequestId,
      nickname: '',
      ok: false,
      status: 'not-found',
      errorCode: 'REQUEST_NOT_FOUND',
    })
    throw new AppError('申请不存在或已不在待处理列表中', 404, 'REQUEST_NOT_FOUND')
  }

  const bridgeResult = await callBridgeAction(userId, accountId, 'friend.accept', {
    requestId: trimmedRequestId,
  })
  const view = buildAcceptView(bridgeResult, trimmedRequestId)
  await appendAudit(accountId, account.metadata, {
    at: now,
    requestId: trimmedRequestId,
    nickname: match.nickname,
    ok: view.ok,
    status: view.status,
    errorCode: view.errorCode,
  })
  return view
}

/** 读账号好友自动化策略；路由层先过归属校验再展示。 */
export async function readFriendsPolicyView(
  userId: string,
  accountId: string,
): Promise<WechatFriendsPolicy> {
  const account = await assertAccountForUser(userId, accountId)
  return readFriendsPolicy(account.metadata)
}

/** 合并写回策略；只覆盖 metadata.friendAutomation 的策略字段，审计原样保留。 */
export async function updateFriendsPolicy(
  userId: string,
  accountId: string,
  patch: Partial<WechatFriendsPolicy>,
): Promise<WechatFriendsPolicy> {
  const account = await assertAccountForUser(userId, accountId)
  const current = readFriendsPolicy(account.metadata)
  const next: WechatFriendsPolicy = {
    enabled: patch.enabled ?? current.enabled,
    maxAcceptsPerHour: clampLimit(patch.maxAcceptsPerHour, current.maxAcceptsPerHour),
  }
  await patchAccountMetadata(accountId, {
    friendAutomation: { ...next, audit: readFriendsAudit(account.metadata) },
  })
  return next
}

/** 聚合读：策略 + 最新扫描 + 最近审计，前端一次拉齐。force=true 时要求桥做一次实时采集。 */
export async function readFriendsOverview(
  userId: string,
  accountId: string,
  options: { force?: boolean; wake?: boolean } = {},
): Promise<WechatFriendsOverview> {
  const account = await assertAccountForUser(userId, accountId)
  const policy = readFriendsPolicy(account.metadata)
  const audit = readFriendsAudit(account.metadata)
  const scan = await scanFriendRequests(userId, accountId, {
    force: options.force === true,
    wake: options.wake === true,
  })
  return { policy, scan, audit }
}

