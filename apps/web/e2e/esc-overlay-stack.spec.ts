// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Esc 无层栈协议 —— 真机逐层退出断言(2026-10-23 立,结台账「Esc 无层栈协议」票面最后一格)。
 *
 * 为什么需要这个文件:`apps/web/src/lib/overlay-stack-three-layer.test.tsx:303` 自己点名
 * 「票面要求的"三层叠开真机 aria-expanded 断言"需要真机环境,留持有人」—— jsdom/happy-dom 里
 * 那次 Esc 是一次 `fireEvent.keyDown`,而真实浏览器里 Radix 的 `onEscapeKeyDown`、Portal、
 * 焦点陷阱与 `document` keydown 的传播顺序全都不同。层栈协议最容易失效的恰恰是这一维:
 * 假绿的那一型是"Esc 谁都没关掉"(jsdom 里靠组件自己的 state 断言看不出来),
 * 所以本文件每条"只关最上层"都配一条"再按一次下层确实关"的反向对照。
 *
 * 取材刻意**不 import `./fixtures`**:fixtures 在模块加载期就 `requireEnv('E2E_ADMIN_PASSWORD')`,
 * 缺 env 会让整个 collection 报成 "No tests found"(2026-10-23 实测),而本文件验的是纯前端
 * 键盘协议,结构上不需要登录态。
 *
 * ⚠️ 跑法(2026-10-24 更正,B67):头注旧版写的「E2E_SKIP_SEED=1 + --no-deps、不需要 seed/连库」
 * **已证不可行**——③ 的生态入口依赖 API 数据(须 8801 web dev + 后端可达),且 SKIP 路径缺
 * globalSetup 副作用(test 用户被上轮 teardown 清掉后 knowledge/notifications 断链)会让 ①③
 * 协议弹窗不叠开(采样矩阵:带 seed 三次 3 passed / SKIP 三次 2 failed,零反例)。现行跑法:
 *   cd apps/web && E2E_ADMIN_PASSWORD=<测试口令> pnpm exec playwright test e2e/esc-overlay-stack.spec.ts
 * (不带 SKIP、不挂 --no-deps;globalSetup 幂等 seed 后本 spec 三连 3 passed。)
 *
 * 场景选型(2026-10-23 真机实测得出,不是挑出来的):
 *  - 三层"遮罩+弹层+pane"在**免登录面**上结构上叠不开 —— 顶栏生态 Popover 一被 Radix modal
 *    Dialog 抢走 pointer-events 就当场点外关闭(实测 `aria-expanded` true→false 与 dialog 打开
 *    同瞬间发生)。票面那三层的构造已由上面那个 jsdom 文件承担,本文件承担的是真机维:
 *    modal-in-modal(最难的一型)+ 自绘层的 `aria-expanded` + **点外关闭后栈里不许留幽灵**。
 *  - 幽灵条目是本协议唯一"看起来一切正常"的失效形态:浮层被点外关掉却没 popOverlay,
 *    栈顶永远是那个已经不在 DOM 里的 id ⇒ 之后的每一个 Esc 都被它压住,而每一次关闭
 *    看起来都"合理"。故用例③之后必须再开一次自绘层并按 Esc。
 *
 * 变异矩阵(2026-10-23 现跑,证本文件到底有没有牙 —— 改 `packages/ui-react/src/lib/overlay-stack.ts`
 * 的 `isTopOverlay` 后跑本文件,跑完按 blob sha 还原并核验;两份 `ui-react` 入口是 `./src/index.ts`
 * 且在 `next.config` 的 transpilePackages 里 ⇒ 改动确实热更进浏览器,这一条由"恒假档翻红"反证):
 *   · 恒假(守卫谁都拦)   ⇒ 本文件 **3 条全红** ✓ —— 判得到"协议过度拦截"(Esc 被误吞)。
 *   · 恒真(守卫形同虚设) ⇒ 本文件 **3 条全绿** ✗ —— **判不到**"协议过度放行":嵌套 Radix Dialog
 *     的 Esc 由其自身 dismissable-layer 栈承担,外层压根收不到 keydown,故恒真与正常态在免登录面上
 *     结构上不可区分。要咬住那一维,必须叠开两个**自绘层**(非 Radix,即 /chat 的 slash 面板 /
 *     work-panel 那一族)—— 那需要登录态,本机被 e2e 侧 `password authentication failed for user
 *     "ihui"` 与 `E2E_ADMIN_PASSWORD` 必填挡住,故本文件结的是"真机 modal-in-modal + 幽灵检测"
 *     这两格,三层自绘叠开那一格仍在票上(台账「Esc 无层栈协议」未翻勾的原因即此)。
 */

const LOGIN_ENTRY = 'button:has-text("请先登录")'
const ECOSYSTEM_TRIGGER = 'global-topbar-ecosystem-trigger'

/** 层的存在性按 DOM 数,不按可访问性树 —— 理由见 expectDialogs 注记②。 */
const dialogCount = (page: Page) =>
  page.evaluate(() => document.querySelectorAll('[role="dialog"]').length)

/**
 * 计数断言的唯一写法。两条都不是审美:
 *  ① message 必须进 `poll` 的 options,不能当 matcher 的第二实参 —— Playwright 的 `toBe` 只收
 *    1 个实参,写成 `toBe(2, '文案')` 会被 `e2e/tsconfig.json` 报 TS2554(2026-10-23 实测 7 条;
 *    该检查面此前全项目 0 错,所以那 7 条红全是本文件自己引入的)。
 *  ② 定位一律用 `[role="dialog"]` 的 DOM 计数,不用 `getByRole('dialog')` —— Radix 在 modal 套
 *    modal 时给**非活动**那层 wrapper 打 `aria-hidden`,可访问性树里只剩一层,`nth(1)` 永远等不到
 *    (实测:DOM 数到 2 个而 nth(1) 超时)。断言与被断言的两把尺子必须在同一坐标系里。
 */
const expectDialogs = (page: Page, count: number, message: string, timeout = 15000) =>
  expect.poll(() => dialogCount(page), { timeout, message }).toBe(count)

test.describe('Esc 无层栈协议:真机逐层退出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 登录入口在侧栏用户区,首屏水合后才挂上;用可见性等它,不用固定 sleep
    await expect(page.locator(LOGIN_ENTRY).first()).toBeVisible({ timeout: 20000 })
  })

  test('① modal-in-modal:协议弹窗叠在登录弹窗上,一次 Esc 只关最上层,再按一次才关底层', async ({
    page,
  }) => {
    const loginDialog = page.getByTestId('login-dialog')
    await page.locator(LOGIN_ENTRY).first().click()
    await expect(loginDialog).toHaveAttribute('data-state', 'open', { timeout: 15000 })
    // 不勾协议直接提交 ⇒ 协议弹窗作为第二层叠上来(Radix modal 套 modal)
    await page.getByTestId('login-submit').click()
    await expectDialogs(page, 2, '协议弹窗应叠在登录弹窗之上,而不是替换它')

    const agreement = page.locator('[role="dialog"]').nth(1)
    await expect(agreement).toHaveAttribute('data-state', 'open')

    await page.keyboard.press('Escape')
    // 票面的核心语义:协议层从 DOM 退场,登录层必须仍是 open
    await expectDialogs(page, 1, '一次 Esc 只应关掉最上层(协议弹窗)', 10000)
    await expect(loginDialog).toHaveAttribute('data-state', 'open')

    // 反向对照:再按一次,底层确实关。缺了它,"只关最上层"可能只是"Esc 完全无效"的另一种长相
    await page.keyboard.press('Escape')
    await expectDialogs(page, 0, '逐层退出:第二下 Esc 应关掉登录弹窗', 10000)
  })

  test('② 单层反向对照:没有叠层时一次 Esc 就关掉登录弹窗', async ({ page }) => {
    const loginDialog = page.getByTestId('login-dialog')
    await page.locator(LOGIN_ENTRY).first().click()
    await expect(loginDialog).toHaveAttribute('data-state', 'open', { timeout: 15000 })
    await expectDialogs(page, 1, '应当只有一层登录弹窗', 10000)
    await page.keyboard.press('Escape')
    await expectDialogs(
      page,
      0,
      '单层时 Esc 必须直接生效(否则用例①的"底层仍 open"不构成协议生效的证据)',
      10000,
    )
  })

  test('③ 点外关闭不得留幽灵:生态 Popover 被 Dialog 顶掉后,后续浮层的 Esc 仍要正常', async ({
    page,
  }) => {
    const trigger = page.getByTestId(ECOSYSTEM_TRIGGER)
    const loginDialog = page.getByTestId('login-dialog')

    // 自绘栈层用 aria-expanded 判(票面要求的另一维),它不是 Radix Dialog 而是 topbar 自绘 portal
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 10000 })

    // 点登录入口:生态 Popover 当场被点外关闭。协议要求它同时 popOverlay —— 这一步机器上不可见,
    // 只能靠"之后的 Esc 有没有被一个已经不存在的浮层压住"反证,所以下面两断言才是本用例的正身。
    await page.locator(LOGIN_ENTRY).first().click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false', { timeout: 10000 })
    await expect(loginDialog).toHaveAttribute('data-state', 'open', { timeout: 15000 })

    await page.getByTestId('login-submit').click()
    await expectDialogs(page, 2, '协议弹窗应叠在登录弹窗之上')
    await page.keyboard.press('Escape')
    await expectDialogs(
      page,
      1,
      '被顶掉的自绘层若没出栈,这一下会被幽灵条目吃掉而一个浮层都不关',
      10000,
    )
    await expect(loginDialog).toHaveAttribute('data-state', 'open')
    await page.keyboard.press('Escape')
    await expectDialogs(page, 0, '逐层退出到底', 10000)

    // 复开同一条自绘层并按 Esc:若上面任何一次没 pop,这一层会被压在栈里、Esc 关不掉它
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 10000 })
    await page.keyboard.press('Escape')
    await expect(trigger, 'Esc 必须关掉栈顶的自绘浮层(栈里没有幽灵)').toHaveAttribute(
      'aria-expanded',
      'false',
      { timeout: 10000 },
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
