// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池↔签到助手同步:推送侧(2026-10-23 立)。
 *
 * 职责(号池 = 凭证权威源,签到侧 = 消费副本):
 * 1. 平台映射单一真相源(D5):providerCode → 签到 platform;codearts 等无签到引擎的
 *    平台映射为 null,整批跳过(不假装同步成功)。
 * 2. 凭证推送:importAccounts 导入/覆盖后,把凭证 + cred_version 版本号推给
 *    ai-service POST /internal/checkin/pool-sync(内网 X-Internal-Secret 鉴权)。
 * 3. 状态推送:toggle → enabled/disabled;delete → pool_deleted(停用保历史)。
 * 4. 断链待推:推送失败绝不阻塞号池主流程,落 extraMetadata.checkinSync.pending,
 *    由 retryPendingCheckinSyncs / 对账收敛器(O64 提交 5)重试清偿。
 *
 * 凭证版本 CAS:导入覆盖凭证时 cred_version 原子 +1(update 内 sql 自增 + returning),
 * 推送载荷携带新版本;签到侧 pool_cred_version 防降级 ⇒「旧推送永不覆盖新回写」。
 * ai-service 签到刷新回写(提交 4)同样走 CAS,双写漂移从此闭环。
 *
 * 设计:docs/engineering/account-pool-checkin-sync-design.md
 * 接收侧契约:apps/ai-service/app/routers/internal_checkin_pool.py —— 其平台白名单文字与
 * 本文件 PROVIDER_TO_CHECKIN 值域一致,新增签到平台需两侧同步。
 */
import { inArray, sql } from 'drizzle-orm'
import { aiRelayAccountPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { config } from '../config/index.js'
import { decryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import { isRelayProviderCode, type RelayProviderCode } from './relay-account-format.js'

// =============================================================================
// 平台映射(D5 单一真相源:号池侧只此一张表,Python 侧零映射逻辑)
// =============================================================================

/** 签到平台(与 ai-service internal_checkin_pool._POOL_PLATFORMS 白名单文字一致) */
export type CheckinPlatform = 'trae' | 'workbuddy' | 'qoder' | 'minimax'

const PROVIDER_TO_CHECKIN: Record<RelayProviderCode, CheckinPlatform | null> = {
  trae: 'trae',
  workbuddy: 'workbuddy',
  qoder: 'qoder',
  // codearts:华为云码道账号,无签到引擎 ⇒ 永不进签到池(映射即拦截)
  codearts: null,
}

/** providerCode → 签到平台;未知平台或无签到引擎 → null(调用方整批跳过) */
export function checkinPlatformFor(providerCode: string): CheckinPlatform | null {
  if (!isRelayProviderCode(providerCode)) return null
  return PROVIDER_TO_CHECKIN[providerCode]
}

// =============================================================================
// 推送载荷
// =============================================================================

/** 号池单账号 → 签到侧投影(字段对齐 ai-service PoolAccountIn;凭证仅内网传输) */
export interface PoolSyncAccount {
  poolAccountId: string
  /** 池归属:null = 运营池(签到侧落 system:relay-pool);非 null = 该平台用户的个人池 */
  ownerUserId: string | null
  uid: string
  name: string
  token: string
  refreshToken: string | null
  credVersion: number
  enabled: boolean
  proxyUrl: string | null
  deviceId: string | null
  machineId: string | null
  /** Qoder Cosy 设备头族(蛇形键,导入时随 extraMetadata.cosy 落库) */
  cosy: Record<string, string> | null
  /** token 到期时刻(ISO);null = 不过期/未知 */
  expiresAt: string | null
}

export interface PoolSyncAccountSource {
  id: string
  ownerUserId: string | null
  uid: string
  name: string
  token: string
  refreshToken: string | null
  credVersion: number
  enabled: boolean
  proxyUrl: string | null
  deviceId: string | null
  machineId: string | null
  cosy: Record<string, string> | null
  tokenExpiresAt: Date | null
}

/** 构造推送载荷(expiresAt 统一序列化为 ISO;无效日期按 null 处理,不抛) */
export function buildPoolSyncAccount(src: PoolSyncAccountSource): PoolSyncAccount {
  const exp =
    src.tokenExpiresAt && !Number.isNaN(src.tokenExpiresAt.getTime())
      ? src.tokenExpiresAt.toISOString()
      : null
  return {
    poolAccountId: src.id,
    ownerUserId: src.ownerUserId,
    uid: src.uid,
    name: src.name,
    token: src.token,
    refreshToken: src.refreshToken,
    credVersion: src.credVersion,
    enabled: src.enabled,
    proxyUrl: src.proxyUrl,
    deviceId: src.deviceId,
    machineId: src.machineId,
    cosy: src.cosy,
    expiresAt: exp,
  }
}

/** 从 extraMetadata 取 Qoder Cosy 头族(蛇形键 dict;形状不符/空 → null) */
export function extractCosy(extraMetadata: unknown): Record<string, string> | null {
  let meta = extraMetadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      return null
    }
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const cosy = (meta as Record<string, unknown>).cosy
  if (!cosy || typeof cosy !== 'object' || Array.isArray(cosy)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(cosy as Record<string, unknown>)) {
    if (typeof v === 'string' && v) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

// =============================================================================
// HTTP 推送(内网点对点;失败一律降级为返回值,不抛)
// =============================================================================

/** 单次推送超时(签到同步是旁路,绝不让号池主流程陪绑) */
const PUSH_TIMEOUT_MS = 15_000

export interface PoolSyncPushResult {
  ok: boolean
  pushed: number
  skipped: number
  failed: number
  /** 失败条目的 poolAccountId(调用方按 id 落 pending) */
  failedIds: string[]
  error: string | null
}

/** 推送账号凭证到签到侧(POST /internal/checkin/pool-sync);ok=false 时调用方落 pending */
export async function pushPoolSync(
  platform: CheckinPlatform,
  accounts: PoolSyncAccount[],
  fetchImpl: typeof fetch = fetch,
): Promise<PoolSyncPushResult> {
  const base = { pushed: 0, skipped: 0, failed: 0, failedIds: [] as string[] }
  if (accounts.length === 0) return { ok: true, ...base, error: null }
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) {
    return { ok: false, ...base, error: 'AI_CALLBACK_SECRET 未配置,跳过签到同步(不阻塞号池)' }
  }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({ platform, accounts }),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      },
    )
    if (!resp.ok) {
      const text = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, ...base, error: `pool-sync HTTP ${resp.status}: ${text}` }
    }
    const body = (await resp.json()) as {
      results?: Array<{ poolAccountId?: string; status?: string; reason?: string }>
    }
    const results = Array.isArray(body.results) ? body.results : []
    if (results.length !== accounts.length) {
      return {
        ok: false,
        ...base,
        error: `pool-sync 响应条数不符(期望 ${accounts.length},实收 ${results.length})`,
      }
    }
    let pushed = 0
    let skipped = 0
    const failedIds: string[] = []
    for (const r of results) {
      if (r?.status === 'synced') pushed++
      else if (r?.status === 'skipped') skipped++
      else if (r?.poolAccountId) failedIds.push(r.poolAccountId)
    }
    const failed = failedIds.length
    return {
      ok: failed === 0,
      pushed,
      skipped,
      failed,
      failedIds,
      error: failed > 0 ? `${failed} 条签到同步失败` : null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, ...base, error: `pool-sync 网络错误: ${msg}` }
  }
}

/** 号池账号在签到侧的三态(与 ai-service PoolStateItem.state 一致) */
export type PoolAccountState = 'enabled' | 'disabled' | 'pool_deleted'

/**
 * 跨服务寻址键:poolAccountId 是唯一跨 owner 稳定的标识。
 * 用户个人池里不同 owner 可能持有同一上游 uid,只按 (platform, uid) 会串号。
 */
export interface PoolAccountRef {
  poolAccountId: string
  ownerUserId: string | null
  uid: string
}

/** 推送单账号状态到签到侧(POST /internal/checkin/pool-state) */
export async function pushPoolState(
  platform: CheckinPlatform,
  target: PoolAccountRef,
  state: PoolAccountState,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; error: string | null }> {
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) return { ok: false, error: 'AI_CALLBACK_SECRET 未配置,跳过签到状态同步' }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-state`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({
          platform,
          items: [
            {
              poolAccountId: target.poolAccountId,
              ownerUserId: target.ownerUserId,
              uid: target.uid,
              state,
            },
          ],
        }),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      },
    )
    if (!resp.ok) {
      const text = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, error: `pool-state HTTP ${resp.status}: ${text}` }
    }
    const body = (await resp.json()) as {
      results?: Array<{ found?: boolean; accountId?: string | null; reason?: string }>
    }
    const first = body.results?.[0]
    if (!first || first.found !== true) {
      return { ok: false, error: `pool-state 未命中签到账号: ${first?.reason ?? '空响应'}` }
    }
    return { ok: true, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, error: `pool-state 网络错误: ${msg}` }
  }
}

// =============================================================================
// 断链待推(extraMetadata.checkinSync pending;jsonb 合并,其它键原样保留)
// =============================================================================

export type CheckinSyncPendingKind = 'cred' | 'state'

/** 待推行(重推器/对账器按 id 直接取,免回查) */
export interface CheckinSyncPendingRow {
  id: string
  providerCode: string
  ownerUserId: string | null
  uid: string
  name: string
  tokenEnc: string
  refreshTokenEnc: string | null
  proxyUrl: string | null
  deviceId: string | null
  machineId: string | null
  isEnabled: boolean
  credVersion: number
  tokenExpiresAt: Date | null
  extraMetadata: unknown
}

/** extraMetadata.checkinSync 解析(纯函数;坏形状一律按"无待推"处理) */
export interface CheckinSyncMeta {
  pending: boolean
  pendingKind: CheckinSyncPendingKind | null
  pendingAt: string | null
  attempts: number
  state: PoolAccountState | null
}

export function parseCheckinSyncMeta(extraMetadata: unknown): CheckinSyncMeta {
  const none: CheckinSyncMeta = {
    pending: false,
    pendingKind: null,
    pendingAt: null,
    attempts: 0,
    state: null,
  }
  let meta = extraMetadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      return none
    }
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return none
  const cs = (meta as Record<string, unknown>).checkinSync
  if (!cs || typeof cs !== 'object' || Array.isArray(cs)) return none
  const c = cs as Record<string, unknown>
  const kind =
    c.pendingKind === 'cred' || c.pendingKind === 'state'
      ? (c.pendingKind as CheckinSyncPendingKind)
      : null
  const state =
    c.state === 'enabled' || c.state === 'disabled' || c.state === 'pool_deleted'
      ? (c.state as PoolAccountState)
      : null
  const attempts =
    typeof c.attempts === 'number' && Number.isFinite(c.attempts) && c.attempts >= 0
      ? Math.floor(c.attempts)
      : 0
  return {
    pending: c.pending === true,
    pendingKind: kind,
    pendingAt: typeof c.pendingAt === 'string' ? c.pendingAt : null,
    attempts,
    state,
  }
}

/** 落 pending(attempts 在 SQL 内原子 +1;state=null 时显式写 JSON null 清旧值) */
export async function markCheckinSyncPending(
  ids: string[],
  kind: CheckinSyncPendingKind,
  state: PoolAccountState | null,
  error: string,
): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(aiRelayAccountPool)
    .set({
      extraMetadata: sql`coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) || jsonb_build_object(
        'checkinSync', jsonb_build_object(
          'pending', true,
          'pendingKind', ${kind}::text,
          'pendingAt', ${new Date().toISOString()}::text,
          'lastError', ${error.slice(0, 200)}::text,
          'attempts', coalesce((${aiRelayAccountPool.extraMetadata}->'checkinSync'->>'attempts')::int, 0) + 1,
          'state', ${state}::text
        )
      )`,
      updatedAt: new Date(),
    })
    .where(inArray(aiRelayAccountPool.id, ids))
}

/** 清 pending(同步成功;保留 lastSyncedAt 供 UI 展示,attempts 归零) */
export async function clearCheckinSyncPending(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(aiRelayAccountPool)
    .set({
      extraMetadata: sql`coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) || jsonb_build_object(
        'checkinSync', jsonb_build_object(
          'pending', false,
          'pendingKind', null,
          'pendingAt', null,
          'lastError', null,
          'attempts', 0,
          'state', null,
          'lastSyncedAt', ${new Date().toISOString()}::text
        )
      )`,
      updatedAt: new Date(),
    })
    .where(inArray(aiRelayAccountPool.id, ids))
}

/** 列待推行(老的先;pendingAt 为空排最后) */
export async function listCheckinSyncPending(limit: number): Promise<CheckinSyncPendingRow[]> {
  return dbRead
    .select({
      id: aiRelayAccountPool.id,
      providerCode: aiRelayAccountPool.providerCode,
      ownerUserId: aiRelayAccountPool.ownerUserId,
      uid: aiRelayAccountPool.uid,
      name: aiRelayAccountPool.name,
      tokenEnc: aiRelayAccountPool.tokenEnc,
      refreshTokenEnc: aiRelayAccountPool.refreshTokenEnc,
      proxyUrl: aiRelayAccountPool.proxyUrl,
      deviceId: aiRelayAccountPool.deviceId,
      machineId: aiRelayAccountPool.machineId,
      isEnabled: aiRelayAccountPool.isEnabled,
      credVersion: aiRelayAccountPool.credVersion,
      tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
      extraMetadata: aiRelayAccountPool.extraMetadata,
    })
    .from(aiRelayAccountPool)
    .where(sql`${aiRelayAccountPool.extraMetadata}->'checkinSync'->>'pending' = 'true'`)
    .orderBy(sql`(${aiRelayAccountPool.extraMetadata}->'checkinSync'->>'pendingAt') asc nulls last`)
    .limit(limit)
}

export interface RetryPendingResult {
  retried: number
  cleared: number
  stillPending: number
  /** 平台无签到引擎(codearts 等):pending 无意义,直接清并计数 */
  droppedNoEngine: number
}

/**
 * 重推待推行(提交 4 对账收敛器之外的即时补偿;sweep worker 挂腿调用)。
 * cred 类解密重建载荷;state 类按 meta.state 原样重推;无签到引擎直接清。
 */
export async function retryPendingCheckinSyncs(
  limit = 100,
  fetchImpl: typeof fetch = fetch,
): Promise<RetryPendingResult> {
  const rows = await listCheckinSyncPending(limit)
  const out: RetryPendingResult = { retried: 0, cleared: 0, stillPending: 0, droppedNoEngine: 0 }
  for (const row of rows) {
    const platform = checkinPlatformFor(row.providerCode)
    if (!platform) {
      await clearCheckinSyncPending([row.id])
      out.droppedNoEngine++
      continue
    }
    const meta = parseCheckinSyncMeta(row.extraMetadata)
    // 号池已停用行的 cred 类 pending:凭证不再补推,也不占重推位(2026-10-24 立,幽灵票
    // 349 次连败的收口腿)—— 重新启用时由 reconcile 的 missing/version_behind 判据接回。
    // state 类绝不随停用清腿:它是"把停用/删除态同步给签到侧"这一动作本身的载体,
    // 清了就永远同步不上(reconcile 侧同一分支只挡"签到无引用"的格,两腿语义不串)。
    if (!row.isEnabled && meta.pendingKind !== 'state') {
      await clearCheckinSyncPending([row.id])
      out.cleared++
      continue
    }
    out.retried++
    if (meta.pendingKind === 'state') {
      const state = meta.state ?? 'enabled'
      const r = await pushPoolState(
        platform,
        { poolAccountId: row.id, ownerUserId: row.ownerUserId, uid: row.uid },
        state,
        fetchImpl,
      )
      if (r.ok) {
        await clearCheckinSyncPending([row.id])
        out.cleared++
      } else {
        await markCheckinSyncPending([row.id], 'state', state, r.error ?? '未知错误')
        out.stillPending++
      }
      continue
    }
    // cred 类:解密重建载荷(号池 = 凭证权威,永远以号池现值重推)
    try {
      const acc = buildPoolSyncAccount({
        id: row.id,
        ownerUserId: row.ownerUserId,
        uid: row.uid,
        name: row.name,
        token: decryptField(row.tokenEnc),
        refreshToken: row.refreshTokenEnc ? decryptField(row.refreshTokenEnc) : null,
        credVersion: row.credVersion,
        enabled: row.isEnabled,
        proxyUrl: row.proxyUrl,
        deviceId: row.deviceId,
        machineId: row.machineId,
        cosy: extractCosy(row.extraMetadata),
        tokenExpiresAt: row.tokenExpiresAt,
      })
      const r = await pushPoolSync(platform, [acc], fetchImpl)
      if (r.ok && r.failed === 0 && r.pushed === 1) {
        await clearCheckinSyncPending([row.id])
        out.cleared++
      } else {
        await markCheckinSyncPending([row.id], 'cred', null, r.error ?? '未知错误')
        out.stillPending++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
      logger.warn('[checkin-sync] 待推行解密失败,继续重标记', { accountId: row.id, err: msg })
      await markCheckinSyncPending([row.id], 'cred', null, `解密失败: ${msg}`)
      out.stillPending++
    }
  }
  return out
}

// =============================================================================
// admin 点查与手动触发(号池页「签到」列数据源与行操作,设计 §11)
// =============================================================================

/** 单账号签到状态点查结果(ai-service pool-status 透传) */
export interface PoolStatusView {
  ok: boolean
  found: boolean
  accountId: number | null
  name: string | null
  enabled: boolean | null
  poolAccountId: string | null
  poolCredVersion: number | null
  poolSyncedAt: string | null
  poolDeletedAt: string | null
  pendingCred: boolean
  cooldownUntil: string | null
  lastRecord: {
    ok: boolean
    action: string | null
    credits: number | null
    createdAt: string | null
  } | null
  error: string | null
}

const EMPTY_STATUS: Omit<PoolStatusView, 'ok' | 'error'> = {
  found: false,
  accountId: null,
  name: null,
  enabled: null,
  poolAccountId: null,
  poolCredVersion: null,
  poolSyncedAt: null,
  poolDeletedAt: null,
  pendingCred: false,
  cooldownUntil: null,
  lastRecord: null,
}

/** 点查单账号签到状态(GET /internal/checkin/pool-status;ai-service 不可达 → ok:false) */
export async function fetchPoolStatus(
  platform: CheckinPlatform,
  target: { poolAccountId: string; uid: string },
  fetchImpl: typeof fetch = fetch,
): Promise<PoolStatusView> {
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) {
    return { ok: false, ...EMPTY_STATUS, error: 'AI_CALLBACK_SECRET 未配置,无法点查签到状态' }
  }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-status?platform=${encodeURIComponent(platform)}&poolAccountId=${encodeURIComponent(target.poolAccountId)}&uid=${encodeURIComponent(target.uid)}`,
      {
        method: 'GET',
        headers: { 'X-Internal-Secret': secret },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!resp.ok) {
      const text = (await resp.text().catch(() => '')).slice(0, 200)
      return { ok: false, ...EMPTY_STATUS, error: `pool-status HTTP ${resp.status}: ${text}` }
    }
    const body = (await resp.json()) as Record<string, unknown>
    const last = (body.lastRecord ?? null) as Record<string, unknown> | null
    return {
      ok: true,
      found: body.found === true,
      accountId: typeof body.accountId === 'number' ? body.accountId : null,
      name: typeof body.name === 'string' ? body.name : null,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : null,
      poolAccountId: typeof body.poolAccountId === 'string' ? body.poolAccountId : null,
      poolCredVersion: typeof body.poolCredVersion === 'number' ? body.poolCredVersion : null,
      poolSyncedAt: typeof body.poolSyncedAt === 'string' ? body.poolSyncedAt : null,
      poolDeletedAt: typeof body.poolDeletedAt === 'string' ? body.poolDeletedAt : null,
      pendingCred: body.pendingCred === true,
      cooldownUntil: typeof body.cooldownUntil === 'string' ? body.cooldownUntil : null,
      lastRecord: last
        ? {
            ok: last.ok === true,
            action: typeof last.action === 'string' ? last.action : null,
            credits: typeof last.credits === 'number' ? last.credits : null,
            createdAt: typeof last.createdAt === 'string' ? last.createdAt : null,
          }
        : null,
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, ...EMPTY_STATUS, error: `pool-status 网络错误: ${msg}` }
  }
}

/** 手动签到触发结果(POST /internal/checkin/pool-run;httpStatus 供 admin 路由透传 429/404) */
export interface PoolRunResult {
  ok: boolean
  httpStatus: number
  record: Record<string, unknown> | null
  error: string | null
}

/** 触发账号立即签到(尊重冷却/限流:429 由调用方原样透传给 admin/用户) */
export async function postPoolRun(
  platform: CheckinPlatform,
  target: PoolAccountRef,
  fetchImpl: typeof fetch = fetch,
): Promise<PoolRunResult> {
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) {
    return {
      ok: false,
      httpStatus: 503,
      record: null,
      error: 'AI_CALLBACK_SECRET 未配置,无法触发签到',
    }
  }
  try {
    const resp = await fetchImpl(
      `${config.AI_SERVICE_URL.replace(/\/+$/, '')}/internal/checkin/pool-run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
        body: JSON.stringify({
          platform,
          poolAccountId: target.poolAccountId,
          ownerUserId: target.ownerUserId,
          uid: target.uid,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    const body = (await resp.json().catch(() => null)) as Record<string, unknown> | null
    if (!resp.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : ''
      return {
        ok: false,
        httpStatus: resp.status,
        record: null,
        error: `pool-run HTTP ${resp.status}${detail ? `: ${detail}` : ''}`,
      }
    }
    return { ok: true, httpStatus: 200, record: body ?? {}, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : '未知错误'
    return { ok: false, httpStatus: 502, record: null, error: `pool-run 网络错误: ${msg}` }
  }
}
