// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, beforeEach } from 'vitest'

import {
  getSamplingParams,
  hasAnySamplingParam,
  resolveSamplingParams,
  useSamplingParamsStore,
} from '../sampling-params'

describe('useSamplingParamsStore (P1-7 高级参数)', () => {
  beforeEach(() => {
    useSamplingParamsStore.setState({ defaults: {}, byConversation: {} })
  })

  it('初始状态为空(= 全部使用模型默认)', () => {
    const s = useSamplingParamsStore.getState()
    expect(s.defaults).toEqual({})
    expect(s.byConversation).toEqual({})
    expect(hasAnySamplingParam(resolveSamplingParams(s.defaults, s.byConversation, 'c1'))).toBe(
      false,
    )
  })

  it('无会话时写入落到全局默认', () => {
    useSamplingParamsStore.getState().setParam(null, 'temperature', 0.3)
    useSamplingParamsStore.getState().setParam(undefined, 'systemPrompt', '先给结论')
    const s = useSamplingParamsStore.getState()
    expect(s.defaults).toEqual({ temperature: 0.3, systemPrompt: '先给结论' })
    expect(s.byConversation).toEqual({})
  })

  it('有会话时写入落到会话覆盖,不影响全局默认', () => {
    useSamplingParamsStore.getState().setParam('c1', 'topP', 0.9)
    useSamplingParamsStore.getState().setParam('c1', 'topK', 40)
    const s = useSamplingParamsStore.getState()
    expect(s.defaults).toEqual({})
    expect(s.byConversation.c1).toEqual({ topP: 0.9, topK: 40 })
  })

  it('会话覆盖优先于全局默认(合并解析)', () => {
    useSamplingParamsStore.getState().setParam(null, 'temperature', 0.7)
    useSamplingParamsStore.getState().setParam(null, 'maxTokens', 4096)
    useSamplingParamsStore.getState().setParam('c1', 'temperature', 0.1)

    const merged = getSamplingParams('c1')
    expect(merged.temperature).toBe(0.1) // 会话覆盖
    expect(merged.maxTokens).toBe(4096) // 回落全局默认
    // 未自定义的会话拿全局默认
    expect(getSamplingParams('c2').temperature).toBe(0.7)
  })

  it('清除单个参数:delete 而非置 undefined(不遮蔽全局默认)', () => {
    useSamplingParamsStore.getState().setParam(null, 'temperature', 0.7)
    useSamplingParamsStore.getState().setParam('c1', 'temperature', 0.1)
    useSamplingParamsStore.getState().setParam('c1', 'temperature', undefined)

    // 会话覆盖清空后整条移除,回落全局默认(而不是被 undefined 遮蔽)
    expect(useSamplingParamsStore.getState().byConversation.c1).toBeUndefined()
    expect(getSamplingParams('c1').temperature).toBe(0.7)
  })

  it('空字符串/NaN 视为未设置', () => {
    useSamplingParamsStore.getState().setParam('c1', 'systemPrompt', '')
    expect(useSamplingParamsStore.getState().byConversation.c1).toBeUndefined()
    useSamplingParamsStore.getState().setParam('c1', 'temperature', Number.NaN)
    expect(useSamplingParamsStore.getState().byConversation.c1).toBeUndefined()
  })

  it('promoteToDefaults 把会话参数提升为全局默认并清除会话覆盖', () => {
    useSamplingParamsStore.getState().setParam(null, 'maxTokens', 2048)
    useSamplingParamsStore.getState().setParam('c1', 'temperature', 0.2)
    useSamplingParamsStore.getState().promoteToDefaults('c1')

    const s = useSamplingParamsStore.getState()
    expect(s.defaults).toEqual({ maxTokens: 2048, temperature: 0.2 })
    expect(s.byConversation.c1).toBeUndefined()
  })

  it('clearConversation / resetDefaults 回到模型默认', () => {
    useSamplingParamsStore.getState().setParam(null, 'temperature', 0.5)
    useSamplingParamsStore.getState().setParam('c1', 'topP', 0.5)
    useSamplingParamsStore.getState().clearConversation('c1')
    expect(useSamplingParamsStore.getState().byConversation).toEqual({})

    useSamplingParamsStore.getState().resetDefaults()
    expect(useSamplingParamsStore.getState().defaults).toEqual({})
  })

  it('resolveSamplingParams 纯函数:会话为空时原样返回默认', () => {
    expect(resolveSamplingParams({ topK: 10 }, {}, null)).toEqual({ topK: 10 })
    expect(resolveSamplingParams({ topK: 10 }, { c1: { topK: 99 } }, 'c1')).toEqual({ topK: 99 })
  })
})
