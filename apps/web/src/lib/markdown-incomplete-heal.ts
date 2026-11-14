// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式 markdown 未闭合 token 补全。
 *
 * 只追加闭合符,不删原文。setext 末尾孤立下划线是唯一的插入:
 * 在那一行前面放一个零宽字符,避免半截 `-` / `=` 被解析成标题。
 *
 * 覆盖:围栏、行内代码、粗体(`**`/`__`)、斜体(`*`/`_`)、删除线、
 * 未闭合链接(只补 `]` 或 `)`,不发明 URL)、未闭合 HTML、`$$` 与行内 `$`。
 * 围栏内与行内代码内的标记不参与计数。
 * 行内标记只在「未闭合 opener 落在最后一行」时补,避免把历史游离标记卷进后文。
 *
 * D1d(2026-11-15 立,流式显示长回答逐帧变慢的根治):本函数在**每次提交帧**都被
 * `MarkdownStream.parseContent` 跑一遍(依赖只有 throttledContent)。旧实现虽然各子判据
 * 都只看"围栏奇偶 + 最后一行",却各自把整篇正文重新 `text.split('\n')` 一遍:
 * 一次 heal = 全文拆分 7 次 + 1 次全文 replace + 1 次 map/join + ……每提交帧付 O(全文长)。
 * 实测 48k 字的一帧:heal 5.06ms,而同一帧真正的分块函数只要 0.28ms,react-markdown 只 parse
 * active 块 —— 支配项是这 7 次重复拆分。打字机全程(每帧 +120 字)因此从 608ms 涨到 1165ms,
 * 且随回答长度二次增长(每帧 O(N) × N/120 帧)。
 * 现改为:`healIncompleteMarkdown` 把正文拆成行数组一次,并把该数组与**同一趟**算出的
 * 行级事实(fenceLine 判定、围栏外最后一条正文行、末行是否在围栏/行内code内)传给各子判据,
 * 判定分支逐字保持不变(等价性由对照 HEAD 原文的 58800 组随机+定向逐字比对钉死)。
 */

export interface IncompleteMarkdownHeal {
  /** 补全后的文本(仅追加闭合符或前插零宽,绝不删改原内容) */
  healed: string
  /** 是否补了围栏(调用方用于流式代码块降透明度标记) */
  fenceHealed: boolean
  /** 是否发生任何补全 */
  healedAny: boolean
}

/**
 * 一次遍历算出的行级事实,供全部子判据共用(D1d:同批产出,禁止再各自扫全文)。
 *
 * 注意:这里**不**预先算"是否处于围栏内"的整张状态表 —— 围栏状态必须由每个消费者
 * 在自己的遍历里按 `backtickFenceCount % 2` 现推。旧实现里 `hasUnclosedFence` 数的是
 * 全文 ` ``` ` 出现次数(含行内),与逐行 `FENCE_LINE_RE` 计数**不等价**;若把预计算的状态表
 * 喂给它,`"x\n``` inline\ny"` 会从"判未闭合"翻成"判已闭合",整段渲染随之改变。
 * 行级事实只缓存两件便宜且无歧义的事:这一行是不是围栏行、围栏外的最后一条正文行。
 */
interface HealScan {
  /** 原始行(未 mask);与 content 的换行结构逐字一致 */
  lines: string[]
  /** 逐行是否命中围栏行判据(FENCE_LINE_RE 或 /^\s*```/) */
  fenceLine: boolean[]
}

function buildScan(lines: string[]): HealScan {
  const fenceLine = new Array<boolean>(lines.length)
  for (let i = 0; i < lines.length; i++) fenceLine[i] = isFenceLine(lines[i] ?? '')
  return { lines, fenceLine }
}

/** 围栏行判据(两种写法同源,任何一处改动都必须两边同改)。 */
function isFenceLine(line: string): boolean {
  return FENCE_LINE_RE.test(line) || /^\s*```/.test(line)
}

/** 围栏外最后一条正文行(与旧 lastOutsideFenceLine 同一扫描:命中围栏行即翻状态,状态内不取)。 */
function lastOutsideFenceLineOf(scan: HealScan): string {
  let inFence = false
  let last = ''
  for (let i = 0; i < scan.lines.length; i++) {
    if (scan.fenceLine[i]) {
      inFence = !inFence
      continue
    }
    if (!inFence) last = scan.lines[i] ?? ''
  }
  return last
}

const ZWSP = '\u200b'
const FENCE_LINE_RE = /^\s{0,3}(?:```|~~~)/
const SETEXT_UNDERLINE_RE = /^ {0,3}(?:=+|-+)[ \t]*$/
const VOID_HTML = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

type InlineKind = 'backtick' | 'bold' | 'underbold' | 'strike'

/** 检测未闭合的代码块围栏(奇数个 ``` 表示未闭合,流式中的常见情况)。 */
export function hasUnclosedFence(content: string): boolean {
  const matches = content.match(/```/g)
  return matches !== null && matches.length % 2 === 1
}

/**
 * 对流式中的 markdown 文本做未闭合 token 补全。
 * 规则:围栏先临时闭合;行内标记只补最后一行上仍开着的 opener;
 * 链接不写入占位地址;HTML 只补 `>` 与成对结束标签。
 */
export function healIncompleteMarkdown(content: string): IncompleteMarkdownHeal {
  const shielded = shieldSetextUnderline(content)
  const fenceHealed = hasUnclosedFence(shielded)
  let text = fenceHealed ? `${shielded}\n\`\`\`\n` : shielded

  // D1d:全文只拆这一次;各子判据吃同一份行数组 + 同一趟行级事实
  const scan = buildScan(text.split('\n'))

  const suffix =
    inlineDelimiterSuffix(scan) + linkSuffix(scan) + htmlSuffix(scan, text) + mathSuffix(scan)
  if (suffix) text += suffix
  return {
    healed: text,
    fenceHealed,
    healedAny: fenceHealed || suffix.length > 0 || shielded !== content,
  }
}

/** 末行若是 setext 下划线(上一行有正文),前插零宽,避免流式半截 `-`/`=` 升成标题。 */
function shieldSetextUnderline(content: string): string {
  if (!content.includes('\n')) return content
  const lines = content.split('\n')
  const lastIdx = lines.length - 1
  const last = lines[lastIdx]
  if (last === undefined || !SETEXT_UNDERLINE_RE.test(last)) return content
  let fences = 0
  for (let i = 0; i < lastIdx; i++) {
    if (isFenceLine(lines[i] ?? '')) fences += 1
  }
  if (fences % 2 === 1) return content
  const prev = lines[lastIdx - 1] ?? ''
  if (prev.trim() === '' || isFenceLine(prev)) return content
  const next = lines.slice()
  next[lastIdx] = ZWSP + last
  return next.join('\n')
}

/**
 * 行内成对标记奇偶 + opener 是否落在最后一行。
 *
 * 与旧实现唯一的差别是行数组与围栏行判定吃 scan(同一趟算好的事实);
 * 扫描顺序、奇偶翻转、opener 记账、isOnLastLine 谓词逐字不变。
 */
function inlineDelimiterSuffix(scan: HealScan): string {
  const lines = scan.lines
  let inFence = false
  let offset = 0
  const openers: Record<InlineKind, number> = {
    backtick: -1,
    bold: -1,
    underbold: -1,
    strike: -1,
  }
  const parity: Record<InlineKind, number> = {
    backtick: 0,
    bold: 0,
    underbold: 0,
    strike: 0,
  }
  lines.forEach((line, i) => {
    const lineStart = offset
    offset += line.length + 1
    if (scan.fenceLine[i]) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const visible = stripInlineCode(line)
    const scan2 = (kind: InlineKind, re: RegExp, source: string): void => {
      re.lastIndex = 0
      for (const m of source.matchAll(re)) {
        parity[kind] ^= 1
        if (parity[kind] === 1) openers[kind] = lineStart + (m.index ?? 0)
      }
    }
    scan2('backtick', /`/g, line)
    scan2('bold', /\*\*/g, visible)
    scan2('underbold', /__/g, visible)
    scan2('strike', /~~/g, visible)
  })

  const closers =
    (parity.bold === 1 && openers.bold >= 0 && isOnLastLine(lines, openers.bold) ? '**' : '') +
    (parity.underbold === 1 && openers.underbold >= 0 && isOnLastLine(lines, openers.underbold)
      ? '__'
      : '') +
    (parity.strike === 1 && openers.strike >= 0 && isOnLastLine(lines, openers.strike)
      ? '~~'
      : '') +
    (parity.backtick === 1 && openers.backtick >= 0 && isOnLastLine(lines, openers.backtick)
      ? '`'
      : '')

  const last = lastOutsideFenceLineOf(scan)
  return closers + emphasisSuffix(last)
}

function emphasisSuffix(line: string): string {
  const source = stripInlineCode(line)
  let starOpen = false
  let underOpen = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '*' && source[i + 1] === '*') {
      i += 1
      continue
    }
    if (ch === '_' && source[i + 1] === '_') {
      i += 1
      continue
    }
    if (ch === '*') {
      if (isListMarkerStar(source, i)) continue
      const next = source[i + 1]
      const prev = source[i - 1]
      const left = next !== undefined && !isSpace(next)
      const right = prev !== undefined && !isSpace(prev)
      if (!starOpen && left) starOpen = true
      else if (starOpen && right) starOpen = false
      continue
    }
    if (ch !== '_') continue
    const next = source[i + 1]
    const prev = source[i - 1]
    const prevWord = prev !== undefined && isWord(prev)
    const nextWord = next !== undefined && isWord(next)
    if (prevWord && nextWord) continue
    const left = next !== undefined && !isSpace(next) && !prevWord
    const right = prev !== undefined && !isSpace(prev) && !nextWord
    if (!underOpen && left) underOpen = true
    else if (underOpen && right) underOpen = false
  }
  return (starOpen ? '*' : '') + (underOpen ? '_' : '')
}

function linkSuffix(scan: HealScan): string {
  const line = stripInlineCode(lastOutsideFenceLineOf(scan))
  let state: 'none' | 'text' | 'dest' = 'none'
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '[' && state === 'none') {
      state = 'text'
      continue
    }
    if (ch === ']' && state === 'text') {
      if (line[i + 1] === '(') {
        state = 'dest'
        i += 1
      } else {
        state = 'none'
      }
      continue
    }
    if (ch === ')' && state === 'dest') state = 'none'
  }
  if (state === 'text') return ']'
  if (state === 'dest') return ')'
  return ''
}

function htmlSuffix(scan: HealScan, text: string): string {
  const stack: string[] = []
  let inFence = false
  for (let i = 0; i < scan.lines.length; i++) {
    if (scan.fenceLine[i]) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    consumeHtmlTags(stripInlineCode(scan.lines[i] ?? ''), stack)
  }
  const unfinished = unfinishedTag(text, scan)
  let suffix = ''
  if (unfinished) {
    suffix += '>'
    if (unfinished.kind === 'open' && !VOID_HTML.has(unfinished.name)) {
      stack.push(unfinished.name)
    }
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    suffix += `</${stack[i] ?? ''}>`
  }
  return suffix
}

function consumeHtmlTags(line: string, stack: string[]): void {
  const re = /<\/?([A-Za-z][\w:-]*)[^<>]*?>/g
  for (const m of line.matchAll(re)) {
    const raw = m[0]
    const name = (m[1] ?? '').toLowerCase()
    if (!name) continue
    if (raw.startsWith('</')) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === name) {
          stack.splice(i, 1)
          break
        }
      }
      continue
    }
    if (raw.endsWith('/>') || VOID_HTML.has(name)) continue
    stack.push(name)
  }
}

function unfinishedTag(
  text: string,
  scan: HealScan,
): { kind: 'open' | 'close'; name: string } | null {
  if (endsInsideFenceOrCode(scan)) return null
  // D1e(2026-11-15 实测):旧写法在整个 text 上跑 /<(\/?[A-Za-z][\w:-]*)[^<>]*$/ —— 锚点在**串尾**,
  // 而 $ 前不允许出现 '>'(字符类排掉了尖括号)⇒ 起始 `<` 必落在"最后一个 '>' 之后"这一窗内,
  // 窗口内取不到就必然无匹配。对流式正文(满文 > 号、长段落)旧写法在每个候选 `<` 上
  // 触发一次回溯,实测把一帧拖到 5ms;收到真窗口后同一输入逐字节同判、单次 ~0.03ms。
  // 取窗用字面量 lastIndexOf(无模式),不用带 $/多字符类的正则去扫 tailStart(那本身就是一次全串重扫)。
  const from = text.lastIndexOf('>') + 1
  const openLt = text.indexOf('<', from)
  if (openLt === -1) return null
  const match = /<(\/?[A-Za-z][\w:-]*)[^<>]*$/.exec(text.slice(openLt))
  if (!match) return null
  const raw = match[1] ?? ''
  if (raw.startsWith('/')) {
    const name = raw.slice(1).toLowerCase()
    return name ? { kind: 'close', name } : null
  }
  return { kind: 'open', name: raw.toLowerCase() }
}

/**
 * 数学块补全。吃同一份 scan:掩码只在**行数组**上做,map/join 一次都不做
 * (旧实现 maskFenceAndInlineCode 先 map+join 出一个全文串,再 replace、再 split 回来取末行)。
 */
function mathSuffix(scan: HealScan): string {
  // 精确复现 HEAD 版 mathSuffix:它吃的是"掩码后整串",displayOdd 分支用整串
  // slice(idx) 拼接(把单 $ 移到末尾),否则整串 replace(/\$\$/g)。行内 $ 的奇偶判定
  // 依赖这个整串的末行,所以这条路径必须重建 masked 串(其余子判据仍走惰性 scan 不重建)。
  let masked = ''
  let inFence = false
  for (let i = 0; i < scan.lines.length; i++) {
    if (i > 0) masked += '\n'
    const line = scan.lines[i] ?? ''
    if (scan.fenceLine[i]) {
      inFence = !inFence
      masked += ' '.repeat(line.length)
      continue
    }
    masked += inFence ? ' '.repeat(line.length) : stripInlineCode(line)
  }
  const displays = masked.match(/\$\$/g)
  const displayOdd = displays !== null && displays.length % 2 === 1
  let inlineBody = masked
  let closeDisplay = false
  if (displayOdd) {
    const idx = inlineBody.lastIndexOf('$$')
    const rest = inlineBody.slice(idx + 2)
    closeDisplay = rest.trim().length > 0
    inlineBody = `${inlineBody.slice(0, idx)}  ${rest}`
  } else {
    inlineBody = inlineBody.replace(/\$\$/g, '  ')
  }
  const last = inlineBody.split('\n').at(-1) ?? ''
  let parity = 0
  let openAt = -1
  for (let i = 0; i < last.length; i++) {
    if (last[i] !== '$') continue
    parity ^= 1
    if (parity === 1) openAt = i
  }
  let closeInline = ''
  if (parity === 1 && openAt >= 0) {
    const next = last[openAt + 1]
    const atEnd = openAt === last.length - 1
    const digit = next !== undefined && next >= '0' && next <= '9'
    if (!atEnd && !digit) closeInline = '$'
  }
  return (closeDisplay ? '$$' : '') + closeInline
}

function endsInsideFenceOrCode(scan: HealScan): boolean {
  const lines = scan.lines
  let inFence = false
  let last = ''
  for (let i = 0; i < lines.length; i++) {
    if (scan.fenceLine[i]) {
      inFence = !inFence
      last = ''
      continue
    }
    if (inFence) {
      last = ''
      continue
    }
    last = lines[i] ?? ''
  }
  if (inFence) return true
  let inCode = false
  for (const ch of last) {
    if (ch === '`') inCode = !inCode
  }
  return inCode
}

function stripInlineCode(line: string): string {
  let inCode = false
  let out = ''
  for (const ch of line) {
    if (ch === '`') {
      inCode = !inCode
      out += ' '
      continue
    }
    out += inCode ? ' ' : ch
  }
  return out
}

function isOnLastLine(lines: string[], charOffset: number): boolean {
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) break
    const start = offset
    offset += line.length + 1
    if (charOffset >= start && charOffset < offset) return i === lines.length - 1
  }
  return false
}

function isListMarkerStar(source: string, index: number): boolean {
  if (index > 3) return false
  for (let j = 0; j < index; j++) {
    if (source[j] !== ' ') return false
  }
  const next = source[index + 1]
  return next === undefined || isSpace(next)
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t'
}

function isWord(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
