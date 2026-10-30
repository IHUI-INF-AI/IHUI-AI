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
 */

export interface IncompleteMarkdownHeal {
  /** 补全后的文本(仅追加闭合符或前插零宽,绝不删改原内容) */
  healed: string
  /** 是否补了围栏(调用方用于流式代码块降透明度标记) */
  fenceHealed: boolean
  /** 是否发生任何补全 */
  healedAny: boolean
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

  const suffix =
    inlineDelimiterSuffix(text) + linkSuffix(text) + htmlSuffix(text) + mathSuffix(text)
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
    if (FENCE_LINE_RE.test(lines[i] ?? '')) fences += 1
  }
  if (fences % 2 === 1) return content
  const prev = lines[lastIdx - 1] ?? ''
  if (prev.trim() === '' || FENCE_LINE_RE.test(prev)) return content
  const next = lines.slice()
  next[lastIdx] = ZWSP + last
  return next.join('\n')
}

function inlineDelimiterSuffix(text: string): string {
  const lines = text.split('\n')
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
  lines.forEach((line) => {
    const lineStart = offset
    offset += line.length + 1
    if (FENCE_LINE_RE.test(line) || /^\s*```/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const visible = stripInlineCode(line)
    const scan = (kind: InlineKind, re: RegExp, source: string): void => {
      re.lastIndex = 0
      for (const m of source.matchAll(re)) {
        parity[kind] ^= 1
        if (parity[kind] === 1) openers[kind] = lineStart + (m.index ?? 0)
      }
    }
    scan('backtick', /`/g, line)
    scan('bold', /\*\*/g, visible)
    scan('underbold', /__/g, visible)
    scan('strike', /~~/g, visible)
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

  const last = lastOutsideFenceLine(lines)
  return closers + emphasisSuffix(last)
}

function lastOutsideFenceLine(lines: string[]): string {
  let inFence = false
  let last = ''
  for (const line of lines) {
    if (FENCE_LINE_RE.test(line) || /^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence) last = line
  }
  return last
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

function linkSuffix(text: string): string {
  const line = stripInlineCode(lastOutsideFenceLine(text.split('\n')))
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

function htmlSuffix(text: string): string {
  const lines = text.split('\n')
  const stack: string[] = []
  let inFence = false
  for (const line of lines) {
    if (FENCE_LINE_RE.test(line) || /^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    consumeHtmlTags(stripInlineCode(line), stack)
  }
  const unfinished = unfinishedTag(text)
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

function unfinishedTag(text: string): { kind: 'open' | 'close'; name: string } | null {
  if (endsInsideFenceOrCode(text)) return null
  const match = /<(\/?[A-Za-z][\w:-]*)[^<>]*$/.exec(text)
  if (!match) return null
  const raw = match[1] ?? ''
  if (raw.startsWith('/')) {
    const name = raw.slice(1).toLowerCase()
    return name ? { kind: 'close', name } : null
  }
  return { kind: 'open', name: raw.toLowerCase() }
}

function mathSuffix(text: string): string {
  const masked = maskFenceAndInlineCode(text)
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

function maskFenceAndInlineCode(text: string): string {
  const lines = text.split('\n')
  let inFence = false
  const out = lines.map((line) => {
    if (FENCE_LINE_RE.test(line) || /^\s*```/.test(line)) {
      inFence = !inFence
      return ' '.repeat(line.length)
    }
    if (inFence) return ' '.repeat(line.length)
    return stripInlineCode(line)
  })
  return out.join('\n')
}

function endsInsideFenceOrCode(text: string): boolean {
  const lines = text.split('\n')
  let inFence = false
  let last = ''
  for (const line of lines) {
    if (FENCE_LINE_RE.test(line) || /^\s*```/.test(line)) {
      inFence = !inFence
      last = ''
      continue
    }
    if (inFence) {
      last = ''
      continue
    }
    last = line
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
