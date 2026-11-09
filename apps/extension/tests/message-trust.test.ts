// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展内消息来源判据单测(2026-11-08,同型根因 D 类)。
 *
 * 背景:bridge / ext-ui-listener / content.ts 三处 onMessage 监听此前各自只靠
 * "扩展内只有本扩展能发消息"的隐式假设。本用例把三类 sender 形态钉死:
 * - 外部扩展(id 不同)         → 一律拒
 * - 本扩展 content script(带 tab, url 是宿主页面) → 顶层页面判据拒
 * - 本扩展顶层页面/Service Worker(url 是 chrome-extension://) → 放行
 */
import { describe, it, expect } from 'vitest'
import {
  isTrustedExtensionSender,
  isTrustedExtensionPageSender,
  isTrustedTopLevelExtensionSender,
} from '../lib/message-trust'

const RUNTIME_ID = 'test-profile'
const EXT_ORIGIN = `chrome-extension://${RUNTIME_ID}/`

const pageSender = { id: RUNTIME_ID, url: `${EXT_ORIGIN}sidepanel.html` }
const backgroundSender = { id: RUNTIME_ID, url: `${EXT_ORIGIN}background.js` }
const contentSender = {
  id: RUNTIME_ID,
  url: 'https://aizhs.top/some-page',
  tab: { id: 9 },
}
const foreignSender = { id: 'other-ext', url: 'chrome-extension://other-ext/popup.html' }

describe('扩展消息来源判据', () => {
  it('isTrustedExtensionSender: 只认本扩展 id', () => {
    expect(isTrustedExtensionSender(pageSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedExtensionSender(contentSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedExtensionSender(foreignSender, RUNTIME_ID)).toBe(false)
    expect(isTrustedExtensionSender(undefined, RUNTIME_ID)).toBe(false)
  })

  it('isTrustedExtensionPageSender: content script 的宿主页面 URL 不算扩展页面', () => {
    expect(isTrustedExtensionPageSender(pageSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedExtensionPageSender(backgroundSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedExtensionPageSender(contentSender, RUNTIME_ID)).toBe(false)
    expect(isTrustedExtensionPageSender(foreignSender, RUNTIME_ID)).toBe(false)
    // 假 origin:同前缀但不是 chrome-extension://<本 id>/
    expect(
      isTrustedExtensionPageSender(
        { id: RUNTIME_ID, url: 'chrome-extension://test-profile-evil/popup.html' },
        RUNTIME_ID,
      ),
    ).toBe(false)
  })

  it('isTrustedTopLevelExtensionSender: 带 tab 的 content script 发送方拒', () => {
    expect(isTrustedTopLevelExtensionSender(backgroundSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedTopLevelExtensionSender(pageSender, RUNTIME_ID)).toBe(true)
    expect(isTrustedTopLevelExtensionSender(contentSender, RUNTIME_ID)).toBe(false)
    expect(isTrustedTopLevelExtensionSender(foreignSender, RUNTIME_ID)).toBe(false)
    expect(isTrustedTopLevelExtensionSender(undefined, RUNTIME_ID)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
