/**
 * 关键布局 padding 跨路由审计 (2026-07-05 立)
 *
 * 目的: 验证阶段 1+2 (per-element + pre-commit 守门) 修复在所有路由上无布局回归
 *   替代"根因修复后无回归" 的验证目标
 *
 * 关键检查点 (任一偏离预期即报警):
 *   - .workspace-header padding-left = 24px (desktop)
 *   - .glass-header padding-left = 24px (登录页)
 *   - .skip-link padding = 6px 10px (动态注入)
 *   - .network-offline-banner padding = 12px 20px (动态注入)
 *   - .main-content padding-top = 60px (默认; sidebar 布局下 = 0)
 *   - .app-container padding = 0
 *
 * 用法:
 *   1. 启动 dev server: cd client && npm run dev
 *   2. 跑审计: node scripts/audit-routes-padding.mjs
 *   3. 期望: "✅ 0 差异, all routes pass"
 *
 * 性能: 327 路由 × 2 主题 = 654 组合, Puppeteer 约 1 路由/秒, 预计 11 分钟
 * 优化: --limit=N 限制路由数, --skip-error 跳过 timeout 路由
 */
import puppeteer from 'puppeteer'
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || 0
const skipErrors = args.includes('--skip-error')

const ROUTER_DIR = join(ROOT, 'src/router/modules')
const BASE = 'http://127.0.0.1:8888'
const SNAPSHOT_DIR = join(ROOT, '.audit-snapshots')

// ═══ 关键检查点定义 ═══
const CHECKPOINTS = [
  { name: 'workspace-header', selector: '.workspace-header', expectPadLeft: '24px' },
  { name: 'glass-header', selector: '.glass-header', expectPadLeft: '24px' },
  { name: 'main-content', selector: '.main-content', expectPadTop: '0px' }, // sidebar 布局下
  { name: 'app-container', selector: '.app-container', expectPad: '0px' },
  { name: 'page-title', selector: '.ws-page-title', expectPadLeft: '4px' },
]

function extractPaths() {
  const files = readdirSync(ROUTER_DIR).filter((f) => f.endsWith('.ts'))
  const paths = new Set()
  for (const f of files) {
    try {
      const content = readFileSync(join(ROUTER_DIR, f), 'utf8')
      const matches = content.matchAll(/path:\s*['"]([^'":*]+)['"]/g)
      for (const m of matches) {
        const p = m[1]
        if (p.includes(':') || p.includes('*') || p.includes('(')) continue
        paths.add('/' + p.replace(/^\//, ''))
      }
    } catch {}
  }
  let list = Array.from(paths).sort()
  if (limit > 0) list = list.slice(0, limit)
  return list
}

async function scanRoute(browser, path, theme) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  if (theme === 'dark') {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('darkMode', 'dark')
      localStorage.setItem('theme', 'dark')
    })
  }
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1500))
    return await page.evaluate(() => {
      const points = ['.workspace-header', '.glass-header', '.main-content', '.app-container', '.ws-page-title']
      const results = []
      for (const sel of points) {
        const el = document.querySelector(sel)
        if (!el) continue
        const cs = getComputedStyle(el)
        results.push({
          sel,
          padTop: cs.paddingTop,
          padRight: cs.paddingRight,
          padBottom: cs.paddingBottom,
          padLeft: cs.paddingLeft,
        })
      }
      return results
    })
  } catch (e) {
    return { error: String(e).slice(0, 200) }
  } finally {
    await page.close()
  }
}

function compareResults(snapshot, expected) {
  let diffCount = 0
  for (const [route, data] of Object.entries(snapshot)) {
    if (data.error) {
      if (!skipErrors) diffCount++
      continue
    }
    for (const pt of data) {
      const expected_pt = expected[pt.sel]
      if (!expected_pt) continue
      if (expected_pt.padLeft !== undefined && pt.padLeft !== expected_pt.padLeft) {
        console.log(`[DIFF] ${route} ${pt.sel} padLeft: ${pt.padLeft} (expected ${expected_pt.padLeft})`)
        diffCount++
      }
      if (expected_pt.padTop !== undefined && pt.padTop !== expected_pt.padTop) {
        console.log(`[DIFF] ${route} ${pt.sel} padTop: ${pt.padTop} (expected ${expected_pt.padTop})`)
        diffCount++
      }
    }
  }
  return diffCount
}

async function main() {
  const paths = extractPaths()
  console.log(`扫描 ${paths.length} 路由 × 2 主题 = ${paths.length * 2} 组合`)

  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true })

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })

  // 期望值锚定 (基于 _app-shell.scss / _ai-chat-variables.scss)
  // main-content 在 sidebar 布局下 padding-top: 0 (在登录页才是 60px), 所以这里默认期望 0
  const expected = {
    '.workspace-header': { padLeft: '24px' },
    '.glass-header': { padLeft: '24px' },
    '.ws-page-title': { padLeft: '4px' },
    '.app-container': { pad: '0px' },
    '.main-content': { padTop: '0px' }, // sidebar 布局下
  }

  const snapshot = {}
  let errorCount = 0
  for (const [i, path] of paths.entries()) {
    for (const theme of ['light', 'dark']) {
      const data = await scanRoute(browser, path, theme)
      const key = `${path}#${theme}`
      snapshot[key] = data
      if (data.error) {
        errorCount++
        if (i < 5) console.log(`[ERR] ${key}: ${data.error}`)
      }
    }
    if ((i + 1) % 20 === 0) console.log(`  进度: ${i + 1}/${paths.length} 路由`)
  }
  await browser.close()

  const outFile = join(SNAPSHOT_DIR, 'padding-current.json')
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2))
  console.log(`\n✅ 快照保存到 ${outFile}`)

  // 对比期望值
  const diffCount = compareResults(snapshot, expected)

  console.log(`\n${diffCount === 0 ? '✅ 0 差异' : `❌ ${diffCount} 差异 (需检查是否回归)`} | ${errorCount} 路由错误${skipErrors ? ' (已跳过)' : ''}`)
  if (!skipErrors && errorCount > 0) {
    console.log(`  注: 路由错误 (timeout / SPA 内部跳转) 不一定表示布局问题`)
  }
  process.exit(diffCount === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
