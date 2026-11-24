// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知状态翻转 `notification:state` 帧(2026-11-24)的构造与解析回归。
 *
 * 这条边界与 createdAt 水位补增量正交:水位只补「新增行」,断线期别的设备把
 * 已有通知标已读/归档时,本端收不到 —— 必须走本事件独立同步。
 * 钉住四格:构造拒坏值 / 载荷不带主体 / 解析与构造同源 / 扩档不挤旧档。
 */
import { describe, it, expect } from 'vitest'

import {
  NOTIFICATION_STATE_OPS,
  USER_BROADCAST_EVENT_NAMES,
  isNotificationStateOp,
  notificationStateEvent,
  parseUserBroadcastFrame,
} from '../src/user-broadcast'

const AT = '2026-11-24T06:00:00.000Z'

describe('notification:state A 构造出口在位且拒坏值', () => {
  it('封闭集恰为六档(删除两档已纳入)', () => {
    expect([...NOTIFICATION_STATE_OPS].sort()).toEqual([
      'archive',
      'delete',
      'delete-all',
      'read',
      'read-all',
      'restore',
    ])
    for (const op of NOTIFICATION_STATE_OPS) expect(isNotificationStateOp(op)).toBe(true)
    expect(isNotificationStateOp('bogus')).toBe(false)
  })

  it('正向:read 帧逐字成形,ids 去重且默认 at 为合法 ISO', () => {
    const evt = notificationStateEvent({
      op: 'read',
      ids: ['n-2', 'n-1', 'n-2'],
      changedBy: 'u-1',
      at: AT,
    })
    expect(evt).toEqual({
      event: 'notification:state',
      data: { op: 'read', ids: ['n-2', 'n-1'], changedBy: 'u-1', at: AT },
    })
  })

  it('read-all 仍带确切 ids,不靠无条件全量置读', () => {
    const evt = notificationStateEvent({ op: 'read-all', ids: ['n-1'], changedBy: 'u-1', at: AT })
    expect(evt.data.op).toBe('read-all')
    expect(evt.data.ids).toEqual(['n-1'])
  })

  it('删除两档正向成形,delete-all 仍带确切 ids 不做无条件清空', () => {
    const del = notificationStateEvent({ op: 'delete', ids: ['n-2'], changedBy: 'u-1', at: AT })
    expect(del.data.op).toBe('delete')
    expect(del.data.ids).toEqual(['n-2'])
    const delAll = notificationStateEvent({
      op: 'delete-all',
      ids: ['n-2', 'n-1'],
      changedBy: 'u-1',
      at: AT,
    })
    expect(delAll.data.op).toBe('delete-all')
    expect(delAll.data.ids).toEqual(['n-2', 'n-1'])
  })

  it('反向:未知 op / 空 changedBy / 空 ids / 空 id / 坏时间 都抛', () => {
    expect(() =>
      notificationStateEvent({ op: 'bogus' as never, ids: ['n-1'], changedBy: 'u-1' }),
    ).toThrow()
    expect(() => notificationStateEvent({ op: 'read', ids: ['n-1'], changedBy: '' })).toThrow()
    expect(() => notificationStateEvent({ op: 'read', ids: [], changedBy: 'u-1' })).toThrow()
    expect(() =>
      notificationStateEvent({ op: 'read', ids: ['', 'n-1'], changedBy: 'u-1' }),
    ).toThrow()
    expect(() =>
      notificationStateEvent({ op: 'read', ids: ['n-1'], changedBy: 'u-1', at: 'not-a-time' }),
    ).toThrow()
  })
})

describe('notification:state B 载荷不带主体', () => {
  it('构造结果无 userId/user_id 键', () => {
    const data = notificationStateEvent({ op: 'read', ids: ['n-1'], changedBy: 'u-1', at: AT }).data
    expect('userId' in data).toBe(false)
    expect('user_id' in data).toBe(false)
  })

  it('parse 侧拒带 userId/user_id 的帧(AGENTS §5)', () => {
    const base = { op: 'read', ids: ['n-1'], changedBy: 'u-1', at: AT }
    expect(
      parseUserBroadcastFrame({ event: 'notification:state', data: { ...base, userId: 'u-2' } }),
    ).toBeNull()
    expect(
      parseUserBroadcastFrame({ event: 'notification:state', data: { ...base, user_id: 'u-2' } }),
    ).toBeNull()
  })
})

describe('notification:state C 解析侧与构造侧同一套规则', () => {
  it('正向帧解析回判别联合', () => {
    const evt = notificationStateEvent({ op: 'archive', ids: ['n-1'], changedBy: 'u-1', at: AT })
    expect(parseUserBroadcastFrame({ event: evt.event, data: evt.data })).toEqual(evt)
  })

  it('删除帧 parse 侧接受(构造与守卫同源扩档)', () => {
    for (const op of ['delete', 'delete-all'] as const) {
      const evt = notificationStateEvent({ op, ids: ['n-1'], changedBy: 'u-1', at: AT })
      expect(parseUserBroadcastFrame({ event: evt.event, data: evt.data })).toEqual(evt)
    }
  })

  it('构造侧拒的坏值,parse 侧同样拦', () => {
    const bad = [
      { op: 'bogus', ids: ['n-1'], changedBy: 'u-1', at: AT },
      { op: 'read', ids: [], changedBy: 'u-1', at: AT },
      { op: 'read', ids: ['n-1', 'n-1'], changedBy: 'u-1', at: AT },
      { op: 'read', ids: ['n-1'], changedBy: '', at: AT },
      { op: 'read', ids: ['n-1'], changedBy: 'u-1', at: 'bad' },
    ]
    for (const data of bad) {
      expect(parseUserBroadcastFrame({ event: 'notification:state', data })).toBeNull()
    }
  })
})

describe('notification:state D 扩档不挤掉旧档', () => {
  it('事件清单含 notification:state 且旧档齐在', () => {
    expect(USER_BROADCAST_EVENT_NAMES).toContain('notification:state')
    expect(USER_BROADCAST_EVENT_NAMES).toContain('conversation:updated')
    expect(USER_BROADCAST_EVENT_NAMES).toContain('message:terminal')
  })

  it('未知事件名 parse 返回 null', () => {
    expect(parseUserBroadcastFrame({ event: 'notification:deleted', data: {} })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
