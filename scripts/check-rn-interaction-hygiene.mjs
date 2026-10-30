#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 273:RN 触屏交互卫生对账(blocking;H1 命中尺寸绝对零容忍 / H2 按压反馈差值棘轮)
 *
 * 为什么必须有门(2026-10-31 实测):
 *  - H1 命中尺寸:`packages/design-tokens/src/geometry.js` 早有 `tapBox: 36` 这一档,端内十几个文件
 *    在用它 —— **有档、有消费方、零判据**。新写一枚 24×24 的图标钮不会编译报错、不会红任何门,
 *    只有用户点不中才发现。立门当轮已把现读存量 **22 处清零**(故 H1 才敢用绝对零容忍)。
 *  - H2 按压反馈:触屏没有 hover,"按下去什么都不变"就等于告诉用户"我没点上"。现读 HEAD 面
 *    = **352 处**(337 枚 `Pressable` 没有默认按压态 + 13 枚把默认反馈关掉的
 *    `TouchableOpacity activeOpacity={1}` + 2 枚 `TouchableWithoutFeedback`);此前**无人看守**。
 *
 * 判据刻意保守(误报的代价是逼人跳门,连带废掉全部守门 §12e,所以宁窄勿宽):
 *  H1 只判**宽高都是显式数字**且「较小者 + 2×hitSlop」< 档位 的可点元素。hitSlop 按补足量算,
 *      不是"写了就免":`hitSlop={0}` 照判(那是消红写法),对象形态取四边最小值(保守),
 *      字面值取不到(变量/跨文件)⇒ 落盲区不判。
 *      `style` 解析覆盖三种本仓实际写法:内联对象、`styles.KEY`(同文件 StyleSheet.create 表)、
 *      `[styles.a, styles.b]` 数组(RN 的后者覆盖前者 ⇒ 按最后一个声明该键的对象取值)。
 *      盲区(不判,也不记通过):padding/flex/绝对定位撑出来的尺寸、跨文件样式、三元/函数形态
 *      (`style={fn}`)、`width:'100%'` 这类非数字值 —— 这些要量真机几何,静态判不了,写在这里
 *      而不是假装看过。
 *      嵌套对象整体跳过:`shadowOffset: { width: 0, height: 0 }` 不是命中尺寸,判它即凭空造违规。
 *  H2 按**原语各自的默认态**判,不数"有没有写 onPressIn":
 *      `TouchableOpacity` 默认 `activeOpacity=0.2` ⇒ 按下即变暗,本来就有反馈(只有显式
 *      `activeOpacity={1}` 才算关掉);`TouchableHighlight` 按下铺 underlay ⇒ 结构上有;
 *      `TouchableWithoutFeedback` 类名自述没有 ⇒ 判;`Pressable` 无默认态 ⇒ 必须有四形态之一
 *      (onPressIn/onPressOut、children 函数形态 `{({ pressed })`、className `active:`、
 *      props 区出现 `pressed` 的函数形态 style)。
 *      上一版把 957 枚 TouchableOpacity 一并算成"无反馈"—— 那是拿误报逼人补冗余代码。
 *
 * 档位取 36 不取 44:本仓既定档就是 `tapBox: 36`(geometry.js 注明对齐 web 顶栏 `w-9`,
 * 两端已各自对齐到它)。另立一个 44 就是造第二份真相,比漏判更糟。要改档值须先改那张表。
 * 档位从**被审面**的 geometry.js 现读(与 §0.4 同基准);解析不出 ⇒ 未判定 exit 2,不猜 36。
 *
 * 口径:全量档 = 审计报告(H2 存量只报数;H1 存量 2026-10-31 已由 22 → 0,`--strict` 才问责);
 *       --staged = **H1 绝对零容忍**(存量已归零才升的档,§0.2)+ **H2 差值棘轮**
 *                  (逐文件比 索引 blob vs HEAD blob,只在"本次把违规加回来"时红,§0.5)。
 *       取不到内容一律未判定 exit 2,不回落另一个面、不记绿(§0.3/§0.4)。
 *
 * 用法:node scripts/check-rn-interaction-hygiene.mjs [--staged|--worktree|--strict|--self-test|--quiet]
 *       --strict 才问责存量(治理专用,默认不拦,免得成为恒红门)
 * 紧急跳过:HUSKY_SKIP_RN_INTERACTION_HYGIENE=1 git commit ...(须留痕,§0.10)
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FACE_LABEL,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_RELS = ['apps/mobile-rn/src', 'packages/app/src', 'packages/ui-native/src']
const GEO_REL = 'packages/design-tokens/src/geometry.js'
const TIER_KEY = 'tapBox'
const SKIP_ENV = 'HUSKY_SKIP_RN_INTERACTION_HYGIENE'
/** 命中区判定要求两维都显式;缺一维就落盲区,不猜 */
const REQUIRE_BOTH_DIMS = true

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet')
const strict = argv.includes('--strict')
const selfTest = argv.includes('--self-test')
const { face, error: faceErr } = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})

const CLICKABLE_RE =
  /<(TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Pressable)\b/g

/**
 * 从 `src[i]`(应为 `{`)起做括号配平,返回闭括号下标;配不平返回 -1。
 * 字符串/模板字面量内的括号不算。
 */
function matchBrace(src, i) {
  if (src[i] !== '{') return -1
  let depth = 0
  let str = null
  for (let p = i; p < src.length; p++) {
    const ch = src[p]
    if (str) {
      if (ch === '\\') {
        p++
        continue
      }
      if (ch === str) str = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return p
    }
  }
  return -1
}

/**
 * 取可点元素**自己的 props 区**(从 `<` 到闭合 `>`)与其结束下标。
 * `>` 落在 `{}`/字符串里(箭头函数、比较运算)不算闭合 —— 否则 props 会被拦腰截断,
 * 后半段的 hitSlop/onPressIn 就读不到,判据会凭空造违规。
 */
function tagRegion(text, start) {
  let p = start + 1
  while (p < text.length && /[\w.$]/.test(text[p])) p++
  let depth = 0
  let str = null
  for (; p < text.length; p++) {
    const ch = text[p]
    if (str) {
      if (ch === '\\') {
        p++
        continue
      }
      if (ch === str) str = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') depth--
    else if (depth === 0 && ch === '>') return { props: text.slice(start, p), end: p + 1 }
    else if (depth === 0 && ch === '/' && text[p + 1] === '>')
      return { props: text.slice(start, p), end: p + 2 }
  }
  return { props: text.slice(start, start + 3000), end: start + 3000 }
}

/**
 * 一个对象体(已剥掉最外层花括号)的**顶层** width/height 数字。
 * 嵌套 `{}`/`[]`/`()内` 整体跳过:RN 的 `shadowOffset: { width: 0, height: 0 }` 是投影偏移,
 * 不是命中尺寸;把它当尺寸就会给每张带阴影的卡片凭空造一枚违规。
 */
function topDims(body) {
  const w = []
  const h = []
  let depth = 0
  let str = null
  let line = ''
  for (let i = 0; i <= body.length; i++) {
    const ch = i < body.length ? body[i] : ','
    if (str) {
      line += ch
      if (ch === '\\') {
        const nx = body[i + 1]
        if (nx !== undefined) {
          line += nx
          i++
        }
        continue
      }
      if (ch === str) str = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch
      line += ch
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++
      continue
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      if (depth > 0) depth--
      continue
    }
    if (depth > 0) continue
    if (ch === ',') {
      const m = /^\s*([A-Za-z_$][\w$-]*)\s*:\s*(-?\d+(?:\.\d+)?)(?![\w.%])\s*$/.exec(line)
      if (m) {
        const k = m[1].replace(/-([a-z])/gi, (_, c) => c.toUpperCase())
        if (k === 'width' || k === 'height') (k === 'width' ? w : h).push(Number(m[2]))
      }
      line = ''
      continue
    }
    line += ch
  }
  return { w, h }
}

/** `const styles = StyleSheet.create({ … })` → Map<键, {w,h}>(只认同文件这一张表)。 */
function styleTable(code) {
  const map = new Map()
  for (const cm of code.matchAll(/StyleSheet\s*\.\s*create\s*\(\s*\{/g)) {
    const open = cm.index + cm[0].length - 1
    const close = matchBrace(code, open)
    if (close < 0) continue
    let i = open + 1
    let pend = ''
    while (i < close) {
      const ch = code[i]
      if (ch === '{') {
        const km = /([A-Za-z_$][\w$]*)\s*:\s*$/.exec(pend)
        const entryClose = matchBrace(code, i)
        if (entryClose < 0) break
        if (km) {
          const dims = topDims(code.slice(i + 1, entryClose))
          const prev = map.get(km[1])
          map.set(
            km[1],
            prev
              ? { w: [...prev.w, ...dims.w], h: [...prev.h, ...dims.h] }
              : { w: dims.w, h: dims.h },
          )
        }
        i = entryClose + 1
        pend = ''
        continue
      }
      pend += ch
      i++
    }
  }
  return map
}

/** 剥掉 `{{…}}` 的双层花括号,拿到真正写属性的那一层。 */
function unwrapObject(inner) {
  let cur = inner.trim()
  for (let guard = 0; guard < 3 && cur.startsWith('{'); guard++) {
    const close = matchBrace(cur, 0)
    if (close < 0) break
    cur = cur.slice(1, close === cur.length - 1 ? cur.length - 1 : close).trim()
  }
  return cur
}

/**
 * `hitSlop` 的补量:数字形态 `hitSlop={4}` 四边各 4;对象形态取四边最小值(保守)。
 * 写了 hitSlop 但取不到字面值(变量/跨文件)⇒ `unknown`,落盲区不判(宁窄勿宽)。
 * 没写 ⇒ 0。**必须量到数值**才算补过:`hitSlop={0}` 是消红写法,不是命中区。
 */
function slopOf(props) {
  if (!/\bhitSlop\s*=/.test(props)) return { slop: 0, unknown: false }
  const num = /\bhitSlop\s*=\s*\{\s*(-?\d+(?:\.\d+)?)\s*\}/.exec(props)
  if (num) return { slop: Math.max(0, Number(num[1])), unknown: false }
  const obj = /\bhitSlop\s*=\s*\{\s*\{([^}]*)\}/.exec(props)
  if (obj) {
    const vals = [...obj[1].matchAll(/\b(?:top|bottom|left|right)\s*:\s*(\d+(?:\.\d+)?)/g)].map(
      (v) => Number(v[1]),
    )
    if (vals.length === 4) return { slop: Math.min(...vals), unknown: false }
    return { slop: 0, unknown: true }
  }
  return { slop: 0, unknown: true }
}

/**
 * 解析一个可点元素的 `style` 表达式 → { hit, w, h, slop, slopUnknown, ambiguous }。
 * `hit=false` 表示"判不了"(落盲区,不记通过也不判违规)。
 */
function resolveStyle(props, table) {
  const { slop, unknown: slopUnknown } = slopOf(props)
  let w = []
  let h = []
  const segs = []
  const re = /\bstyle\s*=\s*/g
  let m
  while ((m = re.exec(props))) {
    let i = m.index + m[0].length
    while (i < props.length && /\s/.test(props[i])) i++
    if (props[i] !== '{') break
    const close = matchBrace(props, i)
    if (close < 0) break
    segs.push(props.slice(i + 1, close))
    re.lastIndex = close
  }
  if (segs.length === 0) return { hit: false, why: '无 style 属性' }
  let ambiguous = false
  for (const raw of segs) {
    const seg = unwrapObject(raw)
    if (/^\[/.test(seg)) {
      const refs = [...seg.matchAll(/styles\.([A-Za-z_$][\w$]*)/g)].map((r) => r[1])
      if (refs.length === 0) {
        const dims = topDims(seg)
        if (dims.w.length) w = dims.w
        if (dims.h.length) h = dims.h
        continue
      }
      for (const key of refs) {
        const entry = table.get(key)
        if (!entry) {
          ambiguous = true
          continue
        }
        if (entry.w.length) w = entry.w
        if (entry.h.length) h = entry.h
      }
      continue
    }
    const dims = topDims(seg)
    if (dims.w.length || dims.h.length) {
      if (dims.w.length) w = dims.w
      if (dims.h.length) h = dims.h
      continue
    }
    const refs = [...seg.matchAll(/styles\.([A-Za-z_$][\w$]*)/g)].map((r) => r[1])
    if (refs.length === 1 && !/[?:]|&&|\|\|/.test(seg)) {
      const entry = table.get(refs[0])
      if (!entry) ambiguous = true
      else {
        if (entry.w.length) w = entry.w
        if (entry.h.length) h = entry.h
      }
    } else if (refs.length > 1) ambiguous = true
  }
  if (REQUIRE_BOTH_DIMS && (!w.length || !h.length)) return { hit: false, why: '尺寸非双显式' }
  return {
    hit: true,
    w: w[w.length - 1],
    h: h[h.length - 1],
    slop,
    slopUnknown,
    ambiguous,
  }
}

const FEEDBACK_RE = /onPressIn\s*=|onPressOut\s*=|\bpressed\b|active:\w/

/**
 * 按压反馈是否"由原语自带"。判错方向的代价不对称:
 *  - 把自带反馈的算成缺(上一版就是这么错的):1296 处里 957 处是 `TouchableOpacity`,
 *    它默认 `activeOpacity=0.2` ⇒ 按下即变暗,**本来就有反馈**。照判就是逼人补冗余
 *    onPressIn,甚至逼人跳门(§12e 同一句警告)。
 *  - 把没有反馈的算成有:才是本门要拦的。
 * 口径:
 *  - `TouchableOpacity`:默认有;唯一关掉它的方式是 `activeOpacity={1}` ⇒ 只在那时判。
 *  - `TouchableHighlight`:按下铺 underlay(默认黑)⇒ 结构上有反馈,不判。
 *  - `TouchableWithoutFeedback`:类名自己就说没有 ⇒ 判。
 *  - `Pressable`:RN 不给任何默认态 ⇒ 必须有四形态之一。
 */
function hasNativeFeedback(tag, props) {
  if (tag === 'TouchableOpacity') return !/\bactiveOpacity\s*=\s*\{\s*1(?:\.0+)?\s*\}/.test(props)
  if (tag === 'TouchableHighlight') return true
  return false
}

/**
 * 纯判据(自检、镜像测试与主流程共用同一份实现,§22c 不在测试里另抄)。
 * @param {string} text 被审面上的源码
 * @param {number} minTap 命中方块下限(由调用方从**同面**的 geometry.js 现读)
 * @param {string} rel 仓库相对路径(用于 `slopOnly` 普查:跨端源里 hitSlop 只补到 RN 腿)
 */
function scanText(text, minTap, rel = '') {
  const stripped = maskComments(String(text ?? ''))
  const table = styleTable(stripped)
  const h1 = []
  const h2 = []
  const slopOnly = []
  const skipped = []
  const crossEnd = !rel.startsWith('apps/mobile-rn/')
  for (const m of stripped.matchAll(CLICKABLE_RE)) {
    const line = stripped.slice(0, m.index).split('\n').length
    const tag = m[1]
    const { props, end } = tagRegion(stripped, m.index)
    const r = resolveStyle(props, table)
    if (r.hit && !r.ambiguous && !r.slopUnknown) {
      const box = Math.min(r.w, r.h)
      const eff = box + 2 * r.slop
      if (eff < minTap) h1.push({ line, tag, size: `${r.w}×${r.h}`, eff })
      else if (crossEnd && box < minTap && r.slop > 0)
        // hitSlop 是 RN 原语,Taro 无对应机制(端内 Sheet.tsx 头注自述"本端不设")
        // ⇒ 跨端源里靠 slop 过关的,小程序腿其实没被补上。本门不判它红(那是小程序自己的账),
        //   但必须点名进 slopOnly 普查,免得"RN 侧过关"被读成"两端都过关"。
        slopOnly.push({ line, tag, size: `${r.w}×${r.h}`, eff })
    }
    if (!r.hit) skipped.push(r.why)
    const after = stripped.slice(end, end + 160)
    if (
      !hasNativeFeedback(tag, props) &&
      !FEEDBACK_RE.test(props) &&
      !/\{\s*\(\s*\{/.test(after)
    )
      h2.push({ line, tag })
  }
  return { h1, h2, skipped, slopOnly }
}

/** 被审面上的 geometry.js → tapBox 数值;读不出给 null(调用方落未判定,不猜)。 */
function tierFromSource(src, key = TIER_KEY) {
  if (typeof src !== 'string') return null
  const code = maskComments(src)
  const body = code.match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
  if (!body) return null
  const m = new RegExp(`^\\s*${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'm').exec(body[1])
  return m ? Number(m[1]) : null
}

function listFiles(f) {
  const scoped = (p) => SRC_RELS.some((r) => p.startsWith(`${r}/`)) && /\.(tsx|ts)$/.test(p)
  if (f === 'worktree') {
    const prefix = ROOT.split(sep).join('/').length + 1
    const out = []
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e.startsWith('.')) continue
        const full = join(dir, e)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(tsx|ts)$/.test(full)) out.push(full.split(sep).join('/').slice(prefix))
      }
    }
    for (const r of SRC_RELS) if (existsSync(join(ROOT, r))) walk(join(ROOT, r))
    return out.filter(scoped)
  }
  if (f === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM', '--', ...SRC_RELS], ROOT)
      .split('\n')
      .map((s) => s.trim())
      .filter(scoped)
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SRC_RELS], ROOT)
    .split('\n')
    .map((s) => s.trim())
    .filter(scoped)
}

function runSelfTest() {
  const fails = []
  let asserted = 0
  const ok = (c, m) => {
    asserted += 1
    if (!c) fails.push(m)
  }
  const T = 36
  const scan = (t) => scanText(t, T)

  const small = scan('<TouchableOpacity style={{ width: 24, height: 24 }} onPress={go} />')
  ok(small.h1.length === 1, 'H1 失效:24×24 的可点元素必须被点名')
  ok(
    small.h2.length === 0,
    'H2 过头:TouchableOpacity 默认 activeOpacity=0.2 自带按压变暗,不该判成没有反馈',
  )
  const noDim = scan(
    '<TouchableOpacity activeOpacity={1} style={{ width: 44, height: 44 }} onPress={go} />',
  )
  ok(noDim.h2.length === 1, 'H2 失守:activeOpacity={1} 就是把默认反馈关了,必须判')
  const without = scan(
    '<TouchableWithoutFeedback onPress={go}><View style={{ width: 44, height: 44 }} /></TouchableWithoutFeedback>',
  )
  ok(without.h2.length === 1, 'H2 失守:TouchableWithoutFeedback 类名自述无反馈')
  const pressable = scan('<Pressable style={{ width: 44, height: 44 }} onPress={go} />')
  ok(pressable.h2.length === 1, 'H2 失守:Pressable 没有默认按压态,必须点名')
  const highlight = scan(
    '<TouchableHighlight onPress={go}><Text style={{}} /></TouchableHighlight>',
  )
  ok(highlight.h2.length === 0, 'H2 过头:TouchableHighlight 按下铺 underlay,结构上有反馈')

  const slop = scan(
    '<TouchableOpacity hitSlop={8} style={{ width: 24, height: 24 }} onPress={go} />',
  )
  ok(slop.h1.length === 0, 'H1 误报:hitSlop=8 把 24 补到 40 ≥ 36,已补足命中区不该判')

  const slopZero = scan(
    '<TouchableOpacity hitSlop={0} style={{ width: 24, height: 24 }} onPress={go} onPressIn={p} />',
  )
  ok(slopZero.h1.length === 1, 'H1 失守:hitSlop={0} 是消红写法不是命中区,必须照判')

  const slopShort = scan(
    '<TouchableOpacity hitSlop={2} style={{ width: 28, height: 28 }} onPress={go} onPressIn={p} />',
  )
  ok(slopShort.h1.length === 1, 'H1 失守:28+2×2=32 仍不足 36,补不够也要判')

  const slopObj = scan(
    '<TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 16, height: 16 }} onPress={go} onPressIn={p} />',
  )
  ok(slopObj.h1.length === 0, 'H1 误报:对象形态四边各 10,16+20=36 恰好到档')

  const slopObjSkew = scan(
    '<TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }} style={{ width: 16, height: 16 }} onPress={go} onPressIn={p} />',
  )
  ok(slopObjSkew.h1.length === 1, 'H1 失守:对象形态取四边最小值(横向只补 2)⇒ 20 不足 36')

  const slopVar = scan(
    '<TouchableOpacity hitSlop={insets} style={{ width: 16, height: 16 }} onPress={go} onPressIn={p} />',
  )
  ok(slopVar.h1.length === 0, 'H1 过头:hitSlop 是变量取不到字面值 ⇒ 落盲区,不猜')

  const big = scan('<Pressable style={{ width: 44, height: 44 }} onPress={go} onPressIn={p} />')
  ok(big.h1.length === 0 && big.h2.length === 0, '放行失效:够大且有反馈的不该判')

  const childFn = scan(
    '<Pressable style={{ width: 28, height: 28 }} onPress={go}>{({ pressed }) => <View />}</Pressable>',
  )
  ok(childFn.h2.length === 0, 'H2 误报:children 函数形态就是按压反馈(守门 131 的合法写法)')

  const cls = scan('<TouchableOpacity className="active:bg-gray-100" onPress={go} />')
  ok(cls.h2.length === 0, 'H2 误报:className active: 变体算有反馈')

  const fnStyle = scan(
    '<Pressable style={({ pressed }) => [{ width: 44, height: 44 }, pressed && a]} onPress={go} />',
  )
  ok(fnStyle.h2.length === 0, 'H2 误报:函数形态 style 的按压入参也算反馈')

  // StyleSheet 表驱动:命中尺寸藏在同文件的 create 块里
  const sheet = scan(
    'const styles = StyleSheet.create({\n  chip: { width: 28, height: 28, shadowOffset: { width: 0, height: 0 } },\n})\n' +
      '<TouchableOpacity style={styles.chip} onPress={go} onPressIn={p} />',
  )
  ok(sheet.h1.length === 1, 'H1 失效:styles.KEY 解析出的 28×28 必须被点名')

  // 数组形态后者覆盖前者 ⇒ 60×60 不该判
  const arr = scan(
    'const styles = StyleSheet.create({\n  chip: { width: 28, height: 28 },\n  chipBig: { width: 60, height: 60 },\n})\n' +
      '<TouchableOpacity style={[styles.chip, styles.chipBig]} onPress={go} onPressIn={p} />',
  )
  ok(arr.h1.length === 0, 'H1 误报:数组覆盖后是 60×60,不该按第一枚的 28 判')

  // 嵌套 shadowOffset 的 0 不得当成尺寸(否则每张带阴影的卡片都凭空违规)
  const shadow = scan(
    '<Pressable style={{ width: 60, height: 60, shadowOffset: { width: 0, height: 0 } }} onPress={go} onPressIn={p} />',
  )
  ok(shadow.h1.length === 0, 'H1 误报:shadowOffset 里的 width/height 不是命中尺寸')

  // props 区不得越界到兄弟节点(否则后一个元素的窄尺寸会算到前一个头上)
  const spill = scan('<Pressable onPress={go} onPressIn={p} />\n<View style={{ width: 20, height: 20 }} />')
  ok(spill.h1.length === 0, 'H1 误报:props 区越界把兄弟 View 的尺寸算给了 Pressable')

  // 箭头函数里的 `>` 不能提前结束 props 区
  const arrow = scan(
    '<TouchableOpacity onPress={() => { if (a > b) { fire() } }} style={{ width: 20, height: 20 }} />',
  )
  ok(arrow.h1.length === 1, 'props 区被箭头/比较运算里的 `>` 截断,尺寸没读到')

  // 单维显式 ⇒ 落盲区,不判也不记通过
  const oneDim = scan('<Pressable style={{ width: 24 }} onPress={go} onPressIn={p} />')
  ok(oneDim.h1.length === 0, 'H1 过头:只显式 width 时高度未知,静态判不了就不判')

  // 跨文件/未知键 ⇒ 盲区
  const unknown = scan(
    '<TouchableOpacity style={styles.remote} onPress={go} onPressIn={p} />',
  )
  ok(unknown.h1.length === 0, 'H1 过头:样式表里没有这个键时必须落盲区,不得猜值')

  // 注释里的字形/标签不算
  const commented = scan('// <TouchableOpacity style={{ width: 8, height: 8 }} />\n<Pressable style={{ width: 48, height: 48 }} onPress={go} onPressIn={p} />')
  ok(commented.h1.length === 0 && commented.h2.length === 0, '注释里的可点元素被当成了代码')

  // slopOnly 普查:跨端源里只靠 hitSlop 过关的,小程序腿(Taro 无该机制)没被补上 ⇒ 点名不判红
  const badge = '<TouchableOpacity hitSlop={8} style={{ width: 20, height: 20 }} onPress={go} onPressIn={p} />'
  const cross = scanText(badge, T, 'packages/app/src/features/x/Screen.tsx')
  const rnOnly = scanText(badge, T, 'apps/mobile-rn/src/components/X.tsx')
  ok(cross.h1.length === 0 && cross.slopOnly.length === 1, 'slopOnly 失效:跨端源靠 hitSlop 过关必须进普查(不得读成两端都过关)')
  ok(rnOnly.h1.length === 0 && rnOnly.slopOnly.length === 0, 'slopOnly 过头:RN 独占源里 hitSlop 是真补上了,不该进普查')

  ok(T === tierFromSource(GEO_FIXTURE), `档位解析失效(夹具):${tierFromSource(GEO_FIXTURE)}`)
  ok(tierFromSource('export const X = 1') === null, '档位解析必须"读不出⇒null",不得给默认值冒绿')

  const geoSrc = readWorktreeFile(ROOT, GEO_REL)
  const live = tierFromSource(geoSrc)
  ok(live !== null, `阳性对照失效:现读 ${GEO_REL} 读不出 ${TIER_KEY}`)
  ok(live === T, `档位必须取自 geometry.js 的 ${TIER_KEY}(现读 ${live},夹具 ${T})`)

  if (fails.length) {
    for (const f of fails) console.error(`[SELF-TEST FAIL] ${f}`)
    return 1
  }
  if (asserted === 0) {
    console.error('[SELF-TEST FAIL] 一条断言都没跑 ⇒ 自检本身失效,不得记绿')
    return 1
  }
  console.log(
    `[SELF-TEST OK] 交互卫生判据自检 ${asserted} 组通过(命中尺寸/hitSlop 补足量/按压反馈四形态/StyleSheet 表/数组覆盖/嵌套对象/盲区类,档位现读 ${live})`,
  )
  return 0
}

const GEO_FIXTURE = `export const GEOMETRY_PX = {
  /** 可点方块边长(命中区):对齐 web 顶栏 \`w-9\` */
  tapBox: 36,
  glyphMd: 20,
  /** 为什么不复用 \`tapBox\`(44):36 是命中区档 */
  controlBox: 32,
}
`

function main() {
  if (selfTest) return runSelfTest()
  if (faceErr) {
    console.error(`❌ ${faceErr}`)
    return 2
  }
  if (process.env[SKIP_ENV]) {
    console.error(`⚠️ 已跳过(${SKIP_ENV}=1)—— 按 §0.10 计入跳门留痕,不得读成已通过`)
    return 0
  }
  const files = listFiles(face)
  if (files.length === 0) {
    console.error('❌ 射程内一个文件都没枚举到 ⇒ 判死(枚举到 0 不等于没有,§0.3)')
    return 2
  }
  /** `cat-file` 规格前缀:索引面是 `:path`,HEAD 面必须是 `HEAD:path`(漏了冒号整批读成"取不到") */
  const rev = face === 'staged' ? ':' : face === 'head' ? 'HEAD:' : ''
  const specs = files.map((r) => rev + r)
  const geoSpec = rev + GEO_REL
  let texts
  try {
    if (face === 'worktree') {
      texts = new Map(files.map((r) => [r, readWorktreeFile(ROOT, r)]))
      texts.set(GEO_REL, readWorktreeFile(ROOT, GEO_REL))
    } else {
      texts = catBatch(ROOT, [...specs, geoSpec], { maxBuffer: 1 << 29, timeout: 180000 })
    }
  } catch (e) {
    console.error(`❌ 无法判定:${e?.message ?? e}`)
    return 2
  }
  const keyOf = (rel) => (face === 'worktree' ? rel : rev + rel)
  const get = (rel) => texts.get(keyOf(rel)) ?? null

  const minTap = tierFromSource(get(GEO_REL))
  if (minTap === null) {
    console.error(
      `❌ 未判定:取不到 ${FACE_LABEL[face]} 面的 ${GEO_REL} 里的 ${TIER_KEY} ⇒ 不猜档值(§0.3)`,
    )
    return 2
  }

  const perFile = new Map()
  let undetermined = 0
  let blind = 0
  let slopOnlyTotal = 0
  for (const rel of files) {
    const text = get(rel)
    if (text === null || text === undefined) {
      undetermined += 1
      continue
    }
    const r = scanText(text, minTap, rel)
    blind += r.skipped.length
    slopOnlyTotal += r.slopOnly.length
    if (r.h1.length || r.h2.length) perFile.set(rel, r)
  }
  const totalH1 = [...perFile.values()].reduce((s, r) => s + r.h1.length, 0)
  const totalH2 = [...perFile.values()].reduce((s, r) => s + r.h2.length, 0)

  if (!quiet) {
    console.log(
      `[check-rn-interaction-hygiene] 面=${FACE_LABEL[face]} | ${files.length} 文件 | 档位 ${minTap}(现读 ${GEO_REL}) | 命中尺寸<${minTap}: ${totalH1} 处 / ${perFile.size} 文件;无按压反馈: ${totalH2} 处;盲区(静态判不了): ${blind} 处;只靠 hitSlop 过关的跨端源: ${slopOnlyTotal} 处(小程序腿无该机制,本门不判红、进普查)`,
    )
    if (argv.includes('--list')) {
      for (const [rel, r] of perFile)
        for (const v of r.h1)
          console.log(`   H1 ${rel}:${v.line} <${v.tag}> ${v.size}(补 hitSlop 后实得 ${v.eff})`)
      for (const [rel, r] of perFile)
        for (const v of r.h2) console.log(`   H2 ${rel}:${v.line} <${v.tag}> 无按压反馈`)
    }
    const top = [...perFile.entries()]
      .sort((a, b) => b[1].h2.length + b[1].h1.length - (a[1].h2.length + a[1].h1.length))
      .slice(0, 8)
    for (const [rel, r] of top)
      console.log(
        `   ${String(r.h1.length + r.h2.length).padStart(4)} ${rel}(尺寸 ${r.h1.length} / 无反馈 ${r.h2.length})`,
      )
    if (undetermined > 0)
      console.error(
        `⚠️ ${undetermined} 个文件取不到 ${FACE_LABEL[face]} 内容 ⇒ 该维度未判定,不记绿`,
      )
  }

  if (face !== 'staged' && strict) {
    console.error(`❌ --strict 问责存量:${totalH1} 处命中尺寸不足 + ${totalH2} 处无按压反馈`)
    return 1
  }
  if (face !== 'staged') {
    console.log(
      'ℹ️ 全量档只报数(存量按 §12e 不做成恒红门);提交链口径见 --staged:按文件 HEAD 自身存量棘轮,只拦本次新增',
    )
    return undetermined > 0 ? 2 : 0
  }

  // staged 档:与 HEAD 面逐文件比,新增才红(锚点 = 该文件 HEAD 自身违规数,§0.5)
  let headTexts
  try {
    headTexts = catBatch(ROOT, files.map((r) => `HEAD:${r}`), {
      maxBuffer: 1 << 29,
      timeout: 180000,
    })
  } catch (e) {
    console.error(`❌ 无法判定(HEAD 面对账取不到):${e?.message ?? e}`)
    return 2
  }
  const added = []
  for (const [rel, r] of perFile) {
    /**
     * H1 = **绝对零容忍**(2026-10-31 存量 22 → 0 后升档,§0.2:升 blocking 的前置是存量归零)。
     *   命中区是"点不中"级缺陷,量出来就是 12 枚真控件,没有"存量太大所以只能棘轮"的余地。
     * H2 = 差值棘轮(1296 处存量按 §12e 不做成恒红门;新增即拦)。
     */
    if (r.h1.length)
      added.push(
        `${rel} 命中尺寸不足 ${r.h1.length} 处(绝对零容忍):` +
          r.h1
            .slice(0, 4)
            .map((v) => `L${v.line} <${v.tag}> ${v.size}→实得 ${v.eff}`)
            .join(' / '),
      )
    const headText = headTexts.get(`HEAD:${rel}`) ?? null
    const base = headText === null ? { h1: [], h2: [] } : scanText(headText, minTap, rel)
    if (r.h2.length > base.h2.length)
      added.push(
        `${rel} 无按压反馈 ${base.h2.length} → ${r.h2.length}(新增 ${r.h2.length - base.h2.length})`,
      )
  }
  if (added.length) {
    console.error(`❌ 本次把交互卫生问题加回来了 ${added.length} 项(存量只报数,新增即拦):`)
    for (const a of added.slice(0, 12)) console.error(`   ${a}`)
    console.error(
      `   改法:命中方块取档位 rnGeometry.tapBox(${minTap})(或给既有小图标补 hitSlop);` +
        '按压反馈用 onPressIn/onPressOut、children 函数形态 `{({ pressed })` 或 className `active:` 变体' +
        '(函数形态 style 会被 cssInterop 吃掉 —— 守门 131)。',
    )
    console.error('   确属不该管(如纯装饰可点区):在行内写明原因并登记豁免,不要跳门。')
    return 1
  }
  console.log('✅ 提交链口径无新增')
  return undetermined > 0 ? 2 : 0
}

export const __test__ = {
  scanText,
  tierFromSource,
  topDims,
  tagRegion,
  styleTable,
  hasNativeFeedback,
  runSelfTest,
  SKIP_ENV,
  SRC_RELS,
  GEO_REL,
  TIER_KEY,
  GEO_FIXTURE,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
