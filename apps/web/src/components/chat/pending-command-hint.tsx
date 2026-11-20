// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:消费 web 端 pending-send 账本(localStorage)。共享层只有账本本体,
// 小程序 / RN 没有这条存储适配,不在共享组件里再抄一份提示。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

import { FoldableSection } from '@/components/ai/progress-sections/foldable-section'
import { listPendingSends } from '@/hooks/use-chat/pending-send'
import type { PendingCommandRecord } from '@ihui/shared/chat/pending-command-registry'

export interface PendingCommandHintProps {
  conversationId: string | null
  /** 流式开关等会改账本的事实;变化时重读,不另开发送链。 */
  revision: boolean
  /** 输入框当前草稿。只在这份草稿可能与本条重复时才占位。 */
  draft: string
}

/** 草稿太短("继续""对")时不作判 —— 每个词都弹一次比不提醒更烦。 */
const MIN_DRAFT = 4

/**
 * 可见性判据(2026-11-20 二次收口):账本里**有**未确认条目 ≠ 该现在就占一行。
 * 只在"输入框里的草稿可能与本条重复"时才算需要提示 —— 平时(空着 / 在写别的事)
 * 整块零占位,真正要重复发送的那一刻才出现,与发送链拦你的那一刻同一时机。
 *
 * 账本只存 preview(前 80 字,原文不存):短指令两边等长,长指令时草稿更长 ⇒ 双向前缀判。
 */
export function matchPendingDraft(
  records: readonly PendingCommandRecord[],
  draft: string,
): PendingCommandRecord[] {
  const trimmed = draft.trim()
  if (trimmed.length < MIN_DRAFT) return []
  return records.filter((record) => {
    const preview = (record.preview ?? '').trim()
    if (!preview) return false
    return preview.startsWith(trimmed) || trimmed.startsWith(preview)
  })
}

/**
 * 待对账命令提示。只读 `listPendingSends`,不登记、不结算、不重发。
 * 重发仍走既有发送链里的人工放行(forcePending)。
 */
export function PendingCommandHint({ conversationId, revision, draft }: PendingCommandHintProps) {
  const t = useTranslations('chat')
  const [records, setRecords] = React.useState<PendingCommandRecord[]>([])

  React.useEffect(() => {
    setRecords(conversationId ? listPendingSends(conversationId) : [])
  }, [conversationId, revision])

  const visible = matchPendingDraft(records, draft)
  if (visible.length === 0) return null

  // 折叠成一行(2026-11-20 立):原形态是一块四行的灰卡,常驻在输入框上方,把输入区顶高
  // 一大截;而它要传达的核心只有"上一次那条还没确认"。改为与 AgentNoticeBar / SteerNoticeBar
  // 同族的 FoldableSection:折叠头一行给出标题 + 该条指令预览,展开才看说明与列表。
  // 不塞进消息流是有意的 —— 消息流是可落库、可重放的审计记录,这条是输入通道的临时状态,
  // 混进历史会污染重放(刷新后位置也无从还原);"发送前可见"仍在输入区原位保留。
  const title =
    visible.length > 1
      ? `${t('duplicatePendingTitle')} · ${visible.length}`
      : t('duplicatePendingTitle')

  return (
    <FoldableSection
      title={title}
      icon={AlertTriangle}
      summary={visible[0]?.preview}
      aria-label={t('duplicatePendingTitle')}
      data-testid="pending-command-hint"
    >
      <div className="space-y-1 pb-1">
        <p className="text-label leading-relaxed text-muted-foreground">
          {t('duplicatePendingDesc')}
        </p>
        <ul className="space-y-0.5">
          {visible.map((record) => (
            <li
              key={record.commandId}
              data-testid="pending-command-preview"
              className="truncate text-label text-foreground/80"
            >
              {record.preview}
            </li>
          ))}
        </ul>
      </div>
    </FoldableSection>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
