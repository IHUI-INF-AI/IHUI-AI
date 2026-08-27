/**
 * tests/setup.ts
 *
 * vitest 每个测试文件运行前自动加载:
 * - 重置 AsyncStorage mock(Map + vi.fn 计数)
 * - vi.clearAllMocks 清理所有 vi.fn() spy
 * - RTL cleanup:globals 未开启时 RTL v16 不会自动注册 afterEach,
 *   必须显式清理渲染 DOM,否则多个用例的组件叠加在同一 document.body,
 *   导致 getByText 等查询命中多元素而失败(waitFor 超时)。
 */
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

beforeEach(() => {
  resetAsyncStorageMock()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
