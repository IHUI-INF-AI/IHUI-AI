// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端 UI 差异账 —— 回答一个问题:"小程序端和 RN 端这同一枚组件,长得一样吗?"
//
//   V1 可见几何档不同:两端各自的数字/类名档全部归一到 px 再比集合 —— 这就是用户看到的那一处不一样。
//   S1 同名组件两端各有一份实现:这才是"改一端、另一端不自动同步"的结构性根因,所以它单独计数报出。
//
// 样式语言(className vs StyleSheet)与 props 命名只随读数打印 —— 它们是 S1 的证据,不是观感本身。
//
// 判定面与守门 77/83/93/98/103 同形:全量判 HEAD blob、--staged 判索引 blob、两面旗同给判死、
// 清单与正文**同面同轮**取;任一面取不到 ⇒ exit 2「无法判定」,不回落另一个面(回落就是把"没判"
// 写成"判过了")。刻意不开 --worktree 档:共享工作树常年滞后 HEAD,按磁盘判会在恒红与假绿之间来回跳,
// 并把错数写回棘轮台账(守门 83 的 R3 登记一天内被整文件回退三次即此型)。
//
// 定级:棘轮 blocking(锚点 = 台账里钉住的 HEAD 读数,只拦"把两端差异加大")。
// 为什么不是"当场全红 blocking":立项实测同名配对 19 对、其中 17 对有可见几何差异。与本次改动无关的
// 恒红门,唯一结局是逼人 --no-verify,一次绕过等于当天全部守门作废(§12e 实测型)。
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 两端的组件面。RN 侧**两层都扫**:`packages/app`(共享屏层)+ `apps/mobile-rn/src/components`
 * (端内自绘层)。只扫一层会漏判 —— 小程序组件若只与端内层同名,只扫共享层就把它算成"仅小程序",
 * 而那正应当被收进"两端同源"的目标形态。同名多命中时取排序靠前的层(共享层优先)。
 */
const SIDES = {
  miniapp: ['apps/miniapp-taro/src/components'],
  rn: ['packages/app/src/components', 'apps/mobile-rn/src/components'],
}
/** 一个逻辑 px 折成该端单位要乘多少:小程序 750 设计宽 / 375pt ⇒ 2;RN 1:1。反向即除。 */
const TO_PX = { miniapp: 2, rn: 1 }

const BASELINE_REL = 'scripts/cross-end-ui-parity-baseline.json'
/** 落在这些键/标识符上下文里的数字才算"看得见的尺寸"。 */
const GEO_KEY =
  /(size|width|height|box|icon|padding|margin|font|line|gap|radius|top|bottom|left|right|thickness|spacing|edge)/i
/**
 * 必须先过这道否定筛:GEO_KEY 的 `font` 会命中 `fontWeight: 700`、`line` 命中 `lineCount`、
 * `size` 命中 `pageSize`。不排就是拿字重当尺寸判差异 —— 噪音尺与静默尺同样没用。
 */
const NON_GEO_KEY =
  /(weight|opacity|zindex|z-index|duration|delay|easing|alpha|percent|ratio|count|index|version|iteration|order|priority|limit|timeout|timestamp|revision|level|depth|page)/i
const TW_SPACING_PX = (n) => n * 4
const TW_FONT_PX = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }
/** 超过此值的"尺寸"不是组件几何(屏宽 / 动画毫秒 / 密度),不判。 */
const MAX_GEO_PX = 1200

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="w-[72rpx]"` 一起抹掉
 * (判据失明),留注释会把说明性数字喂进判据(假阳)。
 */
export function stripComments(src) {
  let out = ''
  let mode = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line'
        i++
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i++
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        mode = 'str'
        quote = c
      }
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      }
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i++
      }
      continue
    }
    if (c === '\\') {
      out += c + (n ?? '')
      i++
      continue
    }
    out += c
    if (c === quote) {
      mode = 'code'
      quote = ''
    }
  }
  return out
}

const round = (n) => Math.round(n * 100) / 100

/** 原始数字 → px。带 rpx 后缀除 2;小程序端裸数字按该端量纲即 rpx,故同样折算。 */
export function toPx(raw, unit, side) {
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) return null
  const isRpx = unit === 'rpx' || (unit === undefined && side === 'miniapp')
  const px = round(isRpx ? v / TO_PX.miniapp : v)
  return px > MAX_GEO_PX ? null : px
}

/** 这些档**不归本门判**:圆角有守门 77 的单一源,在此重复问责会造出两台尺子互相指认。 */
const RADIUS_FORM_RE = /rounded|radius|cornerradius|border-radius/i

/**
 * 一个文件 → 归一后的几何档集合 + 具名常量表。纯函数:自检钉的是它,不是打印。
 */
export function readGeometry(src, side) {
  const code = stripComments(src)
  const named = {}
  const values = new Set()
  const push = (px) => {
    if (px !== null && px !== undefined) values.add(px)
  }
  const keyed = (name) => GEO_KEY.test(name) && !NON_GEO_KEY.test(name) && !RADIUS_FORM_RE.test(name)

  for (const m of code.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+(?:\.\d+)?)(?![\w.])/g)) {
    if (!keyed(m[1])) continue
    const px = toPx(m[2], undefined, side)
    named[m[1]] = px
    push(px)
  }
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*[:=]\s*(\d+(?:\.\d+)?)(rpx|px)?(?![\w.])/g)) {
    if (!keyed(m[1])) continue
    push(toPx(m[2], m[3], side))
  }
  for (const m of code.matchAll(/\brpx\(\s*(\d+(?:\.\d+)?)\s*\)/g)) push(toPx(m[1], 'rpx', side))
  for (
    const m of code.matchAll(
      /(?:^|[\s"'`])(?:size|gap|p|m|px|py|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g,
    )
  )
    push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(/(?:^|[\s"'`])([hw])-([0-9]+(?:\.[0-9]+)?)(?=$|[\s"'`/:])/g))
    push(round(TW_SPACING_PX(Number(m[2]))))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g)) push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-(xs|sm|base|lg|xl|2xl|3xl)(?=$|[\s"'`/:])/g))
    push(TW_FONT_PX[m[1]] ?? null)
  for (const m of code.matchAll(/\bsize=\{(\d+(?:\.\d+)?)\}/g)) push(toPx(m[1], undefined, side))
  return { values, named }
}

/**
 * 同名常量两侧折成 px 后仍不等 ⇒ 手抄档漂移的确证。
 * 立论实例:两份自称"唯一实现"的 BackChevron,图标墨迹小程序 40rpx=20px、RN 写 22 —— 差 2px,
 * 而两端注释里都写着"与 web 同档"。散文承诺挡不住手抄。
 */
export function namedConflicts(a, b) {
  const out = []
  for (const [k, v] of Object.entries(a)) {
    const w = b[k]
    if (w !== undefined && v !== undefined && round(v) !== round(w)) out.push(`${k}: miniapp=${v} rn=${w}`)
  }
  return out.sort()
}

export function diffValues(mini, rn) {
  const only = (x, y) => [...x].filter((v) => !y.has(v)).sort((p, q) => p - q)
  return { onlyMiniapp: only(mini, rn), onlyRn: only(rn, mini) }
}

const fileName = (f) => f.split('/').pop()
const normKey = (file) =>
  fileName(file)
    .replace(/\.(tsx|jsx|ts|js)$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
const nameOf = (file) => fileName(file).replace(/\.[^.]+$/, '')

/** 两端清单 → 同名配对 + 计数。纯函数,构造面即可证明后缀与优先级两条判据。 */
export function scan(listMini, listRn) {
  const rnMap = new Map()
  for (const f of listRn) {
    if (!/\.(tsx|jsx)$/i.test(fileName(f))) continue
    const k = normKey(f)
    if (!rnMap.has(k)) rnMap.set(k, f) // 排序靠前的层优先(共享层在前)
  }
  const miniMap = new Map()
  for (const f of listMini) {
    if (!/\.(tsx|jsx)$/i.test(fileName(f))) continue
    if (!miniMap.has(normKey(f))) miniMap.set(normKey(f), f)
  }
  const pairs = []
  for (const [k, f] of miniMap) if (rnMap.has(k)) pairs.push({ name: nameOf(f), miniapp: f, rn: rnMap.get(k) })
  const out = {
    pairs: pairs.sort((a, b) => a.name.localeCompare(b.name)),
    onlyMiniapp: [...miniMap.keys()].filter((k) => !rnMap.has(k)).length,
    onlyRn: [...rnMap.keys()].filter((k) => !miniMap.has(k)).length,
    miniappCount: miniMap.size,
    rnCount: rnMap.size,
  }
  // 空扫就是本门要防的那一型故障(判据看不见 ⇒ 一路绿灯)。宁判死,不记通过。
  if (out.miniappCount === 0 || out.rnCount === 0)
    return { ...out, undetermined: true, reason: `组件面枚举为空(小程序 ${out.miniappCount} / RN ${out.rnCount})` }
  return { ...out, undetermined: false, reason: null }
}

export function styleLanguage(src) {
  const code = stripComments(src)
  const sheet = /StyleSheet\.create\(/.test(code)
  const cls = /\bclassName\s*=/.test(code)
  if (sheet && cls) return 'mixed'
  if (sheet) return 'stylesheet'
  if (cls) return 'className'
  return 'none'
}

/** 图标载体:素材源不同则同一枚箭头的墨迹不可能逐位相同(端内 SVG 由 gen-taro-lucide-icons 从 lucide 提取)。 */
export function iconCarriers(src) {
  const out = new Set()
  for (const m of stripComments(src).matchAll(/from\s+['"]([^'"]*(?:lucide|LineIcon|icons\/|\.svg)[^'"]*)['"]/gi))
    out.add(m[1])
  return [...out].sort()
}

const FACE_TXT = { head: 'HEAD', staged: '索引' }

/**
 * 清单按面取:`ls-tree` 不认 `--cached`(传进去是 unknown option ⇒ 整面取不到)。索引面只能走
 * `ls-files`;内容仍由 `catBatch(':path')` 取,清单与内容同面同轮。
 */
function listFace(repoRoot, face, dir) {
  const args =
    face === 'staged' ? ['ls-files', '--', dir] : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dir]
  const out = gitRaw(args, repoRoot, {})
  if (out === null || out === undefined) return null
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 面 → 两端清单 + 同名配对正文。一次 cat-file --batch 同面同轮读完;任一份取不到即 Undetermined。 */
export function collect(repoRoot, face) {
  const lists = {}
  for (const [side, dirs] of Object.entries(SIDES)) {
    const acc = []
    for (const dir of dirs) {
      const out = listFace(repoRoot, face, dir)
      if (out === null) throw new Undetermined(`${FACE_TXT[face]}取不到目录清单 ${dir}`)
      acc.push(...out)
    }
    lists[side] = acc
  }
  const pairs = scan(lists.miniapp, lists.rn)
  if (pairs.undetermined) throw new Undetermined(`${pairs.reason} ⇒ 判据失明,不得记为通过`)
  const need = [...new Set(pairs.pairs.flatMap((p) => [p.miniapp, p.rn]))]
  const text = {}
  const specs = need.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < need.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) throw new Undetermined(`${FACE_TXT[face]}取不到 ${need[i]}`)
    text[need[i]] = t
  }
  return { pairs, text }
}

/** 一处"看得见的差异" = 一个档值(具名常量不同值另计,同一处不双计)。 */
export function diffCount(f) {
  return f.named.length + f.geometry.onlyMiniapp.length + f.geometry.onlyRn.length
}

/** 豁免必须是带理由的声明,不是消红通道;到期由守门 108 单独问责。 */
export function waiverProblem(w) {
  if (!w) return null
  if (typeof w.reason !== 'string' || w.reason.trim().length < 6) return '豁免无理由或理由不足以复核'
  return null
}

export function audit(pairs, text, baseline = {}) {
  const findings = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const ga = readGeometry(a, 'miniapp')
    const gb = readGeometry(b, 'rn')
    const named = namedConflicts(ga.named, gb.named)
    const geometry = diffValues(ga.values, gb.values)
    if (!named.length && !geometry.onlyMiniapp.length && !geometry.onlyRn.length) continue
    const w = (baseline.waivers ?? {})[p.name]
    findings.push({
      name: p.name,
      named,
      geometry,
      lang: { miniapp: styleLanguage(a), rn: styleLanguage(b) },
      icons: { miniapp: iconCarriers(a), rn: iconCarriers(b) },
      invalidWaiver: waiverProblem(w) ?? undefined,
      waived: !!w && !waiverProblem(w),
    })
  }
  return { findings, ...verdictOf(findings, baseline), pairCount: pairs.pairs.length }
}

/**
 * 棘轮:锚点 = 台账钉住的读数(立项按 HEAD 生成)。只拦"把差异加大";台账没有这个名字 ⇒ 锚点 0,
 * 新增配对直接问责(它没有存量可躲)。变好只提示"可下调",**不自动改账**。
 */
export function verdictOf(findings, baseline) {
  const counts = baseline.counts ?? {}
  const waivers = baseline.waivers ?? {}
  const red = []
  const shrunk = []
  const waived = []
  for (const f of findings) {
    const n = diffCount(f)
    // 豁免判定只在这一处生效(规则本身在 waiverProblem,audit 里的字段只是同一规则的展示视图)。
    // 若两处各判一次,台账改一条就会一边认豁免、一边仍判红 —— 两处算同一件事必漂移,本仓记过多次。
    const w = waivers[f.name]
    if (w && !waiverProblem(w)) {
      waived.push({ name: f.name, diffCount: n })
      continue
    }
    const anchor = counts[f.name] ?? 0
    if (n > anchor) red.push({ name: f.name, diffCount: n, anchor, named: f.named, geometry: f.geometry })
    else if (n < anchor) shrunk.push({ name: f.name, diffCount: n, anchor })
  }
  return { red, shrunk, waived }
}

export function emitBaseline(findings) {
  const counts = {}
  for (const f of findings) counts[f.name] = diffCount(f)
  return { counts, waivers: {} }
}

export function parseBaseline(text, where) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Undetermined(`${BASELINE_REL}(${where})不是合法 JSON —— 台账坏了不得当豁免用`)
  }
}

/** 台账缺席 = 空锚点(全判红)。这是"新门先入库台账再接线"的强制顺序,不得靠缺文件蒙绿。 */
export function chooseBaseline(t) {
  return t === null || t === undefined ? {} : parseBaseline(t, 'ledger')
}

export function loadBaseline(repoRoot, face) {
  const spec = (face === 'staged' ? ':' : 'HEAD:') + BASELINE_REL
  const got = catBatch(repoRoot, [spec], { maxBuffer: 1 << 24 })
  return chooseBaseline(got.get(spec))
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  // 把 error 当 face 往下传 = --staged 静默按 HEAD 判,账面却读成"审过本次提交的那一份"。
  if (error) throw new Undetermined(error)
  if (face === 'worktree') throw new Undetermined('本门不开工作树档:共享工作树滞后 HEAD,按磁盘判会把错数写回台账')
  return face
}

export function main(argv, repoRoot = ROOT) {
  let face, collected, baseline
  try {
    face = faceFromArgv(argv)
    baseline = loadBaseline(repoRoot, face)
    collected = collect(repoRoot, face)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  const res = audit(collected.pairs, collected.text, baseline)
  if (argv.includes('--emit-baseline')) {
    console.log(JSON.stringify(emitBaseline(res.findings), null, 2))
    console.log(`模板按 ${FACE_TXT[face]} 面生成;逐条核过再放进 ${BASELINE_REL}(它是存量锚点,不是合格证)`)
    return 0
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        face,
        pairCount: res.pairCount,
        findings: res.findings.map((f) => ({ name: f.name, diffCount: diffCount(f), lang: f.lang })),
        red: res.red,
        waived: res.waived.length,
      }),
    )
  } else {
    console.log(`判定面 ${FACE_TXT[face]}:同名配对组件 ${res.pairCount} 对(重复实现 = 改一端另一端不跟随)`)
    for (const f of res.findings) {
      const bits = []
      if (f.named.length) bits.push(`同名常量不同值 ${f.named.join(', ')}`)
      if (f.geometry.onlyMiniapp.length) bits.push(`仅小程序档 ${f.geometry.onlyMiniapp.join('/')}`)
      if (f.geometry.onlyRn.length) bits.push(`仅 RN 档 ${f.geometry.onlyRn.join('/')}`)
      const mark = f.waived ? '○' : res.red.some((r) => r.name === f.name) ? '×' : '·'
      console.log(`  ${mark} ${f.name} [${f.lang.miniapp}|${f.lang.rn}] ${bits.join(' | ')}`)
    }
    console.log(
      `可见几何差异 ${res.findings.length} 处 → 超锚点判红 ${res.red.length} / 带理由豁免 ${res.waived.length}` +
        (res.shrunk.length ? ` / 已变好可下调台账 ${res.shrunk.length}` : ''),
    )
    if (res.shrunk.length)
      console.log(`  下调:${res.shrunk.map((s) => `${s.name} ${s.anchor}→${s.diffCount}`).join(', ')}`)
    if (res.red.length)
      console.log(
        '  收口姿势 = 一份与平台无关的组件源 + 两端各自注入 primitive adapter;**不得给单端补数字凑平**' +
          '(那只是把第二份真相挪了个位置)。确属平台导致的差异写进台账 waivers 并带 reason。',
      )
  }
  return res.red.length ? 1 : 0
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond) => {
    if (cond) pass++
    else fail++
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`)
  }
  t('S1 注释里的数字不得被当成几何档', readGeometry('// BOX = 99\nconst a = 1\n', 'rn').values.size === 0)
  t('S2 字符串里的块注释开闭序列不得吞掉后续判据', stripComments('const s="/*"\nconst BOX=8\n').includes('BOX'))
  t(
    'S3 72rpx 与 36px 归一到同一档(单位不是差异)',
    readGeometry('w-[72rpx]', 'miniapp').values.has(36) && readGeometry('w-[36px]', 'rn').values.has(36),
  )
  t('S4 同名常量两侧不同值必须点名(阳性对照)', namedConflicts({ ICON: 20 }, { ICON: 22 }).length === 1)
  t('S5 同名常量两侧同值不得点名(反向对照)', namedConflicts({ ICON: 22 }, { ICON: 22 }).length === 0)
  t(
    'S6 非几何键(字重/时长/index)不计入',
    readGeometry('fontWeight: 700\nduration: 300\nrowIndex = 3\n', 'rn').values.size === 0,
  )
  t('S7 配对认 .jsx 与 .tsx 同判(门不得对自己产出的形态失明)', scan(['a/Back.jsx'], ['b/Back.tsx']).pairs.length === 1)
  t('S8 两端清单为空 ⇒ 判死而非记绿(空扫不通过)', scan([], []).undetermined === true)
  t('S9 豁免缺理由仍算红', waiverProblem({ until: '2027-01-01' }) !== null)
  t('S10 豁免带理由才算 waived', waiverProblem({ reason: '平台 chrome:原生导航栏不参与 CSS' }) === null)
  t(
    'S11 棘轮:不超锚点绿 / 超过锚点红(成对)',
    (() => {
      const f = { name: 'X', named: [], geometry: { onlyMiniapp: [1, 2], onlyRn: [] }, waived: false }
      return (
        verdictOf([f], { counts: { X: 2 } }).red.length === 0 && verdictOf([f], { counts: { X: 1 } }).red.length === 1
      )
    })(),
  )
  t(
    'S12 台账缺该组件 ⇒ 锚点 0,新配对的任何差异直接红',
    verdictOf([{ name: 'New', named: [], geometry: { onlyMiniapp: [8], onlyRn: [] }, waived: false }], {}).red.length ===
      1,
  )
  t(
    'S13 变好了只提示下调,不自动改账',
    verdictOf([{ name: 'X', named: [], geometry: { onlyMiniapp: [1], onlyRn: [] }, waived: false }], {
      counts: { X: 5 },
    }).shrunk.length === 1,
  )
  t(
    'S14 audit 端到端:同档绿 / 差一档红',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[36px]\n' }, {})
      const diff = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[44px]\n' }, {})
      return same.red.length === 0 && diff.red.length === 1
    })(),
  )
  t(
    'S15 两面旗同给 ⇒ 判死',
    (() => {
      try {
        faceFromArgv(['--staged', '--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t('S16 工作树档被拒(本门拒绝按磁盘判,防错数写回台账)', (() => {
    try {
      faceFromArgv(['--worktree'])
      return false
    } catch (e) {
      return e instanceof Undetermined
    }
  })())
  t('S17 圆角档不参与本门(守门 77 单一源,不得两台尺子互相指认)', readGeometry('rounded-[99px]\nborderRadius: 99\n', 'rn').values.size === 0)
  t('S18 RN 同名多命中 ⇒ 取排序靠前的层(共享层优先)', scan(['a/X.tsx'], ['p1/X.tsx', 'p2/X.tsx']).pairs[0].rn === 'p1/X.tsx')
  t('S19 台账坏 JSON ⇒ 判死,不得当"没有豁免"蒙过', (() => {
    try {
      parseBaseline('{坏 json', 'ledger')
      return false
    } catch (e) {
      return e instanceof Undetermined
    }
  })())
  console.log(`--self-test:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const rc = runSelfTest()
    if (rc) console.error('❌ 自检失败')
    process.exit(rc)
  }
  try {
    process.exit(main(argv))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  stripComments,
  toPx,
  readGeometry,
  namedConflicts,
  diffValues,
  diffCount,
  scan,
  styleLanguage,
  iconCarriers,
  audit,
  verdictOf,
  emitBaseline,
  waiverProblem,
  faceFromArgv,
  chooseBaseline,
  parseBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
