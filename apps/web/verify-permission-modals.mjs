/**
 * 浏览器自验脚本 v1 — 权限模式快捷键 modal + 详细说明 modal(2026-07-25,Part C 第四批 subagent B)
 *
 * 覆盖范围(permission-shortcuts-modal.tsx + permission-mode-info-modal.tsx + message-input.tsx):
 *  1. PermissionShortcutsModal:
 *     - 默认无 modal
 *     - 按 ? 键(Shift+/)→ 弹 modal(3 分组:模式切换 / 高风险护栏 / 撤销与审计)
 *     - 再次按 ? → 关闭(toggle)
 *     - 焦点在 textarea 内时按 ? → 不弹(用户打字不误触)
 *     - Esc / 点"知道了"按钮 → 关闭
 *  2. PermissionModeInfoModal:
 *     - 只在 bypass-permissions 模式显示 ⓘ 按钮(data-testid="permission-mode-info-button")
 *     - 点击 ⓘ → 弹 modal,4 条 bullet 说明
 *     - 其他模式(default/accept-edits)不显示 ⓘ 按钮
 *     - 点"知道了"按钮 → 关闭
 *
 * 实现要点:
 *  - 用 page.keyboard.press('?') 触发,但需要 keydown 事件中 e.key='?' — playwright
 *    默认发送 ? 会按 Shift+/,所以 message-input 的 (e.key === '?' || (e.shiftKey && e.key === '/')) 双条件可命中
 *  - 焦点需先离开 textarea(按 body 或 click body),避免 e.target === TEXTAREA 早退
 *  - data-testid 优先,语义 locator 兜底
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-modals')
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true })

const DOM_LOG = []

async function captureModalState(page, label) {
  const data = { label }
  // 找所有 dialog
  data.dialogs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => ({
      hasTitle: !!d.querySelector('h1, h2, h3, [id*="title" i]'),
      text: (d.textContent || '').slice(0, 200),
      hasFooterBtn: !!d.querySelector('button'),
      liCount: d.querySelectorAll('li').length,
    }))
  })
  data.modalCount = data.dialogs.length
  data.modalTexts = data.dialogs.map((d) => d.text)
  data.maxLiCount = data.dialogs.reduce((m, d) => Math.max(m, d.liCount || 0), 0)
  // 关键文案匹配
  const allDialogText = data.modalTexts.join(' || ')
  data.hasShortcutsTitle = /权限模式快捷键|shortcutsModalTitle/.test(allDialogText)
  data.hasShortcutsSwitchSection = /模式切换|shortcutsSectionSwitch/.test(allDialogText)
  data.hasShortcutsGuardSection = /高风险护栏|shortcutsSectionGuard/.test(allDialogText)
  data.hasShortcutsAuditSection = /撤销与审计|shortcutsSectionAudit/.test(allDialogText)
  data.hasInfoModeTitle = /完全访问权限|请求批准|替我审批|mode\.ask|mode\.auto|mode\.full/.test(
    allDialogText,
  )
  // ⓘ info 按钮可见性
  const infoBtn = page.locator('[data-testid="permission-mode-info-button"]').first()
  data.infoBtnCount = await page.locator('button[data-testid="permission-mode-info-button"]').count()
  data.infoBtnVisible =
    data.infoBtnCount > 0 ? await infoBtn.isVisible().catch(() => false) : false
  // 模态体内的 ⓘ 按钮不计入 — 只看 message-input 标题栏那一颗
  // activeMode
  data.activeMode = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('ihui-ai-panel')
      if (!raw) return 'NO_LS'
      return JSON.parse(raw).state?.activeWorkspace?.mode ?? 'null'
    } catch {
      return 'PARSE_ERR'
    }
  })
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
      // 静默首次启用高风险确认弹窗(避免 modal 触发被它截断)
      window.localStorage.setItem('ihui:full-access-acknowledged', '1')
      window.localStorage.setItem('ihui:full-access-suppressed', '1')
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

  // 拦截工作区权限接口
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

  console.log('[1/9] 打开首页 (default)...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('未找到权限模式按钮')
    await browser.close()
    process.exit(1)
  }
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-default-loaded.png') })

  // ===== 场景 1:默认无 modal =====
  console.log('\n[2/9] 验证默认无 modal 出现...')
  const s1 = await captureModalState(page, 'initial-no-modal')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-no-modal.png') })
  console.log('  →', JSON.stringify(s1))

  // ===== 场景 2:按 ? 键(焦点在 body)→ 弹 shortcuts modal =====
  console.log('\n[3/9] 按 ? 键(焦点在 body)→ 弹 shortcuts modal...')
  // 让焦点离开 textarea
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    document.body.focus?.()
  })
  await page.waitForTimeout(300)
  // playwright 的 page.keyboard.press('?') 实际发送的是 Shift+/,message-input 监听 (e.key === '?' || (e.shiftKey && e.key === '/')) 双条件,会命中
  await page.keyboard.press('?')
  await page.waitForTimeout(1200)
  const s2 = await captureModalState(page, 'after-question-mark')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-shortcuts-opened.png') })
  console.log('  →', JSON.stringify(s2))

  // ===== 场景 3:modal 含 3 个分组(模式切换 / 高风险护栏 / 撤销与审计) =====
  console.log('\n[4/9] 验证 modal 含 3 个分组...')
  const s3 = s2 // 直接复用 s2 状态
  console.log('  →', JSON.stringify(s3))

  // ===== 场景 4:再次按 ? → 关闭 =====
  console.log('\n[5/9] 再次按 ? 键 → 关闭 modal(toggle)...')
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.waitForTimeout(300)
  await page.keyboard.press('?')
  await page.waitForTimeout(1000)
  const s4 = await captureModalState(page, 'after-question-mark-toggle')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-shortcuts-closed.png') })
  console.log('  →', JSON.stringify(s4))

  // ===== 场景 5:焦点在 textarea 内时按 ? → 不弹 =====
  console.log('\n[6/9] 焦点在 textarea 内按 ? → 不弹(用户打字不误触)...')
  const ta = page.locator('textarea').first()
  await ta.click()
  await page.waitForTimeout(200)
  await page.keyboard.press('?')
  await page.waitForTimeout(800)
  // 期望 textarea 收到字符 '?',而不是弹 modal
  const taValue = await ta.inputValue()
  const s5 = await captureModalState(page, 'textarea-question-mark')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-textarea-no-modal.png') })
  console.log('  →', JSON.stringify({ ...s5, taValue }))

  // ===== 场景 6:切到 bypass → ⓘ 按钮出现 =====
  console.log('\n[7/9] 切到 bypass → ⓘ info 按钮出现...')
  await ta.fill('') // 清掉 ? 字符
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await setMode('bypass-permissions')
  await page.waitForTimeout(800)
  const s6 = await captureModalState(page, 'bypass-info-btn-visible')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-bypass-info-btn.png') })
  console.log('  →', JSON.stringify(s6))

  // ===== 场景 7:点 ⓘ → 弹 PermissionModeInfoModal =====
  console.log('\n[8/9] 点 ⓘ 按钮 → 弹 PermissionModeInfoModal(4 bullet)...')
  const infoBtn = page.locator('[data-testid="permission-mode-info-button"]').first()
  if ((await infoBtn.count()) > 0) {
    await infoBtn.click()
    await page.waitForTimeout(1200)
  }
  const s7 = await captureModalState(page, 'after-info-click')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-info-modal-opened.png') })
  console.log('  →', JSON.stringify(s7))

  // ===== 场景 8:点"知道了"→ 关闭 =====
  console.log('\n[9/9] 点"知道了"按钮 → 关闭 info modal...')
  const ackBtn = page
    .locator('[role="dialog"] button', { hasText: /知道了|modeInfoAcknowledge/ })
    .last()
  if ((await ackBtn.count()) > 0) {
    await ackBtn.click()
    await page.waitForTimeout(1000)
  }
  const s8 = await captureModalState(page, 'after-acknowledge')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '8-info-modal-closed.png') })
  console.log('  →', JSON.stringify(s8))

  // ===== 场景 9:切回 default → ⓘ 按钮消失 =====
  console.log('\n[9/9+] 切回 default → ⓘ info 按钮消失...')
  await setMode('default')
  await page.waitForTimeout(800)
  const s9 = await captureModalState(page, 'default-no-info-btn')
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '9-default-no-info.png') })
  console.log('  →', JSON.stringify(s9))

  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  await browser.close()
  console.log(`\n[完成] 截图已保存到: ${SCREENSHOT_DIR}`)

  // ===== 验证 =====
  console.log('\n[验证]:')
  // baseline:页面 baseline 含 0 个 dialog(若有 cookie 弹窗等会显示 baseline > 0,用 s1 作为参考)
  const baselineDialogs = s1.modalCount
  const checks = [
    {
      name: '1. 页面加载时 shortcuts modal 不存在(无 shortcutsModalTitle dialog)',
      pass: !s1.modalTexts.some((t) => /权限模式快捷键|shortcutsModalTitle/.test(t)),
    },
    {
      name: '2. 按 ? 后弹 shortcuts modal(标题含「权限模式快捷键」)',
      pass: s2.hasShortcutsTitle,
    },
    {
      name: '3. shortcuts modal 含 3 分组(模式切换/高风险护栏/撤销与审计)',
      pass:
        s2.hasShortcutsSwitchSection && s2.hasShortcutsGuardSection && s2.hasShortcutsAuditSection,
    },
    {
      name: '4. 再次按 ? → 关闭 modal(dialog 数量回到 baseline)',
      pass: s4.modalCount <= baselineDialogs,
    },
    {
      name: '5. 焦点在 textarea 内按 ? → 不弹 modal(字符 ? 进入 textarea)',
      pass:
        s5.modalCount <= baselineDialogs && taValue.includes('?'),
    },
    {
      name: '6. bypass 模式 ⓘ info 按钮可见',
      pass: s6.infoBtnVisible,
    },
    {
      name: '7. 点 ⓘ → 弹 PermissionModeInfoModal(dialog 文本含模式名)',
      pass:
        s7.modalCount > baselineDialogs &&
        s7.modalTexts.some((t) => /完全访问权限|请求批准|替我审批/.test(t)),
    },
    {
      name: '8. info modal 含 4 条 bullet(li 数 >= 4)',
      pass: s7.maxLiCount >= 4,
    },
    {
      name: '9. 点"知道了"→ 关闭 info modal',
      pass: s8.modalCount <= baselineDialogs,
    },
    {
      name: '10. 切回 default → ⓘ info 按钮消失',
      pass: s9.infoBtnCount === 0,
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
