// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Presentation,
  Table2,
  Undo2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { SUPPORTED_EXTS } from './office-preview'

/**
 * D76 产物归属 turn 与产物面板分型(G-103/G-105,2026-09-24 立;
 * 残余票 2026-09-25 把纯派生提取至 @ihui/shared/chat/artifact-turn)。
 *
 * 平台特有:依赖 DOM(document/window/scrollIntoView),不适合共享;本模块保留
 * web 渲染层与 DOM 通道四件:
 *  1. ArtifactTurnBadge / ArtifactKindBadge:产物卡上的"第 N 轮"徽章与分型徽章;
 *  2. ArtifactTurnNav:逐 turn 前后跳导航(step-back/step-forward,←/→ 键盘支持);
 *  3. ihui:scroll-to-message / ihui:focus-artifact 双通道与 tryFocusArtifactFromLink
 *     发起端接线(残余②,2026-09-25:正文产物链接 → 反向聚焦产物卡);
 *  4. assertOfficeExtAlignment:D41 SUPPORTED_EXTS(web 定义)与共享分型表的对齐守卫。
 * 派生(artifactKindOf / collectArtifactTurns / assistantTurnOf / artifactTurnIndex)
 * 唯一真相源在共享层,此处原样 re-export(§3 各端只做薄接线,禁止端内复制派生)。
 *
 * 跳转复用既有消息锚点机制(MessageList.tsx 监听):DOM 锚 `[data-message-id]`
 * 直接 scrollIntoView + `ihui:scroll-to-message` 事件兜底(虚拟滚动窗口化时
 * 目标未渲染,由 MessageList 的监听器统一处理)。
 */

import {
  ARTIFACT_KIND_BY_EXT,
  artifactKindOf,
  artifactTurnIndex,
  collectArtifactTurns,
} from '@ihui/shared/chat/artifact-turn'
import type { ArtifactKind, ArtifactTurnSourceMessage } from '@ihui/shared/chat/artifact-turn'

// 派生层 re-export(共享层单一真相源;含 from 的 re-export 形态,§3 允许)。
// 残余①(聚焦粒度)新增出口 artifactTurnIndex:产物锚点 → 派生 turn 序列下标,
// 复用 collectArtifactTurns 的结果,不另建第二份映射。
export {
  ARTIFACT_KIND_BY_EXT,
  artifactKindOf,
  artifactTurnIndex,
  assistantTurnOf,
  collectArtifactTurns,
} from '@ihui/shared/chat/artifact-turn'
export type {
  ArtifactKind,
  TurnArtifact,
  ArtifactTurnEntry,
  ArtifactTurnSourceMessage,
} from '@ihui/shared/chat/artifact-turn'

type IconComponent = React.ComponentType<{ className?: string }>

interface KindMeta {
  readonly Icon: IconComponent
  readonly labelKey: 'kindDocument' | 'kindPresentation' | 'kindSpreadsheet' | 'kindFile'
}

const KIND_META: Readonly<Record<ArtifactKind, KindMeta>> = {
  document: { Icon: FileText, labelKey: 'kindDocument' },
  presentation: { Icon: Presentation, labelKey: 'kindPresentation' },
  spreadsheet: { Icon: Table2, labelKey: 'kindSpreadsheet' },
  file: { Icon: Paperclip, labelKey: 'kindFile' },
}

// ------------------------------------------------- 共享派生的 web 对齐守卫 ----

/** 模块级对齐守卫:D41 Office 三型(docx/xlsx/pptx)必须在共享分型表内一一有位,
 *  错位(漂移出第二套判据)时调用即抛,防两表悄悄分叉。
 *  SUPPORTED_EXTS 定义在 web 的 office-preview,故此守卫留在端内(跨端消费方
 *  各自有对齐义务时应在端内跑同形守卫,不得复制分型表)。 */
export function assertOfficeExtAlignment(): void {
  for (const ext of SUPPORTED_EXTS) {
    if (ARTIFACT_KIND_BY_EXT[ext] === undefined) {
      throw new Error(
        `artifact-turn: ext "${ext}" 缺失于 ARTIFACT_KIND_BY_EXT,须与 office-preview SUPPORTED_EXTS 对齐`,
      )
    }
  }
}

// ----------------------------------------------------------- 跳转锚点机制 ----

/** 既有事件名(MessageList.tsx 监听,勿改字面量)。 */
export const SCROLL_TO_MESSAGE_EVENT = 'ihui:scroll-to-message'
/** 反向聚焦通道事件名。发起端两处:面板 TurnNav(useArtifactTurnNav)与正文产物链接
 *  (markdown-stream → tryFocusArtifactFromLink);监听端 MessageList 容器
 *  (useFocusArtifactScroll)。payload 恒为 `{ path }`,禁止第二套事件名/载荷形状。 */
export const FOCUS_ARTIFACT_EVENT = 'ihui:focus-artifact'

/** 从产物跳回产生它的那轮:DOM 锚点直跳 + 既有事件兜底。 */
export function jumpToMessageOrigin(messageId: string): void {
  const el = document.querySelector(`[data-message-id="${messageId}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.dispatchEvent(new CustomEvent(SCROLL_TO_MESSAGE_EVENT, { detail: { messageId } }))
}

/** 反向:消息侧产物引用 → 跳回产物面板的对应卡。 */
export function emitFocusArtifact(path: string): void {
  window.dispatchEvent(new CustomEvent(FOCUS_ARTIFACT_EVENT, { detail: { path } }))
}

// ------------------------------------------------- 挂载接线(D76 第二票) ----

/**
 * 面板侧(全屏画布头部)TurnNav 状态机:从消息流派生产物 turn 序列,
 * onChangeIndex 联动双向跳转 — jumpToMessageOrigin 滚回产生该轮的消息,
 * 并 emitFocusArtifact 把消息流里的产物卡定位出来(监听在 MessageList 容器)。
 *
 * 残余①(同轮多产物聚焦首个 → 按产物 id 精确聚焦,2026-09-25):
 * onChangeIndex 是 **turn 粒度**控件的前后跳,无法表达"被点的那一个";
 * focusArtifact 补上产物粒度 —— 入参即被点产物的锚点(与卡片侧
 * `[data-artifact-path]` 同源),用共享层 artifactTurnIndex 在既有派生序列上
 * 解析所属轮(不另建映射),activeIndex 同步落到该轮后走同一条跳转通道。
 */
export function useArtifactTurnNav(messages: readonly ArtifactTurnSourceMessage[]): {
  readonly count: number
  readonly activeIndex: number
  readonly onChangeIndex: (next: number) => void
  readonly focusArtifact: (artifactPath: string) => void
  readonly reset: () => void
} {
  const turns = React.useMemo(() => collectArtifactTurns(messages), [messages])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const reset = React.useCallback(() => setActiveIndex(0), [])
  const onChangeIndex = React.useCallback(
    (next: number) => {
      setActiveIndex(next)
      const entry = turns[next]
      if (!entry) return
      jumpToMessageOrigin(entry.messageId)
      const path = entry.artifacts[0]?.path
      if (path) emitFocusArtifact(path)
    },
    [turns],
  )
  const focusArtifact = React.useCallback(
    (artifactPath: string) => {
      const idx = artifactTurnIndex(turns, artifactPath)
      if (idx === null) return
      const entry = turns[idx]
      if (!entry) return
      setActiveIndex(idx)
      jumpToMessageOrigin(entry.messageId)
      emitFocusArtifact(artifactPath)
    },
    [turns],
  )
  return {
    count: turns.length,
    activeIndex: Math.min(activeIndex, Math.max(turns.length - 1, 0)),
    onChangeIndex,
    focusArtifact,
    reset,
  }
}

/**
 * 残余②(发起端接线,2026-09-25):页面上是否存在该锚点的产物卡。
 * 选择器构造与 useFocusArtifactScroll 的容器内查询同源(`[data-artifact-path]`);
 * 锚点含选择器元字符时querySelector 抛错 → 判"无卡"(监听端同样命中不了,行为一致)。
 */
export function hasArtifactCard(anchor: string): boolean {
  try {
    return document.querySelector(`[data-artifact-path="${anchor}"]`) !== null
  } catch {
    return false
  }
}

/**
 * 残余②(发起端接线,2026-09-25):正文产物链接点击 → 反向聚焦对应产物卡。
 * 仅当页面上有同锚点卡片时接管(派发既有 ihui:focus-artifact,由 MessageList
 * 容器监听滚动定位 + 描边);无卡返回 false,调用方保持原下载 / 打开面板行为,
 * 不降级既有 UX。复用既有通道,不新增事件名 / payload 形状。
 */
export function tryFocusArtifactFromLink(href: string): boolean {
  if (!hasArtifactCard(href)) return false
  emitFocusArtifact(href)
  return true
}

/**
 * 产物面板容器的反向监听(ihui:focus-artifact):收到后滚动定位并短暂描边高亮
 * 对应产物卡([data-artifact-path] 锚点,由 ArtifactCanvas 根节点标注)。
 * 必须挂在长期存活节点(MessageList 容器) — 挂会被卸载的深层组件会复现
 * dead dispatch 缺陷(派发到空气)。
 */
export function useFocusArtifactScroll<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
): void {
  React.useEffect(() => {
    const onFocus = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path
      if (!path) return
      const el = containerRef.current?.querySelector(
        `[data-artifact-path="${path}"]`,
      ) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 高亮:临时 outline,600ms 后还原(与 MessageList flashHighlight 同节奏)
      const prev = el.style.outline
      el.style.outline = '2px solid hsl(var(--primary))'
      window.setTimeout(() => {
        el.style.outline = prev
      }, 600)
    }
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus as EventListener)
    return () => window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus as EventListener)
  }, [containerRef])
}

// ----------------------------------------------------------------- 组件 ----

interface ArtifactTurnBadgeProps {
  readonly turn: number
  readonly messageId: string
  readonly className?: string
}

/** 产物卡上的"第 N 轮"徽章:点击跳回产生它的那条 assistant 消息。 */
export function ArtifactTurnBadge({ turn, messageId, className }: ArtifactTurnBadgeProps) {
  const t = useTranslations('artifactTurn')
  return (
    <button
      type="button"
      data-testid="artifact-turn-badge"
      data-turn={turn}
      title={t('jumpToOrigin')}
      aria-label={t('jumpToOrigin')}
      onClick={() => jumpToMessageOrigin(messageId)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Undo2 className="h-3 w-3" />
      {t('turn', { turn })}
    </button>
  )
}

interface ArtifactKindBadgeProps {
  readonly nameOrPath: string
  readonly className?: string
}

/** 产物分型徽章:图标 + 文案(文档/演示/电子表格/文件)。 */
export function ArtifactKindBadge({ nameOrPath, className }: ArtifactKindBadgeProps) {
  const t = useTranslations('artifactTurn')
  const kind = artifactKindOf(nameOrPath)
  const { Icon, labelKey } = KIND_META[kind]
  return (
    <span
      data-testid="artifact-kind-badge"
      data-kind={kind}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {t(labelKey)}
    </span>
  )
}

interface ArtifactTurnNavProps {
  /** 有产物的 turn 总数(collectArtifactTurns(...).length)。 */
  readonly count: number
  /** 当前聚焦在产物 turn 序列中的下标(受控)。 */
  readonly activeIndex: number
  readonly onChangeIndex: (next: number) => void
}

/**
 * 逐 turn 前后跳导航(step-back/step-forward):在有产物的 turn 序列间移动,
 * 面板聚焦时 ←/→ 键盘可用;首个/末个对应按钮禁用。
 */
export function ArtifactTurnNav({ count, activeIndex, onChangeIndex }: ArtifactTurnNavProps) {
  const t = useTranslations('artifactTurn')
  const canBack = activeIndex > 0
  const canForward = activeIndex < count - 1

  const stepBack = React.useCallback(() => {
    if (canBack) onChangeIndex(activeIndex - 1)
  }, [canBack, onChangeIndex, activeIndex])
  const stepForward = React.useCallback(() => {
    if (canForward) onChangeIndex(activeIndex + 1)
  }, [canForward, onChangeIndex, activeIndex])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      stepBack()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      stepForward()
    }
  }

  return (
    <div
      data-testid="artifact-turn-nav"
      role="group"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/30 px-1 py-0.5"
    >
      <button
        type="button"
        data-testid="artifact-step-back"
        aria-label={t('stepBack')}
        disabled={!canBack}
        onClick={stepBack}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span
        data-testid="artifact-turn-position"
        className="min-w-8 text-center text-[10px] tabular-nums text-muted-foreground"
      >
        {Math.min(activeIndex + 1, Math.max(count, 0))}/{count}
      </span>
      <button
        type="button"
        data-testid="artifact-step-forward"
        aria-label={t('stepForward')}
        disabled={!canForward}
        onClick={stepForward}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
