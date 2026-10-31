#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出落档报告 */
/**
 * land-web-style-tiers.mjs — 把 web 源码 `className` 里的 Tailwind **默认**字号档改写为项目**具名**档。
 *
 * 改写表(值同源:`packages/design-tokens/src/typography.ts` 的 `TYPE_STEPS` →
 * `tokens.css` 的 `css-tokens:managed` 受管块里的 `--text-*`):
 *
 *   text-xs  (12px / 16px) → text-label    (12px / 16px / 400)
 *   text-sm  (14px / 20px) → text-body     (14px / 20px / 400)
 *   text-xl  (20px / 28px) → text-heading  (20px / 28px / 700)
 *   text-2xl (24px / 32px) → text-display  (24px / 32px / 700)
 *
 * 五条硬边界(与 `land-miniapp-style-tiers.mjs` / `land-rn-style-tiers.mjs` 同构):
 *   ① **只改 className 属性值**。测试断言、日志文案、注释、快照字符串里的同名 token 一律不动 ——
 *      那些位置的 `text-sm` 是**数据**不是样式,改了就是改文案。
 *   ② **只改表内的四档**。`text-base`(title 带 600)、`text-lg`(行高 28→26)、`text-3xl`
 *      (行高 36→38)、任意值 `text-[10px]` 一律不动 —— 那是"该落哪一档"的判断,不归器物猜。
 *   ③ **类名 token 边界**:前后不得紧邻 `[A-Za-z0-9_-]` ⇒ `text-smaller` / `text-sm-foreground`
 *      (颜色档)不被误伤;`sm:` / `hover:` / `md:` 等变体前缀原样保留,只换后缀。
 *   ④ **注释面不碰**:用 `maskComments` 把注释抹成等长空白(`codeFace`),只在代码面开栏,
 *      并把行注释被删掉的尾巴补成空白以保住偏移 —— 落在注释里的 `className="…"` 不是属性。
 *   ⑤ **不动派生文件与测试**:`*.test.*` / `__tests__/` / `e2e/` / `*.generated.*` / `*.d.ts`
 *      不进射程(测试里的 className 是夹具,断言里的字面量是数据)。
 *
 * ⚠ 实测反例(2026-10-31,本仓 tailwindcss 4.3.3 + `@tailwindcss/postcss` 编译取证):
 *   具名档是**三元组**(size / line-height / **font-weight**),编译产物为
 *   `font-weight: var(--tw-font-weight, var(--text-…--font-weight))`;Tailwind 默认档只给
 *   size + line-height。所以"字号与行高相同"**不等于**零视觉变化:
 *     · `text-xl → text-heading` / `text-2xl → text-display` 引入 700(默认档无权重);
 *       现读 web 里这两档 1332 处类名串中 29 处**没有** `font-*` 伴随 ⇒ 权重会 400→700。
 *     · `text-xs → text-label` / `text-sm → text-body` 引入 400(= 文档默认),元素自身无
 *       `font-*` 且祖先也无权重类时渲染不变;祖先带权重时会被压回 400 —— 静态证明不了。
 *   只有**同一类名串里已有 `font-*` 权重工具类**时,`--tw-font-weight` 覆盖回落值 ⇒ 恒等。
 *   该口径的开关是 `--only-weight-locked`(`rewriteSource` 的 `requireWeightCompanion`)。
 *   全量落盘前必须先把这个反例裁掉(改档不加权重 / 浏览器 computed-style 对照 / 接受并说明)。
 *
 * 归属避让(多会话共享工作区):`git status --porcelain` 对该文件非空 ⇒ 跳过并点名(held)。
 *
 * 水印(§5c 强制):逐文件 `watermark clean` → 改写 → `watermark inject` → `watermark verify`;
 * verify 失败则把该文件回滚成**原字节**并记失败。幂等:改过的位置不再命中 ⇒ 重跑改 0 处。
 *
 * 用法:
 *   node scripts/land-web-style-tiers.mjs                    # 只读预演(默认)
 *   node scripts/land-web-style-tiers.mjs --apply            # 落盘
 *   node scripts/land-web-style-tiers.mjs --apply --limit 40 # 分批(共享工作区必须能小批落)
 *   node scripts/land-web-style-tiers.mjs --file <path>      # 单文件试点(可重复)
 *   node scripts/land-web-style-tiers.mjs --only-weight-locked  # 只改"权重已被 font-* 钉死"的类名串
 *   node scripts/land-web-style-tiers.mjs --json
 *   node scripts/land-web-style-tiers.mjs --self-test
 *
 * 退出码:0 正常(含"改 0 处");1 有文件落盘后 verify 失败并已回滚;2 用法错 / 取不到输入。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'
import { maskComments, scanSpans } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WATERMARK = join(ROOT, 'scripts', 'watermark.mjs')
const SRC_DIR = 'apps/web'

/** 改写表:默认档 → 具名档。**唯一一份**,测试从 `__test__` 取,不复制。 */
export const MAP = Object.freeze({ xs: 'label', sm: 'body', xl: 'heading', '2xl': 'display' })

/** 变体前缀保留,只换后缀;前后不得紧邻 [A-Za-z0-9_-](`text-smaller` / `text-sm-foreground` 不碰)。 */
const TOKEN_RE = /(?<![\w-])text-(2xl|xl|sm|xs)(?![\w-])/g

/** 权重工具类(含任意值档):它会把 `--tw-font-weight` 钉死 ⇒ 具名档的权重回落值不生效。 */
const WEIGHT_RE = /(?<![\w-])font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[^\]]+\])(?![\w-])/

/** 与 `TOKEN_RE` 同一份模式源、无 `g`(只做"这段里有没有可改 token"的判定,不移动 lastIndex)。 */
const TOKEN_PLAIN_RE = new RegExp(TOKEN_RE.source)

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
const onlyWeightLocked = argv.includes('--only-weight-locked')
const limitArg = argv.indexOf('--limit')
const limit = limitArg >= 0 && /^\d+$/.test(argv[limitArg + 1] ?? '') ? Number(argv[limitArg + 1]) : 0
const fileArgs = argv.reduce((acc, a, i) => (a === '--file' && argv[i + 1] ? [...acc, argv[i + 1].replace(/\\/g, '/')] : acc), [])

/**
 * 代码面:注释抹成**等长**空白,偏移与原文逐字节对齐。
 *
 * `maskComments` 对块注释等长抹空白,但行注释是整段删掉(长度会变)⇒ 直接拿它做偏移判定,
 * 某一行的 `//` 之后整份文件的偏移就全错位。这里按行对齐(换行数不变):被删掉的尾巴补空白,
 * 补的正是那条注释本身 —— 仍然是同一台分词器,不另写状态机。
 */
export function codeFace(src) {
  const srcLines = src.split('\n')
  const maskedLines = maskComments(src).split('\n')
  if (srcLines.length !== maskedLines.length) throw new Error('codeFace:maskComments 行数漂移,拒绝判定')
  const face = srcLines
    .map((line, i) => {
      const m = maskedLines[i]
      const d = line.length - m.length
      return d > 0 ? m + ' '.repeat(d) : m.slice(0, line.length)
    })
    .join('\n')
  if (face.length !== src.length) throw new Error('codeFace:掩码长度漂移,拒绝判定')
  return face
}

/** 括号配平:从 `open`(指向 `{`)找配对的 `}`,跳过字符串/注释/正则体。 */
function matchBrace(src, open, skips) {
  let depth = 0
  let k = 0
  while (k < skips.length && skips[k].end <= open) k++
  for (let i = open; i < src.length; i++) {
    while (k < skips.length && skips[k].end <= i) k++
    if (k < skips.length && skips[k].start <= i) {
      i = skips[k].end - 1
      continue
    }
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 枚举 className 属性值里**类名串本体**的区间(源坐标,左闭右开)。
 * 覆盖 `className="…"` / `className={'…'}` / ``className={`…`}`` / `className={cn(…)}` 等全部形态。
 * 只认 `=` 形态的属性(排除 `obj.className =` 这种 DOM 属性写),`wrapperClassName` 等变体不在射程。
 */
export function findClassRegions(src) {
  const face = codeFace(src)
  // 关正则档:JSX 里的自闭合 `/>` 会被当正则起点,一把吞到下一枚 `/>`,把其间的模板串也吃掉
  // (实测 `<a … />` 与 `<b className={`…`}/>` 同行时后者的类名串整段消失)。这里只认字符串与注释。
  const spans = scanSpans(src, { regex: false })
  const skips = spans
    .filter((s) => s.kind === 'string' || s.kind === 'line' || s.kind === 'block')
    .sort((a, b) => a.start - b.start)
  const strings = spans.filter((s) => s.kind === 'string').sort((a, b) => a.start - b.start)
  const regions = []
  const attrRe = /(?<![\w$.-])className\s*=\s*/g
  let m
  while ((m = attrRe.exec(face)) !== null) {
    let j = attrRe.lastIndex
    while (j < face.length && /\s/.test(face[j])) j++
    const q = face[j]
    const direct = strings.find((s) => s.start === j)
    if ((q === '"' || q === "'" || q === '`') && direct) {
      regions.push({ start: direct.bodyStart, end: direct.bodyEnd })
      continue
    }
    if (q === '{') {
      const close = matchBrace(src, j, skips)
      if (close < 0) continue
      // 表达式里每个字符串/模板字面量的本体都是候选类名串(cn/clsx/cva 实参、三元分支、变体键)
      for (const s of strings) {
        if (s.start > j && s.end <= close) regions.push({ start: s.bodyStart, end: s.bodyEnd })
      }
      continue
    }
    // 变量 / 无字符串表达式:结构上无可改
  }
  regions.sort((a, b) => a.start - b.start)
  const merged = []
  for (const r of regions) {
    const last = merged[merged.length - 1]
    if (last && r.start < last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  return merged
}

/** 纯函数:改写一段**类名串本体**。返回 `{ out, changes, byGroup }`。 */
export function rewriteClassText(text) {
  const byGroup = {}
  const samples = []
  const out = text.replace(TOKEN_RE, (all, key) => {
    const to = MAP[key]
    if (!to) return all
    byGroup[key] = (byGroup[key] ?? 0) + 1
    if (samples.length < 6) samples.push(`${all}→text-${to}`)
    return `text-${to}`
  })
  const changes = Object.values(byGroup).reduce((a, b) => a + b, 0)
  return { out, changes, byGroup, samples }
}

/**
 * 纯函数:改写一份源码。只动 className 属性值里的类名串,注释面/非属性面一律不动。
 * 测试直接 import 它(§22c),不复制正则与映射表。
 */
export function rewriteSource(src, opts = {}) {
  const requireWeightCompanion = opts.requireWeightCompanion === true
  const face = codeFace(src)
  const regions = findClassRegions(src)
  const byGroup = {}
  const samples = []
  let out = src
  let changes = 0
  let skippedOffFace = 0
  let skippedNoWeight = 0
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]
    const before = out.slice(r.start, r.end)
    if (requireWeightCompanion && !WEIGHT_RE.test(before)) {
      if (TOKEN_PLAIN_RE.test(before)) skippedNoWeight++
      continue
    }
    TOKEN_RE.lastIndex = 0
    let body = ''
    let last = 0
    let hitCount = 0
    for (const hit of before.matchAll(TOKEN_RE)) {
      const key = hit[1]
      const to = MAP[key]
      const at = r.start + hit.index
      // 交叉判定:命中位置在代码面必须逐字相同(注释已被抹成空白)。逐枚复核,不整段信任。
      if (!to || face.slice(at, at + hit[0].length) !== hit[0]) {
        skippedOffFace++
        continue
      }
      body += before.slice(last, hit.index) + `text-${to}`
      last = hit.index + hit[0].length
      hitCount++
      byGroup[key] = (byGroup[key] ?? 0) + 1
      if (samples.length < 6) samples.push(`${hit[0]}→text-${to}`)
    }
    if (hitCount === 0) continue
    body += before.slice(last)
    changes += hitCount
    out = out.slice(0, r.start) + body + out.slice(r.end)
  }
  return { out, changes, byGroup, samples, regions: regions.length, skippedOffFace, skippedNoWeight }
}

function mergeGroups(into, from) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v
}

/** 射程:web 的 ts/tsx 源码,排除测试 / 夹具 / 生成物 / 类型声明。 */
const EXCLUDE_RE = /(\.test\.|\.spec\.|\.generated\.|\.d\.ts$)|(\/(__tests__|__mocks__|tests|e2e|fixtures)\/)/

export function inScope(path) {
  if (!/\.(ts|tsx)$/.test(path)) return false
  return !EXCLUDE_RE.test(path)
}

function listSourceFiles() {
  if (fileArgs.length) return fileArgs.filter(inScope)
  const text = String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', SRC_DIR], ROOT))
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p && inScope(p))
}

/** 归属未知集合:一次读全 apps/web 的 porcelain,按路径判定(3700 路径塞不进命令行)。 */
function dirtySet() {
  const out = new Set()
  try {
    const text = String(gitRaw(['status', '--porcelain', '--', SRC_DIR], ROOT))
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let p = line.slice(3).trim()
      const arrow = p.lastIndexOf(' -> ')
      if (arrow >= 0) p = p.slice(arrow + 4)
      p = p.replace(/^"|"$/g, '')
      if (p) out.add(p)
    }
  } catch {
    return null
  }
  return out
}

function watermark(mode, file) {
  execFileSync(process.execPath, [WATERMARK, mode, file], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const SELF_TEST_CASES = [
  { name: '四组映射各自命中', src: '<a className="text-xs" /><b className="text-sm" /><c className="text-xl" /><d className="text-2xl" />', want: '<a className="text-label" /><b className="text-body" /><c className="text-heading" /><d className="text-display" />', n: 4 },
  { name: '表外档一律不动', src: '<a className="text-base text-lg text-3xl text-[10px]" />', want: '<a className="text-base text-lg text-3xl text-[10px]" />', n: 0 },
  { name: '变体前缀保留、只换后缀', src: '<a className="sm:text-sm hover:text-xl md:text-2xl dark:text-xs" />', want: '<a className="sm:text-body hover:text-heading md:text-display dark:text-label" />', n: 4 },
  { name: '颜色档与更长的类名不误伤', src: '<a className="text-sm-foreground text-smaller text-xl-alt" />', want: '<a className="text-sm-foreground text-smaller text-xl-alt" />', n: 0 },
  { name: '单引号 / 大括号 / 模板串三种形态都命中', src: "<a className={'text-sm'} /><b className={`flex text-xl`} /><c className={cn('text-xs', ok && 'text-2xl')} />", want: "<a className={'text-body'} /><b className={`flex text-heading`} /><c className={cn('text-label', ok && 'text-display')} />", n: 4 },
  { name: '注释面不动(行注释 + 块注释 + JSX 注释)', src: '// className="text-sm"\n/* className="text-xl" */\n<a className="text-sm" />\n{/* className="text-2xl" */}', want: '// className="text-sm"\n/* className="text-xl" */\n<a className="text-body" />\n{/* className="text-2xl" */}', n: 1 },
  { name: 'className 之外的同形文本不动(普通串 / 断言 / 变量)', src: "const s = 'text-sm'\nexpect(x).toBe('text-2xl')\nconst map = { 'text-xs': 1 }\n<a className=\"text-sm\" />", want: "const s = 'text-sm'\nexpect(x).toBe('text-2xl')\nconst map = { 'text-xs': 1 }\n<a className=\"text-body\" />", n: 1 },
  { name: '非 className 属性不在射程(wrapperClassName 等)', src: '<X wrapperClassName="text-sm" bodyClassName="text-xs" />', want: '<X wrapperClassName="text-sm" bodyClassName="text-xs" />', n: 0 },
  { name: '幂等:改过再跑 0 处', src: '<a className="flex text-sm items-center sm:text-xs" />', want: '<a className="flex text-body items-center sm:text-label" />', n: 2 },
  { name: '权重锁档:有 font-* 伴随才改', src: '<a className="font-semibold text-xl" /><b className="text-xl" />', want: '<a className="font-semibold text-heading" /><b className="text-xl" />', n: 1, opts: { requireWeightCompanion: true } },
  { name: '权重锁档:变体前缀的权重也算', src: '<a className="text-sm md:font-bold" />', want: '<a className="text-body md:font-bold" />', n: 1, opts: { requireWeightCompanion: true } },
]

function runSelfTest() {
  let pass = 0
  let fail = 0
  for (const c of SELF_TEST_CASES) {
    const r = rewriteSource(c.src, c.opts ?? {})
    const twice = rewriteSource(r.out, c.opts ?? {})
    const ok = r.out === c.want && r.changes === c.n && twice.changes === 0 && twice.out === r.out
    if (ok) pass++
    else {
      fail++
      console.error(`✗ ${c.name}\n  得到:${r.out}\n  期望:${c.want} (changes=${r.changes}, want=${c.n}; 二跑=${twice.changes})`)
    }
  }
  console.log(`--self-test: ${pass} passed / ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

function main() {
  if (selfTest) runSelfTest()
  const files = listSourceFiles()
  if (!files.length) {
    console.error('❌ 未判定:候选源码枚举到 0 个')
    process.exit(2)
  }
  const dirty = dirtySet()
  if (dirty === null) {
    console.error('❌ 未判定:git status 取不到,归属未知不猜')
    process.exit(2)
  }

  const results = []
  const held = []
  const failed = []
  const byGroup = {}
  const samples = []
  let totalChanges = 0
  let truncated = false
  let scanned = 0

  for (const f of files) {
    if (limit && results.length >= limit) {
      truncated = true
      break
    }
    scanned++
    let src
    try {
      src = readWorktreeFile(ROOT, f)
    } catch {
      held.push(`${f}(工作树读不到)`)
      continue
    }
    if (src === null) {
      held.push(`${f}(二进制/不可读)`)
      continue
    }
    const r = rewriteSource(src, { requireWeightCompanion: onlyWeightLocked })
    if (r.changes === 0) continue
    if (dirty.has(f)) {
      held.push(f)
      continue
    }
    if (!apply) {
      results.push({ file: f, changes: r.changes, byGroup: r.byGroup })
      totalChanges += r.changes
      mergeGroups(byGroup, r.byGroup)
      for (const s of r.samples) if (samples.length < 10) samples.push(`${f}: ${s}`)
      continue
    }
    // 落盘:clean → 改写 → inject → verify;任一步失败回滚原字节
    const abs = join(ROOT, f)
    let original
    try {
      original = readFileSync(abs)
    } catch (e) {
      failed.push(`${f}(读不到原字节:${e?.message ?? e})`)
      continue
    }
    try {
      watermark('clean', f)
      const cleaned = readWorktreeFile(ROOT, f)
      const rr = cleaned === null ? null : rewriteSource(cleaned, { requireWeightCompanion: onlyWeightLocked })
      if (!rr) throw new Error('clean 后读不回')
      if (rr.changes === 0) {
        watermark('inject', f)
        watermark('verify', f)
        continue
      }
      writeFileSync(abs, rr.out)
      watermark('inject', f)
      watermark('verify', f)
      results.push({ file: f, changes: rr.changes, byGroup: rr.byGroup })
      totalChanges += rr.changes
      mergeGroups(byGroup, rr.byGroup)
      for (const s of rr.samples) if (samples.length < 10) samples.push(`${f}: ${s}`)
    } catch (e) {
      try {
        writeFileSync(abs, original)
      } catch {
        failed.push(`${f}(回滚失败,必须人工介入:${e?.message ?? e})`)
        continue
      }
      failed.push(`${f}(${e?.message ?? e})`)
    }
  }

  const summary = {
    scanned,
    changedFiles: results.length,
    changes: totalChanges,
    byGroup,
    held: held.length,
    failed: failed.length,
    applied: apply,
    weightLocked: onlyWeightLocked,
    truncated,
    map: MAP,
  }
  if (jsonMode) {
    console.log(JSON.stringify({ ...summary, files: results, samples, heldFiles: held.slice(0, 50), failedFiles: failed.slice(0, 20) }, null, 0))
    if (failed.length) process.exit(1)
    return
  }
  for (const r of results.slice(0, 12)) {
    const g = Object.entries(r.byGroup).map(([k, v]) => `${k}:${v}`).join(' ')
    console.log(`  ${r.file}  ${r.changes} 处  ${g}`)
  }
  if (results.length > 12) console.log(`  …另 ${results.length - 12} 个文件`)
  for (const s of samples) console.log(`  样例 ${s}`)
  const groups = Object.entries(byGroup).map(([k, v]) => `text-${k}→text-${MAP[k]}:${v}`).join(' ')
  if (held.length) console.log(`  🔒 held(工作树脏,归属未知不猜)${held.length} 个:${held.slice(0, 6).join(', ')}${held.length > 6 ? ' …' : ''}`)
  if (failed.length) console.log(`  ❌ failed ${failed.length} 个(已回滚):${failed.slice(0, 5).join(', ')}`)
  console.log(
    `结论:LAND-WEB-TIERS state=${apply ? 'applied' : 'dry-run'} files=${results.length} changes=${totalChanges} held=${held.length} failed=${failed.length}${truncated ? ' truncated=1' : ''} groups[${groups}]`,
  )
  if (failed.length) process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { MAP, rewriteSource, rewriteClassText, findClassRegions, codeFace, inScope, SELF_TEST_CASES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
