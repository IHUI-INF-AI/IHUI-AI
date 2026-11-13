// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-179 回归锁(2026-11-13)。
 *
 * 病灶:selectChannelCandidates 的 pushCandidate 直接 decryptApiKey(keyData.apiKeyEnc),
 * 单个 Key 的 api_key_enc 损坏/密钥轮换即抛错,整条模型渠道路由失败(全部候选丢失),
 * 与账号池侧"逐账号 try/catch 跳过坏凭据"的隔离粒度不一致。
 *
 * 本文件锁:
 *   ① 一个 Key 解密抛错 + 另一个正常 → 请求仍能选到正常 Key(坏 Key 只淘汰自己);
 *   ② 全部可用 Key 都解密失败 → 整体失败,错误信息说明「无可用候选」且不含密文/明文;
 *   ③ 非解密类异常(如查询 DB 抛错)仍向上抛,不被隔离逻辑吞掉。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / crypto / quota(对齐
 * relay-channel-router-multi-upstream.test.ts),不触达真实 PG / Redis。
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
    tempUnschedulable: 'temp_unschedulable',
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
  decryptJSON: mockDecryptJSON,
}))

vi.mock('../src/services/channel-quota-service.js', () => ({
  checkQuota: mockCheckQuota.mockResolvedValue({ allowed: true }),
}))

import {
  selectChannelCandidates,
  stopRelayChannelRouterSweep,
} from '../src/services/relay-channel-router.js'

/** 正常 Key 解密后的明文(断言错误/日志不得外泄)。 */
const GOOD_PLAINTEXT = 'sk-f179-good-plaintext'
/** 坏 Key 的密文片段(mock 的异常 message 故意带上它,用于锁"不得外泄")。 */
const BROKEN_CIPHERTEXT = 'f179-broken-ciphertext'

const CONFIG = { id: 31, providerCode: 'swiftapi', baseUrl: 'https://api.example.com/v1' }
const GROUP = { id: 'g1', name: 'pool', loadBalanceStrategy: 'weight', priority: 100 }

const enc = (ciphertext: string): string => JSON.stringify({ iv: 'i', ciphertext, tag: 't' })

const KEY_BAD = {
  id: 'key-bad',
  apiKeyEnc: enc(BROKEN_CIPHERTEXT),
  providerCode: 'swiftapi',
  weight: 5,
  extraMetadata: {},
}
const KEY_GOOD = {
  id: 'key-good',
  apiKeyEnc: enc('good-ciphertext'),
  providerCode: 'swiftapi',
  weight: 1,
  extraMetadata: {},
}

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

/** 依次出队的查询结果;Error 项表示该次查询直接 reject(模拟 DB 故障)。 */
let queryQueue: Array<unknown[] | Error> = []

function setQueries(
  modelRows: unknown[],
  configs: unknown[],
  keys: unknown[],
  members: unknown[],
  groups: unknown[],
): void {
  queryQueue = [modelRows, configs, keys, members, groups]
}

beforeEach(() => {
  queryQueue = []
  warnSpy.mockClear()
  mockCheckQuota.mockResolvedValue({ allowed: true })
  mockDecryptJSON.mockReset()
  // 坏密文解密抛错,且异常 message 故意带密文片段(锁实现不得把 message/密文写进日志或错误)
  mockDecryptJSON.mockImplementation((payload: unknown) => {
    const ciphertext = (payload as { ciphertext?: string } | null)?.ciphertext
    if (ciphertext === BROKEN_CIPHERTEXT) {
      throw new Error(`decrypt failed: ${BROKEN_CIPHERTEXT}`)
    }
    return GOOD_PLAINTEXT
  })
  mockDbReadSelect.mockImplementation(() => {
    const next = queryQueue.shift()
    const from = vi.fn().mockReturnValue({
      where: vi
        .fn()
        .mockReturnValue(
          next instanceof Error ? Promise.reject(next) : Promise.resolve(next ?? []),
        ),
    })
    return { from } as unknown
  })
})

afterAll(() => {
  warnSpy.mockRestore()
  stopRelayChannelRouterSweep()
})

describe('F-179 单个 Key 解密失败必须隔离在该条候选内', () => {
  it('① 一个 Key 解密抛错 + 另一个正常 → 仍选到正常 Key,坏 Key 只被跳过', async () => {
    setQueries(
      [{ configId: 31 }],
      [CONFIG],
      [KEY_BAD, KEY_GOOD],
      [
        { memberId: 'm1', groupId: 'g1', keyPoolId: 'key-bad', weight: 5 },
        { memberId: 'm2', groupId: 'g1', keyPoolId: 'key-good', weight: 1 },
      ],
      [GROUP],
    )

    const candidates = await selectChannelCandidates('glm-5.3-flash', undefined, undefined, 3)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.keyPoolId).toBe('key-good')
    expect(candidates[0]?.apiKey).toBe(GOOD_PLAINTEXT)
    expect(candidates.some((c) => c.keyPoolId === 'key-bad')).toBe(false)

    // 留痕:带 keyPoolId,不带密文/明文
    const warned = warnSpy.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
    expect(warned).toContain('key-bad')
    expect(warned).not.toContain(BROKEN_CIPHERTEXT)
    expect(warned).not.toContain(GOOD_PLAINTEXT)
  })

  it('② 全部可用 Key 都解密失败 → 整体失败,错误信息为「无可用候选」且不含密文', async () => {
    setQueries(
      [{ configId: 31 }],
      [CONFIG],
      [KEY_BAD, { ...KEY_BAD, id: 'key-bad-2', weight: 3 }],
      [
        { memberId: 'm1', groupId: 'g1', keyPoolId: 'key-bad', weight: 5 },
        { memberId: 'm2', groupId: 'g1', keyPoolId: 'key-bad-2', weight: 3 },
      ],
      [GROUP],
    )

    const err = await selectChannelCandidates('glm-5.3-flash', undefined, undefined, 3).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(Error)
    const message = (err as Error).message
    expect(message).toContain('无可用候选')
    expect(message).not.toContain(BROKEN_CIPHERTEXT)
    expect(message).not.toContain(GOOD_PLAINTEXT)
    // 两个坏 Key 各留痕一次
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  it('③ 非解密类异常(查询 DB 抛错)仍向上抛,不被隔离逻辑吞掉', async () => {
    const dbError = new Error('db unavailable')
    queryQueue = [dbError]

    await expect(selectChannelCandidates('glm-5.3-flash', undefined, undefined, 3)).rejects.toBe(
      dbError,
    )
  })
})
