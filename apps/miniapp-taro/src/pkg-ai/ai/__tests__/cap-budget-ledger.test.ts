// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 批次 3(2026-11-06):预算硬停止 / 七类上下文账本 / 压缩边界的端内纯函数用例。
// 端内 vitest 是 node 环境(无 jsdom),故钉三层:
//  ① 停止原因码只认 shared 唯一出口(六码穷举 + 未知码通用句),端内不得另写一份映射;
//  ② 账本/边界的严格形状与固定顺序(缺类、重复类、残缺锚点一律不认);
//  ③ 展示格式化(百分比裁剪走 shared 出口、顺序、区间文案)。
import { describe, expect, it } from 'vitest'

import { BUDGET_STOP_REASON_CODES, type CompactBoundary, type ContextLedger } from '@ihui/shared'
import {
  BUDGET_STOP_FALLBACK_TEXT,
  budgetStopReasonText,
  budgetStopReasonTexts,
} from '@ihui/shared/chat/budget-stop-note'
import {
  applyBudgetStopEvent,
  parseBudgetStopData,
  parseCompactBoundary,
  parseCompactionBoundaryLine,
  parseContextLedger,
  parseContextLedgerRow,
  parseUsageContextLedgerLine,
} from '@/lib/chat-budget-ledger-frames'
import {
  boundarySegmentViews,
  buildLedgerRows,
  describeBudgetStopMeta,
  formatBoundaryRange,
  formatLedgerPercent,
  formatPercentValue,
  tokenizerText,
} from '../chat-cap-text'

/** 七类按契约固定顺序。 */
const CATEGORY_ORDER = [
  'system_prompt',
  'system_tools',
  'skills',
  'messages',
  'other',
  'free_space',
  'auto_compact',
] as const

function ledgerFixture(overrides: Partial<ContextLedger> = {}): ContextLedger {
  return {
    model: 'gpt-4.1',
    contextLimit: 128_000,
    usedTokens: 64_000,
    percentage: 50,
    categories:
      overrides.categories ??
      CATEGORY_ORDER.map((category, i) => ({
        category,
        tokens: 1_000 * (i + 1),
        percent: 1.25 * (i + 1),
      })),
    tokenizer: 'provider_usage',
    compacted: false,
    capturedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  }
}

function boundaryFixture(overrides: Partial<CompactBoundary> = {}): CompactBoundary {
  return {
    trigger: 'auto',
    tokensBefore: 120_000,
    tokensAfter: 40_000,
    messagesSummarized: 18,
    durationMs: 1_200,
    preservedSegment: {
      head: { index: 0, role: 'system', excerpt: '系统提示词开头' },
      anchor: { index: 9, role: 'assistant', excerpt: '上一轮摘要锚点' },
      tail: { index: 42, role: 'user', excerpt: '最近一条用户消息' },
    },
    removedRange: { startIndex: 3, endIndex: 30 },
    ...overrides,
  }
}

describe('预算停止原因码 — 唯一出口在 shared', () => {
  it('封闭集六码全部有独立文案,且都不回落通用句', () => {
    expect(BUDGET_STOP_REASON_CODES).toHaveLength(6)
    const texts = budgetStopReasonTexts()
    expect(texts).toHaveLength(6)
    expect(new Set(texts).size).toBe(6)
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toBe(BUDGET_STOP_FALLBACK_TEXT)
    }
  })

  it('每码逐个映射到自己的文案(顺带证明不是六份复制粘贴)', () => {
    const perCode = BUDGET_STOP_REASON_CODES.map((code) => budgetStopReasonText(code))
    expect(perCode).toEqual(budgetStopReasonTexts())
  })

  it('未知码与缺失码都落通用句,不猜具体原因', () => {
    expect(budgetStopReasonText('future_code_2099')).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(null)).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(undefined)).toBe(BUDGET_STOP_FALLBACK_TEXT)
  })
})

describe('parseBudgetStopData — stopped 终态/字段三态', () => {
  it('流内 stopped 帧认领原因码与用量字段(0 是有效读数,不折 null)', () => {
    const stop = parseBudgetStopData(
      {
        level: 'stopped',
        reasonCode: 'daily_token_limit',
        scope: 'daily',
        pillar: 'reasoning',
        usagePercent: 104.5,
        remainingTokens: 0,
        stoppedAtIteration: 3,
      },
      true,
    )
    expect(stop).not.toBeNull()
    expect(stop?.reasonCode).toBe('daily_token_limit')
    expect(stop?.scope).toBe('daily')
    expect(stop?.pillar).toBe('reasoning')
    expect(stop?.usagePercent).toBe(104.5)
    expect(stop?.remainingTokens).toBe(0)
    expect(stop?.stoppedAtIteration).toBe(3)
  })

  it('warning 帧不满足 requireStopped ⇒ 不认(终态语义只在 stopped)', () => {
    expect(parseBudgetStopData({ level: 'warning', percent: 80 }, true)).toBeNull()
  })

  it('查询落库行没有 level:requireStopped=false 时兼容 snake_case 字段', () => {
    const stop = parseBudgetStopData(
      {
        reason_code: 'provider_budget_exhausted',
        scope: 'provider',
        usage_percent: 87,
        remaining_tokens: 12,
        stopped_at_iteration: 2,
        created_at: '2026-11-06T10:00:00.000Z',
      },
      false,
    )
    expect(stop?.reasonCode).toBe('provider_budget_exhausted')
    expect(stop?.usagePercent).toBe(87)
    expect(stop?.remainingTokens).toBe(12)
    expect(stop?.stoppedAtIteration).toBe(2)
    expect(stop?.stoppedAt).toBe('2026-11-06T10:00:00.000Z')
  })

  it('未知原因码原样保留(交给 shared 回落通用句),非法数值该维读 null', () => {
    const stop = parseBudgetStopData(
      {
        level: 'stopped',
        reasonCode: 'future_code_2099',
        usagePercent: -1,
        remainingTokens: 'nope',
        stoppedAtIteration: Number.NaN,
      },
      true,
    )
    expect(stop?.reasonCode).toBe('future_code_2099')
    expect(stop?.usagePercent).toBeNull()
    expect(stop?.remainingTokens).toBeNull()
    expect(stop?.stoppedAtIteration).toBeNull()
    expect(budgetStopReasonText(stop?.reasonCode)).toBe(BUDGET_STOP_FALLBACK_TEXT)
  })

  it('非法作用域不冒充某个真实档', () => {
    const stop = parseBudgetStopData(
      { level: 'stopped', scope: 'galaxy', reasonCode: 'daily_token_limit' },
      true,
    )
    expect(stop?.scope).toBeNull()
  })

  it('终态不可被后续 warning 覆盖(applyBudgetStopEvent 是唯一更新入口)', () => {
    const stopped = applyBudgetStopEvent(null, {
      level: 'stopped',
      reasonCode: 'daily_token_limit',
      stoppedAtIteration: 4,
    })
    expect(stopped?.reasonCode).toBe('daily_token_limit')
    expect(applyBudgetStopEvent(stopped, { level: 'warning', percent: 80 })).toEqual(stopped)
    expect(applyBudgetStopEvent(stopped, { level: 'critical', percent: 96 })).toEqual(stopped)
    // 同一会话里若又来一条 stopped(例如服务端补发最新落库行),允许刷新为最新终态
    const latest = applyBudgetStopEvent(stopped, {
      level: 'stopped',
      reasonCode: 'provider_budget_exhausted',
    })
    expect(latest?.reasonCode).toBe('provider_budget_exhausted')
  })
})

describe('parseContextLedger — 七类严格形状 + 固定顺序', () => {
  it('乱序输入按 CONTEXT_LEDGER_CATEGORIES 重排后再上屏', () => {
    const shuffled = [...CATEGORY_ORDER].reverse().map((category, i) => ({
      category,
      tokens: 100 + i,
      percent: 1 + i,
    }))
    const ledger = parseContextLedger(ledgerFixture({ categories: shuffled }))
    expect(ledger).not.toBeNull()
    expect(ledger?.categories.map((x) => x.category)).toEqual([...CATEGORY_ORDER])
  })

  it('缺一类(6 条)整帧不认 —— 不把缺口猜成 0', () => {
    const six = CATEGORY_ORDER.slice(0, 6).map((category) => ({
      category,
      tokens: 1,
      percent: 0,
    }))
    expect(parseContextLedger(ledgerFixture({ categories: six }))).toBeNull()
  })

  it('重复类(7 条但有一类重复)整帧不认', () => {
    const dup = CATEGORY_ORDER.map((category) => ({ category, tokens: 1, percent: 0 }))
    dup[6] = { category: 'free_space', tokens: 1, percent: 0 }
    expect(parseContextLedger(ledgerFixture({ categories: dup }))).toBeNull()
  })

  it('封闭集外的类别整帧不认', () => {
    const bad = CATEGORY_ORDER.map((category) => ({ category, tokens: 1, percent: 0 }))
    // 用未知类别替换最后一类
    const unknownCategory = { category: 'mystery', tokens: 1, percent: 0 }
    expect(
      parseContextLedger(
        ledgerFixture({
          categories: [
            ...bad.slice(0, 6),
            unknownCategory,
          ] as unknown as ContextLedger['categories'],
        }),
      ),
    ).toBeNull()
  })

  it('contextLimit=0(窗口未知)是合法账本,不因非正数整条丢弃', () => {
    const zeroLimit = ledgerFixture({
      contextLimit: 0,
      usedTokens: 0,
      percentage: 0,
      categories: CATEGORY_ORDER.map((category) => ({ category, tokens: 0, percent: 0 })),
    })
    expect(parseContextLedger(zeroLimit)?.contextLimit).toBe(0)
  })

  it('tokenizer 只认 provider_usage / heuristic', () => {
    expect(
      parseContextLedger(
        ledgerFixture({ tokenizer: 'magic' as unknown as ContextLedger['tokenizer'] }),
      ),
    ).toBeNull()
  })

  it('合法帧保留三态读数与 capturedAt/model', () => {
    const ledger = parseContextLedger(ledgerFixture())
    expect(ledger?.contextLimit).toBe(128_000)
    expect(ledger?.usedTokens).toBe(64_000)
    expect(ledger?.percentage).toBe(50)
    expect(ledger?.capturedAt).toBe('2026-11-06T10:00:00.000Z')
    expect(ledger?.model).toBe('gpt-4.1')
  })

  it('原始 SSE 行旁路只认 usage 帧的 contextLedger', () => {
    const line = `data: ${JSON.stringify({ type: 'usage', contextLedger: ledgerFixture() })}`
    expect(parseUsageContextLedgerLine(line)?.usedTokens).toBe(64_000)
    expect(parseUsageContextLedgerLine(`data: ${JSON.stringify({ type: 'done' })}`)).toBeNull()
    expect(parseUsageContextLedgerLine('event: usage')).toBeNull()
  })

  it('查询行沿库表列名回放 createdAt/turnIndex —— 不能因字段别名把账本整条丢掉', () => {
    const raw = {
      ...ledgerFixture(),
      capturedAt: undefined,
      createdAt: '2026-11-06T10:05:00.000Z',
      turnIndex: 7,
    }
    const entry = parseContextLedgerRow(raw)
    expect(entry).not.toBeNull()
    expect(entry?.ledger.capturedAt).toBe('2026-11-06T10:05:00.000Z')
    expect(entry?.turnIndex).toBe(7)
  })

  it('查询行 turnIndex 缺失/非法时视为未知,但账本本身仍可用', () => {
    const entry = parseContextLedgerRow({ ...ledgerFixture(), turnIndex: -1 })
    expect(entry?.ledger.usedTokens).toBe(64_000)
    expect(entry?.turnIndex).toBeNull()
  })
})

describe('parseCompactBoundary — 保留段/折叠区间', () => {
  it('合法边界完整认领 head/anchor/tail 与 removedRange', () => {
    const boundary = parseCompactBoundary(boundaryFixture())
    expect(boundary?.messagesSummarized).toBe(18)
    expect(boundary?.preservedSegment.head?.index).toBe(0)
    expect(boundary?.preservedSegment.anchor?.excerpt).toBe('上一轮摘要锚点')
    expect(boundary?.removedRange).toEqual({ startIndex: 3, endIndex: 30 })
  })

  it('锚点允许 null;结构缺失(anchor 既非 null 又非对象)整帧不认', () => {
    const noAnchor = boundaryFixture({
      preservedSegment: {
        head: { index: 0, role: 'system', excerpt: '头部' },
        anchor: null,
        tail: null,
      },
    })
    expect(parseCompactBoundary(noAnchor)?.preservedSegment.anchor).toBeNull()
    expect(
      parseCompactBoundary(
        boundaryFixture({
          preservedSegment: {
            head: { index: 0, role: 'system', excerpt: '头部' },
            anchor: 'broken' as unknown as CompactBoundary['preservedSegment']['anchor'],
            tail: null,
          },
        }),
      ),
    ).toBeNull()
  })

  it('removedRange 起止倒挂/负数整帧不认', () => {
    expect(
      parseCompactBoundary(boundaryFixture({ removedRange: { startIndex: 9, endIndex: 2 } })),
    ).toBeNull()
    expect(
      parseCompactBoundary(boundaryFixture({ removedRange: { startIndex: -1, endIndex: 2 } })),
    ).toBeNull()
  })

  it('原始 SSE 行:兼容 compaction 嵌套与平铺两种线形', () => {
    const nested = `data: ${JSON.stringify({
      type: 'compaction',
      compaction: { triggered: true, boundary: boundaryFixture() },
    })}`
    expect(parseCompactionBoundaryLine(nested)?.tokensBefore).toBe(120_000)
    const flat = `data: ${JSON.stringify({ type: 'compaction', boundary: boundaryFixture() })}`
    expect(parseCompactionBoundaryLine(flat)?.tokensAfter).toBe(40_000)
    expect(parseCompactionBoundaryLine('data: {"type":"usage"}')).toBeNull()
  })
})

describe('展示格式化 — 顺序/百分比/附注/区间', () => {
  it('buildLedgerRows 固定顺序且不丢类', () => {
    const ledger = ledgerFixture()
    const rows = buildLedgerRows(ledger)
    expect(rows.map((x) => x.category)).toEqual([...CATEGORY_ORDER])
  })

  it('formatLedgerPercent 走 shared clampPercent(120→100%,-4→0%)', () => {
    expect(formatLedgerPercent(120)).toBe('100%')
    expect(formatLedgerPercent(-4)).toBe('0%')
    expect(formatLedgerPercent(12.34)).toBe('12.3%')
  })

  it('formatPercentValue 整数不带 .0', () => {
    expect(formatPercentValue(100)).toBe('100')
    expect(formatPercentValue(12)).toBe('12')
    expect(formatPercentValue(33.333)).toBe('33.3')
    expect(formatPercentValue(104.5)).toBe('104.5')
  })

  it('describeBudgetStopMeta 顺序固定且 0 剩余照实显示', () => {
    const stop = parseBudgetStopData(
      {
        level: 'stopped',
        reasonCode: 'daily_token_limit',
        scope: 'daily',
        pillar: 'reasoning',
        usagePercent: 104.5,
        remainingTokens: 0,
        stoppedAtIteration: 3,
      },
      true,
    )
    expect(stop).not.toBeNull()
    expect(describeBudgetStopMeta(stop!)).toBe(
      '第 3 轮 · 按日额度·reasoning · 用量 104.5% · 剩余 0 token',
    )
  })

  it('无任何附注时返回空串(不渲染占位破折号)', () => {
    const stop = parseBudgetStopData({ level: 'stopped', reasonCode: 'daily_token_limit' }, true)
    expect(describeBudgetStopMeta(stop!)).toBe('')
  })

  it('boundarySegmentViews 固定 head→anchor→tail,空锚点不占行', () => {
    const full = boundarySegmentViews(boundaryFixture())
    expect(full.map((x) => x.slot)).toEqual(['head', 'anchor', 'tail'])
    const partial = boundarySegmentViews(
      boundaryFixture({
        preservedSegment: {
          head: null,
          anchor: { index: 9, role: 'assistant', excerpt: '锚点' },
          tail: { index: 42, role: 'user', excerpt: '尾部' },
        },
      }),
    )
    expect(partial.map((x) => x.slot)).toEqual(['anchor', 'tail'])
  })

  it('formatBoundaryRange 有区间才出文案', () => {
    expect(formatBoundaryRange(boundaryFixture())).toBe('#3 – #30')
    expect(formatBoundaryRange(boundaryFixture({ removedRange: null }))).toBeNull()
  })

  it('tokenizerText 两档口径', () => {
    expect(tokenizerText('provider_usage')).toBe('上游 usage')
    expect(tokenizerText('heuristic')).toBe('本地估算')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
