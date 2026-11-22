// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天 auto 号池决策腿的 IO 壳测试(2026-11-23 加固时立)。
 *
 * 与 tests/chat-auto-resolve.test.ts 的分工:那份只钉纯判据(合法化/选型),
 * 这份钉**壳层的失效方向**:
 *   - 候选为空 ⇒ 一次 IO 都不发(不白跑);
 *   - 越权候选 ⇒ 不发复杂度票;
 *   - 票失败 / 查库异常 / 超预算 ⇒ 一律 platform(绝不挡发送);
 *   - 复杂任务的代次判定必须尊重 hidden(不能被一个已落档的模型骗过去)。
 *
 * 全部 IO 由模块级 mock 提供,不连真库/真 Redis(测试隔离铁律)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface TierFixture {
  category: string
  modelTier: string
  hidden: boolean
}

const io: {
  own: Set<string>
  ops: Map<string, string>
  complexity: string | null
  complexityDelayMs: number
  dbError: Error | null
  tiers: Map<string, TierFixture> | null
  calls: string[]
} = {
  own: new Set(),
  ops: new Map(),
  complexity: 'simple',
  complexityDelayMs: 0,
  dbError: null,
  tiers: null,
  calls: [],
}

function resetIo(): void {
  io.own = new Set()
  io.ops = new Map()
  io.complexity = 'simple'
  io.complexityDelayMs = 0
  io.dbError = null
  io.tiers = null
  io.calls = []
}

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} },
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {
    selectDistinct: () => ({
      from: () => ({
        where: async () => {
          io.calls.push('own')
          if (io.dbError) throw io.dbError
          return [...io.own].map((providerCode) => ({ providerCode }))
        },
      }),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => {
            io.calls.push('ops')
            if (io.dbError) throw io.dbError
            return [...io.ops].map(([modelId, providerCode]) => ({ modelId, providerCode }))
          },
        }),
      }),
    }),
  },
}))

vi.mock('../src/utils/internal-call-headers.js', () => ({
  buildInternalCallHeaders: async () => ({ 'Content-Type': 'application/json' }),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async () => {
    io.calls.push('complexity')
    if (io.complexityDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, io.complexityDelayMs))
    }
    if (io.complexity === null) return { ok: false, status: 503, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ complexity: io.complexity }) }
  },
}))

vi.mock('../src/services/model-catalog-classify-client.js', () => ({
  poolModelClassKey: (provider: string, id: string) => `${provider}\u0000${id}`,
  classifyPoolModels: async () => {
    io.calls.push('classify')
    return io.tiers
  },
}))

import {
  classifyCandidate,
  pickAutoPoolModel,
  resolveAutoChatRoute,
} from '../src/services/chat-auto-resolve.js'

function baseInput(poolCandidates: string[]) {
  return {
    userId: 'user-1',
    promptTail: '把这段代码重构成异步',
    promptChars: 12,
    hasTools: false,
    poolCandidates,
  }
}

function tierKey(provider: string, id: string): string {
  return `${provider}\u0000${id}`
}

describe('resolveAutoChatRoute(IO 壳)', () => {
  beforeEach(resetIo)

  it('候选为空 ⇒ 直接 platform,且一次 IO 都不发', async () => {
    const result = await resolveAutoChatRoute(baseInput([]))
    expect(result).toEqual({ channel: 'platform', model: null, source: null, complexity: null })
    expect(io.calls).toEqual([])
  })

  it('候选全部越权 ⇒ platform,且不问复杂度(无用票不发)', async () => {
    io.own.add('cursor')
    const result = await resolveAutoChatRoute(baseInput(['qoder/qmodel_38max']))
    expect(result.channel).toBe('platform')
    expect(io.calls).toEqual(['own', 'ops'])
  })

  it('普通任务 + 本人号池候选 ⇒ pool/own(不查代次)', async () => {
    io.own.add('cursor')
    io.complexity = 'simple'
    const result = await resolveAutoChatRoute(baseInput(['cursor/composer-2.5']))
    expect(result).toEqual({
      channel: 'pool',
      model: 'cursor/composer-2.5',
      source: 'own',
      complexity: 'simple',
    })
    expect(io.calls).toEqual(['own', 'ops', 'complexity'])
  })

  it('普通任务 + 只有运营池公开候选 ⇒ pool/ops', async () => {
    io.ops.set('kimi-k2.7-code', 'token6688')
    const result = await resolveAutoChatRoute(baseInput(['kimi-k2.7-code']))
    expect(result).toEqual({
      channel: 'pool',
      model: 'kimi-k2.7-code',
      source: 'ops',
      complexity: 'simple',
    })
  })

  it('复杂任务 + 号池有 latest 档 ⇒ pool', async () => {
    io.own.add('cursor')
    io.complexity = 'expert'
    io.tiers = new Map([
      [tierKey('cursor', 'cursor/composer-2.5'), { category: 'chat', modelTier: 'latest', hidden: false }],
    ])
    const result = await resolveAutoChatRoute(baseInput(['cursor/composer-2.5']))
    expect(result).toEqual({
      channel: 'pool',
      model: 'cursor/composer-2.5',
      source: 'own',
      complexity: 'expert',
    })
    expect(io.calls).toEqual(['own', 'ops', 'complexity', 'classify'])
  })

  it('复杂任务 + latest 已被判隐藏 ⇒ platform(不拿落档模型凑合)', async () => {
    io.own.add('cursor')
    io.complexity = 'complex'
    io.tiers = new Map([
      [tierKey('cursor', 'cursor/legacy-1'), { category: 'chat', modelTier: 'latest', hidden: true }],
    ])
    const result = await resolveAutoChatRoute(baseInput(['cursor/legacy-1']))
    expect(result.channel).toBe('platform')
  })

  it('复杂度票非 2xx ⇒ platform(判不了不替用户做主)', async () => {
    io.own.add('cursor')
    io.complexity = null
    const result = await resolveAutoChatRoute(baseInput(['cursor/composer-2.5']))
    expect(result.channel).toBe('platform')
  })

  it('查库异常 ⇒ platform(不抛给调用方)', async () => {
    io.own.add('cursor')
    io.dbError = new Error('db down')
    const result = await resolveAutoChatRoute(baseInput(['cursor/composer-2.5']))
    expect(result.channel).toBe('platform')
  })

  it('决策超预算 ⇒ 到点回 platform,不等慢票', async () => {
    io.own.add('cursor')
    io.complexity = 'simple'
    io.complexityDelayMs = 120
    const started = Date.now()
    const result = await resolveAutoChatRoute(baseInput(['cursor/composer-2.5']), { budgetMs: 20 })
    expect(result.channel).toBe('platform')
    expect(Date.now() - started).toBeLessThan(100)
    // 排空后台那次慢票,避免它的收尾写进下一条用例的 io.calls
    await new Promise((resolve) => setTimeout(resolve, 140))
  })
})

describe('纯判据回归(加固未改选型规则)', () => {
  it('classifyCandidate 仍按 own 平台集 ∪ 运营池登记行过滤', () => {
    expect(classifyCandidate('cursor/x', new Set(['cursor']), new Map())).toBe('own')
    expect(classifyCandidate('qoder/x', new Set(['cursor']), new Map())).toBeNull()
  })

  it('pickAutoPoolModel 复杂任务无 latest 仍回 platform', () => {
    expect(
      pickAutoPoolModel(
        [{ id: 'cursor/x', source: 'own' as const }],
        'expert',
        new Map([['cursor/x', 'standard']]),
      ),
    ).toEqual({ channel: 'platform', model: null, source: null })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
