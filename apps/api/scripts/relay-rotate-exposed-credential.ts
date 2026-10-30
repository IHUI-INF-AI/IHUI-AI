// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 暴露凭据轮换执行器(2026-10-30 立,goal-b35 s6)—— 号池侧的「主动换掉已暴露值」那一条腿。
 *
 * 立因:本仓早有取票与续票能力(scripts/lib/trae-auth-extract.mjs 取、relay-account-pool-scheduler
 * 的 refreshOne 续、sync-trae-client-session.mjs 回灌),但续票是**被动**的(撞 401 / 临期才换)。
 * 2026-10-29 提交 34036e6a83d0934b277158e7b855036e0dca3d7c 摘除了两枚误入库的工具会话导出附件
 * (含凭据形态行,历史 blob 仍在)——在「凭据已暴露」这一触发条件下,没有任何腿主动把它换掉:
 * 泄露的旧值在被动的下一次 401 之前一直是活的。本文件补的就是这一格。
 *
 * 分工(§0.6 单一真相源,本文件零复算):
 * - 换票与回写池 = import `relay-account-pool-scheduler.refreshOne`(凭证四列 + credVersion+1
 *   + 失败计数/摘除口径全在那一份里,本文件不写第二条 UPDATE);
 * - 解池内密文 = import `relay-account-pool-service.decryptAccountCredentials`;
 * - 指纹 = import `scripts/lib/trae-auth-extract.fingerprintOf`(与当初导入号池时同一把尺,
 *   否则清单里的 sha256 前缀对不上池内现值);
 * - 「旧值是否还被接受」= 按既有适配器契约调用 `adapter.checkHealth`(accessToken 型,只读)
 *   / `adapter.refreshToken`(refreshToken 型),拒收与否交给 `adapter.isAuthError`(同一把尺)。
 *   本文件不自拼任何上游请求。
 *
 * 编排上游 = `scripts/rotate-exposed-upstream-credentials.mjs`(读清单 → 喂 stdin → 落留痕)。
 * 跑法:`pnpm --filter @ihui/api exec tsx scripts/relay-rotate-exposed-credential.ts --stdin --json`
 *
 * 安全红线(票面):凭据明文**只在内存里存在**,用于 ①与清单 fp 比对 ②轮换后打上游自证;
 * 任何输出行不含 token/rt/密文(只给 uid/name/fp/长度/决策/错误类别)。
 *
 * 模式(stdin JSON):
 *   {"mode":"list-pool"}                                   → 只报池内现值的 fp(零写入)
 *   {"mode":"rotate","dryRun":bool,"entries":[{id,provider,kind,fp}]}
 * 退出码:0 全部判定为已死/无命中 / 1 假轮换或换票失败 / 2 未判定(输入取不到、旧值无法自证、库连不上)。
 */
import { resolve as resolvePath, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
const ROOT = resolvePath(API_DIR, '..', '..')

// .env 必须早于服务模块导入(它们在建连/加密时读环境)
import { config } from 'dotenv'
config({ path: resolvePath(API_DIR, '.env') })

const { aiRelayAccountPool } = await import('@ihui/database')
const { db } = await import('../src/db/index.js')
const { eq } = await import('drizzle-orm')
const sched = await import('../src/services/relay-account-pool-scheduler.js')
const poolSvc = await import('../src/services/relay-account-pool-service.js')
const adapters = await import('../src/services/relay-upstream-adapters.js')
const { registerAllRelayAdapters } = await import('../src/services/upstream-adapters/index.js')
const traeExtract = await import(
  pathToFileURL(join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
)

/** 与导入侧同一把尺:sha256 前 12 位 */
const fingerprintOf: (v: unknown) => string = traeExtract.fingerprintOf

/** 池行类型与解密后的凭证形状(全部取自既有出口,不在本文件复述字段) */
type PoolRowT = typeof aiRelayAccountPool.$inferSelect
type CredT = ReturnType<typeof poolSvc.decryptAccountCredentials>

export type ExposedKind = 'accessToken' | 'refreshToken'
export type Decision =
  | 'rotated-dead'
  | 'rotated-alive'
  | 'rotate-failed'
  | 'absent'
  | 'dry-run-matched'
  | 'no-adapter'
  | 'unjudged'

export interface ExposedEntry {
  id: string
  provider: string
  kind: ExposedKind
  fp: string
}

export interface RotateRow {
  id: string
  provider: string
  kind: ExposedKind
  fp: string
  uid: string | null
  name: string | null
  decision: Decision
  poolFpBefore: string | null
  poolFpAfter: string | null
  /** true = 上游仍接受旧值(假轮换);false = 明确拒收(旧值已死);null = 未判定 */
  oldAccepted: boolean | null
  errorKind: string | null
}

export interface RotateSummary {
  ok: boolean
  mode: string
  dryRun: boolean
  total: number
  matched: number
  rotated: number
  deadVerified: number
  aliveSuspect: number
  absent: number
  unjudged: number
  failed: number
  rows: RotateRow[]
}

export interface PoolRow {
  uid: string | null
  name: string | null
  provider: string
  enabled: boolean
  healthStatus: string | null
  tokenFp: string | null
  refreshTokenFp: string | null
  tokenExpiresAt: string | null
}

/** fp 归一:小写十六进制前缀;非法形态一律 null(不猜、不拿坏行免掉任何东西) */
export function normalizeFp(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  return /^[0-9a-f]{8,64}$/.test(s) ? s : null
}

export function normalizeKind(raw: unknown): ExposedKind | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'refreshtoken' || s === 'rt') return 'refreshToken'
  if (s === 'accesstoken' || s === 'token' || s === 'access_token') return 'accessToken'
  return null
}

/** 池内现值 → 该 kind 的明文(解不出 ⇒ null,由调用方落未判定而不是落"没命中") */
export function plainOf(
  kind: ExposedKind,
  credentials: { token: string; refreshToken: string | null },
): string | null {
  if (kind === 'refreshToken') return credentials.refreshToken || null
  return credentials.token || null
}

/** 适配器探针的形状(只声明本文件用到的三个契约方法,不复制适配器实现) */
export interface ProbeAdapter {
  checkHealth?: (
    ctx: AdapterCtx,
    opts?: unknown,
  ) => Promise<{
    ok?: boolean
    authFailed?: boolean
    indeterminate?: boolean
  }>
  refreshToken?: (ctx: AdapterCtx, opts?: unknown) => Promise<unknown>
  isAuthError?: (e: unknown) => boolean
}

export interface AdapterCtx {
  row: PoolRowT
  credentials: CredT
}

/**
 * 旧值活性自证(票面"验证旧值已不再被接受"的唯一凭据)。
 *
 * - accessToken 型 → `adapter.checkHealth`:Trae 走 GET model_list(纯读,无副作用),
 *   401/403 ⇒ authFailed=明确拒收;ok=仍被接受;其余=未判定。
 * - refreshToken 型 → `adapter.refreshToken`:ExchangeToken 是一次**轮换尝试**,
 *   明确拒收(isAuthError)⇒ 旧 rt 已死;返回了新票 ⇒ 旧 rt 还活着 = 假轮换;
 *   网络/5xx ⇒ 未判定(绝不把"没量到"写成"已死",§0.3)。
 * 两种都不在本文件里自拼请求:全部经既有适配器契约出口。
 */
export async function probeOldValue(
  adapter: ProbeAdapter,
  row: PoolRowT,
  credentials: CredT,
  kind: ExposedKind,
  oldValue: string,
): Promise<{ accepted: boolean | null; errorKind: string | null }> {
  // 只把"旧的那一维"换成暴露值,其余维度清空,避免探针顺带验的是别的凭据
  const probeCtx: AdapterCtx = {
    row,
    credentials: {
      ...credentials,
      cookies: [],
      token: kind === 'accessToken' ? oldValue : '',
      refreshToken: kind === 'refreshToken' ? oldValue : null,
    },
  }
  if (kind === 'accessToken') {
    if (!adapter.checkHealth) return { accepted: null, errorKind: 'no-checkHealth' }
    try {
      const h = await adapter.checkHealth(probeCtx)
      if (h?.authFailed === true) return { accepted: false, errorKind: null }
      if (h?.ok === true) return { accepted: true, errorKind: null }
      return { accepted: null, errorKind: 'health-indeterminate' }
    } catch (e) {
      return { accepted: null, errorKind: `health-threw:${errName(e)}` }
    }
  }
  if (!adapter.refreshToken) return { accepted: null, errorKind: 'no-refreshToken' }
  try {
    const got = await adapter.refreshToken(probeCtx)
    return got ? { accepted: true, errorKind: null } : { accepted: null, errorKind: 'refresh-null' }
  } catch (e) {
    if (adapter.isAuthError?.(e) === true) return { accepted: false, errorKind: null }
    return { accepted: null, errorKind: `refresh-threw:${errName(e)}` }
  }
}

function errName(e: unknown): string {
  const name = e instanceof Error ? e.name : 'Unknown'
  const status = (e as { statusCode?: unknown })?.statusCode
  return typeof status === 'number' ? `${name}/${status}` : String(name)
}

export async function listPool(provider?: string | null): Promise<PoolRow[]> {
  const rows = provider
    ? await db
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.providerCode, provider))
    : await db.select().from(aiRelayAccountPool)
  const out: PoolRow[] = []
  for (const row of rows) {
    let cred: CredT
    try {
      cred = poolSvc.decryptAccountCredentials(row)
    } catch {
      cred = { token: '', refreshToken: null, cookies: [], secrets: {} }
    }
    out.push({
      uid: row.uid ?? null,
      name: row.name ?? null,
      provider: row.providerCode,
      enabled: row.isEnabled === true,
      healthStatus: row.healthStatus ?? null,
      tokenFp: cred.token ? fingerprintOf(cred.token) : null,
      refreshTokenFp: cred.refreshToken ? fingerprintOf(cred.refreshToken) : null,
      tokenExpiresAt: row.tokenExpiresAt ? new Date(row.tokenExpiresAt).toISOString() : null,
    })
  }
  return out
}

export async function runRotate(entries: ExposedEntry[], dryRun: boolean): Promise<RotateSummary> {
  registerAllRelayAdapters()
  const summary: RotateSummary = {
    ok: true,
    mode: 'rotate',
    dryRun,
    total: entries.length,
    matched: 0,
    rotated: 0,
    deadVerified: 0,
    aliveSuspect: 0,
    absent: 0,
    unjudged: 0,
    failed: 0,
    rows: [],
  }
  // 逐条对账:清单 fp ↔ 池内现值 fp(同一把尺 fingerprintOf)
  const poolRows = await db.select().from(aiRelayAccountPool)
  for (const entry of entries) {
    const base: RotateRow = {
      id: entry.id,
      provider: entry.provider,
      kind: entry.kind,
      fp: entry.fp,
      uid: null,
      name: null,
      decision: 'absent',
      poolFpBefore: null,
      poolFpAfter: null,
      oldAccepted: null,
      errorKind: null,
    }
    if (!entry.fp || !entry.provider || !entry.kind) {
      summary.unjudged++
      summary.rows.push({ ...base, decision: 'unjudged', errorKind: '清单行缺 provider/kind/fp' })
      continue
    }
    let hit: PoolRowT | null = null
    let oldValue: string | null = null
    for (const row of poolRows) {
      if (row.providerCode !== entry.provider) continue
      let cred: CredT
      try {
        cred = poolSvc.decryptAccountCredentials(row)
      } catch {
        continue // 密文解不出 ⇒ 这条号判不了,不算命中也不算未命中(下面兜未判定)
      }
      const plain = plainOf(entry.kind, cred)
      if (plain && fingerprintOf(plain) === entry.fp) {
        hit = row
        oldValue = plain
        break
      }
    }
    if (!hit || oldValue === null) {
      summary.absent++
      summary.rows.push(base)
      continue
    }
    summary.matched++
    base.uid = hit.uid ?? null
    base.name = hit.name ?? null
    base.poolFpBefore = entry.fp
    if (dryRun) {
      summary.rows.push({ ...base, decision: 'dry-run-matched' })
      continue
    }
    const adapter = adapters.getRelayAdapter(hit.providerCode)
    if (!adapter) {
      summary.failed++
      summary.rows.push({
        ...base,
        decision: 'no-adapter',
        errorKind: `无适配器:${hit.providerCode}`,
      })
      continue
    }
    // 1) 换票 + 回灌池:全部走既有出口(refreshOne 自己写凭证四列与 credVersion+1)
    const rotated = await sched.refreshOne(hit)
    if (!rotated) {
      summary.failed++
      summary.rows.push({ ...base, decision: 'rotate-failed', errorKind: 'refreshOne=false' })
      continue
    }
    summary.rotated++
    // 2) 回读池内新值(自证"池里已不住着暴露值")
    const [after] = await db
      .select()
      .from(aiRelayAccountPool)
      .where(eq(aiRelayAccountPool.id, hit.id))
      .limit(1)
    if (!after) {
      summary.unjudged++
      summary.rows.push({ ...base, decision: 'unjudged', errorKind: '换票后回读不到该行' })
      continue
    }
    let credAfter: CredT
    try {
      credAfter = poolSvc.decryptAccountCredentials(after)
    } catch {
      summary.unjudged++
      summary.rows.push({ ...base, decision: 'unjudged', errorKind: '换票后密文解不出' })
      continue
    }
    const plainAfter = plainOf(entry.kind, credAfter)
    base.poolFpAfter = plainAfter ? fingerprintOf(plainAfter) : null
    if (base.poolFpAfter === entry.fp) {
      // 池里仍住着暴露值 ⇒ 换票名义成功而值没变,判红点名
      summary.aliveSuspect++
      summary.rows.push({
        ...base,
        decision: 'rotated-alive',
        oldAccepted: true,
        errorKind: '池内新值指纹仍等于暴露值',
      })
      continue
    }
    // 3) 旧值自证:上游必须不再接受(票面要求,只换不验 = 没做)
    const probe = await probeOldValue(
      adapter as unknown as ProbeAdapter,
      after,
      credAfter,
      entry.kind,
      oldValue,
    )
    if (probe.accepted === false) {
      summary.deadVerified++
      summary.rows.push({ ...base, decision: 'rotated-dead', oldAccepted: false })
    } else if (probe.accepted === true) {
      summary.aliveSuspect++
      summary.rows.push({
        ...base,
        decision: 'rotated-alive',
        oldAccepted: true,
        errorKind: probe.errorKind,
      })
    } else {
      summary.unjudged++
      summary.rows.push({
        ...base,
        decision: 'unjudged',
        oldAccepted: null,
        errorKind: probe.errorKind,
      })
    }
  }
  summary.ok = summary.aliveSuspect === 0 && summary.failed === 0 && summary.unjudged === 0
  return summary
}

export function exitCodeOf(summary: RotateSummary): number {
  if (summary.aliveSuspect > 0 || summary.failed > 0) return 1
  if (summary.unjudged > 0) return 2
  return 0
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

export async function main(argv: string[]): Promise<number> {
  const asText = argv.join(' ')
  if (/-h\b|--help/.test(asText)) {
    process.stdout.write(
      '用法: echo <JSON> | tsx scripts/relay-rotate-exposed-credential.ts --stdin --json [--dry-run]\n' +
        '模式由 stdin 决定:{"mode":"list-pool"} 或 {"mode":"rotate","entries":[{id,provider,kind,fp}]}\n' +
        '编排上游 = scripts/rotate-exposed-upstream-credentials.mjs(本文件不单独面向人工)。\n',
    )
    return 0
  }
  if (!argv.includes('--stdin')) {
    process.stderr.write('❌ 缺 --stdin(入口必须由编排上游经 stdin 传清单;未判定)\n')
    return 2
  }
  let req: { mode?: string; dryRun?: boolean; entries?: unknown[]; provider?: string }
  try {
    req = JSON.parse(await readStdin())
  } catch (e) {
    process.stderr.write(`❌ stdin 不是合法 JSON(未判定):${errName(e)}\n`)
    return 2
  }
  const useJson = argv.includes('--json')
  try {
    if (req.mode === 'list-pool') {
      const rows = await listPool(typeof req.provider === 'string' ? req.provider : null)
      const payload = { ok: true, mode: 'list-pool', total: rows.length, rows }
      process.stdout.write(`${JSON.stringify(payload)}\n`)
      return 0
    }
    if (req.mode !== 'rotate') {
      process.stderr.write(`❌ mode 必须是 list-pool|rotate(未判定):${String(req.mode)}\n`)
      return 2
    }
    const entries: ExposedEntry[] = []
    for (const raw of Array.isArray(req.entries) ? req.entries : []) {
      const kind = normalizeKind((raw as { kind?: unknown })?.kind)
      const fp = normalizeFp((raw as { fp?: unknown })?.fp)
      const provider = String((raw as { provider?: unknown })?.provider ?? '').trim()
      const id = String((raw as { id?: unknown })?.id ?? '').trim()
      if (!kind || !fp || !provider || !id) {
        entries.push({
          id: id || '(无 id)',
          provider: provider || '(无 provider)',
          kind: kind ?? 'accessToken',
          fp: fp ?? '',
        })
        continue
      }
      entries.push({ id, provider, kind, fp })
    }
    const summary = await runRotate(entries, argv.includes('--dry-run') || req.dryRun === true)
    if (useJson) process.stdout.write(`${JSON.stringify(summary)}\n`)
    else {
      process.stderr.write(
        `轮换:matched=${summary.matched} rotated=${summary.rotated} dead=${summary.deadVerified} ` +
          `alive=${summary.aliveSuspect} absent=${summary.absent} unjudged=${summary.unjudged} ` +
          `failed=${summary.failed}${summary.dryRun ? '(dry-run 未写)' : ''}\n`,
      )
      for (const r of summary.rows)
        process.stderr.write(
          `  ${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} ⇒ ${r.decision}\n`,
        )
    }
    return exitCodeOf(summary)
  } catch (e) {
    process.stderr.write(`❌ 执行器自身异常(未判定):${errName(e)}\n`)
    return 2
  }
}

export const __test__ = {
  normalizeFp,
  normalizeKind,
  plainOf,
  probeOldValue,
  exitCodeOf,
  runRotate,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
