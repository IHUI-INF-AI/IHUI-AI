// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-727 回归锁(2026-11-26)。
 *
 * 病灶:v1-multimodal 的 image/video 在无 active 定价行时 calculateCost 回退 0,
 * 先出图后免费;audio 端点只有鉴权/限频。定价闸必须把路由解析成正确的
 * callType/units,才能在 preHandler 阶段用同一个 calculateCost 判 503。
 */
import { describe, expect, it } from 'vitest'
import { multimodalPriceRequest } from '../src/services/multimodal-pricing-gate.js'

describe('F-727 v1 多模态定价上下文', () => {
  it('images 取 n 作为按张单位数', () => {
    expect(multimodalPriceRequest('/images/generations', { model: 'gpt-image-2', n: 3 })).toEqual({
      model: 'gpt-image-2',
      callType: 'image',
      units: 3,
    })
  })

  it('images 的 n 非法/缺省回落到 1,并限制在 1~10', () => {
    expect(multimodalPriceRequest('/images/generations', { model: 'm', n: 0 })?.units).toBe(1)
    expect(multimodalPriceRequest('/images/generations', { model: 'm', n: 99 })?.units).toBe(10)
    expect(multimodalPriceRequest('/images/generations', { model: 'm' })?.units).toBe(1)
  })

  it('videos 先按 1 个计费单位探价(按秒/按次都由定价行决定)', () => {
    expect(multimodalPriceRequest('/videos/generations', { model: 'veo-3' })).toEqual({
      model: 'veo-3',
      callType: 'video',
      units: 1,
    })
  })

  it('audio 单列 audio 计价,优先命中 per_call 行', () => {
    expect(multimodalPriceRequest('/audio/speech', { model: 'gpt-4o-mini-tts' })).toEqual({
      model: 'gpt-4o-mini-tts',
      callType: 'audio',
      units: 1,
    })
  })

  it('music/3d/generation 走 image 口径,兼容 per_call 与 per_image', () => {
    expect(multimodalPriceRequest('/3d/generations', { model: 'tripo' })?.callType).toBe('image')
    expect(multimodalPriceRequest('/music/generations', { model: 'suno' })?.callType).toBe('image')
    expect(multimodalPriceRequest('/generation/enqueue', { model: 'job' })?.callType).toBe('image')
  })

  it('带 /v1 前缀也能归一;无 model 返回 null,交给路由 400', () => {
    expect(multimodalPriceRequest('/v1/images/edits', { model: 'm', n: 2 })?.callType).toBe('image')
    expect(multimodalPriceRequest('/images/generations', {})).toBeNull()
    expect(multimodalPriceRequest('/audio/speech', { model: '   ' })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
