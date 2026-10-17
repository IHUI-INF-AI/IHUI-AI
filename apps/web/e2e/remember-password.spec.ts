// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from '@playwright/test'
import { ensureLoginDialogOpen } from './open-login-dialog'

/**
 * 记住账号回填 + 账号历史 e2e 测试
 *
 * 2026-10-17 调整:登录框的「记住密码」「自动登录」两个勾已移除(口令永不落盘、自动登录
 * 走设置页开关 + 后端 refresh token 续期),相关勾选测试一并删除。本文件现只覆盖:
 *  - 账号回填(有已保存账号时自动预填,不预填口令,旧明文就地抹除)
 *  - 账号历史下拉(双击展开 / 点击填入 / 删除单条 / 清空全部 / 键盘导航)
 *
 * 关联组件:
 *  - packages/ui-react/src/components/login-form/password-login-form.tsx
 *  - apps/web/src/lib/remember-credentials.ts
 */

const BASE_URL =
  process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8801' // 2026-09-15 修:不再写死 8801

test.beforeEach(async ({ page }) => {
  // 2026-08-26 修复:仅 clearCookies 不够 —— localStorage 的 ihui-auth / ihui-user /
  // token / user 仍会恢复登录态(persist rehydrate),导致 header 无登录按钮 +
  // LoginRedirectListener 不自动弹登录框 → openLoginDialog 点登录按钮 30s 超时。
  // 先 goto 到目标 origin 再清 localStorage(about:blank 上 evaluate 写入无效 origin)。
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => null)
  await page.evaluate(() => {
    localStorage.removeItem('ihui-auth')
    localStorage.removeItem('ihui-user')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  })
  // 清除 cookie,防止 LoginRedirectListener 自动打开登录弹窗
  await page.context().clearCookies()
})

async function openLoginDialog(page: Page) {
  await page.goto(BASE_URL)
  await page.waitForLoadState('domcontentloaded')

  // 检查登录弹窗是否已自动打开(LoginRedirectListener)
  const loginDialog = page.getByTestId('login-dialog')
  // 开弹窗的写法收进唯一出口(未登录态自 2026-09 起是"点行开菜单 → 点菜单项"两步,
  // 这里原来"全局点第一个登录按钮"只会把菜单打开,弹窗永远等不到)
  await ensureLoginDialogOpen(page)

  await expect(loginDialog).toBeVisible({ timeout: 10000 })

  // 如果协议通知弹窗打开了,关闭它
  const disagreeBtn = page.getByTestId('agreement-notice-disagree')
  if (await disagreeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    const dbox = await disagreeBtn.boundingBox()
    if (dbox) {
      await page.mouse.move(dbox.x + dbox.width / 2, dbox.y + dbox.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }
    await page.waitForTimeout(300)
  }
}

async function switchToPasswordTab(page: Page) {
  const tab = page.getByTestId('login-tab-password')
  await tab.waitFor({ state: 'visible', timeout: 10000 })

  // 用 page.mouse API 发送真实的 trusted 事件,绕过 Playwright actionability 检查
  // (Radix Dialog Content 会触发 "intercepts pointer events" 误报)
  const box = await tab.boundingBox()
  if (!box) throw new Error('login-tab-password not found')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()

  await expect(page.locator('#login-form-account')).toBeVisible({ timeout: 10000 })
}

test.describe('记住账号回填 + 账号历史', () => {
  // 票 #27 web 端收口(2026-09-29):记住的记录里不再有口令。
  // 旧断言"password 输入框被预填 SavedPass1"钉的正是缺陷本身(base64 明文口令长期落盘),
  // 现改为新契约:账号预填、口令框为空、盘上旧形态被就地抹成"只含账号"。
  // 自动登录不再重放账密,由 use-auth-bootstrap 的 httpOnly refresh 静默续期承担。
  test('有已保存凭据时自动填充账号(不填充口令)+ 就地抹除旧明文', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(
        unescape(
          encodeURIComponent(JSON.stringify({ account: 'saveduser', password: 'SavedPass1' })),
        ),
      )
      localStorage.setItem('ihui-remember-credentials', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // useEffect 在 active 变 true 后异步执行 setValue,需要等待
    await expect(page.locator('#login-form-account')).toHaveValue('saveduser', { timeout: 10000 })
    // 口令不再从本地预填(这一档已从"记住"里移除;密码走浏览器自带记忆)
    await expect(page.locator('#login-form-password')).toHaveValue('', { timeout: 5000 })

    // 迁移义务:读侧必须把旧 base64 明文记录就地改写成"只含账号"的新形态
    const stored = await page.evaluate(() => localStorage.getItem('ihui-remember-credentials'))
    expect(stored, '记住的账号记录应仍在(账号那一半不得丢)').toBeTruthy()
    expect(stored!).not.toContain('SavedPass1')
    expect(JSON.parse(stored!)).toEqual({ account: 'saveduser' })
  })

  test('账号历史下拉:双击账号输入框弹出历史', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(
        unescape(encodeURIComponent(JSON.stringify(['user1@example.com', 'user2', 'admin']))),
      )
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 用 page.mouse.click(clickCount:2) 触发 dblclick
    const accountBox = await page.locator('#login-form-account').boundingBox()
    if (accountBox) {
      await page.mouse.click(
        accountBox.x + accountBox.width / 2,
        accountBox.y + accountBox.height / 2,
        { clickCount: 2 },
      )
    }

    const historyPanel = page.locator('[data-account-history-container] > .absolute.top-full')
    await expect(historyPanel).toBeVisible({ timeout: 5000 })

    await expect(historyPanel.getByText('user1@example.com')).toBeVisible()
    await expect(historyPanel.getByText('user2')).toBeVisible()
    await expect(historyPanel.getByText('admin')).toBeVisible()
  })

  test('账号历史:点击历史条目填入账号', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(['historyuser', 'otheruser']))))
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 用 page.mouse.click(clickCount:2) 触发 dblclick 打开历史下拉
    const acctBox = await page.locator('#login-form-account').boundingBox()
    if (acctBox) {
      await page.mouse.click(acctBox.x + acctBox.width / 2, acctBox.y + acctBox.height / 2, {
        clickCount: 2,
      })
    }
    await page.waitForSelector(
      '[data-account-history-container] > .absolute.top-full [data-history-index]',
      { timeout: 5000 },
    )

    // 用 page.mouse 点击历史条目(偏移到左侧 30% 处避免点到右侧删除按钮)
    const historyItem = page
      .locator('[data-account-history-container] > .absolute.top-full [data-history-index]')
      .first()
    const hbox = await historyItem.boundingBox()
    if (hbox) {
      await page.mouse.move(hbox.x + hbox.width * 0.3, hbox.y + hbox.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }

    await expect(page.locator('#login-form-account')).toHaveValue('historyuser', { timeout: 5000 })
  })

  test('账号历史:删除单个历史账号', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(
        unescape(encodeURIComponent(JSON.stringify(['deluser1', 'deluser2', 'deluser3']))),
      )
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 双击打开历史下拉
    const acctBox = await page.locator('#login-form-account').boundingBox()
    if (acctBox) {
      await page.mouse.click(acctBox.x + acctBox.width / 2, acctBox.y + acctBox.height / 2, {
        clickCount: 2,
      })
    }
    await page.waitForSelector(
      '[data-account-history-container] > .absolute.top-full [data-history-index]',
      { timeout: 5000 },
    )

    // 点击第一个条目的删除按钮
    const deleteBtn = page
      .locator('[data-account-history-container] > .absolute.top-full [aria-label="移除账号"]')
      .first()
    const dbox = await deleteBtn.boundingBox()
    if (dbox) {
      await page.mouse.move(dbox.x + dbox.width / 2, dbox.y + dbox.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }

    // deluser1 应该消失,deluser2 和 deluser3 仍在
    await expect(
      page.locator('[data-account-history-container] > .absolute.top-full'),
    ).not.toContainText('deluser1', { timeout: 3000 })
    await expect(
      page.locator('[data-account-history-container] > .absolute.top-full'),
    ).toContainText('deluser2')
    await expect(
      page.locator('[data-account-history-container] > .absolute.top-full'),
    ).toContainText('deluser3')
  })

  test('账号历史:清空全部历史', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(['clearuser1', 'clearuser2']))))
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 双击打开历史下拉
    const acctBox = await page.locator('#login-form-account').boundingBox()
    if (acctBox) {
      await page.mouse.click(acctBox.x + acctBox.width / 2, acctBox.y + acctBox.height / 2, {
        clickCount: 2,
      })
    }
    await page.waitForSelector(
      '[data-account-history-container] > .absolute.top-full [data-history-index]',
      { timeout: 5000 },
    )

    // 点击"清除历史记录"按钮(文本匹配)
    const clearBtn = page
      .locator('[data-account-history-container] > .absolute.top-full')
      .getByText('清除历史记录')
    const cbox = await clearBtn.boundingBox()
    if (cbox) {
      await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2)
      await page.mouse.down()
      await page.mouse.up()
    }

    // 下拉应关闭
    await expect(
      page.locator('[data-account-history-container] > .absolute.top-full'),
    ).not.toBeVisible({ timeout: 3000 })

    // 重新打开下拉,应显示"暂无历史记录"
    if (acctBox) {
      await page.mouse.click(acctBox.x + acctBox.width / 2, acctBox.y + acctBox.height / 2, {
        clickCount: 2,
      })
    }
    await expect(
      page.locator('[data-account-history-container] > .absolute.top-full'),
    ).toContainText('暂无历史记录', { timeout: 3000 })
  })

  test('账号历史:键盘导航(ArrowDown + Enter 选中)', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(['kbuser1', 'kbuser2']))))
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 双击打开历史下拉
    const acctBox = await page.locator('#login-form-account').boundingBox()
    if (acctBox) {
      await page.mouse.click(acctBox.x + acctBox.width / 2, acctBox.y + acctBox.height / 2, {
        clickCount: 2,
      })
    }
    await page.waitForSelector(
      '[data-account-history-container] > .absolute.top-full [data-history-index]',
      { timeout: 5000 },
    )

    // 按 ArrowDown 高亮第一项
    await page.locator('#login-form-account').press('ArrowDown')

    // 第一项应有 bg-accent 类(选中态)
    const firstItem = page.locator(
      '[data-account-history-container] > .absolute.top-full [data-history-index="0"]',
    )
    await expect(firstItem).toHaveClass(/bg-accent/)

    // 按 Enter 选中
    await page.locator('#login-form-account').press('Enter')

    // 账号应填入 kbuser1
    await expect(page.locator('#login-form-account')).toHaveValue('kbuser1', { timeout: 3000 })
  })

  test('i18n 翻译完整性(5 语言 rememberPassword + autoLogin + accountHistory + noHistory + removeAccount + clearHistory)', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    // 2026-07-25 i18n 单一来源:web messages 迁移到 @ihui/i18n/messages/web/(packages/i18n/messages/web),
    // apps/web/messages/ 目录已不存在,旧路径 ENOENT(2026-08-26 修复)。
    const webMessagesDir = resolve(process.cwd(), '../../packages/i18n/messages/web')
    const locales = ['zh-CN', 'en', 'zh-TW', 'ko', 'ja']
    for (const locale of locales) {
      const filePath = resolve(webMessagesDir, `${locale}.json`)
      const data = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(data.auth?.rememberPassword, `${locale} missing auth.rememberPassword`).toBeTruthy()
      expect(data.auth?.autoLogin, `${locale} missing auth.autoLogin`).toBeTruthy()
      // 2026-09-14 移除 accountHistory 断言:该 key 从未存在于任何 locale,
      // UI 也不引用(全仓 0 引用)—— 死键期望,非产品回归。
      expect(data.auth?.noHistory, `${locale} missing auth.noHistory`).toBeTruthy()
      expect(data.auth?.removeAccount, `${locale} missing auth.removeAccount`).toBeTruthy()
      expect(data.auth?.clearHistory, `${locale} missing auth.clearHistory`).toBeTruthy()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
