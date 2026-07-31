/**
 * Git 工具共享层 — 抽出 execGit / formatGitResult,供 git.ts 和 git-advanced.ts 复用。
 *
 * 解决循环依赖:
 *   - git.ts          → import { GIT_ADVANCED_TOOLS } from './git-advanced.js'
 *   - git-advanced.ts → import { execGit, formatGitResult } from './git.js'
 *   - 两边互相 import 会触发 ESM TDZ(顶层 const GIT_ADVANCED_TOOLS 在 import 阶段未初始化)
 *
 * 修复:把 execGit / formatGitResult 移到本文件,两边都 import ./git-shared.js,
 *       git-advanced.ts 不再 import git.ts,循环被打破。
 */
import { spawnSync } from 'node:child_process';
import type { ToolResult } from './index.js';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function execGit(args: string[], cwd: string, timeoutMs = 30_000): GitExecResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return {
    stdout: (result.stdout as string) ?? '',
    stderr: (result.stderr as string) ?? '',
    exitCode: result.status,
  };
}

export function formatGitResult(r: GitExecResult, successOnZero = true): ToolResult {
  const parts: string[] = [];
  if (r.stdout.trim()) parts.push(r.stdout.trimEnd());
  if (r.stderr.trim()) parts.push(`[stderr] ${r.stderr.trimEnd()}`);
  return {
    success: successOnZero ? r.exitCode === 0 : true,
    output: parts.join('\n') || '(无输出)',
    error: r.exitCode !== null && r.exitCode !== 0 ? `git 退出码 ${r.exitCode}` : undefined,
  };
}
