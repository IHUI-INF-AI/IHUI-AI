/**
 * 重跑 4 个 timeout 路由 (/login, /register, /403, /404) 验证非真实 padding 问题 (2026-07-05)
 */
import puppeteer from 'puppeteer'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE = 'http://127.0.0.1:8888'
const VIEWPORT = 1024
const THEME = 'dark'
const ROUTES = ['/login', '/register', '/403', '/404']
const ROUTE_TIMEOUT_MS = 60_000
const ROUTE_RENDER_WAIT_MS = 1_500
const PROJECT_ROOT = 'g:/IHUI-AI/client'
const SNAPSHOT_DIR = join(PROJECT_ROOT, '.audit-snapshots')

async function scanRoute(browser, path) {
  const page = await browser.newPage()
  await page.setViewport({ width: VIEWPORT, height: 900 })
  if (THEME === 'dark') {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('darkMode', 'dark')
      localStorage.setItem('theme', 'dark')
    })
  }
  const result = { path, viewport: VIEWPORT, theme: THEME, error: null, checks: {} }
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT_MS })
    await new Promise(r => setTimeout(r, ROUTE_RENDER_WAIT_MS))
    result.checks = await page.evaluate(() => {
      const out = {}
      for (const sel of ['.workspace-header', '.ws-page-title', '.glass-header']) {
        const el = document.querySelector(sel)
        if (!el) { out[sel] = { present: false }; continue }
        const cs = getComputedStyle(el)
        out[sel] = { present: true, padLeft: cs.paddingLeft, padRight: cs.paddingRight, padTop: cs.paddingTop }
      }
      return out
    })
  } catch (e) {
    result.error = String(e).slice(0, 200)
  } finally {
    await page.close()
  }
  return result
}

;(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const out = {}
  let ok = 0, err = 0
  for (const path of ROUTES) {
    const r = await scanRoute(browser, path)
    out[path] = r
    if (r.error) { err++; console.log(`[ERR] ${path}: ${r.error}`) }
    else { ok++; console.log(`[OK] ${path}: workspace-header padLeft=${r.checks['.workspace-header']?.padLeft || 'absent'}`) }
    await new Promise(r => setTimeout(r, 500))
  }
  await browser.close()

  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const file = join(SNAPSHOT_DIR, 'tablet-retry-4routes.json')
  writeFileSync(file, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n${ok} OK + ${err} ERR. 写到 ${file}`)
  process.exit(err === 0 ? 0 : 1)
})()
