// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { MessageCompaction } from '@/stores/chat'

interface CompressionDividerProps {
  /** 消息级压缩统计(chat store setMessageCompaction 写入)。 */
  compaction: MessageCompaction
  className?: string
  'data-testid'?: string
}

/**
 * CompressionDivider — 消息级「上方历史已被压缩」分隔线(2026-09-19 立,孤儿组件接线)。
 *
 * 链路:后端 AgentLoopV2 触发上下文压缩 → 网关 compaction 命名帧 →
 * api-client onCompaction 回调 → send-message 映射为 MessageCompaction →
 * chat store setMessageCompaction(messageId, compaction) →
 * MessageItem 在消息内容区顶部(ThinkingSection 之前)渲染本组件。
 *
 * 展示策略:单行低调分隔线(标题 + 节省比例),完整 token 前后对比挂在
 * title/aria-label 上供读屏与悬停查看,不额外占据视觉空间。
 *
 * memo:compaction 对象引用稳定时跳过重渲染。
 */
export const CompressionDivider = React.memo(function CompressionDivider({
  compaction,
  className,
  'data-testid': testId,
}: CompressionDividerProps) {
  const t = useTranslations('chat')

  // G-150(WorkBuddy 一手对标):压不动了必须换口径 —— 这里给一条低调分隔线是错的,
  // 用户需要知道"已到上限"并拿到下一步(开新对话 / 减少上下文),而不是只看到"曾压缩过"。
  if (compaction.trigger === 'incompressible') {
    return (
      <div
        role="status"
        data-testid={testId ?? 'compaction-ceiling'}
        className={cn(
          'my-1 flex flex-col gap-0.5 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive',
          className,
        )}
      >
        <span className="font-medium">{t('compaction.ceilingTitle')}</span>
        <span>{t('compaction.ceilingHint')}</span>
      </div>
    )
  }

  // 仅当压缩确实减少了 token 时才计算节省比例(压缩后须严格小于压缩前)
  const savedRatio =
    compaction.originalTokens > 0 && compaction.compressedTokens < compaction.originalTokens
      ? Math.round((1 - compaction.compressedTokens / compaction.originalTokens) * 100)
      : 0

  // 完整描述(token 前后对比),挂在 aria-label 供读屏;原生 title 被守门 [18] 禁用
  const description = t('compaction.dividerDescription', {
    before: compaction.originalTokens,
    after: compaction.compressedTokens,
  })

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground/50',
        className,
      )}
      data-testid={testId ?? 'compression-divider'}
      role="separator"
      aria-label={description}
    >
      <span className="h-px flex-1 bg-border/50" aria-hidden />
      <span className="shrink-0 font-medium">{t('compaction.dividerTitle')}</span>
      {savedRatio > 0 ? (
        <span className="shrink-0 text-muted-foreground/40">
          {t('compaction.dividerSaved', { ratio: savedRatio })}
        </span>
      ) : null}
      <span className="h-px flex-1 bg-border/50" aria-hidden />
    </div>
  )
})

export default CompressionDivider
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
