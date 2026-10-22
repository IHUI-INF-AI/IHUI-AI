// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-958:H5(web 平台)登录页禁止把用户指向一条被同文件自己拒绝的死路
//
// 实测矛盾(HEAD 967c222c24077ce1959e054f2c85fb657e35f637,src/screens/LoginScreen.tsx):
// - 同文件 ssoLogin 在 Platform.OS === 'web' 直接返回
//   「网页预览暂不支持一键授权登录…」并经 useLoginForm.setError 落到错误态;
// - 同文件 handleThirdPartyLogin 的 web 分支(微信分支与非微信分支)却弹窗引导
//   「使用"智汇AI网页授权登录"按钮跳转网页端完成授权」,且「前往网页端」按钮的
//   onPress 调 form.ssoLoginAction() —— 点下去必然撞上第一条的拒绝。
//
// 本文件判据(能区分"引导存在但点下去被拒"与"引导不再出现/文案如实"):
// ① web 平台点第三方登录后,appAlert 文案不得再指向网页授权出路;
// ② 执行弹窗内所有非 cancel 按钮后,不得触发 SSO 链路(lib/sso 零调用),
//    也不得让登录表单错误态出现"暂不支持一键授权登录"这句自我拒绝;
// ③ 文案必须给出 H5 上真实可行的出路(验证码/账号密码)。
//
// 取材纪律:@ihui/shared/hooks 的 useLoginForm 走真实源(vitest 别名面里该 barrel
// 是手写替身且不含 useLoginForm,见 tests/__mocks__/ihui-shared-hooks.ts 自述),
// 否则"点引导→被拒"这条链测的就是替身。SharedLoginScreen 用捕 props 的替身是
// 正确接缝——本票判的是端内 LoginScreen 的引导决策,不判共享 UI 渲染。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { createElement } from 'react'

const { sharedPropsCaptured, appAlertCalls, ssoLib } = vi.hoisted(() => ({
  sharedPropsCaptured: [] as Array<Record<string, unknown>>,
  appAlertCalls: [] as Array<{ title: string; message?: string; buttons?: Array<{ text: string; style?: string; onPress?: () => void }> }>,
  ssoLib: {
    openSsoLogin: vi.fn(async () => null as unknown),
    extractSsoCode: vi.fn(() => null as unknown),
    exchangeSsoCode: vi.fn(async () => null as unknown),
  },
}))

vi.mock('../src/components/BottomPops', () => ({
  appAlert: (title: string, message?: string, buttons?: unknown) => {
    appAlertCalls.push({ title, message, buttons: buttons as never })
  },
}))

vi.mock('../src/lib/sso', () => ssoLib)

vi.mock('@ihui/rn-app', async () => {
  const tokens = await import('../../../packages/app/src/theme/tokens')
  const Fake = (props: Record<string, unknown>) => {
    sharedPropsCaptured.push(props)
    return createElement('div', { 'data-testid': 'shared-login-screen' })
  }
  return {
    LoginScreen: Fake,
    getTokens: tokens.getTokens,
    tokens: tokens.tokens,
  }
})

// useLoginForm 必须走真实实现(替身 barrel 根本没有这个导出)
vi.mock('@ihui/shared/hooks', async () => {
  const real = await import('../../../packages/shared/src/hooks/use-login-form')
  return { useLoginForm: real.useLoginForm }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), dispatch: vi.fn() }),
  CommonActions: { navigate: (opts: unknown) => opts },
}))

vi.mock('react-native-webview', () => ({
  WebView: () => createElement('div', null),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ returnUrl: null, setReturnUrl: vi.fn() }),
}))

vi.mock('../src/lib/auto-login-policy', () => ({
  shouldAttemptAutoLogin: () => false,
}))

vi.mock('../src/stores/auth-store', () => ({
  rnAuthStore: { getState: () => ({ setAuth: vi.fn(async () => {}) }) },
}))

vi.mock('../src/lib/wechat', () => ({
  isWechatAvailable: () => false,
  isWechatInstalled: vi.fn(async () => false),
  sendWechatAuth: vi.fn(async () => 'wx-code'),
}))

vi.mock('../src/lib/carrier-one-click', () => {
  class CarrierOneClickError extends Error {}
  return {
    CARRIER_ERROR: { NOT_CONFIGURED: 'not_configured' },
    CarrierOneClickError,
    carrierLogin: vi.fn(async () => ({})),
    getCarrierChannel: () => 'none',
    getCarrierWebUrl: () => null,
    getRecentPhone: () => null,
    isCarrierAvailable: () => false,
    resolveCarrierWebResult: vi.fn(),
  }
})

vi.mock('../src/lib/oauth-redirect', () => ({
  loginByAlipayRedirect: vi.fn(),
  loginByDingtalkRedirect: vi.fn(),
  loginByFeishuRedirect: vi.fn(),
  loginByGithubRedirect: vi.fn(),
  loginByWecomRedirect: vi.fn(),
}))

vi.mock('../src/lib/apple', () => ({
  isAppleLoginAvailable: () => false,
  loginWithAppleNative: vi.fn(),
  loginWithAppleRedirect: vi.fn(),
}))

vi.mock('../src/lib/google', () => ({
  exchangeGoogleCodeForJwt: vi.fn(),
  isGoogleLoginAvailable: () => false,
  loginWithGoogleNative: vi.fn(),
  loginWithGoogleRedirect: vi.fn(),
}))

import { LoginScreen } from '../src/screens/LoginScreen'

function latestSharedProps(): Record<string, unknown> {
  const p = sharedPropsCaptured.at(-1)
  if (!p) throw new Error('SharedLoginScreen 未被渲染(取材面失败)')
  return p
}

/** 执行弹窗里所有非 cancel 按钮(H5 上这些按钮就是"引导"的落点) */
function pressNonCancelButtons(): void {
  const call = appAlertCalls.at(-1)
  for (const b of call?.buttons ?? []) {
    if (b.style === 'cancel') continue
    act(() => {
      b.onPress?.()
    })
  }
}

describe('G-958 web(H5)登录引导不得指向被自己拒绝的死路', () => {
  beforeEach(() => {
    sharedPropsCaptured.length = 0
    appAlertCalls.length = 0
    ssoLib.openSsoLogin.mockClear()
    ssoLib.extractSsoCode.mockClear()
    ssoLib.exchangeSsoCode.mockClear()
  })

  it('web 点 GitHub 登录:弹窗文案不再引导网页授权', () => {
    render(<LoginScreen />)
    act(() => {
      ;(latestSharedProps().onThirdPartyLogin as (p: string) => void)('github')
    })
    expect(appAlertCalls).toHaveLength(1)
    const message = appAlertCalls.at(-1)?.message ?? ''
    // 死路指引的三个既往形态:按钮名、"跳转网页端"、"网页授权登录"
    expect(message).not.toMatch(/网页授权|跳转网页端|前往网页端/)
  })

  it('web 点 GitHub 登录:执行全部弹窗按钮后不触发 SSO、不出现自我拒绝错误', async () => {
    render(<LoginScreen />)
    act(() => {
      ;(latestSharedProps().onThirdPartyLogin as (p: string) => void)('github')
    })
    pressNonCancelButtons()
    await act(async () => {
      await Promise.resolve()
    })
    expect(ssoLib.openSsoLogin).not.toHaveBeenCalled()
    expect(ssoLib.exchangeSsoCode).not.toHaveBeenCalled()
    const error = String(latestSharedProps().error ?? '')
    expect(error).not.toMatch(/暂不支持一键授权登录/)
  })

  it('web 点微信登录:同样不得指向被拒绝的网页授权出路', () => {
    render(<LoginScreen />)
    act(() => {
      ;(latestSharedProps().onThirdPartyLogin as (p: string) => void)('wechat')
    })
    expect(appAlertCalls).toHaveLength(1)
    const message = appAlertCalls.at(-1)?.message ?? ''
    expect(message).not.toMatch(/网页授权|跳转网页端|前往网页端/)
    pressNonCancelButtons()
    expect(ssoLib.openSsoLogin).not.toHaveBeenCalled()
    const error = String(latestSharedProps().error ?? '')
    expect(error).not.toMatch(/暂不支持一键授权登录/)
  })

  it('web 第三方引导文案必须给出 H5 上真实可行的出路', () => {
    render(<LoginScreen />)
    act(() => {
      ;(latestSharedProps().onThirdPartyLogin as (p: string) => void)('feishu')
    })
    expect(appAlertCalls).toHaveLength(1)
    const message = appAlertCalls.at(-1)?.message ?? ''
    expect(message).toMatch(/验证码|账号密码|账密/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
