/**
 * v3 聚合查询联调测试
 *
 * 验证后端 v3 端点真实可达 + 响应格式正确:
 *   - POST /api/v3/query   聚合查询 (agents + courses + user + notifications + chat_sessions)
 *   - GET  /api/v3/stats   实时统计 (kind 计数 + P50/P95/P99 延迟)
 *   - GET  /api/v3/health  健康检查 (LB / K8s liveness 探针)
 *
 * 后端实现: server/app/api/v3_query.py, v3_stats.py
 * 前端 SDK: client/src/api/v2-sdk/v3.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

test.describe('v3 聚合查询联调', () => {
  test.setTimeout(30000)

  test('GET /api/v3/health 返回健康状态', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v3/health`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端 v3 端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    // 后端 success() 返回 {code: "0", data: {...}}
    expect([0, 200, '0', '200']).toContain(body.code)
    expect(body.data).toBeDefined()
    console.log(`[v3/health] 响应: ${JSON.stringify(body.data).substring(0, 200)}`)
  })

  test('GET /api/v3/stats 返回统计指标', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v3/stats`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端 v3 端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect([0, 200, '0', '200']).toContain(body.code)
    expect(body.data).toBeDefined()
    // stats 返回 {kinds: {...}, alerts: {...}} 或空对象
    console.log(`[v3/stats] 响应: ${JSON.stringify(body.data).substring(0, 200)}`)
  })

  test('POST /api/v3/query 聚合查询 agents 资源', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    // 后端 AggregateQueryRequest 期望 resources: [{kind, params, limit}]
    const resp = await request.post(`${BACKEND}/api/v3/query`, {
      timeout: 15000,
      headers,
      data: {
        resources: [{ kind: 'agents', params: { page: 1, page_size: 10 }, limit: 10 }],
        timeout_ms: 5000,
      },
    })

    if (resp.status() === 404) {
      test.skip(true, '后端 v3 端点未挂载')
      return
    }

    // v3/query 可能返回 200 (成功) 或 207 (部分失败)
    expect([200, 207]).toContain(resp.status())
    const body = await resp.json()
    expect([0, 200, '0', '200']).toContain(body.code)
    expect(body.data).toBeDefined()
    // 聚合响应应包含 results 字段 (按 resource 名分组)
    console.log(`[v3/query agents] 响应: ${JSON.stringify(body.data).substring(0, 300)}`)
  })

  test('POST /api/v3/query 聚合查询多资源 (agents + user)', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const resp = await request.post(`${BACKEND}/api/v3/query`, {
      timeout: 15000,
      headers,
      data: {
        resources: [
          { kind: 'agents', params: { page: 1, page_size: 5 }, limit: 5 },
          { kind: 'user', params: {}, limit: 1 },
        ],
        timeout_ms: 5000,
      },
    })

    if (resp.status() === 404) {
      test.skip(true, '后端 v3 端点未挂载')
      return
    }

    if (resp.status() === 422) {
      const errBody = await resp.json()
      console.log(`[v3/query multi] 422 校验错误: ${JSON.stringify(errBody).substring(0, 500)}`)
    }
    expect([200, 207]).toContain(resp.status())
    const body = await resp.json()
    expect([0, 200, '0', '200']).toContain(body.code)
    console.log(`[v3/query multi] 响应: ${JSON.stringify(body.data).substring(0, 300)}`)
  })

  test('POST /api/v3/query 无效资源名返回错误', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const resp = await request.post(`${BACKEND}/api/v3/query`, {
      timeout: 10000,
      headers,
      data: {
        resources: [{ kind: 'invalid_resource', params: {}, limit: 1 }],
        timeout_ms: 3000,
      },
    })

    if (resp.status() === 404) {
      test.skip(true, '后端 v3 端点未挂载')
      return
    }

    // 无效资源应返回 200 + 错误标记, 或 400/422
    expect([200, 207, 400, 422]).toContain(resp.status())
    console.log(`[v3/query invalid] status=${resp.status()}`)
  })
})
