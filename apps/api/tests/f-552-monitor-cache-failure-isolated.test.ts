// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-552 回归锁（2026-11-13）。
 *
 * 病灶：过期监听把「Redis 缓存写入失败」与「业务检测失败」合并在同一 try/catch，
 * DB 已成功改状态后 markProcessed/recordSuccess 的 Redis 抖动会冒泡为检测失败，
 * 连续 4 轮（30s×4）触发生产 Canary 误回滚。
 *
 * 本文件锁四件事：
 * ① 仅缓存写失败 ⇒ 不计失败轮次、不触发回滚、有 warn，检测结果照常返回；
 * ② 真实检测失败才累加连续失败计数；
 * ③ 连续 4 次真实失败仍按原阈值触发 Canary 回滚；
 * ④ 正常路径返回结构/计数语义不变。
 *
 * 测试模式：mock ioredis（含 pipeline/sismember/sadd/expire/incr/set/del）、db、
 * @ihui/database、config、canary-service 与 logger，全部内存替身，不连真实依赖。
 * 测试文件豁免 any（AGENTS.md §3）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const counters = new Map<string, number>()
  const flags = new Map<string, string>()
  const processed = new Map<string, Set<string>>()
  const failCommands = new Set<string>()
  const tables = {
    buy: { __table: 'agent_buy' },
    settlement: { __table: 'agent_settlement' },
  }

  const state = {
    buyRows: [] as Array<{ id: string }>,
    settlementRows: [] as Array<{ id: string }>,
    failSelect: false,
  }

  return {
    counters,
    flags,
    processed,
    failCommands,
    tables,
    state,
    warn: vi.fn(),
    error: vi.fn(),
    rollbackCanary: vi.fn(),
    getCanaryConfig: vi.fn(async () => ({ isActive: true })),
  }
})

vi.mock('ioredis', () => {
  class FakeRedis {
    on(): this {
      return this
    }

    async set(key: string, value: string, ...rest: unknown[]): Promise<'OK' | null> {
      if (h.failCommands.has('set')) throw new Error('mock redis: set 注入故障')
      if (rest.includes('NX') && h.flags.has(key)) return null
      h.flags.set(key, value)
      return 'OK'
    }

    async del(key: string): Promise<number> {
      if (h.failCommands.has('del')) throw new Error('mock redis: del 注入故障')
      return h.flags.delete(key) ? 1 : 0
    }

    async incr(key: string): Promise<number> {
      if (h.failCommands.has('incr')) throw new Error('mock redis: incr 注入故障')
      const next = (h.counters.get(key) ?? 0) + 1
      h.counters.set(key, next)
      return next
    }

    async quit(): Promise<'OK'> {
      return 'OK'
    }

    pipeline(): any {
      const cmds: Array<{ cmd: string; args: unknown[] }> = []
      const pipe: any = {
        sismember: (key: string, id: string) => {
          cmds.push({ cmd: 'sismember', args: [key, id] })
          return pipe
        },
        sadd: (key: string, id: string) => {
          cmds.push({ cmd: 'sadd', args: [key, id] })
          return pipe
        },
        expire: (key: string, ttl: number) => {
          cmds.push({ cmd: 'expire', args: [key, ttl] })
          return pipe
        },
        exec: async () => {
          for (const c of cmds) {
            if (h.failCommands.has(c.cmd)) throw new Error(`mock redis: ${c.cmd} 注入故障`)
          }
          return cmds.map((c) => {
            if (c.cmd === 'sismember') {
              const [key, id] = c.args as [string, string]
              return [null, h.processed.get(key)?.has(id) ? 1 : 0]
            }
            if (c.cmd === 'sadd') {
              const [key, id] = c.args as [string, string]
              const set = h.processed.get(key) ?? new Set<string>()
              set.add(id)
              h.processed.set(key, set)
              return [null, 1]
            }
            return [null, 1]
          })
        },
      }
      return pipe
    }
  }
  return { default: FakeRedis }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (h.state.failSelect) throw new Error('mock db: select 注入故障')
            return table === h.tables.buy ? h.state.buyRows : h.state.settlementRows
          },
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  },
}))

vi.mock('@ihui/database', () => ({
  zhsAgentBuy: h.tables.buy,
  agentSettlements: h.tables.settlement,
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:6379' },
}))

vi.mock('../src/services/canary-service.js', () => ({
  getCanaryConfig: h.getCanaryConfig,
  rollbackCanary: h.rollbackCanary,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: h.warn, error: h.error },
}))

const { startExpirationMonitor } = await import('../src/services/expiration-monitor-service.js')

const FAIL_STREAK_KEY = 'expmon:fail_streak'
const BUY_KEY = 'expmon:processed:agent_buy'
const SETTLEMENT_KEY = 'expmon:processed:agent_settlement'

beforeEach(() => {
  h.counters.clear()
  h.flags.clear()
  h.processed.clear()
  h.failCommands.clear()
  h.state.buyRows = []
  h.state.settlementRows = []
  h.state.failSelect = false
  h.warn.mockClear()
  h.error.mockClear()
  h.rollbackCanary.mockClear()
  h.getCanaryConfig.mockClear()
})

describe('F-552 缓存写失败与检测失败隔离', () => {
  it('① 仅缓存写失败 ⇒ 不计失败轮次、不触发回滚、warn，检测结果照常返回', async () => {
    h.state.buyRows = [{ id: 'buy-1' }, { id: 'buy-2' }]
    h.state.settlementRows = [{ id: 'st-1' }]
    // sadd 失败 = markProcessed 写失败；set 失败 = recordSuccess 写失败
    h.failCommands.add('sadd')
    h.failCommands.add('set')

    const r = await startExpirationMonitor()

    expect(r).toEqual({
      checkedAgentBuy: 2,
      expiredAgentBuy: 2,
      checkedAgentSettlement: 1,
      expiredAgentSettlement: 1,
      failStreak: 0,
      canaryTriggered: false,
      healthy: true,
    })
    expect(h.counters.has(FAIL_STREAK_KEY)).toBe(false)
    expect(h.rollbackCanary).not.toHaveBeenCalled()
    expect(h.getCanaryConfig).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
    expect(
      h.warn.mock.calls.some(([msg]) => String(msg).includes('cache write failed')),
    ).toBe(true)
  })

  it('② 真实检测失败才累加连续失败计数', async () => {
    h.state.failSelect = true

    const r = await startExpirationMonitor()

    expect(r.healthy).toBe(false)
    expect(r.failStreak).toBe(1)
    expect(r.canaryTriggered).toBe(false)
    expect(h.rollbackCanary).not.toHaveBeenCalled()
  })

  it('③ 连续 4 次真实失败仍触发 Canary 回滚', async () => {
    h.state.failSelect = true
    const results = []
    for (let i = 0; i < 4; i += 1) {
      results.push(await startExpirationMonitor())
    }

    expect(results.map((r) => r.failStreak)).toEqual([1, 2, 3, 4])
    expect(results.slice(0, 3).every((r) => r.canaryTriggered === false)).toBe(true)
    expect(results[3]?.canaryTriggered).toBe(true)
    expect(h.rollbackCanary).toHaveBeenCalledTimes(1)
    expect(h.rollbackCanary).toHaveBeenCalledWith(
      'expiration-monitor',
      expect.stringContaining('AgentBuy detection error'),
    )
  })

  it('④ 正常路径返回结构不变', async () => {
    h.state.buyRows = [{ id: 'buy-1' }, { id: 'buy-2' }]
    h.state.settlementRows = [{ id: 'st-1' }]

    const r = await startExpirationMonitor()

    expect(r).toEqual({
      checkedAgentBuy: 2,
      expiredAgentBuy: 2,
      checkedAgentSettlement: 1,
      expiredAgentSettlement: 1,
      failStreak: 0,
      canaryTriggered: false,
      healthy: true,
    })
    expect(h.warn).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
    expect(h.rollbackCanary).not.toHaveBeenCalled()
    expect(h.processed.get(BUY_KEY)).toEqual(new Set(['buy-1', 'buy-2']))
    expect(h.processed.get(SETTLEMENT_KEY)).toEqual(new Set(['st-1']))
    expect(h.flags.get(FAIL_STREAK_KEY)).toBe('0')
  })
})
