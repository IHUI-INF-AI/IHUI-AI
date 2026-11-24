// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 锁:`pages/ask/create` 的提问提交只许走 @ihui/api-client 的共享端点 `createAsk`
 * (2026-11-06 立,票面=「@/api 阻塞分桶」A 桶结清)。
 *
 * 为什么要两把尺而不是一把:
 *  - 形状锁读**写法** —— 页面一旦把 `import { createAsk } from '@/api'` 加回来,
 *    规划器 plan-hand-mirror-conversion 的 `capabilityTokens` 就当页重新记一枚 `@/api`
 *    阻塞(全仓现读 29 页里的最常见 blocker),转壳判定当场退回。
 *  - 运行时锁读**行为** —— 把新旧两条链各自喂进同一条真实链路
 *    (createAsk/`post` → unwrapApi → fetchApi → createTaroTransport → Taro.request),
 *    逐字对账同一发网络请求(URL / method / body)。
 *    只测新链是空跑:万一有人把共享封装改成 POST /asks/draft,新链自证自绿,
 *    而页面早就不是同一件事了(§0.9「判据在、没人用」同型)。
 *
 * 判据住在本文件一份(§0.6 单一真相源:仓内没有第二把同判据的尺子)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { maskComments } from '../../../scripts/lib/code-mask.mjs' // arch-exempt: 判据面必须与被审门共用同一份遮罩实现（§22c），属测试面而非生产依赖边；与 tests/api-no-double-unwrap.test.ts 同形

const PAGE_REL = '../src/pages/ask/create.tsx'
const END_IN_API_REL = '../src/api/index.ts'
const SHARED_ENDPOINT_REL = '../../../packages/api-client/src/endpoints/community.ts'

/* ------------------------------ 形状判据(单份) ------------------------------ */

/** 从 `import { … } from <spec 正则>` 里取具名符号(别名取原身;`type` 导入由调用方决定收不收)。 */
function namedImports(code: string, specRe: RegExp): Array<{ name: string; isType: boolean }> {
  const out: Array<{ name: string; isType: boolean }> = []
  for (const m of code.matchAll(specRe)) {
    for (const piece of String(m[1] ?? '').split(',')) {
      const raw = piece.trim()
      if (!raw) continue
      const isType = /^type\s+/.test(raw)
      const name = raw
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]!
        .trim()
      if (name) out.push({ name, isType })
    }
  }
  return out
}

/** 页面从 `@/api*`(端内 api 模块)具名 import 的符号;注释里的写法不算命中。 */
function inAppApiImports(code: string): string[] {
  return namedImports(
    code,
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@\/api(?:\/[^'"]*)?['"]/g,
  ).map((s) => s.name)
}

/** 页面从 `@ihui/api-client` 具名 import 的符号(type-only 不算消费)。 */
function sharedApiImports(code: string): string[] {
  return namedImports(code, /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@ihui\/api-client['"]/g)
    .filter((s) => !s.isType)
    .map((s) => s.name)
}

/** 被 import 进来的名字里,哪些**真的被调用**了(import 了不用 = §0.9 的另一半)。 */
function calledNames(code: string, names: string[]): string[] {
  return names.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(code))
}

/** 哪些具名 import 的调用点被 `unwrapApi(` 直接承接(错误处理必须留在唯一出口上)。 */
function unwrapWrappedNames(code: string, names: string[]): string[] {
  return names.filter((n) => new RegExp(`\\bunwrapApi\\s*\\(\\s*${n}\\s*[({]`).test(code))
}

const read = (rel: string) =>
  maskComments(readFileSync(resolve(__dirname, rel), 'utf8')) as unknown as string

/* ------------------------------ 运行时夹具 ------------------------------ */

const { calls, sent } = vi.hoisted(() => ({
  /** 传输层被要求发出的请求(端内 transport 把 JSON body 还原成对象后交给 Taro.request) */
  calls: [] as Array<{ url: string; method: string; data?: unknown }>,
  /** 下一次 Taro.request 要回的信封与 HTTP 状态位 */
  sent: { envelope: {} as Record<string, unknown>, statusCode: 200 },
}))
const toast = vi.hoisted(() => vi.fn())
const goToLogin = vi.hoisted(() => vi.fn())
const expireAuth = vi.hoisted(() => vi.fn())
const getToken = vi.hoisted(() => vi.fn((): string => 'tok'))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    removeStorageSync: () => {},
    getEnv: () => 'weapp',
    request: (opts: {
      url: string
      method: string
      data?: unknown
      success?: (r: unknown) => void
      fail?: (e: unknown) => void
    }) => {
      calls.push({ url: opts.url, method: opts.method, data: opts.data })
      opts.success?.({ statusCode: sent.statusCode, header: {}, data: sent.envelope })
      return { abort: () => {} }
    },
    navigateTo: () => Promise.resolve(),
    navigateBack: () => Promise.resolve(),
    switchTab: () => Promise.resolve(),
    reLaunch: () => Promise.resolve(),
  }
  return { ...taro, default: taro }
})
vi.mock('@/host/on-toast', () => ({ onToast: toast }))
vi.mock('@/utils/auth', () => ({
  getToken,
  expireAuth,
  goToLogin,
  setToken: vi.fn(),
  isLoggedIn: () => true,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k, useI18n: () => ({ t: (k: string) => k }) }))

import { setBaseUrl, setTransport, createAsk } from '@ihui/api-client'
import { createTaroTransport } from '../src/utils/api-client-transport'
import { unwrapApi, post } from '../src/utils/api-bridge'

setBaseUrl('http://127.0.0.1:8802')
setTransport(createTaroTransport())

const INPUT = { title: '共享端点锁', content: '这一发必须与退役前逐字同形', tags: ['a', 'b'] }

describe('① 形状锁:pages/ask/create 不再引端内 @/api,改走共享端点出口', () => {
  it('S1 页面零端内 @/api import(阳面对照见 S5),且扫到了 import 语句本身(防空转)', () => {
    const code = read(PAGE_REL)
    expect(code).toContain('import')
    expect(inAppApiImports(code)).toEqual([])
  })

  it('S2 页面 import 的 createAsk 住在 @ihui/api-client,而不是端内模块', () => {
    const code = read(PAGE_REL)
    expect(sharedApiImports(code)).toContain('createAsk')
    expect(code).not.toMatch(/from\s*['"]@\/api['"]/)
  })

  it('S3 import 了必须真被调用 —— 防「补了没人用」(§0.9)', () => {
    const code = read(PAGE_REL)
    expect(calledNames(code, ['createAsk'])).toEqual(['createAsk'])
  })

  it('S4 调用点仍由端内唯一出口 unwrapApi 承接(错误处理不得在页面里另抄一份)', () => {
    const code = read(PAGE_REL)
    expect(unwrapWrappedNames(code, ['createAsk'])).toEqual(['createAsk'])
    // 页面不得自带第二份解包判据:除 unwrapApi 外不得出现 ApiResult 的 success 分支自算
    expect(code).not.toMatch(/\?\.\s*success\b/)
  })

  it('S5 阳面对照:同一把尺量「旧写法」必须点名 @/api(判据一摘这条即翻红)', () => {
    const legacy =
      "import { createAsk } from '@/api'\nawait createAsk({ title: 'x', content: 'y' })"
    expect(inAppApiImports(legacy)).toEqual(['createAsk'])
    expect(sharedApiImports(legacy)).toEqual([])
    expect(unwrapWrappedNames(legacy, ['createAsk'])).toEqual([])
  })

  it('S6 端内同名薄封装已退役:src/api/index.ts 不得再声明 createAsk(否则端内腿随时能长回来)', () => {
    const code = read(END_IN_API_REL)
    expect(code).not.toMatch(/export\s+const\s+createAsk\s*=/)
  })

  it('S7 共享侧那一枚真打 POST /asks(读源,不抄常量)', () => {
    const src = readFileSync(resolve(__dirname, SHARED_ENDPOINT_REL), 'utf8')
    const start = src.indexOf('export async function createAsk(')
    expect(start).toBeGreaterThanOrEqual(0)
    const next = src.slice(start + 1).indexOf('\nexport ')
    const body = src.slice(start, next < 0 ? src.length : start + 1 + next)
    expect(body).toContain("'/asks'")
    expect(body).toContain("method: 'POST'")
    expect(body).toContain('JSON.stringify(input)')
  })
})

describe('② 运行时锁:退役前后同一发请求逐字等价', () => {
  beforeEach(() => {
    calls.length = 0
    toast.mockClear()
    goToLogin.mockClear()
    expireAuth.mockClear()
    getToken.mockReturnValue('tok')
    sent.statusCode = 200
  })

  it('R1 新链:恰一发 POST 到 …/api/asks,body 为 {title,content,tags}', async () => {
    sent.envelope = { code: 0, message: 'success', data: { id: 'ask-1' } }
    await unwrapApi(createAsk(INPUT))
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('http://127.0.0.1:8802/api/asks')
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.data).toEqual(INPUT)
  })

  it('R2 对账臂:退役前的端内写法 post(同路径同 body)产出与 R1 逐字相同的请求', async () => {
    sent.envelope = { code: 0, message: 'success', data: { id: 'ask-1' } }
    // 这就是被删掉的那枚薄封装的函数体:post('/asks', data)
    await post('/asks', INPUT)
    const legacy = { ...calls[0]! }
    calls.length = 0
    sent.envelope = { code: 0, message: 'success', data: { id: 'ask-1' } }
    await unwrapApi(createAsk(INPUT))
    expect(calls[0]).toEqual(legacy)
  })

  it('R3 错误处理等价:失败信封 ⇒ 抛错 + toast 带后端原文(页面 try/catch 契约不变)', async () => {
    sent.statusCode = 400
    sent.envelope = { code: 400, message: '标题重复' }
    calls.length = 0
    await expect(unwrapApi(createAsk(INPUT))).rejects.toThrow('标题重复')
    expect(toast).toHaveBeenCalled()
    expect(String(toast.mock.calls.at(-1)?.[0])).toContain('标题重复')
  })

  it('R4 401 两型仍由 unwrapApi 分派:有凭据⇒清凭据+去登录,游客⇒只抛不跳', async () => {
    vi.useFakeTimers()
    try {
      getToken.mockReturnValue('tok')
      sent.statusCode = 401
      sent.envelope = { code: 401, message: '未授权' }
      await expect(unwrapApi(createAsk(INPUT))).rejects.toThrow()
      expect(expireAuth).toHaveBeenCalled()
      vi.advanceTimersByTime(900)
      expect(goToLogin).toHaveBeenCalled()

      expireAuth.mockClear()
      goToLogin.mockClear()
      toast.mockClear()
      getToken.mockReturnValue('')
      await expect(unwrapApi(createAsk(INPUT))).rejects.toThrow()
      expect(expireAuth).not.toHaveBeenCalled()
      vi.advanceTimersByTime(900)
      expect(goToLogin).not.toHaveBeenCalled()
      // 游客态不弹「会话过期」提示(与 tests/api-bridge-401-two-kinds.test.ts 同一分型口径)
      expect(toast).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('R5 身份不出客户端:发出去的 body 里不得有 userId/phone 一类自报键', async () => {
    sent.envelope = { code: 0, message: 'success', data: { id: 'ask-1' } }
    calls.length = 0
    await unwrapApi(createAsk(INPUT))
    const body = calls[0]!.data as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['content', 'tags', 'title'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
