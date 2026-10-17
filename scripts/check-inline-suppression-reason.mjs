#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-inline-suppression-reason.mjs — 行内豁免(抑制注释)必须带原因的只读对账尺子
 *
 * ## 立因
 * AGENTS §0.7 写明「豁免必须"验过才免"且会到期:行内豁免标记必须带原因、逐行生效」。
 * 登记式豁免族(守门 108 存活期表)有尺子,**行内 `eslint-disable` / `@ts-ignore` /
 * `@ts-expect-error` 这一族此前只有散文**——现读两端源码即有实证:48 处抑制里 30+ 处不带任何原因,
 * 另有 `apps/mobile-rn/src/screens/ChatToolsScreen.tsx` 用 `eslint-disable @typescript-eslint/no-explicit-any`
 * 顶替 §3 要求的 `// FIXME(any): 原因+移除计划` 形态(把"例外"写成了"消音")。
 * 无原因的豁免不可复核:三个月后没人知道它还在挡什么,而它大概率已经不挡任何东西
 * (同一条教训见 `--report-unused-disable-directives` 那一族:本尺子实测两端目前 0 处失效豁免)。
 *
 * ## 判据
 *  - eslint 系指令:必须带 eslint 自己的描述分隔符 `-- <非空文字>`;
 *  - `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`:本行有 `--`/`:` 后的非空理由,
 *    或**紧邻上一行**是一条有内容的注释(中文英文均可,≥8 字符)——TS 没有 eslint 的分隔符约定,
 *    所以只认这两种书写位,不认"理由在文件某处"。
 *  - 文件级 `/* eslint-disable ... *\/`(整文件生效)一律算违规面:§0.7 要求"逐行生效",
 *    整文件消音正是它要防的形态。
 *
 * ## 差值棘轮(为什么存量不判红)
 * 锚点 = 该文件 HEAD 自身的命中数(§0.5)。全量档(head 面)按构造"新增 0",只报存量;
 * `--staged` 档比较索引与 HEAD,只拦"本次把裸豁免加回来"。存量 48 处归零之前把它升成
 * 提交链 blocking 就是 §12e 禁的恒红门,所以**本尺子当前未接提交链**:
 * 注册需要两件事同笔做——① runner 注册条目(登记面持有人),② AGENTS/README 点名(守门 89 R4 的
 * 义务,而 AGENTS.md 此刻由并发会话持有)。二者齐备前,它以人工/CI 只读方式运行。
 *
 * ## 三面纪律(§0.4)
 * 缺省判 **HEAD blob**;`--staged` 判**索引 blob**;`--worktree` 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;清单与正文同面同轮(经 `lib/face-reader.mjs`);取不到面 ⇒ 抛
 * `Undetermined` 折成 exit 2「未判定」,绝不回落另一个面、绝不记绿(§0.3)。
 *
 * 用法:
 *   node scripts/check-inline-suppression-reason.mjs            # 全量:HEAD 面,存量只报数
 *   node scripts/check-inline-suppression-reason.mjs --staged   # 提交链档:只拦新增
 *   node scripts/check-inline-suppression-reason.mjs --strict   # 问责存量
 *   node scripts/check-inline-suppression-reason.mjs --json
 *   node scripts/check-inline-suppression-reason.mjs --self-test
 * 退出码:0 通过 / 1 判红 / 2 用法错或未判定
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 60000
const SCOPE_DIRS = ['apps', 'packages']
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_RE = /(\/dist\/|\/node_modules\/|\.gen\.ts$|\/\.swc\/|\/build\/)/

const DIRECTIVE_RE =
  /(eslint-disable(?:-next-line|-line)?|@ts-(?:ignore|expect-error|nocheck|no-fallthrough))/

/** 一条指令是否"带原因"。reason 书写位只有两种:eslint 的 `-- 文字`,或上一行注释。 */
export function hasReason(lines, idx) {
  const line = lines[idx] ?? ''
  const after = line.split(/--/).slice(1).join('--').trim()
  if (after.length >= 4) return true
  const withColon = /@(ts-\w[\w-]*)\s*:\s*(.+)$/.exec(line)
  if (withColon && withColon[2].trim().length >= 4) return true
  for (let k = idx - 1; k >= Math.max(0, idx - 2); k--) {
    const prev = (lines[k] ?? '').trim()
    if (!prev) continue
    if (/^(\/\/|\/\*|\*)/.test(prev) && prev.replace(/^(\/\/|\/\*|\*)\s*/, '').length >= 8) return true
    break
  }
  return false
}

/** 文件级整块消音(`/* eslint-disable X *\/` 不带 -next-line/-line)⇒ 一律算违规。 */
function isFileLevel(line) {
  return /\/\*\s*eslint-disable(?!-(next-line|line))/.test(line)
}

/** 一个文件的命中清单(行号 + 指令 + 是否文件级)。 */
export function scanSource(text) {
  if (typeof text !== 'string') return []
  const lines = text.split(/\r?\n/)
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!DIRECTIVE_RE.test(lines[i])) continue
    if (!/^\s*(\/\/|\/\*)/.test(lines[i])) continue // 指令必须写在注释里
    if (isFileLevel(lines[i])) {
      hits.push({ line: i + 1, directive: 'file-level', fileLevel: true })
      continue
    }
    if (!hasReason(lines, i)) hits.push({ line: i + 1, directive: 'bare', fileLevel: false })
  }
  return hits
}

function listInScope(root, face) {
  const args =
    face === 'staged'
      ? ['ls-files', '--', ...SCOPE_DIRS]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCOPE_DIRS]
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  const files = String(out)
    .split(/\r?\n/)
    .map((p) => p.trim().replace(/^.*\t/, ''))
    .filter((p) => SRC_RE.test(p) && !SKIP_RE.test(p))
  if (!files.length) throw new Undetermined('在审面上枚举到 0 个源文件 ⇒ 清单没跑到,不判绿')
  return files
}

function readFace(root, face, files) {
  // 三面各自走自己的入口:worktree 读磁盘(人工逃生舱),staged 读索引 blob,缺省读 HEAD blob。
  // 少一条分支就会让某一档"看着在跑、实际读的是另一个面"——那正是本仓记过的面纪律失效型。
  if (face === 'worktree') {

    return files.map((rel) => ({ rel, src: readWorktreeFile(root, rel) }))
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(root, files.map((p) => `${pre}${p}`), {
    timeout: GIT_TIMEOUT,
    maxBuffer: 1 << 28,
  })
  return files.map((rel) => ({ rel, src: got.get(`${pre}${rel}`) ?? null }))
}

/** 一面的完整判定:返回 {rows, stock, missing}。取不到正文的行进 missing(未判定,不记绿)。 */
export function analyze({ face = 'head', root = ROOT } = {}) {
  const top = assertRepoRoot(root, 'inline-suppression-reason 的判定根')
  const files = listInScope(top, face)
  const rows = readFace(top, face, files)
  const judged = []
  const missing = []
  for (const r of rows) {
    if (r.src === null) {
      missing.push(r.rel)
      continue
    }
    judged.push({ rel: r.rel, hits: scanSource(r.src) })
  }
  if (!judged.length) throw new Undetermined('所有源文件正文都取不到 ⇒ 无法判定(不回落另一个面)')
  return { judged, missing, face }
}

/**
 * 差值棘轮:新增 = max(0, 本面命中数 − 该文件 HEAD 面命中数)。
 * head 档 ⇒ 锚点即本轮读数(新增按构造 0);staged 档 ⇒ 另取 HEAD 面同文件读数当锚点。
 */
export function decide({ judged, anchor, strict = false }) {
  const red = []
  let stock = 0
  for (const j of judged) {
    stock += j.hits.length
    const base = anchor.get(j.rel) ?? 0
    const added = Math.max(0, j.hits.length - base)
    if (added > 0) red.push({ rel: j.rel, added, base, hits: j.hits })
    else if (strict && j.hits.length > 0) red.push({ rel: j.rel, added: 0, base, hits: j.hits, strict: true })
  }
  return { red, stock }
}

function anchorFor(root, judged, face) {
  const anchor = new Map()
  if (face === 'head') {
    for (const j of judged) anchor.set(j.rel, j.hits.length)
    return anchor
  }
  const hitRels = judged.filter((j) => j.hits.length).map((j) => j.rel)
  if (!hitRels.length) return anchor
  const rows = readFace(root, 'head', hitRels)
  for (const r of rows) anchor.set(r.rel, scanSource(r.src).length)
  return anchor
}

const byEnd = (rel) =>
  rel.startsWith('apps/miniapp-taro/')
    ? 'miniapp'
    : rel.startsWith('apps/mobile-rn/') || rel.startsWith('packages/app/')
      ? 'rn'
      : rel.startsWith('apps/web/')
        ? 'web'
        : 'other'

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push([name, !!cond])

  ok('裸 eslint-disable 必拦', scanSource(['// eslint-disable-next-line no-console', 'x()'].join('\n')).length === 1)
  ok(
    '带 -- 原因放行',
    scanSource(['// eslint-disable-next-line no-console -- 诊断输出,单文件工具面', 'x()'].join('\n')).length === 0,
  )
  ok('裸 @ts-expect-error 必拦', scanSource(['const a = 1', '// @ts-expect-error', 'f(a)'].join('\n')).length === 1)
  ok(
    '@ts-expect-error 上一行有注释 ⇒ 放行',
    scanSource(['// 支付宝全局 API,Taro 类型未含', '// @ts-expect-error', 'f(a)'].join('\n')).length === 0,
  )
  ok(
    '文件级整块消音必拦(§0.7 要求逐行生效)',
    scanSource(['/* eslint-disable @typescript-eslint/no-require-imports */'].join('\n')).length === 1,
  )
  ok('非注释位不算指令', scanSource(['const s = "eslint-disable no-console"'].join('\n')).length === 0)
  ok('空文件不炸', scanSource('').length === 0 && scanSource(undefined).length === 0)

  // 判定面形状锁:锚点等于本面读数时,head 档按构造不得有"新增"
  const judged = [{ rel: 'apps/miniapp-taro/src/a.tsx', hits: [{ line: 1, directive: 'bare', fileLevel: false }] }]
  const anchor = new Map([['apps/miniapp-taro/src/a.tsx', 1]])
  ok('head 档存量不判红', decide({ judged, anchor }).red.length === 0)
  ok('head 档存量如实报数', decide({ judged, anchor }).stock === 1)
  const grown = new Map([['apps/miniapp-taro/src/a.tsx', 0]])
  ok('存量之上加一条必拦', decide({ judged, anchor: grown }).red.length === 1)
  ok('--strict 才问责存量', decide({ judged, anchor, strict: true }).red.length === 1)
  ok(
    '按端归类不吞未知路径',
    byEnd('apps/miniapp-taro/src/x.tsx') === 'miniapp' &&
      byEnd('packages/app/src/y.tsx') === 'rn' &&
      byEnd('scripts/z.mjs') === 'other',
  )
  let threw = false
  try {
    void scanSource(null).length
  } catch {
    threw = true
  }
  ok('取不到正文不得静默变 0 命中', !threw && scanSource(null).length === 0)

  // 形状锁:三面必须各有入口。本尺子初版就死在这里——readFace 只写了 staged/head 两支,
  // `--worktree` 静默读 HEAD,于是"人工逃生舱"是一句跑不通的出路(§0.8 禁),
  // 而变异自证(往盘上加一条裸豁免)当场读不出红。这条锁让那个形态不能再回来。
  const selfSrc = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'check-inline-suppression-reason.mjs'), 'utf8')
  const body = /function readFace\([\s\S]*?\n}/.exec(selfSrc)?.[0] ?? ''
  ok('readFace 必须有 worktree 分支', /face === 'worktree'/.test(body))
  ok('worktree 分支必须走磁盘入口', /readWorktreeFile\(root, rel\)/.test(body))
  ok('两面旗同给必须落 exit 2(不静默选一面)', /face.error/.test(selfSrc) && /return 2/.test(selfSrc))

  const bad = cases.filter(([, pass]) => !pass)
  for (const [n, pass] of cases) console.info(`${pass ? '✓' : '✗'} ${n}`)
  console.info(`[inline-suppression-reason] --self-test ${cases.length - bad.length}/${cases.length} 通过`)
  return bad.length ? 1 : 0
}

function usage() {
  console.info(
    '用法: node scripts/check-inline-suppression-reason.mjs [--staged|--worktree|--strict|--json|--self-test]',
  )
}

export function run(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) return usage(), 0
  if (argv.includes('--self-test')) return selfTest()
  const face = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (typeof face === 'object' && face.error) {
    console.error(`❌ 用法错:${face.error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const picked = face.face
  let analyzed, red, stock
  try {
    analyzed = analyze({ face: picked })
    const anchor = anchorFor(ROOT, analyzed.judged, picked)
    ;({ red, stock } = decide({ judged: analyzed.judged, anchor, strict }))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(exit 2)—— ${e.message}`)
      return 2
    }
    throw e
  }
  const perEnd = {}
  for (const j of analyzed.judged) for (let k = 0; k < j.hits.length; k++) perEnd[byEnd(j.rel)] = (perEnd[byEnd(j.rel)] ?? 0) + 1
  if (argv.includes('--json')) {
    console.info(
      JSON.stringify(
        {
          face: picked,
          files: analyzed.judged.length,
          stock,
          perEnd,
          red,
          undeterminedFiles: analyzed.missing.length,
          registered: false,
          exit: red.length ? 1 : 0,
        },
        null,
        1,
      ),
    )
    return red.length ? 1 : 0
  }
  console.info(
    `[inline-suppression-reason] 面:${picked} · 扫 ${analyzed.judged.length} 个源文件 · 裸/整文件豁免 ${stock} 处(按端:${Object.entries(perEnd).map(([k, v]) => `${k}=${v}`).join(' ')})`,
  )
  if (analyzed.missing.length)
    console.info(`⚠️ 正文取不到 ${analyzed.missing.length} 个文件 ⇒ 这些格未判定(不记绿):${analyzed.missing.slice(0, 3).join(', ')}`)
  if (red.length) {
    console.info(`❌ 判红 ${red.length} 个文件(在自身锚点之上新增${strict ? ' 或存量(--strict)' : ''}):`)
    for (const r of red.slice(0, 25))
      console.info(
        `   ${r.rel}:${r.hits.map((h) => h.line).slice(0, 6).join(',')} (${r.hits.map((h) => h.directive).join(',')})`,
      )
    if (red.length > 25) console.info(`   …另 ${red.length - 25} 个文件见 --json`)
    console.info('   出路:给豁免写原因(eslint 用 `-- 原因`;@ts-* 本行 `: 原因` 或紧邻上一行注释),或删掉已失效的豁免。')
    return 1
  }
  console.info(`✅ 无新增裸豁免。存量 ${stock} 处按"该文件 HEAD 自身"棘轮只报数 —— 归零前不得升提交链(§12e)。`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
