/**
 * 浏览器自验脚本 — PermissionModePopover 第二轮深化验证(2026-07-25)
 *
 * 验证项:
 * 1. 默认态:触发器按钮显示当前模式短名
 * 2. 触发态:点击触发器,弹层打开,显示 3 个模式卡片
 * 3. 键盘聚焦态:键盘 ↑/↓ 切换焦点
 * 4. 数字键切模式:弹层内按 3 切到完全访问
 * 5. 高风险态:bypass-permissions 模式 → 输入框琥珀边框 + 警告横幅
 * 6. Shift+Tab 循环切:在 textarea 中按 Shift+Tab 切模式
 * 7. AI 消息徽章:mock 一条 AI 消息带 mode,看气泡标签旁是否显示徽章
 * 8. dark mode:dark 模式截图
 *
 * 关键技术:
 * - addInitScript 在每个 page 加载前注入 localStorage 模拟"已绑定工作区"
 * - page.route 拦截 /api/workspace/fs/browse 防止 setActiveWorkspace(null) 自动解绑
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-popover-v3')

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const DOM_LOG = []

// zustand persist 默认结构:{ state: { width, activeWorkspace }, version: 0 }
// 用真实存在的工作区路径(让 browseDirectory 路径校验通过,避免被自动解绑)
const MOCK_PERSIST = JSON.stringify({
  state: {
    width: 400,
    activeWorkspace: {
      path: 'C:/Windows',
      name: 'Windows',
      mode: 'default',
      techStack: ['typescript', 'next.js'],
    },
  },
  version: 0,
})

async function captureDom(page, label) {
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  const data = { label }
  if ((await trigger.count()) > 0) {
    data.text = (await trigger.textContent())?.trim()
    const cls = await trigger.getAttribute('class')
    data.class = cls?.includes('amber')
      ? 'amber'
      : cls?.includes('emerald')
        ? 'emerald'
        : 'default'
  }
  // 警告横幅(role=status aria-live=polite)
  const banner = page.locator('[role="status"][aria-live="polite"]').first()
  data.banner = (await banner.count()) > 0 ? (await banner.textContent())?.trim() : null
  // textarea 边框
  const textarea = page.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    const taCls = await textarea.getAttribute('class')
    data.textareaHasAmber = taCls?.includes('amber') ?? false
  }
  // 实际 activeWorkspace mode
  data.activeMode = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return 'NO_LS'
      const parsed = JSON.parse(raw)
      return parsed.state?.activeWorkspace?.mode ?? 'null'
    } catch {
      return 'PARSE_ERR'
    }
  })
  DOM_LOG.push(data)
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  })

  // 在每个 page load 前注入 mock 工作区绑定态(覆盖 zustand persist rehydrate)
  // + dev 自验模式:window.__IHUI_SKIP_WS_VALIDATE__=true 跳过 workspace-selector 的路径校验
  await ctx.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value)
        ;(window).__IHUI_SKIP_WS_VALIDATE__ = true
      } catch {}
    },
    ['ihui-ai-panel', MOCK_PERSIST],
  )

  const page = await ctx.newPage()

  // page.on 在 newPage 之后
  page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('CORS') && !t.includes('ERR_FAILED') && !t.includes('analytics')) {
        console.error('[console.error]', t)
      }
    }
  })
  // 记录所有 workspace 相关请求,看 browseDirectory 走的是什么 URL
  const networkLog = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('workspace') || url.includes('browse') || url.includes('recent') || url.includes('permission')) {
      networkLog.push(`[${req.method()}] ${url}`)
    }
  })
  page.on('response', (resp) => {
    const url = resp.url()
    if (url.includes('workspace') || url.includes('browse') || url.includes('recent') || url.includes('permission')) {
      networkLog.push(`[RESP ${resp.status()}] ${url}`)
    }
  })

  // ctx.route(网络层拦截,不受 page baseURL 限制 — page.route 只拦 page.goto 同源请求)
  // web 端通过 NEXT_PUBLIC_API_BASE_URL=http://localhost:8802 直连 API(8802)
  await ctx.route(/\/api\/workspace\//, async (route) => {
    const url = route.request().url()
    if (url.includes('/api/workspace/permissions') && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            permission: {
              workspacePath: 'C:/Windows',
              name: 'Windows',
              mode: 'default',
              techStack: 'typescript,next.js',
            },
          },
        }),
      })
      return
    }
    if (url.includes('/api/workspace/permission') || url.includes('/api/workspace/permissions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { permission: null, permissions: [] } }),
      })
      return
    }
    if (url.includes('/api/workspace/fs/browse')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { entries: [] } }),
      })
      return
    }
    if (url.includes('/api/workspace/recent')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { workspaces: [] } }),
      })
      return
    }
    await route.continue()
  })

  console.log('[1/9] 打开首页(mock 绑定工作区 mode=default)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  // 立即读 localStorage(zustand persist rehydrate 前)
  const lsImmediate = await page.evaluate(() => {
    const v = window.localStorage.getItem('ihui-ai-panel')
    return v ? v.slice(0, 300) : 'NULL'
  })
  console.log('    [debug-immediate] localStorage:', lsImmediate)
  // 500ms 后再读一次,看是不是 hydration 触发了清空
  await page.waitForTimeout(500)
  const ls500 = await page.evaluate(() => {
    const v = window.localStorage.getItem('ihui-ai-panel')
    return v ? v.slice(0, 300) : 'NULL'
  })
  console.log('    [debug-500ms] localStorage:', ls500)
  await page.waitForTimeout(2500)
  const ls0 = await page.evaluate(() => {
    const v = window.localStorage.getItem('ihui-ai-panel')
    return v ? v.slice(0, 300) : 'NULL'
  })
  console.log('    [debug-after-3s] localStorage:', ls0)

  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('未找到权限模式按钮')
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '0-no-trigger.png'), fullPage: false })
    await browser.close()
    process.exit(1)
  }

  // 1. 默认态
  console.log('[2/9] 截图默认态...')
  await trigger.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-default.png'), fullPage: false })
  await captureDom(page, 'default')

  // 2. 弹层打开
  console.log('[3/9] 点击触发器,截图弹层打开态...')
  await trigger.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-popover-open.png'), fullPage: false })
  await captureDom(page, 'popover-open')

  // 3. 键盘聚焦态
  console.log('[4/9] 按 ↓ 切换焦点,截图键盘聚焦态...')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-keyboard-focus.png'), fullPage: false })
  await captureDom(page, 'keyboard-focus')

  // 4. 弹层内按数字键 3 切到完全访问
  console.log('[5/9] 弹层内按数字键 3 切到 bypass-permissions...')
  await page.keyboard.press('3')
  await page.waitForTimeout(1800) // 等切模式 + toast
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-bypass-via-popover.png'), fullPage: false })
  await captureDom(page, 'bypass-via-popover')

  // 5. 关闭弹层,在 textarea 中按 Shift+Tab 循环切回 default
  console.log('[6/9] 关闭弹层,textarea 中按 Shift+Tab 循环切回 default...')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const textarea = page.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    await textarea.click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-shift-tab-default.png'), fullPage: false })
    await captureDom(page, 'shift-tab-default')
  }

  // 6. 再按 Shift+Tab 切到 accept-edits
  console.log('[7/9] 再按 Shift+Tab 切到 accept-edits...')
  if ((await textarea.count()) > 0) {
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-accept-edits.png'), fullPage: false })
    await captureDom(page, 'accept-edits')
  }

  // 7. dark mode (current = accept-edits)
  console.log('[8/9] 切到 dark mode (accept-edits)...')
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-dark-accept-edits.png'), fullPage: false })
  await captureDom(page, 'dark-accept-edits')

  // 8. 切到 bypass + dark(用 Shift+Tab)
  console.log('[9/9] 切到 bypass-permissions + dark...')
  if ((await textarea.count()) > 0) {
    await textarea.click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '8-dark-bypass.png'), fullPage: false })
    await captureDom(page, 'dark-bypass')
  }

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  writeFileSync(resolve(SCREENSHOT_DIR, 'network.log'), networkLog.join('\n'))
  console.log('\n[网络日志]:')
  for (const n of networkLog.slice(0, 50)) console.log('  ', n)
  console.log('\n[DOM 数据]:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d))

  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)
}

main().catch((err) => {
  console.error('[自验失败]:', err.message)
  process.exit(1)
})
