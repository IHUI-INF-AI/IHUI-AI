// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorktreeManager — Git Worktree 并行隔离层(唯一公开出口 + 命令编排)。
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
 *
 * Z16 拆分(goal-b49,零行为变更):本文件保持**唯一公开出口**,导出集由
 * tests/worktree-shape-lock.test.ts 形状锁钉住;实现分居 worktree-core / worktree-trash-mirror /
 * worktree-isolated / worktree-tools / worktree-tools-exit。
 *
 * Z30 再拆一档(goal-b49,零行为变更,入口 396 → 现读 <250):
 *   - **账面/状态**(create / list / findByAgent / prune / cleanupStale / diff)搬到
 *     `./worktree-state.ts`,本档的类方法是逐字同签名的转接(§0.6 单一真相源,本层不留第二份实现);
 *   - **回收站搬运/独立收尾腿**(cleanupWorktree 与 WorktreeCleanupOutcome)搬到 `./worktree-cleanup.ts`。
 *   - **唯一留驻本档的实体动作 = `WorktreeManager.remove()`**:它被两把「不在本票射程」的既有用例
 *     源码装车锁逐字钉在入口文本上 —— delete-axis-consumers ⑤(在 remove 位与下面 prune 方法的文档
 *     注释行之间切片,断言 ACL 裁决排在 `'worktree', 'remove'` / `stashDirToTrash(` / `fs.rmSync(` /
 *     `fs.existsSync(wtPath)` 之前)与 delete-guard(断言入口含 `fs.rmSync(wtPath, { recursive: true, force: true })`
 *     与 `stashDirToTrash`)。把这条腿搬走 = 把删除裁决挪出问责面(§0.9 假绿),故留驻;
 *     可搬的都已搬净。删除腿的次序/枚数锁(worktree-trash-crossdrive ④、worktree-containment ⑥)
 *     已随搬运改指新档,判据一条未放宽:两腿各钉一次同序、全 worktree 族的 rmSync 仍是两枚、出声仍是两枚。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// 删除保护链的目录回收腿(goal-b49 W1-①):同盘 rename 腿与跨盘镜像腿复用同两件既有出口,不另造第二把尺(§0.6)
import { stashDirToTrash } from './file-batch-edit.js';
// 文件访问裁决的 delete 轴(goal-b49 S5 接线):规则表与档位判据**全在这一件**,本层不抄第二份(§0.6)
// 容器性断言(goal-b49 W5):与 ACL 分职,判"删除目标解析后是否越出自家隔离区根",同取这一件单源
import { evaluateFileAccess, toAclPath, announceGuardUnjudged, judgeWorktreeContainment } from '../sandbox/file-access-policy.js';
// 根内符号链接指向根外 ⇒ 拒绝递归删除(realpath 判据单源,与检查点/hunk/会话同取 path-guard)
import { assertPathInside } from '../util/path-guard.js';
import {
  AGENT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_DIR,
  emitWorktreeVoice,
  runGit,
  type WorktreeCreateResult,
  type WorktreeEntry,
} from './worktree-core.js';
import { mirrorDirIntoTrash, sameVolume } from './worktree-trash-mirror.js';
// 账面/状态腿的实现单源(Z30 拆档):下面各方法是逐字同签名的转接,不是第二份实现(§0.6)
import {
  cleanupStaleWorktrees,
  createAgentWorktree,
  diffWorktreeAgainstBase,
  findAgentWorktree,
  listAgentWorktrees,
  pruneWorktrees,
} from './worktree-state.js';

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

  /**
   * 为 agent 创建隔离 worktree:目录 .worktrees/<agentId>,分支 agent-wt-<uuid8>。
   * **实现住在 `./worktree-state.ts#createAgentWorktree`**(Z30 拆档,§0.6 转接不复制判据)。
   */
  create(agentId: string, opts?: { startPoint?: string; stat?: (target: string) => unknown }): WorktreeCreateResult {
    return createAgentWorktree(this.sourcePath, this.rootDir, agentId, opts);
  }

  /** 列出所有 agent 专属 worktree。**实现住在 `./worktree-state.ts#listAgentWorktrees`** */
  list(): WorktreeEntry[] {
    return listAgentWorktrees(this.sourcePath);
  }

  /** 按 agentId 查找 worktree 条目,不存在返回 null。**实现住在 `./worktree-state.ts#findAgentWorktree`** */
  findByAgent(agentId: string): WorktreeEntry | null {
    return findAgentWorktree(this.sourcePath, agentId);
  }

  /**
   * 移除 agent 的 worktree 并删除对应分支。
   *
   * 遵守删除安全规则:默认仅在 force=true 时强删(调用方须先确认 agent 已结束);
   * git worktree remove 失败时 fallback 到 fs.rmSync(Windows 兼容)。
   *
   * 前置两道**不同职**的判据(判据单源 `sandbox/file-access-policy.ts`),二者都排在任何删除动作之前:
   *  ① 容器性断言(goal-b49 W5):`agentId` 由模型入参决定(`exit_worktree` 的 `name`),
   *     解析后必须仍在 `this.rootDir`(隔离区根,本 manager 权威)之下;越界即先出声再抛,
   *     `existsSync` / `git worktree remove` / 回收站 rename / `rmSync` / 分支 `-D` 一条都不发生。
   *     与 ACL 分职:容器性判"有没有越出自家隔离区",不替代也不放宽 ACL。
   *  ② 文件访问裁决的 delete 轴(goal-b49 S5):命拒即抛(如目录名命中凭据族 `.npmrc`)。
   * 为什么两处必须都接:ACL 的绝对 / 越界回落只靠尾段 glob,`.env` / `id_rsa` 这类根层单列族
   * 对 `../..` 折叠出的目标打不中;容器性按几何事实补上这一盲区。
   * 与 W1 的两阶段批量护栏**不同职**:护栏管"这一批删多少",本层管"这个路径准不准删 / 出不出自家院子"。
   *
   * @returns 是否实际移除了目录(路径本就不存在时返回 false)
   * @throws 容器性判越界 或 文件访问裁决判拒时抛带 `[worktree-containment` / `[file-acl` 的理由
   */
  remove(agentId: string, opts?: { force?: boolean; deleteBranch?: boolean; stat?: (target: string) => unknown }): boolean {
    const wtPath = path.join(this.rootDir, agentId);
    const containment = judgeWorktreeContainment(this.rootDir, wtPath);
    if (!containment.contained) {
      // 容器性判越界:出声 + 抛(现场一字节不删)。**不得**改成"返回 false 视同查不到" ——
      // 那会把一次越界回收静默成"本来就没有这棵树",`..` 折叠出的越界路径将不再出声,
      // 判据(worktree-containment 的 ①+② 反控)当场失明。与下方 aclDelete 拒删同口径:都是拒,都出声。
      const refusal = `[worktree-containment] ${containment.reason}。下一步:${containment.nextStep}`;
      emitWorktreeVoice(refusal);
      throw new Error(refusal);
    }
    // 根内但 realpath 拐到根外的符号链接/junction ⇒ 拒绝递归删除(现场不受损)。
    assertPathInside(this.rootDir, wtPath, 'worktree 删除目录');
    const aclDelete = evaluateFileAccess('delete', toAclPath(this.sourcePath, wtPath), this.sourcePath);
    // 守护面清单不可判 ⇒ 出声一次(S7:unjudged 透到消费点;排在下一次 fs 动作之前)
    announceGuardUnjudged(this.sourcePath, aclDelete.guard, 'worktree_remove');
    if (aclDelete.blocked) {
      throw new Error(aclDelete.note ?? `按文件访问裁决禁止删除 ${wtPath}`);
    }
    // advisory 档(守护面族)出声放行:静默等于没判(§0.9)
    if (aclDelete.note) emitWorktreeVoice(aclDelete.note);
    const look = opts?.stat ?? fs.statSync;
    try {
      look(wtPath);
    } catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'unknown';
      if (code === 'ENOENT' || code === 'ENOTDIR') return false;
      throw new Error(`工作树读不到,不能把它说成已经不在 (${code})`);
    }

    // 移除前先捕获分支名(移除后 git 元数据里已查不到)
    const entry = this.findByAgent(agentId);

    const args = ['worktree', 'remove', wtPath];
    if (opts?.force) args.push('--force');
    const r = runGit(args, this.sourcePath);
    if (!r.ok) {
      // 兜底前先尝试整目录搬进回收站(同盘 rename 可逆 ⇒ 现场可恢复,goal-b49 W1-①);
      // 跨盘(rename 必抛 EXDEV)不再"假装试一把再硬删",直接走镜像腿(Z7/B1 未竟 5);
      // 搬不动(Windows 句柄占用,正是本兜底腿存在的理由)才退回直接 rmSync —— 该腿不得摘除。
      let stashedPath: string | null = null;
      if (sameVolume(this.sourcePath, wtPath)) {
        try {
          stashedPath = stashDirToTrash(this.sourcePath, wtPath, agentId);
        } catch {
          stashedPath = null;
        }
      } else {
        emitWorktreeVoice(`[worktree-trash] 隔离区与仓不同卷,rename 必抛 EXDEV:直接走镜像腿 ${wtPath}`);
      }
      if (!stashedPath) {
        const mirrored = mirrorDirIntoTrash(this.sourcePath, wtPath, agentId);
        if (!mirrored.ok) {
          emitWorktreeVoice(`[worktree-trash] ⚠️ 可逆档没走成(${mirrored.reason}),退回直接删除 ⇒ 此后现场不可恢复:${wtPath}`);
        }
        try {
          fs.rmSync(wtPath, { recursive: true, force: true });
        } catch {
          throw new Error(`worktree 删除失败: ${r.stderr || r.stdout}`);
        }
        if (mirrored.ok) emitWorktreeVoice(`[worktree-trash] 已整目录镜像进回收站(源已删,现场可恢复):${mirrored.trashPath}`);
      }
      // 目录是手工搬运/删除的,补一次 prune 清掉 git 内部元数据
      runGit(['worktree', 'prune'], this.sourcePath);
    }

    // 删除 agent 专属分支(deleteBranch 默认 true,分支是 agent-wt-* 隔离分支,删除安全)
    if (opts?.deleteBranch !== false && entry?.branch.startsWith(AGENT_BRANCH_PREFIX)) {
      runGit(['branch', '-D', entry.branch], this.sourcePath);
    }
    return true;
  }

  /** 执行 git worktree prune,返回清理掉的失效 worktree 数量。**实现住在 `./worktree-state.ts#pruneWorktrees`** */
  prune(): number {
    return pruneWorktrees(this.sourcePath);
  }

  /**
   * 清理孤儿 worktree 与孤儿分支(目录已外部删除 ⇒ prune;agent-wt-* 无挂载 ⇒ 分支 -D)。
   * **实现住在 `./worktree-state.ts#cleanupStaleWorktrees`**
   *
   * @returns { pruned: 清理的孤儿 worktree 数, branchesDeleted: 删除的孤儿分支数 }
   */
  cleanupStale(): { pruned: number; branchesDeleted: number } {
    return cleanupStaleWorktrees(this.sourcePath);
  }

  /**
   * 输出 agent worktree 相对基线(HEAD)的全部改动 diff,供主 agent 审阅合并。
   * **实现住在 `./worktree-state.ts#diffWorktreeAgainstBase`**
   */
  diff(agentId: string): string {
    return diffWorktreeAgainstBase(this.rootDir, agentId);
  }
}

// ==================== 隔离 worktree 生命周期(拆出实现,公开出口自本档再导出) ====================

export {
  AGENT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_DIR,
  agentBranchName,
  getDefaultWorktreeRoot,
  type WorktreeCreateResult,
  type WorktreeEntry,
} from './worktree-core.js';
export {
  mirrorDirIntoTrash,
  sameVolume,
  type WorktreeMirrorOutcome,
} from './worktree-trash-mirror.js';
export {
  createIsolatedWorktree,
  removeIsolatedWorktree,
  judgeWorktreeBranchMerged,
  type CreateIsolatedWorktreeRequest,
  type IsolatedWorktree,
  type RemoveIsolatedWorktreeRequest,
  type WorktreeHookEvent,
} from './worktree-isolated.js';
export { enterWorktreeTool } from './worktree-tools.js';
export { exitWorktreeTool, WORKTREE_TOOLS } from './worktree-tools-exit.js';
// 独立收尾腿的实现单源在 `./worktree-cleanup.ts`(Z30 拆档);公开出口仍只认本档(形状锁钉键集)
export { cleanupWorktree, type WorktreeCleanupOutcome } from './worktree-cleanup.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
