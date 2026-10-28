#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 量算仪为 CLI 工具,需 console 输出读数 */
/**
 * 渲染态分割线量算仪 — 量"屏幕上真有一条线",不判源码里怎么写。
 *
 * 立因(2026-10-23):`scripts/check-no-divider.mjs` 是**字面量形状门**,它按单行 class 词元判,
 * 于是这些写法它天生看不见:跨行拼的 `cn('border-b',\n 'border-border/40')`、CSS/WXSS 文件里的
 * `border-bottom:1px`、RN 的 `borderBottomWidth` + 分隔组件、第三方 `Separator`/`Divider`、
 * 以及任何"用背景色画一条 1px"的做法。当天静态门报"存量 0",而无头浏览器在**同一个源站**上
 * 仍能量到单边实线 —— 这就是"规范禁 X 但门看不见 X"。
 *
 * 本器不读源码,只读**渲染结果**:遍历页面元素,量四条边的实际宽度与颜色,以及"细条状背景块"。
 * 判据与静态门同一套结构性出口(整圈边框 / 粗边 ≥2px / 非中性色 / 同格横+竖 / 竖边+同轴缩进),
 * 差别在于这里全部用 **computed style 的几何量**判,不认 class 名。
 *
 * 两族探测器:
 *   border-hairline —— 四条边里恰好一条有实际宽度(单边实线);
 *   bg-hairline     —— 短边 ≤2.5px、长边 ≥24px 的细条状可见块(背景色画的线,含 Separator 一族)。
 *
 * 定位:**只读量算仪,不进提交链、不进 CI 门禁**(§12e —— 它对"页面此刻长什么样"敏感,
 * 把机器态/网络态当判红依据就是恒红门的生产线)。用法与告警接入见 `--report` 输出末行。
 *
 * 用法:
 *   node scripts/rendered-divider-report.mjs                       默认打源站(绕开边缘缓存)
 *   node scripts/rendered-divider-report.mjs --base https://…      打公网(含边缘缓存收敛态)
 *   node scripts/rendered-divider-report.mjs --routes /,/agents    指定路由
 *   node scripts/rendered-divider-report.mjs --json                机器可读结论
 *   node scripts/rendered-divider-report.mjs --self-test           判据自检(合成几何量,不依赖浏览器)
 *
 * 退出码:0 = 未量到线;1 = 量到线;2 = 未判定(浏览器取不到 / 路由全部打不开)。**取不到不记绿**(§0.3)。
 */
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { loadPageList } from './warm-prod-cache.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_BASE = process.env.IHUI_RENDER_CHECK_BASE || 'http://127.0.0.1:8801'
/** 默认路由 = 边缘缓存清单里那批公开页(与 warm-prod-cache 同一份输入,§0.6 不另起一份清单) */
const FALLBACK_ROUTES = ['/', '/agents', '/pricing', '/docs']

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d, noun = '参数') => {
  const r = requireFlagValue(argv, f, { noun, fallback: d })
  if (r.error) {
    console.error(`❌ 用法错:${r.error}`)
    process.exit(2)
  }
  return r.value
}

// ───────────────────────────── 判据(纯函数,几何量进、结论出) ─────────────────────────────

/** 中性描边:亮档灰阶 / 暗档灰阶。彩色(含 accent/primary/info 与任何非灰)一律算强调条,不算分隔线。 */
export function isNeutralInk(color) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(
    String(color || ''),
  )
  if (!m) return false
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const a = m[4] === undefined ? 1 : Number(m[4])
  if (a < 0.05) return false // 全透明 = 没画
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min <= 12 // 灰阶判据:通道互差不超过 12
}

/**
 * 一条渲染后的盒子 → 违规结论或 null。
 * @param {{borderWidths:number[], borderColors:string[], marginLeft:number, marginRight:number,
 *          paddingLeft:number, paddingRight:number, width:number, height:number, childCount:number,
 *          backgroundColor?:string, tag?:string}} box
 * @returns {{kind:string, side?:string, detail:string}|null}
 */
export function judgeRenderedBox(box) {
  const w = box.borderWidths || [0, 0, 0, 0]
  const sides = ['top', 'right', 'bottom', 'left']
  const nz = w.map((x, i) => ({ x, i })).filter((e) => e.x > 0)

  if (nz.length === 1) {
    const { x, i } = nz[0]
    const side = sides[i]
    const color = box.borderColors?.[i]
    if (!isNeutralInk(color)) return null // 彩色 = 强调
    if (x >= 2) return null // 粗边 = 强调条 / 选中下划线
    const horiz = side === 'top' || side === 'bottom'
    // 整圈边框系统的一格:对边也有内容(哪怕宽度被 computed 归到 0 之前的其它写法)不在此判,
    // 这里只可能 nz===1,故整圈已被排除。
    if (!horiz) {
      // 缩进轨(引用块左条 / 树形导引线):竖边 + 同轴"推离基准 + 内容导流"两个几何量都在场
      const margin = side === 'left' ? box.marginLeft : box.marginRight
      const pad = side === 'left' ? box.paddingLeft : box.paddingRight
      if (margin > 0 && pad > 0) return null
    }
    return {
      kind: 'border-hairline',
      side,
      detail: `${side} ${x}px ${color}`,
    }
  }

  if (nz.length === 2) {
    // 横竖各一 = 网格/箱体收口(课程表每格自画 bottom+right),不是两块内容之间的一条线
    const set = new Set(nz.map((e) => sides[e.i]))
    const hasH = set.has('top') || set.has('bottom')
    const hasV = set.has('left') || set.has('right')
    if (hasH && hasV) return null
    // 同向两条(上下各一条)= 两条分隔线,照判
    return { kind: 'border-double', detail: [...set].join('+') }
  }

  // 背景色画的细条(Separator / Divider 一族)。阈值按 2026-10-23 首跑实测收紧:
  //   · 短边 ≤2.5px 是"线"的厚度档;
  //   · 长边 ≥64px 才叫"横跨布局"—— 首跑误伤的两型都短于此:`w-[2px] h-7 animate-pulse`
  //     的文字光标(2×28)与 `h-px w-8 bg-border` 的装饰短横(32×1),它们不是两块内容之间的线;
  //   · 必须无子元素 —— 有内容的窄条是布局列/进度槽,不是线。
  const short = Math.min(box.width, box.height)
  const long = Math.max(box.width, box.height)
  if (
    short > 0 &&
    short <= 2.5 &&
    long >= 64 &&
    box.childCount === 0 &&
    isNeutralInk(box.backgroundColor)
  ) {
    return {
      kind: 'bg-hairline',
      detail: `${box.width.toFixed(0)}x${box.height.toFixed(0)} bg=${box.backgroundColor}`,
    }
  }
  return null
}

// ───────────────────────────── 自检(合成几何量,不依赖浏览器) ─────────────────────────────

export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const ok = (c, m) => {
    if (!c) throw new Error(m || '断言不成立')
  }
  const GRAY = 'rgb(229, 229, 229)'
  const box = (o) => ({
    borderWidths: [0, 0, 0, 0],
    borderColors: ['transparent', 'transparent', 'transparent', 'transparent'],
    marginLeft: 0,
    marginRight: 0,
    paddingLeft: 0,
    paddingRight: 0,
    width: 300,
    height: 100,
    childCount: 0,
    backgroundColor: 'rgba(0,0,0,0)',
    ...o,
  })

  t('R01 单边中性 1px ⇒ border-hairline(四边各一例)', () => {
    const names = ['top', 'right', 'bottom', 'left']
    for (let i = 0; i < 4; i++) {
      const w = [0, 0, 0, 0]
      w[i] = 1
      const r = judgeRenderedBox(box({ borderWidths: w, borderColors: fill(w, GRAY) }))
      ok(r && r.kind === 'border-hairline' && r.side === names[i], JSON.stringify(r))
    }
  })
  t('R02 彩色 1px 边 ⇒ 放过(强调)', () => {
    const r = judgeRenderedBox(
      box({ borderWidths: [0, 0, 1, 0], borderColors: fill([0, 0, 1, 0], 'rgb(59,130,246)') }),
    )
    ok(r === null, JSON.stringify(r))
  })
  t('R03 粗边 2px ⇒ 放过(选中下划线)', () => {
    const r = judgeRenderedBox(
      box({ borderWidths: [0, 0, 2, 0], borderColors: fill([0, 0, 2, 0], GRAY) }),
    )
    ok(r === null, JSON.stringify(r))
  })
  t('R04 缩进轨:竖边 + 同轴 margin 与 padding 都在场 ⇒ 放过', () => {
    const r = judgeRenderedBox(
      box({
        borderWidths: [0, 0, 0, 1],
        borderColors: fill([0, 0, 0, 1], GRAY),
        marginLeft: 16,
        paddingLeft: 8,
      }),
    )
    ok(r === null, JSON.stringify(r))
  })
  t('R05 反向对照:缩进轨缺任一半 ⇒ 照判(不能靠加 padding 遮红)', () => {
    const only = judgeRenderedBox(
      box({ borderWidths: [0, 0, 0, 1], borderColors: fill([0, 0, 0, 1], GRAY), marginLeft: 16 }),
    )
    const onlyPad = judgeRenderedBox(
      box({ borderWidths: [0, 0, 0, 1], borderColors: fill([0, 0, 0, 1], GRAY), paddingLeft: 8 }),
    )
    ok(
      only?.kind === 'border-hairline' && onlyPad?.kind === 'border-hairline',
      JSON.stringify([only, onlyPad]),
    )
  })
  t('R06 横边不享受缩进轨出口', () => {
    const r = judgeRenderedBox(
      box({
        borderWidths: [0, 0, 0, 0],
        borderColors: fill([1, 0, 0, 0], GRAY),
        marginTop: 0,
        marginBottom: 0,
      }),
    )
    const top = judgeRenderedBox(
      box({
        borderWidths: [1, 0, 0, 0],
        borderColors: fill([1, 0, 0, 0], GRAY),
        marginLeft: 16,
        paddingLeft: 8,
      }),
    )
    ok(r === null, JSON.stringify(r))
    ok(top?.kind === 'border-hairline', JSON.stringify(top))
  })
  t('R07 网格收口:横竖各一边 ⇒ 放过', () => {
    const r = judgeRenderedBox(
      box({ borderWidths: [0, 1, 1, 0], borderColors: fill([0, 1, 1, 0], GRAY) }),
    )
    ok(r === null, JSON.stringify(r))
  })
  t('R08 同向两条 ⇒ border-double(两条线不是一条)', () => {
    const r = judgeRenderedBox(
      box({ borderWidths: [1, 0, 1, 0], borderColors: fill([1, 0, 1, 0], GRAY) }),
    )
    ok(r && r.kind === 'border-double', JSON.stringify(r))
  })
  t('R09 背景画的细条 ⇒ bg-hairline;阈值取"横跨布局"(2026-10-23 首跑实测定)', () => {
    const line = judgeRenderedBox(box({ width: 320, height: 1, backgroundColor: GRAY }))
    ok(line?.kind === 'bg-hairline', JSON.stringify(line))
    // 首跑真误伤过的两型,现在必须放过:
    const caret = judgeRenderedBox(
      box({ width: 2, height: 28, backgroundColor: 'rgb(10, 10, 10)' }),
    ) // 文字光标
    const dash = judgeRenderedBox(box({ width: 32, height: 1, backgroundColor: GRAY })) // 装饰短横
    ok(caret === null && dash === null, JSON.stringify([caret, dash]))
    const card = judgeRenderedBox(box({ width: 320, height: 120, backgroundColor: GRAY }))
    const slot = judgeRenderedBox(
      box({ width: 320, height: 1, childCount: 3, backgroundColor: GRAY }),
    )
    ok(card === null && slot === null, JSON.stringify([card, slot]))
  })
  t('R10 中性色判据:灰阶放过彩色;全透明不算画', () => {
    ok(isNeutralInk(GRAY) && isNeutralInk('rgb(26, 26, 26)'))
    ok(!isNeutralInk('rgb(59,130,246)'))
    ok(!isNeutralInk('rgba(229,229,229,0)'))
    ok(!isNeutralInk('transparent'))
  })
  t('R11 形状锁:整圈四边都不算违规', () => {
    const r = judgeRenderedBox(
      box({ borderWidths: [1, 1, 1, 1], borderColors: fill([1, 1, 1, 1], GRAY) }),
    )
    ok(r === null, JSON.stringify(r))
  })

  let pass = 0
  const lines = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      lines.push(`  ✅ ${c.name}`)
    } catch (e) {
      lines.push(`  ❌ ${c.name} — ${e?.message ?? e}`)
    }
  }
  console.log(lines.join('\n'))
  console.log(`\n渲染态分割线量算仪自检: ${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

function fill(widths, color) {
  return widths.map((w) => (w > 0 ? color : 'transparent'))
}

// ───────────────────────────── 浏览器侧取材 ─────────────────────────────

/** 页内探针:只回几何量与颜色,判据一律留在 Node 侧(判据单源,不在浏览器里复算一份) */
const PROBE = `(() => {
  const out = []
  const iv = window.innerHeight || 900
  const nodes = document.querySelectorAll('body *')
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (r.bottom < -iv || r.top > iv * 6) continue
    const s = getComputedStyle(el)
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120),
      testid: el.getAttribute('data-testid') || '',
      role: el.getAttribute('role') || '',
      childCount: el.childElementCount,
      width: +r.width.toFixed(2),
      height: +r.height.toFixed(2),
      borderWidths: ['Top','Right','Bottom','Left'].map((k) => parseFloat(s['border'+k+'Width']) || 0),
      borderColors: ['Top','Right','Bottom','Left'].map((k) => s['border'+k+'Color']),
      marginLeft: parseFloat(s.marginLeft) || 0,
      marginRight: parseFloat(s.marginRight) || 0,
      paddingLeft: parseFloat(s.paddingLeft) || 0,
      paddingRight: parseFloat(s.paddingRight) || 0,
      backgroundColor: s.backgroundColor,
    })
  }
  return out
})()`

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || 'D:\\DevEnv\\cache\\playwright'
  if (!existsSync(root)) return null
  const cands = []
  for (const d of readdirSync(root)) {
    if (!/^chromium-/.test(d)) continue
    for (const p of [
      join(root, d, 'chrome-win64', 'chrome.exe'),
      join(root, d, 'chrome-win', 'chrome.exe'),
    ]) {
      if (existsSync(p)) cands.push(p)
    }
  }
  cands.sort()
  return cands.length ? cands[cands.length - 1] : null
}

function loadPlaywright() {
  const base = join(ROOT, 'node_modules', '.pnpm')
  if (!existsSync(base)) return null
  const pkg = readdirSync(base).find((d) => /^playwright-core@/.test(d))
  if (!pkg) return null
  const req = createRequire(join(ROOT, 'package.json'))
  try {
    return req(`D:/IHUI-AI/node_modules/.pnpm/${pkg}/node_modules/playwright-core/index.js`)
  } catch {
    return null
  }
}

/** 与 warm-prod-cache 同一份输入:边缘缓存清单里的公开页 ⇒ 不另起一份路由清单(§0.6) */
function defaultRoutes() {
  try {
    const urls = loadPageList()?.urls
    if (Array.isArray(urls) && urls.length > 0) {
      const paths = urls
        .map(
          (u) =>
            String(u)
              .replace(/^https?:\/\/[^/]+/, '')
              .split('?')[0],
        )
        .filter((p) => p.startsWith('/'))
      if (paths.length > 0) return paths
    }
  } catch {
    /* 取不到清单 ⇒ 回落固定公开页集合,下面结论行会点名用的是回落 */
  }
  return FALLBACK_ROUTES
}

async function main() {
  if (has('--self-test')) return selfTest()
  const base = val('--base', DEFAULT_BASE)
  const routes = val('--routes', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const list = routes.length ? routes : defaultRoutes()
  const json = has('--json')
  const executablePath = findChromium()
  const pw = loadPlaywright()
  if (!executablePath || !pw) {
    console.log(
      `UNJUDGED reason=chromium-or-playwright-missing exec=${!!executablePath} pw=${!!pw}`,
    )
    return 2
  }
  const { chromium } = pw
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] })
  const perRoute = []
  let opened = 0
  try {
    for (const route of list) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      let boxes
      try {
        await page.goto(base + route, {
          waitUntil: 'networkidle',
          timeout: Number(val('--timeout', 60000)),
        })
        boxes = await page.evaluate(PROBE)
        opened++
      } catch (e) {
        perRoute.push({ route, error: String(e?.message ?? e).slice(0, 120), hits: [] })
        await page.close()
        continue
      }
      const hits = []
      for (const b of boxes) {
        const v = judgeRenderedBox(b)
        if (v)
          hits.push({
            ...v,
            tag: b.tag,
            cls: b.cls,
            testid: b.testid,
            role: b.role,
            w: b.width,
            h: b.height,
          })
      }
      perRoute.push({ route, scanned: boxes.length, hits })
      await page.close()
    }
  } finally {
    await browser.close()
  }

  const total = perRoute.reduce((a, r) => a + (r.hits?.length || 0), 0)
  const failed = perRoute.filter((r) => r.error).length
  const state = opened === 0 ? 'undetermined' : total === 0 ? 'clean' : 'found'
  if (json) {
    console.log(
      JSON.stringify(
        { state, base, routes: list.length, opened, failed, total, perRoute },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `渲染态分割线量算仪  base=${base}  路由=${list.length} 打开=${opened} 失败=${failed}`,
    )
    for (const r of perRoute) {
      if (r.error) {
        console.log(`  ${r.route} → 打不开:${r.error}`)
        continue
      }
      console.log(`  ${r.route}  量了 ${r.scanned} 个盒子,线 ${r.hits.length} 条`)
      for (const h of r.hits.slice(0, Number(val('--limit', 12)))) {
        console.log(
          `      [${h.kind}] ${h.detail}  <${h.tag}${h.testid ? ' data-testid=' + h.testid : ''}${h.role ? ' role=' + h.role : ''}> ${h.cls.slice(0, 70)}`,
        )
      }
    }
    console.log(`\n结论:state=${state} total=${total} opened=${opened}/${list.length}`)
    if (state === 'found') {
      console.log(
        '  注意:本器只读不判红(§12e)。要按路由升门禁,须先把 total 清到 0 再挂 baseline 差值档。',
      )
    }
  }
  if (state === 'undetermined') return 2
  return state === 'found' ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.log(`UNJUDGED reason=throw message=${String(e?.message ?? e).slice(0, 160)}`)
      process.exit(2)
    })
}

export const __test__ = { judgeRenderedBox, isNeutralInk, selfTest, PROBE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
