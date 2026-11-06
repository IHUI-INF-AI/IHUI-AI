// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * 发布账号「扫码登录」端到端回归(2026-09-29 立)。
 *
 * 立因(用户反馈"所有平台的扫码登录不好使"):根因不在任何一家平台的适配,而在
 * **入口选了一条到端不存在的路由**。旧实现走内置浏览器 CDP:
 *   POST /api/browser/sessions  +  WS /api/browser/ws/{id}
 * 而生产 nginx 把 `/api/` 整段交给 Fastify(8802),那两层路由都不在那儿;Next.js
 * rewrites 只在 dev 生效。当日实测(同一枚合法 token):
 *   POST http://127.0.0.1:8802/api/browser/sessions → 404 {"message":"Route … not found"}
 *   GET  https://aizhs.top/api/browser/ws/zz        → 404(同一信封 ⇒ 生产也是这层答的)
 * 同一台机上纯 HTTP 那条腿整条可用(实测 ~9s 后 /qr 出 604KB PNG),只是没有调用方。
 *
 * 所以本 spec 判的不是"界面好不好看",而是**这条链路有没有再被接回 404 通道**:
 *  A 请求面:必须出现 /api/publish/scan-login/start,且**绝不允许**出现 /api/browser/sessions
 *  B 可见面:二维码必须真的出现在弹窗里,而且是**解码成功的位图**(naturalWidth>0),
 *            不是 alt 占位、不是 0 尺寸 —— 用户能扫的前提是"看得见一张真图"
 *  C 取消面:点「取消扫码」必须发出 cancel,否则服务端那个 Chromium 要挂满 5 分钟
 *  D 深色态:同一弹窗在 dark 下仍要看得见二维码(白底容器 + 反色是这一族的实际修法)
 */

const PICK_PLATFORM = '知乎'

interface Hit {
  url: string
  method: string
}

test.describe('@browser-hub 发布账号 · 扫码登录必须走 HTTP 二维码通道', () => {
  test('发起 → 二维码可见可解码 → 取消,且全程不碰内置浏览器路由', async ({
    authenticatedPage: page,
  }) => {
    const hits: Hit[] = []
    page.on('request', (req) => {
      const u = req.url()
      if (u.includes('/api/publish/scan-login') || u.includes('/api/browser/')) {
        hits.push({ url: u, method: req.method() })
      }
    })

    // 就绪信号(2026-11-06 实测):domcontentloaded 早于 React 挂载 —— dev 冷编译下
    // 点击会落在 onClick 绑上之前(该窗口内页面连 /accounts/me 都没发),弹窗自然不出现。
    // 页面挂载后自己会拉这一条:拿到答复即等价于"客户端组件已跑起来、按钮可交互",
    // 不引入固定等待,也不靠计时器试。
    const accountsLoaded = page.waitForResponse(
      (r) => r.url().includes('/api/publish/accounts/me') && r.request().method() === 'GET',
      { timeout: 30000 },
    )
    // 先挂监听再导航:domcontentloaded 只保证 SSR 到位,客户端组件挂载与那次
    // /accounts/me 都在其后 —— 监听后置会漏掉已发出的请求而白等 30s。
    await page.goto('/publish/accounts', { waitUntil: 'domcontentloaded' })
    const addBtn = page.getByRole('button', { name: /添加账号/ }).first()
    await expect(addBtn).toBeVisible()
    await accountsLoaded
    await expect(addBtn).toBeEnabled()

    // platforms 是弹窗挂载后才异步拉的 ⇒ 先等这条答复,再读 pill 集合。
    // count() 不重试,把它当等待必然读到首帧空集(实测 retry1 就是这样误走下拉分支)。
    const platformsLoaded = page.waitForResponse(
      (r) => r.url().includes('/api/publish/scan-login/platforms') && r.status() === 200,
      { timeout: 30000 },
    )
    await addBtn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await platformsLoaded
    // 平台区渲染落定:pill 或「更多平台」下拉任一出现 —— 可观察条件,非固定等待。
    await expect
      .poll(
        async () =>
          (await dialog.getByRole('button', { name: PICK_PLATFORM, exact: true }).count()) +
          (await dialog.getByRole('combobox').count()),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0)

    // 2026-10-21:产品 09-30 重设计后,热门平台(含知乎)是弹窗内直接可见的 pill。
    const platformPill = dialog.getByRole('button', { name: PICK_PLATFORM, exact: true }).first()
    if (await platformPill.count()) {
      await platformPill.click()
    } else {
      // 真实行为(ScanLoginDialog 的 restPlatforms):「更多平台」下拉按设计排除常用平台,
      // 所以 PICK_PLATFORM 不会出现在 option 里 —— 这里验证该设计成立,不再盲等一个
      // 永远不会出现的 option。pill 缺失本身即产品重设计回归,具名失败而不是降级放行。
      await dialog.getByRole('combobox').first().click()
      await expect(page.getByRole('option').first(), '「更多平台」下拉必须能展开').toBeVisible()
      await expect(
        page.getByRole('option', { name: PICK_PLATFORM, exact: true }),
        '常用平台按设计不进「更多平台」下拉',
      ).toHaveCount(0)
      throw new Error(
        `热门平台 pill 未渲染(${PICK_PLATFORM} 不在平台集合里):产品重设计回归,拒绝盲走下拉路径`,
      )
    }

    await dialog
      .getByRole('button', { name: /开始扫码登录|扫码登录/ })
      .first()
      .click()

    // B 可见面:二维码必须解码成功
    const qr = dialog.getByAltText('登录二维码')
    await expect(qr).toBeVisible({ timeout: 60000 })
    await expect
      .poll(
        async () =>
          qr.evaluate((el) => {
            const img = el as HTMLImageElement
            return img.complete && img.naturalWidth > 100 ? img.naturalWidth : 0
          }),
        { timeout: 60000, intervals: [1000, 2000] },
      )
      .toBeGreaterThan(100)
    const src = await qr.getAttribute('src')
    expect(src ?? '').toMatch(/^blob:/)

    await page.screenshot({ path: 'test-results/scan-login-default.png', fullPage: false })

    // D 深色态:同一弹窗重开也必须看得见
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(qr).toBeVisible()
    await page.screenshot({ path: 'test-results/scan-login-dark.png', fullPage: false })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))

    // C 取消面
    await dialog.getByRole('button', { name: /取消扫码/ }).click()
    await expect
      .poll(() => hits.filter((h) => h.url.includes('/cancel')).length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(1)

    // A 请求面 —— 这一条是整张 spec 的立意
    const started = hits.filter((h) => h.url.includes('/scan-login/start') && h.method === 'POST')
    expect(started.length, '必须经 /api/publish/scan-login/start 发起任务').toBeGreaterThanOrEqual(
      1,
    )
    const cdp = hits.filter((h) => h.url.includes('/api/browser/'))
    expect(
      cdp,
      '不得再走内置浏览器通道 —— 它在生产是 404(nginx /api/ → Fastify,该层无此路由)',
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
