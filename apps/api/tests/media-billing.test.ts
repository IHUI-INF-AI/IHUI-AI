// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成定价单测(2026-11-25 收口后,**不连库**)。
 *
 * 钉住三件事:
 *   1. `ai_pricing` 的 per_image/per_video 分价直接 1:1 转积分,不再乘模型倍率;
 *   2. 按次视频恒算 1 次、按秒视频必须按真实 duration;
 *   3. 无定价行时回落统一兜底表,免费模型仍 0 积分。
 */
import { describe, expect, it } from 'vitest'
import {
  MEDIA_FALLBACK_UNIT_POINTS,
  estimateFallbackMediaPoints,
  quoteMediaPoints,
} from '../src/services/media-billing-pricing.js'

describe('媒体兜底单位价', () => {
  it('图片/视频/音频/声纹/视频合成各只有一档,且表被冻结', () => {
    expect(MEDIA_FALLBACK_UNIT_POINTS.image).toBe(20)
    expect(MEDIA_FALLBACK_UNIT_POINTS.video).toBe(20)
    expect(MEDIA_FALLBACK_UNIT_POINTS.audio).toBe(2)
    expect(MEDIA_FALLBACK_UNIT_POINTS.voiceprint).toBe(2)
    expect(MEDIA_FALLBACK_UNIT_POINTS.video_compose).toBe(30)
    expect(Object.isFrozen(MEDIA_FALLBACK_UNIT_POINTS)).toBe(true)
  })
})

describe('quoteMediaPoints — ai_pricing 命中', () => {
  it('per_image 20 分/张直接转 20 积分,多张线性累加', () => {
    const pricing = { billingMode: 'per_image', perUnitPrice: 20, videoUnit: null }
    expect(quoteMediaPoints({ category: 'image', pricing }).points).toBe(20)
    expect(quoteMediaPoints({ category: 'image', units: 2, pricing }).points).toBe(40)
    expect(quoteMediaPoints({ category: 'image', units: 10, pricing }).points).toBe(200)
    expect(quoteMediaPoints({ category: 'image', pricing }).source).toBe('ai_pricing')
  })

  it('per_video call 60 分/次:无论传多少秒都只算 1 次', () => {
    const pricing = { billingMode: 'per_video', perUnitPrice: 60, videoUnit: 'call' }
    expect(quoteMediaPoints({ category: 'video', units: 1, pricing }).points).toBe(60)
    expect(quoteMediaPoints({ category: 'video', units: 30, pricing }).points).toBe(60)
    expect(quoteMediaPoints({ category: 'video', units: 30, pricing }).appliedUnits).toBe(1)
  })

  it('per_video second 74 分/秒:30 秒 = 2220 积分', () => {
    const pricing = { billingMode: 'per_video', perUnitPrice: 74, videoUnit: 'second' }
    const q = quoteMediaPoints({ category: 'video', units: 30, pricing })
    expect(q.points).toBe(2220)
    expect(q.appliedUnits).toBe(30)
    expect(q.unitPricePoints).toBe(74)
    expect(q.source).toBe('ai_pricing')
  })
})

describe('quoteMediaPoints — 兜底与边界', () => {
  it('无定价行:图片 20/张、视频 20/次、音频 2/次、视频合成 30/次', () => {
    expect(estimateFallbackMediaPoints('image')).toBe(20)
    expect(estimateFallbackMediaPoints('image', 3)).toBe(60)
    expect(estimateFallbackMediaPoints('video')).toBe(20)
    expect(estimateFallbackMediaPoints('video', 30)).toBe(20)
    expect(estimateFallbackMediaPoints('audio')).toBe(2)
    expect(estimateFallbackMediaPoints('voiceprint')).toBe(2)
    expect(estimateFallbackMediaPoints('video_compose')).toBe(30)
  })

  it('免费模型 0 积分', () => {
    expect(
      quoteMediaPoints({
        category: 'image',
        free: true,
        pricing: { billingMode: 'per_image', perUnitPrice: 20, videoUnit: null },
      }).points,
    ).toBe(0)
  })

  it('显式 0 价媒体行必须被尊重,不能回落成兜底价', () => {
    const imageZero = quoteMediaPoints({
      category: 'image',
      pricing: { billingMode: 'per_image', perUnitPrice: 0, videoUnit: null },
    })
    expect(imageZero.points).toBe(0)
    expect(imageZero.source).toBe('ai_pricing')

    const videoZero = quoteMediaPoints({
      category: 'video',
      units: 30,
      pricing: { billingMode: 'per_video', perUnitPrice: 0, videoUnit: 'second' },
    })
    expect(videoZero.points).toBe(0)
    expect(videoZero.source).toBe('ai_pricing')
    expect(videoZero.appliedUnits).toBe(30)
  })

  it('定价模式不匹配时回落兜底表,不误用 token 价', () => {
    const pricing = { billingMode: 'token', perUnitPrice: 100, videoUnit: null }
    expect(quoteMediaPoints({ category: 'image', pricing }).points).toBe(20)
    expect(quoteMediaPoints({ category: 'video', pricing }).points).toBe(20)
  })

  it('units 非法(0/负数/NaN/Infinity)按 1 计', () => {
    expect(estimateFallbackMediaPoints('image', 0)).toBe(20)
    expect(estimateFallbackMediaPoints('image', -5)).toBe(20)
    expect(estimateFallbackMediaPoints('image', Number.NaN)).toBe(20)
    expect(estimateFallbackMediaPoints('image', Number.POSITIVE_INFINITY)).toBe(20)
  })

  it('结果恒为整数(ceil 收口,不出现小数积分)', () => {
    const pricing = { billingMode: 'per_image', perUnitPrice: 20.4, videoUnit: null }
    const q = quoteMediaPoints({ category: 'image', pricing })
    expect(Number.isInteger(q.points)).toBe(true)
    expect(q.points).toBe(21)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
