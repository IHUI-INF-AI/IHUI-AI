// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


'use client'

// agent 执行引擎模式 web store(2026-11-15,阶段 3 接线第 ① 片)。
//
// 职责:web 端 UI 的 engine-mode 状态源(localStorage 持久化),并在用户切换时
// 同步到 shared 的全局单例 store。为什么需要桥接见下方 setMode 注释(§单一真相源)。
//
// 复用 web 现有 persist 工厂 createPersistConfig(localStorage + SSR 降级 noop),
// 与 archive-prefs / code-block-prefs 同层惯例,不造第二套存储机制。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  isEngineMode,
  setGlobalEngineMode,
  type EngineMode,
} from '@ihui/shared'
import { createPersistConfig } from './persist-helpers'

interface EngineModeState {
  /** 用户选择的引擎模式(默认 auto = 现状,零回归) */
  mode: EngineMode
  setMode: (m: EngineMode) => void
}

export const useEngineModeStore = create<EngineModeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode) => {
        // 容错:非法值回退 auto(与 shared store 的 setMode 同判据)。
        const next = isEngineMode(mode) ? mode : 'auto'
        set({ mode: next })
        // §单一真相源桥接(关键):
        // use-agent-stream.ts 等非 React 消费点读的是 shared 的 getGlobalEngineMode()
        // (内存单例,无持久化)。UI 只写本 store 的话,非 React 侧永远读不到用户选择。
        // 所以这里双写:本 store(UI 渲染 + 持久化)+ 全局单例(非 React 解析)。
        setGlobalEngineMode(next)
      },
    }),
    createPersistConfig<EngineModeState>(
      'ihui-engine-mode',
      (s) => ({ mode: s.mode }),
      // §rehydrate 同步桥接(2026-11-15):
      // 页面刷新时 React store 从 localStorage 恢复用户上次选的模式,但 getGlobalEngineMode()
      // 的内存单例停在默认 'auto' —— 不桥接会出现「UI 显示本地、实际执行走云端」错位。
      // 用 onRehydrateStorage(**在 hydration 开始前注册**,能收到回调);不用 onFinishHydration
      // —— 探针实测 store 在模块求值时 hydration 已完成(hasHydrated=true),那时再挂
      // onFinishHydration 会错过回调。
      undefined,
      () => (rehydrated: EngineModeState | undefined) => {
        if (rehydrated && isEngineMode(rehydrated.mode)) {
          setGlobalEngineMode(rehydrated.mode)
        }
      },
    ),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
