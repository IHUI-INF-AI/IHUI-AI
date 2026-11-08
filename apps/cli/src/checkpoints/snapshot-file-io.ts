// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照文件的镜像读写(自 ./snapshot-store-host.ts 纯抽档,落 AGENTS §3「每页 < 250 行」)。
 * 职责:录制(逐文件拷入/清单写入)、回滚、比对、删除、体积测量。文案与调用顺序逐字保留。
 * 根的三态与建目录前提仍走 ./snapshot-root-io.ts;清单形状判据走 ./checkpoint-meta.ts。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { CheckpointDiffEntry, CheckpointMeta } from './checkpoint-meta.js';
import { ensureHostDir, probeSnapshotRoot } from './snapshot-root-io.js';

/** 量快照体积的枚举预算:超预算即"量不出来"⇒ 该候选不删(AGENTS §0.3) */
const GC_SIZE_SCAN_BUDGET = 2000;

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
