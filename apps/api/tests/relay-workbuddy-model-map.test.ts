// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 模型目录映射单测(2026-10-23 立)。
 * 锁:前缀不撞车、text-to-image 排除、上下文/输出上限取上游、能力标记落位。
 */
import { describe, it, expect } from 'vitest'
import { __test__ as M } from '../src/services/relay-workbuddy-model-map.js'

const models = [
  {
    id: 'hy3',
    name: 'Hy3',
    maxInputTokens: 192000,
    maxOutputTokens: 64000,
    supportsImages: true,
    supportsToolCall: true,
    supportsReasoning: true,
    onlyReasoning: true,
    tags: ['craft'],
    vendor: 'j',
    reason: 'x',
    reasoning: { effort: 'high' },
  },
  { id: 'default', name: 'Default', maxInputTokens: 200000, maxOutputTokens: 24000, supportsToolCall: true },
  { id: 'hunyuan-image-alpha', name: 'Hunyuan Image Alpha', tags: ['text-to-image'] },
  { id: 'no-meta' },
]

describe('WorkBuddy 模型目录映射', () => {
  it('模型 id 一律加 workbuddy/ 前缀,别名单独映射回上游', () => {
    const rows = M.buildWorkbuddyModelRows(models)
    expect(rows.map((r) => r.modelId)).toEqual(['workbuddy/hy3', 'workbuddy/default', 'workbuddy/no-meta'])
    expect(rows.map((r) => r.upstreamModel)).toEqual(['hy3', 'default', 'no-meta'])
    expect(M.toPoolModelId('glm-5.3')).toBe('workbuddy/glm-5.3')
  })

  it('text-to-image 模型必须排除(账号池只支持 chat)', () => {
    const rows = M.buildWorkbuddyModelRows(models)
    expect(rows.some((r) => r.upstreamModel === 'hunyuan-image-alpha')).toBe(false)
    expect(M.isChatCapableModel({ id: 'x', tags: ['text-to-image'] })).toBe(false)
    expect(M.isChatCapableModel({ id: 'x', tags: [] })).toBe(true)
  })

  it('上下文/输出上限/工具/视觉取上游元数据;缺省兜底 32000 与 null', () => {
    const rows = M.buildWorkbuddyModelRows(models)
    const hy3 = rows.find((r) => r.upstreamModel === 'hy3')!
    expect(hy3.contextLength).toBe(192000)
    expect(hy3.maxOutputTokens).toBe(64000)
    expect(hy3.supportsToolCall).toBe(true)
    expect(hy3.supportsVision).toBe(true)
    expect(hy3.tags).toEqual(expect.arrayContaining(['craft', 'reasoning', 'reasoning-only', 'workbuddy']))
    expect(hy3.metadata).toMatchObject({ workbuddy: { upstreamModel: 'hy3', reasoning: { effort: 'high' } } })
    expect(hy3.displayName).toBe('Hy3')

    const bare = rows.find((r) => r.upstreamModel === 'no-meta')!
    expect(bare.contextLength).toBe(32000)
    expect(bare.maxOutputTokens).toBeNull()
    expect(bare.supportsToolCall).toBe(false)
    expect(bare.supportsVision).toBe(false)
  })

  it('显式排除清单与排序序号可控', () => {
    const rows = M.buildWorkbuddyModelRows(models, { excludeIds: ['default'], startSortOrder: 10 })
    expect(rows.map((r) => r.upstreamModel)).toEqual(['hy3', 'no-meta'])
    expect(rows.map((r) => r.sortOrder)).toEqual([10, 11])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
