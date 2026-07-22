/**
 * GitHub PR/Issue/Release 工具集 — Wave 8 深化:对标 OpenClaw/OpenCode 的 PR 工作流。
 *
 * 通过 `gh` CLI 实现(spawnSync 'gh' args),失败时降级 GitHub REST API via fetch + GITHUB_TOKEN env。
 * 12 个工具:PR create/list/view/review/merge/comment/close/reopen/checkout + Issue create/list + Release create。
 *
 * 双重路径策略:
 *   1. 优先 gh CLI(已认证,无需额外 token 配置,支持 repo 自动检测)
 *   2. gh 不可用(ENOENT)→ 降级 REST API(需 GITHUB_TOKEN env,自动从 git remote 推断 owner/repo)
 */

import { spawnSync } from 'node:child_process';
import type { Tool, ToolResult } from './index.js';

// ---------------------------------------------------------------------------
// 辅助:gh CLI 调用
// ---------------------------------------------------------------------------
interface GhResult {
  ok: boolean;
  output: string;
  error?: string;
  fellBack: boolean;
}

function runGh(args: string[], cwd: string, timeoutMs = 30_000): GhResult {
  const result = spawnSync('gh', args, {
    cwd,
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { ok: false, output: '', error: 'gh CLI 未安装', fellBack: true };
    }
    return { ok: false, output: '', error: result.error.message, fellBack: false };
  }
  const stdout = (result.stdout as string) ?? '';
  const stderr = (result.stderr as string) ?? '';
  if (result.status !== 0) {
    return { ok: false, output: stdout, error: stderr.trim() || `gh 退出码 ${result.status}`, fellBack: false };
  }
  return { ok: true, output: stdout, fellBack: false };
}

// ---------------------------------------------------------------------------
// 辅助:GitHub REST API 降级
// ---------------------------------------------------------------------------
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

function inferOwnerRepo(cwd: string): { owner: string; repo: string } | null {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd,
    encoding: 'utf-8',
    timeout: 10_000,
    windowsHide: true,
  });
  if (r.error || r.status !== 0) return null;
  const url = (r.stdout as string).trim();
  // SSH: git@github.com:owner/repo.git
  // HTTPS: https://github.com/owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1]!, repo: sshMatch[2]! };
  const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
  return null;
}

async function githubApi(
  path: string,
  method: string,
  cwd: string,
  body?: Record<string, unknown>,
): Promise<ToolResult> {
  const token = getGitHubToken();
  if (!token) {
    return {
      success: false,
      output: '',
      error: 'gh CLI 不可用且 GITHUB_TOKEN env 未设置。请安装 gh CLI(推荐)或设置 GITHUB_TOKEN。',
    };
  }
  const ownerRepo = inferOwnerRepo(cwd);
  if (!ownerRepo) {
    return {
      success: false,
      output: '',
      error: '无法从 git remote origin 推断 owner/repo,请确认 remote 已配置',
    };
  }
  const url = path.includes('{owner}')
    ? `https://api.github.com${path.replace('{owner}', ownerRepo.owner).replace('{repo}', ownerRepo.repo)}`
    : `https://api.github.com/repos/${ownerRepo.owner}/${ownerRepo.repo}${path}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    const ok = resp.ok;
    return {
      success: ok,
      output: text,
      error: ok ? undefined : `GitHub API ${resp.status}: ${resp.statusText}`,
    };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `GitHub API 请求失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** 统一执行:先 gh CLI,失败降级 REST API(仅对支持的操作) */
function ghOrThrow(args: string[], cwd: string): GhResult {
  return runGh(args, cwd);
}

function ghResultToToolResult(r: GhResult): ToolResult {
  return {
    success: r.ok,
    output: r.output || (r.ok ? '(无输出)' : ''),
    error: r.error,
  };
}

// ---------------------------------------------------------------------------
// 1. gh_pr_create
// ---------------------------------------------------------------------------
const gh_pr_create: Tool = {
  name: 'gh_pr_create',
  description: '创建 GitHub Pull Request。参数:title(标题,必填),body(描述),head(源分支,必填),base(目标分支,默认当前),draft(布尔,草稿)。',
  dangerLevel: 'write',
  parameters: {
    title: { type: 'string', description: 'PR 标题' },
    body: { type: 'string', description: 'PR 描述(markdown)' },
    head: { type: 'string', description: '源分支(如 feature/x)' },
    base: { type: 'string', description: '目标分支(默认当前分支)' },
    draft: { type: 'boolean', description: '创建为草稿 PR' },
  },
  required: ['title', 'head'],
  async execute(args, ctx): Promise<ToolResult> {
    const title = args.title as string;
    const head = args.head as string;
    if (!title) return { success: false, output: '', error: '缺少 title 参数' };
    if (!head) return { success: false, output: '', error: '缺少 head 参数(源分支)' };
    const body = args.body as string | undefined;
    const base = args.base as string | undefined;
    const draft = args.draft === true;

    const r = ghOrThrow(['pr', 'create', '--title', title, '--head', head], ctx.workspacePath);
    if (r.ok) {
      return ghResultToToolResult(r);
    }
    if (r.fellBack) {
      const apiBody: Record<string, unknown> = { title, head, base: base ?? undefined, body: body ?? '', draft };
      return githubApi('/pulls', 'POST', ctx.workspacePath, apiBody);
    }
    if (body) {
      const r2 = ghOrThrow(['pr', 'create', '--title', title, '--head', head, '--body', body], ctx.workspacePath);
      if (r2.ok) return ghResultToToolResult(r2);
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 2. gh_pr_list
// ---------------------------------------------------------------------------
const gh_pr_list: Tool = {
  name: 'gh_pr_list',
  description: '列出 GitHub PR。参数:state(open/closed/all,默认 open),limit(最大数量,默认 20)。',
  parameters: {
    state: { type: 'string', description: 'PR 状态:open/closed/all' },
    limit: { type: 'number', description: '最大返回数(默认 20)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const state = (args.state as string) || 'open';
    const limit = typeof args.limit === 'number' ? args.limit : 20;
    const r = ghOrThrow(['pr', 'list', '--state', state, '--limit', String(limit)], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      const apiState = state === 'all' ? 'all' : state;
      return githubApi(`/pulls?state=${apiState}&per_page=${limit}`, 'GET', ctx.workspacePath);
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 3. gh_pr_view
// ---------------------------------------------------------------------------
const gh_pr_view: Tool = {
  name: 'gh_pr_view',
  description: '查看 GitHub PR 详情。参数:number(PR 编号,必填)。',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
  },
  required: ['number'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数(PR 编号)' };
    const r = ghOrThrow(['pr', 'view', String(number)], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return githubApi(`/pulls/${number}`, 'GET', ctx.workspacePath);
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 4. gh_pr_review
// ---------------------------------------------------------------------------
const gh_pr_review: Tool = {
  name: 'gh_pr_review',
  description: '提交 PR Review。参数:number(PR 编号,必填),event(APPROVE/REQUEST_CHANGES/COMMENT,必填),body(评论文本)。',
  dangerLevel: 'write',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
    event: { type: 'string', description: 'review 类型:APPROVE/REQUEST_CHANGES/COMMENT' },
    body: { type: 'string', description: '评论文本' },
  },
  required: ['number', 'event'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    const event = args.event as string;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };
    if (!event) return { success: false, output: '', error: '缺少 event 参数(APPROVE/REQUEST_CHANGES/COMMENT)' };
    const body = args.body as string | undefined;

    const ghArgs = ['pr', 'review', String(number), `--${event.toLowerCase().replace('_', '-')}`];
    if (body) ghArgs.push('--body', body);
    const r = ghOrThrow(ghArgs, ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return githubApi(`/pulls/${number}/reviews`, 'POST', ctx.workspacePath, { event, body: body ?? '' });
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 5. gh_pr_merge
// ---------------------------------------------------------------------------
const gh_pr_merge: Tool = {
  name: 'gh_pr_merge',
  description: 'DANGEROUS: 合并 GitHub PR。参数:number(PR 编号,必填),method(merge/squash/rebase,默认 merge),delete_branch(布尔,合并后删除分支)。需 args.confirm===true。',
  dangerLevel: 'dangerous',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
    method: { type: 'string', description: '合并方式:merge/squash/rebase(默认 merge)' },
    delete_branch: { type: 'boolean', description: '合并后删除分支' },
    confirm: { type: 'boolean', description: '必须为 true 才执行(双重确认)' },
  },
  required: ['number', 'confirm'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };
    if (args.confirm !== true) return { success: false, output: '', error: '合并 PR 需 confirm=true 双重确认' };
    const method = (args.method as string) || 'merge';
    const delete_branch = args.delete_branch === true;

    const ghArgs = ['pr', 'merge', String(number), `--${method}`];
    if (delete_branch) ghArgs.push('--delete-branch');
    const r = ghOrThrow(ghArgs, ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      const mergeMethod = method === 'squash' ? 'squash' : method === 'rebase' ? 'rebase' : 'merge';
      return githubApi(`/pulls/${number}/merge`, 'PUT', ctx.workspacePath, { merge_method: mergeMethod });
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 6. gh_pr_comment
// ---------------------------------------------------------------------------
const gh_pr_comment: Tool = {
  name: 'gh_pr_comment',
  description: '在 PR 上添加评论。参数:number(PR 编号,必填),body(评论内容,必填)。',
  dangerLevel: 'write',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
    body: { type: 'string', description: '评论内容(markdown)' },
  },
  required: ['number', 'body'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    const body = args.body as string;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };
    if (!body) return { success: false, output: '', error: '缺少 body 参数(评论内容)' };

    const r = ghOrThrow(['pr', 'comment', String(number), '--body', body], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return githubApi(`/issues/${number}/comments`, 'POST', ctx.workspacePath, { body });
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 7. gh_pr_close
// ---------------------------------------------------------------------------
const gh_pr_close: Tool = {
  name: 'gh_pr_close',
  description: '关闭 GitHub PR。参数:number(PR 编号,必填),comment(关闭时的评论,可选)。',
  dangerLevel: 'write',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
    comment: { type: 'string', description: '关闭时的评论(可选)' },
  },
  required: ['number'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };
    const comment = args.comment as string | undefined;

    if (comment) {
      const rComment = ghOrThrow(['pr', 'comment', String(number), '--body', comment], ctx.workspacePath);
      if (!rComment.ok && !rComment.fellBack) return ghResultToToolResult(rComment);
    }
    const r = ghOrThrow(['pr', 'close', String(number)], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return githubApi(`/pulls/${number}`, 'PATCH', ctx.workspacePath, { state: 'closed' });
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 8. gh_pr_reopen
// ---------------------------------------------------------------------------
const gh_pr_reopen: Tool = {
  name: 'gh_pr_reopen',
  description: '重新打开已关闭的 GitHub PR。参数:number(PR 编号,必填)。',
  dangerLevel: 'write',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
  },
  required: ['number'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };

    const r = ghOrThrow(['pr', 'reopen', String(number)], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return githubApi(`/pulls/${number}`, 'PATCH', ctx.workspacePath, { state: 'open' });
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 9. gh_pr_checkout
// ---------------------------------------------------------------------------
const gh_pr_checkout: Tool = {
  name: 'gh_pr_checkout',
  description: '切换到 PR 对应的分支(git checkout)。参数:number(PR 编号,必填)。',
  dangerLevel: 'write',
  parameters: {
    number: { type: 'number', description: 'PR 编号' },
  },
  required: ['number'],
  async execute(args, ctx): Promise<ToolResult> {
    const number = args.number;
    if (typeof number !== 'number') return { success: false, output: '', error: '缺少 number 参数' };

    const r = ghOrThrow(['pr', 'checkout', String(number)], ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      return {
        success: false,
        output: '',
        error: 'gh CLI 不可用时 pr_checkout 无法降级(REST API 不支持切换分支)。请安装 gh CLI。',
      };
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 10. gh_issue_create
// ---------------------------------------------------------------------------
const gh_issue_create: Tool = {
  name: 'gh_issue_create',
  description: '创建 GitHub Issue。参数:title(标题,必填),body(描述),labels(标签数组)。',
  dangerLevel: 'write',
  parameters: {
    title: { type: 'string', description: 'Issue 标题' },
    body: { type: 'string', description: 'Issue 描述(markdown)' },
    labels: {
      type: 'array',
      description: '标签列表',
      items: { type: 'string', description: '标签名' },
    },
  },
  required: ['title'],
  async execute(args, ctx): Promise<ToolResult> {
    const title = args.title as string;
    if (!title) return { success: false, output: '', error: '缺少 title 参数' };
    const body = args.body as string | undefined;
    const labels = Array.isArray(args.labels) ? (args.labels as string[]) : [];

    const ghArgs = ['issue', 'create', '--title', title];
    if (body) ghArgs.push('--body', body);
    if (labels.length > 0) {
      ghArgs.push('--label', labels.join(','));
    }
    const r = ghOrThrow(ghArgs, ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      const apiBody: Record<string, unknown> = { title, body: body ?? '', labels };
      return githubApi('/issues', 'POST', ctx.workspacePath, apiBody);
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 11. gh_issue_list
// ---------------------------------------------------------------------------
const gh_issue_list: Tool = {
  name: 'gh_issue_list',
  description: '列出 GitHub Issue。参数:state(open/closed/all,默认 open),labels(逗号分隔标签过滤),assignee(指派人)。',
  parameters: {
    state: { type: 'string', description: 'Issue 状态:open/closed/all(默认 open)' },
    labels: { type: 'string', description: '标签过滤(逗号分隔)' },
    assignee: { type: 'string', description: '指派人过滤' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const state = (args.state as string) || 'open';
    const labels = args.labels as string | undefined;
    const assignee = args.assignee as string | undefined;

    const ghArgs = ['issue', 'list', '--state', state];
    if (labels) ghArgs.push('--label', labels);
    if (assignee) ghArgs.push('--assignee', assignee);
    const r = ghOrThrow(ghArgs, ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      let path = `/issues?state=${state}&per_page=20`;
      if (labels) path += `&labels=${encodeURIComponent(labels)}`;
      if (assignee) path += `&assignee=${encodeURIComponent(assignee)}`;
      return githubApi(path, 'GET', ctx.workspacePath);
    }
    return ghResultToToolResult(r);
  },
};

// ---------------------------------------------------------------------------
// 12. gh_release_create
// ---------------------------------------------------------------------------
const gh_release_create: Tool = {
  name: 'gh_release_create',
  description: 'DANGEROUS: 创建 GitHub Release。参数:tag(标签名,必填),title(Release 标题),notes(发布说明),draft(布尔,草稿),prerelease(布尔,预发布)。需 args.confirm===true。',
  dangerLevel: 'dangerous',
  parameters: {
    tag: { type: 'string', description: '标签名(如 v1.0.0)' },
    title: { type: 'string', description: 'Release 标题' },
    notes: { type: 'string', description: '发布说明(markdown)' },
    draft: { type: 'boolean', description: '创建为草稿' },
    prerelease: { type: 'boolean', description: '标记为预发布' },
    confirm: { type: 'boolean', description: '必须为 true 才执行(双重确认)' },
  },
  required: ['tag', 'confirm'],
  async execute(args, ctx): Promise<ToolResult> {
    const tag = args.tag as string;
    if (!tag) return { success: false, output: '', error: '缺少 tag 参数' };
    if (args.confirm !== true) return { success: false, output: '', error: '创建 Release 需 confirm=true 双重确认' };
    const title = args.title as string | undefined;
    const notes = args.notes as string | undefined;
    const draft = args.draft === true;
    const prerelease = args.prerelease === true;

    const ghArgs = ['release', 'create', tag];
    if (title) ghArgs.push('--title', title);
    if (notes) ghArgs.push('--notes', notes);
    if (draft) ghArgs.push('--draft');
    if (prerelease) ghArgs.push('--prerelease');
    const r = ghOrThrow(ghArgs, ctx.workspacePath);
    if (r.ok) return ghResultToToolResult(r);
    if (r.fellBack) {
      const apiBody: Record<string, unknown> = {
        tag_name: tag,
        name: title ?? tag,
        body: notes ?? '',
        draft,
        prerelease,
      };
      return githubApi('/releases', 'POST', ctx.workspacePath, apiBody);
    }
    return ghResultToToolResult(r);
  },
};

export const GITHUB_PR_TOOLS: Tool[] = [
  gh_pr_create,
  gh_pr_list,
  gh_pr_view,
  gh_pr_review,
  gh_pr_merge,
  gh_pr_comment,
  gh_pr_close,
  gh_pr_reopen,
  gh_pr_checkout,
  gh_issue_create,
  gh_issue_list,
  gh_release_create,
];
