/**
 * 纯黑/纯白边框清理回归测试 (2026-07-01)
 *
 * 防护目标：5 处 var(--el-color-white) 边框替换为 var(--color-white-N) 后
 *          视觉与计算样式值符合预期。
 *
 * 验证策略（多轨）：
 * 1) 源码级：直接验证 Home.vue.styles.scss 和 AIDialog.vue 源码中没有
 *    border-color: var(--el-color-white) 残留
 * 2) 设计令牌级：验证 :root 上 --color-white-30/50/60/80 透明度令牌已正确定义
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

test.describe('纯黑/纯白边框清理回归', () => {
  // 默认 run 自动覆盖 (testDir: ./e2e + 全 project 包含)
  // CI 入口: npm run e2e / npx playwright test 即可运行本 spec
  // 注：本 spec 为纯源码级断言（readFileSync），与浏览器/平台无关，
  //     在 chromium 与 Mobile Chrome 下都会跑，纯属 CI 冗余保障，不影响正确性

  // ========== 1) 源码级：直接读源文件验证 ==========
  test('源码级 1/3：Home.vue.styles.scss 暗色 Ghost 按钮 hover/active 边框不再使用 var(--el-color-white)', () => {
    const src = readFileSync(
      join(ROOT, 'src/views/Home.vue.styles.scss'),
      'utf8'
    )

    // 1. 验证整文件不含 border-color: var(--el-color-white)
    expect(
      src,
      'Home.vue.styles.scss 全文不应再有 border-color: var(--el-color-white)'
    ).not.toMatch(/border-color\s*:\s*var\(--el-color-white\)/)

    // 2. 提取暗色模式块（:where(html.dark) ... :where(#first-page) ... ghost）
    //    注意 SCSS 块内有嵌套的 :deep() / :hover / :active 等 {}，需平衡匹配。
    //    使用平衡匹配算法手动计数花括号
    const darkIdx = src.indexOf(':where(html.dark) :where(#first-page) .hero-cta .hero-cta-btn.ghost {')
    expect(darkIdx, '应能定位暗色 Ghost 按钮块起点').toBeGreaterThanOrEqual(0)
    // 从起点后开始手动匹配花括号，找到对应闭合
    let depth = 0
    let blockEnd = -1
    for (let i = darkIdx; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) {
          blockEnd = i + 1
          break
        }
      }
    }
    expect(blockEnd, '应能定位暗色 Ghost 按钮块终点').toBeGreaterThan(darkIdx)
    const block = src.slice(darkIdx, blockEnd)

    // 3. 验证暗色块内 :hover 用了 var(--color-white-50)
    expect(
      block,
      '暗色 :hover 应使用 var(--color-white-50)'
    ).toMatch(/:hover\s*\{[^}]*border-color\s*:\s*var\(--color-white-50\)/)

    // 4. 验证暗色块内 :active 用了 var(--color-white-60)
    expect(
      block,
      '暗色 :active 应使用 var(--color-white-60)'
    ).toMatch(/:active\s*\{[^}]*border-color\s*:\s*var\(--color-white-60\)/)
  })

  test('源码级 2/3：AIDialog.vue 暗色 Checkbox 三个状态边框不再使用 var(--el-color-white)', () => {
    const src = readFileSync(
      join(ROOT, 'src/components/ai/AIDialog.vue'),
      'utf8'
    )

    // 1. 验证整文件不含 border-color: var(--el-color-white)
    expect(
      src,
      'AIDialog.vue 全文不应再有 border-color: var(--el-color-white)'
    ).not.toMatch(/border-color\s*:\s*var\(--el-color-white\)/)

    // 2. 验证 .checkmark 默认块内含 var(--color-white-30)
    const checkmark = src.match(/\.checkmark\s*\{[\s\S]*?border-color\s*:\s*var\(--color-white-30\)[\s\S]*?\}/)
    expect(checkmark, '应能找到 .checkmark 块内 border-color: var(--color-white-30)').not.toBeNull()

    // 3. 验证 :hover .checkmark 块内含 var(--color-white-50)
    const hoverCheckmark = src.match(/:hover[^{]*\.checkmark\s*\{[\s\S]*?border-color\s*:\s*var\(--color-white-50\)[\s\S]*?\}/)
    expect(hoverCheckmark, '应能找到 :hover .checkmark 块内 border-color: var(--color-white-50)').not.toBeNull()

    // 4. 验证 :checked + .checkmark 块内含 var(--color-white-80)
    const checkedCheckmark = src.match(/:checked\s*\+\s*\.checkmark\s*\{[\s\S]*?border-color\s*:\s*var\(--color-white-80\)[\s\S]*?\}/)
    expect(checkedCheckmark, '应能找到 :checked .checkmark 块内 border-color: var(--color-white-80)').not.toBeNull()
  })

  // ========== 2) 设计令牌级：CSS 变量已定义 ==========
  test('设计令牌级 3/3：:root 上 --color-white-30/50/60/80 已正确定义', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)

    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      return {
        w30: cs.getPropertyValue('--color-white-30').trim(),
        w50: cs.getPropertyValue('--color-white-50').trim(),
        w60: cs.getPropertyValue('--color-white-60').trim(),
        w80: cs.getPropertyValue('--color-white-80').trim(),
      }
    })
    expect(tokens.w30, '--color-white-30 应是 rgba(255, 255, 255, 0.3)').toBe('rgba(255, 255, 255, 0.3)')
    expect(tokens.w50, '--color-white-50 应是 rgba(255, 255, 255, 0.5)').toBe('rgba(255, 255, 255, 0.5)')
    expect(tokens.w60, '--color-white-60 应是 rgba(255, 255, 255, 0.6)').toBe('rgba(255, 255, 255, 0.6)')
    expect(tokens.w80, '--color-white-80 应是 rgba(255, 255, 255, 0.8)').toBe('rgba(255, 255, 255, 0.8)')
  })
})
