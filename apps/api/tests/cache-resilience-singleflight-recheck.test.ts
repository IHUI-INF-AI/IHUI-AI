// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * singleflight 第②半回归 —— apps/api/src/plugins/cache-resilience.ts
 *
 * 票面两半：
 *  ① 失败不固化（既有：`finally { inflight.delete(key) }`）—— 本文件反向锁钉，不许被削；
 *  ② 等锁者按自己声明的必需项复检 —— 本文件正向钉住。
 *
 * 判据（对旧实现是阳性对照，旧实现在 ②/③/⑤ 例必红）：
 *  - 必需项齐全 ⇒ 等锁者复用共享结果，loader 只回源一次；
 *  - 必需项缺失 ⇒ 等锁者不吃这份缓存，自己回源重算（可被断言的独立行为）；
 *  - 判不了（声明缺失 / 形状看不懂）⇒ 落「未判定」并点名：
 *    既不折成 satisfied（不谎报通过），也不折成全部拒绝（该复用的照样复用）；
 *  - leader 失败 ⇒ inflight 必须摘票，后续同 key 请求能重新回源。
 * 零连库：假 Redis(Map) + 假 logger 注入，不触生产 8810/8811。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import {
  cacheResilience,
  recheckRequiredPaths,
  cachePathPresent,
  parseCachePath,
} from '../src/plugins/cache-resilience.js'

interface FakeRedis {
  store: Map<string, string>
  setTtls: Array<{ key: string; ttlSec: number }>
  get(key: string): Promise<string | null>
  set(key: string, value: string, _mode?: string, ttlSec?: number): Promise<string>
  del(key: string): Promise<number>
}

function makeFakeRedis(): FakeRedis {
  const store = new Map<string, string>()
  const setTtls: Array<{ key: string; ttlSec: number }> = []
  return {
    store,
    setTtls,
    async get(key: string) {
      const v = store.get(key)
      return v === undefined ? null : v
    },
    async set(key: string, value: string, _mode?: string, ttlSec?: number) {
      store.set(key, value)
      if (typeof ttlSec === 'number') setTtls.push({ key, ttlSec })
      return 'OK'
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0
    },
  }
}

interface CapturedLog {
  level: string
  obj: Record<string, unknown>
  msg: string
}

/** 假 logger：只为断言「未判定必须点名」——warn 载荷里必须带 key 与 reason。 */
function makeCaptureLogger(sink: CapturedLog[]): Record<string, unknown> {
  const emit = (level: string) => (obj: unknown, msg?: string) => {
    sink.push({ level, obj: (obj ?? {}) as Record<string, unknown>, msg: String(msg ?? '') })
  }
  const logger: Record<string, unknown> = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
  }
  logger.child = () => logger
  return logger
}

const KEY = 'ihui:cache:' // 与插件内 KEY_PREFIX 对齐(断言直接拼完整键名)

let app: FastifyInstance
let fake: FakeRedis
let logs: CapturedLog[]

beforeEach(async () => {
  fake = makeFakeRedis()
  logs = []
  // loggerInstance: Fastify v5 收自定义 logger 实例的通道(传 logger 会报 FST_ERR_LOG_INVALID_LOGGER_CONFIG)
  app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
  const decorable = app as unknown as { decorate(name: string, value: unknown): void }
  decorable.decorate('redis', fake)
  decorable.decorate('recordCache', () => {})
  await app.register(cacheResilience)
  await app.ready()
})

afterEach(async () => {
  await app.close() // 清雪崩预热定时器(onClose 钩子)
})

/** 手动闸门：让 leader/等锁者的时序可确定，不靠 sleep 竞速。 */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('singleflight 等锁者按自己声明的必需项复检', () => {
  it('① 正向·必需项齐全 ⇒ 等锁者复用共享结果，回源只跑一次', async () => {
    const gate = deferred<{ id: number; detail: string }>()
    let leaderCalls = 0
    const leader = app.cacheResilience.getOrLoad('agent:full', 60, async () => {
      leaderCalls += 1
      return gate.promise
    })
    let waiterCalls = 0
    const waiter = app.cacheResilience.getOrLoad(
      'agent:full',
      60,
      async () => {
        waiterCalls += 1
        return { id: 1, detail: 'never-used' }
      },
      { requiredPaths: ['id', 'detail'] },
    )
    gate.resolve({ id: 1, detail: 'shared' })

    expect(await leader).toEqual({ id: 1, detail: 'shared' })
    expect(await waiter).toEqual({ id: 1, detail: 'shared' })
    expect(leaderCalls).toBe(1)
    expect(waiterCalls).toBe(0) // 等锁者吃了共享结果
    const stats = app.cacheResilience.singleflightRecheckStats()
    expect(stats.satisfied).toBe(1)
    expect(stats.violated).toBe(0)
    expect(stats.undecided).toBe(0)
  })

  it('② 正向·必需项缺失 ⇒ 等锁者不吃这份缓存，自己回源重算(阳性对照:旧实现必红)', async () => {
    const gate = deferred<{ id: number }>()
    const leader = app.cacheResilience.getOrLoad('agent:miss', 60, () => gate.promise)
    let waiterCalls = 0
    const waiter = app.cacheResilience.getOrLoad(
      'agent:miss',
      60,
      async () => {
        waiterCalls += 1
        return { id: 1, detail: 'full' }
      },
      { requiredPaths: ['id', 'detail'] },
    )
    gate.resolve({ id: 1 })

    expect(await leader).toEqual({ id: 1 })
    // 阳性对照:旧实现在这里把 leader 那份 {id:1} 直接递给等锁者 ⇒ 下面这条必红
    expect(await waiter).toEqual({ id: 1, detail: 'full' })
    expect(waiterCalls).toBe(1) // 等锁者自己回源了一次
    const stats = app.cacheResilience.singleflightRecheckStats()
    expect(stats.violated).toBe(1)
    expect(stats.satisfied).toBe(0)
    // 等锁者回源的结果照常回填(缓存里不再是缺字段的那一份)
    expect(fake.store.get(`${KEY}agent:miss`)).toBe('{"id":1,"detail":"full"}')
    // 等锁者自起的那一票也必须摘掉 ⇒ 第三次同 key 读必须命中缓存、不再回源
    const third = await app.cacheResilience.getOrLoad('agent:miss', 60, async () => {
      waiterCalls += 1
      return { id: 9, detail: 'should-not-happen' }
    })
    expect(third).toEqual({ id: 1, detail: 'full' })
    expect(waiterCalls).toBe(1)
  })

  it('③ 嵌套/数组路径可判:`items[0].name` 齐全复用、`items[1].id` 缺失判缺', async () => {
    const gate = deferred<{ items: Array<{ id: number; name: string }> }>()
    const leader = app.cacheResilience.getOrLoad('list:a', 60, () => gate.promise)
    let waiterCalls = 0
    const waiter = app.cacheResilience.getOrLoad(
      'list:a',
      60,
      async () => {
        waiterCalls += 1
        return { items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] }
      },
      // 越界下标 ⇒ 判缺(等锁者要两行，leader 只回填了一行)
      { requiredPaths: ['items[0].id', 'items[0].name', 'items[1].id'] },
    )
    gate.resolve({ items: [{ id: 1, name: 'a' }] })

    expect(await leader).toEqual({ items: [{ id: 1, name: 'a' }] })
    expect(await waiter).toEqual({ items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] })
    expect(waiterCalls).toBe(1)
    expect(app.cacheResilience.singleflightRecheckStats().violated).toBe(1)
    // 缺失项被点名，不许笼统说"不合格"
    const warn = logs.find((l) => l.level === 'warn' && l.msg.includes('必需项'))
    expect(warn).toBeDefined()
    expect((warn!.obj as { missing?: string[] }).missing).toEqual(['items[1].id'])
  })

  it('④ 未判定·声明缺失 ⇒ 落 undecided 并点名;不谎报通过,也不折成全部拒绝', async () => {
    const gate = deferred<{ id: number }>()
    const leader = app.cacheResilience.getOrLoad('agent:nodecl', 60, () => gate.promise)
    let waiterCalls = 0
    // 老调用方形态:不声明必需项
    const waiter = app.cacheResilience.getOrLoad('agent:nodecl', 60, async () => {
      waiterCalls += 1
      return { id: 99 }
    })
    gate.resolve({ id: 1 })

    expect(await leader).toEqual({ id: 1 })
    expect(await waiter).toEqual({ id: 1 })
    // 未判定不许折成全部拒绝:该复用的照样复用(向后兼容)
    expect(waiterCalls).toBe(0)
    const stats = app.cacheResilience.singleflightRecheckStats()
    // 未判定也不许折成通过:satisfied 不 +1
    expect(stats.undecided).toBe(1)
    expect(stats.satisfied).toBe(0)
    expect(stats.violated).toBe(0)
    expect(stats.lastUndecided).toEqual({
      key: 'agent:nodecl',
      reason: 'no-declaration',
      detail: 'requiredPaths 未声明',
    })
    // 点名:warn 载荷里必须带 key + reason
    const warn = logs.find((l) => l.level === 'warn' && l.msg.includes('未判定'))
    expect(warn).toBeDefined()
    expect(warn!.obj.key).toBe('agent:nodecl')
    expect(warn!.obj.reason).toBe('no-declaration')
  })

  it('⑤ 未判定·形状看不懂 ⇒ 落 undecided 并点名;既非通过也非全部拒绝', async () => {
    const gate = deferred<{ id: number }>()
    const leader = app.cacheResilience.getOrLoad('agent:badshape', 60, () => gate.promise)
    let waiterCalls = 0
    // 声明了但形状看不懂:空串路径 + 非字符串项
    const waiter = app.cacheResilience.getOrLoad(
      'agent:badshape',
      60,
      async () => {
        waiterCalls += 1
        return { id: 99 }
      },
      { requiredPaths: ['', 42] as unknown as string[] },
    )
    gate.resolve({ id: 1 })

    expect(await leader).toEqual({ id: 1 })
    expect(await waiter).toEqual({ id: 1 })
    expect(waiterCalls).toBe(0) // 不折成全部拒绝
    const stats = app.cacheResilience.singleflightRecheckStats()
    expect(stats.undecided).toBe(1)
    expect(stats.satisfied).toBe(0) // 不折成通过
    expect(stats.lastUndecided?.reason).toBe('unreadable-shape')
    expect(stats.lastUndecided?.key).toBe('agent:badshape')
    expect(stats.lastUndecided?.detail).toContain('无法解析的必需路径')
    // 非数组形态同样落未判定
    const gate2 = deferred<{ id: number }>()
    const l2 = app.cacheResilience.getOrLoad('agent:notarray', 60, () => gate2.promise)
    const w2 = app.cacheResilience.getOrLoad(
      'agent:notarray',
      60,
      async () => ({ id: 99 }),
      { requiredPaths: 'id' as unknown as string[] },
    )
    gate2.resolve({ id: 1 })
    expect(await l2).toEqual({ id: 1 })
    expect(await w2).toEqual({ id: 1 })
    const stats2 = app.cacheResilience.singleflightRecheckStats()
    expect(stats2.undecided).toBe(2)
    expect(stats2.satisfied).toBe(0)
    expect(stats2.lastUndecided?.detail).toContain('应为 string[]')
  })

  it('⑥ 反向锁钉·失败不固化未被破坏:leader 失败后同 key 仍能重新回源', async () => {
    let shouldFail = true
    let calls = 0
    const loader = async (): Promise<{ ok: number }> => {
      calls += 1
      if (shouldFail) throw new Error('boom')
      return { ok: 1 }
    }
    const gate = deferred<{ ok: number }>()
    const leader = app.cacheResilience.getOrLoad('agent:fail', 60, () => gate.promise)
    const waiter = app.cacheResilience.getOrLoad('agent:fail', 60, loader, {
      requiredPaths: ['ok'],
    })
    gate.reject(new Error('boom'))

    await expect(leader).rejects.toThrow('boom')
    await expect(waiter).rejects.toThrow('boom')
    // 等锁者不因为"没拿到结果"就自己去回源一次(失败不重试，仅与 leader 共享同一错误)
    expect(calls).toBe(0)

    // 关键反向钉:若 finally { inflight.delete(key) } 被削，这一票会永久留在 inflight，
    // 下面的请求会一直拿到同一个 rejected Promise ⇒ 必然翻红。
    shouldFail = false
    const retried = await app.cacheResilience.getOrLoad('agent:fail', 60, loader)
    expect(retried).toEqual({ ok: 1 })
    expect(calls).toBe(1)
    // 成功后再取命中缓存，不再回源
    const cached = await app.cacheResilience.getOrLoad('agent:fail', 60, loader)
    expect(cached).toEqual({ ok: 1 })
    expect(calls).toBe(1)
  })

  it('⑦ 复检判定单元:齐全/判缺/未判定三态互斥,且 null 视为存在', () => {
    const full = { id: 1, detail: 'x', items: [{ n: null }] }
    expect(recheckRequiredPaths(full, ['id', 'detail']).kind).toBe('satisfied')
    // null 是显式空值 ⇒ 算存在(不许把"字段在但为空"误杀成缺字段)
    expect(cachePathPresent(full, parseCachePath('items[0].n')!)).toBe(true)
    expect(recheckRequiredPaths(full, ['items[0].n']).kind).toBe('satisfied')

    const lacking = recheckRequiredPaths(full, ['id', 'nope.deep'])
    expect(lacking.kind).toBe('violated')
    expect((lacking as { missing: string[] }).missing).toEqual(['nope.deep'])

    // 原型链键一律判"看不懂"，不许污染遍历
    expect(recheckRequiredPaths(full, ['__proto__.x']).kind).toBe('undecided')
    // 形状看不懂优先于判缺:不许拿"其余几条都在"折成通过
    const mixed = recheckRequiredPaths(full, ['id', 'nope', ''])
    expect(mixed.kind).toBe('undecided')

    expect(recheckRequiredPaths(full, undefined).kind).toBe('undecided')
    // 空声明 = 没有必需项 ⇒ 齐全(不是未判定)
    expect(recheckRequiredPaths(full, []).kind).toBe('satisfied')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

