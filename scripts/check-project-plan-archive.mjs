#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * PROJECT_PLAN.md 已完成任务条目防误删守门(2026-07-20 立,commit 守门第 13c 项)
 *
 * 背景:
 *   - PROJECT_PLAN.md 是项目唯一任务计划文档(AGENTS.md 第 1 节)。
 *   - 历史上"CLI 配置导入"任务条目被归档精简操作**两次误删**(commit 15a50b53 第一次补回,
 *     后续归档再次删除,commit c0ac97c 第二次补回)。
 *   - 根因:check-project-plan-size.mjs 只守"体积上限",不守"已完成任务条目不能直接删除"。
 *   - 归档精简本意是把冗余任务条目移到 .trae-cn/archive/,但实际操作时容易"整段删除"
 *     而非"替换为一行 HTML 注释占位",导致任务历史断档。
 *
 * 守门策略:
 *   - 检测 PROJECT_PLAN.md 是否被修改(staged 模式对比 HEAD 与 index,非 staged 对比 HEAD 与 working tree)
 *   - 提取所有"### XXX(已完成 ✅ ...)"标题行,找出被删除的
 *   - 若有已完成任务条目被删除,且本次 diff 无"<!-- 已归档"占位注释,则阻塞 commit
 *   - 合规操作:把完整任务条目移动到 .trae-cn/archive/,并在原位置留归档占位注释
 *
 * 用法:
 *   node scripts/check-project-plan-archive.mjs --staged   (pre-commit, 阻塞)
 *   node scripts/check-project-plan-archive.mjs            (手动扫描, exit 0/1)
 *
 * 退出码:
 *   0 = 通过(无已完成任务条目被误删,或本次未修改 PROJECT_PLAN.md,或检测到归档占位注释)
 *   1 = 阻塞(检测到已完成任务条目被直接删除且无归档注释)
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const FILE = 'PROJECT_PLAN.md'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 提取 PROJECT_PLAN.md 中所有"已完成"任务条目的标题行。
 * 匹配规则: `### ` 开头 + 含 `(已完成` 或 ` ✅` 标记
 * @param {string} content
 * @returns {string[]} 已完成任务条目标题(完整行)
 */
function extractCompletedTaskHeadings(content) {
  if (!content) return []
  return content
    .split('\n')
    .filter((line) => line.startsWith('### '))
    .filter((line) => line.includes('已完成') || line.includes('✅'))
}

/**
 * 检查 diff 文本中是否有"已归档"占位注释
 * @param {string} diffText
 * @returns {boolean}
 */
function hasArchivePlaceholder(diffText) {
  if (!diffText) return false
  return /<!--\s*已归档/.test(diffText)
}

function main() {
  if (!existsSync(`${ROOT}/${FILE}`)) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过归档守门${C.reset}`)
    process.exit(0)
  }

  let oldContent = ''
  let newContent = ''
  let diffText = ''

  try {
    // HEAD 版本(老版本)
    try {
      oldContent = execSync(`git show HEAD:${FILE}`, {
        encoding: 'utf8',
        cwd: ROOT,
      })
    } catch {
      // HEAD 无此文件(首次创建),视为无删除
      oldContent = ''
    }

    if (isStaged) {
      // staged 模式:index 版本 + staged diff
      try {
        newContent = execSync(`git show :0:${FILE}`, {
          encoding: 'utf8',
          cwd: ROOT,
        })
      } catch {
        // 取 index 失败,降级用 working tree
        newContent = readFileSync(`${ROOT}/${FILE}`, 'utf8')
      }
      try {
        diffText = execSync(`git diff --cached -- ${FILE}`, {
          encoding: 'utf8',
          cwd: ROOT,
        })
      } catch {
        diffText = ''
      }
    } else {
      // 全量模式:working tree 版本 + unstaged diff
      newContent = readFileSync(`${ROOT}/${FILE}`, 'utf8')
      try {
        diffText = execSync(`git diff -- ${FILE}`, {
          encoding: 'utf8',
          cwd: ROOT,
        })
      } catch {
        diffText = ''
      }
    }
  } catch {
    // git 命令失败(非 git 环境),跳过
    console.log(
      `${C.dim}⏭  PROJECT_PLAN.md 归档守门跳过(非 git 环境或读取失败)${C.reset}`,
    )
    process.exit(0)
  }

  // 如果 PROJECT_PLAN.md 未被修改,跳过
  if (oldContent === newContent) {
    console.log(`${C.dim}⏭  PROJECT_PLAN.md 未修改,跳过归档守门${C.reset}`)
    process.exit(0)
  }

  const oldHeadings = extractCompletedTaskHeadings(oldContent)
  const newHeadings = extractCompletedTaskHeadings(newContent)

  // 找出被删除的已完成任务标题
  const deletedHeadings = oldHeadings.filter((h) => !newHeadings.includes(h))

  if (deletedHeadings.length === 0) {
    console.log(
      `${C.green}✅ PROJECT_PLAN.md 归档守门通过${C.reset} ${C.dim}(无已完成任务条目被删除)${C.reset}`,
    )
    process.exit(0)
  }

  // 检测是否有归档占位注释(如果有,说明是"移动到 archive + 留占位"的合规操作)
  if (hasArchivePlaceholder(diffText)) {
    console.log(
      `${C.green}✅ PROJECT_PLAN.md 归档守门通过${C.reset} ${C.dim}(检测到归档占位注释,合规移动)${C.reset}`,
    )
    console.log(
      `${C.dim}   已归档 ${deletedHeadings.length} 个任务条目到 .trae-cn/archive/${C.reset}`,
    )
    deletedHeadings.forEach((h) => {
      console.log(`${C.dim}   - ${h.replace(/^###\s+/, '')}${C.reset}`)
    })
    process.exit(0)
  }

  // 阻塞:有已完成任务条目被删除,但无归档占位注释
  console.error(
    `${C.red}❌ PROJECT_PLAN.md 归档守门失败${C.reset} ${C.bold}— 检测到已完成任务条目被直接删除${C.reset}`,
  )
  console.error('')
  console.error(
    `${C.yellow}被删除的已完成任务条目(${deletedHeadings.length} 个):${C.reset}`,
  )
  deletedHeadings.forEach((h) => {
    console.error(`  ${C.red}- ${h.replace(/^###\s+/, '')}${C.reset}`)
  })
  console.error('')
  console.error(`${C.yellow}问题:${C.reset}`)
  console.error(
    `  已完成任务条目是项目历史记录,${C.bold}不可直接删除${C.reset},必须按以下方式归档:`,
  )
  console.error('')
  console.error(`${C.cyan}正确操作:${C.reset}`)
  console.error(
    `  1. 把完整任务条目(### 标题 + 内容)移动到 ${C.cyan}.trae-cn/archive/PROJECT_PLAN_YYYY-MM-DD.md${C.reset}`,
  )
  console.error(
    `  2. 在 PROJECT_PLAN.md 原位置保留一行归档占位注释(HTML 注释形式,不影响渲染):`,
  )
  console.error(
    `     ${C.dim}<!-- 已归档(YYYY-MM-DD):XXX 任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_*.md -->${C.reset}`,
  )
  console.error(
    `  3. 或直接在归档占位注释区追加任务名(参考文件末尾已有的归档注释块)`,
  )
  console.error('')
  console.error(
    `${C.yellow}背景:${C.reset} 历史上 CLI 配置导入任务条目被两次误删(commit 15a50b53 / c0ac97c 反复补回),`,
  )
  console.error(
    `        本守门脚本(commit 守门第 13c 项)从机制上杜绝此类事故再次发生。`,
  )
  process.exit(1)
}

main()
