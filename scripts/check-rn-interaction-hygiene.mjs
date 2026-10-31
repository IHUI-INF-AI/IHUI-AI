#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 273:RN 触屏交互卫生对账(blocking;H1 命中尺寸 / H3 键盘点击穿透 / H4 内容文字缩放 = 绝对零容忍,H2 按压反馈 = 差值棘轮)
 *
 * 为什么必须有门(2026-10-31 实测):
 *  - H1 命中尺寸:`packages/design-tokens/src/geometry.js` 早有 `tapBox: 36` 这一档,端内十几个文件
 *    在用它 —— **有档、有消费方、零判据**。新写一枚 24×24 的图标钮不会编译报错、不会红任何门,
 *    只有用户点不中才发现。立门当轮已把现读存量 **22 处清零**(故 H1 才敢用绝对零容忍)。
 *  - H2 按压反馈:触屏没有 hover,"按下去什么都不变"就等于告诉用户"我没点上"。现读 HEAD 面
 *    = **342 处**(337 枚 `Pressable` 没有默认按压态 + 显式关掉默认变暗且**不是遮罩**的那几枚 +
 *    2 枚 `TouchableWithoutFeedback`);此前**无人看守**。
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
 *      **遮罩不算缺反馈**:半透黑底(bg-black/α、rgba(0,0,0,α<1)、带 alpha 的 8 位 hex、
 *      tk.overlay.* 档)按下去的动作就是关层,再让它变暗等于全屏闪一下 —— 证据必须写在
 *      该元素自己的 props 或同文件样式键里,不透明黑底不算遮罩(否则遮罩就成了消红通道)。
 *      上一版把 957 枚 TouchableOpacity 一并算成"无反馈"—— 那是拿误报逼人补冗余代码。
 *      2026-10-31 实测再补两档同类误报(各带反向自检例,防止它们变成消红通道):
 *       - **满屏可点面** `style={StyleSheet.absoluteFill}` 且自闭合:这一层自己没有任何视觉
 *         (absoluteFill 只有 position 与四边归零),按下叠透明度一个像素都变化不出来 —— 对它提
 *         "要有反馈"是量不到东西。带 children 的、数组里追加了实底的照判。
 *       - **吞点击容器** `onPress={(e) => e.stopPropagation()}` / 空实现 `onPress={() => undefined}`:
 *         它存在的全部意义是"别把这一下冒泡给外层遮罩",按下去本来就不该有事发生。
 *         真实动作(`onPress={() => open(id)}`)照判。
 *       两档的放过数量必须出现在结论行里(静默放过 = 没量到,§0.3 同型)。
 *
 * 档位取 36 不取 44:本仓既定档就是 `tapBox: 36`(geometry.js 注明对齐 web 顶栏 `w-9`,
 * 两端已各自对齐到它)。另立一个 44 就是造第二份真相,比漏判更糟。要改档值须先改那张表。
 * 档位从**被审面**的 geometry.js 现读(与 §0.4 同基准);解析不出 ⇒ 未判定 exit 2,不猜 36。
 *
 * 口径:全量档 = 审计报告(H2 存量只报数;H1 存量 2026-10-31 已由 22 → 0,`--strict` 才问责);
 *       --staged = **H1/H3/H4 绝对零容忍**(三者的可见存量都已归零才升的档,§0.2)+ **H2 差值棘轮**
 *                  (逐文件比 索引 blob vs HEAD blob,只在"本次把违规加回来"时红,§0.5)。
 *                  H3 只判"闭标签配得平"的区间 ⇒ 配不平的候选根本不进这一维(盲区不判红,§12e)。
 *       取不到内容一律未判定 exit 2,不回落另一个面、不记绿(§0.3/§0.4)。
 *
 * 判序为什么是纯函数 `stagedVerdict`(2026-10-31 实测教训):那一轮里 `if (r.h2.length > base.h2.length)`
 * 被一次改稿吃成语句 `NaN`(ASI 合法 ⇒ 不报语法错),H2 于是**无条件报项** —— 任何改动带 H2 存量
 * 文件的提交都会红,而当时 41 组自检全绿没抓到(判序住在主流程里,自检走不到)。所以判序抽成
 * 纯函数、由自检逐维钉方向(持平/减少必须放行,变多才拦),镜像测试再钉"主流程必须委托它"。
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
  /<(TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Pressable|Tappable)\b/g

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

/** 一个对象体里的顶层 `backgroundColor` 字符串字面量(遮罩证据要在自己的样式里,不越过标签去看别人)。 */
function topColors(body) {
  const out = []
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
      const m = /^\s*backgroundColor\s*:\s*(["'`][^"'`]*["'`])\s*$/.exec(line)
      if (m) out.push(m[1].slice(1, -1))
      line = ''
      continue
    }
    line += ch
  }
  return out
}

/** 一个对象体(已剥掉最外层花括号)的**顶层** width/height 数字。
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
          const bg = topColors(code.slice(i + 1, entryClose))
          const prev = map.get(km[1])
          map.set(
            km[1],
            prev
              ? {
                  w: [...prev.w, ...dims.w],
                  h: [...prev.h, ...dims.h],
                  bg: [...prev.bg, ...bg],
                }
              : { w: dims.w, h: dims.h, bg },
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

// pressFeedback 不在这一列:它返回**函数**形态 style,而 cssInterop 会把注册表组件的函数形态
// 换成 `{}`(守门 131 真机定案)⇒ 认它等于给"样式整份消失"的写法发免检。按压反馈走 <Tappable>。
const FEEDBACK_RE = /onPressIn\s*=|onPressOut\s*=|\bpressed\b|active:\w/

/**
 * 遮罩 token 名单（由主流程从被审面注入）。默认空集 = 这一档不生效 ⇒ 判据只会更严不会更松，
 * 读不到 rn-tokens 时不会静默放过任何元素。
 */
let SCRIM_TOKENS = new Set()
export function setScrimTokens(names) {
  SCRIM_TOKENS = names instanceof Set ? names : new Set(names || [])
  return SCRIM_TOKENS.size
}

/**
 * 遮罩(scrim)不算"缺按压反馈":它按下去的**结果就是关掉整层**,若再让半透黑底跟着变暗,
 * 用户看到的是全屏闪一下 —— 那是观感缺陷,不是反馈。2026-10-31 现读 13 枚 `activeOpacity={1}`
 * 里 12 枚正是这种遮罩(`bg-black/20…50` + `onPress` 关层 + 内层 stopPropagation)。
 * 认定只按**元素自己的** props 区里的半透明黑底,证据要在 props 里,不越过标签去看别人:
 *  - NativeWind:`bg-black/<alpha>`;
 *  - RN 内联:`rgba(0,0,0,<alpha<1)` / `#000…` 带 alpha 的 8 位 hex / 取 `tk.overlay.*` 档。
 */
function isTranslucentBlack(color) {
  if (typeof color !== 'string') return false
  const rgba = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)/.exec(color)
  if (rgba && Number(rgba[1]) < 1) return true
  const hex8 = /^#000000([0-9a-fA-F]{2})$/.exec(color.trim())
  if (hex8 && parseInt(hex8[1], 16) < 255) return true
  return false
}

/** props 区自己写得出的半透明黑底(两种书写语言都认)。 */
function isScrim(props) {
  if (/className\s*=\s*"[^"]*\bbg-black\/\d+/.test(props)) return true
  if (/\b(?:tk|tokens)\.overlay\./.test(props)) return true
  const rgba = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)/.exec(props)
  if (rgba && Number(rgba[1]) < 1) return true
  const hex8 = /#000000([0-9a-fA-F]{2})\b/.exec(props)
  if (hex8 && parseInt(hex8[1], 16) < 255) return true
  return false
}

/** props 里引用了哪个 styles.KEY,且那个键自己写着半透明黑底 ⇒ 也是遮罩。 */
function scrimByStyle(props, table) {
  for (const m of props.matchAll(/styles\.([A-Za-z_$][\w$]*)/g)) {
    const e = table.get(m[1])
    if (e && Array.isArray(e.bg) && e.bg.some(isTranslucentBlack)) return true
  }
  return false
}

/**
 * 从 rn-tokens.ts 现读"值为半透明黑"的 token 名（含一层嵌套，如 overlay: { modal: rgba(...) }）。
 * 为什么要有这一档：遮罩证据本来要求写在元素自己的 props 里，但本仓大量遮罩写的是
 * style={rnCssLight.black20} 或 tk.overlay.modal —— 颜色在命名常量里，
 * 旧版只解 styles 表，一跳之外的 token 认不出 ⇒ 16 枚自闭合满屏遮罩被计入"缺按压反馈"，
 * 逼人在遮罩上叠 active 变体，那正是"点空白全屏闪一下"的观感缺陷。
 * 名单必须现读，不许把颜色表抄进本门（§0.6：抄一份必然与源头漂开）。
 */
export function scrimTokenNames(text) {
  if (typeof text !== "string") return new Set()
  const names = new Set()
  const re = /(\w+)\s*:\s*['"]([^'"]+)['"]/g
  for (const m of text.matchAll(re)) {
    const color = m[2].trim()
    const rgba = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)$/.exec(color)
    const hex8 = /^#000000([0-9a-fA-F]{2})$/.exec(color)
    if ((rgba && Number(rgba[1]) < 1) || (hex8 && parseInt(hex8[1], 16) < 255)) names.add(m[1])
  }
  return names
}

/** props 里出现"现读确认为半透明黑"的 token 名 ⇒ 该元素自己就把遮罩证据写在 props 里。 */
function isScrimToken(props, tokenNames) {
  if (!tokenNames || tokenNames.size === 0) return false
  for (const name of tokenNames) {
    const re = new RegExp('[.^\\w]\\s*' + name + '\\b')
    if (re.test(props)) return true
  }
  return false
}

/**
 * 满屏可点面(`style={StyleSheet.absoluteFill}` 且自闭合)。
 * 这一层自己没有任何视觉 —— absoluteFill 只有 position 与四边归零,按下叠透明度在屏幕上
 * 一个像素都变化不出来。对它提"要有按压反馈"是量不到东西的判据(与遮罩同一族:
 * 它按下去的动作就是关层)。
 * 收窄到两条同时成立:① style 属性区**逐字只有**这一个常量(数组追加/内联实底一律不算,
 * 那种层有自己的视觉);② 自闭合(带 children 的层里面有可见内容,照判)。
 */
function isFillLayer(props, selfClosing) {
  if (!selfClosing) return false
  return /style=\{\s*StyleSheet\.absoluteFill(?:Object)?\s*\}/.test(props)
}

/**
 * 吞点击的容器:`onPress` 只做 stopPropagation,或是空实现(`() => undefined` / `() => {}`)。
 * 它存在的全部意义是"别把这一下冒泡给外层遮罩",按下去本来就不该有事发生 ⇒ 要反馈是反的。
 * 只认这两种字面形态;`onPress={() => doIt(id)}` 那种真实动作照判。
 */
function isInertPress(props) {
  if (/onPress=\{\s*\(\s*\)\s*=>\s*(?:undefined|null|void\s+undefined|\{\s*\})\s*\}/.test(props)) return true
  return /onPress=\{\s*\(\s*[\w$]+\s*\)\s*=>\s*[\w$]+\.stopPropagation\(\s*\)\s*\}/.test(props)
}

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
  // Tappable 自己持有 pressed ⇒ 结构上就有反馈;但它身上再叠 `pressFeedback(...)` 是双重包裹,
  // 而且那正是会把样式吃掉的函数形态 ⇒ 那种写法照判,不让"换了组件"掩盖住旧机制的回潮。
  if (tag === 'Tappable') return !/pressFeedback\s*\(/.test(props)
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
  const fillLayers = []
  const inertPresses = []
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
    const scrim = isScrim(props) || scrimByStyle(props, table) || isScrimToken(props, SCRIM_TOKENS)
    // 自闭合的信号在标签闭合处(props 区不含 `/`),所以按 stripped 的 end-2 取
    const selfClosing = stripped[end - 2] === '/'
    const fillLayer = !scrim && isFillLayer(props, selfClosing)
    const inert = !scrim && !fillLayer && isInertPress(props)
    if (fillLayer) fillLayers.push({ line, tag })
    if (inert) inertPresses.push({ line, tag })
    if (
      !scrim &&
      !fillLayer &&
      !inert &&
      !hasNativeFeedback(tag, props) &&
      !FEEDBACK_RE.test(props) &&
      !/\{\s*\(\s*\{/.test(after)
    )
      h2.push({ line, tag })
  }
  const h3 = scanKeyboard(text)
  const h4 = scanFontLock(text)
  return { h1, h2, skipped, slopOnly, h3, h4, fillLayers, inertPresses }
}

/**
 * 提交链口径(纯函数,自检与主流程共用同一份实现,§22c 不在测试里另抄)。
 * 四维各有档位,而**档位写错的方向恰好是"该拦的不拦 / 不该拦的全拦"**,所以判序必须能被自检逐维钉住。
 * @param rel 被审文件(只用于文案点名)
 * @param r 本次面(索引 blob)的扫描结果
 * @param base 该文件 HEAD 自身的扫描结果(新文件传各桶皆空的骨架)
 * @returns 违规文案数组;空数组 = 该文件本次无新增
 */
function stagedVerdict(rel, r, base) {
  const out = []
  /**
   * H1 = **绝对零容忍**(2026-10-31 存量 22 → 0 后升档,§0.2:升 blocking 的前置是存量归零)。
   *   命中区是"点不中"级缺陷,量出来就是 12 枚真控件,没有"存量太大所以只能棘轮"的余地。
   */
  if (r.h1.length)
    out.push(
      `${rel} 命中尺寸不足 ${r.h1.length} 处(绝对零容忍):` +
        r.h1
          .slice(0, 4)
          .map((v) => `L${v.line} <${v.tag}> ${v.size}→实得 ${v.eff}`)
          .join(' / '),
    )
  /**
   * H3 = **绝对零容忍**(2026-10-31 把可信候选 34 → 0 后升档)。
   * 区间配不平的候选**不进这一维**(那是尺子的盲区,判它红等于逼人跳门),只进盲区计数。
   */
  if (r.h3.length)
    out.push(
      `${rel} 滚动容器含输入框却没写 keyboardShouldPersistTaps ${r.h3.length} 处(绝对零容忍):` +
        r.h3.map((v) => `L${v.line} <${v.tag}> ${v.why}`).join(' / '),
    )
  /**
   * H4 = 内容文字**绝对零容忍**(2026-10-31 把 26 处接进 scaleText 后归零才升的档,§0.2)。
   * 图标字形桶不判:× ✓ emoji 坐在定宽盒里,放大即破版 —— 那一桶合法,判它就是把人逼去跳门。
   */
  if (r.h4.content.length)
    out.push(
      `${rel} 内容文字钉死系统字号缩放 ${r.h4.content.length} 处(绝对零容忍):` +
        r.h4.content.map((v) => `L${v.line}【${v.sample}】`).join(' / '),
    )
  /** H2 = 差值棘轮(存量按 §12e 不做成恒红门;**只在变多时**拦,持平/减少一律放行)。 */
  if (r.h2.length > base.h2.length)
    out.push(
      `${rel} 无按压反馈 ${base.h2.length} → ${r.h2.length}(新增 ${r.h2.length - base.h2.length})`,
    )
  return out
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

/**
 * 取一个 JSX 元素的范围:{props, end}(end = 闭标签之后;自闭合则为开标签末)。
 * 同名嵌套按深度配平;`style={{…}}` 里的 `>` 由花括号深度挡住,不会提前收尾 ——
 * 上一版探针拿 `+3000 字` 窗口当子树,把兄弟节点的输入框算给了前一个列表(实测误报 2 处),
 * 这条判据的方向必须是"看不见就不判",而不是"看不见就当有"。
 */
function elementRange(text, start, tag) {
  const openRe = new RegExp(`</?${tag}(?![\\w-])`, 'g')
  const findPropsEnd = (from) => {
    let d = 0
    for (let i = from; i < text.length; i++) {
      const c = text[i]
      if (c === '{') d++
      else if (c === '}') d--
      else if (c === '>' && d === 0) return i
    }
    return -1
  }
  const nameEnd = start + 1 + tag.length
  const propsEnd = findPropsEnd(nameEnd)
  if (propsEnd < 0) return null
  const props = text.slice(start, propsEnd + 1)
  if (text[propsEnd - 1] === '/') return { props, end: propsEnd + 1, selfClosing: true, closed: true }
  let depth = 1
  openRe.lastIndex = propsEnd + 1
  let m
  while ((m = openRe.exec(text))) {
    if (m[0].startsWith('</')) {
      depth--
      if (depth <= 0) {
        const gt = text.indexOf('>', m.index)
        return { props, end: (gt < 0 ? text.length : gt + 1), selfClosing: false, closed: true }
      }
      continue
    }
    const pe = findPropsEnd(m.index + m[0].length)
    if (pe < 0) break
    if (text[pe - 1] === '/') continue // 同名自闭标签不加深
    depth++
  }
  return { props, end: text.length, selfClosing: false, closed: false }
}

const LIST_SCROLLER_RE = /<(ScrollView|FlatList|SectionList|KeyboardAwareScrollView)(?![\w-])/g


/**
 * H3:滚动容器里会出现输入框时,必须写 `keyboardShouldPersistTaps`。
 * 默认值 `'never'` 让键盘弹起后的**第一下点击只收键盘、不触发按钮** —— 用户在浮层里填完码/参数
 * 再点"提交",第一下像没反应,正是"符合使用习惯"的直接反面。
 * 判"里面有输入框"只按两条静态可证的口径:
 *  ① 该容器直接承载 `{children}`(内容是谁传的看不见 ⇒ 按构造就必须安全);
 *  ② 该容器**自己的子树**里出现 `<TextInput` / `<TextField`(已核实 TextField 包的就是 TextInput)。
 * 声明的盲区(不判,也不记通过):列表引用了"另一个函数渲染输入框"的组件(如 ModelConfigDialog 的
 * ModelParamsBody)—— 上一版试图用 `[\s\S]{0,4000}?<TextInput` 从组件定义名一路搜,结果把**别的
 * 函数**里的输入框算给了前一个组件,HEAD 面凭空报 52 处,故整条撤掉;那种站点靠人逐屏看,不靠坏尺子。
 * 看不见输入框就放过:跨文件传进来的组件同样在盲区里,本门的绿只覆盖上面两条。
 */
function scanKeyboard(text) {
  const code = maskComments(String(text ?? ''))
  const out = []
  for (const m of code.matchAll(LIST_SCROLLER_RE)) {
    const tag = m[1]
    const r = elementRange(code, m.index, tag)
    if (!r || r.closed === false) continue // 闭标签配不平 ⇒ 区间不可信,落盲区不判
    if (/keyboardShouldPersistTaps\s*=/.test(r.props)) continue
    const subtree = code.slice(m.index, r.end)
    const after = code.slice(m.index + r.props.length, r.end)
    const directChildren = /^\s*\{\s*children\s*[,)}\n]/.test(after)
    const hasInput = /<(?:TextInput|TextField)(?![\w-])/.test(subtree)
    if (directChildren || hasInput)
      out.push({
        line: code.slice(0, m.index).split('\n').length,
        tag,
        why: directChildren ? '承载 children' : '子树含输入框',
      })
  }
  return out
}

/**
 * H4 普查(只报数):`allowFontScaling={false}` 把系统字号缩放通道关了。
 * 分两桶是因为**两类都有合法用途**,一刀切判红就是逼人跳门:
 *  - 字形桶:children 是单字符字面量/`{'×'}`/✓ 之类 —— 图标坐在定宽盒里,放大即破版;
 *  - 内容桶:children 带 `t(`、插值、单词 —— 那是正文/按钮/提示文字,关掉就等于
 *    "用户在系统里把字号调到最大,这里仍然不给放大"(FloatBox 那一格已按 useFontMultiplier 同比放大修掉)。
 * 升级前置:内容桶必须逐格改成"字号+行高同比放大"后归零(见 apps/mobile-rn/tests/rn-floatbox-font-scale.test.tsx)。
 */
function scanFontLock(text) {
  const code = maskComments(String(text ?? ''))
  const glyph = []
  const content = []
  const scaledOut = []
  for (const m of code.matchAll(/allowFontScaling\s*=\s*\{\s*false\s*\}/g)) {
    const line = code.slice(0, m.index).split('\n').length
    const tail = code.slice(m.index, m.index + 320)
    const gt = tail.indexOf('>')
    const after = gt < 0 ? '' : tail.slice(gt + 1)
    const closeAt = after.search(/<\//)
    const inner = (closeAt < 0 ? after.slice(0, 60) : after.slice(0, closeAt)).trim()
    // 已经自己按倍率放大字号+行盒的(如 FloatBox),不再算"关掉缩放";窗口取前后是因为
    // style 覆盖通常写在 allowFontScaling 之前。普查口径,判红权不在这一维。
    const win = code.slice(Math.max(0, m.index - 420), m.index + 320)
    const scaled = /fontScale|maxFontSizeMultiplier|scaleText\(/.test(win)
    const bare = inner.replace(/^\{\s*|\s*\}$/g, '').trim()
    const decoded = bare.startsWith("'") || bare.startsWith('"') || bare.startsWith('`')
      ? bare
          .slice(1, -1)
          .replace(/\\u([\da-fA-F]{4})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
          .replace(/\\./g, (c) => c[1])
      : bare
    const isGlyph =
      inner === '' ||
      (decoded.length > 0 && decoded.length <= 2 && bare !== decoded) ||
      /^(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$]*_(?:ICON|GLYPH|MARK|SYMBOL|CHAR)$/.test(bare) ||
      /(?:icon|glyph|mark|emoji|symbol|char)/i.test(bare)
    ;(scaled ? scaledOut : isGlyph ? glyph : content).push({ line, sample: inner.slice(0, 26) })
  }
  return { glyph, content, scaled: scaledOut }
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

  // 遮罩(scrim)按下去的动作就是关层,不该再要变暗;但**不透明**黑底不算遮罩。
  const scrimCls = scan(
    '<TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={close} />',
  )
  ok(scrimCls.h2.length === 0, 'H2 过头:半透黑遮罩按下去就是关层,让全屏变暗反而是闪屏')
  const scrimSheet = scan(
    'const styles = StyleSheet.create({\n  pickerOverlay: { flex: 1, backgroundColor: \'rgba(0,0,0,0.4)\' },\n})\n' +
      '<Pressable style={styles.pickerOverlay} activeOpacity={1} onPress={close} />',
  )
  ok(scrimSheet.h2.length === 0, 'H2 过头:遮罩证据写在同文件样式键里也要认')
  const scrimHex = scan(
    '<Pressable style={{ backgroundColor: \'#00000080\' }} onPress={close} />',
  )
  ok(scrimHex.h2.length === 0, 'H2 过头:8 位 hex 带 alpha 的半透黑也是遮罩')
  const solidBlack = scan('<Pressable style={{ backgroundColor: \'#000000\' }} onPress={go} />')
  ok(solidBlack.h2.length === 1, 'H2 失守:不透明黑底不是遮罩(拿它当遮罩就等于给任何黑钮发免检)')

  // 满屏可点面 / 吞点击容器:这两档都是"按下去没有东西可看"的形态,要反馈方向是反的。
  // 反向例与放行例必须同钉 —— 带 children、追加实底、真实动作的照判,否则这两档就是消红通道。
  // 遮罩色写在命名 token 里：名单由 rn-tokens 现读；认得出才算遮罩，认不出照判（更严方向）。
  setScrimTokens(new Set([
    'black20',
    'modal',
  ]))
  const scrimToken = scan('<Pressable style={rnCssLight.black20} onPress={close} />')
  ok(scrimToken.h2.length === 0, 'H2 过头：遮罩色在现读确认的 token 里，证据仍写在元素自己的 props 上')
  const unknownToken = scan('<Pressable style={rnCssLight.brandBg} onPress={go} />')
  ok(unknownToken.h2.length === 1, 'H2 失守：名单外的 token 不得当遮罩（否则任何命名样式都成了免检）')
  setScrimTokens(new Set())
  const fillLayer = scan('<Pressable style={StyleSheet.absoluteFill} onPress={close} />')
  ok(fillLayer.h2.length === 0, 'H2 过头:absoluteFill 满屏可点面自身没有视觉,叠透明度量不到变化')
  ok(fillLayer.fillLayers.length === 1, '放过必须可计数:absoluteFill 档要能报出放过几处(静默放过=没量到)')
  const fillWithChild = scan(
    '<Pressable style={StyleSheet.absoluteFill} onPress={close}><Text>可见内容</Text></Pressable>',
  )
  ok(fillWithChild.h2.length === 1, 'H2 失守:absoluteFill 还带 children ⇒ 层里有可见内容,照判')
  const fillPlusBg = scan(
    '<Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }]} onPress={close} />',
  )
  ok(fillPlusBg.h2.length === 1, 'H2 失守:absoluteFill 追加了实底 ⇒ 这一层有自己的视觉,照判')
  const inertStop = scan(
    '<Pressable style={styles.card} onPress={(e) => e.stopPropagation()}><View /></Pressable>',
  )
  ok(inertStop.h2.length === 0, 'H2 过头:只做 stopPropagation 的是吞点击容器,按下去本来就不该有事')
  const inertEmpty = scan('<Pressable style={styles.card} onPress={() => undefined}><View /></Pressable>')
  ok(inertEmpty.h2.length === 0, 'H2 过头:空实现 onPress 同样是吞点击,不是控件')
  const realPress = scan('<Pressable style={styles.card} onPress={() => open(id)}><View /></Pressable>')
  ok(realPress.h2.length === 1, 'H2 失守:真实动作的 onPress 不得被吞点击档放过')

  // Tappable 进可点原语表后,两个方向都要钉:自带反馈要放行,命中尺寸这一维不得对它失明。
  const tappable = scan('<Tappable style={{ width: 40, height: 40 }} onPress={go}><Text>a</Text></Tappable>')
  ok(tappable.h2.length === 0, 'H2 过头:Tappable 自己持有 pressed,结构上就有反馈')
  ok(tappable.h1.length === 0, 'H1 误报:Tappable 的 40×40 该被解析到(它已在射程内)')
  const tappableTiny = scan('<Tappable style={{ width: 20, height: 20 }} onPress={go} />')
  ok(tappableTiny.h1.length === 1, 'H1 失守:Tappable 进入射程后,20×20 的命中尺寸必须被点名')
  const tappableDouble = scan('<Tappable style={pressFeedback(styles.a)} onPress={go} />')
  ok(tappableDouble.h2.length === 1, 'H2 失守:Tappable 上再叠 pressFeedback = 函数形态回潮,必须判')

  // H3 键盘点击穿透:承载 children 的滚动容器 / 子树里有输入框的滚动容器,必须声明该属性
  const carrier = scanKeyboard(
    '<Modal visible><KeyboardAvoidingView><ScrollView style={a}>{children}</ScrollView></KeyboardAvoidingView></Modal>',
  )
  ok(carrier.length === 1 && carrier[0].why === '承载 children', 'H3 失效:承载 children 的滚动区内容看不见,必须默认安全')
  const withInput = scanKeyboard(
    '<ScrollView horizontal><View><TextInput value={v} /></View></ScrollView>',
  )
  ok(withInput.length === 1, 'H3 失效:子树里有输入框却没声明,第一下点击会被键盘吞掉')
  const declared = scanKeyboard(
    '<ScrollView keyboardShouldPersistTaps="handled"><TextInput value={v} /></ScrollView>',
  )
  ok(declared.length === 0, 'H3 误报:已声明就不该判')
  // 反向对照:输入框在兄弟节点(不在子树里)不算 —— 上一版用 +3000 字窗口就是这么误报的
  const sibling = scanKeyboard(
    '<View><ScrollView horizontal>{chips.map((c) => <Text key={c}>{c}</Text>)}</ScrollView><TextInput value={v} /></View>',
  )
  ok(sibling.length === 0, 'H3 过头:兄弟节点的输入框被算给了列表(窗口式子树匹配的病灶)')
  // 声明的盲区(不是通过):同文件里"另一个函数渲染输入框、本列表只引用它"这一型静态认不出
  // —— 上一版用 `[\s\S]{0,4000}?<TextInput` 从定义名一路搜,把**别的函数**里的输入框算给了
  // 前一个组件,HEAD 面凭空报出 52 处(实测其中多数即此型)。宁可留可见的盲区,不要拿坏尺子逼人改代码。
  const localBody = scanKeyboard(
    'function ModelParamsBody(){return <TextField value={1} />}\n<ScrollView><ModelParamsBody config={c} /></ScrollView>',
  )
  ok(localBody.length === 0, 'H3 过头:同文件组件推断已按坏尺子撤掉,这里必须读成盲区而不是命中')

  const clean = scanKeyboard('<ScrollView>{items.map((i) => <Row key={i.id} />)}</ScrollView>')
  ok(clean.length === 0, 'H3 过头:没有输入框的列表不该被要求声明该属性')

  const lock = scanFontLock(
    `<Text allowFontScaling={false}>{'×'}</Text><Text allowFontScaling={false}>{t('about.title')}</Text>`,
  )
  ok(
    lock.glyph.length === 1 && lock.content.length === 1,
    'H4 分桶失效:字形与内容必须分开报,混成一桶就是把几十处图标也判成缺陷',
  )

  // —— 判序方向锁。立因:2026-10-31 那次改稿把 `if (r.h2.length > base.h2.length)` 吃成语句 `NaN`
  // (ASI 合法 ⇒ 不报语法错),H2 于是**无条件报项**,任何触碰带 H2 存量文件的提交都会红,
  // 而当时 41 组自检全绿没抓到 —— 判序住在主流程里,自检走不到。抽成纯函数后这一族断言就是接线锁。
  const R = (o) => ({ h1: [], h2: [], h3: [], h4: { glyph: [], content: [], scaled: [] }, ...o })
  const V = (r, base) => stagedVerdict('x.tsx', r, base)
  const many = (n) => Array.from({ length: n }, (_, i) => ({ line: i + 1, tag: 'Pressable' }))
  ok(V(R({}), R({})).length === 0, '判序失效:四维全空的改动必须放行')
  ok(
    V(R({ h2: many(5) }), R({ h2: many(5) })).length === 0,
    'H2 持平即红 ⇒ 恒红门(§12e):NaN 那一型就是这么漏进来的',
  )
  ok(
    V(R({ h2: many(4) }), R({ h2: many(9) })).length === 0,
    'H2 减少必须放行:改少了是好事,拦它等于罚整改',
  )
  ok(V(R({ h2: many(6) }), R({ h2: many(5) })).length === 1, 'H2 新增必须拦(棘轮的另一半)')
  ok(
    V(R({ h1: [{ line: 3, tag: 'TouchableOpacity', size: '24×24', eff: 24 }] }), R({})).length === 1,
    'H1 绝对零容忍失效',
  )
  ok(
    V(R({ h3: [{ line: 9, tag: 'ScrollView', why: '子树含输入框' }] }), R({})).some((s) =>
      /keyboardShouldPersistTaps/.test(s),
    ),
    'H3 绝对零容忍失效:缺该属性的滚动区没进判红清单',
  )
  ok(
    V(R({ h4: { glyph: [{ line: 1 }], content: [], scaled: [] } }), R({})).length === 0,
    'H4 字形桶不得判红:×/✓ 坐定宽盒里,放大即破版',
  )
  ok(
    V(R({ h4: { glyph: [], content: [{ line: 2, sample: '标题' }], scaled: [] } }), R({})).length ===
      1,
    'H4 内容桶必须判红',
  )
  ok(
    V(R({ h2: many(2) }), R({})).length === 1,
    '新建文件(HEAD 面无存量可宽)带 2 处无反馈必须拦 —— base 取不到不等于放行',
  )

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
  let fillLayerTotal = 0
  let inertTotal = 0
  let h4Glyph = 0
  let h4Content = 0
  let h4Scaled = 0
  const TOKENS_REL = 'packages/design-tokens/src/rn-tokens.ts'
  try {
    // 按被审面显式取（与档位同一基准 §0.4）：head→HEAD:、staged→索引 :、worktree→盘上。
    const spec = face === 'head' ? `HEAD:${'${TOKENS_REL}'}` : face === 'staged' ? `:${'${TOKENS_REL}'}` : null
    const tokenSrc = spec
      ? (catBatch(ROOT, [spec], { maxBuffer: 1 << 26, timeout: 120000 }).get(spec) ?? null)
      : readWorktreeFile(ROOT, TOKENS_REL)
    if (typeof tokenSrc !== "string") throw new Error("取不到被审面的 rn-tokens")
    const n = setScrimTokens(scrimTokenNames(tokenSrc))
    if (!quiet && n === 0)
      console.log(
        "ℹ️ rn-tokens 里没现读到半透明黑 token ⇒ 遮罩 token 档不生效（判据更严方向，安全）",
      )
  } catch {
    if (!quiet) console.log('ℹ️ rn-tokens 取不到 ⇒ 遮罩 token 档不生效（判据更严方向，安全）')
  }

  for (const rel of files) {
    const text = get(rel)
    if (text === null || text === undefined) {
      undetermined += 1
      continue
    }
    const r = scanText(text, minTap, rel)
    blind += r.skipped.length
    slopOnlyTotal += r.slopOnly.length
    fillLayerTotal += r.fillLayers.length
    inertTotal += r.inertPresses.length
    h4Glyph += r.h4.glyph.length
    h4Content += r.h4.content.length
    h4Scaled += r.h4.scaled.length
    if (r.h1.length || r.h2.length || r.h3.length) perFile.set(rel, r)
  }
  const totalH1 = [...perFile.values()].reduce((s, r) => s + r.h1.length, 0)
  const totalH2 = [...perFile.values()].reduce((s, r) => s + r.h2.length, 0)
  const totalH3 = [...perFile.values()].reduce((s, r) => s + r.h3.length, 0)

  if (!quiet) {
    console.log(
      `[check-rn-interaction-hygiene] 面=${FACE_LABEL[face]} | ${files.length} 文件 | 档位 ${minTap}(现读 ${GEO_REL}) | 命中尺寸<${minTap}: ${totalH1} 处 / ${perFile.size} 文件;无按压反馈: ${totalH2} 处;滚动容器含输入框却没写 keyboardShouldPersistTaps: ${totalH3} 处(提交链绝对零容忍,2026-10-31 存量 34→0;闭标签配不平的候选不进这一维 ⇒ 落盲区不判红);盲区(静态判不了): ${blind} 处;关系统字号缩放: ${h4Content} 处内容文字 / ${h4Glyph} 处图标字形 / ${h4Scaled} 处已按倍率同比放大(只报数,两桶各有合法用途);只靠 hitSlop 过关的跨端源: ${slopOnlyTotal} 处(小程序腿无该机制,本门不判红、进普查);满屏可点面(absoluteFill 自闭合)放过 ${fillLayerTotal} 处 / 吞点击容器放过 ${inertTotal} 处(两档各带反向自检例,带视觉或真实动作的照判)`,
    )
    if (argv.includes('--list')) {
      for (const [rel, r] of perFile)
        for (const v of r.h1)
          console.log(`   H1 ${rel}:${v.line} <${v.tag}> ${v.size}(补 hitSlop 后实得 ${v.eff})`)
      for (const [rel, r] of perFile)
        for (const v of r.h2) console.log(`   H2 ${rel}:${v.line} <${v.tag}> 无按压反馈`)
      for (const [rel, r] of perFile)
        for (const v of r.h3)
          console.log(`   H3 ${rel}:${v.line} <${v.tag}> ${v.why} ⇒ 缺 keyboardShouldPersistTaps`)
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
    const headText = headTexts.get(`HEAD:${rel}`) ?? null
    const base =
      headText === null
        ? { h1: [], h2: [], h3: [], h4: { glyph: [], content: [], scaled: [] } }
        : scanText(headText, minTap, rel)
    // 判序委托给纯函数(自检钉它;主流程里再写一遍就是两份真相)
    for (const msg of stagedVerdict(rel, r, base)) added.push(msg)
  }
  if (added.length) {
    console.error(`❌ 本次把交互卫生问题加回来了 ${added.length} 项(存量只报数,新增即拦):`)
    for (const a of added.slice(0, 12)) console.error(`   ${a}`)
    console.error(
      `   改法:命中方块取档位 rnGeometry.tapBox(${minTap})(或给既有小图标补 hitSlop);` +
        '按压反馈用 onPressIn/onPressOut、children 函数形态 `{({ pressed })` 或 className `active:` 变体' +
        '(函数形态 style 会被 cssInterop 吃掉 —— 守门 131)。',
    )
    console.error(
      '   H4 改法:`style={[styles.x, scaleText(styles.x)]}`(它按唯一口倍率同比放大 fontSize 与 lineHeight,' +
        '倍率=1 时返回 {} ⇒ 默认观感零变化);图标字形(×/✓/emoji 坐在定宽盒里)不算内容文字,不判。',
    )
    console.error(
      '   H3 改法:给滚动容器(ScrollView/FlatList/SectionList/KeyboardAwareScrollView)补 ' +
        'keyboardShouldPersistTaps="handled" —— 默认 never 会让键盘弹起后的第一下点击只收键盘、' +
        '不触发按钮(小程序 rn-compat 不认这个 RN 原语,由该层显式取用白名单挡住,不会漏进 Taro prop)。',
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
  isScrim,
  isTranslucentBlack,
  scrimByStyle,
  scrimTokenNames,
  setScrimTokens,
  isScrimToken,
  isFillLayer,
  isInertPress,
  scanKeyboard,
  elementRange,
  scanFontLock,
  stagedVerdict,
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
