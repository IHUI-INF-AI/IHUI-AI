// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 创建/账面/状态腿(goal-b49/Z30 自 worktree.ts 拆出,零行为变更)。
 *
 * 分层:本档只做「对某源仓库下 agent worktree 的创建与账面读写」——
 *   - `ensureWorktreeGitignore` / `createAgentWorktree` —— 创建腿(目录 + 分支 + .gitignore 登记)
 *   - `listAgentWorktrees` / `findAgentWorktree` —— 账面(git worktree list --porcelain 解析)
 *   - `pruneWorktrees` / `cleanupStaleWorktrees` —— 状态收敛(孤儿 worktree / 孤儿分支)
 *   - `diffWorktreeAgainstBase` —— 相对基线的改动输出
 * 判据与次序与拆分前**逐字一致**(§0.6 单一真相源:`WorktreeManager` 的对应方法是逐字转接,
 * 本层不留第二份实现,也不得 import 入口档以免成环)。
 * 删除腿不在本档:`WorktreeManager.remove()` 由既有用例的源码装车锁钉在入口,
 * 独立收尾腿住 `./worktree-cleanup.ts`。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AGENT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_DIR,
  MAX_DIFF_LENGTH,
  agentBranchName,
  runGit,
  type WorktreeCreateResult,
  type WorktreeEntry,
} from './worktree-core.js';

/** 确保 .gitignore 忽略 .worktrees/,避免隔离目录污染主仓库状态 */
export function ensureWorktreeGitignore(sourcePath: string): void {
  const gitignorePath = path.join(sourcePath, '.gitignore');
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }
  if (content.split(/\r?\n/).includes(DEFAULT_WORKTREE_DIR + '/')) return;
  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + newline + DEFAULT_WORKTREE_DIR + '/\n', 'utf-8');
}

/**
 * 为 agent 创建隔离 worktree:目录 <rootDir>/<agentId>,分支 agent-wt-<uuid8>。
 *
 * 并发安全:分支名含 uuid8 随机段,多个 agent 同时创建互不冲突;
 * 同一 agentId 重复创建会因目录已存在而抛错(由调用方决定清理或换 id)。
 *
 * @param sourcePath 源仓库路径(主工作区)
 * @param rootDir 隔离区根(sourcePath/.worktrees,或构造参数覆盖后的绝对路径)
 * @param agentId agent 标识(同时作为隔离目录名)
 * @param opts.startPoint 基线提交(默认当前 HEAD)
 */
export function createAgentWorktree(
  sourcePath: string,
  rootDir: string,
  agentId: string,
  opts?: { startPoint?: string },
): WorktreeCreateResult {
  if (!agentId || agentId.trim().length === 0) {
    throw new Error('agentId 不能为空');
  }
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  ensureWorktreeGitignore(sourcePath);

  const wtPath = path.join(rootDir, agentId);
  if (fs.existsSync(wtPath)) {
    throw new Error(`worktree 路径已存在: ${wtPath}(同一 agentId 不能重复创建)`);
  }

  // 分支名含 uuid8 随机段,并发创建天然不冲突
  const branch = agentBranchName();

  let startPoint = opts?.startPoint;
  if (!startPoint) {
    const head = runGit(['rev-parse', 'HEAD'], sourcePath);
    startPoint = head.ok ? head.stdout : 'HEAD';
  }

  const r = runGit(['worktree', 'add', '-b', branch, wtPath, startPoint], sourcePath);
  if (!r.ok) {
    throw new Error(`git worktree add 失败: ${r.stderr || r.stdout}`);
  }

  return { agentId, path: wtPath, branch, createdAt: new Date().toISOString() };
}

/** 列出所有 agent 专属 worktree(git worktree list --porcelain,按分支前缀过滤) */
export function listAgentWorktrees(sourcePath: string): WorktreeEntry[] {
  const r = runGit(['worktree', 'list', '--porcelain'], sourcePath);
  if (!r.ok) return [];
  const out: WorktreeEntry[] = [];
  let curPath = '';
  let curBranch = '';
  const flush = () => {
    if (curPath && curBranch.startsWith(AGENT_BRANCH_PREFIX)) {
      out.push({
        agentId: path.basename(curPath),
        path: curPath,
        branch: curBranch,
        dirExists: fs.existsSync(curPath),
      });
    }
    curPath = '';
    curBranch = '';
  };
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      flush();
      curPath = line.slice('worktree '.length).trim();
    } else if (line.startsWith('branch ')) {
      // porcelain 输出完整 ref(如 refs/heads/agent-wt-xxx),归一化为短分支名
      const ref = line.slice('branch '.length).trim();
      curBranch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
    }
  }
  flush();
  return out;
}

/** 按 agentId 查找 worktree 条目,不存在返回 null */
export function findAgentWorktree(sourcePath: string, agentId: string): WorktreeEntry | null {
  return listAgentWorktrees(sourcePath).find((e) => e.agentId === agentId) ?? null;
}

/** 执行 git worktree prune,返回清理掉的失效 worktree 数量 */
export function pruneWorktrees(sourcePath: string): number {
  const before = listAgentWorktrees(sourcePath);
  const r = runGit(['worktree', 'prune'], sourcePath);
  if (!r.ok) return 0;
  const after = listAgentWorktrees(sourcePath);
  return Math.max(0, before.length - after.length);
}

/**
 * 清理孤儿 worktree 与孤儿分支:
 *   - 孤儿 worktree:git 元数据中登记但目录已被外部删除的条目 → prune
 *   - 孤儿分支:agent-wt-* 分支已无任何 worktree 挂载 → 分支 -D
 *
 * @returns { pruned: 清理的孤儿 worktree 数, branchesDeleted: 删除的孤儿分支数 }
 */
export function cleanupStaleWorktrees(sourcePath: string): { pruned: number; branchesDeleted: number } {
  const entries = listAgentWorktrees(sourcePath);
  const stale = entries.filter((e) => !e.dirExists);
  let pruned = 0;
  let branchesDeleted = 0;

  if (stale.length > 0) {
    const r = runGit(['worktree', 'prune'], sourcePath);
    if (r.ok) pruned = stale.length;
  }

  // 孤儿分支检测:agent-wt-* 分支存在但已无对应 worktree
  const branchList = runGit(
    ['branch', '--list', `${AGENT_BRANCH_PREFIX}*`, '--format=%(refname:short)'],
    sourcePath,
  );
  if (branchList.ok) {
    const liveBranches = new Set(listAgentWorktrees(sourcePath).map((e) => e.branch));
    for (const b of branchList.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      if (!liveBranches.has(b)) {
        const d = runGit(['branch', '-D', b], sourcePath);
        if (d.ok) branchesDeleted++;
      }
    }
  }

  return { pruned, branchesDeleted };
}

/**
 * 输出 agent worktree 相对基线(HEAD)的全部改动 diff,供主 agent 审阅合并。
 *
 * 先对未跟踪文件做 intent-to-add(git add -N),让新文件也出现在 diff 中;
 * 输出超过 MAX_DIFF_LENGTH 时截断,避免撑爆主 agent context。
 */
export function diffWorktreeAgainstBase(rootDir: string, agentId: string): string {
  const wtPath = path.join(rootDir, agentId);
  if (!fs.existsSync(wtPath)) {
    throw new Error(`worktree 不存在: ${wtPath}`);
  }
  // intent-to-add:让未跟踪的新文件进入 diff(不写入内容,仅登记索引意图)
  runGit(['add', '-N', '.'], wtPath);
  const r = runGit(['-C', wtPath, 'diff', 'HEAD'], wtPath);
  let text = r.ok ? r.stdout : '';
  if (text.length > MAX_DIFF_LENGTH) {
    text = text.slice(0, MAX_DIFF_LENGTH) + `\n...(diff 超过 ${MAX_DIFF_LENGTH} 字符,已截断)`;
  }
  return text;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
