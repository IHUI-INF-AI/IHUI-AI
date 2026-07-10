/**
 * P9-4 API Mock 服务统一化 - 通用 Mock Server Helper
 *
 * 提供统一的 API Mock 能力，供所有 e2e 测试复用：
 * - mockApi: 通用 API 拦截（支持 string/RegExp 路径匹配）
 * - mockApiResponse: 标准响应格式封装
 * - mockApiError: 错误响应封装
 * - mockApiList: 列表分页响应封装
 * - clearMocks: 清除所有 mock
 * - mockCommonApis: 一键 mock 常用接口（用户/智能体/统计）
 */

import type { Page } from '@playwright/test'

/** 标准 API 响应格式 */
export interface ApiMockResponse<T = unknown> {
  code: number
  success: boolean
  message: string
  data: T
  timestamp: number
}

/** 列表分页响应数据 */
export interface PaginatedData<T> {
  list: T[]
  pageNum: number
  pageSize: number
  total: number
  totalPages: number
}

/** 请求信息 */
export interface MockRequest {
  url: string
  method: string
  body?: unknown
  headers: Record<string, string>
}

/** 响应体类型 */
export type ResponseBody<T = unknown> = T | ((req: MockRequest) => T)

/** 创建标准成功响应 */
export function successResponse<T>(data: T, message = 'OK'): ApiMockResponse<T> {
  return {
    code: 200,
    success: true,
    message,
    data,
    timestamp: Date.now(),
  }
}

/** 创建标准错误响应 */
export function errorResponse(code: number, message: string): ApiMockResponse<null> {
  return {
    code,
    success: false,
    message,
    data: null,
    timestamp: Date.now(),
  }
}

/** 创建分页列表响应数据 */
export function paginatedData<T>(list: T[], pageNum = 1, pageSize = 20): PaginatedData<T> {
  return {
    list,
    pageNum,
    pageSize,
    total: list.length,
    totalPages: Math.ceil(list.length / pageSize) || 1,
  }
}

/** 通用 API 拦截 */
export async function mockApi<T = unknown>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | '*',
  path: string | RegExp,
  responseBody: ResponseBody<T>,
  options: { status?: number; delay?: number } = {}
): Promise<void> {
  await page.route(
    (url) => {
      const u = url.toString()
      if (typeof path === 'string') return u.includes(path)
      return path.test(u)
    },
    async (route) => {
      const req = route.request()
      if (method !== '*' && req.method() !== method) {
        await route.continue()
        return
      }

      if (options.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay))
      }

      const postData = req.postData()
      let body: unknown
      try {
        body = postData ? JSON.parse(postData) : undefined
      } catch {
        body = postData
      }

      const mockReq: MockRequest = {
        url: req.url(),
        method: req.method(),
        body,
        headers: req.headers(),
      }

      const data = typeof responseBody === 'function' ? responseBody(mockReq) : responseBody
      const response = successResponse(data)

      await route.fulfill({
        status: options.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    }
  )
}

/** Mock API 错误响应 */
export async function mockApiError(
  page: Page,
  path: string | RegExp,
  code: number,
  message: string,
  httpStatus = 200
): Promise<void> {
  await page.route(
    (url) => {
      const u = url.toString()
      if (typeof path === 'string') return u.includes(path)
      return path.test(u)
    },
    async (route) => {
      await route.fulfill({
        status: httpStatus,
        contentType: 'application/json',
        body: JSON.stringify(errorResponse(code, message)),
      })
    }
  )
}

/** Mock 列表分页接口 */
export async function mockApiList<T>(
  page: Page,
  path: string | RegExp,
  list: T[],
  options: { pageNum?: number; pageSize?: number; method?: 'GET' | 'POST' } = {}
): Promise<void> {
  const { pageNum = 1, pageSize = 20, method = 'GET' } = options
  await mockApi(page, method, path, () => paginatedData(list, pageNum, pageSize))
}

/** 清除所有 mock */
export async function clearMocks(page: Page): Promise<void> {
  await page.unrouteAll()
}

/** 常用 mock 数据 */
export const CommonMockData = {
  user: {
    id: 'mock-user-001',
    uuid: 'mock-uuid-001',
    username: 'testuser',
    nickname: '测试用户',
    avatar: '',
    email: 'test@example.com',
    phone: '13800138000',
    vipLevel: 0,
    createdAt: '2024-01-01T00:00:00Z',
  },
  token: {
    accessToken: 'mock-access-token-xxx',
    refreshToken: 'mock-refresh-token-yyy',
    expiresIn: 7200,
  },
  agents: [
    { id: 'agent-001', name: '智能客服', description: 'AI 客服助手', status: 'active' },
    { id: 'agent-002', name: '代码助手', description: 'AI 代码助手', status: 'active' },
    { id: 'agent-003', name: '写作助手', description: 'AI 写作助手', status: 'active' },
  ],
  statistics: {
    chatCount: 128,
    usagePercent: 65,
    tokenUsed: 128000,
    tokenTotal: 200000,
  },
} as const

/** 一键 mock 常用接口 */
export async function mockCommonApis(page: Page): Promise<void> {
  await mockApi(page, 'GET', '/user/info', CommonMockData.user)
  await mockApi(page, 'POST', '/login/pwd', CommonMockData.token)
  await mockApi(page, 'GET', '/ai-program/zhsAgent/list', CommonMockData.agents)
  await mockApi(page, 'GET', '/statistics/usage', CommonMockData.statistics)
}
