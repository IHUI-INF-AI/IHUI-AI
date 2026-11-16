// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 把请求体字符串安全解析成 Taro 的 data;坏 body 回落 undefined 而不是抛异常 */
function parseBodyData(body: unknown): unknown {
  if (typeof body !== 'string') return undefined
  try {
    return JSON.parse(body)
  } catch {
    // 非 JSON 字符串体(如 form-urlencoded):原样传字符串,交服务端解释
    return body
  }
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
        data: parseBodyData(init.body),
        header: init.headers || {},
        // 小程序运行时没有 AbortController ⇒ client.ts 的看门狗给不出 signal,
        // 超时改由这一端原生实现;调用方自定义的 timeoutMs 必须在这里落地,不能继续写死 30s。
        timeout: init.timeoutMs && init.timeoutMs > 0 ? init.timeoutMs : 30000,
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
            json: async () => {
              if (typeof res.data !== 'string') return res.data
              try {
                return JSON.parse(res.data)
              } catch {
                // 服务端返回了非 JSON(HTML 错误页/空串/截断响应) ⇒ 抛可辨识错误而非 SyntaxError
                throw new Error(`Invalid JSON response: ${res.data.slice(0, 100)}`)
              }
            },
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
