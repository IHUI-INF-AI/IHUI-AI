import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  updateTitle,
  updateMetaTags,
  setStructuredData,
  generateSlug,
  truncateDescription,
  useSEO,
  generatePageStructuredData,
} from '../seo'

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('seo', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  describe('updateTitle', () => {
    it('应该更新页面标题', () => {
      updateTitle('测试标题')
      expect(document.title).toBe('测试标题')
    })

    it('应该在服务器端不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      updateTitle('测试标题')

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('updateMetaTags', () => {
    it('应该更新description元标签', () => {
      updateMetaTags({ description: '测试描述' })
      const meta = document.querySelector('meta[name="description"]')
      expect(meta?.getAttribute('content')).toBe('测试描述')
    })

    it('应该更新keywords元标签', () => {
      updateMetaTags({ keywords: '测试,关键词' })
      const meta = document.querySelector('meta[name="keywords"]')
      expect(meta?.getAttribute('content')).toBe('测试,关键词')
    })

    it('应该更新robots元标签', () => {
      updateMetaTags({ robots: 'index, follow' })
      const meta = document.querySelector('meta[name="robots"]')
      expect(meta?.getAttribute('content')).toBe('index, follow')
    })

    it('应该更新Open Graph标签', () => {
      updateMetaTags({
        ogTitle: 'OG标题',
        ogDescription: 'OG描述',
        ogImage: 'https://example.com/image.jpg',
        ogUrl: 'https://example.com',
      })

      expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('OG标题')
      expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('OG描述')
      expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://example.com/image.jpg')
      expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://example.com')
    })

    it('应该更新canonical链接', () => {
      updateMetaTags({ canonical: 'https://example.com/page' })
      const link = document.querySelector('link[rel="canonical"]')
      expect(link?.getAttribute('href')).toBe('https://example.com/page')
    })

    it('应该同时更新标题', () => {
      updateMetaTags({ title: '页面标题' })
      expect(document.title).toBe('页面标题')
    })

    it('应该在服务器端不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      updateMetaTags({ description: '测试' })

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('setStructuredData', () => {
    it('应该设置结构化数据', () => {
      setStructuredData({ '@type': 'WebPage', name: '测试页面' })
      const script = document.querySelector('script[type="application/ld+json"]')
      expect(script?.textContent).toContain('WebPage')
    })

    it('应该更新已有的结构化数据', () => {
      setStructuredData({ '@type': 'WebPage', name: '第一页' })
      setStructuredData({ '@type': 'Article', name: '第二页' })
      const scripts = document.querySelectorAll('script[type="application/ld+json"]')
      expect(scripts.length).toBe(1)
      expect(scripts[0].textContent).toContain('Article')
    })

    it('应该在服务器端不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      setStructuredData({ '@type': 'WebPage' })

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('generateSlug', () => {
    it('应该生成URL友好的slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world')
    })

    it('应该移除特殊字符', () => {
      expect(generateSlug('Hello! @World#')).toBe('hello-world')
    })

    it('应该合并多个连字符', () => {
      expect(generateSlug('Hello   World')).toBe('hello-world')
    })

    it('应该转换为小写', () => {
      expect(generateSlug('HELLO WORLD')).toBe('hello-world')
    })
  })

  describe('truncateDescription', () => {
    it('应该截断长文本', () => {
      const longText = 'a'.repeat(200)
      const result = truncateDescription(longText, 160)
      expect(result.length).toBe(163)
      expect(result.endsWith('...')).toBe(true)
    })

    it('应该保留短文本', () => {
      const shortText = '短文本'
      expect(truncateDescription(shortText)).toBe('短文本')
    })

    it('应该使用自定义最大长度', () => {
      const text = 'a'.repeat(100)
      const result = truncateDescription(text, 50)
      expect(result.length).toBe(53)
    })
  })

  describe('generatePageStructuredData', () => {
    it('应该生成页面结构化数据', () => {
      const result = generatePageStructuredData({
        title: '测试页面',
        description: '测试描述',
      })

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('WebPage')
      expect(result.name).toBe('测试页面')
      expect(result.description).toBe('测试描述')
    })

    it('应该使用自定义类型', () => {
      const result = generatePageStructuredData({
        title: '测试文章',
        description: '文章描述',
        type: 'Article',
      })

      expect(result['@type']).toBe('Article')
    })

    it('应该包含URL和图片', () => {
      const result = generatePageStructuredData({
        title: '测试页面',
        description: '描述',
        url: 'https://example.com',
        image: 'https://example.com/image.jpg',
      })

      expect(result.url).toBe('https://example.com')
      expect(result.image).toBe('https://example.com/image.jpg')
    })
  })

  describe('useSEO', () => {
    it('应该返回所有SEO函数', () => {
      const utils = useSEO()
      expect(typeof utils.updateTitle).toBe('function')
      expect(typeof utils.updateMetaTags).toBe('function')
      expect(typeof utils.setStructuredData).toBe('function')
      expect(typeof utils.generateSlug).toBe('function')
      expect(typeof utils.truncateDescription).toBe('function')
    })
  })
})
