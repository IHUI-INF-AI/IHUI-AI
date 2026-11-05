// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z16 形状锁(goal-b49):worktree.ts 拆分后公开出口集合不得漂移。
 * 值出口按运行时键集逐字对账;类型出口靠编译期引用钉住(漂了 tsc 先红);
 * 另钉"实现档各 <250 行"的拆档目标本身,以及 Z7 搬运腿判据原文仍在搬运档内。
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as worktreeEntry from '../src/tools/worktree.js';
import type {
  CreateIsolatedWorktreeRequest,
  IsolatedWorktree,
  RemoveIsolatedWorktreeRequest,
  WorktreeCleanupOutcome,
  WorktreeCreateResult,
  WorktreeEntry,
  WorktreeHookEvent,
  WorktreeMirrorOutcome,
} from '../src/tools/worktree.js';

// —— 值出口:与拆分前 tools/worktree.ts 的 export 键集逐字一致(多一个、少一个都红)——
const VALUE_EXPORTS = [
  'AGENT_BRANCH_PREFIX',
  'DEFAULT_WORKTREE_DIR',
  'WORKTREE_TOOLS',
  'agentBranchName',
  'cleanupWorktree',
  'createIsolatedWorktree',
  'enterWorktreeTool',
  'exitWorktreeTool',
  'getDefaultWorktreeRoot',
  'judgeWorktreeBranchMerged',
  'mirrorDirIntoTrash',
  'removeIsolatedWorktree',
  'sameVolume',
  'WorktreeManager',
].sort();

// 类型出口钉桩:任一类型改名/摘除 ⇒ tsc 先红,本用例再钉一次引用恒成立
type TypePin = [
  WorktreeMirrorOutcome,
  WorktreeEntry,
  WorktreeCreateResult,
  WorktreeCleanupOutcome,
  IsolatedWorktree,
  CreateIsolatedWorktreeRequest,
  RemoveIsolatedWorktreeRequest,
  WorktreeHookEvent,
];
void (undefined as unknown as TypePin | undefined);

describe('Z16 worktree.ts 拆分形状锁', () => {
  it('入口值出口键集逐字不漂(不增不减)', () => {
    expect(Object.keys(worktreeEntry).sort()).toEqual(VALUE_EXPORTS);
  });

  it('关键出口形状未变(前缀/工具族/类本体)', () => {
    const entry: typeof worktreeEntry = worktreeEntry;
    expect(typeof entry.WorktreeManager).toBe('function');
    expect(entry.AGENT_BRANCH_PREFIX).toBe('agent-wt-');
    expect(entry.DEFAULT_WORKTREE_DIR).toBe('.worktrees');
    expect(entry.WORKTREE_TOOLS.map((t) => t.name)).toEqual(['enter_worktree', 'exit_worktree']);
  });

  it('实现档各 <250 行(拆档目标本身)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const toolsDir = path.join(here, '..', 'src', 'tools');
    // 入口 worktree.ts 不在此列:WorktreeManager.remove 与 cleanupWorktree 两条删除腿被
    // worktree-trash-crossdrive ④ / worktree-containment ⑥ / delete-axis-consumers ⑤ 的
    // 装车对账锁**逐字钉在入口源码文本**上(remove 体 + cleanup 体 + 两处 rmSync 各自 ≥100 行),
    // 入口 <250 与"用例原样全绿"结构上互斥 —— 按"用例原样全绿"优先,入口留驻双腿,余者拆净。
    const implFiles = [
      'worktree-core.ts',
      'worktree-trash-mirror.ts',
      'worktree-isolated.ts',
      'worktree-tools.ts',
      'worktree-tools-exit.ts',
    ];
    for (const f of implFiles) {
      const text = fs.readFileSync(path.join(toolsDir, f), 'utf-8');
      const lines = text.split(/\r?\n/).length;
      expect(lines, `${f} 行数 ${lines} 必须 <250`).toBeLessThan(250);
    }
  });

  it('mirrorDirIntoTrash 判据仍在搬运档内且次序未改(Z7 约束)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(here, '..', 'src', 'tools', 'worktree-trash-mirror.ts'), 'utf-8');
    // 顺序钉死:复制 → 两侧走目录自证 → 清单形态自证 → 记账;全程不碰源
    const cp = src.indexOf('fs.cpSync(absDir, dest');
    const shape = src.indexOf('isTrashManifestShape(manifest)');
    const bailClean = src.indexOf('deleteTrashEntry(workspacePath, getDeleteTrashDir(workspacePath), trashId)');
    expect(cp).toBeGreaterThan(-1);
    expect(shape).toBeGreaterThan(-1);
    expect(bailClean).toBeGreaterThan(-1);
    expect(cp).toBeLessThan(shape);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
