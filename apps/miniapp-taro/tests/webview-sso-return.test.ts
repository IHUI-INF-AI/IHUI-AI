// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-957 回传腿(小程序接收侧)契约测
 *
 * 链路:「智汇AI网页授权登录」→ pages/webview 载 <web>/sso/login?redirect=ihui-miniapp://sso/callback
 * → H5 登录完成后 wx.miniProgram.postMessage 回传 sso_code(微信在后退/组件销毁/分享时机
 * 整批投给 bindmessage)→ 本页 onMessage 用 extractSsoCodeFromWebviewMessages 取码
 * → consumeSsoCode 调 /api/auth/sso/exchange 落登录态。
 *
 * 本文件锁两件事(都不需要真机/白名单):
 *  ① 取码契约:规范形态 `{type:'ihui-sso-code', sso_code}` 与容错形态(裸对象/URL 串/
 *     JSON 串/嵌套数组)都取得到;带其它 type 的消息一律不消费(防误吞业务回传)。
 *  ② 消费契约:换票成功写 setToken/setRefreshToken/setUserInfo(uuid=id 对齐 WebSocket)
 *     并弹成功提示、返回 true;换票失败/空码不写盘不弹错、返回 false —— 与 app.tsx
 *     启动腿 consumeSsoCodeFromLaunch 委托后的行为逐条同形(两腿共用同一出口)。
 *
 * 取材:端内 vitest environment:'node'(无 jsdom),故对页面接线(onMessage→本模块)
 * 只做静态锚定(源码 grep),运行时行为全部打在 utils/sso 的接收侧函数上。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { taroStorage, mockFetch, mockShowToast, authSpies } = vi.hoisted(() => ({
  taroStorage: {} as Record<string, unknown>,
  mockFetch: vi.fn(),
  mockShowToast: vi.fn(),
  authSpies: {
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
    setUserInfo: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', () => {
  const named = {
    getStorageSync: (key: string) => taroStorage[key] ?? '',
    removeStorageSync: (key: string) => {
      delete taroStorage[key]
    },
    setStorageSync: (key: string, val: unknown) => {
      taroStorage[key] = val
    },
    showToast: mockShowToast,
  }
  return { ...named, default: named }
})

vi.mock('@/utils/auth', () => authSpies)

vi.stubGlobal('fetch', mockFetch)

import {
  consumeSsoCode,
  extractSsoCodeFromWebviewMessages,
  SSO_WEBVIEW_MESSAGE_TYPE,
} from '../src/utils/sso'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tokenData = {
  accessToken: 'at-sso-001',
  refreshToken: 'rt-sso-001',
  expiresIn: 7200,
  refreshExpiresIn: 2592000,
  user: {
    id: 'u-sso-001',
    phone: '13800138000',
    email: 'sso@test.com',
    nickname: 'SSO用户',
    avatar: 'https://avatar.png',
    roleId: 1,
    status: 1,
  },
}

describe('G-957 webview 回传取码契约(extractSsoCodeFromWebviewMessages)', () => {
  it('规范形态:bindmessage 数组里的 {type:ihui-sso-code, sso_code} 取到码', () => {
    expect(
      extractSsoCodeFromWebviewMessages([{ type: SSO_WEBVIEW_MESSAGE_TYPE, sso_code: 'CODE-1' }]),
    ).toBe('CODE-1')
  })

  it('容错:裸 {sso_code} 也认(不带 type 的旧形态)', () => {
    expect(extractSsoCodeFromWebviewMessages([{ sso_code: 'CODE-2' }])).toBe('CODE-2')
  })

  it('隔离:带其它 type 的消息不得被误消费,后续规范消息仍命中', () => {
    expect(
      extractSsoCodeFromWebviewMessages([
        { type: 'ihui-embed-proxy-error', sso_code: 'NOT-MINE' },
        { type: SSO_WEBVIEW_MESSAGE_TYPE, sso_code: 'CODE-3' },
      ]),
    ).toBe('CODE-3')
  })

  it('容错:URL 串形态(含 ihui-miniapp:// 深链)经共享 extractSsoCode 取码', () => {
    expect(extractSsoCodeFromWebviewMessages(['https://aizhs.top/x?sso_code=CODE-4'])).toBe(
      'CODE-4',
    )
    expect(extractSsoCodeFromWebviewMessages(['ihui-miniapp://sso/callback?sso_code=CODE-5'])).toBe(
      'CODE-5',
    )
  })

  it('容错:JSON 字符串载荷解析后按对象规则处理', () => {
    expect(
      extractSsoCodeFromWebviewMessages([
        JSON.stringify({ type: SSO_WEBVIEW_MESSAGE_TYPE, sso_code: 'CODE-6' }),
      ]),
    ).toBe('CODE-6')
  })

  it('容错:嵌套数组(部分端把 data 套成二维)展平后取码', () => {
    expect(
      extractSsoCodeFromWebviewMessages([[{ type: SSO_WEBVIEW_MESSAGE_TYPE, sso_code: 'CODE-7' }]]),
    ).toBe('CODE-7')
  })

  it('容错:data 直接是单个对象(非数组)也取码', () => {
    expect(
      extractSsoCodeFromWebviewMessages({ type: SSO_WEBVIEW_MESSAGE_TYPE, sso_code: 'CODE-8' }),
    ).toBe('CODE-8')
  })

  it('拒绝:空值/垃圾/非字符串 sso_code 一律返回空串', () => {
    const junkList: unknown[] = [
      null,
      undefined,
      [],
      {},
      'hello',
      'not-a-url?sso_code=X',
      [{ sso_code: 123 }],
      [{ type: SSO_WEBVIEW_MESSAGE_TYPE }],
    ]
    for (const junk of junkList) {
      expect(extractSsoCodeFromWebviewMessages(junk)).toBe('')
    }
  })
})

describe('G-957 回传消费契约(consumeSsoCode,启动腿与回传腿共用)', () => {
  beforeEach(() => {
    Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
    vi.clearAllMocks()
  })

  it('换票成功:写三件套(uuid=id 对齐 WebSocket)、弹成功提示、返回 true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, data: tokenData }),
    })
    const ok = await consumeSsoCode('valid-code', () => 'login.loginSuccess')
    expect(ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8802/api/auth/sso/exchange',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code', clientId: 'miniapp-taro' }),
      }),
    )
    expect(authSpies.setToken).toHaveBeenCalledWith(tokenData.accessToken)
    expect(authSpies.setRefreshToken).toHaveBeenCalledWith(tokenData.refreshToken)
    expect(authSpies.setUserInfo).toHaveBeenCalledWith(
      expect.objectContaining({ id: tokenData.user.id, uuid: tokenData.user.id }),
    )
    expect(mockShowToast).toHaveBeenCalledWith({ title: 'login.loginSuccess', icon: 'success' })
  })

  it('换票失败(HTTP 非 2xx):不写盘、不弹提示、返回 false(调用方决定后续)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })
    const ok = await consumeSsoCode('expired-code', () => 'login.loginSuccess')
    expect(ok).toBe(false)
    expect(authSpies.setToken).not.toHaveBeenCalled()
    expect(authSpies.setRefreshToken).not.toHaveBeenCalled()
    expect(authSpies.setUserInfo).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('空码:不发请求、返回 false(app.tsx 启动腿短路语义保持)', async () => {
    const ok = await consumeSsoCode('', () => 'login.loginSuccess')
    expect(ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('网络异常:catch 静默返回 false(与改造前 consumeSsoCodeFromLaunch 同形)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    await expect(consumeSsoCode('any-code', () => 'login.loginSuccess')).resolves.toBe(false)
    expect(authSpies.setToken).not.toHaveBeenCalled()
  })
})

describe('G-957 页面接线锚(onMessage 已接管,不再是只 logger.info)', () => {
  const webviewSrc = readFileSync(resolve(__dirname, '../src/pages/webview/index.tsx'), 'utf8')
  const appSrc = readFileSync(resolve(__dirname, '../src/app.tsx'), 'utf8')

  it('webview 页 onMessage 走取码+消费出口,成功后 reLaunch 首页', () => {
    expect(webviewSrc).toContain('extractSsoCodeFromWebviewMessages')
    expect(webviewSrc).toContain('consumeSsoCode')
    expect(webviewSrc).toContain("reLaunch({ url: '/pages/index/index' })")
  })

  it('app.tsx 启动腿委托同一消费出口(判据不另抄一份)', () => {
    expect(appSrc).toContain('consumeSsoCode(code, successMsg)')
    expect(appSrc).not.toContain('exchangeSsoCode')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
