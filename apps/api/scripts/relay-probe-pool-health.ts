// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池全量可用性探针(2026-11-12 立,测"其他平台的号是否都可用可切")。
 *
 * 背景:trae 死号救援收尾后,机主要求把 raccoon/workbuddy/qoder 等其余平台的号
 * 逐一实测是否还可用可切 —— 不能只信号池里现有的 healthStatus(那是 sweep 巡检
 * 上一次落的旧值,api 进程没跑 worker 时它就是陈旧的)。本脚本对号池**每一行**真实
 * 调一次上游 `checkHealth`(与 sweep 定级、管理面按需查余额同一把出口),逐号给出
 * 当下结论,不依赖任何缓存态。
 *
 * 与 relay-live-probe 的区别:那个只覆盖 trae/workbuddy/codearts 三平台且用硬编码
 * 凭据 env;本脚本遍历号池全部账号、用号池里自己的凭据逐号实测,覆盖全平台。
 *
 * 纪律(与 AGENTS §0.3/§0.6 一致):
 *  - 判据一律复用适配器 checkHealth / healthStatusOf / isRefreshableProviderCode,不另写第二份;
 *  - 默认**只读**:只打印真实结论,不写库、不改动 healthStatus(测完先看报告再决定);
 *    --write 才把结论回写(ok→healthy / authFailed→down+到期收敛),与 sweep 同口径;
 *  - 单号异常(超时/网络/形状)不中断整轮,记 indeterminate 继续下一枚;
 *  - 输出零凭据明文(只回 uid/名称/结论/过期态)。
 *
 * 用法:
 *   node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/relay-probe-pool-health.ts [--provider <code>] [--write] [--json] [--concurrency N]
 */
import { dirname, resolve as resolvePath, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config as dotenvConfig } from 'dotenv'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')
dotenvConfig({ path: resolvePath(API_DIR, '.env') })

const { and, eq } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { db, dbRead } = await import(pathToFileURL(join(API_DIR, 'src', 'db', 'index.js')).href)
const { registerAllRelayAdapters } = await import(
  pathToFileURL(join(API_DIR, 'src', 'services', 'upstream-adapters', 'index.js')).href
)
const { getRelayAdapter, isRefreshableProviderCode } = await import(
  pathToFileURL(join(API_DIR, 'src', 'services', 'relay-upstream-adapters.js')).href
)
const { decryptAccountCredentials } = await import(
  pathToFileURL(join(API_DIR, 'src', 'services', 'relay-account-pool-service.js')).href
)
const { resolveAccountProxyUrl } = await import(
  pathToFileURL(join(API_DIR, 'src', 'services', 'relay-proxy-pool.js')).href
)
const { healthStatusOf } = await import(
  pathToFileURL(join(API_DIR, 'src', 'services', 'relay-account-pool-scheduler.js')).href
)

/** 单号探测结论 */
interface ProbeResult {
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  /** 当前库内 healthStatus(测前旧值,用于对照) */
  before: string | null
  /** checkHealth 实测结论 */
  ok: boolean | null // null = 未判定(异常/无适配器)
  authFailed: boolean
  indeterminate: boolean
  error: string | null
  /** token 是否已过期(仅本机现值) */
  tokenExpired: boolean
  /** 是否有续期能力(可自救) */
  refreshable: boolean
  /** 写回后新的 healthStatus(仅 --write 时有意义) */
  after: string | null
}

interface PlatformSummary {
  providerCode: string
  total: number
  available: number
  dead: number
  indeterminate: number
  disabled: number
}

function parseArgs(argv: string[]): { provider?: string; write: boolean; json: boolean; concurrency: number } {
  let provider: string | undefined
  let write = false
  let json = false
  let concurrency = 4
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--write') write = true
    else if (a === '--json') json = true
    else if (a === '--provider') provider = argv[++i]
    else if (a === '--concurrency') {
      const n = Number(argv[++i])
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(n, 16)
    }
  }
  return { provider, write, json, concurrency }
}

function fmtDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString() : '-'
}

/** 对单枚账号做真实 checkHealth 探测(异常一律转 indeterminate,不抛、不中断) */
async function probeOne(row: typeof aiRelayAccountPool.$inferSelect): Promise<ProbeResult> {
  const providerCode = row.providerCode
  const adapter = getRelayAdapter(providerCode)
  const base: ProbeResult = {
    providerCode,
    uid: row.uid ?? '',
    name: row.name ?? '',
    isEnabled: row.isEnabled === true,
    before: row.healthStatus ?? null,
    ok: null,
    authFailed: false,
    indeterminate: false,
    error: null,
    tokenExpired: row.tokenExpiresAt != null && new Date(row.tokenExpiresAt).getTime() < Date.now(),
    refreshable: isRefreshableProviderCode(providerCode),
    after: null,
  }
  if (!adapter) {
    base.indeterminate = true
    base.error = '平台适配器未注册'
    return base
  }
  let credentials
  try {
    credentials = decryptAccountCredentials(row)
  } catch (e) {
    base.indeterminate = true
    base.error = `凭据解密失败:${e instanceof Error ? e.message : String(e)}`
    return base
  }
  const proxyUrl = resolveAccountProxyUrl(row.proxyUrl)
  try {
    const outcome = await adapter.checkHealth({ row, credentials }, { proxyUrl })
    base.ok = outcome.ok
    base.authFailed = outcome.authFailed === true
    base.indeterminate = outcome.ok !== true && outcome.indeterminate === true
    if (!outcome.ok) base.error = (outcome.error ?? '健康检查未通过').slice(0, 200)
  } catch (e) {
    base.indeterminate = true
    base.error = `探测异常:${e instanceof Error ? e.message : String(e)}`
  }
  return base
}

/** 写回结论(与 sweep 同口径:ok→healthy;authFailed→down+到期收敛;indeterminate 保留 unknown) */
async function writeBack(r: ProbeResult, rowId: string, now: Date): Promise<void> {
  const health = healthStatusOf({ ok: r.ok === true, indeterminate: r.indeterminate })
  r.after = health
  await db
    .update(aiRelayAccountPool)
    .set({
      healthStatus: health,
      healthCheckedAt: now,
      lastErrorMessage: r.ok === true ? null : (r.error ?? '健康检查失败').slice(0, 500),
      updatedAt: now,
      ...(r.ok === false && r.authFailed ? { tokenExpiresAt: now } : {}),
    })
    .where(eq(aiRelayAccountPool.id, rowId))
    .catch(() => {})
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  registerAllRelayAdapters()

  const rows = (await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(args.provider ? and(eq(aiRelayAccountPool.providerCode, args.provider)) : undefined)
    .orderBy(aiRelayAccountPool.providerCode, aiRelayAccountPool.uid)) as (typeof aiRelayAccountPool.$inferSelect)[]

  if (rows.length === 0) {
    process.stderr.write(
      args.provider ? `号池 ${args.provider} 0 行 —— 没有可测的号\n` : '号池 0 行 —— 先用 relay-account-pool 导入\n',
    )
    return 0
  }

  // 并发探测(手写 worker pool,不引依赖)
  const results: ProbeResult[] = new Array(rows.length)
  let cursor = 0
  const now = new Date()
  const runners = Array.from({ length: Math.min(args.concurrency, rows.length) }, async () => {
    while (cursor < rows.length) {
      const idx = cursor++
      const row = rows[idx]
      const r = await probeOne(row)
      results[idx] = r
      if (args.write) await writeBack(r, row.id, now)
    }
  })
  await Promise.all(runners)

  // 汇总
  const byProvider = new Map<string, PlatformSummary>()
  for (const r of results) {
    let s = byProvider.get(r.providerCode)
    if (!s) {
      s = { providerCode: r.providerCode, total: 0, available: 0, dead: 0, indeterminate: 0, disabled: 0 }
      byProvider.set(r.providerCode, s)
    }
    s.total++
    if (!r.isEnabled) s.disabled++
    if (r.ok === true) s.available++
    else if (r.indeterminate) s.indeterminate++
    else s.dead++
  }

  const dead = results.filter((r) => r.ok === false && !r.indeterminate)
  const indeterminate = results.filter((r) => r.indeterminate)
  const available = results.filter((r) => r.ok === true)

  const report = {
    asOf: now.toISOString(),
    total: results.length,
    available: available.length,
    dead: dead.length,
    indeterminate: indeterminate.length,
    wroteBack: args.write,
    platforms: [...byProvider.values()].sort((a, b) => a.providerCode.localeCompare(b.providerCode)),
    deadDetail: dead.map((r) => ({
      providerCode: r.providerCode,
      uid: r.uid,
      name: r.name,
      before: r.before,
      authFailed: r.authFailed,
      tokenExpired: r.tokenExpired,
      refreshable: r.refreshable,
      error: r.error,
    })),
    indeterminateDetail: indeterminate.map((r) => ({
      providerCode: r.providerCode,
      uid: r.uid,
      name: r.name,
      error: r.error,
    })),
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return 0
  }

  process.stdout.write(`号池可用性实测(取数时刻=${report.asOf}):\n`)
  process.stdout.write(
    `  全池 ${report.total} 枚 · 可用 ${report.available} · 死号 ${report.dead} · 未判定 ${report.indeterminate}` +
      `${args.write ? ' (已写回 healthStatus)' : ' (只读,未写库)'}\n`,
  )
  process.stdout.write('  按平台:\n')
  for (const s of report.platforms) {
    process.stdout.write(
      `    ${s.providerCode} 总=${s.total} 可用=${s.available} 死=${s.dead} 未判定=${s.indeterminate}` +
        `${s.disabled ? ` 未启用=${s.disabled}` : ''}\n`,
    )
  }
  if (dead.length > 0) {
    process.stdout.write('\n  ❌ 死号明细(凭据被上游拒收或明确失效):\n')
    for (const r of report.deadDetail) {
      process.stdout.write(
        `    ${r.providerCode}/${r.uid} ${r.name} 入库健康=${r.before ?? '-'} ` +
          `authFailed=${r.authFailed ? '是' : '否'} token过期=${r.tokenExpired ? '是' : '否'} ` +
          `可续期=${r.refreshable ? '是' : '否'} 原因=${(r.error ?? '-').slice(0, 80)}\n`,
      )
    }
  }
  if (indeterminate.length > 0) {
    process.stdout.write('\n  ⚠️ 未判定明细(探测异常/无端点,不代表失效):\n')
    for (const r of report.indeterminateDetail) {
      process.stdout.write(`    ${r.providerCode}/${r.uid} ${r.name} 原因=${(r.error ?? '-').slice(0, 80)}\n`)
    }
  }
  if (dead.length === 0 && indeterminate.length === 0) {
    process.stdout.write('\n  ✅ 全池实测无死号、无未判定 —— 所有号均可用。\n')
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
