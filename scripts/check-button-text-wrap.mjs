#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-button-text-wrap.mjs — button 文本换行 2 行 浏览器实测守门 (2026-07-28 立)
 *
 * 背景:
 *   button 内中文/英文文本被父容器 flex 约束压缩/换行成 2 行,通常因
 *   button 缺 shrink-0 / whitespace-nowrap。本守门脚本用 Playwright 渲染目标页面,
 *   page.evaluate 扫所有 button,计算 button 内最深 <span> 文字 height vs
 *   fontSize × lineHeight(单行文字基线),textH/singleLineH > threshold → 视为换行成 2 行。
 *
 *   与 scripts/check-shrinkable-text-button.mjs 互补:
 *     - 那个是**静态扫描** JSX 源码(无 dev server 也可跑,找缺 shrink-0 的代码位置)
 *     - 这个是**运行时实测**(需要 dev server + 浏览器,捕获真实渲染的换行 bug)
 *
 * 检测算法(page.evaluate 内执行):
 *   1. 收集 --selectors 指定范围内的所有 button(默认全页面 button)
 *   2. 过滤 width/height = 0 的隐藏 button
 *   3. 找 button 内最深 <span>(无子 span、含非空 textContent)
 *   4. 取 span 实际 height + button fontSize
 *   5. 单行高度 = fontSize × 实际 lineHeight(若 lineHeight = 'normal' 则用 fontSize × 1.2)
 *   6. ratio = textH / singleLineH;ratio > threshold(默认 1.4)→ 换行
 *
 * 触发场景:
 *   - UI 改动验证(AGENTS.md §17)第 3 步的"实际渲染"补充
 *   - pre-commit / pre-push / CI nightly(dev server 探活,离线时友好 exit 0)
 *   - dev 自查:pnpm check:button-wrap:browser
 *
 * 依赖:
 *   - @playwright/test(项目内 apps/web/node_modules 已装)
 *   - chromium 浏览器(apps/web/e2e 已下载)
 *   - web dev server:http://localhost:8801(默认;--url 自定义)
 *
 * 用法:
 *   node scripts/check-button-text-wrap.mjs --help
 *   node scripts/check-button-text-wrap.mjs --url http://localhost:8801 --dry-run
 *   node scripts/check-button-text-wrap.mjs --url http://localhost:8801 --strict
 *   node scripts/check-button-text-wrap.mjs --url http://localhost:8801/chat --selectors '[data-testid="agent-progress-pane"]' --strict
 *   node scripts/check-button-text-wrap.mjs --url http://localhost:8801 --json
 *   node scripts/check-button-text-wrap.mjs --url http://localhost:8801 --exclude '^[\u{1F000}-\u{1FFFF}]$'
 *
 * 退出码:
 *   0 = 无命中 / dev server 未运行 / 扫描成功
 *   1 = 命中(--strict) / Playwright 未安装
 *   2 = 参数错误
 *
 * 关键参数:
 *   --url <url>          目标 URL(默认 http://localhost:8801)
 *   --selectors <css>    多个 selector 逗号分隔(默认 "button" 全页面扫)
 *   --timeout <ms>       页面加载 + 等待超时(默认 30000)
 *   --threshold <num>    自定义 ratio 阈值(默认 1.4)
 *   --strict             命中即 exit 1(默认仅打印 + 截图)
 *   --dry-run            打印命中列表(默认行为,显式语义)
 *   --quiet              只输出统计
 *   --json               输出 JSON 给 CI 消费
 *   --exclude <regex>    排除匹配正则的 button label(可多次,逗号分隔,如 emoji-only)
 *   --screenshot         命中时截图到 .trae-cn/tmp/button-text-wrap/ (默认开)
 *   --no-screenshot      关闭截图
 *   --help | -h          打印帮助
 */
import { mkdirSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')
const TMP_DIR = join(REPO_ROOT, '.trae-cn', 'tmp', 'button-text-wrap')

// ─── CLI 解析 ──────────────────────────────────────────────
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
check-button-text-wrap.mjs — button 文本换行 2 行 浏览器实测守门

用法:
  node scripts/check-button-text-wrap.mjs [options]

选项:
  --url <url>          目标 URL(默认 http://localhost:8801)
  --selectors <css>    多个 selector 逗号分隔(默认 "button" 全页面扫)
  --timeout <ms>       页面加载 + 等待超时(默认 30000)
  --threshold <num>    自定义 ratio 阈值(默认 1.4)
  --strict             命中即 exit 1(默认仅打印 + 截图)
  --dry-run            打印命中列表(默认行为)
  --quiet              只输出统计
  --json               输出 JSON 给 CI 消费
  --exclude <regex>    排除匹配正则的 button label(可多次,逗号分隔)
  --screenshot         命中时截图到 .trae-cn/tmp/button-text-wrap/ (默认开)
  --no-screenshot      关闭截图
  --help | -h          打印本帮助

退出码:
  0 = 无命中 / dev server 未运行 / 扫描成功
  1 = 命中(--strict) / Playwright 未安装
  2 = 参数错误

触发场景:
  - UI 改动验证(AGENTS.md §17)
  - pre-commit / pre-push / CI
  - 开发自查

修复建议:
  给 button className 加 shrink-0 + whitespace-nowrap
  例: className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
`)
  process.exit(0)
}

function argVal(name) {
  const i = args.findIndex((a) => a === name)
  if (i < 0) return null
  return args[i + 1] ?? null
}

const url = argVal('--url') ?? 'http://localhost:8801'
const selectors = (argVal('--selectors') ?? 'button')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const timeout = parseInt(argVal('--timeout') ?? '30000', 10)
const threshold = parseFloat(argVal('--threshold') ?? '1.4')
const isStrict = args.includes('--strict')
const isDryRun = args.includes('--dry-run')
const isQuiet = args.includes('--quiet')
const isJson = args.includes('--json')
const isNoScreenshot = args.includes('--no-screenshot')
const useScreenshot = !isNoScreenshot
const excludePatterns = (argVal('--exclude') ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p, 'u'))

// 基础参数校验
if (!Number.isFinite(timeout) || timeout <= 0) {
  console.error('❌ --timeout 必须是正整数(ms)')
  process.exit(2)
}
if (!Number.isFinite(threshold) || threshold < 1) {
  console.error('❌ --threshold 必须是 ≥ 1 的数字')
  process.exit(2)
}

// ─── 颜色 & 工具 ──────────────────────────────────────────
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}
const isTTY = process.stdout.isTTY
const c = (color, s) => (isTTY ? `${C[color]}${s}${C.reset}` : String(s))

// ─── Playwright 加载(fallback 多路径,使用 file:// URL 避开
// ─── ESM directory import 限制)────────────────────────
async function loadPlaywright() {
  const candidates = [
    '../apps/web/node_modules/@playwright/test/index.mjs',
    '../apps/web/node_modules/@playwright/test/index.js',
  ]
  const lastErr = []
  for (const p of candidates) {
    try {
      const url = new URL(p, import.meta.url).href
      const mod = await import(url)
      if (mod?.chromium) return mod
    } catch (e) {
      lastErr.push(`${p}: ${(e.message || String(e)).split('\n')[0]}`)
    }
  }
  throw new Error(
    `@playwright/test 未找到,请在 apps/web 下执行 pnpm install\n  尝试路径:\n  ${lastErr.join('\n  ')}`,
  )
}

// ─── 检测函数(page.evaluate 内部)──────────────────────────
// 返回 [{label, ratio, textH, btnHeight, btnWidth, fontSize, lineHeight, tag}]
function buildDetectFn(selectors, threshold) {
  return ({ selectors: sels, threshold: T }) => {
    const out = []
    // 1. 收集所有目标 button(union):每个 selector 既可指向 button 也可指向父容器
    const allBtns = new Set()
    for (const sel of sels) {
      const found = document.querySelectorAll(sel)
      for (const el of found) {
        if (el.tagName.toLowerCase() === 'button') {
          allBtns.add(el)
        } else {
          el.querySelectorAll('button').forEach((b) => allBtns.add(b))
        }
      }
    }
    for (const btn of allBtns) {
      const rect = btn.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const cs = getComputedStyle(btn)
      const fontSize = parseFloat(cs.fontSize)
      if (!Number.isFinite(fontSize) || fontSize <= 0) continue
      // 解析实际 lineHeight(支持 'normal' / 数字 + 单位)
      let lineHeight
      const lhStr = cs.lineHeight
      if (!lhStr || lhStr === 'normal') {
        lineHeight = fontSize * 1.2
      } else {
        const parsed = parseFloat(lhStr)
        lineHeight = Number.isFinite(parsed) && parsed > 0 ? parsed : fontSize * 1.2
      }
      const singleLineH = lineHeight
      // 取 button 内最深 <span>(无子 span、含非空 textContent)
      const candidateSpans = Array.from(btn.querySelectorAll('span')).filter(
        (s) =>
          s.children.length === 0 && (s.textContent || '').trim().length > 0,
      )
      if (candidateSpans.length === 0) continue
      let textH = 0
      let label = ''
      for (const sp of candidateSpans) {
        const r = sp.getBoundingClientRect()
        if (r.height > textH) {
          textH = r.height
          label = (sp.textContent || '').trim()
        }
      }
      if (textH === 0) continue
      const ratio = textH / singleLineH
      if (ratio > T) {
        out.push({
          label: label.slice(0, 60),
          ratio: Number(ratio.toFixed(3)),
          textH: Number(textH.toFixed(2)),
          singleLineH: Number(singleLineH.toFixed(2)),
          btnHeight: Number(rect.height.toFixed(2)),
          btnWidth: Number(rect.width.toFixed(2)),
          fontSize: Number(fontSize.toFixed(2)),
          tag: btn.outerHTML.slice(0, 200),
        })
      }
    }
    return out
  }
}

// ─── 探活 dev server(TCP 端口探活,避开 fetch/AbortSignal 在
// ─── Node 20+ Windows 上的 UV handle 关闭断言崩溃)────────
function probeServer(targetUrl) {
  let u
  try {
    u = new URL(targetUrl)
  } catch {
    return Promise.resolve({ ok: false, message: `invalid URL: ${targetUrl}` })
  }
  const host = u.hostname
  const port = parseInt(u.port || (u.protocol === 'https:' ? '443' : '80'), 10)
  return new Promise((resolve) => {
    const sock = createConnection({ host, port })
    const timer = setTimeout(() => {
      sock.destroy()
      resolve({ ok: false, message: `TCP ${host}:${port} timeout 3000ms` })
    }, 3000)
    sock.once('connect', () => {
      clearTimeout(timer)
      sock.end()
      resolve({ ok: true, host, port })
    })
    sock.once('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, message: `${e.code || e.name}: ${e.message}` })
    })
  })
}

// ─── 主流程 ───────────────────────────────────────────────
async function main() {
  const scanStart = Date.now()
  // 1. 探活
  const probe = await probeServer(url)
  if (!probe.ok) {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            status: 'skipped',
            reason: 'dev server not reachable',
            url,
            message: probe.message,
          },
          null,
          2,
        ),
      )
    } else {
      console.log(c('yellow', `⚠️  dev server 未运行,跳过本次检查: ${url}`))
      console.log(c('dim', `   (${probe.message})`))
    }
    process.exit(0)
  }

  // 2. 加载 Playwright
  let playwright
  try {
    playwright = await loadPlaywright()
  } catch (e) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'error', reason: 'playwright-missing', message: e.message }, null, 2))
    } else {
      console.error(c('red', `❌ 加载 @playwright/test 失败: ${e.message}`))
    }
    process.exit(1)
  }
  const { chromium } = playwright

  // 3. 启动浏览器 + 跑检测
  let status = 'ok'
  let error = null
  let hits = []
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(timeout)
    page.setDefaultNavigationTimeout(timeout)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      // 给 React 渲染 + 字体加载 + 网络空闲一点时间(容错:超时也不阻塞)
      await page.waitForLoadState('networkidle', { timeout }).catch(() => {})
      await page.waitForTimeout(500)

      const detect = buildDetectFn(selectors, threshold)
      const rawHits = await page.evaluate(detect, { selectors, threshold })
      hits = rawHits || []

      // 过滤 exclude
      if (excludePatterns.length > 0) {
        hits = hits.filter((h) => !excludePatterns.some((p) => p.test(h.label)))
      }

      // 截图取证
      if (useScreenshot && hits.length > 0) {
        try {
          mkdirSync(TMP_DIR, { recursive: true })
          const ts = new Date().toISOString().replace(/[:.]/g, '-')
          const file = join(TMP_DIR, `button-text-wrap-${ts}.png`)
          await page.screenshot({ path: file, fullPage: true })
          hits[0].screenshot = file
        } catch {
          // 截图失败不阻塞
        }
      }
    } finally {
      await context.close().catch(() => {})
    }
  } catch (e) {
    status = 'error'
    error = e.message || String(e)
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // ignore
      }
    }
  }

  const elapsedMs = Date.now() - scanStart
  const result = {
    status,
    url,
    selectors,
    threshold,
    exclude: excludePatterns.map((p) => p.source),
    totalHits: hits.length,
    hits,
    elapsedMs,
    error,
  }

  // ─── 输出 ──────────────────────────────────────────
  if (isJson) {
    console.log(JSON.stringify(result, null, 2))
    if (status !== 'ok') process.exit(0)
    if (isStrict && hits.length > 0) process.exit(1)
    process.exit(0)
  }

  if (status === 'error') {
    console.error(c('red', `❌ 检测失败: ${error}`))
    if (isStrict) process.exit(1)
    process.exit(0)
  }

  if (isQuiet) {
    console.log(`url=${url} hits=${hits.length} elapsed=${elapsedMs}ms`)
    if (isStrict && hits.length > 0) process.exit(1)
    process.exit(0)
  }

  if (hits.length === 0) {
    console.log(c('green', `✅ button 文本换行守门通过`))
    console.log(
      c('dim', `   扫描 ${url} 耗时 ${elapsedMs}ms, 阈值 ${threshold}, 排除 ${excludePatterns.length} 条`),
    )
    process.exit(0)
  }

  console.error('')
  console.error(
    c(
      'red',
      `❌ 发现 ${c('bold', hits.length)} 处 button 文本换行 (textH > ${threshold}× 单行高度)`,
    ),
  )
  console.error(
    c(
      'dim',
      `   URL: ${url}  阈值: ${threshold}  耗时: ${elapsedMs}ms  选择器: ${selectors.join(', ')}`,
    ),
  )
  console.error('')
  // 表格
  console.error(
    c(
      'bold',
      `  ${'label'.padEnd(28)}  ${'ratio'.padStart(7)}  ${'textH'.padStart(7)}  ${'btnH'.padStart(7)}  ${'fontSize'.padStart(8)}`,
    ),
  )
  console.error(c('dim', '  ' + '─'.repeat(70)))
  for (const h of hits) {
    const label = h.label.length > 26 ? h.label.slice(0, 25) + '…' : h.label
    console.error(
      `  ${c('yellow', label.padEnd(28))}  ${c('red', String(h.ratio).padStart(7))}  ${String(h.textH).padStart(7)}  ${String(h.btnHeight).padStart(7)}  ${String(h.fontSize).padStart(8)}`,
    )
  }
  console.error('')
  if (hits[0]?.screenshot) {
    const rel = hits[0].screenshot.replace(REPO_ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
    console.error(c('dim', `   截图: ${rel}`))
  }
  console.error(c('bold', '修复方法:'))
  console.error(
    `  给 button className 加 ${c('green', 'shrink-0')} + ${c('green', 'whitespace-nowrap')}`,
  )
  console.error(
    c(
      'dim',
      `  例: className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"`,
    ),
  )
  console.error('')
  if (isStrict) process.exit(1)
  process.exit(0)
}

main().catch((e) => {
  console.error(c('red', `❌ 未捕获异常: ${e.message || e}`))
  if (e.stack) console.error(c('dim', e.stack))
  process.exit(1)
})
