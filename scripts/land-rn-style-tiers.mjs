#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出落档报告 */
/**
 * land-rn-style-tiers.mjs — 把 RN/共享源 StyleSheet 里「等值命中档表」的间距裸数字
 * 改写为 `rnSpacing.*` 引用(写盘器物,默认只读预演)。
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
 *   ③ **不碰 fontSize**。字号与 lineHeight/fontWeight 是配套三件套(且正在走系统字号通道),
 *      单改一处会造出"字号跟了、行高没跟"的新分叉。另立票,本器物只做间距。
 *
 * 水印(§5c 强制):逐文件 `watermark clean` → 改写 → `watermark inject`。
 *   已实测往返**字节等价**(同一文件 clean+inject 后 sha256 不变),故未改动的文件不会被
 *   本器物碰出任何 diff;inject 后逐文件 `watermark verify` 复核,失败即回滚该文件原字节。
 *
 * 归属避让(多会话共享工作区):`git status --porcelain` 对该文件非空 ⇒ 跳过并点名(held)。
 *   不判"脏是谁的"—— 脏就说明有人在用,猜归属的代价比少改一个文件大得多。
 *
 * 幂等:已是 `rnSpacing.x` 的位置不会再命中数字正则 ⇒ 重跑改 0 处。
 *
 * 用法:
 *   node scripts/land-rn-style-tiers.mjs                     # 只读预演(默认)
 *   node scripts/land-rn-style-tiers.mjs --apply             # 落盘
 *   node scripts/land-rn-style-tiers.mjs --file <path>       # 单文件试点(可重复给)
 *   node scripts/land-rn-style-tiers.mjs --limit <n>         # 最多动 n 个文件
 *   node scripts/land-rn-style-tiers.mjs --json              # 机器可读
 *   node scripts/land-rn-style-tiers.mjs --self-test
 *
 * 退出码:0 正常(含"改 0 处");2 用法错/取不到档表/注入校验失败。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
import { parseTokenTables } from './sync-css-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WATERMARK = join(ROOT, 'scripts', 'watermark.mjs')

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
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

/** 档表:从 HEAD blob 读三源,交派生器的同一把尺解析(§0.6 零复算)。 */
function loadSpacingSteps() {
  const read = (rel) => {
    try {
      return gitRaw(['show', `HEAD:${rel}`], ROOT)
    } catch {
      return null
    }
  }
  const spacing = read(SPACING_REL)
  const typography = read(TYPOGRAPHY_REL)
  const elevation = read(ELEVATION_REL)
  if (spacing === null || typography === null || elevation === null) {
    console.error('❌ 档表源取不到(HEAD 面)⇒ 未判定,拒绝改写')
    process.exit(2)
  }
  const tables = parseTokenTables({ spacing, typography, elevation })
  const byValue = new Map()
  for (const [step, px] of Object.entries(tables.SPACING_STEPS)) {
    const v = Number(px)
    if (v === 0) continue // 0 走 rnSpacing.none 只是噪声,且 0 不比字面量更能跟随任何东西
    if (byValue.has(v)) {
      console.error(`❌ 档表里 ${v}px 有两个档名(${byValue.get(v)} / ${step})⇒ 无法无歧义落档,拒绝改写`)
      process.exit(2)
    }
    byValue.set(v, step)
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

/** 档名 → 引用表达式。合法标识符用点号,否则方括号。 */
function refOf(step) {
  return /^[A-Za-z_$][\w$]*$/.test(step) ? `rnSpacing.${step}` : `rnSpacing['${step}']`
}

/** 单文件变换(纯函数:输入源码 + 档表,输出新源码与改动明细)。 */
export function transform(src, byValue) {
  const ranges = styleSheetRanges(src)
  if (ranges.length === 0) return { text: src, changes: [], reason: 'no-stylesheet' }
  const changes = []
  const lines = src.split('\n')
  // 逐行处理:落在任一块内、且不含 Platform. 分支
  const lineStarts = []
  let acc = 0
  for (const l of lines) {
    lineStarts.push(acc)
    acc += l.length + 1
  }
  const inRange = (pos) => ranges.some(([a, b]) => pos >= a && pos < b)
  const propAlt = SPACING_PROPS.join('|')
  const RE = new RegExp(`(\\b(?:${propAlt})\\s*:\\s*)(-?)(\\d+(?:\\.\\d+)?)(\\s*(?:,|\\}))`, 'g')

  const outLines = lines.map((line, li) => {
    if (/Platform\./.test(line)) return line
    if (!inRange(lineStarts[li])) return line
    return line.replace(RE, (full, head, neg, num, tail) => {
      const v = Math.abs(Number(num))
      const step = byValue.get(v)
      if (!step) return full
      changes.push({ prop: head.replace(/\s*:\s*$/, '').trim(), value: Number(num), step })
      return `${head}${neg}${refOf(step)}${tail}`
    })
  })
  return { text: outLines.join('\n'), changes, reason: null }
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

const WMO = { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }

function watermark(cmd, file) {
  // 内联写 windowsHide(门 52 的判据只认 options 字面量，不认 WMO 变量引用；行为与 WMO 逐键相同)
  return execFileSync(process.execPath, [WATERMARK, cmd, file], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function isCleanOwned(file) {
  const out = String(gitRaw(['status', '--porcelain', '--', file], ROOT))
  return out.trim() === ''
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

function run() {
  const byValue = loadSpacingSteps()
  const files = listCandidates()
  if (files.length === 0) {
    console.error('❌ 枚举到 0 个候选文件 ⇒ 判死,不记绿(§0.3)')
    process.exit(2)
  }
  const report = { scanned: files.length, changedFiles: [], held: [], noSheet: 0, noImportAnchor: [], verifyFailed: [], importFixes: [], totalChanges: 0 }
  let touched = 0
  for (const f of files) {
    if (touched >= limit) break
    if (!isCleanOwned(f)) {
      report.held.push(f)
      continue
    }
    const original = readFileSync(join(ROOT, f), 'utf8')
    const dry = transform(original, byValue)
    if (dry.reason === 'no-stylesheet') {
      report.noSheet += 1
      continue
    }
    if (dry.changes.length === 0) {
      // 修复态:正文已含 rnSpacing 但 import 里没有(上一版 ensureImport 用全文判定所致)⇒ 补回。
      // 这不是"多此一举":器物自己落出的悬空标识符,只能由器物自己收敛。
      if (!/\brnSpacing\b/.test(original) || hasSymbolImport(original, 'rnSpacing')) continue
      if (!apply) {
        report.importFixes.push(f)
        touched += 1
        continue
      }
      try {
        watermark('clean', f)
        const body = readFileSync(join(ROOT, f), 'utf8')
        const withImport = ensureImport(body, 'rnSpacing')
        if (withImport.reason === 'no-import-anchor') {
          writeFileSync(join(ROOT, f), original, 'utf8')
          report.noImportAnchor.push(f)
          continue
        }
        writeFileSync(join(ROOT, f), withImport.text, 'utf8')
        watermark('inject', f)
        watermark('verify', f)
        if (!hasSymbolImport(readFileSync(join(ROOT, f), 'utf8'), 'rnSpacing'))
          throw new Error('补 import 后仍不在 import 语句里(回滚)')
        report.importFixes.push(f)
        touched += 1
      } catch (e) {
        writeFileSync(join(ROOT, f), original, 'utf8')
        report.verifyFailed.push(`${f} —— ${e?.message ?? e}`)
      }
      continue
    }
    if (!apply) {
      report.changedFiles.push({ file: f, changes: dry.changes.length, sample: dry.changes.slice(0, 6) })
      report.totalChanges += dry.changes.length
      touched += 1
      continue
    }
    // ---- 落盘:clean → 改写 → import → inject → verify(失败回滚该文件) ----
    try {
      watermark('clean', f)
      let body = readFileSync(join(ROOT, f), 'utf8')
      const t2 = transform(body, byValue)
      if (t2.changes.length === 0) {
        watermark('inject', f)
        continue
      }
      const withImport = ensureImport(t2.text, 'rnSpacing')
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
      if (!hasSymbolImport(after, 'rnSpacing')) throw new Error('注入后 rnSpacing 仍不在 import 语句里(回滚)')
      report.changedFiles.push({ file: f, changes: t2.changes.length, importAdded: withImport.added })
      report.totalChanges += t2.changes.length
      touched += 1
    } catch (e) {
      writeFileSync(join(ROOT, f), original, 'utf8')
      report.verifyFailed.push(`${f} —— ${e?.message ?? e}`)
    }
  }
  if (jsonMode) {
    console.log(JSON.stringify({ apply, ...report, heldCount: report.held.length }, null, 2))
  } else {
    console.log(`\n🛠  RN 间距裸数字落档器(${apply ? '落盘' : '只读预演'})`)
    console.log('─'.repeat(64))
    console.log(`扫描 ${report.scanned} 文件 · 无 StyleSheet ${report.noSheet} · 他人持有跳过 ${report.held.length}`)
    console.log(`命中文件 ${report.changedFiles.length} · 可改写 ${report.totalChanges} 处`)
    for (const c of report.changedFiles.slice(0, 12))
      console.log(`  · ${c.file}  ${c.changes} 处${c.importAdded ? '(补 import)' : ''}${c.sample ? '  ' + c.sample.map((s) => `${s.prop}=${s.value}→${s.ref || s.step}`).join(' ') : ''}`)
    if (report.importFixes.length) console.log(`  🔧 仅补 import(修复态): ${report.importFixes.length} 个`)
    if (report.noImportAnchor.length) console.log(`  ⚠ 无 import 锚点未改(不得写悬空标识符): ${report.noImportAnchor.length} 个`)
    if (report.verifyFailed.length) console.log(`  ❌ 注入校验失败并已回滚: ${report.verifyFailed.join(' | ')}`)
    if (report.held.length) console.log(`  🔒 held(工作树脏,归属未知不猜): ${report.held.slice(0, 8).join(' ')}${report.held.length > 8 ? ' …' : ''}`)
    console.log(`\n结论:LAND-TIERS state=${report.verifyFailed.length ? 'rolled-back' : apply ? 'applied' : 'preview'} files=${report.changedFiles.length} changes=${report.totalChanges} held=${report.held.length}`)
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

export const __test__ = { transform, ensureImport, hasSymbolImport, styleSheetRanges, refOf, SPACING_PROPS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
