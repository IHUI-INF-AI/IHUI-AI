// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  buildUsageFromPromptCompletion,
  buildUsageFromUpdate,
  buildUsageKey,
  isContextCompressionPrompt,
  recordPositiveUsageUpdate,
  resolveContextDenominatorModel,
} from './usage-fallback'

describe('usage-fallback(G-977988 used=0 假值守卫 + task_complete 弱 fallback)', () => {
  it('正数 → 0(非压缩轮)保留上一个正数,防上下文占用闪断', () => {
    const result = buildUsageFromUpdate({
      currentUsage: { used: 42000, size: 128000 },
      incomingUsage: { used: 0, size: 128000 },
      latestUserPrompt: '继续改这个文件',
    })
    expect(result).toEqual({ used: 42000, size: 128000 })
  })

  it('正数 → 0(/compact //compress 压缩轮)接受 0:压缩后真的归零重算', () => {
    const compact = buildUsageFromUpdate({
      currentUsage: { used: 42000, size: 128000 },
      incomingUsage: { used: 0, size: 128000 },
      latestUserPrompt: '/compact 保留要点',
    })
    expect(compact).toEqual({ used: 0, size: 128000 })
    const compress = buildUsageFromUpdate({
      currentUsage: { used: 42000, size: 128000 },
      incomingUsage: { used: 0, size: 128000 },
      latestUserPrompt: '/compress',
    })
    expect(compress.used).toBe(0)
  })

  it('压缩轮识别:精确命令或带参前缀命中,普通斜杠命令不误判', () => {
    expect(isContextCompressionPrompt('/compact')).toBe(true)
    expect(isContextCompressionPrompt('/compact ')).toBe(true)
    expect(isContextCompressionPrompt('/compact 精简')).toBe(true)
    expect(isContextCompressionPrompt('/compress')).toBe(true)
    expect(isContextCompressionPrompt('/compress foo')).toBe(true)
    expect(isContextCompressionPrompt('/compactify')).toBe(false)
    expect(isContextCompressionPrompt('/clear')).toBe(false)
    expect(isContextCompressionPrompt('帮我 /compact 一下')).toBe(false)
    expect(isContextCompressionPrompt(null)).toBe(false)
  })

  it('breakdown 在 used/size 全等时保留旧值;used 变化则随新包走', () => {
    const breakdown = { system: 1200, tools: 800 }
    const retained = buildUsageFromUpdate({
      currentUsage: { used: 42000, size: 128000, breakdown },
      incomingUsage: { used: 42000, size: 128000 },
    })
    expect(retained.breakdown).toEqual(breakdown)

    const replaced = buildUsageFromUpdate({
      currentUsage: { used: 42000, size: 128000, breakdown },
      incomingUsage: { used: 45000, size: 128000 },
    })
    expect(replaced.used).toBe(45000)
    expect(replaced.breakdown).toBeUndefined()
  })

  it('无正数 usage_update 时 task_complete.totalTokens 可作弱 fallback', () => {
    const keys = new Set<string>()
    const key = buildUsageKey({ workspacePath: '/w', workspaceIdentity: 'ssh-a', taskId: 't1' })
    const result = buildUsageFromPromptCompletion({
      currentUsage: { used: 0, size: 128000 },
      totalTokens: 3000,
      hasPositiveUsageUpdate: keys.has(key),
    })
    expect(result).toEqual({ used: 3000, size: 128000 })
  })

  it('收到过正数 usage_update 的键不采信 task_complete.usage', () => {
    const keys = new Set<string>()
    const params = { workspacePath: '/w', workspaceIdentity: 'ssh-a', taskId: 't1' }
    recordPositiveUsageUpdate(keys, { ...params, used: 42000, size: 128000 })
    // used=0 的瞬时假值不登记
    recordPositiveUsageUpdate(keys, { ...params, used: 0, size: 128000 })
    expect(keys.has(buildUsageKey(params))).toBe(true)

    const result = buildUsageFromPromptCompletion({
      currentUsage: { used: 42000, size: 128000 },
      totalTokens: 3000,
      hasPositiveUsageUpdate: keys.has(buildUsageKey(params)),
    })
    // 它是 prompt 统计不是窗口快照,不得覆盖真实 context used
    expect(result).toBeNull()
  })

  it('contextWindow 缺席用 currentUsage.size 兜底;显式窗口优先生效;封顶防溢出', () => {
    // 缺席 → currentUsage.size
    const fromCurrent = buildUsageFromPromptCompletion({
      currentUsage: { used: 1000, size: 128000 },
      currentContextWindow: null,
      totalTokens: 60000,
      hasPositiveUsageUpdate: false,
    })
    expect(fromCurrent).toEqual({ used: 60000, size: 128000 })
    // 显式窗口优先
    const explicit = buildUsageFromPromptCompletion({
      currentUsage: { used: 1000, size: 128000 },
      currentContextWindow: 200000,
      totalTokens: 60000,
      hasPositiveUsageUpdate: false,
    })
    expect(explicit).toEqual({ used: 60000, size: 200000 })
    // totalTokens 超窗时封顶
    const capped = buildUsageFromPromptCompletion({
      currentUsage: { used: 0, size: 128000 },
      totalTokens: 999999,
      hasPositiveUsageUpdate: false,
    })
    expect(capped).toEqual({ used: 128000, size: 128000 })
    // 无窗口可依 → 无 fallback
    expect(
      buildUsageFromPromptCompletion({
        currentUsage: null,
        totalTokens: 3000,
        hasPositiveUsageUpdate: false,
      }),
    ).toBeNull()
    // 无正数 totalTokens → 无 fallback
    expect(
      buildUsageFromPromptCompletion({
        currentUsage: { used: 0, size: 128000 },
        totalTokens: 0,
        hasPositiveUsageUpdate: false,
      }),
    ).toBeNull()
  })

  it('任务键:identity 缺席回退 workspacePath,键三元组隔离', () => {
    expect(buildUsageKey({ workspacePath: '/w', taskId: 't1' })).toBe('/w::/w::t1')
    expect(buildUsageKey({ workspacePath: '/w', workspaceIdentity: '  ', taskId: 't1' })).toBe(
      '/w::/w::t1',
    )
    expect(
      buildUsageKey({ workspacePath: '/w', workspaceIdentity: 'ssh-a', taskId: 't1' }),
    ).toBe('/w::ssh-a::t1')
    expect(buildUsageKey({ workspacePath: '/w', taskId: 't1' })).not.toBe(
      buildUsageKey({ workspacePath: '/w', taskId: 't2' }),
    )
  })
})

// G-1101879:上下文分母的"模型来源"—— 用量帧回带的 model 优先(后端 model=='auto'
// 自动路由会让会话当前选中模型与实际窗口不一致),缺席才回落会话模型。
describe('usage-fallback(resolveContextDenominatorModel,G-1101879)', () => {
  it('用量帧回带的 model 优先于会话当前模型', () => {
    expect(
      resolveContextDenominatorModel({ usageModel: 'gemini-2.5-pro', sessionModel: 'auto' }),
    ).toBe('gemini-2.5-pro')
  })

  it('用量帧缺席/空串 → 回落会话当前模型', () => {
    expect(resolveContextDenominatorModel({ sessionModel: 'gpt-4o-mini' })).toBe('gpt-4o-mini')
    expect(resolveContextDenominatorModel({ usageModel: '', sessionModel: 'gpt-4o-mini' })).toBe(
      'gpt-4o-mini',
    )
    expect(
      resolveContextDenominatorModel({ usageModel: '   ', sessionModel: 'gpt-4o-mini' }),
    ).toBe('gpt-4o-mini')
    expect(resolveContextDenominatorModel({ usageModel: null, sessionModel: null })).toBe('')
  })

  it('两端都缺席 → 空串(由容量出口自行兜底,不凭空造一个模型)', () => {
    expect(resolveContextDenominatorModel({})).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
