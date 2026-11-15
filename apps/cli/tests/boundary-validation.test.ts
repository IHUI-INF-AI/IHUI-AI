// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 边界校验与错误归因分离。
 *
 * 钉四件事(第一条是核心):
 *   ① **同一句 "Invalid",params 归 -32602、result 归 -32603** ——
 *      归错码会让客户端去改永远改不对的参数;
 *   ② 错误文案封顶 2048 字符、issue 只列前 8 条;
 *   ③ 非纯 JSON 值在边界被拒(函数/Symbol/BigInt/循环引用/class 实例);
 *   ④ 数组采样有上限(不为报一条错去遍历整个大数组)。
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BoundaryValidationError,
  MAX_ARRAY_SAMPLE,
  MAX_ISSUES_SHOWN,
  MAX_MESSAGE_CHARS,
  describeValidationError,
  isPlainJsonValue,
  pointerOf,
  sampleArrayLengths,
  validateAtBoundary,
  type ValidationIssue,
} from '../src/acp/boundary-validation.js';

const issue = (p: string, m = 'required'): ValidationIssue => ({ code: 'schema_issue', message: m, path: p })

describe('错误归因分离(核心)', () => {
  it('params 边界 ⇒ -32602', () => {
    const e = new BoundaryValidationError('params', 'x.ai/demo', [issue('/a')])
    expect(e.jsonRpcCode).toBe(-32602)
  })

  it('result 边界 ⇒ -32603(服务端 bug,不是调用方错)', () => {
    const e = new BoundaryValidationError('result', 'x.ai/demo', [issue('/a')])
    expect(e.jsonRpcCode).toBe(-32603)
  })

  it('两种情况文案前缀不同(让人一眼看出该改哪边)', () => {
    const p = new BoundaryValidationError('params', 'm', [issue('/a')])
    const r = new BoundaryValidationError('result', 'm', [issue('/a')])
    expect(p.message).toContain('Invalid m params:')
    expect(r.message).toContain('Invalid m result:')
  })

  it('asRpcError 不把 result 边界的错误折成 invalid params', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'acp', 'server.ts'), 'utf8')
    // 源码里必须存在"先按 result 前缀拦一道"的判据
    expect(src).toContain('/^Invalid .+ result')
    // 且必须优先处理 BoundaryValidationError
    expect(src).toContain('instanceof BoundaryValidationError')
  })
})

describe('文案约束', () => {
  it('issue 只列前 8 条,并报剩余数', () => {
    const many = Array.from({ length: 20 }, (_, i) => issue(`/f${i}`))
    const msg = describeValidationError('params', 'm', many)
    expect(msg).toContain('(+12 more)')
    // 第 9 条的路径不该出现
    expect(msg).not.toContain('/f8:')
  })

  it('整体封顶 2048 字符', () => {
    const huge = Array.from({ length: 8 }, (_, i) => issue(`/p${i}`, 'x'.repeat(1000)))
    const msg = describeValidationError('params', 'm', huge)
    expect(msg.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS)
  })

  it('常量与对标实现同口径', () => {
    expect(MAX_ISSUES_SHOWN).toBe(8)
    expect(MAX_MESSAGE_CHARS).toBe(2048)
    expect(MAX_ARRAY_SAMPLE).toBe(16)
  })
})

describe('validateAtBoundary', () => {
  it('通过时原值返回', () => {
    const v = { a: 1 }
    expect(validateAtBoundary('params', 'm', v, () => [])).toBe(v)
  })

  it('有 issue 时抛对应边界的错误', () => {
    expect(() => validateAtBoundary('result', 'm', { a: 1 }, () => [issue('/a')])).toThrow(
      BoundaryValidationError,
    )
  })

  it('非纯 JSON 值 ⇒ 抛错(不是让序列化层崩)', () => {
    expect(() => validateAtBoundary('params', 'm', { f: () => 1 }, () => [])).toThrow(
      /plain JSON/,
    )
  })
})

describe('isPlainJsonValue', () => {
  it('基本类型通过', () => {
    for (const v of [null, true, 1, 'x', [], {}]) expect(isPlainJsonValue(v)).toBe(true)
  })

  it('NaN / Infinity 被拒', () => {
    expect(isPlainJsonValue(NaN)).toBe(false)
    expect(isPlainJsonValue(Infinity)).toBe(false)
  })

  it('函数 / Symbol / BigInt 被拒', () => {
    expect(isPlainJsonValue(() => 1)).toBe(false)
    expect(isPlainJsonValue(Symbol('x'))).toBe(false)
    expect(isPlainJsonValue(BigInt(1))).toBe(false)
  })

  it('循环引用被拒(不会无限递归)', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(isPlainJsonValue(a)).toBe(false)
  })

  it('Date / Map / class 实例被拒(只有普通对象算 JSON)', () => {
    expect(isPlainJsonValue(new Date())).toBe(false)
    expect(isPlainJsonValue(new Map())).toBe(false)
    class Foo {
      x = 1
    }
    expect(isPlainJsonValue(new Foo())).toBe(false)
  })

  it('null 原型对象通过', () => {
    const o = Object.create(null) as Record<string, unknown>
    o.a = 1
    expect(isPlainJsonValue(o)).toBe(true)
  })

  it('嵌套数组/对象通过', () => {
    expect(isPlainJsonValue({ a: [1, { b: [2] }] })).toBe(true)
  })
})

describe('sampleArrayLengths', () => {
  it('记录数组长度', () => {
    expect(sampleArrayLengths([1, 2, 3])).toEqual({ $: 3 })
  })

  it('嵌套数组也被采到(受深度限制)', () => {
    const v = { a: [1, 2], b: [3] }
    const r = sampleArrayLengths(v)
    expect(r['$/a']).toBe(2)
    expect(r['$/b']).toBe(1)
  })

  it('采样条数有上限(不为报错遍历巨大结构)', () => {
    // 造 100 个各含数组的键
    const big: Record<string, number[]> = {}
    for (let i = 0; i < 100; i++) big[`k${i}`] = [1]
    const r = sampleArrayLengths(big)
    expect(Object.keys(r).length).toBeLessThanOrEqual(MAX_ARRAY_SAMPLE)
  })

  it('大数组不展开全部元素(只探前 3 个找嵌套)', () => {
    const arr = Array.from({ length: 100000 }, () => 1)
    const r = sampleArrayLengths(arr)
    // 只有根一项,没有 10 万个子项
    expect(Object.keys(r)).toEqual(['$'])
    expect(r['$']).toBe(100000)
  })
})

describe('pointerOf', () => {
  it('根为 $', () => {
    expect(pointerOf()).toBe('$')
  })

  it('路径拼接', () => {
    expect(pointerOf('a', 0, 'b')).toBe('$/a/0/b')
  })

  it('转义 ~ 与 /', () => {
    expect(pointerOf('a/b')).toBe('$/a~1b')
    expect(pointerOf('a~b')).toBe('$/a~0b')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
