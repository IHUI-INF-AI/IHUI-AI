// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Brain, Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FoldableSection } from './foldable-section'

interface MemoryNoticeBarProps {
  /** 本轮 done 事件回传的新增长期记忆条目摘要(llm.py 同步提炼)。 */
  items: string[]
}

/**
 * MemoryNoticeBar — 消息级「已记住」提示条(P1 #27 记忆更新可视化,2026-09-16 立)
 *
 * 链路:llm.py 在 done 事件前同步提炼本轮长期记忆(写入 semantic 层),
 * 条目经 done.memoryUpdates 回传 → api-client tryParseMemoryUpdates →
 * send-message onMemoryUpdates → chat store appendMemoryNotice(messageId, items)
 * → MessageItem 按 message.id 查 store 渲染本组件。
 *
 * 展示策略(每轮限 1 条摘要):
 *  - 折叠头显示「已记住 N 条」计数(与 CitationBar 同款 FoldableSection 形态)
 *  - 展开显示首条摘要全文(超长截断),其余以「等 N 条」收尾,避免提示条占据过多视觉空间
 *  - 头部右侧「管理」入口直达 /memory-manager(长期记忆管理页)
 *
 * memo:items 引用稳定时跳过重渲染。
 */
export const MemoryNoticeBar = React.memo(function MemoryNoticeBar({
  items,
}: MemoryNoticeBarProps) {
  const t = useTranslations('ai.pane')
  if (items.length === 0) return null

  // 每轮限 1 条摘要展示(产品要求:提示条只占一行,不堆叠刷屏)
  const first = items[0] ?? ''
  const moreCount = items.length - 1

  return (
    <FoldableSection
      title={t('memoryNoticeBar.title', { count: items.length })}
      icon={Brain}
      count={items.length}
      data-testid="memory-notice-bar"
      headerExtra={
        <Link
          href="/memory-manager"
          className="inline-flex items-center gap-1 rounded-sm px-1 py-px text-[10px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          data-testid="memory-notice-manage"
        >
          <Settings2 className="h-2.5 w-2.5 shrink-0" />
          <span>{t('memoryNoticeBar.manage')}</span>
        </Link>
      }
    >
      <div className="flex flex-col gap-0.5 py-0.5">
        <span
          className="text-[11px] leading-relaxed text-muted-foreground"
          data-testid="memory-notice-item-0"
        >
          {first}
        </span>
        {moreCount > 0 && (
          <span className="text-[10px] text-muted-foreground/70" data-testid="memory-notice-more">
            {t('memoryNoticeBar.moreItems', { count: moreCount })}
          </span>
        )}
      </div>
    </FoldableSection>
  )
})

export default MemoryNoticeBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
