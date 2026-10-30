// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌落库(2026-10-28 立)—— 客户端为主、池只读回灌策略的写入端。
 *
<<<<<<< HEAD
 * 立因:Qoder 的 deviceToken/refresh 会轮换 refreshToken,而号池与本机 Qoder 客户端
 * 共用同一枚 rt —— 谁先刷谁把对方顶掉(客户端侧表现为登录态被清,池侧表现为刷新
 * 连续失败 3 次被摘)。Trae 自 2026-10-24 起就是「客户端负责续期 + 池每 10 分钟回灌」
 * 的同构形态,Qoder 缺这一环,票一旦被客户端轮换,池里的旧票就永久失效。
 *
 * 与 `relay-import-qoder.ts`(整条覆盖 + 重置健康状态)不同:本脚本只动凭证四列
 * (token/refreshToken/到期时刻)与 Cosy 设备头,并 `credVersion + 1`(签到侧按版本
 * 防降级,不涨版本新票推不过去),**绝不碰** healthStatus / tempUnschedulable /
 * refreshFailureCount / lastErrorMessage。
 *
 * 是否覆盖由 `relay-trae-session-sync.ts` 的 `decideSync` 判定(单一判据源,不复制规则):
 * - 同票 ⇒ 不写;池内到期时刻更新 ⇒ 不写;客户端更新/轮换 ⇒ 写。
 *
 * 编排上游 = `scripts/sync-qoder-client-session.mjs`(提取本机 auth.v1.dat → stdin)。
 * 退出码:0 全部处理完(含 skip)/ 1 有行写入失败 / 2 参数·输入·环境未判定。
 * 任何输出面不得含凭据明文。
 */
import { dirname, resolve as resolvePath } from 'node:path'
=======
 * 立因:Qoder 的 deviceToken/refresh 响应**轮换 refresh_token**(qoder-adapter 真机实测),
 * 号池与本机客户端共用同一枚 rt ⇒ 池主动续期当场把客户端顶下线(用户硬约束:不许顶号)。
 * 定案与 trae 同형:客户端负责续期,本脚本每 10 分钟把本机 auth.v1.dat 解出的新票同步进池;
 * 池侧走 client-first(relay-account-pool-scheduler 的 renewalPolicyOf),票未过期绝不主动刷。
 *
 * 与 relay-import-qoder.ts(整条覆盖 + 重置健康状态)不同:本脚本只动凭证四列 + 设备指纹
 * + extraMetadata.cosy,并 `credVersion + 1`(签到侧按版本防降级);**绝不碰**
 * healthStatus / tempUnschedulable / refreshFailureCount / lastErrorMessage。
 * 池内没有该 uid ⇒ 计 missing,**不建行**(回灌只对已导入的号有意义)。
 *
 * 判据 = src/services/relay-session-sync-decision.ts 的 decideSync(与 trae 腿共用一份):
 * 同票不写;客户端票比池内旧不写;客户端更新则写;客户端没给 refreshToken 时池内该列不动。
 *
 * 取数 = scripts/lib/qoder-auth-extract.mjs(spawn pwsh 跑 apps/api/scripts/qoder-capture.ps1,
 * DPAPI 解 Local State → AES-256-GCM 解 auth.v1.dat)。无 pwsh/未登录/形状坏 ⇒ exit 2 未判定。
 *
 * 退出码:0 全部处理完(含 skip/missing)/ 1 有行写入失败 / 2 未判定。
 * 任何输出面不得含凭据明文(只有 uid/decision/错误消息)。
 */
import { resolve as resolvePath, dirname } from 'node:path'
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
<<<<<<< HEAD
=======
const REPO_ROOT = resolvePath(API_DIR, '..', '..')
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
<<<<<<< HEAD
// 判据单源:回灌决策沿用 Trae 那条(与平台无关),经 __test__ 出口取用
const traeSync = await import('./relay-trae-session-sync.js')
const decideSync = traeSync.__test__.decideSync
const parseIso = traeSync.__test__.parseIso

export interface QoderSyncCandidate {
  uid: string
  token: string
  refreshToken?: string | null
  expiresAt?: string | null
  refreshTokenExpiresAt?: string | null
  deviceId?: string | null
  machineId?: string | null
  /** Cosy-* 设备头族(客户端 runtime-info.exe 产出;缺则沿用池内档) */
  machineToken?: string | null
  machineCode?: string | null
  machineType?: string | null
  version?: string | null
}

export interface QoderSyncPayload {
  providerCode: string
  accounts: QoderSyncCandidate[]
  meta?: Record<string, unknown>
}

/** Cosy 档合并补丁(纯函数):只在有值且与旧档不同时产出整档,否则 null(不写)。 */
export function buildCosyPatch(
  existing: Record<string, unknown> | null | undefined,
  incoming: {
    machineToken?: string | null
    machineCode?: string | null
    machineType?: string | null
    version?: string | null
  },
): Record<string, unknown> | null {
  const next: Record<string, string> = {}
  for (const [field, key] of [
    ['machineToken', 'machine_token'],
    ['machineCode', 'machine_code'],
    ['machineType', 'machine_type'],
    ['version', 'version'],
  ] as const) {
    const v = incoming[field]
    if (typeof v === 'string' && v.trim() !== '') next[key] = v.trim()
  }
  if (Object.keys(next).length === 0) return null
  const cur = existing?.['cosy']
  const cosy =
    cur !== null && typeof cur === 'object' && !Array.isArray(cur)
      ? (cur as Record<string, unknown>)
      : {}
  return JSON.stringify({ ...cosy, ...next }) === JSON.stringify(cosy) ? null : { ...cosy, ...next }
}

interface RowOutcome {
  uid: string
  decision: string
=======
const { decideSync, parseIso } = await import('../src/services/relay-session-sync-decision.js')
const { extractQoderAccounts } = await import(
  pathToFileURL(resolvePath(REPO_ROOT, 'scripts', 'lib', 'qoder-auth-extract.mjs')).href
)

/** qoder-capture.ps1 的单条会话(字段与桌面端 CapturedQoderSession 对齐) */
export interface QoderCapturedSession {
  uid?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  deviceId?: string
  machineId?: string
  version?: string
  machineToken?: string
  machineCode?: string
  machineType?: string
  edition?: string
}

export type SyncReason = 'same-token' | 'pool-newer' | 'client-newer' | 'client-rotated' | 'apply'

export interface RowOutcome {
  uid: string
  decision: SyncReason | 'missing'
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
  applied: boolean
  error?: string
}

export interface QoderSyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: 'qoder'
  total: number
  applied: number
  skipped: number
  missing: number
  failed: number
  rows: RowOutcome[]
}

<<<<<<< HEAD
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

export async function runSync(payloadText: string, dryRun: boolean): Promise<QoderSyncSummary> {
  let payload: QoderSyncPayload
  try {
    payload = JSON.parse(payloadText) as QoderSyncPayload
  } catch {
    throw new Error('stdin 不是合法 JSON(未判定)')
  }
  if (!payload || typeof payload !== 'object' || payload.providerCode !== 'qoder') {
    throw new Error("providerCode 必须是 'qoder'(未判定)")
  }
  if (!Array.isArray(payload.accounts)) {
    throw new Error('accounts 必须是数组(未判定)')
  }

=======
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 合并 extraMetadata.cosy(蛇形键 = qoder-adapter COSY_HEADERS 的读取口径) */
export function mergeCosy(
  base: Record<string, unknown> | null | undefined,
  s: QoderCapturedSession,
): Record<string, unknown> | null {
  const machineToken = str(s.machineToken)
  const machineCode = str(s.machineCode)
  const machineType = str(s.machineType)
  const version = str(s.version)
  if (!machineToken && !machineCode && !machineType && !version) return null
  const next: Record<string, unknown> =
    base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {}
  const cosy: Record<string, unknown> =
    next.cosy && typeof next.cosy === 'object' && !Array.isArray(next.cosy)
      ? { ...(next.cosy as Record<string, unknown>) }
      : {}
  if (machineToken) cosy.machine_token = machineToken
  if (machineCode) cosy.machine_code = machineCode
  if (machineType) cosy.machine_type = machineType
  if (version) cosy.version = version
  next.cosy = cosy
  // 历史行同时存了扁平键(导入时落库形态),继续跟随,避免两套形状分叉
  if (machineToken) next.machineToken = machineToken
  if (machineCode) next.machineCode = machineCode
  if (machineType) next.machineType = machineType
  if (version) next.version = version
  return next
}

export async function runSync(
  sessions: QoderCapturedSession[],
  dryRun: boolean,
): Promise<QoderSyncSummary> {
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
  const summary: QoderSyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'qoder',
<<<<<<< HEAD
    total: payload.accounts.length,
=======
    total: sessions.length,
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    rows: [],
  }

<<<<<<< HEAD
  for (const acc of payload.accounts) {
    const uid = typeof acc?.uid === 'string' ? acc.uid : ''
    try {
      if (!uid || typeof acc.token !== 'string' || acc.token === '') {
        summary.failed++
        summary.rows.push({ uid, decision: 'apply', applied: false, error: '缺 uid/token' })
=======
  for (const s of sessions) {
    const uid = str(s.uid)
    const clientToken = str(s.accessToken)
    try {
      if (!uid || !clientToken) {
        summary.failed++
        summary.rows.push({ uid, decision: 'apply', applied: false, error: '缺 uid/accessToken' })
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
        continue
      }
      const [row] = await db
        .select()
        .from(aiRelayAccountPool)
        .where(and(eq(aiRelayAccountPool.providerCode, 'qoder'), eq(aiRelayAccountPool.uid, uid)))
        .limit(1)
      if (!row) {
        summary.missing++
        summary.rows.push({
          uid,
<<<<<<< HEAD
          decision: 'apply',
=======
          decision: 'missing',
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
          applied: false,
          error: '池内无此 uid(未导入?)',
        })
        continue
      }
<<<<<<< HEAD
      // 池内明文解不出(密钥轮换/坏密文)时当作"票不同"走 apply,让客户端票覆盖坏密文
=======
      // 池内解不出(密钥轮换/坏密文)⇒ 当作票不同,让客户端票覆盖坏密文
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
      let poolPlain: string | null = null
      try {
        poolPlain = row.tokenEnc ? decryptField(row.tokenEnc) : null
      } catch {
        poolPlain = null
      }
      const final = decideSync({
        poolToken: poolPlain,
        poolTokenExpiresAt: row.tokenExpiresAt,
        poolRefreshExpiresAt: row.refreshExpiresAt,
<<<<<<< HEAD
        clientToken: acc.token,
        clientRefreshToken: typeof acc.refreshToken === 'string' ? acc.refreshToken : null,
        clientExpiresAt: parseIso(acc.expiresAt),
        clientRefreshExpiresAt: parseIso(acc.refreshTokenExpiresAt),
      })
      const cosyPatch = buildCosyPatch(row.extraMetadata as Record<string, unknown> | null, acc)
      const extraUpdate = cosyPatch
        ? {
            extraMetadata: {
              ...((row.extraMetadata as Record<string, unknown> | null) ?? {}),
              cosy: cosyPatch,
            },
          }
        : {}
      const deviceUpdate =
        typeof acc.machineId === 'string' && acc.machineId ? { machineId: acc.machineId } : {}
      const deviceIdUpdate =
        typeof acc.deviceId === 'string' && acc.deviceId ? { deviceId: acc.deviceId } : {}

      if (!final.apply) {
        // 票没轮换但设备头/档案变了也要种(换机后 Cosy 头缺族会让 refresh 被拒)
        if (
          (cosyPatch ||
            Object.keys(deviceUpdate).length > 0 ||
            Object.keys(deviceIdUpdate).length > 0) &&
          !dryRun
        ) {
          await db
            .update(aiRelayAccountPool)
            .set({
              ...extraUpdate,
              ...deviceUpdate,
              ...deviceIdUpdate,
              updatedAt: new Date(),
            })
            .where(
              and(eq(aiRelayAccountPool.providerCode, 'qoder'), eq(aiRelayAccountPool.uid, uid)),
            )
        }
=======
        clientToken,
        clientRefreshToken: str(s.refreshToken) || null,
        clientExpiresAt: parseIso(s.expiresAt),
        clientRefreshExpiresAt: parseIso(s.refreshTokenExpiresAt),
      })
      if (!final.apply) {
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
        summary.skipped++
        summary.rows.push({ uid, decision: final.reason, applied: false })
        continue
      }
      if (dryRun) {
        summary.applied++
        summary.rows.push({ uid, decision: final.reason, applied: false, error: 'dry-run 未写' })
        continue
      }
<<<<<<< HEAD
=======
      const extraMetadata = mergeCosy(
        (row.extraMetadata ?? null) as Record<string, unknown> | null,
        s,
      )
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(final.next.token),
          ...(final.next.refreshToken !== null
            ? { refreshTokenEnc: encryptField(final.next.refreshToken) }
            : {}),
          tokenExpiresAt: final.next.tokenExpiresAt,
          refreshExpiresAt: final.next.refreshExpiresAt,
<<<<<<< HEAD
          ...extraUpdate,
          ...deviceUpdate,
          ...deviceIdUpdate,
=======
          ...(str(s.deviceId) ? { deviceId: str(s.deviceId) } : {}),
          ...(str(s.machineId) ? { machineId: str(s.machineId) } : {}),
          ...(extraMetadata ? { extraMetadata } : {}),
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
          // 签到侧按 cred_version 防降级:不涨版本,新票永远推不过去
          credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(aiRelayAccountPool.providerCode, 'qoder'), eq(aiRelayAccountPool.uid, uid)))
      summary.applied++
      summary.rows.push({ uid, decision: final.reason, applied: true })
    } catch (e) {
      summary.failed++
      summary.rows.push({
        uid,
        decision: 'apply',
        applied: false,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      })
    }
  }
  if (summary.failed > 0) summary.ok = false
  return summary
}

<<<<<<< HEAD
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
  let summary: QoderSyncSummary
  try {
    summary = await runSync(payloadText, options.dryRun)
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
=======
export function parseArgs(argv: string[]): {
  dryRun: boolean
  json: boolean
  help: boolean
  error: string | null
} {
  const options = { dryRun: false, json: false, help: false, error: null as string | null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else options.error = `未知参数: ${a}`
  }
  return options
}

const USAGE = '用法: tsx relay-qoder-session-sync.ts [--json] [--dry-run]'

export async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv)
  if (options.error) {
    process.stderr.write(`❌ ${options.error}(${USAGE})\n`)
    return 2
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  let sessions: QoderCapturedSession[]
  try {
    const extracted = (await extractQoderAccounts()) as {
      accounts?: QoderCapturedSession[]
    }
    sessions = Array.isArray(extracted?.accounts) ? extracted.accounts : []
  } catch (e) {
    // 未判定:无 pwsh / 未登录 / 解密失败 / 输出形状坏 —— 不写库、不冒绿
    process.stderr.write(
      `❌ 提取本机 Qoder 会话失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  let summary: QoderSyncSummary
  try {
    summary = await runSync(sessions, options.dryRun)
  } catch (e) {
    process.stderr.write(`❌ 回灌异常(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
    return 2
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
<<<<<<< HEAD
    process.stderr.write(
      `回灌完成: applied=${summary.applied} skipped=${summary.skipped} missing=${summary.missing} failed=${summary.failed}${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
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

export const __test__ = { buildCosyPatch, parseArgs, parseIso }
=======
    process.stdout.write(
      `qoder-session-sync: total=${summary.total} applied=${summary.applied} ` +
        `skipped=${summary.skipped} missing=${summary.missing} failed=${summary.failed}` +
        `${summary.dryRun ? ' (dry-run)' : ''}\n`,
    )
    for (const r of summary.rows) {
      if (!r.applied && r.decision !== 'same-token') {
        process.stdout.write(`  - uid=${r.uid} decision=${r.decision} ${r.error ?? ''}\n`)
      }
    }
  }
  return summary.failed > 0 ? 1 : 0
}

export const __test__ = { mergeCosy, parseArgs, decideSync, parseIso }

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    },
  )
}
>>>>>>> 90bd9fcc8c00e2886d4b878ca695112ad527e9fe
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
