// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 判"长文被塞进 Markdown 表格单元格、prettier 重排后把表格打断"这一型(README 表格完整性守门)。
//
// 为什么立这道门(实测,不是假想):README 的守门速查表被多个会话反复往里贴整段登记。表格
// 单元格里不能有换行,而 prettier 会把散文里的 `|` 当列分隔符重排 ⇒ 产出的行竖线数与本表
// 基准不同,渲染出来是碎的。此前只有人肉修:修完这一格,同一张表别处又长出下一格。
//
// 2026-09-28 起本门是**提交链上唯一的 Markdown 结构闸**(只读判据,不写回)。同批把 `md` 从
// lint-staged 的 prettier 任务里摘掉,原因是实测:`prettier --check AGENTS.md` 对 **HEAD 版本本身**
// 就判 not formatted(README 同),所以"提交前格式化"从来不是"格式化通过",而是**每次提交都先把
// 提交者根本没碰的若干行改写一遍** —— 一枚"只加一行 AGENTS.md"的提交实测重排 4 行(把两条独立
// 登记并成 1,929 字符的一行)并插入 3 条空行,而那些行从此与 HEAD 不再逐字相等,活文档对账
// (`scripts/merge-live-doc.mjs`)判"真丢失"并拒绝一次正常提交。写回式格式化在多会话共享的
// 活文档上结构性不可用(§12),所以替代它的是**判**而不是**修**:FE1/TI1/TI4 只点名不改动任何字节。
//
// 判据分三维,量的是三件不同的事,锚点各自独立(一台尺子只量一段,但**一段不得没人量**):
//  - **T-A(判据 TI1,整文件棘轮)**:一个表格簇内出现 ≥2 行**连续**的 2 竖线行(`| 散文片段 |`),
//    而该簇主竖线数(本面多数)≥3 ⇒ 它们是上一行最后一个单元格的竖排续行。纯机械可判:
//    剥掉首尾竖线与多余空白后按序拼接,应当能回到那一格的完整内容 —— 修复出口写进失败提示,
//    是真可跑的命令(`scripts/readme-table-unwrap.mjs`,默认 --dry-run 零写盘)。
//  - **T-A 形状但落在"本次改动的行"上(判据 TI4,逐行,2026-09-28 补)**:TI1 要求"连续 ≥2 行"
//    才成 run,所以**单独一行**竖排续行(既有口径里的 `lone`)整档都不判红 —— 那是给"存量不追"
//    让路的取舍。可一旦这一行是**本次新增/修改**的,就没有任何存量理由放过它,而"该列填什么"
//    在 TI1 里也早已不作为不判红的理由(T-A run 同样不问语义)。TI4 因此把同一条形状判据
//    (`classifyCluster` 一份实现,TI1/TI4 共用)套到"与 HEAD 逐行比对后新增/改动的行"上,
//    含孤立单行 ⇒ 新写的碎表必被点名,而 HEAD 里已有的碎表不会被追溯判红(§12e)。
//  - **未闭合代码围栏(判据 FE1,文件级,零容忍,2026-09-28 补)**:开栏(``` 或 ~~~)之后到
//    文件尾没有等长或更长的同字符闭栏 ⇒ 整篇后半被当成代码渲染。围栏解析**只有**
//    `maskMarkdownStructure` 一份实现,判据读它多带出来的 `unclosedFenceAt`,不得另写一遍。
//    立门前先量存量:HEAD 面 README 与 AGENTS 的未闭合围栏均为 0 ⇒ 零容忍不产生恒红面。
//  - **T-B(不归任何判据)**:行竖线数比本簇主竖线数少 1(如 4 vs 5),多为重复了首列 id 的半截行。
//    "该列填什么"要逐案判语义 ⇒ 只报数不判红,并在输出里点名"这是 T-B,不属于本型"。
//  - 另有一类**孤立** 2 竖线行(不成 run,不满足"连续 ≥2"):**整文件档(TI1)**不判红、单列计数
//    报出;**逐行档(TI4)**判红(见上)。绝不静默,也绝不把"没判"写成"判过了"。
//
// 射程(两份名单,刻意分开):
//  - `DOC_TARGETS` = 本门**审**的活文档 = README.md + AGENTS.md(FE1/TI4 对其全部生效)。
//  - `TI1_TARGETS` = 受 `readme-table-integrity-baseline.json` 每文件额度管辖的名单(现仅 README)。
//    AGENTS.md 的 HEAD 面**确有** 2 行 T-A 存量(§5b 那张"现状结构"表里被竖排的两行),而给它登记
//    额度要改基线文件(不在本票允许改动面内),硬套 cap=0 就是在造一台与任何提交都无关的恒红门 ——
//    所以 AGENTS 的 TI1 维**只报数并大声写明"不在 TI1 射程"**,FE1/TI4 照判。名单是判据输入,
//    改动必须同批改 `analyze`,不得在别处再抄一份。`--file` 显式点名的文件按 TI1 射程判
//    (既有自检"新文件不在基线 ⇒ cap=0 判红"的语义一字未动)。
//
// 提交链上 runner 一律追加 `--staged`:本轮没碰任何在审文档时**退回 HEAD 全量档并喊出来**
// (门 135 同课 —— 判"无法判定"就是替每一次无关提交挡路 ⇒ 各会话跳门 ⇒ 全部守门作废)。
// 但"本轮未触及"与"本轮把它删了"是两件事:`git rm --cached` 那一格仍是 **exit 2 不回落 HEAD**
// (既有自检钉着,回落就是把"没判"写成"判过了")。
//
// 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
// `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;目标文件在本面取不到 ⇒ exit 2 **不回落**
// 另一个面(回落就是把"没判"写成"判过了",守门 36/124 那一课);本面枚举到 0 个表格簇 ⇒
// 判"无法判定" exit 2,不记为通过(本仓最高频失效型)。
// 内容一律经 `scripts/lib/face-reader.mjs` 的**读取入口**(`catBatch` / `readWorktreeFile`)
// 取 —— 只 import 不用它读内容会被守门 118 判"半接线"并在提交档判红。
//
// 判据面先剥结构再配行:HTML 注释(`<!-- -->`)整段遮空(被注释掉的示例表不是文档结构),
// fenced code block 整段跳过(``` 与 ~~~ 两种围栏,行首缩进 ≤3 空格的围栏也算)—— 否则文档
// 里故意放的示例表会被判成违规。遮罩保持行数与行长不变(报告要给行号)。
//
// 棘轮:TI1 锚点 = 该文件在 HEAD 自身的 T-A 行数(`--staged` 档)或
// `scripts/readme-table-integrity-baseline.json` 的每文件额度(全量档)。存量当场判红就是
// 一台与任何提交都无关的恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
// `--update-baseline` **必须保留任何非计数键**(守门 83 记过:整文件重写会把别人的审计
// 台账冲掉),且只下调、不上调、不代登记新键。
//
// 行内出口:`table-cell-exempt: <原因>`(**必须带原因**,裸标记不放行,`*/`/`-->` 不得冒充
// 原因 —— 守门 102 同锁),生效范围 = 该 T-A run 的任一行,或 run 的**宿主行**(run 首行的
// 紧邻上一行)—— 与 GA4"标记写在块上必须生效"同一课:只认同行会让人按直觉写错位置而恒红。
// TI4 沿用**同一条**通道与同一份 `hasExemptReason`(只认命中行与其紧邻上一行),不新建第二个
// 豁免族 —— 一个缺陷两种量纲不该有两个出口。**FE1 没有出口**:未闭合围栏没有"确属有意"的形态。
// 已登记进守门 108 的 `FAMILY_LIFETIME_DAYS`(30 天:待偿债务,不是结构性定性)。
//
// 用法:node scripts/check-readme-table-integrity.mjs
//       [--staged|--worktree|--json|--self-test|--update-baseline|--file <path>...|--root <dir>]
// 紧急跳过:HUSKY_SKIP_README_TABLE_INTEGRITY=1(编号与 skipEnv 现值以 guardian-runner.mjs 为准)
// 手动问责:pnpm check:readme-table-integrity(全量 HEAD 面;现读数一律看本命令末行,勿引文档旧数)

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/readme-table-integrity-baseline.json'
/** 本门**审**的活文档(FE1 文件级 + TI4 逐行对其全部生效);顺序即报告顺序,README 必须居首。 */
const DOC_TARGETS = ['README.md', 'AGENTS.md']
/** 受基线额度管辖的 TI1 射程(见头注「射程」段);`--file` 显式点名的文件不受此名单限制。 */
const TI1_TARGETS = ['README.md']
/** 默认目标 = 在审文档全集(保持 `DEFAULT_TARGETS` 这个名字:镜像测试与既有自检都按它取)。 */
const DEFAULT_TARGETS = DOC_TARGETS
/** TI1 阈值:连续 2 竖线行 ≥ 此数才成 run;本簇主竖线数 ≥ 此数才纳判 */
const MIN_RUN_LINES = 2
const MIN_MODE_PIPES = 3
const EXEMPT_RE = /table-cell-exempt\s*:\s*([^\r\n]*)/

/** 豁免标记的"原因"是否成立:剥掉单元格闭合竖线与注释闭合符、去空白后仍有实义内容 */
export function hasExemptReason(rawLine) {
  const m = EXEMPT_RE.exec(String(rawLine ?? ''))
  if (!m) return false
  let tail = m[1]
  // 依次剥掉:单元格收尾的 `|`、HTML 注释闭合 `-->`、行首冒充原因的 `*/`
  for (const re of [/\s*\|\s*$/, /\s*-->\s*$/, /^\s*\*\/\s*/]) tail = tail.replace(re, '')
  return tail.trim().length > 0
}

/** 未转义竖线计数(`\|` 是单元格的合法内容,不是列分隔符) */
export function countPipes(line) {
  let n = 0
  let esc = false
  for (const ch of String(line ?? '')) {
    if (esc) {
      esc = false
      continue
    }
    if (ch === '\\') {
      esc = true
      continue
    }
    if (ch === '|') n++
  }
  return n
}

/**
 * 结构遮罩:HTML 注释与 fenced code block 整段变空白,行数不变、每行长度不变(保留列位)。
 * 围栏:行首 ≤3 空格 + ≥3 个反引号或波浪号;闭合须同字符且不少于开栏长度、其后仅空白。
 * 未闭合的围栏开到文件尾(CommonMark 语义)—— 不得半途把示例表放回判据面。
 * 同一遍扫描顺手量 **FE1 的输入** `unclosedFenceAt`(扫到文件尾仍未闭合的那道开栏行号,可为 null):
 * 围栏语义只许这一份实现,判据若再自己扫一遍 ``` 就是第二份真相(本仓"两处算同一件事必漂移"同课)。
 */
export function maskMarkdownStructure(text) {
  const lines = String(text ?? '').split('\n')
  const out = []
  let fence = null
  let inComment = false
  let fenceBlocks = 0
  let commentSpans = 0
  lines.forEach((raw, i) => {
    const t = raw.replace(/\r$/, '')
    if (fence) {
      const closeRe = new RegExp('^ {0,3}' + (fence.char === '`' ? '`' : '~') + '{' + fence.len + ',}\\s*$')
      if (closeRe.test(t)) fence = null
      out.push(' '.repeat(t.length))
      return
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(t)
    if (open && !inComment) {
      fence = { char: open[1][0], len: open[1].length, line: i + 1 }
      fenceBlocks++
      out.push(' '.repeat(t.length))
      return
    }
    let res = ''
    let k = 0
    let sawComment = false
    while (k < t.length) {
      if (!inComment && t.startsWith('<!--', k)) {
        inComment = true
        sawComment = true
        res += '    '
        k += 4
        continue
      }
      if (inComment) {
        if (t.startsWith('-->', k)) {
          inComment = false
          res += '   '
          k += 3
        } else {
          res += ' '
          k++
        }
        continue
      }
      res += t[k]
      k++
    }
    if (sawComment) commentSpans++
    out.push(res)
  })
  return {
    masked: out,
    stats: { fenceBlocks, commentSpans, unclosedFenceAt: fence ? fence.line : null },
  }
}

/** 表格簇 = 遮罩面上连续的"以竖线开头"的行(空白/散文/围栏/注释都会切断它)。 */
export function findClusters(maskedLines, rawLines) {
  const clusters = []
  let cur = null
  maskedLines.forEach((l, idx) => {
    const isRow = l.trimStart().startsWith('|')
    if (isRow) {
      if (!cur) cur = { start: idx + 1, rows: [] }
      cur.rows.push({ n: idx + 1, pipes: countPipes(l), raw: rawLines[idx] ?? '' })
    } else if (cur) {
      clusters.push(cur)
      cur = null
    }
  })
  if (cur) clusters.push(cur)
  return clusters
}

/** 主竖线数 = 簇内多数;平票取**较大**者(较大值更可能是被打断前的完整列数)。 */
export function clusterMode(rows) {
  const counts = new Map()
  for (const r of rows) counts.set(r.pipes, (counts.get(r.pipes) || 0) + 1)
  let mode = -1
  let modeN = -1
  for (const [p, n] of counts) {
    if (n > modeN || (n === modeN && p > mode)) {
      mode = p
      modeN = n
    }
  }
  return mode
}

/**
 * 单簇分箱(TI1 / TI4 形状 / T-B / 孤立):
 *  - taRuns:mode≥3 的簇内,连续 2 竖线行 ≥MIN_RUN_LINES 行成 run;run 带合法豁免标记
 *    (本 run 任一行,或 run 首行的**紧邻上一行** = 宿主行)⇒ ent.exempt=true,不判红只报数。
 *  - tb:mode≥3 的簇内,竖线数 == mode-1 且不在任何 run 里的行(T-B,只报数)。
 *  - lone:mode≥3 的簇内不成 run 的孤立 2 竖线行(TI1 不判,但**是** TI4 的形状判据)。
 *  - shortRows:taRuns 的行 ∪ lone 的行,逐行带 `exempt` —— TI1 与 TI4 因此共用**同一份**形状判据,
 *    第二处再写一遍"2 竖线且 mode≥3"就迟早漂(本仓最高频失效型)。
 */
export function classifyCluster(cluster) {
  const mode = clusterMode(cluster.rows)
  const res = { mode, taRuns: [], tb: [], lone: [], shortRows: [] }
  if (mode < MIN_MODE_PIPES) return res
  let run = []
  const rowExempt = (n) => {
    const self = cluster.rows.find((x) => x.n === n)
    const prev = cluster.rows.find((x) => x.n === n - 1)
    return Boolean((self && hasExemptReason(self.raw)) || (prev ? hasExemptReason(prev.raw) : false))
  }
  const runIsExempt = (r) => {
    const prev = cluster.rows.find((x) => x.n === r[0].n - 1)
    return r.some((x) => hasExemptReason(x.raw)) || (prev ? hasExemptReason(prev.raw) : false)
  }
  const flush = () => {
    if (run.length >= MIN_RUN_LINES) {
      const ent = { hostLine: run[0].n - 1, lines: run.map((x) => x.n) }
      if (runIsExempt(run)) ent.exempt = true
      res.taRuns.push(ent)
      for (const x of run) res.shortRows.push({ line: x.n, exempt: Boolean(ent.exempt) })
    } else if (run.length === 1) {
      res.lone.push(run[0].n)
      res.shortRows.push({ line: run[0].n, exempt: rowExempt(run[0].n) })
    }
    run = []
  }
  for (const r of cluster.rows) {
    if (r.pipes === 2) {
      run.push(r)
      continue
    }
    flush()
    if (r.pipes === mode - 1) res.tb.push(r.n)
  }
  flush()
  return res
}

/** 单文件判据(纯文本进、结构出,不碰 git/磁盘)。sites 只留前 12 处,计数是全量。 */
export function auditText(text) {
  const rawLines = String(text ?? '').split('\n')
  const { masked, stats } = maskMarkdownStructure(text)
  const clusters = findClusters(masked, rawLines)
  const per = clusters.map((c) => ({ start: c.start, cls: classifyCluster(c) }))
  let taRows = 0
  let taRuns = 0
  let exemptRuns = 0
  let tbRows = 0
  let loneRows = 0
  const sites = []
  const shortRows = []
  for (const p of per) {
    for (const r of p.cls.taRuns) {
      if (r.exempt) {
        exemptRuns++
        continue
      }
      taRuns++
      taRows += r.lines.length
      for (const line of r.lines)
        sites.push({ line, hostLine: r.hostLine, clusterStart: p.start, mode: p.cls.mode })
    }
    tbRows += p.cls.tb.length
    loneRows += p.cls.lone.length
    for (const s of p.cls.shortRows) shortRows.push({ ...s, clusterStart: p.start, mode: p.cls.mode })
  }
  return {
    clusters: clusters.length,
    fenceBlocks: stats.fenceBlocks,
    commentSpans: stats.commentSpans,
    /** FE1 输入:到文件尾仍未闭合的开栏行号(null = 闭合齐备)。 */
    unclosedFenceAt: stats.unclosedFenceAt ?? null,
    taRuns,
    taRows,
    exemptRuns,
    tbRows,
    tbLines: per.flatMap((p) => p.cls.tb),
    loneRows,
    /** TI4 输入:T-A 形状的行(含孤立单行),逐行带 exempt 标记。 */
    shortRows,
    sites: sites.slice(0, 12),
  }
}

/**
 * 基线读取。它是**工具输入**不是被审内容(与被审面分开的判据额度文件),所以走磁盘;
 * 缺文件按空基线,坏 JSON **抛** —— 静默当空清单会把别人的额度洗成零容忍恒红门
 * (守门 99 的 allowlist 同课)。
 */
export function loadBaseline(root = ROOT) {
  const p = join(root, BASELINE_REL)
  let text
  try {
    text = readFileSync(p, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw new Undetermined(`基线 ${BASELINE_REL} 读取出错:${e.message}`)
  }
  try {
    const j = JSON.parse(text)
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('顶层不是对象')
    return j
  } catch (e) {
    throw new Undetermined(`基线 ${BASELINE_REL} 不是合法 JSON:${e.message}`)
  }
}

/** 棘轮归并(TI2):只下调已有键,绝不新增、绝不上调;**其余顶层键原样带走**。 */
export function mergeBaseline(base, headCounts) {
  const notes = []
  const ta = { ...((base && base.taCounts) || {}) }
  for (const [file, n] of Object.entries(headCounts)) {
    if (!Object.prototype.hasOwnProperty.call(ta, file)) {
      notes.push(`${file}: 不在基线里 —— 新增登记须人工写键(--update-baseline 拒绝代登记)`)
      continue
    }
    const cap = Number(ta[file]) || 0
    if (n > cap) notes.push(`${file}: 现读 ${n} > 基线 ${cap} —— 这是回归不是债务,拒绝上调`)
    else if (n < cap) ta[file] = n
  }
  return { merged: { ...base, taCounts: ta }, notes }
}

/**
 * 解析 `git diff -U0` 的**新侧**新增行号集合(TI4 的"本次改动的行"就是这么来的)。
 * 返回 `Set<number>`;输出里出现过 `@@` 却解不出新侧行号 ⇒ 返回 **null** = 判"未判定"
 * (把"没看清"当成"这次没改行",就等于给 TI4 发合格证)。空输出 = 真没有改动 ⇒ 空集。
 */
export function parseAddedLineRanges(diffText) {
  const out = new Set()
  for (const l of String(diffText ?? '').split('\n')) {
    if (!l.startsWith('@@')) continue
    const m = /^@@+(?: -\d+(?:,\d+)?)? \+(\d+)(?:,(\d+))? @@/.exec(l)
    if (!m) return null
    const start = Number(m[1])
    const len = m[2] === undefined ? 1 : Number(m[2])
    for (let k = 0; k < len; k++) out.add(start + k)
  }
  return out
}

/** 本轮暂存区里被"记为改动"的路径集合(含暂存删除 —— 它与"本轮没碰"是两件事,见头注)。 */
export function stagedTouchedPaths(root) {
  const out = gitRaw(['diff', '--cached', '--name-only', '--no-ext-diff'], root, { timeout: 120000 })
  return new Set(
    String(out ?? '')
      .split('\n')
      .map((s) => s.replace(/\r$/, '').trim())
      .filter(Boolean),
  )
}

/** 某文件"本次新增/改动的行号":staged 拿 `git diff --cached`,worktree 拿 `git diff HEAD`。 */
function changedLines(root, face, file) {
  if (face === 'head') return { lines: null, na: true } // 全量档没有"改动"这一维
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--no-ext-diff', '-U0', '--no-color', '--', file]
      : ['diff', '--no-ext-diff', '-U0', '--no-color', 'HEAD', '--', file]
  let text
  try {
    text = gitRaw(args, root, { timeout: 120000 })
  } catch (e) {
    return { lines: null, na: false, error: `git diff 取不到:${String(e && e.message ? e.message : e).slice(0, 160)}` }
  }
  const parsed = parseAddedLineRanges(text)
  if (parsed === null) return { lines: null, na: false, error: 'diff 输出里有 @@ 却解不出新侧行号(判未判定,不当成"没改行")' }
  return { lines: parsed, na: false }
}

/**
 * 同面同轮取内容:一次 catBatch 把每个目标的 `HEAD:<f>`(锚点)与 `:<f>`(索引 blob)读满,
 * 不在判据里再自己拼 git show —— 只 import face-reader 而内容仍由自派生 git 取,
 * 会被守门 118 判"半接线"并在提交档判红。
 */
function readFace(root, face, targets) {
  const out = new Map()
  if (face === 'worktree') {
    for (const f of targets) out.set(f, { head: readWorktreeFile(root, f), index: null })
    return out
  }
  const specs = []
  for (const f of targets) {
    specs.push(`HEAD:${f}`)
    if (face === 'staged') specs.push(`:${f}`)
  }
  const map = catBatch(root, specs)
  for (const f of targets) {
    out.set(f, {
      head: map.get(`HEAD:${f}`) ?? null,
      index: face === 'staged' ? (map.get(`:${f}`) ?? null) : null,
    })
  }
  return out
}

/**
 * 主判据。返回 { exit, face, perFile, reds, undetermined, notes, emptyScan, retreated, ... }。
 * exit:0 通过(存量只报数)/ 1 判红(新增 T-A / TI4 逐行碎表 / FE1 未闭合围栏)/ 2 无法判定。
 *
 * `opts.explicitTargets` = true 时(`--file` 点名)TI1 对点名文件生效 —— 既有语义"新文件不在
 * 基线 ⇒ cap=0 判红"一字未动;只有走默认名单才按 `TI1_TARGETS` 分射程。
 */
export function analyze(
  face,
  root = ROOT,
  targets = DEFAULT_TARGETS,
  { updateBaseline = false, explicitTargets = false } = {},
) {
  const r = {
    gate: 'readme-table-integrity',
    face,
    /** 实际用来判的那一面:--staged 退回时与 `face` 不同,报告里的"锚点"字样必须跟着它走。 */
    judgedFace: face,
    targets,
    perFile: [],
    reds: [],
    undetermined: [],
    notes: [],
    baselineMissingKeys: [],
    baselineNotes: [],
    emptyScan: false,
    retreated: false,
    exit: 0,
    fixHint: `node scripts/readme-table-unwrap.mjs --file ${targets[0] || 'README.md'} --dry-run`,
  }
  if (updateBaseline && face !== 'head') {
    r.undetermined.push({ file: null, reason: '--update-baseline 只在全量(HEAD)档运行(锚点必须钉在入库态上)' })
    r.exit = 2
    return r
  }
  let base
  try {
    base = loadBaseline(root)
  } catch (e) {
    r.undetermined.push({ file: null, reason: e.message })
    r.exit = 2
    return r
  }
  const caps = (base && base.taCounts) || {}
  let workedFace = face
  let touched = null
  if (face === 'staged') {
    try {
      touched = stagedTouchedPaths(root)
    } catch (e) {
      r.undetermined.push({ file: null, reason: `暂存清单取不到:${String(e && e.message ? e.message : e).slice(0, 160)}` })
      r.exit = 2
      return r
    }
    // runner 对每道门都追加 --staged,所以"本轮一份在审文档都没碰"必须是常态而非"无法判定"
    // (门 135 同课:与提交内容无关的恒红/恒挡,唯一结局是各会话跳门 ⇒ 全部守门对该提交作废)。
    if (!targets.some((f) => touched.has(f))) {
      r.retreated = true
      r.notes.push('--staged 档本轮未触及任何在审文档 ⇒ 退回 HEAD 全量档判(已如实点名,不静默)')
      workedFace = 'head'
    }
  }
  r.judgedFace = workedFace
  let texts
  try {
    texts = readFace(root, workedFace, targets)
  } catch (e) {
    r.undetermined.push({ file: null, reason: `本面取材失败:${e.message}` })
    r.exit = 2
    return r
  }
  let audited = 0
  for (const f of targets) {
    const got = texts.get(f) || {}
    const faceText = workedFace === 'staged' ? got.index : got.head
    const inTi1 = explicitTargets || TI1_TARGETS.includes(f)
    if (workedFace === 'staged' && !touched.has(f)) {
      r.notes.push(`${f}:本轮暂存区未触及 ⇒ 逐行(TI4)无新行可判,整档维(TI1/FE1)沿用 HEAD 现读报数`)
      // 没碰的文件仍要量 FE1:它判的是"这篇文档现在是否已碎",不是"谁改的"。
      if (typeof got.head === 'string') {
        const a = auditText(got.head)
        if (a.clusters > 0) audited++
        r.perFile.push(fileEntry(f, got.head, a, null, { cap: Number(caps[f]) || 0, inTi1, untouched: true }))
        if (a.unclosedFenceAt) {
          r.reds.push({ file: f, kind: 'FE1', line: a.unclosedFenceAt })
        }
      } else {
        r.notes.push(`${f}:HEAD 面上没有这份文档(本仓未纳管该文件 ⇒ 不计入判据,也不记为通过)`)
      }
      continue
    }
    if (typeof faceText !== 'string') {
      if (workedFace === 'staged') {
        // 走到这里说明本轮**确实碰过**它却拿不到索引 blob(典型 = 暂存删除)⇒ 未判定,
        // 绝不借 HEAD 内容凑数(回落就是把"没判"写成"判过了",守门 36/124 那一课)。
        r.undetermined.push({ file: f, reason: `${workedFace} 面取不到内容(不回落其他面,不猜)` })
      } else {
        // 整档档(HEAD / worktree)上"这份文档本仓没有"≠"判据取不到":夹具与瘦检出是常态。
        // 仍要报名字,并且一个都没量到时由下方 audited===0 兜成"无法判定",绝不静默记绿。
        r.notes.push(`${f}:${workedFace} 面上没有这份文档 ⇒ 不计入判据,也不记为通过`)
      }
      continue
    }
    if (workedFace === 'staged' && typeof got.head !== 'string') {
      r.undetermined.push({ file: f, reason: `${f} 不在 HEAD 里,没有锚点可比(新文件请走全量档:不在基线即 cap=0)` })
      continue
    }
    const ch = changedLines(root, workedFace, f)
    if (ch.error) {
      r.undetermined.push({ file: f, reason: ch.error })
      continue
    }
    const idx = auditText(faceText)
    const headAnchor = workedFace === 'staged' ? auditText(got.head).taRows : idx.taRows
    if (idx.clusters === 0) {
      r.emptyScan = true
      continue
    }
    audited++
    if (inTi1 && !(f in caps)) r.baselineMissingKeys.push(f)
    const cap = Number(caps[f]) || 0
    const ent = fileEntry(f, faceText, idx, ch.lines, { cap, inTi1, headAnchor, anchor: workedFace === 'staged' ? headAnchor : cap })
    if (idx.unclosedFenceAt) {
      ent.fe1Red = true
      r.reds.push({ file: f, kind: 'FE1', line: idx.unclosedFenceAt })
    }
    if (inTi1) {
      if (workedFace === 'staged') {
        if (idx.taRows > headAnchor) {
          ent.red = true
          r.reds.push({ file: f, kind: 'TI1', from: headAnchor, to: idx.taRows })
        }
      } else if (idx.taRows > cap) {
        ent.red = true
        r.reds.push({ file: f, kind: 'TI1', from: cap, to: idx.taRows })
      }
    } else if (idx.taRows > 0) {
      r.notes.push(`${f}:TI1 不在射程(该文件无基线额度键)⇒ T-A 存量 ${idx.taRows} 行只报数,FE1/TI4 照判`)
    }
    if (ent.ti4Red) r.reds.push({ file: f, kind: 'TI4', lines: ent.ti4.map((x) => x.line) })
    r.perFile.push(ent)
  }
  if (r.perFile.length === 0 && !r.emptyScan && r.undetermined.length === 0) r.emptyScan = true
  if (audited === 0 && !r.emptyScan && r.undetermined.length === 0)
    r.emptyScan = true // 一个文件都没量到 ⇒ 与"0 个表格簇"同型,判死不是通过
  if (updateBaseline) {
    const headCounts = {}
    // 注意字段名:读数存在 `ti1InScope`(fileEntry 产出的那一面),不是局部的 inTi1 ——
    // 两处不同名就是"消费方永远读到 undefined",基线会静默永不收紧(本条由自检 TI2 的
    // "5→0 必须真下调"逮到,已作为反向锁留在 --self-test 里)。
    for (const ent of r.perFile) if (ent.ti1InScope) headCounts[ent.file] = ent.headTaRows
    const { merged, notes } = mergeBaseline(base, headCounts)
    r.wouldWrite = merged
    r.baselineNotes = notes
    return r
  }
  if (r.emptyScan) r.undetermined.push({ file: null, reason: '本面枚举到 0 个表格簇 —— 判"无法判定",绝不记绿' })
  if (r.undetermined.length) r.exit = 2
  else if (r.reds.length) r.exit = 1
  else r.exit = 0
  return r
}

/** 把单文件的三维读数收敛成一条报告/JSON 记录(TI4 只在拿到"改动行集"时才产站点)。 */
function fileEntry(file, text, idx, changedSet, { cap, inTi1, headAnchor, anchor, untouched = false }) {
  const ti4 = []
  let ti4Exempt = 0
  if (changedSet) {
    for (const s of idx.shortRows) {
      if (!changedSet.has(s.line)) continue
      if (s.exempt) {
        ti4Exempt++
        continue
      }
      ti4.push({ line: s.line, clusterStart: s.clusterStart, mode: s.mode })
    }
  }
  return {
    file,
    clusters: idx.clusters,
    fenceBlocks: idx.fenceBlocks,
    commentSpans: idx.commentSpans,
    unclosedFenceAt: idx.unclosedFenceAt,
    ti1InScope: inTi1,
    untouchedThisRound: untouched,
    taRuns: idx.taRuns,
    taRows: idx.taRows,
    headTaRows: headAnchor === undefined ? idx.taRows : headAnchor,
    shortRows: idx.shortRows.length,
    exemptShortRows: idx.shortRows.filter((s) => s.exempt).length,
    ti4ExemptRows: ti4Exempt,
    ti4,
    ti4Red: ti4.length > 0,
    fe1Red: false,
    exemptRuns: idx.exemptRuns,
    tbRows: idx.tbRows,
    loneRows: idx.loneRows,
    cap,
    anchor: anchor === undefined ? cap : anchor,
    red: false,
    sites: idx.sites.map((s) => ({ ...s, file })),
  }
}

/* ------------------------------ --self-test ------------------------------ */

const FIXTURES = {
  // T-A 正形:5 竖线(4 列)表里,某格的长文被竖排成两行,每行只剩首尾 2 条竖线
  taRun: [
    '| id | gate | 说明 | 等级 |',
    '| -- | ---- | ---- | ---- |',
    '| 1 | aaa.mjs | 短格 | blocking |',
    '| 这一格的前半被竖排出来了, |',
    '| 后半继续另起一行 |',
    '| 2 | bbb.mjs | 又一格 | warn |',
  ].join('\n'),
  // 同一型的更长 run(4 行;完整行足够多,主竖线才仍是 5 而不是被续行反超)
  taLong: [
    '| a | b | c | d |',
    '| - | - | - | - |',
    '| x | y | z | w |',
    '| p | q | r | s |',
    '| 一段 |',
    '| 二段 |',
    '| 三段 |',
    '| 四段 |',
    '| e | f | g | h |',
  ].join('\n'),
  // TI3 阴性:整张表本来就是 2 列(主竖线=3),每一行都是 3 竖线
  twoCol: ['| 左 | 右 |', '| -- | -- |', '| a | b |'].join('\n'),
  // TI3 阴性:整张表就是 1 列(主竖线=2)—— 全是 2 竖线行也不得判(TI1 要求主竖线 ≥3)
  oneCol: ['| 单列 |', '| ---- |', '| 一 |', '| 二 |', '| 三 |'].join('\n'),
  // TI3 阴性:表外普通行带竖线(引用/列表),根本不成簇
  prose: ['> 引用里写了 A | B 这样的竖线', '', '- 列表项 `x | y`'].join('\n'),
  // TI3 阴性:4 列表里只有一行 2 竖线(连续不足)⇒ 孤立候选,不判 T-A、不折 T-B
  loneP2: ['| a | b | c | d |', '| - | - | - | - |', '| 1 | 2 | 3 | 4 |', '| 孤零零的续行 |'].join('\n'),
  // 围栏内的示例表(``` / ```` / ~~~ / 缩进围栏)不得进判据
  fenced: [
    '```md',
    '| a | b | c |',
    '| - | - | - |',
    '| x | 长文前半',
    '| 长文后半 |',
    '```',
    '~~~',
    '| p | q | r | s |',
    '| - | - | - | - |',
    '| t | u | v |',
    '~~~',
    '   ```',
    '| m | n | o |',
    '| - | - | - |',
    '| 缩进围栏里的表',
    '| 第二行 |',
    '   ```',
  ].join('\n'),
  // HTML 注释里的示例表不得进判据(注释整段遮空)
  inComment: ['<!--', '| a | b | c | d |', '| - | - | - | - |', '| 被注释掉的表', '| 第二行 |', '-->'].join('\n'),
  // 豁免:带原因的标记写在 run 的**宿主行**上必须生效
  exemptHost: [
    '| a | b | c | d |',
    '| - | - | - | - |',
    '| 1 | 首格 | <!-- table-cell-exempt: 该格就是长登记,待挪出表格 --> | 尾格 |',
    '| 竖排第二段 |',
    '| 竖排第三段 |',
  ].join('\n'),
  // 裸标记 / `*/` 与 `-->` 冒充原因,一律不放行(两行成 run,仍应判 T-A)
  bareMarker: [
    '| a | b | c | d |',
    '| - | - | - | - |',
    '| 1 | 2 | 3 | 4 |',
    '| 5 | 6 | 7 | 8 |',
    '| table-cell-exempt: */ |',
    '| <!-- table-cell-exempt: --> |',
  ].join('\n'),
  // T-B:主竖线=5 的簇里少 1 条竖线的半截行 ⇒ 只报数
  tbOnly: ['| a | b | c | d |', '| - | - | - | - |', '| 1 | 2 | 3 | 4 |', '| 1 | 2 | 3 |'].join('\n'),
}

/** 临时仓端到端:派生一律走 face-reader 的 gitRaw(绝对路径 git + windowsHide + timeout)。 */
function gitIn(root, args) {
  return gitRaw(args, root, { timeout: 120000 })
}

function selfTest() {
  let okAll = true
  const ok = (name, pass) => {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) okAll = false
  }
  // —— TI1 有牙(构造面)——
  const a = auditText(FIXTURES.taRun)
  ok(
    'TI1 构造面:mode≥3 簇内连续 2 竖线行 ≥2 ⇒ 判 T-A,并给行号与宿主行',
    a.taRuns === 1 && a.taRows === 2 && a.sites[0].hostLine === 3 && a.sites[0].line === 4,
  )
  const b = auditText(FIXTURES.taLong)
  ok('TI1 构造面:run 长 4 行时计 4 行(逐行计账 —— 只改文案换写法躲不过棘轮)', b.taRuns === 1 && b.taRows === 4)
  // —— TI3 反向锁(合法形态绝不判红)——
  ok('TI3:整表 2 列(主竖线=3)不判红', auditText(FIXTURES.twoCol).taRows === 0)
  ok('TI3:整表 1 列(全是 2 竖线行)不判红 —— "主竖线≥3"这条阈值必须真的在位', auditText(FIXTURES.oneCol).taRows === 0)
  const pr = auditText(FIXTURES.prose)
  ok('TI3:表外普通行带竖线根本不进簇', pr.clusters === 0 && pr.taRows === 0)
  const lp = auditText(FIXTURES.loneP2)
  ok('TI3:孤立一行 2 竖线(连续不足 2)⇒ 不判 T-A、不折 T-B,单列报数', lp.taRows === 0 && lp.loneRows === 1 && lp.tbRows === 0)
  // —— 结构遮罩 ——
  const fe = auditText(FIXTURES.fenced)
  ok('围栏内示例表不得判红(``` / ```lang / ~~~ / 缩进围栏四种形态都算围栏)', fe.taRows === 0 && fe.clusters === 0 && fe.fenceBlocks === 3)
  const ic = auditText(FIXTURES.inComment)
  ok('HTML 注释里的示例表不得判红(注释整段遮空)', ic.taRows === 0 && ic.clusters === 0)
  // —— 豁免通道 ——
  const ex = auditText(FIXTURES.exemptHost)
  ok('带原因的豁免写在宿主行(run 首行的紧邻上一行)生效(只认同行会让人按直觉写错而恒红)', ex.taRows === 0 && ex.exemptRuns === 1)
  const bm = auditText(FIXTURES.bareMarker)
  ok('裸标记 / `*/` / `-->` 冒充原因一律不放行(bm 仍判 T-A)', bm.taRows === 2 && bm.exemptRuns === 0)
  ok(
    'hasExemptReason 三态逐字钉住:真原因=true / 空原因=false / 闭合符冒充=false',
    hasExemptReason('table-cell-exempt: 真实原因') === true &&
      hasExemptReason('<!-- table-cell-exempt: -->') === false &&
      hasExemptReason('x table-cell-exempt: */') === false,
  )
  // —— T-B 只报数 ——
  const tb = auditText(FIXTURES.tbOnly)
  ok('T-B(比主竖线少 1 的半截行)只报数、绝不进 T-A', tb.tbRows === 1 && tb.taRows === 0)
  // —— 棘轮四向 + 三态取材(临时 git 仓端到端)——
  let scratch = null
  try {
    scratch = mkScratch('readme-table-gate-')
    mkdirSync(join(scratch, 'scripts'), { recursive: true })
    const w = (rel, content) => writeFileSync(join(scratch, rel), content, { encoding: 'utf8' })
    const baselineAbs = join(scratch, 'scripts', 'readme-table-integrity-baseline.json')
    const wBaseline = (capReadme) =>
      w(
        join('scripts', 'readme-table-integrity-baseline.json'),
        JSON.stringify(
          { $comment: '夹具基线', noteKept: { by: 'other-gate' }, taCounts: { 'README.md': capReadme } },
          null,
          2,
        ),
      )
    const gate = join(ROOT, 'scripts', 'check-readme-table-integrity.mjs')
    const runGate = (args) => {
      try {
        const out = execFileSync(process.execPath, [gate, ...args, '--root', scratch], {
          cwd: scratch,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180000,
          maxBuffer: 32 << 20,
          // 子门失败时的 stderr 是它给"人"看的失败提示(如两面旗拒绝语),在 self-test 里是预期
          // 路径 —— 显式接管 stdio,不让它混进本进程的取证输出把账面搅脏。
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { code: 0, out }
      } catch (e) {
        return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout ?? '') }
      }
    }
    const commit = (m) => gitIn(scratch, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', m])
    w('README.md', FIXTURES.taRun + '\n')
    wBaseline(2)
    gitIn(scratch, ['init', '-q', '.'])
    gitIn(scratch, ['config', 'user.email', 'gate@local'])
    gitIn(scratch, ['config', 'user.name', 'gate'])
    gitIn(scratch, ['add', 'README.md', 'scripts/readme-table-integrity-baseline.json'])
    commit('seed')
    const jHead = JSON.parse(runGate(['--json']).out)
    ok('棘轮①HEAD 现读 == 基线额度 ⇒ exit 0 且存量照报(与改动无关的恒红就是逼人跳门)', jHead.exit === 0 && jHead.perFile[0].taRows === 2)
    ok('棘轮②索引与 HEAD 相同 ⇒ --staged exit 0', JSON.parse(runGate(['--staged', '--json']).out).exit === 0)
    w('README.md', FIXTURES.taLong + '\n')
    gitIn(scratch, ['add', 'README.md'])
    const jUp = JSON.parse(runGate(['--staged', '--json']).out)
    ok(
      '棘轮③索引比 HEAD 多出 T-A ⇒ exit 1,点名文件、行数与站点(TI1 整档维与 TI4 逐行维各一条红)',
      jUp.exit === 1 &&
        jUp.reds.filter((x) => x.kind === 'TI1').length === 1 &&
        jUp.reds.some((x) => x.kind === 'TI4') &&
        jUp.reds[0].file === 'README.md' &&
        jUp.perFile[0].sites.length > 0,
    )
    w('README.md', FIXTURES.twoCol + '\n')
    gitIn(scratch, ['add', 'README.md'])
    const jDown = JSON.parse(runGate(['--staged', '--json']).out)
    ok('棘轮④索引把 T-A 清光(少于 HEAD)⇒ exit 0', jDown.exit === 0 && jDown.perFile[0].taRows === 0)
    commit('clean-readme')
    w('NEW.md', FIXTURES.taRun + '\n')
    gitIn(scratch, ['add', 'NEW.md'])
    commit('new-file')
    const jNew = JSON.parse(runGate(['--json', '--file', 'NEW.md']).out)
    ok('全量档:新文件不在基线且带 T-A ⇒ 按 cap=0 判红(基线缺失不得读成豁免)', jNew.exit === 1 && jNew.reds.length === 1)
    // TI2 --update-baseline:保留非计数键 + 只下调(README 现 HEAD=twoCol,T-A 0)
    wBaseline(5)
    gitIn(scratch, ['add', 'scripts/readme-table-integrity-baseline.json'])
    commit('cap5')
    runGate(['--update-baseline'])
    const after1 = JSON.parse(readFileSync(baselineAbs, 'utf8'))
    ok('TI2 --update-baseline:下调放行(5→0)且非计数键 noteKept 原样保留', Number(after1.taCounts['README.md']) === 0 && after1.noteKept && after1.noteKept.by === 'other-gate')
    // 只减不增:基线压到 0,HEAD 再涨回 2 ⇒ 拒绝上调,文件原地不动
    wBaseline(0)
    gitIn(scratch, ['add', 'scripts/readme-table-integrity-baseline.json'])
    commit('cap0')
    w('README.md', FIXTURES.taRun + '\n')
    gitIn(scratch, ['add', 'README.md'])
    commit('back2')
    const jUpd2 = runGate(['--update-baseline'])
    const after2 = JSON.parse(readFileSync(baselineAbs, 'utf8'))
    ok('TI2 上调拒绝:HEAD 现读 > 基线 0 时 --update-baseline 原地不动且退出码 0(拒绝的是"上调",不是整次运行)', Number(after2.taCounts['README.md']) === 0 && jUpd2.code === 0)
    ok('TI2 --staged --update-baseline 同给 ⇒ exit 2(锚点必须钉在入库态上)', runGate(['--staged', '--update-baseline']).code === 2)
    ok('两面旗同给 ⇒ exit 2(两个面互斥,取哪一面都会让另一面成为假绿)', runGate(['--staged', '--worktree']).code === 2)
    gitIn(scratch, ['rm', '--cached', '-q', '--', 'README.md'])
    const jMiss = runGate(['--staged', '--json'])
    let missOk = false
    try {
      const jj = JSON.parse(jMiss.out)
      missOk = jj.exit === 2 && jj.undetermined.length > 0
    } catch {
      missOk = jMiss.code === 2
    }
    ok('索引取不到该文件 ⇒ exit 2 且不回落 HEAD(回落就是把"没判"写成"判过了")', missOk)
    gitIn(scratch, ['add', '--', 'README.md'])
    w('EMPTY.md', '# 只有标题,没有任何表格\n')
    gitIn(scratch, ['add', 'EMPTY.md'])
    commit('empty')
    const jEmpty = JSON.parse(runGate(['--json', '--file', 'EMPTY.md']).out)
    ok('枚举到 0 个表格簇 ⇒ "无法判定" exit 2,绝不记绿', jEmpty.exit === 2 && jEmpty.emptyScan === true)
    ok('--json 输出可 JSON.parse(说明性文字不得混进 stdout)', (() => {
      const t = JSON.parse(runGate(['--json']).out)
      return t && t.gate === 'readme-table-integrity'
    })())
  } catch (e) {
    ok(`临时仓端到端整体跑通(异常:${String((e && e.message) || e).slice(0, 200)})`, false)
  } finally {
    if (scratch) rmScratch(scratch)
  }
  // —— FE1 / TI4 / 退回档:第二座临时仓(与上一块的 README 状态互不污染)——
  let s2 = null
  try {
    s2 = mkScratch('readme-table-gate2-')
    mkdirSync(join(s2, 'scripts'), { recursive: true })
    const w2 = (rel, content) => writeFileSync(join(s2, rel), content, { encoding: 'utf8' })
    const gate2 = join(ROOT, 'scripts', 'check-readme-table-integrity.mjs')
    const run2 = (args) => {
      try {
        return {
          code: 0,
          out: execFileSync(process.execPath, [gate2, ...args, '--root', s2], {
            cwd: s2,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 180000,
            maxBuffer: 32 << 20,
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
        }
      } catch (e) {
        return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout ?? '') }
      }
    }
    const commit2 = (m) => gitIn(s2, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', m])
    gitIn(s2, ['init', '-q', '.'])
    gitIn(s2, ['config', 'user.email', 'gate@local'])
    gitIn(s2, ['config', 'user.name', 'gate'])
    // README 先放一份"围栏齐备 + 表格完整"的干净底,好让 FE1/TI4 各自只在被改动的那一侧响
    const cleanReadme = ['| a | b | c |', '| - | - | - |', '| 1 | 2 | 3 |', '', '```bash', 'echo 开了也关了', '```', ''].join('\n')
    w2('README.md', cleanReadme)
    w2(join('scripts', 'readme-table-integrity-baseline.json'), JSON.stringify({ taCounts: { 'README.md': 0 } }, null, 2))
    gitIn(s2, ['add', 'README.md', 'scripts/readme-table-integrity-baseline.json'])
    commit2('readme-clean')
    // —— FE1 正反成对 ——
    const openFence = ['| a | b | c |', '| - | - | - |', '| 1 | 2 | 3 |', '', '```bash', 'echo 这道栏没人关', ''].join('\n')
    w2('README.md', openFence)
    gitIn(s2, ['add', 'README.md'])
    commit2('fe1-open')
    const jFe1 = JSON.parse(run2(['--json']).out)
    ok(
      'FE1:代码围栏未闭合 ⇒ 全量档判红并点名开栏行(它不落在任何表格簇上 —— TI1 结构上看不见这一型)',
      jFe1.exit === 1 && jFe1.reds.some((x) => x.kind === 'FE1' && x.line === 5) && jFe1.perFile[0].unclosedFenceAt === 5,
    )
    const closedFence = ['| a | b | c |', '| - | - | - |', '| 1 | 2 | 3 |', '', '```bash', 'echo 这道栏有人关', '```', ''].join('\n')
    w2('README.md', closedFence)
    gitIn(s2, ['add', 'README.md'])
    commit2('fe1-closed')
    const jFe1b = JSON.parse(run2(['--json']).out)
    ok('FE1 反向对照:同一篇补上闭栏 ⇒ exit 0 且 unclosedFenceAt 归 null(红的是判据,不是一台恒红门)', jFe1b.exit === 0 && jFe1b.perFile[0].unclosedFenceAt === null)
    // —— 退回档:--staged 而本轮没碰任何在审文档 ⇒ 不得判"无法判定" ——
    const jRetreat = JSON.parse(run2(['--staged', '--json']).out)
    ok(
      '--staged 本轮未触及在审文档 ⇒ 退回 HEAD 全量档 + retreated 标记 + exit 0(判"无法判定"就是替每一次无关提交挡路)',
      jRetreat.retreated === true &&
        jRetreat.exit === 0 &&
        jRetreat.judgedFace === 'head' &&
        jRetreat.notes.some((n) => /退回 HEAD/.test(n)),
    )
    // —— TI4:孤立单行碎表(TI1 整档维放过的那一型)落在改动行上必须判红 ——
    const hostPlain = '| 1 | 2 | 3 |'
    const hostMarked = '| 1 | 2 | 3 <!-- table-cell-exempt: 下一格确实是一行登记，待挪出表格 --> |'
    const agentsBase = ['# AGENTS', '', '| a | b | c |', '| - | - | - |', hostPlain, ''].join('\n')
    const agentsBad = ['# AGENTS', '', '| a | b | c |', '| - | - | - |', hostPlain, '| 没带出口的竖排续行 |', ''].join('\n')
    const agentsExempt = ['# AGENTS', '', '| a | b | c |', '| - | - | - |', hostMarked, '| 带豁免的竖排续行 |', ''].join('\n')
    w2('AGENTS.md', agentsBase)
    gitIn(s2, ['add', 'AGENTS.md'])
    commit2('agents-base')
    w2('AGENTS.md', agentsBad)
    gitIn(s2, ['add', 'AGENTS.md'])
    const jTi4 = JSON.parse(run2(['--staged', '--json']).out)
    const ti4 = jTi4.reds.find((x) => x.kind === 'TI4')
    ok(
      'TI4:新增的一行竖排续行(孤立、不成 run)⇒ --staged 判红并点名行号(同型的 HEAD 存量整档维仍只报数,不追溯)',
      jTi4.exit === 1 && Boolean(ti4) && ti4.file === 'AGENTS.md' && ti4.lines.includes(6) && jTi4.perFile.some((p) => p.file === 'AGENTS.md' && p.taRows === 0 && p.ti1InScope === false),
    )
    w2('AGENTS.md', agentsExempt)
    gitIn(s2, ['add', 'AGENTS.md'])
    const jTi4e = JSON.parse(run2(['--staged', '--json']).out)
    ok(
      'TI4 豁免通道与 TI1 共用同一条(标记写在宿主行必须生效)⇒ 同一形状带原因即不判红,且如实计数',
      jTi4e.exit === 0 && jTi4e.perFile.some((p) => p.file === 'AGENTS.md' && p.ti4.length === 0 && p.ti4ExemptRows === 1),
    )
    // "本轮未触及"与"本轮把它删了"是两件事:前者只报名,后者仍是未判定(上方索引取不到那例已钉)
    const jUntouched = JSON.parse(run2(['--staged', '--json']).out)
    ok(
      '只改 AGENTS 时 README 走"本轮未触及"分支:报名 + 仍量 FE1,不判"无法判定"也不静默当作已通过',
      jUntouched.perFile.some((p) => p.file === 'README.md' && p.untouchedThisRound === true) &&
        jUntouched.notes.some((n) => /本轮暂存区未触及/.test(n)),
    )
  } catch (e) {
    ok(`FE1/TI4 端到端整体跑通(异常:${String((e && e.message) || e).slice(0, 200)})`, false)
  } finally {
    if (s2) rmScratch(s2)
  }
  // —— diff 解析器自身的三态(构造面,不靠仓库瞬时状态)——
  const pGood = parseAddedLineRanges(['diff --git a/x.md b/x.md', 'index 111..222 100644', '--- a/x.md', '+++ b/x.md', '@@ -5,0 +6,2 @@', '+a', '+b'].join('\n'))
  ok('parseAddedLineRanges:新式与旧式 hunk 头都取**新侧**行号(6,7)', pGood instanceof Set && pGood.size === 2 && pGood.has(6) && pGood.has(7))
  const pEmpty = parseAddedLineRanges('')
  ok('parseAddedLineRanges:空输出 = 真没有改动 ⇒ 空集(不是"未判定")', pEmpty instanceof Set && pEmpty.size === 0)
  ok('parseAddedLineRanges:出现 @@ 却解不出行号 ⇒ null = 判"未判定"(把没看清当成没改行就是给 TI4 发合格证)', parseAddedLineRanges('@@ 完全不像 hunk @@\n') === null)
  ok('parseAddedLineRanges:省略 ",N" 的单行 hunk 按 1 行算(新侧 +7 @@)', (() => { const s = parseAddedLineRanges('@@ -3 +7 @@'); return s instanceof Set && s.size === 1 && s.has(7) })())
  // —— 真仓现读(阳性对照)——
  try {
    const real = analyze('head', ROOT, DEFAULT_TARGETS)
    const first = real.perFile[0]
    if (first && first.taRows > 0) {
      ok(
        `真仓 HEAD 阳性对照:看得见存量并点名站点(现读 T-A ${first.taRows} 行 / ${first.taRuns} run,首行 ${first.sites[0]?.line})`,
        first.sites.length > 0 && first.sites[0].file === 'README.md' && first.sites[0].line > 0,
      )
    } else if (first) {
      console.log(`ℹ️ 真仓现读 T-A 存量为 ${first.taRows}(判据有牙由上方临时仓端到端证明;此格不伪造阳性对照)`)
    }
    ok('真仓 HEAD 全量档不得因存量判红(锚点=基线;判红=与提交无关的恒红门)', real.exit !== 1)
    ok('真仓 README 确有表格簇(枚举 0 簇 = 判据失明,不是"没有破损")', first ? first.clusters > 0 : false)
    const agentsEnt = real.perFile.find((p) => p.file === 'AGENTS.md')
    ok(
      '真仓 AGENTS 已进在审面(FE1 量得到 = 现读未闭合 0;TI1 依设计不在射程,其 T-A 存量只报数)',
      Boolean(agentsEnt) && agentsEnt.unclosedFenceAt === null && agentsEnt.ti1InScope === false && agentsEnt.clusters > 0,
    )
    console.log(`ℹ️ 真仓 AGENTS 现读 T-A 存量 ${agentsEnt ? agentsEnt.taRows : '未取到'} 行 / T-A 形状行合计 ${agentsEnt ? agentsEnt.shortRows : '未取到'} —— 只报数,不清账也不代收口费`)
    ok('analyze 结果整体可 JSON 往返', (() => {
      const j = JSON.parse(JSON.stringify(real))
      return j.gate === 'readme-table-integrity' && Array.isArray(j.perFile)
    })())
  } catch (e) {
    ok(`真仓现读整体跑通(异常:${String((e && e.message) || e).slice(0, 200)})`, false)
  }
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

/* ------------------------------- CLI ------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法: node scripts/check-readme-table-integrity.mjs [--staged|--worktree|--json|--self-test|--update-baseline|--file <path>...|--root <dir>]',
    )
    process.exitCode = 0
    return
  }
  if (argv.includes('--self-test')) {
    selfTest()
    return
  }
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  try {
    assertRepoRoot(root, 'check-readme-table-integrity')
  } catch (e) {
    console.error(`❌ 无法判定:${e.message}`)
    process.exitCode = 2
    return
  }
  const fi = argv.indexOf('--file')
  // `--file` 是变长参数:必须停在下一个 `--` 旗标处 —— 否则 `--file X --root <dir>` 的
  // 根路径会被吞成第二个目标(端到端夹具就是这么暴露的:绝对路径被报"取不到内容")。
  const list = []
  if (fi >= 0) {
    for (let k = fi + 1; k < argv.length; k++) {
      const a = String(argv[k])
      if (a.startsWith('--')) break
      list.push(a)
    }
  }
  const targets = list.length ? list : DEFAULT_TARGETS
  const update = argv.includes('--update-baseline')
  const r = analyze(picked.face, root, targets, { updateBaseline: update, explicitTargets: list.length > 0 })
  if (update) {
    if (r.exit === 2 || r.undetermined.length) {
      console.error('❌ 基线未刷新(本面存在"无法判定"项,拒绝写出部分结论):')
      for (const u of r.undetermined) console.error(`   - ${u.file || '(全局)'}:${u.reason}`)
      process.exitCode = 2
      return
    }
    writeFileSync(join(root, BASELINE_REL), JSON.stringify(r.wouldWrite, null, 2) + '\n', { encoding: 'utf8' })
    console.log(`✅ 基线已按 HEAD 写回(只下调;非计数键原样保留):${JSON.stringify(r.wouldWrite.taCounts)}`)
    for (const n of r.baselineNotes) console.log(`   · ${n}`)
    process.exitCode = 0
    return
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[readme-table-integrity] 面:${r.face}${r.retreated ? '(由 --staged 退回,本轮未触及在审文档)' : ''} · 在审文档 ${r.targets.join(' ')} · TI1 射程 ${r.targets.filter((f) => explicitOrTi1(f, list.length > 0)).join(' ')}`,
  )
  for (const f of r.perFile) {
    console.log(
      `  ${f.file}: 表格簇 ${f.clusters}(整段跳过 围栏 ${f.fenceBlocks} / 注释 ${f.commentSpans})` +
        ` · FE1 未闭合围栏 ${f.unclosedFenceAt ? `开栏在第 ${f.unclosedFenceAt} 行 ⇒ 判红` : '0'}` +
        ` · TI1 T-A run ${f.taRuns} / 行 ${f.taRows}` +
        `${f.ti1InScope ? `(锚点:${r.judgedFace === 'staged' ? `HEAD 自身 ${f.headTaRows}` : `基线 ${f.cap}`})` : '(不在 TI1 射程 ⇒ 存量只报数)'}` +
        ` · T-A 形状行合计 ${f.shortRows}(豁免 ${f.exemptShortRows})` +
        ` · TI4 本次改动的碎表行 ${f.ti4.length}${f.ti4ExemptRows ? `(另有带豁免 ${f.ti4ExemptRows})` : ''}` +
        ` · 豁免 run ${f.exemptRuns} · T-B 半截行 ${f.tbRows}(这是 T-B,不属于本型,只报数)· 孤立 2 竖线候选 ${f.loneRows}(整档维不判;落在改动行上由 TI4 判)`,
    )
    for (const s of f.ti4) console.log(`     TI4 站点 ${f.file}:${s.line}(簇起 ${s.clusterStart},主竖线 ${s.mode})`)
  }
  const fe1 = r.reds.filter((x) => x.kind === 'FE1')
  const ti1 = r.reds.filter((x) => x.kind === 'TI1')
  const ti4 = r.reds.filter((x) => x.kind === 'TI4')
  if (ti1.length) {
    console.log('❌ TI1 违规(超出锚点 —— 本次改动把竖排续行加回来了):')
    for (const f of r.perFile.filter((x) => x.red)) {
      for (const s of f.sites) console.log(`   - ${s.file}:${s.line}(宿主行 ${s.hostLine},簇起 ${s.clusterStart},主竖线 ${s.mode})`)
    }
  }
  if (ti4.length) {
    console.log('❌ TI4 违规(本次新增/改动的行里有 T-A 形状的碎表行,含孤立单行):')
    for (const x of ti4) for (const line of x.lines) console.log(`   - ${x.file}:${line}`)
  }
  if (fe1.length) {
    console.log('❌ FE1 违规(代码围栏未闭合,整篇后半会被当代码渲染;无豁免通道):')
    for (const x of fe1) console.log(`   - ${x.file}:开栏在第 ${x.line} 行,到文件尾没有闭栏`)
  }
  if (r.reds.length) {
    console.log('   修复出口(默认 --dry-run 零写盘;归并前后自证字符多重集守恒才允许 --apply):')
    console.log(`     ${r.fixHint}`)
    console.log('   行内出口:<!-- table-cell-exempt: <原因> --> 写在宿主行或该 run 内任一行(须带原因;FE1 无出口)')
  } else if (r.exit === 0) {
    console.log(
      '✅ FE1 未闭合围栏 0 · TI1 无新增 · TI4 改动行无碎表。T-B 半截行是"只报数"族(要逐案判语义)—— 现数以本行为准,勿引用文档旧数。',
    )
  }
  for (const n of r.notes) console.log(`ℹ️ ${n}`)
  if (r.baselineMissingKeys.length)
    console.log(`⚠️ 目标不在基线里(TI1 在射程时按 cap=0 判红;登记须人工写键,--update-baseline 不代登记):${r.baselineMissingKeys.join(' ')}`)
  for (const u of r.undetermined) console.log(`❌ 无法判定:${u.file || '(全局)'} —— ${u.reason}`)
  process.exitCode = r.exit
}

/** TI1 射程的判定:显式 --file 点名的文件在射程内,否则只认 TI1_TARGETS(与 analyze 同一份名单)。 */
function explicitOrTi1(f, explicit) {
  return explicit || TI1_TARGETS.includes(f)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  hasExemptReason,
  countPipes,
  maskMarkdownStructure,
  findClusters,
  clusterMode,
  classifyCluster,
  auditText,
  loadBaseline,
  mergeBaseline,
  parseAddedLineRanges,
  stagedTouchedPaths,
  analyze,
  fileEntry,
  FIXTURES,
  BASELINE_REL,
  DEFAULT_TARGETS,
  DOC_TARGETS,
  TI1_TARGETS,
  MIN_RUN_LINES,
  MIN_MODE_PIPES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
