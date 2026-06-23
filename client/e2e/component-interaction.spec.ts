import { test, expect } from '@playwright/test'

// 环境噪声过滤
const NOISE_PATTERNS = ['WebSocket', 'vite', 'ws://', 'wss://', 'Failed to fetch', 'NetworkError', 'ERR_CONNECTION', 'net::ERR', 'favicon', 'service-worker', 'ResizeObserver']
const isNoise = (t: string) => NOISE_PATTERNS.some(p => t.includes(p))

// 在所有测试前设置 localStorage,阻止推广弹窗显示
test.beforeEach(async ({ page: p }) => {
  await p.addInitScript(() => {
    // 设置推广弹窗已关闭时间戳(当前时间),阻止 24 小时内再次显示
    localStorage.setItem('promotion-modal-dismissed-time', Date.now().toString())
    // 设置会话级标记,阻止当前会话显示
    sessionStorage.setItem('promotion-modal-session-shown', 'true')
  })
})

// 关闭可能出现的推广弹窗/遮罩
async function dismissPromotionModal(p: import('@playwright/test').Page) {
  // 尝试按 ESC 关闭
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(300)
  // 尝试点击遮罩外区域关闭
  const overlay = p.locator('.promotion-modal-overlay:visible').first()
  if (await overlay.count() > 0) {
    await p.evaluate(() => {
      const el = document.querySelector('.promotion-modal-overlay') as HTMLElement
      if (el) el.click()
    }).catch(() => {})
    await p.waitForTimeout(300)
  }
  // 再次按 ESC
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(300)
}

test.describe('组件交互检查', () => {

  test('主题切换:亮色→暗色→亮色', async ({ page: p }) => {
    const errors: string[] = []
    p.on('pageerror', e => { if (!isNoise(e.message)) errors.push(e.message) })

    await p.goto('/', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 初始应为亮色
    const initialDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    // 桌面端用 .theme-toggle-fallback,移动端菜单用 .theme-toggle
    const themeToggle = p.locator('.theme-toggle-fallback:visible, .theme-toggle:visible').first()
    await expect(themeToggle).toBeVisible({ timeout: 10000 })

    // 切换到暗色
    await themeToggle.click()
    await p.waitForTimeout(1000)
    const afterClickDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    // 切换回来
    await themeToggle.click()
    await p.waitForTimeout(1000)
    const afterSecondClickDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    console.log(`[主题切换] 初始dark=${initialDark} 点击后dark=${afterClickDark} 再点击后dark=${afterSecondClickDark}`)

    // 至少应该有变化(切换生效)
    expect(afterClickDark !== initialDark || afterSecondClickDark !== afterClickDark).toBeTruthy()
  })

  test('语言切换下拉菜单', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 找到语言切换按钮(包含"简体中文"或语言图标)
    const langBtn = p.locator('button:has-text("简体中文"), [aria-label*="语言"], [aria-label*="language"], .language-switcher').first()
    const langBtnExists = await langBtn.count()

    if (langBtnExists > 0) {
      await langBtn.click()
      await p.waitForTimeout(500)

      // 检查下拉菜单是否出现
      const dropdown = p.locator('.el-dropdown-menu:visible, .el-select-dropdown:visible').first()
      const dropdownVisible = await dropdown.count()

      if (dropdownVisible > 0) {
        // 检查菜单项文字是否可见(对比度)
        const items = dropdown.locator('.el-dropdown-menu__item, .el-select-dropdown__item')
        const itemCount = await items.count()
        console.log(`[语言切换] 下拉菜单出现, ${itemCount}个选项`)

        // 检查菜单项文字颜色与背景对比度
        const contrastOk = await dropdown.evaluate((el) => {
          const cs = getComputedStyle(el)
          const bg = cs.backgroundColor
          const items = el.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')
          if (items.length === 0) return true
          const itemCs = getComputedStyle(items[0])
          const color = itemCs.color
          // 简单检查:不是同色
          return color !== bg
        })
        expect(contrastOk).toBeTruthy()
        console.log(`[语言切换] 菜单项对比度OK=${contrastOk}`)
      } else {
        console.log('[语言切换] 下拉菜单未出现(可能用其他方式)')
      }
    } else {
      console.log('[语言切换] 未找到语言切换按钮,跳过')
    }
  })

  test('搜索功能', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 找到搜索按钮
    const searchBtn = p.locator('button:has-text("搜索"), [aria-label*="搜索"], [aria-label*="search"], .search-btn, .header-search, .search-trigger').first()
    const searchBtnExists = await searchBtn.count()

    if (searchBtnExists > 0) {
      await searchBtn.click()
      await p.waitForTimeout(1000)

      // 检查搜索框是否出现
      const searchInput = p.locator('input[placeholder*="搜索"], input[placeholder*="search"], .search-input input, .el-input__inner:visible').first()
      const inputExists = await searchInput.count()

      if (inputExists > 0) {
        // 检查输入框可见性
        const inputVisible = await searchInput.evaluate((el: HTMLInputElement) => {
          const cs = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return cs.visibility !== 'hidden' && cs.display !== 'none' && rect.width > 0 && rect.height > 0
        })
        expect(inputVisible).toBeTruthy()
        console.log('[搜索] 搜索框可见')

        // 尝试输入
        await searchInput.fill('测试')
        await p.waitForTimeout(500)
        const inputValue = await searchInput.inputValue()
        expect(inputValue).toBe('测试')
        console.log('[搜索] 输入功能正常')
      } else {
        console.log('[搜索] 搜索框未出现')
      }
    } else {
      console.log('[搜索] 未找到搜索按钮,跳过')
    }
  })

  test('登录页表单', async ({ page: p }) => {
    await p.goto('/login', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    // 登录页使用异步组件,需要更长等待时间
    await p.waitForTimeout(4000)

    // 检查登录表单的输入框(过滤掉 opacity:0 的隐藏元素)
    const inputs = p.locator('input:visible')
    await p.waitForTimeout(1000)
    const inputCount = await inputs.count()
    console.log(`[登录表单] 找到${inputCount}个可见输入框`)

    // 先收集所有输入框信息
    const allInputInfos: Array<{
      index: number
      id: string
      name: string
      type: string
      className: string
      width: number
      height: number
      color: string
      bg: string
      opacity: string
      visibility: string
      display: string
      parentClass: string
    }> = []

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const info = await input.evaluate((el: HTMLInputElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          id: el.id || '',
          name: el.name || '',
          type: el.type || '',
          className: el.className || '',
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          visibility: cs.visibility,
          display: cs.display,
          parentClass: el.parentElement?.className || '',
        }
      })
      allInputInfos.push({ index: i, ...info })
      console.log(`[登录表单] 输入框${i}: id="${info.id}" name="${info.name}" type="${info.type}" ${info.width}x${info.height} opacity=${info.opacity} parent="${info.parentClass.slice(0, 50)}"`)
    }

    // 检查每个输入框的可见性(边框、文字),跳过隐藏元素和特殊类型
    let checkedCount = 0
    for (const info of allInputInfos) {
      // 跳过隐藏元素(opacity:0 或 visibility:hidden 或 display:none)
      if (info.opacity === '0' || info.visibility === 'hidden' || info.display === 'none') {
        console.log(`[登录表单] 输入框${info.index} 是隐藏元素,跳过`)
        continue
      }

      // 跳过 checkbox/radio 类型(宽度小是正常的)
      if (info.type === 'checkbox' || info.type === 'radio') {
        console.log(`[登录表单] 输入框${info.index} 是 ${info.type},跳过尺寸检查`)
        continue
      }

      // 跳过宽度为 0 的元素
      if (info.width === 0) {
        console.log(`[登录表单] 输入框${info.index} 宽度为 0,跳过`)
        continue
      }

      // 跳过 el-select 内部的 input(这些是 Element Plus select 组件的辅助 input,不是用户输入框)
      if (info.parentClass.includes('el-select') || info.className.includes('el-select')) {
        console.log(`[登录表单] 输入框${info.index} 是 el-select 内部 input,跳过尺寸检查`)
        continue
      }

      // 跳过验证码输入框(每个框只输入一个数字,宽度小是正常的)
      if (info.id.startsWith('verification-code-') || info.parentClass.includes('verification-code-inputs')) {
        console.log(`[登录表单] 输入框${info.index} 是验证码输入框,跳过尺寸检查`)
        continue
      }

      checkedCount++
      // 文本输入框应该有足够大小
      expect(info.width).toBeGreaterThan(50)
      expect(info.height).toBeGreaterThan(20)
    }
    console.log(`[登录表单] 实际检查了 ${checkedCount} 个有效输入框`)

    // 检查登录按钮
    const loginBtn = p.locator('button:has-text("登录"), button:has-text("注册"), button:has-text("Login"), .login-btn, [type="submit"]').first()
    const btnExists = await loginBtn.count()
    if (btnExists > 0) {
      const btnInfo = await loginBtn.evaluate((el: HTMLButtonElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
        }
      })
      console.log(`[登录表单] 登录按钮: ${btnInfo.width}x${btnInfo.height} color=${btnInfo.color} bg=${btnInfo.bg}`)

      // 按钮文字与背景不能同色
      expect(btnInfo.color !== btnInfo.bg || btnInfo.bg === 'rgba(0, 0, 0, 0)').toBeTruthy()
      // 按钮应该有足够大小
      expect(btnInfo.height).toBeGreaterThanOrEqual(28)
    }
  })

  test('导航菜单展开(更多功能)', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    // 关闭推广弹窗
    await dismissPromotionModal(p)

    // 找到"更多功能"或类似的下拉触发器
    const moreBtn = p.locator('button:has-text("更多"), [aria-label*="更多"], .more-btn, .nav-more').first()
    const moreBtnExists = await moreBtn.count()

    if (moreBtnExists > 0) {
      // 先滚动到按钮位置,确保不被遮挡
      await moreBtn.scrollIntoViewIfNeeded().catch(() => {})
      await p.waitForTimeout(300)

      // 使用 force click 避免被其他元素拦截
      await moreBtn.click({ force: true }).catch(async () => {
        // 如果 force click 也失败,尝试用 JS 点击
        await moreBtn.evaluate((el: HTMLElement) => el.click())
      })
      await p.waitForTimeout(500)

      // 检查下拉菜单
      const dropdown = p.locator('.el-dropdown-menu:visible, .el-popover:visible, .more-menu:visible').first()
      const dropdownVisible = await dropdown.count()

      if (dropdownVisible > 0) {
        // 检查菜单项文字可见性
        const items = dropdown.locator('a, button, .el-dropdown-menu__item, .nav-item')
        const itemCount = await items.count()
        console.log(`[导航更多] 下拉菜单出现, ${itemCount}个选项`)

        // 检查第一项的文字对比度
        if (itemCount > 0) {
          const contrastOk = await items.first().evaluate((el: HTMLElement) => {
            const cs = getComputedStyle(el)
            const parent = el.parentElement
            const parentCs = parent ? getComputedStyle(parent) : null
            const color = cs.color
            const bg = parentCs?.backgroundColor || cs.backgroundColor
            return color !== bg
          })
          expect(contrastOk).toBeTruthy()
          console.log('[导航更多] 菜单项对比度OK')
        }
      } else {
        console.log('[导航更多] 下拉菜单未出现')
      }
    } else {
      console.log('[导航更多] 未找到"更多"按钮,跳过')
    }
  })

  test('工具页排序下拉', async ({ page: p }) => {
    await p.goto('/tools', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)

    // 找到排序选择器(Tools.vue 使用 select.toolbar-sort)
    const sortSelect = p.locator('.toolbar-sort, select[class*="sort"]').first()
    const sortSelectExists = await sortSelect.count()

    if (sortSelectExists > 0) {
      // 先滚动到选择器位置,确保不被 header 遮挡
      await sortSelect.scrollIntoViewIfNeeded().catch(() => {})
      await p.waitForTimeout(300)

      // 检查选择器可见性和尺寸
      const selectInfo = await sortSelect.evaluate((el: HTMLSelectElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          border: cs.borderColor,
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        }
      })
      console.log(`[工具排序] 选择器: ${selectInfo.width}x${selectInfo.height} color=${selectInfo.color} bg=${selectInfo.bg} visible=${selectInfo.visible}`)

      // 选择器应该有足够大小
      expect(selectInfo.width).toBeGreaterThan(50)
      expect(selectInfo.height).toBeGreaterThan(20)

      // 检查文字与背景对比度
      expect(selectInfo.color !== selectInfo.bg).toBeTruthy()

      // 尝试使用 selectOption 选择
      await sortSelect.selectOption('name').catch(() => {})
      await p.waitForTimeout(500)
      const selectedValue = await sortSelect.evaluate((el: HTMLSelectElement) => el.value)
      console.log(`[工具排序] 选择后值: ${selectedValue}`)
    } else {
      console.log('[工具排序] 未找到排序选择器,跳过')
    }
  })

  test('VIP页弹窗(点击开通按钮)', async ({ page: p }) => {
    await p.goto('/vip', { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(3000)

    // 找到"立即开通"或"立即升级"按钮
    const ctaBtn = p.locator('button:has-text("开通"), button:has-text("升级"), button:has-text("购买"), .select-plan-btn, .cta-btn').first()
    const btnExists = await ctaBtn.count()

    if (btnExists > 0) {
      // 检查按钮文字可见性
      const btnInfo = await ctaBtn.evaluate((el: HTMLButtonElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          text: el.textContent?.trim().slice(0, 20),
        }
      })
      console.log(`[VIP弹窗] 按钮: "${btnInfo.text}" ${btnInfo.width}x${btnInfo.height} color=${btnInfo.color} bg=${btnInfo.bg}`)

      // 按钮文字与背景不能同色
      expect(btnInfo.color !== btnInfo.bg || btnInfo.bg === 'rgba(0, 0, 0, 0)').toBeTruthy()
      // 按钮应该有足够大小
      expect(btnInfo.height).toBeGreaterThanOrEqual(28)
    } else {
      console.log('[VIP弹窗] 未找到开通按钮,跳过')
    }
  })
})
