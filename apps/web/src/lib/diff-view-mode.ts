// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * diff 视图模式的**唯一真相源**(V3 #66,2026-09-26 立)。
 *
 * 为什么单独建:此前只有 `useIDEWorkspace().diffViewMode` 一份,它既**不持久化**
 * (刷新即回到 `'split'`),也**只被 IDE 面板读** —— chat 里的 InlineDiffCard 自带一套
 * rows 渲染、没有档位概念。两个渲染面各存一份切换状态,正是"IDE 里切成并排、回到对话
 * 又变回单栏"的成因。本模块把状态收敛到一处,两个面都只读它。
 *
 * 关于 `attachViewModeMirror`:IDE 的切换按钮在 `diff-stats-bar.tsx` 里、状态存在
 * `useIDEWorkspace`,两者都不在本票可改范围内,而把按钮接成新真相源的写法属于另一票的
 * 收口。所以这里提供一个**单向语义、双向同步**的桥:真相源永远是本 store,mirror 只是
 * 让遗留 surface 显示与点击都仍然成立。桥的两个方向各由一个 re-entrancy 标志守住,
 * 不会出现「互相回写把对方盖掉」的抖动(由 diff-view-mode.test.ts 的循环保护用例钉死)。
 */

'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DiffViewMode } from '@ihui/types'

/** SSR / 无 window 环境下的安全 storage 兜底(与 stores/conversation-detail-mode 同模板) */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

/** 判定任意值是否为合法档位(读持久化数据 / 外部 mirror 时必须先过这一关) */
export function isDiffViewMode(value: unknown): value is DiffViewMode {
  return value === 'unified' || value === 'split'
}

interface DiffViewModeState {
  /** unified = 单栏行级;split = 左右两栏并排 */
  mode: DiffViewMode
  /** 三方合并面板是否展开(与 mode 正交:开着三方时 mode 只管两栏/单栏的两侧展示) */
  threeWayOpen: boolean
  setMode: (mode: DiffViewMode) => void
  toggleMode: () => void
  setThreeWayOpen: (open: boolean) => void
}

export const useDiffViewModeStore = create<DiffViewModeState>()(
  persist(
    (set, get) => ({
      mode: 'split',
      threeWayOpen: false,
      setMode: (mode) => {
        if (!isDiffViewMode(mode) || get().mode === mode) return
        set({ mode })
      },
      toggleMode: () => set({ mode: get().mode === 'split' ? 'unified' : 'split' }),
      setThreeWayOpen: (threeWayOpen) => {
        if (get().threeWayOpen === threeWayOpen) return
        set({ threeWayOpen })
      },
    }),
    {
      name: 'ihui-diff-view-mode',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      partialize: (s) => ({ mode: s.mode, threeWayOpen: s.threeWayOpen }),
    },
  ),
)

/** 当前档位(非响应式读法,给事件回调 / 判据用) */
export function getDiffViewMode(): DiffViewMode {
  return useDiffViewModeStore.getState().mode
}

/** 外部档位 surface 的适配面:读 / 写 / 订阅(IDE store 即其一个实现) */
export interface ViewModeMirror {
  get: () => DiffViewMode
  set: (mode: DiffViewMode) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * 把一个遗留档位 surface 接到唯一真相源上。返回解绑函数。
 *
 * 三条规则(每条各有一个用例钉住):
 *  1. 挂上即以**真相源为准**覆写 mirror —— 这样持久化值能盖掉 mirror 的硬编码默认值;
 *  2. mirror 自身变化(用户点了 IDE 的切换按钮)⇒ 采纳进真相源;
 *  3. 任一方向的写入都先置 re-entrancy 标志,**不回环**;标志必须在 finally 里复位,
 *     否则一次抛错就让桥永久失灵(失灵的表现永远是安静)。
 */
export function attachViewModeMirror(mirror: ViewModeMirror): () => void {
  let pushingToMirror = false
  let pushingToStore = false

  const pushToMirror = (mode: DiffViewMode): void => {
    pushingToMirror = true
    try {
      mirror.set(mode)
    } finally {
      pushingToMirror = false
    }
  }

  const adoptFromMirror = (): void => {
    if (pushingToMirror) return
    const next = mirror.get()
    if (!isDiffViewMode(next) || next === useDiffViewModeStore.getState().mode) return
    pushingToStore = true
    try {
      useDiffViewModeStore.getState().setMode(next)
    } finally {
      pushingToStore = false
    }
  }

  pushToMirror(useDiffViewModeStore.getState().mode)
  const offMirror = mirror.subscribe(adoptFromMirror)
  const offStore = useDiffViewModeStore.subscribe((state, prev) => {
    if (pushingToStore || state.mode === prev.mode) return
    pushToMirror(state.mode)
  })

  return () => {
    offMirror()
    offStore()
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
