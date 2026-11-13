// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-224 回归锁(2026-11-13)。
 *
 * 病灶:anti-automation 的 onRequest 把「健康检查/监控 UA 白名单」放在所有判定之前,
 * 命中即 `return` 放行 —— 于是 `User-Agent: monitor` / 含 `uptime` 的任意请求
 * 连扫描器判定、已有 IP 封禁、频率统计一起跳过。UA 是纯客户端头,任何字符串都能伪造,
 * 拿它当前置放行条件等于给反自动化开了一个万能开关。
 *
 * 修复后的语义:UA 白名单最多只豁免频率统计;封禁与扫描器判定对白名单 UA 同样生效。
 * 通用可伪造词 `monitor` / `uptime`(以及扫描面已经在 /metrics 覆盖的 prometheus)从词表移除。
 *
 * 本文件锁:
 *   ① 伪造白名单 UA + 扫描器路径 → 仍按扫描器 403 并封禁;
 *   ② 伪造白名单 UA + 已在封禁名单 → 仍 403 ip-blocked;
 *   ③ 白名单 UA 只在频率统计上被豁免(不进计数器);
 *   ④ 普通 UA 行为不变(正常放行且照常计数);
 *   ⑤ 源锁:处理链里不存在「命中白名单 UA 即提前 return 放行」。
 *
 * 只替换 redis 与 @ihui/auth,不触达真实 Redis / PG。
 */
import { readFile } from 'node:fs/promises'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async () => {
    throw new Error('unused in this suite')
  }),
}))

import antiAutomationPlugin from '../src/plugins/anti-automation.js'

const HEALTH_UA = 'kube-probe/1.29'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0'
const SCANNER_PATH = '/.env'
const NORMAL_PATH = '/api/ping'

/* ----------------------------- 迷你 Redis 替身 ----------------------------- */

interface Entry {
  v: string
  expAt: number
}

function fakeRedis() {
  const store = new Map<string, Entry>()
  const counts = new Map<string, number>()
  /** 记录真正发生过频率计数的 key(用于断言白名单 UA 未计入统计)。 */
  const freqKeys = new Set<string>()

  const alive = (k: string): Entry | undefined => {
    const e = store.get(k)
    if (!e) return undefined
    if (e.expAt && e.expAt <= Date.now()) {
      store.delete(k)
      return undefined
    }
    return e
  }

  return {
    freqKeys,
    hasFreqKey: (k: string) => freqKeys.has(k),
    async get(k: string) {
      return alive(k)?.v ?? null
    },
    async set(k: string, v: string, _mode?: string, sec?: number) {
      store.set(k, { v, expAt: sec ? Date.now() + sec * 1000 : 0 })
      return 'OK'
    },
    async del(...keys: string[]) {
      let n = 0
      for (const k of keys) if (store.delete(k)) n++
      return n
    },
    async incr(k: string) {
      const cur = Number(alive(k)?.v ?? '0') + 1
      const existing = store.get(k)
      store.set(k, { v: String(cur), expAt: existing?.expAt ?? 0 })
      return cur
    },
    async expire(k: string, sec: number) {
      const e = store.get(k)
      if (!e) return 0
      e.expAt = Date.now() + sec * 1000
      return 1
    },
    async ttl(k: string) {
      const e = alive(k)
      if (!e) return -2
      return e.expAt ? Math.round((e.expAt - Date.now()) / 1000) : -1
    },
    /** 预置一条封禁(等价于其他钩子/管理员此前写入的封禁)。 */
    seedBlocked(ip: string, reason: string, sec: number) {
      store.set(`ip:blocked:${ip}`, {
        v: `${reason}|${Date.now()}`,
        expAt: Date.now() + sec * 1000,
      })
    },
    multi() {
      const ops: Array<() => unknown> = []
      const pipe = {
        zremrangebyscore(_key: string, _min: number, _max: number) {
          ops.push(() => 0)
          return pipe
        },
        zcard(key: string) {
          ops.push(() => {
            freqKeys.add(key)
            return counts.get(key) ?? 0
          })
          return pipe
        },
        zadd(key: string, _score: number, _member: string) {
          ops.push(() => {
            freqKeys.add(key)
            counts.set(key, (counts.get(key) ?? 0) + 1)
            return 1
          })
          return pipe
        },
        pexpire(_key: string, _ms: number) {
          ops.push(() => 1)
          return pipe
        },
        async exec() {
          const out: Array<[null, unknown]> = []
          for (const op of ops) out.push([null, op()])
          return out
        },
      }
      return pipe
    },
  }
}

type FakeRedis = ReturnType<typeof fakeRedis>

describe('F-224 白名单 UA 不得豁免封禁与扫描器判定', () => {
  let app: FastifyInstance
  let redis: FakeRedis

  beforeAll(async () => {
    redis = fakeRedis()
    app = Fastify({ logger: false })
    app.decorate('redis', redis as unknown as never)
    app.get(NORMAL_PATH, async () => ({ ok: true }))
    app.get(SCANNER_PATH, async () => ({ ok: true }))
    await app.register(antiAutomationPlugin)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('① 伪造白名单 UA + 扫描器路径 → 仍按扫描器 403 并封禁 1 小时', async () => {
    const ip = '203.0.113.11'
    const res = await app.inject({
      method: 'GET',
      url: SCANNER_PATH,
      remoteAddress: ip,
      headers: { 'user-agent': HEALTH_UA },
    })

    expect(res.statusCode).toBe(403)
    expect(res.headers['x-block-reason']).toBe('scanner-detected')
    expect(res.headers['retry-after']).toBe('3600')
    // 封禁确实落库:换普通 UA 再来,依然是 ip-blocked
    const followUp = await app.inject({
      method: 'GET',
      url: NORMAL_PATH,
      remoteAddress: ip,
      headers: { 'user-agent': BROWSER_UA },
    })
    expect(followUp.statusCode).toBe(403)
    expect(followUp.headers['x-block-reason']).toBe('ip-blocked')
  })

  it('② 伪造白名单 UA + 已在封禁名单 → 仍 403 ip-blocked', async () => {
    const ip = '203.0.113.12'
    redis.seedBlocked(ip, 'admin-block', 600)

    const res = await app.inject({
      method: 'GET',
      url: NORMAL_PATH,
      remoteAddress: ip,
      headers: { 'user-agent': HEALTH_UA },
    })

    expect(res.statusCode).toBe(403)
    expect(res.headers['x-block-reason']).toBe('ip-blocked')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('③ 白名单 UA 只在频率统计上被豁免 —— 不进计数器', async () => {
    const ip = '203.0.113.13'
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'GET',
        url: NORMAL_PATH,
        remoteAddress: ip,
        headers: { 'user-agent': HEALTH_UA },
      })
      expect(res.statusCode).toBe(200)
    }
    expect(redis.hasFreqKey(`anti:auto:ip:${ip}`)).toBe(false)
  })

  it('④ 普通 UA 行为不变:正常放行且照常计数', async () => {
    const ip = '203.0.113.14'
    const res = await app.inject({
      method: 'GET',
      url: NORMAL_PATH,
      remoteAddress: ip,
      headers: { 'user-agent': BROWSER_UA },
    })
    expect(res.statusCode).toBe(200)
    expect(redis.hasFreqKey(`anti:auto:ip:${ip}`)).toBe(true)
  })

  it('⑤ 源锁:处理链中不存在「命中白名单 UA 即提前 return 放行」', async () => {
    const src = await readFile(
      new URL('../src/plugins/anti-automation.ts', import.meta.url),
      'utf8',
    )

    // 白名单只作为频率统计的开关存在,不得出现在 return 前置判定里
    expect(src).toMatch(/const healthCheckUa = isHealthCheckUa\(ua\)/)
    expect(src).not.toMatch(/if \(isHealthCheckUa\([^)]*\)\)\s*(?:\{\s*)?return/)
    // 健康检查 UA 与频率挑战白名单合流为频率段开关(2026-11-13 立 ANTI_AUTOMATION_ALLOWLIST):
    // 两者都只在该 if 内跳过频率统计,不得在频率段之前提前 return 放行。
    expect(src).toMatch(/if \(!healthCheckUa && !isRateAllowlisted\(ip\)\) \{/)
    // 旧的单条件频率开关应已不存在(健康检查 UA 不再是唯一开关)
    expect(src).not.toMatch(/if \(!healthCheckUa\) \{/)
    // 通用可伪造词已移除
    expect(src).not.toMatch(/'monitor'/)
    expect(src).not.toMatch(/'uptime'/)
    expect(src).not.toMatch(/'prometheus'/)
  })
})
