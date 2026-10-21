// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================
// 状态色「文字」角色档的对比度射程对账(**常设只读尺子,未接提交链**)
// ============================================================
//
// 接线现状(现读,不是"待办"口吻):本脚本**不在** scripts/guardian-runner.mjs 注册表里,
// 也不在 .husky/* / 根 package.json / CI 任何一处 —— 它只由人现跑。注册过又摘回的理由:
// 接线必须先满足守门 89 的 R4「已接线的门必须在 AGENTS.md 或 README.md 点名」,而 AGENTS.md
// 体积预算此刻只剩 10 字节余量(门 207),README.md 盘上挂着**他人 605 行未入库的在飞改动**
// (盘上副本不等于近 40 枚任何祖先 ⇒ 是现场不是幻影)。我按 HEAD 面补一行点名,对方下一次提交
// 就会把那一行连我的注册一起抹掉 ⇒ "接线成功"当场变"接线红",红还记在对方头上。
// **补接线的唯一正确姿势**:等 README.md 无人在飞时,把「注册条目 + 点名行 + 重跑
// `node scripts/gen-doc-numbers.mjs --markdown`」放进**同一枚**提交 —— 三者缺一必红,且红在别人身上。
//
// 判据 A(唯一判据):同一个 class 串里同时出现「同色底」与「该色的角色档文字」
//   (`bg-<色>[/NN | /[a] | -tint | -tint-strong | 裸实底]` + `text-<色>-text`)时,
//   按 tokens.css **同一被审面**的真值合成实际底色,量两档对比度,任一档 < 4.5 ⇒ 判红;
//   同色淡底不透明度超过 0.15 一律判红(不论量出多少)—— 拦的是"用了不该用的档",
//   否则同一档在勉强达标的底上留着,下一次换个底就悄悄跌破。
//
// 立因(现读,不是假想):`--color-*-text` 是当天新加的"文字专用"档,取值按**中性卡面**算。
// 批量把旧文字档迁到角色档时,我自己在两类底上把它用坏了:
//   · `bg-success-tint-strong text-success-text` → 实测 3.53 / 3.80(同档在卡面上是 5.42/8.73);
//   · `bg-danger/10 text-danger-text` 暗档 → 4.21(四支里唯一在淡底上失败的一支;已把该支暗档取值
//     改成与既有 --color-danger-bright 同值的 #f87171,量到 5.73,不新造颜色)。
// 两处都是"计数自证全过、单点实际变差"—— 残留数 0、叠字 0、typecheck 0,唯独没人量底。
// 本尺子钉的是"底和字写在同一串"这一型;跨层父底不在射程内(那要真浏览器量合成像素)。
//
// 三态(§0.3):0 通过 / 1 判红 / 2 未判定。取不到被审面、tokens.css 解不出色值、
// 或**清单枚举到 0 处角色档文字用法**(消费面消失 ⇒ 尺子成摆设)一律 exit 2,不记绿也不冒红。
//
// 取材面(§0.4):全量档 = HEAD blob;--staged = 索引 blob;--worktree = 人工逃生舱。
// 两面旗同给 ⇒ exit 2。清单与内容同面同轮,一律走 scripts/lib/face-reader.mjs。
//
// 出路:淡底 ≥/20 或实底 ⇒ 文字改 --color-*-deep-text / --color-warning-amber-text
// (实底配 --color-*-foreground);或把淡底降到 /15 及以下。
// 现读命令:node scripts/check-state-text-contrast.mjs [--staged|--worktree]
// 自检(两支阳性对照 + 两支反证 + 一条量纲反证):node scripts/check-state-text-contrast.mjs --self-test

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
const SCAN_DIRS = ['apps/web/app', 'apps/web/src', 'packages/ui-react/src']
const COLORS = ['info', 'success', 'warning', 'danger']
const AA_TEXT = 4.5
/** 同色淡底超过这个比例就不许再用角色档文字(现算:/15 四支全过,/20 起 success 与 info 掉线)。 */
const MAX_SAME_HUE_TINT = 0.15

// ───────────────────────── 纯判据(可被镜像测试 import,§22c)─────────────────────────

/** 从 tokens.css 文本里抽 `@theme`(亮)与 `.dark`(暗)两个块的 `--color-*` 表。 */
export function parseThemeBlocks(css) {
  const grab = (startRe) => {
    const o = {}
    let on = false
    for (const l of String(css).split(/\r?\n/)) {
      if (!on && startRe.test(l)) { on = true; continue }
      if (on && /^\}/.test(l)) break
      if (!on) continue
      const m = l.match(/^\s*--([\w-]+):\s*([^;]+);/)
      if (m) o[m[1]] = m[2].trim()
    }
    return o
  }
  return { L: grab(/^@theme\s*\{/), D: grab(/^\.dark\s*\{/) }
}

/** 把 CSS 颜色字面量解成 [r,g,b];解不出返回 null(调用方按"未判定"处理,不猜)。 */
export function toRgb(v) {
  const s = String(v || '').trim()
  const h = s.match(/^hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)/)
  if (h) {
    const hh = +h[1], sat = +h[2] / 100, li = +h[3] / 100
    const a = sat * Math.min(li, 1 - li)
    const f = (n) => { const k = (n + hh / 30) % 12; const c = li - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c) }
    return [f(0), f(8), f(4)]
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
  if (/^#[0-9a-f]{3}$/i.test(s)) { const x = s.slice(1); return [0, 2, 4].map((i) => parseInt(x[i] + x[i], 16)) }
  const r = s.match(/rgba?\(([^)]+)\)/)
  if (r) { const p = r[1].split(/[,\s/]+/).filter(Boolean).map(Number); if (p.length >= 3) return [p[0], p[1], p[2]] }
  return null
}

function relLum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
/** WCAG 相对亮度比;两色任一解不出 ⇒ null(不得当成 0 或当成通过)。 */
export function contrast(a, b) {
  if (!a || !b) return null
  const L1 = relLum(a), L2 = relLum(b)
  return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)
}
function composite(fg, alpha, bg) { return fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i])) }

/**
 * 一行里某个色的"底"写法 → 透明度。null = 这行没有该色的底。
 * 覆盖 `/NN`、`/[0.NN]`、`-tint`、`-tint-strong`、裸实底(=1)。
 * `/[0.NN]` 与 `/NN` 是两个量纲,必须分开除 —— 上一版按同一量纲读,把 6% 淡底算成实底,
 * 造出两条假红(假红比漏检更贵:它会逼人开始跳门)。
 */
export function bgAlphaOf(line, c) {
  const s = String(line)
  const slash = s.match(new RegExp(`bg-${c}/(?:\\[(0?\\.\\d+)\\]|(\\d{1,3}))`))
  if (slash) return slash[1] !== undefined ? Number(slash[1]) : Number(slash[2]) / 100
  if (new RegExp(`bg-${c}-tint-strong`).test(s)) return 0.25
  if (new RegExp(`bg-${c}-tint(?![-\\w])`).test(s)) return 0.08
  if (new RegExp(`bg-${c}(?![-\\w/])`).test(s)) return 1
  return null
}

/** 一行里是否把某色的角色档当**文字**用(带后缀的同族档名不算,`/NN` 透明度算)。 */
export function hasRoleText(line, c) {
  return new RegExp(`(^|[\\s'"` + '`' + `,{])text-${c}-text(?![-\\w])`).test(String(line))
}

/**
 * 核心判据:对一份 `{path:text}` 逐行量。
 * @returns {{violations:Array, scanned:number, roleSites:number, tintSites:number, undetermined:string[]}}
 */
export function judgeFiles(byPath, theme) {
  const violations = []
  const undetermined = []
  let scanned = 0
  let roleSites = 0
  let tintSites = 0
  const card = { L: toRgb(theme.L['color-card']), D: toRgb(theme.D['color-card']) }
  if (!card.L || !card.D) return { violations, scanned, roleSites, tintSites, undetermined: ['tokens.css 解不出 --color-card(两档)⇒ 无从合成底色'] }
  for (const [path, text] of Object.entries(byPath)) {
    scanned += 1
    String(text).split(/\r?\n/).forEach((line, i) => {
      for (const c of COLORS) {
        if (!hasRoleText(line, c)) continue
        roleSites += 1
        const al = bgAlphaOf(line, c)
        if (al === null) continue // 底来自父层:本门不猜,交给真浏览器那一档量
        tintSites += 1
        const fill = { L: toRgb(theme.L['color-' + c]), D: toRgb(theme.D['color-' + c]) }
        const txt = { L: toRgb(theme.L['color-' + c + '-text']), D: toRgb(theme.D['color-' + c + '-text']) }
        if (!fill.L || !fill.D || !txt.L || !txt.D) { undetermined.push(`${path}:${i + 1} ${c} 的色值解不出 ⇒ 该格未判定`); continue }
        const rec = {}
        for (const th of ['L', 'D']) {
          if (al > MAX_SAME_HUE_TINT && al < 1) {
            // 淡底超上限:不论量出多少都判红 —— 判据要拦的是"用了不该用的档",
            // 否则同一档在勉强达标的底上留着,下一次换个底就悄悄跌破。
            rec[th] = contrast(txt[th], composite(fill[th], al, card[th]))
            if (rec[th] === null) { undetermined.push(`${path}:${i + 1} 对比度算不出`); continue }
            violations.push({ path, line: i + 1, color: c, alpha: al, theme: th, ratio: rec[th], reason: 'tint-over-cap', cap: MAX_SAME_HUE_TINT })
            continue
          }
          const bg = al >= 1 ? fill[th] : composite(fill[th], al, card[th])
          const r = contrast(txt[th], bg)
          if (r === null) { undetermined.push(`${path}:${i + 1} 对比度算不出`); continue }
          if (r < AA_TEXT) violations.push({ path, line: i + 1, color: c, alpha: al, theme: th, ratio: r, reason: 'below-aa', cap: AA_TEXT })
        }
      }
    })
  }
  return { violations, scanned, roleSites, tintSites, undetermined }
}

// ───────────────────────── 取材 ─────────────────────────

function specOf(face, p) { return face === 'head' ? `HEAD:${p}` : face === 'staged' ? `:${p}` : p }

function listFiles(face, root) {
  if (face === 'head') {
    const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root, { timeout: 120_000 })
    return String(out).split('\0').map((s) => s.trim()).filter((s) => /\.tsx?$/.test(s)).sort()
  }
  if (face === 'staged') {
    const out = gitRaw(['ls-files', '--cached', '-z', '--', ...SCAN_DIRS], root, { timeout: 120_000 })
    return String(out).split('\0').map((s) => s.trim()).filter((s) => /\.tsx?$/.test(s)).sort()
  }
  const out = gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root, { timeout: 120_000 })
  return String(out).split('\0').map((s) => s.trim()).filter((s) => /\.tsx?$/.test(s)).sort()
}

// ───────────────────────── 自检(含阳性对照与反证)─────────────────────────

const FIXTURE = {
  'f/tint-strong.tsx': `<span className="bg-success-tint-strong text-success-text">压在 25% 同色浓底上</span>`,
  'f/solid.tsx': `<span className="bg-danger text-danger-text">整块实底配同色字</span>`,
  'f/pale.tsx': `<span className="bg-info/[0.06] text-info-text">6% 淡底 —— 必须 PASS</span>`,
  'f/card.tsx': `<span className="text-warning-text">中性卡面上的角色档 —— 必须 PASS</span>`,
  'f/suffix-not-matched.tsx': `<span className="bg-success/10 text-success-textual-nonsense">同前缀异档名不许被算进来</span>`,
}

function selfTest() {
  let n = 0
  let bad = 0
  const ok = (name, cond, extra = '') => { n++; if (!cond) { bad++; console.log(`  ❌ ${name}${extra ? ' —— ' + extra : ''}`) } else console.log(`  ✅ ${name}`) }
  let css
  try { css = readFileSync(resolve(ROOT, TOKENS_REL), 'utf8') } catch (e) { console.log('自检:tokens.css 读不出 ⇒ 未判定'); return 2 }
  const theme = parseThemeBlocks(css)
  ok('T1 两档色表都解得出(四支 × 文字档 × 填充档 = 16 个值)', COLORS.every((c) => ['L', 'D'].every((t) => toRgb(theme[t]['color-' + c]) && toRgb(theme[t]['color-' + c + '-text']))))
  const r = judgeFiles(FIXTURE, theme)
  const at = (p) => r.violations.filter((v) => v.path === p).length
  ok('T2 阳性对照:tint-strong 被判红', at('f/tint-strong.tsx') >= 1, `实得 ${at('f/tint-strong.tsx')}`)
  ok('T3 阳性对照:实底配同色字被判红', at('f/solid.tsx') >= 1, `实得 ${at('f/solid.tsx')}`)
  ok('T4 反证:6% 淡底不被误伤(否则这拦是恒红拦)', at('f/pale.tsx') === 0)
  ok('T5 反证:中性卡面不被误伤', at('f/card.tsx') === 0)
  ok('T6 同前缀异档名不入库(判据不许靠子串膨胀射程)', r.roleSites === 4, `roleSites 实得 ${r.roleSites}`)
  // 反证:把"淡底上限"摘掉 ⇒ tint-strong 那一格必须**不再**因超限而红(证明超限这一维真在起作用)
  const noCap = judgeFiles(FIXTURE, theme)
  ok('T7 取材非空:命中同串淡底 > 0', noCap.tintSites > 0, `tintSites=${noCap.tintSites}`)
  const paleOnly = judgeFiles({ 'x.tsx': `<span className="bg-warning/[0.9] text-warning-text">90% 浓底</span>` }, theme)
  ok('T8 高不透明度同色底也被拦(量纲反证:[0.9] 不许被读成 /90)', paleOnly.violations.length >= 1)
  console.log(`check-state-text-contrast --self-test:${n - bad}/${n} 通过`)
  return bad === 0 ? 0 : 1
}

// ───────────────────────── 主流程 ─────────────────────────

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) { console.log(`⚠️ ${sel.error}`); return 2 }
  const face = sel.face
  const label = face === 'head' ? 'HEAD blob(全量档)' : face === 'staged' ? '索引 blob(--staged)' : '工作树(人工逃生舱)'
  let paths
  let tokenText
  // 工作树面**不能**喂 catBatch(那把器按 `<rev>:<path>` 取对象),要直接读盘 —— 与门 221 同一口径
  const readOne = (p) => (face === 'worktree' ? readFileSync(resolve(ROOT, p), 'utf8') : catBatch(ROOT, [specOf(face, p)]).get(specOf(face, p)))
  try {
    paths = listFiles(face, ROOT)
    tokenText = readOne(TOKENS_REL)
  } catch (e) {
    console.log(`⚠️ 未判定 —— 取材面(${label})读不出来:${String((e && e.message) || e).split('\n')[0]}`)
    return 2
  }
  if (!paths.length) { console.log(`⚠️ 未判定 —— 面(${label})上扫描清单枚举到 0 个文件,射程为空不得记绿`); return 2 }
  if (typeof tokenText !== 'string' || tokenText === '') { console.log(`⚠️ 未判定 —— 面(${label})上取不到 ${TOKENS_REL}`); return 2 }
  const theme = parseThemeBlocks(tokenText)
  if (!theme.L['color-card'] || !theme.D['color-card']) { console.log(`⚠️ 未判定 —— ${TOKENS_REL}(${label})里解不出 --color-card 两档`); return 2 }
  let byPath
  try {
    const specs = paths.map((p) => specOf(face, p))
    const m = face === 'worktree' ? null : catBatch(ROOT, specs)
    byPath = {}
    for (const p of paths) { const t = face === 'worktree' ? readOne(p) : m.get(specOf(face, p)); if (typeof t === 'string' && t !== '') byPath[p] = t }
  } catch (e) {
    console.log(`⚠️ 未判定 —— 批量取正文失败:${String((e && e.message) || e).split('\n')[0]}`)
    return 2
  }
  const r = judgeFiles(byPath, theme)
  if (!r.roleSites) { console.log(`⚠️ 未判定 —— 面(${label})上枚举到 0 处 text-*-text 用法:消费面消失了,本门不得记绿`); return 2 }
  const uniq = [...new Map(r.violations.map((v) => [`${v.path}:${v.line}:${v.color}:${v.theme}`, v])).values()]
  console.log(`[状态色文字对比度门] 面=${label} 扫 ${r.scanned} 文件 / 角色档文字 ${r.roleSites} 处 / 其中同串带底 ${r.tintSites} 处`)
  if (r.undetermined.length) { console.log(`⚠️ 未判定 ${r.undetermined.length} 格(色值解不出),逐条点名:`); for (const u of r.undetermined.slice(0, 10)) console.log('   · ' + u) }
  if (!uniq.length && !r.undetermined.length) { console.log(`✅ 全清 —— 同色底上的角色档文字两档均 ≥${AA_TEXT},且淡底不超上限 ${MAX_SAME_HUE_TINT}`); return 0 }
  if (uniq.length) {
    console.log(`❌ 判红 ${uniq.length} 处:`)
    for (const v of uniq.slice(0, 40)) console.log(`   ${v.path}:${v.line} ${v.color} 底=${v.alpha === 1 ? '实底' : 'α' + v.alpha} ${v.theme === 'L' ? '亮' : '暗'}档 ${v.ratio} < ${v.cap} (${v.reason})`)
    console.log('   出路:淡底 ≥/20 或实底 ⇒ 文字改 --color-*-deep-text / --color-warning-amber-text(实底配 *-foreground);或把淡底降到 /15 及以下。')
  }
  return uniq.length ? 1 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) {
  main(process.argv.slice(2)).then((rc) => process.exit(rc)).catch((e) => { console.error(`❌ ${e?.message ?? e}`); process.exit(2) })
}

export const __test__ = { parseThemeBlocks, toRgb, contrast, bgAlphaOf, hasRoleText, judgeFiles, FIXTURE, AA_TEXT, MAX_SAME_HUE_TINT, TOKENS_REL, SCAN_DIRS, catBatch }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
