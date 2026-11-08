// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照根的三态探测与目录枚举(自 ./snapshot-store-host.ts 纯抽档,落 AGENTS §3「每页 < 250 行」)。
 * 职责:根存在/读不到/不存在的分流 + 条目枚举 + 建目录前的可读性前置检查。
 * 会话根路径本身仍由 ./snapshot-store-host.ts 的 snapshotRootDir 给出(唯一根内断言入口)。
 */

import * as fs from 'node:fs';

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
