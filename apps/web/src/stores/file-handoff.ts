// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { create } from 'zustand'

/**
 * 文件查看器 → 主 AI 对话的跨组件交接队列(2026-11-27 立)。
 *
 * 为什么需要独立 store,而不是在查看器里直接派发 window 事件:
 * AISidePanel 关闭时 MessageInput 整体不挂载,`window.dispatchEvent` 会当场丢掉;
 * 用户点“在对话中继续”的真实时序是「先关查看器 → 再打开 AI 面板 → MessageInput 才挂载」。
 * 因此交接必须是**可排队的状态**,由 MessageInput 挂载后主动消费,而不是一次性事件。
 *
 * 为什么队列项带 targetPaneId:
 * AISidePanel 支持多窗格,根窗格(无 PaneProvider)的 paneId 是 null;非根窗格各自有 id。
 * 查看器是全局组件,不知道用户想发到哪个窗格 ⇒ 统一投给根窗格(主对话),由根 MessageInput
 * 消费;其他窗格即使订阅到队列变化也不会把文件抢走。消费即删除,避免面板重开时重复上传。
 */
export interface FileHandoffItem {
  readonly id: string
  readonly file: File
  /** 可选预填正文;空字符串表示只带附件,不覆盖用户已有草稿。 */
  readonly prompt?: string
  readonly targetPaneId: string | null
  readonly createdAt: number
}

interface FileHandoffState {
  pending: FileHandoffItem[]
  enqueue: (input: { file: File; prompt?: string; targetPaneId?: string | null }) => FileHandoffItem
  /** 只取目标窗格的条目;其余窗格保持原样,避免被非根输入区误消费。 */
  consumeForPane: (paneId: string | null) => FileHandoffItem[]
  clear: () => void
}

/** 同一文件被连续点击两次(同一查看器、同一字节)只保留一条,避免重复上传。 */
function isSameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}

let seq = 0

export const useFileHandoffStore = create<FileHandoffState>((set, get) => ({
  pending: [],
  enqueue: ({ file, prompt, targetPaneId = null }) => {
    const existing = get().pending.find(
      (item) => item.targetPaneId === targetPaneId && isSameFile(item.file, file),
    )
    if (existing) return existing
    seq += 1
    const item: FileHandoffItem = {
      id: `handoff-${seq}`,
      file,
      prompt: prompt?.trim() || undefined,
      targetPaneId,
      createdAt: Date.now(),
    }
    set((state) => ({ pending: [...state.pending, item].slice(-8) }))
    return item
  },
  consumeForPane: (paneId) => {
    const target = paneId ?? null
    const selected = get().pending.filter((item) => item.targetPaneId === target)
    if (selected.length === 0) return []
    set((state) => ({
      pending: state.pending.filter((item) => item.targetPaneId !== target),
    }))
    return selected
  },
  clear: () => set({ pending: [] }),
}))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
