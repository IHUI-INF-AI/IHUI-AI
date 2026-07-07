import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('darkMode', 'dark')
})

await page.goto(BASE + '/ai-community', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 2500))

const opened = await page.evaluate(() => {
  const btn = document.querySelector('.login-button')
  if (btn) { btn.click(); return true }
  return false
})
await new Promise(r => setTimeout(r, 2000))

const result = await page.evaluate(() => {
  const btn = document.querySelector('.submit-btn')
  if (!btn) return null
  return {
    outerHTML: btn.outerHTML,
    children: Array.from(btn.children).map(c => ({
      tag: c.tagName.toLowerCase(),
      cls: String(c.className || '').slice(0, 60),
      color: getComputedStyle(c).color,
      bg: getComputedStyle(c).backgroundColor,
      children: Array.from(c.children).map(gc => ({
        tag: gc.tagName.toLowerCase(),
        cls: String(gc.className || '').slice(0, 60),
        color: getComputedStyle(gc).color
      }))
    }))
  }
})

console.log(JSON.stringify(result, null, 2))

await browser.close()
