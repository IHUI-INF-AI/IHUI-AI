// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { formatTruncatedNote, registerTask, getTaskOutput } from '../src/tools/background-registry.js'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('G-816028 截断诚实性:formatTruncatedNote', () => {
  it('有丢弃量 ⇒ 注记含省略量、未保留声明与重跑出路', () => {
    const note = formatTruncatedNote({ droppedStdoutBytes: 1234, droppedStderrBytes: 11 })
    expect(note).toContain('输出被截断')
    expect(note).toContain('≥1245')
    expect(note).toContain('未保留')
    expect(note).toContain('重跑')
  })
  it('零丢弃(契约边界)⇒ 注记仍成形,不得崩或吐空串', () => {
    const note = formatTruncatedNote({ droppedStdoutBytes: 0, droppedStderrBytes: 0 })
    expect(note).toContain('≥0')
    expect(note).toContain('未保留')
  })
})

describe('G-816028 registry 计数', () => {
  it('反例:未截断的任务 ⇒ truncated=false 且丢弃计数为 0(不得无条件报截断)', () => {
    const id = registerTask(null, 'echo tiny')
    const out = getTaskOutput(id)
    expect(out).not.toBeNull()
    expect(out!.truncated).toBe(false)
    expect(out!.droppedStdoutBytes).toBe(0)
    expect(out!.droppedStderrBytes).toBe(0)
  })

  it('正例(真进程):输出越过 1MiB 上限 ⇒ truncated=true 且丢弃量逐字入账', async () => {
    const OVER = 5000
    const child = spawn(process.execPath, ['-e', `process.stdout.write('a'.repeat(1024 * 1024 + ${OVER}))`])
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
    expect(out!.stdout.length).toBeLessThanOrEqual(1024 * 1024)
  }, 30_000)
})

describe('G-816028 builtins 接线(源码锁)', () => {
  const src = readFileSync(join(HERE, '../src/tools/builtins.ts'), 'utf8')
  it('截断注记必须走唯一出口 formatTruncatedNote,且只在 output.truncated 时push', () => {
    expect(src).toContain('if (output.truncated) parts.push(formatTruncatedNote(output))')
    expect(src).toContain('formatTruncatedNote,')
  })
  it('反例:旧的裸字符串「[输出被截断]」不得再出现(那是不回答省略量的旧形态)', () => {
    expect(src.includes("parts.push('[输出被截断]')")).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
