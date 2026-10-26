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
  {
    id: 'default',
    name: 'Default',
    maxInputTokens: 200000,
    maxOutputTokens: 24000,
    supportsToolCall: true,
  },
  { id: 'hunyuan-image-alpha', name: 'Hunyuan Image Alpha', tags: ['text-to-image'] },
  { id: 'no-meta' },
]

describe('WorkBuddy 模型目录映射', () => {
  it('模型 id 一律加 workbuddy/ 前缀,别名单独映射回上游', () => {
    const rows = M.buildWorkbuddyModelRows(models)
    expect(rows.map((r) => r.modelId)).toEqual([
      'workbuddy/hy3',
      'workbuddy/default',
      'workbuddy/no-meta',
    ])
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
    expect(hy3.tags).toEqual(
      expect.arrayContaining(['craft', 'reasoning', 'reasoning-only', 'workbuddy']),
    )
    expect(hy3.metadata).toMatchObject({
      workbuddy: { upstreamModel: 'hy3', reasoning: { effort: 'high' } },
    })
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

const REG_ROW = {
  schema: 1,
  providerCode: 'workbuddy',
  configName: 'WorkBuddy 账号池(反代)',
  baseUrl: 'https://workbuddy.example.cn',
  apiFormat: 'openai_chat',
  enabled: true,
  isRelayPublic: false,
  models: [{ alias: 'workbuddy/hy3', upstreamModel: 'hy3', displayName: 'Hy3' }],
  reason: '单源口径锁:登记字段只认这一行',
}
const REG = JSON.stringify(REG_ROW)

describe('登记字段单源(parseWorkbuddyRegistration)', () => {
  it('合法行 ⇒ 契约逐字段取登记表,不回落硬编码', () => {
    const r = M.parseWorkbuddyRegistration(REG)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.contract).toMatchObject({
      providerCode: 'workbuddy',
      configName: 'WorkBuddy 账号池(反代)',
      baseUrl: 'https://workbuddy.example.cn',
      apiFormat: 'openai_chat',
      enabled: true,
      isRelayPublic: false,
    })
  })

  it('无本 provider 行 ⇒ 拒写并点名出路(失效方向 = 未判定)', () => {
    const r = M.parseWorkbuddyRegistration(JSON.stringify({ providerCode: 'qoder' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.why).toContain('无 providerCode=workbuddy 登记行')
    expect(r.why).toContain('先按登记器口径登记')
  })

  it('重复行 / 非法 JSON / 缺字段 一律不猜', () => {
    const dup = M.parseWorkbuddyRegistration(`${REG}\n${REG}`)
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.why).toContain('2 枚登记行')

    const bad = M.parseWorkbuddyRegistration('{not json}')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.why).toContain('不是合法 JSON')

    const noName = M.parseWorkbuddyRegistration(JSON.stringify({ ...REG_ROW, configName: '' }))
    expect(noName.ok).toBe(false)
    if (!noName.ok) expect(noName.why).toContain('configName')
  })
})

describe('落库语句与登记器同键(build*Statements)', () => {
  const contract = {
    providerCode: 'workbuddy',
    configName: 'N',
    baseUrl: 'https://b',
    apiFormat: 'openai_chat',
    enabled: true,
    isRelayPublic: false,
  }
  const display = { description: 'd', providerGroup: 'workbuddy', groupLabel: 'WorkBuddy 账号池' }
  const row = {
    modelId: 'workbuddy/hy3',
    upstreamModel: 'hy3',
    displayName: 'Hy3',
    contextLength: 1,
    maxOutputTokens: null,
    supportsToolCall: false,
    supportsVision: false,
    tags: ['workbuddy'],
    vendor: null,
    description: null,
    sortOrder: 0,
    metadata: {},
  }

  it('配置行匹配键 = (provider_code, base_url, owner_uuid is null)', () => {
    const s = M.buildConfigMatchStatement(contract)
    expect(s.sql).toContain('owner_uuid is null')
    expect(s.params).toEqual(['workbuddy', 'https://b'])
  })

  it('update 档不覆盖 base_url/description,共享字段取登记表', () => {
    const s = M.buildConfigSyncStatements(contract, display, 7)
    expect(s.sql).not.toContain('base_url=')
    expect(s.sql).not.toContain('description=')
    expect(s.params.slice(0, 3)).toEqual(['N', 'openai_chat', true])
    expect(s.params).toContain(7)
  })

  it('insert 档才写 base_url/description(动态侧自有展示列)', () => {
    const s = M.buildConfigSyncStatements(contract, display, null)
    expect(s.sql).toContain('insert into ai_model_config')
    expect(s.params).toContain('https://b')
    expect(s.params).toContain('d')
  })

  it('模型行 enabled/is_relay_public 取登记表档位,不取硬编码', () => {
    const upd = M.buildModelSyncStatements(contract, 1, row, 9)
    expect(upd.params[3]).toBe(true)
    expect(upd.params[4]).toBe(false)
    expect(upd.params.at(-1)).toBe(9)
    const ins = M.buildModelSyncStatements(contract, 1, row, null)
    expect(ins.params[5]).toBe(true)
    expect(ins.params[6]).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
