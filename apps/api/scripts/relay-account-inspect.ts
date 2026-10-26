// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号体检速查(2026-10-26 立)。
 *
 * 把「这枚号还能不能用、还剩多久、下一步该做什么」折成一行话,零 DB / 零上游请求:
 *   pnpm relay:inspect -- --file accounts.json [--provider workbuddy]
 *   pnpm relay:inspect -- --local            # 体检本机 WorkBuddy 桌面登录态
 *   pnpm relay:inspect -- --file f.json --json   # 机器可读
 *
 * 判据单源:字段别名/量纲归一走 relay-account-format(与导入、预检同一份),
 * 这里只做「状态 → 人话结论」的投影,不复制第二份到期/去重口径。
 * 输出永不回显凭据明文(只给 uid/剩余天数/形态标记)。
 * 退出码:0 全部可用 / 1 存在不可用或临期 / 2 参数或输入不可读(未判定)。
 */
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import {
  extractTokenExpiry,
  isRelayProviderCode,
  normalizeForeignAccountShape,
  parseJwtClaims,
  parseFlexibleExpiry,
  expireEpochToMs,
} from '../src/services/relay-account-format.js'

const EXPIRING_SOON_DAYS = 1

export type AccountVerdictKind =
  | 'usable' // 可用且窗口充裕
  | 'expiring-soon' // 还活着,但 ≤1 天内到期,尽快处理
  | 'expired-renewable' // 已过期,但有 refreshToken → 号池/客户端能自续
  | 'expired-dead' // 已过期且无自续通道,必须重新登录/重新导出
  | 'envelope-only' // WorkBuddy 5.6+ 加密信封:只能同机解回,本机体检读不了到期
  | 'indeterminate' // 取不到到期信息 ≠ 已过期(§0.3 不得冒判)

export interface AccountVerdict {
  label: string
  uid: string | null
  providerCode: string
  foreignShape: boolean
  tokenRemainingDays: number | null
  refreshRemainingDays: number | null
  canSelfRenew: boolean
  verdict: AccountVerdictKind
  nextAction: string
}

const VERDICT_ACTION: Record<AccountVerdictKind, string> = {
  usable: '无需处理;号池临期档/空闲保活会自动续票',
  'expiring-soon': '1 天内到期:确认号池在线(调度会自动刷)或本机开一次客户端续票',
  'expired-renewable': '已过期,但带 refreshToken:导入号池即可由调度器救回,本机需重启客户端换票',
  'expired-dead': '已过期且无 refreshToken:只能重新登录/重新导出,别指望它自愈',
  'envelope-only':
    '加密信封($wbEncrypted):仅同机 WorkBuddy 能解回明文,跨机/查积分皆不可用,需在有客户端的机器上重导一份明文',
  indeterminate: '读不到到期时刻(非 JWT 且无显式 expiresAt):不代表过期,能不能用以上游健康检查为准',
}

/** 剩余天数(保留 1 位小数;负数=已过期天数, null=不知道) */
export function remainingDays(ms: number | null, now: number): number | null {
  if (ms === null || !Number.isFinite(ms)) return null
  return Math.round(((ms - now) / 86_400_000) * 10) / 10
}

function isEnvelopeValue(v: unknown): boolean {
  return typeof v === 'object' && v !== null && '$wbEncrypted' in (v as Record<string, unknown>)
}

/** 取一段凭据的到期毫秒:JWT exp 优先,其次显式时刻(秒/毫秒/ISO 自适应) */
function expiryOf(cred: unknown, explicit: unknown): number | null {
  if (typeof cred === 'string') {
    const fromJwt = extractTokenExpiry(cred)?.getTime() ?? null
    if (fromJwt !== null) return fromJwt
  }
  return expireEpochToMs(explicit) ?? parseFlexibleExpiry(explicit)?.getTime() ?? null
}

/**
 * 单个账号条目 → 一行体检。纯函数,now 注入便于单测;不抛错(坏值折成 indeterminate)。
 */
export function inspectEntry(
  rawRow: unknown,
  providerCode: RelayProviderCode,
  now: number = Date.now(),
): AccountVerdict {
  const row = normalizeForeignAccountShape(rawRow)
  const label =
    typeof row['name'] === 'string' && row['name'] ? row['name'] : ((row['uid'] as string) ?? '#')
  const uid = typeof row['uid'] === 'string' && row['uid'] ? row['uid'] : null
  const tokenVal = row['token']
  const rtVal = row['refreshToken']
  const foreignShape = row['foreignShape'] === true
  const uidResolved =
    uid ??
    (typeof tokenVal === 'string' ? ((parseJwtClaims(tokenVal)?.['sub'] as string) ?? null) : null)

  if (isEnvelopeValue(tokenVal) || isEnvelopeValue(rtVal)) {
    return {
      label,
      uid: uidResolved,
      providerCode,
      foreignShape,
      tokenRemainingDays: null,
      refreshRemainingDays: null,
      canSelfRenew: false,
      verdict: 'envelope-only',
      nextAction: VERDICT_ACTION['envelope-only'],
    }
  }

  const tokenExpMs = expiryOf(tokenVal, row['expiresAt'])
  const refreshExpMs = expiryOf(rtVal, row['refreshTokenExpiresAt'])
  const tokenDays = remainingDays(tokenExpMs, now)
  const refreshDays = remainingDays(refreshExpMs, now)
  const hasCred = typeof tokenVal === 'string' && tokenVal.length > 0
  const canSelfRenew = typeof rtVal === 'string' && rtVal.length > 0

  let verdict: AccountVerdictKind
  if (!hasCred) verdict = 'indeterminate'
  else if (tokenDays === null) verdict = 'indeterminate'
  else if (tokenDays < 0) verdict = canSelfRenew ? 'expired-renewable' : 'expired-dead'
  else if (tokenDays <= EXPIRING_SOON_DAYS) verdict = 'expiring-soon'
  else verdict = 'usable'

  return {
    label,
    uid: uidResolved,
    providerCode,
    foreignShape,
    tokenRemainingDays: tokenDays,
    refreshRemainingDays: refreshDays,
    canSelfRenew,
    verdict,
    nextAction: VERDICT_ACTION[verdict],
  }
}

/** 导出文件(裸数组 / {accounts:[…]})→ 体检行;解析失败由调用方按未判定处理 */
export function inspectAccountExport(
  text: string,
  providerCode: RelayProviderCode,
  now: number = Date.now(),
): AccountVerdict[] {
  const parsed: unknown = JSON.parse(text)
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { accounts?: unknown[] })?.accounts)
      ? ((parsed as { accounts: unknown[] }).accounts ?? [])
      : [parsed]
  return rows.map((r) => inspectEntry(r, providerCode, now))
}

/**
 * 本机 WorkBuddy 桌面认证文件({auth,account,accounts,allAccounts})→ 体检行。
 * auth 段是明文三枚时直接体检当前号;若是信封则如实标 envelope-only。
 */
export function inspectDesktopAuthFile(
  text: string,
  providerCode: RelayProviderCode = 'workbuddy',
  now: number = Date.now(),
): AccountVerdict[] {
  const doc = JSON.parse(text) as Record<string, unknown>
  const auth = (doc['auth'] ?? {}) as Record<string, unknown>
  const account = (doc['account'] ?? {}) as Record<string, unknown>
  const row = {
    name: typeof account['nickname'] === 'string' ? account['nickname'] : null,
    uid: typeof account['uid'] === 'string' ? account['uid'] : null,
    token: auth['accessToken'],
    refreshToken: auth['refreshToken'],
    expiresAt: auth['expiresAt'],
    refreshTokenExpiresAt: auth['refreshExpiresAt'],
  }
  const current = inspectEntry(row, providerCode, now)
  const others = Array.isArray(doc['allAccounts'])
    ? (doc['allAccounts'] as Array<Record<string, unknown>>)
        .filter((a) => typeof a?.['uid'] === 'string' && a['uid'] !== account['uid'])
        .map((a) => ({
          label: typeof a['nickname'] === 'string' ? a['nickname'] : String(a['uid']),
          uid: (a['uid'] as string) ?? null,
          providerCode,
          foreignShape: false,
          tokenRemainingDays: null,
          refreshRemainingDays: null,
          canSelfRenew: false,
          verdict: 'indeterminate' as const,
          nextAction: `在 allAccounts 里挂号(当前会话凭据不随附):切到它需要该号自己的导出/登录态`,
        }))
    : []
  return [current, ...others]
}

/** 本机候选认证文件路径(平台自适应;存在的才返回) */
export function desktopAuthCandidatePaths(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): string[] {
  const home = env['USERPROFILE'] ?? env['HOME'] ?? ''
  const rel = ['CodeBuddyExtension', 'Data', 'Public', 'auth']
  const roots =
    env['os'] === 'win32' || process.platform === 'win32'
      ? [env['LOCALAPPDATA'] ?? (home ? `${home}/AppData/Local` : '')]
      : process.platform === 'darwin'
        ? [home ? `${home}/Library/Application Support` : '']
        : [env['XDG_DATA_HOME'] ?? (home ? `${home}/.local/share` : '')]
  const out: string[] = []
  for (const r of roots) {
    if (!r) continue
    for (const name of ['workbuddy-desktop.info', 'workbuddy-desktop-ai.info']) {
      const p = `${r}/${rel.join('/')}/${name}`
      if (exists(p)) out.push(p)
    }
  }
  return out
}

/** 人话表(不含凭据明文)。--json 模式走 JSON.stringify(verdicts) */
export function formatVerdicts(rows: AccountVerdict[], source: string): string {
  const L: string[] = [`号体检 · ${source}`, '']
  for (const r of rows) {
    const t = r.tokenRemainingDays === null ? '?' : `${r.tokenRemainingDays}天`
    const rt =
      r.refreshRemainingDays === null
        ? r.canSelfRenew
          ? '有票'
          : '无'
        : `${r.refreshRemainingDays}天`
    const foreign = r.foreignShape ? ' 外来格式(已归一)' : ''
    L.push(
      `  ${iconOf(r.verdict)} [${r.verdict}] ${r.label}${r.uid ? ` uid=${r.uid.slice(0, 13)}…` : ''}` +
        ` token剩=${t} refresh=${rt}${foreign}`,
    )
    L.push(`      → ${r.nextAction}`)
  }
  const bad = rows.filter((r) => r.verdict !== 'usable').length
  L.push('')
  L.push(bad === 0 ? '结论: 全部可用' : `结论: ${bad}/${rows.length} 枚需要处理(详上)`)
  return L.join('\n')
}

function iconOf(v: AccountVerdictKind): string {
  return v === 'usable' ? 'OK' : v === 'indeterminate' || v === 'envelope-only' ? '??' : 'NO'
}

const HELP = `号体检速查(零 DB / 零上游请求 / 不回显凭据)
用法:
  pnpm relay:inspect -- --file <accounts.json> [--provider trae|workbuddy|codearts|qoder] [--json]
  pnpm relay:inspect -- --local [--json]
退出码:0 全部可用 / 1 有需要处理 / 2 未判定(参数或读不到输入)
`

function parseArgs(argv: string[]): {
  file?: string
  local?: boolean
  provider: RelayProviderCode
  json?: boolean
  error?: string
} {
  let file: string | undefined
  let local = false
  let json = false
  let provider: RelayProviderCode = 'workbuddy'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--file') {
      file = argv[++i]
      if (!file) return { provider, error: '--file 缺参数' }
    } else if (a === '--provider') {
      const v = argv[++i] ?? ''
      if (!isRelayProviderCode(v)) return { provider, error: `不支持的 --provider: ${v}` }
      provider = v
    } else if (a === '--local') local = true
    else if (a === '--json') json = true
    else if (a === '--help' || a === '-h') return { provider, error: '__help__' }
    else return { provider, error: `未知参数: ${a}` }
  }
  if (!file && !local) return { provider, error: '需给 --file <json> 或 --local' }
  return { file, local, provider, json }
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const p = parseArgs(argv)
  if (p.error === '__help__') {
    process.stdout.write(HELP)
    return 0
  }
  if (p.error) {
    process.stderr.write(`❌ ${p.error}\n\n${HELP}`)
    return 2
  }

  try {
    if (p.local) {
      const cands = desktopAuthCandidatePaths()
      if (cands.length === 0) {
        process.stderr.write('❌ 本机没找到 WorkBuddy 认证文件(未判定;可改用 --file)\n')
        return 2
      }
      let worst = 0
      for (const c of cands) {
        const rows = inspectDesktopAuthFile(readFileSync(c, 'utf8'))
        if (p.json) process.stdout.write(`${JSON.stringify({ source: c, rows }, null, 2)}\n`)
        else process.stdout.write(`${formatVerdicts(rows, c)}\n`)
        if (rows.some((r) => r.verdict !== 'usable' && r.verdict !== 'indeterminate'))
          worst = Math.max(worst, 1)
      }
      return worst
    }
    const rows = inspectAccountExport(readFileSync(p.file!, 'utf8'), p.provider!)
    if (p.json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
    else process.stdout.write(`${formatVerdicts(rows, p.file!)}\n`)
    return rows.some((r) => r.verdict !== 'usable' && r.verdict !== 'indeterminate') ? 1 : 0
  } catch (err) {
    process.stderr.write(
      `❌ 读取/解析失败(未判定): ${err instanceof Error ? err.message : String(err)}\n`,
    )
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
