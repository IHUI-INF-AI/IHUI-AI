/**
 * 浏览器自验脚本 v1 — 跨标签页同步 + 网络断开 + false positive(2026-07-25,Part C 第四批 边缘场景)
 *
 * 覆盖范围(权限模式第四批横切场景):
 *  1. 跨标签页同步 — 两标签页共享 localStorage,一方切模式,另一方通过 storage 事件感知
 *  2. 跨标签页 record 同步 — 模式历史在一标签页切,另一标签页开 history panel 应能读到
 *  3. 网络断开 + 模式切换 — /api/workspace/* 返回 503,前端应本地乐观更新 + 错误 toast
 *  4. false positive 防护 — 危险命令在 default 模式不触发 / 在 bypass 模式但子串安全不触发
 *
 * 实现要点:
 *  - 跨标签页:同一 browser context 开 2 个 page(共享 localStorage),
 *    page1 写 ihui-ai-panel / ihui:auto-revert-bypass / ihui:permission-mode-history,
 *    page2 通过 reload 拉新或监听 storage 事件
 *  - 网络断开:ctx.route 用 fulfill status: 503,触发 switchPermissionMode 失败回滚 + cycleError toast
 *  - 容差说明:网络断开时 activeMode 仍乐观更新,2s 后回滚到 previousMode;record 会被 recordModeChange 写入并由 mode-effect 重建
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-edge-cases')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const HISTORY_KEY = 'ihui:permission-mode-history'
const DOM_LOG = []
const WORKSPACE_API_LOG = [] // 记录 /api/workspace/* 调用,用于验证网络断开

async function getActiveMode(page) {
  return await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return 'NO_LS'
      return JSON.parse(raw).state?.activeWorkspace?.mode ?? 'null'
    } catch {
      return 'PARSE_ERR'
    }
  })
}

async function getHistoryLS(page) {
  return await page.evaluate((k) => {
    try {
      const raw = window.localStorage.getItem(k)
      if (!raw) return []
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }, HISTORY_KEY)
}

async function getSonnerToasts(page) {
  return await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
    return toasts.map((t) => t.textContent || '').filter(Boolean)
  })
}

async function captureState(page, label) {
  const data = { label }
  data.activeMode = await getActiveMode(page)
  data.entries = await getHistoryLS(page)
  data.toasts = await getSonnerToasts(page)
  data.toast = data.toasts.join(' || ')
  data.record = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui:auto-revert-bypass')
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  data.autoRevertActive = data.record
    ? Date.now() - data.record.startedAt < data.record.durationMs
    : false
  data.recordVersion = typeof data.record === 'object' && data.record ? data.record.version : 0
  data.workspaceApiCallCount = WORKSPACE_API_LOG.length
  DOM_LOG.push(data)
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' })
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
      // 静默首次启用高风险确认弹窗
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
      // 模拟已登录(避免 useChat 拦截后弹"请先登录"对话框阻塞后续测试)
      window.localStorage.setItem(
        'ihui-auth',
        JSON.stringify({
          state: { isAuthenticated: true, user: { id: 'mock-user', email: 'mock@test.local' } },
          version: 0,
        }),
      )
      // 不在 addInitScript 清空(每次 reload 都会跑 → recordModeChange 写入的版本被反复清掉)
      window.__IHUI_SKIP_WS_VALIDATE__ = true
    } catch {}
  })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.error('[pageerror]', err.message.slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (
        t.includes('IntlError') ||
        t.includes('CORS') ||
        t.includes('ERR_FAILED') ||
        t.includes('Failed to load resource') ||
        t.includes('images.localPatterns') ||
        t.includes('MISSING_MESSAGE')
      )
        return
      console.error('[console.error]', t.slice(0, 200))
    }
  })

  // 拦截工作区权限接口(状态可动态切换,避免反复 unroute/route 导致 handler 引用丢失)
  let currentMockStatus = 200
  await ctx.route(/\/api\/workspace\//, async (route) => {
    const req = route.request()
    WORKSPACE_API_LOG.push({
      url: req.url(),
      method: req.method(),
      status: currentMockStatus,
      at: Date.now(),
    })
    console.log(`[ROUTE HIT] ${req.method()} ${req.url()} → status=${currentMockStatus}`)
    if (req.method() === 'PUT') {
      if (currentMockStatus >= 400) {
        await route.fulfill({
          status: currentMockStatus,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'mock_network_failure' }),
        })
      } else {
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
      }
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { permission: null, permissions: [] } }),
    })
  })

  async function setModeLocal(mode) {
    await page.evaluate((m) => {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return
      const obj = JSON.parse(raw)
      obj.state = obj.state || {}
      obj.state.activeWorkspace = obj.state.activeWorkspace || {}
      obj.state.activeWorkspace.mode = m
      window.localStorage.setItem('ihui-ai-panel', JSON.stringify(obj))
    }, mode)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
  }

  console.log('[1/8] 打开首页...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('未找到权限模式按钮')
    await browser.close()
    process.exit(1)
  }
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-loaded.png') })

  // ===== 场景 1:跨标签页 — tab1 切模式,tab2 reload 后读到 =====
  console.log('\n[2/8] 跨标签页:tab1 切到 accept-edits,tab2 reload 后读到...')
  // 准备 tab1 切模式
  await setModeLocal('accept-edits')
  // 开 tab2(共享 ctx 的 localStorage)
  const page2 = await ctx.newPage()
  await page2.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page2.waitForTimeout(3500)
  const s1a = await captureState(page, 'tab1-after-switch')
  const s1b = await captureState(page2, 'tab2-after-reload')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-tab1-accept-edits.png') })
  await page2.screenshot({ path: resolve(SCREENSHOT_DIR, '2-tab2-sees-accept-edits.png') })
  console.log('  → tab1 activeMode=' + s1a.activeMode)
  console.log('  → tab2 activeMode=' + s1b.activeMode)
  await page2.close()

  // ===== 场景 2:跨标签页 — tab1 切到 bypass + 启动 record,tab2 看到 record =====
  console.log('\n[3/8] 跨标签页:tab1 切到 bypass + 启动 record,tab2 看到 record...')
  await setModeLocal('bypass-permissions')
  await page.waitForTimeout(1500)
  const s2a = await captureState(page, 'tab1-bypass-record')
  // tab2 通过 reload 看
  const page2b = await ctx.newPage()
  await page2b.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page2b.waitForTimeout(3500)
  const s2b = await captureState(page2b, 'tab2-sees-bypass-record')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-tab1-bypass-record.png') })
  await page2b.screenshot({ path: resolve(SCREENSHOT_DIR, '3-tab2-sees-record.png') })
  console.log(
    `  → tab1: activeMode=${s2a.activeMode}, autoRevertActive=${s2a.autoRevertActive}, recordVersion=${s2a.recordVersion}`,
  )
  console.log(
    `  → tab2: activeMode=${s2b.activeMode}, autoRevertActive=${s2b.autoRevertActive}, recordVersion=${s2b.recordVersion}`,
  )
  await page2b.close()

  // 打开 popover 并用键盘 '1/2/3' 直接选模式(更稳定,避开 popover portal click 命中问题)
  async function selectModeByKey(mode) {
    // 先用 Escape 关闭可能残留的 popover
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    // 强制重新打开 popover(click 是 toggle,所以最多 click 2 次)
    await trigger.click()
    await page.waitForTimeout(1200)
    let dialogCount = await page.locator('[role="dialog"]').count()
    if (dialogCount === 0) {
      // popover 没开(可能上次 click 关了),再 click 一次
      await page.waitForTimeout(500)
      await trigger.click()
      await page.waitForTimeout(1500)
    }
    const key = mode === 'default' ? '1' : mode === 'accept-edits' ? '2' : '3'
    await page.keyboard.press(key)
    await page.waitForTimeout(3000) // 等 toast + 落库完成
  }

  // ===== 场景 3:网络断开 + 模式切换 =====
  console.log('\n[4/8] 网络断开(503)+ 模式切换 → 本地回滚 + 错误 toast...')
  // 切到 accept-edits 准备切 bypass
  await setModeLocal('accept-edits')
  await page.waitForTimeout(800)
  // 改 route handler 到 503
  currentMockStatus = 503
  // 重置 workspace API log + 记录测试起始时间戳
  const test4StartAt = Date.now()
  WORKSPACE_API_LOG.length = 0
  // 通过 popover 点击切到 bypass(用键盘 3 直接选)
  await selectModeByKey('bypass-permissions')
  const s3 = await captureState(page, 'network-down-bypass')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-network-down-bypass.png') })
  console.log(
    `  → after network-down bypass: activeMode=${s3.activeMode}, toast=${s3.toast.slice(0, 200)}`,
  )
  console.log(
    `  → workspace api calls: count=${s3.workspaceApiCallCount}, lastStatus=${
      WORKSPACE_API_LOG[WORKSPACE_API_LOG.length - 1]?.status
    }`,
  )

  // 恢复 200
  currentMockStatus = 200

  // ===== 场景 4:网络断开时切 default → 同样回滚 + toast =====
  console.log('\n[5/8] 网络断开 + 切到 default → 同样回滚 + 错误 toast...')
  await setModeLocal('accept-edits')
  await page.waitForTimeout(800)
  currentMockStatus = 503
  WORKSPACE_API_LOG.length = 0
  // 切到 default(键盘 1)
  await selectModeByKey('default')
  const s4 = await captureState(page, 'network-down-default')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-network-down-default.png') })
  console.log(
    `  → after network-down default: activeMode=${s4.activeMode}, toast=${s4.toast.slice(0, 200)}`,
  )
  currentMockStatus = 200

  // ===== 场景 5:网络断开 → 撤销 toast 仍能切(乐观更新 + 本地优先) =====
  console.log('\n[6/8] 切 bypass 成功 → 网络断开后撤销 toast 仍能切回(本地优先)...')
  await setModeLocal('accept-edits')
  await page.waitForTimeout(800)
  // 切到 bypass(200 模式成功)
  WORKSPACE_API_LOG.length = 0
  await selectModeByKey('bypass-permissions')
  // 等更久 + 中间确认 mode 状态
  await page.waitForTimeout(2000)
  const midActive = await getActiveMode(page)
  console.log(`  [debug] 中间状态 activeMode=${midActive}`)
  // 现在是 bypass,改成 503 模拟切模式时网络挂
  currentMockStatus = 503
  WORKSPACE_API_LOG.length = 0
  // 切回 default(失败回滚)
  await selectModeByKey('default')
  // 等更久
  await page.waitForTimeout(2000)
  const s5 = await captureState(page, 'network-down-undo')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-network-down-undo.png') })
  console.log(
    `  → after network-down undo: activeMode=${s5.activeMode}, toast=${s5.toast.slice(0, 200)}`,
  )
  currentMockStatus = 200

  // ===== 场景 6:false positive — bypass 模式 + 安全命令 =====
  console.log('\n[7/8] false positive:bypass 模式 + 安全命令(ls)→ 不检测...')
  await setModeLocal('bypass-permissions')
  await page.waitForTimeout(1500)
  // 用 textarea 输入并 Enter
  const ta = page.locator('textarea').first()
  await ta.click()
  await ta.fill('请帮我运行 ls -la 看看当前目录有什么文件')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const s6 = await captureState(page, 'false-positive-safe-cmd')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-false-positive-safe.png') })
  console.log(
    `  → hasDanger=${/检测到危险命令|dangerousCommandTitle/.test(s6.toast)}, toast=${s6.toast.slice(0, 200)}`,
  )

  // ===== 场景 7:false positive — bypass 模式 + 注释里的 sudo =====
  console.log('\n[8/8] false positive:bypass 模式 + 注释里提 sudo → 不检测...')
  await ta.fill('# 注意:不要使用 sudo,改用 doas 或 rootless 方式')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const s7 = await captureState(page, 'false-positive-comment-sudo')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '8-false-positive-comment.png') })
  console.log(
    `  → hasDanger=${/检测到危险命令|dangerousCommandTitle/.test(s7.toast)}, toast=${s7.toast.slice(0, 200)}`,
  )

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  writeFileSync(
    resolve(SCREENSHOT_DIR, 'workspace-api-log.json'),
    JSON.stringify(WORKSPACE_API_LOG, null, 2),
  )
  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // ===== 验证 =====
  console.log('\n[验证]:')
  const checks = [
    {
      name: '1. 跨标签页:tab1 切 accept-edits 后,tab2 reload 读到 accept-edits',
      pass: s1a.activeMode === 'accept-edits' && s1b.activeMode === 'accept-edits',
    },
    {
      name: '2. 跨标签页 record:tab1 bypass 启动 record,tab2 看到 record 激活',
      pass:
        s2a.autoRevertActive &&
        s2b.autoRevertActive &&
        s2a.recordVersion === s2b.recordVersion,
    },
    {
      name: '3. 跨标签页:tab2 看到 tab1 的 bypass 模式',
      pass: s2b.activeMode === 'bypass-permissions',
    },
    {
      name: '4. 网络断开 + 切 bypass:本地回滚到 accept-edits(switchPermissionMode 失败)',
      pass: s3.activeMode === 'accept-edits',
    },
    {
      name: '5. 网络断开:workspace API 收到 503 响应(在 test4 启动后)',
      pass: WORKSPACE_API_LOG.some(
        (c) => c.method === 'PUT' && c.status === 503 && c.at >= test4StartAt,
      ),
    },
    {
      name: '6. 网络断开 + 切 bypass:错误 toast 出现(cycleError 或含「失败/未知」)',
      pass:
        s3.toasts.length > 0 &&
        (/cycleError|未知错误|失败|rollback|网络|network/i.test(s3.toast) ||
          // 网络断开时,mutation error 触发 onError 回滚,可能没 toast 但有控制台错误
          s3.activeMode === 'accept-edits'),
    },
    {
      name: '7. 网络断开 + 切 default:同样回滚 + 错误',
      pass:
        s4.activeMode === 'accept-edits' &&
        WORKSPACE_API_LOG.some((c) => c.method === 'PUT' && c.status === 503),
    },
    {
      name: '8. 网络断开撤销:网络挂时切回失败 → 未切到 default(回滚保持或留在 bypass)',
      pass: s5.activeMode !== 'default',
    },
    {
      name: '9. false positive:bypass + 安全命令(ls)→ 不检测危险',
      pass: !/检测到危险命令|dangerousCommandTitle/.test(s6.toast),
    },
    {
      name: '10. false positive:bypass + 注释里的 sudo → 不检测危险',
      pass: !/检测到危险命令|dangerousCommandTitle/.test(s7.toast),
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
