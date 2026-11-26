// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包客户端会话回灌落库(2026-11-26 补缺)—— 只更新 cookiesEnc / tokenEnc / credVersion,
 * 绝不碰 healthStatus / tempUnschedulable / refreshFailureCount / lastErrorMessage。
 *
 * 为什么不能复用通用 relay-client-session-sync.ts:豆包的真凭据是整包 cookiesEnc,
 * 通用腿只写一个 token 列 ⇒ 券面看似刷新,转发适配器仍拿旧 cookies。本文件专门整包回灌。
 *
 * 上游 = scripts/sync-doubao-client-session.mjs(读本机 Cookies、服务端验票后 stdin 送入)。
 * 退出码:0 全部处理完(含 skip)/ 1 有行写入失败 / 2 参数·输入·环境未判定。
 * 任何输出面不得含凭据明文。
 */
import { createHash } from 'node:crypto'
import { resolve as resolvePath, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { and, eq, inArray, sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { encryptField, decryptField } = await import('../src/utils/crypto.js')
const { db } = await import('../src/db/index.js')
const { chooseSyncTargetRow } = await import('../src/services/relay-session-sync-target.js')
const { resolveImportAccountUid, importAccounts } =
  await import('../src/services/relay-account-pool-service.js')
const traeSync = await import('./relay-trae-session-sync.js')
const touchClientHeartbeat = traeSync.touchClientHeartbeat
const { describeAutoImportOwner, resolveAutoImportOwner } =
  await import('./relay-session-autoimport-owner.js')
import type { ImportAccountInput } from '../src/services/relay-account-pool-service.js'

interface RowOutcome {
  uid: string
  decision: string
  applied: boolean
  error?: string
}

export interface DoubaoSyncSummary {
  ok: boolean
  dryRun: boolean
  providerCode: 'doubao'
  total: number
  applied: number
  skipped: number
  missing: number
  failed: number
  imported: number
  heartbeat: number
  rows: RowOutcome[]
}

type CookieLike = Record<string, unknown>

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** cookie 名的唯一读点:跨界载荷带 name,内部条目带 key */
function cookieNameOf(c: CookieLike): string {
  return asText(c.name) || asText(c.key)
}

/**
 * 整包 cookie 指纹:只取 name/host/value 三元组并排序。
 * 排序是刻意的 —— Cookie 库的行序不是账号身份,换一行序不应被读成换票。
 */
export function normalizeDoubaoCookieBundle(cookies: unknown): Array<{
  name: string
  host: string
  value: string
}> {
  if (!Array.isArray(cookies)) return []
  return cookies
    .map((c) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) return null
      const rec = c as CookieLike
      const name = cookieNameOf(rec)
      const value = asText(rec.value)
      if (!name || !value) return null
      return { name, host: asText(rec.host), value }
    })
    .filter((v): v is { name: string; host: string; value: string } => v !== null)
    .sort((a, b) =>
      `${a.host}\u0000${a.name}\u0000${a.value}`.localeCompare(
        `${b.host}\u0000${b.name}\u0000${b.value}`,
      ),
    )
}

export function doubaoBundleFingerprint(cookies: unknown): string {
  const rows = normalizeDoubaoCookieBundle(cookies)
  if (rows.length === 0) return ''
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

function poolBundleFingerprint(cookiesEnc: string | null): string {
  if (!cookiesEnc) return ''
  try {
    return doubaoBundleFingerprint(JSON.parse(decryptField(cookiesEnc)))
  } catch {
    return ''
  }
}

function parseArgs(argv: string[]): {
  stdin: boolean
  dryRun: boolean
  json: boolean
  provider: string | null
  error: string | null
} {
  const options = {
    stdin: false,
    dryRun: false,
    json: false,
    provider: null as string | null,
    error: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? ''
    if (a === '--stdin') options.stdin = true
    else if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a.startsWith('--provider=')) options.provider = a.slice('--provider='.length).trim()
    else if (a === '--provider') {
      options.provider = (argv[i + 1] ?? '').trim()
      i++
    } else if (a === '--') continue
    else options.error = `未知参数: ${a}`
  }
  if (options.provider && options.provider !== 'doubao')
    options.error = `豆包回灌腿只认 --provider=doubao(实得 ${options.provider})`
  if (!options.stdin && !options.error) options.error = '必须 --stdin(凭据经标准输入,不落盘)'
  return options
}

export async function runSync(payloadText: string, dryRun: boolean): Promise<DoubaoSyncSummary> {
  let payload: {
    accounts?: unknown
    clientActiveAt?: string | null
    providerCode?: string
  }
  try {
    payload = JSON.parse(payloadText) as typeof payload
  } catch {
    throw new Error('stdin 不是合法 JSON(未判定)')
  }
  if (String(payload.providerCode ?? 'doubao') !== 'doubao') {
    throw new Error('providerCode 必须是 doubao(未判定)')
  }
  if (!Array.isArray(payload.accounts)) throw new Error('accounts 必须是数组(未判定)')

  const summary: DoubaoSyncSummary = {
    ok: true,
    dryRun,
    providerCode: 'doubao',
    total: payload.accounts.length,
    applied: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    imported: 0,
    heartbeat: 0,
    rows: [],
  }

  const candidateUids = (payload.accounts as unknown[])
    .map((a) =>
      resolveImportAccountUid('doubao', (a && typeof a === 'object' ? a : {}) as ImportAccountInput),
    )
    .filter((u): u is string => typeof u === 'string' && u !== '')
  const candidateRows =
    candidateUids.length > 0
      ? await db
          .select()
          .from(aiRelayAccountPool)
          .where(
            and(
              eq(aiRelayAccountPool.providerCode, 'doubao'),
              inArray(aiRelayAccountPool.uid, candidateUids),
            ),
          )
      : []
  const rowsByUid = new Map<string, typeof candidateRows>()
  for (const r of candidateRows) {
    const list = rowsByUid.get(r.uid) ?? []
    list.push(r)
    rowsByUid.set(r.uid, list)
  }
  const targetOf = (uid: string) => chooseSyncTargetRow(rowsByUid.get(uid) ?? [])

  summary.heartbeat = await touchClientHeartbeat(
    candidateUids.flatMap((uid) => {
      const t = targetOf(uid)
      return t.kind === 'row' ? [t.row.id] : []
    }),
    payload.clientActiveAt ?? null,
    dryRun,
  )

  for (const raw of payload.accounts as unknown[]) {
    const account = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const resolvedUid = resolveImportAccountUid(
      'doubao',
      account as ImportAccountInput,
    )
    // --uid 是人工切号后点名目标行的唯一出口;它只改目标行,不改 cookie 推导出的账号身份
    const namedUid = asText(account.targetUid)
    const uid = namedUid || resolvedUid || ''
    try {
      const cookies = normalizeDoubaoCookieBundle(account.cookies)
      const fingerprint = doubaoBundleFingerprint(cookies)
      if (!uid || !fingerprint) {
        summary.failed++
        summary.rows.push({
          uid: uid || '(unknown)',
          decision: 'apply',
          applied: false,
          error: '稳定 uid 或整包 cookies 缺失(未判定,不猜)',
        })
        continue
      }
      const token = asText(account.token) || cookies[0]?.value || ''
      if (!token) {
        summary.failed++
        summary.rows.push({
          uid,
          decision: 'apply',
          applied: false,
          error: '主票为空(未判定)',
        })
        continue
      }
      const target = targetOf(uid)
      if (target.kind === 'ambiguous') {
        summary.failed++
        summary.rows.push({
          uid,
          decision: 'apply',
          applied: false,
          error: `同 uid 有 ${target.count} 行且无运营池行,归属未判定(不猜)`,
        })
        continue
      }
      if (target.kind === 'none') {
        if (namedUid) {
          summary.failed++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: '点名 --uid 在池内无行,拒自动新建(不猜)',
          })
          continue
        }
        let autoOwner: ReturnType<typeof resolveAutoImportOwner>
        try {
          autoOwner = resolveAutoImportOwner()
        } catch (e) {
          summary.failed++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: `归属判据装载失败(未判定): ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`,
          })
          continue
        }
        if (dryRun) {
          summary.imported++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: `dry-run 未写(将落:${describeAutoImportOwner(autoOwner)})`,
          })
          continue
        }
        const res = await importAccounts(
          'doubao',
          [account as ImportAccountInput],
          autoOwner.ownerUserId,
        )
        const item = res.items[0]
        if (item && (item.status === 'imported' || item.status === 'updated')) {
          summary.imported++
          summary.rows.push({ uid, decision: 'auto-import', applied: true })
        } else {
          summary.failed++
          summary.rows.push({
            uid,
            decision: 'auto-import',
            applied: false,
            error: (item?.reason ?? '导入未回报条目').slice(0, 200),
          })
        }
        continue
      }

      const row = target.row
      let poolToken: string | null = null
      try {
        poolToken = row.tokenEnc ? decryptField(row.tokenEnc) : null
      } catch {
        poolToken = null
      }
      const poolFingerprint = poolBundleFingerprint(row.cookiesEnc)
      if (poolFingerprint === fingerprint && poolToken === token) {
        summary.skipped++
        summary.rows.push({ uid, decision: 'same-bundle', applied: false })
        continue
      }
      if (dryRun) {
        summary.applied++
        summary.rows.push({ uid, decision: 'cookie-bundle-changed', applied: false, error: 'dry-run 未写' })
        continue
      }
      await db
        .update(aiRelayAccountPool)
        .set({
          tokenEnc: encryptField(token),
          cookiesEnc: encryptField(JSON.stringify(cookies)),
          credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(aiRelayAccountPool.id, row.id))
      summary.applied++
      summary.rows.push({ uid, decision: 'cookie-bundle-changed', applied: true })
    } catch (e) {
      summary.failed++
      summary.rows.push({
        uid: uid ?? '(unknown)',
        decision: 'apply',
        applied: false,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      })
    }
  }
  if (summary.failed > 0) summary.ok = false
  return summary
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
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
    process.stderr.write(`❌ 读 stdin 失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (payloadText.trim() === '') {
    process.stderr.write('❌ stdin 为空(未判定)\n')
    return 2
  }
  let summary: DoubaoSyncSummary
  try {
    summary = await runSync(payloadText, options.dryRun)
  } catch (e) {
    process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (options.json) process.stdout.write(`${JSON.stringify(summary)}\n`)
  else {
    process.stderr.write(
      `回灌完成: 平台=doubao applied=${summary.applied} skipped=${summary.skipped} ` +
        `missing=${summary.missing} imported=${summary.imported} 心跳=${summary.heartbeat} ` +
        `failed=${summary.failed}${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
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

export const __test__ = { parseArgs, normalizeDoubaoCookieBundle, doubaoBundleFingerprint }
