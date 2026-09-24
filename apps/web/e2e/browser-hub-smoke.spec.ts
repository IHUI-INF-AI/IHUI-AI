// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * D42「真画面」档 e2e 的活性 smoke。
 *
 * 这一档和 e2e.yml 那 ~50 个 spec 的区别只有一个:e2e.yml 的 services 段里
 * 只有 postgres + redis,没有 ai-service(8803)、没有 Chromium,所以任何需要
 * **真实浏览器会话**的用例在 CI 里必然跑不通(不缺凭据、不缺功能)。
 * 编排见 `.github/workflows/e2e-browser-hub.yml`,筛选用 `--grep "@browser-hub"`。
 * 后续需要真实浏览器会话的 D42 用例请追加进本文件这个 describe,不要再开第二份 workflow。
 *
 * 被证的链路(整条,不是其中一段):
 *   浏览器同源 `/api/browser/sessions/*`
 *     → Next.js rewrite `IHUI_AI_PROXY_TARGET`(apps/web/next.config.ts:492)
 *     → ai-service:8803 `browser_hub` router(apps/ai-service/app/routers/browser_hub.py:76,102)
 *     → Playwright Chromium 引擎(apps/ai-service/app/services/browser_hub.py:829)
 *
 * 两条断言都是"某一段断了就红",不存在永远为真的空断言:
 *  1) 已登录态 GET 会话清单 ⇒ 200 + code=0。
 *     404 = rewrite 没命中(被 `/api/:path*` 通配吞到 api:8802);
 *     401 = cookie `auth_token` 没被 ai-service 认(ai-service 与 api 的 JWT_SECRET 不一致);
 *     500 = ai-service 起了但 JWT_SECRET 缺失(它的 fail-closed 分支,jwt_auth.py:93)。
 *  2) POST 建会话 ⇒ **真的在 ai-service 侧拉起一个 Chromium**。
 *     这一步只有 ai-service 的 python playwright 装上浏览器才会绿 —— 正是"真画面"档
 *     多出来的那一档。断言完必须 DELETE 关掉,不给 runner 留僵尸 chromium。
 */

interface SessionListData {
  session_ids: string[]
  count: number
}

interface SessionInfoData {
  session_id: string
  url: string
  title: string
  cookie_count: number
}

interface Envelope<T> {
  code: number
  message?: string
  data: T
}

/** 走同源相对路径:先确保页面已落在被测站点上,再用页面 origin 拼绝对 URL。 */
async function sameOrigin(pageUrl: string, path: string): Promise<string> {
  return new URL(path, pageUrl).href
}

test.describe('@browser-hub 内置浏览器真画面链路', () => {
  test('同源 /api/browser/sessions 打到 ai-service 且鉴权通过', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    const res = await authenticatedPage.request.get(
      await sameOrigin(authenticatedPage.url(), '/api/browser/sessions'),
    )
    const text = await res.text()
    expect(
      res.status(),
      `会话清单应为 200(实际 ${res.status()}),响应体: ${text.slice(0, 300)}`,
    ).toBe(200)

    const body = (await res.json()) as Envelope<SessionListData>
    expect(body.code, `响应体应为 { code: 0 },实际: ${text.slice(0, 300)}`).toBe(0)
    expect(Array.isArray(body.data.session_ids), 'data.session_ids 必须是数组').toBe(true)
    expect(typeof body.data.count, 'data.count 必须是数字').toBe('number')
  })

  test('AI 服务侧真能拉起 Chromium 会话(建 → 读 → 关)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const origin = await sameOrigin(authenticatedPage.url(), '/api/browser/sessions')

    // about:blank 起步即可:本用例证的是"引擎能不能起浏览器",不是外网可达性。
    let created: Envelope<SessionInfoData> | undefined
    try {
      const createRes = await authenticatedPage.request.post(origin, {
        data: { url: 'about:blank', viewport_width: 1280, viewport_height: 720 },
        timeout: 90_000,
      })
      const createText = await createRes.text()
      expect(
        createRes.status(),
        `建会话应为 200(实际 ${createRes.status()})。非 200 通常是 ai-service 侧 Chromium 未安装或启动不了,响应体: ${createText.slice(0, 400)}`,
      ).toBe(200)

      created = (await createRes.json()) as Envelope<SessionInfoData>
      expect(created.code, `建会话响应体 code 应为 0,实际: ${createText.slice(0, 400)}`).toBe(0)
      const sessionId = created.data.session_id
      expect(sessionId, 'session_id 不能为空').toBeTruthy()

      const infoRes = await authenticatedPage.request.get(`${origin}/${sessionId}`)
      expect(infoRes.status(), '刚建的会话必须读得到').toBe(200)
      const info = (await infoRes.json()) as Envelope<SessionInfoData>
      expect(info.data.session_id, '读回的 session_id 必须一致').toBe(sessionId)
      expect(typeof info.data.cookie_count, '新会话 cookie 数必须是数字').toBe('number')
    } finally {
      if (created?.data?.session_id) {
        await authenticatedPage.request
          .delete(`${origin}/${created.data.session_id}`)
          .catch(() => undefined)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
