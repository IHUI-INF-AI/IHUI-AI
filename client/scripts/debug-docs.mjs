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

await page.goto(BASE + '/docs', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 2500))

const result = await page.evaluate(() => {
  // 查找 doc-title 元素
  const titles = document.querySelectorAll('.doc-title, .file-type-icon')
  const out = []
  for (const t of titles) {
    const rect = t.getBoundingClientRect()
    if (rect.width === 0) continue
    const cs = getComputedStyle(t)
    let parent = t.parentElement
    const ancestors = []
    for (let i = 0; i < 5 && parent; i++) {
      const pcs = getComputedStyle(parent)
      ancestors.push({
        tag: parent.tagName.toLowerCase(),
        cls: String(parent.className || '').slice(0, 60),
        bg: pcs.backgroundColor,
        color: pcs.color
      })
      parent = parent.parentElement
    }
    out.push({
      tag: t.tagName.toLowerCase(),
      cls: String(t.className || '').slice(0, 60),
      text: t.textContent?.trim().slice(0, 30),
      color: cs.color,
      bg: cs.backgroundColor,
      ancestors
    })
  }
  return out.slice(0, 10)
})

console.log(JSON.stringify(result, null, 2))

await page.screenshot({ path: 'g:/IHUI-AI/debug-docs.png', fullPage: false })

await browser.close()
