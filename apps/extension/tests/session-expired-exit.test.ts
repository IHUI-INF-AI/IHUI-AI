// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展端会话失效统一出口(2026-09-27)
 *
 * 守门 check-auth-handler-registration-parity 把这一型点名成 AP1 红:
 * `@ihui/api-client` 的 `setUnauthorizedHandler` 此前只有 web / RN / 小程序注册,扩展端**一个都没有**
 * —— 后果不是"少一个弹窗",而是 access + refresh 双过期后每一屏各自显示一句从错误体里取来的通用文案,
 * "去重新登录"既没有入口也没有出口。
 *
 * 四条判据各指一个不同断点,不得合并成"文件里出现过这个名字":
 *  ① `initApi()` 运行时把处理器注册进了 api-client(读 `getUnauthorizedHandler()`,不读源码)
 *  ② 处理器在有派发目标的 realm 里喊出这个事件;在无派发目标的 realm 里**不抛**
 *     (sidepanel/popup 的 globalThis 就是 window;Service Worker 里没订阅者;node 单测两者都覆盖)
 *  ③ 401 的续期出口接回了端内既有 `doRefresh` —— 本端此前只 `bindTokenStoreToApiClient(store)` 不绑
 *     refreshAccessToken,于是 `refreshAccessTokenOnce()` 恒返回 null 且**不发续期请求**,任何 401 都不重试
 *  ④ 派发与订阅两头接通(标识符由声明处反查,不写死第二份):组件从 lib/token 引入它,订阅点订阅的就是它,
 *     回调定义体里把 UI 翻回未登录态。刻意不做组件渲染取证:该文件 import 40 个页面模块,
 *     把它挂进测试环境得到的绿灯只证明夹具能跑,不证明这条管子。
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// === chrome 运行时 mock(sidepanel 语境)===
const chromeStorage: Record<string, unknown> = {}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys]
        const out: Record<string, unknown> = {}
        for (const k of arr) if (k in chromeStorage) out[k] = chromeStorage[k]
        return out
      }),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(chromeStorage, obj)
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys]
        for (const k of arr) delete chromeStorage[k]
      }),
    },
    session: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(async () => true),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    id: 'test-ext',
    lastError: undefined,
    getURL: vi.fn((p: string) => `chrome-extension://test-ext/${p}`),
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(async () => undefined),
  },
}

// === 端内续期实现打桩:本用例判的是"它有没有被接进 api-client 的续期出口",不是它内部对错 ===
const doRefreshMock: Mock = vi.fn(async () => true)
vi.mock('../lib/token-utils', () => ({
  doRefresh: doRefreshMock,
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
  scheduleRefreshAlarm: vi.fn(),
  readExp: vi.fn(() => 0),
}))

async function readSource(rel: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  return readFile(resolve(import.meta.dirname!, rel), 'utf8')
}

describe('扩展端会话失效统一出口', () => {
  beforeEach(() => {
    for (const k of Object.keys(chromeStorage)) delete chromeStorage[k]
    doRefreshMock.mockReset()
    doRefreshMock.mockResolvedValue(true)
    vi.resetModules()
  })

  it('① initApi() 运行时注册 401 处理器(读 api-client 的当前值,不读源码字样)', async () => {
    const { getUnauthorizedHandler, setUnauthorizedHandler } = await import('@ihui/api-client')
    setUnauthorizedHandler(null) // 归零:下面的"非空"必须是 initApi 干的,不是上一条用例留下的
    expect(getUnauthorizedHandler()).toBeNull()

    const { initApi } = await import('../lib/token')
    await initApi()
    expect(typeof getUnauthorizedHandler()).toBe('function')
  })

  it('② 处理器在有派发目标时喊出会话失效事件,在无派发目标时不抛', async () => {
    const { initApi, SESSION_EXPIRED_EVENT } = await import('../lib/token')
    const { getUnauthorizedHandler } = await import('@ihui/api-client')
    await initApi()
    const handler = getUnauthorizedHandler()
    expect(typeof handler).toBe('function')
    if (!handler) throw new Error('未注册 —— 下面全部断言无意义')

    const seen: string[] = []
    const g = globalThis as unknown as { dispatchEvent?: (e: Event) => boolean }
    const prev = g.dispatchEvent
    g.dispatchEvent = (e: Event) => {
      seen.push(e.type)
      return true
    }
    try {
      handler({ url: '/api/whatever', method: 'GET' })
    } finally {
      if (typeof prev === 'function') g.dispatchEvent = prev
      else delete g.dispatchEvent
    }
    expect(seen).toEqual([SESSION_EXPIRED_EVENT])

    // 无派发目标的 realm(node 单测正是这一形态)必须静默返回而不是抛:
    // 抛会被 api-client 的 try/catch 吞成一行 console.error,用户侧表现与"没注册"完全同形。
    expect(() => handler({ url: '/api/whatever', method: 'GET' })).not.toThrow()
  })

  it('③ 401 续期出口接回端内 doRefresh(未绑定时 api-client 直接返回 null 且不发续期)', async () => {
    const { initApi, setToken } = await import('../lib/token')
    const { refreshAccessTokenOnce } = await import('@ihui/api-client')
    await initApi()
    await setToken('access-after-refresh')

    const token = await refreshAccessTokenOnce()
    expect(doRefreshMock).toHaveBeenCalledTimes(1)
    expect(token).toBe('access-after-refresh')
  })

  it('④ 派发↔订阅接通:组件订阅的就是这个事件,回调体真把 UI 翻回未登录态', async () => {
    const { SESSION_EXPIRED_EVENT } = await import('../lib/token')
    const src = await readSource('../entrypoints/sidepanel/SidepanelApp.tsx')
    const tokenSrc = await readSource('../lib/token.ts')
    // 标识符由**声明处**反查(值 → 名字),不写死第二份:声明改名或值被改写,这一步就断。
    const ident = new RegExp(`export const (\\w+) = '${SESSION_EXPIRED_EVENT}'`).exec(tokenSrc)?.[1]
    if (!ident)
      throw new Error('token.ts 里找不到这个事件值的声明处 —— 事件值与标识符断了联系,判据无从反查')

    const tokenImports = [
      ...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*\/lib\/token'/g),
    ].map((m) => m[1] ?? '')
    expect(
      tokenImports.some((names) => new RegExp(`\\b${ident}\\b`).test(names)),
      `SidepanelApp 没从 lib/token 引入 ${ident}`,
    ).toBe(true)

    /** 取"订阅点所订阅的标识符"与其回调定义体;订错名字、回调不做事,两种断链都取不到 */
    const subscribedCallbackBody = (text: string): string | null => {
      const sub = /addEventListener\?\.\(\s*(\w+)\s*,\s*([A-Za-z_$][\w$]*)\s*\)/.exec(text)
      if (!sub || sub[1] !== ident) return null
      const body = new RegExp(`const ${sub[2]} = \\(\\) => \\{([\\s\\S]{0,400}?)\\n\\s*\\}`).exec(
        text,
      )
      return body ? (body[1] ?? '') : null
    }

    const body = subscribedCallbackBody(src)
    expect(body, '找不到订阅点上那个回调的定义体 —— 派发与订阅没接上').not.toBeNull()
    expect(body).toContain('setAuthed(false)')

    // 对照一:把这个回调自己的定义体里那句"翻回未登录态"抽掉,判据必须跟着失效。
    // 不能整文件 replace —— 该文件另有两处合法的同类调用(启动期续期失败、主动登出),
    // 抽错地方等于给一条与判据无关的文本做对照。
    const cbName = /addEventListener\?\.\(\s*\w+\s*,\s*([A-Za-z_$][\w$]*)\s*\)/.exec(src)![1]
    const defRe = new RegExp(`const ${cbName} = \\(\\) => \\{[\\s\\S]{0,400}?\\n\\s*\\}`)
    const dm = defRe.exec(src)
    expect(dm, '回调定义体取不到,对照无从施加').not.toBeNull()
    const broken =
      src.slice(0, dm!.index) +
      dm![0].replace('setAuthed(false)', 'noop()') +
      src.slice(dm!.index + dm![0].length)
    expect(broken, '对照没改动任何文本 —— 那它就不是对照').not.toBe(src)
    expect(subscribedCallbackBody(broken)).not.toContain('setAuthed(false)')

    // 对照二:只把订阅点换成别的事件名(回调体一字未动)⇒ 判据必须取不到。
    // 这一条防的是"通读全文件找那句状态翻转"式的假接通。
    const misSubbed = src.replace(
      new RegExp(`addEventListener\\?\\.\\(\\s*${ident}`),
      'addEventListener?.(SOME_OTHER_EVENT',
    )
    expect(misSubbed, '订阅点没被改成对照形态').not.toBe(src)
    expect(subscribedCallbackBody(misSubbed)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
