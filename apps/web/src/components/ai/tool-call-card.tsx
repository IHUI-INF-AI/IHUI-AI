'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useWorkPanelStore } from '@/stores/work-panel'
import { InlineDiffCard } from './inline-diff-card'
import type { InlineDiffInfo } from './types'
import type { DiffApplyStatus } from '@/stores/chat'

interface ToolCallCardProps {
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error'
  duration?: number
  error?: string
  /** 多轮 tool loop 轮次(>1 时显示"第N轮"徽章) */
  iteration?: number
  /** edit_file/write_file 关联的 Inline Diff 信息(显式传入优先;否则从 args 推导) */
  diffInfo?: InlineDiffInfo
  /** Inline Diff Apply 工作流状态 */
  applyStatus?: DiffApplyStatus
  /** Apply 失败时的错误信息 */
  applyError?: string
  /** Accept 回调(由父组件绑定 messageId + toolCallId) */
  onApply?: () => void
  /** Reject 回调(由父组件绑定 messageId + toolCallId) */
  onReject?: () => void
  /** 后端重复调用检测命中时标记(渲染"已跳过"徽章) */
  repeated?: boolean
  /** 工具瞬时失败自动重试次数(L5-8,>0 时显示"重试N次"徽章) */
  retryCount?: number
  /** 失败错误分类(L5-8:timeout/connection/http_5xx/http_4xx/unknown,错误时显示徽章) */
  errorType?: string
  /** image_generation 工具返回的图片 URL(优先于 result 渲染) */
  imageUrl?: string
  /** summarize_artifacts 工具返回的摘要数据(优先于 result 渲染) */
  summaryData?: {
    plans?: Array<{ id: string; title: string; status: string; steps?: string[] }>
    sources?: Array<{ type: string; ref: string; accessed_at?: string }>
    artifacts?: Array<{ type: string; path: string; created_at?: string }>
    tool_calls_summary?: { total: number; by_tool: Record<string, number> }
  }
  /** 2026-07-31 立,AI 对话可视化深度接入:工具来源标识
   *  - builtin: 内置工具(read_file/edit_file 等核心工具集)
   *  - plugin: 插件工具(browser_xxx/computer_xxx 等 PLUGIN_ID_TO_TOOLS 映射)
   *  - mcp: MCP server 注册的外部工具(serverId/serverName 必填) */
  serverSource?: 'builtin' | 'plugin' | 'mcp'
  /** MCP server ID(serverSource='mcp' 时显示,如 'context7' / 'filesystem' / 'github') */
  serverId?: string
  /** MCP server 显示名(serverSource='mcp' 时显示,如 'Context7 MCP') */
  serverName?: string
}

const STATUS_CONFIG = {
  running: { icon: Loader2, className: 'animate-spin text-primary', labelKey: 'statusRunning' },
  success: { icon: Check, className: 'text-green-500', labelKey: 'statusSuccess' },
  error: { icon: AlertCircle, className: 'text-red-500', labelKey: 'statusFailed' },
} as const

/** 浏览器类工具名(命中则视为 URL 相关,可触发 WorkPanel) */
const BROWSER_TOOL_NAMES = new Set([
  'browser_navigate',
  'browser_click',
  'browser_extract',
  'browser_screenshot',
  'web_search',
  'fetch-url',
  'fetch_url',
  'web_fetch',
])

/** edit_file / write_file 工具名命中即渲染 InlineDiffCard */
const DIFF_TOOL_NAMES = new Set(['edit_file', 'write_file'])

/** image_generation 工具名命中即渲染 <img> */
const IMAGE_TOOL_NAMES = new Set(['image_generation'])

/** summarize_artifacts 工具名命中即渲染聚合视图 */
const SUMMARY_TOOL_NAMES = new Set(['summarize_artifacts'])

/** 从 args 中提取字符串字段(兼容 camelCase / snake_case 多种命名) */
function pickStr(args: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string') return v
  }
  return ''
}

/** 从 tool args 推导 InlineDiffInfo(edit_file/write_file 专用)
 *  导出供 message-list.tsx 在绑定 onApply 回调时构造 diffInfo 用 */
export function deriveDiffInfo(
  toolName: string,
  args: Record<string, unknown>,
): InlineDiffInfo | null {
  const filePath = pickStr(args, ['path', 'file_path', 'filePath', 'filename']) || '(未知文件)'

  if (toolName === 'edit_file') {
    const oldContent = pickStr(args, ['oldText', 'old_text', 'oldContent', 'old_content'])
    const newContent = pickStr(args, ['newText', 'new_text', 'newContent', 'new_content'])
    if (!oldContent && !newContent) return null
    return { file_path: filePath, old_content: oldContent, new_content: newContent }
  }

  if (toolName === 'write_file') {
    const content = pickStr(args, ['content', 'fileContent', 'file_content', 'text'])
    if (!content) return null
    // write_file 无旧内容(新建或全量覆盖),old_content 留空 → diff 全绿色新增
    return {
      file_path: filePath,
      old_content: '',
      new_content: content,
      is_new_file: true,
    }
  }

  return null
}

/** 从 args/result 中提取 URL */
function extractUrl(
  toolName: string,
  args: Record<string, unknown>,
  result?: unknown,
): string | null {
  // args 中常见字段:url / href / link / target
  const fromArgs =
    (args.url as string) ||
    (args.href as string) ||
    (args.link as string) ||
    (args.target as string)
  if (typeof fromArgs === 'string' && /^https?:\/\//i.test(fromArgs)) return fromArgs

  // result 中提取(可能是字符串或对象)
  if (typeof result === 'string') {
    // 从结果文本中匹配第一个 URL
    const match = result.match(/https?:\/\/[^\s"'<>]+/i)
    if (match) return match[0]
  } else if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const fromResult = (obj.url as string) || (obj.href as string) || (obj.link as string)
    if (typeof fromResult === 'string' && /^https?:\/\//i.test(fromResult)) return fromResult
  }

  // web_search 工具可能返回多个结果,提取第一个 URL
  if (toolName === 'web_search' && Array.isArray(result)) {
    const first = result.find((r) => {
      if (typeof r === 'object' && r !== null) {
        const u = (r as Record<string, unknown>).url
        return typeof u === 'string' && /^https?:\/\//i.test(u)
      }
      return false
    })
    if (first) return (first as Record<string, unknown>).url as string
  }

  return null
}

/** image_generation 工具结果渲染:图片预览 + 提示词 + 新窗口打开链接 */
function ImageResultBlock({ imageUrl, prompt }: { imageUrl: string; prompt?: string }) {
  const t = useTranslations('ai.toolCall')
  const [loaded, setLoaded] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  return (
    <div className="space-y-2">
      {prompt && <p className="mb-1 font-medium text-muted-foreground">{t('prompt')}</p>}
      {prompt && <p className="text-xs italic text-muted-foreground">{prompt}</p>}
      <div className="relative overflow-hidden rounded-md border border-border bg-muted/30">
        {!loaded && !errored && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {errored && (
          <div className="flex h-48 items-center justify-center text-xs text-red-500">
            {t('imageLoadFailed')}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image 不适用动态远程图片,降级用 img */}
        <img
          src={imageUrl}
          alt={prompt || t('imageAltDefault')}
          className={cn(
            'w-full object-contain transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0',
            errored && 'hidden',
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        <span>{t('openInNewWindow')}</span>
      </a>
    </div>
  )
}

/** summarize_artifacts 工具结果渲染:计划/引用/工具调用统计聚合视图 */
function SummaryResultBlock({ data }: { data: NonNullable<ToolCallCardProps['summaryData']> }) {
  const t = useTranslations('ai.toolCall')
  return (
    <div className="space-y-3">
      {data.plans && data.plans.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">
            {t('plan', { count: data.plans.length })}
          </p>
          <ul className="space-y-1 text-xs">
            {data.plans.map((p, i) => (
              <li key={p.id || i} className="flex items-center gap-2">
                <span
                  className={cn(
                    'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]',
                    p.status === 'completed'
                      ? 'bg-green-500/10 text-green-600'
                      : p.status === 'in_progress'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {p.status}
                </span>
                <span className="break-words">{p.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.sources && data.sources.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">
            {t('reference', { count: data.sources.length })}
          </p>
          <ul className="space-y-0.5 text-xs">
            {data.sources.slice(0, 5).map((s, i) => (
              <li key={i} className="truncate font-mono text-muted-foreground">
                <span className="mr-1 rounded-sm bg-muted px-1 py-0.5 text-[10px]">{s.type}</span>
                {s.ref}
              </li>
            ))}
            {data.sources.length > 5 && (
              <li className="text-[10px] text-muted-foreground">
                {t('moreItems', { count: data.sources.length - 5 })}
              </li>
            )}
          </ul>
        </div>
      )}
      {data.tool_calls_summary && data.tool_calls_summary.total > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground">
            {t('toolCallStats', { count: data.tool_calls_summary.total })}
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(data.tool_calls_summary.by_tool).map(([tool, count]) => (
              <span
                key={tool}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tabular-nums"
              >
                {tool} × {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const ToolCallCard = React.memo(function ToolCallCard({
  toolName,
  args,
  result,
  status,
  duration,
  error,
  iteration,
  diffInfo: diffInfoProp,
  applyStatus,
  applyError,
  repeated,
  retryCount,
  errorType,
  imageUrl,
  summaryData,
  serverSource,
  serverId,
  serverName,
  onApply,
  onReject,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const t = useTranslations('ai.toolCall')
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  // 提取 URL(P2 联动 WorkPanel)
  const extractedUrl = React.useMemo(
    () => extractUrl(toolName, args, result),
    [toolName, args, result],
  )
  const isBrowserTool = BROWSER_TOOL_NAMES.has(toolName)
  const canOpenInWorkPanel = !!extractedUrl && status === 'success'

  // edit_file/write_file:优先用显式 diffInfo prop,否则从 args 推导
  const diffInfo = React.useMemo<InlineDiffInfo | null>(() => {
    if (diffInfoProp) return diffInfoProp
    if (DIFF_TOOL_NAMES.has(toolName)) return deriveDiffInfo(toolName, args)
    return null
  }, [diffInfoProp, toolName, args])

  // edit_file/write_file 且有 diffInfo:展开时渲染 InlineDiffCard 替代 <pre>
  const showInlineDiff = !!diffInfo

  // image_generation / summarize_artifacts:优先于 result 渲染专用视图
  const isImageTool = IMAGE_TOOL_NAMES.has(toolName)
  const isSummaryTool = SUMMARY_TOOL_NAMES.has(toolName)
  const showImage = isImageTool && !!imageUrl
  const showSummary = isSummaryTool && !!summaryData

  const handleOpenInWorkPanel = React.useCallback(() => {
    if (!extractedUrl) return
    useWorkPanelStore.getState().openPanel({ url: extractedUrl, source: 'ai-tool' })
  }, [extractedUrl])

  return (
    <div className="overflow-hidden rounded-sm border border-border/30 bg-card/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform',
            expanded && 'rotate-90',
          )}
        />
        <StatusIcon className={cn('h-3 w-3 shrink-0', config.className)} />
        <span className="flex-1 truncate text-[11px] font-medium text-foreground/80">
          {toolName}
        </span>
        {/* 2026-07-31 立,AI 对话可视化深度接入:工具来源徽章
          - builtin: 不显示徽章(默认,避免噪音)
          - plugin: 紫底徽章 "插件"
          - mcp: 蓝底徽章 "MCP · {serverName}"(无 serverName 时仅 "MCP")
          让用户一眼分辨原生工具 / 插件工具 / MCP 外部工具 */}
        {serverSource === 'plugin' && (
          <Tooltip content={`插件工具${serverName ? ` · ${serverName}` : ''}`}>
            <span
              aria-label={`插件工具${serverName ? ` · ${serverName}` : ''}`}
              data-testid={`tool-call-source-plugin-${toolName}`}
              className="shrink-0 rounded-sm border border-violet-500/30 bg-violet-500/10 px-1 py-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400"
            >
              {serverName ?? '插件'}
            </span>
          </Tooltip>
        )}
        {serverSource === 'mcp' && (
          <Tooltip content={`MCP 工具${serverName ? ` · ${serverName}` : serverId ? ` · ${serverId}` : ''}`}>
            <span
              aria-label={`MCP 工具${serverId ? ` · ${serverId}` : ''}`}
              data-testid={`tool-call-source-mcp-${toolName}`}
              className="shrink-0 rounded-sm border border-sky-500/30 bg-sky-500/10 px-1 py-0.5 text-[9px] font-medium text-sky-600 dark:text-sky-400"
            >
              MCP{serverName ? ` · ${serverName}` : ''}
            </span>
          </Tooltip>
        )}
        {iteration !== undefined && iteration > 1 && (
          <span className="shrink-0 rounded-sm bg-muted/60 px-1 py-0.5 text-[9px] tabular-nums text-muted-foreground/70">
            第{iteration}轮
          </span>
        )}
        {repeated && (
          <span
            aria-label="LLM 试图重复调用同参数工具,被去重机制跳过"
            className="shrink-0 rounded-sm border border-border/50 bg-muted/40 px-1 py-0.5 text-[9px] text-muted-foreground/70"
          >
            已跳过
          </span>
        )}
        {retryCount !== undefined && retryCount > 0 && (
          <span
            aria-label={`工具瞬时失败后自动重试 ${retryCount} 次`}
            className="shrink-0 rounded-sm border border-border/50 bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-600"
          >
            重试{retryCount}次
          </span>
        )}
        {status === 'error' && errorType && (
          <span
            className={cn(
              'shrink-0 rounded-sm border border-border/50 px-1 py-0.5 text-[9px]',
              errorType === 'timeout' && 'bg-amber-500/10 text-amber-600',
              errorType === 'http_4xx' && 'bg-amber-500/10 text-amber-600',
              (errorType === 'connection' || errorType === 'http_5xx') &&
                'bg-red-500/10 text-red-600',
              errorType === 'cancelled' && 'bg-muted/40 text-muted-foreground',
              !['timeout', 'http_4xx', 'connection', 'http_5xx', 'cancelled'].includes(errorType) &&
                'bg-muted/40 text-muted-foreground',
            )}
          >
            {errorType}
          </span>
        )}
        {duration !== undefined && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {duration}ms
          </span>
        )}
        <span className={cn('shrink-0 text-[10px]', config.className)}>{t(config.labelKey)}</span>
      </button>
      {expanded && (
        <div className="space-y-1.5 bg-muted/20 px-2 pb-1.5 pt-1 text-[11px]">
          {/* edit_file/write_file:InlineDiffCard 替代 <pre> 渲染 */}
          {showInlineDiff && diffInfo && (
            <InlineDiffCard
              diffInfo={diffInfo}
              applyStatus={applyStatus}
              applyError={applyError}
              onApply={onApply}
              onReject={onReject}
            />
          )}
          {/* image_generation:渲染生成的图片(优先于 result) */}
          {showImage && imageUrl && (
            <ImageResultBlock
              imageUrl={imageUrl}
              prompt={pickStr(args, ['prompt', 'description'])}
            />
          )}
          {/* summarize_artifacts:渲染聚合视图(优先于 result) */}
          {showSummary && summaryData && <SummaryResultBlock data={summaryData} />}
          {/* 非 diff/image/summary 工具时显示原始 args/result */}
          {!showInlineDiff && !showImage && !showSummary && (
            <>
              <div>
                <p className="mb-0.5 text-[10px] font-medium text-muted-foreground/70">参数</p>
                <pre className="overflow-x-auto rounded-sm bg-muted/40 p-1.5 font-mono text-[10px]">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
              {error && (
                <div>
                  <p className="mb-0.5 text-[10px] font-medium text-red-500/80">错误</p>
                  <pre className="overflow-x-auto rounded-sm bg-red-500/8 p-1.5 font-mono text-[10px] text-red-500/80">
                    {error}
                  </pre>
                </div>
              )}
              {result !== undefined && (
                <div>
                  <p className="mb-0.5 text-[10px] font-medium text-muted-foreground/70">结果</p>
                  <pre className="overflow-x-auto rounded-sm bg-muted/40 p-1.5 font-mono text-[10px]">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
          {/* P2 联动:成功执行 + 含 URL → "在工作展示区打开" 按钮 */}
          {canOpenInWorkPanel && (
            <button
              type="button"
              onClick={handleOpenInWorkPanel}
              className="inline-flex items-center gap-1 rounded-sm border border-border/40 bg-background/80 px-2 py-1 text-[10px] hover:bg-muted/40"
            >
              <ExternalLink className="h-3 w-3" />
              <span>在工作展示区打开{isBrowserTool ? '' : '(URL)'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export default ToolCallCard
