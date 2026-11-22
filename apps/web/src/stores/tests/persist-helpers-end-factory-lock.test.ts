// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时锁:web 端 zustand persist 装配点 `ssrStorage` 的读写通道必须取自
 * **端工厂单点** `createLocalStorageTransport()`(守门 121 C7 那枚工厂的接线腿)。
 *
 * 与小程序端同一能力同一条链(§4 跨端铁律):装配点只认端工厂,不再就地重抄一份
 * `window.localStorage` adapter;镜像锁见 apps/miniapp-taro/tests/store-migration-end-factory.test.ts。
 *
 * 三条判据:
 * 1. 客户端:装配点向端工厂取通道,且写/读/删真落到 localStorage 这块盘上;
 * 2. 隐私模式(取 window.localStorage 即抛):import 不抛穿、且不把工厂当"看起来可用"的通道;
 * 3. SSR(window 不存在):走 noop 降级,同样不取工厂(服务端没有可写的盘)。
 *
 * 存储层是替身:happy-dom 的 localStorage(不连真浏览器、不连库)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as WebStorageAdapter from '../storage-adapter'

const { factoryHits } = vi.hoisted(() => ({ factoryHits: { count: 0 } }))

// 端工厂包一层计数,实现取原样:判据要的是"装配点向它取通道",工厂自身行为另有用例钉
vi.mock('../storage-adapter', async (importOriginal) => {
  const mod = await importOriginal<typeof WebStorageAdapter>()
  return {
    ...mod,
    createLocalStorageTransport: () => {
      factoryHits.count += 1
      return mod.createLocalStorageTransport()
    },
  }
})

const windowDescriptor = Reflect.getOwnPropertyDescriptor(globalThis, 'window')
const localStorageSync = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** 每次都要重新求值模块顶层的 createJSONStorage ⇒ 必须清模块注册表后再 import */
async function loadPersistHelpers() {
  vi.resetModules()
  factoryHits.count = 0
  return (await import('../persist-helpers')).ssrStorage
}

afterEach(() => {
  // 先还 window 再还 localStorage:W3 把 globalThis.window 删过,
  // 顺序反了会在 afterEach 里 ReferenceError(把清理本身搞成失败原因)。
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
  if (localStorageSync) Object.defineProperty(window, 'localStorage', localStorageSync)
  else Reflect.deleteProperty(window, 'localStorage')
})

describe('web persist 装配点 ⇒ 端工厂单点', () => {
  it('W1 客户端:向端工厂取通道,写/读/删真走这块盘', async () => {
    const ssrStorage = await loadPersistHelpers()

    expect(factoryHits.count).toBe(1)
    expect(ssrStorage).toBeDefined()

    await ssrStorage?.setItem('ihui-lock-probe', { state: { a: 1 }, version: 0 })
    expect(window.localStorage.getItem('ihui-lock-probe')).toBe('{"state":{"a":1},"version":0}')

    const got = await ssrStorage?.getItem('ihui-lock-probe')
    expect(got).toEqual({ state: { a: 1 }, version: 0 })

    await ssrStorage?.removeItem('ihui-lock-probe')
    expect(window.localStorage.getItem('ihui-lock-probe')).toBeNull()
  })

  it('W2 隐私模式(取属性即抛):import 不抛穿,且不取工厂', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: localStorage 不可用')
      },
    })

    const ssrStorage = await loadPersistHelpers()

    expect(ssrStorage).toBeUndefined()
    expect(factoryHits.count).toBe(0)
  })

  it('W3 SSR(window 不存在):noop 降级,不取工厂', async () => {
    delete (globalThis as { window?: unknown }).window

    const ssrStorage = await loadPersistHelpers()

    expect(ssrStorage).toBeDefined()
    expect(factoryHits.count).toBe(0)
    // 服务端"写盘"必须是静默 noop(渲染路径不该被持久化抛穿)
    expect(() => ssrStorage?.setItem('ihui-lock-probe', { state: {}, version: 0 })).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
