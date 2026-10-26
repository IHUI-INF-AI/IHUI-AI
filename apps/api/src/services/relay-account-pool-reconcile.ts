// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池↔签到助手同步:对账收敛器(2026-10-23 立,设计 §8)。
 *
 * 挂在 sweep worker 每轮(现成 sweepAccountPool 之后,同分布式锁保护):号池全量
 * vs 签到侧系统 owner 全量,差集四象限 + 版本差判定,单轮上限截断,纯函数 plan
 * 可单测。收敛器是**幂等**的:重复跑/中断重跑/乱序到达终态一致(CAS 保证)。
 *
 * 四象限(设计 §8.3):
 * 1. 号池有、签到无            → push(端点 1 补推)
 * 2. 签到有、号池无            → pool_deleted(端点 2;号池删了,签到停用保历史)
 * 3. 双边在、号池版本更新       → push(版本落后即补推,自带 enabled 载荷)
 * 4. 双边在、签到有 pending 回写 → flush(端点 5 触发 ai-service 重试回写)
 * 另:双边在、enabled 不一致    → state(端点 2 校准)
 *
 * 失败不中断 sweep:push/state 失败按 id 落 extraMetadata.checkinSync.pending,
 * 由 retryPendingCheckinSyncs 下轮清偿;disable 失败仅 warn(号池行已不存在,
 * 无 meta 可落,下轮对账自然重试)。
 */
import { eq } from 'drizzle-orm'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { dbRead } from '../db/index.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import {
  buildPoolSyncAccount,
  checkinPlatformFor,
  clearCheckinSyncPending,
  extractCosy,
  markCheckinSyncPending,
  pemFromSecrets,
  pushPoolState,
  pushPoolSync,
  type CheckinPlatform,
  type PoolAccountState,
} from './relay-account-pool-checkin-sync.js'
import { decryptAccountCredentials } from './relay-account-pool-service.js'

// =============================================================================
// 双侧投影(plan 纯函数的输入;拉取逻辑与执行逻辑都在本文件)
// =============================================================================

/** 号池侧单账号对账投影(映射域内;凭证列不入选 —— 明文只在执行 push 时才解密) */
export interface PoolSideRow {
  id: string
  /** null = 运营池;非 null = 该平台用户的个人池(对账按 poolAccountId 天然隔离,不跨 owner 匹配) */
  ownerUserId: string | null
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  credVersion: number
}

/** 签到侧单账号对账投影(ai-service list_pool_accounts 的同构回显) */
export interface CheckinSideRow {
  accountId: number
  poolAccountId: string | null
  /** 签到账号的 owner(仅供审计;匹配一律走 poolAccountId) */
  ownerUserId: string | null
  platform: string
  identityKey: string
  enabled: boolean
  poolCredVersion: number | null
  /** device_map.pool_pending_cred 摘要(上次回写号池失败留的待重试标记) */
  poolPendingCred: { attempts: number; at: string | null } | null
}

type ReconcileAction =
  | { kind: 'push'; pool: PoolSideRow; reason: 'missing' | 'version_behind' }
  | {
      kind: 'disable'
      platform: string
      uid: string
      poolAccountId: string
      ownerUserId: string | null
    }
  | { kind: 'state'; pool: PoolSideRow; state: 'enabled' | 'disabled' }
  | { kind: 'flush'; accountId: number; poolAccountId: string }

/** 单轮对账上限(防打爆签到侧;余量下轮继续,收敛器幂等所以截断无副作用) */
export const RECONCILE_BATCH_LIMIT = 200

export interface ReconcilePlan {
  actions: ReconcileAction[]
  /** 签到侧系统 owner 但无 pool_account_id 的脏数据计数(不动,仅告警可见) */
  orphanNoPoolId: number
  /** 映射域外(codearts 等)被忽略的号池行数 */
  outOfScope: number
  /** 被单轮配额挤掉的动作数(>0 表示本轮未处理完,下轮继续) */
  truncated: number
  /**
   * 号池已停用且签到侧无此行的行数:跳过 missing 补链(2026-10-24 立)。
   * pool-sync 是 upsert —— 对被弃用的账号执行补推,等于把它的身份在签到侧自动
   * 实体化(幽灵票 349 次连败即此型的现场:凭证解得开、建得出来才叫失败循环)。
   * 重新启用后由 missing/version_behind 两判据自然接回;state 动作不受此分支
   * 影响(那是"已存在签到引用"的行,停用态本身必须同步过去)。
   */
  skippedDisabledMissing: number
}

/**
 * 对账计划(纯函数):双侧全量 → 动作列表。一个号池行最多产出一个动作,
 * 优先级 push > state > flush(push 载荷自带 enabled,无需再单独校准)。
 */
export function planReconciliation(
  poolSide: readonly PoolSideRow[],
  checkinSide: readonly CheckinSideRow[],
  limit: number = RECONCILE_BATCH_LIMIT,
): ReconcilePlan {
  const quota = Math.max(1, Math.ceil(limit / 4))
  const poolById = new Map<string, PoolSideRow>()
  for (const p of poolSide) poolById.set(p.id, p)
  const checkinByPoolAccountId = new Map<string, CheckinSideRow>()
  let orphanNoPoolId = 0
  for (const c of checkinSide) {
    if (typeof c.poolAccountId === 'string' && c.poolAccountId.trim()) {
      checkinByPoolAccountId.set(c.poolAccountId, c)
    } else {
      orphanNoPoolId++
    }
  }

  const actions: ReconcileAction[] = []
  let outOfScope = 0
  let truncated = 0
  let skippedDisabledMissing = 0
  const taken = { push: 0, disable: 0, state: 0, flush: 0 }
  const canTake = (kind: keyof typeof taken): boolean => taken[kind] < quota

  // ── 号池侧遍历:missing / version_behind → push;enabled 不一致 → state;
  //    pending 回写且无版本落后 → flush(版本落后时 push 优先,flush 下轮自然消失) ──
  for (const p of poolSide) {
    if (!checkinPlatformFor(p.providerCode)) {
      outOfScope++
      continue
    }
    const c = checkinByPoolAccountId.get(p.id)
    if (!c) {
      // 停用行不补 missing 链(见 ReconcilePlan.skippedDisabledMissing 注释):
      // 只挡"签到侧无引用"这一格;有引用的停用行继续走 state 校准,停用态照同步。
      if (!p.isEnabled) {
        skippedDisabledMissing++
        continue
      }
      if (canTake('push')) {
        actions.push({ kind: 'push', pool: p, reason: 'missing' })
        taken.push++
      } else truncated++
      continue
    }
    const checkinVersion = c.poolCredVersion ?? 0
    if (p.credVersion > checkinVersion) {
      if (canTake('push')) {
        actions.push({ kind: 'push', pool: p, reason: 'version_behind' })
        taken.push++
      } else truncated++
      continue
    }
    if (p.isEnabled !== c.enabled) {
      if (canTake('state')) {
        actions.push({ kind: 'state', pool: p, state: p.isEnabled ? 'enabled' : 'disabled' })
        taken.state++
      } else truncated++
      continue
    }
    if (c.poolPendingCred !== null) {
      if (canTake('flush')) {
        actions.push({ kind: 'flush', accountId: c.accountId, poolAccountId: p.id })
        taken.flush++
      } else truncated++
    }
  }

  // ── 签到侧遍历:有 pool_account_id 但号池无此行 → pool_deleted ──
  for (const c of checkinSide) {
    if (typeof c.poolAccountId !== 'string' || !c.poolAccountId.trim()) continue
    if (poolById.has(c.poolAccountId)) continue
    if (!canTake('disable')) {
      truncated++
      continue
    }
    actions.push({
      kind: 'disable',
      platform: c.platform,
      uid: c.identityKey,
      poolAccountId: c.poolAccountId,
      ownerUserId: c.ownerUserId,
    })
    taken.disable++
  }

  return { actions, orphanNoPoolId, outOfScope, truncated, skippedDisabledMissing }
}

// =============================================================================
// 签到侧全量拉取(GET /internal/checkin/pool-accounts)
// =============================================================================

export interface FetchPoolAccountsResult {
  ok: boolean
  accounts: CheckinSideRow[]
  error: string | null
}

/** 拉签到侧系统 owner 全量(对账判据字段;jwt 明文不出 ai-service) */
export async function fetchPoolAccounts(
  fetchImpl: typeof fetch = fetch,
): Promise<FetchPoolAccountsResult> {
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) {
    return { ok: false, accounts: [], error: 'AI_CALLBACK_SECRET 未配置,跳过对账(不阻塞 sweep)' }
  }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-accounts`,
      {
        method: 'GET',
        headers: { 'X-Internal-Secret': secret },
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!resp.ok) {
      const text = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, accounts: [], error: `pool-accounts HTTP ${resp.status}: ${text}` }
    }
    const body = (await resp.json()) as { accounts?: unknown }
    if (!Array.isArray(body.accounts)) {
      return { ok: false, accounts: [], error: 'pool-accounts 响应缺 accounts 数组' }
    }
    const accounts: CheckinSideRow[] = []
    for (const raw of body.accounts) {
      const r = raw as Record<string, unknown>
      const accountId = r.accountId
      if (typeof accountId !== 'number') continue
      const pending = r.poolPendingCred as Record<string, unknown> | null | undefined
      accounts.push({
        accountId,
        poolAccountId: typeof r.poolAccountId === 'string' ? r.poolAccountId : null,
        ownerUserId: typeof r.ownerUserId === 'string' ? r.ownerUserId : null,
        platform: typeof r.platform === 'string' ? r.platform : '',
        identityKey: typeof r.identityKey === 'string' ? r.identityKey : '',
        enabled: r.enabled === true,
        poolCredVersion: typeof r.poolCredVersion === 'number' ? r.poolCredVersion : null,
        poolPendingCred:
          pending && typeof pending === 'object'
            ? {
                attempts: typeof pending.attempts === 'number' ? pending.attempts : 0,
                at: typeof pending.at === 'string' ? pending.at : null,
              }
            : null,
      })
    }
    return { ok: true, accounts, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, accounts: [], error: `pool-accounts 网络错误: ${msg}` }
  }
}

// =============================================================================
// 执行(IO 编排;sweep 挂腿入口)
// =============================================================================

export interface ReconcileResult {
  ok: boolean
  /** 签到侧拉取失败(整体跳过,不动任何一侧) */
  error: string | null
  pushed: number
  pushFailed: number
  disabled: number
  disableFailed: number
  stateCalibrated: number
  stateFailed: number
  flushed: number
  flushFailed: number
  orphanNoPoolId: number
  outOfScope: number
  /** 截断余量(>0 表示本轮未处理完,下轮继续) */
  truncated: number
}

const EMPTY_RESULT: ReconcileResult = {
  ok: true,
  error: null,
  pushed: 0,
  pushFailed: 0,
  disabled: 0,
  disableFailed: 0,
  stateCalibrated: 0,
  stateFailed: 0,
  flushed: 0,
  flushFailed: 0,
  orphanNoPoolId: 0,
  outOfScope: 0,
  truncated: 0,
}

/** 拉号池映射域全量(凭证列不解密 —— 明文只在真正执行 push 时才出) */
async function loadPoolSide(): Promise<PoolSideRow[]> {
  const rows = await dbRead
    .select({
      id: aiRelayAccountPool.id,
      ownerUserId: aiRelayAccountPool.ownerUserId,
      providerCode: aiRelayAccountPool.providerCode,
      uid: aiRelayAccountPool.uid,
      name: aiRelayAccountPool.name,
      isEnabled: aiRelayAccountPool.isEnabled,
      credVersion: aiRelayAccountPool.credVersion,
    })
    .from(aiRelayAccountPool)
  return rows.map((r) => ({
    id: r.id,
    ownerUserId: r.ownerUserId,
    providerCode: r.providerCode,
    uid: r.uid ?? '',
    name: r.name ?? '',
    isEnabled: r.isEnabled,
    credVersion: r.credVersion,
  }))
}

/** 按 id 回查完整号池行(仅 push 执行路径调用;plan 与日志都不碰明文) */
async function loadFullRow(id: string): Promise<AiRelayAccountPool | null> {
  const rows = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.id, id))
    .limit(1)
  return rows[0] ?? null
}

/** 触发签到侧批量重试凭证回写(POST /internal/checkin/pool-cred-flush) */
async function postCredFlush(
  accountIds: number[],
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; flushed: number; failed: number; error: string | null }> {
  const base = { flushed: 0, failed: 0 }
  if (accountIds.length === 0) return { ok: true, ...base, error: null }
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) return { ok: false, ...base, error: 'AI_CALLBACK_SECRET 未配置,跳过凭证回写 flush' }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-cred-flush`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({ accountIds }),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!resp.ok) {
      const text = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, ...base, error: `pool-cred-flush HTTP ${resp.status}: ${text}` }
    }
    const body = (await resp.json()) as {
      results?: Array<{ status?: string }>
    }
    const results = Array.isArray(body.results) ? body.results : []
    let flushed = 0
    for (const r of results) if (r?.status === 'flushed') flushed++
    return { ok: true, flushed, failed: results.length - flushed, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, ...base, error: `pool-cred-flush 网络错误: ${msg}` }
  }
}

/**
 * 对账收敛器:sweep 每轮挂腿。绝不在号池主流程抛异常——
 * 任何失败都转化为计数/日志,由下轮或 retryPendingCheckinSyncs 继续。
 */
export async function reconcileCheckinSync(opts?: {
  fetchImpl?: typeof fetch
  limit?: number
}): Promise<ReconcileResult> {
  const fetchImpl = opts?.fetchImpl ?? fetch
  const limit = opts?.limit ?? RECONCILE_BATCH_LIMIT

  const side = await fetchPoolAccounts(fetchImpl)
  if (!side.ok) {
    logger.warn('[checkin-reconcile] 签到侧全量拉取失败,本轮跳过', { error: side.error })
    return { ...EMPTY_RESULT, ok: false, error: side.error }
  }
  const poolSide = await loadPoolSide()
  const plan = planReconciliation(poolSide, side.accounts, limit)
  const out: ReconcileResult = {
    ...EMPTY_RESULT,
    orphanNoPoolId: plan.orphanNoPoolId,
    outOfScope: plan.outOfScope,
    truncated: plan.truncated,
  }
  if (plan.orphanNoPoolId > 0) {
    logger.warn('[checkin-reconcile] 签到侧存在系统 owner 脏账号(无 pool_account_id),已忽略', {
      count: plan.orphanNoPoolId,
    })
  }
  if (plan.skippedDisabledMissing > 0) {
    logger.info('[checkin-reconcile] 号池停用行跳过 missing 补链(不补推、不回落 pending)', {
      count: plan.skippedDisabledMissing,
    })
  }
  if (plan.actions.length === 0) return out

  // ── push:按 platform 分组逐批推送(载荷需解密凭证) ──
  const pushActions = plan.actions.filter((a) => a.kind === 'push')
  if (pushActions.length > 0) {
    const byPlatform = new Map<CheckinPlatform, PoolSideRow[]>()
    for (const a of pushActions) {
      if (a.kind !== 'push') continue
      const platform = checkinPlatformFor(a.pool.providerCode)
      if (!platform) continue
      const list = byPlatform.get(platform) ?? []
      list.push(a.pool)
      byPlatform.set(platform, list)
    }
    for (const [platform, rows] of byPlatform) {
      // 逐行解密构造载荷;解密失败的行单独记 failed,不拖垮同批
      const payloads: Array<ReturnType<typeof buildPoolSyncAccount>> = []
      const failedIds: string[] = []
      for (const row of rows) {
        try {
          const full = await loadFullRow(row.id)
          if (!full) {
            failedIds.push(row.id)
            continue
          }
          const creds = decryptAccountCredentials(full)
          payloads.push(
            buildPoolSyncAccount({
              id: full.id,
              ownerUserId: full.ownerUserId,
              uid: full.uid ?? '',
              name: (full.name ?? '').slice(0, 128),
              token: creds.token,
              refreshToken: creds.refreshToken,
              credVersion: full.credVersion,
              enabled: full.isEnabled,
              proxyUrl: full.proxyUrl,
              deviceId: full.deviceId,
              machineId: full.machineId,
              cosy: extractCosy(full.extraMetadata),
              deviceKeyPem: pemFromSecrets(creds.secrets, 'deviceKeyPem'),
              devicePubPem: pemFromSecrets(creds.secrets, 'devicePubPem'),
              tokenExpiresAt: full.tokenExpiresAt,
            }),
          )
        } catch {
          failedIds.push(row.id)
        }
      }
      if (failedIds.length > 0) {
        out.pushFailed += failedIds.length
        await markCheckinSyncPending(failedIds, 'cred', null, '对账补推:凭证解密失败')
      }
      if (payloads.length === 0) continue
      const push = await pushPoolSync(platform, payloads, fetchImpl)
      out.pushed += push.pushed
      const failedFromPush = push.failedIds.length
      out.pushFailed += failedFromPush
      if (!push.ok) {
        // 整批失败(网络/HTTP):failedIds 为空时按本批全量落 pending
        const pendingIds =
          push.failedIds.length > 0 ? push.failedIds : payloads.map((p) => p.poolAccountId)
        await markCheckinSyncPending(pendingIds, 'cred', null, push.error ?? '对账补推失败')
      }
      // 成功的清 pending(push.ok 时 failedIds 为空;部分成功也按 id 精确清)
      const okIds = payloads
        .map((p) => p.poolAccountId)
        .filter((id) => !push.failedIds.includes(id))
      if (okIds.length > 0) await clearCheckinSyncPending(okIds)
    }
  }

  // ── disable:号池已删,签到侧停用保历史 ──
  for (const a of plan.actions) {
    if (a.kind !== 'disable') continue
    const r = await pushPoolState(
      a.platform as CheckinPlatform,
      { poolAccountId: a.poolAccountId, ownerUserId: a.ownerUserId, uid: a.uid },
      'pool_deleted',
      fetchImpl,
    )
    if (r.ok) out.disabled++
    else {
      out.disableFailed++
      logger.warn('[checkin-reconcile] pool_deleted 推送失败(下轮重试)', {
        platform: a.platform,
        uid: a.uid,
        error: r.error,
      })
    }
  }

  // ── state:enabled 校准 ──
  for (const a of plan.actions) {
    if (a.kind !== 'state') continue
    const platform = checkinPlatformFor(a.pool.providerCode)
    if (!platform) continue
    const r = await pushPoolState(
      platform,
      {
        poolAccountId: a.pool.id,
        ownerUserId: a.pool.ownerUserId,
        uid: a.pool.uid,
      },
      a.state as PoolAccountState,
      fetchImpl,
    )
    if (r.ok) out.stateCalibrated++
    else {
      out.stateFailed++
      await markCheckinSyncPending([a.pool.id], 'state', a.state, r.error ?? '对账校准失败')
    }
  }

  // ── flush:签到侧 pending 凭证回写(端点 5 批量触发) ──
  const flushActions = plan.actions.filter((a) => a.kind === 'flush')
  if (flushActions.length > 0) {
    const ids = flushActions.map((a) => (a.kind === 'flush' ? a.accountId : -1))
    const r = await postCredFlush(ids, fetchImpl)
    if (r.ok) {
      out.flushed += r.flushed
      out.flushFailed += r.failed
    } else {
      out.flushFailed += ids.length
      logger.warn('[checkin-reconcile] 凭证回写 flush 失败(下轮重试)', { error: r.error })
    }
  }

  logger.info('relay-account-pool checkin reconcile done', {
    pushed: out.pushed,
    pushFailed: out.pushFailed,
    disabled: out.disabled,
    disableFailed: out.disableFailed,
    stateCalibrated: out.stateCalibrated,
    stateFailed: out.stateFailed,
    flushed: out.flushed,
    flushFailed: out.flushFailed,
    orphanNoPoolId: out.orphanNoPoolId,
    outOfScope: out.outOfScope,
    truncated: out.truncated,
  })
  return out
}
