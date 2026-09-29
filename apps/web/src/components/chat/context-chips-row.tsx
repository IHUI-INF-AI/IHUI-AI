// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 统一上下文容器(2026-09-30 立,深度对标二轮;对标 Trae .chat-attachments-container)。
//
// 输入框上方原本散落 6 个各自带 mb-2 的动态块(引用卡 / 已选工具卡 / 引用回复条 /
// 提及 chips / 粘贴预览条 / 输入队列),间距各写各的、视觉上堆叠无序。本容器把它们
// 收进**一个**分组:
//  - 纵向间距统一由容器 gap-1.5 接管,与 textarea 的间距由容器一处 mb-2 接管;
//  - 重卡片(引用面板 / 已选工具)保持卡片形态不拆,只统一间距(混合形态);
//  - 状态类通知(断连 / 告警 / 额度 / MCP / 润色 / diff 意见)不进容器 —— 它们走
//    InputStatusSlot 单状态槽,"上下文附件"与"运行状态"两种语义分离;
//  - 全部子件为空时容器整体不渲染,零占位契约不变。
// 所有原 testid 逐字保留:quoted-reply-chip / quoted-reply-clear / mention-chip-row /
// mention-chip-* / unified-paste-reference-preview / input-queue / input-queue-item-N /
// input-queue-remove-N,引用卡与工具卡内部自带的 testid 亦原样不动。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, X } from 'lucide-react'

import type { ReferenceItem } from '@/hooks/use-message-references'
import type { MentionSelection } from '@ihui/shared/chat/mention-engine'

import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { SelectedToolsPanel, type SelectedToolItem } from './selected-tools-panel'
import { MentionChips } from './mention-popover'
import { UnifiedPasteReferencePreview } from './unified-suggestion-panel'
import type { PastedReferencePreview } from './unified-suggestion-sources'

export interface ContextChipsRowProps {
  /** 附件引用(文件 / 链接 / 粘贴文本 / 图片 / 视频 + agent 参考块) */
  references: ReferenceItem[]
  onRemoveReference: (id: string) => void
  /** b75-5#1:失败附件重试(走同一上传端点) */
  onRetryReference?: (id: string) => void
  /** 已选 MCP 工具 chips */
  tools: SelectedToolItem[]
  onRemoveTool: (id: string) => void
  /** D22 引用回复快照;null 即无 */
  quoted: { id: string; role: 'user' | 'assistant' | 'system'; content: string } | null
  onClearQuoted: () => void
  /**
   * 提及 chips 是否非空(显示性元数据):MentionChips 自己订阅 context-mention
   * store 渲染,容器不复制那份数组,只用这个布尔参与「全空不渲染」判定。
   */
  hasMentions: boolean
  onRemoveMention: (selection: MentionSelection) => void
  /** D68 粘贴引用有效性预览(空数组不渲染) */
  pastePreviews: PastedReferencePreview[]
  onDismissPastePreviews: () => void
  /** W27 输入队列(流式期间排队的待发消息) */
  queueItems: readonly { text: string }[]
  onQueueRemove: (index: number) => void
}

export function ContextChipsRow({
  references,
  onRemoveReference,
  onRetryReference,
  tools,
  onRemoveTool,
  quoted,
  onClearQuoted,
  hasMentions,
  onRemoveMention,
  pastePreviews,
  onDismissPastePreviews,
  queueItems,
  onQueueRemove,
}: ContextChipsRowProps) {
  const t = useTranslations('chat')

  const hasContent =
    references.length > 0 ||
    tools.length > 0 ||
    quoted !== null ||
    hasMentions ||
    pastePreviews.length > 0 ||
    queueItems.length > 0
  if (!hasContent) return null

  return (
    <div data-testid="context-chips-row" className="mb-2 flex flex-col gap-1.5">
      {/* 附件引用卡(重形态保留,间距由容器接管) */}
      {references.length > 0 && (
        <ContextReferencePanel
          references={references}
          onRemove={onRemoveReference}
          onRetry={onRetryReference}
        />
      )}
      {/* 已选工具卡(重形态保留) */}
      {tools.length > 0 && <SelectedToolsPanel tools={tools} onRemove={onRemoveTool} />}
      {/* D22 引用回复条(testid 逐字保留) */}
      {quoted && (
        <div
          data-testid="quoted-reply-chip"
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">
              {quoted.role === 'user' ? t('quotedReplyUser') : t('quotedReplyAssistant')}
            </p>
            <p className="truncate text-xs text-muted-foreground">{quoted.content}</p>
          </div>
          <button
            type="button"
            onClick={onClearQuoted}
            data-testid="quoted-reply-clear"
            aria-label={t('cancel')}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      {/* 多维提及 chips(V3 第 61 票收口):`@` / `#` 共用这一面,摘 chip 同步删正文 */}
      <MentionChips onRemove={onRemoveMention} />
      {/* D68 粘贴引用有效性预览条(空集自渲染 null) */}
      <UnifiedPasteReferencePreview previews={pastePreviews} onDismiss={onDismissPastePreviews} />
      {/* W27 输入队列(虚线琥珀样式保留) */}
      {queueItems.length > 0 && (
        <div data-testid="input-queue" className="space-y-1">
          {queueItems.map((pm, i) => (
            <div
              key={i}
              data-testid={`input-queue-item-${i}`}
              className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate text-amber-700 dark:text-amber-300">{pm.text}</span>
              <button
                type="button"
                data-testid={`input-queue-remove-${i}`}
                onClick={() => onQueueRemove(i)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('cancel')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
