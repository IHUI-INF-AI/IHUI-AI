// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 活文档登记行对账尺(只读):近 N 枚提交往某文档加过的行,现在还在被审面上吗?
//
// 立因(2026-09-26):并发 union 合并会把别人的登记行吞掉,而 `git status`、门 71(防丢编号)、
// 门 84(防回退)都不报"这一行加了又不见了"。`merge-live-doc` 判的是"工作树 ⊇ HEAD",
// 而这里要问的是另一个方向:"历史上加进去的行,HEAD 里还在不在"。
//
// 读数怎么解释(重要,别拿它当结论):
//   · 一条新增行不在 HEAD 面上,有两种相反成因 —— ① 真被吞,② 被**就地改写**(典型是
//     `[ ]` 翻成 `[x] ✅ **[归并]**`,或 `- [ ]` 前置被插了认领租约)。②不是丢行。
//   · 所以对每个候选要**按短语逐个**回问 HEAD,确认它的当前形态,再决定回补还是不动。
//     直接跑 `merge-live-doc --apply` 会把旧形态插回,于是同一件事新旧两行并存。
//
// 只扫非合并提交:合并提交的 combined diff 用**两列**前缀(`++text`),按单列剥会留下一个 `+`,
// 于是"内容"根本不是文件里那一行 —— 第一版就栽在这里(报告里成片 `+- ` 前缀,读数看着像"丢了 56 行")。
//
// 取材一律走 `gitRaw`(HEAD 面 = 被审提交树,不读滞后的共享工作树)。
// 用法:node scripts/plan-line-audit.mjs [--n 60] [--file PROJECT_PLAN.md] [--self-test]

import { execFileSync } from 'node:child_process'
import { gitBinary, gitRaw } from './lib/face-reader.mjs'

const GIT = gitBinary()

function arg(flag, def) {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : def
}

/**
 * 核心判据:给定"某枚提交新增过的 diff 行"与"当前面的正文",报逐字不在面上的那些。
 * @param {string[]} addedLines 单列前缀的 diff 行(形如 `+xxx`)
 * @param {string} faceText 被审面上的文档正文
 * @returns {string[]} 候选缺失行(未定性,见头注)
 */
export function collectMissing(addedLines, faceText) {
  const face = new Set(
    faceText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )
  const out = []
  const seen = new Set()
  for (const raw of addedLines) {
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue
    const text = raw.slice(1).trim()
    if (text.length < 20 || face.has(text) || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

function repoRoot() {
  return execFileSync(GIT, ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  }).trim()
}

function run() {
  const FILE = arg('--file', 'PROJECT_PLAN.md')
  const N = Number(arg('--n', '60'))
  const ROOT = repoRoot()

  let head
  try {
    head = gitRaw(['show', `HEAD:${FILE}`], ROOT)
  } catch (e) {
    console.log(`未判定:HEAD 取不到 ${FILE} —— ${e.message}`)
    return 2
  }

  let shas
  try {
    shas = gitRaw(['log', '--no-merges', `-n${N}`, '--format=%H'], ROOT)
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (e) {
    console.log(`未判定:提交清单取不到 —— ${e.message}`)
    return 2
  }

  const added = []
  let skipped = 0
  for (const sha of shas) {
    try {
      const diff = gitRaw(['show', '--format=', '--unified=0', sha, '--', FILE], ROOT, {
        maxBuffer: 128 * 1024 * 1024,
      })
      for (const line of diff.split(/\r?\n/)) if (line.startsWith('+')) added.push(line)
    } catch {
      skipped += 1 // 取不到某枚提交的 diff ≠ 它没加过行:如实计数,不静默当成"没丢"
    }
  }

  const missing = collectMissing(added, head)
  console.log(
    `面:HEAD:${FILE} · 扫描 ${shas.length} 枚非合并提交(取不到 diff ${skipped} 枚)· 逐字不在面上的新增行 ${missing.length}`,
  )
  console.log('提示:这里面既有真被吞的,也有"被就地改写"的 —— 逐个按短语回问 HEAD 再定性(见头注)。')
  for (const m of missing) console.log(`  ${m.slice(0, 110)}`)
  return 0
}

// 自检:真造一个临时仓 —— 加两行,再把其中一行改成别的形态,判据必须点名被改的那条、不点名仍活着的那条。
// 没有这一条,本尺"报 0"与"根本没判"在账面上长得一样。
async function selfTest() {
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const { writeFileSync, appendFileSync } = await import('node:fs')
  const s = mkScratch('plan-line-audit')
  const g = (a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: s,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
    })
  let n = 0
  const t = (name, ok) => {
    n += 1
    console.log(`${ok ? '✅' : '❌'} ${n} ${name}`)
    if (!ok) process.exitCode = 1
  }

  g(['init', '-q', '.'])
  g(['config', 'user.email', 't@t'])
  g(['config', 'user.name', 't'])
  writeFileSync(`${s}/DOC.md`, 'keep me here forever\n')
  g(['add', 'DOC.md'])
  g(['commit', '-qm', 'base'])
  appendFileSync(`${s}/DOC.md`, 'line that will be rewritten later\nline that stays untouched\n')
  g(['add', 'DOC.md'])
  g(['commit', '-qm', 'add-two'])
  const cur = g(['show', 'HEAD:DOC.md'])
  writeFileSync(`${s}/DOC.md`, cur.replace('line that will be rewritten later', 'rewritten in place'))
  g(['add', 'DOC.md'])
  g(['commit', '-qm', 'rewrite'])

  // 加行的那枚是 HEAD~1(HEAD=改写、HEAD~2=基线)。第一版写成 HEAD~2,取的是基线提交的 diff,
  // 于是断言②④双双红 —— 自检抓到的是尺子自己的错,不是世界的错。
  const added = g(['show', '--format=', '--unified=0', 'HEAD~1', '--', 'DOC.md'])
    .split(/\r?\n/)
    .filter((l) => l.startsWith('+'))
  const face = g(['show', 'HEAD:DOC.md'])
  const missing = collectMissing(added, face)
  t('仍活着的行不点名', !missing.includes('line that stays untouched'))
  t('被就地改写的行点名(逐字比对的本性 ⇒ 定性交人按短语复核)', missing.includes('line that will be rewritten later'))
  t('不会把 diff 表头当成内容', !missing.some((m) => m.startsWith('+')))
  // 反向对照:面换成空文本 ⇒ 两条都得报,证明前两条不是恒真
  t('面为空时两条都报(尺子有牙)', collectMissing(added, '').length === 2)

  rmScratch(s)
  console.log(`self-test ${process.exitCode ? 'FAILED' : 'OK'} — ${n} 条`)
  return process.exitCode || 0
}

// §22d:本文件同时是 CLI 与可 import 的判据载体,入口必须按"是否被直接 node 执行"判定,
// 否则镜像测试一句 import 就会在它的测试环境里跑一遍真仓扫描(副作用与噪音)。
import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (process.argv.includes('--self-test')) {
    selfTest().then((rc) => process.exit(rc))
  } else {
    process.exit(run())
  }
}

export const __test__ = { collectMissing }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
