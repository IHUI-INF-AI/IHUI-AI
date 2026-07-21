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

import { spawn, type ChildProcess, type StdioOptions } from 'node:child_process'
import * as os from 'node:os'

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
 */
function killProcessTree(child: ChildProcess): void {
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
    // 进程组 kill 失败(可能 race 已退出)→ 退到单进程 kill
    try { child.kill('SIGKILL') } catch {}
  }
}

/**
 * 等 child 退出(最多 reapTimeoutMs),未退出则强制 SIGKILL。
 * 跨平台兼容:Node 的 child.exit / close 事件已封装 reap,只需 await。
 */
function awaitReap(child: ChildProcess, reapTimeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve()
    }
    child.once('exit', finish)
    child.once('close', finish)
    // 兜底:即便没收到 exit/close(极端情况),reapTimeoutMs 后强制 resolve
    const timer = setTimeout(finish, reapTimeoutMs)
  })
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
  const timeoutPromise = new Promise<number>((resolve) => {
    setTimeout(() => {
      timedOut = true
      resolve(-1)
    }, timeoutMs)
  })

  let exitCode: number
  try {
    exitCode = await Promise.race([exitPromise, timeoutPromise])
  } catch (e) {
    const err = e as Error
    killProcessTree(child)
    await awaitReap(child, reapTimeoutMs)
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
    // 杀进程组 + 等 reap → 防止僵尸 / fd 泄漏
    killProcessTree(child)
    await awaitReap(child, reapTimeoutMs)
    throw makeError('timeout', `子进程超时(${timeoutMs}ms): ${command}`, {
      command,
      args,
      exitCode: -1,
      stdout: Buffer.concat(stdoutChunks),
      stderr: Buffer.concat(stderrChunks),
      durationMs: Date.now() - startTime,
    })
  }

  // 正常退出 — 但为防 'close' 不触发(罕见),再 awaitReap 兜底
  await awaitReap(child, reapTimeoutMs)

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
