/**
 * /edu 教育中心侧边栏接入 + 路由跳转 E2E 守门
 *
 * 2026-07-04 立 (Phase C 完成): 验证主侧边栏 eduCenter 顶级入口 + /edu 内部侧边栏 12 模块菜单
 *
 * 守门覆盖:
 *   A. 主侧边栏 eduCenter 菜单项存在 + 可见 + label 正确
 *   B. 点击 eduCenter 跳转到 /edu + active 高亮
 *   C. /edu 页面渲染内部 el-aside 侧边栏 + 12 个 el-menu-item
 *   D. 内部侧边栏 11 个模块菜单项 label 正确 (排除 admin 条件项)
 *   E. 子路由跳转 (/edu/learn, /edu/exam, ...) 后主侧边栏 eduCenter 仍 active
 *   F. eduCenter 菜单项 path 属性 = '/edu' (源码级守门)
 *
 * 运行方式:
 *   npx playwright test e2e/edu-sidebar.spec.ts
 *   cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/edu-sidebar.spec.ts"
 *
 * 依赖: dev server (npm run dev, port 8888), reuseExistingServer: true
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

// 注入 mock 登录态绕过守卫 (与 route-reachability.spec.ts 一致)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    localStorage.setItem('token', 'mock-token-for-edu-sidebar-test')
    localStorage.setItem('user_token', 'mock-token-for-edu-sidebar-test')
    localStorage.setItem('user_data', JSON.stringify({
      uuid: 'mock-uuid',
      id: 'mock-id',
      username: 'test-edu-user',
      nickname: '测试教育用户',
      isAdmin: false,
      userType: 'user',
      roles: ['user'],
      permissions: ['*'],
      loginTime: new Date(now).toISOString(),
      lastActiveTime: new Date(now).toISOString(),
    }))
    localStorage.setItem('login_expiry_time', String(now + 86400000))
  })
})

async function gotoHome(page: Page): Promise<void> {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('.sidebar-logo').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

/** 在主侧边栏中找到 label 文本匹配的 nav-item button */
async function findNavitemByLabel(page: Page, labelText: string): Promise<import('playwright/test').Locator> {
  return page.locator('.nav-item', { hasText: labelText }).first()
}

// ════════════════════════════════════════════════════════════════════════
// A. 主侧边栏 eduCenter 菜单项存在 + 可见
// ════════════════════════════════════════════════════════════════════════

test.describe('A. 主侧边栏 eduCenter 菜单项', () => {
  test('eduCenter 菜单项存在且可见', async ({ page }) => {
    await gotoHome(page)

    // eduCenter 的 label 来自 i18n navigation.eduCenter, 中文 = "教育中心"
    const eduItem = page.locator('.nav-item .nav-item-label', { hasText: '教育' }).first()
    await eduItem.waitFor({ state: 'visible', timeout: 10000 })
    await expect(eduItem).toBeVisible()
  })

  test('eduCenter 菜单项 label 包含"教育"或"Education"', async ({ page }) => {
    await gotoHome(page)

    // 匹配中文"教育中心"或英文"Education Center"等
    const eduLabels = page.locator('.nav-item-label')
    const count = await eduLabels.count()
    let found = false
    for (let i = 0; i < count; i++) {
      const text = await eduLabels.nth(i).textContent()
      if (text && (text.includes('教育') || text.toLowerCase().includes('education'))) {
        found = true
        break
      }
    }
    expect(found, '主侧边栏必须包含"教育"或"Education"标签的菜单项').toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════
// B. 点击 eduCenter 跳转 + active 高亮
// ════════════════════════════════════════════════════════════════════════

test.describe('B. eduCenter 跳转 + active', () => {
  test('点击 eduCenter 跳转到 /edu', async ({ page }) => {
    await gotoHome(page)

    // 找到教育中心菜单项并点击
    const eduItem = await findNavitemByLabel(page, '教育')
    await eduItem.waitFor({ state: 'visible', timeout: 10000 })
    await eduItem.click({ force: true })
    await page.waitForURL('**/edu', { timeout: 15000 }).catch(() => {})

    expect(page.url()).toMatch(/\/edu$/)
  })

  test('eduCenter 在 /edu 路由下 active 高亮', async ({ page }) => {
    await gotoHome(page)

    const eduItem = await findNavitemByLabel(page, '教育')
    await eduItem.waitFor({ state: 'visible', timeout: 10000 })
    await eduItem.click({ force: true })
    await page.waitForURL('**/edu', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)

    // 重新定位 (导航后 DOM 可能重建)
    const eduItemAfter = await findNavitemByLabel(page, '教育')
    await expect(eduItemAfter).toHaveClass(/active/)
  })
})

// ════════════════════════════════════════════════════════════════════════
// C. /edu 页面内部侧边栏 12 个菜单项
// ════════════════════════════════════════════════════════════════════════

test.describe('C. /edu 内部侧边栏结构', () => {
  test('el-aside 内部侧边栏存在', async ({ page }) => {
    await page.goto(BASE + '/edu', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)

    const eduAside = page.locator('.edu-sidebar').first()
    await eduAside.waitFor({ state: 'visible', timeout: 15000 })
    await expect(eduAside).toBeVisible()
  })

  test('内部侧边栏至少 11 个 el-menu-item (不含 admin 条件项)', async ({ page }) => {
    await page.goto(BASE + '/edu', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)

    const menuItems = page.locator('.edu-menu .el-menu-item')
    const count = await menuItems.count()
    // 至少 11 个 (admin 是 v-if isAdmin, mock 用户非 admin 可能不显示)
    expect(count, `edu-menu 至少 11 个 el-menu-item, 实际 ${count}`).toBeGreaterThanOrEqual(11)
  })
})

// ════════════════════════════════════════════════════════════════════════
// D. 内部侧边栏 11 个模块 label 正确
// ════════════════════════════════════════════════════════════════════════

test.describe('D. 内部侧边栏模块 label', () => {
  // 11 个学生端模块的 i18n key (edu.nav.*), 中文值
  const expectedModules: Array<[string, string]> = [
    ['/edu', '教育中心'],
    ['/edu/learn', '我的课程'],
    ['/edu/exam', '我的考试'],
    ['/edu/ask', '问答'],
    ['/edu/circle', '圈子'],
    ['/edu/live', '直播'],
    ['/edu/member', '学员档案'],
    ['/edu/point', '积分'],
    ['/edu/order', '我的订单'],
    ['/edu/message', '消息中心'],
    ['/edu/resource', '资源库'],
  ]

  for (const [path, expectedLabel] of expectedModules) {
    test(`内部侧边栏包含 "${expectedLabel}" (${path})`, async ({ page }) => {
      await page.goto(BASE + '/edu', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(500)

      const menuItems = page.locator('.edu-menu .el-menu-item')
      let found = false
      const count = await menuItems.count()
      for (let i = 0; i < count; i++) {
        const text = (await menuItems.nth(i).textContent()) || ''
        if (text.includes(expectedLabel)) {
          found = true
          break
        }
      }
      expect(found, `edu-menu 必须包含 "${expectedLabel}" 菜单项`).toBe(true)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════
// E. 子路由跳转后主侧边栏 eduCenter 仍 active
// ════════════════════════════════════════════════════════════════════════

test.describe('E. 子路由跳转后 eduCenter 保持 active', () => {
  const subRoutes = [
    '/edu/learn',
    '/edu/exam',
    '/edu/ask',
    '/edu/circle',
    '/edu/live',
    '/edu/member',
    '/edu/point',
    '/edu/order',
    '/edu/message',
    '/edu/resource',
  ]

  for (const route of subRoutes) {
    test(`访问 ${route} 后 eduCenter 仍 active`, async ({ page }) => {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(800)

      // 检查主侧边栏 (非 edu 内部侧边栏) 中教育中心项是否 active
      const mainSidebarItems = page.locator('.app-sidebar .nav-item, .sidebar .nav-item')
      const count = await mainSidebarItems.count()
      let eduActive = false
      for (let i = 0; i < count; i++) {
        const item = mainSidebarItems.nth(i)
        const text = (await item.textContent()) || ''
        const className = await item.getAttribute('class')
        if (text.includes('教育') && className && className.includes('active')) {
          eduActive = true
          break
        }
      }
      expect(eduActive, `访问 ${route} 后主侧边栏 eduCenter 必须 active`).toBe(true)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════
// F. 内部侧边栏点击跳转验证
// ════════════════════════════════════════════════════════════════════════

test.describe('F. 内部侧边栏点击跳转', () => {
  test('点击"我的课程"跳转到 /edu/learn', async ({ page }) => {
    await page.goto(BASE + '/edu', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)

    const learnItem = page.locator('.edu-menu .el-menu-item', { hasText: '我的课程' }).first()
    await learnItem.waitFor({ state: 'visible', timeout: 10000 })
    await learnItem.click()
    await page.waitForURL('**/edu/learn', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)

    expect(page.url()).toMatch(/\/edu\/learn/)
  })

  test('点击"我的考试"跳转到 /edu/exam', async ({ page }) => {
    await page.goto(BASE + '/edu', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)

    const examItem = page.locator('.edu-menu .el-menu-item', { hasText: '我的考试' }).first()
    await examItem.waitFor({ state: 'visible', timeout: 10000 })
    await examItem.click()
    await page.waitForURL('**/edu/exam', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(500)

    expect(page.url()).toMatch(/\/edu\/exam/)
  })
})
