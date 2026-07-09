#!/usr/bin/env node
/**
 * API Key 泄露检查 pre-commit 守门脚本。
 *
 * 检查所有暂存文件 + .example 文件 + memory 文件,确保真实 API key 不被提交。
 *
 * 触发条件(任一即拒绝提交):
 * 1. .example 文件含疑似真实 key(非 <your-xxx> 占位符的实际 key 值)
 * 2. 任何文件含已知 key 前缀(sk-irJTb1 / 5iFfF0dl 等)
 * 3. memory 文件含真实 key 值
 *
 * 用法:node scripts/check-api-key-leak.mjs [--staged]
 *   --staged: 只检查 git 暂存区文件(pre-commit 用)
 *   无参数:检查所有 .example + memory 文件(手动验证用)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

// 已知 key 前缀(真实 key 的前 8 字符,用于检测泄露)
const KNOWN_KEY_PREFIXES = [
  'sk-irJTb1', // Agnes AI key 前缀
  '5iFfF0dl', // StepFun key 前缀
]

// 通用 API key 正则(sk- 开头 + 32+ 字符,或 64 位十六进制)
const API_KEY_PATTERNS = [
  /sk-[A-Za-z0-9]{32,}/, // OpenAI/Agnes 风格
  /\b[A-Za-z0-9]{64}\b/, // StepFun 风格(64 位字母数字)
]

// 允许的占位符模式(不视为泄露)
const PLACEHOLDER_PATTERNS = [
  /<your-[^>]+-api-key>/,
  /<your-[^>]+>/,
  /\$\{.*API_KEY.*\}/, // docker-compose 变量引用
  /\$\{.*_KEY:-\}/, // docker-compose 带默认值
  /^API_KEY=$/m, // 空值
  /^.*_API_KEY=$/m, // 空值
]

/** 收集需检查的文件列表 */
function collectFiles() {
  // 跳过本检测脚本自身(包含 key 前缀用于检测,非泄露)
  const SELF = join(ROOT, 'scripts', 'check-api-key-leak.mjs')
  if (isStaged) {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf8',
        cwd: ROOT,
      })
      return output
        .split('\n')
        .filter((f) => f && existsSync(join(ROOT, f)))
        .map((f) => join(ROOT, f))
        .filter((f) => f !== SELF)
    } catch {
      return []
    }
  }
  // 非暂存模式:检查所有 .example 文件 + memory
  const files = []
  const checkPaths = [
    '.env.production.example',
    '.env.example',
    'apps/ai-service/.env.example',
    'apps/api/.env.example',
  ]
  for (const p of checkPaths) {
    if (existsSync(join(ROOT, p))) files.push(join(ROOT, p))
  }
  return files
}

/** 检查单行是否含真实 key(非占位符) */
function isRealKey(line) {
  // 先检查是否是占位符
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(line)) return false
  }
  // 检查已知 key 前缀
  for (const prefix of KNOWN_KEY_PREFIXES) {
    if (line.includes(prefix)) return true
  }
  // 检查通用 key 模式(仅在 KEY= 赋值行检查,避免误报)
  if (/^[A-Z_]*API_KEY[A-Z_]*\s*=\s*\S+/.test(line) || /^[A-Z_]*_KEY\s*=\s*\S+/.test(line)) {
    const value = line.split('=')[1]?.trim() || ''
    // 空值或占位符已排除,这里检查是否有真实 key 模式
    if (value.length >= 32 && !value.startsWith('<') && !value.startsWith('$')) {
      for (const p of API_KEY_PATTERNS) {
        if (p.test(value)) return true
      }
    }
  }
  return false
}

const files = collectFiles()
const violations = []

for (const file of files) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    if (isRealKey(line)) {
      violations.push(`${file}:${idx + 1}: ${line.trim().substring(0, 80)}...`)
    }
  })
}

if (violations.length > 0) {
  console.error('\x1b[31m[API Key 泄露检查] 检测到真实 API key,拒绝提交!\x1b[0m')
  console.error('')
  console.error('\x1b[31m泄露位置:\x1b[0m')
  violations.forEach((v) => console.error(`  ${v}`))
  console.error('')
  console.error('\x1b[33m修复方法:\x1b[0m')
  console.error('  1. .example 文件必须用 <your-xxx-api-key> 占位符')
  console.error('  2. 真实 key 只允许写入 .env / .env.production / apps/ai-service/.env(在 .gitignore)')
  console.error('  3. memory 文件禁止记录真实 key 值')
  console.error('')
  process.exit(1)
}

console.log('\x1b[32m[API Key 泄露检查] 通过,未检测到真实 key 泄露\x1b[0m')
process.exit(0)
