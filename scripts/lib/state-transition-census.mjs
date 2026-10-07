// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * state-transition-census.mjs —— 票 G-998142 状态机守卫普查的**纯判据层**(唯一实现)。
 *
 * 为什么单独成库(不是"顺手抽个文件"):门体 `scripts/check-state-transition-guard.mjs` 原本 893 行,
 * 超守门 11e(`scripts/check-file-size.mjs`,--staged 对 `--diff-filter=A` 的新文件超 800 行即 exit 1)
 * 的上限 ⇒ 它**结构上无法入库**。这里搬的只有"无 IO、无 git、不打印"的判据函数;取材面(listFace /
 * readFace / analyze)、链扫描核心(judgeSource,它才是 code-mask 与门 134 那三份链扫描的**消费点**,
 * 挪走会让门 134 复用锁(镜像 T1)看守的那两条 import 从门体消失)、CLI 与自检一律留在门体。
 *
 * **一处实现**(§22c 红线):本文件与门体不得各留一份同名判据 —— 门体只 `import` 回来并原样
 * 重新导出,`__test__` 与镜像测试取到的仍是这一份。搬动前后判据逐字未改(三条基线读数 --self-test /
 * 全量普查 / 镜像 pass-fail 必须逐字同形,这就是本票唯一验收)。
 *
 * 遮噪:视图B(`maskCommentsKeepStrings`)与门 167 的 maskCommentsKeepTemplates 同属 `code-mask.mjs`
 * 那**一台**分词器的另一种投影 —— 本文件不得自带第二台状态机。等长是硬约束:链偏移在视图A 算、
 * SQL 正文在视图B 读(门体 judgeSource 负责那一路),偏移不对齐就会把别的行的内容当成 WHERE。
 *
 * 零副作用:本模块没有 CLI 入口。直跑只喊一行并 exit 2 —— 判据不会自己跑,普查必须经门体(取材面住在那里)。
 */

import { pathToFileURL } from 'node:url'

import { scanSpans } from './code-mask.mjs'

/**
 * 状态/认领列的**唯一词表**(判据三处都从它派生,不得在别处抄第二份档名):
 * 列名先做 camelCase→snake_case 归一,再按词边界匹配 —— 这样 `status` / `OrderStatus` /
 * `order_status` / `claimRunning` / `claim_running` / `lockedBy` / `leaseOwner` 同视,
 * 而 `station`(`sta`+`tion`,无词边界)、`stateKeyOfValue` 之类不会凭空进面。
 */
export const STATE_COL_STEMS = Object.freeze([
  'status',
  'state',
  'claim',
  'claims',
  'claimed',
  'lock',
  'locked',
  'locking',
  'lease',
  'leased',
])
export function snakeOf(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}
export function isStateColumn(name) {
  const s = snakeOf(name)
  if (!s) return false
  const words = s.split(/[^a-z0-9]+/).filter(Boolean)
  return words.some((w) => STATE_COL_STEMS.includes(w))
}
/** set/where 文本里的候选列名(键形态 `col:` 与简写 `col`,由 `[,{]` 定界,不吃冒号后的值位)。 */
const KEY_RE = /(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*(?::|,|\}|$)/g
export function stateColumnsInText(text) {
  const hits = []
  if (!text) return hits
  for (const m of text.matchAll(KEY_RE)) if (isStateColumn(m[1])) hits.push(m[1])
  return hits
}
/**
 * WHERE 里"状态/认领谓词在位"的判据(视图A 面上认列标识符 + 认裸 SQL 的列词)。
 * 刻意比 134 的 `statePreconditionRE` 宽:那一把问的是"**同一列**有没有 eq/in/ne 前置"(B4 的口径),
 * 本门问"WHERE 里有没有**任何**状态/认领列的谓词" —— 两个问题不同,不得互相顶结论(头注①)。
 */
const CAS_DRIZZLE_RE = new RegExp(
  `\\b(?:eq|ne|inArray|notInArray|gt|gte|lt|lte|between|isNull|isNotNull|not|sql)\\s*\\([^)]{0,160}?\\b([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?)\\b`,
  'g',
)
export function casColumnsInWhere(whereText) {
  if (!whereText) return []
  const found = []
  for (const m of whereText.matchAll(CAS_DRIZZLE_RE)) {
    const tail = m[1].includes('.') ? m[1].split('.').pop() : m[1]
    if (isStateColumn(tail)) found.push(m[1])
  }
  // 兜另一型:where(and(eq(id), isNull(t.deletedAt), sql`status <> 1`)) —— 谓词函数嵌套超过
  // 上面 [^)]{0,160} 的窗口时读不到,退而求其次:整段 where 里出现 <obj>.<状态列> 即算。
  if (found.length === 0) {
    for (const m of whereText.matchAll(/\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\b/g)) {
      if (isStateColumn(m[2])) found.push(m[0])
    }
  }
  return found
}
/** 裸 SQL 的 WHERE 段(锚定 WHERE 之后,不看 SET 段 —— SET 里写 status 是"改它",不是"守卫")。 */
export function rawSqlWhereSegment(sqlText) {
  const m = /\bWHERE\b/i.exec(sqlText || '')
  if (!m) return ''
  const rest = sqlText.slice(m.index + m[0].length)
  const stop = rest.search(/\b(?:RETURNING|ORDER BY|LIMIT|GROUP BY|ON CONFLICT)\b/i)
  return stop < 0 ? rest : rest.slice(0, stop)
}
const SQL_WORD_RE = /\b([A-Za-z_$][\w$]*)\b/g
export function stateWordsInSql(text) {
  const hits = []
  for (const m of (text || '').matchAll(SQL_WORD_RE)) if (isStateColumn(m[1])) hits.push(m[1])
  return hits
}
/**
 * 体内"读状态后**取值比较**"的证据(视图A:比较符两侧都是代码 token)。
 * ⚠️ 必须排除 `x.status !== undefined` / `== null` 这一型:那是"调用方有没有传这个字段"的
 *   **在场性检查**,不是"读到了库里的当前态"。不排除的话,CRUD 更新函数(`...(data.status !==
 *   undefined ? { status: data.status } : {})`)会整族涌进站点,把真信号淹在噪声里
 *   (守门 36 C1 那条"474 条比对噪声"的同型教训)。真值比较(`=== 'running'`)在视图A 上字符串被
 *   遮成空格 ⇒ 第三捕获组为空,不在排除集内,照算证据。
 */
const READ_CMP_RE =
  /\.\s*([A-Za-z_$][\w$]*)\s*(===|!==|==|!=|<=|>=|<|>|\bin\b|\binstanceof\b|\?\?|\|\||&&)\s*([A-Za-z_$][\w$]*)?/g
const PRESENCE_OPS = new Set(['===', '!==', '==', '!='])
const PRESENCE_RHS = new Set(['undefined', 'null'])
/** 一行的比较证据里所有"状态列被取值比较"的列名(已排除在场性检查)。 */
export function stateComparisons(text) {
  const hits = []
  for (const m of (text || '').matchAll(READ_CMP_RE)) {
    if (!isStateColumn(m[1])) continue
    if (PRESENCE_OPS.has(m[2]) && PRESENCE_RHS.has(m[3])) continue
    hits.push(m[1])
  }
  return hits
}

/**
 * 表名归一:JS 符号 `agentTasks` 与 SQL 里的 `agent_tasks` 是同一张表 —— 两侧都 snake 化后再比,
 * 否则"读用 drizzle、写用裸 SQL"(或反向)这种混形态会各自匹配不上自己的名字,
 * 而漏读一侧的表现不是"少几个数",是把真站点静默成"无读证据"(§4 同一条教训)。
 */
export function normalizeTableName(name) {
  const last = String(name || '')
    .split('.')
    .pop()
    .replace(/[^A-Za-z0-9_]/g, '')
  return snakeOf(last)
}
/**
 * 体内是否存在"读同一张表"的证据:drizzle 的 `.from(符号)` 与裸 SQL 的 `SELECT … FROM 表` 两型同视。
 * 只认**同一张表**(不再退化成"体内有任意 select")—— 否则一条无关的读查询就能给站点发读证据,
 * 而读证据正是票面判据的另一半,拿它当通行证就是把判据建立在了花括号几何上(134 同一课)。
 */
export function selectsSameTable(bodyA, bodyB, tableName) {
  const want = normalizeTableName(tableName)
  if (!want) return null
  for (const m of bodyA.matchAll(/\.from\s*\(\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\)/g)) {
    if (normalizeTableName(m[1]) === want) return { kind: 'select-same-table', table: m[1] }
  }
  for (const m of bodyB.matchAll(/\bSELECT\b[\s\S]{0,400}?\bFROM\s+["'`]?([A-Za-z_][\w$]*)/gi)) {
    if (normalizeTableName(m[1]) === want) return { kind: 'raw-select-same-table', table: m[1] }
  }
  return null
}

/**
 * 视图B:只遮注释(行注释也按空格等长替换),字符串与模板原文保留。
 * `scanSpans` 那**一台**分词器的另一种投影 —— 与门 167 的 maskCommentsKeepTemplates 同一条理由,
 * 本文件不得自带第二台状态机(§22c)。等长是硬约束:链偏移在视图A 算、SQL 正文在视图B 读。
 */
export function maskCommentsKeepStrings(src) {
  if (typeof src !== 'string') return ''
  const out = src.split('')
  for (const s of scanSpans(src)) {
    if (s.kind !== 'line' && s.kind !== 'block') continue
    for (let k = Math.max(0, s.start); k < s.end && k < out.length; k++) {
      if (out[k] !== '\n') out[k] = ' '
    }
  }
  return out.join('')
}

/** 行号(1 起)。两视图与原文等长 ⇒ 直通原文件行号。 */
export function lineOf(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/** 包含 idx 的**最小**函数体;解析不出 ⇒ null(调用方落 no-body 未判定,不猜)。 */
export function smallestBody(bodies, idx) {
  let best = null
  for (const b of bodies) {
    if (b.start <= idx && idx < b.end && (!best || b.end - b.start < best.end - best.start)) best = b
  }
  return best
}

/** `.update(<table>)` 的目标表名(定点读一次,不是第二遍链扫描)。 */
export function updateTarget(viewA, startIdx) {
  const m = /^\s*\.\s*update\s*\(\s*([A-Za-z_$][\w$]*)/.exec(viewA.slice(startIdx, startIdx + 120))
  return m ? m[1] : ''
}

/**
 * 汇总(纯函数,退出码三臂由它给 —— 镜像测试不必派生 git 就能证明"默认档恒不判红"不是恒真)。
 * 空枚举判死:候选 0 ⇒ exit 2(不得把"没扫到"写成"没问题")。
 */
export function finishAggregate({
  files,
  candidates,
  sites,
  passed = 0,
  notInShape = 0,
  undetermined = [],
  strict = false,
  maxSites = 0,
}) {
  const und = (undetermined || []).length
  const emptyCensus = candidates === 0
  let exit = 0
  if (emptyCensus) exit = 2
  else if (strict && und > 0) exit = 2
  else if (strict && sites > maxSites) exit = 1
  return {
    files,
    candidates,
    sites,
    passed,
    notInShape,
    undetermined: und,
    exit,
    emptyCensus,
  }
}

// §22d 双形态入口守卫:本模块是纯判据库,**不跑 main、零副作用** —— 被门体或镜像测试 import 时
// 只导出判据。这道守卫的作用是把"有人顺手 `node scripts/lib/state-transition-census.mjs`"当场拒掉:
// 直跑没有任何被审面可判 ⇒ 打印一行并 exit 2(不猜、不静默成功、不读盘、不派生 git)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.stderr.write('state-transition-census.mjs 是纯判据库(无 CLI 入口) —— 请跑 scripts/check-state-transition-guard.mjs\n')
  process.exit(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
