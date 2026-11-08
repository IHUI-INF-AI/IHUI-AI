// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 共享 SQL 语句分割器（DB-04 / DB-06）。
 *
 * 两个手工迁移执行器（apply-migration.mjs / apply-all-migrations.mjs）共用本模块，
 * 避免各自实现漂移：只认 `$$` 会把 `$fn$` / `$con$` / `$ot_conv$` 切碎；
 * 不认 `/* *\/` 会把块注释里的分号当语句边界。
 *
 * 支持：
 *  - 单引号字符串（含 `''` 转义）
 *  - 双引号标识符（含 `""` 转义）
 *  - 行注释 `--`
 *  - 块注释 `/* *\/`（含 PostgreSQL 允许的嵌套块注释）
 *  - 命名 dollar-quote `$tag$ ... $tag$`（含匿名 `$$`）
 *  - 顶层分号作为语句边界
 *
 * 返回 `{ statements, semicolonCount, balanced }`：
 *  - `semicolonCount` 为顶层分号数，调用方可用 `semicolonCount === statements.length`
 *    做严格切分自检（尾部仅注释片段不会产生幽灵语句）；
 *  - `balanced` 表示 dollar-quote / 引号 / 块注释是否全部闭合。
 */

const DOLLAR_TAG = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y

function readDollarTag(input, pos) {
  DOLLAR_TAG.lastIndex = pos
  const match = DOLLAR_TAG.exec(input)
  return match ? match[0] : null
}

export function splitSqlStatements(input) {
  const result = []
  const n = input.length

  let buffer = ''
  let hasContent = false
  let dollarTag = null
  let inSingleQuote = false
  let inDoubleQuote = false
  let blockDepth = 0
  let semicolonCount = 0
  let i = 0

  const flush = () => {
    if (hasContent) {
      const trimmed = buffer.trim()
      if (trimmed) result.push(trimmed)
    }
    buffer = ''
    hasContent = false
  }

  while (i < n) {
    const ch = input[i]

    if (blockDepth > 0) {
      if (ch === '/' && input[i + 1] === '*') {
        blockDepth++
        buffer += '/*'
        i += 2
        continue
      }
      if (ch === '*' && input[i + 1] === '/') {
        blockDepth--
        buffer += '*/'
        i += 2
        continue
      }
      buffer += ch
      i++
      continue
    }

    if (inSingleQuote) {
      buffer += ch
      if (ch === "'") {
        if (input[i + 1] === "'") {
          buffer += input[i + 1]
          i += 2
          continue
        }
        inSingleQuote = false
      }
      i++
      continue
    }

    if (inDoubleQuote) {
      buffer += ch
      if (ch === '"') {
        if (input[i + 1] === '"') {
          buffer += input[i + 1]
          i += 2
          continue
        }
        inDoubleQuote = false
      }
      i++
      continue
    }

    if (dollarTag !== null) {
      if (ch === '$' && readDollarTag(input, i) === dollarTag) {
        buffer += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buffer += ch
      i++
      continue
    }

    if (ch === '/' && input[i + 1] === '*') {
      blockDepth = 1
      buffer += '/*'
      i += 2
      continue
    }

    if (ch === '-' && input[i + 1] === '-') {
      const eol = input.indexOf('\n', i)
      if (eol === -1) {
        buffer += input.slice(i)
        i = n
      } else {
        buffer += input.slice(i, eol)
        i = eol
      }
      continue
    }

    if (ch === '$') {
      const tag = readDollarTag(input, i)
      if (tag !== null) {
        dollarTag = tag
        buffer += tag
        hasContent = true
        i += tag.length
        continue
      }
    }

    if (ch === "'") {
      inSingleQuote = true
      buffer += ch
      hasContent = true
      i++
      continue
    }

    if (ch === '"') {
      inDoubleQuote = true
      buffer += ch
      hasContent = true
      i++
      continue
    }

    if (ch === ';') {
      semicolonCount++
      flush()
      i++
      continue
    }

    if (!/\s/.test(ch)) hasContent = true
    buffer += ch
    i++
  }

  flush()

  return {
    statements: result,
    semicolonCount,
    balanced: dollarTag === null && !inSingleQuote && !inDoubleQuote && blockDepth === 0,
  }
}

/**
 * 去掉注释、保留字符串与 dollar-quote 正文，供执行策略做关键字判定
 * （例如只把可执行代码里的 CONCURRENTLY 视为需要拒绝的信号）。
 */
export function stripSqlComments(input) {
  const n = input.length
  let out = ''
  let dollarTag = null
  let inSingleQuote = false
  let inDoubleQuote = false
  let blockDepth = 0
  let i = 0

  while (i < n) {
    const ch = input[i]

    if (blockDepth > 0) {
      if (ch === '/' && input[i + 1] === '*') {
        blockDepth++
        i += 2
        continue
      }
      if (ch === '*' && input[i + 1] === '/') {
        blockDepth--
        i += 2
        continue
      }
      i++
      continue
    }

    if (inSingleQuote) {
      out += ch
      if (ch === "'") {
        if (input[i + 1] === "'") {
          out += input[i + 1]
          i += 2
          continue
        }
        inSingleQuote = false
      }
      i++
      continue
    }

    if (inDoubleQuote) {
      out += ch
      if (ch === '"') {
        if (input[i + 1] === '"') {
          out += input[i + 1]
          i += 2
          continue
        }
        inDoubleQuote = false
      }
      i++
      continue
    }

    if (dollarTag !== null) {
      if (ch === '$' && readDollarTag(input, i) === dollarTag) {
        out += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      out += ch
      i++
      continue
    }

    if (ch === '/' && input[i + 1] === '*') {
      blockDepth = 1
      out += ' '
      i += 2
      continue
    }

    if (ch === '-' && input[i + 1] === '-') {
      const eol = input.indexOf('\n', i)
      out += ' '
      i = eol === -1 ? n : eol
      continue
    }

    if (ch === '$') {
      const tag = readDollarTag(input, i)
      if (tag !== null) {
        dollarTag = tag
        out += tag
        i += tag.length
        continue
      }
    }

    if (ch === "'") {
      inSingleQuote = true
      out += ch
      i++
      continue
    }

    if (ch === '"') {
      inDoubleQuote = true
      out += ch
      i++
      continue
    }

    out += ch
    i++
  }

  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
