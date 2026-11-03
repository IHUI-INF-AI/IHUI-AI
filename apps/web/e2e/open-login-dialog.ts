// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { expect, type Page } from '@playwright/test'

const LOGIN_NAME = /登录|登 录|login|sign in|ログイン|로그인/i

/**
 * 把登录弹窗打开 —— **唯一出口**,四条 spec 各自维护的"点一下文字=登录"已于
 * 2026-09 起失效:未登录态的侧栏用户行现在是 DropdownMenu 的触发器
 * (`SidebarUserRow.tsx` 的 `loginTrigger`,注释原话「整行作为 Dropdown 触发器打开
 * 同一套工具菜单(菜单末尾含"登录"项)」),点它只开菜单,弹窗在**第二次**点击上。
 * 现象是 22 个用例一起报 `getByTestId('login-dialog') element(s) not found`,
 * 而 e2e 作业已连续红到查不到上一次成功(≥250 次运行)。
 *
 * 两条出路按"先真 UI、后生产重定向"排:
 * A. 用户行 → 菜单项「登录」(这些用例考的本来就是"用户点登录")
 * B. `/?reauth=1&next=…` → `LoginRedirectListener` 自动弹(承继
 *    `desktop-window-controls-dim.spec.ts` 那条已维护的写法,零脆弱文案选择器)
 * 两条都不成才失败,且把"试过哪两条"写进断言消息 —— 下一次不该再是一句 not found。
 */
export async function ensureLoginDialogOpen(page: Page): Promise<'already' | 'menu' | 'reauth'> {
  const dialog = page.getByTestId('login-dialog')
  if (await visible(dialog, 2_000)) return 'already'

  const trigger = page.getByRole('button', { name: LOGIN_NAME }).first()
  if ((await trigger.count()) > 0) {
    // 两种派发都试:移动视口下该按钮以 fixed 定位,普通 click 会被 actionability 判
    // "element is outside of the viewport"(dialog-position-regression 早年就为此改用
    // dispatchEvent),而 Radix 的 Trigger 又可能只认 pointer 序列 —— 谁先开谁算。
    for (const open of [
      () => trigger.click({ timeout: 3_000 }),
      () => trigger.dispatchEvent('click'),
    ]) {
      await open().catch(() => null)
      const item = page.getByRole('menuitem', { name: LOGIN_NAME }).first()
      if (await visible(item, 3_000)) {
        await item
          .click({ timeout: 3_000 })
          .catch(async () => item.dispatchEvent('click').catch(() => null))
        if (await visible(dialog, 8_000)) {
          console.info('[open-login-dialog] 路径 A:未登录用户行 → 菜单项「登录」')
          return 'menu'
        }
      }
    }
  }

  await page
    .goto('/?reauth=1&next=/agent-workbench', { waitUntil: 'domcontentloaded' })
    .catch(() => null)
  await expect(
    dialog,
    '两条开法都没能让 login-dialog 出现:A) 点未登录用户行后菜单里没有可点的「登录」项;' +
      'B) /?reauth=1 深链也没触发 LoginRedirectListener。先查这两处谁改了',
  ).toBeVisible({ timeout: 15_000 })
  console.info('[open-login-dialog] 路径 B:reauth 深链 → LoginRedirectListener')
  return 'reauth'
}

async function visible(
  locator: ReturnType<Page['getByTestId']>,
  timeout: number,
): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
