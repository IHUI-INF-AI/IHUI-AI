// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-559 回归锁（2026-11-13）。
 *
 * 病灶：过期监听的失败处理函数自身无保护。检测失败进入 catch 后，
 * recordFailureAndMaybeRollback 里裸 await 的 INCR/SET 再失败（Redis 抖动、
 * maxRetriesPerRequest:null 下命令长期 pending/拒绝）就把异常抛回调度层，
 * 违反「不向调度层抛错」契约；同一份实现还会在 AgentBuy 失败时提前 return，
 * 跳过同轮 AgentSettlement 检测。
 *
 * 本文件锁：
 *   ① 失败处理自身抛错（INCR 故障）⇒ startExpirationMonitor 不抛，healthy=false，
 *      仍记一次失败计数并输出带监控项/错误摘要的结构化 error 日志；
 *   ② 逐项隔离：AgentBuy 检测失败时 AgentSettlement 照常检测并落库；
 *   ③ 达阈值后 SET 故障 ⇒ 不抛、不误触发 Canary 回滚；
 *   ④ 成功路径返回结构/计数语义不变，且完全不触碰失败计数。
 *
 * 测试模式：mock ioredis / db / @ihui/database / config / canary-service / logger，
 * 全部内存替身，不连真实 DB、Redis、ai-service。
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
    failBuySelect: false,
    updatedTables: [] as string[],
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
            if (table === h.tables.buy) {
              if (h.state.failBuySelect) throw new Error('mock db: AgentBuy select 注入故障')
              return h.state.buyRows
            }
            return h.state.settlementRows
          },
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          h.state.updatedTables.push((table as { __table: string }).__table)
        },
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

beforeEach(() => {
  h.counters.clear()
  h.flags.clear()
  h.processed.clear()
  h.failCommands.clear()
  h.state.buyRows = []
  h.state.settlementRows = []
  h.state.failBuySelect = false
  h.state.updatedTables = []
  h.warn.mockClear()
  h.error.mockClear()
  h.rollbackCanary.mockClear()
  h.getCanaryConfig.mockClear()
})

describe('F-559 失败处理自身抛错不外抛', () => {
  it('① INCR 故障 ⇒ tick 不抛、计失败、结构化日志含监控项与错误摘要', async () => {
    h.state.failBuySelect = true
    h.failCommands.add('incr')

    const r = await startExpirationMonitor()

    expect(r.healthy).toBe(false)
    expect(r.canaryTriggered).toBe(false)
    expect(r.failStreak).toBeGreaterThanOrEqual(1)
    expect(h.rollbackCanary).not.toHaveBeenCalled()

    const guardedCall = h.error.mock.calls.find(([msg]) =>
      String(msg).includes('failure handler itself failed'),
    )
    expect(guardedCall).toBeTruthy()
    const meta = (guardedCall?.[1] ?? {}) as {
      monitorItem?: string
      errorSummary?: string
      reason?: string
    }
    expect(meta.monitorItem).toBe('agent_buy')
    expect(meta.reason).toContain('AgentBuy detection error')
    expect(String(meta.errorSummary)).toContain('incr')
  })

  it('② 逐项隔离：AgentBuy 失败不跳过同轮 AgentSettlement', async () => {
    h.state.failBuySelect = true
    h.state.settlementRows = [{ id: 'st-1' }]

    const r = await startExpirationMonitor()

    expect(r.healthy).toBe(false)
    expect(r.checkedAgentBuy).toBe(0)
    expect(r.expiredAgentBuy).toBe(0)
    expect(r.checkedAgentSettlement).toBe(1)
    expect(r.expiredAgentSettlement).toBe(1)
    expect(h.state.updatedTables).toEqual(['agent_settlement'])
    expect(h.processed.get('expmon:processed:agent_settlement')).toEqual(new Set(['st-1']))
  })

  it('③ 达阈值后 SET 故障 ⇒ 不抛、不误触发回滚', async () => {
    h.state.failBuySelect = true
    h.counters.set(FAIL_STREAK_KEY, 3)
    h.failCommands.add('set')

    const r = await startExpirationMonitor()

    expect(r.healthy).toBe(false)
    expect(r.canaryTriggered).toBe(false)
    expect(h.rollbackCanary).not.toHaveBeenCalled()
    expect(h.getCanaryConfig).not.toHaveBeenCalled()
    expect(
      h.error.mock.calls.some(([msg]) => String(msg).includes('failure handler itself failed')),
    ).toBe(true)
  })

  it('④ 成功路径返回结构不变，且不触碰失败计数', async () => {
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
    expect(h.counters.has(FAIL_STREAK_KEY)).toBe(false)
    expect(h.flags.get(FAIL_STREAK_KEY)).toBe('0')
    expect(h.warn).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
    expect(h.rollbackCanary).not.toHaveBeenCalled()
  })
})
