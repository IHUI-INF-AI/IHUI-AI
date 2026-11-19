// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 测试档 Redis 替身(全局)。
//
// 为什么必须在这一格:auth 插件用 `new IORedis(REDIS_URL)` 建 access token 黑名单,
// 而测试档 REDIS_URL 指向的实例不存在 ⇒ `blacklist.has()` 抛错 ⇒ fail-closed 判"已吊销"
// ⇒ 任何"该 200/201/403 的用例"都被洗成 401(api 全量实测 100+ 例同因)。
//
// 这里给一个**进程内内存 Redis**:语义按真 Redis 简化实现,不改变任何产品判据,
// 只把"测试环境没有 Redis"这一事实替换成"有一台空库的 Redis"。
// 两个必须守住的边界:
//   ① **跨文件清零**:同一 worker 里多个用例文件共享这枚库,配额/锁/验证码键若不清理
//      会串档(实测把"该 200"洗成 429/400);beforeAll 先清、afterAll 再清。
//   ② **可被覆盖**:需要精确控制 Redis(故障注入、锁语义)的用例自己
//      `vi.mock('ioredis')`,它们的工厂会整体替换本档,互不干扰。
import { afterAll, beforeAll, vi } from 'vitest'

const redisEntries = vi.hoisted(() => new Map<string, { value: string; expiresAt: number | null }>())

vi.mock('ioredis', () => {
  const store = redisEntries
  const alive = (k: string): { value: string; expiresAt: number | null } | null => {
    const e = store.get(k)
    if (!e) return null
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      store.delete(k)
      return null
    }
    return e
  }
  /** SET 的可选参数只实现本项目实际用到的 EX/PX/NX。 */
  const setWithMode = (key: string, value: string, args: unknown[]): 'OK' | null => {
    const upper = args.map((a) => (typeof a === 'string' ? a.toUpperCase() : ''))
    const ex = upper.indexOf('EX')
    const px = upper.indexOf('PX')
    if (upper.includes('NX') && alive(key)) return null
    const expiresAt =
      ex >= 0 ? Date.now() + Number(args[ex + 1]) * 1000 : px >= 0 ? Date.now() + Number(args[px + 1]) : null
    store.set(key, { value, expiresAt })
    return 'OK'
  }
  class FakeRedis {
    /** 生产代码会读它(如 window-counter 的 reset 只走 ready 档)。 */
    status = 'ready'
    on(): this {
      return this
    }
    once(): this {
      return this
    }
    off(): this {
      return this
    }
    async get(key: string): Promise<string | null> {
      return alive(key)?.value ?? null
    }
    async set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
      return setWithMode(key, value, args)
    }
    async setex(key: string, seconds: number, value: string): Promise<'OK'> {
      store.set(key, { value, expiresAt: Date.now() + Number(seconds) * 1000 })
      return 'OK'
    }
    async getdel(key: string): Promise<string | null> {
      const v = alive(key)?.value ?? null
      store.delete(key)
      return v
    }
    async exists(...keys: string[]): Promise<number> {
      return keys.filter((k) => alive(k)).length
    }
    async del(...keys: string[]): Promise<number> {
      let n = 0
      for (const k of keys) if (store.delete(k)) n += 1
      return n
    }
    async unlink(...keys: string[]): Promise<number> {
      return this.del(...keys)
    }
    async incr(key: string): Promise<number> {
      const prev = alive(key)
      const next = Number(prev?.value ?? '0') + 1
      store.set(key, { value: String(next), expiresAt: prev?.expiresAt ?? null })
      return next
    }
    async decr(key: string): Promise<number> {
      const prev = alive(key)
      const next = Number(prev?.value ?? '0') - 1
      store.set(key, { value: String(next), expiresAt: prev?.expiresAt ?? null })
      return next
    }
    async expire(key: string, seconds: number): Promise<number> {
      const e = alive(key)
      if (!e) return 0
      e.expiresAt = Date.now() + Number(seconds) * 1000
      return 1
    }
    async pexpire(key: string, ms: number): Promise<number> {
      const e = alive(key)
      if (!e) return 0
      e.expiresAt = Date.now() + Number(ms)
      return 1
    }
    async ttl(key: string): Promise<number> {
      const e = alive(key)
      if (!e) return -2
      return e.expiresAt === null ? -1 : Math.ceil((e.expiresAt - Date.now()) / 1000)
    }
    async pttl(key: string): Promise<number> {
      const e = alive(key)
      if (!e) return -2
      return e.expiresAt === null ? -1 : Math.max(0, e.expiresAt - Date.now())
    }
    async keys(): Promise<string[]> {
      return [...store.keys()].filter((k) => alive(k))
    }
    async scan(_cursor: string, ..._args: unknown[]): Promise<[string, string[]]> {
      return ['0', [...store.keys()].filter((k) => alive(k))]
    }
    async mget(...keys: string[]): Promise<Array<string | null>> {
      return keys.map((k) => alive(k)?.value ?? null)
    }
    /**
     * 只复刻本项目实际在用的三条 Lua:
     *   ① 验证码原子消费(code-store):GET + cjson 校验 + DEL ⇒ 1/0;
     *   ② 分布式锁释放(relay-account-shared-state):GET 比对 token + DEL ⇒ 1/0;
     *   ③ 登录失败自增(account-lockout):INCR + 首次 EXPIRE ⇒ 计数。
     * 其它脚本一律返回 0(调用方按"不命中"处理),不猜语义。
     */
    async eval(script: string, numKeys: number, ...rest: unknown[]): Promise<number> {
      const lower = script.toLowerCase()
      const keys = rest.slice(0, numKeys).map((k) => String(k))
      const argv = rest.slice(numKeys)
      if (lower.includes('cjson.decode')) {
        const key = keys[0] ?? ''
        const raw = alive(key)?.value
        if (!raw) return 0
        try {
          const entry = JSON.parse(raw) as { code?: string; expiresAt?: number }
          if (entry.code !== String(argv[0])) return 0
          if (typeof entry.expiresAt === 'number' && entry.expiresAt <= Number(argv[1])) return 0
        } catch {
          return 0
        }
        store.delete(key)
        return 1
      }
      // 退款脚本(window-counter.refundWindows):逐键 GET + DECR。
      if (lower.includes('decr')) {
        for (const key of keys) {
          const prev = alive(key)
          if (prev && Number(prev.value) > 0) {
            store.set(key, { value: String(Number(prev.value) - 1), expiresAt: prev.expiresAt })
          }
        }
        return keys.length
      }
      // 多档"先全判后全加"(window-counter.tryConsumeWindows):ARGV 是 [windowMs,max] 成对。
      if (lower.includes('#keys')) {
        for (let i = 0; i < keys.length; i++) {
          const count = Number(alive(keys[i] ?? '')?.value ?? '0')
          if (count >= Number(argv[i * 2 + 1])) return i + 1
        }
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i] ?? ''
          const prev = alive(key)
          const next = Number(prev?.value ?? '0') + 1
          const expiresAt = next === 1 ? Date.now() + Number(argv[i * 2]) : (prev?.expiresAt ?? null)
          store.set(key, { value: String(next), expiresAt })
        }
        return 0
      }
      if (lower.includes('get') && lower.includes('del') && !lower.includes('incr')) {
        const key = keys[0] ?? ''
        const current = alive(key)?.value
        if (current === undefined || current !== String(argv[0])) return 0
        store.delete(key)
        return 1
      }
      const key = keys[0] ?? ''
      const count = await this.incr(key)
      if (count === 1 && argv[0] !== undefined) {
        const ms = Number(argv[0])
        const prev = alive(key)
        if (prev) prev.expiresAt = lower.includes('pexpire') ? Date.now() + ms : Date.now() + ms * 1000
      }
      return count
    }
    pipeline(): Record<string, unknown> {
      const chain: Record<string, unknown> = {}
      for (const m of ['set', 'del', 'expire', 'incr', 'exec']) chain[m] = vi.fn(async () => [])
      return chain
    }
    multi(): Record<string, unknown> {
      return this.pipeline()
    }
    async flushdb(): Promise<'OK'> {
      store.clear()
      return 'OK'
    }
    async quit(): Promise<'OK'> {
      return 'OK'
    }
    disconnect(): void {
      /* no-op */
    }
  }
  return { default: FakeRedis, Redis: FakeRedis }
})

beforeAll(() => {
  redisEntries.clear()
})
afterAll(() => {
  redisEntries.clear()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
