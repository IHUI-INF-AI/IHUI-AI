#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * PROJECT_PLAN.md 已完成任务条目自动归档脚本(2026-07-23 立)
 *
 * 功能:
 *   - 扫描 PROJECT_PLAN.md 中的已完成任务条目(### [x] ✅(YYYY-MM-DD) ...)
 *   - 把完成日期 ≥ 阈值天数的条目移动到 .trae-cn/archive/PROJECT_PLAN_YYYY-MM-DD_auto-archive.md
 *   - 原位置留 HTML 注释占位(符合 AGENTS.md §1 归档规则 + check-project-plan-archive.mjs 守门)
 *
 * 用法:
 *   node scripts/archive-completed-tasks.mjs              # 默认: 归档 ≥7 天前的已完成条目
 *   node scripts/archive-completed-tasks.mjs --days 3     # 归档 ≥3 天前的
 *   node scripts/archive-completed-tasks.mjs --all        # 归档所有已完成条目(不论日期)
 *   node scripts/archive-completed-tasks.mjs --dry-run    # 只打印不实际归档
 *   node scripts/archive-completed-tasks.mjs --auto-commit # 归档后自动 git add + commit(防递归: IHUI_ARCHIVE_COMMIT=1)
 *
 * 集成:
 *   - .husky/post-commit 钩子自动调用 --auto-commit 模式
 *   - 防递归: 归档 commit 设 IHUI_ARCHIVE_COMMIT=1, post-commit 检测到跳过
 *
 * 退出码:
 *   0 = 成功(无论是否归档)
 *   1 = 错误(文件读写失败等)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')
const ARCHIVE_DIR = join(ROOT, '.trae-cn', 'archive')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allMode = args.includes('--all')
const autoCommit = args.includes('--auto-commit')
const daysIdx = args.indexOf('--days')
const daysThreshold = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 7

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function todayStr() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function dateDiffDays(dateStr) {
  if (!dateStr) return Infinity // 无日期视为最新,不归档(除非 --all)
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date(todayStr() + 'T00:00:00')
  return Math.floor((now - target) / 86400000)
}

/**
 * 解析 PROJECT_PLAN.md,提取已完成任务条目。
 * 条目标题: ### [x] ✅(YYYY-MM-DD) ...  或  ### [x] ... ✅ ...
 * 边界: 下一个 ### / ## 标题 或 单独 --- 分隔行 或 EOF
 * @param {string} content
 * @returns {Array<{startLine:number, endLine:number, title:string, titleText:string, date:string|null, bodyLines:string[]}>}
 */
function parseCompletedTasks(content) {
  const lines = content.split('\n')
  const tasks = []
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 已完成标题: ### [x] 开头 + 含 ✅ + 可选 (YYYY-MM-DD)
    const headingMatch = line.match(/^### \[x\][^\n]*✅(?:\((\d{4}-\d{2}-\d{2})\))?/)

    if (headingMatch) {
      // 遇到已完成标题:先结束前一个,再开始新条目
      if (current) {
        current.endLine = i - 1
        tasks.push(current)
      }
      current = {
        startLine: i,
        endLine: i,
        title: line,
        titleText: line.replace(/^###\s+/, '').trim(),
        date: headingMatch[1] || null,
        bodyLines: [line],
      }
    } else if (current) {
      // 在条目内,检查是否到达边界
      if (/^### /.test(line) || /^## /.test(line) || /^---\s*$/.test(line)) {
        current.endLine = i - 1
        tasks.push(current)
        current = null
      } else {
        current.bodyLines.push(line)
        current.endLine = i
      }
    }
  }
  if (current) tasks.push(current)
  return tasks
}

/**
 * 去除条目正文末尾的空行
 */
function trimTrailingEmpty(lines) {
  const result = [...lines]
  while (result.length > 1 && result[result.length - 1].trim() === '') {
    result.pop()
  }
  return result
}

function shouldArchive(task) {
  if (allMode) return true
  if (!task.date) return false // 无日期不归档(除非 --all)
  return dateDiffDays(task.date) >= daysThreshold
}

function main() {
  if (!existsSync(PLAN_FILE)) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档${C.reset}`)
    process.exit(0)
  }

  const content = readFileSync(PLAN_FILE, 'utf8')
  const tasks = parseCompletedTasks(content)
  const toArchive = tasks.filter(shouldArchive)

  if (toArchive.length === 0) {
    console.log(
      `${C.dim}⏭  无可归档的已完成任务条目${C.reset} ` +
        `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? 'all' : '≥' + daysThreshold + ' 天'})${C.reset}`,
    )
    process.exit(0)
  }

  console.log(
    `${C.cyan}📦 发现 ${toArchive.length} 个可归档的已完成任务条目${C.reset}` +
      `${C.dim}(共 ${tasks.length} 个已完成,阈值 ${allMode ? '--all' : '≥' + daysThreshold + ' 天'})${C.reset}`,
  )
  toArchive.forEach((t) => {
    console.log(`${C.dim}  - ${t.titleText.slice(0, 70)}${C.reset}`)
  })

  if (dryRun) {
    console.log(`${C.yellow}⚠️  --dry-run 模式,未实际归档${C.reset}`)
    process.exit(0)
  }

  // 确保归档目录存在
  if (!existsSync(ARCHIVE_DIR)) {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const today = todayStr()
  const archiveFile = join(ARCHIVE_DIR, `PROJECT_PLAN_${today}_auto-archive.md`)

  // 构建归档文件内容(追加模式)
  const archiveHeader =
    `# PROJECT_PLAN 自动归档(${today})\n\n` +
    `> 本文件由 scripts/archive-completed-tasks.mjs 自动生成,归档自 PROJECT_PLAN.md 的已完成任务条目。\n\n---\n\n`

  let archiveContent = ''
  if (!existsSync(archiveFile)) {
    archiveContent = archiveHeader
  }

  toArchive.forEach((task) => {
    const body = trimTrailingEmpty(task.bodyLines).join('\n')
    archiveContent += body + '\n\n---\n\n'
  })

  // 追加到归档文件
  appendFileSync(archiveFile, archiveContent, 'utf8')

  // 构建 PROJECT_PLAN.md 新内容:用占位注释替换每个已归档条目
  const lines = content.split('\n')
  // 收集要删除的行范围(从后往前删,避免索引偏移)
  const ranges = toArchive.map((t) => ({ start: t.startLine, end: t.endLine, title: t.titleText }))
  // 从后往前替换
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i]
    const placeholder = `<!-- 已归档(${today}):${r.title.slice(0, 60)},完整内容在 .trae-cn/archive/PROJECT_PLAN_${today}_auto-archive.md -->`
    lines.splice(r.start, r.end - r.start + 1, placeholder)
  }

  const newContent = lines.join('\n')
  writeFileSync(PLAN_FILE, newContent, 'utf8')

  console.log(`${C.green}✅ 已归档 ${toArchive.length} 个条目${C.reset}`)
  console.log(`${C.dim}   归档文件: .trae-cn/archive/PROJECT_PLAN_${today}_auto-archive.md${C.reset}`)
  console.log(`${C.dim}   PROJECT_PLAN.md 原位置已留归档占位注释${C.reset}`)

  // 自动 commit 模式
  if (autoCommit) {
    try {
      execSync(`git add PROJECT_PLAN.md .trae-cn/archive/PROJECT_PLAN_${today}_auto-archive.md`, {
        cwd: ROOT,
        stdio: 'pipe',
      })
      const msg = `chore(auto): 归档 ${toArchive.length} 个已完成任务条目至 .trae-cn/archive/`
      execSync(`git commit --no-verify -m "${msg.replace(/"/g, '\\"')}"`, {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, IHUI_ARCHIVE_COMMIT: '1' },
      })
      console.log(`${C.green}✅ 归档 commit 已创建(IHUI_ARCHIVE_COMMIT=1 防递归)${C.reset}`)
    } catch (e) {
      console.error(`${C.red}❌ 自动 commit 失败: ${e.message}${C.reset}`)
      console.error(`${C.yellow}   请手动: git add PROJECT_PLAN.md .trae-cn/archive/ && git commit${C.reset}`)
    }
  }

  process.exit(0)
}

main()
