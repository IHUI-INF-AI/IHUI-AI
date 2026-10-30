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
import { execFileSync, spawn } from 'node:child_process'
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
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { computeBackupPlan, applyBackup, backupStampOf } from './relay-session-backup.js'
import {
  appendOps,
  applyTransfers,
  defaultMovePaths,
  detectClientProcesses,
  findTodaySnapshot,
  isAccountNotInLedgerError,
  planSwap,
  type MovePaths,
  type MovePlan,
  type SwapPlan,
} from './relay-session-move.js'
import { acquireSessionLock, SESSION_STORE_LOCK_NAME } from './relay-session-lock.js'

/**
 * `--with-sessions` 联动换桶的可注入依赖(测试全部注入临时目录,绝不碰真实登录态/会话库)。
 * - movePaths:会话搬家路径面(缺省 defaultMovePaths 真实面)
 * - now:换桶计划时刻(当日快照核对用它)
 * - runningProcs:客户端进程清单(缺省 detectClientProcesses 真实探测)
 */
export interface SwitchMainDeps {
  movePaths?: MovePaths
  now?: Date
  runningProcs?: string[]
  /** 覆盖 home(测试注入临时目录;缺省 homedir) */
  home?: string
  /** 客户端生命周期(测试注入;缺省真实探测/关闭/拉起) */
  clientLifecycle?: ClientLifecycle
}

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
  /** 账号 uid(会话台账/换桶用;非凭据,展示时只取前 8 位) */
  accountId?: string
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
  /** 目标账号 uid(= --with-sessions 联动换桶的目标;取不到留空) */
  targetAccountId?: string
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
  const uid = str(account['uid']) ?? str(account['id'])
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
    ...(uid ? { accountId: uid } : {}),
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

/** 枚举快照库 + 当前文件,新→旧;快照命名 workbuddy-desktop.<ISO ts>.info ⇒ 按名字倒序即时间倒序 */
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
  // 排序键取名字而不是 mtime:名字里就是权威时刻,而 mtime 在批量落盘(备份一瞬间写多份、
  // 或从别处复制过来)时会打平 ⇒ 旧口径的 mtime 排序对同刻文件退化成 readdir 顺序,
  // 列表"新→旧"看着对、实际随文件系统变化(契约见 tests/relay-account-switch.test.ts)。
  targets.sort((a, b) => b.name.localeCompare(a.name))
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
  if (target.accountId) {
    warnings.push(
      `会话面不会自动跟随:如需把会话也切到该账号,先 dry-run 再 --apply —— ` +
        `pnpm relay:session-move swap --to ${target.accountId}`,
    )
  }
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')
  return {
    targetName: target.name,
    targetPath: target.path,
    backupPath: join(paths.backupsDir, `workbuddy-desktop.${stamp}Z.pre-switch.info`),
    authFile: paths.authFile,
    ...(target.accountId ? { targetAccountId: target.accountId } : {}),
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

/**
 * 用 pre-switch 快照回滚 auth(原子写:临时名 → 改名 → sha 对账)。
 * 返回是否真的回到切换前内容;回滚失败必须让调用方如实报,绝不静默留半态。
 */
export function rollbackAuth(plan: SwitchPlan): { ok: boolean; sha12?: string; error?: string } {
  try {
    if (!existsSync(plan.backupPath))
      return { ok: false, error: `pre-switch 快照不存在,无法回滚: ${plan.backupPath}` }
    const expected = sha256(plan.backupPath)
    const tmp = `${plan.authFile}.rollback-${Date.now()}.tmp`
    copyFileSync(plan.backupPath, tmp)
    renameSync(tmp, plan.authFile)
    if (sha256(plan.authFile) !== expected)
      return { ok: false, error: '回滚写后校验失败:authFile sha256 与 pre-switch 快照不一致' }
    return { ok: true, sha12: expected.slice(0, 12) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface LinkedSwapResult {
  /**
   * - swapped:auth 已切 + 会话已换桶(ops 已记)
   * - skipped-same-account:目标=当前同账号,无需换桶(auth 保留切换结果)
   * - no-target-uid:目标快照缺 uid,无从换桶(auth 保留切换结果,已显式报)
   * - skipped-not-in-ledger:会话台账未覆盖目标账号,会话面不动(auth 保留切换结果)
   * - rolled-back:换桶失败/被闸挡下,auth 已用 pre-switch 回滚
   * - rollback-failed:换桶失败且回滚也失败(最严重,必须人工介入)
   */
  status:
    | 'swapped'
    | 'skipped-same-account'
    | 'no-target-uid'
    | 'skipped-not-in-ledger'
    | 'rolled-back'
    | 'rollback-failed'
  message: string
  swap?: SwapPlan
}

/**
 * `--with-sessions` 联动换桶(仅在 auth 切换成功后调用)。
 * 顺序与语义:
 *  - auth 已切到目标;pre-switch 快照(= 切换前的旧登录态)在 plan.backupPath;
 *  - 把该快照作为 planSwap 的 authFileOverride 传入 ⇒ planSwap 仍以「旧账号」为 currentAccountId,
 *    「新账号」为 target:旧账号活库会话搬进旧账号桶(outbound),新账号桶会话搬回活库(inbound);
 *  - 写面经 acquireSessionLock 串行 + 客户端存续闸;任一环节失败 ⇒ rollbackAuth 回滚 auth。
 * 纯逻辑,不打印;由 main 决定文案与退出码。
 */
export function runLinkedSessionSwap(
  plan: SwitchPlan,
  deps: { movePaths: MovePaths; now: Date; runningProcs: string[] },
): LinkedSwapResult {
  const targetUid = plan.targetAccountId
  if (!targetUid) {
    return {
      status: 'no-target-uid',
      message:
        '目标快照缺 uid,无法联动换桶;auth 已切换,会话面未动(可手动 relay:session-move swap --to <账号>)',
    }
  }
  // 同账号短路:pre-switch 快照的 uid == 目标 uid ⇒ 会话本就归属同一账号,无需换桶
  const oldUid = describeAuthFile(plan.backupPath, 'pre-switch', null)?.accountId ?? null
  if (oldUid !== null && oldUid === targetUid) {
    return {
      status: 'skipped-same-account',
      message: `目标与当前同账号(${targetUid.slice(0, 8)}),会话无需换桶`,
    }
  }
  // 客户端存续闸:切 auth 前无法预知,这里若发现客户端在跑 ⇒ 放弃换桶并回滚 auth
  if (deps.runningProcs.length > 0) {
    const rb = rollbackAuth(plan)
    const base = `客户端仍在运行(${deps.runningProcs.length} 个进程),已放弃换桶`
    return rb.ok
      ? { status: 'rolled-back', message: `${base},auth 已回滚到切换前 sha=${rb.sha12}` }
      : {
          status: 'rollback-failed',
          message: `${base},但 auth 回滚失败,需人工恢复 ${plan.backupPath}: ${rb.error}`,
        }
  }

  const lockPath = join(dirname(deps.movePaths.opsLogFile), SESSION_STORE_LOCK_NAME)
  let lock: { release: () => void }
  try {
    lock = acquireSessionLock(lockPath, 'switch-account --with-sessions')
  } catch (e) {
    const rb = rollbackAuth(plan)
    const base = `会话库锁争用,换桶未开始(${(e as Error).message})`
    return rb.ok
      ? { status: 'rolled-back', message: `${base},auth 已回滚到切换前 sha=${rb.sha12}` }
      : {
          status: 'rollback-failed',
          message: `${base},且 auth 回滚失败,需人工恢复 ${plan.backupPath}: ${rb.error}`,
        }
  }

  try {
    let swapPlan: SwapPlan
    try {
      // authFileOverride = pre-switch 快照 ⇒ planSwap 读到的是「旧账号」,与新账号形成换桶对
      swapPlan = planSwap(targetUid, deps.movePaths, deps.now, plan.backupPath)
    } catch (e) {
      // 台账没覆盖这个账号 ≠ 数据危险:auth 切换本身是成功的,回滚它只会让机主白忙一场
      // (2026-10-30 真机:台账缺目标账号 ⇒ 切号被整枚回滚,一键永远失败)。
      // 与 no-target-uid 同档:保留 auth 结果、会话面不动、把补台账的出处说清楚。
      if (isAccountNotInLedgerError(e)) {
        return {
          status: 'skipped-not-in-ledger',
          message: `${(e as Error).message};auth 保留切换结果,会话面未动`,
        }
      }
      const rb = rollbackAuth(plan)
      const base = `换桶计划失败(${(e as Error).message})`
      return rb.ok
        ? { status: 'rolled-back', message: `${base},auth 已回滚到切换前 sha=${rb.sha12}` }
        : {
            status: 'rollback-failed',
            message: `${base},且 auth 回滚失败,需人工恢复 ${plan.backupPath}: ${rb.error}`,
          }
    }
    const failed: string[] = []
    const applyOne = (p: MovePlan, type: 'move' | 'restore'): void => {
      try {
        const r = applyTransfers(p)
        appendOps(deps.movePaths.opsLogFile, {
          ts: deps.now.toISOString(),
          type,
          conversationId: p.conversationId,
          accountId: p.accountId,
          entries: r.moved,
        })
      } catch (err) {
        failed.push(`${p.conversationId}(${type}): ${(err as Error).message}`)
      }
    }
    for (const p of swapPlan.outbound) applyOne(p, 'move')
    for (const p of swapPlan.inbound) applyOne(p, 'restore')

    if (failed.length > 0) {
      const rb = rollbackAuth(plan)
      const base = `换桶 ${failed.length} 个失败(已落地部分按 ops 逐条可撤): ${failed.join(' | ')}`
      return rb.ok
        ? {
            status: 'rolled-back',
            message: `${base},auth 已回滚到切换前 sha=${rb.sha12}`,
            swap: swapPlan,
          }
        : {
            status: 'rollback-failed',
            message: `${base},且 auth 回滚失败,需人工恢复 ${plan.backupPath}: ${rb.error}`,
            swap: swapPlan,
          }
    }
    return {
      status: 'swapped',
      swap: swapPlan,
      message:
        `会话已联动换桶: 换出 ${swapPlan.outbound.length} / 换入 ${swapPlan.inbound.length}` +
        `(共 ${swapPlan.outbound.length + swapPlan.inbound.length} 个会话、${swapPlan.totalFiles} 个文件)` +
        (swapPlan.skipped.length > 0 ? `;跳过 ${swapPlan.skipped.length} 个` : ''),
    }
  } finally {
    lock.release()
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

/** 同步从 stdin 读一行(仅 TTY 有效;非 TTY 返回空串,绝不阻塞) */
function readLineSync(promptText: string): string {
  if (!process.stdin.isTTY) return ''
  process.stdout.write(promptText)
  try {
    return readFileSync(0, 'utf8').split(/\r?\n/)[0]?.trim() ?? ''
  } catch {
    return ''
  }
}

/**
 * 一键模式前置:确保「当日会话库快照」存在(session-move swap 红线的硬性前提)。
 * 已有任意 manifest 即满足;否则自动建一个(只读源 + 写快照,安全)。
 */
function ensureSessionBackup(
  now: Date,
  home = homedir(),
): { ok: boolean; path?: string; error?: string } {
  const backupsDir = join(home, '.wb-switch', 'backups', 'sessions')
  const sessionsRoot = join(home, '.workbuddy', 'workspace', 'sessions')
  const projectsRoot = join(home, '.workbuddy', 'projects')
  // 判据必须与换桶前置同一份(planSwap 的「当日 + source 根匹配」manifest):
  // 此前用"任意子目录有 manifest 即算就绪" ⇒ 昨天有快照、今天没跑备份时这里放行,
  // 切完 auth 才被 swap 以"当日快照缺失"拒绝 ⇒ 白忙一场再回滚(2026-10-30 代码复核实测)。
  if (findTodaySnapshot(backupsDir, sessionsRoot, projectsRoot, now)) return { ok: true }
  const plan = computeBackupPlan(
    sessionsRoot,
    projectsRoot,
    now,
    // 目的地跟随 home(测试注入临时 home 时绝不落到真实 ~/.wb-switch)
    join(backupsDir, backupStampOf(now)),
  )
  let lock: { release: () => void } | null = null
  try {
    lock = acquireSessionLock(
      join(home, '.wb-switch', 'relay', SESSION_STORE_LOCK_NAME),
      'one-click-backup',
    )
    applyBackup(plan, { sessionsRoot: plan.sessionsRoot, projectsRoot: plan.projectsRoot })
    return { ok: true, path: plan.destDir }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    lock?.release()
  }
}

/** 同步睡眠:轮询等客户端退出用,不占 CPU、不引第三方依赖 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms))
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * 只读枚举:按映像名取**当前在跑的 PID**(`tasklist /FI`)。
 * 取不到一律给空数组 ⇒ 调用方据此拒绝动手,绝不回落成"按名扫全场"。
 */
export function listPidsByImage(imageName: string): number[] {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 15_000,
    })
    return parseTasklistCsvPids(out)
  } catch {
    return []
  }
}

/**
 * `tasklist /FO CSV /NH` 的取 PID 判据(抽成纯函数:本机 tasklist 输出**是本地化的**,
 * 中文宿主里"没有运行的任务"那行是 `信息: ...` 而不是英文,靠文案匹配去排除等于没排除)。
 * 所以只认两件事:①行以 `"` 开头(CSV 数据行的形状)②第 2 列必须是正整数。
 * 其余一行都不进候选 —— 解析不出 PID 就是"枚举不到",由调用方拒杀。
 */
export function parseTasklistCsvPids(out: string): number[] {
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"'))
    .map((line) => Number(line.split('","')[1]))
    .filter((n) => Number.isInteger(n) && n > 0)
}

/** 按 PID 结束进程:命中面就是刚刚枚举出来的那一批,而不是"所有叫这个名字的进程"。 */
function killPid(pid: number, force: boolean): void {
  try {
    execFileSync('taskkill', force ? ['/F', '/PID', String(pid)] : ['/PID', String(pid)], {
      stdio: 'ignore',
      windowsHide: true,
    })
  } catch {
    // 无窗口的渲染/子进程对不带 /F 的 taskkill 报"只能强制终止"并以非零退出 ⇒ 那不代表关闭失败;
    // 真死活由下面的 probe 轮询判定,退出码不作判据(判序沿用原实现)。
  }
}

/** 客户端生命周期依赖面(测试全部注入,绝不真关/真开本机程序) */
export interface ClientLifecycle {
  probe?: () => string[]
  close?: (imageName: string) => void
  forceClose?: (imageName: string) => void
  /**
   * 按映像名枚举**当前**在跑的 PID。默认实现走 `tasklist /FI`,只读不杀。
   * 为什么要它:`taskkill /IM <名>` 的参数只能是裸文件名、不接受路径,一发下去命中的是
   * "所有叫这个名字的进程" —— 本机 WorkBuddy 就有国内版与国际版两套不同安装(不同身份/不同
   * 数据目录),按名杀会连带关掉本不该动的实例(守门 52 的 N1 维立的正是这一型)。
   * 改成"先枚举、再逐个 /PID 杀"之后:杀的对象与日志里的对象是同一批,枚举不到就拒绝动手。
   */
  listPids?: (imageName: string) => number[]
  launch?: (exe: string) => { ok: boolean; error?: string }
  resolveExe?: () => ResolvedClientExe
  intervalMs?: number
  /** 优雅关闭等待上限(超过即强制关闭兜底) */
  gracefulMs?: number
  /** 强制关闭后等待上限 */
  forceWaitMs?: number
  timeoutMs?: number
}

export interface CloseClientResult {
  /** 关闭前检测到的进程数(0 = 本来就没开) */
  runningBefore: number
  ok: boolean
  waitedMs: number
  /** 是否动用了强制关闭(WM_CLOSE 之后主进程仍不退) */
  forced?: boolean
  error?: string
}

/**
 * 切号前置:关闭 WorkBuddy 并等进程全部退出。
 *
 * 两段式:先发 WM_CLOSE(taskkill 不带 /F),等 `gracefulMs`;主进程仍不退则 `/F` 强制兜底。
 * 为什么要兜底 —— 2026-10-30 真机实测:WorkBuddy 主进程收到 WM_CLOSE 后不退出(托盘常驻),
 * 25s 后 7 个进程仍在;只优雅关闭 = 一键切号永远失败。
 * 强杀风险:会话是 jsonl 追加写,且切号本就要求客户端停写,可接受;forced 会如实回报给用户。
 * 关不掉(两段都失败)时调用方必须中止切换 —— 此时登录态一个字节都还没改。
 */
export function closeClientAndWait(opts: ClientLifecycle = {}): CloseClientResult {
  const probe = opts.probe ?? (() => detectClientProcesses())
  const before = probe()
  if (before.length === 0) return { runningBefore: 0, ok: true, waitedMs: 0 }
  const image = before[0] ?? 'WorkBuddy.exe'
  const interval = opts.intervalMs ?? 500
  if (opts.close) {
    try {
      opts.close(image)
    } catch (e) {
      return {
        runningBefore: before.length,
        ok: false,
        waitedMs: 0,
        error: `关闭命令失败: ${errMsg(e)}`,
      }
    }
  } else {
    // 平台闸只对默认实现成立:注入 close 时由调用方接管(测试在 Linux CI 也能跑同一判据)
    if (process.platform !== 'win32') {
      return {
        runningBefore: before.length,
        ok: false,
        waitedMs: 0,
        error: '仅 Windows 支持自动关闭客户端,请手动退出 WorkBuddy 后重试',
      }
    }
    const targets = (opts.listPids ?? listPidsByImage)(image)
    if (targets.length === 0) {
      // 枚举不到就不杀 —— 宁可失败并中止切换(登录态一个字节都没动),也不按映像名扫全场
      return {
        runningBefore: before.length,
        ok: false,
        waitedMs: 0,
        error: `枚举不到 "${image}" 的 PID ⇒ 拒绝按映像名杀进程(taskkill /IM 只收裸文件名、不接受路径,一发会命中所有同名安装;本机 WorkBuddy 国内版/国际版即此型)`,
      }
    }
    // 不带 /T、不带 /F:逐个 PID 发 WM_CLOSE(原写法 /IM 会把同名进程一次全扫,见 listPidsByImage 注)
    for (const pid of targets) killPid(pid, false)
  }

  const pollUntil = (deadlineMs: number): void => {
    while (alive.length > 0 && waited < deadlineMs) {
      sleepSync(interval)
      waited += interval
      alive = probe()
    }
  }
  let waited = 0
  let alive = probe()
  const gracefulMs = opts.gracefulMs ?? 8_000
  pollUntil(gracefulMs)

  let forced = false
  // 注入 forceClose 时允许测试覆盖强制腿;生产两者都不注入 ⇒ 默认按 PID 强制关闭
  if (alive.length > 0 && (opts.forceClose || !opts.close)) {
    forced = true
    // 强制腿**重新枚举**:优雅腿之后还活着的那些才是目标(按名杀会连刚起的同名新进程一起扫,
    // 所以这里同样只认列出来的 PID)。
    if (opts.forceClose) opts.forceClose(image)
    else for (const pid of (opts.listPids ?? listPidsByImage)(image)) killPid(pid, true)
    pollUntil(gracefulMs + (opts.forceWaitMs ?? 8_000))
  }

  if (alive.length > 0) {
    return {
      runningBefore: before.length,
      ok: false,
      waitedMs: waited,
      forced,
      error: `已等待 ${Math.round(waited / 1000)}s 仍有 ${alive.length} 个进程存活(可能有未保存会话),请手动退出后重试`,
    }
  }
  return { runningBefore: before.length, ok: true, waitedMs: waited, forced }
}

/** 从注册表卸载项读客户端 exe;读不到返回 undefined,绝不抛 */
function queryClientExeFromRegistry(): string | undefined {
  if (process.platform !== 'win32') return undefined
  const roots = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ]
  for (const root of roots) {
    try {
      const out = execFileSync('reg', ['query', root, '/s', '/f', 'WorkBuddy', '/t', 'REG_SZ'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      })
      for (const block of out.split(/\r?\n\r?\n/)) {
        if (!/DisplayName\s+REG_SZ\s+.*WorkBuddy/i.test(block)) continue
        const m = /DisplayIcon\s+REG_SZ\s+(.+?)(?:,\s*-?\d+)?\s*$/m.exec(block)
        const p = m?.[1]?.trim().replace(/^"|"$/g, '')
        if (p && /\.exe$/i.test(p)) return p
      }
    } catch {
      // 该根不可读就试下一个;三层全部落空 = 未找到,由调用方提示手动打开
    }
  }
  return undefined
}

export interface ResolvedClientExe {
  path?: string
  source: string
}

/** 客户端 exe 三层解析:环境变量 > 注册表卸载项 > 标准安装位(机器事实现读,不写死盘符) */
export function resolveClientExe(
  opts: {
    env?: NodeJS.ProcessEnv
    queryRegistry?: () => string | undefined
    exists?: (p: string) => boolean
  } = {},
): ResolvedClientExe {
  const env = opts.env ?? process.env
  const exists = opts.exists ?? existsSync
  const fromEnv = env['IHUI_WORKBUDDY_EXE']
  if (fromEnv && exists(fromEnv)) return { path: fromEnv, source: 'env:IHUI_WORKBUDDY_EXE' }
  const reg = (opts.queryRegistry ?? queryClientExeFromRegistry)()
  if (reg && exists(reg)) return { path: reg, source: 'registry' }
  const localAppData = env['LOCALAPPDATA'] ?? ''
  const candidates = [
    localAppData ? join(localAppData, 'Programs', 'WorkBuddy', 'WorkBuddy.exe') : '',
    'C:\\Program Files\\WorkBuddy\\WorkBuddy.exe',
    'C:\\Program Files (x86)\\WorkBuddy\\WorkBuddy.exe',
  ]
  for (const c of candidates) {
    if (c && exists(c)) return { path: c, source: 'candidate' }
  }
  return { source: 'not-found' }
}

/** 拉起客户端(独立进程,不随本脚本退出) */
export function launchClient(exe: string): { ok: boolean; error?: string } {
  try {
    const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false })
    child.unref()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

export function main(
  argv: string[],
  pathsOverride?: SwitchPaths,
  deps: SwitchMainDeps = {},
): number {
  const paths = pathsOverride ?? defaultSwitchPaths()
  const toIdx = argv.indexOf('--to')
  const apply = argv.includes('--apply')
  const oneClick = argv.includes('--one-click')
  // --one-click 隐含换桶(带对话过去 + 自动建会话库快照);否则沿用显式 --with-sessions
  const withSessions = argv.includes('--with-sessions') || oneClick
  // 客户端生命周期由外层启动器显式传入(桌面双击场景);不隐含在 --one-click 里,守门/CI 不误关本机程序
  const closeClient = argv.includes('--close-client')
  const restartClient = argv.includes('--restart-client')
  const lifecycle = deps.clientLifecycle ?? {}
  const lines: string[] = []
  let targetName: string | undefined
  if (toIdx === -1) {
    const { current, targets } = listSwitchTargets(paths)
    if (!oneClick) {
      lines.push(`当前 auth 文件: ${paths.authFile}`)
      if (current) lines.push(fmtTarget(current))
      else lines.push('(当前文件不存在或不可解析)')
      lines.push(`快照库: ${paths.backupsDir}(${targets.length} 份,新→旧)`)
      for (const t of targets) lines.push(fmtTarget(t))
      lines.push('切换: relay:switch-account --to <快照名> [--apply](不带 --apply 只出计划)')
      console.log(lines.join('\n'))
      return 0
    }
    if (targets.length === 0) {
      console.error('快照库为空,无可切换账号;先让目标账号登录过以生成快照')
      return 2
    }
    if (process.stdin.isTTY) {
      console.log(`可切换账号(${targets.length}):`)
      targets.forEach((t, i) => console.log(`  [${i + 1}] ${fmtTarget(t)}`))
      const ans = readLineSync('输入序号或快照名切到: ').trim()
      if (!ans) {
        console.error('未选择,已取消')
        return 2
      }
      const byNum = Number(ans)
      if (Number.isInteger(byNum) && byNum >= 1 && byNum <= targets.length) {
        targetName = targets[byNum - 1]?.name
      } else {
        const hit = targets.find((t) => t.name === ans)
        if (!hit) {
          console.error(`未匹配到快照: ${ans}`)
          return 2
        }
        targetName = hit.name
      }
    } else {
      console.log('一键模式需指定目标: relay:switch-account --one-click --to <快照名> --apply')
      console.log(`或在本机终端运行以交互选择。当前快照库(${targets.length} 份):`)
      for (const t of targets) console.log(fmtTarget(t))
      return 2
    }
  } else {
    targetName = argv[toIdx + 1]
  }
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
  // 一键模式会自动换桶,移除计划里"会话面不会自动跟随"的误导提示
  if (oneClick) {
    plan.warnings = plan.warnings.filter((w) => !w.includes('会话面不会自动跟随'))
  }
  lines.push(
    `计划: ${plan.authFile}\n  ← ${plan.targetName}\n  备份当前 → ${plan.backupPath}`,
    ...plan.warnings.map((w) => `  ⚠ ${w}`),
  )
  // 一键 + apply:先确保当日会话库快照(换桶红线的硬性前提),失败即中止(不改动登录态)
  if (oneClick && apply) {
    const ensured = ensureSessionBackup(deps.now ?? new Date(), deps.home)
    if (!ensured.ok) {
      console.error(`⚠ 一键模式: 建立会话库快照失败,中止(未改动任何登录态): ${ensured.error}`)
      return 1
    }
    lines.push(`会话库快照已就绪: ${ensured.path ?? '(已有当日快照)'}`)
  }
  if (!apply) {
    if (withSessions) {
      lines.push(
        oneClick
          ? '(一键模式: 加 --apply 即自动建会话库快照并切号+换桶)'
          : '(联动换桶: 加 --apply 后 auth 切换成功即自动换会话桶;换桶失败回滚 auth)',
      )
    }
    lines.push('(dry-run,未写盘;确认后加 --apply)')
    console.log(lines.join('\n'))
    return 0
  }
  // 客户端生命周期:切号前必须让客户端退出 —— 否则客户端退出时用旧登录态覆盖 auth,
  // 且换桶会因客户端存续闸直接回滚(见 runLinkedSessionSwap)。失败即中止,登录态未动。
  let closedClient = false
  if (closeClient) {
    const c = closeClientAndWait(lifecycle)
    if (!c.ok) {
      console.error(`⚠ 关闭 WorkBuddy 失败,已中止(登录态未改动): ${c.error}`)
      return 1
    }
    closedClient = c.runningBefore > 0
    if (closedClient) {
      console.log(
        c.forced
          ? `已强制关闭 WorkBuddy(${c.runningBefore} 个进程未响应优雅退出,耗时 ${Math.round(c.waitedMs / 1000)}s)`
          : `已关闭 WorkBuddy(${c.runningBefore} 个进程,等待 ${Math.round(c.waitedMs / 1000)}s 退出)`,
      )
    }
  }
  /** 收尾:按 --restart-client 重新拉起客户端(切换成功与失败都要还机主一个可用客户端) */
  const finish = (code: number): number => {
    if (restartClient && closedClient) {
      const exe = (lifecycle.resolveExe ?? resolveClientExe)()
      if (!exe.path) {
        console.log('⚠ 未找到 WorkBuddy 安装路径(可设 IHUI_WORKBUDDY_EXE),请手动打开客户端')
      } else {
        const r = (lifecycle.launch ?? launchClient)(exe.path)
        console.log(
          r.ok
            ? `已重新启动 WorkBuddy: ${exe.path}`
            : `⚠ 启动 WorkBuddy 失败: ${r.error}(请手动打开)`,
        )
      }
    }
    return code
  }
  const out = applySwitch(plan)
  if (!out.ok) {
    console.error(`切换失败: ${out.error}`)
    return finish(1)
  }
  const switchedLine = `✅ 已切换: 现生效 sha=${out.newSha12};旧登录态备份于 ${out.backupPath};请重启 WorkBuddy 桌面端`
  if (!withSessions) {
    console.log([...lines, switchedLine].join('\n'))
    return finish(0)
  }
  // --with-sessions / 一键:auth 已切 ⇒ 联动换桶(失败回滚 auth)
  const swapDeps = {
    movePaths: deps.movePaths ?? defaultMovePaths(),
    now: deps.now ?? new Date(),
    runningProcs: deps.runningProcs ?? detectClientProcesses(),
  }
  const res = runLinkedSessionSwap(plan, swapDeps)
  if (res.status === 'rolled-back' || res.status === 'rollback-failed') {
    // auth 已回滚(或回滚失败)⇒ 不再声明"已切换";dry-run 那行的会话面从未动过
    console.error(`⚠ 会话联动: ${res.message}`)
    console.log(lines.join('\n'))
    return finish(1)
  }
  const tail =
    res.status === 'swapped'
      ? `✅ 会话联动: ${res.message}`
      : res.status === 'skipped-same-account'
        ? `ℹ 会话联动: ${res.message}`
        : res.status === 'skipped-not-in-ledger'
          ? `ℹ 会话联动: ${res.message}(补台账:pnpm relay:session-links rebuild --auto,再 relay:session-move swap --to <uid>)`
          : `⚠ 会话联动: ${res.message}`
  console.log([...lines, switchedLine, tail].join('\n'))
  return finish(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
