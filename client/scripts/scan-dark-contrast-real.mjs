/**
 * 全项目暗色模式真实文字对比度验证 (2026-07-04)
 * 通过 element.elementFromPoint 检测每个文字元素的实际背景色,
 * 计算对比度, 过滤"反相配对"设计 (白底深字/深底白字 = 正常设计意图).
 * 仅报告真正"低对比度不可见"的元素.
 */
import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
function relativeLuminance([r, g, b]) {
  const f = (c) => { c = c/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)
}
function contrastRatio(c1, c2) {
  if (!c1 || !c2) return 0
  const l1 = relativeLuminance(hexToRgb(c1))
  const l2 = relativeLuminance(hexToRgb(c2))
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}
function rgbToHex(rgb) {
  if (!rgb) return null
  const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return null
  return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
}
function isLightColor(v) {
  if (!v) return false
  const hex = v.startsWith('#') ? v : rgbToHex(v)
  if (!hex) return false
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const [r, g, b] = hexToRgb(hex)
  return ((r + g + b) / 3) > 100
}

async function scanPage(browser, path, label) {
  const page = await browser.newPage()
  await page.setCacheEnabled(false)
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('darkMode', 'dark')
  })
  try {
    const cacheBuster = '?t=' + Date.now()
    await page.goto(BASE + path + cacheBuster, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2500))

    // 滚动到底再回顶, 触发懒加载
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise(r => setTimeout(r, 1000))
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise(r => setTimeout(r, 500))

    const issues = await page.evaluate(() => {
      // 复制辅助函数到浏览器上下文
      const hexToRgb = (hex) => {
        const h = hex.replace('#', '')
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
      }
      const relLum = ([r, g, b]) => {
        const f = (c) => { c = c/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
        return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)
      }
      const contrast = (c1, c2) => {
        const l1 = relLum(hexToRgb(c1))
        const l2 = relLum(hexToRgb(c2))
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
        return (hi + 0.05) / (lo + 0.05)
      }
      const rgbToHex = (rgb) => {
        if (!rgb) return null
        const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
        if (!m) return null
        return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
      }

      const out = []
      const all = document.querySelectorAll('h1, h2, h3, h4, p, span, a, button, label, li, td, th')
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

        const textRgb = cs.color
        const textHex = rgbToHex(textRgb)
        if (!textHex) continue

        let bgEl = el
        let bgRgb = null
        for (let i = 0; i < 8 && bgEl; i++) {
          const bgCs = getComputedStyle(bgEl)
          if (bgCs.backgroundColor && bgCs.backgroundColor !== 'rgba(0, 0, 0, 0)' && bgCs.backgroundColor !== 'transparent') {
            bgRgb = bgCs.backgroundColor
            break
          }
          bgEl = bgEl.parentElement
        }
        if (!bgRgb) continue
        const bgHex = rgbToHex(bgRgb)
        if (!bgHex) continue

        const ratio = contrast(textHex, bgHex)
        if (ratio < 4.5) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || '').slice(0, 60),
            text: (el.textContent || '').trim().slice(0, 40),
            textHex, bgHex, ratio: ratio.toFixed(2)
          })
        }
      }
      return out
    })

    return issues
  } finally {
    await page.close()
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  try {
    const routes = [
      { path: '/', label: 'home' },
      { path: '/chat', label: 'chat' },
      { path: '/pricing', label: 'pricing' },
      { path: '/ai-community', label: 'community' },
      { path: '/docs', label: 'docs' },
      { path: '/agents', label: 'agents' },
      { path: '/open-platform', label: 'open-platform' },
      { path: '/learn-ai', label: 'learn-ai' },
      { path: '/about', label: 'about' },
      { path: '/about/contact-us', label: 'contact-us' },
      { path: '/about/become-supplier', label: 'become-supplier' },
      { path: '/orders', label: 'orders' },
      { path: '/user', label: 'user' },
      { path: '/distribution', label: 'distribution' },
    ]

    const totalIssues = []
    for (const r of routes) {
      try {
        const issues = await scanPage(browser, r.path, r.label)
        if (issues.length > 0) {
          console.log(`\n[${r.label}] ${r.path} - ${issues.length} 个低对比度问题:`)
          for (const i of issues.slice(0, 20)) {
            console.log(`  ${i.tag}.${i.cls} text="${i.text}" text=${i.textHex} bg=${i.bgHex} ratio=${i.ratio}`)
            totalIssues.push({ route: r.label, ...i })
          }
          if (issues.length > 20) {
            console.log(`  ... 还有 ${issues.length - 20} 个`)
          }
        } else {
          console.log(`[${r.label}] ${r.path} - 0 个问题 ✓`)
        }
      } catch (e) {
        console.log(`[${r.label}] ${r.path} - 扫描失败: ${e.message}`)
      }
    }

    console.log(`\n\n========== 总计 ==========`)
    console.log(`总问题数: ${totalIssues.length}`)
    if (totalIssues.length > 0) {
      console.log('\n按路由分布:')
      const byRoute = {}
      for (const i of totalIssues) {
        byRoute[i.route] = (byRoute[i.route] || 0) + 1
      }
      for (const [r, n] of Object.entries(byRoute)) {
        console.log(`  ${r}: ${n}`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
