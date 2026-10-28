// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 反代号池一键导入(2026-10-23 立)。
 *
 * 用法:
 *   # 模式 A(默认):捕获本机 Qoder 登录态 → 导入号池(一键)
 *   pnpm qoder:import
 *
 *   # 模式 B:直接导入账号 JSON(裸数组 / {accounts:[…]} / {providerCode,accounts})
 *   pnpm qoder:import -- --file accounts.json
 *   pnpm qoder:import -- --file accounts.json --provider trae
 *
 *   # 模式 C:已解密的本机会话 JSON(ps1 产物;无 pwsh 环境的降级通道)
 *   pnpm qoder:import -- --session-file session.json
 *
 *   # 干跑(只解析不落库)
 *   pnpm qoder:import -- --dry-run
 *
 * 行为要点:
 * - 幂等:同 (providerCode, uid) 再导入 = 覆盖凭证 + 重置健康状态(号池续命,
 *   重复导入安全;这也是"重复性导入"的复用入口)
 * - 安全:输出永不回显 token/refreshToken 明文(只给 uid/到期/问题码);
 *   账号 JSON 与 session 文件含明文凭证,用完即删、勿入仓(见导入格式文档 §7)
 * - 退出码:0 全部成功 / 1 有失败或缺可导账号 / 2 参数或输入读取失败(未判定)
 */
import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  importAccounts,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'
import { RELAY_PROVIDERS, type RelayProviderCode } from '../src/services/relay-account-format.js'
// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头。本地副本与
// scripts/lib/flag-value.mjs 的 isFlagValueToken 逐字同源 —— apps/api→repo-tooling 被
// config/architecture-policy.yaml 禁止(D1/D2/D3),消依赖优先;语义变更须两处同改。
function isFlagValueToken(token: unknown): boolean {
  return typeof token === 'string' && token !== '' && !token.startsWith('-')
}

/**
 * 错误文案里的实得值只描述形状(守门 181 / G-998147):无值报固定短语;短值原样 quoting;
 * 长值按 UTF-8 字节界截断 —— 错误文案会进错误信封/持久记录,整串回显会把它塞满。
 * 与 scripts/lib/flag-value.mjs 的 describeFlagToken 同口径,本地副本理由同上(D1/D2/D3)。
 */
function describeArgToken(tok: string | undefined): string {
  if (tok === undefined) return '(其后没有任何参数)'
  const bytes = new TextEncoder().encode(tok).length
  if (bytes <= 32) return JSON.stringify(tok)
  return `${JSON.stringify(tok.slice(0, 20))}…(共 ${bytes} bytes)`
}

// =============================================================================
// 类型与纯函数(单测覆盖)
// =============================================================================

/** qoder-capture.ps1 产出的单条本机会话 */
export interface QoderSession {
  uid?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  deviceId?: string
  machineId?: string
  machineToken?: string
  machineCode?: string
  machineType?: string
  version?: string
  phone?: string
  nickname?: string
  name?: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 本机会话 → 号池导入条目(纯函数)。
 * 兼容两种导出格式:
 *  (a) ps1 产物: 顶层 accessToken / uid / phone / nickname / name
 *  (b) 原生会话导出: token(accessToken 别名) + 内联 user{id,name,phone,email,...}
 * name 统一 = 官方绑定手机号(全号,不加平台前缀;2026-10-28 定);
 * 取不到 phone 才按 nickname > name > email 前缀 > uid 前 8 位 兜底(管理页好认);
 * uid 为空则由服务端走 user.id/哈希兜底;
 * Cosy 设备头族(machineToken/machineCode/machineType/version)原样带上,
 * 服务端落 extraMetadata.cosy,adapter 刷新/健康检查时使用。
 */
export function buildQoderImportAccount(s: QoderSession): ImportAccountInput | null {
  const raw = s as Record<string, unknown>
  const user =
    raw.user && typeof raw.user === 'object' ? (raw.user as Record<string, unknown>) : null
  // (b) 格式:token 作 accessToken 别名
  const token = str(raw.accessToken) || str(raw.token)
  if (!token) return null
  const uid = str(raw.uid) || (user ? str(user.id) : '')
  const phone = str(raw.phone) || (user ? str(user.phone) : '')
  const nickname = str(raw.nickname) || (user ? str(user.nickname) : '')
  const name = str(raw.name) || (user ? str(user.name) : '')
  const email = user ? str(user.email) : ''
  const acc: Record<string, unknown> = {
    name:
      phone ||
      nickname ||
      name ||
      (email ? email.split('@')[0] : '') ||
      (uid ? uid.slice(0, 8) : '未知号'),
    token,
  }
  if (uid) acc.uid = uid
  const rt = str(raw.refreshToken)
  if (rt) acc.refreshToken = rt
  if (str(raw.expiresAt)) acc.expiresAt = str(raw.expiresAt)
  if (str(raw.refreshTokenExpiresAt)) acc.refreshTokenExpiresAt = str(raw.refreshTokenExpiresAt)
  if (str(raw.deviceId)) acc.deviceId = str(raw.deviceId)
  if (str(raw.machineId)) acc.machineId = str(raw.machineId)
  if (phone) acc.phone = phone
  if (nickname) acc.nickname = nickname
  for (const k of ['machineToken', 'machineCode', 'machineType', 'version'] as const) {
    const v = str(raw[k])
    if (v) acc[k] = v
  }
  // 内联 user 的 email/avatar 透传(管理页识别用,进 extraMetadata)
  if (email) acc.email = email
  if (user && str(user.avatarUrl)) acc.avatarUrl = str(user.avatarUrl)
  return acc as ImportAccountInput
}

/**
 * 账号 JSON / 会话 JSON 的宽松形状 → 账号条目数组。
 * 支持:裸数组 / {accounts:[…]} / {providerCode,accounts:[…]} / {sessions:[…]} /
 * 顶层单个账号或会话对象(含 token/accessToken/user 之一即视为单条,自动包成数组)。
 */
export function extractAccountsFromJson(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.accounts)) return o.accounts
    if (Array.isArray(o.sessions)) return o.sessions
    // 顶层单条:含 token/accessToken/user 任一即当作单账号/会话对象包数组
    const looksLikeEntry =
      'token' in o || 'accessToken' in o || 'user' in o || 'authenticationContext' in o
    if (looksLikeEntry) return [o]
  }
  throw new Error(
    '无法识别的 JSON 形状:支持 裸数组 / {accounts:[…]} / {sessions:[…]} / 单条会话对象',
  )
}

// =============================================================================
// CLI
// =============================================================================

interface CliArgs {
  file?: string
  sessionFile?: string
  provider: RelayProviderCode
  dryRun: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { provider: 'qoder', dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    // G-322:带值旗标的值被紧邻旗标顶掉(`--file --dry-run`)或结尾无值时,旧写法
    // `argv[++i]` 无条件吞掉并顺带跳过那枚旗标 —— 现在统一经 isFlagValueToken 校验,
    // 值无效即抛错点名(与"未知参数"同一退出档),禁复制判据(§22c 单源 flag-value.mjs)。
    // @ts-expect-error scripts/*.mjs 无类型声明,apps/api tsconfig include 只收 src/**(脚本面不进 typecheck)
    const takeValue = (tok: string | undefined): string => {
      if (!isFlagValueToken(tok)) {
        throw new Error(
          `--${a.replace(/^--/, '')} 需要一个参数 —— 紧邻的 token 实得:${describeArgToken(tok)}(不得吞掉相邻旗标)`,
        )
      }
      i++
      return tok
    }
    if (a === '--file') args.file = takeValue(argv[i + 1])
    else if (a === '--session-file') args.sessionFile = takeValue(argv[i + 1])
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--provider') {
      const v = takeValue(argv[i + 1])
      if (!(RELAY_PROVIDERS as readonly string[]).includes(v)) {
        throw new Error(`不支持的 provider: ${v}(可选 ${RELAY_PROVIDERS.join('|')})`)
      }
      args.provider = v as RelayProviderCode
    } else if (a === '--help' || a === '-h') {
      console.log(
        '用法: pnpm qoder:import [-- --file x.json | --session-file x.json | --provider <code> | --dry-run]',
      )
      process.exit(0)
    } else {
      throw new Error(`未知参数: ${a}(--help 看用法)`)
    }
  }
  return args
}

/** 模式 A:spawn pwsh 跑 qoder-capture.ps1,管道收 stdout JSON */
function captureLocalSessions(): QoderSession[] {
  const ps1 = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qoder-capture.ps1')
  const r = spawnSync(
    'pwsh',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // §12g:派生必须显式接管 stdio(不吃 stdin ⇒ 首通道 ignore,stdout 要回读 JSON ⇒ 管道)
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  if (r.error || r.status !== 0) {
    const why = r.error?.message ?? `exit ${r.status}`
    throw new Error(
      `本机捕获失败(${why})。请确认:① 已安装 PowerShell 7+(pwsh);② 本机已登录 Qoder 客户端。` +
        `降级通道:在能解密的机器上跑 qoder-capture.ps1 -OutFile session.json,` +
        `再加 --session-file session.json 导入。`,
    )
  }
  const parsed: unknown = JSON.parse(r.stdout.trim())
  const sessions = (parsed as { sessions?: unknown }).sessions
  if (!Array.isArray(sessions)) throw new Error('qoder-capture.ps1 输出缺 sessions[]')
  return sessions as QoderSession[]
}

async function main(): Promise<void> {
  let args: CliArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }

  // 1. 取账号条目(三种来源)
  let accounts: ImportAccountInput[]
  let source: string
  try {
    if (args.file) {
      const raw: unknown = JSON.parse(readFileSync(args.file, 'utf8'))
      const rows = extractAccountsFromJson(raw)
      // provider 优先级:--provider > JSON.providerCode > 默认 qoder
      if (!process.argv.includes('--provider') && raw !== null && typeof raw === 'object') {
        const pc = (raw as Record<string, unknown>).providerCode
        if (typeof pc === 'string' && (RELAY_PROVIDERS as readonly string[]).includes(pc)) {
          args.provider = pc as RelayProviderCode
        }
      }
      accounts = rows as ImportAccountInput[]
      source = args.file
    } else if (args.sessionFile) {
      const raw: unknown = JSON.parse(readFileSync(args.sessionFile, 'utf8'))
      accounts = extractAccountsFromJson(raw)
        .map((s) => buildQoderImportAccount(s as QoderSession))
        .filter((a): a is ImportAccountInput => a !== null)
      source = args.sessionFile
    } else {
      accounts = captureLocalSessions()
        .map(buildQoderImportAccount)
        .filter((a): a is ImportAccountInput => a !== null)
      source = '本机 Qoder 登录态'
    }
  } catch (e) {
    console.error(`❌ 输入读取失败: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }

  if (accounts.length === 0) {
    console.error('❌ 没有可导入的账号(来源为空或全部条目缺 token)')
    process.exit(1)
  }

  // 2. 预检摘要(不回显 token 明文)
  console.log(`来源: ${source} | provider: ${args.provider} | 待导入: ${accounts.length} 条`)
  for (const [i, a] of accounts.entries()) {
    const rec = a as Record<string, unknown>
    console.log(
      `  #${i + 1} uid=${str(rec.uid) || '(哈希兜底)'} name=${str(rec.name)} ` +
        `expires=${str(rec.expiresAt) || '(无)'} refresh=${str(rec.refreshToken) ? '有' : '无'}`,
    )
  }
  if (args.dryRun) {
    console.log('dry-run:未落库')
    // 显式退出:服务模块加载时建立的 DB 连接池会让事件循环保持存活,
    // 不 exit 会挂起直到被外部信号杀掉(表现为空输出 + SIGTERM)。
    process.exit(0)
  }

  // 3. 落库(幂等:同 uid 覆盖凭证 + 重置健康状态)
  const result = await importAccounts(args.provider, accounts)
  console.log(
    `结果: imported=${result.imported} updated=${result.updated} ` +
      `skipped=${result.skipped} failed=${result.failed}`,
  )
  for (const item of result.items) {
    if (item.status !== 'imported' && item.status !== 'updated') {
      console.log(
        `  ✗ #${item.index + 1} ${item.name} uid=${item.uid ?? '-'} ${item.status}: ${item.reason ?? ''}`,
      )
    }
  }
  process.exit(result.failed > 0 ? 1 : 0)
}

// 直接执行才跑 main(vitest import 本文件时不触发)
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((e) => {
    console.error(`❌ 导入失败: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
