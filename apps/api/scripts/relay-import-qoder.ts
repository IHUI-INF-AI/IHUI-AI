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
 *   # 干跑(只解析归属与账号形状,不落库;回显"将落哪一格")
 *   pnpm qoder:import -- --dry-run
 *
 *   # 归属:显式指定个人池 / 显式落运营池(两枚互斥,同给 = 未判定 exit 2)
 *   pnpm qoder:import -- --owner <users.id>
 *   pnpm qoder:import -- --ops-pool
 *
 *   # 跳过导入后的即时体检(默认会跑,与 relay-account-import.ts 同口径)
 *   pnpm qoder:import -- --no-health
 *
 * 行为要点:
 * - 幂等:同 (providerCode, uid) 再导入 = 覆盖凭证 + 重置健康状态(号池续命,
 *   重复导入安全;这也是"重复性导入"的复用入口)
 * - **归属优先级(2026-11-06 立,缺陷根治)**:显式 `--owner` > 本机 pool-owner 默认
 *   (`resolveAutoImportOwner` 单源出口,内部委托 `scripts/lib/pool-owner.mjs`) > 运营池。
 *   此前本脚本调 `importAccounts(provider, accounts)` 只传两参 ⇒ ownerUserId 走服务层默认
 *   null ⇒ **恒把机主本人的号打成运营池**;再由带 owner 的通道导入同一枚时,表上两条
 *   partial unique 各自成立 ⇒ 同 uid 双行,而 `chooseSyncTargetRow` 运营池优先 ⇒ 个人池
 *   那行永远拿不到客户端新票,保活/签到落在别处(2026-11-06 机主亲踩)。
 *   落运营池必须回显"为什么"(§0.3 不静默);默认归属**装载失败**按未判定 exit 2 且不写库,
 *   绝不 catch 成 null 把"判据坏了"洗成"这号本来就该进运营池"(§0.10)。
 * - 安全:输出永不回显 token/refreshToken 明文(只给 uid/到期/问题码);个人池归属只露
 *   users.id 前 8 位;账号 JSON 与 session 文件含明文凭证,用完即删、勿入仓(见导入格式文档 §7)
 * - 退出码:0 全部成功 / 1 有失败或缺可导账号 / 2 参数·输入读取·归属判据装载失败(未判定)
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
// 归属单源出口(§0.6):默认档读本机 ~/.wb-switch/pool-owner,判据住在工具层
// scripts/lib/pool-owner.mjs,由 relay-session-autoimport-owner.ts 统一装载与措辞。
// 与 relay-qoder-session-sync.ts / relay-trae-session-sync.ts 的 auto-import 支路同一把尺子。
import {
  describeAutoImportOwner,
  resolveAutoImportOwner,
  type AutoImportOwnerDecision,
} from './relay-session-autoimport-owner.js'
// 带值旗标取值口径(G-322):紧邻 token 必须非空且不以 `-` 开头。本地副本与
// scripts/lib/flag-value.mjs 的 isFlagValueToken 逐字同源 —— apps/api→repo-tooling 被
// config/architecture-policy.yaml 禁止(D1/D2/D3),消依赖优先;语义变更须两处同改。
function isFlagValueToken(token: unknown): token is string {
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
// 归属裁决(纯函数,单测覆盖)
// =============================================================================

/** resolveImportOwner 的输入面(CliArgs 的归属两枚旗标;测试可直接传字面量)。 */
export interface ImportOwnerFlags {
  /** 显式 `--owner <users.id>`;空/缺省 = 未给 */
  owner?: string
  /** 显式 `--ops-pool` */
  opsPool?: boolean
}

/**
 * 归属裁决:显式 `--owner` > 显式 `--ops-pool` > 本机 pool-owner 默认 > 运营池。
 * 优先级与仓内既有规矩逐字一致(工具层 `scripts/relay-account-pool.mjs` 的
 * `resolveOwnerDecision`、导入面 `relay-account-import.ts` 的 `--owner-source` 词汇
 * 同族),source/reason 复用 `scripts/lib/pool-owner.mjs` 的 OWNER_SOURCES 单一词汇表,
 * 本层不另立第二套口径(§0.6)。
 *
 * 默认档整条委托 `resolveAutoImportOwner`(它装载工具层单源)。它**抛错**时本函数照样抛:
 * 装载失败 = 未判定,由调用方 exit 2 并点名 ⇒ 结构上不可能被洗成 null 落运营池(§0.3/§0.10)。
 *
 * @param deps.resolveDefaultOwner 注入替身(测试用;绝不读真机文件、绝不写库)
 */
export function resolveImportOwner(
  flags: ImportOwnerFlags,
  deps: { resolveDefaultOwner?: () => AutoImportOwnerDecision } = {},
): AutoImportOwnerDecision {
  if (flags.owner) {
    return { ownerUserId: flags.owner, source: 'explicit-flag', reason: 'ok', file: '' }
  }
  if (flags.opsPool) {
    return { ownerUserId: null, source: 'none', reason: 'ops-pool-flag', file: '' }
  }
  const resolveDefault = deps.resolveDefaultOwner ?? resolveAutoImportOwner
  return resolveDefault()
}

/**
 * 归属回显措辞:个人池一律走 `describeAutoImportOwner`(只露 users.id 前 8 位 + 来源),
 * 本层不复制那半句。唯一自写的是"人显式要运营池"那一档 —— 它不是"默认归属取不到",
 * 说成取不到就是假话;原因照样要点名(§0.3 不静默)。
 */
export function describeImportOwner(d: AutoImportOwnerDecision): string {
  if (!d.ownerUserId && d.reason === 'ops-pool-flag') {
    return '运营池(--ops-pool 显式指定,压过本机默认归属)'
  }
  return describeAutoImportOwner(d)
}

// =============================================================================
// CLI
// =============================================================================

interface CliArgs {
  file?: string
  sessionFile?: string
  provider: RelayProviderCode
  dryRun: boolean
  /** 导入后是否立刻做上游体检(默认 true;与 relay-account-import.ts 同口径) */
  health: boolean
  /** 显式个人池归属(`--owner`);空串 = 未给,走本机默认 */
  owner: string
  /** 显式落运营池(`--ops-pool`),压过本机默认归属;与 owner 互斥 */
  opsPool: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    provider: 'qoder',
    dryRun: false,
    health: true,
    owner: '',
    opsPool: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? ''
    // G-322:带值旗标的值被紧邻旗标顶掉(`--file --dry-run`)或结尾无值时,旧写法
    // `argv[++i]` 无条件吞掉并顺带跳过那枚旗标 —— 现在统一经 isFlagValueToken 校验,
    // 值无效即抛错点名(与"未知参数"同一退出档),禁复制判据(§22c 单源 flag-value.mjs)。
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
    else if (a === '--no-health') args.health = false
    else if (a === '--ops-pool') args.opsPool = true
    else if (a === '--owner') {
      const v = takeValue(argv[i + 1]).trim()
      if (!v) {
        throw new Error('--owner 需要 users.id(不给 = 按本机 pool-owner 默认归属,不猜)')
      }
      args.owner = v
    } else if (a === '--provider') {
      const v = takeValue(argv[i + 1])
      if (!(RELAY_PROVIDERS as readonly string[]).includes(v)) {
        throw new Error(`不支持的 provider: ${v}(可选 ${RELAY_PROVIDERS.join('|')})`)
      }
      args.provider = v as RelayProviderCode
    } else if (a === '--help' || a === '-h') {
      console.log(
        '用法: pnpm qoder:import [-- --file x.json | --session-file x.json | --provider <code> | ' +
          '--owner <users.id> | --ops-pool | --dry-run | --no-health]' +
          '\n归属: --owner(最高优先) > 本机 ~/.wb-switch/pool-owner 默认 > --ops-pool(显式要运营池);' +
          '默认取不到 ⇒ 落运营池并回显原因,绝不静默。--owner 与 --ops-pool 同给 = 未判定(exit 2)。',
      )
      process.exit(0)
    } else if (a === '--') {
      continue // pnpm 透传的裸分隔符,不是参数
    } else {
      throw new Error(`未知参数: ${a}(--help 看用法)`)
    }
  }
  // 互斥闸排在解析末尾:两枚旗标同给时"落哪一格"根本没有答案,猜哪一侧都是假话 ⇒
  // 抛错由 main 的解析 catch 落 exit 2(未判定),不写库(§0.3)。
  if (args.owner && args.opsPool) {
    throw new Error(
      '--owner 与 --ops-pool 只能二选一(个人池归属与运营池不得同时指定)⇒ 未判定,不落库',
    )
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

  // 1. 归属裁决(排在取号之前:判据本身坏了就没必要再动本机 pwsh / 读文件)
  let owner: AutoImportOwnerDecision
  try {
    owner = resolveImportOwner(args)
  } catch (e) {
    // 默认归属读不出 = 装载失败 = 未判定:非零退出、一个字节都不写库。
    // 这一档绝不能 catch 成 null —— 那等于把"判据坏了"洗成"这号本来就该进运营池"。
    console.error(
      `❌ 归属判据装载失败(未判定): ${e instanceof Error ? e.message : String(e)}\n` +
        '   本次不导入。个人池请加 --owner <users.id>,确需运营池请加 --ops-pool。',
    )
    process.exit(2)
  }

  // 2. 取账号条目(三种来源)
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

  // 3. 预检摘要(不回显 token 明文;归属落点必须回显,含来源与"为什么")
  console.log(
    `归属: ${describeImportOwner(owner)}` + (owner.file ? ` | 归属配置=${owner.file}` : ''),
  )
  console.log(`来源: ${source} | provider: ${args.provider} | 待导入: ${accounts.length} 条`)
  for (const [i, a] of accounts.entries()) {
    const rec = a as Record<string, unknown>
    console.log(
      `  #${i + 1} uid=${str(rec.uid) || '(哈希兜底)'} name=${str(rec.name)} ` +
        `expires=${str(rec.expiresAt) || '(无)'} refresh=${str(rec.refreshToken) ? '有' : '无'}`,
    )
  }
  if (args.dryRun) {
    console.log(`dry-run:未落库(将落:${describeImportOwner(owner)})`)
    // 显式退出:服务模块加载时建立的 DB 连接池会让事件循环保持存活,
    // 不 exit 会挂起直到被外部信号杀掉(表现为空输出 + SIGTERM)。
    process.exit(0)
  }

  // 4. 落库(幂等:同 uid 覆盖凭证 + 重置健康状态)
  // 第三参 ownerUserId 是本次缺陷的根治点:此前只传两参 ⇒ 走服务层默认 null ⇒ 恒落运营池。
  const result = await importAccounts(args.provider, accounts, owner.ownerUserId)
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

  // 5. 即时体检(2026-10-29 补):导入本身只做本地解析,但「导入后立刻看到 unknown」
  // 与另一入口 relay-account-import.ts(导入即体检)口径不一致 —— 同一次导入在两套工具下
  // 给出不同状态就是 bug。这里直接复用它的 runHealth 实现,不写第二份判据。
  // 体检不打对话配额(Qoder 走 /api/v2/quota/usage),不影响退出码(导入成败只看落库)。
  if (args.health) {
    const targets = result.items.filter(
      (item) => item.uid && (item.status === 'imported' || item.status === 'updated'),
    )
    if (targets.length > 0) {
      const { registerAllRelayAdapters } =
        await import('../src/services/upstream-adapters/index.js')
      const { runHealth } = await import('./relay-account-import.js')
      const { healthStatusOf } = await import('../src/services/relay-account-pool-scheduler.js')
      registerAllRelayAdapters()
      for (const item of targets) {
        const outcome = await runHealth(args.provider, item.uid as string)
        if (!outcome) {
          console.log(`  体检 #${item.index + 1} uid=${item.uid} 取不到账号行(未判定)`)
          continue
        }
        console.log(
          `  体检 #${item.index + 1} uid=${item.uid} health=${healthStatusOf(outcome)}` +
            (outcome.ok ? '' : ` (${outcome.error ?? '未判定'})`),
        )
      }
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

/** 可测面(§22c):镜像测试直接用生产判据,禁止在测试里复制第二份归属规则。 */
export const __test__ = { parseArgs, resolveImportOwner, describeImportOwner }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
