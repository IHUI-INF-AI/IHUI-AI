// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-health-check-service 禁用 key 恢复探测单测(2026-09-13 立)。
 *
 * 覆盖点:
 * - 禁用 key 探测 healthy → is_enabled=true + consecutiveFailures 重置 0(recovered 计数)
 * - 禁用 key 探测仍 down → 保持禁用,仅刷新健康信息
 * - enabled key 正常巡检不受恢复探测影响
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / crypto(对齐 relay-channel-router-multi-upstream.test.ts),
 * mock global.fetch 模拟上游 /models 端点。测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbReadSelect, mockDbUpdate, mockDecryptJSON, mockFetch } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDecryptJSON: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: mockDbUpdate },
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
  aiRelayKeyPool: {
    id: 'id',
    apiKeyEnc: 'api_key_enc',
    providerCode: 'provider_code',
    weight: 'weight',
    isEnabled: 'is_enabled',
    healthStatus: 'health_status',
    healthCheckedAt: 'health_checked_at',
    lastErrorMessage: 'last_error_message',
    extraMetadata: 'extra_metadata',
    updatedAt: 'updated_at',
  },
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn(),
  decryptJSON: mockDecryptJSON.mockImplementation((v: unknown) => v),
}))

global.fetch = mockFetch as unknown as typeof fetch

import { checkAllKeys } from '../src/services/relay-health-check-service.js'

interface RowSpec {
  id: string
  plainKey: string
  upstreamStatus: number
}

/** 构造 key 池行(解密直通:apiKeyEnc 即 JSON 字符串形式的明文 key)。 */
function makeRow(spec: RowSpec, isEnabled: boolean) {
  return {
    id: spec.id,
    providerCode: 'swiftapi',
    apiKeyEnc: JSON.stringify(spec.plainKey),
    extraMetadata: { consecutiveFailures: isEnabled ? 0 : 3 },
    isEnabled,
  }
}

/** dbRead.select 链式 builder:按调用顺序吐出 rowsSets。 */
function stubSelectReads(rowsSets: unknown[][]) {
  let call = 0
  mockDbReadSelect.mockImplementation(() => {
    const rows = rowsSets[Math.min(call++, rowsSets.length - 1)]
    const builder: Record<string, unknown> = {}
    builder.from = vi.fn(() => builder)
    builder.where = vi.fn(() => builder)
    builder.limit = vi.fn(() => Promise.resolve(rows))
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve)
    return builder
  })
}

function stubUpdateCapture() {
  const updates: Array<Record<string, unknown>> = []
  mockDbUpdate.mockImplementation(() => ({
    set: (s: Record<string, unknown>) => {
      updates.push(s)
      return { where: vi.fn(() => Promise.resolve()) }
    },
  }))
  return updates
}

/** fetch 按 Bearer key 内容返回指定状态码。 */
function stubUpstreamBy(specs: RowSpec[]) {
  mockFetch.mockImplementation(async (_url: unknown, init: { headers: Record<string, string> }) => {
    const auth = String(init.headers['Authorization'] ?? '')
    const hit = specs.find((s) => auth.includes(s.plainKey))
    return { status: hit?.upstreamStatus ?? 500 }
  })
}

const BASE_URL_ROW = [{ baseUrl: 'https://api.example.com' }]

describe('relay-health-check 禁用 key 恢复探测', () => {
  beforeEach(() => {
    mockDecryptJSON.mockClear()
    mockDbUpdate.mockReset()
  })

  it('禁用 key 探测 healthy → 恢复 is_enabled=true 并计数 recovered', async () => {
    const recoverable: RowSpec = { id: 'key-recover', plainKey: 'recover-key', upstreamStatus: 200 }
    // dbRead.select 调用序:①enabled keys(checkAllKeys) ②disabled keys(recover) ③base_url(runHealthCheck)
    stubSelectReads([[], [makeRow(recoverable, false)], BASE_URL_ROW])
    stubUpstreamBy([recoverable])
    const updates = stubUpdateCapture()

    const summary = await checkAllKeys()

    expect(summary.recovered).toBe(1)
    expect(summary.total).toBe(0)
    const restore = updates.find((u) => u['isEnabled'] === true)
    expect(restore).toBeDefined()
    expect(restore?.['healthStatus']).toBe('healthy')
    expect((restore?.['extraMetadata'] as Record<string, unknown>)['consecutiveFailures']).toBe(0)
    expect(restore?.['lastErrorMessage']).toBeNull()
  })

  it('禁用 key 探测仍失效 → 保持禁用,仅刷新健康信息', async () => {
    const dead: RowSpec = { id: 'key-dead', plainKey: 'dead-key', upstreamStatus: 401 }
    stubSelectReads([[], [makeRow(dead, false)], BASE_URL_ROW])
    stubUpstreamBy([dead])
    const updates = stubUpdateCapture()

    const summary = await checkAllKeys()

    expect(summary.recovered).toBe(0)
    expect(updates.some((u) => u['isEnabled'] === true)).toBe(false)
    const refresh = updates[0]
    expect(refresh).toBeDefined()
    expect(refresh?.['healthStatus']).toBe('down')
    expect(refresh?.['isEnabled']).toBeUndefined()
  })

  it('enabled key 正常巡检 + 禁用 key 恢复互不干扰', async () => {
    const active: RowSpec = { id: 'key-active', plainKey: 'active-key', upstreamStatus: 429 }
    const recoverable: RowSpec = {
      id: 'key-recover2',
      plainKey: 'recover-key2',
      upstreamStatus: 200,
    }
    stubSelectReads([
      [makeRow(active, true)],
      BASE_URL_ROW,
      [makeRow(recoverable, false)],
      BASE_URL_ROW,
    ])
    stubUpstreamBy([active, recoverable])
    stubUpdateCapture()

    const summary = await checkAllKeys()

    expect(summary.total).toBe(1)
    expect(summary.degraded).toBe(1)
    expect(summary.recovered).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
