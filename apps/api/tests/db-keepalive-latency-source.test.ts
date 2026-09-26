// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小票：`apps/api/src/plugins/db-keepalive.ts` 的 SQL 耗时上报必须走耗时样本唯一出口
 * （`src/utils/elapsed-ms.ts`，格② 2026-09-26 立）。
 *
 * 被修的缺陷：该插件在成功分支与失败分支各写了一份裸墙钟差值喂给
 * `server.recordSqlQuery('system','SELECT', durationSec)`，而该值直接进 SQL 耗时直方图与
 * `/metrics` 的 p50/p95 观测面。NTP 步进 / 休眠 / 容器时钟迁移会把差值打成负数或巨大值，
 * 一条坏样本即可把 system/SELECT 的整条分布带偏，且无人知晓。
 *
 * 判据（对应任务书用例 1–5）：
 *  1. 正常双钟 ⇒ 直方图收到一次非负耗时；
 *  2. 单调钟与墙钟分歧超容差 ⇒ 直方图**不收**该样本，但每一轮都在
 *     `elapsedClockStats().untrustworthy` 上恰好 +1（不静默丢），而 warn 全程只出声一次
 *     （不得每 tick 刷日志）；
 *  3. 负差值形态 ⇒ 同 2，计数落在 negativeDelta 上；
 *  4. 保活逻辑（isAlive / consecutiveFailures）一字未动 —— 成功归零、失败累加并置死；
 *  5. 源码静态锁：`db-keepalive.ts` 的代码面不得再出现裸 `Date.now() - x` 差值形态，
 *     且定时器必须真的把 tick 交给那个走唯一出口的实现（"判据存在而永不调用 = 没有"）。
 *
 * 零连库：db / config / metrics 出口全部 mock，不监听端口，不触生产 PG/Redis 数据面。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CLOCK_DIVERGENCE_TOLERANCE_MS, elapsedClockStats } from '../src/utils/elapsed-ms.js'
import type { ClockSource } from '../src/utils/elapsed-ms.js'

// 插件主模块 import 时会连带取 db/index.js（建池 + 读 config），测试一律给假导出。
// 保活定时器在 NODE_ENV=test 下本就不启动（见插件内 isTestEnv），这里只需让模块可加载。
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(async () => []) },
  dbClient: { options: { max: 10 } },
}))

// vitest 把 vi.mock 提到所有 import 之前执行，故静态 import 拿到的已是打过 mock 的模块
import { __test__ } from '../src/plugins/db-keepalive.js'

type LogLevel = 'info' | 'warn' | 'error'
interface LoggedCall {
  level: LogLevel
  payload: unknown
  msg?: string
}

/** 假日志器：形状与插件的 KeepaliveTickLogger 结构兼容，另挂一个断言用的 calls。 */
interface FakeLogger {
  info(payload: unknown, msg?: string): void
  warn(payload: unknown, msg?: string): void
  error(payload: unknown, msg?: string): void
  readonly calls: LoggedCall[]
}

function makeLogger(): FakeLogger {
  const calls: LoggedCall[] = []
  const record =
    (level: LogLevel) =>
    (payload: unknown, msg?: string): void => {
      calls.push({ level, payload, msg })
    }
  return { info: record('info'), warn: record('warn'), error: record('error'), calls }
}

/** 假时钟：perf 与 wall 各自独立前进，用于造"分歧超容差"与"负差值"两型。 */
function makeFakeClocks(start = 1_000) {
  const clock = { perf: start, wall: 1_700_000_000_000 }
  const clocks: ClockSource = {
    perfNow: () => clock.perf,
    wallNow: () => clock.wall,
  }
  return { clock, clocks }
}

beforeEach(() => {
  // 一次性出声 flag 是模块级（进程级）的，逐例复位，否则第 2 条用例的"恰一次"无从判定。
  __test__.resetUntrustworthyShout()
})

describe('db-keepalive 耗时上报必须走 elapsed-ms 唯一出口', () => {
  it('用例1 正常双钟：直方图恰好收到一次、耗时非负', async () => {
    const log = makeLogger()
    const recordSqlQuery = vi.fn((_durationSec: number) => {})
    const before = elapsedClockStats()

    await __test__.runKeepaliveTick({
      state: { isAlive: true, consecutiveFailures: 0 },
      execute: async () => [],
      recordSqlQuery,
      log,
    })

    expect(recordSqlQuery).toHaveBeenCalledTimes(1)
    const durationSec = recordSqlQuery.mock.calls[0]?.[0]
    expect(typeof durationSec).toBe('number')
    expect(Number.isFinite(durationSec)).toBe(true)
    expect(durationSec!).toBeGreaterThanOrEqual(0)
    // 真双钟同速 ⇒ 样本可信，不该有不可信计数落在这一轮上
    expect(elapsedClockStats().untrustworthy).toBe(before.untrustworthy)
    expect(log.calls.filter((c) => c.level === 'warn')).toHaveLength(0)
  })

  it('用例2 单调钟与墙钟分歧超容差：不进直方图，但计数 +1 且首次 warn 恰一次', async () => {
    const { clock, clocks } = makeFakeClocks()
    const log = makeLogger()
    const recordSqlQuery = vi.fn((_durationSec: number) => {})
    const before = elapsedClockStats()

    // 假时钟在 execute 期间被推进 ⇒ 模拟"一次查询之间发生了休眠 / 容器迁移"级别的跳变：
    // 单调钟只走 50ms，墙钟却跳了三倍容差，旧算法会把这 6000ms 当耗时喂进直方图。
    const divergingExecute = async () => {
      clock.perf += 50
      clock.wall += CLOCK_DIVERGENCE_TOLERANCE_MS * 3
      return []
    }

    await __test__.runKeepaliveTick({
      state: { isAlive: true, consecutiveFailures: 0 },
      execute: divergingExecute,
      recordSqlQuery,
      log,
      clocks,
    })
    // 第二轮：同一型缺陷再来一次 —— 计数继续加，但日志不得每 tick 刷
    await __test__.runKeepaliveTick({
      state: { isAlive: true, consecutiveFailures: 0 },
      execute: divergingExecute,
      recordSqlQuery,
      log,
      clocks,
    })

    expect(recordSqlQuery).not.toHaveBeenCalled()
    const after = elapsedClockStats()
    expect(after.untrustworthy).toBe(before.untrustworthy + 2)
    expect(after.divergence).toBe(before.divergence + 2)
    const warns = log.calls.filter((c) => c.level === 'warn')
    expect(warns).toHaveLength(1)
    expect((warns[0]?.payload as { reason?: string }).reason).toBe('clock-divergence')
    expect(__test__.hasShouted()).toBe(true)
  })

  it('用例3 负差值（时钟回拨）：同样不进直方图，计数 +1，warn 恰一次', async () => {
    const { clock, clocks } = makeFakeClocks()
    const log = makeLogger()
    const recordSqlQuery = vi.fn((_durationSec: number) => {})
    const before = elapsedClockStats()

    await __test__.runKeepaliveTick({
      state: { isAlive: true, consecutiveFailures: 0 },
      // 墙钟往回跳 5 秒而单调钟不动 ⇒ 旧算法得到 -5000ms（直方图桶分配对负值无防御）
      execute: async () => {
        clock.wall -= 5_000
        return []
      },
      recordSqlQuery,
      log,
      clocks,
    })

    expect(recordSqlQuery).not.toHaveBeenCalled()
    const after = elapsedClockStats()
    expect(after.untrustworthy).toBe(before.untrustworthy + 1)
    expect(after.negativeDelta).toBe(before.negativeDelta + 1)
    expect(log.calls.filter((c) => c.level === 'warn')).toHaveLength(1)
  })

  it('用例4 保活逻辑未改：成功归零 / 失败累加并置死', async () => {
    const log = makeLogger()
    const state = { isAlive: false, consecutiveFailures: 3 }

    await __test__.runKeepaliveTick({
      state,
      execute: async () => [],
      recordSqlQuery: vi.fn((_durationSec: number) => {}),
      log,
    })
    expect(state.isAlive).toBe(true)
    expect(state.consecutiveFailures).toBe(0)
    // 从"死"回到"活"仍要喊一次恢复（旧行为）
    expect(log.calls.some((c) => c.level === 'info' && c.payload === 'database connection restored')).toBe(
      true,
    )

    const failing: LoggedCall[] = []
    const failState = { isAlive: true, consecutiveFailures: 0 }
    const err = new Error('connection reset')
    await __test__.runKeepaliveTick({
      state: failState,
      execute: async () => {
        throw err
      },
      recordSqlQuery: (_durationSec: number) => {},
      log: {
        info: (payload: unknown, msg?: string) => {
          failing.push({ level: 'info', payload, msg })
        },
        warn: (payload: unknown, msg?: string) => {
          failing.push({ level: 'warn', payload, msg })
        },
        error: (payload: unknown, msg?: string) => {
          failing.push({ level: 'error', payload, msg })
        },
      },
    })
    expect(failState.isAlive).toBe(false)
    expect(failState.consecutiveFailures).toBe(1)
    const errLog = failing.find((c) => c.level === 'error')
    expect(errLog?.msg).toBe('database keepalive failed')
    expect((errLog?.payload as { err?: unknown; consecutiveFailures?: number }).err).toBe(err)
    expect((errLog?.payload as { consecutiveFailures?: number }).consecutiveFailures).toBe(1)
  })

  it('用例5 源码静态锁：代码面无裸 Date.now() 差值，且定时器真的调用车间 tick', () => {
    const srcPath = fileURLToPath(new URL('../src/plugins/db-keepalive.ts', import.meta.url))
    const code = stripComments(readFileSync(srcPath, 'utf8'))
    // 有牙证明：把任一处改回裸差值（变异②）时这一条必红，而不是靠人记得去看
    expect(code).not.toMatch(/Date\.now\(\)\s*[-+]/)
    expect(code).not.toMatch(/const\s+startMs\s*=/)
    // 判据存在而永不调用 = 没有：定时器必须把 tick 交给走唯一出口的那个实现
    expect(code).toMatch(/setInterval\([\s\S]*?runKeepaliveTick\(\{/)
    expect(code).toMatch(/startStopwatch\(/)
    expect(code).toMatch(/recordSqlQuery\(/)
  })
})

/**
 * 剥注释、保留字符串：静态锁判的是**代码面**（注释里描述旧形态是正当的，
 * 否则门会拦掉"把缺陷写进注释说明原因"这种本仓要求的姿势）。
 */
function stripComments(input: string): string {
  let out = ''
  let quote: string | null = null
  let inLine = false
  let inBlock = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string
    const next = input[i + 1]
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out += ch
      }
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (quote) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i++
      } else if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    out += ch
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
