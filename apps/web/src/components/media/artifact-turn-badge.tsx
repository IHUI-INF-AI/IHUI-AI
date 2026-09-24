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
 * D76 产物归属 turn 与产物面板分型(G-103/G-105,2026-09-24 立)。
 *
 * 本模块是产物 turn 归属的 web 渲染层唯一实现,含四件:
 *  1. artifactKindOf:扩展名 → 四型判据(显式 const 表,Office 三型 import 复用
 *     D41 office-preview 的 SUPPORTED_EXTS,禁止第二套判据);
 *  2. collectArtifactTurns:从消息流现有结构派生 originating turn(产物产生于
 *     哪条 assistant 消息),不需要新契约字段(持久化缺口在 D76 报告登记,D33 同批);
 *  3. ArtifactTurnBadge / ArtifactKindBadge:产物卡上的"第 N 轮"徽章与分型徽章;
 *  4. ArtifactTurnNav:逐 turn 前后跳导航(step-back/step-forward,←/→ 键盘支持)。
 *
 * 跳转复用既有消息锚点机制(MessageList.tsx 监听):DOM 锚 `[data-message-id]`
 * 直接 scrollIntoView + `ihui:scroll-to-message` 事件兜底(虚拟滚动窗口化时
 * 目标未渲染,由 MessageList 的监听器统一处理)。
 */

/** 产物四型。 */
export type ArtifactKind = 'document' | 'presentation' | 'spreadsheet' | 'file'

/**
 * 扩展名 → 分型判据表(显式 const,小写、不带点):
 *  - docx/pptx/xlsx 与 D41 OfficePreview 的 SUPPORTED_EXTS(import 复用)一一对应;
 *  - md 走消息流 markdown 渲染、csv 走 message-file-preview 的 CsvPreview,
 *    语义同为文档/电子表格;
 *  - 其余一律 'file',不做启发式扩散(判据可穷举,不猜)。
 */
const ARTIFACT_KIND_BY_EXT: Readonly<Record<string, ArtifactKind>> = {
  docx: 'document',
  md: 'document',
  pptx: 'presentation',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
}

/** 文件名/路径/URL → 产物分型。取最后一段扩展名,忽略 ?query/#hash;无扩展名归 'file'。 */
export function artifactKindOf(nameOrPath: string): ArtifactKind {
  const base = nameOrPath.split(/[?#]/, 1)[0] ?? ''
  const dot = base.lastIndexOf('.')
  if (dot < 0) return 'file'
  return ARTIFACT_KIND_BY_EXT[base.slice(dot + 1).toLowerCase()] ?? 'file'
}

/** 模块级对齐守卫:D41 Office 三型(docx/xlsx/pptx)必须在本判据表内一一有位,
 *  错位(漂移出第二套判据)时首次调用即抛,防两表悄悄分叉。 */
export function assertOfficeExtAlignment(): void {
  for (const ext of SUPPORTED_EXTS) {
    if (ARTIFACT_KIND_BY_EXT[ext] === undefined) {
      throw new Error(
        `artifact-turn: ext "${ext}" 缺失于 ARTIFACT_KIND_BY_EXT,须与 office-preview SUPPORTED_EXTS 对齐`,
      )
    }
  }
}

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

// ------------------------------------------------------- turn 派生(纯函数) ----

/** 产物条目(渲染层最小形态,path/name 二选一)。 */
export interface TurnArtifact {
  readonly path: string
  readonly kind: ArtifactKind
}

/** 一个"有产物的 turn":第 N 轮 = 第 N 条 assistant 回答(1 起)。 */
export interface ArtifactTurnEntry {
  readonly turn: number
  readonly messageId: string
  readonly artifacts: readonly TurnArtifact[]
}

/** 消息流最小结构面(直接兼容 ChatMessage,不引入契约依赖)。 */
export interface ArtifactTurnSourceMessage {
  readonly id: string
  readonly role: string
  readonly toolCalls?: ReadonlyArray<{
    readonly summary_data?: {
      readonly artifacts?: ReadonlyArray<{ readonly path?: string; readonly name?: string }>
    }
  }>
}

/**
 * 从消息流派生"有产物的 turn"序列(保持会话顺序):
 * originating turn = 产物所在 toolCall 挂着的那条 assistant 消息,
 * turn 序号 = 该 assistant 消息在全部 assistant 消息中的 1 基序号。
 * 无 path/name 的产物条目跳过;无产物的 assistant 消息不出现在结果里(但仍占序号)。
 */
export function collectArtifactTurns(
  messages: readonly ArtifactTurnSourceMessage[],
): ArtifactTurnEntry[] {
  let turn = 0
  const out: ArtifactTurnEntry[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    turn += 1
    const artifacts: TurnArtifact[] = []
    for (const tc of m.toolCalls ?? []) {
      for (const a of tc.summary_data?.artifacts ?? []) {
        const p = a.path ?? a.name
        if (typeof p === 'string' && p.length > 0) {
          artifacts.push({ path: p, kind: artifactKindOf(p) })
        }
      }
    }
    if (artifacts.length > 0) out.push({ turn, messageId: m.id, artifacts })
  }
  return out
}

// ----------------------------------------------------------- 跳转锚点机制 ----

/** 既有事件名(MessageList.tsx 监听,勿改字面量)。 */
export const SCROLL_TO_MESSAGE_EVENT = 'ihui:scroll-to-message'
/** 反向(消息侧 → 产物面板)事件名;面板侧监听本票暂未接线(见 D76 报告缺口)。 */
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
 * 消息 id → originating turn 序号(= 截至(含)该消息的 assistant 计数)。
 * 产物卡(ArtifactCanvas)侧用:只知自己挂在哪条 assistant 消息下,
 * 不需要该消息真有产物(内联 content 型产物不走 summary_data 也算一轮)。
 */
export function assistantTurnOf(
  messages: readonly ArtifactTurnSourceMessage[],
  messageId: string,
): number | null {
  let turn = 0
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    turn += 1
    if (m.id === messageId) return turn
  }
  return null
}

/**
 * 面板侧(全屏画布头部)TurnNav 状态机:从消息流派生产物 turn 序列,
 * onChangeIndex 联动双向跳转 — jumpToMessageOrigin 滚回产生该轮的消息,
 * 并 emitFocusArtifact 把消息流里的产物卡定位出来(监听在 MessageList 容器)。
 */
export function useArtifactTurnNav(messages: readonly ArtifactTurnSourceMessage[]): {
  readonly count: number
  readonly activeIndex: number
  readonly onChangeIndex: (next: number) => void
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
  return {
    count: turns.length,
    activeIndex: Math.min(activeIndex, Math.max(turns.length - 1, 0)),
    onChangeIndex,
    reset,
  }
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
