import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { decodeUserFromToken, isAdmin, getRedirectPath } from '../auth-utils'

/** 构造 JWT token(不验签,仅测 payload 解析) */
function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '')
  return `${header}.${body}.sig`
}

/** 构造 NextRequest mock */
function mockRequest(redirect: string | null) {
  return {
    nextUrl: {
      searchParams: {
        get: (key: string) => (key === 'redirect' ? redirect : null),
      },
    },
  } as unknown as NextRequest
}

describe('decodeUserFromToken', () => {
  it('有效token解析出userId和roleId', () => {
    const token = makeJwt({ userId: 'u123', roleId: 2, exp: 9999999999 })
    const user = decodeUserFromToken(token)
    expect(user).not.toBeNull()
    expect(user!.userId).toBe('u123')
    expect(user!.roleId).toBe(2)
  })

  it('无效token(非3段)返回null', () => {
    expect(decodeUserFromToken('invalid')).toBeNull()
    expect(decodeUserFromToken('a.b')).toBeNull()
  })

  it('无效payload(非JSON)返回null', () => {
    const token = `${btoa('{}').replace(/=/g, '')}.${btoa('not-json').replace(/=/g, '')}.sig`
    expect(decodeUserFromToken(token)).toBeNull()
  })

  it('空token返回null', () => {
    expect(decodeUserFromToken('')).toBeNull()
  })
})

describe('isAdmin', () => {
  it('roleId>=1返回true', () => {
    expect(isAdmin({ roleId: 1 })).toBe(true)
    expect(isAdmin({ roleId: 5 })).toBe(true)
  })

  it('roleId=0或未定义返回false', () => {
    expect(isAdmin({ roleId: 0 })).toBe(false)
    expect(isAdmin({})).toBe(false)
  })

  it('role为admin/administrator返回true(大小写不敏感)', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true)
    expect(isAdmin({ role: 'Administrator' })).toBe(true)
    expect(isAdmin({ role: 'ADMIN' })).toBe(true)
  })

  it('role为普通用户返回false', () => {
    expect(isAdmin({ role: 'user' })).toBe(false)
  })

  it('null用户返回false', () => {
    expect(isAdmin(null)).toBe(false)
  })
})

describe('getRedirectPath', () => {
  it('站内相对路径直接返回', () => {
    expect(getRedirectPath(mockRequest('/dashboard'))).toBe('/dashboard')
    expect(getRedirectPath(mockRequest('/a/b/c'))).toBe('/a/b/c')
  })

  it('无redirect参数返回首页', () => {
    expect(getRedirectPath(mockRequest(null))).toBe('/')
  })

  it('协议相对URL(//)被拦截,防止开放重定向', () => {
    expect(getRedirectPath(mockRequest('//evil.com'))).toBe('/')
    expect(getRedirectPath(mockRequest('//evil.com/path'))).toBe('/')
  })

  it('绝对URL被拦截(不以/开头)', () => {
    expect(getRedirectPath(mockRequest('https://evil.com'))).toBe('/')
    expect(getRedirectPath(mockRequest('http://evil.com'))).toBe('/')
  })
})
