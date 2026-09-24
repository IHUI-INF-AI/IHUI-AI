// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, X } from 'lucide-react'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useConversationDetailModeStore } from '@/stores/conversation-detail-mode'
import {
  resolveToolCategory,
  type CategoryKey,
} from '@/components/ai/progress-sections/tool-category'

/**
 * D45 ambient suggestions 环境建议条(2026-09-24 立,G-54)。
 *
 * 按当前会话上下文纯客户端派生 2-4 条 next-action 建议(零后端),
 * 三态:采纳(draftInput 预填)/忽略(dismiss 单条)/可关(整体开关,持久化)。
 *
 * 形态约束:建议条置于消息列表尾部自有容器、常规文档流(非 absolute/fixed 悬浮),
 * 不遮挡、不渐变遮罩、不用原生 title(替代用 aria-label)。
 */

export type AmbientSuggestionKind =
  | 'resume-task'
  | 'review-files'
  | 'answer-question'
  | 'continue-topic'

export interface AmbientSuggestion {
  /** kind 即去重 id:同一建议全流至多一条 */
  id: AmbientSuggestionKind
  kind: AmbientSuggestionKind
}

/** 建议 kind → i18n 键(挂在 ambientSuggestions 命名空间下) */
const SUGGESTION_LABEL_KEYS: Record<AmbientSuggestionKind, string> = {
  'resume-task': 'suggestionResumeTask',
  'review-files': 'suggestionReviewFiles',
  'answer-question': 'suggestionAnswerQuestion',
  'continue-topic': 'suggestionContinueTopic',
}

/** 文件写入类类目(review-files 建议判据,与 detail-mode-filter 的 commands 档同源) */
const FILE_WRITE_CATEGORIES: readonly CategoryKey[] = [
  'file_write',
  'file_modify',
  'file_delete',
]

/** PlanStep 未完成状态(继续任务判据) */
const OPEN_STEP_STATUSES: readonly string[] = ['pending', 'in_progress', 'failed']

/**
 * 纯函数派生:按最后一条 assistant 消息的上下文产出 next-action 建议(≤4 条)。
 * 优先级:继续任务 > 查看改动 > 回答提问 > 继续追问(互斥项按条件裁剪)。
 */
export function deriveAmbientSuggestions(messages: readonly ChatMessage[]): AmbientSuggestion[] {
  const out: AmbientSuggestion[] = []
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant) return out
  const openStep = (lastAssistant.planSteps ?? []).some((s) =>
    OPEN_STEP_STATUSES.includes(s.status),
  )
  if (openStep) out.push({ id: 'resume-task', kind: 'resume-task' })
  const touchedFiles = (lastAssistant.toolCalls ?? []).some((tc) =>
    FILE_WRITE_CATEGORIES.includes(resolveToolCategory(tc.toolName)),
  )
  if (touchedFiles) out.push({ id: 'review-files', kind: 'review-files' })
  if (lastAssistant.question) {
    out.push({ id: 'answer-question', kind: 'answer-question' })
  } else if (lastAssistant.content.trim().length > 0) {
    out.push({ id: 'continue-topic', kind: 'continue-topic' })
  }
  return out.slice(0, 4)
}

interface AmbientSuggestionsProps {
  messages: readonly ChatMessage[]
}

export function AmbientSuggestions({ messages }: AmbientSuggestionsProps) {
  const t = useTranslations('ambientSuggestions')
  const enabled = useConversationDetailModeStore((s) => s.suggestionsEnabled)
  const setEnabled = useConversationDetailModeStore((s) => s.setSuggestionsEnabled)
  /** 忽略/采纳过的建议本会话内不再出现(会话级,不持久化) */
  const [dismissed, setDismissed] = React.useState<ReadonlySet<string>>(() => new Set())

  const suggestions = React.useMemo(() => deriveAmbientSuggestions(messages), [messages])

  if (!enabled) {
    return (
      <div className="flex justify-center py-1" data-testid="ambient-suggestions-restore-wrap">
        <button
          type="button"
          data-testid="ambient-suggestions-restore"
          onClick={() => setEnabled(true)}
          className="rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('restore')}
        </button>
      </div>
    )
  }

  const visible = suggestions.filter((s) => !dismissed.has(s.id))
  if (visible.length === 0) return null

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }
  const adopt = (s: AmbientSuggestion) => {
    // 采纳 = 把建议文本填入输入框(draftInput 由 MessageInput 消费后置 null)
    useChatStore.setState({ draftInput: t(SUGGESTION_LABEL_KEYS[s.kind]) })
    dismiss(s.id)
  }

  return (
    <div
      data-testid="ambient-suggestions"
      className="mx-auto flex flex-wrap items-center gap-1.5 py-2"
    >
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        {t('title')}
      </span>
      {visible.map((s) => (
        <span
          key={s.id}
          data-testid={`ambient-suggestion-${s.id}`}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
        >
          <button
            type="button"
            data-testid={`ambient-suggestion-adopt-${s.id}`}
            onClick={() => adopt(s)}
            className="max-w-64 truncate text-left text-foreground/80 transition-colors hover:text-foreground"
          >
            {t(SUGGESTION_LABEL_KEYS[s.kind])}
          </button>
          <button
            type="button"
            data-testid={`ambient-suggestion-dismiss-${s.id}`}
            aria-label={t('dismiss')}
            onClick={() => dismiss(s.id)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <button
        type="button"
        data-testid="ambient-suggestions-close"
        aria-label={t('close')}
        onClick={() => setEnabled(false)}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  )
}

export default AmbientSuggestions
