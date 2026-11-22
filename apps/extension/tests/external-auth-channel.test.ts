// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-66 回归锁: 第三方登录 token 回传通道。
 * 8 平台登录只 chrome.tabs.create 跳 web 端,此前全仓无回传链路
 * (manifest 无 externally_connectable、background 无 onMessageExternal)
 * ⇒ web 端登录成功,回扩展仍停在登录页。
 * 判据层(lib/external-auth)直驱 + 三处接线(background/wxt.config/SidepanelApp)源码锁。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_AUTH_MESSAGE_TYPE,
  isAllowedExternalAuthSenderUrl,
  parseExternalAuthTokenMessage,
} from '../lib/external-auth'

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('external-auth 判据 (DBG-66)', () => {
  it('白名单来源 + 合法消息 → 完整 token 对', () => {
    expect(
      parseExternalAuthTokenMessage(
        {
          type: EXTERNAL_AUTH_MESSAGE_TYPE,
          accessToken: ' at-1 ',
          refreshToken: ' rt-1 ',
          expiresIn: 3600,
        },
        'https://www.aizhs.top/signin/callback',
      ),
    ).toEqual({ accessToken: 'at-1', refreshToken: 'rt-1', expiresIn: 3600 })
  })

  it('本地开发 http://localhost 来源放行', () => {
    expect(
      parseExternalAuthTokenMessage(
        { type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken: 'at' },
        'http://localhost:8802/signin',
      ),
    ).toEqual({ accessToken: 'at' })
  })

  it('非白名单来源一律拒绝(含后缀伪装与 http 第三方域)', () => {
    const msg = { type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken: 'at' }
    expect(parseExternalAuthTokenMessage(msg, 'http://evil.example/signin')).toBeNull()
    expect(parseExternalAuthTokenMessage(msg, 'https://aizhs.top.evil.com/signin')).toBeNull()
    expect(parseExternalAuthTokenMessage(msg, 'https://notevil.aizhs.top.attacker.net/')).toBeNull()
    expect(parseExternalAuthTokenMessage(msg, 'http://evil.localhost:8802/')).toBeNull()
    expect(parseExternalAuthTokenMessage(msg, undefined)).toBeNull()
    expect(parseExternalAuthTokenMessage(msg, 'not-a-url')).toBeNull()
  })

  it('消息形状判据:type 精确匹配,accessToken 必须非空', () => {
    const ok = 'https://www.aizhs.top/signin'
    expect(parseExternalAuthTokenMessage({ type: 'other', accessToken: 'at' }, ok)).toBeNull()
    expect(parseExternalAuthTokenMessage({ accessToken: 'at' }, ok)).toBeNull()
    expect(parseExternalAuthTokenMessage({ type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken: '  ' }, ok)).toBeNull()
    expect(parseExternalAuthTokenMessage({ type: EXTERNAL_AUTH_MESSAGE_TYPE }, ok)).toBeNull()
    expect(parseExternalAuthTokenMessage(null, ok)).toBeNull()
  })

  it('可选字段类型不符只丢弃,不否决整条登录', () => {
    const ok = 'https://www.aizhs.top/signin'
    expect(
      parseExternalAuthTokenMessage(
        { type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken: 'at', refreshToken: 42, expiresIn: -5 },
        ok,
      ),
    ).toEqual({ accessToken: 'at' })
    expect(
      parseExternalAuthTokenMessage(
        { type: EXTERNAL_AUTH_MESSAGE_TYPE, accessToken: 'at', expiresIn: Number.NaN },
        ok,
      ),
    ).toEqual({ accessToken: 'at' })
  })

  it('isAllowedExternalAuthSenderUrl: apex 域与 ::1 环回放行', () => {
    expect(isAllowedExternalAuthSenderUrl('https://aizhs.top/')).toBe(true)
    expect(isAllowedExternalAuthSenderUrl('http://[::1]:8802/')).toBe(true)
    expect(isAllowedExternalAuthSenderUrl('https://aizhs.top.evil.com/')).toBe(false)
    expect(isAllowedExternalAuthSenderUrl('http://aizhs.top/')).toBe(false)
  })
})

describe('回传通道接线 (DBG-66)', () => {
  it('manifest 开 externally_connectable 且与 host_permissions 同域', () => {
    const wxt = read('../wxt.config.ts')
    expect(wxt).toContain('externally_connectable')
    expect(wxt).toContain("'https://*.aizhs.top/*'")
    expect(wxt).toContain("'http://localhost:8802/*'")
  })

  it('background 注册 onMessageExternal 并落 tokenStore + 排续期', () => {
    const bg = read('../entrypoints/background.ts')
    expect(bg).toContain('chrome.runtime.onMessageExternal')
    expect(bg).toContain('parseExternalAuthTokenMessage')
    expect(bg).toContain('registerExternalAuthListener()')
    const body = bg.slice(bg.indexOf('function registerExternalAuthListener'))
    expect(body).toContain('setTokenPair(pair)')
    expect(body).toContain('scheduleRefreshAlarm(pair.accessToken)')
    expect(body).toContain('sendResponse({ ok: true })')
    expect(body).toContain('sendResponse({ ok: false')
  })

  it('侧栏在未登录态盯 storage.local token 键接管登录页', () => {
    const sp = read('../entrypoints/sidepanel/SidepanelApp.tsx')
    expect(sp).toContain('TOKEN_STORAGE_KEY')
    expect(sp).toContain('chrome.storage.onChanged.addListener')
    expect(sp).toContain('if (authed) return')
  })

  it('第三方登录入口仍跳 web 端(from=extension 标识不变)', () => {
    const hook = read('../src/hooks/use-extension-third-party-auth.tsx')
    expect(hook).toContain('from=extension&platform=')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
