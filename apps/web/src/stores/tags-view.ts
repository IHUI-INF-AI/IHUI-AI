import { create } from 'zustand'

export interface TagItem {
  path: string
  /**
   * 标签显示标题(已废弃派生字段)。
   *
   * 历史遗留:早期实现把 deriveTitle(pathname) 计算后的字符串存入 store,
   * 导致语言切换后已存在的标签无法重新翻译。
   *
   * 现已改为派生式:TagsView 在渲染时根据 path + 当前 locale 实时计算标题
   * (见 src/lib/path-labels.ts + TagsView.resolveTitle),完全忽略此字段。
   *
   * 保留为可选字段仅为向后兼容旧调用方;新代码不应再写入此字段。
   * @deprecated 改由 TagsView 渲染时派生,无需存储。
   */
  title?: string
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
  /**
   * 处于"固定(pinned)"状态的标签 path 集合(2026-07-31 立,Chrome 风格)。
   * - pinned 标签在渲染时自动挪到最左(pinned 区末尾),视觉上聚集成组
   * - closeAll 跳过 pinned 标签(防误关)
   * - 标签卡显示图钉图标 + 略亮背景色区分
   * - 操作入口:右键单个标签 → 固定/取消固定
   */
  pinnedPaths: ReadonlySet<string>
  addTag: (tag: TagItem) => void
  removeTag: (path: string) => void
  closeAll: () => void
  reorderTags: (fromIndex: number, toIndex: number) => void
  setDirty: (path: string, dirty: boolean) => void
  isDirty: (path: string) => boolean
  /** 切换标签的固定状态;pin 时自动挪到 pinned 区末尾(2026-07-31 新增) */
  togglePin: (path: string) => void
  isPinned: (path: string) => boolean
}

export const useTagsViewStore = create<TagsViewState>((set, get) => ({
  tags: [],
  activePath: null,
  dirtyPaths: new Set<string>(),
  pinnedPaths: new Set<string>(),
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
      // 标签关闭时同步清理脏状态 + pinned 状态,防止残留导致幽灵指示点 / 幽灵 pin
      let dirtyPaths = s.dirtyPaths
      if (s.dirtyPaths.has(path)) {
        const next = new Set(s.dirtyPaths)
        next.delete(path)
        dirtyPaths = next
      }
      let pinnedPaths = s.pinnedPaths
      if (s.pinnedPaths.has(path)) {
        const next = new Set(s.pinnedPaths)
        next.delete(path)
        pinnedPaths = next
      }
      return { tags, activePath, dirtyPaths, pinnedPaths }
    }),
  closeAll: () =>
    set((s) => {
      // 保留 pinned 标签(Chrome 风格,closeAll 不关 pinned)
      const tags = s.tags.filter((t) => s.pinnedPaths.has(t.path))
      const activePath = tags.length > 0
        ? (tags.some((t) => t.path === s.activePath) ? s.activePath : (tags[tags.length - 1]?.path ?? null))
        : null
      const survivorPaths = new Set(tags.map((t) => t.path))
      const dirtyPaths = new Set<string>()
      s.dirtyPaths.forEach((p) => {
        if (survivorPaths.has(p)) dirtyPaths.add(p)
      })
      return { tags, activePath, dirtyPaths }
    }),
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
  togglePin: (path) =>
    set((s) => {
      const nextPinned = new Set(s.pinnedPaths)
      const wasPinned = nextPinned.has(path)
      if (wasPinned) {
        // unpin:仅移除 pinned 标记,tags 顺序保持不变(停在当前位置)
        nextPinned.delete(path)
        return { pinnedPaths: nextPinned }
      }
      // pin:加标记 + 把 tag 挪到 pinned 区末尾(所有已 pinned 之后、非 pinned 之前)
      nextPinned.add(path)
      const target = s.tags.find((t) => t.path === path)
      if (!target) return { pinnedPaths: nextPinned }
      const pinnedTags = s.tags.filter((t) => t.path !== path && nextPinned.has(t.path))
      const nonPinnedTags = s.tags.filter((t) => t.path !== path && !nextPinned.has(t.path))
      return { pinnedPaths: nextPinned, tags: [...pinnedTags, target, ...nonPinnedTags] }
    }),
  isPinned: (path) => get().pinnedPaths.has(path),
}))
