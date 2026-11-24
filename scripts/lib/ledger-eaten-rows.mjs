// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ledger-eaten-rows.mjs —— 台账「正文被吃掉」两型残行的判据单源(2026-10-23 立,**只读**)。
 *
 * ## 立因(票面原文的判据需求,不是假想)
 *
 * 台账里存在登记行的**正文在合并/压缩中被吃掉**、只剩下标记或半句话的残行。它们在派单清单里
 * 各占一名,却没有任何可派内容 —— 即"账面有票、手里没票"。本模块只做一件事:**把这两型量出来**
 * (先有尺,再谈是哪个器物产的、怎么修)。
 *
 *  - **型①「空正文行」**:复选框之后除**成对括注(标记)**外一个字符都不剩。
 *    实测形:`- [ ]（认领已释放@2026-10-23/stale-claim-strip#mvjyuyh8-27）`
 *    —— 超龄认领牌被代摘器摘掉时只留下释放注记,原正文没回来。
 *    租约形也算标记:`- [ ] （进行中@2026-10-23/x）` 同样是型①(正文确实一个字没有)。
 *  - **型②「截断正文行」**:正文以**连接符**(`,` `，` `;` `；` `、`)收尾 —— 一句话停在半截,
 *    后半段被行级 union / 压缩切掉了。
 *    实测形:`- [ ] ` + 反引号 + `--allow-dangerous` 确认旁路仍在调用方(commands/agent.ts:1757、
 *    server/agent-core.ts:101),` —— 以半角逗号收尾。
 *
 * ## 判据纪律(为什么长成这个样子)
 *
 *  1. **行的识别只有一份实现**:引 `plan-task-index.mjs` 的 `parseTaskRows`,不在这里自带一条
 *     复选框字面正则。理由不是洁癖:`plan-line-age.mjs` 头注记过一次真事故 —— 第一版自己抄的
 *     窄正则认不出「复选框后不跟空格」的两族写法(`- [ ]（进行中@…）` 与 `- [ ]62.`),
 *     于是 HEAD 面 308 条只量到 229,**漏掉的 79 条永远隐形**,而账面读起来跟"这 229 条都不老"一样。
 *     本模块判的正是"哪些行看不见",绝不能在识别这一步先瞎掉。
 *  2. **括注的扫描只有一份实现**:成对括注用 `plan-task-index.mjs` 的 `matchBalancedGroupAt`
 *     (深度感知、同种符号可嵌套);本模块只带一张**位置策略表** `MARKER_PAIRS`(形状与同文件
 *     `LEAD_DECOR_PAIRS` 同族)。配不平 ⇒ **不吃、不判型①**(宁可少判,不把叙述行猜成残行)。
 *  3. **行内投影标头先剥**:`〔归:…｜等:…〕` 是侧车的投影、不是正文(剥法唯一实现 =
 *     `plan-field-line.mjs` 的 `stripHeader`),否则"标头 + 标记 + 无正文"那一型会漏判。
 *  4. **只报数、绝不判红**(§12e):命中存量与本次提交内容无关 —— 挂成提交门就是逼人
 *     `--no-verify`,一次绕过连带废掉该提交上全部守门。本模块的退出码只有两档:
 *     **0 = 判定完成(命中几枚都是 0)**、**2 = 未判定**。没有 1 这一档,也**没有**自愈档:
 *     不写盘、不改台账、不 `git add`。差值棘轮在这里没有意义,因为它不拦任何东西。
 *  5. **"没判"绝不写成"判过"**(§0.3):被审面取不到 ⇒ 未判定并点名原因(不记绿也不冒红),
 *     **不回落另一个面**(§0.4)。`枚举到 0 个登记行` ⇒ 同样落未判定:那只有"尺子失明"与
 *     "取材面不对"两种解释,两种都不能读成"没有残行"。为此末行恒带 `rows=<枚举到的登记行数>`,
 *     让 0 命中与 0 视野在账面上可区分。
 *
 * ## 射程与已知空档(如实登记,不假装全覆盖)
 *
 *  - 射程 = **登记行**(复选框行),勾选态都判,命中逐条带 `state=open|done` 报出;
 *  - 票面提到的同型截断也出现在 `<!-- 已归档(…标题被切成 commands/agent. 即断) -->` 这类
 *    **占位注释行**上 —— 那不是登记行,本尺**不判**,只在此点名它不在射程内;
 *  - 行尾注记会把被切掉的正文**遮住**(正文段以连接符收尾、整行却以 `〕` 收尾):
 *    实测 HEAD 面该型 0 枚,故本尺只看整行行尾,不做"先剥尾注再看"的收窄 ——
 *    收窄判据一旦上妆就必须有自己的镜像夹具,不为 0 枚存量写第二套剥法。
 *
 * ## 用法
 *
 * 门体 CLI 见 `scripts/check-ledger-eaten-rows.mjs`(它只是这层判据的薄壳)。
 * 机读末行:
 *   `LEDGER-EATEN-ROWS-RESULT state=clean|warn|undetermined empty=<n|NA> truncated=<n|NA> open=<n|NA> rows=<n|NA> face=<head|staged|worktree>`
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { bodyOfRow, matchBalancedGroupAt, parseTaskRows } from './plan-task-index.mjs'
import { stripHeader } from './plan-field-line.mjs'
import { assertRepoRoot, selectFace } from './face-reader.mjs'
import { requireFlagValue } from './flag-value.mjs'
import { readPlan } from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 被审文档(与 `plan-tasks.mjs` 的 readPlan 同一个路径,不另开一条取材口)。 */
export const PLAN_REL = 'PROJECT_PLAN.md'

export const FACE_LABEL = {
  head: 'HEAD blob',
  staged: '索引 blob',
  worktree: '工作树(人工逃生舱)',
}

/** 型①认成的**成对括注**形状表(位置策略表,扫描原语 = `matchBalancedGroupAt`,全仓只那一份)。
 *  半角方括号 `[...]` 刻意不在表内:台账里它装的是行文引用与处置档,不是标记。 */
const MARKER_PAIRS = { '（': '）', '(': ')', '【': '】', '〔': '〕' }

/** 括注之前允许出现的记号(markdown 强调/反引号/空白/冒号)—— 与 `LEAD_DECOR_PAIRS` 同族的既有口径。 */
const MARK_NOISE = new Set([' ', '\t', '*', '`', ':', '：'])
/** 括注之后允许出现的分隔符。 */
const MARK_SEP = new Set([' ', '\t', ':', '：'])

/** 型②认成的"连接符收尾"字符集:半角/全角的逗号、分号,以及顿号。
 *  只收**句内连接符**;不收 `。`/`.`(那本就是完整句的收尾,收了会把整仓的正常句子读成残行)。 */
export const TRAILING_CONNECTORS = [',', '，', ';', '；', '、']

/** 逐条点名时行原文的截断长度(整行可达数百字;截断必须带 `…(+N 字)` 计数,不得静默)。 */
export const REPORT_CLIP = 180

const firstLine = (e) => String(e?.message ?? e ?? '(无异常文本)').split('\n')[0]

/**
 * 型①判据:复选框之后除标记外是否一个字符都不剩。
 * 输入是**整行原文**(含复选框)——不是已剥好的正文,免得调用方各自剥出第二个口径。
 * @returns {{row:boolean, empty:boolean, unbalanced:boolean, rest:string}}
 *   `row=false` = 不是登记行(不参与判定);`rest` = 剥完标记后剩下的正文段(未剥成功时是停在哪儿的那一段)。
 */
export function emptyBodyOf(line) {
  const body = bodyOfRow(stripHeader(String(line ?? '')))
  if (body === null) return { row: false, empty: false, unbalanced: false, rest: '' }
  let cur = body
  for (;;) {
    let k = 0
    while (k < cur.length && MARK_NOISE.has(cur[k])) k += 1
    const rest = cur.slice(k)
    if (rest === '') return { row: true, empty: true, unbalanced: false, rest: '' }
    if (!MARKER_PAIRS[rest[0]]) return { row: true, empty: false, unbalanced: false, rest }
    const end = matchBalancedGroupAt(cur, k, MARKER_PAIRS)
    if (end < 0) return { row: true, empty: false, unbalanced: true, rest }
    let n = end
    while (n < cur.length && MARK_SEP.has(cur[n])) n += 1
    cur = cur.slice(n)
  }
}

/** 剥掉行尾的空白与 markdown 强调/行内代码记号,露出真正的"最后一个字符"。 */
export function stripTrailingNoise(line) {
  let s = String(line ?? '').replace(/\s+$/, '')
  for (;;) {
    const m = /([*`]+)$/.exec(s)
    if (!m) break
    s = s.slice(0, s.length - m[1].length).replace(/\s+$/, '')
  }
  return s
}

/**
 * 型②判据:正文是否以连接符收尾(半句被吃掉)。
 * @returns {{row:boolean, hit:boolean, tail:string, char:string|null}} `tail` = 剥完行尾噪音后的末尾片段(点名用)
 */
export function truncatedTailOf(line) {
  const body = bodyOfRow(String(line ?? ''))
  if (body === null) return { row: false, hit: false, tail: '', char: null }
  const t = stripTrailingNoise(line)
  const char = t === '' ? null : t[t.length - 1]
  const hit = char !== null && TRAILING_CONNECTORS.includes(char)
  return { row: true, hit, tail: t.slice(-40), char }
}

/** 逐条点名的行前缀:被审面行号 + 勾选态 + 主键(读不到主键就明写,不空着让人猜)。 */
function rowTag(r) {
  return `L${r.line} ${r.state} ${r.key ?? '(无主键)'}`
}

/** 行原文截断到 REPORT_CLIP 字,并**如实报出被截掉的字数**(静默截断等于谎报现场)。 */
export function clipRow(raw) {
  const one = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (one.length <= REPORT_CLIP) return one
  return `${one.slice(0, REPORT_CLIP)}…(+${one.length - REPORT_CLIP} 字)`
}

/**
 * 两型判定。**纯函数**:输入是已解析好的行集,不碰 git、不碰盘 ——
 * 这样镜像测试与 `--self-test` 能用同一份实现跑构造面,而不是另抄一套判据(§22c)。
 */
export function judge(rows) {
  const empty = []
  const truncated = []
  let unbalanced = 0
  for (const r of rows) {
    const e = emptyBodyOf(r.raw)
    if (e.empty) empty.push(`${rowTag(r)}｜${clipRow(r.raw)}`)
    else if (e.unbalanced) unbalanced += 1
    const t = truncatedTailOf(r.raw)
    if (t.hit) truncated.push(`${rowTag(r)}｜以「${t.char}」收尾｜…${t.tail}`)
  }
  return {
    scanned: rows.length,
    open: rows.filter((r) => r.state === 'open').length,
    done: rows.filter((r) => r.state === 'done').length,
    empty,
    truncated,
    unbalancedParen: unbalanced,
  }
}

/**
 * 结论。**只有 0 与 2 两档退出码**:命中的是历史存量,与本次提交内容无关(§12e)。
 * `scanned === 0` = 尺子什么都没看见 ⇒ 未判定,不得读成"没有残行"(§0.3)。
 */
export function verdict(v, face) {
  if (v.scanned === 0) {
    return {
      state: 'undetermined',
      code: 2,
      line: `LEDGER-EATEN-ROWS-RESULT state=undetermined empty=NA truncated=NA open=NA rows=0 face=${face}`,
    }
  }
  const hits = v.empty.length + v.truncated.length
  const state = hits === 0 ? 'clean' : 'warn'
  return {
    state,
    code: 0,
    line: `LEDGER-EATEN-ROWS-RESULT state=${state} empty=${v.empty.length} truncated=${v.truncated.length} open=${v.open} rows=${v.scanned} face=${face}`,
  }
}

/** 未判定那一档的输出行(取材失败、空文本、枚举到 0 行共用同一出口,不各写一份 NA 末行)。
 *  `rows` 缺省 `NA` = "视野没建立起来";只有**枚举到 0 行**那一臂才填 0 —— 它确实读到了面,
 *  只是面上没有登记行。把这一档也写成 NA 就等于抹掉"面取到了"这个凭据,两种 0 会重新混读。 */
function undeterminedLines(why, face, rows = 'NA') {
  return [
    `⚠️ 未判定 —— ${why}`,
    `LEDGER-EATEN-ROWS-RESULT state=undetermined empty=NA truncated=NA open=NA rows=${rows} face=${face}`,
  ]
}

/**
 * 已取回的**面文本** ⇒ 判定 + 报告行(纯函数:不碰 git、不碰盘)。
 * 拆出这一层的唯一目的是让"构造面"能原样走**同一条**判定与出报通道 ——
 * 测试不许自己拼一份报告,否则报告面上写的结论与真跑时读到的可能不是同一句话。
 */
export function judgeText(text, face) {
  if (text === null || text === undefined || text === '')
    return {
      code: 2,
      lines: undeterminedLines(
        `${FACE_LABEL[face] ?? face} 取回的 ${PLAN_REL} 是空文本(空面不是"零残行")`,
        face,
      ),
    }
  const lines = []
  const v = judge(parseTaskRows(text))
  if (v.scanned === 0)
    return {
      code: 2,
      lines: undeterminedLines(
        `${FACE_LABEL[face] ?? face} 取回 ${String(text).length} 字文本却**枚举到 0 个登记行** ⇒ 尺子失明或取材面不对,两种都不能读成"没有残行"`,
        face,
        0,
      ),
    }
  const r = verdict(v, face)
  lines.push(
    `判定面:${FACE_LABEL[face] ?? face} ⊕ 同轮登记行 ${v.scanned} 条(open ${v.open} / done ${v.done})` +
      (v.unbalancedParen > 0
        ? ` —— 另有 ${v.unbalancedParen} 条括注不配平:**不吃、不判型①**(配平失败不猜)`
        : ''),
  )
  lines.push(
    `型① 空正文(复选框后除标记外无正文)${v.empty.length} 枚 / 型② 截断正文(连接符收尾)${v.truncated.length} 枚`,
  )
  if (v.empty.length === 0 && v.truncated.length === 0)
    lines.push(
      '  · 两型均 0 命中 —— 这是"扫过 rows 条之后的 0",不得与"没扫到行"混读(视野条数见末行 rows=)',
    )
  for (const l of v.empty) lines.push(`  · 型① ${l}`)
  for (const l of v.truncated) lines.push(`  · 型② ${l}`)
  if (r.state === 'warn')
    lines.push(
      '  → 只读尺子:命中**不判红、不代改**——逐条人读后再定是哪个器物产的(代摘器 skipLines 通路 / 行级 union 拼断 / 归档占位截断),不许先开处方',
    )
  lines.push(r.line)
  return { code: r.code, lines, verdict: r, judged: v }
}

/** 取材(同面同轮,§0.4:取不到绝不回落另一个面)→ judgeText。返回 `{code, lines}`,不打印、不写盘。 */
export function run({ root = ROOT, face = 'head' } = {}) {
  let text
  try {
    assertRepoRoot(root, `${FACE_LABEL[face] ?? face} 取材根`)
    text = readPlan(root, face)
  } catch (e) {
    return {
      code: 2,
      lines: undeterminedLines(
        `${FACE_LABEL[face] ?? face} 取不到 ${PLAN_REL}:${firstLine(e)}`,
        face,
      ),
    }
  }
  return judgeText(text, face)
}

/** 用法文本(不写"跑不通的出路",§0.8:这三条都是真能跑的)。 */
export const USAGE = [
  '用法:node scripts/check-ledger-eaten-rows.mjs [--staged | --worktree] [--root <仓库根>]',
  '  默认档 = 判 HEAD blob(全量档);--staged 判索引 blob;--worktree 只作人工逃生舱,两面旗同给 ⇒ 未判定',
  '  退出码:0 = 判定完成(命中几枚都是 0,本尺不判红)/ 2 = 未判定(取不到被审面、面为空、枚举到 0 行、用法错)',
]

/**
 * argv 取值(纯函数,门体薄壳与镜像测试共用同一份):
 *  - 两面旗同给 ⇒ 交给 `selectFace` 的既有口径报"用法错"(判死不猜,不回落另一个面);
 *  - `--root` 给了旗标没给值 ⇒ `requireFlagValue` 判死,**绝不静默退回默认根**(G-322);
 *  - 认不出的旗标 ⇒ 用法错(静默忽略未知旗标 = 把"我没判这一维"读成"这一维过了")。
 * @returns {{error:string|null, root:string, face:string, help:boolean}}
 */
export function parseArgv(argv, defaultRoot = ROOT) {
  const list = Array.isArray(argv) ? argv : []
  const help = list.includes('--help')
  const known = new Set(['--staged', '--worktree', '--root', '--help'])
  const picked = []
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    if (a === '--root') {
      i += 1
      continue
    }
    if (String(a).startsWith('--') && !known.has(a)) picked.push(String(a))
  }
  const root = requireFlagValue(list, '--root', { noun: '目录(仓库根)', fallback: defaultRoot })
  if (root.error) return { error: root.error, root: null, face: null, help }
  if (picked.length > 0)
    return {
      error: `不认得的旗标:${picked.join(' ')}(本尺只吃 --staged / --worktree / --root / --help)`,
      root: null,
      face: null,
      help,
    }
  const sel = selectFace({
    staged: list.includes('--staged'),
    worktree: list.includes('--worktree'),
  })
  if (sel.error) return { error: sel.error, root: null, face: null, help }
  return { error: null, root: root.value, face: sel.face, help }
}

export const __test__ = {
  ROOT,
  PLAN_REL,
  FACE_LABEL,
  MARKER_PAIRS,
  TRAILING_CONNECTORS,
  REPORT_CLIP,
  emptyBodyOf,
  stripTrailingNoise,
  truncatedTailOf,
  clipRow,
  judge,
  verdict,
  judgeText,
  run,
  parseArgv,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
