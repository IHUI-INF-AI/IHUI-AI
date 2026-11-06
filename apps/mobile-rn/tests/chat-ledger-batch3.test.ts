// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 批次 3(2026-11-06)RN 纯函数用例:
 *  ① 硬停止原因码文案闭集(唯一的六值映射在 shared,本端只断言转发结果);
 *  ② stopped 终态不被后续 warning/critical 覆盖;
 *  ③ 七类账本固定顺序 + 两条恒等式;
 *  ④ 压缩边界摘要(head/anchor/tail + removedRange)格式化。
 *
 * 这里直连 shared 契约源码取常量/类型,避免 vitest 的 `@ihui/shared` 父别名落到测试替身、
 * 把"顺序/闭集"对账变成对替身对账。
 */
import { describe, expect, it } from 'vitest'
import {
  BUDGET_STOP_REASON_CODES,
  CONTEXT_LEDGER_CATEGORIES,
  type CompactBoundary,
  type ContextLedger,
  type ContextLedgerCategoryUsage,
} from '../../../packages/shared/src/sse/contract'
import {
  BUDGET_STOP_FALLBACK_TEXT,
  budgetStopReasonText,
  budgetStopReasonTexts,
} from '../../../packages/shared/src/chat/budget-stop-note'
import { budgetNoteText, nextBudgetLevel } from '../src/utils/budget-note'
import {
  CONTEXT_LEDGER_ORDER,
  contextLedgerIdentity,
  orderContextLedgerCategories,
} from '../src/utils/context-ledger'
import { boundaryAnchorLines, formatRemovedRange } from '../src/utils/compaction-boundary'

function category(
  name: ContextLedgerCategoryUsage['category'],
  tokens: number,
  percent: number,
): ContextLedgerCategoryUsage {
  return { category: name, tokens, percent }
}

describe('预算硬停止文案闭集(shared 唯一出口)', () => {
  it('六个原因码各有一句独立文案,且都不回落到通用句', () => {
    expect(BUDGET_STOP_REASON_CODES).toHaveLength(6)
    const texts = budgetStopReasonTexts()
    expect(texts).toHaveLength(BUDGET_STOP_REASON_CODES.length)
    expect(new Set(texts).size).toBe(BUDGET_STOP_REASON_CODES.length)
    for (const code of BUDGET_STOP_REASON_CODES) {
      const text = budgetStopReasonText(code)
      expect(text).not.toBe(BUDGET_STOP_FALLBACK_TEXT)
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  it('未知码与缺失码统一回落通用句', () => {
    expect(budgetStopReasonText('future_unknown_code')).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(undefined)).toBe(BUDGET_STOP_FALLBACK_TEXT)
  })

  it('stopped 走原因码文案,不落进 warning 标题', () => {
    // t 只回显键名:若走了 formatBudgetNote,结果会是 common.* 键而不是中文句。
    const t = (key: string) => key
    expect(budgetNoteText({ level: 'stopped', reasonCode: 'daily_token_limit' }, t)).toBe(
      budgetStopReasonText('daily_token_limit'),
    )
    expect(budgetNoteText({ level: 'stopped', reasonCode: undefined }, t)).toBe(
      BUDGET_STOP_FALLBACK_TEXT,
    )
  })
})

describe('stopped 是终态', () => {
  it('已被 stopped 钉住后,后到的任何档位都不覆盖', () => {
    expect(nextBudgetLevel('stopped', 'warning')).toBe('stopped')
    expect(nextBudgetLevel('stopped', 'critical')).toBe('stopped')
    expect(nextBudgetLevel('stopped', 'stopped')).toBe('stopped')
  })

  it('未 stopped 时按新档位推进(首帧 null 也照常接住)', () => {
    expect(nextBudgetLevel(null, 'warning')).toBe('warning')
    expect(nextBudgetLevel('warning', 'critical')).toBe('critical')
    expect(nextBudgetLevel('critical', 'stopped')).toBe('stopped')
  })
})

describe('七类上下文账本', () => {
  it('本地固定顺序与 shared 契约逐项一致', () => {
    expect([...CONTEXT_LEDGER_ORDER]).toEqual([...CONTEXT_LEDGER_CATEGORIES])
  })

  it('乱序入参按契约顺序重排,七类齐全才出表', () => {
    const shuffled: ContextLedgerCategoryUsage[] = [
      category('auto_compact', 100, 10),
      category('messages', 400, 40),
      category('system_prompt', 200, 20),
      category('free_space', 100, 10),
      category('other', 50, 5),
      category('skills', 50, 5),
      category('system_tools', 100, 10),
    ]
    const rows = orderContextLedgerCategories(shuffled)
    expect(rows?.map((row) => row.category)).toEqual([...CONTEXT_LEDGER_CATEGORIES])
    expect(rows?.map((row) => row.tokens)).toEqual([200, 100, 50, 400, 50, 100, 100])
  })

  it('缺类/重类的账本不渲染(不用 0 冒充未占用)', () => {
    const missing = [
      category('system_prompt', 200, 20),
      category('system_tools', 100, 10),
      category('skills', 50, 5),
      category('messages', 400, 40),
      category('other', 50, 5),
      category('free_space', 200, 20),
    ]
    expect(orderContextLedgerCategories(missing)).toBeNull()
    const duplicated = [...missing, category('other', 0, 0)]
    expect(orderContextLedgerCategories(duplicated)).toBeNull()
  })

  it('恒等式:usedTokens = 前五类之和,七类总和 = contextLimit', () => {
    const ledger: ContextLedger = {
      model: 'deepseek-v4',
      contextLimit: 1000,
      usedTokens: 800,
      percentage: 80,
      categories: [
        category('system_prompt', 200, 20),
        category('system_tools', 100, 10),
        category('skills', 50, 5),
        category('messages', 400, 40),
        category('other', 50, 5),
        category('free_space', 100, 10),
        category('auto_compact', 100, 10),
      ],
      tokenizer: 'provider_usage',
      compacted: false,
      capturedAt: '2026-11-06T10:00:00.000Z',
    }
    const identity = contextLedgerIdentity(ledger)
    expect(identity).not.toBeNull()
    expect(identity?.usedTokensFromCategories).toBe(800)
    expect(identity?.accountedTokens).toBe(1000)
    expect(identity?.usedMatches).toBe(true)
    expect(identity?.balanceMatches).toBe(true)
  })

  it('恒等式对不上时如实报 false(不静默修正)', () => {
    const ledger: ContextLedger = {
      model: null,
      contextLimit: 1000,
      usedTokens: 900,
      percentage: 90,
      categories: [
        category('system_prompt', 200, 20),
        category('system_tools', 100, 10),
        category('skills', 50, 5),
        category('messages', 400, 40),
        category('other', 50, 5),
        category('free_space', 100, 10),
        category('auto_compact', 100, 10),
      ],
      tokenizer: 'heuristic',
      compacted: true,
      capturedAt: '2026-11-06T10:00:00.000Z',
    }
    const identity = contextLedgerIdentity(ledger)
    expect(identity?.usedMatches).toBe(false)
    expect(identity?.balanceMatches).toBe(true)
  })
})

describe('压缩边界摘要', () => {
  const boundary: CompactBoundary = {
    trigger: 'ratio',
    tokensBefore: 12000,
    tokensAfter: 5000,
    messagesSummarized: 10,
    durationMs: 320,
    preservedSegment: {
      head: { index: 3, role: 'user', excerpt: '压缩前保留的第一问' },
      anchor: { index: 7, role: 'assistant', excerpt: '摘要落点附近的关键答复' },
      tail: { index: 12, role: 'user', excerpt: '被压缩的末条提问' },
    },
    removedRange: { startIndex: 3, endIndex: 12 },
  }

  it('head/anchor/tail 按固定顺序输出,带下标与角色', () => {
    const lines = boundaryAnchorLines(boundary)
    expect(lines.map((line) => line.slot)).toEqual(['head', 'anchor', 'tail'])
    expect(lines.map((line) => line.index)).toEqual([3, 7, 12])
    expect(lines.map((line) => line.role)).toEqual(['user', 'assistant', 'user'])
    expect(lines[0]?.excerpt).toBe('压缩前保留的第一问')
    expect(lines[0]?.label).toBe('保留段起点 head')
  })

  it('缺席槽位不产出占位行', () => {
    const partial: CompactBoundary = {
      ...boundary,
      preservedSegment: { head: boundary.preservedSegment.head, anchor: null, tail: null },
    }
    expect(boundaryAnchorLines(partial).map((line) => line.slot)).toEqual(['head'])
  })

  it('removedRange 格式化为闭区间与条数;非法区间返回 null', () => {
    expect(formatRemovedRange(boundary.removedRange)).toBe('压缩前消息下标 3–12（共 10 条）')
    expect(formatRemovedRange(null)).toBeNull()
    expect(formatRemovedRange({ startIndex: 9, endIndex: 4 })).toBeNull()
  })
})
