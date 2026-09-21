// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MessageContent — 对话消息结构化渲染(W6,2026-09-12)。
 *
 * 数据层由共享纯函数 `@ihui/shared` 的 buildRenderModel 提供(ChatMessage → RenderBlock[]),
 * 本文件只负责「块 → 视图」映射,保证 web / extension / mobile-rn 三端共享同一数据归一化逻辑。
 *
 * Markdown 方案:extension 未引入任何 markdown 依赖(见 apps/extension/package.json),
 * 这里实现「最小安全渲染器」—— 支持围栏代码块、行内代码、粗体、链接、换行保留。
 * 安全性:所有文本均以 React 子节点渲染(React 自动对文本做 HTML 转义,不注入 innerHTML),
 * 链接仅放行 http(s) / mailto / # 协议,其余降级为纯文本,杜绝 javascript: 注入。
 */
import { useMemo, type ReactNode } from 'react'
import {
  buildRenderModel,
  humanizeToolText,
  toolDisplayKey,
  type ChatMessage,
  type ReasoningRenderBlock,
  type RenderPlanStep,
  type SubagentRenderBlock,
  type TerminalRenderBlock,
  type ToolRenderBlock,
} from '@ihui/shared'
import { formatTokenCount } from '@ihui/shared/utils'
import { useI18n } from '../../../src/i18n'

/** i18n 翻译函数签名(与 useI18n 的 t 一致) */
type Translate = (key: string, params?: Record<string, string | number>) => string

// ==================== 最小安全 Markdown 渲染器 ====================

/** 链接协议白名单:仅放行 http(s) / mailto / 页内锚点,其余按纯文本处理 */
function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|#)/i.test(href)
}

/** 行内 Markdown:行内代码 / 粗体 / 链接;其余文本原样输出(React auto-escape) */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\n]+\))/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null = re.exec(text)
  while (m !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]!
    const key = `${keyPrefix}-${k}`
    k += 1
    if (token.startsWith('`')) {
      out.push(
        <code key={key} className="px-1 py-0.5 rounded bg-background/60 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else {
      const close = token.indexOf(']')
      const label = token.slice(1, close)
      const href = token.slice(close + 2, -1)
      out.push(
        isSafeHref(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 break-all"
          >
            {label}
          </a>
        ) : (
          label
        ),
      )
    }
    last = re.lastIndex
    m = re.exec(text)
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** 逐行渲染并保留换行(等价原 whitespace-pre-wrap 的阅读体验) */
function renderLines(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (line) out.push(...renderInline(line, `${keyPrefix}-${i}`))
    if (i < lines.length - 1) out.push(<br key={`${keyPrefix}-br-${i}`} />)
  }
  return out
}

/**
 * 块级渲染:先用围栏(```)切分代码块,再逐段做行内渲染。
 * 未闭合围栏(流式输出中途)按代码块处理,避免内容闪烁为纯文本。
 */
function renderMarkdownBody(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const fence = /```([^\n`]*)\n?([\s\S]*?)(```|$)/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null = fence.exec(text)
  while (m !== null) {
    if (m.index > last) out.push(...renderLines(text.slice(last, m.index), `p${k}`))
    k += 1
    out.push(
      <pre
        key={`code${k}`}
        className="my-1.5 p-2 rounded-md bg-background/70 overflow-x-auto text-xs leading-normal"
      >
        <code className="font-mono whitespace-pre">{m[2] ?? ''}</code>
      </pre>,
    )
    k += 1
    last = fence.lastIndex
    // 未闭合围栏:剩余内容已作为代码块渲染,结束循环
    if (!m[3]) break
    m = fence.exec(text)
  }
  if (last < text.length) out.push(...renderLines(text.slice(last), `p${k}`))
  return out
}

/** Markdown 正文块(流式时尾部展示光标) */
function MarkdownText({ text, streaming }: { text: string; streaming?: boolean }) {
  const nodes = useMemo(() => renderMarkdownBody(text), [text])
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {nodes}
      {streaming ? (
        <span
          className="inline-block w-[2px] h-[1em] align-text-bottom bg-primary animate-pulse"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

// ==================== 状态 → 样式/文案映射 ====================

/** Plan 步骤状态文案 */
function planStatusLabel(status: RenderPlanStep['status'], t: Translate): string {
  switch (status) {
    case 'completed':
      return t('chat.planStatusCompleted')
    case 'in_progress':
      return t('chat.planStatusInProgress')
    default:
      return t('chat.planStatusPending')
  }
}

/** Plan 步骤状态徽标样式 */
function planStatusClass(status: RenderPlanStep['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-success/15 text-success'
    case 'in_progress':
      return 'bg-primary/15 text-primary'
    default:
      return 'bg-muted-foreground/20 text-muted-foreground'
  }
}

/** 工具调用状态文案 */
function toolStatusLabel(block: ToolRenderBlock, t: Translate): string {
  if (block.isError || block.status === 'error') return t('chat.toolStatusError')
  if (block.status === 'success') return t('chat.toolStatusSuccess')
  return t('chat.toolStatusRunning')
}

/** 工具调用状态徽标样式 */
function toolStatusClass(block: ToolRenderBlock): string {
  if (block.isError || block.status === 'error') return 'bg-destructive/15 text-destructive'
  if (block.status === 'success') return 'bg-success/15 text-success'
  return 'bg-primary/15 text-primary'
}

/** 终端任务状态文案 */
function terminalStatusLabel(status: TerminalRenderBlock['status'], t: Translate): string {
  switch (status) {
    case 'completed':
      return t('chat.terminalStatusCompleted')
    case 'failed':
      return t('chat.terminalStatusFailed')
    default:
      return t('chat.terminalStatusRunning')
  }
}

/** 终端任务状态徽标样式 */
function terminalStatusClass(status: TerminalRenderBlock['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-success/15 text-success'
    case 'failed':
      return 'bg-destructive/15 text-destructive'
    default:
      return 'bg-primary/15 text-primary'
  }
}

/** 毫秒 → 可读时长 */
function formatDurationMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** 值 → 缩进 JSON 文本(字符串原样;空值返回空串) */
function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return String(value)
  }
}

// ==================== 各类型块视图 ====================

/** 推理过程块 */
function ReasoningBlockView({ block, t }: { block: ReasoningRenderBlock; t: Translate }) {
  return (
    <div className="px-2 py-1.5 rounded-md border border-dashed border-border bg-muted/40 text-xs">
      <div className="text-[10px] text-muted-foreground mb-1">{t('chat.reasoning')}</div>
      <div className="whitespace-pre-wrap break-words text-muted-foreground leading-relaxed">
        {block.text}
      </div>
    </div>
  )
}

/** 工具调用块(含媒体产物) */
function ToolBlockView({ block, t }: { block: ToolRenderBlock; t: Translate }) {
  const argsText = stringifyValue(block.args)
  const resultText = stringifyValue(block.result)
  // 界面禁止直显英文工具码名:已映射的工具显示本地化功能名(如 read_file → "读取文件内容"),
  // 插件/MCP 动态名回落原码名展示。
  const displayKey = toolDisplayKey(block.toolName)
  return (
    <div className="px-2 py-1.5 rounded-md border border-border bg-card text-xs">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`font-medium break-all ${displayKey ? '' : 'font-mono'}`}>
          {displayKey ? t(`taskStatus.${displayKey}`) : block.toolName}
        </span>
        <span className={`px-1 py-0.5 rounded text-[10px] leading-tight ${toolStatusClass(block)}`}>
          {toolStatusLabel(block, t)}
        </span>
        {typeof block.durationMs === 'number' ? (
          <span className="text-[10px] text-muted-foreground">
            {formatDurationMs(block.durationMs)}
          </span>
        ) : null}
        {block.serverName ? (
          <span className="text-[10px] text-muted-foreground">· {block.serverName}</span>
        ) : null}
      </div>
      {argsText || resultText ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] text-muted-foreground">
            {t('chat.toolDetail')}
          </summary>
          {argsText ? (
            <pre className="m-0 mt-1 p-1.5 rounded bg-background/70 overflow-x-auto font-mono text-[10px] whitespace-pre-wrap break-all">
              {argsText}
            </pre>
          ) : null}
          {resultText ? (
            <pre className="m-0 mt-1 p-1.5 rounded bg-background/70 overflow-x-auto font-mono text-[10px] whitespace-pre-wrap break-all">
              {resultText}
            </pre>
          ) : null}
        </details>
      ) : null}
      {block.media?.image_url ? (
        <img src={block.media.image_url} alt="" className="mt-1 max-w-full rounded" />
      ) : null}
      {block.media?.audio_url ? (
        <audio controls src={block.media.audio_url} className="mt-1 w-full" />
      ) : null}
      {block.media?.video_url ? (
        <video controls src={block.media.video_url} className="mt-1 max-w-full rounded" />
      ) : null}
    </div>
  )
}

/** 终端任务块 */
function TerminalBlockView({ block, t }: { block: TerminalRenderBlock; t: Translate }) {
  return (
    <div className="px-2 py-1.5 rounded-md border border-border bg-card text-xs">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground shrink-0">{t('chat.terminal')}</span>
        <code className="font-mono flex-1 break-all">{block.command}</code>
        <span
          className={`px-1 py-0.5 rounded text-[10px] leading-tight ${terminalStatusClass(block.status)}`}
        >
          {terminalStatusLabel(block.status, t)}
        </span>
        {typeof block.exitCode === 'number' ? (
          <span className="text-[10px] text-muted-foreground">exit {block.exitCode}</span>
        ) : null}
        {typeof block.durationMs === 'number' ? (
          <span className="text-[10px] text-muted-foreground">
            {formatDurationMs(block.durationMs)}
          </span>
        ) : null}
      </div>
      {block.output ? (
        <pre className="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
          {block.output}
        </pre>
      ) : null}
    </div>
  )
}

/** 子代理活动块 */
function SubagentBlockView({ block, t }: { block: SubagentRenderBlock; t: Translate }) {
  return (
    <div className="px-2 py-1.5 rounded-md border border-border bg-card text-xs">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">{block.name}</span>
        <span className="text-[10px] text-muted-foreground">{block.type}</span>
        <span className="px-1 py-0.5 rounded text-[10px] leading-tight bg-muted text-muted-foreground">
          {block.status}
        </span>
        {typeof block.toolCallsCount === 'number' ? (
          <span className="text-[10px] text-muted-foreground">
            · {t('chat.subagentTools', { count: block.toolCallsCount })}
          </span>
        ) : null}
      </div>
      {block.currentStep ? (
        <div className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
          {block.currentStep}
        </div>
      ) : null}
      {block.outputPreview ? (
        <pre className="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
          {block.outputPreview}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * 执行计划步骤列表(W6 抽出为独立导出,供 ChatPage 与 AgentRuntimePanel 共用,
 * 消除 plan 在两条链路的渲染割裂)。
 */
export interface PlanStepsViewProps {
  steps: RenderPlanStep[]
  explanation?: string
}

export function PlanStepsView({ steps, explanation }: PlanStepsViewProps) {
  const { t } = useI18n()
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {explanation ? <div className="text-[10px] text-muted-foreground">{explanation}</div> : null}
      <ol className="m-0 p-0 list-none flex flex-col gap-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-1.5">
            <span
              className={`shrink-0 px-1 py-0.5 rounded text-[10px] leading-tight ${planStatusClass(step.status)}`}
            >
              {planStatusLabel(step.status, t)}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-words">
              {humanizeToolText(step.step, t)}
            </span>
            {typeof step.durationMs === 'number' ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDurationMs(step.durationMs)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 单条消息的结构化渲染入口:消费共享纯函数 buildRenderModel 的输出 */
export interface MessageContentProps {
  message: ChatMessage
  streaming?: boolean
}

export function MessageContent({ message, streaming = false }: MessageContentProps) {
  const { t } = useI18n()
  const model = useMemo(() => buildRenderModel(message, { streaming }), [message, streaming])
  return (
    <div className="flex flex-col gap-1.5" data-testid="message-content">
      {model.blocks.map((block) => {
        switch (block.kind) {
          case 'markdown':
            return <MarkdownText key={block.id} text={block.text} streaming={block.streaming} />
          case 'reasoning':
            return <ReasoningBlockView key={block.id} block={block} t={t} />
          case 'tool':
            return <ToolBlockView key={block.id} block={block} t={t} />
          case 'plan':
            return (
              <PlanStepsView key={block.id} steps={block.steps} explanation={block.explanation} />
            )
          case 'terminal':
            return <TerminalBlockView key={block.id} block={block} t={t} />
          case 'subagent':
            return <SubagentBlockView key={block.id} block={block} t={t} />
          default:
            return null
        }
      })}
      {model.isEmpty && message.role === 'assistant' ? (
        <span className="text-muted-foreground">...</span>
      ) : null}
      {model.usage && message.role === 'assistant' ? (
        <div className="text-[10px] text-muted-foreground">
          {t('chat.usage')}: {formatTokenCount(model.usage.promptTokens)} /{' '}
          {formatTokenCount(model.usage.completionTokens)} /{' '}
          {formatTokenCount(model.usage.totalTokens)}
        </div>
      ) : null}
    </div>
  )
}

export default MessageContent
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
