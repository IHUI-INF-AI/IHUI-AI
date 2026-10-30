// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax Code(mcode)会话回灌落库(2026-10-31 立)—— 客户端为主、池只读回灌策略的写入端。
 *
 * 立因:mcode 桌面端会轮换 accessToken/refreshToken(auth.json 的 generation 递增),而号池里
 * 那枚 minimax 票是人工导入时的快照 ⇒ token 一过期就永久 down。`minimax-adapter` 又刻意
 * **不实现** refreshToken(刷新端点无公开文档,不猜)⇒ 池自身没有任何自愈通道,本腿是唯一出路。
 *
 * 与 `relay-import-*.ts`(整条覆盖 + 重置健康状态)不同:本脚本只动凭证列并
 * `credVersion + 1`(签到侧按版本防降级),并存**证据**上恢复健康态(见 `revivePatchOf`):
 * 只有当客户端递来「与池内不同且尚未过期」的票时,才把 down/degraded/被摘除的行放回 unknown
 * 让巡检重新定级 —— 同票 / 过期票一律不碰健康字段(否则每 10 分钟一次的回灌会把 down 洗成
 * unknown,§0.3 取不到 ≠ 失效)。
 *
 * 身份识别(2026-10-31 现读):`mapMinimaxImport` 的 uid 是 `auto:sha256(recordKey:token)`,
 * **随 token 旋转而变**,照 uid 找行在票一换之后就永远找不到 → 会每轮新建一行、旧行永久 down。
 * 故本脚本按「uid(载荷显式给出时)> secrets.recordKey(导入时已落库、轮换前后不变,本机实证)」
 * 两级匹配;两级都不中才走 `importAccounts` 自动入池。uid 列本身不改写(它是签到/台账的引用键)。
 *
 * 编排上游 = `scripts/sync-minimax-client-session.mjs`(提取本机 auth.json → stdin)。
 * 退出码:0 全部处理完(含 skip/自动入池)/ 1 有行写入失败 / 2 参数·输入·环境未判定。
 * 任何输出面不得含凭据明文(只报 uid / 区域 / 到期 / 计数)。
 */
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, isNull, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
// 判据单源(§0.6):回灌决策沿用 Trae/Qoder 那条(与平台无关),经 __test__ 出口取用
const traeSync = await import('./relay-trae-session-sync.js')
const decideSync = traeSync.__test__.decideSync
const parseIso = traeSync.__test__.parseIso

import type { SyncReason } from '../src/services/relay-session-sync-decision.js'
import type { ImportAccountInput } from '../src/services/relay-account-pool-service.js'

/** mcode auth.json 单条记录(提取器 raw 直通)+ 编排器补的 ISO 到期 */
export interface MinimaxSyncCandidate {
  /** 池内 uid(载荷显式给出时才用;提取器不给) */
  uid?: string | null
  recordKey?: string | null
  region?: string | null
  accessToken?: string | null
  /** accessToken 的别名(手写载荷兼容),两者取其一 */
  token?: string | null
  refreshToken?: string | null
  expiresAt?: string | null
  expiresAtMs?: number | null
  refreshExpiresAt?: string | null
  clientId?: string | null
  scopes?: string[] | null
  audience?: string | null
  tokenType?: string | null
  loginEpoch?: string | null
  sourcePath?: string | null
}

export interface MinimaxSyncPayload {
  providerCode: string
  accounts: MinimaxSyncCandidate[]
  meta?: Record<string, unknown>
}

/** 池面单行切片(secrets 已解密;解不出 ⇒ null 并计入 undecryptable) */
export interface PoolRowSlice {
  id: string
  uid: string
  tokenPlain: string | null
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  secrets: Record<string, unknown> | null
  healthStatus: string
  refreshFailureCount: number
  tempUnschedulable: boolean
}

/** 健康态恢复补丁(只上行不下行) */
export interface HealthRevival {
  healthStatus: 'unknown'
  refreshFailureCount: number
  lastErrorMessage: null
  tempUnschedulable: false
}

interface RowOutcome {
  uid: string
  decision: SyncReason | 'auto-import'
  applied: boolean
  error?: string
}

export interface MinimaxSyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: 'minimax'
  total: number
  applied: number
  skipped: number
  missing: number
  failed: number
  /** 本机新登录账号自动入池数(池内无行 → 走 importAccounts 建行;dry-run 只报不写) */
  imported: number
  /** 凭证轮换后健康态被放回 unknown 的行数(仅 down/degraded/被摘除行) */
  revived: number
  /** 池内 minimax 行里 secrets 解不出的行数(身份识别对它们失效,如实报数) */
  undecryptable: number
  rows: RowOutcome[]
}

function cstr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 凭据取值:accessToken 优先,token 为手写别名 */
export function tokenOf(acc: MinimaxSyncCandidate): string {
  return cstr(acc.accessToken) || cstr(acc.token)
}

/** 到期时刻:显式 ISO 优先,其次 mcode 的 expiresAtMs(上游给的真值) */
export function expiryOf(acc: MinimaxSyncCandidate): Date | null {
  const iso = parseIso(acc.expiresAt)
  if (iso) return iso
  const ms =
    typeof acc.expiresAtMs === 'number' && Number.isFinite(acc.expiresAtMs) ? acc.expiresAtMs : null
  return ms === null ? null : new Date(ms)
}

/** 导入期落进 secretsEnc 的 recordKey(轮换前后不变,本机 2026-10-31 实证) */
export function recordKeyOfSecrets(secrets: Record<string, unknown> | null): string | null {
  const key = cstr(secrets?.['recordKey'])
  return key === '' ? null : key
}

/** 记录键的人读短名:leveldb 键分隔符后的账号哈希尾 8 位(非凭据,可进日志) */
export function recordKeyLabel(recordKey: string | null | undefined): string {
  const key = cstr(recordKey)
  if (!key) return '(无 recordKey)'
  const tail = key.split('\u0000').pop() ?? key
  return `rk:…${tail.slice(-8)}`
}

/**
 * 池面身份匹配(纯函数):uid 精确命中优先,其次按 secrets.recordKey 命中。
 * 命中 null ⇒ 池内没有这枚号(由调用方走 importAccounts 自动入池)。
 */
export function matchPoolRow(
  rows: ReadonlyArray<PoolRowSlice>,
  candidate: { uid?: string | null; recordKey?: string | null },
): PoolRowSlice | null {
  const uid = cstr(candidate.uid)
  if (uid) {
    const hit = rows.find((r) => r.uid === uid)
    if (hit) return hit
  }
  const recordKey = cstr(candidate.recordKey)
  if (!recordKey) return null
  return rows.find((r) => recordKeyOfSecrets(r.secrets) === recordKey) ?? null
}

/**
 * 回灌候选 → 自动入池条目(纯函数,不连库可测)。只在「池内无此号」时消费;
 * 键位与手动导入(Web/CLI)同一形状:token←accessToken、到期←expiresAtMs、其余进 secretsEnc。
 * 刻意不给 uid/name —— uid 判据与统一名都交服务端单源(mapMinimaxImport / resolveRelayAccountName)。
 */
export function buildMinimaxAutoImportInput(acc: MinimaxSyncCandidate): ImportAccountInput | null {
  const token = tokenOf(acc)
  if (!token) return null
  const input: Record<string, unknown> = { accessToken: token }
  const refreshToken = cstr(acc.refreshToken)
  if (refreshToken) input.refreshToken = refreshToken
  if (typeof acc.expiresAtMs === 'number' && Number.isFinite(acc.expiresAtMs)) {
    input.expiresAtMs = acc.expiresAtMs
  }
  const scopes = Array.isArray(acc.scopes)
    ? acc.scopes.filter((s): s is string => typeof s === 'string' && s !== '')
    : []
  if (scopes.length > 0) input.scopes = scopes
  for (const key of [
    'region',
    'recordKey',
    'clientId',
    'audience',
    'tokenType',
    'loginEpoch',
    'sourcePath',
  ] as const) {
    const v = cstr(acc[key])
    if (v) input[key] = v
  }
  return input as ImportAccountInput
}

/**
 * 健康态恢复判据(纯函数)。**只上行不下行**:
 * - 客户端没给到期 / 票已过期 ⇒ null(过期票不是"账号活着"的证据,交巡检判);
 * - 池内已是 healthy ⇒ null(不回退健康态,也不替 admin 解摘);
 * - down / degraded / 有刷新失败计数 / 被临时摘除 ⇒ 放回 unknown + 清零失败面
 *   (与巡检"刷新成功"分支同形;minimax 无刷新能力,不这么做这行永远回不来)。
 */
export function revivePatchOf(
  pool: { healthStatus: string; refreshFailureCount: number; tempUnschedulable: boolean },
  clientExpiresAt: Date | null,
  now: Date,
): HealthRevival | null {
  if (!clientExpiresAt) return null
  if (clientExpiresAt.getTime() <= now.getTime()) return null
  if (pool.healthStatus === 'healthy') return null
  const broken =
    pool.healthStatus === 'down' ||
    pool.healthStatus === 'degraded' ||
    pool.refreshFailureCount > 0 ||
    pool.tempUnschedulable
  if (!broken) return null
  return {
    healthStatus: 'unknown',
    refreshFailureCount: 0,
    lastErrorMessage: null,
    tempUnschedulable: false,
  }
}

/**
 * secrets 合并补丁(纯函数):以既有为底,只覆盖本次确实提供的键(region/clientId/…)。
 * 无变化 ⇒ null(不产生无意义写);既有坏档 ⇒ 以本次重建。
 */
export function buildSecretsPatch(
  existing: Record<string, unknown> | null,
  acc: MinimaxSyncCandidate,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = existing ? { ...existing } : {}
  const next: Record<string, unknown> = { ...base }
  for (const key of [
    'region',
    'recordKey',
    'clientId',
    'audience',
    'tokenType',
    'loginEpoch',
    'sourcePath',
  ] as const) {
    const v = cstr(acc[key])
    if (v) next[key] = v
  }
  const scopes = Array.isArray(acc.scopes)
    ? acc.scopes.filter((s): s is string => typeof s === 'string' && s !== '')
    : []
  if (scopes.length > 0) next.scopes = scopes
  return JSON.stringify(next) === JSON.stringify(base) ? null : next
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** 读运营池的 minimax 行(owner IS NULL;个人池行结构上不进本腿的射程) */
async function loadPoolRows(): Promise<{ rows: PoolRowSlice[]; undecryptable: number }> {
  const raw = await db
    .select({
      id: aiRelayAccountPool.id,
      uid: aiRelayAccountPool.uid,
      tokenEnc: aiRelayAccountPool.tokenEnc,
      tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
      refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
      secretsEnc: aiRelayAccountPool.secretsEnc,
      healthStatus: aiRelayAccountPool.healthStatus,
      refreshFailureCount: aiRelayAccountPool.refreshFailureCount,
      tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
    })
    .from(aiRelayAccountPool)
    .where(
      and(eq(aiRelayAccountPool.providerCode, 'minimax'), isNull(aiRelayAccountPool.ownerUserId)),
    )
  let undecryptable = 0
  const rows = raw.map((r) => {
    let secrets: Record<string, unknown> | null = null
    if (r.secretsEnc) {
      try {
        const parsed: unknown = JSON.parse(decryptField(r.secretsEnc))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          secrets = parsed as Record<string, unknown>
        } else {
          undecryptable++
        }
      } catch {
        undecryptable++
      }
    }
    let tokenPlain: string | null = null
    try {
      tokenPlain = r.tokenEnc ? decryptField(r.tokenEnc) : null
    } catch {
      tokenPlain = null // 坏密文 ⇒ 当作"票不同",让客户端票覆盖它
    }
    return { ...r, tokenPlain, secrets }
  })
  return { rows, undecryptable }
}

export async function runSync(payloadText: string, dryRun: boolean): Promise<MinimaxSyncSummary> {
  let payload: MinimaxSyncPayload
  try {
    payload = JSON.parse(payloadText) as MinimaxSyncPayload
  } catch {
    throw new Error('stdin 不是合法 JSON(未判定)')
  }
  if (!payload || typeof payload !== 'object' || payload.providerCode !== 'minimax') {
    throw new Error("providerCode 必须是 'minimax'(未判定)")
  }
  if (!Array.isArray(payload.accounts)) {
    throw new Error('accounts 必须是数组(未判定)')
  }

  const summary: MinimaxSyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'minimax',
    total: payload.accounts.length,
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    imported: 0,
    revived: 0,
    undecryptable: 0,
    rows: [],
  }

  let pool: { rows: PoolRowSlice[]; undecryptable: number } | null = null
  const ensurePool = async (): Promise<PoolRowSlice[]> => {
    if (!pool) {
      pool = await loadPoolRows()
      summary.undecryptable = pool.undecryptable
    }
    return pool.rows
  }

  for (const raw of payload.accounts as unknown[]) {
    const acc = (raw ?? {}) as MinimaxSyncCandidate
    const token = tokenOf(acc)
    const uidIn = cstr(acc.uid)
    const recordKey = cstr(acc.recordKey)
    const label = uidIn || recordKeyLabel(recordKey)
    try {
      if (!token) {
        summary.failed++
        summary.rows.push({
          uid: label,
          decision: 'apply',
          applied: false,
          error: '缺 accessToken',
        })
        continue
      }
      const row = matchPoolRow(await ensurePool(), { uid: uidIn, recordKey })
      if (!row) {
        // 池内无此号 ⇒ 自动入池:与手动导入同一落库出口(运营池行、credVersion+1、
        // 唯一索引只圈运营池 ⇒ 结构上碰不到个人池行)。并发撞索引按 failed 点名,绝不冒绿。
        const autoInput = buildMinimaxAutoImportInput(acc)
        if (!autoInput) {
          summary.missing++
          summary.rows.push({
            uid: label,
            decision: 'auto-import',
            applied: false,
            error: '本机会话构不成导入条目(不猜)',
          })
          continue
        }
        if (dryRun) {
          summary.imported++
          summary.rows.push({
            uid: label,
            decision: 'auto-import',
            applied: false,
            error: 'dry-run 未写',
          })
          continue
        }
        const { importAccounts } = await import('../src/services/relay-account-pool-service.js')
        const res = await importAccounts('minimax', [autoInput], null)
        const item = res.items[0]
        if (item && (item.status === 'imported' || item.status === 'updated')) {
          summary.imported++
          summary.rows.push({
            uid: item.uid ?? label,
            decision: 'auto-import',
            applied: true,
          })
        } else {
          summary.failed++
          summary.rows.push({
            uid: item?.uid ?? label,
            decision: 'auto-import',
            applied: false,
            error: (item?.reason ?? '导入未回报条目').slice(0, 200),
          })
        }
        continue
      }

      const final = decideSync({
        poolToken: row.tokenPlain,
        poolTokenExpiresAt: row.tokenExpiresAt,
        poolRefreshExpiresAt: row.refreshExpiresAt,
        clientToken: token,
        clientRefreshToken: cstr(acc.refreshToken) || null,
        clientExpiresAt: expiryOf(acc),
        clientRefreshExpiresAt: parseIso(acc.refreshExpiresAt),
      })
      if (!final.apply) {
        // 票没轮换 ⇒ 不写任何列:minimax 的会话没有设备材料可补种,健康态也不许被"同票"
        // 反复刷新(§0.3:同票是没有新证据,不等于账号恢复)。
        summary.skipped++
        summary.rows.push({ uid: row.uid, decision: final.reason, applied: false })
        continue
      }
      if (dryRun) {
        summary.applied++
        summary.rows.push({
          uid: row.uid,
          decision: final.reason,
          applied: false,
          error: 'dry-run 未写',
        })
        continue
      }

      const now = new Date()
      const secretsPatch = buildSecretsPatch(row.secrets, acc)
      const revival = revivePatchOf(row, expiryOf(acc), now)
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(final.next.token),
          ...(final.next.refreshToken !== null
            ? { refreshTokenEnc: encryptField(final.next.refreshToken) }
            : {}),
          tokenExpiresAt: final.next.tokenExpiresAt,
          refreshExpiresAt: final.next.refreshExpiresAt,
          lastRefreshAt: now,
          ...(secretsPatch ? { secretsEnc: encryptField(JSON.stringify(secretsPatch)) } : {}),
          // 签到侧按 cred_version 防降级:不涨版本,新票永远推不过去
          credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          ...(revival ?? {}),
          updatedAt: now,
        })
        .where(and(eq(aiRelayAccountPool.id, row.id), isNull(aiRelayAccountPool.ownerUserId)))
      summary.applied++
      if (revival) summary.revived++
      summary.rows.push({ uid: row.uid, decision: final.reason, applied: true })
    } catch (e) {
      summary.failed++
      summary.rows.push({
        uid: label,
        decision: 'apply',
        applied: false,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      })
    }
  }
  if (summary.failed > 0) summary.ok = false
  return summary
}

function parseArgs(argv: string[]): {
  stdin: boolean
  dryRun: boolean
  json: boolean
  error: string | null
} {
  const options = { stdin: false, dryRun: false, json: false, error: null as string | null }
  for (const a of argv) {
    if (a === '--stdin') options.stdin = true
    else if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--')
      continue // pnpm 透传的裸分隔符,不是参数
    else options.error = `未知参数: ${a}`
  }
  if (!options.stdin && !options.error) options.error = '必须 --stdin(凭据经标准输入,不落盘)'
  return options
}

export async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv)
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }
  let payloadText: string
  try {
    payloadText = await readStdin()
  } catch (e) {
    process.stderr.write(
      `❌ 读 stdin 失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  if (payloadText.trim() === '') {
    process.stderr.write('❌ stdin 为空(未判定)\n')
    return 2
  }
  let summary: MinimaxSyncSummary
  try {
    summary = await runSync(payloadText, options.dryRun)
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
    process.stderr.write(
      `回灌完成: applied=${summary.applied} skipped=${summary.skipped} missing=${summary.missing} ` +
        `imported=${summary.imported} revived=${summary.revived} failed=${summary.failed}` +
        `${summary.undecryptable > 0 ? ` undecryptable=${summary.undecryptable}` : ''}` +
        `${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
    for (const r of summary.rows) {
      process.stderr.write(
        `  ${r.uid} ${r.decision}${r.applied ? ' ✓已写' : ''}${r.error ? ` (${r.error})` : ''}\n`,
      )
    }
  }
  return summary.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  decideSync,
  parseIso,
  parseArgs,
  tokenOf,
  expiryOf,
  recordKeyOfSecrets,
  recordKeyLabel,
  matchPoolRow,
  buildMinimaxAutoImportInput,
  revivePatchOf,
  buildSecretsPatch,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
