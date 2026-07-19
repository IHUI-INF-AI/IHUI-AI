/**
 * 浮动工具栏位置计算(纯函数,可独立测试)。
 *
 * 职责:
 * - 在 selection rect 基础上,根据 viewport 空间决定 placement(top/bottom)
 * - 横向夹在 viewport 内(不超出左/右 8px 边距)
 * - 同一选区反复触发时,保持位置稳定(避免抖动)
 * - 当空间不足时自动 flip,flip 后仍超出 viewport 则退化到 fallback
 *
 * 与 content-utils.ts 的 computeToolbarPosition 区别:
 * - 后者只做基础 top/bottom 选择 + 横向 clamp
 * - 本模块额外支持:flip 链(上下翻转 → 横向翻转 → fallback 居中),
 *   viewport 滚动位置感知(scrollX/Y),稳定锚点(避免 jitter)
 */

export interface RectLike {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface ViewportLike {
  width: number
  height: number
  /** 水平滚动偏移,默认 0 */
  scrollX?: number
  /** 垂直滚动偏移,默认 0 */
  scrollY?: number
}

export interface AnchorSnapshot {
  /** 上一次成功放置的 placement */
  placement: 'top' | 'bottom'
  /** 上一次成功放置的 left */
  left: number
}

export interface PositionMemoryOptions {
  /** 距离 viewport 边缘的安全边距(px) */
  margin?: number
  /** 距离 selection rect 的偏移(px) */
  offset?: number
  /** 横向位置稳定性阈值:如果新 left 与上次相差 < threshold,沿用上次(避免抖动) */
  jitterThreshold?: number
  /** 上一次的锚点(可选,传入则启用稳定模式) */
  anchor?: AnchorSnapshot | null
}

export interface ToolbarPlacement {
  top: number
  left: number
  placement: 'top' | 'bottom'
  visible: boolean
  /** 当位置在 viewport 内可见的比例 < 1 表示部分被裁剪 */
  visibilityRatio: number
}

/**
 * 计算工具栏位置,优先沿用 anchor(同选区 / 相近选区不抖动),
 * 空间不足时自动 flip。
 */
export function computePositionWithMemory(
  rect: RectLike,
  toolbarWidth: number,
  toolbarHeight: number,
  viewport: ViewportLike,
  options: PositionMemoryOptions = {},
): ToolbarPlacement {
  const margin = options.margin ?? 8
  const offset = options.offset ?? 8
  const jitterThreshold = options.jitterThreshold ?? 4
  const anchor = options.anchor ?? null

  // rect 退化:不可见
  if (rect.width <= 0 && rect.height <= 0) {
    return { top: 0, left: 0, placement: 'top', visible: false, visibilityRatio: 0 }
  }

  const scrollX = viewport.scrollX ?? 0
  const scrollY = viewport.scrollY ?? 0
  // 视口左/上/右/下边界(rect 与 toolbar 都在 viewport 坐标系内,0,0 是 viewport 左上角)
  const viewportTop = 0
  const viewportBottom = viewport.height
  const viewportLeft = 0
  const viewportRight = viewport.width

  // selection rect 在视口坐标系中的可见部分
  const visibleTop = Math.max(rect.top, 0)
  const visibleBottom = Math.min(rect.bottom, viewport.height)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  const visibilityRatio = rect.height > 0 ? visibleHeight / rect.height : 0
  if (visibilityRatio <= 0) {
    return { top: 0, left: 0, placement: 'top', visible: false, visibilityRatio: 0 }
  }

  // 计算候选 placements(优先按 anchor 顺序,否则 top → bottom)
  const order: Array<'top' | 'bottom'> = anchor
    ? [anchor.placement, anchor.placement === 'top' ? 'bottom' : 'top']
    : ['top', 'bottom']

  for (const placement of order) {
    const top =
      placement === 'top' ? rect.top - toolbarHeight - offset : rect.bottom + offset
    // 横向:以 rect 中点居中
    const idealLeft = rect.left + rect.width / 2 - toolbarWidth / 2
    const clampedLeft = clampHorizontal(idealLeft, toolbarWidth, viewport, margin)
    const candidate = { top, left: clampedLeft }

    const fullyVisible =
      candidate.top >= viewportTop + margin &&
      candidate.top + toolbarHeight <= viewportBottom - margin &&
      candidate.left >= viewportLeft + margin &&
      candidate.left + toolbarWidth <= viewportRight - margin

    if (fullyVisible) {
      const stable = applyJitterGuard(
        candidate,
        anchor,
        toolbarWidth,
        toolbarHeight,
        viewport,
        jitterThreshold,
        margin,
      )
      return {
        top: stable.top,
        left: stable.left,
        placement,
        visible: true,
        visibilityRatio: 1,
      }
    }
  }

  // 两条 placement 都无法完全放下 → 取 best-effort(top 优先),再次 clamp
  const fallbackTop = rect.top - toolbarHeight - offset
  const fallbackBottom = rect.bottom + offset
  const bestTop = order[0] === 'top' ? fallbackTop : fallbackBottom
  const idealLeft = rect.left + rect.width / 2 - toolbarWidth / 2
  const clampedLeft = clampHorizontal(idealLeft, toolbarWidth, viewport, margin)
  const placement: 'top' | 'bottom' = order[0]
  const finalRatio = computeVisibilityRatio(
    bestTop,
    clampedLeft,
    toolbarWidth,
    toolbarHeight,
    viewport,
    margin,
  )
  return {
    top: bestTop,
    left: clampedLeft,
    placement,
    visible: finalRatio > 0.25,
    visibilityRatio: finalRatio,
  }
}

/**
 * 横向夹在 viewport 内(margin 内边距)。
 */
export function clampHorizontal(
  idealLeft: number,
  toolbarWidth: number,
  viewport: ViewportLike,
  margin = 8,
): number {
  const min = (viewport.scrollX ?? 0) + margin
  const max = (viewport.scrollX ?? 0) + viewport.width - toolbarWidth - margin
  if (max < min) return min
  return Math.max(min, Math.min(idealLeft, max))
}

/**
 * 计算候选矩形在 viewport 内的可见比例(用于 partial visibility 判断)。
 */
function computeVisibilityRatio(
  top: number,
  left: number,
  width: number,
  height: number,
  viewport: ViewportLike,
  margin: number,
): number {
  const visTop = Math.max(top, (viewport.scrollY ?? 0) + margin)
  const visBottom = Math.min(top + height, (viewport.scrollY ?? 0) + viewport.height - margin)
  const visLeft = Math.max(left, (viewport.scrollX ?? 0) + margin)
  const visRight = Math.min(left + width, (viewport.scrollX ?? 0) + viewport.width - margin)
  const w = Math.max(0, visRight - visLeft)
  const h = Math.max(0, visBottom - visTop)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / (width * height)
}

/**
 * 防抖动:如果 candidate.left 与 anchor.left 差异 < threshold,沿用 anchor(同侧 placement)。
 * 避免选区微小移动时工具栏左右抖动。
 */
function applyJitterGuard(
  candidate: { top: number; left: number },
  anchor: AnchorSnapshot | null,
  toolbarWidth: number,
  toolbarHeight: number,
  viewport: ViewportLike,
  threshold: number,
  margin: number,
): { top: number; left: number } {
  if (!anchor) return candidate
  if (Math.abs(candidate.left - anchor.left) >= threshold) return candidate
  // anchor.left 仍在 viewport 内才使用
  const stillIn = anchor.left >= (viewport.scrollX ?? 0) + margin &&
    anchor.left + toolbarWidth <= (viewport.scrollX ?? 0) + viewport.width - margin
  if (!stillIn) return candidate
  return { top: candidate.top, left: anchor.left }
}

/**
 * 判断两个 selection rect 是否"足够近",触发相同锚点(防抖判断依据)。
 * 用 rect 中心点距离衡量。
 */
export function isNearbyRect(
  a: RectLike,
  b: RectLike,
  threshold = 24,
): boolean {
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  const bx = b.left + b.width / 2
  const by = b.top + b.height / 2
  return Math.abs(ax - bx) <= threshold && Math.abs(ay - by) <= threshold
}
