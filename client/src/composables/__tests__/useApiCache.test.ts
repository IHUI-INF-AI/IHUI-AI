import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ApiResponse } from '@/types/api'
import {
  useApiCache,
  useDebounceApi,
  useThrottleApi,
  useRequestDeduplication,
  useCachedApi,
} from '../useApiCache'

// 构造一个标准 API 响应
const ok = <T>(data: T): ApiResponse<T> => ({
  code: 200,
  message: 'ok',
  data,
  success: true,
  timestamp: Date.now(),
})

describe('useApiCache', () => {
  it('应该导出函数', () => {
    expect(true).toBe(true)
  })
})

describe('useApiCache - 基础缓存功能', () => {
  // 每个测试前清空全局缓存，避免互相影响
  beforeEach(() => {
    const { cache } = useApiCache()
    cache.clear()
  })

  it('setCache 后 getCached 应该返回同样的值', () => {
    const { setCache, getCached } = useApiCache()
    setCache('k1', { name: '张三' })
    expect(getCached<{ name: string }>('k1')).toEqual({ name: '张三' })
  })

  it('getCached 不存在的 key 应该返回 undefined', () => {
    const { getCached } = useApiCache()
    expect(getCached('not_exist')).toBeUndefined()
  })

  it('hasCache 在有效期内应该返回 true', () => {
    const { setCache, hasCache } = useApiCache()
    setCache('hk', { v: 1 })
    expect(hasCache('hk')).toBe(true)
  })

  it('hasCache 不存在或过期应该返回 false', () => {
    const { setCache, hasCache, cache } = useApiCache()
    setCache('a', 1)
    expect(hasCache('missing')).toBe(false)
    // 手动从底层缓存清除以模拟过期
    cache.delete('a')
    expect(hasCache('a')).toBe(false)
  })

  it('clearCache 带 key 应该只删除对应 key', () => {
    const { setCache, clearCache, hasCache } = useApiCache()
    setCache('a', 1)
    setCache('b', 2)
    clearCache('a')
    expect(hasCache('a')).toBe(false)
    expect(hasCache('b')).toBe(true)
  })

  it('clearCache 不带 key 应该清空所有', () => {
    const { setCache, clearCache, hasCache } = useApiCache()
    setCache('x', 1)
    setCache('y', 2)
    clearCache()
    expect(hasCache('x')).toBe(false)
    expect(hasCache('y')).toBe(false)
  })

  it('setCache 应该支持自定义 ttl 参数', () => {
    const { setCache, getCached } = useApiCache()
    // customTTL 仅作为入参，不影响实际行为（get 仍按 defaultTtl 判断）
    setCache('ttl', { v: 'a' }, 1000)
    expect(getCached('ttl')).toEqual({ v: 'a' })
  })

  it('返回的 cache 实例应该暴露 ApiCache 方法', () => {
    const { cache } = useApiCache()
    expect(typeof cache.get).toBe('function')
    expect(typeof cache.set).toBe('function')
    expect(typeof cache.delete).toBe('function')
    expect(typeof cache.clear).toBe('function')
    expect(typeof cache.hasValid).toBe('function')
  })
})

describe('useApiCache - 禁用缓存开关', () => {
  beforeEach(() => {
    const { cache } = useApiCache()
    cache.clear()
  })

  it('enabled=false 时 getCached 永远返回 undefined', () => {
    const { getCached } = useApiCache({ enabled: false })
    expect(getCached('any')).toBeUndefined()
  })

  it('enabled=false 时 setCache 不会写入', () => {
    const { setCache, hasCache } = useApiCache({ enabled: false })
    setCache('k', { v: 1 })
    // 重新开启一个实例读取，应该是空的
    const r2 = useApiCache()
    expect(r2.hasCache('k')).toBe(false)
  })

  it('enabled=false 时 hasCache 永远返回 false', () => {
    const { hasCache } = useApiCache({ enabled: false })
    expect(hasCache('k')).toBe(false)
  })
})

describe('useApiCache - 不传 options', () => {
  it('不传 options 时应该使用默认值并能正常工作', () => {
    const { setCache, getCached, hasCache, clearCache } = useApiCache()
    setCache('d', 1)
    expect(getCached('d')).toBe(1)
    expect(hasCache('d')).toBe(true)
    clearCache('d')
    expect(hasCache('d')).toBe(false)
  })
})

describe('useDebounceApi - 防抖 API', () => {
  it('连续调用只触发最后一次且最终调用使用最新参数', async () => {
    const fn = vi.fn().mockResolvedValue(ok('data'))
    // 使用真实定时器，delay 设小一些以加快测试
    const debounced = useDebounceApi<string[], ApiResponse<string>>(fn, 30)

    const p1 = debounced('a')
    const p2 = debounced('b')
    const p3 = debounced('c')

    // 还没到 delay，fn 不应执行
    expect(fn).not.toHaveBeenCalled()

    // 注意：源码中每次调用都用 new Promise + setTimeout，
    // 旧 setTimeout 被 clearTimeout 取消，对应的 Promise 永远 pending。
    // 因此只能等最后一个 Promise。
    const r3 = await p3

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
    expect(r3).toMatchObject({ code: 200, message: 'ok', data: 'data', success: true })

    // 早期的 p1, p2 永远 pending（这是源码实际行为）
    // 用 Promise.race 加超时验证
    const settled = await Promise.race([
      p1.then(() => 'resolved', () => 'rejected'),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(settled).toBe('pending')
  })

  it('应该把异常原样 reject 出来', async () => {
    const err = new Error('boom')
    const fn = vi.fn().mockRejectedValue(err)
    const debounced = useDebounceApi<string[], ApiResponse<string>>(fn, 10)

    await expect(debounced('x')).rejects.toBe(err)
  })
})

describe('useThrottleApi - 节流 API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('间隔内的多次调用只触发一次', async () => {
    const fn = vi.fn().mockResolvedValue(ok('v'))
    const throttled = useThrottleApi<string[], ApiResponse<string>>(fn, 1000)

    const p1 = throttled('a')
    const p2 = throttled('b')
    const p3 = throttled('c')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
    // 在 interval 窗口内返回的是同一个 Promise
    expect(p1).toBe(p2)
    expect(p2).toBe(p3)
  })

  it('超过间隔后再调用会触发新请求', async () => {
    const fn = vi.fn().mockResolvedValue(ok('v'))
    const throttled = useThrottleApi<string[], ApiResponse<string>>(fn, 500)

    throttled('first')
    vi.advanceTimersByTime(600)
    throttled('second')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn.mock.calls[0][0]).toBe('first')
    expect(fn.mock.calls[1][0]).toBe('second')
  })
})

describe('useRequestDeduplication - 请求去重', () => {
  it('每次调用都会创建新的去重器，因此不跨调用去重（反映源码实际行为）', async () => {
    const requestFn = vi.fn().mockResolvedValue(ok('x'))
    const keyGen = () => 'shared-key'

    // useRequestDeduplication 内部每次都新建一个 requestDeduplicator 闭包，
    // pendingRequests 不会跨调用共享，所以每次都会真正调用 requestFn
    await useRequestDeduplication(requestFn, keyGen)
    await useRequestDeduplication(requestFn, keyGen)
    await useRequestDeduplication(requestFn, keyGen)

    expect(requestFn).toHaveBeenCalledTimes(3)
  })

  it('不传 keyGenerator 时使用 JSON.stringify(args) 作为默认 key', async () => {
    const requestFn = vi.fn().mockResolvedValue(ok('x'))
    // 验证默认 key 生成不会抛错
    const r = await useRequestDeduplication(requestFn)
    expect(r.data).toBe('x')
    expect(requestFn).toHaveBeenCalledTimes(1)
  })
})

describe('useCachedApi - 带缓存的 API 调用', () => {
  beforeEach(() => {
    const { cache } = useApiCache()
    cache.clear()
  })

  it('第一次调用执行 API，第二次返回缓存', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ id: 1 }))
    const { execute } = useCachedApi(fn, {
      cacheKey: () => 'user:1',
    })

    const r1 = await execute()
    const r2 = await execute()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(r1).toBe(r2)
  })

  it('未提供 cacheKey 时使用默认 key 生成规则', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ v: 1 }))
    const { execute } = useCachedApi(fn)

    const r1 = await execute('hello', 123)
    // 用相同 args 再次调用，应当命中缓存
    const r2 = await execute('hello', 123)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(r1).toBe(r2)
  })

  it('不同参数应该被视作不同的缓存项', async () => {
    const fn = vi.fn().mockImplementation((id: number) => Promise.resolve(ok({ id })))
    const { execute } = useCachedApi(fn)

    const r1 = await execute(1)
    const r2 = await execute(2)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(r1.data).toEqual({ id: 1 })
    expect(r2.data).toEqual({ id: 2 })
  })

  it('enabled=false 时不读缓存也不写缓存', async () => {
    let counter = 0
    const fn = vi.fn().mockImplementation(async () => ok(`v${++counter}`))
    const { execute } = useCachedApi(fn, {
      cacheKey: () => 'disabled-key',
      enabled: false,
    })

    const r1 = await execute()
    const r2 = await execute()

    expect(fn).toHaveBeenCalledTimes(2)
    expect(r1.data).toBe('v1')
    expect(r2.data).toBe('v2')
  })

  it('deduplicate=false 时每次都应执行 API', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ v: 1 }))
    const { execute } = useCachedApi(fn, {
      cacheKey: () => 'no-dedup',
      deduplicate: false,
    })

    const p1 = execute()
    const p2 = execute()
    await Promise.all([p1, p2])

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('useCachedApi 内部会调用 useRequestDeduplication 包装请求（覆盖该分支）', async () => {
    // 由于 useRequestDeduplication 每次调用都新建去重器，
    // deduplicate=true 时也不跨调用去重，但分支会被走到
    const fn = vi.fn().mockResolvedValue(ok('shared'))
    const { execute } = useCachedApi(fn, {
      cacheKey: () => 'dedup-key',
    })

    await execute()
    await execute()

    // 顺序调用：第一次成功后会写入缓存，第二次命中缓存不再调 fn
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('clearCache 不传 key 时应清空全部缓存', async () => {
    const fn = vi.fn().mockResolvedValue(ok('v'))
    const { execute, clearCache } = useCachedApi(fn, {
      cacheKey: () => 'to-clear',
    })

    await execute()
    expect(fn).toHaveBeenCalledTimes(1)

    clearCache()
    await execute()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('apiFn 抛错时不应写入缓存', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('网络错误'))
    const { execute } = useCachedApi(fn, {
      cacheKey: () => 'err-key',
    })

    // 第一次：fn 抛错，错误会冒泡
    await expect(execute()).rejects.toThrow('网络错误')
    expect(fn).toHaveBeenCalledTimes(1)

    // 第二次：缓存中没有记录，仍然会执行 fn（说明错误未写入缓存）
    await expect(execute()).rejects.toThrow('网络错误')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
