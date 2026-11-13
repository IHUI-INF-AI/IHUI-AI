// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * ChatNoticeLog —— 对话内「提示留痕」的 **web 渲染层**(2026-11 立,对齐 RN 的 `NoticeLog`)。
 *
 * 立因:用户要求「凡 toast 都要在 AI 对话框里留痕」—— sonner 的光条 4s 就消失,无法回看。
 * 本组件挂在消息流尾部(随内容滚动、恒常驻),把本次会话弹出过的提示按时间列出来,可选中复制。
 *
 * 视觉与 RN 对齐(同一套语义):
 * - 一条一行:语义色图标 + `HH:mm` + 文案;
 * - 类型色:success 绿 / error 红 / warning 琥珀 / info 次要文字色;
 * - 文案原样来自 toast(上游已本地化),本组件零硬编码中文,不新增 i18n 键。
 *
 * 边界:记录不进后端上下文/历史(独立 store,不混入 `messages`),只是客户端可视 trace。
 */
import type { ReactElement } from 'react'
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import type { ChatNotice, NoticeKind } from '@ihui/shared/chat/notice-log'
import { useNoticeLog } from '@/lib/notice-log-store'

const ICONS: Readonly<Record<NoticeKind, typeof Check>> = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info,
}

const COLORS: Readonly<Record<NoticeKind, string>> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ChatNoticeLog({
  conversationId,
}: {
  conversationId: string | null
}): ReactElement | null {
  const notices = useNoticeLog(conversationId)
  if (notices.length === 0) return null
  return (
    <div
      className="mt-2 space-y-1 border-t border-border/60 px-3 pt-2"
      data-testid="chat-notice-log"
      aria-label="本次会话的系统提示记录"
    >
      {notices.map((n: ChatNotice) => {
        const Icon = ICONS[n.kind]
        return (
          <div key={n.id} className="flex items-start gap-1.5" data-notice-kind={n.kind}>
            <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${COLORS[n.kind]}`} aria-hidden />
            <span className="shrink-0 text-[11px] leading-4 text-muted-foreground/70 tabular-nums">
              {fmtTime(n.ts)}
            </span>
            <span className="min-w-0 flex-1 select-text text-xs leading-4 text-muted-foreground">
              {n.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default ChatNoticeLog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
