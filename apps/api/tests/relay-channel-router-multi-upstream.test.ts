// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * selectChannelCandidates 多上游同模型路由单测(2026-09-13 立)。
 *
 * 覆盖点:
 * - 同一 modelId 在多个 provider/config 上架 → 候选跨上游(token6688 + swiftapi)
 * - key 级 extraMetadata.baseUrl 覆盖 config.baseUrl(多端点各自成渠)
 * - 候选按 keyPoolId 去重(同一 key 属多组只出现一次)
 * - 单 config 上架 → 只有该 provider 的 key 入候选
 * - 全部 config 禁用 → 空候选
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / crypto / quota(对齐 relay-billing-two-phase.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const { mockDbReadSelect, mockCheckQuota, mockDecryptJSON } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockCheckQuota: vi.fn(),
  mockDecryptJSON: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  aiModelConfig: {
    id: 'id',
    providerCode: 'provider_code',
    baseUrl: 'base_url',
    enabled: 'enabled',
  },
  aiModelConfigModels: {
    modelId: 'model_id',
    configId: 'config_id',
    enabled: 'enabled',
    isRelayPublic: 'is_relay_public',
  },
  aiRelayKeyPool: {
    id: 'id',
    apiKeyEnc: 'api_key_enc',
    providerCode: 'provider_code',
    weight: 'weight',
    isEnabled: 'is_enabled',
    extraMetadata: 'extra_metadata',
  },
  aiRelayChannelGroups: {
    id: 'id',
    name: 'name',
    loadBalanceStrategy: 'load_balance_strategy',
    enabled: 'enabled',
    priority: 'priority',
  },
  aiRelayChannelGroupMembers: {
    id: 'id',
    groupId: 'group_id',
    keyPoolId: 'key_pool_id',
    weight: 'weight',
  },
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn(),
  decryptJSON: mockDecryptJSON.mockImplementation((v: unknown) => v),
}))

vi.mock('../src/services/channel-quota-service.js', () => ({
  checkQuota: mockCheckQuota.mockResolvedValue({ allowed: true }),
}))

import {
  selectChannelCandidates,
  stopRelayChannelRouterSweep,
} from '../src/services/relay-channel-router.js'

/** 依次出队的查询结果队列(selectChannelCandidates 内部 5 次顺序查询) */
let queryQueue: unknown[][] = []

beforeEach(() => {
  queryQueue = []
  mockCheckQuota.mockResolvedValue({ allowed: true })
  mockDbReadSelect.mockImplementation(() => {
    const rows = queryQueue.shift() ?? []
    const from = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(Promise.resolve(rows)),
    })
    return { from } as unknown
  })
})

afterAll(() => {
  stopRelayChannelRouterSweep()
})

/** 组装 5 次查询的返回队列 */
function setQueries(
  modelRows: unknown[],
  configs: unknown[],
  keys: unknown[],
  members: unknown[],
  groups: unknown[],
) {
  queryQueue = [modelRows, configs, keys, members, groups]
}

const CONFIG_SWIFT = {
  id: 31,
  providerCode: 'swiftapi',
  baseUrl: 'https://k.swiftapi-base.example/v1',
}
const CONFIG_T6688 = { id: 66, providerCode: 'token6688', baseUrl: 'https://k.token6688.com' }
const KEY_A = {
  id: 'key-a',
  apiKeyEnc: '{"iv":"i","ciphertext":"c","tag":"t"}',
  providerCode: 'swiftapi',
  weight: 5,
  extraMetadata: { baseUrl: 'https://api.x5m5x.com/v1' },
}
const KEY_B = {
  id: 'key-b',
  apiKeyEnc: '{"iv":"i","ciphertext":"c","tag":"t"}',
  providerCode: 'swiftapi',
  weight: 4,
  extraMetadata: {},
}
const KEY_C = {
  id: 'key-c',
  apiKeyEnc: '{"iv":"i","ciphertext":"c","tag":"t"}',
  providerCode: 'token6688',
  weight: 3,
  extraMetadata: null,
}
const GROUP_G1 = {
  id: 'g1',
  name: 'upstream-pool',
  loadBalanceStrategy: 'least-latency',
  priority: 100,
}

describe('selectChannelCandidates 多上游同模型路由', () => {
  it('同一模型多 config 上架 → 候选跨上游,且 key 级 baseUrl 覆盖生效', async () => {
    setQueries(
      [{ configId: 31 }, { configId: 66 }],
      [CONFIG_SWIFT, CONFIG_T6688],
      [KEY_A, KEY_B, KEY_C],
      [
        { memberId: 'm1', groupId: 'g1', keyPoolId: 'key-a', weight: 1 },
        { memberId: 'm2', groupId: 'g1', keyPoolId: 'key-b', weight: 1 },
        { memberId: 'm3', groupId: 'g1', keyPoolId: 'key-c', weight: 1 },
      ],
      [GROUP_G1],
    )
    const candidates = await selectChannelCandidates('glm-5.3-flash', undefined, undefined, 3)
    expect(candidates).toHaveLength(3)
    const byKey = new Map(candidates.map((c) => [c.keyPoolId, c]))
    // key 级覆盖:key-a 用 extraMetadata.baseUrl,而非 config.baseUrl
    expect(byKey.get('key-a')?.baseUrl).toBe('https://api.x5m5x.com/v1')
    // 无覆盖:key-b 回退 config.baseUrl
    expect(byKey.get('key-b')?.baseUrl).toBe('https://k.swiftapi-base.example/v1')
    // 另一上游 token6688 的 key 也成为候选(跨上游择优/切换的基础)
    expect(byKey.get('key-c')?.baseUrl).toBe('https://k.token6688.com')
    expect(byKey.get('key-c')?.providerCode).toBe('token6688')
    // configId 按各自 provider 解析
    expect(byKey.get('key-a')?.configId).toBe('31')
    expect(byKey.get('key-c')?.configId).toBe('66')
  })

  it('候选按 keyPoolId 去重:同一 key 属多组只出现一次', async () => {
    setQueries(
      [{ configId: 31 }, { configId: 66 }],
      [CONFIG_SWIFT, CONFIG_T6688],
      [KEY_A, KEY_C],
      [
        { memberId: 'm1', groupId: 'g1', keyPoolId: 'key-a', weight: 1 },
        { memberId: 'm2', groupId: 'g1', keyPoolId: 'key-c', weight: 1 },
        { memberId: 'm3', groupId: 'g2', keyPoolId: 'key-a', weight: 1 },
      ],
      [GROUP_G1, { id: 'g2', name: 'backup-pool', loadBalanceStrategy: 'weight', priority: 50 }],
    )
    const candidates = await selectChannelCandidates('glm-5.3-flash', undefined, undefined, 5)
    const ids = candidates.map((c) => c.keyPoolId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('key-a')
    expect(ids).toContain('key-c')
  })

  it('仅单 config 上架 → 只有该 provider 的 key 入候选', async () => {
    setQueries(
      [{ configId: 66 }],
      [CONFIG_T6688],
      [KEY_C],
      [{ memberId: 'm3', groupId: 'g1', keyPoolId: 'key-c', weight: 1 }],
      [GROUP_G1],
    )
    const candidates = await selectChannelCandidates('claude-opus-4-8', undefined, undefined, 3)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.keyPoolId).toBe('key-c')
    expect(candidates[0]?.baseUrl).toBe('https://k.token6688.com')
  })

  it('模型无任何上架 → 空候选', async () => {
    setQueries([], [], [], [], [])
    const candidates = await selectChannelCandidates('not-listed', undefined, undefined, 3)
    expect(candidates).toEqual([])
  })

  it('config 全部禁用(查不到启用 config)→ 空候选', async () => {
    setQueries([{ configId: 31 }, { configId: 66 }], [], [], [], [])
    const candidates = await selectChannelCandidates('glm-5.3-flash', undefined, undefined, 3)
    expect(candidates).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
