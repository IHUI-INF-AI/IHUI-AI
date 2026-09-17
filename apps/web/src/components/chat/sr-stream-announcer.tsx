// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useChatStore } from '@/stores/chat'
import {
  buildStreamAnnouncement,
  shouldAnnounceProgress,
  STREAM_ANNOUNCE_INTERVAL_MS,
} from '@/lib/stream-announcer'

/**
 * SrStreamAnnouncer — 流式播报区域(P3 #34,2026-09-16 立,对标 Codex 无障碍播报)。
 *
 * 挂载在 AI 面板根部,自身订阅 chat store:
 *  - 流式开始 → 播报「AI 开始回复」
 *  - 输出中   → 每 3s(仅字数有增长时)播报「已输出 N 字」(不播内容,内容由
 *    用户用阅读光标自行浏览;逐 token 播报会让屏幕阅读器不可用)
 *  - 流式结束 → 播报「回复完成,共 N 字」
 *
 * 渲染:visually-hidden(sr-only)+ aria-live="polite" + aria-atomic,
 * 文本变化时屏幕阅读器在空闲时插播,不打断用户当前朗读。
 */
export function SrStreamAnnouncer() {
  const t = useTranslations('a11y')
  // 只订阅两个叶子值(引用稳定),避免流式高频 set 触发无谓渲染
  const isStreaming = useChatStore((s) => s.isStreaming)
  const contentLength = useChatStore((s) => {
    const msgs = s.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg && msg.role === 'assistant') return (msg.content ?? '').length
    }
    return 0
  })

  const [announcement, setAnnouncement] = React.useState('')
  const lastAnnouncedRef = React.useRef<{ at: number; chars: number }>({ at: 0, chars: 0 })
  const wasStreamingRef = React.useRef(false)

  React.useEffect(() => {
    const now = Date.now()
    if (isStreaming && !wasStreamingRef.current) {
      // 流式开始
      setAnnouncement(buildStreamAnnouncement('start', 0, t))
      lastAnnouncedRef.current = { at: now, chars: 0 }
    } else if (isStreaming && wasStreamingRef.current) {
      // 输出中:节流 + 字数有增长才播报
      const last = lastAnnouncedRef.current
      if (
        shouldAnnounceProgress(
          now - last.at,
          contentLength - last.chars,
          STREAM_ANNOUNCE_INTERVAL_MS,
        )
      ) {
        setAnnouncement(buildStreamAnnouncement('streaming', contentLength, t))
        lastAnnouncedRef.current = { at: now, chars: contentLength }
      }
    } else if (!isStreaming && wasStreamingRef.current) {
      // 流式结束
      setAnnouncement(buildStreamAnnouncement('done', contentLength, t))
      lastAnnouncedRef.current = { at: 0, chars: 0 }
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, contentLength, t])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="sr-stream-announcer"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}

export default SrStreamAnnouncer
