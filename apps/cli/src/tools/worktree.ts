// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorktreeManager — Git Worktree 并行隔离层。
 *
 * 对标 Cursor 3.x 的多并行 background agents + worktree 隔离:每个并行 subagent
 * 在独立的 git worktree 中工作,彻底消除多 subagent 共享工作目录时的文件写冲突。
 *
 * 做减法(与 src/subagents/worktree.ts 的 subagent/<id> 方案互补):
 *   - 仅封装 git worktree add / list / remove / prune / 孤儿清理,不引入新依赖
 *   - 隔离目录默认 .worktrees/<agent-id>(相对 sourcePath),并自动写入 .gitignore
 *   - 分支名固定 agent-wt-<uuid8>(8 位 uuid 随机段),并发创建天然不冲突
 *   - git 操作用 spawnSync 直调(非 shell,避免注入),Windows 完全兼容
 *   - 任务完成后可用 diff() 输出 worktree 相对基线的改动,供主 agent 审阅合并
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

/** agent 专属 worktree 分支前缀(唯一分支名 agent-wt-<uuid8>) */
export const AGENT_BRANCH_PREFIX = 'agent-wt-';

/** 默认隔离目录名(相对 sourcePath) */
export const DEFAULT_WORKTREE_DIR = '.worktrees';

/** diff 输出最大长度(超过截断,避免撑爆主 agent context) */
const MAX_DIFF_LENGTH = 4000;

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** 执行 git 命令(spawnSync 直调,非 shell,Windows 兼容) */
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

/** 生成 8 位 uuid 随机段(去掉连字符取前 8 位,并发冲突概率可忽略) */
function uuid8(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

/** 生成唯一的 agent worktree 分支名:agent-wt-<uuid8> */
export function agentBranchName(): string {
  return AGENT_BRANCH_PREFIX + uuid8();
}

/** 默认 worktree 根目录:.worktrees(相对 sourcePath) */
export function getDefaultWorktreeRoot(sourcePath: string): string {
  return path.join(sourcePath, DEFAULT_WORKTREE_DIR);
}

/** 单个 agent worktree 条目(list 返回) */
export interface WorktreeEntry {
  /** agent 标识(即隔离目录名) */
  agentId: string;
  /** worktree 绝对路径 */
  path: string;
  /** 分支名(agent-wt-<uuid8>) */
  branch: string;
  /** 目录是否真实存在(false = 孤儿 worktree,目录已被外部删除) */
  dirExists: boolean;
}

/** create 返回的创建结果 */
export interface WorktreeCreateResult {
  agentId: string;
  path: string;
  branch: string;
  createdAt: string;
}

/** WorktreeManager — 管理某源仓库下所有 agent worktree 的生命周期 */
export class WorktreeManager {
  /** 源仓库路径(主工作区) */
  readonly sourcePath: string;
  /** worktree 根目录(默认 sourcePath/.worktrees,可用构造参数覆盖) */
  readonly rootDir: string;

  constructor(sourcePath: string, rootDir?: string) {
    this.sourcePath = path.resolve(sourcePath);
    this.rootDir = rootDir ? path.resolve(rootDir) : path.join(this.sourcePath, DEFAULT_WORKTREE_DIR);
  }

  /** 确保 .gitignore 忽略 .worktrees/,避免隔离目录污染主仓库状态 */
  private ensureGitignore(): void {
    const gitignorePath = path.join(this.sourcePath, '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
    if (content.split(/\r?\n/).includes(DEFAULT_WORKTREE_DIR + '/')) return;
    const newline = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(gitignorePath, content + newline + DEFAULT_WORKTREE_DIR + '/\n', 'utf-8');
  }

  /**
   * 为 agent 创建隔离 worktree:目录 .worktrees/<agentId>,分支 agent-wt-<uuid8>。
   *
   * 并发安全:分支名含 uuid8 随机段,多个 agent 同时创建互不冲突;
   * 同一 agentId 重复创建会因目录已存在而抛错(由调用方决定清理或换 id)。
   *
   * @param agentId agent 标识(同时作为隔离目录名)
   * @param opts.startPoint 基线提交(默认当前 HEAD)
   */
  create(agentId: string, opts?: { startPoint?: string }): WorktreeCreateResult {
    if (!agentId || agentId.trim().length === 0) {
      throw new Error('agentId 不能为空');
    }
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    this.ensureGitignore();

    const wtPath = path.join(this.rootDir, agentId);
    if (fs.existsSync(wtPath)) {
      throw new Error(`worktree 路径已存在: ${wtPath}(同一 agentId 不能重复创建)`);
    }

    // 分支名含 uuid8 随机段,并发创建天然不冲突
    const branch = agentBranchName();

    let startPoint = opts?.startPoint;
    if (!startPoint) {
      const head = runGit(['rev-parse', 'HEAD'], this.sourcePath);
      startPoint = head.ok ? head.stdout : 'HEAD';
    }

    const r = runGit(
      ['worktree', 'add', '-b', branch, wtPath, startPoint],
      this.sourcePath,
    );
    if (!r.ok) {
      throw new Error(`git worktree add 失败: ${r.stderr || r.stdout}`);
    }

    return { agentId, path: wtPath, branch, createdAt: new Date().toISOString() };
  }

  /** 列出所有 agent 专属 worktree(git worktree list --porcelain,按分支前缀过滤) */
  list(): WorktreeEntry[] {
    const r = runGit(['worktree', 'list', '--porcelain'], this.sourcePath);
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
  findByAgent(agentId: string): WorktreeEntry | null {
    return this.list().find((e) => e.agentId === agentId) ?? null;
  }

  /**
   * 移除 agent 的 worktree 并删除对应分支。
   *
   * 遵守删除安全规则:默认仅在 force=true 时强删(调用方须先确认 agent 已结束);
   * git worktree remove 失败时 fallback 到 fs.rmSync(Windows 兼容)。
   *
   * @returns 是否实际移除了目录(路径本就不存在时返回 false)
   */
  remove(agentId: string, opts?: { force?: boolean; deleteBranch?: boolean }): boolean {
    const wtPath = path.join(this.rootDir, agentId);
    if (!fs.existsSync(wtPath)) return false;

    // 移除前先捕获分支名(移除后 git 元数据里已查不到)
    const entry = this.findByAgent(agentId);

    const args = ['worktree', 'remove', wtPath];
    if (opts?.force) args.push('--force');
    const r = runGit(args, this.sourcePath);
    if (!r.ok) {
      // fallback:直接删目录(如 CoW 拷贝型 .git 或半损坏的 worktree 元数据)
      try {
        fs.rmSync(wtPath, { recursive: true, force: true });
      } catch {
        throw new Error(`worktree 删除失败: ${r.stderr || r.stdout}`);
      }
      // 目录是手工删除的,补一次 prune 清掉 git 内部元数据
      runGit(['worktree', 'prune'], this.sourcePath);
    }

    // 删除 agent 专属分支(deleteBranch 默认 true,分支是 agent-wt-* 隔离分支,删除安全)
    if (opts?.deleteBranch !== false && entry?.branch.startsWith(AGENT_BRANCH_PREFIX)) {
      runGit(['branch', '-D', entry.branch], this.sourcePath);
    }
    return true;
  }

  /** 执行 git worktree prune,返回清理掉的失效 worktree 数量 */
  prune(): number {
    const before = this.list();
    const r = runGit(['worktree', 'prune'], this.sourcePath);
    if (!r.ok) return 0;
    const after = this.list();
    return Math.max(0, before.length - after.length);
  }

  /**
   * 清理孤儿 worktree 与孤儿分支:
   *   - 孤儿 worktree:git 元数据中登记但目录已被外部删除的条目 → prune
   *   - 孤儿分支:agent-wt-* 分支已无任何 worktree 挂载 → 分支 -D
   *
   * @returns { pruned: 清理的孤儿 worktree 数, branchesDeleted: 删除的孤儿分支数 }
   */
  cleanupStale(): { pruned: number; branchesDeleted: number } {
    const entries = this.list();
    const stale = entries.filter((e) => !e.dirExists);
    let pruned = 0;
    let branchesDeleted = 0;

    if (stale.length > 0) {
      const r = runGit(['worktree', 'prune'], this.sourcePath);
      if (r.ok) pruned = stale.length;
    }

    // 孤儿分支检测:agent-wt-* 分支存在但已无对应 worktree
    const branchList = runGit(
      ['branch', '--list', `${AGENT_BRANCH_PREFIX}*`, '--format=%(refname:short)'],
      this.sourcePath,
    );
    if (branchList.ok) {
      const liveBranches = new Set(this.list().map((e) => e.branch));
      for (const b of branchList.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
        if (!liveBranches.has(b)) {
          const d = runGit(['branch', '-D', b], this.sourcePath);
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
  diff(agentId: string): string {
    const wtPath = path.join(this.rootDir, agentId);
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
}

/**
 * 独立清理函数 — 供无 manager 实例的场景(如 background-registry 后台任务收尾)调用。
 * 内部所有失败均吞掉(收尾清理不阻塞主流程),并补一次 prune 清元数据。
 */
export function cleanupWorktree(wtPath: string, sourcePath: string, force = true): void {
  try {
    if (!fs.existsSync(wtPath)) return;
    const args = ['worktree', 'remove', wtPath];
    if (force) args.push('--force');
    const r = runGit(args, sourcePath);
    if (!r.ok) {
      fs.rmSync(wtPath, { recursive: true, force: true });
    }
    runGit(['worktree', 'prune'], sourcePath);
  } catch {
    // 清理失败不阻塞调用方,孤儿可由 WorktreeManager.cleanupStale 兜底
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
