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
// 隔离 worktree 两档钩子(worktreeCreate / worktreeRemove)与后台任务两档同一条派发纪律
import { runHook, type HookContext } from '../hooks/index.js';
// 子代理既有创建/清理实现:会话级工具与子代理共用同一套,不另写第二套
import {
  createWorktree,
  createWorktreeWithFallback,
  removeWorktree,
} from '../subagents/worktree.js';
// 工具契约只取类型(运行时无环:tools/index.ts 反向 re-export 本模块)
import type { Tool } from './index.js';

/** agent 专属 worktree 分支前缀(唯一分支名 agent-wt-<uuid8>) */
export const AGENT_BRANCH_PREFIX = 'agent-wt-';

/** 默认隔离目录名(相对 sourcePath) */
export const DEFAULT_WORKTREE_DIR = '.worktrees';

/** diff 输出最大长度(超过截断,避免撑爆主 agent context) */
const MAX_DIFF_LENGTH = 4000;

interface GitResult {
  ok: boolean;
  /** 退出码(killed/未跑起来为 -1)。`merge-base --is-ancestor` 靠 0/1/其它 三态分辨"并入/未并入/判不出" */
  status: number;
  stdout: string;
  stderr: string;
}

/** 执行 git 命令(spawnSync 直调,非 shell,Windows 兼容) */
function runGit(args: string[], cwd: string): GitResult {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: r.status === 0,
    status: typeof r.status === 'number' ? r.status : -1,
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

// ==================== 隔离 worktree 生命周期(子代理 / 会话级工具共用) ====================

/** 一次隔离创建的归一结果:调用方不需要知道走了哪条既有路径。 */
export interface IsolatedWorktree {
  /** 隔离区绝对路径 */
  path: string;
  /** 分支名(manager 路径 agent-wt-<uuid8> / 子代理路径 subagent/<id>) */
  branch: string;
  /** true = 走 WorktreeManager(收尾须回同一实例,才能连带删 agent-wt-* 分支) */
  viaManager: boolean;
}

export interface CreateIsolatedWorktreeRequest {
  /** 源仓库路径(主工作区) */
  sourcePath: string;
  /** 隔离目录名(同时是 worktree id) */
  agentId: string;
  /** 子代理路径的父会话 id(仅非 manager 路径使用;省略退回 agentId) */
  parentId?: string;
  /** 基线提交(仅 manager 路径支持;省略 = 当前 HEAD) */
  startPoint?: string;
  /** 注入的 WorktreeManager(有则走 .worktrees/<id> + agent-wt-* 分支) */
  manager?: WorktreeManager;
  /** 非 manager 路径是否启用 CoW 快路径 */
  fastPathEnabled?: boolean;
}

/**
 * 创建隔离 worktree 的唯一入口 —— 从 `subagent.ts` 原路径 A/B 抽出,子代理与会话级工具共用。
 *
 * 两条既有实现二选一:
 *   - 注入 WorktreeManager:`WorktreeManager.create`(`.worktrees/<id>` + `agent-wt-<uuid8>` 分支,并发不冲突);
 *   - 未注入:`subagents/worktree.ts` 的 `createWorktree` / `createWorktreeWithFallback`(`subagent/<id>` 分支)。
 * 失败一律抛错,由调用方决定"报错退出"还是"收尾继续"(与两条原路径的失败半径逐字同形)。
 */
export async function createIsolatedWorktree(
  req: CreateIsolatedWorktreeRequest,
): Promise<IsolatedWorktree> {
  if (req.manager) {
    const wt = req.manager.create(
      req.agentId,
      req.startPoint ? { startPoint: req.startPoint } : undefined,
    );
    return { path: wt.path, branch: wt.branch, viaManager: true };
  }
  const parentId = req.parentId ?? req.agentId;
  const wt =
    req.fastPathEnabled === true
      ? await createWorktreeWithFallback(parentId, req.agentId, req.sourcePath, true)
      : createWorktree(parentId, req.agentId, req.sourcePath);
  return { path: wt.path, branch: wt.branch, viaManager: false };
}

export interface RemoveIsolatedWorktreeRequest {
  sourcePath: string;
  agentId: string;
  /** 隔离区绝对路径(用来确认目录是否真的消失) */
  path: string;
  viaManager: boolean;
  manager?: WorktreeManager;
  /** 默认 true:语义是"调用方已判定该隔离区可弃",与子代理收尾同档 */
  force?: boolean;
}

/**
 * 回收隔离 worktree 的唯一出口 —— 从 `subagent.ts` 原收尾分支抽出,子代理与会话级工具共用。
 *
 * §12h 的收尾次序不在本层重抄,只调用既有器物:
 *   - `removeWorktree` 内部在目录删除成功后 prune(本仓唯一删除出口);
 *   - WorktreeManager 路径在 `remove` 之后补一次既有 `prune()`;
 *   - 目录没真消失 ⇒ **不** prune,removed=false 交调用方按"未判定"处理(不把没删掉写成删掉了)。
 *
 * `pruned` 只在 manager 路径上是本层实测数(其它路径的 prune 已随 `removeWorktree` 跑过,重复调
 * 只会再摘一次注册表,没意义)—— null 表示"未由本层单独计量",不是 0。
 */
export function removeIsolatedWorktree(
  req: RemoveIsolatedWorktreeRequest,
): { removed: boolean; pruned: number | null } {
  const force = req.force !== false;
  if (req.viaManager && req.manager) {
    const removed = req.manager.remove(req.agentId, { force, deleteBranch: true });
    if (fs.existsSync(req.path)) return { removed: false, pruned: null };
    // 目录已真消失,才摘注册表条目(管理目录已被外部删掉的早退分支同样走到这里)
    return { removed, pruned: req.manager.prune() };
  }
  const removed = removeWorktree(req.path, { sourcePath: req.sourcePath, force });
  return { removed, pruned: null };
}

/**
 * 分支是否已并入基线(默认源仓库 HEAD)。
 *
 * 三态而不是布尔:`git merge-base --is-ancestor` 的 1 是"确定未并入",128 一类是"判不出"。
 * 破坏性动作对 unknown 一律拒做(fail-closed),不把"没判"折成"可以删"。
 */
export function judgeWorktreeBranchMerged(
  sourcePath: string,
  branch: string,
  baseRef = 'HEAD',
): 'merged' | 'unmerged' | 'unknown' {
  const r = runGit(['merge-base', '--is-ancestor', branch, baseRef], sourcePath);
  if (r.ok) return 'merged';
  return r.status === 1 ? 'unmerged' : 'unknown';
}

/** 隔离区是否有未提交改动(含 intent-to-add)。unknown = 判不出,调用方按"未判定"处理。 */
function judgeWorktreeStatus(wtPath: string): 'clean' | 'dirty' | 'unknown' {
  const r = runGit(['-C', wtPath, 'status', '--porcelain'], wtPath);
  if (!r.ok) return 'unknown';
  return r.stdout === '' ? 'clean' : 'dirty';
}

/**
 * 本进程内"本会话进入了哪个隔离区"的台账。
 * git 注册表只回答"哪些 worktree 存在",回答不了"本会话进入的是哪一个" ——
 * `exit_worktree` 不传 name 时就靠这张表解析(传了 name 则仍以 git 注册表为准,支持跨进程收尾)。
 */
const enteredWorktrees = new Map<string, Map<string, IsolatedWorktree>>();

function sessionScope(sourcePath: string): Map<string, IsolatedWorktree> {
  const abs = path.resolve(sourcePath);
  const key = process.platform === 'win32' ? abs.toLowerCase() : abs;
  let scope = enteredWorktrees.get(key);
  if (!scope) {
    scope = new Map<string, IsolatedWorktree>();
    enteredWorktrees.set(key, scope);
  }
  return scope;
}

export type WorktreeHookEvent = 'worktreeCreate' | 'worktreeRemove';

/**
 * worktree 两档钩子派发 —— 纪律逐条照 `background-registry.ts` 的 `fireTaskHook`:
 * ① fail-open 但不静默:钩子体抛错不得把创建/回收带崩,但必须落 `[worktree]` 通道;
 * ② 只走 stderr:json 档的 stdout 是机器可读流,钩子的状态语混进去会把整段输出弄坏;
 * ③ 状态一律读当下事实,不在调用方猜(创建成功后才派发,回收成功后才派发)。
 */
function fireWorktreeHook(event: WorktreeHookEvent, ctx: HookContext): void {
  try {
    void runHook(event, ctx).catch((e: unknown) => {
      process.stderr.write(`[worktree] ${event} hook threw: ${String(e)}\n`);
    });
  } catch (e) {
    // runHook 的同步段(配置解析/来源盖章)抛错同样不许外溢到创建/回收面
    process.stderr.write(`[worktree] ${event} hook dispatch failed: ${String(e)}\n`);
  }
}

// ==================== 会话级工具:enter_worktree / exit_worktree ====================

/**
 * 进入隔离 worktree(会话级)。
 *
 * 与子代理共用 `createIsolatedWorktree`:同一个 `.worktrees/<name>` + `agent-wt-<uuid8>` 分支形态,
 * 同一套失败半径。返回值里给出隔离区绝对路径 —— 后续读写使用该路径下的绝对路径
 * (本工具的装配点在命令层,会话 cwd 不在此处改写;不写"已切换工作目录"这种做不到的承诺)。
 */
export const enterWorktreeTool: Tool = {
  name: 'enter_worktree',
  description:
    '在当前仓库创建并进入一个隔离的 git worktree(目录 .worktrees/<name>,分支 agent-wt-<uuid8>)。参数:name(可选,隔离区名;省略自动生成),startPoint(可选,基线提交,默认当前 HEAD)。返回隔离区绝对路径:后续读写请使用该路径下的绝对路径;结束时用 exit_worktree 回收。',
  dangerLevel: 'write',
  parameters: {
    name: {
      type: 'string',
      description: '隔离区名(同时作为 .worktrees/<name> 目录名);省略则自动生成',
    },
    startPoint: {
      type: 'string',
      description: '基线提交/分支(默认当前 HEAD)',
    },
  },
  required: [],
  // 新增工具必须带契约(守门 111 TC1:「新增即拦」;存量工具走各文件 HEAD 锚点)。
  contract: {
    shape: {
      input: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '隔离区名(省略自动生成)' },
          startPoint: { type: 'string', description: '基线提交(默认 HEAD)' },
        },
        required: [],
      },
      visibleToProvider: true,
    },
    permission: {
      permissionKey: 'enter_worktree',
      reason: '在 .worktrees/<name> 下创建 git worktree 与 agent-wt-* 隔离分支;只新增不改既有工作树,同名冲突直接报错',
      riskLevel: 'write',
      effectScope: 'repository',
      requiresApproval: false,
      // 只新增隔离目录与分支,不删改任何既有内容 ⇒ 不需要确认(显式决定,不是"漏声明")
      confirmation: { mode: 'none', reason: '只新增隔离目录与分支;同名冲突直接报错,不覆盖' },
    },
    resultBudget: {
      inlineLimitBytes: 8_000,
      providerVisibleLimitBytes: 8_000,
      policy: 'truncate',
      preview: { bytes: 2_000, lines: 40, from: 'head' },
    },
  },
  async execute(args, ctx) {
    const sourcePath = ctx.workspacePath;
    if (!sourcePath) {
      return { success: false, output: '', error: '缺少工作区路径,无法创建隔离 worktree' };
    }
    const rawName = typeof args.name === 'string' ? args.name.trim() : '';
    const name = rawName !== '' ? rawName : `session-${uuid8()}`;
    const startPoint = typeof args.startPoint === 'string' && args.startPoint.trim() !== ''
      ? args.startPoint.trim()
      : undefined;

    const scope = sessionScope(sourcePath);
    if (scope.has(name)) {
      return {
        success: false,
        output: '',
        error: `本会话已进入隔离区 ${name}:先 exit_worktree 回收,或换一个 name`,
      };
    }

    try {
      const wt = await createIsolatedWorktree({
        sourcePath,
        agentId: name,
        startPoint,
        manager: new WorktreeManager(sourcePath),
      });
      scope.set(name, wt);
      fireWorktreeHook('worktreeCreate', {
        workspacePath: sourcePath,
        worktreeName: name,
        worktreePath: wt.path,
        worktreeBranch: wt.branch,
      });
      return {
        success: true,
        output: [
          `已创建隔离 worktree:${name}`,
          `路径: ${wt.path}`,
          `分支: ${wt.branch}`,
          '后续读写请使用上述路径下的绝对路径;结束时调用 exit_worktree 回收(默认拒绝删除未合并或有未提交改动的检出)',
        ].join('\n'),
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `worktree 创建失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/**
 * 回收会话级隔离 worktree。
 *
 * 安全判据(CLI 层自证,不依赖调用方自觉):
 *   - 分支未并入源仓库 HEAD / 并入状态判不出 ⇒ 默认拒删;
 *   - 隔离区有未提交改动 / 改动状态判不出 ⇒ 默认拒删;
 *   - 确认无价值时用 force=true 越过上述两档(输出里如实标注 forced);
 *   - 删除走 `removeIsolatedWorktree`(既有删除出口 + 既有 prune),不在这里复制 §12h 判据文本。
 */
export const exitWorktreeTool: Tool = {
  name: 'exit_worktree',
  description:
    '回收本会话的隔离 git worktree 并摘掉 git 注册表条目(prune)。默认拒绝删除「分支未并入当前 HEAD」或「隔离区有未提交改动」的检出;确认改动无价值后可用 force=true 强制。参数:name(可选,隔离区名,默认本会话进入的那一个),force(可选,默认 false)。',
  dangerLevel: 'dangerous',
  parameters: {
    name: {
      type: 'string',
      description: '要回收的隔离区名;省略则回收本会话进入的那一个',
    },
    force: {
      type: 'boolean',
      description: '越过「未合并 / 有未提交改动」两条拒删判据(默认 false)',
    },
  },
  required: [],
  // 删除类工具:危险档 + 交互确认(与 delete_file 同档),默认仍先过未合并/未提交两条拒删判据。
  contract: {
    shape: {
      input: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '隔离区名(默认本会话进入的那一个)' },
          force: { type: 'boolean', description: '越过未合并/未提交拒删判据' },
        },
        required: [],
      },
      visibleToProvider: true,
    },
    permission: {
      permissionKey: 'exit_worktree',
      reason: '回收隔离 worktree 目录与 agent-wt-* 分支(默认拒删未合并或有未提交改动的检出)',
      riskLevel: 'dangerous',
      effectScope: 'repository',
      requiresApproval: true,
      confirmation: { mode: 'interactive' },
    },
    resultBudget: {
      inlineLimitBytes: 8_000,
      providerVisibleLimitBytes: 8_000,
      policy: 'truncate',
      preview: { bytes: 2_000, lines: 40, from: 'head' },
    },
  },
  async execute(args, ctx) {
    const sourcePath = ctx.workspacePath;
    if (!sourcePath) {
      return { success: false, output: '', error: '缺少工作区路径,无法回收隔离 worktree' };
    }
    const force = args.force === true;
    const manager = new WorktreeManager(sourcePath);
    const scope = sessionScope(sourcePath);
    const requested = typeof args.name === 'string' ? args.name.trim() : '';

    let name = requested;
    if (name === '') {
      if (scope.size === 0) {
        return {
          success: false,
          output: '',
          error: '本会话没有登记过的隔离 worktree:请显式传 name(可先 git worktree list 查看)',
        };
      }
      if (scope.size > 1) {
        return {
          success: false,
          output: '',
          error: `本会话有 ${scope.size} 个隔离 worktree(${[...scope.keys()].join(', ')}):请用 name 指定要回收的那一个`,
        };
      }
      name = [...scope.keys()][0]!;
    }

    const registered = scope.get(name);
    const listed = manager.findByAgent(name);
    const wtPath = listed?.path ?? registered?.path;
    const branch = listed?.branch ?? registered?.branch;
    if (!wtPath || !branch) {
      return {
        success: false,
        output: '',
        error: `未找到隔离 worktree:${name}(可先 git worktree list 核对名字)`,
      };
    }

    const merged = judgeWorktreeBranchMerged(sourcePath, branch);
    const status = judgeWorktreeStatus(wtPath);
    if (!force) {
      if (merged === 'unmerged') {
        return {
          success: false,
          output: '',
          error: `分支 ${branch} 未并入当前 HEAD:先合并该分支;确认改动无价值后再传 force=true(会连带删除分支)`,
        };
      }
      if (merged === 'unknown') {
        return {
          success: false,
          output: '',
          error: `未能判定分支 ${branch} 是否已并入 HEAD(merge-base 异常):不静默删;人工确认后传 force=true`,
        };
      }
      if (status === 'dirty') {
        return {
          success: false,
          output: '',
          error: `隔离区有未提交改动(${wtPath}):先提交或导出;确认可弃后再传 force=true`,
        };
      }
      if (status === 'unknown') {
        return {
          success: false,
          output: '',
          error: `未能判定隔离区改动状态(git status 异常,${wtPath}):不静默删;人工确认后传 force=true`,
        };
      }
    }

    try {
      // 安全判据在本层;`git worktree remove --force` 只解决"目录非空/被占用"这一档
      const result = removeIsolatedWorktree({
        sourcePath,
        agentId: name,
        path: wtPath,
        viaManager: true,
        manager,
        force: true,
      });
      if (!result.removed) {
        return {
          success: false,
          output: '',
          error: `worktree 目录未被移除(${wtPath}):注册表条目与目录状态不一致,请人工核对后重试`,
        };
      }
      scope.delete(name);
      fireWorktreeHook('worktreeRemove', {
        workspacePath: sourcePath,
        worktreeName: name,
        worktreePath: wtPath,
        worktreeBranch: branch,
        worktreeForced: force,
      });
      return {
        success: true,
        output: [
          `已回收隔离 worktree:${name}`,
          `路径: ${wtPath}`,
          `分支: ${branch}(已删除)`,
          ...(force ? ['注意:本次走了 force 档(越过未合并/未提交改动判据)'] : []),
        ].join('\n'),
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `worktree 回收失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

/** 会话级 worktree 工具族(注册进 setupAgentTools 的 registerTools 链)。 */
export const WORKTREE_TOOLS: Tool[] = [enterWorktreeTool, exitWorktreeTool];

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
