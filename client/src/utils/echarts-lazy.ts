/**
 * ECharts 异步加载器
 * ----------------------------------------------------------------------------
 * 2026-06-24 优化：把 echarts 包从首屏 bundle 中移出
 * - 之前 9 个 .vue/.ts 文件在 setup 顶层 import '@/utils/echarts'，
 *   Vite 会把 echarts 完整包（~739KB）打入首屏 vendor chunk。
 * - echarts 实际只用于 9 个管理后台/统计页面（首页/登录/AI 对话用不到），
 *   通过动态加载可以让 echarts 仅在用户进入相关页面时按需下载。
 *
 * 用法（替换原来的 `import echarts from '@/utils/echarts'`）：
 *   - 1) 在类型声明处：`let echarts: typeof import('@/utils/echarts').default | null = null`
 *   - 2) 在 init 之前：`echarts = (await loadEcharts()).default`
 *   - 3) onMounted 改为 async
 *
 * 多次调用会复用同一个 echarts 实例（单例 + Promise 缓存）。
 */
import type * as EchartsModule from './echarts'

let _instance: typeof EchartsModule.default | null = null
let _promise: Promise<typeof EchartsModule.default> | null = null

/**
 * 异步加载 echarts，返回的 promise 可 await 多次（单例）
 */
export function loadEcharts(): Promise<typeof EchartsModule.default> {
  if (_instance) return Promise.resolve(_instance)
  if (!_promise) {
    _promise = import('./echarts').then(m => {
      _instance = m.default
      return _instance
    })
  }
  return _promise
}

/**
 * 直接 await 拿到 echarts 实例（最常用方式）
 */
export default loadEcharts
