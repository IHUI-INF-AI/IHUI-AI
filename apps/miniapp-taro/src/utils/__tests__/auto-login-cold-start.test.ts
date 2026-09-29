// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端「冷启动不得自动登回」用例(2026-09-27 任务 #29)。
 *
 * 病灶:`app.tsx` 的 useLaunch 在未登录 + 小程序环境下调 `trySilentMiniAppLogin()`,
 * 用 wx.login 的 code 换一份**新凭据** —— 不需要账密、没有勾选位,而登出走的 `clearAuth()`
 * 清的正是那份凭据,于是"刚点过退出"与"新用户首启"在盘上同形,冷启动必然静默登回去。
 *
 * 判据本体在跨端共享层 `@ihui/shared/auth/auto-login-policy`(与 RN / web 同一份实现);
 * 本文件判的是本端接线:标记落在哪、谁写它、谁清它、静默路径是否真被拦住。
 * 三档成对:① 有标记 ⇒ 不登回 ② 无标记 ⇒ 登回 ③ 缺任一条件 ⇒ 不登回。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canSilentlyReLogin, SESSION_LOGGED_OUT_STORAGE_KEY } from '@ihui/shared/auth/auto-login-policy'

const { taroStorage, miniAppLoginMock, wechatLoginMock, isMiniAppEnvironmentMock } = vi.hoisted(
  () => ({
    taroStorage: {} as Record<string, unknown>,
    miniAppLoginMock: vi.fn(async () => ({ success: true })),
    wechatLoginMock: vi.fn(async () => ({ success: true })),
    isMiniAppEnvironmentMock: vi.fn(() => true),
  }),
)

vi.mock('@tarojs/taro', () => ({
  default: { showToast: vi.fn() },
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: vi.fn(),
  getCurrentPages: vi.fn(() => []),
}))

// 平台静默登录的两个真实出口:本用例判的是"有没有被叫到",不是它们内部实现。
vi.mock('@/utils/miniapp-login', () => ({
  miniAppLogin: miniAppLoginMock,
  isMiniAppEnvironment: isMiniAppEnvironmentMock,
}))
vi.mock('@/utils/wechat-login', () => ({ wechatLogin: wechatLoginMock }))
// stores/user.ts 里的 getProfile 等走这一层,用例不关心其返回,整模块替身。
vi.mock('@/api', () => ({ getProfile: vi.fn(async () => null) }))
// utils/auth.ts 的 refreshAccessToken 走 @ihui/api-client 的 fetchApi;本用例只数"有没有被叫到",
// 所以替身固定回一个失败结果 —— 判据生效时它根本不会被调用(见 ① 那一条)。
const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn(async () => ({ success: false })) }))
vi.mock('@ihui/api-client', () => ({ fetchApi: fetchApiMock }))

import {
  getToken,
  setToken,
  setRefreshToken,
  clearAuth,
  isSessionLoggedOut,
  markSessionLoggedOut,
  refreshAccessToken,
} from '../auth'
import { useUserStore } from '@/stores/user'

const USER = { id: 'u-1', nickname: 'tester' } as const

beforeEach(() => {
  Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
  miniAppLoginMock.mockClear()
  wechatLoginMock.mockClear()
  isMiniAppEnvironmentMock.mockImplementation(() => true)
})

describe('① 主动登出 ⇒ 冷启动静默登录被拦', () => {
  it('clearAuth() 落标记,且标记落在共享层那一个 key 上', () => {
    setToken('tk-1')
    clearAuth()

    expect(getToken()).toBe('')
    expect(taroStorage[SESSION_LOGGED_OUT_STORAGE_KEY]).toBeDefined()
    expect(isSessionLoggedOut()).toBe(true)
    expect(
      canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut, gates: [isMiniAppEnvironmentMock] }),
    ).toBe(false)
  })

  it('登出后 trySilentMiniAppLogin 不发平台登录请求(整条静默链被拦住)', async () => {
    setToken('tk-1')
    useUserStore.getState().setAuth('tk-1', USER, 'rt-1')
    useUserStore.getState().logout()

    const result = await useUserStore.getState().trySilentMiniAppLogin()

    expect(result).toBeNull()
    expect(miniAppLoginMock).not.toHaveBeenCalled()
  })

  it('同一闸也管住微信那一支(两条静默腿不得一条严一条松)', async () => {
    useUserStore.getState().setAuth('tk-1', USER, 'rt-1')
    useUserStore.getState().logout()

    await expect(useUserStore.getState().trySilentWechatLogin()).resolves.toBeNull()
    expect(wechatLoginMock).not.toHaveBeenCalled()
  })

  it('清凭据的另一条路(api-bridge / 会话失效)同样落标记:只认 clearAuth 一个出口', () => {
    clearAuth()
    expect(isSessionLoggedOut()).toBe(true)
  })
})

describe('② 正当路径不被误伤', () => {
  it('没有标记(新用户首启)⇒ 允许静默登录,平台登录真被调用', async () => {
    expect(isSessionLoggedOut()).toBe(false)
    expect(
      canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut, gates: [isMiniAppEnvironmentMock] }),
    ).toBe(true)

    const result = await useUserStore.getState().trySilentMiniAppLogin()

    expect(miniAppLoginMock).toHaveBeenCalledTimes(1)
    expect(result).not.toBeNull()
  })

  it('登出后再手动登录(setAuth 写凭据)清掉标记 ⇒ 下一次冷启动允许登回', async () => {
    setToken('tk-1')
    useUserStore.getState().logout()
    expect(isSessionLoggedOut()).toBe(true)

    useUserStore.getState().setAuth('tk-2', USER, 'rt-2')

    expect(isSessionLoggedOut()).toBe(false)
    expect(taroStorage[SESSION_LOGGED_OUT_STORAGE_KEY]).toBeUndefined()
    // 已登录态下静默登录本就该跳过(不是被登出闸拦的),所以判的是判据本身
    expect(canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })).toBe(true)
  })
})

describe('③ 缺任一准入条件 ⇒ 不登回', () => {
  it('不是小程序环境(拿不到平台 code)⇒ 不登回', () => {
    isMiniAppEnvironmentMock.mockImplementation(() => false)

    expect(isSessionLoggedOut()).toBe(false)
    expect(
      canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut, gates: [isMiniAppEnvironmentMock] }),
    ).toBe(false)
  })

  it('已登录时静默登录直接跳过(既有行为不被本次改动破坏)', async () => {
    setToken('tk-9')

    await expect(useUserStore.getState().trySilentMiniAppLogin()).resolves.toBeNull()
    expect(miniAppLoginMock).not.toHaveBeenCalled()
  })
})

describe('401 静默续期同闸(与 RN / web 同一条判据)', () => {
  it('① 登出后 refreshAccessToken 不发 /auth/refresh', async () => {
    setToken('tk-1')
    setRefreshToken('rt-1')
    clearAuth()

    await expect(refreshAccessToken()).resolves.toBeNull()
    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('② 没有标记时照旧续期(证明上一条红在登出闸,不是函数坏了)', async () => {
    setToken('tk-1')
    setRefreshToken('rt-1')
    taroStorage[SESSION_LOGGED_OUT_STORAGE_KEY] = undefined
    delete taroStorage[SESSION_LOGGED_OUT_STORAGE_KEY]

    await refreshAccessToken()

    expect(fetchApiMock).toHaveBeenCalledTimes(1)
  })

  it('③ 续期成功后标记被清掉(setToken 写凭据那一侧的清除)', async () => {
    markSessionLoggedOut()
    expect(isSessionLoggedOut()).toBe(true)
    setToken('tk-new')

    expect(isSessionLoggedOut()).toBe(false)
  })
})

describe('不经 clearAuth 的两条登出入口必须显式落标记(装车证明)', () => {
  // 这两页只调后端登出接口 + reLaunch / clearStorageSync,不经过 utils/auth 的 clearAuth()。
  // 不点名它们,"登出必落标记"就只对 store 那一条出口成立 —— 判据失效的表现永远是安静。
  // 取材用 node:path 拼绝对路径,不用 `new URL(rel, import.meta.url)`:该端 tsconfig 的 lib 里
  // DOM 的 URL 与 node:url 的 URL 是两个类型,后者传给 fileURLToPath 会在 HEAD 上直接判 TS2345
  // (端 typecheck 恒红 = 每台每次被逼跳门,§12e 同型),而两种写法解出的文件是同一个。
  const read = (rel: string): string =>
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), rel), 'utf-8')

  it('pages/setting 的退出登录调用 markSessionLoggedOut', () => {
    const src = read('../../pages/setting/index.tsx')
    expect(src).toMatch(/markSessionLoggedOut\(\)/)
    expect(src).toMatch(/from '@\/utils\/auth'/)
  })

  it('pkg-user/user/settings 的标记必须写在 clearStorageSync 之后(写在之前会被一起抹掉)', () => {
    const src = read('../../pkg-user/user/settings.tsx')
    const wipe = src.indexOf('Taro.clearStorageSync()')
    const mark = src.indexOf('markSessionLoggedOut()')
    expect(mark).toBeGreaterThan(-1)
    expect(wipe).toBeGreaterThan(-1)
    expect(mark, '标记必须落在整片擦除之后,否则等于没写').toBeGreaterThan(wipe)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
