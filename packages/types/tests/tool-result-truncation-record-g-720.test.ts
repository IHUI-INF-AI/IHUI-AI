// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-720 · 「被截断」的类型化账目(2026-10-01 立)。
 *
 * 钉住的三型,全部指向同一件事:**结论不得由被截的那一方宣布,算不出的账不得冒充结论**。
 *  ① 缺席语义 —— 未截时 `truncated` 整块缺席,绝不产出 `false` 噪音(上游那档
 *     `z.literal(true).optional()` 的等价形状);
 *  ② 推导性 —— `truncated` 由两条字节数的大小关系得出,caller 自述的 true/false 一律不算数;
 *  ③ 拒算 —— 自相矛盾或形状不对的事实返回 null,而不是"就近取一个能编译的值"。
 *
 * 每条正向断言都配一条"喂坏形态必红"的对照:只断言当前好形态通过,等于给空转的尺子发合格证。
 */
import { describe, expect, it } from 'vitest'

import {
  TOOL_RESULT_POLICIES,
  buildToolResultTruncationRecord,
} from '../src/tool-contract'

import type { ToolResultTruncationRecord } from '../src/tool-contract'

function facts(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { originalBytes: 1000, returnedBytes: 400, budgetStrategy: 'truncate', ...over }
}

describe('G-720 · truncated 的缺席语义(不产 false 噪音)', () => {
  it('returnedBytes < originalBytes ⇒ truncated 为 true', () => {
    const r = buildToolResultTruncationRecord(facts())
    expect(r).not.toBeNull()
    expect(r!.truncated).toBe(true)
    expect(r!.originalBytes).toBe(1000)
    expect(r!.returnedBytes).toBe(400)
    expect(r!.budgetStrategy).toBe('truncate')
  })

  it('returnedBytes == originalBytes ⇒ truncated 整块缺席(键不存在,不是 false)', () => {
    const r = buildToolResultTruncationRecord(facts({ returnedBytes: 1000 }))
    expect(r).not.toBeNull()
    expect('truncated' in r!).toBe(false)
    // 反向对照:把"缺席"读成"已判为未截"的那一档 —— 值必须是 undefined 且不得是布尔 false
    expect(r!.truncated).toBeUndefined()
  })

  it('caller 自述 truncated:false 也不能把它写进账目', () => {
    const r = buildToolResultTruncationRecord(facts({ returnedBytes: 1000, truncated: false }))
    expect(r).not.toBeNull()
    expect('truncated' in r!).toBe(false)
  })

  it('caller 谎报 truncated:true 而两数相等 ⇒ 推导否决谎报(结论只从量来)', () => {
    const r = buildToolResultTruncationRecord(facts({ returnedBytes: 1000, truncated: true }))
    expect(r).not.toBeNull()
    expect('truncated' in r!).toBe(false)
  })
})

describe('G-720 · 算不出的账一律返回 null(拒绝而非就近取值)', () => {
  const badCases: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['returnedBytes 大于 originalBytes(两条事实至少一条是编的)', facts({ returnedBytes: 1001 })],
    ['originalBytes 为负', facts({ originalBytes: -1 })],
    ['字节数是小数', facts({ originalBytes: 10.5 })],
    ['字节数是 NaN', facts({ originalBytes: Number.NaN })],
    ['字节数是 Infinity', facts({ originalBytes: Number.POSITIVE_INFINITY })],
    ['字节数不是超过 2^53 的安全整数', facts({ originalBytes: Number.MAX_SAFE_INTEGER + 10 })],
    ['缺少 returnedBytes', { originalBytes: 10, budgetStrategy: 'truncate' }],
    ['策略不在值域上', facts({ budgetStrategy: 'silently-drop' })],
    ['策略不是字符串', facts({ budgetStrategy: 2 })],
    ['artifact 档给不出路径', facts({ budgetStrategy: 'artifact' })],
    ['artifact 路径是空串', facts({ budgetStrategy: 'artifact', artifactPath: '' })],
    ['非 artifact 档却带着路径(两枚事实塞进一枚记录)', facts({ artifactPath: '/tmp/x' })],
    ['形状完全不相干的对象(没有任何一枚字节数)', { notFacts: true }],
  ]

  for (const [why, input] of badCases) {
    it(`null:${why}`, () => {
      expect(buildToolResultTruncationRecord(input)).toBeNull()
    })
  }

  it('null / 非对象输入不得抛错(边界不得因为一条坏事实把整次工具调用炸掉)', () => {
    for (const input of [null, undefined, 42, 'truncate', []]) {
      expect(buildToolResultTruncationRecord(input)).toBeNull()
    }
  })
})

describe('G-720 · artifact 档与形状不变量', () => {
  it('artifact + 路径 ⇒ 账目带 artifactPath', () => {
    const r = buildToolResultTruncationRecord(facts({ budgetStrategy: 'artifact', artifactPath: 'artifacts/42.txt' }))
    expect(r).not.toBeNull()
    expect(r!.budgetStrategy).toBe('artifact')
    expect(r!.artifactPath).toBe('artifacts/42.txt')
    expect(r!.truncated).toBe(true)
  })

  it('inline 档 + 两数相等 ⇒ 合法账目且不带 truncated(未截也是一笔可记的账)', () => {
    const r = buildToolResultTruncationRecord(facts({ originalBytes: 10, returnedBytes: 10, budgetStrategy: 'inline' }))
    expect(r).not.toBeNull()
    expect('truncated' in r!).toBe(false)
  })

  it('边界值:0/0 与 1/0 都成立,后者必判已截', () => {
    const zero = buildToolResultTruncationRecord(facts({ originalBytes: 0, returnedBytes: 0 }))
    expect(zero).not.toBeNull()
    expect('truncated' in zero!).toBe(false)
    const one = buildToolResultTruncationRecord(facts({ originalBytes: 1, returnedBytes: 0 }))
    expect(one!.truncated).toBe(true)
  })

  it('产出的记录是 frozen —— 边界结论不得被下游改写回去', () => {
    const r = buildToolResultTruncationRecord(facts()) as ToolResultTruncationRecord
    expect(Object.isFrozen(r)).toBe(true)
  })

  it('策略值域只认 TOOL_RESULT_POLICIES 那一份,不在表上的一律不认', () => {
    for (const policy of TOOL_RESULT_POLICIES) {
      const needsPath = policy === 'artifact'
      const r = buildToolResultTruncationRecord(
        facts(needsPath ? { budgetStrategy: policy, artifactPath: 'a' } : { budgetStrategy: policy }),
      )
      expect(r, `策略 ${policy} 应可记账`).not.toBeNull()
    }
    expect(buildToolResultTruncationRecord(facts({ budgetStrategy: 'ARTIFACT', artifactPath: 'a' }))).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
