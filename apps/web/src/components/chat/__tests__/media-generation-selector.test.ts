// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 选择器模态判据行为锁(2026-11-21 立)。
 *
 * 锁四条边界:
 *   ① 图像/视频里没有接通生成通道的(裸名不以 agnes-image-/agnes-video- 开头)不得展示
 *      —— 防"列表里能选、选了却出不了图/片";
 *   ② 有通道的必须展示;
 *   ③ 语音/OCR 不得展示 —— 2026-11-23 真实调用探测:26 条 tts/asr/ocr 全部失败,
 *      产品侧也没有语音合成/识别/OCR 端点,选中只会回"没有可用通道"说明卡;
 *   ④ 视觉(vision)仍展示,它走聊天链路,可真实调用。
 * 另锁向后兼容:不传 modelId 的老调用方行为不变(不下架任何模态档)。
 */

import { describe, expect, it } from 'vitest'

import { isExecutableMediaModel, isSelectableChatModel } from '@ihui/shared'

describe('isExecutableMediaModel', () => {
  it('只认 agnes 图像生成通道前缀(含裸名形态)', () => {
    expect(isExecutableMediaModel('agnes/agnes-image-2.5-flash', 'image')).toBe(true)
    expect(isExecutableMediaModel('agnes/agnes-image-2.1-flash', 'image')).toBe(true)
    expect(isExecutableMediaModel('agnes-image-2.5-flash', 'image')).toBe(true)
  })

  it('视频通道当前都不可执行(付费余额不足 / 免费队列满)', () => {
    expect(isExecutableMediaModel('agnes/agnes-video-2.5', 'video')).toBe(false)
    expect(isExecutableMediaModel('agnes/agnes-video-2.5-flash', 'video')).toBe(false)
    expect(isSelectableChatModel('video', 'standard', 'agnes/agnes-video-2.5')).toBe(false)
    expect(isSelectableChatModel('video', 'standard', 'agnes/agnes-video-2.5-flash')).toBe(false)
  })

  it('非生成器 / 需参考图的图像视频档不算有通道', () => {
    expect(isExecutableMediaModel('@cf/runwayml/stable-diffusion-v1-5-inpainting', 'image')).toBe(
      false,
    )
    expect(isExecutableMediaModel('nvidia/ai-synthetic-video-detector', 'video')).toBe(false)
    expect(isExecutableMediaModel('@cf/black-forest-labs/flux-1-schnell', 'image')).toBe(false)
  })

  it('非图像/视频类别不受通道判据影响', () => {
    expect(isExecutableMediaModel('@cf/myshell-ai/melotts', 'tts')).toBe(true)
    expect(isExecutableMediaModel('@cf/openai/whisper-large-v3-turbo', 'asr')).toBe(true)
    expect(isExecutableMediaModel('any/ocr-model', 'ocr')).toBe(true)
    expect(isExecutableMediaModel('openai/gpt-5.5', 'chat')).toBe(true)
  })
})

describe('isSelectableChatModel 第三判据', () => {
  it('可执行的模态档展示,不可执行的不展示', () => {
    expect(isSelectableChatModel('image', 'standard', 'agnes/agnes-image-2.5-flash')).toBe(true)
    expect(isSelectableChatModel('video', 'standard', 'agnes/agnes-video-2.5-flash')).toBe(false)
    expect(
      isSelectableChatModel('image', 'standard', '@cf/runwayml/stable-diffusion-v1-5-inpainting'),
    ).toBe(false)
  })

  it('高频限流的免费档不展示,稳定的对话档展示', () => {
    expect(isSelectableChatModel('chat', 'standard', 'pollinations/openai-fast')).toBe(false)
    expect(
      isSelectableChatModel('chat', 'latest', 'openrouter/inclusionai/ling-3.2-flash:free'),
    ).toBe(false)
    expect(
      isSelectableChatModel('chat', 'latest', 'openrouter/baidu/ernie-5.5-flash-preview:free'),
    ).toBe(true)
    expect(isSelectableChatModel('chat', 'standard', 'openrouter/particle-ai/particle-1:free')).toBe(
      true,
    )
  })

  it('语音/OCR 档没有产品执行通道,不展示', () => {
    expect(isSelectableChatModel('tts', 'standard', '@cf/myshell-ai/melotts')).toBe(false)
    expect(isSelectableChatModel('asr', 'standard', '@cf/openai/whisper-large-v3-turbo')).toBe(
      false,
    )
    expect(isSelectableChatModel('ocr', 'standard', 'qwen/qwen-vl-ocr')).toBe(false)
  })

  it('原有判据不变:legacy 与中间件一概不展示', () => {
    expect(isSelectableChatModel('chat', 'legacy', 'agnes/agnes-2.5-flash')).toBe(false)
    for (const category of ['embedding', 'rerank', 'guard', 'other'] as const) {
      expect(isSelectableChatModel(category, 'standard', 'x/y')).toBe(false)
    }
    expect(isSelectableChatModel('chat', 'latest', 'openai/gpt-5.5')).toBe(true)
    expect(isSelectableChatModel('vision', 'standard', 'opencode/nemotron-3.5-super-vl-free')).toBe(
      true,
    )
  })

  it('不传 modelId 时不下架任何模态档(向后兼容)', () => {
    expect(isSelectableChatModel('image', 'standard')).toBe(true)
    expect(isSelectableChatModel('video', 'standard')).toBe(true)
    expect(isSelectableChatModel('image', 'legacy')).toBe(false)
    expect(isSelectableChatModel('embedding', 'latest')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
