// 直接进 /ai 或 /chat 或 /home 等可能的 AI 浮窗路径
import puppeteer from 'puppeteer'

const BASE = 'http://localhost:8888'

const paths = ['/chat', '/ai', '/home', '/', '/index', '/dashboard']

async function tryPath(page, path) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await new Promise((r) => setTimeout(r, 2500))
    const result = await page.evaluate(() => {
      return {
        url: location.href,
        title: document.title,
        triggerCount: document.querySelectorAll('.floating-chat-trigger').length,
        anyTwSelector: document.querySelectorAll('.tw-selector-pill').length,
        bodyHas: document.body.innerText.includes('aiChatInput'),
        visible: document.querySelectorAll('[class*="chat"]').length,
      }
    })
    return { path, ...result }
  } catch (e) {
    return { path, error: e.message }
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  for (const p of paths) {
    const r = await tryPath(page, p)
    console.log(JSON.stringify(r))
  }

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
