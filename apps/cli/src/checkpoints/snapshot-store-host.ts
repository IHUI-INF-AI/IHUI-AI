// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照存储宿主层 — `checkpoints/` 里唯一碰文件系统的适配层(goal-b49 W3 自 ./index.ts 抽出,
 * 落 AGENTS §3「每页 < 250 行」;index.ts 只留编排:版本序列命名 + 三约束回收派发)。
 * 存储:`~/.ihui/checkpoints/<sessionId>/<checkpointId>/` = manifest.json + 按工作区相对路径 1:1 镜像的文件;
 * 原工作区不存在的文件记 'snap'/'added',restore 时据此删除。<checkpointId> = `<seriesUuid>@vN`(见 ./snapshot-series.ts),
 * 同目录下的 `hunk_*`(HunkCheckpointManager)与历史 `cp_*` 不属本序列,由各自口径处理。
 * 清单完整性/损坏隔离一律走 ./manifest-integrity.ts 那一份出口(AGENTS §0.6 单一真相源),本层不复算。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeFileAtomicSync } from '../util/atomic-write.js';
import { isRecord } from '../util/json.js';
import {
  assertPathInside,
  resolveWorkspaceRelPath as resolveGuardRelPath,
  segmentPathInside,
} from '../util/path-guard.js';
import {
  readManifestChecked,
  type CorruptManifestEntry,
  type ManifestReadResult,
} from './manifest-integrity.js';

export interface CheckpointMeta {
  id: string;
  sessionId: string;
  createdAt: string;
  reason: string;
  files: Record<string, 'snap' | 'added'>;
  /** 请求里不是普通文件的路径。不写入 files，回滚不会动它们。 */
  skipped?: string[];
}

export interface CheckpointDiffEntry {
  path: string;
  status: 'unchanged' | 'modified' | 'added' | 'removed' | 'unmeasured';
}

/** manifest 的**键**必须是工作区相对路径:拒绝空/绝对路径/盘符/UNC/任何 `..` 段。 */
function isSafeWorkspaceRelPath(rel: string): boolean {
  if (typeof rel !== 'string' || rel.length === 0) return false;
  const p = rel.replace(/\\/g, '/');
  if (p.startsWith('/')) return false;
  if (/^[a-zA-Z]:\//.test(p)) return false;
  if (p.split('/').includes('..')) return false;
  return true;
}

/** G-671:manifest 形状校验 —— 缺关键字段/档值非法/schemaVersion 不识别 ⇒ 不算合法 meta。 */
function isCheckpointMeta(v: unknown): v is CheckpointMeta {
  if (!isRecord(v)) return false;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.sessionId !== 'string') return false;
  if (typeof v.createdAt !== 'string' || Number.isNaN(Date.parse(v.createdAt))) return false;
  if (typeof v.reason !== 'string') return false;
  if (!isRecord(v.files)) return false;
  if (v.schemaVersion !== undefined && v.schemaVersion !== 1) return false;
  if (v.skipped !== undefined && (!Array.isArray(v.skipped) || !v.skipped.every((name) => typeof name === 'string'))) {
    return false;
  }
  return Object.entries(v.files).every(
    ([rel, k]) => (k === 'snap' || k === 'added') && isSafeWorkspaceRelPath(rel),
  );
}

/** 会话快照根:`~/.ihui/checkpoints/<sessionId>`(存在与否由调用方的读动作判,不在此处猜) */
export function snapshotRootDir(sessionId: string): string {
  // sessionId 来自 `--session`,与检查点 id 同解:收敛成单段并断言在 checkpoints 根内。
  return segmentPathInside(
    path.resolve(os.homedir(), '.ihui', 'checkpoints'),
    sessionId,
    '会话检查点目录',
  );
}

export type SnapshotRootProbe = 'missing' | 'present' | 'unreadable';

/** 快照根三态:不存在、是目录、读不到。读不到不得并进「不存在」。 */
export function probeSnapshotRoot(baseDir: string, io: { statSync?: typeof fs.statSync } = {}): SnapshotRootProbe {
  const statSync = io.statSync ?? fs.statSync;
  try {
    return statSync(baseDir).isDirectory() ? 'present' : 'unreadable';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing';
    return 'unreadable';
  }
}

/** 快照根是否存在(只认目录;读不到不是存在,调用方必须另看 probe) */
export function snapshotRootExists(baseDir: string): boolean {
  return probeSnapshotRoot(baseDir) === 'present';
}

export function ensureHostDir(dir: string, io: { statSync?: typeof fs.statSync } = {}): void {
  const statSync = io.statSync ?? fs.statSync;
  try {
    if (!statSync(dir).isDirectory()) {
      throw new Error(`检查点目录读不到,不能在这里新建: ${dir}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('检查点目录读不到')) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      fs.mkdirSync(dir, { recursive: true });
      return;
    }
    throw new Error(`检查点目录读不到,不能在这里新建 (${code ?? 'unknown'})`);
  }
}

const SNAPSHOT_ROOT_UNREADABLE = '检查点目录读不到,不能把它说成没有检查点';

/** 基目录下的**全部**条目名(含文件);基目录不存在 ⇒ 空表;读不到 ⇒ 抛错 */
export function listEntryNames(baseDir: string, io: { statSync?: typeof fs.statSync } = {}): string[] {
  const root = probeSnapshotRoot(baseDir, io);
  if (root === 'missing') return [];
  if (root === 'unreadable') throw new Error(SNAPSHOT_ROOT_UNREADABLE);
  return fs.readdirSync(baseDir);
}

/** 基目录下的子目录名(非目录条目剔除);基目录不存在 ⇒ 空表;读不到 ⇒ 抛错 */
export function listSubDirNames(baseDir: string, io: { statSync?: typeof fs.statSync } = {}): string[] {
  const root = probeSnapshotRoot(baseDir, io);
  if (root === 'missing') return [];
  if (root === 'unreadable') throw new Error(SNAPSHOT_ROOT_UNREADABLE);
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

// goal-b49 W3:录制侧相对路径收敛(不做 realpath)抽到 ./snapshot-replay.ts;这里只接线。
import { toWorkspaceRelPath } from './snapshot-replay.js';
export { toWorkspaceRelPath };

/**
 * 逐文件镜像进快照目录:普通文件 ⇒ 拷贝并记 'snap';确认不存在 ⇒ 记 'added';
 * 读不到 ⇒ 抛错,不记成待删除的新文件。非普通文件记入 skipped,不写入 files。落点越界即抛。
 */
export function copyFilesIntoSnapshot(
  workspacePath: string,
  cpDir: string,
  files: string[],
  io: { statSync?: typeof fs.statSync } = {},
): { files: CheckpointMeta['files']; skipped: string[] } {
  const statSync = io.statSync ?? fs.statSync;
  const recorded: CheckpointMeta['files'] = {};
  const skipped: string[] = [];
  for (const f of files) {
    const rel = toWorkspaceRelPath(workspacePath, f);
    const absInWorkspace = path.join(workspacePath, rel);
    let stat: fs.Stats;
    try {
      stat = statSync(absInWorkspace);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        recorded[rel] = 'added';
        continue;
      }
      throw new Error(`检查点读不到 ${rel},不把它记成待删除的新文件`);
    }
    if (!stat.isFile()) {
      skipped.push(rel);
      continue;
    }
    const dest = path.join(cpDir, rel);
    ensureHostDir(path.dirname(dest));
    fs.copyFileSync(absInWorkspace, dest);
    recorded[rel] = 'snap';
  }
  return { files: recorded, skipped };
}

// F-029:清单走原子写(同目录 tmp + rename)—— 裸 writeFileSync 被杀/磁盘满会留半截 JSON,该目录当场变「损坏」。
export function writeSnapshotManifest(cpDir: string, meta: CheckpointMeta): void {
  writeFileAtomicSync(path.join(cpDir, 'manifest.json'), JSON.stringify(meta, null, 2));
}

/**
 * 形状校验把越界 files 键判成 shape-invalid 后,调用方用这条把"具体哪个键越界"还原成
 * path-guard 的精确文案。返回 null 表示形状问题与路径无关(交由调用方报 shape-invalid)。
 */
export function unsafeWorkspaceKeyError(workspacePath: string, parsed: unknown): Error | null {
  if (!isRecord(parsed) || !isRecord(parsed.files)) return null;
  for (const key of Object.keys(parsed.files)) {
    try {
      resolveGuardRelPath(workspacePath, key, '检查点清单路径');
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }
  return null;
}

/** 读某快照目录的清单:missing/corrupt 三态由 manifest-integrity 给,本层只接线(onQuarantined 先于 onCorrupt);F-029:missing 档顺带带出目录 mtime(GC 判据层零 fs,孤儿目录的年龄证据只能由本层量) */export function readSnapshotMeta(
  baseDir: string,
  checkpointId: string,
  hooks: { onCorrupt: (entry: CorruptManifestEntry) => void; onQuarantined?: (entry: CorruptManifestEntry) => void },
): ManifestReadResult<CheckpointMeta> & { dirMtimeMs?: number } {
  // 清单路径是删除/回滚的锚点:根内 + realpath 断言;检查点 id 是内部序列名(含 `@vN`)不做 sanitize 改写,否则落盘名与 id 不一致。
  const cpDir = assertPathInside(baseDir, path.join(baseDir, checkpointId), '检查点目录');
  const result = readManifestChecked(path.join(cpDir, 'manifest.json'), checkpointId, isCheckpointMeta, (entry) => {
    hooks.onQuarantined?.(entry);
    hooks.onCorrupt(entry);
  });
  // 清单缺失 = 可能是「拷贝完、写 manifest 前被杀」的孤儿目录;mtime 读不到就不带(判不出年龄 ⇒ 不删)。
  return result.status === 'missing' ? { ...result, dirMtimeMs: fs.statSync(cpDir, { throwIfNoEntry: false })?.mtimeMs } : result;
}

// goal-b49 W3:回放/比对(restore/diff + 回放侧 realpath 断言)整体抽到 ./snapshot-replay.ts;
// 这里整份再导出,保持本层对外面与拆分前一致。
export { resolveWorkspaceRelPath, restoreSnapshotFiles, diffSnapshotFiles } from './snapshot-replay.js';

export function removeSnapshotDir(cpDir: string, io: { statSync?: typeof fs.statSync } = {}): boolean {
  const root = probeSnapshotRoot(cpDir, io);
  if (root === 'missing') return false;
  if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成未找到');
  fs.rmSync(cpDir, { recursive: true, force: true });
  return true;
}

// goal-b49 W3:体积量测抽到 ./snapshot-measure.ts;这里再导出,保持对外面不变。
export { measureSnapshotBytes } from './snapshot-measure.js';

// goal-b49 W3:变更/明细/文件树三条投影判据已抽到 ./change-projection.ts(纯判据、不碰 fs);
// 这里整份再导出,保持本层的对外面与拆分前一致(消费方只认这一处)。
export {
  projectChangeIndex,
  readChangeDetail,
  readRequestFileTree,
  type ChangeIndexRow,
  type ChangeIndexPlan,
  type ChangeDetailPlan,
  type RequestFileTreePlan,
} from './change-projection.js';

// goal-b49 W3:内容哈希比对(fileContentEqual)随回放/比对整体抽到 ./snapshot-replay.ts;这里再导出。
export { fileContentEqual } from './snapshot-replay.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
