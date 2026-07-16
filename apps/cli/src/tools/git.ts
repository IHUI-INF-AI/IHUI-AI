/**
 * Git 工具集 — 让 Agent 能自主操作 git。
 *
 * 灵感来源:grok-build 的 `xai-grok-tools` crate 中的 git 操作工具。
 * 简化策略(做减法):
 *   - 5 个核心工具:git_status / git_diff / git_log / git_add / git_commit
 *   - 使用 spawnSync 直接调用(非 shell,避免注入)
 *   - 集成 hooks(preToolCall/postToolCall)和 sandbox 路径校验
 *   - 读操作(status/diff/log)不接 hooks 阻断,写操作(add/commit)接 hooks
 */

import { spawnSync } from 'node:child_process';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function execGit(args: string[], cwd: string, timeoutMs = 30_000): GitExecResult {
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

function formatGitResult(r: GitExecResult, successOnZero = true): ToolResult {
  const parts: string[] = [];
  if (r.stdout.trim()) parts.push(r.stdout.trimEnd());
  if (r.stderr.trim()) parts.push(`[stderr] ${r.stderr.trimEnd()}`);
  return {
    success: successOnZero ? r.exitCode === 0 : true,
    output: parts.join('\n') || '(无输出)',
    error: r.exitCode !== null && r.exitCode !== 0 ? `git 退出码 ${r.exitCode}` : undefined,
  };
}

const git_status: Tool = {
  name: 'git_status',
  description: '显示 git 工作区状态(修改/暂存/未跟踪文件)。参数:porcelain(布尔,机器可读精简格式)。',
  parameters: {
    porcelain: { type: 'boolean', description: '使用 --porcelain 精简格式输出' },
  },
  required: [],
  execute(args, ctx): ToolResult {
    const porcelain = args.porcelain === true;
    const cmdArgs = ['status'];
    if (porcelain) cmdArgs.push('--porcelain');
    const preResult = runPreToolCall('git_status', { porcelain });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_status', { exitCode: r.exitCode });
    return formatGitResult(r);
  },
};

const git_diff: Tool = {
  name: 'git_diff',
  description: '显示 git 差异(工作区/暂存区/提交间)。参数:staged(布尔,显示暂存区差异),path(字符串,限定路径),ref(字符串,对比的提交引用如 HEAD~1)。',
  parameters: {
    staged: { type: 'boolean', description: '显示已暂存的差异(--staged)' },
    path: { type: 'string', description: '限定到指定文件/目录路径' },
    ref: { type: 'string', description: '对比的提交引用(如 HEAD~1、分支名)' },
  },
  required: [],
  execute(args, ctx): ToolResult {
    const staged = args.staged === true;
    const filePath = args.path as string | undefined;
    const ref = args.ref as string | undefined;

    const cmdArgs = ['diff'];
    if (staged) cmdArgs.push('--staged');
    if (ref) cmdArgs.push(ref);
    if (filePath) {
      cmdArgs.push('--');
      cmdArgs.push(filePath);
    }

    const preResult = runPreToolCall('git_diff', { staged, path: filePath, ref });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_diff', { exitCode: r.exitCode });
    return formatGitResult(r);
  },
};

const git_log: Tool = {
  name: 'git_log',
  description: '显示 git 提交历史。参数:count(数字,最大提交数,默认 10),oneline(布尔,精简单行格式),path(字符串,仅显示影响此路径的提交)。',
  parameters: {
    count: { type: 'number', description: '最大提交数(默认 10)' },
    oneline: { type: 'boolean', description: '使用 --oneline 精简格式' },
    path: { type: 'string', description: '仅显示影响此路径的提交' },
  },
  required: [],
  execute(args, ctx): ToolResult {
    const count = typeof args.count === 'number' ? args.count : 10;
    const oneline = args.oneline === true;
    const filePath = args.path as string | undefined;

    const cmdArgs = ['log', `-n${count}`];
    if (oneline) cmdArgs.push('--oneline');
    if (filePath) {
      cmdArgs.push('--');
      cmdArgs.push(filePath);
    }

    const r = execGit(cmdArgs, ctx.workspacePath);
    return formatGitResult(r);
  },
};

const git_add: Tool = {
  name: 'git_add',
  description: '将文件添加到 git 暂存区(git add)。参数:files(字符串数组,要添加的文件路径,必填)。',
  parameters: {
    files: {
      type: 'array',
      description: '要添加的文件路径列表(相对于工作区根目录)',
      items: { type: 'string', description: '文件路径' },
    },
  },
  required: ['files'],
  execute(args, ctx): ToolResult {
    const files = args.files;
    if (!Array.isArray(files) || files.length === 0) {
      return { success: false, output: '', error: '缺少 files 参数(文件路径数组)' };
    }
    const filePaths = files.filter((f): f is string => typeof f === 'string' && f.length > 0);
    if (filePaths.length === 0) {
      return { success: false, output: '', error: 'files 参数必须包含至少一个非空字符串' };
    }

    const preResult = runPreToolCall('git_add', { files: filePaths });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['add', ...filePaths];
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_add', { exitCode: r.exitCode, files: filePaths });
    return formatGitResult(r);
  },
};

const git_commit: Tool = {
  name: 'git_commit',
  description: '提交暂存区到 git 仓库(git commit)。参数:message(字符串,提交信息,必填),amend(布尔,修改上一次提交)。',
  parameters: {
    message: { type: 'string', description: '提交信息' },
    amend: { type: 'boolean', description: '修改上一次提交(--amend)' },
  },
  required: ['message'],
  execute(args, ctx): ToolResult {
    const message = args.message as string;
    if (!message) return { success: false, output: '', error: '缺少 message 参数' };
    const amend = args.amend === true;

    const preResult = runPreToolCall('git_commit', { message, amend });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['commit', '-m', message];
    if (amend) cmdArgs.push('--amend', '--no-edit');

    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_commit', { exitCode: r.exitCode, message });
    return formatGitResult(r);
  },
};

export const GIT_TOOLS: Tool[] = [git_status, git_diff, git_log, git_add, git_commit];
