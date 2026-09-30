// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-668 三落点接线证明:忙时收到的 tick 不得丢。
 *
 * 1. 行为面(scheduler):第一轮 select 悬在半空时第二个 interval 到点 ⇒ 旧形态
 *    `if (running) return` 会把这一轮整轮丢掉(select 只会调 1 次),单飞工厂把
 *    它记账并在本轮结束立即补跑(select 调 2 次,且不等下个 interval)。
 * 2. 结构面(repair):buildRepairService 的装配链依赖真实 Redis/服务图,行为面
 *    复刻成本远超信息量;三落点改用同一工厂,此处以静态断言钉住"两处旧
 *    busy-skip 形态已消失、工厂已接线",语义由工厂自己的用例背书
 *    (automations-busy-tick-replay.test.ts)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/** db mock:第一次 select 的 promise 被测试手工扣住,之后一律立即返回空。 */
vi.mock('../src/db/index.js', () => {
  let selectCount = 0
  let releaser: () => void = () => {}
  const gate = new Promise<never[]>((resolve) => {
    releaser = () => resolve([])
  })
  function createChain(hold: boolean) {
    const source = hold ? gate : Promise.resolve([] as never[])
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => source.then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) chain[m] = () => chain
    return chain
  }
  return {
    __releaseFirstSelect: () => releaser(),
    __selectCount: () => selectCount,
    db: {
      select: vi.fn(() => {
        selectCount += 1
        return createChain(selectCount === 1)
      }),
    },
  }
})

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetchStream: vi.fn(),
}))

// 只伪造 setInterval,微任务走真实时钟 —— 补跑是 microtask 级的,不该被假钟吞掉
vi.useFakeTimers({ toFake: ['setInterval'] })

const dbMock = (await import('../src/db/index.js')) as unknown as {
  __releaseFirstSelect: () => void
  __selectCount: () => number
}
const { startAgentAutomationScheduler, stopAgentAutomationScheduler } = await import(
  '../src/services/agent-automation-scheduler.js'
)

afterEach(() => {
  stopAgentAutomationScheduler()
})

describe('G-668 接线:scheduler 忙时 tick 记账补跑', () => {
  it('busy 期到点的 interval 不丢:第一轮扣住,第二轮记账,放行后立即补跑(select 共 2 次)', async () => {
    startAgentAutomationScheduler()

    // 第一轮:tick 进入 select 并被扣住 ⇒ 处于 busy
    await vi.advanceTimersToNextTimerAsync()
    expect(dbMock.__selectCount()).toBe(1)

    // 第二轮:旧形态 `if (running) return` 在这里把整轮丢掉;现在只记账
    await vi.advanceTimersToNextTimerAsync()
    expect(dbMock.__selectCount()).toBe(1)

    // 放行第一轮 ⇒ 补跑立即发生,不等下个 interval
    dbMock.__releaseFirstSelect()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(dbMock.__selectCount()).toBe(2)
  })
})

describe('G-668 接线:三落点静态结构', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const srcOf = (p: string) => readFileSync(join(here, '..', 'src', p), 'utf8')

  it('scheduler 与 repair 均已改走 createSingleFlightTick,旧 busy-skip 形态清零', () => {
    const scheduler = srcOf(join('services', 'agent-automation-scheduler.ts'))
    expect(scheduler).toContain('createSingleFlightTick')
    expect(scheduler).not.toMatch(/^\s*if \(running\) return$/m)

    const repair = srcOf(join('services', 'automation-repair-service.ts'))
    expect(repair).toContain('createSingleFlightTick')
    expect(repair).not.toContain('repairCycleRunning')

    // 第一落点(automations/index.ts)是工厂本体,工厂名与三处消费面同源
    const automations = srcOf(join('services', 'automations', 'index.ts'))
    expect(automations).toContain('export function createSingleFlightTick')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
