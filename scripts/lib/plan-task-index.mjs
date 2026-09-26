// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-task-index.mjs —— PROJECT_PLAN.md 的「任务状态单一索引」层(2026-09-26 立)
 *
 * 为什么要有这一层(根因,不是"再补一条正则"):
 * 计划文档被当台账用,却**没有主键约束**。同一任务编号在文档里被不同批次各登记一次
 * (HEAD 面实测:237 个编号里 147 个登记 ≥2 次,79 个编号同时存在 `- [x]` 与 `- [ ]` 两态),
 * 做完时只翻写自己那一批的那份 ⇒ 前面那份永久烂成"已完成却仍挂着未勾选"。而既有防护链
 * **全部单向防丢**(门 71 防登记行丢 / 100 防合并吞文件 / 84 防写回旧版 / 自愈器把删掉的行原地
 * 恢复),没有一道门判"状态分叉" —— 于是并发并集合并(每行重数取 max)天天产新的分叉,
 * 账面却一路全绿。
 *
 * 这一层把"任务"从"文本行"里拿出来:任务是**编号 → 状态**的记录,行只是它的出处。
 * 判据因此可以是**精确的**(按编号),不再依赖相似度 —— 既有的 `findClosedTwins` 用
 * Jaccard + 互含(实测 144 条里 25 条只靠互含命中,分数低到 0.26),那是"没有主键"逼出来的
 * 模糊尺子,只配用来报数,不配判红。
 *
 * 编号族的唯一真相源 = `scripts/check-plan-line-loss.mjs` 导出的 `TASK_ID_PATTERN`
 * (门 71 用它认登记行)。本层**不另抄一份**,只在其上加一条收窄:编号必须落在
 * 条目正文的**主键位置**(开头 `KEY_MAX_OFFSET` 字内),否则"见 G-148""(对标 D29)"这类
 * 行文引用会被误当成第二次登记。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { TASK_ID_PATTERN } from '../check-plan-line-loss.mjs'

/** 认领标记体(旧裸形 `（进行中）` 与新租约形 `（进行中@YYYY-MM-DD/持有者）`)。
 *  ⚠ 与 `check-task-claims.mjs` 的 `CLAIM_MARKER_SRC` 同义 —— 接线完成后那边必须改为 import
 *  本常量(方向:门 → 本层)。两处各写一份迟早漂成"一边判租约、一边判无人认领"。 */
export const CLAIM_SOURCE = '（进行中[^）]*）'
export const CLAIM_MARKER_RE = new RegExp(`^- \\[ \\]${CLAIM_SOURCE}\\s*`)

/** 主键位置窗口:条目正文开头多少个字符内出现的编号才算"这一行的主键"。
 *  实测依据(HEAD 面):`- [x] ✅(2026-09-25) **D33 过程性信息持久化补全(G-39)**` 这类写法里,
 *  主键在剥掉状态装饰后落点为 0,而行文引用(`(对标 Codex …)`/`见 O73`)一律在 40 字之后。 */
export const KEY_MAX_OFFSET = 48

/** 优先级标签不是任务主键:`P0`/`P1`/`P2` 在本文档里是分区名(实测 55+ 行以"P1"开头互指)。
 *  带子号的 `P2-F.10` 仍算主键。 */
const PRIORITY_LABEL_RE = /^P\d+$/

const CHECKBOX_RE = /^\s*[-*]\s\[( |x|X)\]\s*/
/** 复选框之后可连续出现的状态装饰:租约标记、`✅(日期)`、`✅ 日期`、`【已完成】`。 */
const DECOR_RE = new RegExp(
  `^(?:${CLAIM_SOURCE}|✅\\s*(?:\\([^）)]{1,40}\\))?|\\(已完成\\)|【已完成】|已完成)\\s*[::]?\\s*`,
)

function stripInlineMarks(s) {
  return s.replace(/^[*\s`【(「]+/, '').replace(/[*\s`】)」]+$/, '')
}

/** 剥掉复选框与其后所有状态装饰,露出条目真正的正文开头(主键位置从这里算)。 */
export function bodyOfRow(line) {
  const m = CHECKBOX_RE.exec(line)
  if (!m) return null
  let body = line.slice(m[0].length)
  for (;;) {
    const before = body
    body = body.replace(DECOR_RE, '')
    if (body === before) break
  }
  return body
}

/** 取一行的主键编号(没有则 null)。只取**第一个**命中,且必须在主键位置窗口内。 */
export function keyOfRow(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  const window = body.slice(0, KEY_MAX_OFFSET)
  const re = new RegExp(TASK_ID_PATTERN, 'g')
  for (let m = re.exec(window); m !== null; m = re.exec(window)) {
    const id = m[0].trim()
    if (PRIORITY_LABEL_RE.test(id)) continue
    // `守门 NN` 是闸门登记族,不是任务主键(它由门 71 的防丢面负责,本层判状态会误伤)
    if (/^守门/.test(id)) continue
    return id
  }
  return null
}

function extractClaim(line) {
  const i = line.indexOf('（进行中')
  if (i < 0) return null
  const j = line.indexOf('）', i)
  return j < 0 ? null : line.slice(i, j + 1)
}

/**
 * 把计划文档解析成条目行。只认复选框行 —— 叙述正文不参与(它没有状态语义)。
 * @returns {Array<{line:number,state:'open'|'done',raw:string,body:string,key:string|null,claim:string|null}>}
 */
export function parseTaskRows(content) {
  const lines = String(content).split(/\r?\n/)
  const rows = []
  lines.forEach((l, i) => {
    const m = CHECKBOX_RE.exec(l)
    if (!m) return
    rows.push({
      line: i + 1,
      state: m[1] === ' ' ? 'open' : 'done',
      raw: l,
      body: stripInlineMarks(bodyOfRow(l) ?? ''),
      key: keyOfRow(l),
      claim: extractClaim(l),
    })
  })
  return rows
}

/**
 * ── 三条确定性判据(2026-09-26 实测定型)────────────────────────────────
 *
 * 立项时设计的第 4 条判据"open 行号 < 该编号首个 done 行号 ⇒ 陈旧副本"**已被实测否定并删除**
 * (不是降级成报数 —— 一条前提不成立的判据留在导出面上,下一个人会拿它去判红):
 * 它的前提是"行号大 = 时间晚",而计划文档顶部有一份**就地编辑**的清单(P0/P1/P2 区),
 * 下方才是 append-only 的批次流水。实测该判据在 HEAD 面只覆盖 17 行,而真正的分叉有 87 行,
 * 且样本里大量是"done 写在前、open 写在后" —— 方向与前提相反。
 *
 * 留下的三条全部**不依赖行号顺序、不依赖相似度**:
 *  - F1 状态分叉:复合主键(编号 + 正文前缀,逐字等值)下 `- [x]` 与 `- [ ]` 并存。
 *  - F2 作废声明未落账:行首仍是 `- [ ]`,但正文自带"已完成/读数过期/裸副本/勿照本行派单"
 *      这类**闭合或作废声明** —— 这正是"完成的为什么还在这里"那一批的机器可读形态。
 *  - F3 指针腐烂:证据用 `L<行号>` 当锚点,而被指的行在当前面上已经不是那条正题。
 *      行号在任何一次 append 后都会挪位,用它当可核验指针等于写一句下轮就失效的话。
 *      本条把"必须用内容锚点"变成机器判据,而不是一句散文约定。
 *      立项实测:HEAD 面 15 条带 `存活于 L####` 指针的登记行,**指针核验通过率 0/15**
 *      (目标行已不是条目行)—— 即上一轮(O60)那批"已识别、只标注未翻勾"的账,
 *      今天已经无法按它自己给的证据复核,只能靠内容锚点重算。
 */

/** 复合主键用正文前缀长度。实测 12/18/24/32/40 五档得到的分组**完全相同**
 *  (270 组 / 37 组两态并存),因为重复登记是整行逐字复制,不是"像"。 */
export const TITLE_PREFIX = 24

/** 归一化正文标题:剥状态装饰、剥 markdown 强调与空白,并在**第一个标题/描述分界符**处截断。
 *  截断点必须停在冒号:真实文档里的重复登记形态是"同一标题 + 不同注记"(各批次往同一件事后追加
 *  自己的取证),只剥括注会让前缀跨过冒号,于是同一件事被算成两个主键 —— F1 直接失明。 */
export function titleOf(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  return body
    .replace(/[*`_\s]/g, '')
    .replace(/[（(【[:：.、,，!！?？].*$/, '')
    .slice(0, TITLE_PREFIX)
}

/** 复合主键 = 编号 + '#' + 标题前缀;任一缺位则 null(不参与分叉判定,只计入"无主键行")。 */
export function compositeKeyOf(line) {
  const key = keyOfRow(line)
  const title = titleOf(line)
  if (!key || !title || title.length < 4) return null
  return `${key}#${title}`
}

/** F1:按复合主键聚合并挑出两态并存的组。 */
export function findForks(content) {
  const groups = new Map()
  for (const r of parseTaskRows(content)) {
    const k = compositeKeyOf(r.raw)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, { key: k, open: [], done: [] })
    groups.get(k)[r.state].push(r)
  }
  const all = [...groups.values()]
  return {
    groups: all,
    forks: all.filter((g) => g.open.length > 0 && g.done.length > 0),
    dupOpen: all.filter((g) => g.open.length > 1),
    dupDone: all.filter((g) => g.done.length > 1),
  }
}

/**
 * F4:同一复合主键下 **≥2 条未勾选** —— 同一件事被两批各登记一次,派单会把同一件活派两遍。
 * 这与 F1 是两种病:F1 是"做完了还挂着",F4 是"一件事两个待办"。此前只有 `dupOpenGroups`
 * 一个组数在报告里飘,没有任何判据拿它当账,`claimable` 还把副本各算一条 —— 用户问的
 * "怎么还有重复的"正是这一格,而它一直在读数里、无人判。
 * 幸存者取正文最长者(承载信息最多的一条),等长则取行号靠后者(较新的措辞);
 * 其余副本由 `plan-tasks-merge.mjs` 就地写明"与哪条同题",**一行不删**(§1 禁止无声删除)。
 */
export const DUP_POINTER_RE = /【归并】重复登记副本/
export function findDupOpenCopies(dupOpen) {
  const copies = []
  for (const g of dupOpen) {
    const live = g.open.filter((r) => !DUP_POINTER_RE.test(r.raw))
    if (live.length < 2) continue
    const best = live.reduce((a, b) =>
      a.raw.length === b.raw.length ? (a.line > b.line ? a : b) : a.raw.length > b.raw.length ? a : b,
    )
    for (const r of live) if (r.line !== best.line) copies.push({ row: r, survivor: best, key: g.key })
  }
  return copies
}

/** F2:正文自带的"闭合/作废声明"字面。窄集合,宁漏不误伤 —— 见门 120 的"名单要有正向证明"。 */
export const VOID_MARK_RE =
  /\[[A-Za-z]{1,3}\d+[a-z]*\s*判[:：][^\]]*(?:已完成|已闭环|已收口|已清偿|读数过期|裸副本)|勿照本行派单/
export function findVoidRows(content) {
  return parseTaskRows(content).filter((r) => r.state === 'open' && VOID_MARK_RE.test(r.raw))
}

/** F3:`L<行号>` 式证据指针,核它指向的行是否仍是同一复合主键的条目行。 */
export const POINTER_RE = /(?:逐字)?存活于\s*L(\d{1,6})/g
export function findRotatedPointers(content) {
  const lines = String(content).split(/\r?\n/)
  const bad = []
  for (const r of parseTaskRows(content)) {
    // 共享一个带 /g 的正则跨字符串 exec 会因 lastIndex 残留而漏匹配 —— 每行开一把新的
    const re = new RegExp(POINTER_RE.source, 'g')
    for (let m = re.exec(r.raw); m !== null; m = re.exec(r.raw)) {
      const target = Number(m[1])
      const t = lines[target - 1]
      const reason = !t
        ? '目标行不存在'
        : !/^\s*[-*]\s\[[ xX]\]/.test(t)
          ? '目标行不是条目行'
          : compositeKeyOf(t) !== compositeKeyOf(r.raw)
            ? '目标行是另一条(复合主键不等)'
            : null
      if (reason) bad.push({ line: r.line, target, reason, raw: r.raw })
    }
  }
  return bad
}

/**
 * 归并动作留下的"落账:复测"注记 —— 它是**内容级**存续性证据,不属四条状态判据,但补的是它们
 * 共同看不见的那一格:一次"按内存里旧计划文档整文件提交"把已落账的行退回未落账形态时,
 * 退回后的两态仍是同态的(全是未勾选或全是已完成),于是 F1/F2/F3/F4 与门 71 同时全绿,
 * 只有注记的**条数**会掉。2026-09-26 一小时内实测被这样抹掉两次。
 * 方向与其余判据相反,故单列:**只许增不许减**。
 */
export const MERGE_NOTE_RE = /〔【归并】[^〕]{0,80}?落账:复测 \d{4}-\d{2}-\d{2}/g
export function countMergeNotes(content) {
  const re = new RegExp(MERGE_NOTE_RE.source, 'g')
  let n = 0
  for (let m = re.exec(String(content)); m !== null; m = re.exec(String(content))) n++
  return n
}

/** 一把跑完四条统计。数字一律现读,不得写进文档当恒定事实。 */
export function auditPlan(content) {
  const rows = parseTaskRows(content)
  const { groups, forks, dupOpen, dupDone } = findForks(content)
  const voidRows = findVoidRows(content)
  const rotated = findRotatedPointers(content)
  const openRows = rows.filter((r) => r.state === 'open')
  const forkOpenLines = new Set(forks.flatMap((g) => g.open.map((r) => r.line)))
  const voidLines = new Set(voidRows.map((r) => r.line))
  // "真·无人认领"必须**同时**扣掉带租约的行 —— 第一版没扣,于是 146 条"无人认领"里
  // 混着 44 条别人已认领的活(门 109 的租约形 `（进行中@日期/持有者）` 与裸标记都算)。
  // 派单人拿这个数去派,就会把别人正在做的事再派一遍 —— 正是 §1 认领标记要防的那件事。
  const unclaimedRows = openRows.filter((r) => !r.claim)
  const dupCopies = findDupOpenCopies(dupOpen)
  const dupCopyLines = new Set(dupCopies.map((c) => c.row.line))
  // 已写明"重复登记副本、不再单独派单"的行**也不进派单口径** —— 它由同题的幸存者代表。
  // 只把"当次算出来的副本"扣掉是不够的:归并动作跑完那一刻,被标注的行如果还算一条活,
  // 派单人就会照着虚高的数字把同一件活再派一遍(而账面看起来已经处理过了)。
  const isClaimable = (r) =>
    !forkOpenLines.has(r.line) &&
    !voidLines.has(r.line) &&
    !dupCopyLines.has(r.line) &&
    !DUP_POINTER_RE.test(r.raw)
  return {
    rows: rows.length,
    openRows: openRows.length,
    doneRows: rows.length - openRows.length,
    claimedRows: openRows.filter((r) => r.claim).length,
    keyedRows: rows.filter((r) => r.key).length,
    composites: groups.length,
    forks,
    dupOpen,
    dupDone,
    voidRows,
    rotated,
    dupCopies,
    /** 派单口径 = 未勾选 ∧ **未带租约** ∧ 不是"与已完成同题的分叉副本" ∧ 不是"同一件事的第二条待办"(F4)∧ 不自带作废声明。
     *  租约这一维是第一版的漏口:146 条"无人认领"里混着 44 条别人已认领的活,
     *  照那个数派单就是把正在做的事再派一遍(§1 认领标记存在的理由)。
     *  F4 这一维是第二版才补上的:副本行各算一条 ⇒ 同一件活被派两遍,而报告里只飘着一个组数。 */
    claimableRows: unclaimedRows.filter(isClaimable),
    counts: {
      open: openRows.length,
      claimed: openRows.filter((r) => r.claim).length,
      unclaimed: unclaimedRows.length,
      forks: forks.length,
      forkOpenLines: forkOpenLines.size,
      voidRows: voidRows.length,
      rotatedPointers: rotated.length,
      dupOpenGroups: dupOpen.length,
      dupOpenCopies: dupCopies.length,
      // 已写明"重复登记副本"的未勾选行:它们与 dupOpenCopies 是两件事 —— 副本是**当次**算出来的,
      // 标过指针的是历史上已归并过的。派单口径两条都扣,所以报告里必须分列,否则读者对不上账。
      dupPointerRows: openRows.filter((r) => DUP_POINTER_RE.test(r.raw)).length,
      // 内容级存续性证据(只许增不许减,方向与四条状态判据相反 ⇒ 单独一把尺子,别塞进同一个 ratchet)
      mergeNotes: countMergeNotes(content),
      dupDoneGroups: dupDone.length,
      claimable: unclaimedRows.filter(isClaimable).length,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
