// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ioredis 内存替身(2026-10-30 立)。
 *
 * 立因:本轮三项加固(access token 吊销、微信回调 nonce 去重、按用户限流)全都靠 Redis 承重,
 * 而 `tests/account-lockout.test.ts` 那种"所有命令都抛错"的替身只能测降级路径,
 * 测不了"第一次 OK / 第二次命中 / 取不到时 fail-closed"这种**有状态裁决**。
 *
 * 口径:
 *  - 只实现本批用到的命令(set/setex/get/del/exists/incr/expire/quit),不模拟完整 Redis。
 *  - `NX` 与 `EX` 按真实语义生效,TTL 用 Date.now() 判定(配合 vi.setSystemTime 可测跨窗口)。
 *  - `failures` 是**逐命令**的故障注入:用来分别验证"限流 fail-open"与"资金面 fail-closed"
 *    两种相反方向,二者必须能各自独立触发,否则测不出裁决差异。
 *  - `calls` 记录实参,供断言 TTL / NX 这类"参数本身就是判据"的点。
 *
 * 用法:
 * ```ts
 * const state = vi.hoisted(() => createFakeRedisState())
 * vi.mock('ioredis', () => ({ default: makeFakeRedisClass(state) }))
 * ```
 * 注意:vi.hoisted 里不能 import,所以 state 必须在测试文件内用 vi.hoisted 创建,
 * 本文件只提供工厂(工厂函数在 mock 工厂异步 import 时加载)。
 */

export interface FakeRedisRow {
  value: string
  /** 0 = 永不过期 */
  expiresAt: number
}

export interface FakeRedisState {
  store: Map<string, FakeRedisRow>
  calls: Array<{ cmd: string; args: unknown[] }>
  failures: Set<string>
}

export function createFakeRedisState(): FakeRedisState {
  return { store: new Map(), calls: [], failures: new Set() }
}

/** 清空数据与观测(不动 failures —— 故障注入由用例自己增删)。 */
export function resetFakeRedisState(state: FakeRedisState): void {
  state.store.clear()
  state.calls.length = 0
}

export function makeFakeRedisClass(state: FakeRedisState): new (...args: unknown[]) => unknown {
  const live = (key: string): FakeRedisRow | undefined => {
    const row = state.store.get(key)
    if (!row) return undefined
    if (row.expiresAt > 0 && row.expiresAt <= Date.now()) {
      state.store.delete(key)
      return undefined
    }
    return row
  }

  return class FakeRedis {
    constructor(...args: unknown[]) {
      void args
    }

    on(): this {
      return this
    }

    async set(key: string, value: string, ...rest: unknown[]): Promise<'OK' | null> {
      state.calls.push({ cmd: 'set', args: [key, value, ...rest] })
      if (state.failures.has('set')) throw new Error('fake redis: set 注入故障')
      const exIndex = rest.indexOf('EX')
      const ttlSeconds = exIndex >= 0 ? Number(rest[exIndex + 1]) : 0
      const onlyIfAbsent = rest.includes('NX')
      if (onlyIfAbsent && live(key)) return null
      state.store.set(key, {
        value,
        expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
      })
      return 'OK'
    }

    async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
      state.calls.push({ cmd: 'setex', args: [key, ttlSeconds, value] })
      if (state.failures.has('setex')) throw new Error('fake redis: setex 注入故障')
      state.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
      return 'OK'
    }

    async get(key: string): Promise<string | null> {
      state.calls.push({ cmd: 'get', args: [key] })
      if (state.failures.has('get')) throw new Error('fake redis: get 注入故障')
      return live(key)?.value ?? null
    }

    async del(key: string): Promise<number> {
      state.calls.push({ cmd: 'del', args: [key] })
      if (state.failures.has('del')) throw new Error('fake redis: del 注入故障')
      return state.store.delete(key) ? 1 : 0
    }

    async exists(key: string): Promise<number> {
      state.calls.push({ cmd: 'exists', args: [key] })
      if (state.failures.has('exists')) throw new Error('fake redis: exists 注入故障')
      return live(key) ? 1 : 0
    }

    async incr(key: string): Promise<number> {
      state.calls.push({ cmd: 'incr', args: [key] })
      if (state.failures.has('incr')) throw new Error('fake redis: incr 注入故障')
      const row = live(key)
      const next = row ? Number(row.value) + 1 : 1
      state.store.set(key, { value: String(next), expiresAt: row?.expiresAt ?? 0 })
      return next
    }

    async expire(key: string, ttlSeconds: number): Promise<number> {
      state.calls.push({ cmd: 'expire', args: [key, ttlSeconds] })
      if (state.failures.has('expire')) throw new Error('fake redis: expire 注入故障')
      const row = live(key)
      if (!row) return 0
      row.expiresAt = Date.now() + ttlSeconds * 1000
      return 1
    }

    async quit(): Promise<'OK'> {
      return 'OK'
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
