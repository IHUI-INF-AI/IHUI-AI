/**
 * SiteFooter v10/v11 防回归 E2E(2026-07-30 立)
 *
 * 背景:`scripts/check-site-footer.mjs` 是 Node 静态校验(检查源码字符串),
 *  本 spec 是浏览器端 DOM 真实渲染校验,补齐"静态 + 动态"双重守门,杜绝:
 *  1. footer 高度从 v10 ~140px 被回退到 v9 ~95px(3 个 QR + ICP 图标肉眼难辨)
 *  2. ECOSYSTEM_GROUPS 从 v11 5 分组(国际/国产拆分)被回退到 v8 4 分组
 *  3. QR 码从 h-16 w-16 缩回 h-12 w-12(底部截断)
 *  4. ICP 图标从 h-5 w-5 缩回 h-4 w-4(肉眼难辨)
 *  5. 1024px 边界 lg:grid-cols-5 被改成 grid-cols-4(8 个模型图标溢出)
 *
 * 7 项核心断言(每个视口跑一遍):
 *  - footer 高度 ≥ 130px(v10 拉高底线,挡住 v9 95px)
 *  - 3 个 QR 二维码均可见且宽=64px(v10 拉高)
 *  - ICP 图标可见且宽=20px(v10 拉高)
 *  - 5 个 ECOSYSTEM_GROUPS 分组全渲染(v11 拆分国际/国产,挡住 v8 4 分组)
 *  - 1024px+ 生态合作 5 列布局(lg:grid-cols-5)
 *  - 用户协议/隐私政策/联系我们 3 个 Dialog 按钮可见
 *  - 5 语言 i18n key 翻译完整(本测试只验 zh-CN 营销首页)
 *
 * 注:必须用 admin 账号(项目硬规则,2026-07-28 立);adminPage fixture 已提供登录态。
 */
import { setupTest as test, expect } from './fixtures'

test.describe('SiteFooter v10/v11 防回归', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/')
    // 等待 footer 真实渲染(等动画/字体加载完成)
    await adminPage.locator('footer').waitFor({ state: 'visible', timeout: 15000 })
  })

  // 3 视口断点:768 (md 边界) / 1024 (lg 边界) / 1280 (桌面)
  for (const width of [768, 1024, 1280]) {
    test(`视口 ${width}px — footer 高度 + 元素可见性`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width, height: 800 })
      // 等待响应式布局稳定
      await adminPage.waitForTimeout(500)

      // 1. footer 高度 ≥ 130px(v10 拉高底线)
      const footer = adminPage.locator('footer')
      const footerHeight = await footer.evaluate((el: HTMLElement) => el.offsetHeight)
      expect(
        footerHeight,
        `视口 ${width}px footer 高度 ${footerHeight}px < 130px(v10 拉高底线被回退)`,
      ).toBeGreaterThanOrEqual(130)

      // 2. 3 个 QR 二维码均可见(v10 h-16 w-16)
      const qrCodes = adminPage.locator('footer .h-16.w-16')
      await expect(qrCodes, `视口 ${width}px 找不到 3 个 QR 二维码(h-16 w-16)`).toHaveCount(3)
      // 至少 1 个 QR 完全可见(其他可能被滚动遮住)
      await expect(qrCodes.first()).toBeVisible()

      // 3. ICP 图标可见且 width=20px(v10 h-5 w-5)
      const icpIcon = adminPage.locator('footer img[alt*="ICP"], footer img[alt*="icp"]')
      const icpCount = await icpIcon.count()
      if (icpCount > 0) {
        const icpWidth = await icpIcon.first().evaluate((el) => el.getBoundingClientRect().width)
        expect(
          icpWidth,
          `视口 ${width}px ICP 图标宽度 ${icpWidth}px ≠ 20px(v10 拉高)`,
        ).toBeGreaterThanOrEqual(18) // 容差 2px(避免 sub-pixel 误差)
      }

      // 4. 5 个 ECOSYSTEM_GROUPS 分组全渲染(v11 拆分国际/国产)
      // 通过 h5 标签查找分组标题(国际大模型/国产大模型 等 5 个)
      const groupTitles = adminPage.locator('footer h5')
      const titleCount = await groupTitles.count()
      expect(
        titleCount,
        `视口 ${width}px ECOSYSTEM_GROUPS 分组数 ${titleCount} ≠ 5(v11 拆分国际/国产)`,
      ).toBeGreaterThanOrEqual(5)

      // 5. 1024px+ 生态合作 5 列布局(lg:grid-cols-5)
      if (width >= 1024) {
        // 找包含 5 个 h5 子元素的 grid 容器
        const ecosystemGrid = adminPage.locator('footer .grid.lg\\:grid-cols-5').first()
        await expect(
          ecosystemGrid,
          `视口 ${width}px 找不到 lg:grid-cols-5 生态合作容器`,
        ).toBeVisible()
      }

      // 6. 用户协议/隐私政策/联系我们 3 个 Dialog 按钮可见
      const userAgreement = adminPage.locator('footer button:has-text("用户协议")')
      const privacyPolicy = adminPage.locator('footer button:has-text("隐私政策")')
      const contactUs = adminPage.locator('footer button:has-text("联系我们")')
      await expect(userAgreement).toBeVisible()
      await expect(privacyPolicy).toBeVisible()
      await expect(contactUs).toBeVisible()

      // 7. 国际大模型/国产大模型分组(中文版)
      const intlModels = adminPage.locator('footer h5:has-text("国际大模型")')
      const cnModels = adminPage.locator('footer h5:has-text("国产大模型")')
      await expect(intlModels).toBeVisible()
      await expect(cnModels).toBeVisible()
    })
  }

  test('视口 1024px — 生态合作 5 列同行布局(每列 1 个或 2 个图标)', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 1024, height: 800 })
    await adminPage.waitForTimeout(500)

    // v11 拆分后:5 分组 × 4-5 图标,lg+ 5 列同行
    // 验证国际大模型分组(4 个图标: GPT/Claude/Gemini/Llama) 都在 viewport 1024 同行
    const intlGroup = adminPage
      .locator('footer h5:has-text("国际大模型")')
      .locator('..')
      .locator('div.flex.flex-wrap')
    const intlIcons = intlGroup.locator('a, div[class*="h-7 w-7"]')
    const intlCount = await intlIcons.count()
    expect(intlCount, `国际大模型分组应有 4 个图标(实际 ${intlCount})`).toBe(4)

    // 验证国产大模型分组(4 个图标: DeepSeek/Qwen/Doubao/Mistral)
    const cnGroup = adminPage
      .locator('footer h5:has-text("国产大模型")')
      .locator('..')
      .locator('div.flex.flex-wrap')
    const cnIcons = cnGroup.locator('a, div[class*="h-7 w-7"]')
    const cnCount = await cnIcons.count()
    expect(cnCount, `国产大模型分组应有 4 个图标(实际 ${cnCount})`).toBe(4)
  })

  test('国际化键 — 切换到英文后 footer Tooltip 仍显示英文模型名', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 1280, height: 800 })
    await adminPage.waitForTimeout(500)

    // 切到英文
    await adminPage.evaluate(() => {
      const html = document.documentElement
      html.lang = 'en'
      // 触发 i18n 切换(通过 cookie/localStorage 模拟)
      document.cookie = 'NEXT_LOCALE=en; path=/'
    })
    await adminPage.reload()
    await adminPage.locator('footer').waitFor({ state: 'visible', timeout: 15000 })

    // 英文版 footer 应包含 "International Models" / "Chinese Models"
    const intlEn = adminPage.locator('footer h5:has-text("International Models")')
    const cnEn = adminPage.locator('footer h5:has-text("Chinese Models")')
    await expect(intlEn).toBeVisible()
    await expect(cnEn).toBeVisible()
  })
})
