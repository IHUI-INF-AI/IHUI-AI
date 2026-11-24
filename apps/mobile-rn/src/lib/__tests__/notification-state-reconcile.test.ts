// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  applySnapshot,
  reconcileNotificationState,
  STATE_QUERY_LIMIT,
  type NotificationStateSnapshot,
} from '../notification-state-reconcile'
import type { NotificationStateActions } from '../user-broadcast'

type CallKey = 'read' | 'archive' | 'restore' | 'delete'

function actions(): NotificationStateActions & {
  calls: Record<CallKey, string[][]>
} {
  const calls: Record<CallKey, string[][]> = {
    read: [],
    archive: [],
    restore: [],
    delete: [],
  }
  return {
    calls,
    markAsReadByIds: (ids) => calls.read.push(ids),
    archiveByIds: (ids) => calls.archive.push(ids),
    restoreByIds: (ids) => calls.restore.push(ids),
    deleteByIds: (ids) => calls.delete.push(ids),
  }
}

const SNAP: NotificationStateSnapshot = {
  readIds: ['n1'],
  archivedIds: ['n2'],
  deletedIds: ['n3'],
}

describe('applySnapshot - 权威快照按确切 ids 落本地', () => {
  it('三档分别调用对应 action;空档不调用(未知 id 不猜不新增)', () => {
    const a = actions()
    applySnapshot(SNAP, a)
    expect(a.calls.read).toEqual([['n1']])
    expect(a.calls.archive).toEqual([['n2']])
    expect(a.calls.delete).toEqual([['n3']])
    expect(a.calls.restore).toEqual([])
    const empty = actions()
    applySnapshot({ readIds: [], archivedIds: [], deletedIds: [] }, empty)
    expect(empty.calls).toEqual({ read: [], archive: [], restore: [], delete: [] })
  })
})

describe('reconcileNotificationState - 重连对账不半批、不冒充', () => {
  it('本地无 ids ⇒ 不发请求、不 apply、返回 false', async () => {
    const query = vi.fn()
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => [],
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => false,
    })
    expect(ok).toBe(false)
    expect(query).not.toHaveBeenCalled()
    expect(a.calls.read).toEqual([])
  })

  it('单次成功 ⇒ 合并快照一次 apply,返回 true', async () => {
    const query = vi.fn(async () => ({ success: true, data: SNAP }))
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => ['n1', 'n2', 'n3'],
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => false,
    })
    expect(ok).toBe(true)
    expect(query).toHaveBeenCalledTimes(1)
    expect(a.calls.read).toEqual([['n1']])
  })

  it('超过 500 分片查询,合并后一次性 apply(不留半批)', async () => {
    const ids = Array.from({ length: STATE_QUERY_LIMIT + 2 }, (_, i) => 'id' + i)
    const query = vi.fn(async (chunk: string[]) => ({
      success: true,
      data: {
        readIds: chunk.filter((_, i) => i === 0),
        archivedIds: [],
        deletedIds: [],
      },
    }))
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => ids,
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => false,
    })
    expect(ok).toBe(true)
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[0]?.[0]).toHaveLength(STATE_QUERY_LIMIT)
    expect(query.mock.calls[1]?.[0]).toHaveLength(2)
    // 两片各 1 条已读,合并后一次 apply ⇒ 仅一次 markAsReadByIds,含两条
    expect(a.calls.read).toHaveLength(1)
    expect(a.calls.read.at(0)).toEqual(['id0', 'id500'])
  })

  it('任一分片失败 ⇒ 整批不 apply,返回 false', async () => {
    const ids = Array.from({ length: STATE_QUERY_LIMIT + 2 }, (_, i) => 'id' + i)
    let n = 0
    const query = vi.fn(async () => {
      n++
      return n === 1
        ? { success: true, data: SNAP }
        : { success: false, data: null }
    })
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => ids,
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => false,
    })
    expect(ok).toBe(false)
    expect(a.calls).toEqual({ read: [], archive: [], restore: [], delete: [] })
  })

  it('查询抛错 ⇒ 返回 false,不把失败冒充已对齐', async () => {
    const query = vi.fn(async () => {
      throw new Error('network-down')
    })
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => ['n1'],
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => false,
    })
    expect(ok).toBe(false)
    expect(a.calls.read).toEqual([])
  })

  it('取消时不发后续分片也不 apply(换账号后旧请求不回写)', async () => {
    const ids = Array.from({ length: STATE_QUERY_LIMIT + 2 }, (_, i) => 'id' + i)
    let n = 0
    const query = vi.fn(async () => {
      n++
      return { success: true, data: SNAP }
    })
    const a = actions()
    const ok = await reconcileNotificationState({
      getLocalIds: () => ids,
      query,
      apply: applySnapshot,
      actions: a,
      isCancelled: () => n >= 1,
    })
    expect(ok).toBe(false)
    expect(query).toHaveBeenCalledTimes(1)
    expect(a.calls).toEqual({ read: [], archive: [], restore: [], delete: [] })
  })
})
