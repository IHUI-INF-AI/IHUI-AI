// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 按需语言包的**运行时**三级就绪对账(内存 → storage → CDN)。
//
// 为什么单开一个文件跑而不是用现成的 @/i18n import:这一层的全部行为都住在模块级状态里
// (remoteCache / inflight / backoff / packReadyListeners)。同一份模块实例里跑第二个用例时,
// 第一个用例写进内存缓存的语言包会让"未就绪"那一支根本走不到 —— 断言会绿,但它证明的是
// 缓存生效而不是回落生效。所以每个用例都 `vi.resetModules()` + 重新 import,拿到干净实例。
// Taro 的 mock 用 vi.hoisted 建一个**跨 reset 存活**的状态对象(resetModules 不会重置 mock
// 注册表,但会重新求值工厂 —— 状态挂在 hoisted 上才既能配置又能断言)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { I18N_PACK_KEY_PREFIX } from '@/constants/storage'
import {
  REMOTE_LOCALE_MANIFEST,
  type RemoteLocale,
} from '@/i18n/generated/remote-locale-manifest.gen'

const T = vi.hoisted(() => ({
  /** storage 面:真实 Taro.getStorageSync 缺失时返回 ''(不是 undefined),照此模拟 */
  storage: new Map<string, string>(),
  /** 由每个用例改写;返回 Promise 时按 CDN 结果分支,抛错则走 fail 分支 */
  requestImpl: null as
    null | ((opts: { url: string }) => Promise<{ statusCode: number; data: unknown }>),
  requestCalls: [] as { url: string }[],
  removeCalls: [] as string[],
  setCalls: [] as { key: string; value: string }[],
}))

vi.mock('@tarojs/taro', () => {
  const TaroMock = {
    getStorageSync: (key: string) => (T.storage.has(key) ? T.storage.get(key) : ''),
    setStorageSync: (key: string, value: string) => {
      T.storage.set(key, value)
      T.setCalls.push({ key, value })
    },
    removeStorageSync: (key: string) => {
      T.storage.delete(key)
      T.removeCalls.push(key)
    },
    getStorageInfoSync: () => ({ keys: [...T.storage.keys()] }),
    request: (opts: { url: string }) => {
      T.requestCalls.push(opts)
      if (!T.requestImpl) return Promise.reject(new Error('mock: 未配置 requestImpl'))
      return T.requestImpl(opts)
    },
    setTabBarItem: () => Promise.resolve(),
  }
  return { default: TaroMock, ...TaroMock }
})

/** 每个用例拿一份干净的 index.tsx 模块实例(模块级缓存不得跨用例顶账) */
async function freshI18n() {
  vi.resetModules()
  return (await import('@/i18n')) as {
    getMessages: (locale: Locale) => Messages
    ensureRemotePack: (locale: Locale) => Promise<void>
    t: (key: string, params?: Record<string, string | number>) => string
  }
}

// 落点按测试文件自身位置推导(与同目录 permission-tier-pack.test.ts 同一写法)
const PAYLOAD_ROOT = join(__dirname, '..', '..', 'assets', 'remote-locales')
const MESSAGES_ROOT = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'i18n', 'messages')
const payloadOf = (locale: RemoteLocale) =>
  readFileSync(join(PAYLOAD_ROOT, `${locale}.b64.txt`), 'utf8')

function sourceMessages(locale: Locale): Messages {
  const read = (root: 'shared' | 'miniapp-taro') =>
    JSON.parse(readFileSync(join(MESSAGES_ROOT, root, `${locale}.json`), 'utf8')) as Messages
  return mergeMessages(read('shared'), read('miniapp-taro'))
}

const zhCN = sourceMessages('zh-CN')
const ja = sourceMessages('ja')
/** 一个四语言都有的键:用它判"未就绪期 t() 出的是回落语的值,而不是回显 key" */
const A_STABLE_KEY = 'tabBar.square'

/** 按点路径下钻取词典值(与 @ihui/i18n/loader 的 getValueByPath 同一语义,这里只取字符串) */
function nestedValue(messages: Messages, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, seg) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
      messages,
    )
  return typeof value === 'string' ? value : undefined
}

function cacheKey(locale: RemoteLocale): string {
  return `${I18N_PACK_KEY_PREFIX}${locale}_${REMOTE_LOCALE_MANIFEST[locale].version}`
}

beforeEach(() => {
  T.storage.clear()
  T.requestCalls.length = 0
  T.removeCalls.length = 0
  T.setCalls.length = 0
  T.requestImpl = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('三级全失败 ⇒ 静默回落内置 zh-CN,不抛错', () => {
  it('storage 空 ∧ CDN 请求失败:getMessages 返回 zh-CN 且调用不抛', async () => {
    const mod = await freshI18n()
    T.requestImpl = () => Promise.reject(new Error('offline'))
    expect(() => mod.getMessages('ja')).not.toThrow()
    expect(mod.getMessages('ja')).toEqual(zhCN)
    await Promise.resolve() // 让在途任务落地(失败分支)
    expect(T.setCalls).toEqual([]) // 失败绝不写缓存
  })

  it('CDN 返回非 2xx 同样回落,且不当成成功', async () => {
    const mod = await freshI18n()
    T.requestImpl = () => Promise.resolve({ statusCode: 404, data: 'not found' })
    expect(mod.getMessages('ja')).toEqual(zhCN)
    await mod.ensureRemotePack('ja')
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.setCalls).toEqual([])
  })

  it('模块级 t() 在未就绪期也能取到中文文案(渲染路径不得抛)', async () => {
    const mod = await freshI18n()
    T.requestImpl = () => Promise.reject(new Error('offline'))
    // 未就绪 ⇒ getMessages 给的是内置 zh-CN,t() 必须按点路径解析出中文值(而不是回显 key)
    expect(typeof mod.t(A_STABLE_KEY)).toBe('string')
    expect(mod.t(A_STABLE_KEY)).not.toBe(A_STABLE_KEY)
    // 同一路径在内置 zh-CN 树里能查到值 —— 证明确实是"回落语上屏",而不是空串
    expect(nestedValue(zhCN, A_STABLE_KEY)).toBe(mod.t(A_STABLE_KEY))
  })
})

describe('清单校验不过 ⇒ 那份载荷不得使用(防"坏包上屏")', () => {
  it('storage 里是被截断的载荷:不返回它,并摘除该条目', async () => {
    const mod = await freshI18n()
    const key = cacheKey('ja')
    T.storage.set(key, payloadOf('ja').slice(0, Math.floor(payloadOf('ja').length / 2)))
    T.requestImpl = () => Promise.reject(new Error('offline'))
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.removeCalls).toContain(key)
  })

  it('storage 里字节数对得上而内容坏了(字符集合法):同样不得使用并摘除', async () => {
    const mod = await freshI18n()
    const key = cacheKey('ja')
    const real = payloadOf('ja')
    // 长度一致 + 全 base64 字符集 + 解不开:这是"CDN 存了个同长度的坏文件"的形态
    const broken = 'A'.repeat(real.length)
    expect(broken.length).toBe(real.length)
    T.storage.set(key, broken)
    T.requestImpl = () => Promise.reject(new Error('offline'))
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.removeCalls).toContain(key)
  })

  it('storage 里存的是**别的语言**的载荷:长度与清单不符 ⇒ 不得使用并摘除', async () => {
    // 这一条专门盯"字节数校验"那一维:en 的载荷是合法 gzip+base64、能解出词典,
    // 只有清单 bytes 能认出它不是 ja 的那一份。少了这维,缓存键写错/CDN 串文件都会把
    // 英语词典当成日语上屏 —— 看上去"语言生效了",实际是另一种语言,且零报错。
    const mod = await freshI18n()
    const key = cacheKey('ja')
    const enPayload = payloadOf('en')
    const jaPayload = payloadOf('ja')
    expect(enPayload.length).not.toBe(jaPayload.length) // 前提:两包长度确实不同,否则本条无牙
    T.storage.set(key, enPayload)
    T.requestImpl = () => Promise.reject(new Error('offline'))
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.removeCalls).toContain(key)
  })

  it('CDN 回来的是坏载荷:不写缓存、不进内存', async () => {
    const mod = await freshI18n()
    T.requestImpl = () => Promise.resolve({ statusCode: 200, data: 'not-a-gzip-payload!!' })
    await mod.ensureRemotePack('ja')
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.setCalls).toEqual([])
  })

  it('版本变了 ⇒ 旧缓存 key 根本不被读到(缓存 key 含 version)', async () => {
    const mod = await freshI18n()
    // 把**当前有效**的载荷存在一个旧版本 key 下:运行时必须按清单里的 version 取键
    T.storage.set(`${I18N_PACK_KEY_PREFIX}ja_00000000`, payloadOf('ja'))
    T.requestImpl = () => Promise.reject(new Error('offline'))
    expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.removeCalls).not.toContain(`${I18N_PACK_KEY_PREFIX}ja_00000000`)
  })
})

describe('storage 命中 ⇒ 同步上屏,一次网络都不发', () => {
  it('缓存里是有效载荷:返回解压后的 ja 词典且不调 request', async () => {
    const mod = await freshI18n()
    T.storage.set(cacheKey('ja'), payloadOf('ja'))
    expect(mod.getMessages('ja')).toEqual(ja)
    expect(T.requestCalls).toEqual([])
    // 第二次取词走内存级,storage 也只读了一次同键(引用同一份对象)
    expect(mod.getMessages('ja')).toBe(mod.getMessages('ja'))
  })

  it('文末多一个换行的载荷仍算有效(服务端补空白不得把合法包判成坏包)', async () => {
    const mod = await freshI18n()
    T.storage.set(cacheKey('ja'), `${payloadOf('ja')}\n`)
    expect(mod.getMessages('ja')).toEqual(ja)
  })

  it('CDN 成功后:写的是载荷原文进 storage,并触发就绪通知(供 Provider 重渲染)', async () => {
    const mod = await freshI18n()
    const payload = payloadOf('ja')
    T.requestImpl = () => Promise.resolve({ statusCode: 200, data: payload })
    await mod.ensureRemotePack('ja')
    expect(T.setCalls).toEqual([{ key: cacheKey('ja'), value: payload }])
    expect(mod.getMessages('ja')).toEqual(ja)
    expect(T.requestCalls.length).toBe(1)
  })

  it('写入新版本后摘掉同语言的旧版本条目(缓存 key 带 version ⇒ 旧键永不复用,不清就是配额泄漏)', async () => {
    const mod = await freshI18n()
    const staleKey = `${I18N_PACK_KEY_PREFIX}ja_deadbeef`
    T.storage.set(staleKey, payloadOf('ja'))
    // 别的语言的旧键不在射程内:本次只下了 ja,不该动 en 的缓存
    const otherLocaleStaleKey = `${I18N_PACK_KEY_PREFIX}en_deadbeef`
    T.storage.set(otherLocaleStaleKey, payloadOf('en'))
    T.requestImpl = () => Promise.resolve({ statusCode: 200, data: payloadOf('ja') })
    await mod.ensureRemotePack('ja')
    expect(T.removeCalls).toContain(staleKey)
    expect(T.storage.has(staleKey)).toBe(false)
    expect(T.storage.has(cacheKey('ja'))).toBe(true)
    expect(T.removeCalls).not.toContain(otherLocaleStaleKey)
  })
})

describe('同一 locale 不重复发请求', () => {
  it('未就绪期反复取词只发一次网络(渲染路径每帧都会调 getMessages)', async () => {
    const mod = await freshI18n()
    // 用"可延后放行"的 requestImpl:30 次取词全部发生在载荷回来之前
    const deferred: { resolve?: (v: { statusCode: number; data: unknown }) => void } = {}
    T.requestImpl = () =>
      new Promise((resolve) => {
        deferred.resolve = resolve
      })
    for (let i = 0; i < 30; i++) expect(mod.getMessages('ja')).toEqual(zhCN)
    expect(T.requestCalls.length).toBe(1)
    // 并发 ensureRemotePack 必须复用同一次在途请求 —— 比 promise 身份,而不是 await 它
    // (await 未决的在途任务会直接把用例挂死)
    const first = mod.ensureRemotePack('ja')
    expect(mod.ensureRemotePack('ja')).toBe(first)
    expect(T.requestCalls.length).toBe(1)
    deferred.resolve?.({ statusCode: 200, data: payloadOf('ja') })
    await first
    expect(mod.getMessages('ja')).toEqual(ja)
    // 就绪之后再取词:零新增请求
    const before = T.requestCalls.length
    mod.getMessages('ja')
    expect(T.requestCalls.length).toBe(before)
  })

  it('两种语言各自只发一次(不得把并发请求合并成一次错语言)', async () => {
    const mod = await freshI18n()
    T.requestImpl = (opts) =>
      Promise.resolve({
        statusCode: 200,
        data: opts.url.includes('/en.b64.txt') ? payloadOf('en') : payloadOf('ja'),
      })
    await Promise.all([mod.ensureRemotePack('en'), mod.ensureRemotePack('ja')])
    expect(T.requestCalls.map((c) => c.url)).toHaveLength(2)
    expect(mod.getMessages('en')).toEqual(sourceMessages('en'))
    expect(mod.getMessages('ja')).toEqual(ja)
  })

  it('URL 带 version 做缓存击穿(文件名恒定而内容随版本变)', async () => {
    const mod = await freshI18n()
    T.requestImpl = () => Promise.reject(new Error('offline'))
    await mod.ensureRemotePack('ja')
    // 先钉"确实发了一次",再取值 —— 否则 [0] 是 undefined,toContain 会把"没发请求"读成通过
    expect(T.requestCalls).toHaveLength(1)
    const [call] = T.requestCalls
    expect(call?.url).toContain('remote-locales/ja.b64.txt')
    expect(call?.url).toContain(`?v=${REMOTE_LOCALE_MANIFEST.ja.version}`)
  })
})

describe('会话内退避:失败不变成"每次取词都打网络"', () => {
  it('失败后冷却期内不再发请求;冷却过了可以再试一次', async () => {
    vi.useFakeTimers()
    const mod = await freshI18n()
    T.requestImpl = () => Promise.reject(new Error('offline'))
    await mod.ensureRemotePack('ja')
    expect(T.requestCalls.length).toBe(1)
    // 紧接着再试:仍在退避窗口内 ⇒ 不得打网络
    await mod.ensureRemotePack('ja')
    expect(T.requestCalls.length).toBe(1)
    // 越过第一次退避(2s)后可再发一次
    vi.setSystemTime(Date.now() + 3_000)
    await mod.ensureRemotePack('ja')
    expect(T.requestCalls.length).toBe(2)
  })

  it('超过上限次数后彻底停手(弱网下不无限重试),取词仍回落 zh-CN', async () => {
    vi.useFakeTimers()
    const mod = await freshI18n()
    T.requestImpl = () => Promise.reject(new Error('offline'))
    for (let i = 0; i < 40; i++) {
      await mod.ensureRemotePack('ja')
      vi.setSystemTime(Date.now() + 10 * 60_000)
    }
    expect(T.requestCalls.length).toBeLessThanOrEqual(5)
    expect(T.requestCalls.length).toBeGreaterThan(0)
    expect(mod.getMessages('ja')).toEqual(zhCN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
