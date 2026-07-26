#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-ts-ignore.mjs — staged 文件中新增 @ts-ignore / @ts-nocheck 注释检测
 *
 * 背景(2026-07-26 立):
 *   本仓库早期 workspace 包未导出类型时,大量文件用 @ts-ignore 压制 TS 报错;
 *   本批次已清理 215 处历史遗留 @ts-ignore(包已修复导出,压制无效)。
 *   为防止复发,新增本守门检测 staged 文件中新增的 @ts-ignore / @ts-nocheck。
 *
 * 用途:防止历史遗留 @ts-ignore 复发(本仓库刚清理 215 处无效 @ts-ignore)。
 *
 * CLI 用法:
 *   node scripts/check-ts-ignore.mjs [--staged] [--help]
 *
 *   --staged  仅检查 staged 文件(pre-commit 模式)
 *   --help    打印帮助
 *
 * 检测规则:
 *   - 扫描 staged 的 .ts / .tsx / .mjs / .js / .cjs 文件
 *   - 跳过白名单:e2e/ 目录(@playwright/test 类型解析场景)、
 *     node_modules/ / dist/ / .next/ / build/
 *   - 检测 @ts-ignore / @ts-nocheck 注释(单行 // 与块注释形式)
 *     (仅检测注释行,避免误报字符串内的 @ts-ignore)
 *   - 输出新增 @ts-ignore 的文件:行号 + 内容
 *
 * 退出码:
 *   0  无新增 @ts-ignore(或仅有白名单文件)
 *   1  发现新增 @ts-ignore(warn 级别,guardian-runner 会继续执行不阻塞)
 *
 * 守门集成:guardian-runner.mjs(warn 模式,不阻塞 commit)
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ROOT = path.resolve(import.meta.dirname, '..')

// === 白名单(跳过检测)===
const SKIP_PATTERNS = [
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
  /[\\/]dist[\\/]/,
  /[\\/]build[\\/]/,
  /[\\/]e2e[\\/]/, // @playwright/test 类型解析场景,合理保留
]

// 仅匹配行首紧跟 @ts-ignore / @ts-nocheck 的"压制性"注释(单行 // 或单行 /* ... */),
// 不匹配描述性提及(如 "// warn-only: ... @ts-ignore ..." 或 JSDoc 内 " * 检测 @ts-ignore")。
// 这样可避免守门脚本自身在 JSDoc/注释中提及 @ts-ignore 时自我误报。
const TS_IGNORE_REGEX = /^\s*(?:\/\/|\/\*)\s*@ts-(?:ignore|nocheck)\b/

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function isSkip(filePath) {
  return SKIP_PATTERNS.some((p) => p.test(filePath))
}

function isTargetExt(filePath) {
  return /\.(ts|tsx|mjs|js|cjs)$/.test(filePath)
}

function scanFile(filePath) {
  const abs = path.join(ROOT, filePath)
  let content
  try {
    content = readFileSync(abs, 'utf8')
  } catch {
    return []
  }
  const hits = []
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 仅检测"压制性"注释:行首 // 或 /* 紧跟 @ts-ignore / @ts-nocheck
    // 不检测 JSDoc 块注释内的描述性提及(以 * 开头),也不检测行中提及 @ts-ignore 的普通注释
    if (TS_IGNORE_REGEX.test(line)) {
      hits.push({ line: i + 1, content: line.trim() })
    }
  }
  return hits
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('用法: node scripts/check-ts-ignore.mjs [--staged] [--help]')
    console.log('')
    console.log('检测 staged 文件中新增的 @ts-ignore / @ts-nocheck 注释(warn 级别)。')
    console.log('跳过白名单:e2e/ / node_modules/ / dist/ / .next/ / build/')
    process.exit(0)
  }

  const staged = args.includes('--staged') ? getStagedFiles() : []
  if (staged.length === 0) {
    console.log(`${C.dim}ℹ️  check-ts-ignore: 无 staged 文件,跳过${C.reset}`)
    process.exit(0)
  }

  const targets = staged.filter((f) => isTargetExt(f) && !isSkip(f))
  if (targets.length === 0) {
    console.log(`${C.dim}ℹ️  check-ts-ignore: 无目标文件(.ts/.tsx/.mjs/.js),跳过${C.reset}`)
    process.exit(0)
  }

  const violations = []
  for (const f of targets) {
    const hits = scanFile(f)
    if (hits.length > 0) {
      violations.push({ file: f, hits })
    }
  }

  if (violations.length === 0) {
    console.log(`${C.green}✅${C.reset} check-ts-ignore: ${targets.length} 个文件无新增 @ts-ignore`)
    process.exit(0)
  }

  const totalHits = violations.reduce((s, v) => s + v.hits.length, 0)
  console.log(`${C.yellow}⚠️  check-ts-ignore: 发现 ${C.bold}${totalHits}${C.reset}${C.yellow} 处 @ts-ignore(共 ${violations.length} 个文件)${C.reset}`)
  console.log(`   ${C.dim}@ts-ignore 是类型安全压制,请审视是否真的需要(warn 级别,不阻塞 commit)${C.reset}`)
  console.log('')
  for (const v of violations) {
    console.log(`   ${C.bold}${v.file}${C.reset}:`)
    for (const h of v.hits) {
      console.log(`     ${C.dim}L${h.line}:${C.reset} ${h.content}`)
    }
  }
  console.log('')
  console.log(`   ${C.cyan}提示:${C.reset}若 @playwright/test 等第三方库类型缺陷,可改用 e2e/tsconfig.json 独立配置`)
  process.exit(1)
}

main().catch((e) => {
  console.error(`${C.red}❌ check-ts-ignore 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
