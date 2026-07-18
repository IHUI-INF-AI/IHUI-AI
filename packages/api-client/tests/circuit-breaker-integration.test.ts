import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchApi, setCircuitBreaker, getCircuitBreaker } from '../src/client.js'
import { CircuitBreaker, CircuitOpenError, serverPreset } from '../src/circuit-breaker.js'
import type { ApiResult } from '@ihui/types'

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: 0, message: 'ok', data }),
    text: async () => JSON.stringify({ code: 0, message: 'ok', data }),
    body: null,
  } as unknown as Response
}

function serverErrorResponse(message = 'server error', status = 500): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status, message, data: null }),
    text: async () => JSON.stringify({ code: status, message, data: null }),
    body: null,
  } as unknown as Response
}

function clientErrorResponse(message = 'bad request', status = 400): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status, message, data: null }),
    text: async () => JSON.stringify({ code: status, message, data: null }),
    body: null,
  } as unknown as Response
}

/**
 * 调用 fetchApi,把 CircuitOpenError 也归一化为 ApiResult(测试辅助)。
 */
async function callFetchApi<T>(url: string): Promise<ApiResult<T>> {
  try {
    return await fetchApi<T>(url)
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return { success: false, error: 'circuit-open', status: undefined }
    }
    throw err
  }
}

describe('fetchApi + CircuitBreaker integration', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    setCircuitBreaker(null)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    setCircuitBreaker(null)
    vi.useRealTimers()
  })

  it('未注入 breaker 时行为完全不变(success 路径)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    const r = await fetchApi<{ ok: boolean }>('/test')
    expect(r.success).toBe(true)
    expect((r as { data: { ok: boolean } }).data.ok).toBe(true)
  })

  it('未注入 breaker 时 4xx 返回 ApiResult 不抛错', async () => {
    fetchMock.mockResolvedValue(clientErrorResponse('bad', 400))
    const r = await fetchApi('/test')
    expect(r.success).toBe(false)
    expect(r.status).toBe(400)
  })

  it('注入 breaker + closed 状态正常返回数据', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: 1 }))
    const cb = new CircuitBreaker('test', serverPreset)
    setCircuitBreaker(cb)
    const r = await fetchApi<{ v: number }>('/test')
    expect(r.success).toBe(true)
    expect(cb.getState()).toBe('closed')
    expect(cb.getStats().successes).toBe(1)
  })

  it('5xx 错误计入 breaker 失败样本 — 触发熔断后抛 CircuitOpenError', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      minSamples: 10,
      windowSizeMs: 60_000,
      halfOpenTimeoutMs: 30_000,
    })
    setCircuitBreaker(cb)
    fetchMock.mockResolvedValue(serverErrorResponse('boom', 500))

    for (let i = 0; i < 10; i++) {
      const r = await fetchApi('/test')
      expect(r.success).toBe(false)
      expect(r.status).toBe(500)
    }
    expect(cb.getState()).toBe('open')

    fetchMock.mockClear()
    await expect(fetchApi('/test')).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('4xx 不计入 breaker 失败样本(业务错误不算服务不可用)', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
    })
    setCircuitBreaker(cb)
    fetchMock.mockResolvedValue(clientErrorResponse('bad', 400))
    for (let i = 0; i < 5; i++) {
      await fetchApi('/test')
    }
    expect(cb.getState()).toBe('closed')
    const stats = cb.getStats()
    // 4xx 不抛错 → breaker 视为成功样本
    expect(stats.total).toBe(5)
    expect(stats.failures).toBe(0)
    expect(stats.successes).toBe(5)
  })

  it('网络异常(无 status)计入失败样本 — 熔断后抛 CircuitOpenError', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
    })
    setCircuitBreaker(cb)
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'))

    // 头 2 次:breaker closed,返回 ApiResult
    const r1 = await callFetchApi('/test')
    const r2 = await callFetchApi('/test')
    expect(r1.success).toBe(false)
    expect(r1.status).toBeUndefined()
    expect(r2.success).toBe(false)
    expect(cb.getState()).toBe('open')

    // 第 3 次:breaker open,fetchApi 抛 CircuitOpenError
    await expect(fetchApi('/test')).rejects.toBeInstanceOf(CircuitOpenError)
  })

  it('half-open 阶段允许 1 个试探 — 成功后逐步恢复到 closed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      successThreshold: 3,
      halfOpenTimeoutMs: 30_000,
    })
    setCircuitBreaker(cb)
    fetchMock.mockResolvedValue(serverErrorResponse('boom', 500))

    // 头 2 次 5xx 失败
    await callFetchApi('/test')
    await callFetchApi('/test')
    expect(cb.getState()).toBe('open')

    // 第 3 次:open 状态,抛 CircuitOpenError
    await expect(fetchApi('/test')).rejects.toBeInstanceOf(CircuitOpenError)

    vi.advanceTimersByTime(30_000)
    expect(cb.getState()).toBe('half-open')

    fetchMock.mockResolvedValue(jsonResponse({ recovered: true }))
    const r1 = await fetchApi<{ recovered: boolean }>('/test')
    expect(r1.success).toBe(true)
    expect(cb.getState()).toBe('half-open')

    const r2 = await fetchApi<{ recovered: boolean }>('/test')
    expect(r2.success).toBe(true)
    const r3 = await fetchApi<{ recovered: boolean }>('/test')
    expect(r3.success).toBe(true)
    expect(cb.getState()).toBe('closed')
  })

  it('half-open 阶段试探失败 → 立即回到 open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      minSamples: 2,
      halfOpenTimeoutMs: 30_000,
    })
    setCircuitBreaker(cb)
    fetchMock.mockResolvedValue(serverErrorResponse('boom', 500))
    await callFetchApi('/test')
    await callFetchApi('/test')
    expect(cb.getState()).toBe('open')

    vi.advanceTimersByTime(30_000)
    expect(cb.getState()).toBe('half-open')

    const r = await callFetchApi('/test')
    expect(r.success).toBe(false)
    expect(cb.getState()).toBe('open')
    await expect(fetchApi('/test')).rejects.toBeInstanceOf(CircuitOpenError)
  })

  it('getCircuitBreaker 返回当前注入的实例', () => {
    const cb = new CircuitBreaker('test')
    setCircuitBreaker(cb)
    expect(getCircuitBreaker()).toBe(cb)
    setCircuitBreaker(null)
    expect(getCircuitBreaker()).toBeNull()
  })

  it('熔断触发后,在 open 之前的所有 5xx 调用都通过 ApiResult 返回(不抛错)', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      minSamples: 10,
    })
    setCircuitBreaker(cb)
    fetchMock.mockResolvedValue(serverErrorResponse('boom', 500))
    const results: ApiResult<unknown>[] = []
    for (let i = 0; i < 10; i++) {
      results.push(await fetchApi('/test'))
    }
    expect(cb.getState()).toBe('open')
    for (const r of results) {
      expect(r.success).toBe(false)
      expect(r.status).toBe(500)
    }
  })
})
