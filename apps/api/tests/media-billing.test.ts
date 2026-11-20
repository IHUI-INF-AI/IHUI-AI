// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成计费定价单测(2026-11-21 立,**不连库**)。
 *
 * 立因:图像/视频上游从不返回 token 用量,按 token 扣分那条链路对媒体恒为 0,
 * 等于白送。补了"按张/次"的定价后,公式一旦被误改就是真金白银的漏收或错收 ——
 * 必须有判据钉住。本测试只 import 两个纯模块,不触碰 db/points(测试隔离铁律)。
 */
import { describe, expect, it } from 'vitest'
import { inferPointsMultiplier } from '../src/services/points-multiplier.js'
import {
  MEDIA_UNIT_POINTS,
  estimateMediaPoints,
} from '../src/services/media-billing-pricing.js'

describe('媒体定价单位', () => {
  it('图像按张 3 积分、视频按次 12 积分,且表被冻结', () => {
    expect(MEDIA_UNIT_POINTS.image).toBe(3)
    expect(MEDIA_UNIT_POINTS.video).toBe(12)
    expect(Object.isFrozen(MEDIA_UNIT_POINTS)).toBe(true)
  })
})

describe('estimateMediaPoints 公式', () => {
  it('agnes 免费档(flash ⇒ 1x)按张/次原价', () => {
    expect(inferPointsMultiplier('agnes-image-2.5-flash')).toBe(1)
    expect(inferPointsMultiplier('agnes-video-2.5-flash')).toBe(1)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image')).toBe(3)
    expect(estimateMediaPoints('agnes-video-2.5-flash', 'video')).toBe(12)
  })

  it('标准档(sonnet ⇒ 3x)按倍数放大', () => {
    expect(inferPointsMultiplier('claude-3-sonnet')).toBe(3)
    expect(estimateMediaPoints('claude-3-sonnet', 'image')).toBe(9)
    expect(estimateMediaPoints('claude-3-sonnet', 'video')).toBe(36)
  })

  it('免费模型(0x)一律 0 积分,不因媒体计费变成收费', () => {
    expect(inferPointsMultiplier('ollama/llama3')).toBe(0)
    expect(estimateMediaPoints('ollama/llama3', 'image')).toBe(0)
    expect(estimateMediaPoints('ollama/llama3', 'video')).toBe(0)
    expect(estimateMediaPoints('pollinations/flux', 'image')).toBe(0)
  })

  it('多张/多次按 units 线性累加', () => {
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', 2)).toBe(6)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', 4)).toBe(12)
    expect(estimateMediaPoints('agnes-video-2.5-flash', 'video', 3)).toBe(36)
    // 上游单次最多 n=10 张:一次请求必须按 10 张扣(按 1 张扣等于漏收 9 张的钱)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', 10)).toBe(30)
  })

  it('units 非法(0/负数/NaN/Infinity)按 1 计,绝不产生 0 元或负数扣费', () => {
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', 0)).toBe(3)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', -5)).toBe(3)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', Number.NaN)).toBe(3)
    expect(estimateMediaPoints('agnes-image-2.5-flash', 'image', Number.POSITIVE_INFINITY)).toBe(3)
  })

  it('未知/空模型名按默认经济档(1x),不会因空串变成免费', () => {
    expect(inferPointsMultiplier('')).toBe(1)
    expect(estimateMediaPoints('', 'image')).toBe(3)
    expect(estimateMediaPoints('  ', 'video')).toBe(12)
    expect(estimateMediaPoints('some-unknown-media-model', 'image')).toBe(3)
  })

  it('结果恒为整数(ceil 收口,不出现小数积分)', () => {
    for (const model of [
      'agnes-image-2.5-flash',
      'agnes-video-2.5-flash',
      'claude-3-sonnet',
      'ihui/glm-5.3',
    ]) {
      for (const cat of ['image', 'video'] as const) {
        const n = estimateMediaPoints(model, cat, 1)
        expect(Number.isInteger(n)).toBe(true)
        expect(n).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
