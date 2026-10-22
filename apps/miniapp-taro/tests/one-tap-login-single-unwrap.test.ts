// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时锁:`oneTapLogin` 在这条链上**只许解一次包**
 * (2026-10-23 真机实测:后端回 200 而端上仍是游客,根因是二次解包)。
 *
 * 与形状锁(tests/api-no-double-unwrap.test.ts)的分工:形状锁读源码写法,本锁读**行为**——
 * 把微信开发者工具 Network 面板里逐字抓到的那份响应体喂进真实链路
 * (post → unwrapApi → fetchApi → Taro transport),断言解出来的是内层 data。
 * 谁把 `unwrapApi(post(...))` 加回来,这条当场红。
 */
import { describe, it, expect, vi } from 'vitest'

const { calls, sent } = vi.hoisted(() => ({
  /** 传输层被要求发出的请求(端内 transport 把 body 原样交给 Taro.request,不做 JSON 串化) */
  calls: [] as Array<{ url: string; method: string; data?: unknown }>,
  /** 下一次 Taro.request 要回的信封(逐条测试自己设定) */
  sent: { envelope: {} as Record<string, unknown> },
}))

const toast = vi.hoisted(() => vi.fn())

vi.mock('@tarojs/taro', () => {
  const taro = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    removeStorageSync: () => {},
    showToast: (opts: unknown) => toast(opts),
    getEnv: () => 'weapp',
    request: (opts: {
      url: string
      method: string
      data?: unknown
      success?: (r: unknown) => void
      fail?: (e: unknown) => void
    }) => {
      calls.push({ url: opts.url, method: opts.method, data: opts.data })
      opts.success?.({ statusCode: 200, header: {}, data: sent.envelope })
      return { abort: () => {} }
    },
    navigateTo: () => Promise.resolve(),
    switchTab: () => Promise.resolve(),
    reLaunch: () => Promise.resolve(),
  }
  return { ...taro, default: taro }
})

import { setBaseUrl, setTransport } from '@ihui/api-client'
import { createTaroTransport } from '../src/utils/api-client-transport'
import { oneTapLogin } from '../src/api'

setBaseUrl('http://127.0.0.1:8802')
setTransport(createTaroTransport())

describe('oneTapLogin 只解一次包', () => {
  it('R1 真机抓到的成功信封 ⇒ resolve 出内层 data(带 accessToken,且不带 ApiResult 的 success 键)', async () => {
    sent.envelope = {
      code: 0,
      message: 'success',
      data: {
        accessToken: 'AT-from-wechat-devtools',
        refreshToken: 'RT-from-wechat-devtools',
        expiresIn: 900,
        refreshExpiresIn: 2592000,
        user: { id: 'u-1', userName: '系统管理员', phone: '186****9808' },
      },
    }
    const res = await oneTapLogin({ loginCode: 'login-code-1', phoneCode: 'phone-code-1' })
    expect(res.accessToken).toBe('AT-from-wechat-devtools')
    // 二次解包的特征就是"把已经解开的 data 再当 ApiResult 读":它身上不该出现 success 键
    expect(res as { success?: unknown }).not.toHaveProperty('success')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain('/auth/wechat/mini/one-tap-login')
    expect(calls[0]?.data).toEqual({ loginCode: 'login-code-1', phoneCode: 'phone-code-1' })
  })

  it('R2 失败信封 ⇒ 抛错,且 toast 的 title 必须是字符串(微信对 undefined 直接抛 errno 1001)', async () => {
    sent.envelope = { code: 40100, message: '验证码错误' }
    await expect(oneTapLogin({ loginCode: 'a', phoneCode: 'b' })).rejects.toThrow()
    expect(toast).toHaveBeenCalled()
    const arg = toast.mock.calls.at(-1)?.[0] as { title?: unknown }
    expect(typeof arg?.title).toBe('string')
    expect(arg?.title).not.toBe('')
  })

  it('R3 两个 code 都得发出去(手机号必须由微信侧换,不得客户端自报)', async () => {
    calls.length = 0
    sent.envelope = { code: 0, message: 'success', data: { accessToken: 'AT' } }
    await oneTapLogin({ loginCode: 'L-9', phoneCode: 'P-9' })
    const body = calls.at(-1)?.data as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['loginCode', 'phoneCode'])
  })
})
