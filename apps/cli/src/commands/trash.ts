// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui trash` 子命令 — 回收站列举与误删恢复入口(goal-b49 Z2:给 `restoreTrashEntry` 接真消费方)。
 *
 * 分工铁律(§0.6):形态/id/查找判据一律 import `@ihui/shared/delete-guard`,恢复写入裁决一律
 * import `../sandbox/file-access-policy`(与删除同一把尺的 write 轴),本端零复算、不新造判据。
 * 顺序即红线:id 合法 → 清单可读 → 有条目 → ACL 放行 → 目标未占位,**全部通过才动 `restoreTrashEntry`**;
 * 任一前置不成立 ⇒ 具名拒绝且恢复不启动(副作用未发生)。未判定不记绿也不记红(§0.3)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import {
  findTrashEntry,
  isSafeIdSegment,
  isTrashManifestShape,
  type TrashManifest,
} from '@ihui/shared/delete-guard';
import { tryParseJson } from '../util/json.js';
import { getDeleteTrashDir, restoreTrashEntry } from '../tools/file-batch-edit.js';
import { scanTrash } from '../tools/trash-prune-io.js';
import { announceGuardUnjudged, evaluateFileAccess, toAclPath } from '../sandbox/file-access-policy.js';

/** 恢复拒绝的具名分类(端内不冒充成功;命令层据此出声并决定退出码)。 */
export type TrashRestoreCode =
  | 'invalid-id'
  | 'manifest-unreadable'
  | 'no-such-entry'
  | 'acl-blocked'
  | 'target-exists'
  | 'restore-failed';

export interface TrashRestoreOutcome {
  readonly ok: boolean;
  readonly restoredTo?: string;
  readonly code?: TrashRestoreCode;
  readonly reason?: string;
}

export interface TrashListRow {
  readonly trashId: string;
  readonly originalPath: string;
  readonly relativeTrashPath: string;
  /** 删除时量到的字节;量不到为 null(列出时显示"未知",不得用 0 冒充"没东西") */
  readonly sizeBytes: number | null;
  readonly kind: 'file' | 'directory';
  readonly createdAtIso: string;
}

export interface TrashListResult {
  readonly rows: readonly TrashListRow[];
  /** 判不出的清单(读不到/形态坏/目录名不符)—— state=undetermined 的来源,逐条点名 */
  readonly unreadable: readonly { trashId: string | null; reason: string }[];
  readonly state: 'ok' | 'empty' | 'undetermined';
}

/** 读一枚 trashId 的清单:取不到/形态坏 ⇒ 未判定失败(不硬试,§0.3)。 */
function loadManifest(workspacePath: string, trashId: string): { manifest: TrashManifest } | { fail: TrashRestoreOutcome } {
  if (!isSafeIdSegment(trashId)) {
    return { fail: { ok: false, code: 'invalid-id', reason: `trashId 形态不合法(${String(trashId).slice(0, 40)})` } };
  }
  const manifestPath = path.join(getDeleteTrashDir(workspacePath), trashId, 'manifest.json');
  let manifest: TrashManifest;
  try {
    const parsed = tryParseJson(fs.readFileSync(manifestPath, 'utf-8'));
    if (!isTrashManifestShape(parsed)) {
      return { fail: { ok: false, code: 'manifest-unreadable', reason: '回收站清单形态不合法:不硬试' } };
    }
    manifest = parsed;
  } catch (err) {
    return {
      fail: {
        ok: false,
        code: 'manifest-unreadable',
        reason: `回收站清单读取不到(${err instanceof Error ? err.message : String(err)}):未判定不硬试`,
      },
    };
  }
  return { manifest };
}

/** 从清单挑出要恢复的条目:path 省略时恰 1 条才自动取,否则要求显式 path(拒绝猜测)。 */
function pickEntry(
  manifest: TrashManifest,
  workspacePath: string,
  pathArg?: string,
): { entry: TrashManifest['entries'][number] } | { fail: TrashRestoreOutcome } {
  if (pathArg === undefined || pathArg.length === 0) {
    if (manifest.entries.length === 1) {
      const only = manifest.entries[0];
      if (only) return { entry: only };
    }
    return {
      fail: {
        ok: false,
        code: 'no-such-entry',
        reason:
          manifest.entries.length === 0
            ? '该 trashId 的清单没有任何条目'
            : `该 trashId 有 ${manifest.entries.length} 条目,请指定原路径(trash restore <id> <path>)`,
      },
    };
  }
  const origAbs = path.resolve(workspacePath, pathArg);
  const entry = findTrashEntry(manifest, origAbs);
  if (!entry) {
    return {
      fail: {
        ok: false,
        code: 'no-such-entry',
        reason: `该 trashId 下无原路径 ${origAbs} 的条目(先跑 ihui trash list 核对绝对路径)`,
      },
    };
  }
  return { entry };
}

/** 恢复一个误删件:前置全过才交给 `restoreTrashEntry`(真消费方)。 */
export function restoreFromTrash(
  workspacePath: string,
  trashId: string,
  pathArg?: string,
  stat?: (path: string) => fs.Stats,
): TrashRestoreOutcome {
  const loaded = loadManifest(workspacePath, trashId);
  if ('fail' in loaded) return loaded.fail;
  const picked = pickEntry(loaded.manifest, workspacePath, pathArg);
  if ('fail' in picked) return picked.fail;
  const entry = picked.entry;

  // 与删除同一把 ACL 尺:恢复 = 往原路径写回内容 ⇒ write 轴(判据单源在 sandbox/file-access-policy)
  const rel = path.relative(workspacePath, entry.originalPath) || path.basename(entry.originalPath);
  const acl = evaluateFileAccess('write', toAclPath(workspacePath, rel), workspacePath);
  announceGuardUnjudged(workspacePath, acl.guard, 'trash_restore');
  if (acl.blocked) {
    return { ok: false, code: 'acl-blocked', reason: acl.note ?? '按文件访问裁决禁止恢复写入' };
  }

  // 具名拒绝:目标已存在 ⇒ 不覆盖现网现场(restore 不启动 ⇒ 副作用未发生)
  const look = stat ?? ((target: string) => fs.statSync(target));
  try {
    look(entry.originalPath);
    return {
      ok: false,
      code: 'target-exists',
      reason: `恢复拒绝:原路径已存在(${entry.originalPath}),不覆盖。确需覆盖请先手工移走现件`,
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      return {
        ok: false,
        code: 'restore-failed',
        reason: `恢复拒绝:原路径读不到,不能把它说成不存在再恢复覆盖 (${code ?? 'unknown'})`,
      };
    }
  }

  try {
    const restoredTo = restoreTrashEntry(workspacePath, trashId, entry.originalPath);
    return { ok: true, restoredTo };
  } catch (err) {
    return { ok: false, code: 'restore-failed', reason: err instanceof Error ? err.message : String(err) };
  }
}

/** 列举回收站:清单摊平成条目行;坏清单逐条点名并置 state=undetermined(不折成"空")。 */
export function listTrash(workspacePath: string): TrashListResult {
  const scanned = scanTrash(getDeleteTrashDir(workspacePath));
  const rows: TrashListRow[] = [];
  for (const scannedManifest of scanned.manifests) {
    for (const entry of scannedManifest.manifest.entries) {
      rows.push({
        trashId: scannedManifest.trashId,
        originalPath: entry.originalPath,
        relativeTrashPath: entry.relativeTrashPath,
        sizeBytes: entry.sizeBytes,
        kind: entry.kind,
        createdAtIso: scannedManifest.manifest.createdAtIso,
      });
    }
  }
  const unreadable = scanned.bad.map((b) => ({ trashId: b.trashId, reason: b.reason }));
  const state: TrashListResult['state'] =
    unreadable.length > 0 ? 'undetermined' : rows.length === 0 ? 'empty' : 'ok';
  return { rows, unreadable, state };
}

function bytesLabel(size: number | null): string {
  if (size === null) return '未知';
  if (size < 1024) return `${size}B`;
  return `${(size / 1024).toFixed(1)}KB`;
}

function resolveWorkspace(program: Command): string {
  const rootOpts = program.opts();
  return (rootOpts.workspace as string | undefined) ?? process.cwd();
}

export function registerTrashCommand(program: Command): void {
  const trashCmd = program.command('trash').description('回收站 — 误删件的列举与恢复');

  trashCmd
    .command('list')
    .description('列出回收站中的误删件(原路径 / 字节 / 入站时刻)')
    .action(() => {
      const ws = resolveWorkspace(program);
      const result = listTrash(ws);
      for (const bad of result.unreadable) {
        console.warn(chalk.yellow(`⚠ 判不出(${bad.trashId ?? '未知目录'}):${bad.reason}`));
      }
      // F-016:清单判不出属"未判定",不得让脚本读成成功(未判定 ≠ 没有 ≠ 成功)
      if (result.state === 'undetermined') process.exitCode = 1;
      if (result.rows.length === 0) {
        if (result.state === 'undetermined') {
          console.warn(chalk.yellow('回收站有清单判不出:上面逐条点名,未判定 ≠ 没有(§0.3)'));
        } else {
          console.info(chalk.dim('回收站为空'));
        }
        return;
      }
      console.info(chalk.cyan(`\n回收站(${result.rows.length} 条${result.state === 'undetermined' ? ',部分判不出' : ''}):`));
      for (const row of result.rows) {
        const time = new Date(row.createdAtIso).toLocaleString();
        console.info(`  ${chalk.bold(row.trashId)}  ${row.kind}  ${bytesLabel(row.sizeBytes)}  ${chalk.dim(time)}`);
        console.info(`    ${row.originalPath}`);
      }
      console.info('');
    });

  trashCmd
    .command('restore <trashId> [path]')
    .description('按 trashId 恢复误删件(path 省略且仅 1 条时自动取;目标已存在则具名拒绝)')
    .action((trashId: string, pathArg: string | undefined) => {
      const ws = resolveWorkspace(program);
      const result = restoreFromTrash(ws, trashId, pathArg);
      if (result.ok) {
        console.info(chalk.green(`✓ 已恢复:${result.restoredTo}`));
        return;
      }
      console.error(chalk.red(`✗ 恢复被拒(${result.code}):${result.reason}`));
      process.exit(1);
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
