// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * props-resolution.ts —— rn-compat 的**纯函数 props 解析层**(无 JSX / 无 Taro 依赖)。
 *
 * 立因(2026-11-01 现读):RN 的 RefreshControl 是"被 ScrollView 消费的虚拟元素"——
 * 消费面写 `<ScrollView refreshControl={<RefreshControl refreshing onRefresh/>}>`,元素本身的
 * 渲染产物是空;真正承接手势的是 ScrollView。小程序 ScrollView 的等价物是 refresher 三件套
 * (refresherEnabled / refresherTriggered / onRefresherRefresh),它要求 ScrollView 从子元素里
 * **读出** refreshing/onRefresh 才能接上。本模块把"从 React 元素读 props"收成可单测的纯函数,
 * primitives.tsx 的 JSX 只消费它的结果 —— 这样行为钉在测试里,而不是钉在"渲染一次看看"上。
 */

/**
 * 从 RefreshControl 的 React 元素解析下拉刷新三参。
 *  · 元素缺 props / 不是元素形 ⇒ null(不开 refresher,与 RN"没挂 RefreshControl 就不能下拉"同语义);
 *  · onRefresh 不是函数 ⇒ null(refresher 开了也没人接,开了只会转圈不止);
 *  · enabled:false(RN 1.x 的禁用位)⇒ enabled=false。
 */
export interface ResolvedRefreshControl {
  refreshing: boolean
  enabled: boolean
  onRefresh?: () => void
}

export function resolveRefreshControl(rc: unknown): ResolvedRefreshControl | null {
  if (rc === null || typeof rc !== 'object') return null
  const inner = (rc as { props?: unknown }).props
  if (inner === null || typeof inner !== 'object') return null
  const p = inner as { refreshing?: unknown; onRefresh?: unknown; enabled?: unknown }
  if (typeof p.onRefresh !== 'function') return null
  return {
    refreshing: p.refreshing === true,
    enabled: p.enabled !== false,
    onRefresh: p.onRefresh as () => void,
  }
}

/**
 * ScrollView 高度边界(2026-11-06)。
 *
 * RN 的 `flex: 1` 由父级 flex 布局算出可用高度,ScrollView 因此天然可滚;
 * Taro 的 scroll-view 是原生组件,官方文档明确"使用竖向滚动时,需要给 scroll-view 一个固定高度"
 * (见 `@tarojs/components/types/ScrollView.d.ts:16-18`),否则内容把盒子撑开、永远不滚。
 *
 * 统一解法(不在页面逐处打补丁):当调用方声明了 `flex`/`flexGrow` 且没有显式尺寸时,
 * 在原语层外包一层 `flex: 1 + minHeight: 0` 的 View,内层 scroll-view 再吃 `height: 100%`
 * —— 百分比有了可解析的确定基准,等价于 RN "父 flex 撑满 + ScrollView 滚内容"。
 * 横向滚动同理,基准改成 `width: 100%`。
 *
 * 负向边界:显式 `height`(竖向)/`width`(横向)已经是确定尺寸,不再包一层,避免改变既有盒模型。
 */
export interface ResolvedScrollViewBox {
  wrapperStyle: { flex: number; minHeight: number; minWidth: number } | null
  innerStyle: { width?: '100%'; height?: '100%' }
}

export function resolveScrollViewBox(
  style: Record<string, unknown>,
  horizontal: boolean,
): ResolvedScrollViewBox {
  const flex = typeof style.flex === 'number' ? style.flex : 0
  const flexGrow = typeof style.flexGrow === 'number' ? style.flexGrow : 0
  const wantsFill = flex > 0 || flexGrow > 0
  const axisSize = horizontal ? style.width : style.height
  if (!wantsFill) return { wrapperStyle: null, innerStyle: {} }
  if (axisSize !== undefined && axisSize !== 'auto') return { wrapperStyle: null, innerStyle: {} }
  return {
    wrapperStyle: { flex: 1, minHeight: 0, minWidth: 0 },
    innerStyle: horizontal ? { width: '100%' } : { height: '100%' },
  }
}

/**
 * RN `onEndReachedThreshold` → Taro `lowerThreshold`(px)的单位换算(2026-11-06)。
 *
 * RN 的 threshold 单位是**可视长度**(ratio):`距底部距离 < threshold × 列表可视长度` 触发;
 * Taro 的 lowerThreshold 单位是**px**:`距底部/右边 < lowerThreshold` 触发。
 * 因此换算 = threshold × 视口长度,再取整;负值按 RN 语义收敛到 0(只在触底时触发)。
 *
 * 视口长度取 ScrollView 自身轴向尺寸而不是整屏:嵌套半屏列表若用 windowHeight,
 * 触发距离会被放大到两倍,滚动到底前就提前触发。
 * 取不到视口(非端内/Info 失败)时返回 undefined,由调用方保留 Taro 默认 50px,不伪造 0。
 */
export function resolveLowerThresholdPx(
  threshold: unknown,
  viewportLength: number,
): number | undefined {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return undefined
  if (!Number.isFinite(viewportLength) || viewportLength <= 0) return undefined
  return Math.max(0, Math.round(threshold * viewportLength))
}

/**
 * RN `numberOfLines` → 文本行截断源样式(2026-11-06)。
 *
 * 旧实现的缺口:Text 把 `numberOfLines === 1` 翻成 `whiteSpace: nowrap`,但 ≥2 时
 * 什么都不注入 —— `style.ts` 的 clampFrom 只读样式对象里的 `numberOfLines`,
 * 而 RN 是把它作为 **prop** 传的,于是多行截断整条丢失。
 * 这里把 prop 归一成样式键:≥2 交给 clampFrom 生成 -webkit-line-clamp;单行维持原 nowrap。
 */
export function resolveTextLineClamp(numberOfLines: unknown): Record<string, unknown> {
  const lines =
    typeof numberOfLines === 'number' && Number.isFinite(numberOfLines) && numberOfLines > 0
      ? Math.floor(numberOfLines)
      : 0
  if (lines >= 2) return { numberOfLines: lines }
  if (lines === 1) return { whiteSpace: 'nowrap' }
  return {}
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
