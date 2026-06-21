import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('highlight.js', () => ({
  default: {
    registerLanguage: vi.fn(),
    getLanguage: vi.fn(() => ({ name: 'javascript' })),
    highlight: vi.fn((code: string) => ({
      value: `<span class="hljs">${code}</span>`,
    })),
    highlightAuto: vi.fn((code: string) => ({
      value: code,
      language: 'plaintext',
    })),
  },
}))

describe('highlight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('模块导入', () => {
    it('应该成功导入模块', async () => {
      const mod = await import('../highlight')
      expect(mod).toBeDefined()
    })
  })

  describe('highlightCode - 指定语言高亮', () => {
    it('应该使用指定语言进行高亮', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('const x = 1', 'javascript')
      // 高亮结果应包含 span 标签
      expect(result).toContain('<span')
    })

    it('语言别名应该生效', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('const x = 1', 'js')
      expect(result).toContain('<span')
    })

    it('指定不存在的语言时应回退到自动检测', async () => {
      const { highlightCode } = await import('../highlight')
      // 不存在的语言，但代码符合 javascript 特征，应自动检测
      const result = highlightCode('const x = 1', 'nonexistent-lang')
      expect(result).toContain('<span')
    })
  })

  describe('highlightCode - 自动检测', () => {
    it('应该检测并高亮 JSON', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('{"name": "test"}')
      expect(result).toContain('<span')
    })

    it('应该检测并高亮 XML', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('<div>hello</div>')
      expect(result).toContain('<span')
    })

    it('应该检测并高亮 JavaScript', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('const x = 1')
      expect(result).toContain('<span')
    })

    it('应该检测并高亮 Python', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('def hello():\n    pass')
      expect(result).toContain('<span')
    })

    it('应该检测并高亮 SQL', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('SELECT * FROM users')
      expect(result).toContain('<span')
    })

    it('JSON 格式匹配但解析失败时应继续检测其他语言', async () => {
      const { highlightCode } = await import('../highlight')
      // 以 { 开头结尾但不是有效 JSON，也不匹配其他语言
      const result = highlightCode('{invalid json}')
      // 应返回转义文本
      expect(result).toContain('{invalid json}')
    })

    it('无法检测语言时应返回转义的 HTML 文本', async () => {
      const { highlightCode } = await import('../highlight')
      const result = highlightCode('plain text <script>')
      // 特殊字符应被转义
      expect(result).toBe('plain text &lt;script&gt;')
    })
  })

  describe('escapeHtml - HTML 转义（通过 highlightCode 间接测试）', () => {
    it('应该转义所有特殊字符', async () => {
      const { highlightCode } = await import('../highlight')
      // 无法识别的代码会触发 escapeHtml
      const result = highlightCode('a & b < c > d " e \' f')
      expect(result).toBe('a &amp; b &lt; c &gt; d &quot; e &#39; f')
    })
  })

  describe('detectLanguage - 语言检测', () => {
    it('应该检测 JSON', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('{"a": 1}')).toBe('json')
    })

    it('应该检测 XML', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('<div>')).toBe('xml')
    })

    it('应该检测 JavaScript', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('const x = 1')).toBe('javascript')
    })

    it('应该检测 Python', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('def foo():')).toBe('python')
    })

    it('应该检测 SQL', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('SELECT * FROM t')).toBe('sql')
    })

    it('无法检测时应返回 plaintext', async () => {
      const { detectLanguage } = await import('../highlight')
      expect(detectLanguage('plain text')).toBe('plaintext')
    })
  })

  describe('默认导出', () => {
    it('应该导出 hljs 实例', async () => {
      const mod = await import('../highlight')
      expect(mod.default).toBeDefined()
      expect(mod.default.getLanguage).toBeDefined()
    })
  })
})
