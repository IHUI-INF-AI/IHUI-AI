import { describe, it, expect, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

// Mock config:避免 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

// Mock db:避免真实 DB 连接
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

import { resolveTenantIdentifier } from '../src/plugins/tenant.js'

/** 构造最小 mock request，仅含 resolveTenantIdentifier 依赖的 headers + hostname。 */
function mockReq(opts: { header?: string; host?: string }): FastifyRequest {
  return {
    headers: opts.header !== undefined ? { 'x-tenant-id': opts.header } : {},
    hostname: opts.host ?? '',
  } as unknown as FastifyRequest
}

describe('resolveTenantIdentifier — X-Tenant-Id header 优先', () => {
  it('header UUID → 返回 UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(resolveTenantIdentifier(mockReq({ header: id, host: '127.0.0.1' }))).toBe(id)
  })

  it('header slug → 返回 slug', () => {
    expect(resolveTenantIdentifier(mockReq({ header: 'acme', host: '127.0.0.1' }))).toBe('acme')
  })

  it('header 空白字符串 → 走 host 分支', () => {
    expect(resolveTenantIdentifier(mockReq({ header: '   ', host: '127.0.0.1' }))).toBeNull()
  })

  it('header 缺失 → 走 host 分支', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '127.0.0.1' }))).toBeNull()
  })
})

describe('resolveTenantIdentifier — IP 地址不作为租户 slug（R12 回归防护）', () => {
  it('127.0.0.1 → null（修复前会被误解析为 slug "127"）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '127.0.0.1' }))).toBeNull()
  })

  it('192.168.1.1 → null', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '192.168.1.1' }))).toBeNull()
  })

  it('10.0.0.1 → null', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '10.0.0.1' }))).toBeNull()
  })

  it('8.8.8.8 → null', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '8.8.8.8' }))).toBeNull()
  })

  it('带端口的 IP 127.0.0.1:3000 → null', () => {
    expect(resolveTenantIdentifier(mockReq({ host: '127.0.0.1:3000' }))).toBeNull()
  })
})

describe('resolveTenantIdentifier — localhost / 短域名', () => {
  it('localhost → null（parts.length < 3）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'localhost' }))).toBeNull()
  })

  it('localhost:3000 → null', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'localhost:3000' }))).toBeNull()
  })

  it('example.com → null（parts.length < 3）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'example.com' }))).toBeNull()
  })
})

describe('resolveTenantIdentifier — 子域名解析', () => {
  it('foo.example.com → "foo"', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'foo.example.com' }))).toBe('foo')
  })

  it('acme.ihui.ai → "acme"', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'acme.ihui.ai' }))).toBe('acme')
  })

  it('带端口的子域名 foo.example.com:8080 → "foo"', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'foo.example.com:8080' }))).toBe('foo')
  })

  it('www.example.com → null（白名单）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'www.example.com' }))).toBeNull()
  })

  it('api.example.com → null（白名单）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'api.example.com' }))).toBeNull()
  })

  it('admin.example.com → null（白名单）', () => {
    expect(resolveTenantIdentifier(mockReq({ host: 'admin.example.com' }))).toBeNull()
  })
})

describe('resolveTenantIdentifier — header 优先级覆盖 host', () => {
  it('header + 子域名 host → header 优先', () => {
    expect(
      resolveTenantIdentifier(mockReq({ header: 'from-header', host: 'foo.example.com' })),
    ).toBe('from-header')
  })

  it('header + IP host → header 优先', () => {
    expect(resolveTenantIdentifier(mockReq({ header: 'from-header', host: '127.0.0.1' }))).toBe(
      'from-header',
    )
  })
})
