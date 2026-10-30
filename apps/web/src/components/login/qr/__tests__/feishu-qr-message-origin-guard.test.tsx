// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书扫码面板 postMessage 来源校验(2026-10-31 立)。
 *
 * 现读缺陷:监听器对任意来源的消息一律照做 —— 只要 data 里有个含 code= 的 url 就
 * `window.location.href = url`。而 frame-src 含 `https:` 通配(csp.ts),页面上任何第三方
 * iframe 都能 `parent.postMessage({url:'https://attacker/?code=x'})`,把用户带着假 code
 * 导航到外站;把 url 换成同源也可控参数,就成了一条开放重定向。
 *
 * 三档成对钉:
 *   ① 来自 passport iframe + passport 源 + 同源落点 ⇒ 放行(摘掉校验即翻红的正向对照);
 *   ② 来源(origin 或 source)不对 ⇒ 不动(把 origin 判定删掉 ⇒ 本条翻红);
 *   ③ 来源对但落点是外站 ⇒ 不动(把 u.origin 判定删掉 ⇒ 本条翻红)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const h = vi.hoisted(() => ({
  navigated: [] as string[],
  /** SDK 真会往容器里塞一张跨源 iframe;这里造一个同名结构,让 event.source 有可比对象 */
  madeFrame: null as HTMLIFrameElement | null,
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('@/lib/third-party-config', () => ({
  getPlatformConfig: () => ({
    enabled: true,
    clientId: 'cli_feishu_test',
    appId: '',
    scope: 'contact:user.base:readonly',
  }),
}))

vi.mock('../sdk-loader', () => ({
  loadFeishuQrSdk: () => Promise.resolve(),
}))

class FakeQRLogin {
  constructor(opts: { id: string }) {
    const host = document.getElementById(opts.id)
    if (host) {
      const frame = document.createElement('iframe')
      frame.src = 'https://passport.feishu.cn/qr/connect'
      host.appendChild(frame)
      h.madeFrame = frame
    }
  }
}

import { FeishuQrPanel } from '../FeishuQrPanel'

/** 被测组件把跳转写成 `window.location.href = …` 赋值;happy-dom 的 href 赋值会走真导航,
 *  这里换成可记录的访问器 —— 注意必须是 setter,只桩 assign/replace 会测出"永远不跳"的假绿。 */
function stubLocation(origin: string) {
  let current = `${origin}/login`
  const fake = {
    origin,
    search: '',
    get href(): string {
      return current
    },
    set href(to: string) {
      h.navigated.push(to)
      current = to
    },
    assign: (to: string) => h.navigated.push(to),
    replace: (to: string) => h.navigated.push(to),
  }
  Object.defineProperty(window, 'location', { configurable: true, value: fake })
  return fake
}

function postMessageFrom(opts: {
  origin: string
  source: unknown
  url: string
}): void {
  const ev = new MessageEvent('message', {
    data: { url: opts.url },
    origin: opts.origin,
    source: opts.source as Window,
  })
  window.dispatchEvent(ev)
}

describe('FeishuQrPanel 扫码回跳消息的来源与落点校验', () => {
  beforeEach(async () => {
    h.navigated = []
    h.madeFrame = null
    stubLocation('https://aizhs.top')
    ;(window as unknown as { QRLogin: unknown }).QRLogin = FakeQRLogin
    render(<FeishuQrPanel refreshKey={0} />)
    // 等 effect 里 loadFeishuQrSdk().then(...) 把 iframe 挂上(监听器在 then 之前就已注册)
    await vi.waitFor(() => expect(h.madeFrame).not.toBeNull())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('① passport iframe + passport 源 + 同源落点 ⇒ 放行', () => {
    postMessageFrom({
      origin: 'https://passport.feishu.cn',
      source: h.madeFrame!.contentWindow,
      url: 'https://aizhs.top/sso/callback?code=real_code',
    })

    expect(h.navigated).toEqual(['https://aizhs.top/sso/callback?code=real_code'])
  })

  it('② 别的 origin 发来的同形消息 ⇒ 一律丢弃(页内第三方 iframe 不能替用户决定跳去哪)', () => {
    postMessageFrom({
      origin: 'https://evil.example',
      source: h.madeFrame!.contentWindow,
      url: 'https://aizhs.top/sso/callback?code=forged',
    })
    // 同 origin 但 source 不是那张扫码 iframe(例如主窗口自己 top-level 发的)
    postMessageFrom({
      origin: 'https://passport.feishu.cn',
      source: window,
      url: 'https://aizhs.top/sso/callback?code=forged',
    })

    expect(h.navigated).toEqual([])
  })

  it('③ 来源合法但落点是外站 ⇒ 不导航(否则成开放重定向,code 直接送给攻击者域)', () => {
    postMessageFrom({
      origin: 'https://passport.feishu.cn',
      source: h.madeFrame!.contentWindow,
      url: 'https://evil.example/collect?code=stolen',
    })

    expect(h.navigated).toEqual([])
  })

  it('④ 没有 code 的消息不动(校验放宽不得把无关 postMessage 变成导航)', () => {
    postMessageFrom({
      origin: 'https://passport.feishu.cn',
      source: h.madeFrame!.contentWindow,
      url: 'https://aizhs.top/sso/callback?state=only_state',
    })

    expect(h.navigated).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
