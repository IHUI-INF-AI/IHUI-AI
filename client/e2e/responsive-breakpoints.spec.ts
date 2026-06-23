import { test, expect } from '@playwright/test'

// 环境噪声过滤
const NOISE_PATTERNS = ['WebSocket', 'vite', 'ws://', 'wss://', 'Failed to fetch', 'NetworkError', 'ERR_CONNECTION', 'net::ERR', 'favicon', 'service-worker', 'ResizeObserver']
const isNoise = (t: string) => NOISE_PATTERNS.some(p => t.includes(p))

// 在所有测试前设置 localStorage,阻止推广弹窗显示
test.beforeEach(async ({ page: p }) => {
  await p.addInitScript(() => {
    localStorage.setItem('promotion-modal-dismissed-time', Date.now().toString())
    sessionStorage.setItem('promotion-modal-session-shown', 'true')
  })
})

// 需要测试的页面列表
const PAGES = [
  { name: '首页', path: '/' },
  { name: '工具', path: '/tools' },
  { name: 'VIP', path: '/vip' },
  { name: '关于', path: '/about' },
  { name: '需求广场', path: '/plaza' },
  { name: '学习AI', path: '/learn-ai' },
  { name: '登录', path: '/login' },
  { name: 'AI世界', path: '/ai-world' },
  { name: '排行榜', path: '/ranking' },
  { name: 'Agent', path: '/agents' },
]

// 检查页面在指定尺寸下的样式问题
async function checkPageAtViewport(p: import('@playwright/test').Page, pageName: string, path: string) {
  const issues: string[] = []

  await p.goto(path, { waitUntil: 'domcontentloaded' })
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(2500)

  // 1. 检查水平溢出
  const hasHorizontalScroll = await p.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  })
  if (hasHorizontalScroll) {
    const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await p.evaluate(() => document.documentElement.clientWidth)
    issues.push(`水平溢出: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`)
  }

  // 2. 检查 #app 可见性
  const appVisible = await p.evaluate(() => {
    const app = document.getElementById('app')
    if (!app) return false
    const cs = getComputedStyle(app)
    const rect = app.getBoundingClientRect()
    return cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
  })
  if (!appVisible) {
    issues.push('#app 不可见')
  }

  // 3. 检查文字过小 (< 12px),跳过 font-size:0 的容器(消除空白间距技巧)
  const smallTexts = await p.evaluate(() => {
    const results: string[] = []
    const elements = document.querySelectorAll('p, span, a, button, label, h1, h2, h3, h4, h5, h6, div, li, td, th')
    let count = 0
    for (const el of elements) {
      if (count >= 5) break
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (rect.width === 0 || rect.height === 0) continue
      const fontSize = parseFloat(cs.fontSize)
      // 跳过 font-size:0 的容器(这是消除 inline-block 空白间距的技巧,子元素有自己的 font-size)
      if (fontSize === 0) continue
      if (fontSize < 12 && el.textContent && el.textContent.trim().length > 0) {
        results.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)} fontSize=${fontSize}px text="${el.textContent.trim().slice(0, 15)}"`)
        count++
      }
    }
    return results
  })
  if (smallTexts.length > 0) {
    issues.push(`文字过小: ${smallTexts.join(' | ')}`)
  }

  // 4. 检查按钮过矮 (< 28px)
  const smallButtons = await p.evaluate(() => {
    const results: string[] = []
    const buttons = document.querySelectorAll('button, .el-button, a.btn, [role="button"]')
    let count = 0
    for (const btn of buttons) {
      if (count >= 5) break
      const cs = getComputedStyle(btn)
      const rect = btn.getBoundingClientRect()
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.height < 28 && btn.textContent && btn.textContent.trim().length > 0) {
        results.push(`${btn.tagName.toLowerCase()}.${btn.className.toString().slice(0, 30)} height=${rect.height}px text="${btn.textContent.trim().slice(0, 15)}"`)
        count++
      }
    }
    return results
  })
  if (smallButtons.length > 0) {
    issues.push(`按钮过矮: ${smallButtons.join(' | ')}`)
  }

  // 5. 检查元素重叠 (检查 header 是否遮挡 main 的第一个可见子元素)
  const headerOverlap = await p.evaluate(() => {
    const header = document.querySelector('.glass-header, header, .app-header')
    if (!header) return { overlap: false, info: 'no header' }
    const headerRect = header.getBoundingClientRect()
    const cs = getComputedStyle(header)
    if (cs.position !== 'fixed' && cs.position !== 'sticky') return { overlap: false, info: 'not fixed' }

    // 找到 main 元素
    const main = document.querySelector('main.main-content, .main-content, main')
    if (!main) return { overlap: false, info: 'no main' }

    // 检查 main 的 padding-top 是否足够覆盖 header
    const mainCs = getComputedStyle(main)
    const paddingTop = parseFloat(mainCs.paddingTop) || 0
    // 如果 padding-top >= header 高度,则不会遮挡
    if (paddingTop >= headerRect.height) return { overlap: false, info: `paddingTop=${paddingTop} >= headerHeight=${headerRect.height}` }

    // 否则检查 main 的第一个可见子元素是否被遮挡
    const children = main.children
    for (const child of children) {
      const childCs = getComputedStyle(child)
      const childRect = child.getBoundingClientRect()
      if (childCs.display === 'none' || childCs.visibility === 'hidden') continue
      if (childRect.width === 0 || childRect.height === 0) continue
      // 如果子元素的 top 小于 header 的 bottom,则被遮挡
      if (childRect.top < headerRect.bottom - 1) {
        return { overlap: true, info: `child top=${childRect.top} < header bottom=${headerRect.bottom}, paddingTop=${paddingTop}, headerHeight=${headerRect.height}` }
      }
      break // 只检查第一个可见子元素
    }
    return { overlap: false, info: `no child overlap, paddingTop=${paddingTop}, headerHeight=${headerRect.height}` }
  })
  if (headerOverlap.overlap) {
    issues.push(`header 可能遮挡内容 (${headerOverlap.info})`)
  }

  // 6. 检查导航菜单在平板尺寸下是否可用
  const navAvailable = await p.evaluate(() => {
    const nav = document.querySelector('nav, .nav-menu, .header-nav, .main-nav')
    if (!nav) return true
    const cs = getComputedStyle(nav)
    const rect = nav.getBoundingClientRect()
    return cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0
  })
  if (!navAvailable) {
    const hasHamburger = await p.evaluate(() => {
      const hamburger = document.querySelector('.mobile-menu-btn, .hamburger, .menu-toggle, [aria-label*="菜单"], [aria-label*="menu"]')
      if (!hamburger) return false
      const cs = getComputedStyle(hamburger)
      const rect = hamburger.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0
    })
    if (!hasHamburger) {
      issues.push('导航菜单不可用且无汉堡菜单')
    }
  }

  return issues
}

// 平板横屏 (1024x768)
test.describe('响应式断点检查 - 平板横屏 (1024x768)', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  for (const page of PAGES) {
    test(`${page.name} (${page.path}) - 平板横屏`, async ({ page: p }) => {
      const errors: string[] = []
      p.on('pageerror', e => { if (!isNoise(e.message)) errors.push(e.message) })

      const issues = await checkPageAtViewport(p, page.name, page.path)

      if (issues.length > 0) {
        console.log(`[${page.name}-平板横屏] 发现问题:`)
        issues.forEach(i => console.log(`  - ${i}`))
      } else {
        console.log(`[${page.name}-平板横屏] 无问题`)
      }

      expect(issues).toEqual([])
    })
  }
})

// 平板竖屏 (768x1024)
test.describe('响应式断点检查 - 平板竖屏 (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  for (const page of PAGES) {
    test(`${page.name} (${page.path}) - 平板竖屏`, async ({ page: p }) => {
      const errors: string[] = []
      p.on('pageerror', e => { if (!isNoise(e.message)) errors.push(e.message) })

      const issues = await checkPageAtViewport(p, page.name, page.path)

      if (issues.length > 0) {
        console.log(`[${page.name}-平板竖屏] 发现问题:`)
        issues.forEach(i => console.log(`  - ${i}`))
      } else {
        console.log(`[${page.name}-平板竖屏] 无问题`)
      }

      expect(issues).toEqual([])
    })
  }
})

// 小平板 (600x962)
test.describe('响应式断点检查 - 小平板 (600x962)', () => {
  test.use({ viewport: { width: 600, height: 962 } })

  for (const page of PAGES) {
    test(`${page.name} (${page.path}) - 小平板`, async ({ page: p }) => {
      const errors: string[] = []
      p.on('pageerror', e => { if (!isNoise(e.message)) errors.push(e.message) })

      const issues = await checkPageAtViewport(p, page.name, page.path)

      if (issues.length > 0) {
        console.log(`[${page.name}-小平板] 发现问题:`)
        issues.forEach(i => console.log(`  - ${i}`))
      } else {
        console.log(`[${page.name}-小平板] 无问题`)
      }

      expect(issues).toEqual([])
    })
  }
})
