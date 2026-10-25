#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-money-display-single-source.mjs
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:显示层「分→元格式化」只许一个出口(2026-10-26 立,守门 248)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_MONEY_DISPLAY_SINGLE_SOURCE,stagedTriggers = 显示层四端)。
 *
 * —— 立因(现读为证)——
 * `const fmtYuan = (x: number) => `¥${(x / 100).toFixed(2)}`` 这同一形状在 HEAD 曾被逐字复制
 * 16 份(web 12、packages/app 2、miniapp 1、RN 1);同一提交里改单位口径必须 16 处手改,漏一处
 * 就是一个端页的「分当元」100 倍显示事故(分销族 46758b5b2b8 批修的就是同型受害者)。本波把全部
 * 展示型副本委托到 @ihui/shared/utils 的 formatPrice(唯一出口,非有限值回 '0.00'),数字换算型
 * (centsToYuan/fenToYuan 返回 number 再运算)不属展示格式化,不在射程。装这道闸防第二份自算实现复活。
 *
 * —— 判据 ——
 * M1(绝对零容忍):显示层面(apps/web、apps/miniapp-taro、apps/mobile-rn、packages/app)内
 *    局部定义的展示型分→元函数(fmtYuan/toYuan/fenToYuan/fen2yuan/centsToYuan/name 含 Yuan)
 *    **函数体内仍含 `/ 100` 或 `* 0.01` 自算 + (toFixed|¥|toLocaleString|模板串) 格式化语义** ⇒ 红。
 *    委托形(forwarding:体内调 formatPrice,无算式)合法 —— 定罪看实现不看名字,与同族日界闸 246 同口径。
 * M2(差值棘轮,锚点=该文件 HEAD 面计数):行内 `(x / 100).toFixed(...)`/`¥$((x / 100)`/
 *    `format(x / 100)` 型现场格式化 ⇒ 只拦新增(现读存量 54 处,当场绝对零容忍=恒红门,§12e)。
 * M3(装车证明):唯一出口住在 packages/shared 且被 ≥1 个显示层文件 import。
 * 数字换算返回 number 且无格式化语义(无 toFixed/¥/模板)⇒ 出射程(它是运算不是展示)。
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱;
 * 两面旗同给 exit 2;取不到 ⇒ 未判定;枚举 0 ⇒ 判死。
 * 用法:node scripts/check-money-display-single-source.mjs [--staged|--worktree] [--self-test]
 * 退出码:0 无判红 / 1 判红 / 2 未判定
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitErrText, gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SURFACES = ['apps/web', 'apps/miniapp-taro', 'apps/mobile-rn', 'packages/app']
const EXIT_MODULE = 'packages/shared/src/utils/format.ts'
const RE_TESTISH = /\.test\.|__tests__|\.stories\.|e2e/
const INLINE_RE =
  /\/\s*100\s*\)\s*\.\s*(?:toFixed\(|toLocaleString)|¥\$\{[^}]*\/\s*100|\b\w*[Ff]ormat\w*\([^{)]*\/\s*100|\bformatFiniteNumber\([^)]*\/\s*100/

/**
 * 本地展示型分→元**函数定义**+定长两位小数格式化 ⇒ M1。
 * 三种合法形状不误伤:
 *  - 委托转发(体内调 formatPrice,无 `/ 100`);
 *  - 数字换算(无 ¥/toFixed(2) 格式化 ⇒ 出射程);
 *  - 局部常量表达式 `const amountYuan = (plan.amount / 100).toFixed(2)`(不是函数定义;
 *    它的格式化在下一行同形由 M2 棘轮管)与动态精度 `toFixed(digits)`/4 位定价展示(非定长两位,语义不同族)。
 * 箭头定义识别:`const 名 = (参数: 类型) =>`(带类型签名的形参);函数式:`function 名(` 头 + 前 2 行体。
 */
const ARROW_TYPED_RE = /(?:const|let)\s+(\w*(?:Yuan|yuan)\w*)\s*=\s*\(\s*\w+\s*:\s*[\w<>[\] |]+\s*\)\s*(?::\s*[\w<>[\] |]+\s*)?=>/
const FUNC_DEF_HEAD_RE = /function\s+(\w*(?:Yuan|yuan)\w*)\s*\(/
const FIXED_TOWO_RE = /\/\s*100\s*\)?\s*\.\s*toFixed\(\s*2\s*\)|¥\$\{[^}]*\/\s*100[^}]*\}\$\{?[^}]*toFixed\(\s*2|¥\$\{formatPrice/

export function findLocalCentsYuanFormats(src) {
  const hits = []
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
    // 必须是"函数定义"行(箭头带类型签名 或 function 头),名字含 yuan
    const isDef = ARROW_TYPED_RE.test(line) || FUNC_DEF_HEAD_RE.test(line)
    if (!isDef) continue
    const nameMatch = line.match(ARROW_TYPED_RE) || line.match(FUNC_DEF_HEAD_RE)
    const name = nameMatch ? nameMatch[1] : ''
    if (!/\b(yuan|Yuan)\b/.test(name) && !/yuan/i.test(name)) continue
    // 体窗口:本行或函数体起 2 行内出现 "定长 /100 + toFixed(2)" 自算 ⇒ 定罪;
    // 委托体只调 formatPrice ⇒ 无 `/ 100` 不出击。动态精度(digits 变量)不算定长。
    const win = lines.slice(i, i + 4).join('\n')
    if (!/\/\s*100/.test(win)) continue
    if (!FIXED_TOWO_RE.test(win)) continue
    hits.push({ line: i + 1, name })
  }
  return hits
}

/** 行内展示型分→元格式化(不含被点名定义行):M2 计数用。 */
export function countInlineCentsFormats(src) {
  let n = 0
  for (const line of src.split(/\r?\n/)) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
    if (INLINE_RE.test(line)) n++
  }
  return n
}

function listScopeFiles(face) {
  if (face === 'worktree') {
    // 取材统一走层(scripts/lib/face-reader.mjs):cwd / encoding / windowsHide 由 gitRaw 提供;
    // maxBuffer 与原调用一致。取不到(非零退出/异常)仍返回 null。
    let stdout
    try {
      stdout = gitRaw(['ls-files', '--', ...SURFACES], ROOT, { maxBuffer: 1 << 28 })
    } catch {
      return null
    }
    return stdout.split(/\r?\n/).filter((s) => /\.(ts|tsx)$/.test(s) && !RE_TESTISH.test(s))
  }
  const args =
    face === 'staged' ? ['ls-files', '--', ...SURFACES] : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SURFACES]
  // 同上:absolute git / safe.directory / quotepath / stdio 全由层接管;maxBuffer 不变。
  let stdout
  try {
    stdout = gitRaw(args, ROOT, { maxBuffer: 1 << 28 })
  } catch {
    return null
  }
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => (face === 'head' ? l : l.trim()))
    .filter((s) => /\.(ts|tsx)$/.test(s) && !RE_TESTISH.test(s))
}

export function evaluate(files, anchorCounts = new Map()) {
  const m1 = []
  const m2new = []
  let importer = 0
  for (const [rel, text] of files) {
    if (text === null || text === undefined) return { undetermined: `取不到 ${rel}` }
    if (rel.endsWith(EXIT_MODULE)) continue
    if (/from '@ihui\/shared\/utils'/.test(text) && /formatPrice/.test(text)) importer++
    for (const h of findLocalCentsYuanFormats(text)) m1.push({ file: rel, ...h })
    const n = countInlineCentsFormats(text)
    const a = anchorCounts.get(rel) ?? 0
    if (n > a) m2new.push({ file: rel, n, anchor: a })
  }
  if (files.length === 0) return { undetermined: '枚举到 0 个显示层文件(判死)' }
  if (importer === 0) return { m1, m2new, undetermined: null, w3fail: 'formatPrice 出口无显示层 import 消费者' }
  return { m1, m2new, importer }
}

export function selfTest() {
  const fails = []
  const check = (n, c) => {
    if (!c) fails.push(n)
  }
  const bad = "const fmtYuan = (n: number) => `¥${(n / 100).toFixed(2)}`\n"
  check('M1 必拒:自算定义', findLocalCentsYuanFormats(bad).length === 1)
  const goodFwd = "const fmtYuan = (n: number) => `¥${formatPrice(n)}`\n"
  check('M1 不得误拒:委托转发', findLocalCentsYuanFormats(goodFwd).length === 0)
  const numeric = 'function fenToYuan(cents: number): number {\n  return Number.isFinite(cents) ? cents / 100 : 0\n}\n'
  check('数字换算(无格式化)出射程', findLocalCentsYuanFormats(numeric).length === 0)
  check('M2 计数行内形态', countInlineCentsFormats('  <p>{curFmt.format(a.cost / 100)}</p>\n') === 1)
  check('M2 注释行不算', countInlineCentsFormats('  // (x / 100).toFixed(2)\n') === 0)
  const r1 = evaluate([['apps/web/x.tsx', goodFwd]], new Map())
  check('evaluate 委托全绿(importer 需≥1 → 补一条)', r1.w3fail || r1.m1.length === 0)
  const r2 = evaluate(
    [
      ['apps/web/x.tsx', "import { formatPrice } from '@ihui/shared/utils'\n" + goodFwd],
      ['apps/web/y.tsx', bad],
    ],
    new Map(),
  )
  check('evaluate M1 点名带自算定义', r2.m1.length === 1 && r2.m1[0].file === 'apps/web/y.tsx')
  const r3 = evaluate([['apps/web/x.tsx', "import { formatPrice } from '@ihui/shared/utils'\nconst a = (t / 100).toFixed(2)"]], new Map([['apps/web/x.tsx', 0]]))
  check('evaluate M2 新增内联判红', r3.m2new.length === 1)
  const r4 = evaluate([['apps/web/x.tsx', "import { formatPrice } from '@ihui/shared/utils'\nconst a = (t / 100).toFixed(2)"]], new Map([['apps/web/x.tsx', 1]]))
  check('evaluate M2 锚点内只报数', r4.m2new.length === 0)
  const r5 = evaluate([['apps/web/x.tsx', 'no format at all\n']], new Map())
  check('evaluate 无 importer ⇒ W3 fail', Boolean(r5.w3fail))
  check('empty ⇒ 判死', Boolean(evaluate([], new Map()).undetermined))
  return fails
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const fails = selfTest()
    if (fails.length === 0) {
      console.log('[分元显示闸] --self-test 通过(10 例成对夹具)')
      process.exit(0)
    }
    for (const f of fails) console.log('  FAIL:', f)
    process.exit(1)
  }
  const useStaged = argv.includes('--staged')
  const useWorktree = argv.includes('--worktree')
  if (useStaged && useWorktree) {
    console.log('[分元显示闸] 无法判定:--staged 与 --worktree 同给')
    process.exit(2)
  }
  const face = useWorktree ? 'worktree' : useStaged ? 'staged' : 'head'
  const rels = listScopeFiles(face)
  if (rels === null) {
    console.log('[分元显示闸] 未判定:ls 面失败')
    process.exit(2)
  }
  const prefix = face === 'staged' ? ':' : face === 'head' ? 'HEAD:' : ''
  const want = [...rels, EXIT_MODULE]
  let got
  try {
    got = catBatch(ROOT, face === 'worktree' ? want : want.map((r) => prefix + r), { maxBuffer: 1 << 29 })
  } catch (e) {
    console.log(`[分元显示闸] 未判定:取材失败 ${gitErrText(e)}`)
    process.exit(2)
  }
  const read = (rel) => {
    const v = got.get(face === 'worktree' ? rel : prefix + rel)
    if (v !== undefined && v !== null) return v
    return existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), 'utf8') : null
  }
  // 锚点面:HEAD 计数(staged/worktree 档也要 HEAD 锚 ⇒ 一次读齐缺的)
  const anchor = new Map()
  {
    // 锚点面清单同样走层;原来 spawnSync 只看 status===0 才继续,这里 catch 走同一分支。
    let arels = null
    try {
      arels = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SURFACES], ROOT, {
        maxBuffer: 1 << 28,
      })
        .split(/\r?\n/)
        .filter((s) => /\.(ts|tsx)$/.test(s) && !RE_TESTISH.test(s))
    } catch {
      arels = null
    }
    if (arels !== null) {
      let agot
      try {
        agot = catBatch(ROOT, arels.map((x) => 'HEAD:' + x), { maxBuffer: 1 << 29 })
      } catch {
        agot = new Map()
      }
      for (const x of arels) anchor.set(x, countInlineCentsFormats(agot.get('HEAD:' + x) ?? ''))
    }
  }
  const files = rels.map((rel) => [rel, read(rel)])
  const res = evaluate(files, anchor)
  if (res.undetermined) {
    console.log(`[分元显示闸] 未判定:${res.undetermined}`)
    process.exit(2)
  }
  for (const v of res.m1) console.log(`  M1 ${v.file}:${v.line} 本地展示型分→元自算定义「${v.name}」`)
  for (const v of res.m2new) console.log(`  M2 ${v.file} 行内分→元 ${v.n} > 锚点 ${v.anchor}(只拦新增,拆行/重排计数涨也红:请改委托 formatPrice)`)
  if (res.m1.length + res.m2new.length > 0) {
    console.log('[分元显示闸] ❌ 判红')
    console.log('  唯一出口:import { formatPrice } from @ihui/shared/utils;委托转发合法(formatPrice 出口自身除外)。')
    process.exit(1)
  }
  if (res.w3fail) {
    console.log(`[分元显示闸] ❌ 装车:${res.w3fail}`)
    process.exit(1)
  }
  console.log(`[分元显示闸] ✅ 无判红(显示层文件 ${files.length} | 出口 importer ${res.importer})`)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { findLocalCentsYuanFormats, countInlineCentsFormats, evaluate, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
