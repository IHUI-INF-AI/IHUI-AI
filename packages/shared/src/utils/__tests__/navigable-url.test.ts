// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器导航协议白名单(2026-10-31 安全强化第 21 批)。
 *
 * 本文件钉的是**攻击链**而不是"函数返回值":
 *   `browser_navigate(url=file:///…/settings.json)` → CDP Page.navigate 正常渲染
 *   → browser_snapshot 把文件正文当页面文本回传 ⇒ 本地任意文件读。
 * 所以每条拒绝断言都对应一个真实的、被 CDP/chrome.tabs 接受的协议;
 * 同时保留 http/https/about:blank 的放行对照 —— 只按"全拒"也能让拒绝用例全绿,
 * 那是一张废表。
 */
import { describe, expect, it } from 'vitest'

import { checkNavigableUrl, NAVIGABLE_INTERNAL_URLS } from '../navigable-url.js'
import { ALLOWED_FETCH_PROTOCOLS } from '../ssrf-guard.js'

describe('checkNavigableUrl:协议白名单', () => {
  it('http/https 放行且原样返回(阳性对照:策略不是"什么都别导航")', () => {
    for (const url of [
      'https://example.com/a?b=1',
      'http://localhost:8911/',
      'HTTPS://Example.COM/Path',
    ]) {
      const d = checkNavigableUrl(url)
      expect(d.ok, `${url} 应放行`).toBe(true)
      // 不归一化:守卫只判协议,不得把目标改写成另一个字符串
      // (new URL().toString() 会补尾斜杠/重编码查询串,曾让扩展既有用例失败)
      if (d.ok) expect(d.url).toBe(url)
    }
    // 判据与出站协议表同源:两侧都只认 http/https
    expect([...ALLOWED_FETCH_PROTOCOLS]).toEqual(['http:', 'https:'])
  })

  it('首尾空白被裁掉后原样返回(不引入其他改写)', () => {
    const d = checkNavigableUrl('  https://example.com/a?x=1|2  ')
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.url).toBe('https://example.com/a?x=1|2')
  })

  it('about:blank 放行(CLI 建新标签的内部占位页,拦掉会砸开标签流程)', () => {
    expect(NAVIGABLE_INTERNAL_URLS).toContain('about:blank')
    const d = checkNavigableUrl('about:blank')
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.url).toBe('about:blank')
  })

  it('本地文件读链:file:// 一律拒,并点名协议', () => {
    for (const url of [
      'file:///C:/Users/Administrator/.ihui/settings.json',
      'file:///etc/passwd',
      // 大小写绕过:URL 解析会归一化 scheme,不能靠 startsWith 判
      'FILE:///C:/Windows/win.ini',
    ]) {
      const d = checkNavigableUrl(url)
      expect(d.ok, `${url} 必须拒绝`).toBe(false)
      if (!d.ok) {
        expect(d.protocol).toBe('file:')
        expect(d.reason).toContain('file:')
      }
    }
  })

  it('浏览器内部页与脚本协议:chrome/javascript/data/vbscript/blob 全拒', () => {
    const cases: Array<[string, string]> = [
      ['chrome://history', 'chrome:'],
      ['chrome-extension://abcdef/page.html', 'chrome-extension:'],
      ['javascript:alert(document.cookie)', 'javascript:'],
      ['data:text/html,<h1>x</h1>', 'data:'],
      ['vbscript:msgbox(1)', 'vbscript:'],
      ['blob:https://example.com/uuid', 'blob:'],
      ['about:config', 'about:'],
    ]
    for (const [url, protocol] of cases) {
      const d = checkNavigableUrl(url)
      expect(d.ok, `${url} 必须拒绝`).toBe(false)
      if (!d.ok) expect(d.protocol).toBe(protocol)
    }
  })

  it('空值/非字符串/无协议各给可行动原因,不静默放行', () => {
    for (const bad of ['', '   ', null, undefined, 42, {}, []]) {
      const d = checkNavigableUrl(bad)
      expect(d.ok).toBe(false)
      if (!d.ok) expect(d.reason.length).toBeGreaterThan(0)
    }
    const noScheme = checkNavigableUrl('example.com/path')
    expect(noScheme.ok).toBe(false)
    if (!noScheme.ok) expect(noScheme.reason).toContain('协议')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
