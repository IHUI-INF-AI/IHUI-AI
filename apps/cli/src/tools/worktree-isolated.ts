// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 隔离 worktree 生命周期(goal-b49 Z16 自 tools/worktree.ts 逐字拆出,零行为变更):
 * 子代理 / 会话级工具共用的创建与回收出口、并入/改动状态判据、会话台账与两档钩子派发。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// 隔离 worktree 两档钩子(worktreeCreate / worktreeRemove)与后台任务两档同一条派发纪律
import { runHook, type HookContext } from '../hooks/index.js';
// 子代理既有创建/清理实现:会话级工具与子代理共用同一套,不另写第二套
import {
  createWorktree,
  createWorktreeWithFallback,
  removeWorktree,
} from '../subagents/worktree.js';
import { runGit } from './worktree-core.js';
import type { WorktreeManager } from './worktree.js';

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
export function judgeWorktreeStatus(wtPath: string): 'clean' | 'dirty' | 'unknown' {
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

export function sessionScope(sourcePath: string): Map<string, IsolatedWorktree> {
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
export function fireWorktreeHook(event: WorktreeHookEvent, ctx: HookContext): void {
  try {
    void runHook(event, ctx).catch((e: unknown) => {
      process.stderr.write(`[worktree] ${event} hook threw: ${String(e)}\n`);
    });
  } catch (e) {
    // runHook 的同步段(配置解析/来源盖章)抛错同样不许外溢到创建/回收面
    process.stderr.write(`[worktree] ${event} hook dispatch failed: ${String(e)}\n`);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
