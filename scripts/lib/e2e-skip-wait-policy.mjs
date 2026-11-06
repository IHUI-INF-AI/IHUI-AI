// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * e2e skip / 固定等待制度判据(守门 302 的唯一实现)。
 *
 * 规则来源:`apps/web/e2e/SKIP-WAIT-POLICY.md`;台账:`apps/web/e2e/skip-register.json`。
 *
 * 三档结论(§0.3):
 *  - exit 0:本面所有 skip 都有理由 + 已登记编号;所有固定等待都有 WAIT-POLICY 注解;
 *            台账无孤儿。
 *  - exit 1:判据命中(裸 skip / 无理由 / 无编号 / 未知编号 / 过期 / 未注解等待 / 孤儿)。
 *  - exit 2:判不了(台账读不到、结构坏、面无文件)—— 不记绿也不折红。
 *
 * 本文件只做纯文本判定,不碰 git/磁盘;仓面读取在 CLI 侧。
 */
import { maskCommentsStringsAndRegex, scanLiterals } from './code-mask.mjs'

export const SKIP_ID_RE = /^SKIP-\d{4,}$/
export const TIMING_ID_RE = /^TIMING-\d{4,}$/
export const DEFECT_ID_RE = /^E2E-[A-Z0-9]+-\d{4,}$/
export const MIN_REASON = 8

export const SKIP_RULES = Object.freeze([
  'skip-bare',
  'skip-no-reason',
  'skip-no-ref',
  'skip-multi-ref',
  'skip-unknown-ref',
  'skip-category',
  'skip-env-ref-missing',
  'skip-defect-missing',
  'skip-defect-closed',
  'skip-expired',
])

export const WAIT_RULES = Object.freeze([
  'wait-no-annotation',
  'wait-no-reason',
  'wait-unknown-ref',
  'wait-expired',
])

export const ORPHAN_RULES = Object.freeze(['orphan-skip', 'orphan-timing', 'orphan-defect', 'orphan-env-ref'])

/** 本地日期(Asia/Shanghai 或宿主本地)——复审日期比较用,避免 UTC 跨日误判。 */
export function localIsoDate(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t)
}

export function isValidText(v, min = MIN_REASON) {
  return typeof v === 'string' && v.trim().length >= min
}

export function isExpired(reviewBy, today) {
  if (!isIsoDate(reviewBy)) return true
  return reviewBy < today
}

/** 等长遮罩后定位调用结束的右括号;字符串里的括号已被抹平,不会错配。 */
function findClose(masked, open) {
  let depth = 0
  for (let i = open; i < masked.length; i += 1) {
    const c = masked[i]
    if (c === '(') depth += 1
    else if (c === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i += 1) if (text[i] === '\n') line += 1
  return line
}

function lineInfo(text, index) {
  const line = lineOf(text, index)
  let start = index
  while (start > 0 && text[start - 1] !== '\n') start -= 1
  return { line, lineIdx: line - 1, col: index - start }
}

/** 调用参数里的可读理由:取去掉 `[SKIP:...]` 后最长的字面量串,且 ≥8 字。 */
export function reasonFromArgs(argsRaw) {
  const strings = scanLiterals(argsRaw).strings
  let best = null
  for (const s of strings) {
    const body = String(s.body ?? '').replace(/\[SKIP:[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
    if (body.length < MIN_REASON) continue
    if (best === null || body.length > best.length) best = body
  }
  return best
}

/**
 * 抽取 skip / fixme 调用。
 * 返回 [{line, index, callee, argsRaw, tokens, reason, open, close}]
 */
export function extractSkipCalls(text) {
  const src = String(text ?? '')
  const masked = maskCommentsStringsAndRegex(src)
  const re = /(?<![.\w])(?:setupTest|authTest|test)\s*\.\s*(?:skip|fixme)\s*\(/g
  const out = []
  let m
  while ((m = re.exec(masked)) !== null) {
    const open = m.index + m[0].lastIndexOf('(')
    const close = findClose(masked, open)
    if (close < 0) {
      out.push({
        line: lineOf(src, m.index),
        index: m.index,
        callee: `${m[0].split('.').slice(-1)[0]}`.replace('(', '').trim(),
        argsRaw: '',
        tokens: [],
        reason: null,
        open,
        close: -1,
        unparsed: true,
      })
      continue
    }
    const argsRaw = src.slice(open + 1, close)
    const tokens = [...argsRaw.matchAll(/\[SKIP:([^\]]+)\]/g)].map((x) => x[1].trim()).filter(Boolean)
    out.push({
      line: lineOf(src, m.index),
      index: m.index,
      callee: m[0].replace(/[(\s]/g, '').split('.').slice(-1)[0] || 'skip',
      argsRaw,
      tokens,
      reason: reasonFromArgs(argsRaw),
      open,
      close,
    })
  }
  return out
}

const PREV_ANNOTATION_RE = /WAIT-POLICY:\s*(TIMING-\d{4,})\s*([^\n]*)$/
const LINE_ANNOTATION_RE = /WAIT-POLICY:\s*(TIMING-\d{4,})\s*([^\n]*)$/

function cleanAnnotationReason(v) {
  return String(v ?? '')
    .replace(/\*\/\s*$/, '')
    .replace(/^\s*\/\/\s*/, '')
    .replace(/^\s*\/\*\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 同一行内、调用之前;否则紧邻的上一个非空行。lineIdx 从 0 起,col 为行内列。 */
export function findWaitAnnotation(lines, lineIdx, col) {
  const rawLine = lines[lineIdx] ?? ''
  const prefix = rawLine.slice(0, col)
  const same = prefix.match(LINE_ANNOTATION_RE)
  if (same) return { id: same[1], reason: cleanAnnotationReason(same[2]), at: 'same-line' }
  for (let i = lineIdx - 1; i >= 0; i -= 1) {
    const t = (lines[i] ?? '').trim()
    if (!t) continue
    if (!/^(\/\/|\/\*)/.test(t)) return null
    const m = t.match(PREV_ANNOTATION_RE)
    if (!m) return null
    return { id: m[1], reason: cleanAnnotationReason(m[2]), at: 'prev-line' }
  }
  return null
}

/**
 * 抽取固定等待。
 * 返回 [{line, index, annotation}]。annotation 为 null = 没有紧邻注解。
 */
export function extractWaitCalls(text) {
  const src = String(text ?? '')
  const lines = src.split(/\r?\n/)
  const masked = maskCommentsStringsAndRegex(src)
  const re = /\.waitForTimeout\s*\(/g
  const out = []
  let m
  while ((m = re.exec(masked)) !== null) {
    const info = lineInfo(src, m.index)
    out.push({ line: info.line, index: m.index, annotation: findWaitAnnotation(lines, info.lineIdx, info.col) })
  }
  return out
}

/**
 * 台账结构校验。结构性坏 ⇒ undetermined(exit 2),不判红。
 * 返回 {ok, problems:[{code,detail}]}
 */
export function validateRegisterShape(doc) {
  const problems = []
  const bad = (code, detail) => problems.push({ code, detail })
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, problems: [{ code: 'register-shape', detail: '台账不是对象' }] }
  }
  if (doc.schemaVersion !== 1) bad('register-shape', 'schemaVersion 必须为 1')
  if (!doc.envRefs || typeof doc.envRefs !== 'object' || Array.isArray(doc.envRefs)) bad('register-shape', 'envRefs 必须为对象')
  for (const key of ['defects', 'skips', 'timings']) {
    if (!Array.isArray(doc[key])) bad('register-shape', `${key} 必须为数组`)
  }
  if (problems.length > 0) return { ok: false, problems }

  const seen = new Set()
  const add = (id, kind, re) => {
    if (!re.test(String(id ?? ''))) bad('register-entry', `${kind} id 非法:${String(id)}`)
    else if (seen.has(id)) bad('register-entry', `${kind} id 重复:${id}`)
    else seen.add(id)
  }
  const entryMeta = (kind, e, id) => {
    if (!isValidText(e.reason)) bad('register-entry', `${kind} ${id} 缺 ≥${MIN_REASON} 字理由`)
    if (!isValidText(e.owner, 2)) bad('register-entry', `${kind} ${id} 缺 owner`)
    if (!isIsoDate(e.reviewBy)) bad('register-entry', `${kind} ${id} 缺合法 reviewBy(YYYY-MM-DD)`)
  }

  for (const e of doc.skips) {
    add(e.id, 'skip', SKIP_ID_RE)
    entryMeta('skip', e, e.id)
  }
  for (const e of doc.timings) {
    add(e.id, 'timing', TIMING_ID_RE)
    entryMeta('timing', e, e.id)
  }
  for (const e of doc.defects) {
    add(e.id, 'defect', DEFECT_ID_RE)
    if (!isValidText(e.title)) bad('register-entry', `defect ${e.id} 缺 ≥${MIN_REASON} 字标题`)
    if (!['open', 'fixed', 'closed'].includes(e.status)) bad('register-entry', `defect ${e.id} status 非法`)
    if (!isValidText(e.owner, 2)) bad('register-entry', `defect ${e.id} 缺 owner`)
    if (!isIsoDate(e.reviewBy)) bad('register-entry', `defect ${e.id} 缺合法 reviewBy(YYYY-MM-DD)`)
  }
  for (const [key, e] of Object.entries(doc.envRefs)) {
    if (!key || /[\s]/.test(key)) bad('register-entry', `envRefs key 非法:${key}`)
    if (!isValidText(e?.reason)) bad('register-entry', `envRefs ${key} 缺 ≥${MIN_REASON} 字理由`)
    if (!isValidText(e?.owner, 2)) bad('register-entry', `envRefs ${key} 缺 owner`)
    if (!isIsoDate(e?.reviewBy)) bad('register-entry', `envRefs ${key} 缺合法 reviewBy`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * 判全量面(调用方必须传入该面的全部 spec 文本;孤儿判定依赖这一点)。
 * @param {{files:Array<{path:string,text:string}>, register:object, today?:string}} input
 */
export function evaluatePolicy({ files, register, today = localIsoDate() }) {
  const shape = validateRegisterShape(register)
  if (!shape.ok) {
    return {
      exitCode: 2,
      undetermined: true,
      violations: [],
      problems: shape.problems,
      counts: { files: files?.length ?? 0, skipCalls: 0, waitCalls: 0, red: 0 },
    }
  }

  const skipMap = new Map(register.skips.map((e) => [e.id, e]))
  const timingMap = new Map(register.timings.map((e) => [e.id, e]))
  const defectMap = new Map(register.defects.map((e) => [e.id, e]))
  const envMap = new Map(Object.entries(register.envRefs))

  const violations = []
  const referencedSkips = new Set()
  const referencedTimings = new Set()
  let skipCalls = 0
  let waitCalls = 0

  const red = (rule, file, line, detail) => violations.push({ rule, file, line, detail })

  for (const f of files) {
    for (const c of extractSkipCalls(f.text)) {
      skipCalls += 1
      if (c.unparsed) {
        red('skip-no-ref', f.path, c.line, '调用括号无法配对,判不了 ⇒ 请人工修正')
        continue
      }
      if (c.argsRaw.trim() === '') red('skip-bare', f.path, c.line, '裸 skip(无参数/无理由)')
      if (c.tokens.length === 0) red('skip-no-ref', f.path, c.line, '缺 [SKIP:<id>] 关联编号')
      if (c.tokens.length > 1) red('skip-multi-ref', f.path, c.line, `一条 skip 只能挂一个编号,实际 ${c.tokens.length}`)
      if (!c.reason) red('skip-no-reason', f.path, c.line, `缺 ≥${MIN_REASON} 字可读理由`)
      for (const id of c.tokens) {
        referencedSkips.add(id)
        const entry = skipMap.get(id)
        if (!entry) {
          red('skip-unknown-ref', f.path, c.line, `编号 ${id} 不在台账 skips 中`)
          continue
        }
        if (entry.category !== 'ENV' && entry.category !== 'BUG') {
          red('skip-category', f.path, c.line, `编号 ${id} category=${entry.category} 不允许用于 skip`)
          continue
        }
        const [prefix, key] = String(entry.ref ?? '').split(':')
        if (prefix !== entry.category) {
          red('skip-category', f.path, c.line, `编号 ${id} ref=${entry.ref} 与 category=${entry.category} 不一致`)
          continue
        }
        if (entry.category === 'ENV') {
          if (!envMap.has(key)) red('skip-env-ref-missing', f.path, c.line, `编号 ${id} 引用 ENV:${key} 不存在`)
        } else {
          const defect = defectMap.get(key)
          if (!defect) red('skip-defect-missing', f.path, c.line, `编号 ${id} 引用缺陷 ${key} 不存在`)
          else if (defect.status !== 'open') red('skip-defect-closed', f.path, c.line, `编号 ${id} 的缺陷 ${key} 非 open(${defect.status})`)
        }
        if (isExpired(entry.reviewBy, today)) red('skip-expired', f.path, c.line, `编号 ${id} reviewBy=${entry.reviewBy} 已过期`)
      }
    }

    for (const w of extractWaitCalls(f.text)) {
      waitCalls += 1
      if (!w.annotation) {
        red('wait-no-annotation', f.path, w.line, '固定等待缺紧邻的 // WAIT-POLICY:<TIMING-id> 注解')
        continue
      }
      referencedTimings.add(w.annotation.id)
      const entry = timingMap.get(w.annotation.id)
      if (!entry) {
        red('wait-unknown-ref', f.path, w.line, `TIMING 编号 ${w.annotation.id} 不在台账 timings 中`)
        continue
      }
      if (!isValidText(w.annotation.reason)) {
        red('wait-no-reason', f.path, w.line, `注解理由不足 ${MIN_REASON} 字`)
      }
      if (isExpired(entry.reviewBy, today)) red('wait-expired', f.path, w.line, `TIMING 编号 ${w.annotation.id} reviewBy=${entry.reviewBy} 已过期`)
    }
  }

  for (const e of register.skips) {
    if (!referencedSkips.has(e.id)) red('orphan-skip', 'skip-register.json', 0, `台账 skip ${e.id} 未被任何 skip 引用`)
  }
  for (const e of register.timings) {
    if (!referencedTimings.has(e.id)) red('orphan-timing', 'skip-register.json', 0, `台账 timing ${e.id} 未被任何固定等待引用`)
  }
  for (const d of register.defects) {
    const used = register.skips.some((s) => referencedSkips.has(s.id) && s.category === 'BUG' && String(s.ref).split(':')[1] === d.id)
    if (!used) red('orphan-defect', 'skip-register.json', 0, `缺陷 ${d.id} 未被任何 skip 引用`)
  }
  for (const key of envMap.keys()) {
    const used = register.skips.some((s) => referencedSkips.has(s.id) && s.category === 'ENV' && String(s.ref).split(':')[1] === key)
    if (!used) red('orphan-env-ref', 'skip-register.json', 0, `envRefs ${key} 未被任何 skip 引用`)
  }

  return {
    exitCode: violations.length === 0 ? 0 : 1,
    undetermined: false,
    violations,
    problems: [],
    counts: {
      files: files.length,
      skipCalls,
      waitCalls,
      skipRefs: referencedSkips.size,
      timingRefs: referencedTimings.size,
      defects: register.defects.length,
      red: violations.length,
    },
  }
}

/** 摘要输出(CLI 与自检共用,避免两套文案)。 */
export function summarize(result, face) {
  const c = result.counts ?? {}
  return (
    `[e2e skip/等待门] 面=${face} · 文件 ${c.files ?? 0} · skip 调用 ${c.skipCalls ?? 0} · ` +
    `固定等待 ${c.waitCalls ?? 0} · 登记 skip ${c.skipRefs ?? 0} · 登记 timing ${c.timingRefs ?? 0} · ` +
    `缺陷 ${c.defects ?? 0} · 红 ${c.red ?? 0}`
  )
}

export const __test__ = {
  extractSkipCalls,
  extractWaitCalls,
  findWaitAnnotation,
  reasonFromArgs,
  validateRegisterShape,
  evaluatePolicy,
  summarize,
  isExpired,
  isIsoDate,
  localIsoDate,
  MIN_REASON,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
