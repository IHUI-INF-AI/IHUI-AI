import { create } from 'zustand'

export interface TagItem {
  path: string
  title: string
  query?: Record<string, string>
}

interface TagsViewState {
  tags: TagItem[]
  activePath: string | null
  addTag: (tag: TagItem) => void
  removeTag: (path: string) => void
  closeOther: (path: string) => void
  closeAll: () => void
}

export const useTagsViewStore = create<TagsViewState>((set) => ({
  tags: [],
  activePath: null,
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
      return { tags, activePath }
    }),
  closeOther: (path) =>
    set((s) => ({
      tags: s.tags.filter((t) => t.path === path),
      activePath: path,
    })),
  closeAll: () => set({ tags: [], activePath: null }),
}))
