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
}

export interface CheckpointDiffEntry {
  path: string;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
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
  return Object.values(v.files).every((k) => k === 'snap' || k === 'added');
}

/** 量快照体积的枚举预算:超预算即"量不出来"⇒ 该候选不删(AGENTS §0.3) */
const GC_SIZE_SCAN_BUDGET = 2000;

/** 会话快照根:`~/.ihui/checkpoints/<sessionId>`(存在与否由调用方的读动作判,不在此处猜) */
export function snapshotRootDir(sessionId: string): string {
  return path.join(os.homedir(), '.ihui', 'checkpoints', sessionId);
}

/** 快照根是否存在(编排层用它区分「没有这一层」与「有但为空」⇒ 账面清空语义不漂移) */
export function snapshotRootExists(baseDir: string): boolean {
  return fs.existsSync(baseDir);
}

export function ensureHostDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 基目录下的**全部**条目名(含文件);基目录不存在 ⇒ 空表(不猜、不回落别处) */
export function listEntryNames(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir);
}

/** 基目录下的子目录名(非目录条目剔除);基目录不存在 ⇒ 空表 */
export function listSubDirNames(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
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
 * 逐文件镜像进快照目录:原文件存在 ⇒ 拷贝并记 'snap';不存在 ⇒ 记 'added';
 * 非普通文件 ⇒ 跳过不记。落点越界即抛(抛前已建的目录保留,与拆分前同形)。
 */
export function copyFilesIntoSnapshot(
  workspacePath: string,
  cpDir: string,
  files: string[],
): CheckpointMeta['files'] {
  const recorded: CheckpointMeta['files'] = {};
  for (const f of files) {
    const rel = resolveWorkspaceRelPath(workspacePath, f);
    const absInWorkspace = path.join(workspacePath, rel);
    if (!fs.existsSync(absInWorkspace)) {
      recorded[rel] = 'added';
      continue;
    }
    const stat = fs.statSync(absInWorkspace);
    if (!stat.isFile()) {
      continue;
    }
    const dest = path.join(cpDir, rel);
    ensureHostDir(path.dirname(dest));
    fs.copyFileSync(absInWorkspace, dest);
    recorded[rel] = 'snap';
  }
  return recorded;
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

/** 回滚:manifest 记 'added' 的删掉、记 'snap' 的覆盖回工作区;两边清单缺失即跳过(不猜) */
export function restoreSnapshotFiles(
  workspacePath: string,
  cpDir: string,
  files: CheckpointMeta['files'],
): { restored: string[]; removed: string[] } {
  const restored: string[] = [];
  const removed: string[] = [];
  for (const [rel, kind] of Object.entries(files)) {
    const absInWorkspace = path.join(workspacePath, rel);
    if (kind === 'added') {
      if (fs.existsSync(absInWorkspace)) {
        fs.rmSync(absInWorkspace, { recursive: true, force: true });
        removed.push(rel);
      }
    } else {
      const src = path.join(cpDir, rel);
      if (fs.existsSync(src)) {
        ensureHostDir(path.dirname(absInWorkspace));
        fs.copyFileSync(src, absInWorkspace);
        restored.push(rel);
      }
    }
  }
  return { restored, removed };
}

/** 工作区 vs 快照的逐文件比对,只回非 unchanged 项 */
export function diffSnapshotFiles(
  workspacePath: string,
  cpDir: string,
  files: CheckpointMeta['files'],
): CheckpointDiffEntry[] {
  const entries: CheckpointDiffEntry[] = [];
  for (const [rel, kind] of Object.entries(files)) {
    const absInWorkspace = path.join(workspacePath, rel);
    const existsNow = fs.existsSync(absInWorkspace);
    if (kind === 'added') {
      entries.push({ path: rel, status: existsNow ? 'added' : 'unchanged' });
    } else {
      if (!existsNow) {
        entries.push({ path: rel, status: 'removed' });
        continue;
      }
      const same = fileContentEqual(absInWorkspace, path.join(cpDir, rel));
      entries.push({ path: rel, status: same ? 'unchanged' : 'modified' });
    }
  }
  return entries.filter((e) => e.status !== 'unchanged');
}

export function removeSnapshotDir(cpDir: string): boolean {
  if (!fs.existsSync(cpDir)) return false;
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

function fileContentEqual(a: string, b: string): boolean {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    if (sa.size !== sb.size) return false;
    const ha = crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex');
    const hb = crypto.createHash('sha256').update(fs.readFileSync(b)).digest('hex');
    return ha === hb;
  } catch {
    return false;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
