#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * e2e-extension-tracking.mjs —— 浏览器插件端埋点的真机实证(2026-10-26 立,只读,不进提交链)。
 *
 * 为什么必须有:插件端的 `/ex/` 埋点是纯客户端代码,单测能钉"函数逻辑",钉不了
 * "构建出来的 MV3 包在真 Chromium 里真的会发这条请求"。AGENTS §17 要求 UI 改动真浏览器验证,
 * 本尺就是这一条在插件端的落点。
 *
 * 两条硬约束:
 * 1. **一律本地代答,不投递生产库**:本机 8802 就是生产 API,`visit_logs` 是生产表。
 *    伪造访问行等于把正在建的指标污染掉(而且分不清真人)。所以每条埋点都被 route 截获、
 *    代答 200,只核对 payload。
 *    (反面教训:改用 `route.abort()` 时每条埋点会变两条 —— 那是 api-client 的网络失败重试,
 *     不是双报;判"双报"必须先确认拦法。)
 * 2. **取不到输入 ⇒ exit 2 未判定**:扩展产物没构建、Chromium 找不到、扩展没加载 ⇒ 显式未判定,
 *    不冒绿也不冒红(AGENTS §0.3)。
 *
 * 用法: node scripts/e2e-extension-tracking.mjs [--ext <chrome-mv3 目录>] [--headed]
 * 前置: pnpm turbo build --filter=@ihui/extension
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function undetermined(msg) {
  console.error('❌ 未判定:' + msg)
  process.exit(2)
}

/** 解析 playwright-core:优先仓库根,取不到再退到全局 node_modules(不写死 pnpm 版本号)。 */
function loadPlaywright() {
  const tries = [
    () => {
      const req = createRequire(path.join(ROOT, 'package.json'))
      return pathToFileURL(req.resolve('playwright-core')).href
    },
    () => {
      const hit = fs
        .readdirSync(path.join(ROOT, 'node_modules/.pnpm'))
        .filter((d) => d.startsWith('playwright-core@'))
        .sort()[0]
      if (!hit) throw new Error('no pnpm dir')
      return pathToFileURL(
        path.join(ROOT, 'node_modules/.pnpm', hit, 'node_modules/playwright-core/index.mjs'),
      ).href
    },
  ]
  for (const t of tries) {
    try {
      return import(t())
    } catch {
      /* 换下一条腿 */
    }
  }
  return null
}

/** Chromium 可执行文件:PLAYWRIGHT_BROWSERS_PATH(§26 已改道 D 盘)里取最新 chromium-* 目录。 */
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || 'D:\\DevEnv\\cache\\playwright'
  if (!fs.existsSync(base)) return null
  const dirs = fs
    .readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(exe)) return exe
  }
  return null
}

async function main() {
  const args = process.argv.slice(2)
  const extIdx = args.indexOf('--ext')
  const extDir = path.resolve(
    extIdx >= 0 && args[extIdx + 1]
      ? args[extIdx + 1]
      : path.join(ROOT, 'apps/extension/.output/chrome-mv3'),
  )
  if (!fs.existsSync(path.join(extDir, 'manifest.json'))) {
    undetermined(`扩展产物不存在(${extDir});先跑 pnpm turbo build --filter=@ihui/extension`)
  }
  const pw = await loadPlaywright()
  if (!pw) undetermined('playwright-core 解析不到')
  const exePath = findChromium()
  if (!exePath) undetermined(`找不到 Chromium(${exePath})`)

  const { mkScratch, rmScratch } = await import(
    pathToFileURL(path.join(ROOT, 'scripts/lib/scratch-dir.mjs')).href
  )

  const seen = []
  const profile = mkScratch('ext-tracking-e2e')
  const ctx = await pw.chromium.launchPersistentContext(profile, {
    headless: !args.includes('--headed'),
    executablePath: exePath,
    args: [
      '--disable-extensions-except=' + extDir,
      '--load-extension=' + extDir,
      '--no-proxy-server',
    ],
  })
  let closed = false
  const cleanup = async () => {
    if (closed) return
    closed = true
    await ctx.close().catch(() => {})
    rmScratch(profile)
  }

  for (const p of ['**/visit-tracking/visit-log', '**/analytics/track']) {
    await ctx.route(p, async (route) => {
      const req = route.request()
      let parsed = null
      try {
        parsed = JSON.parse(req.postData() ?? '')
      } catch {
        parsed = { raw: req.postData() }
      }
      seen.push({ path: new URL(req.url()).pathname, body: parsed })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { visitLog: { id: 'stub' } } }),
      })
    })
  }

  const sw = await ctx
    .waitForEvent('serviceworker', { timeout: 25000 })
    .catch(() => ctx.serviceWorkers()[0] ?? null)
  if (!sw) {
    await cleanup()
    undetermined('扩展 service worker 没起来(扩展未加载/被策略禁用)')
  }
  const extId = new URL(sw.url()).host

  /** 打开一个视图,等到它发出埋点为止(最多 10 秒)。 */
  async function openView(html) {
    const before = seen.length
    const page = await ctx.newPage()
    await page.goto('chrome-extension://' + extId + '/' + html, { waitUntil: 'domcontentloaded' })
    for (let i = 0; i < 40 && seen.length === before; i++) await page.waitForTimeout(250)
    const mine = seen.slice(before)
    await page.close()
    return mine
  }

  const popup = await openView('popup.html')
  const side = await openView('sidepanel.html')
  await cleanup()

  const urlOf = (r) => (r.body && r.body.url ? r.body.url : r.body?.events?.[0]?.label)
  const dump = (rows) => rows.map((r) => `${r.path} → ${JSON.stringify(urlOf(r))}`).join(' | ')
  console.log('extension id = ' + extId)
  console.log('popup 埋点:' + (popup.length ? dump(popup) : '(未发出)'))
  console.log('sidepanel 埋点:' + (side.length ? dump(side) : '(未发出)'))

  const popupOk = popup.some(
    (r) => urlOf(r) === '/ex/popup' && r.body?.sessionId && !('userId' in r.body),
  )
  const sideOk = side.some(
    (r) => typeof urlOf(r) === 'string' && urlOf(r).startsWith('/ex/sidepanel'),
  )
  if (!popupOk || !sideOk) {
    console.error(
      `❌ 判红:popupOk=${popupOk} sidepanelOk=${sideOk} —— 构建包里的埋点没有按 /ex/ 约定发出`,
    )
    process.exit(1)
  }
  console.log('✅ 插件端埋点在真 Chromium 中按 /ex/ 约定发出(全程本地代答,未写生产库)')
  process.exit(0)
}

export const __test__ = { findChromium, ROOT }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
