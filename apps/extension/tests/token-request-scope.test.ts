// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * token.* 消息的作用域判据(2026-11-08,同型根因 E 类第 1 条)。
 *
 * 现状:background 的 sender 闸只校验 `sender.id === chrome.runtime.id`,内容脚本同样满足;
 * 于是页内隔离世界也能拿到 accessToken、也能触发 token.refresh。凭据作用域应收到
 * **扩展顶层上下文**(popup/sidepanel/options/SW),内容脚本一律拒。
 *
 * 本夹具同时锁接线:background 的监听器必须在调用 routeMessage 之前执行该判据,
 * 否则判据再对也等于没接。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { isTokenRequestFromUntrustedSender } from '../lib/token-gate'

const RUNTIME_ID = 'test-profile'
const EXT_ORIGIN = `chrome-extension://${RUNTIME_ID}/`

const pageSender = { id: RUNTIME_ID, url: `${EXT_ORIGIN}sidepanel.html` }
const contentSender = { id: RUNTIME_ID, url: 'https://aizhs.top/page', tab: { id: 9 } }
const foreignSender = { id: 'other-ext', url: 'chrome-extension://other-ext/popup.html' }

describe('token.* 作用域判据', () => {
  it('内容脚本发送方:token.get / token.refresh 一律拒', () => {
    expect(isTokenRequestFromUntrustedSender('token.get', contentSender, RUNTIME_ID)).toBe(true)
    expect(isTokenRequestFromUntrustedSender('token.refresh', contentSender, RUNTIME_ID)).toBe(true)
  })

  it('扩展顶层页面:token.get / token.refresh 放行', () => {
    expect(isTokenRequestFromUntrustedSender('token.get', pageSender, RUNTIME_ID)).toBe(false)
    expect(isTokenRequestFromUntrustedSender('token.refresh', pageSender, RUNTIME_ID)).toBe(false)
  })

  it('外部扩展 / 缺失 sender:拒', () => {
    expect(isTokenRequestFromUntrustedSender('token.get', foreignSender, RUNTIME_ID)).toBe(true)
    expect(isTokenRequestFromUntrustedSender('token.get', undefined, RUNTIME_ID)).toBe(true)
  })

  it('非 token 消息不归这条闸管(交给外层来源闸)', () => {
    expect(isTokenRequestFromUntrustedSender('vocab.lookup', contentSender, RUNTIME_ID)).toBe(false)
    expect(isTokenRequestFromUntrustedSender('locale.get', contentSender, RUNTIME_ID)).toBe(false)
  })
})

describe('background 接线锁', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../entrypoints/background.ts', import.meta.url)),
    'utf8',
  )

  it('token 判据在 routeMessage 之前执行,并同步回绝', () => {
    const gate = source.indexOf('isTokenRequestFromUntrustedSender')
    const route = source.indexOf('void routeMessage(msg)')
    expect(gate).toBeGreaterThan(-1)
    expect(route).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(route)
    // 回绝必须显式回包(不静默、不继续走路由)
    expect(source.slice(gate, route)).toContain("ok: false")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
