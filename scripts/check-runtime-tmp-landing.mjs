#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-runtime-tmp-landing.mjs — 运行时 TEMP 落盘回归锁(AGENTS.md §15b 运行时对偶)
 *
 * ## 这道门拦什么(与既有三把尺子不重叠)
 *
 *   · check-disk-root-write(守门 213)认**盘根 literal**(`D:\x`),认不出 `os.tmpdir()` 这种
 *     "选址交给进程 TEMP"的写法;
 *   · check-c-drive-paths 认 `C:\` 字面量,同样认不出 `os.tmpdir()`(它把选址交给了 TEMP 变量);
 *   · check-fixture-tmpdir 只扫 `scripts/` 的**测试夹具**(§26 唯一落点 scratch-dir)。
 *
 * 本门守的是第四型:**运行时业务源码**(`apps/` + `packages/`,非测试)里"把临时文件
 * 落点交给进程 TEMP"—— `os.tmpdir()` / `mkdtempSync(join(tmpdir()…))` / Python
 * `tempfile.mkdtemp|NamedTemporaryFile|TemporaryDirectory|gettempdir`。活进程的 TEMP
 * 可能仍钉在 C 盘(§26 已实测证伪"TEMP 必走 D 盘"),于是运行时把中间文件外泄项目外。
 *
 * 合规出口(唯一):JS/TS = `@ihui/shared` 的 `getRuntimeTempRoot/ensureRuntimeTempRoot/
 * runtimeTempPath`(→ 仓树内 `<仓根>/.DevEnv/tmp`,项目文件夹内);Python = `app/core/runtime_temp.py` 的
 * `install_runtime_temp_root`(把 tempfile 全局重定向到同一合规根)。两端共用同一落点不漂移。
 *
 * ## 判据(接线豁免制,与 check-fixture-tmpdir 的 applyLedger 同型)
 *
 *   F1(判红,差值棘轮):运行时源码里有真 TEMP 落盘调用 **且本文件未引用合规工厂**(未接线)
 *     —— 逐处认落点太脆,接线与否是文件级的事实(改道 = import 合规工厂 + 调用点换过去)。
 *   M1(只报数,不判红):本文件**已引用合规工厂**却仍有 TEMP 字样 —— 那些是防御闸(读
 *     tmpdir 判路径合法性)或头注说明,不是落盘。接线即信任,残留逐条报数供复核。
 *   C1(只报数):Python 文件**已** `from app.core.runtime_temp import` ⇒ 已接线。
 *
 *   掩码后判 F1:注释与字符串里的 `os.tmpdir()` 字样不算调用(maskCommentsAndStrings,
 *   JS/TS;maskScriptComments + 行内判据,py)。**判据自身的头注**里写满这些字样 ⇒ 本门
 *   与其镜像测试列入 STRUCTURAL_EXCLUDES,不判自己。
 *
 * ## 差值棘轮(为什么存量不判红,§0.2/§12e)
 *
 * 锚点 = 该文件在 HEAD 面自身的 F1 数。**本次提交新增**的才判红;存量只报数。与提交者
 * 无关的恒红门会逼人 `--no-verify`,一次绕过等于该提交上全部守门作废。全量档(HEAD 面)
 * 按构造恒为"新增 0",是问责/巡检读数;提交链走 `--staged`。
 *
 * ## 取材纪律(守门 118 口径)
 *
 * 全量判 HEAD blob、`--staged` 判索引 blob;两面旗同给 = 用法错(exit 2);取不到面一律抛
 * `Undetermined` ⇒ exit 2,不冒红也不记绿、不回落另一个面。清单与正文同面同轮,都出自
 * `./lib/face-reader.mjs`。**死判据**:HEAD 面零候选 ⇒ exit 2(尺子失效,绝不记绿)。
 *
 * ## 射程
 *
 * `apps/**` + `packages/**` 的 `.ts/.tsx/.js/.mjs/.py`,**排除**测试面(`/tests/`/`__tests__/`
 * `*.test.*`/`test_*.py`/`/e2e/`/`/fixtures/`)—— 测试夹具的 TEMP 落盘属 check-fixture-tmpdir
 * 射程,不在此重复判。`scripts/` 不在射程(fixture-tmpdir 已守)。
 *
 * ## CLI
 *
 * `node scripts/check-runtime-tmp-landing.mjs [--staged|--json|--quiet|--strict|--self-test]`
 * 退出码:0 = 判定完成且无新增违规;1 = 新增 F1;2 = 无法判定或用法错。
 * mode: warn 起步(存量虽已改道,但等 HEAD 面确认清零后再升 blocking,§0.2 恒红门禁令)。
 * 跳过:HUSKY_SKIP_RUNTIME_TMP_LANDING=1。
 */

import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  selectFace,
} from './lib/face-reader.mjs'
import {
  maskCommentsAndStrings,
} from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SELF = 'scripts/check-runtime-tmp-landing.mjs'
export const OWN_TEST = 'scripts/tests/check-runtime-tmp-landing.test.mjs'

/**
 * Python 最小遮罩(长度保持,保行号):把 `#` 注释与三引号/单双引号字符串抹成同长度空格
 * (换行保留)。共享层 code-mask.mjs 的分词器只认 ps/sh/bat/vbs,不认 `#` 与三引号串
 * (与 check-disk-root-write 头注「Python 遮罩自带」同因),故本门自带这一台最小查找器。
 * 判据只需"注释与字符串里的 TEMP 字样不算真调用"⇒ 空格替换足够,不需 token 化。
 */
export function maskPython(src) {
  const out = src.split('')
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    // 三引号串(''' 或 """)
    if ((c === "'" || c === '"') && src[i + 1] === c && src[i + 2] === c) {
      const q = c
      let j = i + 3
      while (j < n && !(src[j] === q && src[j + 1] === q && src[j + 2] === q)) {
        if (src[j] === '\\') j++ // 转义跳过
        j++
      }
      j = Math.min(j + 3, n)
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' '
      i = j
      continue
    }
    // 单行注释:到行尾
    if (c === '#') {
      let j = i
      while (j < n && src[j] !== '\n') { out[j] = ' '; j++ }
      i = j
      continue
    }
    // 单引号/双引号串(含 f/r/b 前缀已在前导,引号本体在这里)
    if (c === "'" || c === '"') {
      const q = c
      let j = i + 1
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') j++
        if (src[j] === '\n') break // 未闭合跨行:按未闭合处理,不越界
        j++
      }
      const end = Math.min(j + 1, n)
      for (let k = i; k < end; k++) if (out[k] !== '\n') out[k] = ' '
      i = end
      continue
    }
    i++
  }
  return out.join('')
}


/** 扫描面扩展名。 */
export const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.py'])

const GIT_TIMEOUT = 120_000
const LIST_CAP = 40

// === 判据正则(掩码后判,防注释/字符串假阳) ===

/**
 * JS/TS TEMP 取值调用:os.tmpdir() / tmpdir() / mkdtempSync(join(tmpdir()…))。
 * 掩码面(注释与字符串已抹)上出现 `tmpdir(` 或 `mkdtempSync(` 才算真调用。
 */
export const JS_TMP_RE = /\b(?:tmpdir|mkdtempSync|mkdtemp)\s*\(/g

/**
 * Python TEMP 取值调用:tempfile.mkdtemp / NamedTemporaryFile / TemporaryDirectory /
 * gettempdir / mkstemp / mkdtemp。掩码面(# 注释与字符串已抹)上出现才算真调用。
 */
export const PY_TMP_RE =
  /\btempfile\.(?:mkdtemp|NamedTemporaryFile|TemporaryDirectory|gettempdir|mkstemp|mkdtemp)\s*\(|\bfrom\s+tempfile\s+import\b/g

/**
 * 接线豁免:文件是否引用了合规工厂。
 * JS/TS = `@ihui/shared` 的 getRuntimeTempRoot/ensureRuntimeTempRoot/runtimeTempPath;
 * Python = `app/core/runtime_temp` 的 install_runtime_temp_root / get_runtime_temp_root。
 * 只在掩码面(保留字符串)判——说明符是字符串,抹了就看不见。
 */
export const JS_WIRED_RE =
  /from\s+['"]@ihui\/shared['"]|getRuntimeTempRoot\s*\(|ensureRuntimeTempRoot\s*\(|runtimeTempPath\s*\(/
export const PY_WIRED_RE =
  /from\s+app\.core\.runtime_temp\s+import|import_runtime_temp_root\s*\(|get_runtime_temp_root\s*\(/

/**
 * 纯函数:对单份源码判 F1 命中(真 TEMP 落盘)与是否已接线。
 * @param rel 文件相对路径(决定用哪套掩码/正则)
 * @param src 源码正文
 * @returns {{ hits: Array<{line:number}>, wired: boolean, lang: 'js'|'py'|null }}
 */
export function judgeSource(rel, src) {
  if (typeof src !== 'string') return { hits: [], wired: false, lang: null }
  const ext = (rel.match(/\.[a-z]+$/) || [''])[0]
  if (!TARGET_EXTS.has(ext)) return { hits: [], wired: false, lang: null }
  const lang = ext === '.py' ? 'py' : 'js'
  let masked, wired
  if (lang === 'py') {
    masked = maskPython(src)
    wired = PY_WIRED_RE.test(src)  // 说明符/关键字不带注释干扰,可直读
  } else {
    masked = maskCommentsAndStrings(src)
    wired = JS_WIRED_RE.test(src)  // 掩码面保留字符串 ⇒ 说明符可见
  }
  const re = lang === 'py' ? PY_TMP_RE : JS_TMP_RE
  const g = re.global ? re : new RegExp(re.source, 'g')
  g.lastIndex = 0
  const hits = []
  // 逐匹配反查行号:掩码是等长遮罩,行号与原文一致
  const lineOf = (idx) => {
    let ln = 1
    for (let i = 0; i < idx && i < masked.length; i++) if (masked[i] === '\n') ln++
    return ln
  }
  let m
  while ((m = g.exec(masked)) !== null) {
    hits.push({ line: lineOf(m.index), match: m[0].trim() })
    if (m.index === g.lastIndex) g.lastIndex++
  }
  return { hits, wired, lang }
}

/**
 * 射程判断:apps/** 或 packages/** 的可判扩展名,排除测试面。
 * @param p 相对路径
 */
export function inScope(p) {
  if (!TARGET_EXTS.has((p.match(/\.[a-z]+$/) || [''])[0])) return false
  if (p.startsWith('scripts/')) return false  // fixture-tmpdir 已守 scripts/
  const low = p.toLowerCase()
  if (
    low.includes('/tests/') || low.includes('/__tests__/') ||
    /\.test\./.test(low) || /(^|\/)test_[^/]*\.py$/.test(low) ||
    low.includes('/e2e/') || low.includes('/fixtures/') || low.includes('/spec/')
  ) return false
  return p.startsWith('apps/') || p.startsWith('packages/')
}

/** 结构性排除(尺子自己与其镜像测试的材料)。 */
export const STRUCTURAL_EXCLUDES = new Set([SELF, OWN_TEST])

// === CLI ===
const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const QUIET = argv.includes('--quiet')
const SHOW_HELP = argv.includes('--help') || argv.includes('-h')
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.env.HUSKY_SKIP_RUNTIME_TMP_LANDING === '1') {
  if (!QUIET && !JSON_OUT) console.log('  ⏭  运行时 TEMP 落盘回归锁(HUSKY_SKIP_RUNTIME_TMP_LANDING=1,跳过)')
  process.exit(0)
}

if (isDirectRun && SHOW_HELP) {
  console.log(`check-runtime-tmp-landing.mjs — 运行时 TEMP 落盘回归锁(§15b 运行时对偶)
拦什么:运行时业务源码(apps/ + packages/,非测试)里"把临时落点交给进程 TEMP"的新增写法。
  合规出口:JS/TS=@ihui/shared getRuntimeTempRoot;Python=app/core/runtime_temp install_runtime_temp_root。
判据:F1 真TEMP落盘且未接线(差值棘轮只拦新增) / M1 已接线仍残留(只报数)。
用法:node scripts/check-runtime-tmp-landing.mjs [--staged|--json|--quiet|--strict|--self-test|--help]
退出码:0=无新增违规 1=新增F1 2=无法判定
跳过:HUSKY_SKIP_RUNTIME_TMP_LANDING=1`)
  process.exit(0)
}

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m' }

/**
 * 落槌(纯函数):接线豁免 + 差值棘轮。
 * 已接线(wired)⇒ 全部命中降级 M1 只报数;未接线 ⇒ F1,按 HEAD 锚点判新增。
 */
export function decide({ judged, anchor, face }) {
  const violations = []
  const stock = []
  const wiredResidual = []
  for (const j of judged) {
    if (j.error || j.lang === null) continue
    if (j.wired) {
      if (j.hits.length > 0) wiredResidual.push({ rel: j.rel, hits: j.hits })
      continue
    }
    if (j.hits.length === 0) continue
    const base = anchor.get(j.rel) ?? 0
    if (face === 'head') {
      stock.push({ rel: j.rel, count: j.hits.length, lines: j.hits.map((h) => h.line) })
      continue
    }
    if (j.hits.length > base) {
      violations.push({
        rel: j.rel, hits: j.hits, base, count: j.hits.length - base,
        why: `本次新增 F1 ${j.hits.length - base} 处(HEAD 面该文件 ${base})`,
      })
    } else {
      stock.push({ rel: j.rel, count: j.hits.length, lines: j.hits.map((h) => h.line) })
    }
  }
  return { violations, stock, wiredResidual }
}

/**
 * 一面完整判定。取不到面一律抛 Undetermined ⇒ main 折成 exit 2。
 */
export function analyze({ face = 'head', root = ROOT } = {}) {
  const top = assertRepoRoot(root, 'runtime-tmp-landing 的判定根')
  // staged 面不传 tree-ish(`ls-tree -r` 默认列 index),否则空字符串被当 tree-ish 会
  // `fatal: Not a valid object name`(worktree 形态实测);head 面显式传 HEAD。
  const listed = gitRaw(['ls-tree', '-r', '--name-only', ...(face === 'staged' ? [] : ['HEAD']), '-z'], top, { timeout: GIT_TIMEOUT })
    .split('\0').filter(Boolean)
    .filter((p) => TARGET_EXTS.has((p.match(/\.[a-z]+$/) || [''])[0]) && inScope(p) && !STRUCTURAL_EXCLUDES.has(p))
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = listed.map((p) => `${rev}:${p}`)
  const got = listed.length ? catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 29 }) : new Map()
  const rows = listed.map((rel) => ({ rel, src: got.get(`${rev}:${rel}`) ?? null }))
  for (const r of rows) {
    if (r.src === null) throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} blob 取不到 ${r.rel} ⇒ 该面无法判定`)
  }
  const judged = rows.map((r) => ({ rel: r.rel, ...judgeSource(r.rel, r.src) }))

  // 锚点 = HEAD 面该文件自身的 F1 数。staged 档只给未接线且有命中的文件取锚点。
  const anchor = new Map()
  if (face === 'head') {
    for (const j of judged) if (!j.error && j.lang !== null) anchor.set(j.rel, j.hits.length)
  } else {
    const need = judged.filter((j) => !j.error && !j.wired && j.hits.length > 0).map((j) => j.rel)
    if (need.length) {
      const nspecs = need.map((r) => `HEAD:${r}`)
      const ngot = catBatch(top, nspecs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
      for (const rel of need) {
        const src = ngot.get(`HEAD:${rel}`) ?? null
        // HEAD 取不到 ⇒ 本轮新增文件,基线 0
        anchor.set(rel, src !== null ? judgeSource(rel, src).hits.length : 0)
      }
    }
  }
  return { face, judged, anchor, listed: listed.length }
}

function main() {
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: false, def: 'head' })
  if (!face || error) {
    console.error(`${C.red}❌ ${error || '取不到判定面'} ⇒ exit 2(用法错或取不到面)${C.reset}`)
    process.exit(2)
  }
  try {
    const a = analyze({ face, root: ROOT })
    if (face === 'head' && a.listed === 0) {
      console.error(`${C.red}❌ HEAD 面一个可判候选都没有 ⇒ 尺子疑似失效 ⇒ exit 2${C.reset}`)
      process.exit(2)
    }
    const d = decide({ judged: a.judged, anchor: a.anchor, face })
    const newCount = d.violations.reduce((s, v) => s + v.count, 0)
    const stockCount = d.stock.reduce((s, v) => s + v.count, 0)
    const wiredCount = d.wiredResidual.reduce((s, v) => s + v.hits.length, 0)
    if (JSON_OUT) {
      console.log(JSON.stringify({
        face, listed: a.listed, newViolations: d.violations.map((v) => ({ rel: v.rel, count: v.count, why: v.why })),
        newCount, stockCount, wiredResidualCount: wiredCount, verdict: newCount > 0 ? 'violation' : 'clean',
      }, null, 2))
      process.exit(newCount > 0 ? 1 : 0)
    }
    if (QUIET) process.exit(newCount > 0 ? 1 : 0)
    console.log(`[runtime-tmp-landing] 判定面=${face}:运行时源码候选 ${a.listed} 个;新增 F1 ${newCount} 处 / ${d.violations.length} 文件,存量(棘轮只报数)${stockCount} 处,已接线残留 M1 ${wiredCount} 处`)
    if (d.violations.length > 0) {
      console.error(`${C.red}❌ 运行时 TEMP 落盘新增(未接合规工厂):${C.reset}`)
      for (const v of d.violations.slice(0, LIST_CAP)) {
        console.error(`  ${C.red}${v.rel}:${v.hits.map((h) => h.line).join(',')} —— ${v.why}${C.reset}`)
      }
      console.error(`  出路:改道合规工厂(JS/TS=import { getRuntimeTempRoot } from '@ihui/shared';Python=from app.core.runtime_temp import install_runtime_temp_root)`)
      console.error(`  应急跳过(不推荐):HUSKY_SKIP_RUNTIME_TMP_LANDING=1`)
    }
    process.exit(newCount > 0 ? 1 : 0)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`${C.red}❌ 无法判定:${e.message} ⇒ exit 2(不冒红也不记绿)${C.reset}`)
      process.exit(2)
    }
    throw e
  }
}

if (isDirectRun && !SHOW_HELP && !argv.includes('--self-test')) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
