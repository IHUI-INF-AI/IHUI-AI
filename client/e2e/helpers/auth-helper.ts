/**
 * 登录态设置工具
 * 通过 localStorage 模拟已登录用户，避免真实登录流程
 */

import type { Page, APIRequestContext } from '@playwright/test'
import { setLocalStorage, removeLocalStorage } from './page-actions'

export interface MockUser {
  uuid: string
  username: string
  email?: string
  phone?: string
  isVip?: boolean
  status?: number
}

export const MOCK_USER_KEY = 'user_data'
export const MOCK_TOKEN_KEY = 'user_token'
export const MOCK_LOGIN_EXPIRY = 'login_expiry_time'
export const MOCK_LOGIN_DURATION = 'login_duration'

/** 默认后端地址 */
const DEFAULT_BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 默认测试账号 */
const TEST_USERNAME = 'integration_test'
const TEST_PASSWORD = 'test123456'

/** token 缓存 (同一进程内复用, 避免重复登录) */
let _cachedToken: string | null = null

/**
 * 真实登录后端拿 JWT token (含 3 次重试 + 500ms 间隔, 避免 flaky)
 * 支持两种调用方式: 传 APIRequestContext (API 测试) 或传 Page (UI 测试)
 */
export async function fetchTokenWithRetry(
  requestOrPage: APIRequestContext | Page,
  backend: string = DEFAULT_BACKEND
): Promise<string> {
  if (_cachedToken) return _cachedToken
  const request = (requestOrPage as { request?: APIRequestContext }).request
    ? (requestOrPage as { request: APIRequestContext }).request
    : (requestOrPage as APIRequestContext)
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await request.post(`${backend}/api/v1/auth/login`, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        data: { username: TEST_USERNAME, password: TEST_PASSWORD },
      })
      if (resp.status() === 200) {
        const body = await resp.json()
        _cachedToken = body?.data?.token || body?.data?.access_token || ''
        if (_cachedToken) return _cachedToken
      }
    } catch {
      // 重试
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return ''
}

/**
 * 清除 token 缓存
 *
 * 使用场景:
 * - 测试 "登出后再登录" 场景时, 需要先调用本函数清空旧 token, 否则 fetchTokenWithRetry 会直接返回缓存的旧 token
 * - 测试 "token 失效后刷新" 场景时同理
 * - 普通测试无需调用, 缓存复用可避免重复登录, 提升测试速度
 */
export function clearTokenCache(): void {
  _cachedToken = null
}

export async function setLoggedIn(page: Page, user: MockUser = { uuid: 'u-test', username: 'tester' }) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000
  await setLocalStorage(page, MOCK_TOKEN_KEY, 'mock-token-abc123')
  await setLocalStorage(page, MOCK_LOGIN_EXPIRY, expiry)
  await setLocalStorage(page, MOCK_LOGIN_DURATION, 24 * 60 * 60 * 1000)
  await setLocalStorage(page, MOCK_USER_KEY, {
    ...user,
    status: user.status ?? 1,
    isVip: user.isVip ?? false,
    loginTime: new Date().toISOString(),
    lastActiveTime: new Date().toISOString(),
  })
}

export async function setLoggedOut(page: Page) {
  await removeLocalStorage(page, MOCK_TOKEN_KEY)
  await removeLocalStorage(page, MOCK_USER_KEY)
  await removeLocalStorage(page, MOCK_LOGIN_EXPIRY)
  await removeLocalStorage(page, MOCK_LOGIN_DURATION)
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const token = await page.evaluate((k: string) => localStorage.getItem(k), MOCK_TOKEN_KEY)
  return token !== null
}
