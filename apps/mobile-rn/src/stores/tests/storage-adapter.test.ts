/**
 * apps/mobile-rn/src/stores/storage-adapter runtime 集成测试
 *
 * 覆盖 createAsyncStorageTransport 工厂的 5 大类 10 个场景:
 * 1. 基础读写(set/get/remove 的 async/await 契约)
 * 2. 边界值(空串/Unicode/JSON 字符串)
 * 3. mock AsyncStorage 行为(mock 收到正确参数 + Promise 异步返回)
 * 4. 与 zustand persist 集成(setState 持久化 + 模拟新 store hydrate 恢复)
 * 5. Promise rejection 处理(mock 抛错时 transport 透传)
 *
 * 依赖:
 * - vitest.config.ts 已将 @react-native-async-storage/async-storage alias 到 tests/__mocks__/async-storage.ts
 * - tests/setup.ts 提供 resetAsyncStorageMock + vi.clearAllMocks 自动清理
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createAsyncStorageTransport } from '../storage-adapter'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { resetAsyncStorageMock } from '../../../tests/__mocks__/async-storage'

/** 测试用 zustand 状态:数字 + 字符串 + setter */
interface CounterState {
  count: number
  name: string
  increment: () => void
  setName: (name: string) => void
}

/** 通用 store 工厂:隔离每个测试实例,避免 persist 状态相互污染 */
function createCounterStore(persistName: string) {
  return create<CounterState>()(
    persist(
      (set) => ({
        count: 0,
        name: '',
        increment: () => set((s) => ({ count: s.count + 1 })),
        setName: (name) => set({ name }),
      }),
      {
        name: persistName,
        storage: createJSONStorage(() => createAsyncStorageTransport()),
      },
    ),
  )
}

/** 等待 zustand persist 异步 flush(microtask + persist 内部 setTimeout) */
const flushPersist = (): Promise<void> => new Promise((r) => setTimeout(r, 50))

describe('createAsyncStorageTransport', () => {
  beforeEach(() => {
    // setup.ts 已 beforeEach(resetAsyncStorageMock) + afterEach(vi.clearAllMocks)
    // 这里显式再 reset 一次,作为 standalone 运行的兜底(直接 vitest 跑该文件时 setup 也会加载)
    resetAsyncStorageMock()
    vi.clearAllMocks()
  })

  // ============ 1. 基础读写 ============
  describe('基础读写', () => {
    it('setItem 后 getItem 返回原值(async/await)', async () => {
      const transport = createAsyncStorageTransport()
      await transport.setItem('foo', 'bar')
      const value = await transport.getItem('foo')
      expect(value).toBe('bar')
    })

    it('getItem 不存在的 key 返回 null', async () => {
      const transport = createAsyncStorageTransport()
      const value = await transport.getItem('nonexistent-key')
      expect(value).toBeNull()
    })

    it('removeItem 后 getItem 返回 null', async () => {
      const transport = createAsyncStorageTransport()
      await transport.setItem('foo', 'bar')
      await transport.removeItem('foo')
      const value = await transport.getItem('foo')
      expect(value).toBeNull()
    })
  })

  // ============ 2. 边界值 ============
  describe('边界值', () => {
    it('空字符串值正确存取', async () => {
      const transport = createAsyncStorageTransport()
      await transport.setItem('empty', '')
      const value = await transport.getItem('empty')
      expect(value).toBe('')
      // 显式验证 key 已存在(空串 != null,不能被误判为不存在)
      expect(value).not.toBeNull()
    })

    it('中文/Unicode 值正确存取(包含 CJK + emoji + 重音字符)', async () => {
      const transport = createAsyncStorageTransport()
      const unicode = '你好世界 🌍 émojis ✨ 漢字 가나다 '
      await transport.setItem('unicode', unicode)
      const value = await transport.getItem('unicode')
      expect(value).toBe(unicode)
    })

    it('JSON 字符串正确存取(透传,不做解析)', async () => {
      const transport = createAsyncStorageTransport()
      const payload = { id: 1, name: 'Test', tags: ['a', 'b', '中'], nested: { ok: true } }
      const json = JSON.stringify(payload)
      await transport.setItem('json', json)
      const raw = await transport.getItem('json')
      expect(raw).toBe(json)
      // 验证 transport 不做解析,调用方拿到的就是原始 JSON 字符串
      expect(JSON.parse(raw as string)).toEqual(payload)
    })
  })

  // ============ 3. mock AsyncStorage 行为 ============
  describe('mock AsyncStorage 行为', () => {
    it('setItem 时 mock 后端正确收到 key/value(参数透传)', async () => {
      const transport = createAsyncStorageTransport()
      await transport.setItem('mock-key', 'mock-value')
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('mock-key', 'mock-value')
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1)
    })

    it('getItem / removeItem 时 mock 收到正确 key', async () => {
      const transport = createAsyncStorageTransport()
      await transport.setItem('k', 'v')
      await transport.getItem('k')
      await transport.removeItem('k')
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('k')
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('k')
    })

    it('getItem 返回 Promise(异步契约正确),await 后拿到 mock 返回值', async () => {
      const transport = createAsyncStorageTransport()
      // setItem 返回 Promise
      const setResult = transport.setItem('async-key', 'async-value')
      expect(setResult).toBeInstanceOf(Promise)
      await setResult

      // getItem 返回 Promise
      const getResult = transport.getItem('async-key')
      expect(getResult).toBeInstanceOf(Promise)
      const value = await getResult
      expect(value).toBe('async-value')

      // 验证 mock 链路:AsyncStorage.getItem 真被以异步方式调用
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('async-key')
    })
  })

  // ============ 4. 与 zustand persist 集成 ============
  describe('与 zustand persist 集成', () => {
    it('用 createAsyncStorageTransport 作 zustand persist 的 storage 选项', () => {
      // 工厂可正常返回 transport 实例(无 throw)
      const transport = createAsyncStorageTransport()
      expect(transport).toBeDefined()
      expect(typeof transport.getItem).toBe('function')
      expect(typeof transport.setItem).toBe('function')
      expect(typeof transport.removeItem).toBe('function')
    })

    it('setState 后状态通过 transport 持久化到 AsyncStorage(模拟原 store 写入)', async () => {
      const useStore = createCounterStore('counter-store-1')
      // 初始态
      expect(useStore.getState().count).toBe(0)
      expect(useStore.getState().name).toBe('')

      // setState 触发 persist 写盘
      useStore.getState().setName('alice')
      useStore.getState().increment()
      useStore.getState().increment()
      expect(useStore.getState().count).toBe(2)

      // 等 persist 异步 flush
      await flushPersist()

      // 直接读 transport 验证持久化内容(createJSONStorage 会序列化为 JSON 字符串)
      const transport = createAsyncStorageTransport()
      const raw = await transport.getItem('counter-store-1')
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw as string)
      expect(parsed.state.count).toBe(2)
      expect(parsed.state.name).toBe('alice')
    })

    it('模拟新 store 创建(hydrate)能恢复之前状态(应用重启场景)', async () => {
      // 第一个 store 实例:写入状态
      const useStore1 = createCounterStore('counter-store-shared')
      useStore1.getState().setName('bob')
      useStore1.getState().increment()
      useStore1.getState().increment()
      useStore1.getState().increment()
      expect(useStore1.getState().count).toBe(3)

      await flushPersist()

      // 第二个 store 实例(模拟应用重启,新建 store 但同名 key 命中 AsyncStorage)
      const useStore2 = createCounterStore('counter-store-shared')
      // 初始态仍为默认(count=0, name='')
      expect(useStore2.getState().count).toBe(0)

      // 等待 zustand persist hydrate 完成(microtask + setTimeout)
      await flushPersist()

      // hydrate 后应该恢复之前状态
      expect(useStore2.getState().count).toBe(3)
      expect(useStore2.getState().name).toBe('bob')
    })

    it('新 store 用不同 persist key 时不串扰', async () => {
      const useStore1 = createCounterStore('counter-store-a')
      useStore1.getState().setName('A')
      useStore1.getState().increment()
      await flushPersist()

      const useStore2 = createCounterStore('counter-store-b')
      await flushPersist()
      // 不同 key,不应读到 store1 的数据
      expect(useStore2.getState().count).toBe(0)
      expect(useStore2.getState().name).toBe('')
    })
  })

  // ============ 5. Promise rejection 处理 ============
  describe('Promise rejection 处理', () => {
    it('AsyncStorage.setItem 抛错时 transport 透传错误', async () => {
      const transport = createAsyncStorageTransport()
      const error = new Error('AsyncStorage write failed')
      vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(error)

      await expect(transport.setItem('k', 'v')).rejects.toThrow('AsyncStorage write failed')
      // 确认 mock 确实被调用了一次
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('k', 'v')
    })

    it('AsyncStorage.getItem 抛错时 transport 透传错误', async () => {
      const transport = createAsyncStorageTransport()
      const error = new Error('AsyncStorage read failed')
      vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(error)

      await expect(transport.getItem('k')).rejects.toThrow('AsyncStorage read failed')
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('k')
    })

    it('AsyncStorage.removeItem 抛错时 transport 透传错误', async () => {
      const transport = createAsyncStorageTransport()
      const error = new Error('AsyncStorage remove failed')
      vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(error)

      await expect(transport.removeItem('k')).rejects.toThrow('AsyncStorage remove failed')
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('k')
    })
  })
})
