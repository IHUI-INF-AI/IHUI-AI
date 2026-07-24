#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 守门脚本共享工具模块。
 *
 * 提取所有 check-*.mjs / scan-*.mjs 脚本的重复逻辑:
 * - git staged 文件获取
 * - CLI 参数解析(--staged / --target=xxx)
 * - 统一颜色输出
 * - 统一退出码
 * - glob 模式过滤
 *
 * 纯 Node.js 内置模块,不依赖第三方。
 *
 * 用法:
 *   import { getStagedFiles, isStaged, colorError, ... } from './guardian-utils.mjs'
 *
 * 直接运行:
 *   node scripts/guardian-utils.mjs --help   打印帮助
 *   node scripts/guardian-utils.mjs          打印导出列表
 */
import { execSync } from 'node:child_process'

// === 颜色常量 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === CLI 参数解析 ===

/** 检查是否传入了 --staged 参数 */
export function isStaged() {
  return process.argv.includes('--staged')
}

/**
 * 解析 --target=xxx 参数(等号形式),返回 target 值或空字符串。
 * 优先解析 --target=xxx,其次解析 --target xxx(空格分隔形式)。
 */
export function getTarget() {
  for (const arg of process.argv) {
    if (arg.startsWith('--target=')) {
      return arg.slice('--target='.length)
    }
  }
  const idx = process.argv.indexOf('--target')
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1]
  }
  return ''
}

// === Git 操作 ===

/**
 * 获取 staged 文件列表。
 * @returns {string[]} 文件路径数组(相对路径),git 不可用时返回空数组
 */
export function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      cwd: process.cwd(),
    })
    return output.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 获取 staged 文件列表(带 diff-filter)。
 * @param {string} filter - git diff-filter 字符串,如 'ACMR'
 * @returns {string[]} 文件路径数组
 */
export function getStagedFilesFiltered(filter = 'ACMR') {
  try {
    const output = execSync(`git diff --cached --name-only --diff-filter=${filter}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    })
    return output.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// === 颜色输出 ===

export function colorWarn(msg) {
  console.warn(`${C.yellow}${msg}${C.reset}`)
}

export function colorError(msg) {
  console.error(`${C.red}${msg}${C.reset}`)
}

export function colorSuccess(msg) {
  console.log(`${C.green}${msg}${C.reset}`)
}

export function colorInfo(msg) {
  console.log(`${C.cyan}${msg}${C.reset}`)
}

// === 退出码 ===

export function exitFail(code = 1) {
  process.exit(code)
}

export function exitPass(code = 0) {
  process.exit(code)
}

// === Glob 模式过滤 ===

/**
 * 将 glob 模式转换为正则表达式。
 * 支持 * (单层通配,不含 /)、** (多层通配)、? (单字符)。
 * @param {string} pattern - glob 模式
 * @returns {RegExp} 正则表达式
 */
function globToRegex(pattern) {
  let regex = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*'
        i++
      } else {
        regex += '[^/]*'
      }
    } else if (c === '?') {
      regex += '[^/]'
    } else if ('.+^${}()|[]\\'.includes(c)) {
      regex += '\\' + c
    } else {
      regex += c
    }
  }
  return new RegExp(regex + '$')
}

/**
 * 按 glob 模式过滤文件列表。
 * @param {string[]} files - 文件路径数组
 * @param {string[]} patterns - glob 模式数组(支持 * 单层和 ** 多层通配符,如 apps/web/ 下所有 .ts)
 * @returns {string[]} 匹配任一模式的文件
 */
export function filterStagedByPatterns(files, patterns) {
  const regexes = patterns.map(globToRegex)
  return files.filter((f) => regexes.some((re) => re.test(f)))
}

// === Help / 直接运行 ===

const helpText = `guardian-utils.mjs — 守门脚本共享工具模块

导出函数:
  getStagedFiles()               获取 staged 文件列表(git diff --cached --name-only)
  getStagedFilesFiltered(filter)  获取 staged 文件列表(带 diff-filter,默认 ACMR)
  isStaged()                      检查 --staged 参数
  getTarget()                     解析 --target=xxx / --target xxx 参数
  colorWarn(msg)                  黄色警告输出
  colorError(msg)                 红色错误输出
  colorSuccess(msg)               绿色成功输出
  colorInfo(msg)                  青色信息输出
  exitFail(code=1)                以失败码退出
  exitPass(code=0)                以成功码退出
  filterStagedByPatterns(files, patterns)  按 glob 模式过滤文件

用法:
  import { getStagedFiles, isStaged } from './guardian-utils.mjs'
`

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('guardian-utils.mjs')) {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(helpText)
    process.exit(0)
  }
  console.log('guardian-utils.mjs — 守门脚本共享工具模块(已加载)')
  console.log('Exports: getStagedFiles, getStagedFilesFiltered, isStaged, getTarget,')
  console.log('         colorWarn, colorError, colorSuccess, colorInfo,')
  console.log('         exitFail, exitPass, filterStagedByPatterns')
  console.log('Use --help for usage details.')
  process.exit(0)
}
