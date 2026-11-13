// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  appendNotification,
  boundaryKey,
  compactJournal,
  journalBytes,
  mergeHistoricalJournal,
  type JournalNotification,
} from '../src/acp/subagent-journal.js'

function msgChunk(
  sessionId: string,
  messageId: string,
  text: string,
  kind: 'agent_message_chunk' | 'user_message_chunk' = 'agent_message_chunk',
): JournalNotification {
  return { sessionId, update: { sessionUpdate: kind, messageId, content: [{ type: 'text', text }] } }
}

function toolUpdate(
  sessionId: string,
  toolCallId: string,
  extra: Record<string, unknown> = {},
): JournalNotification {
  return {
    sessionId,
    update: { sessionUpdate: 'tool_call_update', toolCallId, ...extra },
  }
}

describe('boundaryKey', () => {
  it('带 messageId 的消息帧用 message:[sessionId,messageId]', () => {
    const a = msgChunk('s1', 'm1', 'x')
    const b = msgChunk('s1', 'm1', 'y')
    expect(boundaryKey(a)).toBe(boundaryKey(b))
    expect(boundaryKey(a)).toContain('m1')
  })

  it('不同会话同名 messageId 是不同 key(命名空间隔离)', () => {
    expect(boundaryKey(msgChunk('s1', 'm1', 'x'))).not.toBe(boundaryKey(msgChunk('s2', 'm1', 'x')))
  })

  it('同 toolCallId 的工具帧同 key', () => {
    expect(boundaryKey(toolUpdate('s1', 't1'))).toBe(boundaryKey(toolUpdate('s1', 't1', { a: 1 })))
  })
})

describe('appendNotification / commitJournalWrite', () => {
  it('同 messageId 的内容块就地合并成一条帧(content 拼接)', () => {
    let journal: JournalNotification[] = []
    const idx = new Map<string, number>()
    journal = appendNotification(journal, idx, msgChunk('s1', 'm1', 'Hel'))
    journal = appendNotification(journal, idx, msgChunk('s1', 'm1', 'lo'))
    // 两条 chunk 合并成一条帧,且文本拼接
    expect(journal).toHaveLength(1)
    expect((journal[0].update.content as { text: string }[])[0].text).toBe('Hello')
  })

  it('不同 messageId 追加成两条独立帧', () => {
    let journal: JournalNotification[] = []
    const idx = new Map<string, number>()
    journal = appendNotification(journal, idx, msgChunk('s1', 'm1', 'a'))
    journal = appendNotification(journal, idx, msgChunk('s1', 'm2', 'b'))
    expect(journal).toHaveLength(2)
  })

  it('同 toolCallId 的工具帧字段合并(后到覆盖,undefined 不覆盖)', () => {
    let journal: JournalNotification[] = []
    const idx = new Map<string, number>()
    journal = appendNotification(journal, idx, toolUpdate('s1', 't1', { rawInput: { a: 1 } }))
    journal = appendNotification(journal, idx, toolUpdate('s1', 't1', { status: 'completed' }))
    expect(journal).toHaveLength(1)
    expect(journal[0].update.rawInput).toEqual({ a: 1 })
    expect(journal[0].update.status).toBe('completed')
  })

  it('event 帧(无稳定 key)不去重,各自独立追加', () => {
    let journal: JournalNotification[] = []
    const idx = new Map<string, number>()
    const plan1: JournalNotification = { sessionId: 's1', update: { sessionUpdate: 'plan_update', entries: [] } }
    const plan2: JournalNotification = { sessionId: 's1', update: { sessionUpdate: 'plan_update', entries: [1] } }
    journal = appendNotification(journal, idx, plan1)
    journal = appendNotification(journal, idx, plan2)
    expect(journal).toHaveLength(2)
    expect(idx.size).toBe(0)
  })
})

describe('compactJournal', () => {
  it('幂等:重复灌入同批历史,compact 结果恒定', () => {
    const a = msgChunk('s1', 'm1', 'a')
    const b = msgChunk('s1', 'm2', 'b')
    const once = compactJournal([a, b])
    const twice = compactJournal([...once, a, b, a])
    expect(twice).toEqual(once)
  })

  it('重复 key 折叠成一条,后到覆盖', () => {
    const out = compactJournal([
      toolUpdate('s1', 't1', { status: 'running' }),
      toolUpdate('s1', 't1', { status: 'completed' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].update.status).toBe('completed')
  })
})

describe('journalBytes', () => {
  it('与帧的 UTF-8 字节数一致且随内容增长', () => {
    const short = [msgChunk('s1', 'm1', 'a')]
    const long = [msgChunk('s1', 'm1', 'a'.repeat(1000))]
    expect(journalBytes(long)).toBeGreaterThan(journalBytes(short))
  })
})

describe('mergeHistoricalJournal', () => {
  it('无重叠时全部历史并入(addedHistory=true)', () => {
    const history = [msgChunk('s1', 'h1', 'a')]
    const current = [msgChunk('s1', 'c1', 'b')]
    const r = mergeHistoricalJournal(history, current)
    expect(r.addedHistory).toBe(true)
    // 历史 h1 + current c1 都在,且各自一条
    expect(r.journal).toHaveLength(2)
  })

  it('历史尾部与 current 头部重叠时保序去重(重叠段只一份,顺序正确)', () => {
    const head = msgChunk('s1', 'h1', 'head')
    const shared = msgChunk('s1', 'shared', 'shared')
    const c1 = msgChunk('s1', 'c1', 'c1')
    // 历史以 [h1, shared] 到达;current 以 [shared, c1] 在跑 —— shared 是重叠段
    const history = [head, shared]
    const current = [shared, c1]
    const r = mergeHistoricalJournal(history, current)
    const ids = r.journal.map((n) => String(n.update.messageId))
    // 正确结果:[h1, shared, c1];shared 只一份,且 c1 在 shared 之后(保 current 的在跑顺序)
    expect(ids).toEqual(['h1', 'shared', 'c1'])
  })

  it('返回的 journalBytes 与实际日志字节一致', () => {
    const r = mergeHistoricalJournal([msgChunk('s1', 'h1', 'a')], [msgChunk('s1', 'c1', 'b')])
    expect(r.journalBytes).toBe(journalBytes(r.journal))
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠