// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知状态翻转广播的 web 消费回归(2026-11-24)。
 * 钉四件事:
 *  ① 有 token ⇒ 订阅 notification:state;无 token ⇒ 不订阅。
 *  ② 帧回调按 op 精确调 store 批量 API(read/read-all→标已读,archive→归档,restore→恢复),
 *     不用"无条件全量置读"洗掉本地未知的新通知。
 *  ③ 翻转后重新 getUnreadCount 覆盖角标,不靠本地条目数重算。
 *  ④ react-query 通知列表缓存就地按 ids 改;卸载后 close 订阅、迟到帧不再写入。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  subscribeUserBroadcast: vi.fn(),
  getUnreadCount: vi.fn(),
  close: vi.fn(),
  markAsReadByIds: vi.fn(),
  archiveByIds: vi.fn(),
  restoreByIds: vi.fn(),
  setUnreadCounts: vi.fn(),
  hasToken: true,
}))

vi.mock('@ihui/api-client', () => ({
  subscribeUserBroadcast: h.subscribeUserBroadcast,
  getUnreadCount: h.getUnreadCount,
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { token: string }) => unknown) => sel({ token: h.hasToken ? 'tk' : '' }),
    { getState: () => ({ token: h.hasToken ? 'tk' : '' }) },
  ),
}))
vi.mock('@/stores/notification', () => {
  const state = {
    markAsReadByIds: h.markAsReadByIds,
    archiveByIds: h.archiveByIds,
    restoreByIds: h.restoreByIds,
    setUnreadCounts: h.setUnreadCounts,
  }
  return {
    useNotificationStore: Object.assign(() => state, { getState: () => state }),
  }
})
vi.mock('@/lib/api-base-url', () => ({ resolveWsApiBaseUrl: () => 'ws://test' }))

import { useNotificationStateSync } from '../use-notification-state-sync'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

/** 从订阅 handlers 取 notification:state 回调并驱动一帧 */
function fireStateFrame(evt: {
  op: 'read' | 'read-all' | 'archive' | 'restore'
  ids: string[]
  changedBy: string
  at: string
}): void {
  const handlers = h.subscribeUserBroadcast.mock.calls[0]?.[1] as
    { 'notification:state'?: (e: { data: typeof evt }) => void } | undefined
  handlers?.['notification:state']?.({ data: evt })
}

const FRAME = {
  ids: ['n-1', 'n-2'],
  changedBy: 'u-1',
  at: '2026-11-24T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.hasToken = true
  h.subscribeUserBroadcast.mockImplementation(() => ({ close: h.close }))
  h.getUnreadCount.mockResolvedValue({
    success: true,
    data: { notification: 3, message: 1 },
  })
})

describe('useNotificationStateSync — 安装与分派', () => {
  it('有 token 订阅 notification:state,无 token 不订阅', () => {
    const a = renderHook(() => useNotificationStateSync(), { wrapper })
    expect(h.subscribeUserBroadcast).toHaveBeenCalledTimes(1)
    const handlers = h.subscribeUserBroadcast.mock.calls[0]?.[1] as Record<string, unknown>
    expect(handlers).toHaveProperty('notification:state')
    a.unmount()
    h.hasToken = false
    renderHook(() => useNotificationStateSync(), { wrapper })
    expect(h.subscribeUserBroadcast).toHaveBeenCalledTimes(1) // 未新增
  })

  it('read / read-all 都按确切 ids 标已读,不误用全量置读', async () => {
    renderHook(() => useNotificationStateSync(), { wrapper })
    fireStateFrame({ ...FRAME, op: 'read' })
    fireStateFrame({ ...FRAME, op: 'read-all' })
    expect(h.markAsReadByIds).toHaveBeenCalledTimes(2)
    expect(h.markAsReadByIds).toHaveBeenCalledWith(FRAME.ids)
  })

  it('archive / restore 分别调归档/恢复批量 API', () => {
    renderHook(() => useNotificationStateSync(), { wrapper })
    fireStateFrame({ ...FRAME, op: 'archive' })
    fireStateFrame({ ...FRAME, op: 'restore' })
    expect(h.archiveByIds).toHaveBeenCalledWith(FRAME.ids)
    expect(h.restoreByIds).toHaveBeenCalledWith(FRAME.ids)
    expect(h.markAsReadByIds).not.toHaveBeenCalled()
  })

  it('翻转后重新取服务端未读真相覆盖角标', async () => {
    renderHook(() => useNotificationStateSync(), { wrapper })
    fireStateFrame({ ...FRAME, op: 'read' })
    await waitFor(() =>
      expect(h.setUnreadCounts).toHaveBeenCalledWith({ notifications: 3, messages: 1 }),
    )
  })

  it('卸载后 close 订阅,迟到帧不再写 store', () => {
    const a = renderHook(() => useNotificationStateSync(), { wrapper })
    a.unmount()
    expect(h.close).toHaveBeenCalledTimes(1)
    fireStateFrame({ ...FRAME, op: 'read' })
    expect(h.markAsReadByIds).not.toHaveBeenCalled()
  })

  it('变异锁:按 op 分派+角标服务端真相都真接线(抹掉即红)', () => {
    const src = readFileSync(resolve(__dirname, '../use-notification-state-sync.ts'), 'utf8')
    const markers = [
      "evt.data.op === 'archive'",
      "evt.data.op === 'restore'",
      'markAsReadByIds(ids)',
      'getUnreadCount()',
      'patchNotificationListCaches(qc, evt)',
    ]
    for (const m of markers) expect(src).toContain(m)
    const stripped = markers.reduce((text, m) => text.split(m).join(''), src)
    for (const m of markers) expect(stripped).not.toContain(m)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
