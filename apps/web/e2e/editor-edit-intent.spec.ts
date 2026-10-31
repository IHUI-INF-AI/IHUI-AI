// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 编辑器内预测式编辑 §17 真浏览器验证(2026-10-31,goal-b39)。
 *
 * 宿主 = /developer/ide(app/(main)/developer/ide/page.tsx → IDELayout → CodeEditorPane,
 * CodeEditor 全仓唯一可编辑消费面)。工作区文件面经 route 拦截喂假树(不依赖真实后端);
 * edit-intent 返回固定 suggested(Monaco/建议条/装饰/应用链路全部真实浏览器渲染)。
 *
 * 独立 auth 注入(不依赖 setup project / 真账号):token 是 httpOnly cookie(zustand 内存态),
 * 浏览器层等价注入 = ① `ihui-auth` persist blob(isAuthenticated+user,UI 渲染决策面,设计上
 * 不含任何 token)② `ihui-session-established` 标记(hasSessionEstablished 冷启动判据)
 * → bootstrap 走 POST /api/auth/refresh,此处拦截返回固定 LoginResult,token 三件套齐活,
 * 登录墙放行。散点 API(me/notice 等)统一兜底空成功,不依赖后端。
 *
 * 钉住的 §17 面:
 *   ① 初始内容载入 → debounce → 建议条真浏览器可见(截图落 tmp 留档);
 *   ② hover 条目 → Monaco 悬停预览装饰(.ihui-edit-intent-preview)真实上屏,离开消失;
 *   ③ 逐条选择性应用:取消第 2 条勾选 → 应用所选 → 编辑器内容只应用第 1 条
 *      (Trae CUE 的 all/line/word 三档做不了的组合挑选,真浏览器实证);
 *   ④ 接受率埋点真发(scene=edit_intent,分母分子同批)。
 */
import { test, expect } from '@playwright/test'

const WS = 'G:/ihui-e2e-ws'
const INITIAL = 'const word = 1'
const APPLIED_ONE = 'const value = 1'
const FAKE_USER = {
  id: 'e2e-uid-0000-0000-000000000000',
  username: 'e2e-editor',
  nickname: 'E2E 编辑器',
  email: 'e2e-editor@aizhs.top',
}

test.describe('编辑器内预测式编辑(§17 真浏览器)', () => {
  test.describe.configure({ retries: 1 })

  test('建议条上屏 → hover 预览 → 逐条选择性应用 → 埋点真发', async ({ page }) => {
    const metricBodies: Array<Record<string, unknown>> = []

    // 假工作区:根目录只有一个 hello.ts;子目录懒加载返回空
    await page.route('**/api/workspace/fs/browse', async (route) => {
      const body = route.request().postDataJSON() as { path?: string }
      const atRoot = !body?.path || body.path === WS
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            entries: atRoot
              ? [{ name: 'hello.ts', path: `${WS}/hello.ts`, isDir: false, size: INITIAL.length, modified: 0 }]
              : [],
          },
        }),
      })
    })
    let fileContent = INITIAL
    await page.route('**/api/workspace/fs/read', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { content: fileContent, lines: 2, path: `${WS}/hello.ts` },
        }),
      })
    })
    // 固定 suggested:replace(word→value)+ insert(文末追加),动作区间对准 INITIAL 文本
    await page.route('**/api/llm/fim/edit-intent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            disposition: 'suggested',
            actions: [
              { kind: 'replace', start: 6, end: 10, text: 'value', anchor: 'word' },
              { kind: 'insert', start: INITIAL.length, end: INITIAL.length, text: '\n// e2e-append' },
            ],
            model: 'e2e-mock',
            latency_ms: 42,
          },
        }),
      })
    })
    await page.route('**/api/llm/fim/metrics', async (route) => {
      try {
        metricBodies.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>)
      } catch {
        // 形状坏的上报不计入断言面
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { model: 'e2e-mock', scene: 'edit_intent' } }),
      })
    })
    // auth:refresh 腿回固定 LoginResult(bootstrap 用,token 入内存后登录墙放行)
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'e2e-fake-access',
            refreshToken: 'e2e-fake-refresh',
            expiresIn: 3600,
            refreshExpiresIn: 86400,
            user: FAKE_USER,
          },
        }),
      })
    })
    // 散点 API 兜底:me/notice 等端点统一回空成功,防未枚举端点把页面拖崩
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: null }),
      })
    })

    await page.addInitScript(
      ([ws]) => {
        localStorage.setItem('ide:workspacePath', ws as string)
        // zustand persist blob:isAuthenticated + user(设计上不含任何 token,§安全审计)
        localStorage.setItem(
          'ihui-auth',
          JSON.stringify({ state: { isAuthenticated: true, user: FAKE_USER }, version: 0 }),
        )
        localStorage.setItem('ihui-session-established', '1')
      },
      [WS],
    )

    await page.goto('/developer/ide')
    // 文件树出现 → 打开 hello.ts → Monaco 载入初始内容
    await page.getByText('hello.ts').first().click()
    const viewLines = page.locator('.monaco-editor .view-lines')
    await expect(viewLines).toBeVisible({ timeout: 20000 })
    await expect(viewLines).toContainText('const word', { timeout: 15000 })

    // ① 初始内容即触发(600ms debounce + mock 即回):建议条真浏览器可见
    const bar = page.getByTestId('editor-edit-intent-bar')
    await expect(bar).toBeVisible({ timeout: 8000 })
    await expect(bar).toContainText('predictiveEditChanges(2)')
    await page.screenshot({
      path: '.ihui-agent/tmp/goal-b39-trae/editor-edit-intent-e2e.png',
      fullPage: false,
    })

    // ② hover 第 2 条(insert)→ 预览装饰真实上屏;离开消失
    const labels = bar.locator('label')
    await expect(labels).toHaveCount(2)
    await labels.nth(1).hover()
    await expect(page.locator('.monaco-editor .ihui-edit-intent-preview').first()).toBeVisible({
      timeout: 3000,
    })
    await labels.nth(0).hover()
    await expect(page.locator('.monaco-editor .ihui-edit-intent-preview')).toHaveCount(0)

    // ③ 取消第 2 条勾选 → 应用所选 ⇒ 只应用第 1 条(逐条选择性应用的真浏览器实证)
    const boxes = bar.getByRole('checkbox')
    await boxes.nth(1).uncheck()
    await bar.getByRole('button', { name: 'predictiveEditApplySelected' }).click()
    await expect(viewLines).toContainText(APPLIED_ONE, { timeout: 5000 })
    await expect(viewLines).not.toContainText('e2e-append')
    await expect(bar).toBeHidden()

    // ④ 接受率埋点真发:scene=edit_intent,分母分子同批(accepted=1, suggestionCount=1)
    await expect
      .poll(() => metricBodies.some((b) => b.scene === 'edit_intent' && b.acceptedCount === 1), {
        timeout: 8000,
      })
      .toBe(true)

    // 全局留痕:应用后的编辑器实况截图
    await page.screenshot({
      path: '.ihui-agent/tmp/goal-b39-trae/editor-edit-intent-applied.png',
      fullPage: false,
    })
    expect(fileContent).toBe(INITIAL) // 假 read 面未被真实改动(拦截层只读)
  })
})
