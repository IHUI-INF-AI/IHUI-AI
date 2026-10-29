// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @ihui/shared/stores/quick-notes-store — 会话内快捷笔记 zustand 工厂(D03 文字纵切片)
 *
 * 设计(与 createThemeStore 同款):
 * 1. 工厂 + 平台 adapter 注入:持久化只依赖 PersistTransport(各端注入 AsyncStorage/Taro.storage/memory),
 *    本文件零平台 API、零 node: 内建(守门 126)。
 * 2. 语音/转写(12 phase 状态机)不在本 store —— 那是 D03 后续批,此处不做也不 stub。
 * 3. 纯函数 filterQuickNotes / composeInsertText 独立导出,供两侧真值表与插入通道复用;
 *    插入对话 = 宿主端把 composeInsertText 结果喂给既有输入框 setState 通道,不另开事件总线。
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand/react'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { PersistTransport } from './transport'

/** 快捷笔记实体(文字纵切片):标题/正文/分组/归档态/时间戳 */
export interface QuickNote {
  id: string
  title: string
  content: string
  /** 分组(可空串 = 未分组) */
  group: string
  archived: boolean
  createdAt: number
  updatedAt: number
}

export interface QuickNoteCreateInput {
  title: string
  content: string
  group?: string
}

export type QuickNotePatch = Partial<Pick<QuickNote, 'title' | 'content' | 'group' | 'archived'>>

export interface QuickNotesState {
  notes: QuickNote[]
  createNote: (input: QuickNoteCreateInput) => QuickNote
  updateNote: (id: string, patch: QuickNotePatch) => void
  removeNote: (id: string) => void
  setArchived: (id: string, archived: boolean) => void
}

export interface CreateQuickNotesStoreOptions {
  /** 持久化 transport(各端注入) */
  transport: PersistTransport
  /** storage key,默认 'ihui-quick-notes' */
  persistKey?: string
  /** persist version,默认 1 */
  version?: number
  /** 时钟注入(测试确定性;默认 Date.now) */
  now?: () => number
  /** id 生成注入(测试确定性;默认 时间戳+随机) */
  newId?: (now: number) => string
}

export interface CreatedQuickNotesStore {
  useQuickNotesStore: {
    (): QuickNotesState
    <U>(selector: (state: QuickNotesState) => U): U
    getState: () => QuickNotesState
    setState: StoreApi<QuickNotesState>['setState']
    subscribe: StoreApi<QuickNotesState>['subscribe']
  }
  getState: () => QuickNotesState
  setState: StoreApi<QuickNotesState>['setState']
  subscribe: StoreApi<QuickNotesState>['subscribe']
  /** 手动触发重水合(测试/登出后刷新用) */
  rehydrate: () => Promise<void> | void
}

function defaultNewId(now: number): string {
  return `qn-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createQuickNotesStore(
  options: CreateQuickNotesStoreOptions,
): CreatedQuickNotesStore {
  const {
    transport,
    persistKey = 'ihui-quick-notes',
    version = 1,
    now = () => Date.now(),
    newId = defaultNewId,
  } = options

  const persistStorage: StateStorage = {
    getItem: (name) => transport.getItem(name),
    setItem: (name, value) => transport.setItem(name, value),
    removeItem: (name) => transport.removeItem(name),
  }

  // storeApi 在下方声明,闭包引用(运行时已初始化);显式类型防 notes 被推断成 never[]
  const initialState: QuickNotesState = {
    notes: [],
    createNote: (input) => {
      const ts = now()
      const note: QuickNote = {
        id: newId(ts),
        title: input.title,
        content: input.content,
        group: input.group ?? '',
        archived: false,
        createdAt: ts,
        updatedAt: ts,
      }
      storeApi.setState((s) => ({ notes: [note, ...s.notes] }))
      return note
    },
    updateNote: (id, patch) => {
      const ts = now()
      storeApi.setState((s) => ({
        notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: ts } : n)),
      }))
    },
    removeNote: (id) => {
      storeApi.setState((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
    },
    setArchived: (id, archived) => {
      const ts = now()
      storeApi.setState((s) => ({
        notes: s.notes.map((n) => (n.id === id ? { ...n, archived, updatedAt: ts } : n)),
      }))
    },
  }

  const storeApi = createStore<QuickNotesState>()(
    persist(() => initialState, {
      name: persistKey,
      storage: createJSONStorage(() => persistStorage),
      version,
    }),
  )

  const useBoundStore = Object.assign(
    function useQuickNotesStoreHook<U>(selector?: (state: QuickNotesState) => U): U {
      return useStore(storeApi, selector as (state: QuickNotesState) => U)
    } as CreatedQuickNotesStore['useQuickNotesStore'],
    {
      getState: storeApi.getState,
      setState: storeApi.setState,
      subscribe: storeApi.subscribe,
    },
  )

  return {
    useQuickNotesStore: useBoundStore,
    getState: storeApi.getState,
    setState: storeApi.setState,
    subscribe: storeApi.subscribe,
    rehydrate: () => storeApi.persist.rehydrate(),
  }
}

// ── 纯函数判据(两侧复用,测试直测) ──

export interface QuickNoteFilter {
  /** 关键词:命中标题/正文/分组,大小写不敏感 */
  query?: string
  /** 分组精确过滤(非空才生效) */
  group?: string
  /** 默认隐藏已归档 */
  includeArchived?: boolean
}

/** 列表过滤:归档过滤 → 分组过滤 → 关键词过滤,updatedAt 倒序(最近改动在前) */
export function filterQuickNotes(notes: QuickNote[], filter: QuickNoteFilter = {}): QuickNote[] {
  const { query = '', group = '', includeArchived = false } = filter
  const q = query.trim().toLowerCase()
  return notes
    .filter((n) => (includeArchived ? true : !n.archived))
    .filter((n) => (group ? n.group === group : true))
    .filter((n) => {
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.group.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * 会话输入框插入拼接(与 D43③ NotesPanel 的 setPrompt 通道同口径):
 * 现有内容非空时换行追加,空时直接落文本。
 */
export function composeInsertText(current: string, text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return current
  return current ? `${current}\n${trimmed}` : trimmed
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
