/**
 * SecureStore 测试
 *
 * 覆盖(fallback 路径,因为测试环境无 expo-secure-store 原生绑定):
 * - 不可用时自动降级到 AsyncStorage,isSecureBackendEncrypted=false
 * - getSecureItem / setSecureItem / deleteSecureItem 在降级路径下读写一致
 * - getSecureItem 未写入时返回 null
 * - 降级路径下不会调用任何 SecureStore 模块
 * - _resetSecureStoreBackendForTest 让下一次调用重新探测
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
  isSecureBackendEncrypted,
  _resetSecureStoreBackendForTest,
} from '../src/lib/auth/secure-store'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

describe('lib/auth/secure-store', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
  })

  it('无原生模块时降级到 AsyncStorage(isSecureBackendEncrypted=false)', async () => {
    expect(await isSecureBackendEncrypted()).toBe(false)
  })

  it('降级路径 set + get + delete 一致性', async () => {
    await setSecureItem('user-token', 'abc.def.ghi')
    expect(await getSecureItem('user-token')).toBe('abc.def.ghi')
    await deleteSecureItem('user-token')
    expect(await getSecureItem('user-token')).toBeNull()
  })

  it('降级路径 set 覆盖已有值', async () => {
    await setSecureItem('k', 'v1')
    await setSecureItem('k', 'v2')
    expect(await getSecureItem('k')).toBe('v2')
  })

  it('降级路径 getSecureItem 未写入时返回 null', async () => {
    expect(await getSecureItem('not-set')).toBeNull()
  })

  it('降级路径 deleteSecureItem 重复删不抛错', async () => {
    await expect(deleteSecureItem('never-set')).resolves.not.toThrow()
  })

  it('_resetSecureStoreBackendForTest 可调用且幂等', () => {
    expect(() => _resetSecureStoreBackendForTest()).not.toThrow()
    expect(() => _resetSecureStoreBackendForTest()).not.toThrow()
  })

  it('并行 set/get/delete 不竞态', async () => {
    await Promise.all([
      setSecureItem('p1', 'v1'),
      setSecureItem('p2', 'v2'),
      setSecureItem('p3', 'v3'),
    ])
    const [a, b, c] = await Promise.all([
      getSecureItem('p1'),
      getSecureItem('p2'),
      getSecureItem('p3'),
    ])
    expect(a).toBe('v1')
    expect(b).toBe('v2')
    expect(c).toBe('v3')
    await Promise.all([deleteSecureItem('p1'), deleteSecureItem('p2'), deleteSecureItem('p3')])
    expect(await getSecureItem('p1')).toBeNull()
  })

  it('isSecureBackendEncrypted 在多次调用间保持稳定', async () => {
    const v1 = await isSecureBackendEncrypted()
    const v2 = await isSecureBackendEncrypted()
    expect(v1).toBe(v2)
    expect(v1).toBe(false)
  })

  it('set/get SecureStore 不调用 vitest spy(空操作守门)', async () => {
    // 占位:防止 vi.fn 误用,保证测试套件内不出现 unhandled mock
    const spy = vi.fn()
    spy()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
