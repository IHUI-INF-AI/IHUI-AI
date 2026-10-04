// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 矢量图(Mermaid)的**独立预览 Modal**(G-854)
 *
 * 为什么需要它:内联的 `MermaidDiagram` 只有缩放按钮,复杂图表在对话流里只能"就着
 * 那一小块地方看"。本票按机主拍板把预览升格为独立 Modal,并补齐
 * 适配视口 / 缩放 / 平移 / 键盘 / ctrl+滚轮定点缩放 / 双指捏合。
 *
 * 三条不可漂的写法:
 * 1. **承载层用既有原语**:直接复用 `@/components/feedback` 的 `Modal`(Radix Dialog),
 *    role=dialog、焦点陷阱、Esc 关闭都由它给。§4 明令不得自拼第三份浮层容器。
 * 2. **平移就是滚动位置**:内联渲染器的模型是"外层 `overflow-auto` 滚动 + 内层
 *    `transform: scale()` 缩放",所以平移的自然表达是 `scrollTop/scrollLeft`,
 *    不另造一套 translate 偏移当第二个真相源;定点缩放 = 换倍率后按 `scrollToKeepPoint`
 *    重算滚动,让光标(或两指中点)下的内容点不动。
 * 3. **算式一律走 `@ihui/shared/utils/diagram-viewport`**:端内不写第二份 clamp/fit/pan。
 *
 * 滚动写入的时机:倍率变了要等 `transform` 真的落进 DOM 再写滚动,否则浏览器会把
 * 目标值按**旧**内容高度截一次(内容还没长开就滚不到那儿)。所以倍率与滚动位一起存进
 * `pendingRef`,由 `useLayoutEffect` 在本次提交后、绘制前一次写完。
 */

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw, Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Modal } from '@/components/feedback'
import {
  ZOOM_STEP,
  clampZoom,
  fitZoom,
  panScroll,
  pinchZoom,
  scrollToKeepPoint,
  zoomFromKey,
  type DiagramContentPoint,
  type DiagramScroll,
  type DiagramViewportAction,
} from '@ihui/shared/utils/diagram-viewport'

export interface DiagramPreviewModalProps {
  open: boolean
  onClose: () => void
  /**
   * 已消毒的 SVG 标记。刻意由调用方(`MermaidDiagram`)把它**渲染好的那一份**传进来,
   * Modal 不再跑第二次 mermaid render —— 二次渲染既多付一次全量布局,又会造出
   * 第二个"同一张图的两个版本"。
   */
  svgMarkup: string
  /** 图标题(可空;空则由承载层用默认标题) */
  title?: React.ReactNode
}

/** 滚轮档的倍率灵敏度:deltaY=−100 ≈ 一档 ZOOM_STEP(1.22 vs 1.2),触控板连续事件不发散。 */
const WHEEL_ZOOM_SENSITIVITY = 0.002
/** 键盘方向键每一档平移的像素数(与 §4 的 32px 图标档同量级,一眼可见又不跳屏)。 */
const PAN_STEP_PX = 48

/** 一次手势后待写入的滚动位(倍率由 React 提交,滚动由布局效应补写)。 */
interface PendingView extends DiagramScroll {
  readonly zoomTo: number
}

interface TwoPointers {
  readonly a: { x: number; y: number }
  readonly b: { x: number; y: number }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function DiagramPreviewModal({
  open,
  onClose,
  svgMarkup,
  title,
}: DiagramPreviewModalProps): React.ReactElement {
  const t = useTranslations('a11y')
  const [zoom, setZoom] = React.useState(1)

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  /**
   * 画布节点。**不能只在 effect 里摸 `scrollRef.current`**:
   * Radix Dialog 的滚动锁(react-remove-scroll)第一次提交渲染的是 `null`,children 要到它自己的
   * effect 之后那次提交才挂上来 —— 于是 `useEffect(…, [open])` 里读到的 ref 恒为 null,
   * ctrl+滚轮的监听与「打开即复位/聚焦」全部**静默不生效**;而 React 合成事件路径照常工作,
   * 所以账面看起来是「渲染好了、只是手势没反应」。改由 callback ref 把节点交回 state,
   * 让两处效应都以「节点真的在场」为依赖重跑(测试里 W1 那条钉的就是它)。
   */
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null)
  const attachSurface = React.useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node
    setSurface(node)
  }, [])
  /** 与已提交的 zoom 同步的镜像:原生 wheel / pointer 回调靠它读"当前倍率",不吃闭包旧值。 */
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  const pendingRef = React.useRef<PendingView | null>(null)
  /** 活动指针表:1 个 = 拖拽平移,2 个 = 捏合。 */
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    base: DiagramScroll
  } | null>(null)
  const pinchRef = React.useRef<{ dist: number; baseZoom: number } | null>(null)

  /** 量视口与内容的自然尺寸(未缩放像素)。jsdom / 未挂载 ⇒ 各维回 0,由共享层判"没量到"。 */
  const measure = React.useCallback((): {
    viewportW: number
    viewportH: number
    naturalW: number
    naturalH: number
  } => {
    const viewport = scrollRef.current
    const content = contentRef.current
    const z = zoomRef.current
    const rect = content?.getBoundingClientRect()
    return {
      viewportW: viewport?.clientWidth ?? 0,
      viewportH: viewport?.clientHeight ?? 0,
      naturalW: rect && z > 0 ? rect.width / z : 0,
      naturalH: rect && z > 0 ? rect.height / z : 0,
    }
  }, [])

  /** 当前**视图**的真相:有待提交就用待提交值,否则读 DOM。链式手势(连滚两轮)靠它连续。 */
  const currentView = (): { zoom: number; scroll: DiagramScroll } => {
    const pending = pendingRef.current
    const el = scrollRef.current
    return {
      zoom: pending?.zoomTo ?? zoomRef.current,
      scroll: pending
        ? { scrollTop: pending.scrollTop, scrollLeft: pending.scrollLeft }
        : { scrollTop: el?.scrollTop ?? 0, scrollLeft: el?.scrollLeft ?? 0 },
    }
  }

  const writeScroll = (scroll: DiagramScroll): void => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = scroll.scrollTop
    el.scrollLeft = scroll.scrollLeft
  }

  /** 客户端坐标 → 内容坐标(未缩放)。`transformOrigin: 'top left'` 下这就是定点缩放的锚点。 */
  const pointAt = (clientX: number, clientY: number): DiagramContentPoint => {
    const el = scrollRef.current
    const view = currentView()
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: (clientX - rect.left + view.scroll.scrollLeft) / view.zoom,
      y: (clientY - rect.top + view.scroll.scrollTop) / view.zoom,
    }
  }

  /** 视口中心的内容坐标:按钮/键盘改倍率时锚在这里,画面不"往左上跑"。 */
  const centerPoint = (): DiagramContentPoint => {
    const el = scrollRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return pointAt(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const applyZoom = (rawNext: number, point: DiagramContentPoint, override?: DiagramScroll): void => {
    const next = clampZoom(rawNext)
    const view = currentView()
    const el = scrollRef.current
    if (!Number.isFinite(next)) return
    if (!el) {
      setZoom(next)
      return
    }
    const scroll =
      override ??
      scrollToKeepPoint({ ...measure(), zoomFrom: view.zoom, zoomTo: next, point, scroll: view.scroll })
    if (next === view.zoom) {
      // 倍率没变 ⇒ transform 已是最终态,滚动可以立刻写,不必等下一次提交
      pendingRef.current = null
      writeScroll(scroll)
      return
    }
    pendingRef.current = { zoomTo: next, scrollTop: scroll.scrollTop, scrollLeft: scroll.scrollLeft }
    setZoom(next)
  }

  /**
   * 把滚动平移 `from + delta` 并钳制。
   * `from` 是显式入参而不是"当前 DOM 滚动位",因为**拖拽**的增量是从按下那一刻算起的:
   * 每一次 move 都拿同一个基线算,才会"跟手";若改成拿实时值累加,同一趟拖拽里每来一个
   * move 就把「按下点到当前点」这段位移再算一遍,越甩越远(测试里"两段 move 仍等于基线 +
   * 总位移"那一条钉的就是它)。
   */
  const panTo = (from: DiagramScroll, dx: number, dy: number): void => {
    const view = currentView()
    const m = measure()
    const next = panScroll({
      naturalW: m.naturalW,
      naturalH: m.naturalH,
      viewportW: m.viewportW,
      viewportH: m.viewportH,
      zoom: view.zoom,
      scroll: from,
      delta: { dx, dy },
    })
    const pending = pendingRef.current
    if (pending) {
      pendingRef.current = { ...pending, scrollTop: next.scrollTop, scrollLeft: next.scrollLeft }
      return
    }
    writeScroll(next)
  }

  /** 键盘/程序化的平移:基线就是当前视图。 */
  const panBy = (dx: number, dy: number): void => {
    panTo(currentView().scroll, dx, dy)
  }

  const runAction = (action: DiagramViewportAction): void => {
    const view = currentView()
    switch (action) {
      case 'in':
        applyZoom(view.zoom * ZOOM_STEP, centerPoint())
        return
      case 'out':
        applyZoom(view.zoom / ZOOM_STEP, centerPoint())
        return
      case 'reset':
        applyZoom(1, { x: 0, y: 0 })
        return
      case 'fit': {
        const m = measure()
        applyZoom(fitZoom(m), { x: 0, y: 0 }, { scrollTop: 0, scrollLeft: 0 })
        return
      }
      case 'pan-left':
        panBy(-PAN_STEP_PX, 0)
        return
      case 'pan-right':
        panBy(PAN_STEP_PX, 0)
        return
      case 'pan-up':
        panBy(0, -PAN_STEP_PX)
        return
      case 'pan-down':
        panBy(0, PAN_STEP_PX)
        return
    }
  }

  /**
   * 倍率变了要等 transform 落进 DOM 再写滚动(见文件头第 3 条)。
   * 效应跑在浏览器绘制前,所以用户不会看到"先跳一下再到位"。
   */
  React.useLayoutEffect(() => {
    const pending = pendingRef.current
    if (!pending) return
    if (pending.zoomTo !== zoom) return
    pendingRef.current = null
    writeScroll({ scrollTop: pending.scrollTop, scrollLeft: pending.scrollLeft })
  }, [zoom])

  /** 打开 = 一次全新的预览:倍率、滚动、手势状态全部复位(不得带着上一张图的视角)。 */
  React.useEffect(() => {
    if (!open || !surface) return
    pendingRef.current = null
    dragRef.current = null
    pinchRef.current = null
    pointersRef.current.clear()
    setZoom(1)
    writeScroll({ scrollTop: 0, scrollLeft: 0 })
    // 焦点落到画布上,方向键立刻可用(Radix 默认把焦点给 Content,而 Content 不是本组件的祖先)
    surface.focus({ preventScroll: true })
  }, [open, surface])

  /**
   * 画布上的两个**原生**监听:ctrl(+meta)滚轮 = 定点缩放,键盘 = 倍率与平移。
   *
   * 为什么走原生而不是 JSX props:
   * · wheel —— React 的 onWheel 在根容器上是 passive 的,`preventDefault()` 会静默失效,
   *   于是浏览器的"页面级缩放"抢走这次手势,而账面看起来"处理过了";
   * · keydown —— 与滚轮同一处挂载点,并且让画布节点在 JSX 上不携带键盘处理器
   *   (`role="application"` 的自定义控件会被 jsx-a11y 的 interactions 规则按静态元素判)。
   * 两个回调都只读 ref / 调 setState(二者稳定),所以闭包不会过期 —— 依赖里刻意只有
   * 「节点在场 + open」。
   * 普通滚轮(无修饰键)不动倍率 —— 它本来就是滚动意图,吃掉它就是 bug。
   */
  React.useEffect(() => {
    if (!open || !surface) return
    const el = surface
    const onWheel = (event: WheelEvent): void => {
      if (event.defaultPrevented) return
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const view = currentView()
      const next = clampZoom(view.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY))
      applyZoom(next, pointAt(event.clientX, event.clientY))
    }
    /**
     * 键盘判序(G-843 那条纪律):先看 defaultPrevented(上层已处理就什么都别做),
     * 再问共享层"这个键归不归预览器管",认不出 ⇒ **不 preventDefault、不吞事件**。
     * Escape 刻意不在表里 —— 关窗归承载层。
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const action = zoomFromKey(event.key, { ctrlKey: event.ctrlKey, metaKey: event.metaKey })
      if (action === null) return
      event.preventDefault()
      runAction(action)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 两个回调只读 ref 与调 setState(都稳定),每次渲染重建的那批函数也只读这两类值;把它们列进依赖等于让监听器在每次手势后重挂一次,而"重挂"正是本 effect 上那条挂载时机注释要避免的事
  }, [open, surface])

  const releaseCapture = (pointerId: number): void => {
    const el = scrollRef.current
    if (!el || typeof el.releasePointerCapture !== 'function') return
    try {
      if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
    } catch {
      // jsdom/旧浏览器未实现捕获 API:释放失败不影响手势收尾
    }
  }

  const capturePointer = (target: HTMLElement, pointerId: number): void => {
    if (typeof target.setPointerCapture !== 'function') return
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // 同上:捕获是增强项,拿不到就退回事件冒泡路径
    }
  }

  /** 捏合的两指中点(内容坐标)—— 与 ctrl+滚轮共用同一条定点算式,只有锚点不同。 */
  const pinchMidpointPoint = (pair: TwoPointers): DiagramContentPoint =>
    pointAt((pair.a.x + pair.b.x) / 2, (pair.a.y + pair.b.y) / 2)

  const twoPointers = (): TwoPointers | null => {
    const list = [...pointersRef.current.values()]
    if (list.length < 2) return null
    return { a: list[0] as { x: number; y: number }, b: list[1] as { x: number; y: number } }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      // 进入捏合:拖拽基线作废,否则抬手时会把中点位移当成一次平移
      dragRef.current = null
      const pair = twoPointers()
      if (pair) pinchRef.current = { dist: distance(pair.a, pair.b), baseZoom: currentView().zoom }
      return
    }
    if (pointersRef.current.size > 2) {
      pinchRef.current = null
      return
    }
    capturePointer(event.currentTarget, event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: currentView().scroll,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const pair = twoPointers()
    if (pair && pinchRef.current) {
      const prev = pinchRef.current
      const nextDistance = distance(pair.a, pair.b)
      const next = pinchZoom({
        prevDistance: prev.dist,
        nextDistance,
        baseZoom: prev.baseZoom,
      })
      pinchRef.current = { dist: nextDistance, baseZoom: next }
      applyZoom(next, pinchMidpointPoint(pair))
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // 拖向右 = 往回看 ⇒ 增量取反;基线取按下那一刻的滚动位,钳制交给共享层(溢出为 0 的轴自然拖不动)
    panTo(drag.base, drag.startX - event.clientX, drag.startY - event.clientY)
  }

  const endPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.delete(event.pointerId)
    releaseCapture(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) dragRef.current = null
  }

  /**
   * 画布卸载(含关闭)时收口手势:残留的指针捕获会把后续的 hover/click 命中到这个已经不在的节点上
   * (与图片预览那条"三个出口都要显式 release"是同一条纪律)。
   * 节点与 Map 都在效应体内取成局部变量 —— 在 cleanup 里读 `xRef.current` 正是 react-hooks
   * 那条告警点名的形态;Map 实例本身从不被替换(只增删元素),所以取引用是等价的。
   */
  React.useEffect(() => {
    const node = surface
    const pointers = pointersRef.current
    return () => {
      if (node && typeof node.releasePointerCapture === 'function') {
        for (const pointerId of pointers.keys()) {
          try {
            if (node.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId)
          } catch {
            // 卸载竞态下释放失败无副作用
          }
        }
      }
      pointers.clear()
      dragRef.current = null
      pinchRef.current = null
      pendingRef.current = null
    }
  }, [surface])

  const iconBtn = 'text-muted-foreground'

  return (
    <Modal open={open} onClose={onClose} size="full" title={title ?? t('mermaidPreviewTitle')}>
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-0.5 self-end rounded-md border border-border/60 bg-float-indicator-bg p-0.5"
          data-testid="diagram-preview-toolbar"
        >
          <Button
            type="button"
            size="icon-2xs"
            variant="ghost"
            onClick={() => runAction('out')}
            data-testid="diagram-preview-zoom-out"
            aria-label={t('mermaidZoomOut')}
            className={iconBtn}
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <span
            data-testid="diagram-preview-zoom-level"
            aria-label={t('mermaidZoomLevel')}
            className="min-w-9 text-center text-[11px] tabular-nums text-muted-foreground"
          >
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="icon-2xs"
            variant="ghost"
            onClick={() => runAction('in')}
            data-testid="diagram-preview-zoom-in"
            aria-label={t('mermaidZoomIn')}
            className={iconBtn}
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-2xs"
            variant="ghost"
            onClick={() => runAction('fit')}
            data-testid="diagram-preview-zoom-fit"
            aria-label={t('mermaidZoomToFit')}
            className={iconBtn}
          >
            <Scan className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-2xs"
            variant="ghost"
            onClick={() => runAction('reset')}
            data-testid="diagram-preview-zoom-reset"
            aria-label={t('mermaidZoomReset')}
            className={iconBtn}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        {/* 画布:键盘与滚轮走原生监听(见上方 effect),指针事件留在 JSX 上;焦点落在这里,
            方向键与加减号才有去处。`role="application"` 是"自定义手势控件"的既有 ARIA 口径
            (地图类控件同款)—— 这些键改变的是视图而不是页面滚动,读屏需要把键交给页面。 */}
        <div
          ref={attachSurface}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- application 角色下的自定义手势控件必须可聚焦:不给 tabIndex 就收不到键盘,而这张画布没有可当代理的按钮
          tabIndex={0}
          role="application"
          aria-label={t('mermaidPreviewCanvas')}
          data-testid="diagram-preview-scroll"
          className="h-[60vh] w-full overflow-auto border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <div
            ref={contentRef}
            data-testid="diagram-preview-content"
            className="origin-top-left"
            style={
              zoom === 1 ? undefined : { transform: `scale(${zoom})`, transformOrigin: 'top left' }
            }
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      </div>
    </Modal>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
