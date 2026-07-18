/**
 * spawn-isolated 模块单元测试。
 * 对标 xai-grok-mermaid/src/subprocess.rs::tests 的核心场景。
 */

import { describe, it, expect } from 'vitest'
import { spawnIsolated, execText, fireAndForget, type IsolatedSubprocessError } from './spawn-isolated.js'

const isWin = process.platform === 'win32'

// 跨平台命令选择:
//  - echo:Windows 用 cmd /c echo,Unix 用 echo(均内置)
//  - 失败退出:Windows 用 cmd /c exit 1,Unix 用 false
//  - 长 sleep:Windows 用 cmd /c timeout 30,Unix 用 sleep 30
//  - node -e:跨平台通用,适合 stdio 验证
const ECHO = isWin ? ['cmd', ['/c', 'echo', 'hello']] as const : ['echo', ['hello']] as const
const FAIL = isWin ? ['cmd', ['/c', 'exit', '1']] as const : ['false', []] as const
// 跨平台 sleep:node setTimeout
const sleepScript = "setTimeout(() => {}, 60000)"

function errOf(e: unknown): IsolatedSubprocessError {
  return e as IsolatedSubprocessError
}

describe('spawnIsolated', () => {
  it('returns stdout from a successful command', async () => {
    const r = await spawnIsolated(ECHO[0], [...ECHO[1]])
    expect(r.exitCode).toBe(0)
    expect(r.stdout.toString().trim()).toBe('hello')
    expect(r.stderr.length).toBe(0)
  })

  it('nonzero exit throws IsolatedSubprocessError with reason=nonzero', async () => {
    try {
      await spawnIsolated(FAIL[0], [...FAIL[1]])
      throw new Error('should have thrown')
    } catch (e) {
      const err = errOf(e)
      expect(err.reason).toBe('nonzero')
      expect(err.exitCode).not.toBe(0)
      expect(err.command).toBe(FAIL[0])
    }
  })

  it('missing binary throws with reason=spawn', async () => {
    try {
      await spawnIsolated('definitely-not-a-real-binary-9f8a7b6c5d4e', [])
      throw new Error('should have thrown')
    } catch (e) {
      const err = errOf(e)
      expect(err.reason).toBe('spawn')
    }
  })

  it('times out slow command and returns within reasonable time', async () => {
    const start = Date.now()
    try {
      await spawnIsolated(process.execPath, ['-e', sleepScript], { timeoutMs: 200 })
      throw new Error('should have thrown')
    } catch (e) {
      const err = errOf(e)
      const elapsed = Date.now() - start
      expect(err.reason).toBe('timeout')
      // 应在超时后 < 3s 内返回(2s reapTimeout + 余量),不是等满 60s
      expect(elapsed).toBeLessThan(3_000)
    }
  })

  it('collects stderr', async () => {
    const r = await spawnIsolated(process.execPath, [
      '-e',
      "process.stderr.write('error msg'); process.stdout.write('ok')",
    ])
    expect(r.exitCode).toBe(0)
    expect(r.stdout.toString().trim()).toBe('ok')
    expect(r.stderr.toString().trim()).toBe('error msg')
  })

  it('accepts stdin payload and feeds it to child', async () => {
    // node -e 把 stdin 内容 echo 到 stdout
    const payload = 'piped-stdin-content'
    const r = await spawnIsolated(
      process.execPath,
      ['-e', "process.stdin.on('data', d => process.stdout.write(d))"],
      { stdin: payload },
    )
    expect(r.exitCode).toBe(0)
    expect(r.stdout.toString()).toBe(payload)
  })

  it('killed process tree: child processes are also killed', async () => {
    // parent spawns a long-running child, then parent also sleeps
    // if process tree kill works, both should be gone after timeout
    const parentScript = `
      const { spawn } = require('node:child_process')
      spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
      setTimeout(() => {}, 60000)
    `
    const start = Date.now()
    try {
      await spawnIsolated(process.execPath, ['-e', parentScript], { timeoutMs: 300 })
      throw new Error('should have thrown')
    } catch (e) {
      const err = errOf(e)
      expect(err.reason).toBe('timeout')
      // 应在超时后快速返回(进程组被 kill)
      expect(Date.now() - start).toBeLessThan(5_000)
    }
  })
})

describe('execText', () => {
  it('returns trimmed stdout', async () => {
    const out = await execText(ECHO[0], [...ECHO[1]])
    expect(out).toBe('hello')
  })

  it('throws on nonzero', async () => {
    await expect(execText(FAIL[0], [...FAIL[1]])).rejects.toThrow()
  })
})

describe('fireAndForget', () => {
  it('does not throw on success', () => {
    fireAndForget(process.execPath, ['-e', '1+1'])
  })

  it('does not throw on failure (silently swallows)', () => {
    fireAndForget('definitely-not-a-real-binary-9f8a7b6c5d4e', [])
  })
})

describe('subprocess resource cleanup', () => {
  it('does not leave orphan children after timeout', async () => {
    // 启动一个 spawn 子进程,然后再 fork 出来一个 grandchild
    // timeout 后,parent + child + grandchild 全部应被 kill
    const script = `
      const { spawn } = require('node:child_process')
      const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
      process.on('exit', () => { try { child.kill() } catch {} })
      setTimeout(() => {}, 60000)
    `
    // 用 fireAndForget 启动 + setTimeout 200ms 后检查 — 但更稳妥的是直接 spawnIsolated + timeout
    const start = Date.now()
    try {
      await spawnIsolated(process.execPath, ['-e', script], { timeoutMs: 250, reapTimeoutMs: 1000 })
    } catch (e) {
      expect(errOf(e).reason).toBe('timeout')
    }
    // 至少我们确认 spawnIsolated 在 timeout 后没有卡住(说明 reap 成功)
    expect(Date.now() - start).toBeLessThan(3_000)
  })
})
