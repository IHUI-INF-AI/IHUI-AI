// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tests/setup.ts
 *
 * vitest 每个测试文件运行前自动加载:
 * - 重置 AsyncStorage mock(Map + vi.fn 计数)
 * - vi.clearAllMocks 清理所有 vi.fn() spy
 * - RTL cleanup:globals 未开启时 RTL v16 不会自动注册 afterEach,
 *   必须显式清理渲染 DOM,否则多个用例的组件叠加在同一 document.body,
 *   导致 getByText 等查询命中多元素而失败(waitFor 超时)。
 * - asyncUtilTimeout:RTL 的 waitFor/findBy 默认每段只给 1000ms,而这条预算在本机不是
 *   测试判据、是负载读数 —— 2026-10-24 实测同一条链:事件循环空闲时 fireEvent→首跳 3ms,
 *   被同步占死 1200ms 后同一跳 1201ms ⇒ 默认预算必被打穿(全仓 29 枚 mobile-rn 用例同型暴露,
 *   且这台机常年并发 200+ 道守门)。抬到 4000ms:仍远低于 testTimeout 10s(最坏 2 段也吃得下),
 *   断言一条不减、真断链照样翻红,只是红得慢一点(见 e4989cbb9e 的反向牙实测)。
 *   2026-10-31 恢复:9fdbc207ba「清理回退残留」把 43ce93f1a8 的这一行回退掉,
 *   publish-accounts-qr-credential 2 例 waitFor(默认 1000ms)等不到 2500ms 轮询首跳即红。
 */
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

configure({ asyncUtilTimeout: 4000 })

// expo 包(expo/src/async-require/setup.ts)在模块求值期读裸全局 __DEV__,
// jsdom/node 环境没有这个 RN 全局 ⇒ 收集期 ReferenceError。这里补上且取 false:
// 那段代码只在 __DEV__ && typeof window !== 'undefined' 时 require HMR 三件套
// (setupFastRefresh/setupHMR/messageSocket),测试环境没有 dev server ⇒ 必须跳过。
// node 的 globalThis 类型里没有 RN 的 __DEV__ 字段,按可选字段写入——不用 any,也不用 @ts-ignore。
;(globalThis as { __DEV__?: boolean }).__DEV__ = true

beforeEach(() => {
  resetAsyncStorageMock()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
