// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ActivityVirtualList — 单条消息内工具活动列表的**几何虚拟化**容器(2026-10-29 立)。
 *
 * 与既有两个窗口化层的分工(不重复实现,也不互替):
 * - `@/components/chat/windowing` 判**消息行**级(阈值 60 / 缓冲 6 / 上限 120),本组件把它的
 *   纯函数当判据源用(经 `./activity-virtual-window` 包一层换行高档),不另写窗口数学;
 * - `@/lib/activity-window` 判**数量截断**(40 条 + 「展开其余 N 项」),它仍是低条目数档的
 *   降级路径 —— 条目少时本组件直接全量挂载,行为与不加虚拟化一致。
 *
 * 三态纪律(与 windowing.ts 同一条,不得"量不到就乱猜区间"):
 * ① 条目数 ≤ 阈值 ⇒ 全量挂载(不出现滚动容器,不出现 `data-activity-virtualized`);
 * ② 视口高量不到 / 行高全塌缩 ⇒ 全量挂载(同上);
 * ③ 几何可用 ⇒ 只挂可见行 ± overscan,窗口外用占位高度顶住滚动条。
 *
 * 揭示语义(`revealItemIndex` / `revealItemKey`):用户点某条 ⇒ 该行居中;仅因新条目到达
 * ⇒ 贴底。判据是纯函数 `resolveRevealTarget` / `resolveRevealScrollTop`(单测直接锁数值)。
 * 注意:全量挂载档没有自管滚动容器,此时揭示滚动不发生(滚动权在外层消息列表,
 * 本组件不越权去读别人的滚动容器)——这一条是**已知边界**,如实登记而非隐藏。
 */
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { shouldWindow } from '@/components/chat/windowing'
import {
  ACTIVITY_ROW_HEIGHT,
  ACTIVITY_VIRTUAL_THRESHOLD,
  planActivityWindow,
  resolveRevealScrollTop,
  resolveRevealTarget,
} from './activity-virtual-window'

export interface ActivityVirtualListProps<T> {
  items: readonly T[]
  /** 每条的稳定键(与 `revealItemKey` 配对;缺省按下标)。 */
  itemKeys?: readonly string[]
  renderItem: (item: T, index: number) => React.ReactNode
  /** 用户显式揭示某条:优先于 `revealItemIndex`,命中即居中。 */
  revealItemKey?: string | null
  /** 用户显式揭示第几条(≥0 生效),命中即居中。 */
  revealItemIndex?: number
  /** 行高估计(px);缺省 `ACTIVITY_ROW_HEIGHT`。首帧后由实测高度接管。 */
  estimateSize?: number
  /** 低于等于本值不虚拟化;缺省 `ACTIVITY_VIRTUAL_THRESHOLD`。 */
  threshold?: number
  /** 外部给定视口高(px)。缺省读自身 clientHeight(量不到 ⇒ 全量挂载)。 */
  viewportHeight?: number
  /** 虚拟化生效时的容器最大高度类;缺省 360px(约 9 张折叠卡一屏)。 */
  maxHeightClass?: string
  className?: string
  testId?: string
}

/** 每行外包一层的测量垫片:ResizeObserver 只认节点,不认 React 树。 */
function RowShell({
  index,
  onMeasure,
  children,
}: {
  index: number
  onMeasure: (index: number, height: number) => void
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const report = () => {
      const height = node.getBoundingClientRect().height
      // 0 高读数一律当"没量到",不写进测量表:它在浏览器里几乎只有一个成因 ——
      // 行还不可见(外层折叠区 `grid-template-rows: 0fr`、容器高度 0、尚未布局)。
      // 照用 0 会让 offset 链整条塌成 0,planActivityWindow 随即退化成"全量挂载"
      // 且此后不再自愈;不写则继续用估计行高,展开后 ResizeObserver 立刻补真值。
      if (!(height > 0)) return
      onMeasure(index, height)
    }
    report()
    // 无布局引擎(SSR / 测试环境)时 ResizeObserver 可能缺失:此时只做一次首测,
    // 不阻塞渲染 —— 量不到的后果由 planActivityWindow 收敛成"全量挂载"。
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(node)
    return () => observer.disconnect()
  }, [index, onMeasure])
  return (
    <div ref={ref} data-activity-index={index}>
      {children}
    </div>
  )
}

export function ActivityVirtualList<T>({
  items,
  itemKeys,
  renderItem,
  revealItemKey,
  revealItemIndex,
  estimateSize = ACTIVITY_ROW_HEIGHT,
  threshold = ACTIVITY_VIRTUAL_THRESHOLD,
  viewportHeight,
  maxHeightClass = 'max-h-[360px]',
  className,
  testId = 'activity-virtual-list',
}: ActivityVirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const heightsRef = React.useRef<Map<number, number>>(new Map())
  const [measuredVersion, setMeasuredVersion] = React.useState(0)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [measuredViewport, setMeasuredViewport] = React.useState(0)

  const onMeasure = React.useCallback((index: number, height: number) => {
    const prev = heightsRef.current.get(index)
    // 0.5px 阈值:亚像素抖动不触发整轮重算(否则 ResizeObserver 会自激)
    if (prev !== undefined && Math.abs(prev - height) < 0.5) return
    heightsRef.current.set(index, height)
    setMeasuredVersion((v) => v + 1)
  }, [])

  const readMeasuredHeight = React.useCallback(
    (index: number) => heightsRef.current.get(index),
    // 版本号变化 ⇒ 闭包指向同一份 ref,但调用方 useMemo 需要这一维才会重算
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 有意以版本号驱动重算
    [measuredVersion],
  )

  // 条目数够不够虚拟化(纯阈值判断,与几何无关;窗口数学仍在 planActivityWindow 里)
  const eligible = shouldWindow(items.length, threshold)

  const plan = React.useMemo(
    () =>
      planActivityWindow({
        count: items.length,
        readMeasuredHeight,
        scrollTop,
        viewportHeight: viewportHeight ?? measuredViewport,
        threshold,
        rowHeight: estimateSize,
      }),
    [
      items.length,
      readMeasuredHeight,
      scrollTop,
      viewportHeight,
      measuredViewport,
      threshold,
      estimateSize,
    ],
  )

  // 视口高:外部给定优先;否则量自身。
  //
  // 依赖是 `eligible` 而不是 `plan.virtualized`:后者依赖前者 + 量到的视口高,
  // 用它当依赖会形成死锁 —— 首帧视口高为 0 ⇒ 不虚拟化 ⇒ 容器 ref 不挂 ⇒ 永远量不到
  // ⇒ 永远不虚拟化(2026-10-29 本地实测到的真缺陷,不是理论风险)。
  React.useLayoutEffect(() => {
    if (viewportHeight !== undefined || !eligible) return
    const node = containerRef.current
    if (!node) return
    const measure = () => setMeasuredViewport(node.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [viewportHeight, eligible])

  // 揭示对齐:用户指定 ⇒ center;仅因条目增长 ⇒ 贴底。整段是纯判据的消费侧,
  // 不在这里重算"该滚到哪一行"。
  //
  // 去重闩锁(2026-10-29 实测踩到的真缺陷):揭示效应的依赖里有 `plan.offsets` /
  // `plan.total`,它们随 `scrollTop` 重算 ⇒ 用户手滚一下就会把视口拽回揭示目标(滚不动)。
  // 故只在"揭示意图变化 / 条目数变化 / 从全量档切入虚拟化档"这三种情形下真的滚一次;
  // 同一目标的重复触发一律跳过。失效方向选"少滚一次"而不是"每帧拽回"。
  const lastRevealRef = React.useRef<string>('')
  const keys = itemKeys ?? []
  React.useEffect(() => {
    if (!plan.virtualized) return
    const node = containerRef.current
    if (!node) return
    const { target, align } = resolveRevealTarget({
      count: items.length,
      revealItemIndex,
      revealItemKey,
      itemKeys: keys,
    })
    if (target < 0) return
    const signature = `${target}:${align}:${items.length}`
    if (lastRevealRef.current === signature) return
    lastRevealRef.current = signature
    const top = resolveRevealScrollTop({
      offsets: plan.offsets,
      total: plan.total,
      target,
      viewportHeight: viewportHeight ?? measuredViewport,
      align,
      rowHeight: estimateSize,
    })
    // 直接写 scrollTop,不用 rAF 等一帧:滚动位置由**本层自己算的 offsets**给出
    // (与同一次 render 的占位高度同源),不等 DOM 布局;等一帧反而会让
    // "揭示已发生但 scrollTop 还是旧值"的状态多活一帧,并让本效应不可同步断言。
    node.scrollTop = top
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keys 与 items 同长,按长度比较即可
  }, [
    items.length,
    revealItemIndex,
    revealItemKey,
    plan.virtualized,
    plan.offsets,
    plan.total,
    viewportHeight,
    measuredViewport,
    estimateSize,
  ])

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  // 不满足条目数 ⇒ 全量挂载,连滚动容器都不挂(短列表交给外层消息列表滚)
  if (!eligible) {
    return (
      <div className={className} data-testid={testId}>
        {items.map((item, index) => (
          <div key={itemKeys?.[index] ?? index} data-activity-index={index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    )
  }

  // 条目数够、但**几何量不到**(首帧未布局 / 无布局引擎 / 行高全塌缩)⇒ 容器照挂、
  // 内容全量挂载:这一档必须留着容器,否则 clientHeight 永远量不到、虚拟化永远起不来。
  // 三态纪律在这里体现为"不猜区间"而不是"不挂容器"。
  // 本档不挂测高垫片:虚拟化只需要视口高,行高有估计值兜底;等视口量到、真正进入
  // 虚拟化档之后才给那几十行挂 RowShell(否则首帧白建 N 个 ResizeObserver)。
  if (!plan.virtualized) {
    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={cn('hover-scroll overflow-y-auto', maxHeightClass, className)}
        data-testid={testId}
        data-activity-total={items.length}
        data-activity-mount-mode="full"
      >
        {items.map((item, index) => (
          <div key={itemKeys?.[index] ?? index} data-activity-index={index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    )
  }

  const visible: React.ReactNode[] = []
  for (let index = plan.start; index <= plan.end; index += 1) {
    const item = items[index]
    if (item === undefined) continue
    visible.push(
      <RowShell key={itemKeys?.[index] ?? index} index={index} onMeasure={onMeasure}>
        {renderItem(item, index)}
      </RowShell>,
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn('hover-scroll overflow-y-auto', maxHeightClass, className)}
      data-testid={testId}
      data-activity-virtualized="true"
      data-activity-start={plan.start}
      data-activity-end={plan.end}
      data-activity-mounted={plan.end - plan.start + 1}
      data-activity-total={items.length}
      data-activity-padding-top={plan.paddingTop}
      data-activity-padding-bottom={plan.paddingBottom}
    >
      {plan.paddingTop > 0 && <div style={{ height: plan.paddingTop, flexShrink: 0 }} />}
      {visible}
      {plan.paddingBottom > 0 && <div style={{ height: plan.paddingBottom, flexShrink: 0 }} />}
    </div>
  )
}

export default ActivityVirtualList
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
