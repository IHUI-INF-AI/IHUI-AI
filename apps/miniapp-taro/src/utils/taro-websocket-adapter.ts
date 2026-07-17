/**
 * Taro 小程序 WebSocket 适配器。
 *
 * @ihui/api-client 的 `createNotificationClient` 默认走全局 `new WebSocket()`,
 * 但 Taro weapp 无全局 `WebSocket`,只有 `Taro.connectSocket`(返回 `Promise<SocketTask>`)。
 * 本适配器实现 `WebSocketLike` 接口,通过 `webSocketFactory` 依赖注入:
 *
 * ```ts
 * createNotificationClient(
 *   { baseUrl, tokenProvider },
 *   { onMessage },
 *   { webSocketFactory: taroWebSocketFactory },
 * )
 * ```
 *
 * `webSocketFactory(url)` 需同步返回 `WebSocketLike`,而 `Taro.connectSocket` 是异步的,
 * 故立即返回 adapter 对象,内部异步获取 SocketTask 并在就绪后触发 `onopen`。
 * task 未就绪时 `send` 直接 `onerror`(由客户端心跳/重连兜底,不缓存)。
 */
import Taro from '@tarojs/taro'
import type { WebSocketLike } from '@ihui/api-client'

export function taroWebSocketFactory(url: string): WebSocketLike {
  let task: Taro.SocketTask | null = null

  const adapter = {
    readyState: 0,
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: unknown }) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((err: unknown) => void) | null,
    send(data: string) {
      if (!task) {
        adapter.onerror?.(new Error('WebSocket not ready'))
        return
      }
      task.send({ data, fail: (err: unknown) => adapter.onerror?.(err) })
    },
    close() {
      if (!task) return
      try {
        task.close({})
      } catch {
        // ignore
      }
    },
  }

  Taro.connectSocket({ url })
    .then((t) => {
      task = t
      t.onOpen(() => {
        adapter.readyState = 1
        adapter.onopen?.()
      })
      t.onMessage((res) => {
        adapter.onmessage?.({ data: res.data })
      })
      t.onError((err) => {
        adapter.readyState = 3
        adapter.onerror?.(err)
      })
      t.onClose(() => {
        adapter.readyState = 3
        adapter.onclose?.()
      })
    })
    .catch((err) => {
      adapter.readyState = 3
      adapter.onerror?.(err)
    })

  return adapter
}
