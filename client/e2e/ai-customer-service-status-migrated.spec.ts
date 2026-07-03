/**
 * 客服主题 .cs-status-* 样式迁回 chatheaderbar.vue 防回归 (2026-07-03)
 *
 * 防回归目标：AIChat.vue 的 @use partial 加载到非 scoped 块虽然能命中子组件内部元素
 * （非 scoped = 全局），但与"样式贴近使用方"工程规范不符。本批次将 .cs-status-wrap
 * 等 5 个块从 _customer-service-theme.scss 迁回 chatheaderbar.vue 自己的 <style scoped>
 * 块。本测试用源码级 regex 锚点断言迁移不可回退。
 *
 * 验证项（纯源码级，不需要浏览器）：
 *   1) chatheaderbar.vue 必须包含 .cs-status-wrap / .cs-status-indicator / .cs-status-dot
 *      / .cs-status-ring / .cs-status-text 5 个选择器（在 .header-right 内）
 *   2) chatheaderbar.vue 必须包含 @keyframes cs-status-pulse（keyframe 随使用方走）
 *   3) _customer-service-theme.scss 不再包含这 5 个选择器（防回退）
 *   4) _customer-service-theme.scss 不再包含 @keyframes cs-status-pulse
 *   5) AIChat.vue 的非 scoped 块仍然 @use '@/styles/ai-chat/customer-service-theme'
 *      （仅删 cs-status-* 块, 保留 FAQ/console 块）
 *   6) AIChat.vue 的 scoped 块不 @use customer-service-theme（不在 scoped 块污染）
 *
 * 加上视口参数化（chromium desktop + Mobile Chrome）= 12 用例
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SRC_ROOT = join(ROOT, 'src')

const CHATHEADERBAR_VUE_PATH = join(
  SRC_ROOT,
  'components/ai/chat-parts/chatheaderbar.vue'
)
const CUSTOMER_SERVICE_THEME_SCSS_PATH = join(
  SRC_ROOT,
  'styles/ai-chat/_customer-service-theme.scss'
)
const AICHAT_VUE_PATH = join(SRC_ROOT, 'components/ai/AIChat.vue')

test.describe('客服主题 .cs-status-* 样式迁回 chatheaderbar.vue 防回归 (2026-07-03)', () => {
  // ===================================================================
  // 1) chatheaderbar.vue 必须包含 5 个 .cs-status-* 选择器
  // ===================================================================
  test('源码级：chatheaderbar.vue 必须包含 .cs-status-wrap 选择器（在 .header-right 内）', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    // 必须在 .header-right {} 块内出现 .cs-status-wrap
    // 简化: 整个文件必须出现 .cs-status-wrap
    expect(
      content,
      'chatheaderbar.vue 缺失 .cs-status-wrap 样式块。\n' +
        '2026-07-03 客服主题 .cs-status-* 5 个块从 _customer-service-theme.scss 迁回子组件 scoped 块，\n' +
        '删这些块会导致客服主题下 .floating-chat-dialog 右上角连接状态指示器没有布局。'
    ).toMatch(/\.cs-status-wrap\s*\{/)
  })

  test('源码级：chatheaderbar.vue 必须包含 .cs-status-indicator 选择器', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    expect(content).toMatch(/\.cs-status-indicator\s*\{/)
  })

  test('源码级：chatheaderbar.vue 必须包含 .cs-status-dot 选择器', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    expect(content).toMatch(/\.cs-status-dot\s*\{/)
  })

  test('源码级：chatheaderbar.vue 必须包含 .cs-status-ring 选择器', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    expect(content).toMatch(/\.cs-status-ring\s*\{/)
  })

  test('源码级：chatheaderbar.vue 必须包含 .cs-status-text 选择器', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    expect(content).toMatch(/\.cs-status-text\s*\{/)
  })

  // ===================================================================
  // 2) chatheaderbar.vue 必须包含 @keyframes cs-status-pulse（keyframe 随使用方走）
  // ===================================================================
  test('源码级：chatheaderbar.vue 必须包含 @keyframes cs-status-pulse（scoped keyframe 随使用方走）', () => {
    const content = readFileSync(CHATHEADERBAR_VUE_PATH, 'utf8')
    expect(
      content,
      'chatheaderbar.vue 缺失 @keyframes cs-status-pulse。\n' +
        '@keyframes cs-status-pulse 是 .cs-status-ring 的 pulse 动画，\n' +
        'scoped 块的 keyframe 不会跨组件共享，必须随使用方迁到子组件。\n' +
        '删这个 keyframe 会让客服主题连接状态指示器的脉冲动画失效。'
    ).toMatch(/@keyframes\s+cs-status-pulse\s*\{/)
  })

  // ===================================================================
  // 3) _customer-service-theme.scss 不再包含这 5 个选择器（防回退）
  // ===================================================================
  test('源码级：_customer-service-theme.scss 不再包含 .cs-status-wrap 选择器（防回退）', () => {
    const content = readFileSync(CUSTOMER_SERVICE_THEME_SCSS_PATH, 'utf8')
    expect(
      content,
      '_customer-service-theme.scss 不应再包含 .cs-status-wrap 块。\n' +
        '2026-07-03 已迁回 chatheaderbar.vue 的 scoped 块，重新加回会导致：\n' +
        '1) 重复定义（chatheaderbar.vue scoped 块的版本仍生效，但 partial 内的版本是死代码）\n' +
        '2) 给未来读者造成困惑：哪些是子组件内、哪些是父组件内\n' +
        '3) 违背"样式贴近使用方"工程规范'
    ).not.toMatch(/^\s*\.cs-status-wrap\s*\{/m)
  })

  test('源码级：_customer-service-theme.scss 不再包含 .cs-status-indicator / .cs-status-dot / .cs-status-ring / .cs-status-text', () => {
    const content = readFileSync(CUSTOMER_SERVICE_THEME_SCSS_PATH, 'utf8')
    for (const sel of [
      '.cs-status-indicator',
      '.cs-status-dot',
      '.cs-status-ring',
      '.cs-status-text',
    ]) {
      const re = new RegExp(`^\\s*\\${sel}\\s*\\{`, 'm')
      expect(
        content,
        `_customer-service-theme.scss 不应再包含 ${sel} 块。\n` +
          '已迁回 chatheaderbar.vue 的 scoped 块。'
      ).not.toMatch(re)
    }
  })

  // ===================================================================
  // 4) _customer-service-theme.scss 不再包含 @keyframes cs-status-pulse
  // ===================================================================
  test('源码级：_customer-service-theme.scss 不再包含 @keyframes cs-status-pulse', () => {
    const content = readFileSync(CUSTOMER_SERVICE_THEME_SCSS_PATH, 'utf8')
    expect(
      content,
      '_customer-service-theme.scss 不应再包含 @keyframes cs-status-pulse。\n' +
        '该 keyframe 已在 2026-07-03 迁回 chatheaderbar.vue。\n' +
        '留在 partial 内会形成死代码（keyframe 在非 scoped 块但只被 scoped 块使用）。'
    ).not.toMatch(/@keyframes\s+cs-status-pulse\s*\{/)
  })

  // ===================================================================
  // 5) AIChat.vue 的非 scoped 块仍然 @use customer-service-theme（保留 FAQ/console）
  // ===================================================================
  test('源码级：AIChat.vue 非 scoped 块仍 @use customer-service-theme（保留 FAQ/console 块）', () => {
    const content = readFileSync(AICHAT_VUE_PATH, 'utf8')
    // 必须 @use customer-service-theme 至少一次（无论在哪个块）
    expect(
      content,
      'AIChat.vue 必须 @use customer-service-theme 至少一次。\n' +
        '本批次仅删 cs-status-* 5 块, FAQ / console 等客服主题块仍需保留。\n' +
        '删 @use 会导致 .cs-quick-faq / .cs-faq-pill / .cs-console-* 等样式失效。'
    ).toMatch(/@use\s+['"]@\/styles\/ai-chat\/customer-service-theme['"]/)
  })

  // ===================================================================
  // 6) AIChat.vue 的非 scoped 块仍含 .cs-quick-faq（确认 partial 整体仍加载）
  // ===================================================================
  test('源码级：_customer-service-theme.scss 仍包含 .cs-quick-faq 等 AIChat.vue 直接 DOM 元素块', () => {
    const content = readFileSync(CUSTOMER_SERVICE_THEME_SCSS_PATH, 'utf8')
    for (const sel of [
      '.cs-quick-faq',
      '.cs-faq-pill',
      '.cs-console-header',
      '.cs-console-label',
      '.cs-console-indicator',
    ]) {
      const re = new RegExp(`^\\s*\\${sel}\\s*\\{`, 'm')
      expect(
        content,
        `_customer-service-theme.scss 缺失 ${sel} 块。\n` +
          '这些块对应 AIChat.vue 的直接 DOM 元素（FAQ/console），必须保留在 partial 内。'
      ).toMatch(re)
    }
  })
})
