import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
// Try multiple admin URLs
for (const path of ['/', '/admin']) {
  await page.goto('http://localhost:8888' + path, { waitUntil: 'networkidle0' }).catch(() => {})
  await new Promise(r => setTimeout(r, 2000))
  const info = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('[class*="login"], [class*="user-menu"]').forEach(el => {
      const cs = getComputedStyle(el)
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 60),
        color: cs.color,
        bg: cs.backgroundColor,
        text: (el.textContent || '').trim().slice(0, 20)
      })
    })
    return { path: location.pathname, out }
  })
  console.log('Path:', info.path)
  console.log(JSON.stringify(info.out, null, 2))
  await page.screenshot({ path: `g:/IHUI-AI/debug-${path.replace(/\//g, '_') || 'home'}.png` })
}
await browser.close()
