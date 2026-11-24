// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

/**
 * 通知 WS 断线补拉回归(断点续读的通知侧)。
 * 病灶:断线窗口内服务端推的通知不重放,原实现只重建 socket ⇒ 通知永久丢失。
 * 纪律:首连不补(由 unread-count 初始化 + 面板列表负责);重连拉最新页走 store
 * 按 id 幂等合并;角标一律取服务端真相,不把补回误算成新未读。
 */
const h = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  hydrateNotifications: vi.fn(),
  handleWsMessage: vi.fn(),
  markAllAsRead: vi.fn(),
  clearAll: vi.fn(),
  setUnreadCounts: vi.fn(),
  ws: { lastMessage: null as unknown, connected: false },
}))

vi.mock('@ihui/api-client', () => ({
  getNotifications: h.getNotifications,
  getUnreadCount: h.getUnreadCount,
}))

vi.mock('@/hooks/use-websocket', () => ({ useWebSocket: () => h.ws }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

vi.mock('@/stores/notification', () => ({
  useNotificationStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      unreadCount: 0,
      unreadMessageCount: 0,
      handleWsMessage: h.handleWsMessage,
      markAllAsRead: h.markAllAsRead,
      clearAll: h.clearAll,
      setUnreadCounts: h.setUnreadCounts,
      hydrateNotifications: h.hydrateNotifications,
    }),
}))

import {
  compareNotificationWatermark,
  extractNotificationWatermark,
  useGlobalNotification,
} from '../use-global-notification'

const ROW = {
  id: 'n-missed',
  type: 'system',
  title: '断线期间的通知',
  content: '',
  createdAt: '2026-11-24T12:00:00.000Z',
  isRead: false,
}
const okList = (list: readonly unknown[]) => ({
  success: true,
  data: { list, total: list.length, page: 1, pageSize: 100 },
})
const okCount = () => ({
  success: true,
  data: { notification: 2, message: 1, customerService: 0, total: 3 },
})

beforeEach(() => {
  vi.clearAllMocks()
  h.ws.connected = false
  h.ws.lastMessage = null
  h.getNotifications.mockResolvedValue(okList([]))
  h.getUnreadCount.mockResolvedValue(okCount())
})

describe('useGlobalNotification — 重连补增量', () => {
  it('首次 open 不补拉(首连由角标初始化与面板列表负责)', async () => {
    const { rerender } = renderHook(() => useGlobalNotification())
    h.ws.connected = true
    rerender()
    await Promise.resolve()
    expect(h.getNotifications).not.toHaveBeenCalled()
  })

  it('断开后重连 ⇒ 拉最新页幂等合并 + 刷新服务端未读真相', async () => {
    h.getNotifications.mockResolvedValue(okList([ROW]))
    const { rerender } = renderHook(() => useGlobalNotification())
    h.ws.connected = true
    rerender()
    h.ws.connected = false
    rerender()
    h.ws.connected = true
    rerender()
    await waitFor(() => expect(h.getNotifications).toHaveBeenCalledTimes(1))
    expect(h.getNotifications).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      partition: 'active',
    })
    expect(h.hydrateNotifications).toHaveBeenCalledWith([ROW])
    expect(h.setUnreadCounts).toHaveBeenCalledWith({ notifications: 2, messages: 1 })
  })

  it('补拉失败 ⇒ 静默,不 hydrate、不冒充已对齐', async () => {
    h.getNotifications.mockRejectedValue(new Error('offline'))
    const { rerender } = renderHook(() => useGlobalNotification())
    h.ws.connected = true
    rerender()
    h.ws.connected = false
    rerender()
    h.ws.connected = true
    rerender()
    await waitFor(() => expect(h.getNotifications).toHaveBeenCalledTimes(1))
    expect(h.hydrateNotifications).not.toHaveBeenCalled()
  })

  it('卸载后到达的补拉结果不再写入(取消判据真接线)', async () => {
    const gate: { release: ((v: unknown) => void) | null } = { release: null }
    h.getNotifications.mockImplementation(
      () =>
        new Promise((r) => {
          gate.release = r
        }),
    )
    const { rerender, unmount } = renderHook(() => useGlobalNotification())
    h.ws.connected = true
    rerender()
    h.ws.connected = false
    rerender()
    h.ws.connected = true
    rerender()
    await waitFor(() => expect(h.getNotifications).toHaveBeenCalledTimes(1))
    unmount()
    gate.release?.(okList([ROW]))
    await Promise.resolve()
    expect(h.hydrateNotifications).not.toHaveBeenCalled()
  })

  it('变异锁:补拉必须真装在重连边沿且走幂等 hydrate + keyset(抹掉即红)', () => {
    const src = readFileSync(resolve(__dirname, '../use-global-notification.ts'), 'utf8')
    const markers = [
      'hydrateSinceWatermark(',
      'hydrateNotifications(list)',
      'sinceCreatedAt: cursor.createdAt',
    ]
    for (const marker of markers) expect(src).toContain(marker)
    const stripped = markers.reduce((text, marker) => text.split(marker).join(''), src)
    for (const marker of markers) expect(stripped).not.toContain(marker)
  })

  // ==================== 精确水位(复合 keyset) ====================
  const WATERMARK_ROW = {
    id: 'n-wm',
    type: 'system',
    title: '水位通知',
    isRead: false,
    createdAt: '2026-11-24T12:00:00.000Z',
  }

  it('WS 水位只认服务端 id/createdAt(拒绝伪造 ws- id、坏时刻、非通知帧)', () => {
    expect(extractNotificationWatermark({ type: 'notification', data: WATERMARK_ROW })).toEqual({
      createdAt: WATERMARK_ROW.createdAt,
      id: WATERMARK_ROW.id,
    })
    expect(
      extractNotificationWatermark({
        type: 'notification',
        data: { id: 'ws-1', createdAt: WATERMARK_ROW.createdAt },
      }),
    ).toBeNull()
    expect(
      extractNotificationWatermark({
        type: 'notification',
        data: { id: 'n-x', createdAt: 'not-a-date' },
      }),
    ).toBeNull()
    expect(extractNotificationWatermark({ type: 'other', data: WATERMARK_ROW })).toBeNull()
    expect(
      compareNotificationWatermark(
        { createdAt: '2026-11-24T12:00:00Z', id: 'a' },
        { createdAt: '2026-11-24T12:00:00Z', id: 'b' },
      ),
    ).toBeLessThan(0)
  })

  it('有服务端水位 ⇒ 重连走 sinceCreatedAt/sinceId 增量,不再拉最新页', async () => {
    const sinceRow = { ...ROW, id: 'n-since', createdAt: '2026-11-24T12:30:00.000Z' }
    h.getNotifications.mockResolvedValue(okList([sinceRow]))
    const { rerender } = renderHook(() => useGlobalNotification())
    h.ws.lastMessage = { type: 'notification', data: WATERMARK_ROW }
    rerender()
    h.ws.connected = true
    rerender()
    h.ws.connected = false
    rerender()
    h.ws.connected = true
    rerender()
    await waitFor(() => expect(h.getNotifications).toHaveBeenCalledTimes(1))
    expect(h.getNotifications).toHaveBeenCalledWith({
      pageSize: 100,
      partition: 'active',
      sinceCreatedAt: WATERMARK_ROW.createdAt,
      sinceId: WATERMARK_ROW.id,
    })
    expect(h.hydrateNotifications).toHaveBeenCalledWith([sinceRow])
  })

  it('断线超过 100 条 ⇒ 按水位滚动续拉多页,角标仍取服务端真相', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      ...ROW,
      id: `n-${String(i + 1).padStart(3, '0')}`,
    }))
    const page2 = [{ ...ROW, id: 'n-101' }]
    h.getNotifications.mockImplementation((query: { sinceId?: string }) =>
      Promise.resolve(okList(query.sinceId === 'n-000' ? page1 : page2)),
    )
    const { rerender } = renderHook(() => useGlobalNotification())
    h.ws.lastMessage = { type: 'notification', data: { ...WATERMARK_ROW, id: 'n-000' } }
    rerender()
    h.ws.connected = true
    rerender()
    h.ws.connected = false
    rerender()
    h.ws.connected = true
    rerender()
    await waitFor(() => expect(h.getNotifications).toHaveBeenCalledTimes(2))
    expect(h.getNotifications.mock.calls[1]?.[0]).toMatchObject({ sinceId: 'n-100' })
    expect(h.hydrateNotifications).toHaveBeenNthCalledWith(1, page1)
    expect(h.hydrateNotifications).toHaveBeenNthCalledWith(2, page2)
    // 登录初始化 + 重连各一次,不用本地补回条数重算
    expect(h.getUnreadCount).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
