// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  CircleDashed,
  FileCode,
  FileDiff,
  FilePen,
  FileSearch,
  FileText,
  FileX,
  Flag,
  Globe,
  History,
  Image,
  ListTodo,
  Loader2,
  MessageCircleQuestion,
  MessageSquareText,
  Minus,
  Monitor,
  Plug,
  Settings2,
  Sparkles,
  Terminal,
  TriangleAlert,
  Video,
  Workflow,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/components/ai/progress-sections/foldable-section'
import type { PlanStepStatus } from '@ihui/types/ai'
import type { ToolMetricKind, ToolSubjectKind } from '@ihui/shared/chat'

/**
 * 消息流"活动区"设计基元 —— 流式对话里所有过程信息(工具调用/计划步骤/终端/子代理/思考)
 * 共用的一套行、组、度量与状态语义。
 *
 * 为什么要有这一层:此前每个区段各自写字号(9/10/11/12/13px 五种)、各自写圆角与配色,
 * 同一个气泡里出现四种互不相干的视觉语言,读起来像四个产品的拼接。遵循统一工程规范
 * Codex 的做法是**一种行模板贯穿全部过程信息**:
 *   状态图标 · 功能名 · 对象(等宽) ………… 度量 / 耗时
 * 字号唯一(13px)、图标唯一(14px)、行高唯一(24px)、状态色唯一,
 * 差异只体现在"内容"上。所有区段必须经本文件渲染,不得再自行拼 className。
 * 2026-11-21 用户口径:过程行不画容器 —— 头行无底色、无描边,展开体也不铺底色。
 */

/** 活动行状态 —— 与工具/步骤/终端的原始状态词汇统一收敛到这五种 */
export type StreamStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'stub'

/** 活动行语义档 —— 行首图标由「这行装的是什么」决定(容器语义图标唯一来源) */
export type StreamKind =
  | 'thinking'
  | 'narration'
  | 'steps'
  | 'plan'
  | 'tool'
  | 'fileRead'
  | 'fileWrite'
  | 'fileDelete'
  | 'search'
  | 'web'
  | 'terminal'
  | 'preview'
  | 'mcp'
  | 'skill'
  | 'image'
  | 'video'
  | 'question'
  | 'env'
  | 'end'
  | 'subagent'
  | 'diff'
  | 'replay'
  | 'code'

/** 语义档 → 行首图标(全消息流唯一口径;新增容器先在此登记,调用方只经 streamKindIcon 取) */
const STREAM_KIND_ICONS: Readonly<Record<StreamKind, LucideIcon>> = {
  thinking: Brain,
  narration: MessageSquareText,
  steps: Workflow,
  plan: ListTodo,
  tool: Wrench,
  fileRead: FileText,
  fileWrite: FilePen,
  fileDelete: FileX,
  search: FileSearch,
  web: Globe,
  terminal: Terminal,
  preview: Monitor,
  mcp: Plug,
  skill: Sparkles,
  image: Image,
  video: Video,
  question: MessageCircleQuestion,
  env: Settings2,
  end: Flag,
  subagent: Bot,
  diff: FileDiff,
  replay: History,
  code: FileCode,
}

/** 语义档 → 图标组件(折叠区段头等只需要「图标本体」的调用方从这里取) */
export function streamKindIcon(kind: StreamKind): LucideIcon {
  return STREAM_KIND_ICONS[kind]
}

/** 状态 → 语义图标着色(用户口径:图标只取纯前景色,不再压透明度;失败态保留红色语义) */
const KIND_ICON_TONE: Record<StreamStatus, string> = {
  running: 'text-foreground',
  success: 'text-foreground',
  error: 'text-red-500',
  skipped: 'text-foreground',
  stub: 'text-foreground',
  pending: 'text-foreground',
}

/**
 * 行首语义图标:形状由语义档(kind)决定,颜色由状态(status)决定。
 * 运行态加轻微脉冲提示活动,尊重 prefers-reduced-motion。
 */
export function StreamKindIcon({
  kind,
  status,
  className,
}: {
  kind: StreamKind
  status: StreamStatus
  className?: string
}) {
  const Icon = STREAM_KIND_ICONS[kind]
  return (
    <Icon
      className={cn(
        ICON_CLASS,
        KIND_ICON_TONE[status],
        status === 'running' && 'animate-pulse motion-reduce:animate-none',
        className,
      )}
      aria-hidden
    />
  )
}

/**
 * 行模板唯一几何档:13px/18px 字 · 24px 高 · 4px 左内边距。
 *
 * 2026-11-21 用户口径(根治"七扭八歪"):**几何量不得随"能不能点"变化**。
 * 此前可点击行走头行档(28px 高 + px-1),不可点击行走本档(24px 高 + 无左内边距)⇒
 * 同一个列表里图标列时左时右、行高一个个跳、文字基线相差 0.3px,肉眼就是"没对齐"。
 * 现在 px/高/字/图标全部收在本常量一处,可点击与否只改交互层(focus/悬停/箭头)。
 */
export const STREAM_ROW_CLASS = 'flex h-6 w-full items-center gap-1.5 px-1 text-body-sm'

/**
 * 可折叠容器头行唯一档(2026-11-16 立,2026-11-21 改无容器 + 几何并档):思考行 / 过程叙述组头 /
 * 代码块头 / 文件变更头 / 普通活动行共用。
 *
 * 用户口径:这些头行的字号、粗细、大小、左内边距完全一致,且**不画容器** ——
 * 24px 高(与普通活动行同档)、13px/400 字、**无底色、无描边**(悬停/聚焦都不出现边框),
 * 可展开的暗示交给右端箭头,不再靠一块灰底 + 一圈框去"圈出按钮"。
 * 聚焦反馈只留一档极浅底色(不带边框、零位移,AGENTS §4 的几何零位移仍成立)。
 * 头行的这几项只允许来自本常量,禁止再手写组合。
 */
export const STREAM_HEADER_ROW_CLASS = cn(
  STREAM_ROW_CLASS,
  'rounded-sm text-left text-foreground',
  'transition-colors focus-visible:bg-muted/20 focus-visible:outline-none',
)

/**
 * 头行内紧凑图标动作(24px 档):头行高 24px,32px 的 IconButton 会把行撑高,
 * 破坏头行高度一致 —— 头行内动作按钮一律走本档,图标 14px 与行内图标同档。
 */
export const STREAM_HEADER_ACTION_CLASS =
  'inline-flex h-full w-6 shrink-0 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

/**
 * 组内正文左让位唯一档(2026-11-16 立):StreamGroup 的引导线占 `left-[7px]`,
 * 组内**裸正文**(过程叙述这类没有底色的文字块)必须从这条线上再让 12px 起排 ⇒
 * 文字列 = 6 + 12 = 18px,略多于引导线所在的 7px 轨道(线不进字身、两侧各留 1px 呼吸),
 * 与 StreamDetail 的正文列同一格(思考展开体同款)。
 * 不套本档的裸正文会从 0 起排,引导线就从字身和正文里的图标上穿过去(2026-11-16 用户报障)。
 * 左让位取间距档 6px(ml-1.5)而非任意值:非色档只认档表(守门 302p 的 tierWebOffN)。
 */
export const STREAM_GROUP_BODY_CLASS = 'ml-1.5 pl-3'

/** 对象(路径/URL/命令)一律等宽;查询词与实体名用正文体 */
export const STREAM_SUBJECT_MONO = /path|url|command/

/** 行内图标唯一档:14px(2026-11-21 随行字号 16→13px 下调一档,不再比字身高一头) */
const ICON_CLASS = 'h-3.5 w-3.5 shrink-0'

/** 状态 → 图标 + 颜色(全消息流唯一口径) */
export function StreamStatusIcon({
  status,
  className,
}: {
  status: StreamStatus
  className?: string
}) {
  switch (status) {
    case 'running':
      return (
        <Loader2
          className={cn(ICON_CLASS, 'animate-spin text-foreground', className)}
          aria-hidden
        />
      )
    case 'success':
      return <Check className={cn(ICON_CLASS, 'text-foreground', className)} aria-hidden />
    case 'error':
      return <X className={cn(ICON_CLASS, 'text-red-500', className)} aria-hidden />
    case 'skipped':
      return <Minus className={cn(ICON_CLASS, 'text-foreground', className)} aria-hidden />
    case 'stub':
      return <TriangleAlert className={cn(ICON_CLASS, 'text-foreground', className)} aria-hidden />
    case 'pending':
    default:
      return <CircleDashed className={cn(ICON_CLASS, 'text-foreground', className)} aria-hidden />
  }
}

export interface StreamRowProps {
  status: StreamStatus
  /**
   * 行首语义档:传入即用「容器语义图标」(形状=kind,颜色=status)替代默认状态图标。
   * 这是 AI 面板各容器(思考/工具/文件/终端/子代理…)行首图标的统一入口。
   */
  kind?: StreamKind
  /** 功能名(本地化后的动宾短语,如"读取文件内容");禁止传英文工具码名 */
  title: string
  /**
   * `action`(默认):title 是短动词短语,主体留给 subject 撑满一行。
   * `primary`:title 本身就是这一行的主体(计划步骤、清单项那种整句话),占满剩余宽度。
   */
  titleMode?: 'action' | 'primary'
  /** 行首序号/缩进前缀(如"1."),放在状态图标之后 */
  leading?: React.ReactNode
  /** 操作对象(文件路径 / 检索词 / URL / 命令),等宽显示并单行截断 */
  subject?: string
  subjectKind?: ToolSubjectKind
  /** 右侧度量徽章之前的静态补充文本(如"3 个结果") */
  meta?: React.ReactNode
  /** 结果计数(行数/命中数/文件数),空值不渲染 */
  metricKind?: ToolMetricKind
  metricValue?: number | null
  /** 写类文件的 ± 行数;-1 表示未知,不渲染 */
  added?: number
  removed?: number
  /** 尾部状态文本(如"执行中"),仅在需要文字态时传 */
  trailing?: React.ReactNode
  /** 耗时(毫秒);running 时由外部 tick 传入 */
  elapsedMs?: number | null
  /** 传入即渲染成可点击行(带 hover 背景 + 右侧展开箭头) */
  onClick?: () => void
  expanded?: boolean
  /** 行级附加标签(插件/MCP 来源等),统一中性配色 */
  tags?: string[]
  ariaLabel?: string
  /** 键盘导航锚点:agent-task-progress-pane 用 [data-section-header] 收集可聚焦区段头 */
  sectionHeader?: boolean
  className?: string
  testId?: string
}

/**
 * 一条活动行。信息优先级:状态 → 做什么(title) → 对谁(subject) → 结果多大(metric) → 多久(elapsed)。
 * 可点击时整行是按钮(展开/收起明细),不可点击时是纯展示行。
 */
export function StreamRow({
  status,
  kind,
  title,
  titleMode = 'action',
  leading,
  subject,
  subjectKind = 'none',
  meta,
  metricKind = 'none',
  metricValue = null,
  added,
  removed,
  trailing,
  elapsedMs,
  onClick,
  expanded,
  tags,
  ariaLabel,
  sectionHeader,
  className,
  testId,
}: StreamRowProps) {
  const interactive = typeof onClick === 'function'
  const primary = titleMode === 'primary'
  const inner = (
    <>
      {kind ? <StreamKindIcon kind={kind} status={status} /> : <StreamStatusIcon status={status} />}
      {leading !== undefined && leading !== null && leading !== '' && (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">{leading}</span>
      )}
      <span
        className={cn(
          'truncate text-foreground',
          primary ? 'min-w-0 shrink' : 'shrink-0 max-w-[45%]',
        )}
      >
        {title}
      </span>
      {subject ? (
        <span
          data-stream-subject="true"
          className={cn(
            'min-w-0 truncate text-foreground/65',
            primary ? 'shrink-0 max-w-[40%]' : 'min-w-0 truncate',
            STREAM_SUBJECT_MONO.test(subjectKind) && 'font-mono',
          )}
        >
          {subject}
        </span>
      ) : null}
      {tags?.map((tag) => (
        <StreamTag key={tag}>{tag}</StreamTag>
      ))}
      {meta !== undefined && meta !== null && meta !== '' && (
        <span className="shrink-0 text-muted-foreground/70">{meta}</span>
      )}
      <StreamMetric kind={metricKind} value={metricValue} />
      <StreamDelta added={added} removed={removed} />
      {elapsedMs !== undefined && elapsedMs !== null && (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">
          {formatDuration(elapsedMs)}
        </span>
      )}
      {trailing !== undefined && trailing !== null && trailing !== '' && (
        <span className="shrink-0 text-muted-foreground/70">{trailing}</span>
      )}
      {/* 2026-11-21 用户口径:行尾的度量/耗时/状态必须**紧跟前文**排,不再靠 flex-1 顶到行末。
          弹性空位统一放在最后,只负责把展开箭头推到右沿。 */}
      <span className="min-w-0 flex-1" aria-hidden />
      {interactive && (
        <ChevronRight
          className={cn(
            ICON_CLASS,
            'shrink-0 text-foreground transition-all',
            expanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover/stream-row:opacity-100',
          )}
          aria-hidden
        />
      )}
    </>
  )

  // 未开始/已跳过的行整行弱化:状态差异靠"重量"表达,不靠多种字号与彩色边框
  const dimmed = status === 'pending' || status === 'skipped' || status === 'stub'

  if (!interactive) {
    return (
      <div
        className={cn(
          'group/stream-row',
          STREAM_HEADER_ROW_CLASS,
          dimmed && 'opacity-60',
          className,
        )}
        data-stream-row="true"
        data-testid={testId}
        data-stream-status={status}
      >
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={ariaLabel ?? title}
      className={cn(
        // 2026-11-16:可点击活动行 = 可折叠容器头行唯一档(与思考/过程叙述/代码块头完全同档)
        'group/stream-row',
        STREAM_HEADER_ROW_CLASS,
        dimmed && 'opacity-60',
        className,
      )}
      data-stream-row="true"
      data-testid={testId}
      data-stream-status={status}
      data-stream-expanded={expanded ? 'true' : 'false'}
      {...(sectionHeader ? { 'data-section-header': 'true' } : {})}
    >
      {inner}
    </button>
  )
}

/** 结果度量:单位文案走 i18n,数值缺失(unknown)时整段不渲染 */
export function StreamMetric({
  kind,
  value,
}: {
  kind: ToolMetricKind
  value: number | null | undefined
}) {
  const t = useTranslations('taskStatus')
  if (kind === 'none' || value === null || value === undefined || value < 0) return null
  const key =
    kind === 'lines'
      ? 'unitLines'
      : kind === 'files'
        ? 'unitFiles'
        : kind === 'chars'
          ? 'unitLines'
          : 'unitResults'
  return (
    <span className="shrink-0 tabular-nums text-muted-foreground/60" data-testid="stream-metric">
      {t(key, { n: value })}
    </span>
  )
}

/** 文件增删行数;-1 = 行数未知,不渲染占位 0 */
export function StreamDelta({
  added,
  removed,
  className,
}: {
  added?: number
  removed?: number
  className?: string
}) {
  const t = useTranslations('taskStatus')
  const hasAdded = typeof added === 'number' && added >= 0
  const hasRemoved = typeof removed === 'number' && removed >= 0
  if (!hasAdded && !hasRemoved) return null
  return (
    <span
      className={cn('shrink-0 flex items-center gap-1 tabular-nums', className)}
      data-testid="stream-delta"
    >
      {hasAdded && (
        <span className="text-emerald-600 dark:text-emerald-400">
          {t('addedCount', { n: added! })}
        </span>
      )}
      {hasRemoved && <span className="text-red-500/80">{t('removedCount', { n: removed! })}</span>}
    </span>
  )
}

/**
 * 实时耗时 tick:running=true 时每 250ms 自增,结束/卸载即停。
 * 传入 doneMs 时(结果已回,后端给出真实耗时)直接显示权威值,不再显示本地估算。
 */
export function useLiveElapsed(running: boolean, doneMs?: number | null): number | null {
  const startRef = React.useRef<number>(Date.now())
  const [elapsed, setElapsed] = React.useState(0)
  React.useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 250)
    return () => window.clearInterval(id)
  }, [running])
  if (!running) return doneMs !== undefined && doneMs !== null ? doneMs : null
  return elapsed
}

/**
 * 实时耗时 tick,**起点由外部给定**(spawnedAt 的 ISO 串)。
 * 与 useLiveElapsed(起点=挂载时刻)的唯一差别就在这里:批次瓶颈"已跑 X"与单行秒表用同一基准,
 * 消除"批次冻结 vs 单行跳动"的矛盾。
 * running=false ⇒ 回落 fallbackMs;running=true 而 spawnedAt 缺席/非 ISO ⇒ null(不造残标)。
 */
export function useLiveSince(
  running: boolean,
  startedAtIso: string | undefined,
  fallbackMs?: number | null,
): number | null {
  const startMs = React.useMemo(() => {
    if (!startedAtIso) return null
    const t = Date.parse(startedAtIso)
    return Number.isFinite(t) ? t : null
  }, [startedAtIso])
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!running || startMs === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running, startMs])
  if (!running) return fallbackMs !== undefined && fallbackMs !== null ? fallbackMs : null
  if (startMs === null) return null
  return Math.max(0, now - startMs)
}

export interface StreamGroupProps {
  /** 组内是否仍在执行(决定头行图标与措辞) */
  active: boolean
  /** 组头语义档:传入即用「容器语义图标」(形状=kind)替代默认状态图标 */
  kind?: StreamKind
  /** 步数(用于 "{n} 个步骤" / 用时措辞) */
  stepCount: number
  /** 收起态也显示在最前面的一句话:此刻在做什么 / 已完成 */
  headline?: string
  /** 组级耗时(毫秒);active 时实时 tick,结束后传权威值 */
  elapsedMs?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** 组头右侧的轻量控件(视图切换等)。放在触发器**外面**,避免按钮套按钮 */
  headerExtra?: React.ReactNode
  className?: string
  testId?: string
  ariaLabel?: string
}

/**
 * 活动组:一段过程信息的容器。
 *
 * 除一行与行同字号的头外不设独立底色;2026-11-15 起头按钮带一档低对比描边,
 * 与正文拉开"可展开容器"的轻量边界,但不抢正文的视觉重量。
 *
 * 组内左让位(2026-11-21 收口):引导线轨道 `left-[7px]` 是**本组**画的,所以让位也必须由
 * 本组件一处施加 —— 展开体统一套 `STREAM_GROUP_BODY_CLASS`(18px),行内图标落在 22px,
 * 轨道永远在图标左侧 15px,不会从图标身上穿过去。
 * 旧口径要求**调用方**自己套(MessageItem 套了、sub-agent 泳道没套 ⇒ 泳道行的图标与竖线重合),
 * 且忘套时没有任何判据可见;现在调用方一律不要套(再套一份就是 36px,行会缩进过头)。
 */
export function StreamGroup({
  active,
  kind,
  stepCount,
  headline,
  elapsedMs,
  open,
  onOpenChange,
  children,
  headerExtra,
  className,
  testId,
  ariaLabel,
}: StreamGroupProps) {
  const t = useTranslations('taskStatus')
  const live = useLiveElapsed(active, elapsedMs)
  return (
    <div
      className={cn('group/stream relative', className)}
      data-testid={testId}
      data-stream-group={active ? 'active' : 'idle'}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[7px] w-px transition-colors',
          // 引导线只在展开且确有内容时出现,收起态保持零装饰。
          // 起点落在头行下沿(top-6 = 头行 24px 高;头行与普通行同档后同步改),不从语义图标底部钻出来。
          open ? 'top-6 bottom-1 bg-border/70' : 'h-0 opacity-0',
        )}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={ariaLabel ?? (open ? t('collapseSteps') : t('expandSteps'))}
          className={cn(
            // 2026-11-16:组头与思考行/代码块头同走可折叠容器头行唯一档(同几何、无容器)
            'min-w-0 flex-1',
            STREAM_HEADER_ROW_CLASS,
          )}
          data-stream-row="true"
          data-stream-group-trigger="true"
        >
          {kind ? (
            <StreamKindIcon kind={kind} status={active ? 'running' : 'success'} />
          ) : (
            <StreamStatusIcon status={active ? 'running' : 'success'} />
          )}
          <span className="min-w-0 shrink truncate">
            {headline || (active ? t('statusRunning') : t('stepCount', { n: stepCount }))}
          </span>
          {!active && stepCount > 0 && (
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {t('stepCount', { n: stepCount })}
            </span>
          )}
          {live !== null && live > 0 && (
            <span
              className="shrink-0 tabular-nums text-muted-foreground/60"
              data-testid={`${testId ?? 'stream'}-elapsed`}
            >
              {t('workedFor', { time: formatDuration(live) })}
            </span>
          )}
          <span className="min-w-0 flex-1" aria-hidden />
          <ChevronRight
            className={cn(
              ICON_CLASS,
              'shrink-0 text-foreground transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden
          />
        </button>
        {headerExtra}
      </div>
      {open && (
        <div className={cn(STREAM_GROUP_BODY_CLASS, 'pt-0.5')} data-stream-group-body="true">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * 展开态明细容器:唯一的一档圆角与内边距(6px + p-2),不再各处自配。
 *
 * 2026-11-21 用户口径:过程区的展开体**不画容器色** —— 明细直接落在消息画布上,
 * 靠缩进(与引导线同列)表达从属关系,不再套一层灰底去分区。
 */
export function StreamDetail({
  children,
  className,
  testId,
}: {
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <div
      className={cn('ml-2 space-y-1.5 py-1 pl-4 text-label', className)}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

/** 明细内的小标签(入参/结果/错误) */
export function StreamLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-muted-foreground/70">{children}</p>
}

/** 明细里的等宽输出块:限高 200px 后滚动;`autoScrollToBottom` 时新内容追加即贴底。
 * D113 文件写工具的 partialDiff 预览传 true(增量帧增长时始终看最新段),
 * partialArgs 预览保持 false(入参 JSON 从头读更自然,不夺滚动位置)。 */
export function StreamCode({
  text,
  className,
  testId,
  autoScrollToBottom = false,
  streaming = false,
}: {
  text: string
  className?: string
  testId?: string
  autoScrollToBottom?: boolean
  /** 流式进行中:渲染尾部光标(仅装饰,不进 a11y 树语义) */
  streaming?: boolean
}) {
  const ref = React.useRef<HTMLPreElement>(null)
  React.useEffect(() => {
    if (!autoScrollToBottom) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text, autoScrollToBottom])
  return (
    <pre
      ref={ref}
      className={cn(
        'max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-background/60 p-1.5 font-mono text-label leading-relaxed text-foreground/75',
        // 流式进行中:左侧 accent 边(teal)强化"正在生成"的视觉锚点;非流式保持中性无边
        streaming && 'border-l-2 border-l-teal-500/60 dark:border-l-teal-400/60',
        className,
      )}
      data-testid={testId}
    >
      {text}
      {streaming && (
        // 2026-11-15 观感细化:光标由 animate-pulse(透明度呼吸,廉价感)升级为
        // .animate-cursor-blink(1s step-end 硬切,与正文 stream-caret-host 同谱),
        // 颜色走 var(--color-primary) design-token(禁裸色值,对齐全局光标规范)。
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.12em] animate-cursor-blink bg-[var(--color-primary)]"
        />
      )}
    </pre>
  )
}

/** 中性信息徽章(来源/轮次/重试/状态/计数),数字档按 §4 确定性居中模板 */
export function StreamTag({
  children,
  tone = 'neutral',
  strong = false,
  testId,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'running' | 'danger'
  /** 数字计数徽章(待办数/步数/±行数)用 true:加粗 + 等宽,保证位数变化不抖 */
  strong?: boolean
  testId?: string
  /**
   * 可点击徽章("失败 N 条 → 跳到首条失败"那类定位标)。
   * 给了就渲染成 `<button type="button">`:键盘可达、语义正确;
   * 不给仍是 `<span>`,所以纯展示徽章的调用点零影响。
   */
  onClick?: () => void
  /**
   * 可访问性标签。**刻意不接受 `title` prop**:本仓禁止原生 title 提示窗
   * (`check-no-native-dialog.mjs`),语义一律走 aria-label。
   */
  ariaLabel?: string
}) {
  const tagClass = cn(
    'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-md px-1 text-[10px] leading-none tabular-nums',
    strong && 'font-semibold',
    tone === 'danger' && 'bg-red-500/10 text-red-600 dark:text-red-400',
    tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    tone === 'running' && 'bg-primary/10 text-primary',
    tone === 'neutral' && 'bg-muted/70 text-muted-foreground',
  )
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(tagClass, 'cursor-pointer border-0 hover:brightness-95')}
        data-testid={testId}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </button>
    )
  }
  return (
    <span className={tagClass} data-testid={testId} aria-label={ariaLabel}>
      {children}
    </span>
  )
}

/** StreamStatus → taskStatus 里的状态词键(全消息流唯一口径,各端不得再各写一份映射) */
const STATUS_LABEL_KEY: Record<StreamStatus, string> = {
  // 待开始态复用已有键 stepPending,不另立同义的 statusPending
  pending: 'stepPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusFailed',
  skipped: 'statusSkipped',
  stub: 'statusStub',
}

/** 状态词本地化助手:组件里凡是要把状态写成文字(含 aria-label)都走它 */
export function useStreamStatusLabel(): (status: StreamStatus) => string {
  const t = useTranslations('taskStatus')
  return React.useCallback((status: StreamStatus) => t(STATUS_LABEL_KEY[status]), [t])
}

/**
 * plan_updated 步骤状态 → 活动行状态;error=true 与显式 failed 归一为 error。
 *
 * **穷尽 switch + `never` 兜底(G-815966)**:旧写法是一条 if 链末尾 `return 'pending'`,
 * 那是"运行时兜底"——`PlanStepStatus`(packages/types/src/ai.ts:257)新增一档时,
 * 新档会被静默归一成 `pending`(看上去"还没开始"),`tsc` 一个字都不吭声。
 * 现在 `pending` 档与五档一起**逐档显式列出**,`default` 分支把残值赋给 `never`:
 * 联合类型一旦多出一档,`default` 里 `step.status` 就不再是 `never`,该行编译报错
 * ⇒"新增状态忘配展示"从线上兜底变成 CI 判红。
 */
export function planStepStreamStatus(step: {
  status: PlanStepStatus
  error?: boolean
}): StreamStatus {
  if (step.error === true || step.status === 'failed') return 'error'
  switch (step.status) {
    case 'in_progress':
      return 'running'
    case 'completed':
      return 'success'
    case 'skipped':
      return 'skipped'
    case 'pending':
      return 'pending'
    default: {
      const exhaustive: never = step.status
      return exhaustive
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
