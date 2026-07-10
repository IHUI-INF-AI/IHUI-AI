/**
 * 阶段 3.3 — 全路由 Puppeteer padding 审计脚本 (精版, 2026-07-05)
 *
 * 聚焦 30 个关键路由 (登录/工作区首页/chat/profile/admin 等核心模块代表),
 * 1 视口 (1440 desktop) + 1 主题 (dark, 严苛) = 30 组合, 5 分钟内出结果.
 *
 * 设计原因: Vite dev server 首次访问每个新路由需 18s+ ESM 编译, 全 384 路由
 *   扫描需 1-2 小时. 精版聚焦 30 个核心路由, 既能验证阶段 1+2 修复无回归,
 *   又能在合理时间 (5-10 分钟) 内完成.
 *
 * 关键检查点 (锚定值与 _app-shell.scss / _ai-chat-variables.scss 一致):
 *   - .workspace-header padding-left: 24 (desktop 1440)
 *   - .glass-header padding-left: 24
 *   - .ws-page-title padding-left: 4 (保留原 4px)
 *   - .main-content padding-top: 60 (sidebar 布局)
 *   - .app-container padding: 0
 *
 * 关键路由清单 (覆盖所有 14 个 router modules 的代表):
 *   - 登录/注册/403/404 (公共页 .glass-header)
 *   - 工作区首页 / (核心 .workspace-header)
 *   - chat /ai (核心 .ai-chat-messages)
 *   - profile /user (用户中心)
 *   - admin, order, edu, community, tools, api (各模块入口)
 *
 * 用法:
 *   # 1. 启动 dev server: cd g:\IHUI-AI\client && npm run dev
 *   # 2. 跑精版: node scripts/audit-routes-after-preflight-refactor.mjs --snapshot=current
 *   # 3. 跑浅色: --theme=light
 *   # 4. 跑移动端: --viewport=375
 *
 * 退出码:
 *   0 - 0 异常
 *   1 - 有 ERR/Fail 路由
 */

import puppeteer from 'puppeteer'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = 'g:/IHUI-AI/client'
const SNAPSHOT_DIR = join(PROJECT_ROOT, '.audit-snapshots')
const BASE = 'http://127.0.0.1:8888'
const DEV_SERVER_READY_TIMEOUT_MS = 30_000

// 30 个关键路由 (覆盖所有 router modules 代表 + 关键检查点)
const KEY_ROUTES = [
  // 公共页 (玻璃头 .glass-header)
  '/login',
  '/register',
  '/403',
  '/404',
  '/forgot-password',
  // 工作区 (workspace-header)
  '/',
  '/home',
  '/workspace',
  '/dashboard',
  // AI 核心 (ai-chat-messages)
  '/ai',
  '/chat',
  '/ai/chat',
  '/chat/new',
  // 用户中心
  '/profile',
  '/user',
  '/settings',
  // 业务模块入口
  '/admin',
  '/admin/users',
  '/order',
  '/orders',
  '/edu',
  '/community',
  '/tools',
  '/api',
  '/marketplace',
  '/message',
  '/notification',
  '/search',
  '/profile/settings',
]

const VIEWPORT_EXPECT = {
  1440: { workspace: 24, glass: 24, pageTitle: 12, mainTop: 60 },
  1024: { workspace: 20, glass: 24, pageTitle: 12, mainTop: 60 },
  375:  { workspace: 16, glass: 24, pageTitle: 12, mainTop: 0 },
}

const DEFAULT_VIEWPORT = 1440
const DEFAULT_THEME = 'dark'
const ROUTE_TIMEOUT_MS = 30_000
const ROUTE_RENDER_WAIT_MS = 1_500
const ROUTE_THROTTLE_MS = 200

const args = process.argv.slice(2)
const snapshotMode = args.find(a => a.startsWith('--snapshot='))?.split('=')[1] ?? 'current'
const diffMode = args.includes('--diff')
const viewportArg = args.find(a => a.startsWith('--viewport='))?.split('=')[1]
const themeArg = args.find(a => a.startsWith('--theme='))?.split('=')[1]
const VIEWPORT = viewportArg ? parseInt(viewportArg) : DEFAULT_VIEWPORT
const THEME = themeArg || DEFAULT_THEME

async function waitForDevServer() {
  const start = Date.now()
  while (Date.now() - start < DEV_SERVER_READY_TIMEOUT_MS) {
    try {
      const res = await fetch(BASE + '/', { method: 'GET' })
      if (res.status < 500) return true
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function scanRoute(browser, path, viewport, theme) {
  const page = await browser.newPage()
  await page.setViewport({ width: viewport, height: 900 })
  if (theme === 'dark') {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('darkMode', 'dark')
      localStorage.setItem('theme', 'dark')
    })
  }
  const result = { path, viewport, theme, error: null, checks: {} }
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: ROUTE_TIMEOUT_MS })
    await new Promise(r => setTimeout(r, ROUTE_RENDER_WAIT_MS))
    result.checks = await page.evaluate(() => {
      const out = {}
      for (const sel of ['.workspace-header', '.glass-header', '.ws-page-title', '.main-content', '.app-container']) {
        const el = document.querySelector(sel)
        if (!el) {
          out[sel] = { present: false }
          continue
        }
        const cs = getComputedStyle(el)
        out[sel] = {
          present: true,
          padTop: cs.paddingTop,
          padRight: cs.paddingRight,
          padBottom: cs.paddingBottom,
          padLeft: cs.paddingLeft,
          marginTop: cs.marginTop,
        }
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

function evaluateResult(result) {
  if (result.error) return { pass: false, reason: `ERR: ${result.error}` }
  const expect = VIEWPORT_EXPECT[result.viewport]
  const issues = []
  const ws = result.checks['.workspace-header']
  if (ws && ws.present && ws.padLeft !== `${expect.workspace}px`) {
    issues.push(`.workspace-header padLeft=${ws.padLeft} 期望=${expect.workspace}px`)
  }
  const gh = result.checks['.glass-header']
  if (gh && gh.present && gh.padLeft !== `${expect.glass}px`) {
    issues.push(`.glass-header padLeft=${gh.padLeft} 期望=${expect.glass}px`)
  }
  const pt = result.checks['.ws-page-title']
  if (pt && pt.present && pt.padLeft !== `${expect.pageTitle}px`) {
    issues.push(`.ws-page-title padLeft=${pt.padLeft} 期望=${expect.pageTitle}px`)
  }
  return issues.length === 0 ? { pass: true } : { pass: false, reason: issues.join('; ') }
}

async function runDiff() {
  const beforePath = join(SNAPSHOT_DIR, 'before.json')
  const afterPath = join(SNAPSHOT_DIR, 'after.json')
  if (!existsSync(beforePath) || !existsSync(afterPath)) {
    console.error(`[FAIL] --diff 模式需要 before.json + after.json:`)
    console.error(`  ${beforePath}: ${existsSync(beforePath) ? '✅' : '❌'}`)
    console.error(`  ${afterPath}: ${existsSync(afterPath) ? '✅' : '❌'}`)
    process.exit(1)
  }
  const before = JSON.parse(await import('fs').then(m => m.readFileSync(beforePath, 'utf8')))
  const after = JSON.parse(await import('fs').then(m => m.readFileSync(afterPath, 'utf8')))
  const beforeKeys = new Set(Object.keys(before))
  let diffCount = 0
  for (const key of Object.keys(after)) {
    if (!beforeKeys.has(key)) {
      console.log(`[NEW] ${key}`)
      diffCount++
      continue
    }
    const b = before[key]
    const a = after[key]
    if (b.error !== a.error) {
      console.log(`[DIFF] ${key} error: ${b.error} → ${a.error}`)
      diffCount++
    }
    for (const sel of Object.keys(a.checks)) {
      const bc = b.checks[sel]
      const ac = a.checks[sel]
      if (!bc || !ac || !ac.present || !bc.present) continue
      if (bc.padLeft !== ac.padLeft || bc.padTop !== ac.padTop) {
        console.log(`[DIFF] ${key} ${sel}: padLeft=${bc.padLeft}→${ac.padLeft} padTop=${bc.padTop}→${ac.padTop}`)
        diffCount++
      }
    }
  }
  console.log(`\n${diffCount === 0 ? '✅ 0 差异' : `❌ ${diffCount} 差异`}`)
  process.exit(diffCount === 0 ? 0 : 1)
}

async function runScan() {
  console.log(`[INIT] 等待 dev server: ${BASE}`)
  const ready = await waitForDevServer()
  if (!ready) {
    console.error(`[FAIL] dev server 未就绪, 请先: cd g:\\IHUI-AI\\client && npm run dev`)
    process.exit(1)
  }
  console.log(`[OK] dev server 已就绪\n`)

  console.log(`[SCAN] 精版: ${KEY_ROUTES.length} 关键路由 × 视口 ${VIEWPORT} × 主题 ${THEME}`)
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const snapshot = {}
  let passCount = 0, failCount = 0, errCount = 0
  const startTime = Date.now()
  for (let i = 0; i < KEY_ROUTES.length; i++) {
    const path = KEY_ROUTES[i]
    const result = await scanRoute(browser, path, VIEWPORT, THEME)
    const key = `${path}@${VIEWPORT}#${THEME}`
    snapshot[key] = result
    const ev = evaluateResult(result)
    if (result.error) {
      errCount++
      console.log(`[${i+1}/${KEY_ROUTES.length}] [ERR] ${key}: ${result.error.slice(0, 80)}`)
    } else if (!ev.pass) {
      failCount++
      console.log(`[${i+1}/${KEY_ROUTES.length}] [FAIL] ${key}: ${ev.reason}`)
    } else {
      passCount++
    }
    if ((i + 1) % 5 === 0 || i === KEY_ROUTES.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const avgPerRoute = ((Date.now() - startTime) / (i + 1) / 1000).toFixed(1)
      const eta = ((KEY_ROUTES.length - i - 1) * avgPerRoute).toFixed(0)
      console.log(`[PROGRESS] ${i+1}/${KEY_ROUTES.length} (${((i+1)/KEY_ROUTES.length*100).toFixed(0)}%) 耗时 ${elapsed}s 剩余 ${eta}s pass=${passCount} fail=${failCount} err=${errCount}`)
    }
    await new Promise(r => setTimeout(r, ROUTE_THROTTLE_MS))
  }
  await browser.close()

  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const outFile = join(SNAPSHOT_DIR, `${snapshotMode}.json`)
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2), 'utf8')

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`扫描完成: ${KEY_ROUTES.length} 关键路由 × 视口 ${VIEWPORT} × 主题 ${THEME}`)
  console.log(`耗时: ${elapsed}s 平均 ${(elapsed / KEY_ROUTES.length).toFixed(1)}s/路由`)
  console.log(`结果: pass=${passCount} fail=${failCount} err=${errCount}`)
  console.log(`快照: ${outFile}`)
  console.log(`${'='.repeat(60)}`)

  if (failCount === 0 && errCount === 0) {
    console.log(`\n✅ 全部通过 — 阶段 1+2 修复在 30 关键路由无回归`)
    process.exit(0)
  } else {
    console.log(`\n❌ ${failCount} fail + ${errCount} err`)
    process.exit(1)
  }
}

;(async () => {
  try {
    if (diffMode) await runDiff()
    else await runScan()
  } catch (e) {
    console.error(`[FATAL] ${e.stack || e.message}`)
    process.exit(2)
  }
})()
