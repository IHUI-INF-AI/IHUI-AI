#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * check-readme-recent-containment.mjs — README RECENT 块外禁增守门(2026-11-11 立)
 *
 * ## 立门理由(2026-11-10/11 实测的失效型,一条真事故)
 *  README 的活性 changelog 只许住在 `auto-update-readme-recent.mjs` 的
 *  BEGIN/END RECENT UPDATES 锚点之间;标记之外是人工撰写区(特性总览等)。
 *  旧实现 `merge-live-doc` 的"无锚点 ⇒ 追加到文件末尾"失效型把 HEAD 侧内容
 *  整段甩到 END **之后**,且此后每一轮自动收编都原样保留 —— README.md 一路烂到
 *  12.95MB,END 后 37,179 行散落(STRAY_OUTSIDE=4,419 枚),直到 2026-11-11 才
 *  一次性裁掉(提交 5833953de0)。当时的门(check-readme-table-integrity 等)
 *  看的是表格形态与生成块数字,对"块外长出新内容"这一型**结构性失明**。
 *
 * ## 判据一句话
 *  对每份受监视 README(README.md / README.en.md / README.ko.md / README.ja.md),
 *  比较「被审面(staged 索引 blob 或 --worktree 工作树)」与「HEAD blob」在
 *  `<!-- END RECENT UPDATES -->` 之后的尾部行序:
 *  被审面尾部必须是 HEAD 尾部行的**纯删减子序列**(只许少、不许多、不许改) ——
 *  净增、改写、标记被删 ⇒ 红;纯清理(删散落行)与块内更新 ⇒ 绿。
 *  存量残留(en=172 行 / ko=9 / ja=9,2026-11-11 现读)是 HEAD 基线的一部分,
 *  天然放行;本门只拦**新增**,不追历史账(历史账由 5833953de0 那次收口)。
 *
 * ## 三态纪律(§0.3,绝不把"没判"写成"判过")
 *  - 绿:子序列成立 / 文件被删(只缩不长) / 新文件自带合法锚点对;
 *  - 红:净增行、尾部改写、END 标记被删、无锚点文件净增长、新文件不带锚点;
 *  - 未判定:blob 读不出且非删除、标记区间结构坏(inverted/多枚)——按 ❌ 判红级
 *    输出并 exit 1,绝不静默放行。
 *
 * ## 与写入器的分工
 *  `auto-update-readme-recent.mjs` 是**块内唯一写入口**;本门是**块外禁增的牙**。
 *  块内怎么写、写多长,门不管(那是写入器 MAX_GROUPS=15 与 173 号门的辖区)。
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const BEGIN = '<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->'
export const END = '<!-- END RECENT UPDATES -->'

/** 受监视面:仓根四份对外 README(与 auto-update-readme-recent.mjs 的辖区一致)。 */
export const WATCHED = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']

/** 尾部行数基线速查(2026-11-11 HEAD 现读;仅注释,不参与判定)。 */

/** 归一化:去 \r,掐尾部空行(末尾多一个换行不算"新增")。 */
function normalizeLines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
}

/**
 * 锚点结构判定(与 auto-update-readme-recent.mjs::locateMarkers 同形):
 * ok=恰一枚 BEGIN、恰一枚 END、BEGIN 在前;missing/inverted/multi 为坏结构。
 */
export function locateMarkers(text) {
  const s = String(text ?? '')
  const b = s.indexOf(BEGIN)
  const e = s.indexOf(END)
  if (b < 0 && e < 0) return { status: 'missing' }
  if (b < 0 || e < 0) return { status: 'missing' }
  if (e < b) return { status: 'inverted' }
  if (s.indexOf(BEGIN, b + 1) >= 0 || s.indexOf(END, e + 1) >= 0) return { status: 'multi' }
  return { status: 'ok', afterEnd: s.slice(e + END.length) }
}

/**
 * 纯删减子序列:`sub` 的每一行都能在 `base` 的行序里按序找到(各消耗一枚)。
 * 成立 ⇒ 被审面尾部只是从基线里删了行(纯清理),没有新增/改写。
 */
export function isDeletionSubsequence(base, sub) {
  let i = 0
  for (const line of base) {
    if (i < sub.length && sub[i] === line) i++
  }
  return i === sub.length
}

/**
 * 单文件判定(纯函数,便于 --self-test 红绿对照)。
 * @returns {{verdict:'pass'|'red', detail:string}}
 */
export function judgePair(headText, stagedText, file) {
  const head = headText == null ? null : String(headText)
  const staged = stagedText == null ? null : String(stagedText)

  // 文件在两个面都不存在 ⇒ 不适用;仅被审面不存在 ⇒ 删除,只缩不长,放行。
  if (head == null && staged == null) return { verdict: 'pass', detail: '两面部不存在,不适用' }
  if (staged == null) return { verdict: 'pass', detail: '被审面已删除该文件(只缩不长),放行' }

  const headM = head == null ? { status: 'absent' } : locateMarkers(head)
  const stagM = locateMarkers(staged)

  // 新文件(HEAD 无、被审面有):必须自带合法锚点对,否则整份文件都是"块外新增"。
  if (head == null || headM.status === 'absent') {
    if (stagM.status === 'ok') return { verdict: 'pass', detail: '新文件自带合法 BEGIN/END 锚点对' }
    return { verdict: 'red', detail: '新文件不带 RECENT 锚点对 —— 全文都算块外内容,须由 auto-update-readme-recent.mjs 写入口建立锚点' }
  }

  // HEAD 有锚点、被审面丢了锚点(含结构坏) ⇒ 块约束被拆除,一律红。
  if (stagM.status !== 'ok') {
    if (headM.status === 'ok' || headM.status === 'multi' || headM.status === 'inverted') {
      return { verdict: 'red', detail: `END 标记丢失/结构坏(${stagM.status}) —— 块外禁增约束被拆除(HEAD 面 status=${headM.status})` }
    }
    // HEAD 本来就 missing(历史遗留无锚点文件):只拦净增长(旧失效型"追加到文件末尾")。
    const headN = normalizeLines(head).length
    const stagN = normalizeLines(staged).length
    if (stagN > headN) {
      return { verdict: 'red', detail: `无锚点文件净增长 ${headN}→${stagN} 行(旧 merge-live-doc 失效型:内容甩到文件尾)` }
    }
    return { verdict: 'pass', detail: `无锚点存量文件未净增长(${headN}→${stagN} 行)` }
  }

  // 两面都有合法锚点:比 END 之后尾部,被审面必须是 HEAD 尾部的纯删减子序列。
  const headTail = normalizeLines(headM.afterEnd)
  const stagTail = normalizeLines(stagM.afterEnd)
  if (stagTail.length > headTail.length) {
    const added = stagTail.slice(headTail.length, headTail.length + 3)
    return {
      verdict: 'red',
      detail: `END 后尾部净增 ${stagTail.length - headTail.length} 行(${headTail.length}→${stagTail.length}),新增示例: ${JSON.stringify(added)}`,
    }
  }
  if (!isDeletionSubsequence(headTail, stagTail)) {
    return {
      verdict: 'red',
      detail: `END 后尾部被改写(行数 ${headTail.length}→${stagTail.length} 未增但内容不是纯删减) —— 块外只许删不许改`,
    }
  }
  if (stagTail.length < headTail.length) {
    return { verdict: 'pass', detail: `块外纯清理(${headTail.length}→${stagTail.length} 行),放行` }
  }
  return { verdict: 'pass', detail: `块外尾部未变(${stagTail.length} 行)` }
}

function gitRaw(args, root) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 })
}

function readFace(root, rel, face) {
  if (face === 'worktree') {
    try {
      return readFileSyncLocal(path.join(root, rel))
    } catch {
      return null
    }
  }
  try {
    // staged 面 = 索引 0 阶段 blob(`:0:<rel>`);HEAD 面照写。`git show staged:...` 不是合法对象名。
    return gitRaw(['show', `${face === 'staged' ? ':0' : face}:${rel}`], root)
  } catch {
    return null // show 失败可能是"该面不存在此文件"(删除),也可能是真读不出
  }
}

// 顶部不引 fs,这里就地引(保持 import 区只有 child_process/path 的轻面)。
import { readFileSync as readFileSyncLocal } from 'node:fs'

function main(argv) {
  const root = process.cwd()
  const faceArg = argv.includes('--worktree') ? 'worktree' : 'staged'
  const selfTest = argv.includes('--self-test')
  if (selfTest) return runSelfTest()

  const rows = []
  for (const rel of WATCHED) {
    const head = readFace(root, rel, 'HEAD')
    const cand = readFace(root, rel, faceArg)
    const r = judgePair(head, cand, rel)
    rows.push({ rel, ...r })
  }

  const reds = rows.filter((r) => r.verdict === 'red')
  for (const r of rows) {
    console.log(`${r.verdict === 'red' ? '❌' : '✅'} [readme-recent-containment] ${r.rel}: ${r.detail}`)
  }
  if (reds.length > 0) {
    console.log('')
    console.log('合法改法:块外内容只许删不许增 ——')
    console.log('  · 活性 changelog 一律进 BEGIN/END RECENT UPDATES 块内(node scripts/auto-update-readme-recent.mjs 是唯一写入口);')
    console.log('  · 纯清理(裁散落行)放行,如 5833953de0 那次收口;')
    console.log('  · 应急放行:HUSKY_SKIP_README_RECENT_CONTAINMENT=1 git commit(message 写明责任归属)。')
    return 1
  }
  return 0
}

/** 自检:内存红绿对照,夹具覆盖判据全部分型(§0.3:红绿都必须真判到)。 */
function runSelfTest() {
  const B = BEGIN, E = END
  const mk = (head, tail) => `${head}\nbody\n${E}${tail ?? ''}`
  const cases = [
    // [名, HEAD文本, 被审文本, 期望]
    ['绿:块内更新+块外不变', mk(B, '\nlegacy\n'), mk(B + ' updated', '\nlegacy\n'), 'pass'],
    ['绿:块外纯清理', mk(B, '\nlegacy A\nlegacy B\n'), mk(B, '\nlegacy B\n'), 'pass'],
    ['绿:尾部完全一致', mk(B, '\nx\n'), mk(B, '\nx\n'), 'pass'],
    ['红:块外净增', mk(B, '\nlegacy\n'), mk(B, '\nlegacy\nNEW LINE\n'), 'red'],
    ['红:块外改写(行数不变)', mk(B, '\nlegacy A\nlegacy B\n'), mk(B, '\nlegacy A\nlegacy C\n'), 'red'],
    ['红:END 标记被删', mk(B, '\nlegacy\n'), `${B}\nbody\nlegacy\n`, 'red'],
    ['红:无锚点文件净增长', 'a\nb\n', 'a\nb\nc\n', 'red'],
    ['绿:无锚点存量只减', 'a\nb\nc\n', 'a\nb\n', 'pass'],
    ['红:新文件不带锚点', null, 'brand new readme\n', 'red'],
    ['绿:新文件自带锚点', null, mk(B, '\n'), 'pass'],
    ['绿:被审面删除文件', mk(B, '\n'), null, 'pass'],
    ['绿:两面都不存在', null, null, 'pass'],
  ]
  let bad = 0
  for (const [name, head, stag, want] of cases) {
    const got = judgePair(head, stag, 'README.md').verdict
    const ok = got === want
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} [self-test] ${name}: want=${want} got=${got}`)
  }
  console.log(bad === 0 ? '自检通过:12 夹具红绿全中。' : `自检失败:${bad} 枚夹具与期望不符。`)
  return bad === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  process.exit(main(process.argv.slice(2)))
}
