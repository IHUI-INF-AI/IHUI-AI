#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998147 守门(b76-12b):进持久记录的错误文案必须"只描述形状",上限度量按 UTF-8 字节。
 *
 * 机制(出处 b76-12b,上游 artifact-spec.ts / engine-report.ts):出错文案里的实得值
 * 必须经一个 describe() 式的有界化 —— 数组只报 `array (N items)`、字符串截断、对象只报
 * `object`;理由:"不打印整个对象 —— 一个 8KB 的 spec 会把 failure_json 塞满"。上限
 * 按 UTF-8 字节量(`new TextEncoder().encode(v).length`)而非 `v.length`(一份中文
 * findings 的字符数只有字节数的三分之一,按字符计会让上限形同虚设)。
 *
 * 本门的实质工作是"归类 + 给未归类者加界",不是新造一把尺(仓内已有 MAX_BYTES=169 /
 * byteLength=149 两类字节尺命中)。扫描口径(如实写明,扩大口径先改这里并同枚 self-test):
 *
 *   扫 apps/**、packages/** 的 .ts(node_modules/dist 除外),命中**错误文案语句**
 *   (多行感知):`throw new <Ctor>(…)`,`new <Error族>(…)`,`return/reject/= new <Error族>(…)`
 *   —— 其模板串内插 `${…JSON.stringify(…)...}` 的每一处内插。
 *   纯 console.*(stdout 面)、SQL/SSE 参数、文件写入等非错误文案语境**不在扫描对象内**
 *   (这正是"不是按关键字一刀切的桶":JSON.stringify 出现在调试日志里会被放过)。
 *
 * 每条命中输出 file:line + 被内插表达式 + 判定(verdict):
 *   - named-bounded   内插包在有界化函数里(describe、bounded、truncate、redact、summarize、
 *                     clip、preview、safe 前缀族) —— 文案只描述形状,放过;
 *   - inline-bounded  内插后接 `.slice(0, N)` / `.substring(0, N)` / `.substr(0, N)` 数字截断
 *                     —— 有界但是**字符**界(字节界另票),放过并如实标注;
 *   - face:test / cli 测试报告与 CLI 终端不落持久记录,放过;
 *   - stdout-only     抛错被同函数内只写 stdout 的 catch 吞掉(console.x 或 process.stdout、
 *                     process.stderr,无任何持久 sink、无再抛),放过;
 *   - PERSISTENT      其余一律按"流入持久记录"计(deny-by-default:错误文案会进错误信封/
 *                     failure_json/审计台账,判不出流向时不假装判得出)。
 *
 * 判据:流入持久记录且未过有界化函数的条数 == 0。基线(BASELINE 常量,内嵌本脚本)只许
 * 收"已归类为可接受"的存量条目,每一条必须带非空 `ref=` 出处(指向谁在何时核过流向、
 * 加界归属谁 —— **不得钉 HEAD**:ref 是对现状的论证,不是"某个 commit 时是好的"的担保);
 * 基线条目没有 ref=、或指向的命中已不存在(过期条目)都判红 —— 防烂账静默沉淀。
 *
 * 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
 *   勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_ERROR_MESSAGE_BOUNDED,无 stagedTriggers。
 *   —— 本段原写"本门不接提交链(guardian-runner / package.json / .husky 一律不动,接链由守门
 *   持有人在存量清偿后统一做,§12f)",那是立项时的实况,已过期(门早已装车);
 *   立论(§12f 的分寸)保留,接线事实按上条现读改写。跑法:
 *   node scripts/check-error-message-bounded.mjs             # 真仓扫描,exit 0 = 绿
 *   node scripts/check-error-message-bounded.mjs --self-test # 夹具自检(正反成对)
 *   node scripts/check-error-message-bounded.mjs --json      # 机读输出
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 有界化函数名前缀(命中 `name(JSON.stringify(x))` 形态即算"只描述形状";describe/bounded/truncate/redact/summarize/clip/preview/safe 前缀族)。 */
const BOUNDED_NAME_RE =
  /^(?:describe|bounded|truncate|redact|summarize|clip|preview|safe)[A-Za-z0-9_]*$/i
/** 数字截断(字符界)形态:`.slice(0, N)` / `.substring(0, N)` / `.substr(0, N)`。 */
const INLINE_CAP_RE = /\.(?:slice|substring|substr)\(\s*0\s*,\s*\d+\s*\)/
/** 持久化 sink 指纹(catch 块里出现 ⇒ 该 catch 会把错误文案写进持久记录)。 */
const PERSIST_SINK_RE =
  /(insert\s+into|\.insert\(|\.update\(|\.save\(|\.upsert\(|persist|audit|failure[_-]?json|logger\.\w+|log\.(?:error|warn|info)|notify|report[A-Za-z]*\(|\.query\(|execute\(|publish\(|enqueue\()/i
/** stdout 面(catch 块里只有这些 ⇒ 文案只进终端)。 */
const STDOUT_SINK_RE = /(console\.\w+|process\.(?:stdout|stderr))/

const ERROR_CTOR_RE = /[A-Za-z_$][\w$]*(?:Error|Exception|Rejection|Failure|Abort|Timeout|Undoable)$/
const THROW_RE = /\bthrow\s+new\s+([A-Za-z_$][\w$.]*)\s*\(/
const NEW_ERR_RE = /\bnew\s+([A-Za-z_$][\w$.]*)\s*\(/

/** 测试面 / CLI 面(结构化路径分类,非消息关键字)。 */
function faceOf(relPath) {
  const norm = relPath.split(sep).join('/')
  if (/(^|\/)(tests?|__tests__)(\/|$)/.test(norm) || /\.(test|spec)\.ts$/.test(norm)) return 'test'
  if (/^apps\/cli\//.test(norm)) return 'cli'
  return null
}

/**
 * 模板感知扫描器:返回 { throws:[{idx, ctor, interps:[{expr, end}]}], }
 * 只保留代码态;注释、单双引号串被跳过;模板串收集 `${…}` 内插(支持嵌套)。
 */
function scanStatements(src) {
  const out = []
  const n = src.length
  let i = 0
  const lineOf = (idx) => src.slice(0, idx).split('\n').length

  /** 从 idx(指向 '(')配平到 ')';模板串内跳过字面量、收集内插;返回 {end, interps} */
  function balancedParen(start, collect) {
    let depth = 0
    const interps = []
    let k = start
    while (k < n) {
      const ch = src[k]
      if (ch === '(') {
        depth++
        k++
      } else if (ch === ')') {
        depth--
        if (depth === 0) return { end: k, interps }
        k++
      } else if (ch === '`') {
        const r = scanTemplate(k, collect ? interps : null)
        k = r.end
      } else if (ch === "'" || ch === '"') {
        k = skipQuote(k)
      } else if (ch === '/' && src[k + 1] === '/') {
        while (k < n && src[k] !== '\n') k++
      } else if (ch === '/' && src[k + 1] === '*') {
        k = src.indexOf('*/', k + 2)
        k = k < 0 ? n : k + 2
      } else k++
    }
    return { end: n, interps }
  }

  /** 模板串:返回 end(反引号后一位);collect 时提取每个 ${…} 内插文本(含嵌套)。 */
  function scanTemplate(start, collect) {
    let k = start + 1
    while (k < n) {
      if (src[k] === '\\') {
        k += 2
        continue
      }
      if (src[k] === '`') return { end: k + 1 }
      if (src[k] === '$' && src[k + 1] === '{') {
        // 内插:配平花括号(内部还可能有模板串/引号/注释)
        let d = 1
        const exprStart = k + 2
        k += 2
        while (k < n && d > 0) {
          const c = src[k]
          if (c === '{') d++
          else if (c === '}') {
            d--
            if (d === 0) break
          } else if (c === '`') {
            k = scanTemplate(k, null).end
            continue
          } else if (c === "'" || c === '"') {
            k = skipQuote(k)
            continue
          } else if (c === '/' && src[k + 1] === '/') {
            while (k < n && src[k] !== '\n') k++
            continue
          } else if (c === '/' && src[k + 1] === '*') {
            const z = src.indexOf('*/', k + 2)
            k = z < 0 ? n : z + 2
            continue
          }
          k++
        }
        if (collect) collect.push({ expr: src.slice(exprStart, k), idx: exprStart })
        k++ // 越过 '}'
      } else k++
    }
    return { end: n }
  }

  function skipQuote(start) {
    const q = src[start]
    let k = start + 1
    while (k < n) {
      if (src[k] === '\\') k += 2
      else if (src[k] === q) return k + 1
      else if (src[k] === '\n' && q === "'") return k // JS 单引号串不跨行(无转义时)
      else k++
    }
    return n
  }

  while (i < n) {
    const ch = src[i]
    if (ch === '`') {
      i = scanTemplate(i, null).end
      continue
    }
    if (ch === "'" || ch === '"') {
      i = skipQuote(i)
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const z = src.indexOf('*/', i + 2)
      i = z < 0 ? n : z + 2
      continue
    }
    // 语句起点:throw new X( 或 new Error族(
    const rest = src.slice(i, i + 400)
    let m = THROW_RE.exec(rest)
    let isNewErr = false
    if (!m) {
      m = NEW_ERR_RE.exec(rest)
      isNewErr = true
      if (m && !ERROR_CTOR_RE.test(m[1])) m = null
    }
    if (m && m.index === 0) {
      const parenIdx = src.indexOf('(', i + m[0].length - 1)
      if (parenIdx >= 0) {
        const { end, interps } = balancedParen(parenIdx, true)
        out.push({ idx: i, line: lineOf(i), ctor: m[1], isThrow: !isNewErr, interps, end })
        i = end + 1
        continue
      }
    }
    i++
  }
  return out
}

/**
 * 找 idx 所在的最近一层 try 块的 catch 体;找不到(含 idx 在某 catch 体里)返回 null。
 * 返回 { catchBody, catchLine } 或 null。
 */
function findEnclosingCatch(src, idx) {
  const n = src.length
  let from = idx
  while (from > 0) {
    const t = src.lastIndexOf('try', from)
    if (t < 0) return null
    // 'try' 必须是词(前面不是字母/数字/_/$);无论是否命中,下一轮都从 t-1 向前找(保证推进)
    const isWord = /[A-Za-z0-9_$]/.test(src[t - 1] ?? '')
    from = t - 1
    if (isWord) continue
    const b = src.indexOf('{', t + 3)
    if (b < 0 || b > idx) continue
    // 配平 try 块
    let d = 0
    let k = b
    let end = -1
    while (k < n) {
      const c = src[k]
      if (c === '{') d++
      else if (c === '}') {
        d--
        if (d === 0) {
          end = k
          break
        }
      } else if (c === '`' || c === "'" || c === '"') break // 粗暴:该 try 覆盖复杂字面量时放弃本层
      k++
    }
    if (end < 0 || idx > end) continue
    // idx 确在该 try 块内;看块后的 catch
    const after = src.slice(end + 1, end + 200)
    const cm = /^\s*(?:\}\s*)?catch\s*\(/.exec(after) ?? /^\s*catch\s*\(/.exec(after)
    if (!cm) return null
    const catchOpen = src.indexOf('{', end + 1 + cm.index + cm[0].length - 1)
    if (catchOpen < 0) return null
    let d2 = 0
    let k2 = catchOpen
    while (k2 < n) {
      const c = src[k2]
      if (c === '{') d2++
      else if (c === '}') {
        d2--
        if (d2 === 0) break
      }
      k2++
    }
    const line = src.slice(0, catchOpen).split('\n').length
    return { catchBody: src.slice(catchOpen, k2 + 1), catchLine: line }
  }
  return null
}

/** 单条内插的有界化判定。 */
function boundednessOf(expr) {
  const jm = /JSON\.stringify\s*\(/.exec(expr)
  if (!jm) return null
  const before = expr.slice(0, jm.index)
  const wrap = /([A-Za-z_$][\w$]*)\s*\(\s*$/.exec(before)
  if (wrap && BOUNDED_NAME_RE.test(wrap[1])) return 'named-bounded'
  const after = expr.slice(jm.index)
  // JSON.stringify(…) 之后接数字截断(允许中间再有若干收尾括号)
  const tail = /\.slice\(\s*0\s*,\s*\d+\s*\)|\.substring\(\s*0\s*,\s*\d+\s*\)|\.substr\(\s*0\s*,\s*\d+\s*\)/.exec(
    after.slice(after.indexOf(')') + 1),
  )
  if (tail) return 'inline-bounded'
  return null
}

/**
 * 扫单个文件:返回命中清单 [{line, ctor, expr, verdict, bounded}]。
 * verdict: 'named-bounded' | 'inline-bounded' | 'face:test' | 'face:cli' | 'stdout-only' | 'PERSISTENT'
 */
function scanFile(relPath, src) {
  const face = faceOf(relPath)
  const hits = []
  for (const stmt of scanStatements(src)) {
    for (const interp of stmt.interps) {
      if (!/JSON\.stringify\s*\(/.test(interp.expr)) continue
      const bounded = boundednessOf(interp.expr)
      let verdict
      if (bounded) verdict = bounded
      else if (face) verdict = `face:${face}`
      else {
        // catch 流向分析:抛点被同函数内 catch 吞掉且该 catch 只写 stdout ⇒ 放过;
        // 其余(持久 sink 的 catch / 在 catch 体里再抛 / 无本层 catch 直接出边界)
        // 按流入持久记录计(deny-by-default,判不出流向不假装判得出)。
        const ec = findEnclosingCatch(src, stmt.idx)
        if (ec && !PERSIST_SINK_RE.test(ec.catchBody) && STDOUT_SINK_RE.test(ec.catchBody) && !/\bthrow\b/.test(ec.catchBody))
          verdict = 'stdout-only'
        else verdict = 'PERSISTENT'
      }
      hits.push({ line: stmt.line, ctor: stmt.ctor, expr: interp.expr.trim(), verdict, bounded: !!bounded })
    }
  }
  return hits
}

function* walkTs(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (e === 'node_modules' || e === 'dist' || e === '.git' || e === 'build' || e === 'coverage') continue
      yield* walkTs(p)
    } else if (e.endsWith('.ts')) yield p
  }
}

// ── 基线:已归类为可接受的存量命中。每条必须带非空 ref= 出处(不得钉 HEAD):
//    ref 是"谁在何时核过流向/加界归属谁"的论证,不是对某个 commit 的担保。 ──
const BASELINE = [
  {
    file: 'packages/shared/src/chat/business-forms.ts',
    expr: 'JSON.stringify(event)',
    ref: 'assertNeverEvent 的 never 兜底(仅在状态机漏枚举新事件时触发);流向=错误信封/对话日志,' +
      '尚未落 failure_json 实证;加界(改 describe() 形状化)归属 chat 表单状态机持有人,' +
      '台账号 G-998147 · b76-12b(2026-09-30 现场归类)',
  },
]

function normalizeExpr(s) {
  return s.replace(/\s+/g, ' ').trim()
}

function normalizePath(p) {
  return String(p).split(sep).join('/').replace(/^\.\//, '')
}

/** 基线校验:每条带 ref=;且每条都能对上现扫命中(过期条目判红)。返回 [errors, usedKeys] */
function checkBaseline(baseline, hits, relOf) {
  const errors = []
  const used = new Set()
  baseline.forEach((b, bi) => {
    const id = `BASELINE[${bi}] ${b.file}`
    if (!b.ref || !String(b.ref).trim())
      errors.push(`${id}: 基线条目缺 ref= 出处 —— 没有流向论证的放行就是烂账`)
    const hit = hits.find(
      (h) =>
        normalizePath(relOf(h)) === normalizePath(b.file) &&
        normalizeExpr(h.expr).includes(normalizeExpr(b.expr)),
    )
    if (!hit) errors.push(`${id}: 基线条目已过期 —— 对应命中(内插 \`${b.expr}\`)在现扫中不存在,删掉或改对`)
    else used.add(hit)
  })
  return { errors, used }
}

function scanRepo() {
  const rows = []
  for (const abs of walkTs(join(REPO_ROOT, 'apps')))
    rows.push({ abs, rel: relative(REPO_ROOT, abs) })
  for (const abs of walkTs(join(REPO_ROOT, 'packages')))
    rows.push({ abs, rel: relative(REPO_ROOT, abs) })
  const hits = []
  for (const { abs, rel } of rows) {
    let src
    try {
      src = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    for (const h of scanFile(rel, src)) hits.push({ file: rel, ...h })
  }
  return hits
}

function judge(hits, baseline = BASELINE) {
  const { errors: baseErrors, used } = checkBaseline(baseline, hits, (h) => h.file)
  const unbounded = hits.filter((h) => h.verdict === 'PERSISTENT' && !used.has(h))
  const lines = []
  let code = 0
  if (baseErrors.length) {
    code = 1
    lines.push('❌ 基线不合规:')
    for (const e of baseErrors) lines.push(`  - ${e}`)
  }
  if (unbounded.length) {
    code = 1
    lines.push(
      `❌ ${unbounded.length} 条错误文案内插实得值、未过有界化函数且流入持久记录(上限按 UTF-8 字节量,不是字符):`,
    )
    for (const h of unbounded)
      lines.push(`  - ${h.file}:${h.line} [${h.ctor}] \`${h.expr}\``)
    lines.push('     修法:内插值过 describe() 式有界化(数组只报 array (N items)/字符串截断/对象只报 object),')
    lines.push('     上限度量用 new TextEncoder().encode(v).length;确属不进持久记录的,归类进 BASELINE 并写 ref=。')
  }
  if (code === 0)
    lines.push(
      `✅ 错误文案有界化守门通过(命中 ${hits.length} 条:PERSISTENT 0;其余为有界/测试面/CLI 面/stdout-only;基线 ${baseline.length} 条均带 ref=)`,
    )
  return { code, lines }
}

function selfTestRun() {
  const results = []
  const check = (name, ok) => results.push({ name, ok })
  const scan = (src) => scanFile('apps/api/src/demo.ts', src) // 默认服务面(无 face 豁免)
  const RED = (h) => h.verdict === 'PERSISTENT'

  // ① 票面注入正例:进 DB 记录的 catch 里注入一行 ⇒ 必红并点名该行
  const dbCatch = [
    'export async function handler(req: Request) {',
    '  try {',
    '    await runJob(req)',
    '  } catch (e) {',
    "    await db.insert('failure_json', { message: String(e) })",
    '    throw new Error(`payload=${JSON.stringify(req.body)}`)',
    '  }',
    '}',
  ].join('\n')
  const r1 = scan(dbCatch)
  check('① DB-catch 注入 ⇒ 命中 1 条且 PERSISTENT', r1.length === 1 && RED(r1[0]))
  check('① 红点必须点名该行(第 6 行)', r1[0]?.line === 6)

  // ② 票面注入反例:同样一行只写 stdout 的调试日志 ⇒ 放过(不是按关键字一刀切的桶)
  const stdoutLog = [
    'export function debugHook(req: Request) {',
    '  console.error(`[debug] payload=${JSON.stringify(req.body)}`)',
    '}',
  ].join('\n')
  const r2 = scan(stdoutLog)
  check('② stdout 调试日志注入 ⇒ 放过(不在错误文案扫描对象内)', r2.length === 0)

  // ③ 同一虚拟文件里 throw 被 stdout-only catch 吞掉 ⇒ 放过
  const stdoutCatch = [
    'export function f() {',
    '  try {',
    '    risky()',
    '  } catch (e) {',
    "    console.error('[debug] dump failed', e)",
    '  }',
    '}',
    'export function g(x: unknown) {',
    '  try {',
    '    parse(x)',
    '  } catch (e) {',
    "    console.error(`dump=${JSON.stringify(x)}`)",
    '  }',
    '}',
  ].join('\n')
  const r3 = scan(stdoutCatch)
  check('③ stdout-only catch 吞掉的抛错 ⇒ 全部放过', r3.every((h) => h.verdict === 'stdout-only'))

  // ④ throw 后面接持久 sink 的 catch ⇒ PERSISTENT(catch 形态真的在读)
  const persistCatch = [
    'export async function f(x: unknown) {',
    '  try {',
    '    if (!ok) throw new Error(`state=${JSON.stringify(x)}`)',
    '    parse(x)',
    '  } catch (e) {',
    "    await audit.record('parse_failure', String(e))",
    '  }',
    '}',
  ].join('\n')
  const r4 = scan(persistCatch)
  check('④ 持久 sink 的 catch ⇒ PERSISTENT', r4.length === 1 && RED(r4[0]))

  // ⑤ 无本层 catch(直接出边界)⇒ deny-by-default PERSISTENT
  const r5 = scan('export function f(x: unknown) {\n  throw new Error(`state=${JSON.stringify(x)}`)\n}')
  check('⑤ 无 catch 直接出边界 ⇒ PERSISTENT(不假装判得出流向)', r5.length === 1 && RED(r5[0]))

  // ⑥ 有界化:命名有界 + 内联数字截断都放过;字符界如实标注
  const boundedSrc =
    'export function f(x: unknown, y: unknown) {\n' +
    '  throw new Error(`a=${describe(JSON.stringify(x))} b=${JSON.stringify(y).slice(0, 300)}`)\n' +
    '}'
  const r6 = scan(boundedSrc)
  check(
    '⑥ describe() 命名有界 + .slice(0,N) 内联截断 ⇒ 放过且如实标注',
    r6.length === 2 &&
      r6[0].verdict === 'named-bounded' &&
      r6[1].verdict === 'inline-bounded',
  )

  // ⑦ 面豁免:测试面 / CLI 面放过(路径分类,不是消息关键字)
  const testSrc = 'test("x", () => { throw new Error(`got=${JSON.stringify(x)}`) })'
  const r7a = scanFile('apps/api/tests/demo.test.ts', testSrc)
  const r7b = scanFile('apps/cli/src/tool.ts', testSrc)
  check('⑦ 测试面 / CLI 面按路径放过', r7a[0]?.verdict === 'face:test' && r7b[0]?.verdict === 'face:cli')

  // ⑧ 多行 throw 语句(内插在第二行)也能命中
  const multiline = [
    'export function f(x: unknown) {',
    '  throw new Error(',
    '    `展开的实得值: ${JSON.stringify(x)}`,',
    '  )',
    '}',
  ].join('\n')
  const r8 = scan(multiline)
  check('⑧ 多行 throw 语句内插 ⇒ 命中且 PERSISTENT', r8.length === 1 && RED(r8[0]))

  // ⑨ 基线牙齿:缺 ref= 判红;过期条目判红;合法基线抵扣 PERSISTENT
  const hits = scan(multiline)
  const relOfForFixture = (h) => h.file ?? 'apps/api/src/demo.ts'
  const noRef = checkBaseline([{ file: 'apps/api/src/demo.ts', expr: 'JSON.stringify(x)' }], hits, relOfForFixture)
  check('⑨ 基线条目缺 ref= ⇒ 判红', noRef.errors.length === 1 && noRef.errors[0].includes('ref='))
  const stale = checkBaseline([{ file: 'apps/api/src/demo.ts', expr: 'JSON.stringify(never-existed)', ref: 'x' }], hits, relOfForFixture)
  check('⑨ 过期基线条目 ⇒ 判红', stale.errors.length === 1 && stale.errors[0].includes('已过期'))
  const okBase = checkBaseline(
    [{ file: 'apps/api/src/demo.ts', expr: 'JSON.stringify(x)', ref: 'b76-12b 现场归类:内插值是状态机的 never 兜底' }],
    hits,
    relOfForFixture,
  )
  check('⑨ 合法 ref= 基线抵扣 PERSISTENT 命中', okBase.errors.length === 0 && okBase.used.size === 1)

  let fail = 0
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
    if (!r.ok) fail++
  }
  console.log(
    fail
      ? `self-test FAILED ${fail}/${results.length}`
      : `✅ check-error-message-bounded self-test 全部通过(${results.length} 例)`,
  )
  return fail ? 1 : 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(selfTestRun())
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(
      [
        '用法: node scripts/check-error-message-bounded.mjs [--json] [--self-test] [--help]',
        '',
        '  (默认)   扫 apps/** packages/** 的 .ts 错误文案内插点,exit 0 = 无"流入持久记录且未有界化"',
        '  --json   机读输出',
        '  --self-test  夹具自检(正反成对)',
      ].join('\n'),
    )
    process.exit(0)
  } else {
    const hits = scanRepo()
    const v = judge(hits)
    if (args.includes('--json')) {
      console.log(JSON.stringify({ code: v.code, hits, lines: v.lines }, null, 1))
    } else {
      for (const h of hits)
        console.log(`${h.verdict === 'PERSISTENT' ? '❌' : 'ℹ️'} ${h.file}:${h.line} [${h.ctor}] ${h.verdict} \`${h.expr}\``)
      console.log(v.lines.join('\n'))
    }
    process.exit(v.code)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
