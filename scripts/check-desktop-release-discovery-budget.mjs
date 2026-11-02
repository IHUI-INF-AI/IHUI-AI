#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-desktop-release-discovery-budget.mjs — 桌面版"发现射程"是否快顶穿的只读尺子(2026-11-02 立)
 *
 * 它只问一个问题:**运行期还能不能翻到最新那枚 desktop release?**
 * 背景是 2026-11-02 实测复发的同型事故:GitHub `/releases` 按创建时间倒序,而 Android nightly
 * 每跑一次 CI 就新增一枚 release ⇒ 第一页 100 条现读**全是 nightly**,`desktop-v0.1.76` 被挤到
 * 第 3 页。运行期解析器已改成分页枚举,但分页有上限(maxPages=10 ⇒ 射程 1000 枚 release,
 * 按现读节律约 75 天)。这一格 CI 侧 2026-09 就写明"仓库里的 release 只会越来越多,这一格是
 * 必然恶化的"——**当时的修法治的是"翻不到",没治"以后还会翻不到"**。本尺子就是把后者变成
 * 会喊的东西:在静默退回入库快照**之前**报警,而不是之后靠人肉发现页面躺旧号。
 *
 * 判据(三态分档,不并桶,§0.3):
 *   ok        desktop.scan.pages < scan.maxPages ∧ partial=false
 *   breach    pages 顶到 maxPages(下一枚就出射程)或 partial=true(有页取不到,射程已经缩水)
 *   unjudged  出口取不到 / 不是 JSON / 该端没有 scan 字段(= 没有输入,不冒充绿也不冒红)
 *
 * 可整改性(§5e-1):红了收信人有两条明确动作 —— 抬 `desktop-feed-live.ts` 的
 * RELEASE_PAGE_MAX_PAGES,或把"最新桌面 tag"缓存成一次 `releases/tags/<tag>` 直查
 * (`bake-desktop-latest.mjs` 已用同一端点)。不是一句"看看日志"。
 *
 * 接线:判的是公网端点与运行期数据,提交者结构上改不了那一格 ⇒ **刻意不进提交链**(§12e 恒红门
 * 禁令)。唯一调度器 = `scripts/git-guardian.mjs` 的 `sweepDesktopDiscoveryBudget`(6h 节流;
 * breach 经到人通道按稳定身份去重寄信,unjudged 只写日志不喊人)。
 *
 * 用法:
 *   node scripts/check-desktop-release-discovery-budget.mjs
 *   node scripts/check-desktop-release-discovery-budget.mjs --base-url http://127.0.0.1:8801
 *   node scripts/check-desktop-release-discovery-budget.mjs --json
 *   node scripts/check-desktop-release-discovery-budget.mjs --self-test   # 构造面正反对照,不触网
 * 退出码:0 全绿 / 1 breach / 2 unjudged(取不到输入)
 */
import { pathToFileURL } from 'node:url'

export const DEFAULT_BASE_URL = 'https://www.aizhs.top'
export const ENDPOINT = '/downloads.json'
const TIMEOUT_MS = 15000

/** 单个读数:三态,不允许第四态 */
export function item(id, state, detail) {
  return { id, state, detail }
}

/**
 * 纯判据:桌面端 scan 预算。
 * `scan` 缺失 ⇒ unjudged(运行期没交出预算 = 说不出射程用没用满,绝不当成"没问题")
 */
export function judgeDiscoveryBudget(scan) {
  if (scan === null || typeof scan !== 'object') {
    return {
      level: 'unjudged',
      scan: null,
      items: [item('scan', 'unjudged', '出口未给出 desktop.scan(没有输入,不判)')],
    }
  }
  const pages = Number(scan.pages)
  const maxPages = Number(scan.maxPages)
  const partial = scan.partial === true
  if (!Number.isFinite(pages) || !Number.isFinite(maxPages) || maxPages <= 0) {
    return {
      level: 'unjudged',
      scan,
      items: [
        item(
          'scan-shape',
          'unjudged',
          `scan 形状不对 pages=${String(scan.pages)} maxPages=${String(scan.maxPages)}`,
        ),
      ],
    }
  }
  const items = [
    item(
      'pages',
      pages >= maxPages ? 'breach' : 'ok',
      `已翻到第 ${pages}/${maxPages} 页(scanned=${String(scan.scanned ?? '?')})`,
    ),
    item(
      'partial',
      partial ? 'breach' : 'ok',
      partial ? '有页取不到 ⇒ 射程已缩水(比"没翻到"更糟:结论是按残缺集合算的)' : '各页均取到',
    ),
  ]
  const level = items.some((i) => i.state === 'breach') ? 'breach' : 'ok'
  return { level, scan, items }
}

/** 从 /downloads.json 的响应体里取桌面那一格(形状不对一律 null ⇒ 交判据判未判定) */
export function pickDesktopScan(payload) {
  if (payload === null || typeof payload !== 'object') return null
  const downloads = payload.downloads
  if (downloads === null || typeof downloads !== 'object') return null
  const desktop = downloads.desktop
  if (desktop === null || typeof desktop !== 'object') return null
  return desktop.scan ?? null
}

/**
 * 结论归一:与 `check-app-version-latest.mjs` 同一形状(`state` + `red[]` + `undetermined[]`),
 * 派发侧读 state 不读退出码(exit 1 可能夹带混合结论,退出码折不出红几条)。
 */
export function toVerdict(judged, source) {
  const items = judged.items
  const red = items.filter((i) => i.state === 'breach')
  const undetermined = items.filter((i) => i.state === 'unjudged')
  const state = red.length > 0 ? 'fail' : undetermined.length > 0 ? 'undetermined' : 'pass'
  return { state, level: judged.level, source, scan: judged.scan ?? null, red, undetermined, items }
}

export function renderReport(verdict) {
  const lines = [
    `桌面版发现射程: ${verdict.state.toUpperCase()} (${verdict.source})`,
    ...verdict.items.map((i) => `  · [${i.state}] ${i.id}: ${i.detail}`),
  ]
  if (verdict.state === 'fail') {
    lines.push(
      '  出路(二选一,都是当场可改):① 抬 apps/web/src/config/desktop-feed-live.ts 的 RELEASE_PAGE_MAX_PAGES;' +
        '② 把最新桌面 tag 缓存成一次 releases/tags/<tag> 直查(bake-desktop-latest.mjs 已用同一端点)。',
    )
  }
  return lines.join('\n')
}

async function fetchEndpoint(baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, '')}${ENDPOINT}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} (${url})` }
    return { ok: true, detail: url, body: await res.json() }
  } catch (e) {
    return { ok: false, detail: `${String(e).slice(0, 120)} (${url})` }
  }
}

/** 构造面自证:每一档各有成对夹具,摘掉判据任一支都会翻红 */
export function runSelfTest() {
  const cases = [
    { name: '射程有余量 ⇒ ok', scan: { pages: 3, maxPages: 10, scanned: 201, partial: false }, want: 'ok' },
    { name: '顶到上限 ⇒ breach', scan: { pages: 10, maxPages: 10, scanned: 1000, partial: false }, want: 'breach' },
    { name: '超过上限 ⇒ breach', scan: { pages: 11, maxPages: 10, scanned: 1100, partial: false }, want: 'breach' },
    { name: '中途页失败 ⇒ breach(即便没顶满)', scan: { pages: 2, maxPages: 10, scanned: 100, partial: true }, want: 'breach' },
    { name: 'scan 缺失 ⇒ unjudged(不冒充绿)', scan: null, want: 'unjudged' },
    { name: 'maxPages=0 ⇒ unjudged', scan: { pages: 1, maxPages: 0, scanned: 10, partial: false }, want: 'unjudged' },
  ]
  let bad = 0
  for (const c of cases) {
    const got = judgeDiscoveryBudget(c.scan).level
    const pass = got === c.want
    if (!pass) bad += 1
    console.log(`  ${pass ? '✓' : '✗'} ${c.name} [判出 ${got}]`)
  }
  const pickCases = [
    { name: '正常响应取到 scan', body: { downloads: { desktop: { scan: { pages: 3, maxPages: 10 } } } }, want: 3 },
    { name: '缺 downloads 键 ⇒ null', body: { foo: 1 }, want: null },
    { name: '缺 desktop 键 ⇒ null', body: { downloads: { ios: {} } }, want: null },
    { name: 'body 非对象 ⇒ null', body: 'oops', want: null },
  ]
  for (const c of pickCases) {
    const got = pickDesktopScan(c.body)
    const val = got === null ? null : got.pages
    const pass = val === c.want
    if (!pass) bad += 1
    console.log(`  ${pass ? '✓' : '✗'} pickDesktopScan ${c.name} [判出 ${String(val)}]`)
  }
  console.log(bad === 0 ? `self-test 通过(${cases.length + pickCases.length} 例)` : `self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  const envBase = typeof process.env.IHUI_DOWNLOADS_PROBE_BASE === 'string' ? process.env.IHUI_DOWNLOADS_PROBE_BASE.trim() : ''
  const flagIdx = argv.indexOf('--base-url')
  const baseUrl =
    (flagIdx >= 0 ? argv[flagIdx + 1] : '') || envBase || process.env.IHUI_SITE_PUBLIC_BASE || DEFAULT_BASE_URL

  const fetched = await fetchEndpoint(baseUrl)
  const judged = fetched.ok
    ? judgeDiscoveryBudget(pickDesktopScan(fetched.body))
    : { level: 'unjudged', scan: null, items: [item('endpoint', 'unjudged', `出口取不到:${fetched.detail}`)] }
  const verdict = toVerdict(judged, fetched.detail)

  if (argv.includes('--json')) {
    console.log(JSON.stringify(verdict, null, 1))
  } else {
    console.log(renderReport(verdict))
  }
  // 用 exitCode 不用 exit():本机 Node 26 在 fetch 句柄未排空时 exit() 会撞上
  // libuv 的 `UV_HANDLE_CLOSING` 断言(2026-11-02 实测),把那行 abort 混进守护日志
  // 比退出码更难读 —— 让事件循环自然排空。
  process.exitCode = verdict.state === 'pass' ? 0 : verdict.state === 'fail' ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  judgeDiscoveryBudget,
  pickDesktopScan,
  toVerdict,
  item,
  ENDPOINT,
  DEFAULT_BASE_URL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
