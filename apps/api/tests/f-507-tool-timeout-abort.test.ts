// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-507 回归锁(2026-11-13)。
 *
 * 病灶:ToolRunner.execute 的 withTimeout 只在超时时 reject 包装 promise,不取消底层执行,
 * handler 继续跑完、继续产生副作用;debug 桩还留着 2×timeout 的定时器。
 *
 * 本文件锁:
 *   ① 超时触发 AbortController.abort(),且同一个 signal 透传给 handler;
 *   ② 超时的返回结构/错误文案与修复前一致(不新增字段);
 *   ③ 底层不支持取消(不监听 signal)时,迟到结果被丢弃:不 emit executed、不二次写 stats、
 *     不会把超时结果改写成成功;
 *   ④ 正常完成不 abort,结果原样返回;
 *   ⑤ 源锁:route debug 桩改为监听 ctx.signal,不再裸 setTimeout(timeout*2)。
 *
 * 只 mock logger,不触达真实 DB/Redis/外部服务。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ToolRunner } from '../src/services/clawdbot/tool-executor.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CTX = { userId: 'u-f507', permissions: [] }

describe('F-507 ToolRunner 超时取消底层执行', () => {
  it('①超时后 signal.aborted=true 且透传给 handler', async () => {
    const runner = new ToolRunner()
    let captured: AbortSignal | undefined
    runner.register(
      {
        name: 'f507-cancellable',
        description: '',
        category: 'test',
        timeout: 20,
        requiredPermissions: [],
      },
      async (_params, ctx) => {
        captured = ctx.signal
        // 支持取消的 handler:abort 即停止等待
        await new Promise<void>((resolve) => {
          ctx.signal?.addEventListener('abort', () => resolve(), { once: true })
        })
        return 'late-ok'
      },
    )

    const r = await runner.execute('f507-cancellable', {}, CTX)
    expect(captured).toBeInstanceOf(AbortSignal)
    expect(captured?.aborted).toBe(true)
    expect(r.timedOut).toBe(true)
  })

  it('②超时结果形态与文案不变(不新增字段)', async () => {
    const runner = new ToolRunner()
    runner.register(
      {
        name: 'f507-never',
        description: '',
        category: 'test',
        timeout: 15,
        requiredPermissions: [],
      },
      () => new Promise<never>(() => {}),
    )

    const r = await runner.execute('f507-never', {}, CTX)
    expect(Object.keys(r).sort()).toEqual([
      'durationMs',
      'error',
      'latencyTrusted',
      'success',
      'timedOut',
    ])
    expect(r).toMatchObject({
      success: false,
      error: '工具执行超时(15ms)',
      timedOut: true,
    })
    expect(r.output).toBeUndefined()
    expect(typeof r.durationMs).toBe('number')
  })

  it('③底层不支持取消:迟到结果被丢弃,无 executed/stats 二次写入', async () => {
    const runner = new ToolRunner()
    let resolveLate: ((v: string) => void) | undefined
    let seenSignal: AbortSignal | undefined
    runner.register(
      {
        name: 'f507-legacy',
        description: '',
        category: 'test',
        timeout: 15,
        requiredPermissions: [],
      },
      async (_params, ctx) => {
        seenSignal = ctx.signal
        // 完全不监听 signal 的旧工具
        return new Promise<string>((resolve) => {
          resolveLate = resolve
        })
      },
    )
    const executed = vi.fn()
    const cancelled = vi.fn()
    runner.on('executed', executed)
    runner.on('cancelled', cancelled)

    const r = await runner.execute('f507-legacy', {}, CTX)
    expect(seenSignal?.aborted).toBe(true)
    expect(cancelled).toHaveBeenCalledTimes(1)
    expect(cancelled).toHaveBeenCalledWith({
      name: 'f507-legacy',
      reason: 'timeout',
      timeoutMs: 15,
    })
    const statsAtTimeout = runner.getStats()
    expect(statsAtTimeout.totalExecutions).toBe(1)
    expect(statsAtTimeout.totalFailures).toBe(1)

    // 迟到结果到达:必须被丢弃,不得改判成功或再写统计
    resolveLate?.('late-payload')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(executed).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(r.timedOut).toBe(true)
    expect(r.output).toBeUndefined()
    expect(runner.getStats()).toEqual(statsAtTimeout)
  })

  it('④正常完成不 abort,结果原样返回', async () => {
    const runner = new ToolRunner()
    let captured: AbortSignal | undefined
    runner.register(
      {
        name: 'f507-fast',
        description: '',
        category: 'test',
        timeout: 5_000,
        requiredPermissions: [],
      },
      async (_params, ctx) => {
        captured = ctx.signal
        return 'ok'
      },
    )
    const cancelled = vi.fn()
    runner.on('cancelled', cancelled)

    const r = await runner.execute('f507-fast', {}, CTX)
    expect(r).toMatchObject({ success: true, output: 'ok', timedOut: false })
    expect(captured?.aborted).toBe(false)
    expect(cancelled).not.toHaveBeenCalled()
  })

  it('⑤源锁:debug/timeout 桩监听 ctx.signal,不留裸 setTimeout(timeout*2)', () => {
    const src = readFileSync(resolve(ROOT, 'src/routes/tools.ts'), 'utf8')
    expect(src).toContain("ctx.signal?.addEventListener('abort', onAbort")
    expect(src).toContain("ctx.signal?.removeEventListener('abort', onAbort)")
    expect(src).not.toMatch(/setTimeout\(r, timeout \* 2\)/)
  })
})
