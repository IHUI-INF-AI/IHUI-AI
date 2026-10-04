// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816028 截断诚实性 + G-937959 视图感知投影。
 *
 * 机制升级记(G-937959):截断注记从 builtins 尾部追加的 `formatTruncatedNote` 一条,升级为
 * `getTaskOutput` 的**视图感知投影** —— 省略量前缀嵌入内容头部(终态
 * `[NKB of earlier output omitted]` / 运行中"仅保留前 30k"),与上游
 * task-output-projection.ts 的 readTaskOutputFileSnapshot 同形。诚实纪律不变:
 * 截断必须回答"省略了多少",且读面绝不抛。
 */
import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { registerTask, getTaskOutput } from '../src/tools/background-registry.js'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('G-816028 registry 计数', () => {
  it('反例:未截断的任务 ⇒ truncated=false 且丢弃计数为 0(不得无条件报截断)', () => {
    const id = registerTask(null, 'echo tiny')
    const out = getTaskOutput(id)
    expect(out).not.toBeNull()
    expect(out!.truncated).toBe(false)
    expect(out!.droppedStdoutBytes).toBe(0)
    expect(out!.droppedStderrBytes).toBe(0)
  })

  it('正例(真进程):输出越过 1MiB 上限 ⇒ truncated=true、丢弃量逐字入账、内容带省略前缀', async () => {
    const OVER = 5000
    const child = spawn(process.execPath, ['-e', `process.stdout.write('a'.repeat(1024 * 1024 + ${OVER}))`], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const id = registerTask(child, "node -e 'huge stdout'")
    await new Promise<void>((resolve) => {
      child.on('exit', () => resolve())
      child.on('error', () => resolve())
    })
    // data 事件先于 exit 触发,但给一个 microtask 余量,防最后一次 buf 写入与读侧竞态
    await new Promise((r) => setTimeout(r, 50))
    const out = getTaskOutput(id)
    expect(out).not.toBeNull()
    expect(out!.truncated).toBe(true)
    expect(out!.droppedStdoutBytes).toBe(OVER)
    // G-937959:终态视图 = 尾窗 + omitted 前缀;前缀单独一行,主体 ≤ 1MiB
    expect(out!.stdout).toContain('of earlier output omitted')
    const body = out!.stdout.slice(out!.stdout.indexOf('\n') + 1)
    expect(body.length).toBeLessThanOrEqual(1024 * 1024)
  }, 30_000)
})

describe('G-816028 builtins 接线(源码锁)', () => {
  const src = readFileSync(join(HERE, '../src/tools/builtins.ts'), 'utf8')
  it('截断注记唯一出口 = getTaskOutput 的视图投影;builtins 不再追加第二份注记(两份注记会对不上账)', () => {
    expect(src).not.toContain('formatTruncatedNote')
    expect(src).not.toContain("parts.push('[输出被截断]')")
  })
  it('wait_command 的终态通知必须走注册表的顺序化截断组装(G-937956)', () => {
    expect(src).toContain('formatSettledTaskNotification')
  })
  it('反例:旧的裸字符串「[输出被截断]」不得出现在 builtins(那是不回答省略量的旧形态)', () => {
    expect(src.includes("parts.push('[输出被截断]')")).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
