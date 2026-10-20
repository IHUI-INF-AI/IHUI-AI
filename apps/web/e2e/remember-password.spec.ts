// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page, type Locator } from '@playwright/test'
import { ensureLoginDialogOpen } from './open-login-dialog'

/**
 * 记住账号回填 + 账号历史 e2e 测试
 *
 * 2026-10-17 调整:登录框的「记住密码」「自动登录」两勾曾被移除(4cd1d058e1),同日 G-322
 * (e65bca6aa8)又以"显式勾选才落盘口令"的形态恢复 —— 独立 key ihui-remember-password,
 * 账号那一半仍走只含 {account} 的 ihui-remember-credentials。本文件覆盖的是后者那一条线:
 *  - 账号回填(有已保存账号时自动预填,不预填口令,旧明文/base64 形态就地抹除)
 *  - 账号历史下拉(双击展开 / 点击填入 / 删除单条 / 清空全部 / 键盘导航)
 * 勾选项本身(勾选后口令落盘)不在本文件射程内,不由这些用例判绿。
 *
 * 关联组件:
 *  - packages/ui-react/src/components/login-form/password-login-form.tsx
 *  - packages/ui-react/src/components/login-form/account-history-input.tsx
 *  - packages/ui-react/src/lib/remember-credentials.ts(2026-10-17 起凭据层住这里)
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
  const account = page.locator('#login-form-account')
  await tab.waitFor({ state: 'visible', timeout: 10000 })
  // 2026-10-20:原写法用 page.mouse + tab.boundingBox() 的屏幕坐标点击,在 CI 会打空
  // (实测 6 条用例全红:3 条停在「#login-form-account element(s) not found」,3 条停在
  // 「历史面板 not found」—— 弹窗入场动画/协议通知浮层让先量到的坐标失效)。
  // 改为每一下都作用在元素自身:真点击 → 强制点击 → dispatchEvent,以"账号输入框出现"
  // 为切换成功的证据;三种派发都不成才判红(不静默放过)。
  for (const go of [
    () => tab.click({ timeout: 3_000 }),
    () => tab.click({ timeout: 3_000, force: true }),
    () => tab.dispatchEvent('click'),
  ]) {
    await go().catch(() => null)
    if (
      await account
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      return
    }
  }
  await expect(
    account,
    '切到密码登录 tab 后 #login-form-account 仍未出现(三种派发:click / force click / dispatchEvent 都试过)' +
      ' —— 登录表单的 tab 结构或 enableCredentialPersistence 分支改了?',
  ).toBeVisible({ timeout: 5_000 })
}

/** 元素自身的点法三连(坐标点击在 CI 打空的根治);三种都失败时把最后一次错误抛出去,不静默 */
async function tap(el: Locator): Promise<void> {
  for (const go of [
    () => el.click({ timeout: 3_000 }),
    () => el.click({ timeout: 3_000, force: true }),
    () => el.dispatchEvent('click'),
  ]) {
    try {
      await go()
      return
    } catch {
      /* 换下一种派发 */
    }
  }
  await el.click({ timeout: 3_000 })
}

/**
 * 双击账号输入框展开账号历史下拉,返回面板句柄(用例随后必须对它做真断言)。
 * 2026-10-20:面板锚点从 `.absolute.top-full` 样式类改挂到组件自带的
 * data-testid="account-history-input"(packages/ui-react/.../account-history-input.tsx:134)
 * 之下 —— 样式类一次改名就全体取不到输入,testid 才是契约。
 */
async function openAccountHistory(page: Page): Promise<Locator> {
  const account = page.locator('#login-form-account')
  const panel = page.locator('[data-testid="account-history-input"] .absolute.top-full')
  await account.waitFor({ state: 'visible', timeout: 10000 })
  for (const go of [
    () => account.dblclick({ timeout: 3_000 }),
    () => account.dblclick({ timeout: 3_000, force: true }),
    () => account.dispatchEvent('dblclick'),
  ]) {
    await go().catch(() => null)
    if (
      await panel
        .first()
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      return panel
    }
  }
  await expect(
    panel.first(),
    '双击账号输入框没能展开账号历史下拉(dblclick / force dblclick / dispatchEvent 三种派发都试过)' +
      ' —— AccountHistoryInput 的 onDoubleClick 或容器结构改了?',
  ).toBeVisible({ timeout: 5_000 })
  return panel
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

    // 2026-10-20:双击 + 面板锚点收进 openAccountHistory(坐标 dblclick 在 CI 打空)
    const historyPanel = await openAccountHistory(page)
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

    // 2026-10-20:双击展开 + 面板锚点走 openAccountHistory;选中改点条目内的"账号按钮"
    // (2026-09-22 起行容器是纯 div,内嵌两枚真 button:选中账号钮 + 删除钮),
    // 不再用"坐标偏左 30%"的 mouse 序列 —— 那种写法一旦弹窗布局抖动就打空。
    const historyPanel = await openAccountHistory(page)
    const firstRow = historyPanel.locator('[data-history-index]').first()
    await expect(firstRow).toBeVisible({ timeout: 5000 })
    await tap(firstRow.getByRole('button', { name: 'historyuser' }))

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

    // 2026-10-20:双击/面板锚点走 openAccountHistory,删除按钮改点元素本身(坐标点法在 CI 打空)
    const historyPanel = await openAccountHistory(page)
    await expect(historyPanel.locator('[data-history-index]').first()).toBeVisible({
      timeout: 5000,
    })

    // 点击第一个条目的删除按钮(aria-label = auth.removeAccount「移除账号」)
    await tap(historyPanel.getByRole('button', { name: '移除账号' }).first())

    // deluser1 应该消失,deluser2 和 deluser3 仍在
    await expect(historyPanel).not.toContainText('deluser1', { timeout: 3000 })
    await expect(historyPanel).toContainText('deluser2')
    await expect(historyPanel).toContainText('deluser3')
  })

  test('账号历史:清空全部历史', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(['clearuser1', 'clearuser2']))))
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 2026-10-20:双击/面板锚点走 openAccountHistory,按钮改点元素本身(坐标点法在 CI 打空)
    const historyPanel = await openAccountHistory(page)
    await expect(historyPanel.locator('[data-history-index]').first()).toBeVisible({
      timeout: 5000,
    })

    // 点击"清除历史记录"按钮(auth.clearHistory)
    await tap(historyPanel.getByRole('button', { name: '清除历史记录' }))

    // 下拉应关闭
    await expect(historyPanel).not.toBeVisible({ timeout: 3000 })

    // 重新打开下拉,应显示"暂无历史记录"(auth.noHistory)
    const reopened = await openAccountHistory(page)
    await expect(reopened).toContainText('暂无历史记录', { timeout: 3000 })
  })

  test('账号历史:键盘导航(ArrowDown + Enter 选中)', async ({ page }) => {
    await page.addInitScript(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(['kbuser1', 'kbuser2']))))
      localStorage.setItem('ihui-login-history', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 2026-10-20:双击/面板锚点走 openAccountHistory(坐标点法在 CI 打空)
    const historyPanel = await openAccountHistory(page)
    await expect(historyPanel.locator('[data-history-index]').first()).toBeVisible({
      timeout: 5000,
    })

    // 按 ArrowDown 高亮第一项
    await page.locator('#login-form-account').press('ArrowDown')

    // 第一项应有 bg-accent 类(选中态)
    const firstItem = historyPanel.locator('[data-history-index="0"]')
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
