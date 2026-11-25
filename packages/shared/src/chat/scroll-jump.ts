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

export interface JumpVisibility {
  isFarFromTop: boolean
  isFarFromBottom: boolean
}

/**
 * 由滚动几何量计算两枚按钮的显隐。
 *
 *  - isFarFromTop      = scrollTop > threshold
 *  - isFarFromBottom   = (scrollHeight - scrollTop - clientHeight) > threshold
 *
 * 纪律:纯函数,不读 DOM、不接事件对象 —— 各端的事件形状差异(RN 原生 contentOffset /
 * 小程序 detail / web scroll 事件)由调用方折算成这三个数后传入,折算本身不归本文件管
 * (web 那份已有 `readScrollEventTop` 同型收口)。
 *
 * 负值输入按 0 处理:滚动弹性回弹期间 contentOffset 可能为负,不得因此把"在顶部"
 * 判成"远离顶部"。
 */
export function computeJumpVisibility(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = JUMP_FAR_THRESHOLD,
): JumpVisibility {
  const top = Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0
  const height = Number.isFinite(scrollHeight) && scrollHeight > 0 ? scrollHeight : 0
  const view = Number.isFinite(clientHeight) && clientHeight > 0 ? clientHeight : 0
  const distanceFromBottom = height - top - view
  return {
    isFarFromTop: top > threshold,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
