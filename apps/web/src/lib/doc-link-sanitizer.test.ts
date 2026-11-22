// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { installDocLinkSanitizer, sanitizeDocumentHref } from './doc-link-sanitizer'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('sanitizeDocumentHref', () => {
  it('非字符串与空值返回 null', () => {
    expect(sanitizeDocumentHref(undefined)).toBeNull()
    expect(sanitizeDocumentHref(null)).toBeNull()
    expect(sanitizeDocumentHref(123)).toBeNull()
    expect(sanitizeDocumentHref('')).toBeNull()
    expect(sanitizeDocumentHref('   ')).toBeNull()
  })

  it('控制字符伪装协议(java\\nscript:)被拒', () => {
    expect(sanitizeDocumentHref('java\nscript:alert(1)')).toBeNull()
    expect(sanitizeDocumentHref('java\tscript:alert(1)')).toBeNull()
    expect(sanitizeDocumentHref('java\rscript:alert(1)')).toBeNull()
  })

  it('javascript: 全形态拒绝(大小写/前后空白/混合)', () => {
    expect(sanitizeDocumentHref('javascript:alert(1)')).toBeNull()
    expect(sanitizeDocumentHref('JavaScript:alert(1)')).toBeNull()
    expect(sanitizeDocumentHref('JAVASCRIPT:alert(1)')).toBeNull()
    expect(sanitizeDocumentHref('  javascript:alert(1)  ')).toBeNull()
    expect(sanitizeDocumentHref('vbscript:msgbox(1)')).toBeNull()
    expect(sanitizeDocumentHref('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(sanitizeDocumentHref('file:///etc/passwd')).toBeNull()
    expect(sanitizeDocumentHref('ftp://example.com/a')).toBeNull()
    expect(sanitizeDocumentHref('mailto:a@b.com')).toBeNull()
  })

  it('内部锚点可点,空锚点与危险字符锚点拒绝', () => {
    expect(sanitizeDocumentHref('#anchor')).toBe('#anchor')
    expect(sanitizeDocumentHref('  #anchor  ')).toBe('#anchor')
    expect(sanitizeDocumentHref('#')).toBeNull()
    expect(sanitizeDocumentHref('#a<b')).toBeNull()
    expect(sanitizeDocumentHref('#a b')).toBeNull()
  })

  it('http/https 外链放行(scheme 大小写归一判断)', () => {
    expect(sanitizeDocumentHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(sanitizeDocumentHref('http://example.com')).toBe('http://example.com')
    expect(sanitizeDocumentHref('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM')
  })

  it('无 scheme 的相对路径拒绝(不受信文档内相对链接降级为文本)', () => {
    expect(sanitizeDocumentHref('page.html')).toBeNull()
    expect(sanitizeDocumentHref('//example.com/x')).toBeNull()
  })
})

describe('installDocLinkSanitizer', () => {
  it('挂载时立即净化:不安全链接摘除 href 并标记 aria-disabled,安全锚点保留', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a href="javascript:alert(1)">bad</a><a href="#sec">ok</a>'
    const cleanup = installDocLinkSanitizer(root)

    const bad = root.querySelector('a')!
    expect(bad.getAttribute('href')).toBeNull()
    expect(bad.getAttribute('aria-disabled')).toBe('true')
    const ok = root.querySelectorAll('a')[1]!
    expect(ok.getAttribute('href')).toBe('#sec')
    expect(ok.getAttribute('aria-disabled')).toBeNull()
    cleanup()
  })

  it('后续分批挂载的新增子树被增量净化(MutationObserver)', async () => {
    const root = document.createElement('div')
    const cleanup = installDocLinkSanitizer(root)

    const batch = document.createElement('div')
    batch.innerHTML = '<a href="JAVASCRIPT:alert(1)">late</a><a href="https://example.com">out</a>'
    root.appendChild(batch)
    await flush()

    expect(batch.querySelectorAll('a')[0]!.getAttribute('href')).toBeNull()
    expect(batch.querySelectorAll('a')[1]!.getAttribute('href')).toBe('https://example.com')
    cleanup()
  })

  it('点击外链走受控打开回调,不直接导航(preventDefault)', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a href="https://example.com/x">out</a>'
    const opened: string[] = []
    const cleanup = installDocLinkSanitizer(root, (url) => {
      opened.push(url)
    })

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    root.querySelector('a')!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(opened).toEqual(['https://example.com/x'])
    cleanup()
  })

  it('内部锚点点击不拦截(交给浏览器默认滚动)', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a href="#sec">in</a>'
    const opened: string[] = []
    const cleanup = installDocLinkSanitizer(root, (url) => {
      opened.push(url)
    })

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    root.querySelector('a')!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(opened).toEqual([])
    cleanup()
  })

  it('双保险:运行期绕过净化写入的不安全 href,点击仍被阻断', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a>sneak</a>'
    const cleanup = installDocLinkSanitizer(root)
    const anchor = root.querySelector('a')!
    // 模拟运行期直接写属性(统一净化在异步观察者里尚未跑到,点击代理必须兜住)
    anchor.setAttribute('href', 'javascript:alert(1)')

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    anchor.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    cleanup()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
