// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站到期清理 —— 端内 IO 腿(goal-b49 W7 未竟 1)。
 *
 * 这里只有三件事:枚举清单 / 现场量体积 / 走既有删除通道摘件 + 把清单与账目改对。
 * 到期判定、双档上限、连败死亡机制**一行都不在这里** —— 全在 `@ihui/shared/delete-guard`(§0.6)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isSafeIdSegment, isTrashManifestShape, type TrashManifest, type TrashManifestEntry } from '@ihui/shared/delete-guard';
import { announceGuardUnjudged, evaluateFileAccess, toAclPath } from '../sandbox/file-access-policy.js';
import { tryParseJson } from '../util/json.js';

/** 账目落点(与回收站分目录:清理器的生死不该和它要清的东西同生共死) */
const EXPIRY_LEDGER_REL = path.join('.ihui', 'delete-guard', 'expiry-run.json');
/** 单条目体积量的枚举预算:超预算 ⇒ 量不到(量不到不删),不把回收站变成一次全盘 walk */
const MEASURE_ENTRY_BUDGET = 4000;

export interface TrashPruneRemoval {
  readonly trashId: string;
  readonly relativeTrashPath: string;
  readonly bytes: number;
}

/** 未删原因(逐条点名:判不出 / 超上限 / 清单坏 / 删除失败)—— 空账时不产生任何条目 */
export interface TrashPruneSkip {
  readonly trashId: string | null;
  readonly relativeTrashPath: string | null;
  readonly reason: string;
}

export interface ScannedTrash {
  readonly trashId: string;
  readonly dir: string;
  readonly manifest: TrashManifest;
}

export function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 账目落点(供调度器/人工复位用;复位 = streak 归零并清 retiredAtIso) */
export function getExpiryLedgerPath(workspacePath: string): string {
  return path.join(workspacePath, EXPIRY_LEDGER_REL);
}

/** 容器性断言:`relativeTrashPath` 来自清单文本(可被改写),这条路要动 rm,不信它 */
function isInsideDir(root: string, relative: string): boolean {
  if (relative.length === 0 || path.isAbsolute(relative)) return false;
  const rootAbs = path.resolve(root);
  const targetAbs = path.resolve(rootAbs, relative);
  return targetAbs !== rootAbs && targetAbs.startsWith(rootAbs + path.sep);
}

/** 量一条回收件的体积;量不到(不存在/读不动/越界/超预算)⇒ null,判据层据此"不清并点名" */
export function measureTrashEntry(dir: string, entry: TrashManifestEntry): number | null {
  if (!isInsideDir(dir, entry.relativeTrashPath)) return null;
  const target = path.join(dir, entry.relativeTrashPath);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return null;
  }
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return null;
  let bytes = 0;
  let visited = 0;
  const stack: string[] = [target];
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
      if (visited > MEASURE_ENTRY_BUDGET) return null;
      const child = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(child);
        continue;
      }
      try {
        const childStat = fs.statSync(child);
        if (childStat.isFile()) bytes += childStat.size;
      } catch {
        return null;
      }
    }
  }
  return bytes;
}

/** 枚举回收站:根不存在 = 真空账;根读不到 / 清单坏 = 逐条点名(绝不当成空账) */
export function scanTrash(trashRoot: string): { manifests: ScannedTrash[]; bad: TrashPruneSkip[] } {
  const manifests: ScannedTrash[] = [];
  const bad: TrashPruneSkip[] = [];
  if (!fs.existsSync(trashRoot)) return { manifests, bad };
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(trashRoot, { withFileTypes: true });
  } catch (err) {
    bad.push({ trashId: null, relativeTrashPath: null, reason: `回收站根读不到:${msgOf(err)}` });
    return { manifests, bad };
  }
  for (const dirent of dirents) {
    const dirName = dirent.name;
    const reject = (reason: string) => bad.push({ trashId: dirName, relativeTrashPath: null, reason });
    if (!dirent.isDirectory()) {
      reject('回收站根下的非目录条目:不按清单处理');
      continue;
    }
    if (!isSafeIdSegment(dirName)) {
      reject('目录名形态非法(疑似穿越):不判');
      continue;
    }
    const dir = path.join(trashRoot, dirName);
    let text: string;
    try {
      text = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8');
    } catch {
      reject('manifest.json 缺失或读不到:不硬试');
      continue;
    }
    const parsed = tryParseJson(text);
    if (!isTrashManifestShape(parsed)) {
      reject('清单形态不合法:不硬试');
      continue;
    }
    if (parsed.trashId !== dirName) {
      reject('清单自称 trashId 与目录名不一致:不判');
      continue;
    }
    manifests.push({ trashId: dirName, dir, manifest: parsed });
  }
  return { manifests, bad };
}

/**
 * 删一条回收件:走**既有删除通道**(ACL delete 轴 + 守卫出声,与 `stashFileToTrash` /
 * `WorktreeManager.remove` 同一道),不经 node fs 裸删。失败如实回报,不吞不猜。
 */
export function deleteTrashEntry(
  workspacePath: string,
  dir: string,
  relativeTrashPath: string,
): { ok: true } | { ok: false; reason: string } {
  if (!isInsideDir(dir, relativeTrashPath)) return { ok: false, reason: '条目路径越出该 trashId 目录:拒删' };
  const target = path.join(dir, relativeTrashPath);
  const acl = evaluateFileAccess('delete', toAclPath(workspacePath, target), workspacePath);
  announceGuardUnjudged(workspacePath, acl.guard, 'trash_prune');
  if (acl.blocked) return { ok: false, reason: acl.note ?? '按文件访问裁决禁止删除' };
  try {
    if (!fs.existsSync(target)) return { ok: false, reason: '删除时已不存在(上轮已摘或外部清理)' };
    fs.rmSync(target, { recursive: true, force: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `删除失败:${msgOf(err)}` };
  }
}

/** 清单更新:被摘条目剔出清单;剔空则整目录(含 manifest)摘掉;失败逐条点名 */
export function applyManifestUpdates(
  manifests: readonly ScannedTrash[],
  hits: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const failures: string[] = [];
  for (const scanned of manifests) {
    const removed = hits.get(scanned.trashId);
    if (removed === undefined || removed.size === 0) continue;
    const remaining = scanned.manifest.entries.filter((e) => !removed.has(e.relativeTrashPath));
    try {
      if (remaining.length === 0) {
        fs.rmSync(scanned.dir, { recursive: true, force: true });
      } else {
        fs.writeFileSync(
          path.join(scanned.dir, 'manifest.json'),
          JSON.stringify({ ...scanned.manifest, entries: remaining }, null, 2),
          'utf-8',
        );
      }
    } catch (err) {
      failures.push(`${scanned.trashId}:清单更新失败(件已删、索引仍在):${msgOf(err)}`);
    }
  }
  return failures;
}

/** 读账目:从未存在 = 首次运行的合法起点;读不到 / JSON 坏 ⇒ raw=null(闸门据此判未判定) */
export function readExpiryLedger(file: string, initial: unknown): { raw: unknown; note: string | null } {
  if (!fs.existsSync(file)) return { raw: initial, note: null };
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    return { raw: null, note: `运行账目读不到:${msgOf(err)}` };
  }
  const parsed = tryParseJson(text);
  if (parsed === undefined) return { raw: null, note: '运行账目 JSON 解析失败' };
  return { raw: parsed, note: null };
}

/** 写账目:不写账目的封票等于没有封票 */
export function writeExpiryLedger(file: string, ledger: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2), 'utf-8');
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
