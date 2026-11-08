// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 检查点清单的形状判据(自 ./snapshot-store-host.ts 纯抽档,落 AGENTS §3「每页 < 250 行」)。
 * 职责:CheckpointMeta / CheckpointDiffEntry 的公开形状 + manifest 键的持久化相对路径判据。
 * 只判形状、不读写盘;损坏隔离仍走 ./manifest-integrity.ts 那一份出口(AGENTS §0.6)。
 */

import { isRecord } from '../util/json.js';

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
export function isCheckpointMeta(v: unknown): v is CheckpointMeta {
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
