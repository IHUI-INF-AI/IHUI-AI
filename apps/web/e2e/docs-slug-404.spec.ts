// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * docs-slug-404.spec.ts — 文档中心两条实测缺陷的 e2e 牙(2026-11-03 立)
 *
 * ① 每个文档页只能有一个 H1(a11y + SEO):容器 CategoryShell 曾往每页注入 <h1>开发文档</h1>,
 *    与内容页自己的 hero <h1> 撞成两个。修法是把容器标题降级为非标题元素,hero H1 保留。
 * ② 不存在的 slug 必须回**真 404**,不得 200 还把 slug 字符串当标题显示(软 404)。
 *
 * 跑法(一条命令,2026-11-04 现跑实测;复用外部已起的 8801 dev server,免得再起一个抢端口):
 *   cd apps/web && PLAYWRIGHT_BROWSERS_PATH='D:\caches\playwright' \
 *   IHUI_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:8801 \
 *   IHUI_E2E_EXPECT_HARD_404=1 \
 *   pnpm exec playwright test e2e/docs-slug-404.spec.ts --project=chromium --no-deps --workers=1
 * 三个旗标各管一件事,少一个这条命令就跑不通(旧头注写的 IHUI_E2E_EXTERNAL_SERVER=1
 * 当时 playwright.config.ts 通篇不读它,是条跑不通的出路,现已在 config 里实现并被下面那条
 * 「旗↔出路」用例钉住):
 * - IHUI_E2E_EXTERNAL_SERVER=1 ⇒ config 不挂 webServer(不自启、不探活,不碰他席的 8801);
 * - --project=chromium --no-deps ⇒ 跳过 setup project(auth.setup.ts 要 E2E_USER_PASSWORD /
 *   E2E_ADMIN_PASSWORD,仓内有意不提供默认值,本机供给面见 `node scripts/e2e-local-supply.mjs --check`;
 *   本 spec 全条游客态,不需要登录夹具,所以不该被那两枚口令卡住);
 * - IHUI_E2E_EXPECT_HARD_404=1 ⇒ 启用状态码 404 那条(前提是被测 API 后端在场,否则探针返回
 *   unknown 按 500 处理)。
 * 全条游客态:不依赖登录夹具(登录态由别的 spec 的 setup 供,这里不用它)。
 */
import { expect, test } from '@playwright/test'

// 旗↔出路等价性的被审面:配置文件本身(与 spec 同 worker 求值,读的是同一枚 process.env)
import playwrightConfig from '../playwright.config'

const GUEST_STATE = { cookies: [], origins: [] }

// 本机跑在 next dev(8801)上:首访一条路由要现编译,30s 默认超时会在编译期假红(2026-11-03 实测
// /docs/workflow 与 /docs/[slug] 各撞一次)。给到 120s,判据本身不放宽。
test.setTimeout(120_000)

/** 正文自带 hero H1 的分类页(容器标题已降级,这两个字不该再是标题) */
const CATEGORY_PAGES = ['/docs/quickstart', '/docs/self-host', '/docs/workflow']

for (const path of CATEGORY_PAGES) {
  test.use({ storageState: GUEST_STATE })
  test(`${path} 整页只有一个 H1,且它是本页主题而非容器泛称`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(res, 'goto 必须拿到响应').not.toBeNull()
    expect(res!.status(), `${path} 不得 5xx`).toBeLessThan(500)
    const h1 = page.locator('h1')
    await expect(h1, `${path} 的 H1 枚数必须恰好为 1`).toHaveCount(1)
    const text = (await h1.innerText()).trim()
    expect(text, 'H1 必须是本页主题的 hero 标题,不能是容器那个泛化标题').not.toBe('开发文档')
    expect(text.length, 'H1 必须有实际文字').toBeGreaterThan(0)
  })
}

test.describe('不存在的文档 slug', () => {
  test.use({ storageState: GUEST_STATE })
  const MISSING_SLUG = 'e2e-doc-slug-that-cannot-exist-zz9'

  test('不再把 slug 字符串当标题显示,且落到真 not-found UI', async ({ page }) => {
    const res = await page.goto(`/docs/${MISSING_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(res, 'goto 必须拿到响应').not.toBeNull()
    const headings = await page.locator('h1, h2, h3').allInnerTexts()
    const leaked = headings.filter((t) => t.includes(MISSING_SLUG))
    expect(leaked, `标题位漏出 slug 原文 ⇒ 软 404 回潮:${leaked.join(' | ')}`).toEqual([])
    // notFound() 生效的可见凭据:整页渲染 app/not-found.tsx,且 Next 注入 robots noindex
    await expect(page.locator('h1').first()).not.toContainText(MISSING_SLUG)
    const html = await page.content()
    expect(html, 'notFound() 必须让 noindex 落网').toContain('noindex')
  })

  // 硬 404 由请求入口 Proxy 落(src/lib/docs-detail-gate.ts rewrite-with-status),不依赖预渲染,
  // 所以 dev 与 production 都成立;唯一前提是**探针能问到后端**:后端不可达时判据按
  // 'unknown' 回 500(宁可真 500 也不把故障伪装成 404,见 docs-slug-probe 四态)。
  // 故默认跳过:外部起的 dev server 未必有活的 API 后端;确认后端在场时置
  // IHUI_E2E_EXPECT_HARD_404=1 才启用。
  test('HTTP 状态码 = 404(需后端在场)', async ({ page }) => {
    test.skip(
      !process.env.IHUI_E2E_EXPECT_HARD_404,
      '需活的 API 后端,否则探针返回 unknown 按 500 处理;确认后端在场时置 1',
    )
    const res = await page.goto(`/docs/${MISSING_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(res!.status(), '不存在的 slug 回了非 404 ⇒ 软 404/500 回潮').toBe(404)
  })
})

/**
 * 旗↔出路等价性(先例:守门 172 check-skip-env-promise —— 文档承诺的旗标必须在代码里真读)。
 * 头注那条命令写了 IHUI_E2E_EXTERNAL_SERVER=1,配置面若不理它,文档就是条跑不通的出路
 * (AGENTS §0.8),这条用例当场翻红:置旗 ⇒ config 不挂 webServer;不置 ⇒ 必须照旧挂。
 */
test('IHUI_E2E_EXTERNAL_SERVER 旗标必须真被 playwright.config.ts 消费', () => {
  const flagOn = Boolean(process.env.IHUI_E2E_EXTERNAL_SERVER)
  const hasWebServer = Boolean(playwrightConfig.webServer)
  expect(
    hasWebServer,
    flagOn
      ? '置了 IHUI_E2E_EXTERNAL_SERVER=1 而 config 仍挂 webServer ⇒ 旗标没人读,头注那条命令是假出路'
      : '未置 IHUI_E2E_EXTERNAL_SERVER 时 config 必须照旧自启 webServer(既有行为不许被改掉)',
  ).toBe(!flagOn)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
