import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
await page.goto('http://localhost:8888/admin', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 3000))

const info = await page.evaluate(() => {
  const allLogin = document.querySelectorAll('.login-text, .login-button, .login-icon')
  const out = []
  for (const el of allLogin) {
    let cur = el
    const chain = []
    while (cur && cur.tagName) {
      const cs = getComputedStyle(cur)
      chain.push({
        tag: cur.tagName.toLowerCase(),
        cls: String(cur.className || '').slice(0, 40),
        color: cs.color,
        bg: cs.backgroundColor,
        minPri: cs.getPropertyValue('--el-text-color-primary').trim()
      })
      cur = cur.parentElement
    }
    out.push({
      el: el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 30),
      chain: chain.slice(0, 6)
    })
  }
  return out
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'g:/IHUI-AI/debug-admin-login2.png', fullPage: false })
const full = await page.evaluate(() => document.body.outerHTML.slice(0, 2000))
console.log('HTML head:', full)
await browser.close()
