import { describe, it, expect } from 'vitest'
import { escapeHtml, unescapeHtml, sanitizeHtml } from '../htmlSanitizer'

describe('htmlSanitizer', () => {
  describe('escapeHtml', () => {
    it('应该转义HTML特殊字符', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;')
    })

    it('应该转义&符号', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('应该保留引号', () => {
      expect(escapeHtml('"test"')).toBe('"test"')
    })

    it('应该保留单引号', () => {
      expect(escapeHtml("'test'")).toBe("'test'")
    })

    it('应该返回空字符串当输入为空', () => {
      expect(escapeHtml('')).toBe('')
      expect(escapeHtml(null as any)).toBe('')
    })

    it('应该保留普通文本', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('unescapeHtml', () => {
    it('应该反转义HTML实体', () => {
      expect(unescapeHtml('&lt;script&gt;')).toBe('<script>')
    })

    it('应该反转义&符号', () => {
      expect(unescapeHtml('a &amp; b')).toBe('a & b')
    })

    it('应该反转义引号', () => {
      expect(unescapeHtml('&quot;test&quot;')).toBe('"test"')
    })

    it('应该返回空字符串当输入为空', () => {
      expect(unescapeHtml('')).toBe('')
      expect(unescapeHtml(null as any)).toBe('')
    })

    it('应该保留普通文本', () => {
      expect(unescapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('sanitizeHtml', () => {
    it('应该移除script标签', () => {
      const html = '<div>safe</div><script>alert("xss")</script>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('<script>')
      expect(result).toContain('<div>safe</div>')
    })

    it('应该移除style标签', () => {
      const html = '<p>text</p><style>body{display:none}</style>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('<style>')
      expect(result).toContain('<p>text</p>')
    })

    it('应该移除事件处理器', () => {
      const html = '<div onclick="alert(1)">click</div>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('onclick')
      expect(result).toContain('<div>click</div>')
    })

    it('应该移除on开头的属性', () => {
      const html = '<img src="test.jpg" onerror="alert(1)">'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('onerror')
    })

    it('应该移除javascript:协议', () => {
      const html = '<a href="javascript:alert(1)">link</a>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('javascript:')
    })

    it('应该保留安全的HTML', () => {
      const html = '<div class="safe"><p>paragraph</p></div>'
      const result = sanitizeHtml(html)
      expect(result).toContain('<div')
      expect(result).toContain('<p>paragraph</p>')
    })

    it('应该保留安全的href', () => {
      const html = '<a href="https://example.com">link</a>'
      const result = sanitizeHtml(html)
      expect(result).toContain('href="https://example.com"')
    })

    it('应该返回空字符串当输入为空', () => {
      expect(sanitizeHtml('')).toBe('')
      expect(sanitizeHtml(null as any)).toBe('')
    })

    it('应该处理复杂的HTML', () => {
      const html = `
        <div onclick="evil()">
          <script>alert(1)</script>
          <a href="javascript:void(0)">bad link</a>
          <a href="https://safe.com">good link</a>
        </div>
      `
      const result = sanitizeHtml(html)
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('javascript:')
      expect(result).toContain('https://safe.com')
    })
  })
})
