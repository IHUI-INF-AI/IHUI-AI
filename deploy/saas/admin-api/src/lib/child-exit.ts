// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { spawn, type ChildProcess } from 'node:child_process'

/**
 * 子进程退出码归一(admin-api 调 deploy/saas/scripts/*.sh 的唯一出口)。
 *
 * Node 的 `close` 事件里 code=null 表示**被信号终止**(超时/OOM/docker stop/运维 kill)。
 * 旧写法 `code ?? 0` 把「被杀」当成退出码 0 ⇒ create/restore/destroy 路由在脚本没跑完时
 * 回 `status: created/restored/destroyed` 的假成功。这里统一按失败(1)处理(fail-closed)。
 */
export function normalizeChildExit(code: number | null): number {
  return code === null ? 1 : code
}

/**
 * 脚本默认硬超时。旧 runScript 只 `spawn('bash', ...)` 就等 close —— 脚本卡死(等锁/等交互/
 * 网络挂起)时路由 Promise 永不落地,HTTP 请求永远挂起,且没有任何上限。30 分钟足够长
 * (restore 大库也在内),超出即视为失败。
 */
export const DEFAULT_SCRIPT_TIMEOUT_MS = 30 * 60 * 1000

export interface RunWithTimeoutOptions {
  command: string
  args: string[]
  timeoutMs: number
  env?: Record<string, string | undefined>
  onStdout?: (text: string) => void
  onStderr?: (text: string) => void
}

/**
 * 杀掉整棵子进程树。
 *
 * 只 `proc.kill()` 在两端都不够:Windows 上只终止 bash.exe,`sleep`/docker 等孙进程仍抱着
 * stdout/stderr 管道,Node 的 `close` 要等管道全关才触发 ⇒ 超时形同虚设(实测 400ms 阈值
 * 仍拖到 60s);Unix 上同理只杀 bash 不动孙进程。故 Windows 走 taskkill /T,Unix 用进程组。
 */
function killChildTree(proc: ChildProcess): void {
  if (!proc.pid) {
    proc.kill('SIGKILL')
    return
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {
      proc.kill('SIGKILL')
    }
  }
}

/**
 * spawn 子进程并收集输出,到 timeoutMs 未退出就杀掉整棵进程树,超时按**失败**返回。
 *
 * 出口口径与 normalizeChildExit 完全一致:被信号杀掉(code=null)⇒ 1,绝不返回 0;
 * 定时器在 close/error 两条出口都清掉,避免进程已结束后定时器仍持有事件循环与句柄。
 */
export function runWithTimeout(
  opts: RunWithTimeoutOptions,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(opts.command, opts.args, {
      env: opts.env,
      // Unix 下自成一个进程组,超时才收得掉整组孙进程(见 killChildTree)。
      detached: process.platform !== 'win32',
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      killChildTree(proc)
    }, opts.timeoutMs)

    const settle = (code: number | null, signal: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      let err = stderr
      if (code === null) err += `\n[killed by signal ${signal ?? 'unknown'}]`
      if (timedOut) err += `\n[timeout after ${opts.timeoutMs}ms]`
      resolve({ code: normalizeChildExit(code), stdout, stderr: err })
    }

    proc.stdout?.on('data', (d: Buffer) => {
      const s = d.toString()
      stdout += s
      opts.onStdout?.(s)
    })
    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString()
      stderr += s
      opts.onStderr?.(s)
    })

    proc.on('close', (code, signal) => settle(code, signal))
    proc.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
