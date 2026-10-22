// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反代号池 · 出口代理池(2026-10-22 立):relay-proxy-pool 服务的轮换与失败计数。
// DB 走仓内 Proxy chainable mock 模式(夹具写法参考 tests/admin-missing-routes.test.ts),纯单测无网络。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSelectResult, mockWriteResult, sinks, rearmDbMockDefaults } = vi.hoisted(() => {
  type Armed = { mockResolvedValue(value: unknown): unknown; mockReset(): unknown }
  const rearmers: Array<() => void> = []
  function armed<F extends Armed>(fn: F, value: unknown): F {
    fn.mockResolvedValue(value)
    rearmers.push(() => {
      fn.mockReset()
      fn.mockResolvedValue(value)
    })
    return fn
  }
  const mockSelectResult = armed(vi.fn(), [])
  const mockWriteResult = armed(vi.fn(), [])
  const sinks = {
    insert: { value: undefined as unknown },
    update: { value: undefined as unknown },
    delete: { value: undefined as unknown },
  }
  return {
    mockSelectResult,
    mockWriteResult,
    sinks,
    rearmDbMockDefaults: () => {
      rearmers.forEach((rearm) => rearm())
      sinks.insert.value = undefined
      sinks.update.value = undefined
      sinks.delete.value = undefined
    },
  }
})

vi.mock('../src/db/index.js', () => {
  function selectChain(): unknown {
    return new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === 'then')
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            mockSelectResult().then(resolve, reject)
        return () => selectChain()
      },
    })
  }
  function writeChain(sink: { value: unknown }): unknown {
    const make = (): unknown =>
      new Proxy({} as Record<string, unknown>, {
        get(_t, prop) {
          if (typeof prop !== 'string') return undefined
          if (prop === 'then')
            return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              mockWriteResult().then(resolve, reject)
          if (prop === 'returning') return () => make()
          if (prop === 'values' || prop === 'set')
            return (v: unknown) => {
              sink.value = v
              return make()
            }
          return () => make()
        },
      })
    return make()
  }
  return {
    db: {
      select: () => selectChain(),
      insert: () => writeChain(sinks.insert),
      update: () => writeChain(sinks.update),
      delete: () => writeChain(sinks.delete),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: () => selectChain() },
    dbClient: {},
  }
})

import {
  pickProxyForAccount,
  reportProxyFailure,
  reportProxySuccess,
  markProxyChecked,
} from '../src/services/relay-proxy-pool.js'

describe('relay-proxy-pool', () => {
  beforeEach(() => {
    rearmDbMockDefaults()
  })

  describe('pickProxyForAccount', () => {
    it('账号自带 proxyUrl → 直接返回,不查池', async () => {
      const url = await pickProxyForAccount({
        id: 'acc-1',
        proxyUrl: 'http://user:pass@10.0.0.1:8080',
      })
      expect(url).toBe('http://user:pass@10.0.0.1:8080')
      expect(mockSelectResult).not.toHaveBeenCalled()
    })

    it('池内有 active 代理 → 返回并回写轮换游标 lastPickedAt', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: 'p1', proxyUrl: 'http://10.0.0.2:8080' }])
      const url = await pickProxyForAccount({ id: 'acc-1', proxyUrl: null })
      expect(url).toBe('http://10.0.0.2:8080')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.lastPickedAt).toBeInstanceOf(Date)
    })

    it('池空 → null(直连)', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      await expect(pickProxyForAccount({ id: 'acc-1', proxyUrl: null })).resolves.toBeNull()
      expect(sinks.update.value).toBeUndefined()
    })

    it('查询异常 → null(降级直连,永不抛)', async () => {
      mockSelectResult.mockRejectedValueOnce(new Error('db down'))
      await expect(pickProxyForAccount({ id: 'acc-1', proxyUrl: null })).resolves.toBeNull()
    })
  })

  describe('reportProxyFailure', () => {
    it('未达阈值:failCount+1,状态不变', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: 'p1', failCount: 1, status: 'active' }])
      await reportProxyFailure('http://10.0.0.2:8080')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.failCount).toBe(2)
      expect(set.status).toBe('active')
    })

    it('达阈值(5 次)→ 转 exhausted', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: 'p1', failCount: 4, status: 'active' }])
      await reportProxyFailure('http://10.0.0.2:8080')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.failCount).toBe(5)
      expect(set.status).toBe('exhausted')
    })

    it('池内无该代理 → 静默无写', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      await reportProxyFailure('http://unknown')
      expect(sinks.update.value).toBeUndefined()
    })

    it('查询异常被吞,永不抛', async () => {
      mockSelectResult.mockRejectedValueOnce(new Error('db down'))
      await expect(reportProxyFailure('http://x')).resolves.toBeUndefined()
    })
  })

  describe('reportProxySuccess', () => {
    it('清零 failCount,exhausted 位回升 active', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: 'p1', status: 'exhausted' }])
      await reportProxySuccess('http://10.0.0.2:8080')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.failCount).toBe(0)
      expect(set.status).toBe('active')
    })

    it('dead 位不被成功上报复活(仅 exhausted 回升)', async () => {
      mockSelectResult.mockResolvedValueOnce([{ id: 'p1', status: 'dead' }])
      await reportProxySuccess('http://10.0.0.2:8080')
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('dead')
    })
  })

  describe('markProxyChecked(活性检测接口,不强制外网探测)', () => {
    it('alive=true → active + 清零', async () => {
      await markProxyChecked('http://10.0.0.3:8080', true)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('active')
      expect(set.failCount).toBe(0)
      expect(set.lastCheckedAt).toBeInstanceOf(Date)
    })

    it('alive=false → dead', async () => {
      await markProxyChecked('http://10.0.0.3:8080', false)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('dead')
      expect(set.failCount).toBeUndefined()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
