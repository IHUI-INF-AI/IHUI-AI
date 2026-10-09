// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 键流追踪 —— 守门 2 的"跨语句取键"判据层(唯一实现)。
 *
 * 立因(票 G-1079148;2026-10-09 机主拍板「门 2 升键流追踪判据,禁放宽降级」):
 * `scripts/check-i18n-keys.mjs` 原来只认 `t('字面量')` 一种形态。组件把**键名当值**存进 state、
 * 或传给 helper,再由渲染处 `t(变量)` 取用时,这些键在文件里"出现过"却从来没被算进
 * "该组件真实消费的键集合"。实测样本 `apps/web/src/components/ai/markdown-table-toolbar.tsx`
 * (提交 7ef7d9302 那一份)消费 8 个 `chat.markdownTable.*` 键,门只点名其中 4 个
 * (copy / downloadCsv / fullscreen / fullscreenTitle)——剩下 4 个(empty / unsupported /
 * copyFailed / csvFailed)走的正是 `flashNotice(key)` → `setNotice(key)` → `t(notice)`。
 * 结果:一个漏了 4 个键的文件,门对着它报绿。
 *
 * 本模块只答一个问题:**这个文件里还有哪些键是流进 `t(变量)` 的?** 答不出来的逐条落成
 * "未判定",不静默。
 *
 * 三条口径(本仓反复吃过亏的那三条):
 *  1. **三态不并桶**:`keys`(命中)与 `undetermined`(未判定)是两个数组,不折成一个数,
 *     也不因为"这一文件有命中"就把没判定的那一半抹成绿。调用方据此在 `--strict` 下 exit 2。
 *  2. **只引一份遮噪**:判据面先剥注释、**保留字符串**(`maskComments` —— 要找的东西本身就是
 *     字符串字面量),结构分析再在其上清掉字面量体(`blankStrings`,免得串里的假 `setX(` 把括号
 *     配平带偏)。两遍都出自 `scripts/lib/code-mask.mjs` 这一台分词器,本文件不自写剥注释正则。
 *     两遍等长且不动换行 ⇒ 下标一一对应、行号可直接回原文件。
 *  3. **不按名字全局并桶**:标识符按**词法作用域**归属(最近的函数形参 → useState 读数 →
 *     同作用域的 const/let 绑定)。同名变量在两个闭包里各有一份时并桶会把别处的值算进来(误报),
 *     所以定不出作用域就是未判定,不猜。
 */

import { maskComments, blankStrings } from './code-mask.mjs'

/** 翻译函数的成员调用形态 —— 与门里 extractKeysByVar 认的那一支逐字相同,不另立一套 */
const T_MEMBERS = 'rich|raw|format|has'
const IDENT_SRC = '[A-Za-z_$][\\w$]*'
const IDENT_ONLY = new RegExp(`^${IDENT_SRC}$`)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * useState 解构的**唯一**一条形态判据(2026-10-09 从 traceKeyFlow 体内提出)。
 * 提出来的理由是"两处算同一件事必漂移":调用方(门 2)必须用同一个正则派生汇点名,
 * 而不能在门里再抄一份 —— 本票接线当天就在门里抄了一份写窄的(`use` 与 `State` 之间少了
 * `(?:…)?`,于是 `useState` 整族不匹配),门对着同一个文件继续报绿,恰是本票立项那一型。
 * 参数是**已遮噪**的代码面(与 traceKeyFlow 内部一致);只读,不改任何状态。
 */
export function deriveStatePairs(src) {
  const out = []
  const re = new RegExp(
    `(?:const|let|var)\\s*\\[\\s*(${IDENT_SRC})\\s*,\\s*(${IDENT_SRC})\\s*\\]\\s*=\\s*(?:React\\.)?[\\w$.]*use(?:[A-Za-z_$][\\w$]*)?State\\b`,
    'g',
  )
  let m
  while ((m = re.exec(src)) !== null) out.push({ reader: m[1], sink: m[2] })
  return out
}

/** 行号(1 起)。遮噪两遍都不动换行 ⇒ 在 masked 上数换行就是原文件行号。 */
function lineOf(text, index) {
  let line = 1
  const upto = Math.min(index, text.length)
  for (let i = 0; i < upto; i++) if (text[i] === '\n') line += 1
  return line
}

/** 片段的单行化摘要(报未判定时要点名形态,但不能把整段代码喷进日志) */
function snippetOf(masked, start, end) {
  return masked
    .slice(Math.max(0, start), Math.min(end, masked.length))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72)
}

/** 括号配对:open 指向 `(`/`[`/`{` ⇒ 配对闭符下标;配不平 -1(调用方落未判定,不是"没有") */
function matchBracket(sk, open) {
  const closer = { '(': ')', '[': ']', '{': '}' }[sk[open]]
  if (!closer) return -1
  let depth = 0
  for (let i = open; i < sk.length; i++) {
    const c = sk[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1
      if (depth === 0) return sk[i] === closer ? i : -1
    }
  }
  return -1
}

/** 反向配对:close 指向 `)` ⇒ 其 `(` 下标;配不平 -1 */
function backMatch(sk, close) {
  let depth = 0
  for (let i = close; i >= 0; i--) {
    const c = sk[i]
    if (c === ')' || c === ']' || c === '}') depth += 1
    else if (c === '(' || c === '[' || c === '{') {
      depth -= 1
      if (depth === 0) return c === '(' ? i : -1
    }
  }
  return -1
}

/**
 * 拆实参表(open 指向调用左括号)。
 * @returns {{args: {start:number,end:number}[], ok: boolean}} ok=false ⇒ 配不平
 */
export function splitArgs(sk, open) {
  const close = matchBracket(sk, open)
  if (close < 0) return { args: [], ok: false }
  const args = []
  let depth = 0
  let from = open + 1
  for (let i = open + 1; i < close; i++) {
    const c = sk[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') depth -= 1
    else if (c === ',' && depth === 0) {
      args.push({ start: from, end: i })
      from = i + 1
    }
  }
  if (sk.slice(open + 1, close).trim() || args.length) args.push({ start: from, end: close })
  return { args, ok: true }
}

/** 名字前不能是 `.` 或词字符 —— 否则 `i18n.t(` 会被裸 `t(` 认走(那一族另立未判定档) */
function prefixOk(sk, idx) {
  const prev = sk[idx - 1]
  return prev === undefined || !/[\w$.]/.test(prev)
}

/** 字符串字面量 → 键值;非字面量 / 含转义 → null(不猜)。空串照实返回,由 addLit 那侧不当它是键 */
function literalValue(masked, start, end) {
  const raw = masked.slice(start, Math.min(end, masked.length)).trim()
  const m = /^'([^']*)'$/.exec(raw) || /^"([^"]*)"$/.exec(raw)
  return m && !m[1].includes('\\') ? m[1] : null
}

/** 三元在深度 0 上拆 `A ? B : C`;不是三元返回 null */
function splitTernary(sk, start, end) {
  let depth = 0
  let q = -1
  let colon = -1
  for (let i = start; i < end; i++) {
    const c = sk[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') depth -= 1
    else if (c === '?' && depth === 0 && q < 0) q = i
    else if (c === ':' && depth === 0 && q >= 0 && colon < 0) colon = i
  }
  if (q < 0 || colon < 0) return null
  return { b: { start: q + 1, end: colon }, c: { start: colon + 1, end } }
}

/**
 * 表达式分类 —— 只认四种可证明的形态,余下一律 `other`(由调用方落成未判定):
 *  - `literal` 单个字符串字面量
 *  - `ident`   单个标识符(值要去作用域里查)
 *  - `union`   `cond ? 'a.b' : 'c.d'` / `cond ? a : b` 这种**选键**写法(分支各自仍是上两类)
 *  - `other`   拼接 / 模板 / 成员访问 / 函数调用 / 空
 */
function classify(masked, sk, start, end) {
  const raw = masked.slice(start, Math.min(end, masked.length)).trim()
  const shape = sk.slice(start, Math.min(end, masked.length)).trim()
  if (!raw) return { kind: 'empty', text: '' }
  const lit = literalValue(masked, start, end)
  if (lit !== null) return { kind: 'literal', value: lit }
  if (IDENT_ONLY.test(shape)) return { kind: 'ident', name: raw }
  const ter = splitTernary(sk, start, end)
  if (ter) {
    const branches = []
    for (const p of [ter.b, ter.c]) {
      const v = literalValue(masked, p.start, p.end)
      const shapeB = sk.slice(p.start, p.end).trim()
      if (v !== null) branches.push({ kind: 'literal', value: v })
      else if (IDENT_ONLY.test(shapeB))
        branches.push({ kind: 'ident', name: masked.slice(p.start, p.end).trim() })
      else return { kind: 'other', text: raw }
    }
    return { kind: 'union', branches }
  }
  return { kind: 'other', text: raw }
}

/** 函数体区间:块体 `{…}` 走配平;表达式体扫到深度 0 的 `,` / `;` 或闭掉外层调用的 `)` */
function bodyRange(sk, afterHeader) {
  let i = afterHeader
  while (i < sk.length && /\s/.test(sk[i])) i += 1
  if (i >= sk.length) return null
  if (sk[i] === '{') {
    const close = matchBracket(sk, i)
    return close < 0 ? null : { start: i, end: close }
  }
  let depth = 0
  for (let j = i; j < sk.length; j++) {
    const c = sk[j]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return { start: i, end: j }
      depth -= 1
    } else if (depth === 0 && (c === ';' || c === ',')) return { start: i, end: j }
  }
  return null
}

/**
 * 从 `from` 起跳过空白与返回类型标注,找到函数体的 `{` 并配平。
 * 途中撞到 `;` / `)` 说明这一支不是定义体 ⇒ null(定不出来 ⇒ 交调用方落未判定)。
 */
function blockBodyAt(sk, from) {
  let depth = 0
  for (let i = from; i < sk.length; i++) {
    const c = sk[i]
    if (c === '{') {
      if (depth !== 0) return null
      const close = matchBracket(sk, i)
      return close < 0 ? null : { start: i, end: close }
    }
    if (c === ';' || c === ')') return null
    if (c === '(' || c === '[') depth += 1
    else if (c === ']') depth -= 1
  }
  return null
}

/**
 * 参数表 → 按位置的形参名数组。解构 / 默认值 / 剩余参数 ⇒ 该位记 null
 * (取不到名字就不 assigning,流经它的那一支会落未判定)。
 */
function parseParams(paramText) {
  const out = []
  let depth = 0
  let cur = ''
  const push = () => {
    const piece = cur.trim()
    cur = ''
    if (!piece) return
    const bare = piece.replace(/^@\w+(\([^)]*\))?\s*/, '').replace(/\?\s*$/, '')
    if (/^\.\.\./.test(bare) || /[{}]/.test(bare) || /=/.test(bare)) out.push(null)
    else if (/^[\w$]+$/.test(bare.split(':')[0])) out.push(bare.split(':')[0])
    else out.push(null)
  }
  for (const c of paramText) {
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') depth -= 1
    if (c === ',' && depth === 0) push()
    else cur += c
  }
  if (cur.trim()) push()
  return out
}

/**
 * 键流追踪主入口。
 *
 * @param {string} src        源码全文 —— 由调用方按**判定面**取好,本模块不碰 git 也不碰磁盘
 * @param {string[]} varNames 翻译函数变量名清单(如 `['t']` / `['t','tc']`)
 * @returns {{keys: object[], undetermined: object[]}}
 *  - `keys[]` = `{ key, varName, line, via }` —— 流进 `varName(…)` 的键;`via` 是流向简述
 *  - `undetermined[]` = `{ kind, varName, line, snippet, why }` —— 逐条点名,kind 是封闭集:
 *    sink-dynamic-arg / sink-unresolved / sink-no-source / sink-member-access /
 *    setter-dynamic / setter-unresolved / flow-dynamic-value / ambiguous-binding /
 *    body-unresolved
 */
export function traceKeyFlow(src, varNames = []) {
  const keys = []
  const undetermined = []
  const pending = [] // 候选缺口:只有"流得进某个汇点"的那些才升为未判定
  if (typeof src !== 'string' || !src || varNames.length === 0) return { keys, undetermined }

  const masked = maskComments(src) // 注释没了,字符串留着(要找的键就住在串里)
  const sk = blankStrings(masked) // 再清掉字面量体,只喂结构分析;与 masked 下标逐位对齐
  // 模块层(不落在任何具名函数体内)的绑定去重表 —— 必须每次调用各有一份,放闭包里而不是模块顶层
  const varBindingsTop = new Map()
  if (!varNames.some((v) => new RegExp(`\\b${escapeRe(v)}\\s*\\(`).test(sk)))
    return { keys, undetermined }

  const literals = new Map() // location -> Set<key>
  const edges = new Map() // location -> Set<location>(源值流入目标)
  const addLit = (loc, v) => {
    if (!v) return // 空串不是键(`setNotice('')` 是"清空提示",不是"用了一个空键名")
    if (!literals.has(loc)) literals.set(loc, new Set())
    literals.get(loc).add(v)
  }
  const addEdge = (from, to) => {
    if (!edges.has(from)) edges.set(from, new Set())
    edges.get(from).add(to)
  }

  // ── 1. useState 解构:读数名 ↔ 写入器名 ─────────────────────────────
  const stateReaders = new Set()
  const setterToReader = new Map()
  let m
  for (const { reader, sink } of deriveStatePairs(sk)) {
    stateReaders.add(reader)
    setterToReader.set(sink, reader)
  }

  // ── 2. 函数清单(具名):名字 / 形参位 / 体区间 / 头部区间 ────────────────
  // 头部找法刻意不用"一条正则吃到底":`NAME = React.useCallback((key) => …` 的实参表
  // 外面还套着一层调用括号,`\(([^()]*)\)` 这种朴素写法一定失配(实测失配的就是票面那 4 个键)。
  // 所以先锚 `=>`,再反向配出它的实参表,最后回看它绑定在哪个 `const NAME =` 上。
  const fns = []
  const fnByName = new Map()
  const dupFnLines = new Map() // 同名两处定义的函数名 -> 第二处行号(仅当它真的连着汇点才升为未判定)
  const reBinding = new RegExp(`(?:const|let|var)\\s+(${IDENT_SRC})\\s*=`, 'g')
  const bindings = []
  while ((m = reBinding.exec(sk)) !== null) {
    if (!prefixOk(sk, m.index)) continue
    bindings.push({ name: m[1], at: m.index, eqEnd: reBinding.lastIndex })
  }
  const reArrowTok = /=>/g
  const arrowHeads = []
  while ((m = reArrowTok.exec(sk)) !== null) {
    const opAt = m.index
    let j = opAt - 1
    while (j >= 0 && /\s/.test(sk[j])) j -= 1
    let paramText = ''
    let headerStart = -1
    if (sk[j] === ')') {
      const open = backMatch(sk, j)
      if (open < 0) continue
      headerStart = open
      paramText = sk.slice(open + 1, j)
    } else {
      // 无括号单形参:`key => …`;往前读一个标识符
      let k = j
      while (k >= 0 && /[\w$]/.test(sk[k])) k -= 1
      const ident = sk.slice(k + 1, j + 1)
      if (!IDENT_ONLY.test(ident)) continue
      headerStart = k + 1
      paramText = ident
    }
    // 绑定名:箭头函数只有在"直接是某个 `const NAME =` 的初值"时才认。
    // 中间只许两类:`NAME = (p) =>`(裸箭头)与 `NAME = X.useCallback((p) =>`(把箭头当第一个
    // 实参传进去的高阶包装)。刻意**不**放宽成"回看最近一个 const"——实测
    // `const columnCount = rows.reduce((max, row) => …)` 会被那样误绑成名为 columnCount 的函数,
    // 于是 .map/.reduce 的回调形参全都成了可调用体的"函数参数",噪声盖过真流向。
    let bound = null
    for (let bi = bindings.length - 1; bi >= 0; bi--) {
      if (bindings[bi].eqEnd > headerStart) continue
      const between = sk.slice(bindings[bi].eqEnd, headerStart).trim()
      const bare = between === ''
      const wrapped = /^(?:[\w$.]*\.)?(?:useCallback|useMemo)\($/.test(between)
      if (bare || wrapped) bound = bindings[bi].name
      break // 只认最近的那个绑定:它都不合格就不是绑定初值,再往前找会把别条语句的变量名算进来
    }
    arrowHeads.push({ bound, headerStart, opEnd: opAt + 2, paramText, at: headerStart })
  }
  for (const h of arrowHeads) {
    if (!h.bound) continue
    fns.push({
      name: h.bound,
      params: parseParams(h.paramText),
      body: bodyRange(sk, h.opEnd),
      headerRange: [h.at, h.opEnd],
    })
  }
  const reDecl = new RegExp(`\\bfunction\\s+(${IDENT_SRC})\\s*\\(`, 'g')
  while ((m = reDecl.exec(sk)) !== null) {
    if (!prefixOk(sk, m.index)) continue
    const open = reDecl.lastIndex - 1
    const close = matchBracket(sk, open)
    if (close < 0) continue
    const block = blockBodyAt(sk, close + 1)
    fns.push({
      name: m[1],
      params: parseParams(sk.slice(open + 1, close)),
      body: block,
      headerRange: [m.index, close],
    })
  }
  for (const f of fns) {
    if (fnByName.has(f.name)) {
      fnByName.get(f.name).dup = true
      f.dup = true
      dupFnLines.set(f.name, lineOf(sk, f.headerRange[0]))
    } else fnByName.set(f.name, f)
  }

  /** 包含 idx 的具名函数体,里层 → 外层 */
  const ctxChainAt = (idx) =>
    fns
      .filter((f) => f.body && idx >= f.body.start && idx <= f.body.end)
      .sort((a, b) => b.body.start - a.body.start)
  /** 这条语句是不是某个具名函数的**定义头部**(定义行不像调用点) */
  const inHeaderOf = (idx) => fns.some((f) => f.headerRange && idx >= f.headerRange[0] && idx < f.headerRange[1])
  /** 绑定名所在的作用域所有者:最近的具名函数,没有就是模块层(null) */
  const ownerOf = (idx) => ctxChainAt(idx)[0] || null

  // ── 3. 汇点:`varName(<标识符>)` / `varName(三元)`;字面量档留给既有判据 ──────
  const sinkSites = []
  for (const v of varNames) {
    const re = new RegExp(`\\b${escapeRe(v)}(?:\\.(?:${T_MEMBERS}))?\\s*\\(`, 'g')
    let k
    while ((k = re.exec(sk)) !== null) {
      if (!prefixOk(sk, k.index)) continue
      if (inHeaderOf(k.index)) continue
      const open = re.lastIndex - 1
      const { args, ok } = splitArgs(sk, open)
      if (!args.length) continue
      const cls = classify(masked, sk, args[0].start, args[0].end)
      const line = lineOf(sk, k.index)
      const snippet = snippetOf(masked, k.index, args[0].end + 1)
      if (cls.kind === 'literal') continue
      if (!ok) {
        undetermined.push({
          kind: 'body-unresolved',
          varName: v,
          line,
          snippet,
          why: `${v}(...) 括号配不平 ⇒ 取不到实参,不记为"该处无键"`,
        })
        continue
      }
      if (cls.kind === 'ident' || cls.kind === 'union')
        sinkSites.push({ varName: v, cls, at: k.index, line, snippet })
      else
        undetermined.push({
          kind: 'sink-dynamic-arg',
          varName: v,
          line,
          snippet,
          why: `${v}(...) 的实参是动态值(${cls.text || cls.kind})⇒ 键名无法在本文件静态确定`,
        })
    }
    // `obj.t(key)` 这一族:函数挂在对象上,命名空间归属与键流都判不了 ⇒ 另立一档逐条点名
    const reMember = new RegExp(`\\.\\s*${escapeRe(v)}(?:\\.(?:${T_MEMBERS}))?\\s*\\(`, 'g')
    while ((k = reMember.exec(sk)) !== null) {
      const open = reMember.lastIndex - 1
      const { args } = splitArgs(sk, open)
      if (!args.length) continue
      if (literalValue(masked, args[0].start, args[0].end) !== null) continue // 字面量仍由既有判据管
      undetermined.push({
        kind: 'sink-member-access',
        varName: v,
        line: lineOf(sk, k.index),
        snippet: snippetOf(masked, Math.max(0, k.index - 14), args[0].end + 1),
        why: `${v} 以成员形式调用(如 obj.${v}(…))⇒ 这一处的键流与命名空间都判不了`,
      })
    }
  }

  // ── 4. 来源:局部绑定 / 写入器 / helper 调用点 ─────────────────────────
  const bindingOwner = new Map() // "ownerKey::name" -> binding site
  const varLoc = (name, owner) => `${owner ? `${owner.name}::` : ''}var:${name}`
  for (const b of bindings) {
    if (b.eqEnd >= sk.length) continue
    const { args, ok } = exprExtent(sk, b.eqEnd)
    if (!ok) continue
    const owner = ownerOf(b.at)
    const loc = varLoc(b.name, owner)
    if (owner) {
      const key = `${owner.name}::${b.name}`
      if (bindingOwner.has(key)) {
        undetermined.push({
          kind: 'ambiguous-binding',
          varName: varNames.join('/'),
          line: lineOf(sk, b.at),
          snippet: b.name,
          why: `同一作用域内 ${b.name} 被两次声明 ⇒ 后者覆盖前者,键集不合并`,
        })
        continue
      }
      bindingOwner.set(key, b)
    } else {
      if (varBindingsTop.has(b.name)) continue
      varBindingsTop.set(b.name, b)
    }
    const cls = classify(masked, sk, args.start, args.end)
    if (cls.kind === 'literal') addLit(loc, cls.value)
    else if (cls.kind === 'ident' && cls.name !== b.name) {
      const from = resolveLoc(cls.name, ctxChainAt(b.at))
      if (from) addEdge(from, loc)
    } else if (cls.kind === 'union') {
      for (const br of cls.branches) {
        if (br.kind === 'literal') addLit(loc, br.value)
        else {
          const from = resolveLoc(br.name, ctxChainAt(b.at))
          if (from) addEdge(from, loc)
        }
      }
    }
  }

  /** 标识符 → location:最近的函数形参 → useState 读数 → 同/外层作用域的 var 绑定 */
  function resolveLoc(name, chain) {
    if (!name) return null
    for (const f of chain) {
      const i = f.params.indexOf(name)
      if (i >= 0 && f.params[i] !== null) return `param:${f.name}#${i}`
    }
    if (stateReaders.has(name)) return `state:${name}`
    for (const f of chain) if (bindingOwner.has(`${f.name}::${name}`)) return varLoc(name, f)
    if (varBindingsTop.has(name)) return varLoc(name, null)
    return null
  }

  for (const [setter, reader] of setterToReader) {
    const re = new RegExp(`\\b${escapeRe(setter)}\\s*\\(`, 'g')
    let k
    while ((k = re.exec(sk)) !== null) {
      if (!prefixOk(sk, k.index) || inHeaderOf(k.index)) continue
      const open = re.lastIndex - 1
      const { args, ok } = splitArgs(sk, open)
      if (!args.length) continue
      const cls = classify(masked, sk, args[0].start, args[0].end)
      const to = `state:${reader}`
      const line = lineOf(sk, k.index)
      const snippet = snippetOf(masked, k.index, args[0].end + 1)
      if (cls.kind === 'literal') addLit(to, cls.value)
      else if (cls.kind === 'ident') {
        const from = resolveLoc(cls.name, ctxChainAt(k.index))
        if (from) addEdge(from, to)
        else
          pending.push({
            kind: 'setter-unresolved',
            target: to,
            line,
            snippet,
            why: `${setter}(…) 的实参 ${cls.name} 在当前作用域查不到来源 ⇒ 该 state 的键集不完整`,
          })
      } else if (cls.kind === 'union') {
        for (const br of cls.branches) {
          if (br.kind === 'literal') addLit(to, br.value)
          else {
            const from = resolveLoc(br.name, ctxChainAt(k.index))
            if (from) addEdge(from, to)
          }
        }
      } else if (ok)
        pending.push({
          kind: 'setter-dynamic',
          target: to,
          line,
          snippet,
          why: `${setter}(...) 的实参是动态值(${cls.text || cls.kind}),键名可能是拼接/模板 ⇒ 未判定`,
        })
      else
        pending.push({ kind: 'body-unresolved', target: to, line, snippet, why: `${setter}(...) 括号配不平` })
    }
  }

  for (const [name, fn] of fnByName) {
    if (fn.dup) continue
    const re = new RegExp(`\\b${escapeRe(name)}\\s*\\(`, 'g')
    let k
    while ((k = re.exec(sk)) !== null) {
      if (!prefixOk(sk, k.index)) continue
      if (fn.headerRange && k.index >= fn.headerRange[0] && k.index < fn.headerRange[1] + 1) continue
      const open = re.lastIndex - 1
      const { args, ok } = splitArgs(sk, open)
      if (!args.length) continue
      args.forEach((a, i) => {
        if (i >= fn.params.length || fn.params[i] === undefined) return
        const cls = classify(masked, sk, a.start, a.end)
        const to = `param:${name}#${i}`
        const line = lineOf(sk, k.index)
        const snippet = snippetOf(masked, k.index, a.end + 1)
        if (cls.kind === 'literal') addLit(to, cls.value)
        else if (cls.kind === 'ident') {
          const from = resolveLoc(cls.name, ctxChainAt(k.index))
          if (from) addEdge(from, to)
        } else if (cls.kind === 'union') {
          for (const br of cls.branches) {
            if (br.kind === 'literal') addLit(to, br.value)
            else {
              const from = resolveLoc(br.name, ctxChainAt(k.index))
              if (from) addEdge(from, to)
            }
          }
        } else if (ok && fn.params[i] !== null)
          pending.push({
            kind: 'flow-dynamic-value',
            target: to,
            line,
            snippet,
            why: `调用 ${name}(...) 第 ${i + 1} 个实参是动态值(${cls.text || cls.kind})⇒ 该形参承载的键名不完整`,
          })
      })
    }
  }

  // ── 5. 汇点定位(必须在绑定收齐之后再解析,否则模块层 var 会查不到)────────
  for (const s of sinkSites) {
    const chain = ctxChainAt(s.at)
    const locs = []
    const inline = new Set()
    const unresolved = []
    const collect = (br) => {
      if (br.kind === 'literal') inline.add(br.value)
      else {
        const l = resolveLoc(br.name, chain)
        if (l) locs.push(l)
        else unresolved.push(br.name)
      }
    }
    if (s.cls.kind === 'union') s.cls.branches.forEach(collect)
    else collect(s.cls)
    if (locs.length === 0 && inline.size === 0) {
      // 三元分支查不到来源 ⇒ 点名是哪一支;单个标识符查不到 ⇒ 它就是"键名来自本文件之外"
      undetermined.push({
        kind: 'sink-unresolved',
        varName: s.varName,
        line: s.line,
        snippet: s.snippet,
        why:
          s.cls.kind === 'union'
            ? `${s.varName}(...) 的分支 ${unresolved.join(' / ')} 在本文件内解析不到来源 ⇒ 键集不完整`
            : `${s.varName}(...) 的实参 ${unresolved.join('') || '(空)'} 在本文件内解析不到来源(多为 props / 外部入参)⇒ 该组件真实消费的键集无法在本文件判定`,
      })
      continue
    }
    const found = new Set(inline)
    for (const l of locs) for (const v of literals.get(l) || []) found.add(v)
    if (found.size === 0 && !locs.some((l) => edges.has(l) || literals.has(l))) {
      undetermined.push({
        kind: 'sink-no-source',
        varName: s.varName,
        line: s.line,
        snippet: s.snippet,
        why: `${s.varName}(...) 取自 ${locs.join(', ')},而它在本文件内没有任何赋值来源 ⇒ 未判定,不记为"该处无键"`,
      })
    }
    for (const key of found) keys.push({ key, varName: s.varName, line: s.line, via: locs.join('|') || 'inline' })
  }

  // ── 6. 只把"流得进汇点"的缺口升为未判定 ──────────────────────────────
  const sinkLocations = new Set()
  for (const s of sinkSites) {
    const chain = ctxChainAt(s.at)
    const one = (br) => {
      if (br.kind === 'ident') {
        const l = resolveLoc(br.name, chain)
        if (l) sinkLocations.add(l)
      }
    }
    if (s.cls.kind === 'union') s.cls.branches.forEach(one)
    else one(s.cls)
  }
  const reachesSink = (loc, seen = new Set()) => {
    if (seen.has(loc)) return false
    seen.add(loc)
    if (sinkLocations.has(loc)) return true
    for (const to of edges.get(loc) || []) if (reachesSink(to, seen)) return true
    return false
  }
  for (const p of pending) {
    if (!reachesSink(p.target)) continue
    if (undetermined.some((u) => u.kind === p.kind && u.line === p.line)) continue
    undetermined.push({ kind: p.kind, varName: varNames.join('/'), line: p.line, snippet: p.snippet, why: p.why })
  }
  // 同名两处定义:只有在它确实接着某个汇点时才点名(否则两个无关组件重名也会刷未判定)。
  // 认不出哪一处被调用 = 不合并两处的键集 = 这一档没判完,如实报出而不是挑一个猜。
  for (const [name, line] of dupFnLines) {
    const tied =
      [...sinkLocations].some((l) => l.startsWith(`param:${name}#`)) ||
      [...edges.values()].some((set) => [...set].some((t) => t.startsWith(`param:${name}#`))) ||
      [...literals.keys()].some((l) => l.startsWith(`param:${name}#`))
    if (!tied) continue
    undetermined.push({
      kind: 'ambiguous-binding',
      varName: varNames.join('/'),
      line,
      snippet: name,
      why: `${name} 在本文件有两处同名定义 ⇒ 调用点实参归属不唯一,两处的键集不合并`,
    })
  }
  return { keys, undetermined }
}

// 表达式范围:from 起扫到深度 0 的 `,` / `;` 或把外层调用闭掉的 `)`
function exprExtent(sk, from) {
  let depth = 0
  for (let i = from; i < sk.length; i++) {
    const c = sk[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return { args: { start: from, end: i }, ok: true }
      depth -= 1
    } else if (depth === 0 && (c === ',' || c === ';')) return { args: { start: from, end: i }, ok: true }
  }
  return { args: { start: from, end: sk.length }, ok: false }
}

/** 镜像测试用出口(§22c:判据只能有一份,测试必须 import 它而不是再抄一份) */
export const __test__ = { traceKeyFlow, deriveStatePairs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
