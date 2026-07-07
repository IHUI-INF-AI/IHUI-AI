import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('darkMode', 'dark')
  localStorage.setItem('app-theme', 'dark')
  localStorage.setItem('theme', 'dark')
  localStorage.setItem('vueuse-color-scheme', 'dark')
})
await page.goto('http://127.0.0.1:8888/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
await new Promise(r => setTimeout(r, 3000))

const data = await page.evaluate(() => {
  const html = document.documentElement.className
  const body = document.body.className
  // 找 "立即登录" 按钮
  const all = document.querySelectorAll('*')
  const candidates = []
  for (const el of all) {
    const text = (el.textContent || '').trim()
    if (text === '立即登录' || text.includes('立即登录')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      candidates.push({
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 50),
        text,
        color: cs.color,
        bg: cs.backgroundColor,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      })
    }
  }
  return { html, body, candidates }
})
console.log(JSON.stringify(data, null, 2))
await browser.close()
