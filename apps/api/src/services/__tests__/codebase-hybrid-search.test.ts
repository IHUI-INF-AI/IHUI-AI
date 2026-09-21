// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  applyLexicalBoost,
  reciprocalRankFusion,
  type SearchResult,
} from '../codebase-index-service.js'

function mk(id: string, over: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    filePath: 'src/a.ts',
    lineStart: 1,
    lineEnd: 10,
    content: 'export function foo() {}',
    language: 'typescript',
    symbolName: 'foo',
    symbolType: 'function',
    score: 0.9,
    ...over,
  }
}

describe('reciprocalRankFusion', () => {
  it('空输入返回空', () => {
    expect(reciprocalRankFusion([], [], 60, 20)).toEqual([])
    expect(reciprocalRankFusion()).toEqual([])
  })

  it('单通道保持顺序,分值按 1/(k+rank) 递减', () => {
    const a = mk('x1')
    const b = mk('x2')
    const out = reciprocalRankFusion([a, b], 60, 10)
    expect(out.map((r) => r.id)).toEqual(['x1', 'x2'])
    expect(out[0]!.score).toBeCloseTo(1 / 61, 10)
    expect(out[1]!.score).toBeCloseTo(1 / 62, 10)
  })

  it('双通道同时命中 → 融合分相加,稳定排前', () => {
    const a1 = mk('hit', { filePath: 'src/auth.ts' })
    const a2 = mk('vec-only')
    const b1 = mk('kw-only')
    const b2 = mk('hit', { filePath: 'src/auth.ts' })
    const out = reciprocalRankFusion([a1, a2], [b2, b1], 60, 10)
    expect(out[0]!.id).toBe('hit')
    expect(out[0]!.score).toBeCloseTo(1 / 61 + 1 / 61, 10)
    // 单通道命中者的相对顺序保持
    expect(out.map((r) => r.id).slice(1)).toContain('vec-only')
  })

  it('按 id 去重,保留首通道对象', () => {
    const v = mk('d', { content: 'from-vector' })
    const k = mk('d', { content: 'from-keyword' })
    const out = reciprocalRankFusion([v], [k], 60, 10)
    expect(out).toHaveLength(1)
    expect(out[0]!.content).toBe('from-vector')
  })

  it('limit 截断输出', () => {
    const list = [mk('a'), mk('b'), mk('c'), mk('d')]
    const out = reciprocalRankFusion(list, 60, 2)
    expect(out).toHaveLength(2)
  })
})

describe('applyLexicalBoost', () => {
  it('symbol_name 命中查询 token → +0.05', () => {
    const r = mk('s1', { symbolName: 'getUserById' })
    const out = applyLexicalBoost([r], 'find getUserById logic')
    expect(out[0]!.score).toBeCloseTo(0.9 + 0.05, 10)
  })

  it('file_path 命中 → +0.03;两者都命中叠加', () => {
    const r = mk('s2', { symbolName: 'auth', filePath: 'src/auth/login.ts' })
    const out = applyLexicalBoost([r], 'auth')
    expect(out[0]!.score).toBeCloseTo(0.9 + 0.05 + 0.03, 10)
  })

  it('短 token(<3 字符)不触发加权', () => {
    const r = mk('s3', { symbolName: 'ab' })
    expect(applyLexicalBoost([r], 'ab')[0]!.score).toBeCloseTo(0.9, 10)
  })

  it('无命中不加权,原对象透传', () => {
    const r = mk('s4')
    const out = applyLexicalBoost([r], 'unrelated-query')
    expect(out[0]).toBe(r)
  })

  it('token 提取只含字母数字下划线', () => {
    const r = mk('s5', { symbolName: 'parse_json' })
    const out = applyLexicalBoost([r], 'parse_json, please!')
    expect(out[0]!.score).toBeCloseTo(0.95, 10)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
