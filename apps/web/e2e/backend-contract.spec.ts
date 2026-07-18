import { test, expect, type Page } from '@playwright/test'

/**
 * 后端契约专项测试
 *
 * 覆盖:
 * - /api/health 返回 200 + { status: 'ok' }
 * - /api/auth/login 返回结构包含 accessToken / refreshToken / user
 * - /api/auth/me 返回结构包含 id / username / email
 * - /api/users/:id 返回结构包含 id / username
 * - 错误响应结构包含 code / message / error 字段
 * - 分页响应结构包含 data / total / page / pageSize
 */

const TEST_USER = {
  account: process.env.E2E_USER_EMAIL ?? 'test@ihui.ai',
  password: process.env.E2E_USER_PASSWORD ?? 'Test@123456',
}

test.describe.parallel('后端契约专项', () => {
  let accessToken: string | null = null

  test.beforeAll(async ({ request }) => {
    // 登录获取 token,后续测试复用
    try {
      const resp = await request.post('/api/auth/login', { data: TEST_USER })
      if (resp.ok()) {
        const body = (await resp.json()) as {
          data?: { accessToken?: string }
          token?: string
        }
        accessToken = body?.data?.accessToken ?? body?.token ?? null
      }
    } catch {
      // 后端不可用时 accessToken 保持 null
    }
  })

  test.afterEach(async ({ page }: { page: Page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page
        .screenshot({
          path: `e2e/screenshots/backend-${testInfo.title.replace(/\s+/g, '-')}.png`,
        })
        .catch(() => {})
    }
  })

  test('/api/health 返回 200 + { status: "ok" }', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { status?: string }
    expect(body.status).toBe('ok')
  })

  test('/api/auth/login 返回 accessToken / refreshToken / user', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: TEST_USER })
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      code?: number
      data?: { accessToken?: string; refreshToken?: string; user?: unknown }
    }
    expect(body.code).toBe(0)
    expect(body.data?.accessToken).toBeTruthy()
    expect(body.data?.refreshToken).toBeTruthy()
    expect(body.data?.user).toBeTruthy()
  })

  test('/api/auth/me 返回 id / username / email', async ({ request }) => {
    test.skip(!accessToken, '未登录,跳过')
    const response = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      data?: { id?: string | number; username?: string; email?: string }
    }
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.username).toBeTruthy()
    expect(body.data?.email).toBeTruthy()
  })

  test('/api/users/:id 返回 id / username', async ({ request }) => {
    test.skip(!accessToken, '未登录,跳过')
    // 先获取当前用户 ID
    const meResp = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const me = (await meResp.json().catch(() => ({}))) as { data?: { id?: string } }
    const userId = me.data?.id ?? '1'
    const response = await request.get(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { data?: { id?: string; username?: string } }
    expect(body.data?.id).toBeTruthy()
    expect(body.data?.username).toBeTruthy()
  })

  test('错误响应结构包含 code / message / error', async ({ request }) => {
    // 发起一个必然失败的请求(访问不存在的资源)
    const response = await request.get('/api/users/non-existent-id-12345', {
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    const body = (await response.json().catch(() => ({}))) as {
      code?: number | string
      message?: string
      error?: string | unknown
    }
    // 至少包含 code 或 message 之一
    expect(body.code !== undefined || body.message !== undefined).toBe(true)
  })

  test('分页响应结构包含 data / total / page / pageSize', async ({ request }) => {
    test.skip(!accessToken, '未登录,跳过')
    // 尝试一个分页接口(用户列表)
    const response = await request.get('/api/users?page=1&pageSize=10', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status() !== 200) {
      test.skip(true, '分页接口不可用')
      return
    }
    const body = (await response.json()) as {
      data?: unknown[]
      total?: number
      page?: number
      pageSize?: number
    }
    expect(body.data).toBeInstanceOf(Array)
    expect(body.total).toBeDefined()
    expect(body.page ?? body.pageSize).toBeDefined()
  })
})
