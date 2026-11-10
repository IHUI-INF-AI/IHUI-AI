// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入(D28)—— 小程序端判序核心。
 *
 * 本文件只放**可独立验证的判序**,不碰 Taro 组件与页面状态:
 *   ① 来源目录 + 后缀白名单(与 web 端 accept / RN 端 ALLOWED_EXTENSIONS 同口径);
 *   ② /parse 响应归一化(裸 JSON → 预览行,缺字段一律兜底而非抛错);
 *   ③ 逐会话 commit 编排(串行、失败不中断、进度逐条回吐、失败原因去重带回)。
 * 传输(Taro.uploadFile / chooseMessageFile)与文案取词都在页面侧,便于把平台依赖
 * 与判序分开测(夹具 mock 只切断平台依赖,不改变被测判序本身)。
 */
import type {
  ConversationImportCommitPayload,
  ConversationImportSource,
  ParsedImportConversation,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

/** 客户端预校验上限:与 api 侧 PARSE_UPLOAD_MAX_BYTES / ai-service 上传上限同值(20MiB) */
export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024

/** 来源目录:label/hint 走 i18n,extensions 是**客户端预校验**用的后缀白名单 */
export interface ImportSourceSpec {
  value: ConversationImportSource
  labelKey: string
  hintKey: string
  extensions: readonly string[]
}

export const IMPORT_SOURCES: readonly ImportSourceSpec[] = [
  {
    value: 'claude_code',
    labelKey: 'conversationImport.sourceClaudeCode',
    hintKey: 'conversationImport.sourceClaudeCodeHint',
    extensions: ['.jsonl', '.json'],
  },
  {
    value: 'codex',
    labelKey: 'conversationImport.sourceCodex',
    hintKey: 'conversationImport.sourceCodexHint',
    extensions: ['.jsonl', '.json'],
  },
  {
    value: 'cursor',
    labelKey: 'conversationImport.sourceCursor',
    hintKey: 'conversationImport.sourceCursorHint',
    extensions: ['.json', '.jsonl', '.vscdb', '.db', '.sqlite'],
  },
  {
    value: 'aider',
    labelKey: 'conversationImport.sourceAider',
    hintKey: 'conversationImport.sourceAiderHint',
    extensions: ['.md', '.json', '.jsonl'],
  },
  {
    // 微信导出物是归档包/纯文本,与其余四源的 jsonl/sqlite 家族完全不同(与 web/RN 同口径)
    value: 'wechat',
    labelKey: 'conversationImport.sourceWechat',
    hintKey: 'conversationImport.sourceWechatHint',
    extensions: ['.zip', '.txt'],
  },
]

/** 字符串 → 后端来源枚举(穷举收窄,无 cast / 无 any);未知值一律 undefined */
export function toImportSource(value: string): ConversationImportSource | undefined {
  switch (value) {
    case 'claude_code':
    case 'codex':
    case 'cursor':
    case 'aider':
    case 'wechat':
      return value
    default:
      return undefined
  }
}

export function findImportSource(value: string): ImportSourceSpec | undefined {
  return IMPORT_SOURCES.find((s) => s.value === value)
}

/**
 * 后缀白名单校验 —— 缺文件名一律判否。
 *
 * 为什么要卡:服务端按**文件名后缀**分派解析器,选到必被 400 的文件时,
 * 在这里给可读错误远好过把请求打出去换回一个后端错误。
 */
export function hasAllowedExtension(name: string | undefined, source: ConversationImportSource): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return (findImportSource(source)?.extensions ?? []).some((ext) => lower.endsWith(ext))
}

/** ISO 时间 → YYYY-MM-DD(不可解析时退化为原串前 10 位,避免抛 Invalid Date) */
export function toDateLabel(value?: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10)
}

/** 预览行:id 即 /parse 响应数组下标,提交时按它取回原始会话 */
export interface ImportPreviewRow {
  id: number
  title: string
  messageCount: number
  model: string
  createdAt: string
}

/**
 * /parse 裸 JSON → 预览行。
 *
 * 字段一律兜底而非抛错(ai-service 对不同来源吐出的键并不齐):
 * title 缺省空串、messages 非数组当 0 条 —— 页面拿 messageCount===0 的行
 * 交给 commit 侧判失败,而不是在这里崩掉整次解析。
 */
export function toPreviewRows(conversations: readonly ParsedImportConversation[]): ImportPreviewRow[] {
  return conversations.map((conv, index) => ({
    id: index,
    title: conv?.title?.trim() ?? '',
    messageCount: Array.isArray(conv?.messages) ? conv.messages.length : 0,
    model: conv?.model?.trim() ?? '',
    createdAt: toDateLabel(conv?.sourceCreatedAt ?? conv?.sourceUpdatedAt),
  }))
}

/** 从 /parse 裸 JSON 里抽出预览 + 截断 + 警告(结构不对时按空数组兜底,不编造会话) */
export function normalizeParseResult(raw: unknown): {
  conversations: ParsedImportConversation[]
  rows: ImportPreviewRow[]
  truncated: boolean
  warnings: string[]
} {
  const body = (raw ?? {}) as {
    conversations?: unknown
    truncated?: unknown
    warnings?: unknown
  }
  const conversations = Array.isArray(body.conversations)
    ? (body.conversations as ParsedImportConversation[])
    : []
  return {
    conversations,
    rows: toPreviewRows(conversations),
    truncated: body.truncated === true,
    warnings: Array.isArray(body.warnings) ? body.warnings.map((w) => String(w)) : [],
  }
}

/**
 * 单个会话 → commit 请求体;无有效消息返回 null。
 *
 * api 侧 zod 要求 messages 非空且每条 content 非空串,故空会话**不发请求**
 * (直接计失败)。不透传 conv.model:该列会直接进 LLM 网关,外部工具模型 id
 * 未必在用户目录内,写入会让导入会话首次续聊报错(与 web/RN 同口径)。
 */
export function buildCommitPayload(
  conv: ParsedImportConversation | undefined,
  args: { source: ConversationImportSource; fileName?: string },
): ConversationImportCommitPayload | null {
  const messages = (conv?.messages ?? [])
    .filter((m) => typeof m?.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }))
  if (messages.length === 0) return null
  const title = conv?.title?.trim()
  return {
    source: args.source,
    fileName: args.fileName,
    title: title ? title.slice(0, 255) : undefined,
    createdAt: conv?.sourceCreatedAt ?? conv?.sourceUpdatedAt ?? undefined,
    messages,
  }
}

/**
 * D28 补齐层(2026-10-03):一条成功落库的会话 —— 结果区两个出口的载荷。
 *
 * `source` 取**本次提交实际用的那一份**:用户导完可能顺手点了别的来源卡,
 * 若分析弹窗去读页面当前 source,一个微信导入的会话会拿到 codex 的推荐场景 ——
 * 恰好毁掉"wechat 默认推荐聊天记录类"这条判据(web / RN 端同款注)。
 */
export interface CommittedImportConversation {
  readonly conversationId: string
  readonly title: string
  readonly messageCount: number
  readonly source: ConversationImportSource
}

/** commit 编排结果:失败原因**原样带回**(去重),让页面能诚实交代而不是只报一个数字 */
export interface ImportCommitOutcome {
  imported: number
  failed: number
  failureReasons: string[]
  /** 成功落库的会话清单(结果区「打开会话」/「用场景分析」两个出口的载荷) */
  committed: CommittedImportConversation[]
}

export const COMMIT_FAILURE_REASON_LIMIT = 3

/** commit 单条结果 → 是否成功(不抛 ∧ success===true);失败时给出可展示原因 */
function judgeCommit(res: ApiResult<unknown> | unknown, isError: unknown): { ok: boolean; reason: string } {
  if (isError) return { ok: false, reason: isError instanceof Error ? isError.message : String(isError) }
  const r = res as { success?: boolean; error?: string; errorCode?: string; status?: number }
  if (r?.success === true) return { ok: true, reason: '' }
  return { ok: false, reason: r?.error || `HTTP ${r?.status ?? '?'}` }
}

/**
 * commit 成功响应里取回会话主键。
 *
 * 逐条守卫而非 cast:commit 的响应体在 api-client 里是 `ConversationImportCommitResult`,
 * 但本页面的 `commit` 注入签名被宽化成 `ApiResult<unknown>`(为了让判序层不依赖具体端点),
 * 于是这里必须自己收窄。读不到就返回 null —— 结果区那一条就没有"打开会话"出口,
 * **不造一个点不动的按钮**,也不拿行号/下标冒充会话 id。
 */
function readCommittedId(res: ApiResult<unknown> | unknown): string | null {
  if (!res || typeof res !== 'object') return null
  const r = res as { success?: boolean; data?: unknown }
  if (r.success !== true || !r.data || typeof r.data !== 'object') return null
  const data = r.data as { conversationId?: unknown }
  return typeof data.conversationId === 'string' && data.conversationId !== ''
    ? data.conversationId
    : null
}

/**
 * 逐会话串行 commit:单条失败只计数,**不中断其余导入**;进度逐条回吐。
 *
 * 与 web 端同一判序:失败计数 + 失败原因带出。用户只看到一个 failed 数字时
 * 无法判断是自己的文件问题还是服务端故障,所以原因必须回到界面上。
 */
export async function runImportCommit(deps: {
  source: ConversationImportSource
  fileName?: string
  conversations: readonly ParsedImportConversation[]
  rowIds: readonly number[]
  commit: (payload: ConversationImportCommitPayload) => Promise<ApiResult<unknown>>
  /** 无有效消息时的失败原因文案(页面取词后传入) */
  emptyContentReason: string
  onProgress?: (progress: { done: number; total: number }) => void
}): Promise<ImportCommitOutcome> {
  const total = deps.rowIds.length
  let done = 0
  let imported = 0
  let failed = 0
  const failureReasons: string[] = []
  // D28 补齐层:成功落库的会话清单。conversationId 读不出的条目**不进清单**
  // (见 readCommittedId),宁可少给一个出口,也不给一个指向不明会话的按钮。
  const committed: CommittedImportConversation[] = []
  deps.onProgress?.({ done, total })

  for (const id of deps.rowIds) {
    const conv = deps.conversations[id]
    const payload = buildCommitPayload(conv, { source: deps.source, fileName: deps.fileName })
    if (!payload) {
      failed += 1
      failureReasons.push(deps.emptyContentReason)
      done += 1
      deps.onProgress?.({ done, total })
      continue
    }
    try {
      const res = await deps.commit(payload)
      const outcome = judgeCommit(res, undefined)
      if (outcome.ok) {
        imported += 1
        const conversationId = readCommittedId(res)
        if (conversationId !== null) {
          committed.push({
            conversationId,
            title: payload.title ?? '',
            messageCount: payload.messages.length,
            source: deps.source,
          })
        }
      } else {
        failed += 1
        failureReasons.push(outcome.reason)
      }
    } catch (e) {
      failed += 1
      failureReasons.push(e instanceof Error ? e.message : String(e))
    }
    done += 1
    deps.onProgress?.({ done, total })
  }
  return { imported, failed, failureReasons, committed }
}

/** 失败原因去重并截断(避免一屏刷满同一条);真实总数仍在 failed 计数里 */
export function summarizeFailureReasons(
  reasons: readonly string[],
  limit: number = COMMIT_FAILURE_REASON_LIMIT,
): string[] {
  return [...new Set(reasons.filter((r) => r.length > 0))].slice(0, Math.max(1, limit))
}

/** 后端批次状态 → 端侧展示态(未知状态保留 'unknown',由页面显示原文而不是猜) */
export type ImportHistoryStatus = 'success' | 'partial' | 'failed' | 'unknown'

export function toHistoryStatus(status: string): ImportHistoryStatus {
  switch (status) {
    case 'success':
    case 'partial':
    case 'failed':
      return status
    default:
      return 'unknown'
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
