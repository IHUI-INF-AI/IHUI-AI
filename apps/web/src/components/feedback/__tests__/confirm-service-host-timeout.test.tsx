// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * confirmDialog 宿主接管超时兜底测试(竞品对标 Cursor quit-confirm WINDOW_SHOWN_MS)。
 *
 * 缺口:<ConfirmServiceHost /> 未挂载/渲染失败时,confirmDialog 返回的 Promise 永不结算,
 * 调用方 .then(delete) 永不执行 —— 与 Cursor 退出问询无应答悬挂同型。
 * 修法:入队后 2s 内未被宿主 claimed ⇒ 以安全默认 false(取消)结算。
 *
 * 断言:① 宿主缺失超时 ⇒ false;② 超时出队后可继续;③ 宿主接管后超时不误取消;
 * ④ 正常确认 true 不受影响;⑤ timeoutMs=0 关闭兜底;⑥ 自定义 timeoutMs。
 * ConfirmDialog 用轻量替身(mock)剥离 next-intl/Radix 环境依赖,只验证宿主接管语义。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, cleanup } from '@testing-library/react'
import * as React from 'react'

// 捕获挂载时的 props,便于测试直接触发确认/取消,不依赖真实 Modal 的 intl context
let dialogProps: { title?: string; onConfirm: () => void; onCancel: () => void } | null = null
vi.mock('../ConfirmDialog', () => ({
  ConfirmDialog: (props: { title?: string; onConfirm: () => void; onCancel: () => void }) => {
    dialogProps = props
    return React.createElement(
      'div',
      null,
      React.createElement('span', null, props.title ?? ''),
      React.createElement('button', { 'data-testid': 'confirm-button', onClick: props.onConfirm }, 'ok'),
      React.createElement('button', { 'data-testid': 'confirm-cancel-button', onClick: props.onCancel }, 'cancel'),
    )
  },
}))

import {
  confirmDialog,
  ConfirmServiceHost,
  __setConfirmHostTimeoutForTest,
} from '../confirm-service'

function mountHost() {
  let r!: ReturnType<typeof render>
  act(() => {
    r = render(React.createElement(ConfirmServiceHost))
  })
  // act 内完成 useEffect:notifyListeners 指向本实例 setCurrent
  return r
}

// 入队并冲刷 notifyListeners → setCurrent → mock 重渲染(同步更新 dialogProps)
function enqueue(title: string, timeoutMs?: number): Promise<boolean> {
  let p!: Promise<boolean>
  act(() => {
    p = confirmDialog(timeoutMs === undefined ? { title } : { title, timeoutMs })
  })
  return p
}

beforeEach(() => {
  vi.useFakeTimers()
  __setConfirmHostTimeoutForTest(2000)
  dialogProps = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  __setConfirmHostTimeoutForTest(2000)
})

describe('confirmDialog 宿主接管超时兜底', () => {
  it('宿主未挂载:超时以安全默认 false 结算,绝不悬挂', async () => {
    const result = confirmDialog({ title: '删除?' })
    let settled: boolean | 'pending' = 'pending'
    void result.then((v) => (settled = v))

    await act(async () => {
      vi.advanceTimersByTime(1999)
    })
    expect(settled).toBe('pending')

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(await result).toBe(false)
    expect(settled).toBe(false)
  })

  it('超时出队后,下一个请求能被新挂载的宿主正常接管', async () => {
    const first = confirmDialog({ title: 'first' })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(await first).toBe(false)

    mountHost()
    const second = enqueue('second')
    expect(dialogProps?.title).toBe('second')
    act(() => dialogProps?.onConfirm())
    expect(await second).toBe(true)
  })

  it('宿主已 claimed 的请求:超过 timeout 也不被强制取消,留给实际操作', async () => {
    mountHost()
    const result = enqueue('长任务确认')
    expect(dialogProps?.title).toBe('长任务确认')

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    let settled: boolean | 'pending' = 'pending'
    void result.then((v) => (settled = v))
    await Promise.resolve()
    expect(settled).toBe('pending')

    act(() => dialogProps?.onCancel())
    expect(await result).toBe(false)
  })

  it('正常确认走 true,不受兜底影响', async () => {
    mountHost()
    const result = enqueue('ok?')
    expect(dialogProps?.title).toBe('ok?')
    act(() => dialogProps?.onConfirm())
    expect(await result).toBe(true)
  })

  it('timeoutMs=0 关闭兜底:无宿主时也不自动结算', async () => {
    const result = confirmDialog({ title: '无限等待', timeoutMs: 0 })
    let settled: boolean | 'pending' = 'pending'
    void result.then((v) => (settled = v))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(settled).toBe('pending')
  })

  it('自定义 timeoutMs 生效', async () => {
    const result = confirmDialog({ title: '短超时', timeoutMs: 500 })
    let settled: boolean | 'pending' = 'pending'
    void result.then((v) => (settled = v))
    await act(async () => {
      vi.advanceTimersByTime(499)
    })
    expect(settled).toBe('pending')
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(await result).toBe(false)
  })
})
