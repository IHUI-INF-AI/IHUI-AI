// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-1#4 tab+filter 同居状态归约(tab 变 filter 重置)。
 *
 * 上游出处 zcode packages/ui/src/settings/automationStatusFilter.ts:1-82、
 * AutomationsSection.tsx:586-603。
 *
 * 机制:tab 与筛选同居一个状态对象,所有 setTab 经 resolveTabState 归约:
 *  - tab 未变返回原引用(Object.is 防渲染抖动);
 *  - tab 变更后 filter 重置为默认,杜绝"切走再切回带着旧筛选误判空列表"。
 *
 * 纯函数,React 调用方把 setTab 的 updater 包一层 resolveTabState 即可。
 */

export interface TabFilterState<TTab, TFilter> {
  tab: TTab
  filter: TFilter
}

/**
 * 归约 tab+filter 同居状态。
 *
 * @param prev 上一次状态
 * @param nextTab 目标 tab(可为值或函数式更新)
 * @param defaultFilter filter 重置目标值
 * @returns 新状态;若 tab 未变则返回 prev 原引用
 */
export function resolveTabState<TTab, TFilter>(
  prev: TabFilterState<TTab, TFilter>,
  nextTab: TTab | ((prev: TTab) => TTab),
  defaultFilter: TFilter,
): TabFilterState<TTab, TFilter> {
  const target = typeof nextTab === 'function' ? (nextTab as (p: TTab) => TTab)(prev.tab) : nextTab
  if (target === prev.tab) return prev
  return { tab: target, filter: defaultFilter }
}

/**
 * 仅更新 filter(不改 tab)。返回新对象(因为 filter 变了),tab 保持。
 */
export function resolveFilterState<TTab, TFilter>(
  prev: TabFilterState<TTab, TFilter>,
  nextFilter: TFilter | ((prev: TFilter) => TFilter),
): TabFilterState<TTab, TFilter> {
  const target =
    typeof nextFilter === 'function'
      ? (nextFilter as (p: TFilter) => TFilter)(prev.filter)
      : nextFilter
  if (target === prev.filter) return prev
  return { ...prev, filter: target }
}

