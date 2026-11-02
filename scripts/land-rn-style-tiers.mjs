#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出落档报告 */
/**
 * land-rn-style-tiers.mjs — 把 RN/共享源 StyleSheet 里「等值命中档表」的裸数字
 * 改写为档位引用(写盘器物,默认只读预演,默认只做间距)。
 *
 * 立因(2026-10-31,`check-web-rn-style-tiers.mjs` 现读):RN 侧 4257 处非色档裸数字里
 * 1838 处的**值恰好等于某档**,只是写成了字面量。字面量的后果是:改 `SPACING_STEPS`
 * 之后 web 与小程序随派生链动,**RN 屏幕不动** —— 于是"web 调档 ⇒ RN 自动跟随"对这批
 * 位置根本不成立。本器物把"值对但不跟随"收敛成"值对且跟随",且**等值改写 ⇒ 像素零变化**。
 *
 * 三条硬边界:
 *   ① **只改等值命中档表的数**。档外的数(如 14/13/5)一律不动 —— 那是"该落哪一档"的判断,
 *      归尺子的 fork 桶点名给人,不归器物猜。
 *   ② **只改 `StyleSheet.create({...})` 花括号内**的键(括号配对取区间,不用正则截)。
 *      块外的同名键(普通 config 对象)不动;含 `Platform.` 的行整行跳过(同一键按平台分叉)。
 *   ③ **字号/圆角默认不碰**,须显式开关:
 *      · `--include-font-size`:只改**同一 style 对象里没有 lineHeight** 的 fontSize。
 *        字号与 lineHeight 是尺寸配对:有 lineHeight 的对象单改字号,改档后就会"字号跟了、
 *        行高没跟";没有 lineHeight 的对象行高由字号派生,单改字号不产生新分叉。
 *        fontWeight 与尺寸无关(字体粗细不随字号档变),不构成阻断。
 *      · `--include-font-size-pair`(2026-11-02 Phase 3):**整对象成对替换** —— 仅当同一
 *        style 对象里 `fontSize` 与 `lineHeight` **同时精确等于同一档**时才替换,两值一起写成
 *        `rnType.<step>.size` / `rnType.<step>.lineHeight`;任一半不等值、行高不是字面量、
 *        或对象顶层出现多个 lineHeight ⇒ 整个对象不动,按原因计数(skipped.pair*)。
 *        **不得用 `...rnType.x` 展开** —— 展开会把 weight 一并注入,改变字重观感。
 *        只给本开关时,不带 lineHeight 的 fontSize 不碰(那属于上一条腿的射程)。
 *      · `--include-radius`:只改等值命中 `RADIUS_STEPS` 的 borderRadius;同值双档名
 *        (8px = DEFAULT / lg)取**角色表在用的那一档**(lg,与 RADIUS_ROLES.card 同源)。
 *
 * 本轮(2026-11-02 Phase 2)的用法是:默认间距腿已收敛(预演 0 处),再以
 * `--include-font-size --include-radius` 收「同值仅缺引用」的剩余安全子集。
 *
 * 水印(§5c 强制):逐文件 `watermark clean` → 改写 → `watermark inject`。
 *   已实测往返**字节等价**(同一文件 clean+inject 后 sha256 不变),故未改动的文件不会被
 *   本器物碰出任何 diff;inject 后逐文件 `watermark verify` 复核,失败即回滚该文件原字节。
 *
 * 归属避让(多会话共享工作区):`git status --porcelain` 对该文件非空 ⇒ 跳过并点名(held)。
 *   判据单源 = `scripts/lib/git-paths.mjs` 的 `ownershipDirtyPaths` + `isCleanOwned`(2026-11-03 提库)。
 *   不判"脏是谁的"—— 脏就说明有人在用,猜归属的代价比少改一个文件大得多。
 *
 * 幂等:已是 `rnSpacing.x` 的位置不会再命中数字正则 ⇒ 重跑改 0 处。
 *
 * 用法:
 *   node scripts/land-rn-style-tiers.mjs                     # 只读预演(默认,只做间距)
 *   node scripts/land-rn-style-tiers.mjs --apply             # 落盘
 *   node scripts/land-rn-style-tiers.mjs --include-font-size # 追加字号等值腿(安全子集)
 *   node scripts/land-rn-style-tiers.mjs --include-font-size-pair # 字号+行高整对象成对腿
 *   node scripts/land-rn-style-tiers.mjs --include-radius    # 追加圆角等值腿
 *   node scripts/land-rn-style-tiers.mjs --file <path>       # 单文件试点(可重复给)
 *   node scripts/land-rn-style-tiers.mjs --limit <n>         # 最多动 n 个文件
 *   node scripts/land-rn-style-tiers.mjs --json              # 机器可读
 *   node scripts/land-rn-style-tiers.mjs --self-test
 *
 * 退出码:0 正常(含"改 0 处");2 用法错/取不到档表/注入校验失败。
 *
 * 写盘凭据(2026-11-03 接线):--apply 每轮把本批产出逐路径**实测 oid** 后追写申报账本
 *   .ihui-agent/state/cross-end-landing.jsonl(库 = scripts/lib/cross-end-landing-ledger.mjs,
 *   收编侧按 blob 逐字节核验后才收);下一轮开始先把"在册 ∧ blob 相符"的路径整轮跳过(可续跑)。
 *   dry-run / 预演档零登记。结论行机读键:landing=<登记枚数> landingPath=<账本相对路径>
 *   skipLanded=<跳过数>[ledger=unjudged][landingError=<原因>]。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
import { parseTokenTables } from './sync-css-tokens.mjs'
import { appendLanding, collectiblePaths, ledgerPathFor } from './lib/cross-end-landing-ledger.mjs'
// 归属避让判据的唯一实现(2026-11-03 提库,§0.6):四枚写盘腿(本器 + web/miniapp lander +
// gen-ui-mirror + fix-rn-color-literals)一起 import 这一份,不得再各写一份(门 191)。
import { isCleanOwned, ownershipDirtyPaths } from './lib/git-paths.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WATERMARK = join(ROOT, 'scripts', 'watermark.mjs')

/**
 * 腿短名 = 本脚本文件名。guardian 的 sweepRnStyleTiers 派发的正是 `land-rn-style-tiers.mjs`
 * (git-guardian.mjs 现读:join(...,'land-rn-style-tiers.mjs')),账本复合主键用,三端逐字同构,不得改。
 */
export const LEG_NAME = 'land-rn-style-tiers'

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
// 字号/圆角腿默认关闭:守护轮(30 分钟一轮)只跑默认面,不会自己把这两腿打开。
const includeFontSize = argv.includes('--include-font-size')
// 成对腿:字号与行高同一档才替换;只给本开关时,无 lineHeight 的 fontSize 不碰。
const includeFontSizePair = argv.includes('--include-font-size-pair')
const includeFontSizeAny = includeFontSize || includeFontSizePair
const includeRadius = argv.includes('--include-radius')
const limit = (() => {
  const i = argv.indexOf('--limit')
  if (i < 0) return Infinity
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n <= 0) {
    console.error('❌ --limit 需要一个正整数')
    process.exit(2)
  }
  return n
})()
const onlyFiles = argv.reduce((acc, a, i) => (a === '--file' && argv[i + 1] ? [...acc, argv[i + 1]] : acc), [])

const RN_DIRS = ['apps/mobile-rn/src', 'packages/app/src', 'packages/ui-native/src']
const SPACING_REL = 'packages/design-tokens/src/spacing.ts'
const TYPOGRAPHY_REL = 'packages/design-tokens/src/typography.ts'
const ELEVATION_REL = 'packages/design-tokens/src/elevation.ts'
const RADIUS_REL = 'packages/design-tokens/src/radius.js'

// 间距属性:只收直接取数值的那些(不含 transform 之类复合对象)
const SPACING_PROPS = [
  'gap',
  'rowGap',
  'columnGap',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
]

/** 从 HEAD blob 读一份源;取不到 ⇒ null(由调用方判"未判定")。 */
function readHead(rel) {
  try {
    return String(gitRaw(['show', `HEAD:${rel}`], ROOT))
  } catch {
    return null
  }
}

/** 档表:从 HEAD 三源读,交派生器的同一把尺解析(§0.6 零复算)。取不到 ⇒ exit 2。 */
function loadHeadTables() {
  const spacing = readHead(SPACING_REL)
  const typography = readHead(TYPOGRAPHY_REL)
  const elevation = readHead(ELEVATION_REL)
  if (spacing === null || typography === null || elevation === null) {
    console.error('❌ 档表源取不到(HEAD 面)⇒ 未判定,拒绝改写')
    process.exit(2)
  }
  return { tables: parseTokenTables({ spacing, typography, elevation }), radiusText: readHead(RADIUS_REL) }
}

/** 间距:值 → 档名。0 不落档(0 走 rnSpacing.none 只是噪声,不比字面量更能跟随任何东西)。 */
function loadSpacingSteps(tables) {
  const byValue = new Map()
  for (const [step, px] of Object.entries(tables.SPACING_STEPS)) {
    const v = Number(px)
    if (v === 0) continue
    if (byValue.has(v)) {
      console.error(`❌ 档表里 ${v}px 有两个档名(${byValue.get(v)} / ${step})⇒ 无法无歧义落档,拒绝改写`)
      process.exit(2)
    }
    byValue.set(v, step)
  }
  return byValue
}

/** 字号:size → 档名。同值双档直接拒绝(与间距同一条纪律)。 */
function loadTypeSteps(tables) {
  const byValue = new Map()
  for (const [step, def] of Object.entries(tables.TYPE_STEPS)) {
    const v = Number(def.size)
    if (byValue.has(v)) {
      console.error(`❌ 字号档里 ${v}px 有两个档名(${byValue.get(v)} / ${step})⇒ 无法无歧义落档,拒绝改写`)
      process.exit(2)
    }
    byValue.set(v, step)
  }
  return byValue
}

/**
 * 字号成对:`size|lineHeight` → 档名。仅当两值同时命中**同一档**才允许成对替换;
 * 同一对出现两个档名 ⇒ 无法无歧义落档,拒绝改写。
 */
function loadTypePairs(tables) {
  const byPair = new Map()
  for (const [step, def] of Object.entries(tables.TYPE_STEPS)) {
    const key = `${Number(def.size)}|${Number(def.lineHeight)}`
    if (byPair.has(key)) {
      console.error(`❌ 字号档里 ${key} 有两个档名(${byPair.get(key)} / ${step})⇒ 无法无歧义成对落档,拒绝改写`)
      process.exit(2)
    }
    byPair.set(key, step)
  }
  return byPair
}

/**
 * 圆角:值 → 档名。RADIUS_STEPS 里 8px 同时是 DEFAULT 与 lg(有意同值),
 * 取**角色表在用的那一档**(RADIUS_ROLES.card = lg)。其余同值双档同样拒绝。
 */
function loadRadiusSteps(radiusText) {
  if (radiusText === null) {
    console.error(`❌ 圆角档源取不到(HEAD 面):${RADIUS_REL} ⇒ 未判定,拒绝改写`)
    process.exit(2)
  }
  const stepsMatch = radiusText.match(/RADIUS_STEPS\s*=\s*\{([^}]*)\}/)
  if (!stepsMatch) {
    console.error('❌ RADIUS_STEPS 解不出 ⇒ 未判定,拒绝改写')
    process.exit(2)
  }
  const steps = new Map()
  for (const pair of stepsMatch[1].matchAll(/([A-Za-z0-9_'-]+)\s*:\s*([0-9.]+)/g))
    steps.set(pair[1].replace(/['"]/g, ''), Number(pair[2]))
  const rolesMatch = radiusText.match(/RADIUS_ROLES\s*=\s*\{([^}]*)\}/)
  const roleTargets = new Set()
  if (rolesMatch) for (const pair of rolesMatch[1].matchAll(/([A-Za-z0-9_'-]+)\s*:\s*['"]([^'"]+)['"]/g)) roleTargets.add(pair[2])
  const byValue = new Map()
  for (const [step, px] of steps) {
    if (!byValue.has(px)) {
      byValue.set(px, step)
      continue
    }
    const prev = byValue.get(px)
    if (roleTargets.has(step) && !roleTargets.has(prev)) byValue.set(px, step)
    else {
      console.error(`❌ 圆角档里 ${px}px 有两个档名(${prev} / ${step})且都不是唯一角色档 ⇒ 拒绝改写`)
      process.exit(2)
    }
  }
  return byValue
}

/** 从 startIdx(指向 '(' 之后)找配对的 '}';跳过字符串与注释。返回块内区间 [from, to)。 */
function styleSheetRanges(src) {
  const ranges = []
  const re = /StyleSheet\.(?:create|flatten)\s*\(\s*\{/g
  let m
  while ((m = re.exec(src))) {
    const openBrace = src.indexOf('{', m.index)
    let depth = 0
    let i = openBrace
    for (; i < src.length; i += 1) {
      const c = src[i]
      if (c === '/' && src[i + 1] === '/') {
        const nl = src.indexOf('\n', i + 2)
        i = nl < 0 ? src.length : nl
        continue
      }
      if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2)
        i = end < 0 ? src.length : end + 1
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        const q = c
        i += 1
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') i += 1
          i += 1
        }
        continue
      }
      if (c === '{') depth += 1
      else if (c === '}') {
        depth -= 1
        if (depth === 0) {
          ranges.push([openBrace, i + 1])
          break
        }
      }
    }
  }
  return ranges
}

/**
 * 按位抹白注释与字符串内容(保留长度与换行)⇒ 索引与原文一一对应,
 * 且注释里的 `padding: 10`、字符串里的 "{ padding: 10 }" 不会被当成代码改写。
 */
export function maskLiterals(src) {
  const out = src.split('')
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    if (quote) {
      if (c === '\\') {
        if (src[i + 1] !== '\n') {
          out[i] = ' '
          out[i + 1] = ' '
        } else out[i] = ' '
        i += 2
        continue
      }
      if (c === quote) {
        quote = null
        i += 1
        continue
      }
      if (c !== '\n') out[i] = ' '
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      i += 1
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        out[i] = ' '
        i += 1
      }
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i += 1
      }
      if (i < src.length) {
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
      }
      continue
    }
    i += 1
  }
  return out.join('')
}

/** 从 pos 向前找最近未闭合的 `{` 并向后配对(只在抹白文本上做,字符串/注释不会干扰)。 */
export function objectAround(masked, pos) {
  let depth = 0
  for (let i = pos; i >= 0; i -= 1) {
    if (masked[i] === '}') depth += 1
    else if (masked[i] === '{') {
      if (depth === 0) {
        let d = 0
        for (let j = i; j < masked.length; j += 1) {
          if (masked[j] === '{') d += 1
          else if (masked[j] === '}') {
            d -= 1
            if (d === 0) return [i, j + 1]
          }
        }
        return null
      }
      depth -= 1
    }
  }
  return null
}

/**
 * 只保留对象**顶层**的文本(长度与原文一一对应):嵌套 `{...}` / 数组 / 括号内部抹白。
 * 用于「同一 style 对象里的 lineHeight」判定 —— 嵌套对象里的 lineHeight 不属于本对象,
 * 不抹白就会把 `{ fontSize: 14, inner: { lineHeight: 20 } }` 错配成同一对。
 */
export function topLevelText(masked, obj) {
  const out = masked.slice(obj[0], obj[1]).split('')
  let depth = 0
  for (let i = 0; i < out.length; i += 1) {
    const c = out[i]
    if (c === '{' || c === '[' || c === '(') {
      depth += 1
      if (depth > 1) out[i] = ' '
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      if (depth > 1) out[i] = ' '
      depth -= 1
      continue
    }
    if (depth > 1 && c !== '\n') out[i] = ' '
  }
  return out.join('')
}

/** 行高字面量:`lineHeight: 20`(值必须是裸数字,后接 , 或 })。 */
const LINE_HEIGHT_LITERAL_SRC = '\\blineHeight\\s*:\\s*(-?)(\\d+(?:\\.\\d+)?)(?=\\s*(?:,|\\}))'

/** 档名 → 引用表达式。合法标识符用点号,否则方括号。 */
function refOf(root, step, suffix = '') {
  const head = /^[A-Za-z_$][\w$]*$/.test(step) ? `${root}.${step}` : `${root}['${step}']`
  return head + suffix
}

const KIND_PROPS = {
  spacing: SPACING_PROPS,
  fontSize: ['fontSize'],
  radius: ['borderRadius'],
}
const KIND_REF = {
  spacing: { root: 'rnSpacing', symbol: 'rnSpacing', suffix: '' },
  fontSize: { root: 'rnType', symbol: 'rnType', suffix: '.size' },
  radius: { root: 'rnRadius', symbol: 'rnRadius', suffix: '' },
}

/**
 * 单文件变换(纯函数:输入源码 + 档表,输出新源码与改动明细)。
 * `byValue` = 间距档(与原签名兼容);`opts.typeByValue` / `opts.radiusByValue` 为显式开关。
 * `opts.pairByValue`(size|lineHeight → 档名)启用整对象成对替换;
 * `opts.fontSizePairsOnly` 让没有 lineHeight 的 fontSize 不碰(只开成对腿时用)。
 */
export function transform(src, byValue, opts = {}) {
  const maps = { spacing: byValue ?? null, fontSize: opts.typeByValue ?? null, radius: opts.radiusByValue ?? null }
  if (!maps.spacing && !maps.fontSize && !maps.radius) return { text: src, changes: [], reason: 'no-stylesheet' }
  const masked = maskLiterals(src)
  const ranges = styleSheetRanges(masked)
  if (ranges.length === 0) return { text: src, changes: [], reason: 'no-stylesheet' }
  const inRange = (pos) => ranges.some(([a, b]) => pos >= a && pos < b)
  // 行首表按 `\n` 建(CRLF 也不会错位);含 Platform. 的行整行跳过(同一键按平台分叉)
  const lineStarts = [0]
  for (let i = 0; i < masked.length; i += 1) if (masked[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (pos) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const lineText = (li) => masked.slice(lineStarts[li], lineStarts[li + 1] ?? masked.length)
  const platformLine = lineStarts.map((_, li) => /Platform\./.test(lineText(li)))

  const hits = []
  const changes = []
  const skipped = {
    lineHeight: 0,
    outsideSheet: 0,
    platform: 0,
    pairMismatch: 0,
    pairNonLiteral: 0,
    pairAmbiguous: 0,
    pairNoLineHeight: 0,
  }
  for (const [kind, map] of Object.entries(maps)) {
    if (!map) continue
    const propAlt = KIND_PROPS[kind].join('|')
    const RE = new RegExp(`(\\b(?:${propAlt})\\s*:\\s*)(-?)(\\d+(?:\\.\\d+)?)(?=\\s*(?:,|\\}))`, 'g')
    const { root, symbol, suffix } = KIND_REF[kind]
    for (const m of masked.matchAll(RE)) {
      const pos = m.index
      if (!inRange(pos)) {
        skipped.outsideSheet += 1
        continue
      }
      const li = lineOf(pos)
      if (platformLine[li]) {
        skipped.platform += 1
        continue
      }
      // 字号安全子集:同一 style 对象里带 lineHeight ⇒ 单改字号会造成"字号跟了、行高没跟"。
      // 成对腿开启时,只有 size 与 lineHeight **同时**精确等于同一档才两值一起替换。
      if (kind === 'fontSize') {
        const obj = objectAround(masked, pos)
        if (obj) {
          const top = topLevelText(masked, obj)
          if (/\blineHeight\s*:/.test(top)) {
            if (!opts.pairByValue) {
              skipped.lineHeight += 1
              continue
            }
            const lhAll = [...top.matchAll(new RegExp(LINE_HEIGHT_LITERAL_SRC, 'g'))]
            if (lhAll.length === 0) {
              skipped.pairNonLiteral += 1
              continue
            }
            if (lhAll.length > 1) {
              skipped.pairAmbiguous += 1
              continue
            }
            const lh = lhAll[0]
            const pairStep = opts.pairByValue.get(`${Math.abs(Number(m[3]))}|${Math.abs(Number(lh[2]))}`)
            if (!pairStep) {
              skipped.pairMismatch += 1
              continue
            }
            const lhStart = obj[0] + lh.index
            const lhKey = lh[0].slice(0, lh[0].length - lh[1].length - lh[2].length)
            const prop = m[1].replace(/\s*:\s*$/, '').trim()
            changes.push({ kind, prop, value: Number(m[3]), step: pairStep, ref: refOf(root, pairStep, suffix), symbol, pair: true })
            changes.push({
              kind: 'lineHeight',
              prop: 'lineHeight',
              value: Number(lh[2]),
              step: pairStep,
              ref: refOf('rnType', pairStep, '.lineHeight'),
              symbol,
              pair: true,
            })
            hits.push({ start: pos, end: pos + m[1].length + m[2].length + m[3].length, text: `${m[1]}${m[2]}${refOf(root, pairStep, suffix)}` })
            hits.push({
              start: lhStart,
              end: lhStart + lh[0].length,
              text: `${lhKey}${lh[1]}${refOf('rnType', pairStep, '.lineHeight')}`,
            })
            continue
          }
          if (opts.pairByValue && opts.fontSizePairsOnly) {
            skipped.pairNoLineHeight += 1
            continue
          }
        }
      }
      const raw = Number(m[3])
      const v = kind === 'radius' ? raw : Math.abs(raw)
      const step = map.get(v)
      if (!step) continue // 档外值:该落哪一档是判断,不归器物猜
      const ref = refOf(root, step, suffix)
      const prop = m[1].replace(/\s*:\s*$/, '').trim()
      changes.push({ kind, prop, value: raw, step, ref, symbol })
      hits.push({ start: pos, end: pos + m[1].length + m[2].length + m[3].length, text: `${m[1]}${m[2]}${ref}` })
    }
  }
  let text = src
  for (const h of hits.sort((a, b) => b.start - a.start))
    text = text.slice(0, h.start) + h.text + text.slice(h.end)
  return { text, changes, skipped, reason: null }
}

const IMPORT_STMT_RE = /import\s+(?:type\s+)?(?:[^'"]*?\bfrom\s*)?['"][^'"]+['"]/g

/**
 * 该符号是否**已在某条 import 语句里**。
 * ⚠ 不能写成"全文含该符号":`transform` 刚把 `rnSpacing` 写进正文,用全文判定会永远认为
 *    "已 import" ⇒ 从不补齐 ⇒ 落出一批 `Cannot find name 'rnSpacing'`(实测 79 文件/1386 处)。
 *    夹具锁在 `--self-test` 的"改写后的正文不得被当成已 import"那一条。
 */
export function hasSymbolImport(src, symbol) {
  const re = new RegExp(`\\b${symbol}\\b`)
  for (const m of src.matchAll(IMPORT_STMT_RE)) if (re.test(m[0])) return true
  return false
}

/** 补齐 import:已有含该符号的 import ⇒ 不动;有该包具名 import ⇒ 并入;否则插在最后一条 import 后。 */
export function ensureImport(src, symbol) {
  if (hasSymbolImport(src, symbol)) return { text: src, added: false, reason: null }
  const stmt = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'@ihui/design-tokens'`)
  const m = src.match(stmt)
  if (m) {
    const names = m[1].trim()
    const insert = names.length === 0 ? symbol : `${names.replace(/,\s*$/, '')}, ${symbol}`
    return { text: src.replace(m[0], `import { ${insert} } from '@ihui/design-tokens'`), added: true, reason: null }
  }
  // 没有该包的具名 import ⇒ 插在最后一条顶层 import 语句之后
  const importRe = /^import\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm
  let last = null
  let im
  while ((im = importRe.exec(src))) last = im
  if (!last) return { text: src, added: false, reason: 'no-import-anchor' }
  const at = last.index + last[0].length
  const line = `\nimport { ${symbol} } from '@ihui/design-tokens'`
  return { text: src.slice(0, at) + line + src.slice(at), added: true, reason: null }
}

/**
 * 按需补齐多个符号的 import。任一符号找不到 import 锚点 ⇒ 整文件放弃(不写半套悬空标识符)。
 * 返回 `added` 是本次真补上的符号清单(用于报告「补 import」)。
 */
export function ensureAllImports(src, symbols) {
  let text = src
  const added = []
  for (const symbol of symbols) {
    const r = ensureImport(text, symbol)
    if (r.reason === 'no-import-anchor') return { text: src, added: [], reason: 'no-import-anchor' }
    if (r.added) added.push(symbol)
    text = r.text
  }
  return { text, added, reason: null }
}

function watermark(cmd, file) {
  // 内联写 windowsHide:门 52 的判据只认 options 字面量,不认变量引用
  return execFileSync(process.execPath, [WATERMARK, cmd, file], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

// 归属避让:判据已提库(2026-11-03)⇒ `scripts/lib/git-paths.mjs` 的 `isCleanOwned` +
// `ownershipDirtyPaths`,本器只在 run() 里取一次整树脏集。此处不再留第二份实现(§0.6/门 191)。

// ─── 写盘凭据账本(cross-end-landing-ledger 接线,2026-11-03 立)──────────────────
// 治两条根因:R1 无凭据(写盘没留"谁写的、写成什么 blob",收编器无从正当收编)、
// R2 不可续跑(超时轮从头再来,永远跑不完永远 unjudged)。
// 本层零复算判据:取 oid 与账本库 worktree 面同一把尺(gitRaw hash-object,face-reader 出口),
// "已落集合"直接复用 collectiblePaths(quietMs=0),登记/读账本一律走库出口(§0.6)。

/** 账本相对路径(正斜杠),结论行 landingPath= 键用;真相源 = 库的 ledgerPathFor。 */
export const LEDGER_REL = relative(ROOT, ledgerPathFor(ROOT)).replace(/\\/g, '/')

/** 路径在工作树面的当前 blob oid —— 与账本库 currentOidsForFace(worktree) 逐字同一把尺。 */
export function blobOidOf(rel, { root = ROOT } = {}) {
  return String(gitRaw(['hash-object', '--', rel], root)).trim().toLowerCase()
}

/**
 * 本 leg 已登记 ∧ 工作树 blob 仍相符的路径集合(⇒ 本轮跳过,即幂等续跑)。
 * 账本读不到 ⇒ {ok:false}:调用方必须回落现行为(照旧全量尝试)并在结论行标
 * ledger=unjudged —— 失效方向是"多做一遍",绝不是"少做一遍"或判死。
 */
export function landedPathsOf({ root = ROOT, leg = LEG_NAME, now = new Date() } = {}) {
  const r = collectiblePaths(now, { quietMs: 0, face: 'worktree', root })
  if (!r.ok) return { ok: false, reason: r.reason, paths: new Set() }
  return { ok: true, paths: new Set(r.collectible.filter((c) => c.leg === leg).map((c) => c.path)) }
}

/**
 * 落盘成功后一次批量登记:逐路径**写完盘后实测** oid(绝不取 HEAD 旧值)→ appendLanding。
 * 本体永不抛(账本不可写只如实报 landingError,§0.3);同轮共用一个 ISO 时刻。
 */
export function registerLanding(paths, { root = ROOT, leg = LEG_NAME, at = new Date().toISOString() } = {}) {
  if (!paths.length) return { ok: true, landing: 0, deduped: 0, rejected: [] }
  try {
    const list = paths.map((p) => ({ at, leg, path: p, blobOid: blobOidOf(p, { root }) }))
    const r = appendLanding(list, { root })
    return { ok: true, landing: r.appended, deduped: r.deduped, rejected: r.rejected }
  } catch (e) {
    return { ok: false, landing: 0, deduped: 0, rejected: [], error: String(e?.message ?? e).split('\n')[0] }
  }
}

/** 结论行机读尾段(三枚 lander 逐字同形,同形锁见 scripts/tests/land-*.test.mjs)。 */
export function landingKeys({ landing = 0, deduped = 0, rejected = 0, skipLanded = 0, ledgerUnjudged = false, landingErr = '' } = {}) {
  const parts = [`landing=${landing}`, `landingPath=${LEDGER_REL}`, `skipLanded=${skipLanded}`]
  if (deduped) parts.push(`landingDedup=${deduped}`)
  if (rejected) parts.push(`landingRejected=${rejected}`)
  if (ledgerUnjudged) parts.push('ledger=unjudged')
  if (landingErr) parts.push(`landingError=${landingErr.replace(/\s+/g, '_').slice(0, 100)}`)
  return ` ${parts.join(' ')}`
}

function listCandidates() {
  if (onlyFiles.length) return onlyFiles
  const out = []
  for (const d of RN_DIRS) {
    let text
    try {
      text = String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', d], ROOT))
    } catch {
      console.error(`❌ 目录清单取不到:${d} ⇒ 未判定`)
      process.exit(2)
    }
    for (const l of text.split('\n')) {
      if (!/\.(tsx|ts)$/.test(l)) continue
      if (/\.test\.|\/tests?\//.test(l)) continue
      out.push(l)
    }
  }
  return out
}

/** 单文件改动按类计数(spacing / fontSize / lineHeight / radius)。 */
function kindCounts(changes) {
  const out = { spacing: 0, fontSize: 0, lineHeight: 0, radius: 0 }
  for (const c of changes) out[c.kind] = (out[c.kind] ?? 0) + 1
  return out
}

/** 成对对象数(fontSize 与 lineHeight 各记一处改动,对象数以 fontSize 的 pair 标记计)。 */
function pairCount(changes) {
  return changes.filter((c) => c.pair && c.kind === 'fontSize').length
}

function run() {
  const { tables, radiusText } = loadHeadTables()
  const spacingByValue = loadSpacingSteps(tables)
  // 字号/圆角是显式开关:守护轮只跑默认面(间距),不会自己把这两腿打开。
  const typeByValue = includeFontSizeAny ? loadTypeSteps(tables) : null
  const pairByValue = includeFontSizePair ? loadTypePairs(tables) : null
  const radiusByValue = includeRadius ? loadRadiusSteps(radiusText) : null
  const opts = { typeByValue, pairByValue, radiusByValue, fontSizePairsOnly: !includeFontSize && includeFontSizePair }
  const symbols = ['rnSpacing', ...(typeByValue ? ['rnType'] : []), ...(radiusByValue ? ['rnRadius'] : [])]
  const files = listCandidates()
  if (files.length === 0) {
    console.error('❌ 枚举到 0 个候选文件 ⇒ 判死,不记绿(§0.3)')
    process.exit(2)
  }
  const report = {
    tool: 'land-rn-style-tiers',
    apply,
    legs: { spacing: true, fontSize: Boolean(typeByValue), fontSizePair: Boolean(pairByValue), radius: Boolean(radiusByValue) },
    scanned: files.length,
    changedFiles: [],
    held: [],
    noSheet: 0,
    noImportAnchor: [],
    verifyFailed: [],
    importFixes: [],
    skipLanded: 0,
    totalChanges: 0,
    pairs: 0,
    byKind: { spacing: 0, fontSize: 0, lineHeight: 0, radius: 0 },
    skipped: {
      lineHeight: 0,
      outsideSheet: 0,
      platform: 0,
      pairMismatch: 0,
      pairNonLiteral: 0,
      pairAmbiguous: 0,
      pairNoLineHeight: 0,
    },
  }
  const absorbSkips = (s) => {
    for (const [k, v] of Object.entries(s ?? {})) report.skipped[k] = (report.skipped[k] ?? 0) + v
  }
  // 续跑(R2):账本在册且工作树 blob 仍相符的路径 = 本 leg 早前已落,整轮跳过(只 --apply 档生效;
  // 账本读不到 ⇒ 回落现行为 + ledger=unjudged,失效方向恒为"多做一遍",见 landedPathsOf 头注)。
  let landedSet = new Set()
  let ledgerUnjudged = false
  if (apply) {
    const lp = landedPathsOf()
    if (lp.ok) landedSet = lp.paths
    else ledgerUnjudged = true
  }
  const landedBatch = []
  // 归属避让(判据单源 = scripts/lib/git-paths.mjs,2026-11-03 提库):整树一次取回脏集
  // (候选上千枚时逐路径派生 git 会把耗时顶穿,web/miniapp 两枚 lander 同规)。
  // 取不到 ⇒ 未判定 exit 2,一条都不写(§0.3:失效方向恒为"少写一次",绝不把取不到当干净)。
  const dirty = ownershipDirtyPaths({ root: ROOT })
  if (dirty === null) {
    console.error('❌ 未判定:归属脏集取不到(git status 问不动)⇒ 本轮一条都不写')
    process.exit(2)
  }
  let touched = 0
  for (const f of files) {
    if (touched >= limit) break
    if (landedSet.has(f)) {
      report.skipLanded += 1
      continue
    }
    if (!isCleanOwned(f, dirty)) {
      report.held.push(f)
      continue
    }
    const original = readFileSync(join(ROOT, f), 'utf8')
    const dry = transform(original, spacingByValue, opts)
    if (dry.reason === 'no-stylesheet') {
      report.noSheet += 1
      continue
    }
    absorbSkips(dry.skipped)
    if (dry.changes.length === 0) {
      // 修复态:正文已含某符号但 import 里没有(上一版 ensureImport 用全文判定所致)⇒ 补回。
      // 这不是"多此一举":器物自己落出的悬空标识符,只能由器物自己收敛。
      const missing = symbols.filter((sym) => new RegExp(`\\b${sym}\\b`).test(original) && !hasSymbolImport(original, sym))
      if (missing.length === 0) continue
      if (!apply) {
        report.importFixes.push(f)
        touched += 1
        continue
      }
      try {
        watermark('clean', f)
        const body = readFileSync(join(ROOT, f), 'utf8')
        const withImport = ensureAllImports(body, missing)
        if (withImport.reason === 'no-import-anchor') {
          writeFileSync(join(ROOT, f), original, 'utf8')
          report.noImportAnchor.push(f)
          continue
        }
        writeFileSync(join(ROOT, f), withImport.text, 'utf8')
        watermark('inject', f)
        watermark('verify', f)
        const after = readFileSync(join(ROOT, f), 'utf8')
        for (const sym of missing) if (!hasSymbolImport(after, sym)) throw new Error(`补 ${sym} 后仍不在 import 语句里(回滚)`)
        report.importFixes.push(f)
        landedBatch.push(f)
        touched += 1
      } catch (e) {
        writeFileSync(join(ROOT, f), original, 'utf8')
        report.verifyFailed.push(`${f} —— ${e?.message ?? e}`)
      }
      continue
    }
    const kinds = kindCounts(dry.changes)
    if (!apply) {
      report.changedFiles.push({ file: f, changes: dry.changes.length, kinds, sample: dry.changes.slice(0, 8) })
      report.totalChanges += dry.changes.length
      report.pairs += pairCount(dry.changes)
      for (const [k, v] of Object.entries(kinds)) report.byKind[k] += v
      touched += 1
      continue
    }
    // ---- 落盘:clean → 改写 → import → inject → verify(失败回滚该文件) ----
    try {
      watermark('clean', f)
      let body = readFileSync(join(ROOT, f), 'utf8')
      const t2 = transform(body, spacingByValue, opts)
      if (t2.changes.length === 0) {
        watermark('inject', f)
        continue
      }
      const dirty = [...new Set(t2.changes.map((c) => c.symbol))]
      const withImport = ensureAllImports(t2.text, dirty)
      if (withImport.reason === 'no-import-anchor') {
        // 改不动 import 就整文件放弃(不允许写出悬空标识符)
        writeFileSync(join(ROOT, f), original, 'utf8')
        report.noImportAnchor.push(f)
        continue
      }
      body = withImport.text
      writeFileSync(join(ROOT, f), body, 'utf8')
      watermark('inject', f)
      watermark('verify', f)
      const after = readFileSync(join(ROOT, f), 'utf8')
      // 悬空标识符是器物最危险的自伤型(实测一次落出 79 文件/1386 处 TS2304):必须按 import 语句核
      for (const sym of dirty) if (!hasSymbolImport(after, sym)) throw new Error(`注入后 ${sym} 仍不在 import 语句里(回滚)`)
      const k2 = kindCounts(t2.changes)
      report.changedFiles.push({ file: f, changes: t2.changes.length, kinds: k2, importAdded: withImport.added.length > 0 })
      landedBatch.push(f)
      report.totalChanges += t2.changes.length
      report.pairs += pairCount(t2.changes)
      for (const [k, v] of Object.entries(k2)) report.byKind[k] += v
      touched += 1
    } catch (e) {
      writeFileSync(join(ROOT, f), original, 'utf8')
      report.verifyFailed.push(`${f} —— ${e?.message ?? e}`)
    }
  }
  // 本批产出一次登记(R1):写完盘后实测 oid;登记失败绝不冒充成功(landingError 如实带上)。
  let landing = 0
  let landingDedup = 0
  let landingRejected = 0
  let landingErr = ''
  if (apply && landedBatch.length) {
    const reg = registerLanding(landedBatch)
    landing = reg.landing
    landingDedup = reg.deduped
    landingRejected = reg.rejected.length
    if (!reg.ok) landingErr = reg.error
    else if (landingRejected) landingErr = `rejected=${landingRejected}:${reg.rejected[0].reason}`
  }
  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          ...report,
          heldCount: report.held.length,
          landing,
          landingDedup,
          landingRejected,
          landingPath: LEDGER_REL,
          ledger: ledgerUnjudged ? 'unjudged' : 'ok',
          ...(landingErr ? { landingError: landingErr } : {}),
        },
        null,
        2,
      ),
    )
  } else {
    const legs = ['间距', ...(includeFontSize ? ['字号'] : []), ...(includeFontSizePair ? ['字号成对'] : []), ...(includeRadius ? ['圆角'] : [])].join(' + ')
    console.log(`\n🛠  RN 非色档落档器(${apply ? '落盘' : '只读预演'})`)
    console.log('─'.repeat(64))
    console.log(`腿: ${legs}(未开的腿一律不碰)`)
    console.log(`扫描 ${report.scanned} 文件 · 无 StyleSheet ${report.noSheet} · 他人持有跳过 ${report.held.length}`)
    console.log(
      `命中文件 ${report.changedFiles.length} · 可改写 ${report.totalChanges} 处` +
        ` · 分类 spacing=${report.byKind.spacing} fontSize=${report.byKind.fontSize}` +
        ` lineHeight=${report.byKind.lineHeight} radius=${report.byKind.radius}`,
    )
    console.log(`成对对象 ${report.pairs} 个(fontSize 与 lineHeight 两值同时替换,各记 1 处)`)
    console.log(
      `跳过: 带 lineHeight 字号(未开成对) ${report.skipped.lineHeight} · 成对不等值 ${report.skipped.pairMismatch}` +
        ` · 行高非字面量 ${report.skipped.pairNonLiteral} · 多行高歧义 ${report.skipped.pairAmbiguous}` +
        ` · 无行高(成对腿不碰) ${report.skipped.pairNoLineHeight}` +
        ` · StyleSheet 块外 ${report.skipped.outsideSheet} · Platform 行 ${report.skipped.platform}`,
    )
    for (const c of report.changedFiles.slice(0, 12))
      console.log(
        `  · ${c.file}  ${c.changes} 处${c.importAdded ? '(补 import)' : ''}` +
          `${c.sample ? '  ' + c.sample.map((s) => `${s.prop}=${s.value}→${s.ref}`).join(' ') : ''}`,
      )
    if (report.importFixes.length) console.log(`  🔧 仅补 import(修复态): ${report.importFixes.length} 个`)
    if (report.noImportAnchor.length) console.log(`  ⚠ 无 import 锚点未改(不得写悬空标识符): ${report.noImportAnchor.length} 个`)
    if (report.verifyFailed.length) console.log(`  ❌ 注入校验失败并已回滚: ${report.verifyFailed.join(' | ')}`)
    if (report.held.length) console.log(`  🔒 held(工作树脏,归属未知不猜): ${report.held.slice(0, 8).join(' ')}${report.held.length > 8 ? ' …' : ''}`)
    console.log(
      `\n结论:LAND-TIERS state=${report.verifyFailed.length ? 'rolled-back' : apply ? 'applied' : 'preview'}` +
        ` files=${report.changedFiles.length} changes=${report.totalChanges} pairs=${report.pairs} held=${report.held.length}` +
        ` byKind=${report.byKind.spacing}/${report.byKind.fontSize}/${report.byKind.lineHeight}/${report.byKind.radius}` +
        landingKeys({ landing, deduped: landingDedup, rejected: landingRejected, skipLanded: report.skipLanded, ledgerUnjudged, landingErr }),
    )
  }
  if (report.verifyFailed.length) process.exit(2)
}

const FIXTURE = `
import { StyleSheet } from 'react-native'
import { tokens } from './tokens'

const s = StyleSheet.create({
  a: { paddingHorizontal: 10, gap: 6, marginTop: -8, borderRadius: 8 },
  b: { padding: 14, gap: 3 },
  c: { padding: Platform.OS === 'ios' ? 10 : 12 },
  d: { padding: 0 },
})
const cfg = { padding: 10 }
`

// 字号/圆角腿夹具:plain 无 lineHeight、paired 有(尺寸配对必须不动)、rounded 命中角色档、out 在块外
const FIXTURE_EXTRA = `
import { StyleSheet } from 'react-native'

const s = StyleSheet.create({
  plain: { fontSize: 14 },
  paired: { fontSize: 16, lineHeight: 24 },
  rounded: { borderRadius: 8 },
})
const out = { fontSize: 14 }
`

// 成对腿夹具:ok 两值同档 / mismatch 行高不等值 / nonLiteral 行高非字面量 / ambiguous 顶层两个行高
const FIXTURE_PAIR = `
import { StyleSheet } from 'react-native'

const s = StyleSheet.create({
  ok: { fontSize: 14, lineHeight: 20 },
  mismatch: { fontSize: 14, lineHeight: 22 },
  nonLiteral: { fontSize: 14, lineHeight: 1.4 * 14 },
  ambiguous: { fontSize: 14, lineHeight: 20, lineHeight: 22 },
  plain: { fontSize: 14 },
})
const cfg = { fontSize: 14, lineHeight: 20 }
`

const SELF_ASSERTS = () => {
  const byValue = new Map([
    [2, '2xs'],
    [6, 'xs-loose'],
    [8, 'sm'],
    [10, 'sm-loose'],
    [12, 'md'],
  ])
  const out = []
  const r = transform(FIXTURE, byValue)
  const t = r.text
  out.push([
    '等值命中档 ⇒ 改写(合法标识符用点号 / 带连字符用方括号)',
    t.includes("paddingHorizontal: rnSpacing['sm-loose']") && t.includes("gap: rnSpacing['xs-loose']"),
  ])
  out.push(['负值保留符号', t.includes('marginTop: -rnSpacing.sm')])
  out.push(['档外值不动', t.includes('padding: 14') && t.includes('gap: 3')])
  out.push(['含 Platform. 的行整行跳过', t.includes("Platform.OS === 'ios' ? 10 : 12")])
  out.push(['0 不改(无跟随收益)', t.includes('padding: 0')])
  out.push(['块外同名键不动', t.includes('const cfg = { padding: 10 }')])
  out.push(['borderRadius 不在本器物射程', t.includes('borderRadius: 8')])
  // 幂等:对已改写的文本再跑一次必须 0 处
  const again = transform(t, byValue)
  out.push(['幂等(二次改 0 处)', again.changes.length === 0])
  // import 补齐:已有具名 import ⇒ 并入,不新开一行
  const imp1 = ensureImport("import { brand } from '@ihui/design-tokens'\nconst a = 1\n", 'rnSpacing')
  out.push(['已有具名 import ⇒ 并入', imp1.added && imp1.text.includes("import { brand, rnSpacing } from '@ihui/design-tokens'")])
  const imp2 = ensureImport('const a = 1\n', 'rnSpacing')
  out.push(['无 import 锚点 ⇒ 拒改(不写悬空标识符)', !imp2.added && imp2.reason === 'no-import-anchor'])
  const imp3 = ensureImport("import x from 'y'\nconst a = 1\n", 'rnSpacing')
  out.push(['无该包 ⇒ 插在最后一条 import 后', imp3.added && /import x from 'y'\nimport \{ rnSpacing \}/.test(imp3.text)])
  // 档表歧义必须拒绝(同一 px 两个档名)
  const dupDetected = (() => {
    const m = new Map()
    for (const [v, step] of [
      [8, 'sm'],
      [8, 'sm2'],
    ])
      if (m.has(v)) return true
      else m.set(v, step)
    return false
  })()
  out.push(['同值双档名会被拒(夹具自证该判据存在)', dupDetected])
  // 缺陷形态回归锁(实测踩过一次):transform 会把 rnSpacing 写进正文,
  // 若 ensureImport 按"全文含该符号"判已导入 ⇒ 永不补齐 ⇒ 落出 TS2304 悬空标识符。
  out.push(['改写后的正文不得被当成已 import', !hasSymbolImport(t, 'rnSpacing')])
  const repaired = ensureImport(t, 'rnSpacing')
  out.push(['改写后补 import ⇒ 真的补上了', repaired.added && hasSymbolImport(repaired.text, 'rnSpacing')])
  out.push([
    'hasSymbolImport 只认 import 语句(正文提及不算)',
    hasSymbolImport("import { rnSpacing } from '@ihui/design-tokens'\n", 'rnSpacing') &&
      !hasSymbolImport('const x = rnSpacing.sm\n', 'rnSpacing'),
  ])

  // ---- 字号/圆角腿(显式开关;默认面不得碰) ----
  const typeTier = new Map([
    [12, 'label'],
    [14, 'body'],
    [16, 'title'],
  ])
  const radiusTier = new Map([
    [4, 'sm'],
    [8, 'lg'],
    [12, 'xl'],
  ])
  const def = transform(FIXTURE_EXTRA, byValue)
  out.push(['默认面不碰 fontSize / borderRadius', def.text.includes('fontSize: 14') && def.text.includes('borderRadius: 8')])
  const fsOut = transform(FIXTURE_EXTRA, byValue, { typeByValue: typeTier })
  out.push(['字号: 无 lineHeight 的 fontSize 改档', fsOut.text.includes('fontSize: rnType.body.size')])
  out.push(['字号: 同对象带 lineHeight 不碰(字号↔行高是尺寸配对)', fsOut.text.includes('fontSize: 16, lineHeight: 24')])
  out.push(['字号: StyleSheet 块外的 fontSize 不碰', fsOut.text.includes('const out = { fontSize: 14 }')])
  out.push(['字号: 二次改 0 处', transform(fsOut.text, byValue, { typeByValue: typeTier }).changes.length === 0])
  const rOut = transform(FIXTURE_EXTRA, byValue, { radiusByValue: radiusTier })
  out.push(['圆角: 等值命中取角色表在用的档(rnRadius.lg)', rOut.text.includes('borderRadius: rnRadius.lg')])
  out.push(['引用形态: 点号 / 方括号 / 字号 size', refOf('rnSpacing', 'md') === 'rnSpacing.md' && refOf('rnSpacing', 'sm-loose') === "rnSpacing['sm-loose']" && refOf('rnType', 'body', '.size') === 'rnType.body.size' && refOf('rnRadius', '2xl') === "rnRadius['2xl']"])

  // ---- 成对腿(2026-11-02 Phase 3):size 与 lineHeight 同时等于同档才两值一起换 ----
  const pairTier = new Map([
    ['12|16', 'label'],
    ['14|20', 'body'],
    ['16|24', 'title'],
  ])
  const pairOnly = transform(FIXTURE_PAIR, byValue, { typeByValue: typeTier, pairByValue: pairTier, fontSizePairsOnly: true })
  out.push(['成对: 两值同档 ⇒ size 与 lineHeight 一起换', pairOnly.text.includes('fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight')])
  out.push(['成对: 行高不等值 ⇒ 整个对象不动', pairOnly.text.includes('fontSize: 14, lineHeight: 22')])
  out.push(['成对: 行高非字面量 ⇒ 整个对象不动', pairOnly.text.includes('lineHeight: 1.4 * 14')])
  out.push(['成对: 顶层多行高 ⇒ 整个对象不动', pairOnly.text.includes('ambiguous: { fontSize: 14, lineHeight: 20, lineHeight: 22 }')])
  out.push(['成对: 无行高的 fontSize 本腿不碰', pairOnly.text.includes('plain: { fontSize: 14 }')])
  out.push(['成对: StyleSheet 块外不动', pairOnly.text.includes('cfg = { fontSize: 14, lineHeight: 20 }')])
  out.push(['成对: 不得注入 weight(禁止 ...rnType 展开)', !pairOnly.text.includes('weight')])
  out.push(['成对: 二次改 0 处', transform(pairOnly.text, byValue, { typeByValue: typeTier, pairByValue: pairTier, fontSizePairsOnly: true }).changes.length === 0])
  const pairSkips = transform(FIXTURE_PAIR, byValue, { typeByValue: typeTier, pairByValue: pairTier, fontSizePairsOnly: true }).skipped
  out.push([
    '成对: 拒绝原因分别计数',
    pairSkips.pairMismatch >= 1 && pairSkips.pairNonLiteral >= 1 && pairSkips.pairAmbiguous >= 1 && pairSkips.pairNoLineHeight >= 1,
  ])
  out.push(['topLevelText 抹掉嵌套对象、保留顶层键', (() => {
    const m2 = maskLiterals('{ fontSize: 14, inner: { lineHeight: 20 } }')
    const sp2 = objectAround(m2, m2.indexOf('14'))
    const top2 = topLevelText(m2, sp2)
    return top2.includes('fontSize: 14') && !top2.includes('lineHeight')
  })()])

  // ---- 抹白/对象定位:索引必须与原文一一对应(错位会把 12.5 认成等值) ----
  const rawMask = 'const a = "padding: 10" // gap: 6\nconst b = 1'
  const masked = maskLiterals(rawMask)
  out.push(['抹白保留长度(索引不错位)', masked.length === rawMask.length])
  out.push(['抹白盖住字符串与注释里的伪样式', !masked.includes('padding') && !masked.includes('gap') && masked.includes('const b = 1')])
  const objMask = maskLiterals('const o = { fontSize: 14 }')
  const span = objectAround(objMask, objMask.indexOf('14'))
  out.push(['objectAround 取到 innermost 对象', span && objMask.slice(span[0], span[1]) === '{ fontSize: 14 }'])

  // ---- 多符号 import:一个文件同时落两腿时不得漏补 ----
  const two = ensureAllImports("import { StyleSheet } from 'react-native'\nconst a = 1\n", ['rnSpacing', 'rnType'])
  out.push([
    '多符号 import 一次补齐(合并且都进 import 语句)',
    two.added.length === 2 && hasSymbolImport(two.text, 'rnSpacing') && hasSymbolImport(two.text, 'rnType'),
  ])
  return out
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    if (selfTest) {
      let fail = 0
      for (const [name, ok] of SELF_ASSERTS()) {
        console.log(`${ok ? '✅' : '❌'} ${name}`)
        if (!ok) fail++
      }
      console.log(`自检 ${SELF_ASSERTS().length - fail}/${SELF_ASSERTS().length} 通过`)
      process.exit(fail ? 1 : 0)
    }
    run()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  transform,
  ensureImport,
  ensureAllImports,
  hasSymbolImport,
  styleSheetRanges,
  maskLiterals,
  objectAround,
  topLevelText,
  refOf,
  SPACING_PROPS,
  KIND_PROPS,
  LEG_NAME,
  LEDGER_REL,
  blobOidOf,
  landedPathsOf,
  registerLanding,
  landingKeys,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
