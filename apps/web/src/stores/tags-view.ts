import { create } from 'zustand'

export interface TagItem {
  path: string
  title: string
  query?: Record<string, string>
}

interface TagsViewState {
  tags: TagItem[]
  activePath: string | null
  /**
   * 处于"未保存"状态的标签 path 集合。
   * 由各业务页面通过 useTagDirty(path, dirty) 主动声明,
   * 关闭/重排时自动清理,避免脏状态残留。
   */
  dirtyPaths: ReadonlySet<string>
  addTag: (tag: TagItem) => void
  removeTag: (path: string) => void
  closeOther: (path: string) => void
  closeAll: () => void
  reorderTags: (fromIndex: number, toIndex: number) => void
  setDirty: (path: string, dirty: boolean) => void
  isDirty: (path: string) => boolean
}

export const useTagsViewStore = create<TagsViewState>((set, get) => ({
  tags: [],
  activePath: null,
  dirtyPaths: new Set<string>(),
  addTag: (tag) =>
    set((s) => {
      if (s.tags.some((t) => t.path === tag.path)) return { activePath: tag.path }
      return { tags: [...s.tags, tag], activePath: tag.path }
    }),
  removeTag: (path) =>
    set((s) => {
      const tags = s.tags.filter((t) => t.path !== path)
      const activePath =
        s.activePath === path ? (tags[tags.length - 1]?.path ?? null) : s.activePath
      // 标签关闭时同步清理脏状态,防止残留导致幽灵指示点
      let dirtyPaths = s.dirtyPaths
      if (s.dirtyPaths.has(path)) {
        const next = new Set(s.dirtyPaths)
        next.delete(path)
        dirtyPaths = next
      }
      return { tags, activePath, dirtyPaths }
    }),
  closeOther: (path) =>
    set((s) => {
      const tags = s.tags.filter((t) => t.path === path)
      // 仅保留目标 path 的脏状态
      const dirtyPaths = s.dirtyPaths.has(path) ? new Set([path]) : new Set<string>()
      return { tags, activePath: path, dirtyPaths }
    }),
  closeAll: () => set({ tags: [], activePath: null, dirtyPaths: new Set() }),
  reorderTags: (fromIndex, toIndex) =>
    set((s) => {
      // 边界守卫:无操作 / 越界直接 return 保持原状
      if (fromIndex === toIndex) return s
      if (fromIndex < 0 || fromIndex >= s.tags.length) return s
      if (toIndex < 0 || toIndex >= s.tags.length) return s
      const next = s.tags.slice()
      const [moved] = next.splice(fromIndex, 1)
      // 边界守卫:noUncheckedIndexedAccess 下 moved 为 TagItem | undefined
      // 理论上 fromIndex 已校验过,这里只是消除 TS 错误并补防御
      if (!moved) return s
      next.splice(toIndex, 0, moved)
      return { tags: next }
    }),
  setDirty: (path, dirty) =>
    set((s) => {
      const has = s.dirtyPaths.has(path)
      if (dirty && has) return s
      if (!dirty && !has) return s
      const next = new Set(s.dirtyPaths)
      if (dirty) next.add(path)
      else next.delete(path)
      return { dirtyPaths: next }
    }),
  isDirty: (path) => get().dirtyPaths.has(path),
}))
