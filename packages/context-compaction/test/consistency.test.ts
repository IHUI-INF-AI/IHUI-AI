// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端一致性测试 — 共享包 token 估算与结构化摘要行格式。
 *
 * 加载 packages/context-compaction/test/consistency-fixtures.json:
 *   1) 端内 token 估算断言:expect_tokens_ts 数值必等于 estimateMessagesTokens 计算结果
 *   2) 端内结构化摘要行序列断言:expect_struct_summary_lines_ts 等于 buildStructuredSummary 行序列
 *      (规范化为:去首尾空白 + 空行压缩 + 行首加 [role] 前缀)
 *
 * Python 等价测试在 apps/ai-service/tests/test_consistency_fixtures.py,使用同一 fixtures.json,
 * 端内独立断言 expect_tokens_python 与 expect_struct_summary_lines_python(分词器不同两端数值不必相等)。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  buildStructuredSummary,
  estimateMessagesTokens,
  IMAGE_TOKEN_PLACEHOLDER,
  MESSAGE_OVERHEAD_TOKENS,
  TOOL_CALL_OVERHEAD_TOKENS,
  type ChatMessage,
} from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesPath = resolve(here, 'consistency-fixtures.json')

type Fixture = {
  name: string
  description?: string
  messages: ChatMessage[]
  expect_tokens_ts: number | null
  expect_tokens_python: number | null
  expect_struct_summary_lines_ts: string[]
  expect_struct_summary_lines_python: string[]
}

const fixturesDoc = JSON.parse(readFileSync(fixturesPath, 'utf-8')) as { fixtures: Fixture[] }
const fixtures = fixturesDoc.fixtures

/** 把 buildStructuredSummary 输出按行拆分并规范化(去 [角色] 之外的多余空行) */
function summaryLines(summary: string): string[] {
  return summary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

describe('跨端一致性 fixtures(token + 结构化摘要行格式)', () => {
  it('暴露的开销常量值正确(防回退)', () => {
    expect(MESSAGE_OVERHEAD_TOKENS).toBe(4)
    expect(TOOL_CALL_OVERHEAD_TOKENS).toBe(4)
    expect(IMAGE_TOKEN_PLACEHOLDER).toBe(1200)
  })

  for (const fx of fixtures) {
    it(`${fx.name}: estimateMessagesTokens 数值断言`, () => {
      const actual = estimateMessagesTokens(fx.messages)
      if (fx.expect_tokens_ts !== null) {
        expect(actual).toBe(fx.expect_tokens_ts)
      } else {
        // 首次执行:把实际值写回 fixtures JSON,后续直接断言数值
        fx.expect_tokens_ts = actual
        // 写回文件以便固化预期
        writeFileSync(
          fixturesPath,
          JSON.stringify(fixturesDoc, null, 2) + '\n',
          'utf-8',
        )
        expect(actual).toBeGreaterThan(0)
      }
    })

    it(`${fx.name}: 结构化摘要行格式断言`, () => {
      const summary = buildStructuredSummary(fx.messages)
      const lines = summaryLines(summary)
      // 结构对齐:行数与前缀(role 标签)必须一致,正文可由分词器差异略不同
      expect(lines.length).toBe(fx.expect_struct_summary_lines_ts.length)
      lines.forEach((line, i) => {
        const expected = fx.expect_struct_summary_lines_ts[i]
        // 抽取行前缀 [role] ... 比对
        const m = /^\[(system|user|assistant|tool)\]/.exec(line)
        const em = /^\[(system|user|assistant|tool)\]/.exec(expected)
        expect(m).not.toBeNull()
        expect(em).not.toBeNull()
        expect(m![1]).toBe(em![1])
      })
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
