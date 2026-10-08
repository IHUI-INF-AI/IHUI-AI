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
/** 复选框之后可连续出现的**词形**状态装饰:租约标记、`✅(日期)`、`✅ 日期`、`【已完成】`。
 *  ⚠ 行首**括注形**装饰(`（待派/X）` / `（【归并】…）` / `〔…〕` / 嵌套长括注)不在本正则里 ——
 *  由 bodyOfRow 第二档 stripBracketDecorations 走配平扫描,且只在"剥完后编号位真有编号"时才吃
 *  (无条件吃会把归并器"摘号进括注"的产物重新点亮,见该函数头注与本票 M24/M28)。
 *  导出理由:主键区那一侧的"状态词表"(`DECOR_STATUS_WORDS`)必须与**这里**同源 ——
 *  两处各列一份迟早漂成"一边把 `(进行中@…)` 当装饰吃掉、一边还当题面"。
 *  漂移由自检/镜像测试的逐词对账当场翻红,不靠人记得。 */
export const DECOR_RE_SOURCE = `^(?:${CLAIM_SOURCE}|✅\\s*(?:\\([^）)]{1,40}\\))?|\\(已完成\\)|【已完成】|已完成)\\s*[::]?\\s*`
export const DECOR_RE = new RegExp(DECOR_RE_SOURCE)

function stripInlineMarks(s) {
  return s.replace(/^[*\s`【(「]+/, '').replace(/[*\s`】)」]+$/, '')
}

/** 剥掉复选框与其后所有状态装饰,露出条目真正的正文开头(主键位置从这里算)。
 *  装饰有两族:**词形**(租约 / `✅(日期)` / `已完成` …,由 DECOR_RE 认,无条件剥,与既有语义逐字节同形)
 *  与**括注形**(行首连续的成对括号,由 matchBalancedGroupAt 走深度感知扫描,同种符号可嵌套)。
 *  括注形**只在"剥完后编号位上真有编号"时才吃**(stripBracketDecorations 的"最长锚定前缀"回退):
 *  - 不吃则漏算(实测 `（待派/QODER-O81）G-627` 的编号被括注里另一个族的号掩蔽、
 *    `（【归并】…长注…）G-619` 被推出主键窗口 —— 取号器低估历史 ⇒ 重发已用号,2026-09-29 台账自伤两次);
 *  - 无条件吃则自伤(实测 `**【归并】** 本行与已完成登记同题…` 那一族归并产物:吃掉 `【归并】`
 *    后题面被切成指针散文 ⇒ 与持有行同编号不同标题,plan-tasks 自检"修法不自伤"当场红)。
 *  回退保住的正是既有窗口语义与 M16/M20/M21 全部契约:**没有编号可露的括注一律不动**。 */
export function bodyOfRow(line) {
  const m = CHECKBOX_RE.exec(line)
  if (!m) return null
  const body = line.slice(m[0].length)
  const legacy = oldStrip(body)
  const bracked = stripBracketDecorations(legacy)
  return bracked === legacy ? legacy : bracked
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

/**
 * 剥掉"行首就是本行主键(+ 紧跟主键的状态括注)+ 分界符"的那一截
 * (`**G-257. 审计日志族…**` 与 `**G-290(进行中@2026-09-28/主会话)题面…**` 两族,全仓最常见形态)。
 *
 * 不剥会怎样:`titleOf` 后面的 `[.、]` 截断会把标题切成**只剩编号本身** ⇒ `titleIsDegenerate`
 * 判退化 ⇒ 整族 composite=null ⇒ F1/F4 对这一族**完全失明**。这不是假设:2026-09-27 补
 * 退化判据(防"同编号不同议题"被误翻勾)时只解决了撞号那一面,却把 `G-NNN. 标题` 这一族
 * 从对账里整体摘掉了 —— 修判据的那一族上自己失明,本仓已记过同型(见 M15 那条注释)。
 *
 * 剥完之后:
 *  - `**G-257. 审计…**` ⇒ 标题 `审计…`,真实、非退化 ⇒ 恢复对账;
 *  - `**G-257(新登记)**:…` ⇒ 编号后紧跟括号,不是 `.`/`、` ⇒ 不剥,标题被切成空 ⇒ 仍退化、
 *    仍 null。**撞号误翻勾那条防线一字不松**(它防的正是"编号之外给不出实质标题")。
 *  - `**G-290(进行中@2026-09-28/主会话)题面…**` ⇒ 括注内容以**状态字**开头 ⇒ 属主键区,题面
 *    从括注之后开始。**这一族此前判退化 ⇒ composite=null ⇒ F1 对它完全失明**(HEAD 现读
 *    3 行属于"有编号、有题面、却因装饰吃掉题面而不成键"的那一格)。
 *    翻勾/改写只动装饰(checkbox、`✅(日期)`、租约括注、行尾注记)⇒ 题面逐字不变 ⇒ **键稳定**:
 *    这正是 `buildForkedLine` 摘牌前后仍同键的理由。
 *    ⚠ 但它**不**把"连题面一起改写"的行配成对 —— `- [x] ✅(日期) **G-290(本票的判据被推翻…)** 原登记:…`
 *    那种行给不出与原件逐字等值的题面,仍算无复合主键(要配它只能靠相似度,而 §1 明令
 *    "相似度只能报数,不配判红";那一格由 F9 撞号与人工归并负责,不由本键负责)。
 *
 * 刻意用**逐字符扫描**而不是拼正则:编号要插进 pattern 里,而 `key` 含 `-`、且我们得先写
 * `\s`/`\*` 这类元字符 —— 一把"转义整条 pattern"的 helper 会把 `\s` 变成"反斜杠 + s",
 * 判据静默永不命中而不报任何错(本函数上一版正是这样"写了但没生效")。字符串比较没有这个坑。
 */
const KEY_LEAD_NOISE = new Set(['*', '`', ' ', '\t'])

/** 状态装饰词 —— **只列 DECOR_RE 已经认的那三个**(`进行中` / `已完成` / `✅`)。
 *  这一份词表不新增任何字面:镜像测试(M22)逐词对账"这里的每个词都必须出现在 DECOR_RE 的源里",
 *  两边一旦漂开(比如有人给 DECOR_RE 加了 `已闭环` 而忘了这边,或反过来)当场翻红 ——
 *  又一处会腐烂的登记表正是本仓记过最多次的失效型(§4 对 RN_ONLY_BRAND_KEYS)。
 *  ⚠ 词表短到只有三个,是因为它判的是**形状所属族**而不是"这句话像不像注记":
 *  `(本票的"落地判据"被现读推翻,改按台账出口收口)` 这种**叙述性括注**刻意不吃 —— 把它吃掉
 *  等于让 `**G-257(新登记)**:另一议题**` 那一族(M16 钉过的"两个不同议题抢一个号")
 *  突然给得出题面,撞号防线就没了。那一族的行仍按"给不出题面"处理(计无主键,交 F4b/人工)。 */
export const DECOR_STATUS_WORDS = ['进行中', '已完成', '✅']

/** 紧跟主键的成对括注,只有**内容以状态字或纯日期开头**的那一批才算主键区的一部分。
 *  判据是形状而不是"任意括号":`(新登记)` / `(对标 Codex)` 这类**议题自带**的括注必须留在题面里
 *  (M16 那条撞号防线防的正是"编号之外给不出实质标题"的形态,把任意括号都吃掉就等于拆掉它)。 */
const GROUP_DECOR_CONTENT_RE = new RegExp(
  `^(?:${DECOR_STATUS_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|20\\d{2}-\\d{2}-\\d{2})`,
)
const GROUP_PAIRS = { '(': ')', '（': '）', '[': ']', '【': '】' }
const KEY_TRAILING_NOISE = new Set(['*', '`', ' ', '\t', ':', '：'])

/**
 * 成对括注的**唯一**扫描原语:从 `from` 起识别一个配平的括注(同种符号可嵌套,
 * 如 `【【归并】…】` / `(…(…)…)`),返回闭合符之后一位的下标;开不出或不闭合 ⇒ -1(不猜)。
 * 行首装饰档与主键后括注两侧共用这一份扫描(pairs 表按位置策略给,两处各写一遍必漂移)。
 */
export function matchBalancedGroupAt(s, from, pairs) {
  const opener = s[from]
  const closer = pairs[opener]
  if (!closer) return -1
  let depth = 0
  for (let j = from; j < s.length; j += 1) {
    if (s[j] === opener) depth += 1
    else if (s[j] === closer && --depth === 0) return j + 1
  }
  return -1
}

/**
 * 行首装饰括注的形状表。半角方括号 `[...]` 刻意**不在**表内:台账里它装着行文引用与处置档
 * (`[O76 判:已完成残余]`、markdown 链接),内容是引用不是装饰;吃了会把被引 id 从取号集合里
 * 摘掉 —— 那是把"漏算"修成另一种"漏算"。主键后那一侧沿用 GROUP_PAIRS(含 `[`)的既有语义;
 * 两表差异是**位置策略**,扫描只有一份实现。`〔〕` 只在行首吃:键后 `〔拆票…〕` 一族
 * 的 stripOwnKey 结论必须与旧版逐字同形(M20 的题面切分契约)。
 */
const LEAD_DECOR_PAIRS = { '（': '）', '(': ')', '【': '】', '〔': '〕' }
const LEAD_DECOR_SEP = new Set([' ', '\t', ':', '：'])

/** 编号是否就落在正文开头(可夹强调记号/反引号/空白前缀)。只复用 TASK_ID_PATTERN 与
 *  LEADING_NUMERIC_RE 这两个既有出口,不写第三份编号语法。 */
function anchoredKeyAhead(s) {
  let k = 0
  while (k < s.length && KEY_LEAD_NOISE.has(s[k])) k += 1
  const tail = s.slice(k)
  if (new RegExp(`^(?:${TASK_ID_PATTERN})`).test(tail)) return true
  return LEADING_NUMERIC_RE.test(tail)
}

/** 词形装饰的既有剥离(与改动前的 bodyOfRow 循环逐字同形)—— 括注回退保不住时交回它。 */
function oldStrip(body) {
  for (;;) {
    const b2 = body.replace(DECOR_RE, '')
    if (b2 === body) return body
    body = b2
  }
}

/** 从 s 吃**一个**行首括注(先跳过强调记号,吃完连同其后的空白/冒号);吃不出 ⇒ null。 */
function nextGroupState(s) {
  let k = 0
  while (k < s.length && KEY_LEAD_NOISE.has(s[k])) k += 1
  const end = matchBalancedGroupAt(s, k, LEAD_DECOR_PAIRS)
  if (end < 0) return null
  let n = end
  while (n < s.length && LEAD_DECOR_SEP.has(s[n])) n += 1
  return s.slice(n)
}

/**
 * 括注档的"最长锚定前缀"剥离:沿确定性路径(词形 DECOR 步与括注步交替)逐步吃,
 * 记录**最后一个**"编号位上真有编号"的状态;一个都没有 ⇒ 原样交回(= 旧语义)。
 * 为什么必须"最长"而不是"第一个":`（待派/QODER-O81）（注）G-627` 里两截都是装饰,
 * 第一个锚定态并不存在(`（` 开头不算编号位),最深态才把两截一起让给 G-627。
 * 每一步都严格变短 ⇒ 必然终止。
 */
function stripBracketDecorations(s) {
  let cur = s
  let best = null
  for (;;) {
    const d = cur.replace(DECOR_RE, '')
    if (d !== cur) {
      cur = d
      if (anchoredKeyAhead(cur)) best = cur
      continue
    }
    const g = nextGroupState(cur)
    if (g === null) break
    cur = g
    if (anchoredKeyAhead(cur)) best = cur
  }
  return best === null ? s : best
}

/** 从 `from` 起连续跳过"紧跟主键的状态括注"(可夹强调记号/冒号/空白)。
 *  未闭合的括号**不吃**(那会把整行吞成括注,题面变空 ⇒ 反而把这一族判成退化)。
 *  @returns 吃到的位置;一个都没吃到 ⇒ 原样返回 `from` */
export function skipKeyAttachedDecorGroups(s, from) {
  let i = from
  for (;;) {
    let k = i
    while (k < s.length && KEY_TRAILING_NOISE.has(s[k])) k += 1
    const end = matchBalancedGroupAt(s, k, GROUP_PAIRS)
    if (end < 0) return i
    if (!GROUP_DECOR_CONTENT_RE.test(s.slice(k + 1, end - 1))) return i
    i = end
  }
}

/** 剥掉"本行主键(+ 紧跟其后的状态括注)+ 分界符"的那一截,露出题面。
 *  三个分支各自守着一件事,少任何一个都会把某一族推回失明:
 *  ① **状态括注**(`(进行中@…)` / `（已完成）` / `(2026-09-28)`)属主键区 ⇒ 题面从其后开始;
 *  ② `.` / `、` 分界符 ⇒ 题面从其后开始(全仓最常见形态 `**G-257. 题面…**`);
 *  ③ 编号与题面**直接相接**(`**G-290题面**`)⇒ 仍要剥掉编号,否则归并器翻勾那一刻键会漂:
 *     `plan-merge-annotation.mjs` 的 `buildForkedLine` 翻勾时**摘租约括注**(LEASE_RE),
 *     于是同一件事的两侧变成 `G-290（进行中@…）题面` 与 `G-290题面` —— 一侧剥了括注、
 *     一侧留着编号,题面不同形 ⇒ F1 恰好看不见归并器自己产出的那一批分叉(而它正是为 F1 而生的)。
 *  **例外**:编号后紧跟**开括号**时整条不剥 —— `(新登记)` 一族必须留在"题面给不出来"的形态里,
 *  由 `titleIsDegenerate` 判退化、不成键(撞号误翻勾那条防线,M16 钉着,一字不松)。
 *  `mode:'lenient'` 是 ③ 的退让档(编号留在题面里,即 ③ 之前的老行为),只由 `titleOf` 在
 *  严格档给不出实质题面时回退用 —— 回退判据见 `titleOf` 头注,两侧必须走同一份实现。
 */
export function stripOwnKey(body, key, mode = 'strict') {
  if (!key || typeof body !== 'string') return body
  let i = 0
  while (i < body.length && KEY_LEAD_NOISE.has(body[i])) i += 1
  if (!body.startsWith(key, i)) return body
  const afterGroups = skipKeyAttachedDecorGroups(body, i + key.length)
  if (afterGroups !== i + key.length) {
    let k = afterGroups
    while (k < body.length && KEY_TRAILING_NOISE.has(body[k])) k += 1
    if (body[k] === '.' || body[k] === '、') k += 1
    return body.slice(k)
  }
  let j = i + key.length
  while (j < body.length && (body[j] === ' ' || body[j] === '\t')) j += 1
  if (body[j] === '.' || body[j] === '、') {
    j += 1
    while (j < body.length && (body[j] === ' ' || body[j] === '\t')) j += 1
    return body.slice(j)
  }
  if (GROUP_PAIRS[body[j]]) return body
  if (mode === 'lenient') return body
  return body.slice(j)
}

/** 把 stripOwnKey 的产物收成题面候选(与 `titleOf` 用的是同一套剥法,不得另抄)。
 *  **① 行尾 `〔…〕` 注记属同一截断族(2026-10-05 修 F9 取材口径)**:归并/清账的门往同一行**行尾**
 *  追加副本注记时用的正是 `〔【归并】…〕` 这一族(`68` / `74` 的 HEAD 现读形态),而截断集里此前
 *  只有 `【` 与 `[` 没有 `〔`(U+3014)⇒ 截断点被推到注记**内部**的下一个分界符上,题面尾巴挂着一枚
 *  孤儿 `〔` 或半截注记 ⇒ 同一件事被切成两个题面 ⇒ **判据把门自己产出的形态读成第二次登记**,
 *  每多一份带尾注的副本就"新增一个撞号组"(§1 明文那一格),最终长成与任何提交内容无关的恒红门(§12e)。
 *  ⚠ 只在 `〔` **前面还有题面文字**时截:`〔…〕` 开头的那一族(HEAD 现读 28 行,题面就是 `〔`)
 *  截了会把已有的键没收成空题面 —— 与 `LEAD_DECOR_PAIRS` 头注"〔〕只在行首吃、键后 `〔拆票…〕`
 *  的 stripOwnKey 结论必须与旧版逐字同形"(M20)是同一条防线:修口径不得以削覆盖面为代价。 */
function cleanTitle(s) {
  const t = String(s ?? '')
    .replace(/[*`_\s]/g, '')
    .replace(/[（(【[:：.、,，!！?？].*$/, '')
  const at = t.indexOf('〔')
  return (at > 0 ? t.slice(0, at) : t).slice(0, TITLE_PREFIX)
}
/** 题面"给得出来"的判据与 `compositeKeyOf` 同一条(≥4 字且不是编号本身)。 */
function usableTitle(t, key) {
  return !!t && t.length >= 4 && t.replace(/[*`_\s]/g, '') !== String(key).replace(/[*`_\s]/g, '')
}

/** 剥掉行首编号形态(含其前置强调记号)。只在 `leadingNumericId` 判成立后调用。 */
export function stripLeadingNumeric(body) {
  return LEADING_NUMERIC_FULL_RE.test(body) ? body.replace(LEADING_NUMERIC_FULL_RE, '') : body
}

/** 取一行的主键编号(没有则 null)。只取**第一个**命中,且必须在主键位置窗口内。 */
export function keyOfRow(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  return keyInWindow(body)
}

/**
 * 主键位置窗口内的**第一个**编号(不含 `bodyOfRow` 那一步)—— `keyOfRow` 与 F9 的
 * "题面开头是不是他号引用"(③ 那一型)共用这一份扫描,不得在 F9 里再抄一遍编号正则。
 * 与拆分前的 `keyOfRow` **逐字等价**(先试行首裸编号,再取窗口内第一个非优先级、非"守门"的命中);
 * 镜像测试用 F9 的存量读数钉形:宽口径 122 组、声明位 <见票面> 不得因这次拆分而漂。
 */
export function keyInWindow(body) {
  if (typeof body !== 'string') return null
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
  const key = keyOfRow(line)
  // 行首裸编号形态:编号不算标题的一部分(否则 `.` 截断后标题只剩编号本身,长度 <4 ⇒ composite=null)。
  // ⚠️ 这里**必须**调用 leadingNumericId 的同一个出口(经 stripLeadingNumeric),不得在本行再抄一份
  // 正则:上一版这里抄了一份不含 `**` 与字母后缀的窄版,于是 `- [ ] **86A. …**` 的标题被 cut 在
  // 编号后面那个 `.` 上 ⇒ 标题只剩 "86A"(3 字 <4)⇒ composite=null —— 判据在**自己刚修的这一族**上失明。
  const stripped = stripLeadingNumeric(rawBody)
  const strict = cleanTitle(stripOwnKey(stripped, key, 'strict'))
  if (usableTitle(strict, key)) return strict
  // 严格档给不出实质题面时退回老口径(编号留在题面里)——**只许退让,不许没收已有的键**:
  // 实测 HEAD 面有 20 行(如 `**O52「残余…」三条全部落地**`)在严格档下题面会短到不成键,
  // 若不退让就是"为了修一族而把另一族的覆盖面削掉",而那正是本层立项要防的反面(看不见≠没有)。
  return cleanTitle(stripOwnKey(stripped, key, 'lenient'))
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

/**
 * F1:按复合主键聚合并挑出两态并存的组。
 *
 * **G-1058623(2026-10-06 修正)——「两态并存」的 open 侧必须先剔掉归并副本行。**
 *
 * 病灶(现读实测,非推理):F1 只做`compositeKeyOf` 分组,进了 `open` 桶的行使**无条件**
 * 参与混态判定 ⇒ 同一个注记在 F4 里是"已归并、别再派单",在 F1 里等于不存在。
 * 立项当时(枚 `cad7ba153a` 前后)真语料 2 组里,未勾选行 13 条带 `【归并】重复登记副本` 注记
 * (归并器已正确标注过的副本)、只有 1 条不带。
 *
 * **为什么这不是纯洁癖 —— 它会写坏台账(这是本条真正紧急的理由)**:
 * `plan-tasks-merge.mjs` 的 F1 自愈写路径随后对**每一条 F1 命中的 open 行**
 * 真把复选框翻成 `[x]`。改前 `--heal --commit` 会把 `O19b#剩余4列故意不并` 的
 * **持有行翻成已完成** —— 而那一行的未勾选是**真状态**:
 * 它同主键的 done 行自述"列+GIN 下线立迁移票 G-1058625",
 * 即同主键下**还有一张新开的活票**。翻它= 把未完成登记成已完成,并丢掉那张活票的指针。
 * ⇒ 这不是"假红",是**自动替人做决定**。
 *
 * ── 档 B(「持有行只报数不问责」)2026-10-06 现读复核:**判据不可实施,已放弃** ──
 *
 * 立项时设想的档 B 是:剩下的那 1 条持有行是**指针**而非独立活票,放进 `forks` 会
 * 让棘轮常红。放弃有三条独立理由,每条都取自现读(`git show HEAD:PROJECT_PLAN.md`):
 *
 * ① **红已经不存在了,档 B 无红可修**。`node scripts/plan-tasks.mjs --forks` 现读 **0 组**
 *    (基线 `scripts/plan-task-state-baseline.json` 的 `F1` 也是 0)⇒ 棘轮**当前是绿的**。
 *    `O19b#剩余4列故意不并` 那组现读 **14 行全部 `done`、0 行 open** —— 拍板②已于
 *    2026-10-05 按 B 案执行(`extra_metadata` 摘除,枚 `5c3abb296f`),票面自己写着
 *    "列+GIN 下线立迁移票 G-1058625"。**当年那条"持有行"已随该组一并结清,不再是 open 行。**
 *    ⇒ 在红为 0 的格上动判据,是§12e 的**纯削判据**:不修任何东西,只减覆盖面。
 *
 * ② **判据在本库量不出分辨力(真语料实测,非推理)**。任何基于文本措辞的"持有行"判据,
 *    作用面**恰好**是档 A 豁免不掉的那批行(带机器可读注记的行已被 `DUP_POINTER_RE` 全部豁免):
 *    现读 open1940 行 / 不带注记 637 行。三条候选在这一档上的命中与**人工判读结果**:
 *      - C1「(另开|已开|新开|立|拆)…票」交接措辞:命中 18 行,其中 **17 行含验收/归属类实质内容**
 *        (如 L8765 `G-624` UUID 收紧 2580 字带租约、L1565 `D43` 会话内快捷笔记带 phase 矩阵验收)
 *        ⇒ **它们是真活票,不是指针**。
 *      - C2「正文出现【归并】/存活于 L\d 等机器可读指针」:命中 7 行,**逐条读完,7/7 是真活票** ——
 *        因为`【归并】` 在这些行里是**议题对象**(如 L8266 `G-814417` 这一票的主题就是
 *        "归并器产出的〔【归并〕〕指针被 titleOf 当标题"),不是"本行是副本"的自我标注。
 *      - C3(两者兼具):命中 1 行(L8266),**同一例假阳性**。
 *    ⇒ 被提议当判据的信号,实测度量的是"这一行在谈论票据机制",不是"这一行是指针"。
 *
 * ③ **当年那一例本身就不是纯指针**。立项笔记自己写着那条持有行的注记是
 *    「本行是**两半**…所以这一行不该算进"今晚就能做"的活:等 owner 拍板」,
 *    且同主键 done 行明写"拍板②**未动任一侧**⇒ ② 仍开着"
 *    ⇒ 它的未勾选是**真状态**(有一半的活确实没干),把它问责**不是误报**。
 *    也就是说,档 B 想豁免的那一格,连它自己都不是纯指针。
 *
 * **为什么这条现在也不能"顺手补上"**:§12e 的削判据禁令不分动机。红为 0 时任何放宽都是净损失,
 * 而按 ② 三条候选的实测假阳性(18 行里 17 行、7 行里 7 行),一个错的启发式会**永久放过真活票**
 * —— 比棘轮红着更糟(红会被人看见,放过不会)。真要重开这一格,前置是**持有人在正文写下
 * 机器可读的持有行标记**(就像 `DUP_POINTER_RE` 当初那样),而不是从散文里猜语义。
 *
 * **为什么不动 `groups`/`dupOpen`/`dupDone`**:`forks`/`dupOpen`/`dupDone` 三者由**同一个 `all`**
 * 派生。若在分组阶段 `continue` 掉带注记行,`dupOpen` 会被连带腰斩 ——
 * 实测 `counts.dupOpenGroups` 会从 **213 变成 1**,而 `dupOpenCopies` 判红用的那个数不变。
 * 那就不是修 F1,是**悄悄把 F4 的报数档关了**(本仓踩过的坑:报数在、判据瞎)。
 * 故本判据**只在 `forks` 的派生处**做过滤,`groups`/`dupOpen`/`dupDone` 一律原样返回。
 *
 * 反向防线:某主键**唯一**的 open 行带注记时,该组剔完就没有 open 了⇒ 自然退出 F1,
 * 不会被"带注记"三个字静默放过(这与 `planPrefixNestedPointer` 的"holder 自身不带注记"
 * 口径一致,:670/:684/:686)。
 */
export function findForks(content) {
  const groups = new Map()
  for (const r of parseTaskRows(content)) {
    const k = compositeKeyOf(r.raw)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, { key: k, open: [], done: [] })
    groups.get(k)[r.state].push(r)
  }
  const all = [...groups.values()]
  // 与 F4(`findDupOpenCopies`:472)同形的剔副本口径 —— **同一件事只在一个地方判**。
  const liveOpenOf = (g) => g.open.filter((r) => !DUP_POINTER_RE.test(r.raw))
  return {
    groups: all,
    forks: all.filter((g) => liveOpenOf(g).length > 0 && g.done.length > 0),
    dupOpen: all.filter((g) => g.open.length > 1),
    dupDone: all.filter((g) => g.done.length > 1),
  }
}

/**
 * 史证行的唯一正则:diff 里**新增**的一枚 `- [x] ✅(日期)…` 行(调用方须先剥掉 diff 的 `+` 前缀)。
 * 这里是唯一一份 —— plan-tasks 的历史遍历拿它判"这行是翻勾行",自测拿它构造史证;
 * 两处各写一份必然漂开(而有史证这一条是 F10 全部判据的前提,漂开即整维失明)。
 */
export const FLIPPED_ROW_RE = /^\s*- \[x\] ✅\(\d{4}-\d{2}-\d{2}\)/

/**
 * F10「翻勾回写候选」(2026-10-08 立,补守门 130 缺的那个维度)。
 *
 * ## 它补的是哪一格
 * F1(`findForks`)判的是"同一复合主键下 `- [x]` 与 `- [ ]` 并存",前提是**至少有一份已勾幸存**。
 * 而"翻勾被整块写回旧态"那一型**已勾份数 = 0**,F1 结构上看不见(同日亲历两次:G-814406/407/796
 * 的 ✅ 被并发回写顶回未勾,靠人肉逐张发现;事后一次性尺子又扫出 8 个同类候选)。
 *
 * ## 三条同时成立才成候选(缺一不可)
 *   ① **有史证**:历史上某枚提交确实**加过**该复合主键的 `- [x] ✅(日期)…` 行
 *      (`flippedRows` 由调用方遍历 git 历史 diff 取得 —— 本函数**不碰 git**,只吃证据);
 *   ② 结论面该主键**已勾份数 = 0**(有已勾份就是 F1 的射程,不归本维);
 *   ③ 该主键在结论面**仍有未勾行**。
 *
 * ## 为什么产出是候选而不是结论(分流口径)
 * "被回写"与"有人复核后有意重开"在**未勾行的文本**上同形。唯一线索是与**首次翻勾行**逐字比措辞:
 *  - 逐字等值 ⇒ 只是勾选被抹回同一句 ⇒ `verdict='rewrite'`(回写型);
 *  - 措辞已变(多半带了重开说明)⇒ `verdict='undetermined'`(未判定,交人工)。
 * **绝不允许据此自动翻勾** —— 自动翻勾 = 替别人否决判断(§16 越权同型)。
 *
 * ## 分流必须走**复合主键**(编号 + 标题前缀逐字等值)
 * 裸编号分组会串味:同编号不同题的并存撞号(如同一号下既有"二进制出口"又有"首页轮播")会让
 * "按编号数已勾份数"把两个不同议题并成一件事。故本族一律复用 `compositeKeyOf`(它内部已含
 * `titleOf` 归一),不在此处另抄一份"什么算同一件事"。
 *
 * ## 瞬时性纪律
 * 本判据的候选集是**瞬时**的(post-commit 自愈层会把勾带回来),所以 `content`(结论面)与
 * `flippedRows`(扫描面)**必须同轮取**:不得先扫一遍历史、再另开一次 git 取结论面,
 * 否则报出来的候选早已被别人修掉(本仓"消红前先复测"同型)。
 *
 * @param content 当次台账面全文(调用方钉住的 HEAD blob)
 * @param flippedRows 史证数组:`{ raw, sha?, day? }`(raw = 历史上**新增**的 `- [x] ✅…` 行,前导 `+` 已剥)
 * @returns {{candidates:Array<{key:string,id:string,firstSha:?string,firstDay:?string,openLines:number[],verdict:'rewrite'|'undetermined'}>, sweptKeys:number, unkeyable:number, undetermined:number}}
 */
export function findReopenedFlipCandidates(content, flippedRows) {
  // 同一主键可能被多次翻勾(每次记**首次**,票面口径:"与首次翻勾行逐字比措辞")
  const evidence = new Map()
  let unkeyable = 0
  for (const f of flippedRows ?? []) {
    const raw = typeof f === 'string' ? f : f?.raw
    if (typeof raw !== 'string') continue
    const k = compositeKeyOf(raw)
    // 史证行**给不出复合主键**(退化题面/无编号)⇒ 分不出它属于哪件事,只能落"无主键史证"计数:
    // 把它硬塞进某个键就是拿一个会误配的键去做事(与 compositeKeyOf 头注同一条禁令)。
    if (!k) {
      unkeyable += 1
      continue
    }
    if (!evidence.has(k)) evidence.set(k, { raw, body: bodyOfRow(raw) ?? '', sha: f?.sha ?? null, day: f?.day ?? null })
  }
  const groups = new Map()
  for (const r of parseTaskRows(content)) {
    const k = compositeKeyOf(r.raw)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, { done: 0, open: [] })
    const g = groups.get(k)
    if (r.state === 'done') g.done += 1
    else g.open.push(r)
  }
  const candidates = []
  for (const [key, ev] of evidence) {
    const g = groups.get(key)
    if (!g) continue // 结论面连该主键都没有 ⇒ 连未勾行都没有(整行可能被删)⇒ 不成候选
    if (g.done !== 0) continue // 仍有已勾份 ⇒ F1 射程,本维不重复判债
    if (!g.open.length) continue // 没有未勾行 ⇒ 不是"翻勾被顶回未勾"
    const openBodies = new Set(g.open.map((r) => bodyOfRow(r.raw) ?? ''))
    candidates.push({
      key,
      id: key.split('#')[0],
      firstSha: ev.sha,
      firstDay: ev.day,
      openLines: g.open.map((r) => r.line),
      verdict: openBodies.has(ev.body) ? 'rewrite' : 'undetermined',
    })
  }
  candidates.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
  return {
    candidates,
    sweptKeys: evidence.size,
    unkeyable,
    undetermined: candidates.filter((c) => c.verdict !== 'rewrite').length,
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

/**
 * **派单口径专用**的第二个副本指针形态(2026-10-06立,G-1058653)。
 *
 * 病:`DUP_POINTER_RE` 只认「【归并】重复登记副本」一种措辞,而台账里另有一族**逐字同形**的
 * 机器可读指针 —— 行首形如 `- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动
 * 勾选;当前状态见…那条`。它们**逐字自述"只加指针不动勾选"**,即`DUP_POINTER_RE` 当初被立出来
 * 要认的那件事(:524 头注「已写明"重复登记副本、不再单独派单"的行也不进派单口径」),只是换了措辞。
 * 现读 9 行(`副本指针(编号 4·观察期 / 62 / 63 / 75 / 51 / P1-①)`),**9/9 以"活待办"身份进派单口径**
 * ⇒ 派单人会照着虚高数字把同一件事再派一遍,而账面看起来已经处理过了。
 *
 * **为什么不并进 `DUP_POINTER_RE`**(这是本条最重要的取舍):那个正则有 30+ 消费点 ——
 * `plan-tasks-merge.mjs` 靠它判"这一行是副本"来决定改不改号、`plan-collide-renumber-*` 靠它
 * 认归并对象、`union-converge` / `measure-plan-block-migration` / `plan-merge-note-attribution`
 * 各自按它分族。给它加一个分支 =让那 30 处**同时**开始认这一族,任何一处的行为变化都算在
 * 这次改动头上,而其中至少`renumber` 那条链的行为变更后果是"改号",不是"派单口径少一行"。
 * 故**并列导出、只在这里(派单口径)消费**,影响面 = 少派 9 行,其余 30+ 处逐字不变。
 *
 * **为什么这不是 §12e 的"从散文猜语义"**(:466 头注把那条路封了):那三条被否证的候选
 * (C1「(另开|已开|新开|立|拆)…票」18 行命中里 17 行假阳性、C2「正文出现【归并】」7 行 7/7 假阳性)
 * 共同点是**从自由散文里猜语义**。本族相反:行首是**固定字面**`副本指针(编号 …`,冒号全/半角两种,
 * 编号形态不限(数字 / `4·观察期` / `P1-①`)—— 判据锚在**行首标记**,不是锚在正文里的一句话。
 * 这正是 :466 头注写下的前置("持有人在正文写下**机器可读的**持有行标记(就像 `DUP_POINTER_RE`
 * 当初那样)")。
 *
 * **反向防线(这一条是被自测逼出来的,不是设想的)**:窗口必须**只容状态装饰**。
 * 第一版写的是 `[^\n]{0,24}?`(复选框后 24 字内任意内容),自测立刻抓到假阳性:
 * `- [ ] 某某票 正文里提到副本指针(编号 62) 这个说法但本行是独立活账` 被误认 ——
 * "某某票 正文里提到" 才12 字就落进窗口。**这正是 :466 头注否决散文启发式的那一型**
 * (窗一宽,"提到"与"就是"就分不开了)。收紧成:复选框 → 只许租约/状态装饰 → 字面 `副本指针(编号`。
 * 装饰集合刻意保守,只放实测里`parseTaskRows` 认的那几种;**将来若出现新的状态装饰,
 * 正确做法是在这条正则里显式加一条,并同时补一条"新装饰的真活票不该被认"的反向用例**,
 * 而不是把窗口重新放宽 —— 放宽是本条唯一禁止的改法(它会把豁免变成放过真活票)。
 * 收紧后实测:真指针 4147/4147 全认、漏 0;非指针误认 **0**。
 */
export const COPY_POINTER_ROW_RE =
  /^- \[[ x]\](?:（[^）\n]{0,40}）|\([^)\n]{0,40}\)|\s|　|\*|（进行中|\*\*){0,3}副本指针\s*[（(]编号\s*[^）)\n]{1,24}[）)]/m

/**
 * 派单口径认的「这一行已被标注为副本」全集 —— `DUP_POINTER_RE`(原族) ∪ `COPY_POINTER_ROW_RE`
 * (`副本指针(编号 …)` 行首族,见上条头注)。刻意**只有一个**判据出口:两个正则并列导出但判据本身
 * 只在这里合成一次,避免"同一件事两处各判"(那正是 `DUP_POINTER_RE` 当初被立成单一来源的原因)。
 */
export function isClaimExcludedPointer(raw) {
  return DUP_POINTER_RE.test(raw) || COPY_POINTER_ROW_RE.test(raw)
}

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

/**
 * G-814403 F4c:**同题"前缀套叠"副本** —— 一方的**整行正文**是另一方的**精确前缀**。
 *
 * ── 这一族为什么对 F1/F4/F4b 同时隐身(2026-09-29 现读量化,不是推理)────────────
 * 头号症状不是"账面多几行",而是**已闭环的票在派单口径里仍是活账**。三把尺子各有一道
 * 漏口,而这一族恰好同时踩满三道。**每条都按现读数字写,不看票据怎么猜**(第一版这里把 ②
 * 写成"F4 结构上量不到本族",实测是**错的**,已按真读数改;下一个人若要改这段,先重跑那把尺子):
 *  ① **F1**(`findForks`)只判 `open.length>0 && done.length>0` 的组。并发重放把同一件事的
 *     不同增长阶段各带回一份时,被截断的那份与完整那份**通常同态**(实测 223 组里
 *     **0 组**两态并存、197 组全 open / 26 组全 done)⇒ F1 结构上不可能命中,连"报数"都不产生。
 *  ② **F4**(`findDupOpenCopies`)第一道闸就把带 `【归并】重复登记副本` 指针的行剔掉,第二道
 *     要求 `live.length >= 2`。而本族的**长行几乎都已被标过指针**(实测 1054 对里长行带指针
 *     **981 对**、短行带指针 **0 对**)⇒ 每组剥完指针只剩 1 行 ⇒ `live.length < 2` ⇒
 *     直接 `continue`(实测 223 组里 **200 组**走这条分支)。组数在 F4 里飘着
 *     (`dupOpenGroups` 现读 253),**"副本行"那一维却读 0** —— 这就是"报数在、判据瞎"。
 *     ⚠ 校准一句以免下一个人被自己的夹具骗:对一个**全 open 且无指针**的小夹具,F4 是
 *     **看得见的**(会数出 2 个副本)。本族之所以对它隐身,靠的是"长行已被标过指针"这个
 *     **现场状态**,不是判据的形式限制。
 *  ③ **F4b**(`findVerbatimDupOpenRows`)只认**逐字等值**且显式 `if (compositeKeyOf(r.raw)) continue`
 *     —— 本族有主键 ⇒ 逐字等值那一族也不收。
 * 三条各看自己的盲区,合起来的结果是:**这一族在所有判据的"债"那一栏里读 0,而它真实存在。**
 * 门 71 只防丢行不防重行,同样看不见。
 *
 * ── 一个必须知道的自指事实:出口清零的成因是"前缀关系被破坏",不是"被过滤"────────
 * 副本指针追加在**行尾**,而行尾正是长行比短行多出来的那一段 ⇒ 一旦给短行加了指针,
 * `long.startsWith(short)` 立刻为假,这一对从本判据面前消失。**本判据内部没有任何一行
 * `DUP_POINTER_RE` 过滤**(那道在 F4 里)。所以"人工指定 holder 后该族清零"是**结构上**成立的,
 * 而不是靠一条会被人误读成"过滤"的隐式规则。镜像 C7 逐字钉住了这一条。
 *
 * ── 判据(唯一一条,不得靠相似度)────────────────────────────────────────
 * **同主键**(逐字复用 `compositeKeyOf`,它内部已含 `titleOf` 归一 —— 本族因此自动继承
 * `titleOf` 的每一处修正,不在此处另抄一份"什么算同一件事")**且**一方的 `raw` 是另一方
 * `raw` 的**精确前缀**(`b.startsWith(a) && a.length < b.length`,逐字、无空白归一、无相似度)。
 * 为什么必须是精确前缀而不是相似度:前缀关系是**可证伪的**——只要短行不是长行的开头就立刻不成立,
 * 而 Jaccard 分数对本仓记过的那 25 条低分互含一样会响(见本文件头注:相似度只配报数不配判红)。
 *
 * 抄近路会被本族自己顶出来:**按"长度"判正本是错的**,票面实测 754 ⊂ 1372 ⊂ 1767 逐层包含,
 * 机器若按长度猜正本,一次 append 就会把指针挂到被截断的那份上,而被截断的那份恰是**没有**
 * 最新证据的那一份。本判据因此**只报数 + 逐条点名**,正本由人工经 `--match-prefix-holder` 指定。
 *
 * ── 定级(照仓内教训:新维度起步不得接 blocking)──────────────────────────
 * 存量现读 223 组,把它接成 blocking 等于造一道**与任何提交都无关的恒红门**(§12e 同型),
 * 每台每次提交都被逼跳门、连带其余全部守门对每次提交作废(§12f)。故**只报数并逐条点名**,
 * **不进 `probe`(差值棘轮)、不判红**;升 blocking 的前置 = 存量归零(票面明写)。
 * 与 F9 同型的处置:存量只报数,红路留空。
 */
export function findPrefixNestedCopies(content) {
  const groups = new Map()
  for (const r of parseTaskRows(content)) {
    const k = compositeKeyOf(r.raw)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, { key: k, rows: [] })
    groups.get(k).rows.push(r)
  }
  const nested = []
  for (const g of groups.values()) {
    // 同一组内两两判"A 是 B 的精确前缀"。组内行数极小(实测中位数 2),全对比不是复杂度问题。
    for (const a of g.rows) {
      for (const b of g.rows) {
        if (a === b) continue
        // ⚠ 下面两道守卫是 C8 源码锁逐字钉着的形状(`plan-task-prefix-nested.test.mjs` 按文本锁它),
        // 拆不得;而 F9 的"题面并桶"要问**同一条**关系,那一侧走 `isExactPrefixNesting`(唯一实现)。
        // 两处写法由最后这条**自毁式对账**绑住:任何人只改一侧,当场炸而不是静默漂开 ——
        // 判据漂移的两种方向账面都是绿的,能兜住它的只有"让不一致无法安静"。
        if (a.raw.length >= b.raw.length) continue
        if (!b.raw.startsWith(a.raw)) continue
        if (isExactPrefixNesting(a.raw, b.raw) !== true)
          throw new Error(
            `isExactPrefixNesting 与本函数的逐字守卫不再同真(L${a.line}/L${b.line})⇒ 前缀关系有了第二把尺子`,
          )
        nested.push({
          key: g.key,
          short: a, // 被截断的旧阶段副本
          long: b, // 完整的那一份
          lenShort: a.raw.length,
          lenLong: b.raw.length,
          state: g.rows.some((r) => r.state === 'open') ? 'open' : 'done',
        })
      }
    }
  }
  // 同一对 (short,long) 只算一次:三层套叠 754 ⊂ 1372 ⊂ 1767 会产出 3 对(逐层),这是**正确的**
  // ——每一层都是一次独立的"截断回放",少报一层就等于放过一次重放。逐条点名按行号定序,保证可复现。
  nested.sort((x, y) => x.short.line - y.short.line || x.long.line - y.long.line || x.lenShort - y.lenShort)
  const groupsTouched = new Set(nested.map((n) => n.key))
  return { pairs: nested, groupKeys: [...groupsTouched].sort() }
}

/** 票面给这一族起的判据名(`prefixNestedCopies`)的**可 grep 锚点** —— 别名,不是第二份实现。
 *  ⚠ 存在的理由是**验收面**:派单口径是"按票面给的判据名 `git grep` 核命中"。
 *  若这一族只以 `findPrefixNestedCopies` / `prefixNestedGroups` / `prefixNestedPairs` 这几个名字
 *  存在,那条验收命令会读出 **0 命中** —— 而 0 命中恰恰是本票要消灭的那种读数。
 *  **不能让证据入口自己读 0**。(本仓记过多次"把没判写成判过了",这里是从另一侧踩到同一格。)
 *  它是 `findPrefixNestedCopies` 的**同一个函数引用**(不是包装、不是重实现),
 *  所以两份判据漂移在结构上不可能发生;镜像 C8 逐字钉住这一条(别名必须 === 原函数)。 */
export const prefixNestedCopies = findPrefixNestedCopies

/**
 * "A 是 B 的**精确前缀**"这一关系的**唯一**实现(逐字、无空白归一、无相似度)。
 *
 * 为什么必须只有一份:F4c(`findPrefixNestedCopies`)与 F9 声明位题面并桶(② 前缀套叠那一型,
 * 2026-10-05 修口径)问的是**同一条**关系 —— 而 §1"判据必须覆盖门自己产出的形态"意味着
 * F9 若另抄一遍 `startsWith`,F4c 日后收紧/放宽时 F9 会静默漂开(本仓对 code-mask /
 * box-geometry 各记过同一条)。两处都从这里取,漂移在结构上不可能。
 * 长度严格小于 + 逐字 startsWith,与 `findPrefixNestedCopies` 改动前的两道 guard 合取**逐字等价**
 * (镜像测试里用 F4c 的存量读数钉形:199 组 / 928 对不得变化)。
 *
 * @param {string} a 较短的一侧 @param {string} b 较长的一侧 @returns {boolean}
 */
export function isExactPrefixNesting(a, b) {
  const s = String(a ?? '')
  const l = String(b ?? '')
  return s.length < l.length && l.startsWith(s)
}

/**
 * F4c 的**唯一出口**:`--match-prefix-holder "<持有行原文片段>"` —— 人工指定正本后,
 * 其余同组副本只加"重复登记副本"指针(F4 口径)、**不动勾选**(F4 口径)。
 *
 * 为什么不自动挑正本:见 `findPrefixNestedCopies` 头注 —— 按长度猜在"逐层前缀包含"上必然挑错,
 * 而挑错的代价是**把指针写到缺证据的那一份上**,之后所有派单口径都指着它。
 *
 * 契约(三条里最要紧的一条是"大声失败"):
 *  - `holderFragment` **必须逐字命中被审面上的某一行**,否则**抛错**而不是静默返回空动作。
 *    静默退化是本仓最高频的失效型:调用方拿到"改了 0 行"会读成"这一族已经清零"。
 *  - 片段必须**唯一定位**:命中 ≥2 行 ⇒ 抛错(机器不许替人挑是哪一行)。
 *  - 只在 F4c 点名的族内动;带指针的行不再改(重复加指针会把行尾堆成两段同文)。
 *  - **绝不动 checkbox** —— 翻勾是 `--heal` 那一维的职责(见 F4 头注与 §1 一行不删)。
 *
 * @returns {{ok:true, holderLine:number, pointered:Array<{line:number,key:string}>}|{ok:false, reason:string}}
 */
export function planPrefixNestedPointer(content, holderFragment) {
  const frag = String(holderFragment ?? '')
  if (!frag.trim()) return { ok: false, reason: 'holder 片段为空 ⇒ 拒绝执行(机器不许猜正本)' }
  const rows = parseTaskRows(content)
  const hits = rows.filter((r) => r.raw.includes(frag))
  if (hits.length === 0) {
    return {
      ok: false,
      // 逐字带上片段(截断到 60 字防日志被一行原文撑爆),并点名"这不是'这一族没配上'"
      reason: `holder 片段在本次被审面上 0 命中:「${frag.slice(0, 60)}」—— 拒绝执行(不等于"这一族没配上";换面或改片段)`,
    }
  }
  if (hits.length > 1) {
    return {
      ok: false,
      reason: `holder 片段在本次被审面上命中 ${hits.length} 行(L${hits.map((r) => r.line).join(',L')}):「${frag.slice(0, 60)}」—— 拒绝执行(片段必须唯一定位,机器不替你挑正本)`,
    }
  }
  const holder = hits[0]
  if (DUP_POINTER_RE.test(holder.raw)) {
    return { ok: false, reason: `holder 行 L${holder.line} 已带副本指针 ⇒ 拒绝执行(它已是副本,不能当正本)` }
  }
  const holderKey = compositeKeyOf(holder.raw)
  if (!holderKey) {
    return { ok: false, reason: `holder 行 L${holder.line} 没有复合主键 ⇒ 不属 F4c 族,拒绝执行` }
  }
  const { pairs } = findPrefixNestedCopies(content)
  // 只处理"holder 是那一对的长行"或"holder 是短行"两种关系里 holder 在场的那一侧:
  // 两种都要处理 —— 人工可能指定任一端为正本(票面实测三层的中间那份也是合法正本选择)。
  const targets = []
  for (const p of pairs) {
    if (p.key !== holderKey) continue
    if (p.long.line === holder.line) {
      if (!DUP_POINTER_RE.test(p.short.raw)) targets.push(p.short)
    } else if (p.short.line === holder.line) {
      if (!DUP_POINTER_RE.test(p.long.raw)) targets.push(p.long)
    }
  }
  return {
    ok: true,
    holderLine: holder.line,
    pointered: targets.map((r) => ({ line: r.line, key: holderKey })),
  }
}

/** F2:正文自带的"闭合/作废声明"字面。窄集合,宁漏不误伤 —— 见门 120 的"名单要有正向证明"。 */
export const VOID_MARK_RE =
  /\[[A-Za-z]{1,3}\d+[a-z]*\s*判[:：][^\]]*(?:已完成|已闭环|已收口|已清偿|读数过期|裸副本)|勿照本行派单/
export function findVoidRows(content) {
  return parseTaskRows(content).filter((r) => r.state === 'open' && VOID_MARK_RE.test(r.raw))
}

/**
 * F3:`L<行号>` 式证据指针,核它指向的行是否仍是同一复合主键的条目行。
 *
 * **为什么是"族表"而不是一条正则**(2026-09-28 实测逼出来的):归并器自己产出的指针措辞有两种,
 * 而旧判据只认最早那一种 —— HEAD 面现读 `存活于 L<行号>` **0 处**,而 `同主键/逐字相同的另一条
 * 登记在 L<行号>` 244 处,于是 `rotatedPointers` 一路报 0,同时台账里每一条行号指针都在按 §1
 * 明文禁止的方式腐烂("行号在任何一次 append 后都会挪位…实测复核通过率 0/27")。
 * 判据只看自己立项那一型、看不见自己后续产出的那一型,是本仓记过最多次的失明形态。
 * 族表同时是**修复出口的配对清单**:任何一族被加进判据面,`plan-tasks-merge.mjs` 必须给出对应的
 * 改写规则,否则镜像测试的"族表与修复规则必须同集"直接判红 —— 免得又出现"判得到、修不了"。
 */
export const POINTER_FAMILIES = [
  { id: 'alive', source: '(?:逐字)?存活于\\s*L(\\d{1,6})(?:\\s*的同编号登记)?' },
  { id: 'dup', source: '(?:同主键|逐字相同)?(?:的另一条|的权威|的)?(?:完成)?登记在\\s*L(\\d{1,6})(?:\\(本行无编号主键\\))?' },
  // 第三种拼法由 2026-09-28 的活体对照抓出来:台账里另有一族「(另|参)见 L####」「指向 L####」的证据引用,
  // 宽尺数到 9 处而判据只命中 1 处 —— 又是"判据落后于产出形态"(一天内第三次)。
  { id: 'ref', source: '(?:另见|参见|见|指向)\\s*L(\\d{1,6})' },
]
/**
 * 哪些族**没有**自动出口,以及为什么。
 * `ref` 一族的 7/9 处指向的行**已经不是条目行或根本不存在**(实测)—— 作者的意图无从推断,
 * 把 L#### 换成"当下那一行的内容锚点"等于替他把错指针改成看起来对的错指针。
 * 判据的红与修的口子是两件事:**看得见**是门的责任,**猜得出**不是。
 */
export const POINTER_NO_AUTO_REPAIR = { ref: '目标行已腐烂且意图不可推断 ⇒ 只能由该行持有人改写(点名不自动修)' }
/**
 * 行号指针的**原始**出现面(比全部族都宽,只用于"族表有没有落后于产出形态"的活体对照,不参与判据)。
 * 为什么要单独留一把宽尺:2026-09-28 一天内同一格栽了三次 —— 族表只认「存活于」时,归并器自产的
 * 「另一条登记在 L####」244 处全隐身;把 dup 族放宽后,又出现「…的完成登记在 L13178」这种新拼法。
 * 每次都是"账面 0 / 面上有"。宽尺不判红,只用来问一句:**判据没命中而宽尺命中 ⇒ 判据瞎了**。
 */
export const POINTER_RAW_REF_RE = /(?:存活于|登记在|见|指向)\s*L(\d{1,6})/g

/** 条目行(带复选框)的形状 —— 判据、归档反查、出口资格三处共用这一份,不得各抄正则。 */
export const ENTRY_LINE_RE = /^\s*[-*]\s\[[ xX]\]/

/**
 * F3 的**第二条出口**:指针指向的行已经不在面上了,但它当初指的那条登记
 * **被归档搬走了** —— 归档件受版本控制、逐字可查,所以"同主键的另一条在 `<归档件>` 的条目「…」"
 * 是一句**可核验的真话**,而不是行号(§1 第 3 条要求的正是内容锚点形态)。
 *
 * 索引只从**被审面上的归档件**推得(调用方给文本,本层不读磁盘也不读 git —— 面归调用方管,
 * 见 `check-project-plan-archive.mjs` 的 `archiveFaceEntries`,两处共用那一份面判据)。
 * 只用复合主键做判据、不做相似度:与本层其余四把尺子同一条规矩。
 */
export function archivedEntryIndex(archiveTexts) {
  const byKey = new Map()
  for (const item of archiveTexts ?? []) {
    const name = item?.name ?? ''
    for (const line of String(item?.text ?? '').split(/\r?\n/)) {
      if (!ENTRY_LINE_RE.test(line)) continue
      const k = compositeKeyOf(line)
      if (!k || byKey.has(k)) continue
      byKey.set(k, { name, title: k.slice(k.indexOf('#') + 1) })
    }
  }
  return byKey
}

/**
 * 「…」与反引号包裹的片段是**叙述**(在描述这个形态),不是可执行指针 ——
 * 与守门 109 对 `（进行中）` 的同一条判序一致(它把反引号内的认领标记排除在"挂牌"之外)。
 * 不这么做会有两个后果:① 记录这一型缺陷的台账行自己被门判成违规;② 修复出口会把
 * 说明文字里的样例改写成锚点,把注释当数据改了(本仓"镜像测试只复读实现"的同族失效)。
 */
function quotedRanges(line) {
  const out = []
  let s = -1
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '「') s = i
    else if (c === '」' && s >= 0) {
      out.push([s, i])
      s = -1
    } else if (c === '`') {
      const j = line.indexOf('`', i + 1)
      if (j > i) {
        out.push([i, j])
        i = j
      }
    }
  }
  return out
}
const inQuoted = (ranges, at) => ranges.some(([a, b]) => at >= a && at <= b)

/** 判据命中数必须等于宽尺在**非引用体**上的出现数 —— 不等就是族表漏了一族(交调用方喊"失明",不冒绿)。 */
export function pointerBlindness(content) {
  const rows = parseTaskRows(content)
  let raw = 0
  for (const r of rows) {
    const q = quotedRanges(r.raw)
    const re = new RegExp(POINTER_RAW_REF_RE.source, 'g')
    let m
    while ((m = re.exec(r.raw)) !== null) if (!inQuoted(q, m.index)) raw++
  }
  return { rawRefs: raw, judged: findRotatedPointers(content).length }
}
export function findRotatedPointers(content) {
  const lines = String(content).split(/\r?\n/)
  const bad = []
  const rows = parseTaskRows(content)
  /**
   * 「与本行正文逐字相同,可按正文检索」这句锚点的**唯一事实依据**,是"面上还有另一份与本行
   * 逐字相同的条目行"。旧版没量这一条,而是让 `compositeKeyOf(t) === compositeKeyOf(r.raw)`
   * 一句兜两种语义 —— 而**两边都没有主键**时它也成立(`null === null`),后果有两层:
   *  ① 出口会给一行既不同主键、也不同正文的行写上"逐字相同",那是替别人编证据;
   *  ② F3 的"可自动收口"这一维会**自己长回来**:面上另有 200+ 处无自动出口的行号指针,任何一次
   *     append 挪了行号,就可能有一处的目标恰好落到"也是无主键的条目行"上 ⇒ 该维凭空 +1,
   *     与本次提交内容毫无关系(2026-09-28 实测:归并落地后 8 分钟内 F3(自动) 由 0 回到 1,
   *     而那一行在面上逐字相同的份数是 1)。这一维挂在 blocking 提交链上,自己会长红 ⇒ 每台每次
   *     提交被逼 `--no-verify` ⇒ 全部守门对该提交作废(§12f 那一型)。
   * 本层**早已写明** null 是"没有主键"而不是"主键相等"(见 `compositeKeyOf` 头注;F4 抓不到无主键
   * 孪生行时才另起 F4b 那把逐字尺子,同一条理由)—— 所以这里是把 F3 对齐到本层已声明的语义,
   * **不是放宽判据**:自动收口的资格只认两种可核验事实 —— 同主键(两侧都有主键且逐字等值)
   * ∨ 逐字孪生(本行确有另一份) —— 二者皆不成立仍照旧计"无出口交人工",一处都不会从账上消失。
   */
  const verbatimCount = new Map()
  for (const r of rows) verbatimCount.set(r.raw, (verbatimCount.get(r.raw) ?? 0) + 1)
  for (const r of rows) {
    const quoted = quotedRanges(r.raw)
    // 一条指针只归第一个命中的族:族表之间是**有意的宽窄层次**,不做并集计数(否则同一条被算两次,
    // 而 F3 的读数会随族表增删而跳,谁都没改台账却在涨)。
    const claimed = []
    for (const fam of POINTER_FAMILIES) {
      // 共享一个带 /g 的正则跨字符串 exec 会因 lastIndex 残留而漏匹配 —— 每行每族各开一把新的
      const re = new RegExp(fam.source, 'g')
      for (let m = re.exec(r.raw); m !== null; m = re.exec(r.raw)) {
        if (inQuoted(quoted, m.index) || claimed.some(([a, b]) => m.index >= a && m.index <= b)) continue
        claimed.push([m.index, m.index + m[0].length - 1])
        const target = Number(m[1])
        const t = lines[target - 1]
        const reason = !t
          ? '目标行不存在'
          : !ENTRY_LINE_RE.test(t)
            ? '目标行不是条目行'
            : compositeKeyOf(t) !== compositeKeyOf(r.raw)
              ? '目标行是另一条(复合主键不等)'
              : // §1 的原话是"证据指针**禁止**写行号",不是"禁止写已经指不准的行号"。
                // 只判已腐烂的那一半,等于允许 35 处"这次恰好还没挪位"的行号指针留在账上,
                // 而它们下一枚 append 就变哑 —— 旧版正是这一格,配合只认一种措辞的族表,
                // 账面报 0 而 HEAD 里 222 处指针全烂(2026-09-28 实测)。
                '行号指针即使还指得准也不许存在(§1 要求内容锚点)'
        if (reason)
          bad.push({
            line: r.line,
            target,
            reason,
            family: fam.id,
            raw: r.raw,
            /**
             * 能不能**自动**把它换成内容锚点,判据只有一条:换上去的锚点必须是真的。
             * - 目标行不存在 / 不是条目行 ⇒ 作者指的是"当时那一行",现在问不出他指什么 ⇒ 不可自动改;
             * - 目标行在、且与本行同复合主键 ⇒ 换成"同主键登记「本行键」"是真话 ⇒ 可自动改;
             * - 目标行在但是**另一条** ⇒ 换成任何锚点都是替他把错指针改成"看起来对的错指针" ⇒ 不可自动改。
             * 为什么这条必须存在:2026-09-28 实测面上 9 处行号引用里 7 处的目标行已不是条目行或
             * 根本不存在。若把它们并进"归零判据",自愈档会永远停手(= 一台新的全局失效门);
             * 若让它们自动改写,就是在编造证据。**看得见**是门的责任,**猜得出**不是。
             */
            autoFixable:
              // 两个条件缺一不可:**有出口**(该族的措辞我们能安全换成锚点)且**目标推得出来**
              // (指向的行还在、且与本行同复合主键)。少了前一条,归并计划里会有它而改写函数不动它,
              // 于是自愈档因"无可施加的改写"整轮停手(2026-09-28 实测 L88 就是这个形态)。
              !POINTER_NO_AUTO_REPAIR[fam.id] &&
              !!t &&
              ENTRY_LINE_RE.test(t) &&
              // ↓ 这一行是本层语义的落点:两侧**都有**主键且逐字等值,才算"同主键";任一侧没有主键,
              //   就退回"逐字孪生"那把尺子(与本层 `compositeKeyOf`/F4b 的既有口径同形)。
              //   写成旧版那样 `compositeKeyOf(t) === compositeKeyOf(r.raw)` 会让 null===null 通过,
              //   于是"自动收口"实际是"自动编一句核验不了的证据",且该维会随行号挪位自己长红。
              (compositeKeyOf(r.raw) !== null
                ? compositeKeyOf(r.raw) === compositeKeyOf(t)
                : (verbatimCount.get(r.raw) ?? 0) >= 2),
          })
      }
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

/**
 * 注记的**量纲**只在这里算一次(G-977960 ①,2026-10-04 立)。
 *
 * 为什么要拆两档:上面那把尺子的字符类 `[^〕]` **含换行**,所以一条注记可以横跨两行书写
 * (台账被并发登记/`git merge-file` 逐行拼接时天然会产出这种形态)。旧写法把"整文件命中数"
 * 直接当份数喂给落地闸,而额度机器(搬运感知 / 本侧自缩 / 副本指针少带)全是**逐行**算的 ⇒
 * 跨行那部分既进不了总额也进不了合法额度 ⇒ 存在"无论怎么合并都差 N 条"的不可满足三元组
 * (实测:各侧最多 622 / 结果 530 / 已扣 90+3 / 仍差 2,且欠账名单为空 —— 名单为空正是
 * "判据看不见这 2 条"的指纹,不是"没人欠账")。落地闸一红就等于全队每次台账收敛都被逼跳门
 * (§12f 同型),所以这一格必须修判据的量纲,而不是调阈值或声明放行。
 *
 * 三档定义(互不重叠,`total` 仍单独报出,免得"拆开"被读成"少算了"):
 *  - `lineAttributable` = 逐行命中数之和 —— **唯一**能和额度机器同量纲比较的那一档;
 *  - `crossLine` = 整文件命中数 − 逐行命中数(>0 的那部分,即跨行书写的注记);
 *  - `migrationArtifact` = 逐行之和 > 整文件数时为真:整文件扫描是非重叠顺序推进的,
 *    一条跨行匹配会吃掉后随行内的完整匹配 ⇒ 两把尺子天然不可能严格相等。
 *    出现这一型时 `crossLine` 归 0 并**点名**,绝不把"没看清"写成"没有问题"。
 *
 * ⚠️ 口径边界(如实登记,不得读成已覆盖):跨行注记在落地闸**只报名、不判红、不计额度**。
 * 现读 HEAD 面 `crossLine = 0`(整文件 479 条 == 逐行 479 条),所以今天不因此放过任何一条真损失;
 * 若将来合并把一条跨行注记抹掉,这一维只在报告行里点名 —— 补它需要先把"份数"的归属定义扩到
 * 行区间,那是另一票,不得顺手半做。
 */
export function mergeNoteUnits(text) {
  const s = String(text ?? '')
  const re = new RegExp(MERGE_NOTE_RE.source, 'g')
  const spans = []
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    const startLine = (s.slice(0, m.index).match(/\n/g) || []).length
    const endLine = startLine + (m[0].match(/\n/g) || []).length
    spans.push({ startLine, endLine, snippet: m[0].replace(/\s+/g, ' ').slice(0, 90) })
  }
  let lineAttributable = 0
  for (const l of s.split('\n')) lineAttributable += lineNoteCount(l)
  const total = spans.length
  return {
    total,
    lineAttributable,
    crossLine: Math.max(0, total - lineAttributable),
    migrationArtifact: lineAttributable > total,
    crossLineSpans: spans.filter((x) => x.endLine > x.startLine),
  }
}

/** 单行内的注记条数 —— 额度机器与逐行求和共用这一份实现,不得各处 `new RegExp` 再抄一遍。 */
export function lineNoteCount(line) {
  const re = new RegExp(MERGE_NOTE_RE.source, 'g')
  const s = String(line ?? '')
  let n = 0
  while (re.exec(s) !== null) n++
  return n
}

export function countMergeNotes(content) {
  // 投影到与逐行额度机器同量纲的那一档(见 mergeNoteUnits 头注的不可满足三元组)。
  // 现读 HEAD 面 total == lineAttributable == 479 ⇒ 这一改动不移动任何已有读数。
  return mergeNoteUnits(content).lineAttributable
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
    //
    // ⚠ 本档判据是**函数**而非单条正则(见 `dispositionOf`):「等的是人」这件事要看
    // **语法辖域**(否定词管的是不是这个谓语 / 这个措辞是不是正被拆掉 /
    // 这是不是别行的题面),一条正则表达不了「命中之后还要逐个护栏复核」。**别改回
    // 单条正则** —— 那会静默丢掉三档护栏,判据立刻从「零假阳性」退回「见措辞就算」
    // (本仓最贵的那种失效:数字看着正常,病已经回来)。
    //
    // **两把尺子地位对等,都要过护栏①(2026-10-07 补)**。
    //
    // ⚠️ 这里原来写成 `裸正则.test(dispositionFace(line)) || waitingHumanSelfVerdict(...) === 'self'`
    // —— 裸正则**短路**,于是整套四道护栏只挂在第二把尺子上,第一把尺(现读面 62/128 行)
    // **裸奔**:命中即判,一根护栏都不过。
    //
    // **漏的是接线那一层,不是"引号内规则不够"**(这一条纠偏很重要,别再往引号规则上打补丁):
    // 缺陷措辞 `不需要用户拍板` 写在 markdown 的 `**…**` 粗体里,而 `waitingHumanQuoteSpans`
    // 只认 `"` / `「」` / `“”` / `‘’`,**`**` 不是引号字符** ⇒ 兜底④结构上就看不见它
    // (实测该行的引号跨度只覆盖到别处 `"服务端 … 可解析性"`,压根没盖住这个措辞)。
    // 真正被漏掉的是**语法关系**:谓语前面直接顶着否定词(`不需要…`),这本是护栏①
    // 「negator 直接管辖被否谓语」能判的关系,却因为走第一把尺而没人复核。
    //
    // 第二把尺子 = `在等什么`/`在等:` 自述槽 + 等+身份+决断动词,且过三档语法辖域护栏。
    // 语义、护栏与「为什么锚语法关系而不是词形」的理由全在 `waitingHumanSelfVerdict`
    // 头注里 —— 这里是唯一接线点,别把判据抄成第二份(抄窄版 = 在自己刚修的族上失明)。
    // 只有 'self' 计入;'undetermined'(引号内且机器判不了是自指还是转述)如实漏掉,不猜。
    //
    // ⚠️ `waitingHumanDirectVerdict` **只过护栏①,不过 ②③④**(实测这么取舍的读数在
    // 它的头注里)。②③④ 是为第二把尺那套**引述通道**调的:第一把尺的候选点大量落在
    // markdown 粗体/标题引号里(`**需 owner 拍板**` 这种正文引用),把它们一并推出
    // `self` 会实测掉 6 行真等行。① 不同 —— 它判的是**谓语前的语法邻接**,与
    // 「在不在引号里」正交,所以两把尺共用它是安全且必要的。
    (line) => waitingHumanDirectVerdict(line) === 'self' || waitingHumanSelfVerdict(line) === 'self',
  ],
  [
    'waiting-env',
    /本机结构性缺|本机(无|没有|未装|起不来)|需真机|需 macOS|模拟器|开发者工具|阻塞(主体|在|于)|生产侧|暂留本地|需建表|等(并行|对端|环境|新装机)|外部(条件|服务)|线上(仍是|未|无)/,
  ],
]
/**
 * ── waiting-human 的第二把尺子:「本行在等**人**」的语法辖域判据(2026-10-07 落地)──
 *
 * 立因:上面那条 `waiting-human` 正则只认「需/待 + 拍板」一族**措辞**,于是台账里另一整族
 * 真等句**全落"现在可做"** —— 「**在等什么**:等持有人按报告逐条裁」「**它【在等什么】**:
 * 等各行持有人按 ② 改写」「等机主拍"商店安装算个人配置还是算平台级软件包"」。
 * 派单人照着"现在可做"的清单走，就会把一件**根本没人拍板就动不了**的活当今晚的活派出去。
 * 实测(现读面 3008 未勾选行):净增真等 127 行,改后 `waiting-human` 217 → 344。
 *
 * ## 为什么锚**语法关系**而不是词形(本仓在门 89 上刚付过这条学费)
 *
 * 往词表里加词 = 把病**推迟到下一个没抄进表里的词**。门 89 的 `isNegatedWiringSentence`
 * 之所以最终锚「动词被否定词**紧邻**修饰」而不是锚一张否定词/接线动词表,原因同型:
 * 词表一旦被当成判据本体,漏抄的那个词会**安静地**通过整条链 —— 判据失效的表现永远是安静。
 * 所以这里的四道闸全部锚**可判定的语法关系**(辖域 / 完成态 / 引述跨度 / 引文跨度),
 * 词形只用来**定位候选点**,不用来**决定真假**。谁承重、谁当前只管标签,见下面实测表。
 *
 * ## 双通道
 *  - **通道 A(词形定位)**:`等 + 身份 + 决断动词` 的紧凑写法(等人拍板 / 等机主给值 / 等尺子持有人裁决)。
 *  - **通道 B(结构,最抗漏抄)**:`在等什么` / `在等:` / `它在等什么` 这个**自述槽**。
 *    台账自己在留这个字段(§1 新登记三要件之②)⇒ 它不依赖任何措辞,是"有没有抄到那个词"的
 *    解药。实测砍掉通道 B 立刻**漏 12 行**(快照面 8 行)—— 它不是装饰。
 *
 * ## 四道闸(两通道共用),按**实测负载**如实登记,谁承重、谁当前冗余都写清楚
 *
 * 逐档短路实测(**现读面 1997 未勾选行**,HEAD 6fb01e5a48;2026-10-07 **独立复核**;
 * 方法与逐字读数见 `.ihui-agent/tmp/whv-verify.json` —— 逐闸单独短路 + 三闸同拆,还原后读数与基线逐项一致):
 *
 * ⚠️ **这张表在 2026-10-07 之前是错的,已据实更正。**错在**虚报承重** —— 那正是本仓记过最多次的
 *   那类失效:下一个人按表判断"②③ 反正没承重、可以删"就会把真判据删掉。两处具体错误:
 *  - **④ 的承重被高报成 +7**:单独拆 ④ 只 **+1 行**(门桶读数);`+7` 要把 ②③**一起**拆才凑得出
 *    ⇒ 那 7 行里 6 行是 ② 的功劳。**把它们记在 ④ 名下就是冒领。**
 *  - **① 的"+43 行"与门读数 +13 不是同一个量纲**:43 是 `self` **标签**口径(拆闸后 self +30 /
 *    negated −30);13 是**门桶**口径(13 行从 `waiting-env` 挪进 `waiting-human`)。两个数都对,
 *    混在一张表里会让读表的人以为"43 行待办会被误判成在等人"。
 *
 * |闸 | 锚的语义关系 | 现读面 `self` 标签贡献 | 拆掉它**门桶读数**(`waiting-human`)会变吗 |
 * |---|---|---|---|
 * | ①否定紧邻 | negator **直接管辖**被否谓语,其后只可夹虚词 | self 121(拆后 self +30 / negated −30) | **会:+13 行**(自 `waiting-env` 挪来)。**唯一在门桶读数上承重的一档** |
 * | ②消解完成态 | `解除/已/取消…的"X"状态` ⇒ 该措辞正被**拆掉** | negated 36 的其中 6 行 | **不会:0 行**(只把 `undetermined` 提前收成 `negated`,诊断标签更准) |
 * | ③引述他行 | 跨度落在引号内 + 前文指为**别行题面** | **0**(两个面实测全 0) | **不会:0 行**(标签也不动 —— 当前负载真为 0) |
 * | ④兜底:引号内默认**不**进 `self` | 跨度落在引号内且无②③标记 ⇒ 机器判不了自指还是转述 | undetermined 1 的全部 | **会:+1 行** —— 这是它**自己**的承重,不是 7 |
 * | ②③④**同拆** | —— | self +7 / negated −6 | **会:+7 行** —— 这才是"7"的真身,**它是三道合计,不是 ④ 一道** |
 *
 * ⚠️ **②③当前在门桶读数上零承重,但都不许删**(2026-10-07 复核后把这句话加重):
 *   ③ 的负载实测**真为 0**(不是"小",是两个面全 0);② 只影响标签。
 *   **不许因为"拆掉没变化"就删掉它们** —— ④一旦被放宽(例如将来决定引号内也可自指),
 *   ②③ 就是唯一还在挡"已拍板陈述"那类的闸。两者是**备份关系**,不是冗余。
 * ⚠️ **必须说清一件本轮才查出来的事(据实更正一条错话)**:曾据"单独拆 ②/③ 全绿放过"判定
 *   "没有测试咬住 ②③" —— **那条结论是错的,成因是取样面错了**:
 *   - ②③ 的标签职责用例**本来就在** `scripts/tests/plan-tasks.test.mjs`(护栏②射程核对 +
 *     `UNDETERMINED` 整档),而 2026-10-07 之前**那个文件从 import 阶段就炸**
 *     (它 import 的 `WAITING_HUMAN_SLOT_RE` 当时只有使用没有 `export`)⇒ **46 条用例一条都没
 *     真正执行过**,只跑 `plan-tasks.mjs --self-test` 看不出这件事。回补导出后 46/46 全绿。
 *   - ⇒ 真正的病不是"用例不存在",而是**入口读 0 被读成"通过"**。与 `prefixNestedCopies`
 *     那次("证据入口自己读 0")同一个病。**判据面、输出面、测试面三者任何一面静默失效,
 *     账面都是绿的** —— 所以验收必须**真的把测试跑起来**,不是看它"有测试"。
 *
 * ⚠️ ③ 的已知覆盖缺口(如实登记,2026-10-07 实测更正):`OTHER_ROW` 的字符类 `[^"「]`
 * **同时排除半角 `"` 与直角 `「`**, 所以这两类形态③ 都认不出(实测落 ④ 的 `undetermined`);
 * ③ 真正命中的是 `“…”` / `‘’…’`(实测 `negated`) —— 原文写「只有 “…” / 「…」 才命中」与
 * 实测相反, 因为 `“` / `‘` 不在该字符类里。
 * ⇒ **判它是「已知盲区」而不是缺陷, 不补**: 逐档实测③ **整条拆掉, waiting-human 读数
 * 一行不掉、标签分布逐项相同** ⇒ ③ 对门读数**零承重**; 且 `dispositionOf` 只认 `=== 'self'`,
 * `negated` / `undetermined` 同属非 self ⇒ 门读数天然免疫。
 * 而**补它是有害的**: 放宽③ 会清空 `UNDETERMINED` 档, 而那两条样本
 * (`plan-tasks.test.mjs:448` M29)**正是半角引号形态** —— 该档的存在意义就是守住
 * 「引号内机器判不了是自指还是转述 ⇒ 如实报名不猜」。补③ 等于拿一个测试级不变量
 * 换一个零收益的标签变化(门读数 91→91)。
 * ⇒ **④ 才是唯一承重闸**(拆 +1 误判), 未动。源码 `:1175` 已定的规矩同样适用:
 *   ②③ 是④的备份, **不许因为「拆了读数没变化」就删掉**。
 *
 * ⚠️ 护栏①踩过的坑(必须继承):v1 在整子句里找否定词,把 `取消打不断（等人拍板）`
 * 误判成否定 —— 那个「不」属「打不断」,后接实词「断`。改成**语法邻接**(negator 后
 * 只许夹虚词,`断` 是实词 ⇒ 不算)后修正。**不许改回"整子句里找否定词"。**
 *
 * ⚠️ 边界(如实登记,不假装覆盖):引号内但既非消解也非引述他行时,机器判不了这是自指
 * 还是转述 ⇒ 返回 `'undetermined'`,**不计入 waiting-human**。现读面 1 行(快照 1 行)
 * (`未勾那条以"等用户拍板"开头` —— 引号内容是**别行的题面**)。这一档宁漏不猜:
 * 猜成 waiting-human 是虚高(把能做的活开除),猜成 actionable 是漏报(掩盖真阻塞)。
 * 两边都是坏的,所以只**报名**并留人来看。
 */

/** 槽内「等的是人」:`等` 与身份词之间只许夹虚词/指示词。 */
const WAITING_HUMAN_SLOT_HUMAN_RE =
  /等[^。；;]{0,4}?(?:人|用户|机主|产品|持有人|人工|对方|各方|上面|领导|owner)/
/** 通道 B 的自述槽(`在等什么` / `在等:` / `它在等什么`)—— **导出是因为它是验收面**:
 *  镜像测试要按它逐条核"槽内确实点明了等的是人",而判据面之外的读者(人)也要能 grep 到它。
 *  ⚠️ 它在 2026-10-07 一度只剩**使用**没有**定义**(判据直接 ReferenceError,自测与 CLI 全挂),
 *  成因是有人按行范围重写它上方那段护栏负载表时把本行一并吞掉。
 *  **核销凭据**:`scripts/tests/plan-tasks.test.mjs` 从 import 阶段就炸(`does not provide an
 *  export named WAITING_HUMAN_SLOT_RE`)⇒ 那个文件里 46 条用例**一条都没真正执行过**。
 *  ⇒ 这条与"证据入口自己读 0"(`prefixNestedCopies` 那次)是同一个病:**入口读 0 极易被读成"通过"。** */
export const WAITING_HUMAN_SLOT_RE = /(?:在等什么|它在等什么|在等|等什么\*\*|它在哪等)/

/** 通道 A 的候选点(词形只用于**定位**,真假由护栏定)。 */
export const WAITING_HUMAN_PHRASE_RE =
  /等人拍板|等用户拍板|等产品拍板|等持有人拍板|等人工拍板|等机主拍板|等任何人拍板|等拍板|等机主给值|等机主|等用户|等尺子持有人裁决/

/**
 * 第一把尺子的候选点(`需/待 + 人 + 决断动词` 措辞族)。
 *
 * ⚠️ 它**只是候选点定位器**,不再是判据本体 —— 真假由护栏①定,裁决见
 * `waitingHumanDirectVerdict`。2026-10-07 之前它是**一条裸正则直接 `.test()` 短路**,
 * 导致整套护栏只挂在第二把尺上、这一族裸奔(`L3823` 假阳性即由此而来)。
 * **别再把它改回裸 `.test()`** —— 那会把四道护栏静默退回「见措辞就算」。
 */
const WAITING_HUMAN_DIRECT_RE =
  /需\s?[A-Za-z\u4e00-\u9fa5]{0,6}\s?拍板|需(产品|业务|运营)决策|待(产品|业务)决策|等待.{0,4}决策|需人定|需用户|待用户|待拍板|需用户确认|属 §24|请重新决定|未决决策|交人定|人来定|需人(定|拍板)/

/**
 * 护栏①否定紧邻:negator **直接管辖**被否谓语 —— negator 与被否谓语之间只可夹虚词/功能词,
 * 夹进实词就说明那个否定词管的是别的事(「打**不**断」的「不」不管辖「等人拍板」)。
 * 同型做法见 `scripts/check-gate-wiring.mjs` 的 `isNegatedWiringSentence`(门89)。
 */
const WAITING_HUMAN_NEG_GOVERNS_RE =
  /[不非无免勿别未](?:是|再|用|需要|需|会|能|得|该|要|将|可|必|须|有任何|任何人|环境条件|操作条件|技术参数)*\s*$/
/** 护栏②消解完成态:前件=动作已在拆这个措辞,后件=引号内紧跟被消解的对象标记。 */
const WAITING_HUMAN_DISSOLVE_BEFORE_RE = /(?:解除|消解|取消|去掉|移除|改写|摘掉|已|已经)/
const WAITING_HUMAN_DISSOLVE_AFTER_RE =
  /^["」”]?\s*(?:状态|措辞|口径|说法|定论|结论|标记|标签|开头|题面|标题)/
/** 护栏③引述他行:前文把该引文指为**别行/别票**的题面。
 *  ⚠️ 已知缺口:字符类 `[^"「]` 排除半角 `"` ⇒ 半角引号形态认不出(落兜底 ④)。
 *  当前不产生误判(④兜着),要补须先跑护栏负载读数。 */
const WAITING_HUMAN_OTHER_ROW_RE = /(?:持有行是|另一条登记|同题登记|持有行|另一条|那一条|以)[^"「]{0,30}$/

/**
 * 引号跨度(半角 `"` + 中文 `「」` / `“”` / `‘’`)。
 *
 * ⚠️ 这里**读**引号,和 `dispositionFace` **遮**反引号是两件事,别混:
 * `dispositionFace` 只遮反引号、**故意不遮中文引号**,因为本仓正当的等待措辞常写在
 * 「」里(遮掉等于给判据摘牙,§12f)。本函数正需要靠中文引号认出「这一段是被引述的」,
 * 所以两者方向相反、互不冲突。遮罩一律等长替换,列位不变。
 */
function waitingHumanQuoteSpans(s) {
  const ch = [...s]
  const spans = []
  let st = -1
  for (let i = 0; i < ch.length; i++) {
    if (ch[i] === '"') {
      if (st < 0) st = i
      else {
        spans.push([st, i + 1])
        st = -1
      }
    }
  }
  for (const [a, b] of [
    ['「', '」'],
    ['“', '”'],
    ['‘', '’'],
  ]) {
    let o = -1
    for (let i = 0; i < ch.length; i++) {
      if (ch[i] === a && o < 0) o = i
      else if (ch[i] === b && o >= 0) {
        spans.push([o, i + 1])
        o = -1
      }
    }
  }
  return spans
}

/**
 * 判据面 → `'self'`(真在等人)/ `'negated'`(被三档护栏挡掉)/ `'undetermined'`(引号内且机器判不了)/ `null`(没命中)。
 * 只有 `'self'` 才把该行算进 `waiting-human`。
 *
 * 自述槽只在槽标签**结束之后**、60 字之内找「等的是人」—— 槽标签自己那几个字
 * (`在等什么` 里的「等」)不算槽内容,否则每个带槽的行都会自命中。
 *
 * ⚠️ 槽内扫描必须**按偏移量在截断后的子串上跑**,不能扫全行再按绝对位置过滤:
 * `等…人` 这个跨式若恰好**骑在**槽边界上(`**在等**:**等持有人…` ⇒ 一次匹配从
 * 「在等」的「等」起、跨过槽尾吃到槽内的「等持有人」),按绝对位置 `h.index < slotEnd`
 * 一过滤就**整条被丢**,而这行的自述槽其实是**认得出**的 ⇒ 表现为「槽族行莫名漏判」。
 * 槽标签本身可能是 `在等`(短形,槽尾紧跟 `**` 与冒号),这个骑边是常态,不是边缘情形。
 */
/**
 * 第一把尺子(`需/待 + 人 + 决断动词` 措辞族)的裁决:**逐候选点过护栏①**。
 *
 * ## 立因(2026-10-07,`L3823` 假阳性)
 * 这一族原先是**一条裸正则**(`DISPOSITION_RULES` 里直接 `.test(face)`),它**短路**在
 * `waitingHumanSelfVerdict` 之前 ⇒ 整套四道语法辖域护栏只挂在第二把尺上,这一族
 * (现读面 62/128 行)**一根护栏都不过**。实测假阳性:
 * `…三条未闭环到此全部有确定归宿:**门 41 = 判据改正并转绿(不需要用户拍板)**…`
 * 被读成 `waiting-human` —— 一条**已拍板、不需要人介入**的账被挂进待办(虚增待办 =
 * 本仓记过多次的「越做越多」病根)。
 *
 * ## 为什么漏的是**接线层**,不是「引号内规则」(别再往引号规则上打补丁)
 * 那句 `不需要用户拍板` 落在 markdown 粗体 `**…**` 内,而 `waitingHumanQuoteSpans`
 * 只认 `"` / `「」` / `“”` / `‘’` —— `**` 不是引号字符 ⇒ 兜底④「引号内默认不进 self」
 * **结构上就够不着它**(实测该行的引号跨度只覆盖到别处 `"服务端 … 可解析性"`)。
 * 所以"把④的辖域扩大到 `**`"是**错的方向**:④是本档唯一承重的引述兜底
 * (拆掉实测 +7 行误判),为这一行去动它 ⇒ 用一个真缺陷换一个更大的缺陷。
 *
 * ## 为什么锚**语义关系**而不是往词表里加词(门89 的学费)
 * 把 `不需要用户拍板` 补进「否定词表」或「已消解措辞表」= 把病**推迟到下一个没抄进
 * 表里的词**(`无需用户拍板` / `不用人确认` / `不得用户裁决` 各成一族,静默通过整条链)。
 * 护栏①判的是**可计算的语法关系**:negator 与被否谓语之间**只可夹虚词**
 * (`不需要用户拍板` ⇒ `不` 直接管辖 `需要用户拍板`,夹的 `需要` 是虚词 ⇒ 拦下;
 * 而 `取消打不断(等人拍板)` ⇒ `不` 与谓语之间夹着实词 `断` ⇒ 不拦,判 `self`)。
 * 这条关系对**任何**否定词 × **任何**等待措辞都成立,不需要抄第三个词。
 *
 * ## 为什么**只**过①,不过 ②③④(取舍有实测读数,不是省事)
 * ②③④ 是为第二把尺的**引述通道**调的。第一把尺的候选点大量落在 markdown 粗体/引号里
 * (`**需 owner 拍板**` 这类**正文引用**),一并推出 `self` 实测掉 **6 行真等行**
 * (现读面 `L6530`/`L8423` 等)⇒ 那是把真等行漏判,比虚高更坏。
 * ① 与「在不在引号里」**正交**,它判的是谓语前的语法邻接,所以两把尺共用它既安全又必要。
 * 实测(现读面 3008 未勾选复选框行 / HEAD 面 1995 行):套①后 `waiting-human` 一行不丢。
 *
 * @returns `'self'`(真在等人)/ `'negated'`(候选点全被①否决)/ `null`(没命中)
 */
export function waitingHumanDirectVerdict(line) {
  const face = dispositionFace(line)
  const re = new RegExp(WAITING_HUMAN_DIRECT_RE.source, 'g')
  let saw = false
  let m
  while ((m = re.exec(face)) !== null) {
    saw = true
    const before = face.slice(Math.max(0, m.index - 26), m.index)
    if (!WAITING_HUMAN_NEG_GOVERNS_RE.test(before)) return 'self'
  }
  return saw ? 'negated' : null
}

export function waitingHumanSelfVerdict(line) {
  const face = dispositionFace(line)
  const spans = waitingHumanQuoteSpans(face)

  const points = []
  const reA = new RegExp(WAITING_HUMAN_PHRASE_RE.source, 'g')
  let m
  while ((m = reA.exec(face)) !== null) points.push({ a: m.index, b: m.index + m[0].length })
  const sm = WAITING_HUMAN_SLOT_RE.exec(face)
  if (sm) {
    const slotEnd = sm.index + sm[0].length
    // 在**截断后的子串**上扫,再把偏移加回去(见头注⚠️:骑边匹配会被整条丢掉)
    const slotTail = face.slice(slotEnd, slotEnd + 60)
    const reH = new RegExp(WAITING_HUMAN_SLOT_HUMAN_RE.source, 'g')
    let h
    while ((h = reH.exec(slotTail)) !== null) {
      points.push({ a: slotEnd + h.index, b: slotEnd + h.index + h[0].length })
    }
  }
  if (!points.length) return null

  let self = 0
  let negated = 0
  let quotedUnknown = false
  for (const p of points) {
    const before = face.slice(Math.max(0, p.a - 26), p.a)
    const after = face.slice(p.b, p.b + 12)
    const quoted = spans.some(([x, y]) => x <= p.a && p.b <= y)

    if (WAITING_HUMAN_NEG_GOVERNS_RE.test(before)) {
      negated++
      continue
    }
    if (quoted) {
      if (
        WAITING_HUMAN_DISSOLVE_AFTER_RE.test(after) &&
        WAITING_HUMAN_DISSOLVE_BEFORE_RE.test(before)
      ) {
        negated++
        continue
      }
      if (WAITING_HUMAN_OTHER_ROW_RE.test(before)) {
        negated++
        continue
      }
      quotedUnknown = true
      continue
    }
    self++
  }
  if (self > 0) return 'self'
  if (negated > 0 && !quotedUnknown) return 'negated'
  return 'undetermined'
}

/** 归属判据看的面:**行内反引号 span 遮成等长空白**。
 *  立因(G-1058610 病②,2026-10-05 实测):台账里大量票面**转述上游代码的成文理由**,那些句子
 *  本身就带"等待用户…""需人定…"字样 —— 例如 `G-815964` 引了上游 `:148-155` 的
 *  「paused-log 正在等待用户继续上传」,于是**一条零阻塞可做的票被整条算成"等人拍板"**,
 *  派单人照着这个数就会把一件根本没人拦的活挂起来等人。
 *  只遮反引号、**不遮中文引号「」与直角引号** —— 本仓正当的等待措辞常常正写在那种引号里
 *  ("台账明写「属 §24 需拍板」"),把它们一起遮掉就等于给判据摘牙(§12f:修红不得顺手削判据)。
 *  等长替换:列位不变,后续任何按列取窗的逻辑不受影响。 */
export function dispositionFace(line) {
  return String(line).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
}
export function dispositionOf(line) {
  const face = dispositionFace(line)
  for (const [kind, re] of DISPOSITION_RULES) {
    if (typeof re === 'function' ? re(line) : re.test(face)) return kind
  }
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

/**
 * F8 的"有无交代":指针 / 租约 / 非 actionable 归属 / 任何可算日期,四者齐缺即无主账。
 *
 * ⚠ 指针这一支是**接线补齐**,不是新增判据(2026-10-07):`副本指针(编号 …)` 行首族早就被
 * `isClaimExcludedPointer` 认成"指针不是待办"(派单侧 `dispositionOf` 一直在用它,见 :2101),
 * 而本函数的三个出口(租约 / 非 actionable 桶 / 日期)**一个都不占指针** ⇒
 * 那批行既不是待办、又被 F8 判成"无交代的活待办"。实测 HEAD 面:台账里被判指针的共 4193 行,
 * 其中恰好 8 行落进 F8 面(`副本指针(编号 62/63/75/51)` 各两份 + `副本指针(编号 P1-①)` 一条),
 * 补上这一支 F8 由 175 降到 167,消失的逐字就是那 8 行,一条不多。
 *
 * 为什么复用既有出口而不是新写正则:`isClaimExcludedPointer` 是"什么算指针"的**唯一**实现
 * (派单侧与本处共用),新写一份必然与它漂移 —— 而漂移的后果是"派单不派它、F8 却仍计它的债"。
 * 同理**不放宽**:判据面只认逐字行首族(`副本指针(编号 …)`),正文里**提及**该形态的行
 * (如 G-1058653 那条"派单口径漏认第二个副本指针形态"的真活账)照旧计债,已用反例钉住。
 */
export function hasDisposition(row) {
  if (row.claim) return true
  // 指针不是待办,不占"无交代的活待办"这个量纲(见头注:这是接线补齐,不是新判据)
  if (isClaimExcludedPointer(row.raw)) return true
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
 *
 * ⚠ drifted 这一格此前把**两件不同的事**读成了"首行相同而正文漂移"。
 * 两个成因,都出在"块"的定义上:
 *  ① **块 = 连续 `- ` 行的极大行段**,不是逻辑登记块。台账里一条登记下面挂着若干续行小项,
 *     切分产物把这些续行小项裹进了"块"里 —— 首行因此根本不是登记行(缺复选框),
 *     它们压根不是"同一件事登记两次"。实测 24 组里 6 组是这一型。
 *  ② drifted 按首行分组,而**首行相同是分组的恒等条件**(不是证据)。同章节/同批次的
 *     登记开头格式一致,首行撞上是巧合;正文讲的是完全不同的任务。实测 4 组正文
 *     共享行数 = 0(重合率 0% —— 唯一相同的那行就是分组键本身)。
 * 处置:① 首行必须是**登记行**(复选框在位),走既有出口 `bodyOfRow`(不另抄复选框正则);
 * ② 组内任两份块的**正文**(去掉首行后的行集合)行级 Jaccard 须 >= `DUP_BLOCK_MIN_BODY_OVERLAP`。
 *     阈值取 5% 的依据(HEAD 面 20 组两两实测,body-Jaccard 排序):
 *     `0 0 0 0 | 1.8 2 2.4 | 6.7 9.5 10 11.5 11.8 12.5 14.4 20 20.8 24.1 33.3 44.4 69.2`
 *     —— 0 那一簇是"除首行外一条都不重合"(⇒ 不同的事,已剔);6.7 往上是真漂移
 *     (逐条核过:D41/G-295/G-189 等确实是同一件事被登记两遍且正文各自演化)。
 *     5% 落在 2.4 与 6.7 之间的空档里,取档口而非贴着某一组。
 * 只减不增:本判据只剔误报,不新增报红;`drifted` 是只报数格,不是判红输入。
 * 数字一律现读,不得写进文档当恒定事实。 */
const DUP_BLOCK_MIN_LINES = 3
const DUP_BLOCK_MIN_LINE_LEN = 40
/** 正文(去首行)行级 Jaccard 下限:低于它 ⇒ 两份块除首行外几乎无共同正文 ⇒ 不是同一件事。 */
const DUP_BLOCK_MIN_BODY_OVERLAP = 0.05
/** @returns {{verbatim:Array<{first:string,lines:number[],copies:number,len:number}>,drifted:Array<{first:string,variants:number}>}} */
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
  // drifted:按首行分组,但**只有首行是登记行的块才进候选**(切分产物剔出,见头注①),
  // 且组内任两份块的正文 Jaccard 须过阈(首行撞号是恒等条件不是证据,见头注②)。
  const byFirst = new Map()
  for (const [k, ls] of blocks) {
    const seg = k.split('\n')
    if (bodyOfRow(seg[0]) === null) continue
    const f = seg[0]
    if (!byFirst.has(f)) byFirst.set(f, [])
    byFirst.get(f).push({ body: seg.slice(1), lines: ls })
  }
  const drifted = [...byFirst.entries()]
    .filter(([, g]) => g.length > 1 && hasBodyOverlap(g))
    .map(([f, g]) => ({ first: f, variants: g.length }))
  return { verbatim, drifted }
}

/** 同一首行分组内是否存在两份块正文真的重合(过阈)。两两比,任一对成立即算"这一组要人判"。 */
function hasBodyOverlap(group) {
  for (let a = 0; a < group.length; a++) {
    for (let b = a + 1; b < group.length; b++) {
      if (bodyOverlap(group[a].body, group[b].body) >= DUP_BLOCK_MIN_BODY_OVERLAP) return true
    }
  }
  return false
}

/** 两段正文(均已去掉首行)的行级 Jaccard。空侧 ⇒ 0(无从重合,不许因"两边都空"而算同一件事)。 */
function bodyOverlap(aBody, bBody) {
  const a = new Set(aBody)
  const b = new Set(bBody)
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union > 0 ? inter / union : 0
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
 *
 * ⚠ 自 G-460 起本函数返回的是 **宽口径(`f9Faces().wide`)** —— 它是诊断读数,**不是判据输入**。
 *   F9 的判据输入是 `f9Faces(content).collisions`(只由声明行分组),由 `auditPlan` 直接取,
 *   再经 `plan-tasks.mjs` 的 `narrowF9Face` 覆盖到判定面上。留宽口径在这个出口是有原因的:
 *   取号改号工具(`plan-collide-renumber-plan`)与既有镜像测试都要问"窗口口径下这一族有没有撞",
 *   而那一条问句的答案必须与判据的实际口径成对出现,否则"看不见引用"会被读成"没有引用"。
 * @returns {Array<{key:string,titleCount:number,titles:Array<{title:string,lines:number[]}>}>} 按编号首现顺序
 */
export function findIdCollisions(content) {
  return f9Faces(content).wide
}

/**
 * F9 的**声明位**判据(2026-09-28 G-417 定的那条判据,自 G-460 起住在台账层这一份)。
 *
 * 一行算不算"该编号的一次登记",问的是**编号落没落在编号位上**:剥掉复选框与状态装饰后的正文
 * 开头(可含 `*`/反引号/空白)就是本行主键 ⇒ 声明行;否则那一次命中只是行文引用,或者是畸形号
 * 肚子里被窗口切出来的子串。
 * 实现只复用台账既有出口(`bodyOfRow` + `stripOwnKey` 的 strict/lenient 两档),不另抄编号正则。
 */
export function isDeclarationRow(rawLine, key) {
  const body = bodyOfRow(rawLine)
  if (body === null || !key) return false
  return stripOwnKey(body, key, 'strict') !== body || stripOwnKey(body, key, 'lenient') !== body
}

/** 把 `Map<key, Map<title, lines[]>>` 收成 ≥2 标题的组(按首现顺序,与旧实现同形)。 */
function f9GroupsOf(bag) {
  const out = []
  for (const [key, bagTitles] of bag) {
    const titles = f9CollapsePrefixNested(bagTitles)
    if (titles.size < 2) continue
    out.push({
      key,
      titleCount: titles.size,
      titles: [...titles.entries()].map(([title, lines]) => ({ title, lines })),
    })
  }
  return out
}

/**
 * F9 声明位题面归一 **② —— 前缀套叠并桶**(2026-10-05 修取材口径)。
 *
 * 形态(`G-278` HEAD 现读):同一编号的两行登记,一行题面是另一行题面的**精确前缀**
 * (`D6-G1v2执行器` ⊂ `D6-G1v2执行器适配器已入库并单测真跑`)—— 那是台账"截断回放"这一族,
 * F4c 已经把它认定为**同一件事的两份**(见 `findPrefixNestedCopies` 头注),F9 却不认,
 * 于是门自己产的形态又变成"新增一个撞号组"。
 * 关系本身**不在这里重写**:只调 `isExactPrefixNesting`(与 F4c 同一份),所以 F4c 收紧时本族同步。
 * 并桶取**最长**的一侧做代表(与 F4c "长行是完整的那一份"同口径);同长时取字典序最小,保证可复现。
 * ⚠ 这不是"像就并":分叉的短题面(`甲` ⊂ `甲乙` 与 `甲` ⊂ `甲丙`)各自仍成组 ——
 *   `甲` 只会被并进其中一个代表,`甲乙` / `甲丙` 仍是两个标题 ⇒ **真撞号照旧判红**(阳性对照钉这一条)。
 */
function f9CollapsePrefixNested(titles) {
  const names = [...titles.keys()]
  if (names.length < 2) return titles
  const merged = new Map()
  for (const t of names) {
    const cands = names.filter((n) => n === t || isExactPrefixNesting(t, n))
    const maxLen = Math.max(...cands.map((n) => n.length))
    const rep = cands.filter((n) => n.length === maxLen).sort()[0]
    if (!merged.has(rep)) merged.set(rep, [])
    for (const l of titles.get(t)) if (!merged.get(rep).includes(l)) merged.get(rep).push(l)
  }
  return merged
}

/**
 * F9 声明位题面归一 **③ —— 他号引用不得充当本行的声明标题**(2026-10-05 修取材口径)。
 *
 * 形态(`G-916432` / `G-916417` HEAD 现读):行的主键位是本行编号,题面**开头**却接着写别人的号
 * (`**G-916432 D129 前端子集已落地…**` ⇒ 题面 `D129前端子集已落地`)。那一段 `D129` 是**叙述位引用**,
 * 不是本行议题的名字;拿它当标题的一部分去比,等于"引用参与撞号判定"—— §1 明文的方向是
 * **宁可少判,也不能把引用判成撞号**。
 * 实现只走既有出口:`anchoredKeyAhead`(编号是否真在开头)+ `keyInWindow`(与 `keyOfRow` 同一份扫描)
 * + `stripOwnKey`(剥掉那一截,不新增第二份编号正则)+ `usableTitle`(剥完还给得出实质题面吗)。
 * ⚠ 两条退让都是**硬**的,缺一条就是"借修口径削覆盖面":
 *  - 剥出来的题面不足 4 字 ⇒ **原样返回**(`D160补注` 只剩 `补注` ⇒ 该行的标题直接消失 ⇒ 放过真撞号);
 *  - `stripOwnKey` 没认这个位(返回原样)⇒ **不动**,不许猜。
 */
export function f9DropForeignLead(key, title) {
  if (!title || !anchoredKeyAhead(title)) return title
  const foreign = keyInWindow(title)
  if (!foreign || foreign === key) return title
  const stripped = cleanTitle(stripOwnKey(title, foreign, 'strict'))
  if (!stripped || stripped === title) return title
  return usableTitle(stripped, foreign) ? stripped : title
}

/** 往一把袋子里记一次命中(同标题多行只并 lines,不另开一标题)。 */
function f9Bump(bag, key, title, line) {
  if (!bag.has(key)) bag.set(key, new Map())
  const titles = bag.get(key)
  if (!titles.has(title)) titles.set(title, [])
  titles.get(title).push(line)
}

/**
 * F9 的**三档**读数(2026-09-30 G-460 立;此前只有下面第一档,另两档混在"已排除"里不给名字)。
 *
 * 为什么必须一次扫完再分档,而不是"先算宽口径、再逐组筛掉非声明位":
 *  - 判据的分组输入按票面口径就是**声明行**(行首状态位 + 编号 + 标题的复合形态);"先造出伪组再筛"
 *    在结论上等价,在语义上不等价 —— 伪组一旦被造出来,任何后来读 `collisions` 的消费者
 *    (`plan-collide-renumber-plan` 的取号判据、收敛落地闸)拿到的都是含引用与脏号的名单,
 *    而账面看不出它筛过。三档各归各位之后,宽口径只作**读数**用,不再是任何判据的输入。
 *  - 行文引用要能**报名**:它只报数不判红,但"某个号被别人正文里点了多少次"是取号与归并的输入
 *    (改号出口对这一型不成立 —— 旧号会继续挂在别人的引用里),不报名就只有下一个人重新发现一遍。
 *  - 畸形号(`G-G-334` 这类前缀重复)的子串恰好是别人的正常号,过去会顶替那一组的"第二个标题"。
 *    自本档起它**永不进任何分组**,单独落在 `malformed` 档,与 F9b(`findMalformedRows`)同源一份
 *    判据(`malformedFamilyOf`),不另抄形状。
 *
 * 三态不并桶:`declared`(判据输入)/ `references`(只报数)/ `wide`(诊断读数)/ `malformed`。
 * 退化标题行(`titleIsDegenerate`)按 M16 那条防线**不贡献标题**,三档都不记 —— 与收窄前逐字同形。
 *
 * @param content 被审面全文(必须是**同一个面**;两处各取一次面就是自洽却错位的尺子)
 * @returns {{collisions:Array, references:Array, wide:Array, malformed:Array, droppedTitles:number}}
 *   `collisions` = 声明位撞号组(F9 判据唯一输入);`references` = 每个编号被非声明行挂到的标题;
 *   `malformed` = 畸形号行被窗口切出的"正常号"与其原文行;`droppedTitles` = 宽口径里非声明位的标题数
 */
export function f9Faces(content) {
  const declared = new Map()
  const referenced = new Map()
  const wide = new Map()
  const malformed = new Map()
  let droppedTitles = 0
  for (const r of parseTaskRows(content)) {
    if (!r.key) continue
    const title = titleOf(r.raw)
    if (!title) continue
    if (titleIsDegenerate(r.raw, title)) continue
    // ③ 题面开头的**他号引用**先让开,再进三档里的任何一个袋子
    //   (三档同口径 —— 只筛判据输入那一档会制造"宽口径里还在拿引用比标题"的第二把尺子)。
    const canon = f9DropForeignLead(r.key, title)
    if (titleIsDegenerate(r.raw, canon)) continue
    f9Bump(wide, r.key, canon, r.line)
    // 畸形号:族名在编号段里出现两次 ⇒ 本行的"编号位"根本不是一个合法号,单独点名
    if (malformedFamilyOf(r.raw)) {
      if (!malformed.has(r.key)) malformed.set(r.key, [])
      malformed.get(r.key).push(r.line)
      continue
    }
    if (isDeclarationRow(r.raw, r.key)) f9Bump(declared, r.key, canon, r.line)
    else {
      f9Bump(referenced, r.key, canon, r.line)
      droppedTitles += 1
    }
  }
  return {
    collisions: f9GroupsOf(declared),
    references: f9GroupsOf(referenced),
    wide: f9GroupsOf(wide),
    malformed: [...malformed.entries()].map(([key, lines]) => ({ key, lines })),
    droppedTitles,
  }
}

/**
 * F9 逐组点名的**唯一**文案出口(差值档 / 基线档 / 收敛落地闸三处共用一份)。
 * 住在台账层而不是台账 CLI 里,是因为消费者有三处而在别处再抄一遍就是第二把尺子(必漂移);
 * ⚠ 证据文本只给「编号 + 各标题」—— 行号在任何一次 append 后都会挪位,§1 明令它不得当判据、
 *   也不得写进证据文本(印 `@L…` 等于每条红都自带一句下一轮就失效的话;定位需要时读 `--json`
 *   的 `collisions[].titles[].lines` / `malformedRows[].line`,那是机器字段而不是证据)。
 *   这一条由 `scripts/tests/plan-tasks-f9.test.mjs` 的第 ⑥ 组逐字钉住,别在搬迁时把它加回来。
 */
export function f9GroupLine(g) {
  return (
    `编号 ${g.key} 被 ${g.titleCount} 个不同标题共用 —— ` +
    `${(g.titles ?? []).map((t) => `「${t.title}」`).join(' / ')}`
  )
}

/**
 * F9b 畸形登记号 —— 族名在**编号段里出现两次**(`G-G-354` / `DD128` / `OO90`)。
 *
 * ⚠️ 本文件是这一判据的**唯一实现**(2026-09-28 G-606 从 `live-doc-edit.mjs` 收上来)。
 * 收上来的理由不是整洁:该形态的**生产者**是取号令牌(`{{NEXT_ID:G}}` 展开值本身已含族名,
 * 正文再手写一个字面 `G-` 就产出 `G-G-…`),而**判据**住在台账层。两处各写一份"什么算畸形号"
 * 必然漂开(本仓对 `code-mask` / `box-geometry` / `design-token-blocks` 各记过同一条),
 * 而漂开的两种方向账面都是绿的:生产侧改窄 ⇒ 门还在按旧形状报存量;门改窄 ⇒ 生产者新造的形态
 * 入库那一刻无人拦,等放大成几十组才在 blocking 门上炸出来(今天就是这样)。
 * 判据锚在"族名在编号段里出现两次"这一**形状**上,不认具体族名、不做白名单 —— 台账以后新增任何
 * 一族都自动被覆盖(白名单必然腐烂,见 §4 对 `RN_ONLY_BRAND_KEYS` 的教训)。
 * 装饰档必须一起判:翻勾产出的正是 `- [x] ✅(日期) <号>`,认领产出的正是
 * `- [ ]（进行中@日期/持有者） <号>` —— 只判"复选框后立刻是编号"会让这两整档隐身,而本层就是
 * 这两档的生产者。剥装饰只引本文件的 `bodyOfRow` 那一份实现,不在判据里再抄一份"什么算状态装饰"。
 */
export const MALFORMED_ID_RE = /^-\s\[[ xX]\]\s*\**\s*([A-Za-z]{1,4})[-－]?\1[-－]?\d/
export const MALFORMED_BODY_RE = /^[`*\s]*([A-Za-z]{1,4})[-－]?\1[-－]?\d/

/** 一行是不是畸形号(先按整行形状判,再按剥掉状态装饰后的正文判)。两档同视是硬要求。 */
function malformedFamilyOf(rawLine) {
  const direct = MALFORMED_ID_RE.exec(rawLine)
  if (direct) return direct[1]
  const body = bodyOfRow(rawLine)
  if (body === null) return null
  const viaBody = MALFORMED_BODY_RE.exec(body)
  return viaBody ? viaBody[1] : null
}

/** 按**原文文本**扫畸形行(给"块 / 两面相减"用,输出形状与收上来之前逐字一致)。 */
export function findMalformedIds(text = '') {
  const out = []
  for (const l of String(text).split(/\r?\n/)) {
    const fam = malformedFamilyOf(l)
    if (fam) out.push({ line: l.trim().slice(0, 90), family: fam })
  }
  return out
}

/**
 * 按**条目行**扫畸形号(与 F1–F9 同一遍 `parseTaskRows`,带被审面行号)。
 * 判据本体只有一份(`malformedFamilyOf`),这一把与 `findMalformedIds` 都是它的投影 ——
 * 不另抄正则:两把尺子各判一次"什么算畸形"就是本层存在的理由。
 */
export function findMalformedRows(content) {
  const out = []
  for (const r of parseTaskRows(content)) {
    const family = malformedFamilyOf(r.raw)
    if (family) out.push({ line: r.line, raw: r.raw, family })
  }
  return out
}

/**
 * F9b 逐行点名的文案出口。与 `f9GroupLine` 同一条禁令:**行号不进证据文本**(§1 第三条),
 * 定位需要时读 `--json` 的 `malformedRows[].line`。点名文本给的是**原文片段**,因为 F9b 的修复
 * 动作就是"删掉正文里那一个字面族名",逐字原文比行号更经得住并发 append 挪位。
 */
export function malformedLine(r) {
  return `「${String(r.raw).trim().slice(0, 88)}」—— 族名 ${r.family} 在编号段出现两次`
}

/**
 * 只拦"本次新引入"的畸形行,存量只报数。
 * 这一条是本判据不沦为恒红门的全部前提(§12e:与本次改动无关的红,唯一结局是逼人 --no-verify
 * 并连带废掉全部守门):台账里由他人历史留下的畸形号不能钉红每一次落地,但必须打印出来,
 * 否则"存量"和"我刚造的"在账面上长得一样。
 */
export function newMalformed(baselineText = '', landedText = '') {
  const norm = (rows) => new Set(rows.map((r) => r.raw.trim().slice(0, 90)))
  const before = norm(findMalformedRows(baselineText))
  const after = findMalformedRows(landedText)
  const key = (r) => r.raw.trim().slice(0, 90)
  return {
    added: after.filter((r) => !before.has(key(r))),
    preexisting: after.filter((r) => before.has(key(r))),
  }
}

/**
 * 剥掉多余的那一层族名前缀,其余字节一字不动(修复出口的**唯一改写动作**)。
 *
 * 为什么保留第一层族名而不是第二层:`G-G334`(作者只在手写的 `G-` 后面漏了个连字符)剥掉第二段
 * 会得到 `G334`,而本仓 G 族的书写形状是 `G-<n>` —— 一个族名认不出的号等于把这行从对账里
 * 摘掉(keyOfRow 取不到主键 ⇒ F1/F4 全盲,正是本层记过的那一型)。留第一段 + 它自己写的分隔符
 * 才能同时保住 `DD128→D128`、`OO90→O90`、`G-G-354→G-354` 三种真实形态。
 * 剥完必须仍取得到主键(取不到 ⇒ 调用方拒绝,不猜)。
 * 返回体里除 `stripped` 还带 **改动证明三件套** `at / from / to`:改动在原文里的偏移、被改掉的片段、
 * 换上去的片段。落地档拿它做"只删不改写"的逐行自证(`verifyMalformedRepair`)—— 没有这三件,
 * 落地后只能比较整行是否相等,而"相等"证明不了"没有顺手改正文"。
 * @returns {null|{raw:string,stripped:string,family:string,key:string|null,at:number,from:string,to:string}}
 */
const STRIP_RE = /^([`*\s]*)([A-Za-z]{1,4})([-－]?)(\2)([-－]?)(\d+)/
export function stripMalformedPrefix(line) {
  const body = bodyOfRow(line)
  if (body === null) return null
  const m = STRIP_RE.exec(body)
  if (!m) return null
  const [, noise, fam, sep1, , sep2, digits] = m
  const kept = fam + (sep1 || sep2 || '') + digits
  const newBody = noise + kept + body.slice(m[0].length)
  // bodyOfRow 只剥**前缀** ⇒ body 恒是该行的后缀,偏移可这样算;不满足就是判据漂了,交回 null 而不是猜
  const at = line.length - body.length
  if (at < 0 || line.slice(at) !== body) return null
  const stripped = line.slice(0, at) + newBody
  return { raw: line, stripped, family: fam, key: keyOfRow(stripped) }
}

/**
 * 畸形号清偿的**规划档**(纯函数,零副作用):给出可安全剥的名单 + 必须交人工的名单。
 *
 * 三条拒绝条件,一条都不许静默放过:
 *  - 剥完取不到主键 ⇒ 拒(那一行会从状态对账里消失,比留着畸形号更坏);
 *  - 目标号已被**另一行**占用 ⇒ 拒并点名那一行。这一条同时挡住两种新债:同键不同标题 = F9 新撞号,
 *    同键同标题 = F4 新孪生 —— 两者都是"用一个更响的门替掉现在这扇",G-312 明令不得批量改号。
 *  - 本批内两行剥到同一个号 ⇒ 两份一起拒(机器不裁谁让号)。
 * 落地前还要过一组**守恒断言**(任一不过即整批不落):行数不变 ∧ 未触及行逐字不变 ∧
 * 被触行剥完不再被判畸形 ∧ F1/F2/F3(可自动收口)/F4/F4b/F6/F9b/F9 读数一律不高于底稿。
 * @returns {{candidates:number,approved:Array,refused:Array,undetermined:Array,text:string}}
 */
export function planMalformedStrip(content) {
  const rows = parseTaskRows(content)
  const lines = String(content).split('\n')
  const usedBy = new Map() // 主键 -> [行号]
  for (const r of rows) {
    if (!r.key) continue
    if (!usedBy.has(r.key)) usedBy.set(r.key, [])
    usedBy.get(r.key).push(r.line)
  }
  const approved = []
  const refused = []
  const undetermined = []
  const claimedNow = new Set()
  for (const r of findMalformedRows(content)) {
    const s = stripMalformedPrefix(r.raw)
    if (!s) {
      undetermined.push({ line: r.line, raw: r.raw, reason: '畸形判据命中而剥前缀的式子给不出结果 ⇒ 交人工' })
      continue
    }
    if (!s.key) {
      refused.push({ ...s, line: r.line, reason: '剥完取不到主键 ⇒ 这一行会从 F1/F4 的对账里消失' })
      continue
    }
    const others = (usedBy.get(s.key) ?? []).filter((l) => l !== r.line)
    if (others.length || claimedNow.has(s.key)) {
      refused.push({
        ...s,
        line: r.line,
        reason: `目标号 ${s.key} 已被另一行占用(行 ${others.join(',') || '本批内互撞'})⇒ 剥完必产同主键对,交人工让号`,
      })
      continue
    }
    claimedNow.add(s.key)
    approved.push({ ...s, line: r.line })
  }
  // 行号降序 splice:前面的替换不会挪后面的行号
  const out = lines.slice()
  for (const a of [...approved].sort((x, y) => y.line - x.line))
    out[a.line - 1] = a.stripped
  return {
    candidates: approved.length + refused.length + undetermined.length,
    approved,
    refused,
    undetermined,
    text: out.join('\n'),
  }
}

/**
 * 剥完之后的守恒校验(纯函数)。`before`/`after` 是两面的 `auditPlan` 结果,由调用方各跑一次
 * —— 判据必须与读数同源,不在这里再解析一遍文档(两处解析必漂移,见 auditPlan 头注)。
 * 返回空数组**只在 `checked` 为真时**才等于"通过";没判与判过是两件事(§12f)。
 */
export function verifyMalformedStrip(plan, beforeCounts, afterCounts) {
  const problems = []
  if (!plan || !Array.isArray(plan.approved)) return { problems: ['规划结果形状不对 ⇒ 未判定'], checked: false }
  if (!beforeCounts || !afterCounts) return { problems: ['两把读数没给齐 ⇒ 未判定'], checked: false }
  const KEYS = ['forks', 'voidRows', 'rotatedAuto', 'dupOpenCopies', 'verbatimDupCopies', 'dupBlocks', 'collisionGroups', 'malformedIds']
  for (const k of KEYS)
    if ((afterCounts[k] ?? 0) > (beforeCounts[k] ?? 0))
      problems.push(`守恒断言不过:${k} 由底稿 ${beforeCounts[k] ?? 0} 涨到 ${afterCounts[k] ?? 0}`)
  if (afterCounts.malformedIds >= beforeCounts.malformedIds && plan.approved.length)
    problems.push(`剥了 ${plan.approved.length} 行而畸形号读数没降(底稿 ${beforeCounts.malformedIds} → 落地面 ${afterCounts.malformedIds})`)
  return { problems, checked: true }
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

export function auditPlan(content, { archivedKeys = null } = {}) {
  const rows = parseTaskRows(content)
  const { groups, forks, dupOpen, dupDone } = findForks(content)
  const voidRows = findVoidRows(content)
  // 注记三档只算一次(整文件扫描 + 逐行扫描各一遍;在下面三个字段里是同一份读数的投影)
  const noteUnits = mergeNoteUnits(content)
  const rotated = findRotatedPointers(content)
  /**
   * 给每条腐烂指针标"此刻有没有出口"。两条出口按**次序**判,先强后弱:
   *  - `face`     :目标行还在面上、且与本行同复合主键(唯一实现 `autoFixable`,不重写);
   *  - `archived` :目标行已不在面上,但本行的复合主键**逐字存在于某份被审归档件**
   *               (调用方经 `archiveFaceEntries` + `archivedCompositeKeys` 同面同轮推得)。
   * 判不出(没给归档索引 / 本行没有复合主键 / 该族措辞不承诺同主键)一律 `null` = 交人工,
   * **绝不猜**:猜出来的锚点写进台账,比留一个腐烂行号更危险(见 findRotatedPointers 的注释)。
   */
  for (const p of rotated) {
    p.exit = p.autoFixable
      ? 'face'
      : archivedKeys &&
          !POINTER_NO_AUTO_REPAIR[p.family] &&
          compositeKeyOf(p.raw) &&
          archivedKeys.has(compositeKeyOf(p.raw))
        ? 'archived'
        : null
  }
  const openRows = rows.filter((r) => r.state === 'open')
  // G-1058623:与 `findForks` 判据**同口径** —— 只取剔掉归并副本后的存活 open 行。
  // 改前取 `g.open` 全量,于是 12 条已被归并器正确标注的副本行也顶上了"F1 分叉行"身份,
  // 被`isClaimable` 从派单口径里剔除 —— 与它下面那道独立的 `!DUP_POINTER_RE` 判据重复。
  // 两道判据同口径后,剔除只发生一次、且理由唯一(不是"既是副本又是分叉")。
  const forkOpenLines = new Set(forks.flatMap((g) => g.open.filter((r) => !DUP_POINTER_RE.test(r.raw)).map((r) => r.line)))
  const voidLines = new Set(voidRows.map((r) => r.line))
  // "真·无人认领"必须**同时**扣掉带租约的行 —— 第一版没扣,于是 146 条"无人认领"里
  // 混着 44 条别人已认领的活(门 109 的租约形 `（进行中@日期/持有者）` 与裸标记都算)。
  // 派单人拿这个数去派,就会把别人正在做的事再派一遍 —— 正是 §1 认领标记要防的那件事。
  const unclaimedRows = openRows.filter((r) => !r.claim)
  const dupCopies = findDupOpenCopies(dupOpen)
  const verbatimDups = findVerbatimDupOpenRows(content)
  // F4c(G-814403):同题"前缀套叠"副本。**只报数并逐条点名**,不进 probe 差值棘轮、不判红
  // (存量现读 223 组,接 blocking = 与任何提交无关的恒红门,§12e/§12f 同型;升 blocking 前置 = 存量归零)。
  const prefixNested = findPrefixNestedCopies(content)
  const dupBlocks = findDupBlocks(content)
  // F9 三档一次扫完(G-460):`f9.collisions` 是判据唯一输入(只由声明行分组),`f9.wide` 是诊断读数,
  // `f9.references` / `f9.malformed` 是两档**只报数并报名**的名单 —— 把误判挪到报数档时必须同时报名,
  // 否则下一个人只能重新发现一遍(本仓"报数不报名"记过多次:守门 70/76/81/128 同族)。
  const f9 = f9Faces(content)
  const collisions = f9.wide
  const f9Declared = f9.collisions
  // F9b:与上面几条同一遍 parseTaskRows 的结果上算(不得为它再解析一次文档 —— 两处解析必漂移),
  // 判据本体是 `malformedFamilyOf` 那一份,生产者(live-doc-edit)与本层读的是同一个出口。
  const malformedRows = findMalformedRows(content)
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
  // 指针判据取`isClaimExcludedPointer`(原族 + `副本指针(编号 …)` 行首族,见其头注):
  // **刻意只在这一处消费**那份判据,不并进`DUP_POINTER_RE` —— 后者有 30+ 消费点,
  // 给它加分支会让归并器与撞号重编号链同时改行为,影响面远超"派单口径少 9 行"。
  const isClaimable = (r) =>
    !forkOpenLines.has(r.line) &&
    !voidLines.has(r.line) &&
    !dupCopyLines.has(r.line) &&
    !isClaimExcludedPointer(r.raw)
  const claimableRows = unclaimedRows.filter(isClaimable)
  // F7b(G-1058610 病①,2026-10-05 立):同一份分层在**派单口径**上再算一遍。
  // 上面的基数 unclaimedRows 里混着两千多行"已标副本指针 / 当次算出的同题副本",所以它那组
  // 读数天生虚高 —— 实测"等人拍板 70 行"按复合主键去重只剩 20 个独立事项,照 70 去问就是
  // 把同一件事问七遍。这一组才是派单人该看的那一组。
  // 刻意**不替换**上面那组:两把口径都有人读,而把既有读数改名/换基数,下一次没人能证明
  // 它量的是同一件事(§12f:修红不得顺手移动别人的锚点)。两行一起印,基数写在行内。
  const dispClaimBuckets = {
    actionable: [],
    'waiting-human': [],
    'waiting-env': [],
    'owned-elsewhere': [],
  }
  for (const r of claimableRows) dispClaimBuckets[dispositionOf(r.raw)].push(r)
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
    /** F4c 名单(逐条点名,不给计数就下一个人得重新发现一遍 —— 见 F9 三档头注同一条理由)。 */
    prefixNested,
    dupBlocks,
    collisions,
    // F9 三档(G-460):判据输入 / 只报数的引用图 / 单独点名的畸形号
    f9Declared,
    f9References: f9.references,
    f9MalformedMasquerade: f9.malformed,
    malformedRows,
    dispBuckets,
    undisposed,
    staleRows,
    /** 派单口径 = 未勾选 ∧ **未带租约** ∧ 不是"与已完成同题的分叉副本" ∧ 不是"同一件事的第二条待办"(F4)∧ 不自带作废声明。
     *  租约这一维是第一版的漏口:146 条"无人认领"里混着 44 条别人已认领的活,
     *  照那个数派单就是把正在做的事再派一遍(§1 认领标记存在的理由)。
     *  F4 这一维是第二版才补上的:副本行各算一条 ⇒ 同一件活被派两遍,而报告里只飘着一个组数。 */
    claimableRows,
    /** F7b 名单:派单口径的逐桶行(与 counts.dispClaim* 同源一份,不得两处各算)。 */
    dispClaimBuckets,
    counts: {
      open: openRows.length,
      claimed: openRows.filter((r) => r.claim).length,
      unclaimed: unclaimedRows.length,
      forks: forks.length,
      forkOpenLines: forkOpenLines.size,
      voidRows: voidRows.length,
      rotatedPointers: rotated.length,
      /**
       * F3 的两个量纲必须分开,否则同一枚提交里既要"全看见"又要"能自愈"是矛盾的:
       * `rotatedAuto` = 能换成**真**锚点的(并入归零判据与差值棘轮);
       * `rotatedNoExit` = 目标行已不可推断、**且也没有归档出口**的(只点名交人工 —— 并进归零判据
       * 就是一台永不落地的自愈档,并进棘轮就是凭"判据变尖"给别人记债,见 findRotatedPointers 里
       * autoFixable 的注释)。
       *
       * `rotatedAuto` 的**第二条出口**(2026-09-29,归档反查):指针指向的行已不在面上,但该行
       * 当初指的登记**被归档搬走了** ⇒ "同主键的另一条在 `<归档件>` 的条目「…」"是可核验的真话。
       * 这一维**只有调用方给了 `archivedKeys` 才参与计算**;没给时逐字退回旧口径(面内同主键那一族),
       * 因为"没算归档反查"与"算了但没有出口"必须在账面上分得开 —— 把前者写成后者,就是本仓最高频
       * 的失效型"把没判写成判过了"。故另发 `rotatedArchived`(经归档救回的那一半)与
       * `archivedIndexSupplied`(这把尺子这次到底看没看归档面)两个字段,谁打印谁带口径。
       */
      rotatedAuto: rotated.filter((b) => b.exit).length,
      rotatedArchived: rotated.filter((b) => b.exit === 'archived').length,
      rotatedNoExit: rotated.filter((b) => !b.exit).length,
      archivedIndexSupplied: archivedKeys !== null,
      dupOpenGroups: dupOpen.length,
      dupOpenCopies: dupCopies.length,
      // F4b:无主键的逐字孪生行 —— F4 按复合主键分组,而这一族永远没有编号,所以在 F4 里恒为 0、
      // 在账面上等于"不存在"。见 findVerbatimDupOpenRows 头注(2026-09-27 实测 4 对全部隐身)。
      verbatimDupGroups: verbatimDups.groups.length,
      verbatimDupCopies: verbatimDups.copies.length,
      // F4c(G-814403):同题"前缀套叠"副本 —— **只报数**。
      // 为什么这两个数必须与 F4 的 `dupOpenCopies`(=0)分列:那一维结构上量不到本族
      // (见 findPrefixNestedCopies 头注的 199/223 组 `continue`)。把它们并进同一栏
      // 会让"副本 0 行"继续骗人 —— 那正是本票立项的起因。
      prefixNestedGroups: prefixNested.groupKeys.length,
      prefixNestedPairs: prefixNested.pairs.length,
      // 已写明"重复登记副本"的未勾选行:它们与 dupOpenCopies 是两件事 —— 副本是**当次**算出来的,
      // 标过指针的是历史上已归并过的。派单口径两条都扣,所以报告里必须分列,否则读者对不上账。
      dupPointerRows: openRows.filter((r) => DUP_POINTER_RE.test(r.raw)).length,
      // 内容级存续性证据(只许增不许减,方向与四条状态判据相反 ⇒ 单独一把尺子,别塞进同一个 ratchet)
      mergeNotes: noteUnits.lineAttributable,
      // 跨行书写的注记:落地闸**只报名不判红**(与 lineAttributable 不同量纲,见 mergeNoteUnits 头注)
      mergeNotesCrossLine: noteUnits.crossLine,
      mergeNotesTotal: noteUnits.total,
      // F6 块级重复:行级判据(F1–F4)量不到"整块被追加两遍",见 findDupBlocks 头注
      dupBlocks: dupBlocks.verbatim.length,
      dupBlockCopies: dupBlocks.verbatim.reduce((s, b) => s + b.copies, 0),
      dupBlockDrifted: dupBlocks.drifted.length,
      dupDoneGroups: dupDone.length,
      // F9 撞号(见 findIdCollisions 头注定级理由):存量只报数,提交链只拦新增撞号组。
      // 本项是**宽口径**组数(与 `collisions` 同形,两者必须一起动 —— 差值档读组数、点名读名单);
      // 判据真正吃的是声明位口径 `f9DeclaredGroups`,由 plan-tasks 的 narrowF9Face 覆盖到判定面上。
      collisionGroups: collisions.length,
      f9WideGroups: f9.wide.length,
      f9DeclaredGroups: f9.collisions.length,
      // 被摘出判据的标题数必须同时报名(名单见 f9References / f9MalformedMasquerade)—— 只给计数
      // 会把"这一格没人看过"读成"这一格没有问题"。
      f9NonIdTitles: f9.droppedTitles,
      f9ReferenceIds: f9.references.length,
      f9MalformedMasqueradeIds: f9.malformed.length,
      // F9b 畸形登记号(见 findMalformedRows 头注):判据与取号器的生产者侧同源一份实现。
      // 同 F9 定级 —— 存量只报数,红路只有差值棘轮与基线天花板两层(§12e)。
      malformedIds: malformedRows.length,
      claimable: unclaimedRows.filter(isClaimable).length,
      // ── F7 归属分层(未认领口径,与 claimable 同集合基数)──
      // 基数校验:四桶相加必须等于 unclaimed,不等就是分类逻辑漏桶(已由 selfTest 钉住)。
      dispActionable: dispBuckets.actionable.length,
      dispWaitingHuman: dispBuckets['waiting-human'].length,
      dispWaitingEnv: dispBuckets['waiting-env'].length,
      dispOwnedElsewhere: dispBuckets['owned-elsewhere'].length,
      // ── F7b 同一分层在派单口径上的读数(基数 = claimable,已扣副本/作废/分叉)──
      // 四桶相加必须等于 claimable,与上面四条"相加等于 unclaimed"是两条独立的闭合判据。
      dispClaimActionable: dispClaimBuckets.actionable.length,
      dispClaimWaitingHuman: dispClaimBuckets['waiting-human'].length,
      dispClaimWaitingEnv: dispClaimBuckets['waiting-env'].length,
      dispClaimOwnedElsewhere: dispClaimBuckets['owned-elsewhere'].length,
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
