#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公网缓存预热（EdgeOne / CDN）
 *
 * 背景（2026-10-21 实测，见 outputs/PUBLIC-ACCESS-PERF-AUDIT-2026-10-21.md）：
 *   回源通道实测吞吐仅 ~600 B/s。同一张 7,770 B 图片，EO 缓存命中 104 ms、回源 12.9 s；
 *   首页 291,808 B HTML 本地 16 ms、公网回源 9.9 ~ 45 s。
 *   结论：「缓存未命中」是公网卡顿的直接来源，本机渲染只占 16 ms。
 *
 *   因此部署 / 重启后 EO 缓存为空，第一个真实用户必然完整踩一次回源（10 ~ 45 s）。
 *   本脚本在部署收尾阶段主动打一遍关键 URL，把缓存预热好，让第一个用户即命中（~0.1 s）。
 *
 * 用法：
 *   node scripts/warm-prod-cache.mjs
 *   node scripts/warm-prod-cache.mjs --base https://aizhs.top
 *   node scripts/warm-prod-cache.mjs --urls /,/en,/login --concurrency 1
 *   node scripts/warm-prod-cache.mjs --timeout 90000
 *
 * 幂等：可重复执行。全部为只读 GET，无副作用。
 *   --force  忽略当前命中状态，强制重新拉取一遍。
 *
 * 退出码：0 = 全部预热成功；1 = 至少一个 URL 失败（可用于部署流水线门禁）。
 */

const DEFAULT_BASE = 'https://www.aizhs.top'

// 预热清单取舍原则：只放「公开、无用户态、首屏必经」的入口。
//   - 页面：营销首页 / 英文首页 / 登录页 / 状态页（均在未登录态下可完整渲染）
//   - 接口：health（体量小，但每次首屏都会打，预热后走 EO 边缘）
//   - 静态：首屏 logo + footer 大图（回源 600 B/s 管道下，图片是最大的受害者）
// 不放 /chat /admin：需登录，预热无意义且会缓存到重定向。
const DEFAULT_URLS = [
  // 页面：部署后必须强制回源的入口（warmOne 带 no-cache，EO 会回源校验并刷新对象）。
  '/',
  '/en',
  '/about',
  '/pricing',
  '/docs',
  '/status',
  '/login',
  '/api/health',
  // 图片：新键给新 HTML；旧键给仍被边缘缓存的旧 HTML —— 两套都刷，避免任何访客拿到旧字节。
  '/images/logo.png?v=20261021',
  '/images/logo.png?v=20260719-unify',
  '/footer/erweima/wechat-vx.png?v=20261021',
  '/footer/erweima/wechat-vx.png',
  '/images/kouzi-icon.png?v=20261021',
  '/images/kouzi-icon.png',
  '/brands/ali.png?v=20261021',
  '/brands/ali.png',
  '/brands/dbsfdx.png?v=20261021',
  '/brands/dbsfdx.png',
  '/brands/yushu.png?v=20261021',
  '/brands/yushu.png',
  '/footer/tuiguangpingtai/douyin.png',
]

function parseArgs(argv) {
  const out = { base: DEFAULT_BASE, urls: DEFAULT_URLS, concurrency: 2, timeout: 60000, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') out.base = argv[++i]
    else if (a === '--urls') out.urls = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--concurrency') out.concurrency = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--timeout') out.timeout = Math.max(1000, Number(argv[++i]) || 60000)
    else if (a === '--force') out.force = true
    else if (a === '--help' || a === '-h') {
      console.log('用法: node scripts/warm-prod-cache.mjs [--base URL] [--urls a,b,c] [--concurrency N] [--timeout MS] [--force]')
      process.exit(0)
    }
  }
  return out
}

async function warmOne(base, path, timeoutMs) {
  const url = base.replace(/\/+$/, '') + path
  const started = Date.now()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'IHUI-CacheWarmer/1.0 (+internal warm-up)',
        'accept-encoding': 'gzip, br',
        // 2026-10-21: 部署后边缘仍可能持有旧 HTML/旧图；no-cache 让 EO 回源校验并刷新对象，
        // 否则预热只会命中旧缓存，新 HTML 里的新 URL 永远到不了访客。
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    })
    const buf = await res.arrayBuffer()
    return {
      path,
      status: res.status,
      ms: Date.now() - started,
      bytes: buf.byteLength,
      eo: res.headers.get('eo-cache-status') ?? '-',
      cf: res.headers.get('cf-cache-status') ?? '-',
    }
  } catch (err) {
    const name = err && err.name ? err.name : 'Error'
    return { path, status: 0, ms: Date.now() - started, bytes: 0, eo: '-', cf: '-', err: `${name}` }
  } finally {
    clearTimeout(timer)
  }
}

function pad(s, n) {
  return String(s).padEnd(n)
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2))
  console.log(`预热目标: ${cfg.base}`)
  console.log(`URL 数: ${cfg.urls.length}  并发: ${cfg.concurrency}  超时: ${cfg.timeout} ms`)
  console.log('')

  const results = []
  const queue = cfg.urls.slice()
  const workers = Array.from({ length: Math.min(cfg.concurrency, queue.length) }, async () => {
    while (queue.length) {
      const p = queue.shift()
      if (!p) return
      const r = await warmOne(cfg.base, p, cfg.timeout)
      results.push(r)
      const state = r.eo !== '-' ? r.eo : r.cf !== '-' ? r.cf : '-'
      console.log(`  ${pad(r.path, 40)} ${pad(r.status || 'FAIL', 5)} ${pad(r.ms + 'ms', 9)} ${pad(r.bytes + 'B', 10)} cache=${state}${r.err ? '  ' + r.err : ''}`)
    }
  })
  await Promise.all(workers)

  const ok = results.filter((r) => r.status >= 200 && r.status < 400).length
  const failed = results.filter((r) => !(r.status >= 200 && r.status < 400))
  const totalMs = results.reduce((s, r) => s + r.ms, 0)
  const totalBytes = results.reduce((s, r) => s + r.bytes, 0)

  console.log('')
  console.log(`汇总: 成功 ${ok}/${results.length}  总耗时 ${totalMs} ms  总下载 ${totalBytes} B`)
  if (failed.length) {
    console.log('失败项:')
    for (const f of failed) console.log(`  ${f.path}  status=${f.status}  ${f.err ?? ''}`)
  }
  console.log('')
  console.log('提示: 预热完成后再跑一次本脚本，cache 列应显示 HIT（表示边缘已缓存）。')
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error('预热脚本异常:', err)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
