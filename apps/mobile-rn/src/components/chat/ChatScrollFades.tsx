// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 聊天滚动淡出(多端一致「边缘渐变覆盖层」规格的 RN 封装):
// 滚动视口上、下两条边缘各贴一条 24px 纯线性渐变,仅当该方向确有溢出时显示。
// RN 不支持 CSS mask-image,渐变本体由 BottomFadeMask(react-native-svg)绘制。

import { useCallback, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import BottomFadeMask from '../BottomFadeMask'

/** 多端一致规格:边缘渐变覆盖层高度(px),与 Web 端定稿同参 */
export const CHAT_EDGE_FADE_HEIGHT_PX = 24

/** 纵向滚动度量:已滚距离 / 内容总高 / 视口高 */
export interface ScrollFadeMetrics {
  offset: number
  contentLength: number
  visibleLength: number
}

/** 两方向溢出判定结果(遮罩显隐) */
export interface ChatScrollFadesState {
  topVisible: boolean
  bottomVisible: boolean
}

export interface UseChatScrollFadesResult extends ChatScrollFadesState {
  /** 挂到滚动容器 onScroll(调用方须同时设 scrollEventThrottle={16}) */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  /** 挂到滚动容器 onLayout(视口高度变化时重判) */
  onLayout: (e: LayoutChangeEvent) => void
  /** 挂到滚动容器 onContentSizeChange(内容高度变化时重判) */
  onContentSizeChange: (contentWidth: number, contentHeight: number) => void
  /** 直接喂一份度量(供无法持有 onScroll 的宿主桥接用,见 attachScrollFadesToFlatList) */
  feed: (m: ScrollFadeMetrics) => void
  /** 最近一次度量(宿主据此计算遮罩 inset;尚无事件时为 null) */
  getLastMetrics: () => ScrollFadeMetrics | null
}

/** 浮点抖动容差(px):小于该值不认为有溢出/位移 */
const EPS = 0.5

/**
 * 溢出判据(纯函数,与 Web 端定稿一致;单测直接钉这份实现):
 * 顶部 = 已向下滚动(offset > EPS);底部 = 视口底未到内容底(contentLength − offset − visibleLength > EPS)。
 * 视口尚未测量(visibleLength ≤ 0)时两方向判据都无意义 ⇒ 双 false(否则会把「未测量」误判成底部溢出)。
 */
export function computeFadeVisibility(m: ScrollFadeMetrics): ChatScrollFadesState {
  if (m.visibleLength <= 0) return { topVisible: false, bottomVisible: false }
  return {
    topVisible: m.offset > EPS,
    bottomVisible: m.contentLength - m.offset - m.visibleLength > EPS,
  }
}

/**
 * 聊天滚动淡出的溢出判定 hook。
 * 判据见 computeFadeVisibility(唯一实现)。
 * 度量只存 ref,仅显隐变化才 setState,滚动帧不引发无谓重渲。
 */
export function useChatScrollFades(): UseChatScrollFadesResult {
  const metricsRef = useRef<ScrollFadeMetrics | null>(null)
  const [state, setState] = useState<ChatScrollFadesState>({
    topVisible: false,
    bottomVisible: false,
  })

  const feed = useCallback((m: ScrollFadeMetrics) => {
    metricsRef.current = m
    const { topVisible, bottomVisible } = computeFadeVisibility(m)
    setState((prev) =>
      prev.topVisible === topVisible && prev.bottomVisible === bottomVisible
        ? prev
        : { topVisible, bottomVisible },
    )
  }, [])

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const ne = e.nativeEvent
      feed({
        offset: ne.contentOffset.y,
        contentLength: ne.contentSize.height,
        visibleLength: ne.layoutMeasurement.height,
      })
    },
    [feed],
  )

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const prev = metricsRef.current ?? { offset: 0, contentLength: 0, visibleLength: 0 }
      feed({ ...prev, visibleLength: e.nativeEvent.layout.height })
    },
    [feed],
  )

  const onContentSizeChange = useCallback(
    (_contentWidth: number, contentHeight: number) => {
      const prev = metricsRef.current ?? { offset: 0, contentLength: 0, visibleLength: 0 }
      feed({ ...prev, contentLength: contentHeight })
    },
    [feed],
  )

  const getLastMetrics = useCallback(() => metricsRef.current, [])

  return { ...state, onScroll, onLayout, onContentSizeChange, feed, getLastMetrics }
}

export interface ChatScrollFadesProps extends ChatScrollFadesState {
  /** 顶部遮罩距父容器顶的内缩(px):滚动视口上沿不在容器顶时由宿主传入 */
  topInset?: number
  /** 底部遮罩距父容器底的内缩(px):滚动视口下方还有固定 UI(状态条/队列条)时由宿主传入 */
  bottomInset?: number
  /** 渐变高度(px),默认 24 */
  heightPx?: number
  /** 底色覆盖(默认页面背景令牌;抽屉等面板场景传面板自身底色) */
  color?: string
}

/**
 * 聊天滚动淡出遮罩对:贴滚动视口上、下边缘的边缘渐变覆盖层。
 * 挂在与滚动视口同界的 relative 父容器内;整条链 pointerEvents 穿透,不挡滚动与点击。
 * 显隐由宿主经 useChatScrollFades 判定后传入。
 */
export function ChatScrollFades({
  topVisible,
  bottomVisible,
  topInset = 0,
  bottomInset = 0,
  heightPx = CHAT_EDGE_FADE_HEIGHT_PX,
  color,
}: ChatScrollFadesProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {topVisible ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: topInset, height: heightPx }}>
          <BottomFadeMask edge="top" heightPx={heightPx} color={color} />
        </View>
      ) : null}
      {bottomVisible ? (
        <View
          style={{ position: 'absolute', left: 0, right: 0, bottom: bottomInset, height: heightPx }}
        >
          <BottomFadeMask edge="bottom" heightPx={heightPx} color={color} />
        </View>
      ) : null}
    </View>
  )
}

/**
 * 桥接:把「本端不创建、无法加 onScroll」的 FlatList 的原生滚动度量喂给回调。
 *
 * 背景:RN ChatScreen 的消息 FlatList 由跨端共享包 @ihui/rn-app(packages/app)内部创建
 * (web / 小程序共同消费,本票禁改),RN 侧只经 onListRef 拿到实例;RN 不支持给已挂载的
 * 列表追加 onScroll prop。优先链(逐级探测,任一级不可用即静默降级,绝不抛错):
 *   A. 公共事件契约:vl.getNativeScrollRef?.() ?? vl.getScrollRef?.() 取 ScrollView 实例,
 *      若其支持 addEventListener/removeEventListener(react-navigation 同款用法)则订阅
 *      'scroll',回调从 e.nativeEvent 取 contentOffset/contentSize/layoutMeasurement;
 *      首帧用公共 vl.getScrollMetrics?.() 补测;detach 时 removeEventListener。
 *   B. 私有字段兜底(当前 RN 0.86 的实际生效路径:已核实 ScrollView 类未提供
 *      addEventListener、VirtualizedList 未暴露 getNativeScrollRef/getScrollMetrics
 *      实例方法 ⇒ A 探测必不命中,自动落 B):包一层 VirtualizedList._onScroll(类字段
 *      箭头函数,实例属性覆写安全),再 forceUpdate 让 ScrollView 的 onScroll 引用尽快
 *      指向包装版;首帧从 _scrollMetrics 补测。未来 RN/第三方列表若补齐公共契约,自动升 A。
 *   C. 两者皆不可用 ⇒ no-op(遮罩不显示,不崩不报错)。
 * 返回 detach;同一实例重复挂载(StrictMode 双跑等)由实例标记去重(覆盖 A/B 两种模式)。
 */
const HOOK_KEY = '__ihuiChatScrollFade'

/** 链 A 订阅目标:仅当实例暴露 addEventListener/removeEventListener 公共契约时使用 */
interface ScrollEventTarget {
  addEventListener?: (
    event: 'scroll',
    handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
  ) => void
  removeEventListener?: (
    event: 'scroll',
    handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
  ) => void
}

/** 度量原始形态:公共 getScrollMetrics 与私有 _scrollMetrics 字段并集,归一化后统一为 ScrollFadeMetrics */
interface RawScrollMetrics {
  offset?: number
  contentOffset?: { x: number; y: number }
  contentLength?: number
  visibleLength?: number
}

/** 桥接所需 VirtualizedList 运行时形态(公共 API + 私有字段的类型断言集中于此,勿散落) */
interface VirtualizedListBridge {
  // ── 链 A(公共 API,均可缺失) ──
  getNativeScrollRef?: () => ScrollEventTarget | null | undefined
  getScrollRef?: () => ScrollEventTarget | null | undefined
  getScrollMetrics?: () => RawScrollMetrics
  // ── 链 B(私有字段,均可缺失) ──
  _onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  _scrollMetrics?: RawScrollMetrics
  _listMetrics?: { getContentLength?: () => number }
  forceUpdate?: () => void
  // ── 去重标记(覆盖 A/B 两种模式) ──
  [HOOK_KEY]?: boolean
}

function getVirtualizedListBridge(list: unknown): VirtualizedListBridge | undefined {
  return (list as { _listRef?: VirtualizedListBridge } | null | undefined)?._listRef
}

/**
 * 归一化两态度量:公共契约为 {contentOffset:{x,y}, contentLength, visibleLength};
 * RN 0.86 私有 _scrollMetrics 实为 {offset, visibleLength, dt, ...}(无 contentLength,
 * 经 _listMetrics.getContentLength() 兜底,再缺则 0 ⇒ 底部保守隐藏,首个真实滚动即纠正)。
 */
function normalizeScrollMetrics(
  vl: VirtualizedListBridge,
  raw: RawScrollMetrics | null | undefined,
): ScrollFadeMetrics | null {
  if (!raw) return null
  const offset = typeof raw.offset === 'number' ? raw.offset : raw.contentOffset?.y
  const visibleLength = raw.visibleLength
  if (typeof offset !== 'number' || typeof visibleLength !== 'number') return null
  let contentLength = raw.contentLength
  if (typeof contentLength !== 'number') {
    const viaListMetrics = vl._listMetrics?.getContentLength?.()
    contentLength = typeof viaListMetrics === 'number' ? viaListMetrics : 0
  }
  return { offset, contentLength, visibleLength }
}

export function attachScrollFadesToFlatList(
  list: unknown,
  onMetrics: (m: ScrollFadeMetrics) => void,
): () => void {
  const vl = getVirtualizedListBridge(list)
  if (!vl || vl[HOOK_KEY] === true) return () => {}

  // ── 链 A:公共事件契约(优先) ──
  try {
    const target = vl.getNativeScrollRef?.() ?? vl.getScrollRef?.()
    if (
      target &&
      typeof target.addEventListener === 'function' &&
      typeof target.removeEventListener === 'function'
    ) {
      const cb = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const ne = e?.nativeEvent
        if (ne) {
          onMetrics({
            offset: ne.contentOffset.y,
            contentLength: ne.contentSize.height,
            visibleLength: ne.layoutMeasurement.height,
          })
        }
      }
      target.addEventListener('scroll', cb)
      vl[HOOK_KEY] = true
      // 首帧同步:公共 getScrollMetrics 补测挂载前已发生的布局
      const m0 = normalizeScrollMetrics(vl, vl.getScrollMetrics?.())
      if (m0) onMetrics(m0)
      return () => {
        try {
          // detach 闭包内可选方法调用:?. 保留 this 绑定并满足 strictNullChecks
          target.removeEventListener?.('scroll', cb)
        } catch {
          // 卸载竞态(目标已销毁):忽略,标记复位即可
        }
        vl[HOOK_KEY] = false
      }
    }
  } catch {
    // A 探测/订阅抛错 ⇒ 静默落 B
  }

  // ── 链 B:私有字段包裹(当前 RN 0.86 实际生效路径) ──
  if (typeof vl._onScroll !== 'function' || typeof vl.forceUpdate !== 'function') {
    return () => {} // 链 C:不可桥接 ⇒ 遮罩不显示,不崩
  }
  const orig = vl._onScroll
  vl._onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // 类字段箭头函数,this 已绑定 ⇒ 直接调用即可(strictBindCallApply 下勿用 orig.call)
    orig(e)
    const ne = e?.nativeEvent
    if (ne) {
      onMetrics({
        offset: ne.contentOffset.y,
        contentLength: ne.contentSize.height,
        visibleLength: ne.layoutMeasurement.height,
      })
    }
  }
  vl[HOOK_KEY] = true
  vl.forceUpdate()
  // 首帧同步:私有 _scrollMetrics 补测(contentLength 缺失时经 _listMetrics 兜底)
  const m0 = normalizeScrollMetrics(vl, vl._scrollMetrics)
  if (m0) onMetrics(m0)
  return () => {
    vl._onScroll = orig
    vl[HOOK_KEY] = false
  }
}

/** 读取桥接列表的当前度量(宿主 onLayout 后同帧补喂 inset 用;公共方法优先、私有字段兜底,拿不到返回 null) */
export function readFlatListScrollMetrics(list: unknown): ScrollFadeMetrics | null {
  const vl = getVirtualizedListBridge(list)
  if (!vl) return null
  return normalizeScrollMetrics(vl, vl.getScrollMetrics?.() ?? vl._scrollMetrics)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
