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
import * as crypto from 'node:crypto';
import { isRecord } from '../util/json.js';
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

/** 量快照体积的枚举预算:超预算即"量不出来"⇒ 该候选不删(AGENTS §0.3) */
const GC_SIZE_SCAN_BUDGET = 2000;

/** 会话快照根:`~/.ihui/checkpoints/<sessionId>`(存在与否由调用方的读动作判,不在此处猜) */
export function snapshotRootDir(sessionId: string): string {
  return path.join(os.homedir(), '.ihui', 'checkpoints', sessionId);
}

export type SnapshotRootProbe = 'missing' | 'present' | 'unreadable';

/** 快照根三态:不存在、是目录、读不到。读不到不得并进「不存在」。 */
export function probeSnapshotRoot(
  baseDir: string,
  io: { statSync?: typeof fs.statSync } = {},
): SnapshotRootProbe {
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

/** 把入参收成工作区相对路径;落在工作区外 ⇒ 抛错(文案与拆分前逐字相同) */
export function resolveWorkspaceRelPath(workspacePath: string, filePath: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
  const rel = path.relative(workspacePath, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`文件 ${filePath} 不在工作区 ${workspacePath} 内`);
  }
  return rel;
}

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
    const rel = resolveWorkspaceRelPath(workspacePath, f);
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

export function writeSnapshotManifest(cpDir: string, meta: CheckpointMeta): void {
  fs.writeFileSync(path.join(cpDir, 'manifest.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

/** 读某快照目录的清单:missing/corrupt 三态由 manifest-integrity 给,本层只接线(onQuarantined 先于 onCorrupt) */
export function readSnapshotMeta(
  baseDir: string,
  checkpointId: string,
  hooks: { onCorrupt: (entry: CorruptManifestEntry) => void; onQuarantined?: (entry: CorruptManifestEntry) => void },
): ManifestReadResult<CheckpointMeta> {
  const manifestPath = path.join(baseDir, checkpointId, 'manifest.json');
  return readManifestChecked(manifestPath, checkpointId, isCheckpointMeta, (entry) => {
    hooks.onQuarantined?.(entry);
    hooks.onCorrupt(entry);
  });
}

function workspacePresence(abs: string, statSync: typeof fs.statSync): 'present' | 'missing' | 'unreadable' {
  try {
    statSync(abs);
    return 'present';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing';
    return 'unreadable';
  }
}

/** 回滚:manifest 记 'added' 的删掉、记 'snap' 的覆盖回工作区;副本不在或读不到时记入 notRestored */
export function restoreSnapshotFiles(
  workspacePath: string,
  cpDir: string,
  files: CheckpointMeta['files'],
  io: { statSync?: typeof fs.statSync } = {},
): { restored: string[]; removed: string[]; notRestored: string[] } {
  const statSync = io.statSync ?? fs.statSync;
  const restored: string[] = [];
  const removed: string[] = [];
  const notRestored: string[] = [];
  for (const [rel, kind] of Object.entries(files)) {
    // 回放侧必须复用录制侧 resolveWorkspaceRelPath 的越界校验:manifest 键被
    // 篡改成 ../../.ssh/authorized_keys 时,直接 path.join 会删/写到工作区外。
    const safeRel = resolveWorkspaceRelPath(workspacePath, rel);
    const absInWorkspace = path.join(workspacePath, safeRel);
    if (kind === 'added') {
      const presence = workspacePresence(absInWorkspace, statSync);
      if (presence === 'unreadable') {
        notRestored.push(rel);
        continue;
      }
      if (presence === 'present') {
        fs.rmSync(absInWorkspace, { recursive: true, force: true });
        removed.push(rel);
      }
    } else {
      const src = path.join(cpDir, rel);
      if (workspacePresence(src, statSync) !== 'present') {
        notRestored.push(rel);
        continue;
      }
      ensureHostDir(path.dirname(absInWorkspace));
      fs.copyFileSync(src, absInWorkspace);
      restored.push(rel);
    }
  }
  return { restored, removed, notRestored };
}

/** 工作区 vs 快照的逐文件比对,只回非 unchanged 项 */
export function diffSnapshotFiles(
  workspacePath: string,
  cpDir: string,
  files: CheckpointMeta['files'],
  io: { statSync?: typeof fs.statSync } = {},
): CheckpointDiffEntry[] {
  const statSync = io.statSync ?? fs.statSync;
  const entries: CheckpointDiffEntry[] = [];
  for (const [rel, kind] of Object.entries(files)) {
    // 回放/比对两侧都复用录制侧 resolveWorkspaceRelPath 的越界校验。
    const safeRel = resolveWorkspaceRelPath(workspacePath, rel);
    const absInWorkspace = path.join(workspacePath, safeRel);
    const presence = workspacePresence(absInWorkspace, statSync);
    if (presence === 'unreadable') {
      entries.push({ path: rel, status: 'unmeasured' });
      continue;
    }
    const existsNow = presence === 'present';
    if (kind === 'added') {
      entries.push({ path: rel, status: existsNow ? 'added' : 'unchanged' });
    } else {
      if (!existsNow) {
        entries.push({ path: rel, status: 'removed' });
        continue;
      }
      const same = fileContentEqual(absInWorkspace, path.join(cpDir, rel));
      if (same === null) {
        entries.push({ path: rel, status: 'unmeasured' });
        continue;
      }
      entries.push({ path: rel, status: same ? 'unchanged' : 'modified' });
    }
  }
  return entries.filter((e) => e.status !== 'unchanged');
}

export function removeSnapshotDir(cpDir: string, io: { statSync?: typeof fs.statSync } = {}): boolean {
  const root = probeSnapshotRoot(cpDir, io);
  if (root === 'missing') return false;
  if (root === 'unreadable') throw new Error('检查点目录读不到,不能把它说成未找到');
  fs.rmSync(cpDir, { recursive: true, force: true });
  return true;
}

/** 量一个快照目录的体积(回收判据的输入);路径参数给的是快照根 + 目录名 */
export function measureSnapshotBytes(baseDir: string, dirName: string): number | null {
  return measureDirBytes(path.join(baseDir, dirName));
}

/** 量一个快照目录的体积;读不动或超枚举预算 ⇒ null(量不出来就不删,不猜) */
function measureDirBytes(dir: string): number | null {
  let bytes = 0;
  let visited = 0;
  const stack: string[] = [dir];
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
      visited += 1;
      if (visited > GC_SIZE_SCAN_BUDGET) return null;
      const child = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(child);
        continue;
      }
      try {
        const stat = fs.statSync(child);
        if (stat.isFile()) bytes += stat.size;
      } catch {
        return null;
      }
    }
  }
  return bytes;
}

export type ChangeIndexRow = {
  id: string;
  requestId: string;
  summary: string;
  fileCount: number;
  additions: number;
  deletions: number;
  detailRef: string;
};

export type ChangeIndexPlan = {
  disposition: 'projected' | 'unjudged';
  reason: 'projected' | 'changes-unmeasured' | 'row-unreadable' | 'count-mismatch' | 'ref-mismatch';
  rows: ChangeIndexRow[] | null;
};

export type ChangeDetailPlan = {
  disposition: 'read' | 'unjudged' | 'refused';
  reason: 'read' | 'ref-invalid' | 'request-mismatch' | 'detail-unmeasured' | 'path-invalid' | 'count-mismatch';
  files: string[] | null;
};

const CHANGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const CHANGE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/;

function changeCountOk(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 变更列表只留摘要、计数和明细指针，不带文件名。
 * 声明的 fileCount 和量到的文件名条数不一致，整份列表不投影。
 */
export function projectChangeIndex(changes: unknown): ChangeIndexPlan {
  const blank = (reason: ChangeIndexPlan['reason']): ChangeIndexPlan => ({
    disposition: 'unjudged',
    reason,
    rows: null,
  });
  if (!Array.isArray(changes)) return blank('changes-unmeasured');
  const rows: ChangeIndexRow[] = [];
  for (const value of changes) {
    if (value === null || typeof value !== 'object') return blank('row-unreadable');
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !CHANGE_ID.test(row.id)) return blank('row-unreadable');
    if (typeof row.requestId !== 'string' || !CHANGE_ID.test(row.requestId)) return blank('row-unreadable');
    if (typeof row.summary !== 'string') return blank('row-unreadable');
    if (!Array.isArray(row.fileNames) || !row.fileNames.every((name) => typeof name === 'string' && CHANGE_PATH.test(name))) {
      return blank('row-unreadable');
    }
    if (!changeCountOk(row.additions) || !changeCountOk(row.deletions)) return blank('row-unreadable');
    if (!changeCountOk(row.fileCount) || row.fileCount !== row.fileNames.length) return blank('count-mismatch');
    const detailRef = `${row.id}.${row.requestId}`;
    if (row.detailRef !== undefined && row.detailRef !== detailRef) return blank('ref-mismatch');
    rows.push({
      id: row.id,
      requestId: row.requestId,
      summary: row.summary,
      fileCount: row.fileCount,
      additions: row.additions,
      deletions: row.deletions,
      detailRef,
    });
  }
  return { disposition: 'projected', reason: 'projected', rows };
}

/**
 * 明细只认指针指向的那一份。明细没量到时，不用列表里的文件名顶上。
 */
export function readChangeDetail(input: {
  detailRef: unknown;
  requestId: unknown;
  detail: unknown;
}): ChangeDetailPlan {
  const blank = (reason: ChangeDetailPlan['reason'], disposition: ChangeDetailPlan['disposition'] = 'unjudged'): ChangeDetailPlan => ({
    disposition,
    reason,
    files: null,
  });
  if (typeof input.detailRef !== 'string') return blank('ref-invalid', 'refused');
  const dot = input.detailRef.indexOf('.');
  const changeId = dot > 0 ? input.detailRef.slice(0, dot) : '';
  const refRequest = dot > 0 ? input.detailRef.slice(dot + 1) : '';
  if (!CHANGE_ID.test(changeId) || !CHANGE_ID.test(refRequest) || input.detailRef !== `${changeId}.${refRequest}`) {
    return blank('ref-invalid', 'refused');
  }
  if (input.requestId !== refRequest) return blank('request-mismatch', 'refused');
  if (input.detail === null || input.detail === undefined) return blank('detail-unmeasured');
  if (typeof input.detail !== 'object') return blank('detail-unmeasured');
  const detail = input.detail as Record<string, unknown>;
  if (!Array.isArray(detail.files) || !detail.files.every((name) => typeof name === 'string' && CHANGE_PATH.test(name))) {
    return blank('path-invalid', 'refused');
  }
  if (detail.fileCount !== undefined && (!changeCountOk(detail.fileCount) || detail.fileCount !== detail.files.length)) {
    return blank('count-mismatch', 'unjudged');
  }
  return { disposition: 'read', reason: 'read', files: detail.files };
}

export type RequestFileTreePlan = {
  disposition: 'read' | 'unjudged' | 'refused';
  reason: 'read' | 'request-invalid' | 'memo-unmeasured' | 'request-absent' | 'entry-unreadable' | 'clock-unmeasured';
  files: Array<{ path: string; name: string; size: number }> | null;
};

const REQUEST_FILE_TREE_ID = /^[a-f0-9]{32}$/;

/**
 * 文件树按请求号取。别的请求的树不能顶上，体积没量到也不写成 0。
 */
export function readRequestFileTree(input: { requestId: unknown; memo: unknown }): RequestFileTreePlan {
  const blank = (
    reason: RequestFileTreePlan['reason'],
    disposition: RequestFileTreePlan['disposition'] = 'unjudged',
  ): RequestFileTreePlan => ({ disposition, reason, files: null });
  if (typeof input.requestId !== 'string' || !REQUEST_FILE_TREE_ID.test(input.requestId)) {
    return blank('request-invalid', 'refused');
  }
  if (input.memo === null || input.memo === undefined || typeof input.memo !== 'object' || Array.isArray(input.memo)) {
    return blank('memo-unmeasured');
  }
  const memo = input.memo as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(memo, input.requestId)) return blank('request-absent', 'refused');
  const entry = memo[input.requestId];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return blank('entry-unreadable');
  const row = entry as Record<string, unknown>;
  if (typeof row.createdAt !== 'string' || Number.isNaN(Date.parse(row.createdAt))) return blank('clock-unmeasured');
  if (!Array.isArray(row.files)) return blank('entry-unreadable');
  const files: Array<{ path: string; name: string; size: number }> = [];
  for (const item of row.files) {
    if (item === null || typeof item !== 'object') return blank('entry-unreadable');
    const file = item as Record<string, unknown>;
    if (typeof file.path !== 'string' || !CHANGE_PATH.test(file.path)) return blank('entry-unreadable');
    if (typeof file.name !== 'string' || file.name.trim() === '' || /[\\/]/.test(file.name)) return blank('entry-unreadable');
    if (typeof file.size !== 'number' || !Number.isInteger(file.size) || file.size < 0) return blank('entry-unreadable');
    files.push({ path: file.path, name: file.name, size: file.size });
  }
  return { disposition: 'read', reason: 'read', files };
}

function fileContentEqual(a: string, b: string): boolean | null {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    if (sa.size !== sb.size) return false;
    const ha = crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex');
    const hb = crypto.createHash('sha256').update(fs.readFileSync(b)).digest('hex');
    return ha === hb;
  } catch {
    return null;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
