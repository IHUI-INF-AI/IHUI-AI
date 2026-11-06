// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍‌​​‌​​‌‍‍‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌​‌‌​​​​‌​​‌‌‌‌‍‍​‌​​‌​​​‍‍‌‌‌‌‌‌​‍‍‌​‌​​​‌‍‍‌​‌‌‌‌‌‌‌​‌‌‌‍‍​‌‌‌‌‌‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌‌​‌‌‍‌‍‌​‍‍​‌​​​​‌‍‍​‌‌‌‌‌‌​‌​‌‍‍‌​​‌‌​‌‍⁠

import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CONTEXT_LEDGER_CATEGORIES, type ContextLedgerCategoryUsage } from '@ihui/shared'
import { ContextLedgerBreakdown } from '../context-ledger-panel'
import type { ContextLedgerRecord } from '@/hooks/use-chat/context-ledger'

afterEach(() => {
  cleanup()
})

/** 刻意打乱 categories 的输入顺序：组件必须按 CONTEXT_LEDGER_CATEGORIES 固定顺序渲染。 */
const shuffledCategories: ContextLedgerCategoryUsage[] = [
  { category: 'messages', tokens: 3000, percent: 30 },
  { category: 'auto_compact', tokens: 500, percent: 5 },
  { category: 'system_prompt', tokens: 2000, percent: 20 },
  { category: 'free_space', tokens: 2500, percent: 25 },
  { category: 'system_tools', tokens: 1000, percent: 10 },
  { category: 'other', tokens: 500, percent: 5 },
  { category: 'skills', tokens: 500, percent: 5 },
]

const ledger: ContextLedgerRecord = {
  id: 'ledger-1',
  conversationId: 'conv-1',
  messageId: 'msg-1',
  turnIndex: 7,
  model: 'gpt-test',
  contextLimit: 10000,
  usedTokens: 7000,
  percentage: 70,
  categories: shuffledCategories,
  tokenizer: 'heuristic',
  compacted: true,
  capturedAt: '2026-11-06T10:00:00.000Z',
  createdAt: '2026-11-06T10:00:01.000Z',
}

describe('七类上下文账本展示（批次 3）', () => {
  it('固定顺序渲染 7 行，且逐类 token 之和满足 已用+剩余+预留=上限', () => {
    const { container } = render(<ContextLedgerBreakdown ledger={ledger} />)
    const rows = Array.from(container.querySelectorAll('[data-category]'))
    expect(rows).toHaveLength(7)
    expect(rows.map((row) => row.getAttribute('data-category'))).toEqual([
      ...CONTEXT_LEDGER_CATEGORIES,
    ])
    const sum = rows.reduce((acc, row) => acc + Number(row.getAttribute('data-token') ?? 0), 0)
    expect(sum).toBe(ledger.contextLimit)
    expect(ledger.usedTokens + 2500 + 500).toBe(ledger.contextLimit)
  })

  it('标注轮次、模型与 tokenizer 口径，并展示服务端已算好的百分比', () => {
    render(<ContextLedgerBreakdown ledger={ledger} />)
    expect(screen.getByTestId('context-ledger-round').textContent).toContain('第 7 轮')
    expect(screen.getByTestId('context-ledger-tokenizer').textContent).toContain('本地估算')
    expect(screen.getByTestId('context-ledger').textContent).toContain('70%')
  })

  it('剩余空间用中性色（不与占用类同色系）', () => {
    const { container } = render(<ContextLedgerBreakdown ledger={ledger} />)
    const freeRow = container.querySelector('[data-category="free_space"]')
    expect(freeRow).not.toBeNull()
    expect(freeRow?.querySelector('.bg-muted-foreground\\/40')).not.toBeNull()
  })

  it('身份等式把三类数字如实摊开（不把 free_space 混进已用）', () => {
    render(<ContextLedgerBreakdown ledger={ledger} />)
    const identity = screen.getByTestId('context-ledger-identity').textContent ?? ''
    expect(identity).toContain('已用')
    expect(identity).toContain('剩余')
    expect(identity).toContain('预留')
    expect(identity).toContain('上限')
  })
})
