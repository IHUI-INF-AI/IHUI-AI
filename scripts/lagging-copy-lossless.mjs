#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lagging-copy-lossless.mjs — 滞后工作树副本"对齐会不会丢东西"的只读量算仪
 *
 * 它回答的是一句具体的话:「把工作树副本刷成 HEAD,有没有哪一行会消失?」
 * 判据是行多重集:若工作树的每一行(按重数)都能在 HEAD 里找到,那么这份副本**不含任何未入库
 * 内容**,对齐就是纯回退、可证零损失;反之只要有一行是副本独有的,那行就可能是别人正在写的现场,
 * 对齐等于删别人的工作(§12 越权)。
 *
 * 为什么单独成器,而不写进 `heal-worktree-tracked.mjs` 的 --align-drift:
 *  - 那一层的判据是「整块等于某祖先 / 逐块见于祖先且无纯删除块」,它**只认回潮**,于是高并发日
 *    祖先窗口用尽时整层失明(实测真仓一次全深度 `git log -- <热档>` >120s),账面写成"无需对齐"。
 *  - 本器问的是另一个问题(独有行有无),不需要祖先窗口,所以它能在窗口用尽的那天仍然给出结论。
 *  - 本器**只读**:它不 checkout、不写索引、不动工作树,处置动作留给持有者按输出裁。
 *
 * 用法:
 *   node scripts/lagging-copy-lossless.mjs                      # 缺省:审 git status 里全部 " M" 已跟踪改动
 *   node scripts/lagging-copy-lossless.mjs <path> [<path> …]    # 只审点名路径
 *   node scripts/lagging-copy-lossless.mjs --json               # 机器可读面(末行单条 JSON)
 *   node scripts/lagging-copy-lossless.mjs --self-test          # 零副作用:临时仓里造三种站点各验一次
 *
 * 三态绝不并桶:alignable(独有行 0,可证无损) / held(有独有行,不得对齐) / undetermined(取不到任一侧)。
 * "取不到"永远不算通过 —— 把没判写成判过了是本仓最高频失效型(AGENTS §12e/守门 94/103/118 同条禁令)。
 *
 * 定级:手动/只读档,**尚未接进提交链**(它判的是本机工作树形态,提交者结构上满足不了 ⇒ 挂 blocking
 * 就是每台每次被逼 --no-verify、连带链上全部守门作废,§12e 同型)。不变量由
 * `node --test scripts/tests/lagging-copy-lossless.test.mjs` 钉。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitBinary } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function gitAt(root, args, opts = {}) {
  return execFileSync(gitBinary(), ['-c', 'safe.directory=*', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 512 * 1024 * 1024,
    timeout: 180000,
    ...opts,
  })
}

/** 行多重集(丢弃空行:两次 split 同形,尾空行差异不构成信息)。 */
function multiset(text) {
  const m = new Map()
  for (const l of text.split(/\r?\n/)) if (l.trim() !== '') m.set(l, (m.get(l) || 0) + 1)
  return m
}

/**
 * 核心判据:worktreeText 的每一行重数 ≤ headText ⇒ alignable。
 * 纯函数,便于用构造面证明(不得靠仓库瞬时状态证明判定行为)。
 * 返回 { verdict, ownCount, missingCount, ownSamples, missingSamples }
 */
export function judgeLossless(worktreeText, headText) {
  const wt = multiset(worktreeText)
  const head = multiset(headText)
  const ownSamples = []
  const missingSamples = []
  for (const [line, n] of wt) {
    const have = head.get(line) || 0
    if (have < n) {
      ownSamples.push({ line: line.slice(0, 160), need: n, have })
      if (ownSamples.length >= 12) break
    }
  }
  for (const [line, n] of head) {
    const have = wt.get(line) || 0
    if (have < n && missingSamples.length < 12)
      missingSamples.push({ line: line.slice(0, 160), need: n, have })
  }
  let ownCount = 0
  for (const [line, n] of wt) ownCount += Math.max(0, n - (head.get(line) || 0))
  let missingCount = 0
  for (const [line, n] of head) missingCount += Math.max(0, n - (wt.get(line) || 0))
  return {
    verdict: ownCount === 0 ? 'alignable' : 'held',
    ownCount,
    missingCount,
    ownSamples,
    missingSamples,
  }
}

/** 待审清单:点名优先,否则取 `git status --porcelain` 里工作树已改的跟踪文件(排除暂存删除)。 */
export function collectTargets(argv, root = ROOT) {
  if (argv.length) return argv
  const out = []
  for (const l of gitAt(root, ['-c', 'core.quotePath=false', 'status', '--porcelain']).split(
    /\r?\n/,
  )) {
    if (!l) continue
    const xy = l.slice(0, 2)
    const p = l.slice(3)
    // 只审"工作树相对索引/HEAD 有差异"且两侧都在仓内的形态:`D ` 的盘上没有文件,判不了
    if (xy.includes('D') || xy === '??') continue
    out.push(p)
  }
  return out
}

export function run(paths, root = ROOT) {
  const rows = []
  let headTexts
  try {
    headTexts = catBatch(
      root,
      paths.map((p) => `HEAD:${p}`),
    )
  } catch (e) {
    for (const p of paths)
      rows.push({
        path: p,
        verdict: 'undetermined',
        reason: `HEAD 面整批取不到:${String(e?.message ?? e).slice(0, 120)}`,
      })
    return rows
  }
  for (const p of paths) {
    const head = headTexts.get(`HEAD:${p}`)
    if (typeof head !== 'string') {
      rows.push({
        path: p,
        verdict: 'undetermined',
        reason: 'HEAD 取不到该路径(新增未入库 / 非 blob ⇒ 不猜)',
      })
      continue
    }
    let wt
    try {
      wt = readFileSync(join(root, p), 'utf8')
    } catch (e) {
      rows.push({
        path: p,
        verdict: 'undetermined',
        reason: `工作树取不到:${String(e?.code ?? e).slice(0, 60)}`,
      })
      continue
    }
    rows.push({ path: p, ...judgeLossless(wt, head) })
  }
  return rows
}

/** 汇总:三态计数 + 每一态的路径清单(报名不止报数 —— 只给计数,读的人无法判断哪一格被清偿了)。 */
export function summarize(rows) {
  const g = { alignable: [], held: [], undetermined: [] }
  for (const r of rows)
    g[
      r.verdict === 'alignable' ? 'alignable' : r.verdict === 'held' ? 'held' : 'undetermined'
    ].push(r)
  return g
}

/**
 * 空枚举判死(抽成纯函数,由镜像测试端到端证明"清单为空 ⇒ 未判定",不得让这条只在 CLI 里、
 * 靠真仓瞬时状态验证 —— 守门 103 T12 那一课:证明行为只能用构造面)。
 */
export function emptyEnumerationVerdict(targets) {
  if (targets.length) return null
  return {
    exit: 2,
    reason: '枚举到 0 个待审路径 ⇒ 未判定(工作树确实干净?还是 git status 问不到?)',
  }
}

function selfTest() {
  const t = []
  const pass = (n, ok, why) => t.push({ n, ok: !!ok, why })
  // A1 独有行 0(纯滞后:HEAD 有而盘上没有)⇒ alignable
  pass('A1 纯回退形态判 alignable', judgeLossless('a\nb\n', 'a\nb\nc\n').verdict === 'alignable')
  // A2 有一行 HEAD 从未有过 ⇒ held(别人正在写)
  const a2 = judgeLossless('a\nzzz\n', 'a\nb\n')
  pass(
    'A2 独有行判 held 并点名',
    a2.verdict === 'held' && a2.ownCount === 1 && a2.ownSamples[0].line === 'zzz',
  )
  // A3 重数不等:同一行多写一份也算独有(不得按集合判,否则"重复登记"被洗成无损)
  pass('A3 重数超出判 held', judgeLossless('a\na\n', 'a\n').verdict === 'held')
  // A4 集合等而重数不足(副本少一份)⇒ 仍 alignable:对齐只会补回,不会带走
  pass('A4 副本少重数不判 held', judgeLossless('a\n', 'a\na\n').verdict === 'alignable')
  // A5 空行不参与判定(两侧同形 split,尾空行不是内容)
  pass('A5 空行不构成独有', judgeLossless('a\n\n\n', 'a\n').verdict === 'alignable')
  // A6 完全同形 ⇒ alignable 且两计数为 0
  const a6 = judgeLossless('a\nb\n', 'a\nb\n')
  pass('A6 同形零差异', a6.verdict === 'alignable' && a6.ownCount === 0 && a6.missingCount === 0)
  // A7 missingCount 与 ownCount 不得互相顶账(同一段文字里既有缺行也有独有行时两个都要 >0)
  const a7 = judgeLossless('x\n', 'y\n')
  pass('A7 两计数独立', a7.ownCount === 1 && a7.missingCount === 1)
  // A8 汇总三态分桶不串
  const s = summarize([
    { path: 'p1', verdict: 'alignable' },
    { path: 'p2', verdict: 'held' },
    { path: 'p3', verdict: 'undetermined' },
  ])
  pass(
    'A8 三态分桶',
    s.alignable.length === 1 && s.held.length === 1 && s.undetermined.length === 1,
  )
  // A9 collectTargets 的空清单是"真没事"还是"没审":由调用方判,本器只保证不抛
  pass('A9 collectTargets 可返回数组', Array.isArray(collectTargets(['a.txt'])))
  // A10/A11 空枚举必须判死,而非记绿(把"没审"写成"审过且干净"是本仓最高频失效型)
  pass('A10 空枚举判死给 exit 2', emptyEnumerationVerdict([])?.exit === 2)
  pass('A11 非空枚举不得判死', emptyEnumerationVerdict(['a']) === null)
  for (const r of t) console.log(`${r.ok ? '✅' : '❌'} ${r.n}${r.ok ? '' : ' :: ' + r.why}`)
  const failed = t.filter((r) => !r.ok).length
  console.log(`SELF-TEST pass ${t.length - failed} / fail ${failed}`)
  process.exit(failed ? 1 : 0)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const json = argv.includes('--json')
  const paths = argv.filter((a) => !a.startsWith('--'))
  const targets = collectTargets(paths)
  const empty = emptyEnumerationVerdict(targets)
  if (empty) {
    console.error(empty.reason)
    process.exit(empty.exit)
  }
  const rows = run(targets)
  const g = summarize(rows)
  if (json) {
    console.log(
      JSON.stringify({
        counts: {
          alignable: g.alignable.length,
          held: g.held.length,
          undetermined: g.undetermined.length,
        },
        rows,
      }),
    )
    process.exit(g.alignable.length ? 1 : 0)
  }
  console.log(`滞后副本无损性量算 · 待审 ${targets.length} 个路径`)
  for (const r of g.alignable)
    console.log(`  ✅ 可证无损(独有行 0,缺 HEAD 行 ${r.missingCount}):${r.path}`)
  for (const r of g.held)
    console.log(
      `  🚫 不得对齐(独有行 ${r.ownCount},缺 HEAD 行 ${r.missingCount}):${r.path}\n       独有行样例:${r.ownSamples
        .slice(0, 2)
        .map((x) => JSON.stringify(x.line))
        .join(' / ')}`,
    )
  for (const r of g.undetermined) console.log(`  ⚠️ 未判定:${r.path} :: ${r.reason}`)
  console.log(
    `结论:可证无损 ${g.alignable.length} · 不得对齐 ${g.held.length} · 未判定 ${g.undetermined.length}` +
      (g.alignable.length
        ? ' ⇒ 那些条对齐前请先快照(出口见 scripts/heal-worktree-tracked.mjs 的 snapshotWorktreeBytes)'
        : ''),
  )
  // 只读工具不改仓库状态:退出码 1 = 存在"可证无损"的条目(那是待处置信号),异常才用 2
  process.exit(g.alignable.length ? 1 : 0)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
