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
const { isRelayProviderCode, RELAY_PROVIDERS, validateAccountExport, resolveRelayCredentialSlots } =
  await import('../src/services/relay-account-format.js')
const { importAccounts, decryptAccountCredentials, resolveImportAccountUidProbe } =
  await import('../src/services/relay-account-pool-service.js')
const { db, dbRead, closeDbPools } = await import('../src/db/index.js')
const { registerAllRelayAdapters } = await import('../src/services/upstream-adapters/index.js')
const { getRelayAdapter } = await import('../src/services/relay-upstream-adapters.js')
const { healthStatusOf } = await import('../src/services/relay-account-pool-scheduler.js')
const { fetchCodeartsAccountPhone } =
  await import('../src/services/upstream-adapters/codearts-adapter.js')
const { pickProxyForAccount } = await import('../src/services/relay-proxy-pool.js')

interface CliOptions {
  stdin: boolean
  /**
   * 输入文件(2026-11-10 起可重复给):多个 --file = 批量模式,一个 node 进程内逐文件导入,
   * 供 scripts/relay-account-pool-push-all.mjs 全池推生产时省掉每平台一次 tsx 冷启。
   * IHUI_BATCH_FILE — 能力探针标记(ASCII,供远端 findstr 判本 checkout 是否已含批量模式)。
   */
  files: string[]
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
  pnpm exec tsx scripts/relay-account-import.ts (--file <json> [--file <json> ...] | --stdin)
    [--provider <${RELAY_PROVIDERS.join('|')}>] [--dry-run] [--no-health] [--json]
    [--owner <users.id>]      落该用户的个人池;缺省 = 运营池
    [--owner-source <名>]     归属来源(explicit-flag|default-owner-file|none),编排器透传;
                              缺省按"给了 --owner 记 explicit-flag,否则 none"回填。
                              词汇唯一真相源 = scripts/lib/pool-owner.mjs 的 OWNER_SOURCES,
                              本脚本只透传不解释。

批量模式(2026-11-10):--file 可重复给,同一进程内逐文件导入(每文件须自带顶层 providerCode,
  此时不接受 --provider),退出码取最坏一档;用于全池推生产时只付一次 tsx 冷启。

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
    files: [],
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
    else if (arg === '--file') {
      const v = argv[++i] ?? ''
      if (!v || v.startsWith('--')) {
        return { help: false, options: null, error: '--file 需要 JSON 路径(可重复给 = 批量)' }
      }
      options.files.push(v)
    } else if (arg === '--provider') {
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
  if (options.stdin && options.files.length > 0) {
    return { help: false, options: null, error: '--stdin 与 --file 只能二选一' }
  }
  if (!options.stdin && options.files.length === 0) {
    return { help: false, options: null, error: '缺少输入:--file <json> 或 --stdin' }
  }
  if (options.files.length > 1 && options.providerCode) {
    return {
      help: false,
      options: null,
      error: '批量模式(--file 重复给)不接受 --provider:每个文件须自带顶层 providerCode',
    }
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
    /**
     * 出口必须与转发链路同源:`proxy_url` 列可能存的是 `encryptField` 信封
     * (`{"iv","ciphertext","tag"}`),直接把原文当代理 URL 喂给 ProxyAgent 会抛
     * `Invalid URL`(检出 3 枚账号被误判未判定)。`pickProxyForAccount` 负责解密
     * 账号级代理并回退池内轮换,与调度器 sweep 同一口径。
     */
    const proxyUrl = await pickProxyForAccount({ id: row.id, proxyUrl: row.proxyUrl })
    outcome = await Promise.race([
      adapter.checkHealth(
        { row, credentials: decryptAccountCredentials(row) },
        { proxyUrl: proxyUrl ?? undefined },
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

  // 批量模式(2026-11-10):一个 node 进程内逐文件导入,退出码取最坏的一档。
  // 用途 = scripts/relay-account-pool-push-all.mjs 全池推生产:9 个平台只需一次 tsx 冷启。
  if (!opts.stdin && opts.files.length > 1) {
    let worst = 0
    for (const file of opts.files) {
      let text: string
      try {
        text = readFileSync(resolvePath(file), 'utf8')
      } catch (e) {
        process.stderr.write(
          `❌ 读取输入失败(未判定): ${file}: ${e instanceof Error ? e.message : String(e)}\n`,
        )
        worst = Math.max(worst, 2)
        continue
      }
      process.stdout.write(`── 批量文件 ${file}\n`)
      worst = Math.max(worst, await importOne(opts, text))
    }
    return worst
  }

  let rawText: string
  try {
    rawText = opts.stdin ? readStdin() : readFileSync(resolvePath(opts.files[0]), 'utf8')
  } catch (e) {
    process.stderr.write(`❌ 读取输入失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  return importOne(opts, rawText)
}

/** 单份输入的完整导入流程(预检 → 落库 → 体检);批量模式由 main 逐文件调用,共享同一套判据。 */
async function importOne(opts: CliOptions, rawText: string): Promise<number> {
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

  // CodeArts 会话里没有手机号(2026-11-10 实证:state.vscdb 解出的只有 id/accessKey/
  // secretKey/securitytoken/refresh_token/domainId/account{id,label}),但上游 IAM 有:
  // 用同一份 AK/SK+STS 签名点查 `GET /v3.0/OS-USER/users/{account.id}` 可拿到 phone。
  // 拿到就补进载荷的 `phone`(format 层 codearts 的 PHONE_KEYS 本就认 phone/account.phone),
  // 命名随即走"手机号优先";取不到只记未判定,不阻断导入(凡未取到一律如实回显枚数)。
  const rawAccounts = (
    Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).accounts)
        ? ((raw as Record<string, unknown>).accounts as unknown[])
        : []
  ) as ImportAccountInput[]
  if (providerCode === 'codearts' && rawAccounts.length > 0) {
    let filled = 0
    let missed = 0
    for (const acc of rawAccounts) {
      const a = acc as Record<string, unknown>
      const account = (a['account'] ?? null) as Record<string, unknown> | null
      const existing = String(account?.['phone'] ?? a['phone'] ?? '').trim()
      if (existing) continue
      const { hits } = resolveRelayCredentialSlots(a, 'codearts')
      const sts = hits[0]
      const ak = hits[1]
      const sk = hits[2]
      const userId = String(account?.['id'] ?? a['user_id'] ?? '').trim()
      if (!sts || !ak || !sk || !userId) {
        missed++
        continue
      }
      try {
        const phone = await fetchCodeartsAccountPhone({
          accessKeyId: ak.value,
          secretAccessKey: sk.value,
          securityToken: sts.value,
          userId,
        })
        if (phone) {
          a['phone'] = phone
          if (account && typeof account === 'object') account['phone'] = phone
          filled++
        } else {
          missed++
        }
      } catch {
        missed++
      }
    }
    if (filled || missed) {
      process.stderr.write(`ℹ️ codearts 手机号点查:取到 ${filled} 枚,未取到 ${missed} 枚\n`)
    }
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
  const importInput = rawAccounts
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
  /**
   * Windows/libuv:体检走全局 fetch,响应体读完后 socket 的 async handle 仍在关闭途中;
   * 此时立刻 process.exit() 会撞 `ASSERT(handle->flags & UV_HANDLE_CLOSING)`(exit -1073740791,
   * 2026-11-10 本机 5 连跑 4 次复现)。改成"先关连接池 → 置 exitCode 让事件循环自然排空",
   * 既保退出码语义,也不再硬断正在关闭的句柄。fetch 的 keep-alive socket 不挂住事件循环
   * (同机实测无 process.exit 时 0.27s 退出),真正需要收尾的是 DB 池。
   */
  const finish = async (code: number) => {
    await closeDbPools()
    process.exitCode = code
  }
  main(process.argv.slice(2))
    .then(finish)
    .catch(async (e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      await finish(2)
    })
}

export const __test__ = { parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
