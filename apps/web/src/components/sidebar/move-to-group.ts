// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165(承 V4 §9.4②):会话分组三动作的纯逻辑层 —— 移动到分组 / 批量移动所选 / 分组置顶排序。
// 归一化与文件夹语义复用 @ihui/shared conversation-org(§3 共享层优先,不建第二套规则);
// 本文件只回答"这一次移动/排序该不该成、成几条",不碰存储与网络,便于纯函数单测。

import { normalizeOrgName } from '@ihui/shared'

/** D165:移动到分组的失败三态(每种都必须有点名文案,禁止裸「操作失败」) */
export type MoveToGroupFailure = 'folderMissing' | 'unauthorized' | 'conflict'

export type MoveToGroupResult =
  | { status: 'ok'; moved: number; folder: string | null }
  | { status: 'unauthorized'; folder: null }
  | { status: 'folderMissing'; folder: string }
  | { status: 'conflict'; folder: string | null }

/**
 * D165:判定一次「移动到分组」的结果(纯函数)。
 * - unauthorized:登录态缺失(userId 为空)—— 元数据 store 按 userId 分桶,无桶可写
 * - folderMissing:目标分组在提交时已不在现存分组列表里(典型:对话框打开期间分组被删)
 * - conflict:所选会话已全部在目标分组(含"已在未分组"),本次无任何变化可产生
 * - ok:moved = 真正发生变化的会话数
 */
export function resolveMoveToGroup(input: {
  authorized: boolean
  /** 目标分组;null = 未分组 */
  target: string | null
  /** 提交时仍存在的分组名(来自 listFolderNames,已归一化) */
  knownFolders: readonly string[]
  /** 本次待移动会话的当前文件夹映射(convId → folder 名|null,未分组为 null/缺省) */
  currentFolderByConv: Readonly<Record<string, string | null | undefined>>
}): MoveToGroupResult {
  if (!input.authorized) return { status: 'unauthorized', folder: null }
  const target = input.target ? normalizeOrgName(input.target) || null : null
  if (target && !input.knownFolders.some((f) => normalizeOrgName(f) === target)) {
    return { status: 'folderMissing', folder: target }
  }
  let moved = 0
  for (const id of Object.keys(input.currentFolderByConv)) {
    // 两侧都先归一化再比:历史脏值(多余空白)不会造成"看似移动了实则没动"
    if (normalizeOrgName(input.currentFolderByConv[id]) !== (target ?? '')) moved += 1
  }
  if (moved === 0) return { status: 'conflict', folder: target }
  return { status: 'ok', moved, folder: target }
}

/**
 * D165:分组列表的置顶优先稳定排序 —— 已置顶分组整体前移(保持原有码位序),其余不动。
 * 与 sortPinnedFirst 同一引用纪律:不改入参、排序键确定(不依赖 ICU 区域设置)。
 */
export function orderFoldersWithPinned(
  folders: readonly string[],
  pinned: readonly string[],
): string[] {
  const pinSet = new Set(pinned.map((f) => normalizeOrgName(f)))
  const head: string[] = []
  const tail: string[] = []
  for (const folder of folders) {
    if (pinSet.has(folder)) head.push(folder)
    else tail.push(folder)
  }
  return [...head, ...tail]
}
