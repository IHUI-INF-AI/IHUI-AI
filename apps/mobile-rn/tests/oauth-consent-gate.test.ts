// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 第三方 OAuth 发起期协议同意闸(2026-10-27,服务端 fail-closed 配套)
 *
 * 判据来源 `PROJECT_PLAN` 2026-10-27 oauth-consent 行:`POST /auth/:platform/callback`
 * 只认发起期已落 Redis 且绑定 state 的同意记录。本套件钉三件事:
 *  ① 通用回调入口(飞书/Google/GitHub/支付宝/Apple 重定向 + Google 原生)必须先
 *     `recordOAuthConsent(platform, state, true)`,再开授权会话 / 调回调;
 *  ② 记录失败(非 ok / 抛异常)⇒ 不打开授权会话、不调回调(fail-closed);
 *  ③ 走专有登录端点的钉钉/企微入口本轮不记录(票面范围外,语义不变)。
 *
 * 取材纪律:lib 层走真实源码 + 只 mock 外部边界(expo-web-browser、@ihui/api-client)——
 * 给被测实现写 mock 测的就是 mock。`@ihui/api-client` 在 vitest.config.ts 的别名本就指真实
 * 源码,此处只覆写 recordOAuthConsent / oauthCallback 两条网络出口。
 *
 * LoginScreen 只能静态断言(不渲染):该模块顶层 `require('../../assets/*.svg')` 是
 * metro svg-transformer 编译期产物,vitest 无 require 垫片 ⇒ 收集期即失败,渲染路径在本仓
 * harness 下结构上不可达(同 tests/login-error-identity.test.ts 的记录)。故用源码锚点锁
 * 「入口先过闸、同意后自动续登」的接线,注释里写明为何不是行为断言。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  // 平台配置常量在各 lib 模块加载时读取,必须在 import 前落到 env
  process.env.EXPO_PUBLIC_FEISHU_APP_ID = 'feishu-app-id'
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.EXPO_PUBLIC_APPLE_CLIENT_ID = 'apple-client-id'
  process.env.EXPO_PUBLIC_WECOM_CORP_ID = 'wecom-corp-id'
  process.env.EXPO_PUBLIC_WECOM_AGENT_ID = 'wecom-agent-id'
  return {
    recordOAuthConsent: vi.fn(),
    oauthCallback: vi.fn(),
    openAuthSessionAsync: vi.fn(),
  }
})

vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: mocks.openAuthSessionAsync,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  // 不用内联 import() 类型注解(撞 @typescript-eslint/consistent-type-imports);
  // 真实 barrel 只当未知键值表铺开,仅覆写两条网络出口。
  const real = (await importOriginal()) as Record<string, unknown>
  return {
    ...real,
    recordOAuthConsent: mocks.recordOAuthConsent,
    oauthCallback: mocks.oauthCallback,
  }
})

// apple.ts 用 Platform.OS 判分支(默认替身是 'web',会让登录直接返回不支持);
// 按本仓规矩用 importOriginal 部分覆盖,不整厂复制 react-native 替身。
vi.mock('react-native', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>
  const platform = real.Platform as Record<string, unknown>
  return { ...real, Platform: { ...platform, OS: 'android' } }
})

import { loginByFeishuRedirect, loginByWecomRedirect } from '../src/lib/oauth-redirect'
import { exchangeGoogleCodeForJwt } from '../src/lib/google'
import { loginWithAppleRedirect } from '../src/lib/apple'

const LOGIN_RESULT = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
  refreshExpiresIn: 7200,
  user: { id: 'u-1' },
}

/** 从已打开的授权 URL 里取实际 state(记录与打开必须是同一个) */
function stateFromOpenUrl(url: string): string {
  return new URL(url).searchParams.get('state') ?? ''
}

beforeEach(() => {
  mocks.recordOAuthConsent.mockResolvedValue({ success: true, data: { ok: true } })
  mocks.oauthCallback.mockResolvedValue({ success: true, data: LOGIN_RESULT })
  // 默认用户关闭授权页:只关心"有没有打开",不关心后续换 JWT
  mocks.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' })
})

describe('oauth-redirect:打开授权会话前先落协议同意', () => {
  it('飞书:先 recordOAuthConsent(feishu, state, true),再 openAuthSessionAsync(同一 state)', async () => {
    const res = await loginByFeishuRedirect()

    expect(mocks.recordOAuthConsent).toHaveBeenCalledTimes(1)
    const [platform, state, accepted] = mocks.recordOAuthConsent.mock.calls[0] as [
      string,
      string,
      boolean,
    ]
    expect(platform).toBe('feishu')
    expect(accepted).toBe(true)
    expect(mocks.openAuthSessionAsync).toHaveBeenCalledTimes(1)
    expect(stateFromOpenUrl(mocks.openAuthSessionAsync.mock.calls[0]![0] as string)).toBe(state)
    expect(mocks.recordOAuthConsent.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.openAuthSessionAsync.mock.invocationCallOrder[0]!,
    )
    expect(res.cancelled).toBe(true)
  })

  it('记录失败(503)→ 中止,不打开浏览器,错误透传给既有呈现', async () => {
    mocks.recordOAuthConsent.mockResolvedValue({
      success: false,
      error: 'OAuth 协议同意服务暂不可用',
      status: 503,
    })

    const res = await loginByFeishuRedirect()

    expect(res.success).toBe(false)
    expect(res.error).toBe('OAuth 协议同意服务暂不可用')
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it('success=true 但 data.ok 不为 true(半截成功)→ 同样中止', async () => {
    mocks.recordOAuthConsent.mockResolvedValue({ success: true, data: { ok: false } })

    const res = await loginByFeishuRedirect()

    expect(res.success).toBe(false)
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it('记录抛异常 → 中止(按失败返回,不把异常撒给调用方)', async () => {
    mocks.recordOAuthConsent.mockRejectedValue(new Error('network down'))

    const res = await loginByFeishuRedirect()

    expect(res.success).toBe(false)
    expect(res.error).toBe('network down')
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it('Apple 重定向分支同样记录(apple, state, true)', async () => {
    await loginWithAppleRedirect()

    expect(mocks.recordOAuthConsent).toHaveBeenCalledTimes(1)
    const [platform, state, accepted] = mocks.recordOAuthConsent.mock.calls[0] as [
      string,
      string,
      boolean,
    ]
    expect(platform).toBe('apple')
    expect(accepted).toBe(true)
    expect(stateFromOpenUrl(mocks.openAuthSessionAsync.mock.calls[0]![0] as string)).toBe(state)
  })

  it('企微专有入口(wecomLogin)本轮不记录,语义不变', async () => {
    await loginByWecomRedirect()

    expect(mocks.recordOAuthConsent).not.toHaveBeenCalled()
    expect(mocks.openAuthSessionAsync).toHaveBeenCalledTimes(1)
  })
})

describe('google 原生分支:先记录再回调', () => {
  it('recordOAuthConsent(google, state, true) 先于 oauthCallback(google, code, 同一 state)', async () => {
    const res = await exchangeGoogleCodeForJwt('server-auth-code')

    expect(res.success).toBe(true)
    expect(mocks.recordOAuthConsent).toHaveBeenCalledTimes(1)
    const [platform, state, accepted] = mocks.recordOAuthConsent.mock.calls[0] as [
      string,
      string,
      boolean,
    ]
    expect(platform).toBe('google')
    expect(accepted).toBe(true)
    expect(mocks.oauthCallback).toHaveBeenCalledWith('google', 'server-auth-code', state)
    expect(mocks.recordOAuthConsent.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.oauthCallback.mock.invocationCallOrder[0]!,
    )
  })

  it('记录失败 → 不调 oauthCallback', async () => {
    mocks.recordOAuthConsent.mockResolvedValue({ success: false, error: '未同意' })

    const res = await exchangeGoogleCodeForJwt('server-auth-code')

    expect(res.success).toBe(false)
    expect(res.error).toBe('未同意')
    expect(mocks.oauthCallback).not.toHaveBeenCalled()
  })
})

describe('LoginScreen:第三方按钮入口过前端同意闸(静态接线锁)', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'screens', 'LoginScreen.tsx'), 'utf8')

  it('PendingLoginAction 增加 thirdParty 档(带 platform)', () => {
    expect(source).toContain("| { kind: 'thirdParty'; platform: ThirdPartyPlatform }")
  })

  it('handleThirdPartyLogin 第一步是 checkAgreement thirdParty 档,通过后才执行', () => {
    const wrapper = source.indexOf('const handleThirdPartyLogin')
    expect(wrapper, '入口函数被改名/搬迁,测试须随实态更新').toBeGreaterThan(-1)
    const gate = source.indexOf("checkAgreement({ kind: 'thirdParty', platform })", wrapper)
    const perform = source.indexOf('void performThirdPartyLogin(platform)', wrapper)
    expect(gate).toBeGreaterThan(wrapper)
    expect(perform).toBeGreaterThan(gate)
  })

  it('协议弹窗「同意」后自动续登第三方(不再要求二次点击)', () => {
    expect(source).toMatch(
      /typeof action === 'object'\)\s*void performThirdPartyLogin\(action\.platform\)/,
    )
  })

  it('共享屏只挂带闸入口,不得直连 performThirdPartyLogin', () => {
    expect(source).toContain('onThirdPartyLogin={handleThirdPartyLogin}')
    expect(source).not.toContain('onThirdPartyLogin={performThirdPartyLogin}')
  })

  it('微信原生 loginByWechat 在 performThirdPartyLogin 内,因此同样被入口闸覆盖', () => {
    const perform = source.indexOf('const performThirdPartyLogin')
    const wechat = source.indexOf('loginByWechat(code)', perform)
    const wrapper = source.indexOf('const handleThirdPartyLogin', perform)
    expect(wechat).toBeGreaterThan(perform)
    expect(wechat).toBeLessThan(wrapper)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
