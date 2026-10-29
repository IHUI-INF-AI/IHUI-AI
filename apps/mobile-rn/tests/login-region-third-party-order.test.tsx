// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 L28754 RN 半格:RN 登录页的第三方登录方式优先级必须吃共享判据
 * (`@ihui/shared/auth/login-region-policy` 的 `planLoginRegion` + `reorderByPriority`),
 * 按后端 `GET /api/auth/oauth-status` 的 `loginRegion`(访客来源 IP)排,端内不得另写一份
 * 「谁排第一」。
 *
 * 钉住的四件事:
 *   ① 同一份端内成员集,ipRegion=domestic 与 ipRegion=overseas 两档给出**不同**的优先序;
 *   ② IP 那一腿**压过界面语言**(zh-CN + overseas ⇒ 海外序;en + domestic ⇒ 国内序),
 *      否则"消费了 loginRegion"完全可能是假的 —— 初始渲染按 locale 兜底就已经是某一档;
 *   ③ 只改顺序、不改成员,表外平台(RN 独有的 apple)排到末尾且保持原相对顺序;
 *   ④ 判不出(端点挂 / success=false / 缺键 / 脏值 / 抛异常)⇒ `null`,共享判据按界面语言
 *      兜底,绝不把「没判」读成国内或海外。
 *
 * 取材纪律(与 tests/g958-web-login-no-dead-end.test.tsx 同法):
 * - `@ihui/rn-app` 的共享登录屏用"捕 props 的替身"—— 本票判的是**端内算出的顺序**,
 *   共享屏只按数组顺序渲染(其 `restOptions.map`),替身即正确接缝;
 * - `@ihui/shared/auth/login-region-policy` 走真实源码(vitest.config.ts 已登记该条别名,
 *   必须排在 '@ihui/shared/auth' 父别名之前)—— 给它写 mock 测的就是 mock;
 * - `useLoginForm` 必须走真实实现(端内替身 barrel 没有这个导出)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ThirdPartyLoginOption } from '@ihui/types'
// 判据真身(vitest.config.ts 已把这条子路径别名指到 packages/shared 真实源码)
import { planLoginRegion } from '@ihui/shared/auth/login-region-policy'

import {
  __test__,
  loadServerLoginRegion,
  orderThirdPartyOptionsByRegion,
  pickServerLoginRegion,
} from '../src/hooks/use-login-region-plan'

const { sharedPropsCaptured, env } = vi.hoisted(() => ({
  sharedPropsCaptured: [] as Array<Record<string, unknown>>,
  env: {
    locale: 'zh-CN',
    /** getOAuthStatus 的答复;null = 端点不可用(抛异常) */
    loginRegion: 'domestic' as string | null | undefined,
    calls: 0,
  },
}))

/** oauth-status 其余 8 个平台位对排序不生效(RN 的成员集自己决定),本票只喂 loginRegion。 */
function oauthStatusResponse(): unknown {
  if (env.loginRegion === null) throw new Error('network down')
  return {
    success: true,
    data: {
      google: true,
      apple: true,
      dingtalk: true,
      enterpriseWechat: true,
      wechat: true,
      feishu: true,
      github: true,
      alipay: true,
      ...(env.loginRegion === undefined ? {} : { loginRegion: env.loginRegion }),
    },
  }
}

vi.mock('@ihui/api-client', async (importOriginal) => {
  // 不用 `importOriginal<typeof import('@ihui/api-client')>()`:内联 import() 类型注解
  // 撞 @typescript-eslint/consistent-type-imports;真实 barrel 在这里只当未知键值表铺开。
  const real = (await importOriginal()) as Record<string, unknown>
  return {
    ...real,
    getOAuthStatus: async () => {
      env.calls++
      return oauthStatusResponse()
    },
  }
})

vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))
vi.mock('../src/lib/sso', () => ({
  openSsoLogin: vi.fn(async () => null),
  extractSsoCode: vi.fn(() => null),
  exchangeSsoCode: vi.fn(async () => null),
}))

vi.mock('@ihui/rn-app', async () => {
  const tokens = await import('../../../packages/app/src/theme/tokens')
  const Fake = (props: Record<string, unknown>) => {
    sharedPropsCaptured.push(props)
    return createElement('div', { 'data-testid': 'shared-login-screen' })
  }
  return { LoginScreen: Fake, getTokens: tokens.getTokens, tokens: tokens.tokens }
})

vi.mock('@ihui/shared/hooks', async () => {
  const real = await import('../../../packages/shared/src/hooks/use-login-form')
  return { useLoginForm: real.useLoginForm }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), dispatch: vi.fn() }),
  CommonActions: { navigate: (opts: unknown) => opts },
}))

vi.mock('react-native-webview', () => ({ WebView: () => createElement('div', null) }))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: env.locale }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ returnUrl: null, setReturnUrl: vi.fn() }),
}))

vi.mock('../src/lib/auto-login-policy', () => ({ shouldAttemptAutoLogin: () => false }))

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

function latestThirdPartyPlatforms(): string[] {
  const p = sharedPropsCaptured.at(-1)
  if (!p) throw new Error('SharedLoginScreen 未被渲染(取材面失败)')
  const options = p.thirdPartyOptions as ThirdPartyLoginOption[] | undefined
  if (!options) throw new Error('端内没有把 thirdPartyOptions 传给共享屏')
  return options.map((o) => o.platform)
}

/** 挂载并等 loginRegion 那一腿落地(取数 → setState → 重渲染)。 */
async function renderLogin(): Promise<void> {
  await act(async () => {
    render(<LoginScreen />)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const DOMESTIC = ['wechat', 'enterpriseWechat', 'dingtalk', 'feishu', 'alipay', 'google', 'github']
const OVERSEAS = ['google', 'github', 'wechat', 'feishu', 'dingtalk', 'enterpriseWechat', 'alipay']

describe('票 L28754 RN 端第三方登录优先级(共享判据)', () => {
  beforeEach(() => {
    sharedPropsCaptured.length = 0
    env.locale = 'zh-CN'
    env.loginRegion = 'domestic'
    env.calls = 0
    __test__.resetLoginRegionCache()
  })

  afterEach(() => {
    __test__.resetLoginRegionCache()
  })

  it('国内 IP:微信→企微→钉钉→飞书→支付宝 在前,Google/GitHub 落到表外原序', async () => {
    await renderLogin()
    expect(latestThirdPartyPlatforms()).toEqual(DOMESTIC)
  })

  it('海外 IP 压过 zh-CN 界面语言:Google/GitHub 排到最前(初始 locale 兜底档被换掉)', async () => {
    env.loginRegion = 'overseas'
    await renderLogin()
    const first = sharedPropsCaptured[0]
      ? (sharedPropsCaptured[0].thirdPartyOptions as ThirdPartyLoginOption[]).map((o) => o.platform)
      : []
    expect(first[0]).toBe('wechat') // 取数前 = locale(zh-CN)兜底的国内序
    expect(latestThirdPartyPlatforms()).toEqual(OVERSEAS) // 取数后 = IP 档
  })

  it('国内 IP 压过 en 界面语言:落到国内序而不是 locale 兜底的海外序', async () => {
    env.locale = 'en'
    await renderLogin()
    const first = sharedPropsCaptured[0]
      ? (sharedPropsCaptured[0].thirdPartyOptions as ThirdPartyLoginOption[]).map((o) => o.platform)
      : []
    expect(first[0]).toBe('google')
    expect(latestThirdPartyPlatforms()).toEqual(DOMESTIC)
  })

  it('同一份成员集:两档只改顺序不改成员', async () => {
    await renderLogin()
    const domestic = latestThirdPartyPlatforms()
    __test__.resetLoginRegionCache()
    env.loginRegion = 'overseas'
    sharedPropsCaptured.length = 0
    await renderLogin()
    const overseas = latestThirdPartyPlatforms()
    expect([...domestic].sort()).toEqual([...overseas].sort())
    expect(domestic).not.toEqual(overseas)
  })

  it('取数整进程一次:二次挂载不再打 GET', async () => {
    await renderLogin()
    await act(async () => {
      render(<LoginScreen />)
    })
    expect(env.calls).toBe(1)
  })

  it('判不出(端点挂 / success=false / 缺键 / 脏值)⇒ null,不猜某一侧', async () => {
    type Status = Parameters<typeof pickServerLoginRegion>[0]
    const asStatus = (data: Record<string, unknown>): Status =>
      ({ success: true, data }) as unknown as Status
    // 缺键 / 脏值(第三种值、国名、大小写变体)/ success=false 一律未判定
    expect(pickServerLoginRegion(asStatus({ wechat: true }))).toBeNull()
    expect(pickServerLoginRegion(asStatus({ loginRegion: 'China' }))).toBeNull()
    expect(pickServerLoginRegion(asStatus({ loginRegion: 'DOMESTIC' }))).toBeNull()
    expect(pickServerLoginRegion(asStatus({ loginRegion: 1 }))).toBeNull()
    expect(pickServerLoginRegion({ success: false, error: 'boom' } as unknown as Status)).toBeNull()

    env.loginRegion = 'China'
    __test__.resetLoginRegionCache()
    await expect(loadServerLoginRegion()).resolves.toBeNull()

    env.loginRegion = null
    __test__.resetLoginRegionCache()
    await expect(loadServerLoginRegion()).resolves.toBeNull()
  })

  it('判不出时按界面语言兜底:en + 脏值 ⇒ 海外序,zh-CN + 脏值 ⇒ 国内序', async () => {
    env.loginRegion = 'China'
    await renderLogin()
    expect(latestThirdPartyPlatforms()).toEqual(DOMESTIC)

    __test__.resetLoginRegionCache()
    env.locale = 'en'
    sharedPropsCaptured.length = 0
    await renderLogin()
    expect(latestThirdPartyPlatforms()).toEqual(OVERSEAS)
  })

  it('表外平台排到末尾且保持原相对顺序(RN 独有的 apple / oidc 不被丢掉)', () => {
    const options: ThirdPartyLoginOption[] = [
      { platform: 'google', label: 'Google', enabled: true },
      { platform: 'apple', label: 'Apple', enabled: true },
      { platform: 'wechat', label: '微信', enabled: true },
      { platform: 'oidc', label: 'SSO', enabled: true },
      { platform: 'alipay', label: '支付宝', enabled: true },
    ]
    expect(
      orderThirdPartyOptionsByRegion(
        options,
        // 判据真身:ipRegion 直接喂共享层 planLoginRegion,端内不掺手表名
        planLoginRegion({ ipRegion: 'domestic', locale: 'zh-CN' }),
      ).map((o) => o.platform),
    ).toEqual(['wechat', 'alipay', 'google', 'apple', 'oidc'])
    expect(
      orderThirdPartyOptionsByRegion(
        options,
        planLoginRegion({ ipRegion: 'overseas', locale: 'zh-CN' }),
      ).map((o) => o.platform),
    ).toEqual(['google', 'apple', 'oidc', 'wechat', 'alipay'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
