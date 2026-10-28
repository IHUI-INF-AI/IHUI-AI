// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 估算面独立投影 vs 可见正文投影 —— 票 G-816015 的成对用例。
//
// 三条判据各配一条反向对照,任何一条失守都会红:
//   1. 正向对照:同一条消息挂上 reasoning ⇒ 估算必须**严格大于**只读正文的估算
//   2. 反向锁:没有 reasoning 的消息 ⇒ 估算必须与改动前(HEAD 算法逐字复刻)**逐字节相同**
//   3. 不变量:可见正文出口不得带出 reasoning(投影分离,不许"把 reasoning 并进 content")
//   4. 读不出的 reasoning 形态不得静默按 0 计(哨兵文本 ⇒ 仍然 > 只读正文)

import { describe, expect, it } from 'vitest'

import {
  IMAGE_TOKEN_PLACEHOLDER,
  MESSAGE_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  buildStructuredSummary,
  estimateMessagesTokens,
  estimateTokens,
  projectForEstimation,
  projectVisibleBody,
  summarizeMessage,
  type ChatMessage,
} from '../src/index.js'

/** 正文(可见) */
const BODY = 'Please read the file and summarize the result. '
/** 推理过程(不可见通道);与正文用不同词,避免 BPE 合并把差异抹平 */
const REASONING = 'Let me weigh each alternative before answering the user. '

/** HEAD(改动前)估算算法的逐字复刻:只累加 m.content ?? '' 与 tool_calls。
 *  反向锁拿它做参照 —— 谁顺手改了系数或基线,这条立刻红。 */
function legacyEstimate(messages: ChatMessage[]): number {
  let total = 0
  for (const m of messages) {
    total += MESSAGE_OVERHEAD_TOKENS
    total += estimateTokens(m.content ?? '')
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (!tc || typeof tc.id !== 'string') continue
        const inner =
          tc.id +
          (typeof tc.type === 'string' ? tc.type : '') +
          (tc.function && typeof tc.function.name === 'string' ? tc.function.name : '') +
          (tc.function && typeof tc.function.arguments === 'string' ? tc.function.arguments : '')
        total += estimateTokens(inner) + TOOL_CALL_OVERHEAD_TOKENS
      }
    }
    if (m.role === 'tool' && typeof m.tool_call_id === 'string' && m.tool_call_id) {
      total += TOOL_CALL_OVERHEAD_TOKENS
    }
  }
  return total
}

/** 跨端载荷形状不一,测试里故意喂非声明形态 ⇒ 只在这里收窄一次 */
function withRawReasoning(msg: ChatMessage, raw: unknown): ChatMessage {
  return { ...msg, reasoning: raw as string | null }
}

describe('estimation projection counts reasoning (positive control)', () => {
  const withReasoning: ChatMessage = { role: 'assistant', content: BODY, reasoning: REASONING }
  const withoutReasoning: ChatMessage = { role: 'assistant', content: BODY }

  it('estimate is strictly greater than the visible-body-only estimate', () => {
    const bodyOnly = MESSAGE_OVERHEAD_TOKENS + estimateTokens(projectVisibleBody(withReasoning))
    expect(estimateMessagesTokens([withReasoning])).toBeGreaterThan(bodyOnly)
  })

  it('estimation text is not the visible body text', () => {
    expect(projectForEstimation(withReasoning)).not.toBe(projectVisibleBody(withReasoning))
  })

  it('turn without a usage anchor no longer reads as the body-only number', () => {
    // 同一批消息:挂 reasoning 的那一轮必须比不挂时算得多(少算就发生在这一格)
    const anchored = estimateMessagesTokens([withoutReasoning])
    const notAnchored = estimateMessagesTokens([withReasoning])
    expect(notAnchored).toBeGreaterThan(anchored)
    // 拼接形状逐字节钉住:正文 + 换行 + 推理,没有第三条通道混进来
    expect(projectForEstimation(withReasoning)).toBe(`${BODY}\n${REASONING}`)
  })
})

describe('visible body projection stays reasoning-free (invariant)', () => {
  const msg: ChatMessage = { role: 'assistant', content: BODY, reasoning: REASONING }

  it('projectVisibleBody returns content only', () => {
    expect(projectVisibleBody(msg)).toBe(BODY)
    expect(projectVisibleBody(msg)).not.toContain(REASONING)
  })

  it('summarizeMessage does not surface reasoning', () => {
    expect(summarizeMessage(msg)).not.toContain(REASONING)
  })

  it('buildStructuredSummary does not surface reasoning', () => {
    expect(buildStructuredSummary([msg])).not.toContain(REASONING)
  })

  it('reasoning is never folded into content', () => {
    expect(msg.content).toBe(BODY)
  })
})

describe('no-reasoning messages are byte-identical to HEAD (reverse lock)', () => {
  const batch: ChatMessage[] = [
    { role: 'system', content: 'You are a careful coding agent.' },
    { role: 'user', content: 'Run the tests and report failures.' },
    {
      role: 'assistant',
      content: 'Calling the checker now.',
      tool_calls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: { name: 'bash', arguments: '{"command":"pnpm test","timeout":60000}' },
        },
      ],
    },
    { role: 'tool', content: '24 tests passed, 0 failed.', tool_call_id: 'call_abc123' },
    { role: 'assistant', content: '' },
    {
      role: 'user',
      content: 'look: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    },
  ]

  it('matches the pre-change algorithm exactly', () => {
    expect(estimateMessagesTokens(batch)).toBe(legacyEstimate(batch))
  })

  it('each single message matches the pre-change algorithm exactly', () => {
    for (const m of batch) {
      expect(estimateMessagesTokens([m])).toBe(legacyEstimate([m]))
    }
  })

  it('null reasoning counts as absent, not as extra text', () => {
    const msg: ChatMessage = { role: 'assistant', content: BODY, reasoning: null }
    expect(estimateMessagesTokens([msg])).toBe(legacyEstimate([msg]))
    expect(projectForEstimation(msg)).toBe(BODY)
  })

  it('image placeholder behaviour is unchanged', () => {
    const img: ChatMessage = {
      role: 'user',
      content: 'x data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB y',
    }
    expect(estimateMessagesTokens([img]) - MESSAGE_OVERHEAD_TOKENS).toBeGreaterThanOrEqual(
      IMAGE_TOKEN_PLACEHOLDER,
    )
    expect(estimateMessagesTokens([img])).toBe(legacyEstimate([img]))
    expect(TOOL_CALL_OVERHEAD_TOKENS).toBe(4)
  })
})

describe('unreadable reasoning shapes are never silently zero', () => {
  const base: ChatMessage = { role: 'assistant', content: BODY }

  it('text block array is counted', () => {
    const blocks = withRawReasoning(base, [{ type: 'text', text: REASONING }])
    expect(estimateMessagesTokens([blocks])).toBeGreaterThan(estimateMessagesTokens([base]))
  })

  it('object with a thinking field is counted', () => {
    const boxed = withRawReasoning(base, { thinking: REASONING })
    expect(estimateMessagesTokens([boxed])).toBeGreaterThan(estimateMessagesTokens([base]))
  })

  it('opaque object shape is counted via its serialized form', () => {
    const opaque = withRawReasoning(base, { nested: { deep: 1 }, signature: 'zz' })
    expect(estimateMessagesTokens([opaque])).toBeGreaterThan(estimateMessagesTokens([base]))
  })

  it('self-referential reasoning is counted, not dropped', () => {
    const circular: Record<string, unknown> = {}
    circular['self'] = circular
    const looped = withRawReasoning(base, circular)
    expect(estimateMessagesTokens([looped])).toBeGreaterThan(estimateMessagesTokens([base]))
  })

  it('function-valued reasoning is counted, not dropped', () => {
    const fn = withRawReasoning(base, () => REASONING)
    expect(estimateMessagesTokens([fn])).toBeGreaterThan(estimateMessagesTokens([base]))
  })

  it('empty block list is honestly zero extra (present and readable as nothing)', () => {
    const empty = withRawReasoning(base, [])
    expect(estimateMessagesTokens([empty])).toBe(legacyEstimate([empty]))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
