import { expect, setupTest } from './fixtures'

/**
 * PlatformPreview XSS 修复回归守护(@security)。
 *
 * 覆盖 4 类 XSS payload(对应 src/components/publish/PlatformPreview.tsx 修复点):
 *  - <script> 标签 → escapeHtml 5 字符转义(& < > " '),DOM 不产生 script 节点
 *  - [text](javascript:...) 链接 → SAFE_HREF_RE 协议白名单,href 替换为 #
 *  - ![](javascript:...) 图片 → SAFE_HREF_RE 协议白名单,src 置空
 *  - <img src=x onerror=...> 事件属性 → escapeHtml 转义 < >,onerror 不成为有效属性
 *
 * 入口:/publish/new(format === 'md' 时渲染 PlatformPreview,见 app/(main)/publish/new/page.tsx)
 * Fixture:adminPage(admin/admin123 已登录态,见 e2e/fixtures.ts)
 * 防抖:useDebounced delay=500ms,fill 后需等 ≥500ms 再断言
 */

setupTest.describe('@security PlatformPreview XSS 修复回归', () => {
  setupTest.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/publish/new')
    await adminPage.waitForLoadState('domcontentloaded')
    // format 默认 'md'(page.tsx 初始 state),RichTextEditor 默认 markdown 模式渲染 <textarea>
  })

  setupTest('script 标签被转义为文本,DOM 无 script 节点', async ({ adminPage }) => {
    await adminPage.locator('textarea').first().fill('<script>alert(1)</script>')
    await adminPage.waitForTimeout(600) // useDebounced 500ms
    expect(await adminPage.locator('script:has-text("alert(1)")').count()).toBe(0)
    await expect(adminPage.getByText('alert(1)').first()).toBeVisible()
  })

  setupTest('javascript: 链接 href 被替换为 #', async ({ adminPage }) => {
    await adminPage.locator('textarea').first().fill('[click](javascript:alert(1))')
    await adminPage.waitForTimeout(600)
    expect(await adminPage.locator('a[href^="javascript:"]').count()).toBe(0)
  })

  setupTest('javascript: 图片 src 被置空', async ({ adminPage }) => {
    await adminPage.locator('textarea').first().fill('![](javascript:alert(1))')
    await adminPage.waitForTimeout(600)
    expect(await adminPage.locator('img[src^="javascript:"]').count()).toBe(0)
  })

  setupTest('img onerror 事件属性被转义,不成为有效属性', async ({ adminPage }) => {
    await adminPage.locator('textarea').first().fill('<img src=x onerror=alert(1)>')
    await adminPage.waitForTimeout(600)
    expect(await adminPage.locator('[onerror]').count()).toBe(0)
  })
})
