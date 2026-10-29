// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池导入 CLI(2026-10-23 立)。
 *
 * 与 scripts/relay-account-pool.mjs 配套:后者负责"从 WorkBuddy 提取/读账号 JSON",
 * 本脚本负责落库。判据全部复用服务端实现(relay-account-format 的校验、
 * relay-account-pool-service 的 importAccounts),不抄第二份。
 *
 * 用法(在仓根):
 *   node scripts/relay-account-pool.mjs --from workbuddy
 *   node scripts/relay-account-pool.mjs --file accounts.json --provider trae
 *
 * 也可直接调用:
 *   cd apps/api && pnpm exec tsx scripts/relay-account-import.ts --file <json> --provider <code>
 *   ... --stdin              从标准输入读 JSON
 *   ... --dry-run            只校验与预检,不写库
 *   ... --no-health          导入后不做上游健康检查
 *   ... --json               输出机器可读摘要
 *
 * 安全:任何输出都不包含令牌明文;cookies/token 只在内存与加密落库之间流动。
 * 退出码:0 成功 / 1 校验不通过或全部失败 / 2 参数/读取/环境未判定。
 */
import { config } from 'dotenv'
import { resolve as resolvePath, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { RelayProviderCode } from '../src/services/relay-account-format.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于任何服务模块导入(它们在建连时读环境);动态导入以保证顺序
config({ path: resolvePath(API_DIR, '.env') })

const { eq, and } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { isRelayProviderCode, RELAY_PROVIDERS, validateAccountExport } =
  await import('../src/services/relay-account-format.js')
const { importAccounts, decryptAccountCredentials } =
  await import('../src/services/relay-account-pool-service.js')
const { db, dbRead } = await import('../src/db/index.js')
const { registerAllRelayAdapters } = await import('../src/services/upstream-adapters/index.js')
const { getRelayAdapter } = await import('../src/services/relay-upstream-adapters.js')
const { healthStatusOf } = await import('../src/services/relay-account-pool-scheduler.js')

interface CliOptions {
  stdin: boolean
  file: string | null
  providerCode: RelayProviderCode | null
  dryRun: boolean
  health: boolean
  json: boolean
}

const HELP = `账号池导入(服务端落库)

用法(推荐从仓根走编排器):
  node scripts/relay-account-pool.mjs --from workbuddy
  node scripts/relay-account-pool.mjs --file <accounts.json> --provider <${RELAY_PROVIDERS.join('|')}>

直接调用:
  pnpm exec tsx scripts/relay-account-import.ts (--file <json> | --stdin)
    [--provider <${RELAY_PROVIDERS.join('|')}>] [--dry-run] [--no-health] [--json]

输入:标准账号导出 JSON({accounts:[...]} 或裸数组);provider 可来自 --provider 或文件顶层 providerCode。
退出码:0 成功 / 1 校验不通过或全部失败 / 2 参数或环境未判定。`

function parseArgs(argv: string[]): {
  help: boolean
  options: CliOptions | null
  error: string | null
} {
  const options: CliOptions = {
    stdin: false,
    file: null,
    providerCode: null,
    dryRun: false,
    health: true,
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { help: true, options: null, error: null }
    else if (arg === '--stdin') options.stdin = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-health') options.health = false
    else if (arg === '--json') options.json = true
    else if (arg === '--file') options.file = argv[++i] ?? null
    else if (arg === '--provider') {
      const v = argv[++i] ?? ''
      if (!isRelayProviderCode(v)) {
        return {
          help: false,
          options: null,
          error: `不支持的平台: ${v}(可选 ${RELAY_PROVIDERS.join('|')})`,
        }
      }
      options.providerCode = v
    } else {
      return { help: false, options: null, error: `未知参数: ${arg}` }
    }
  }
  if (options.stdin && options.file) {
    return { help: false, options: null, error: '--stdin 与 --file 只能二选一' }
  }
  if (!options.stdin && !options.file) {
    return { help: false, options: null, error: '缺少输入:--file <json> 或 --stdin' }
  }
  return { help: false, options, error: null }
}

function readStdin(): string {
  return readFileSync(0, 'utf8')
}

export interface HealthOutcome {
  id: string
  uid: string
  ok: boolean
  /** true = 上游取不到判定依据(5xx/网络),状态保留 unknown,≠ 凭据失效 */
  indeterminate: boolean
  error: string | null
}

/** 导入后即时体检(单一实现:qoder 一键导入器直接复用,不写第二份) */
export async function runHealth(providerCode: string, uid: string): Promise<HealthOutcome | null> {
  const [row] = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.providerCode, providerCode), eq(aiRelayAccountPool.uid, uid)))
    .limit(1)
  if (!row) return null
  const adapter = getRelayAdapter(providerCode)
  if (!adapter) return { id: row.id, uid, ok: false, error: `平台 ${providerCode} 适配器未注册` }
  let outcome: { ok: boolean; error?: string; indeterminate?: boolean }
  try {
    outcome = await Promise.race([
      adapter.checkHealth(
        { row, credentials: decryptAccountCredentials(row) },
        { proxyUrl: row.proxyUrl ?? undefined },
      ),
      new Promise<{ ok: boolean; error: string; indeterminate: boolean }>((resolve) =>
        setTimeout(() => resolve({ ok: false, error: 'timeout 30s', indeterminate: true }), 30000),
      ),
    ])
  } catch (e) {
    outcome = {
      ok: false,
      indeterminate: true,
      error: e instanceof Error ? e.message.slice(0, 200) : String(e),
    }
  }
  const now = new Date()
  await db
    .update(aiRelayAccountPool)
    .set({
      // 未判定保留 unknown,不写 down(取不到 ≠ 失效)
      healthStatus: healthStatusOf(outcome),
      healthCheckedAt: now,
      lastErrorMessage: outcome.ok ? null : (outcome.error ?? '健康检查失败').slice(0, 500),
      consecutiveFailures: outcome.ok ? 0 : row.consecutiveFailures,
      updatedAt: now,
    })
    .where(eq(aiRelayAccountPool.id, row.id))
  return {
    id: row.id,
    uid,
    ok: outcome.ok,
    indeterminate: outcome.indeterminate === true,
    error: outcome.error ?? null,
  }
}

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }
  if (parsed.error || !parsed.options) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const opts = parsed.options

  let rawText: string
  try {
    rawText = opts.stdin ? readStdin() : readFileSync(resolvePath(opts.file as string), 'utf8')
  } catch (e) {
    process.stderr.write(`❌ 读取输入失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  let raw: unknown
  try {
    raw = JSON.parse(rawText)
  } catch (e) {
    process.stderr.write(
      `❌ JSON 解析失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }

  const providerFromFile =
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    typeof (raw as Record<string, unknown>).providerCode === 'string'
      ? String((raw as Record<string, unknown>).providerCode)
      : ''
  const providerCode =
    opts.providerCode ?? (isRelayProviderCode(providerFromFile) ? providerFromFile : null)
  if (!providerCode) {
    process.stderr.write(
      `❌ 缺少平台:--provider 未给,文件顶层也没有合法 providerCode(可选 ${RELAY_PROVIDERS.join('|')})\n`,
    )
    return 2
  }

  const report = validateAccountExport(raw, { providerCode })
  const accounts = report.accounts.length
  if (!report.ok) {
    process.stderr.write(
      `❌ 预检不通过:平台=${providerCode} 账号=${accounts} 结构无效=${report.invalid} 文件问题=${report.issues.filter((i) => i.level === 'error').length}\n`,
    )
    for (const issue of report.issues) {
      if (issue.level === 'error')
        process.stderr.write(`   [文件] ${issue.code}: ${issue.message}\n`)
    }
    for (const acc of report.accounts) {
      for (const issue of acc.issues) {
        if (issue.level === 'error')
          process.stderr.write(`   #${acc.index + 1} ${issue.code}: ${issue.message}\n`)
      }
    }
    return 1
  }

  if (opts.dryRun) {
    const summary = {
      ok: true,
      dryRun: true,
      providerCode,
      total: report.total,
      valid: report.valid,
      duplicateUids: report.duplicateUids,
      expired: report.expired,
      expiringSoon: report.expiringSoon,
      expiredWithoutRefresh: report.expiredWithoutRefresh,
      accounts: report.accounts.map((a) => ({
        index: a.index + 1,
        name: a.name,
        uid: a.uid,
        tokenExpiresAt: a.tokenExpiresAt,
        hasRefreshToken: a.hasRefreshToken,
        issues: a.issues.length,
      })),
    }
    process.stdout.write(
      opts.json
        ? `${JSON.stringify(summary, null, 2)}\n`
        : `预检通过(未写库): ${JSON.stringify(summary)}\n`,
    )
    return 0
  }

  const importInput = (
    Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).accounts)
        ? ((raw as Record<string, unknown>).accounts as unknown[])
        : []
  ) as Array<Record<string, unknown>>
  const result = await importAccounts(providerCode, importInput)

  const health: HealthOutcome[] = []
  if (opts.health) {
    registerAllRelayAdapters()
    for (const item of result.items) {
      if (!item.uid) continue
      if (item.status !== 'imported' && item.status !== 'updated') continue
      const outcome = await runHealth(providerCode, item.uid)
      if (outcome) health.push(outcome)
    }
  }

  const summary = {
    ok: result.failed === 0,
    providerCode,
    total: result.total,
    imported: result.imported,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
    items: result.items.map((item) => {
      const h = health.find((x) => x.uid === item.uid)
      return {
        index: item.index + 1,
        name: item.name,
        uid: item.uid,
        status: item.status,
        reason: item.reason,
        health: h ? healthStatusOf(h) : null,
        healthError: h && !h.ok ? h.error : null,
      }
    }),
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } else {
    process.stdout.write(
      `导入完成:平台=${providerCode} 新增=${result.imported} 更新=${result.updated} 跳过=${result.skipped} 失败=${result.failed}\n`,
    )
    for (const item of summary.items) {
      process.stdout.write(
        `  #${item.index} ${item.name} uid=${item.uid ?? '-'} ${item.status}` +
          (item.health
            ? ` health=${item.health}${item.healthError ? `(${item.healthError})` : ''}`
            : '') +
          (item.reason ? `  ${item.reason}` : '') +
          '\n',
      )
    }
  }
  return result.failed === 0 ? 0 : 1
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

export const __test__ = { parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
