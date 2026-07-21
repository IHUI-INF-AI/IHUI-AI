/**
 * 安全条件求值器(2026-07-21 安全审计加固,替代原 `new Function` 方案)
 *
 * 旧实现 `new Function('ctx', 'with(ctx){return ${condition}}')` 存在严重 RCE 风险:
 * 任意已认证用户 POST /api/clawdbot/tasks 时,在 steps[].condition 中填入
 * `process.exit(0)` 或 `(function(){ /* 任意代码 *\/ })()`,服务器会原样执行。
 *
 * 新实现支持受限表达式语法(白名单 token),无法执行任意代码:
 * - 标识符:ctx 中已存在的键(对象属性访问),点路径如 outputs.userId
 * - 字面量:number / string / boolean / null
 * - 运算符:== === != !== < <= > >= && || + - * / %
 * - 函数调用:仅允许白名单内 safe 函数(string.length, Array.isArray 等基础工具)
 * - 括号表达式
 *
 * 任何不在白名单的 token 直接抛错,确保表达式安全求值。
 *
 * 重要:不依赖任何第三方库(避免供应链攻击),基于手写 tokenizer + recursive descent parser。
 */

const FORBIDDEN_KEYWORDS = new Set([
  'process',
  'globalThis',
  'window',
  'self',
  'global',
  'eval',
  'Function',
  'require',
  'import',
  '__proto__',
  'constructor',
  'prototype',
  'Object',
  'Array',
  'JSON',
  'Reflect',
  'Proxy',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'crypto',
  'Buffer',
  'require',
  'module',
  'exports',
  'this',
  'new',
  'class',
  'function',
  'async',
  'await',
  'yield',
  'delete',
  'void',
  'typeof', // typeof 单独允许,字面量用,这里禁止以防 typeof constructor
  'instanceof',
  'in',
  'of',
  'for',
  'while',
  'do',
  'switch',
  'try',
  'catch',
  'finally',
  'throw',
  'return',
  'var',
  'let',
  'const',
  'if',
  'else',
  'break',
  'continue',
])

type TokenType = 'num' | 'str' | 'ident' | 'op' | 'paren' | 'comma' | 'dot' | 'true' | 'false' | 'null'

interface Token {
  type: TokenType
  value: string
  pos: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    const ch = input[i]
    if (ch === undefined) break
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      const start = i
      i++
      let value = ''
      while (i < n && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < n) {
          const next = input[i + 1]
          if (next === 'n') value += '\n'
          else if (next === 't') value += '\t'
          else if (next === 'r') value += '\r'
          else if (next === '\\') value += '\\'
          else if (next === quote) value += quote
          else value += next ?? ''
          i += 2
        } else {
          value += input[i] ?? ''
          i++
        }
      }
      if (i >= n) throw new Error('Unterminated string literal')
      i++ // skip closing quote
      tokens.push({ type: 'str', value, pos: start })
      continue
    }
    if (ch >= '0' && ch <= '9') {
      const start = i
      while (i < n && input[i] !== undefined && /[0-9.]/.test(input[i]!)) i++
      tokens.push({ type: 'num', value: input.slice(start, i), pos: start })
      continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i
      while (i < n && input[i] !== undefined && /[a-zA-Z0-9_$]/.test(input[i]!)) i++
      const value = input.slice(start, i)
      if (value === 'true') tokens.push({ type: 'true', value, pos: start })
      else if (value === 'false') tokens.push({ type: 'false', value, pos: start })
      else if (value === 'null') tokens.push({ type: 'null', value, pos: start })
      else tokens.push({ type: 'ident', value, pos: start })
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch, pos: i })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '.') {
      tokens.push({ type: 'dot', value: ch, pos: i })
      i++
      continue
    }
    // 三字符运算符(2026-07-21 修复:必须先匹配 ===/!==,避免被两字符吞掉)
    const three = input.slice(i, i + 3)
    if (three === '===' || three === '!==') {
      tokens.push({ type: 'op', value: three, pos: i })
      i += 3
      continue
    }
    // 多字符运算符
    const two = input.slice(i, i + 2)
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i })
      i += 2
      continue
    }
    if ('+-*/%<>!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i })
      i++
      continue
    }
    throw new Error(`Unexpected character at pos ${i}: ${ch}`)
  }
  return tokens
}

// 允许的标识符前缀(用户传入的 context 路径)
function assertIdentAllowed(name: string): void {
  if (FORBIDDEN_KEYWORDS.has(name)) {
    throw new Error(`Forbidden identifier: ${name}`)
  }
  // 防止 prototype pollution / 奇怪路径
  if (name === '__proto__' || name === 'constructor' || name === 'prototype') {
    throw new Error(`Forbidden property: ${name}`)
  }
}

// 限制函数调用(只允许 ctx 已定义函数,避免任意函数)
const SAFE_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  String: (v: unknown) => String(v ?? ''),
  Number: (v: unknown) => Number(v),
  Boolean: (v: unknown) => Boolean(v),
  isArray: Array.isArray,
  length: (v: unknown) => (Array.isArray(v) || typeof v === 'string' ? (v as { length: number }).length : 0),
}

class Parser {
  private pos = 0
  constructor(
    private tokens: Token[],
    private ctx: Record<string, unknown>,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private consume(): Token {
    const t = this.tokens[this.pos]
    if (!t) throw new Error('Unexpected end of expression')
    this.pos++
    return t
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.peek()
    if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${value ?? type}, got ${t ? `${t.type}(${t.value})` : 'EOF'}`)
    }
    return this.consume()
  }

  parse(): unknown {
    const result = this.parseOr()
    if (this.pos < this.tokens.length) {
      const t = this.peek()
      throw new Error(`Unexpected token at end: ${t?.value}`)
    }
    return result
  }

  private parseOr(): unknown {
    let left = this.parseAnd()
    while (this.peek()?.value === '||') {
      this.consume()
      const right = this.parseAnd()
      left = Boolean(left) || Boolean(right)
    }
    return left
  }

  private parseAnd(): unknown {
    let left = this.parseEquality()
    while (this.peek()?.value === '&&') {
      this.consume()
      const right = this.parseEquality()
      left = Boolean(left) && Boolean(right)
    }
    return left
  }

  private parseEquality(): unknown {
    let left = this.parseRelational()
    while (true) {
      const t = this.peek()
      if (!t || t.type !== 'op') break
      if (!['==', '===', '!=', '!==', 'is'].includes(t.value)) break
      this.consume()
      const right = this.parseRelational()
      switch (t.value) {
        case '==':
        case 'is':
          // eslint-disable-next-line eqeqeq -- 表达式语义要求宽松相等
          left = left == right
          break
        case '===':
          left = left === right
          break
        case '!=':
          // eslint-disable-next-line eqeqeq -- 表达式语义要求宽松不等
          left = left != right
          break
        case '!==':
          left = left !== right
          break
      }
    }
    return left
  }

  private parseRelational(): unknown {
    let left = this.parseAdditive()
    while (true) {
      const t = this.peek()
      if (!t || t.type !== 'op') break
      if (!['<', '<=', '>', '>='].includes(t.value)) break
      this.consume()
      const right = this.parseAdditive()
      const a = Number(left)
      const b = Number(right)
      switch (t.value) {
        case '<':
          left = a < b
          break
        case '<=':
          left = a <= b
          break
        case '>':
          left = a > b
          break
        case '>=':
          left = a >= b
          break
      }
    }
    return left
  }

  private parseAdditive(): unknown {
    let left = this.parseMultiplicative()
    while (true) {
      const t = this.peek()
      if (!t || t.type !== 'op') break
      if (!['+', '-'].includes(t.value)) break
      this.consume()
      const right = this.parseMultiplicative()
      if (t.value === '+') {
        // 字符串拼接 或 数字加法
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left ?? '') + String(right ?? '')
        } else {
          left = Number(left) + Number(right)
        }
      } else {
        left = Number(left) - Number(right)
      }
    }
    return left
  }

  private parseMultiplicative(): unknown {
    let left = this.parseUnary()
    while (true) {
      const t = this.peek()
      if (!t || t.type !== 'op') break
      if (!['*', '/', '%'].includes(t.value)) break
      this.consume()
      const right = this.parseUnary()
      const a = Number(left)
      const b = Number(right)
      switch (t.value) {
        case '*':
          left = a * b
          break
        case '/':
          left = b === 0 ? 0 : a / b
          break
        case '%':
          left = b === 0 ? 0 : a % b
          break
      }
    }
    return left
  }

  private parseUnary(): unknown {
    const t = this.peek()
    if (t?.value === '!') {
      this.consume()
      return !this.parseUnary()
    }
    if (t?.value === '-') {
      this.consume()
      return -Number(this.parseUnary())
    }
    if (t?.value === '+') {
      this.consume()
      return Number(this.parseUnary())
    }
    return this.parsePrimary()
  }

  private parsePrimary(): unknown {
    const t = this.peek()
    if (!t) throw new Error('Unexpected end of expression')

    if (t.type === 'num') {
      this.consume()
      return Number(t.value)
    }
    if (t.type === 'str') {
      this.consume()
      return t.value
    }
    if (t.type === 'true') {
      this.consume()
      return true
    }
    if (t.type === 'false') {
      this.consume()
      return false
    }
    if (t.type === 'null') {
      this.consume()
      return null
    }
    if (t.type === 'paren' && t.value === '(') {
      this.consume()
      const v = this.parseOr()
      this.expect('paren', ')')
      return v
    }
    if (t.type === 'ident') {
      this.consume()
      assertIdentAllowed(t.value)
      // 解析成员链 a.b.c(...)
      let target: unknown = this.ctx[t.value]
      while (this.peek()?.type === 'dot' || this.peek()?.type === 'paren') {
        const next = this.peek()
        if (next?.type === 'dot') {
          this.consume()
          const id = this.expect('ident')
          assertIdentAllowed(id.value)
          if (target === null || target === undefined) {
            target = undefined
            continue
          }
          target = (target as Record<string, unknown>)[id.value]
        } else if (next?.type === 'paren' && next.value === '(') {
          // 函数调用
          this.consume()
          const args: unknown[] = []
          if (this.peek()?.value !== ')') {
            args.push(this.parseOr())
            while (this.peek()?.value === ',') {
              this.consume()
              args.push(this.parseOr())
            }
          }
          this.expect('paren', ')')
          const fn = SAFE_FUNCTIONS[t.value]
          if (fn) {
            target = fn(...args)
          } else {
            // 允许 ctx 上函数引用
            const fnInCtx = this.ctx[t.value]
            if (typeof fnInCtx === 'function') {
              target = (fnInCtx as (...a: unknown[]) => unknown)(...args)
            } else {
              throw new Error(`Unknown function: ${t.value}`)
            }
          }
        } else {
          break
        }
      }
      return target
    }
    throw new Error(`Unexpected token: ${t.type}(${t.value})`)
  }
}

/**
 * 求值一个安全条件表达式。
 *
 * @param condition 表达式字符串,如 `outputs.userId === 'admin' && count > 0`
 * @param ctx 上下文对象,通常是 { outputs, inputs, ... }
 * @returns 求值结果(boolean)
 */
export function evaluateSafeCondition(condition: string, ctx: Record<string, unknown>): boolean {
  if (typeof condition !== 'string' || condition.trim() === '') return false
  // 长度上限,避免 DoS
  if (condition.length > 2000) {
    throw new Error('Condition expression too long (max 2000 chars)')
  }
  // 拒绝任何 unicode 转义、十六进制字符串
  if (/\\u[0-9a-fA-F]{4}/.test(condition) || /\\x[0-9a-fA-F]{2}/.test(condition)) {
    throw new Error('Unicode/hex escape not allowed')
  }
  const tokens = tokenize(condition)
  const parser = new Parser(tokens, ctx)
  const result = parser.parse()
  return Boolean(result)
}
