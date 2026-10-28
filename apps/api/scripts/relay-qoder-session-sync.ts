// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 会话回灌落库(2026-10-28 立)—— 客户端为主、池只读回灌策略的写入端。
 *
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
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
const REPO_ROOT = resolvePath(API_DIR, '..', '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
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
  const summary: QoderSyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'qoder',
    total: sessions.length,
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    rows: [],
  }

  for (const s of sessions) {
    const uid = str(s.uid)
    const clientToken = str(s.accessToken)
    try {
      if (!uid || !clientToken) {
        summary.failed++
        summary.rows.push({ uid, decision: 'apply', applied: false, error: '缺 uid/accessToken' })
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
          decision: 'missing',
          applied: false,
          error: '池内无此 uid(未导入?)',
        })
        continue
      }
      // 池内解不出(密钥轮换/坏密文)⇒ 当作票不同,让客户端票覆盖坏密文
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
        clientToken,
        clientRefreshToken: str(s.refreshToken) || null,
        clientExpiresAt: parseIso(s.expiresAt),
        clientRefreshExpiresAt: parseIso(s.refreshTokenExpiresAt),
      })
      if (!final.apply) {
        summary.skipped++
        summary.rows.push({ uid, decision: final.reason, applied: false })
        continue
      }
      if (dryRun) {
        summary.applied++
        summary.rows.push({ uid, decision: final.reason, applied: false, error: 'dry-run 未写' })
        continue
      }
      const extraMetadata = mergeCosy(
        (row.extraMetadata ?? null) as Record<string, unknown> | null,
        s,
      )
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(final.next.token),
          ...(final.next.refreshToken !== null
            ? { refreshTokenEnc: encryptField(final.next.refreshToken) }
            : {}),
          tokenExpiresAt: final.next.tokenExpiresAt,
          refreshExpiresAt: final.next.refreshExpiresAt,
          ...(str(s.deviceId) ? { deviceId: str(s.deviceId) } : {}),
          ...(str(s.machineId) ? { machineId: str(s.machineId) } : {}),
          ...(extraMetadata ? { extraMetadata } : {}),
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
    return 2
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
