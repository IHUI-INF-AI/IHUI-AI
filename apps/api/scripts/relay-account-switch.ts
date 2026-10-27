// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay:switch-account —— WorkBuddy 桌面端本机账号一键切换(⑧)。
 *
 * 模型(2026-10-27 对 wb-switch 二进制与本机文件取证):
 *  - 桌面端登录态 = 单个 auth 文件(%LOCALAPPDATA%/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop.info),
 *    形状 { account, accounts, allAccounts, auth },切账号 = 换这个文件(wb-switch 的 switch_*_account 同款);
 *  - 账号快照库 = ~/.wb-switch/backups/workbuddy-desktop.<ts>.info(wb-switch 每次切换前自动备份的产物);
 *  - 红线:切换前必须先把当前登录态备份成新快照(可回滚);目标与当前逐字节相同则拒绝;
 *    默认 dry-run 只出计划;输出永不回显 token / refreshToken / phoneNumber 明文。
 *
 * 零上游请求:只动本地文件。恢复路径 = 再切回旧快照(备份本身就在快照库里)。
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface SwitchPaths {
  /** 当前生效的桌面端 auth 文件 */
  authFile: string
  /** wb-switch 快照库目录(含 workbuddy-desktop.*.info) */
  backupsDir: string
}

/** 一个可切换目标(快照或当前);只带展示元数据,绝不带 token 原文 */
export interface SwitchTarget {
  /** 文件名(快照)或 'current(当前生效)' */
  name: string
  /** 绝对路径 */
  path: string
  /** 文件 mtime ISO */
  modifiedAt: string
  /** 文件 sha256 前 12 位(比对/审计用,非敏感) */
  sha12: string
  /** 账号昵称(展示用) */
  nickname?: string
  /** 手机号打码 138****1234 */
  phoneMasked?: string
  /** 令牌域(cn/global 判别的粗略线索) */
  domain?: string
  /** 访问令牌过期时刻 ISO(取不到留空) */
  authExpiresAt?: string
  /** 令牌形态 */
  tokenShape: 'jwt' | 'envelope' | 'missing'
  /** 是否当前生效文件(sha 与 authFile 一致) */
  isCurrent: boolean
  /** auth.expiresAt 已过去 ⇒ true(切过去大概率要重新登录) */
  expired: boolean
}

export interface SwitchPlan {
  targetName: string
  targetPath: string
  /** 切换前当前文件的备份落点 */
  backupPath: string
  /** 原子写目的地(= authFile) */
  authFile: string
  warnings: string[]
}

const sha256 = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex')

export const maskPhone = (raw: unknown): string | undefined => {
  const s = typeof raw === 'string' ? raw : ''
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7) return undefined
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined

function tokenShapeOf(auth: Record<string, unknown>): SwitchTarget['tokenShape'] {
  const t = auth['accessToken']
  if (typeof t === 'object' && t !== null) return 'envelope' // $wbEncrypted 信封对象
  if (typeof t !== 'string' || t.length === 0) return 'missing'
  if (t.split('.').length === 3) return 'jwt'
  return 'envelope'
}

/** expiresAt 兼容三种实态:epoch 毫秒数字 / 数字字符串 / ISO 串 */
function parseExpires(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && v.trim() !== '') return n
    const p = Date.parse(v)
    if (Number.isFinite(p)) return p
  }
  return Number.NaN
}

function describeAuthFile(
  path: string,
  name: string,
  currentSha: string | null,
): SwitchTarget | null {
  if (!existsSync(path)) return null
  let root: Record<string, unknown>
  try {
    root = asRecord(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return null
  }
  const auth = asRecord(root['auth'])
  const account = asRecord(root['account'])
  const sha = sha256(path)
  const expMs = parseExpires(auth['expiresAt'])
  const expiresIso = Number.isFinite(expMs) ? new Date(expMs).toISOString() : undefined
  return {
    name,
    path,
    modifiedAt: statSync(path).mtime.toISOString(),
    sha12: sha.slice(0, 12),
    ...(str(account['nickname']) ? { nickname: str(account['nickname']) } : {}),
    ...(maskPhone(account['phoneNumber'])
      ? { phoneMasked: maskPhone(account['phoneNumber']) }
      : {}),
    ...(str(auth['domain']) ? { domain: str(auth['domain']) } : {}),
    ...(expiresIso ? { authExpiresAt: expiresIso } : {}),
    tokenShape: tokenShapeOf(auth),
    isCurrent: currentSha !== null && sha === currentSha,
    expired: Number.isFinite(expMs) ? expMs < Date.now() : false,
  }
}

/** 双候选探测 auth 文件:LOCALAPPDATA 在沙盒/异常环境可能被重定向,谁存在用谁 */
export function resolveAuthFileCandidates(home = homedir()): string[] {
  const localAppData = process.env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local')
  return [
    join(localAppData, 'CodeBuddyExtension', 'Data', 'Public', 'auth', 'workbuddy-desktop.info'),
    join(
      home,
      'AppData',
      'Local',
      'CodeBuddyExtension',
      'Data',
      'Public',
      'auth',
      'workbuddy-desktop.info',
    ),
  ].filter((p, i, arr) => arr.indexOf(p) === i)
}

export function defaultSwitchPaths(home = homedir()): SwitchPaths {
  const candidates = resolveAuthFileCandidates(home)
  const authFile = candidates.find((p) => existsSync(p)) ?? candidates[0]!
  return { authFile, backupsDir: join(home, '.wb-switch', 'backups') }
}

/** 枚举快照库 + 当前文件,按 mtime 新→旧;快照命名 workbuddy-desktop.<ts>.info */
export function listSwitchTargets(paths: SwitchPaths): {
  current: SwitchTarget | null
  targets: SwitchTarget[]
} {
  const currentSha = existsSync(paths.authFile) ? sha256(paths.authFile) : null
  const current = currentSha
    ? describeAuthFile(paths.authFile, 'current(当前生效)', currentSha)
    : null
  const targets: SwitchTarget[] = []
  if (existsSync(paths.backupsDir)) {
    const names = readdirSync(paths.backupsDir)
      .filter((n) => /^workbuddy-desktop\..+\.info$/.test(n))
      .sort()
    for (const n of names) {
      const t = describeAuthFile(join(paths.backupsDir, n), n, currentSha)
      if (t) targets.push(t)
    }
  }
  targets.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return { current, targets }
}

/** 生成切换计划(纯函数,不落盘);同名同内容拒绝,过期/信封形态给告警 */
export function planSwitch(paths: SwitchPaths, targetName: string, now = new Date()): SwitchPlan {
  const { current, targets } = listSwitchTargets(paths)
  const target = targets.find((t) => t.name === targetName)
  if (!target) {
    const known = targets.map((t) => t.name).join(', ') || '(快照库为空)'
    throw new Error(`快照不存在: ${targetName}。可用: ${known}`)
  }
  if (current && target.sha12 === current.sha12) {
    throw new Error('目标与当前登录态逐字节相同,无需切换')
  }
  const warnings: string[] = []
  if (target.expired)
    warnings.push('目标快照的访问令牌已过期:切过去后客户端大概率要求重新登录(可走刷新或重新导入)')
  if (target.tokenShape === 'envelope')
    warnings.push('目标快照为 $wbEncrypted 信封形态:只能回灌到同一台机器的客户端')
  if (target.tokenShape === 'missing') warnings.push('目标快照缺 accessToken:切过去等于登出态')
  warnings.push('切换后需重启 WorkBuddy 桌面端生效;当前登录态已自动备份,可随时切回')
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')
  return {
    targetName: target.name,
    targetPath: target.path,
    backupPath: join(paths.backupsDir, `workbuddy-desktop.${stamp}Z.pre-switch.info`),
    authFile: paths.authFile,
    warnings,
  }
}

export interface SwitchApplyResult {
  ok: boolean
  backupPath?: string
  newSha12?: string
  error?: string
}

/**
 * 执行切换:先备份当前 → 目标拷到 authFile 同目录临时名 → 原子改名 → sha256 对账。
 * 任一步失败即停,不留半写状态(临时名残留无害,下次覆盖)。
 */
export function applySwitch(plan: SwitchPlan): SwitchApplyResult {
  try {
    if (!existsSync(plan.targetPath))
      return { ok: false, error: `目标文件不存在: ${plan.targetPath}` }
    if (!existsSync(plan.authFile))
      return { ok: false, error: `当前 auth 文件不存在(客户端从未登录?): ${plan.authFile}` }
    mkdirSync(plan.backupPath.replace(/[^/\\]+$/, ''), { recursive: true })
    copyFileSync(plan.authFile, plan.backupPath)
    const targetSha = sha256(plan.targetPath)
    const tmp = `${plan.authFile}.switching-${Date.now()}.tmp`
    copyFileSync(plan.targetPath, tmp)
    renameSync(tmp, plan.authFile)
    const newSha = sha256(plan.authFile)
    if (newSha !== targetSha)
      return { ok: false, error: '写后校验失败:authFile sha256 与目标不一致(已保留备份)' }
    return { ok: true, backupPath: plan.backupPath, newSha12: newSha.slice(0, 12) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 输出脱敏守卫:整篇输出不允许出现 token 原文(测试埋雷用同一函数) */
export function assertNoSecretLeak(lines: string[], secrets: string[]): void {
  for (const line of lines) {
    for (const s of secrets) {
      if (s.length >= 12 && line.includes(s)) {
        throw new Error(`输出泄漏敏感串(前4位 ${s.slice(0, 4)}…),已阻断`)
      }
    }
  }
}

export function fmtTarget(t: SwitchTarget): string {
  const flag = t.isCurrent ? ' ←当前' : ''
  const exp = t.authExpiresAt ? t.authExpiresAt.slice(0, 16).replace('T', ' ') : '?'
  const phone = t.phoneMasked ? ` ${t.phoneMasked}` : ''
  return `${t.name}  ${t.nickname ?? '(无昵称)'}${phone}  domain=${t.domain ?? '?'}  令牌过期=${exp}${t.expired ? '(已过期)' : ''}  形态=${t.tokenShape}  sha=${t.sha12}${flag}`
}

export function main(argv: string[], pathsOverride?: SwitchPaths): number {
  const paths = pathsOverride ?? defaultSwitchPaths()
  const toIdx = argv.indexOf('--to')
  const apply = argv.includes('--apply')
  const lines: string[] = []
  if (toIdx === -1) {
    const { current, targets } = listSwitchTargets(paths)
    lines.push(`当前 auth 文件: ${paths.authFile}`)
    if (current) lines.push(fmtTarget(current))
    else lines.push('(当前文件不存在或不可解析)')
    lines.push(`快照库: ${paths.backupsDir}(${targets.length} 份,新→旧)`)
    for (const t of targets) lines.push(fmtTarget(t))
    lines.push('切换: relay:switch-account --to <快照名> [--apply](不带 --apply 只出计划)')
    console.log(lines.join('\n'))
    return 0
  }
  const targetName = argv[toIdx + 1]
  if (!targetName) {
    console.error('--to 需要快照名')
    return 2
  }
  let plan: SwitchPlan
  try {
    plan = planSwitch(paths, targetName)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
  lines.push(
    `计划: ${plan.authFile}\n  ← ${plan.targetName}\n  备份当前 → ${plan.backupPath}`,
    ...plan.warnings.map((w) => `  ⚠ ${w}`),
  )
  if (!apply) {
    lines.push('(dry-run,未写盘;确认后加 --apply)')
    console.log(lines.join('\n'))
    return 0
  }
  const out = applySwitch(plan)
  if (!out.ok) {
    console.error(`切换失败: ${out.error}`)
    return 1
  }
  lines.push(
    `✅ 已切换: 现生效 sha=${out.newSha12};旧登录态备份于 ${out.backupPath};请重启 WorkBuddy 桌面端`,
  )
  console.log(lines.join('\n'))
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
