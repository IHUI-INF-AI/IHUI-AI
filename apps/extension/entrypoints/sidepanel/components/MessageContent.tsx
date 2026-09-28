// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
import { type ComponentType, useMemo, type ReactNode } from 'react'
import { Check, CircleDashed, Loader2, Terminal, X } from 'lucide-react'
import {
  buildRenderModel,
  describeMcpToolActivity,
  describeToolCall,
  humanizeToolText,
  permissionTierWordKeys,
  toolActivityState,
  toolDisplayKey,
  type ChatMessage,
  type ReasoningRenderBlock,
  type RenderPlanStep,
  type SubagentRenderBlock,
  type TerminalRenderBlock,
  type ToolMetricKind,
  type ToolRenderBlock,
  type ToolSubjectKind,
} from '@ihui/shared'
import { formatTokenCount } from '@ihui/shared/utils'
import { ContextInjectionList } from '@ihui/ui-react'
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

// ==================== 活动行基元(与 web stream-ui 同一信息顺序) ====================

/**
 * taskStatus 命名空间取词器。
 *
 * 共享层(describeToolCall / humanizeToolText)给出的是 **未限定** 的 taskStatus 键名
 * —— web 端用 next-intl 的 `useTranslations('taskStatus')` 天然带命名空间,
 * extension 的 `t` 走"全路径点号键",必须在此补前缀。
 * 少了这一步界面会回显英文键名(把 read_file 显示成 "toolReadFile"),
 * 等于换个姿势违反"禁止直显英文码名",故抽成单一函数集中处理。
 */
export function makeToolTranslate(t: Translate): Translate {
  return (key: string, params?: Record<string, string | number>) => t(`taskStatus.${key}`, params)
}

/** 工具码名 → 用户可见功能名:映射命中的走 i18n,未登记的(插件/MCP 动态名)保留码名 */
export function toolDisplayName(toolName: string | undefined, tTool: Translate): string {
  if (!toolName) return '—'
  const key = toolDisplayKey(toolName)
  return key ? tTool(key) : toolName
}

/** `mcpToolActivityTitle` 只读这几字段,签名收窄便于调用方与测试都只喂必要项 */
export type McpToolRowInput = Pick<
  ToolRenderBlock,
  'toolName' | 'status' | 'serverSource' | 'serverName' | 'serverId'
>

/**
 * MCP 工具行的定制措辞(D83 接线,extension 端渲染点入口;与 mobile-rn 的
 * `chat-render-model.mcpToolActivityTitle` 同名同语义,跨端 grep 找得到同一个概念)。
 *
 * 措辞层不在端内:`@ihui/shared/chat` 的 `describeMcpToolActivity` 才是唯一数据源
 * (server×tool → server → tool → 功能名 → 码名 五级回落 + 双时态 + 带上下文档)。
 * web(`tool-call-card.tsx` / `task-status-bar.tsx`)与小程序(`cards/tool-line.ts`)、
 * RN 早已各自接上,本端此前只有 `serverName` 当徽章摆在行尾、行首标题仍是裸码名
 * (`create_issue`),即"造好没装车"那一型:链在共享层、端上没人调,屏幕就永远不涨。
 *
 * 返回 `null` = "本端这一行没有可渲染的 MCP 措辞",调用方必须沿用既有功能名口径:
 * - 非 MCP(serverSource ≠ 'mcp')—— 内置/插件工具不归本层管,免得顺手改掉全站工具行文案;
 * - error / cancelled —— 对失败或被撤回的调用声称"已完成 X"是假陈述(用共享的
 *   `toolActivityState` 判,不在端内重抄一份状态白名单);
 * - 整条链走到链尾只剩原始码名 —— 界面禁止直显 `create_issue`。
 *
 * 取词边界的回显归一(与 RN 同一处坑):共享层 `usableRenderedText` 拿**未加前缀**的键比结果,
 * 而本端 `tTool`(= `makeToolTranslate(t)`,已补 `taskStatus.`)缺键时回显的是点号全路径,
 * 两者不等 ⇒ 那道守卫在本端形状上判不出回显。键的拼法只有本端知道,所以在这里归一,
 * 不去改共享层判据(改了要同时复核 web / 小程序 / RN 三个消费端,属另一票)。
 */
export function mcpToolActivityTitle(block: McpToolRowInput, tTool: Translate): string | null {
  if (block.serverSource !== 'mcp') return null
  const state = toolActivityState(block.status)
  if (state === null) return null
  const line = describeMcpToolActivity({
    // serverId 回落与 web 同一口径(MCP 帧可能只带 ID 不带显示名)
    serverName: block.serverName ?? block.serverId ?? null,
    toolName: block.toolName,
    state,
    translate: (key, params) => {
      const text = tTool(key, params)
      // 回显键名 ⇒ 交空串:共享层认空串为"本级未命中",会继续走链,最终落回原始码名,
      // 再由下面的 `line === block.toolName` 折成 null —— 语言包漏译不会把键名印到界面。
      return text === `taskStatus.${key}` ? '' : text
    },
  })
  return line === block.toolName ? null : line
}

/** 对象类字形特征:路径 / URL / 命令用等宽字体,检索词与实体名按正文 */
const MONO_SUBJECT_KINDS: ReadonlySet<ToolSubjectKind> = new Set<ToolSubjectKind>([
  'path',
  'url',
  'command',
])

/** 度量单位键查表(单位文案一律来自共享口径);'chars' 与 web 同口径按行数显示 */
const METRIC_UNIT_KEY: Record<ToolMetricKind, string> = {
  lines: 'unitLines',
  results: 'unitResults',
  files: 'unitFiles',
  chars: 'unitLines',
  none: 'unitLines',
}

/**
 * 徽章确定性居中(AGENTS §4 数字计数徽章规范):
 * inline-flex + h-4 + leading-none + items-center 保证垂直居中不依赖字体行高,
 * tabular-nums 保证多位数字等宽不抖。
 */
const BADGE_CLASS =
  'inline-flex h-4 shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none tabular-nums'

/** 工具状态图标:running 转圈 / success 对勾 / error 叉 / 其余(取消、待执行)虚线圆 */
function toolStatusIcon(block: ToolRenderBlock): ComponentType<{ className?: string }> {
  if (block.isError || block.status === 'error') return X
  if (block.status === 'success') return Check
  if (block.status === 'running') return Loader2
  return CircleDashed
}

/** 工具状态图标配色(与状态徽标同一语义,不额外引入色板) */
function toolStatusIconClass(block: ToolRenderBlock): string {
  if (block.isError || block.status === 'error') return 'text-destructive'
  if (block.status === 'success') return 'text-success'
  if (block.status === 'running') return 'text-primary animate-spin'
  return 'text-muted-foreground/50'
}

/** 通用状态串 → 图标(子代理状态联合与工具状态不同源,按字面量试探,未知态用虚线圆) */
function statusIconByString(status: string): ComponentType<{ className?: string }> {
  if (status === 'failed' || status === 'error') return X
  if (status === 'completed' || status === 'success' || status === 'ok') return Check
  if (status === 'running' || status === 'in_progress') return Loader2
  return CircleDashed
}

/** 通用状态串 → 图标配色 */
function statusIconClassByString(status: string): string {
  if (status === 'failed' || status === 'error') return 'text-destructive'
  if (status === 'completed' || status === 'success' || status === 'ok') return 'text-success'
  if (status === 'running' || status === 'in_progress') return 'text-primary animate-spin'
  return 'text-muted-foreground/50'
}

/** 子代理状态文案:已知态走 taskStatus i18n,未知态回落原值(不猜语义) */
function subagentStatusLabel(status: string, tTool: Translate): string {
  switch (status) {
    case 'completed':
    case 'success':
    case 'ok':
      return tTool('statusSuccess')
    case 'failed':
    case 'error':
      return tTool('statusFailed')
    case 'running':
    case 'in_progress':
      return tTool('statusRunning')
    case 'pending':
      return tTool('stepPending')
    case 'skipped':
      return tTool('statusSkipped')
    default:
      return status
  }
}

/**
 * 枚举原值 → 用户可见措辞的通用映射器(type / decision / mode / dangerLevel 等同族字段共用)。
 *
 * 取舍(刻意为之):**映射不到就原样保留,绝不猜语义**。
 * 这些字段在契约层多被声明为 `string`(后端角色池会增删、审批模式随版本扩展),
 * 错译的代价高于直显英文码名 —— 用户看到 raw 原值知道"这是个未登记的取值",
 * 看到错译(把 deny 译成"已放行")则可能据此做出错误的授权判断。
 * 因此这里只用**已核实存在**的字面量建表,不做大小写归一、不做驼峰拆分等"猜测式"转换。
 */
export function enumLabel(
  raw: string | undefined | null,
  keyMap: Readonly<Record<string, string>>,
  t: Translate,
): string {
  if (!raw) return '—'
  const key = keyMap[raw]
  return key ? t(key) : raw
}

/**
 * 子代理角色名 → 文案键。
 * 字面量取自后端昵称池(Codex 风格:validator/reviewer/explorer/...,
 * 见 apps/web/src/hooks/use-agent-progress.ts NICKNAME_POOL),池外的自定义 agent 角色
 * 属于"用户自己起的标识",按上面取舍保留原值。
 */
export const SUBAGENT_ROLE_KEY: Readonly<Record<string, string>> = {
  validator: 'chat.subagentRoleValidator',
  reviewer: 'chat.subagentRoleReviewer',
  explorer: 'chat.subagentRoleExplorer',
  implementer: 'chat.subagentRoleImplementer',
  planner: 'chat.subagentRolePlanner',
  tester: 'chat.subagentRoleTester',
  researcher: 'chat.subagentRoleResearcher',
  optimizer: 'chat.subagentRoleOptimizer',
  debugger: 'chat.subagentRoleDebugger',
  refactorer: 'chat.subagentRoleRefactorer',
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

/**
 * 工具调用块(含媒体产物)—— 一条活动行:
 * 状态图标 · 工具功能名 · 对象(路径/检索词/URL/命令) · 结果度量(4 行 / 2 个结果 / +18 -4) · 耗时。
 *
 * 素材一律由共享纯函数 `describeToolCall` 给出(跨端单一真相源),端内**不得**再从
 * args/result 里现挖字段,也不得把英文工具码名当用户可见文案(插件/MCP 动态名除外)。
 */
function ToolBlockView({
  block,
  t,
  tTool,
}: {
  block: ToolRenderBlock
  t: Translate
  tTool: Translate
}) {
  const argsText = stringifyValue(block.args)
  const resultText = stringifyValue(block.result)
  const view = describeToolCall({
    toolName: block.toolName,
    args: block.args,
    result: block.result,
    status: block.status,
  })
  const Icon = toolStatusIcon(block)
  // D83:MCP 行先取共享层 server×tool 定制措辞(「正在创建 GitHub 议题」),
  // 未命中即交回下方既有链 —— 内置/插件工具的标题一个字节都不动。
  const title =
    mcpToolActivityTitle(block, tTool) ?? (view.nameKey ? tTool(view.nameKey) : view.codeName)
  const metricText =
    view.metricKind === 'none' || view.metricValue === null || view.metricValue < 0
      ? ''
      : tTool(METRIC_UNIT_KEY[view.metricKind], { n: view.metricValue })
  // 写类文件的 ± 行数:added/removed = -1 表示行数未知,整段不渲染(绝不显示占位 0)
  const showAdded = view.writesFile && view.added >= 0
  const showRemoved = view.writesFile && view.removed >= 0
  const statusText = toolStatusLabel(block, t)
  const durationText =
    typeof block.durationMs === 'number' ? formatDurationMs(block.durationMs) : ''
  const ariaLabel = [title, view.subject, statusText, metricText, durationText]
    .filter((part): part is string => part !== '')
    .join(' · ')

  return (
    <div
      className="px-2 py-1.5 rounded-md border border-border bg-card text-xs"
      role="group"
      aria-label={ariaLabel}
      data-tool-status={block.status}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${toolStatusIconClass(block)}`} aria-hidden />
        <span
          className={`shrink-0 max-w-[45%] truncate font-medium ${view.nameKey ? '' : 'font-mono'}`}
        >
          {title}
        </span>
        {view.subject ? (
          <span
            data-stream-subject="true"
            className={`min-w-0 flex-1 truncate text-muted-foreground ${
              MONO_SUBJECT_KINDS.has(view.subjectKind) ? 'font-mono' : ''
            }`}
          >
            {view.subject}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {block.serverName ? (
          <span className={`${BADGE_CLASS} bg-muted font-normal text-muted-foreground`}>
            {block.serverName}
          </span>
        ) : null}
        {metricText ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">{metricText}</span>
        ) : null}
        {showAdded || showRemoved ? (
          <span className="flex shrink-0 items-center gap-1">
            {showAdded ? (
              <span className={`${BADGE_CLASS} bg-success/10 text-success`}>
                {tTool('addedCount', { n: view.added })}
              </span>
            ) : null}
            {showRemoved ? (
              <span className={`${BADGE_CLASS} bg-destructive/10 text-destructive`}>
                {tTool('removedCount', { n: view.removed })}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className={`${BADGE_CLASS} ${toolStatusClass(block)}`}>{statusText}</span>
        {durationText ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">{durationText}</span>
        ) : null}
      </div>
      {/* D113(2026-09-27):文件写类工具的流中 diff 预览。渲染条件与另三端逐字同形
          —— web tool-call-card.tsx:1160 / RN AiAssistantN8nScreen.tsx:407 /
          小程序 ai-cards.tsx:184 都是 `status==='running' && partialDiff`,
          tool-result 到达即被清,最终 ± 行由上面的徽章与 details 里的 result 接管。
          字号/行高取四端同一档(11px / 16px,对齐 RN monoText 与小程序 22rpx/32rpx),
          容器沿用本卡内既有等宽块形态(p-1.5 / bg-background/70),限高滚动同 web StreamCode。
          不新增文案标签:内容由服务端下发,标签要么多余要么得补五语言键。 */}
      {block.status === 'running' && block.partialDiff ? (
        <pre
          data-testid="tool-call-partial-diff"
          className="m-0 mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-background/70 p-1.5 font-mono text-[11px] leading-4"
        >
          {block.partialDiff}
        </pre>
      ) : null}
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
function TerminalBlockView({
  block,
  t,
  tTool,
  isolation,
}: {
  block: TerminalRenderBlock
  t: Translate
  tTool: Translate
  /** 首个终端块才交代执行环境(web 同区只挂一枚标签,逐块重复会稀释事实) */
  isolation: string | null
}) {
  return (
    <div
      className="px-2 py-1.5 rounded-md border border-border bg-card text-xs"
      role="group"
      aria-label={`${t('chat.terminal')} · ${block.command}`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Terminal className={`h-3.5 w-3.5 shrink-0 text-muted-foreground`} aria-hidden />
        <span className="shrink-0 text-[10px] text-muted-foreground">{t('chat.terminal')}</span>
        <code className="font-mono min-w-0 flex-1 break-all">{block.command}</code>
        {typeof block.exitCode === 'number' ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {tTool('exitCode', { n: block.exitCode })}
          </span>
        ) : null}
        <span className={`${BADGE_CLASS} ${terminalStatusClass(block.status)}`}>
          {terminalStatusLabel(block.status, t)}
        </span>
        {typeof block.durationMs === 'number' ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatDurationMs(block.durationMs)}
          </span>
        ) : null}
      </div>
      {isolation ? (
        <div className="mt-1 text-[10px] text-muted-foreground" data-testid="terminal-isolation">
          {isolation}
        </div>
      ) : null}
      {block.output ? (
        <pre className="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
          {block.output}
        </pre>
      ) : null}
      {/* 后端只下发截断后的文本:不交代总长就等于让用户把截断当完整(回放时没有 live 缓冲可比对) */}
      {block.truncated ? (
        <div
          className="mt-0.5 font-mono text-[10px] text-muted-foreground"
          data-testid={`terminal-truncated-${block.id}`}
        >
          {t('chat.terminalTruncated', {
            total: block.totalChars ?? block.output?.length ?? 0,
          })}
        </div>
      ) : null}
    </div>
  )
}

/** 子代理活动块 */
function SubagentBlockView({
  block,
  t,
  tTool,
}: {
  block: SubagentRenderBlock
  t: Translate
  tTool: Translate
}) {
  const Icon = statusIconByString(block.status)
  return (
    <div
      className="px-2 py-1.5 rounded-md border border-border bg-card text-xs"
      role="group"
      aria-label={`${block.name} · ${subagentStatusLabel(block.status, tTool)}`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${statusIconClassByString(block.status)}`}
          aria-hidden
        />
        {/* name 是用户/后端配置的可读标识(不是枚举),按原值显示;type 是角色码名,必须本地化 */}
        <span className="min-w-0 shrink-0 max-w-[45%] truncate font-medium">{block.name}</span>
        <span
          className={`shrink-0 text-[10px] text-muted-foreground ${
            SUBAGENT_ROLE_KEY[block.type] ? '' : 'font-mono'
          }`}
        >
          {enumLabel(block.type, SUBAGENT_ROLE_KEY, t)}
        </span>
        <span className={`${BADGE_CLASS} bg-muted text-muted-foreground`}>
          {subagentStatusLabel(block.status, tTool)}
        </span>
        {typeof block.toolCallsCount === 'number' ? (
          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
            · {t('chat.subagentTools', { count: block.toolCallsCount })}
          </span>
        ) : null}
      </div>
      {block.currentStep ? (
        <div className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
          {humanizeToolText(block.currentStep, tTool)}
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
  // 步骤标题可能含 "read_file: path" 式英文码名前缀,必须经 humanizeToolText 本地化;
  // 取词器要带 taskStatus 命名空间,否则回显的是 toolReadFile 这类键名(见 makeToolTranslate)
  const tTool = useMemo(() => makeToolTranslate(t), [t])
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {explanation ? <div className="text-[10px] text-muted-foreground">{explanation}</div> : null}
      <ol className="m-0 p-0 list-none flex flex-col gap-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-1.5">
            <span className={`${BADGE_CLASS} shrink-0 ${planStatusClass(step.status)}`}>
              {planStatusLabel(step.status, t)}
            </span>
            <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
              {humanizeToolText(step.step, tTool)}
            </span>
            {typeof step.durationMs === 'number' ? (
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
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
  const tTool = useMemo(() => makeToolTranslate(t), [t])
  const model = useMemo(() => buildRenderModel(message, { streaming }), [message, streaming])
  // G-165①:消息级权限档交代(服务端从 workspace_permissions 反查盖章,不采信客户端自报)。
  // 只有 string 才算数(盖章服务对"不知道"不写 key),经共享 permissionTierWordKeys 归一 ——
  // 认不出的值显示 unknown 键,绝不静默显示成 default。
  const stampedTier =
    typeof message.metadata?.permissionMode === 'string' ? message.metadata.permissionMode : null
  const firstTerminalIdx = model.blocks.findIndex((b) => b.kind === 'terminal')
  return (
    <div className="flex flex-col gap-1.5" data-testid="message-content">
      {stampedTier !== null && (
        <div className="text-[11px] text-muted-foreground" data-testid="message-permission-tier">
          {`${t('permissionTier.label')}: ${t(permissionTierWordKeys(stampedTier).title)} · ${t(
            permissionTierWordKeys(stampedTier).desc,
          )}`}
        </div>
      )}
      {model.blocks.map((block, idx) => {
        switch (block.kind) {
          case 'markdown':
            return <MarkdownText key={block.id} text={block.text} streaming={block.streaming} />
          case 'reasoning':
            return <ReasoningBlockView key={block.id} block={block} t={t} />
          case 'tool':
            return <ToolBlockView key={block.id} block={block} t={t} tTool={tTool} />
          case 'plan':
            return (
              <PlanStepsView key={block.id} steps={block.steps} explanation={block.explanation} />
            )
          case 'terminal':
            return (
              <TerminalBlockView
                key={block.id}
                block={block}
                t={t}
                tTool={tTool}
                isolation={idx === firstTerminalIdx ? t('chat.terminalIsolation') : null}
              />
            )
          case 'subagent':
            return <SubagentBlockView key={block.id} block={block} t={t} tTool={tTool} />
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
      {/* D34 上下文注入交代(第 43 轮跨端):呈现层复用 @ihui/ui-react,取词包成本端点号键 */}
      {message.role === 'assistant' && message.injections?.length ? (
        <ContextInjectionList
          injections={message.injections}
          t={(key, values) => t(`chat.${key}`, values)}
        />
      ) : null}
      {/* #11 引用溯源(第 52 轮):该端此前对 citations 帧 0 命中(只有注释提到它) */}
      {message.role === 'assistant' && message.citations?.length ? (
        <div data-testid="citation-list" className="mt-1">
          <div className="text-[11px] text-muted-foreground">{t('chat.citationTitle')}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {message.citations.map((c, i) => (
              <span
                key={`${c.source}_${i}`}
                className="inline-flex max-w-full items-center gap-1 rounded-sm border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                <span className="rounded-sm bg-muted px-1 py-px text-[9px] font-medium">
                  {c.source}
                </span>
                <span className="truncate">{c.label}</span>
                {c.url ? <span className="truncate opacity-60">{c.url}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {/* D39/D108 上游重试交代:不接就等于侧边栏里只表现为"停顿"。措辞出自 chat.retry* 词表 */}
      {message.role === 'assistant' && message.retryNotice ? (
        <div
          data-testid="retry-notice"
          className="mt-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
        >
          {message.retryNotice.retryInMs > 0
            ? t('chat.retryScheduled', {
                attempt: message.retryNotice.attempt,
                max: message.retryNotice.maxRetries,
                seconds: Math.round(message.retryNotice.retryInMs / 1000),
              })
            : t('chat.retryScheduledNow', {
                attempt: message.retryNotice.attempt,
                max: message.retryNotice.maxRetries,
              })}
        </div>
      ) : null}
      {/* D106(2026-09-24)中途引导交代:steer 帧逐条累积,渲染"已引导 N 次"计数 + 引导原文。
          措辞出自 chat.steerNoticeTitle 词表(与 web steerNoticeBar 逐字同源),text 是内容非 chrome。 */}
      {message.role === 'assistant' && message.steerNotices?.length ? (
        <div
          data-testid="steer-notice"
          className="mt-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
        >
          <div className="font-medium">
            {t('chat.steerNoticeTitle', { count: message.steerNotices.length })}
          </div>
          <ul className="mt-0.5 list-disc pl-4">
            {message.steerNotices.map((s, i) => (
              <li key={`${s.timestamp ?? 'steer'}_${i}`} className="truncate">
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default MessageContent
