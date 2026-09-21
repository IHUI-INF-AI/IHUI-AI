#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本是 CLI 工具,需 console 输出诊断信息 */
/**
 * 单分支开发守门(blocking, 2026-08-02 立,AGENTS.md §9b)。
 *
 * 规则:除 main 之外不允许新建任何本地/远程分支(feat/* / fix/* / hotfix/* /
 * add-* / rescue/* / 自定义前缀全部禁止)。所有改动统一往 main 合并。
 *
 * 唯一豁免:goal 模式临时分支(必须带 goal/ 前缀,且在 .ihui-agent/goal-runtime/STATE.md
 * 标注 active 状态才算合法;goal/* 完成后必须立即删除)。
 *
 * 检测逻辑:
 *   1. git branch -a 列出全部本地 + 远程分支
 *   2. 规范化:去掉当前分支星号、remotes/ 前缀
 *   3. 白名单:main / origin/main / upstream/main / gitee/main(镜像远程)/ HEAD
 *   4. 已 checkout 在 linked worktree 的分支豁免(AGENTS.md §12d sanctioned 并行隔离,非 feature 分支)
 *   4. 剩余分支逐一判定:
 *      - goal/* 前缀 → 检查 .ihui-agent/goal-runtime/STATE.md 是否标注 active → 合法豁免
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

/** 合法分支白名单(本地 main + 远程 main:origin/upstream/gitee/gitcode 镜像;gitee/gitcode 为项目 sanctioned 镜像远程,main 即 main) */
const ALLOWED = new Set(['main', 'origin/main', 'upstream/main', 'gitee/main', 'gitcode/main', 'HEAD'])

/**
 * sanctioned 发布产物分支(非开发分支,不违反单分支原则)。
 *
 * desktop-feed(2026-09-17 立):桌面端 updater feed 的"真源分支"——GitHub 侧
 * desktop-feed 分支承载 latest.json feed,Gitee/GitCode 镜像自动携带。属发布管线
 * 数据通道,非功能开发分支;见 commit 359a782d3be(desktop-feed 真源化 GitHub),
 * 其 updater 端点链为 Gitee raw → GitHub raw/desktop-feed → desktop-updater-feed release。
 * 该分支由 CI/发版脚本写入,人工严禁在此分支做功能开发。
 */
const SANCTIONED_RELEASE_BRANCHES = new Set([
  'desktop-feed',
  'origin/desktop-feed',
  'gitee/desktop-feed',
  'gitcode/desktop-feed',
])

/** origin/HEAD -> origin/main 是 git 符号引用输出,非真实分支,需跳过 */
function isSymbolicRef(branch) {
  return branch.includes('->')
}

/**
 * goal 模式豁免判定:分支必须以 goal/ 开头,且 .ihui-agent/goal-runtime/STATE.md
 * 标注 active(AGENTS.md §9b 豁免条款)。
 */
function isActiveGoalBranch(branch) {
  if (!branch.startsWith('goal/')) return false
  const statePath = join(ROOT, '.ihui-agent', 'goal-runtime', 'STATE.md')
  if (!existsSync(statePath)) return false
  try {
    const state = readFileSync(statePath, 'utf8')
    return state.includes('active')
  } catch {
    return false
  }
}

/**
 * 排除已 checkout 在 linked worktree 中的分支(AGENTS.md §12d sanctioned 并行隔离机制)。
 * worktree 的 branch 是 agent/并行会话的"工作上下文",不是 §9b 要防范的 feature 分支;
 * 其唯一性由 worktree 本身保证,不应在单分支守门中被误判为非法分支。
 * 主 worktree 的 main 已在 ALLOWED 中,这里额外排除 linked worktree 的 checkout 分支。
 */
function getWorktreeBranches() {
  try {
    const raw = execSync('git worktree list --porcelain', { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    const set = new Set()
    for (const line of raw.split('\n')) {
      const m = line.match(/^branch refs\/heads\/(.+)$/)
      if (m) set.add(m[1])
    }
    return set
  } catch {
    return new Set()
  }
}

function listBranches() {
  try {
    const raw = execSync('git branch -a', { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    return raw
      .split('\n')
      .map((line) => line.trim().replace(/^[*+]\s*/, ''))
      .filter(Boolean)
      // 2026-09-13:detached HEAD 是本仓 sanctioned 的 worktree 提交姿态(AGENTS.md §12d),
      // `git branch -a` 在 detached 状态会输出 `(HEAD detached at <sha>)` / `(no branch)`
      // 这类伪条目——它们不是分支,不应被判为"非法分支"而阻塞 worktree 提交。
      .filter((line) => !line.startsWith('('))
      .map((line) => line.replace(/^remotes\//, ''))
  } catch {
    console.error(`${C.yellow}⚠️ git branch -a 执行失败,跳过单分支检查${C.reset}`)
    return []
  }
}

const branches = listBranches()
const worktreeBranches = getWorktreeBranches()
const illegal = branches.filter((b) => {
  if (ALLOWED.has(b) || isSymbolicRef(b) || isActiveGoalBranch(b)) return false
  if (SANCTIONED_RELEASE_BRANCHES.has(b)) return false
  if (worktreeBranches.has(b)) return false
  // 2026-09-16:worktree 分支的远程镜像豁免。sanctioned worktree 会话(AGENTS.md §12d)
  // push 备份后产生的 origin/<branch> 远程跟踪引用,是该 worktree 工作上下文的镜像,
  // 与本地分支同等豁免,不应被误判为 §9b 禁止的 feature 分支(否则并行会话互相阻塞)。
  if (b.startsWith('origin/') && worktreeBranches.has(b.slice('origin/'.length))) return false
  return true
})

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
     C. 确为 goal 模式临时分支 → 在 .ihui-agent/goal-runtime/STATE.md 标注 active 后重试
        (goal/* 完成后必须立即删除)
`)
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
