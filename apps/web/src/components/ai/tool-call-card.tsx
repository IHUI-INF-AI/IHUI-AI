// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2,
  Check,
  ExternalLink,
  Copy,
  BarChart3,
  FilePlus2,
  FileDiff,
  FileX2,
} from 'lucide-react'
import { getArtifactToken } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useClipboard } from '@/hooks/use-clipboard'
import { useWorkPanelStore } from '@/stores/work-panel'
import {
  describeToolActivityByStatus,
  describeToolCall,
  describeMcpToolActivity,
  FILE_WRITE_TOOLS,
  toolActivityState,
  toolDisplayKey,
} from '@ihui/shared/chat'
import {
  ActivityCanceledLabel,
  ActivityCodeBlock,
  ActivityConnectorGroupLabel,
  ActivitySourcesButton,
} from './tool-activity-line'
import {
  StreamDetail,
  StreamLabel,
  StreamCode,
  StreamRow,
  StreamTag,
  useLiveElapsed,
  type StreamStatus,
} from '@/components/chat/stream/stream-ui'
import { InlineDiffCard } from './inline-diff-card'
import type { InlineDiffInfo } from './types'
import type { DiffApplyStatus } from '@/stores/chat'

interface ToolCallCardProps {
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error' | 'cancelled'
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
  /** W5(2026-09-18 立):hunk 级部分应用回调,入参为已接受 hunk 重组后的最终内容 */
  onApplyPartial?: (newContent: string) => Promise<void>
  /** 后端重复调用检测命中时标记(渲染"已跳过"徽章) */
  repeated?: boolean
  /** P3 #30(2026-09-16 立):工具调用 id,随 diff 评审意见记录便于回溯哪次改动 */
  toolCallId?: string
  /** 工具瞬时失败自动重试次数(L5-8,>0 时显示"重试N次"徽章) */
  retryCount?: number
  /** G-68 回退预判三态(D53 一并实施):本次工具调用回退时的文件影响面。
   *  不传时从 diffInfo 自动推导(新建文件→added,有 diff→modified);删除只能显式传入,
   *  diff 卡天然表达不了"文件将被删"。 */
  rollbackState?: RollbackPreviewState
  /** 失败错误分类(L5-8:timeout/connection/http_5xx/http_4xx/unknown,错误时显示徽章) */
  errorType?: string
  /** image_generation 工具返回的图片 URL(优先于 result 渲染) */
  imageUrl?: string
  /** music_generation 工具返回的音频 URL(优先于 result 渲染,渲染 <audio> 播放器) */
  audioUrl?: string
  /** video_generation 工具返回的视频 URL(优先于 result 渲染,渲染 <video> 播放器) */
  videoUrl?: string
  /** 异步长任务 task_id(2026-09-09 立):媒体工具提交成功但产物未就绪时,渲染"任务进行中" */
  taskId?: string
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

/** 工具原始状态 → 活动行统一状态词汇(全消息流只有这五种) */
const STREAM_STATUS: Record<ToolCallCardProps['status'], StreamStatus> = {
  running: 'running',
  success: 'success',
  error: 'error',
  cancelled: 'skipped',
}

/** 失败分类 → taskStatus 里的本地化文案键。此前直接把 timeout/http_4xx 甩在界面上 */
const ERROR_TYPE_KEYS: Record<string, string> = {
  timeout: 'errorTimeout',
  http_4xx: 'errorHttp4xx',
  http_5xx: 'errorHttp5xx',
  connection: 'errorConnection',
  cancelled: 'errorCancelled',
}

/** edit_file / write_file 工具名命中即渲染 InlineDiffCard */
const DIFF_TOOL_NAMES = new Set(['edit_file', 'write_file'])

/** image_generation / image_edit 工具名命中即渲染 <img>(2026-09-09 改图产物同走图片渲染) */
const IMAGE_TOOL_NAMES = new Set(['image_generation', 'image_edit'])

/** music_generation / voice_tts 工具名命中即渲染 <audio> 播放器(token6688/edge-tts,2026-09-08) */
const AUDIO_TOOL_NAMES = new Set(['music_generation', 'voice_tts'])

/** video_generation 工具名命中即渲染 <video> 播放器(token6688,2026-09-08) */
const VIDEO_TOOL_NAMES = new Set(['video_generation'])

/** summarize_artifacts 工具名命中即渲染聚合视图 */
const SUMMARY_TOOL_NAMES = new Set(['summarize_artifacts'])

/** 引用溯源标签展示上限(防止 hits 过多时刷屏) */
const MAX_CITATIONS = 8

/**
 * G-68 回退预判三态(D53 一并实施,2026-09-23 立)。
 * added=将被添加 / modified=将修改 / deleted=将删除。
 * 文案键(ai.toolCall.rollbackAdded/rollbackModified/rollbackDeleted)由主 agent 统一入词表,
 * 本任务只引用不建键(见交付物词表键清单)。
 */
export type RollbackPreviewState = 'added' | 'modified' | 'deleted'

/** 回退态归一:显式传入优先;否则有 diff 时新建文件→added、有旧内容→modified;无 diff 返回 null(不渲染)。 */
export function resolveRollbackPreviewState(args: {
  rollbackState?: RollbackPreviewState
  isNewFile?: boolean
  hasDiff: boolean
}): RollbackPreviewState | null {
  if (args.rollbackState) return args.rollbackState
  if (!args.hasDiff) return null
  return args.isNewFile ? 'added' : 'modified'
}

const ROLLBACK_BADGE_STYLE: Record<
  RollbackPreviewState,
  { chip: string; key: 'rollbackAdded' | 'rollbackModified' | 'rollbackDeleted'; testId: string }
> = {
  added: {
    chip: 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-400',
    key: 'rollbackAdded',
    testId: 'rollback-badge-added',
  },
  modified: {
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    key: 'rollbackModified',
    testId: 'rollback-badge-modified',
  },
  deleted: {
    chip: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400',
    key: 'rollbackDeleted',
    testId: 'rollback-badge-deleted',
  },
}

const ROLLBACK_BADGE_ICON: Record<RollbackPreviewState, typeof FilePlus2> = {
  added: FilePlus2,
  modified: FileDiff,
  deleted: FileX2,
}

/** G-68 回退三态徽章:图标(lucide)+ 文案,色调按 added/modified/deleted 区分。 */
export function RollbackPreviewBadge({ state }: { state: RollbackPreviewState }) {
  const t = useTranslations('ai.toolCall')
  const style = ROLLBACK_BADGE_STYLE[state]
  const Icon = ROLLBACK_BADGE_ICON[state]
  return (
    <span
      data-testid={style.testId}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-4 ${style.chip}`}
    >
      <Icon className="h-3 w-3" />
      <span>{t(style.key)}</span>
    </span>
  )
}

/** 从工具结果中提取引用溯源列表(citations)。
 *  兼容两种后端结构:
 *   1) 结果对象顶层直接含 citations: string[](如 MCP 工具返回结构化对象)
 *   2) 结果对象含 hits: Array<{ citations?: string[] }>(knowledge_lookup 聚合格式)
 *  result 为字符串时先尝试 JSON.parse,失败视为无引用。
 *  返回去重保序后的非空字符串列表(无引用返回空数组,不影响现有渲染)。 */
function extractCitations(result: unknown): string[] {
  let data: unknown = result
  if (typeof result === 'string') {
    try {
      data = JSON.parse(result)
    } catch {
      return []
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []

  const obj = data as Record<string, unknown>
  const out: string[] = []

  // 顶层 citations
  if (Array.isArray(obj.citations)) {
    for (const c of obj.citations) {
      if (typeof c === 'string' && c.trim()) out.push(c.trim())
    }
  }

  // hits 数组逐项收集 citations(knowledge_lookup 聚合格式)
  if (Array.isArray(obj.hits)) {
    for (const hit of obj.hits) {
      if (!hit || typeof hit !== 'object' || Array.isArray(hit)) continue
      const citations = (hit as Record<string, unknown>).citations
      if (!Array.isArray(citations)) continue
      for (const c of citations) {
        if (typeof c === 'string' && c.trim()) out.push(c.trim())
      }
    }
  }

  // 上限此前硬切在这里(截断即丢,D81 第④项点名的那一型):
  // 现在返回全量去重结果,折叠由 CitationsBlock 用「来源」按钮负责展开,完整内容可达。
  return Array.from(new Set(out))
}

/** 提取图表 Artifact 路径(generate_chart 等返回本地 .html 产物)。
 *  仅接受以 .html 结尾的 file_path(单文件 ECharts HTML)。
 *  P1-1(2026-09-01):优先读取 relative_path(相对项目根,如 tmp/charts/xxx.html),
 *  用于换取签名 token 走 iframe 预览;仅在命中白名单目录前缀且 .html 时返回。
 *  返回 { filePath, fileName, relativePath? },不匹配时返回 null。 */
function extractChartArtifact(
  result: unknown,
): { filePath: string; fileName: string; relativePath?: string } | null {
  let data: unknown = result
  if (typeof result === 'string') {
    try {
      data = JSON.parse(result)
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const obj = data as Record<string, unknown>
  const filePath = obj.file_path
  if (typeof filePath !== 'string' || !filePath.trim()) return null
  if (!filePath.trim().toLowerCase().endsWith('.html')) return null

  const fileName = filePath.trim().split(/[\\/]/).pop() || filePath.trim()

  // P1-1:relative_path 仅在白名单目录(tmp/charts、tmp/artifacts)内才可用,
  // 后端签名 token 对白名单外相对路径返回 400,前端直接降级为路径卡片。
  const rawRelative = obj.relative_path
  let relativePath: string | undefined
  if (typeof rawRelative === 'string' && rawRelative.trim().toLowerCase().endsWith('.html')) {
    const norm = rawRelative.trim().replace(/\\/g, '/')
    if (norm.startsWith('tmp/charts/') || norm.startsWith('tmp/artifacts/')) {
      relativePath = norm
    }
  }

  return { filePath: filePath.trim(), fileName, relativePath }
}

/** W13(2026-09-13 立):从引用文本中提取首个 http(s) URL。
 *  knowledge_lookup 等后端 citations 是纯字符串(如 "知识卡片: 标题 https://..."),
 *  提取后该条渲染为可点击外链(target=_blank + rel),无 URL 时维持纯文本 chip。 */
const CITATION_URL_RE = /https?:\/\/[^\s<>"')\]]+/

/** 引用溯源标签组:展示 knowledge_lookup 等返回的图谱实体/关系来源 */
function CitationsBlock({ citations }: { citations: string[] }) {
  const t = useTranslations('ai.toolCall')
  // D81 第⑤项 sourcesButton:超过折叠上限时用「来源 (N)」按钮把余量展开,
  // 而不是像此前那样在 extractCitations 里直接丢掉(截断即丢)。
  const [showAll, setShowAll] = React.useState(false)
  const hasMore = citations.length > MAX_CITATIONS
  const shown = hasMore && !showAll ? citations.slice(0, MAX_CITATIONS) : citations
  if (citations.length === 0) return null
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1">
        <p className="text-[10px] font-medium text-muted-foreground/70">{t('citationsTitle')}</p>
        {hasMore && (
          <ActivitySourcesButton count={citations.length} onClick={() => setShowAll(true)} />
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map((c) => {
          const url = c.match(CITATION_URL_RE)?.[0]
          const chipCls =
            'rounded-sm border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] leading-4 text-amber-700 dark:text-amber-400'
          return url ? (
            <Tooltip content={url}>
              <a
                key={c}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="tool-call-citation"
                className={cn(chipCls, 'cursor-pointer transition-colors hover:bg-amber-500/20')}
              >
                {c}
              </a>
            </Tooltip>
          ) : (
            <span key={c} data-testid="tool-call-citation" className={chipCls}>
              {c}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** 图表 Artifact 路径卡片:文件名 + 路径(一键复制)+ 打开说明,引导用户本机浏览器打开。
 *  iframe 预览不可用(无 relative_path / 换 token 失败)时的降级视图(P1-1)。 */
function ArtifactPathCard({
  filePath,
  fileName,
  failed,
}: {
  filePath: string
  fileName: string
  /** 换 token 失败:提示改用复制路径兜底 */
  failed?: boolean
}) {
  const t = useTranslations('ai.toolCall')
  const { copy, copied } = useClipboard()

  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium text-muted-foreground/70">
        {t('chartGenerated')}
      </p>
      <div className="rounded-sm border border-border/40 bg-muted/30 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-foreground/80">
            <BarChart3 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{fileName}</span>
          </span>
          <button
            type="button"
            onClick={() => void copy(filePath)}
            data-testid="tool-call-copy-path"
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border/40 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? t('pathCopied') : t('copyPath')}</span>
          </button>
        </div>
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">
          <span className="mr-1 text-muted-foreground/50">{t('filePathLabel')}:</span>
          {filePath}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground/60">
          {failed ? t('chartPreviewFailed') : t('chartPreviewHint')}
        </p>
      </div>
    </div>
  )
}

/** 图表 Artifact 卡片:P1-1(2026-09-01)起支持在聊天卡片内直接 iframe 预览。
 *  挂载时用 relative_path 换取 30 分钟签名访问 token(签发端点走 JWT 保护),
 *  iframe 以 sandbox="allow-scripts" 加载产物(禁 allow-same-origin,防越权读任意文件)。
 *  无 relative_path / 换 token 失败 → 降级为 ArtifactPathCard(复制路径 + 本机打开)。 */
function ChartArtifactBlock({
  filePath,
  fileName,
  relativePath,
}: {
  filePath: string
  fileName: string
  relativePath?: string
}) {
  const t = useTranslations('ai.toolCall')
  const [iframeSrc, setIframeSrc] = React.useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = React.useState(false)
  const [tokenLoading, setTokenLoading] = React.useState(false)

  React.useEffect(() => {
    if (!relativePath) return
    let cancelled = false
    setTokenLoading(true)
    setPreviewFailed(false)
    void getArtifactToken(relativePath).then((res) => {
      if (cancelled) return
      setTokenLoading(false)
      if (res.success && res.data?.url) {
        setIframeSrc(res.data.url)
      } else {
        // 未登录(token 端点 401)/ 相对路径被拒(400)→ 降级为路径卡片
        setPreviewFailed(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [relativePath])

  // 无相对路径 / 换 token 失败:降级为纯路径卡片
  if (!relativePath || previewFailed) {
    return <ArtifactPathCard filePath={filePath} fileName={fileName} failed={previewFailed} />
  }

  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium text-muted-foreground/70">
        {t('chartGenerated')}
      </p>
      <div className="overflow-hidden rounded-sm border border-border/40 bg-white">
        {tokenLoading || !iframeSrc ? (
          <div className="flex h-[280px] w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <iframe
            src={iframeSrc}
            title={fileName}
            sandbox="allow-scripts"
            className="h-[280px] w-full"
          />
        )}
      </div>
    </div>
  )
}

/** 从 args 中提取字符串字段(兼容 camelCase / snake_case 多种命名) */
/**
 * args 可能整体缺失:无参工具(如 `web_ui_describe` / `web_ui_read`)的 toolCall 落库后
 * args 字段会被丢掉,前端再 `args[k]` 就是 `Cannot read properties of undefined` —— 它发生在
 * message-list 的渲染路径上,会把整个聊天页打成"应用发生严重错误"(2026-09-21 实测)。
 * 因此一律在入口归一,而不是让每个调用方去记这个坑。
 */
function pickStr(args: Record<string, unknown> | undefined, keys: string[]): string {
  if (!args) return ''
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string') return v
  }
  return ''
}

/** 从 tool args 推导 InlineDiffInfo(edit_file/write_file 专用)
 *  导出供 message-list.tsx 在绑定 onApply 回调时构造 diffInfo 用。
 *  取不到路径时用调用方传入的本地化占位,函数自身不产文案(避免硬编码中文进界面) */
export function deriveDiffInfo(
  toolName: string,
  args: Record<string, unknown> | undefined,
  unknownFilePath: string,
): InlineDiffInfo | null {
  const filePath = pickStr(args, ['path', 'file_path', 'filePath', 'filename']) || unknownFilePath

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
  args: Record<string, unknown> | undefined,
  result?: unknown,
): string | null {
  // 同 pickStr:无参工具的 args 可能是 undefined
  const a = args ?? {}
  // args 中常见字段:url / href / link / target
  const fromArgs =
    (a.url as string) || (a.href as string) || (a.link as string) || (a.target as string)
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

/** music_generation 工具结果渲染:音频播放器 + 提示词 + 新窗口打开链接 */
function AudioResultBlock({ audioUrl, prompt }: { audioUrl: string; prompt?: string }) {
  const t = useTranslations('ai.toolCall')
  return (
    <div className="space-y-2">
      {prompt && <p className="mb-1 font-medium text-muted-foreground">{t('prompt')}</p>}
      {prompt && <p className="text-xs italic text-muted-foreground">{prompt}</p>}
      <audio
        controls
        src={audioUrl}
        preload="metadata"
        className="w-full"
        data-testid="tool-media-audio"
      >
        {/* AI 生成音频无字幕轨,空 track 满足 jsx-a11y/media-has-caption */}
        <track kind="captions" />
      </audio>
      <a
        href={audioUrl}
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

/** video_generation 工具结果渲染:视频播放器 + 提示词 + 新窗口打开链接 */
function VideoResultBlock({ videoUrl, prompt }: { videoUrl: string; prompt?: string }) {
  const t = useTranslations('ai.toolCall')
  return (
    <div className="space-y-2">
      {prompt && <p className="mb-1 font-medium text-muted-foreground">{t('prompt')}</p>}
      {prompt && <p className="text-xs italic text-muted-foreground">{prompt}</p>}
      <video
        controls
        src={videoUrl}
        preload="metadata"
        className="w-full rounded-md border border-border bg-muted/30"
        data-testid="tool-media-video"
      >
        {/* AI 生成视频无字幕轨,空 track 满足 jsx-a11y/media-has-caption */}
        <track kind="captions" />
      </video>
      <a
        href={videoUrl}
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

/* ==================== 长任务自动轮询取件(2026-09-09 立) ====================
 * 媒体工具(video/music/tts/image)提交成功、有 task_id 但产物未就绪时,
 * 卡片自动轮询 GET /api/media/tasks/{task_id}(带鉴权 fetchApi,后端在途任务
 * 会实时向 token6688 探测),任务 succeeded 且有公网产物 URL 后自动切换为
 * 产物渲染,无需用户再次提问取件。轮询间隔 10s,上限 36 次(≈6 分钟),
 * 期间保留手动"刷新状态"按钮兜底。 */
const MEDIA_POLL_INTERVAL_MS = 10_000
const MEDIA_POLL_MAX = 36

interface MediaTaskRow {
  status?: string
  result?: {
    image_url?: string | null
    audio_url?: string | null
    video_url?: string | null
  }
}

type MediaPollStatus = 'idle' | 'checking' | 'succeeded' | 'failed' | 'stopped'

function useMediaTaskPolling(
  taskId: string | undefined,
  enabled: boolean,
): {
  polled: MediaTaskRow['result'] | null
  pollStatus: MediaPollStatus
  checkedAt: number | null
  refreshNow: () => void
} {
  const [polled, setPolled] = React.useState<MediaTaskRow['result'] | null>(null)
  const [pollStatus, setPollStatus] = React.useState<MediaPollStatus>('idle')
  const [checkedAt, setCheckedAt] = React.useState<number | null>(null)
  const doneRef = React.useRef(false)

  const stopPolling = React.useCallback(() => {
    doneRef.current = true
  }, [])

  const pollOnce = React.useCallback(async () => {
    if (doneRef.current || !taskId) return
    try {
      const res = await fetchApi<{ ok: boolean; data: MediaTaskRow }>(
        `/media/tasks/${encodeURIComponent(taskId)}`,
        { timeoutMs: 10_000 },
      )
      if (!res.success) return
      const row = res.data?.data
      if (!row) return
      setCheckedAt(Date.now())
      if (row.status === 'succeeded') {
        const urls = row.result ?? {}
        if (urls.video_url || urls.audio_url || urls.image_url) {
          setPolled(urls)
          setPollStatus('succeeded')
          stopPolling()
          return
        }
      }
      if (row.status === 'failed' || row.status === 'cancelled') {
        setPollStatus('failed')
        stopPolling()
        return
      }
      setPollStatus('idle')
    } catch {
      // 网络瞬断/401 等忽略,下一轮重试
    }
  }, [taskId, stopPolling])

  React.useEffect(() => {
    if (!enabled || !taskId) return
    doneRef.current = false
    setPolled(null)
    setPollStatus('checking')
    void pollOnce()
    const intervalId = window.setInterval(() => {
      if (doneRef.current) {
        window.clearInterval(intervalId)
        return
      }
      void pollOnce()
    }, MEDIA_POLL_INTERVAL_MS)
    // 达到最大轮询次数仍无结果:停止自动轮询,保留手动刷新兜底
    const timeoutId = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        setPollStatus('stopped')
      }
    }, MEDIA_POLL_INTERVAL_MS * MEDIA_POLL_MAX)
    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [enabled, taskId, pollOnce])

  const refreshNow = React.useCallback(() => {
    if (!taskId) return
    doneRef.current = false
    setPollStatus('checking')
    void pollOnce()
  }, [taskId, pollOnce])

  return { polled, pollStatus, checkedAt, refreshNow }
}

/** 长任务进行中渲染(2026-09-09 立):媒体工具提交成功、有 task_id 但产物未就绪。
 *  视频/音乐官方耗时数分钟级,对话内仅提交返回 task_id;卡片自动轮询取件,
 *  并保留手动"刷新状态"按钮兜底。 */
function PendingTaskBlock({
  taskId,
  toolLabel,
  pollStatus,
  checkedAt,
  onRefresh,
}: {
  taskId: string
  /** 已本地化的工具功能名(禁止把 read_file 这类码名甩给用户) */
  toolLabel: string
  pollStatus: MediaPollStatus
  checkedAt: number | null
  onRefresh: () => void
}) {
  const t = useTranslations('ai.toolCall')
  const checking = pollStatus === 'checking'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span className="font-medium text-muted-foreground">{t('pendingTaskTitle')}</span>
        {checkedAt && (
          <span className="text-[11px] text-muted-foreground/50">
            {checking ? t('pendingAutoChecking') : t('pendingAutoChecked')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('pendingTaskSubmitted', { tool: toolLabel })}
      </p>
      <div className="flex items-center gap-1.5">
        <code className="block min-w-0 flex-1 truncate rounded-sm bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {taskId}
        </code>
        <button
          type="button"
          onClick={onRefresh}
          disabled={checking}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border/40 px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{t('pendingCheckingShort')}</span>
            </>
          ) : (
            <span>{t('pendingRefresh')}</span>
          )}
        </button>
      </div>
      {pollStatus === 'stopped' && (
        <p className="text-[11px] text-muted-foreground/60">{t('pendingStopped')}</p>
      )}
      {pollStatus === 'failed' && (
        <p className="text-[11px] text-amber-600">{t('pendingFailed')}</p>
      )}
    </div>
  )
}

/** summarize_artifacts 工具结果渲染:计划/引用/工具调用统计聚合视图 */
function SummaryResultBlock({ data }: { data: NonNullable<ToolCallCardProps['summaryData']> }) {
  const t = useTranslations('ai.toolCall')
  const tStatus = useTranslations('taskStatus')
  const PLAN_TONE: Record<string, 'neutral' | 'running' | 'success' | 'danger'> = {
    in_progress: 'running',
    completed: 'success',
    failed: 'danger',
  }
  const PLAN_LABEL: Record<string, string> = {
    in_progress: t('planStepInProgress'),
    completed: t('planStepCompleted'),
    failed: t('planStepFailed'),
  }
  return (
    <div className="space-y-3">
      {data.plans && data.plans.length > 0 && (
        <div>
          <StreamLabel>{t('plan', { count: data.plans.length })}</StreamLabel>
          <ul className="space-y-1 text-xs">
            {data.plans.map((p, i) => (
              <li key={p.id || i} className="flex items-center gap-2">
                <StreamTag tone={PLAN_TONE[p.status] ?? 'neutral'}>
                  {PLAN_LABEL[p.status] ?? p.status}
                </StreamTag>
                <span className="break-words">{p.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.sources && data.sources.length > 0 && (
        <div>
          <StreamLabel>{t('reference', { count: data.sources.length })}</StreamLabel>
          <ul className="space-y-0.5 text-xs">
            {data.sources.slice(0, 5).map((s, i) => (
              <li key={i} className="truncate font-mono text-muted-foreground">
                <StreamTag>{s.type}</StreamTag> {s.ref}
              </li>
            ))}
            {data.sources.length > 5 && (
              <li className="text-[11px] text-muted-foreground">
                {t('moreItems', { count: data.sources.length - 5 })}
              </li>
            )}
          </ul>
        </div>
      )}
      {data.tool_calls_summary && data.tool_calls_summary.total > 0 && (
        <div>
          <StreamLabel>{t('toolCallStats', { count: data.tool_calls_summary.total })}</StreamLabel>
          <div className="flex flex-wrap gap-1">
            {Object.entries(data.tool_calls_summary.by_tool).map(([tool, count]) => {
              // 统计徽章同样禁止直显英文工具码名
              const key = toolDisplayKey(tool)
              return (
                <StreamTag key={tool}>
                  {key ? tStatus(key) : tool} × {count}
                </StreamTag>
              )
            })}
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
  audioUrl,
  videoUrl,
  taskId,
  summaryData,
  serverSource,
  serverId,
  serverName,
  onApply,
  onReject,
  onApplyPartial,
  toolCallId,
  rollbackState,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const t = useTranslations('ai.toolCall')
  // 取不到文件路径时的占位由文案层给出(组件不产硬编码文案)
  const unknownFileLabel = t('toolUnknownFile')
  // 工具行禁止直显英文工具码名:映射命中的内置工具显示本地化功能名
  const tStatus = useTranslations('taskStatus')

  // 2026-09-01 立,工具调用过程流式可视化:running 状态实时耗时 tick。
  // tool-call-start 到达后卡片即挂载,间隔 250ms 自增一次,让用户看到"执行中"的实时进度;
  // status 变为 success/error 后停止,由后端算出的 durationMs(duration prop)接管显示。
  const liveElapsed = useLiveElapsed(status === 'running', duration ?? null)
  const streamStatus = STREAM_STATUS[status]
  // D81 第⑤项:连接器来源名称(仅 mcp / plugin 两类有来源),空串表示本条不属任何连接器分组
  const connectorName =
    serverSource === 'mcp' || serverSource === 'plugin' ? (serverName ?? serverId ?? '') : ''

  // 一行话的素材:功能名 + 对象 + 结果度量(单一真相源在 @ihui/shared/chat,各端同一口径)
  const view = React.useMemo(
    () => describeToolCall({ toolName, args, result, status }),
    [toolName, args, result, status],
  )
  // 双时态活动措辞(D98/D102):running "正在读取文件" / success "已读取文件"。
  // 此前本行只有图标承载状态(状态文字仅进 aria-label),对屏幕外的用户等于没有状态;
  // error / cancelled 仍只出功能名 —— 对失败或被撤回的调用声称"已完成 X"是假陈述。
  // D83 接线:MCP 调用(serverSource='mcp')先走共享层 server×tool 定制措辞
  // (describeMcpToolActivity 内含同一条双时态回落链),未定制的工具行为与旧链等价。
  const activityState = toolActivityState(status)
  const rowTitle = activityState
    ? describeMcpToolActivity({
        serverName: serverSource === 'mcp' ? (serverName ?? serverId ?? null) : null,
        toolName,
        state: activityState,
        translate: (key, params) => tStatus(key, params),
      })
    : describeToolActivityByStatus({
        toolName,
        status,
        translate: (key, params) => tStatus(key, params),
      })
  const rowTags: string[] = []
  if (serverSource === 'plugin') rowTags.push(serverName || tStatus('sourcePlugin'))
  if (serverSource === 'mcp')
    rowTags.push(
      `${tStatus('sourceMcp')}${serverName || serverId ? ` · ${serverName ?? serverId}` : ''}`,
    )
  if (iteration !== undefined && iteration > 1)
    rowTags.push(tStatus('roundNumber', { n: iteration }))
  if (repeated) rowTags.push(tStatus('statusSkipped'))
  // #23 撤回未执行工具(2026-09-13 立):流中断时残留的 running 调用,行内以文字态保留原因
  if (status === 'cancelled') rowTags.push(t('statusRevoked'))
  if (retryCount !== undefined && retryCount > 0)
    rowTags.push(tStatus('retriedTimes', { n: retryCount }))
  if (status === 'error' && errorType) {
    rowTags.push(ERROR_TYPE_KEYS[errorType] ? tStatus(ERROR_TYPE_KEYS[errorType]) : errorType)
  }
  const rowAriaLabel = [
    rowTitle,
    view.subject,
    tStatus(
      status === 'running'
        ? 'statusRunning'
        : status === 'error'
          ? 'statusFailed'
          : status === 'cancelled'
            ? 'errorCancelled'
            : 'statusSuccess',
    ),
    ...rowTags,
  ]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' · ')

  // 提取 URL(P2 联动 WorkPanel)
  const extractedUrl = React.useMemo(
    () => extractUrl(toolName, args, result),
    [toolName, args, result],
  )
  const canOpenInWorkPanel = !!extractedUrl && status === 'success'

  // edit_file/write_file:优先用显式 diffInfo prop,否则从 args 推导
  const diffInfo = React.useMemo<InlineDiffInfo | null>(() => {
    if (diffInfoProp) return diffInfoProp
    if (DIFF_TOOL_NAMES.has(toolName)) return deriveDiffInfo(toolName, args, unknownFileLabel)
    return null
  }, [diffInfoProp, toolName, args, unknownFileLabel])

  // edit_file/write_file 且有 diffInfo:展开时渲染 InlineDiffCard 替代 <pre>
  const showInlineDiff = !!diffInfo

  // G-68 回退预判三态:显式传入优先,否则从 diffInfo 推导(新建→added,有旧内容→modified)
  const rollbackPreview = resolveRollbackPreviewState({
    rollbackState,
    isNewFile: diffInfo?.is_new_file,
    hasDiff: showInlineDiff,
  })

  // image_generation / music_generation / video_generation / summarize_artifacts:优先于 result 渲染专用视图
  const isImageTool = IMAGE_TOOL_NAMES.has(toolName)
  const isAudioTool = AUDIO_TOOL_NAMES.has(toolName)
  const isVideoTool = VIDEO_TOOL_NAMES.has(toolName)
  const isSummaryTool = SUMMARY_TOOL_NAMES.has(toolName)
  const showImage = isImageTool && !!imageUrl
  const showAudio = isAudioTool && !!audioUrl
  const showVideo = isVideoTool && !!videoUrl
  const showSummary = isSummaryTool && !!summaryData
  // 2026-09-09 长任务进行中:媒体工具提交成功、已有 task_id 但产物未就绪
  // (视频/音乐 p90 55~75 分钟与 1~5 分钟,对话内仅提交返回 task_id)
  const showPendingTask =
    !!taskId &&
    status === 'success' &&
    (isImageTool || isAudioTool || isVideoTool) &&
    !showImage &&
    !showAudio &&
    !showVideo

  // 长任务自动轮询取件(2026-09-09):产物未就绪时后台轮询 /api/media/tasks/{task_id},
  // succeeded 且有公网 URL 后自动切换为产物渲染,无需用户再次提问
  // 2026-09-09 修复:补取 checkedAt(此前未解构,下方 PendingTaskBlock 恒传 null,
  // "已自动检查过"提示永不显示),并透传给进行中卡片
  const {
    polled,
    pollStatus: pollStatusForPending,
    checkedAt,
    refreshNow,
  } = useMediaTaskPolling(showPendingTask ? taskId : undefined, showPendingTask)
  const polledImageUrl = showPendingTask ? polled?.image_url || undefined : undefined
  const polledAudioUrl = showPendingTask ? polled?.audio_url || undefined : undefined
  const polledVideoUrl = showPendingTask ? polled?.video_url || undefined : undefined

  // 引用溯源 + 图表 Artifact:从 result 中解析(knowledge_lookup / generate_chart)
  // 不依赖 toolName 判断,纯字段驱动,保证任何携带 citations/file_path 的工具都兼容
  const citations = React.useMemo(() => extractCitations(result), [result])
  const chartArtifact = React.useMemo(() => extractChartArtifact(result), [result])
  // 图表 Artifact 命中时替代原始 result pre 渲染(与 image/summary 处理方式一致)
  const showChartArtifact = !!chartArtifact && status === 'success'

  const handleOpenInWorkPanel = React.useCallback(() => {
    if (!extractedUrl) return
    useWorkPanelStore.getState().openPanel({ url: extractedUrl, source: 'ai-tool' })
  }, [extractedUrl])

  return (
    <div>
      <StreamRow
        status={streamStatus}
        title={rowTitle}
        subject={view.subject}
        subjectKind={view.subjectKind}
        metricKind={view.metricKind}
        metricValue={view.metricValue}
        added={status === 'success' ? view.added : undefined}
        removed={status === 'success' ? view.removed : undefined}
        tags={rowTags}
        elapsedMs={liveElapsed}
        onClick={() => setExpanded((v) => !v)}
        expanded={expanded}
        ariaLabel={rowAriaLabel}
        testId={`tool-call-row-${toolCallId ?? toolName}`}
      />
      {/* D81 第⑥项 + 第⑤项:活动条下方常驻一行(不随展开消失)。
          - 取消态:行内的「已撤回」徽章只交代状态,这里补上"被取消的是哪一个动作",
            保证被取消的调用在流里留下可辨识条目而非静默消失;
          - 连接器读写方向:方向判定取共享层 FILE_WRITE_TOOLS 白名单,不在端内另立第二套判据。 */}
      {status === 'cancelled' || connectorName !== '' ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          {status === 'cancelled' ? <ActivityCanceledLabel name={rowTitle} /> : null}
          {connectorName !== '' ? (
            <ActivityConnectorGroupLabel
              connector={connectorName}
              direction={FILE_WRITE_TOOLS.has(toolName) ? 'write' : 'read'}
            />
          ) : null}
        </div>
      ) : null}
      {expanded && (
        <StreamDetail className="animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* G-68 回退预判三态徽章:diff 卡顶部一行交代回退影响面 */}
          {rollbackPreview && (
            <div className="flex items-center gap-1.5">
              <RollbackPreviewBadge state={rollbackPreview} />
            </div>
          )}
          {/* edit_file/write_file:InlineDiffCard 替代 <pre> 渲染 */}
          {showInlineDiff && diffInfo && (
            <InlineDiffCard
              diffInfo={diffInfo}
              applyStatus={applyStatus}
              applyError={applyError}
              onApply={onApply}
              onReject={onReject}
              onApplyPartial={onApplyPartial}
              toolCallId={toolCallId}
            />
          )}
          {/* image_generation:渲染生成的图片(优先于 result) */}
          {showImage && imageUrl && (
            <ImageResultBlock
              imageUrl={imageUrl}
              prompt={pickStr(args, ['prompt', 'description'])}
            />
          )}
          {/* music_generation:渲染音频播放器(优先于 result) */}
          {showAudio && audioUrl && (
            <AudioResultBlock
              audioUrl={audioUrl}
              prompt={pickStr(args, ['prompt', 'description'])}
            />
          )}
          {/* video_generation:渲染视频播放器(优先于 result) */}
          {showVideo && videoUrl && (
            <VideoResultBlock
              videoUrl={videoUrl}
              prompt={pickStr(args, ['prompt', 'description'])}
            />
          )}
          {/* summarize_artifacts:渲染聚合视图(优先于 result) */}
          {showSummary && summaryData && <SummaryResultBlock data={summaryData} />}
          {/* 长任务进行中:媒体工具已提交、task_id 已记录、产物未就绪。
              自动轮询取件:轮询到公网产物 URL 后自动切换为对应播放器渲染 */}
          {showPendingTask &&
            taskId &&
            (polledVideoUrl ? (
              <VideoResultBlock
                videoUrl={polledVideoUrl}
                prompt={pickStr(args, ['prompt', 'description'])}
              />
            ) : polledAudioUrl ? (
              <AudioResultBlock
                audioUrl={polledAudioUrl}
                prompt={pickStr(args, ['prompt', 'description'])}
              />
            ) : polledImageUrl ? (
              <ImageResultBlock
                imageUrl={polledImageUrl}
                prompt={pickStr(args, ['prompt', 'description'])}
              />
            ) : (
              <PendingTaskBlock
                taskId={taskId}
                toolLabel={rowTitle}
                pollStatus={pollStatusForPending}
                checkedAt={checkedAt}
                onRefresh={refreshNow}
              />
            ))}
          {/* 非 diff/image/audio/video/summary/pending 工具时显示原始 args/result */}
          {!showInlineDiff &&
            !showImage &&
            !showAudio &&
            !showVideo &&
            !showSummary &&
            !showPendingTask && (
              <>
                {/* 引用溯源:knowledge_lookup 等返回 citations 时渲染标签组 */}
                {citations.length > 0 && <CitationsBlock citations={citations} />}
                {/* 图表 Artifact:generate_chart 等返回本地 .html 时渲染产物卡片 */}
                {showChartArtifact && chartArtifact ? (
                  <ChartArtifactBlock
                    filePath={chartArtifact.filePath}
                    fileName={chartArtifact.fileName}
                    relativePath={chartArtifact.relativePath}
                  />
                ) : (
                  <>
                    <div>
                      <StreamLabel>{tStatus('argsLabel')}</StreamLabel>
                      <StreamCode text={JSON.stringify(args, null, 2)} testId="tool-call-args" />
                    </div>
                    {error && (
                      <div>
                        <StreamLabel>
                          <span className="text-red-500/80">{tStatus('errorLabel')}</span>
                        </StreamLabel>
                        <StreamCode
                          text={error}
                          className="bg-red-500/8 text-red-500/80"
                          testId="tool-call-error"
                        />
                      </div>
                    )}
                    {result !== undefined && (
                      <div>
                        <StreamLabel>{tStatus('resultLabel')}</StreamLabel>
                        {/* D81 第④项:长输出以「展开全部 / 收起」显式收口,完整内容可达 */}
                        <ActivityCodeBlock
                          content={
                            typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                          }
                          testId="tool-call-result"
                        />
                      </div>
                    )}
                  </>
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
              <span>{t('openInWorkPanel')}</span>
            </button>
          )}
        </StreamDetail>
      )}
    </div>
  )
})

export default ToolCallCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
