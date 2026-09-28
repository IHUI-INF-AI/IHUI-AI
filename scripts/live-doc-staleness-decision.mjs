// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活文档滞台副本的"能不能安全取回被审面形态"判定出口(2026-09-28 立,只判定、零副作用)。
 *
 * 立因是当天 16:30–17:14 的实测事故:生产部署环每轮要 `git merge --ff-only <远端tip>`,它要求被本次
 * 更新触及的路径在工作区里干净;而 `PROJECT_PLAN.md` / `README.md` / `AGENTS.md` 这三份多会话共写台账的
 * **磁盘副本常年滞后 HEAD**(别的会话走对象空间旁路提交,结构上不 checkout 工作区)。于是部署环被
 * "这两份文件脏"整整挡住 4.5 小时、线上停在一个旧提交,并且每 4 小时给机主寄一封告警。
 * 当时的处置是逐行证明磁盘副本没有任何"只有它才有"的内容,确认安全后才把这两份对齐到 HEAD。
 * **那个"逐行证明"就是本文件** —— 否则下一个人只能凭感觉决定要不要覆盖别人的台账,而凭感觉覆盖台账
 * 会抹掉别人的活账(AGENTS §12:共享工作区里"看着像滞后的旧副本"恰恰是最贵的误判)。
 *
 * 判据(逐行归一 + **带计数的多重集**,不是集合):
 *   对每个被问路径 P:取 P 的工作区内容(要判的就是它)与 P 在**被审面**上的 blob,以及该面上
 *   `.ihui-agent/archive` 之下(递归)全部 `.md` 的 blob(归档语料,与基准 blob 同面同轮一次批量读,
 *   不逐文件派生 —— 内容读取一律走 scripts/lib/face-reader.mjs 的 catBatch / readWorktreeFile,
 *   自派生 git 取正文或按磁盘读仓库内容会被守门 118 判成半接线)。
 *   归一 = 剥 `\r`、连续空白压成一个空格、trim(被审面 blob 是 LF、共享工作树常是 CRLF,
 *   不剥 `\r` 会把同一行读成两行 —— 守门 13c 记过同型假红)。空行不计。
 *   一条工作区行 L "有出处" 当且仅当 count_WT(L) <= count_(HEAD ⊔ 归档语料)(L)。
 *   用集合代替多重集 = 放过"同一行被复制了两份以上"这种真独有内容,所以**计数是判据的一部分**。
 *
 * 三态(绝不并桶):
 *   alignable    —— 所有工作区行都有出处 ⇒ 覆盖回被审面不丢任何"只此一份"的内容。
 *   needHuman    —— 存在无出处行 ⇒ 那份副本里有 HEAD 与归档都没有的东西(可能是别人正在写的活账),
 *                   **绝不建议覆盖**,并逐条点名(最多 20 行 + 其余计数)。
 *   undetermined —— 取不到(工作区文件不在 / 被审面基准 blob 取不到 / 归档语料读不出 / 仓库根基准错位)
 *                   ⇒ 点名原因,**既不算 alignable 也不算 needHuman**;它同样不进 blockerSet。
 *
 * 能力边界(如实登记,别误以为这里有尺子):
 *   · 本文件不判"该不该覆盖",只答"覆盖会不会丢只此一份的内容"。备份与覆盖动作属调用方(部署环)。
 *   · 判据是**行级多重集**:工作区里"同一行被就地改写"会读成"新行无出处"⇒ needHuman(保守方向);
 *     反过来"两行互换位置"两侧多重集相同 ⇒ 读成 alignable —— 行多重集相等不等于顺序相同,本出口
 *     不声明顺序结论。
 *
 * 退出码:0 = 全部 alignable(blockerSet true);1 = 有 needHuman;2 = 有 undetermined 或没问到任何路径
 * (2 优先于 1 —— 把"没判成"写成"判定为不许覆盖"同样是把没判写成判过了)。
 *
 * 用法:
 *   node scripts/live-doc-staleness-decision.mjs [--paths <p> …] [--json] [--self-test]
 *   --root <dir> 是**测试通道**(临时 git 仓做端到端取证用),生产调用方不传。
 */

import { existsSync, lstatSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assertRepoRoot, catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓库根由脚本自身位置推导 —— 以调用方所在目录定根会随 cwd 换结论(AGENTS §15)。 */
const ROOT = resolve(HERE, '..')

/** 归档语料前缀:§1 两步走归档的落点,必须受版本控制才配当出处。 */
const ARCHIVE_PREFIX = '.ihui-agent/archive'
/** 缺省被问路径:本出口存在的理由就是这三份共写台账。 */
const DEFAULT_PATHS = ['PROJECT_PLAN.md', 'README.md', 'AGENTS.md']
/** 人读面最多逐条点名的无出处行数(其余只报计数,免得一次 needHuman 刷出几万行)。 */
export const MAX_PRINTED_ORPHANS = 20
/** `--json` 面带的无出处行数上限(比人读面宽,但仍必须有界)。 */
export const MAX_JSON_ORPHANS = 200

/** 行归一:剥 `\r`、连续空白压成单空格、trim。判据的"同一行"就是这个函数给的键。 */
export function normalizeLine(raw) {
  return String(raw).replace(/\r/g, '').replace(/\s+/g, ' ').trim()
}

/** 一份文本 → 归一行 → 出现次数(空行不计)。 */
export function lineCounts(text) {
  const map = new Map()
  for (const raw of String(text).split('\n')) {
    const key = normalizeLine(raw)
    if (key === '') continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

/** 把 src 的计数并进 target(出处侧是 HEAD ⊔ 归档语料的并,所以必须带计数累加)。 */
export function mergeCountsInto(target, src) {
  for (const [k, n] of src) target.set(k, (target.get(k) || 0) + n)
  return target
}

/**
 * 工作区侧哪些行**超出了**出处侧能背书的次数。
 * 排序刻意确定(超出量降序、再按文本升序):同一条输入必须每次给出同一份点名,否则取证不可复现。
 */
export function orphanLines(wtCounts, refCounts) {
  const out = []
  for (const [line, wt] of wtCounts) {
    const ref = refCounts.get(line) || 0
    if (wt > ref) out.push({ line, worktree: wt, reference: ref, excess: wt - ref })
  }
  out.sort((a, b) => b.excess - a.excess || (a.line < b.line ? -1 : a.line > b.line ? 1 : 0))
  return out
}

/**
 * 单路径三态判定(纯函数:所有内容都在参数里,所以三个 undetermined 来源都能构造证明)。
 * blockingError 是"这一轮整体没法判"(出处集不完整、根基准错位)—— 它必须先判,否则会把
 * "我没读到归档语料"误报成"这个路径的基准 blob 取不到",归因错方向比不归因更贵。
 *
 * @param {{rel:string, blockingError?:string|null, wtText:string|null, headText:string|null,
 *          archiveTexts?:string[], archiveError?:string|null, wtUnavailableReason?:string}} a
 */
export function decidePath(a) {
  const rel = a.rel
  if (a.blockingError)
    return { path: rel, status: 'undetermined', reason: `本轮整体不可判:${a.blockingError}` }
  if (a.wtText === null || a.wtText === undefined)
    return { path: rel, status: 'undetermined', reason: a.wtUnavailableReason || '工作区副本取不到' }
  if (a.headText === null || a.headText === undefined)
    return {
      path: rel,
      status: 'undetermined',
      reason: `${rel} 的被审面基准 blob 取不到 —— 没有基准时不得把"没比过"写成"可以覆盖"`,
    }
  if (a.archiveError)
    return {
      path: rel,
      status: 'undetermined',
      reason: `归档语料读不出,出处集不完整:${a.archiveError}`,
    }

  const ref = lineCounts(a.headText)
  for (const text of a.archiveTexts || []) mergeCountsInto(ref, lineCounts(text))
  const wt = lineCounts(a.wtText)
  const orphans = orphanLines(wt, ref)
  const total = (m) => [...m.values()].reduce((x, y) => x + y, 0)
  return {
    path: rel,
    status: orphans.length > 0 ? 'needHuman' : 'alignable',
    worktreeNonBlankLines: total(wt),
    worktreeDistinctLines: wt.size,
    referenceDistinctLines: ref.size,
    archiveDocs: (a.archiveTexts || []).length,
    orphans,
  }
}

/**
 * 汇总(纯函数)。blockerSet 的"全部"是**字面全部**:有未判定就不是全部 alignable;
 * 零路径被问时不得凭空给出 true —— 那等于"没问就答允许覆盖"。
 */
export function aggregate(results) {
  const counts = { alignable: 0, needHuman: 0, undetermined: 0 }
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1
  const asked = results.length
  const blockerSet = asked > 0 && counts.alignable === asked
  const exitCode = asked === 0 || counts.undetermined > 0 ? 2 : counts.needHuman > 0 ? 1 : 0
  return { asked, ...counts, blockerSet, exitCode }
}

/** 把调用方给的路径规范成仓内相对路径(允许绝对、反斜杠、`./` 前缀)。 */
export function toRel(p, root) {
  let s = String(p).trim().replace(/\\/g, '/')
  if (s.startsWith('/')) s = relative(root, resolve(String(p))).replace(/\\/g, '/')
  while (s.startsWith('./')) s = s.slice(2)
  return s.replace(/\/{2,}/g, '/')
}

/**
 * 枚举被审面上的归档件(递归、只认 `.md`;`.md.new` 这类同名变体**不算**出处 ——
 * 它们不是 §1 承诺的那份归档正文)。这一步只产路径清单,不产正文。
 */
function listArchiveDocs(root) {
  const out = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', ARCHIVE_PREFIX], root, {
    timeout: 60000,
  })
  return String(out)
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /\.md$/i.test(s))
}

/** 工作区那一份取不到时,把三种原因分开点名(它们的处置动作不同)。 */
function worktreeAbsence(root, rel) {
  const abs = resolve(root, rel.split('/').join(sep))
  if (!existsSync(abs))
    return `${rel} 在工作区里不存在(没有可比的内容;它是被删了还是没写过,属调用方决策)`
  try {
    if (lstatSync(abs).isDirectory()) return `${rel} 在工作区里是目录,不是文件`
  } catch {
    /* 竞态:上面 existsSync 说在,这里没了 —— 落到下一句 */
  }
  return `${rel} 的工作区副本含 NUL(二进制)或编码不可解码,无法逐行比对`
}

/**
 * 取材:基准 blob 与归档语料**同面同轮**一次批量读;工作区副本走层的磁盘出口。
 * @returns {{results:Array<object>, archiveDocs:number, archiveChars:number, blockingError:string|null}}
 */
function gather(root, paths) {
  let blockingError = null
  try {
    assertRepoRoot(root, '本判定出口')
  } catch (e) {
    blockingError = `仓库根基准错位:${e?.message ?? e}`
  }

  let archivePaths = []
  if (!blockingError) {
    try {
      archivePaths = listArchiveDocs(root)
    } catch (e) {
      blockingError = `${ARCHIVE_PREFIX} 的清单取不到,出处集不完整:${e?.message ?? e}`
    }
  }

  const headSpecs = paths.map((p) => `HEAD:${p}`)
  const archiveSpecs = archivePaths.map((p) => `HEAD:${p}`)
  const blobs = new Map()
  if (!blockingError) {
    try {
      for (const [k, v] of catBatch(root, [...headSpecs, ...archiveSpecs], { timeout: 120000 }))
        blobs.set(k, v)
    } catch (e) {
      blockingError = `被审面批量取材失败:${e?.message ?? e}`
    }
  }

  const archiveTexts = []
  const archiveMissed = []
  if (!blockingError) {
    for (const spec of archiveSpecs) {
      const t = blobs.get(spec)
      if (t === undefined || t === null) archiveMissed.push(spec.slice(5))
      else archiveTexts.push(t)
    }
    if (archiveMissed.length > 0)
      blockingError = `${archiveMissed.length}/${archiveSpecs.length} 个已登记的归档件取不到正文(出处集不完整),例如 ${archiveMissed.slice(0, 3).join(', ')}`
  }

  const results = paths.map((rel, i) => {
    let wtText = null
    let wtReason = null
    try {
      wtText = readWorktreeFile(root, rel)
    } catch (e) {
      wtText = null
      wtReason = `工作区副本读不出:${e?.message ?? e}`
    }
    if (wtText === null && !blockingError) wtReason = worktreeAbsence(root, rel)
    return decidePath({
      rel,
      blockingError,
      wtText,
      wtUnavailableReason: wtReason,
      headText: blobs.get(headSpecs[i]) ?? null,
      archiveTexts,
    })
  })
  return {
    results,
    archiveDocs: archiveTexts.length,
    archiveChars: archiveTexts.reduce((n, t) => n + t.length, 0),
    blockingError,
  }
}

export function parseArgs(argv) {
  const out = { paths: [], json: false, selfTest: false, root: ROOT, help: false, defaulted: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--paths' || a === '-p') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) out.paths.push(argv[++i])
    } else if (a.startsWith('--paths=')) {
      out.paths.push(...a.slice(8).split(',').filter(Boolean))
    } else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--root') {
      if (argv[i + 1]) out.root = resolve(argv[++i])
    } else if (a === '--help' || a === '-h') out.help = true
    else if (!a.startsWith('-')) out.paths.push(a)
  }
  out.defaulted = out.paths.length === 0
  if (out.defaulted) out.paths = [...DEFAULT_PATHS]
  return out
}

/** 人读面渲染。orphanCap 是唯一的输出闸 —— `--json` 面走 MAX_JSON_ORPHANS,不改判据。 */
export function render(results, summary, meta, orphanCap) {
  const lines = []
  lines.push(
    `判定面=${meta.face} 根=${meta.root} 归档语料=${meta.archiveDocs} 件 .md` +
      (meta.archiveChars ? ` / ${(meta.archiveChars / 1e6).toFixed(2)}M 归一前字符` : ''),
  )
  if (meta.defaulted)
    lines.push(
      `被问路径来自缺省表(${DEFAULT_PATHS.join(' / ')}),不是调用方显式声明`,
    )
  for (const r of results) {
    if (r.status === 'undetermined') {
      lines.push(`  ${r.path}: undetermined —— ${r.reason}`)
      continue
    }
    lines.push(
      `  ${r.path}: ${r.status}(工作区非空行 ${r.worktreeNonBlankLines} / 去重 ${r.worktreeDistinctLines})`,
    )
    const orphans = r.orphans || []
    for (const o of orphans.slice(0, orphanCap)) {
      const shown = o.line.length > 240 ? `${o.line.slice(0, 240)}…` : o.line
      lines.push(`      无出处 ×${o.worktree}(出处 ${o.reference}):${shown}`)
    }
    if (orphans.length > orphanCap)
      lines.push(`      …其余 ${orphans.length - orphanCap} 种无出处行未列出(总数见 orphanKinds)`)
  }
  lines.push(
    `汇总:alignable ${summary.alignable} / needHuman ${summary.needHuman} / undetermined ${summary.undetermined}` +
      ` | blockerSet=${summary.blockerSet ? 'true' : 'false'}(仅当全部被问路径都 alignable 才 true)` +
      ` | exit ${summary.exitCode}`,
  )
  return lines.join('\n')
}

/** 自检用例登记一律**求值**:`t(name, (() => {…})())`,登记侧按 `ok === true` 判 —— 传函数进去
 *  会被判红(守门 156 立的就是这一型:登记侧 `!!cond` 遇函数恒真,自检一路打印"N/N 通过"却一条没判过)。 */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok: ok === true })

  const head = ['# 计划', '- [x] 甲已完成', '- [ ] 乙进行中'].join('\n')
  const arch = '- [x] 甲已完成'

  t('正例:工作区每行都能在 HEAD 或归档里找到出处 ⇒ alignable', (() => {
    const r = decidePath({ rel: 'P', wtText: head, headText: head, archiveTexts: [arch] })
    return r.status === 'alignable' && r.orphans.length === 0
  })())

  t('反例A:一行谁都没有 ⇒ needHuman 并逐字点名该行', (() => {
    const wt = [head, '- [ ] 某人今天登记的活账'].join('\n')
    const r = decidePath({ rel: 'P', wtText: wt, headText: head, archiveTexts: [arch] })
    return (
      r.status === 'needHuman' &&
      r.orphans.length === 1 &&
      r.orphans[0].line === '- [ ] 某人今天登记的活账'
    )
  })())

  t('反例B:同行 WT×3 而出处合计×2 ⇒ needHuman(写成集合判据这一支必红)', (() => {
    const dup = '- [x] 甲已完成'
    const r = decidePath({ rel: 'P', wtText: [dup, dup, dup].join('\n'), headText: dup, archiveTexts: [dup] })
    return r.status === 'needHuman' && r.orphans.length === 1 && r.orphans[0].excess === 1
  })())

  t('反例B对照:同行 WT×2 而出处合计×3 ⇒ alignable(多重集不得反过来误伤)', (() => {
    const dup = '- [x] 甲已完成'
    const r = decidePath({
      rel: 'P',
      wtText: [dup, dup].join('\n'),
      headText: [dup, dup, dup].join('\n'),
      archiveTexts: [],
    })
    return r.status === 'alignable'
  })())

  t('归一化:同一行只差 CRLF、尾随空白与多空格 ⇒ 有出处', (() => {
    const r = decidePath({
      rel: 'P',
      wtText: '- [x] 甲已完成  \r\n',
      headText: '  -   [x] 甲已完成',
      archiveTexts: [],
    })
    return r.status === 'alignable'
  })())

  t('归一化:空行不计(多几个空行不构成无出处)', (() => {
    const r = decidePath({ rel: 'P', wtText: '\n\n   \n\t\n', headText: '', archiveTexts: [] })
    return r.status === 'alignable' && r.worktreeNonBlankLines === 0
  })())

  t('空文件(0 行)不算异常 ⇒ alignable', (() => {
    const r = decidePath({ rel: 'P', wtText: '', headText: head, archiveTexts: [arch] })
    return r.status === 'alignable'
  })())

  t('未判定源1:工作区副本取不到 ⇒ undetermined 并带原因', (() => {
    const r = decidePath({ rel: 'P', wtText: null, headText: head, wtUnavailableReason: '不在盘上' })
    return r.status === 'undetermined' && r.reason === '不在盘上'
  })())

  t('未判定源2:被审面基准 blob 取不到 ⇒ undetermined', (() => {
    const r = decidePath({ rel: 'P', wtText: head, headText: null })
    return r.status === 'undetermined'
  })())

  t('未判定源3:归档语料读不出 ⇒ undetermined(出处集不完整)', (() => {
    const r = decidePath({
      rel: 'P',
      wtText: head,
      headText: head,
      archiveTexts: [],
      archiveError: '清单取不到',
    })
    return r.status === 'undetermined' && /清单取不到/.test(r.reason)
  })())

  t('整体不可判(blockingError)优先于其它原因,不得把"没读到语料"说成"基准没了"', (() => {
    const r = decidePath({ rel: 'P', blockingError: '根基准错位', wtText: null, headText: null })
    return r.status === 'undetermined' && /根基准错位/.test(r.reason)
  })())

  t('blockerSet:undetermined 不得被算进"全部 alignable"', (() => {
    const s = aggregate([
      { path: 'A', status: 'alignable' },
      { path: 'B', status: 'undetermined' },
    ])
    return s.blockerSet === false && s.exitCode === 2
  })())

  t('blockerSet:needHuman ⇒ false 且 exit 1', (() => {
    const s = aggregate([
      { path: 'A', status: 'alignable' },
      { path: 'B', status: 'needHuman' },
    ])
    return s.blockerSet === false && s.exitCode === 1
  })())

  t('blockerSet:全部 alignable ⇒ true 且 exit 0', (() => {
    const s = aggregate([{ path: 'A', status: 'alignable' }, { path: 'B', status: 'alignable' }])
    return s.blockerSet === true && s.exitCode === 0
  })())

  t('零路径被问 ⇒ 判死(exit 2)而不是凭空给出 blockerSet=true', (() => {
    const s = aggregate([])
    return s.blockerSet === false && s.exitCode === 2
  })())

  t('未判定优先于 needHuman(不得把没判成写成"判定为不许覆盖")', (() => {
    const s = aggregate([
      { path: 'A', status: 'needHuman' },
      { path: 'B', status: 'undetermined' },
    ])
    return s.exitCode === 2
  })())

  t('人读面点名闸:25 种无出处行 ⇒ 只列 20 行并报"其余 5 种"', (() => {
    const many = []
    for (let i = 0; i < 25; i++) many.push(`- [ ] 独有 ${i}`)
    const r = decidePath({ rel: 'P', wtText: many.join('\n'), headText: '', archiveTexts: [] })
    const sum = aggregate([r])
    const body = render(
      [r],
      sum,
      { face: 'head(默认面)', root: 'R', archiveDocs: 0, archiveChars: 0, defaulted: false },
      MAX_PRINTED_ORPHANS,
    )
    const listed = (body.match(/无出处 ×/g) || []).length
    return r.orphans.length === 25 && listed === MAX_PRINTED_ORPHANS && /其余 5 种/.test(body)
  })())

  t('normalizeLine:制表符与全角空格都算空白,一律折叠为单空格后 trim', (() => {
    return normalizeLine('\ta \u3000  b  ') === 'a b'
  })())

  t('toRel:反斜杠与 ./ 前缀都归一成仓内相对路径', (() => {
    return toRel('.\\sub\\DOC.md', 'C:/x') === 'sub/DOC.md' && toRel('./A.md', 'C:/x') === 'A.md'
  })())

  t('判据有牙对照:同一份输入,把归档语料抽掉后必须从 alignable 翻成 needHuman', (() => {
    const wt = ['# 计划', '- [x] 甲已完成', '- [ ] 乙进行中'].join('\n')
    const withArch = decidePath({ rel: 'P', wtText: wt, headText: '# 计划\n- [ ] 乙进行中', archiveTexts: [arch] })
    const without = decidePath({ rel: 'P', wtText: wt, headText: '# 计划\n- [ ] 乙进行中', archiveTexts: [] })
    return withArch.status === 'alignable' && without.status === 'needHuman'
  })())

  let pass = 0
  for (const c of cases) {
    if (c.ok) pass++
    else console.log(`  ❌ ${c.name}`)
  }
  console.log(`自检:${pass}/${cases.length} 通过${pass === cases.length ? '' : ' —— 有失败项'}`)
  return pass === cases.length ? 0 : 1
}

function main() {
  const argv = parseArgs(process.argv.slice(2))
  if (argv.help) {
    console.log(
      '用法:node scripts/live-doc-staleness-decision.mjs [--paths <p> …] [--json] [--self-test] [--root <测试通道>]',
    )
    return 0
  }
  if (argv.selfTest) return selfTest()

  const paths = [...new Set(argv.paths.map((p) => toRel(p, argv.root)).filter(Boolean))]
  const got = gather(argv.root, paths)
  const summary = aggregate(got.results)
  const meta = {
    face: 'HEAD blob(默认面)',
    root: argv.root,
    archiveDocs: got.archiveDocs,
    archiveChars: got.archiveChars,
    defaulted: argv.defaulted,
  }
  if (paths.length === 0) {
    console.log('没有问到任何路径 ⇒ 无法判定(零路径不得被读成"都可以覆盖")')
    return 2
  }
  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          face: meta.face,
          root: meta.root,
          defaultedPaths: meta.defaulted,
          paths,
          archiveDocs: got.archiveDocs,
          archiveChars: got.archiveChars,
          summary,
          results: got.results.map((r) => ({
            ...r,
            orphans: (r.orphans || []).slice(0, MAX_JSON_ORPHANS),
            orphanKinds: (r.orphans || []).length,
          })),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(render(got.results, summary, meta, MAX_PRINTED_ORPHANS))
  }
  return summary.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}

export const __test__ = {
  normalizeLine,
  lineCounts,
  mergeCountsInto,
  orphanLines,
  decidePath,
  aggregate,
  toRel,
  parseArgs,
  render,
  selfTest,
  ROOT,
  ARCHIVE_PREFIX,
  DEFAULT_PATHS,
  MAX_PRINTED_ORPHANS,
  MAX_JSON_ORPHANS,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
