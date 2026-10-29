// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单条消息内工具活动列表的几何窗口判据(2026-10-29 立,对标 Qoder 0.4.11 活动级虚拟化)。
 *
 * 为什么需要:类目卡列表此前走 `ShowMoreList` 的**数量截断**(前 6 项 + 「更多」),
 * 那是"少挂几行"不是"按几何挂可见行"——条目再多也只有展开后全量挂载这一条路。
 * 本文件补的是几何这一维:按滚动位置 + measured/estimated 行高算可见区间。
 *
 * 纪律(§0.6 单一真相源,本文件零窗口数学):
 * - 区间 / 占位 / 阈值 / 上限 / 二分定位**全部复用** `@/components/chat/windowing`
 *   的纯函数(`shouldWindow` / `buildOffsets` / `resolveVisibleWindow` / `windowPaddings`)。
 *   本文件只做三件 windowing.ts 不负责的事:
 *   ① 把行高估计值换成活动行档(那个文件的默认值是消息行档 160);
 *   ② 把「量不到」这一档判成**全量挂载**(不许猜区间);
 *   ③ 揭示语义(用户点某条 ⇒ center;仅因新条目到达 ⇒ 贴底)与对应的滚动位置。
 *
 * 纯函数、无 DOM、无 React:三态(未虚拟化 / 虚拟化 / 量不到 ⇒ 全量)可直接用数值锁死。
 */
import {
  buildOffsets,
  resolveVisibleWindow,
  shouldWindow,
  windowPaddings,
} from '@/components/chat/windowing'

/**
 * 活动行(类目卡)的估计行高(px)。
 *
 * 取值依据:折叠态类目卡 = `FoldableSection` 头部(`py-1` 上下 8px + `text-sm` 行盒 20px
 * + `gap-1.5` 与计数徽章占位)≈ 32px,再留 8px 让展开一行的常见余量 ⇒ 40px。
 * 与对标实现的分档同量级(它 part 行 40 / 消息行 160),但**不是抄数字**:这个值是
 * "一屏能放几张卡"的估计,首帧后一律由实测高度接管(见组件里的 ResizeObserver)。
 */
export const ACTIVITY_ROW_HEIGHT = 40

/**
 * 低于等于本值不虚拟化(全量挂载)。
 *
 * 取值依据:容器可视高默认 360px / 40px ≈ 9 行一屏,20 行 = 两屏以上才值得付
 * "测高 + 二分 + 占位"的复杂度;比 windowing.ts 的消息行阈值(60)低,因为活动行
 * 单行体量小、一屏张数多。
 */
export const ACTIVITY_VIRTUAL_THRESHOLD = 20

/** 视口上下多挂载的行数(对标实现的 overscan = 4)。 */
export const ACTIVITY_OVERSCAN = 4

/** 揭示对齐:`center` = 用户显式指定某条;`end` = 新条目到达贴底。 */
export type RevealAlign = 'center' | 'end'

export interface RevealTarget {
  /** 目标行下标;`-1` 表示没有可揭示的行(空列表),调用方据此不滚动。 */
  readonly target: number
  readonly align: RevealAlign
  /** 本次是否"用户显式揭示":true ⇒ center;false ⇒ 贴底(新条目到达)。 */
  readonly explicit: boolean
}

function toIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN
}

/**
 * 揭示目标判据(纯函数,不依赖 DOM)。
 *
 * 语义(测试逐条锁):
 * ① `revealItemIndex >= 0` ⇒ 该行 + `center`;
 * ② `revealItemKey` 能在 `itemKeys` 里查到 ⇒ 命中行 + `center`(键比下标稳:排序/前插后下标会挪);
 * ③ 两者都没有/查不到 ⇒ 末行 + `end`(唯一失效方向是"多滚一次到底",绝不猜中间某行);
 * ④ 空列表 ⇒ `target: -1`。
 */
export function resolveRevealTarget(input: {
  readonly count: number
  readonly revealItemIndex?: number
  readonly revealItemKey?: string | null
  readonly itemKeys?: readonly string[]
}): RevealTarget {
  const rawCount = toIndex(input.count)
  const count = Number.isNaN(rawCount) ? 0 : Math.max(0, rawCount)
  if (count === 0) return { target: -1, align: 'end', explicit: false }
  const last = count - 1
  const byIndex = toIndex(input.revealItemIndex)
  if (!Number.isNaN(byIndex) && byIndex >= 0) {
    return { target: Math.min(last, byIndex), align: 'center', explicit: true }
  }
  const key = input.revealItemKey
  if (typeof key === 'string' && key !== '' && input.itemKeys) {
    const found = input.itemKeys.indexOf(key)
    if (found >= 0) return { target: Math.min(last, found), align: 'center', explicit: true }
  }
  return { target: last, align: 'end', explicit: false }
}

/**
 * 揭示目标在**自管滚动容器**里的 scrollTop(px)。
 *
 * 用 offsets 直接算而不用 `scrollIntoView`:目标行在虚拟化档下大概率**没有挂载**,
 * 拿不到 DOM 节点;offsets 是同一份几何,算出来的位置与滚动条比例自洽。
 * 结果恒被钳在 `[0, total - viewportHeight]`,不会把容器滚出内容。
 */
export function resolveRevealScrollTop(input: {
  readonly offsets: readonly number[]
  readonly total: number
  readonly target: number
  readonly viewportHeight: number
  readonly align: RevealAlign
  readonly rowHeight?: number
}): number {
  const { offsets, total, align } = input
  const viewport = Number.isFinite(input.viewportHeight) ? Math.max(0, input.viewportHeight) : 0
  const rowHeight =
    Number.isFinite(input.rowHeight) && (input.rowHeight as number) > 0
      ? (input.rowHeight as number)
      : ACTIVITY_ROW_HEIGHT
  const target = toIndex(input.target)
  if (Number.isNaN(target) || target < 0) return 0
  const top = offsets[target]
  const rowTop = typeof top === 'number' && Number.isFinite(top) ? top : target * rowHeight
  const nextTop = offsets[target + 1]
  const measured =
    typeof nextTop === 'number' && Number.isFinite(nextTop) && nextTop > rowTop
      ? nextTop - rowTop
      : rowHeight
  const desired =
    align === 'center' ? rowTop - (viewport - measured) / 2 : rowTop - (viewport - measured)
  const max = Math.max(0, (Number.isFinite(total) ? total : 0) - viewport)
  return Math.min(max, Math.max(0, Math.round(desired)))
}

export interface ActivityWindowPlan {
  /** 是否真的按几何收窄了挂载面(三态里的第二态)。 */
  readonly virtualized: boolean
  readonly start: number
  readonly end: number
  readonly paddingTop: number
  readonly paddingBottom: number
  /** 累积高度表(`offsets[i]` = 第 i 行之前的总高);未虚拟化时为空数组。 */
  readonly offsets: readonly number[]
  readonly total: number
}

/**
 * 本帧的活动窗口计划(纯函数)。
 *
 * 三态判据(与 `windowing.ts` 的纪律一致,不得"量不到就乱猜区间"):
 * ① `count === 0` ⇒ 空窗口;
 * ② `count <= threshold` ⇒ **未虚拟化 + 全量区间**(短列表全量渲染更跟手);
 * ③ 视口高量不到(`NaN` / `Infinity` / `<= 0`,含首帧未布局、happy-dom 这类无布局引擎)
 *    或累计总高为 0(行高全塌缩) ⇒ **未虚拟化 + 全量区间**;
 * ④ 其余 ⇒ 虚拟化:`buildOffsets(rowHeight)` → `resolveVisibleWindow(±overscan, 上限复用
 *    windowing 的 MAX_MOUNTED_ITEMS)` → `windowPaddings` 顶住滚动条。
 */
export function planActivityWindow(input: {
  readonly count: number
  readonly readMeasuredHeight: (index: number) => number | undefined
  readonly scrollTop: number
  readonly viewportHeight: number
  readonly threshold?: number
  readonly rowHeight?: number
  readonly bufferItems?: number
  readonly maxMountedItems?: number
}): ActivityWindowPlan {
  const rawCount = toIndex(input.count)
  const count = Number.isNaN(rawCount) ? 0 : Math.max(0, rawCount)
  const empty: ActivityWindowPlan = {
    virtualized: false,
    start: 0,
    end: -1,
    paddingTop: 0,
    paddingBottom: 0,
    offsets: [],
    total: 0,
  }
  if (count === 0) return empty
  const full: ActivityWindowPlan = { ...empty, end: count - 1 }
  const threshold =
    Number.isFinite(input.threshold) && (input.threshold as number) >= 0
      ? (input.threshold as number)
      : ACTIVITY_VIRTUAL_THRESHOLD
  if (!shouldWindow(count, threshold)) return full
  const viewport = input.viewportHeight
  if (!Number.isFinite(viewport) || viewport <= 0) return full
  const rowHeight =
    Number.isFinite(input.rowHeight) && (input.rowHeight as number) > 0
      ? (input.rowHeight as number)
      : ACTIVITY_ROW_HEIGHT
  const { offsets, total } = buildOffsets(count, input.readMeasuredHeight, rowHeight)
  // 行高全塌缩(每行都量到 0)⇒ 几何不可用,与"视口量不到"同档处理。
  if (!Number.isFinite(total) || total <= 0) return full
  const win = resolveVisibleWindow({
    count,
    offsets,
    scrollTop: input.scrollTop,
    viewportHeight: viewport,
    bufferItems: input.bufferItems ?? ACTIVITY_OVERSCAN,
    maxMountedItems: input.maxMountedItems,
  })
  const pad = windowPaddings({ offsets, count, start: win.start, end: win.end })
  return {
    virtualized: true,
    start: win.start,
    end: win.end,
    paddingTop: pad.paddingTop,
    paddingBottom: pad.paddingBottom,
    offsets,
    total,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
