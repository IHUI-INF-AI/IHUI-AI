// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /admin/relay/account-pool/renewal-capability 只读端点的 handler 测试(2026-10-29 立)。
 *
 * 这张接口只回答一个问题:"这个平台的号池掉了线,调度器能不能自己把它续上?"
 * 测试要钉住的正是它的三条失效方向:
 *  ① 复算:端点自己再写一份"哪些平台不能续期"的名单(必然与适配器注册表漂移);
 *     ⇒ 逐条与唯一判据 `isRefreshableProviderCode` 对账,等值才算绿;
 *  ② 把"适配器没注册"读成"该平台不能续期"(§0.3 不许把没判写成判过)
 *     ⇒ `adapterRegistered` 与 `autoRenewalSupported` 必须是两个独立键;
 *  ③ 注册表整体空转时端点仍返回 200 + 一份"全员都不能续期"的假账
 *     ⇒ 断言可续期数 > 0,且平台全集 = RELAY_PROVIDERS(枚举到 0 判死)。
 * 账号数那一维走 mock 的 group by,顺带钉"库里出现而未登记的平台码必须点名"(不静默丢)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'unit-test-credentials-encryption-key-0123456789ab'
  process.env.NODE_ENV = 'test'
  return {
    counts: [] as { providerCode: string | null; accounts: number }[],
    /** true ⇒ 让号池 group by 抛错,验"取不到输入"这一档不落在 200 上 */
    failCounts: false,
  }
})

vi.mock('../src/db/index.js', () => {
  const chain = (): unknown => ({
    from: () => ({
      groupBy: () =>
        h.failCounts ? Promise.reject(new Error('db down')) : Promise.resolve(h.counts),
    }),
  })
  const root = { select: () => chain() }
  return { db: root, dbRead: root, dbClient: {} }
})

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import { RELAY_PROVIDERS } from '../src/services/relay-account-format.js'
import {
  getRelayAdapter,
  isRefreshableProviderCode,
} from '../src/services/relay-upstream-adapters.js'
import { registerAllRelayAdapters } from '../src/services/upstream-adapters/index.js'
import capabilityRoutes from '../src/routes/admin/relay-account-pool-capability.js'

const URL_PATH = '/admin/relay/account-pool/renewal-capability'

interface CapabilityItem {
  providerCode: string
  adapterRegistered: boolean
  autoRenewalSupported: boolean
  accounts: number
}

async function fetchCapability(): Promise<{
  status: number
  items: CapabilityItem[]
  unlisted: string[]
  summary: {
    providers: number
    adaptersRegistered: number
    autoRenewable: number
    accountsTotal: number
  }
}> {
  const app = Fastify({ logger: false })
  await app.register(capabilityRoutes)
  await app.ready()
  const res = await app.inject({ method: 'GET', url: URL_PATH })
  await app.close()
  const body = res.json()
  return {
    status: res.statusCode,
    items: (body.data?.items ?? []) as CapabilityItem[],
    unlisted: (body.data?.unlistedProviderCodes ?? []) as string[],
    summary: body.data?.summary,
  }
}

beforeEach(() => {
  h.counts = []
  h.failCounts = false
  // 真注册一次:本文件判的就是"真适配器注册表读出来的能力位",不许 mock 掉判据
  registerAllRelayAdapters()
})

describe('续期能力位端点', () => {
  it('能力位逐条等于唯一判据(端点零复算)', async () => {
    const { items } = await fetchCapability()
    expect(items.length).toBe(RELAY_PROVIDERS.length)
    for (const item of items) {
      expect(item.autoRenewalSupported).toBe(isRefreshableProviderCode(item.providerCode))
      expect(item.adapterRegistered).toBe(getRelayAdapter(item.providerCode) !== null)
    }
  })

  it('12 个平台全部注册到位(枚举到 0 判死:少一枚就是面板在读空表)', async () => {
    const { summary, items } = await fetchCapability()
    expect(items.every((i) => i.adapterRegistered)).toBe(true)
    expect(summary.adaptersRegistered).toBe(RELAY_PROVIDERS.length)
    expect(summary.providers).toBe(RELAY_PROVIDERS.length)
  })

  it('无续期通道的平台判 false:codex/opencode/minimax/zcode/lingma/grokbot 无 refreshToken 方法,doubao/loomy 是显式 false 空壳', async () => {
    const { items } = await fetchCapability()
    const byCode = new Map(items.map((i) => [i.providerCode, i]))
    for (const code of [
      'codex',
      'opencode',
      'minimax',
      'zcode',
      'lingma',
      'grokbot',
      'doubao',
      'loomy',
    ]) {
      expect(byCode.get(code)?.adapterRegistered, `${code} 适配器应已注册`).toBe(true)
      expect(byCode.get(code)?.autoRenewalSupported, `${code} 不该被标成可自动续期`).toBe(false)
    }
  })

  it('有续期通道的平台判 true(反向对照:整表恒 false 的假账过不了这一条)', async () => {
    const { items } = await fetchCapability()
    const renewable = items.filter((i) => i.autoRenewalSupported).map((i) => i.providerCode)
    for (const code of ['trae', 'qoder', 'codearts', 'workbuddy']) {
      expect(renewable, `可续期集合应含 ${code}`).toContain(code)
    }
  })

  it('账号数按 group by 归位;库里未登记的平台码必须点名,不静默丢', async () => {
    h.counts = [
      { providerCode: 'trae', accounts: 3 },
      { providerCode: 'loomy', accounts: 5 },
      { providerCode: 'legacybot', accounts: 2 },
      { providerCode: null, accounts: 1 },
    ]
    const { items, unlisted, summary } = await fetchCapability()
    const byCode = new Map(items.map((i) => [i.providerCode, i]))
    expect(byCode.get('trae')?.accounts).toBe(3)
    expect(byCode.get('loomy')?.accounts).toBe(5)
    expect(byCode.get('codex')?.accounts).toBe(0)
    expect(unlisted).toEqual(['legacybot'])
    // 体量读数含未登记行与 NULL 行(不因为面板看不到就把它们从账上抹掉)
    expect(summary.accountsTotal).toBe(11)
  })

  it('号池分布取不到 ⇒ 500 点名,不返回 200 空清单', async () => {
    h.failCounts = true
    const app = Fastify({ logger: false })
    await app.register(capabilityRoutes)
    await app.ready()
    const res = await app.inject({ method: 'GET', url: URL_PATH })
    await app.close()
    expect(res.statusCode).toBe(500)
    expect(res.json().message).toContain('号池平台分布')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
