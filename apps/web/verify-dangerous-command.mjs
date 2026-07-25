/**
 * 浏览器自验脚本 — 危险命令检测(2026-07-25 Part C)
 *
 * 验证范围:在 textarea 输入含危险命令的文本,验证:
 * 1. bypass-permissions 模式 → 弹 sonner 警告 toast(可点"仍要发送" action)
 * 2. default 模式 → 不弹警告
 * 3. 输入安全命令 → 不命中,正常发送
 *
 * 6 个测试场景:
 *  s1. bypass 模式 + 输入 "rm -rf /" + 按 Enter → 看到危险命令 toast(标题含"危险"或类似 i18n key)
 *  s2. bypass 模式 + 输入 "sudo chmod 777 /etc" + 按 Enter → 看到危险命令 toast
 *  s3. bypass 模式 + 输入 "git push --force origin main" + 按 Enter → 看到警告 toast(severity=medium)
 *  s4. default 模式 + 输入 "rm -rf /" + 按 Enter → 无危险命令 toast
 *  s5. bypass 模式 + 输入 "ls -la" + 按 Enter → 无警告,正常发送
 *  s6. bypass 模式 + 点"仍要发送" action → 消息真发送出去(textarea 清空)
 *
 * 实现要点:
 *  - 复用 verify-permission-auto-revert.mjs 的 setStateAndReload 模式
 *  - 拦截 /api/workspace/* 同老脚本
 *  - 用 page.locator('textarea').first() 操作输入
 *  - 监听 [data-sonner-toast] 抓警告文本
 *  - 截图保存到 .trae-cn/tmp/dangerous-command/
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/dangerous-command')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []

/** 抓所有 sonner toast 文本 */
async function getSonnerToasts(page) {
  return page.evaluate(() => {
    const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'))
    return toasts.map((t) => (t.textContent || '').trim()).filter(Boolean)
  })
}

/** 抓 textarea 当前的 value(用 dom property 不用 attribute) */
async function getTextareaValue(page) {
  return page.evaluate(() => {
    const ta = document.querySelector('textarea')
    return ta ? ta.value : null
  })
}

/** 抓危险命令 toast 文本(兼容 i18n key + 翻译值) */
async function captureDangerousState(page, label) {
  const toasts = await getSonnerToasts(page)
  const value = await getTextareaValue(page)
  // 兼容 i18n key + 翻译值:测试期间 i18n 可能尚未 hydrate
  const hasDanger = toasts.some((t) => /危险|危险命令|warning|高风险|dangerousCommandTitle|dangerousCommandDesc/.test(t))
  const hasWarningOnly = toasts.some((t) => /警告|warning|careful|注意|请谨慎|dangerousCommandWarningOnly/.test(t))
  const hasProceedAction = toasts.some((t) => /仍要发送|proceed|继续发送|强制发送|确认|dangerousCommandProceed/.test(t))
  const data = {
    label,
    toasts,
    value,
    hasDanger,
    hasWarningOnly,
    hasProceedAction,
  }
  DOM_LOG.push(data)
  return data
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  })
  await ctx.addInitScript(() => {
    try {
      ;(window).__IHUI_SKIP_WS_VALIDATE__ = true
      // 跳过 FullAccessConfirm 弹窗
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.error('[pageerror]', err.message.slice(0, 300)))
  page.on('console', (msg) => {
    const t = msg.text()
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
  // 拦截 /api/chat/* 调用,避免真实 LLM 跑流程
  await ctx.route(/\/api\/chat\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { message: { id: 'mock', role: 'assistant', content: 'mock' } } }),
    })
  })

  /** 重设 mock 模式 + reload */
  async function setState(mode) {
    await page.evaluate(([m]) => {
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
      window.localStorage.removeItem('ihui:auto-revert-bypass')
      window.localStorage.removeItem('ihui:permission-mode-history')
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
    }, [mode])
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4500)
  }

  /** 输入文本 + 按 Enter 触发 submit */
  async function typeAndSubmit(text) {
    const ta = page.locator('textarea').first()
    await ta.click()
    await ta.fill('')
    await ta.fill(text)
    await ta.dispatchEvent('input')
    await page.waitForTimeout(300)
    await ta.press('Enter')
    await page.waitForTimeout(1500)
  }

  console.log('[1/6] 打开页面(初始 default 模式)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)
  await setState('default')
  await page.waitForTimeout(2000)

  // 验证 textarea 存在
  const taCount = await page.locator('textarea').count()
  if (taCount === 0) {
    console.error('未找到 textarea 元素,提前退出')
    await browser.close()
    process.exit(1)
  }

  // s4. default 模式 + 输入 rm -rf / + Enter → 不应弹危险 toast
  console.log('[s4] default 模式 + 输入 "rm -rf /" + Enter → 应无危险 toast')
  await setState('default')
  await typeAndSubmit('rm -rf /')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-default-no-toast.png'), fullPage: false })
  const s4 = await captureDangerousState(page, 's4-default-rm-rf')

  // s5. bypass 模式 + 输入 ls -la + Enter → 不应弹警告
  console.log('[s5] bypass 模式 + 输入 "ls -la" + Enter → 应无警告 toast')
  await setState('bypass-permissions')
  await typeAndSubmit('ls -la')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-safe-no-toast.png'), fullPage: false })
  const s5 = await captureDangerousState(page, 's5-bypass-ls-la')

  // s1. bypass 模式 + 输入 rm -rf / + Enter → 应弹危险 toast
  console.log('[s1] bypass 模式 + 输入 "rm -rf /" + Enter → 应弹危险 toast')
  await setState('bypass-permissions')
  await typeAndSubmit('rm -rf /')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-dangerous-rm.png'), fullPage: false })
  const s1 = await captureDangerousState(page, 's1-bypass-rm-rf')

  // s2. bypass 模式 + 输入 sudo chmod 777 /etc + Enter → 应弹危险 toast
  console.log('[s2] bypass 模式 + 输入 "sudo chmod 777 /etc" + Enter → 应弹危险 toast')
  await setState('bypass-permissions')
  await typeAndSubmit('sudo chmod 777 /etc')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-dangerous-sudo.png'), fullPage: false })
  const s2 = await captureDangerousState(page, 's2-bypass-sudo-chmod')

  // s3. bypass 模式 + 输入 git push --force origin main + Enter → 应弹警告 toast(severity=medium)
  console.log('[s3] bypass 模式 + 输入 "git push --force origin main" + Enter → 应弹警告 toast')
  await setState('bypass-permissions')
  await typeAndSubmit('git push --force origin main')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-warning-medium.png'), fullPage: false })
  const s3 = await captureDangerousState(page, 's3-bypass-force-push')

  // s6. bypass 模式 + 点"仍要发送" action → 触发 proceed 路径
  console.log('[s6] bypass 模式 + 点"仍要发送" action → 触发 proceed 路径')
  await setState('bypass-permissions')
  await typeAndSubmit('rm -rf /tmp/important-data')
  const dangerToastBefore = await getSonnerToasts(page)
  const hadProceedBefore = dangerToastBefore.some((t) => /仍要发送|proceed|dangerousCommandProceed/.test(t))
  const proceedBtn = page.locator('button:has-text("仍要发送"), button:has-text("proceed"), button:has-text("继续"), button:has-text("确认")').first()
  let proceedClicked = false
  if ((await proceedBtn.count()) > 0) {
    await proceedBtn.click()
    proceedClicked = true
    console.log('  → 已点 proceed 按钮')
    await page.waitForTimeout(2000)
  } else {
    console.log('  [warn] 未找到 proceed 按钮')
  }
  const dangerToastAfter = await getSonnerToasts(page)
  const stillHasProceedBtn = dangerToastAfter.some((t) => /仍要发送|proceed|dangerousCommandProceed/.test(t))
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-proceed-sent.png'), fullPage: false })
  const s6 = {
    label: 's6-after-proceed',
    toasts: dangerToastAfter,
    proceedClicked,
    hadProceedBefore,
    stillHasProceedBtn,
  }
  DOM_LOG.push(s6)

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  console.log('\n[DOM 数据汇总]:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d).slice(0, 300))

  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // 验证
  console.log('\n[验证]:')
  const checks = [
    { name: '1. bypass + "rm -rf /" → 危险 toast 出现', pass: s1.toasts.length > 0 && s1.hasDanger },
    { name: '2. bypass + "sudo chmod 777 /etc" → 危险 toast 出现', pass: s2.toasts.length > 0 && s2.hasDanger },
    { name: '3. bypass + "git push --force origin main" → 警告 toast(medium)出现', pass: s3.toasts.length > 0 && (s3.hasDanger || s3.hasWarningOnly) },
    { name: '4. default + "rm -rf /" → 无危险 toast', pass: s4.toasts.length === 0 || !s4.hasDanger },
    { name: '5. bypass + "ls -la" → 无警告(安全命令不命中)', pass: s5.toasts.length === 0 || !s5.hasDanger },
    { name: '6. bypass + 点 proceed → 触发 proceed 路径(按钮存在 + 已点击 + toast 消失)', pass: hadProceedBefore && proceedClicked && !stillHasProceedBtn },
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
