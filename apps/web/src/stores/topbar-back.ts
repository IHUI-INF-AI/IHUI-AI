// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { create } from 'zustand'

/**
 * topbar-back — 统一返回键注册中心(2026-09-08 立)
 *
 * 背景(用户需求):右侧工作展示区内所有页面的返回键彻底统一收敛到 GlobalTopBar
 * 顶栏「搜索按钮右侧、加号左侧」的单一位置,带拉出/收起动画;
 * 页面没有且不需要返回按钮时动画取消返回按钮显示。
 *
 * 机制:
 * - 页面(或页内子视图)通过 `useTopBarBack(config)` 声明"当前需要返回键",
 *   组件卸载或声明撤回时自动清除,顶栏返回按钮随之动画收起。
 * - 全站唯一渲染点 = GlobalTopBar 内的 TopBarBackButton,页面内禁止再渲染
 *   任何内联返回按钮(common/BackButton 已改为纯注册器,不再渲染 DOM)。
 * - 单槽位设计(工作区同一时刻只渲染一个路由页面),后注册覆盖先注册;
 *   clearConfig 按引用比对,避免多声明方卸载时误清他人的注册。
 */

export interface TopBarBackConfig {
  /** 无浏览器历史(直接打开/新标签页)时的降级路由,默认 '/' */
  fallbackHref?: string
  /** 自定义返回动作(如页内"详情视图 → 列表视图");提供时优先于 router.back() */
  onBack?: () => void
}

interface TopBarBackState {
  /** 当前生效的返回配置;null = 顶栏不显示返回按钮 */
  config: TopBarBackConfig | null
  setConfig: (config: TopBarBackConfig) => void
  clearConfig: (config: TopBarBackConfig) => void
}

export const useTopBarBackStore = create<TopBarBackState>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
  clearConfig: (config) => set((s) => (s.config === config ? { config: null } : s)),
}))

/**
 * 页面级返回键声明 hook:
 * - config 非 null:挂载时注册,卸载/config 引用变化时清理旧的再注册新的
 * - config 为 null:不注册(未声明的组件返回 null 即可,无需条件调用)
 */
export function useTopBarBack(config: TopBarBackConfig | null) {
  const setConfig = useTopBarBackStore((s) => s.setConfig)
  const clearConfig = useTopBarBackStore((s) => s.clearConfig)
  React.useEffect(() => {
    if (!config) return
    setConfig(config)
    return () => clearConfig(config)
  }, [config, setConfig, clearConfig])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
