// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef } from 'react'

/**
 * 「回到该屏 / 应用回前台 ⇒ 重新取数」的共享层唯一实现(票 L30756)。
 *
 * 为什么需要它:RN 壳的取数写在 `useEffect(…, [])`(仅挂载一次),而小程序手写页普遍用
 * `Taro.useDidShow` 每次回到页面都刷新 —— 同一件事两种写法,41 枚页转承载时会被判丢功能。
 * 本 hook 把"重新可见就跑一次"固化成一处;平台原语(导航焦点 / AppState / 小程序 show)
 * 由 **adapter** 注入(AGENTS §3:平台差异走 adapter,禁止 `Platform.OS` 分支进共享层)。
 *
 * 语义(与 RN 端内旧实现 `apps/mobile-rn/src/hooks/use-refresh-on-focus.ts` 逐条对齐):
 *  - **首次挂载跳过**:首屏数据由各壳既有的 `useEffect` 负责,不跳会在同一秒打两次请求;
 *  - 只认"重新可见"事件,不认"卸载"事件。
 *
 * 旧实现没有的一维:应用从后台回前台也触发,但**只在该屏自身可见时**(`visible` 守卫)——
 * 否则栈下被覆盖的屏会在每次回前台时偷偷重取。
 */

/** 平台原语注入面。两个信号都是"发生了"事件,不是"当前状态"查询。 */
export interface ScreenReappearAdapter {
  /**
   * 订阅"本屏重新可见"。**挂载时也必须派发一次 `focused=true`**(RN 的 `useFocusEffect` 既如此),
   * 这样"首次挂载跳过"才有统一计数点;屏失焦/卸载时派发 `focused=false`。
   * 必须是 hook(渲染期无条件调用),实现方自行保证回调身份稳定。
   */
  useScreenFocusEffect: (onFocusChange: (focused: boolean) => void) => void
  /** 订阅"应用回到前台"。非 hook;返回取消订阅函数。缺省 ⇒ 不监听(如 web/no-op 档)。 */
  subscribeAppActive?: (onActive: () => void) => () => void
}

/**
 * 平台无焦点/回前台原语时的兜底:不派发任何信号 = 行为与"只有挂载取数"完全一致。
 * 绝不伪造事件 —— 伪造会让"没接"看起来像"接了"(§0.9)。
 */
export const NOOP_SCREEN_REAPPEAR_ADAPTER: ScreenReappearAdapter = {
  useScreenFocusEffect: () => {},
}

/**
 * @param adapter 平台原语。**必填**:漏传会静默什么都不发生,不给默认值。
 * @param onReappear 重新取数回调,须稳定引用(端侧通常就是已有的 load / refresh)。
 */
export function useScreenReappear(adapter: ScreenReappearAdapter, onReappear: () => void): void {
  const armed = useRef(false)
  const visible = useRef(false)

  const onFocusChange = useCallback(
    (focused: boolean) => {
      visible.current = focused
      if (!focused) return
      if (!armed.current) {
        armed.current = true
        return
      }
      onReappear()
    },
    [onReappear],
  )

  adapter.useScreenFocusEffect(onFocusChange)

  const subscribeAppActive = adapter.subscribeAppActive
  useEffect(() => {
    if (!subscribeAppActive) return undefined
    return subscribeAppActive(() => {
      if (!visible.current) return
      onReappear()
    })
  }, [subscribeAppActive, onReappear])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
