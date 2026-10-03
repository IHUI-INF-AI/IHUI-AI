// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { clampPercent } from '../clamp-percent.js'

/** G-815966:百分比裁剪唯一出口 —— 边界与缺席语义逐格钉住。 */
describe('clampPercent(G-815966 百分比裁剪唯一出口)', () => {
  it('界内原样返回', () => {
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(42.5)).toBe(42.5)
    expect(clampPercent(100)).toBe(100)
  })

  it('越界钳到边界:恰好等于 limit 不得缺席语义', () => {
    expect(clampPercent(-1)).toBe(0)
    expect(clampPercent(101)).toBe(100)
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(100)
    expect(clampPercent(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  it('缺席/非数值 ⇒ 0(progress?.x ?? 0 的旧手搓语义收编)', () => {
    expect(clampPercent(undefined)).toBe(0)
    expect(clampPercent(null)).toBe(0)
    expect(clampPercent(Number.NaN)).toBe(0)
  })

  // G-815966 验收点名的读数表:逐值列明,NaN 的去向必须是被**声明**过的一档,不是巧合。
  it('票面读数表 [-5, 0, 50, 100, 999, NaN]', () => {
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(100)).toBe(100)
    expect(clampPercent(999)).toBe(100)
    // NaN ⇒ 0 是出口头注写明的语义("非数值 ⇒ 0"):NaN 无从判断偏高还是偏低,
    // 猜 100 会把未知进度显示成已完成,原样透传会把 NaN 写进 DB(旧手搓形态正是后者),
    // 取 0 是两侧中"不谎报进度"的那一侧 —— 这一条断言就是它不许悄悄变成 100 的钉子。
    expect(clampPercent(Number.NaN)).toBe(0)
    expect(Number.isNaN(clampPercent(Number.NaN))).toBe(false)
  })

  it('整数化留在调用点:出口只钳范围,与 Math.floor 复合后仍等价于旧手搓', () => {
    // 站点原形态 Math.max(0, Math.min(100, Math.floor(x))) ⇒ 收口成 clampPercent(Math.floor(x))
    expect(clampPercent(Math.floor(37.9))).toBe(37)
    expect(clampPercent(Math.floor(120.4))).toBe(100)
    expect(clampPercent(Math.floor(-3.2))).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
