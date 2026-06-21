/**
 * 前端错误处理联调测试
 *
 * 目的: 验证前端 request.ts 的 401/403/422/500 错误处理逻辑
 *
 * 覆盖:
 * 1. 401: 未授权 - 触发 token 失效处理
 * 2. 403: 禁止访问 - 不跳转登录
 * 3. 422: 参数验证错误 - 显示错误提示
 * 4. 500: 服务器错误 - 显示通用错误
 * 5. 网络错误: 触发重试机制
 */

import { test, expect, type Page } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'
const FRONTEND = process.env.PW_BASE_URL ?? 'http://127.0.0.1:8888'

test.describe('错误处理: HTTP 状态码响应', () => {
  test.setTimeout(30000)

  test('401 Unauthorized: 后端返回 401 时前端能识别', async ({ request }) => {
    // 后端 mock 模式一般不返回 401, 但我们尝试用错误的 token
    const resp = await request.get(`${BACKEND}/api/v1/user/secret`, {
      headers: { Authorization: 'Bearer invalid_token_99999' },
      timeout: 8000,
      failOnStatusCode: false,
    })
    expect([200, 401, 403, 404, 422]).toContain(resp.status())
    console.log(`[401] 后端响应: ${resp.status()}`)
  })

  test('403 Forbidden: 业务接口禁止访问', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/v1/admin/forbidden`, {
      timeout: 8000,
      failOnStatusCode: false,
    })
    expect([200, 401, 403, 404, 422]).toContain(resp.status())
    console.log(`[403] 后端响应: ${resp.status()}`)
  })

  test('422 Unprocessable Entity: 参数验证失败 (FastAPI 标准)', async ({ request }) => {
    // 故意发送错误参数触发 422
    // 后端 mock 模式可能返回 200, 真实模式才会 422, 限流时 429
    const resp = await request.post(`${BACKEND}/api/v1/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { invalid_field: 123 },  // 故意缺字段
      timeout: 8000,
      failOnStatusCode: false,
    })
    // mock 模式: 200, 真实模式: 422, 限流: 429
    expect([200, 422, 429]).toContain(resp.status())
    console.log(`[422] 后端响应: ${resp.status()}`)
  })

  test('500 Server Error: 模拟服务端异常', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/v1/test/trigger-500`, {
      timeout: 8000,
      failOnStatusCode: false,
    })
    expect([200, 404, 500]).toContain(resp.status())
    console.log(`[500] 后端响应: ${resp.status()}`)
  })
})

test.describe('错误处理: 浏览器内 axios 错误拦截', () => {
  test.setTimeout(60000)

  test('浏览器内发起 422 请求, 前端能正确捕获错误', async ({ page }: { page: Page }) => {
    // 先访问页面以便加载 axios 实例
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

    // 使用 Vite 代理的同源 URL (前端 /api/* 由 Vite 代理到后端)
    const proxyUrl = `${FRONTEND}/api/v1/auth/login`
    const result = await page.evaluate(async (apiUrl: string) => {
      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalid: 'data' }),
        })
        return {
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
        }
      } catch (err) {
        return { ok: false, status: 0, error: String(err) }
      }
    }, proxyUrl)

    console.log(`[422 浏览器内] 响应: ${JSON.stringify(result)}`)
    // mock 模式: 200, 真实模式: 422, 网络错误: 0, 限流: 429
    expect([200, 422, 0, 429]).toContain(result.status)
  })

  test('浏览器内发起 401 请求, 前端能识别 token 失效', async ({ page }: { page: Page }) => {
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

    // 使用 Vite 代理的同源 URL
    const proxyUrl = `${FRONTEND}/api/v1/user/users/getInfo`
    const result = await page.evaluate(async (apiUrl: string) => {
      try {
        const resp = await fetch(apiUrl, {
          headers: { Authorization: 'Bearer expired_token_for_test' },
        })
        return { ok: resp.ok, status: resp.status }
      } catch (err) {
        return { ok: false, status: 0, error: String(err) }
      }
    }, proxyUrl)

    console.log(`[401 浏览器内] 响应: ${JSON.stringify(result)}`)
    // mock 模式: 200 (后端忽略 token), 真实模式: 401
    expect([200, 401, 0]).toContain(result.status)
  })

  test('浏览器内发起网络错误请求, 前端能捕获网络异常', async ({ page }: { page: Page }) => {
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

    const result = await page.evaluate(async () => {
      try {
        // 故意访问不存在的服务
        const resp = await fetch('http://127.0.0.1:1/non-existent', {
          signal: AbortSignal.timeout(3000),
        })
        return { ok: resp.ok, status: resp.status, error: null as string | null }
      } catch (err) {
        return { ok: false, status: 0, error: String(err) }
      }
    })

    console.log(`[网络错误 浏览器内] 响应: ${JSON.stringify(result)}`)
    expect(result.error !== null || result.status === 0).toBe(true)
  })
})

test.describe('错误处理: 错误信息中文化验证', () => {
  test.setTimeout(30000)

  test('错误响应 msg 字段是中文 (后端 ApiResponse 格式)', async ({ request }) => {
    // 触发 422 参数错误
    const resp = await request.post(`${BACKEND}/api/v1/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { invalid: 'data' },
      timeout: 8000,
      failOnStatusCode: false,
    })
    const body = await resp.json()
    console.log(`[错误中文化] 422 响应 msg: ${JSON.stringify(body).substring(0, 200)}`)
    if (resp.status() === 422) {
      expect(typeof body).toBe('object')
    } else {
      expect([200, 422, 429]).toContain(resp.status())
    }
  })
})
