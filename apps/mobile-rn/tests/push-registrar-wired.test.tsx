// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 推送注册挂钩装车取证(2026-11-26 立)。
//
// 背景:usePush() 此前在全仓零调用点 —— token 从没注册到后端,启动时预建的 Android 渠道
// 一次都不会被创建(造好没装车)。本用例渲染真 App.tsx,钉死接线:
// ① 登录态(token 存在)⇒ register 被调用一次;② 未登录(token 为 null)⇒ register 零调用
//   (不弹权限、不发请求);③ 挂钩挂在 AuthProvider 子树内(能拿到 token 的最浅位置)。
// mock 清单沿用 app-root-background-focused-route.test.tsx 的已验证口径。
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const env = vi.hoisted(() => ({
  token: null as string | null,
  register: vi.fn(),
}))

// App.tsx 模块求值期读 __DEV__(jsdom 无此全局,不定义即 ReferenceError),按先例置 true。
;(globalThis as Record<string, unknown>).__DEV__ = true

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
    isReady: () => true,
    getCurrentRoute: () => undefined,
    addListener: () => () => {},
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
  useAuth: () => ({ token: env.token }),
}))
vi.mock('../src/i18n', () => ({
  t: (key: string) => key,
  I18nProvider: ({ children }: { children: unknown }) => children,
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../src/context/NetworkContext', () => ({
  NetworkProvider: ({ children }: { children: unknown }) => children,
  useNetwork: () => ({ banner: 'none', reason: 'online' }),
}))
// 推送挂钩:只暴露 register 替身,不加载真实 expo-notifications 模块副作用。
vi.mock('../src/hooks/use-push', () => ({
  usePush: () => ({ register: env.register }),
}))

import App from '../App'

describe('PushRegistrar 推送注册挂钩接线', () => {
  beforeEach(() => {
    env.register.mockClear()
    env.token = null
  })

  it('登录后(token 存在)⇒ register 被调用一次', () => {
    env.token = 'access-token-123'
    render(<App />)
    expect(env.register).toHaveBeenCalledTimes(1)
  })

  it('未登录(token 为 null)⇒ register 零调用,不弹权限也不发请求', () => {
    env.token = null
    render(<App />)
    expect(env.register).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
