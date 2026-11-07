// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 侧轻提示渲染层的时长必须来自共享单源,而不是 FloatBox 自己的 3000。
 *
 * 立因(2026-11-05):同一条 `onToast(text)` 在三处三个数 —— 小程序端口层 1500、
 * 小程序渲染层 2000、RN 这一条走 `FloatBox` 的 `duration = DEFAULT_DURATION_MS(3000)` 兜底。
 * 默认时长收进共享通道后,本层必须**总是**给 FloatBox 一个具体数,3000 那条兜底不得再被
 * 通道提示吃到(FloatBox 仍为不经通道的直接调用点保留 3000,那是另一件事)。
 *
 * 反臂两条:
 *   ① 把 `duration ?? HOST_TOAST_DEFAULT_DURATION_MS` 改回直接透传(undefined)⇒
 *      「未给时长」那条当场翻红(拿到的会是 FloatBox 的 3000 或 undefined);
 *   ② 本文件里重新长出数字默认时长 ⇒ 形状锁翻红。
 */
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maskComments } from '../../../scripts/lib/code-mask.mjs' // arch-exempt: 与端内反臂共用同一份遮罩实现(§22c)

type Captured = { visible: boolean; type: string; message: string; duration?: number }
const last = vi.hoisted(() => ({ current: null as Captured | null }))

vi.mock('../src/components/FloatBox', () => ({
  FloatBox: (p: Captured) => {
    last.current = p
    return createElement('div')
  },
}))

import {
  HOST_TOAST_DEFAULT_DURATION_MS,
  showHostToast,
  subscribeHostToast,
} from '@ihui/shared/utils/host-toast'
import { HostToastLayer } from '../src/host/HostToastLayer'

describe('RN HostToastLayer 时长取共享单源', () => {
  let unsubscribe: (() => void) | null = null

  beforeEach(() => {
    cleanup()
    last.current = null
    unsubscribe?.()
    unsubscribe = null
  })

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  it('共享屏未给时长 → RN 渲染层拿到的就是单源常量(绝不是 FloatBox 的 3000)', () => {
    render(createElement(HostToastLayer))
    act(() => {
      showHostToast('加载失败', { kind: 'error' })
    })
    expect(last.current).not.toBeNull()
    expect(last.current!.visible).toBe(true)
    expect(last.current!.type).toBe('error')
    expect(last.current!.duration).toBe(HOST_TOAST_DEFAULT_DURATION_MS)
    expect(last.current!.duration).not.toBe(3000)
  })

  it('显式 duration 原样落到渲染层(单源常量不越权)', () => {
    render(createElement(HostToastLayer))
    act(() => {
      showHostToast('这条 2500ms', { kind: 'info', duration: 2500 })
    })
    expect(last.current!.duration).toBe(2500)
  })

  /**
   * 与小程序端同一条屏调用逐字对齐:两端渲染层拿到的数必须相等。
   * 口径来源是同一枚通道常量,所以这里比的是"两条订阅链都改吃单源"这件事本身。
   */
  it('跨端等值:RN 订阅链拿到的时长 == 小程序端口链拿到的时长 == 单源常量', async () => {
    let rnSide: number | undefined
    const off = subscribeHostToast((_m, _k, duration) => {
      rnSide = duration
    })
    try {
      showHostToast('同一条提示', { kind: 'success' })
    } finally {
      off()
    }
    const miniappLayer = readFileSync(
      join(__dirname, '../../miniapp-taro/src/host/HostToastLayer.tsx'),
      'utf8',
    )
    // 端内渲染层的兜底表达式必须指向同一枚常量名(不是数字、不是另一枚本地常量)
    expect(miniappLayer).toContain('duration ?? HOST_TOAST_DEFAULT_DURATION_MS')
    expect(rnSide).toBe(HOST_TOAST_DEFAULT_DURATION_MS)
  })

  it('形状锁:RN 渲染层不得再自立数字默认时长(改回各自一份即翻红)', () => {
    const src = maskComments(readFileSync(join(__dirname, '../src/host/HostToastLayer.tsx'), 'utf8'))
    expect([...src.matchAll(/DEFAULT_DURATION[A-Z_]*\s*=\s*\d+/g)].map((m) => m[0])).toEqual([])
    expect(src).toContain('HOST_TOAST_DEFAULT_DURATION_MS')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
