#!/usr/bin/env node
/**
 * i18n 键完整性检查守门脚本。
 *
 * 扫描 apps/web/app 下所有 .tsx 文件的 useTranslations('xxx') + t('key') 调用,
 * 与 messages/zh-CN.json 和 en.json 比对,报告缺失键。
 *
 * 防止"代码调用 t('xxx') 但 messages 未定义 xxx"导致运行时显示 key 名而非文案。
 *
 * 触发条件(任一即失败):
 * 1. t('key') 调用的 key 在 zh-CN.json 对应命名空间中不存在
 * 2. t('key') 调用的 key 在 en.json 对应命名空间中不存在
 * 3. zh-CN.json 与 en.json 的键集不一致(parity)
 *
 * 用法:node scripts/check-i18n-keys.mjs [--staged]
 *   --staged: 只检查 git 暂存区涉及的 .tsx / messages 文件(pre-commit 用)
 *   无参数:全量检查(CI 用)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const MESSAGES_DIR = join(ROOT, 'apps/web/messages')
const APP_DIR = join(ROOT, 'apps/web/app')

/** 递归收集目录下所有 .tsx 文件 */
function collectTsxFiles(dir) {
  const result = []
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      result.push(...collectTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      result.push(full)
    }
  }
  return result
}

/** 从源码提取 useTranslations 命名空间 */
function extractNamespace(src) {
  const m = src.match(/useTranslations\(\s*['"]([^'"]+)['"]\s*\)/)
  return m ? m[1] : null
}

/** 从源码提取所有 t('key') / t("key") 调用的 key(排除 toast( / get( 等) */
function extractTKeys(src) {
  const keys = new Set()
  const re = /\bt\(\s*['"]([^'"]+)['"]/g
  let mm
  while ((mm = re.exec(src)) !== null) {
    keys.add(mm[1])
  }
  return [...keys]
}

/** 按点号路径从 messages 对象取嵌套值 */
function getNested(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => {
    if (acc && typeof acc === 'object' && k in acc) return acc[k]
    return undefined
  }, obj)
}

/** 收集一个对象的所有叶子键(用于 parity 检查) */
function collectLeafKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

// --- 收集需检查的文件 ---
let tsxFiles
let messagesChanged = false

if (isStaged) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    const staged = output.split('\n').filter(Boolean)
    // 如果暂存区含 .tsx 文件,检查这些;如果暂存区含 messages/*.json,触发全量(因影响面广)
    tsxFiles = staged
      .filter((f) => f.startsWith('apps/web/app/') && f.endsWith('.tsx'))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
    messagesChanged = staged.some(
      (f) => f.startsWith('apps/web/messages/') && f.endsWith('.json'),
    )
    if (messagesChanged) {
      // messages 文件变更,全量检查所有 tsx
      tsxFiles = collectTsxFiles(APP_DIR)
    }
  } catch {
    tsxFiles = []
  }
} else {
  tsxFiles = collectTsxFiles(APP_DIR)
}

if (tsxFiles.length === 0 && !messagesChanged) {
  console.log('\x1b[32m[i18n 键检查] 无 .tsx / messages 文件变更,跳过\x1b[0m')
  process.exit(0)
}

// --- 加载 messages 文件 ---
const zhPath = join(MESSAGES_DIR, 'zh-CN.json')
const enPath = join(MESSAGES_DIR, 'en.json')

if (!existsSync(zhPath) || !existsSync(enPath)) {
  console.log('\x1b[33m[i18n 键检查] messages 文件不存在,跳过\x1b[0m')
  process.exit(0)
}

let zhMsg, enMsg
try {
  zhMsg = JSON.parse(readFileSync(zhPath, 'utf8'))
  enMsg = JSON.parse(readFileSync(enPath, 'utf8'))
} catch (e) {
  console.error('\x1b[31m[i18n 键检查] messages JSON 解析失败:' + e.message + '\x1b[0m')
  process.exit(1)
}

// --- 检查 zh/en parity(全局) ---
const zhLeaves = new Set(collectLeafKeys(zhMsg))
const enLeaves = new Set(collectLeafKeys(enMsg))
const zhOnly = [...zhLeaves].filter((k) => !enLeaves.has(k))
const enOnly = [...enLeaves].filter((k) => !zhLeaves.has(k))

const violations = []

if (zhOnly.length > 0 || enOnly.length > 0) {
  if (zhOnly.length > 0) {
    violations.push(`zh-CN.json 有但 en.json 无的键(${zhOnly.length}个):\n  ${zhOnly.slice(0, 20).join('\n  ')}${zhOnly.length > 20 ? '\n  ...' : ''}`)
  }
  if (enOnly.length > 0) {
    violations.push(`en.json 有但 zh-CN.json 无的键(${enOnly.length}个):\n  ${enOnly.slice(0, 20).join('\n  ')}${enOnly.length > 20 ? '\n  ...' : ''}`)
  }
}

// --- 检查每个 .tsx 文件的 t() 调用 ---
const reT = /\bt\(\s*['"]([^'"]+)['"]/g
let checkedFiles = 0

for (const file of tsxFiles) {
  const src = readFileSync(file, 'utf8')
  const ns = extractNamespace(src)
  if (!ns) continue // 无 useTranslations,跳过

  const zhNs = getNested(zhMsg, ns)
  const enNs = getNested(enMsg, ns)
  const zhKeys = zhNs && typeof zhNs === 'object' ? new Set(Object.keys(zhNs)) : new Set()
  const enKeys = enNs && typeof enNs === 'object' ? new Set(Object.keys(enNs)) : new Set()

  const usedKeys = extractTKeys(src)
  if (usedKeys.length === 0) continue

  checkedFiles++

  const relPath = relative(ROOT, file)
  const missingZh = []
  const missingEn = []

  for (const key of usedKeys) {
    // 支持点号嵌套 key(如 t('a.b'))
    const zhHas = key.includes('.')
      ? getNested(zhNs, key) !== undefined
      : zhKeys.has(key)
    const enHas = key.includes('.')
      ? getNested(enNs, key) !== undefined
      : enKeys.has(key)
    if (!zhHas) missingZh.push(key)
    if (!enHas) missingEn.push(key)
  }

  if (missingZh.length > 0 || missingEn.length > 0) {
    if (missingZh.length > 0) {
      violations.push(`${relPath} [zh-CN 缺失, 命名空间 ${ns}]:\n  ${missingZh.map((k) => `t('${k}')`).join('\n  ')}`)
    }
    if (missingEn.length > 0) {
      violations.push(`${relPath} [en 缺失, 命名空间 ${ns}]:\n  ${missingEn.map((k) => `t('${k}')`).join('\n  ')}`)
    }
  }
}

// --- 输出结果 ---
if (violations.length > 0) {
  console.error('\x1b[31m[i18n 键检查] 发现缺失键,拒绝提交!\x1b[0m')
  console.error('')
  violations.forEach((v) => {
    console.error('\x1b[31m  ' + v + '\x1b[0m')
    console.error('')
  })
  console.error('\x1b[33m修复方法:\x1b[0m')
  console.error('  1. 在 apps/web/messages/zh-CN.json 和 en.json 的对应命名空间补齐缺失键')
  console.error('  2. 确保 zh-CN 与 en 的键集完全一致(parity)')
  console.error('  3. 子页面共享命名空间时用前缀键(如 questionsTitle)避免冲突')
  console.error('')
  process.exit(1)
}

console.log(`\x1b[32m[i18n 键检查] 通过,已检查 ${checkedFiles} 个文件,zh/en parity OK\x1b[0m`)
process.exit(0)
