// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 会话回灌落库(2026-10-24 立)—— 客户端为主、池只读回灌策略的写入端。
 *
 * 立因:号池与本机 Trae 客户端共用同一枚 refreshToken,谁先调 ExchangeToken 谁把
 * 对方顶下线(2026-10-24 实测:池 02:20 续期,02:26 客户端 `[updateUserInfo] {}`
 * 登录态被清)。定案 = 客户端负责续期,本脚本只把客户端轮换出的新票同步进池。
 *
 * 与 `relay-account-import.ts`(整条覆盖+重置健康状态)不同:本脚本只动凭证四列并
 * `credVersion + 1`(签到侧按版本防降级,不涨版本新票推不过去),**绝不碰**
 * healthStatus / tempUnschedulable / refreshFailureCount / lastErrorMessage。
 *
 * 是否覆盖由 `decideSync` 纯函数判定(单一判据源,测试直接 import):
 * - 同票 ⇒ 不写;
 * - 客户端到期时刻早于池内 ⇒ 不写(池内更新可能来自兜底续期,旧票不许回写);
 * - 客户端到期时刻更新 / 时刻相同但 token 不同 ⇒ 写;
 * - 客户端没给 refreshToken(web 号)⇒ 保留池内该列不动。
 *
 * 编排上游 = `scripts/sync-trae-client-session.mjs`(提取本机信封 → stdin 喂进来)。
 * 退出码:0 全部处理完(含 skip)/ 1 有行写入失败 / 2 参数·输入·环境未判定。
 * 任何输出面不得含凭据明文。
 */
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')

export interface SyncCandidate {
  uid: string
  token: string
  refreshToken?: string | null
  /** ISO 8601;客户端解析不到时缺省 */
  expiresAt?: string | null
  refreshExpiresAt?: string | null
}

export interface SyncInputPayload {
  providerCode: string
  accounts: SyncCandidate[]
  meta?: Record<string, unknown>
}

export interface DecideInput {
  poolToken: string | null
  poolTokenExpiresAt: Date | null
  poolRefreshExpiresAt: Date | null
  clientToken: string
  clientRefreshToken: string | null
  clientExpiresAt: Date | null
  clientRefreshExpiresAt: Date | null
}

export type SyncReason = 'same-token' | 'pool-newer' | 'client-newer' | 'client-rotated' | 'apply'

export interface SyncDecision {
  apply: boolean
  reason: SyncReason
  next: {
    token: string
    /** null = 客户端没给 refreshToken,池内该列保持不动 */
    refreshToken: string | null
    tokenExpiresAt: Date | null
    refreshExpiresAt: Date | null
  }
}

/** 单一判据源:决定客户端票是否应写进池(详见文件头)。 */
export function decideSync(input: DecideInput): SyncDecision {
  const clientMs = input.clientExpiresAt?.getTime() ?? null
  const poolMs = input.poolTokenExpiresAt?.getTime() ?? null
  const next = {
    token: input.clientToken,
    refreshToken: input.clientRefreshToken,
    tokenExpiresAt: input.clientExpiresAt ?? input.poolTokenExpiresAt,
    refreshExpiresAt: input.clientRefreshExpiresAt ?? input.poolRefreshExpiresAt,
  }
  if (input.clientToken === input.poolToken) {
    return { apply: false, reason: 'same-token', next }
  }
  if (clientMs !== null && poolMs !== null && clientMs < poolMs) {
    // 池内更新:可能来自"票已过期后的兜底续期",客户端旧票绝不允许回写覆盖
    return {
      apply: false,
      reason: 'pool-newer',
      next: {
        ...next,
        token: input.poolToken ?? input.clientToken,
        tokenExpiresAt: input.poolTokenExpiresAt,
        refreshExpiresAt: input.poolRefreshExpiresAt,
      },
    }
  }
  const reason: SyncReason =
    clientMs !== null && poolMs !== null && clientMs > poolMs
      ? 'client-newer'
      : clientMs !== null && poolMs !== null
        ? 'client-rotated'
        : 'apply'
  return { apply: true, reason, next }
}

interface RowOutcome {
  uid: string
  decision: SyncReason
  applied: boolean
  error?: string
}

export interface SyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: 'trae'
  total: number
  applied: number
  skipped: number
  missing: number
  failed: number
  rows: RowOutcome[]
}

export function parseIso(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

export async function runSync(payloadText: string, dryRun: boolean): Promise<SyncSummary> {
  let payload: SyncInputPayload
  try {
    payload = JSON.parse(payloadText) as SyncInputPayload
  } catch {
    throw new Error('stdin 不是合法 JSON(未判定)')
  }
  if (!payload || typeof payload !== 'object' || payload.providerCode !== 'trae') {
    throw new Error(`providerCode 必须是 'trae'(未判定)`)
  }
  if (!Array.isArray(payload.accounts)) {
    throw new Error('accounts 必须是数组(未判定)')
  }

  const summary: SyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'trae',
    total: payload.accounts.length,
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    rows: [],
  }

  for (const acc of payload.accounts) {
    const uid = typeof acc?.uid === 'string' ? acc.uid : ''
    try {
      if (!uid || typeof acc.token !== 'string' || acc.token === '') {
        summary.failed++
        summary.rows.push({ uid, decision: 'apply', applied: false, error: '缺 uid/token' })
        continue
      }
      const [row] = await db
        .select()
        .from(aiRelayAccountPool)
        .where(and(eq(aiRelayAccountPool.providerCode, 'trae'), eq(aiRelayAccountPool.uid, uid)))
        .limit(1)
      if (!row) {
        summary.missing++
        summary.rows.push({
          uid,
          decision: 'apply',
          applied: false,
          error: '池内无此 uid(未导入?)',
        })
        continue
      }
      // 池内明文解不出(密钥轮换/坏密文)时当作"票不同"走 apply,让客户端票覆盖坏密文
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
        clientToken: acc.token,
        clientRefreshToken: typeof acc.refreshToken === 'string' ? acc.refreshToken : null,
        clientExpiresAt: parseIso(acc.expiresAt),
        clientRefreshExpiresAt: parseIso(acc.refreshExpiresAt),
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
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(final.next.token),
          ...(final.next.refreshToken !== null
            ? { refreshTokenEnc: encryptField(final.next.refreshToken) }
            : {}),
          tokenExpiresAt: final.next.tokenExpiresAt,
          refreshExpiresAt: final.next.refreshExpiresAt,
          // 签到侧按 cred_version 防降级:不涨版本,新票永远推不过去
          credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(aiRelayAccountPool.providerCode, 'trae'), eq(aiRelayAccountPool.uid, uid)))
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
  let summary: SyncSummary
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

export const __test__ = { decideSync, parseIso, parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
