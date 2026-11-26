// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成定价单测(2026-11-26 全收费/fail-closed,**不连库**)。
 *
 * 钉住四件事:
 *   1. `ai_pricing` 的 per_image/per_video/per_call 分价直接 1:1 转积分;
 *   2. 按次恒 1 次、按秒必须按真实 units;
 *   3. 无定价行 / 模式不匹配 / 单价 <=0 一律返回 null,调用方必须拒绝;
 *   4. 单价缺失但成本价 >0 时,按成本 ×3 生成零售价,仍然收费。
 */
import { describe, expect, it } from 'vitest'
import { quoteMediaPoints, requiredBillingMode } from '../src/services/media-billing-pricing.js'

describe('requiredBillingMode', () => {
  it('图片/视频/音频各自只认一种模式', () => {
    expect(requiredBillingMode('image')).toBe('per_image')
    expect(requiredBillingMode('video')).toBe('per_video')
    expect(requiredBillingMode('audio')).toBe('per_call')
    expect(requiredBillingMode('voiceprint')).toBe('per_call')
    expect(requiredBillingMode('video_compose')).toBe('per_call')
  })
})

describe('quoteMediaPoints — ai_pricing 命中', () => {
  it('per_image 20 分/张直接转 20 积分,多张线性累加', () => {
    const pricing = { billingMode: 'per_image', perUnitPrice: 20, videoUnit: null }
    expect(quoteMediaPoints({ category: 'image', pricing })!.points).toBe(20)
    expect(quoteMediaPoints({ category: 'image', units: 2, pricing })!.points).toBe(40)
    expect(quoteMediaPoints({ category: 'image', units: 10, pricing })!.points).toBe(200)
    expect(quoteMediaPoints({ category: 'image', pricing })!.source).toBe('ai_pricing')
  })

  it('per_video call 60 分/次:无论传多少秒都只算 1 次', () => {
    const pricing = { billingMode: 'per_video', perUnitPrice: 60, videoUnit: 'call' }
    expect(quoteMediaPoints({ category: 'video', units: 1, pricing })!.points).toBe(60)
    expect(quoteMediaPoints({ category: 'video', units: 30, pricing })!.points).toBe(60)
    expect(quoteMediaPoints({ category: 'video', units: 30, pricing })!.appliedUnits).toBe(1)
  })

  it('per_video second 74 分/秒:30 秒 = 2220 积分', () => {
    const pricing = { billingMode: 'per_video', perUnitPrice: 74, videoUnit: 'second' }
    const q = quoteMediaPoints({ category: 'video', units: 30, pricing })!
    expect(q.points).toBe(2220)
    expect(q.appliedUnits).toBe(30)
    expect(q.unitPricePoints).toBe(74)
    expect(q.source).toBe('ai_pricing')
  })

  it('per_call 音频/声纹/视频合成按次收费', () => {
    expect(
      quoteMediaPoints({
        category: 'audio',
        pricing: { billingMode: 'per_call', perUnitPrice: 2, videoUnit: null },
      })!.points,
    ).toBe(2)
    expect(
      quoteMediaPoints({
        category: 'voiceprint',
        pricing: { billingMode: 'per_call', perUnitPrice: 2, videoUnit: null },
      })!.points,
    ).toBe(2)
    expect(
      quoteMediaPoints({
        category: 'video_compose',
        pricing: { billingMode: 'per_call', perUnitPrice: 30, videoUnit: null },
      })!.points,
    ).toBe(30)
  })
})

describe('quoteMediaPoints — fail-closed 边界', () => {
  it('无定价行返回 null', () => {
    expect(quoteMediaPoints({ category: 'image', pricing: null })).toBeNull()
    expect(quoteMediaPoints({ category: 'audio', pricing: undefined })).toBeNull()
  })

  it('显式 0 价返回 null,不再免费', () => {
    expect(
      quoteMediaPoints({
        category: 'image',
        pricing: { billingMode: 'per_image', perUnitPrice: 0, videoUnit: null },
      }),
    ).toBeNull()
    expect(
      quoteMediaPoints({
        category: 'video',
        units: 30,
        pricing: { billingMode: 'per_video', perUnitPrice: 0, videoUnit: 'second' },
      }),
    ).toBeNull()
  })

  it('定价模式不匹配返回 null,不误用 token 价', () => {
    const pricing = { billingMode: 'token', perUnitPrice: 100, videoUnit: null }
    expect(quoteMediaPoints({ category: 'image', pricing })).toBeNull()
    expect(quoteMediaPoints({ category: 'video', pricing })).toBeNull()
    expect(quoteMediaPoints({ category: 'audio', pricing })).toBeNull()
  })

  it('单价缺失但成本价 >0:按成本 ×3,不允许免费', () => {
    const image = quoteMediaPoints({
      category: 'image',
      pricing: { billingMode: 'per_image', perUnitPrice: null, costUnitPrice: 12, videoUnit: null },
    })!
    expect(image.points).toBe(36)
    expect(image.unitPricePoints).toBe(36)
    expect(image.costCents).toBe(12)

    const video = quoteMediaPoints({
      category: 'video',
      units: 5,
      pricing: {
        billingMode: 'per_video',
        perUnitPrice: null,
        costUnitPrice: 50,
        videoUnit: 'second',
      },
    })!
    expect(video.points).toBe(750) // 50×3×5 秒
    expect(video.costCents).toBe(250)
  })

  it('单价和成本价都缺失返回 null', () => {
    expect(
      quoteMediaPoints({
        category: 'image',
        pricing: {
          billingMode: 'per_image',
          perUnitPrice: null,
          costUnitPrice: null,
          videoUnit: null,
        },
      }),
    ).toBeNull()
  })

  it('units 非法(0/负数/NaN/Infinity)按 1 计', () => {
    const pricing = { billingMode: 'per_image', perUnitPrice: 20, videoUnit: null }
    expect(quoteMediaPoints({ category: 'image', units: 0, pricing })!.points).toBe(20)
    expect(quoteMediaPoints({ category: 'image', units: -5, pricing })!.points).toBe(20)
    expect(quoteMediaPoints({ category: 'image', units: Number.NaN, pricing })!.points).toBe(20)
    expect(
      quoteMediaPoints({ category: 'image', units: Number.POSITIVE_INFINITY, pricing })!.points,
    ).toBe(20)
  })

  it('结果恒为整数(ceil 收口,不出现小数积分)', () => {
    const pricing = { billingMode: 'per_image', perUnitPrice: 20.4, videoUnit: null }
    const q = quoteMediaPoints({ category: 'image', pricing })!
    expect(Number.isInteger(q.points)).toBe(true)
    expect(q.points).toBe(21)
  })

  it('平台成本价按实际计价单位计算,未配置返回 null', () => {
    const image = quoteMediaPoints({
      category: 'image',
      units: 2,
      pricing: { billingMode: 'per_image', perUnitPrice: 20, costUnitPrice: 12, videoUnit: null },
    })!
    expect(image.costCents).toBe(24)

    const video = quoteMediaPoints({
      category: 'video',
      units: 30,
      pricing: {
        billingMode: 'per_video',
        perUnitPrice: 74,
        costUnitPrice: 50,
        videoUnit: 'second',
      },
    })!
    expect(video.costCents).toBe(1500)

    const unset = quoteMediaPoints({
      category: 'image',
      pricing: { billingMode: 'per_image', perUnitPrice: 20, videoUnit: null },
    })!
    expect(unset.costCents).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
