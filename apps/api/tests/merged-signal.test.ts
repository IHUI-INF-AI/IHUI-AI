// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { mergedSignal } from '../src/utils/fetch-deadline.js'

/** 等 signal abort(或超时兜底返回 undefined,用于断言「没有 abort」)。 */
function waitForAbort(signal: AbortSignal, ms = 1000): Promise<unknown> {
  if (signal.aborted) return Promise.resolve(signal.reason)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve(signal.reason)
      },
      { once: true },
    )
  })
}

describe('mergedSignal:取消 + 超时组合器(b75-3#1)', () => {
  it('只传 timeout:返回的 signal 到期自 abort,reason 是 TimeoutError', async () => {
    const merged = mergedSignal(undefined, 10)
    expect(merged).toBeDefined()
    const reason = await waitForAbort(merged!, 500)
    expect(merged!.aborted).toBe(true)
    expect((reason as { name?: string }).name).toBe('TimeoutError')
  })

  it('只传 signal:原引用返回,不暗挂超时', async () => {
    const controller = new AbortController()
    const merged = mergedSignal(controller.signal, undefined)
    expect(merged).toBe(controller.signal)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(merged!.aborted).toBe(false)
  })

  it('双传:外部取消立即透传且带原 reason,不必等超时', async () => {
    const controller = new AbortController()
    const merged = mergedSignal(controller.signal, 60_000)
    expect(merged).toBeDefined()
    expect(merged).not.toBe(controller.signal)
    const reason = new Error('人控取消')
    const pending = waitForAbort(merged!, 500)
    controller.abort(reason)
    expect(await pending).toBe(reason)
  })

  it('双传:超时路径也生效,且外部 signal 不被连坐', async () => {
    const controller = new AbortController()
    const merged = mergedSignal(controller.signal, 10)
    await waitForAbort(merged!, 500)
    expect(merged!.aborted).toBe(true)
    expect(controller.signal.aborted).toBe(false)
  })

  it('都不传 → undefined;timeoutMs=0 视为不挂超时(与上游 !timeoutMs 判据一致)', () => {
    expect(mergedSignal(undefined, undefined)).toBeUndefined()
    const controller = new AbortController()
    expect(mergedSignal(controller.signal, 0)).toBe(controller.signal)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
