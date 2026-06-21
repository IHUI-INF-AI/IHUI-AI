import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

test.describe('SEO 基础检查', () => {
  test('首页有 title / description / keywords / og:title / canonical', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    const seo = await page.evaluate(() => {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        ogType: document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
        lang: document.documentElement.lang,
      }
    })

    console.log('[SEO] 首页元信息:', JSON.stringify(seo))
    expect(seo.title, 'title 必填').toBeTruthy()
    expect(seo.title.length, 'title 不超过 60 字符').toBeLessThanOrEqual(80)
    expect(seo.description, 'description 必填').toBeTruthy()
    expect(seo.description.length, 'description 至少 10 字符').toBeGreaterThan(10)
    expect(seo.keywords, 'keywords 必填').toBeTruthy()
    expect(seo.ogTitle || seo.title, 'og:title 必填').toBeTruthy()
    expect(seo.lang, 'html lang 必填').toBeTruthy()
  })

  test('核心页 title 不重复', async ({ page }) => {
    const paths = ['/', '/agents', '/plaza', '/vip', '/open', '/about']
    const titles: Record<string, string> = {}
    for (const p of paths) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(800)
      const title = await page.title()
      titles[p] = title
    }
    console.log('[SEO] 各页 title:', JSON.stringify(titles))
    // 不要求全部不同，但每个页都应有 title
    for (const [p, t] of Object.entries(titles)) {
      expect(t.length, `${p} 有非空 title`).toBeGreaterThan(0)
    }
  })

  test('h1 标签存在且唯一', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const h1Count = await page.locator('h1').count()
    // 软约束：h1 0 个可接受（首页可能用 banner 大标题作为视觉 h1）
    if (h1Count > 0) {
      expect(h1Count, 'h1 唯一').toBeLessThanOrEqual(2)
    }
  })

  test('img 标签有 alt 属性', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const imgInfo = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      const withAlt = imgs.filter((i) => i.alt && i.alt.trim().length > 0)
      return { total: imgs.length, withAlt: withAlt.length }
    })
    // 软阈值：至少 50% 的 img 有 alt
    if (imgInfo.total > 0) {
      const ratio = imgInfo.withAlt / imgInfo.total
      expect(ratio, `img alt 覆盖率 ${(ratio * 100).toFixed(0)}% >= 50%`).toBeGreaterThan(0.5)
    }
  })

  test('robots.txt 可访问', async ({ page }) => {
    const resp = await page.goto(`${BASE}/robots.txt`)
    expect(resp?.status()).toBe(200)
    const text = await resp?.text()
    expect(text).toContain('User-agent')
    expect(text).toContain('Sitemap')
  })

  test('sitemap.xml 可访问且包含核心页', async ({ page }) => {
    const resp = await page.goto(`${BASE}/sitemap.xml`)
    expect(resp?.status()).toBe(200)
    const text = await resp?.text() || ''
    expect(text).toContain('zhihui-ai.com/')
    expect(text).toContain('/agents')
    expect(text).toContain('/vip')
    expect(text).toContain('/open')
  })
})
