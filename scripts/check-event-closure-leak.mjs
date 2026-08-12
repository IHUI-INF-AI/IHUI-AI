#!/usr/bin/env node
/**
 * check-event-closure-leak.mjs
 *
 * 守门:禁止在 setTimeout / setInterval / requestAnimationFrame /
 * queueMicrotask 等异步回调的第一个参数(箭头函数体)内访问
 * React SyntheticEvent 的属性 / 方法。
 *
 * 触发背景(2026-08-12 真实 bug):
 *   apps/web/src/components/chat/model-selector.tsx 原 onMouseLeave 写:
 *     setTimeout(() => {
 *       setPopoverAnchor((prev) => (prev?.el === e.currentTarget ? null : prev))
 *     }, 100)
 *   React 17+ SyntheticEvent 在 handler 返回后 currentTarget 置 null,
 *   setTimeout 触发时 prev?.el === null 永远 false,关闭分支永远不进 → popover 常驻显示。
 *
 * 正确做法:
 *   - 在 handler 同步阶段 const el = e.currentTarget 缓存到闭包变量
 *   - 或用 useRef 管理 DOM 元素(anchorRef.current 替代 e.currentTarget)
 *   - 异步闭包内禁止访问 event 任何属性(React 17+ 全部可能失效)
 *
 * 检测方法:
 *   用括号配对算法提取 setTimeout/setInterval/requestAnimationFrame/queueMicrotask
 *   的第一个参数(callback)文本,在该文本内搜 e.X 模式。
 *   这样可以避免误报"同一文件 40 行内"的所有 setTimeout 与所有 e.X 关联。
 *
 * 同步回调(onKeyDown / onMouseDown / onMouseEnter 等 handler 体内)访问 e.X 是合法的,
 * 因为 React SyntheticEvent 在 handler 同步执行期间 currentTarget / target 有效。
 *
 * 用法:
 *   node scripts/check-event-closure-leak.mjs --staged          # 扫 staged(默认)
 *   node scripts/check-event-closure-leak.mjs --all             # 扫 apps/web/src
 *   node scripts/check-event-closure-leak.mjs <file1> <file2>   # 扫指定文件
 *
 * 退出码:
 *   0 = 无命中
 *   1 = 发现反模式(阻塞)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 异步回调触发器
const ASYNC_TRIGGERS = [
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'requestIdleCallback',
  'queueMicrotask',
]

// 异步闭包内禁用的 event 属性 / 方法
const FORBIDDEN_EVENT_ACCESS = [
  'e.currentTarget',
  'e.target',
  'e.preventDefault',
  'e.stopPropagation',
  'event.currentTarget',
  'event.target',
  'event.preventDefault',
  'event.stopPropagation',
]

function getStagedFiles() {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
      { encoding: 'utf8', cwd: process.cwd() },
    )
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => /\.(tsx?|jsx?)$/i.test(f))
  } catch {
    return []
  }
}

function getAllWebFiles() {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', 'apps/web/src'],
      { encoding: 'utf8', cwd: process.cwd() },
    )
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => /\.(tsx?|jsx?)$/i.test(f))
  } catch {
    return []
  }
}

/**
 * 在 source 中找所有 `setTimeout( ... )` / `requestAnimationFrame( ... )` 等
 * 的调用点,并精确提取其第一个参数(回调函数)的源代码文本。
 *
 * 使用括号配对算法,处理嵌套括号 / 字符串 / 模板字符串 / 注释。
 *
 * @returns {Array<{ start: number, end: number, callback: string, line: number, trigger: string }>}
 */
function findAsyncCallbacks(source) {
  const results = []
  const triggerRegex = new RegExp(
    `\\b(${ASYNC_TRIGGERS.join('|')})\\s*\\(`,
    'g',
  )

  let m
  while ((m = triggerRegex.exec(source)) !== null) {
    const triggerStart = m.index
    const openParenIdx = triggerRegex.lastIndex - 1 // '(' 位置
    const trigger = m[1]

    // 从 ( 开始配对找匹配的 )
    let depth = 1
    let i = openParenIdx + 1
    let inString = null // '"' | "'" | '`'
    let inLineComment = false
    let inBlockComment = false
    while (i < source.length && depth > 0) {
      const c = source[i]
      const next = source[i + 1]

      if (inLineComment) {
        if (c === '\n') inLineComment = false
        i++
        continue
      }
      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false
          i += 2
          continue
        }
        i++
        continue
      }
      if (inString) {
        if (c === '\\') {
          i += 2
          continue
        }
        if (c === inString) {
          inString = null
        }
        i++
        continue
      }

      if (c === '/' && next === '/') {
        inLineComment = true
        i += 2
        continue
      }
      if (c === '/' && next === '*') {
        inBlockComment = true
        i += 2
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        inString = c
        i++
        continue
      }
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
      i++
    }

    if (depth !== 0) continue // 不平衡,跳过

    // 第一个参数是 openParenIdx+1 .. 第一个顶层逗号(深度=1 时)
    // 简化:从 ( 后到第一个顶层逗号或 ( 之前的位置
    let argEnd = openParenIdx + 1
    let argDepth = 0
    let argInString = null
    let argInLineComment = false
    let argInBlockComment = false
    while (argEnd < i) {
      const c = source[argEnd]
      const next = source[argEnd + 1]
      if (argInLineComment) {
        if (c === '\n') argInLineComment = false
        argEnd++
        continue
      }
      if (argInBlockComment) {
        if (c === '*' && next === '/') {
          argInBlockComment = false
          argEnd += 2
          continue
        }
        argEnd++
        continue
      }
      if (argInString) {
        if (c === '\\') {
          argEnd += 2
          continue
        }
        if (c === argInString) argInString = null
        argEnd++
        continue
      }
      if (c === '/' && next === '/') {
        argInLineComment = true
        argEnd += 2
        continue
      }
      if (c === '/' && next === '*') {
        argInBlockComment = true
        argEnd += 2
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        argInString = c
        argEnd++
        continue
      }
      if (c === '(' || c === '[' || c === '{') argDepth++
      else if (c === ')' || c === ']' || c === '}') argDepth--
      else if (c === ',' && argDepth === 0) break
      argEnd++
    }

    const callbackText = source.slice(openParenIdx + 1, argEnd).trim()
    if (!callbackText) continue

    // 计算 callback 起始行号
    const beforeCallback = source.slice(0, openParenIdx + 1)
    const callbackStartLine = beforeCallback.split('\n').length

    results.push({
      start: openParenIdx + 1,
      end: argEnd,
      callback: callbackText,
      line: callbackStartLine,
      trigger,
    })
  }
  return results
}

/**
 * 在 callback 文本中找 e.X / event.X 访问,排除注释
 */
function findForbiddenAccessInCallback(callbackText) {
  const hits = []
  const lines = callbackText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    // 去掉行内注释
    const stripped = lines[i]
      .replace(/\/\/.*$/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const forbidden of FORBIDDEN_EVENT_ACCESS) {
      // 单词边界,避免误中变量名
      const re = new RegExp(`\\b${forbidden.replace('.', '\\.')}\\b`)
      if (re.test(stripped)) {
        hits.push({
          access: forbidden,
          lineOffset: i,
          code: lines[i].trim(),
        })
        break // 一行只报一次
      }
    }
  }
  return hits
}

function findViolations(source, filePath) {
  const violations = []
  const callbacks = findAsyncCallbacks(source)
  for (const cb of callbacks) {
    const hits = findForbiddenAccessInCallback(cb.callback)
    for (const hit of hits) {
      violations.push({
        file: filePath,
        line: cb.line + hit.lineOffset,
        trigger: cb.trigger,
        access: hit.access,
        code: hit.code,
      })
    }
  }
  return violations
}

function main() {
  const args = process.argv.slice(2)
  let files = []
  if (args.length === 0 || args[0] === '--staged') {
    files = getStagedFiles()
  } else if (args[0] === '--all') {
    files = getAllWebFiles()
  } else {
    files = args.filter((f) => /\.(tsx?|jsx?)$/i.test(f))
  }

  if (files.length === 0) {
    console.log('✅ event-closure-leak: 无文件需扫描')
    return 0
  }

  console.log(`🔍 event-closure-leak: 扫描 ${files.length} 个文件...`)
  const allViolations = []
  for (const rel of files) {
    const abs = resolve(process.cwd(), rel)
    if (!existsSync(abs)) continue
    const src = readFileSync(abs, 'utf8')
    const violations = findViolations(src, rel)
    allViolations.push(...violations)
  }

  if (allViolations.length === 0) {
    console.log(`✅ event-closure-leak: ${files.length} 文件 0 命中`)
    return 0
  }

  console.error(`\n❌ event-closure-leak: 发现 ${allViolations.length} 处反模式\n`)
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    触发器: ${v.trigger}() 闭包内访问 ${v.access}`)
    console.error(`    代码: ${v.code}`)
    console.error('')
  }
  console.error('💡 修复方案:')
  console.error('   1. 在 handler 同步阶段 const el = e.currentTarget 缓存')
  console.error('   2. 或用 useRef 管理 DOM 元素(anchorRef.current 替代 e.currentTarget)')
  console.error('   3. 异步闭包内禁止访问 event 任何属性(React 17+ 全部可能失效)')
  console.error('   4. 参考 apps/web/src/components/chat/model-selector.tsx MemberDiscountSection')
  return 1
}

process.exit(main())
