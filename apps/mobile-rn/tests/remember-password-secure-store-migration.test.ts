// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-361 的第二半:「记住密码」迁进 SecureStore 这件事**必须零丢失**。
 *
 * 票面(及 `credential-storage-no-plaintext.test.ts`)已经钉住"新写入不落明文"与
 * "hydrate 会把旧明文迁走";本文件钉的是**迁移失败时的那一支**:
 *
 * 旧实现的顺序是 `persistAccount()`(抹掉盘上那份明文)**先**跑,`setSecureItem()` 后跑。
 * 于是 Keychain 一写失败,口令就在两处都不存在了 —— 而 hydrate 的 catch 把它整块吞掉,
 * 账面安静,用户下次冷启动才发现"记住的密码没了"。这正是票面那句被禁止的省事做法
 * 「直接删 key —— 已勾选用户的勾选会静默失效且无任何提示」。
 *
 * 所以判据不是"有没有把明文抹掉",而是**两条同时成立**:
 *  ① 迁移成功:先落 Keychain 并**回读确证**,确证成了才抹盘上那份明文;
 *  ② 迁移失败(Keychain 抛错 / 静默丢弃导致回读不符):盘上那份**逐字没动**,
 *     一次写入都没发生,并**喊出来**(console.warn)—— 下次冷启动天然重试。
 * 只看"setSecureItem 没抛"不够:部分机型 Keychain 写入失败就是不抛(见 ③ 的构造面)。
 *
 * 负向对照(删改类动作的红线):迁移无论成败都**不得碰**登出标记 `ihui-session-logged-out`
 * 与其它业务位(`ihui-auto-login` / `ihui-login-history` / 无关键)—— 它们与凭据不同寿命,
 * 被 `clearAll` 一类路径连带删掉等于自己否决自己(理由见 `src/lib/token.ts` 标记那一节)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { kv, secure, flags, fail } = vi.hoisted(() => ({
  /** AsyncStorage 的内容(键 → 值)、写入/删除调用序列,以及跨两层的调用顺序 */
  kv: {
    store: new Map<string, string>(),
    writes: [] as Array<[string, string]>,
    removes: [] as string[],
    /** 顺序日志:证明"先落 Keychain 再抹明文"是真的顺序,而不是各自恰好发生 */
    seq: [] as string[],
  },
  /** Keychain 侧的内容 */
  secure: { store: new Map<string, string>() },
  flags: { encrypted: true },
  /** 故障注入:让 Keychain 写入抛错 / 写入不落地(模拟静默丢弃) */
  fail: { throwOnSet: false, swallowSet: false },
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => kv.store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      kv.store.set(k, v)
      kv.writes.push([k, v])
      kv.seq.push(`as:set:${k}`)
    },
    removeItem: async (k: string) => {
      kv.store.delete(k)
      kv.removes.push(k)
      kv.seq.push(`as:del:${k}`)
    },
  },
}))

vi.mock('../src/lib/auth/secure-store', () => ({
  getSecureItem: async (k: string) => secure.store.get(k) ?? null,
  setSecureItem: async (k: string, v: string) => {
    kv.seq.push(`secure:set:${k}`)
    if (fail.throwOnSet) throw new Error('keychain write rejected')
    if (fail.swallowSet) return // 不抛、也不落 —— 真机上一类"写失败但没报错"的形态
    secure.store.set(k, v)
  },
  deleteSecureItem: async (k: string) => {
    kv.seq.push(`secure:del:${k}`)
    secure.store.delete(k)
  },
  isSecureBackendEncrypted: async () => flags.encrypted,
}))

/** 被迁走的那份明文的落点:账号记录(AsyncStorage)与口令(Keychain) */
const CRED_KEY = 'ihui-remember-credentials'
const PW_KEY = 'ihui-remember-password'
/** 绝不该被这次迁移碰到的键:登出标记 + 自动登录勾选 + 登录历史 + 一个无关业务键 */
const MUST_SURVIVE: Record<string, string> = {
  'ihui-session-logged-out': '7',
  'ihui-auto-login': '1',
  'ihui-login-history': JSON.stringify(['someone@example.com']),
  'ihui-unrelated-business-flag': 'keep-me',
}

const LEGACY = { account: 'legacy@example.com', password: 'Old!pw' }

/** 等过模块加载期 fire-and-forget 的 hydrate(失败分支多两次 await,窗口放宽)。 */
async function settle(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r))
}

async function loadFresh() {
  vi.resetModules()
  const mod = await import('../src/lib/credential-storage')
  await settle()
  return mod.credentialStorage
}

function seedLegacyRecord(): void {
  kv.store.set(CRED_KEY, JSON.stringify(LEGACY))
}

function mustSurviveSnapshot(): Record<string, string | null> {
  return Object.fromEntries(Object.keys(MUST_SURVIVE).map((k) => [k, kv.store.get(k) ?? null]))
}

/**
 * 迁移顺序判据:Keychain 那次写入必须**严格早于**账号记录被改写(那份明文被抹掉的时刻)。
 *
 * 抽成纯函数是为了能拿构造面喂它 —— 只断言真跑出来的顺序,证不了这条断言对旧顺序(先抹后写)
 * 也会红;那正是"先抹后写"在真机上不出事时的账面样子。
 */
function secureWritePrecedesErase(seq: readonly string[]): boolean {
  const write = seq.findIndex((s) => s === `secure:set:${PW_KEY}`)
  const erase = seq.findIndex((s) => s === `as:set:${CRED_KEY}` || s === `as:del:${CRED_KEY}`)
  if (write === -1) return false // 一次都没落 Keychain ⇒ 不得把"没写"读成"写成了"
  if (erase === -1) return true // 没抹过任何档(失败留档分支)⇒ 不存在"先抹"
  return write < erase
}

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  kv.store.clear()
  kv.writes.length = 0
  kv.removes.length = 0
  kv.seq.length = 0
  secure.store.clear()
  flags.encrypted = true
  fail.throwOnSet = false
  fail.swallowSet = false
  for (const [k, v] of Object.entries(MUST_SURVIVE)) kv.store.set(k, v)
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('① 迁移成功:先落 Keychain 并回读确证,才抹盘上那份明文', () => {
  it('口令进 Keychain、明文被归一成只含账号,而"记住密码"这件事没丢', async () => {
    seedLegacyRecord()
    const cs = await loadFresh()

    expect(secure.store.get(PW_KEY)).toBe(LEGACY.password)
    expect(JSON.parse(kv.store.get(CRED_KEY) as string)).toEqual({ account: LEGACY.account })
    expect(kv.store.get(CRED_KEY)).not.toContain(LEGACY.password)
    expect(cs.loadRemembered()).toEqual({ account: LEGACY.account, password: LEGACY.password })
    expect(warnSpy, '成功路径不得喊失败').not.toHaveBeenCalled()
  })

  it('Keychain 里已有同一份口令时(上一轮写了却没抹成),本轮只需归一账号记录', async () => {
    seedLegacyRecord()
    secure.store.set(PW_KEY, LEGACY.password)
    const cs = await loadFresh()

    expect(JSON.parse(kv.store.get(CRED_KEY) as string)).toEqual({ account: LEGACY.account })
    expect(cs.loadRemembered()).toEqual({ account: LEGACY.account, password: LEGACY.password })
  })
})

describe('② 迁移失败:旧档逐字没动(断言的是"副作用没发生",不是返回值)', () => {
  it('Keychain 写入抛错 ⇒ 不抹明文、一次 AsyncStorage 写入都没有、并且喊出来', async () => {
    seedLegacyRecord()
    const before = kv.store.get(CRED_KEY)
    fail.throwOnSet = true

    const cs = await loadFresh()

    // 判红对象是"删除有没有发生":写失败后再抹档,口令就两处都不在了
    expect(kv.store.get(CRED_KEY), '写失败后不得删旧档').toBe(before)
    expect(kv.writes, '本分支不应产生任何 AsyncStorage 写入').toEqual([])
    expect(kv.removes.filter((k) => k === CRED_KEY), '账号记录不得被删除').toEqual([])
    expect(secure.store.size).toBe(0)
    // 本轮内存仍可用(用户当前会话不受影响)
    expect(cs.loadRemembered()).toEqual({ account: LEGACY.account, password: LEGACY.password })
    expect(
      warnSpy.mock.calls.flat().join(' '),
      '失败必须响,不得静默吞掉',
    ).toContain('LEFT UNTOUCHED')
  })

  it('Keychain 写入不抛但静默丢弃(回读不符)⇒ 同样不得抹明文', async () => {
    seedLegacyRecord()
    const before = kv.store.get(CRED_KEY)
    fail.swallowSet = true

    await loadFresh()

    expect(kv.store.get(CRED_KEY), '只看"没抛"就会把一次没落地的迁移当成功').toBe(before)
    expect(kv.writes).toEqual([])
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('LEFT UNTOUCHED')
  })

  it('失败留档不是终点:下一次冷启动 Keychain 恢复后迁移完成,凭据仍在', async () => {
    seedLegacyRecord()
    fail.throwOnSet = true
    await loadFresh()
    expect(kv.store.get(CRED_KEY)).toContain(LEGACY.password)

    fail.throwOnSet = false
    const cs = await loadFresh()

    expect(secure.store.get(PW_KEY)).toBe(LEGACY.password)
    expect(JSON.parse(kv.store.get(CRED_KEY) as string)).toEqual({ account: LEGACY.account })
    expect(cs.loadRemembered()).toEqual({ account: LEGACY.account, password: LEGACY.password })
  })
})

describe('③ 后端不加密:宁可不记密码,也绝不把明文写回可读存储', () => {
  it('旧明文被抹、Keychain 不收、任何 AsyncStorage 写入都不含口令', async () => {
    flags.encrypted = false
    seedLegacyRecord()

    const cs = await loadFresh()

    expect(secure.store.size).toBe(0)
    expect(kv.store.get(CRED_KEY)).not.toContain(LEGACY.password)
    expect(kv.writes.some(([, v]) => v.includes(LEGACY.password))).toBe(false)
    expect(cs.loadRemembered()).toEqual({ account: LEGACY.account, password: LEGACY.password })
  })
})

describe('④ 负向对照:迁移无论成败都不得碰这些键', () => {
  it('成功迁移后,登出标记与业务位逐字在位', async () => {
    seedLegacyRecord()
    const before = mustSurviveSnapshot()

    await loadFresh()

    expect(mustSurviveSnapshot()).toEqual(before)
    expect(kv.removes.filter((k) => k !== CRED_KEY), '除账号记录外不得有任何删除动作').toEqual([])
  })

  it('迁移失败后,登出标记与业务位同样逐字在位', async () => {
    seedLegacyRecord()
    fail.throwOnSet = true
    const before = mustSurviveSnapshot()

    await loadFresh()

    expect(mustSurviveSnapshot()).toEqual(before)
    expect(kv.removes).toEqual([])
    expect(kv.writes).toEqual([])
  })

  it('无旧明文的常规冷启动也不得动这些键', async () => {
    kv.store.set(CRED_KEY, JSON.stringify({ account: LEGACY.account }))
    secure.store.set(PW_KEY, LEGACY.password)
    const before = mustSurviveSnapshot()

    await loadFresh()

    expect(mustSurviveSnapshot()).toEqual(before)
    expect(kv.removes).toEqual([])
  })
})

describe('⑤ 登出标记不得被挪进凭据那一层(票面另一条红线)', () => {
  it('clearRemembered 只清凭据两处落点,标记与勾选逐字在位', async () => {
    seedLegacyRecord()
    const cs = await loadFresh()
    const before = mustSurviveSnapshot()

    cs.clearRemembered()
    await settle()

    expect(mustSurviveSnapshot(), '登出标记/勾选被连带删掉 = 自己否决自己').toEqual(before)
    expect(kv.removes.filter((k) => k !== CRED_KEY), '除账号记录外不得有其它删除').toEqual([])
    expect(secure.store.size).toBe(0)
  })

  it('形状锁:credential-storage 这一层不得出现登出标记的键名或读写', async () => {
    // 判据对象是"这一层里根本没有它",而不是"跑起来没删"—— 后者只在覆盖到的路径上成立。
    const here = path.dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(path.resolve(here, '..', 'src', 'lib', 'credential-storage.ts'), 'utf8')
    expect(src.includes('ihui-session-logged-out'), '标记键不得在凭据层复用').toBe(false)
    expect(src.includes('SESSION_LOGGED_OUT_KEY'), '标记常量不得在凭据层复用').toBe(false)
  })

  it('形状锁:标记只经 AsyncStorage 落盘,绝不经 setSecureItem', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(path.resolve(here, '..', 'src', 'lib', 'token.ts'), 'utf8')
    expect(/AsyncStorage\.setItem\(SESSION_LOGGED_OUT_KEY/.test(src), '标记必须落在 AsyncStorage').toBe(
      true,
    )
    expect(/AsyncStorage\.removeItem\(SESSION_LOGGED_OUT_KEY/.test(src), '清除标记同层').toBe(true)
    expect(
      /setSecureItem\w*\(\s*SESSION_LOGGED_OUT_KEY/.test(src),
      '标记进了 Keychain 就会被 clearAll 连带删',
    ).toBe(false)
  })
})

describe('有牙证明', () => {
  it('顺序判据本身有牙:同一份判据必须拒绝"先抹后写"的构造面', () => {
    // ② 依赖的前提是"写失败 ⇒ 没有抹档动作";把这条前提抽成纯判据,并用构造面证明
    // 它对旧顺序(先 persistAccount 再写 Keychain)确实会给否 —— 否则 ② 只是恰好没红。
    const legacy = `secure:set:${PW_KEY}`
    const erase = `as:set:${CRED_KEY}`
    expect(secureWritePrecedesErase([legacy, erase])).toBe(true)
    expect(secureWritePrecedesErase([erase, legacy]), '旧顺序必须被判不过').toBe(false)
    // 一次都没写 Keychain(不加密分支 / 写入被拒)同样不过 —— 不得把"没写"读成"写成了"
    expect(secureWritePrecedesErase([erase])).toBe(false)
    // 反向:只写不抹也成立(失败留档那一支),判据不得把它当违规
    expect(secureWritePrecedesErase([legacy])).toBe(true)
    // 而"抹的是别的键"不算抹档 —— 否则任何一次无关写入都会把这条判据判红
    expect(secureWritePrecedesErase([`as:set:other-key`, legacy])).toBe(true)
  })

  it('真跑出来的顺序:Keychain 写入严格早于账号记录改写', async () => {
    seedLegacyRecord()
    await loadFresh()

    expect(secureWritePrecedesErase(kv.seq), kv.seq.join(' → ')).toBe(true)
  })

  it('写失败那一支里明文仍在、成功那一支里明文不在(两分支可区分)', async () => {
    seedLegacyRecord()
    fail.throwOnSet = true
    await loadFresh()
    expect((kv.store.get(CRED_KEY) ?? '').includes(LEGACY.password), '写失败后盘上必须还留明文').toBe(
      true,
    )

    fail.throwOnSet = false
    await loadFresh()
    expect((kv.store.get(CRED_KEY) ?? '').includes(LEGACY.password), '成功后明文应已被抹').toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
