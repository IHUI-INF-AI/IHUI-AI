// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群写运行态的读写与现实校验：频次窗口从内存挪到账号 metadata 之后，
 * 「重启不重置额度」这件事必须有断言兜住，否则等于把闸门重新打开。
 */

import { describe, expect, it } from 'vitest'
import {
  GROUP_WRITE_AUDIT_KEEP,
  appendGroupWriteAudit,
  nextGroupWriteRuntime,
  readGroupWriteRuntime,
} from '../wechat-hub/group-writes'

const HOUR = 3_600_000

describe('readGroupWriteRuntime', () => {
  it('没有记录时给空态，不抛异常', () => {
    expect(readGroupWriteRuntime(null)).toEqual({ stamps: [], audit: [] })
    expect(readGroupWriteRuntime({})).toEqual({ stamps: [], audit: [] })
    expect(readGroupWriteRuntime({ groupWriteRuntime: 'oops' })).toEqual({ stamps: [], audit: [] })
  })

  it('超过一小时的时间戳被剔除，窗口内保留', () => {
    const now = 10 * HOUR
    const runtime = readGroupWriteRuntime(
      { groupWriteRuntime: { stamps: [now - 2 * HOUR, now - 30 * 60_000, now - 60_000] } },
      now,
    )
    expect(runtime.stamps).toEqual([now - 30 * 60_000, now - 60_000])
  })

  it('脏时间戳（0、负数、字符串、NaN）一律丢掉，不参与频次计算', () => {
    const now = 5 * HOUR
    const runtime = readGroupWriteRuntime(
      { groupWriteRuntime: { stamps: [0, -1, 'abc', null, now - 1000] } },
      now,
    )
    expect(runtime.stamps).toEqual([now - 1000])
  })

  it('审计只保留能读懂的条目，字段缺失按空处理', () => {
    const now = 5 * HOUR
    const runtime = readGroupWriteRuntime(
      {
        groupWriteRuntime: {
          audit: [
            { at: now - 1000, action: 'kick', conversationId: 'c1', chatTitle: '项目组', memberIds: ['a'], ok: true },
            { action: 'invite' },
            'junk',
            { at: now - 2000, action: 'rename', ok: false, status: 'bridge_error' },
          ],
        },
      },
      now,
    )
    expect(runtime.audit).toHaveLength(2)
    expect(runtime.audit[0]?.action).toBe('kick')
    expect(runtime.audit[0]?.chatTitle).toBe('项目组')
    expect(runtime.audit[1]?.status).toBe('bridge_error')
    expect(runtime.audit[1]?.conversationId).toBeNull()
    expect(runtime.audit[1]?.memberIds).toEqual([])
  })
})

describe('appendGroupWriteAudit', () => {
  it('超过保留条数时丢最老的，保留最新的一条', () => {
    const entries = Array.from({ length: GROUP_WRITE_AUDIT_KEEP }, (_, index) => ({
      at: index,
      action: 'kick' as const,
      conversationId: null,
      chatTitle: '',
      memberIds: [],
      ok: true,
      status: null,
    }))
    const next = appendGroupWriteAudit(entries, {
      at: 999,
      action: 'invite',
      conversationId: 'c9',
      chatTitle: '群',
      memberIds: ['x'],
      ok: false,
      status: 'WECHAT_GROUP_RATE_LIMITED',
    })
    expect(next).toHaveLength(GROUP_WRITE_AUDIT_KEEP)
    expect(next[0]?.at).toBe(1)
    expect(next.at(-1)?.at).toBe(999)
  })
})

describe('nextGroupWriteRuntime', () => {
  const base = {
    action: 'kick' as const,
    conversationId: 'c1',
    chatTitle: '项目组',
    memberIds: ['a', 'b'],
  }

  it('成功才占频次，失败只记审计', () => {
    const now = 10 * HOUR
    const ok = nextGroupWriteRuntime(
      { stamps: [now - 60_000], audit: [] },
      { ...base, ok: true, status: null },
      now,
    )
    expect(ok.stamps).toEqual([now - 60_000, now])
    expect(ok.audit).toHaveLength(1)
    expect(ok.audit[0]?.ok).toBe(true)

    const failed = nextGroupWriteRuntime(
      { stamps: [now - 60_000], audit: [] },
      { ...base, ok: false, status: 'WECHAT_GROUP_CONFIRM_EXPIRED' },
      now,
    )
    expect(failed.stamps).toEqual([now - 60_000])
    expect(failed.audit[0]?.status).toBe('WECHAT_GROUP_CONFIRM_EXPIRED')
  })

  it('算下一次时把滑出窗口的老时间戳清掉，重启后不会多算次数', () => {
    const now = 10 * HOUR
    const state = nextGroupWriteRuntime(
      { stamps: [now - 2 * HOUR, now - 10 * 60_000], audit: [] },
      { ...base, ok: true, status: null },
      now,
    )
    expect(state.stamps).toEqual([now - 10 * 60_000, now])
  })
})
