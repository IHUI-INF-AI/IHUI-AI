// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-957 web 发送腿(miniapp-bridge)契约测。
 *
 * 链路:/sso/login(client_id=miniapp-taro)在微信小程序 web-view 宿主里签发
 * sso_code 后,经 wx.miniProgram.postMessage 回传 `{type:'ihui-sso-code', sso_code}`,
 * 小程序接收侧 = apps/miniapp-taro/src/utils/sso.ts 的 extractSsoCodeFromWebviewMessages。
 *
 * 本文件锁:
 *  ① 宿主判定:微信 web-view UA(miniProgram 标记)才走回传腿,普通微信/浏览器不走;
 *  ② 载荷契约:字段名与 type 与小程序接收侧逐字同源(单向漂移 = 静默死路);
 *  ③ 失败路径:空码 / SDK 加载失败 / 加载超时不 resolve(调用方如实提示,绝不静默当成功);
 *  ④ 页面接线:PageClient 在 MINIAPP_TARO + 小程序宿主组合下接管 isCustomScheme 分支。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { __test__, handOffSsoCodeToMiniapp } from '../miniapp-bridge'

const {
  isWechatMiniProgramHost,
  buildMiniappSsoPayload,
  SSO_WEBVIEW_POST_TYPE,
  WECHAT_JWEIXIN_SRC,
} = __test__

const MINIAPP_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.49 miniProgram/miniProgram'
const WECHAT_H5_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.49'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0'

describe('宿主判定 isWechatMiniProgramHost', () => {
  it('微信小程序 web-view UA(miniProgram 标记)→ true', () => {
    expect(isWechatMiniProgramHost(MINIAPP_UA)).toBe(true)
    expect(isWechatMiniProgramHost(MINIAPP_UA.toUpperCase())).toBe(true)
  })

  it('普通微信内 H5 与桌面浏览器 → false(不得劫持 deep-link 主路径)', () => {
    expect(isWechatMiniProgramHost(WECHAT_H5_UA)).toBe(false)
    expect(isWechatMiniProgramHost(DESKTOP_UA)).toBe(false)
    expect(isWechatMiniProgramHost('')).toBe(false)
  })
})

describe('载荷契约 buildMiniappSsoPayload', () => {
  it('type 与 sso_code 字段名与小程序接收侧契约逐字同源', () => {
    expect(buildMiniappSsoPayload('CODE-1')).toEqual({
      type: SSO_WEBVIEW_POST_TYPE,
      sso_code: 'CODE-1',
    })
    expect(SSO_WEBVIEW_POST_TYPE).toBe('ihui-sso-code')
  })
})

describe('交接 handOffSsoCodeToMiniapp', () => {
  let posted: unknown[]

  beforeEach(() => {
    posted = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function stubBrowser(opts: { wxReady?: boolean; failLoad?: boolean } = {}) {
    const script = {
      src: '',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    }
    const documentStub = {
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => script),
      head: {
        appendChild: vi.fn(() => {
          if (opts.failLoad) {
            script.onerror?.()
            return
          }
          // 模拟微信 SDK 注入完成:wx.miniProgram 就绪
          vi.stubGlobal('window', {
            wx: { miniProgram: { postMessage: (payload: unknown) => posted.push(payload) } },
          })
          script.onload?.()
        }),
      },
    }
    vi.stubGlobal('document', documentStub)
    vi.stubGlobal(
      'window',
      opts.wxReady ? { wx: { miniProgram: { postMessage: (p: unknown) => posted.push(p) } } } : {},
    )
    return script
  }

  it('正常交接:注入微信官方 SDK,postMessage 载荷 = {type, sso_code}', async () => {
    stubBrowser()
    await expect(handOffSsoCodeToMiniapp('CODE-9')).resolves.toBeUndefined()
    expect(posted).toEqual([{ data: { type: 'ihui-sso-code', sso_code: 'CODE-9' } }])
  })

  it('SDK script 指向微信官方 CDN(不引第三方/不带版本漂移)', async () => {
    const script = stubBrowser()
    await handOffSsoCodeToMiniapp('CODE-9')
    expect(script.src).toBe('https://res.wx.qq.com/open/js/jweixin-1.6.0.js')
    expect(WECHAT_JWEIXIN_SRC).toBe(script.src)
  })

  it('空码:reject 且不注入 SDK(不发无凭据交接)', async () => {
    const script = stubBrowser()
    await expect(handOffSsoCodeToMiniapp('')).rejects.toThrow('empty sso_code')
    expect(script.src).toBe('')
  })

  it('SDK 加载失败:reject(调用方如实提示,绝不静默当成功)', async () => {
    stubBrowser({ failLoad: true })
    await expect(handOffSsoCodeToMiniapp('CODE-9')).rejects.toThrow()
    expect(posted).toEqual([])
  })
})

describe('页面接线锚(/sso/login PageClient)', () => {
  const pageSrc = readFileSync(resolve(__dirname, '../PageClient.tsx'), 'utf8')
  const bridgeSrc = readFileSync(resolve(__dirname, '../miniapp-bridge.ts'), 'utf8')

  it('isCustomScheme 分支里,MINIAPP_TARO + 小程序宿主组合接管为 postMessage 腿', () => {
    expect(pageSrc).toContain(
      'clientId === SSO_CLIENT_IDS.MINIAPP_TARO && isWechatMiniProgramHost()',
    )
    expect(pageSrc).toContain('handOffSsoCodeToMiniapp(r.data.code)')
  })

  it('desktop deep-link 主路径保持 location.href 不被劫持', () => {
    expect(pageSrc).toContain('window.location.href = finalUrl')
  })

  it('miniapp 完成卡文案键五语言在位(不含 desktop 键被误替换)', () => {
    const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
    for (const locale of locales) {
      const json = readFileSync(
        resolve(__dirname, `../../../../../../packages/i18n/messages/web/${locale}.json`),
        'utf8',
      )
      expect(json).toContain('"miniappHandoffTitle"')
      expect(json).toContain('"miniappHandoffHint"')
      expect(json).toContain('"miniappHandoffFailed"')
      expect(json).toContain('"desktopHandoffHint"')
    }
  })

  it('bridge 的 type 契约只登记一处字面量(页面不另抄)', () => {
    expect(pageSrc).not.toContain("'ihui-sso-code'")
  })

  it('bridge 源码不得静默吞失败(失败方向 = reject 给调用方)', () => {
    expect(bridgeSrc).toContain("throw new Error('empty sso_code')")
    expect(bridgeSrc).toContain("rejectLoad(new Error('jweixin script failed to load'))")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
