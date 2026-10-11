// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 长会话挂载窗口(G-828,2026-10-04 立)——消息列表 windowed 挂载的唯一纯逻辑源。
//
// 为什么单独一个文件、而且**不放 packages/shared**:
// - 窗口计算/占位高度是"这一端的 DOM 挂载策略",桌面/web 各端容器尺寸与滚动语义不同,
//   放进 shared 会变成第二个真相源并牵动其他端(台账票明确排除)。
// - 判据必须能脱离 React 与 DOM 被测:三态("窗口未生效 / 历史被裁剪 / 历史未被裁剪")
//   在组件里只能靠读 DOM 数值区分,纯函数层则可以直接用数值锁死。
//
// 与既有分工(不重复实现):
// - 滚动权归属(贴底跟随 / 上滚解除 / 前插补偿是否该发生)唯一住在 `scroll-authority.ts`;
// - 本文件只管"这一帧挂载哪几行、窗口外用多高占位",不读 DOM、不碰 state。

/** 未测量行的估计高度(px):一屏 ≈ 视口高 / 本值,也是 offset 缺失时的回落档。 */
export const ESTIMATED_ITEM_HEIGHT = 160

/** 条数不超过本值不启用窗口化(既有 #7 语义,原样搬迁:短会话全量渲染更跟手)。 */
export const WINDOW_THRESHOLD = 60

/** 视口上下各多挂载的行数缓冲(既有 #7 语义,原样搬迁:减少快滚白屏)。 */
export const WINDOW_BUFFER_ITEMS = 6

/**
 * 单帧挂载行数硬上限(G-828 新增)。
 *
 * 存在的理由不是"再省一点",而是窗口数学在**行高塌缩**时会退化成"整表都可见":
 * 行高量到 0/1px(样式未生效、整会话都是空行、测高竞态)时,`视口 ± 缓冲`会圈住全部
 * 1000 条 ⇒ 一次 commit 挂满 1000 行,窗口化等于没生效。本上限是那一档的兜底:
 * 无论几何怎么退化,挂载行数都不越过去。
 *
 * 让位顺序是"先砍缓冲、绝不砍视口内的行":上限 < 视口行数时保留从视口顶部起连续
 * 的 `上限` 行(下一帧滚动/测高会把其余行补进来),而不是把可见区域清空。
 */
export const MAX_MOUNTED_ITEMS = 120

export interface WindowRange {
  readonly start: number
  readonly end: number
}

/** 空窗口:start > end(与"没有行"同义,调用侧据此得到 0 行挂载、全量占位)。 */
const EMPTY_WINDOW: WindowRange = { start: 0, end: -1 }

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

/** 是否启用窗口化(条数超过阈值)。 */
export function shouldWindow(count: number, threshold: number = WINDOW_THRESHOLD): boolean {
  return count > threshold
}

/**
 * 累积高度数组:`offsets[i]` = 第 i 行之前的总高度,`offsets[count]` = 内容总高。
 * 量到的高度(含 0)照用;`undefined`/`NaN`/`Infinity` 一律回落估计高度——
 * 回落的是**这一行**,不会让整条 offset 链变成 NaN。
 */
export function buildOffsets(
  count: number,
  readMeasuredHeight: (index: number) => number | undefined,
  estimatedItemHeight: number = ESTIMATED_ITEM_HEIGHT,
): { offsets: number[]; total: number } {
  const offsets = new Array<number>(Math.max(0, count + 1))
  let total = 0
  for (let index = 0; index < count; index++) {
    offsets[index] = total
    const measured = readMeasuredHeight(index)
    const height = isFiniteNumber(measured) ? (measured as number) : estimatedItemHeight
    total += height > 0 ? height : 0
  }
  offsets[Math.max(0, count)] = total
  return { offsets, total }
}

/**
 * 二分:第一个"结束位置严格大于 position"的行(即 position 落在它的高度区间里)。
 * offsets 单调不减,等高时取最靠前的那一行。
 */
function firstIndexCovering(offsets: readonly number[], position: number): number {
  const lastIndex = offsets.length - 2
  if (lastIndex < 0) return 0
  let lo = 0
  let hi = lastIndex
  let answer = lastIndex
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const next = offsets[mid + 1]
    if (isFiniteNumber(next) && next > position) {
      answer = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return answer
}

/** 最后一个"起始位置严格小于 position"的行。 */
function lastIndexBefore(offsets: readonly number[], position: number): number {
  const lastIndex = offsets.length - 2
  if (lastIndex < 0) return 0
  let lo = 0
  let hi = lastIndex
  let answer = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const here = offsets[mid]
    if (isFiniteNumber(here) && here < position) {
      answer = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return answer
}

/**
 * 本帧应挂载的行区间 = 视口覆盖行 ± 缓冲行,再受挂载上限约束。
 *
 * 三条不变量(测试逐条锁):
 * ① `end - start + 1 <= min(count, MAX_MOUNTED_ITEMS)` —— 上限恒定生效,退化几何也挂不满整表;
 * ② 上限不让位时,窗口必须完整覆盖视口行(`coreStart..coreEnd` ⊆ 窗口)—— 可见内容永不被裁剪;
 * ③ `count <= threshold` 之类"不窗口化"的判断不在本函数内做,调用侧用 `shouldWindow` 决定;
 *    本函数只管几何,给多少行就多几何。
 */
export function resolveVisibleWindow(input: {
  readonly count: number
  readonly offsets: readonly number[]
  readonly scrollTop: number
  readonly viewportHeight: number
  readonly bufferItems?: number
  readonly maxMountedItems?: number
}): WindowRange {
  const { count, offsets, scrollTop } = input
  if (count <= 0) return EMPTY_WINDOW
  if (!isFiniteNumber(offsets[count]) || offsets[count] === 0) {
    // 内容总高量不到(0 或脏值)⇒ 无法按几何定位,退化为"从顶部挂满上限"。
    // 这一档必须仍然有界:历史实现此处直接 return 不更新窗口,首帧就会把
    // 初始区间(前 WINDOW_THRESHOLD 行)当成最终结果,滚到底也换不过来。
    return { start: 0, end: Math.min(count, input.maxMountedItems ?? MAX_MOUNTED_ITEMS) - 1 }
  }
  const viewportHeight = isFiniteNumber(input.viewportHeight) ? input.viewportHeight : 0
  const bufferItems = isFiniteNumber(input.bufferItems ?? WINDOW_BUFFER_ITEMS)
    ? (input.bufferItems ?? WINDOW_BUFFER_ITEMS)
    : WINDOW_BUFFER_ITEMS
  const maxMountedItems = isFiniteNumber(input.maxMountedItems ?? MAX_MOUNTED_ITEMS)
    ? (input.maxMountedItems ?? MAX_MOUNTED_ITEMS)
    : MAX_MOUNTED_ITEMS
  const last = count - 1
  const position = Math.max(0, isFiniteNumber(scrollTop) ? scrollTop : 0)
  const viewportBottom = position + Math.max(0, viewportHeight)

  const coreStart = Math.min(last, firstIndexCovering(offsets, position))
  const coreEnd = Math.min(last, Math.max(coreStart, lastIndexBefore(offsets, viewportBottom)))

  const desiredStart = Math.max(0, coreStart - bufferItems)
  const desiredEnd = Math.min(last, coreEnd + bufferItems)
  const desiredSpan = desiredEnd - desiredStart + 1
  if (desiredSpan <= maxMountedItems) {
    return { start: desiredStart, end: desiredEnd }
  }

  // 上限开始咬人:先保视口行,缓冲两侧均分剩余预算。
  const coreSpan = coreEnd - coreStart + 1
  if (coreSpan >= maxMountedItems) {
    return { start: coreStart, end: Math.min(last, coreStart + maxMountedItems - 1) }
  }
  const extra = maxMountedItems - coreSpan
  const left = Math.min(bufferItems, Math.floor(extra / 2))
  const right = Math.min(bufferItems, extra - left)
  return {
    start: Math.max(0, coreStart - left),
    end: Math.min(last, coreEnd + right),
  }
}

/**
 * 窗口外的占位高度(px):顶部 = 窗口前所有行的累积高度,底部 = 窗口后所有行的累积高度。
 * 两者 + 窗口内行的实际高度 = 内容总高 ⇒ 滚动条比例不失真、历史不会被"裁掉"。
 */
export function windowPaddings(input: {
  readonly offsets: readonly number[]
  readonly count: number
  readonly start: number
  readonly end: number
}): { paddingTop: number; paddingBottom: number } {
  const { offsets, count, start, end } = input
  const total = isFiniteNumber(offsets[count]) ? (offsets[count] as number) : 0
  const safeStart = Math.max(0, Math.min(start, count))
  const beforeHeight = isFiniteNumber(offsets[safeStart]) ? (offsets[safeStart] as number) : 0
  const afterIndex = Math.max(0, Math.min(end + 1, count))
  const afterHeight = isFiniteNumber(offsets[afterIndex]) ? (offsets[afterIndex] as number) : total
  return {
    paddingTop: Math.max(0, beforeHeight),
    paddingBottom: Math.max(0, total - afterHeight),
  }
}

/**
 * 顶部补页时的位置锚点候选行索引(按优先级):
 * ① 当前窗口的首行(它一定挂在 DOM 里 ⇒ 一定量得到),
 * ② 数组首行(窗口首行就是它时等价;也覆盖"窗口未更新"的过渡帧)。
 *
 * 为什么必须改:锚点原先只有数组首行,而窗口化后那一行大概率**不在 DOM 里**
 * (`querySelector` 落空 ⇒ 整个补偿链断裂 ⇒ 前插历史时视口直接跳位)。
 * 补偿量本就该按"用户眼下看到的第一行"算,换锚点不是绕路,是修正语义。
 */
export function historyAnchorCandidates(count: number, windowStart: number): number[] {
  if (count <= 0) return []
  const clamped = Math.max(0, Math.min(windowStart, count - 1))
  const out: number[] = [clamped]
  if (clamped !== 0) out.push(0)
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
