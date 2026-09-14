#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree 环境判定共享工具(2026-09-13 立)。
 *
 * 背景:多个守门脚本需要判断"是否运行在 `git worktree add` 出来的 linked worktree 中",
 * 并据此跳过只在主工作区成立的检查。此前该判定内联在 `check-parent-pollution.mjs`
 * (`isRootLinkedWorktree`,守门 [26]),本次新增守门 [15] 的同类需求后提取到共享层
 * (AGENTS.md §3「共享层优先」)。
 *
 * 为什么 linked worktree 需要特殊对待:
 *   - worktree 的父目录就是主工作区 → 「父目录污染巡查」会把主工作区的历史 agent
 *     临时文件全部误判为污染([26],2026-09-13 修);
 *   - 依赖 `.ihui-agent/`(已被 .gitignore)下文件的检查必然失败,因为该目录只存在于
 *     主工作区、任何干净 worktree 都没有([15] 审计报告存在性,2026-09-13 修);
 *   - `git branch -a` 在 detached 状态会输出 `(HEAD detached at ...)` / `(no branch)`
 *     伪分支条目,被当成非法分支([41],2026-09-13 修)。
 *
 * 用法:
 *   import { isRootLinkedWorktree } from './lib/worktree.mjs'
 *   if (isRootLinkedWorktree()) { /* 跳过仅主工作区成立的检查 *\/ }
 */
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 当前进程工作目录是否是一个 linked worktree(`git worktree add` 创建)。
 *
 * 判定依据:linked worktree 根目录下的 `.git` 是**文件**而非目录,内容形如
 * `gitdir: G:/IHUI-AI/.git/worktrees/<name>`;据此判断是否包含 `/worktrees/` 段。
 *
 * @param {string} [root=process.cwd()] 要判定的根目录
 * @returns {boolean} 是 linked worktree 返回 true;主工作区 / 非 git 目录返回 false
 */
export function isRootLinkedWorktree(root = process.cwd()) {
  const gitPath = join(root, '.git')
  try {
    if (!existsSync(gitPath) || !statSync(gitPath).isFile()) return false
    const content = readFileSync(gitPath, 'utf8').trim().replace(/^gitdir:\s*/i, '')
    return content.replace(/\\/g, '/').toLowerCase().includes('/worktrees/')
  } catch {
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
