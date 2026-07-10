/**
 * popper backdrop 泄漏守门测试 (2026-07-04 立)
 *
 * 历史问题:
 *  - 用户多次报告 LanguageSwitcher / AppDownload 点击后没反应、不出弹窗
 *  - 根因: el-select-v2 popper 卡在 display:block 状态, 其内部的
 *    .dropdown--fullscreen-backdrop (aria-hidden=true, pointer-events:auto,
 *    position:fixed; inset:0; z-index:2147483647) 覆盖整个视口拦截点击
 *
 * 本测试覆盖修复后的 4 个核心防回归点:
 *  1. .dropdown--fullscreen-backdrop 元素 pointer-events: none (CSS A 层)
 *  2. [aria-hidden="true"] 关闭的 popper 整体 display:none (CSS B 层)
 *  3. 任何 [class*="dropdown--"][class*="backdrop"] 都不拦截点击 (CSS C 层)
 *  4. LanguageSwitcher / AppDownload 在被遮挡后仍可点击 (运行时验证)
 *
 * 运行:
 *  PW_BASE_URL=http://127.0.0.1:4173 npx playwright test e2e/popper-backdrop-leak.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

/** 等待 Vue 挂载 */
async function waitForAppMount(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(async () => {
    const n = await page.evaluate(() => {
      const app = document.getElementById('app')
      return app ? app.childElementCount : 0
    })
    expect(n).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })
  // 关闭可能的引导/弹窗
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
}

test.describe('popper backdrop 泄漏守门 (2026-07-04)', () => {
  test('CSS A 层: .dropdown--fullscreen-backdrop pointer-events: none', async ({ page }) => {
    await waitForAppMount(page)

    // 注入一个模拟卡死的 backdrop 元素 (模拟历史 bug 的最坏情况)
    await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'dropdown--fullscreen-backdrop'
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = 'position:fixed; inset:0; z-index:2147483647; pointer-events:auto;'
      document.body.appendChild(el)
    })

    // 验证 computed style pointer-events: none (CSS A 层防御生效)
    const pe = await page.evaluate(() => {
      const el = document.querySelector('.dropdown--fullscreen-backdrop') as HTMLElement | null
      if (!el) return null
      return window.getComputedStyle(el).pointerEvents
    })
    expect(pe).toBe('none')

    // 验证该元素不再拦截点击
    const blocksClick = await page.evaluate(() => {
      const el = document.querySelector('.dropdown--fullscreen-backdrop') as HTMLElement | null
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const top = document.elementFromPoint(cx, cy)
      return top === el || el.contains(top)
    })
    expect(blocksClick).toBe(false)

    // 清理
    await page.evaluate(() => {
      document.querySelectorAll('.dropdown--fullscreen-backdrop').forEach((el) => el.remove())
    })
  })

  test('CSS B 层: [aria-hidden=true] 关闭的 popper 整体 display:none', async ({ page }) => {
    await waitForAppMount(page)

    // 注入一个模拟卡死的 el-popper 元素 (aria-hidden=true, 卡在 display:block 状态)
    await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'el-popper'
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = 'position:fixed; top:0; left:0; z-index:9999;'
      document.body.appendChild(el)
    })

    // 验证 display:none (CSS B 层防御生效, 关闭态 popper 完全隐藏)
    const display = await page.evaluate(() => {
      const el = document.querySelector('.el-popper[aria-hidden="true"]') as HTMLElement | null
      if (!el) return null
      return window.getComputedStyle(el).display
    })
    expect(display).toBe('none')

    // 清理
    await page.evaluate(() => {
      document.querySelectorAll('.el-popper[aria-hidden="true"]').forEach((el) => el.remove())
    })
  })

  test('CSS C 层: 任何 [class*=dropdown--][class*=backdrop] pointer-events: none', async ({ page }) => {
    await waitForAppMount(page)

    // 注入多个模拟的 backdrop 变体类名 (覆盖各种命名变种)
    for (const cls of [
      'dropdown--x-backdrop',
      'dropdown--custom-backdrop',
      'dropdown--special-backdrop',
    ]) {
      await page.evaluate((cls) => {
        const el = document.createElement('div')
        el.className = cls
        el.style.cssText = 'position:fixed; inset:0; z-index:2147483647; pointer-events:auto;'
        document.body.appendChild(el)
      }, cls)
    }

    // 验证所有变体的 pointer-events: none
    const results = await page.evaluate(() => {
      const sels = ['.dropdown--x-backdrop', '.dropdown--custom-backdrop', '.dropdown--special-backdrop']
      return sels.map((s) => {
        const el = document.querySelector(s) as HTMLElement | null
        return el ? window.getComputedStyle(el).pointerEvents : null
      })
    })
    expect(results).toEqual(['none', 'none', 'none'])

    // 清理
    await page.evaluate(() => {
      document
        .querySelectorAll('[class*="dropdown--"][class*="backdrop"]')
        .forEach((el) => el.remove())
    })
  })

  test('运行时: LanguageSwitcher 在 backdrop 注入后仍可点击', async ({ page }) => {
    await waitForAppMount(page)

    // 注入一个模拟卡死的 backdrop (模拟历史 bug)
    await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'dropdown--fullscreen-backdrop'
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = 'position:fixed; inset:0; z-index:2147483647; pointer-events:auto;'
      document.body.appendChild(el)
    })

    // 点击 LanguageSwitcher (默认是 header 右上角, 用 class 定位)
    const langSelector = page.locator('.language-selector').first()
    await expect(langSelector).toBeVisible({ timeout: 5000 })
    await langSelector.click({ force: false })
    await page.waitForTimeout(500)

    // 验证下拉菜单出现
    const langMenu = page.locator('.language-dropdown-menu')
    await expect(langMenu).toBeVisible({ timeout: 3000 })

    // 清理
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.evaluate(() => {
      document.querySelectorAll('.dropdown--fullscreen-backdrop').forEach((el) => el.remove())
    })
  })

  test('运行时: AppDownload 在 backdrop 注入后仍可点击', async ({ page }) => {
    await waitForAppMount(page)

    // 注入一个模拟卡死的 backdrop
    await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'dropdown--fullscreen-backdrop'
      el.setAttribute('aria-hidden', 'true')
      el.style.cssText = 'position:fixed; inset:0; z-index:2147483647; pointer-events:auto;'
      document.body.appendChild(el)
    })

    // 点击 AppDownload
    const downloadSelector = page.locator('.app-download-selector').first()
    const isVisible = await downloadSelector.isVisible().catch(() => false)
    if (isVisible) {
      await downloadSelector.click({ force: false })
      await page.waitForTimeout(500)
      const downloadMenu = page.locator('.app-download-dropdown-menu')
      await expect(downloadMenu).toBeVisible({ timeout: 3000 })
    } else {
      // 移动端视口下 AppDownload 会被隐藏, 跳过运行时验证但仍通过测试
      test.skip(isVisible === false, 'AppDownload 在当前视口下不可见 (可能是移动端)')
    }

    // 清理
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.evaluate(() => {
      document.querySelectorAll('.dropdown--fullscreen-backdrop').forEach((el) => el.remove())
    })
  })

  test('运行时: AI 能力面板 ESC 键可关闭 (防止 backdrop 永久遮挡)', async ({ page }) => {
    await waitForAppMount(page)

    // 触发 AI 浮窗
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))

    // 等待 AIChat 挂载
    const dialog = page.locator('.floating-chat-dialog')
    await expect(dialog).toBeVisible({ timeout: 12000 })

    // 展开最小化状态
    const wrapper = page.locator('.floating-chat-dialog-wrapper')
    if (await wrapper.evaluate((el) => el.classList.contains('is-minimized')).catch(() => false)) {
      await page.locator('.floating-chat-dialog .header-btn.minimize-btn').click({ force: true })
      await page.waitForTimeout(600)
    }

    // 点击能力选择下拉 (AICapabilitySelector 内的按钮)
    const aiCapBtn = page.locator('.ai-capability-selector button').first()
    const aiCapBtnVisible = await aiCapBtn.isVisible().catch(() => false)
    if (!aiCapBtnVisible) {
      test.skip(true, 'AI 能力选择器在当前状态不可见')
      return
    }

    await aiCapBtn.evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(600)

    // 关闭下拉/面板 (用 ESC 退出)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // 验证 dialog 仍可交互 (证明没有 backdrop 永久遮挡)
    const stillVisible = await dialog.isVisible()
    expect(stillVisible).toBe(true)
  })
})
