// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D195 装车证明:通知的「隐藏(归档)↔恢复」这条可撤销状态迁移。
// 断言面(每条都是裸 DOM 匹配器,本包未装 @testing-library/jest-dom):
// ① 分区参数真的带到请求上(active ↔ archived)——不带就是"归档行混进默认视图";
// ② 隐藏成功后红点口径与列表一起失效重取;
// ③ 失败态必须落在这条行上(hideFailed/restoreFailed),而不是把行悄悄留着当成功;
// ④ 点行尾操作**不得**顺带触发整行的"标为已读"(副作用没发生才算隔离干净);
// ⑤ 两种分区的空态文案不得同形(归档区要告诉用户可以恢复)。
import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  archiveNotification: vi.fn(),
  restoreNotification: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: (_ns: string) => (key: string) => key,
}))

vi.mock('@ihui/api-client', () => ({
  getNotifications: h.getNotifications,
  archiveNotification: h.archiveNotification,
  restoreNotification: h.restoreNotification,
  markNotificationRead: h.markNotificationRead,
}))

import { NotificationFeed } from '../NotificationFeed'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function page(list: unknown[]) {
  return { success: true, data: { list, total: list.length, page: 1, pageSize: 10, unread: 1 } }
}

const ROWS = [
  {
    id: 'n1',
    type: 'system',
    title: '系统一',
    content: '甲',
    isRead: false,
    createdAt: '2026-10-18T01:00:00Z',
  },
  {
    id: 'n2',
    type: 'follow',
    title: '关注二',
    content: null,
    isRead: true,
    createdAt: '2026-10-17T01:00:00Z',
  },
]

function renderFeed(partition: 'active' | 'archived', view: 'list' | 'timeline' = 'list') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NotificationFeed tab="all" partition={partition} view={view} />
    </QueryClientProvider>,
  )
}

function firstByText(key: string): HTMLElement {
  const el = screen.getAllByText(key)[0]
  if (!el) throw new Error(`未找到文本 ${key}`)
  return el
}

describe('D195 通知归档流', () => {
  it('① active 分区:请求带 partition=active,未读单列一节「需要了解」,行尾给 hide', async () => {
    h.getNotifications.mockResolvedValue(page(ROWS))
    renderFeed('active')
    await waitFor(() => expect(screen.getByText('系统一')).toBeTruthy())
    expect(h.getNotifications.mock.calls[0]?.[0]).toMatchObject({ partition: 'active' })
    expect(screen.getByText('important')).toBeTruthy()
    expect(screen.getAllByText('hide').length).toBe(2)
    // 已读行不重复出现在未读节里(分节不是把同一行渲染两遍)
    expect(screen.getAllByText('系统一').length).toBe(1)
  })

  it('② 点 hide → 打到归档接口并重取列表;在飞显示 hiding', async () => {
    h.getNotifications.mockResolvedValue(page(ROWS))
    h.archiveNotification.mockResolvedValue({ success: true, data: { notification: ROWS[0] } })
    renderFeed('active')
    await waitFor(() => expect(screen.getAllByText('hide').length).toBe(2))
    fireEvent.click(firstByText('hide'))
    expect(screen.getByText('hiding')).toBeTruthy()
    await waitFor(() => expect(h.archiveNotification).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(h.getNotifications.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.queryByText('hiding')).toBeNull())
  })

  it('③ 归档失败:回显 hideFailed,且不得把该行当成已归档消失', async () => {
    h.getNotifications.mockResolvedValue(page(ROWS))
    h.archiveNotification.mockResolvedValue({ success: false, error: 'boom' })
    renderFeed('active')
    await waitFor(() => expect(screen.getAllByText('hide').length).toBe(2))
    fireEvent.click(firstByText('hide'))
    await waitFor(() => expect(screen.getByText('hideFailed')).toBeTruthy())
    expect(screen.getByText('系统一')).toBeTruthy()
  })

  it('④ 点 hide 不触发整行的"标为已读"', async () => {
    h.getNotifications.mockResolvedValue(page(ROWS))
    h.archiveNotification.mockResolvedValue({ success: true, data: { notification: ROWS[0] } })
    renderFeed('active')
    await waitFor(() => expect(screen.getAllByText('hide').length).toBe(2))
    fireEvent.click(firstByText('hide'))
    await waitFor(() => expect(h.archiveNotification).toHaveBeenCalled())
    expect(h.markNotificationRead).not.toHaveBeenCalled()
  })

  it('⑤ archived 分区:请求带 partition=archived,行尾换成 restore,失败回显 restoreFailed', async () => {
    h.getNotifications.mockResolvedValue(page(ROWS))
    h.restoreNotification.mockResolvedValue({ success: false, error: 'boom' })
    renderFeed('archived')
    await waitFor(() => expect(screen.getAllByText('restore').length).toBe(2))
    expect(h.getNotifications.mock.calls[0]?.[0]).toMatchObject({ partition: 'archived' })
    fireEvent.click(firstByText('restore'))
    await waitFor(() => expect(h.restoreNotification).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(screen.getByText('restoreFailed')).toBeTruthy())
  })

  it('⑥ 两种分区空态文案不同形;时间线视图同样可撤销', async () => {
    h.getNotifications.mockResolvedValue(page([]))
    const r1 = renderFeed('archived')
    await waitFor(() => expect(screen.getByText('emptyArchivedDescription')).toBeTruthy())
    r1.unmount()
    const r2 = renderFeed('active')
    await waitFor(() => expect(screen.getByText('emptyDescription')).toBeTruthy())
    expect(screen.queryByText('emptyArchivedDescription')).toBeNull()
    r2.unmount()

    h.getNotifications.mockResolvedValue(page(ROWS))
    renderFeed('active', 'timeline')
    await waitFor(() => expect(screen.getAllByText('hide').length).toBe(2))
  })

  it('⑦ 取数失败:显式 unavailable,不是静默空列表', async () => {
    h.getNotifications.mockResolvedValue({ success: false, error: '网络中断' })
    renderFeed('active')
    await waitFor(() => expect(screen.getByText('unavailable')).toBeTruthy())
    expect(screen.queryByText('noData')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
