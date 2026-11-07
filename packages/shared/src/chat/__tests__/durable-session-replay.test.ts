// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  DURABLE_REPLAY_CURSOR_TYPE,
  DURABLE_REPLAY_HISTORY_CAP,
  chatMessageToDurableItem,
  planDurableSessionReplay,
  selectRewindHead,
  type DurableTranscriptItem,
} from '../durable-session-replay'

function user(id: string, requestId?: string): DurableTranscriptItem {
  return { id, kind: 'user', ...(requestId !== undefined ? { requestId } : {}) }
}

function item(
  id: string,
  kind: DurableTranscriptItem['kind'],
  extra: Partial<DurableTranscriptItem> = {},
): DurableTranscriptItem {
  return { id, kind, ...extra }
}

const cursor = (last: number, before?: string, extra: Record<string, unknown> = {}) => ({
  type: DURABLE_REPLAY_CURSOR_TYPE,
  last,
  ...(before !== undefined ? { before } : {}),
  ...extra,
})

describe('planDurableSessionReplay', () => {
  it('没有游标时不投影，也不因超限失败', () => {
    const items = Array.from({ length: DURABLE_REPLAY_HISTORY_CAP + 1 }, (_, index) =>
      user(`u${index}`, 'r'),
    )
    expect(planDurableSessionReplay({ items, replayFrom: null })).toEqual({
      ok: true,
      kind: 'skip',
      reason: 'no-cursor',
    })
  })

  it('超限是独立错误码', () => {
    const items = Array.from({ length: DURABLE_REPLAY_HISTORY_CAP + 1 }, (_, index) =>
      user(`u${index}`),
    )
    const plan = planDurableSessionReplay({ items, replayFrom: cursor(1) })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.code).toBe('history_too_large')
  })

  it('拒绝 after、未知字段、非正整数 last', () => {
    const items = [user('u1', 'r1')]
    expect(
      planDurableSessionReplay({ items, replayFrom: cursor(1, undefined, { after: 'u1' }) }).ok,
    ).toBe(false)
    const after = planDurableSessionReplay({ items, replayFrom: { ...cursor(1), after: 'u1' } })
    expect(after.ok).toBe(false)
    if (!after.ok) expect(after.message).toContain('after')
    const extra = planDurableSessionReplay({
      items,
      replayFrom: cursor(1, undefined, { vendor: true }),
    })
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.code).toBe('invalid_replay')
    expect(planDurableSessionReplay({ items, replayFrom: cursor(0) }).ok).toBe(false)
    expect(planDurableSessionReplay({ items, replayFrom: { type: 'start', last: 1 } }).ok).toBe(
      false,
    )
  })

  it('插话必须挂在上一根用户轮上，失配带 messageId', () => {
    const mismatched = planDurableSessionReplay({
      items: [user('u1', 'r1'), item('s1', 'steer', { requestId: 'other' })],
      replayFrom: cursor(1),
    })
    expect(mismatched.ok).toBe(false)
    if (!mismatched.ok) {
      expect(mismatched.code).toBe('invalid_history')
      expect(mismatched.messageId).toBe('s1')
    }
    const orphan = planDurableSessionReplay({
      items: [item('s0', 'steer', { requestId: 'r1' })],
      replayFrom: cursor(1),
    })
    expect(orphan.ok).toBe(false)
    if (!orphan.ok) expect(orphan.messageId).toBe('s0')
  })

  it('重复用户轮 id 拒绝', () => {
    const plan = planDurableSessionReplay({
      items: [user('u1', 'r1'), item('a1', 'assistant'), user('u1', 'r2')],
      replayFrom: cursor(2),
    })
    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.messageId).toBe('u1')
  })

  it('before 排他，窗口含该轮之前的插话与助手，并盖 rootRequestId', () => {
    const items: DurableTranscriptItem[] = [
      user('u1', 'r1'),
      item('a1', 'assistant', { requestId: 'r1', usedTokens: 3, modelId: 'm' }),
      item('s1', 'steer', { requestId: 'r1' }),
      user('u2', 'r2'),
      item('a2', 'assistant'),
      user('u3', 'r3'),
    ]
    const plan = planDurableSessionReplay({
      items,
      replayFrom: cursor(2, 'u3'),
      title: '周报',
      contextSize: () => 100,
    })
    expect(plan.ok).toBe(true)
    if (plan.ok && plan.kind === 'window') {
      expect(plan.history.map((row) => row.id)).toEqual(['u1', 'a1', 's1', 'u2', 'a2'])
      expect(plan.startCursor).toBe('u1')
      expect(plan.endCursor).toBe('u2')
      expect(plan.hasPreviousPage).toBe(false)
      expect(plan.hasNextPage).toBe(true)
      expect(plan.updates[0]).toEqual({ kind: 'session_info', title: '周报' })
      const usage = plan.updates.find((update) => update.kind === 'usage')
      expect(usage).toMatchObject({
        messageId: 'a1',
        used: 3,
        size: 100,
        requestId: 'r1',
        rootRequestId: 'r1',
        modelId: 'm',
      })
    }
  })

  it('contextSize 不给数时不产出用量帧', () => {
    const plan = planDurableSessionReplay({
      items: [user('u1', 'r1'), item('a1', 'assistant', { requestId: 'r1', usedTokens: 8 })],
      replayFrom: cursor(1),
      contextSize: () => undefined,
    })
    expect(plan.ok).toBe(true)
    if (plan.ok && plan.kind === 'window') {
      expect(plan.updates.some((update) => update.kind === 'usage')).toBe(false)
    }
  })

  it('终态条目不计量', () => {
    const plan = planDurableSessionReplay({
      items: [user('u1', 'r1'), item('t1', 'terminal', { requestId: 'r1', usedTokens: 9 })],
      replayFrom: cursor(1),
      contextSize: () => 10,
    })
    expect(plan.ok).toBe(true)
    if (plan.ok && plan.kind === 'window') {
      expect(plan.updates).toEqual([
        { kind: 'item', messageId: 'u1' },
        { kind: 'terminal', messageId: 't1' },
      ])
    }
  })

  it('已有 rootRequestId 时不覆盖', () => {
    const plan = planDurableSessionReplay({
      items: [
        user('u1', 'r1'),
        item('a1', 'assistant', { requestId: 'r1', rootRequestId: 'root', usedTokens: 1 }),
      ],
      replayFrom: cursor(1),
      contextSize: () => 4,
    })
    expect(plan.ok).toBe(true)
    if (plan.ok && plan.kind === 'window') {
      const usage = plan.updates.find((update) => update.kind === 'usage')
      expect(usage).toMatchObject({ rootRequestId: 'root' })
    }
  })

  it('游标不在转录里', () => {
    const plan = planDurableSessionReplay({
      items: [user('u1', 'r1')],
      replayFrom: cursor(1, 'missing'),
    })
    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      expect(plan.code).toBe('cursor_not_found')
      expect(plan.cursor).toBe('missing')
    }
  })

  it('回退后没有头消息：无 before 时点名原因，有 before 时仍是找不到游标', () => {
    const items = [user('u1', 'r1')]
    const empty = planDurableSessionReplay({
      items,
      replayFrom: cursor(1),
      conversationReverted: true,
      title: '还在',
    })
    expect(empty).toEqual({
      ok: true,
      kind: 'empty',
      reason: 'reverted-without-head',
      updates: [{ kind: 'session_info', title: '还在' }],
    })
    const missed = planDurableSessionReplay({
      items,
      replayFrom: cursor(1, 'u1'),
      conversationReverted: true,
      lastMessageId: '',
    })
    expect(missed.ok).toBe(false)
    if (!missed.ok) expect(missed.code).toBe('cursor_not_found')
  })
})

describe('selectRewindHead', () => {
  const items: DurableTranscriptItem[] = [
    user('u1', 'r1'),
    item('a1', 'assistant'),
    user('u2', 'r2'),
    item('c1', 'custom'),
  ]

  it('before 切到该用户轮之前，头消息跳过自定义项', () => {
    const head = selectRewindHead(items, { before: 'u2' })
    expect(head.ok).toBe(true)
    if (head.ok) {
      expect(head.history.map((row) => row.id)).toEqual(['u1', 'a1'])
      expect(head.headMessageId).toBe('a1')
    }
  })

  it('after 保留到下一根用户轮之前', () => {
    const head = selectRewindHead(items, { after: 'u1' })
    expect(head.ok).toBe(true)
    if (head.ok) expect(head.history.map((row) => row.id)).toEqual(['u1', 'a1'])
  })

  it('before 与 after 同时给出或都不给出都拒绝', () => {
    expect(selectRewindHead(items, {}).ok).toBe(false)
    expect(selectRewindHead(items, { before: 'u1', after: 'u2' }).ok).toBe(false)
    const bare = selectRewindHead(items, {})
    if (!bare.ok) expect(bare.code).toBe('invalid_boundary')
  })

  it('不给边界时头消息是最后一条非自定义', () => {
    const head = selectRewindHead(items, null)
    expect(head.ok).toBe(true)
    if (head.ok) expect(head.headMessageId).toBe('u2')
  })
})

describe('chatMessageToDurableItem', () => {
  it('按 metadata 认出插话，忽略负 token', () => {
    expect(
      chatMessageToDurableItem({
        id: 'm',
        role: 'user',
        tokens: -1,
        metadata: { steer: true, requestId: 'r' },
      }),
    ).toEqual({ id: 'm', kind: 'steer', requestId: 'r' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
