import { create } from 'zustand'

/** Inline edit 选区信息(由 Monaco onDidChangeCursorSelection 上报) */
export interface InlineEditSelection {
  /** 关联的 editor tab id */
  tabId: string
  /** 文件路径(用于 prompt 上下文) */
  filePath: string
  /** 语言 id(用于 prompt 上下文 + 代码块语言标签) */
  language: string
  /** 选区起止行列(Monaco ISelection 1-based) */
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  /** 选中文本(AI prompt 输入) */
  selectedText: string
}

/** Inline edit 会话历史条目(用于撤销/审计) */
export interface InlineEditHistoryItem {
  id: string
  selection: InlineEditSelection
  instruction: string
  patch: string
  accepted: boolean
  createdAt: number
}

/** 编辑会话状态机:idle → loading → done/error → idle */
export type InlineEditStatus = 'idle' | 'loading' | 'done' | 'error'

/**
 * 把 AI 生成结果应用回 Monaco editor 的回调签名。
 * 由 CodeEditor 组件在 onMount 时注册,acceptPatch 时调用。
 * 实现方用 editor.executeEdits 替换选区文本。
 */
export type ApplyPatchCallback = (patch: string, selection: InlineEditSelection) => void

interface InlineEditState {
  /** 对话框是否打开 */
  isOpen: boolean
  /** 当前选区(打开对话框时锁定,关闭时清空) */
  selection: InlineEditSelection | null
  /** 状态机 */
  status: InlineEditStatus
  /** 用户输入的修改指令 */
  instruction: string
  /** AI 生成的修改后代码(流式累积) */
  generatedPatch: string
  /** 错误信息 */
  error: string | null
  /** 历史记录(最多保留 20 条,LRU) */
  history: InlineEditHistoryItem[]
  /** 由 CodeEditor 注册的 patch 应用回调(组件卸载时置 null) */
  applyPatchCallback: ApplyPatchCallback | null

  // Actions
  open: (selection: InlineEditSelection) => void
  close: () => void
  setInstruction: (instruction: string) => void
  setStatus: (status: InlineEditStatus) => void
  setGeneratedPatch: (patch: string) => void
  appendPatchDelta: (delta: string) => void
  setError: (error: string | null) => void
  reset: () => void
  /** 注册/注销 patch 应用回调 */
  registerApplyPatchCallback: (cb: ApplyPatchCallback | null) => void
  /** 接受 patch:调 callback 应用回编辑器,写入历史,关闭对话框 */
  acceptPatch: () => void
  /** 拒绝 patch:写入历史(标记 accepted=false),关闭对话框 */
  rejectPatch: () => void
}

const MAX_HISTORY = 20

export const useInlineEditStore = create<InlineEditState>((set, get) => ({
  isOpen: false,
  selection: null,
  status: 'idle',
  instruction: '',
  generatedPatch: '',
  error: null,
  history: [],
  applyPatchCallback: null,

  open: (selection) =>
    set({
      isOpen: true,
      selection,
      status: 'idle',
      instruction: '',
      generatedPatch: '',
      error: null,
    }),

  close: () =>
    set({
      isOpen: false,
      selection: null,
      status: 'idle',
      instruction: '',
      generatedPatch: '',
      error: null,
    }),

  setInstruction: (instruction) => set({ instruction }),
  setStatus: (status) => set({ status }),
  setGeneratedPatch: (patch) => set({ generatedPatch: patch }),
  appendPatchDelta: (delta) =>
    set((s) => ({ generatedPatch: s.generatedPatch + delta })),
  setError: (error) =>
    set((s) => ({ status: error ? 'error' : s.status, error })),

  reset: () =>
    set({
      status: 'idle',
      instruction: '',
      generatedPatch: '',
      error: null,
    }),

  registerApplyPatchCallback: (cb) => set({ applyPatchCallback: cb }),

  acceptPatch: () => {
    const { selection, instruction, generatedPatch, applyPatchCallback } = get()
    if (!selection || !generatedPatch) {
      set({ isOpen: false, selection: null, status: 'idle', instruction: '', generatedPatch: '' })
      return
    }
    if (applyPatchCallback) {
      try {
        applyPatchCallback(generatedPatch, selection)
      } catch {
        // callback 失败不阻塞关闭(编辑器可能已卸载)
      }
    }
    const historyItem: InlineEditHistoryItem = {
      id: `ie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      selection,
      instruction,
      patch: generatedPatch,
      accepted: true,
      createdAt: Date.now(),
    }
    set((s) => ({
      isOpen: false,
      selection: null,
      status: 'idle',
      instruction: '',
      generatedPatch: '',
      error: null,
      history: [historyItem, ...s.history].slice(0, MAX_HISTORY),
    }))
  },

  rejectPatch: () => {
    const { selection, instruction, generatedPatch } = get()
    const historyItem: InlineEditHistoryItem | null =
      selection && generatedPatch
        ? {
            id: `ie-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            selection,
            instruction,
            patch: generatedPatch,
            accepted: false,
            createdAt: Date.now(),
          }
        : null
    set((s) => ({
      isOpen: false,
      selection: null,
      status: 'idle',
      instruction: '',
      generatedPatch: '',
      error: null,
      history: historyItem ? [historyItem, ...s.history].slice(0, MAX_HISTORY) : s.history,
    }))
  },
}))
