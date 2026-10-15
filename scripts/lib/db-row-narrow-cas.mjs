// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 「DB 行面上的窄 CAS 修复」写法模板(G-93,2026-10-15 立)—— 判据与运行时**各只有一份**。
 *
 * 为什么要有这一份(票面原文的精神,不是新能力):
 *   上游 `persisted-remote-session-path-repair.ts:23-36` 的判定只有 `clean | repair |
 *   unrelated | unsafe` **四态**,且"含 identity 而前缀不匹配 ⇒ unsafe 直接抛错";`:101-109`
 *   写输入带 `expectedDirectory/expectedPath` 两个旧值;`:134-151` CAS 未命中说明**已被并发写入**,
 *   必须基于新事实重新裁决,**不能返回旧快照**。我方同一族判据此前只住在 **git 层**
 *   (`scripts/heal-worktree-tracked.mjs` 三条判据、`refreshStaleIndex()` 三条判据,AGENTS §5b),
 *   **DB 行面**没有"带旧值 expected 的窄修复"出口 ⇒ 修复现场只能"顺手修一下"。
 *   本文件就是那个出口:下一条 DB 归属型修复票**直接 import 它**,不要再各写一份四态。
 *
 * 三条不可削的规矩(削任一条,它就退化成"顺手修一下"):
 *   ① **四态封闭集** —— 判定结果只能是 `VERDICTS` 四者之一;没有"看情况"、没有第五态。
 *      `unrelated` / `unsafe` 两支**什么都不写**(这是它与顺手修的分界,镜像测试逐支钉死)。
 *   ② **拒猜** —— 没有旧值、identity 与前缀不匹配、污染形态不可证明、repair 映射给不出新值,
 *      一律落 `unsafe` 并由 `narrowCasRepair` **直接抛错**(不是"记个日志继续写")。
 *      `expected` 缺一个要改的字段也算拒猜:没有旧值的 UPDATE 不是 CAS,是盲写。
 *   ③ **未命中就重读再裁决** —— UPDATE 命中 0 行 = 这一行已被别人改写 ⇒ 用**新读到的值**
 *      刷新 expected 后重新裁决(有界),**绝不拿第一次读到的旧快照去写第二枪**,也绝不把
 *      旧快照返回给调用方(所以本模块的返回结构里根本**没有 row/snapshot 字段**)。
 *
 * 只被 `scripts/check-db-row-narrow-cas.mjs`(门体)与它的 §22c 镜像测试 import ⇒ 一份实现,
 * 零漂移(§22c)。门体的静态判据(`judgeTemplate`)与运行时判据(`adjudicateRow`)同住本文件:
 * 它们判的是同一件事的两面(写出来的代码有没有这三条 / 跑起来的代码有没有这三条),
 * 拆成两处必然漂(本仓对"两台机器一条规则"记过多次)。
 */
import { maskComments } from './code-mask.mjs'

/** 四态封闭集:判定结果只能是这四者之一,不得新增第五态。 */
export const VERDICTS = Object.freeze(['clean', 'repair', 'unrelated', 'unsafe'])

/** 静态判据的三要素(与票面三条规矩一一对应)。缺项只许减少,不许新增。 */
export const TEMPLATE_PARTS = Object.freeze(['expected', 'fourState', 'reread'])

/** 四态词汇:静态判据认的是**判定面**上的这 four 个 token(注释已遮,注释里自称不算)。 */
export const FOUR_STATE_TOKENS = Object.freeze(['clean', 'repair', 'unrelated', 'unsafe'])

/** `unsafe` 的携带者:拒猜是**抛错**,不是返回码 —— 调用方不得 catch 掉继续写。 */
export class NarrowCasUnsafe extends Error {
  constructor(reason, field) {
    super(`窄 CAS 拒猜(${reason}${field ? ` @${field}` : ''}):不写,请交人裁决`)
    this.name = 'NarrowCasUnsafe'
    this.reason = reason
    this.field = field ?? null
  }
}

/* ────────────────────────────── 运行时:四态判定 ────────────────────────────── */

/**
 * 从一行现值里取"被改字段的旧值" —— 重读之后刷新 expected 的唯一出口。
 * CAS 的 expected 必须是**当时读到的那一份事实**,重读了就必须换,否则第二枪仍是旧条件。
 */
export function expectedFromRow(row, fields) {
  const out = {}
  if (!row || typeof row !== 'object') return out
  for (const f of fields ?? []) if (f in row) out[f] = row[f]
  return out
}

/**
 * 四态判定(唯一实现)。判序**刻意**是"拒猜优先":先把所有"证明不了"的形态赶出去,
 * 剩下的才轮到"要不要写"。反过来写就会在 identity 不匹配时先落 repair —— 那是猜。
 *
 * @param {object} input
 * @param {object|null} input.row          现值事实(读出来的那一行)
 * @param {object} input.expected          CAS 旧值:`{ [field]: 读到的旧值 }`
 * @param {{key:string,value:*}} [input.owner] 归属列与归属值;`row[owner.key] !== value ⇒ unrelated`
 * @param {{present:boolean,matches:boolean}} [input.identity]
 *        identity 判据:**含 identity 而前缀不匹配 ⇒ unsafe**(票面原话,直接抛错那一支)
 * @param {string[]} input.prefixes        可证明的污染前缀清单;**清单外一律不修**(不猜)
 * @param {string[]} input.fields          候选被修字段
 * @param {(field:string,cur:string,row:object)=>string|null} input.repair
 *        污染值 → 目标值的机械映射;`null` = 修不了 ⇒ 落 unsafe,不猜
 * @param {(field:string,cur:string,row:object)=>boolean} [input.isClean] 目标态判定(命中即无需写)
 * @returns {{verdict:string,reason:string,writes:Array<{field:string,from:string,to:string,expected:*}>,field:string|null}}
 */
export function adjudicateRow(input = {}) {
  const {
    row,
    expected,
    owner,
    identity,
    prefixes = [],
    fields = [],
    repair,
    isClean,
  } = input
  const none = { writes: [], field: null }

  // ① 没有行 ⇒ 无从证明 ⇒ 不写(不猜"是不是还没建")
  if (!row || typeof row !== 'object') return { verdict: 'unrelated', reason: 'row-missing', ...none }
  // ② 没有旧值 ⇒ 那一枪不是 CAS,是盲写 ⇒ 拒猜
  if (!expected || typeof expected !== 'object' || Object.keys(expected).length === 0) {
    return { verdict: 'unsafe', reason: 'no-expected', ...none }
  }
  // ③ 含 identity 而前缀不匹配 ⇒ unsafe(票面:直接抛错那一支)
  if (identity && identity.present === true && identity.matches === false) {
    return { verdict: 'unsafe', reason: 'identity-prefix-mismatch', ...none }
  }
  // ④ 不是我这一个 owner 的行 ⇒ 与我无关 ⇒ 什么都不写
  if (owner && row[owner.key] !== owner.value) {
    return { verdict: 'unrelated', reason: 'not-owned', ...none }
  }

  const writes = []
  for (const field of fields) {
    const cur = row[field]
    // 已经是目标态 ⇒ 不写(幂等:修第二次也不该发 UPDATE)
    if (typeof isClean === 'function' && isClean(field, cur, row)) continue
    // 要改这一列 ⇒ 它必须有旧值,否则 CAS 无牙 ⇒ 拒猜
    if (!(field in expected)) return { verdict: 'unsafe', reason: 'no-expected-for-field', ...none, field }
    // 污染形态必须**可证明**(落在已知污染前缀里);清单外一律不修 ⇒ 拒猜
    if (typeof cur !== 'string' || !prefixes.some((p) => typeof p === 'string' && cur.startsWith(p))) {
      return { verdict: 'unsafe', reason: 'unprovable-pollution', ...none, field }
    }
    const to = typeof repair === 'function' ? repair(field, cur, row) : null
    if (typeof to !== 'string' || to === cur) {
      return { verdict: 'unsafe', reason: 'unprovable-pollution', ...none, field }
    }
    writes.push({ field, from: cur, to, expected: expected[field] })
  }
  if (writes.length === 0) return { verdict: 'clean', reason: 'already-clean', ...none }
  return { verdict: 'repair', reason: 'provable-pollution', ...none, field: null, writes }
}

/**
 * 把裁决翻成"窄"写:WHERE = 主键 ⊕ 归属列 ⊕ **每个被改字段的旧值**。
 * 只 set 被证明污染的那些列 —— 整行覆盖式 upsert 不属本模板(那会把并发写一起吃掉)。
 */
export function toNarrowWrite(adj, spec = {}) {
  const { idKey = 'id', id, owner } = spec
  const set = {}
  const where = {}
  if (id !== undefined && id !== null) where[idKey] = id
  if (owner && owner.key) where[owner.key] = owner.value
  for (const w of adj?.writes ?? []) {
    set[w.field] = w.to
    where[w.field] = w.expected
  }
  return { set, where }
}

/**
 * 窄 CAS 修复的执行模板(唯一实现)。
 *
 * 循环:读 → 裁决 →(repair)写 → 命中 0 行 ⇒ **重读刷新 expected** → 重新裁决 → 有界再来一枪。
 * 返回值**结构上不含任何行快照**(`row` / `snapshot` 字段根本不存在)—— 票面"不能返回旧快照"
 * 在这里不是纪律而是形状:想返回也返回不了。
 *
 * @param {object} input
 * @param {()=>Promise<object|null>} input.readRow    读一行(每次都取当刻事实)
 * @param {(write:{set:object,where:object})=>Promise<number|{changes:number}>} input.updateRow
 *        窄 UPDATE,返回**受影响行数**(0 = CAS 未命中)
 * @param {number} [input.maxRereads=1]               未命中后允许的**重读再裁决**次数(有界,不无限重试)
 * @returns {Promise<{verdict:string,reason:string,wrote:boolean,attempts:number,rereads:number,writes:Array}>}
 * @throws {NarrowCasUnsafe} 裁决为 `unsafe` ⇒ 抛错(拒猜),调用方不得吞掉继续写
 */
export async function narrowCasRepair(input = {}) {
  const { readRow, updateRow, maxRereads = 1, ...spec } = input
  if (typeof readRow !== 'function') throw new Error('narrowCasRepair 缺 readRow')
  if (typeof updateRow !== 'function') throw new Error('narrowCasRepair 缺 updateRow')

  let row = await readRow()
  let expected = { ...(spec.expected ?? {}) }
  let rereads = 0
  let attempts = 0

  for (;;) {
    const adj = adjudicateRow({ ...spec, row, expected })
    // 拒猜:unsafe 一律抛错,不写、不猜、不退化成"记日志继续"
    if (adj.verdict === 'unsafe') throw new NarrowCasUnsafe(adj.reason, adj.field)
    // clean / unrelated:什么都不写(票面分界线 —— 这两支写任何东西都算顺手修)
    if (adj.verdict !== 'repair') {
      return { verdict: adj.verdict, reason: adj.reason, wrote: false, attempts, rereads, writes: [] }
    }
    const write = toNarrowWrite(adj, spec)
    const matched = Number((await updateRow(write)) ?? 0)
    attempts += 1
    if (matched === 1) {
      return { verdict: 'repair', reason: 'narrow-cas-applied', wrote: true, attempts, rereads, writes: adj.writes }
    }
    // 未命中 = 这一行已被并发写入 ⇒ 必须基于**新事实**重新裁决,不许拿旧快照再来一枪
    if (rereads >= maxRereads) {
      return { verdict: adj.verdict, reason: 'cas-miss-exhausted', wrote: false, attempts, rereads, writes: [] }
    }
    row = await readRow()
    // 关键一步:expected 换成新读到的值。少了这行,第二枪的 WHERE 仍钉着旧事实 ——
    // 那就是票面点名的"返回旧快照"型,镜像测试按 where 取值把它钉死。
    expected = { ...expected, ...expectedFromRow(row, spec.fields ?? []) }
    rereads += 1
  }
}

/* ────────────────────────── 静态判据:这一族写有没有三条规矩 ────────────────────────── */

/**
 * 遮罩只引 `scripts/lib/code-mask.mjs` 那一份(§22c / 门 118)。
 * **只遮注释、保留字符串**:本判据要认的 `expectedDirectory`、四态 token 与 `throw`
 * 一半住在裸 SQL 模板字符串里(`and directory = ${input.expectedDirectory}`),
 * 连字符串一起遮就等于把门做瞎;而"只在注释里自称窄 CAS"必须不算(遮注释即为防此)。
 */
export function maskCode(text) {
  return maskComments(typeof text === 'string' ? text : '')
}

/** UPDATE 形态:裸 SQL、drizzle `.update(`、SQLAlchemy。 */
const UPDATE_FORM_RE = /\bupdate\s+[\w"`'.\]]+\s+set\b|\.update\s*\(|\bUPDATE\b[\s\S]{0,120}?\bSET\b/
/**
 * 维护性修复族:只有**这一族**的 DB 行写才进本门射程(其余 DB 写不属本票)。
 * 词形**只认 repair/heal/backfill/reconcile 及其屈折**(`heal` 后面接 `th` 的 `health`
 * 不属修复族 —— 放宽成前缀会把所有 health-check 文件拉进射程,那是噪声不是判据)。
 */
const REPAIR_FAMILY_RE =
  /\b(?:[Rr]epair|[Hh]eal|[Bb]ackfill|[Rr]econcile)(?:[A-Z][A-Za-z0-9_]*|s|es|ed|ing)?\b/
/** 旧值形态:`expectedDirectory` / `expectedPath` / `expectedX`。 */
const EXPECTED_RE = /\bexpected[A-Za-z0-9_]*\b/
/** CAS 未命中形态:受影响行数与 0 比较。 */
const CAS_MISS_RE = /\b(changes|rowCount|rowcount|rowsAffected|affected|modified)\b\s*(?:===|==|<=)\s*0\b|\bchanges\b/
/**
 * 重读形态:未命中之后"再取一次事实"的调用。**只认读名** —— 把 `execute(` / `query(`
 * 算进来会把"发 UPDATE 的那一次 execute"读成重读(本仓实测:`db.execute(sql\`update…\`)`),
 * 那等于给"未命中直接返回"发通行证。读名清单宁窄勿宽:认不出 ⇒ 落"缺 reread"报数,
 * 而误认会造出假绿,方向上只有后者不可接受。
 */
const REREAD_RE =
  /\b(?:select|selectRow|findFirst|findUnique|findMany|findById|readRow|getRow|getById|fetchOne|fetchById|reload|refetch)\s*\(/i
/** `unsafe` 的出口是抛错,不是"记个日志继续写"。 */
const THROW_RE = /\bthrow\b/
/**
 * 合模板的**正当形态**:直接 import 本模块。四态与拒猜那两条由这一份给出,调用方不必
 * (也不许)再抄一遍 ⇒ 静态判据认它,否则"按规矩写"反而被自己的门钉红(与 CSRF 门认
 * `isVerified*` 出口同一条取向:判据必须认自己给出的出口)。
 */
const TEMPLATE_IMPORT_RE = /from\s*['"][^'"]*lib\/db-row-narrow-cas\.mjs['"]/

/**
 * 一个文件(整份源码)是否"自称在做 DB 行面的维护性修复",以及它缺哪几条规矩。
 * @returns {{candidate:boolean,missing:string[],usesTemplate:boolean}}
 *          `missing ⊆ TEMPLATE_PARTS`,缺项只许减少
 */
export function judgeTemplate(text) {
  const code = maskCode(text)
  const candidate = UPDATE_FORM_RE.test(code) && REPAIR_FAMILY_RE.test(code)
  const usesTemplate = TEMPLATE_IMPORT_RE.test(code)
  const missing = []
  // ① 旧值:走不走模板都得自己给 —— 模板不知道你那一行的旧值是什么
  if (!EXPECTED_RE.test(code)) missing.push('expected')

  const tokens = new Set()
  for (const t of FOUR_STATE_TOKENS) if (new RegExp(`\\b${t}\\b`).test(code)) tokens.add(t)
  // ② 四态齐 = 四个 token 都在**且** `unsafe` 有抛错出口(unsafe 不抛错 = 不是拒猜,是顺手修);
  //    走模板 ⇒ 四态与拒猜都在模板里,不缺
  const fourStateOk =
    usesTemplate ||
    (FOUR_STATE_TOKENS.every((t) => tokens.has(t)) && (!tokens.has('unsafe') || THROW_RE.test(code)))
  if (!fourStateOk) missing.push('fourState')

  // ③ 未命中重读:自己判 `changes === 0` 就必须自己再取一次事实;走模板 ⇒ 模板内已重读
  if (!usesTemplate && CAS_MISS_RE.test(code) && !REREAD_RE.test(code)) missing.push('reread')
  return { candidate, missing, usesTemplate }
}

export const __test__ = {
  VERDICTS,
  TEMPLATE_PARTS,
  FOUR_STATE_TOKENS,
  NarrowCasUnsafe,
  expectedFromRow,
  adjudicateRow,
  toNarrowWrite,
  narrowCasRepair,
  maskCode,
  judgeTemplate,
}

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
