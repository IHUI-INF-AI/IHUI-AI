// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM API(document / window / HTMLElement),只适用于 web 与 extension,
// 不下沉到 packages/ —— RN 与小程序没有 DOM(AGENTS §3「共享层优先」的平台例外条款)。

/**
 * 「可点击跳转到源」的唯一实现(D13①,2026-09-26 立)。
 *
 * 这条机制此前只活在引用条 `progress-sections/citation-bar.tsx` 内部,别的上下文面板
 * 想要同样的行为只能再抄一份 —— 本模块把它提成单源,引用条改为 import。
 *
 * 两条纪律(都是本票实测逼出来的,不是套话):
 *
 * 1. **不得伪造可点入口**:跳转的前提是页面上真的有一个落点元素。
 *    `scrollToSource` 返回 boolean,渲染期用 `hasSourceTarget` 先判;判不到就
 *    **不要**把那一行渲染成可点 —— 用户点了没反应 = 假 affordance,比不做更坏。
 * 2. **不要在这里再写第二份跳转路由**:消息级 / 工具调用级的跳转早就有了,载体是
 *    `chat/message-list/MessageList.tsx` 监听的 `ihui:scroll-to-message` 与
 *    `ihui:scroll-to-tool-call` 两个事件(落点是 `[data-message-id]`,高亮由
 *    `stores/progress-jump-store` 的 flashHighlight 负责)。跨面板跳某条消息 / 某个
 *    工具卡应当派发那两个事件,不得在组件里自拼 `scrollIntoView`。
 */

/** 高亮停留时长(ms):够看清"跳到的是这一条",又不干扰阅读 */
const HIGHLIGHT_MS = 1400

/**
 * 外链判定(http / https)。为真时由浏览器按 `target=_blank` 直接开新窗口,
 * 不走页内跳转 —— 引用条与后续任何接入方共用这一条判据,不得各写一份正则。
 */
export function isExternalHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * 页内锚点引用 → 落点元素;取不到返回 null(不猜、不合成、不"就近挑一个")。
 *
 * `ref` 是 URL 片段(# 后面那段),可能是百分号编码形态,故先解码再查;
 * 解码本身失败(畸形编码)时退回原串,行为与提取前的引用条一致。
 */
export function findSourceTarget(ref: string): HTMLElement | null {
  try {
    return document.getElementById(decodeURIComponent(ref))
  } catch {
    return document.getElementById(ref)
  }
}

/** 这一条引用到底有没有落点?渲染期用它决定要不要给"可点"外观。 */
export function hasSourceTarget(ref: string): boolean {
  return findSourceTarget(ref) !== null
}

/**
 * 滚动到源并临时高亮。
 *
 * @returns 是否命中落点。`false` 表示页面上没有这个元素 —— 调用方必须把它当作
 *          "本条不可跳转"处理(隐藏入口),而不是当作成功。
 */
export function scrollToSource(ref: string): boolean {
  const el = findSourceTarget(ref)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const prev = el.style.boxShadow
  el.style.transition = 'box-shadow 0.6s ease'
  el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.45)'
  window.setTimeout(() => {
    el.style.boxShadow = prev
  }, HIGHLIGHT_MS)
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
