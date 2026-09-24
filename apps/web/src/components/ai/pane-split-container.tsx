// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D73 多任务窗格分屏容器(G-100,2026-09-24 立)
//
// **禁止新建第二套会话承载(与 D52/D68 协同)**:
// 本组件是纯前端布局件 —— 只画窗格树(拆分/最大化/关闭/联动调宽/空窗格拖入)。
// 每个窗格承载的**会话内容由宿主经 `renderPaneContent` 委托传入**(复用既有会话
// 承载件,如 AISidePanel 的消息流),本组件不自建消息流状态、不订阅 useChatStore。
// 树形结构/树操作全部来自 `@ihui/shared/chat/multi-pane` 唯一真相源,组件零判定逻辑。
//
// D22 拖拽通道:空窗格只接受 `application/x-ihui-conversation`(与
// sidebar-chat-history 的 dragstart 同键),拖入后经 `onForkConversation` 由宿主
// Fork;宿主返回失败原因时用 forkFailureView 显式渲染,不静默吞掉。

'use client'

import * as React from 'react'

import { useTranslations } from 'next-intl'

import {
  FORK_FAILURE_REASONS,
  MIN_PANE_SIZE,
  PANE_CONVERSATION_DRAG_TYPE,
  type ForkFailureReason,
  type ForkFailureTone,
  type PaneLeaf,
  type PaneNode,
  type PaneSplitAxis,
  type PaneSplitNode,
  canClosePane,
  canDropToPane,
  collectPaneLeaves,
  forkFailureView,
  paneResizeKeyDelta,
  paneSplitAxis,
} from '@ihui/shared/chat/multi-pane'

import { usePaneSplitStore } from '@/stores/pane-split'

/** D22 通道键名(从判定层 re-export,组件测试与宿主统一从这里取,不再散落字面量) */
export const PANE_DROP_CONVERSATION_TYPE = PANE_CONVERSATION_DRAG_TYPE

export interface PaneSplitContainerProps {
  /**
   * 会话承载委托:宿主把既有会话渲染件传进来(复用 AISidePanel 等承载),
   * conversationId 为 null 即空窗格(宿主可渲染占位)。不传则空窗格渲染占位文案。
   */
  renderPaneContent?: (conversationId: string | null, paneId: string) => React.ReactNode
  /**
   * Fork 委托:侧栏会话拖入空窗格时由宿主执行 Fork(把会话在该窗格打开)。
   * 返回 ForkFailureReason 即失败(容器显式渲染失败视图),返回 null 即成功。
   */
  onForkConversation?: (
    conversationId: string,
    paneId: string,
  ) => Promise<ForkFailureReason | null> | ForkFailureReason | null
}

export function PaneSplitContainer(props: PaneSplitContainerProps) {
  const tree = usePaneSplitStore((s) => s.tree)
  const maximizedPaneId = usePaneSplitStore((s) => s.maximizedPaneId)
  // 字面量须与判定层 PANE_MULTI_NAMESPACE 逐字相同(组件测试里对账,勿在本文件漂移)
  const t = useTranslations('ai.pane.multiPane')

  // 最大化:只画被最大化的那一个叶子(树不动,还原即恢复全树)
  const leaves = collectPaneLeaves(tree)
  const maximized = maximizedPaneId ? leaves.find((leaf) => leaf.id === maximizedPaneId) : undefined
  const visible: PaneNode = maximized ?? tree

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      data-pane-split-root=""
      data-pane-leaf-count={leaves.length}
      data-pane-maximized={maximizedPaneId ?? ''}
      aria-label={t('ariaLabel')}
    >
      <PaneNodeView
        node={visible}
        maximized={Boolean(maximized)}
        closable={canClosePane(tree)}
        t={t}
        {...props}
      />
    </div>
  )
}

type T = ReturnType<typeof useTranslations<'ai.pane.multiPane'>>

/** 内部视图统一入参:宿主委托 + 文案 + 三态开关(开关全部由判定层算,视图不自行判树) */
type ViewProps = PaneSplitContainerProps & {
  t: T
  /** 本叶是否正处最大化态(true 时隐藏拆分/关闭,只留还原) */
  maximized: boolean
  /** 是否还可关闭(仅剩最后一格时 false,不渲染死控件) */
  closable: boolean
}

function PaneNodeView(props: ViewProps & { node: PaneNode }) {
  const { node, maximized } = props
  if (node.kind === 'split') return <PaneSplitView {...props} node={node} />
  return <PaneLeafView {...props} node={node} maximized={maximized} />
}

/** 分隔条命中区厚度(w-2/h-2 = 8px);可见细线由内层 w-px/h-px 承担(双层手柄结构) */
const RESIZER_CLASS: Record<PaneSplitAxis, { track: string; line: string }> = {
  x: {
    track: 'w-2 shrink-0 cursor-col-resize flex items-center justify-center',
    line: 'h-full w-px bg-border',
  },
  y: {
    track: 'h-2 shrink-0 cursor-row-resize flex items-center justify-center',
    line: 'w-full h-px bg-border',
  },
}

function PaneSplitView(props: ViewProps & { node: PaneSplitNode }) {
  const { node, t } = props
  // 轴向/键位增量全部问判定层,本视图不写第二套方向判定
  const axis = paneSplitAxis(node.direction)
  const resizePanes = usePaneSplitStore((s) => s.resizePanes)
  const splitElRef = React.useRef<HTMLDivElement | null>(null)
  // 拖动状态:起点(轴向坐标)+ 该轴总像素;delta 以**份额**表达,钳制与守恒都在判定层
  const dragRef = React.useRef<{ paneId: string; start: number; totalPx: number } | null>(null)

  const pointerCoord = (e: React.PointerEvent<HTMLDivElement>) =>
    axis === 'x' ? e.clientX : e.clientY

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, paneId: string) => {
    e.preventDefault()
    const box = splitElRef.current?.getBoundingClientRect()
    const totalPx = (axis === 'x' ? box?.width : box?.height) ?? 0
    dragRef.current = { paneId, start: pointerCoord(e), totalPx }
    // 宿主探测:happy-dom 未实现 setPointerCapture,拿不到捕获只影响拖拽手感,不得抛
    const el = e.currentTarget
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    // totalPx<=0 = 布局尺寸量不到(未挂载/无 CSS/测试环境),此时**不做**换算,免得把 1px 当 100%
    if (!drag || drag.totalPx <= 0) return
    resizePanes(drag.paneId, (pointerCoord(e) - drag.start) / drag.totalPx)
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  // 键盘调宽:无障碍可达,同时是用例里唯一可确定性驱动的调宽入口
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, paneId: string) => {
    const delta = paneResizeKeyDelta(node.direction, e.key)
    if (delta === 0) return
    e.preventDefault()
    resizePanes(paneId, delta)
  }

  return (
    <div
      ref={splitElRef}
      className={
        axis === 'x'
          ? 'flex h-full w-full flex-row overflow-hidden'
          : 'flex h-full w-full flex-col overflow-hidden'
      }
      data-pane-direction={node.direction}
    >
      {node.children.map((child, index) => {
        const isLast = index === node.children.length - 1
        return (
          <React.Fragment key={child.id}>
            <div
              className="relative flex min-w-0 min-h-0"
              style={{ flexGrow: node.sizes[index], flexBasis: 0 }}
            >
              <PaneNodeView {...props} node={child} maximized={false} />
            </div>
            {!isLast && (
              <div
                // 可调值分隔条:语义上是 slider(有 aria-valuenow 的可调控件),
                // 用 separator + tabIndex 会被 jsx-a11y 判"非交互元素挂键盘/焦点"
                role="slider"
                aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
                aria-label={t('resizeAriaLabel')}
                aria-valuemin={Math.round(MIN_PANE_SIZE * 100)}
                aria-valuemax={Math.round((1 - MIN_PANE_SIZE) * 100)}
                aria-valuenow={Math.round(node.sizes[index] * 100)}
                tabIndex={0}
                className={RESIZER_CLASS[axis].track}
                data-pane-resizer=""
                data-pane-resizer-for={child.id}
                data-pane-resizer-axis={axis}
                onPointerDown={(e) => onPointerDown(e, child.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => onKeyDown(e, child.id)}
              >
                {/* 双层手柄:外层命中区 + 内层可见细线(§4 禁 before: 伪元素方案) */}
                <div className={RESIZER_CLASS[axis].line} data-pane-resizer-line="" />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function PaneLeafView(props: ViewProps & { node: PaneLeaf }) {
  const { node, maximized, closable, t, renderPaneContent, onForkConversation } = props
  const splitPane = usePaneSplitStore((s) => s.splitPane)
  const closePane = usePaneSplitStore((s) => s.closePane)
  const maximizePane = usePaneSplitStore((s) => s.maximizePane)
  const restorePanes = usePaneSplitStore((s) => s.restorePanes)
  const dropConversation = usePaneSplitStore((s) => s.dropConversation)
  const setForkFailure = usePaneSplitStore((s) => s.setForkFailure)
  const clearForkFailure = usePaneSplitStore((s) => s.clearForkFailure)
  const forkReason = usePaneSplitStore((s) => s.forkFailures[node.id])
  const [dragOver, setDragOver] = React.useState(false)

  const isEmpty = canDropToPane(node)
  const forkView = forkReason ? forkFailureView(forkReason) : null

  // 空窗格拖入:只认 D22 通道,drop 后交宿主 Fork;失败原因显式渲染(不静默吞)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!e.dataTransfer.types.includes(PANE_CONVERSATION_DRAG_TYPE)) return
    // 同步取走 payload:异步回调里再读 e.dataTransfer 会被 React 置空(AGENTS.md §42)
    const payload = e.dataTransfer.getData(PANE_CONVERSATION_DRAG_TYPE)
    let conversationId: string | undefined
    try {
      conversationId = (JSON.parse(payload) as { id?: string }).id
    } catch {
      return // 非本应用拖拽源,静默忽略
    }
    if (!conversationId) return
    void (async () => {
      const failure = onForkConversation ? await onForkConversation(conversationId, node.id) : null
      if (failure) setForkFailure(node.id, failure)
      else dropConversation(node.id, conversationId)
    })()
  }

  return (
    <div
      className="flex h-full w-full min-w-0 flex-col overflow-hidden"
      data-pane-leaf={node.id}
      data-pane-conversation={node.conversationId ?? ''}
    >
      {/* 窗格头:拆分 / 最大化还原 / 关闭(用背景对比分隔,不画分割线) */}
      <div className="flex items-center gap-0.5 bg-muted/40 px-1 py-0.5" data-pane-header="">
        {!maximized && (
          <>
            <button
              type="button"
              className="rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted"
              data-action="splitRight"
              aria-label={t('splitRight')}
              onClick={() => splitPane(node.id, 'right', null)}
            >
              {t('splitRight')}
            </button>
            <button
              type="button"
              className="rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted"
              data-action="splitDown"
              aria-label={t('splitDown')}
              onClick={() => splitPane(node.id, 'down', null)}
            >
              {t('splitDown')}
            </button>
          </>
        )}
        <span className="flex-1" />
        {!maximized ? (
          <button
            type="button"
            className="rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted"
            data-action="maximize"
            aria-label={t('maximize')}
            onClick={() => maximizePane(node.id)}
          >
            {t('maximize')}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted"
            data-action="restore"
            aria-label={t('restore')}
            onClick={restorePanes}
          >
            {t('restore')}
          </button>
        )}
        {/* closable=false 即"只剩这一格",关闭钮直接不渲染(留死控件等于骗人) */}
        {!maximized && closable && (
          <button
            type="button"
            className="rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted"
            data-action="close"
            aria-label={t('closePane')}
            onClick={() => closePane(node.id)}
          >
            {t('closePane')}
          </button>
        )}
      </div>

      {/* Fork 失败显式渲染(三态文案与色调都由判定层给,不静默吞) */}
      {forkView && (
        <div
          className={`flex items-center gap-1 px-2 py-1 text-xs ${FORK_TONE_CLASS[forkView.tone]}`}
          data-pane-fork-failure={forkView.reason}
          data-pane-fork-tone={forkView.tone}
          role="alert"
          aria-label={t('forkFailureAriaLabel')}
        >
          <span>{t(forkView.titleKey)}</span>
          {forkView.retryable && (
            <button
              type="button"
              className="rounded-sm px-1.5 py-0.5 text-xs underline hover:bg-black/5"
              data-action="retryFork"
              onClick={() => clearForkFailure(node.id)}
            >
              {t('retryFork')}
            </button>
          )}
        </div>
      )}

      {/* 窗格内容:承载委托复用既有会话件;空窗格 = D22 拖入落点 */}
      <div
        className={
          'relative min-h-0 flex-1 overflow-hidden' +
          (isEmpty ? ' flex items-center justify-center bg-muted/25' : '') +
          (isEmpty && dragOver ? ' bg-muted/60' : '')
        }
        data-pane-empty={isEmpty ? '' : undefined}
        data-drag-over={dragOver ? '' : undefined}
        aria-label={isEmpty ? t('emptyPaneAriaLabel') : undefined}
        onDragOver={(e) => {
          if (isEmpty && e.dataTransfer.types.includes(PANE_CONVERSATION_DRAG_TYPE)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setDragOver(true)
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={isEmpty ? handleDrop : undefined}
      >
        {isEmpty ? (
          <span
            className="select-none text-xs text-muted-foreground"
            data-pane-empty-placeholder=""
          >
            {t('emptyPlaceholder')}
          </span>
        ) : (
          renderPaneContent?.(node.conversationId, node.id)
        )}
      </div>
    </div>
  )
}

/** Fork 失败三态语义色(Record 键 = 判定层 ForkFailureTone ⇒ 新增 tone 未补即编译红) */
const FORK_TONE_CLASS: Record<ForkFailureTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
}

/** Fork 失败三态自证:判定层 case 集与词包键集恒等(新增 reason 漏配文案 → 编译/测试双拦截) */
export const PANE_FORK_FAILURE_KEYS = FORK_FAILURE_REASONS.map(
  (reason) => forkFailureView(reason).titleKey,
) as readonly string[]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
