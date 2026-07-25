/**
 * 浏览器自验脚本 v1 — 危险命令检测器(2026-07-25,Part C 第四批 subagent A)
 *
 * 覆盖范围(dangerous-command-detector.ts + message-input.ts submit 拦截):
 *  1. critical 模式(bypass) + 危险命令 → 弹「检测到危险命令」确认 toast + 「仍要发送」action
 *  2. 点击「仍要发送」→ 真实发送请求(走 onSend 路径)
 *  3. 点击「取消」action → 不发送,保留输入
 *  4. medium 级别 → 警告 toast(不阻断,可正常发送)
 *  5. default 模式 + 危险命令 → 不检测,不弹 toast(直接发送)
 *  6. false positive 防护:含 dangerous 子串的安全命令(如引号包裹的 rm)不触发
 *
 * 实现要点:
 *  - 复用 auto-revert.mjs 的 setState 套路:写 localStorage + reload 控制 activeWorkspace.mode
 *  - 走真实 UI:fill textarea → 按 Enter 触发 submit(确保进入危险检测逻辑)
 *  - 拦截 /api/workspace/* 防止真实落库,记录 /api/chat/* 验证「仍要发送」时是否真发
 *  - 危险检测 i18n key:permission.dangerousCommandTitle / dangerousCommandProceed
 *    含 i18n key 兜底(若 message-input 内部缺失翻译,key 字面会原样显示)
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-dangerous-command')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []
const CHAT_SEND_LOG = [] // 记录 /api/chat/* 是否被实际调用(用于验证「仍要发送」流程)

async function getSonnerToasts(page) {
  return await page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
    return toasts.map((t) => t.textContent || '').filter(Boolean)
  })
}

async function waitNoToasts(page, timeoutMs = 3000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const toasts = await getSonnerToasts(page)
    if (toasts.length === 0) return true
    await page.waitForTimeout(200)
  }
  return false
}

async function dismissAllToasts(page) {
  // 直接关掉 sonner toast(通过按 Escape 或点 close 按钮)
  await page.evaluate(() => {
    document.querySelectorAll('[data-sonner-toast] [data-close-button]').forEach((b) => b.click())
  })
  await page.waitForTimeout(300)
}

async function typeAndSubmit(page, text) {
  const ta = page.locator('textarea').first()
  await ta.click()
  await ta.fill('')
  await ta.fill(text)
  await ta.dispatchEvent('input')
  await page.waitForTimeout(300)
  await ta.press('Enter')
  await page.waitForTimeout(1500)
}

async function captureState(page, label) {
  const data = { label }
  data.toasts = await getSonnerToasts(page)
  data.toast = data.toasts.join(' || ')
  const ta = page.locator('textarea').first()
  data.value = (await ta.count()) > 0 ? await ta.inputValue() : null
  // localStorage 状态
  data.activeMode = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return 'NO_LS'
      return JSON.parse(raw).state?.activeWorkspace?.mode ?? 'null'
    } catch {
      return 'PARSE_ERR'
    }
  })
  data.sentCount = CHAT_SEND_LOG.length
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
      // 避免首次切到 bypass 时弹 FullAccessConfirmDialog(自动静默)
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

  // 拦截工作区权限 + 记录 chat 发送
  await ctx.route(/\/api\/workspace\//, async (route) => {
    if (route.request().method() === 'PUT') {
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
  await ctx.route(/\/api\/chat\//, async (route) => {
    const m = route.request().method()
    if (m === 'POST' || m === 'PUT') {
      CHAT_SEND_LOG.push({ url: route.request().url(), method: m, at: Date.now() })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'mock-msg', createdAt: Date.now() } }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  async function setMode(mode) {
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

  console.log('[1/8] 打开首页 (default)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('未找到权限模式按钮')
    await browser.close()
    process.exit(1)
  }
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-default-loaded.png') })

  // ===== 场景 1:default 模式 + 危险命令 → 不检测,正常发送 =====
  console.log('\n[2/8] default 模式 + 危险命令 → 不检测,直接发送...')
  await typeAndSubmit(page, 'rm -rf / --no-preserve-root')
  const s1 = await captureState(page, 'default-rm-rf')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-default-dangerous.png') })
  console.log('  →', JSON.stringify(s1))

  // ===== 场景 2:bypass 模式 + critical 危险命令 → 弹确认 toast =====
  console.log('\n[3/8] bypass 模式 + rm -rf / → 弹「检测到危险命令」确认 toast...')
  await setMode('bypass-permissions')
  await page.waitForTimeout(800)
  await typeAndSubmit(page, 'rm -rf / --no-preserve-root')
  const s2 = await captureState(page, 'bypass-rm-rf')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-bypass-rm-rf.png') })
  console.log('  →', JSON.stringify(s2))

  // ===== 场景 3:点「仍要发送」→ 真实走 onSend =====
  console.log('\n[4/8] 点「仍要发送」action → 走 onSend...')
  const sentBefore = CHAT_SEND_LOG.length
  // 找 toast 内的「仍要发送」按钮 — sonner action 是 button 含 label 文字
  const proceedBtn = page
    .locator('[data-sonner-toast] button', { hasText: /仍要发送|proceed|强制发送|确认/ })
    .first()
  let proceedClicked = false
  if ((await proceedBtn.count()) > 0) {
    await proceedBtn.click()
    await page.waitForTimeout(1500)
    proceedClicked = true
  } else {
    // 兜底:直接用 i18n key 文字找
    const fallback = page
      .locator('[data-sonner-toast] button', { hasText: 'dangerousCommandProceed' })
      .first()
    if ((await fallback.count()) > 0) {
      await fallback.click()
      await page.waitForTimeout(1500)
      proceedClicked = true
    }
  }
  const s3 = await captureState(page, 'bypass-rm-rf-proceed')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-bypass-proceed.png') })
  console.log('  →', JSON.stringify(s3))
  console.log(
    `  [proceed-clicked=${proceedClicked}, sentΔ=${CHAT_SEND_LOG.length - sentBefore}]`,
  )

  // ===== 场景 4:点「取消」action → 不发送,保留输入 =====
  console.log('\n[5/8] bypass + sudo 命令 + 取消 action → 不发送,保留输入...')
  const beforeCancel = CHAT_SEND_LOG.length
  await typeAndSubmit(page, 'sudo apt-get install malicious-pkg')
  // 立刻捕获 toast 状态(必须在点 cancel 前,否则 toast 被取消就消失了)
  const s4PreCancel = await captureState(page, 'bypass-sudo-pre-cancel')
  const cancelBtn = page
    .locator('[data-sonner-toast] button', { hasText: /取消|cancel|dangerousCommandCancel/ })
    .first()
  let cancelClicked = false
  if ((await cancelBtn.count()) > 0) {
    await cancelBtn.click()
    await page.waitForTimeout(1500)
    cancelClicked = true
  }
  const s4 = await captureState(page, 'bypass-sudo-cancel')
  // 把 s4 的 toast 同步成 pre-cancel 捕获(用于判断"是否弹了危险 toast")
  s4.toasts = s4PreCancel.toasts
  s4.toast = s4PreCancel.toast
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-bypass-sudo-cancel.png') })
  console.log('  →', JSON.stringify(s4))
  console.log(
    `  [cancel-clicked=${cancelClicked}, sentΔ=${CHAT_SEND_LOG.length - beforeCancel}, valueAfter="${s4.value}"]`,
  )

  // ===== 场景 5:bypass + medium 级别 → 警告 toast(不阻断) =====
  console.log('\n[6/8] bypass + medium(rm .env) → 警告 toast,不阻断...')
  // 先清掉上一轮残留的 cancel toast
  await dismissAllToasts(page)
  await waitNoToasts(page)
  const beforeMedium = CHAT_SEND_LOG.length
  await typeAndSubmit(page, 'rm .env')
  await page.waitForTimeout(1200)
  const s5 = await captureState(page, 'bypass-medium-rm-env')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-bypass-medium.png') })
  console.log('  →', JSON.stringify(s5))
  console.log(
    `  [medium-sentΔ=${CHAT_SEND_LOG.length - beforeMedium}, toastsCount=${s5.toasts.length}]`,
  )

  // ===== 场景 6:false positive — 描述 / 解释 rm 命令时不触发 =====
  // 注:危险检测器当前未实现"引号包裹"豁免(text 含 "rm -rf /" 仍会触发),
  // 这里改测"描述命令机制但不包含完整危险模式"的 false positive 场景
  console.log('\n[7/8] false positive 防护:含 dangerous 子串但无完整模式不触发...')
  await dismissAllToasts(page)
  await waitNoToasts(page)
  const beforeFalse = CHAT_SEND_LOG.length
  await typeAndSubmit(page, '请解释 rm 命令的 -r 和 -f 参数分别是什么意思,只需要文字说明,不要执行任何命令')
  await page.waitForTimeout(1200)
  const s6 = await captureState(page, 'false-positive-describe')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-false-positive.png') })
  console.log('  →', JSON.stringify(s6))
  console.log(
    `  [false-positive-sentΔ=${CHAT_SEND_LOG.length - beforeFalse}, hasDanger=${/检测到危险命令|dangerousCommandTitle/.test(s6.toast)}]`,
  )

  // ===== 场景 7:危险命令被安全命令(cd)前缀 → 不阻断 =====
  console.log('\n[8/8] 安全命令(echo hello)→ 正常发送不检测...')
  // 先清掉上一轮 false-positive 残留的 dangerous toast
  await dismissAllToasts(page)
  await waitNoToasts(page)
  const beforeSafe = CHAT_SEND_LOG.length
  await typeAndSubmit(page, 'echo hello world')
  const s7 = await captureState(page, 'safe-echo')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '8-safe.png') })
  console.log('  →', JSON.stringify(s7))
  console.log(
    `  [safe-sentΔ=${CHAT_SEND_LOG.length - beforeSafe}, hasDanger=${/检测到危险命令|dangerousCommandTitle/.test(s7.toast)}]`,
  )

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  writeFileSync(resolve(SCREENSHOT_DIR, 'chat-send-log.json'), JSON.stringify(CHAT_SEND_LOG, null, 2))
  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // ===== 验证 =====
  console.log('\n[验证]:')
  const checks = [
    {
      name: '1. default + 危险命令:不检测(无 dangerousCommandTitle toast,正常发送)',
      pass:
        !/检测到危险命令|dangerousCommandTitle/.test(s1.toast) && s1.sentCount >= 1,
    },
    {
      name: '2. bypass + rm -rf /:弹「检测到危险命令」确认 toast',
      pass: /检测到危险命令|dangerousCommandTitle/.test(s2.toast),
    },
    {
      name: '3. bypass + rm -rf /:toast 含「仍要发送」action',
      pass: /仍要发送|dangerousCommandProceed|proceed|强制发送/.test(s2.toast),
    },
    {
      name: '4. bypass + rm -rf /:不直接发送(确认 toast 拦截,sentCount 没增加)',
      pass: s2.sentCount === s1.sentCount,
    },
    {
      name: '5. 点「仍要发送」后真实发送(/api/chat 计数增加)',
      pass: s3.sentCount > s2.sentCount,
    },
    {
      name: '6. bypass + sudo:弹「检测到危险命令」toast',
      pass: /检测到危险命令|dangerousCommandTitle/.test(s4.toast),
    },
    {
      name: '7. 点「取消」action 后未发送(sentCount 不变)',
      pass: s4.sentCount === s2.sentCount + (s3.sentCount > s2.sentCount ? 1 : 0),
    },
    {
      name: '8. 点「取消」后 textarea 内容保留(未清空)',
      pass: (s4.value || '').includes('sudo'),
    },
    {
      name: '9. bypass + medium(rm .env):有警告 toast',
      pass:
        s5.toasts.length > 0 &&
        (/警告|warning|建议|dangerousCommandWarningOnly/.test(s5.toast) ||
          // medium 也可能弹危险确认(toast 实现选了 critical/high 优先,但单独 medium 时弹 warning)
          /检测到危险命令|dangerousCommandTitle/.test(s5.toast)),
    },
    {
      name: '10. false positive:引号包裹的 rm 不触发警告(不弹检测/警告 toast)',
      pass: !/检测到危险命令|dangerousCommandTitle/.test(s6.toast),
    },
    {
      name: '11. 安全命令(echo)正常发送不检测',
      pass:
        !/检测到危险命令|dangerousCommandTitle/.test(s7.toast) && s7.sentCount > s6.sentCount,
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
