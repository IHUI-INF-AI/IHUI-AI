#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(本文件自述):活文档不得把**已归档正文**同时留在自己体内 —— §1 两步归档的第②步(原位置只留指针)的机器锁。
//
// 立因(2026-10-16 实测):AGENTS.md 在 `443adacdff` 是 67,394 B(压缩版:规则条款全留,历史叙述/取证叙述/
// 重复登记副本整区逐字移入 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md` 等)。随后两枚 Merge
// 的行级 union 把归档正文按"整行字符串比份数"顶回活文档 ⇒ HEAD 变 1,325,510 B,守门 207(体积预算 96,000)
// 全量档恒红,且 `stagedTriggers=['AGENTS.md']` 意味着谁动 AGENTS.md 谁被挡。
// 体积门(207)只量"多大",看不见"为什么大"—— 本门量的是那 2,526 行的**身份**:它们逐行都还在归档件里。
// 本仓对同一族已记过 350 → 1699 的回潮:手工剥一次会被下一次合并再灌回,所以缺的是一把每枚提交都问的尺子。
//
// 判据(只判"灌入",不判"写得多"):
//   R1 连续块:活文档里**连续 ≥ MIN_RUN 行**(空行不断块)每一行都逐字命中归档面行集 ⇒ 判为归档正文回灌。
//      取 MIN_RUN=3:1-2 行的正当引用(法条摘录、指针注记)不会被误伤,而整区回灌必然是长块。
//   R2 逐条点名:报块起止行 + 首行 60 字 + 块内行数,并给出唯一出路 = 按 §1 两步归档剥掉(正文已在归档件里,
//      剥离零丢失;复原脚本必须先证明"每一条被剥的行都 ∈ 归档面"再落)。
//   禁止的出路:调低 207 预算、把归档件从审面里摘掉(那等于销毁证据)、或给活文档加"跳过体积"的豁免。
//   取不到被审面 / 归档面枚举到 0 个文件 ⇒ exit 2「未判定」,不记绿也不冒红(§0.3)。
//
// 取材面纪律(§0.4 / 守门 118):全量档判 HEAD blob,`--staged` 判索引 blob(两面同给 ⇒ exit 2),
//   `--worktree` 仅人工逃生舱;清单与内容同面同轮。
//
// 用法:
//   node scripts/check-live-doc-archive-reinflation.mjs            # 判 HEAD 面
//   node scripts/check-live-doc-archive-reinflation.mjs --staged   # 判索引面
//   node scripts/check-live-doc-archive-reinflation.mjs --self-test
//
// 定级与触发:以 `scripts/guardian-runner.mjs` 注册条目现值为准(落地当刻 HEAD 面违规块数 = 0 才升 blocking,§12e)。

import { existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIVE_DOCS = ['AGENTS.md', 'README.md']
const ARCHIVE_PREFIX = '.ihui-agent/archive/'
const ARCHIVE_NAME_RE = /(^|\/)AGENTS[^/]*\.md$/
/**
 * 门槛取 12,依据是本轮实测两侧数字,不是拍的整数:
 *   · 真回灌(两枚 Merge 灌回):块尺寸 3 / 4 / 13 / **2155** 行 ⇒ 抓得到的是"整区",12 行门槛照样拦下 13 与 2155;
 *   · 合法重合(压缩版保留的条款本身也在归档件里逐字出现过):最大 4 行 ⇒ 12 行不误伤。
 *   取 3 行时本仓当天就有 2 块假阳性(7 行),而假阳性红门的代价与恒红门同型(§12e)—— 所以宁可判"整区"。
 */
const MIN_RUN = 12

/** 归档面行集(逐份归档件的全部行;短行/空行也收,但判定时要求整块命中) */
export function buildArchiveFace(archiveTexts) {
  const set = new Set()
  for (const t of Object.values(archiveTexts)) {
    for (const line of String(t).split(/\r?\n/)) set.add(line)
  }
  return set
}

/**
 * 样板行判定:只有"有信息量的行"才计入回灌块。
 * 立因(本轮实测):每份归档件都带同一条溯源横幅与同一对 HTML 注释围栏 ⇒ 按朴素行集合命中会把
 * `L1-8 首行: <!--`、`L24-26 首行: 空行` 这类**跨文件逐字相同**的样板报成回灌(假阳性),
 * 而假阳性红门的代价与恒红门同型(§12e)—— 判据要在"抓得住 2,661 行真回灌"与"不误伤横幅"之间取准。
 */
const BOILERPLATE_RE = /^(\s*)(<!--|-->|\/\*|\*\/|\/\/\s*©|#\s*©|©|\[IHUI-AI-PROVENANCE\]|Provenance-watermarked|未授权商用可被溯源追责|\*|>\s*[-*]?\s*$|`{3,}|-{3,})/
export function isInformative(line) {
  const t = String(line).trim()
  // 按**字节**量:本仓正文以中文为主,按字符数取阈值会把正常的中文规则行误判成"无信息量"
  if (Buffer.byteLength(t, 'utf8') < 40) return false
  if (BOILERPLATE_RE.test(line)) return false
  return true
}

/** R1:返回回灌块数组 {start,end,len,sample}(len = 块内有信息量的命中行数) */
export function findReinflatedBlocks(lines, archiveSet) {
  const blocks = []
  let start = -1
  let hits = 0
  const flush = (endIdx) => {
    if (hits >= MIN_RUN) blocks.push({ start: start + 1, end: endIdx, len: hits, sample: (lines[start] || '').slice(0, 60) })
    start = -1
    hits = 0
  }
  for (let i = 0; i < lines.length; i++) {
    // 断块条件只看"这一行是否在归档面里":夹在归档正文里的空行/样板行不切断块(它们本来就在归档件里),
    // 而任何一条本地新行(未命中归档)都切断 ⇒ 计数只数有信息量的命中行,横幅因此不会被误报。
    if (!archiveSet.has(lines[i])) {
      flush(i)
      continue
    }
    if (start === -1) start = i
    if (isInformative(lines[i])) hits++
  }
  flush(lines.length + 1)
  return blocks
}

function listArchiveFiles(root, mode) {
  if (mode === 'worktree') {
    const dir = resolve(root, ARCHIVE_PREFIX)
    if (!existsSync(dir)) return []
    return readdirSync(dir).filter((f) => ARCHIVE_NAME_RE.test(f)).map((f) => `${ARCHIVE_PREFIX}${f}`)
  }
  const out =
    mode === 'staged'
      ? gitRaw(['ls-files', '--cached', `${ARCHIVE_PREFIX}`], root)
      : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ARCHIVE_PREFIX], root)
  return out.split('\n').filter((l) => ARCHIVE_NAME_RE.test(l))
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.log('❌ 未判定:--staged 与 --worktree 不得同用(两个判定面互斥)')
    return 2
  }
  if (argv.includes('--self-test')) return selfTest()
  const mode = argv.includes('--worktree') ? 'worktree' : argv.includes('--staged') ? 'staged' : 'head'
  const readOne = (rel) => {
    try {
      if (mode === 'worktree') return readWorktreeFile(ROOT, rel)
      return gitRaw(['show', `${mode === 'staged' ? ':' : 'HEAD:'}${rel}`], ROOT)
    } catch {
      return null
    }
  }

  let archFiles
  try {
    archFiles = listArchiveFiles(ROOT, mode)
  } catch (e) {
    console.log(`❌ 未判定:归档面枚举失败 —— ${e?.message ?? e}`)
    return 2
  }
  if (archFiles.length === 0) {
    console.log(`❌ 未判定:${ARCHIVE_PREFIX} 在 ${mode} 面枚举到 0 份 AGENTS* 归档件(判不出"没有回灌",只判"没量到")`)
    return 2
  }
  const archiveTexts = {}
  for (const f of archFiles) {
    const t = readOne(f)
    if (t === null) {
      console.log(`❌ 未判定:归档件取不到 ${f}(${mode} 面)`)
      return 2
    }
    archiveTexts[f] = t
  }
  const archiveSet = buildArchiveFace(archiveTexts)

  const findings = []
  for (const doc of LIVE_DOCS) {
    const t = readOne(doc)
    if (t === null) {
      findings.push({ doc, error: `${doc} 在 ${mode} 面取不到 ⇒ 未判定(不记绿)` })
      continue
    }
    const blocks = findReinflatedBlocks(t.split(/\r?\n/), archiveSet)
    if (blocks.length > 0) findings.push({ doc, blocks, bytes: Buffer.byteLength(t, 'utf8') })
  }
  const undetermined = findings.filter((f) => f.error)
  const dirty = findings.filter((f) => f.blocks)

  console.log(`📊 活文档归档回灌对账 · 面=${mode} · 归档件 ${archFiles.length} 份(行集 ${archiveSet.size} 行)· 受审 ${LIVE_DOCS.join(' / ')}`)
  if (undetermined.length > 0) {
    for (const u of undetermined) console.log(`❌ 未判定:${u.error}`)
    return 2
  }
  if (dirty.length === 0) {
    console.log(`✅ 没有连续 ≥${MIN_RUN} 行逐字命中归档面的块 —— §1 两步归档的第②步(原位置只留指针)守住了`)
    return 0
  }
  for (const d of dirty) {
    const lines = d.blocks.reduce((a, b) => a + b.len, 0)
    console.log(`❌ ${d.doc}(现读 ${d.bytes} B)里有 ${d.blocks.length} 块**归档正文回灌**,合计 ${lines} 行(每条都逐字存在于 ${ARCHIVE_PREFIX} 归档件里 ⇒ 剥离零丢失):`)
    for (const b of d.blocks.slice(0, 8)) console.log(`   L${b.start}-${b.end}(${b.len} 行)首行: ${b.sample}`)
    if (d.blocks.length > 8) console.log(`   …另 ${d.blocks.length - 8} 块`)
  }
  console.log(`  唯一出路:按 §1 两步归档把这些块从活文档剥掉(正文已在归档件里),剥前必须逐行自证"被剥的行 ∈ 归档面";不得改 207 预算、不得把归档件摘出审面、不得加体积豁免。`)
  return 1
}

function selfTest() {
  const cases = []
  const eq = (name, got, want) => cases.push([name, JSON.stringify(got) === JSON.stringify(want), got, want])
  const ARCH = Array.from({ length: 16 }, (_, i) => `归档正文第 ${i + 1} 行，长度足够跨过有信息量的门槛，用来构造整区级回灌样本。`)
  const NEW = '这是压缩版里仍在生效的一条规则行，它不在归档面里，应当切断块。'
  const set = buildArchiveFace({ 'a.md': ARCH.join('\n') })
  const count = (lines) => findReinflatedBlocks(lines, set).length

  eq('门槛本体:连续 11 行命中不报(合法重合不误伤)', count([...ARCH.slice(0, 11), NEW]), 0)
  eq('牙齿:连续 12 行命中 ⇒ 判一块', count([...ARCH.slice(0, 12), NEW]), 1)
  eq('牙齿:整区回灌(16 行)判一块', count([NEW, ...ARCH, NEW]), 1)
  eq('正控:零散命中(每 3 行夹一条本地新行)不算回灌', count([ARCH[0], ARCH[1], NEW, ARCH[2], ARCH[3], NEW, ARCH[4], ARCH[5], NEW, ARCH[6], ARCH[7], NEW, ARCH[8], ARCH[9], NEW, ARCH[10], ARCH[11], NEW, ARCH[12], ARCH[13], NEW, ARCH[14], ARCH[15]]), 0)
  eq('两块分别点名', count([...ARCH, NEW, NEW, NEW, NEW, ...ARCH]), 2)
  eq('夹在归档正文里的空行不断块(归档件本来就含空行)', findReinflatedBlocks([ARCH[0], '', ...ARCH.slice(1, 12), NEW], buildArchiveFace({ 'a.md': [ARCH[0], '', ...ARCH.slice(1, 12)].join('\n') })).length, 1)
  eq(
    '横幅类样板不算(每份归档件都带同一条水印横幅 ⇒ 朴素行集合命中会假阳性)',
    (() => {
      const banner = ['<!--', '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top', 'Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。', '-->']
      return count(banner, buildArchiveFace({ 'b.md': banner.join('\n') }))
    })(),
    0,
  )
  eq('门槛本身:短行与横幅都不算有信息量 / 中文长行算', [isInformative('ab'), isInformative(ARCH[0]), isInformative('© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top')], [false, true, false])
  let fail = 0
  for (const [name, ok, got, want] of cases) {
    if (ok) console.log(`  ✔ ${name}`)
    else { fail++; console.log(`  ✗ ${name}\n     got :${JSON.stringify(got)}\n     want:${JSON.stringify(want)}`) }
  }
  console.log(`自检:${cases.length - fail} 通过 / ${fail} 失败`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((rc) => process.exit(rc)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { buildArchiveFace, findReinflatedBlocks, isInformative, LIVE_DOCS, ARCHIVE_PREFIX, MIN_RUN }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
