/**
 * P1-6 Codebase Graph — 正则降级版 AST 解析器(TS/JS)。
 *
 * 灵感来源:grok-build xai-codebase-graph 的 ScopeGraph,做减法为纯正则版本。
 * 简化策略:
 *   - 不上 tree-sitter,用正则 + 标记化代替完整 AST
 *   - 支持语言:仅 TypeScript / JavaScript
 *   - 只识别定义(function/const/let/var/class/interface/type/enum/import)和引用
 *   - 关键字黑名单过滤误识别
 *   - 引用 = import 语句引用 + 对已定义符号在文件内其他位置的使用
 */

import type { DefinitionEntry, ReferenceEntry, SymbolLocation } from './index.js'

export interface ParseResult {
  definitions: DefinitionEntry[]
  references: ReferenceEntry[]
}

// 关键字黑名单(避免把关键字误识别为符号)
const KEYWORD_BLACKLIST = new Set<string>([
  'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
  'import', 'export', 'from', 'return', 'if', 'else', 'for', 'while',
  'switch', 'case', 'break', 'continue', 'new', 'this', 'super', 'typeof',
  'instanceof', 'in', 'of', 'void', 'delete', 'yield', 'async', 'await',
])

// 定义模式:每种声明对应一个正则
interface DefPattern {
  re: RegExp
  kind: DefinitionEntry['kind']
}

const DEF_PATTERNS: DefPattern[] = [
  { re: /\bfunction\s+(\w+)/g, kind: 'function' },
  { re: /\bconst\s+(\w+)\s*=/g, kind: 'const' },
  { re: /\blet\s+(\w+)\s*=/g, kind: 'variable' },
  { re: /\bvar\s+(\w+)\s*=/g, kind: 'variable' },
  { re: /\bclass\s+(\w+)/g, kind: 'class' },
  { re: /\binterface\s+(\w+)/g, kind: 'interface' },
  { re: /\btype\s+(\w+)\s*=/g, kind: 'type' },
  { re: /\benum\s+(\w+)/g, kind: 'enum' },
]

// import 模式:捕获导入的符号名(第一个单词)
const IMPORT_RE = /\bimport\s+.*?\b(\w+)\b.*?\bfrom\b/g

/** 转义正则特殊字符 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 预计算每行起始偏移(用于快速行号查找) */
function buildLineStarts(content: string): number[] {
  const starts = [0]
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) { // '\n'
      starts.push(i + 1)
    }
  }
  return starts
}

/** 二分查找 index 所在行号(0-based),返回行索引 */
function findLineIndex(starts: number[], index: number): number {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const midStart = starts[mid]!
    if (midStart <= index) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return lo
}

/** 计算 index 对应的 1-based 行号和列号 */
function lineCol(starts: number[], index: number): { line: number; column: number } {
  const lineIdx = findLineIndex(starts, index)
  const lineStart = starts[lineIdx]!
  return { line: lineIdx + 1, column: index - lineStart + 1 }
}

/**
 * 解析单个文件,提取定义和引用。
 *
 * 定义:function/const/let/var/class/interface/type/enum 声明 + import 绑定。
 * 引用:import 语句对外部符号的引用 + 文件内对已定义符号的其他使用位置。
 *
 * @param filePath 文件路径(用于 SymbolLocation)
 * @param content 文件内容
 */
export function parseFile(filePath: string, content: string): ParseResult {
  const definitions: DefinitionEntry[] = []
  const refLocations = new Map<string, SymbolLocation[]>()
  // 每个符号的定义位置 key 集合(用于排除定义位置,避免把定义当引用)
  const defKeysBySymbol = new Map<string, Set<string>>()

  const starts = buildLineStarts(content)

  function makeLoc(index: number): SymbolLocation {
    const { line, column } = lineCol(starts, index)
    return { filePath, line, column }
  }

  function locKey(loc: SymbolLocation): string {
    return `${loc.line}:${loc.column}`
  }

  function addDefinition(symbol: string, kind: DefinitionEntry['kind'], symbolIndex: number): void {
    const loc = makeLoc(symbolIndex)
    definitions.push({ symbol, kind, locations: [loc], filePath })
    let set = defKeysBySymbol.get(symbol)
    if (!set) {
      set = new Set()
      defKeysBySymbol.set(symbol, set)
    }
    set.add(locKey(loc))
  }

  function addReference(symbol: string, symbolIndex: number): void {
    const loc = makeLoc(symbolIndex)
    let arr = refLocations.get(symbol)
    if (!arr) {
      arr = []
      refLocations.set(symbol, arr)
    }
    arr.push(loc)
  }

  // 1. 解析所有定义声明
  for (const { re, kind } of DEF_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      const symbol = m[1]
      if (!symbol || KEYWORD_BLACKLIST.has(symbol)) continue
      // 计算符号在匹配文本中的偏移
      const symbolOffset = m[0].indexOf(symbol)
      if (symbolOffset < 0) continue
      addDefinition(symbol, kind, m.index + symbolOffset)
    }
  }

  // 2. 解析 import 语句:产生定义(kind='import')+ 引用(引用外部符号)
  IMPORT_RE.lastIndex = 0
  let im: RegExpExecArray | null
  while ((im = IMPORT_RE.exec(content)) !== null) {
    const symbol = im[1]
    if (!symbol || KEYWORD_BLACKLIST.has(symbol)) continue
    const symbolOffset = im[0].indexOf(symbol)
    if (symbolOffset < 0) continue
    const symbolIndex = im.index + symbolOffset
    addDefinition(symbol, 'import', symbolIndex)
    // import 语句本身是对外部符号的引用
    addReference(symbol, symbolIndex)
  }

  // 3. 对每个已定义符号,扫描文件中所有出现位置,排除定义位置,作为引用
  for (const [symbol, defKeys] of defKeysBySymbol) {
    const usageRe = new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'g')
    let um: RegExpExecArray | null
    while ((um = usageRe.exec(content)) !== null) {
      const loc = makeLoc(um.index)
      // 排除定义位置(定义位置不算引用)
      if (defKeys.has(locKey(loc))) continue
      addReference(symbol, um.index)
    }
  }

  // 4. 按符号组装 ReferenceEntry[]
  const references: ReferenceEntry[] = []
  for (const [symbol, locs] of refLocations) {
    references.push({ symbol, locations: locs })
  }

  return { definitions, references }
}
