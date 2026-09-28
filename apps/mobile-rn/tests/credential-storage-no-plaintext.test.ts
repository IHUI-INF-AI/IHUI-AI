// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 #27 的常驻锁:记住的密码**永远不得**落进可读的明文存储。
 *
 * 病灶(实测,不是假想):`credential-storage.ts` 旧版把 `{account, password}` 直接
 * `JSON.stringify` 写进 AsyncStorage —— 那层是应用私有目录里的明文文件,root 设备 /
 * `adb backup` / 云备份恢复都读得到;而自动登录的凭据源正是这条记录,所以暴露面在
 * 凭据链最底下一格,不是"少加个密"的观感问题。
 *
 * 四条必须同时成立,缺任一条就是"把明文挪了个地方"而非"不再落明文":
 *  ① 新写入:AsyncStorage 里那条记录**不含 password 字段**,密码只进 Keychain;
 *  ② 旧数据:盘上已有的明文记录在 hydrate 后被改写成"只含账号",密码迁进 Keychain,
 *     且 `loadRemembered()` 仍返回两者(收口不得顺手把用户的"记住密码"弄丢);
 *  ③ 后端不可用:不降级存明文 —— 本轮内存可用、跨进程不持久,且旧明文照样被抹掉;
 *  ④ 登出/清除:两处都删干净。
 * 有牙证明见文件末条:把 ① 的写入改回旧形态(同条记录带 password)⇒ 该例必红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { kv, secure, flags } = vi.hoisted(() => ({
  /** AsyncStorage 的内容(键 → 值)与写入调用序列 */
  kv: { store: new Map<string, string>(), writes: [] as Array<[string, string]> },
  /** Keychain 侧的内容 */
  secure: { store: new Map<string, string>() },
  flags: { encrypted: true },
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => kv.store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      kv.store.set(k, v)
      kv.writes.push([k, v])
    },
    removeItem: async (k: string) => {
      kv.store.delete(k)
    },
  },
}))

vi.mock('../src/lib/auth/secure-store', () => ({
  getSecureItem: async (k: string) => secure.store.get(k) ?? null,
  setSecureItem: async (k: string, v: string) => {
    secure.store.set(k, v)
  },
  deleteSecureItem: async (k: string) => {
    secure.store.delete(k)
  },
  isSecureBackendEncrypted: async () => flags.encrypted,
}))

const CRED_KEY = 'ihui-remember-credentials'
const PW_KEY = 'ihui-remember-password'

/** 等过模块加载期 fire-and-forget 的 hydrate 与各 fire-and-forget 写入。 */
async function settle(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r))
}

async function loadFresh() {
  vi.resetModules()
  const mod = await import('../src/lib/credential-storage')
  await settle()
  return mod.credentialStorage
}

beforeEach(() => {
  kv.store.clear()
  kv.writes.length = 0
  secure.store.clear()
  flags.encrypted = true
})

describe('记住的密码不得落明文', () => {
  it('① 新写入:AsyncStorage 那条记录里没有 password,密码只在 Keychain', async () => {
    const cs = await loadFresh()
    cs.saveRemembered('tester@example.com', 'S3cret!pw')
    await settle()

    const raw = kv.store.get(CRED_KEY)
    expect(raw, '账号记录应仍在 AsyncStorage').toBeTruthy()
    expect(raw).not.toContain('S3cret!pw')
    expect(Object.keys(JSON.parse(raw as string) as Record<string, unknown>)).toEqual(['account'])
    expect(secure.store.get(PW_KEY)).toBe('S3cret!pw')
    // 任何一次 AsyncStorage 写入都不得带上口令
    expect(kv.writes.some(([, v]) => v.includes('S3cret!pw'))).toBe(false)
    expect(cs.loadRemembered()).toEqual({ account: 'tester@example.com', password: 'S3cret!pw' })
  })

  it('② 旧版明文记录:hydrate 后抹掉明文、密码迁进 Keychain,而"记住密码"这件事没丢', async () => {
    kv.store.set(CRED_KEY, JSON.stringify({ account: 'legacy@example.com', password: 'Old!pw' }))
    const cs = await loadFresh()

    const raw = kv.store.get(CRED_KEY)
    expect(raw).not.toContain('Old!pw')
    expect(JSON.parse(raw as string) as { account?: string }).toEqual({ account: 'legacy@example.com' })
    expect(secure.store.get(PW_KEY)).toBe('Old!pw')
    expect(cs.loadRemembered()).toEqual({ account: 'legacy@example.com', password: 'Old!pw' })
  })

  it('③ 后端不加密:不降级存明文(本轮内存可用、跨进程不持久),旧明文照样被抹', async () => {
    flags.encrypted = false
    kv.store.set(CRED_KEY, JSON.stringify({ account: 'a@b.c', password: 'Plain!pw' }))
    const cs = await loadFresh()
    cs.saveRemembered('a@b.c', 'Plain!pw')
    await settle()

    expect(secure.store.size, '不加密的后端不得收密码').toBe(0)
    expect(kv.writes.some(([, v]) => v.includes('Plain!pw'))).toBe(false)
    expect(kv.store.get(CRED_KEY)).not.toContain('Plain!pw')
    // 内存里仍可用:本次会话的自动登录不受影响
    expect(cs.loadRemembered()).toEqual({ account: 'a@b.c', password: 'Plain!pw' })
  })

  it('④ 清除:两处都删,不留孤本', async () => {
    const cs = await loadFresh()
    cs.saveRemembered('x@y.z', 'Tmp!pw')
    await settle()
    expect(secure.store.get(PW_KEY)).toBe('Tmp!pw')

    cs.clearRemembered()
    await settle()
    expect(kv.store.has(CRED_KEY)).toBe(false)
    expect(secure.store.has(PW_KEY)).toBe(false)
    expect(cs.loadRemembered()).toBeNull()
  })
})

describe('有牙证明', () => {
  it('把写回退成"账号+密码同条明文",① 必须红(否则本文件只是自我表扬)', async () => {
    // 直接断言判据对旧形态敏感:旧形态 = 同一条 AsyncStorage 记录里带 password
    const legacy = JSON.stringify({ account: 'a@b.c', password: 'S3cret!pw' })
    expect(legacy).toContain('S3cret!pw')
    expect(Object.keys(JSON.parse(legacy) as Record<string, unknown>)).toContain('password')
    // 而新实现写出的那条只有 account —— 两形态可区分,① 的断言才不是恒真
    const cs = await loadFresh()
    cs.saveRemembered('a@b.c', 'S3cret!pw')
    await settle()
    expect(Object.keys(JSON.parse(kv.store.get(CRED_KEY) as string) as Record<string, unknown>)).toEqual(
      ['account'],
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
