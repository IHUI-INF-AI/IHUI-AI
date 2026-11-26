// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写动作闸：先预览 → 人工确认 → 60 秒内一次性令牌执行。
 *
 * 踢人/拉人/改名/公告/建群都是不可逆、易触发平台风控的写动作，所以执行路径上必须
 * 先签发预览单给人工核对，再凭签名令牌放行。令牌是无状态 HMAC 自校验（payload + 签名），
 * 不依赖进程内会话存储，blue-green 双实例轮询也能验过；进程内只留 jti 重放集合拦同实例重复提交。
 * 策略默认全关，不建表、不引 Redis，避免脚本误点把整群清空。
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type {
  WechatGroupActionInput,
  WechatGroupActionPlan,
  WechatGroupActionPlanTarget,
  WechatGroupWritePolicy,
} from '@ihui/types'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'
import { patchAccountMetadata } from './account-store.js'
import { findMemberNicknames } from './contacts.js'
import { asNumber, asRecord, asStringArray } from './views.js'

/** 单次动作默认最多动几个人；策略里没配或配错时回落这个值。 */
export const PEAK_DEFAULT_MAX_TARGETS = 5
/** 每小时默认最多执行几次写动作；策略里没配或配错时回落这个值。 */
export const PEAK_DEFAULT_MAX_ACTIONS_PER_HOUR = 3
/** 预览单与令牌的存活时间：人工看完确认窗口就这么长，过期必须重新预览。 */
export const PEAK_PLAN_TTL_MS = 60_000
/** 单次/频次允许配置的上下限，超出一律夹到边界，避免后台填个 9999 把闸放开。 */
const PEAK_LIMIT_MIN = 1
const PEAK_LIMIT_MAX = 10
/** 频次滑动窗口长度：按账号统计最近一小时内的成功执行次数。 */
const PEAK_RATE_WINDOW_MS = 3_600_000
/** 令牌 payload 结构版本；结构升级后旧版本令牌一律按不匹配拒绝。 */
const PEAK_TOKEN_VERSION = 1
/** 令牌总长度上限，防大包攻击；正常 payload 加签名后远小于这个值。 */
const PEAK_TOKEN_MAX_LENGTH = 2_048

type GroupWriteAction = WechatGroupActionInput['action']

interface PlanTokenPayload {
  v: number
  jti: string
  act: string
  action: GroupWriteAction
  cid: string | null
  mids: string
  td: string
  xd: string
  exp: number
}

/** 进程内重放集合：只记 jti 与过期时间，不存完整 payload；跨实例重放靠 TTL 兜底。 */
export type GroupWriteUsedSet = Map<string, number>
/** 频次表：accountId → 最近一小时成功执行时间戳。 */
export type GroupWriteRateWindowMap = Map<string, number[]>

const defaultUsedSet: GroupWriteUsedSet = new Map()
const defaultRateWindows: GroupWriteRateWindowMap = new Map()

/** 审计保留条数：只留最近 20 次，够回溯「谁什么时候动了哪个群」，又不会把 metadata 撑大。 */
export const GROUP_WRITE_AUDIT_KEEP = 20

/**
 * 一次群写动作的审计记录。
 *
 * 为什么存在：频次窗口原先只活在进程内，服务重启（或者 blue-green 换实例）后计数清零，
 * 「每小时 3 次」的闸就形同虚设。所以每次执行成功后把时间戳与这次动作的轮廓写回账号 metadata，
 * 重启后先读回来再判频次；顺带留下一条可回溯的操作痕迹。
 */
export interface GroupWriteAuditEntry {
  at: number
  action: GroupWriteAction
  conversationId: string | null
  chatTitle: string
  memberIds: string[]
  ok: boolean
  status: string | null
}

/** 账号 metadata 里的群写运行态：最近一小时的时间戳 + 最近若干次动作。 */
export interface GroupWriteRuntimeState {
  stamps: number[]
  audit: GroupWriteAuditEntry[]
}

const EMPTY_RUNTIME: GroupWriteRuntimeState = { stamps: [], audit: [] }

function finiteNumber(value: unknown): number | null {
  const n = asNumber(value)
  return n !== null && Number.isFinite(n) && n > 0 ? n : null
}

/** 从账号 metadata 读群写运行态；脏值一律剔除，读不懂就当没记过。 */
export function readGroupWriteRuntime(metadata: unknown, now = Date.now()): GroupWriteRuntimeState {
  const root = asRecord(metadata)
  const raw = asRecord(root.groupWriteRuntime)
  if (!raw) return { ...EMPTY_RUNTIME }
  const cutoff = now - PEAK_RATE_WINDOW_MS
  const stamps: number[] = []
  if (Array.isArray(raw.stamps)) {
    for (const item of raw.stamps) {
      const ts = finiteNumber(item)
      if (ts !== null && ts > cutoff) stamps.push(ts)
    }
  }
  const audit: GroupWriteAuditEntry[] = []
  if (Array.isArray(raw.audit)) {
    for (const item of raw.audit) {
      const entry = asRecord(item)
      if (!entry) continue
      const at = finiteNumber(entry.at)
      const action = asStringArray([entry.action])[0] as GroupWriteAction | undefined
      if (at === null || !action) continue
      audit.push({
        at,
        action,
        conversationId: asStringArray([entry.conversationId])[0] ?? null,
        chatTitle: asStringArray([entry.chatTitle])[0] ?? '',
        memberIds: asStringArray(entry.memberIds),
        ok: entry.ok === true,
        status: asStringArray([entry.status])[0] ?? null,
      })
    }
  }
  return { stamps: stamps.slice(-GROUP_WRITE_AUDIT_KEEP * 3), audit: audit.slice(-GROUP_WRITE_AUDIT_KEEP) }
}

/** 追加一条审计并截到保留上限；纯函数，便于单测直接断言裁剪与顺序。 */
export function appendGroupWriteAudit(
  audit: GroupWriteAuditEntry[],
  entry: GroupWriteAuditEntry,
): GroupWriteAuditEntry[] {
  return [...audit, entry].slice(-GROUP_WRITE_AUDIT_KEEP)
}

/**
 * 算下一次落库的运行态：只有桥真的执行成功才往频次窗口里加一次；
 * 审计不论成败都记，失败的那条带上 status，便于事后区分「被闸拦下」与「桥报错」。
 */
export function nextGroupWriteRuntime(
  runtime: GroupWriteRuntimeState,
  outcome: Omit<GroupWriteAuditEntry, 'at'>,
  now = Date.now(),
): GroupWriteRuntimeState {
  const cutoff = now - PEAK_RATE_WINDOW_MS
  const stamps = runtime.stamps.filter((stamp) => stamp > cutoff)
  if (outcome.ok) stamps.push(now)
  const audit = appendGroupWriteAudit(runtime.audit, { ...outcome, at: now })
  return { stamps, audit }
}

/** 把运行态写回账号 metadata；只覆盖 groupWriteRuntime 一个键。失败只记日志，不影响已有结果。 */
export async function persistGroupWriteRuntime(
  accountId: string,
  state: GroupWriteRuntimeState,
): Promise<void> {
  await patchAccountMetadata(accountId, { groupWriteRuntime: state })
}

let cachedSecret: Buffer | null = null

/**
 * 签名密钥：优先取专用 env，没有就从既有环境变量派生；派生路径不抛错，
 * 避免密钥缺位把服务启动拖垮。同一份部署环境内各实例派生结果一致。
 */
function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret
  const envSecret = process.env.WECHAT_GROUP_TOKEN_SECRET
  if (typeof envSecret === 'string' && envSecret.length > 0) {
    cachedSecret = Buffer.from(envSecret, 'utf8')
  } else {
    const seed = process.env.DATABASE_URL || process.env.JWT_SECRET || ''
    cachedSecret = createHash('sha256').update(`ihui-group-write:${seed}`).digest()
  }
  return cachedSecret
}

function clampLimit(raw: unknown, fallback: number): number {
  const n = asNumber(raw)
  if (n === null) return fallback
  return Math.min(Math.max(Math.trunc(n), PEAK_LIMIT_MIN), PEAK_LIMIT_MAX)
}

/** 从账号 metadata 读群写策略；任何字段缺失或类型不对都回落缺省，默认关闭。 */
export function readGroupWritePolicy(metadata: unknown): WechatGroupWritePolicy {
  const root = asRecord(metadata)
  const raw = asRecord(root.groupWrites)
  return {
    enabled: raw.enabled === true,
    maxTargetsPerAction: clampLimit(raw.maxTargetsPerAction, PEAK_DEFAULT_MAX_TARGETS),
    maxActionsPerHour: clampLimit(raw.maxActionsPerHour, PEAK_DEFAULT_MAX_ACTIONS_PER_HOUR),
  }
}

function digestOf(value: string | undefined): string {
  return createHash('sha256')
    .update((value ?? '').trim())
    .digest('hex')
}

function sortedIds(memberIds: string[] | undefined): string[] {
  return [...asStringArray(memberIds)].sort()
}

/** 目标集合摘要：排序后再哈希，成员提交顺序不同不影响匹配结果。 */
function memberDigest(memberIds: string[] | undefined): string {
  return createHash('sha256')
    .update(JSON.stringify(sortedIds(memberIds)))
    .digest('hex')
}

/** 顺手清掉已过期的 jti；已用条目留到过期再删，好让复用请求明确报「已被使用」。 */
function pruneUsedSet(used: GroupWriteUsedSet, now: number): void {
  for (const [jti, exp] of used) {
    if (exp <= now) used.delete(jti)
  }
}

function signBody(body: string): string {
  return createHmac('sha256', getSecret())
    .update(body)
    .digest('hex')
}

type TokenCheck = { ok: true; payload: PlanTokenPayload } | { ok: false; reason: 'expired' | 'mismatch' }

function verifySignedToken(token: string, now: number): TokenCheck {
  if (token.length === 0 || token.length > PEAK_TOKEN_MAX_LENGTH) {
    return { ok: false, reason: 'mismatch' }
  }
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: 'mismatch' }
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let payload: PlanTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PlanTokenPayload
  } catch {
    return { ok: false, reason: 'mismatch' }
  }
  let sigBuf: Buffer
  let expectedBuf: Buffer
  try {
    sigBuf = Buffer.from(sig, 'hex')
    expectedBuf = Buffer.from(signBody(body), 'hex')
  } catch {
    return { ok: false, reason: 'mismatch' }
  }
  // 长度不一致先拦下，再走 timingSafeEqual，避免短签名触发常量时间比较异常。
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'mismatch' }
  }
  const shapeOk =
    payload.v === PEAK_TOKEN_VERSION &&
    typeof payload.jti === 'string' &&
    payload.jti.length > 0 &&
    typeof payload.act === 'string' &&
    typeof payload.action === 'string' &&
    (typeof payload.cid === 'string' || payload.cid === null) &&
    typeof payload.mids === 'string' &&
    typeof payload.td === 'string' &&
    typeof payload.xd === 'string' &&
    typeof payload.exp === 'number' &&
    Number.isFinite(payload.exp)
  if (!shapeOk) return { ok: false, reason: 'mismatch' }
  if (payload.exp <= now) return { ok: false, reason: 'expired' }
  return { ok: true, payload }
}

function describeEffect(
  action: GroupWriteAction,
  chatTitle: string,
  title: string,
  targetCount: number,
): string {
  switch (action) {
    case 'create':
      return `将创建新群「${title || chatTitle}」，邀请 ${targetCount} 人入群，建群后群聊会出现在成员会话列表`
    case 'invite':
      return `将把 ${targetCount} 人邀请进群「${chatTitle}」，被邀请人需要在微信里自己点确认才能进群`
    case 'kick':
      return `将从群「${chatTitle}」移出 ${targetCount} 人，被移出的人会看到自己被移出，此操作不可撤回`
    case 'rename':
      return `将把群「${chatTitle}」改名为「${title}」，新群名全群成员可见`
    case 'announce':
      return `将向群「${chatTitle}」发布公告，公告内容会推送给全群成员`
  }
}

export interface IssueGroupPlanContext {
  accountId: string
  action: GroupWriteAction
  conversationId: string | null
  chatTitle: string
  memberIds?: string[]
  title?: string
  text?: string
  policy: WechatGroupWritePolicy
  now?: number
}

/** 生成预览单：只出影响面与签名令牌，不调桥、不写库。 */
export async function issueGroupPlan(ctx: IssueGroupPlanContext): Promise<WechatGroupActionPlan> {
  const now = ctx.now ?? Date.now()
  const memberIds = asStringArray(ctx.memberIds)
  const hasTargets = ctx.action === 'kick' || ctx.action === 'invite' || ctx.action === 'create'
  const names = hasTargets ? await findMemberNicknames(ctx.accountId, memberIds) : {}
  const targets: WechatGroupActionPlanTarget[] = hasTargets
    ? memberIds.map((memberId) => ({
        memberId,
        name: names[memberId] ?? null,
        reason: null,
      }))
    : []

  const title = ctx.title?.trim() ?? ''
  const chatTitle = ctx.chatTitle.trim() || title || '（未命名群）'
  const warnings: string[] = []
  // 开关关闭也要能先看影响面，但必须把「现在还执行不了」放在最前面提醒。
  if (!ctx.policy.enabled) {
    warnings.push('群写开关当前关闭，需先在群管理面板打开后才能执行')
  }
  warnings.push('该操作不可逆，执行后无法自动撤销，请确认目标无误后再操作')
  if (hasTargets && targets.length > ctx.policy.maxTargetsPerAction) {
    warnings.push(`超过单次上限，最多 ${ctx.policy.maxTargetsPerAction} 人`)
  }
  if (ctx.action === 'invite') warnings.push('被邀请人需要自己点确认才能进群')
  if (ctx.action === 'announce') warnings.push('公告会推送给全群成员')

  const expiresAt = now + PEAK_PLAN_TTL_MS
  const payload: PlanTokenPayload = {
    v: PEAK_TOKEN_VERSION,
    jti: randomBytes(16).toString('hex'),
    act: ctx.accountId,
    action: ctx.action,
    cid: ctx.conversationId,
    mids: memberDigest(ctx.memberIds),
    td: digestOf(ctx.title),
    xd: digestOf(ctx.text),
    exp: expiresAt,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const token = `${body}.${signBody(body)}`

  return {
    action: ctx.action,
    conversationId: ctx.conversationId ?? '',
    chatTitle,
    targets,
    effect: describeEffect(ctx.action, chatTitle, title, targets.length),
    warnings,
    confirmToken: token,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export interface GuardContext {
  accountId: string
  input: WechatGroupActionInput
  now?: number
  used?: GroupWriteUsedSet
  rateWindows?: GroupWriteRateWindowMap
}

function consumeToken(
  used: GroupWriteUsedSet,
  token: string,
  ctx: { accountId: string; input: WechatGroupActionInput },
  now: number,
): void {
  const check = verifySignedToken(token, now)
  if (!check.ok) {
    if (check.reason === 'expired') {
      throw new AppError(
        '确认令牌已过期，请重新预览后再执行',
        409,
        'WECHAT_GROUP_CONFIRM_EXPIRED',
      )
    }
    throw new AppError(
      '确认令牌签名不匹配或已损坏，请重新预览后再执行',
      409,
      'WECHAT_GROUP_CONFIRM_EXPIRED',
    )
  }
  const { payload } = check
  pruneUsedSet(used, now)
  if (used.has(payload.jti)) {
    throw new AppError(
      '确认令牌已被使用，不能重复执行，请重新预览',
      409,
      'WECHAT_GROUP_CONFIRM_EXPIRED',
    )
  }
  const input = ctx.input
  const mismatch =
    payload.act !== ctx.accountId ||
    payload.action !== input.action ||
    payload.cid !== (input.conversationId ?? null) ||
    payload.mids !== memberDigest(input.memberIds) ||
    payload.td !== digestOf(input.title) ||
    payload.xd !== digestOf(input.text)
  if (mismatch) {
    throw new AppError(
      '确认令牌与本次操作不匹配，请重新预览后再执行',
      409,
      'WECHAT_GROUP_CONFIRM_EXPIRED',
    )
  }
  // 一次性令牌：校验通过立刻记下 jti，同一张单子不能在本实例换着参数再跑第二次。
  used.set(payload.jti, payload.exp)
}

function assertWithinRateLimit(
  windows: GroupWriteRateWindowMap,
  accountId: string,
  maxPerHour: number,
  now: number,
): void {
  const cutoff = now - PEAK_RATE_WINDOW_MS
  const stamps = (windows.get(accountId) ?? []).filter((stamp) => stamp > cutoff)
  if (stamps.length >= maxPerHour) {
    throw new AppError(
      `每小时最多执行 ${maxPerHour} 次群写动作，请稍后再试`,
      429,
      'WECHAT_GROUP_RATE_LIMITED',
    )
  }
  windows.set(accountId, stamps)
}

/**
 * 写动作前置闸：策略开关 → 令牌存在 → 签名有效且匹配 → 单次目标数 → 一小时频次。
 * 顺序固定，前面的闸先抛，避免越权参数绕过后面的校验。
 */
export function assertGroupWriteAllowed(policy: WechatGroupWritePolicy, ctx: GuardContext): void {
  const now = ctx.now ?? Date.now()
  const used = ctx.used ?? defaultUsedSet
  const windows = ctx.rateWindows ?? defaultRateWindows

  if (!policy.enabled) {
    throw new AppError(
      '群写动作未开启，请先在群管理面板打开',
      409,
      'WECHAT_GROUP_WRITES_DISABLED',
    )
  }
  const token = ctx.input.confirmToken?.trim()
  if (!token) {
    throw new AppError('请先在预览单确认操作后再执行', 409, 'WECHAT_GROUP_CONFIRM_REQUIRED')
  }
  consumeToken(used, token, { accountId: ctx.accountId, input: ctx.input }, now)

  const targetCount = asStringArray(ctx.input.memberIds).length
  if (targetCount > policy.maxTargetsPerAction) {
    throw new AppError(
      `本次最多动 ${policy.maxTargetsPerAction} 人，当前 ${targetCount} 人`,
      400,
      'WECHAT_GROUP_TARGETS_EXCEEDED',
    )
  }
  assertWithinRateLimit(windows, ctx.accountId, policy.maxActionsPerHour, now)
}

/** 桥执行成功后才记一次频次；失败尝试不占窗口。 */
export function recordGroupWriteSuccess(
  accountId: string,
  now?: number,
  windows?: GroupWriteRateWindowMap,
): void {
  const ts = now ?? Date.now()
  const map = windows ?? defaultRateWindows
  const cutoff = ts - PEAK_RATE_WINDOW_MS
  const stamps = (map.get(accountId) ?? []).filter((stamp) => stamp > cutoff)
  stamps.push(ts)
  map.set(accountId, stamps)
}

/** 审计视图：路由与 MCP 两条入口共用一份拼装逻辑，避免两边字段漂移。 */
export interface GroupWriteAuditView {
  entries: Array<{
    at: string
    action: GroupWriteAction
    conversationId: string | null
    chatTitle: string
    memberIds: string[]
    ok: boolean
    status: string | null
  }>
  windowCount: number
  windowLimit: number
  remaining: number
}

export function buildGroupWriteAuditView(
  runtime: GroupWriteRuntimeState,
  policy: WechatGroupWritePolicy,
): GroupWriteAuditView {
  return {
    entries: runtime.audit.map((entry) => ({
      at: new Date(entry.at).toISOString(),
      action: entry.action,
      conversationId: entry.conversationId,
      chatTitle: entry.chatTitle,
      memberIds: entry.memberIds,
      ok: entry.ok,
      status: entry.status,
    })),
    windowCount: runtime.stamps.length,
    windowLimit: policy.maxActionsPerHour,
    remaining: Math.max(policy.maxActionsPerHour - runtime.stamps.length, 0),
  }
}

/** 读账号群写运行态；路由层先过账号归属校验再展示。 */
export async function getGroupWriteRuntimeView(
  userId: string,
  accountId: string,
): Promise<{ runtime: GroupWriteRuntimeState; policy: WechatGroupWritePolicy }> {
  const account = await assertAccountForUser(userId, accountId)
  return {
    runtime: readGroupWriteRuntime(account.metadata),
    policy: readGroupWritePolicy(account.metadata),
  }
}

/** 读账号当前群写策略；路由层先过账号归属校验再展示。 */
export async function getGroupWritePolicy(
  userId: string,
  accountId: string,
): Promise<WechatGroupWritePolicy> {
  const account = await assertAccountForUser(userId, accountId)
  return readGroupWritePolicy(account.metadata)
}

/** 合并写回策略；只覆盖 metadata.groupWrites 这一个键，其余元数据原样保留。 */
export async function saveGroupWritePolicy(
  userId: string,
  accountId: string,
  patch: Partial<WechatGroupWritePolicy>,
): Promise<WechatGroupWritePolicy> {
  const account = await assertAccountForUser(userId, accountId)
  const current = readGroupWritePolicy(account.metadata)
  const next: WechatGroupWritePolicy = {
    enabled: patch.enabled ?? current.enabled,
    maxTargetsPerAction: patch.maxTargetsPerAction ?? current.maxTargetsPerAction,
    maxActionsPerHour: patch.maxActionsPerHour ?? current.maxActionsPerHour,
  }
  await patchAccountMetadata(accountId, { groupWrites: next })
  return next
}
