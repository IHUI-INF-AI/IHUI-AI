// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端「冷启动鉴权就绪位」镜像测试(G-933 冷启动抢跑 · 小程序腿基座)。
 *
 * 钉的是 `stores/user.ts` 里那一枚 `authReady` 的**三态语义**:
 * 静默登录成功 / 静默登录失败 / 压根没进静默登录(非小程序环境、已有票、登出标记闸)
 * 这三条路径都必须把它置为 true —— 少一条,后续 54 枚页面的门控就永远等不到就绪,
 * 那比现在"读到 isLoggedIn()===false 就抢发鉴权请求"的抢跑更糟。
 *
 * 判的是接线,不是判据本身(准入判据住 @ihui/shared/auth/auto-login-policy,另有其用例):
 * 所以这里真跑 `app.tsx` 的冷启动链(渲染 App → 触发 useLaunch 回调),
 * 而不是在测试里复刻一份"三条路"的 if —— 复刻的那份必然和 app.tsx 漂移(§22c)。
 *
 * 另两枚锁:
 *  - 反向锁:模块加载即冷启动,这一位必须是 false(证明它不是"恒真摆设");
 *  - 落点锁:`markAuthReady()` 这类置位动作在本端 src 下的**生产**调用点必须只有 app.tsx 一处
 *    (含 store 自己也不许点亮:"落定"由那条链判,不由取票动作判 —— 取票有三条短路根本不会被调到)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-10-14 同款:import() 的类型注解被 consistent-type-imports 禁,改顶层 type 命名空间导入
import type * as ApiClientModule from '@ihui/api-client'
import { SESSION_LOGGED_OUT_STORAGE_KEY } from '@ihui/shared/auth/auto-login-policy'

const HERE = dirname(fileURLToPath(import.meta.url))

const {
  taroStorage,
  launchCallbacks,
  miniAppLoginMock,
  isMiniAppEnvironmentMock,
  exchangeSsoCodeMock,
  showToastMock,
  fetchApiMock,
} = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  // useLaunch 的注册表:一次"冷启动"= 渲染一次 App,把各 handler 注册的回调全收下来逐个触发
  launchCallbacks: [] as Array<(options?: { query?: Record<string, unknown> }) => void>,
  miniAppLoginMock: vi.fn(),
  isMiniAppEnvironmentMock: vi.fn((): boolean => true),
  exchangeSsoCodeMock: vi.fn(async (_code?: string): Promise<null> => null),
  showToastMock: vi.fn(),
  fetchApiMock: vi.fn(async (): Promise<{ success: boolean }> => ({ success: false })),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: showToastMock,
    onNetworkStatusChange: vi.fn(),
    request: vi.fn(),
    // app.tsx 模块顶层就造两个 Taro 传输适配器,后者按环境分支(taro-stream-transport.ts:49)
    // ⇒ 给真实 Taro 的 WEAPP 取值,让被检代码跑真分支,而不是替它写个假传输层。
    getEnv: () => 'WEAPP',
    ENV_TYPE: { WEB: 'WEB', WEAPP: 'WEAPP', ALIPAY: 'ALIPAY', QQ: 'QQ', SWAN: 'SWAN', TT: 'TT' },
  },
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, value: unknown) => {
    taroStorage[key] = value
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: vi.fn(),
  getCurrentPages: vi.fn(() => []),
  useLaunch: (cb: (options?: { query?: Record<string, unknown> }) => void) => {
    launchCallbacks.push(cb)
  },
}))

// 平台取票的两个出口:本用例判的是"链落定时这一位亮没亮",不是它们内部实现。
vi.mock('@/utils/miniapp-login', () => ({
  miniAppLogin: miniAppLoginMock,
  isMiniAppEnvironment: isMiniAppEnvironmentMock,
}))
vi.mock('@/utils/wechat-login', () => ({ wechatLogin: vi.fn(async () => ({ success: true })) }))
// G-957 回传腿后 app.tsx 启动腿委托 consumeSsoCode;桩按真实链在 exchangeSsoCodeMock 上实现,
// 保持"带 sso_code 启动 ⇒ 恰好一次换票"的判据原样可测。
vi.mock('@/utils/sso', () => ({
  exchangeSsoCode: exchangeSsoCodeMock,
  consumeSsoCode: async (code: string) => {
    if (!code) return false
    return (await exchangeSsoCodeMock(code)) !== null
  },
}))
vi.mock('@/api', () => ({
  getProfile: vi.fn(async () => null),
  loginByWechat: vi.fn(async () => null),
  loginByAlipay: vi.fn(async () => null),
}))
// api-client 只要 fetchApi 可控(真实类对象必须还是真的,同 auto-login-cold-start.test.ts)
vi.mock('@ihui/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@ihui/api-client')
  return { ...actual, fetchApi: fetchApiMock }
})
// 冷启动链上与鉴权无关的旁支(隐私弹窗、推送、主题、崩溃上报、桥接 hook、浮动客服)整模块替身:
// 它们既不产出这一位也不消费这一位,给它们写测的就是替身。
vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: { children?: unknown }) => children ?? null,
}))
vi.mock('@/utils/privacy', () => ({ initPrivacyGuard: vi.fn() }))
vi.mock('@/utils/push-init', () => ({ initPushSubscription: vi.fn() }))
vi.mock('@/utils/crash-report', () => ({ initCrashReport: vi.fn() }))
vi.mock('@/lib/theme', () => ({ initTheme: vi.fn() }))
vi.mock('@/lib/device-fingerprint', () => ({ taroDeviceFingerprintCollector: vi.fn() }))
vi.mock('@/hooks/use-ui-control-bridge', () => ({ useUiControlBridge: vi.fn() }))
vi.mock('@/hooks/use-user-broadcast-sync', () => ({ useUserBroadcastSync: vi.fn() }))
vi.mock('@/components/CustomerServiceFloat', () => ({ default: () => null }))

import App from '../../app'
import { useUserStore } from '@/stores/user'
import { clearAuth, setToken } from '@/utils/auth'

const LOGIN_OK = { user: { id: 'u-1', nickname: 'tester' }, isNewUser: false, platform: 'weapp' }

/** 造"无票 + 无登出标记" = 新用户首启(静默登录的准入条件成立) */
function seedFreshDevice(): void {
  clearAuth()
  delete taroStorage[SESSION_LOGGED_OUT_STORAGE_KEY]
}

/**
 * 真跑一次冷启动:渲染 App(useLaunch 替身把回调收进 launchCallbacks)→ 逐个触发。
 * 链是 fire-and-forget(app.tsx 里 `void (async () => …)()`),所以这里只负责"点火",
 * 落定与否由调用方断言。
 */
function igniteColdStart(query: Record<string, unknown> = {}): void {
  launchCallbacks.length = 0
  renderToStaticMarkup(createElement(App, null))
  for (const cb of [...launchCallbacks]) cb({ query })
}

/** 等到链落定(就绪位点亮);超时不返回 true ⇒ 用例判失败 */
async function waitUntilSettled(timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (!useUserStore.getState().authReady) {
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, 5))
  }
  return true
}

beforeEach(() => {
  Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
  launchCallbacks.length = 0
  // 单例 store 的状态跨用例存活:显式复位这一位,否则后一条只是踩在前一条的成果上冒绿
  useUserStore.setState({ token: '', refreshToken: '', user: null, authReady: false })
  miniAppLoginMock.mockReset()
  isMiniAppEnvironmentMock.mockReset()
  isMiniAppEnvironmentMock.mockReturnValue(true)
  exchangeSsoCodeMock.mockReset()
  exchangeSsoCodeMock.mockResolvedValue(null)
})

// ============ 正向:三条路径各造一次,都必须落定 ============

describe('① 静默登录成功 ⇒ 就绪位落定', () => {
  it('链在飞时这一位是 false,链落定后是 true(取票成功)', async () => {
    seedFreshDevice()
    miniAppLoginMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return LOGIN_OK
    })

    igniteColdStart()
    // 抢跑窗口:此刻页面读到的必须还是"未就绪",否则门控等于摆设
    expect(useUserStore.getState().authReady).toBe(false)

    expect(await waitUntilSettled()).toBe(true)
    expect(miniAppLoginMock).toHaveBeenCalledTimes(1)
    expect(useUserStore.getState().authReady).toBe(true)
  })
})

describe('② 静默登录失败 ⇒ 就绪位照样落定', () => {
  it('取票抛出(链内 catch)⇒ 判定结束,这一位仍然必须为 true', async () => {
    seedFreshDevice()
    miniAppLoginMock.mockRejectedValue(new Error('平台 code 换票失败'))

    igniteColdStart()
    expect(await waitUntilSettled()).toBe(true)
    expect(miniAppLoginMock).toHaveBeenCalledTimes(1)
    expect(useUserStore.getState().authReady).toBe(true)
  })

  it('store 那一支吞掉错误返回 null,不影响链落定', async () => {
    seedFreshDevice()
    miniAppLoginMock.mockRejectedValue(new Error('boom'))
    await expect(useUserStore.getState().trySilentMiniAppLogin()).resolves.toBeNull()
  })
})

describe('③ 压根没进静默登录(短路)⇒ 就绪位仍然必须落定', () => {
  it('非小程序环境(拿不到平台 code)⇒ 不发取票请求,但链落定', async () => {
    seedFreshDevice()
    isMiniAppEnvironmentMock.mockReturnValue(false)

    igniteColdStart()
    expect(await waitUntilSettled()).toBe(true)
    expect(miniAppLoginMock).not.toHaveBeenCalled()
    expect(useUserStore.getState().authReady).toBe(true)
  })

  it('盘上已有票 ⇒ 跳过静默登录,链照样落定', async () => {
    setToken('tk-existing')

    igniteColdStart()
    expect(await waitUntilSettled()).toBe(true)
    expect(miniAppLoginMock).not.toHaveBeenCalled()
    expect(useUserStore.getState().authReady).toBe(true)
  })

  it('登出标记闸拦下 ⇒ 不发取票请求,链照样落定(不得把用户卡在没有判定的状态上)', async () => {
    clearAuth() // 落登出标记且不清掉

    igniteColdStart()
    expect(await waitUntilSettled()).toBe(true)
    expect(miniAppLoginMock).not.toHaveBeenCalled()
    expect(useUserStore.getState().authReady).toBe(true)
  })

  it('带 sso_code 的启动参数也走同一条落定路径', async () => {
    seedFreshDevice()
    isMiniAppEnvironmentMock.mockReturnValue(false)
    miniAppLoginMock.mockImplementation(async () => LOGIN_OK)

    igniteColdStart({ sso_code: 'code-from-web' })
    expect(await waitUntilSettled()).toBe(true)
    expect(exchangeSsoCodeMock).toHaveBeenCalledTimes(1)
  })
})

// ============ 反向锁 + 幂等 ============

describe('反向锁:模块加载即冷启动,这一位初值必须是 false', () => {
  it('全新载入的 stores/user 实例 authReady === false(不是恒真摆设)', async () => {
    vi.resetModules()
    const { useUserStore: freshStore } = await import('@/stores/user')
    expect(freshStore.getState().authReady).toBe(false)

    freshStore.getState().markAuthReady()
    expect(freshStore.getState().authReady).toBe(true)
  })
})

describe('幂等:重复置位不得反复通知订阅者', () => {
  it('第二次 markAuthReady() 不再触发 set()', () => {
    const seen: boolean[] = []
    const unsubscribe = useUserStore.subscribe((state) => seen.push(state.authReady))

    useUserStore.getState().markAuthReady()
    useUserStore.getState().markAuthReady()
    useUserStore.getState().markAuthReady()
    unsubscribe()

    expect(useUserStore.getState().authReady).toBe(true)
    expect(seen).toEqual([true])
  })
})

// ============ 落点唯一(读文件自己算,不写死路径清单)============

/** 递归列出本端 src 下的生产源码(排除用例与测试目录),供落点计数用 */
function listProductionSources(root: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === '__tests__' || entry.name === 'node_modules')
        continue
      found.push(...listProductionSources(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
    found.push(full)
  }
  return found
}

/**
 * 数一个文件里的**置位调用**次数(只认 `.markAuthReady()` 这个调用形态,声明/接口行天然不匹配)。
 *
 * 必须先削掉行内 `//` 之后的内容:阳性对照实测过 —— 把 app.tsx 那一行整行注释掉后,
 * 不削注释的计数仍然报 1、仍然冒绿,这道落点锁当场成了摆设。
 * (代价:某行若在 `//` 之前就有同一次调用被字符串吞进去会漏计 —— 本端 src 现读无此形状,
 * 而漏计的方向是"少算落点",由下面那条"总次数恰好 1 且等于 app.tsx"的等式锁住,不会静默放过第二处。)
 */
function countSetCalls(text: string): number {
  let n = 0
  for (const line of text.split('\n')) {
    const cut = line.indexOf('//')
    n += ((cut === -1 ? line : line.slice(0, cut)).match(/\.markAuthReady\s*\(\s*\)/g) ?? []).length
  }
  return n
}

describe('置位落点唯一:src 下生产调用点只有 app.tsx 一处', () => {
  const srcRoot = resolve(HERE, '..', '..')

  it('计数器自己有牙(夹具三对照:活的一行算 1、注释掉的那行算 0、声明行算 0)', () => {
    expect(countSetCalls('useUserStore.getState().markAuthReady()\n')).toBe(1)
    expect(countSetCalls('// useUserStore.getState().markAuthReady()\n')).toBe(0)
    expect(countSetCalls('  markAuthReady: () => void\n')).toBe(0)
  })

  it('取材非空(src 确实扫到了源码,否则下面两条是空转冒绿)', () => {
    expect(listProductionSources(srcRoot).length).toBeGreaterThan(50)
  })

  it('置位调用总次数恰好 1,且落在 app.tsx', () => {
    const callSites = listProductionSources(srcRoot)
      .map((file) => ({ file, hits: countSetCalls(readFileSync(file, 'utf-8')) }))
      .filter((entry) => entry.hits > 0)

    expect(callSites.map((entry) => `${basename(entry.file)}:${entry.hits}`)).toEqual(['app.tsx:1'])
    expect(callSites.reduce((n, entry) => n + entry.hits, 0)).toBe(1)
  })

  it('声明处只有 stores/user.ts 一处(store 声明而不自己点亮)', () => {
    const declSites = listProductionSources(srcRoot).filter((file) =>
      /markAuthReady\s*:/.test(readFileSync(file, 'utf-8')),
    )
    expect(declSites.length).toBeGreaterThan(0)
    expect(declSites.every((file) => basename(file) === 'user.ts')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
