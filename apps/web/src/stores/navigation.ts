// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { create } from 'zustand'

interface NavigationState {
  /** 导航是否正在进行中 */
  pending: boolean
  /** 标记导航开始（点击链接时立即触发） */
  start: () => void
  /** 标记导航结束（新页面渲染完成后触发） */
  end: () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  pending: false,
  start: () => set({ pending: true }),
  end: () => set({ pending: false }),
}))

/**
 * 乐观导航高亮 store(2026-09-13 性能重构)
 *
 * 背景(实测):点击侧栏链接的同步批内,旧实现 `setPendingHref(href)` 是 Sidebar 的 React state,
 * 会重渲染整棵侧栏(97 个导航项 + 分组 + 快捷区 + 历史列表),实测给 click→pushState 增加
 * 82ms;与 `startNav()` 叠加后首帧同步长任务达 94ms(A/B 四模式实测:
 * both 331ms / 仅 startNav 256ms / 仅 pendingHref 253ms / 均无 171ms)。
 *
 * 根治:把"乐观高亮"从组件 state 下沉为 store,由**叶子项自己**用布尔选择器订阅。
 * zustand 按选择器输出做相等比较,因此一次点击只有"旧激活项"与"新目标项"两个叶子的
 * 选择器结果发生变化 → 只有 2 个叶子重渲染,Sidebar 本体零重渲染。
 *
 * 关键约束:选择器必须返回**布尔/值语义稳定**的结果,绝不能直接返回 `s.href`
 * (那会让全部 97 个订阅者在每次导航时都变化,退化成全量重渲染)。
 */
interface OptimisticNavState {
  /** 正在导航去往的目标 href;null 表示当前无乐观导航 */
  href: string | null
  set: (href: string) => void
  clear: () => void
}

export const useOptimisticNavStore = create<OptimisticNavState>((set) => ({
  href: null,
  set: (href) => set({ href }),
  // 已为 null 时返回同一 state 引用,避免无意义通知
  clear: () => set((s) => (s.href === null ? s : { href: null })),
}))

/**
 * 带全局导航反馈的 router.push 封装（2026-09-02 第三刀）：
 * 跨页导航前触发全局进度条 + 内容区延迟骨架（GlobalShell），与侧栏 NavLink 反馈一致。
 * 同页导航（href === pathname）跳过 start — Next 会拒绝相同导航，pathname 不变导致
 * NavigationProgress 的 end() 无法触发，pending 只能等兜底定时器（原骨架屏卡 10s 的根因）。
 * 适用：布局级导航入口（标签栏 / 顶栏 / 命令面板 / 侧栏辅助入口）；
 * 功能内跳转（登录流程、详情页动作等）仍直接用 router.push，避免误报加载态。
 */
export function useNavigateWithProgress() {
  const router = useRouter()
  const pathname = usePathname()
  const start = useNavigationStore((s) => s.start)
  return React.useCallback(
    (href: string) => {
      if (href !== pathname) start()
      router.push(href)
    },
    [router, pathname, start],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
