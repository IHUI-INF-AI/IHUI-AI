// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** 单个版本快照 */
export interface CanvasVersion {
  content: string
  savedAt: number
  label?: string
}

/** 版本历史上限(超出裁剪最旧) */
const MAX_VERSIONS = 50

interface CanvasState {
  /** 画布(全屏 overlay)是否打开 */
  open: boolean
  /** 是否全屏(预留给 artifact-canvas 卡片内嵌全屏态) */
  fullscreen: boolean
  /** 当前画布内容(iframe srcDoc / 源码编辑的双向源) */
  content: string
  /** 画布标题(artifact name / type) */
  title: string
  /** 版本历史(新版本 unshift 到头部) */
  versions: CanvasVersion[]

  /** 打开画布:写入内容 + 首版入史(与末版相同则去重) */
  openCanvas: (content: string, title?: string) => void
  closeCanvas: () => void
  toggleFullscreen: () => void
  setFullscreen: (v: boolean) => void
  /** 更新当前内容(编辑「应用并刷新预览」) */
  setContent: (content: string) => void
  /** 追加一版(与末版相同去重,上限 50) */
  pushVersion: (content: string, label?: string) => void
  /** 回退到指定版本(内容 + 版本栈同步) */
  revertToVersion: (index: number) => void
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      open: false,
      fullscreen: false,
      content: '',
      title: '',
      versions: [],

      openCanvas: (content, title) => {
        const { versions } = get()
        const deduped =
          versions.length > 0 && versions[0]!.content === content
            ? versions
            : [{ content, savedAt: Date.now() }, ...versions].slice(0, MAX_VERSIONS)
        set({
          open: true,
          content,
          title: title ?? '',
          versions: deduped,
        })
      },
      closeCanvas: () => set({ open: false, fullscreen: false }),
      toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
      setFullscreen: (v) => set({ fullscreen: v }),
      setContent: (content) => set({ content }),
      pushVersion: (content, label) => {
        const { versions } = get()
        if (versions.length > 0 && versions[0]!.content === content) return
        set({
          versions: [{ content, savedAt: Date.now(), label }, ...versions].slice(0, MAX_VERSIONS),
        })
      },
      revertToVersion: (index) => {
        const { versions } = get()
        const target = versions[index]
        if (!target) return
        set({ content: target.content, open: true })
      },
    }),
    {
      ...createPersistConfig<CanvasState>('ihui-canvas', (s) => ({
        content: s.content,
        title: s.title,
        versions: s.versions.slice(0, MAX_VERSIONS),
      })),
    },
  ),
)
