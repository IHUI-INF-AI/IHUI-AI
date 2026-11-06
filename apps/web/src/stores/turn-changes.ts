// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 「按轮变更集」审查弹窗的展示层状态(web)。
 *
 * 与 `session-diff` 同姿势:独立小 store,不挂 1521 行的主 chat store(并行任务面零冲突)。
 * 区别是这份数据必须向服务端取(逐轮 change set + 逐文件 unified diff + 回滚预览),
 * 因此把四个异步面(列表 / 详情 / 预演 / 实发)的 loading/error 都收在这里,
 * 组件只读状态、不自己发请求(测试只需 mock `@/lib/turn-changes-api`)。
 */

import { create } from 'zustand'
import {
  getChatTurnChange,
  listChatTurnChanges,
  requestTurnChangeRewind,
  type TurnChangeDetail,
  type TurnChangeRewindResult,
  type TurnChangeSummary,
} from '@/lib/turn-changes-api'

export type TurnChangeLoadPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface TurnChangeDetailState {
  phase: TurnChangeLoadPhase
  detail?: TurnChangeDetail
  /** 取数失败时的原始信息;空串表示"只有失败没有文案",由组件取通用词条 */
  error: string
}

export interface TurnChangePreviewState {
  phase: TurnChangeLoadPhase
  result?: TurnChangeRewindResult
  error: string
}

interface TurnChangesState {
  open: boolean
  conversationId: string | null
  items: TurnChangeSummary[]
  listPhase: TurnChangeLoadPhase
  listError: string
  /** 当前展开的变更集 id(同一时刻只展开一个,与 session-diff 的按文件展开同交互) */
  expandedId: string | null
  details: Record<string, TurnChangeDetailState>
  previews: Record<string, TurnChangePreviewState>
  /** 正在实发回滚的变更集 id(按钮 loading + 防重复点击) */
  applyingId: string | null
  openForConversation: (conversationId: string) => void
  close: () => void
  reload: () => Promise<void>
  toggle: (id: string) => Promise<void>
  previewRewind: (id: string) => Promise<void>
  confirmRewind: (id: string) => Promise<void>
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : ''
}

export const useTurnChangesStore = create<TurnChangesState>((set, get) => ({
  open: false,
  conversationId: null,
  items: [],
  listPhase: 'idle',
  listError: '',
  expandedId: null,
  details: {},
  previews: {},
  applyingId: null,

  openForConversation: (conversationId) => {
    set({
      open: true,
      conversationId,
      items: [],
      listPhase: 'loading',
      listError: '',
      expandedId: null,
      details: {},
      previews: {},
      applyingId: null,
    })
    void get().reload()
  },

  close: () =>
    set({
      open: false,
      conversationId: null,
      items: [],
      listPhase: 'idle',
      listError: '',
      expandedId: null,
      details: {},
      previews: {},
      applyingId: null,
    }),

  reload: async () => {
    const { conversationId } = get()
    if (!conversationId) {
      set({ listPhase: 'ready', items: [] })
      return
    }
    set({ listPhase: 'loading', listError: '' })
    try {
      const res = await listChatTurnChanges({ conversationId, limit: 20 })
      // 切换会话/关窗后回来的旧响应不得写进新会话(与流式代际守卫同一取向)
      if (get().conversationId !== conversationId) return
      if (!res.success) throw new Error(res.error)
      // 「最新在前」在端内也排一次:不依赖服务端返回顺序,接口若按 turnId 升序也正确
      const items = [...res.data.items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      set({ items, listPhase: 'ready', listError: '' })
    } catch (e) {
      if (get().conversationId !== conversationId) return
      set({ listPhase: 'error', listError: errorText(e) })
    }
  },

  toggle: async (id) => {
    if (get().expandedId === id) {
      // 详情取数失败时这个点击来自「重试」:保持展开并重取,不把面板收起
      if (get().details[id]?.phase !== 'error') {
        set({ expandedId: null })
        return
      }
    } else {
      set({ expandedId: id })
    }
    if (get().details[id]?.phase === 'ready' || get().details[id]?.phase === 'loading') return
    set((s) => ({ details: { ...s.details, [id]: { phase: 'loading', error: '' } } }))
    try {
      const res = await getChatTurnChange(id)
      if (!get().open) return
      if (!res.success) throw new Error(res.error)
      set((s) => ({
        details: { ...s.details, [id]: { phase: 'ready', detail: res.data, error: '' } },
      }))
    } catch (e) {
      if (!get().open) return
      set((s) => ({
        details: { ...s.details, [id]: { phase: 'error', error: errorText(e) } },
      }))
    }
  },

  previewRewind: async (id) => {
    set((s) => ({ previews: { ...s.previews, [id]: { phase: 'loading', error: '' } } }))
    try {
      const result = await requestTurnChangeRewind(id, { dryRun: true })
      if (!get().open) return
      set((s) => ({ previews: { ...s.previews, [id]: { phase: 'ready', result, error: '' } } }))
    } catch (e) {
      if (!get().open) return
      set((s) => ({
        previews: { ...s.previews, [id]: { phase: 'error', error: errorText(e) } },
      }))
    }
  },

  confirmRewind: async (id) => {
    const preview = get().previews[id]
    // 实发的唯一前提:已有一次**成功**的 dry-run,且预演结果无冲突、状态为 ok
    // (按钮侧同判据 disabled;这里再判一次是因为键盘/二次触发也可能绕过按钮态)
    if (
      !preview ||
      preview.phase !== 'ready' ||
      preview.result?.dryRun !== true ||
      preview.result.status !== 'ok' ||
      (preview.result.conflicts ?? []).length > 0
    ) {
      return
    }
    set({ applyingId: id })
    try {
      const result = await requestTurnChangeRewind(id, { dryRun: false })
      if (!get().open) return
      set((s) => ({
        applyingId: null,
        previews: { ...s.previews, [id]: { phase: 'ready', result, error: '' } },
        items:
          result.status === 'ok'
            ? s.items.map((it) => (it.id === id ? { ...it, rewindStatus: 'rewound' as const } : it))
            : s.items,
      }))
    } catch (e) {
      if (!get().open) return
      set((s) => ({
        applyingId: null,
        previews: { ...s.previews, [id]: { phase: 'error', error: errorText(e) } },
      }))
    }
  },
}))
