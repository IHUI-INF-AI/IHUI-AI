// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { OFFICIAL_MODEL_NAMES, normalizeModelId, toOfficialModelName } from '../model-names'

describe('normalizeModelId(写入侧/计费侧强归一)', () => {
  it('已知家族归一到官方书写形式(大小写不敏感)', () => {
    expect(normalizeModelId('MiniMax-M3')).toBe('MiniMax-M3')
    expect(normalizeModelId('minimax-m3')).toBe('MiniMax-M3')
    expect(normalizeModelId('MINIMAX-M3')).toBe('MiniMax-M3')
    expect(normalizeModelId('  MiniMax-M2.7-highspeed  ')).toBe('MiniMax-M2.7-highspeed')
    expect(normalizeModelId('auto-model')).toBe('Auto-Model')
  })

  it('未知家族统一归一小写(与 ai_pricing 口径一致)', () => {
    expect(normalizeModelId('GPT-4o')).toBe('gpt-4o')
    expect(normalizeModelId('DeepSeek-V4-Pro')).toBe('deepseek-v4-pro')
  })

  it('带厂商前缀时前缀原样保留、仅归一后段', () => {
    expect(normalizeModelId('deepseek/deepseek-v4')).toBe('deepseek/deepseek-v4')
    expect(normalizeModelId('openrouter/minimax-m3')).toBe('openrouter/MiniMax-M3')
  })

  it('空串/空白原样返回', () => {
    expect(normalizeModelId('')).toBe('')
    expect(normalizeModelId('   ')).toBe('')
  })
})

describe('toOfficialModelName(入站转发侧保守改写)', () => {
  it('命中官方名映射表才改写', () => {
    expect(toOfficialModelName('minimax-m3')).toBe('MiniMax-M3')
    expect(toOfficialModelName('MiniMax-M3')).toBe('MiniMax-M3')
    expect(toOfficialModelName('AUTO-MODEL')).toBe('Auto-Model')
  })

  it('未命中映射表时原样返回(不改变未知模型的上游契约)', () => {
    // 关键差异:normalizeModelId 会小写,而本函数保持原样
    expect(toOfficialModelName('GPT-4o')).toBe('GPT-4o')
    expect(toOfficialModelName('glm-5.3-flash')).toBe('glm-5.3-flash')
  })

  it('带厂商前缀时仅改写后段', () => {
    expect(toOfficialModelName('openrouter/minimax-m3')).toBe('openrouter/MiniMax-M3')
    expect(toOfficialModelName('stepfun/step-3.7-flash')).toBe('stepfun/step-3.7-flash')
  })

  it('空串原样返回', () => {
    expect(toOfficialModelName('')).toBe('')
  })
})

describe('官方名映射表', () => {
  it('键均为小写且值非空(保证归一可逆、去重键稳定)', () => {
    for (const [key, value] of Object.entries(OFFICIAL_MODEL_NAMES)) {
      expect(key).toBe(key.toLowerCase())
      expect(value.length).toBeGreaterThan(0)
      expect(value.toLowerCase()).toBe(key)
    }
  })
})
