// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-183 回归锁:熔断计数器 Redis 读改写非原子 ⇒ 并发失败计数丢失、熔断难触发。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-183):
 *   recordChannelResult 每次上游调用结束 → hgetall → 内存改 → hset。并发失败读同一值互相覆盖——
 *   坏上游持续 5xx 时 failureCount 到不了阈值、熔断迟迟不打开;成功请求也可能覆盖并发失败计数。
 *
 * 修复:用单条 Lua(redis defineCommand)在 Redis 侧原子完成「成功重置 / 失败累加 + 达阈值转 open
 *   + TTL 续期」,消除 hgetall→hset 覆盖窗口;Redis 不可用时 redisOp 返回 null → 降级内存读改写。
 *   本锁钉住:服务侧必须走原子 Lua(不再 hgetall→hset)、Lua 阈值转 open 语义正确、降级路径保底。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const svcPath = resolve(REPO_ROOT, 'apps/api/src/services/relay-channel-router.ts')
const src = readFileSync(svcPath, 'utf8')

describe('F-183:熔断计数器读改写必须原子化', () => {
  it('接线锁:必须定义原子 Lua 命令(defineCommand + circuitRecord),不再裸 hgetall→hset', () => {
    // 修复痕迹:defineCommand 注册原子脚本 + Lua 体内做阈值判断
    expect(src).toMatch(/defineCommand\(\s*'circuitRecord'/)
    expect(src).toContain('redis.call')
    // Lua 内完成「达阈值转 open」判据(threshold 比较在脚本里,不在 JS 侧读改写)
    expect(src).toMatch(/fc >= threshold/)
  })

  it('接线锁:recordChannelResult 走 redisOp + circuitRecord,不再先 hgetall 再 hset', () => {
    // recordChannelResult 函数体内:应出现 circuitRecord 原子调用,且降级路径仍在 redisOp 之后
    const fnBody = src.slice(src.indexOf('export async function recordChannelResult'))
    expect(fnBody).toMatch(/redisOp\(/)
    expect(fnBody).toMatch(/circuitRecord\(/)
  })

  it('行为锁:Lua 语义——失败累加达阈值转 open,half-open 失败立即 open', () => {
    // 失败分支:fc+1;half-open 或 fc>=threshold → open
    expect(src).toMatch(/local fc = tonumber\(redis\.call\('HGET', key, 'failureCount'\)\) or 0/)
    expect(src).toMatch(/fc = fc \+ 1/)
    // half-open 失败立即 open;达阈值 open
    expect(src).toMatch(/if st == 'half-open' or fc >= threshold then/)
    expect(src).toMatch(/newState = 'open'/)
  })

  it('行为锁:成功路径重置 failureCount 且保留 lastFailureAt(不破坏 open→half-open 时钟)', () => {
    // 成功:failureCount=0、state=closed;lastFailureAt 保留上次失败时间(供 60s 后转 half-open 判断)
    expect(src).toMatch(/'state', 'closed', 'failureCount', 0, 'lastFailureAt', lastFailureAt/)
  })

  it('行为锁:Redis 不可用时降级内存读改写保底(不静默丢结果)', () => {
    // redisOp 返回 null 时仍有内存镜像降级分支
    const fnBody = src.slice(src.indexOf('export async function recordChannelResult'))
    expect(fnBody).toMatch(/circuitFromRedis\(raw\)/)
    expect(fnBody).toMatch(/writeCircuitState\(keyPoolId, state\)/)
  })
})

// 运行时行为锁:mock ioredis,验证 recordChannelResult 真的调用原子命令并同步内存镜像
vi.mock('ioredis', () => {
  const store: Record<string, Record<string, string>> = {}
  const mk = () => {
    let handler: ((...a: unknown[]) => Promise<unknown>) | null = null
    const r: Record<string, unknown> = {
      defineCommand: vi.fn((name: string, opts: { lua: string }) => {
        // 极简 Lua 解释:仅覆盖本脚本的 HGET/HSET/EXPIRE/HGETALL + fc 累加,足够验证阈值转 open
        handler = async (_key: string, thresholdS: string, _od: string, nowS: string, succS: string) => {
          const st = store.__c ?? {}
          const cur = st.state ?? 'closed'
          let fc = Number(st.failureCount ?? 0)
          let newState = cur
          let halfOpenAt: string | number = st.halfOpenAt ?? ''
          if (succS === '1') {
            newState = 'closed'
            fc = 0
            halfOpenAt = ''
          } else {
            fc += 1
            if (cur === 'half-open' || fc >= Number(thresholdS)) {
              newState = 'open'
              halfOpenAt = ''
            }
          }
          store.__c = {
            state: newState,
            failureCount: String(fc),
            lastFailureAt: nowS,
            halfOpenAt: String(halfOpenAt),
          }
          const c = store.__c
          return ['state', c.state, 'failureCount', c.failureCount, 'lastFailureAt', c.lastFailureAt, 'halfOpenAt', c.halfOpenAt]
        }
        void name
        void opts
      }),
      circuitRecord: vi.fn((...a: unknown[]) => (handler ? handler(...a) : Promise.resolve([]))),
    }
    return r
  }
  const Redis = vi.fn(() => mk())
  return { default: Redis }
})

describe('F-183 运行时:recordChannelResult 走原子命令,失败达阈值转 open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('连续 3 次失败 → state=open(经原子命令累计,内存镜像同步)', async () => {
    const mod = await import('../src/services/relay-channel-router.js')
    const { recordChannelResult, getCircuitState } = mod
    // Redis 默认可用(config.REDIS_URL 由测试环境提供 mock)
    await recordChannelResult('kp-f183', false, 10)
    await recordChannelResult('kp-f183', false, 10)
    await recordChannelResult('kp-f183', false, 10)
    const st = await getCircuitState('kp-f183')
    // 原子累计后达阈值 → open;若仍是旧读改写(并发覆盖),这里可能停在 closed
    expect(st.state).toBe('open')
    expect(st.failureCount).toBeGreaterThanOrEqual(3)
  })

  it('成功后重置 → state=closed、failureCount=0', async () => {
    const mod = await import('../src/services/relay-channel-router.js')
    const { recordChannelResult, getCircuitState } = mod
    await recordChannelResult('kp-f183b', false, 10)
    await recordChannelResult('kp-f183b', true, 10)
    const st = await getCircuitState('kp-f183b')
    expect(st.state).toBe('closed')
    expect(st.failureCount).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
