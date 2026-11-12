// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 创建/账面/状态腿(goal-b49/Z30 自 worktree.ts 拆出,零行为变更)。
 * 本档只做「对某源仓库下 agent worktree 的创建与账面读写」:ensureWorktreeGitignore/createAgentWorktree(创建)、
 * listAgentWorktrees/findAgentWorktree(账面)、pruneWorktrees/cleanupStaleWorktrees(状态收敛)、diffWorktreeAgainstBase(基线 diff)。
 * 判据与次序与拆分前逐字一致(§0.6 单一真相源:WorktreeManager 方法逐字转接,本层不留第二份实现);删除腿不在本档,remove() 由源码装车锁钉在入口,收尾腿住 ./worktree-cleanup.ts。
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

const errorCode = (error: unknown): string | undefined => (error !== null && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : undefined);

/** 读原文(字节);ENOENT/ENOTDIR 当空,其它读失败抛错 —— 读不到不能当空,否则原文会被覆盖成只剩隔离目录 */
function readBytesOrEmpty(filePath: string): Buffer {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') return Buffer.alloc(0);
    throw new Error(`${filePath} 读不到,不能把它覆盖成只剩隔离目录 (${code ?? 'unknown'})`);
  }
}
/** 确保隔离目录被忽略:UTF-8 的 .gitignore 原地追加(行为不变);非 UTF-8(UTF-16/GBK)回写必毁原文 ⇒ 只写 .git/info/exclude,用户文件逐字节不动 */
export function ensureWorktreeGitignore(sourcePath: string): void {
  const entry = DEFAULT_WORKTREE_DIR + '/';
  const gitignorePath = path.join(sourcePath, '.gitignore');
  const raw = readBytesOrEmpty(gitignorePath);
  const utf8 = !raw.includes(0) && Buffer.from(raw.toString('utf-8'), 'utf-8').equals(raw);
  const r = utf8 ? null : runGit(['rev-parse', '--git-path', 'info/exclude'], sourcePath);
  const target = utf8 ? gitignorePath : r?.ok && r.stdout ? path.resolve(sourcePath, r.stdout) : '';
  if (!target) throw new Error('gitignore 非 UTF-8 且 exclude 路径解析不到,不能静默不改');
  const content = (utf8 ? raw : readBytesOrEmpty(target)).toString('utf-8');
  if (!content.split(/\r?\n/).includes(entry)) fs.writeFileSync(target, content + (content.length > 0 && !content.endsWith('\n') ? '\n' : '') + entry + '\n', 'utf-8');
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
  opts?: { startPoint?: string; stat?: (target: string) => unknown },
): WorktreeCreateResult {
  if (!agentId || agentId.trim().length === 0) {
    throw new Error('agentId 不能为空');
  }
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  ensureWorktreeGitignore(sourcePath);

  const wtPath = path.join(rootDir, agentId);
  const look = opts?.stat ?? fs.statSync;
  let occupied = false;
  try {
    look(wtPath);
    occupied = true;
  } catch (error) {
    const code = errorCode(error) ?? 'unknown';
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw new Error(`工作树路径读不到,不能把它说成不存在再新建 (${code})`);
    }
  }
  if (occupied) {
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

type AgentWorktreeList = { listed: true; entries: WorktreeEntry[] } | { listed: false; entries: [] };

/**
 * 名单没读到时不删除分支,也不把前后条数差说成清理了多少。
 * 读到了才按「分支不在存活名单里」决定可删的名字。本函数不调用 git。
 */
export function planStaleBranchDeletes(input: {
  worktreesListed: boolean;
  liveBranches: readonly string[];
  branchNames: readonly string[];
}): string[] {
  if (!input.worktreesListed) return [];
  const live = new Set(input.liveBranches);
  return input.branchNames.filter((name) => !live.has(name));
}

/** 前后名单有一边没读到,就不报清理条数。 */
export function measuredPruneCount(
  beforeListed: boolean,
  beforeCount: number,
  afterListed: boolean,
  afterCount: number,
  pruneOk: boolean,
): number | null {
  if (!pruneOk || !beforeListed || !afterListed) return null;
  return Math.max(0, beforeCount - afterCount);
}

function readAgentWorktrees(sourcePath: string): AgentWorktreeList {
  const r = runGit(['worktree', 'list', '--porcelain'], sourcePath);
  if (!r.ok) return { listed: false, entries: [] };
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
  return { listed: true, entries: out };
}

/** 列出所有 agent 专属 worktree(git worktree list --porcelain,按分支前缀过滤) */
export function listAgentWorktrees(sourcePath: string): WorktreeEntry[] {
  return readAgentWorktrees(sourcePath).entries;
}

/** 按 agentId 查找 worktree 条目,不存在返回 null */
export function findAgentWorktree(sourcePath: string, agentId: string): WorktreeEntry | null {
  return listAgentWorktrees(sourcePath).find((e) => e.agentId === agentId) ?? null;
}

/** 执行 git worktree prune,返回清理掉的失效 worktree 数量 */
export function pruneWorktrees(sourcePath: string): number {
  const before = readAgentWorktrees(sourcePath);
  const r = runGit(['worktree', 'prune'], sourcePath);
  const after = r.ok ? readAgentWorktrees(sourcePath) : { listed: false as const, entries: [] as [] };
  return measuredPruneCount(before.listed, before.entries.length, after.listed, after.entries.length, r.ok) ?? 0;
}

/**
 * 清理孤儿 worktree 与孤儿分支:
 *   - 孤儿 worktree:git 元数据中登记但目录已被外部删除的条目 → prune
 *   - 孤儿分支:agent-wt-* 分支已无任何 worktree 挂载 → 分支 -D
 *
 * @returns { pruned: 清理的孤儿 worktree 数, branchesDeleted: 删除的孤儿分支数 }
 */
export function cleanupStaleWorktrees(sourcePath: string): { pruned: number; branchesDeleted: number } {
  const listed = readAgentWorktrees(sourcePath);
  if (!listed.listed) {
    process.stderr.write('warning: worktree 列表读不到,不能把它说成没有隔离副本,也不删除分支\n');
    return { pruned: 0, branchesDeleted: 0 };
  }
  const stale = listed.entries.filter((e) => !e.dirExists);
  let pruned = 0;
  let branchesDeleted = 0;

  if (stale.length > 0) {
    const r = runGit(['worktree', 'prune'], sourcePath);
    if (r.ok) pruned = stale.length;
  }

  // 孤儿分支检测:agent-wt-* 分支存在但已无对应 worktree。名单没再读到就不删。
  const branchList = runGit(
    ['branch', '--list', `${AGENT_BRANCH_PREFIX}*`, '--format=%(refname:short)'],
    sourcePath,
  );
  if (branchList.ok) {
    const live = readAgentWorktrees(sourcePath);
    const names = branchList.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const b of planStaleBranchDeletes({
      worktreesListed: live.listed,
      liveBranches: live.entries.map((e) => e.branch),
      branchNames: names,
    })) {
      const d = runGit(['branch', '-D', b], sourcePath);
      if (d.ok) branchesDeleted++;
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
