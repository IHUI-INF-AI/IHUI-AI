// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { setupTest as test, expect } from './fixtures'

/**
 * TagsView 激活标签描边定稿守门 (2026-08-19 立)
 *
 * 触发背景(真实回退事故):
 * 8-13 提交 85294855d5 用户反馈"pure black/white 太突兀",active 态定稿为
 * outline-2 outline-border(主题灰 2px 外描边);8-17 提交 3c22437562 重构时
 * 基于旧版覆盖回退成 outline-black / dark:outline-white(纯黑/纯白),
 * 用户肉眼察觉"描边怎么变纯白纯黑了"。修复 + 守门脚本(guardian-runner 11c)
 * 已落地,本测试是第二道防线:即使 --no-verify 绕过 pre-commit 钩子,
 * CI 执行本测试时仍会拦截回退。
 *
 * 防回归断言:
 *  1. active 标签 className 必须含 outline-2 + outline-border(主题灰定稿)
 *  2. active 标签 className 禁止 outline-black / dark:outline-white(纯黑/纯白)
 *  3. 计算样式兜底:outline 可见(solid)且宽度 2px,颜色不是纯黑/纯白
 *     (防 Tailwind 类被改但视觉没生效的假通过)
 */

test.describe('TagsView 激活标签描边定稿守门', () => {
  test('active 标签描边为主题灰 outline-2 outline-border,非纯黑/纯白', async ({ adminPage }) => {
    await adminPage.goto('/chat')
    // 等待标签栏出现且至少渲染一个标签 Link
    await adminPage.waitForSelector('[data-tagsview] a', { timeout: 15000 })

    const result = await adminPage.evaluate(() => {
      const tagsview = document.querySelector('[data-tagsview]')
      if (!tagsview) throw new Error('[data-tagsview] not found')
      const links = Array.from(tagsview.querySelectorAll('a'))
      // active 标签 = className 含 outline- 的 Link(定稿:outline-2 outline-border)
      const activeLink = links.find((a) => a.className.includes('outline-'))
      if (!activeLink) throw new Error('未找到 active 标签(className 无 outline-)')
      const style = getComputedStyle(activeLink)
      return {
        className: activeLink.className,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      }
    })

    // 断言 1:定稿类名必须存在
    expect(result.className, 'active 标签必须含 outline-2(定稿 2px 外描边)').toContain('outline-2')
    expect(result.className, 'active 标签必须含 outline-border(主题灰定稿)').toContain(
      'outline-border',
    )

    // 断言 2:纯黑/纯白永久禁用(8-13 用户定稿)
    expect(result.className, 'active 标签禁止纯黑描边 outline-black').not.toContain('outline-black')
    expect(result.className, 'active 标签禁止纯白描边 dark:outline-white').not.toContain(
      'dark:outline-white',
    )

    // 断言 3:计算样式兜底(防类名存在但样式未生效)
    expect(result.outlineStyle, 'outline 必须可见(solid),不能是 none').toBe('solid')
    expect(result.outlineWidth, 'outline 宽度应为 2px(定稿 outline-2)').toBe('2px')
    expect(result.outlineColor, 'outline 颜色不得为纯黑 rgb(0, 0, 0)').not.toBe('rgb(0, 0, 0)')
    expect(result.outlineColor, 'outline 颜色不得为纯白 rgb(255, 255, 255)').not.toBe(
      'rgb(255, 255, 255)',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
