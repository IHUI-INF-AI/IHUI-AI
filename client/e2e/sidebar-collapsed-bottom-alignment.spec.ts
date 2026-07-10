/**
 * 验证折叠态侧边栏底部操作栏的视觉一致性
 * - 4 个图标 (搜索/语言/主题/下载) hover 背景必须是 28×28 正方形
 * - 登录按钮 (或用户头像) 必须是 28×28 圆角方形
 * - 所有元素横向居中对齐
 */
import { test, expect, type Page } from '@playwright/test'

async function injectAuthState(page: Page, token: string): Promise<void> {
  await page.addInitScript(t => {
    const futureExpiry = Date.now() + 86400000
    const userData = JSON.stringify({
      uuid: 'integration_test', id: 'integration_test', username: 'integration_test',
      nickname: '集成测试用户', status: 1, isVip: false,
    })
    const userInfo = JSON.stringify({
      userId: 'integration_test', userName: 'integration_test',
      nickName: '集成测试用户', avatar: '',
    })
    localStorage.setItem('token', t)
    localStorage.setItem('user_token', t)
    localStorage.setItem('user_data', userData)
    localStorage.setItem('userInfo', userInfo)
    localStorage.setItem('login_expiry_time', String(futureExpiry))
    sessionStorage.setItem('token', t)
    sessionStorage.setItem('user_token', t)
  }, token)
}

test.describe('侧边栏折叠态底部一致性', () => {
  test('未登录: 所有按钮 hover 容器 + 登录按钮都是 28×28 正方形且居中对齐', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // 401 是未登录用户访问受保护 API 的预期错误（fetch user/profile 接口），
        // 与本次视觉修复无关，跳过以免误报
        if (msg.text().includes('401')) return
        errors.push(msg.text())
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })

    // 等 sidebar-actions 出现 (优先用 dom 元素，不依赖文本)
    const sidebarActions = page.locator('.sidebar-actions').first()
    await sidebarActions.waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(2000)

    // 折叠侧边栏
    const collapseBtn = page.locator('.sidebar-collapse-btn').first()
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click({ force: true }).catch(() => {})
      await page.waitForTimeout(800)
    }

    await page.screenshot({ path: 'e2e/__screenshots__/sidebar-collapsed-initial.png', fullPage: false })

    // 4 个图标的容器
    const searchWrapper = page.locator('.sidebar-actions .search-trigger-wrapper').first()
    const langSelector = page.locator('.sidebar-actions .language-selector').first()
    const themeWrapper = page.locator('.sidebar-actions .theme-toggle-wrapper').first()
    const downloadSelector = page.locator('.sidebar-actions .app-download-selector').first()

    const wrappers = [
      { name: 'search', el: searchWrapper },
      { name: 'language', el: langSelector },
      { name: 'theme', el: themeWrapper },
      { name: 'download', el: downloadSelector },
    ]

    for (const w of wrappers) {
      await w.el.waitFor({ state: 'attached', timeout: 10000 })
    }

    const centers: number[] = []
    for (const w of wrappers) {
      const box = await w.el.boundingBox()
      if (box) {
        console.log(`[${w.name}] ${Math.round(box.width)}x${Math.round(box.height)} centerX=${Math.round(box.x + box.width / 2)}`)
        expect(box.width, `${w.name} 宽度必须严格 28px`).toBe(28)
        expect(box.height, `${w.name} 高度必须严格 28px`).toBe(28)
        centers.push(Math.round(box.x + box.width / 2))
      }
    }

    const uniqueCenters = [...new Set(centers)]
    expect(uniqueCenters.length, `所有图标中心 x 应一致，实际: ${uniqueCenters.join(',')}`).toBe(1)
    const iconsCenterX = uniqueCenters[0]

    // 登录按钮
    const loginBtn = page.locator('.sidebar-login-row .login-button').first()
    const loginVisible = await loginBtn.isVisible().catch(() => false)
    if (loginVisible) {
      const loginBox = await loginBtn.boundingBox()
      if (loginBox) {
        const br = await loginBtn.evaluate(el => getComputedStyle(el).borderRadius)
        console.log(`[login] ${Math.round(loginBox.width)}x${Math.round(loginBox.height)} centerX=${Math.round(loginBox.x + loginBox.width / 2)} borderRadius=${br}`)
        expect(loginBox.width, '登录按钮宽度必须严格 28px').toBe(28)
        expect(loginBox.height, '登录按钮高度必须严格 28px').toBe(28)
        const loginCenterX = Math.round(loginBox.x + loginBox.width / 2)
        // 允许 ±1px 误差（子像素渲染导致）
        expect(Math.abs(loginCenterX - iconsCenterX), `登录按钮中心 x(${loginCenterX}) 应与图标中心 x(${iconsCenterX}) ±1px 一致`).toBeLessThanOrEqual(1)
        expect(br, `登录按钮不能是 50% 圆形，实际: ${br}`).not.toBe('50%')
      }
    }

    await page.screenshot({ path: 'e2e/__screenshots__/sidebar-collapsed-aligned.png', fullPage: false })

    // 鼠标悬停到每个按钮，截图
    for (const w of wrappers) {
      await w.el.hover({ force: true }).catch(() => {})
      await page.waitForTimeout(400)
      await page.screenshot({ path: `e2e/__screenshots__/sidebar-collapsed-hover-${w.name}.png` })
      await page.mouse.move(500, 500)
      await page.waitForTimeout(200)
    }

    expect(errors, `控制台无错误: ${errors.join('\n')}`).toEqual([])
  })

  test('已登录: 用户头像必须是 28×28 圆角方形且与图标中心 x 一致', async ({ page }) => {
    await injectAuthState(page, 'integration_test_token')
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // 401 / Authentication required / getUserInfo 失败
        // 都是测试用例注入的 fake token 必然产生的预期错误，与视觉修复无关
        if (msg.text().includes('401')) return
        if (msg.text().includes('Authentication required')) return
        if (msg.text().includes('getUserInfo失败')) return
        if (msg.text().includes('getUserInfoFailed')) return
        if (msg.text().includes('fetchUserInfo')) return
        if (msg.text().includes('user.ts')) return
        errors.push(msg.text())
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })

    const sidebarActions = page.locator('.sidebar-actions').first()
    await sidebarActions.waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(2500)

    // 折叠
    const collapseBtn = page.locator('.sidebar-collapse-btn').first()
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click({ force: true }).catch(() => {})
      await page.waitForTimeout(800)
    }

    // 等 sidebar-user-avatar 出现
    const avatar = page.locator('.sidebar-user-avatar').first()
    await avatar.waitFor({ state: 'attached', timeout: 10000 })
    await page.waitForTimeout(500)

    // 4 个图标
    const searchWrapper = page.locator('.sidebar-actions .search-trigger-wrapper').first()
    const langSelector = page.locator('.sidebar-actions .language-selector').first()
    const themeWrapper = page.locator('.sidebar-actions .theme-toggle-wrapper').first()
    const downloadSelector = page.locator('.sidebar-actions .app-download-selector').first()

    const wrappers = [searchWrapper, langSelector, themeWrapper, downloadSelector]
    const centers: number[] = []
    for (const w of wrappers) {
      const box = await w.boundingBox()
      if (box) {
        expect(box.width, `icon width`).toBe(28)
        expect(box.height, `icon height`).toBe(28)
        centers.push(Math.round(box.x + box.width / 2))
      }
    }
    const iconsCenterX = [...new Set(centers)][0]

    const avatarBox = await avatar.boundingBox()
    if (avatarBox) {
      const br = await avatar.evaluate(el => getComputedStyle(el).borderRadius)
      console.log(`[avatar] ${Math.round(avatarBox.width)}x${Math.round(avatarBox.height)} centerX=${Math.round(avatarBox.x + avatarBox.width / 2)} borderRadius=${br}`)
      expect(avatarBox.width, '头像宽度必须严格 28px').toBe(28)
      expect(avatarBox.height, '头像高度必须严格 28px').toBe(28)
      const avatarCenterX = Math.round(avatarBox.x + avatarBox.width / 2)
      // 允许 ±1px 误差（子像素渲染导致）
      expect(Math.abs(avatarCenterX - iconsCenterX), `头像中心 x(${avatarCenterX}) 应与图标中心 x(${iconsCenterX}) ±1px 一致`).toBeLessThanOrEqual(1)
      expect(br, `头像不能是 50% 圆形，实际: ${br}`).not.toBe('50%')
    }

    await page.screenshot({ path: 'e2e/__screenshots__/sidebar-collapsed-avatar.png', fullPage: false })

    expect(errors, `控制台无错误: ${errors.join('\n')}`).toEqual([])
  })
})
