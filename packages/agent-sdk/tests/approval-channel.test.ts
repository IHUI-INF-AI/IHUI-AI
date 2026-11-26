// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L03/RP-7 三队列协议的验收面。钉死的六条:
 *  1. 三队列各自独立,不互相吞并;
 *  2. seq 全局单调(跨队列可排序,补发才有"按序"可言);
 *  3. 断线期间入队不丢,重连吐回全部未决且升序;
 *  4. 重连补发是读操作:连调两次得到同一份快照,不会"补一次丢一次";
 *  5. 决策回填后不再出现在补发里,同一请求不得二次决策;
 *  6. 请求可回溯到 session(requestId 幂等,防重连造成双份审批)。
 */

import { describe, expect, it } from 'vitest'

import {
  ApprovalChannel,
  ApprovalChannelError,
  type ApprovalChannelErrorCode,
  type ApprovalQueueKind,
} from '../src/approval-channel.js'

function makeClock(start = 1_766_000_000_000) {
  let now = start
  return { now: () => (now += 1) }
}

function enqueueAll(channel: ApprovalChannel) {
  return (['approval', 'backup', 'restore'] as const).map((kind, index) =>
    channel.enqueue({ kind, sessionId: `sess-${index}`, requestId: `req-${kind}` }),
  )
}

describe('ApprovalChannel 三队列', () => {
  it('三队列独立计数,seq 全局单调跨队列可排序', () => {
    const channel = new ApprovalChannel(makeClock())
    const items = enqueueAll(channel)
    expect(items.map((item) => item.seq)).toEqual([1, 2, 3])
    expect(channel.pending('approval')).toHaveLength(1)
    expect(channel.pending('backup')).toHaveLength(1)
    expect(channel.pending('restore')).toHaveLength(1)
    expect(channel.stats().byKind).toEqual({ approval: 1, backup: 1, restore: 1 })
  })

  it('断线期间入队不丢,重连按 seq 升序补发全部未决', () => {
    const channel = new ApprovalChannel(makeClock())
    enqueueAll(channel)
    channel.disconnect()
    expect(channel.isConnected).toBe(false)
    const late = channel.enqueue({
      kind: 'approval',
      sessionId: 'sess-late',
      requestId: 'req-late',
    })
    const replayed = channel.reconnect()
    expect(channel.isConnected).toBe(true)
    expect(replayed.map((item) => item.seq)).toEqual([1, 2, 3, late.seq])
    expect(replayed.every((item) => item.state === 'pending')).toBe(true)
  })

  it('重连补发是读操作:两次重连拿到同一份快照,不重复入队', () => {
    const channel = new ApprovalChannel(makeClock())
    enqueueAll(channel)
    const first = channel.reconnect().map((item) => item.seq)
    const second = channel.reconnect().map((item) => item.seq)
    expect(first).toEqual(second)
    expect(channel.stats().total).toBe(3)
  })

  it('决策回填后不再出现在补发里;同一请求二次决策被拒绝', () => {
    const channel = new ApprovalChannel(makeClock())
    const items = enqueueAll(channel)
    const [first, second, third] = items
    if (!first || !second || !third) throw new Error('三队列用例的前置建账失败')
    channel.decide(second.seq, 'allowed', '已核对备份内容')
    const replayed = channel.replay().map((item) => item.seq)
    expect(replayed).toEqual([first.seq, third.seq])
    expect(() => channel.decide(second.seq, 'denied')).toThrowError(ApprovalChannelError)
    expect(channel.history().find((item) => item.seq === second.seq)?.note).toBe('已核对备份内容')
  })

  it('请求可回溯到 session:bySession 取全量(含已决)', () => {
    const channel = new ApprovalChannel(makeClock())
    const item = channel.enqueue({ kind: 'approval', sessionId: 'sess-x', requestId: 'r1' })
    channel.enqueue({ kind: 'backup', sessionId: 'sess-y', requestId: 'r2' })
    channel.decide(item.seq, 'denied', '路径越界')
    expect(channel.bySession('sess-x')).toHaveLength(1)
    expect(channel.bySession('sess-x')[0]?.state).toBe('denied')
    expect(channel.bySession('   ')).toEqual([])
  })

  it('requestId 幂等:重复入队拒绝,避免重连造成双份审批', () => {
    const channel = new ApprovalChannel(makeClock())
    channel.enqueue({ kind: 'approval', sessionId: 's', requestId: 'dup' })
    try {
      channel.enqueue({ kind: 'approval', sessionId: 's', requestId: 'dup' })
      throw new Error('应当拒绝重复 requestId')
    } catch (error) {
      expect((error as ApprovalChannelError).code satisfies ApprovalChannelErrorCode).toBe(
        'duplicate-request',
      )
    }
  })

  it('入参校验:未知队列 / 空 session / 空 request / 未知决策一律拒绝', () => {
    const channel = new ApprovalChannel(makeClock())
    const codes: ApprovalChannelErrorCode[] = []
    const grab = (fn: () => void) => {
      try {
        fn()
      } catch (error) {
        codes.push((error as ApprovalChannelError).code)
      }
    }
    grab(() =>
      channel.enqueue({ kind: 'other' as ApprovalQueueKind, sessionId: 's', requestId: 'r' }),
    )
    grab(() => channel.enqueue({ kind: 'approval', sessionId: '  ', requestId: 'r' }))
    grab(() => channel.enqueue({ kind: 'approval', sessionId: 's', requestId: '' }))
    const ok = channel.enqueue({ kind: 'approval', sessionId: 's', requestId: 'ok' })
    grab(() => channel.decide(ok.seq, 'maybe' as never))
    grab(() => channel.decide(999, 'allowed'))
    expect(codes).toEqual([
      'bad-kind',
      'missing-session',
      'missing-request',
      'bad-decision',
      'unknown-seq',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
