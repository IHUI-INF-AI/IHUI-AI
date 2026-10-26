// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池导入 JSON 预检 CLI(2026-10-23 立)。
 *
 * 只做本地结构/时效校验,不连库、不打上游。判据与解析全部复用
 * src/services/relay-account-format.ts(与服务端导入同一份实现)。
 *
 * 用法(先进入 apps/api;文件路径按当前目录解析):
 *   cd apps/api
 *   pnpm exec tsx scripts/relay-account-import-validate.ts <file.json> --provider trae
 *   ... --strict            警告也判不通过(用于"临期号一律不许进池"的严格批)
 *   ... --json              输出机器可读报告
 *   ... --emit-body <path>  写出 admin 导入接口请求体(含明文凭证,勿提交/勿外发)
 *
 * 退出码:0 通过 / 1 不通过 / 2 参数或文件读取失败(未判定)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头。本地副本与
// scripts/lib/flag-value.mjs 的 isFlagValueToken 逐字同源 —— apps/api→repo-tooling 被
// config/architecture-policy.yaml 禁止(D1/D2/D3),消依赖优先;语义变更须两处同改。
function isFlagValueToken(token: unknown): boolean {
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
  0 通过 / 1 不通过 / 2 参数或文件读取失败(未判定)
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

export function formatReport(report: ImportValidation, file: string): string {
  const lines: string[] = []
  lines.push(
    `[relay-account-import] 文件=${file} 平台=${report.providerCode} ` +
      `账号=${report.total} 结构有效=${report.valid} 结构无效=${report.invalid} ` +
      `重复uid=${report.duplicateUids} 已过期=${report.expired} ` +
      `24h内到期=${report.expiringSoon} 过期且无refreshToken=${report.expiredWithoutRefresh}` +
      (report.strict ? ' 档=strict' : ''),
  )
  for (const issue of report.issues) {
    lines.push(`  ${issue.level === 'error' ? '❌' : '⚠️'} [文件] ${issue.code}: ${issue.message}`)
  }
  for (const acc of report.accounts) {
    lines.push(
      `  #${acc.index + 1} ${acc.name} uid=${acc.uid ?? '-'} ` +
        `token到期=${stamp(acc.tokenExpiresAt)} cookies=${acc.cookieCount} ` +
        `最早cookie到期=${stamp(acc.cookieEarliestExpiry)}`,
    )
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

export function main(argv: string[] = process.argv.slice(2)): number {
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

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatReport(report, opts.file)}\n`)
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
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
