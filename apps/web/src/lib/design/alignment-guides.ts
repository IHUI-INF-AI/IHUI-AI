/**
 * 对齐参考线计算与吸附(Design 模式 P1-c,2026-07-24 立)。
 *
 * 拖拽元素时,检测与其他兄弟元素的对齐关系,生成参考线 + 吸附位置。
 * 参考线类型:
 *   - 'h' 水平线(y 固定,横向延伸):top 对齐 / bottom 对齐 / 垂直居中对齐
 *   - 'v' 垂直线(x 固定,纵向延伸):left 对齐 / right 对齐 / 水平居中对齐
 *
 * 阈值 5px:元素间距离 < 5px 时显示参考线 + 吸附。
 * 自研实现,不引入新依赖。
 */

export interface ElementRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface GuideLine {
  /** 'h' 水平线(y 固定);'v' 垂直线(x 固定)。 */
  type: 'h' | 'v'
  /** 参考线的固定坐标(h:y;v:x)。 */
  position: number
  /** 参考线延伸的起始坐标(h:左端 x;v:顶端 y)。 */
  start: number
  /** 参考线延伸的结束坐标(h:右端 x;v:底端 y)。 */
  end: number
}

const DEFAULT_THRESHOLD = 5

/**
 * 计算拖拽元素与所有兄弟元素的对齐参考线。
 *
 * 对每个 other 元素检查 6 种对齐关系:
 *   - 水平参考线:dragged.top/bottom/centerY 与 other.top/bottom/centerY 距离 < threshold
 *   - 垂直参考线:dragged.left/right/centerX 与 other.left/right/centerX 距离 < threshold
 *
 * 参考线延伸范围 = 两元素在该方向上投影区间的并集(让线段足够长,视觉清晰)。
 *
 * @param dragged 被拖拽元素当前矩形
 * @param others 同画布其他元素矩形
 * @param threshold 对齐阈值(px),默认 5
 */
export function computeGuides(
  dragged: ElementRect,
  others: ElementRect[],
  threshold: number = DEFAULT_THRESHOLD,
): GuideLine[] {
  const guides: GuideLine[] = []
  const dTop = dragged.y
  const dBottom = dragged.y + dragged.height
  const dCenterY = dragged.y + dragged.height / 2
  const dLeft = dragged.x
  const dRight = dragged.x + dragged.width
  const dCenterX = dragged.x + dragged.width / 2

  for (const other of others) {
    if (other.id === dragged.id) continue
    if (other.width <= 0 || other.height <= 0) continue

    const oTop = other.y
    const oBottom = other.y + other.height
    const oCenterY = other.y + other.height / 2
    const oLeft = other.x
    const oRight = other.x + other.width
    const oCenterX = other.x + other.width / 2

    // 水平参考线:y 固定,横向覆盖两元素 x 范围并集
    const hStart = Math.min(dragged.x, other.x)
    const hEnd = Math.max(dragged.x + dragged.width, other.x + other.width)
    const hPairs: Array<[number, number]> = [
      [dTop, oTop],
      [dBottom, oBottom],
      [dCenterY, oCenterY],
    ]
    for (const [dVal, oVal] of hPairs) {
      if (Math.abs(dVal - oVal) < threshold) {
        guides.push({ type: 'h', position: oVal, start: hStart, end: hEnd })
      }
    }

    // 垂直参考线:x 固定,纵向覆盖两元素 y 范围并集
    const vStart = Math.min(dragged.y, other.y)
    const vEnd = Math.max(dragged.y + dragged.height, other.y + other.height)
    const vPairs: Array<[number, number]> = [
      [dLeft, oLeft],
      [dRight, oRight],
      [dCenterX, oCenterX],
    ]
    for (const [dVal, oVal] of vPairs) {
      if (Math.abs(dVal - oVal) < threshold) {
        guides.push({ type: 'v', position: oVal, start: vStart, end: vEnd })
      }
    }
  }

  return guides
}

/**
 * 根据参考线计算吸附后的 x/y。
 *
 * 同一轴上取距离最近的参考线进行吸附:把 dragged 的某个边/中点对齐到参考线。
 * 未命中任何参考线时,该轴保持原值。
 *
 * @param dragged 被拖拽元素当前矩形
 * @param guides computeGuides 返回的参考线集合
 */
export function applySnap(
  dragged: ElementRect,
  guides: GuideLine[],
): { x: number; y: number } {
  let snapX: number | null = null
  let snapY: number | null = null
  let minDX = Infinity
  let minDY = Infinity

  const dTop = dragged.y
  const dBottom = dragged.y + dragged.height
  const dCenterY = dragged.y + dragged.height / 2
  const dLeft = dragged.x
  const dRight = dragged.x + dragged.width
  const dCenterX = dragged.x + dragged.width / 2

  for (const g of guides) {
    if (g.type === 'h') {
      // 水平参考线:把 dragged 的 top/bottom/centerY 之一对齐到 g.position
      const candidates: Array<[number, number]> = [
        [dTop, dragged.y],
        [dBottom, dragged.y + dragged.height],
        [dCenterY, dragged.y + dragged.height / 2],
      ]
      for (const [c, base] of candidates) {
        const d = Math.abs(c - g.position)
        if (d < minDY) {
          minDY = d
          snapY = g.position - (base - dragged.y)
        }
      }
    } else {
      // 垂直参考线:把 dragged 的 left/right/centerX 之一对齐到 g.position
      const candidates: Array<[number, number]> = [
        [dLeft, dragged.x],
        [dRight, dragged.x + dragged.width],
        [dCenterX, dragged.x + dragged.width / 2],
      ]
      for (const [c, base] of candidates) {
        const d = Math.abs(c - g.position)
        if (d < minDX) {
          minDX = d
          snapX = g.position - (base - dragged.x)
        }
      }
    }
  }

  return { x: snapX ?? dragged.x, y: snapY ?? dragged.y }
}
