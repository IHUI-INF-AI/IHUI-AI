// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话置顶(G-11)端内接线层纯逻辑:置顶切换的"调用 + 成功重排 / 失败原样"编排。
// 网络出口不在此模块内定义 —— 由调用方注入 setPinned(各端一律经 @ihui/api-client
// setConversationPinned 单一通道,AGENTS §3;守门 73 拦端内裸 fetch)。
// 排序复用 ./conversation-org 的 sortPinnedFirst,不复制第二份排序实现。
// 零平台依赖:web / 小程序 / RN 三端共用本文件。

import { sortPinnedFirst } from './conversation-org'

/** 可携带置顶态的最小行形态(各端列表行都满足) */
export interface PinStatefulItem {
  id?: string
  pinned?: boolean
}

/** 置顶切换的结果:成功携带按置顶优先稳定重排后的新列表;失败携带原列表与原因 */
export type PinToggleOutcome<T> =
  { ok: true; items: T[] } | { ok: false; error: unknown; items: T[] }

/**
 * 切换某行的置顶态并回一份新列表。
 *
 * - 成功(PATCH 2xx):把该行 pinned 改为 next,并整表按"置顶优先"稳定重排
 *   (非置顶行保持原相对顺序);
 * - 失败(抛错/拒绝):`ok:false`,列表**原样返回**,调用方必须给出可见反馈
 *   (toast / Alert),不得静默吞掉 —— 与 §5e「失败必须响」同一条禁令。
 *
 * 本函数不改入参(immutable),`setPinned` 由调用方注入(唯一网络出口)。
 */
export async function togglePinnedItem<T extends PinStatefulItem>(
  items: readonly T[],
  id: string,
  pinned: boolean,
  setPinned: (id: string, pinned: boolean) => Promise<unknown>,
): Promise<PinToggleOutcome<T>> {
  try {
    await setPinned(id, pinned)
  } catch (error) {
    return { ok: false, error, items: [...items] }
  }
  return {
    ok: true,
    items: sortPinnedFirst(items.map((item) => (item.id === id ? { ...item, pinned } : item))),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
