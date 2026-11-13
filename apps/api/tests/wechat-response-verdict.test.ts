// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信侧"HTTP 200 + body.errcode"这一族的响应判据锁(2026-10-22 立)。
 *
 * 立因(线上现读):假 code 直打 `GET /api/auth/wechat/mini/login` ⇒ 500「服务器错误」。
 * 根因不是路由写错,是**取号那一步不读 errcode**:`jscode2session` 只看 `resp.ok`,
 * 而微信拒绝一个一次性 code 时回的是 200 + `{errcode:40029}` —— 于是函数返回
 * `{openId: undefined}`,调用方拿"成功"的形状继续往下走。这与本仓前两天修过的
 * 阿里云 SendSms 那一格是**同一个缺陷族**(200 不等于成功,业务码在 body 里),
 * 区别只在这条腿住在认证路径上:它一旦"不抛",后面就是空 `open_id` 的绑定与 token。
 *
 * 所以判据要同时管两件事:errcode 非零是失败,**关键字段为空也是失败**。
 * 每条都配成对反例(§feedback-fix-must-carry-mutation-proof):
 * 只判 errcode 的版本会放掉"空 openid",只判字段的版本会放掉"40029 且没 openid"——
 * 两档必须各有一枚夹具把它单独照出来。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAccessToken,
  getPhoneNumber,
  jscode2session,
  WechatApiError,
  wechatAppCode2session,
} from '../src/services/oauth-providers.js'

// 2026-11 起 oauth 出网走 proxy-dispatcher(isProxiedUrl/proxiedFetch/directEgressFetch),
// 不再直接读 globalThis.fetch。旧夹具只替换 globalThis.fetch,于是走到未初始化的
// proxy 配置上(读 .get of undefined)。这里把出网闸门原样代回 globalThis.fetch,
// 用例的假响应仍然只有一份来源。
vi.mock('../src/utils/proxy-dispatcher.js', () => ({
  isProxiedUrl: () => false,
  proxiedFetch: (url: string, init?: RequestInit) => globalThis.fetch(url, init),
  directEgressFetch: (url: string, init?: RequestInit) => globalThis.fetch(url, init),
}))

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response

const originalFetch = globalThis.fetch
beforeEach(() => {
  process.env.WX_MINI_APPID = 'wx-fixture-appid'
  process.env.WX_MINI_SECRET = 'fixture-secret'
  process.env.WECHAT_MOBILE_APP_ID = 'wx-fixture-mobile'
  process.env.WECHAT_MOBILE_SECRET = 'fixture-mobile-secret'
})
afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('jscode2session:微信的拒绝必须变成异常,不是 undefined 字段', () => {
  it('① errcode=40029(一次性 code 无效)⇒ 抛 WechatApiError,且带上这个码', async () => {
    globalThis.fetch = vi.fn(async () => json({ errcode: 40029, errmsg: 'invalid code' })) as never
    await expect(jscode2session('FAKE')).rejects.toMatchObject({
      name: 'WechatApiError',
      errcode: 40029,
    })
  })

  it('② 反向对照:200 且没有 openid 字段也不能算成功(旧写法在这里返回 openId:undefined)', async () => {
    globalThis.fetch = vi.fn(async () => json({ session_key: 'sk' })) as never
    await expect(jscode2session('FAKE')).rejects.toBeInstanceOf(WechatApiError)
  })

  it('③ openid 是空串同样算失败(空身份正是"能造出空绑定"那一格)', async () => {
    globalThis.fetch = vi.fn(async () => json({ openid: '' })) as never
    await expect(jscode2session('FAKE')).rejects.toBeInstanceOf(WechatApiError)
  })

  it('④ 正向对照:正常返回必须原样拿到 openid', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({ openid: 'o-abc', unionid: 'u-abc', session_key: 'sk' }),
    ) as never
    const s = await jscode2session('GOOD')
    expect(s.openId).toBe('o-abc')
    expect(s.unionId).toBe('u-abc')
  })

  it('⑤ HTTP 本身非 2xx 仍旧报错(不能因为加了 body 判据就把传输层失败漏掉)', async () => {
    globalThis.fetch = vi.fn(async () => json({ errcode: 0 }, false)) as never
    await expect(jscode2session('FAKE')).rejects.toThrow(/500|failed/)
  })
})

/**
 * 按 **URL** 分派假答复,而不是按调用次序:`getAccessToken` 有模块级缓存,
 * 一旦某个用例真取到 token,后面的用例就少一次 fetch —— 按次序分派会静默错位,
 * 而错位的形态是"手机号那几条其实在测 token 的桩"。
 */
function routeFetch(
  phoneBody: unknown,
  tokenBody: unknown = { access_token: 'fixture-token', expires_in: 7200 },
): void {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url)
    if (u.includes('/cgi-bin/token')) return json(tokenBody)
    if (u.includes('/wxa/business/getuserphonenumber')) return json(phoneBody)
    throw new Error(`夹具没准备好的 URL:${u.slice(0, 60)}`)
  }) as never
}

describe('cgi-bin/token 与 getuserphonenumber 同一把尺', () => {
  it('token:errcode 非零 ⇒ 抛(旧写法把 undefined 缓存成"有效 token")', async () => {
    routeFetch({}, { errcode: 40164, errmsg: 'invalid ip, not in whitelist' })
    await expect(getAccessToken()).rejects.toBeInstanceOf(WechatApiError)
  })

  it('token:200 但没有 access_token ⇒ 同样抛', async () => {
    routeFetch({}, { expires_in: 7200 })
    await expect(getAccessToken()).rejects.toBeInstanceOf(WechatApiError)
  })

  it('手机号:errcode 非零 ⇒ 抛(此前是 data.phone_info.phoneNumber 直接 TypeError)', async () => {
    routeFetch({ errcode: 40029, errmsg: 'invalid code' })
    await expect(getPhoneNumber('FAKE')).rejects.toBeInstanceOf(WechatApiError)
  })

  it('手机号:phone_info 缺 phoneNumber ⇒ 同样抛(不许回 undefined 给上层入库)', async () => {
    routeFetch({ errcode: 0, phone_info: {} })
    await expect(getPhoneNumber('FAKE')).rejects.toBeInstanceOf(WechatApiError)
  })

  it('手机号:正向对照', async () => {
    routeFetch({ errcode: 0, phone_info: { phoneNumber: '+8613800000000' } })
    await expect(getPhoneNumber('GOOD')).resolves.toBe('+8613800000000')
  })
})

/**
 * 移动应用登录(sns/oauth2/access_token + sns/userinfo)同一把尺。
 * 立因(2026-11-13 线上现读):真机微信授权成功、服务端却统一回「登录已过期」——
 * 因为这条腿把 body.errcode 丢掉了,40125(AppSecret 不匹配)与 40029(code 失效)
 * 在日志里长得一模一样。以下三例子钉住"errcode 必须带着码抛"与"空 openid 不算成功"。
 */
describe('移动应用 code2session:上游拒绝必须带 errcode', () => {
  function routeMobile(tokenBody: unknown, userBody: unknown = {}): void {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/sns/oauth2/access_token')) return json(tokenBody)
      if (u.includes('/sns/userinfo')) return json(userBody)
      throw new Error(`夹具没准备好的 URL:${u.slice(0, 60)}`)
    }) as never
  }

  it('appsecret 不匹配(40125)⇒ 抛 WechatApiError 且带 40125(旧写法只剩一句泛化文案)', async () => {
    routeMobile({ errcode: 40125, errmsg: 'invalid appsecret' })
    await expect(wechatAppCode2session('FAKE')).rejects.toMatchObject({
      name: 'WechatApiError',
      errcode: 40125,
    })
  })

  it('200 但缺 openid ⇒ 同样抛(不许用空串继续建绑定)', async () => {
    routeMobile({ access_token: 'at' })
    await expect(wechatAppCode2session('FAKE')).rejects.toBeInstanceOf(WechatApiError)
  })

  it('正向对照:token+userinfo 正常时拿到 openid', async () => {
    routeMobile(
      { access_token: 'at', openid: 'o-abc', unionid: 'u-abc' },
      { openid: 'o-abc', unionid: 'u-abc', nickname: '微信用户' },
    )
    await expect(wechatAppCode2session('GOOD')).resolves.toMatchObject({
      openId: 'o-abc',
      unionId: 'u-abc',
      nickname: '微信用户',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
