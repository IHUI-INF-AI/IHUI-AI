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
 *
 * Z16 拆分(goal-b49,零行为变更):本文件保持**唯一公开出口**。WorktreeManager 类与
 * cleanupWorktree 两条删除腿被 Z7/W-2/W5 的装车对账锁(worktree-trash-crossdrive ④、
 * worktree-containment ⑥、delete-axis-consumers ⑤)**逐字钉在本档源码文本上**,故原样留驻;
 * 其余按职责分居 worktree-core / worktree-trash-mirror / worktree-isolated /
 * worktree-tools / worktree-tools-exit(各 <250 行),导出集由
 * tests/worktree-shape-lock.test.ts 形状锁钉住。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// 删除保护链的目录回收腿(goal-b49 W1-①):同盘 rename 腿与跨盘镜像腿复用同两件既有出口,不另造第二把尺(§0.6)
import { stashDirToTrash } from './file-batch-edit.js';
// 文件访问裁决的 delete 轴(goal-b49 S5 接线):规则表与档位判据**全在这一件**,本层不抄第二份(§0.6)
// 容器性断言(goal-b49 W5):与 ACL 分职,判"删除目标解析后是否越出自家隔离区根",同取这一件单源
import { evaluateFileAccess, toAclPath, announceGuardUnjudged, judgeWorktreeContainment } from '../sandbox/file-access-policy.js';
import {
  AGENT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_DIR,
  MAX_DIFF_LENGTH,
  agentBranchName,
  emitWorktreeVoice,
  getDefaultWorktreeRoot,
  runGit,
  type WorktreeCreateResult,
  type WorktreeEntry,
} from './worktree-core.js';
import { mirrorDirIntoTrash, sameVolume } from './worktree-trash-mirror.js';

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
  remove(agentId: string, opts?: { force?: boolean; deleteBranch?: boolean }): boolean {
    const wtPath = path.join(this.rootDir, agentId);
    const containment = judgeWorktreeContainment(this.rootDir, wtPath);
    if (!containment.contained) {
      const refusal = `[worktree-containment] ${containment.reason}。下一步:${containment.nextStep}`;
      emitWorktreeVoice(refusal);
      throw new Error(refusal);
    }
    const aclDelete = evaluateFileAccess('delete', toAclPath(this.sourcePath, wtPath), this.sourcePath);
    // 守护面清单不可判 ⇒ 出声一次(S7:unjudged 透到消费点;排在下一次 fs 动作之前)
    announceGuardUnjudged(this.sourcePath, aclDelete.guard, 'worktree_remove');
    if (aclDelete.blocked) {
      throw new Error(aclDelete.note ?? `按文件访问裁决禁止删除 ${wtPath}`);
    }
    // advisory 档(守护面族)出声放行:静默等于没判(§0.9)
    if (aclDelete.note) emitWorktreeVoice(aclDelete.note);
    if (!fs.existsSync(wtPath)) return false;

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
 * `cleanupWorktree` 的**可传拒**结论(goal-b49 W-2 解锁,2026-11-05)。调用方据此决定是否清账面:
 *  ① `removed` — 目录经 `git worktree remove` / 回收站搬运 / `rmSync` 任一腿真没了;
 *  ② `absent`  — 目录本就不在(上一轮删过 / 外部删),账面可清;
 *  ③ `refused` — 容器性判越界 ⇒ 排在任何 fs 动作之前,**一个字节没动**;
 *  ④ `failed`  — fs / git 抛错(收尾不阻塞主流程,但仍如实报状态,绝不谎报 removed)。
 * ③④ 都不算"清干净":`background-registry.cleanupTaskWorktree` 只在 ①② 才清 `task.worktreePath`,
 * 否则"一次拒绝"会被下一次收尾静默洗成"已处理"(§0.9/§0.10),账面还指着那枚没删掉的目录。
 */
export type WorktreeCleanupOutcome =
  | { status: 'removed' }
  | { status: 'absent' }
  | { status: 'refused'; reason: string }
  | { status: 'failed'; reason: string };

/**
 * 独立清理函数 — 供无 manager 实例的场景(如 background-registry 后台任务收尾)调用。
 * fs / git 失败吞掉不阻塞主流程(孤儿可由 `WorktreeManager.cleanupStale` 兜底),但**状态如实上报**
 * (见 `WorktreeCleanupOutcome`:收尾不阻塞 ≠ 把没删写成删了,§0.9)。
 *
 * 容器性断言(goal-b49 W-2,判据单源 `judgeWorktreeContainment`,与 ACL 分职):
 * 本出口此前"刻意不接裁决"(S5),两条解锁条件现由本票**同批**满足 ——
 *  ① 返回形态已从 `void` 改出上面可传拒的 `WorktreeCleanupOutcome`;
 *  ② `task.worktreePath` 会经重臂 / 跨进程台账快照(`rearmBackgroundTask` 的
 *     `previous.worktreePath ?? incoming.worktreePath`)重新进入本出口 ⇒ 存在"把账面里的
 *     绝对路径直接当 wtPath"的调用方,不再只是"本进程自建自删"。
 * 命拒 = 越出隔离区根 ⇒ 先出声再返 `refused`,排在 `existsSync`/`git worktree remove`/回收站
 * rename/`rmSync` 之前 ⇒ 一个字节不删。合法隔离区因"隔离区叶子直子"那一臂不误杀。
 */
export function cleanupWorktree(wtPath: string, sourcePath: string, force = true): WorktreeCleanupOutcome {
  const containment = judgeWorktreeContainment(getDefaultWorktreeRoot(sourcePath), wtPath);
  if (!containment.contained) {
    emitWorktreeVoice(`[worktree-containment] ${containment.reason}。下一步:${containment.nextStep}`);
    return { status: 'refused', reason: containment.reason };
  }
  try {
    if (!fs.existsSync(wtPath)) return { status: 'absent' };
    const args = ['worktree', 'remove', wtPath];
    if (force) args.push('--force');
    const r = runGit(args, sourcePath);
    if (!r.ok) {
      // 与 WorktreeManager.remove 同一条纪律:先试回收站搬运,搬不动才 rmSync(兜底腿保留,Windows 句柄问题的既有解法)
      // 跨盘同 Z7/B1:不"假装试一把 rename",直接走镜像腿;镜像不成才出声并退回直接删除
      let stashed = false;
      if (sameVolume(sourcePath, wtPath)) {
        try {
          stashDirToTrash(sourcePath, wtPath, path.basename(wtPath));
          stashed = true;
        } catch {
          stashed = false;
        }
      } else {
        emitWorktreeVoice(`[worktree-trash] 隔离区与仓不同卷,rename 必抛 EXDEV:直接走镜像腿 ${wtPath}`);
      }
      if (!stashed) {
        const mirrored = mirrorDirIntoTrash(sourcePath, wtPath, path.basename(wtPath));
        if (!mirrored.ok) {
          emitWorktreeVoice(`[worktree-trash] ⚠️ 可逆档没走成(${mirrored.reason}),退回直接删除 ⇒ 此后现场不可恢复:${wtPath}`);
        }
        fs.rmSync(wtPath, { recursive: true, force: true });
        if (mirrored.ok) emitWorktreeVoice(`[worktree-trash] 已整目录镜像进回收站(源已删,现场可恢复):${mirrored.trashPath}`);
      }
    }
    runGit(['worktree', 'prune'], sourcePath);
    return { status: 'removed' };
  } catch (e) {
    // 清理失败不阻塞调用方(孤儿可由 cleanupStale 兜底),但状态如实上报,绝不谎报 removed
    return { status: 'failed', reason: e instanceof Error ? e.message : String(e) };
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
