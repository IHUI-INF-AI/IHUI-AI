#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子需输出读数 */
/**
 * verify-wallboard-readout.mjs —— 运维大屏每格读数的「断行 / 溢出」离线实测尺(只读)。
 *
 * 定位:与 check-readout-no-break.mjs(门 240,静态结构判据)互补 ——
 *   门 240 锁"结构不变量"(原语必须 nowrap、常数必须同源),能在提交链跑;
 *   本尺量"某格在某容器宽下到底放不放得下",这取决于**运行时值的长度**,
 *   静态判必出假红(实测:把 11px 的 unit 槽算成复合读数会造 24 枚假红),
 *   所以本尺不进提交链、不进守护巡检轮(AGENTS「只读尺子/派生器/核验器」那一档),
 *   由人按票复跑。红了不自动定责,判红权在人。
 *
 * 为什么必须真渲染:本仓 2026-10-24 实测,只补 nowrap 会把"读数折行"变成"溢出压邻格"
 * (号池 61px / 主机面板 51px)—— 两态都难看,而**只有渲染能量出来**。
 *
 * 建模来源 = 被审文件本身(面板 class、网格 class、每格 label/value 表达式全部从源码解析),
 * 不接受手工清单:手工副本会与被审面漂移(本尺第一版就因此漏掉了 wide 档)。
 *
 * 读数最坏形态 = 数据上界表(见 WORST):每条要么标「实」(生产现读量级),
 * 要么落「保」(保守上界 999,999 等)并在输出里显式点名 —— 不冒充实测。
 *
 * 用法:
 *   node scripts/verify-wallboard-readout.mjs                      # 默认容器宽 1440,1920
 *   node scripts/verify-wallboard-readout.mjs --widths 1280,1440,1920 --json
 *   node scripts/verify-wallboard-readout.mjs --staged             # 判索引 blob(默认 HEAD)
 *   node scripts/verify-wallboard-readout.mjs --worktree           # 判磁盘面
 *   node scripts/verify-wallboard-readout.mjs --self-test
 * 退出码:0 无断行无溢出 / 1 判出缺口 / 2 未判定(取不到被审面、取不到构建 CSS、
 *         解析到的格数 ≠ 源码 <StatCell 枚数、浏览器起不来)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, '..')
export const TARGET_REL = 'apps/web/app/(main)/admin/monitor/wallboard/page.tsx'
const WEB = resolve(REPO_ROOT, 'apps/web')
const TMP = resolve(REPO_ROOT, '.ihui-agent', 'tmp', 'wallboard-readout')

/**
 * 数据上界表(读数最坏形态)。
 * kind='实' = 生产现读到的量级(2026-10-24 大屏实测);kind='保' = 保守上界,未实测。
 * 未列出的格一律落 '保' ⇒ 输出里必须点名,免得被读成"已按真数据验过"。
 */
export const WORST = {
  fmtDuration: { text: '365天23小时', kind: '保' },
  fmtBytes: { text: '12.3 GB', kind: '保' },
  fmtRate: { text: '1.5 MB/s', kind: '保' },
  fmtPct: { text: '100.00%', kind: '保' },
  fmtCompact: { text: '12.3万', kind: '保' },
  fmtInt: { text: '999,999', kind: '保' },
  toFixed: { text: '99999.00', kind: '保' },
  // 号池两格是「可调度 / 总数」形态,总数实测 17 / 3 ⇒ 用实测量级,不用 6 位保守界
  poolRatio: { text: '17 / 17', kind: '实' },
  trafficPv: { text: '128,431', kind: '实' },
}

/** 把一个 value 表达式映射成最坏读数文本(按特征,不解析语法)。 */
export function worstReadout(expr, labelKey) {
  const e = String(expr).replace(/\s+/g, ' ')
  const declared = []
  if (/poolKeySchedulable|poolAccountSchedulable/.test(labelKey ?? '')) {
    declared.push(WORST.poolRatio)
  }
  if (/\.toFixed\(/.test(e)) declared.push(WORST.toFixed)
  if (/fmtDuration/.test(e)) declared.push(WORST.fmtDuration)
  if (/fmtBytes/.test(e)) declared.push(WORST.fmtBytes)
  if (/fmtRate/.test(e)) declared.push(WORST.fmtRate)
  if (/fmtPct/.test(e)) declared.push(WORST.fmtPct)
  if (/fmtCompact/.test(e)) declared.push(WORST.fmtCompact)
  if (/fmtInt/.test(e)) declared.push(WORST.fmtInt)
  if (/pv24h|uv24h|humanPv|botPv|pv1h|uv1h/.test(labelKey ?? '')) declared.push(WORST.trafficPv)
  if (declared.length === 0) declared.push(WORST.fmtInt)
  // 等长时优先「实」测条,别让 sort 的不确定性把保守界读成实测
  declared.sort((a, b) => b.text.length - a.text.length || (a.kind === '实' ? -1 : 1))
  const pick = declared[0]
  const arrows = (e.match(/[↓↑]/g) ?? []).join('')
  // 已经自带 " / " 的声明(号池「17 / 17」)不再二次拼接,否则量出双倍长度假红
  const slash = /\$\{[^}]*\}\s\/\s\$\{/.test(e) && !pick.text.includes(' / ')
  const base = pick.text
  return {
    text: `${arrows ? `${arrows} ` : ''}${slash && !arrows ? `${base} / ${base}` : base}`,
    kind: pick.kind,
  }
}

/** JSX 属性值按花括号配平提取(模板串里的 ${} 自身配对,故配平成立)。 */
export function extractAttr(blk, name) {
  const at = blk.indexOf(`${name}={`)
  if (at < 0) return null
  let d = 0
  let j = at + name.length + 1
  for (; j < blk.length; j++) {
    if (blk[j] === '{') d += 1
    else if (blk[j] === '}') {
      d -= 1
      if (d === 0) break
    }
  }
  if (d !== 0) return null
  return blk.slice(at + name.length + 2, j)
}

/** 从被审面解析出「面板 → 网格组 → 格」三层结构。 */
export function parsePanels(src) {
  const panels = []
  // 用逐行扫描替代跨行正则(JSX 属性顺序不固定,跨行正则会漏 bodyClassName)
  const lines = src.split('\n')
  let cur = null
  let curGrid = null
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]
    const ti = L.match(/title=\{t\('([^']+)'\)/)
    if (ti) {
      cur = { title: ti[1], line: i + 1, span: '', split: '', grids: [] }
      curGrid = null
      panels.push(cur)
      continue
    }
    if (!cur) continue
    const sp = L.match(/className="(wb-c[^"]*)"/)
    if (sp && !cur.span) cur.span = sp[1]
    const sb = L.match(/bodyClassName="([^"]*)"/)
    if (sb && !cur.split) cur.split = sb[1]
    const gc = L.match(/className="([^"]*\bwb-cells\b[^"]*)"/)
    if (gc) {
      curGrid = { cls: gc[1], line: i + 1, cells: [] }
      cur.grids.push(curGrid)
      continue
    }
    if (/<StatCell\b/.test(L) && curGrid) {
      // 本格边界 = 从本行起到本格的 `/>`;按固定行数窗口会吞掉下一格的 unit(实测把两格并成一格)
      const rest = lines.slice(i).join('\n')
      const close = rest.indexOf('/>')
      const blk = close > 0 ? rest.slice(0, close) : rest.slice(0, 400)
      const lb = blk.match(/label=\{t\('([^']+)'\)/)
      curGrid.cells.push({
        line: i + 1,
        labelKey: lb ? lb[1] : null,
        valueExpr: extractAttr(blk, 'value') ?? '',
        unitExpr: extractAttr(blk, 'unit'),
      })
    }
  }
  return panels
}

export function readFace(face) {
  if (face === 'worktree') {
    try {
      return readFileSync(resolve(REPO_ROOT, TARGET_REL), 'utf8')
    } catch {
      return null
    }
  }
  try {
    return execFileSync('git', ['show', `${face === 'staged' ? ':!0' : 'HEAD'}:${TARGET_REL}`], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

function loadBuiltCss() {
  const dir = resolve(WEB, '.next/static/chunks')
  let names
  try {
    names = readdirSync(dir).filter((f) => f.endsWith('.css'))
  } catch {
    return null
  }
  const all = names.map((f) => readFileSync(resolve(dir, f), 'utf8')).join('\n')
  if (!/whitespace-nowrap/.test(all)) return { css: null, reason: '构建 CSS 里没有 whitespace-nowrap 工具类(产物陈旧或未构建)' }
  return {
    css: all
      .replace(/url\((['"]?)\/fonts\//g, 'url($1' + pathToFileURL(resolve(WEB, 'public/fonts')) + '/')
      .replace(/url\((['"]?)\/_next\//g, 'url($1' + pathToFileURL(resolve(WEB, '.next')) + '/'),
    names,
  }
}

/** unit 槽:走 i18n 的是词条,拼出来的是带箭头的复合读数。 */
export function unitLabel(expr, msgs) {
  if (!expr) return null
  const m = String(expr).match(/^\s*t\(\s*['"]([^'"]+)['"]\s*\)\s*$/)
  if (m) return msgs[m[1]] ?? m[1]
  return worstReadout(expr, '').text
}

export function buildDoc({ builtCss, wallCss, msgs, panels, hostW }) {
  const zh = msgs
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const panelHtml = panels
    .filter((p) => p.grids.some((g) => g.cells.length))
    .map((p) => {
      const inner = p.grids
        .filter((g) => g.cells.length)
        .map((g) => {
          const cells = g.cells
            .map((c) => {
              const w = worstReadout(c.valueExpr, c.labelKey)
              const uTxt = unitLabel(c.unitExpr, zh)
              const unit = uTxt ? `<span class="ml-0.5 text-[11px] text-muted-foreground">${esc(uTxt)}</span>` : ''
              return `<div class="min-w-0 rounded-lg border border-border bg-muted/60 px-2.5 py-2" data-line="${c.line}" data-kind="${w.kind}">
<div class="text-[10px] tracking-[0.12em] text-muted-foreground">${esc(zh[c.labelKey] ?? c.labelKey ?? '?')}</div>
<div class="wb-num mt-0.5 text-[18px] leading-tight font-semibold whitespace-nowrap">${esc(w.text)}${unit}</div></div>`
            })
            .join('')
          return `<div><div class="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">组@${g.line}</div><div class="${g.cls} grid gap-1.5" data-probe>${cells}</div></div>`
        })
        .join('')
      const bodyCls = p.split || ''
      return `<section class="ui-lift wb-panel relative flex min-h-0 flex-col rounded-xl border border-border bg-card/80 ${p.span}" data-title="${p.title}">
<header class="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1"><h2 class="wb-display text-[13px] font-semibold uppercase">${esc(zh[p.title] ?? p.title)}</h2></header>
<div class="min-h-0 flex-1 overflow-hidden p-3 ${bodyCls}">${bodyCls.includes('wb-split') ? inner : `<div>${inner}</div>`}</div></section>`
    })
    .join('')
  return `<!doctype html><html class="light"><head><meta charset="utf-8">
<style>${builtCss}</style><style>${wallCss}</style>
<style>html,body{height:auto;overflow:visible}</style></head>
<body class="bg-background text-foreground"><div class="wb-root" style="width:${hostW}px;container-type:inline-size">
<section class="wb-grid grid gap-2.5 p-4">${panelHtml}</section></div></body></html>`
}

export const MEASURE = () => {
  const textW = (el) => {
    const rg = document.createRange()
    rg.selectNodeContents(el)
    return rg.getBoundingClientRect().width
  }
  const rows = []
  for (const panel of document.querySelectorAll('[data-title]')) {
    for (const c of panel.querySelectorAll('[data-probe] > div')) {
      const kids = [...c.children]
      if (kids.length < 2) continue
      const [lbl, val] = kids
      const lh = (el) => {
        const raw = parseFloat(getComputedStyle(el).lineHeight)
        return Number.isFinite(raw) ? raw : parseFloat(getComputedStyle(el).fontSize) * 1.2
      }
      const inner = c.getBoundingClientRect().width - 22
      rows.push({
        panel: panel.dataset.title,
        line: Number(c.dataset.line),
        kind: c.dataset.kind === '实' ? '实' : '保',
        label: lbl.textContent,
        value: val.textContent.trim(),
        cellW: +c.getBoundingClientRect().width.toFixed(1),
        wrapped: val.getBoundingClientRect().height > Math.ceil(lh(val)) + 1,
        spill: +(textW(val) - inner).toFixed(1),
      })
    }
  }
  return rows
}

function probeServer(port) {
  return new Promise((res) => {
    const sock = createConnection({ host: '127.0.0.1', port })
    const timer = setTimeout(() => {
      sock.destroy()
      res(false)
    }, 2000)
    sock.once('connect', () => {
      clearTimeout(timer)
      sock.end()
      res(true)
    })
    sock.once('error', () => {
      clearTimeout(timer)
      res(false)
    })
  })
}

async function run({ face, widths, json }) {
  const src = readFace(face)
  if (src === null) return { status: 'unjudged', reason: `取不到被审面 ${face}:${TARGET_REL}` }
  const built = loadBuiltCss()
  if (!built || built.css === null) return { status: 'unjudged', reason: built?.reason ?? '读不到 .next/static/chunks/*.css' }
  const wallCss = src.match(/const WALLBOARD_CSS = `([\s\S]*?)`\n/)?.[1]
  if (!wallCss) return { status: 'unjudged', reason: '被审面里解析不到 WALLBOARD_CSS 常量' }
  const msgs = JSON.parse(readFileSync(resolve(REPO_ROOT, 'packages/i18n/messages/web/zh-CN.json'), 'utf8')).admin?.wallboard
  if (!msgs) return { status: 'unjudged', reason: '取不到 zh-CN 的 admin.wallboard 词条' }

  const panels = parsePanels(src)
  const parsedCells = panels.reduce((n, p) => n + p.grids.reduce((m, g) => m + g.cells.length, 0), 0)
  const declaredCells = (src.match(/<StatCell\b/g) ?? []).length
  if (parsedCells === 0) return { status: 'unjudged', reason: '解析到 0 枚 StatCell ⇒ 本尺无输入' }
  if (parsedCells !== declaredCells)
    return {
      status: 'unjudged',
      reason: `解析到 ${parsedCells} 枚 StatCell,源码里实有 ${declaredCells} 枚 ⇒ 建模面与源码脱钩,读数不可信(尺子本身要修)`,
    }

  let chromium
  try {
    const pw = await import(pathToFileURL(resolve(WEB, 'node_modules/@playwright/test/index.mjs')).href)
    chromium = pw.chromium ?? pw.default?.chromium
  } catch {
    try {
      const pw = await import(pathToFileURL(resolve(WEB, 'node_modules/@playwright/test/index.js')).href)
      chromium = pw.chromium ?? pw.default?.chromium
    } catch {
      return { status: 'unjudged', reason: '加载 @playwright/test 失败(apps/web 未装依赖)' }
    }
  }
  if (!chromium) return { status: 'unjudged', reason: 'playwright 模块里没有 chromium 导出' }

  mkdirSync(TMP, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const perWidth = {}
  try {
    for (const w of widths) {
      const ctx = await browser.newContext({ viewport: { width: w + 400, height: 1600 } })
      const page = await ctx.newPage()
      const f = resolve(TMP, `face-${w}.html`)
      writeFileSync(f, buildDoc({ builtCss: built.css, wallCss, msgs, panels, hostW: w }))
      await page.goto(pathToFileURL(f).href, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(120)
      const rows = await page.evaluate(MEASURE)
      perWidth[w] = rows.filter((r) => r.wrapped || r.spill > 1.5).map((r) => ({ ...r, declared: r.value }))
      if (perWidth[w].length > 0) {
        await page.screenshot({ path: resolve(TMP, `overflow-${w}.png`), fullPage: true })
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  return { status: 'ok', face, parsedCells, declaredCells, perWidth, cssChunks: built.names.length }
}

function selfTest() {
  const src = readFace('worktree')
  if (src === null) return { status: 'unjudged', reason: '取不到工作区面' }
  const panels = parsePanels(src)
  const cells = panels.reduce((n, p) => n + p.grids.reduce((m, g) => m + g.cells.length, 0), 0)
  const declared = (src.match(/<StatCell\b/g) ?? []).length
  const cases = [
    ['建模格数 == 源码 <StatCell 枚数', cells === declared && cells > 0],
    ['面板被解析出来', panels.length >= 10],
    ['网格 class 取自源码(含 c3/wide 档)', panels.some((p) => p.grids.some((g) => /wb-cells-(c3|wide)/.test(g.cls)))],
    ['split class 取自源码', panels.some((p) => (p.split ?? '').includes('wb-split'))],
    ['时长读数落 365天23小时', worstReadout('fmtDuration(redis?.uptimeSeconds)', 'redisUptime').text === '365天23小时'],
    ['号池比例读数用实测量级而非保守 6 位', worstReadout('${fmtInt(a)} / ${fmtInt(b)}', 'poolKeySchedulable').text === '17 / 17'],
    ['未声明的格落保守上界并标 保', worstReadout('fmtInt(x)', 'someNewKey').kind === '保'],
    ['复合读数(两个量并排)长度翻倍被建模', worstReadout('${fmtBytes(a)} / ${fmtBytes(b)}', 'memPhysical').text.includes(' / ')],
    [
      'extractAttr 按花括号配平(模板串里的 ${} 不得截断)',
      (extractAttr('value={`↓ ${fmtRate(a)}`}\n tone="x"', 'value') ?? '') === '`↓ ${fmtRate(a)}`',
    ],
    [
      '本格边界不吞下格的 unit(两格并排各取各的)',
      panels.every((p) => p.grids.every((g) => g.cells.every((c) => !String(c.valueExpr).includes('unit=')))),
    ],
    ['unit 走 i18n 词条而不是键名', unitLabel("t('unitPv')", { unitPv: '次' }) === '次'],
    ['unit 是复合表达式时按最坏读数展开', (unitLabel('`↑ ${fmtRate(x)}`', {}) ?? '').includes('MB/s')],
  ]
  let fail = 0
  for (const [name, ok] of cases) {
    if (!ok) fail += 1
    console.log(`${ok ? '✓' : '✗'} ${name}`)
  }
  console.log(`自检 ${cases.length - fail}/${cases.length} 通过(建模 ${cells}/${declared} 格)`)
  return { status: fail === 0 ? 'ok' : 'fail', cells, declared }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('用法:node scripts/verify-wallboard-readout.mjs [--staged|--worktree] [--widths 1440,1920] [--json] [--self-test]')
    process.exit(0)
  }
  if (args.includes('--self-test')) {
    const r = selfTest()
    process.exit(r.status === 'ok' ? 0 : 1)
  }
  const face = args.includes('--staged') ? 'staged' : args.includes('--worktree') ? 'worktree' : 'head'
  if (args.includes('--staged') && args.includes('--worktree')) {
    console.error('❌ --staged 与 --worktree 不得同给')
    process.exit(2)
  }
  const wi = args.indexOf('--widths')
  const widths = wi >= 0 ? args[wi + 1].split(',').map((x) => Number(x.trim())).filter(Number.isFinite) : [1440, 1920]
  const json = args.includes('--json')
  if (widths.length === 0) {
    console.error('❌ --widths 解析不出任何数字')
    process.exit(2)
  }
  const r = await run({ face, widths, json })
  if (json) {
    console.log(JSON.stringify(r, null, 2))
    const hardCount =
      r.status === 'ok'
        ? Object.values(r.perWidth).reduce((n, arr) => n + arr.filter((x) => x.kind === '实').length, 0)
        : 0
    process.exit(r.status === 'unjudged' ? 2 : hardCount === 0 ? 0 : 1)
  }
  if (r.status === 'unjudged') {
    console.log(`⚪ [大屏读数实测] 未判定:${r.reason}`)
    process.exit(2)
  }
  let hard = 0
  console.log(`建模 ${r.parsedCells}/${r.declaredCells} 格(取材面=${r.face},构建 CSS ${r.cssChunks} 枚)`)
  for (const [w, bad] of Object.entries(r.perWidth)) {
    const h = bad.filter((b) => b.kind === '实')
    const s = bad.filter((b) => b.kind !== '实')
    hard += h.length
    if (h.length === 0 && s.length === 0) {
      console.log(`  ✓ 容器宽 ${w}:全部读数单行且无溢出`)
      continue
    }
    if (h.length > 0) {
      console.log(`  ✗ 容器宽 ${w}:${h.length} 格按**实测量级**放不下`)
      for (const b of h)
        console.log(`      · [实] ${b.panel}:${b.line} ${b.label} 「${b.value}」 格宽 ${b.cellW} → ${b.wrapped ? '折行' : ''}${b.spill > 1.5 ? `溢出${b.spill}px` : ''}`)
    }
    if (s.length > 0) {
      console.log(`  ⚠ 容器宽 ${w}:${s.length} 格只在**保守上界**(999,999 等未实测位数)下放不下 ⇒ 报数不定红;要收口就往 WORST 里补实测量级`)
      for (const b of s.slice(0, 6))
        console.log(`      ≈ [保] ${b.panel}:${b.line} ${b.label} 「${b.value}」 格宽 ${b.cellW} → ${b.wrapped ? '折行' : ''}${b.spill > 1.5 ? `溢出${b.spill}px` : ''}`)
      if (s.length > 6) console.log(`      … 另有 ${s.length - 6} 条`)
    }
  }
  if (hard > 0) console.log(`  取证截图与建模页:${TMP}`)
  process.exit(hard === 0 ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  REPO_ROOT,
  TARGET_REL,
  WORST,
  worstReadout,
  extractAttr,
  unitLabel,
  parsePanels,
  buildDoc,
  MEASURE,
  selfTest,
  probeServer,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
