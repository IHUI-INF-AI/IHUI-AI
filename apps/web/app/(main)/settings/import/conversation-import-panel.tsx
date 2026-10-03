// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 外部会话导入面板(D28,2026-09-20 立;2026-10-03 补「导入 → 拿来分析」层)
 *
 * 四步流:选来源 → 上传文件(20MB 客户端预校验) → 解析预览(多选,默认全选) → 逐会话串行 commit。
 * commit 逐会话调用 api-client 的 commitConversationImport,单个失败不中断其余导入;
 * 全部完成后失效会话列表 query(['chat','conversations']),侧栏立即可见新会话。
 *
 * **2026-10-03 的行为变更**:commit 成功后**不再自动跳到首个会话**,改为停在设置页
 * 渲染「导入结果区」,由用户选「打开会话」或「用场景分析」。原因:导一批群聊记录后
 * 用户的头一个诉求是"看看导进来什么、然后分析",自动跳走等于把结果与分析入口一起
 * 藏起来(用户连导了几条都不知道)。
 *
 * 本面板承接的三件事(D28 补齐层):
 *   1. 结果区:每个成功落库的会话 → 「打开会话」/「用场景分析」两个出口
 *   2. 微信预览期就把"这是群聊记录、谁在说、跨了多久"说清(发言人从正文前缀现算)
 *   3. 导入历史:补来源标签与「打开会话」入口(此前只有文件名/状态/条数,五源长得一样)
 *
 * 覆盖全部 5 个来源(2026-10-03 补齐微信):claude_code / codex / cursor / aider / wechat。
 * 错误一律诚实上屏:解析失败带服务端原文、truncated 与 warnings 在预览区逐条列出、
 * 逐会话 commit 失败原因去重后展示 —— 不做静默吞掉。
 */
import * as React from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  History,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import {
  commitConversationImport,
  getConversationImportHistory,
  parseConversationImport,
  type ConversationImportCommitPayload,
  type ConversationImportParseResult,
  type ConversationImportSource,
  type ParsedImportConversation,
} from '@ihui/api-client'

import { Alert } from '@/components/feedback'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import { formatSpeakerList, readImportProvenance } from '@/lib/import-analysis'
import { formatSize } from './helpers'

/**
 * 「用场景分析」弹窗按需加载(D28 补齐层)。
 *
 * 走 next/dynamic 而非静态 import:弹窗内的场景目录带 210 条模板正文 ≈493KB,
 * 静态 import 会把这体量拖进导入面板的 chunk —— 而设置页的导入面板是低频页面,
 * 用户为"也许会用一次"的分析入口预付 493KB 不划算。
 */
const ImportAnalysisDialogLazy = dynamic(
  () => import('@/components/ai/import-analysis-dialog').then((m) => m.ImportAnalysisDialog),
  { ssr: false },
)

/** 会话导入来源卡片配置(accept 供文件选择器按来源过滤,hint 为典型导出文件路径) */
const IMPORT_SOURCES: Array<{
  value: ConversationImportSource
  labelKey: string
  hintKey: string
  accept: string
}> = [
  {
    value: 'claude_code',
    labelKey: 'sourceClaudeCode',
    hintKey: 'sourceClaudeCodeHint',
    accept: '.jsonl,.json',
  },
  {
    value: 'codex',
    labelKey: 'sourceCodex',
    hintKey: 'sourceCodexHint',
    accept: '.jsonl,.json',
  },
  {
    // Cursor 现代版正文在 state.vscdb(SQLite)里,三种库后缀同义;cursor-agent 转写是 .jsonl
    value: 'cursor',
    labelKey: 'sourceCursor',
    hintKey: 'sourceCursorHint',
    accept: '.json,.jsonl,.vscdb,.db,.sqlite',
  },
  {
    value: 'aider',
    labelKey: 'sourceAider',
    hintKey: 'sourceAiderHint',
    accept: '.md,.json,.jsonl',
  },
  {
    // 微信导出物是归档包/纯文本,与其余四源的 jsonl/sqlite 家族完全不同。
    // 与 CLI(SESSION_SOURCE_CONFIG)/RN(ALLOWED_EXTENSIONS)同口径。
    value: 'wechat',
    labelKey: 'sourceWechat',
    hintKey: 'sourceWechatHint',
    accept: '.zip,.txt',
  },
]

/** 客户端预校验的文件大小上限:20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024

/** 历史记录状态 → i18n key(未知状态回退显示原文) */
const HISTORY_STATUS_KEY: Record<string, string> = {
  success: 'statusSuccess',
  partial: 'statusPartial',
  failed: 'statusFailed',
}

/** 历史记录来源 → i18n key(复用导入来源那批标签;未知来源不显示标签而非显示原文) */
const HISTORY_SOURCE_LABEL_KEY: Record<string, string> = {
  claude_code: 'sourceClaudeCode',
  codex: 'sourceCodex',
  cursor: 'sourceCursor',
  aider: 'sourceAider',
  wechat: 'sourceWechat',
}

/** D28 补齐层:一条成功落库的会话(结果区渲染 + 跳转/分析入口的载荷) */
interface CommittedConversation {
  conversationId: string
  title: string
  messageCount: number
  /**
   * 落库时那一份来源(不读当前 source 状态)。
   * 用户导完可能顺手点了别的来源卡;若分析弹窗去读当前 source,一个微信导入的会话
   * 会拿到 codex 的推荐场景 —— 恰好毁掉"wechat 默认推荐聊天记录类"这条判据。
   */
  source: ConversationImportSource
}

/** 预览期展示用的日期格式(短日期) */
const PREVIEW_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}

/**
 * 微信预览:从 /parse 结果现算发言人清单与时间跨度。
 *
 * 复用 `readImportProvenance`(wechat 识别发言人/时间跨度的**唯一**实现),不另写一份 ——
 * 预览期与会话消息区对同一份记录必须给出同一个答案,两处各写一套正则迟早会漂。
 * 这里把 metadata 侧的信息(来源/via/文件名)按 /parse 的形态补齐后走同一个出口。
 */
function summarizeWechatPreview(
  conv: ParsedImportConversation,
): { speakers: readonly string[]; speakerCount: number; range: string | null } | null {
  const messages = (conv.messages ?? []).map((m) => ({
    content: typeof m.content === 'string' ? m.content : '',
    createdAt: m.createdAt,
  }))
  const result = readImportProvenance(
    { importedFrom: 'wechat', importedVia: 'conversation-import', fileName: null },
    messages,
  )
  if (result.kind !== 'imported') return null
  const { speakers, startedAt, endedAt } = result.provenance
  const range =
    startedAt !== null && endedAt !== null
      ? `${new Date(startedAt).toLocaleDateString(undefined, PREVIEW_DATE_FORMAT)} – ${new Date(
          endedAt,
        ).toLocaleDateString(undefined, PREVIEW_DATE_FORMAT)}`
      : null
  return { speakers, speakerCount: speakers.length, range }
}

export function ConversationImportPanel() {
  const t = useTranslations('conversationImport')
  const qc = useQueryClient()
  const router = useRouter()

  const [source, setSource] = React.useState<ConversationImportSource | ''>('')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ConversationImportParseResult | null>(null)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  // D28 补齐层(2026-10-03):导入**结果区**。
  // 此前 commit 完只有一条 toast + 直接跳到首个会话,用户看不到"到底导进来几个、
  // 哪个失败了、接下来能干什么";导完最想要的下一步(用场景分析)没有落点。
  // 这里保留每个成功落库的会话 id/标题/条数,作为「打开会话」与「用场景分析」的入口。
  const [committed, setCommitted] = React.useState<CommittedConversation[]>([])
  // 「用场景分析」弹窗的目标会话(null = 关闭)
  const [analysisTarget, setAnalysisTarget] = React.useState<CommittedConversation | null>(null)

  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  // 导入历史
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['conversation-import-history'],
    queryFn: async () => {
      const r = await getConversationImportHistory()
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    enabled: allow,
  })
  const history = historyData?.list ?? []

  // 解析(multipart 上传,api 转发 ai-service 后原样透传)
  const parseMut = useMutation({
    mutationFn: () => parseConversationImport(file!, source as ConversationImportSource),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(t('parseFailed', { error: res.error }))
        return
      }
      setPreview(res.data)
      // 默认全选
      setSelected(new Set(res.data.conversations.map((_, i) => i)))
      toast.success(t('parseSuccess', { count: res.data.conversations.length }))
    },
    onError: (e: Error) => toast.error(t('parseFailed', { error: e.message })),
  })

  // 逐会话串行 commit:单个失败不中断,完成后失效会话列表(侧栏立即可见)
  const commitMut = useMutation({
    mutationFn: async () => {
      const convs = (preview?.conversations ?? []).filter((_, i) => selected.has(i))
      let done = 0
      let imported = 0
      let failed = 0
      // 成功落库的会话清单(D28 补齐层:结果区的「打开会话」/「用场景分析」入口载荷)
      const committedList: CommittedConversation[] = []
      // 失败原因不吞:单条失败只计数不中断其余,但原因要带回 UI 展示,
      // 否则用户只看到一个 failed 数字,无法判断是自己的文件问题还是服务端故障
      const failureReasons: string[] = []
      setProgress({ done: 0, total: convs.length })
      for (const conv of convs) {
        // api 校验 content 非空:过滤空消息,过滤后无消息的会话直接记失败
        const messages = conv.messages
          .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }))
        if (messages.length === 0) {
          failed += 1
          failureReasons.push(t('noValidContent'))
          done += 1
          setProgress({ done, total: convs.length })
          continue
        }
        const payload: ConversationImportCommitPayload = {
          source: source as ConversationImportSource,
          fileName: file?.name || undefined,
          title: conv.title?.trim() ? conv.title.trim().slice(0, 255) : undefined,
          // 不透传 conv.model:该列会直接进 LLM 网关(chat.ts 的 conversation.model),
          // 外部工具模型 id 未必在用户目录内,写入会让导入会话首次续聊报错。留待 /parse
          // 响应透出的 model 仅作展示用途(类型已在 @ihui/api-client 定义)。
          createdAt: conv.sourceCreatedAt ?? conv.sourceUpdatedAt ?? undefined,
          messages,
        }
        try {
          const r = await commitConversationImport(payload)
          if (r.success) {
            imported += 1
            committedList.push({
              conversationId: r.data.conversationId,
              title: payload.title ?? t('conversationUntitled'),
              messageCount: messages.length,
              source: source as ConversationImportSource,
            })
          } else {
            failed += 1
            failureReasons.push(r.error)
          }
        } catch (e) {
          failed += 1
          failureReasons.push(e instanceof Error ? e.message : String(e))
        }
        done += 1
        setProgress({ done, total: convs.length })
      }
      return { imported, failed, committedList, failureReasons }
    },
    onSuccess: (res) => {
      if (res.failed > 0) {
        // 部分/全部失败:走 error 通道,逐条列出原因(去重后最多 3 条,避免刷屏)
        const unique = [...new Set(res.failureReasons)].slice(0, 3)
        toast.error(t('commitFailed', { error: unique.join('; ') }))
        if (res.imported > 0) {
          toast.success(t('commitDone', { imported: res.imported, failed: res.failed }))
        }
      } else {
        toast.success(t('commitDone', { imported: res.imported, failed: res.failed }))
      }
      setPreview(null)
      setFile(null)
      setSelected(new Set())
      // D28 补齐层(2026-10-03):结果区取代"导入完立刻自动跳转"。
      // 原行为是 commit 完直接 router.push('/') 把用户丢到首个会话 —— 但导入一批
      // 群聊记录后用户的第一诉求是"看看导进来什么、然后分析",自动跳走等于把
      // 结果区和分析入口一起藏起来(用户连导了几条都不知道)。现在停在设置页,
      // 由结果区给出「打开会话」/「用场景分析」两个明确出口。
      setCommitted(res.committedList)
      // source 不清空:用户看完结果区若想再导一份同来源的文件,不必从头再选一次来源。
      // (分析弹窗的 source 取结果区条目自带的 source,不依赖这里的状态。)
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation-import-history'] })
    },
    onError: (e: Error) => toast.error(t('commitFailed', { error: e.message })),
  })

  /**
   * 导入成功后跳到该会话。
   *
   * 与 conversation-list.tsx 的历史项点击同款三步:写 store 当前会话 → 打开
   * AI docked 面板 → 回 `/`(首页右侧面板即对话入口)。setConversationId 先行,
   * ai-side-panel 的 effect 下一帧才拉历史,顺序反了会先用旧 id 触发一次请求。
   */
  function jumpToConversation(conversationId: string) {
    useChatStore.getState().setConversationId(conversationId)
    useAiPanelStore.getState().openPanel()
    router.push('/')
  }

  function handleFileChange(f: File | null) {
    if (f && f.size > MAX_FILE_SIZE) {
      toast.error(t('fileTooLarge'))
      return
    }
    setFile(f)
    setPreview(null)
  }

  function onParse() {
    if (!source) return toast.error(t('errorNoSource'))
    if (!file) return toast.error(t('errorNoFile'))
    parseMut.mutate()
  }

  function toggleSelected(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (!preview) return
    if (selected.size === preview.conversations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.conversations.map((_, i) => i)))
    }
  }

  const activeSource = IMPORT_SOURCES.find((s) => s.value === source)
  const hasConversations = (preview?.conversations.length ?? 0) > 0

  // 2026-09-30 登录态门:未登录时以登录引导替换整个导入面板
  if (!allow) {
    return (
      <div className="space-y-4">
        <AuthGatePrompt message="请先登录后使用会话导入" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert variant="info" title={t('tab')} description={t('desc')} />

      {/* Step 1: 选择来源 */}
      <Card>
        <CardContent className="space-y-3 p-3 min-[640px]:p-3">
          <p className="text-sm font-medium">{t('sourcesTitle')}</p>
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-5">
            {IMPORT_SOURCES.map((s) => {
              const active = source === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  data-testid="import-source-card"
                  data-source={s.value}
                  onClick={() => setSource(s.value)}
                  className={`flex flex-col items-start gap-1 rounded-sm border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-brand-accent-deep bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <span className="flex w-full items-center gap-2 text-xs font-medium">
                    <span className="flex-1 truncate">{t(s.labelKey)}</span>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </span>
                  <span className="line-clamp-2 text-[10px] leading-tight">{t(s.hintKey)}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 上传会话导出文件 */}
      {source && (
        <Card>
          <CardContent className="space-y-3 p-3 min-[640px]:p-3">
            <p className="text-sm font-medium">{t('upload')}</p>
            <p className="text-xs text-muted-foreground">{t('uploadHint')}</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-3 text-center transition-colors hover:bg-accent">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('dragDrop')}</span>
              <input
                type="file"
                className="hidden"
                data-testid="import-file-input"
                accept={activeSource?.accept}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <p className="text-xs text-muted-foreground">
                {t('fileSelected', { name: file.name, size: formatSize(file.size) })}
              </p>
            )}
            <Button size="sm" onClick={onParse} disabled={!file || parseMut.isPending}>
              {parseMut.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              <span>{parseMut.isPending ? t('parsing') : t('parse')}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 解析预览 + 逐会话导入 */}
      {preview && (
        <Card>
          <CardContent className="space-y-3 p-3 min-[640px]:p-3">
            {!hasConversations ? (
              <p className="text-xs text-muted-foreground">{t('parseEmpty')}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('previewTitle')}</p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selected.size === preview.conversations.length
                      ? t('deselectAll')
                      : t('selectAll')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('selected', { count: selected.size, total: preview.conversations.length })}
                </p>

                {preview.truncated && (
                  <div className="flex items-start gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{t('truncatedWarning')}</span>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{w}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-2" data-testid="import-preview-list">
                  {preview.conversations.map((c, i) => {
                    const checked = selected.has(i)
                    // D28 补齐层:微信来源在预览期就把"这是群聊记录、谁在说、跨了多久"说清。
                    // 解析器(wechat.py,已定稿不改)把发言人写进正文 `昵称：正文` 前缀、
                    // 时间归一到 UTC+8 的 ISO 串,所以这里纯前端从 /parse 结果现算即可 ——
                    // 用户在点"导入所选"之前就该知道自己导进来的是什么。
                    const wechatInfo = source === 'wechat' ? summarizeWechatPreview(c) : null
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                          checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <input
                          id={`import-conv-${i}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(i)}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`import-conv-${i}`}
                          className="min-w-0 flex-1 cursor-pointer space-y-0.5"
                        >
                          <span className="block truncate font-medium">
                            {c.title?.trim() || t('conversationUntitled')}
                          </span>
                          <span className="block text-muted-foreground">
                            {t('messagesCount', { count: c.messages.length })}
                          </span>
                          {wechatInfo && (
                            <span
                              className="block text-[11px] text-muted-foreground"
                              data-testid="import-preview-wechat-info"
                            >
                              {t('previewSpeakers', {
                                count: wechatInfo.speakerCount,
                                names: formatSpeakerList(wechatInfo.speakers),
                              })}
                              {wechatInfo.range && (
                                <span> · {wechatInfo.range}</span>
                              )}
                            </span>
                          )}
                        </label>
                      </div>
                    )
                  })}
                </div>

                <Button
                  size="sm"
                  data-testid="import-commit-btn"
                  onClick={() => commitMut.mutate()}
                  disabled={selected.size === 0 || commitMut.isPending}
                >
                  {commitMut.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  <span>
                    {commitMut.isPending
                      ? t('committing', { done: progress.done, total: progress.total })
                      : t('commit')}
                  </span>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* D28 补齐层:导入结果区(取代"导入完立刻跳走")。
          每个成功落库的会话给两个出口:打开会话看原始记录 / 直接用场景分析。
          这是"导入 → 拿来分析"这一层在设置页的落点。 */}
      {committed.length > 0 && (
        <Card data-testid="import-result-card">
          <CardContent className="space-y-3 p-3 min-[640px]:p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              {t('resultTitle', { count: committed.length })}
            </p>
            <div className="space-y-2" data-testid="import-result-list">
              {committed.map((c) => (
                <div
                  key={c.conversationId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-muted-foreground">
                      {t('messagesCount', { count: c.messageCount })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="import-result-open"
                      onClick={() => jumpToConversation(c.conversationId)}
                    >
                      {t('resultOpen')}
                    </Button>
                    <Button
                      size="sm"
                      data-testid="import-result-analyze"
                      onClick={() => {
                        // 先跳到该会话(打开 AI 面板),再开分析弹窗 —— 弹窗里的"发起"
                        // 是往**当前会话**追加一条用户消息,会话不对就发错地方了
                        jumpToConversation(c.conversationId)
                        setAnalysisTarget(c)
                      }}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      <span>{t('analysisOpen')}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCommitted([])}>
              {t('resultDismiss')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: 导入历史 */}
      <Card>
        <CardContent className="space-y-3 p-3 min-[640px]:p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" />
            {t('historyTitle')}
          </p>
          {historyLoading ? (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {t('parsing')}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div className="space-y-2" data-testid="import-history-list">
              {history.map((h) => {
                const statusKey = HISTORY_STATUS_KEY[h.status]
                // D28 补齐层:历史行补来源标签(此前只有文件名与状态,五条来源在列表里
                // 长得一模一样)与"打开会话"入口(有 conversationId 才给按钮,失败批次
                // 的 conversationId 是 null,给个点不动的按钮比不给更糟)。
                const sourceLabelKey = HISTORY_SOURCE_LABEL_KEY[h.source]
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{h.fileName || '—'}</span>
                        {sourceLabelKey && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t(sourceLabelKey)}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            h.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : h.status === 'failed'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {statusKey ? t(statusKey) : h.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {t('historyParsed')}: {h.parsedCount} · {t('historyImported')}:{' '}
                        {h.importedCount} · {t('historyFailed')}: {h.failedCount}
                        {h.errorMessage ? ` · ${h.errorMessage}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {h.conversationId && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="import-history-open"
                          onClick={() => jumpToConversation(h.conversationId)}
                        >
                          {t('resultOpen')}
                        </Button>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(h.importedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 「用场景分析」弹窗:按需挂载(analysisTarget 为 null 时整块不渲染),场景目录 chunk
          由 next/dynamic 在首次打开时才拉。关闭时清 target —— 留着一个已关闭的目标会让
          下次开弹窗显示上一个会话的标题。
          source 取**该条目落库时那一份**(见 CommittedConversation.source 注),不读当前
          来源选择状态。 */}
      {analysisTarget && (
        <ImportAnalysisDialogLazy
          open
          onOpenChange={(next) => {
            if (!next) setAnalysisTarget(null)
          }}
          source={analysisTarget.source}
        />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
