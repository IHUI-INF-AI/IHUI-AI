// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { JUMP_FAR_THRESHOLD, computeJumpVisibility, shouldShowJumpLatest } from './scroll-jump'

describe('跳顶/跳底显隐判据(三端唯一真相源)', () => {
  it('阈值取 D3 定档 800,且导出名与 web 侧既有引用保持同源', () => {
    expect(JUMP_FAR_THRESHOLD).toBe(800)
  })

  it('刚过阈值才亮:800 不算远离,801 才算(两侧都是严格不等)', () => {
    const exactly = computeJumpVisibility(800, 5000, 600)
    expect(exactly.isFarFromTop).toBe(false)
    const justPast = computeJumpVisibility(801, 5000, 600)
    expect(justPast.isFarFromTop).toBe(true)
  })

  it('距底按 scrollHeight - scrollTop - clientHeight 算,贴底时为 0 不亮', () => {
    const v = computeJumpVisibility(4400, 5000, 600)
    expect(v.isFarFromBottom).toBe(false)
    expect(v.isFarFromTop).toBe(true)
  })

  it('距底同样要跨过 800;800 不亮,801 才亮', () => {
    const edge = computeJumpVisibility(1000, 2400, 600) // 距底恰为 800
    expect(edge.isFarFromBottom).toBe(false)
    const past = computeJumpVisibility(1000, 2401, 600) // 距底 801
    expect(past.isFarFromBottom).toBe(true)
  })

  it('弹性回弹的负 scrollTop 不得被判成「远离顶部」(移动端实测形态)', () => {
    const v = computeJumpVisibility(-120, 5000, 600)
    expect(v.isFarFromTop).toBe(false)
    // 负偏移时按 0 记账,距底应等于整个可滚范围 ⇒ 亮「跳到最新」
    expect(v.isFarFromBottom).toBe(true)
  })

  it('垃圾输入(NaN/Infinity/负尺寸)一律不亮,不得把坏读数渲染成可点按钮', () => {
    const v = computeJumpVisibility(Number.NaN, Number.POSITIVE_INFINITY, -300)
    expect(v).toEqual({ isFarFromTop: false, isFarFromBottom: false })
  })

  it('调用方可覆盖阈值(为后续各端按视口高度分档留口,不改默认值)', () => {
    const v = computeJumpVisibility(300, 5000, 600, 200)
    expect(v.isFarFromTop).toBe(true)
  })
})

describe('「跳到最新」显示门', () => {
  it('没消息时恒不显示(空会话不该有一枚无用按钮)', () => {
    expect(shouldShowJumpLatest({ isFarFromBottom: true }, true, false)).toBe(false)
  })

  it('用户上滚即显示,与距离无关;真在底部且没上滚则不显示', () => {
    expect(shouldShowJumpLatest({ isFarFromBottom: false }, true, true)).toBe(true)
    expect(shouldShowJumpLatest({ isFarFromBottom: false }, false, true)).toBe(false)
    expect(shouldShowJumpLatest({ isFarFromBottom: true }, false, true)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
