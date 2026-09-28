// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-727(2026-09-28 立):用户级并发槽位的「占用后未登记释放」泄漏回归。
 *
 * 判的是 `apps/api/src/services/user-concurrency-service.ts` 那份**进程内 Map 计数**的存续性:
 * HEAD 的调用方(`routes/v1-public.ts`)在 `tryAcquireUserConcurrency()` 成功之后隔约 10 行
 * 才把释放挂到 `reply.raw.on('close', …)`(实测见下),中间任何一句抛错都不会再来 close,
 * 于是该用户计数只增不减;而超限分支 `current > limit` 一旦被顶格,这个人在这台进程的余生
 * 都会拿到 429 —— 服务里那句"(防止异常路径漏释放导致永久顶格)"说的就是这一后果,
 * 但泄漏点从来在调用方,服务自己无责也无处可防。
 *
 * 取证构成(每条都成对,反向锁在括号里):
 *  ① 占用成功但释放登记失败 ⇒ 计数当场回落 + 错误原样抛出(变异:摘掉兜底 release ⇒ 本条必红);
 *  ② 同一槽位被多个结算点触发(close + finish + 调用方 finally)⇒ 只减一次
 *     (反向:同一用户的另一个在跑请求不得被多余释放吃掉);
 *  ③ 超限不占用 ⇒ 计数保持原值且拿不到可误调的 release(与改动前行为逐字同形);
 *  ④ 未知/多余释放 ⇒ 计数不被压成负数、且只点名一次(不刷屏);
 *  ⑤ 计数长时间不回 0 ⇒ 下一次占用尝试点名一次 userId(不挂任何定时器);
 *  ⑥ 路由侧装载证明:v1-public 必须走「占用即登记」出口,不得再把 close 回调自己拼回去。
 *
 * 全程零副作用:不连 DB、不发网络、不起 Fastify;`Date.now` 用假时钟只喂 ⑤。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 服务只 import logger 这一个外部依赖:替身让"点名一次"这类判据可测,且不往测试输出里灌日志。 */
const logSpy = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))
vi.mock('../src/utils/logger.js', () => ({ logger: logSpy }))

/**
 * 模块级 Map 是共享可变态:每个用例取一份全新实例,避免用例之间互相顶掉计数。
 * 返回类型由动态 import 推断(eslint 的 consistent-type-imports 禁 `import()` 类型注解,
 * 而这里要的正是"模块命名空间形状"——推断即准确,不必再写一份)。
 */
async function loadFresh() {
  vi.resetModules()
  return await import('../src/services/user-concurrency-service.js')
}

afterEach(() => {
  delete process.env.RELAY_USER_CONCURRENCY_LIMIT
  delete process.env.RELAY_USER_CONCURRENCY_LEAK_WARN_MS
  logSpy.warn.mockClear()
  vi.useRealTimers()
})

describe('① 占用成功而释放登记失败 ⇒ 创建方当场兜底(泄漏点就是这一格)', () => {
  it('res.once 抛错 ⇒ 错误原样继续抛,且计数已回落 0(旧写法在这里永久留一个槽)', async () => {
    const m = await loadFresh()
    // 只在登记 'close' 时抛错的响应流替身(模拟 reply.raw 不可用 / 参数被运行时改坏)
    const throwingRes = {
      once(event: string): unknown {
        if (event === 'close') throw new TypeError('reply.raw.once 不可用')
        return undefined
      },
    }

    expect(() => m.acquireUserConcurrencyForResponse('u-throw', throwingRes)).toThrow(TypeError)
    // 关键断言:抛错之后不留槽 —— 旧写法 tryAcquire 成功后直接返回,这一格会是 1
    expect(m.getUserConcurrencyCurrent('u-throw')).toBe(0)
    expect(m.snapshotCounters().find((r) => r.userId === 'u-throw')).toBeUndefined()
  })

  it('登记成功后处理链立刻抛错 ⇒ close 到来时照样回落(占用与登记之间无可抛代码)', async () => {
    const m = await loadFresh()
    const res = new EventEmitter()
    const slot = m.acquireUserConcurrencyForResponse('u-early-throw', res)
    expect(slot.ok).toBe(true)
    expect(m.getUserConcurrencyCurrent('u-early-throw')).toBe(1)

    // 模拟"占用之后、正常结算之前"处理体抛错:调用方不会再走到任何手写释放,
    // 唯一出路是登记已在位的监听器 —— 连接关闭时必须回落。
    let handlerThrew = false
    try {
      throw new Error('上游转发抛错')
    } catch {
      handlerThrew = true
    }
    expect(handlerThrew).toBe(true)
    expect(m.getUserConcurrencyCurrent('u-early-throw')).toBe(1) // 尚未结算,仍占着

    res.emit('close')
    expect(m.getUserConcurrencyCurrent('u-early-throw')).toBe(0)
  })
})

describe('② 多个结算点都到(close + finish + finally)⇒ 只减一次', () => {
  it('幂等闩:同一槽位被触发三次也只减一次,且不吃掉同用户的另一个在跑请求', async () => {
    const m = await loadFresh()
    const res = new EventEmitter()
    const slot = m.acquireUserConcurrencyForResponse('u-once', res)
    const peer = m.tryAcquireUserConcurrency('u-once') // 同一用户的另一路并发
    expect([slot.ok, peer.ok, m.getUserConcurrencyCurrent('u-once')]).toEqual([true, true, 2])

    slot.release?.() // 结算点 A:调用方 finally
    res.emit('close') // 结算点 B:监听器
    res.emit('finish') // 结算点 C:'finish' 也是登记过的出口
    expect(m.getUserConcurrencyCurrent('u-once')).toBe(1) // 只减了 slot 那一次

    peer.release?.()
    expect(m.getUserConcurrencyCurrent('u-once')).toBe(0)
  })

  it('同一 res 上的两路并发各减各的(close 一次 ⇒ 两个监听器各触发一次)', async () => {
    const m = await loadFresh()
    const res = new EventEmitter()
    const a = m.acquireUserConcurrencyForResponse('u-two', res)
    const b = m.acquireUserConcurrencyForResponse('u-two', res)
    expect([a.ok, b.ok, m.getUserConcurrencyCurrent('u-two')]).toEqual([true, true, 2])

    res.emit('close')
    expect(m.getUserConcurrencyCurrent('u-two')).toBe(0)
    res.emit('finish') // 两个闩都已落 ⇒ 不再减,也不会压成负数
    expect(m.getUserConcurrencyCurrent('u-two')).toBe(0)
  })
})

describe('③ 超限不占用 ⇒ 行为与改动前逐字同形(不被误加也不被误减)', () => {
  it('第二路被拒时 current 保持原值,且结果里没有任何可误调的释放物', async () => {
    process.env.RELAY_USER_CONCURRENCY_LIMIT = '1'
    const m = await loadFresh()
    const res = new EventEmitter()

    const first = m.acquireUserConcurrencyForResponse('u-cap', res)
    expect(first.ok).toBe(true)

    const second = m.acquireUserConcurrencyForResponse('u-cap', res)
    // 改动前语义:ok=false / current 仍是原值 / 不做任何写入;新增的是 release 恒 null
    expect([second.ok, second.current, second.limit, second.release]).toEqual([false, 1, 1, null])
    expect(m.getUserConcurrencyCurrent('u-cap')).toBe(1)

    // 被拒的这一路没有占用 ⇒ close 只该减掉 first 那一个槽(减两次就是吃掉别人的额度)
    res.emit('close')
    expect(m.getUserConcurrencyCurrent('u-cap')).toBe(0)

    // 顶格解除后同一用户可再次占用(证明超限分支没把计数推高)
    const third = m.acquireUserConcurrencyForResponse('u-cap', res)
    expect([third.ok, third.current]).toEqual([true, 1])
  })
})

describe('④ 未知 userId / 多余释放 ⇒ 计数不被压成负数', () => {
  it('对没有槽位的用户调用 releaseUserConcurrency ⇒ 停在 0,只点名一次', async () => {
    const m = await loadFresh()

    m.releaseUserConcurrency('u-ghost')
    expect(m.getUserConcurrencyCurrent('u-ghost')).toBe(0)
    m.releaseUserConcurrency('u-ghost')
    m.releaseUserConcurrency('u-ghost')
    expect(m.getUserConcurrencyCurrent('u-ghost')).toBe(0)
    expect(m.snapshotCounters().find((r) => r.userId === 'u-ghost')).toBeUndefined()
    // 只喊一次(不刷屏),且必须点名 userId —— 否则报出来的是一条无法定位的告警
    expect(logSpy.warn).toHaveBeenCalledTimes(1)
    expect(String(logSpy.warn.mock.calls[0]?.[0])).toContain('u-ghost')

    // 下一次 0→1 重新武装,并确认计数没有被压成负数(1 而不是 0 或 -1)
    const next = m.tryAcquireUserConcurrency('u-ghost')
    expect([next.ok, next.current]).toEqual([true, 1])
  })

  it('合法释放之后再多释放一次 ⇒ 不影响随后的占用起点', async () => {
    const m = await loadFresh()
    const live = m.tryAcquireUserConcurrency('u-mixed')
    expect(live.current).toBe(1)
    live.release?.()
    m.releaseUserConcurrency('u-mixed') // 多余的一次
    expect(m.getUserConcurrencyCurrent('u-mixed')).toBe(0)
    const again = m.tryAcquireUserConcurrency('u-mixed')
    expect(again.current).toBe(1)
  })

  it('snapshotCounters() 的读数不得出现负数行(整表判据,不只单用户)', async () => {
    const m = await loadFresh()
    m.releaseUserConcurrency('u-none')
    m.acquireUserConcurrencyForResponse('u-a', new EventEmitter())
    m.acquireUserConcurrencyForResponse('u-b', new EventEmitter())
    const rows = m.snapshotCounters()
    expect(rows.every((r) => r.current >= 0)).toBe(true)
    expect(rows.map((r) => r.userId).sort()).toEqual(['u-a', 'u-b'])
  })
})

describe('⑤ 泄漏可观测 ⇒ 长时间不回 0 时点名一次(不挂定时器)', () => {
  it('顶格且挂起超过阈值 ⇒ 下一次占用尝试 warn 一次并点名 userId', async () => {
    process.env.RELAY_USER_CONCURRENCY_LIMIT = '1'
    process.env.RELAY_USER_CONCURRENCY_LEAK_WARN_MS = '1000'
    const m = await loadFresh()
    vi.useFakeTimers({ now: 1_000_000 })
    const res = new EventEmitter()

    const held = m.acquireUserConcurrencyForResponse('u-leak', res)
    expect(held.ok).toBe(true)
    expect(logSpy.warn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2_000) // 假时钟推进 ⇒ Date.now 同步前移
    const blocked = m.acquireUserConcurrencyForResponse('u-leak', res)
    expect(blocked.ok).toBe(false)
    expect(logSpy.warn).toHaveBeenCalledTimes(1)
    const msg = String(logSpy.warn.mock.calls[0]?.[0])
    expect(msg).toContain('疑似泄漏')
    expect(msg).toContain('u-leak')

    // 第三次尝试不重复喊(同一个顶格周期只喊一次)
    m.acquireUserConcurrencyForResponse('u-leak', res)
    expect(logSpy.warn).toHaveBeenCalledTimes(1)

    // 回落后重新武装:新一轮刚起 0ms,不该被上一轮的"已喊过"静音,也不该立刻误喊
    res.emit('close')
    logSpy.warn.mockClear()
    vi.advanceTimersByTime(2_000)
    const renewed = m.acquireUserConcurrencyForResponse('u-leak', res)
    expect(renewed.ok).toBe(true)
    expect(logSpy.warn).not.toHaveBeenCalled()

    // 但这一轮若继续挂着不回 0 并被顶格,信号必须再次发出
    vi.advanceTimersByTime(2_000)
    m.acquireUserConcurrencyForResponse('u-leak', res)
    expect(logSpy.warn).toHaveBeenCalledTimes(1)
  })

  it('未超阈值时不喊(告警窗口由 env 决定,不是常数硬编码)', async () => {
    process.env.RELAY_USER_CONCURRENCY_LEAK_WARN_MS = '60000'
    const m = await loadFresh()
    vi.useFakeTimers({ now: 5_000 })
    const res = new EventEmitter()
    m.acquireUserConcurrencyForResponse('u-fresh', res)
    vi.advanceTimersByTime(10_000)
    m.acquireUserConcurrencyForResponse('u-fresh', res)
    expect(logSpy.warn).not.toHaveBeenCalled()
    expect(m.snapshotCounters().find((r) => r.userId === 'u-fresh')?.heldMs).toBe(10_000)
  })
})

describe('⑥ 路由侧装载证明(判据必须在有人跑它的那一刻才成立)', () => {
  const routeSrc = readFileSync(resolve(ROOT, 'src/routes/v1-public.ts'), 'utf8')

  it('v1-public 走「占用即登记」出口,不再自己拼 close 回调', () => {
    expect(routeSrc).toContain('acquireUserConcurrencyForResponse(apiKey.userId, reply.raw)')
  })

  it('旧形态不得回来:占用与释放登记之间不得再隔着可抛代码', () => {
    // 反向锁 1:不得再出现"占用后另起一句挂 close 回调"的写法
    expect(routeSrc).not.toMatch(/reply\.raw\.on\(\s*['"]close['"]\s*,\s*\(\)\s*=>/)
    // 反向锁 2:路由面不得再直接调用裸释放(它不具备按槽位幂等性)
    expect(routeSrc).not.toMatch(/\breleaseUserConcurrency\s*\(/)
    expect(routeSrc).not.toMatch(/\btryAcquireUserConcurrency\s*\(/)
  })

  it('服务面只有一份计数(Map 声明恰一次),诊断面是派生的', () => {
    const svcSrc = readFileSync(resolve(ROOT, 'src/services/user-concurrency-service.ts'), 'utf8')
    expect(svcSrc.match(/^const counters = new Map/gm)?.length).toBe(1)
    // heldSince 存的是时刻不是计数;出现第二份 Map<_, number> 计数面即红
    expect(svcSrc).toContain('const heldSince = new Map<string, number>()')
    expect(svcSrc).not.toContain('setInterval(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
