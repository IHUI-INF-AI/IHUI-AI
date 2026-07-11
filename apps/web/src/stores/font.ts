import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface FontInfo {
  family: string
  displayName: string
  category?: string
}

interface FontState {
  /** 当前选中字体族 */
  family: string
  /** 字号（px） */
  size: number
  /** 行高倍率 */
  lineHeight: number
  /** 已加载的字体列表 */
  loadedFonts: FontInfo[]
  setFamily: (family: string) => void
  setSize: (size: number) => void
  setLineHeight: (lineHeight: number) => void
  addLoadedFont: (font: FontInfo) => void
  reset: () => void
}

/** 字体管理 Store，持久化字体偏好并应用到根元素 */
export const useFontStore = create<FontState>()(
  persist(
    (set) => ({
      family: 'system-ui',
      size: 16,
      lineHeight: 1.6,
      loadedFonts: [],

      setFamily: (family) => {
        set({ family })
        applyFont()
      },
      setSize: (size) => {
        set({ size })
        applyFont()
      },
      setLineHeight: (lineHeight) => {
        set({ lineHeight })
        applyFont()
      },
      addLoadedFont: (font) =>
        set((s) =>
          s.loadedFonts.some((f) => f.family === font.family)
            ? s
            : { loadedFonts: [...s.loadedFonts, font] },
        ),
      reset: () => {
        set({ family: 'system-ui', size: 16, lineHeight: 1.6 })
        applyFont()
      },
    }),
    {
      name: 'ihui-font',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      onRehydrateStorage: () => () => applyFont(),
    },
  ),
)

/** 将字体偏好应用到 document.documentElement */
function applyFont() {
  if (typeof document === 'undefined') return
  const s = useFontStore.getState()
  const root = document.documentElement
  root.style.fontFamily = s.family
  root.style.fontSize = `${s.size}px`
  root.style.lineHeight = String(s.lineHeight)
}
