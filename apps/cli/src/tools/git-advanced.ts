/**
 * Git 高级工具集 — Wave 8 深化:branch/merge/rebase/stash/conflict/tag/remote。
 *
 * 对标 OpenClaw/OpenCode 的 Git 工作流,补齐 apps/cli/src/tools/git.ts 5 个基础工具之外的:
 *   - 分支管理(创建/切换/删除/列表)
 *   - 合并/变基(merge/rebase)
 *   - stash(push/pop/list)
 *   - 冲突检测与解决(conflict_status/conflict_resolve)
 *   - tag/remote 管理
 *
 * 复用 git.ts 的 execGit/formatGitResult 封装,保持一致的错误处理与 hooks 集成。
 * 危险操作(force delete / merge / rebase)在 description 中标注 DANGEROUS,
 * execute 时检查 args.confirm === true 才执行(双重守门:dangerLevel + confirm)。
 */

import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { execGit, formatGitResult } from './git.js';

// ---------------------------------------------------------------------------
// 1. git_branch_create — 创建分支
// ---------------------------------------------------------------------------
const git_branch_create: Tool = {
  name: 'git_branch_create',
  description: '创建新 git 分支(git branch / git checkout -b)。参数:name(分支名,必填),from(起点引用,默认 HEAD)。',
  dangerLevel: 'write',
  parameters: {
    name: { type: 'string', description: '新分支名' },
    from: { type: 'string', description: '起点引用(默认 HEAD,可为分支名/标签/commit SHA)' },
  },
  required: ['name'],
  async execute(args, ctx): Promise<ToolResult> {
    const name = args.name as string;
    if (!name) return { success: false, output: '', error: '缺少 name 参数(分支名)' };
    const from = args.from as string | undefined;

    const preResult = runPreToolCall('git_branch_create', { name, from });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['branch', name];
    if (from) cmdArgs.push(from);
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_branch_create', { exitCode: r.exitCode, name });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 2. git_branch_switch — 切换分支
// ---------------------------------------------------------------------------
const git_branch_switch: Tool = {
  name: 'git_branch_switch',
  description: '切换 git 分支(git checkout / git switch)。参数:name(分支名,必填),create(布尔,不存在时创建)。',
  dangerLevel: 'write',
  parameters: {
    name: { type: 'string', description: '目标分支名' },
    create: { type: 'boolean', description: '若分支不存在则创建(git checkout -b / git switch -c)' },
  },
  required: ['name'],
  async execute(args, ctx): Promise<ToolResult> {
    const name = args.name as string;
    if (!name) return { success: false, output: '', error: '缺少 name 参数(分支名)' };
    const create = args.create === true;

    const preResult = runPreToolCall('git_branch_switch', { name, create });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['checkout'];
    if (create) cmdArgs.push('-b');
    cmdArgs.push(name);
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_branch_switch', { exitCode: r.exitCode, name });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 3. git_branch_delete — 删除分支 [DANGEROUS: force]
// ---------------------------------------------------------------------------
const git_branch_delete: Tool = {
  name: 'git_branch_delete',
  description: 'DANGEROUS: 删除 git 分支(git branch -d/-D)。参数:name(分支名,必填),force(布尔,强制删除未合并的分支,-D)。force=true 时需 args.confirm===true 才执行。',
  dangerLevel: 'dangerous',
  parameters: {
    name: { type: 'string', description: '要删除的分支名' },
    force: { type: 'boolean', description: '强制删除未合并分支(-D),需 confirm=true' },
    confirm: { type: 'boolean', description: 'force=true 时必须为 true 才执行(双重确认)' },
  },
  required: ['name'],
  async execute(args, ctx): Promise<ToolResult> {
    const name = args.name as string;
    if (!name) return { success: false, output: '', error: '缺少 name 参数(分支名)' };
    const force = args.force === true;

    if (force && args.confirm !== true) {
      return { success: false, output: '', error: '强制删除分支(force=true)需 confirm=true 双重确认' };
    }

    const preResult = runPreToolCall('git_branch_delete', { name, force });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['branch', '-d', name];
    if (force) cmdArgs[1] = '-D';
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_branch_delete', { exitCode: r.exitCode, name, force });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 4. git_branch_list — 列出分支
// ---------------------------------------------------------------------------
const git_branch_list: Tool = {
  name: 'git_branch_list',
  description: '列出 git 分支(git branch)。参数:remote(布尔,包含远程分支,-a),merged(布尔,仅显示已合并到 HEAD 的分支,--merged)。',
  parameters: {
    remote: { type: 'boolean', description: '包含远程分支(-a)' },
    merged: { type: 'boolean', description: '仅显示已合并分支(--merged)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const remote = args.remote === true;
    const merged = args.merged === true;

    const cmdArgs = ['branch'];
    if (remote) cmdArgs.push('-a');
    if (merged) cmdArgs.push('--merged');
    const r = execGit(cmdArgs, ctx.workspacePath);
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 5. git_merge — 合并分支 [DANGEROUS]
// ---------------------------------------------------------------------------
const git_merge: Tool = {
  name: 'git_merge',
  description: 'DANGEROUS: 合并指定分支到当前分支(git merge)。参数:branch(分支名,必填),no_ff(布尔,禁用 fast-forward,--no-ff),squash(布尔,压缩合并,--squash),message(合并提交信息)。需 args.confirm===true 才执行。',
  dangerLevel: 'dangerous',
  parameters: {
    branch: { type: 'string', description: '要合并的分支名' },
    no_ff: { type: 'boolean', description: '禁用 fast-forward(--no-ff,生成合并提交)' },
    squash: { type: 'boolean', description: '压缩合并(--squash,不生成合并提交)' },
    message: { type: 'string', description: '合并提交信息(-m)' },
    confirm: { type: 'boolean', description: '必须为 true 才执行(双重确认)' },
  },
  required: ['branch', 'confirm'],
  async execute(args, ctx): Promise<ToolResult> {
    const branch = args.branch as string;
    if (!branch) return { success: false, output: '', error: '缺少 branch 参数' };
    if (args.confirm !== true) {
      return { success: false, output: '', error: '合并操作需 confirm=true 双重确认' };
    }
    const no_ff = args.no_ff === true;
    const squash = args.squash === true;
    const message = args.message as string | undefined;

    const preResult = runPreToolCall('git_merge', { branch, no_ff, squash });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['merge'];
    if (no_ff) cmdArgs.push('--no-ff');
    if (squash) cmdArgs.push('--squash');
    if (message) cmdArgs.push('-m', message);
    cmdArgs.push(branch);
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_merge', { exitCode: r.exitCode, branch });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 6. git_rebase — 变基 [DANGEROUS]
// ---------------------------------------------------------------------------
const git_rebase: Tool = {
  name: 'git_rebase',
  description: 'DANGEROUS: 将当前分支变基到指定上游(git rebase)。参数:upstream(上游分支,必填),branch(要变基的分支,缺省当前),interactive(布尔,-i 交互式)。需 args.confirm===true 才执行。注意:交互式 rebase 需要终端,在 Agent 中通常不可用。',
  dangerLevel: 'dangerous',
  parameters: {
    upstream: { type: 'string', description: '上游分支(如 origin/main)' },
    branch: { type: 'string', description: '要变基的分支(缺省当前分支)' },
    interactive: { type: 'boolean', description: '交互式变基(-i,需终端,Agent 中通常不可用)' },
    confirm: { type: 'boolean', description: '必须为 true 才执行(双重确认)' },
  },
  required: ['upstream', 'confirm'],
  async execute(args, ctx): Promise<ToolResult> {
    const upstream = args.upstream as string;
    if (!upstream) return { success: false, output: '', error: '缺少 upstream 参数' };
    if (args.confirm !== true) {
      return { success: false, output: '', error: '变基操作需 confirm=true 双重确认' };
    }
    const branch = args.branch as string | undefined;
    const interactive = args.interactive === true;

    if (interactive) {
      return { success: false, output: '', error: '交互式 rebase 需要终端交互,Agent 中不支持。请用非交互模式或手动执行。' };
    }

    const preResult = runPreToolCall('git_rebase', { upstream, branch });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['rebase', upstream];
    if (branch) cmdArgs.push(branch);
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_rebase', { exitCode: r.exitCode, upstream });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 7. git_stash_push — 暂存工作区改动
// ---------------------------------------------------------------------------
const git_stash_push: Tool = {
  name: 'git_stash_push',
  description: '暂存当前工作区改动(git stash push)。参数:message(暂存描述,-m),include_untracked(布尔,包含未跟踪文件,-u)。',
  dangerLevel: 'write',
  parameters: {
    message: { type: 'string', description: '暂存描述(-m)' },
    include_untracked: { type: 'boolean', description: '包含未跟踪文件(-u)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const message = args.message as string | undefined;
    const include_untracked = args.include_untracked === true;

    const preResult = runPreToolCall('git_stash_push', { message, include_untracked });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['stash', 'push'];
    if (message) cmdArgs.push('-m', message);
    if (include_untracked) cmdArgs.push('-u');
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_stash_push', { exitCode: r.exitCode });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 8. git_stash_pop — 恢复暂存
// ---------------------------------------------------------------------------
const git_stash_pop: Tool = {
  name: 'git_stash_pop',
  description: '恢复暂存的改动(git stash pop / apply)。参数:index(暂存索引,默认 0,即 stash@{0}),apply(布尔,仅应用不删除该 stash,--apply)。',
  dangerLevel: 'write',
  parameters: {
    index: { type: 'number', description: '暂存索引(默认 0,即 stash@{0})' },
    apply: { type: 'boolean', description: '仅应用不删除(--apply,默认 pop 会删除)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const index = typeof args.index === 'number' ? args.index : 0;
    const apply = args.apply === true;
    const stashRef = `stash@{${index}}`;

    const preResult = runPreToolCall('git_stash_pop', { index, apply });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['stash', apply ? 'apply' : 'pop', stashRef];
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_stash_pop', { exitCode: r.exitCode, index });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 9. git_stash_list — 列出暂存
// ---------------------------------------------------------------------------
const git_stash_list: Tool = {
  name: 'git_stash_list',
  description: '列出所有暂存条目(git stash list)。',
  parameters: {},
  required: [],
  async execute(_args, ctx): Promise<ToolResult> {
    const r = execGit(['stash', 'list'], ctx.workspacePath);
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 10. git_conflict_status — 冲突文件检测
// ---------------------------------------------------------------------------
const git_conflict_status: Tool = {
  name: 'git_conflict_status',
  description: '检测当前是否有未解决的合并冲突,返回冲突文件列表(git diff --name-only --diff-filter=U)。',
  parameters: {},
  required: [],
  async execute(_args, ctx): Promise<ToolResult> {
    const r = execGit(['diff', '--name-only', '--diff-filter=U'], ctx.workspacePath);
    const result = formatGitResult(r);
    if (r.exitCode === 0 && !r.stdout.trim()) {
      return { success: true, output: '无冲突文件(工作区干净或无未解决冲突)' };
    }
    return result;
  },
};

// ---------------------------------------------------------------------------
// 11. git_conflict_resolve — 解决冲突
// ---------------------------------------------------------------------------
const git_conflict_resolve: Tool = {
  name: 'git_conflict_resolve',
  description: '解决指定文件的冲突(git checkout --ours/--theirs + git add)。参数:file(文件路径,必填),strategy(策略:ours/theirs/manual,必填)。manual 仅标记为已解决(git add),不修改文件内容。',
  dangerLevel: 'write',
  parameters: {
    file: { type: 'string', description: '冲突文件路径' },
    strategy: { type: 'string', description: '解决策略:ours(保留当前)/theirs(保留对方)/manual(手动解决后标记)' },
  },
  required: ['file', 'strategy'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string;
    const strategy = args.strategy as string;
    if (!file) return { success: false, output: '', error: '缺少 file 参数' };
    if (strategy !== 'ours' && strategy !== 'theirs' && strategy !== 'manual') {
      return { success: false, output: '', error: `无效 strategy: ${strategy}(允许: ours/theirs/manual)` };
    }

    const preResult = runPreToolCall('git_conflict_resolve', { file, strategy });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    if (strategy === 'manual') {
      const r = execGit(['add', file], ctx.workspacePath);
      runPostToolCall('git_conflict_resolve', { exitCode: r.exitCode, file, strategy });
      return formatGitResult(r);
    }

    const checkoutArgs = ['checkout', `--${strategy}`, file];
    const rCheckout = execGit(checkoutArgs, ctx.workspacePath);
    if (rCheckout.exitCode !== 0) {
      return formatGitResult(rCheckout);
    }
    const rAdd = execGit(['add', file], ctx.workspacePath);
    runPostToolCall('git_conflict_resolve', { exitCode: rAdd.exitCode, file, strategy });
    return formatGitResult(rAdd);
  },
};

// ---------------------------------------------------------------------------
// 12. git_tag_create — 创建标签
// ---------------------------------------------------------------------------
const git_tag_create: Tool = {
  name: 'git_tag_create',
  description: '创建 git 标签(git tag)。参数:name(标签名,必填),message(附注信息,-a -m),annotated(布尔,创建附注标签,-a)。',
  dangerLevel: 'write',
  parameters: {
    name: { type: 'string', description: '标签名' },
    message: { type: 'string', description: '附注信息(-m,annotated=true 时使用)' },
    annotated: { type: 'boolean', description: '创建附注标签(-a)' },
  },
  required: ['name'],
  async execute(args, ctx): Promise<ToolResult> {
    const name = args.name as string;
    if (!name) return { success: false, output: '', error: '缺少 name 参数(标签名)' };
    const message = args.message as string | undefined;
    const annotated = args.annotated === true;

    const preResult = runPreToolCall('git_tag_create', { name, annotated });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const cmdArgs = ['tag'];
    if (annotated) {
      cmdArgs.push('-a', name);
      if (message) cmdArgs.push('-m', message);
      else cmdArgs.push('-m', `Tag ${name}`);
    } else {
      cmdArgs.push(name);
    }
    const r = execGit(cmdArgs, ctx.workspacePath);
    runPostToolCall('git_tag_create', { exitCode: r.exitCode, name });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 13. git_tag_list — 列出标签
// ---------------------------------------------------------------------------
const git_tag_list: Tool = {
  name: 'git_tag_list',
  description: '列出 git 标签(git tag -l)。参数:pattern(glob 匹配模式,如 "v*")。',
  parameters: {
    pattern: { type: 'string', description: 'glob 匹配模式(如 "v*" 匹配 v 开头标签)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const pattern = args.pattern as string | undefined;
    const cmdArgs = ['tag', '-l'];
    if (pattern) cmdArgs.push(pattern);
    const r = execGit(cmdArgs, ctx.workspacePath);
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 14. git_remote_add — 添加远程仓库
// ---------------------------------------------------------------------------
const git_remote_add: Tool = {
  name: 'git_remote_add',
  description: '添加远程仓库(git remote add)。参数:name(远程名,必填,如 origin),url(仓库 URL,必填)。',
  dangerLevel: 'write',
  parameters: {
    name: { type: 'string', description: '远程名(如 origin)' },
    url: { type: 'string', description: '仓库 URL(如 https://github.com/user/repo.git)' },
  },
  required: ['name', 'url'],
  async execute(args, ctx): Promise<ToolResult> {
    const name = args.name as string;
    const url = args.url as string;
    if (!name) return { success: false, output: '', error: '缺少 name 参数(远程名)' };
    if (!url) return { success: false, output: '', error: '缺少 url 参数(仓库 URL)' };

    const preResult = runPreToolCall('git_remote_add', { name, url });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const r = execGit(['remote', 'add', name, url], ctx.workspacePath);
    runPostToolCall('git_remote_add', { exitCode: r.exitCode, name });
    return formatGitResult(r);
  },
};

// ---------------------------------------------------------------------------
// 15. git_remote_list — 列出远程仓库
// ---------------------------------------------------------------------------
const git_remote_list: Tool = {
  name: 'git_remote_list',
  description: '列出远程仓库及 URL(git remote -v)。',
  parameters: {},
  required: [],
  async execute(_args, ctx): Promise<ToolResult> {
    const r = execGit(['remote', '-v'], ctx.workspacePath);
    return formatGitResult(r);
  },
};

export const GIT_ADVANCED_TOOLS: Tool[] = [
  git_branch_create,
  git_branch_switch,
  git_branch_delete,
  git_branch_list,
  git_merge,
  git_rebase,
  git_stash_push,
  git_stash_pop,
  git_stash_list,
  git_conflict_status,
  git_conflict_resolve,
  git_tag_create,
  git_tag_list,
  git_remote_add,
  git_remote_list,
];
