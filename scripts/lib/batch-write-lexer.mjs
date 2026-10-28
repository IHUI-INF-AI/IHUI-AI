// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批量写计数诚实性守门(门 134)的**词法层**:遮蔽噪声(字符串/注释/正则字面量)、括号配对、
 * 写链与函数体定位、确认态回溯。判据本体留在 `scripts/check-batch-write-count-honesty.mjs`。
 *
 * 为什么拆出来:门 103 的 C1 单文件行上限 6000 点名门体 6116 行。这一层是纯文本工具,与
 * 「批没批够数」这条业务判据本来就不是一件事,切开既是消红也是归位 —— 不是为凑数搬家:
 * 搬走的 459 行里没有一个字符被改写,台面仍按同一批符号判定(镜像测试与 --self-test 同批复跑)。
 * 取用面只有一份:门体 import 本文件,禁止再抄第二份扫描器(§0.6 单一真相源)。
 */

export const WRITE_RECEIVERS = new Set(['db', 'tx', 'trx'])
/* ------------------------------- 词法遮噪 ------------------------------- */

/**
 * 剥注释(两档都剥);`blankStrings` 档另把字符串/模板字面量的内容与引号抹成空格。
 * 逐字符保位(换行原样),所以"遮蔽后的下标"仍能映射回原始行号 —— 行内豁免要吃原始行,靠这一点。
 * 为什么这一档要抹字符串:被抹掉的 token(inArray(、deleted: x.length)没有一个会合法地出现在
 * 字符串里;反过来保留字符串,一句 OpenAPI 描述就会替门产出一个"从字符串里 harvest 出来的假用量"
 * (守门 93 R6 正是栽在这一格)。唯一反例是 E2 的模块说明符 —— 它必须在字符串里才读得到。
 * 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
 * (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
 * @returns {{text:string, leaks:string[]}} leaks 非空 ⇒ 状态机没走干净(见 U2)
 */
export function maskText(src, { blankStrings = true } = {}) {
  const n = src.length
  const kill = new Uint8Array(n)
  const K = (i) => {
    if (blankStrings) kill[i] = 1
  }
  const stack = [{ kind: 'root', depth: 0 }]
  const leaks = []
  let lastSig = '' // 上一个有意义的代码字符:判 `/` 是除法还是正则开头
  let word = ''
  let i = 0
  while (i < n) {
    const top = stack[stack.length - 1]
    const c = src[i]
    const d = src[i + 1]
    if (top.kind === 'tpl') {
      if (c === '\\') {
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      if (c === '`') {
        stack.pop()
        K(i)
        lastSig = '`'
        i++
        continue
      }
      if (c === '$' && d === '{') {
        stack.push({ kind: 'interp', depth: 1 })
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      K(i)
      i++
      continue
    }
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') kill[j++] = 1
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) kill[j++] = 1
      if (j < n) {
        kill[j] = 1
        kill[j + 1] = 1
        i = j + 2
      } else {
        leaks.push('块注释未闭合')
        i = n
      }
      continue
    }
    // 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
    // (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
    if (c === '/' && regexMayStartHere(lastSig, word)) {
      const end = scanRegexLiteral(src, i)
      if (end > 0) {
        for (let j = i; j < end; j++) K(j)
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (src[j] === '\\') {
          K(j)
          K(j + 1)
          j += 2
          continue
        }
        if (src[j] === '\n') break
        if (src[j] === c) {
          closed = true
          break
        }
        K(j)
        j++
      }
      if (closed) {
        K(i)
        K(j)
        lastSig = c
        i = j + 1
      } else {
        leaks.push(`第 ${lineAt(src, i)} 行的 ${c} 未闭合(疑正则字面量)`)
        i = j
      }
      continue
    }
    if (c === '`') {
      stack.push({ kind: 'tpl', depth: 0 })
      K(i)
      i++
      continue
    }
    if (top.kind === 'interp') {
      if (c === '{') top.depth++
      else if (c === '}') {
        top.depth--
        if (top.depth === 0) {
          stack.pop()
          K(i)
          i++
          continue
        }
      }
    }
    if (!/\s/.test(c)) {
      lastSig = c
      word = /[\w$]/.test(c) ? (word + c).slice(-12) : ''
    }
    i++
  }
  if (stack.length > 1) leaks.push(`模板/插值嵌套未收平(残留 ${stack.length - 1} 层)`)
  let out = ''
  for (let k = 0; k < n; k++) {
    const ch = src[k]
    out += kill[k] && ch !== '\n' && ch !== '\r' ? ' ' : ch
  }
  return { text: out, leaks }
}

export function lineAt(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '>',
  '<',
  '+',
  '*',
  '%',
  '^',
  '~',
  '',
])
const REGEX_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'do',
  'else',
  'yield',
  'await',
  'delete',
  'void',
])
function regexMayStartHere(lastSig, word) {
  return REGEX_WORDS.has(word) || lastSig === '' || REGEX_AFTER.has(lastSig)
}

/** 扫一个正则字面量(含字符类里的 `/` 与尾随 flag)。本行没有收尾的 `/` ⇒ 返回 -1,按普通字符走。 */
function scanRegexLiteral(src, i) {
  let j = i + 1
  let inClass = false
  let body = ''
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      body += 'x'
      j += 2
      continue
    }
    if (c === '\n') return -1
    if (inClass) {
      if (c === ']') inClass = false
      body += c
      j++
      continue
    }
    if (c === '[') {
      inClass = true
      body += c
      j++
      continue
    }
    if (c === '/') {
      if (!body) return -1 // 空的 `//` 已在注释分支处理;`a / /` 之类不是正则
      let k = j + 1
      while (k < src.length && /[a-z]/i.test(src[k])) k++
      return k
    }
    body += c
    j++
  }
  return -1
}

/* ------------------------------- 结构扫描 ------------------------------- */

function closePair(src, openIdx, o, c) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c && --depth === 0) return i + 1
  }
  return -1
}
export const closeParen = (s, i) => closePair(s, i, '(', ')')
export const closeBrace = (s, i) => closePair(s, i, '{', '}')

/**
 * `db|tx|trx` 发起的 `.delete(` / `.update(` 调用链(逐链走括号,不按行切 —— 跨行写法实测存在)。
 * 接收者白名单是防误伤的第一道:实测 HEAD 面 `*.delete(` 里路由注册(server.delete)387 处、
 * Map/Set 的 .delete 上百处,远多于 `db.delete(` 242 处 —— 不认接收者就等于把路由注册当违规数。
 * 链上必须有 `.where(`(裸 `db.delete(table)` 全表删除不属本型);`opaque` 那支承认自己分不清。
 */
export function findWriteChains(code) {
  const out = []
  const re = /\.(delete|update)\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !WRITE_RECEIVERS.has(rec[1])) continue
    const end0 = closeParen(code, code.indexOf('(', m.index))
    if (end0 < 0) continue
    const links = [{ name: m[1], text: code.slice(m.index + m[0].length, end0 - 1) }]
    let cur = end0
    for (;;) {
      const cm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(cur, cur + 80))
      if (!cm) break
      const open = cur + cm[0].length - 1
      const cend = closeParen(code, open)
      if (cend < 0) break
      links.push({ name: cm[1], text: code.slice(open + 1, cend - 1) })
      cur = cend
    }
    const whereLink = links.find((l) => l.name === 'where')
    const setLink = links.find((l) => l.name === 'set')
    // B7(G-815984)的取材:returning 实参原文 —— 与 whereText/setText 同源同批(links 只此一份,
    // B7 不二次扫描,§22c)。
    const returningLink = links.find((l) => l.name === 'returning')
    out.push({
      start: m.index,
      end: cur,
      receiver: rec[1],
      names: links.map((l) => l.name),
      hasWhere: links.some((l) => l.name === 'where'),
      hasInArray: links.some((l) => /\binArray\s*\(/.test(l.text)),
      hasReturning: links.some((l) => l.name === 'returning'),
      opaque: links.some((l) => /=>|\bfunction\b/.test(l.text)),
      // B3/B4(G-815953/G-815956)的取材:where/set 各自的实参原文(遮蔽面上的)。
      // 与 hasWhere/hasReturning 同源 —— links 只此一份,不存在第二份链扫描(§22c)。
      whereText: whereLink ? whereLink.text : '',
      setText: setLink ? setLink.text : '',
      returningText: returningLink ? returningLink.text : '',
    })
  }
  return out
}

/**
 * 函数体 = `=>` 后紧跟 `{`,或 `function` 头部之后的第一个顶层 `{`。
 * 为什么必须是函数体而不是"任意最小花括号块":取"同时包住链与 send 的最小块"会让兄弟 handler
 * 互相借链(A 里的链替 B 里的 send 定罪)—— 那等于把判据建立在花括号几何上。
 */
export function findFunctionBodies(code) {
  const bodies = []
  const push = (b) => {
    if (b >= 0 && code[b] === '{') {
      const end = closeBrace(code, b)
      if (end > 0) bodies.push({ start: b, end })
    }
  }
  let m
  const arrow = /=>/g
  while ((m = arrow.exec(code)) !== null) {
    const rest = /^\s*\{/.exec(code.slice(m.index + 2, m.index + 12))
    if (rest) push(m.index + 2 + rest[0].length - 1)
  }
  const fn = /\bfunction\b/g
  while ((m = fn.exec(code)) !== null) {
    let i = m.index + 8
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== '}') i++
    push(i)
  }
  return bodies
}

export function enclosingBody(bodies, idx) {
  let best = null
  for (const b of bodies)
    if (idx >= b.start && idx < b.end && (!best || b.start > best.start)) best = b
  return best
}

export const DB_CONFIRMED_RE =
  /\.(?:returning|select|execute|insert|update|delete)\s*\(|\bawait\s+[\w$.]*\bdb\b|dbRead|dbWrite/
const CONTINUE_CHARS = new Set([
  '.',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '?',
  ':',
  ')',
  '}',
  ']',
  '=',
  '<',
  '>',
  '`',
])
const NOT_IDENT = new Set([
  'const',
  'let',
  'var',
  'await',
  'async',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'new',
  'map',
  'filter',
  'from',
  'where',
  'and',
  'or',
  'eq',
  'inArray',
  'set',
  'then',
  'length',
  'ids',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Date',
  'size',
  'join',
  'split',
  'includes',
  'some',
  'every',
  'push',
])

/** 语句结尾:深度 0 处的 `;`,或深度 0 处换行且下一行不是续行。 */
export function statementEnd(code, from, limit) {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const c = code[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth > 0) depth--
    } else if (c === ';' && depth === 0) return i
    else if (c === '\n' && depth === 0) {
      let k = i + 1
      while (k < limit && /\s/.test(code[k])) k++
      if (k >= limit || !CONTINUE_CHARS.has(code[k])) return i
    }
  }
  return limit
}

function initializersOf(code, span, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g')
  const out = []
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    const end = statementEnd(code, eq + 1, span.end)
    out.push({ text: code.slice(eq + 1, end), start: eq + 1, end })
  }
  return out
}

/**
 * E1b:计数根标识符是否可追到库确认的集合(≤2 跳)。查不到声明 ⇒ 不放过(参数/请求侧解构都是这种)。
 * `scope`(可选,只有计数判据传 `{chain, chains}`):初始化式若来自**另一条**写链的返回值,那是那条
 * 调用自己的证据,不替被审这条发合格证(2026-10-24 F1 收窄 —— 证据以被审的写调用为单位)。
 */
export function resolveConfirmed(code, span, name, depth, scope = null) {
  if (depth > 2) return false
  for (const rhs of initializersOf(code, span, name)) {
    if (rhs.text.length > 4000) continue
    if (
      scope &&
      scope.chains.some(
        (c) => c.start !== scope.chain.start && c.start >= rhs.start && c.end <= rhs.end,
      )
    )
      continue
    if (DB_CONFIRMED_RE.test(rhs.text)) return true
    if (depth >= 2) continue
    for (const mm of rhs.text.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (!NOT_IDENT.has(mm[0]) && resolveConfirmed(code, span, mm[0], depth + 1, scope)) return true
    }
  }
  return false
}

/** `.send(<X>success({ … }))` 的对象字面量 —— 违规判据与两份惯例计数**共用这一遍取材**。
 *  为什么必须共用:两处各扫一遍 send 形态,一处改了另一处不会跟着改,惯例数就会和违规数说不同的话
 *  (本仓"两处算同一件事必须共用一份实现"记过多次)。 */
export function* sendSuccessObjects(code) {
  const sendRe = /\.\s*send\s*\(\s*\w*[Ss]uccess\s*\(\s*\{/g
  let m
  while ((m = sendRe.exec(code)) !== null) {
    const objOpen = code.indexOf('{', m.index + m[0].length - 1)
    const objEnd = closeBrace(code, objOpen)
    if (objEnd < 0) continue
    yield { objOpen, objText: code.slice(objOpen, objEnd) }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
