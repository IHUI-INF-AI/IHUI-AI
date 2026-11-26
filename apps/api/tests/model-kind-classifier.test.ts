// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  classifyModelKind,
  shouldDisableOnMissingCost,
} from '../src/services/model-kind-classifier.js'

describe('classifyModelKind', () => {
  it('keeps normal chat models sellable', () => {
    expect(classifyModelKind('deepseek-v4-flash-1017')).toBe('chat')
    expect(classifyModelKind('claude-opus-4.1')).toBe('chat')
    expect(classifyModelKind('glm-5.0')).toBe('chat')
    expect(classifyModelKind('phi-3.5-mini-instruct')).toBe('chat')
  })

  it('classifies free variants and disables them', () => {
    expect(classifyModelKind('beam-free')).toBe('free')
    expect(classifyModelKind('hy4flash-free')).toBe('free')
    expect(shouldDisableOnMissingCost('free')).toBe(true)
  })

  it('classifies non-chat models by name', () => {
    expect(classifyModelKind('@cf/baai/bge-base-en-v1.5')).toBe('embedding')
    expect(classifyModelKind('nvidia/nv-embedqa-mistral-7b-v2')).toBe('embedding')
    expect(classifyModelKind('@cf/baai/bge-reranker-base')).toBe('rerank')
    expect(classifyModelKind('@cf/black-forest-labs/flux-2-dev')).toBe('image')
    expect(classifyModelKind('gpt-5-image')).toBe('image')
    expect(classifyModelKind('kling-video-v3')).toBe('video')
    expect(classifyModelKind('minimax-video-h3')).toBe('video')
    expect(classifyModelKind('@cf/openai/whisper')).toBe('audio')
    expect(classifyModelKind('@cf/deepgram/flux')).toBe('audio')
    expect(classifyModelKind('mimo-v2.5-asr')).toBe('audio')
    expect(classifyModelKind('nvidia/cosmos-reason2-8b')).toBe('chat')
    expect(classifyModelKind('@cf/meta/m2m100-1.2b')).toBe('translation')
    expect(classifyModelKind('nvidia/llama-3.1-nemoguard-8b-topic-control')).toBe('moderation')
  })

  it('does not disable chat models', () => {
    expect(shouldDisableOnMissingCost(classifyModelKind('deepseek-v4-pro-official'))).toBe(false)
    expect(shouldDisableOnMissingCost(classifyModelKind('hunyuan-2.0-thinking'))).toBe(false)
  })

  it('marks aliases without treating them as non-chat', () => {
    expect(classifyModelKind('auto')).toBe('test_alias')
    expect(classifyModelKind('10598414850')).toBe('opaque')
    expect(classifyModelKind('5101')).toBe('opaque')
    expect(classifyModelKind('sn-glm-5-3')).toBe('partner_alias')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
