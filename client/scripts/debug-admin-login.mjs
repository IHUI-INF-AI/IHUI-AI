import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
await page.goto('http://localhost:8888/admin', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 3000))

const info = await page.evaluate(() => {
  const el = document.querySelector('.login-text')
  if (!el) return { error: 'login-text not found' }
  const chain = []
  let cur = el
  while (cur && cur.tagName) {
    const cs = getComputedStyle(cur)
    chain.push({
      tag: cur.tagName.toLowerCase(),
      cls: String(cur.className || '').slice(0, 40),
      color: cs.color,
      bg: cs.backgroundColor
    })
    cur = cur.parentElement
  }
  return { chain }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'g:/IHUI-AI/debug-admin-login.png', fullPage: false })
await browser.close()
