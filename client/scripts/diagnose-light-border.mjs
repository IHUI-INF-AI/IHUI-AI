#!/usr/bin/env node
/**
 * 浅色模式 sidebar 描边色实测诊断
 * 用户反馈: #6b6b6b 浅色描边被读为"纯黑色"
 * 目标: 列出所有 .nav-item 的实际 computed border-color, 找覆盖源
 */

import puppeteer from 'puppeteer'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const VITE_URL = 'http://127.0.0.1:8888'
const OUTPUT_DIR = path.join(projectRoot, 'test-results')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

async function applyLightTheme(page) {
  await page.evaluate(() => {
    const html = document.documentElement
    html.classList.remove('dark')
    localStorage.setItem('app-theme', 'light')
  })
  await new Promise((r) => setTimeout(r, 600))
}

async function getCssVar(page, name) {
  return await page.evaluate((n) => {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  }, name)
}

async function listAllNavItems(page) {
  return await page.evaluate(() => {
    const items = document.querySelectorAll('.nav-item, .nav-new-chat, .nav-subitem, .nav-collapsed-submenu-item, .nav-group-label')
    return Array.from(items).map((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      // 关键: 用 getMatchedCSSRules 替代品 - 通过 window.getMatchedCSSRules 不存在,
      // 我们用 cascade layers 查 matched rules 太复杂, 改用 diff 法:
      // 拿 inline style + 每个 class 上层的 computed 值
      const inlineStyle = el.getAttribute('style') || ''
      return {
        text: (el.textContent || '').trim().slice(0, 30),
        tag: el.tagName,
        classes: el.className,
        borderTopColor: cs.borderTopColor,
        borderTopWidth: cs.borderTopWidth,
        borderTopStyle: cs.borderTopStyle,
        background: cs.backgroundColor,
        color: cs.color,
        inlineStyle,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0,
      }
    })
  })
}

// 用 CDP 拿到 matchedCSSRules 找出覆盖源
async function findBorderOverrideSource(page, selector) {
  const client = await page.target().createCDPSession()
  await client.send('DOM.enable')
  await client.send('CSS.enable')
  const doc = await client.send('DOM.getDocument', { depth: -1 })
  const node = await client.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector,
  })
  if (!node.nodeId) return null
  const matched = await client.send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId })
  // 找所有含 border 属性的 rule
  const borderRules = []
  for (const m of matched.matchedCSSRules || []) {
    const props = (m.rule.style.cssProperties || []).filter((p) => /border/i.test(p.name))
    if (props.length) {
      borderRules.push({
        selector: m.rule.selectorList.text,
        origin: m.rule.origin,
        props: props.map((p) => ({ name: p.name, value: p.value, important: p.important })),
      })
    }
  }
  return borderRules
}

async function main() {
  console.log('[浅色描边诊断] 启动浏览器')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })

    console.log(`[浅色描边诊断] 打开 ${VITE_URL}/`)
    await page.goto(`${VITE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 })
    await page.waitForSelector('.app-sidebar, .sidebar-nav, aside', { timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1500))
    await applyLightTheme(page)

    // 1. 读 CSS 变量
    console.log('\n=== CSS 变量实测 (html :root) ===')
    const sidebarBorder = await getCssVar(page, '--app-sidebar-border')
    const sidebarBorderDefault = await getCssVar(page, '--app-sidebar-border-default')
    const sidebarBorderHover = await getCssVar(page, '--app-sidebar-border-hover')
    const sidebarBorderActive = await getCssVar(page, '--app-sidebar-border-active')
    const appButtonBorder = await getCssVar(page, '--app-button-border')
    console.log(`  --app-sidebar-border            = '${sidebarBorder}'`)
    console.log(`  --app-sidebar-border-default    = '${sidebarBorderDefault}'`)
    console.log(`  --app-sidebar-border-hover      = '${sidebarBorderHover}'`)
    console.log(`  --app-sidebar-border-active     = '${sidebarBorderActive}'`)
    console.log(`  --app-button-border             = '${appButtonBorder}'`)

    // 2. 列出所有 nav 元素 computed border
    console.log('\n=== 浅色模式 nav 元素 computed border ===')
    const items = await listAllNavItems(page)
    for (const item of items) {
      if (!item.visible) continue
      const isNewChat = item.classes.includes('nav-new-chat')
      const isActive  = item.classes.includes('active')
      const tag = isNewChat ? '[新对话]' : isActive ? '[已激活]' : '[普通]'
      console.log(`  ${tag} text="${item.text}"`)
      console.log(`     classes: ${item.classes.slice(0, 80)}`)
      console.log(`     border:  ${item.borderTopWidth} ${item.borderTopStyle} ${item.borderTopColor}`)
      console.log(`     bg:      ${item.background}`)
      if (item.inlineStyle) console.log(`     inline:  ${item.inlineStyle}`)
    }

    // 3. 找 nav-new-chat 的覆盖源
    console.log('\n=== 覆盖源追踪 (.nav-new-chat) ===')
    const overrides = await findBorderOverrideSource(page, '.nav-new-chat')
    if (overrides) {
      for (const rule of overrides) {
        console.log(`  [${rule.origin}] ${rule.selector}`)
        for (const p of rule.props) {
          console.log(`     ${p.name}: ${p.value}${p.important ? ' !important' : ''}`)
        }
      }
    } else {
      console.log('  (无 .nav-new-chat 元素或找不到)')
    }

    // 4. 找普通 nav-item 的覆盖源
    const firstNav = items.find((i) => i.classes.includes('nav-item') && !i.classes.includes('nav-new-chat'))
    if (firstNav) {
      console.log('\n=== 覆盖源追踪 (普通 .nav-item, text="' + firstNav.text + '") ===')
      const o2 = await findBorderOverrideSource(page, '.nav-item:not(.nav-new-chat)')
      if (o2) {
        for (const rule of o2) {
          console.log(`  [${rule.origin}] ${rule.selector}`)
          for (const p of rule.props) {
            console.log(`     ${p.name}: ${p.value}${p.important ? ' !important' : ''}`)
          }
        }
      }
    }

    // 5. 关键截图
    const ssPath = path.join(OUTPUT_DIR, 'light-mode-border-diagnose.png')
    await page.screenshot({ path: ssPath, clip: { x: 0, y: 0, width: 220, height: 580 } })
    console.log(`\n[sidebar 截图] ${ssPath}`)

    const fullPath = path.join(OUTPUT_DIR, 'light-mode-border-diagnose-full.png')
    await page.screenshot({ path: fullPath, fullPage: false })
    console.log(`[全屏截图]   ${fullPath}`)

    console.log('\n[浅色描边诊断] 完成')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('[浅色描边诊断] 失败:', err)
  process.exit(1)
})
