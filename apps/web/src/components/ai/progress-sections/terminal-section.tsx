// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Keyboard, TerminalSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { postTerminalInput } from '@ihui/api-client'
// b76-13 票7(2026-09-30 立):消费侧集合裁尾唯一出口 —— 裁尾与"少列了多少"原子产出,
// 淘汰的条数必须渲染成「N more」露出,不许静默截断(判据见 scripts/check-list-cap-honesty.mjs)。
import { tailWithOmittedCount } from '@ihui/api-client/client'
import { Button, Input } from '@ihui/ui-react'
import { FoldableSection } from './foldable-section'
import { CopyButton } from './copy-button'
import { useChatStore, type TerminalInteractionState } from '@/stores/chat'
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

/**
 * TerminalInputRow — D151「命令在等键盘输入」的输入行(2026-09-29 立)
 *
 * 只做三件事:交代在等什么(waitingInput + 提示原文 promptTail)、把**一行**字经
 * `postTerminalInput` 送回、失败时如实显示并把该行留在框里。
 *
 * 安全边界(硬性):
 * - 键入内容绝不进 store / localStorage / console / 任何日志 —— 它可能就是那句
 *   `Password:` 后面要输的密码;成功即清除整条等待态,失败只写 `failed` 布尔。
 * - 上行只走 @ihui/api-client(AGENTS §3),端内不得自拼 fetch。
 * - 无 sessionId(本轮没观察到 ai-service 流会话 ID)时**如实失败**,不把一行字
 *   POST 到一个猜出来的地址(那等于"按了回车而命令一个字节都没收到")。
 * - 重复提交由 `submitting` 挡住:一帧只许送一次。
 */
const TerminalInputRow = React.memo(function TerminalInputRow({
  termId,
  interaction,
}: {
  termId: string
  interaction: TerminalInteractionState
}) {
  const tTerminal = useTranslations('chat.terminal')
  const tFeedback = useTranslations('feedback')
  const setTerminalInteraction = useChatStore((s) => s.setTerminalInteraction)
  const clearTerminalInteraction = useChatStore((s) => s.clearTerminalInteraction)
  // 键入只在组件本地 state(不落 store,更不落持久化);失败后不清空 = 用户不必重打
  const [text, setText] = React.useState('')
  const { promptTail, maxInputChars, sessionId, submitting, failed } = interaction

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    if (!sessionId) {
      setTerminalInteraction(termId, { failed: true })
      return
    }
    setTerminalInteraction(termId, { submitting: true, failed: false })
    // 刻意不 await 后 setState-on-unmount:等待态被清除时本行随之卸载,
    // 而 clearTerminalInteraction 对不存在的键是 no-op ⇒ 不需要额外的存活判断。
    void postTerminalInput(sessionId, { terminalId: termId, text })
      .then((ack) => {
        // 服务端对"没这条"与"不是你的"回 **HTTP 200 + {ok:false}**(不给存在性预言机),
        // 所以 resp.ok 不是判据 —— 必须读 ack。只 .then() 不判 ok 会把"没送到"演成"送到了"。
        if (ack.ok) {
          clearTerminalInteraction(termId)
        } else {
          setTerminalInteraction(termId, { submitting: false, failed: true })
        }
      })
      .catch(() => {
        // 刻意不取 error 参数:message 里带 session/terminal 标识,而界面只需要"这次没送出去";
        // 任何情况下都不回显 text(它就是那行键入本身)。
        setTerminalInteraction(termId, { submitting: false, failed: true })
      })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-1.5 px-1 py-1"
      data-testid={`terminal-interaction-${termId}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-xs leading-none text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {tTerminal('waitingInput')}
        </span>
        {promptTail ? (
          <span
            className="truncate font-mono text-xs leading-none text-muted-foreground/80"
            data-testid={`terminal-interaction-prompt-${termId}`}
          >
            {tTerminal('promptLabel', { prompt: promptTail })}
          </span>
        ) : null}
        {failed ? (
          // 只在**点过发送之后**出现:没有 sessionId 时提前挂"提交失败"是给还没发生的
          // 事出结论(本仓最高频失效型就是把"未判"写成"已判"的反向 —— 把"未发生"写成"已失败")
          <StreamTag tone="danger" testId={`terminal-interaction-failed-${termId}`}>
            {tFeedback('failed')}
          </StreamTag>
        ) : null}
      </div>
      <Input
        type="text"
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(maxInputChars > 0 ? next.slice(0, maxInputChars) : next)
        }}
        maxLength={maxInputChars > 0 ? maxInputChars : undefined}
        disabled={submitting}
        aria-label={tTerminal('waitingInput')}
        className="h-7 min-w-0 flex-1 text-xs"
        data-testid={`terminal-interaction-input-${termId}`}
      />
      <Button
        type="submit"
        size="xs"
        disabled={submitting}
        data-testid={`terminal-interaction-submit-${termId}`}
      >
        {tTerminal('submit')}
      </Button>
    </form>
  )
})

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
  // D151:同一张卡上的"等待输入"态(键同为 terminalId;undefined = 这条命令没在等人)。
  // 返回 store 里那条记录本身 ⇒ 引用稳定(只有该键被重写才变),zustand selector 安全。
  // 取链带 `?.` 不是给类型补洞(该切片恒在),而是本票"只加不改"的边界:同目录既有套件
  // 用**部分 store mock**(只喂 terminalOutputs),少了这一层就是 5 条用例被无关改动打红。
  const interaction = useChatStore((s) => s.terminalInteractions?.[term.id])
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
      {/* D151:等待输入行**不受展开态支配** —— 要用户先点开展开才看得见的提示,
          等于没有提示(命令正挂着等这一行)。 */}
      {interaction ? <TerminalInputRow termId={term.id} interaction={interaction} /> : null}
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
  // b76-13 票7:裁尾走唯一出口,omittedCount 是「还有 N 项」的唯一事实来源(0 时无占位)
  const { items: recentTerminals, omittedCount } = tailWithOmittedCount(terminals)

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
        {omittedCount > 0 && (
          <div className="px-1 text-[11px] text-muted-foreground/60">
            {t('terminal.moreItems', { n: omittedCount })}
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default TerminalSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
