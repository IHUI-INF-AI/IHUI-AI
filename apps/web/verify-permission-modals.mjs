/**
 * 浏览器自验脚本 — 2 个 modal(2026-07-25 Part C)
 *
 * 验证范围:? 唤起 PermissionShortcutsModal + 标题栏 ⓘ 唤起 PermissionModeInfoModal。
 *
 * 6 个测试场景:
 *  s1. 页面加载时 shortcuts modal 不存在(aria-hidden 或 count=0)
 *  s2. 按 ? 键 → shortcuts modal 出现(role="dialog")
 *  s3. 按 Esc 键 → shortcuts modal 关闭
 *  s4. 切到 bypass 模式 → 标题栏出现 ⓘ Info 按钮
 *  s5. 点 ⓘ 按钮 → PermissionModeInfoModal 出现,内容含"完全访问"模式名
 *  s6. 切到 default 模式 → 标题栏 ⓘ 按钮消失(只有 bypass 才显示)
 *
 * 实现要点:
 *  - 用 page.keyboard.press('Shift+/') 模拟 ? 键(因为 ? = Shift+/)
 *  - 先确保焦点不在 textarea 上(用 page.locator('body').click())
 *  - ⓘ 按钮 selector: button[aria-label="查看模式说明"]
 *  - modal 关闭用 page.keyboard.press('Escape')
 *  - 截图保存到 .trae-cn/tmp/permission-modals/
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-modals')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []

const MOCK_PERSIST = (mode = 'default') =>
  JSON.stringify({
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

async function captureModalState(page, label) {
  const data = { label }
  data.modalCount = await page.locator('[role="dialog"]').count()
  const dialogs = page.locator('[role="dialog"]')
  const texts = []
  for (let i = 0; i < data.modalCount; i++) {
    const t = (await dialogs.nth(i).textContent())?.trim()
    if (t) texts.push(t.slice(0, 300))
  }
  data.modalText = texts.join(' || ')
  data.modalTexts = texts
  // 抓所有 dialog 的 aria-label
  const labels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => d.getAttribute('aria-label') || '')
  })
  data.modalAriaLabels = labels
  // ⓘ 按钮数量(data-testid 由 message-input 渲染 Info 按钮时设置)
  data.infoBtnCount = await page.locator('button[data-testid="permission-mode-info-button"], button[aria-label*="查看模式说明"], button[aria-label*="info"]').count()
  // shortcuts 入口
  data.shortcutsBtnCount = await page.locator('button[aria-label*="快捷键"], button[aria-label*="shortcuts"]').count()
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
    if (t.includes('IHUI_SHORTCUTS') || t.includes('IHUI_MODE_INFO')) {
      console.log('  [hook]', t)
    }
  })

  // 拦截 /api/workspace/*
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

  /** 重设 mock 模式 + reload */
  async function setState(mode) {
    await page.evaluate((m) => {
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
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
    }, mode)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
  }

  console.log('[1/6] 打开页面(default 模式)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  await setState('default')

  // s1. 页面加载时 shortcuts modal 不存在
  console.log('[s1] 页面加载时 shortcuts modal 不存在')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-not-open.png'), fullPage: false })
  const s1 = await captureModalState(page, 's1-initial-no-modal')
  console.log('  →', JSON.stringify(s1).slice(0, 500))

  // s2. 按 ? 键 → shortcuts modal 出现
  console.log('[s2] 按 ? 键 → shortcuts modal 出现')
  // 先确保焦点不在 textarea/input 上(避免 textarea 吞掉键盘事件)
  // 用 body 顶部 + 等焦点稳定
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.waitForTimeout(300)
  // 显式 blur 任何 focus 元素
  await page.evaluate(() => {
    const el = document.activeElement
    if (el && el !== document.body && el.blur) el.blur()
    document.body.focus?.()
  })
  await page.waitForTimeout(200)
  // 派发 ? 键(直接 dispatch 到 document,绕过任何焦点元素)
  await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: '?',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-shortcuts-open.png'), fullPage: false })
  const s2 = await captureModalState(page, 's2-shortcuts-open')
  console.log('  →', JSON.stringify(s2).slice(0, 500))

  // s3. 按 Esc 键 → shortcuts modal 关闭
  console.log('[s3] 按 Esc 键 → shortcuts modal 关闭')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-shortcuts-closed.png'), fullPage: false })
  const s3 = await captureModalState(page, 's3-shortcuts-closed')
  console.log('  →', JSON.stringify(s3).slice(0, 500))

  // s4. 切到 bypass 模式 → 标题栏出现 ⓘ Info 按钮
  console.log('[s4] 切到 bypass 模式 → 标题栏出现 ⓘ Info 按钮')
  await setState('bypass-permissions')
  await page.waitForTimeout(500)
  // 标题栏 ⓘ 按钮(用 data-testid 精确选择)
  const infoBtn = page.locator('button[data-testid="permission-mode-info-button"]').first()
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-info-button-shown.png'), fullPage: false })
  const s4 = await captureModalState(page, 's4-bypass-info-btn')
  console.log('  → infoBtnCount:', s4.infoBtnCount)
  console.log('  →', JSON.stringify(s4).slice(0, 500))

  // s5. 点 ⓘ 按钮 → PermissionModeInfoModal 出现,内容含"完全访问"模式名
  console.log('[s5] 点 ⓘ 按钮 → PermissionModeInfoModal 出现,内容含"完全访问"')
  if ((await infoBtn.count()) > 0) {
    await infoBtn.click()
    await page.waitForTimeout(1000)
  } else {
    console.log('  [warn] 未找到 ⓘ 按钮')
  }
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-info-open.png'), fullPage: false })
  const s5 = await captureModalState(page, 's5-info-modal-open')
  console.log('  → modalCount:', s5.modalCount, ', 含完全访问:', /完全访问/.test(s5.modalText))
  console.log('  →', JSON.stringify(s5).slice(0, 500))
  // 关掉 info modal
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // s6. 切到 default 模式 → 标题栏 ⓘ 按钮消失
  console.log('[s6] 切到 default 模式 → 标题栏 ⓘ 按钮消失')
  await setState('default')
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-info-button-hidden.png'), fullPage: false })
  const s6 = await captureModalState(page, 's6-default-no-info-btn')
  console.log('  → infoBtnCount:', s6.infoBtnCount)
  console.log('  →', JSON.stringify(s6).slice(0, 500))

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  console.log('\n[DOM 数据汇总]:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d).slice(0, 300))

  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // 验证
  console.log('\n[验证]:')
  // 基础 baseline 数量:页面加载时 Sidebar 自身可能含 1 个 role=dialog(导航/搜索),所以用 delta 判断
  const baselineDialogs = s1.modalCount
  const checks = [
    {
      name: '1. 页面加载时 shortcuts modal 不存在(无 shortcutsModalTitle dialog)',
      pass: !s1.modalTexts.some((t) => /权限模式快捷键|shortcutsModalTitle/.test(t)),
    },
    {
      name: '2. 按 ? 键 → shortcuts modal 出现(多 1 个含"权限模式快捷键" dialog)',
      pass: s2.modalCount > baselineDialogs && s2.modalTexts.some((t) => /权限模式快捷键|shortcutsModalTitle/.test(t)),
    },
    {
      name: '3. 按 Esc 键 → shortcuts modal 关闭(回到 baseline 或无 shortcutsModalTitle dialog)',
      pass: s3.modalCount === baselineDialogs || !s3.modalTexts.some((t) => /权限模式快捷键|shortcutsModalTitle/.test(t)),
    },
    {
      name: '4. 切到 bypass 模式 → 标题栏出现 ⓘ Info 按钮',
      pass: s4.infoBtnCount === 1,
    },
    {
      name: '5. 点 ⓘ 按钮 → PermissionModeInfoModal 出现,内容含"完全访问"',
      pass: s5.modalCount > baselineDialogs && s5.modalTexts.some((t) => /完全访问/.test(t)),
    },
    {
      name: '6. 切到 default 模式 → 标题栏 ⓘ 按钮消失',
      pass: s6.infoBtnCount === 0,
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
