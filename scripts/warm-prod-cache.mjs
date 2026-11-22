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
 * 装车点（唯一生产调用方）：`deploy/win/ihui-deploy.ps1` 的 `Invoke-ProdCacheWarm`
 *   —— 只在「切流完成 + 健康门禁三项全绿」那一支被调用（门禁失败/回滚那一支在 :2261-2282
 *   就地 exit，结构上走不到预热）。预热失败只记 WARN，不改部署退出码、不触发回滚。
 *
 * 用法：
 *   node scripts/warm-prod-cache.mjs
 *   node scripts/warm-prod-cache.mjs --base https://aizhs.top
 *   node scripts/warm-prod-cache.mjs --urls /,/en,/login --concurrency 1
 *   node scripts/warm-prod-cache.mjs --timeout 90000 --budget 120000
 *
 * 幂等：可重复执行。全部为只读 GET，无副作用。
 *   --force  忽略当前命中状态，强制重新拉取一遍。
 *
 * 退出码：0 = 全部预热成功；1 = 至少一个 URL 失败或被 --budget 截断；
 *   2 = 未判定（清单取不到 / 枚举为 0，§0.3「没判」不写成「判过」）。
 *
 * 末行结论恒为一行纯 ASCII 键值（调用方 grep `WARM-RESULT` 即可，不受 GBK 码页影响，§5d）：
 *   WARM-RESULT state=ok|partial|failed|undetermined reason=... urls=N ok=N fail=N skipped=N ms=N bytes=N list=... base=...
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { maskComments } from './lib/code-mask.mjs'
const DEFAULT_BASE = 'https://www.aizhs.top'

// ── 页面清单：不手写，从「边缘缓存头的唯一真相源」现读 ──────────────────────────
// 立因（§0.6 单一真相源）：带 s-maxage 的公开页由 apps/web/next.config.ts 登记，
// 这里若再抄一份路径清单，两份必然漂移（改配置不改清单 = 预热漏页，反之 = 预热 404）。
// 因此枚举口径 = 解析 next.config.ts 里「同一对象内 source 与含 s-maxage 的 value 成对出现」
// 的条目；取不到（文件缺失/解析出 0 条）时**不冒绿**：落 state=undetermined + exit 2。
const NEXT_CONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'next.config.ts',
)

// 兜底清单仅在 --urls 显式给定之外、配置读取**成功但一条都没匹配到**时使用？不 —— 那种
// 情形按 §0.3 判「未判定」，不放行一份可能已过期的手抄清单。故本文件不设页面兜底集。
// 下面两项是「不依赖边缘缓存头也值得打」的补充：
//   /login      —— next.config.ts 明确排除在边缘缓存外（含用户态入口），打它是给源站
//                  SSR 预热（回源通道慢，第一个访客不该付全价），不是给 EO 预热；
//   /api/health —— 同上，体量 98 B，首屏必打。
const EXTRA_PAGE_URLS = ['/login', '/api/health']

// 静态资产清单：public/ 下图集走的是 `max-age=86400, stale-while-revalidate=604800`
// （next.config.ts 的 `/:path(.*\.(?:png|…))` 那条正则规则，无 s-maxage，按页匹配不到），
// 且回源 600 B/s 时图片是最大受害者（审计：同图 EO 命中 104 ms / 回源 12.9 s）。
// 带 ?v= 的新键与不带参数的旧键**两套都刷**：旧 HTML 仍被边缘缓存时引用的还是旧键。
const ASSET_URLS = [
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

const SOURCE_RE = /source:\s*'([^']+)'/g
const S_MAXAGE_RE = /s-maxage=/

/**
 * 从 next.config.ts 文本里抽出「配了边缘缓存（s-maxage）的 source 路径」。
 * 纯函数、零 IO —— 供镜像测试直接复用生产判据（§22c）。
 *
 * 先过 `maskComments`（唯一分词器在 scripts/lib/code-mask.mjs，本文件不造第二台）：
 * 配置里下一条规则的说明注释**就写着一个 s-maxage 字样**（next.config.ts:892
 * "force-static 路由的 s-maxage…属拍板项"），不遮注释就会把 /sw.js 读成"带边缘缓存"——
 * 判的是结构，注释不算实现（横向口径「判代码结构的门，注释与字符串都遮」这一档不适用，
 * 因为被认的两样东西本身就是字符串字面量，故取"只遮注释、保留字符串"那层）。
 * 窗口口径：右边界 = 下一条 `source:` 的起点（该对象自己的 value 必然落在它自己
 * 的 source 之后，不会被算进前一条）。
 */
export function extractEdgeCachedSources(text) {
  const src = maskComments(String(text ?? ''))
  const hits = []
  const re = new RegExp(SOURCE_RE.source, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    hits.push({ path: m[1], start: m.index, bodyStart: re.lastIndex })
  }
  const out = []
  for (let i = 0; i < hits.length; i++) {
    const right = i + 1 < hits.length ? hits[i + 1].start : hits[i].bodyStart + 260
    const body = src.slice(hits[i].bodyStart, Math.max(hits[i].bodyStart, right))
    if (S_MAXAGE_RE.test(body)) out.push(hits[i].path)
  }
  return out
}

/** 可否直接 GET：必须是 `/` 开头的静态字面量，含 `:` `(` `*` `?` 的是路由模式，没法当 URL 打。 */
export function isWarmablePath(p) {
  return typeof p === 'string' && p.startsWith('/') && !/[:*?()]/.test(p)
}

/** 读配置并分桶；读不到 / 枚举为 0 一律 ok=false（不回落另一份清单，§0.4 不跨面）。 */
export function loadPageList(configPath = NEXT_CONFIG_PATH) {
  let text
  try {
    text = readFileSync(configPath, 'utf8')
  } catch (e) {
    return { ok: false, reason: 'config-unreadable', detail: String((e && e.code) || e) }
  }
  const sources = extractEdgeCachedSources(text)
  if (sources.length === 0) {
    return { ok: false, reason: 'list-empty', detail: 'sources=0' }
  }
  const warmable = sources.filter(isWarmablePath)
  if (warmable.length === 0) {
    return { ok: false, reason: 'no-static-path', detail: `patterns=${sources.length}` }
  }
  const seen = new Set()
  const urls = []
  for (const u of [...warmable, ...EXTRA_PAGE_URLS]) {
    if (!seen.has(u)) {
      seen.add(u)
      urls.push(u)
    }
  }
  return {
    ok: true,
    urls,
    patternsSkipped: sources.length - warmable.length,
    source: 'next.config.ts',
  }
}

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE,
    urls: null, // null = 从 next.config.ts 现读;给了 --urls 则以显式清单为准
    concurrency: 2,
    timeout: 60000,
    budget: 0, // 0 = 不设总墙钟上限;部署侧必须传(预热不得拖垮部署轮)
    force: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') out.base = argv[++i]
    else if (a === '--urls')
      out.urls = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    else if (a === '--concurrency') out.concurrency = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--timeout') out.timeout = Math.max(1000, Number(argv[++i]) || 60000)
    else if (a === '--budget') out.budget = Math.max(0, Number(argv[++i]) || 0)
    else if (a === '--force') out.force = true
    else if (a === '--help' || a === '-h') {
      console.log(
        '用法: node scripts/warm-prod-cache.mjs [--base URL] [--urls a,b,c] [--concurrency N] [--timeout MS] [--budget MS] [--force]',
      )
      process.exit(0)
    }
  }
  return out
}

/**
 * 单行机读结论 —— 纯 ASCII 键值(§5d:GBK 码页会吃掉中文 stdout,所以这一行不写中文;
 * 任何非 ASCII 一律替换成 `_`,保证 `grep WARM-RESULT` 在部署日志里恒可检)。
 * state 四档:ok = 全部成功;partial = 有成功但也有失败/被预算截断;
 * failed = 一个都没成功(且确实跑过);undetermined = 清单取不到,根本没发请求(§0.3)。
 */
export function buildConclusion(v) {
  const ascii = (s) => String(s ?? '-').replace(/[^\x20-\x7E]/g, '_')
  const host = (() => {
    try {
      return new URL(v.base).host
    } catch {
      return '-'
    }
  })()
  return [
    'WARM-RESULT',
    `state=${ascii(v.state)}`,
    `reason=${ascii(v.reason || 'none')}`,
    `urls=${Number(v.urls) || 0}`,
    `ok=${Number(v.ok) || 0}`,
    `fail=${Number(v.fail) || 0}`,
    `skipped=${Number(v.skipped) || 0}`,
    `ms=${Number(v.ms) || 0}`,
    `bytes=${Number(v.bytes) || 0}`,
    `list=${ascii(v.list)}`,
    `patterns_skipped=${Number(v.patternsSkipped) || 0}`,
    `base=${ascii(host)}`,
  ].join(' ')
}

/** 退出码:0 全绿 / 1 有失败或被截断 / 2 未判定(没跑到任何一次请求)。 */
export function exitCodeFor(state) {
  if (state === 'ok') return 0
  if (state === 'undetermined') return 2
  return 1
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
  const startedAt = Date.now()
  const deadline = cfg.budget > 0 ? startedAt + cfg.budget : Number.POSITIVE_INFINITY

  // —— 清单:显式 --urls 优先,否则从 next.config.ts 现读(§0.6 单一真相源)——
  let urls,
    listSource,
    patternsSkipped = 0
  if (cfg.urls) {
    urls = cfg.urls
    listSource = 'cli'
  } else {
    const l = loadPageList()
    if (!l.ok) {
      console.log(`预热目标: ${cfg.base}`)
      console.log(`清单取不到(${l.reason}:${l.detail})⇒ 未判定,不发任何请求`)
      console.log(
        buildConclusion({
          state: 'undetermined',
          reason: l.reason,
          urls: 0,
          ok: 0,
          fail: 0,
          skipped: 0,
          ms: Date.now() - startedAt,
          bytes: 0,
          list: 'unavailable',
          base: cfg.base,
        }),
      )
      process.exit(exitCodeFor('undetermined'))
    }
    urls = [...l.urls, ...ASSET_URLS]
    listSource = l.source
    patternsSkipped = l.patternsSkipped
  }
  urls = Array.from(new Set(urls))
  if (urls.length === 0) {
    // 枚举到 0 个候选判死,不记绿(§0.3)
    console.log(
      buildConclusion({
        state: 'undetermined',
        reason: 'urls-empty',
        urls: 0,
        ok: 0,
        fail: 0,
        skipped: 0,
        ms: 0,
        bytes: 0,
        list: listSource,
        base: cfg.base,
      }),
    )
    process.exit(exitCodeFor('undetermined'))
  }

  console.log(`预热目标: ${cfg.base}`)
  console.log(
    `URL 数: ${urls.length}(清单来源=${listSource},路由模式跳过 ${patternsSkipped} 条)  并发: ${cfg.concurrency}  单URL超时: ${cfg.timeout} ms  总预算: ${cfg.budget > 0 ? cfg.budget + ' ms' : '不限'}`,
  )
  console.log('')

  let budgetHit = false
  const results = []
  const queue = urls.slice()
  const workers = Array.from({ length: Math.min(cfg.concurrency, queue.length) }, async () => {
    while (queue.length) {
      if (Date.now() >= deadline) {
        budgetHit = true
        queue.length = 0 // 另一路工人同样立刻收口,预算之外不再发新请求
        return
      }
      const p = queue.shift()
      if (!p) return
      const r = await warmOne(cfg.base, p, cfg.timeout)
      results.push(r)
      const state = r.eo !== '-' ? r.eo : r.cf !== '-' ? r.cf : '-'
      console.log(
        `  ${pad(r.path, 40)} ${pad(r.status || 'FAIL', 5)} ${pad(r.ms + 'ms', 9)} ${pad(r.bytes + 'B', 10)} cache=${state}${r.err ? '  ' + r.err : ''}`,
      )
    }
  })
  await Promise.all(workers)

  const okCount = results.filter((r) => r.status >= 200 && r.status < 400).length
  const failed = results.filter((r) => !(r.status >= 200 && r.status < 400))
  const skipped = urls.length - results.length
  const wallMs = Date.now() - startedAt
  const totalBytes = results.reduce((s, r) => s + r.bytes, 0)

  let state, reason
  if (results.length === 0) {
    state = 'failed'
    reason = 'budget-exceeded'
  } else if (okCount === 0) {
    state = 'failed'
    reason = 'all-failed'
  } else if (failed.length === 0 && skipped === 0) {
    state = 'ok'
    reason = 'none'
  } else {
    state = 'partial'
    reason = budgetHit ? 'budget-exceeded' : failed.length ? 'some-failed' : 'none'
  }

  console.log('')
  console.log(
    `汇总: 成功 ${okCount}/${results.length}  跳过 ${skipped}  墙钟 ${wallMs} ms  总下载 ${totalBytes} B${budgetHit ? '  (触发 --budget 截断)' : ''}`,
  )
  if (failed.length) {
    console.log('失败项:')
    for (const f of failed) console.log(`  ${f.path}  status=${f.status}  ${f.err ?? ''}`)
  }
  console.log('提示: 预热完成后再跑一次本脚本，cache 列应显示 HIT（表示边缘已缓存）。')
  // 结论行**必须是最后一行**:部署侧只认 `tail -1` / grep 到的这一行(纯 ASCII,理由见 buildConclusion)。
  console.log(
    buildConclusion({
      state,
      reason,
      urls: urls.length,
      ok: okCount,
      fail: failed.length,
      skipped,
      ms: wallMs,
      bytes: totalBytes,
      list: listSource,
      patternsSkipped,
      base: cfg.base,
    }),
  )
  process.exit(exitCodeFor(state))
}

// §22d 双形态入口:被 import(镜像测试)时不触发主流程;CLI 直执行才跑。
// 守卫必须用 pathToFileURL(手拼 'file:///' + argv[1] 在 Windows 反斜杠路径上永不匹配)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((err) => {
    // 脚本自身异常(非"某个 URL 失败")⇒ 未判定,exit 2;绝不被读成"预热成功"。
    console.error('预热脚本异常:', err)
    console.log(
      buildConclusion({
        state: 'undetermined',
        reason: 'script-error',
        urls: 0,
        ok: 0,
        fail: 0,
        skipped: 0,
        ms: 0,
        bytes: 0,
        list: 'error',
        base: DEFAULT_BASE,
      }),
    )
    process.exit(exitCodeFor('undetermined'))
  })
}

export const __test__ = {
  DEFAULT_BASE,
  ASSET_URLS,
  EXTRA_PAGE_URLS,
  NEXT_CONFIG_PATH,
  parseArgs,
  extractEdgeCachedSources,
  isWarmablePath,
  loadPageList,
  buildConclusion,
  exitCodeFor,
  warmOne,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
