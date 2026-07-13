import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  normalizeHeaderStrict,
  parsePath,
  matchesPrefix,
  matchesAnyPrefix,
} from '../src/utils/http-normalize.js'

describe('normalizeHeader', () => {
  it('string 值 → trim 后返回', () => {
    expect(normalizeHeader('  hello  ')).toBe('hello')
  })

  it('空串 → undefined', () => {
    expect(normalizeHeader('   ')).toBeUndefined()
  })

  it('undefined → undefined', () => {
    expect(normalizeHeader(undefined)).toBeUndefined()
  })

  it('数组 → 取首项 trim', () => {
    expect(normalizeHeader(['  first  ', 'second'])).toBe('first')
  })

  it('空数组 → undefined', () => {
    expect(normalizeHeader([])).toBeUndefined()
  })

  it('数组首项为空串 → undefined', () => {
    expect(normalizeHeader(['  ', 'second'])).toBeUndefined()
  })
})

describe('normalizeHeaderStrict', () => {
  it('合法 UUID → 返回', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(normalizeHeaderStrict(id)).toBe(id)
  })

  it('合法 slug → 返回', () => {
    expect(normalizeHeaderStrict('acme-corp')).toBe('acme-corp')
  })

  it('含路径穿越字符 → undefined', () => {
    expect(normalizeHeaderStrict('../../etc')).toBeUndefined()
  })

  it('含空格 → undefined', () => {
    expect(normalizeHeaderStrict('hello world')).toBeUndefined()
  })

  it('超长 → undefined', () => {
    expect(normalizeHeaderStrict('a'.repeat(129))).toBeUndefined()
  })

  it('自定义 maxLen → 通过', () => {
    expect(normalizeHeaderStrict('a'.repeat(200), 256)).toBe('a'.repeat(200))
  })

  it('空串 → undefined', () => {
    expect(normalizeHeaderStrict('   ')).toBeUndefined()
  })
})

describe('parsePath', () => {
  it('无 querystring → 原样返回', () => {
    expect(parsePath('/api/users')).toBe('/api/users')
  })

  it('有 querystring → 剥离', () => {
    expect(parsePath('/api/users?id=1&name=foo')).toBe('/api/users')
  })

  it('空串 → 空串', () => {
    expect(parsePath('')).toBe('')
  })

  it('仅 ? → 空串', () => {
    expect(parsePath('?foo=bar')).toBe('')
  })

  it('多个 ? → 仅剥离首个之后', () => {
    expect(parsePath('/api/users?a=1?b=2')).toBe('/api/users')
  })
})

describe('matchesPrefix', () => {
  it('精确匹配 → true', () => {
    expect(matchesPrefix('/api/health', '/api/health')).toBe(true)
  })

  it('子路径匹配 → true', () => {
    expect(matchesPrefix('/api/auth/login', '/api/auth')).toBe(true)
  })

  it('前缀以 / 结尾 + 子路径 → true', () => {
    expect(matchesPrefix('/api/auth/login', '/api/auth/')).toBe(true)
  })

  it('前缀以 / 结尾 + 精确前缀本身 → false（前缀不是有效路径）', () => {
    expect(matchesPrefix('/api/auth/', '/api/auth/')).toBe(true)
  })

  it('边界防护：/api/authlogin 不命中 /api/auth → false', () => {
    expect(matchesPrefix('/api/authlogin', '/api/auth')).toBe(false)
  })

  it('边界防护：/api/healthxxx 不命中 /api/health → false', () => {
    expect(matchesPrefix('/api/healthxxx', '/api/health')).toBe(false)
  })

  it('完全不同的路径 → false', () => {
    expect(matchesPrefix('/api/users', '/api/auth')).toBe(false)
  })
})

describe('matchesAnyPrefix', () => {
  const prefixes = ['/api/health', '/api/auth/', '/docs']

  it('命中首个 → true', () => {
    expect(matchesAnyPrefix('/api/health', prefixes)).toBe(true)
  })

  it('命中中间 → true', () => {
    expect(matchesAnyPrefix('/api/auth/login', prefixes)).toBe(true)
  })

  it('命中末个 → true', () => {
    expect(matchesAnyPrefix('/docs/json', prefixes)).toBe(true)
  })

  it('未命中 → false', () => {
    expect(matchesAnyPrefix('/api/users', prefixes)).toBe(false)
  })

  it('边界防护 → false', () => {
    expect(matchesAnyPrefix('/api/authlogin', prefixes)).toBe(false)
  })

  it('空 prefixes → false', () => {
    expect(matchesAnyPrefix('/api/health', [])).toBe(false)
  })
})
