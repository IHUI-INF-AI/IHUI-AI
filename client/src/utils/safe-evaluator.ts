/**
 * 安全表达式评估器
 * 用于替代 new Function 的代码注入风险
 */

/**
 * 支持的操作符和函数
 */
const ALLOWED_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  // 数学函数 - 使用箭头函数包装以确保类型安全
  abs: (x: unknown) => Math.abs(Number(x)),
  ceil: (x: unknown) => Math.ceil(Number(x)),
  floor: (x: unknown) => Math.floor(Number(x)),
  round: (x: unknown) => Math.round(Number(x)),
  max: (...args: unknown[]) => Math.max(...(args.map(a => Number(a)))),
  min: (...args: unknown[]) => Math.min(...(args.map(a => Number(a)))),
  pow: (x: unknown, y: unknown) => Math.pow(Number(x), Number(y)),
  sqrt: (x: unknown) => Math.sqrt(Number(x)),
  log: (x: unknown) => Math.log(Number(x)),
  log10: (x: unknown) => Math.log10(Number(x)),
  log2: (x: unknown) => Math.log2(Number(x)),
  exp: (x: unknown) => Math.exp(Number(x)),
  sin: (x: unknown) => Math.sin(Number(x)),
  cos: (x: unknown) => Math.cos(Number(x)),
  tan: (x: unknown) => Math.tan(Number(x)),
  asin: (x: unknown) => Math.asin(Number(x)),
  acos: (x: unknown) => Math.acos(Number(x)),
  atan: (x: unknown) => Math.atan(Number(x)),
  atan2: (y: unknown, x: unknown) => Math.atan2(Number(y), Number(x)),
  sign: (x: unknown) => Math.sign(Number(x)),
  trunc: (x: unknown) => Math.trunc(Number(x)),

  // 字符串函数
  len: (s: unknown) => typeof s === 'string' ? s.length : 0,
  length: (s: unknown) => typeof s === 'string' ? s.length : 0,
  toString: (v: unknown) => String(v),
  String: (v: unknown) => String(v),
  Number: (v: unknown) => Number(v),
  Boolean: (v: unknown) => Boolean(v),

  // 类型检查
  typeof: (v: unknown) => typeof v,
  isNaN: (v: unknown) => isNaN(Number(v)),
  isFinite: (v: unknown) => isFinite(Number(v)),
  isNull: (v: unknown) => v === null,
  isUndefined: (v: unknown) => v === undefined,
  isEmpty: (v: unknown) => v === null || v === undefined || v === '',

  // 比较
  equals: (a: unknown, b: unknown) => a === b,
  notEquals: (a: unknown, b: unknown) => a !== b,

  // 数组辅助
  includes: (arr: unknown, item: unknown) => Array.isArray(arr) && (arr as unknown[]).includes(item),
  'in': (key: unknown, obj: unknown) => typeof obj === 'object' && obj !== null && String(key) in (obj as Record<string, unknown>),
}

/**
 * 禁止的模式
 */
const FORBIDDEN_PATTERNS = [
  /import\s*\(/,
  /eval\s*\(/,
  /Function\s*\(/,
  /\brequire\s*\(/,
  /document\s*\./,
  /window\s*\./,
  /localStorage\s*\./,
  /sessionStorage\s*\./,
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /setTimeout\s*\(/,
  /setInterval\s*\(/,
  /<\/?[a-z]+[^>]*>/i,
  /javascript\s*:/i,
  /data\s*:/i,
  /\breturn\b/,
  /\bawait\b/,
  /\byield\b/,
  /;/,
  /\{[^}]*\{/,  // 嵌套块
  /\(\s*\(/,     // 立即调用函数
]

/**
 * Token 类型
 */
type TokenType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'NULL' | 'UNDEFINED' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA' | 'EOF'

interface Token {
  type: TokenType
  value: string
  numericValue?: number
}

/**
 * 词法分析器
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  const expr = expression.trim()
  
  while (pos < expr.length) {
    const char = expr[pos]
    
    // 跳过空白
    if (/\s/.test(char)) {
      pos++
      continue
    }
    
    // 数字
    if (/\d/.test(char) || (char === '.' && /\d/.test(expr[pos + 1]))) {
      let numStr = ''
      while (pos < expr.length && /[\d.]/.test(expr[pos])) {
        numStr += expr[pos++]
      }
      tokens.push({ type: 'NUMBER', value: numStr, numericValue: parseFloat(numStr) })
      continue
    }
    
    // 字符串
    if (char === '"' || char === "'") {
      const quote = char
      let str = ''
      pos++ // 跳过开始引号
      while (pos < expr.length && expr[pos] !== quote) {
        if (expr[pos] === '\\' && pos + 1 < expr.length) {
          str += expr[++pos]
        }
        str += expr[pos++]
      }
      pos++ // 跳过结束引号
      tokens.push({ type: 'STRING', value: str })
      continue
    }
    
    // 布尔值和 null
    if (expr.substring(pos, pos + 4) === 'true') {
      tokens.push({ type: 'BOOLEAN', value: 'true', numericValue: 1 })
      pos += 4
      continue
    }
    if (expr.substring(pos, pos + 5) === 'false') {
      tokens.push({ type: 'BOOLEAN', value: 'false', numericValue: 0 })
      pos += 5
      continue
    }
    if (expr.substring(pos, pos + 4) === 'null') {
      tokens.push({ type: 'NULL', value: 'null' })
      pos += 4
      continue
    }
    if (expr.substring(pos, pos + 9) === 'undefined') {
      tokens.push({ type: 'UNDEFINED', value: 'undefined' })
      pos += 9
      continue
    }
    
    // 标识符（变量名或函数名）
    if (/[a-zA-Z_$]/.test(char)) {
      let id = ''
      while (pos < expr.length && /[a-zA-Z0-9_$]/.test(expr[pos])) {
        id += expr[pos++]
      }
      tokens.push({ type: 'IDENTIFIER', value: id })
      continue
    }
    
    // 操作符
    if ('!== != === == >= <= > < && || + - * / % ? :'.includes(char) || 
        (char === '=' && tokens.length > 0 && tokens[tokens.length - 1].type === 'OPERATOR')) {
      let op = char
      pos++
      // 处理双字符操作符
      if (pos < expr.length) {
        const next = expr[pos]
        if ((char === '!' && next === '=') ||
            (char === '=' && next === '=') ||
            (char === '>' && next === '=') ||
            (char === '<' && next === '=') ||
            (char === '&' && next === '&') ||
            (char === '|' && next === '|')) {
          op += next
          pos++
        }
      }
      // 单独 = 不是有效操作符（应该是 == 或 ===）
      if (op === '=' && tokens[tokens.length - 1]?.type !== 'OPERATOR') {
        // 单个 = 在上下文中可能是错误的，但我们可以尝试处理
      }
      if (op !== '=' || tokens[tokens.length - 1]?.type === 'OPERATOR') {
        tokens.push({ type: 'OPERATOR', value: op })
      }
      continue
    }
    
    // 括号
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' })
      pos++
      continue
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' })
      pos++
      continue
    }
    if (char === '[') {
      tokens.push({ type: 'LBRACKET', value: '[' })
      pos++
      continue
    }
    if (char === ']') {
      tokens.push({ type: 'RBRACKET', value: ']' })
      pos++
      continue
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',' })
      pos++
      continue
    }
    
    // 未知字符，跳过
    pos++
  }
  
  tokens.push({ type: 'EOF', value: '' })
  return tokens
}

/**
 * 安全表达式评估
 */
export function safeEvaluate(
  expression: string,
  context: Record<string, unknown> = {}
): { success: boolean; result?: unknown; error?: string } {
  // 前置安全检查
  if (!expression || expression.trim().length === 0) {
    return { success: false, error: 'Empty expression' }
  }
  
  if (expression.length > 500) {
    return { success: false, error: 'Expression too long' }
  }
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(expression)) {
      return { success: false, error: `Expression contains forbidden pattern` }
    }
  }
  
  try {
    const tokens = tokenize(expression)
    
    // 简单的递归下降解析器
    let pos = 0
    
    const peek = () => tokens[pos]
    const consume = () => tokens[pos++]
    
    const parseExpression = (): unknown => {
      return parseComparison()
    }

    const parseComparison = (): unknown => {
      let left: unknown = parseAddSub()
      
      while (peek().type === 'OPERATOR' && ['==', '!=', '===', '!==', '>', '<', '>=', '<='].includes(peek().value)) {
        const op = consume().value
        const right = parseAddSub()
        
        switch (op) {
          case '==': case '===': left = left === right; break
          case '!=': case '!==': left = left !== right; break
          case '>': left = Number(left) > Number(right); break
          case '<': left = Number(left) < Number(right); break
          case '>=': left = Number(left) >= Number(right); break
          case '<=': left = Number(left) <= Number(right); break
        }
      }
      
      return left
    }
    
    const parseAddSub = (): unknown => {
      let left: unknown = parseMulDiv()
      
      while (peek().type === 'OPERATOR' && ['+', '-', '&&', '||'].includes(peek().value)) {
        const op = consume().value
        const right = parseMulDiv()
        
        if (op === '+') {
          left = String(left) + String(right)
        } else if (op === '-') {
          left = Number(left) - Number(right)
        } else if (op === '&&') {
          left = Boolean(left) && Boolean(right)
        } else if (op === '||') {
          left = Boolean(left) || Boolean(right)
        }
      }
      
      return left
    }
    
    const parseMulDiv = (): unknown => {
      let left: unknown = parseUnary()
      
      while (peek().type === 'OPERATOR' && ['*', '/', '%'].includes(peek().value)) {
        const op = consume().value
        const right = parseUnary()
        
        switch (op) {
          case '*': left = Number(left) * Number(right); break
          case '/': left = Number(left) / Number(right); break
          case '%': left = Number(left) % Number(right); break
        }
      }
      
      return left
    }
    
    const parseUnary = (): unknown => {
      if (peek().type === 'OPERATOR' && peek().value === '!') {
        consume()
        return !parseUnary()
      }
      if (peek().type === 'OPERATOR' && peek().value === '-') {
        consume()
        return -Number(parseUnary())
      }
      return parsePrimary()
    }
    
    const parsePrimary = (): unknown => {
      const token = peek()
      
      // 数字
      if (token.type === 'NUMBER') {
        consume()
        return token.numericValue
      }
      
      // 字符串
      if (token.type === 'STRING') {
        consume()
        return token.value
      }
      
      // 布尔值
      if (token.type === 'BOOLEAN') {
        consume()
        return token.value === 'true'
      }
      
      // null
      if (token.type === 'NULL') {
        consume()
        return null
      }
      
      // undefined
      if (token.type === 'UNDEFINED') {
        consume()
        return undefined
      }
      
      // 括号表达式
      if (token.type === 'LPAREN') {
        consume()
        const result = parseExpression()
        if (peek().type !== 'RPAREN') {
          return { success: false, error: 'Missing closing parenthesis' }
        }
        consume()
        return result
      }
      
      // 数组字面量
      if (token.type === 'LBRACKET') {
        consume()
        const items: unknown[] = []
        while (peek().type !== 'RBRACKET' && peek().type !== 'EOF') {
          items.push(parseExpression())
          if (peek().type === 'COMMA') consume()
        }
        if (peek().type !== 'RBRACKET') {
          return { success: false, error: 'Missing closing bracket' }
        }
        consume()
        return items
      }
      
      // 标识符或函数调用
      if (token.type === 'IDENTIFIER') {
        const name = consume().value
        
        // 函数调用
        if (peek().type === 'LPAREN') {
          consume() // (
          const args: unknown[] = []
          while (peek().type !== 'RPAREN' && peek().type !== 'EOF') {
            args.push(parseExpression())
            if (peek().type === 'COMMA') consume()
          }
          if (peek().type !== 'RPAREN') {
            return { success: false, error: 'Missing closing parenthesis in function call' }
          }
          consume() // )
          
          // 内置函数
          if (name in ALLOWED_FUNCTIONS) {
            return ALLOWED_FUNCTIONS[name](...args)
          }
          
          // 上下文中的函数
          if (typeof context[name] === 'function') {
            return (context[name] as (...args: unknown[]) => unknown)(...args)
          }
          
          // 上下文中的值
          if (name in context) {
            return context[name]
          }
          
          return undefined
        }
        
        // 简单标识符 - 从上下文获取
        if (name in context) {
          return context[name]
        }
        
        return undefined
      }
      
      return undefined
    }
    
    const result = parseExpression()
    return { success: true, result }
    
  } catch (e) {
    return { success: false, error: `Evaluation error: ${e instanceof Error ? e.message : 'Unknown error'}` }
  }
}

/**
 * 简单的条件评估（返回布尔值）
 */
export function evaluateCondition(
  condition: string,
  context: Record<string, unknown> = {}
): boolean {
  const result = safeEvaluate(condition, context)
  if (!result.success) {
    console.warn('[SafeEvaluator] Condition evaluation failed:', result.error)
    return false
  }
  return Boolean(result.result)
}
