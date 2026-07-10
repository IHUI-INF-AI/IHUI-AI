/**
 * 下拉菜单定位时序守门测试 (2026-07-06 立)
 *
 * 历史根因 (与 popper-backdrop-leak.spec.ts 是两个独立根因, 交替触发"反反复复"):
 *  - watch(visible, v => v && updateMenuPosition(...)) 默认 flush:'pre'
 *  - flush:'pre' 在组件 DOM 更新前执行, v-if="visible" 菜单尚未渲染, menuEl.value === null
 *  - useDropdownPosition.updatePosition 首行 `if (!menuEl) return false` 直接退出
 *  - 菜单 inline top/left 永不设置 → position:fixed 无定位值 → 菜单渲染在视口错误位置
 *    (被 header 遮挡或落在视口外) → 用户"点击不弹菜单"
 *
 * 现有 popper-backdrop-leak.spec.ts 只验证"菜单 toBeVisible", 给出假阳性:
 *  菜单 visible=true 渲染了 (toBeVisible 通过), 但位置在视口外, 用户看不到。
 *  本测试补齐根因 2 的防回归: 验证菜单 inline 定位非空 + 在触发器附近 (非视口 0,0)。
 *
 * 运行:
 *  PW_BASE_URL=http://127.0.0.1:8888 npx playwright test e2e/dropdown-menu-position.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

async function waitForAppMount(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(async () => {
    const n = await page.evaluate(() => {
      const app = document.getElementById('app')
      return app ? app.childElementCount : 0
    })
    expect(n).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
}

test.describe('下拉菜单定位时序守门 (2026-07-06 根因 2)', () => {
  test('LanguageSwitcher: 点击后菜单 inline 定位非空且在触发器附近', async ({ page }) => {
    await waitForAppMount(page)

    const trigger = page.locator('.language-selector').first()
    await expect(trigger).toBeVisible({ timeout: 5000 })
    const tbox = await trigger.boundingBox()

    await trigger.click()
    await page.waitForTimeout(700)

    const menu = page.locator('.language-dropdown-menu')
    await expect(menu).toBeVisible({ timeout: 3000 })

    const info = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const h = el as HTMLElement
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        inlineTop: h.style.top,
        inlineLeft: h.style.left,
      }
    })

    // 核心断言 1: inline top/left 必须非空 (证明 watch flush:'post' 让 updatePosition 成功执行)
    expect(info.inlineTop, 'inline top 必须非空 (watch flush:post 生效, 否则菜单渲染在错误位置)').not.toBe('')
    expect(info.inlineLeft, 'inline left 必须非空').not.toBe('')

    // 核心断言 2: 菜单不应在视口左上角 (0,0) — 那是定位失败的典型症状
    expect(info.top <= 5 && info.left <= 5, '菜单不应落在视口 (0,0) (定位失败症状)').toBeFalsy()

    // 核心断言 3: 菜单水平位置应在触发器附近 (向下弹或向上弹都应接近触发器 x)
    if (tbox) {
      expect(Math.abs(info.left - tbox.x), '菜单 left 应接近触发器 x').toBeLessThan(350)
    }

    await page.keyboard.press('Escape')
  })

  test('AppDownload: 点击后菜单 inline 定位非空且在触发器附近', async ({ page }) => {
    await waitForAppMount(page)

    const trigger = page.locator('.app-download-selector').first()
    const visible = await trigger.isVisible().catch(() => false)
    if (!visible) {
      test.skip(true, 'AppDownload 在当前视口下不可见 (可能是移动端布局)')
      return
    }
    const tbox = await trigger.boundingBox()

    await trigger.click()
    await page.waitForTimeout(700)

    const menu = page.locator('.app-download-dropdown-menu')
    await expect(menu).toBeVisible({ timeout: 3000 })

    const info = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const h = el as HTMLElement
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        inlineTop: h.style.top,
        inlineLeft: h.style.left,
      }
    })

    expect(info.inlineTop, 'inline top 必须非空 (watch flush:post 生效)').not.toBe('')
    expect(info.inlineLeft, 'inline left 必须非空').not.toBe('')
    expect(info.top <= 5 && info.left <= 5, '菜单不应落在视口 (0,0)').toBeFalsy()
    if (tbox) {
      expect(Math.abs(info.left - tbox.x), '菜单 left 应接近触发器 x').toBeLessThan(350)
    }

    await page.keyboard.press('Escape')
  })
})
