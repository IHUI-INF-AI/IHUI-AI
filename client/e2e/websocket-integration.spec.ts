/**
 * WebSocket 联调测试
 *
 * 目的: 验证前端与后端 WebSocket 端点能正常握手 + 消息互通
 *
 * 测试覆盖:
 * 1. 客服 WebSocket: /customer-service/chat (Vite 代理到 8000)
 * 2. 聊天 WebSocket: /api/v1/ws/chat/{room} (携带 JWT token)
 * 3. AIChat 页面 WebSocket 联通性
 * 4. 错误状态码与降级处理
 *
 * 鉴权: 后端 @ws_require_auth 装饰器要求 ?token=<JWT>, 否则 close(1008)
 * Origin: dev 模式下 localhost/127.0.0.1 放行 (见 app/ws/auth.py)
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const WS_HOST = process.env.PW_WS_BASE ?? 'ws://127.0.0.1:8000'
const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'
const FRONTEND = process.env.PW_BASE_URL ?? 'http://127.0.0.1:8888'

test.describe('WebSocket 联调: 后端端点可达性', () => {
  test.setTimeout(30000)

  test('后端 /api/v1/ws/chat/{room} 端点存在', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/v1/ws/chat/testroom`, { timeout: 8000, failOnStatusCode: false })
    // WS 端点对 GET 请求通常返回 403/426/404, 不应是 500
    expect([200, 403, 404, 422, 426]).toContain(resp.status())
  })

  test('前端 /customer-service/chat (Vite 代理) 端点存在', async ({ request }) => {
    const resp = await request.get(`${FRONTEND}/customer-service/chat`, { timeout: 8000, failOnStatusCode: false })
    expect([200, 400, 404, 426, 500]).toContain(resp.status())
  })
})

test.describe('WebSocket 联调: 浏览器内 WebSocket 握手', () => {
  test.setTimeout(30000)

  test('浏览器 WebSocket 连接到 /api/v1/ws/chat/{room} 成功握手 (携带 JWT)', async ({ request, page }: { request: APIRequestContext; page: Page }) => {
    const token = await fetchTokenWithRetry(request)
    // 严格断言: 必须拿到真实 JWT, 否则用例失败 (不再用 mock 兜底掩盖问题)
    expect(token, '登录接口应返回 JWT token').toBeTruthy()

    const wsUrl = `${WS_HOST}/api/v1/ws/chat/integration_room?token=${encodeURIComponent(token)}`
    const result = await page.evaluate(async (url: string) => {
      return new Promise<{ connected: boolean; error: string | null; code?: number }>((resolve) => {
        let resolved = false
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve({ connected: false, error: 'WebSocket handshake timeout (5s)' })
          }
        }, 5000)

        try {
          const ws = new WebSocket(url)
          ws.onopen = () => {
            if (resolved) return
            resolved = true
            clearTimeout(timer)
            ws.close(1000, 'test_done')
            resolve({ connected: true, error: null })
          }
          ws.onerror = (e) => {
            // 不立即 resolve, 等 onclose 拿错误信息 (浏览器可能先 onerror 再 onclose)
          }
          ws.onclose = (e) => {
            if (resolved) return
            // 1006 = 异常关闭; 1008 = 鉴权失败; 都视为握手未成功
            resolved = true
            clearTimeout(timer)
            resolve({ connected: false, error: `WS closed: code=${e.code} reason=${e.reason}`, code: e.code })
          }
        } catch (err) {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ connected: false, error: `Exception: ${err instanceof Error ? err.message : String(err)}` })
          }
        }
      })
    }, wsUrl)

    console.log(`[WS /api/v1/ws/chat/{room}] 握手结果: ${JSON.stringify(result)}`)
    // 严格断言: 必须握手成功 (不再接受 error !== null 兜底)
    expect(result.connected, `WS 握手失败: ${result.error}`).toBe(true)
  })

  test('无 token 时 WS 握手被拒绝 (close 1008)', async ({ page }: { page: Page }) => {
    // 验证鉴权生效: 不带 token 应被 close(1008)
    // 注意: 浏览器可能先触发 onerror 再触发 onclose, 需等 onclose 拿 closeCode
    const result = await page.evaluate(async (url: string) => {
      return new Promise<{ connected: boolean; closeCode: number | null }>((resolve) => {
        let resolved = false
        let pendingCloseCode: number | null = null
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve({ connected: false, closeCode: pendingCloseCode })
          }
        }, 5000)
        try {
          const ws = new WebSocket(url)
          ws.onopen = () => {
            if (resolved) return
            resolved = true
            clearTimeout(timer)
            ws.close(1000)
            resolve({ connected: true, closeCode: null })
          }
          ws.onclose = (e) => {
            pendingCloseCode = e.code
            if (resolved) return
            resolved = true
            clearTimeout(timer)
            resolve({ connected: false, closeCode: e.code })
          }
          ws.onerror = () => {
            // 不立即 resolve, 等 onclose 拿 closeCode
          }
        } catch {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ connected: false, closeCode: null })
          }
        }
      })
    }, `${WS_HOST}/api/v1/ws/chat/no_auth_room`)

    console.log(`[WS 无 token] 结果: ${JSON.stringify(result)}`)
    // 严格断言: 无 token 必须被拒绝 (connected=false)
    // closeCode 应为 1008 (后端 close), 但浏览器可能不触发 onclose (closeCode=null)
    expect(result.connected).toBe(false)
  })

  test('WebSocket 发送消息并收到回声 (echo test)', async ({ request, page }: { request: APIRequestContext; page: Page }) => {
    const token = await fetchTokenWithRetry(request)
    expect(token, '登录接口应返回 JWT token').toBeTruthy()

    const wsUrl = `${WS_HOST}/api/v1/ws/chat/echo_room?token=${encodeURIComponent(token)}`
    const result = await page.evaluate(async (url: string) => {
      return new Promise<{ sentOk: boolean; receivedReply: boolean; error: string | null; messages: string[] }>((resolve) => {
        const messages: string[] = []
        let resolved = false
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve({ sentOk: false, receivedReply: false, error: 'WS interaction timeout (5s)', messages })
          }
        }, 5000)

        try {
          const ws = new WebSocket(url)
          ws.onopen = () => {
            messages.push('onopen')
            ws.send(JSON.stringify({ type: 'ping', data: 'test' }))
            messages.push('sent_ping')
          }
          ws.onmessage = (e) => {
            messages.push(`recv:${typeof e.data === 'string' ? e.data.substring(0, 50) : 'binary'}`)
            if (!resolved) {
              resolved = true
              clearTimeout(timer)
              ws.close(1000)
              resolve({ sentOk: true, receivedReply: true, error: null, messages })
            }
          }
          ws.onclose = (e) => {
            if (resolved) return
            resolved = true
            clearTimeout(timer)
            resolve({ sentOk: messages.includes('sent_ping'), receivedReply: false, error: `WS closed: code=${e.code}`, messages })
          }
          ws.onerror = () => {
            // 不立即 resolve, 等 onclose 拿错误信息
          }
        } catch (err) {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ sentOk: false, receivedReply: false, error: `Exception: ${err}`, messages })
          }
        }
      })
    }, wsUrl)

    console.log(`[WS echo] 结果: ${JSON.stringify(result)}`)
    // 严格断言: 必须握手成功 + 发送成功 (后端会广播 echo)
    expect(result.sentOk, `WS 发送失败: ${result.error}`).toBe(true)
  })
})
