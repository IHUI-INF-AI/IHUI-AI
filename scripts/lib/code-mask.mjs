// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 代码面遮罩:把**注释与字符串**抹成等长空格(行号、列号都不变)。
//
// 为什么要有这一份,而不是各门自己写:
//  - 判据若按"原始文本"匹配字面量,就会把**解释这个判据的注释**读成违规 —— 守门 131
//    在 2026-09-26 第一次自跑就栽在这里(给 CategoryInlineBar 补一句说明,工作树读数
//    从预期 115 变 116)。门一旦开始判自己的散文,后人只能把说明删掉,判据反而更难维护。
//  - 字符串也要抹:带协议前缀的 URL 字面量里含"块注释开符"形态,只剥注释不剥字符串的
//    状态机会被带进假注释态(守门 70 实测踩过);反过来不抹字符串,一行里的引号会把
//    整行后半吞掉。
//  - 两处实现必漂移是本仓记过最多次的失败型(§3 共享层优先),所以遮罩只留这一份。
//
// 保长度是硬约束:调用方普遍按"命中行向前/向后回溯若干行"归属(守门 131/102 同型),
// 删字符会让行号错位,把判据整行抹掉更是直接失明。
//
// 已知边界:**旧导出 `maskCommentsAndStrings` 不认正则字面量**(斜杠包着孤立引号时那一行之后
// 到行尾会被当成字符串吞掉 ⇒ **漏判**)。这一型不是假想:守门 118 在 2026-09-26 实测到 HEAD 面
// **24 道门**因为它的私有遮噪器犯同一个错而被判成 no-content(归因错了一次,见该门头注)。
// 但十几道门(131/135/148/150/156 …)的读数钉在这个形态上,**改它的字节级行为 = 让那些门在
// 无人预期时换读数**,所以它被原样保留(现为 `scanSpans(text, { regex: false })` 的投影 ——
// 同一台分词器,只是关掉正则档)。
// 需要"看得见正则字面量"的那一侧请用 **`maskCommentsStringsAndRegex`**(新导出):同一台分词器、
// 同样等长,额外把正则字面量的**体**清空(正则里的 `(` 与 `'` 是模式,不是代码)。
//
// ─── 一台分词器,四个投影 ────────────────────────────────────────────────
// 词法只有一份(`scanSpans`),下面每个导出都是它在不同 span 集合上的投影:
//  - `maskCommentsAndStrings`      注释 + 字符串,正则档关 ⇒ **与历史字节级同形**(兼容面)
//  - `maskCommentsStringsAndRegex` 注释 + 字符串 + 正则体 ⇒ 需要认正则的判定面
//  - `maskComments`                只遮注释、**保留字符串**(模块说明符与 git 动词本身就是字符串)
//  - `blankStrings` / `scanLiterals`  只清字面量体、**保留注释**
// 两处实现一条规则是本仓记过最多次的漂移成因(§3 共享层优先 / §22c),所以各门**不得**再自带
// 分词器 —— 守门 118 曾留着一份"更聪明的"私有遮噪器,2026-09-28 上收到本文件作为唯一实现。

/** 判"这个 `/` 是正则还是除法"只看**上一个有效 token**:落在这些字符之后才算正则起始。 */
const REGEX_ALLOWED_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  ';',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
  '>',
  '',
])
/**
 * 关键字之后 `/` 必为正则(`return /x/`、`case '/':` 除外 —— 后者先被字符串判据接走)。
 * 只看"上一个有效字符"会把 `return /x/` 认成除法(上一字符是 `n`),那不是保守而是**看不见**;
 * 这一小张表是纯语法事实,不是豁免清单(它不描述任何被审内容,不会腐烂成"某个门在名单里")。
 */
const REGEX_ALLOWED_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
])
function isBlankish(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}
/** 纯函数(导出给镜像测试,§22c 禁止在测试里再抄一份判据):该 token 位置上 `/` 是否可为正则起始 */
export function regexCanStart(lastSig, lastWord) {
  return REGEX_ALLOWED_AFTER.has(lastSig) || REGEX_ALLOWED_KEYWORDS.has(lastWord)
}

/** 字符串字面量:从起始引号 i 走到闭合(或换行/EOF)。bodyStart..bodyEnd 是**内部**区间。 */
function readStringSpan(text, i) {
  const q = text[i]
  let j = i + 1
  let body = ''
  while (j < text.length) {
    if (text[j] === '\\') {
      body += text[j] + (text[j + 1] ?? '')
      j += 2
      continue
    }
    if (text[j] === q)
      return { bodyStart: i + 1, bodyEnd: j, end: j + 1, body, closed: true, isTemplate: q === '`' }
    // 非模板串不跨行:判到这里说明引号不成对,宁可放过也不吞掉后半份文件
    if (text[j] === '\n' && q !== '`')
      return { bodyStart: i + 1, bodyEnd: j, end: j, body, closed: false, isTemplate: false }
    body += text[j]
    j += 1
  }
  return { bodyStart: i + 1, bodyEnd: j, end: j, body, closed: false, isTemplate: q === '`' }
}

/** 正则字面量:从起始 `/` 走到闭合 `/` + flags。认不出(closed:false)由调用方按除法处理。 */
function readRegexSpan(text, i) {
  let j = i + 1
  let inClass = false
  while (j < text.length) {
    const d = text[j]
    if (d === '\n') break
    if (d === '\\') {
      j += 2
      continue
    }
    if (inClass) {
      if (d === ']') inClass = false
    } else if (d === '[') inClass = true
    else if (d === '/') {
      j += 1
      let k = j
      while (k < text.length && /[dgimsuvyx]/i.test(text[k])) k += 1
      return { bodyStart: i + 1, bodyEnd: k, end: k, closed: true }
    }
    j += 1
  }
  return { bodyStart: i + 1, bodyEnd: j, end: j, closed: false }
}

/**
 * 单遍分词:产出注释 / 字符串 / 正则三类 span(区间语义统一:`start` 含定界符,
 * `bodyStart..bodyEnd` 是需要清空或需要判定的内部区间)。
 * `//` 与块注释开栏 **无条件**当注释,不受 token 位置影响 —— JS 词法本身如此:空正则必须写成
 * `/(?:)/`,而"`/*` 再补一个斜杠"在 JS 里是未闭合的块注释而不是正则。
 * (这一句本身踩过坑:注释里逐字写出那三个字符会**提前终结本块注释**,于是说明文字变成代码。)
 * 所以注释判定不受 lastSig 影响;正则判定只在字符串之外才问。
 *
 * `opts.regex === false` 关掉正则档 ⇒ 斜杠永远按普通字符走,引号即使在正则字面量里也当字符串
 * 开头。这不是"另一种词法",而是**同一次分词去掉一个分支** —— 旧导出
 * `maskCommentsAndStrings` 的历史字节级形态正是这一档(由 corpus A/B 逐字节证明,见
 * `scripts/tests/code-mask.test.mjs` 的 M-legacy 组)。默认(不给 opts 或 `regex:true`)认正则:
 * 闭合不了的"正则"按除法处理且**什么都不清**,所以误判方向只会是"少遮"(可能多报),
 * 绝不会是"把真 token 吞掉"。
 */
export function scanSpans(text, opts = {}) {
  const useRegex = opts.regex !== false
  const spans = []
  let i = 0
  let lastSig = ''
  let lastWord = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j += 1
      spans.push({ kind: 'line', start: i, end: j, bodyStart: i, bodyEnd: j })
      i = j
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      let j = i + 2
      while (j < text.length && !text.startsWith('*/', j)) j += 1
      const end = Math.min(j + 2, text.length)
      spans.push({ kind: 'block', start: i, end, bodyStart: i, bodyEnd: end })
      i = end
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const r = readStringSpan(text, i)
      spans.push({ kind: 'string', start: i, ...r })
      i = r.end
      lastSig = c
      lastWord = ''
      continue
    }
    if (
      useRegex &&
      c === '/' &&
      regexCanStart(lastSig, lastWord) &&
      text[i + 1] !== undefined &&
      text[i + 1] !== ' '
    ) {
      const r = readRegexSpan(text, i)
      if (r.closed) {
        spans.push({ kind: 'regex', start: i, ...r })
        i = r.end
        lastSig = '/'
        lastWord = ''
        continue
      }
      // 闭合不了 ⇒ 按除法,且**不清任何东西**(宁可少遮,绝不吞掉真 token)
      i += 1
      lastSig = '/'
      lastWord = ''
      continue
    }
    if (!isBlankish(c)) {
      lastSig = c
      lastWord = /[\w$]/.test(c) ? lastWord + c : ''
    }
    i += 1
  }
  return spans
}

/** 按掩码把字面量体清空(保留引号本身与换行),用于"标识符还在、串内假调用不可见"的那一遍。 */
export function blankByMask(text, mask) {
  let out = ''
  for (let i = 0; i < text.length; i++) out += mask[i] && text[i] !== '\n' ? ' ' : text[i]
  return out
}

/**
 * 字面量掩码(遮注释之后的那一遍):产出「该字符是否在**字面量体内**」的掩码,外加字符串原文
 * (供首段白名单判据用)。正则字面量的体同样计入掩码 —— 正则里的 `readFileSync(` 是模式不是调用。
 */
export function scanLiterals(text) {
  const mask = new Uint8Array(text.length)
  const strings = []
  for (const s of scanSpans(text)) {
    if (s.kind === 'string') {
      for (let j = s.bodyStart; j < s.bodyEnd; j++) mask[j] = 1
      strings.push({
        start: s.start,
        end: s.end,
        body: s.body,
        closed: s.closed,
        isTemplate: s.isTemplate,
      })
    } else if (s.kind === 'regex') {
      for (let j = s.bodyStart; j < s.bodyEnd; j++) mask[j] = 1
    }
  }
  return { mask, strings, blanked: blankByMask(text, mask) }
}

/** 把给定 span 集合遮成等长文本(换行永远保留 —— 行号是各门回溯归属的坐标)。 */
function blankSpans(src, kinds, { regex = true } = {}) {
  const out = src.split('')
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  for (const s of scanSpans(src, { regex })) {
    if (!kinds.includes(s.kind)) continue
    // 正则只清体(定界符与 flags 留着,免得把 `/…/` 的形态本身抹成不可识别)
    if (s.kind === 'regex') blank(s.bodyStart, s.bodyEnd)
    else blank(s.start, s.end)
  }
  return out.join('')
}

/**
 * 词法扫描的**唯一一遍**(对外契约沿用 2026-09-28 那版,给守门 150 的 jsx-scope 用):
 * 返回被抹掉的区间清单,`kind` 区分注释与字符串。
 *
 * 为什么要把区间也交出去而不只交文本:调用方有时需要知道"这一段被抹是因为它是字符串,
 * 还是因为它是注释" —— JSX 扫描器要跳过字符串字面量里的 `<View`,却必须把注释抹掉后的
 * 空白当普通空白。只给一份抹平文本就得再抄一个词法器,而"两处算同一件事必漂移"是
 * 本仓记过最多次的失效型(§3 共享层优先)。
 *
 * 本函数是 `scanSpans(src, { regex: false })` 的**投影**,不是第二台机器:关掉正则档就逐字
 * 回到那版朴素走法的区间语义 —— 十几道门(131/135/148/150/156)钉着的正是它。需要认正则的
 * 判定面请改用 `maskCommentsStringsAndRegex`(同一次分词,把正则档打开)。
 *
 * @param {string} src
 * @returns {{start: number, end: number, kind: 'comment'|'string'}[]} 按 start 升序
 */
export function maskedSpans(src) {
  if (typeof src !== 'string') return []
  return scanSpans(src, { regex: false })
    .filter((s) => s.kind !== 'regex')
    .map((s) => ({ start: s.start, end: s.end, kind: s.kind === 'string' ? 'string' : 'comment' }))
}
/**
 * 兼容导出:**行为与历史逐字节同形**(正则档关闭 ⇒ 正则里的引号照旧被当字符串开头)。
 * 十几道门(131/135/148/150 …)的读数钉在这一形态上,不得换。需要认正则请改用
 * `maskCommentsStringsAndRegex`。
 *
 * @param {string} src 源码全文
 * @returns {string} 等长文本,注释与字符串内容替换为空格(换行保留)
 */
export function maskCommentsAndStrings(src) {
  if (typeof src !== 'string') return ''
  return blankSpans(src, ['line', 'block', 'string'], { regex: false })
}

/**
 * 新导出(2026-09-28,守门 118 遮噪器上收后给"需要认正则"那一侧用):
 * 遮注释 + 字符串 + **正则字面量的体**,等长、行号不漂。
 *
 * 为什么要有第二个导出而不是把上面那个改强:上面那条的字节级形态是别人的门的现读数基线
 * (改它 = 让 131/135/148/150 在无人预期时换读数);而"正则里的 `(` 也算括号"会让按括号
 * 配平取实参的判据把真调用读成"配不平"(守门 156 现读的 4 处未判定里,3 处正是这一型)。
 * 两条各服务一侧,但**分词只有一台** —— 这是"两处算同一件事必须共用一份实现"的落点。
 *
 * @param {string} src 源码全文
 * @returns {string} 等长文本:注释与字符串整段清空,正则字面量清其体(含 flags),换行保留
 */
export function maskCommentsStringsAndRegex(src) {
  if (typeof src !== 'string') return ''
  return blankSpans(src, ['line', 'block', 'string', 'regex'])
}

/**
 * 只遮注释、**保留字符串字面量**的那一层遮噪(原住在守门 118,2026-09-28 上收到此)。
 *
 * 为什么不复用 `maskCommentsAndStrings`:那一档连字符串一起抹掉(它服务的判据是"变量名/调用
 * 不能被注释或夹具字符串冒充"),而 118 那一侧要认的两样东西**本身就是字符串** ——
 * `from './lib/face-reader.mjs'` 的模块说明符,和 `['cat-file', …]` 的 git 动词。
 * 直接套连字符串一起抹的那档,结果是合规的门被读成"没导入"、散写的门被读成"没读 git"。
 * 两处判的不是同一件事,所以各有一层遮噪 —— 但**分词器只许一台**(都走 `scanSpans`)。
 */
export function maskComments(src) {
  if (typeof src !== 'string') return ''
  let out = ''
  let pos = 0
  for (const s of scanSpans(src)) {
    if (s.kind !== 'line' && s.kind !== 'block') continue
    out += src.slice(pos, s.start)
    // 行注释整段删掉(与 118 旧实现同形);块注释逐字符换空白但保住换行,列位与行号不漂
    const body = src.slice(s.start, s.end)
    out += s.kind === 'line' ? '' : body.replace(/[^\n]/g, ' ')
    pos = s.end
  }
  return out + src.slice(pos)
}

/**
 * 在文本上把**字符串与正则字面量的体**清空(保留引号/斜杠本身与换行)。
 * 用于"标识符还在、串内假调用不可见"的那一遍;必须是 `scanLiterals` 的一行投影,
 * 不得再自带一遍状态机(那台朴素机器就是 24 道门被判 no-content 的原因)。
 */
export function blankStrings(text) {
  return scanLiterals(text).blanked
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
