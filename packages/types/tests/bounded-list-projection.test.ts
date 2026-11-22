// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票4:有界投影与"缺席 vs 零"。
 * 票面验收草案三条,打在 packages/types/src/api-contracts.ts 的分页投影封装
 * (projectBoundedList / clampProjectionLimit / BoundedListProjectionSchema)上:
 *   (a) limit=99999 返回 appliedLimit === MAX_LIST_LIMIT 而不是抛错;
 *   (b) truncated 为真必须同时给出 total;缺席(total 未知)时 truncated 为假且
 *       total 键整个不出现 —— 而不是 false;
 *   (c) 服务端返回 undefined 的可选计数在投影对象里不出现该键
 *       ('total' in out === false);确数 0 则键在、值为 0 —— 缺席与零不得互换。
 */
import { describe, it, expect } from 'vitest'
import {
  MAX_LIST_LIMIT,
  clampProjectionLimit,
  projectBoundedList,
  BoundedListProjectionSchema,
} from '../src/api-contracts.js'

describe('票4 · (a) 越界页容量钳进界,不抛错', () => {
  it('limit=99999 → appliedLimit === MAX_LIST_LIMIT,list 被裁到界内', () => {
    const big = Array.from({ length: 250 }, (_, i) => ({ i }))
    const out = projectBoundedList({ list: big, limit: 99999, total: 250 })
    expect(out.appliedLimit).toBe(MAX_LIST_LIMIT)
    expect(out.list).toHaveLength(MAX_LIST_LIMIT)
    expect(out.truncated).toBe(true)
  })

  it('clampProjectionLimit:0 / 负数 / NaN / Infinity 都钳进 [1, max],不抛错', () => {
    expect(clampProjectionLimit(0)).toBe(1)
    expect(clampProjectionLimit(-5)).toBe(1)
    expect(clampProjectionLimit(Number.NaN)).toBe(MAX_LIST_LIMIT)
    expect(clampProjectionLimit(Number.POSITIVE_INFINITY)).toBe(MAX_LIST_LIMIT)
    expect(clampProjectionLimit(99999, 20)).toBe(20)
    expect(clampProjectionLimit(10, 20)).toBe(10)
  })
})

describe('票4 · (b) truncated 与 total 成对出现', () => {
  it('truncated 为真时必须同时给出 total', () => {
    const out = projectBoundedList({ list: [{ a: 1 }], limit: 10, total: 5 })
    expect(out.truncated).toBe(true)
    expect('total' in out).toBe(true)
    expect(out.total).toBe(5)
  })

  it('total 缺席(不知道)⇒ truncated 为假且 total 键整个不出现,不是 false', () => {
    const out = projectBoundedList({ list: [{ a: 1 }], limit: 10 })
    expect(out.truncated).toBe(false)
    expect('total' in out).toBe(false)
  })

  it('schema 层同判:truncated:true 而 total 缺席 → safeParse 失败', () => {
    const bad = { list: [], truncated: true, appliedLimit: 10 }
    expect(BoundedListProjectionSchema.safeParse(bad).success).toBe(false)
    const good = { list: [], truncated: true, appliedLimit: 10, total: 42 }
    expect(BoundedListProjectionSchema.safeParse(good).success).toBe(true)
  })
})

describe('票4 · (c) 缺席 vs 零不得互换', () => {
  it('服务端可选计数为 undefined → 客户端对象不出现该键', () => {
    const out = projectBoundedList({ list: [], limit: 10, total: undefined })
    expect('total' in out).toBe(false)
    expect(Object.values(out).every((v) => v !== undefined)).toBe(true)
  })

  it('确数为 0 → 键必须在、值为 0(零是读数,不是缺席)', () => {
    const out = projectBoundedList({ list: [], limit: 10, total: 0 })
    expect('total' in out).toBe(true)
    expect(out.total).toBe(0)
    expect(out.truncated).toBe(false)
  })

  it('投影对象进 schema 往返一致(strict 白面)', () => {
    const out = projectBoundedList({ list: [{ x: 1 }, { x: 2 }], limit: 99999, total: 2 })
    expect(BoundedListProjectionSchema.safeParse(out).success).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
