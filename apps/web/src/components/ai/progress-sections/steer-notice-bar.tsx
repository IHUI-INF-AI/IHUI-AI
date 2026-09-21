// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FoldableSection } from './foldable-section'
import type { SteerNotice } from '@/stores/chat'

interface SteerNoticeBarProps {
  /** 本轮流式期间用户注入的中途引导记录(SSE steer 事件回执,tool loop 边界已生效)。 */
  notices: SteerNotice[]
}

/** 单条引导文本的展示截断长度(原文 ≤4000 字符已入 LLM 上下文,徽章侧只做预览) */
const STEER_NOTICE_PREVIEW_LIMIT = 120

/**
 * SteerNoticeBar — 消息级「已引导」提示条(Steer 中途引导可视化,2026-09-19 立)
 *
 * 链路:闪电按钮 → 网关 POST /chat/steer → ai-service 入队(tool loop 边界注入)→
 * SSE steer 事件(phase='injected')回执 → api-client onSteer →
 * send-message appendSteerNotice(messageId, notice) → chat store steerNoticesByMessageId
 * → MessageItem 按 message.id 查 store 渲染本组件。
 *
 * 展示策略(与 MemoryNoticeBar 同款 FoldableSection 形态):
 *  - 折叠头显示「已引导 N 次」计数 + Zap 图标
 *  - 展开显示每条引导文本预览(超长截断),让用户事后可回看本轮引导过什么
 *
 * memo:notices 引用稳定时跳过重渲染(appendSteerNotice 均为新数组)。
 */
export const SteerNoticeBar = React.memo(function SteerNoticeBar({ notices }: SteerNoticeBarProps) {
  const t = useTranslations('chat')
  if (notices.length === 0) return null

  return (
    <FoldableSection
      title={t('steerNoticeBar.title', { count: notices.length })}
      icon={Zap}
      count={notices.length}
      data-testid="steer-notice-bar"
    >
      <div className="flex flex-col gap-0.5 py-0.5">
        {notices.slice(0, 3).map((n, i) => (
          <span
            key={i}
            className="text-[11px] leading-relaxed text-muted-foreground"
            data-testid={`steer-notice-item-${i}`}
          >
            {n.text.length > STEER_NOTICE_PREVIEW_LIMIT
              ? `${n.text.slice(0, STEER_NOTICE_PREVIEW_LIMIT)}…`
              : n.text}
          </span>
        ))}
        {notices.length > 3 && (
          <span className="text-[10px] text-muted-foreground/70" data-testid="steer-notice-more">
            {t('steerNoticeBar.moreItems', { count: notices.length - 3 })}
          </span>
        )}
      </div>
    </FoldableSection>
  )
})

export default SteerNoticeBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
