/**
 * TagsView 探查脚本：输出 DOM 结构和样式信息。
 * 运行: npx playwright test e2e/tagsview-debug.ts --reporter=list
 */
import { test, expect } from '@playwright/test'

test('探查 TagsView DOM 结构和样式', async ({ page }) => {
  // API 登录
  const resp = await page.request.post('http://localhost:8801/api/auth/login', {
    data: { account: 'admin', password: 'admin123' },
  })
  const body = (await resp.json()) as any
  const token = body.data?.accessToken ?? body.data?.token

  // 设置 cookie
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  // 导航到首页
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // 导航到其他页面生成标签
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // 探查所有 a 标签
  const allLinks = page.locator('a[href]')
  const count = await allLinks.count()
  console.log(`\n共找到 ${count} 个 a[href] 标签:`)

  for (let i = 0; i < count; i++) {
    const link = allLinks.nth(i)
    const href = await link.getAttribute('href')
    const text = await link.textContent()
    const tagName = await link.evaluate((el) => el.tagName)
    const className = await link.evaluate((el) => el.className)
    const display = await link.evaluate((el) => window.getComputedStyle(el).display)
    const fontSize = await link.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize))
    const outline = await link.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`
    })
    const bg = await link.evaluate((el) => window.getComputedStyle(el).backgroundColor)

    // 只打印文本较短的（可能是标签栏）
    const textLen = text?.trim().length ?? 0
    if (textLen > 0 && textLen < 30) {
      console.log(
        `  [${i}] href="${href}" text="${text?.trim()}" fontSize=${fontSize}px outline=${outline} bg=${bg} className=${className?.slice(0, 100)}...`,
      )
    }
  }

  // 特别检查 text-xs 的标签
  console.log('\n--- 检查 text-xs 的标签 ---')
  const smallLinks = page.locator('a.text-xs, a[class*="text-xs"]')
  const smallCount = await smallLinks.count()
  console.log(`text-xs 标签数: ${smallCount}`)
  for (let i = 0; i < smallCount; i++) {
    const link = smallLinks.nth(i)
    const href = await link.getAttribute('href')
    const text = await link.textContent()
    const className = await link.evaluate((el) => el.className)
    const outline = await link.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`
    })
    const bg = await link.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    const hasOutline = className?.includes('outline') ?? false
    console.log(
      `  href="${href}" text="${text?.trim()}" hasOutlineClass=${hasOutline} outline=${outline} bg=${bg}`,
    )
    console.log(`  className: ${className}`)
  }

  // 检查 color-scheme
  const colorScheme = await page.evaluate(() => {
    const html = document.documentElement
    const style = window.getComputedStyle(html)
    return {
      colorScheme: style.colorScheme,
      bg: style.backgroundColor,
      color: style.color,
    }
  })
  console.log(`\ncolor-scheme: ${colorScheme.colorScheme}`)
  console.log(`html bg: ${colorScheme.bg}, color: ${colorScheme.color}`)

  // 检查 --color-border CSS 变量
  const borderColor = await page.evaluate(() => {
    const el = document.querySelector('a[href="/"]')
    if (!el) return 'no element found'
    const style = window.getComputedStyle(el)
    return style.getPropertyValue('--color-border') || 'not set'
  })
  console.log(`--color-border on a[href="/"]: ${borderColor}`)

  // 检查是否有暗色模式
  const isDark = await page.evaluate(() => {
    return (
      document.documentElement.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-mode')
    )
  })
  console.log(`is dark mode: ${isDark}`)
})
