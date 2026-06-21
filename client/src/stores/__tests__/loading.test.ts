import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoadingStore } from '../loading'

describe('loading store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态 globalLoading=false', () => {
    const store = useLoadingStore()
    expect(store.globalLoading).toBe(false)
    expect(store.isLoading).toBe(false)
  })

  it('startGlobalLoading / stopGlobalLoading', () => {
    const store = useLoadingStore()
    store.startGlobalLoading('加载中...')
    expect(store.globalLoading).toBe(true)
    expect(store.globalLoadingText).toBe('加载中...')
    expect(store.isLoading).toBe(true)
    store.stopGlobalLoading()
    expect(store.globalLoading).toBe(false)
  })

  it('setGlobalLoading 设置状态和文本', () => {
    const store = useLoadingStore()
    store.setGlobalLoading(true, '稍候')
    expect(store.globalLoadingText).toBe('稍候')
    store.setGlobalLoading(false)
    expect(store.globalLoading).toBe(false)
  })

  it('startLocalLoading / stopLocalLoading / isLocalLoading / getLocalLoadingText', () => {
    const store = useLoadingStore()
    store.startLocalLoading('k1', '子加载')
    expect(store.isLocalLoading('k1')).toBe(true)
    expect(store.getLocalLoadingText('k1')).toBe('子加载')
    expect(store.isLoading).toBe(true)
    store.stopLocalLoading('k1')
    expect(store.isLocalLoading('k1')).toBe(false)
  })

  it('stopLocalLoading 不传 text 时保留原文本', () => {
    const store = useLoadingStore()
    store.startLocalLoading('k2', '保持')
    store.stopLocalLoading('k2')
    expect(store.getLocalLoadingText('k2')).toBe('保持')
  })

  it('setLocalLoading(false) 不传 text 时清空文本', () => {
    const store = useLoadingStore()
    store.setLocalLoading('k3', true, 'some')
    store.setLocalLoading('k3', false)
    expect(store.isLocalLoading('k3')).toBe(false)
  })

  it('isLoading 综合判断', () => {
    const store = useLoadingStore()
    store.startLocalLoading('a')
    store.startLocalLoading('b')
    expect(store.isLoading).toBe(true)
    store.stopLocalLoading('a')
    store.stopLocalLoading('b')
    expect(store.isLoading).toBe(false)
  })

  it('clearAllLoading 清空所有状态', () => {
    const store = useLoadingStore()
    store.startGlobalLoading('全局')
    store.startLocalLoading('x', '子')
    store.clearAllLoading()
    expect(store.globalLoading).toBe(false)
    expect(store.isLocalLoading('x')).toBe(false)
  })

  it('setBatchLocalLoading 批量设置', () => {
    const store = useLoadingStore()
    store.setBatchLocalLoading(['a', 'b', 'c'], true, '批量')
    expect(store.isLocalLoading('a')).toBe(true)
    expect(store.isLocalLoading('b')).toBe(true)
    expect(store.isLocalLoading('c')).toBe(true)
    expect(store.getLocalLoadingText('b')).toBe('批量')
    store.setBatchLocalLoading(['a', 'b'], false)
    expect(store.isLocalLoading('a')).toBe(false)
    expect(store.isLocalLoading('c')).toBe(true)
  })

  it('isLocalLoading 未注册 key 返回 false', () => {
    const store = useLoadingStore()
    expect(store.isLocalLoading('never')).toBe(false)
  })
})
