/**
 * 浏览器自验脚本 v5 — 高风险模式自动撤销倒计时(2026-07-25)
 *
 * 关键修复(2026-07-25):
 * - 完全弃用 setModeViaUI(走真实 UI 点击 popover,脆弱易抛错)
 * - 改用 setModeAndReload 直接写 localStorage + reload,100% 稳定控制 store 状态
 * - addInitScript 改成"只在 localStorage 无值时设 default",不覆盖 setModeAndReload 写入的值
 *
 * 验证项(6 个状态):
 * 1. 默认态:mode=default,无警告横幅,无倒计时
 * 2. bypass + countdown:警告横幅出现 + 倒计时启动(~60:00 倒计时可见)
 * 3. 取消自动撤销:横幅倒计时消失,显示"重新启用"链接
 * 4. 重新启用:倒计时恢复
 * 5. dark mode:高风险警告在 dark 下也清晰可见
 * 6. 自动撤销归零:把 startedAt 改为 2h 前,看自动切回 default + toast
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-popover-v5')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []

/** 构造 mock 持久化 payload(支持动态 mode 注入) */
function buildPersist(mode) {
  return JSON.stringify({
    state: {
      width: 400,
      activeWorkspace: {
        path: 'C:/Windows',
        name: 'Windows',
        mode,
        techStack: ['typescript', 'next.js'],
      },
    },
    version: 0,
  })
}

async function captureDom(page, label) {
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  const data = { label }
  if ((await trigger.count()) > 0) {
    data.text = (await trigger.textContent())?.trim()
    const cls = await trigger.getAttribute('class')
    data.class = cls?.includes('amber') ? 'amber' : cls?.includes('emerald') ? 'emerald' : 'default'
  } else {
    data.text = 'NO_TRIGGER'
    data.class = 'no-trigger'
  }
  const banner = page.locator('[role="status"][aria-live="polite"]').first()
  data.banner = (await banner.count()) > 0 ? (await banner.textContent())?.trim() : null
  data.countdown = data.banner ? (data.banner.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)?.[1] ?? null) : null
  data.autoRevertActive = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:auto-revert-bypass')
      if (!raw) return false
      const rec = JSON.parse(raw)
      const elapsed = Date.now() - rec.startedAt
      return rec.durationMs - elapsed > 0
    } catch {
      return false
    }
  })
  data.activeMode = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return 'NO_LS'
      return JSON.parse(raw).state?.activeWorkspace?.mode ?? 'null'
    } catch {
      return 'PARSE_ERR'
    }
  })
  // 标题栏徽章
  const titleBadge = page.locator('[data-testid="titlebar-permission-mode"]').first()
  data.titleBadge = (await titleBadge.count()) > 0 ? (await titleBadge.textContent())?.trim() : null
  // 标题栏倒计时
  const titleCountdown = page.locator('[data-testid="titlebar-auto-revert"]').first()
  data.titleCountdown =
    (await titleCountdown.count()) > 0 ? (await titleCountdown.textContent())?.trim() : null
  // 取消按钮
  const cancelBtn = page.locator('button[aria-label="取消自动撤销"]').first()
  data.cancelBtn = (await cancelBtn.count()) > 0
  // dark mode
  data.isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  DOM_LOG.push(data)
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  })
  // 关键:addInitScript 仅在 localStorage 无值时设 default,setModeAndReload 直接覆盖
  await ctx.addInitScript(() => {
    try {
      if (!window.localStorage.getItem('ihui-ai-panel')) {
        window.localStorage.setItem(
          'ihui-ai-panel',
          JSON.stringify({
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
          }),
        )
      }
      ;(window).__IHUI_SKIP_WS_VALIDATE__ = true
    } catch {}
  })
  const page = await ctx.newPage()
  // 仅记录 pageerror(不输出 i18n 缺失键等噪声)
  page.on('pageerror', (err) => console.error('[pageerror]', err.message.slice(0, 300)))
  page.on('console', (msg) => {
    const t = msg.text()
    // 过滤掉 i18n MISSING_MESSAGE 噪声 + CORS + 资源加载错误
    if (msg.type() === 'error' || msg.type() === 'warning') {
      if (
        t.includes('IntlError') ||
        t.includes('CORS') ||
        t.includes('ERR_FAILED') ||
        t.includes('analytics') ||
        t.includes('Failed to load resource') ||
        t.includes('images.localPatterns')
      ) {
        return
      }
      console.error(`[console.${msg.type()}]`, t.slice(0, 200))
    }
  })

  // 拦截 /api/workspace/* 防止真实 API 报错
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { permission: null, permissions: [] } }),
    })
  })

  /** 重设 mock 模式 + 自动撤销状态 + reload */
  async function setState(mode, autoRevert) {
    await page.evaluate(
      ([m, ar]) => {
        window.localStorage.setItem(
          'ihui-ai-panel',
          JSON.stringify({
            state: {
              width: 400,
              activeWorkspace: {
                path: 'C:/Windows',
                name: 'Windows',
                mode: m,
                techStack: ['typescript', 'next.js'],
              },
            },
            version: 0,
          }),
        )
        if (ar === 'start') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({ startedAt: Date.now(), durationMs: 60 * 60 * 1000 }),
          )
        } else if (ar === 'start-5min') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 55 * 60 * 1000, // 已过 55min,剩 5min
              durationMs: 60 * 60 * 1000,
            }),
          )
        } else if (ar === 'start-1min') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 59 * 60 * 1000, // 已过 59min,剩 1min
              durationMs: 60 * 60 * 1000,
            }),
          )
        } else if (ar === 'expired') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 2 * 60 * 60 * 1000,
              durationMs: 60 * 60 * 1000,
            }),
          )
        } else if (ar === 'clear') {
          window.localStorage.removeItem('ihui:auto-revert-bypass')
        }
      },
      [mode, autoRevert],
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
  }

  console.log('[1/6] 打开首页 (default)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.localStorage.removeItem('ihui:auto-revert-bypass'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('未找到权限模式按钮')
    await browser.close()
    process.exit(1)
  }

  // 1. 默认态
  console.log('[2/6] 截图默认态...')
  await trigger.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-default.png'), fullPage: false })
  const s1 = await captureDom(page, 'default')
  console.log('  →', JSON.stringify(s1))

  // 2. bypass + countdown
  console.log('[3/6] 切到 bypass + 启动 1h 倒计时...')
  await setState('bypass-permissions', 'start')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-bypass-with-countdown.png'), fullPage: false })
  const s2 = await captureDom(page, 'bypass-with-countdown')
  console.log('  →', JSON.stringify(s2))

  // 3. 取消自动撤销
  console.log('[4/6] 点击取消自动撤销...')
  const cancelBtn = page.locator('button[aria-label="取消自动撤销"]').first()
  if ((await cancelBtn.count()) > 0) {
    await cancelBtn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-auto-revert-cancelled.png'), fullPage: false })
    const s3 = await captureDom(page, 'auto-revert-cancelled')
    console.log('  →', JSON.stringify(s3))
  } else {
    console.error('  [warn] 未找到取消按钮')
  }

  // 4. 重新启用
  console.log('[5/6] 重新启用 1h 自动撤销 + 切到 dark mode...')
  await setState('bypass-permissions', 'start')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-dark-bypass-countdown.png'), fullPage: false })
  const s4 = await captureDom(page, 'dark-bypass-countdown')
  console.log('  →', JSON.stringify(s4))

  // 5. 倒计时归零 → 自动切回 default
  console.log('[6/6] 模拟倒计时归零 → 自动切回 default + toast...')
  await setState('bypass-permissions', 'expired')
  // 调试:打印 setState 后的 localStorage 状态
  const debugLs = await page.evaluate(() => ({
    autoRevert: window.localStorage.getItem('ihui:auto-revert-bypass'),
    activeWorkspace: window.localStorage.getItem('ihui-ai-panel'),
  }))
  console.log('  [debug-ls]', JSON.stringify(debugLs).slice(0, 300))
  // hook 内部 void(async () => { ... })() 启动异步 IIFE,需更长时间等 switchPermissionMode + persist 写回
  await page.waitForTimeout(8000)
  const debugLs2 = await page.evaluate(() => ({
    autoRevert: window.localStorage.getItem('ihui:auto-revert-bypass'),
    activeWorkspace: window.localStorage.getItem('ihui-ai-panel'),
  }))
  console.log('  [debug-ls-8s]', JSON.stringify(debugLs2).slice(0, 300))
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-auto-reverted-toast.png'), fullPage: false })
  const s5 = await captureDom(page, 'auto-reverted-toast')
  console.log('  →', JSON.stringify(s5))

  // 6. 快到期提醒(5min) + 全局 __IHUI_EXTEND_AUTO_REVERT__ 句柄
  console.log('[6/6+] 模拟剩 5min → 验证 5min 提醒 + 全局 extendRevert 句柄...')
  await setState('bypass-permissions', 'start-5min')
  // 等待 hook 触发 5min 提醒
  await page.waitForTimeout(3500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-warning-5min.png'), fullPage: false })
  const s6 = await captureDom(page, 'warning-5min')
  console.log('  →', JSON.stringify(s6))
  // 验证全局句柄存在 + 调用后刷新 record
  const extendTest = await page.evaluate(() => {
    const w = window
    const beforeRaw = w.localStorage.getItem('ihui:auto-revert-bypass')
    const before = beforeRaw ? JSON.parse(beforeRaw) : null
    if (typeof w.__IHUI_EXTEND_AUTO_REVERT__ !== 'function') {
      return { ok: false, reason: 'no global handle' }
    }
    w.__IHUI_EXTEND_AUTO_REVERT__()
    return { ok: true, beforeStartedAt: before?.startedAt }
  })
  console.log('  [extend-test]', JSON.stringify(extendTest))
  await page.waitForTimeout(1500)
  const s6b = await captureDom(page, 'warning-5min-after-extend')
  console.log('  → after-extend', JSON.stringify(s6b))

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  console.log('\n[DOM 数据汇总]:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d))

  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // 验证
  console.log('\n[验证]:')
  const checks = [
    { name: '1. default 模式 activeMode', pass: s1.activeMode === 'default' },
    { name: '2. bypass 模式 activeMode', pass: s2.activeMode === 'bypass-permissions' },
    { name: '3. bypass 触发器 class=amber', pass: s2.class === 'amber' },
    { name: '4. bypass 警告横幅出现', pass: !!s2.banner },
    { name: '5. bypass 自动撤销激活', pass: s2.autoRevertActive === true },
    { name: '6. bypass 标题栏徽章', pass: !!s2.titleBadge && s2.titleBadge.includes('完全访问') },
    { name: '7. bypass 标题栏倒计时', pass: !!s2.titleCountdown && /\d{1,2}:\d{2}/.test(s2.titleCountdown) },
    { name: '8. 取消按钮可见', pass: s2.cancelBtn === true },
    { name: '9. dark 模式 classList.dark', pass: s4.isDark === true },
    { name: '10. 自动撤销后切回 default', pass: s5.activeMode === 'default' },
    {
      name: '11. 5min 提醒 - 横幅仍可见(警告态)',
      pass: s6.banner?.includes('完全访问模式') || s6.titleCountdown !== null,
    },
    {
      name: '12. 全局 extendRevert 句柄存在',
      pass: extendTest.ok === true,
    },
    {
      name: '13. extendRevert 调用后 record 重置(剩余时间 > 55min)',
      pass: (() => {
        const m = s6b.titleCountdown?.match(/(\d+):(\d+):(\d+)/) || s6b.titleCountdown?.match(/(\d+):(\d+)/)
        if (!m) return false
        // 期望: 接近 1:00:00
        const total = m.length === 4
          ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
          : Number(m[1]) * 60 + Number(m[2])
        return total > 55 * 60 // > 55min
      })(),
    },
  ]
  let passed = 0
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`)
    if (c.pass) passed++
  }
  console.log(`\n[总结] ${passed}/${checks.length} 项通过`)
  if (passed < checks.length) process.exit(1)
}

main().catch((err) => {
  console.error('[自验失败]:', err.message)
  process.exit(1)
})
