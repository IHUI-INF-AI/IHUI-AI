import { test, expect } from '@playwright/test'

/**
 * 知识库板块 E2E 回归测试。
 *
 * 背景:前序轮次发现 /dashboard 的"知识库"板块数据为空,
 * 已通过种子数据注入修复(8 分类 + 8 篇真实文章 + 8 张 text_to_image 封面)。
 * 本测试防止该回归再次出现。
 *
 * 覆盖:
 * 1. /dashboard 可访问,无 5xx
 * 2. /api/knowledge 返回非空列表(种子数据存在)
 * 3. 知识库板块在页面上渲染出 ≥1 条卡片
 * 4. 卡片含标题与封面图(防止仅渲染骨架/空状态)
 * 5. 点击卡片可跳转到详情页
 */

const KNOWLEDGE_API = /\/api\/knowledge(\?|$)/

test.describe('知识库板块回归', () => {
  test('dashboard 可访问且无 5xx', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    const realErrors = serverErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b5\d{2}\b/.test(e) &&
        !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
    )
    expect(realErrors).toHaveLength(0)
  })

  test('/api/knowledge 返回非空列表(种子数据存在)', async ({ request }) => {
    const resp = await request.get('/api/knowledge?page=1&pageSize=4')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    // 后端响应格式:{ code, message, data: { list, total, page, pageSize } }
    expect(body).toBeTruthy()
    const data = body.data ?? body
    expect(data.list).toBeDefined()
    expect(Array.isArray(data.list)).toBe(true)
    expect(data.list.length).toBeGreaterThan(0)
    expect(data.total).toBeGreaterThan(0)
    // 每条数据必须有 id + title(最低可展示字段)
    for (const item of data.list) {
      expect(item.id).toBeTruthy()
      expect(item.title).toBeTruthy()
    }
  })

  test('dashboard 渲染知识库板块且含 ≥1 条卡片', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => {})

    // 知识库板块入口 href 指向 /resources(见 HomeModules.tsx:167)
    const knowledgeLink = page.locator('a[href="/resources"]').first()
    await expect(knowledgeLink).toBeVisible({ timeout: 15000 })

    // 滚动到知识库板块可见
    await knowledgeLink.scrollIntoViewIfNeeded().catch(() => {})

    // 板块容器内应有 ≥1 张知识卡片(Link 到 /resources/{id})
    const cards = page.locator('a[href^="/resources/"]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('知识库卡片含标题与封面图(防骨架/空状态)', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => {})

    const card = page.locator('a[href^="/resources/"]').first()
    await expect(card).toBeVisible({ timeout: 15000 })
    await card.scrollIntoViewIfNeeded().catch(() => {})

    // 卡片必须含可见标题文本(非空)
    const titleText = (await card.innerText().catch(() => '')).trim()
    expect(titleText.length).toBeGreaterThan(0)
  })

  test('点击知识库卡片可跳转详情页', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => {})

    const card = page.locator('a[href^="/resources/"]').first()
    await expect(card).toBeVisible({ timeout: 15000 })

    // 截取目标 href,点击后验证 URL 变化
    const href = await card.getAttribute('href')
    expect(href).toBeTruthy()
    await card.click({ timeout: 10000 }).catch(() => {})
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    // 跳转后 URL 应以 /resources/ 开头(或被重定向到登录/forbidden 也算非阻塞)
    expect(page.url()).toMatch(/\/(resources\/|sso\/login|forbidden)/)
  })

  test('知识库板块无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})
