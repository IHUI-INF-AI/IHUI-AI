// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui-lowmem` 低内存启动档单测(对齐 WorkBuddy `codebuddy-lowmem`)。
 *
 * 只钉启动契约:两枚 V8 参数、入口在参数之后、用户 argv 原样透传、退出码透传。
 * 不真的拉起 CLI(注入 spawn),避免测试进程被 V8 参数重启。
 */

import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  LOW_MEMORY_NODE_FLAGS,
  buildLowMemoryArgv,
  runLowMemory,
} from '../bin/ihui-lowmem.mjs'

/** 与 `runLowMemory` 注入点一致的最小 spawn 形状(仅测试替身用,不从真实 bin 导入类型)。 */
type LowMemorySpawn = (
  command: string,
  args: string[],
  options: Record<string, unknown>,
) => { status?: number | null; error?: Error }

describe('ihui-lowmem launcher', () => {
  it('builds node flags before entry and forwards user argv', () => {
    const argv = buildLowMemoryArgv(
      '/repo/apps/cli/dist/index.js',
      ['chat', '--model', 'x'],
      '/usr/local/bin/node',
    )
    expect(argv[0]).toBe('/usr/local/bin/node')
    expect(argv.slice(1, 1 + LOW_MEMORY_NODE_FLAGS.length)).toEqual(
      LOW_MEMORY_NODE_FLAGS,
    )
    expect(argv[1 + LOW_MEMORY_NODE_FLAGS.length]).toBe(
      resolve('/repo/apps/cli/dist/index.js'),
    )
    expect(argv.slice(2 + LOW_MEMORY_NODE_FLAGS.length)).toEqual([
      'chat',
      '--model',
      'x',
    ])
  })

  it('never sets an old-space cap', () => {
    expect(LOW_MEMORY_NODE_FLAGS.join(' ')).not.toContain(
      '--max-old-space-size',
    )
    expect(LOW_MEMORY_NODE_FLAGS.join(' ')).toContain('--optimize-for-size')
    expect(LOW_MEMORY_NODE_FLAGS.join(' ')).toContain(
      '--max-semi-space-size=2',
    )
  })

  it('spawns with inherited stdio and no console window', () => {
    const calls: Array<{
      command: string
      args: string[]
      options: Record<string, unknown>
    }> = []
    const fakeSpawn: LowMemorySpawn = (command, args, options) => {
      calls.push({ command, args, options: options as Record<string, unknown> })
      return { status: 0 }
    }
    const code = runLowMemory({
      entry: '/repo/dist/index.js',
      argv: ['--help'],
      spawn: fakeSpawn,
    })
    expect(code).toBe(0)
    expect(calls).toHaveLength(1)
    const call = calls[0]
    if (!call) throw new Error('expected one spawn call')
    expect(call.options.stdio).toBe('inherit')
    expect(call.options.windowsHide).toBe(true)
    expect(call.args).toContain('--optimize-for-size')
  })

  it('propagates child status and turns null into 1', () => {
    const fakeSpawn: LowMemorySpawn = () => ({ status: 7 })
    expect(
      runLowMemory({
        entry: '/repo/dist/index.js',
        argv: [],
        spawn: fakeSpawn,
      }),
    ).toBe(7)
    const killed: LowMemorySpawn = () => ({ status: null })
    expect(
      runLowMemory({
        entry: '/repo/dist/index.js',
        argv: [],
        spawn: killed,
      }),
    ).toBe(1)
  })

  it('reports spawn failures without throwing', () => {
    const writes: string[] = []
    const fakeSpawn: LowMemorySpawn = () => ({
      error: new Error('node missing'),
    })
    const code = runLowMemory({
      entry: '/repo/dist/index.js',
      argv: [],
      spawn: fakeSpawn,
      stderr: { write: (chunk: string) => writes.push(chunk) },
    })
    expect(code).toBe(1)
    expect(writes.join('')).toContain('node missing')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
