/**
 * storage-adapter runtime 集成测试(2026-07-25 立)
 *
 * 覆盖两个工厂的实际行为:
 * 1. createLocalStorageTransport — 包装 window.localStorage 的同步 transport
 * 2. createSSRSafeWebTransport   — SSR 安全(无 window → 内存 fallback)
 *
 * 测试环境:happy-dom(vitest.config.ts 默认),localStorage / window 可用
 *
 * SSR 模拟要点:
 * createSSRSafeTransport 内部用 `'window' in globalThis` 检测,
 * 因此 `vi.stubGlobal('window', undefined)` 不够 — 必须 `delete` 属性,
 * 否则 `'window' in` 仍返回 true。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createLocalStorageTransport,
  createSSRSafeWebTransport,
} from '../storage-adapter'

describe('storage-adapter', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  // ============================================================
  // 1. createLocalStorageTransport — 基础读写
  // ============================================================
  describe('createLocalStorageTransport — 基础读写', () => {
    it('setItem 后 getItem 返回原值', () => {
      const transport = createLocalStorageTransport()
      transport.setItem('key1', 'value1')
      expect(transport.getItem('key1')).toBe('value1')
    })

    it('getItem 不存在的 key 返回 null', () => {
      const transport = createLocalStorageTransport()
      expect(transport.getItem('non-existent')).toBeNull()
    })

    it('removeItem 后 getItem 返回 null', () => {
      const transport = createLocalStorageTransport()
      transport.setItem('key1', 'value1')
      expect(transport.getItem('key1')).toBe('value1')
      transport.removeItem('key1')
      expect(transport.getItem('key1')).toBeNull()
    })
  })

  // ============================================================
  // 2. createLocalStorageTransport — 边界
  // ============================================================
  describe('createLocalStorageTransport — 边界', () => {
    it('空字符串值正确存取', () => {
      const transport = createLocalStorageTransport()
      transport.setItem('empty', '')
      expect(transport.getItem('empty')).toBe('')
    })

    it('中文/Unicode 值正确存取', () => {
      const transport = createLocalStorageTransport()
      const unicode = '你好世界 🌍 café 한국어 日本語'
      transport.setItem('unicode', unicode)
      expect(transport.getItem('unicode')).toBe(unicode)
    })

    it('JSON 字符串正确存取', () => {
      const transport = createLocalStorageTransport()
      const json = JSON.stringify({ a: 1, b: [1, 2, 3], c: 'hello' })
      transport.setItem('json', json)
      expect(transport.getItem('json')).toBe(json)
    })
  })

  // ============================================================
  // 3. createSSRSafeWebTransport — happy-dom 环境(hasWindow=true)
  // ============================================================
  describe('createSSRSafeWebTransport — happy-dom 环境', () => {
    it('走 localStorage 通路(set 后 window.localStorage 可读到)', () => {
      const transport = createSSRSafeWebTransport()
      transport.setItem('k', 'v')
      expect(transport.getItem('k')).toBe('v')
      expect(window.localStorage.getItem('k')).toBe('v')
    })

    it('数据隔离(不同 key 互不干扰)', () => {
      const transport = createSSRSafeWebTransport()
      transport.setItem('a', '1')
      transport.setItem('b', '2')
      expect(transport.getItem('a')).toBe('1')
      expect(transport.getItem('b')).toBe('2')
      transport.removeItem('a')
      expect(transport.getItem('a')).toBeNull()
      expect(transport.getItem('b')).toBe('2')
    })
  })

  // ============================================================
  // 4. createSSRSafeWebTransport — SSR 模拟(window 不可用)
  // ============================================================
  describe('createSSRSafeWebTransport — SSR 模拟(window 不可用)', () => {
    // 保存原始 window,afterEach 恢复,避免污染后续测试
    let savedWindow: unknown

    beforeEach(() => {
      // createSSRSafeTransport 用 `'window' in globalThis` 判断,
      // 必须 delete 属性才能模拟 SSR(单纯设 undefined 仍会被 'in' 检测到)
      savedWindow = (globalThis as { window?: unknown }).window
      delete (globalThis as { window?: unknown }).window
    })

    afterEach(() => {
      ;(globalThis as { window?: unknown }).window = savedWindow
    })

    it('window 不可用时走内存 fallback(setItem 不抛错,getItem 返回写入值)', () => {
      const transport = createSSRSafeWebTransport()
      expect(() => transport.setItem('k', 'v')).not.toThrow()
      expect(transport.getItem('k')).toBe('v')
    })

    it('getItem 内存数据一致性(get/set/remove 完整流程)', () => {
      const transport = createSSRSafeWebTransport()
      transport.setItem('k1', 'v1')
      transport.setItem('k2', 'v2')
      expect(transport.getItem('k1')).toBe('v1')
      expect(transport.getItem('k2')).toBe('v2')
      transport.removeItem('k1')
      expect(transport.getItem('k1')).toBeNull()
      expect(transport.getItem('k2')).toBe('v2')
    })
  })

  // ============================================================
  // 5. createSSRSafeWebTransport — window 状态切换
  // ============================================================
  describe('createSSRSafeWebTransport — window 状态切换', () => {
    let savedWindow: unknown

    beforeEach(() => {
      savedWindow = (globalThis as { window?: unknown }).window
      window.localStorage.clear()
    })

    afterEach(() => {
      // 恢复 — happy-dom 下 savedWindow 必为 window 对象,但 null-safe 处理
      if (savedWindow !== undefined) {
        ;(globalThis as { window?: unknown }).window = savedWindow
      } else {
        delete (globalThis as { window?: unknown }).window
      }
    })

    it('首次 setItem 走内存,window 恢复后,后续 set 写入 localStorage', () => {
      // 阶段 1: 模拟 SSR(无 window)→ 写入内存
      delete (globalThis as { window?: unknown }).window
      const transport = createSSRSafeWebTransport()
      transport.setItem('mem', 'memory-v')
      expect(transport.getItem('mem')).toBe('memory-v')

      // 阶段 2: 恢复 window → ensureClient() 懒构造 client,后续走 localStorage
      ;(globalThis as { window?: unknown }).window = savedWindow
      window.localStorage.clear()

      transport.setItem('ls', 'ls-v')
      expect(window.localStorage.getItem('ls')).toBe('ls-v')
      expect(transport.getItem('ls')).toBe('ls-v')
      // 内存中的 'mem' 不在 localStorage → 切换后 read 返 null
      expect(transport.getItem('mem')).toBeNull()
    })

    it('首次 getItem 走 localStorage,window 移除后,后续走内存', () => {
      // 预置 localStorage
      window.localStorage.setItem('init', 'init-v')

      const transport = createSSRSafeWebTransport()
      // 阶段 1: 有 window → 走 localStorage
      expect(transport.getItem('init')).toBe('init-v')

      // 阶段 2: 移除 window → 切回内存路径
      delete (globalThis as { window?: unknown }).window
      // 内存中 'init' 不存在 → null
      expect(transport.getItem('init')).toBeNull()
      // 写内存
      transport.setItem('mem', 'mem-v')
      expect(transport.getItem('mem')).toBe('mem-v')
    })
  })
})
