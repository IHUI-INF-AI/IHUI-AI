import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseUrl,
  buildUrl,
  getQueryParams,
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  updateQueryParams,
  isAbsoluteUrl,
  isRelativeUrl,
  joinUrl,
  normalizeUrl,
  extractDomain,
  extractPath,
  extractFilename,
  extractExtension,
  isValidUrl,
  isHttpUrl,
  isDataUrl,
  isBlobUrl,
  encodeParams,
  decodeParams,
  useUrl,
} from '../url'

describe('url', () => {
  describe('parseUrl', () => {
    it('应该解析完整URL', () => {
      const result = parseUrl('https://example.com:8080/path?query=value#hash')
      expect(result).not.toBeNull()
      expect(result?.protocol).toBe('https')
      expect(result?.host).toBe('example.com:8080')
      expect(result?.hostname).toBe('example.com')
      expect(result?.port).toBe('8080')
      expect(result?.pathname).toBe('/path')
      expect(result?.params.query).toBe('value')
      expect(result?.hash).toBe('#hash')
    })

    it('应该返回null当URL为空', () => {
      expect(parseUrl('')).toBeNull()
      expect(parseUrl(null as any)).toBeNull()
    })

    it('应该解析相对URL', () => {
      const result = parseUrl('/path/to/page')
      expect(result).not.toBeNull()
      expect(result?.pathname).toBe('/path/to/page')
    })
  })

  describe('buildUrl', () => {
    it('应该构建带参数的URL', () => {
      const result = buildUrl('https://example.com/api', { page: 1, size: 10 })
      expect(result).toContain('page=1')
      expect(result).toContain('size=10')
    })

    it('应该返回原始URL当没有参数', () => {
      const result = buildUrl('https://example.com')
      expect(result).toContain('https://example.com')
    })

    it('应该返回空字符串当base为空', () => {
      expect(buildUrl('')).toBe('')
    })

    it('应该忽略空值参数', () => {
      const result = buildUrl('https://example.com', { a: 'test', b: undefined, c: null, d: '' })
      expect(result).toContain('a=test')
      expect(result).not.toContain('b=')
      expect(result).not.toContain('c=')
      expect(result).not.toContain('d=')
    })
  })

  describe('getQueryParams', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?foo=bar&baz=qux' },
        writable: true,
        configurable: true,
      })
    })

    it('应该从当前URL获取参数', () => {
      const params = getQueryParams()
      expect(params.foo).toBe('bar')
      expect(params.baz).toBe('qux')
    })

    it('应该从指定URL获取参数', () => {
      const params = getQueryParams('https://example.com?a=1&b=2')
      expect(params.a).toBe('1')
      expect(params.b).toBe('2')
    })
  })

  describe('getQueryParam', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?name=test' },
        writable: true,
        configurable: true,
      })
    })

    it('应该返回指定参数值', () => {
      expect(getQueryParam('name')).toBe('test')
    })

    it('应该返回null当参数不存在', () => {
      expect(getQueryParam('nonexistent')).toBeNull()
    })
  })

  describe('setQueryParam', () => {
    it('应该设置URL参数', () => {
      const result = setQueryParam('https://example.com', 'key', 'value')
      expect(result).toContain('key=value')
    })

    it('应该返回空字符串当URL为空', () => {
      expect(setQueryParam('', 'key', 'value')).toBe('')
    })
  })

  describe('removeQueryParam', () => {
    it('应该移除URL参数', () => {
      const result = removeQueryParam('https://example.com?a=1&b=2', 'a')
      expect(result).not.toContain('a=')
      expect(result).toContain('b=2')
    })

    it('应该返回空字符串当URL为空', () => {
      expect(removeQueryParam('', 'key')).toBe('')
    })
  })

  describe('updateQueryParams', () => {
    it('应该更新URL参数', () => {
      const result = updateQueryParams('https://example.com?a=1', { a: 2, b: 3 })
      expect(result).toContain('a=2')
      expect(result).toContain('b=3')
    })

    it('应该删除空值参数', () => {
      const result = updateQueryParams('https://example.com?a=1&b=2', { a: null })
      expect(result).not.toContain('a=')
    })

    it('应该返回空字符串当URL为空', () => {
      expect(updateQueryParams('', { a: 1 })).toBe('')
    })
  })

  describe('isAbsoluteUrl', () => {
    it('应该返回true当是绝对URL', () => {
      expect(isAbsoluteUrl('https://example.com')).toBe(true)
      expect(isAbsoluteUrl('http://localhost')).toBe(true)
      expect(isAbsoluteUrl('ftp://server.com')).toBe(true)
    })

    it('应该返回false当是相对URL', () => {
      expect(isAbsoluteUrl('/path')).toBe(false)
      expect(isAbsoluteUrl('./path')).toBe(false)
    })

    it('应该返回false当URL为空', () => {
      expect(isAbsoluteUrl('')).toBe(false)
      expect(isAbsoluteUrl(null as any)).toBe(false)
    })
  })

  describe('isRelativeUrl', () => {
    it('应该返回true当是相对URL', () => {
      expect(isRelativeUrl('/path')).toBe(true)
      expect(isRelativeUrl('./path')).toBe(true)
      expect(isRelativeUrl('../path')).toBe(true)
    })

    it('应该返回false当是绝对URL', () => {
      expect(isRelativeUrl('https://example.com')).toBe(false)
    })

    it('应该返回false当URL为空', () => {
      expect(isRelativeUrl('')).toBe(false)
    })
  })

  describe('joinUrl', () => {
    it('应该连接URL路径', () => {
      expect(joinUrl('https://example.com', 'api', 'users')).toBe('https://example.com/api/users')
    })

    it('应该处理多余的斜杠', () => {
      expect(joinUrl('https://example.com/', '/api/', '/users/')).toBe('https://example.com/api/users')
    })
  })

  describe('normalizeUrl', () => {
    it('应该规范化URL', () => {
      expect(normalizeUrl('https://example.com//path')).toBe('https://example.com/path')
    })

    it('应该处理./路径', () => {
      expect(normalizeUrl('https://example.com/./path')).toBe('https://example.com/path')
    })

    it('应该处理../路径', () => {
      expect(normalizeUrl('https://example.com/a/b/../c')).toBe('https://example.com/a/c')
    })

    it('应该返回空字符串当URL为空', () => {
      expect(normalizeUrl('')).toBe('')
    })
  })

  describe('extractDomain', () => {
    it('应该提取域名', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('www.example.com')
    })

    it('应该返回null当URL无效', () => {
      expect(extractDomain('')).toBeNull()
    })
  })

  describe('extractPath', () => {
    it('应该提取路径', () => {
      expect(extractPath('https://example.com/api/users')).toBe('/api/users')
    })

    it('应该返回null当URL无效', () => {
      expect(extractPath('')).toBeNull()
    })
  })

  describe('extractFilename', () => {
    it('应该提取文件名', () => {
      expect(extractFilename('https://example.com/path/to/file.pdf')).toBe('file.pdf')
    })

    it('应该返回null当没有文件名', () => {
      expect(extractFilename('https://example.com/path/')).toBeNull()
    })
  })

  describe('extractExtension', () => {
    it('应该提取扩展名', () => {
      expect(extractExtension('https://example.com/file.PDF')).toBe('pdf')
    })

    it('应该返回null当没有扩展名', () => {
      expect(extractExtension('https://example.com/file')).toBeNull()
    })
  })

  describe('isValidUrl', () => {
    it('应该返回true当URL有效', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
    })

    it('应该返回false当URL无效', () => {
      expect(isValidUrl('invalid-url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('isHttpUrl', () => {
    it('应该返回true当是HTTP URL', () => {
      expect(isHttpUrl('http://example.com')).toBe(true)
      expect(isHttpUrl('https://example.com')).toBe(true)
    })

    it('应该返回false当不是HTTP URL', () => {
      expect(isHttpUrl('ftp://example.com')).toBe(false)
      expect(isHttpUrl('')).toBe(false)
    })
  })

  describe('isDataUrl', () => {
    it('应该返回true当是Data URL', () => {
      expect(isDataUrl('data:text/plain;base64,SGVsbG8=')).toBe(true)
    })

    it('应该返回false当不是Data URL', () => {
      expect(isDataUrl('https://example.com')).toBe(false)
    })
  })

  describe('isBlobUrl', () => {
    it('应该返回true当是Blob URL', () => {
      expect(isBlobUrl('blob:http://example.com/id')).toBe(true)
    })

    it('应该返回false当不是Blob URL', () => {
      expect(isBlobUrl('https://example.com')).toBe(false)
    })
  })

  describe('encodeParams', () => {
    it('应该编码参数', () => {
      const result = encodeParams({ a: 'hello world', b: 'test' })
      expect(result).toContain('a=hello%20world')
      expect(result).toContain('b=test')
    })

    it('应该忽略null和undefined', () => {
      const result = encodeParams({ a: 'test', b: null, c: undefined })
      expect(result).toBe('a=test')
    })
  })

  describe('decodeParams', () => {
    it('应该解码参数', () => {
      const result = decodeParams('a=hello%20world&b=test')
      expect(result.a).toBe('hello world')
      expect(result.b).toBe('test')
    })

    it('应该处理带?前缀的查询字符串', () => {
      const result = decodeParams('?a=1&b=2')
      expect(result.a).toBe('1')
      expect(result.b).toBe('2')
    })

    it('应该返回空对象当字符串为空', () => {
      expect(decodeParams('')).toEqual({})
    })
  })

  describe('useUrl', () => {
    it('应该返回所有URL函数', () => {
      const utils = useUrl()
      expect(typeof utils.parseUrl).toBe('function')
      expect(typeof utils.buildUrl).toBe('function')
      expect(typeof utils.getQueryParams).toBe('function')
      expect(typeof utils.isAbsoluteUrl).toBe('function')
    })
  })
})
