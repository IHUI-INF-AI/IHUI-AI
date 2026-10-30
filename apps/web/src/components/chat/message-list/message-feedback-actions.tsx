// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 消息常驻反馈动作(2026-10-28 立,对标 Qoder reaction 档)。
 *
 * 一句话:**把"问卷才出场的评分"降为"举手之劳的两个键"** ——
 * - D49①/D64⑤ 早就把 like/dislike+原因+评论的落库端点建全了,但 web 端唯一提交点
 *   是主动弹出的 FeedbackSurveyCard;用户想给"好"得等问卷,想给"差"根本无门。
 *   本件把 👍/👎 常驻进 AI 消息操作行,点击即 POST 现成端点(零新后端判据)。
 * - 三态闭环(2026-10-28 补齐,原稿只有两态):点另一枚 = 改判(upsert 覆盖);
 *   **再点已选中的那一枚 = 撤销**(DELETE /messages/:id/feedback)。原稿写"无 delete 端点"
 *   时判断属实,但同一批已把撤销出口补上,故此处同步修正 —— "投错了只能改投另一边、
 *   永远回不到未表态"不是可接受的终局。
 * - 回显 = 服务端读面(serializeMessage 已带 rating)经 `initialRating` 注入,跨重载/换端
 *   不再丢票;本地刚点的结果胜过迟到的初值(见下方 lastInitial 守卫)。
 * - 与问卷合流不回灌:问卷提交成功时 MessageItem 派发 'ihui:feedback-rating-sync',
 *   本件监听并同步选中态 —— 同一 messageId 在一次打开内只有一个真相。
 * - 样式基类复用内核件 message-item-parts 的 ACTION_BTN_CLASS(操作行同一把尺)。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ThumbsDown, ThumbsUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ACTION_BTN_CLASS } from '@/components/chat/message-list/message-item-parts'

export interface MessageFeedbackActionsProps {
  messageId: string
  /**
   * 服务端读回的当前票(2026-10-28 读面)。
   * 字段**缺失**与 `null` 在渲染上等价(都显示未表态),但语义不同:
   * 缺失 = 老服务端或该读面未接;`null` = 明确无票。两者都不得据此回写。
   */
  initialRating?: Rating | null
  /** 流式中的消息不给反馈(内容还没写完,评分无意义) */
  disabled?: boolean
}

type Rating = 'like' | 'dislike'

export function MessageFeedbackActions({
  messageId,
  initialRating = null,
  disabled = false,
}: MessageFeedbackActionsProps) {
  // 取词口径与 MessageItem 本尊一致:t=chat 谱(toast.feedbackFailed 现住 chat.toast)
  const t = useTranslations('chat')
  const { error, success } = useToast()
  const [rating, setRating] = React.useState<Rating | null>(initialRating ?? null)
  const [busy, setBusy] = React.useState(false)

  // 读面晚于首帧到达(列表刷新/重连补发)时跟随服务端。
  // 守卫的必要性:父组件在用户点完之后仍可能带着"操作前的旧快照"重渲染,
  // 无条件下 setRating(initialRating) 会把刚投的那一票当场洗掉 —— 用户的点击
  // 与服务端回填的迟到值之间,必须以"值真的变了"为界,不能用"重渲染了"当信号。
  const lastInitialRef = React.useRef<Rating | null | undefined>(initialRating)
  React.useEffect(() => {
    if (initialRating === lastInitialRef.current) return
    lastInitialRef.current = initialRating
    setRating(initialRating ?? null)
  }, [initialRating])

  const submit = React.useCallback(
    async (next: Rating) => {
      if (disabled || busy) return
      // 再点已选中 = 撤销(toggle 语义,与 aria-pressed 同一把尺);否则投/改判。
      const undoing = next === rating
      setBusy(true)
      try {
        const res = undoing
          ? await fetchApi<{ rated: boolean; rating: null }>(
              `/api/chat/messages/${messageId}/feedback`,
              { method: 'DELETE' },
            )
          : await fetchApi<{ rated: boolean; rating: Rating }>(
              '/api/chat/messages/feedback',
              { method: 'POST', body: JSON.stringify({ messageId, rating: next }) },
            )
        if (!res.success) throw new Error(res.error ?? '')
        setRating(undoing ? null : next)
        // 撤销安静(按压态退回即反馈);like 也静默(对标 Qoder);dislike 轻提示可补详情
        if (!undoing && next === 'dislike') success(t('toast.dislikeThanks'))
      } catch {
        error(t('toast.feedbackFailed'))
      } finally {
        setBusy(false)
      }
    },
    [messageId, rating, disabled, busy, error, success, t],
  )

  React.useEffect(() => {
    const onSurveyResult = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId?: string; rating?: Rating }>).detail
      if (detail?.messageId === messageId && detail.rating) setRating(detail.rating)
    }
    window.addEventListener('ihui:feedback-rating-sync', onSurveyResult as EventListener)
    return () =>
      window.removeEventListener('ihui:feedback-rating-sync', onSurveyResult as EventListener)
  }, [messageId])

  const btn = (r: Rating, Icon: typeof ThumbsUp, testId: string) => (
    <button
      type="button"
      onClick={() => void submit(r)}
      disabled={disabled || busy}
      aria-label={t(r === 'like' ? 'feedbackLike' : 'feedbackDislike')}
      aria-pressed={rating === r}
      data-testid={testId}
      className={cn(ACTION_BTN_CLASS, 'h-7 w-7', rating === r && 'text-primary bg-primary/10')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  )

  return (
    <>
      {btn('like', ThumbsUp, `message-feedback-like-${messageId}`)}
      {btn('dislike', ThumbsDown, `message-feedback-dislike-${messageId}`)}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
