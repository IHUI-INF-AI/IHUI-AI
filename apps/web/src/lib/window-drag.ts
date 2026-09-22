// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 桌面端无边框窗口(Tauri decorations:false)的"按下即拖"共享实现。
// 消费方:GlobalTopBar 顶栏空白区、SidebarHeader 侧栏 header 空白区。
//
// 为什么不能在 mousedown 里直接 startWindowDrag():Tauri 的 start_dragging 会让进程
// 进入原生模态移动循环,吞掉本次按压的 mouseup/click —— 子按钮与 logo 的点击全部失效
// (2026-09-21 实测回归:展开按钮"点了没反应")。旧实现用 250/300ms 长按 timer 规避,
// 代价就是用户反馈的"要长按才能拖"。
//
// 正解:按下后等**第一次真实位移**(>3px,滤掉点击手抖)再启动拖拽。
// 纯点击无位移 → 事件链完整 → click/dblclick 正常;想拖 → 鼠标一动窗口立即跟手,零等待。
import { startWindowDrag } from './tauri-bridge'

const DRAG_START_THRESHOLD_PX = 3

// 排除项=真正会与"按下即拖"抢手势的控件:
//   button/input/textarea/select/[role=button]:点击语义 + 文本选择拖拽;
//   a:标签页自身带 HTML5 draggable 排序(TagsView),撞车。
// data-window-drag 显式opt-in:logo 这类"既要能点、又是天然拖窗把手"的元素
// (旧实现整条 header 都能长按拖,用户习惯抓 logo 拖窗口)。
const INTERACTIVE_SELECTOR =
  'a, input, textarea, select, [role="button"]:not([data-window-drag]), button:not([data-window-drag])'

/** mousedown 目标是否属于"可拖拽的空白区"(排除交互子元素 + 调用方额外排除项) */
export function isDraggableBlankArea(target: HTMLElement, extraExcludeSelector?: string): boolean {
  const selector = extraExcludeSelector
    ? `${INTERACTIVE_SELECTOR}, ${extraExcludeSelector}`
    : INTERACTIVE_SELECTOR
  return !target.closest(selector)
}

/** 武装"首次位移即启动窗口拖拽";按下后未移动即松开则什么都不做(保留点击语义) */
export function armWindowDragOnFirstMove(originX: number, originY: number): void {
  function onMove(ev: MouseEvent) {
    if (Math.hypot(ev.screenX - originX, ev.screenY - originY) < DRAG_START_THRESHOLD_PX) return
    detach()
    void startWindowDrag()
  }
  function detach() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', detach)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', detach)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
