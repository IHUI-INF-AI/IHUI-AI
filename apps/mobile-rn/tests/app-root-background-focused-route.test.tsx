// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// O57(mobile-rn)根层条件化的装车取证:App 根 View 底色按**当前聚焦路由**取。
//
// 边界(2026-09-24「实测钉死一条边界」登记,勿在单屏重复踩):VideoPlayerScreen 全屏纯黑
// 而上方横 34dp 浅灰带 —— 那条带由 App.tsx 根 View 的 backgroundColor(tokens.surface.bg)
// 绘制,屏幕内容在屏幕顶边被裁剪,端内任何写法(marginTop 负值等)都够不到。修法只剩单点:
// 根 View 底色在聚焦路由为 VideoPlayer 时切 tokens.gray.black,其余屏不变(枚 2ef1c2978)。
//
// 本用例钉三条不变量(渲染**真 App.tsx**,映射写在 AppContent 内,替身渲染即测接线本身):
//  ① VideoPlayer 聚焦 ⇒ 根 View 实落底色 = gray.black(#000,与共享层 video-player 容器同源同值,
//     不新增第二个色源 —— 守门 97 S1);
//  ② 常规屏聚焦 ⇒ 仍 surface.bg(#F5F5F5);ByRoute 分档屏(Login 等)按 App.tsx ROUTE_ROOT_BG 取色;
//  ③ 路由切换经 navigation-ref 的 ready/state 订阅驱动底色翻转(冷启动未就绪时回落 surface.bg)。
// 断言读的是**落到根 div 元素上的实算 backgroundColor**,不是读 styles 对象(同 fenlei-overlay 取证法)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'

const env = vi.hoisted(() => {
  // App.tsx 模块求值期有 `if (__DEV__)`(jsdom 无此全局,不定义即 ReferenceError)
  ;(globalThis as Record<string, unknown>).__DEV__ = false
  return {
    /** 模拟当前聚焦路由名(null = 导航器未就绪) */
    route: 'VideoPlayer' as string | null,
    ready: true,
    /** navigation-ref.addListener 的替身登记表:[事件名, 回调] */
    listeners: [] as Array<{ event: string; cb: () => void }>,
  }
})

// 共享 react-native 替身缺 AppRegistry/LogBox(App.tsx 模块求值期注册组件 + 抑制 LogBox),
// 按 chat-disclosure-tier-approval.test.tsx 同法 importOriginal 扩展,不另造第三份替身。
vi.mock('react-native', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    AppRegistry: { registerComponent: vi.fn(), runApplication: vi.fn() },
    LogBox: { ignoreAllLogs: vi.fn() },
  }
})

vi.mock('expo-font', () => ({ useFonts: () => [true] }))
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }))
vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: unknown }) => children,
  DarkTheme: {},
  DefaultTheme: {},
}))
vi.mock('../src/navigation/RootNavigator', () => ({ RootNavigator: () => null }))
vi.mock('../src/navigation/linking', () => ({ linking: {} }))
vi.mock('../src/navigation/navigation-ref', () => ({
  navigationRef: {
    isReady: () => env.ready,
    getCurrentRoute: () => (env.route ? { name: env.route } : undefined),
    addListener: (event: string, cb: () => void) => {
      env.listeners.push({ event, cb })
      return () => {
        const i = env.listeners.findIndex((l) => l.cb === cb)
        if (i >= 0) env.listeners.splice(i, 1)
      }
    },
  },
  navigateTo: vi.fn(),
}))
vi.mock('../src/lib/wechat', () => ({ registerWechat: async () => {} }))
vi.mock('../src/lib/oauth-deeplink', () => ({
  subscribeOAuthDeepLink: () => () => {},
  getInitialOAuthDeepLink: async () => null,
}))
vi.mock('../src/stores/auth-store', () => ({
  rnAuthStore: { getState: () => ({ token: null }) },
}))
vi.mock('../src/components/GlobalFloatBox', () => ({ GlobalFloatBox: () => null }))
vi.mock('../src/components/PrivacyPolicyModal', () => ({ PrivacyPolicyModal: () => null }))
vi.mock('../src/components/OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('../src/components/DevErrorToast', () => ({ DevErrorToast: () => null }))
vi.mock('../src/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../src/i18n', () => ({
  I18nProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../src/context/NetworkContext', () => ({
  NetworkProvider: ({ children }: { children: unknown }) => children,
  useNetwork: () => ({ isOnline: true }),
}))

import App from '../App'
import { tokens } from '../src/theme/active-tokens'

/** jsdom 会把样式值归一化成 rgb();把 token 原值走同一条归一化再比,避免手写色值漂移 */
function css(hex: string): string {
  const probe = document.createElement('div')
  probe.style.color = hex
  const out = probe.style.color
  if (!out) throw new Error(`token 色值 ${hex} 无法被 jsdom 解析,断言前提不成立`)
  return out
}

/** 根 View = 渲染容器的第一个子元素;读**落到元素上**的实算底色 */
function rootBackgroundOf(container: HTMLElement): string {
  const root = container.firstElementChild as HTMLElement | null
  if (!root) throw new Error('App 根 View 未渲染(容器为空)')
  return root.style.backgroundColor
}

function fireNavigation(): void {
  act(() => {
    env.listeners.forEach((l) => l.cb())
  })
}

describe('O57 App 根 View 底色按聚焦路由条件化(状态栏带单点修法)', () => {
  beforeEach(() => {
    env.listeners.length = 0
    env.route = 'VideoPlayer'
    env.ready = true
  })

  it('VideoPlayer 聚焦 ⇒ 根底色 = gray.black,且实值为纯黑(带位由 (245,245,245) 翻 (0,0,0))', () => {
    const { container } = render(<App />)
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))
    expect(css(tokens.gray.black)).toBe('rgb(0, 0, 0)')
  })

  // 实现按聚焦路由分档(App.tsx ROUTE_ROOT_BG):Login 页面底取 surface.card,
  // 其余常规屏仍 surface.bg。逐路由钉真实值,表镜像 App.tsx 的 ROUTE_ROOT_BG(未导出)。
  it('逐路由聚焦 ⇒ 根底色按 ROUTE_ROOT_BG 分档(Login=surface.card,常规屏=surface.bg)', () => {
    const expectedByRoute: Record<string, string> = {
      Home: tokens.surface.bg,
      Profile: tokens.surface.bg,
      Settings: tokens.surface.bg,
      Login: tokens.surface.card, // ROUTE_ROOT_BG.Login ⇒ surface.card
      Chat: tokens.surface.bg,
    }
    for (const [route, expected] of Object.entries(expectedByRoute)) {
      env.route = route
      const { container } = render(<App />)
      expect(rootBackgroundOf(container)).toBe(css(expected))
    }
    expect(css(tokens.surface.bg)).toBe('rgb(245, 245, 245)')
    expect(css(tokens.surface.card)).toBe('rgb(255, 255, 255)')
  })

  it('导航未就绪(冷启动)⇒ 回落 surface.bg,ready 事件到达后翻黑', () => {
    env.ready = false
    const { container } = render(<App />)
    expect(rootBackgroundOf(container)).toBe(css(tokens.surface.bg))
    env.ready = true
    fireNavigation()
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))
  })

  it('路由切换经 state 订阅驱动底色:黑 → 灰 → 黑(订阅真实挂上而非一次性快照)', () => {
    env.route = 'VideoPlayer'
    const { container } = render(<App />)
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))

    env.route = 'Home'
    fireNavigation()
    expect(rootBackgroundOf(container)).toBe(css(tokens.surface.bg))

    env.route = 'VideoPlayer'
    fireNavigation()
    expect(rootBackgroundOf(container)).toBe(css(tokens.gray.black))

    expect(env.listeners.map((l) => l.event).sort()).toEqual(['ready', 'state'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
