// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「本侧已按合法出路把这几行**移入 archive**」的凭据判据 —— 唯一实现(2026-10-25 立,守门 207 第二刀①)。
 *
 * 立因(实测,不是推断):AGENTS 的重复登记副本按 §1 的合法出路「整区逐字移入
 * `.ihui-agent/archive/` + 原位留指针」搬走后,归并侧的两张尺子都不认识这个处置:
 *   · `merge-live-doc --apply` 把有意移出的 34 行整段判"真丢失"并插回(实测 407 → 442 行);
 *   · `union-converge` 的 `liveDocExpectedCounts` 把对侧旧基线里那份逐字同行读成
 *     "对侧相对基底新增"⇒ 再补回一份。
 * ⇒ 20KB 的清偿成果一轮就被吞回去,而账面上两道工具都是绿的。失效方向是安静,所以必须堵在判据源头。
 *
 * 为什么判据住在这里而不是各消费点各写一份(§0.6):归并器、落地闸、审计脚本问的是同一个问题
 * ——"这一行的消失是本侧行使过的处置权,还是别人真被吃掉的正文?"两处各写一遍必漂开,
 * 而漂开的表现是一边放行一边拒收(§22c 记过最多次的失败型)。
 *
 * **凭据怎么才算数(三条,缺一不成立)**:
 *  ① **同族** —— 归档件的文件名必须过 `live-doc-classify.archiveOwnerFor(docRel)` 那一张表
 *     (与归并器的第四态同源,本库不写第二份文档↔归档件对应关系)。不同族的件连读都不读:
 *     `PROJECT_PLAN_*` 里的登记行不构成 AGENTS 删行的凭据,反之亦然。
 *  ② **不是整篇快照** —— 归档目录里还并存着 `AGENTS_full-pre-compact-*.md` /
 *     `AGENTS-pre-compress-*.md` 这类**整篇复制件**:它们按定义含有本文件历史上出现过的每一行,
 *     把它们当意图来源 = 从此任何一次改稿都变成"永久删除" —— 对侧真把这一行加回来时会被静默吞掉。
 *     判别不靠文件名(名字会漂、会有人取新名),靠**内容比例**:一份归档件的非空行里若
 *     ≥ `SNAPSHOT_OVERLAP` 的比例**仍逐字活在本侧文档里**,它就是本文件的复制件,不是移出批次。
 *     实测两端离得很远(整篇快照 ≈ 0.9+,trim 批 ≈ 0.05),阈值不敏感。
 *  ③ **本侧 0 份** —— 由 `archiveDropCaps` 判:本侧还留着这一行 ⇒ 处置权未行使,一条不扣
 *     (与 `union-converge.declaredDropCaps` 同形;扣了就是丢本侧自己的行)。
 *
 * **失效方向恒为"多留一份"**:归档面枚举失败 / 正文取不到 / 同族件数为 0 / 文档名不在
 * `archiveOwnerFor` 表里 ⇒ 一律返回空集 ⇒ 调用方退回 `lost`(宁可多插回一份让人复核,
 * 绝不把真吃掉的正文洗成"已归档")。这与 §0.10「失效方向必须是多要一次定向说明」同一条禁令。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import { archiveOwnerFor } from './live-doc-classify.mjs'
import { parseArchivePlaceholders, placeholderKeyOfTitle } from './ledger-move-aware.mjs'
import { parseCompletedTaskBlocks } from './plan-task-headings.mjs'

/** 归档落点(§1 两步走),与门 76 同一个常量值;本库按**文件名**判族,不按目录判 ——
 *  目录里混着快照件,「在这个目录里 ⇒ 是移出批次」正是本库要否掉的过宽判据。 */
export const ARCHIVE_REL = '.ihui-agent/archive'

/** 归档件非空行里"仍活在本侧文档"的比例上限;达到即视为整篇复制件,不作意图来源。 */
export const SNAPSHOT_OVERLAP = 0.5

/**
 * 整篇快照的第二道判别:归档件同时含本侧**多少个章节标题**。
 *
 * 为什么光靠行重合比例不够(实测,2026-10-25 现读):AGENTS 在一个月里从 1.26MB 缩到 108KB,
 * 于是 `AGENTS_full-pre-compact-2026-10-14.md` 的行重合比例只有 **0.029** —— 它明明是本文件的
 * 整篇旧复制件,却因为"文档已经改得面目全非"而落在任何合理阈值之下,当场把 2,606 行历史正文
 * 当成"移出批次"(方向过宽:对侧真加回来的旧规则会被静默吞掉)。
 * 章节标题才是稳的那条线:同一份快照含本侧 58 个标题里的 **31** 个;而全部 trim/dedup 批是 **0–2** 个。
 * 取 8 作门槛(≈本侧标题数的 14%),两端都留足余量;这不是"按文件名猜族",仍是从内容算出来的。
 */
export const SNAPSHOT_HEADING_HITS = 8

/** 可充当"整区移出"证据的最短行(trim 后)。太短的行(`---`、`- 是`)在归档件里纯属排版残渣,
 *  拿它当"这一行是被有意搬走的"证据不成立,而误扣的代价是对侧真加回来的短行被吞。 */
export const MIN_MOVED_LINE = 8

const norm = (l) => String(l ?? '').trim()

/**
 * 从一批归档件里挑出"移出批次"的行(纯函数,零 IO)。
 *
 * @param {string} docRel 活文档相对路径(只取 basename 过 `archiveOwnerFor`)
 * @param {Array<{path:string, text:string|null}>} files 该面(HEAD / 索引)上的归档件清单与正文
 * @param {string} oursText 本侧文档全文(判③的"本侧 0 份"与②的快照比例都用它)
 * @returns {{ok:boolean, reason:string|null, raw:Set<string>, trimmed:Set<string>,
 *   used:Array<{path:string,lines:number}>, snapshots:Array<{path:string,overlap:number}>,
 *   skipped:Array<{path:string,reason:string}>}}
 *   `ok:false` 表示"本轮没有可用凭据"(调用方必须按 lost 处置,不得当成"没有归档行")。
 */
export function selectMovedOut(docRel, files, oursText) {
  const out = {
    ok: false,
    reason: null,
    raw: new Set(),
    trimmed: new Set(),
    used: [],
    snapshots: [],
    skipped: [],
  }
  const owner = archiveOwnerFor(docRel)
  if (!owner) {
    out.reason = `文档 ${docRel || '(未给)'} 不在归档豁免通道表里(archiveOwnerFor=null)`
    return out
  }
  const list = Array.isArray(files) ? files : []
  // 两个条件同时成立才算同族:①落在归档落点之内(别处一份同名文件不构成仓库事实);
  // ②文件名过 `archiveOwnerFor` 那一张表。只判后者会让 `scripts/data/AGENTS_xxx.md` 直接生效。
  const sameFamily = list.filter((f) => {
    const p = String(f?.path ?? '')
    if (!p.startsWith(`${ARCHIVE_REL}/`)) return false
    return owner.test(p.split('/').pop() || '')
  })
  if (sameFamily.length === 0) {
    out.reason = `同族归档件 0 份(${ARCHIVE_REL}/ 内、射程 ${String(owner)})`
    return out
  }
  const ours = new Set(
    String(oursText ?? '')
      .split('\n')
      .map(norm)
      .filter(Boolean),
  )
  const oursHeadings = new Set([...ours].filter((l) => l.startsWith('#')))
  // 通配指针不构成可核验凭据:占位写成 `PROJECT_PLAN_*.md` 时,归档件里那段内容与台账里那枚
  // 条目没有可核验的对应关系 ⇒ 该条目块的行一律不扣(失效方向=多留一份)。
  // 判据只问占位解析器自己给出的 whyNot(不在此另写一份"什么算通配"——§0.6)。
  const unverifiableKeys = new Set(
    parseArchivePlaceholders(String(oursText ?? ''))
      .filter((ph) => !ph.resolvable && /通配/.test(String(ph.whyNot ?? '')))
      .map((ph) => placeholderKeyOfTitle(ph.title))
      .filter(Boolean),
  )
  let read = 0
  for (const f of sameFamily) {
    // 正文取不到 ⇒ 这一份不构成凭据,但也不否掉其它份(§0.3:取不到不猜,逐份点名)
    if (typeof f?.text !== 'string') {
      out.skipped.push({ path: f?.path, reason: '正文取不到' })
      continue
    }
    read += 1
    const rows = f.text.split(/\r?\n/).filter((l) => norm(l) !== '')
    if (!rows.length) {
      out.skipped.push({ path: f.path, reason: '空文件' })
      continue
    }
    const alive = rows.filter((l) => ours.has(norm(l))).length
    const overlap = alive / rows.length
    let headingHits = 0
    if (oursHeadings.size) {
      const fh = new Set(rows.map(norm).filter((l) => l.startsWith('#')))
      for (const h of oursHeadings) if (fh.has(h)) headingHits += 1
    }
    if (overlap >= SNAPSHOT_OVERLAP || headingHits >= SNAPSHOT_HEADING_HITS) {
      // ② 整篇复制件:它的存在说明不了任何"移出意图"(两条判别各自挡一种实测形态)
      out.snapshots.push({ path: f.path, overlap: Number(overlap.toFixed(3)), headingHits })
      continue
    }
    const rawLines = f.text.split(/\r?\n/)
    const excludedRaw = new Set()
    const excludedNorm = new Set()
    if (unverifiableKeys.size) {
      for (const b of parseCompletedTaskBlocks(f.text)) {
        if (!unverifiableKeys.has(placeholderKeyOfTitle(b.titleText))) continue
        for (let i = b.startLine; i <= b.endLine && i < rawLines.length; i++) {
          if (norm(rawLines[i]) === '') continue
          excludedRaw.add(rawLines[i])
          excludedNorm.add(norm(rawLines[i]))
        }
      }
    }
    let added = 0
    for (const l of rows) {
      if (excludedRaw.has(l) || excludedNorm.has(norm(l))) continue
      out.raw.add(l)
      out.trimmed.add(norm(l))
      added += 1
    }
    if (added > 0) out.used.push({ path: f.path, lines: added })
  }
  out.ok = out.used.length > 0
  if (!out.ok) {
    out.reason =
      read === 0
        ? `同族归档件 ${sameFamily.length} 份正文全部取不到`
        : `同族归档件 ${sameFamily.length} 份均被判整篇复制件(${out.snapshots.length} 份)或空文件 ⇒ 无移出批次`
  }
  return out
}

/**
 * 「本侧已按归档移出处置过」的行集 —— 期望表据此**不补回**。
 *
 * 与 `union-converge.declaredDropCaps` 三条判据同形(逐字命中 ∧ 本侧 0 份 ⇒ 扣),
 * 只是凭据来源不同:那一族是**登记行**的摘除台账,这一族是**整区移出**的归档件。
 * 少扣一行的后果是"带回已归档的内容"(吵,但可恢复);多扣一行的后果是"丢掉对侧新写的行"
 * (不可恢复)—— 所以拿不准时本函数返回空集。
 *
 * @param {string} oursText 本侧全文
 * @param {Set<string>|{raw:Set<string>}|null} movedOut `selectMovedOut` 的返回值(或裸 Set)
 * @returns {Set<string>} 可扣的**原始行**(与 `liveDocExpectedCounts` 的键同形;不是 trim 后的)
 */
export function archiveDropCaps(oursText, movedOut) {
  const caps = new Set()
  const set =
    movedOut instanceof Set
      ? movedOut
      : movedOut && movedOut.raw instanceof Set
        ? movedOut.raw
        : null
  if (!set || set.size === 0) return caps
  // 空本侧文本会让"本侧 0 份"对每一行都成立 —— 那只可能是调用方没把正文传进来(取舍失败
  // 反过来变成"整份归档都算处置过")。这一档一律不受理(§0.3:取不到输入 ⇒ 不判定)。
  if (typeof oursText !== 'string' || oursText.trim() === '') return caps
  const co = new Map()
  for (const l of String(oursText ?? '').split('\n')) {
    if (l === '') continue
    co.set(l, (co.get(l) || 0) + 1)
  }
  for (const l of set) {
    if (norm(l).length < MIN_MOVED_LINE) continue
    if ((co.get(l) || 0) > 0) continue // ③ 本侧仍持有 ⇒ 处置权未行使
    caps.add(l)
  }
  return caps
}

/* ══ 处置侧取材出口(2026-10-28 立,票 gb22「活文档被体积清偿压好后又被归并档原样拉回」)══════════
 *
 * 立因(2026-10-28 实测,不是推断):`merge-live-doc --apply` 把 11:40 清偿好的 AGENTS.md 从
 * 95336 字节又顶回 102352(盘上备份件 `.ihui-agent/tmp/AGENTS.md.2026-10-28T03-51-57.pre-merge.bak`)。
 * 量到两处取材面错位,都在**调用方**,判据本身没错:
 *   缺陷甲 —— 归档件清单只取 HEAD 面(`git ls-tree -r HEAD`):而 §1 的合法出路是"先把正文整区逐字
 *            写进 `.ihui-agent/archive/`,再把文档压下来",迁出批次落盘与落库之间有实测量级的一刻半
 *            窗口(11:40 写 → 11:54 入库)。窗口内该件在盘上、不在 HEAD 面 ⇒ 凭据为 0 ⇒ 判 lost ⇒ 插回。
 *            实测:事故那一轮同族 HEAD 件 19 份里没有 10-28 批次,30 行差集里 **24 行无凭据**。
 *   缺陷乙 —— `oursText` 传的是 **HEAD 正文**:那份旧正文按定义逐字含着刚被搬走的行,于是"整篇复制件"
 *            判别(②)拿旧正文一比 ⇒ 10-28 批次 overlap=**0.515 ≥ SNAPSHOT_OVERLAP(0.5)** ⇒ 被判复制件、
 *            连补上磁盘清单也救不回来(实测 E 档仍 24 行无凭据)。②问的是"这份归档件是不是本文件的
 *            复制件",而"复制件"是相对**行使处置权的那一份**而言的 —— 用旧 HEAD 当基准,等于把
 *            "刚搬走还没入库"这件事本身判成"这就是全文复制"。
 *
 * 所以本出口把两件事一次定死:清单 = 调用方那一面 ∪ 磁盘归档目录(逐文件名,不递归、不跟随链接);
 * 基准正文 = **处置侧文本**(清偿后那份工作树快照)。判据一条都不新写(同族表 / 两条快照判别 /
 * 通配指针不受理 / MIN_MOVED_LINE 全部仍走 `selectMovedOut`,§0.6 单一真相源)。
 *
 * **失效方向恒为"多留一份"**:磁盘目录不在位 / 读不到 ⇒ 只用调用方那一面;某份读不到 ⇒ 该份不构成
 * 凭据(lib 逐份点名);处置侧文本取不到或为空 ⇒ `selectMovedOut` 返回 `ok:false` 或空集 ⇒ 调用方
 * 一条都不许扣。绝不允许反向(把别人真加回来的行当成"已归档"吞掉)。
 */

/** 磁盘上的归档件路径(只列 `ARCHIVE_REL` 直属一层的 `.md`;不递归、不跟随 reparse point)。 */
function diskArchiveFiles(root) {
  const out = []
  try {
    const dir = pathJoin(root, ARCHIVE_REL)
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith('.md')) continue
      out.push(`${ARCHIVE_REL}/${ent.name}`)
    }
  } catch {
    return [] // 目录不在位(新克隆 / 隔离夹具)⇒ 一份也不构成凭据,但不否掉调用方那一面
  }
  return out
}

/**
 * 处置侧凭据装配:`selectMovedOut(文档, 调用方那一面 ∪ 磁盘面, 处置侧正文)`。
 *
 * @param {string} root 仓根(由调用方自身位置推导,不 `process.cwd()`,§15)
 * @param {string} docRel 活文档相对路径(同族判别仍走 `archiveOwnerFor`,本函数不写第二份表)
 * @param {Array<{path:string,text:string|null}>} faceFiles 调用方已按某个提交/索引面取到的归档件
 * @param {string} dispositionText 行使处置权的那一份正文(实测 = 归并前的工作树快照)
 * @returns {ReturnType<typeof selectMovedOut>} 与 `selectMovedOut` 同一形状(ok=false ⇒ 调用方退回原判据)
 */
export function selectMovedOutForDisposition(root, docRel, faceFiles, dispositionText) {
  const byPath = new Map()
  for (const f of Array.isArray(faceFiles) ? faceFiles : []) {
    const p = String(f?.path ?? '')
    if (p) byPath.set(p, { path: p, text: typeof f?.text === 'string' ? f.text : null })
  }
  for (const p of diskArchiveFiles(root)) {
    const cur = byPath.get(p)
    if (cur && cur.text !== null) continue // 面里已取到正文 ⇒ 不重读磁盘(同面同轮优先)
    let text = null
    try {
      text = readFileSync(pathJoin(root, p), 'utf8')
    } catch {
      text = null // 读不到 ⇒ 该份不构成凭据,由 lib 逐份点名,绝不静默当成"没有归档行"
    }
    byPath.set(p, { path: p, text })
  }
  return selectMovedOut(docRel, [...byPath.values()], dispositionText)
}

export const __test__ = { norm, diskArchiveFiles }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
