import { describe, it, expect } from 'vitest'
import { getQueryClient } from '../query-client'

describe('getQueryClient', () => {
  it('返回 QueryClient 实例', () => {
    const qc = getQueryClient()
    expect(qc).toBeDefined()
    expect(qc.getDefaultOptions()).toBeDefined()
  })

  // 2026-08-05 同步实现变更:staleTime 60s -> 5min(导航优化)
  it('默认 staleTime 为 5 分钟', () => {
    const qc = getQueryClient()
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000)
  })

  it('默认 refetchOnWindowFocus 为 false', () => {
    const qc = getQueryClient()
    expect(qc.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false)
  })

  it('默认 retry 为 1', () => {
    const qc = getQueryClient()
    expect(qc.getDefaultOptions().queries?.retry).toBe(1)
  })

  it('mutation 配置存在', () => {
    const qc = getQueryClient()
    expect(qc.getDefaultOptions().mutations).toBeDefined()
    expect(typeof qc.getDefaultOptions().mutations?.onError).toBe('function')
  })
})
