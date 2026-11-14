// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按压态派生(rn-compat 内部原语,2026-11-14 补)。
 *
 * 立因:`Pressable` 的 `onPressIn` / `onPressOut` 在 `RNCompatProps` 里**声明了却从不派发**
 * —— compat View 只接 `onClick` / `onLongPress`,Taro 的小程序 View 也没有这两个事件。
 * 后果不是"少个按压态",而是三件真事同时失效:
 *   ① `ui-native` 的 Tappable(全仓 361 个调用点)靠 onPressIn/onPressOut 改内部 pressed,
 *      小程序端 pressed 恒 false ⇒ **整端按压反馈为 0**;
 *   ② 共享层的"按住说话"(ChatVoiceTurn / ChatComposer / SearchInput)靠同一对事件起停录音
 *      ⇒ 小程序端**按下去不开始、松手不结束**;
 *   ③ `style` / `children` 的函数形态只能按 `{pressed:false}` 求值一次。
 *
 * 这里的做法:把 Taro 的 `onTouchStart/onTouchEnd/onTouchCancel` 翻译成 RN 的
 * `onPressIn/onPressOut`,并驱动 `setPressed`。用**外部传入的 ref** 记"按下中"而不是闭包变量:
 * 组件每次 setPressed 都会重渲染、闭包会重建,用闭包变量会丢掉按下态,导致 onPressOut 永不触发。
 *
 * 语义差异(与 RN 原生 Pressable 不等价,不假装全等):
 *  - 手指按下后**滑出**元素:小程序仍在该节点上收到 touchend(或 touchcancel)⇒ 会补一次 onPressOut;
 *    RN 在滑出时也会先给 onPressOut,行为接近,但不是同一条原生通道。
 *  - 多指:第一个触点按下才置 pressed,后续触点不重复派发 onPressIn。
 *  - `disabled` 时整条链路不响应(RN 的 Pressable 在 disabled 下同样不产生 press 事件)。
 */
import type { GestureResponderEvent } from './index'

type PressHandler = ((e: GestureResponderEvent) => void) | undefined

export interface PressHandlers {
  onTouchStart: (e: GestureResponderEvent) => void
  onTouchEnd: (e: GestureResponderEvent) => void
  onTouchCancel: (e: GestureResponderEvent) => void
}

export interface PressHandlerDeps {
  /** 必须由调用方用 useRef 持有:跨渲染存活的"按下中"标记 */
  down: { current: boolean }
  disabled?: boolean
  onPressIn?: PressHandler
  onPressOut?: PressHandler
  setPressed: (pressed: boolean) => void
}

export function createPressHandlers(deps: PressHandlerDeps): PressHandlers {
  const { down, disabled, onPressIn, onPressOut, setPressed } = deps
  const start = (e: GestureResponderEvent) => {
    if (disabled === true || down.current) return
    down.current = true
    setPressed(true)
    onPressIn?.(e)
  }
  const end = (e: GestureResponderEvent) => {
    if (!down.current) return
    down.current = false
    setPressed(false)
    onPressOut?.(e)
  }
  return { onTouchStart: start, onTouchEnd: end, onTouchCancel: end }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
