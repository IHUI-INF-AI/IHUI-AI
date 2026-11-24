// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 协作 CLI 退出码 / 响应形 / 分页 / 幂等键(fail-closed 语义的单源)。
 *
 * 借鉴来源(Qoder CN 协作 CLI,取证 block3-qoder.md 的 B3-03 `references/operations.md`):
 *   - 退出码 **4 = 部分结果**(`complete:false` + `nextOffset`)、**3 = 拒绝/缺宿主上下文**、
 *     **130 = 取消/超时**;
 *   - 响应形 `{ success, data }` / `{ success:false, error }`;
 *   - `outcome_unknown` / 断连 / 超大结果 ⇒ **写可能已成功**,必须**先查询再重试**,禁止盲目重放 create;
 *   - `requestId` 用于同一操作的幂等重试。
 *
 * 本仓复现 + 超越:
 *   1. "结果未知"三档**不塌成成功**:退出码按拒绝(3)算,且 `mustQueryBeforeRetry` 为真 ——
 *      调用方无法把未知读成成功;
 *   2. `requestIdFor` 是**稳定哈希**(键序无关),同操作同 payload 恒得同一 id ⇒ 重放可被服务端识别;
 *   3. 分页 `complete` 由 `nextOffset` **推导**(只有一个真相源),不允许调用方自报 complete。
 *
 * 边界(刻意):本层不做网络请求、不写台账(PostgreSQL 落账属另一票);纯函数,零 I/O。
 */

import { createHash } from 'node:crypto';

/** 退出码契约(值对齐 Qoder 协作 CLI 明文;0 为成功)。 */
export const COLLAB_EXIT_CODES = {
  ok: 0,
  refused: 3,
  partial: 4,
  canceled: 130,
} as const;

/** 一次协作操作的七种结局。后三档统称"结果未知"。 */
export type CollabOutcome =
  | 'ok'
  | 'refused'
  | 'partial'
  | 'canceled'
  | 'outcome_unknown'
  | 'disconnected'
  | 'oversize';

/**
 * 结局 → 进程退出码。
 * "结果未知"三档一律按**拒绝**算(3),绝不给 0 —— 没读到答案不等于拿到答案。
 */
export function exitCodeForOutcome(outcome: CollabOutcome): number {
  switch (outcome) {
    case 'ok':
      return COLLAB_EXIT_CODES.ok;
    case 'refused':
    case 'outcome_unknown':
    case 'disconnected':
    case 'oversize':
      return COLLAB_EXIT_CODES.refused;
    case 'partial':
      return COLLAB_EXIT_CODES.partial;
    case 'canceled':
      return COLLAB_EXIT_CODES.canceled;
  }
}

/** 结果未知 ⇒ 必须先查询确认再重试(禁止盲目重放 create)。 */
export function mustQueryBeforeRetry(outcome: CollabOutcome): boolean {
  return outcome === 'outcome_unknown' || outcome === 'disconnected' || outcome === 'oversize';
}

export interface CollabErrorBody {
  code: string;
  message: string;
}

/** 响应形:成功与失败**互斥**,失败侧没有 data 字段。 */
export type CollabResponse<T> =
  | { success: true; data: T }
  | { success: false; error: CollabErrorBody };

export function collabOk<T>(data: T): CollabResponse<T> {
  return { success: true, data };
}

export function collabError(code: string, message: string): CollabResponse<never> {
  return { success: false, error: { code, message } };
}

export interface CollabPage<T> {
  items: T[];
  /** 由 `nextOffset` 推导:nextOffset 为 null 才是 complete。 */
  complete: boolean;
  nextOffset: number | null;
}

/** 分页结果:有 `nextOffset` ⇒ `complete:false` 且退出码 4(调用方按 `COLLAB_EXIT_CODES.partial` 处理)。 */
export function partialPage<T>(items: T[], nextOffset: number | null): CollabResponse<CollabPage<T>> {
  return collabOk({ items, complete: nextOffset === null, nextOffset });
}

/**
 * 稳定序列化:对象键按字典序、数组保序、`undefined` 键丢弃。
 * 目的只有一个 —— 让同一操作同一 payload 恒得同一 `requestId`(与构造顺序无关)。
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`;
}

/** 幂等键:同 operation + 同 payload ⇒ 同 64 位 hex;任一不同 ⇒ 不同。 */
export function requestIdFor(operation: string, payload: unknown): string {
  const hash = createHash('sha256');
  hash.update(operation);
  hash.update('\u0000');
  hash.update(stableStringify(payload));
  return hash.digest('hex');
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
