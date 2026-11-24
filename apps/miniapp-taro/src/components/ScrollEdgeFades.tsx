// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import BottomFadeMask, { EDGE_FADE_HEIGHT_PX } from './BottomFadeMask'

/**
 * 滚动视口上/下边缘淡出遮罩(小程序端,与 Web 端 common/ScrollEdgeFades 同名同规格,
 * 2026-11-10 多端一致定档):
 * ① 纯线性渐变:边缘实底色 → 内侧完全透明,无实底平台;
 * ② 高度 24px;③ 仅确有溢出的方向显示(顶部:内容顶已滚出视口上方;底部:视口底未到内容底);
 * ④ pointer-events 穿透,不挡滚动与点击;⑤ 色值用所在区域背景令牌(bgColorHsl,默认页面背景)。
 *
 * 溢出判定(2026-11-10 二次升级,根治「纯手指滑动遮罩滞后」):
 * ① 真值来源 = createSelectorQuery 快照:视口矩形 = `scrollSelector` 节点
 *    boundingClientRect;内容范围 = `childSelector` 全部命中节点 rect 的 min-top / max-bottom。
 * ② 实时触发器 = Taro.createIntersectionObserver(observeAll + relativeTo(scrollSelector)
 *    观察 `childSelector`):遮罩显隐当且仅当内容跨过视口边缘,而跨边缘必然使某行节点的
 *    相交比例跨过 0 ⇒ 任何交叉变化回调都排一次去抖重测,实时且零轮询。
 *    〔为何观察行而非滚动容器本身〕容器比视口大时其可见比例恒为「视口/容器」常数,
 *    滚动中永不跨阈值 ⇒ IO 失明;行节点跨过上/下边缘瞬间比例 1→0(或 0→1)必触发。
 *    〔observeAll 的快照性〕observe 只登记调用时刻存在的节点,流式新增行靠 depKey 变化
 *    重建观察(本组件 depKey 变更即重跑 effect,disconnect+重挂,与快照重测同拍)。
 * ③ 降级:IO 创建/挂载异常或低版本基础库无该 API ⇒ try/catch + typeof 双保险,
 *    静默回退「仅 depKey 快照」路径(即升级前现状,功能不失效、只失去滑动即时性)。
 * ④ 宿主直供 onScroll depKey 的路径(如 DrawerComponent 左抽屉)不受影响,照常工作。
 * 测量失败(选择器落空)⇒ 保持隐藏,零回归。
 *
 * 选择器核实(Taro 4.2.1 weapp,2026-11-10):内置组件经 base.wxml 递归模板渲染为**原生标签**
 * (view/scroll-view,无 taro-*-core 自定义组件包裹,虚拟宿主由 webpack5-runner 模板直出),
 * 故 `> view` 类选择器在页面作用域查询/IO 中真实命中。聊天页行节点是**孙级**
 * (rn-compat ScrollView 在 scroll-view 下垫一层 contentContainer view)⇒ 宿主传
 * `childSelector` 指到行层,快照与 IO 用同一选择器(见 chat-shell-extras 挂载点)。
 */

export interface ScrollEdgeFadesProps {
  /** 滚动节点选择器(类选择器,如 '.msg-list' / '.drawer-history-scroll') */
  scrollSelector: string
  /** 内容子节点选择器(快照与 IO 共用):默认 `${scrollSelector} > view`(直接子节点即内容的容器,如端内 ScrollView);行节点在孙级时宿主显式指到行层(如 '.msg-list > view > view') */
  childSelector?: string
  /** 重测触发键:内容/滚动状态变化时传入新值(组件内 120ms 去抖合并) */
  depKey?: string | number
  /** 淡出条高度(px),默认 24(多端一致规格,非必要不要改) */
  heightPx?: number
  /** 实底色源(hsl 字符串);默认 COLORS.bgPrimary(页面背景);抽屉等卡面容器传 --color-card 同值 */
  bgColorHsl?: string
  /** 层级,默认 40 */
  zIndex?: number
}

interface FadeState {
  topVisible: boolean
  bottomVisible: boolean
  /** 视口矩形(屏幕坐标 px):淡出条按此定位,窄容器(抽屉)也能贴合 */
  topCss: string
  bottomCss: string
  leftCss: string
  widthCss: string
}

const HIDDEN: FadeState = {
  topVisible: false,
  bottomVisible: false,
  topCss: '0px',
  bottomCss: '0px',
  leftCss: '0px',
  widthCss: '100%',
}

/** boundingClientRect 单节点结果的消费字段 */
interface RectLike {
  top: number
  bottom: number
  left: number
  width: number
}

/** 溢出判据的输入矩形(只需 top/bottom;快照与 IO 两条触发路径共用本判据) */
export interface EdgeRect {
  top: number
  bottom: number
}

/**
 * 溢出判据纯函数(2026-11-10 追加票:判据从 measure 抽出,单测直测):
 * - topOverflow = 任一有效行 rect.top < viewport.top - 1;
 * - bottomOverflow = 任一有效行 rect.bottom > viewport.bottom + 1;
 *   (1px 容差与 Web 端 scrollTop > 1 / scrollHeight 比较 - 1 同口径)
 * - kids 空(选择器未命中)⇒ 双 false;
 * - 尺寸 0 的行(bottom - top <= 0,隐藏占位)不计入。
 */
export function computeEdgeOverflow(
  viewport: EdgeRect,
  kids: readonly Partial<EdgeRect>[] | null | undefined,
): { topOverflow: boolean; bottomOverflow: boolean } {
  let topOverflow = false
  let bottomOverflow = false
  if (Array.isArray(kids)) {
    for (const c of kids) {
      if (typeof c.top !== 'number' || typeof c.bottom !== 'number') continue
      if (c.bottom - c.top <= 0) continue // 尺寸 0 的隐藏占位行不计入
      if (c.top < viewport.top - 1) topOverflow = true
      if (c.bottom > viewport.bottom + 1) bottomOverflow = true
    }
  }
  return { topOverflow, bottomOverflow }
}

function getWindowHeightPx(): number {
  try {
    if (typeof Taro.getWindowInfo === 'function') return Taro.getWindowInfo().windowHeight
    return Taro.getSystemInfoSync().windowHeight ?? 0
  } catch {
    return 0
  }
}

export default function ScrollEdgeFades({
  scrollSelector,
  childSelector,
  depKey,
  heightPx = EDGE_FADE_HEIGHT_PX,
  bgColorHsl,
  zIndex = 40,
}: ScrollEdgeFadesProps) {
  const [state, setState] = useState<FadeState>(HIDDEN)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const kids = childSelector ?? `${scrollSelector} > view`

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (settleRef.current) clearTimeout(settleRef.current)
    // 去抖:流式每块都会改 depKey,合并成一轮布局落定后测一次;
    // 另在 400ms 补测一轮(抽屉滑入动画 / 首帧布局未稳时,120ms 档量到的矩形会偏)。
    const measure = () => {
      const q = Taro.createSelectorQuery()
      q.select(scrollSelector).boundingClientRect()
      q.selectAll(kids).boundingClientRect()
      q.exec((res) => {
        const viewport = (res?.[0] ?? null) as RectLike | null
        const children = (res?.[1] ?? []) as RectLike[]
        if (!viewport || !Array.isArray(children) || children.length === 0) return
        // 判据纯化(见 computeEdgeOverflow):快照与 IO 两条触发路径共用同一函数
        const { topOverflow, bottomOverflow } = computeEdgeOverflow(viewport, children)
        const winH = getWindowHeightPx()
        setState({
          topVisible: topOverflow,
          bottomVisible: bottomOverflow,
          topCss: `${viewport.top}px`,
          bottomCss: `${Math.max(0, winH - viewport.bottom)}px`,
          leftCss: `${viewport.left}px`,
          widthCss: `${viewport.width}px`,
        })
      })
    }
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(measure, 120)
    }
    // ── IO 实时触发器(见头注②):行节点跨过视口上下边缘 ⇒ 相交比例跨 0 ⇒ 排一次去抖重测。
    //    降级链:typeof 判 API 存在(低版本基础库/H5 兼容层缺失) + try/catch 双保险,
    //    任一环失败 ⇒ observer=null,静默回退「depKey 快照」路径(升级前现状)。
    let observer: Taro.IntersectionObserver | null = null
    try {
      if (typeof Taro.createIntersectionObserver === 'function') {
        observer = Taro.createIntersectionObserver(Taro.getCurrentInstance().page ?? {}, {
          observeAll: true,
          initialRatio: 0,
        })
        observer.relativeTo(scrollSelector).observe(kids, schedule)
      }
    } catch {
      try {
        observer?.disconnect()
      } catch {
        /* 降级:观察器不可用,快照路径照常 */
      }
      observer = null
    }
    schedule()
    settleRef.current = setTimeout(measure, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (settleRef.current) clearTimeout(settleRef.current)
      if (observer) {
        try {
          observer.disconnect()
        } catch {
          /* 卸载期断连异常无副作用可泄漏,吞掉 */
        }
      }
    }
  }, [scrollSelector, kids, depKey])

  return (
    <>
      {state.topVisible ? (
        <BottomFadeMask
          pureGradient
          edge="top"
          heightPx={heightPx}
          topOffsetCss={state.topCss}
          leftOffsetCss={state.leftCss}
          widthCss={state.widthCss}
          bgColorHsl={bgColorHsl}
          zIndex={zIndex}
        />
      ) : null}
      {state.bottomVisible ? (
        <BottomFadeMask
          pureGradient
          edge="bottom"
          heightPx={heightPx}
          bottomOffsetCss={state.bottomCss}
          leftOffsetCss={state.leftCss}
          widthCss={state.widthCss}
          bgColorHsl={bgColorHsl}
          zIndex={zIndex}
        />
      ) : null}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
