// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * readMarket 兜底路径不得把模块级 MARKET_SEED **本体**交给调用方(跨请求污染取证)。
 *
 * 缺陷形态:redis 为空/异常时 `return MARKET_SEED`(本体)。下游写路径
 * (POST /skills/market 的 entries.push、/listing 与 /unlist 的字段赋值)拿到的就是
 * 种子数组本身 ⇒ 一次改写永久污染进程内种子,之后的每个"冷启动"请求都读到脏数据。
 * 本文件自己的测试头注(同目录其它 skills-market 测试)也记过该文件曾踩过一次。
 *
 * 判据按票面要求取**最强的一种**:mutate 返回值(push + 改标量字段 + tags.push)后,
 * MARKET_SEED 本体在两次读之间必须逐字段(JSON 序列化)不变;只断"返回值相等"抓不到
 * 本体污染。tags 是条目里唯一的嵌套可变态 —— 若实现只 map(e => ({...e})) 不拷数组,
 * "tags 中毒"用例必须判红(浅拷陷阱由它钉死)。
 *
 * 变异取证:把 cloneMarketEntries(...) 改回 `return MARKET_SEED` ⇒ 本文件全部判红。
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { INTERNAL_SECRET } = vi.hoisted(() => ({
  INTERNAL_SECRET: 'internal-self-evolution-secret',
}))

// 夹具形态与 apps/api/tests/skills-market-publish-ownership.test.ts 同谱:
// 只 mock 路由模块的导入依赖,readMarket / MARKET_SEED 走**真身**(本票测的就是本体)。
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_CALLBACK_SECRET: INTERNAL_SECRET,
  },
}))

import { __test__, skillsRoutes } from '../src/routes/skills.js'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const MARKET_KEY = 'skills-market:global'

/** redis 端口的最小实现:get 恒 null(空库)或恒抛(异常),set 记录被写入过 */
function makeRedis(mode: 'empty' | 'throw') {
  const sets: Array<{ key: string; value: string }> = []
  return {
    sets,
    get: async (_k: string): Promise<string | null> => {
      if (mode === 'throw') throw new Error('simulated redis outage')
      return null
    },
    set: async (k: string, v: string): Promise<unknown> => {
      sets.push({ key: k, value: v })
      return 'OK'
    },
  }
}

const seedJson = () => JSON.stringify(__test__.getMarketSeed())

/** 对返回值下"三类手"：数组 push、标量字段改写、嵌套 tags 数组 push —— 本体污染的全谱 */
function poison(entries: SkillMarketEntry[]) {
  const first = entries[0]
  if (!first) throw new Error('种子不应为空(判据失效前先查 MARKET_SEED_RAW)')
  first.description = 'POISONED-BY-TEST'
  first.tags.push('POISON-TAG')
  first.installCount = -99999
  entries.push({ ...first, name: 'poisoned-injected-entry' })
}

describe('readMarket 兜底路径返回深拷贝,不交出 MARKET_SEED 本体', () => {
  it('前置:路由模块可装配(导入本身不炸)', async () => {
    const app = Fastify()
    app.register(skillsRoutes)
    await app.ready()
    await app.close()
    expect(typeof __test__.readMarket).toBe('function')
    expect(__test__.getMarketSeed().length).toBeGreaterThan(0)
  })

  it('redis 空(初始化种子路径):mutate 返回值后,种子本体逐字段不变', async () => {
    const before = seedJson()
    const redis = makeRedis('empty')
    const first = await __test__.readMarket(redis, MARKET_KEY)
    poison(first)
    // 判据 1:本体逐字段(JSON 全序列化)不变 —— 唯一能证明"没交出本体"的观测
    expect(seedJson()).toBe(before)
    // 判据 2:毒不会经下一次读回流(两次读之间本体污染才算修好)
    const second = await __test__.readMarket(redis, MARKET_KEY)
    expect(JSON.stringify(second)).toBe(before)
    // 判据 3:两次读返回的是彼此独立的副本(改第一次的 tags 不影响第二次)
    poison(first)
    expect(JSON.stringify(second)).toBe(before)
    // 判据 4:初始化写入 redis 的仍是干净种子
    const initSet = redis.sets[0]
    expect(initSet?.key).toBe(MARKET_KEY)
    expect(initSet?.value).toBe(before)
  })

  it('redis 抛异常(catch ?? MARKET_SEED 分支):同型路径同样不交出本体', async () => {
    const before = seedJson()
    const redis = makeRedis('throw')
    const fallbackRead = await __test__.readMarket(redis, MARKET_KEY)
    // marketFallback 此时为空 ⇒ 走 `?? MARKET_SEED`;修好后必须返回深拷贝
    expect(fallbackRead.length).toBeGreaterThan(0)
    poison(fallbackRead)
    expect(seedJson()).toBe(before)
    const reread = await __test__.readMarket(redis, MARKET_KEY)
    expect(JSON.stringify(reread)).toBe(before)
  })

  it('浅拷陷阱钉死:tags 数组不得跨读共享引用(只 {...e} 不拷 tags 必红)', async () => {
    const redis = makeRedis('empty')
    const a = await __test__.readMarket(redis, MARKET_KEY)
    const b = await __test__.readMarket(redis, MARKET_KEY)
    const ta = a[0]?.tags
    const tb = b[0]?.tags
    if (!ta || !tb) throw new Error('种子条目缺 tags(判据失效)')
    expect(ta).not.toBe(tb)
    ta.push('shared-array-leak')
    expect(tb).not.toContain('shared-array-leak')
    expect(__test__.getMarketSeed()[0]?.tags).not.toContain('shared-array-leak')
  })
})
// ⁠占位尾行,inject 会补第三层载荷
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
