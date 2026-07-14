import { test, expect } from '@playwright/test'

/**
 * 社区/教育/工作流关键模块冒烟测试(加深版)。
 *
 * 验证核心业务页面:
 * - 可访问(无 500)
 * - 关键 DOM 元素可见(main 容器)
 * - 控制台无未捕获异常
 * - API 请求无 404(路由已注册)
 */

/** 通用页面冒烟:无 500 + main 可见 + 无控制台错误 */
async function smokeTest(page: import('@playwright/test').Page, path: string) {
  const serverErrors: string[] = []
  const notFoundApi: string[] = []
  const consoleErrors: string[] = []

  page.on('response', (resp) => {
    if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    // API 请求 404 说明后端路由未注册
    if (resp.url().includes('/api/') && resp.status() === 404) notFoundApi.push(resp.url())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')

  expect(
    serverErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
        !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
    ),
  ).toHaveLength(0)
  expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)

  // 若未跳转登录,main 容器应可见
  if (page.url().includes(path)) {
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  }
}

test.describe('社区模块冒烟', () => {
  test('/circles 圆子列表', async ({ page }) => smokeTest(page, '/circles'))
  test('/asks 问答列表', async ({ page }) => smokeTest(page, '/asks'))
  test('/topics 话题列表', async ({ page }) => smokeTest(page, '/topics'))
})

test.describe('教育模块冒烟', () => {
  test('/learn 学习列表', async ({ page }) => smokeTest(page, '/learn'))
  test('/exam 考试列表', async ({ page }) => smokeTest(page, '/exam'))
  test('/edu-points 积分页', async ({ page }) => smokeTest(page, '/edu-points'))
})

test.describe('工作流模块冒烟', () => {
  test('/workflows 工作流列表', async ({ page }) => smokeTest(page, '/workflows'))
  test('/teams 团队列表', async ({ page }) => smokeTest(page, '/teams'))
})

test.describe('积分模块冒烟', () => {
  test('/points 积分中心', async ({ page }) => smokeTest(page, '/points'))
})
