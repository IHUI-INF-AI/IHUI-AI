// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { IntegrationManager, getIntegrationManager } from '../src/services/clawdbot/integrations.js'
import type { IntegrationConfig } from '../src/services/clawdbot/integrations.js'

const mockIntegration = (
  id: string,
  overrides: Partial<IntegrationConfig> = {},
): IntegrationConfig => ({
  id,
  name: `Integration ${id}`,
  type: 'api',
  baseUrl: 'https://api.example.com',
  enabled: true,
  config: {},
  ...overrides,
})

const mockResponse = (data: unknown, status = 200) => {
  const headers = new Map([['content-type', 'application/json']])
  return {
    status,
    json: async () => data,
    headers: {
      forEach: (cb: (value: string, key: string) => void) => headers.forEach((v, k) => cb(v, k)),
    },
  }
}

describe('clawdbot IntegrationManager 集成服务', () => {
  let mgr: IntegrationManager
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  beforeEach(() => {
    mgr = new IntegrationManager()
    fetchSpy.mockReset()
  })

  afterEach(() => {
    fetchSpy.mockReset()
  })

  describe('register / unregister', () => {
    it('register 注册集成', () => {
      mgr.register(mockIntegration('i1'))
      expect(mgr.get('i1')).toBeDefined()
    })

    it('register 触发 registered 事件', () => {
      const handler = vi.fn()
      mgr.on('registered', handler)
      mgr.register(mockIntegration('i1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('unregister 删除集成返回 true', () => {
      mgr.register(mockIntegration('i1'))
      expect(mgr.unregister('i1')).toBe(true)
      expect(mgr.get('i1')).toBeUndefined()
    })

    it('unregister 不存在返回 false', () => {
      expect(mgr.unregister('not_exist')).toBe(false)
    })
  })

  describe('list / listEnabled', () => {
    it('list 返回全部', () => {
      mgr.register(mockIntegration('i1'))
      mgr.register(mockIntegration('i2', { enabled: false }))
      expect(mgr.list()).toHaveLength(2)
    })

    it('listEnabled 只返回 enabled', () => {
      mgr.register(mockIntegration('i1'))
      mgr.register(mockIntegration('i2', { enabled: false }))
      expect(mgr.listEnabled()).toHaveLength(1)
      expect(mgr.listEnabled()[0]!.id).toBe('i1')
    })
  })

  describe('call 调用', () => {
    it('集成不存在抛错', async () => {
      await expect(
        mgr.call({ integrationId: 'not_exist', method: 'GET', path: '/x' }),
      ).rejects.toThrow('not found or disabled')
    })

    it('集成禁用抛错', async () => {
      mgr.register(mockIntegration('i1', { enabled: false }))
      await expect(mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })).rejects.toThrow(
        'disabled',
      )
    })

    it('成功调用返回响应', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      const r = await mgr.call({ integrationId: 'i1', method: 'GET', path: '/users' })
      expect(r.status).toBe(200)
      expect(r.data).toEqual({ ok: true })
      expect(r.duration).toBeGreaterThanOrEqual(0)
    })

    it('POST 请求传递 body', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'POST', path: '/users', body: { name: 'a' } })
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'a' }) }),
      )
    })

    it('query 参数拼接到 URL', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/users', query: { limit: '10' } })
      const url = (fetchSpy.mock.calls[0]![0] as string).toString()
      expect(url).toContain('?limit=10')
    })

    it('无 baseUrl 时直接使用 path 作为 URL', async () => {
      mgr.register(mockIntegration('i1', { baseUrl: undefined }))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: 'https://other.com/x' })
      expect(fetchSpy.mock.calls[0]![0]).toBe('https://other.com/x')
    })

    it('触发 called 事件', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      const handler = vi.fn()
      mgr.on('called', handler)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('authType=api_key 设置 X-API-Key 头', async () => {
      mgr.register(mockIntegration('i1', { authType: 'api_key', apiKey: 'secret' }))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })
      const opts = fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }
      expect(opts.headers['X-API-Key']).toBe('secret')
    })

    it('authType=bearer 设置 Authorization 头', async () => {
      mgr.register(mockIntegration('i1', { authType: 'bearer', apiKey: 'token' }))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })
      const opts = fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }
      expect(opts.headers.Authorization).toBe('Bearer token')
    })

    it('authType=basic 设置 Basic 头', async () => {
      mgr.register(mockIntegration('i1', { authType: 'basic', apiKey: 'user:pass' }))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })
      const opts = fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }
      expect(opts.headers.Authorization).toContain('Basic ')
    })

    it('自定义 headers 合并到请求头', async () => {
      mgr.register(mockIntegration('i1', { headers: { 'X-Custom': '1' } }))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x', headers: { 'X-Req': '2' } })
      const opts = fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }
      expect(opts.headers['X-Custom']).toBe('1')
      expect(opts.headers['X-Req']).toBe('2')
      expect(opts.headers['Content-Type']).toBe('application/json')
    })

    it('响应非 JSON 时 data 为 null', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce({
        status: 200,
        json: async () => {
          throw new Error('invalid')
        },
        headers: { forEach: () => {} },
      } as never)
      const r = await mgr.call({ integrationId: 'i1', method: 'GET', path: '/x' })
      expect(r.data).toBeNull()
    })
  })

  describe('SDB-19 path 不得改写已登记主机(SSRF/凭据外带)', () => {
    // 每条断言都先由 node 实测解析行为:`new URL('/\\\\attacker.example/x','https://api.example.com')`
    // → host=attacker.example;`/%5Cattacker` 在 URL 层同源,但解码后是反斜杠形态。
    const rejected = async (path: string) => {
      mgr.register(mockIntegration('i1', { authType: 'api_key', apiKey: 'secret' }))
      await expect(mgr.call({ integrationId: 'i1', method: 'GET', path })).rejects.toThrow(
        'Integration path',
      )
      // 拒绝必须发生在发请求之前:凭据一次都不能寄出
      expect(fetchSpy).not.toHaveBeenCalled()
    }

    it('拒绝 /\\attacker.example/x(反斜杠被 URL 当斜杠)', async () => {
      await rejected('/\\attacker.example/x')
    })

    it('拒绝 \\attacker.example/x', async () => {
      await rejected('\\attacker.example/x')
    })

    it('拒绝 /%5Cattacker.example/x(编码反斜杠)', async () => {
      await rejected('/%5Cattacker.example/x')
      await rejected('/%5cattacker.example/x')
    })

    it('拒绝 //attacker.example/x(原黑名单不回退)', async () => {
      await rejected('//attacker.example/x')
    })

    it('拒绝解码失败的路径(fail-closed)', async () => {
      await rejected('/100%')
    })

    it('正常相对路径通过且 origin 不变', async () => {
      mgr.register(mockIntegration('i1'))
      fetchSpy.mockResolvedValueOnce(mockResponse({ ok: true }) as never)
      await mgr.call({ integrationId: 'i1', method: 'GET', path: '/v1/foo?x=1' })
      const called = new URL(fetchSpy.mock.calls[0]![0] as string)
      expect(called.origin).toBe('https://api.example.com')
      expect(called.pathname).toBe('/v1/foo')
    })

    it('绝对 URL 一律被拒(含同源绝对 URL,现有契约只收相对片段)', async () => {
      await rejected('https://api.example.com/v1/foo')
      await rejected('https://evil.example/x')
      await rejected('http://api.example.com/v1/foo')
    })

    it('同源兜底:控制字符被 URL 剥离后指向别的主机也会被拦', async () => {
      mgr.register(mockIntegration('i1', { authType: 'api_key', apiKey: 'secret' }))
      // 实测 `new URL('/\t/attacker.example/x', base)` 剥离制表符后是 `//attacker.example/x`
      // ⇒ 主机被改写;字符黑名单看不到(`startsWith('//')` 为 false),只有 origin 兜底能拦。
      await expect(
        mgr.call({ integrationId: 'i1', method: 'GET', path: '/\t/attacker.example/x' }),
      ).rejects.toThrow('已登记主机之外')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('返回 total/enabled', () => {
      mgr.register(mockIntegration('i1'))
      mgr.register(mockIntegration('i2', { enabled: false }))
      const s = mgr.getStats()
      expect(s.total).toBe(2)
      expect(s.enabled).toBe(1)
    })
  })

  describe('单例', () => {
    it('getIntegrationManager 返回同一实例', () => {
      expect(getIntegrationManager()).toBe(getIntegrationManager())
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
