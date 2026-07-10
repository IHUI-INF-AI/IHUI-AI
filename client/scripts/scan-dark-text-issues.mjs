import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'
const PAGES = ['/', '/admin', '/order-list', '/my-commission', '/agents', '/user/profile', '/model-manager', '/api-test', '/ai-world']

const results = []

async function checkPage(browser, path) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))

  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 20000 })
    await new Promise(r => setTimeout(r, 1500))

    const data = await page.evaluate(() => {
      const out = []
      // Find all visible text elements
      const all = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label, div')
      let badCount = 0
      let totalCount = 0
      const seen = new Set()
      all.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        if (rect.top > 5000) return  // skip off-screen
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return
        const text = el.innerText?.trim().slice(0, 50)
        if (!text || text.length < 2) return
        // dedup by text+color
        const key = text + '|' + cs.color + '|' + cs.backgroundColor
        if (seen.has(key)) return
        seen.add(key)
        totalCount++

        // Check if color is dark (potential invisibility)
        const colorRgb = cs.color.match(/\d+/g)?.map(Number) || []
        const bgRgb = cs.backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) || [0,0,0]
        if (colorRgb.length >= 3) {
          const lum = (colorRgb[0] + colorRgb[1] + colorRgb[2]) / 3
          const bgLum = bgRgb.length >= 3 ? (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 : 0
          // Dark text on dark background = bad
          if (lum < 80 && bgLum < 80) {
            badCount++
            if (out.length < 10) {
              out.push({
                tag: el.tagName.toLowerCase(),
                cls: String(el.className).split(/\s+/).slice(0, 2).join('.'),
                text: text.slice(0, 30),
                color: cs.color,
                bg: cs.backgroundColor.slice(0, 30)
              })
            }
          }
        }
      })
      return { path: location.pathname, totalCount, badCount, examples: out }
    })

    results.push(data)
    return data
  } catch (e) {
    return { path, error: e.message }
  } finally {
    await page.close()
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    for (const path of PAGES) {
      const r = await checkPage(browser, path)
      if (r.error) {
        console.log(`[ERROR] ${path}: ${r.error}`)
      } else {
        const status = r.badCount > 0 ? 'BAD' : 'OK'
        console.log(`[${status}] ${r.path}: ${r.badCount}/${r.totalCount} dark-text elements`)
        if (r.badCount > 0) {
          r.examples.forEach(e => console.log(`  - ${e.tag}.${e.cls} "${e.text}" color=${e.color} bg=${e.bg}`))
        }
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
