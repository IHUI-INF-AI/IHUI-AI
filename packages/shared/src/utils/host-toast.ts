// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全局轻提示通道(跨端共享实现,M4 B1;2026-11-04 由 apps/mobile-rn/src/host/host-toast 下沉)。
 *
 * 共享屏只消费 `OnToast` 端口,不知道各端用哪种载体出图;本模块是两端唯一中转:
 * 任意屏调用 `showHostToast`,由各端 `HostToastLayer` 单点渲染,避免每个壳各自维护一份 toast 态。
 * fire-and-forget:本函数不抛错、不返回 Promise(见 app-host-ports.ts 的 OnToast 契约)。
 */
import type { ToastKind } from '@ihui/types'

type HostToastListener = (message: string, kind: ToastKind, duration?: number) => void

let listener: HostToastListener | null = null

/**
 * 轻提示默认存活时长(ms)—— **「用户提示」能力族的唯一时长真相源**(2026-11-05 立,2026-11 收口到 4000)。
 *
 * 立因(初版三处各写一份,同一条 `onToast(text)` 在三处时长互不相等):
 *   · `apps/miniapp-taro/src/host/on-toast.ts` 端口层写 1500(对齐 `Taro.showToast` 端内默认);
 *   · `apps/miniapp-taro/src/host/HostToastLayer.tsx` 渲染层写 2000(共享屏提示走这一条);
 *   · `apps/mobile-rn/src/components/FloatBox.tsx` 兜底 3000(RN 侧共享屏提示走这一条)。
 * ⇒ 同一枚屏、同一次提示三端各一数,正是「RN 改一处、小程序随源头同动」要消灭的东西。
 *
 * 2026-11 收口到 **4000** 的唯一依据 = 对齐 web 端 `sonner` 的 `duration={4000}`(主流 AI IDE
 * 通知默认值,比 sonner 默认 3s 多 1s 保证可读)。RN 与小程序的共享屏轻提示现在**统一取这一枚
 * 单源**,与 web 同节奏;web 本身走 sonner 自带 4s,故三端视觉一致。显式传入的 `duration`
 * 一律原样透传,本常量只在**未给时长**时兜底。改这一枚数即同时动三端,无需在各端另留副本。
 */
export const HOST_TOAST_DEFAULT_DURATION_MS = 4000

/**
 * `__DEV__` 由宿主注入(RN 全局 / Taro defineConstants);本模块已下沉到 shared,
 * 不在 RN 的全局类型声明面内,故做模块内声明,运行时仍用 `typeof` 探测后再读取。
 */
declare const __DEV__: boolean
const isDev = typeof __DEV__ !== 'undefined' && __DEV__

/** 渲染层未挂载时的落点:dev 明确记录,prod 静默丢弃(轻提示不是关键路径)。 */
export function showHostToast(
  message: string,
  options?: { kind?: ToastKind; duration?: number },
): void {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) {
    if (isDev) console.warn('[host-toast] 收到空白文案,已丢弃')
    return
  }
  if (listener) {
    // 时长只在这一格兜底(唯一真相源):两端渲染层不得再各自补自己的默认值,
    // 否则「同一条提示在不同端活多久」又会回到三份。
    listener(text, options?.kind ?? 'info', options?.duration ?? HOST_TOAST_DEFAULT_DURATION_MS)
    return
  }
  if (isDev) console.warn('[host-toast] 渲染层未挂载,轻提示被丢弃:', text)
}

export function subscribeHostToast(fn: HostToastListener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
