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
 * uid 口径(2026-11-06 收口):预检(--dry-run / 失败点名 / 批内重复计数)报的 uid 一律走
 * 服务层 `resolveImportAccountUidProbe`,与 importAccounts 写入的 `(provider_code, uid)`
 * 同一枚键源;此前预检用 format 层 `extractUid(token)`、落库用平台映射 seed,两键永不相等
 * ⇒ "同 provider+uid 覆盖"的语义在预检面完全失效(每换一次票就在池里多留一行孤儿)。
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
 *   ... --json               输出机器可读摘要(含 ownerUserIdMasked / ownerSource)
 *   ... --owner <users.id>   落该用户的个人池;缺省 = 运营池(不猜)
 *   ... --owner-source <名>  归属来源透传(词汇单源 scripts/lib/pool-owner.mjs)
 *
 * 安全:任何输出都不包含令牌明文;cookies/token 只在内存与加密落库之间流动。
 * 退出码:0 成功 / 1 校验不通过或全部失败 / 2 参数/读取/环境未判定。
 */
import { config } from 'dotenv'
import { resolve as resolvePath, dirname } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { RelayProviderCode } from '../src/services/relay-account-format.js'
import type { ImportAccountInput } from '../src/services/relay-account-pool-service.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolvePath(SCRIPT_DIR, '..')

// .env 必须早于任何服务模块导入(它们在建连时读环境);动态导入以保证顺序
config({ path: resolvePath(API_DIR, '.env') })

const { eq, and } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { isRelayProviderCode, RELAY_PROVIDERS, validateAccountExport } =
  await import('../src/services/relay-account-format.js')
const { importAccounts, decryptAccountCredentials, resolveImportAccountUidProbe } =
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
  /**
   * 归属个人池的 users.id;缺省 null = 运营池(存量语义零变化)。
   * 2026-11-05 补:CLI 此前没有 owner 出口,把个人池的号重导入一次就会掉回运营池 ——
   * 与机主 2026-10-31「我自己填入号池的账号只能跟着我的账号走」直接相违。
   */
  ownerUserId: string | null
  /**
   * 归属来源词汇的唯一真相源 = `scripts/lib/pool-owner.mjs` 的 `OWNER_SOURCES`
   * (`explicit-flag` | `default-owner-file` | `none`)。本脚本**只透传不解释**(故不在此
   * 复制第二份清单,§0.6),缺省按"给了 --owner 就是显式旗标,否则 none"如实回填。
   */
  ownerSource: string
}

const HELP = `账号池导入(服务端落库)

用法(推荐从仓根走编排器):
  node scripts/relay-account-pool.mjs --from workbuddy
  node scripts/relay-account-pool.mjs --file <accounts.json> --provider <${RELAY_PROVIDERS.join('|')}>

直接调用:
  pnpm exec tsx scripts/relay-account-import.ts (--file <json> | --stdin)
    [--provider <${RELAY_PROVIDERS.join('|')}>] [--dry-run] [--no-health] [--json]
    [--owner <users.id>]      落该用户的个人池;缺省 = 运营池
    [--owner-source <名>]     归属来源(explicit-flag|default-owner-file|none),编排器透传;
                              缺省按"给了 --owner 记 explicit-flag,否则 none"回填。
                              词汇唯一真相源 = scripts/lib/pool-owner.mjs 的 OWNER_SOURCES,
                              本脚本只透传不解释。

归属默认(2026-11-06 器物化):编排器不带 --owner 时会读本机 ~/.wb-switch/pool-owner 并代填,
  取不到才落运营池(取不到的原因由编排器打在 stdout,不静默)。直调本脚本不享有该默认。

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
    ownerUserId: null,
    ownerSource: '',
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
    } else if (arg === '--owner') {
      const v = (argv[++i] ?? '').trim()
      if (!v || v.startsWith('--')) {
        return { help: false, options: null, error: '--owner 需要 users.id(不给 = 运营池,不猜)' }
      }
      options.ownerUserId = v
    } else if (arg === '--owner-source') {
      // 只透传不解释:词汇的唯一真相源在 scripts/lib/pool-owner.mjs 的 OWNER_SOURCES,
      // 本脚本不得复制第二份清单(§0.6);取值形状校验与同文件其余带值旗标同一把尺。
      const v = (argv[++i] ?? '').trim()
      if (!v || v.startsWith('--')) {
        return {
          help: false,
          options: null,
          error: '--owner-source 需要来源短名(explicit-flag|default-owner-file|none)',
        }
      }
      options.ownerSource = v
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
  // 来源缺省回填(单独直调本脚本时没有编排器给旗标):给了 --owner 就是显式旗标,否则 none。
  if (!options.ownerSource) {
    options.ownerSource = options.ownerUserId ? 'explicit-flag' : 'none'
  }
  return { help: false, options, error: null }
}

function readStdin(): string {
  return readFileSync(0, 'utf8')
}

/**
 * 归属的对外显示形态:个人池 = 前 8 位 + ***(完整 users.id 不外显,非机密也不必外显);
 * 运营池 = null。人类面与 --json 机器面共用本函数 ⇒ 两端不可能给出不同结论。
 */
function ownerUserIdForDisplay(opts: CliOptions): string | null {
  return opts.ownerUserId ? `${opts.ownerUserId.slice(0, 8)}***` : null
}

/** 人类面归属短语(与 ownerUserIdForDisplay / ownerSource 同源) */
function ownerDisplayText(opts: CliOptions): string {
  if (opts.ownerUserId) return `${ownerUserIdForDisplay(opts)} 个人池(来源:${opts.ownerSource})`
  return `运营池(来源:${opts.ownerSource})`
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
  if (!adapter)
    return {
      id: row.id,
      uid,
      ok: false,
      indeterminate: true,
      error: `平台 ${providerCode} 适配器未注册`,
    }
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

  // ── 落库口径 uid(2026-11-06 收口,主会话取证:同一份豆包输入预检报 auto:2972051c…、
  // 实际入库落 auto:acc3bb70…)──
  // 预检此前吃 format 层 `extractUid(token)`(seed=token 单值),落库吃服务层平台映射
  // (豆包/loomy seed=`source:key:token`,codex/opencode/minimax/lingma/qoder 另有稳定 id 优先)
  // ⇒ 两枚键永不相等,预检报出的 uid 指不到"将被覆盖的那一行",覆盖语义形同虚设。
  // 收口口径 = **调用侧复用落库那枚键源**(`resolveImportAccountUidProbe` → 同一个
  // `mapImportedAccount` 分派 + 同一句 `uidFromImportPayload`),四个 `auto:` 生成点与
  // relay-account-format 的既有函数语义一字未改,号池身份键三下游(转发选号/保活/签到)零影响。
  const importInput = (
    Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).accounts)
        ? ((raw as Record<string, unknown>).accounts as unknown[])
        : []
  ) as ImportAccountInput[]
  const probes = resolveImportAccountUidProbe(providerCode, importInput)
  const uidOf = (index: number): string | null => probes[index]?.uid ?? null
  /** 批内重复枚数(按落库口径键计;口径 = importAccounts 的 seenInBatch) */
  const poolDuplicateUids = probes.filter((p) => p.duplicateOf !== null).length

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
          process.stderr.write(
            `   #${acc.index + 1} uid=${uidOf(acc.index) ?? '-'} ${issue.code}: ${issue.message}\n`,
          )
      }
    }
    return 1
  }

  if (opts.dryRun) {
    const summary = {
      ok: true,
      dryRun: true,
      providerCode,
      // 归属如实上报:机器面与人类面必须读同一枚结论(2026-11-06 与编排器同步新增)
      // 值一律脱敏形态(前 8 位 + ***),与人类面同一把尺;完整 uuid 不外显。
      ownerUserIdMasked: ownerUserIdForDisplay(opts),
      ownerSource: opts.ownerSource,
      total: report.total,
      valid: report.valid,
      // 口径点名:这里的 duplicateUids/uid 一律是"落库口径"(与 importAccounts 同键源),
      // 不再是 format 层 extractUid(token) 的那枚
      uidKeySource: 'pool-side(resolveImportAccountUidProbe)',
      duplicateUids: poolDuplicateUids,
      expired: report.expired,
      expiringSoon: report.expiringSoon,
      expiredWithoutRefresh: report.expiredWithoutRefresh,
      accounts: report.accounts.map((a) => ({
        index: a.index + 1,
        name: a.name,
        uid: uidOf(a.index),
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

  const result = await importAccounts(providerCode, importInput, opts.ownerUserId ?? null)
  // 落库后逐行自证:预检报的键必须与真正写进 (provider_code, uid) 的枚枚相等。
  // 任一格不等 = 键源又分叉了(新增平台映射没走 mapImportedAccount 的同一条路),
  // 这是运行时可观测的牙,不是只活在测试里。
  const driftRows: string[] = []
  for (const item of result.items) {
    if (item.status !== 'imported' && item.status !== 'updated') continue
    const pre = probes[item.index]?.uid ?? null
    if (pre !== item.uid)
      driftRows.push(`#${item.index + 1} 预检=${pre ?? '-'} 入库=${item.uid ?? '-'}`)
  }
  if (driftRows.length > 0) {
    process.stderr.write(
      `⚠️ 预检 uid 与入库 uid 不一致(键源再次分叉,须修): ${driftRows.join(' | ')}\n`,
    )
  }

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
    // 归属如实上报:与预检档、人类面同源(值脱敏,完整 uuid 不外显)
    ownerUserIdMasked: ownerUserIdForDisplay(opts),
    ownerSource: opts.ownerSource,
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
      `导入完成:平台=${providerCode} 新增=${result.imported} 更新=${result.updated} 跳过=${result.skipped} 失败=${result.failed}` +
        // 归属必须回显:此前 CLI 没有 owner 出口,个人池的号被静默打回运营池 = 别人也可能被调度到它
        ` 归属=${ownerDisplayText(opts)}\n`,
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
