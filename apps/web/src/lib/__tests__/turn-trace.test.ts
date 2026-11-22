// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { buildTurnTraceRows, readTurnUsage } from '../turn-trace'

describe('readTurnUsage', () => {
  it('读 camelCase', () => {
    expect(readTurnUsage({ usage: { promptTokens: 10, completionTokens: 5 } })).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })
  })

  it('读 snake_case 并优先 total', () => {
    expect(
      readTurnUsage({ usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 12 } }),
    ).toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 12 })
  })

  it('缺失时全 0,不估算', () => {
    expect(readTurnUsage(undefined)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    })
  })
})

describe('buildTurnTraceRows', () => {
  it('无显式序号时按 user 消息开新轮', () => {
    const summary = buildTurnTraceRows([
      { role: 'user', content: '第一个问题' },
      {
        role: 'assistant',
        content: '回答',
        model: 'm1',
        durationMs: 1200,
        meta: { usage: { promptTokens: 100, completionTokens: 40 } },
        toolCalls: [{ id: 't1' }, { id: 't2' }],
      },
      { role: 'user', content: '第二个问题' },
      { role: 'assistant', content: '回答2', model: 'm2', durationMs: 800 },
    ])
    expect(summary.rows).toHaveLength(2)
    expect(summary.rows[0]).toMatchObject({
      ordinal: 1,
      label: '第一个问题',
      model: 'm1',
      durationMs: 1200,
      toolCalls: 2,
      status: 'ok',
    })
    expect(summary.rows[0]!.usage.totalTokens).toBe(140)
    expect(summary.rows[1]).toMatchObject({ ordinal: 2, model: 'm2', toolCalls: 0 })
    expect(summary.totals).toMatchObject({
      turns: 2,
      durationMs: 2000,
      toolCalls: 2,
    })
    expect(summary.totals.usage.totalTokens).toBe(140)
  })

  it('历史行带 turnOrdinal 时同轮不因 assistant 拆行', () => {
    const summary = buildTurnTraceRows([
      { role: 'user', content: '问题', turnOrdinal: 3 },
      { role: 'assistant', content: 'a', turnOrdinal: 3 },
      { role: 'assistant', content: 'b', turnOrdinal: 3 },
      { role: 'user', content: '追问', turnOrdinal: 4 },
      { role: 'assistant', content: 'c', turnOrdinal: 4 },
    ])
    expect(summary.rows.map((row) => row.ordinal)).toEqual([3, 4])
    expect(summary.rows[0]!.label).toBe('问题')
    expect(summary.rows[1]!.label).toBe('追问')
  })

  it('user 行缺序号、assistant 行有时采纳 assistant 的序号', () => {
    const summary = buildTurnTraceRows([
      { role: 'user', content: '问题' },
      { role: 'assistant', content: 'a', turnOrdinal: 5 },
    ])
    expect(summary.rows).toHaveLength(1)
    expect(summary.rows[0]!.ordinal).toBe(5)
  })

  it('assistant 出错时该轮标记 error,且不影响其他轮', () => {
    const summary = buildTurnTraceRows([
      { role: 'user', content: '问题一' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: '问题二' },
      { role: 'assistant', content: '', error: true },
    ])
    expect(summary.rows[0]!.status).toBe('ok')
    expect(summary.rows[1]!.status).toBe('error')
  })

  it('非法输入被跳过,不产生空行', () => {
    const summary = buildTurnTraceRows([
      { role: 'system', content: '系统提示' },
      { role: 'user', content: '  多   空格   问题  ' },
    ])
    expect(summary.rows).toHaveLength(1)
    expect(summary.rows[0]!.label).toBe('多 空格 问题')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
