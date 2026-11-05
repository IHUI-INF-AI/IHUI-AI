// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式感知的 JSON 修复（逆向-复现-超越，AGENTS §0.12）
 *
 * 对标：Qoder / Trae 的 `jsonrepair` 依赖（我在两家的依赖清单里都直接观察到）。
 * 复现：一次性尽力修复 LLM 输出的残缺 JSON（截断尾值、缺失收尾括号、尾随逗号、
 *       未加引号键名、单引号字符串、JS 注释、裸 NaN/Infinity）。
 * 超越：额外提供 *流式* 修复——输入是仍在增长的流前缀时，仍能给出「当前最好可用的
 *       部分值 + 是否已完整」信号，使聊天层可在 SSE 分片到达过程中渐进渲染工具调用入参。
 *       `jsonrepair` 只能吃完整字符串，做不到这一点。
 *
 * 红线：本文件完全自研，不粘贴任何对照程序专有源码；不依赖第三方 jsonrepair 包。
 */

export interface RepairResult {
  /** 是否成功解析出值 */
  ok: boolean
  /** 解析出的值（ok=false 时为 undefined） */
  value: unknown
  /** true 表示值来自「被修复过的」输入，而非原样 JSON.parse 通过 */
  recovered: boolean
  /** 失败原因（ok=false 时存在） */
  error?: string
}

export interface StreamingRepairSnapshot {
  /** 缓冲区已能解析出一个完整合法的 JSON 值（原始缓冲无需修复即通过） */
  complete: boolean
  /** 流尚未闭合，但已尽力抽出一个可用部分值 */
  partial: boolean
  /** 当前可用值（complete 或 partial 时存在） */
  value: unknown | undefined
}

/** 在字符串之外扫描括号深度，返回让结构闭合所需的后缀（含未闭合字符串的收尾引号）。 */
function autoCloseSuffix(text: string): string {
  const openStack: string[] = []
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') openStack.push(ch)
    else if (ch === '}' || ch === ']') openStack.pop()
  }
  let suffix = inString ? '"' : ''
  for (let i = openStack.length - 1; i >= 0; i--) {
    const opener = openStack[i]
    suffix += opener === '{' ? '}' : ']'
  }
  return suffix
}

/** 字符串感知地剥离 // 与 /* *​/ 注释（不误删字符串内的 //）。 */
function stripComments(text: string): string {
  let out = ''
  let inString = false
  let escape = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      i++
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      i++
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 字符串感知地删除 `}` / `]` 之前的尾随逗号。 */
function stripTrailingCommas(text: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j] ?? '')) j++
      if (text[j] === '}' || text[j] === ']') continue // 丢弃该逗号
    }
    out += ch
  }
  return out
}

/** 给未加引号的裸键名（{ 或 , 之后的标识符）补上双引号。 */
function quoteUnquotedKeys(text: string): string {
  return text.replace(/([{[,])\s*([A-Za-z_$][\w$]*)\s*:/g, (_m, pre: string, key: string) => `${pre}"${key}":`)
}

/** 把 JS 字符串转义序列翻译为实际字符（\n \t \uXXXX \' \" \\ …），供重新序列化为 JSON 字符串。 */
function jsUnescape(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      const n = s[i + 1]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === 'r') out += '\r'
      else if (n === 'b') out += '\b'
      else if (n === 'f') out += '\f'
      else if (n === '0') out += '\0'
      else if (n === 'u') {
        out += String.fromCharCode(parseInt(s.substr(i + 2, 4), 16))
        i += 4
      } else out += n
      i += 2
    } else {
      out += c
      i++
    }
  }
  return out
}

/**
 * 把单引号字符串字面量转成双引号（仅当单引号确实充当字符串定界符时）。
 * 内部 JS 转义（含 \' 这类 JSON 不合法的转义）先解码再交给 JSON.stringify 重新转义，
 * 词内撇号（如 don't）因找不到成对定界符会被跳过。
 */
function singleToDoubleQuotes(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === "'") {
      let j = i + 1
      let closed = false
      let body = ''
      while (j < text.length) {
        const c = text[j]
        if (c === '\\') {
          // 保留反斜杠与紧随其后的字符，交给 jsUnescape 统一解码（含 \' 这类转义）
          body += c
          if (j + 1 < text.length) {
            body += text[j + 1]
            j += 2
            continue
          }
          j++
          break
        }
        if (c === "'") {
          closed = true
          break
        }
        body += c
        j++
      }
      if (closed) {
        out += JSON.stringify(jsUnescape(body))
        i = j + 1
        continue
      }
      out += ch
      i++
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 把裸 NaN / Infinity 字面量替换为 JSON 合法的 null（仅作用于值位）。 */
function neutralizeNonFinite(text: string): string {
  return text
    .replace(/:\s*(NaN|-?Infinity)\b/g, ': null')
    .replace(/(\[|,)\s*(NaN|-?Infinity)\b/g, '$1null')
}

/** 去掉残缺流尾部的半个 token（半截字符串 / 半截键名:值 / 半截值），返回可闭合前缀或 null。 */
function trimTrailingPartial(text: string): string | null {
  // 1) 末尾在字符串内：回退到最后一个未闭合引号之前
  let inString = false
  let escape = false
  let lastStringStart = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
      lastStringStart = i
    }
  }
  if (inString && lastStringStart >= 0) {
    return text.slice(0, lastStringStart)
  }
  // 2) 末尾是「可选逗号 + 可选键名 + 冒号」（键已写出但值还没来）：回退到该结构符之前
  const keyMatch = text.match(/(?:^|[,\[{])\s*(?:"[^"]*"\s*:|[A-Za-z_$][\w$]*\s*:)\s*$/)
  if (keyMatch && keyMatch.index !== undefined) {
    if (keyMatch.index === 0 && keyMatch[0].length === text.length) return null
    return text.slice(0, keyMatch.index)
  }
  // 3) 末尾是「可选逗号/冒号 + 半截值」（已是值槽里的半个 token）：回退到分隔符之前
  const valMatch = text.match(/(?:^|[,\[{:])\s*[\w.-]*$/)
  if (valMatch && valMatch.index !== undefined && valMatch[0].length > 0) {
    if (valMatch.index === 0 && valMatch[0].length === text.length) return null
    return text.slice(0, valMatch.index)
  }
  return null
}

function tryParse(text: string): RepairResult | null {
  try {
    return { ok: true, value: JSON.parse(text), recovered: false }
  } catch {
    return null
  }
}

function markRecovered(r: RepairResult): RepairResult {
  return { ...r, recovered: true }
}

/** 对一段文本尝试多档修复；命中即返回。 */
function attemptCandidates(cands: string[]): RepairResult | null {
  for (const c of cands) {
    const r = tryParse(c)
    if (r) return markRecovered(r)
  }
  return null
}

/**
 * 一次性尽力修复残缺 JSON。输入可为：被截断的流、带尾随逗号的对象、裸键名、
 * 单引号字符串、含注释或裸 NaN/Infinity 的文本。能解析则返回 ok=true。
 */
export function repairJson(input: string): RepairResult {
  if (typeof input !== 'string') {
    return { ok: false, value: undefined, recovered: false, error: 'input is not a string' }
  }
  const trimmed = input.trim()
  if (trimmed === '') {
    return { ok: false, value: undefined, recovered: false, error: 'empty input' }
  }

  const direct = tryParse(trimmed)
  if (direct) return direct

  const cleaned = neutralizeNonFinite(stripTrailingCommas(stripComments(trimmed)))
  const structural = cleaned + autoCloseSuffix(cleaned)
  const firstPass = attemptCandidates([
    cleaned,
    structural,
    quoteUnquotedKeys(structural),
    singleToDoubleQuotes(quoteUnquotedKeys(structural)),
  ])
  if (firstPass) return firstPass

  // 逐层回退尾部半截 token（封顶 4 次，每次必定变短，避免吞掉合法结构）
  let cur = cleaned
  for (let k = 0; k < 4; k++) {
    const cut = trimTrailingPartial(cur)
    if (!cut || cut === cur) break
    cur = cut
    const cutStructural = cur + autoCloseSuffix(cur)
    const r = attemptCandidates([
      cur,
      cutStructural,
      quoteUnquotedKeys(cutStructural),
      singleToDoubleQuotes(quoteUnquotedKeys(cutStructural)),
    ])
    if (r) return r
  }

  return { ok: false, value: undefined, recovered: false, error: 'unrepairable JSON' }
}

/**
 * 流式 JSON 修复器：喂入分片，随时给出「当前最好可用的部分值 + 是否已完整」。
 * 完整性以「原始缓冲无需修复即可 JSON.parse」为准，因此不会把修复补出的收尾误判为完成；
 * 一旦原始缓冲达成完整值即锁定，后续分片若仍合法则更新值、否则沿用已锁定值。
 */
export class StreamingJsonRepair {
  private buffer = ''
  private completed = false
  private lastCompleteValue: unknown = undefined

  push(chunk: string): StreamingRepairSnapshot {
    this.buffer += chunk

    if (this.completed) {
      try {
        this.lastCompleteValue = JSON.parse(this.buffer)
      } catch {
        /* 后续分片破坏了原完整值（如模型追加了多余文本），沿用锁定值 */
      }
      return { complete: true, partial: false, value: this.lastCompleteValue }
    }

    let rawOk = false
    let rawValue: unknown
    try {
      rawValue = JSON.parse(this.buffer)
      rawOk = true
    } catch {
      rawOk = false
    }

    if (rawOk) {
      this.completed = true
      this.lastCompleteValue = rawValue
      return { complete: true, partial: false, value: rawValue }
    }

    // 尚未完整：尽力抽取当前最好部分值（不声称 complete）
    const partial = repairJson(this.buffer)
    if (partial.ok) {
      return { complete: false, partial: true, value: partial.value }
    }
    return { complete: false, partial: false, value: undefined }
  }

  /** 当前累积的原始缓冲（调试用）。 */
  get raw(): string {
    return this.buffer
  }

  /** 流是否已解析出完整值（之后喂入的分片不会改变「已完成」这一事实）。 */
  get isComplete(): boolean {
    return this.completed
  }
}

/** 工厂：创建一个流式 JSON 修复器。 */
export function createStreamingJsonRepair(): StreamingJsonRepair {
  return new StreamingJsonRepair()
}
