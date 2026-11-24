// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 图像/视频模态档"可执行"判据的守卫(2026-11-21 立)。
 *
 * 病灶:目录 id 带 provider 前缀(`agnes/agnes-image-2.5-flash`),而上游/provider 通道
 * 只认裸名(`agnes-image-2.5-flash`)。任一侧按整串比前缀,都会让"选择器里选得中"与
 * "后端真能跑"分家 —— 生产实测表现为选了 agnes 图像档回 400 / 上游 404。
 * 这里把三种形态(带前缀 / 裸名 / 非本家族)与大小写混合全部钉住。
 */
import { describe, expect, it } from 'vitest'
import { bareMediaModelId, isExecutableMediaModel } from '../model-catalog'

describe('bareMediaModelId', () => {
  it('剥掉 provider 前缀只留裸名', () => {
    expect(bareMediaModelId('agnes/agnes-image-2.5-flash')).toBe('agnes-image-2.5-flash')
    expect(bareMediaModelId('agnes/agnes-video-2.5-flash')).toBe('agnes-video-2.5-flash')
  })

  it('本身已是裸名时原样返回', () => {
    expect(bareMediaModelId('agnes-image-2.5-flash')).toBe('agnes-image-2.5-flash')
  })

  it('空值与非字符串一律返回空串', () => {
    expect(bareMediaModelId(undefined)).toBe('')
    expect(bareMediaModelId(null)).toBe('')
    expect(bareMediaModelId('   ')).toBe('')
  })
})

describe('isExecutableMediaModel', () => {
  it('带 provider 前缀的目录 id 也要判为可执行', () => {
    expect(isExecutableMediaModel('agnes/agnes-image-2.5-flash', 'image')).toBe(true)
    expect(isExecutableMediaModel('agnes/agnes-video-2.5-flash', 'video')).toBe(true)
  })

  it('裸名形态同样可执行', () => {
    expect(isExecutableMediaModel('agnes-image-2.1-flash', 'image')).toBe(true)
    expect(isExecutableMediaModel('agnes-video-2.5', 'video')).toBe(true)
  })

  it('非 agnes 家族的图像/视频档判不可执行(不静默顶替)', () => {
    expect(isExecutableMediaModel('qwen-image-2.0', 'image')).toBe(false)
    expect(isExecutableMediaModel('gemini/gemini-3-pro-image', 'image')).toBe(false)
    expect(isExecutableMediaModel('grok-imagine-video-1.5', 'video')).toBe(false)
  })

  it('对话/语音/OCR 档一律 true(未接通由发送侧提示,不在目录层判死)', () => {
    expect(isExecutableMediaModel('qwen-image-2.0', 'chat')).toBe(true)
    expect(isExecutableMediaModel('mimo-v2.5-tts', 'tts')).toBe(true)
    expect(isExecutableMediaModel('gemini/gemini-2.5-flash', 'vision')).toBe(true)
  })

  it('取不到 id 时不判死(失效方向恒为多显示一次)', () => {
    expect(isExecutableMediaModel('', 'image')).toBe(true)
    expect(isExecutableMediaModel(undefined, 'video')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isExecutableMediaModel('Agnes/Agnes-Image-2.5-Flash', 'image')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
