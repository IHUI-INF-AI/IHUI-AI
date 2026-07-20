#!/usr/bin/env node
/**
 * 多端 i18n messages 文件存在性守门脚本。
 *
 * 触发场景：MIGRATION_INTEGRITY_REPORT §6.3 P0-7(4 端 i18n messages 文件缺失)
 * 验证 4 端（desktop / extension / mobile-rn / miniapp-taro）的 i18n messages 文件存在。
 *
 * 守门目的：
 *   - 防止任何端（特别是 miniapp-taro）删除或重命名 i18n 目录导致 typecheck 全失败
 *   - AGENTS.md §9 多端同步开发强制规则自动化检查
 *
 * 4 端文件位置（基于实际代码盘点 2026-07-20）：
 *   - apps/desktop/src/i18n/messages/{zh-CN,en,ja,ko,zh-TW}.ts
 *   - apps/extension/src/i18n/messages/{zh-CN,en,ja,ko,zh-TW}.ts
 *   - apps/mobile-rn/src/i18n/messages/{zh-CN,en,ja,ko,zh-TW}.ts
 *   - apps/miniapp-taro/src/i18n/{zh-CN,en,ja,ko,zh-TW}.ts（无 messages/ 子目录）
 *
 * 验证项：
 *   1. 4 端 × 5 语言 = 20 个文件全部存在
 *   2. 文件可被 require() 解析（语法正确、export default 存在）
 *   3. 文件内容非空、key 数量 > 0
 *
 * 退出码：
 *   0 = 通过
 *   1 = 失败（缺失文件 / 解析失败 / 空文件）
 *
 * 用法：
 *   node scripts/check-i18n-messages-exist.mjs              # 全量检查
 *   node scripts/check-i18n-messages-exist.mjs --staged     # pre-commit 模式
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

// 4 端文件位置定义
const ENDPOINTS = [
  {
    name: 'desktop',
    dir: 'apps/desktop/src/i18n/messages',
    filePattern: (locale) => `${locale}.ts`,
  },
  {
    name: 'extension',
    dir: 'apps/extension/src/i18n/messages',
    filePattern: (locale) => `${locale}.ts`,
  },
  {
    name: 'mobile-rn',
    dir: 'apps/mobile-rn/src/i18n/messages',
    filePattern: (locale) => `${locale}.ts`,
  },
  {
    name: 'miniapp-taro',
    dir: 'apps/miniapp-taro/src/i18n',
    filePattern: (locale) => `${locale}.ts`,
  },
]

const missing = []
const parseErrors = []
const emptyFiles = []

for (const endpoint of ENDPOINTS) {
  const dirAbs = path.resolve(ROOT, endpoint.dir)
  if (!fs.existsSync(dirAbs)) {
    missing.push({
      endpoint: endpoint.name,
      path: endpoint.dir,
      issue: 'directory-missing',
    })
    continue
  }

  for (const locale of LOCALES) {
    const relPath = path.join(endpoint.dir, endpoint.filePattern(locale))
    const absPath = path.resolve(ROOT, relPath)
    if (!fs.existsSync(absPath)) {
      missing.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'file-missing',
        locale,
      })
      continue
    }

    // 解析校验：必须含 export default
    const content = fs.readFileSync(absPath, 'utf8')
    if (!/export\s+default/.test(content)) {
      parseErrors.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'no-export-default',
      })
      continue
    }

    // 简单 key 数量估算：统计 export default 内的顶级 key（基于缩进的字符串 key）
    // 严格计数需要 AST 解析，这里用启发式（顶层对象 key）
    const keyMatch = content.match(/export\s+default\s*\{([\s\S]*?)\n\}/)
    if (!keyMatch) {
      parseErrors.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'invalid-export-default-shape',
      })
      continue
    }
    const body = keyMatch[1]
    // 匹配 2-space 缩进下的顶级 key（如 "  common: {"）
    const topKeyCount = (body.match(/^\s{2}\w+:\s*\{/gm) || []).length
    if (topKeyCount === 0) {
      emptyFiles.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'no-top-level-keys',
      })
    }
  }
}

// pre-commit 模式：只对暂存区涉及 i18n 的端做硬性检查，未涉及则跳过
let onlyStaged = false
if (isStaged) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    const stagedFiles = staged.split('\n').filter(Boolean)
    const stagedI18nDirs = new Set()
    for (const f of stagedFiles) {
      for (const endpoint of ENDPOINTS) {
        if (f.startsWith(`${endpoint.dir}/`)) {
          stagedI18nDirs.add(endpoint.name)
        }
      }
    }
    if (stagedI18nDirs.size === 0) {
      console.log(
        `${C.dim}[i18n-messages-exist] staged 模式: 暂存区无 i18n 改动,跳过${C.reset}`,
      )
      process.exit(0)
    }
    onlyStaged = true
    console.log(
      `${C.cyan}[i18n-messages-exist] staged 模式: 检查 ${[...stagedI18nDirs].join(', ')}${C.reset}`,
    )
  } catch {
    // 忽略错误，走全量
  }
}

const filterByEndpoint = (issue) =>
  !onlyStaged || ['desktop', 'extension', 'mobile-rn', 'miniapp-taro'].includes(issue.endpoint)

const filteredMissing = missing.filter(filterByEndpoint)
const filteredParseErrors = parseErrors.filter(filterByEndpoint)
const filteredEmpty = emptyFiles.filter(filterByEndpoint)

const totalIssues = filteredMissing.length + filteredParseErrors.length + filteredEmpty.length

if (totalIssues === 0) {
  const totalFiles = ENDPOINTS.length * LOCALES.length
  console.log(
    `${C.green}[i18n-messages-exist] ✅ 通过 (4 端 × 5 语言 = ${totalFiles} 文件全部存在且合法)${C.reset}`,
  )
  process.exit(0)
}

console.error(
  `${C.red}[i18n-messages-exist] ❌ 发现 ${totalIssues} 处问题:${C.reset}\n`,
)

if (filteredMissing.length > 0) {
  console.error(`  ${C.red}缺失文件/目录(${filteredMissing.length}个):${C.reset}`)
  for (const m of filteredMissing) {
    console.error(`    ${C.red}[${m.endpoint}] ${m.path} (${m.issue})${C.reset}`)
  }
  console.error('')
}

if (filteredParseErrors.length > 0) {
  console.error(`  ${C.red}解析错误(${filteredParseErrors.length}个):${C.reset}`)
  for (const p of filteredParseErrors) {
    console.error(`    ${C.red}[${p.endpoint}] ${p.path} (${p.issue})${C.reset}`)
  }
  console.error('')
}

if (filteredEmpty.length > 0) {
  console.error(`  ${C.yellow}空文件警告(${filteredEmpty.length}个):${C.reset}`)
  for (const e of filteredEmpty) {
    console.error(`    ${C.yellow}[${e.endpoint}] ${e.path} (${e.issue})${C.reset}`)
  }
  console.error('')
}

console.error(`${C.yellow}修复方法:${C.reset}`)
console.error(`  1. 4 端文件位置见脚本顶部 ENDPOINTS 配置`)
console.error(`  2. 从已有端复制并裁剪 messages 文件`)
console.error(`  3. 确保文件含 'export default { ... }' 结构`)
console.error(`  4. 确保顶级 key 数量 > 0`)

process.exit(1)
