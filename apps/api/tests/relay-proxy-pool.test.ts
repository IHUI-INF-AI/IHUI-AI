// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 反代号池 · 出口代理池(2026-10-22 立):relay-proxy-pool 服务的轮换与失败计数。
// DB 走仓内 Proxy chainable mock 模式(夹具写法参考 tests/admin-missing-routes.test.ts),纯单测无网络。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSelectResult, mockWriteResult, mockExecuteResult, sinks, rearmDbMockDefaults } =
  vi.hoisted(() => {
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
    const mockExecuteResult = armed(vi.fn(), [])
    const sinks = {
      insert: { value: undefined as unknown },
      update: { value: undefined as unknown },
      delete: { value: undefined as unknown },
    }
    return {
      mockSelectResult,
      mockWriteResult,
      mockExecuteResult,
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
      execute: (..._args: unknown[]) => mockExecuteResult(),
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
  listProxies,
  createProxy,
  updateProxy,
  deleteProxy,
  getProxyById,
  encryptAccountProxyUrl,
  resolveAccountProxyUrl,
  maskAccountProxyUrl,
} from '../src/services/relay-proxy-pool.js'

describe('relay-proxy-pool', () => {
  beforeEach(() => {
    rearmDbMockDefaults()
  })

  describe('pickProxyForAccount', () => {
    it('账号自带 proxyUrl → 直接返回,不查池/不发 SQL', async () => {
      const url = await pickProxyForAccount({
        id: 'acc-1',
        proxyUrl: 'http://user:pass@10.0.0.1:8080',
      })
      expect(url).toBe('http://user:pass@10.0.0.1:8080')
      expect(mockSelectResult).not.toHaveBeenCalled()
      expect(mockExecuteResult).not.toHaveBeenCalled()
    })

    it('池内有 active 代理 → 单条 UPDATE 原子取用并返回 proxy_url', async () => {
      mockExecuteResult.mockResolvedValueOnce([{ proxy_url: 'http://10.0.0.2:8080' }])
      const url = await pickProxyForAccount({ id: 'acc-1', proxyUrl: null })
      expect(url).toBe('http://10.0.0.2:8080')
      expect(mockExecuteResult).toHaveBeenCalledTimes(1)
      // 原子语句自带 SET/WHERE,不再有独立的 UPDATE 回写
      expect(mockWriteResult).not.toHaveBeenCalled()
      expect(sinks.update.value).toBeUndefined()
    })

    it('池空(UPDATE 0 行)→ null(直连)', async () => {
      mockExecuteResult.mockResolvedValueOnce([])
      await expect(pickProxyForAccount({ id: 'acc-1', proxyUrl: null })).resolves.toBeNull()
    })

    it('查询异常 → null(降级直连,永不抛)', async () => {
      mockExecuteResult.mockRejectedValueOnce(new Error('db down'))
      await expect(pickProxyForAccount({ id: 'acc-1', proxyUrl: null })).resolves.toBeNull()
    })
  })

  describe('账号级 proxyUrl 加密存储', () => {
    it('encrypt → resolve 往返一致,落库值不是明文', () => {
      const plain = 'http://user:pass@10.0.0.1:8080'
      const stored = encryptAccountProxyUrl(plain)
      expect(stored).not.toBeNull()
      expect(stored).not.toContain(plain)
      expect(stored).not.toContain('10.0.0.1')
      expect(resolveAccountProxyUrl(stored)).toBe(plain)
    })

    it('空值 → null;存量明文直通(升级期兼容)', () => {
      expect(encryptAccountProxyUrl('')).toBeNull()
      expect(encryptAccountProxyUrl(null)).toBeNull()
      expect(resolveAccountProxyUrl(null)).toBeNull()
      expect(resolveAccountProxyUrl('http://10.0.0.9:3128')).toBe('http://10.0.0.9:3128')
    })

    it('密文损坏 → resolve 按直连(null),绝不回吐密文本体', () => {
      const broken = JSON.stringify({ iv: 'AAAA', ciphertext: 'BBBB', tag: 'CCCC' })
      expect(resolveAccountProxyUrl(broken)).toBeNull()
    })

    it('脱敏只留协议+主机:账密打码,路径/查询串不出现', () => {
      const stored = encryptAccountProxyUrl('http://user:pass@10.0.0.1:8080/path?k=v')
      expect(maskAccountProxyUrl(stored)).toBe('http://***@10.0.0.1:8080')
      expect(maskAccountProxyUrl(encryptAccountProxyUrl('http://10.0.0.2:3128'))).toBe(
        'http://10.0.0.2:3128',
      )
      expect(maskAccountProxyUrl(null)).toBeNull()
    })

    it('pickProxyForAccount 对加密的账号级代理先解密再返回', async () => {
      const stored = encryptAccountProxyUrl('http://user:pass@10.0.0.1:8080')
      await expect(pickProxyForAccount({ id: 'acc-1', proxyUrl: stored })).resolves.toBe(
        'http://user:pass@10.0.0.1:8080',
      )
      expect(mockExecuteResult).not.toHaveBeenCalled()
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

  // 2026-10-22 补:此前代理池无写入入口,管理面 CRUD 服务需可判别结果
  describe('管理面 CRUD', () => {
    const proxyRow = {
      id: '00000000-0000-4000-8000-0000000000p1',
      proxyUrl: 'http://user:pass@10.0.0.9:8080',
      providerCode: 'trae',
      status: 'active',
      failCount: 0,
      lastCheckedAt: null,
      boundAccountId: null,
      lastPickedAt: null,
      createdAt: new Date('2026-10-22T00:00:00Z'),
      updatedAt: new Date('2026-10-22T00:00:00Z'),
    }

    it('listProxies 返回 list + total,proxyUrl 原样(不脱敏)', async () => {
      mockSelectResult.mockResolvedValueOnce([proxyRow]).mockResolvedValueOnce([{ c: 1 }])
      const r = await listProxies({ page: 1, pageSize: 20, status: 'active' })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.total).toBe(1)
      expect(r.list[0]?.proxyUrl).toBe('http://user:pass@10.0.0.9:8080')
    })

    it('createProxy 正常插入', async () => {
      mockWriteResult.mockResolvedValueOnce([proxyRow])
      const r = await createProxy({
        proxyUrl: proxyRow.proxyUrl,
        providerCode: 'trae',
      })
      expect(r.ok).toBe(true)
      expect((sinks.insert.value as Record<string, unknown>).proxyUrl).toBe(proxyRow.proxyUrl)
      expect((sinks.insert.value as Record<string, unknown>).boundAccountId).toBeNull()
    })

    it('createProxy 唯一冲突(23505)→ reason=duplicate(路由映射 409)', async () => {
      mockWriteResult.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }))
      const r = await createProxy({ proxyUrl: proxyRow.proxyUrl })
      expect(r).toEqual({ ok: false, reason: 'duplicate' })
    })

    it('createProxy 其他异常 → reason=error,不抛', async () => {
      mockWriteResult.mockRejectedValueOnce(new Error('db down'))
      await expect(createProxy({ proxyUrl: proxyRow.proxyUrl })).resolves.toEqual({
        ok: false,
        reason: 'error',
      })
    })

    it('updateProxy 命中行 → 只写变化字段并回写 updatedAt', async () => {
      // 2026-10-23:updateProxy 先按 id 预读现行,再只把与现值不同的字段进 UPDATE
      mockSelectResult.mockResolvedValueOnce([proxyRow])
      mockWriteResult.mockResolvedValueOnce([{ ...proxyRow, status: 'dead' }])
      const r = await updateProxy(proxyRow.id, { status: 'dead' })
      expect(r.ok).toBe(true)
      const set = sinks.update.value as Record<string, unknown>
      expect(set.status).toBe('dead')
      expect(set.updatedAt).toBeInstanceOf(Date)
    })

    it('updateProxy 预读未命中 → not_found,且不发 UPDATE', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      await expect(updateProxy(proxyRow.id, { status: 'active' })).resolves.toEqual({
        ok: false,
        reason: 'not_found',
      })
      expect(sinks.update.value).toBeUndefined()
    })

    it('updateProxy patch 与现值全同 → 原行返回,不发 UPDATE(空写回潮锁)', async () => {
      mockSelectResult.mockResolvedValueOnce([proxyRow])
      const r = await updateProxy(proxyRow.id, { status: 'active' })
      expect(r).toEqual({ ok: true, row: proxyRow })
      expect(sinks.update.value).toBeUndefined()
    })

    it('deleteProxy 0 行 → deleted=false', async () => {
      mockWriteResult.mockResolvedValueOnce([])
      await expect(deleteProxy(proxyRow.id)).resolves.toEqual({ ok: true, deleted: false })
    })

    it('getProxyById 未命中 → not_found', async () => {
      mockSelectResult.mockResolvedValueOnce([])
      await expect(getProxyById(proxyRow.id)).resolves.toEqual({
        ok: false,
        reason: 'not_found',
      })
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
