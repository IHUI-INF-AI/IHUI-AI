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

/** 行首裸编号形态:`- [ ]75. file_search 换 ripgrep …`。
 *  ⚠️ 这一族此前**恒不进复合主键**(编号族 `TASK_ID_PATTERN` 只认 G-/D/O/B/P/W/V3/守门,
 *  而 `titleOf` 又在第一个 `.` 处截断 ⇒ 标题只剩 "75",长度 <4 ⇒ composite=null)。
 *  后果是实测过的:F1/F4 对这一族**整族失明**,归并器永不翻勾,派单口径永远列它为待办 ——
 *  同一件事被重复派单、白烧轮次(2026-09-27 本轮:75/51/62 三票的实现与常驻尺子都已在
 *  HEAD 且判据 RC=0,台账仍报未勾选,于是又被派了一次)。
 *  收窄三则,缺一即会把行文引用误当第二次登记(与 M7 那条反向锁同一条禁令):
 *  ① 必须落在**正文开头**(剥掉复选框与状态装饰之后;允许前置的 markdown 强调记号,因为登记行
 *     写成 `- [ ] **86A. …**` 是本仓默认形态 —— 不认它,带字母后缀的编号就永远进不了主键,
 *     而"同主键两态并存"判据看不见 ⇒ 归并器永不翻勾,恰好复刻本函数要防的那一型),
 *  ② 编号 ≤3 位、可带**单个大写字母后缀**(`86A`;排除 `2026-09-27` 这类日期与多字母噪声),
 *  ③ 编号后必须紧跟 `.` 或 `、`,且其后第一个非空字符**不得是数字**(排除 `12.3 万` 这类
 *     量值开头;真正带子号的编号另有 `P2-F.10` 一族,由裸族负责)。 */
const LEADING_NUMERIC_RE = /^[*\s`]*(\d{1,3}[A-Z]?)[.、]\s*[^\s\d]/

/** 返回行首裸编号(不是这一形则 null)。keyOfRow 与 titleOf **共用**本出口 —— 两处各写一份
 *  必然漂开:只改 keyOfRow 会让标题仍为 "75"(仍 <4 仍 null),只改 titleOf 会造出"有标题无编号"的半主键。 */
export function leadingNumericId(body) {
  if (body === null || body === undefined) return null
  const m = LEADING_NUMERIC_RE.exec(body)
  return m ? m[1] : null
}

/** 编号前缀(含 markdown 强调记号)的长度 —— titleOf 要从正文里跳过它,否则标题只剩编号本身。 */
const LEADING_NUMERIC_FULL_RE = /^[*\s`]*(\d{1,3}[A-Z]?)[.、]\s*/

/** 剥掉行首编号形态(含其前置强调记号)。只在 `leadingNumericId` 判成立后调用。 */
export function stripLeadingNumeric(body) {
  return LEADING_NUMERIC_FULL_RE.test(body) ? body.replace(LEADING_NUMERIC_FULL_RE, '') : body
}

/** 取一行的主键编号(没有则 null)。只取**第一个**命中,且必须在主键位置窗口内。 */
export function keyOfRow(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  const lead = leadingNumericId(body)
  if (lead !== null && !PRIORITY_LABEL_RE.test(lead)) return lead
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
  const rawBody = bodyOfRow(line)
  if (rawBody === null) return null
  // 行首裸编号形态:编号不算标题的一部分(否则 `.` 截断后标题只剩编号本身,长度 <4 ⇒ composite=null)。
  // ⚠️ 这里**必须**调用 leadingNumericId 的同一个出口(经 stripLeadingNumeric),不得在本行再抄一份
  // 正则:上一版这里抄了一份不含 `**` 与字母后缀的窄版,于是 `- [ ] **86A. …**` 的标题被 cut 在
  // 编号后面那个 `.` 上 ⇒ 标题只剩 "86A"(3 字 <4)⇒ composite=null —— 判据在**自己刚修的这一族**上失明。
  const body = stripLeadingNumeric(rawBody)
  return body
    .replace(/[*`_\s]/g, '')
    .replace(/[（(【[:：.、,，!！?？].*$/, '')
    .slice(0, TITLE_PREFIX)
}

/**
 * 标题前缀退化判定:第一个分界符**紧跟在主键之后**时,上式会切出"只剩编号本身"的标题 ——
 * 于是**两个不同议题只要编号相同就得到同一个复合主键**,F1 把它们当"同题两态",
 * 归并器 `--heal` 就把别人那条**未完成**的行翻成已完成。(2026-09-27 真实自伤:
 * `**G-257. 审计日志族「参数校验…」已修**` 与 `**G-257(新登记)**:check-agent-engine-parity…`
 * 两侧标题都被切成 `G-257` ⇒ key `G-257#G-257` ⇒ 别人的活被记成做过的账,事后逐行复原。)
 * 判据:titleOf 的结果若等于主键(去空格后)即退化。
 */
export function titleIsDegenerate(line, title) {
  if (!title) return false
  const key = keyOfRow(line)
  if (!key) return false
  return title.replace(/[*`_\s]/g, '') === key.replace(/[*`_\s]/g, '')
}

/** 复合主键 = 编号 + '#' + 标题前缀;任一缺位则 null(不参与分叉判定,只计入"无主键行")。
 *  ⚠️ 标题**退化**(切完只剩主键本身)同样返回 null:那意味着这一行给不出"编号之外的实质标题",
 *  此时仅凭编号相同就判"同一件事"会把**不同议题**并成一条,归并器随之把别人的未完成任务翻成已完成。
 *  宁可不算主键(退化成"无主键行",由 F4b 的逐字孪生判据兜),也不能拿一个会误翻勾的键去做事。 */
export function compositeKeyOf(line) {
  const key = keyOfRow(line)
  const title = titleOf(line)
  if (!key || !title || title.length < 4) return null
  if (titleIsDegenerate(line, title)) return null
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
      a.raw.length === b.raw.length
        ? a.line > b.line
          ? a
          : b
        : a.raw.length > b.raw.length
          ? a
          : b,
    )
    for (const r of live)
      if (r.line !== best.line) copies.push({ row: r, survivor: best, key: g.key })
  }
  return copies
}

/**
 * F4b:**没有主键**的逐字相同未勾选孪生行(F4 的姊妹判据,补它失明的那一格)。
 *
 * 为什么 F4 看不见它们:F4 的分组键是复合主键(编号 + 标题前缀),而 `keyOfRow` 要求编号落在
 * 正文开头 48 字内。台账里存在一整族"叙述式待办" —— `- [ ]（进行中）**真机走查…已修(commit …)**`、
 * `- [ ] 仍在这台机器上、不由我裁的:…` —— 它们一辈子没有编号,于是**根本不进 F1/F4 的分组面**,
 * 同一句话被并发 union 复制两遍而账面报 0。2026-09-27 实测:未勾选 313 行里 4 对逐字相同的孪生行
 * 全部无主键 ⇒ 全部隐身;它们同时被派单口径各算一条,所以"活越做越多"里有这部分水分。
 *
 * 判据仍只认**逐字等值**(不认"很像")—— 相似度只能报数,不配判红,与 F4 同一条立项理由。
 * 幸存者取行号靠后的一条(与 F4 的等长 tie-break 同规则);有主键的行**不在本判据里**,
 * 免得同一对孪生行被 F4 与 F4b 各计一次债(两把尺子互相顶名额是本仓最贵的一类事故)。
 */
export function findVerbatimDupOpenRows(content) {
  const byText = new Map()
  for (const r of parseTaskRows(content)) {
    if (r.state !== 'open') continue
    if (compositeKeyOf(r.raw)) continue
    if (DUP_POINTER_RE.test(r.raw)) continue
    if (!byText.has(r.raw)) byText.set(r.raw, [])
    byText.get(r.raw).push(r)
  }
  const groups = [...byText.values()].filter((g) => g.length > 1)
  const copies = []
  for (const g of groups) {
    const best = g.reduce((a, b) => (b.line > a.line ? b : a))
    for (const r of g) if (r.line !== best.line) copies.push({ row: r, survivor: best, key: '' })
  }
  return { groups, copies }
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

/**
 * ── F7 归属四态 + F8 寿命(2026-09-27 立)──────────────────────────────
 *
 * F1–F6 全是"重复/分叉/指针"型判据,它们回答的是"同一件事被记了几遍"。
 * 但用户报的现象是**总量**在涨,而这一维没有任何判据碰过。实测 HEAD 面(2026-09-27):
 * 未勾选 308 行 / 派单口径 198 行 —— 其中只有 58 行带任何"归谁、等什么条件"的字样,
 * 182 行连一个日期都没有。于是那一个 198 把"今晚就能做的活"和"要等 iOS 模拟器到位"
 * 和"明确写着不归本机做"记在同一格里。**账与活同格,就是"越做越多"的真身**:
 * 7 天前未勾选 19 行,2 天前 206,今天 308 —— 涨的主要不是活。
 *
 * 这一层因此补两件事:
 *  - **F7 归属**:每条未勾选行按正文推导落在四桶之一。分类**只从行文本推导**,
 *    不新增人工标记字段 —— 又一登记表就是又一张会腐烂的清单(§4 对 RN_ONLY_BRAND_KEYS 的教训)。
 *  - **F8 寿命**:每条账必须有"交代"。交代 = 三选一:已认领(租约)/ 落在非 actionable 桶(说清了等什么归谁)/
 *    有可算的日期(出生或最近进展)。**没有死亡条件的账只会累积**,这与守门 108 立项时
 *    对豁免说的那句"只有出生、没有死亡"是同一条病。
 *
 * ⚠ 两个刻意的保守选择,别在后续"顺手收紧"时改掉:
 *  1. F7 **不把等待类行踢出派单口径**,只在报告里分层。正则推错一条,代价是"一件真活从此没人看得见",
 *     比虚高的数字更难发现 —— 判据失效的表现永远是安静(本仓记过最多次的那一型)。
 *     要"只看现在能派的",显式跑 `--open --dispatchable`。
 *  2. F8 的**到期只报数**,提交链只判"本次新增行有没有交代"。若把到期做成 blocking,
 *     存量会在同一天集体到期(今天的登记 21 天后一起过期),那是一台与任何提交都无关的恒红门,
 *     唯一结局是各会话 `--no-verify`、连带全部守门作废(§12e 同型)。
 */
export const DISPOSITIONS = ['actionable', 'waiting-human', 'waiting-env', 'owned-elsewhere']
/** 判定顺序即优先级:一句"归属 X 端,阻塞在生产侧"该算别人的账,不该算成"等环境"。 */
const DISPOSITION_RULES = [
  [
    'owned-elsewhere',
    /归属[:：]|本票不认领|本线不认领|本线只登记|不代做|不代改|不代裁|他人账|不归本机|不归本线|归.{0,10}持有者|由.{0,12}持有者|留给.{0,10}(持有人|人)/,
  ],
  [
    'waiting-human',
    // "需 owner 拍板"这一族必须认:2026-09-27 逐行收尾实测,台账里大量等待句写的是
    // "需 <某人> 拍板"(owner/产品/设计都可能出现),只列中文几个词 ⇒ 这一族整族落"现在可做",
    // 于是**等人拍板的事在每个清单里都冒充今晚就能干的活**。通用形态而不是清单:
    /需\s?[A-Za-z\u4e00-\u9fa5]{0,6}\s?拍板|需(产品|业务|运营)决策|待(产品|业务)决策|等待.{0,4}决策|需人定|需用户|待用户|待拍板|需用户确认|属 §24|请重新决定|未决决策|交人定|人来定|需人(定|拍板)/,
  ],
  [
    'waiting-env',
    /本机结构性缺|本机(无|没有|未装|起不来)|需真机|需 macOS|模拟器|开发者工具|阻塞(主体|在|于)|生产侧|暂留本地|需建表|等(并行|对端|环境|新装机)|外部(条件|服务)|线上(仍是|未|无)/,
  ],
]
export function dispositionOf(line) {
  for (const [kind, re] of DISPOSITION_RULES) if (re.test(line)) return kind
  return 'actionable'
}

/** 行内最后一个日期。取**最后**而不是第一个:进展注记按本仓写法追加在行尾,
 *  而括号里的引用日期(`(2026-09-21 逐条实测)`)可能是旧读数。 */
const DATE_RE = /20\d{2}-\d{2}-\d{2}/g
export function lastDateInRow(line) {
  const re = new RegExp(DATE_RE.source, 'g')
  let last = null
  for (let m = re.exec(String(line)); m !== null; m = re.exec(String(line))) last = m[0]
  return last
}
/** 出生日(追溯态)由 `scripts/plan-line-age.mjs` 回填,语义见该文件头注:
 *  是"该行内容在计划文档里首次可见的提交日期",不是作者落笔日期。 */
export const BIRTH_RE = /〔追溯@(20\d{2}-\d{2}-\d{2})〕/
export function birthDateOf(line) {
  const m = BIRTH_RE.exec(String(line))
  return m ? m[1] : null
}
/** 这条账最后一次被交代的时间 = 行内最新日期,退到追溯出生日。都没有 ⇒ null(无从判龄)。 */
export function ageAnchorOf(line) {
  return lastDateInRow(line) ?? birthDateOf(line)
}

/** F8 的"有无交代":租约 / 非 actionable 归属 / 任何可算日期,三者齐缺即无主账。 */
export function hasDisposition(row) {
  if (row.claim) return true
  if (dispositionOf(row.raw) !== 'actionable') return true
  return ageAnchorOf(row.raw) !== null
}

export function parseDay(s) {
  const m = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(s ?? ''))
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}
const DAY_MS = 86400000
/** 台账寿命(天)。取 21 而非 30:本仓一天登记 100+ 行,30 天等于给膨胀留一整月的盲区;
 *  而 21 天仍宽于门 109 的 72h 租约档 —— 租约是"有人在动",这里是"账该交代"。 */
export const LEDGER_TTL_DAYS = 21
export function daysSince(dayStr, today) {
  const a = parseDay(dayStr)
  const b = parseDay(today)
  if (!a || !b) return null
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS)
}
/** F8b 到期清单:未勾选 ∧ 有可算锚点 ∧ 距今 > TTL。null 锚点不判(无从判龄,只报数)。 */
export function findStaleOpenRows(content, today, ttl = LEDGER_TTL_DAYS) {
  const out = []
  for (const r of parseTaskRows(content)) {
    if (r.state !== 'open') continue
    const anchor = ageAnchorOf(r.raw)
    if (!anchor) continue
    const age = daysSince(anchor, today)
    if (age !== null && age > ttl)
      out.push({ ...r, anchor, age, disposition: dispositionOf(r.raw) })
  }
  return out
}
/** 无交代的未勾选行(F8a 的判据面;调用方负责只对"本次新增"那部分判红)。 */
export function findUndisposedOpenRows(content) {
  return parseTaskRows(content).filter((r) => r.state === 'open' && !hasDisposition(r))
}

/** 多行登记块的整体重复(F6)。
 *
 * 为什么行级判据(F1–F4)看不见它:那四条的量纲是**一行**。而事故的量纲是"一整块":
 * 2026-09-26 本仓一次真实自伤 —— 往 PROJECT_PLAN.md 追加探针登记块时先追加后核重,
 * 同一块以两份**逐字相同**形态入库,之后并发 union 又叠一层(2 份 → 3 份)。
 * 行级判据一路通过,因为每一行都"只出现两次,而文档里本来就有成百上千对孪生行"。
 *
 * 判据的量纲因此必须是"连续 bullet 组成的块":
 *  - 块 >=3 行且每行 >= MIN_LINE_LEN 字符:短行(`- [x]` 之类)和 2 行块在台账里天然成对,
 *    纳入只会产出几百条噪声(实测阈值以下候选数暴涨到不可用)。
 *  - **逐字相同**才算重复:正文一漂移就归到 drifted 一类,它需要人来判哪份作数,
 *    机器折半必然有损(与 F4 的处置同一条理由)。
 * 数字一律现读,不得写进文档当恒定事实。 */
const DUP_BLOCK_MIN_LINES = 3
const DUP_BLOCK_MIN_LINE_LEN = 40
/** @returns {{verbatim:Array<{first:string,lines:number[],copies:number}>,drifted:Array<{first:string,variants:number}>}} */
export function findDupBlocks(content) {
  const lines = String(content).split('\n')
  const blocks = new Map()
  let i = 0
  while (i < lines.length) {
    if (!/^- /.test(lines[i])) {
      i++
      continue
    }
    let j = i
    while (j < lines.length && /^- /.test(lines[j])) j++
    const seg = lines.slice(i, j)
    if (seg.length >= DUP_BLOCK_MIN_LINES && seg.every((l) => l.length >= DUP_BLOCK_MIN_LINE_LEN)) {
      const key = seg.join('\n')
      if (!blocks.has(key)) blocks.set(key, [])
      blocks.get(key).push(i + 1)
    }
    i = j
  }
  const verbatim = [...blocks.entries()]
    .filter(([, ls]) => ls.length > 1)
    .map(([k, ls]) => ({
      first: k.split('\n')[0],
      lines: ls,
      copies: ls.length,
      len: k.split('\n').length,
    }))
    .sort((a, b) => a.lines[0] - b.lines[0])
  const byFirst = new Map()
  for (const k of blocks.keys()) {
    const f = k.split('\n')[0]
    byFirst.set(f, (byFirst.get(f) ?? 0) + 1)
  }
  const drifted = [...byFirst.entries()]
    .filter(([, n]) => n > 1)
    .map(([f, n]) => ({ first: f, variants: n }))
  return { verbatim, drifted }
}

/**
 * F9:撞号 —— 同一编号挂 >1 个**不同标题前缀**(2026-09-27 G-267 立)。
 *
 * 为什么 F1/F4/F4b 看不见它:那三条的分组键是复合主键(编号 + 标题前缀逐字等值)——
 * F1 抓"同一件事写了两份还两态并存",F4 抓"同一件事的多条待办",F4b 抓无主键的逐字孪生;
 * 而"两个**不同任务**抢同一个号"的两行复合主键**不相等**,三条判据同时失明。
 * 后果不是账面难看:派单人按编号找活会找到错的那一行,而 §1"一个编号只能有一行当前状态"
 * 这条规矩没有任何尺子在执行。
 * 口径与其余判据同源:编号走 `keyOfRow`、标题走 `titleOf` **同一出口**,禁止另抄正则
 * (§1"行首裸编号"那条记过"另抄一份窄版⇒在自己刚修的族上失明");
 * 标题**退化**(`titleIsDegenerate`,切完只剩编号)的行不贡献标题 —— 那正是 M16 钉过的
 * "两个不同议题同编号被并成一条"的形态,它给不出"编号之外的实质标题",不能算第二个标题;
 * 归并器 F1 翻勾产出的 `**【归并】**` 前缀行标题被切为空 ⇒ 天然不贡献标题,
 * F4 副本指针追加在行尾 ⇒ 标题不变,两条修法都不会自己制造新撞号。
 * 定级(票面明令"先量再定级"):落地当天 HEAD 面现读存量撞号组数为**非零大数**,
 * 逐条看绝大多数是本仓子项命名惯例(D30①/D30②/O81票㉑ 一族),不是真撞号 ——
 * 所以本维**只进差值/基线棘轮(只拦新增撞号组),存量只报数、`--strict` 也不判红**;
 * 当场判红就是与任何提交无关的恒红门(§12e),而为变绿给编号加豁免清单同样禁止(§4)。
 * @returns {Array<{key:string,titleCount:number,titles:Array<{title:string,lines:number[]}>}>} 按编号首现顺序
 */
export function findIdCollisions(content) {
  const byKey = new Map()
  for (const r of parseTaskRows(content)) {
    if (!r.key) continue
    const title = titleOf(r.raw)
    if (!title) continue
    if (titleIsDegenerate(r.raw, title)) continue
    if (!byKey.has(r.key)) byKey.set(r.key, new Map())
    const titles = byKey.get(r.key)
    if (!titles.has(title)) titles.set(title, [])
    titles.get(title).push(r.line)
  }
  const groups = []
  for (const [key, titles] of byKey) {
    if (titles.size < 2) continue
    groups.push({
      key,
      titleCount: titles.size,
      titles: [...titles.entries()].map(([title, lines]) => ({ title, lines })),
    })
  }
  return groups
}

/** 一把跑完四条统计。数字一律现读,不得写进文档当恒定事实。 */
/**
 * 取号出口(生产侧防"同编号抢两个不同任务")。
 *
 * 为什么不做成判据:2026-09-27 实测同一份 HEAD 里"同编号、不同标题"有 **57/227** 个编号,
 * 逐条看绝大多数是本仓的子项命名惯例(`D30①` / `D30②` / `D30补强` / `D19的"派发前置"…`),
 * 不是撞号 —— 拿它当判据红就是造一台噪声门(假阳比漏报更贵:它指使人去"修"没坏的东西)。
 * (同日 G-267 续:**F9 已按棘轮形态落地** —— 它不判这批存量的红,只拦"本次新增的撞号组",
 * 与本注"按它判红就是造一台噪声门"的实测结论不冲突;取号出口仍保留,防线在登记那一刻。)
 * 而当天真实发生的那一起(两路会话各登记了一个 `G-262`,分别指水印补齐与 git 进程积压)
 * 结构上事后判不了,**只能在登记那一刻把号算出来** —— 所以本函数住在判据层、由
 * `plan-tasks.mjs --next-id` 暴露,不在提交链上。
 *
 * 口径:只认**带字母前缀**的编号族(G-262 / D30 / O13b / V3 …);行首裸编号(`- [ ]75.`)是
 * 章节内序号,不占全局号段,故不计入。字母后缀(O13**b**)与主号同段,取整数字部分。
 * @returns {{max:number,used:number,ids:string[]}|null} 该族一条都没有 ⇒ null(调用方判"取不到",不得据此给 1)
 */
export function usedIdsOfPrefix(content, prefix) {
  const want = String(prefix)
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
  if (!want) return null
  const re = /^([A-Za-z]+)([-_ ]?)(\d+)/
  const nums = new Set()
  const sepOf = new Map()
  for (const r of parseTaskRows(content)) {
    const key = keyOfRow(r.raw)
    if (!key) continue
    const m = re.exec(key)
    if (!m) continue
    if (m[1].toUpperCase() !== want) continue
    nums.add(Number(m[3]))
    // 书写形状由**该族自己现读**决定:本仓 `G-265` 带连字符、`O4`/`D35` 不带,而 `O13b` 的字母
    // 后缀不算号段的一部分。印错形状等于给使用者一个判据认不出来的号(与"族取不到 ⇒ 判不出"同一条理由)。
    if (!sepOf.has(Number(m[3]))) sepOf.set(Number(m[3]), m[2])
  }
  if (nums.size === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const max = sorted[sorted.length - 1]
  const sep = sepOf.get(max) ?? '-'
  return {
    max,
    used: sorted.length,
    ids: sorted.map((n) => `${want}${sepOf.get(n) ?? sep}${n}`),
    template: `${want}${sep}%d`,
  }
}

/** 按该族自己的书写形状给出下一个空闲号(该族现读为空 ⇒ null)。 */
export function nextTaskIdLabel(content, prefix) {
  const u = usedIdsOfPrefix(content, prefix)
  return u === null ? null : u.template.replace('%d', String(u.max + 1))
}

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
  const verbatimDups = findVerbatimDupOpenRows(content)
  const dupBlocks = findDupBlocks(content)
  const collisions = findIdCollisions(content)
  const dupCopyLines = new Set([
    ...dupCopies.map((c) => c.row.line),
    ...verbatimDups.copies.map((c) => c.row.line),
  ])
  // F7 分层:每条未勾选行落一个归属桶;F8:交代与到期各一把清单。
  // 都在**同一遍 parseTaskRows 的结果**上算,不得为它们再解析一次文档(两处解析必漂移)。
  const dispBuckets = {
    actionable: [],
    'waiting-human': [],
    'waiting-env': [],
    'owned-elsewhere': [],
  }
  for (const r of unclaimedRows) dispBuckets[dispositionOf(r.raw)].push(r)
  const undisposed = findUndisposedOpenRows(content)
  const staleRows = findStaleOpenRows(content, new Date().toISOString().slice(0, 10))
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
    /** 当前面上所有条目行的原文集合 —— 调用方用它算"本次新增的行"(逐字不在基准面上)。
     *  F8a 只能判新增:存量没有义务在上线当天就补齐交代(那就是恒红门)。 */
    rowTexts: new Set(rows.map((r) => r.raw)),
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
    verbatimDups,
    dupBlocks,
    collisions,
    dispBuckets,
    undisposed,
    staleRows,
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
      // F4b:无主键的逐字孪生行 —— F4 按复合主键分组,而这一族永远没有编号,所以在 F4 里恒为 0、
      // 在账面上等于"不存在"。见 findVerbatimDupOpenRows 头注(2026-09-27 实测 4 对全部隐身)。
      verbatimDupGroups: verbatimDups.groups.length,
      verbatimDupCopies: verbatimDups.copies.length,
      // 已写明"重复登记副本"的未勾选行:它们与 dupOpenCopies 是两件事 —— 副本是**当次**算出来的,
      // 标过指针的是历史上已归并过的。派单口径两条都扣,所以报告里必须分列,否则读者对不上账。
      dupPointerRows: openRows.filter((r) => DUP_POINTER_RE.test(r.raw)).length,
      // 内容级存续性证据(只许增不许减,方向与四条状态判据相反 ⇒ 单独一把尺子,别塞进同一个 ratchet)
      mergeNotes: countMergeNotes(content),
      // F6 块级重复:行级判据(F1–F4)量不到"整块被追加两遍",见 findDupBlocks 头注
      dupBlocks: dupBlocks.verbatim.length,
      dupBlockCopies: dupBlocks.verbatim.reduce((s, b) => s + b.copies, 0),
      dupBlockDrifted: dupBlocks.drifted.length,
      dupDoneGroups: dupDone.length,
      // F9 撞号(见 findIdCollisions 头注定级理由):存量只报数,提交链只拦新增撞号组。
      collisionGroups: collisions.length,
      claimable: unclaimedRows.filter(isClaimable).length,
      // ── F7 归属分层(未认领口径,与 claimable 同集合基数)──
      // 基数校验:四桶相加必须等于 unclaimed,不等就是分类逻辑漏桶(已由 selfTest 钉住)。
      dispActionable: dispBuckets.actionable.length,
      dispWaitingHuman: dispBuckets['waiting-human'].length,
      dispWaitingEnv: dispBuckets['waiting-env'].length,
      dispOwnedElsewhere: dispBuckets['owned-elsewhere'].length,
      // ── F8 寿命两档 ──
      // 无交代:全部未勾选行里既没租约、也没说等什么、又没有日期的 —— 这批才是"只会涨的账"。
      undisposed: undisposed.length,
      // 到期:有日期锚点但已超 TTL。默认只报数(见头注第 2 条保守选择)。
      stale: staleRows.length,
      // 无从判龄:连一个日期都没有。它必须单独报名 —— 把"看不见"混进"没问题"是本仓最高频失效型。
      undated: undisposed.filter((r) => !ageAnchorOf(r.raw)).length,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
