// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Taro 流式传输适配器 — 将 Taro.request(enableChunked)包装为 api-client StreamTransport 接口。
 *
 * D138(承 V4 #96):小程序端不再自写"重连/退避/读超时/断点续传"传输层,
 * 改为注入本 adapter 消费 @ihui/api-client runResumableSSEStream 的共享实现;
 * 本文件只负责把两端的传输介质接进同一套续传逻辑:
 * - 微信/支付宝小程序:Taro.request({ enableChunked: true }) + task.onChunkReceived 逐 chunk
 * - Taro H5:enableChunked 不可用,降级 native fetch(旧自写层 runH5Attempt 同款降级,
 *   经 api-client createFetchStreamTransport 复用,不再端内重写)
 *
 * 已知限制(enableChunked 协议使然,与旧自写层行为一致,如实登记):
 * - 小程序端 statusCode 只在请求完成(success)时可知 ⇒ 响应对象以 ok:true/status:200
 *   占位先 resolve(否则逐 chunk 流式无从谈起),真实状态码在读环收尾时以
 *   SSEError(code=status) 形态浮出 —— 旧 streamSSE 的 weapp 分支同此。
 * - 响应头在完成前不可知 ⇒ headers.get 恒返回 null(trace 回带在小程序流式腿缺席)。
 */
import Taro from '@tarojs/taro'
import {
  createFetchStreamTransport,
  type StreamBodyReader,
  type StreamTransport,
  type StreamTransportResponse,
} from '@ihui/api-client'

/** Taro.request 支持的 HTTP 方法 */
type TaroMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Taro 请求任务(支持 abort / onChunkReceived) */
interface TaroRequestTask {
  abort: () => void
  onChunkReceived: (cb: (res: { data: ArrayBuffer }) => void) => void
}

/** Taro 请求结果(简化类型,避免依赖 @tarojs/taro 内部类型) */
interface TaroRequestResult {
  statusCode: number
  data: unknown
  header?: Record<string, string>
}

/** 创建 Taro 流式 transport 实例(小程序端 setStreamTransport 注入用) */
export function createTaroStreamTransport(): StreamTransport {
  // Taro H5:Taro.request 不支持 enableChunked,与旧自写层同款降级 native fetch
  // (经 api-client 的 fetch 工厂,传输介质实现不端内重写)。
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    return createFetchStreamTransport()
  }
  return (url, init) => {
    return new Promise<StreamTransportResponse>((resolve, reject) => {
      // 信号已中止 → 立即拒绝
      if (init.signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        reject(err)
        return
      }

      let settled = false
      let completed = false
      let completionError: Error | null = null
      const queue: Uint8Array[] = []
      const chunks: Uint8Array[] = []
      let pending: {
        resolve: (r: { done: boolean; value?: Uint8Array }) => void
        reject: (e: Error) => void
      } | null = null

      const wake = (): void => {
        if (!pending) return
        const waiter = pending
        pending = null
        if (queue.length) {
          waiter.resolve({ done: false, value: queue.shift() })
        } else if (completed) {
          if (completionError) waiter.reject(completionError)
          else waiter.resolve({ done: true })
        }
      }

      const settleTaskError = (err: Error): void => {
        if (settled) {
          completed = true
          completionError = err
        } else {
          settled = true
          reject(err)
        }
        wake()
      }

      const task = Taro.request({
        url,
        method: (init.method || 'GET') as TaroMethod,
        data: init.body ?? undefined,
        enableChunked: true,
        responseType: 'text',
        header: init.headers || {},
        success: (res: TaroRequestResult) => {
          if (settled) {
            completed = true
            if (res.statusCode >= 400) {
              // 与旧自写层同形:真实状态码在完成时浮出,业务错误(401/403/429 无
              // retryAfter)由 runner 的统一口径判"不重连"
              const err = new Error(`HTTP ${res.statusCode}`) as Error & { code?: number }
              err.name = 'SSEError'
              err.code = res.statusCode
              completionError = err
            }
          } else {
            settled = true
            resolve({
              ok: true,
              status: 200,
              headers: { get: () => null },
              text: async () =>
                chunks.map((c) => new TextDecoder().decode(c)).join(''),
              body: {
                getReader: (): StreamBodyReader => ({
                  read: () => {
                    if (queue.length) return Promise.resolve({ done: false, value: queue.shift() })
                    if (completed) {
                      return completionError
                        ? Promise.reject(completionError)
                        : Promise.resolve({ done: true })
                    }
                    return new Promise((res2, rej2) => {
                      pending = { resolve: res2, reject: rej2 }
                    })
                  },
                  cancel: async () => {
                    try {
                      task.abort()
                    } catch {
                      /* 已结束的任务 abort 可能抛错,静默 */
                    }
                    completed = true
                    wake()
                  },
                }),
              },
            })
            if (res.statusCode >= 400) {
              // 极端形态:未消费任何 chunk 就完成且非 2xx —— 立即以错误收尾读环
              const err = new Error(`HTTP ${res.statusCode}`) as Error & { code?: number }
              err.name = 'SSEError'
              err.code = res.statusCode
              completed = true
              completionError = err
            }
          }
          wake()
        },
        fail: (err: { errMsg?: string }) => {
          // W5(旧自写层注释沿用):用户主动取消统一归一为 AbortError,
          // 避免 runner 重试循环误判为网络错误而自动重连
          if (init.signal?.aborted) {
            const e = new Error('aborted')
            e.name = 'AbortError'
            settleTaskError(e)
          } else {
            settleTaskError(new Error(err.errMsg || '请求失败'))
          }
        },
      }) as unknown as TaroRequestTask

      task.onChunkReceived(({ data }) => {
        const chunk = new Uint8Array(data)
        chunks.push(chunk)
        queue.push(chunk)
        wake()
      })

      // 支持 AbortSignal 中止请求
      if (init.signal && typeof init.signal.addEventListener === 'function') {
        init.signal.addEventListener(
          'abort',
          () => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            settleTaskError(e)
            try {
              task.abort()
            } catch {
              /* 静默 */
            }
          },
          { once: true },
        )
      }
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
