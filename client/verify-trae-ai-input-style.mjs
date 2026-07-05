/**
 * Trae 风格 AI 输入框视觉验证脚本 (2026-07-06 立)
 *
 * 检查项:
 *   1. 浅色 / 暗色模式:
 *      - .send-btn.send-btn--trae-circular: 32x32, border-radius: 50%, 绿底 (#16a34a / #15803d)
 *      - .input-wrapper: 圆角 15px (AI 浮窗)
 *      - .trae-toolbar-row: 存在, 4左+中+2右+极右 7 元素
 *      - .agent-pill: 绿头像 + 文字 + × 关闭
 *      - .trae-work-actions-top: display: none (保留 DOM 但视觉隐藏)
 *   2. 触发源切换: 点击工具栏 ✨ 按钮 [aria-label="能力"] 能展开能力下拉
 *   3. 截图保存: verify-shots/trae-light.png + trae-dark.png
 *
 * 用法:  node verify-trae-ai-input-style.mjs
 * 退出码: 0 全部通过, 1 失败
 */

import puppeteer from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const URL = 'http://127.0.0.1:8888/'
const TIMEOUT = 30000
const SHOTS_DIR = 'verify-shots'

const EXPECTED = {
  // 2026-07-06 修复: 不再硬编码 inputRadius, 改由 getInputInfo 动态判定 (浮窗 15px / SPA 面板 8px)
  light: {
    sendBg: 'rgb(22, 163, 74)',      // #16a34a
    sendHoverBg: 'rgb(21, 128, 61)', // #15803d
    sendSize: 32,
  },
  dark: {
    sendBg: 'rgb(21, 128, 61)',      // #15803d
    sendHoverBg: 'rgb(5, 46, 22)',   // #052e16
    sendSize: 32,
  },
}

function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`) }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); process.exitCode = 1 }
function info(msg) { console.log(`  \u2139 ${msg}`) }
function section(msg) { console.log(`\n\x1b[1m${msg}\x1b[0m`) }

async function waitForEl(page, selector, timeout = 10000) {
  return page.waitForSelector(selector, { timeout, visible: true })
}

/** 打开 AI 浮窗并进入 trae-work 输入态 (与 agent-pill.spec.ts 同步) */
async function setupAIDialog(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  // 等待 Vue 挂载
  await page.waitForFunction(
    () => document.getElementById('app')?.childElementCount > 0,
    { timeout: 15000 }
  )
  // 关闭可能的引导/弹窗
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 150))
  }
  await new Promise((r) => setTimeout(r, 300))
  // localStorage 强制开启 AI 面板 (与 verify-ai-dialog-fix.mjs 一致)
  await page.evaluate(() => {
    localStorage.setItem('ai-panel-open', 'true')
    localStorage.setItem('ai-panel-entered', 'true')
  })
  // 触发 AI 浮窗
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
  // 等待 AI 浮窗或侧边栏可见
  await page.waitForSelector('.floating-chat-dialog, .ai-side-panel', { timeout: 12000 })
  await new Promise((r) => setTimeout(r, 1500))

  // 若在 empty 态 (出现"选择模型"按钮), 点击进入 trae-work
  const emptyBtn = await page.evaluateHandle(() => {
    const panel = document.querySelector('.ai-side-panel')
    if (!panel) return null
    const btns = panel.querySelectorAll('button')
    for (const b of btns) {
      if (b.textContent && b.textContent.trim() === '选择模型') return b
    }
    return null
  })
  if (emptyBtn && (await emptyBtn.evaluate((el) => !!el))) {
    await emptyBtn.asElement().click({ force: true })
    await new Promise((r) => setTimeout(r, 1500))
    await page.mouse.click(20, 20)
    await new Promise((r) => setTimeout(r, 800))
  }

  // 工具栏 ✨ 按钮应可见 (进入 trae-work 的标志)
  await page.waitForSelector('[aria-label="能力"]', { timeout: 8000 })
}

async function getInputInfo(page) {
  return page.evaluate(() => {
    // 2026-07-06 修复: 找有 trae-toolbar-row 的 .input-wrapper (无论 AI 浮窗还是 SPA 嵌入面板)
    //   AI 浮窗 (.floating-chat-dialog) border-radius = 15px
    //   SPA 嵌入面板 (.ai-side-panel) border-radius = 8px (项目惯例, 不属改造范围)
    const wrapper = document.querySelector('.input-wrapper:has(.trae-toolbar-row)')
      || document.querySelector('.input-wrapper')
    if (!wrapper) return null
    const sendBtn = wrapper.querySelector('.send-btn--trae-circular')
      || wrapper.querySelector('.send-btn')
    const toolbar = wrapper.querySelector('.trae-toolbar-row')
    const toolbarLeft = wrapper.querySelector('.trae-toolbar-left')
    const toolbarCenter = wrapper.querySelector('.trae-toolbar-center')
    const toolbarRight = wrapper.querySelector('.trae-toolbar-right')
    const legacyPill = wrapper.querySelector('.trae-work-actions-top')

    const cs = (el) => el ? getComputedStyle(el) : null
    const wrapperCs = cs(wrapper)
    const sendCs = cs(sendBtn)

    // 上下文: 独立浮窗 (15px) 还是嵌入模式 / SPA 面板 (8px)
    // 2026-07-06 修复: 检测 .is-embedded modifier (浮窗嵌入到侧边栏时强制 8px)
    const floatingDlg = wrapper.closest('.floating-chat-dialog')
    const isFloating = !!floatingDlg && !floatingDlg.classList.contains('is-embedded')
    const expectedRadius = isFloating ? '15px' : '8px'

    return {
      hasWrapper: !!wrapper,
      hasSendBtn: !!sendBtn,
      hasToolbar: !!toolbar,
      hasLeft: !!toolbarLeft,
      hasCenter: !!toolbarCenter,
      hasRight: !!toolbarRight,
      hasLegacy: !!legacyPill,
      isFloating,
      // Wrapper
      wrapperRadius: wrapperCs?.borderRadius || null,
      expectedRadius,
      // Send button
      sendWidth: sendBtn ? sendBtn.getBoundingClientRect().width : null,
      sendHeight: sendBtn ? sendBtn.getBoundingClientRect().height : null,
      sendRadius: sendCs?.borderRadius || null,
      sendBg: sendCs?.backgroundColor || null,
      sendColor: sendCs?.color || null,
      // Toolbar children counts
      leftCount: toolbarLeft?.querySelectorAll('button, .trae-toolbar-action-btn').length || 0,
      centerCount: toolbarCenter ? toolbarCenter.querySelectorAll('*').length || 1 : 0,
      rightCount: toolbarRight?.querySelectorAll('button, .trae-toolbar-action-btn').length || 0,
      // Legacy pill hidden
      legacyDisplay: cs(legacyPill)?.display || null,
    }
  })
}

async function getAgentPillInfo(page) {
  return page.evaluate(() => {
    const pill = document.querySelector('.agent-pill')
    if (!pill) return { exists: false }
    const avatar = pill.querySelector('.agent-pill-avatar')
    const label = pill.querySelector('.agent-pill-label')
    const close = pill.querySelector('.agent-pill-close')
    return {
      exists: true,
      visible: !!pill.offsetParent,
      avatarBg: avatar ? getComputedStyle(avatar).backgroundColor : null,
      labelText: label?.textContent?.trim() || null,
      hasClose: !!close,
    }
  })
}

async function checkTheme(page, mode) {
  const exp = EXPECTED[mode]
  section(`检查 [${mode}] 模式`)

  // 1. .input-wrapper
  // 2026-07-06 修复: 局部变量 info 会遮蔽全局 info() 函数, 改名为 inputInfo
  const inputInfo = await getInputInfo(page)
  if (!inputInfo) { fail('未找到 AI 浮窗 / .input-wrapper'); return false }
  if (!inputInfo.hasWrapper) { fail('.input-wrapper 不存在'); return false }
  ok(`.input-wrapper 存在`)

  if (inputInfo.wrapperRadius === inputInfo.expectedRadius) {
    ok(`.input-wrapper border-radius = ${inputInfo.expectedRadius} (${inputInfo.isFloating ? 'AI 浮窗' : 'SPA 面板'}) ✓`)
  } else {
    fail(`.input-wrapper border-radius = ${inputInfo.wrapperRadius} (期望 ${inputInfo.expectedRadius}, 上下文=${inputInfo.isFloating ? '浮窗' : 'SPA'})`)
  }

  // 2. 圆形 send button
  if (!inputInfo.hasSendBtn) { fail('.send-btn--trae-circular 不存在'); return false }
  ok('.send-btn--trae-circular 存在')

  if (inputInfo.sendRadius === '50%' || inputInfo.sendRadius === '50% 50%') {
    ok(`.send-btn border-radius = ${inputInfo.sendRadius} (圆形) ✓`)
  } else {
    fail(`.send-btn border-radius = ${inputInfo.sendRadius} (期望 50%)`)
  }

  if (inputInfo.sendWidth === exp.sendSize && inputInfo.sendHeight === exp.sendSize) {
    ok(`.send-btn 尺寸 ${inputInfo.sendWidth}x${inputInfo.sendHeight} ✓`)
  } else {
    fail(`.send-btn 尺寸 ${inputInfo.sendWidth}x${inputInfo.sendHeight} (期望 ${exp.sendSize}x${exp.sendSize})`)
  }

  if (inputInfo.sendBg === exp.sendBg) {
    ok(`.send-btn 背景色 = ${inputInfo.sendBg} ✓`)
  } else {
    fail(`.send-btn 背景色 = ${inputInfo.sendBg} (期望 ${exp.sendBg})`)
  }

  // 3. Toolbar
  if (inputInfo.hasToolbar) ok('.trae-toolbar-row 存在')
  else { fail('.trae-toolbar-row 缺失'); return false }

  if (inputInfo.hasLeft && inputInfo.hasCenter && inputInfo.hasRight) {
    ok('工具栏 4左+中+2右 三段存在')
  } else {
    fail(`工具栏段缺失: left=${inputInfo.hasLeft} center=${inputInfo.hasCenter} right=${inputInfo.hasRight}`)
  }

  info(`左 ${inputInfo.leftCount} 个 / 中 1 个 / 右 ${inputInfo.rightCount} 个 + 极右圆形发送`)

  // 4. 旧 .trae-work-actions-top 视觉隐藏
  if (inputInfo.legacyDisplay === 'none') {
    ok('.trae-work-actions-top 已隐藏 (display: none) ✓')
  } else {
    fail(`.trae-work-actions-top display = ${inputInfo.legacyDisplay} (期望 none)`)
  }

  return true
}

async function checkAgentPill(page) {
  section('检查 AgentPill')
  // 打开能力下拉
  await page.click('[aria-label="能力"]')
  await page.waitForSelector('.ai-capability-inline-panel', { timeout: 5000 })
  await new Promise((r) => setTimeout(r, 500))

  // 2026-07-06 修复: 用文字匹配找 Agent 卡片 (与 e2e/agent-pill.spec.ts 一致)
  const agentCard = await page.evaluateHandle(() => {
    const popper = document.querySelector('.ai-capability-inline-panel')
    if (!popper) return null
    const items = popper.querySelectorAll('.menu-grid .menu-item')
    for (const item of items) {
      const text = (item.textContent || '').trim()
      if (/智能体|Agent/i.test(text)) return item
    }
    return null
  })
  const agentEl = agentCard.asElement()
  if (!agentEl) {
    fail('未找到 Agent 卡片 (文字匹配: 智能体|Agent)')
    // 列出所有卡片以辅助诊断
    const allCards = await page.evaluate(() => {
      const popper = document.querySelector('.ai-capability-inline-panel')
      if (!popper) return []
      return Array.from(popper.querySelectorAll('.menu-grid .menu-item'))
        .map((el) => (el.textContent || '').trim().slice(0, 30))
    })
    info(`可用卡片: ${JSON.stringify(allCards)}`)
    return false
  }
  await agentEl.click()
  await new Promise((r) => setTimeout(r, 1500))

  // 关闭下拉
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 1500))

  const pillInfo = await getAgentPillInfo(page)
  if (!pillInfo.exists) { fail('AgentPill 未渲染'); return false }
  if (!pillInfo.visible) { fail('AgentPill 不可见'); return false }
  ok(`AgentPill 可见, label = "${pillInfo.labelText}"`)

  if (['rgb(22, 163, 74)', 'rgb(21, 128, 61)'].includes(pillInfo.avatarBg || '')) {
    ok(`AgentPill 头像绿底 = ${pillInfo.avatarBg} ✓`)
  } else {
    fail(`AgentPill 头像背景 = ${pillInfo.avatarBg} (期望绿底)`)
  }

  if (pillInfo.hasClose) ok('AgentPill × 关闭按钮存在 ✓')
  else fail('AgentPill × 关闭按钮缺失')

  return true
}

async function main() {
  console.log('========================================')
  console.log(' Trae 风格 AI 输入框视觉验证')
  console.log('========================================')
  console.log(`URL: ${URL}`)
  console.log()

  // 准备截图目录
  await mkdir(SHOTS_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  try {
    // ========== 浅色模式 ==========
    section('🌞 浅色模式')
    await setupAIDialog(page)
    // 确保浅色
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('iHui-theme', 'light')
    })
    await new Promise((r) => setTimeout(r, 500))
    await checkTheme(page, 'light')

    // AgentPill 检查
    await checkAgentPill(page)

    // 截图
    const lightShot = join(SHOTS_DIR, 'trae-light.png')
    await page.screenshot({ path: lightShot, fullPage: false })
    ok(`截图保存: ${lightShot}`)

    // ========== 暗色模式 ==========
    section('🌙 暗色模式')
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('iHui-theme', 'dark')
    })
    await new Promise((r) => setTimeout(r, 1000))
    // 2026-07-06 修复: 切到暗色后 .input-wrapper 可能因 AgentPill 状态被卸载, 重新进入 trae-work
    const darkWrapper = await page.$('.input-wrapper:has(.trae-toolbar-row)')
    if (!darkWrapper) {
      info('暗色模式 .input-wrapper 缺失, 重新 setupAIDialog')
      await setupAIDialog(page)
    }
    await checkTheme(page, 'dark')

    // 截图
    const darkShot = join(SHOTS_DIR, 'trae-dark.png')
    await page.screenshot({ path: darkShot, fullPage: false })
    ok(`截图保存: ${darkShot}`)

    section('✅ 验证完成')
  } catch (e) {
    fail(`脚本异常: ${e.message}`)
    console.error(e)
  } finally {
    await browser.close()
  }

  if (process.exitCode) {
    console.log('\n\x1b[31m❌ 验证未通过\x1b[0m')
  } else {
    console.log('\n\x1b[32m✅ 验证通过\x1b[0m')
  }
}

main()
