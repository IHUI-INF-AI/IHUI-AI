// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * read_file 的「最近已读」缓存与 file_unchanged 短路(吸收 G-937971)。
 *
 * 病灶:模型在同一个会话里反复 read_file 同一个文件(改一处读一遍、遗忘后重读),
 * 每次都把整份带行号正文重灌进上下文。上游的做法是给 Read 挂 readFileState:
 * cacheKey=(path,offset,limit),mtime+size 都没变 ⇒ 回一条 "Wasted call" 短路 stub,
 * 不重发内容;外部改写过 ⇒ 缓存失效,照常重读。
 *
 * 状态挂在 ToolContext 上(WeakMap,与上游 read.ts 的 fallbackReadFileStates 同构):
 * 生命周期 = 一次工具循环/会话,不落盘、不跨进程;跨会话恢复本来就该重读。
 *
 * freshness 判据与上游 read.ts `isCachedReadFresh` 同形:mtime 只比整数毫秒
 * (浮点尾差会让"没变"被判成"变过"),mtime 可比时 mtime+size 双判;
 * 否则退到 size 单判(仅剩的兜底,弱判据但聊胜于无)。
 *
 * **isPartialView 只指被工具截断的视图**(字节闸/行数闸/token 预算闸切过的),
 * 这类条目永不短路 —— 模型没见过全貌,"文件没变"的 stub 会替它担保没看过的字节。
 * offset/limit 的 range view 是**点名要的那一窗**,不算 partial,照常缓存。
 */

import type * as fs from 'node:fs';

/** 短路 stub(与上游 read.ts 的 FILE_UNCHANGED_STUB 同文):指向上一条 tool_result */
export const FILE_UNCHANGED_STUB =
  'Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.';

/** 一条已读缓存条目 */
export interface ReadFileStateEntry {
  path: string;
  /** range view 参数(与 cacheKey 对应) */
  offset?: number;
  limit?: number;
  /** true = 模型看到的是被工具截断的视图;此类条目永不短路 */
  isPartialView: boolean;
  mtimeMs?: number;
  sizeBytes?: number;
  recordedAt: number;
}

export type ReadFileStateMap = Map<string, ReadFileStateEntry>;

/** cacheKey:(path, offset, limit) 三元组;offset/limit 用 null 归一,避免 undefined 混进 JSON */
export function createReadFileStateKey(filePath: string, offset?: number, limit?: number): string {
  return JSON.stringify([filePath, offset ?? null, limit ?? null]);
}

/** mtime 归一到整数毫秒(与写前 freshness 校验同一口径;浮点尾差会造成假 stale) */
export function normalizeMtimeMs(ms: number | undefined): number | undefined {
  return ms === undefined ? undefined : Math.floor(ms);
}

/** 缓存条目对当前 stat 是否仍新鲜(partial 条目一律不新鲜) */
export function isCachedReadFresh(
  entry: ReadFileStateEntry,
  stat: { mtimeMs?: number; size: number },
): boolean {
  if (entry.isPartialView) return false;

  if (entry.mtimeMs !== undefined && stat.mtimeMs !== undefined) {
    return (
      normalizeMtimeMs(entry.mtimeMs) === normalizeMtimeMs(stat.mtimeMs) &&
      entry.sizeBytes === stat.size
    );
  }
  // mtime 不可比时的兜底:只比 size(弱判据:同尺寸改写会漏判,但比"永远重读"省)
  return entry.sizeBytes !== undefined && entry.sizeBytes === stat.size;
}

/** context → read-file 状态(WeakMap:ctx 被回收,状态跟着走) */
const perContextStates = new WeakMap<object, ReadFileStateMap>();

export function getReadFileStateMap(context: object): ReadFileStateMap {
  let state = perContextStates.get(context);
  if (!state) {
    state = new Map();
    perContextStates.set(context, state);
  }
  return state;
}

/** 从 fs.Stats 取 freshness 判据所需的两个字段(独立函数便于测试注入) */
export function statFingerprint(stat: fs.Stats): { mtimeMs: number; size: number } {
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
