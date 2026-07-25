#!/usr/bin/env node
/**
 * i18n 文件完整性守门脚本(防截断事故)。
 *
 * 背景:本仓库曾发生 lint-staged 的 prettier --write 解析大 JSON 失败后
 * 写出截断版本,把 29100 行的 en.json 截断到 11066 行,丢失 ~18K 行 i18n 文案。
 *
 * 检测逻辑:
 * - 扫描 staged 中的 packages/i18n/messages/ 下所有 .json 文件(含子目录)
 * - 对比 staged 版本行数 vs HEAD 版本行数
 * - 若 staged 行数 < HEAD 行数 × 0.5 且减少量 > 100 行 → 判定截断事故(blocking)
 * - 新增文件(HEAD 中不存在)跳过
 *
 * 用法: node scripts/validate-i18n-integrity.mjs [--staged]
 *   --staged  兼容 guardian-runner 调用约定(脚本始终检查 staged 文件)
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const I18N_MESSAGES_PREFIX = 'packages/i18n/messages/'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 阈值:staged 行数 < HEAD × TRUNCATION_RATIO 且减少量 > MIN_DECREASE_LINES → 截断
const TRUNCATION_RATIO = 0.5
const MIN_DECREASE_LINES = 100

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    return output.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function countLines(content) {
  if (!content) return 0
  return content.split('\n').length
}

function countStagedLines(relPath) {
  // 优先用 git show :path 读取 staged(index)版本;失败则回退到工作区文件
  try {
    const content = execSync(`git show :${relPath}`, {
      encoding: 'utf8',
      cwd: ROOT,
    })
    return countLines(content)
  } catch {
    // fall through to working tree
  }
  try {
    const content = readFileSync(join(ROOT, relPath), 'utf8')
    return countLines(content)
  } catch {
    return null
  }
}

function countHeadLines(relPath) {
  // 读取 HEAD 版本;文件在 HEAD 中不存在(新增文件)返回 null → 跳过
  try {
    const content = execSync(`git show HEAD:${relPath}`, {
      encoding: 'utf8',
      cwd: ROOT,
    })
    return countLines(content)
  } catch {
    return null
  }
}

function isI18nJsonFile(relPath) {
  return relPath.startsWith(I18N_MESSAGES_PREFIX) && relPath.endsWith('.json')
}

const stagedFiles = getStagedFiles()
const i18nStaged = stagedFiles.filter(isI18nJsonFile)

if (i18nStaged.length === 0) {
  console.log(`${C.green}[validate-i18n-integrity] ⏭  跳过 (无 staged i18n 文件)${C.reset}`)
  process.exit(0)
}

const truncations = []

for (const relPath of i18nStaged) {
  const headLines = countHeadLines(relPath)
  // 新增文件(HEAD 中不存在)跳过
  if (headLines === null) continue

  const stagedLines = countStagedLines(relPath)
  // staged 版本读取失败(异常状态)跳过
  if (stagedLines === null) continue

  const decrease = headLines - stagedLines
  if (decrease <= MIN_DECREASE_LINES) continue

  const ratio = stagedLines / headLines
  if (ratio >= TRUNCATION_RATIO) continue

  truncations.push({
    relPath,
    headLines,
    stagedLines,
    decrease,
    decreasePercent: ((1 - ratio) * 100).toFixed(1),
  })
}

if (truncations.length > 0) {
  console.log(`${C.red}[validate-i18n-integrity] 检测到 i18n 文件疑似被截断!${C.reset}`)
  console.log('')
  for (const t of truncations) {
    console.log(`${C.red}  ${t.relPath}${C.reset}`)
    console.log(
      `${C.red}    HEAD: ${t.headLines} 行 → staged: ${t.stagedLines} 行 (减少 ${t.decrease} 行, ${t.decreasePercent}%)${C.reset}`,
    )
  }
  console.log('')
  console.log(`${C.yellow}修复建议:${C.reset}`)
  console.log(
    `${C.dim}  可能是 lint-staged/prettier 解析大 JSON 失败导致截断事故。${C.reset}`,
  )
  console.log(`${C.dim}  建议执行以下命令恢复后重新编辑/格式化:${C.reset}`)
  for (const t of truncations) {
    console.log(`  ${C.cyan}git restore --staged --worktree ${t.relPath}${C.reset}`)
  }
  console.log('')
  process.exit(1)
}

console.log(
  `${C.green}[validate-i18n-integrity] ✅ 通过 (${i18nStaged.length} 个 i18n 文件完整性正常)${C.reset}`,
)
process.exit(0)
