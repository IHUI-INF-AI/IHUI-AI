import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
await page.goto('http://localhost:8888/admin', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 2000))

const info = await page.evaluate(() => {
  const el = document.querySelector('.login-text')
  if (!el) return { error: 'not found' }
  // walk up to find actual rendered background
  let cur = el
  const chain = []
  while (cur && cur.tagName) {
    const cs = getComputedStyle(cur)
    chain.push({
      tag: cur.tagName.toLowerCase(),
      cls: String(cur.className || '').slice(0, 30),
      color: cs.color,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage.slice(0, 50)
    })
    cur = cur.parentElement
  }
  return { chain }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'g:/IHUI-AI/debug-login-button.png' })
await browser.close()
