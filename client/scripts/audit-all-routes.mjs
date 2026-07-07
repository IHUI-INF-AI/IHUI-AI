/**
 * 真正全量路由暗色模式审计 (2026-07-04)
 * 提取所有 router/modules/*.ts 的真实路由, 逐个扫描深色文字
 */
import puppeteer from 'puppeteer'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROUTER_DIR = 'g:/IHUI-AI/client/src/router/modules'
const BASE = 'http://127.0.0.1:8888'

function extractPaths() {
  const files = readdirSync(ROUTER_DIR).filter(f => f.endsWith('.ts'))
  const paths = new Set()
  for (const f of files) {
    try {
      const content = readFileSync(join(ROUTER_DIR, f), 'utf8')
      // Match `path: '/xxx'` (avoid dynamic params with :)
      const matches = content.matchAll(/path:\s*['"]([^'":*]+)['"]/g)
      for (const m of matches) {
        const p = m[1]
        if (p.includes(':') || p.includes('*') || p.includes('(')) continue
        paths.add('/' + p.replace(/^\//, ''))
      }
    } catch (e) {}
  }
  return Array.from(paths).sort()
}

function rgbToHex(rgb) {
  if (!rgb) return null
  const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return null
  return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
}

function luminance([r, g, b]) {
  const f = (c) => { c = c/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)
}
function contrast(c1, c2) {
  const l1 = luminance(c1), l2 = luminance(c2)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

async function scanRoute(browser, path) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 12000 })
    await new Promise(r => setTimeout(r, 2000))
    // SPA 内部导航 (更可靠)
    const data = await page.evaluate(() => {
      const all = document.querySelectorAll('*')
      let totalText = 0
      const badSamples = []
      for (const el of all) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        if (rect.width * rect.height > 500000) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') continue
        if (parseFloat(cs.opacity) < 0.3) continue
        if (!cs.color || cs.color === 'rgba(0, 0, 0, 0)') continue
        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0)
        if (!hasDirectText) continue
        const text = (el.textContent || '').trim()
        if (text.length < 2) continue

        // 找该元素实际渲染背景色 (向上找第一个不透明 bg, 跳过 rgba(_,_,_,0) 透明)
        let cur = el
        let bgRgb = null // null = 还没找到不透明背景
        let bgSource = 'transparent'
        while (cur && cur.tagName) {
          const bcs = getComputedStyle(cur)
          const bgStr = bcs.backgroundColor
          // 解析 rgba/rgb: 提取 4 个数字 (r, g, b, a)
          const fullMatch = bgStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/)
          if (fullMatch) {
            const a = fullMatch[4] !== undefined ? parseFloat(fullMatch[4]) : 1
            // 2026-07-04 修复: alpha < 0.5 视为透明 (继续向上找), 避免误报
            //   卡片用 --color-white-2 (rgba(255,255,255,0.02)) 等半透明白做 hover/glow 时,
            //   实际渲染是叠加在深色 page bg 上, 视觉上是深色. 旧版 alpha > 0.01 就当白底,
            //   会把 var(--el-text-color-primary) 浅色文字误判为"白字白底".
            if (a >= 0.5) {
              bgRgb = [parseInt(fullMatch[1]), parseInt(fullMatch[2]), parseInt(fullMatch[3])]
              bgSource = cur.tagName.toLowerCase() + '.' + String(cur.className || '').slice(0, 20)
              break
            }
            // alpha < 0.5, 透明, 继续向上找
          }
          // 处理十六进制 #aabbcc
          if (bgStr.startsWith('#') && bgStr.length === 7) {
            const r = parseInt(bgStr.slice(1, 3), 16)
            const g = parseInt(bgStr.slice(3, 5), 16)
            const b = parseInt(bgStr.slice(5, 7), 16)
            bgRgb = [r, g, b]
            bgSource = cur.tagName.toLowerCase() + '.' + String(cur.className || '').slice(0, 20)
            break
          }
          cur = cur.parentElement
        }
        if (!bgRgb) {
          // 找不到不透明背景, 跳过 (可能是浮层等特殊元素)
          continue
        }
        const cm = cs.color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
        if (!cm) continue
        const textRgb = [parseInt(cm[1]), parseInt(cm[2]), parseInt(cm[3])]
        totalText++

        // 计算对比度
        const l1 = textRgb[0] * 0.2126 + textRgb[1] * 0.7152 + textRgb[2] * 0.0722
        const l2 = bgRgb[0] * 0.2126 + bgRgb[1] * 0.7152 + bgRgb[2] * 0.0722
        const lumDiff = Math.abs(l1 - l2)
        // 文字与背景亮度差 < 50 → 可疑 (对比度通常 < 2.5:1)
        if (lumDiff < 50) {
          if (badSamples.length < 3) {
            badSamples.push({
              tag: el.tagName.toLowerCase(),
              cls: String(el.className || '').slice(0, 40),
              text: text.slice(0, 25),
              textColor: cs.color,
              bgColor: `rgb(${bgRgb.join(', ')}) [from ${bgSource}]`,
              lumDiff: lumDiff.toFixed(0)
            })
          }
        }
      }
      return { totalText, badCount: badSamples.length, badSamples }
    })
    return { path, ok: true, ...data }
  } catch (e) {
    return { path, ok: false, error: e.message.slice(0, 50) }
  } finally {
    await page.close()
  }
}

async function main() {
  const paths = extractPaths()
  console.log(`[扫描] 共发现 ${paths.length} 个真实路由`)
  console.log(`[路由列表]\n  ${paths.join('\n  ')}\n`)

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const results = []
  let scanned = 0, passed = 0, failed = 0, errored = 0
  try {
    for (const path of paths) {
      scanned++
      process.stdout.write(`[${scanned.toString().padStart(2)}/${paths.length}] ${path.padEnd(30)} `)
      const r = await scanRoute(browser, path)
      // 节流: 给 Vite 喘气时间
      await new Promise(r => setTimeout(r, 500))
      if (!r.ok) {
        errored++
        console.log(`ERR: ${r.error}`)
        continue
      }
      const ok = r.badCount === 0
      if (ok) passed++; else failed++
      console.log(`text=${r.totalText.toString().padStart(3)} bad=${r.badCount.toString().padStart(3)} ${ok ? '✓' : '✗'}`)
      if (!ok) {
        results.push(r)
        r.badSamples.forEach(s => {
          console.log(`     - ${s.tag}.${s.cls} "${s.text}" textColor=${s.textColor} bgColor=${s.bgColor} lumDiff=${s.lumDiff}`)
        })
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n========== 全量审计汇总 ==========`)
  console.log(`总计: ${paths.length} 路由`)
  console.log(`扫描成功: ${scanned - errored}`)
  console.log(`通过 (0 深色文字): ${passed}`)
  console.log(`失败 (有深色文字): ${failed}`)
  console.log(`错误 (无法访问): ${errored}`)

  // 2026-07-04: 同时写一份到文件 (PowerShell 重定向不稳定的兜底)
  const fs = await import('fs')
  const summaryLines = [
    `\n========== 全量审计汇总 ==========`,
    `总计: ${paths.length} 路由`,
    `扫描成功: ${scanned - errored}`,
    `通过 (0 深色文字): ${passed}`,
    `失败 (有深色文字): ${failed}`,
    `错误 (无法访问): ${errored}`,
  ]
  if (failed > 0) {
    summaryLines.push(`\n失败的路由 (含深色文字样例):`)
    results.forEach(r => {
      summaryLines.push(`  - ${r.path} (${r.badCount} 个深色文字):`)
      r.badSamples.forEach(s => {
        summaryLines.push(`      - ${s.tag}.${s.cls} "${s.text}" textColor=${s.textColor} bgColor=${s.bgColor} lumDiff=${s.lumDiff}`)
      })
    })
  }
  fs.writeFileSync('audit-summary.log', summaryLines.join('\n'), 'utf8')

  if (failed > 0) {
    console.log(`\n失败的路由:`)
    results.forEach(r => console.log(`  - ${r.path} (${r.darkCount} 个深色文字)`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
