// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账「搬运感知」判据 —— 活文档行 union 的唯一新增维度(2026-09-28 立)。
 *
 * 它要根治的是一条**结构性互咬**,不是假设(2026-09-28 实测):
 *  - `scripts/archive-completed-tasks.mjs` 把标题带 ✅ 的已完成条目**整块**搬进
 *    `.ihui-agent/archive/PROJECT_PLAN_*.md`,并在台账原位置留一行 `<!-- 已归档(…) -->` 占位;
 *  - `scripts/union-converge.mjs` 对活文档用的判据是"保住对侧相对基底新增的每一行"
 *    (动机是对的 —— AGENTS §12 记过一整串"滞后台账副本把别人已入库的行整批写回")。
 *  并行会话长期持有**未提交的滞后台账副本**,那份副本里还带着已被搬走的正文行;它一旦提交,
 *  这些行相对归并基底就成了"对侧新增",于是行 union 把它们整批按回台账。
 *  实测那一枚真合并(`c9983f29` ∪ `761c0bc9`):台账从本侧 7,523 行被带回 **16,494 行**
 *  (带回 8,971 行),面上已勾选行由 0 回到 2,410 —— 于是"完成即归档"只能**瞬时清零、无法收敛**,
 *  每收敛一次就得再搬一轮。
 *
 * 新增判据(只这一条):**某一行如果在基准面(本侧)已被一条 `已归档(…)` 占位注释代表,
 * 就不得再从对侧取回它。** "已被代表"必须可机判且不靠 fuzzy:
 *  1. 占位行点名的就是条目标题 —— 解析式与 `archive-completed-tasks.mjs:placeholderLine()` **同形**
 *     (该函数产出的真实形态是 `已归档(<日期>:<标题前 60 字>[,随块带走的归并落账注记: …],完整内容在 <路径> -->`,
 *     日期后面**没有**右括号;AGENTS 散文里写的 `已归档(日期):标题` 是另一种历史形态,两种都认)。
 *  2. "被搬走的正文行属于那个条目"的归属关系**复用归档器自己的块解析**
 *     (`./plan-task-headings.mjs` 的 `parseCompletedTaskBlocks`) —— 在归并器里再抄一份
 *     "什么算一个已完成条目"正是本仓记过最多次的失效型(两处各写一遍必漂移)。
 *  3. 该块必须**有一段 ≥2 个非空行的正文逐行连续地出现在**占位点名的那份归档文件里。
 *     为什么按段而不是整块(实测逼出来的,不是偷懒):归档器 2026-09-28 又长了**子弹级**那一维,
 *     块内的 `- [x]` 行会被**在归档件里就地换成占位**,于是"整块逐字连续"对真实数据几乎永不成立
 *     —— 真仓那一枚互咬合并上实测:81 个配对块只有 54 个能整块命中,剩下 27 块(含 1,089 行、
 *     878 行、771 行那三块最大的)一次都判不出。按段命中同时保住两件事:
 *     **一条对侧新写的行永远不可能落进"与归档件逐行相同"的段里** —— 它自己就是断点;
 *     块里没被段覆盖的行一律照旧取回。
 *     由此推出本模块对**子弹级归档**的实际覆盖面:块内的 `- [x]` 行在归档件里已换成占位,
 *     所以那些行**匹配不上 ⇒ 仍会被带回**(实测这一型占真仓带回量的绝大部分)。任务书只许复用
 *     `parseCompletedTaskBlocks` 那一份块解析,而子弹级段住在归档器的 `collectCompletedBullets`
 *     里(不在 `plan-task-headings.mjs`),把它接进来要在本模块重抄一份块定义 —— 那是本仓禁的
 *     第二真相。所以那一格**如实登记为未收口**,不静默读成"已全量拦下"。
 *
 * 失效方向(硬约束,写在代码里而不仅是注释):**这条判据只允许"多带一行回来",绝不允许"少带一行"。**
 * 少带 = 丢别人新写的行,比互咬更严重。所以以下每一型都退回"照旧取回",并逐条报出原因:
 *  - 本侧没有对应占位注释 / 占位标题与对侧块标题(按归档器的 60 字截断)不同形;
 *  - 占位指向的归档文件在被审面上取不到、为空、或路径写成通配(`PROJECT_PLAN_*.md`)—— 那是
 *    **坏指针**,不构成"内容已被代表"的证据;
 *  - 块边界与文本对不上(解析出的标题行与该行的实际内容不等)—— 判不出,交回原判据;
 *  - 块内容在归档件里不连续(被就地改写过)—— 整块取回;
 *  - 空行一律**不参与**抑制:它们在多重集里位置无关,少带一行空白可能连带挤掉别人的排版,
 *    而"多带一行空白"没有任何代价。
 *
 * 覆盖面上限(如实登记,别读成"已全量收口"):归档器 2026-09-28 又补了**子弹级**
 * (`- [x]` 连续段)那一维(`collectCompletedBullets`),它不在 `parseCompletedTaskBlocks` 的
 * 条目粒度里,而本模块按任务书只许用那一份块解析 —— 所以子弹级被搬走的行**仍会被带回**。
 * 那一格的修法要么扩块解析、要么让本模块也走 `collectCompletedBullets`,都属另一票。
 *
 * 本模块是纯函数库:不读盘、不碰 git、无副作用。取材面纪律(HEAD/索引/工作树、按被审 rev 读
 * 归档件)由调用方 `scripts/union-converge.mjs` 经 `scripts/lib/face-reader.mjs` 保证。
 */
import { parseCompletedTaskBlocks } from './plan-task-headings.mjs'

/**
 * 归档器写占位时对标题文本的截断长度(`placeholderLine` 里的 `titleText.slice(0, 60)`)。
 * 两侧必须同值 —— 比宽了会把"前 60 字相同、后文不同"的两个条目并成一个(少带),
 * 比窄了则配不上对(多带,安全但失效)。由镜像测试拿归档器真产出的占位行做往返锁。
 */
export const PLACEHOLDER_TITLE_TRUNC = 60

/** 占位前缀:兼容本器真实产出 `已归档(<日期>:标题` 与 AGENTS 散文的历史式 `已归档(<日期>):标题`。 */
const OPEN_RE = /^(\s*)<!--\s*已归档\((\d{4}-\d{2}-\d{2})\)?:/
/** 归档器固定写的那一段分隔(`placeholderLine` 的 `,完整内容在 `)。标题里本就带中文逗号,所以只能按**最后**一处切。 */
const ARCHIVE_SEG = ',完整内容在'
/** 随块带走的归并落账注记段(`placeholderLine` 的 `,随块带走的归并落账注记: `),必须剥掉才是纯标题。 */
const NOTES_SEG = ',随块带走的归并落账注记:'
/** 归档件名的通配形态(13c 亦按"通配不点名"处理):它不指向任何一份可核验的内容 ⇒ 坏指针。 */
const WILD_RE = /[*?[\]{}]/

/**
 * 一段命中要算"这块内容确实已被归档"的证据,至少要含几个**非空**行。
 * 取 2:台账里单行同文成百(空行、`---`、重复登记行),一行相同不足以定性;而"对侧新写的一行"
 * 永远会把段断开,所以两段式命中不可能把一条新登记整条吞掉 —— 门槛再高就没有覆盖率了。
 */
export const MIN_RUN_LINES = 2

/** 与归档器 `trimTrailingEmpty` 同语义:块尾空行不算正文(归档件里也没有它们)。 */
function trimTrailingEmpty(lines) {
  const out = [...lines]
  while (out.length > 1 && String(out[out.length - 1]).trim() === '') out.pop()
  return out
}

/** 标题键:与占位写入时同一把截断尺(归档器对条目级/子弹级都取 `titleText` 再截 60)。 */
export function placeholderKeyOfTitle(titleText) {
  return String(titleText ?? '').trim().slice(0, PLACEHOLDER_TITLE_TRUNC)
}

/**
 * 解析文本里的全部 `已归档(…) ->` 占位行(整行必须是一条 HTML 注释;行内多处占位不判 ——
 * 归档器一行只写一条,而 13c 的 A4 也按整行取)。
 * @returns {{title:string, archivePath:string|null, date:string, resolvable:boolean, whyNot:string, line:string, lineNo:number}[]}
 */
export function parseArchivePlaceholders(text) {
  const out = []
  if (!text) return out
  const lines = String(text).split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!/<!--\s*已归档/.test(line)) continue
    const m = OPEN_RE.exec(line)
    if (!m) {
      out.push({
        title: '',
        archivePath: null,
        date: '',
        resolvable: false,
        whyNot: '占位形态解不出「已归档(<日期>:…」—— 不当代表、照旧取回',
        line,
        lineNo: i + 1,
      })
      continue
    }
    const start = m[0].length
    const end = line.lastIndexOf(ARCHIVE_SEG)
    if (end <= start) {
      out.push({
        title: line.slice(start).replace(/-->\s*$/, '').trim(),
        archivePath: null,
        date: m[2],
        resolvable: false,
        whyNot: `占位没有「${ARCHIVE_SEG}」那一段(坏指针)⇒ 照旧取回`,
        line,
        lineNo: i + 1,
      })
      continue
    }
    let titlePart = line.slice(start, end).trim()
    const nIdx = titlePart.indexOf(NOTES_SEG)
    if (nIdx >= 0) titlePart = titlePart.slice(0, nIdx).trim()
    const archivePath = line.slice(end + ARCHIVE_SEG.length).replace(/-->\s*$/, '').trim()
    let whyNot = ''
    if (!titlePart) whyNot = '占位里标题为空 ⇒ 无法与条目配对,照旧取回'
    else if (!archivePath) whyNot = `占位没点名归档文件 ⇒ 无内容证据,照旧取回`
    else if (WILD_RE.test(archivePath))
      whyNot = `归档件写成通配(${archivePath})⇒ 不指向可核验内容,照旧取回`
    out.push({
      title: titlePart,
      archivePath: archivePath || null,
      date: m[2],
      resolvable: !whyNot,
      whyNot,
      line,
      lineNo: i + 1,
    })
  }
  return out
}

/**
 * 块内**最长连续命中**切分:把对侧那个块的正文行切成若干段,每段必须**逐行、同序、连续**地
 * 出现在被点名的归档件里。为什么按段而不是整块判连续(2026-09-28 现仓实测逼出来的):
 * 归档器 2026-09-28 又长了**子弹级**那一维,会把块内的 `- [x]` 行**在归档件里就地换成占位**,
 * 于是"整块逐行连续"对真实数据几乎永不成立(实测 81 个配对块里只有 54 个能整块命中,
 * 剩下 27 块一次判不出,而它们合计正是最该拦的数千行)。按段命中既拦得住,又不放低证据门槛:
 * **一条对侧新写的行永远不可能落进"与归档件逐行相同"的段里** —— 它自己就是断点。
 * 一段要算证据,至少含 `MIN_RUN_LINES` 个非空行(单行相同不足以定性:台账里同文行成百)。
 * @param {string[]} body 块正文(原始行)
 * @param {string[]} hay  归档件正文(已按行切好)
 * @param {Map<string,number[]>} [index] 归档件行索引(可复用,避免每块重建)
 * @returns {{covered:boolean[], runs:Array<{start:number,len:number}>}}
 */
export function matchRuns(body, hay, index, { minRunLines = MIN_RUN_LINES, maxCandidates = 24, maxProbe = 400 } = {}) {
  const covered = new Array(body.length).fill(false)
  const runs = []
  const idx = index || indexLines(hay)
  let i = 0
  while (i < body.length) {
    const key = stripCr(body[i])
    const at = idx.get(key)
    let best = 0
    if (at && at.length) {
      for (let c = 0; c < Math.min(at.length, maxCandidates); c++) {
        const start = at[c]
        let k = 1
        while (
          k < maxProbe &&
          i + k < body.length &&
          start + k < hay.length &&
          stripCr(body[i + k]) === hay[start + k]
        )
          k++
        if (k > best) best = k
        if (best >= body.length - i) break
      }
    }
    const nonBlank = body.slice(i, i + best).filter((l) => stripCr(l).trim() !== '').length
    if (best >= 1 && nonBlank >= minRunLines) {
      for (let j = i; j < i + best; j++) covered[j] = true
      runs.push({ start: i, len: best })
      i += best
      continue
    }
    i += 1
  }
  return { covered, runs }
}

/** 归档件行索引:行文本 → 出现位置清单(只给匹配用,不做语义判断)。 */
export function indexLines(hay) {
  const m = new Map()
  for (let i = 0; i < hay.length; i++) {
    const k = hay[i]
    const a = m.get(k)
    if (a) a.push(i)
    else m.set(k, [i])
  }
  return m
}

function stripCr(l) {
  const s = String(l)
  return s.endsWith('\r') ? s.slice(0, -1) : s
}

/** 块在 theirs 文本里的原始行(带 \r 原样 —— 抑制键必须与 `counter()` 的键同形,否则静默不生效)。 */
function blockRawLines(theirsLines, block) {
  const got = []
  for (let i = block.startLine; i <= block.endLine && i < theirsLines.length; i++) got.push(theirsLines[i])
  return got
}

/**
 * 本侧占位 × 对侧条目块 ⇒ 需要读哪些归档件(去重)。调用方按这个清单**一次** `catBatch` 读满,
 * 再喂给 `archivedLineSuppressions`(逐路径各派一次 git 会在这份台账上打出几百次进程)。
 * @returns {Set<string>}
 */
export function collectReferencedArchives(oursText, theirsText) {
  const paths = new Set()
  const blocks = parseCompletedTaskBlocks(theirsText)
  if (blocks.length === 0) return paths
  const keys = new Set(blocks.map((b) => placeholderKeyOfTitle(b.titleText)))
  for (const ph of parseArchivePlaceholders(oursText)) {
    if (ph.resolvable && keys.has(ph.title)) paths.add(ph.archivePath)
  }
  return paths
}

/**
 * 主入口:算出"因搬运感知而**不得取回**"的行多重集。
 * @param {object} p
 * @param {string} p.oursText    基准面(本侧)的活文档正文 —— 占位注释的出处
 * @param {string} p.theirsText  对侧正文 —— 条目块的出处
 * @param {(path:string)=>string|null} p.archiveOf 归档件取内容的出口(取不到给 null,不得抛)
 * @returns {{suppress:Map<string,number>, suppressedBlocks:Array, keptBlocks:Array,
 *   undetermined:Array, stats:{blocksMatched:number,suppressedLines:number,keptLines:number,undeterminedCount:number}}}
 */
export function archivedLineSuppressions({ oursText, theirsText, archiveOf }) {
  const stats = { blocksMatched: 0, suppressedLines: 0, keptLines: 0, undeterminedCount: 0 }
  const suppress = new Map()
  const suppressedBlocks = []
  const keptBlocks = []
  const undetermined = []
  const byTitle = new Map()
  for (const ph of parseArchivePlaceholders(oursText)) {
    if (!ph.title) continue
    if (!byTitle.has(ph.title)) byTitle.set(ph.title, { paths: [], broken: [] })
    const e = byTitle.get(ph.title)
    if (ph.resolvable) {
      if (!e.paths.includes(ph.archivePath)) e.paths.push(ph.archivePath)
    } else if (!e.broken.includes(ph.whyNot)) e.broken.push(ph.whyNot)
  }
  if (byTitle.size === 0) return { suppress, suppressedBlocks, keptBlocks, undetermined, stats }

  const theirsLines = String(theirsText).split('\n')
  /** 归档件行索引按路径复用(同一份 8.6 MB 归档件会被几十个块各扫一遍,不缓存就是几十倍工时)。 */
  const lineIdx = new Map()
  for (const block of parseCompletedTaskBlocks(theirsText)) {
    const key = placeholderKeyOfTitle(block.titleText)
    const hit = byTitle.get(key)
    if (!hit) continue
    stats.blocksMatched++
    const body = trimTrailingEmpty(blockRawLines(theirsLines, block))
    // 边界自证:块首行必须就是那条标题行。对不上 ⇒ 行号面与内容面不同形 ⇒ 判不出 ⇒ 照旧取回。
    const headRaw = theirsLines[block.startLine]
    if (headRaw === undefined || stripCr(headRaw) !== String(block.title)) {
      undetermined.push({
        title: key,
        paths: hit.paths.slice(),
        reason: `块边界与文本对不上(startLine=${block.startLine} 的内容不是该条标题)⇒ 判不出,照旧取回`,
      })
      stats.undeterminedCount++
      continue
    }
    if (hit.paths.length === 0) {
      undetermined.push({ title: key, paths: [], reason: hit.broken.join(' / ') || '占位在,但没有可核验的归档件' })
      stats.undeterminedCount++
      continue
    }
    let archiveText = null
    let usedPath = null
    let bestCand = null
    let bestCount = -1
    const misses = []
    for (const p of hit.paths) {
      let t = null
      try {
        t = archiveOf(p)
      } catch (err) {
        t = null
        misses.push(`${p}:取材异常 ${String(err && err.message ? err.message : err).split('\n')[0].slice(0, 90)}`)
        continue
      }
      if (typeof t !== 'string' || t.length === 0) {
        misses.push(`${p}:在被审面上取不到或为空(坏指针)`)
        continue
      }
      const hay = t.split(/\r?\n/)
      if (!lineIdx.has(p)) lineIdx.set(p, indexLines(hay))
      const cand = matchRuns(body, hay, lineIdx.get(p))
      const n = cand.covered.filter(Boolean).length
      if (n > bestCount) {
        bestCount = n
        bestCand = cand
        archiveText = t
        usedPath = p
      }
    }
    if (archiveText === null) {
      undetermined.push({
        title: key,
        paths: hit.paths.slice(),
        reason: [...misses, ...hit.broken].join(' / ') || '归档件无从取材',
      })
      stats.undeterminedCount++
      continue // 内容证据拿不到 ⇒ 绝不当"已归档",照旧取回
    }
    if (bestCount === 0) {
      // 一块都对不上 ⇒ 这块在占位之后被就地改写过(或根本不是那份归档内容):整块照旧取回。
      const n = body.filter((l) => stripCr(l).trim() !== '').length
      keptBlocks.push({
        title: key,
        archivePath: usedPath,
        lines: n,
        covered: 0,
        reason: '块内容与归档件不逐行连续(占位之后被就地改写)⇒ 整块照旧取回',
      })
      stats.keptLines += n
      continue
    }
    const lines = []
    for (let j = 0; j < body.length; j++) {
      if (!bestCand.covered[j]) continue
      const raw = body[j]
      if (stripCr(raw).trim() === '') continue // 空行不参与抑制(见模块头注)
      suppress.set(raw, (suppress.get(raw) || 0) + 1)
      lines.push(raw)
    }
    stats.suppressedLines += lines.length
    suppressedBlocks.push({
      title: key,
      archivePath: usedPath,
      suppressed: lines.length,
      keptUncovered: body.filter((_, j) => !bestCand.covered[j] && stripCr(_).trim() !== '').length,
      lines,
    })
    stats.keptLines += body.filter((l, j) => !bestCand.covered[j] && stripCr(l).trim() !== '').length
  }
  return { suppress, suppressedBlocks, keptBlocks, undetermined, stats }
}

/**
 * 把抑制表落到"对侧行多重集"上:`theirs 有效重数 = max(0, 对侧重数 − 被代表的重数)`。
 * 只减对侧的贡献,**绝不动本侧重数** —— 本侧自己的行永远在结果里(否则就是删本侧内容)。
 */
export function subtractSuppressed(theirsCounter, suppress) {
  if (!suppress || suppress.size === 0) return theirsCounter
  const out = new Map()
  for (const [l, n] of theirsCounter) out.set(l, Math.max(0, n - (suppress.get(l) || 0)))
  return out
}

/** 被抑制掉的行的**逐条清单**(报告用;调用方决定打印多少)。按块给出,读的人能核对到具体条目。 */
export function suppressionRoster(result) {
  return (result?.suppressedBlocks || []).map((b) => ({
    title: b.title,
    archivePath: b.archivePath,
    count: b.suppressed,
    lines: b.lines,
  }))
}

export const __test__ = {
  PLACEHOLDER_TITLE_TRUNC,
  MIN_RUN_LINES,
  OPEN_RE,
  ARCHIVE_SEG,
  NOTES_SEG,
  WILD_RE,
  placeholderKeyOfTitle,
  parseArchivePlaceholders,
  matchRuns,
  indexLines,
  collectReferencedArchives,
  archivedLineSuppressions,
  subtractSuppressed,
  suppressionRoster,
  trimTrailingEmpty,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
