// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Git 工具集 — 让 Agent 能自主操作 git。
 *
 * 灵感来源:参考行业 Agent 框架的 tools crate 中的 git 操作工具。
 * 简化策略(做减法):
 *   - 5 个核心工具:git_status / git_diff / git_log / git_add / git_commit
 *   - 使用 spawnSync 直接调用(非 shell,避免注入)
 *   - 集成 hooks(preToolCall/postToolCall)和 sandbox 路径校验
 *   - 读操作(status/diff/log)不接 hooks 阻断,写操作(add/commit)接 hooks
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
// Wave 8:高级 Git 工具(branch/merge/rebase/stash/conflict/tag/remote)+ GitHub PR 工具
import { GIT_ADVANCED_TOOLS } from './git-advanced.js';
import { GITHUB_PR_TOOLS } from './github-pr.js';
// execGit / formatGitResult 抽到 git-shared.ts(2026-07-31,打破 git.ts ↔ git-advanced.ts 循环依赖)
import { execGit, formatGitResult } from './git-shared.js';

const git_status: Tool = {
  name: 'git_status',
  description: '显示 git 工作区状态(修改/暂存/未跟踪文件)。参数:porcelain(布尔,机器可读精简格式)。',
  parameters: {
    porcelain: { type: 'boolean', description: '使用 --porcelain 精简格式输出' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
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
  async execute(args, ctx): Promise<ToolResult> {
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
  async execute(args, ctx): Promise<ToolResult> {
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
  dangerLevel: 'write',
  parameters: {
    files: {
      type: 'array',
      description: '要添加的文件路径列表(相对于工作区根目录)',
      items: { type: 'string', description: '文件路径' },
    },
  },
  required: ['files'],
  async execute(args, ctx): Promise<ToolResult> {
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

/**
 * 按范围提交(票 07-B,2026-09-30):在**临时 GIT_INDEX_FILE** 上组装提交,全程不替换真实索引。
 *
 * 上游机制对齐(packages/services/src/git/repo/gitCliRepo.ts 的 stagedOnly:true 提交):
 *   1. 临时索引先 read-tree 父树(无父则 --empty);
 *   2. 范围内路径逐条从真实索引搬运(mode/sha 经 `ls-files --stage` 读出,`--add --cacheinfo` 写入);
 *   3. 范围收集同时吃 rename 原路径:全仓 `status --porcelain -z` 的 staged rename 对
 *      (`R  <new>\0<old>`),临时索引上对 old `--force-remove`,提交同时吞掉 rename 源的删除
 *      (实测:带 pathspec 的 status 会把 rename 断开显示成 `A <new>`,old 只在全仓 -z 输出里);
 *   4. `ls-files --stage` 见 stage≠0 ⇒ 范围内有未解决冲突,拒绝提交;
 *   5. 用临时索引跑 `git commit`(保留钩子链与分支更新语义);
 *   6. 回到真实索引只 `reset --quiet HEAD -- <paths> <rename-olds>` —— 其它已暂存文件继续
 *      等待用户手动提交,绝不吞掉。
 *
 * 安全属性:
 *   - GIT_INDEX_FILE 只出现在子进程 env(经 execGit 的 extraEnv 受控通道),父进程 env 不动;
 *   - 真实索引在提交后仅被 `reset --quiet HEAD -- <paths>` 触碰,不会整体替换成临时索引。
 *
 * @returns 成功时返回新提交 SHA;失败返回错误文案
 */
function commitWithTempIndex(message: string, paths: string[], cwd: string): { ok: true; sha: string } | { ok: false; error: string } {
  // 1. rename 收集(全仓 -z;staged rename 的 X 位 = R,old path 是紧随的下一个 NUL 项)
  const statusR = execGit(['status', '--porcelain', '-z'], cwd);
  if (statusR.exitCode !== 0) return { ok: false, error: `status 收集失败: ${statusR.stderr}` };
  const renameOlds = new Set<string>();
  const effectivePaths = new Set<string>(paths);
  const statusEntries = statusR.stdout.split('\0');
  for (let i = 0; i < statusEntries.length; i++) {
    const entry = statusEntries[i] as string;
    if (!entry || entry[0] !== 'R') continue; // 只吃 staged rename(X 位 R;worktree rename 是 ' R')
    const newPath = entry.slice(3);
    const oldPath = statusEntries[i + 1] as string;
    i++;
    if (paths.includes(newPath) || paths.includes(oldPath)) {
      // rename 两端视为一个整体:任一端被点名,整对进提交
      renameOlds.add(oldPath);
      effectivePaths.add(newPath);
      effectivePaths.add(oldPath);
    }
  }

  // 2. 范围收集:真实索引中这些路径的 staged 状态(mode/sha/path)+ 未解决冲突拒绝
  const stageR = execGit(['ls-files', '--stage', '-z', '--', ...effectivePaths], cwd);
  if (stageR.exitCode !== 0) return { ok: false, error: `ls-files --stage 失败: ${stageR.stderr}` };
  const staged: Array<{ mode: string; sha: string; path: string }> = [];
  for (const entry of stageR.stdout.split('\0')) {
    if (!entry) continue;
    const m = entry.match(/^(\d+) (\S+) (\d+)\t(.+)$/);
    if (!m) continue;
    const [, mode, sha, stage, path] = m;
    if (stage !== '0') {
      return { ok: false, error: `范围内存在未解决冲突(stage=${stage}): ${path}` };
    }
    staged.push({ mode: mode as string, sha: sha as string, path: path as string });
  }
  if (staged.length === 0) {
    return { ok: false, error: '范围内没有任何已暂存文件(先 git_add)' };
  }

  // 3. 父树:无 HEAD(空仓首提)则 --empty
  const headR = execGit(['rev-parse', '-q', '--verify', 'HEAD^{tree}'], cwd);
  const parentTree = headR.exitCode === 0 ? headR.stdout.trim() : null;

  // 4. 临时索引组装(GIT_INDEX_FILE 只在子进程 env)
  const tmpIndex = join(cwd, '.git', `index-scope-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const withTmp = { extraEnv: { GIT_INDEX_FILE: tmpIndex } };
  const cleanup = (): void => {
    try {
      rmSync(tmpIndex, { force: true });
    } catch {
      /* 临时索引清理失败不影响提交结果 */
    }
  };
  try {
    const readR = execGit(
      parentTree ? ['read-tree', parentTree] : ['read-tree', '--empty'],
      cwd,
      withTmp,
    );
    if (readR.exitCode !== 0) return { ok: false, error: `read-tree 失败: ${readR.stderr}` };

    for (const { mode, sha, path } of staged) {
      const addR = execGit(['update-index', '--add', '--cacheinfo', `${mode},${sha},${path}`], cwd, withTmp);
      if (addR.exitCode !== 0) return { ok: false, error: `update-index --cacheinfo ${path} 失败: ${addR.stderr}` };
    }
    for (const old of renameOlds) {
      // old 在真实索引中已被删(ls-files 不返回),但父树里还在 ⇒ 临时索引上强制移除
      const rmR = execGit(['update-index', '--force-remove', '--', old], cwd, withTmp);
      if (rmR.exitCode !== 0) return { ok: false, error: `force-remove ${old} 失败: ${rmR.stderr}` };
    }

    // 5. 用临时索引提交(保留钩子链与分支更新语义;真实索引不受影响)
    const commitR = execGit(['commit', '-q', '-m', message], cwd, withTmp);
    if (commitR.exitCode !== 0) {
      return { ok: false, error: `commit 失败: ${commitR.stderr || commitR.stdout}` };
    }

    // 6. 回到真实索引:只对齐已提交路径(其它已暂存文件原样保留)
    const resetPaths = [...effectivePaths];
    const resetR = execGit(['reset', '--quiet', 'HEAD', '--', ...resetPaths], cwd);
    if (resetR.exitCode !== 0) {
      return { ok: false, error: `提交成功但真实索引复位失败(请检查 git status): ${resetR.stderr}` };
    }

    const shaR = execGit(['rev-parse', 'HEAD'], cwd);
    if (shaR.exitCode !== 0) return { ok: false, error: `rev-parse HEAD 失败: ${shaR.stderr}` };
    return { ok: true, sha: shaR.stdout.trim() };
  } finally {
    cleanup();
  }
}

const git_commit: Tool = {
  name: 'git_commit',
  description:
    '提交暂存区到 git 仓库(git commit)。参数:message(字符串,提交信息,必填),amend(布尔,修改上一次提交),paths(字符串数组,按范围提交:只提交这些路径的已暂存内容,走临时索引,不影响其它已暂存文件)。',
  dangerLevel: 'dangerous',
  parameters: {
    message: { type: 'string', description: '提交信息' },
    amend: { type: 'boolean', description: '修改上一次提交(--amend)' },
    paths: { type: 'array', items: { type: 'string', description: '路径' }, description: '按范围提交的路径列表(临时索引实现,保护其它已暂存文件);不传 = 提交整个暂存区' },
  },
  required: ['message'],
  async execute(args, ctx): Promise<ToolResult> {
    const message = args.message as string;
    if (!message) return { success: false, output: '', error: '缺少 message 参数' };
    const amend = args.amend === true;
    const rawPaths = args.paths as string[] | undefined;
    const scopedPaths = Array.isArray(rawPaths)
      ? (rawPaths.filter((p): p is string => typeof p === 'string' && p.length > 0))
      : undefined;

    const preResult = runPreToolCall('git_commit', { message, amend, paths: scopedPaths });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    if (scopedPaths && scopedPaths.length > 0) {
      if (amend) return { success: false, output: '', error: '按范围提交与 --amend 互斥(语义不明,请分开执行)' };
      const result = commitWithTempIndex(message, scopedPaths, ctx.workspacePath);
      if (!result.ok) return { success: false, output: '', error: result.error };
      runPostToolCall('git_commit', { exitCode: 0, message, paths: scopedPaths, sha: result.sha });
      return { success: true, output: `[scoped commit] ${result.sha}\n${scopedPaths.join('\n')}` };
    }

    const cmdArgs = ['commit', '-m', message];
    if (amend) cmdArgs.push('--amend', '--no-edit');

    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_commit', { exitCode: r.exitCode, message });
    return formatGitResult(r);
  },
};

export const GIT_TOOLS: Tool[] = [
  git_status,
  git_diff,
  git_log,
  git_add,
  git_commit,
  ...GIT_ADVANCED_TOOLS,
  ...GITHUB_PR_TOOLS,
];

// Wave 8:re-export 高级工具集与 GitHub PR 工具集(供按需导入)
export { GIT_ADVANCED_TOOLS, GITHUB_PR_TOOLS };
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
