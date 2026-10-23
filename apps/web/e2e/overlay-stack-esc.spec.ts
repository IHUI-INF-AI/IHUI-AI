// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Esc 无层栈协议 —— 真机三层叠开逐层退出(台账「Esc 无层栈协议」票,2026-10-23)。
 *
 * 结的是姊妹文件 `esc-overlay-stack.spec.ts` 头部注记留在票上的最后一格:
 * 「要咬住『协议过度放行(恒真)』那一维,必须叠开两个自绘层(非 Radix)——
 * 那需要登录态」。免登录面叠不开三层(自绘层被下一层点击的 mousedown 当场点外
 * 关闭),本文件用**纯键盘触发**绕开该结构限制:三层全部由 window keydown 快捷键
 * 打开,全程零 mousedown,层与层之间不会互相点外顶掉。
 *
 * 三层选型(对应票面"遮罩 + 弹层 + pane"):
 *  - 弹层:Ctrl+Shift+/ → SlashCommandPalette(自绘 PortalPanel;锚点 span 注入
 *    aria-expanded/data-state,面板本体 data-testid="slash-command-palette")
 *  - 遮罩:Ctrl+/ → 快捷键帮助面板(自绘全屏遮罩,data-testid="shortcut-help-overlay")
 *  - 模态:Ctrl+K → CommandPalette(Radix Dialog,ui-react 内建层栈注册,data-state)
 *
 * 逐层断言按票面要求用三种真机可读形态:aria-expanded(弹层锚点)/ DOM 存在性
 * (遮罩、弹层面板)/ data-state(模态)。每一格"只关最上层"都配反向对照"再按一次
 * 下层确实关"(承继姊妹文件纪律:缺了它,"只关最上层"可能只是"Esc 完全无效"的另一种长相)。
 *
 * 登录契约:走 fixtures 的 authenticatedPage(API 登录显式 type='email' ——
 * 2026-10-21 起服务端不带 type 默认走手机通道,邮箱恒 401)。
 * 跑法(唯一正牌供给出口,强制 E2E_SKIP_SEED=1 / E2E_AUTO_CLEANUP=0,严禁裸跑):
 *   node scripts/e2e-local-supply.mjs --run --base-url=http://localhost:8801 -- \
 *     e2e/overlay-stack-esc.spec.ts --project=chromium
 */

const SLASH_TESTID = 'slash-command-palette'
const HELP_TESTID = 'shortcut-help-overlay'

/**
 * 命令面板存在性的唯一尺子:DOM 属性计数,不用 getByRole('dialog') ——
 * Radix modal 打开时会给其它 body 子树打 aria-hidden,可访问性树只剩一层
 * (esc-overlay-stack.spec.ts 实测教训)。选择器钉死在 CommandPalette 的
 * data-testid 把手 + data-state(真机实测教训:页面上会因后端抖动冒出其它
 * Radix Dialog 实例,宽口径 [role=dialog][data-state=open] 会误伤计数)。
 */
const openPaletteCount = (page: Page) =>
  page.evaluate(
    () => document.querySelectorAll('[data-testid="command-palette"][data-state="open"]').length,
  )

/** 等 composer 水合完成:隐藏锚点 span 是 SlashCommandPalette 的 trigger,随 message-input 挂载。 */
async function waitForComposer(page: Page) {
  await expect
    .poll(() => page.locator('span[aria-haspopup="dialog"]').count(), {
      timeout: 30_000,
      message: '/chat composer 未挂载(span[aria-haspopup="dialog"] 是斜杠面板锚点)',
    })
    .toBe(1)
}

/**
 * 焦点契约(2026-10-23 真机 flake 实证):斜杠弹层打开后焦点必须进入面板内的搜索 INPUT。
 * 焦点留在 composer 时,Esc 被 composer 自己的 keydown 吞掉(不冒泡到 document),
 * PortalPanel 的 document 级 Esc 与面板 onKeyDown 都收不到 ⇒ 表现为"Esc 完全无效"。
 * 这不是断言噪声而是产品契约:打开浮层即夺焦,否则键盘退出路径不存在。
 */
const focusInsideSlashPanel = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector('[data-testid="slash-command-palette"]')
    const active = document.activeElement
    return !!panel && !!active && panel.contains(active)
  })

async function expectSlashFocus(page: Page) {
  await expect
    .poll(() => focusInsideSlashPanel(page), {
      timeout: 10_000,
      message: '斜杠弹层打开后焦点必须进入面板(留在 composer 时 Esc 会被 composer 吞掉)',
    })
    .toBe(true)
}

test.describe('Esc 无层栈协议:真机三层叠开逐层退出', () => {
  test('遮罩+弹层+模态三层叠开:一次 Esc 只关最上层,逐层退到底;复开无幽灵', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/chat')
    await waitForComposer(page)
    const slashTrigger = page.locator('span[aria-haspopup="dialog"]')
    const slashPanel = page.getByTestId(SLASH_TESTID)
    const helpMask = page.getByTestId(HELP_TESTID)

    // —— 依次开三层(全键盘,零 mousedown)——
    await page.keyboard.press('Control+Shift+/')
    await expect(slashPanel, 'Ctrl+Shift+/ 应打开斜杠弹层(L1)').toBeVisible({ timeout: 10_000 })
    await expect(slashTrigger).toHaveAttribute('aria-expanded', 'true')
    await expectSlashFocus(page)

    await page.keyboard.press('Control+/')
    await expect(helpMask, 'Ctrl+/ 应打开帮助遮罩(L2)').toBeVisible({ timeout: 10_000 })

    await page.keyboard.press('Control+k')
    await expect
      .poll(() => openPaletteCount(page), { timeout: 10_000, message: 'Ctrl+K 应打开命令面板(L3)' })
      .toBe(1)

    // —— 第 1 下 Esc:只关栈顶模态;遮罩与弹层必须保持 ——
    await page.keyboard.press('Escape')
    await expect
      .poll(() => openPaletteCount(page), {
        timeout: 10_000,
        message: '一次 Esc 只应关掉最上层命令面板',
      })
      .toBe(0)
    await expect(helpMask, '遮罩层必须保持打开(Esc 不许广播)').toBeVisible()
    await expect(slashPanel, '弹层必须保持打开(Esc 不许广播)').toBeVisible()
    await expect(slashTrigger).toHaveAttribute('aria-expanded', 'true')

    // 关闭动画期间 Radix Presence 仍挂载,popOverlay 挂卸载 ⇒ 命令面板 id 尚在栈顶
    // (协议设计:动画窗口内的 Esc 被自家 guard 吞掉,防一次 Esc 连关两层)。
    // 尺子 data-state=0 早于 unmount,须等节点真卸载(栈 pop 完成)再按下一层,
    // 否则第 2 下 Esc 落进动画窗口被拦 —— 真机 flaky 实锤(2026-10-23)。
    await expect
      .poll(() => page.locator('[data-testid="command-palette"]').count(), {
        timeout: 10_000,
        message: '命令面板关闭动画应结束(DOM 卸载 = 层栈 pop)',
      })
      .toBe(0)

    // —— 第 2 下 Esc:关遮罩,弹层仍开(反向对照:下层确实关得掉)——
    await page.keyboard.press('Escape')
    await expect
      .poll(() => helpMask.count(), { timeout: 10_000, message: '第二下 Esc 应关掉帮助遮罩' })
      .toBe(0)
    await expect(slashPanel).toBeVisible()

    // —— 第 3 下 Esc:关弹层,层栈退空 ——
    await page.keyboard.press('Escape')
    await expect
      .poll(() => slashPanel.count(), { timeout: 10_000, message: '第三下 Esc 应关掉斜杠弹层' })
      .toBe(0)
    await expect(slashTrigger).toHaveAttribute('aria-expanded', 'false')

    // —— 复开对照:上面三次关闭都应已 pop;若层栈留了幽灵条目,这一格 Esc 关不掉复开的弹层 ——
    await page.keyboard.press('Control+Shift+/')
    await expect(slashPanel, '复开斜杠弹层应成功').toBeVisible({ timeout: 10_000 })
    await expectSlashFocus(page)
    await page.keyboard.press('Escape')
    await expect
      .poll(() => slashPanel.count(), {
        timeout: 10_000,
        message: '复开的弹层必须仍被一次 Esc 关掉(层栈无幽灵条目)',
      })
      .toBe(0)
  })

  test('单层基线:三层各自单独打开时,一次 Esc 各关各的(栈顶守卫不得误拦唯一层)', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/chat')
    await waitForComposer(page)

    // 弹层单独开、单独关
    await page.keyboard.press('Control+Shift+/')
    await expect(page.getByTestId(SLASH_TESTID)).toBeVisible({ timeout: 10_000 })
    await expectSlashFocus(page)
    await page.keyboard.press('Escape')
    await expect
      .poll(() => page.getByTestId(SLASH_TESTID).count(), {
        timeout: 10_000,
        message: '单层弹层:Esc 必须直接生效',
      })
      .toBe(0)

    // 遮罩单独开、单独关
    await page.keyboard.press('Control+/')
    await expect(page.getByTestId(HELP_TESTID)).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect
      .poll(() => page.getByTestId(HELP_TESTID).count(), {
        timeout: 10_000,
        message: '单层遮罩:Esc 必须直接生效',
      })
      .toBe(0)

    // 模态单独开、单独关(命令面板 UI 里印着 ESC 键帽,它必须真的管用)
    await page.keyboard.press('Control+k')
    await expect
      .poll(() => openPaletteCount(page), { timeout: 10_000, message: '单层命令面板:应能打开' })
      .toBe(1)
    await page.keyboard.press('Escape')
    await expect
      .poll(() => openPaletteCount(page), {
        timeout: 10_000,
        message: '单层命令面板:Esc 必须关掉它',
      })
      .toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
