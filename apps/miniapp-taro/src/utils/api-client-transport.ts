/**
 * Taro 传输适配器 — 将 Taro.request 包装为 api-client Transport 接口。
 *
 * 使 @ihui/api-client 的 fetchApi/eduApi 可在微信小程序/支付宝小程序运行时使用,
 * 替代不可用的 native fetch。
 *
 * URL 已由 fetchApi 的 normalizeUrl 预处理(含 baseUrl 前缀),transport 直接透传。
 */
import Taro from '@tarojs/taro'
import type { Transport, TransportResponse } from '@ihui/api-client'

/** Taro.request 支持的 HTTP 方法 */
type TaroMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Taro 请求结果(简化类型,避免依赖 @tarojs/taro 内部类型) */
interface TaroRequestResult {
  statusCode: number
  data: unknown
  header?: Record<string, string>
}

/** Taro 请求任务(支持 abort) */
interface TaroRequestTask {
  abort: () => void
}

/** 创建 Taro transport 实例 */
export function createTaroTransport(): Transport {
  return (url, init) => {
    return new Promise<TransportResponse>((resolve, reject) => {
      // 信号已中止 → 立即拒绝
      if (init.signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        reject(err)
        return
      }

      const task = Taro.request({
        url,
        method: (init.method || 'GET') as TaroMethod,
        data: init.body ? JSON.parse(init.body) : undefined,
        header: init.headers || {},
        timeout: 30000,
        success: (res: TaroRequestResult) => {
          // 构建大小写不敏感的 header map
          const headerMap: Record<string, string> = {}
          if (res.header) {
            for (const [k, v] of Object.entries(res.header)) {
              headerMap[k.toLowerCase()] = String(v)
            }
          }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: {
              get: (name: string) => headerMap[name.toLowerCase()] ?? null,
            },
            text: async () => (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)),
            json: async () => (typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
          })
        },
        fail: (err: { errMsg?: string }) => {
          reject(new Error(err.errMsg || '网络异常'))
        },
      }) as unknown as TaroRequestTask

      // 支持 AbortSignal 中止请求
      if (init.signal && typeof init.signal.addEventListener === 'function') {
        init.signal.addEventListener(
          'abort',
          () => {
            if (typeof task.abort === 'function') task.abort()
          },
          { once: true },
        )
      }
    })
  }
}
