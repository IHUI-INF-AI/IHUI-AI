/**
 * 安全条件表达式求值器(无 RCE 风险)
 *
 * 替代 `new Function('ctx', \`with(ctx){return ${condition}}\`)` 的危险实现,
 * 用手写递归下降 parser + AST walker 求值,完全杜绝代码注入。
 *
 * 支持语法:
 *   - 字面量:number / string('...'|"...") / boolean(true/false) / null
 *   - 标识符:从 context 顶层取值(如 `status`、`count`)
 *   - 成员访问:`a.b.c`(从 context 嵌套取值)
 *   - 算术:`+ - * / %`
 *   - 比较:`< > <= >= == === != !==`
 *   - 逻辑:`&& || !`
 *   - 三元:`? :`
 *   - 括号:`( )`
 *
 * 不支持:函数调用、new、prototype 访问、模板字符串、数组/对象字面量(均为 RCE 入口)
 *
 * 求值失败(语法错 / 运行时类型错 / 未定义变量)统一返回 false,
 * 与原 `try { new Function... } catch { return false }` 语义一致。
 */

// ============ Tokenizer ============

type TokenType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'null'
  | 'identifier'
  | 'dot'
  | 'lparen'
  | 'rparen'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'eq'
  | 'seq'
  | 'ne'
  | 'sne'
  | 'and'
  | 'or'
  | 'not'
  | 'question'
  | 'colon'
  | 'eof'

interface Token {
  type: TokenType
  value: string
}

const TWO_CHAR_OPS: Record<string, TokenType> = {
  '<=': 'lte',
  '>=': 'gte',
  '==': 'eq',
  '===': 'seq',
  '!=': 'ne',
  '!==': 'sne',
  '&&': 'and',
  '||': 'or',
}

const THREE_CHAR_OPS: Record<string, TokenType> = {
  '===': 'seq',
  '!==': 'sne',
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    const ch = input[i]!
    // 跳过空白
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    // 数字字面量(含小数)
    if (ch >= '0' && ch <= '9') {
      let j = i
      let hasDot = false
      while (j < n) {
        const cj = input[j]!
        if ((cj >= '0' && cj <= '9') || (cj === '.' && !hasDot)) {
          if (cj === '.') hasDot = true
          j++
        } else break
      }
      tokens.push({ type: 'number', value: input.slice(i, j) })
      i = j
      continue
    }
    // 字符串字面量
    if (ch === "'" || ch === '"') {
      const quote = ch
      let j = i + 1
      let value = ''
      while (j < n) {
        const cj = input[j]!
        if (cj === quote) break
        // 简单转义:仅支持 \\ 和 \'
        if (cj === '\\' && j + 1 < n) {
          const next = input[j + 1]!
          if (next === '\\' || next === quote) {
            value += next
            j += 2
            continue
          }
        }
        value += cj
        j++
      }
      if (j >= n) throw new Error('未闭合的字符串字面量')
      tokens.push({ type: 'string', value })
      i = j + 1
      continue
    }
    // 标识符 / 关键字
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i
      while (j < n && /[a-zA-Z0-9_$]/.test(input[j]!)) j++
      const word = input.slice(i, j)
      if (word === 'true' || word === 'false') {
        tokens.push({ type: 'boolean', value: word })
      } else if (word === 'null') {
        tokens.push({ type: 'null', value: word })
      } else {
        tokens.push({ type: 'identifier', value: word })
      }
      i = j
      continue
    }
    // 三字符操作符
    if (i + 2 < n) {
      const three = input.slice(i, i + 3)
      if (three === '===' || three === '!==') {
        tokens.push({ type: THREE_CHAR_OPS[three]!, value: three })
        i += 3
        continue
      }
    }
    // 两字符操作符
    if (i + 1 < n) {
      const two = input.slice(i, i + 2)
      const opType = TWO_CHAR_OPS[two]
      if (opType) {
        tokens.push({ type: opType, value: two })
        i += 2
        continue
      }
    }
    // 单字符操作符
    let singleOp: TokenType | null = null
    switch (ch) {
      case '.':
        singleOp = 'dot'
        break
      case '(':
        singleOp = 'lparen'
        break
      case ')':
        singleOp = 'rparen'
        break
      case '+':
        singleOp = 'plus'
        break
      case '-':
        singleOp = 'minus'
        break
      case '*':
        singleOp = 'star'
        break
      case '/':
        singleOp = 'slash'
        break
      case '%':
        singleOp = 'percent'
        break
      case '<':
        singleOp = 'lt'
        break
      case '>':
        singleOp = 'gt'
        break
      case '?':
        singleOp = 'question'
        break
      case ':':
        singleOp = 'colon'
        break
      case '!':
        singleOp = 'not'
        break
      default:
        throw new Error(`非法字符: ${ch}`)
    }
    tokens.push({ type: singleOp, value: ch })
    i++
  }
  tokens.push({ type: 'eof', value: '' })
  return tokens
}

// ============ AST ============

type Node =
  | { kind: 'literal'; value: unknown }
  | { kind: 'identifier'; path: string[] }
  | { kind: 'unary'; op: 'not' | 'minus'; operand: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'ternary'; cond: Node; then: Node; else: Node }

// ============ Parser (递归下降,优先级递归) ============

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseTernary()
    if (this.peek().type !== 'eof') {
      throw new Error(`意外的 token: ${this.peek().value}`)
    }
    return node
  }

  private peek(): Token {
    return this.tokens[this.pos]!
  }

  private consume(type: TokenType): Token {
    const t = this.peek()
    if (t.type !== type) throw new Error(`期望 ${type},得到 ${t.type}`)
    this.pos++
    return t
  }

  // 三元 :cond ? then : else
  private parseTernary(): Node {
    const cond = this.parseOr()
    if (this.peek().type === 'question') {
      this.consume('question')
      const then = this.parseTernary()
      this.consume('colon')
      const elseNode = this.parseTernary()
      return { kind: 'ternary', cond, then, else: elseNode }
    }
    return cond
  }

  // 逻辑或 ||
  private parseOr(): Node {
    let left = this.parseAnd()
    while (this.peek().type === 'or') {
      this.consume('or')
      const right = this.parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  // 逻辑与 &&
  private parseAnd(): Node {
    let left = this.parseEquality()
    while (this.peek().type === 'and') {
      this.consume('and')
      const right = this.parseEquality()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  // 相等 == === != !==
  private parseEquality(): Node {
    let left = this.parseComparison()
    while (['eq', 'seq', 'ne', 'sne'].includes(this.peek().type)) {
      const op = this.consume(this.peek().type).value
      const right = this.parseComparison()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  // 比较 < > <= >=
  private parseComparison(): Node {
    let left = this.parseAdditive()
    while (['lt', 'gt', 'lte', 'gte'].includes(this.peek().type)) {
      const op = this.consume(this.peek().type).value
      const right = this.parseAdditive()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  // 加减 + -
  private parseAdditive(): Node {
    let left = this.parseMultiplicative()
    while (['plus', 'minus'].includes(this.peek().type)) {
      const op = this.consume(this.peek().type).value
      const right = this.parseMultiplicative()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  // 乘除模 * / %
  private parseMultiplicative(): Node {
    let left = this.parseUnary()
    while (['star', 'slash', 'percent'].includes(this.peek().type)) {
      const op = this.consume(this.peek().type).value
      const right = this.parseUnary()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  // 一元 ! -
  private parseUnary(): Node {
    const t = this.peek()
    if (t.type === 'not') {
      this.consume('not')
      return { kind: 'unary', op: 'not', operand: this.parseUnary() }
    }
    if (t.type === 'minus') {
      this.consume('minus')
      return { kind: 'unary', op: 'minus', operand: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  // 主:字面量 / 标识符(含成员访问)/ 括号
  private parsePrimary(): Node {
    const t = this.peek()
    if (t.type === 'number') {
      this.consume('number')
      return { kind: 'literal', value: Number(t.value) }
    }
    if (t.type === 'string') {
      this.consume('string')
      return { kind: 'literal', value: t.value }
    }
    if (t.type === 'boolean') {
      this.consume('boolean')
      return { kind: 'literal', value: t.value === 'true' }
    }
    if (t.type === 'null') {
      this.consume('null')
      return { kind: 'literal', value: null }
    }
    if (t.type === 'lparen') {
      this.consume('lparen')
      const inner = this.parseTernary()
      this.consume('rparen')
      return inner
    }
    if (t.type === 'identifier') {
      this.consume('identifier')
      const path = [t.value]
      while (this.peek().type === 'dot') {
        this.consume('dot')
        const next = this.consume('identifier')
        path.push(next.value)
      }
      return { kind: 'identifier', path }
    }
    throw new Error(`意外的 token: ${t.value || t.type}`)
  }
}

// ============ Evaluator ============

function lookup(path: string[], context: Record<string, unknown>): unknown {
  let cur: unknown = context
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function evaluate(node: Node, context: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value
    case 'identifier':
      return lookup(node.path, context)
    case 'unary': {
      const v = evaluate(node.operand, context)
      if (node.op === 'not') return !v
      if (node.op === 'minus') return -toNumber(v)
      return undefined
    }
    case 'ternary': {
      const cond = evaluate(node.cond, context)
      return cond ? evaluate(node.then, context) : evaluate(node.else, context)
    }
    case 'binary': {
      // 短路求值
      if (node.op === '&&') {
        return evaluate(node.left, context) ? evaluate(node.right, context) : false
      }
      if (node.op === '||') {
        return evaluate(node.left, context) ? true : evaluate(node.right, context)
      }
      const l = evaluate(node.left, context)
      const r = evaluate(node.right, context)
      switch (node.op) {
        case '+':
          return toNumber(l) + toNumber(r)
        case '-':
          return toNumber(l) - toNumber(r)
        case '*':
          return toNumber(l) * toNumber(r)
        case '/':
          return toNumber(l) / toNumber(r)
        case '%':
          return toNumber(l) % toNumber(r)
        case '<':
          return compare(l, r) < 0
        case '>':
          return compare(l, r) > 0
        case '<=':
          return compare(l, r) <= 0
        case '>=':
          return compare(l, r) >= 0
        case '==':
          return looseEquals(l, r)
        case '!=':
          return !looseEquals(l, r)
        case '===':
          return strictEquals(l, r)
        case '!==':
          return !strictEquals(l, r)
        default:
          throw new Error(`未知运算符: ${node.op}`)
      }
    }
  }
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') return Number(v)
  if (v === null || v === undefined) return 0
  return NaN
}

function compare(l: unknown, r: unknown): number {
  if (typeof l === 'number' && typeof r === 'number') return l - r
  if (typeof l === 'string' && typeof r === 'string') {
    return l < r ? -1 : l > r ? 1 : 0
  }
  return toNumber(l) - toNumber(r)
}

function looseEquals(l: unknown, r: unknown): boolean {
  // 模拟 JS == 语义(null == undefined)
  if ((l === null || l === undefined) && (r === null || r === undefined)) return true
  if (l === null || l === undefined || r === null || r === undefined) return false
  if (typeof l === typeof r) return strictEquals(l, r)
  // 数字与字符串比较:转数字
  if (typeof l === 'number' && typeof r === 'string') return l === Number(r)
  if (typeof l === 'string' && typeof r === 'number') return Number(l) === r
  // 布尔转数字
  if (typeof l === 'boolean') return looseEquals(toNumber(l), r)
  if (typeof r === 'boolean') return looseEquals(l, toNumber(r))
  return false
}

function strictEquals(l: unknown, r: unknown): boolean {
  if (typeof l !== typeof r) return false
  if (typeof l === 'number' || typeof l === 'string' || typeof l === 'boolean' || l === null || l === undefined) {
    return l === r
  }
  // 对象:仅引用相等
  return l === r
}

// ============ 公开 API ============

/**
 * 安全求值布尔条件表达式。
 *
 * @param condition 表达式,如 `count > 10 && status === 'active'`
 * @param context 变量上下文
 * @returns 布尔结果;语法/运行时错误统一返回 false
 */
export function evaluateSafeCondition(
  condition: string,
  context: Record<string, unknown>,
): boolean {
  if (typeof condition !== 'string' || condition.trim() === '') return true
  try {
    const tokens = tokenize(condition)
    const ast = new Parser(tokens).parse()
    const result = evaluate(ast, context ?? {})
    return !!result
  } catch {
    return false
  }
}
