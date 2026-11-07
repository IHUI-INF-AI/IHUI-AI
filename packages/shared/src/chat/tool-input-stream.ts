// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式工具参数解析。
 *
 * 观察（WorkBuddy @genie/agent-harness 0.2.0-beta.15，createToolInputParser，
 * 2026-11-07 本机已解开包）：每个 toolCallId 一份解析器，arguments 增量拼进缓冲。
 * 完整对象才算完成；`{}` 与空缓冲仍算未完成；半截对象用补括号或按键抽取，
 * 已闭合的值可以提前交给界面。完成后继续追加不再改缓冲。
 *
 * 本文件复现这套增量语义，不搬对方实现。
 * 超越：
 * 1. 半截 JSON 是正常状态，不把它记成解析故障。
 * 2. 缓冲已经是完整的数组、字符串或标量时，结果是 not_object，并清掉旧字段。
 *    对照在这种情况下仍标完成，界面会留下上一拍的字段。
 * 3. 未闭合字符串里的 \uXXXX 会解出来，中文参数不用等引号闭合才可读。
 */

export type ToolInputDefect = 'not_object'

export interface ToolInputSnapshot {
  readonly complete: boolean
  readonly parameters: Readonly<Record<string, unknown>>
  readonly rawBuffer: string
  readonly defect: ToolInputDefect | null
}

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\',
  '/': '/',
  '"': '"',
  "'": "'",
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function endsWithOddBackslash(value: string): boolean {
  let count = 0
  for (let index = value.length - 1; index >= 0 && value[index] === '\\'; index -= 1) count += 1
  return count % 2 === 1
}

function unescapePartialString(value: string): string {
  if (endsWithOddBackslash(value)) return value
  let out = ''
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char !== '\\') {
      out += char
      continue
    }
    const next = value[index + 1]
    if (next === undefined) {
      out += '\\'
      break
    }
    if (next === 'u') {
      const hex = value.slice(index + 2, index + 6)
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += String.fromCharCode(Number.parseInt(hex, 16))
        index += 5
        continue
      }
    }
    out += SIMPLE_ESCAPES[next] ?? next
    index += 1
  }
  return out
}

function tryParseValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('"') && !trimmed.endsWith('"'))
    return unescapePartialString(trimmed.slice(1))
  const stripped = trimmed.replace(/[,}]+$/, '')
  if (!stripped) return undefined
  try {
    return JSON.parse(stripped)
  } catch {
    if (trimmed.startsWith('"'))
      return unescapePartialString(trimmed.slice(1).replace(/[,}]+$/, ''))
    const numberMatch = /^(-?\d+(?:\.\d+)?)/.exec(trimmed)
    if (numberMatch?.[1] !== undefined) return Number.parseFloat(numberMatch[1])
    if (trimmed.startsWith('true')) return true
    if (trimmed.startsWith('false')) return false
    if (trimmed.startsWith('null')) return null
    return undefined
  }
}

function fixMissingPrefix(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed
  if (trimmed.startsWith('"')) return `{${trimmed}`
  if (/^([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/.test(trimmed)) return `{"${trimmed}`
  const bare = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*"?\s*:/.exec(trimmed)
  if (bare?.[1] !== undefined && bare[0] !== undefined) {
    return `{"${bare[1]}":${trimmed.slice(bare[0].length)}`
  }
  return trimmed
}

function closeJson(raw: string): string | null {
  const text = raw.trim()
  let braces = 0
  let brackets = 0
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\' && !escaped) {
      escaped = true
      continue
    }
    if (char === '"' && !escaped) inString = !inString
    if (!inString) {
      if (char === '{') braces += 1
      else if (char === '}') braces -= 1
      else if (char === '[') brackets += 1
      else if (char === ']') brackets -= 1
    }
    escaped = false
  }
  if (braces === 0 && brackets === 0 && !inString) return text
  let closed = text
  if (inString) closed += '"'
  while (brackets > 0) {
    closed += ']'
    brackets -= 1
  }
  while (braces > 0) {
    closed += '}'
    braces -= 1
  }
  try {
    JSON.parse(closed)
    return closed
  } catch {
    return null
  }
}

function splitTopLevel(raw: string): string[] {
  const parts: string[] = []
  let current = ''
  let inString = false
  let escaped = false
  let braces = 0
  let brackets = 0
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index] ?? ''
    if (char === '\\' && !escaped) {
      escaped = true
      current += char
      continue
    }
    if (char === '"' && !escaped) {
      inString = !inString
      current += char
      escaped = false
      continue
    }
    if (!inString) {
      if (char === '{') braces += 1
      else if (char === '}') braces -= 1
      else if (char === '[') brackets += 1
      else if (char === ']') brackets -= 1
      else if (char === ',' && braces === 1 && brackets === 0) {
        const piece = current.trim()
        if (piece) parts.push(piece)
        current = ''
        escaped = false
        continue
      }
    }
    current += char
    escaped = false
  }
  const tail = current.trim()
  if (tail) parts.push(tail)
  return parts
}

function extractPartial(raw: string): Record<string, unknown> | null {
  const parsed: Record<string, unknown> = {}
  for (const piece of splitTopLevel(raw)) {
    const colon = piece.indexOf(':')
    if (colon < 0) continue
    const key = piece
      .slice(0, colon)
      .trim()
      .replace(/^[{"\s]+|"$/g, '')
      .trim()
    if (!key) continue
    const value = tryParseValue(piece.slice(colon + 1))
    if (value !== undefined) parsed[key] = value
  }
  return Object.keys(parsed).length > 0 ? parsed : null
}

function smartParse(
  raw: string,
): { readonly parsed: Record<string, unknown>; readonly isComplete: boolean } | null {
  const fixed = fixMissingPrefix(raw)
  if (!fixed.startsWith('{')) return null
  const closed = closeJson(fixed)
  if (closed !== null) {
    try {
      const parsed: unknown = JSON.parse(closed)
      if (isPlainObject(parsed)) return { parsed, isComplete: closed === fixed }
    } catch {
      // 补括号后仍不是对象，落到按键抽取。
    }
  }
  const extracted = extractPartial(fixed)
  if (extracted) return { parsed: extracted, isComplete: false }
  return null
}

export class ToolInputStream {
  private buffer = ''
  private parameters: Record<string, unknown> = {}
  private completed = false
  private defect: ToolInputDefect | null = null

  appendDelta(delta: unknown): ToolInputSnapshot {
    if (this.completed) return this.snapshot()
    if (typeof delta !== 'string' || delta.length === 0) return this.snapshot()
    this.buffer += delta
    return this.tryParse()
  }

  /** 参数流结束。最终载荷不是对象时不标完成，并清掉流式阶段留下的字段。 */
  finish(finalValue: unknown): ToolInputSnapshot {
    if (typeof finalValue === 'string') {
      this.buffer = finalValue
      try {
        const parsed: unknown = JSON.parse(finalValue)
        if (isPlainObject(parsed)) this.replace(parsed, true)
        else this.rejectNotObject()
      } catch {
        const smart = smartParse(finalValue)
        if (smart?.isComplete === true) this.replace(smart.parsed, true)
        else this.rejectNotObject()
      }
    } else if (isPlainObject(finalValue)) {
      this.buffer = JSON.stringify(finalValue)
      this.replace(finalValue, true)
    } else {
      this.rejectNotObject()
    }
    return this.snapshot()
  }

  snapshot(): ToolInputSnapshot {
    return {
      complete: this.completed,
      parameters: { ...this.parameters },
      rawBuffer: this.buffer,
      defect: this.defect,
    }
  }

  private replace(parsed: Record<string, unknown>, complete: boolean): void {
    this.parameters = { ...parsed }
    this.completed = complete
    this.defect = null
  }

  private rejectNotObject(): void {
    this.parameters = {}
    this.completed = false
    this.defect = 'not_object'
  }

  private tryParse(): ToolInputSnapshot {
    const trimmed = this.buffer.trim()
    if (!trimmed || trimmed === '{}') {
      this.parameters = {}
      this.completed = false
      this.defect = null
      return this.snapshot()
    }
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (isPlainObject(parsed)) {
        this.replace(parsed, true)
        return this.snapshot()
      }
      this.rejectNotObject()
      return this.snapshot()
    } catch {
      const smart = smartParse(trimmed)
      if (smart && Object.keys(smart.parsed).length > 0) {
        this.replace(smart.parsed, smart.isComplete)
        return this.snapshot()
      }
      this.parameters = {}
      this.completed = false
      this.defect = null
      return this.snapshot()
    }
  }
}

/** 与对照工厂同形：增量进去，当前参数对象出来。 */
export function createToolInputParser(): (delta: string) => Readonly<Record<string, unknown>> {
  const stream = new ToolInputStream()
  return (delta) => stream.appendDelta(delta).parameters
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
