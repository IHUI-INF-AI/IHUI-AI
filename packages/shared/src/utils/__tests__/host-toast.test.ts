// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「用户提示」能力族的时长单源(host-toast 通道)。
 *
 * 立因(2026-11-05 现读):同一条 `onToast(text)` 曾经三处三个数 ——
 *   小程序端口层 1500 / 小程序渲染层 2000 / RN 经 FloatBox 兜底 3000。
 * 本套件钉的是**通道侧**那两格:
 *   ① 未给时长 ⇒ 订阅方一定拿到 `HOST_TOAST_DEFAULT_DURATION_MS`(不得是 undefined,
 *      否则各渲染层又会各自补一个默认值,三份立刻回潮);
 *   ② 给了时长 ⇒ 原样透传。
 * 端侧那一格(不得再自立数字默认)的对账在
 *   `apps/miniapp-taro/src/host/__tests__/host-toast-layer.test.ts` 的反臂里。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HOST_TOAST_DEFAULT_DURATION_MS,
  showHostToast,
  subscribeHostToast,
} from '../host-toast'

type Emitted = { message: string; kind: string; duration?: number }

describe('host-toast 通道的时长单源', () => {
  let emitted: Emitted[] = []
  let unsubscribe: (() => void) | null = null

  const collect = () => {
    unsubscribe?.()
    unsubscribe = subscribeHostToast((message, kind, duration) => {
      emitted.push({ message, kind, duration })
    })
  }

  beforeEach(() => {
    emitted = []
    collect()
  })

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  it('未给 duration ⇒ 订阅方拿到单源常量,绝不是 undefined(反臂:改回透传 undefined 即翻红)', () => {
    showHostToast('加载失败', { kind: 'error' })
    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.duration).toBe(HOST_TOAST_DEFAULT_DURATION_MS)
    expect(emitted[0]?.duration).not.toBeUndefined()
    expect(typeof emitted[0]?.duration).toBe('number')
  })

  it('连 kind 都不给时:档位落 info、时长仍走单源', () => {
    showHostToast('已复制')
    expect(emitted[0]).toEqual({
      message: '已复制',
      kind: 'info',
      duration: HOST_TOAST_DEFAULT_DURATION_MS,
    })
  })

  it('显式 duration 一律原样透传,单源常量不越权改写', () => {
    for (const ms of [1, 800, 1500, 2000, 3000, 10_000]) {
      emitted = []
      showHostToast(`持续 ${ms}ms`, { kind: 'info', duration: ms })
      expect(emitted[0]?.duration).toBe(ms)
    }
  })

  it('空白/非字符串文案不进通道(不占订阅方,也不产生零时长提示)', () => {
    showHostToast('   ', { kind: 'error' })
    showHostToast(undefined as unknown as string, { kind: 'error' })
    expect(emitted).toEqual([])
  })

  it('渲染层未挂载 ⇒ 不抛错(fire-and-forget 契约)', () => {
    unsubscribe?.()
    unsubscribe = null
    expect(() => showHostToast('无人订阅', { kind: 'error' })).not.toThrow()
  })

  it('单源常量是一个有界的正毫秒数(把 0/负数/荒谬值拦在源头)', () => {
    expect(Number.isInteger(HOST_TOAST_DEFAULT_DURATION_MS)).toBe(true)
    expect(HOST_TOAST_DEFAULT_DURATION_MS).toBeGreaterThan(0)
    expect(HOST_TOAST_DEFAULT_DURATION_MS).toBeLessThanOrEqual(5000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
