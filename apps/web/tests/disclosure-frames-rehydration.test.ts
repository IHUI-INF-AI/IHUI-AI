// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-166 交代帧回放往返断言(citations / injections)。
 *
 * 数据流:ai-service 流内同一份列表(_collect_citations / injection_frames)
 *   → /api/ai/callback body → worker 浅合并进 chat_messages.metadata(jsonb)
 *   → getMessages → hydrateHistoryMessage → message.citations / message.injections
 * 断言:逐字段等价 + 脏数据不采信 + 老消息安静缺席(不造空态)。
 */
import { describe, it, expect } from 'vitest'
import { hydrateHistoryMessage, type HistoryMessageRecord } from '@/hooks/use-chat/history-message'

const CITATIONS = [
  { source: 'knowledge', label: '架构说明 §2', url: 'docs/architecture.md' },
  { source: 'web', label: '无链接来源' },
]

const INJECTIONS = [
  {
    kind: 'developer_instructions',
    collapsed: '已应用会话级自定义指令',
    fullText: '按仓库规范回答',
  },
  { kind: 'auto_context', collapsed: '已自动检索并注入 3 段代码上下文', count: 3 },
]

function row(metadata: Record<string, unknown> | null): HistoryMessageRecord {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '回答正文',
    createdAt: '2026-09-22T10:00:00+00:00',
    metadata,
  }
}

describe('hydrateHistoryMessage 交代帧回放', () => {
  it('citations 逐字段等价(有 url 的带 url,没有的不造假链接)', () => {
    const msg = hydrateHistoryMessage(row({ citations: CITATIONS }))
    expect(msg.citations).toEqual(CITATIONS)
  })

  it('injections 逐字段等价(fullText / count 按原样带回)', () => {
    const msg = hydrateHistoryMessage(row({ injections: INJECTIONS }))
    expect(msg.injections).toEqual(INJECTIONS)
  })

  it('两类交代与既有字段共存(toolCalls / planSteps / permissionMode 不互相挤掉)', () => {
    const msg = hydrateHistoryMessage(
      row({
        citations: CITATIONS,
        injections: INJECTIONS,
        planSteps: [{ id: 'tc-1', step: 'read_file: a.txt', status: 'completed' }],
        permissionMode: 'accept-edits',
      }),
    )
    expect(msg.citations).toHaveLength(2)
    expect(msg.injections).toHaveLength(2)
    expect(msg.planSteps).toHaveLength(1)
    expect(msg.permissionMode).toBe('accept-edits')
  })

  it('老消息没有这两个 key → 字段缺席而不是空数组(界面不渲染空交代区)', () => {
    const msg = hydrateHistoryMessage(row({ model: 'x' }))
    expect('citations' in msg).toBe(true)
    expect(msg.citations).toBeUndefined()
    expect(msg.injections).toBeUndefined()
  })

  it('脏数据逐条丢弃,合法条目仍保留(不让一条坏数据抹掉整段交代)', () => {
    const msg = hydrateHistoryMessage(
      row({
        citations: [CITATIONS[0], { source: 'knowledge' }, null, 42],
        injections: [INJECTIONS[0], { kind: 'auto_context' }, 'nonsense'],
      }),
    )
    expect(msg.citations).toEqual([CITATIONS[0]])
    expect(msg.injections).toEqual([INJECTIONS[0]])
  })

  it('metadata 为 null 不抛异常', () => {
    expect(() => hydrateHistoryMessage(row(null))).not.toThrow()
  })
})

describe('hydrateHistoryMessage compaction 回放(G-166 第②步)', () => {
  it('帧载荷 tokensBefore/After → store originalTokens/compressedTokens 逐字段换算', () => {
    const msg = hydrateHistoryMessage(
      row({
        compaction: {
          triggered: true,
          tokensBefore: 48000,
          tokensAfter: 12000,
          removedCount: 31,
          usageRatio: 0.88,
          trigger: 'ratio',
        },
      }),
    )
    expect(msg.compaction).toEqual({
      originalTokens: 48000,
      compressedTokens: 12000,
      removedCount: 31,
      trigger: 'ratio',
    })
  })

  it('incompressible(撞上限)同样回放 —— 分隔线不能只在真压缩时才出现', () => {
    const msg = hydrateHistoryMessage(
      row({
        compaction: {
          triggered: true,
          tokensBefore: 96000,
          tokensAfter: 90000,
          removedCount: 0,
          trigger: 'incompressible',
        },
      }),
    )
    expect(msg.compaction?.trigger).toBe('incompressible')
    expect(msg.compaction?.removedCount).toBe(0)
  })

  it('triggered 非 true / 缺 token 统计 / 非对象 → 字段缺席(不渲染空分隔线)', () => {
    expect(
      hydrateHistoryMessage(
        row({ compaction: { triggered: false, tokensBefore: 1, tokensAfter: 0 } }),
      ).compaction,
    ).toBeUndefined()
    expect(
      hydrateHistoryMessage(row({ compaction: { triggered: true } })).compaction,
    ).toBeUndefined()
    expect(hydrateHistoryMessage(row({ compaction: 'nonsense' })).compaction).toBeUndefined()
  })

  it('老消息没有该 key → 缺席而不是零值分隔线', () => {
    expect(hydrateHistoryMessage(row({ model: 'x' })).compaction).toBeUndefined()
  })
})

describe('hydrateHistoryMessage retryNotice 回放(G-166 第⑥步)', () => {
  it('四字段逐字带回(httpStatus 存在时)', () => {
    const msg = hydrateHistoryMessage(
      row({
        retryNotice: { attempt: 3, maxRetries: 3, retryInMs: 1500, httpStatus: 429 },
      }),
    )
    expect(msg.retryNotice).toEqual({
      attempt: 3,
      maxRetries: 3,
      retryInMs: 1500,
      httpStatus: 429,
    })
  })

  it('httpStatus 缺失时不补 0(不伪造"上游回了 0 码")', () => {
    const msg = hydrateHistoryMessage(
      row({ retryNotice: { attempt: 1, maxRetries: 3, retryInMs: 0 } }),
    )
    expect(msg.retryNotice).toEqual({ attempt: 1, maxRetries: 3, retryInMs: 0 })
  })

  it('attempt / maxRetries 非 ≥1 整数、非对象 → 字段缺席(不渲染假交代)', () => {
    expect(
      hydrateHistoryMessage(row({ retryNotice: { attempt: 0, maxRetries: 3, retryInMs: 0 } }))
        .retryNotice,
    ).toBeUndefined()
    expect(
      hydrateHistoryMessage(row({ retryNotice: { attempt: '2', maxRetries: 3 } })).retryNotice,
    ).toBeUndefined()
    expect(hydrateHistoryMessage(row({ retryNotice: 'nonsense' })).retryNotice).toBeUndefined()
  })

  it('与其他交代共存,互不挤掉', () => {
    const msg = hydrateHistoryMessage(
      row({
        retryNotice: { attempt: 2, maxRetries: 3, retryInMs: 800 },
        compaction: { triggered: true, tokensBefore: 10, tokensAfter: 5, trigger: 'ratio' },
        citations: CITATIONS,
      }),
    )
    expect(msg.retryNotice?.attempt).toBe(2)
    expect(msg.compaction?.compressedTokens).toBe(5)
    expect(msg.citations).toEqual(CITATIONS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
