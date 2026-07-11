import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * E2E 共享 fixtures：提供已登录状态的 storageState 注入。
 *
 * 认证机制（与 src/stores/auth.ts、middleware.ts 对齐）：
 * - 登录接口：POST /api/auth/login/email，成功返回 { code: 0, data: { accessToken, ... } }
 * - token 写入 cookie `auth_token`（middleware 也会兜底读取 `token`）
 * - JWT payload 含 userId / roleId / role / exp；admin 判定：roleId >= 1
 *
 * 现有 34 个 spec 文件直接 `import { test } from '@playwright/test'`，不受本文件影响；
 * 需要登录态的新测试可 `import { test, expect } from './fixtures'` 并使用 authenticatedPage / adminPage。
 */

// 测试用户凭据（从环境变量读取，提供默认值，不硬编码敏感信息）
const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? 'test@ihui.ai',
  password: process.env.E2E_USER_PASSWORD ?? 'Test@123456',
}

const ADMIN_USER = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@ihui.ai',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@123456',
}

// storageState 文件路径
const USER_STORAGE_STATE = 'e2e/.auth/user.json'
const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json'

type Credentials = typeof TEST_USER

/**
 * 通过 UI 登录并保存 storageState。
 * 注意：邮箱登录表单含图形验证码（CaptchaCanvas），UI 流程可能不稳定，
 * 优先使用 apiLoginAndSaveStorageState；此函数保留用于端到端 UI 验证。
 */
async function loginAndSaveStorageState(
  page: Page,
  credentials: Credentials,
  storageStatePath: string,
) {
  await page.goto('/login')

  // 邮箱登录表单字段（见 src/components/login/EmailLogin.tsx）
  const emailInput = page.locator('input[type="email"], input#email-login-email').first()
  const passwordInput = page.locator('input[type="password"]').first()
  await emailInput.fill(credentials.email)
  await passwordInput.fill(credentials.password)

  // 提交（按钮文案可能为“登录”/“Sign in”）
  await page.getByRole('button', { name: /登录|登 录|sign in|login/i }).click()

  // 等待登录成功：跳转首页或 dashboard（避免 `'/' || regex` 恒为 '/' 的错误写法）
  await page.waitForURL(
    (url) => {
      const p = url.pathname
      return p === '/' || /\/dashboard/.test(p)
    },
    { timeout: 15000 },
  )

  // 保存 storageState（含 cookie / localStorage）
  await page.context().storageState({ path: storageStatePath })
}

/**
 * 通过 API 直接登录（更快，不经过 UI，绕过验证码）。
 * 调用真实接口 /api/auth/login/email，将 accessToken 写入 cookie。
 */
async function apiLoginAndSaveStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: Credentials,
  storageStatePath: string,
) {
  const response = await request.post(`${baseURL}/api/auth/login/email`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  })

  if (!response.ok()) {
    throw new Error(`登录请求失败: ${response.status()} ${response.statusText}`)
  }

  const body = (await response.json()) as {
    code?: number
    message?: string
    data?: { accessToken?: string; token?: string; userId?: string; refreshToken?: string }
    token?: string
    user?: unknown
  }

  // 后端约定 code === 0 表示成功
  if (body.code !== 0) {
    throw new Error(`登录业务失败: code=${body.code} message=${body.message ?? ''}`)
  }

  const token = body.data?.accessToken ?? body.data?.token ?? body.token
  if (!token) {
    throw new Error('登录响应缺少 token 字段')
  }

  const hostname = new URL(baseURL).hostname

  // 构建 storageState：cookie auth_token 是 middleware 真正读取的字段；
  // 同时写入 token 兜底（middleware getToken 兼容两个名称）。
  const storageState = {
    cookies: [
      {
        name: 'auth_token',
        value: token,
        domain: hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'token',
        value: token,
        domain: hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'token', value: token },
          { name: 'user', value: JSON.stringify(body.data ?? {}) },
        ],
      },
    ],
  }

  const dir = path.dirname(storageStatePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2))
}

/**
 * 确保 storageState 文件存在；若不存在则通过 API 登录创建。
 * 让 chromium project 下使用 authenticatedPage 的测试即使未预先执行 setup 也能跑通。
 */
async function ensureStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: Credentials,
  storageStatePath: string,
) {
  try {
    await fs.access(storageStatePath)
  } catch {
    await apiLoginAndSaveStorageState(request, baseURL, credentials, storageStatePath)
  }
}

// 扩展 test fixture，提供已登录的 page
// 仅新增 test 级 fixture authenticatedPage / adminPage；
// browser / request / baseURL 均直接复用 @playwright/test 内置 fixture
const test = base.extend<{ authenticatedPage: Page; adminPage: Page }>({
  authenticatedPage: async ({ browser, request, baseURL }, use) => {
    await ensureStorageState(request, baseURL ?? '', TEST_USER, USER_STORAGE_STATE)
    const context = await browser.newContext({ storageState: USER_STORAGE_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser, request, baseURL }, use) => {
    await ensureStorageState(request, baseURL ?? '', ADMIN_USER, ADMIN_STORAGE_STATE)
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

// 导出 test（与 @playwright/test 的 test 兼容，现有 spec 无需改动）
export const setupTest = test

// 导出登录辅助函数与路径
export {
  loginAndSaveStorageState,
  apiLoginAndSaveStorageState,
  ensureStorageState,
  TEST_USER,
  ADMIN_USER,
  USER_STORAGE_STATE,
  ADMIN_STORAGE_STATE,
}

// 重新导出 expect 方便使用
export { expect }
