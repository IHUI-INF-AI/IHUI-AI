// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 限流跨实例共享回归锁(2026-10-28 立)。
 *
 * 背景:`@fastify/rate-limit` 未传 store 时落 LocalStore(进程内存),多副本部署下
 * 额度按副本数放大(登录 5/min 实际 = 5×N),且进程重启即清零。server.ts 现改为
 * 传 Redis 连接承载计数。本文件守三件事:
 *   1) 两个**独立** Fastify 实例共享同一个 Redis 计数 ⇒ 配额不被副本数放大;
 *   2) 插件层在 `skipOnError: true` 时 Redis 报错按 fail-open 放行,绝不能变成 500
 *      —— 这一格写的是**插件**行为基线,用于解释"为什么 server.ts 需要更强的方案";
 *   3) 接线锁:server.ts 不得退回"无 store 的本地限流"。
 *
 * 2026-10-28 二次 redesign(安全审计 P1 后续):server.ts 不再用 `redis:` + skipOnError:true
 * 的 fail-open 形态,改为 `store: createFailSafeRateLimitStore(rateLimitRedis, 'ihui:rl:')`
 * + `skipOnError: false` —— Redis 故障回退进程内保守计数(不 fail-open 打穿限流,也不硬 500)。
 * 故第 2 条只描述插件层基线,接线锁按新形态判(见下方「接线锁」段注释)。
 *
 * 这里用内存假 Redis 模拟**服务端**行为(计数 + 过期),不是复制插件内的 Lua 判据;
 * 判据(窗口/上限/是否放行)仍由 @fastify/rate-limit 与 RedisStore 自己算。
 */
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { afterEach, describe, expect, it } from 'vitest'

/** 内存假 Redis:只实现 RedisStore 会用到的那两个命令入口。 */
function createFakeRedis() {
  const store = new Map<string, { count: number; expiresAt: number }>()
  return {
    defineCommand(_name: string, _def: unknown) {
      /* RedisStore 构造时会注册 rateLimit / rateLimitRead,假实现无需动作 */
    },
    rateLimit(
      key: string,
      timeWindow: number,
      _max: number,
      _continueExceeding: boolean,
      _exponentialBackoff: boolean,
      cb: (err: Error | null, res?: number[]) => void,
    ) {
      const now = Date.now()
      const rec = store.get(key)
      if (!rec || rec.expiresAt <= now) {
        store.set(key, { count: 1, expiresAt: now + timeWindow })
        cb(null, [1, timeWindow])
        return
      }
      rec.count += 1
      cb(null, [rec.count, rec.expiresAt - now])
    },
    rateLimitRead(_key: string, cb: (err: Error | null, res?: number[]) => void) {
      cb(null, [0, 0])
    },
  }
}

const apps: ReturnType<typeof Fastify>[] = []

afterEach(async () => {
  while (apps.length > 0) await apps.pop()!.close()
})

async function makeApp(redis: unknown, opts: { max?: number; skipOnError?: boolean } = {}) {
  const app = Fastify({ logger: false })
  await app.register(rateLimit, {
    max: opts.max ?? 2,
    timeWindow: 60_000,
    redis,
    nameSpace: 'ihui:rl:',
    skipOnError: opts.skipOnError ?? true,
  })
  app.get('/probe', async () => ({ ok: true }))
  apps.push(app)
  return app
}

describe('限流计数跨实例共享', () => {
  it('两个独立实例共用同一 Redis ⇒ 额度不被副本数放大', async () => {
    const fake = createFakeRedis()
    const a = await makeApp(fake, { max: 2 })
    const b = await makeApp(fake, { max: 2 })

    // A 用掉整个配额(2 次)
    expect((await a.inject('/probe')).statusCode).toBe(200)
    expect((await a.inject('/probe')).statusCode).toBe(200)
    expect((await a.inject('/probe')).statusCode).toBe(429)

    // B 是另一个实例,若各自计数则此处应为 200 —— 共享计数下必须已被拒
    expect((await b.inject('/probe')).statusCode).toBe(429)
  })

  it('不同 IP 各自独立计数(共享不等于串号)', async () => {
    const fake = createFakeRedis()
    const a = await makeApp(fake, { max: 1 })
    const b = await makeApp(fake, { max: 1 })

    const fromA = await a.inject({ url: '/probe', remoteAddress: '203.0.113.9' })
    const fromB = await b.inject({ url: '/probe', remoteAddress: '203.0.113.10' })

    expect(fromA.statusCode).toBe(200)
    expect(fromB.statusCode).toBe(200)
  })
})

describe('Redis 故障时 fail-open(与 distributed-rate-limit 同判据)', () => {
  it('store 报错 ⇒ 放行,不得变成 500', async () => {
    const broken = {
      defineCommand() {},
      rateLimit(
        _k: string,
        _tw: number,
        _m: number,
        _ce: boolean,
        _eb: boolean,
        cb: (err: Error | null, res?: number[]) => void,
      ) {
        cb(new Error('redis down'))
      },
      rateLimitRead(_k: string, cb: (err: Error | null, res?: number[]) => void) {
        cb(new Error('redis down'))
      },
    }
    const app = await makeApp(broken, { max: 1 })

    expect((await app.inject('/probe')).statusCode).toBe(200)
    expect((await app.inject('/probe')).statusCode).toBe(200)
  })
})

describe('接线锁:server.ts 不得退回进程内限流', () => {
  const src = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8')
  /** register(rateLimit, { … }) 的参数块本身 —— 判据只看这一块,避免全文件的近似匹配。 */
  const wiring = /register\(rateLimit,\s*\{([\s\S]*?)\n\s*\}\)/.exec(src)?.[1] ?? ''

  it('全局限流必须由 Redis 连接支撑(2026-10-28 起经失稳安全存储包裹)', () => {
    // 旧形态 `redis: rateLimitRedis` 已被 redesign 取代:限流存储换成
    // createFailSafeRateLimitStore(rateLimitRedis, 'ihui:rl:') —— Redis 正常时走分布式
    // 原子计数,Redis 抖动时回退进程内保守计数(既不 fail-open 打穿限流,也不硬 500)。
    // 判据要求两半都在:包装器 + Redis 连接;不传 store 就是退回 LocalStore,
    // 额度按副本数放大、重启即清零 —— 那才是本锁要拦的方向。
    expect(wiring).toMatch(/store:\s*createFailSafeRateLimitStore\(\s*rateLimitRedis/)
    // 命名空间与 distributedRateLimit 的 `ihui:ratelimit` 区分开(两套限流不互相污染计数)
    expect(wiring).toMatch(/nameSpace:\s*'ihui:rl:'/)
  })

  it('必须显式声明 skipOnError(默认 false 会让 Redis 抖动变成 500)', () => {
    // redesign 后语义与旧判据相反:存储层自己做本地兜底,故 server.ts 显式钉 false ——
    // 连兜底都意外抛错时按 fail-closed 处理,绝不静默放行(这里的隐患已从"默认 false"
    // 变成"抄成 true 会打穿限流")。判据因此要求**显式写死**,而不是要求它为 true。
    expect(wiring).toMatch(/skipOnError:\s*false/)
  })

  it('限流专用连接必须复用 createRedisClient 单源,并自己负责关闭', () => {
    expect(src).toMatch(/createRedisClient/)
    expect(src).toMatch(/rateLimitRedis\.quit\(\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
