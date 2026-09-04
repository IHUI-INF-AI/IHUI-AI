// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​‌‌‌​‌‌‌‌​‍‍​‌​​‌‌‍‍

/**
 * 手写 createPortal 浮层的统一视口定位工具(2026-09-04 立,根治"弹窗溢出屏幕/撑开布局")。
 *
 * 背景(病根,实测 2026-09-04):
 * - slash-command-palette / context-usage-ring / permission-history-panel / add-menu-popover
 *   四个组件各自手写 createPortal + getBoundingClientRect 坐标,但面板容器 div 漏写
 *   position(fixed) → computed position 为 static → top/left 内联样式整体失效
 *   → 面板以文档流形式追加到 body 末尾,把页面布局撑高(实测 body.scrollHeight
 *   720 → 1111),表现为"弹窗超出屏幕、把正常屏幕往上挤"。
 *
 * 本工具提供两件事:
 * 1. computePortalPanelStyle():统一计算 fixed 坐标 + 视口 clamp + maxHeight。
 *    定位策略(与原各组件意图一致,不丢行为):
 *      - 面板优先放 trigger 正上方(anchor: top | bottom,由调用方按各自视觉预期传);
 *      - 首选侧放不下、对侧放得下 → 自动翻转到对侧;
 *      - 两侧都放不下 → 选剩余空间大的一侧,并把面板压到该侧可用空间内
 *        (面板 maxHeight 同步收敛,配合面板内部滚动,内容始终可达);
 *      - 水平方向 clamp 到视口内(左右各留 pad)。
 * 2. PORTAL_PANEL_ANCHOR_STYLE:面板容器的强制兜底样式(见 globals.css 同名规则)。
 *    即使调用方漏传,inline style 也能保证 fixed 生效。
 */

/** 视口安全边距(px):面板四边至少留这么多空间 */
export const PORTAL_PANEL_VIEWPORT_PAD = 8

/**
 * 面板容器兜底样式:position 必须是 fixed,否则 getBoundingClientRect 的视口坐标
 * 对 static 元素无效(病根)。调用方直接展开进面板容器 style 即可。
 */
export const PORTAL_PANEL_POSITION_STYLE = { position: 'fixed' } as const

export interface PortalPanelAnchor {
  /** trigger 上/下边:面板首选贴着哪一侧 */
  side: 'top' | 'bottom'
  /** 与该侧的间距 px(默认 8) */
  gap?: number
  /**
   * 水平对齐:面板哪条边对齐 trigger(默认 'end' = 右缘对齐右缘,适配输入框右侧工具栏;
   * 'start' = 左缘对齐左缘;'center' = 居中)
   */
  align?: 'start' | 'center' | 'end'
}

export interface PortalPanelCoords {
  top: number
  left: number
  /** 视口 clamp 后允许的面板最大高度(px);配合面板内部滚动使用 */
  maxHeight: number
}

/**
 * 计算浮层面板的 fixed 定位坐标(带完整视口 clamp)。
 *
 * @param triggerRect trigger 的 getBoundingClientRect()
 * @param panelRect   面板当前 getBoundingClientRect()(首帧可为 0 尺寸,此时跳过翻转/clamp)
 * @param anchor      首选停靠侧 + 间距 + 水平对齐
 * @returns top/left/maxHeight;top/left 未测得面板尺寸时为 null(调用方应藏到屏幕外)
 */
export function computePortalPanelCoords(
  triggerRect: { top: number; bottom: number; left: number; right: number; height: number; width: number },
  panelRect: { width: number; height: number } | null,
  anchor: PortalPanelAnchor,
): PortalPanelCoords | null {
  const pad = PORTAL_PANEL_VIEWPORT_PAD
  const gap = anchor.gap ?? 8
  const VW = window.innerWidth
  const VH = window.innerHeight
  const maxPanelH = VH - pad * 2

  // 面板尺寸未测得(首帧):坐标先用 null 占位,调用方藏到屏幕外,渲染后再重算
  if (!panelRect || panelRect.width <= 0 || panelRect.height <= 0) return null

  const panelW = Math.min(panelRect.width, VW - pad * 2)
  // 面板自身高度超过视口时压到视口内(maxHeight 收敛,内部滚动兜底)
  const panelH = Math.min(panelRect.height, maxPanelH)

  // ── 水平:按 align 对齐 trigger,再 clamp 进视口 ──────────────────────────
  let left: number
  if (anchor.align === 'start') left = triggerRect.left
  else if (anchor.align === 'center') left = triggerRect.left + triggerRect.width / 2 - panelW / 2
  else left = triggerRect.right - panelW // 'end'(默认)
  left = Math.max(pad, Math.min(left, VW - panelW - pad))

  // ── 垂直:首选侧 → 翻转 → 大侧收敛 ──────────────────────────────────────
  const aboveTop = triggerRect.top - gap - panelH // 贴上方:面板底 = trigger.top - gap
  const belowTop = triggerRect.bottom + gap // 贴下方:面板顶 = trigger.bottom + gap
  const aboveSpace = triggerRect.top - gap - pad // 上方可用空间
  const belowSpace = VH - pad - belowTop // 下方可用空间

  let top: number
  const fitsAbove = aboveSpace >= panelH
  const fitsBelow = belowSpace >= panelH

  if (anchor.side === 'top') {
    if (fitsAbove) {
      top = aboveTop
    } else if (fitsBelow) {
      top = belowTop // 上方放不下、下方放得下 → 翻到下方(保留原组件翻转行为)
    } else {
      // 两侧都放不下:选空间大的一侧,面板压进该侧(panelH 已 ≤ maxPanelH ≤ 大侧空间时取满)
      top = aboveSpace >= belowSpace ? Math.max(pad, triggerRect.top - gap - panelH) : belowTop
    }
  } else {
    if (fitsBelow) {
      top = belowTop
    } else if (fitsAbove) {
      top = aboveTop
    } else {
      top = belowSpace >= aboveSpace ? belowTop : Math.max(pad, triggerRect.top - gap - panelH)
    }
  }

  // 终极 clamp:面板整体必须落在 [pad, VH - pad] 内
  top = Math.max(pad, Math.min(top, VH - pad - panelH))

  return { top, left, maxHeight: maxPanelH }
}
