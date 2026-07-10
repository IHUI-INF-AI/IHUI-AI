import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.evaluateOnNewDocument(() => localStorage.setItem('darkMode', 'dark'))
    console.log('Navigating to /ai-world ...')
    await page.goto(BASE + '/ai-world', { waitUntil: 'networkidle0', timeout: 60000 })
    await new Promise(r => setTimeout(r, 3000))

    const data = await page.evaluate(() => {
      const out = []
      const all = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label')
      let badCount = 0
      const seen = new Set()
      all.forEach(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        if (rect.top > 12000) return
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return
        const text = el.innerText?.trim().slice(0, 50)
        if (!text || text.length < 2) return
        const key = text + '|' + cs.color + '|' + cs.backgroundColor
        if (seen.has(key)) return
        seen.add(key)
        const colorRgb = cs.color.match(/\d+/g)?.map(Number) || []
        const bgRgb = cs.backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number) || [0,0,0]
        if (colorRgb.length >= 3) {
          const lum = (colorRgb[0] + colorRgb[1] + colorRgb[2]) / 3
          const bgLum = bgRgb.length >= 3 ? (bgRgb[0] + bgRgb[1] + bgRgb[2]) / 3 : 0
          if (lum < 80 && bgLum < 80) {
            badCount++
            if (out.length < 10) {
              out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).split(/\s+/)[0], text: text.slice(0, 30), color: cs.color, bg: cs.backgroundColor.slice(0, 30) })
            }
          }
        }
      })
      return { totalSeen: seen.size, badCount, examples: out }
    })

    console.log(`扫描结果: 总元素=${data.totalSeen}, 暗色文字=${data.badCount}`)
    if (data.badCount > 0) {
      data.examples.forEach(e => console.log(`  - ${e.tag}.${e.cls} "${e.text}" color=${e.color} bg=${e.bg}`))
    }

    await page.screenshot({ path: 'g:/IHUI-AI/dark-mode-ai-world.png', fullPage: false })
    console.log('截图已保存: g:/IHUI-AI/dark-mode-ai-world.png')

  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
