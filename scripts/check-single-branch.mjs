#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本是 CLI 工具,需 console 输出诊断信息 */
/**
 * 单分支开发守门(blocking, 2026-08-02 立,AGENTS.md §9b)。
 *
 * 规则:除 main 之外不允许新建任何本地/远程分支(feat/* / fix/* / hotfix/* /
 * add-* / rescue/* / 自定义前缀全部禁止)。所有改动统一往 main 合并。
 *
 * 唯一豁免:goal 模式临时分支(必须带 goal/ 前缀,且在 .trae-cn/goal-runtime/STATE.md
 * 标注 active 状态才算合法;goal/* 完成后必须立即删除)。
 *
 * 检测逻辑:
 *   1. git branch -a 列出全部本地 + 远程分支
 *   2. 规范化:去掉当前分支星号、remotes/ 前缀
 *   3. 白名单:main / origin/main / upstream/main / HEAD
 *   4. 剩余分支逐一判定:
 *      - goal/* 前缀 → 检查 .trae-cn/goal-runtime/STATE.md 是否标注 active → 合法豁免
 *      - 其他 → 违规,exit 1 阻塞 commit + push
 *
 * 退出码: 0 = 通过 / 1 = 检测到非法分支,阻塞
 * 集成位置: scripts/guardian-runner.mjs id 41(blocking)
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 合法分支白名单(本地 main + 远程 main/upstream) */
const ALLOWED = new Set(['main', 'origin/main', 'upstream/main', 'HEAD'])

/** origin/HEAD -> origin/main 是 git 符号引用输出,非真实分支,需跳过 */
function isSymbolicRef(branch) {
  return branch.includes('->')
}

/**
 * goal 模式豁免判定:分支必须以 goal/ 开头,且 .trae-cn/goal-runtime/STATE.md
 * 标注 active(AGENTS.md §9b 豁免条款)。
 */
function isActiveGoalBranch(branch) {
  if (!branch.startsWith('goal/')) return false
  const statePath = join(ROOT, '.trae-cn', 'goal-runtime', 'STATE.md')
  if (!existsSync(statePath)) return false
  try {
    const state = readFileSync(statePath, 'utf8')
    return state.includes('active')
  } catch {
    return false
  }
}

function listBranches() {
  try {
    const raw = execSync('git branch -a', { cwd: ROOT, encoding: 'utf8' })
    return raw
      .split('\n')
      .map((line) => line.trim().replace(/^\*\s*/, ''))
      .filter(Boolean)
      .map((line) => line.replace(/^remotes\//, ''))
  } catch {
    console.error(`${C.yellow}⚠️ git branch -a 执行失败,跳过单分支检查${C.reset}`)
    return []
  }
}

const branches = listBranches()
const illegal = branches.filter((b) => !ALLOWED.has(b) && !isSymbolicRef(b) && !isActiveGoalBranch(b))

if (illegal.length === 0) {
  console.log(`${C.green}✅ 单分支检查通过:仅存在 main(及 goal/ 合法豁免分支)${C.reset}`)
  process.exit(0)
}

console.error(`${C.red}🛡️ 单分支守门失败:检测到 ${illegal.length} 个非法分支,提交已阻塞${C.reset}`)
for (const b of illegal) {
  console.error(`  ${C.red}✗ ${b}${C.reset}`)
}
console.error(`
${C.yellow}💡 AGENTS.md §9b 强制规则:除 main 外禁止创建任何分支(含远程),所有改动统一往 main 合并。${C.reset}
   修复(三选一):
     A. 已合并 → 删除:git branch -d <分支>(本地)+ git push origin --delete <分支>(远程)
     B. 未合并但内容已在 main → 确认后删除:git branch -D <分支>
        (删除未合并分支前先 tag 备份:git tag backup/cleanup-<date>-<branch> <branch>)
     C. 确为 goal 模式临时分支 → 在 .trae-cn/goal-runtime/STATE.md 标注 active 后重试
        (goal/* 完成后必须立即删除)
`)
process.exit(1)

