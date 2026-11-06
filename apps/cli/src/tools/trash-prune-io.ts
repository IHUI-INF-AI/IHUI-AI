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
import { initialExpiryLedger, isExpiryRunLedgerShape, isSafeIdSegment, isTrashManifestShape, type TrashManifestEntry } from '@ihui/shared/delete-guard';
import { announceGuardUnjudged, evaluateFileAccess, toAclPath } from '../sandbox/file-access-policy.js';
import { tryParseJson } from '../util/json.js';
import type { ScannedTrash, TrashPruneResetOutcome, TrashPruneSkip } from './trash-prune-types.js';

export type { RowBuckets, ScannedTrash, TrashPruneRemoval, TrashPruneSkip } from './trash-prune-types.js';

/** 账目落点(与回收站分目录:清理器的生死不该和它要清的东西同生共死) */
const EXPIRY_LEDGER_REL = path.join('.ihui', 'delete-guard', 'expiry-run.json');
/** 单条目体积量的枚举预算:超预算 ⇒ 量不到(量不到不删),不把回收站变成一次全盘 walk */
const MEASURE_ENTRY_BUDGET = 4000;
/** 坏账行留痕 / 复位留痕(Z7 未竟 1:隔离必须可追责、不写留痕的复位等于没复位) */
const QUARANTINE_TRACE_NAME = 'trash-quarantine.jsonl';
const RESET_TRACE_NAME = 'expiry-run-reset.jsonl'; // 复位需带定向说明(≥RESET_MIN_REASON_CHARS 字),失效方向恒为"多要一次说明"
const RESET_MIN_REASON_CHARS = 12; // §0.10

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
export function scanTrash(
  trashRoot: string,
  stat: (target: string) => fs.Stats = fs.statSync,
): { manifests: ScannedTrash[]; bad: TrashPruneSkip[] } {
  const manifests: ScannedTrash[] = [];
  const bad: TrashPruneSkip[] = [];
  try {
    const rootStat = stat(trashRoot);
    if (!rootStat.isDirectory()) {
      bad.push({ trashId: null, relativeTrashPath: null, reason: '回收站根读不到:不是目录' });
      return { manifests, bad };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { manifests, bad };
    bad.push({ trashId: null, relativeTrashPath: null, reason: `回收站根读不到:${msgOf(err)}` });
    return { manifests, bad };
  }
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
  stat?: (target: string) => unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!isInsideDir(dir, relativeTrashPath)) return { ok: false, reason: '条目路径越出该 trashId 目录:拒删' };
  const target = path.join(dir, relativeTrashPath);
  const acl = evaluateFileAccess('delete', toAclPath(workspacePath, target), workspacePath);
  announceGuardUnjudged(workspacePath, acl.guard, 'trash_prune');
  if (acl.blocked) return { ok: false, reason: acl.note ?? '按文件访问裁决禁止删除' };
  const look = stat ?? fs.statSync;
  try {
    try {
      look(target);
    } catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'unknown';
      if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, reason: '删除时已不存在(上轮已摘或外部清理)' };
      return { ok: false, reason: `回收件读不到,不能把它说成已经不存在 (${code})` };
    }
    fs.rmSync(target, { recursive: true, force: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `删除失败:${msgOf(err)}` };
  }
}

/** 摘壳前的容器性核验:目录里除 `manifest.json` 外必须一个条目都没有;读不到 ⇒ false(保守不摘壳) */
function onlyIndexLeft(dir: string): boolean {
  try { return fs.readdirSync(dir).every((name) => name === 'manifest.json'); } catch { return false; }
}

/**
 * 清单更新:被摘条目剔出清单;剔空且目录里只剩清单本身才连壳摘掉,否则只写索引并具名进 ghosts
 * (既有删除点只被**收窄**,不新增删除面)。失败逐条点名。
 */
export function applyManifestUpdates(manifests: readonly ScannedTrash[], hits: ReadonlyMap<string, ReadonlySet<string>>): { failures: string[]; ghosts: string[] } {
  const failures: string[] = [];
  const ghosts: string[] = [];
  for (const scanned of manifests) {
    const removed = hits.get(scanned.trashId);
    if (removed === undefined || removed.size === 0) continue;
    const remaining = scanned.manifest.entries.filter((e) => !removed.has(e.relativeTrashPath));
    try {
      if (remaining.length === 0 && onlyIndexLeft(scanned.dir)) {
        fs.rmSync(scanned.dir, { recursive: true, force: true });
        continue;
      }
      if (remaining.length === 0) ghosts.push(scanned.trashId);
      fs.writeFileSync(path.join(scanned.dir, 'manifest.json'), JSON.stringify({ ...scanned.manifest, entries: remaining }, null, 2), 'utf-8');
    } catch (err) {
      failures.push(`${scanned.trashId}:清单更新失败(件已删、索引仍在):${msgOf(err)}`);
    }
  }
  return { failures, ghosts };
}

/**
 * 单行现场事实:件是否**实证不在**。只在"容器性成立 ∧ stat 报 ENOENT"时答 `absent`;
 * 越界 / 其它错(权限、占用)一律 `unjudged`(不猜,§0.3)。编排腿据此决定"只改索引"还是"整行不碰"。
 */
export function probeRowPresence(dir: string, relative: string): 'absent' | 'present' | 'unjudged' {
  if (!isInsideDir(dir, relative)) return 'unjudged';
  try { fs.statSync(path.join(dir, relative)); return 'present'; }
  catch (err) { return (err as { code?: string }).code === 'ENOENT' ? 'absent' : 'unjudged'; }
}

/** 追写一条 JSONL 留痕(隔离与复位共用);写不进由调用方计入结论,绝不静默 */
function appendTrace(file: string, body: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(body)}\n`, 'utf-8');
}

/** 逐条追写坏账行留痕(供人工反查"这一行被谁、在哪一轮隔离");只存 trashId + 相对路径 */
export function traceQuarantinedRows(workspacePath: string, rows: readonly TrashPruneSkip[], nowIso: string): void {
  const file = path.join(path.dirname(getExpiryLedgerPath(workspacePath)), QUARANTINE_TRACE_NAME);
  for (const row of rows) appendTrace(file, { atIso: nowIso, trashId: row.trashId, row: row.relativeTrashPath, reason: row.reason });
}

/**
 * 人工复位连败账目(X1 未竟 1 的"一条可解释的复位出口")。失效方向 = 多要一次定向说明:
 * 说明不足 12 字 ⇒ 一个字不写;账目读不到 / 形态不合法 ⇒ 不猜着写(§0.3);写回成功必须留痕。
 */
export function resetExpiryRunLedger(ledgerFile: string, reason: string, nowIso: string): TrashPruneResetOutcome {
  const why = reason.trim();
  if (why.length < RESET_MIN_REASON_CHARS) return { ok: false, reason: `复位拒绝:定向说明不足 ${RESET_MIN_REASON_CHARS} 字(当前 ${why.length} 字)` };
  let parsed: unknown;
  try { parsed = tryParseJson(fs.readFileSync(ledgerFile, 'utf-8')); }
  catch (err) { return { ok: false, reason: `复位拒绝:账目读不到(${msgOf(err)}),不猜着写` }; }
  if (!isExpiryRunLedgerShape(parsed)) return { ok: false, reason: '复位拒绝:账目形态不合法,不猜着写' };
  const after = initialExpiryLedger();
  try {
    writeExpiryLedger(ledgerFile, after);
    appendTrace(path.join(path.dirname(ledgerFile), RESET_TRACE_NAME), { atIso: nowIso, reason: why, before: parsed, after });
  } catch (err) {
    return { ok: false, reason: `复位未落地:${msgOf(err)}` };
  }
  return { ok: true, before: parsed };
}

/** 读账目:从未存在 = 首次运行的合法起点;读不到 / JSON 坏 ⇒ raw=null(闸门据此判未判定,且不得覆盖原文件) */
export function readExpiryLedger(
  file: string,
  initial: unknown,
  stat?: (path: string) => fs.Stats,
): { raw: unknown; note: string | null } {
  const look = stat ?? ((p: string) => fs.statSync(p));
  try {
    look(file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { raw: initial, note: null };
    return { raw: null, note: `运行账目读不到,不能把它覆盖成新账 (${code ?? 'unknown'})` };
  }
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
