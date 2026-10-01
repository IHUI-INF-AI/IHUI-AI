// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 回退失败文案的事实驱动分级(D163 / V4 §8.3③)。
 *
 * 铁律:"工作区未发生变化"不许是安慰话 —— 只有撤销前记下的快照与失败后重取的
 * 快照逐文件比对成立(文件集与逐文件指纹都一致),才允许说这句话;比对不了
 * (没快照 / 重取失败)只能说"无法确认";比对不成立则明说"已发生变化"。
 *
 * 本模块是纯函数:不发请求、不碰 DOM。快照的采集(撤销前 / 失败后各调一次
 * `getCheckpointImpact`,以磁盘侧 oldContent 为指纹源)由调用方注入,
 * 见 `components/checkpoint/CheckpointRewindPanel.tsx` 的 `captureImpactSnapshot`。
 */

import type { CheckpointScope } from '@/api/checkpoint-api'

/** 工作区快照:受影响文件集 → 逐文件内容指纹 */
export interface UndoWorkspaceSnapshot {
  readonly files: Readonly<Record<string, string>>
}

/** 单文件指纹入参:path + 内容(内部折成指纹,避免快照里拖整份正文) */
export interface UndoSnapshotEntry {
  readonly path: string
  readonly content: string
}

/** djb2 十六进制指纹:比对目标是"变没变",不是"验完整性",不追求抗碰撞 */
export function fingerprintContent(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

/** 从影响文件清单造快照(撤销前记一次,失败后重取一次) */
export function buildUndoSnapshot(entries: readonly UndoSnapshotEntry[]): UndoWorkspaceSnapshot {
  const files: Record<string, string> = {}
  for (const { path, content } of entries) files[path] = fingerprintContent(content)
  return { files }
}

export type UndoVerdict = 'unchanged' | 'changed' | 'unknown'

/**
 * 两份快照逐文件比对:任一侧缺快照 ⇒ unknown(没有事实就不许Claim);
 * 文件集有增删或任一指纹不一致 ⇒ changed;全都一致 ⇒ unchanged。
 */
export function classifyUndoWorkspace(
  before: UndoWorkspaceSnapshot | null,
  after: UndoWorkspaceSnapshot | null,
): UndoVerdict {
  if (!before || !after) return 'unknown'
  const beforePaths = Object.keys(before.files)
  if (beforePaths.length !== Object.keys(after.files).length) return 'changed'
  for (const path of beforePaths) {
    if (!(path in after.files)) return 'changed'
    if (before.files[path] !== after.files[path]) return 'changed'
  }
  return 'unchanged'
}

/**
 * 按回退范围定级:conversation 范围根本不碰文件,"工作区未发生变化"是事实
 * 而非比对结论;code/both 才需要快照比对,比对不了落 unknown。
 */
export function undoVerdictForScope(
  scope: CheckpointScope,
  before: UndoWorkspaceSnapshot | null,
  after: UndoWorkspaceSnapshot | null,
): UndoVerdict {
  if (scope === 'conversation') return 'unchanged'
  return classifyUndoWorkspace(before, after)
}

/** 失败的可用性侧面:检查点服务本身不可用,还是恢复动作失败 */
export type UndoFailureAvailability = 'checkpoint-unavailable' | 'restore-failed'

/** 文案键(`aiChat.checkpoint` 命名空间下的相对键) */
export type UndoFailureCopyKey =
  | 'undoUnavailable'
  | 'undoFailed'
  | 'undoFailedChanged'
  | 'undoFailedUnverifiable'

const UNDO_FAILURE_KEYS: Record<UndoVerdict, UndoFailureCopyKey> = {
  unchanged: 'undoFailed',
  changed: 'undoFailedChanged',
  unknown: 'undoFailedUnverifiable',
}

/**
 * 失败 → 文案键。"未发生变化"只在 verdict==='unchanged' 时出现;
 * 检查点不可用且有比对结论 unchanged 时用基准键 undoUnavailable。
 */
export function resolveUndoFailureKey(
  availability: UndoFailureAvailability,
  verdict: UndoVerdict,
): UndoFailureCopyKey {
  if (verdict === 'unchanged' && availability === 'checkpoint-unavailable') {
    return 'undoUnavailable'
  }
  return UNDO_FAILURE_KEYS[verdict]
}

/** 成功回退是否算"部分":存在受影响文件但任一文件没拿到恢复版本 ⇒ 未完整恢复 */
export function isUndoPartial(fileVersions: ReadonlyArray<{ version_id?: string }>): boolean {
  return fileVersions.length > 0 && fileVersions.some((v) => !v.version_id)
}
