/**
 * AI 浮窗标题栏样式 scope 失配回归测试 (2026-07-03)
 *
 * 防回归目标：chatheaderbar.vue 子组件内部元素样式（.header-left/.header-right/.mode-tag 等）
 * 曾被写在 _header.scss 中，被 AIChat.vue scoped 块 @use 引入后，编译器给选择器加
 * [data-v-f3f3558b] 后缀，但子组件内部元素不接收父 scope attr → 选择器失配 → 样式永不生效。
 *
 * 修复：子组件内部元素样式迁移至 chatheaderbar.vue 自己的 <style scoped lang="scss"> 块，
 * 根元素 .dialog-header 本身样式仍保留在 _header.scss（子组件根元素接收父 scope attr）。
 *
 * 验证项：
 * 1) 源码级：chatheaderbar.vue 必须有 <style scoped lang="scss"> 块
 * 2) 源码级：chatheaderbar.vue style 块必须含 .header-right { gap: 8px }
 * 3) 源码级：chatheaderbar.vue style 块必须含 .header-left / .header-center / .typing-indicator / .minimized-model-info
 * 4) 源码级：chatheaderbar.vue style 块必须含 @keyframes typing
 * 5) 源码级：_header.scss 不再含 .header-right / .header-left / .header-center / .typing-indicator / .minimized-model-info
 * 6) 源码级：AIChat.vue 不再含 @keyframes typing（已迁移）
 * 7) 源码级：AIChat.vue 不再含 :deep(.dialog-header .header-right)（临时修复已删除）
 * 8) 源码级：AIChat.vue .quick-tool-item 必须用 var(--global-border-radius-sm)
 * 9) 浏览器级（需 PW_BASE_URL）：.header-right display === 'flex' && gap === '8px'
 * 10) 浏览器级（需 PW_BASE_URL）：.header-right 子元素间距 >= 7px
 * 11) 浏览器级（需 PW_BASE_URL）：.quick-tool-item borderRadius 落在 [3px, 5px]
 *
 * CI 入口：npx playwright test ai-header-style-scope.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const CHAT_HEADER_BAR = readFileSync(join(ROOT, 'src/components/ai/chat-parts/chatheaderbar.vue'), 'utf8')
const HEADER_SCSS = readFileSync(join(ROOT, 'src/styles/ai-chat/_header.scss'), 'utf8')
const AI_CHAT_VUE = readFileSync(join(ROOT, 'src/components/ai/AIChat.vue'), 'utf8')

const HAS_PW_BASE_URL = !!process.env.PW_BASE_URL

// ========== 源码级断言（不需要浏览器） ==========

test.describe('AI 浮窗标题栏样式 scope 失配 - 源码级守门', () => {
  test('1. chatheaderbar.vue 必须有 <style scoped lang="scss"> 块', () => {
    expect(CHAT_HEADER_BAR).toMatch(/<style\s+scoped\s+lang="scss">/)
  })

  test('2. chatheaderbar.vue style 块必须含 .header-right { gap: 8px }', () => {
    // 在 .dialog-header 嵌套内的 .header-right
    expect(CHAT_HEADER_BAR).toMatch(/\.header-right\s*\{[^}]*gap:\s*8px/)
  })

  test('3. chatheaderbar.vue style 块必须含全部子组件内部元素选择器', () => {
    const requiredSelectors = ['.header-left', '.header-center', '.header-right', '.typing-indicator', '.minimized-model-info']
    for (const sel of requiredSelectors) {
      expect(CHAT_HEADER_BAR).toContain(sel)
    }
  })

  test('4. chatheaderbar.vue style 块必须含 @keyframes typing', () => {
    expect(CHAT_HEADER_BAR).toMatch(/@keyframes\s+typing/)
  })

  test('5. _header.scss 不再含子组件内部元素的 CSS 规则（已迁移）', () => {
    // 检查实际 CSS 规则（选择器后跟 {），而非注释中的文字
    const removedSelectors = [
      /\.header-right\s*\{/,
      /\.header-left\s*\{/,
      /\.header-center\s*\{/,
      /\.typing-indicator\s*\{/,
      /\.minimized-model-info\s*\{/,
    ]
    for (const re of removedSelectors) {
      expect(HEADER_SCSS).not.toMatch(re)
    }
  })

  test('6. _header.scss 仅保留 .dialog-header 根元素样式', () => {
    expect(HEADER_SCSS).toMatch(/\.dialog-header\s*\{/)
    // 不应含嵌套子选择器
    expect(HEADER_SCSS).not.toMatch(/\.dialog-header\s*\{[\s\S]*?\.\w/)
  })

  test('7. AIChat.vue 不再含 @keyframes typing（已迁移至子组件）', () => {
    expect(AI_CHAT_VUE).not.toMatch(/@keyframes\s+typing\s*\{/)
  })

  test('8. AIChat.vue 不再含 :deep(.dialog-header .header-right) 临时修复', () => {
    expect(AI_CHAT_VUE).not.toMatch(/:deep\(\.dialog-header\s+\.header-right\)/)
  })

  test('9. AIChat.vue .quick-tool-item 必须用 var(--global-border-radius-sm)', () => {
    expect(AI_CHAT_VUE).toMatch(/\.quick-tool-item\s*\{[^}]*border-radius:\s*var\(--global-border-radius-sm\)/)
  })
})

// ========== 浏览器级断言（需要 PW_BASE_URL + dev server） ==========

test.describe('AI 浮窗标题栏样式 scope 失配 - 浏览器级守门', () => {
  test.skip(!HAS_PW_BASE_URL, '需要 PW_BASE_URL 环境变量 + dev server 运行')

  async function openFloatingChat(page: Page): Promise<void> {
    await page.goto(process.env.PW_BASE_URL!, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)
    await page.evaluate(() => (window as any).openFloatingChat?.())
    await page.waitForTimeout(2500)
    await page.waitForSelector('.floating-chat-dialog .dialog-header', { state: 'visible', timeout: 10000 })
  }

  test('10. .header-right display === flex && gap === 8px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openFloatingChat(page)

    const style = await page.evaluate(() => {
      const hr = document.querySelector('.floating-chat-dialog .header-right')
      if (!hr) return null
      const cs = getComputedStyle(hr)
      return { display: cs.display, gap: cs.gap }
    })

    expect(style).not.toBeNull()
    expect(style!.display).toBe('flex')
    expect(style!.gap).toBe('8px')
  })

  test('11. .header-right 子元素间距 >= 7px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openFloatingChat(page)

    const gaps = await page.evaluate(() => {
      const hr = document.querySelector('.floating-chat-dialog .header-right')
      if (!hr || hr.children.length < 2) return null
      const result: number[] = []
      for (let i = 1; i < hr.children.length; i++) {
        const prev = hr.children[i - 1].getBoundingClientRect()
        const curr = hr.children[i].getBoundingClientRect()
        result.push(Math.round(curr.x - prev.right))
      }
      return result
    })

    expect(gaps).not.toBeNull()
    for (const g of gaps!) {
      expect(g).toBeGreaterThanOrEqual(7)
    }
  })

  test('12. .quick-tool-item borderRadius 落在 [3px, 5px]', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openFloatingChat(page)

    const radius = await page.evaluate(() => {
      const qti = document.querySelector('.floating-chat-dialog .quick-tool-item')
      if (!qti) return null
      return getComputedStyle(qti).borderRadius
    })

    expect(radius).not.toBeNull()
    const px = parseFloat(radius!)
    expect(px).toBeGreaterThanOrEqual(3)
    expect(px).toBeLessThanOrEqual(5)
  })
})
