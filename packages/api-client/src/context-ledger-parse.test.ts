// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:批次 3 上下文账本 / 压缩边界线格式解析面测试(纯内存,无网络)。

// 批次 3(2026-11-06):usage 帧可选 contextLedger 与 compaction 帧可选 boundary 的解析判据。
// 断言面刻意从严:
//  ① 七类必须齐全且互不重复、类别在闭集内 —— 缺一类/多一类都整帧拒收(不猜档);
//  ② tokens/percent 必须有限非负,contextLimit 必须 > 0;
//  ③ 压缩边界形状不认 ⇒ undefined,不用空锚点/0 回填("无边界"与"边界未知"必须可分);
//  ④ 保留段锚点存在时形状必须完整,role/excerpt/index 缺一即拒。
import { describe, expect, it } from 'vitest'
import {
  parseCompactBoundarySnapshot,
  parseContextLedgerSnapshot,
  type ContextLedgerSnapshot,
} from './client'

const VALID_LEDGER: ContextLedgerSnapshot = {
  model: 'gpt-4o',
  contextLimit: 128000,
  usedTokens: 64000,
  percentage: 50,
  categories: [
    { category: 'system_prompt', tokens: 2000, percent: 1.6 },
    { category: 'system_tools', tokens: 4000, percent: 3.1 },
    { category: 'skills', tokens: 2000, percent: 1.6 },
    { category: 'messages', tokens: 54000, percent: 42.2 },
    { category: 'other', tokens: 2000, percent: 1.6 },
    { category: 'free_space', tokens: 58000, percent: 45.3 },
    { category: 'auto_compact', tokens: 6000, percent: 4.7 },
  ],
  tokenizer: 'heuristic',
  compacted: false,
  capturedAt: '2026-11-06T04:00:00.000Z',
}

const VALID_BOUNDARY = {
  trigger: 'ratio',
  tokensBefore: 120000,
  tokensAfter: 42000,
  messagesSummarized: 18,
  durationMs: 320,
  preservedSegment: {
    head: { index: 18, role: 'user', messageId: 'm-18', excerpt: '继续实现预算硬约束' },
    anchor: { index: 17, role: 'assistant', messageId: null, excerpt: '前情摘要:已完成 12 项改动' },
    tail: { index: 16, role: 'tool', messageId: 'm-16', excerpt: '工具结果:typecheck 通过' },
  },
  removedRange: { startIndex: 0, endIndex: 17 },
}

describe('parseContextLedgerSnapshot — 七类账本解析', () => {
  it('七类齐全时原样接住,顺序保持', () => {
    const parsed = parseContextLedgerSnapshot(VALID_LEDGER)
    expect(parsed?.categories.map((c) => c.category)).toEqual([
      'system_prompt',
      'system_tools',
      'skills',
      'messages',
      'other',
      'free_space',
      'auto_compact',
    ])
    expect(parsed?.usedTokens).toBe(64000)
  })

  it('缺一类 / 多一类 / 重复类别 ⇒ 整帧拒收', () => {
    const six = VALID_LEDGER.categories.slice(0, 6)
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, categories: six })).toBeUndefined()
    const duplicated = [...VALID_LEDGER.categories.slice(0, 6), VALID_LEDGER.categories[0]]
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, categories: duplicated })).toBeUndefined()
  })

  it('未知类别 ⇒ 拒收(不猜档)', () => {
    const unknown = VALID_LEDGER.categories.map((c, i) =>
      i === 0 ? { ...c, category: 'prompt_cache' } : c,
    )
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, categories: unknown })).toBeUndefined()
  })

  it('contextLimit=0 / 负数 token / 未知 tokenizer ⇒ 拒收', () => {
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, contextLimit: 0 })).toBeUndefined()
    const negative = VALID_LEDGER.categories.map((c, i) => (i === 1 ? { ...c, tokens: -1 } : c))
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, categories: negative })).toBeUndefined()
    expect(parseContextLedgerSnapshot({ ...VALID_LEDGER, tokenizer: 'guessed' })).toBeUndefined()
  })

  it('非对象输入一律 undefined', () => {
    expect(parseContextLedgerSnapshot(null)).toBeUndefined()
    expect(parseContextLedgerSnapshot('ledger')).toBeUndefined()
  })
})

describe('parseCompactBoundarySnapshot — 压缩边界与保留段解析', () => {
  it('head/anchor/tail 与 removedRange 完整接住', () => {
    const parsed = parseCompactBoundarySnapshot(VALID_BOUNDARY)
    expect(parsed?.preservedSegment.head?.index).toBe(18)
    expect(parsed?.preservedSegment.anchor?.excerpt).toContain('前情摘要')
    expect(parsed?.preservedSegment.tail?.messageId).toBe('m-16')
    expect(parsed?.removedRange).toEqual({ startIndex: 0, endIndex: 17 })
    expect(parsed?.durationMs).toBe(320)
  })

  it('锚点缺失按 null,不造空锚点', () => {
    const parsed = parseCompactBoundarySnapshot({
      ...VALID_BOUNDARY,
      preservedSegment: { head: null, anchor: VALID_BOUNDARY.preservedSegment.anchor, tail: null },
      removedRange: null,
    })
    expect(parsed?.preservedSegment.head).toBeNull()
    expect(parsed?.preservedSegment.tail).toBeNull()
    expect(parsed?.removedRange).toBeNull()
  })

  it('锚点存在但形状残缺 ⇒ 该锚点拒收为 null(不部分放行)', () => {
    const parsed = parseCompactBoundarySnapshot({
      ...VALID_BOUNDARY,
      preservedSegment: {
        head: { index: 18, role: 'user' },
        anchor: VALID_BOUNDARY.preservedSegment.anchor,
        tail: null,
      },
    })
    expect(parsed?.preservedSegment.head).toBeNull()
  })

  it('缺 trigger / 负数 token / 非法 removedRange ⇒ undefined', () => {
    expect(parseCompactBoundarySnapshot({ ...VALID_BOUNDARY, trigger: '' })).toBeUndefined()
    expect(parseCompactBoundarySnapshot({ ...VALID_BOUNDARY, tokensBefore: -1 })).toBeUndefined()
    expect(
      parseCompactBoundarySnapshot({ ...VALID_BOUNDARY, removedRange: { startIndex: 3 } }),
    ).toBeUndefined()
  })
})
