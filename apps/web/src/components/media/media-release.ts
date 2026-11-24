// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-856(2026-10-05 立):多媒体预览「切离即暂停」的**唯一收口出口**。
//
// 票面判据:用户从某一项切走(换 item / 关弹层 / 该视图卸载或被隐藏)时,那一项的播放
// 必须**真的停下来**并把解码资源交回去,不许留后台继续解码。
//
// 为什么要单独成模块(而不是各组件各写一遍):
//  ① 判据只有一份 —— 「暂停」和「释放」是两种不同强度的动作,混用的后果各不相同
//     (见下面两个函数的注释),写三遍就会漂出三种语义;
//  ② **卸载时 ref 已被 React 摘走**这条坑必须在 effect 体内捕获节点才能避开,
//     每个播放器自己写极容易写成 `videoRef.current` 而静默 no-op —— 那正是本票要修的洞。
//
// 两种强度,别混用:
//  - `pauseMediaElement` —— 「隐藏 / 暂时离开」:只暂停。src 仍在元素上,回来即可续播。
//  - `releaseMediaElement` —— 「切 item / 关弹层 / 卸载」:暂停 + 摘掉 src + `load()`
//    走一遍媒体资源的复位算法,把解码器与缓冲真正交出去。
//    代价:摘 src 会让部分浏览器补发一个 `error` 事件(源空了),**调用方必须把它和
//    真实解码失败区分开** —— 本仓做法是失败态处理器先看元素上还挂不挂 src
//    (见 VideoPlayer / UnifiedViewer 的 onError),否则「切走一下回来就变加载失败」。
import * as React from 'react'

/** 只暂停:用于「视图被隐藏 / 失活」,源还留在元素上,回到前台即可继续。 */
function pauseMediaElement(el: HTMLMediaElement | null | undefined): boolean {
  if (!el) return false
  try {
    el.pause()
  } catch {
    // 元素已断开 / 环境未实现:收口是收尾动作,绝不能反过来抛给渲染路径
  }
  return Boolean(el)
}

/** 暂停 + 摘源 + 复位:用于「切 item / 关弹层 / 卸载」,把解码资源真正交回。 */
export function releaseMediaElement(el: HTMLMediaElement | null | undefined): boolean {
  if (!el) return false
  pauseMediaElement(el)
  el.removeAttribute('src')
  try {
    el.load()
  } catch {
    // 同上:收尾失败不阻断
  }
  return true
}

/**
 * 把媒体元素挂到「切离即停」的链路上。
 *
 * 用法约束(与 G-751 的纪律②同源):**宿主元素按资源重建** —— 渲染时写
 * `<video key={src} …>`。这样换 item 一定是「旧节点卸载 + 新节点挂载」,旧节点的
 * 收口必然发生,不会被 React 先改属性后跑清理的时序吃掉。
 *
 * 依赖数组覆盖 `src` 与 `active` 两个变化源:
 *  - `src` 变(切 item)/ 组件卸载(关弹层、宿主摘掉这一项)⇒ 走 cleanup 释放;
 *  - `active` 变 false(宿主把这一视图藏起来但没卸载)⇒ 立即暂停。
 *
 * 未加 key 的宿主(改 src 复用同一节点)也不会被误伤:React 在 cleanup 之前就已经把
 * 新的 src 写进 DOM,此时 `getAttribute('src') !== src` ⇒ 跳过释放。这不是漏停,
 * HTML 规范里给媒体元素换 src 本身就会走 load 算法(先停播、再复位资源),
 * 补一次摘源只会把**新**那一项打成「加载失败」。
 */
export function useMediaRelease(
  ref: React.RefObject<HTMLMediaElement | null>,
  src: string,
  active = true,
): void {
  /**
   * 组件级卸载旗。effect 的清理函数无法知道"自己为什么被调"(卸载?还是依赖变了?),
   * 而 active true→false 的翻转恰恰**先跑清理再跑新 setup** —— 若清理一律释放,"藏起来"
   * 就会把 src 摘掉,"回来可续播"永远黑屏。layout effect 的 destroy 先于 passive effect
   * 的 destroy 执行,所以在前置 layout 清理里置位,媒体清理就能可靠区分两种来意。
   */
  const unmountedRef = React.useRef(false)
  React.useLayoutEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  React.useEffect(() => {
    // 必须在 effect 体内捕获:卸载路径上 React 已把 ref 置空,读 ref.current 会静默 no-op
    const el = ref.current
    if (!el) return
    if (!active) {
      pauseMediaElement(el)
      // 失活态也要挂卸载清理:宿主在藏匿期间直接卸载这一项,照样得把资源交回去
      return () => {
        if (unmountedRef.current) releaseMediaElement(el)
      }
    }
    return () => {
      if (unmountedRef.current) {
        // 卸载 / key 重挂(key 含 src ⇒ 换源即重挂):真正释放
        releaseMediaElement(el)
        return
      }
      if (el.getAttribute('src') !== src) {
        // 非 key 宿主换了源:新源已由 React 挂上、归新一轮 effect,
        // HTML 换源算法本身就会停播复位 —— 此处再摘源只会打断新的一项。
        return
      }
      // src 未变且未卸载 ⇒ 这次清理来自 active 翻 false:不摘源,
      // 新一轮 setup 的"只暂停"分支已经接管(否则"藏起来再回来"黑屏)。
    }
  }, [ref, src, active])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
