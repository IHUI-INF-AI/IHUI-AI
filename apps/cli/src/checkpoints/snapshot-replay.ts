// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照回放/比对层(goal-b49 W3 自 ./snapshot-store-host.ts 抽出,落 AGENTS §3「每页 < 250 行」)。
 * 回放侧与录制侧刻意不同:manifest 键是持久化输入,可能被篡改成根内符号链接指向根外 ——
 * 单靠 path.relative 判不出来,必须再做 realpath 二次断言。本文件复用 ./snapshot-store-host.ts
 * 的 ensureHostDir(单向依赖,不成环)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { assertPathInside } from '../util/path-guard.js';
import { ensureHostDir, type CheckpointDiffEntry, type CheckpointMeta } from './snapshot-store-host.js';

/**
 * 录制侧:把入参收成工作区相对路径(纯 resolve 判根内,**不做 realpath**)。
 *
 * 录制发生在"工具刚改完某文件"的那一刻,`link.txt` 这种工作区内符号链接是**当时真实存在**的
 * 形态,记录它(跟随链接读内容)是正确语义;穿透风险在**回放侧**(见下)。
 */
export function toWorkspaceRelPath(workspacePath: string, filePath: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath);
  const rel = path.relative(workspacePath, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`文件 ${filePath} 不在工作区 ${workspacePath} 内`);
  }
  return rel;
}

/**
 * 回放/比对侧:把持久化按键收成工作区相对路径,**并做 realpath 二次断言**。
 *
 * 与录制侧刻意不同:manifest 键是持久化输入,可能被篡改成根内符号链接指向根外 ——
 * 单靠 path.relative 判不出来(rel 仍是 `link.txt`),回放会穿透链接写进根外真身。
 * 文案沿用本层"不在工作区"契约,realpath 原因拼在冒号后(含「符号链接解析后落在根目录」)。
 */
export function resolveWorkspaceRelPath(workspacePath: string, filePath: string): string {
  const rel = toWorkspaceRelPath(workspacePath, filePath);
  const abs = path.join(workspacePath, rel);
  try {
    assertPathInside(workspacePath, abs, '工作区文件');
  } catch (err) {
    throw new Error(`文件 ${filePath} 不在工作区 ${workspacePath} 内:${(err as Error).message}`);
  }
  return rel;
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

export function fileContentEqual(a: string, b: string): boolean | null {
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
