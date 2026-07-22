'use client'

import * as React from 'react'
import { ChevronRight, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
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
}

const STATUS_CONFIG = {
  running: { icon: Loader2, className: 'animate-spin text-primary', label: '执行中' },
  success: { icon: Check, className: 'text-green-500', label: '成功' },
  error: { icon: AlertCircle, className: 'text-red-500', label: '失败' },
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
  const filePath =
    pickStr(args, ['path', 'file_path', 'filePath', 'filename']) || '(未知文件)'

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
    const fromResult =
      (obj.url as string) || (obj.href as string) || (obj.link as string)
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

export function ToolCallCard({
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
  onApply,
  onReject,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false)
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

  const handleOpenInWorkPanel = React.useCallback(() => {
    if (!extractedUrl) return
    useWorkPanelStore.getState().openPanel({ url: extractedUrl, source: 'ai-tool' })
  }, [extractedUrl])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
          <StatusIcon className={cn('h-4 w-4 shrink-0', config.className)} />
          <CardTitle className="flex-1 break-words text-sm font-medium">{toolName}</CardTitle>
          {iteration !== undefined && iteration > 1 && (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              第{iteration}轮
            </span>
          )}
          {duration !== undefined && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {duration}ms
            </span>
          )}
          <span className={cn('shrink-0 text-xs', config.className)}>{config.label}</span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 p-3 pt-0 text-xs">
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
          {/* 非 diff 工具或无 diffInfo 时显示原始 args/result */}
          {!showInlineDiff && (
            <>
              <div>
                <p className="mb-1 font-medium text-muted-foreground">参数</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
              {error && (
                <div>
                  <p className="mb-1 font-medium text-red-500">错误</p>
                  <pre className="overflow-x-auto rounded-md bg-red-500/10 p-2 font-mono text-red-500">
                    {error}
                  </pre>
                </div>
              )}
              {result !== undefined && (
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">结果</p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>在工作展示区打开{isBrowserTool ? '' : '(URL)'}</span>
            </button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default ToolCallCard
