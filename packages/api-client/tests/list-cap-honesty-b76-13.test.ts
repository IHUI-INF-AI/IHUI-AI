// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-13 票3:消费者绝不施加界 —— client.ts 唯一裁尾出口的行为钉子 + 通路锁。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  SSE_LIST_DISPLAY_BUDGET,
  tailWithOmittedCount,
} from '../src/client'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

describe('b76-13 裁尾唯一出口(裁尾与"少列了多少"原子产出)', () => {
  it('默认展示预算=10(常量唯一,注释区分展示预算 vs 生产契约)', () => {
    expect(SSE_LIST_DISPLAY_BUDGET).toBe(10)
  })

  it('超预算:产出尾部 + 被裁条数(说出来 + 继续可数,不是悄悄消失)', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const r = tailWithOmittedCount(items)
    expect(r.items).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23, 24])
    expect(r.omittedCount).toBe(15)
  })

  it('未超预算:全量返回,omittedCount=0(没有"少列"就不许报少列)', () => {
    const r = tailWithOmittedCount([1, 2, 3])
    expect(r.items).toEqual([1, 2, 3])
    expect(r.omittedCount).toBe(0)
  })

  it('不改入参(纯函数);cap 非正整数 ⇒ 全量返回', () => {
    const items = [1, 2, 3]
    tailWithOmittedCount(items, 2)
    expect(items).toEqual([1, 2, 3])
    expect(tailWithOmittedCount(items, 0).omittedCount).toBe(0)
    expect(tailWithOmittedCount(items, -1).omittedCount).toBe(0)
    expect(tailWithOmittedCount(items, Number.NaN).omittedCount).toBe(0)
  })

  it('通路锁:client.ts 是唯一出口,判据注释与守门脚本在位', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    expect(src).toContain('export function tailWithOmittedCount')
    expect(src).toContain('展示预算')
    const gate = readFileSync(resolve(REPO, 'scripts/check-list-cap-honesty.mjs'), 'utf8')
    expect(gate).toContain('tailWithOmittedCount')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
