// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池导入 JSON 预检 CLI(2026-10-23 立)。
 *
 * 只做本地结构/时效校验,不连库、不打上游。结构判据与解析复用
 * src/services/relay-account-format.ts;**逐行 uid 与批内重复枚数自 2026-11-06(Y-24 交回第 1 件)
 * 起不再吃 format 层那枚**,而是复用落库口径唯一出口
 * src/services/relay-account-pool-service.ts 的 `resolveImportAccountUidProbe`(§0.6 单源:
 * 预检报的键必须指得到"真导入后落在哪一行",否则覆盖语义形同虚设 —— 姊妹 CLI
 * `relay-account-import.ts` 已收口,本枚是当时漏掉的那格)。
 *
 * 服务模块要载入(键源住在它里面),但**一条 SQL 都不发**:该出口零 IO、只算键。
 * 环境不齐导致服务模块载入失败时,本 CLI 落 exit 2 并点名「未判定」,
 * **绝不回落到 format 层的键冒充预检结论**(§0.3「没判绝不写成判过」)。
 *
 * 用法(先进入 apps/api;文件路径按当前目录解析):
 *   cd apps/api
 *   pnpm exec tsx scripts/relay-account-import-validate.ts <file.json> --provider trae
 *   ... --strict            警告也判不通过(用于"临期号一律不许进池"的严格批)
 *   ... --json              输出机器可读报告
 *   ... --emit-body <path>  写出 admin 导入接口请求体(含明文凭证,勿提交/勿外发)
 *
 * 退出码:0 通过 / 1 不通过 / 2 参数或文件读取失败、键源不可载入(未判定)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config as loadDotenv } from 'dotenv'
// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头。本地副本与
// scripts/lib/flag-value.mjs 的 isFlagValueToken 逐字同源 —— apps/api→repo-tooling 被
// config/architecture-policy.yaml 禁止(D1/D2/D3),消依赖优先;语义变更须两处同改。
function isFlagValueToken(token: unknown): token is string {
  return typeof token === 'string' && token !== '' && !token.startsWith('-')
}
import {
  isRelayProviderCode,
  RELAY_PROVIDERS,
  toImportRequestBody,
  validateAccountExport,
  type ImportValidation,
  type RelayProviderCode,
} from '../src/services/relay-account-format.js'
// 仅类型(import type 在运行时被擦除 ⇒ 不会因这行而载入服务模块/建连)
import type {
  ImportAccountInput,
  ImportUidProbe,
} from '../src/services/relay-account-pool-service.js'

// =============================================================================
// 落库口径键源(2026-11-06 Y-24 交回第 1 件:预检的 uid 只许住在落库那一枚里,§0.6)
// =============================================================================

/** 逐行落库口径 uid + 批内重复枚数;`error` 非空 = 键源不可载入(未判定) */
export interface KeySourceReport {
  rows: ImportUidProbe[]
  duplicateUids: number
  error: string | null
}

/**
 * 顶层形状 → 账号数组(与 relay-account-format 的 rows 取法同形:裸数组或 `{ accounts: [...] }`)。
 * 只做取法、不做判定 ⇒ 判据仍只在 format 与服务层各一处。
 */
export function accountsFromRaw(raw: unknown): ImportAccountInput[] {
  if (Array.isArray(raw)) return raw as ImportAccountInput[]
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Record<string, unknown>)['accounts'])
  ) {
    return (raw as Record<string, unknown>)['accounts'] as ImportAccountInput[]
  }
  return []
}

/**
 * 载入服务层唯一键源出口并逐行算「真导入后落在哪个 uid」。
 * 服务模块载入失败(缺环境/模块坏)⇒ 如实返回 `error`,由调用方落 exit 2 点名未判定;
 * **绝不回落到 format 层 `extractUid(token)` 那枚冒充预检结论**。
 */
export async function loadKeySource(
  providerCode: RelayProviderCode,
  raw: unknown,
): Promise<KeySourceReport> {
  let rows: ImportUidProbe[] | null = null
  try {
    // .env 必须早于任何服务模块导入(它们在建连时读环境);动态导入以保证顺序
    loadDotenv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env') })
    const mod = await import('../src/services/relay-account-pool-service.js')
    rows = mod.resolveImportAccountUidProbe(providerCode, accountsFromRaw(raw))
    // 收尾不在这里:服务模块一起来就起了池与定时器,`dbClient.end()` 实测会把进程吊住
    // (await 永不 settle)⇒ 由 isDirectRun 那侧按姊妹 CLI 的既有做法显式退进程。
  } catch (err) {
    return { rows: [], duplicateUids: 0, error: err instanceof Error ? err.message : String(err) }
  }
  if (!rows)
    return { rows: [], duplicateUids: 0, error: '服务层未导出 resolveImportAccountUidProbe' }
  return { rows, duplicateUids: rows.filter((r) => r.duplicateOf !== null).length, error: null }
}

/** 逐行 uid 的展示文本:落库口径键;null = 这条根本不会写行;越界 = 未判定 */
export function uidText(key: KeySourceReport, index: number): string {
  if (key.error) return `未判定(${key.error.split('\n')[0]})`
  const row = key.rows[index]
  if (!row) return '未判定(键源行数少于报告行数)'
  return row.uid ?? '(不写行:形状闸门不过 / 归一化后无明文凭据)'
}

export interface CliOptions {
  file: string
  providerCode: RelayProviderCode
  strict: boolean
  json: boolean
  emitBody: string | null
}

export interface CliParseResult {
  help: boolean
  options: CliOptions | null
  error: string | null
}

export const HELP_TEXT = `账号池导入 JSON 预检

用法(先进入 apps/api):
  pnpm exec tsx scripts/relay-account-import-validate.ts <file.json> --provider <${RELAY_PROVIDERS.join('|')}>
    [--strict] [--json] [--emit-body <out.json>]

说明:
  只做本地结构/时效校验,不连库、不打上游。
  --strict      警告也判不通过(默认警告只提示)
  --json        输出机器可读报告
  --emit-body   写出 admin 导入接口请求体(含明文凭证,勿提交/勿外发)

退出码:
  0 通过 / 1 不通过 / 2 参数或文件读取失败、落库口径键源不可载入(未判定)
`

export function parseArgs(argv: string[]): CliParseResult {
  let file = ''
  let provider = ''
  let strict = false
  let json = false
  let emitBody: string | null = null
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === undefined) continue
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--strict') {
      strict = true
    } else if (arg === '--json') {
      json = true
    } else if (arg === '--provider') {
      // G-322:值被紧邻旗标顶掉(`--provider --json`)不得吞,点名拒绝(与"未知开关"同档)。
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        return {
          help: false,
          options: null,
          error: `--provider 需要一个平台代码 —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)`,
        }
      }
      provider = tok
      i++
    } else if (arg === '--emit-body') {
      const tok = argv[i + 1]
      if (!isFlagValueToken(tok)) {
        return {
          help: false,
          options: null,
          error: `--emit-body 需要一个输出路径 —— 紧邻的 token 实得:${tok === undefined ? '(其后没有任何参数)' : JSON.stringify(tok)}(不得吞掉相邻旗标)`,
        }
      }
      emitBody = tok
      i++
    } else if (arg.startsWith('-')) {
      return { help: false, options: null, error: `未知开关: ${arg}` }
    } else if (!file) {
      file = arg
    } else {
      return { help: false, options: null, error: `多余的参数: ${arg}` }
    }
  }

  if (help) return { help: true, options: null, error: null }
  if (!file) return { help: false, options: null, error: '缺少 JSON 文件路径' }
  if (!provider) {
    return { help: false, options: null, error: `缺少 --provider(${RELAY_PROVIDERS.join('|')})` }
  }
  if (!isRelayProviderCode(provider)) {
    return {
      help: false,
      options: null,
      error: `不支持的平台: ${provider}(可选 ${RELAY_PROVIDERS.join('|')})`,
    }
  }
  return {
    help: false,
    options: { file, providerCode: provider, strict, json, emitBody },
    error: null,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function stamp(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatReport(report: ImportValidation, file: string, key: KeySourceReport): string {
  const lines: string[] = []
  lines.push(
    `[relay-account-import] 文件=${file} 平台=${report.providerCode} ` +
      `账号=${report.total} 结构有效=${report.valid} 结构无效=${report.invalid} ` +
      `重复uid=${key.error ? '未判定' : key.duplicateUids} 已过期=${report.expired} ` +
      `24h内到期=${report.expiringSoon} 过期且无refreshToken=${report.expiredWithoutRefresh} ` +
      `键源=${key.error ? '不可载入' : '落库口径(resolveImportAccountUidProbe)'}` +
      (report.strict ? ' 档=strict' : ''),
  )
  for (const issue of report.issues) {
    lines.push(`  ${issue.level === 'error' ? '❌' : '⚠️'} [文件] ${issue.code}: ${issue.message}`)
  }
  for (const acc of report.accounts) {
    lines.push(
      `  #${acc.index + 1} ${acc.name} uid=${uidText(key, acc.index)} ` +
        `token到期=${stamp(acc.tokenExpiresAt)} cookies=${acc.cookieCount} ` +
        `最早cookie到期=${stamp(acc.cookieEarliestExpiry)}`,
    )
    if (
      key.rows[acc.index]?.duplicateOf !== undefined &&
      key.rows[acc.index]?.duplicateOf !== null
    ) {
      lines.push(
        `    ⚠️ duplicate-uid: 与本批第 ${(key.rows[acc.index]?.duplicateOf ?? 0) + 1} 条同键(落库口径),导入时以首条为准`,
      )
    }
    for (const issue of acc.issues) {
      lines.push(`    ${issue.level === 'error' ? '❌' : '⚠️'} ${issue.code}: ${issue.message}`)
    }
  }
  const warningCount = report.accounts.reduce(
    (n, a) => n + a.issues.filter((i) => i.level === 'warning').length,
    report.issues.filter((i) => i.level === 'warning').length,
  )
  lines.push(
    report.ok
      ? `结论: 通过${warningCount > 0 ? `(有 ${warningCount} 条警告,默认不影响导入)` : ''}`
      : `结论: 不通过(${report.invalid} 个账号有结构错误${report.strict ? ',strict 档含警告' : ''})`,
  )
  return lines.join('\n')
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    process.stdout.write(HELP_TEXT)
    return 0
  }
  if (parsed.error || !parsed.options) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP_TEXT}`)
    return 2
  }
  const opts = parsed.options

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(resolve(opts.file), 'utf8'))
  } catch (err) {
    process.stderr.write(
      `❌ 读取或解析失败(未判定): ${opts.file}\n   ${err instanceof Error ? err.message : String(err)}\n`,
    )
    return 2
  }

  const report = validateAccountExport(raw, {
    providerCode: opts.providerCode,
    strict: opts.strict,
  })
  const key = await loadKeySource(opts.providerCode, raw)
  if (key.error) {
    process.stderr.write(
      `❌ 未判定:落库口径键源不可载入 ⇒ 预检报不出「真导入后落在哪一行」的 uid,` +
        `不回落 format 层的键冒充结论(§0.3)。\n   ${key.error}\n`,
    )
    return 2
  }

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ...report,
          uidKeySource: 'pool-side(resolveImportAccountUidProbe)',
          duplicateUids: key.duplicateUids,
          accounts: report.accounts.map((a) => ({ ...a, uid: key.rows[a.index]?.uid ?? null })),
        },
        null,
        2,
      )}\n`,
    )
  } else {
    process.stdout.write(`${formatReport(report, opts.file, key)}\n`)
  }

  if (opts.emitBody) {
    try {
      const body = toImportRequestBody(raw, opts.providerCode)
      writeFileSync(resolve(opts.emitBody), `${JSON.stringify(body, null, 2)}\n`, 'utf8')
      process.stdout.write(
        `\n已写出导入请求体: ${opts.emitBody}\n⚠️ 该文件含明文凭证,只用于本机 curl/POST,勿提交、勿外发。\n`,
      )
    } catch (err) {
      process.stderr.write(
        `❌ 写出请求体失败: ${err instanceof Error ? err.message : String(err)}\n`,
      )
      return 2
    }
  }

  return report.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 服务模块一载入就会起池/起探测定时器 ⇒ 报完结论必须显式收尾(与姊妹 CLI
  // relay-account-import.ts 同法);只设 process.exitCode 会让本预检永不退出(实测挂到超时)。
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(
        `❌ 未判定(器物自身异常): ${err instanceof Error ? err.message : String(err)}\n`,
      )
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
