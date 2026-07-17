/**
 * Git worktree 管理 — 为 subagent 创建隔离工作区,对齐 AGENTS.md 第 12 节
 * "多 Subagent 并行开发强制规则"的分支隔离要求(每个 Subagent 在 subagent/<id> 分支工作)。
 *
 * 做减法:
 *   - 仅封装 git worktree add / list / remove / prune,不维护本地缓存
 *   - 路径默认 .worktrees/<id>(相对 sourcePath),由调用方保证 .gitignore 已忽略
 *   - 遵守 AGENTS.md 第 8 节删除安全规则:removeWorktree 前必须确认 subagent 已结束
 *   - git 操作用 child_process spawnSync,不引入新依赖
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface WorktreeInfo {
  path: string;
  branch: string;
  parentId: string;
  subagentId: string;
  createdAt: string;
}

const WORKTREE_DIR_ENV = 'IHUI_WORKTREE_DIR';

export function getDefaultWorktreeRoot(sourcePath: string): string {
  if (process.env[WORKTREE_DIR_ENV]) return process.env[WORKTREE_DIR_ENV]!;
  return path.join(sourcePath, '.worktrees');
}

export function worktreeBranchName(subagentId: string): string {
  return `subagent/${subagentId}`;
}

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string): GitResult {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    windowsHide: true,
  });
  return {
    ok: r.status === 0,
    stdout: typeof r.stdout === 'string' ? r.stdout.trim() : '',
    stderr: typeof r.stderr === 'string' ? r.stderr.trim() : '',
  };
}

function ensureGitignoreEntry(sourcePath: string, entry: string): void {
  const gitignorePath = path.join(sourcePath, '.gitignore');
  let content = '';
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }
  if (content.split(/\r?\n/).includes(entry)) return;
  const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + newline + entry + '\n', 'utf-8');
}

export function createWorktree(
  parentId: string,
  subagentId: string,
  sourcePath: string,
): WorktreeInfo {
  const root = getDefaultWorktreeRoot(sourcePath);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  ensureGitignoreEntry(sourcePath, '.worktrees/');

  const wtPath = path.join(root, subagentId);
  const branch = worktreeBranchName(subagentId);

  if (fs.existsSync(wtPath)) {
    throw new Error(`worktree 路径已存在: ${wtPath}`);
  }

  const head = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], sourcePath);
  const startPoint = head.ok ? head.stdout : 'HEAD';

  const addResult = runGit(
    ['worktree', 'add', '-b', branch, wtPath, startPoint],
    sourcePath,
  );
  if (!addResult.ok) {
    throw new Error(`git worktree add 失败: ${addResult.stderr || addResult.stdout}`);
  }

  return {
    path: wtPath,
    branch,
    parentId,
    subagentId,
    createdAt: new Date().toISOString(),
  };
}

export function listWorktrees(sourcePath: string): WorktreeInfo[] {
  const r = runGit(['worktree', 'list', '--porcelain'], sourcePath);
  if (!r.ok) return [];
  const out: WorktreeInfo[] = [];
  let curPath = '';
  let curBranch = '';
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      curPath = line.slice('worktree '.length).trim();
    } else if (line.startsWith('branch ')) {
      curBranch = line.slice('branch '.length).trim();
    } else if (line === '' && curPath && curBranch.startsWith('subagent/')) {
      const subagentId = curBranch.slice('subagent/'.length);
      out.push({
        path: curPath,
        branch: curBranch,
        parentId: '',
        subagentId,
        createdAt: '',
      });
      curPath = '';
      curBranch = '';
    }
  }
  if (curPath && curBranch.startsWith('subagent/')) {
    const subagentId = curBranch.slice('subagent/'.length);
    out.push({
      path: curPath,
      branch: curBranch,
      parentId: '',
      subagentId,
      createdAt: '',
    });
  }
  return out;
}

export interface RemoveWorktreeOptions {
  sourcePath: string;
  force?: boolean;
}

export function removeWorktree(
  wtPath: string,
  opts: RemoveWorktreeOptions,
): boolean {
  if (!fs.existsSync(wtPath)) return false;
  const args = ['worktree', 'remove', wtPath];
  if (opts.force) args.push('--force');
  const r = runGit(args, opts.sourcePath);
  if (!r.ok) {
    const rm = spawnSync('rm', ['-rf', wtPath], { windowsHide: true });
    if (rm.error || rm.status !== 0) {
      throw new Error(`worktree 删除失败: ${r.stderr || r.stdout}`);
    }
  }
  return true;
}

export function pruneWorktrees(sourcePath: string): number {
  const before = listWorktrees(sourcePath);
  const r = runGit(['worktree', 'prune'], sourcePath);
  if (!r.ok) return 0;
  const after = listWorktrees(sourcePath);
  return Math.max(0, before.length - after.length);
}
