// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

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
 * 所以本测试一律读 `getComputedStyle().borderTopColor`,焦点/强调色把期望值**取自 CSS 变量本身**
 * (同页注入一个 `color: var(--x)` 探针再读回),不在测试里抄第二份 rgb 字面量 ——
 * token 改了测试跟着改,而不是测试把 token 的旧值钉成契约。
 *
 * 三条不可漂的口径(2026-11-23 用户定档:对齐 web 旧档「灰描边 + 紫色辉光」):
 *  1. 静息与聚焦都保留 1px field 灰描边 —— 取 `--color-input`(与 RN `stroke.field` 同值);
 *  2. 聚焦只加对称双层紫辉光,取 `--color-ai-input-glow-soft` / `--color-ai-input-glow-strong`
 *     单一 token;近层 8px / 10%,远层 22px -2px / 18%,不得回取 `--chart-5` 或端内写 rgba;
 *  3. 带 transition 的属性必须用 `expect.poll` 读,不许"点完立刻读一次" —— 实测 150ms
 *     过渡会让瞬时读值拿到起点,把一个正常的实现判成回归(本仓已在此处白排查过一轮)。
 */

const SHELL = '.ai-input-shell'

/** 在页面内解析一个 CSS 变量的计算值(经由 color 属性,返回 rgb()/rgba() 文本)。 */
async function resolveVar(page: Page, cssVar: string): Promise<string> {
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
function borderOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`元素不存在: ${sel}`)
    return getComputedStyle(el).borderTopColor
  }, selector)
}

/** 注入一个只带语义修饰类的探针,读它算出的边框色(证明 CSS 对该态给色,不依赖产品状态)。 */
function probeClass(page: Page, modifier: string) {
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

/** 读元素上的 box-shadow 计算值(用于紫辉光两层的到端断言)。 */
function shadowOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`元素不存在: ${sel}`)
    return getComputedStyle(el).boxShadow
  }, selector)
}

async function focusShell(page: Page) {
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

  test('静止态保留 1px field 灰描边,不透明也不消失', async ({ authenticatedPage: page }) => {
    const field = await resolveVar(page, '--color-input')
    expect(await borderOf(page, SHELL), '静止态描边应取 --color-input').toBe(field)
    expect(await shadowOf(page, SHELL), '静止态不应有辉光').toBe('none')
  })

  test('聚焦态只加双层紫辉光,描边仍是 field 灰', async ({ authenticatedPage: page }) => {
    const field = await resolveVar(page, '--color-input')
    await focusShell(page)
    await expect
      .poll(() => borderOf(page, SHELL), { timeout: 3000, message: '聚焦态描边被换成墨色' })
      .toBe(field)
    // box-shadow 同属 transition 属性:点完立刻读会拿到过渡起点(实测 rgb 透明度只有 0.004),
    // 必须等它收敛到终值再断言两层,否则把正常实现判成回归。
    await expect
      .poll(() => shadowOf(page, SHELL), { timeout: 3000, message: '近层紫辉光未收敛' })
      .toContain('rgba(139, 92, 246, 0.1) 0px 0px 8px 0px')
    const shadow = await shadowOf(page, SHELL)
    expect(shadow, '聚焦态缺少远层紫辉光').toContain('rgba(139, 92, 246, 0.18) 0px 0px 22px -2px')
  })

  test('高危与拖拽两态各自给色,不与静止态同色', async ({ authenticatedPage: page }) => {
    const idle = await probeClass(page, 'ai-input-shell--idle')
    const dragging = await probeClass(page, 'ai-input-shell--dragging')
    const highRisk = await probeClass(page, 'ai-input-shell--high-risk')
    const field = await resolveVar(page, '--color-input')
    const accent = await resolveVar(page, '--color-brand-accent-deep')

    expect(idle, '静止态应取 field 灰描边').toBe(field)
    expect(dragging, '拖拽态描边应取品牌绿 --color-brand-accent-deep').toBe(accent)
    expect(highRisk, '高危态必须与静止态视觉区分(16% 中档),不得同色').not.toBe(idle)
    expect(dragging, '拖拽态不得与静止态同色').not.toBe(idle)
  })

  test('强调色主题下紫辉光仍取 token 单源,不被 data-accent 染色', async ({
    authenticatedPage: page,
  }) => {
    // violet 档把 --color-primary 覆盖成紫色;辉光必须仍取 --color-ai-input-glow-* 的固定紫。
    await page.evaluate(() => {
      document.documentElement.dataset.accent = 'violet'
    })
    const primary = await resolveVar(page, '--color-primary')
    expect(primary, '前提失效: violet 档未覆盖 --color-primary').not.toBe('rgb(0, 0, 0)')

    await focusShell(page)
    const field = await resolveVar(page, '--color-input')
    await expect
      .poll(() => borderOf(page, SHELL), { timeout: 3000, message: 'violet 档描边被强调色染色' })
      .toBe(field)
    await expect
      .poll(() => shadowOf(page, SHELL), { timeout: 3000, message: 'violet 档紫辉光未收敛' })
      .toContain('rgba(139, 92, 246, 0.1) 0px 0px 8px 0px')
    const shadow = await shadowOf(page, SHELL)
    expect(shadow, 'violet 档紫辉光应保持 token 原值').not.toContain('106, 31, 234')
  })

  test('暗色档案:描边取暗色 field 灰,紫辉光保持同值', async ({ authenticatedPage: page }) => {
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    const field = await resolveVar(page, '--color-input')
    expect(field, '暗色 field 描边应是 16% 白').toBe('rgba(255, 255, 255, 0.16)')

    await expect.poll(() => probeClass(page, 'ai-input-shell--idle'), { timeout: 3000 }).toBe(field)

    await focusShell(page)
    await expect
      .poll(() => borderOf(page, SHELL), { timeout: 3000, message: '暗色聚焦描边未取 field 灰' })
      .toBe(field)
    await expect
      .poll(() => shadowOf(page, SHELL), { timeout: 3000, message: '暗色紫辉光未收敛' })
      .toContain('rgba(139, 92, 246, 0.18) 0px 0px 22px -2px')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
