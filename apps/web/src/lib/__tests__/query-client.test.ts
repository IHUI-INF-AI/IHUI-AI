import { describe, it, expect } from 'vitest'
import { getQueryClient } from '../query-client'

describe('getQueryClient', () => {
  it('返回 QueryClient 实例', () => {
    const qc = getQueryClient()
    expect(qc).toBeDefined()
    expect(qc.getDefaultOptions()).toBeDefined()
  })

  it('默认 staleTime 为 60 秒', () => {
    const qc = getQueryClient()
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(60 * 1000)
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
