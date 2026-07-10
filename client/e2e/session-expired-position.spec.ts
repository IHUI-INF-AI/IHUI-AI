/**
 * 会话过期通知 top-center 位置浏览器级守卫 (2026-07-03 立)
 *
 * 背景: 2026-07-02 改版会话过期通知从 ElMessageBox 居中模态 → ElNotification
 *       顶部下滑通知。Element Plus ElNotification 不支持 top-center
 *       (notify.mjs:8-13 仅 4 个 key: top-left/top-right/bottom-left/bottom-right),
 *       本项目用 position: 'top-left' + scss 覆盖 left: 50% + margin-left: -165px
 *       实现视觉水平居中。
 *
 * 本 spec 在浏览器运行时验证:
 *   - 触发 session-expired 事件后, 通知水平居中于 viewport (centerX 偏差 < 20px)
 *   - 通知位于 viewport 顶部 (top < 100px)
 *   - 通知不挂右侧 (x > 50px 即可证明不是 top-right 退化)
 *   - 暗色 / 浅色 / Desktop / Mobile Chrome 4 个组合均通过
 *
 * 与 session-expired-notification.spec.ts (源码级) 互补:
 *   - 源码级: 永远跑, 验证 useAppLifecycle.ts 字面量 position: 'top-left' + scss left: 50%
 *   - 浏览器级: 仅 PW_BASE_URL 时跑, 验证运行时真的水平居中 (捕获"字面量对了
 *              但 CSS 覆盖失败 / 事件没触发 / Element Plus 内部错"等运行时回归)
 *
 * 触发方式:
 *   - page.evaluate(() => window.dispatchEvent(new CustomEvent('session-expired')))
 *   - 不依赖真实 401 token 刷新逻辑, 也不依赖具体登录态
 *
 * 运行:
 *   - 默认: 浏览器级跳过 (无 PW_BASE_URL)
 *   - 本地: PW_BASE_URL=http://localhost:8888 npx playwright test e2e/session-expired-position.spec.ts
 *   - CI  : 复用 webServer.url 自动跑
 */
import { test, expect, type Page } from '@playwright/test'
import { FRONTEND_URL } from '../config/ports'

const SKIP_BROWSER = !process.env.PW_BASE_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

// 位置容差 (像素): 浏览器子像素渲染 / 滚动条 / DPR 缩放可能导致 ±10px 偏差
const CENTER_TOLERANCE_PX = 20
// 顶部距离上限: 通知必须接近视口顶部, 不能在中间或底部
const TOP_MAX_PX = 100

async function triggerSessionExpired(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('session-expired', {
      detail: { reason: '测试触发: 验证位置' },
    }))
  })
  // 等通知 DOM 出现 (ElNotification 挂到 body 末尾)
  const notif = page.locator('.session-expired-notification')
  await notif.waitFor({ state: 'visible', timeout: 5000 })
  // 等入场动画完成 (Element Plus left/transform transition 300ms ease-out)
  await page.waitForTimeout(600)
  return notif
}

/**
 * 等 dev server 首屏可交互:
 *   - domcontentloaded: HTML 解析完成, Vue 入口 <div id="app"> 已存在
 *   - 等 #app 子节点出现: Vue 挂载完成 (Mounted hook 已触发, session-expired 监听器已注册)
 *   - 不等 networkidle: Vite HMR websocket 持续连接, networkidle 永远不达,
 *     尤其 Mobile Chrome (Pixel 5, 393x851) 视口窄, 渲染压力更大, 容易超时
 */
async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  // 等待 Vue 应用挂载: #app 下必须有子节点 (SPA 路由出口)
  await page.waitForSelector('#app *', { state: 'attached', timeout: 10000 })
  // 给 useAppLifecycle 的 onMounted 一帧时间注册 session-expired 监听器
  await page.waitForTimeout(100)
}

async function assertTopCentered(page: Page, notif: ReturnType<Page['locator']>, dark: boolean) {
  const box = await notif.boundingBox()
  expect(box, '通知 boundingBox 不可为 null').not.toBeNull()
  if (!box) return

  const viewport = page.viewportSize()
  expect(viewport, 'viewport size 不可为 null').not.toBeNull()
  if (!viewport) return

  const notifCenterX = box.x + box.width / 2
  const viewportCenterX = viewport.width / 2
  const deviation = Math.abs(notifCenterX - viewportCenterX)
  const darkTag = dark ? '暗色' : '浅色'

  // 1. 水平居中: 通知中心点与 viewport 中心 x 偏差 < 20px
  expect(
    deviation,
    `${darkTag}模式: 通知中心 x=${notifCenterX.toFixed(1)} 应接近 viewport 中心 x=${viewportCenterX} (偏差 ${deviation.toFixed(1)}px > ${CENTER_TOLERANCE_PX}px, scss left: 50% 覆盖可能丢失或被 Element Plus 覆盖)`,
  ).toBeLessThan(CENTER_TOLERANCE_PX)

  // 2. 顶部对齐: 通知 top < 100px (Element Plus top-* 默认 top: 16~24px)
  expect(
    box.y,
    `${darkTag}模式: 通知 top=${box.y} 应在 viewport 顶部 ${TOP_MAX_PX}px 内 (通知不在顶部下滑)`,
  ).toBeLessThan(TOP_MAX_PX)

  // 3. 反向断言: 通知左边距 > 50px, 防止 top-left 退化 (top-left 默认 x: 16px, 居中后 x 应 > 50)
  //    注意: 此断言在 Mobile Chrome (窄屏) 上会失败, 因为 330px 通知在 393px 屏幕
  //    居中时 left = (393-330)/2 = 31.5px, 所以用更宽松的 20px 阈值
  const minX = viewport.width < 500 ? 20 : 50
  expect(
    box.x,
    `${darkTag}模式: 通知 x=${box.x} 应 > ${minX}px (通知回退到 top-left 默认 left: 16px 时 x 会接近 16, 不是居中后的 x > ${minX})`,
  ).toBeGreaterThan(minX)
}

test.describe('会话过期通知 top-center 位置浏览器级守卫', () => {
  test('浅色 + Desktop Chrome: 触发 session-expired 后通知水平居中 + 顶部对齐', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    const notif = await triggerSessionExpired(page)
    await assertTopCentered(page, notif, false)
  })

  test('暗色 + Desktop Chrome: 触发 session-expired 后通知水平居中 + 顶部对齐', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    // 切到暗色模式 (覆盖 prefers-color-scheme)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)
    const notif = await triggerSessionExpired(page)
    await assertTopCentered(page, notif, true)
  })

  test('浅色 + Mobile Chrome (Pixel 5): 触发 session-expired 后通知水平居中 + 顶部对齐', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    const notif = await triggerSessionExpired(page)
    await assertTopCentered(page, notif, false)
  })

  test('暗色 + Mobile Chrome (Pixel 5): 触发 session-expired 后通知水平居中 + 顶部对齐', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(300)
    const notif = await triggerSessionExpired(page)
    await assertTopCentered(page, notif, true)
  })
})
