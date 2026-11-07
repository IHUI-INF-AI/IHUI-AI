// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Worktree 回收站搬运腿(goal-b49 Z16 自 tools/worktree.ts 逐字节拆出,零行为变更):
 * 同卷核验 sameVolume、目录自证 walkTree、跨盘镜像 mirrorDirIntoTrash(Z7/B1 未竟 5,
 * 判据与调用次序一字未改)。两个消费点(WorktreeManager.remove 与 cleanupWorktree)的
 * 兜底删除腿被装车对账锁逐字钉在 tools/worktree.ts 源码文本上,原样留驻入口档,刻意不搬。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
// 删除保护链的目录回收腿(goal-b49 W1-①):判据在 @ihui/shared/delete-guard,IO adapter 在工具层
// 跨盘(EXDEV)镜像腿(Z7/B1 未竟 5)复用同两件既有出口:清单形态尺 + 删除通道,不另造第二把尺(§0.6)
import { getDeleteTrashDir } from './file-batch-edit.js';
import { deleteTrashEntry } from './trash-prune-io.js';
import { isTrashManifestShape, TRASH_MANIFEST_KIND, type TrashManifest, type TrashManifestEntry } from '@ihui/shared/delete-guard';

/**
 * 跨盘搬运的镜像腿结论(Z7/B1 未竟 5)。`ok:false` ⇒ 源一字节没动,调用方**必须**出声后再决定下一步。
 */
export type WorktreeMirrorOutcome = { ok: true; trashPath: string } | { ok: false; reason: string };

/** 目录型清单行(与 `stashDirToTrash` 同口径;`sizeBytes` 只在镜像腿**校验过后**才落实测和) */
function dirEntryOf(originalPath: string, relativeTrashPath: string, sizeBytes: number | null = null): TrashManifestEntry {
  return { originalPath, relativeTrashPath, sizeBytes, kind: 'directory' };
}

/**
 * 同卷核验(机器事实,现读不假设):`dev` 不同 ⇒ rename 必抛 EXDEV,不该假装试一把;读不到 ⇒ 一并走镜像腿。
 * B1 未竟 5 的解锁条件就是这一格 —— `.worktrees` 与仓**不保证**同盘(本仓工作区与活 gitdir 即两卷)。
 */
export function sameVolume(a: string, b: string): boolean {
  try {
    return fs.statSync(a).dev === fs.statSync(b).dev;
  } catch {
    return false;
  }
}

/** 走一遍目录:文件数 + 字节和(镜像腿的自证,只回答"复制完整吗";符号链接两侧同跳,不跟随) */
function walkTree(root: string): { files: number; bytes: number } | null {
  let files = 0;
  let bytes = 0;
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const item of items) {
      const child = path.join(current, item.name);
      if (item.isDirectory()) stack.push(child);
      else if (item.isFile()) {
        try {
          bytes += fs.statSync(child).size;
          files += 1;
        } catch {
          return null;
        }
      }
    }
  }
  return { files, bytes };
}

/**
 * 整目录**镜像**进回收站 —— 跨盘(EXDEV)那一档可逆搬运(Z7/B1 未竟 5)。顺序钉死:
 * 复制 → 两侧走目录自证(文件数 ∧ 字节和必须相等)→ 写同形态清单(`TRASH_MANIFEST_KIND` +
 * `isTrashManifestShape` 自证);**全程不碰源**。任一步不成 ⇒ 自家半件走既有删除通道
 * `deleteTrashEntry`(ACL delete 轴)清掉并如实报 ⇒ 结构上不可能出现「源删了、回收站又没进」。
 * 源删除由调用方沿**原来那一条** rmSync 腿执行(兜底腿一字未摘,Windows 句柄占用的既有解法)。
 *
 * @param seams 只给用例注入"复制成功但记账失败"这一档(断言源仍在);生产调用方不传。
 */
export function mirrorDirIntoTrash(
  workspacePath: string,
  absDir: string,
  label: string,
  seams: { writeIndex?: (file: string, text: string) => void } = {},
): WorktreeMirrorOutcome {
  const trashId = randomUUID();
  // 与 stashDirToTrash 同形的目录名清洗(交主席:该 sanitize 应导出成唯一出口,别让搬运两腿各抄一份)
  const safeLabel = (label.replace(/[^A-Za-z0-9._-]/g, '_') || 'dir').slice(0, 60);
  const dir = path.join(getDeleteTrashDir(workspacePath), trashId);
  const dest = path.join(dir, safeLabel);
  const bail = (reason: string): WorktreeMirrorOutcome => {
    // 半件必须连**它那枚 trashId 目录**一起清掉:只清子件会在回收站留下"有壳无清单"的残迹,
    // 而那种残迹正是清理器扫到就整轮判不出的东西(Z7 未竟 1 同源:别让搬运失败反过来冻结回收站)。
    if (!fs.existsSync(dir)) return { ok: false, reason };
    const cleanup = deleteTrashEntry(workspacePath, getDeleteTrashDir(workspacePath), trashId);
    return { ok: false, reason: cleanup.ok ? reason : `${reason}(半件也没清掉:${cleanup.reason})` };
  };
  try {
    fs.cpSync(absDir, dest, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
  } catch (err) {
    return bail(`复制失败:${err instanceof Error ? err.message : String(err)}`);
  }
  const src = walkTree(absDir);
  const copy = walkTree(dest);
  if (src === null || copy === null) return bail('复制后自证走不动(目录读不到):不记账、不删源');
  if (src.files !== copy.files || src.bytes !== copy.bytes) {
    return bail(`镜像不完整(源 ${src.files} 文件/${src.bytes}B ≠ 副本 ${copy.files} 文件/${copy.bytes}B):不记账、不删源`);
  }
  const entry = dirEntryOf(absDir, safeLabel, src.bytes);
  const manifest: TrashManifest = {
    kind: TRASH_MANIFEST_KIND,
    trashId,
    createdAtIso: new Date().toISOString(),
    workspacePath,
    entries: [entry],
  };
  if (!isTrashManifestShape(manifest)) return bail('清单形态自证不过:不写坏清单、不删源');
  try {
    const write = seams.writeIndex ?? ((file: string, text: string) => fs.writeFileSync(file, text, 'utf-8'));
    write(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (err) {
    return bail(`记账失败 ⇒ 源不删(${err instanceof Error ? err.message : String(err)})`);
  }
  return { ok: true, trashPath: dest };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
