import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'
const PAGES = [
  '/', '/admin', '/login', '/register', '/forgot-password',
  '/dashboard', '/home', '/settings', '/help', '/about',
  '/agents/square', '/agents/list', '/agents/create',
  '/orders', '/order-list', '/my-commission', '/commission',
  '/chat', '/chat/new', '/ai/chat',
  '/model-manager', '/model-list', '/api-test', '/api-docs',
  '/user/profile', '/user/settings', '/user/info',
  '/ai-world', '/open-platform', '/tools', '/toolbox',
  '/gallery', '/templates', '/marketplace', '/store',
  '/notifications', '/messages', '/wallet', '/account',
  '/admin-classic', '/admin/users', '/admin/settings', '/admin/logs',
  '/debug', '/test', '/playground'
]

const results = []

async function checkPage(browser, path) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 12000 })
    await new Promise(r => setTimeout(r, 1500))
    const data = await page.evaluate(() => {
      const out = []
      const all = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label')
      let badCount = 0
      const seen = new Set()
      all.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        if (rect.top > 8000) return
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return
        const text = el.innerText?.trim().slice(0, 50)
        if (!text || text.length < 2) return
        const key = text + '|' + cs.color + '|' + cs.backgroundColor
        if (seen.has(key)) return
        seen.add(key)
        const colorRgb = cs.color.match(/\d+/g)?.map(Number) || []
        const bgRgb = cs.backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) || []
        if (colorRgb.length >= 3) {
          const lum = (colorRgb[0] + colorRgb[1] + colorRgb[2]) / 3
          const bgLum = bgRgb.length >= 3 ? (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 : 0
          // Only flag dark text on dark background
          if (lum < 80 && bgLum < 80) {
            badCount++
            if (out.length < 3) {
              out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).split(/\s+/)[0], text: text.slice(0, 25), color: cs.color, bg: cs.backgroundColor.slice(0, 30) })
            }
          }
        }
      })
      return { badCount, examples: out }
    })
    return { path, ...data }
  } catch (e) {
    return { path, error: e.message.slice(0, 50) }
  } finally {
    await page.close()
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    for (const path of PAGES) {
      const r = await checkPage(browser, path)
      if (r.error) continue
      const status = r.badCount > 0 ? 'BAD' : 'OK'
      console.log(`[${status.padEnd(3)}] ${path.padEnd(25)} bad=${r.badCount}`)
      if (r.badCount > 0) {
        r.examples.forEach(e => console.log(`       - ${e.tag}.${e.cls} "${e.text}" color=${e.color} bg=${e.bg}`))
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
