#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-bare-decode-uri.mjs — 裸 decodeURIComponent 差值棘轮门
 *
 * 立因(2026-10-25 移动端行为级/逻辑级深挖轮):
 *   `decodeURIComponent` 对**孤立 `%`** 抛 `URIError: URI malformed`。小程序 `router.params` /
 *   RN 深链参数由框架自动解码过一次,端上再手写 decode 属二次解码;原文含 `%`(分享文案
 *   「100%好评」、昵称/房间名/头像 URL)时,这一抛落在 useEffect/useMemo/useState 初始值的
 *   渲染求值路径上 = **整页崩**。typecheck/lint/既有守门全测不到(纯运行时炸点)。
 *   当轮移动端 15+2 处实证已全量接入跨端唯一容错出口 `safeDecodeURIComponent`
 *   (packages/shared/src/utils/safe-decode-uri.ts)。
 *
 * 判据 D1(拦增量):被审面的 .ts/.tsx/.js/.jsx 里出现 `decodeURIComponent(` 调用形态,且
 *   ① 不在同文件的 try 语句块内(注释按 code-mask 等长遮罩后判,行号不漂);
 *   ② 该行无行内豁免 `// bare-decode-uri-exempt: <原因>`(§0.7 验过才免,带原因才生效)。
 *   违规计数以"该文件在 HEAD 面自身的计数"为锚做差值棘轮:**只拦本次提交带进来的增量**;
 *   存量(web 腿与历史就地 try 包装)只报数(§12e 恒红门禁令:存量未归零不得绝对判红)。
 *
 * 附加报数 D2(不判红):落在 try 块内的 decode = 第二份包装的形态提示,推动向 safe 单源收敛。
 *
 * 取材纪律(§0.4 同面同轮):全量档判 **HEAD blob**,`--staged` 判**索引 blob**,
 *   `--worktree` 仅人工逃生舱(该档不设棘轮、全量报数);两面旗同给 exit 2;
 *   被审面取不到 ⇒ 「未判定」exit 2(既不记绿也不冒红);枚举到 0 个候选文件判死。
 *
 * 退出码:0 通过 / 1 阻断(存在本次新增违规)/ 2 未判定。
 *
 * 用法:
 *   node scripts/check-bare-decode-uri.mjs                 # 全量档(HEAD 面)
 *   node scripts/check-bare-decode-uri.mjs --staged        # pre-commit 档(索引面)
 *   node scripts/check-bare-decode-uri.mjs --worktree      # 人工排查(盘上,含未提交)
 *   node scripts/check-bare-decode-uri.mjs --self-test     # 判据构造自证(含注入自证)
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { catBatch, listFaceFiles, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = resolve(import.meta.dirname, '..')

/** 射程:能 import @ihui/shared 的宿主端;新增宿主须同批评估 import 可行性再扩面(§0.9 接线诚实)。 */
const SUBTREES = [
  'apps/miniapp-taro',
  'apps/mobile-rn',
  'packages/app',
  'packages/ui-native',
  'apps/web',
  'apps/extension',
  'apps/desktop/src',
]
const FILE_RE = /\.(ts|tsx|js|jsx)$/
const EXCLUDE_RE = /(\.generated\.|__tests__[/\\]|[/\\]tests?[/\\]|\.test\.|\.d\.ts$|node_modules|[/\\]dist[/\\])/

const DECODE_RE = /(?<![A-Za-z0-9_$.])decodeURIComponent\s*\(/g
const EXEMPT_RE = /\/\/[^\n]*bare-decode-uri-exempt:\s*\S.{2,}/

/**
 * try 块保护判定:从命中点向前逐个找 `try`,检查其 `{` 到命中点之间深度是否 >0(未被闭合出块)。
 */
export function inTryBlock(masked, idx) {
  let t = masked.lastIndexOf('try', idx)
  while (t >= 0) {
    const brace = masked.indexOf('{', t)
    if (brace >= 0 && brace < idx) {
      let depth = 0
      for (let k = brace; k < idx; k++) {
        if (masked[k] === '{') depth++
        else if (masked[k] === '}') depth--
        if (depth === 0) break
      }
      if (depth > 0) return true
    }
    t = masked.lastIndexOf('try', t - 1)
  }
  return false
}

/**
 * 纯判据(镜像测试的 import 对象):text=注释已遮罩文本;rawForExempt=原文(判行尾豁免标记)。
 * @returns {{bare:int[], triedWrapped:int}}
 */
export function classifyDecodes(text, rawForExempt) {
  const bare = []
  let triedWrapped = 0
  const exemptLines = new Set()
  if (rawForExempt) {
    rawForExempt.split('\n').forEach((l, i) => {
      if (EXEMPT_RE.test(l)) exemptLines.add(i + 1)
    })
  }
  const re = new RegExp(DECODE_RE.source, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length
    if (exemptLines.has(line)) continue
    if (inTryBlock(text, m.index)) {
      triedWrapped++
      continue
    }
    bare.push({
      line,
      snippet: text
        .slice(Math.max(0, m.index - 60), m.index + 70)
        .replace(/\s+/g, ' ')
        .trim(),
    })
  }
  return { bare, triedWrapped }
}

function countFor(text) {
  const masked = maskComments(text)
  return classifyDecodes(masked, text)
}

/** 一次批量读一组规格(同面同轮),失败向上抛 Undetermined 由调用方折未判定。 */
function faceTexts(face, paths) {
  if (face === 'worktree') {
    const map = new Map()
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
  return catBatch(ROOT, specs)
}

export function runAudit({ face = 'head', files: only = null } = {}) {
  let list
  if (only && only.length) {
    list = only
  } else {
    list = listFaceFiles(ROOT, face, { paths: SUBTREES })
  }
  const files = list.filter((p) => FILE_RE.test(p) && !EXCLUDE_RE.test(p))
  if (files.length === 0) {
    return { status: 'undetermined', reason: `枚举到 0 个候选文件(face=${face}),判死不记绿` }
  }

  const unjudgedEarly = []
  const cur = faceTexts(face, files)
  // 三面统一:被审面取不到的路径先点名进 unjudged(不视为"无违规");取到且含关键字才成为候选
  const candidates = []
  for (const p of files) {
    const spec = face === 'worktree' ? p : face === 'staged' ? `:${p}` : `HEAD:${p}`
    const t = cur.get(spec)
    if (t === null || t === undefined) {
      unjudgedEarly.push({ file: p, reason: '被审面取不到该文件(不视为无违规;可能是 --files 传了不存在的路径)' })
      continue
    }
    if (t.includes('decodeURIComponent')) candidates.push(p)
  }
  const cand = candidates
  const headMap =
    cand.length && face !== 'worktree' ? faceTexts('head', cand) : new Map()

  const fails = []
  const stocks = []
  const unjudged = []
  let triedTotal = 0
  let scannedWithKeyword = 0
  for (const p of cand) {
    scannedWithKeyword++
    const spec = face === 'worktree' ? p : face === 'staged' ? `:${p}` : `HEAD:${p}`
    const text = cur.get(spec)
    if (text === null || text === undefined) {
      unjudged.push({ file: p, reason: '被审面取不到该 blob(不视为无违规)' })
      continue
    }
    const c = countFor(text)
    triedTotal += c.triedWrapped
    if (face === 'worktree') {
      if (c.bare.length) stocks.push({ file: p, bare: c.bare.length, anchor: null, delta: null })
      continue
    }
    const h = headMap.get(`HEAD:${p}`)
    if (h === null || h === undefined) {
      unjudged.push({ file: p, reason: 'HEAD 锚取不到(无法做差值棘轮,不猜)' })
      continue
    }
    const anchor = countFor(h).bare.length
    const delta = c.bare.length - anchor
    if (delta > 0) fails.push({ file: p, bare: c.bare.length, anchor, delta, first: c.bare[0] })
    else if (c.bare.length > 0) stocks.push({ file: p, bare: c.bare.length, anchor, delta })
  }

  return {
    status: fails.length ? 'fail' : 'pass',
    face,
    filesScanned: files.length,
    scannedWithKeyword,
    fails,
    stocks,
    unjudged: [...unjudgedEarly, ...unjudged],
    triedWrappedTotal: triedTotal,
  }
}

function printReport(rep, quiet) {
  console.log(
    `裸 decodeURIComponent 差值棘轮门 face=${rep.face} 扫描 ${rep.filesScanned} 文件 / 含调用点候选 ${rep.scannedWithKeyword}`,
  )
  if (rep.fails.length) {
    console.log(`\n✗ 本次新增违规 ${rep.fails.length} 处(只拦增量,存量放):`)
    for (const f of rep.fails) {
      console.log(
        `  ${f.file}: 被审面 ${f.bare} 处裸 decode(HEAD 锚 ${f.anchor}) ⇒ 新增 ${f.delta}${f.first ? ` —— 其一行号 ${f.first.line}: ${f.first.snippet.slice(0, 90)}` : ''}`,
      )
    }
    console.log(
      "  出路:改 import { safeDecodeURIComponent } from '@ihui/shared'(永不抛、失败原样返回);" +
        '确需原生抛语义时行尾加 // bare-decode-uri-exempt: <原因>',
    )
  }
  if (rep.stocks.length && !quiet) {
    console.log(`▸ 存量只报数(§12e):${rep.stocks.length} 文件仍持裸 decode(归 web 腿/存量收敛批)`)
    for (const s of rep.stocks) console.log(`  ${s.file}: ${s.bare} 处${s.anchor === null ? '(worktree 档无锚)' : `(HEAD 锚 ${s.anchor})`}`)
  }
  if (rep.triedWrappedTotal && !quiet) {
    console.log(`▸ D2:${rep.triedWrappedTotal} 处 decode 落在 try 块内(第二份包装;建议改 safe 单源消重)`)
  }
  if (rep.unjudged.length) {
    console.log(`⚠ 未判定 ${rep.unjudged.length} 文件:`)
    for (const u of rep.unjudged) console.log(`  ${u.file}: ${u.reason}`)
  }
  if (rep.status === 'pass') console.log('✓ 无新增违规')
}

// ── self-test:构造面证明判据有牙(不依赖真仓内容) ────────────────────────
export function selfTestCases() {
  const BARE = `const x = (p) => decodeURIComponent(p)\nexport default x\n`
  const TRY = `const x = (p) => { try { return decodeURIComponent(p) } catch { return p } }\n`
  const SAFE = `const x = (p) => safeDecodeURIComponent(p)\n`
  const EXEMPT = `const x = (p) => decodeURIComponent(p) // bare-decode-uri-exempt: 上游确未编码且值域不含%\n`
  const COMMENT = `// 例:decodeURIComponent(p) 会抛\nconst x = 1\n`
  const cases = []
  const t = (name, cond) => cases.push({ name, ok: !!cond })
  t('裸调用判 1', classifyDecodes(maskComments(BARE), BARE).bare.length === 1)
  t('try 包裹不判裸', classifyDecodes(maskComments(TRY), TRY).bare.length === 0)
  t('try 包裹进 D2', classifyDecodes(maskComments(TRY), TRY).triedWrapped === 1)
  t('safe 前缀不误伤', classifyDecodes(maskComments(SAFE), SAFE).bare.length === 0)
  t('行内豁免生效', classifyDecodes(maskComments(EXEMPT), EXEMPT).bare.length === 0)
  t('豁免须带原因(裸标记不免)', classifyDecodes(maskComments(`const x = decodeURIComponent(p) // bare-decode-uri-exempt:\n`), `const x = decodeURIComponent(p) // bare-decode-uri-exempt:\n`).bare.length === 1)
  t('注释命中被遮', classifyDecodes(maskComments(COMMENT), COMMENT).bare.length === 0)
  t('遮罩等长行号不漂', maskComments(BARE).split('\n').length === BARE.split('\n').length)
  t('inTry 出块即止', inTryBlock('{ try { f(1) } g(2); h(3) }', 30) === false)
  // 有牙锁:拿恒绿判据(手写第二份"什么都不判")对照 —— 真判据必须能抓到,假判据必须抓不到;
  // 任一侧失配说明判据被削或本例失效(§22c 镜像同步思路:判据改动会在这里现形)。
  const fakeAlwaysGreen = () => ({ bare: [], triedWrapped: 0 })
  t('恒绿对照组抓不到(判据确有别于空判)', fakeAlwaysGreen().bare.length === 0 && classifyDecodes(maskComments(BARE), BARE).bare.length === 1)
  return cases
}

function selfTest() {
  const cases = selfTestCases()
  let pass = 0
  for (const c of cases) {
    if (c.ok) pass++
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}`)
  }
  console.log(`self-test: ${pass}/${cases.length}`)
  process.exit(pass === cases.length ? 0 : 1)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.log(`⚠ ${error} —— 未判定(exit 2)`)
    process.exit(2)
  }
  const fi = argv.indexOf('--files')
  const only = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const quiet = argv.includes('--quiet')
  let rep
  try {
    rep = runAudit({ face, files: only })
  } catch (e) {
    if (e instanceof Undetermined || e?.name === 'Undetermined') {
      console.log(`⚠ 取材未判定:${e.message}(既不记绿也不冒红,exit 2)`)
      process.exit(2)
    }
    throw e
  }
  if (rep.status === 'undetermined') {
    console.log(`⚠ 未判定:${rep.reason}`)
    process.exit(2)
  }
  printReport(rep, quiet)
  if (rep.fails.length) process.exit(1)
  if (rep.unjudged.length) {
    console.log('⚠ 存在未判定文件,不记绿(exit 2)')
    process.exit(2)
  }
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { classifyDecodes, inTryBlock, runAudit, selfTestCases, SUBTREES, EXEMPT_RE, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
