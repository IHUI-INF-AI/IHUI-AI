// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知 store 批量翻转 API 回归(2026-11-24)。
 * 这三条 API 服务状态翻转广播/重连快照,核心纪律:
 *  ① 只按服务端给的确切 ids 改,本地没有的 id 不猜不新增;
 *  ② 不重算 unreadCount(角标真相源是服务端),只改条目字段;
 *  ③ 幂等:重复应用同一 id 不产生新变化。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useNotificationStore } from '../notification'

const ROW = (id: string, isRead = false, archivedAt: string | null = null) => ({
  id,
  type: 'system' as const,
  title: 't',
  content: '',
  isRead,
  archivedAt,
  createdAt: '2026-11-24T12:00:00.000Z',
})

beforeEach(() => {
  useNotificationStore.setState({
    notifications: [ROW('n-1'), ROW('n-2', true), ROW('n-3')],
    unreadCount: 7, // 故意与条目数不等:角标以服务端为准,批量翻转不得重算
    unreadMessageCount: 2,
  })
})

describe('通知批量翻转 API', () => {
  it('markAsReadByIds 只改命中且未读的 id,不重算角标', () => {
    useNotificationStore.getState().markAsReadByIds(['n-1', 'n-2'])
    const rows = useNotificationStore.getState().notifications
    expect(rows.find((r) => r.id === 'n-1')?.isRead).toBe(true)
    expect(rows.find((r) => r.id === 'n-3')?.isRead).toBe(false)
    expect(useNotificationStore.getState().unreadCount).toBe(7)
  })

  it('markAsReadByIds 本地没有的 id 不新增条目', () => {
    useNotificationStore.getState().markAsReadByIds(['n-ghost'])
    expect(useNotificationStore.getState().notifications).toHaveLength(3)
  })

  it('archiveByIds 写 archivedAt,restoreByIds 清掉,均幂等', () => {
    useNotificationStore.getState().archiveByIds(['n-1'])
    const first = useNotificationStore.getState().notifications.find((r) => r.id === 'n-1')
    expect(first?.archivedAt).toBeTruthy()
    const stamp = first?.archivedAt
    useNotificationStore.getState().archiveByIds(['n-1'])
    expect(
      useNotificationStore.getState().notifications.find((r) => r.id === 'n-1')?.archivedAt,
    ).toBe(stamp)
    useNotificationStore.getState().restoreByIds(['n-1'])
    expect(
      useNotificationStore.getState().notifications.find((r) => r.id === 'n-1')?.archivedAt,
    ).toBeNull()
  })

  it('空 ids 是一等公民(不写库不改状态)', () => {
    const before = useNotificationStore.getState().notifications
    useNotificationStore.getState().markAsReadByIds([])
    useNotificationStore.getState().archiveByIds([])
    useNotificationStore.getState().restoreByIds([])
    expect(useNotificationStore.getState().notifications).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
