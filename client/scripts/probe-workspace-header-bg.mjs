#!/usr/bin/env node
/**
 * 探测 .workspace-header 的实际背景色 (排查用户反馈"header 不需要背景色")
 */
import puppeteer from 'puppeteer'

const VITE_URL = 'http://127.0.0.1:8888'

async function probe(page) {
  return await page.evaluate(() => {
    const wsh = document.querySelector('.workspace-header')
    const ws = document.querySelector('.workspace')
    if (!wsh || !ws) return { error: 'missing elements' }
    const wshCs = getComputedStyle(wsh)
    const wsCs = getComputedStyle(ws)
    return {
      header: {
        backgroundColor: wshCs.backgroundColor,
        backgroundImage: wshCs.backgroundImage,
        background: wshCs.background,
      },
      workspace: {
        backgroundColor: wsCs.backgroundColor,
      },
    }
  })
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  for (const [label, isDark] of [['浅色', false], ['暗色', true]]) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(VITE_URL, { waitUntil: 'networkidle0', timeout: 60000 })
    await page.evaluate((d) => {
      const html = document.documentElement
      if (d) html.classList.add('dark'); else html.classList.remove('dark')
      localStorage.setItem('app-theme', d ? 'dark' : 'light')
    }, isDark)
    await new Promise((r) => setTimeout(r, 1200))
    const data = await probe(page)
    console.log(`── ${label} ──`)
    console.log(`  .workspace-header background-color: ${data.header?.backgroundColor}`)
    console.log(`  .workspace-header background-image: ${data.header?.backgroundImage}`)
    console.log(`  .workspace-header background (shorthand): ${data.header?.background}`)
    console.log(`  .workspace         background-color: ${data.workspace?.backgroundColor}`)
    await page.close()
  }
  await browser.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
