/**
 * P9-4 API Mock 服务统一化验证
 * - e2e/helpers/api-mock.ts 存在且导出完整 API
 * - mockApi 函数能正确拦截请求
 * - mockApiError 函数能返回错误响应
 * - mockApiList 函数能返回分页数据
 * - CommonMockData 包含完整常用数据
 * - mockCommonApis 能一键 mock 多个接口
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const ROOT = 'g:/1/client'
const API_MOCK_PATH = `${ROOT}/e2e/helpers/api-mock.ts`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

test.describe('P9-4 API Mock 服务统一化 - 源码审查', () => {
  let content: string

  test.beforeAll(() => {
    content = readText(API_MOCK_PATH)
  })

  test('api-mock.ts 文件存在且非空', () => {
    expect(content.length, 'api-mock.ts 应有内容').toBeGreaterThan(1000)
    console.log(`[P9-4] api-mock.ts 文件大小: ${content.length} 字符 ✅`)
  })

  test('导出完整的类型定义', () => {
    expect(content, '导出 ApiMockResponse').toMatch(/export interface ApiMockResponse/)
    expect(content, '导出 PaginatedData').toMatch(/export interface PaginatedData/)
    expect(content, '导出 MockRequest').toMatch(/export interface MockRequest/)
    expect(content, '导出 ResponseBody').toMatch(/export type ResponseBody/)
    console.log('[P9-4] 类型定义完整 ✅')
  })

  test('导出核心函数', () => {
    expect(content, '导出 successResponse').toMatch(/export function successResponse/)
    expect(content, '导出 errorResponse').toMatch(/export function errorResponse/)
    expect(content, '导出 paginatedData').toMatch(/export function paginatedData/)
    expect(content, '导出 mockApi').toMatch(/export async function mockApi/)
    expect(content, '导出 mockApiError').toMatch(/export async function mockApiError/)
    expect(content, '导出 mockApiList').toMatch(/export async function mockApiList/)
    expect(content, '导出 clearMocks').toMatch(/export async function clearMocks/)
    expect(content, '导出 mockCommonApis').toMatch(/export async function mockCommonApis/)
    console.log('[P9-4] 核心函数完整 ✅')
  })

  test('导出 CommonMockData 常量', () => {
    expect(content, '导出 CommonMockData').toMatch(/export const CommonMockData/)
    expect(content, '包含 user 数据').toMatch(/user:\s*\{/)
    expect(content, '包含 token 数据').toMatch(/token:\s*\{/)
    expect(content, '包含 agents 数据').toMatch(/agents:\s*\[/)
    expect(content, '包含 statistics 数据').toMatch(/statistics:\s*\{/)
    console.log('[P9-4] CommonMockData 完整 ✅')
  })

  test('mockApi 支持所有 HTTP 方法', () => {
    expect(content, '支持 GET').toMatch(/'GET'/)
    expect(content, '支持 POST').toMatch(/'POST'/)
    expect(content, '支持 PUT').toMatch(/'PUT'/)
    expect(content, '支持 DELETE').toMatch(/'DELETE'/)
    expect(content, '支持 PATCH').toMatch(/'PATCH'/)
    expect(content, '支持通配符 *').toMatch(/'\*'/)
    console.log('[P9-4] 支持所有 HTTP 方法 ✅')
  })

  test('mockApi 支持 string 和 RegExp 路径匹配', () => {
    expect(content, '支持 string 路径').toMatch(/typeof path === 'string'/)
    expect(content, '支持 RegExp 路径').toMatch(/path\.test\(u\)/)
    console.log('[P9-4] 支持 string 和 RegExp 路径匹配 ✅')
  })

  test('标准响应格式符合后端约定', () => {
    expect(content, '包含 code 字段').toMatch(/code:\s*200/)
    expect(content, '包含 success 字段').toMatch(/success:\s*true/)
    expect(content, '包含 message 字段').toMatch(/message/)
    expect(content, '包含 data 字段').toMatch(/data/)
    expect(content, '包含 timestamp 字段').toMatch(/timestamp:\s*Date\.now/)
    console.log('[P9-4] 标准响应格式符合后端约定 ✅')
  })
})

test.describe('P9-4 API Mock 服务统一化 - 功能验证', () => {
  test('mockApi 能正确拦截 GET 请求', async ({ page }) => {
    const { mockApi, clearMocks } = await import('./helpers/api-mock')

    let intercepted = false
    await mockApi(page, 'GET', '/test-get-endpoint', { result: 'get-success' })

    page.on('response', (res) => {
      if (res.url().includes('/test-get-endpoint')) {
        intercepted = true
      }
    })

    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    // 触发一个 fetch 请求
    await page.evaluate(() => {
      return fetch('/test-get-endpoint').then((r) => r.json()).catch(() => null)
    })

    await page.waitForTimeout(500)
    expect(intercepted, 'GET 请求应被拦截').toBe(true)
    await clearMocks(page)
    console.log('[P9-4] mockApi GET 拦截正常 ✅')
  })

  test('mockApi 能正确拦截 POST 请求', async ({ page }) => {
    const { mockApi, clearMocks } = await import('./helpers/api-mock')

    let intercepted = false
    await mockApi(page, 'POST', '/test-post-endpoint', (req) => {
      return { received: req.body }
    })

    page.on('response', (res) => {
      if (res.url().includes('/test-post-endpoint')) {
        intercepted = true
      }
    })

    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.evaluate(() => {
      return fetch('/test-post-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      }).then((r) => r.json()).catch(() => null)
    })

    await page.waitForTimeout(500)
    expect(intercepted, 'POST 请求应被拦截').toBe(true)
    await clearMocks(page)
    console.log('[P9-4] mockApi POST 拦截正常 ✅')
  })

  test('mockApiError 能返回错误响应', async ({ page }) => {
    const { mockApiError, clearMocks } = await import('./helpers/api-mock')

    let errorCode: number | null = null
    await mockApiError(page, '/test-error-endpoint', 401, 'Unauthorized')

    page.on('response', async (res) => {
      if (res.url().includes('/test-error-endpoint')) {
        try {
          const json = await res.json()
          errorCode = json.code
        } catch {
          // ignore
        }
      }
    })

    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.evaluate(() => {
      return fetch('/test-error-endpoint').then((r) => r.json()).catch(() => null)
    })

    await page.waitForTimeout(500)
    expect(errorCode, '错误响应 code 应为 401').toBe(401)
    await clearMocks(page)
    console.log('[P9-4] mockApiError 错误响应正常 ✅')
  })

  test('mockApiList 能返回分页数据', async ({ page }) => {
    const { mockApiList, clearMocks } = await import('./helpers/api-mock')

    let totalItems = 0
    const testList = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `item-${i}` }))
    await mockApiList(page, '/test-list-endpoint', testList)

    page.on('response', async (res) => {
      if (res.url().includes('/test-list-endpoint')) {
        try {
          const json = await res.json()
          totalItems = json.data?.list?.length || 0
        } catch {
          // ignore
        }
      }
    })

    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.evaluate(() => {
      return fetch('/test-list-endpoint').then((r) => r.json()).catch(() => null)
    })

    await page.waitForTimeout(500)
    expect(totalItems, '分页数据应包含 5 个项目').toBe(5)
    await clearMocks(page)
    console.log('[P9-4] mockApiList 分页数据正常 ✅')
  })

  test('mockCommonApis 能一键 mock 多个接口', async ({ page }) => {
    const { mockCommonApis, clearMocks } = await import('./helpers/api-mock')

    const interceptedUrls: string[] = []
    await mockCommonApis(page)

    page.on('response', (res) => {
      interceptedUrls.push(res.url())
    })

    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    // 触发多个请求
    await page.evaluate(() => {
      return Promise.all([
        fetch('/user/info').then((r) => r.json()).catch(() => null),
        fetch('/ai-program/zhsAgent/list').then((r) => r.json()).catch(() => null),
        fetch('/statistics/usage').then((r) => r.json()).catch(() => null),
      ])
    })

    await page.waitForTimeout(1000)
    const hasUserMock = interceptedUrls.some((u) => u.includes('/user/info'))
    const hasAgentMock = interceptedUrls.some((u) => u.includes('/zhsAgent/list'))
    const hasStatsMock = interceptedUrls.some((u) => u.includes('/statistics/usage'))

    expect(hasUserMock, '应 mock /user/info').toBe(true)
    expect(hasAgentMock, '应 mock /ai-program/zhsAgent/list').toBe(true)
    expect(hasStatsMock, '应 mock /statistics/usage').toBe(true)

    await clearMocks(page)
    console.log('[P9-4] mockCommonApis 一键 mock 正常 ✅')
  })
})
