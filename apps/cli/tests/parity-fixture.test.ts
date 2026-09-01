// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TS/Python 跨端 parity 快照测试(TS 消费端)。
 *
 * 消费共享 fixture packages/context-compaction/tests/fixtures/parity.json,
 * 对 @ihui/context-compaction 的 compressContextIfNeeded 断言全部 expectations,
 * 与 apps/ai-service/tests/test_context_parity.py 锁死两端语义一致。
 *
 * fixture 的 expectations 由 TS 端真实输出人工核算(见 fixture._comment),
 * input 远离阈值边界:走 kr=6 规则摘要路径,不触发 truncated/incompressible 降级。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  compressContextIfNeeded,
  SUMMARY_MARKER,
  type ChatMessage,
} from '@ihui/context-compaction'

// 相对定位 fixture:apps/cli/tests → 仓库根 → packages/context-compaction/tests/fixtures
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/context-compaction/tests/fixtures/parity.json',
)

interface ParityFixture {
  _comment: string
  input: {
    messages: ChatMessage[]
    options: { contextLimit: number; keepRecent: number }
  }
  expectations: {
    outputRoleSequence: string[]
    summaryMarkerLine: string
    summaryBodyLineCount: number
    noOrphanToolMessages: boolean
    recentTierCount: number
    recentTierFirst200CharsPresent: boolean
    coveredCountTotal: number
  }
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as ParityFixture

/** 从压缩结果中定位摘要消息(role='user' 且 content 以 SUMMARY_MARKER 开头) */
function findSummaryMsg(messages: ChatMessage[]): ChatMessage {
  const msg = messages.find(
    (m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith(SUMMARY_MARKER),
  )
  if (!msg || typeof msg.content !== 'string') {
    throw new Error('压缩结果中未找到摘要消息')
  }
  return msg
}

describe('parity fixture(TS 端)', () => {
  it('加载 fixture 文件且结构完整', () => {
    expect(fixture.input.messages.length).toBeGreaterThan(0)
    expect(fixture.input.options.contextLimit).toBe(32000)
    expect(fixture.input.options.keepRecent).toBe(6)
    expect(Object.keys(fixture.expectations)).toHaveLength(7)
  })

  it('触发压缩且走 ratio 规则摘要路径(非降级)', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    expect(result.compressed).toBe(true)
    expect(result.trigger).toBe('ratio')
  })

  it('outputRoleSequence: system + 摘要(user) + 近端 6 条', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    expect(result.messages.map((m) => m.role)).toEqual(fixture.expectations.outputRoleSequence)
  })

  it('summaryMarkerLine: 标记行与 expectations 逐字节一致', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const content = findSummaryMsg(result.messages).content as string
    const newlineIdx = content.indexOf('\n')
    expect(content.slice(0, newlineIdx)).toBe(fixture.expectations.summaryMarkerLine)
  })

  it('summaryBodyLineCount: 摘要正文行数一致', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const content = findSummaryMsg(result.messages).content as string
    const body = content.slice(content.indexOf('\n') + 1)
    expect(body.split('\n')).toHaveLength(fixture.expectations.summaryBodyLineCount)
  })

  it('noOrphanToolMessages: 输出无孤 tool 消息(每个 tool 都有前置匹配的 tool_calls)', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const declaredIds = new Set<string>()
    let noOrphan = true
    for (const m of result.messages) {
      if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          if (tc && typeof tc.id === 'string') declaredIds.add(tc.id)
        }
      } else if (m.role === 'tool') {
        if (typeof m.tool_call_id !== 'string' || !declaredIds.has(m.tool_call_id)) {
          noOrphan = false
        }
      }
    }
    expect(noOrphan).toBe(fixture.expectations.noOrphanToolMessages)
  })

  it('recentTierCount: 近层直截行数(以 … 结尾)一致', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const content = findSummaryMsg(result.messages).content as string
    const body = content.slice(content.indexOf('\n') + 1)
    const recentLines = body.split('\n').filter((l) => l.endsWith('…'))
    expect(recentLines).toHaveLength(fixture.expectations.recentTierCount)
  })

  it('recentTierFirst200CharsPresent: 近层各消息前 200 chars 在摘要正文中', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const content = findSummaryMsg(result.messages).content as string
    const body = content.slice(content.indexOf('\n') + 1)
    const exp = fixture.expectations
    // 被压缩区 = non-system 前 coveredCountTotal 条(尾部 keepRecent 条保留)
    const nonSystem = fixture.input.messages.filter((m) => m.role !== 'system')
    const toCompress = nonSystem.slice(0, nonSystem.length - fixture.input.options.keepRecent)
    const recentTierSize = Math.max(1, Math.ceil(exp.coveredCountTotal * 0.3))
    const recentTier = toCompress.slice(-recentTierSize)
    const allPresent = recentTier.every(
      (m) => typeof m.content !== 'string' || m.content.length === 0 || body.includes(m.content.slice(0, 200)),
    )
    expect(allPresent).toBe(exp.recentTierFirst200CharsPresent)
  })

  it('coveredCountTotal: 标记行覆盖条数一致', () => {
    const result = compressContextIfNeeded(fixture.input.messages, fixture.input.options)
    const content = findSummaryMsg(result.messages).content as string
    const m = /之前 (\d+) 条消息已压缩/.exec(content)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(fixture.expectations.coveredCountTotal)
  })
})
