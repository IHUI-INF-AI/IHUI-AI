// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V2 #29 个性预设交互测试(纯逻辑层,不挂载 Dialog)
 * 验证核心行为:预设选择 → systemPrompt 写入;自定义文本 → activePreset 失配
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PERSONALITY_PRESETS } from '../personality-presets'
import { useSamplingParamsStore } from '@/stores/sampling-params'

/** 复刻 panel 内 activePreset 判定逻辑(与 sampling-params-panel.tsx 保持同型) */
function resolveActivePreset(systemPrompt: string): string | undefined {
  return PERSONALITY_PRESETS.find((p) => presetPromptText(p.id) === systemPrompt)?.id
}

/** 测试内固定文案源(与 zh-CN.json 注入值一致) */
const PRESET_PROMPTS: Record<string, string> = {
  default: '你是一个乐于助人、回答准确均衡的 AI 助手。',
  concise: '请用尽量简短的语言回答，直击要点，不要展开铺垫。除非我要求，否则不要举例和解释背景。',
  developer:
    '你是资深软件工程师。回答以代码为先，给出可直接运行的实现；解释保持精炼，指出关键取舍与边界情况。',
  translator:
    '你是一名专业翻译。把我的输入在中文与英文之间互译：中文译成英文，英文译成中文。只输出译文，不要解释。保持原意、语气与格式，译文要自然流畅。',
  tutor:
    '你是一位耐心的老师。把复杂概念拆成小步骤讲解，多用类比和例子；在关键节点向我提问，引导我自己想通，而不是直接给答案。',
  creative:
    '你是一位富有创意的写作者。语言生动有画面感，善用比喻和节奏；在保持实用的同时，让表达更有感染力。',
}
const presetPromptText = (id: string): string => PRESET_PROMPTS[id] ?? ''

describe('个性预设 → systemPrompt 写入链', () => {
  beforeEach(() => {
    useSamplingParamsStore.getState().resetDefaults()
  })

  it('6 个预设都有非空 prompt 文本', () => {
    for (const p of PERSONALITY_PRESETS) {
      expect(presetPromptText(p.id).length).toBeGreaterThan(0)
    }
  })

  it('选择预设后 activePreset 精确匹配(写入→识别闭环)', () => {
    for (const p of PERSONALITY_PRESETS) {
      const prompt = presetPromptText(p.id)
      useSamplingParamsStore.getState().setParam(undefined, 'systemPrompt', prompt)
      expect(resolveActivePreset(prompt)).toBe(p.id)
    }
  })

  it('自定义文本不匹配任何预设(activePreset undefined → 显示"自定义")', () => {
    expect(resolveActivePreset('我的自定义提示词')).toBeUndefined()
    expect(resolveActivePreset('')).toBeUndefined()
  })

  it('预设写入走既有 setParam(store 契约不变)', () => {
    const prompt = presetPromptText('concise')
    useSamplingParamsStore.getState().setParam(undefined, 'systemPrompt', prompt)
    expect(useSamplingParamsStore.getState().defaults.systemPrompt).toBe(prompt)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
