// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-react vitest 全局补丁(G-874 入口的漏项补齐,2026-10-31)。
 *
 * 根因与 apps/web/tests/setup.ts 的 L4 段同一枚:vitest 4 的 jsdom / happy-dom 环境
 * `window.localStorage` 为 undefined(实测 happy-dom 20.11.2 的 Window 实例有该属性,
 * 但 vitest 环境不把它提升到测试全局),凡源码裸用 `localStorage` 的模块在本包测试里
 * 全数 TypeError。web 侧已同根因修过一轮,本包立 vitest 入口时只挂了 environment
 * 没挂 setupFiles ⇒ remember-credentials(19)/qr-entry-agreement-prompt(部分)全数红。
 *
 * 形态与 web L4 同款:「已存在则不覆盖」的防御式注入,补的是真实浏览器内存实现,
 * 不构成掩盖断言。两份清单当前平行,归一进共享测试基建另行立项。
 */

const isWindowEnv = typeof window !== 'undefined'

if (isWindowEnv && typeof window.localStorage === 'undefined') {
  const storageMap = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return storageMap.size
    },
    clear: () => storageMap.clear(),
    getItem: (key) => (storageMap.has(String(key)) ? storageMap.get(String(key))! : null),
    key: (index) => [...storageMap.keys()][index] ?? null,
    removeItem: (key) => {
      storageMap.delete(String(key))
    },
    setItem: (key, value) => {
      storageMap.set(String(key), String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'sessionStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  })
}

if (isWindowEnv && typeof window.matchMedia === 'undefined') {
  const queryListeners = new Set<(this: MediaQueryList, ev: MediaQueryListEvent) => void>()
  window.matchMedia = ((query: string) => {
    const mediaQueryList: MediaQueryList = {
      media: query,
      matches: false,
      onchange: null,
      addListener: (cb) => queryListeners.add(cb),
      removeListener: (cb) => queryListeners.delete(cb),
      addEventListener: (_type, cb) => {
        if (typeof cb === 'function') queryListeners.add(cb)
      },
      removeEventListener: (_type, cb) => {
        queryListeners.delete(cb)
      },
      dispatchEvent: (event) => {
        for (const listener of [...queryListeners]) listener(event as MediaQueryListEvent)
        return true
      },
    }
    return mediaQueryList
  }) as typeof window.matchMedia
}

if (isWindowEnv && typeof window.ResizeObserver === 'undefined') {
  class MemoryResizeObserver implements ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  window.ResizeObserver = MemoryResizeObserver
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
