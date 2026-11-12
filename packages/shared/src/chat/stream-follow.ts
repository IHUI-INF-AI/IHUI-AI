// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式跟底判定(RN / 小程序共用的**唯一**判据源,纯函数、零平台 API)。
 *
 * 立因(2026-11-12,D3/D4/D5):三端流式显示此前各写一套跟底 —— web 有完整滚动权账目
 * (`apps/web/src/components/chat/message-list/scroll-authority.ts`,带 wheel/touch/keyboard
 * 三类用户输入的来源归因),RN 干脆不跟底(新内容长在视口下方看不见),小程序则每帧强制拽底
 * (用户流式中滑不动)外加 99998/99999 乒乓 hack。移动两端的平台差异只有"滚动事件形状"与
 * "有没有 wheel/keydown",所以判据可以、也应该只有一份。
 *
 * 与 web 那份的关系(如实登记,不制造第二个真相):
 * - web 那份要解决的问题更宽(程序化贴底的中间帧不得夺权、布局撑高不等于用户上翻、
 *   前插历史的确定性锚点),输入是 DOM 上的 wheel/touch/keydown 三路事件;本模块**不复制**
 *   它,也不试图用简化版冒充它。
 * - 移动端拿不到 wheel/key 事件、也没有"布局撑高造成距底变大"与"用户上滚"的歧义
 *   (ScrollView 的 scrollTop 只被用户手势或我们自己改动),于是判据可收敛成两条:
 *     ① **回退即解除** —— scrollTop 相对上次记账明显回退 = 用户上翻,立即交还滚动权;
 *     ② **触底即恢复** —— 收到"到达底部"事件(含我们自己贴底造成的)才恢复跟随。
 *   两条都不需要视口高度(小程序 scroll 事件 detail 里根本没有 clientHeight),
 *   这正是本模块刻意不引入 ScrollMetrics 的原因:量不到的字段不进判据。
 *
 * 失效方向(与 web 同一条纪律):宁可**少吞一次用户意图**。所以"位置没变"「位置前进」
 * 一律不改判定,只有回退这一种有证据的位移才交还滚动权。
 */

/** 判定"回退"的容差:小于该值的 scrollTop 回退视为亚像素抖动,不算用户上翻。 */
export const STREAM_SCROLL_EPSILON_PX = 2

/** 跟底状态账目。`scrollTop` 是我们最后一次记账读到的位置(`null` = 尚未收到过滚动事件)。 */
export interface StreamFollowState {
  readonly following: boolean
  readonly scrollTop: number | null
}

/** 会话切换 / 新一轮开始:定位到最新消息 ⇒ 从跟随态起算。 */
export function initialStreamFollowState(): StreamFollowState {
  return { following: true, scrollTop: null }
}

/** 新一轮开流:上一轮用户上翻过的账目不得带进这一轮(与 web 的 followingAtSessionStart 同义)。 */
export function resetStreamFollowForNewRound(): StreamFollowState {
  return { following: true, scrollTop: null }
}

/**
 * 收到一枚 scroll 事件后的状态。
 *
 * @param state 当前账目
 * @param scrollTop 事件带来的滚动位置
 */
export function reduceStreamFollowOnScroll(
  state: StreamFollowState,
  scrollTop: number,
): StreamFollowState {
  if (!Number.isFinite(scrollTop) || scrollTop < 0) return state
  const prev = state.scrollTop
  if (prev === null) {
    // 第一次记账只建立基线:内容刚渲染完时可能已经有一枚"初始化"滚动,它不构成用户意图
    return { following: state.following, scrollTop }
  }
  if (scrollTop < prev - STREAM_SCROLL_EPSILON_PX) {
    return { following: false, scrollTop }
  }
  return { following: state.following, scrollTop }
}

/** 收到"到达底部"事件(用户滑到底 or 我们自己贴底) ⇒ 恢复跟随。 */
export function reduceStreamFollowOnReachBottom(state: StreamFollowState): StreamFollowState {
  return { following: true, scrollTop: state.scrollTop }
}

/** 内容变化后是否应当贴底。已解除跟随时一律 `false` —— 这正是"用户上翻后新内容不再拽人"的那一格。 */
export function shouldStickToBottom(state: StreamFollowState, isStreaming: boolean): boolean {
  return state.following && isStreaming
}

/**
 * 从滚动事件里读 scrollTop —— **两种宿主形状的唯一解析口**。
 *
 * - react-native / rn-compat:`{ nativeEvent: { contentOffset: { y } } }`
 * - Taro scroll-view:`{ detail: { scrollTop } }`(也兼容 detail 里叫 scrollTop 的直接形状)
 *
 * 读不到就返回 `null`;**不猜 0** —— 把"没读到"折成 0 会让下一枚真事件被误判成"位置前进",
 * 于是用户上翻被吞掉(与 web resolveScrollEventSource 的失效方向同一条)。
 */
export function readScrollEventTop(event: unknown): number | null {
  if (event === null || typeof event !== 'object') return null
  const e = event as {
    nativeEvent?: { contentOffset?: { y?: unknown } }
    detail?: { scrollTop?: unknown }
    scrollTop?: unknown
  }
  const native = e.nativeEvent?.contentOffset?.y
  if (typeof native === 'number' && Number.isFinite(native)) return native
  const detail = e.detail?.scrollTop
  if (typeof detail === 'number' && Number.isFinite(detail)) return detail
  const flat = e.scrollTop
  if (typeof flat === 'number' && Number.isFinite(flat)) return flat
  return null
}

export const __test__ = {
  reduceStreamFollowOnScroll,
  reduceStreamFollowOnReachBottom,
  readScrollEventTop,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
