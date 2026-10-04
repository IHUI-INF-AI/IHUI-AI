// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { registerTask, killTask, getTaskOutput } from '../src/tools/background-registry.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const sleeper = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  stdio: ['ignore', 'pipe', 'pipe'],
})

describe('G-816026 停止发起方(stopInitiator)', () => {
  it('模型停 ⇒ 读得出 model,且 timedOut=false(不是超时)', async () => {
    const child = sleeper()
    const id = registerTask(child, 'sleep-long-model-kill')
    const r = await killTask(id, 'model')
    expect(r.killed).toBe(true)
    const out = getTaskOutput(id)
    expect(out!.status).toBe('killed')
    expect(out!.stopInitiator).toBe('model')
    expect(out!.timedOut).toBe(false)
  }, 15_000)

  it('用户停 ⇒ 读得出 user(这是用户的决定,不许被续上)', async () => {
    const child = sleeper()
    const id = registerTask(child, 'sleep-long-user-kill')
    await killTask(id, 'user')
    const out = getTaskOutput(id)
    expect(out!.stopInitiator).toBe('user')
    expect(out!.timedOut).toBe(false)
  }, 15_000)

  it('外部 SIGKILL(无 killTask)⇒ killed + 发起方未知 + 非超时(OOM 与用户手停不再同形)', async () => {
    const child = sleeper()
    const id = registerTask(child, 'oom-style-external-kill')
    child.kill('SIGKILL')
    await new Promise<void>((resolve) => {
      child.on('close', () => resolve())
      child.on('exit', () => setTimeout(resolve, 50))
    })
    await new Promise((r) => setTimeout(r, 50))
    const out = getTaskOutput(id)
    expect(out!.status).toBe('killed')
    expect(out!.stopInitiator ?? null).toBeNull()
    expect(out!.timedOut).toBe(false)
  }, 15_000)
})

describe('G-816026 反向锁(源码级)', () => {
  const reg = readFileSync(join(HERE, '../src/tools/background-registry.ts'), 'utf8')

  it('close 处理器不得再按 signal 形状反推 timedOut(旧塌陷写法不得回来)', () => {
    expect(reg.includes('timedOut = signal ===')).toBe(false)
    expect(reg).toContain('t.stopInitiator = initiator')
  })

  it('G-896416:timedOut=true 只许由 killTask 的 deadline 持有者显式置位,close 只保不冲', () => {
    // 全文件恰好一处 `timedOut = true`(killTask 发信号前的置位点);close 处理器的
    // 守卫写法是 `!== true`(保住持有者事实),=== / 无守覆写都算按形状反推的回归。
    const hits = reg.match(/timedOut = true/g) ?? []
    expect(hits.length).toBe(1)
    expect(reg).toContain('if (opts?.timedOut === true)')
    expect(reg).toContain('if (task.timedOut !== true)')
  })

  it('两个发起方必须各自落盘:模型走 model,用户走 user', () => {
    expect(readFileSync(join(HERE, '../src/tools/builtins.ts'), 'utf8')).toContain("killTask(taskId, 'model')")
    expect(readFileSync(join(HERE, '../src/commands/repl.ts'), 'utf8')).toContain("killTask(id, 'user')")
  })

  it('模型可读文案必须区分三种停止方(不许只报 killed)', () => {
    const builtins = readFileSync(join(HERE, '../src/tools/builtins.ts'), 'utf8')
    expect(builtins).toContain('不要重跑')
    expect(builtins).toContain('不要 resume')
    expect(builtins).toContain('外部/未知')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
