// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { TRASH_MANIFEST_KIND } from './constants'
import type { TrashManifest, TrashManifestEntry } from './types'

/**
 * 回收站落点与恢复出口的**抽象层**(纯判据):
 * - 条目命名/形态校验在此(纯字符串运算,不 import node:path);
 * - 真实搬运(copy/rename/manifest 落盘)留在端内 adapter(apps/cli 工具层)。
 * 超越点:对方回收站埋在独立 exe(genie-trash),本层命名规则与恢复查找可被单测钉住。
 */

/** 把相对路径压平成单一文件名(seq 前缀防不同路径压平后撞名) */
/**
 * 把相对路径压平成单一文件名。转义序保证单射('_' 先转 '_s',再 '/'、'\\'→'__',
 * 其余非法字符各占独立码),不同相对路径不会压平撞名;seq 前缀再兜一层同批序号。
 */
export function flattenTrashName(relPath: string, seq: number): string {
  const flat = relPath
    .replace(/_/g, '_s')
    .replace(/[\\/]+/g, '__')
    .replace(/:/g, '_c')
    .replace(/\*/g, '_k')
    .replace(/\?/g, '_q')
    .replace(/"/g, '_d')
    .replace(/</g, '_l')
    .replace(/>/g, '_g')
    .replace(/\|/g, '_v')
  return `${seq}-${flat}`
}

/** id 段安全判据:只允许 [A-Za-z0-9._-],禁 '..' 与空 —— 端内拼路径前必须先过这一关(防穿越) */
export function isSafeIdSegment(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 80 &&
    !value.includes('..') &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  )
}

function isTrashEntryShape(v: unknown): v is TrashManifestEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e['originalPath'] === 'string' &&
    typeof e['relativeTrashPath'] === 'string' &&
    (typeof e['sizeBytes'] === 'number' || e['sizeBytes'] === null) &&
    (e['kind'] === 'file' || e['kind'] === 'directory')
  )
}

/** 回收站清单形态校验(结构合法才允许进入恢复流程;坏 ⇒ 调用方按未判定处理,不硬试) */
export function isTrashManifestShape(value: unknown): value is TrashManifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    m['kind'] === TRASH_MANIFEST_KIND &&
    isSafeIdSegment(m['trashId']) &&
    typeof m['createdAtIso'] === 'string' &&
    typeof m['workspacePath'] === 'string' &&
    Array.isArray(m['entries']) &&
    (m['entries'] as unknown[]).every(isTrashEntryShape)
  )
}

/** 恢复出口的查找判据:按删除前原路精确匹配;找不到 ⇒ null(调用方出声,不静默) */
export function findTrashEntry(
  manifest: TrashManifest,
  originalPath: string,
): TrashManifestEntry | null {
  return manifest.entries.find((e) => e.originalPath === originalPath) ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
