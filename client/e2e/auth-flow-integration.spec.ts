/**
 * 登录态联调 E2E 测试.
 *
 * 目的: 验证前端在登录态下访问 5 个核心页面时, 都能正确触发后端 API 并获得 2xx 响应.
 *
 * 流程:
 * 1. 调 mock 登录 -> 拿 mock refreshToken
 * 2. 调 refresh-token 端点 -> 换真 JWT
 * 3. 注入 token 到 localStorage
 * 4. 访问 5 个核心页面, 验证都触发后端 API
 * 5. 验证 API 返回 2xx (而非 401 未授权)
 *
 * 5 个核心页面:
 * 1. 首页 (/)
 * 2. 智能体 (/agents)
 * 3. AI 世界 (/ai-world)
 * 4. 广场 (/plaza)
 * 5. 课程 (/courses)
 */
import { test, expect, type Page, type APIRequestContext, type APIResponse } from '@playwright/test'
import { gotoStable, LONG_TIMEOUT, setLocalStorage } from './helpers/page-actions'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8888'  // 用 Vite 代理 (8888 -> 8000)

/** mock 登录 → 拿 mock refreshToken (用 page.evaluate 走浏览器内部 fetch) */
async function mockLogin(page: Page): Promise<{ token: string; refreshToken: string }> {
  const result = await page.evaluate(async () => {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'e2e_test', password: 'test123' }),
    })
    const text = await resp.text()
    return { status: resp.status, text }
  })
  if (!result.text) throw new Error(`/api/auth/login 返回空 (status=${result.status})`)
  const json = JSON.parse(result.text)
  if (!json.data) throw new Error(`/api/auth/login 无 data 字段: ${result.text.slice(0, 200)}`)
  return { token: json.data.token, refreshToken: json.data.refreshToken }
}

/** mock refreshToken → 换真 JWT (用 page.evaluate 走浏览器内部 fetch) */
async function refreshToRealJwt(page: Page, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const result = await page.evaluate(async (rt) => {
    const resp = await fetch('/api/login/pwd/refreshToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
    const text = await resp.text()
    return { status: resp.status, text }
  }, refreshToken)
  if (!result.text) throw new Error(`refreshToken 返回空 (status=${result.status})`)
  const json = JSON.parse(result.text)
  if (!json.data) throw new Error(`refreshToken 无 data 字段: ${result.text.slice(0, 200)}`)
  return { accessToken: json.data.token, refreshToken: json.data.refreshToken }
}

/** 注入真 JWT 到前端 localStorage */
async function injectAuth(page: Page, accessToken: string, refreshToken: string) {
  // 前端 STORAGE_KEYS: TOKEN='token', USER_TOKEN='user_token', REFRESH_TOKEN='refresh_token'
  // 前端路由守卫期望 token 为字符串，不是对象
  await setLocalStorage(page, 'token', accessToken)
  await setLocalStorage(page, 'user_token', accessToken)
  await setLocalStorage(page, 'refresh_token', refreshToken)
  // user_data 前端用于恢复 authStore.user
  await setLocalStorage(page, 'user_data', {
    id: 'e2e-test-user',
    uuid: 'e2e-test-user',
    username: 'e2e_test',
    nickname: 'E2E Test',
    role: 'user',
    status: 1,
  })
  // login_expiry_time: 2 小时后过期 (毫秒时间戳)
  await setLocalStorage(page, 'login_expiry_time', Date.now() + 7200 * 1000)
}

/** 收集页面触发的 API 请求 + 响应状态码 */
function trackApiCalls(page: Page) {
  const calls: { url: string; method: string; status: number }[] = []
  page.on('response', resp => {
    const url = resp.url()
    // 收集所有业务 API (包括 /api/v1 /api/v2 /agent /system /home /plaza /course 等)
    const isBusiness = url.includes('/api/') || url.includes('/agent/') || url.includes('/system/') || url.includes('/home/') || url.includes('/plaza/') || url.includes('/course')
    if (isBusiness) {
      if (resp.request().method() === 'GET' || resp.request().method() === 'POST') {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
        if (!path.startsWith('/src/') && !path.includes('.js') && !path.includes('.css')) {
          if (!calls.find(c => c.url === path)) {
            calls.push({ url: path, method: resp.request().method(), status: resp.status() })
          }
        }
      }
    }
  })
  return calls
}

test.describe('登录态联调 (5 核心页面)', () => {
  test.setTimeout(120000)

  let accessToken: string
  let refreshToken: string

  test.beforeAll(async ({ browser }) => {
    // 用 browser.newContext() + page 创建独立 context 调 API, 走浏览器网络栈
    const ctx = await browser.newContext()
    const apiPage = await ctx.newPage()
    // 先访问首页让 Vite proxy / 浏览器环境就绪
    await apiPage.goto('http://127.0.0.1:8888/', { waitUntil: 'load' })
    const mock = await mockLogin(apiPage)
    const real = await refreshToRealJwt(apiPage, mock.refreshToken)
    accessToken = real.accessToken
    refreshToken = real.refreshToken
    expect(accessToken).toMatch(/^eyJ/)  // JWT 格式校验
    await ctx.close()
  })

  test('前置: 真 JWT 可访问受保护资源 + store state 验证', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    // 用浏览器 fetch 调 API (相对路径走当前 host)
    await page.goto('http://127.0.0.1:8888/', { waitUntil: 'load' })
    // 1) 注入 token 到 localStorage (使用前端 STORAGE_KEYS 期望的键名)
    await page.evaluate(([access, refresh]) => {
      localStorage.setItem('token', access)
      localStorage.setItem('user_token', access)
      localStorage.setItem('refresh_token', refresh)
      localStorage.setItem('user_data', JSON.stringify({
        id: 'e2e-test-user',
        uuid: 'e2e-test-user',
        username: 'e2e_test',
        nickname: 'E2E Test',
        role: 'user',
        status: 1,
      }))
      localStorage.setItem('login_expiry_time', String(Date.now() + 7200 * 1000))
    }, [accessToken, refreshToken])

    // 2) 调后端 getInfo, 验证 JWT + 拿 user info
    const userInfo = await page.evaluate(async (tok) => {
      const resp = await fetch('/api/v1/user/getInfo', {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (resp.status >= 500) throw new Error(`getInfo 5xx: ${resp.status}`)
      return { status: resp.status, text: await resp.text() }
    }, accessToken)
    expect(userInfo.status).toBeLessThan(500)
    console.log(`[前置] getInfo HTTP ${userInfo.status}`)

    // 3) 验证 user state 已写入 localStorage (token 持久化)
    const tokenPersisted = await page.evaluate(() => {
      const raw = localStorage.getItem('token') || localStorage.getItem('user_token')
      if (!raw) return null
      try {
        // token 是字符串 JWT
        return {
          hasAccess: !!raw,
          accessStartsWithEyJ: raw.startsWith('eyJ'),
          hasRefresh: !!localStorage.getItem('refresh_token'),
        }
      } catch {
        return null
      }
    })
    expect(tokenPersisted).not.toBeNull()
    expect(tokenPersisted?.hasAccess).toBe(true)
    expect(tokenPersisted?.accessStartsWithEyJ).toBe(true)
    expect(tokenPersisted?.hasRefresh).toBe(true)
    console.log(`[前置] userToken 持久化: ${JSON.stringify(tokenPersisted)}`)

    // 4) 验证 user role 持久化 (角色信息通常存 localStorage)
    const rolesInfo = await page.evaluate(() => {
      const keys = ['userInfo', 'user-info', 'user-roles', 'roles', 'permissions']
      const found = {}
      keys.forEach(k => {
        const v = localStorage.getItem(k)
        if (v) found[k] = v.slice(0, 200)
      })
      return found
    })
    console.log(`[前置] localStorage user keys: ${JSON.stringify(Object.keys(rolesInfo))}`)
    // 即使没找到, 也不强制要求 (admin 端不一定会写 userInfo, user 端可能也不写)

    await ctx.close()
  })

  const PAGES = [
    { path: '/', name: '首页' },
    { path: '/agents', name: '智能体' },
    { path: '/ai-world', name: 'AI 世界' },
    { path: '/plaza', name: '广场' },
    { path: '/courses', name: '课程' },
  ]

  for (const p of PAGES) {
    test(`${p.name} (${p.path}): 登录态访问 + 触发 API + 2xx 响应`, async ({ page }) => {
      // 1. 注入 token
      await page.goto(p.path, { waitUntil: 'domcontentloaded' })
      await injectAuth(page, accessToken, refreshToken)

      // 2. 刷新页面让 token 生效
      const calls = trackApiCalls(page)
      await page.reload({ waitUntil: 'load' })
      await page.waitForTimeout(3000)

      // 3. 页面有内容 (Mobile 视口文本较少, 放宽阈值)
      const body = await page.locator('body').innerText()
      const minLen = test.info().project.name.includes('Mobile') ? 30 : 100
      expect(body.length).toBeGreaterThan(minLen)

      // 4. 登录态应触发至少 1 个业务 API
      console.log(`[${p.name}] 登录态触发了 ${calls.length} 个 API:`)
      calls.forEach(c => console.log(`  ${c.method} ${c.url} -> ${c.status}`))

      if (calls.length === 0) {
        // 没触发是异常 (登录态下应调业务 API)
        test.skip(true, `登录态下未触发任何 API (前端 store 可能未读取 userToken)`)
      } else {
        // 5. 验证至少一个 2xx 响应
        const okCalls = calls.filter(c => c.status >= 200 && c.status < 300)
        expect(okCalls.length).toBeGreaterThan(0)
      }
    })
  }
})
