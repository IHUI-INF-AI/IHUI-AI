/**
 * 浏览器自验脚本 — PermissionModePopover 4 状态验证(2026-07-25 第二轮深化)
 *
 * 验证项:
 * 1. 默认态:触发器按钮显示当前模式短名
 * 2. 触发态:点击触发器,弹层打开,显示 3 个模式卡片
 * 3. 键盘聚焦态:键盘 ↑/↓ 切换焦点
 * 4. Shift+Tab 循环切模式(本次深化):在 textarea 中按 Shift+Tab 切到下一个模式
 * 5. 高风险态:切到 bypass-permissions,输入框边框琥珀色 + 顶部警告横幅
 * 6. dark mode:切到 dark mode 后再截图
 *
 * 截图保存到 .trae-cn/tmp/permission-popover-v2/
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_URL = 'http://127.0.0.1:8801'
const SCREENSHOT_DIR = resolve(process.cwd(), '.trae-cn/tmp/permission-popover-v2')

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const DOM_LOG = []

async function captureDom(page, label) {
  const trigger = await page.locator('button[aria-label="权限模式"]').first()
  const has = (await trigger.count()) > 0
  const data = { label, trigger: has }
  if (has) {
    data.text = (await trigger.textContent())?.trim()
    const cls = await trigger.getAttribute('class')
    data.class = cls?.includes('amber') ? 'amber' : cls?.includes('emerald') ? 'emerald' : 'default'
  }
  // 警告横幅
  const banner = page.locator('[role="status"][aria-live="polite"]').first()
  data.banner = (await banner.count()) > 0 ? (await banner.textContent())?.trim() : null
  // 输入框
  const textarea = page.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    const taCls = await textarea.getAttribute('class')
    data.textareaHasAmber = taCls?.includes('amber') ?? false
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
  const page = await ctx.newPage()

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text())
  })

  console.log('[1/8] 打开首页...')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  // 找触发器
  const trigger = page.locator('button[aria-label="权限模式"]').first()
  if ((await trigger.count()) === 0) {
    console.error('❌ 未找到权限模式按钮(aria-label="权限模式"),请确认 web 服务在跑且已构建最新代码')
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '0-no-trigger.png'), fullPage: false })
    await browser.close()
    process.exit(1)
  }

  // 1. 默认态
  console.log('[2/8] 截图默认态(默认 mode = default)...')
  await trigger.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '1-default.png'), fullPage: false })
  await captureDom(page, 'default')

  // 2. 弹层打开
  console.log('[3/8] 点击触发器,截图弹层打开态...')
  await trigger.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '2-popover-open.png'), fullPage: false })
  await captureDom(page, 'popover-open')

  // 3. 键盘聚焦态
  console.log('[4/8] 按 ↓ 切换焦点,截图键盘聚焦态...')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '3-keyboard-focus.png'), fullPage: false })
  await captureDom(page, 'keyboard-focus')

  // 4. 弹层打开后,按数字键 3 切到完全访问
  console.log('[5/8] 弹层内按数字键 3 切到完全访问(bypass-permissions)...')
  await page.keyboard.press('3')
  await page.waitForTimeout(1500) // 等 toast
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '4-bypass-via-popover.png'), fullPage: false })
  await captureDom(page, 'bypass-via-popover')

  // 5. 现在 textarea 中按 Shift+Tab 应该循环回 default
  console.log('[6/8] 关闭弹层,在 textarea 中按 Shift+Tab 循环切回 default...')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const textarea = page.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    await textarea.click()
    await page.waitForTimeout(200)
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(1500) // 等切模式 + toast
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '5-shift-tab-cycle.png'), fullPage: false })
    await captureDom(page, 'shift-tab-cycle')
  } else {
    console.log('    ⚠️ 未找到 textarea,跳过 Shift+Tab 测试')
  }

  // 6. 再按一次 Shift+Tab 切到 accept-edits
  console.log('[7/8] 再按 Shift+Tab 切到 accept-edits...')
  if ((await textarea.count()) > 0) {
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, '6-accept-edits.png'), fullPage: false })
    await captureDom(page, 'accept-edits')
  }

  // 7. dark mode
  console.log('[8/8] 切 dark mode,截图 accept-edits + dark...')
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, '7-dark-accept-edits.png'), fullPage: false })
  await captureDom(page, 'dark-accept-edits')

  // 写 DOM log
  writeFileSync(resolve(SCREENSHOT_DIR, 'dom-log.json'), JSON.stringify(DOM_LOG, null, 2))
  console.log('\n📋 DOM 数据:')
  for (const d of DOM_LOG) console.log('  ', JSON.stringify(d))

  await browser.close()
  console.log(`\n✅ 截图已保存到: ${SCREENSHOT_DIR}`)
}

main().catch((err) => {
  console.error('❌ 自验失败:', err.message)
  process.exit(1)
})
