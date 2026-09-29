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

test.describe('发布账号 · 扫码登录必须走 HTTP 二维码通道', () => {
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

    await page.goto('/publish/accounts', { waitUntil: 'domcontentloaded' })

    // 打开单平台扫码弹窗
    await page
      .getByRole('button', { name: /添加账号/ })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // 选平台(默认已是列表第一个,这里显式选一次,保证断言的不是"碰巧默认值")
    // 平台清单里有两条名字含"知乎"的条目,strict mode 会报歧义 ⇒ 精确名 + first
    await dialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: PICK_PLATFORM, exact: true }).first().click()

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
    await page.waitForTimeout(400)
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
