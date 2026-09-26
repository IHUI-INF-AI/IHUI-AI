// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { TerminalSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FoldableSection } from './foldable-section'
import { CopyButton } from './copy-button'
import { useChatStore } from '@/stores/chat'
import type { TerminalTask } from '@/hooks/use-agent-progress'
// V3 #67:终端输出 ANSI 彩色渲染。解析器为纯函数(零依赖,输出结构化 span,
// 渲染走 React 文本节点自动转义 —— 终端输出是不可信输入,禁拼 HTML 字符串)。
import { hasAnsiCodes, parseAnsi, stripAnsiCodes, type AnsiSpan } from '@/lib/ansi'
import {
  StreamCode,
  StreamDetail,
  StreamLabel,
  StreamRow,
  StreamTag,
  useLiveElapsed,
  useStreamStatusLabel,
  type StreamStatus,
} from '@/components/chat/stream/stream-ui'

interface TerminalSectionProps {
  terminals: TerminalTask[]
}

/**
 * 终端状态 → 消息流统一状态语义(与工具行同一口径)。
 * exit code 非 0 视为失败:命令跑完但返回非 0,对用户而言就是"这次没成"。
 */
function toStreamStatus(status: TerminalTask['status'], exitCode?: number): StreamStatus {
  if (status === 'running') return 'running'
  if (status === 'failed') return 'error'
  if (exitCode !== undefined && exitCode !== 0) return 'error'
  return 'success'
}

/** 输出预览上限:超出部分折叠,由「显示更多」显式展开(禁止渐变遮罩) */
const OUTPUT_PREVIEW_LIMIT = 2000

/**
 * AnsiCodeBlock — 含 ANSI 转义的输出渲染(V3 #67)
 *
 * 为什么不用 StreamCode:StreamCode 只接受纯文本,裸转义字符会原样显示。
 * 为什么不用 xterm:消息流内保持轻量,真正的 xterm 只在 AiTerminalDock。
 * 为什么结构化渲染而不是字符串拼 HTML:终端输出是不可信输入(可能含
 * <script>/onerror 载荷),span 数组交给 React 文本节点自动转义,XSS 无处
 * 着力 —— 这是硬要求,见 ansi.ts 头部注释。
 * className 与 StreamCode 保持一致,视觉零漂移;autoScroll 行为等价。
 */
function AnsiCodeBlock({
  spans,
  autoScrollToBottom,
  testId,
}: {
  spans: AnsiSpan[]
  autoScrollToBottom: boolean
  testId?: string
}) {
  const ref = React.useRef<HTMLPreElement>(null)
  React.useEffect(() => {
    if (!autoScrollToBottom) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [spans, autoScrollToBottom])
  const renderSpan = (s: AnsiSpan, idx: number) => {
    const color = s.inverse ? s.bg : s.color
    const bg = s.inverse ? s.color : s.bg
    const decoration =
      [s.underline ? 'underline' : '', s.strikethrough ? 'line-through' : '']
        .filter(Boolean)
        .join(' ') || undefined
    return (
      <span
        key={idx}
        style={{
          color,
          background: bg,
          fontWeight: s.bold ? 600 : undefined,
          fontStyle: s.italic ? 'italic' : undefined,
          textDecoration: decoration,
          opacity: s.dim ? 0.7 : undefined,
        }}
      >
        {s.text}
      </span>
    )
  }
  return (
    <pre
      ref={ref}
      className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-background/60 p-1.5 font-mono text-xs leading-relaxed text-foreground/75"
      data-testid={testId}
    >
      {spans.map(renderSpan)}
    </pre>
  )
}

/** 单个终端任务:一条命令 = 一行 StreamRow,展开后是 StreamDetail + StreamCode */
const TerminalItem = React.memo(function TerminalItem({ term }: { term: TerminalTask }) {
  const t = useTranslations('ai.pane')
  const tStatus = useTranslations('taskStatus')
  const statusLabel = useStreamStatusLabel()
  const [expanded, setExpanded] = React.useState(false)
  const [showAllOutput, setShowAllOutput] = React.useState(false)
  // 2026-09-18 立(对标 Codex/Trae 实时 stdout 行流):命令执行期间后端逐块下发
  // terminal_delta,由 send-message.ts 写入 store.terminalOutputs(键 = terminalId)。
  // 这里按 id 精确订阅(返回原始字符串,引用稳定,zustand selector 安全)。
  const liveOutput = useChatStore((s) => s.terminalOutputs[term.id])
  const clearTerminalOutput = useChatStore((s) => s.clearTerminalOutput)
  // 权威输出:live 缓冲通常比 terminal_end.output(后端截 8000 字符)更长 → 取更长者,
  // 保证构建日志尾部不被截掉;两者皆空时无输出可展开。
  const effectiveOutput =
    liveOutput && liveOutput.length > (term.output?.length ?? 0) ? liveOutput : term.output
  const hasOutput = !!effectiveOutput
  const isRunning = term.status === 'running'
  const status = toStreamStatus(term.status, term.exitCode)
  // 运行中用 useLiveElapsed 实时计时;结束后由后端权威 durationMs 接管(拿不到则不显示)
  const elapsedMs = useLiveElapsed(isRunning, term.durationMs ?? null)
  const exitCodeShown =
    term.exitCode !== undefined && term.exitCode !== 0 ? term.exitCode : undefined

  // 运行中默认展开(实时可见是本次改造的目的),结束后回到手动展开
  React.useEffect(() => {
    if (isRunning && liveOutput) setExpanded(true)
  }, [isRunning, liveOutput])

  const fullOutput = isRunning ? (liveOutput ?? '') : (effectiveOutput ?? '')
  // 运行中保留最新尾部(关注点永远在最后几行);结束后从头截,尾部由「显示更多」给出
  const outputText = React.useMemo(() => {
    if (isRunning) return fullOutput.slice(-OUTPUT_PREVIEW_LIMIT)
    if (showAllOutput || fullOutput.length <= OUTPUT_PREVIEW_LIMIT) return fullOutput
    return fullOutput.slice(0, OUTPUT_PREVIEW_LIMIT)
  }, [isRunning, fullOutput, showAllOutput])
  // V3 #67:后端 terminal 输出不做 ANSI 清洗(实测 _tool_run_command 与
  // terminal_delta 路径只做 redact_secrets),前端解析是唯一渲染面。
  // 含转义时走结构化彩色渲染;无转义保持 StreamCode 原路径(零回归)。
  const outputHasAnsi = React.useMemo(() => hasAnsiCodes(outputText), [outputText])
  const outputSpans = React.useMemo(
    () => (outputHasAnsi ? parseAnsi(outputText) : null),
    [outputHasAnsi, outputText],
  )
  // 服务端截断时 fullOutput 只是**前 8000 字符**,拿它的长度当"原文总长"会主动报错数,
  // 也会让用户点完「显示更多」后看到一条"已完整"的假象 → 原文长度以 totalChars 为准。
  const sourceTotal = Math.max(term.totalChars ?? 0, fullOutput.length)
  const hiddenChars = Math.max(0, sourceTotal - outputText.length)
  // 本地还有未显示的文本时才给「显示更多」;服务端截掉的部分本地没有,展开按钮救不回来
  const hasMoreLocalOutput = fullOutput.length > outputText.length

  const statusText = statusLabel(status)
  const rowTitle = tStatus('toolRunCommand')

  return (
    <div>
      <StreamRow
        status={status}
        title={rowTitle}
        subject={term.command}
        subjectKind="command"
        elapsedMs={elapsedMs}
        trailing={
          exitCodeShown === undefined ? undefined : (
            <StreamTag tone="danger">{tStatus('exitCode', { n: exitCodeShown })}</StreamTag>
          )
        }
        onClick={hasOutput ? () => setExpanded((v) => !v) : undefined}
        expanded={expanded}
        ariaLabel={[rowTitle, term.command, statusText].join(' · ')}
        testId={`terminal-item-${term.id}`}
      />
      {hasOutput && expanded && (
        <StreamDetail
          className="animate-in fade-in-0 slide-in-from-top-1 duration-150"
          testId={`terminal-detail-${term.id}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <StreamLabel>{t('terminal.output')}</StreamLabel>
            {isRunning && liveOutput && <StreamTag tone="running">{t('terminal.live')}</StreamTag>}
            {/* V3 #67 复制决定:复制**剥离转义后的纯文本** —— \x1b[31m 粘贴
                到任何地方都是垃圾且可能被终端误解释,颜色本就不该进剪贴板 */}
            <CopyButton
              text={stripAnsiCodes(fullOutput)}
              aria-label={t('terminal.copyOutput')}
              data-testid={`terminal-copy-output-${term.id}`}
            />
            {liveOutput && (
              <button
                type="button"
                onClick={() => clearTerminalOutput(term.id)}
                className="rounded-sm px-1 text-xs text-muted-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground"
                aria-label={t('terminal.clearLive')}
                data-testid={`terminal-clear-live-${term.id}`}
              >
                {t('terminal.clearLive')}
              </button>
            )}
          </div>
          {outputHasAnsi && outputSpans ? (
            <AnsiCodeBlock
              spans={outputSpans}
              autoScrollToBottom={isRunning}
              testId={`terminal-output-${term.id}`}
            />
          ) : (
            <StreamCode
              text={outputText}
              autoScrollToBottom={isRunning}
              testId={`terminal-output-${term.id}`}
            />
          )}
          {hiddenChars > 0 && (
            <div className="flex items-center gap-1.5">
              {hasMoreLocalOutput && (
                <button
                  type="button"
                  onClick={() => setShowAllOutput(true)}
                  className="rounded-sm px-1 py-px text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  data-testid={`terminal-show-more-${term.id}`}
                >
                  {tStatus('showMore')}
                </button>
              )}
              <StreamTag tone="neutral" testId={`terminal-truncated-${term.id}`}>
                {t('terminal.truncated', { total: sourceTotal })}
              </StreamTag>
            </div>
          )}
        </StreamDetail>
      )}
    </div>
  )
})

/**
 * TerminalSection — 终端任务折叠子区
 *
 * v12: 输出渲染支持 ANSI 彩色(V3 #67) —— SGR 解析为结构化 span(防 XSS),
 *       无转义输出保持 StreamCode 原路径;复制按钮复制剥离转义后的纯文本
 * v11: 点击终端行展开 output(CSS grid 动画 + 复制按钮)
 * v10 memo:React.memo 包装,terminals 引用稳定时跳过重渲染
 */
export const TerminalSection = React.memo(function TerminalSection({
  terminals,
}: TerminalSectionProps) {
  const t = useTranslations('ai.pane')
  if (terminals.length === 0) return null

  const runningCount = terminals.filter((term) => term.status === 'running').length
  const failedCount = terminals.filter(
    (term) => toStreamStatus(term.status, term.exitCode) === 'error',
  ).length
  const recentTerminals = terminals.slice(-10)

  return (
    <FoldableSection
      title={t('terminal.title')}
      count={terminals.length}
      icon={TerminalSquare}
      data-testid="terminal-section"
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-1 px-1">
          {/* G-154(对标 Codex「命令在专用终端实例中运行」):执行环境必须交代,且必须是真实陈述 ——
              os_sandbox.py 的 allow_network 默认 False(H5 三平台验收),故"默认不开放网络"不是营销话术。 */}
          <StreamTag tone="neutral" testId="terminal-isolation">
            {t('terminal.isolation')}
          </StreamTag>
          {runningCount > 0 && (
            <StreamTag tone="running">{t('terminal.running', { n: runningCount })}</StreamTag>
          )}
          {failedCount > 0 && (
            <StreamTag tone="danger">{t('terminal.failed', { n: failedCount })}</StreamTag>
          )}
        </div>
        {recentTerminals.map((term) => (
          <TerminalItem key={term.id} term={term} />
        ))}
        {terminals.length > 10 && (
          <div className="px-1 text-[11px] text-muted-foreground/60">
            {t('terminal.moreItems', { n: terminals.length - 10 })}
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default TerminalSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
