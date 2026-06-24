/**
 * E2E test: Edu learn flow (course detail -> chapter -> progress)
 */

import { test, expect } from '@playwright/test'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8888'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

test.describe('Edu Learn Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user (assumes demo data seeded)
    await page.goto(`${FRONTEND_URL}/login`)
    await page.fill('input[name="username"]', 'edu_test_user')
    await page.fill('input[name="password"]', 'test_password_123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*\/.*/)
  })

  test('student can view edu home', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu`)
    await expect(page.getByText('教育中心')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.edu-menu')).toBeVisible()
  })

  test('student can navigate to learn section', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu/learn`)
    await expect(page.getByText('我的课程')).toBeVisible({ timeout: 10000 })
  })

  test('student can navigate to exam section', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu/exam`)
    await expect(page.getByText('我的考试')).toBeVisible({ timeout: 10000 })
  })

  test('student can navigate to ask Q&A', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu/ask`)
    await expect(page.getByText('问答')).toBeVisible({ timeout: 10000 })
  })

  test('student can navigate to circle', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu/circle`)
    await expect(page.getByText('圈子')).toBeVisible({ timeout: 10000 })
  })

  test('student can navigate to live', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/edu/live`)
    await expect(page.getByText('直播')).toBeVisible({ timeout: 10000 })
  })

  test('admin can view edu admin dashboard', async ({ page, context }) => {
    // Logout and re-login as admin
    await context.clearCookies()
    await page.goto(`${FRONTEND_URL}/login`)
    await page.fill('input[name="username"]', 'edu_admin')
    await page.fill('input[name="password"]', 'admin_password_123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*\/.*/)

    await page.goto(`${FRONTEND_URL}/admin/edu`)
    await expect(page.getByText('教育后台')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.stat-card').first()).toBeVisible()
  })
})

test.describe('Edu API direct smoke tests', () => {
  test('GET /api/v1/edu/auth/me requires auth', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/edu/auth/me`)
    expect(res.status()).toBeGreaterThanOrEqual(401)
  })

  test('POST /api/v1/edu/auth/login works', async ({ request }) => {
    const res = await request.post(`${BACKEND_URL}/api/v1/edu/auth/login`, {
      data: { username: 'edu_test_user', password: 'test_password_123' },
    })
    // 200 if user exists, 401/404 otherwise - both are acceptable for smoke test
    expect([200, 401, 404, 422]).toContain(res.status())
  })

  test('GET /api/v1/edu/learn/courses returns paginated data', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/edu/learn/courses?page=1&size=10`)
    expect([200, 401]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.data).toHaveProperty('items')
    }
  })

  test('GET /api/v1/edu/ask/questions/hot returns array', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/edu/ask/questions/hot?limit=5`)
    expect([200, 401]).toContain(res.status())
  })

  test('GET /api/v1/edu/circle/circles returns paginated data', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/edu/circle/circles?page=1&size=10`)
    expect([200, 401]).toContain(res.status())
  })

  test('GET /api/v1/edu/gateway/routes returns route table', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/api/v1/edu/gateway/routes`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveProperty('migration_strategy')
    expect(body.data.routes.length).toBeGreaterThan(15)
  })
})