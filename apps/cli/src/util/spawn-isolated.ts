// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Isolated Subprocess Spawning — 跨平台带超时的子进程隔离执行。
 *
 * 简化策略(做减法):
 *   - 0 外部依赖(无 shell-quote / tree-kill),用 Node 内置 child_process
 *   - 跨平台进程组清理:Unix 用 kill(-pid) 发给进程组;Windows 用 taskkill /T /F 杀进程树
 *   - 超时:用 setTimeout race Promise,触发后立即强制 kill + reap
 *   - stdin payload:支持(可空)— 大输入走 pipe 避免一次性载入内存
 *   - 大输入不阻塞 wait:写到 child.stdin 后立即 close,无需 scoped thread(JS 单线程)
 *   - 失败路径必清理:无论超时 / 错误退出 / 启动失败,child 必被 kill(无僵尸)
 *
 * 使用场景:
 *   - `apps/cli/src/mermaid/index.ts` 替换 MmdcCliEngine.runMmdc — 杀掉 mmdc 派生的 Chromium 进程
 *   - 任何 spawn 后需要强制 kill 的工具(代码检查器、git hook、formatter)
 *
 * 关键差异(对标 mermaid/index.ts:184-212):
 *   - 旧实现:`proc.kill('SIGTERM')` 只能杀主进程,Chromium 派生的 headless 子进程会泄漏
 *   - 新实现:Windows taskkill /T + Unix kill(-pid) 整组杀干净
 *   - 旧实现:超时后没等 child 真正退出就 resolve,可能泄露 fd
 *   - 新实现:超时后必 reap(同步 wait 最多 2s),再 reject
 */

import { execFile, spawn, type ChildProcess, type StdioOptions } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as os from 'node:os'
// G-695:等 close 的站点必须走补发器 —— once('close') 挂在已 fire 的 EventEmitter 上永不触发。
import { createCloseEventController, type CloseEvent } from './close-event.js'

/** 子进程执行失败原因 */
export type SubprocessFailureReason =
  | 'spawn' // 启动失败(binary 缺失 / fork 失败)
  | 'timeout' // 超时被杀
  | 'nonzero' // 退出码非 0
  | 'wait' // wait 失败

/** 子进程执行结果 */
export interface IsolatedSubprocessResult {
  /** 退出码(成功时为 0) */
  exitCode: number
  /** stdout 收集到的字节 */
  stdout: Buffer
  /** stderr 收集到的字节 */
  stderr: Buffer
  /** 进程名 / 路径 */
  command: string
  /** 传入的参数 */
  args: string[]
  /** 总耗时(毫秒) */
  durationMs: number
}

/** 子进程执行失败 */
export interface IsolatedSubprocessError extends Error {
  reason: SubprocessFailureReason
  command: string
  args: string[]
  /** 超时时为 timeout,非零时为 exitCode,其他为 0 */
  exitCode: number
  stdout: Buffer
  stderr: Buffer
  durationMs: number
}

/** spawnIsolated 的可选项 */
export interface IsolatedSubprocessOptions {
  /** 超时毫秒(默认 30000) */
  timeoutMs?: number
  /** stdin 要写入的内容(可空) */
  stdin?: Buffer | string
  /** 工作目录 */
  cwd?: string
  /** 透传环境变量(默认继承 process.env) */
  env?: NodeJS.ProcessEnv
  /** 强制 detached(创建新进程组);默认 true(进程隔离 + 杀组) */
  detached?: boolean
  /** stdio 配置(默认 ['pipe','pipe','pipe']) */
  stdio?: StdioOptions
  /** 等待 reap 的最长时间(杀进程后到确认退出的最大等待,默认 2000ms) */
  reapTimeoutMs?: number
  /**
   * G-998133:kill 清理结算的绝对 deadline(Date.now 基准,工具执行预算面传导进
   * kill 清理)。给出后 force 升级在 ≤ min(FORCE_EXIT 宽限, 绝对剩余) 内结算;
   * 缺省无绝对约束(行为与旧版一致)。
   */
  cleanupDeadlineMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_REAP_TIMEOUT_MS = 2_000
const ETXTBSY_RETRY_MAX = 5
const ETXTBSY_BACKOFF_MS = 20

/**
 * 创建带原因标记的 Error 对象(便于上层 instanceof + 字段访问)。
 */
function makeError(
  reason: SubprocessFailureReason,
  msg: string,
  ctx: Omit<IsolatedSubprocessError, 'reason' | 'name' | 'message'>,
): IsolatedSubprocessError {
  const err = new Error(msg) as IsolatedSubprocessError
  err.reason = reason
  err.command = ctx.command
  err.args = ctx.args
  err.exitCode = ctx.exitCode
  err.stdout = ctx.stdout
  err.stderr = ctx.stderr
  err.durationMs = ctx.durationMs
  err.name = 'IsolatedSubprocessError'
  return err
}

/**
 * 跨平台强制杀掉整个进程组(不留 zombie / 孤儿 Chromium)。
 *
 * Unix: `kill(-pid, SIGKILL)` — `detached: true` 让 child 自成进程组,负 pid 即组 ID
 * Windows: `taskkill /pid <pid> /T /F` — Windows 没有 process group 概念,用 /T 杀进程树
 *
 * G-690(2026-09-29)`export`:MCP stdio 子进程此前自己写 `child.kill()`,只杀得掉 npx/cmd 壳,
 * 壳派生的 node 子进程永留。机制早就在这份文件里,缺的只是出口 —— 按 AGENTS §3「复用现有实现」
 * 加 export 而**不是**在调用端另抄一份杀进程树逻辑(两处算同一件事必漂移)。
 * 调用端配合条件:`detached: true` 只在 Unix 侧有意义(Windows 无进程组,靠 /T)。
 */
export function killProcessTree(child: ChildProcess): void {
  // G-998130(上游 processTreeOwnership.ts:66-96 判据):child 已被观察到退出
  // (exitCode/signalCode 非 null)⇒ 目标集为空,本轮回收永久 fail closed ——
  // 原 PID 此刻可能已被无关进程复用,沿裸 PID 派生 taskkill /T 会把那棵树认领成本端 runtime。
  if (child.exitCode !== null || child.signalCode !== null) return
  if (!child.pid) return
  if (os.platform() === 'win32') {
    try {
      // taskkill 是 Windows 内置命令,/T 杀子进程树,/F 强制
      const tk = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      tk.on('error', () => {
        // taskkill 失败时回退到直接 kill(虽然会漏子进程,但不会泄漏主进程)
        try { child.kill('SIGTERM') } catch {}
        try { child.kill('SIGKILL') } catch {}
      })
    } catch {
      try { child.kill('SIGTERM') } catch {}
      try { child.kill('SIGKILL') } catch {}
    }
    return
  }
  // Unix: detached=true 时 child 是进程组 leader,负号 pid 即组
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    // b75-4#9:组 kill 失败分两说 —— ESRCH=组已消亡,补刀无的放矢;EPERM 等=组仍存活
    // (无权发信号 ≠ 组已死),才退到单进程补刀。旧写法不看存活性一律补刀。
    if (isPosixProcessGroupAlive(child.pid)) {
      try { child.kill('SIGKILL') } catch {}
    }
  }
}

/**
 * b75-4#9(观察票):`process.kill(-pgid, 0)` 探测 POSIX 进程组是否仍存活。
 * 信号 0 不杀伤、只探权:probe 抛 ESRCH ⇒ 组已消亡;EPERM ⇒ 组存活但本进程无权发信号
 * (上游 ZCode process-tree 判据:无权发信号 ≠ 组已死);其余错误码拿不准 ⇒ 按"存活"
 * 处理(fail-safe:宁可补刀,不可漏杀)。Windows 无进程组语义,由调用方分支;
 * probe 可注入,单测在不真杀进程的前提下驱动判定。
 */
export function isPosixProcessGroupAlive(
  pgid: number,
  probe: (pgid: number) => void = (p) => { process.kill(-p, 0) },
): boolean {
  try {
    probe(pgid)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

// =============================================================================
// G-998130(票1):force 只打"已验证目标集",身份核不上时禁止沿裸 PID 杀进程树。
// 上游判据(processTreeOwnership.ts:66-96,122-129 / processTreeTerminator.ts:51,
// 59-61,190-197,260-301,439-460):
//   - child 已被观察到退出(exitCode/signalCode 非 null)或 force 轮 ⇒ 凡没有
//     生前固定的 root 身份就返回空目标集,本轮回收永久 fail closed;
//   - Windows force 前在预留 750ms 预算内逐 PID 定向 CIM 复核 CreationDate,
//     本次仍匹配者才进 /F,查询失败者交 waiter 报残留但绝不做 /F 目标;
//   - 身份查询整体失败 ⇒ unverifiedRootOnly:只观察原 ChildProcess,
//     禁止向裸 PID 发 taskkill;
//   - POSIX 终判同口径:只有最终复核仍含 root 才能向 root 发信号,禁止信任过期布尔。
// 创建标识取值:win32 用 CIM CreationDate(DMTF 串,微秒档);linux 用
// /proc/<pid>/stat 第 22 字段 starttime(boot tick,同秒复用可分辨);
// 其余平台量不到 ⇒ null(⇒ 一律 fail closed 只观察)。
// 注:apps 侧按架构契约不得向上摸 scripts/lib/proc-identity.mjs,故此处复刻其
// 三态纪律而非其实现(与 apps/api/src/utils/kill-verified.ts 头注同一口径)。
// =============================================================================

/** 现测某 pid 在进程表中的创建标识;进程不在/查询失败 ⇒ null(⇒ 未判定)。 */
export type CreationIdentityProbe = (pid: number) => Promise<string | null>

const CREATION_IDENTITY_NONE = 'IHUI-CI-NONE'
const CREATION_IDENTITY_PFX = 'IHUI-CI='
/** win32 身份复核预算(对齐上游 force 轮的 750ms 预留)。 */
const CREATION_IDENTITY_RECHECK_BUDGET_MS = 750

/**
 * root 生前(尚在本端所有权内、未发任何信号前)固定的创建标识登记表。
 * spawnIsolated 在 spawn 成功后采集(fire-and-forget);killProcessTreeVerified
 * 在 deps 未显式给 preMortemCreationIdentity 时从这里取。
 */
const preMortemCreationIdentityRegistry = new WeakMap<ChildProcess, string>()

export function recordRootCreationIdentity(child: ChildProcess, identity: string): void {
  preMortemCreationIdentityRegistry.set(child, identity)
}

/**
 * 生前快照采集:spawn 成功后尽快调一次。失败静默返回 null —— 回收时按
 * "无生前身份" fail closed 处理,绝不因快照缺位而放宽成裸 PID 击杀。
 */
export async function captureRootCreationIdentity(
  child: ChildProcess,
  probe: CreationIdentityProbe = defaultCreationIdentityProbe,
): Promise<string | null> {
  if (!child.pid) return null
  const identity = await probe(child.pid)
  if (identity !== null) recordRootCreationIdentity(child, identity)
  return identity
}

/**
 * win32 CIM 创建身份探针的引擎候选(全部绝对路径 —— 该身份参与回收时 fail-closed
 * 击杀对账,PATH 解析可被顶替 ⇒ 身份可被伪造,故不落 PATH 短名)。pwsh(PS7)优先:
 * WDAC/应用控制策略可能拦截 node 派生的 powershell.exe(5.1)而放行 PS7(本仓开发机
 * 实证 spawn EPERM;apps/api kill-verified.ts 与 mcp-credentials.ts 引擎链同款结论);
 * powershell.exe 绝对路径兜底覆盖未装 PS7 的常规镜像。存在性预筛。
 */
function creationIdentityProbeCandidates(): string[] {
  const list: string[] = []
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  for (const candidate of [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    localAppData === '' ? '' : join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe'),
  ]) {
    if (candidate !== '' && existsSync(candidate)) list.push(candidate)
  }
  list.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  return list
}

/**
 * 默认创建标识探针。win32:PowerShell CIM CreationDate(DMTF 串,含微秒档);
 * linux:/proc/<pid>/stat 第 22 字段 starttime;其余平台 ⇒ null(未判定)。
 * 探针自身永不 reject(失败折成 null),stdio 按 EBUSY 纪律 stdin 用 'ignore'。
 * win32 引擎 pwsh(PS7)优先、powershell.exe 绝对路径兜底 —— WDAC/应用控制策略
 * 主机拦截 node 派生的 powershell.exe(5.1)报 EPERM(本仓开发机实证),见
 * creationIdentityProbeCandidates;仅 spawn 即时失败回退下一候选,其余失败仍折 null。
 */
export const defaultCreationIdentityProbe: CreationIdentityProbe = async (pid) => {
  const osPlatform = os.platform()
  if (osPlatform === 'win32') {
    const script =
      `$ErrorActionPreference='Stop';` +
      `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";` +
      `if($null -eq $p){'${CREATION_IDENTITY_NONE}'}else{` +
      `'${CREATION_IDENTITY_PFX}'+[System.Management.ManagementDateTimeConverter]::ToDmtfDateTime($p.CreationDate)}`
    const attemptOnce = (command: string): Promise<string | null> =>
      new Promise<string | null>((resolve, reject) => {
        execFile(
          command,
          ['-NoProfile', '-NonInteractive', '-Command', script],
          { timeout: 5_000, shell: false, windowsHide: true, maxBuffer: 1 << 20 },
          (err, out) => {
            if (err) {
              // spawn 即时失败(WDAC 拦截 EPERM / 未装 ENOENT / 无权 EACCES)⇒ reject 让
              // 外层回退下一候选;超时/非零退出不回退(不放大时长),仍折 null(fail closed)。
              const code = (err as NodeJS.ErrnoException).code
              if (code === 'EPERM' || code === 'ENOENT' || code === 'EACCES') return reject(err)
              return resolve(null)
            }
            for (const line of String(out).split(/\r?\n/)) {
              const l = line.trim()
              if (l === CREATION_IDENTITY_NONE) return resolve(null)
              if (l.startsWith(CREATION_IDENTITY_PFX)) {
                const v = l.slice(CREATION_IDENTITY_PFX.length).trim()
                return resolve(v === '' ? null : v)
              }
            }
            return resolve(null)
          },
        )
      })
    for (const command of creationIdentityProbeCandidates()) {
      try {
        return await attemptOnce(command)
      } catch {
        continue
      }
    }
    return null
  }
  if (osPlatform === 'linux') {
    try {
      // stat:pid (comm) state ppid ... starttime(第 22 字段);comm 可含空格,从最后一个 ')' 后取
      const stat = readFileSync(`/proc/${pid}/stat`, 'latin1')
      const tail = stat.slice(stat.lastIndexOf(')') + 1).trim().split(' ')
      // ')' 后首字段是 state(第 3 字段),starttime(第 22 字段)偏移 22-3=19
      const starttime = tail[19]
      return starttime ? `linux-starttick:${starttime}` : null
    } catch {
      return null
    }
  }
  return null
}

/** 给复核口套 750ms 预算:超时按"查询失败"同侧处理(不拖死 force 轮)。 */
function withRecheckBudget(p: Promise<string | null>, ms: number): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`creation-identity 复核预算耗尽(${ms}ms)`)), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export interface ProcessTreeKillDeps {
  /** 生前固定的 root 创建标识;缺省从登记表取(spawnIsolated 已在 spawn 时采集)。 */
  preMortemCreationIdentity?: string | null
  /** 身份复核口(缺省 defaultCreationIdentityProbe,按当次平台取数)。 */
  queryCreationIdentity?: CreationIdentityProbe
  /** force 派生口(缺省:win32 taskkill /T /F,POSIX kill(-pid, SIGKILL));注入 spy 断言派生与否。 */
  deriveForceKill?: (pid: number) => void
  /** 平台判定注入(缺省 os.platform());单测在不换真机的前提下驱动 win32/posix 分支。 */
  platform?: () => string
  /** win32/posix 复核预算毫秒(缺省 750,对齐上游 force 轮预算)。 */
  recheckBudgetMs?: number
}

export type ProcessTreeKillOutcome =
  | { childStillOwned: false; action: 'skipped-already-exited'; pid: number | null; detail: string }
  | { childStillOwned: false; action: 'identity-mismatch-target-set-empty'; pid: number; detail: string }
  | { childStillOwned: true; action: 'unverified-root-only'; pid: number; detail: string }
  | { childStillOwned: true; action: 'force-kill-derived'; pid: number; detail: string }

function defaultDeriveForceKill(pid: number, isWin: boolean): void {
  if (isWin) {
    // 仅对该已验证目标集派生 /F;stdio 'ignore'(EBUSY 纪律),失败静默交 waiter 报残留
    const tk = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    tk.on('error', () => {})
    return
  }
  // POSIX 终判已确认 root 仍在复核集合内才走到这:组信号为主,组已消亡(ESRCH)不补刀单进程
  try {
    process.kill(-pid, 'SIGKILL')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ESRCH') {
      try { process.kill(pid, 'SIGKILL') } catch { /* 已死:忽略 */ }
    }
  }
}

/**
 * 受管进程树回收的"已验证目标集"形态(票1 的回收层;接线归 G-690 域):
 * 观察退出态 → 取生前身份 → 750ms 预算内现测创建标识 → 仍匹配才派生 force;
 * 任何一环核不上 ⇒ 不派生任何 taskkill/kill,只观察原 ChildProcess(waiter 报残留)。
 */
export async function killProcessTreeVerified(
  child: ChildProcess,
  deps: ProcessTreeKillDeps = {},
): Promise<ProcessTreeKillOutcome> {
  const isWin = (deps.platform ?? (() => os.platform()))() === 'win32'
  const pid = typeof child.pid === 'number' ? child.pid : null
  // ① 已观察到退出 ⇒ 空目标集(永久 fail closed,不信任任何过期布尔)
  if (child.exitCode !== null || child.signalCode !== null) {
    return {
      childStillOwned: false,
      action: 'skipped-already-exited',
      pid,
      detail:
        `root 已被观察到退出(exitCode=${String(child.exitCode)},signalCode=${String(child.signalCode)})` +
        `⇒ 目标集为空:本轮回收永久 fail closed,不沿裸 PID 派生任何 taskkill/kill`,
    }
  }
  if (pid === null) {
    return {
      childStillOwned: false,
      action: 'skipped-already-exited',
      pid: null,
      detail: 'child 无 pid(未成功 spawn)⇒ 无目标集,不派生任何信号',
    }
  }
  // ② 生前身份:deps 显式给,或登记表里 spawn 时采集的快照;都没有 ⇒ 凡无身份不进 /F
  const expected =
    'preMortemCreationIdentity' in deps
      ? deps.preMortemCreationIdentity
      : preMortemCreationIdentityRegistry.get(child)
  if (expected === undefined || expected === null) {
    return {
      childStillOwned: true,
      action: 'unverified-root-only',
      pid,
      detail:
        `pid ${pid} 无生前固定的 root 创建标识(deps 与生前登记表均缺位)⇒ 目标集为空:` +
        `只观察原 ChildProcess,禁止向裸 PID 发 taskkill/kill(waiter 报残留)`,
    }
  }
  // ③ 现测创建标识(预算内);整体失败 ⇒ unverifiedRootOnly
  const query = deps.queryCreationIdentity ?? defaultCreationIdentityProbe
  let current: string | null
  try {
    current = await withRecheckBudget(
      Promise.resolve(query(pid)),
      deps.recheckBudgetMs ?? CREATION_IDENTITY_RECHECK_BUDGET_MS,
    )
  } catch (e) {
    return {
      childStillOwned: true,
      action: 'unverified-root-only',
      pid,
      detail:
        `pid ${pid} 身份查询整体失败(${e instanceof Error ? e.message : String(e)})⇒ unverifiedRootOnly:` +
        `只观察原 ChildProcess,禁止向裸 PID 发 taskkill(waiter 报残留)`,
    }
  }
  if (current === null) {
    return {
      childStillOwned: true,
      action: 'unverified-root-only',
      pid,
      detail:
        `pid ${pid} 现测创建标识取不到(进程不在或探针失败)⇒ 未判定:不进 /F,交 waiter 报残留`,
    }
  }
  // ④ 现测 ≠ 生前 ⇒ 原 PID 已复用,目标集为空(票面夹具 (a) 的判尸据)
  if (current !== expected) {
    return {
      childStillOwned: false,
      action: 'identity-mismatch-target-set-empty',
      pid,
      detail:
        `pid ${pid} 现测创建标识(${current})≠ 生前记录(${expected})⇒ 原 PID 已被复用,目标集为空:` +
        `不派生任何 taskkill/kill`,
    }
  }
  // ⑤ 复核仍匹配 ⇒ 只对该已验证目标集派生 force
  const derive = deps.deriveForceKill ?? ((p: number) => defaultDeriveForceKill(p, isWin))
  derive(pid)
  return {
    childStillOwned: true,
    action: 'force-kill-derived',
    pid,
    detail:
      `pid ${pid} 创建标识复核仍匹配(${current})⇒ 仅对该已验证目标集派生 force` +
      `(${isWin ? 'taskkill /T /F' : 'kill(-pid, SIGKILL)'})`,
  }
}

/**
 * 等 child 退出(最多 reapTimeoutMs),未退出则强制 SIGKILL。
 * 跨平台兼容:Node 的 child.exit / close 事件已封装 reap,只需 await。
 *
 * G-695:closeEvent 是"这一件事有没有发生过"的补发面。调用点若晚于真实 close
 * (成功路径就是这样 —— close 已被上面的 exitPromise 观察到),只挂 once('close')
 * 会永不触发,只能白等满 reapTimeoutMs;补发面让晚订阅者在微任务内立即结算。
 * 传不传都保留 exit/close 两个原生订阅(判据只加不减:早订阅者的行为逐字不变)。
 */
function awaitReap(
  child: ChildProcess,
  reapTimeoutMs: number,
  closeEvent?: CloseEvent<number | null>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      subscription?.dispose()
      resolve()
    }
    child.once('exit', finish)
    child.once('close', finish)
    const subscription = closeEvent?.(finish)
    // 兜底:即便没收到 exit/close(极端情况),reapTimeoutMs 后强制 resolve
    const timer = setTimeout(finish, reapTimeoutMs)
  })
}

/** b75-4#6:FORCE_EXIT 宽限 —— 首次停止后进程/进程组仍未退,给 5s,到点升级强杀并毁流。 */
export const FORCE_EXIT_GRACE_MS = 5_000

/**
 * G-998133(拍板:要):kill 清理的纯观察档下限(上游 WINDOWS_LATE_EXIT_OBSERVATION_MS=750 同值)。
 * 语义:目标集为空(child 已被观察到退出)时**不预留满档 FORCE_EXIT 宽限**,只保这份
 * 纯观察窗口到点 —— 但不能把观察预算压得更短,否则会把随后 code=0 的正常退出误报成
 * 持久残留;绝对 deadline 剩余比它还紧时以绝对剩余为准(结算 ≤ min(相对,绝对) 是硬顶)。
 */
export const CLEANUP_OBSERVATION_FLOOR_MS = 750

/**
 * 毁掉 child 的 stdio 流(FORCE_EXIT 档)。
 * 动机:强杀后孙进程可能继承管道写端,父侧 stdout/stderr 读端永远等不到 close/end,
 * 输出收集器悬挂;显式 destroy 释放父侧 fd,读端立即解挂(票面:毁流释放 pipe 读端)。
 */
export function destroyChildOutputStreams(child: ChildProcess): void {
  for (const stream of child.stdio) {
    try { stream?.destroy() } catch { /* 已毁/未开:忽略 */ }
  }
}

/** 停止状态机的四个状态:idle=预算未武装 / running=预算已启动 / stopping=停止中(FORCE_EXIT 宽限计时) / finalized=终态已结算。 */
export type StopMachineState = 'idle' | 'running' | 'stopping' | 'finalized'

export interface StopMachineDeps {
  /** 首次停止动作:杀进程树(SIGTERM/SIGKILL 档由实现决定)。 */
  killTree: () => void
  /** FORCE_EXIT 宽限到点:升级强杀。 */
  forceKill: () => void
  /** FORCE_EXIT 宽限到点:毁 stdio 流,释放 pipe 读端。 */
  destroyStreams: () => void
  /** 定时器注入口(默认 setTimeout/clearTimeout;单测注入 fake 计时,不真等)。 */
  scheduleTimer?: (ms: number, fn: () => void) => NodeJS.Timeout
  /** 与 scheduleTimer 配对的清除口。 */
  clearTimer?: (timer: NodeJS.Timeout) => void
  /**
   * G-998133(拍板:要):工具执行预算传导面 —— kill 清理结算的绝对 deadline
   * (Date.now 基准,由调用方在清理起点固定)。给出后 force 升级在
   * ≤ min(FORCE_EXIT 宽限, 绝对剩余) 内结算;缺省无绝对约束(相对宽限照旧)。
   */
  absoluteDeadlineMs?: number
  /** 时钟注入口(缺省 Date.now;单测假钟驱动夹逼判定,不真等墙钟)。 */
  now?: () => number
  /**
   * requestStop 时刻是否存在真实信号目标(缺省恒 true)。
   * false = child 已被观察到退出 ⇒ 目标集为空:不预留满档 FORCE_EXIT 宽限,
   * 只保 CLEANUP_OBSERVATION_FLOOR_MS 纯观察窗口到点(无信号目标不预留命令超时)。
   */
  signalTargetAlive?: () => boolean
}

export interface StopMachine {
  readonly state: StopMachineState
  /** spawn 成功后调用:武装超时预算(到点先 onFire 再 requestStop)。
   *  武装前的一切卡顿(spawn 重试等)都不消耗预算 —— 这是与"spawn 前挂 timer"旧形态的边界。 */
  armTimeout(timeoutMs: number, onFire?: () => void): void
  /** 幂等请求停止:首次真正触发(killTree + 武装 FORCE_EXIT 宽限),重复调用 no-op 返回 false。 */
  requestStop(): boolean
  /** 终态结算(前台自然完成与被停后收尾共用):清空全部未决 timer。幂等。 */
  finalize(): boolean
}

/**
 * b75-4#6:执行适配器停止状态机(上游 node-execution-adapter-lifecycle 的降维落地)。
 * 不变量:
 *   - 超时预算只在 armTimeout 后存在,spawn 成功前的等待不占预算;
 *   - requestStop 幂等(stopping/finalized 一律拒绝),FORCE_EXIT 宽限只武装一次;
 *   - 宽限到点 = 升级强杀 + 毁流释放 pipe 读端(防孙进程握管道悬挂收集器);
 *   - 前台完成也必须 finalize —— 未决 timer 不许把事件循环拖过预算期。
 */
export function createStopMachine(deps: StopMachineDeps): StopMachine {
  const schedule = deps.scheduleTimer ?? ((ms: number, fn: () => void) => setTimeout(fn, ms))
  const clear = deps.clearTimer ?? ((timer: NodeJS.Timeout) => clearTimeout(timer))
  let state: StopMachineState = 'idle'
  let timeoutTimer: NodeJS.Timeout | null = null
  let forceTimer: NodeJS.Timeout | null = null

  const machine: StopMachine = {
    get state() {
      return state
    },
    armTimeout(timeoutMs, onFire) {
      if (state !== 'idle') return
      state = 'running'
      timeoutTimer = schedule(timeoutMs, () => {
        timeoutTimer = null
        onFire?.()
        machine.requestStop()
      })
    },
    requestStop() {
      if (state === 'stopping' || state === 'finalized') return false
      state = 'stopping'
      if (timeoutTimer) {
        clear(timeoutTimer)
        timeoutTimer = null
      }
      deps.killTree()
      // G-998133:双 deadline 夹逼 —— 清理结算 ≤ min(相对宽限, 绝对剩余)。
      // 上游病灶:相对预算各段(forceAfter + taskkillBudget + waitAfterForce)自顾自追加,
      // 慢查询耗尽前段后 waiter 又追加完整后段,总清理窗口突破外层 phase 预算;
      // 绝对 deadline 在本调用点(清理起点)现取剩余夹逼,结算时刻不超过它。
      const nowMs = (deps.now ?? Date.now)()
      let settleMs = FORCE_EXIT_GRACE_MS
      if (typeof deps.absoluteDeadlineMs === 'number') {
        settleMs = Math.min(settleMs, Math.max(0, deps.absoluteDeadlineMs - nowMs))
      }
      // 无信号目标不预留命令超时:目标集为空(child 已被观察到退出)⇒ 不白等满宽限,
      // 压到纯观察档并让它走完(防把随后 code=0 的退出误报成持久残留);
      // 绝对剩余更紧时以绝对剩余为准(硬顶,结算仍 ≤ min(相对, 绝对))。
      const hasSignalTarget = deps.signalTargetAlive ? deps.signalTargetAlive() : true
      if (!hasSignalTarget) {
        settleMs = Math.min(settleMs, CLEANUP_OBSERVATION_FLOOR_MS)
      }
      forceTimer = schedule(settleMs, () => {
        forceTimer = null
        deps.forceKill()
        deps.destroyStreams()
      })
      return true
    },
    finalize() {
      if (state === 'finalized') return false
      if (timeoutTimer) {
        clear(timeoutTimer)
        timeoutTimer = null
      }
      if (forceTimer) {
        clear(forceTimer)
        forceTimer = null
      }
      state = 'finalized'
      return true
    },
  }
  return machine
}

/**
 * 重试 spawn(Linux 上偶发 ETXTBSY:Text file busy,毫秒级窗口)。
 */
async function spawnWithRetry(
  command: string,
  args: string[],
  options: IsolatedSubprocessOptions,
): Promise<ChildProcess> {
  const stdio = options.stdio ?? ['pipe', 'pipe', 'pipe']
  const detached = options.detached ?? true
  let attempt = 0
   
  while (true) {
    try {
      return spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio,
        windowsHide: true,
        detached,
      })
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      // ETXTBSY 是 Linux 特有;Node 把它映射成 ENOEXEC 或 'ExecutableFileBusy'
      // 跨平台:用错误码 / 消息模糊匹配,命中时重试
      const isEtxTbsy =
        err.code === 'ETXTBSY' ||
        err.code === 'ENOEXEC' ||
        (typeof err.message === 'string' && err.message.includes('ETXTBSY'))
      if (isEtxTbsy && attempt + 1 < ETXTBSY_RETRY_MAX) {
        attempt += 1
        await new Promise<void>((r) => setTimeout(r, ETXTBSY_BACKOFF_MS * attempt))
        continue
      }
      throw err
    }
  }
}

/**
 * 隔离执行子进程 — 带超时、跨平台进程组清理、stdin payload 支持。
 *
 * 失败语义:
 *   - spawn 失败 → reject IsolatedSubprocessError{ reason: 'spawn' }
 *   - 超时 → reject IsolatedSubprocessError{ reason: 'timeout' }
 *   - 退出码 ≠ 0 → reject IsolatedSubprocessError{ reason: 'nonzero', exitCode }
 *   - wait 失败 → reject IsolatedSubprocessError{ reason: 'wait' }
 *
 * 不管哪条失败路径,child 必被 kill + reap(无 zombie / 孤儿)。
 *
 * @example
 *   const r = await spawnIsolated('mmdc', ['-i', 'in.mmd', '-o', 'out.png'], {
 *     timeoutMs: 30_000,
 *   })
 *   console.log(r.stdout.toString())
 */
export async function spawnIsolated(
  command: string,
  args: string[],
  options: IsolatedSubprocessOptions = {},
): Promise<IsolatedSubprocessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const reapTimeoutMs = options.reapTimeoutMs ?? DEFAULT_REAP_TIMEOUT_MS
  const startTime = Date.now()

  let child: ChildProcess
  try {
    child = await spawnWithRetry(command, args, options)
  } catch (e) {
    const err = e as Error
    throw makeError('spawn', `子进程启动失败: ${err.message} (${command})`, {
      command,
      args,
      exitCode: 0,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      durationMs: Date.now() - startTime,
    })
  }

  // 收集 stdout / stderr
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
  child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

  // G-695:close 的唯一权威观察点 —— 订阅发生在拿到 child 的同一帧,必然赶得上真正的事件;
  // 之后每一个"等 close"的站点(含 await 之后的晚订阅)都走这份补发器。
  // 不这么做的后果是实测的:成功路径上 close 已被 exitPromise 消费,兜底的 awaitReap
  // 只能等满整段 reap 预算(一次 `node -e void 0` 的 spawnIsolated 耗时 2073ms)。
  const closeEvt = createCloseEventController<number | null>()
  child.once('close', (code: number | null) => {
    closeEvt.fire(code)
  })

  // G-998130:生前抓 root 创建标识快照(fire-and-forget,探针自身不 reject,失败静默)。
  // 快照落在生前登记表,供 killProcessTreeVerified 在回收前做身份对账 —— 防 PID 复用误认。
  void captureRootCreationIdentity(child).catch(() => {})

  // stdin payload(如果有)— 写完即关,不阻塞 wait
  if (options.stdin !== undefined && child.stdin) {
    try {
      child.stdin.write(options.stdin)
      child.stdin.end()
    } catch {
      // 写失败通常意味着 child 已退出 — 忽略
    }
  }

  // 等待 close 事件(exit + stdio flush 完成),与 timeout 竞争
  let timedOut = false
  let waitErr: Error | null = null
  const exitPromise = new Promise<number>((resolve, reject) => {
    child.once('error', (err) => {
      waitErr = err
      reject(err)
    })
    child.once('close', (code) => {
      if (code === null || code === undefined) {
        // close 但无 exit code 通常是 signal 终止;视为 wait 失败
        if (!timedOut) reject(new Error('child closed without exit code'))
      } else {
        resolve(code)
      }
    })
  })
  // b75-4#6 停止状态机:超时预算只在 spawn 成功(含 ETXTBSY 重试在内的一切 spawn 前
  // 卡顿)之后武装;到点 requestStop(killTree)并武装 FORCE_EXIT 宽限,宽限到点升级强杀
  // + 毁流释放 pipe 读端。旧实现:超时 timer 从不清理 —— 快命令跑完后事件循环仍被挂满
  // timeoutMs;超时路径也毁不了流。
  let resolveTimeoutRace: (code: number) => void = () => {}
  const timeoutRace = new Promise<number>((resolve) => {
    resolveTimeoutRace = resolve
  })
  const stopMachine = createStopMachine({
    killTree: () => killProcessTree(child),
    forceKill: () => {
      try { child.kill('SIGKILL') } catch { /* 已死:忽略 */ }
    },
    destroyStreams: () => destroyChildOutputStreams(child),
    // G-998133:工具执行预算的绝对 deadline 传导进 kill 清理(缺省不传,行为逐字不变);
    // 真实信号目标判定与 G-998130 同一判据:exit/signal 已被观察到 ⇒ 目标集为空,
    // 清理不白等满宽限,只保观察档(防把随后 code=0 的退出误报成持久残留)。
    ...(options.cleanupDeadlineMs !== undefined
      ? { absoluteDeadlineMs: options.cleanupDeadlineMs }
      : {}),
    signalTargetAlive: () => child.exitCode === null && child.signalCode === null,
  })
  stopMachine.armTimeout(timeoutMs, () => {
    timedOut = true
    resolveTimeoutRace(-1)
  })
  // close 是"确定不用再杀"的唯一信号:结算清掉未决 timer(幂等;前台完成路径会再显式调一次)
  child.once('close', () => {
    stopMachine.finalize()
  })

  let exitCode: number
  try {
    exitCode = await Promise.race([exitPromise, timeoutRace])
  } catch (e) {
    const err = e as Error
    // 幂等:若超时已先触发过 requestStop,这里是 no-op,不会二次杀
    stopMachine.requestStop()
    await awaitReap(child, reapTimeoutMs, closeEvt.event)
    throw makeError('wait', `等待子进程退出失败: ${err.message}`, {
      command,
      args,
      exitCode: 0,
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      durationMs: Date.now() - startTime,
    })
  }
  void waitErr // waitErr 仅在 catch 路径使用,此处已通过 try/catch 捕获

  if (timedOut) {
    // requestStop 已在超时回调里 killTree,这里只等 reap。若 reap 超时仍未死,
    // FORCE_EXIT 定时器(5s)会在后台升级强杀 + 毁流;close 后 finalize 收尾。
    await awaitReap(child, reapTimeoutMs, closeEvt.event)
    throw makeError('timeout', `子进程超时(${timeoutMs}ms): ${command}`, {
      command,
      args,
      exitCode: -1,
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      durationMs: Date.now() - startTime,
    })
  }

  // 前台完成也 finalize:清掉未决的超时 timer(旧实现漏清,事件循环被挂满 timeoutMs)
  stopMachine.finalize()

  // 正常退出 — 但为防 'close' 不触发(罕见),再 awaitReap 兜底
  await awaitReap(child, reapTimeoutMs, closeEvt.event)

  const stdout = Buffer.concat(stdoutChunks)
  const stderr = Buffer.concat(stderrChunks)
  const durationMs = Date.now() - startTime

  if (exitCode !== 0) {
    throw makeError('nonzero', `子进程退出码非零(exit ${exitCode}): ${command}`, {
      command,
      args,
      exitCode,
      stdout,
      stderr,
      durationMs,
    })
  }
  return { exitCode, stdout, stderr, command, args, durationMs }
}

/**
 * 便捷包装:只关心 stdout 文本(失败抛错包含 stderr)。
 *
 * @example
 *   const out = await execText('git', ['rev-parse', 'HEAD'], { timeoutMs: 5_000 })
 */
export async function execText(
  command: string,
  args: string[],
  options?: IsolatedSubprocessOptions,
): Promise<string> {
  const r = await spawnIsolated(command, args, options)
  return r.stdout.toString('utf-8').replace(/\r?\n$/, '')
}

/**
 * 便捷包装:不抛错的版本(适合 fire-and-forget 类工具)。
 *
 * @example
 *   fireAndForget('git', ['gc', '--auto'], { timeoutMs: 60_000 })
 */
export function fireAndForget(
  command: string,
  args: string[],
  options?: IsolatedSubprocessOptions,
): void {
  spawnIsolated(command, args, options).catch(() => {
    // 静默吞错 — 用途是"让 GC 在后台跑",失败了不重要
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
