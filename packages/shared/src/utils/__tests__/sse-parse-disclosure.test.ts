// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// D106:小程序侧唯一帧解析器曾漏接 steer/budget/injection_applied/retry_scheduled
// (api-client 早已解析)。漏接是静默的 —— 尤其 steer 带 text,若不先分流就会被
// 兜底抽取链当成正文增量喷进回答里,那已经不是"少显示一帧"而是**显示错内容**。
import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

describe('sse-parse 交代帧承接(D106)', () => {
  it('steer 走专用分支,不喷进正文增量', () => {
    const evt = one('{"type":"steer","phase":"injected","text":"先看测试再改","messageId":"a1"}')
    expect(evt?.type).toBe('steer')
    expect(evt?.steer).toEqual({
      phase: 'injected',
      text: '先看测试再改',
      timestamp: undefined,
      messageId: 'a1',
    })
    expect(evt?.content).toBeUndefined()
  })

  it('budget 只在 level 是契约档位时产出(不凭形状造事件)', () => {
    const ok = one('{"type":"budget","level":"critical","percent":97.5,"tier":"个人版"}')
    expect(ok?.type).toBe('budget')
    expect(ok?.budget).toEqual({
      level: 'critical',
      percent: 97.5,
      usedTokens: undefined,
      limitTokens: undefined,
      tier: '个人版',
      resetAt: undefined,
    })
    expect(one('{"type":"budget","level":"whatever"}')).toBeUndefined()
  })

  it('injection_applied 无 collapsed 时不产出空行', () => {
    const ok = one(
      '{"type":"injection_applied","kind":"auto_context","collapsed":"带入了 5 段上下文","count":5}',
    )
    expect(ok?.type).toBe('injection_applied')
    expect(ok?.injectionApplied).toEqual({
      kind: 'auto_context',
      collapsed: '带入了 5 段上下文',
      count: 5,
    })
    expect(one('{"type":"injection_applied","kind":"repo_wiki"}')).toBeUndefined()
    expect(one('{"type":"injection_applied","kind":"","collapsed":"x"}')).toBeUndefined()
  })

  it('retry_scheduled 需要数值 attempt/maxRetries,retryInMs 缺省为 0', () => {
    const ok = one('{"type":"retry_scheduled","attempt":1,"maxRetries":3}')
    expect(ok?.retryScheduled).toEqual({ attempt: 1, maxRetries: 3, retryInMs: 0 })
    expect(one('{"type":"retry_scheduled","attempt":"1","maxRetries":3}')).toBeUndefined()
  })

  it('带 fullText 的注入帧把全文一并透传(端上据此决定是否显示"展开")', () => {
    const evt = one(
      '{"type":"injection_applied","kind":"developer_instructions","collapsed":"自定义指令","fullText":"第一条指令"}',
    )
    expect(evt?.injectionApplied?.fullText).toBe('第一条指令')
    expect(evt?.injectionApplied?.count).toBeUndefined()
  })

  it('compaction 帧把 trigger 透传出去(G-150:incompressible 须能被界面区分)', () => {
    const evt = one(
      '{"compaction":{"triggered":true,"tokensBefore":9000,"tokensAfter":8800,"removedCount":0,"usageRatio":0.95,"trigger":"incompressible"}}',
    )
    expect(evt?.type).toBe('compaction')
    expect(evt?.compaction?.trigger).toBe('incompressible')
    expect(evt?.compaction?.usageRatio).toBe(0.95)
  })

  it('trigger 缺失时不造字段(不给界面一个假的 llm 标签)', () => {
    const evt = one(
      '{"compaction":{"triggered":true,"tokensBefore":9000,"tokensAfter":6000,"removedCount":3,"usageRatio":0.9}}',
    )
    expect(evt?.compaction && 'trigger' in evt.compaction).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
