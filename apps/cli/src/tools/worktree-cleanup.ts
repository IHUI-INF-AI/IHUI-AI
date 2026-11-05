// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 独立收尾腿(goal-b49/Z30 自 worktree.ts 拆出,零行为变更)。
 *
 * 职责:无 manager 实例时(后台任务收尾)按绝对路径回收一枚隔离 worktree ——
 * 容器性断言 → git worktree remove → 回收站搬运(同盘 rename / 跨盘镜像)→ rmSync 兜底 → prune。
 * 判据、次序、出声点与拆分前**逐字一致**;删除动作的可达路径仍只有两条腿
 * (另一条 = 入口档 `WorktreeManager.remove()`,被既有用例的源码装车锁钉在入口)。
 * 锁的射程见 tests/worktree-trash-crossdrive.test.ts ④ 与 tests/worktree-containment.test.ts ⑥。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// 删除保护链的目录回收腿(goal-b49 W1-①):同盘 rename 腿与跨盘镜像腿复用同两件既有出口,不另造第二把尺(§0.6)
import { stashDirToTrash } from './file-batch-edit.js';
// 容器性断言(goal-b49 W5/W-2):与 ACL 分职,判"删除目标解析后是否越出自家隔离区根",同取这一件单源
import { judgeWorktreeContainment } from '../sandbox/file-access-policy.js';
import { emitWorktreeVoice, getDefaultWorktreeRoot, runGit } from './worktree-core.js';
import { mirrorDirIntoTrash, sameVolume } from './worktree-trash-mirror.js';

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
