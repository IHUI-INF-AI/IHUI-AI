// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:plan-write-invariants

/**
 * 计划档写盘不变量的**可复用断言库**(2026-11-03 立;本批只建库与测试,不改任何现有写盘器)。
 *
 * 背景:`PROJECT_PLAN.md` 被"旧基线整文件提交 / 跨会话并集合并 / 索引层回写"反复写薄
 * (`05af7e8c5d`、`9ae4f3bd0a` 都是回捞侧一次插回两行同号)。事后检查能抓一部分,但**写入侧**
 * 没有统一的不变量 —— 各个写盘器各自为政,有的只查"我写的行在不在"、有的只查行数、有的
 * 什么都不查。这个库把六条判据收成一处,后续写盘器在落盘前调用:
 *
 *  1. `sameIdAfter > sameIdBefore` ⇒ fail(同号行只许减少,不许新增重复登记);
 *  2. `blankAfter > blankBefore` ⇒ fail(计划档是稠密格式,空行只许减不许增);
 *  3. `nonBlankAfter < nonBlankBefore - declaredDeletions` ⇒ fail(丢行未声明);
 *  4. `nonBlankAfter > nonBlankBefore + declaredAdditions` ⇒ fail(多出行未声明);
 *  5. 逐字重复组只减不增;租约行 `(族, 机器, 段)` 重复必须为 0;
 *  6. 未带 `wholeDocAttestation` 的整档替换 ⇒ fail。
 *
 * 约定:
 *  - `before` / `after` 是**整档文本**(不是 diff);换行符 `\r\n` 只按行切开,不改变行内容比较。
 *  - `declaredAdditions` / `declaredDeletions` 是调用方**声明**的本次新增/删除非空行数,
 *    缺省 0。声明越界(负数、非整数)本身记 `invalid-input`。
 *  - `wholeDocAttestation` 是**整档替换的书面理由**(字符串/对象均可,非空即视为已背书)。
 *    没有它时,库只放行"局部写":被删掉的原非空行不超过半数,且原档非空行 ≥ 8 行;
 *    越过这条线一律按整档替换处理,要求显式背书。
 *  - 返回 `{ok, violations[]}`;每条 violation 带 `code`、`message` 与 `lines`(1 基线号),
 *    调用方直接拿号定位,不再二次猜。
 *
 * 判据 5 的"租约重复"复用 `plan-id-lease.mjs` 的 `leaseDupGroupsOfRows`(同一组段/机正则),
 * 不在本库重抄第二把尺。
 */
import { keyOfRow } from './plan-task-index.mjs'
import { leaseDupGroupsOfRows } from './plan-id-lease.mjs'

/** 整档替换判定:原档非空行至少这么多行,才启用"删掉过半"启发式(小 fixture 不误伤)。 */
export const WHOLE_DOC_MIN_NONBLANK = 8
/** 整档替换判定:原档非空行被删掉**超过**这个比例 ⇒ 视为整档重写,要求 `wholeDocAttestation`。 */
export const WHOLE_DOC_REPLACEMENT_RATIO = 0.5

const splitLines = (src) => {
  const text = String(src ?? '')
  if (!text) return []
  const lines = text.split(/\r?\n/)
  // 文件末尾的换行不是"一行空行":整档比较里两侧都吞掉,避免写盘器加/去尾换行被误判成空行增减。
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}
const isBlank = (line) => /^\s*$/.test(line)
const clip = (v, max = 96) => {
  const t = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 多集差:`before` 里每个逐字行按 `after` 的份数抵扣,返回未被抵扣的 `{lineNo, raw}`。 */
function removedLines(beforeLines, afterLines, blank = false) {
  const pool = new Map()
  for (const raw of afterLines) {
    if (isBlank(raw) === blank) pool.set(raw, (pool.get(raw) ?? 0) + 1)
  }
  const out = []
  for (let i = 0; i < beforeLines.length; i += 1) {
    const raw = beforeLines[i]
    if (isBlank(raw) !== blank) continue
    const left = pool.get(raw) ?? 0
    if (left > 0) pool.set(raw, left - 1)
    else out.push({ lineNo: i + 1, raw })
  }
  return out
}

/** 多集新增行(`after` 里未被 `before` 抵扣的部分)。 */
function addedLines(beforeLines, afterLines, blank = false) {
  return removedLines(afterLines, beforeLines, blank).map((e) => e)
}

/** 编号行分组(checkbox 形态才产生 key;非任务行不参与 sameId 判据)。 */
function idGroups(lines) {
  const groups = new Map()
  for (let i = 0; i < lines.length; i += 1) {
    const key = keyOfRow(lines[i])
    if (!key) continue
    const list = groups.get(key)
    if (list) list.push({ lineNo: i + 1, raw: lines[i] })
    else groups.set(key, [{ lineNo: i + 1, raw: lines[i] }])
  }
  return groups
}

/** 逐字非空行分组(精确内容,不做 trim —— "逐字重复"就该逐字)。 */
function verbatimGroups(lines) {
  const groups = new Map()
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (isBlank(raw)) continue
    const list = groups.get(raw)
    if (list) list.push(i + 1)
    else groups.set(raw, [i + 1])
  }
  return groups
}

/**
 * 写字侧不变量总检。
 *
 * @param {object} args
 * @param {string} args.before 落盘前整档
 * @param {string} args.after 拟落盘整档
 * @param {number} [args.declaredAdditions=0] 声明新增的非空行数
 * @param {number} [args.declaredDeletions=0] 声明删除的非空行数
 * @param {string|object} [args.wholeDocAttestation=null] 整档替换的书面背书(非空即视为已背书)
 * @returns {{ok: boolean, violations: Array<{code: string, message: string, lines: number[], detail?: object}>}}
 */
export function checkPlanWriteInvariants({
  before = '',
  after = '',
  declaredAdditions = 0,
  declaredDeletions = 0,
  wholeDocAttestation = null,
} = {}) {
  const violations = []
  const fail = (code, message, lines = [], detail = null) => {
    violations.push({ code, message, lines, ...(detail ? { detail } : {}) })
  }

  if (typeof before !== 'string' || typeof after !== 'string') {
    fail(
      'invalid-input',
      `before/after 必须是整档文本(string),收到 before=${typeof before} after=${typeof after}`,
    )
    return { ok: false, violations }
  }
  const add = declaredAdditions ?? 0
  const del = declaredDeletions ?? 0
  if (!Number.isInteger(add) || add < 0) {
    fail('invalid-input', `declaredAdditions 必须是非负整数,收到 ${JSON.stringify(declaredAdditions)}`)
  }
  if (!Number.isInteger(del) || del < 0) {
    fail('invalid-input', `declaredDeletions 必须是非负整数,收到 ${JSON.stringify(declaredDeletions)}`)
  }

  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)
  const nonBlankBefore = beforeLines.filter((l) => !isBlank(l)).length
  const nonBlankAfter = afterLines.filter((l) => !isBlank(l)).length
  const blankBefore = beforeLines.length - nonBlankBefore
  const blankAfter = afterLines.length - nonBlankAfter
  const addOk = Number.isInteger(add) && add >= 0 ? add : 0
  const delOk = Number.isInteger(del) && del >= 0 ? del : 0

  // ① 同号行只许减少:按"同号冗余行数"比较 —— 新编号第一次出现(count 1)不是同号;
  //    after 比 before 多出的冗余行逐个点名(第 2 行起算冗余,之后每多一行都算)。
  const beforeIds = idGroups(beforeLines)
  const afterIds = idGroups(afterLines)
  for (const [id, list] of afterIds) {
    const prev = beforeIds.get(id)?.length ?? 0
    const prevDup = Math.max(0, prev - 1)
    const afterDup = Math.max(0, list.length - 1)
    if (afterDup <= prevDup) continue
    const excess = list.slice(Math.max(prev, 1))
    fail(
      'same-id-grew',
      `登记编号 ${id} 同号行 ${prev} → ${list.length}(同号只许减少,新增重复登记必须人工复核)`,
      excess.map((e) => e.lineNo),
      { id, beforeCount: prev, afterCount: list.length },
    )
  }

  // ② 空行只许减不许增(计划档稠密)。
  if (blankAfter > blankBefore) {
    const lines = []
    for (let i = 0; i < afterLines.length; i += 1) if (isBlank(afterLines[i])) lines.push(i + 1)
    fail('blank-grew', `空行 ${blankBefore} → ${blankAfter}(计划档是稠密格式,不得新增空行)`, lines, {
      beforeCount: blankBefore,
      afterCount: blankAfter,
    })
  }

  // ③ 丢行未声明。
  if (nonBlankAfter < nonBlankBefore - delOk) {
    const removed = removedLines(beforeLines, afterLines, false)
    fail(
      'undeclared-deletion',
      `非空行 ${nonBlankBefore} → ${nonBlankAfter},删了 ${nonBlankBefore - nonBlankAfter} 行但只声明 ${delOk} 行`,
      removed.map((e) => e.lineNo),
      { beforeCount: nonBlankBefore, afterCount: nonBlankAfter, declaredDeletions: delOk },
    )
  }

  // ④ 多出行未声明。
  if (nonBlankAfter > nonBlankBefore + addOk) {
    const added = addedLines(beforeLines, afterLines, false)
    fail(
      'undeclared-addition',
      `非空行 ${nonBlankBefore} → ${nonBlankAfter},多了 ${nonBlankAfter - nonBlankBefore} 行但只声明 ${addOk} 行`,
      added.map((e) => e.lineNo),
      { beforeCount: nonBlankBefore, afterCount: nonBlankAfter, declaredAdditions: addOk },
    )
  }

  // ⑤a 逐字重复组只减不增:只有"重复"(≥2 份)才是组;after 首次出现的单行不是重复。
  //    超出 before 份数(且至少从第 2 份起算)的 after 行逐个点名。
  const beforeVerbatim = verbatimGroups(beforeLines)
  const afterVerbatim = verbatimGroups(afterLines)
  for (const [raw, lines] of afterVerbatim) {
    const prev = beforeVerbatim.get(raw)?.length ?? 0
    if (lines.length < 2 || lines.length <= Math.max(prev, 1)) continue
    const excess = lines.slice(Math.max(prev, 1))
    fail('verbatim-dup-grew', `逐字行出现 ${prev} → ${lines.length} 次:«${clip(raw)}»`, excess, {
      beforeCount: prev,
      afterCount: lines.length,
      content: raw,
    })
  }

  // ⑤b 租约行 `(族, 机器, 段)` 重复必须为 0(复用租约库的单源分组)。
  const leaseRows = afterLines.map((raw, i) => ({ raw, line: i + 1 }))
  for (const group of leaseDupGroupsOfRows(leaseRows)) {
    const head = group[0]
    fail(
      'lease-dup',
      `租约同键(${head.machine} 段=${head.segment})出现 ${group.length} 行:«${clip(head.raw)}»`,
      group.map((e) => e.lineNo),
      { machine: head.machine, segment: head.segment, count: group.length },
    )
  }

  // ⑥ 未背书的整档替换。
  const attested =
    typeof wholeDocAttestation === 'string'
      ? wholeDocAttestation.trim().length > 0
      : Boolean(wholeDocAttestation)
  if (!attested && after !== before) {
    const removed = removedLines(beforeLines, afterLines, false).length
    const ratio = nonBlankBefore > 0 ? removed / nonBlankBefore : 0
    const wipe = nonBlankBefore > 0 && nonBlankAfter === 0
    const wholesale =
      nonBlankBefore >= WHOLE_DOC_MIN_NONBLANK && ratio > WHOLE_DOC_REPLACEMENT_RATIO
    if (wipe || wholesale) {
      const removedList = removedLines(beforeLines, afterLines, false)
      fail(
        'whole-doc-without-attestation',
        `整档替换未背书:原档非空行 ${nonBlankBefore} 行被删 ${removed} 行(${(ratio * 100).toFixed(1)}%)` +
          `,after 非空行 ${nonBlankAfter};必须带 wholeDocAttestation(写明来源/理由)才允许落盘`,
        removedList.slice(0, 40).map((e) => e.lineNo),
        { beforeNonBlank: nonBlankBefore, afterNonBlank: nonBlankAfter, removed, ratio, wipe },
      )
    }
  }

  return { ok: violations.length === 0, violations }
}
