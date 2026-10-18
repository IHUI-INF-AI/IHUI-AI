#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 量算工具为 CLI,需 console 输出清单与读数 */
/**
 * G-790 冗余判别列进谓词 —— **只读量算尺子**(2026-10-08 立,台账 G-790)。
 * ## 量什么
 * 一条 SQL/Drizzle 谓词用 **JSON 内容**当类别判别(`json_extract(col,'$.k')` / `col->>'k'` / `col @> '…'::jsonb`),而**同一条谓词里没有独立列条件**。论证原话(上游 `dwf-journal-artifacts.ts` 的同型注释;本仓那份只躺在 `.ihui-agent/tmp/zcode-study/` 下、**未入库**,故射程按我方代码面现读取,不引那份路径当出处):「今天 payload 里只有 artifact-published,它带的是嵌套 artifact.id 而不是顶层 artifactId,**但明天未必**」⇒ 不能靠"目前没有那个顶层键"这一**巧合**省掉条件。失效是安静的:某天新增一种带顶层同类键的事件,看板数据流混入无关条目,而条数与分页"看起来正常"。
 * **本票第一步是把这张清单量出来**(票面原话:只报数不立项 = 交给人猜)。本尺子因此**不判红、不接提交链、头注不自称已装车、没有应急跳过变量**;`--strict` 只多做一件事:有未判定或覆盖面未闭合 ⇒ exit 2 **拒绝出具合格证** —— 而不是把未判定冒充成违规。
 * ## 四态绝不并桶
 *  - **命中 hit**:JSON 取用处在**谓词位**,而所在谓词单元里**没有任何独立列条件**。
 *  - **放过 pass**:同一单元里有独立列条件 —— 正确写法必须认得出,否则合规站点被报成债(假阳比漏报更贵:它指使人修没坏的东西,还把口径说歪成"问题很多")。子档 `equality` / `presence`(只有 IS NULL / IS NOT NULL;developer-relay 的 `api_key_id IS NOT NULL` 正是这档)/ `inherited`(聚合内 FILTER(WHERE),行集继承自同条 WHERE)。**那一列是否确为该类别的判别列不由本尺子裁定**,清单带上条件原文交人读。
 *  - **未判定 undetermined**:谓词边界取不出(集合声明找不到、片段经跨函数 helper 组装、括号配不平、字符串里的 SQL 没有执行入口)、**以及整个 Python 面**(见下)⇒ 逐条点名。
 *  - **不适用 not-applicable**:同一条 JSON 取用**不在筛行**的位置 —— 投影 / 聚合 / `CASE WHEN` 分档取数 / `GROUP BY` / `ORDER BY` 表达式 / `jsonb_set` 写侧 / 正则字面量 / JS 层 `JSON.parse` 后筛。票面点名:**"当过滤条件用" ≠ "当取值/展示用"** —— 给它加判别列条件既无意义,也会误导下一个人去修没坏的东西。
 * ## 两条只报数的维度(票面 :60-63 那两格)
 *  - **O1**:读查询的 `ORDER BY` 只有主键 `id`,窗口里找不到展示序字段(ordinal / sequence / sort_order / position / display_order / step_index / rank …);
 *  - **O2**:读面谓词里出现"只留成功态"的等值(`status = 'success'` / `eq(t.status,'completed')`)。
 *  两者**只报名 + 计数,永不参与退出码**:判"被筛掉的是不是用户可见的失败"要读消费面,判"该不该按 ordinal 排"要读产品语义 —— 尺子给不出结论。识别不到的形态落 `auxUndetermined` 点名,所以**"候选 0" 不得被读成"确信没有"**。
 * ## Python 档:为什么整族判未判定而不是硬判
 * 遮噪唯一实现 `scripts/lib/code-mask.mjs` 的脚本方言表 `SCRIPT_COMMENT_DIALECTS` 现读只有 `ps/sh/bat/vbs` —— **没有 py 档**。JS 词法套到 `.py` 上两个方向都错:`#` 注释不会被剥(注释里的 SQL 叙述被当代码),三引号 docstring 会被切碎成"空串 + 裸代码"(实测 `"""SELECT …"""` 被读成 `""` + `"` + 代码)。⇒ 宁可整族判未判定并逐条点名(带行原文 + "疑似注释/文档叙述"的启发式旁注,**旁注不改变状态**),也不产出一张可能是假的清单。补 py 档归遮罩层持有人(守门 194 登记的"跨行正则档"是同一格),本尺子**不放宽判据、也不自带第二台分词器**。
 * ## 与近邻门的分工(不重复计账)
 *  - **守门 188 `check-authorization-column-isolation.mjs`** 量**列选取维**(「授权判据所在的查询不得与展示映射共用一条 SELECT」,把 403/404 拖成 500 那一型);本尺子量**谓词维**(「用 JSON 内容判类别时同一条谓词里有没有独立列条件」)。同一条查询可被两道门各自点名,判的不是同一件事,**谁也不得替谁顶账**。本尺子**导入**它的 `extractSqlLiterals`(把 Python 相邻拼接/三引号的 SQL 抠成整条语句)而不是重写一份 —— 两处算同一件事必漂移。
 *  - **守门 134 `check-batch-write-count-honesty.mjs`** 量**写侧回报计数**(affected 取库确认集);本尺子只看**读侧筛选谓词的形状**,134 的 `findRawSqlWriteChains` 只认写动词,两面不重叠。
 *  - **守门 167 `check-turn-ordinal-lock.mjs`** 量「序号分配点上有没有行锁」(并发分配维),同读 SQL 模板但问的是锁;两条判据互相看不见对方。
 *  - **`apps/api/src/routes/__tests__/g790-json-filter-discriminator.test.ts`** 是**站点行为形状锁**(对具体几处断言谓词形状与读面映射,自带变异对照),**不是枚举器** —— 它绿不证明"全仓这一族都看过了";本尺子是按面枚举的那一把。
 *  - **`…/README-g790-json-filter-inventory.md`** 是**人工分档台账**(A 命中 / B 取值 / C 聚合内 filter / D 叙述 / E 待迁移)。台账给"为什么",本尺子给"今天还在不在";读数不一致时**以现读为准**,而本尺子的计数**不能替代**台账里"哪条该改代码、哪条缺列只能待迁移"的人工定性。
 * ## 射程与覆盖面自证
 * 在射程:`apps/api/src/**`(ts/tsx/js/jsx/mjs)、`apps/ai-service/app/**`(.py,整族未判定)、`scripts/*.mjs`(**仅顶层**工具脚本);测试面(`__tests__`/`tests` 目录、`*.test.*`、`test_*.py`)不看。刻意排除的面对每条都带当次实测出处(见 `OUT_OF_SCOPE`):`packages/database/` 探测形态 0 处(363 行命中全是 `jsonb('列名')` 类型声明)、`apps/cli/` 与 `apps/extension/` 0 处、`apps/web/` 唯一命中是 mermaid-render-budget.ts 的正则字面量图形语法(非 SQL)、`apps/miniapp-taro/` 只在二进制资产字节、`scripts/lib/` 与 `scripts/tests/` 0 处、`docs/` 是文档叙述面。代价如实登记:**测试文件里的同类 SQL 不看**(守门 131/134 同一课:判据面不剥"解释自己"的散文就会把夹具判成站点)。覆盖面自证:含探测形态的跟踪**源码**文件既不在射程、也不在排除清单、也不是测试面 ⇒ 计入 `coverageGaps` 并点名(`--strict` 下拒绝出合格证),防"扩面时忘了同步排除表"。
 * ## 已知判不了格(不冒充覆盖)
 * 条件经跨函数 helper 组装 ⇒ 未判定;`metadata ? 'body'` 这类 jsonb **键存在**运算符不探测(`?` 与 TS 三元/可选链同形,认它必产假阳 ⇒ 该形态整族无判据,**不是**"已确认没有");Python 面整族未判定;"独立列里那一列是不是该类别的判别列"归人裁(只分 equality/presence,并把"证据来自 if 分支内的 push"标成 `branchScoped` 旁注);O1 的"同一作用域"取最近一层花括号块做窗口,窗口可能比一条查询宽(过宽 ⇒ 少报候选,方向保守),窗口字节数随每条一起报。
 * ## 口径(同 70/77/83/98/101/103/118/150/194)与 CLI
 * 全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工;两面旗同给 ⇒ exit 2;取不到不回落另一个面、绝不记绿;**清单与正文同面同轮**(HEAD 档枚举 `ls-tree -r … HEAD`、索引档 `ls-files -c`,内容一律 `catBatch`,都出自 `./lib/face-reader.mjs`);**枚举到 0 = 判死**(exit 2)。派生 git 一律带 `timeout`(守门 80);本文件不出现裸 `execSync('git …')` 也不按磁盘读被审内容(守门 118)。
 * `node scripts/check-redundant-discriminator-predicate.mjs [--staged|--worktree] [--json] [--strict] [--self-test] [--root <仓根>]` —— **0** = 判定完成(命中多少都不改退出码);**2** = 用法错 / 取材不到 / 枚举 0 判死 / 分类未走完(内部漏档)/ `--strict` 下有未判定或覆盖面未闭合。
 * **不写文件、不改 git 状态、不在提交链上,故没有应急跳过变量。**
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings, scanSpans } from './lib/code-mask.mjs'
// 复用守门 188 那一份 SQL 字面量抠取(三引号 + 相邻拼接),不在本文件抄第二遍。
import { extractSqlLiterals } from './check-authorization-column-isolation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120_000 // 守门 80:热路径 git 只读调用不得无界
const MAX_FILE_CHARS = 900 * 1024
const LIST_CAP = 60
const NOTE_O2 = '候选≠结论:被筛掉的是不是"用户可见的失败"要读消费面'
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }

export const SCOPE_DIRS = ['apps/api/src/', 'apps/ai-service/app/', 'scripts/']
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i, PY_EXT = /\.py$/i
const TEST_PATH_RE = /(^|\/)(__tests__|tests|test)\//, TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i

/** 覆盖面自证的排除清单(理由见头注,每条都带实测出处)。 */
export const OUT_OF_SCOPE = [
  { glob: 'packages/database/', why: '现读 json_extract|->>|@> 0 处;命中全是 jsonb(列) 声明' },
  { glob: 'apps/cli/', why: '现读探测形态 0 处' },
  { glob: 'apps/extension/', why: '现读探测形态 0 处' },
  { glob: 'apps/web/', why: '唯一形态命中是 mermaid 渲染预算里的正则字面量,非 SQL' },
  { glob: 'apps/miniapp-taro/', why: '仅二进制资产字节碰巧含 ->> 形态,非源码' },
  { glob: 'scripts/lib/', why: '现读探测形态 0 处' },
  { glob: 'scripts/tests/', why: '现读探测形态 0 处' },
  { glob: 'docs/', why: '文档叙述面' },
]

/** 测试面(刻意不看的那一格;判据与夹具字符串住在这一面,守门 131/134 同课)。 */
export function testFaceOf(rel) {
  const p = String(rel || '')
  return TEST_PATH_RE.test(p) || TEST_FILE_RE.test(p) || /(^|\/)test_[^/]+\.(py|ts|js|mjs)$/i.test(p)
}

/** 射程:`scripts/` 只取**顶层** `.mjs`(lib/tests/data 已按实测排除)。 */
export function inScope(rel) {
  const p = String(rel || '')
  if (testFaceOf(p)) return false
  if (p.startsWith('apps/api/src/')) return CODE_EXT.test(p)
  if (p.startsWith('apps/ai-service/app/')) return PY_EXT.test(p)
  if (p.startsWith('scripts/')) return /^scripts\/[^/]+\.mjs$/i.test(p)
  return false
}

/** 覆盖面自证:含探测形态、既不在射程也不在排除清单也不在测试面的**源码**文件(非源码不算缺口)。 */
export function coverageGapOf(rel) {
  const p = String(rel || '')
  if (inScope(p) || testFaceOf(p) || OUT_OF_SCOPE.some((e) => p.startsWith(e.glob))) return false
  return CODE_EXT.test(p) || PY_EXT.test(p)
}

/**
 * "用 JSON 内容判类别"的书写形态。`->>` / `->` / `@>` 的左侧在 Drizzle 里是
 * `${llmCallLogs.metadata}` 这种模板插值,正则吃不下 ⇒ 一律经 `leftColumnOf` 回取
 * (漏掉主形态 = 尺子对自己立项那一型失明,守门 102 左向箭头同课)。
 */
export const PROBE_SHAPES = [
  { name: 'sqlite json_extract', re: /\bjson_extract\(\s*([\w$]+(?:\.[\w$]+)?)\s*,\s*['"]\$\.([\w.]+)['"]\s*\)/g, col: (m) => m[1], key: (m) => m[2] },
  { name: 'pg 文本提取 ->>', re: /->>\s*['"](\w+)['"]/g, col: (m, f, i) => leftColumnOf(f, i), key: (m) => m[1] },
  { name: 'pg jsonb 提取 ->(非文本)', re: /(^|[^>\-])->(?!>)\s*['"](\w+)['"]/g, col: (m, f, i) => leftColumnOf(f, i + m[1].length), key: (m) => m[2] },
  { name: 'jsonb 包含 @>', re: /@>\s/g, col: (m, f, i) => leftColumnOf(f, i), key: () => '' },
  { name: 'jsonb_extract_path_text', re: /\bjsonb_extract_path_text\(\s*([\w$]+(?:\.[\w$]+)?)/g, col: (m) => m[1], key: () => '' },
]

const DRIZZLE_COND_RE = /\b(eq|ne|inArray|notInArray|isNull|isNotNull)\(\s*([\w$]+(?:\.[\w$]+)*)/g
// 单个 `=` 必须在档内:漏它会把 `namespace = $1` 这类正确写法读成"没有独立列条件"⇒ 合规站点被判债。
const SQL_COND_RE = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\s*(===|==|!==|!=|<>|IS\s+NOT\s+NULL|IS\s+NULL|IS\s+DISTINCT\s+FROM|\bIN\s*\(|=)(?![>=])/gi
/** 范围/模糊比较不缩小"行族类别" ⇒ 永不算判别列(README 的 A3 正是靠这条才落到命中)。 */
const NOT_DISCRIMINATOR = /\b(gte|lte|gt|lt|like|ilike|between)\b/i
const PRED_KW_RE = /\b(FILTER\s*\(\s*WHERE|WHERE|HAVING|ON|AND|OR)\b/gi
const PROJ_KW_RE = /\b(SELECT|CASE|WHEN|THEN|GROUP\s+BY|ORDER\s+BY|VALUES|RETURNING|SET|FROM|AS)\b/gi
const HOST_PREDICATE = new Set(['and', 'or', 'where', 'push', 'append', 'extend', 'add'])
const HOST_PROJECTION = new Set(['select', 'sum', 'SUM', 'avg', 'AVG', 'count', 'COUNT', 'groupBy', 'orderBy', 'desc', 'asc', 'case', 'jsonb_set'])
/** 未加 tag 的普通字符串里的 SQL,要有这些执行/组装入口之一才可信(否则多半是说明文字)。 */
const EXEC_HOSTS = new Set(['execute', 'query', 'fetch', 'fetchall', 'fetchone', 'fetchval', 'prepare', 'run', 'all', 'get', 'exec', 'text', 'sql', 'raw'])
const COLLECTION_HOSTS = new Set(['push', 'append', 'extend', 'add'])
const SQL_TAG = new Set(['sql', 'raw', 'text', 'oneOf', 'many'])
const DISPLAY_ORDER_RE = /\b(ordinal|sequence|seq|sort_order|sortOrder|display_order|displayOrder|position|row_order|order_index|step_index|rank|order_no|orderNo)\b/
const SUCCESS_LITERAL_RE = /\b(status|state|result|outcome)\w*\s*(?:===?|=\s*|\bIN\s*\()\s*'?(success|succeeded|completed|done|ok|passed)\b/i
const DRIZZLE_SUCCESS_RE = /\b(?:eq|inArray)\(\s*([\w$]+(?:\.[\w$]+)?)\s*,\s*'(success|succeeded|completed|done|ok|passed)'/g
const ORDER_BY_RE = /\bORDER\s+BY\b([^\n]*)/i
const ORDER_BY_ID_ITEM = /^(?:`?\w+`?\.)?`?id`?\s*(?:(?:asc|desc)\s*)?(?:nulls\s+(?:first|last))?$/i
const JS_FILTER_HOST = new Set(['filter', 'find', 'some', 'findIndex'])

/** 等长遮罩:区间内非换行字符换成空格 ⇒ 行列不漂,同一偏移可在两个面之间互查。 */
export function blankRanges(text, ranges) {
  if (typeof text !== 'string' || text.length === 0) return text
  const chars = text.split('')
  for (const r of ranges) {
    const b = Math.min(chars.length, r[1])
    for (let i = Math.max(0, r[0]); i < b; i++) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

/** 投影 A(判据面):剥注释、**保留字符串与模板体**(SQL 住在字符串里,连字符串抹 = 对本型全盲)。 */
export function judgeFace(src) {
  const ranges = scanSpans(src).filter((s) => s.kind === 'line' || s.kind === 'block').map((s) => [s.start, s.end])
  return blankRanges(src, ranges)
}

/** 投影 B(结构面):注释 + 字符串体 + 正则体都抹 ⇒ 括号栈只反映代码结构。 */
export function structFace(src) {
  const ranges = scanSpans(src).filter((s) => s.kind === 'regex').map((s) => [s.start, s.end])
  return blankRanges(maskCommentsAndStrings(src), ranges)
}

/** 行号(1 起):两投影等长保换行 ⇒ 与原文一致(不成立时清单点到的行号就是假的)。 */
export function lineAt(text, idx) {
  let n = 1
  for (let i = 0, limit = Math.min(Math.max(0, idx), text.length); i < limit; i++) if (text[i] === '\n') n++
  return n
}

/** 由内而外的括号栈(在结构面上走)。`closeAt:-1` = 配不平 ⇒ 调用方必须落未判定,不得猜。 */
export function framesOf(struct, idx) {
  const out = []
  let cursor = Math.min(idx, struct.length)
  for (let guard = 0; guard < 14 && cursor > 0; guard++) {
    const openAt = scanBracket(struct, cursor, -1)
    if (openAt < 0) break
    const closeAt = scanBracket(struct, openAt, 1)
    const left = struct.slice(Math.max(0, openAt - 60), openAt)
    const callee = /([\w$]+(?:\.[\w$]+)*)\s*$/.exec(left)?.[1] || ''
    const segs = callee.split('.')
    out.push({ name: segs.pop() || '', receiver: segs.join('.'), callee, ch: struct[openAt], openAt, closeAt, argStart: openAt + 1, argEnd: closeAt < 0 ? struct.length : closeAt })
    cursor = openAt
  }
  return out
}

function scanBracket(struct, from, dir) {
  let depth = 0
  for (let i = from + dir; i >= 0 && i < struct.length; i += dir) {
    const opening = struct[i] === '(' || struct[i] === '[' || struct[i] === '{'
    const closing = struct[i] === ')' || struct[i] === ']' || struct[i] === '}'
    if (!opening && !closing) continue
    if ((dir < 0 ? closing : opening)) depth++
    else if (depth === 0) return i
    else depth--
  }
  return -1
}

const stringSpanAt = (spans, idx) => spans.find((s) => s.kind === 'string' && idx >= s.start && idx < s.end) || null
const lastSegment = (col) => String(col || '').split('.').pop() || ''
const tagOfSpan = (src, span) => (src[span.start] !== '`' ? '' : /([\w$]+)\s*$/.exec(src.slice(Math.max(0, span.start - 40), span.start))?.[1] || '')

/** 从 `->>` / `->` / `@>` 左侧回取列名(允许 `${tbl.col}` / `tbl.col` / `col`)。 */
export function leftColumnOf(face, arrowIdx) {
  let i = arrowIdx - 1
  while (i >= 0 && /\s/.test(face[i])) i--
  if (i >= 0 && face[i] === '}') {
    const open = face.lastIndexOf('${', i)
    if (open >= 0) return /([\w$]+(?:\.[\w$]+)*)\s*$/.exec(face.slice(open + 2, i))?.[1] || ''
  }
  return /([\w$]+(?:\.[\w$]+)*)\s*$/.exec(face.slice(Math.max(0, i - 60), i + 1))?.[1] || ''
}

function lastKeywordBefore(carrier, pos, re) {
  let best = { at: -1, kw: '' }
  re.lastIndex = 0
  let m
  while ((m = re.exec(carrier)) !== null) {
    if (m.index >= pos) break
    if (m.index > best.at) best = { at: m.index, kw: m[0].replace(/\s+/g, ' ').toUpperCase() }
  }
  return best
}

function aggregateFilterAt(carrier, pos) {
  const at = lastKeywordBefore(carrier, pos, /\bFILTER\s*\(\s*WHERE\b/gi).at
  if (at < 0) return false
  const closeIdx = carrier.indexOf(')', at)
  return closeIdx < 0 || pos < closeIdx
}

/** 单元文本里的独立列条件(排除:探测所在列自身、JSON 表达式本身、范围/模糊比较)。 */
export function columnConditionsIn(unitText, probeCols) {
  const found = []
  const probeLast = new Set(probeCols.map(lastSegment).filter(Boolean))
  const take = (col, kind, text) => {
    const seg = lastSegment(col)
    if (!seg || probeLast.has(seg)) return
    if (/->>|->|json_extract|jsonb_extract_path_text|@>|jsonb_typeof/i.test(text) || /^(sql|raw|text|and|or|not|eq|ne|inArray|isNull|isNotNull|gte|lte|gt|lt|desc|asc)$/i.test(col)) return
    if (NOT_DISCRIMINATOR.test(text)) return
    found.push({ column: col, kind, text: text.trim().replace(/\s+/g, ' ').slice(0, 90) })
  }
  let m
  const dr = new RegExp(DRIZZLE_COND_RE.source, 'g')
  while ((m = dr.exec(unitText)) !== null) take(m[2], m[1].startsWith('is') ? 'presence' : 'equality', m[0])
  const sq = new RegExp(SQL_COND_RE.source, 'gi')
  while ((m = sq.exec(unitText)) !== null) take(m[1], /^IS\s+(NOT\s+)?NULL/i.test(m[2]) ? 'presence' : 'equality', m[0])
  const seen = new Set()
  return found.filter((f) => (seen.has(`${f.column}|${f.kind}`) ? false : seen.add(`${f.column}|${f.kind}`)))
}

/** 条件是否来自 `if` 守卫内的 push(旁注给人读,不裁结论)。 */
function branchScopedFrom(lines, lineIdx) {
  for (let i = lineIdx - 2, steps = 0; i >= 0 && steps < 4; i--, steps++) {
    const l = lines[i]
    if (l === undefined) break
    if (/^\s*(?:\}\s*)?(?:else\s+)?if\s*\(/.test(l) || /^\s*(?:\}\s*)?else\b/.test(l)) return true
  }
  return false
}

/** 一次探测的位侧判定:终态,或 `{state:'need-unit'}` 交调用方取谓词单元再定档。 */
export function classifyProbeSite(arg) {
  const { carrier, carrierKind, tag, hostNames, posInCarrier, collHost, collectionDecl } = arg
  if (carrier) {
    if (aggregateFilterAt(carrier, posInCarrier)) return { state: 'pass', kind: 'inherited', why: '分类在聚合的 FILTER (WHERE) 里 ⇒ 行集由同条语句的 WHERE 决定(判别面继承);各写一遍必漂移' }
    // CASE…END 未闭合 ⇒ 取用在分档分支里:同一行里 `OR`/`AND` 比 `WHEN` 离探测点更近,只看"最近关键字"会把
    // 分档取数读成谓词位(实测 earnings-routes.ts:178/190 的第二个 ->> 就这样被误判过)⇒ 先按结构定档。
    const before = carrier.slice(0, posInCarrier)
    if ((before.match(/\bCASE\b/gi) || []).length > (before.match(/\bEND\b/gi) || []).length) return { state: 'not-applicable', kind: 'case-branch', why: '取用落在未闭合的 CASE…END 分支里 ⇒ 分档取数,不筛行(票面点名的区分)' }
    const pred = lastKeywordBefore(carrier, posInCarrier, PRED_KW_RE)
    const proj = lastKeywordBefore(carrier, posInCarrier, PROJ_KW_RE)
    // 未加 tag 的普通字符串:没有执行/组装入口就不信它是 SQL(说明文字与叙述串走这一档)
    if (carrierKind === 'plain-string' && !SQL_TAG.has(tag) && !hostNames.some((n) => EXEC_HOSTS.has(n))) return { state: 'undetermined', kind: 'no-exec-entry', why: '字符串里有 SQL 形态但找不到执行/组装入口 ⇒ 不猜(也不得读成"这不是 SQL")' }
    if (pred.at > proj.at) return { state: 'need-unit', unitKind: `clause:${pred.kw}` }
    if (proj.at > pred.at) return { state: 'not-applicable', kind: 'projection', why: `承载文本里最近的结构关键字是 ${proj.kw} ⇒ 取值/展示位,不筛行(票面点名的区分)` }
  }
  const hostP = hostNames.find((n) => HOST_PREDICATE.has(n))
  const hostJ = hostNames.find((n) => HOST_PROJECTION.has(n))
  if (hostP && (!hostJ || hostNames.indexOf(hostP) < hostNames.indexOf(hostJ))) {
    if (COLLECTION_HOSTS.has(hostP)) {
      if (!collectionDecl)
        return { state: 'undetermined', kind: 'collection-scope', why: `条件是 ${collHost || hostP} 集合的成员,而该集合的声明与其余成员取不出 ⇒ 无法证明"没有独立列条件"` }
      return { state: 'need-unit', unitKind: `collection:${hostP}` }
    }
    return { state: 'need-unit', unitKind: `host:${hostP}` }
  }
  if (hostJ) return { state: 'not-applicable', kind: 'projection', why: `宿主调用是 ${hostJ}(投影/聚合/排序面)` }
  if (carrier) return { state: 'need-unit', unitKind: 'statement' }
  return { state: 'not-applicable', kind: 'js-face', why: '不在任何字符串承载内 ⇒ 非 SQL 面(JS 比较或其它语言形态)' }
}

function findCollectionDecl(face, receiver) {
  if (!receiver) return null
  const esc = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:const|let|var)\\s+${esc}\\b[^=;]*?=\\s*(\\[[^\\]]*\\])`).exec(face)
  return m ? { text: m[1], at: m.index } : null
}

/** 集合单元 = 声明数组 + 该变量全部 push/append/`+=` 成员(配不平 ⇒ 交回未判定)。 */
function collectCollectionUnits(face, struct, receiver, decl) {
  const esc = String(receiver || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = decl ? [{ text: decl.text, from: 'decl', at: decl.at }] : []
  let m
  const pushRe = new RegExp(`\\b${esc}\\s*\\.\\s*(?:push|append|extend|add)\\s*\\(`, 'g')
  while ((m = pushRe.exec(struct)) !== null) {
    const openAt = m.index + m[0].length - 1
    const close = scanBracket(struct, openAt, 1)
    if (close < 0) return { parts, unbalanced: true }
    parts.push({ text: face.slice(openAt + 1, close), from: 'push', at: openAt })
  }
  const plusRe = new RegExp(`\\b${esc}\\s*\\+=\\s*(\\[[^\\]]*\\]|"[^"]*"|'[^']*'|f"[^"]*"|f'[^']*')`, 'g')
  while ((m = plusRe.exec(face)) !== null) parts.push({ text: m[1], from: 'assign', at: m.index })
  return { parts, unbalanced: false }
}

/** `...other` 展开的集合要并进同一谓词单元:只看展开处会漏掉声明里的独立列 ⇒ 合规站点被报成债。 */
function spreadCollections(face, struct, text) {
  let acc = text
  const names = []
  for (const name of (text.match(/\.\.\.([\w$]+)/g) || []).map((x) => x.slice(3))) {
    const decl = findCollectionDecl(face, name)
    if (!decl) continue
    const got = collectCollectionUnits(face, struct, name, decl)
    if (got.unbalanced) return { undetermined: `${name} 的 push 实参括号配不平 ⇒ 单元取不出` }
    acc += ' , ' + got.parts.map((p) => p.text).join(' , ')
    names.push(name)
  }
  return { text: acc, names }
}

/** 探测点是某数组字面量的成员 ⇒ 该数组(含声明名与后续 push)就是同一条谓词单元。 */
function enclosingArrayUnit(face, struct, idx, probeCol) {
  const fr = framesOf(struct, idx).find((f) => f.ch === '[' && f.closeAt > idx)
  if (!fr) return null
  const decl = /(?:const|let|var)\s+([\w$]+)(?:\s*:[^=]*)?\s*=\s*$/.exec(struct.slice(Math.max(0, fr.openAt - 120), fr.openAt))
  const name = decl ? decl[1] : ''
  let text = face.slice(fr.openAt + 1, fr.closeAt)
  if (name) {
    const got = collectCollectionUnits(face, struct, name, { text, at: fr.openAt })
    if (got.unbalanced) return { undetermined: 'collection-unbalanced', why: `${name} 的 push 实参括号配不平 ⇒ 单元取不出` }
    text = got.parts.map((p) => p.text).join(' , ')
  }
  const sp = spreadCollections(face, struct, text)
  if (sp.undetermined) return { undetermined: 'collection-unbalanced', why: sp.undetermined }
  return { kind: `collection(${name || '?'})`, columns: columnConditionsIn(sp.text, probeCol), branchScoped: false }
}

/** 谓词单元:集合成员 ⇒ 声明 + 全部成员;内联 and/or/where ⇒ 该调用实参(含 `...conds` 展开);否则整条承载文本。 */
function buildUnit(ctx) {
  const { face, struct, src, idx, span, unitKind, collReceiver, collDecl, lines } = ctx
  const probeCol = [leftColumnOf(face, idx)]
  // 集合优先于"内联 and/or/where":同一 `conds.push()` 里的第二个 ->>(前面有 OR)与第一个同属一条谓词,
  // 按 clause 切会把一条谓词拆成两半 ⇒ 合规站点被报成债。
  if (collReceiver && collDecl) {
    const got = collectCollectionUnits(face, struct, collReceiver, collDecl)
    if (got.unbalanced) return { undetermined: 'collection-unbalanced', why: `${collReceiver} 的 push 实参括号配不平 ⇒ 单元取不出` }
    const branchScoped = got.parts.some((p) => p.from !== 'decl' && p.at >= 0 && branchScopedFrom(lines, lineAt(struct, p.at)))
    const sp = spreadCollections(face, struct, got.parts.map((p) => p.text).join(' , '))
    if (sp.undetermined) return { undetermined: 'collection-unbalanced', why: sp.undetermined }
    return { kind: `collection(${collReceiver || '?'})`, columns: columnConditionsIn(sp.text, probeCol), branchScoped }
  }
  const frame = framesOf(struct, idx).find((f) => ['and', 'or', 'where'].includes(f.name))
  if (frame && frame.closeAt > 0) {
    const sp = spreadCollections(face, struct, face.slice(frame.argStart, frame.argEnd))
    if (sp.undetermined) return { undetermined: 'collection-unbalanced', why: sp.undetermined }
    return { kind: `${frame.name}(...${sp.names.length ? '+' + sp.names.join(',') : ''})`, columns: columnConditionsIn(sp.text, probeCol), branchScoped: false }
  }
  const arr = enclosingArrayUnit(face, struct, idx, probeCol)
  if (arr) return arr
  if (span) return { kind: span.tag ? 'sql 模板整条' : 'SQL 字面量整条', columns: columnConditionsIn(src.slice(span.bodyStart, span.bodyEnd), probeCol), branchScoped: false }
  return { undetermined: 'unit-boundary', why: '谓词单元边界取不出(既非集合成员、也不在内联 and/or/where、也不是数组成员、也无字符串承载)' }
}

function pythonSite(shape, m, face, lines, line) {
  const snippet = (lines[line - 1] || '').trim().slice(0, 150)
  const narr = /^\s*(?:#|"|')/.test(snippet) && !/\bexecute\b|\bfetch\b|\bprepare\b|\+=|\.append\(/i.test(snippet) ? '疑似注释/文档叙述(启发式旁注,不改变状态)' : ''
  const col = shape.name.includes('json_extract') ? m[1] || '' : leftColumnOf(face, m.index)
  const why = 'Python 面的注释与三引号 docstring 遮噪档不在唯一遮罩实现里(SCRIPT_COMMENT_DIALECTS 现读无 py 档)⇒ 整族只点名不判档'
  return { state: 'undetermined', kind: 'python-face', shape: shape.name, line, column: col, key: typeof m[2] === 'string' ? m[2] : '', text: snippet, narrativeHint: narr, why }
}

/** 一个文件的全部判定(纯函数:自检与镜像可直接喂构造面)。 */
export function judgeSource(rel, src) {
  const out = { rel, sites: [], auxO1: [], auxO2: [], auxUndetermined: [], skipped: null }
  if (typeof src !== 'string') return (out.sites.push({ state: 'undetermined', line: 0, kind: 'no-content', why: '该面取不到此文件内容' }), out)
  if (src.length > MAX_FILE_CHARS) {
    out.skipped = `超大文件(${src.length} 字符 > ${MAX_FILE_CHARS})`
    out.sites.push({ state: 'undetermined', line: 0, kind: 'too-large', why: `${out.skipped} ⇒ 整文件未判定` })
    return out
  }
  const isPy = PY_EXT.test(rel)
  const lines = src.split(/\r?\n/)
  // Python:遮噪档不在唯一实现里 ⇒ 用原文逐行点名,状态恒为未判定
  const face = isPy ? src : judgeFace(src)
  const struct = isPy ? src : structFace(src)
  const spans = isPy ? [] : scanSpans(src)

  for (const shape of PROBE_SHAPES) {
    const flags = shape.re.flags.includes('g') ? shape.re.flags : `${shape.re.flags}g`
    const re = new RegExp(shape.re.source, flags)
    let m
    while ((m = re.exec(face)) !== null) {
      const idx = m.index
      const line = lineAt(face, idx)
      if (isPy) {
        out.sites.push(pythonSite(shape, m, face, lines, line))
        continue
      }
      if (spans.some((s) => s.kind === 'regex' && idx >= s.start && idx < s.end)) {
        out.sites.push({ state: 'not-applicable', kind: 'regex-literal', line, shape: shape.name, text: m[0].slice(0, 90), why: '命中在正则字面量体内(图形/语法字符),不是 SQL' })
        continue
      }
      const span = stringSpanAt(spans, idx)
      const tag = span ? tagOfSpan(src, span) : ''
      const carrierKind = span ? (src[span.start] === '`' ? (tag ? 'tagged-template' : 'untagged-template') : 'plain-string') : ''
      const frames = framesOf(struct, idx)
      const collFrame = frames.find((f) => COLLECTION_HOSTS.has(f.name))
      const collReceiver = collFrame ? collFrame.receiver || collFrame.name : ''
      const collDecl = collFrame ? findCollectionDecl(face, collReceiver) : null
      const cls = classifyProbeSite({ carrier: span ? src.slice(span.bodyStart, span.bodyEnd) : '', carrierKind, tag, hostNames: frames.map((f) => f.name).filter(Boolean), posInCarrier: span ? idx - span.bodyStart : 0, collHost: collReceiver, collectionDecl: collDecl })
      const rec = { state: cls.state, kind: cls.kind, why: cls.why || '', shape: shape.name, column: shape.col(m, face, idx) || '', key: shape.key(m) || '', line, carrier: span ? (tag ? `tagged ${tag}` : carrierKind) : 'code', text: (lines[line - 1] || '').trim().slice(0, 150) }
      if (cls.state === 'need-unit') {
        const unit = buildUnit({ face, struct, src, idx, span: span ? { ...span, tag } : null, unitKind: cls.unitKind, collReceiver, collDecl, lines })
        if (unit.undetermined) {
          rec.state = 'undetermined'
          rec.kind = unit.undetermined
          rec.why = unit.why
        } else {
          const conds = unit.columns
          rec.state = conds.length ? 'pass' : 'hit'
          rec.kind = conds.length ? (conds.some((c) => c.kind === 'equality') ? 'equality' : 'presence') : 'no-independent-column'
          rec.unitKind = unit.kind
          rec.conditions = conds.slice(0, 6)
          rec.branchScoped = !!unit.branchScoped
          rec.why = conds.length ? `同谓词单元(${unit.kind})里有 ${conds.length} 个独立列条件 ⇒ 放过;那一列是否确为该类别的判别列归人读` : `谓词单元(${unit.kind})里除 JSON 取用外没有任何独立列条件 ⇒ 命中`
        }
      }
      out.sites.push(rec)
    }
  }

  if (!isPy) {
    const jp = /\bJSON\.parse\s*\(/g
    let jm
    while ((jm = jp.exec(face)) !== null) {
      const host = framesOf(struct, jm.index).find((f) => JS_FILTER_HOST.has(f.name))
      if (!host) continue
      const ln = lineAt(face, jm.index)
      const why = 'JS 层 JSON.parse 后再筛(不在 SQL 谓词里)⇒ 不计命中也不计放过;先 parse 赋值再筛的形态本尺子读不出'
      out.sites.push({ state: 'not-applicable', kind: 'js-parse-then-filter', line: ln, shape: `.${host.name}() 回调内`, text: (lines[ln - 1] || '').trim().slice(0, 130), why })
    }
  }

  measureAux(out, { rel, src, lines, isPy })
  return out
}

/** O1 展示顺序寄托在 id 上;O2 读面只留成功态。识别不到的形态落 auxUndetermined 点名。 */
export function measureAux(out, arg) {
  const { rel, src, lines, isPy } = arg
  const carriers = []
  if (isPy) {
    for (const s of extractSqlLiterals(src)) carriers.push({ text: s.sql, at: s.offset, kind: 'Python 语句(188 的抠取)' })
    lines.forEach((l, i) => {
      if (/\bORDER\s+BY\b/i.test(l) && !/^\s*#/.test(l)) carriers.push({ text: l, at: -1, kind: 'Python 行片段', line: i + 1 })
    })
    out.auxUndetermined.push({ rel, why: 'Python 面的语句边界与消费面读不出 ⇒ O1/O2 在该面只有行级候选,不是判据' })
  } else {
    const face = judgeFace(src)
    for (const s of scanSpans(src)) {
      const body = s.kind === 'string' ? src.slice(s.bodyStart, s.bodyEnd) : ''
      if (!/\bSELECT\b|\bORDER\s+BY\b|\bWHERE\b/i.test(body)) continue
      carriers.push({ text: body, at: s.bodyStart, kind: src[s.start] === '`' ? `${tagOfSpan(src, s) || 'untagged'} 模板` : '字符串承载' })
    }
    let m
    const dO = /\.orderBy\(\s*(?:desc\(\s*|asc\(\s*)?([\w$]+(?:\.[\w$]+)*)\s*\)/g
    while ((m = dO.exec(face)) !== null) {
      if (lastSegment(m[1]) !== 'id') continue
      const ln = lineAt(face, m.index)
      const win = windowOf(face, m.index)
      const has = DISPLAY_ORDER_RE.test(win.text)
      const text = (lines[ln - 1] || '').trim().slice(0, 140)
      const d = has ? '窗口内有展示序字段' : '窗口内无展示序字段'
      out.auxO1.push({ rel, line: ln, kind: 'Drizzle .orderBy(<x>.id)', column: m[1], window: win.size, candidate: !has, displayOrder: d, text })
    }
    const dS = new RegExp(DRIZZLE_SUCCESS_RE.source, 'g')
    while ((m = dS.exec(face)) !== null) {
      const ln = lineAt(face, m.index)
      const text = (lines[ln - 1] || '').trim().slice(0, 140)
      out.auxO2.push({ rel, line: ln, kind: `Drizzle ${m[0].split('(')[0].trim()}(${m[1]},'${m[2]}')`, text, note: NOTE_O2 })
    }
  }
  for (const f of carriers) {
    const line = f.line ?? (f.at >= 0 ? lineAt(src, f.at) : 0)
    const text = (lines[line - 1] || '').trim().slice(0, 140)
    const ob = ORDER_BY_RE.exec(f.text)
    const items = ob ? String(ob[1] || '').split(/\b(?:LIMIT|OFFSET|FETCH|HAVING)\b/i)[0].split(',').map((x) => x.trim().replace(/;$/, '')).filter(Boolean) : []
    const has = DISPLAY_ORDER_RE.test(f.text)
    const d = has ? '窗口内有展示序字段' : '窗口内无展示序字段'
    if (ob && (!items.length || String(ob[1]).includes('${'))) out.auxO1.push({ rel, line, kind: `${f.kind}:ORDER BY 清单读不出`, window: f.text.length, candidate: false, displayOrder: '未判定(清单取不出)', text })
    else if (ob && items.every((x) => ORDER_BY_ID_ITEM.test(x))) out.auxO1.push({ rel, line, kind: `${f.kind}:ORDER BY 仅 id`, window: f.text.length, candidate: !has, displayOrder: d, text })
    if (SUCCESS_LITERAL_RE.test(f.text) && /\bSELECT\b/i.test(f.text)) {
      const agg = /\bFILTER\s*\(\s*WHERE\b/i.test(f.text)
      out.auxO2.push({ rel, line, kind: agg ? `${f.kind}:聚合内 FILTER(WHERE)(不筛行 ⇒ 只报名)` : `${f.kind}:读面谓词只留成功态`, text, note: NOTE_O2 })
    }
  }
}

/** 取"最近一层花括号块"当窗口(过宽 ⇒ 少报候选,方向保守)。 */
function windowOf(text, idx) {
  let depth = 0
  for (let i = idx - 1; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      if (depth === 0) return braceBlock(text, i)
      depth--
    }
  }
  return { text, size: text.length }
}

function braceBlock(text, start) {
  let d = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') d++
    else if (text[i] === '}' && --d <= 0) return { text: text.slice(start, i + 1), size: i + 1 - start }
  }
  return { text: text.slice(start), size: text.length - start }
}

export function tally(judged) {
  const sites = judged.flatMap((j) => (j.sites || []).map((x) => ({ rel: j.rel, ...x })))
  const n = (s) => sites.filter((x) => x.state === s).length
  const o1 = judged.flatMap((j) => j.auxO1)
  const o2 = judged.flatMap((j) => j.auxO2)
  return { listed: judged.length, filesWithSites: judged.filter((j) => (j.sites || []).length > 0).length, hit: n('hit'), pass: n('pass'), undetermined: n('undetermined'), notApplicable: n('not-applicable'), todo: n('need-unit'), candidatesO1: o1.filter((x) => x.candidate === true).length, candidatesO2: o2.filter((x) => !String(x.kind).includes('聚合内')).length, reportedO1: o1.length, reportedO2: o2.length, auxUndetermined: judged.flatMap((j) => j.auxUndetermined).length, sites }
}

/** 空枚举/失明判定(纯函数):两种都只能读成"尺子没在工作",不能记绿。 */
export function enumerationVerdict(arg) {
  const { listed, withProbe } = arg
  if (!Number.isFinite(listed) || listed === 0) return 'dead:射程内枚举到 0 个文件'
  if (!Number.isFinite(withProbe) || withProbe === 0) return `dead:枚举到 ${listed} 个文件却一处探测形态都没判出 ⇒ 探测形态表或射程漂了`
  return null
}

export function exitCodeOf(arg) {
  const { t, dead, strict, coverageGaps } = arg
  if (dead) return 2
  if (t.todo > 0) return 2 // 分类没走完 ⇒ 拒绝出合格证("把没判写成判过了"是本仓最高频失效型)
  if (strict && (t.undetermined > 0 || coverageGaps > 0)) return 2
  return 0
}

const STATE_LABEL = { hit: '命中', pass: '放过', undetermined: '未判定', 'not-applicable': '不适用', todo: '内部漏档' }, STATE_ORDER = ['hit', 'pass', 'undetermined', 'not-applicable', 'todo']

export function summaryLine(a) {
  const t = a.tally
  const k = (kind) => t.sites.filter((s) => s.kind === kind).length
  const parts = [
    '判定面=' + a.face, `命中 ${t.hit}`, `放过 ${t.pass}(equality ${k('equality')} · presence ${k('presence')} · inherited ${k('inherited')})`,
    `未判定 ${t.undetermined}`, `不适用 ${t.notApplicable}`, `内部漏档 ${t.todo}`,
    `O1 候选 ${t.candidatesO1}(报名 ${t.reportedO1})`, `O2 候选 ${t.candidatesO2}(报名 ${t.reportedO2})`,
    `覆盖面未闭合 ${a.coverageGaps.length}`, `射程枚举 ${a.listed.length}`,
  ]
  return `[redundant-discriminator] ${parts.join(' / ')}`
}

/** 枚举:HEAD 档 `ls-tree -r … HEAD`(不是 ls-files!),索引档 `ls-files -c` —— 清单与内容同面。 */
export function listInScope(root, face) {
  const args = face === 'staged' ? ['ls-files', '-c', '--', ...SCOPE_DIRS] : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCOPE_DIRS]
  return String(gitRaw(args, root, { timeout: GIT_TIMEOUT }))
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(inScope)
}

/** 覆盖面自证的枚举:全仓含探测形态的跟踪文件(`-I` 跳二进制)。git grep 无命中退 1 是常态。 */
export function listProbeBearing(root, face) {
  const rev = face === 'staged' ? '--cached' : 'HEAD'
  let out
  try {
    out = gitRaw(['grep', '-l', '-I', '-E', '-e', 'json_extract|->>|@> ', rev], root, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (e && e.status === 1) return []
    throw new Undetermined(`覆盖面枚举失败:${String((e && (e.stderr || e.message)) || '').slice(0, 200)}`)
  }
  return String(out).split(/\r?\n/).map((p) => p.trim().replace(/^HEAD:/, '')).filter(Boolean)
}

export function readFace(root, face, files) {
  if (face === 'worktree') return files.map((rel) => ({ rel, src: readWorktreeFile(root, rel) }))
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(root, files.map((p) => `${pre}${p}`), { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  return files.map((rel) => ({ rel, src: got.get(`${pre}${rel}`) ?? null }))
}

export function analyze(arg = {}) {
  const { face = 'head', root = ROOT, files = null } = arg
  const top = assertRepoRoot(root, 'redundant-discriminator 的判定根')
  const listed = files ? files.filter(inScope) : listInScope(top, face)
  const judged = readFace(top, face, listed).map((r) => judgeSource(r.rel, r.src))
  const t = tally(judged)
  const coverageGaps = listProbeBearing(top, face).filter(coverageGapOf)
  const withProbe = t.hit + t.pass + t.undetermined + t.notApplicable + t.todo
  return { face, root: top, listed, judged, tally: t, coverageGaps, dead: enumerationVerdict({ listed: listed.length, withProbe }) }
}

function clip(list, fn) {
  const head = list.slice(0, LIST_CAP).map(fn)
  if (list.length > LIST_CAP) head.push(`      …另有 ${list.length - LIST_CAP} 条(--json 拿全量)`)
  return head
}

function siteLine(s) {
  const tag = `[${s.shape || s.kind}${s.column ? ` 列=${s.column}` : ''}${s.key ? ` 键=${s.key}` : ''}]`
  const conds = s.conditions?.length ? `独立列=[${s.conditions.map((c) => `${c.column}:${c.kind}`).join(', ')}]` : ''
  const branch = s.branchScoped ? '⚠ 证据含 if 分支内的条件(分支性需人裁)' : ''
  return `      ${s.rel}:${s.line}  ${tag} ${conds} ${branch} ${s.why}`.replace(/\s{2,}(?=\S)/g, ' ')
}

function auxLine(s) {
  const win = s.displayOrder ? `${s.displayOrder}(窗口 ${s.window ?? '-'} B)` : ''
  return `      ${s.rel}:${s.line}  [${s.kind}] ${win} —— ${s.text}`
}

export function printReport(a, arg) {
  const strict = !!arg.strict
  const label = a.face === 'worktree' ? '工作树(仅人工,不得作为提交门禁)' : a.face
  console.log(`${C.cyan}[redundant-discriminator] 判定面=${label} 根=${a.root}${C.reset}`)
  for (const state of STATE_ORDER) {
    const list = a.tally.sites.filter((s) => s.state === state)
    if (!list.length) { console.log(`  ${C.yellow}─ ${STATE_LABEL[state]}:0 条 —— 本尺子识别面的读数,不是"这一族不存在"${C.reset}`); continue }
    console.log(`${state === 'hit' ? C.red : C.cyan}─ ${STATE_LABEL[state]}(${list.length})${C.reset}`)
    for (const l of clip(list, siteLine)) console.log(l)
  }
  const o1 = a.judged.flatMap((j) => j.auxO1)
  const o2 = a.judged.flatMap((j) => j.auxO2)
  for (const [title, list, cand] of [['O1 展示顺序寄托在 id', o1, a.tally.candidatesO1], ['O2 失败条目可能被读面筛掉', o2, a.tally.candidatesO2]]) {
    console.log(`  ${C.yellow}─ ${title}(只报数,不参与退出码):候选 ${cand} / 报名 ${list.length}${C.reset}`)
    for (const l of clip(list, auxLine)) console.log(l)
  }
  for (const u of a.judged.flatMap((j) => j.auxUndetermined).slice(0, 12)) console.log(`  ${C.yellow}─ 两维的未判定:${u.rel} —— ${u.why}${C.reset}`)
  if (a.coverageGaps.length) console.log(`${C.red}  ❌ 覆盖面未闭合:${a.coverageGaps.length} 个 —— ${a.coverageGaps.slice(0, LIST_CAP).join(', ')}${C.reset}`)
  if (a.dead) console.log(`${C.red}  ❌ ${a.dead} ⇒ 判死,不记绿${C.reset}`)
  const rc = exitCodeOf({ t: a.tally, dead: a.dead, strict, coverageGaps: a.coverageGaps.length })
  const why = a.dead ? '判死' : a.tally.todo ? '内部漏档' : strict ? '--strict 的未判定或覆盖面未闭合' : '未知'
  const line = summaryLine(a) + (rc === 0 ? '(本尺子不判红)' : `(rc=${rc} 来自${why})`)
  console.log(rc === 0 ? `${C.green}${line}${C.reset}` : `${C.red}${line}${C.reset}`)
  return rc
}

const JSON_NOTE = '本尺子不判红:命中条数不参与退出码;rc=2 只来自判死/内部漏档/--strict 的未判定或覆盖面未闭合。不适用 = 同一条 JSON 取用在取值/展示位或非 SQL 面。候选 0 不得读成"确信没有"。'

export function jsonReport(a, arg) {
  const strict = !!arg.strict
  const rc = exitCodeOf({ t: a.tally, dead: a.dead, strict, coverageGaps: a.coverageGaps.length })
  const counts = { ...a.tally }
  delete counts.sites
  const body = {
    face: a.face, root: a.root, listedCount: a.listed.length, counts, sites: a.tally.sites,
    auxO1: a.judged.flatMap((j) => j.auxO1), auxO2: a.judged.flatMap((j) => j.auxO2), auxUndetermined: a.judged.flatMap((j) => j.auxUndetermined),
    coverageGaps: a.coverageGaps, dead: a.dead, scope: SCOPE_DIRS, outOfScope: OUT_OF_SCOPE, rc, note: JSON_NOTE, summary: summaryLine(a),
  }
  return JSON.stringify(body, null, 2)
}

export const FX = {
  only: `const x = db.select().from(t).where(and(sql\`\${t.metadata}->>'byokMode' = 'true'\`))`,
  type: `const x = db.select().from(t).where(and(eq(t.type, 'report'), sql\`\${t.metadata}->>'byokMode' = 'true'\`))`,
  nn: `const x = db.select().from(t).where(and(isNotNull(t.apiKeyId), sql\`\${t.metadata}->>'byokMode' = 'true'\`))`,
  same: `function c(){ return sql\`jsonb_typeof(metadata) = 'object'\n    AND COALESCE(metadata->>'rawRetained', 'true') <> 'false'\` }`,
  range: `db.select().from(t).where(and(gte(t.createdAt, d), sql\`\${t.data}->>'k' = 'v'\`))`,
  proj: `db.select({ a: sql\`coalesce(sum((\${t.metadata}->>'costCents')::numeric),0)\` })`,
  agg: `db.select({ n: sql\`count(*) filter (where \${t.metadata}->>'k' = 'true')::int\` })`,
  decl: `const conds = [eq(t.type, 'report')]\nconds.push(sql\`\${t.metadata}->>'k' = 'v'\`)`,
  nodecl: `x.push(sql\`\${t.metadata}->>'k' = 'v'\`)`,
  case: `const q = \`SELECT CASE WHEN other->>'x' = 'true' THEN 1 END FROM t\``,
  comment: `// 查询用 details->>'apiKeyId' 回答哪个 key\nconst y = 1`,
  regex: `const re = /<-->>|->>'k'|-->/g`,
  rawHit: `conn.execute("SELECT id FROM threads WHERE json_extract(metadata, '$.conversationId') = ?")`,
  rawPass: `conn.execute("SELECT id FROM m WHERE namespace = $1 AND metadata->>'sessionId' = $2")`,
  noExec: `const doc = "WHERE other->>'x' = 'true'"`,
  contains: `db.select().from(t).where(and(eq(t.userId, u), sql\`\${t.events} @> '["x"]'::jsonb\`))`,
  py: `x = "SELECT 1 FROM t WHERE json_extract(metadata, '$.k') = ?"`,
  key: `conn.execute("SELECT 1 FROM t WHERE json_extract(metadata, '$.userId') = ?")`,
  o1Hit: `conn.execute("SELECT id FROM t ORDER BY id DESC LIMIT 1")`,
  o1Pass: `conn.execute("SELECT id, ordinal FROM t ORDER BY id DESC")`,
  o2Sql: `conn.execute("SELECT id FROM publishes WHERE status = 'success'")`,
  o2Driz: `db.select().from(t).where(and(eq(t.status,'success'), eq(t.userId, u)))`,
  branch: `const conds = [eq(t.a, 1)]\nif (mode) {\n  conds.push(isNotNull(t.apiKeyId))\n}\nconds.push(sql\`\${t.metadata2->>'k' = 'v'\`})`,
  multi: `const a = 1\nconst b = sql\`\n  \${t.payload}->>'orderNo' = 'x'\`\n`,
}

export function selfTest() {
  const cases = []
  // 求值后再记账:存函数会让断言从未求值而账面记绿(本仓 §自检 harness 那条禁令)
  const t = (name, cond) => cases.push({ name, ok: (() => !!cond)() })
  const J = (src, rel = 'a.ts') => judgeSource(rel, src)
  const st = (src, rel) => J(src, rel).sites.map((s) => s.state)
  const ks = (src, rel) => J(src, rel).sites.map((s) => `${s.state}:${s.kind}`)
  const zero = { hit: 0, pass: 0, undetermined: 0, notApplicable: 0, todo: 0 }
  const mk = (o) => ({ ...zero, ...o })
  const rc = (x, o) => exitCodeOf({ t: x, dead: null, coverageGaps: 0, ...o })

  t('S01 只 JSON 过滤 ⇒ 命中', st(FX.only).includes('hit'))
  t('S02 同谓词带判别列 ⇒ 放过(正确写法必须认得出)', st(FX.type).includes('pass') && !st(FX.type).includes('hit'))
  t('S03 只有 IS NOT NULL ⇒ 放过但子档 presence', ks(FX.nn).includes('pass:presence'))
  t('S04 同列的 jsonb_typeof 不算独立列 ⇒ 命中', st(FX.same).includes('hit'))
  t('S05 范围比较 gte 不算独立列 ⇒ 命中', st(FX.range).includes('hit'))
  t('S06 投影/聚合 ⇒ 不适用', st(FX.proj).includes('not-applicable'))
  t('S07 聚合内 FILTER(WHERE) ⇒ 放过(继承)', ks(FX.agg).includes('pass:inherited'))
  t('S08 CASE WHEN 分档取数 ⇒ 不适用', st(FX.case).includes('not-applicable'))
  t('S09 集合成员:声明带判别列 ⇒ 放过', st(FX.decl).includes('pass'))
  t('S10 集合声明取不到 ⇒ 未判定(不得冒充命中)', st(FX.nodecl).includes('undetermined'))
  t('S11 注释里的 SQL 叙述不被判成命中', !st(FX.comment).includes('hit'))
  t('S12 正则字面量体内的 ->> 图形 ⇒ 不适用', ks(FX.regex).includes('not-applicable:regex-literal'))
  t('S13 被执行面裸 SQL 无独立列 ⇒ 命中', st(FX.rawHit).includes('hit'))
  t('S14 被执行面裸 SQL 带独立列 ⇒ 放过', st(FX.rawPass).includes('pass'))
  t('S15 说明性字符串找不到执行入口 ⇒ 未判定', st(FX.noExec).includes('undetermined'))
  t('S16 @> 数组包含被探测到且列名取得出', J(FX.contains).sites.some((x) => x.shape === 'jsonb 包含 @>' && x.column === 't.events'))
  t('S17 Python 面整族未判定(不硬判)', (() => { const s = J(FX.py, 'a.py').sites; return s.length > 0 && s.every((y) => y.state === 'undetermined') })())
  t('S18 O1:ORDER BY 仅 id 且窗口无展示序字段 ⇒ 候选', J(FX.o1Hit).auxO1.some((x) => x.candidate === true))
  t('S19 O1:同段有 ordinal ⇒ 必须报名但不得算候选', (() => { const a = J(FX.o1Pass); return a.auxO1.length > 0 && a.auxO1.every((x) => x.candidate === false) })())
  t('S20 O2:读面只留成功态 ⇒ 候选', J(FX.o2Sql).auxO2.length > 0)
  t('S21 O2 的 Drizzle 形态被认出来', J(FX.o2Driz).auxO2.some((x) => /Drizzle/.test(x.kind)))
  t('S22 两维永不参与退出码(只报数)', rc(tally([J(FX.o2Sql)]), { strict: false }) === 0)
  t('S23 命中再多也不判红', rc(mk({ hit: 9 }), { strict: false }) === 0)
  t('S24 --strict 下有未判定 ⇒ rc 2(拒绝出合格证)', rc(mk({ undetermined: 7 }), { strict: true }) === 2)
  t('S25 默认档有未判定仍 rc 0(尺子不判红)', rc(mk({ undetermined: 7 }), { strict: false }) === 0)
  t('S26 覆盖面未闭合只在 --strict 拒绝出合格证', rc(zero, { strict: true, coverageGaps: 2 }) === 2 && rc(zero, { strict: false, coverageGaps: 2 }) === 0)
  t('S27 内部漏档 ⇒ rc 2(分类没走完不出合格证)', rc(mk({ todo: 1 }), { strict: false }) === 2)
  t('S28 判死:枚举 0 / 枚举 N 但零站点;有站点 ⇒ 不判死', !!enumerationVerdict({ listed: 0, withProbe: 0 }) && !!enumerationVerdict({ listed: 9, withProbe: 0 }) && !enumerationVerdict({ listed: 9, withProbe: 3 }))
  t('S29 射程(scripts 只取顶层、排除测试面与非源码)', inScope('apps/api/src/routes/a.ts') && !inScope('apps/api/src/routes/__tests__/a.test.ts') && inScope('apps/ai-service/app/services/a.py') && !inScope('apps/api/src/db/a.sql') && inScope('scripts/verify-byok-e2e.mjs') && !inScope('scripts/lib/face-reader.mjs') && !inScope('scripts/tests/x.mjs'))
  t('S30 排除清单闭合:已实测的面不算缺口,新面算缺口', !coverageGapOf('packages/database/src/schema/a.ts') && !coverageGapOf('apps/web/src/a.ts') && coverageGapOf('apps/some-new-app/src/a.ts'))
  t('S31 等长遮罩:注释被抹而字符串留下、行号不漂', (() => { const s = `// ->> 注释\nconst q = "WHERE a->>'b' = 1"`; const f = judgeFace(s); return f.length === s.length && !f.split('\n')[0].includes('->>') && f.split('\n')[1].includes('->>') })())
  t('S32 结构面不被模板体内的括号污染', (() => { const s = `db.where(and(sql\`count(*)\`))`; return framesOf(structFace(s), s.length - 3).some((f) => f.name === 'and') })())
  t('S33 json_extract 的键被读出来', J(FX.key).sites.some((x) => x.key === 'userId'))
  t('S34 未取到内容 ⇒ 未判定而不是零站点', J(null).sites.some((x) => x.state === 'undetermined'))
  t('S35 超大文件整文件未判定而不静默', !!J('z'.repeat(MAX_FILE_CHARS + 10)).skipped)
  t('S36 leftColumnOf 认 ${tbl.col} 插值形态', leftColumnOf(`sql\`\${llmCallLogs.metadata}->>'byokMode'\``, 26) === 'llmCallLogs.metadata')
  t('S37 columnConditionsIn 不把箭头函数当独立列(假阳陷阱)', columnConditionsIn('rows.map((r) => r.id)', ['metadata']).length === 0)
  t('S38 if 分支内的集合证据被旁注(不裁结论)', J(FX.branch).sites.some((x) => x.state === 'pass' && x.branchScoped))
  t('S39 跨行模板内的命中行号与原文一致', (() => { const x = J(FX.multi).sites.find((y) => y.state === 'hit'); return !!x && x.line === 3 })())
  t('S40 tally 不并桶:四态之和 == 站点数', (() => { const tt = tally([J(`${FX.only}\n${FX.type}\n${FX.nodecl}`)]); return tt.hit + tt.pass + tt.undetermined + tt.notApplicable === tt.sites.length })())
  t('S41 测试面(test_*.py / __tests__ / *.test.ts)不算覆盖面缺口', testFaceOf('apps/ai-service/tests/test_x.py') && testFaceOf('a/__tests__/x.test.ts') && !coverageGapOf('apps/ai-service/tests/test_x.py') && coverageGapOf('apps/other/src/x.ts'))
  t('S42 覆盖面枚举的 rev 前缀被抹净(否则整面被误读成缺口)', (() => { const l = listProbeBearing(ROOT, 'head'); return l.length > 0 && l.every((x) => !x.startsWith('HEAD:') && !x.includes(':')) })())

  return { total: cases.length, pass: cases.filter((c) => c.ok).length, fail: cases.filter((c) => !c.ok).length, failed: cases.filter((c) => !c.ok) }
}

const argValue = (argv, flag) => { const i = argv.indexOf(flag); return i < 0 ? null : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined }

const die = (msg) => (console.error(`${C.red}❌ ${msg}${C.reset}`), 2)

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) {
    const r = selfTest()
    for (const c of r.failed) console.log(`${C.red}❌ 自检 ${c.name}${C.reset}`)
    console.log(`\n[redundant-discriminator] 自检 例数 ${r.total} 通过 ${r.pass} 失败 ${r.fail}`)
    return r.fail > 0 ? 1 : 0
  }
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) return die(sel.error)
  const rootArg = argValue(argv, '--root')
  if (argv.includes('--root') && rootArg === undefined) return die('--root 需要一个目录实参')
  let a
  try {
    a = analyze({ face: sel.face, root: rootArg ? resolve(String(rootArg)) : ROOT })
  } catch (e) {
    return die(`无法判定(不冒红也不记绿,不回落另一个面):${e && e.message ? e.message : e}`)
  }
  const strict = argv.includes('--strict')
  if (argv.includes('--json')) {
    console.log(jsonReport(a, { strict }))
    return exitCodeOf({ t: a.tally, dead: a.dead, strict, coverageGaps: a.coverageGaps.length })
  }
  return printReport(a, { strict })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) main().then((rc) => process.exit(rc))

export const __test__ = {
  SCOPE_DIRS, OUT_OF_SCOPE, PROBE_SHAPES, MAX_FILE_CHARS, LIST_CAP, FX, STATE_LABEL,
  inScope, testFaceOf, coverageGapOf, judgeFace, structFace, blankRanges, lineAt, framesOf, scanBracket, leftColumnOf,
  columnConditionsIn, classifyProbeSite, buildUnit, judgeSource, measureAux, windowOf, tally,
  enumerationVerdict, exitCodeOf, analyze, listInScope, listProbeBearing, readFace, selfTest,
  summaryLine, printReport, jsonReport, main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
