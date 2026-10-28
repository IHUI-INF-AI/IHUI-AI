// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * AI 输入卡描边四态到端守门(2026-09-30 立)
 *
 * 立的理由(不是"顺手补个测试"):本文件 :210 的 `* { border-color: var(--color-border) }` 是
 * **未分层**规则,而 Tailwind v4 的全部工具类在 `@layer utilities` 内 —— 按 CSS 级联规范,
 * 未分层声明恒胜过任何分层声明,与 specificity 无关。后果是输入卡写上去的
 * `border-input` / `border-amber-500/50` / `border-brand-accent-deep` / `focus-within:border-*`
 * **一条都不渲染**,四态在屏幕上永远是同一个灰(实测编译产物 `* => var(--color-border)` 落在
 * unlayered 顶层,而 `.border-input` 等在 @layer utilities)。这类缺陷的特征是
 * "代码写了、typecheck 绿、构建绿、截图看着也正常",只有量计算值才看得见。
 *
 * 所以本测试一律读 `getComputedStyle().borderTopColor`,并把期望值**取自 CSS 变量本身**
 * (同页注入一个 `color: var(--x)` 探针再读回),不在测试里抄第二份 rgb 字面量 ——
 * token 改了测试跟着改,而不是测试把 token 的旧值钉成契约。
 *
 * 三条不可漂的口径:
 *  1. 静止态必须等于 `--color-input` 且**不等于** `--color-border` —— 后者正是"被 `*` 压制"
 *     的指纹;哪天规则被搬回 `@layer`(或被删)导致重新落灰,这一条先红。
 *  2. 聚焦态必须等于 `--color-primary`(墨档)= AGENTS §4「描边不得取墨档」的唯一例外位。
 *  3. 带 transition 的属性必须用 `expect.poll` 读,不许"点完立刻读一次" —— 实测 150ms
 *     过渡会让瞬时读值拿到起点,把一个正常的实现判成回归(本仓已在此处白排查过一轮)。
 */

const SHELL = '.ai-input-shell'

/** 在页面内解析一个 CSS 变量的计算值(经由 color 属性,返回 rgb()/rgba() 文本)。 */
async function resolveVar(page: import('@playwright/test').Page, cssVar: string): Promise<string> {
  return page.evaluate((v) => {
    const d = document.createElement('div')
    d.style.color = `var(${v})`
    d.style.display = 'none'
    document.body.appendChild(d)
    const got = getComputedStyle(d).color
    d.remove()
    return got
  }, cssVar)
}

/** 读元素上边框的计算色(用 borderTopColor:四边各自独立,不受单边覆盖规则干扰)。 */
function borderOf(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`元素不存在: ${sel}`)
    return getComputedStyle(el).borderTopColor
  }, selector)
}

/** 注入一个只带语义修饰类的探针,读它算出的边框色(证明 CSS 对该态给色,不依赖产品状态)。 */
function probeClass(page: import('@playwright/test').Page, modifier: string) {
  return page.evaluate((m) => {
    const d = document.createElement('div')
    d.className = `ai-input-shell ${m} border`
    d.style.width = '40px'
    d.style.height = '20px'
    document.body.appendChild(d)
    const got = getComputedStyle(d).borderTopColor
    d.remove()
    return got
  }, modifier)
}

async function focusShell(page: import('@playwright/test').Page) {
  // 选择器必须在 Node 侧拼好再作为参数传入:写在 evaluate 体内会让浏览器去找 SHELL 这个
  // Node 端常量 ⇒ ReferenceError,而失败形状与"实现没生效"长得一样(本轮就是这么红过一次)
  await page.evaluate((sel) => {
    const ta = document.querySelector(sel) as HTMLTextAreaElement | null
    if (!ta) throw new Error(`输入卡内未找到 textarea: ${sel}`)
    ta.focus()
  }, `${SHELL} textarea`)
}

test.describe('AI 输入卡描边四态(未分层 * 规则压制整族 border 颜色工具类)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/chat')
    await page.waitForSelector(SHELL, { timeout: 30000 })
  })

  test('静止态描边取 --color-input,而不是被 * 压成的 --color-border', async ({ authenticatedPage: page }) => {
    const [expectedInput, suppressedBorder, actual] = await Promise.all([
      resolveVar(page, '--color-input'),
      resolveVar(page, '--color-border'),
      borderOf(page, SHELL),
    ])
    // 前置:两档 token 本身必须可区分,否则下面"不等于 border"这条断言是空的(假绿)
    expect(expectedInput).not.toBe(suppressedBorder)
    expect(actual, '静止态描边没渲染出 --color-input(疑似被未分层 * 规则压制)').toBe(expectedInput)
    expect(actual, '静止态描边落在 --color-border = 那条 * 规则赢了,四态全部失效').not.toBe(suppressedBorder)
  })

  test('聚焦态描边取墨档 --color-primary(AGENTS §4 唯一例外位)', async ({ authenticatedPage: page }) => {
    const ink = await resolveVar(page, '--color-primary')
    await focusShell(page)
    // transition-[border-color] 150ms:立刻读一次会拿到过渡起点,必须 poll
    await expect
      .poll(() => borderOf(page, SHELL), { timeout: 3000, message: '聚焦态描边未到 --color-primary' })
      .toBe(ink)
  })

  test('高危与拖拽两态各自给色,不与静止态同色', async ({ authenticatedPage: page }) => {
    const idle = await probeClass(page, 'ai-input-shell--idle')
    const dragging = await probeClass(page, 'ai-input-shell--dragging')
    const highRisk = await probeClass(page, 'ai-input-shell--high-risk')
    const accent = await resolveVar(page, '--color-brand-accent-deep')

    expect(dragging, '拖拽态描边应取品牌绿 --color-brand-accent-deep').toBe(accent)
    expect(highRisk, '高危态必须与静止态视觉区分(琥珀档),不得同色').not.toBe(idle)
    expect(dragging, '拖拽态不得与静止态同色').not.toBe(idle)
    expect(highRisk, '高危态不得与聚焦墨档同色(高危分支的 focus-within 另有其色)').not.toBe(
      await resolveVar(page, '--color-primary'),
    )
  })

  test('暗色档案:静止取暗档 --color-input,聚焦取纯白墨档', async ({ authenticatedPage: page }) => {
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    const expectedInput = await resolveVar(page, '--color-input')
    const ink = await resolveVar(page, '--color-primary')

    await expect
      .poll(() => probeClass(page, 'ai-input-shell--idle'), { timeout: 3000 })
      .toBe(expectedInput)

    await focusShell(page)
    await expect
      .poll(() => borderOf(page, SHELL), { timeout: 3000, message: '暗色聚焦态描边未到纯白墨档' })
      .toBe(ink)
    // 墨档在暗色下必须随主题反转(否则暗底黑边 = 隐形)
    expect(ink, '暗色档案下 --color-primary 必须是亮值').toBe('rgb(255, 255, 255)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
