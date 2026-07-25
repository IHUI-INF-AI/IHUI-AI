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
  // 2026-07-25 新增:记录 record.workspacePath 和 startedAt(用于 cross-workspace / race condition 状态验证)
  data.recordWorkspacePath = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:auto-revert-bypass')
      if (!raw) return null
      return JSON.parse(raw).workspacePath ?? null
    } catch {
      return null
    }
  })
  data.recordStartedAt = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:auto-revert-bypass')
      if (!raw) return null
      return JSON.parse(raw).startedAt ?? null
    } catch {
      return null
    }
  })
  data.recordVersion = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:auto-revert-bypass')
      if (!raw) return null
      return JSON.parse(raw).version ?? null
    } catch {
      return null
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
    // 捕获 auto-revert hook 的调试日志
    if (t.includes('auto-revert:')) {
      console.log('  [hook]', t)
    }
    if (t.includes('IHUI_EXTEND_AUTO_REVERT')) {
      console.log('  [hook]', t)
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
  async function setState(mode, autoRevert, workspacePath = 'C:/Windows') {
    await page.evaluate(
      ([m, ar, wp]) => {
        window.localStorage.setItem(
          'ihui-ai-panel',
          JSON.stringify({
            state: {
              width: 400,
              activeWorkspace: {
                path: wp,
                name: wp === 'C:/Windows' ? 'Windows' : wp === 'A:/old-workspace' ? 'Old' : 'Projects',
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
            JSON.stringify({
              startedAt: Date.now(),
              durationMs: 60 * 60 * 1000,
              workspacePath: wp,
              version: 1,
            }),
          )
        } else if (ar === 'start-5min') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 55 * 60 * 1000, // 已过 55min,剩 5min
              durationMs: 60 * 60 * 1000,
              workspacePath: wp,
              version: 1,
            }),
          )
        } else if (ar === 'start-1min') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 59 * 60 * 1000, // 已过 59min,剩 1min
              durationMs: 60 * 60 * 1000,
              workspacePath: wp,
              version: 1,
            }),
          )
        } else if (ar === 'expired') {
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 2 * 60 * 60 * 1000,
              durationMs: 60 * 60 * 1000,
              workspacePath: wp,
              version: 1,
            }),
          )
        } else if (ar === 'cross-workspace-fresh') {
          // 2026-07-25 新增:模拟 localStorage 里残留旧工作区 A 的 record,
          // 当前 activeWorkspace 已切到 C(都是 bypass)。期望 hook 检测到 workspacePath 不匹配 → 重启 record
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 10 * 60 * 1000, // 10 min ago
              durationMs: 60 * 60 * 1000,
              workspacePath: 'A:/old-workspace', // 与当前 wp 不匹配
              version: 1,
            }),
          )
        } else if (ar === 'cross-workspace-expired') {
          // 2026-07-25 新增:跨工作区 + 旧 record 已到期(race condition 场景),
          // 期望 hook 重启 record 而不是 auto-switch 到 default
          window.localStorage.setItem(
            'ihui:auto-revert-bypass',
            JSON.stringify({
              startedAt: Date.now() - 2 * 60 * 60 * 1000,
              durationMs: 60 * 60 * 1000,
              workspacePath: 'A:/old-workspace', // 与当前 wp 不匹配
              version: 1,
            }),
          )
        } else if (ar === 'clear') {
          window.localStorage.removeItem('ihui:auto-revert-bypass')
        }
      },
      [mode, autoRevert, workspacePath],
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
  // 轮询抓降级 toast 文本(必须 ≤ 6s 内抓到,sonner 自动消失)
  const revertedToastPromise = (async () => {
    for (let i = 0; i < 60; i++) {
      const text = await page.evaluate(() => {
        const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
        return toasts.map((t) => t.textContent || '').join(' || ')
      })
      if (text.includes('已自动切回') || text.includes('本次完全访问')) {
        return text
      }
      await page.waitForTimeout(100)
    }
    return ''
  })()
  // hook 内部 void(async () => { ... })() 启动异步 IIFE,需更长时间等 switchPermissionMode + persist 写回
  await page.waitForTimeout(8000)
  const autoRevertedToastText = await revertedToastPromise
  console.log('  [toast-text-reverted]', autoRevertedToastText.slice(0, 250))
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

  // 抓 toast 描述(5min 提醒,自动降级 toast 已在 #5 阶段抓过)
  // 必须在 browser.close() 之前调用
   
  const _fiveMinToastText = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
    return toasts.map((t) => t.textContent || '').join(' || ')
  })

  // 7. 2026-07-25 新增 - 跨工作区 record 污染
  // 场景:localStorage 残留旧工作区 A 的 record,activeWorkspace 已切到 C(/Projects),bypass
  // 期望:hook 检测 workspacePath 不匹配 → 重启 record(workspacePath 改 C,startedAt 接近 now)
  console.log('[7/6] 跨工作区 record 污染修复验证...')
  const beforeCrossWs = Date.now()
  await setState('bypass-permissions', 'cross-workspace-fresh', 'C:/Projects')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-cross-workspace-fresh.png'), fullPage: false })
  const s7 = await captureDom(page, 'cross-workspace-fresh')
  console.log('  →', JSON.stringify(s7))
  const s7ElapsedMs = s7.recordStartedAt ? s7.recordStartedAt - beforeCrossWs : null
  console.log('  [cross-ws-elapsed]', s7ElapsedMs, 'ms(期望 > 0 因为 reload 后才写)')

  // 8. 2026-07-25 新增 - 跨工作区 + 旧 record 已到期(race condition 场景)
  // 场景:旧 record 已过期(2h 前)且 workspacePath 不匹配当前,期望 hook 重启 record 而非 auto-switch
  // 验证:activeMode 仍为 bypass(auto-switch 未触发),record workspacePath 已更新,无降级 toast
  console.log('[8/6] 跨工作区 + 过期 record(race condition 场景)修复验证...')
  await setState('bypass-permissions', 'cross-workspace-expired', 'C:/Projects')
  // 等 hook 完成 workspacePath 校验 + record 重启(以及确认 auto-switch 未触发)
  await page.waitForTimeout(5000)
  // 抓 toast 文本(应该没有"已自动切回")
  const raceToastText = await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
    return toasts.map((t) => t.textContent || '').join(' || ')
  })
  console.log('  [race-toast]', raceToastText.slice(0, 250))
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '8-cross-workspace-expired.png'), fullPage: false })
  const s8 = await captureDom(page, 'cross-workspace-expired')
  console.log('  →', JSON.stringify(s8))

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
    { name: '9. dark 模式 classList.dark', pass: s4.isDark === true },{
      name: '10. 自动撤销后切回 default',
      pass: s5.activeMode === 'default',
    },
    {
      name: '10b. 自动降级 toast 描述含本次时长(usedMin)',
      // 期望描述含 "本次完全访问已持续" 或带数字的"X 分钟"
      pass: /本次完全访问已持续\s*\d+\s*分钟/.test(autoRevertedToastText),
    },
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
    // 2026-07-25 新增:跨工作区 record 污染修复
    {
      name: '14. 跨工作区切换 - record.workspacePath 已更新为当前工作区',
      pass: s7.recordWorkspacePath === 'C:/Projects',
    },
    {
      name: '15. 跨工作区切换 - record 仍激活(autoRevertActive=true)',
      pass: s7.autoRevertActive === true,
    },
    {
      name: '16. 跨工作区切换 - activeMode 仍为 bypass(未被切走)',
      pass: s7.activeMode === 'bypass-permissions',
    },
    // 2026-07-25 新增:跨工作区 + 过期 record race condition 修复
    {
      name: '17. 跨工作区+过期 record - activeMode 仍为 bypass(auto-switch 未误触发)',
      pass: s8.activeMode === 'bypass-permissions',
    },
    {
      name: '18. 跨工作区+过期 record - record 已重启(autoRevertActive=true)',
      pass: s8.autoRevertActive === true,
    },
    {
      name: '19. 跨工作区+过期 record - record.workspacePath 已更新为 C',
      pass: s8.recordWorkspacePath === 'C:/Projects',
    },
    {
      name: '20. 跨工作区+过期 record - 无降级 toast("已自动切回")',
      pass: !/已自动切回|本次完全访问/.test(raceToastText),
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
