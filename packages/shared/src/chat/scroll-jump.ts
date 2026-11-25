// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话流「跳顶 / 跳到最新」显隐判据(D3 阈值档,2026-11-26 提升为三端唯一真相源)。
 *
 * 为什么住在这里:此前这条判据只在 web 的消息列表组件里有一份,RN 与小程序要接同一交互
 * 就只能各抄一份数值 —— 抄一份就会漂(AGENTS §0.6)。形态与 `stream-follow` 同族:
 * 判据只此一处,各端只负责"怎么拿到滚动几何"和"画成什么按钮"。
 *
 * 零平台 API、零文案:本文件不 import react / react-native / @tarojs / i18n,
 * 因此可被任何宿主直接消费,也不需要新增任何词包条目(标签由各端现有键承担)。
 */

/** 距顶/距底超过该阈值才显示对应按钮(任务 D3 定档 800px;三端同值)。 */
export const JUMP_FAR_THRESHOLD = 800

/** 滚动几何(与 web 侧 `ScrollMetrics` 同形:内容高 / 视口高 / 当前位)。 */
export interface ScrollJumpGeometry {
  readonly scrollTop: number
  readonly contentHeight: number
  readonly viewportHeight: number
}

export interface JumpVisibility {
  isFarFromTop: boolean
  isFarFromBottom: boolean
}

/**
 * 由滚动几何量计算两枚按钮的显隐。
 *
 *  - isFarFromTop    = scrollTop > threshold
 *  - isFarFromBottom = max(0, contentHeight - viewportHeight - scrollTop) > threshold
 *
 * 距底算法与 web `scroll-authority.ts` 的 `distanceToBottom()` 逐字同式(内容不足一屏时取 0),
 * 这样"是否该亮跳到最新"与"是否算贴底"读的是同一个距离,不会出现两把尺子。
 *
 * 纪律:纯函数,不读 DOM、不接事件对象 —— 各端的事件形状差异(RN 原生 contentOffset /
 * 小程序 detail / web scroll 事件)由调用方折算成这三个数后传入,折算本身不归本文件管。
 *
 * fail-closed:负 scrollTop(移动端弹性回弹会真出现)按 0 记账,不得把"在顶部"判成"远离顶部";
 * NaN/Infinity/非正尺寸一律判不亮 —— 坏读数不允许渲染成可点按钮。
 */
export function computeJumpVisibility(
  geometry: ScrollJumpGeometry,
  threshold: number = JUMP_FAR_THRESHOLD,
): JumpVisibility {
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const scrollTop = Math.max(0, num(geometry.scrollTop))
  const contentHeight = Math.max(0, num(geometry.contentHeight))
  const viewportHeight = Math.max(0, num(geometry.viewportHeight))
  const distanceFromBottom = Math.max(0, contentHeight - viewportHeight - scrollTop)
  return {
    isFarFromTop: scrollTop > threshold,
    isFarFromBottom: distanceFromBottom > threshold,
  }
}

/**
 * 「跳到最新」是否需要显示(与 web 现行为逐字一致)。
 *
 * 用户主动上滚(不限距离)与"距底超阈值"任一成立即需要 —— 真在底部时恒不显示,
 * 避免盖在输入区上方的一枚无用按钮。
 */
export function shouldShowJumpLatest(
  visibility: Pick<JumpVisibility, 'isFarFromBottom'>,
  userScrolledUp: boolean,
  hasMessages: boolean,
): boolean {
  return hasMessages && (visibility.isFarFromBottom || userScrolledUp)
}

/**
 * 各端滚动事件 → 几何量折算的唯一收口。
 *
 * 为什么也住在这里:`computeJumpVisibility` 只吃几何,而「从事件里把几何掏出来」本身就是
 * 一件会在三端各写一遍然后各漂一遍的事(web 已为 top 立过 `readScrollEventTop` 的同型收口)。
 * 取不到的字段给 null 而不是 0 —— 缺读数必须显式,否则「读不到」会被判成「距离为 0」
 * 而永远不亮按钮(§0.3:取不到不记绿也不冒红)。
 *
 *  - RN / web ScrollView:nativeEvent.contentOffset.y + contentSize.height + layoutMeasurement.height
 *  - 小程序 Taro:detail.scrollTop + detail.scrollHeight,而视口高 detail 不供给 ⇒ viewportHeight=null,
 *    该端因此不能靠几何判距底,须改用 stream-follow 的用户上滚意图(调用方负责,见 ChatMessageList)。
 */
export interface ScrollJumpReading {
  readonly scrollTop: number
  readonly contentHeight: number | null
  readonly viewportHeight: number | null
}

/** 连 scrollTop 都取不到时返回 null(调用方据此不渲染浮层,而不是按 0 判定)。 */
export function readScrollJumpGeometry(event: unknown): ScrollJumpReading | null {
  if (event === null || typeof event !== 'object') return null
  const e = event as {
    nativeEvent?: {
      contentOffset?: { y?: unknown }
      contentSize?: { height?: unknown }
      layoutMeasurement?: { height?: unknown }
    }
    detail?: { scrollTop?: unknown; scrollHeight?: unknown }
    scrollTop?: unknown
    scrollHeight?: unknown
  }
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const scrollTop =
    num(e.nativeEvent?.contentOffset?.y) ?? num(e.detail?.scrollTop) ?? num(e.scrollTop)
  if (scrollTop === null) return null
  return {
    scrollTop,
    contentHeight:
      num(e.nativeEvent?.contentSize?.height) ?? num(e.detail?.scrollHeight) ?? num(e.scrollHeight),
    viewportHeight: num(e.nativeEvent?.layoutMeasurement?.height),
  }
}

/**
 * 读数是否足以撑起一次完整判定(两端能力差异处的显式门,不允许被悄悄绕过)。
 * 写成类型谓词:过了这道门,computeJumpVisibility 才能拿到非 null 的两个高度 ——
 * 缺读数不得被当成 0 距离(那会算出"距底很大"从而恒亮按钮,与真实情形相反)。
 */
export function canComputeJumpVisibility(
  reading: ScrollJumpReading,
): reading is ScrollJumpReading & { contentHeight: number; viewportHeight: number } {
  return reading.contentHeight !== null && reading.viewportHeight !== null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
