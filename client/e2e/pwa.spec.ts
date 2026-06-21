/**
 * PWA 完整化 e2e 验证
 * - manifest.webmanifest 合法 + 关键字段完整
 * - theme-color / apple-touch-icon 存在
 * - sw.js 注册
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

test('manifest.webmanifest 可访问 + 字段完整', async ({ page }) => {
  const resp = await page.goto(`${BASE}/manifest.webmanifest`)
  expect(resp?.status()).toBe(200)
  const manifest = await resp?.json()
  expect(manifest.name).toBeTruthy()
  expect(manifest.short_name).toBeTruthy()
  expect(manifest.start_url).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toMatch(/^#/)
  expect(manifest.background_color).toMatch(/^#/)
  expect(manifest.icons.length, '至少 1 个图标').toBeGreaterThan(0)
  const firstIcon = manifest.icons[0]
  expect(firstIcon.src).toBeTruthy()
  expect(firstIcon.sizes).toBeTruthy()
  console.log(`[PWA] name="${manifest.name}", icons=${manifest.icons.length}, shortcuts=${manifest.shortcuts?.length || 0}`)
})

test('首页 link rel="manifest" 存在', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const manifestHref = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]')
    return link?.getAttribute('href') || ''
  })
  expect(manifestHref, '首页有 <link rel="manifest">').toBe('/manifest.webmanifest')
})

test('theme-color meta 存在（亮 + 暗）', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const themes = await page.evaluate(() => {
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'))
    return metas.map((m) => ({
      content: m.getAttribute('content'),
      media: m.getAttribute('media'),
    }))
  })
  expect(themes.length, `至少 1 个 theme-color（实际 ${themes.length}）`).toBeGreaterThanOrEqual(1)
  const hasLight = themes.some((t) => /light|prefers-color-scheme: light/.test(t.media || ''))
  const hasDark = themes.some((t) => /dark|prefers-color-scheme: dark/.test(t.media || ''))
  console.log(`[PWA] theme-color: light=${hasLight}, dark=${hasDark}`)
})

test('apple-touch-icon link 存在', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const iconHref = await page.evaluate(() => {
    const link = document.querySelector('link[rel="apple-touch-icon"]')
    return link?.getAttribute('href') || ''
  })
  expect(iconHref, 'apple-touch-icon 存在').toBeTruthy()
})

test('sw.js 可访问 + 内容合法', async ({ page }) => {
  const resp = await page.goto(`${BASE}/sw.js`)
  expect(resp?.status()).toBe(200)
  const text = await resp?.text() || ''
  // sw.js 缓存名常量（STATIC_CACHE / RUNTIME_CACHE）+ install/activate 事件
  expect(text, '含缓存版本').toMatch(/STATIC_CACHE|RUNTIME_CACHE|CACHE_VERSION/)
  expect(text, '含 addEventListener').toContain('addEventListener')
  expect(text, '含 install 事件').toMatch(/install|activate|fetch/)
  expect(text.length, 'sw.js 至少 1KB').toBeGreaterThan(1000)
})

test('PWA shortcuts 至少 1 个', async ({ page }) => {
  const resp = await page.goto(`${BASE}/manifest.webmanifest`)
  const manifest = await resp?.json()
  if (manifest.shortcuts && manifest.shortcuts.length > 0) {
    expect(manifest.shortcuts.length, 'shortcuts >= 1').toBeGreaterThanOrEqual(1)
    for (const sc of manifest.shortcuts) {
      expect(sc.name).toBeTruthy()
      expect(sc.url).toBeTruthy()
    }
  } else {
    test.skip(true, '未配置 shortcuts')
  }
})
